import { useState, useEffect, useRef, useMemo } from "react"
import type {
  ApiAppointment,
  ApiQueueEntry,
  StaffItem,
  ShopHour,
  ShopClosure,
  StaffHour,
  StaffException,
} from "../../lib/api.ts"
import { Badge } from "../../components/ui/Badge"
import { Icon } from "../../components/ui/Icon"
import { useI18n, type TranslationKey } from "../../lib/i18n"
import {
  formatTimeOnly,
  formatDateShort,
  getInitials,
  getDateStringInTimezone,
  getDatePartsInTimezone,
  getDayOfWeekInTimezone,
  getWeekRange,
  getMonthRange,
} from "../../lib/format.ts"
import {
  calculateTimelineConfig,
  getSlotTop,
  getNowPosition,
  getStaffDayAvailability,
  getBookingConflictReason,
  parseTimeString,
  SLOT_HEIGHT,
} from "../../lib/timeline.ts"

interface OpsCalendarProps {
  selectedQueueId: number | null
  onSelectQueue: (id: number | null) => void
  detail: ApiAppointment | null
  onSelectDetail: (appointment: ApiAppointment | null) => void
  queueItems: ApiQueueEntry[]
  appointments: ApiAppointment[]
  staffList: StaffItem[]
  currentDate?: Date
  view?: string
  timezone?: string
  shopHours?: ShopHour[]
  shopClosures?: ShopClosure[]
  staffHours?: StaffHour[]
  staffExceptions?: StaffException[]
  onManageStaffSchedule?: (staff: StaffItem) => void
}

function getSlotHeight(durationMin: number): number {
  return Math.max(34, Math.min(400, (durationMin / 60) * SLOT_HEIGHT - 4))
}

export function OpsCalendar({
  selectedQueueId,
  onSelectQueue,
  detail,
  onSelectDetail,
  queueItems,
  appointments,
  staffList,
  currentDate = new Date(),
  view = "Day",
  timezone = "Asia/Jakarta",
  shopHours,
  shopClosures = [],
  staffHours = [],
  staffExceptions = [],
  onManageStaffSchedule,
}: OpsCalendarProps) {
  const { t, language } = useI18n()
  const [currentTime, setCurrentTime] = useState<Date>(() => new Date())
  const nowLineRef = useRef<HTMLDivElement>(null)
  const hasAutoScrolledRef = useRef(false)

  // 60-second timer to update current time indicator smoothly
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 60000)
    return () => clearInterval(timer)
  }, [])

  // Dynamic timeline boundaries and slot rows derived from business hours and closures
  const timelineConfig = useMemo(() => {
    return calculateTimelineConfig({
      shopHours,
      shopClosures,
      currentDate,
      timezone,
      appointments,
      queueItems,
      slotHeight: SLOT_HEIGHT,
      view,
    })
  }, [shopHours, shopClosures, currentDate, timezone, appointments, queueItems, view])

  const viewedDayStr = useMemo(
    () => getDateStringInTimezone(currentDate, timezone),
    [currentDate, timezone]
  )
  const viewedDow = useMemo(
    () => getDayOfWeekInTimezone(currentDate, timezone),
    [currentDate, timezone]
  )

  // Closures overlapping the viewed Week/Month period
  const periodClosures = useMemo(() => {
    if (view === "Day" || !shopClosures || shopClosures.length === 0) return []
    let startStr = viewedDayStr
    let endStr = viewedDayStr
    if (view === "Week") {
      const { start, end } = getWeekRange(currentDate, timezone)
      startStr = getDateStringInTimezone(start, timezone)
      endStr = getDateStringInTimezone(end, timezone)
    } else if (view === "Month") {
      const { fromStr, toStr } = getMonthRange(currentDate, timezone)
      startStr = fromStr
      endStr = toStr
    }
    return shopClosures.filter((c) => c.start_date <= endStr && c.end_date >= startStr)
  }, [view, shopClosures, currentDate, timezone, viewedDayStr])

  const calcSlotTop = (dateStr: string) => {
    return getSlotTop(
      dateStr,
      timezone,
      timelineConfig.startHour,
      SLOT_HEIGHT,
      timelineConfig.totalHeight,
      timelineConfig.isOvernight
    )
  }

  const calcTimeHmTop = (hm: string): number => {
    const parsed = parseTimeString(hm)
    if (!parsed) return 0
    const mins = (parsed.hour - timelineConfig.startHour) * 60 + parsed.minute
    return Math.max(0, Math.min(timelineConfig.totalHeight, (mins / 60) * SLOT_HEIGHT))
  }

  const unassignedWalkins = useMemo(() => {
    return queueItems.filter((q) => {
      if (q.assigned_staff_id) return false
      if (q.status !== "waiting" && q.status !== "in_service" && q.status !== "completed") {
        return false
      }
      if (!q.arrived_at) return false
      const eventTime =
        (q.status === "completed" || q.status === "in_service") && q.started_at
          ? q.started_at
          : q.arrived_at
      const walkinDayStr = getDateStringInTimezone(new Date(eventTime), timezone)
      const viewedDayStr = getDateStringInTimezone(currentDate, timezone)
      return view === "Day" ? walkinDayStr === viewedDayStr : true
    })
  }, [queueItems, timezone, currentDate, view])

  // Determine if viewing today or the period that contains the current moment
  const isToday = useMemo(() => {
    const todayStr = getDateStringInTimezone(currentTime, timezone)
    const curStr = getDateStringInTimezone(currentDate, timezone)
    return todayStr === curStr
  }, [currentTime, currentDate, timezone])

  const isViewingCurrentPeriod = useMemo(() => {
    const todayStr = getDateStringInTimezone(currentTime, timezone)
    if (view === "Day") {
      return isToday
    }
    if (view === "Week") {
      const { start, end } = getWeekRange(currentDate, timezone)
      const startStr = getDateStringInTimezone(start, timezone)
      const endStr = getDateStringInTimezone(end, timezone)
      return todayStr >= startStr && todayStr <= endStr
    }
    if (view === "Month") {
      const todayParts = getDatePartsInTimezone(currentTime, timezone)
      const curParts = getDatePartsInTimezone(currentDate, timezone)
      return todayParts.year === curParts.year && todayParts.month === curParts.month
    }
    return isToday
  }, [currentTime, currentDate, view, timezone, isToday])

  // Current time position in the dynamic timeline
  const { top: nowTop, isWithinTimeline: isWithinOperatingHours } = useMemo(() => {
    return getNowPosition(
      currentTime,
      timezone,
      timelineConfig.startHour,
      timelineConfig.totalHeight,
      SLOT_HEIGHT,
      timelineConfig.isOvernight
    )
  }, [currentTime, timezone, timelineConfig])

  const showNowLine = isViewingCurrentPeriod && isWithinOperatingHours
  const nowTimeStr = formatTimeOnly(currentTime, timezone)

  // Reset auto-scroll flag whenever the viewed date or view changes
  useEffect(() => {
    hasAutoScrolledRef.current = false
  }, [currentDate, view])

  // Auto-scroll only when viewing today to position current time with context above it
  useEffect(() => {
    if (isToday && showNowLine && !hasAutoScrolledRef.current && nowLineRef.current) {
      hasAutoScrolledRef.current = true
      nowLineRef.current.scrollIntoView({ behavior: "smooth", block: "center" })
    }
  }, [isToday, showNowLine])

  return (
    <section className="ops-calendar">
      {unassignedWalkins.length > 0 && (
        <div className="unassigned-strip">
          <span className="section-index">{t("calendar.unassignedWalkins")}</span>
          {unassignedWalkins.map((w) => {
            const isCompleted = w.status === "completed"
            const isInService = w.status === "in_service"
            const badgeTone = isCompleted ? "stone" : isInService ? "forest" : "warning"
            const badgeLabel = isCompleted ? t("status.completed") : isInService ? t("status.in_service") : t("status.waiting")

            return (
              <button
                key={w.id}
                className={selectedQueueId === w.id ? "selected" : ""}
                onClick={() => onSelectQueue(w.id)}
                type="button"
              >
                <span
                  className={`status-dot ${isCompleted ? "complete-dot" : isInService ? "service-dot" : "waiting-dot"}`}
                />
                <strong>{w.customer_name}</strong>
                <small>
                  {w.service_name} · {t("calendar.arrivedAt", { time: formatTimeOnly(w.arrived_at, timezone) })}
                </small>
                <Badge tone={badgeTone}>{badgeLabel}</Badge>
              </button>
            )
          })}
          <span className="unassigned-hint">{t("calendar.unassignedHint")}</span>
        </div>
      )}

      {timelineConfig.closure && view === "Day" && (
        <div
          style={{
            padding: "10px 16px",
            background: timelineConfig.closure.is_closed
              ? "rgba(207, 60, 60, 0.1)"
              : "#fef8ee",
            borderBottom: timelineConfig.closure.is_closed
              ? "1px solid rgba(207, 60, 60, 0.3)"
              : "1px solid #f3d49e",
            fontSize: "12px",
            color: timelineConfig.closure.is_closed ? "var(--danger)" : "#75521e",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            <Badge tone={timelineConfig.closure.is_closed ? "danger" : "amber"}>
              {timelineConfig.closure.is_closed
                ? t("calendar.closureBannerTitle")
                : t("calendar.closureBannerAdjustedTitle")}
            </Badge>
            <span>
              {timelineConfig.closure.is_closed
                ? t("calendar.closureBannerReason", {
                  reason:
                    timelineConfig.closure.reason ||
                    (language === "id" ? "Penutupan toko" : "Shop closure"),
                })
                : t("calendar.closureBannerAdjustedDesc", {
                  open: (timelineConfig.closure.open_time || "").slice(0, 5),
                  close: (timelineConfig.closure.close_time || "").slice(0, 5),
                  reason:
                    timelineConfig.closure.reason ||
                    (language === "id" ? "Jam operasional khusus" : "Special hours"),
                })}
            </span>
          </div>
          <small style={{ fontWeight: 600 }}>
            {timelineConfig.closure.start_date === timelineConfig.closure.end_date
              ? timelineConfig.closure.start_date
              : `${timelineConfig.closure.start_date} – ${timelineConfig.closure.end_date}`}
          </small>
        </div>
      )}

      {!timelineConfig.closure && timelineConfig.isClosed && view === "Day" && (
        <div
          style={{
            padding: "8px 16px",
            background: "rgba(207, 60, 60, 0.08)",
            borderBottom: "1px solid rgba(207, 60, 60, 0.25)",
            fontSize: "11px",
            color: "var(--danger)",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <Badge tone="danger">{t("closures.badgeClosed")}</Badge>
          <span>
            <strong>{language === "id" ? "Barbershop Tutup:" : "Shop Closed:"}</strong>{" "}
            {t("calendar.shopClosedNotice", {
              start: timelineConfig.startFormatted,
              end: timelineConfig.endFormatted,
            })}
          </span>
        </div>
      )}

      {periodClosures.length > 0 && view !== "Day" && (
        <div
          style={{
            padding: "8px 16px",
            background: "rgba(207, 60, 60, 0.06)",
            borderBottom: "1px solid rgba(207, 60, 60, 0.2)",
            fontSize: "11px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            flexWrap: "wrap",
          }}
        >
          <strong style={{ color: "var(--danger)" }}>
            {language === "id" ? "Penutupan & Jam Khusus:" : "Closures & Special Hours:"}
          </strong>
          {periodClosures.map((c) => (
            <Badge key={c.id} tone={c.is_closed ? "danger" : "amber"}>
              {c.start_date === c.end_date ? c.start_date : `${c.start_date}–${c.end_date}`} ·{" "}
              {c.is_closed
                ? c.reason || t("closures.badgeClosed")
                : `${(c.open_time || "").slice(0, 5)}–${(c.close_time || "").slice(0, 5)}${c.reason ? ` (${c.reason})` : ""}`}
            </Badge>
          ))}
        </div>
      )}

      <div className="ops-grid">
        <div className="time-column ops-time">
          <div className="head-spacer" />
          {timelineConfig.timeSlots.map((tSlot, idx) => (
            <span key={`${tSlot}-${idx}`}>{tSlot}</span>
          ))}
        </div>

        {staffList.length === 0 ? (
          <div
            style={{
              padding: "40px",
              textAlign: "center",
              color: "var(--muted)",
              gridColumn: "2 / -1",
            }}
          >
            {t("calendar.noActiveBarbers")}
          </div>
        ) : (
          staffList.map((barber, idx) => {
            const barberAppointments = appointments.filter(
              (a) =>
                a.staff_id === barber.id &&
                (view === "Day" ? getDateStringInTimezone(a.starts_at, timezone) === viewedDayStr : true)
            )
            const barberWalkins = queueItems.filter(
              (q) =>
                q.assigned_staff_id === barber.id &&
                (q.status === "in_service" || q.status === "waiting" || q.status === "completed")
            )

            const totalActivities = barberAppointments.length + barberWalkins.length
            const staffAvail = getStaffDayAvailability(
              barber.id,
              viewedDayStr,
              viewedDow,
              staffHours,
              staffExceptions
            )
            const isShopClosedDay = view === "Day" && timelineConfig.isClosed
            const isBarberUnavailableDay = view === "Day" && !staffAvail.isWorking

            // Compute unavailable before/after working hours blocks when kapster has specific hours in Day view
            const preShiftTop = 0
            const preShiftHeight =
              view === "Day" &&
                !isShopClosedDay &&
                staffAvail.isWorking &&
                staffAvail.openTime
                ? calcTimeHmTop(staffAvail.openTime)
                : 0
            const postShiftTop =
              view === "Day" &&
                !isShopClosedDay &&
                staffAvail.isWorking &&
                staffAvail.closeTime
                ? calcTimeHmTop(staffAvail.closeTime)
                : timelineConfig.totalHeight
            const postShiftHeight = Math.max(0, timelineConfig.totalHeight - postShiftTop)

            return (
              <div className="barber-column ops-barber" key={barber.id}>
                <div
                  className="barber-head"
                  style={{
                    justifyContent: "space-between",
                    background:
                      isShopClosedDay || isBarberUnavailableDay
                        ? "rgba(207, 60, 60, 0.05)"
                        : undefined,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
                    <span className="avatar small">{getInitials(barber.name)}</span>
                    <span style={{ minWidth: 0 }}>
                      <strong style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {barber.name}
                      </strong>
                      {view === "Day" && isShopClosedDay ? (
                        <small style={{ color: "var(--danger)", fontWeight: 600 }}>
                          {t("closures.badgeClosed")}
                        </small>
                      ) : view === "Day" && staffAvail.status === "leave" ? (
                        <small style={{ color: "var(--danger)", fontWeight: 600 }}>
                          {t("calendar.staffLeaveBadge")}
                          {staffAvail.reason ? ` · ${staffAvail.reason}` : ""}
                        </small>
                      ) : view === "Day" && staffAvail.status === "day_off" ? (
                        <small style={{ color: "var(--danger)", fontWeight: 600 }}>
                          {t("calendar.staffDayOffBadge")}
                        </small>
                      ) : view === "Day" && staffAvail.status === "adjusted" ? (
                        <small style={{ color: "var(--amber)", fontWeight: 600 }}>
                          {t("calendar.staffAdjustedBadge", {
                            hours: `${staffAvail.openTime}–${staffAvail.closeTime}`,
                          })}
                        </small>
                      ) : (
                        <small>
                          <i className={`availability ${totalActivities === 0 ? "open" : ""}`} />
                          {staffAvail.status === "custom_hours" &&
                            staffAvail.openTime &&
                            staffAvail.closeTime
                            ? `${staffAvail.openTime}–${staffAvail.closeTime} · `
                            : ""}
                          {totalActivities === 0
                            ? t("calendar.availableToday")
                            : t("calendar.bookingCount", { count: totalActivities })}
                        </small>
                      )}
                    </span>
                  </div>
                  {onManageStaffSchedule && (
                    <button
                      type="button"
                      className="icon-button"
                      onClick={() => onManageStaffSchedule(barber)}
                      title={t("calendar.manageAvailability")}
                      aria-label={`${t("calendar.manageAvailability")}: ${barber.name}`}
                      style={{ width: "26px", height: "26px", flexShrink: 0 }}
                    >
                      <Icon name="calendar" size={13} />
                    </button>
                  )}
                </div>

                <div
                  className="slots ops-slots"
                  style={{ height: `${timelineConfig.totalHeight}px` }}
                >
                  {timelineConfig.timeSlots.map((_, x) => (
                    <i key={x} />
                  ))}

                  {/* Shop-wide closed day overlay */}
                  {isShopClosedDay && (
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        background:
                          "repeating-linear-gradient(-45deg, rgba(207, 60, 60, 0.04), rgba(207, 60, 60, 0.04) 8px, rgba(207, 60, 60, 0.09) 8px, rgba(207, 60, 60, 0.09) 16px)",
                        pointerEvents: "none",
                        zIndex: 1,
                      }}
                    />
                  )}

                  {/* Kapster full-day leave / day-off overlay */}
                  {!isShopClosedDay && isBarberUnavailableDay && (
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        background:
                          "repeating-linear-gradient(-45deg, rgba(207, 60, 60, 0.03), rgba(207, 60, 60, 0.03) 8px, rgba(120, 115, 106, 0.09) 8px, rgba(120, 115, 106, 0.09) 16px)",
                        pointerEvents: "none",
                        zIndex: 1,
                        display: "flex",
                        alignItems: "flex-start",
                        justifyContent: "center",
                        paddingTop: "12px",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "10px",
                          fontWeight: 700,
                          textTransform: "uppercase",
                          letterSpacing: "0.04em",
                          padding: "3px 8px",
                          borderRadius: "3px",
                          background: "rgba(207, 60, 60, 0.12)",
                          color: "var(--danger)",
                          border: "1px solid rgba(207, 60, 60, 0.25)",
                        }}
                      >
                        {staffAvail.status === "leave"
                          ? `${t("calendar.staffLeaveBadge")}${staffAvail.reason ? `: ${staffAvail.reason}` : ""}`
                          : t("calendar.staffDayOffBadge")}
                      </span>
                    </div>
                  )}

                  {/* Kapster off-shift hours before start time */}
                  {preShiftHeight > 4 && (
                    <div
                      style={{
                        position: "absolute",
                        top: preShiftTop,
                        left: 0,
                        right: 0,
                        height: `${preShiftHeight}px`,
                        background:
                          "repeating-linear-gradient(-45deg, rgba(120, 115, 106, 0.04), rgba(120, 115, 106, 0.04) 6px, rgba(120, 115, 106, 0.09) 6px, rgba(120, 115, 106, 0.09) 12px)",
                        borderBottom: "1px dashed var(--line-strong)",
                        pointerEvents: "none",
                        zIndex: 1,
                      }}
                    />
                  )}

                  {/* Kapster off-shift hours after end time */}
                  {postShiftHeight > 4 && (
                    <div
                      style={{
                        position: "absolute",
                        top: postShiftTop,
                        left: 0,
                        right: 0,
                        height: `${postShiftHeight}px`,
                        background:
                          "repeating-linear-gradient(-45deg, rgba(120, 115, 106, 0.04), rgba(120, 115, 106, 0.04) 6px, rgba(120, 115, 106, 0.09) 6px, rgba(120, 115, 106, 0.09) 12px)",
                        borderTop: "1px dashed var(--line-strong)",
                        pointerEvents: "none",
                        zIndex: 1,
                      }}
                    />
                  )}

                  {/* Real Appointments */}
                  {barberAppointments.map((a) => {
                    const top = calcSlotTop(a.starts_at)
                    const height = getSlotHeight(a.duration_snapshot_min)
                    const isSelected = detail?.id === a.id

                    const isActiveBooking =
                      a.status === "confirmed" || a.status === "checked_in"
                    const conflictReason = isActiveBooking
                      ? getBookingConflictReason(
                        {
                          startsAt: a.starts_at,
                          endsAt: a.ends_at,
                          staffId: a.staff_id,
                        },
                        {
                          timezone,
                          shopHours,
                          shopClosures,
                          staffHours,
                          staffExceptions,
                        }
                      )
                      : null

                    const tone =
                      a.status === "completed"
                        ? "stone"
                        : a.status === "checked_in"
                          ? "forest"
                          : a.status === "cancelled"
                            ? "ink"
                            : "copper"

                    const apptStatusKey = `status.${a.status}` as TranslationKey
                    const apptStatusLabel = t(apptStatusKey).toUpperCase()

                    return (
                      <button
                        key={a.id}
                        onClick={() => onSelectDetail(a)}
                        className={`appointment ${tone} ${isSelected ? "selected" : ""}`}
                        style={{
                          top,
                          height,
                          zIndex: 2,
                          border: conflictReason
                            ? "2px solid var(--danger)"
                            : undefined,
                        }}
                        title={`${a.customer_name} · ${a.service_name}${conflictReason
                            ? ` (${t("calendar.bookingConflictBadge")})`
                            : ""
                          }`}
                        type="button"
                      >
                        <span>
                          {view !== "Day" && (
                            <strong>{formatDateShort(a.starts_at, timezone)} </strong>
                          )}
                          {formatTimeOnly(a.starts_at, timezone)} –{" "}
                          {formatTimeOnly(a.ends_at, timezone)} ·{" "}
                          {apptStatusLabel}
                          {conflictReason && (
                            <strong
                              style={{
                                color: "#fff",
                                background: "var(--danger)",
                                padding: "1px 5px",
                                borderRadius: "3px",
                                marginLeft: "4px",
                                fontSize: "9px",
                              }}
                            >
                              ⚠️ {t("calendar.bookingConflictBadge")}
                            </strong>
                          )}
                        </span>
                        <strong>{a.customer_name}</strong>
                        <small>{a.service_name}</small>
                      </button>
                    )
                  })}

                  {/* Walk-ins assigned to this barber (waiting, in_service, and completed) */}
                  {barberWalkins
                    .filter((q) => {
                      if (!q.arrived_at) return false
                      const eventTime =
                        (q.status === "completed" || q.status === "in_service") && q.started_at
                          ? q.started_at
                          : q.arrived_at
                      const walkinDate = new Date(eventTime)
                      const walkinDayStr = getDateStringInTimezone(walkinDate, timezone)
                      return view === "Day" ? walkinDayStr === viewedDayStr : true
                    })
                    .map((q) => {
                      const isCompleted = q.status === "completed"
                      const isInService = q.status === "in_service"
                      const startTime =
                        (isCompleted || isInService) && q.started_at ? q.started_at : q.arrived_at
                      const top = calcSlotTop(startTime)

                      // Calculate duration:
                      // If finished_at and started_at exist, calculate actual service duration
                      let durationMin = q.duration_snapshot_min || 30
                      if (isCompleted && q.started_at && q.finished_at) {
                        const diffMin = Math.round(
                          (new Date(q.finished_at).getTime() - new Date(q.started_at).getTime()) / 60000
                        )
                        if (diffMin >= 5) {
                          durationMin = diffMin
                        }
                      }
                      const height = getSlotHeight(durationMin)
                      const isSelected = selectedQueueId === q.id

                      const endTimeIso = new Date(
                        new Date(startTime).getTime() + durationMin * 60000
                      ).toISOString()
                      const conflictReason = !isCompleted
                        ? getBookingConflictReason(
                          {
                            startsAt: startTime,
                            endsAt: endTimeIso,
                            staffId: q.assigned_staff_id,
                          },
                          {
                            timezone,
                            shopHours,
                            shopClosures,
                            staffHours,
                            staffExceptions,
                          }
                        )
                        : null

                      const tone = isCompleted ? "stone" : isInService ? "forest" : "amber"
                      const statusLabel = isCompleted
                        ? t("calendar.walkinCompleted")
                        : isInService
                          ? t("calendar.walkinInService")
                          : t("calendar.walkinWaiting")

                      // Format arrival time and service interval
                      let timeDetail = t("calendar.arrivedAt", { time: formatTimeOnly(q.arrived_at, timezone) })
                      if (isCompleted && q.started_at) {
                        const endStr = q.finished_at ? formatTimeOnly(q.finished_at, timezone) : ""
                        timeDetail = endStr
                          ? `${formatTimeOnly(q.started_at, timezone)}–${endStr} · ${t("calendar.arrivedAt", { time: formatTimeOnly(q.arrived_at, timezone) })}`
                          : `${t("calendar.serviceAt", { time: formatTimeOnly(q.started_at, timezone) })} · ${t("calendar.arrivedAt", { time: formatTimeOnly(q.arrived_at, timezone) })}`
                      } else if (isInService && q.started_at) {
                        timeDetail = `${t("calendar.startedAt", { time: formatTimeOnly(q.started_at, timezone) })} · ${t("calendar.arrivedAt", { time: formatTimeOnly(q.arrived_at, timezone) })}`
                      }

                      return (
                        <button
                          key={`walkin-${q.id}`}
                          onClick={() => onSelectQueue(q.id)}
                          className={`appointment ${tone} walkin-block ${isSelected ? "selected" : ""}`}
                          style={{
                            top,
                            height,
                            zIndex: 2,
                            border: conflictReason
                              ? "2px solid var(--danger)"
                              : undefined,
                          }}
                          title={`${statusLabel}: ${q.customer_name}`}
                          type="button"
                        >
                          <span>
                            {view !== "Day" && (
                              <strong>{formatDateShort(startTime, timezone)} </strong>
                            )}
                            {statusLabel} · {timeDetail}
                            {conflictReason && (
                              <strong
                                style={{
                                  color: "#fff",
                                  background: "var(--danger)",
                                  padding: "1px 5px",
                                  borderRadius: "3px",
                                  marginLeft: "4px",
                                  fontSize: "9px",
                                }}
                              >
                                ⚠️ {t("calendar.bookingConflictBadge")}
                              </strong>
                            )}
                          </span>
                          <strong>{q.customer_name}</strong>
                          <small>{q.service_name}</small>
                        </button>
                      )
                    })}

                  {/* Current Time Indicator */}
                  {showNowLine && (
                    <div
                      className={`now-line ${idx === 0 ? "has-dot" : "no-dot"}`}
                      style={{ top: nowTop }}
                      ref={idx === 0 ? nowLineRef : undefined}
                    >
                      {idx === staffList.length - 1 && <span>{nowTimeStr}</span>}
                    </div>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>
    </section>
  )
}
