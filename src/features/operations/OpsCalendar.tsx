import { useState, useEffect, useRef, useMemo } from "react"
import type { ApiAppointment, ApiQueueEntry, StaffItem, ShopHour } from "../../lib/api.ts"
import { Badge } from "../../components/ui/Badge"
import {
  formatTimeOnly,
  formatDateShort,
  getInitials,
  formatMinutesAgo,
  getDateStringInTimezone,
  getDatePartsInTimezone,
  getWeekRange,
} from "../../lib/format.ts"
import {
  calculateTimelineConfig,
  getSlotTop,
  getNowPosition,
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
}: OpsCalendarProps) {
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

  // Dynamic timeline boundaries and slot rows derived from business hours
  const timelineConfig = useMemo(() => {
    return calculateTimelineConfig({
      shopHours,
      currentDate,
      timezone,
      appointments,
      queueItems,
      slotHeight: SLOT_HEIGHT,
      view,
    })
  }, [shopHours, currentDate, timezone, appointments, queueItems, view])

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
          <span className="section-index">UNASSIGNED WALK-INS</span>
          {unassignedWalkins.map((w) => {
            const isCompleted = w.status === "completed"
            const isInService = w.status === "in_service"
            const badgeTone = isCompleted ? "stone" : isInService ? "forest" : "warning"
            const badgeLabel = isCompleted ? "Completed" : isInService ? "In Service" : "Waiting"

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
                  {w.service_name} · Arr {formatTimeOnly(w.arrived_at, timezone)}
                </small>
                <Badge tone={badgeTone}>{badgeLabel}</Badge>
              </button>
            )
          })}
          <span className="unassigned-hint">Click to view or assign from the queue</span>
        </div>
      )}

      {timelineConfig.isClosed && view === "Day" && (
        <div
          style={{
            padding: "8px 16px",
            background: "var(--paper-2)",
            borderBottom: "1px solid var(--line)",
            fontSize: "11px",
            color: "var(--muted)",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <span>ℹ️</span>
          <span>
            <strong>Shop Closed:</strong> Regular business hours mark this day as closed.
            Timeline displays hours ({timelineConfig.startFormatted} – {timelineConfig.endFormatted}) to view any bookings.
          </span>
        </div>
      )}

      <div className="ops-grid">
        <div className="time-column ops-time">
          <div className="head-spacer" />
          {timelineConfig.timeSlots.map((t, idx) => (
            <span key={`${t}-${idx}`}>{t}</span>
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
            No active barbers found for this shop.
          </div>
        ) : (
          staffList.map((barber, idx) => {
            const barberAppointments = appointments.filter((a) => a.staff_id === barber.id)
            const barberWalkins = queueItems.filter(
              (q) =>
                q.assigned_staff_id === barber.id &&
                (q.status === "in_service" || q.status === "waiting" || q.status === "completed")
            )

            const totalActivities = barberAppointments.length + barberWalkins.length

            return (
              <div className="barber-column ops-barber" key={barber.id}>
                <div className="barber-head">
                  <span className="avatar small">{getInitials(barber.name)}</span>
                  <span>
                    <strong>{barber.name}</strong>
                    <small>
                      <i className={`availability ${totalActivities === 0 ? "open" : ""}`} />
                      {totalActivities === 0 ? "Available today" : `${totalActivities} booking(s)`}
                    </small>
                  </span>
                </div>

                <div
                  className="slots ops-slots"
                  style={{ height: `${timelineConfig.totalHeight}px` }}
                >
                  {timelineConfig.timeSlots.map((_, x) => (
                    <i key={x} />
                  ))}

                  {/* Real Appointments */}
                  {barberAppointments.map((a) => {
                    const top = calcSlotTop(a.starts_at)
                    const height = getSlotHeight(a.duration_snapshot_min)
                    const isSelected = detail?.id === a.id

                    const tone =
                      a.status === "completed"
                        ? "stone"
                        : a.status === "checked_in"
                          ? "forest"
                          : a.status === "cancelled"
                            ? "ink"
                            : "copper"

                    return (
                      <button
                        key={a.id}
                        onClick={() => onSelectDetail(a)}
                        className={`appointment ${tone} ${isSelected ? "selected" : ""}`}
                        style={{ top, height }}
                        title={`${a.customer_name} · ${a.service_name}`}
                        type="button"
                      >
                        <span>
                          {view !== "Day" && (
                            <strong>{formatDateShort(a.starts_at, timezone)} </strong>
                          )}
                          {formatTimeOnly(a.starts_at, timezone)} –{" "}
                          {formatTimeOnly(a.ends_at, timezone)} ·{" "}
                          {a.status.replace("_", " ").toUpperCase()}
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
                      const viewedDayStr = getDateStringInTimezone(currentDate, timezone)
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

                      const tone = isCompleted ? "stone" : isInService ? "forest" : "amber"
                      const statusLabel = isCompleted
                        ? "WALK-IN · COMPLETED"
                        : isInService
                        ? "WALK-IN · IN SERVICE"
                        : "WALK-IN · WAITING"

                      // Format arrival time and service interval
                      let timeDetail = `Arr ${formatTimeOnly(q.arrived_at, timezone)}`
                      if (isCompleted && q.started_at) {
                        const endStr = q.finished_at ? formatTimeOnly(q.finished_at, timezone) : ""
                        timeDetail = endStr
                          ? `${formatTimeOnly(q.started_at, timezone)}–${endStr} · Arr ${formatTimeOnly(q.arrived_at, timezone)}`
                          : `Svc ${formatTimeOnly(q.started_at, timezone)} · Arr ${formatTimeOnly(q.arrived_at, timezone)}`
                      } else if (isInService && q.started_at) {
                        timeDetail = `Started ${formatTimeOnly(q.started_at, timezone)} · Arr ${formatTimeOnly(q.arrived_at, timezone)}`
                      }

                      return (
                        <button
                          key={`walkin-${q.id}`}
                          onClick={() => onSelectQueue(q.id)}
                          className={`appointment ${tone} walkin-block ${isSelected ? "selected" : ""}`}
                          style={{ top, height }}
                          title={`Walk-in: ${q.customer_name} (${statusLabel})`}
                          type="button"
                        >
                          <span>
                            {view !== "Day" && (
                              <strong>{formatDateShort(startTime, timezone)} </strong>
                            )}
                            {statusLabel} · {timeDetail}
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
