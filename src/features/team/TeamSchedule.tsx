import React, { useState, useEffect, useCallback, useMemo } from "react"
import {
  staffApi,
  appointmentApi,
  shopApi,
  type StaffItem,
  type StaffScheduleItem,
  type StaffHour,
  type StaffException,
  type BookingConflictDetails,
  type ApiAppointment,
  ApiError,
} from "../../lib/api"
import { Badge } from "../../components/ui/Badge"
import { Icon } from "../../components/ui/Icon"
import {
  getInitials,
  formatTimeOnly,
  getDateStringInTimezone,
  getDayOfWeekInTimezone,
} from "../../lib/format"
import { useAuth } from "../auth/AuthContext"
import { useI18n } from "../../lib/i18n"
import { useToast } from "../../hooks/useToast"

interface TeamScheduleProps {
  staff: StaffItem
  initialTab?: "agenda" | "weekly" | "exceptions"
  onClose: () => void
  onUpdated?: (toastMessage?: string) => void
}

const WEEKDAYS = [
  { day: 1, labelEn: "Monday", labelId: "Senin" },
  { day: 2, labelEn: "Tuesday", labelId: "Selasa" },
  { day: 3, labelEn: "Wednesday", labelId: "Rabu" },
  { day: 4, labelEn: "Thursday", labelId: "Kamis" },
  { day: 5, labelEn: "Friday", labelId: "Jumat" },
  { day: 6, labelEn: "Saturday", labelId: "Sabtu" },
  { day: 0, labelEn: "Sunday", labelId: "Minggu" },
]

function formatTimeInput(val?: string | null, fallback = "09:00"): string {
  if (!val) return fallback
  return val.slice(0, 5)
}

function formatTimeApi(val?: string | null, fallback = "09:00:00"): string {
  if (!val) return fallback
  if (val.length === 5) return `${val}:00`
  return val
}

export function TeamSchedule({
  staff,
  initialTab = "agenda",
  onClose,
  onUpdated,
}: TeamScheduleProps) {
  const { t, language } = useI18n()
  const toast = useToast()
  const { currentShop } = useAuth()
  const canManageSchedule = currentShop?.role === "owner" || currentShop?.role === "manager"

  const [activeTab, setActiveTab] = useState<"agenda" | "weekly" | "exceptions">(initialTab)

  // --- Tab 1: Daily Agenda State ---
  const [currentDate, setCurrentDate] = useState(() => new Date())
  const [timezone, setTimezone] = useState("Asia/Jakarta")
  const [schedule, setSchedule] = useState<StaffScheduleItem | null>(null)
  const [appointments, setAppointments] = useState<ApiAppointment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    shopApi
      .get()
      .then((res) => {
        if (res?.shop?.timezone) {
          setTimezone(res.shop.timezone)
        }
      })
      .catch(() => { })
  }, [])

  const dateStr = useMemo(
    () => getDateStringInTimezone(currentDate, timezone),
    [currentDate, timezone]
  )

  const loadDayData = useCallback(async () => {
    setIsLoading(true)
    setErrorMessage(null)

    try {
      const [schedRes, apptRes] = await Promise.all([
        staffApi.getSchedule(staff.id, dateStr).catch(() => ({
          schedule: {
            staff_id: staff.id,
            date: dateStr,
            day_of_week: getDayOfWeekInTimezone(currentDate, timezone),
            is_open: true,
            open_time: "09:00:00",
            close_time: "21:00:00",
          },
        })),
        appointmentApi.list(dateStr, dateStr, staff.id, true).catch(() => ({ appointments: [] })),
      ])

      setSchedule(schedRes.schedule)
      setAppointments(apptRes.appointments || [])
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message || "Failed to load schedule")
      } else if (err instanceof Error) {
        setErrorMessage(err.message)
      } else {
        setErrorMessage("Network error loading schedule")
      }
    } finally {
      setIsLoading(false)
    }
  }, [staff.id, dateStr, currentDate])

  useEffect(() => {
    if (activeTab === "agenda") {
      loadDayData()
    }
  }, [activeTab, loadDayData])

  // --- Tab 2: Weekly Schedule State ---
  const [weeklyMap, setWeeklyMap] = useState<Record<number, StaffHour>>({})
  const [isLoadingWeekly, setIsLoadingWeekly] = useState(false)
  const [weeklyError, setWeeklyError] = useState<string | null>(null)
  const [isSavingWeekly, setIsSavingWeekly] = useState(false)
  const [isWeeklyDirty, setIsWeeklyDirty] = useState(false)
  const [weeklyConflicts, setWeeklyConflicts] = useState<BookingConflictDetails | null>(null)

  const loadWeeklyHours = useCallback(async () => {
    setIsLoadingWeekly(true)
    setWeeklyError(null)
    try {
      const res = await staffApi.getHours(staff.id)
      const map: Record<number, StaffHour> = {}
      for (const h of res.hours || []) {
        map[h.day_of_week] = h
      }
      for (let d = 0; d <= 6; d++) {
        if (!map[d]) {
          map[d] = {
            staff_id: staff.id,
            day_of_week: d,
            is_working: d !== 0,
            open_time: "09:00:00",
            close_time: "21:00:00",
          }
        }
      }
      setWeeklyMap(map)
      setIsWeeklyDirty(false)
      setWeeklyConflicts(null)
    } catch (err: unknown) {
      if (err instanceof Error) {
        setWeeklyError(err.message)
      }
    } finally {
      setIsLoadingWeekly(false)
    }
  }, [staff.id])

  useEffect(() => {
    if (activeTab === "weekly") {
      loadWeeklyHours()
    }
  }, [activeTab, loadWeeklyHours])

  const handleToggleWorkDay = (day: number, isWorking: boolean) => {
    setWeeklyMap((prev) => ({
      ...prev,
      [day]: {
        ...(prev[day] || {
          staff_id: staff.id,
          day_of_week: day,
          open_time: "09:00:00",
          close_time: "21:00:00",
        }),
        is_working: isWorking,
      },
    }))
    setIsWeeklyDirty(true)
    setWeeklyConflicts(null)
  }

  const handleWeeklyTimeChange = (day: number, field: "open_time" | "close_time", val: string) => {
    setWeeklyMap((prev) => ({
      ...prev,
      [day]: {
        ...(prev[day] || {
          staff_id: staff.id,
          day_of_week: day,
          is_working: true,
          open_time: "09:00:00",
          close_time: "21:00:00",
        }),
        [field]: formatTimeApi(val),
      },
    }))
    setIsWeeklyDirty(true)
    setWeeklyConflicts(null)
  }

  const handleSaveWeeklyHours = async (confirmConflicts = false) => {
    if (!canManageSchedule || isSavingWeekly) return
    setWeeklyError(null)

    for (const wd of WEEKDAYS) {
      const h = weeklyMap[wd.day]
      if (h && h.is_working) {
        const oVal = formatTimeInput(h.open_time)
        const cVal = formatTimeInput(h.close_time)
        if (oVal >= cVal) {
          const dayName = language === "id" ? wd.labelId : wd.labelEn
          setWeeklyError(
            language === "id"
              ? `Jam selesai harus setelah jam mulai untuk hari ${dayName} (${oVal} - ${cVal}).`
              : `End time must be after start time for ${dayName} (${oVal} - ${cVal}).`
          )
          return
        }
      }
    }

    setIsSavingWeekly(true)
    const payload: StaffHour[] = []
    for (let d = 0; d <= 6; d++) {
      const h = weeklyMap[d] || {
        staff_id: staff.id,
        day_of_week: d,
        is_working: false,
        open_time: "09:00:00",
        close_time: "21:00:00",
      }
      payload.push({
        staff_id: staff.id,
        day_of_week: d,
        is_working: h.is_working,
        open_time: formatTimeApi(h.open_time, "09:00:00"),
        close_time: formatTimeApi(h.close_time, "21:00:00"),
      })
    }

    try {
      const res = await staffApi.updateHours(staff.id, payload, confirmConflicts)
      const map: Record<number, StaffHour> = {}
      for (const h of res.hours || []) {
        map[h.day_of_week] = h
      }
      setWeeklyMap(map)
      setIsWeeklyDirty(false)
      setWeeklyConflicts(null)
      const msg = t("availability.weeklySavedToast", { name: staff.name })
      toast.success(msg)
      onUpdated?.(msg)
    } catch (err: unknown) {
      if (err instanceof ApiError && err.code === "existing_bookings_conflict" && err.details) {
        setWeeklyConflicts(err.details as BookingConflictDetails)
      } else if (err instanceof Error) {
        setWeeklyError(err.message)
        toast.error(err.message)
      }
    } finally {
      setIsSavingWeekly(false)
    }
  }

  // --- Tab 3: Leave & Exceptions State ---
  const [exceptions, setExceptions] = useState<StaffException[]>([])
  const [isLoadingExceptions, setIsLoadingExceptions] = useState(false)
  const [exceptionError, setExceptionError] = useState<string | null>(null)
  const [isExceptionFormOpen, setIsExceptionFormOpen] = useState(false)
  const [editingException, setEditingException] = useState<StaffException | null>(null)
  const [excStartDate, setExcStartDate] = useState(() =>
    getDateStringInTimezone(new Date(), "Asia/Jakarta")
  )
  const [excEndDate, setExcEndDate] = useState(() =>
    getDateStringInTimezone(new Date(), "Asia/Jakarta")
  )
  const [excIsWorking, setExcIsWorking] = useState(false)
  const [excOpenTime, setExcOpenTime] = useState("10:00")
  const [excCloseTime, setExcCloseTime] = useState("18:00")
  const [excReason, setExcReason] = useState("")
  const [isSavingException, setIsSavingException] = useState(false)
  const [excConflicts, setExcConflicts] = useState<BookingConflictDetails | null>(null)

  const loadExceptions = useCallback(async () => {
    setIsLoadingExceptions(true)
    setExceptionError(null)
    try {
      const res = await staffApi.listExceptions(staff.id)
      setExceptions(res.exceptions || [])
    } catch (err: unknown) {
      if (err instanceof Error) {
        setExceptionError(err.message)
      }
    } finally {
      setIsLoadingExceptions(false)
    }
  }, [staff.id])

  useEffect(() => {
    if (activeTab === "exceptions") {
      loadExceptions()
    }
  }, [activeTab, loadExceptions])

  const openCreateException = () => {
    const todayStr = getDateStringInTimezone(new Date(), timezone)
    setEditingException(null)
    setExcStartDate(todayStr)
    setExcEndDate(todayStr)
    setExcIsWorking(false)
    setExcOpenTime("10:00")
    setExcCloseTime("18:00")
    setExcReason("")
    setExceptionError(null)
    setExcConflicts(null)
    setIsExceptionFormOpen(true)
  }

  const openEditException = (exc: StaffException) => {
    setEditingException(exc)
    setExcStartDate(exc.start_date)
    setExcEndDate(exc.end_date)
    setExcIsWorking(exc.is_working)
    setExcOpenTime(formatTimeInput(exc.open_time, "10:00"))
    setExcCloseTime(formatTimeInput(exc.close_time, "18:00"))
    setExcReason(exc.reason || "")
    setExceptionError(null)
    setExcConflicts(null)
    setIsExceptionFormOpen(true)
  }

  const handleSaveException = async (confirmConflicts = false) => {
    if (!canManageSchedule || isSavingException) return
    setExceptionError(null)

    if (!excStartDate || !excEndDate) {
      setExceptionError(language === "id" ? "Tanggal mulai dan selesai wajib diisi." : "Start and end dates are required.")
      return
    }
    if (excEndDate < excStartDate) {
      setExceptionError(
        language === "id"
          ? "Tanggal selesai harus sama atau setelah tanggal mulai."
          : "End date must be on or after start date."
      )
      return
    }
    if (excIsWorking && excOpenTime >= excCloseTime) {
      setExceptionError(
        language === "id"
          ? "Jam selesai harus setelah jam mulai."
          : "End time must be after start time."
      )
      return
    }

    setIsSavingException(true)
    try {
      const payload = {
        start_date: excStartDate,
        end_date: excEndDate,
        is_working: excIsWorking,
        open_time: excIsWorking ? formatTimeApi(excOpenTime, "10:00:00") : null,
        close_time: excIsWorking ? formatTimeApi(excCloseTime, "18:00:00") : null,
        reason: excReason.trim(),
        confirm_conflicts: confirmConflicts,
      }
      if (editingException) {
        await staffApi.updateException(staff.id, editingException.id, payload)
      } else {
        await staffApi.createException(staff.id, payload)
      }
      setIsExceptionFormOpen(false)
      setEditingException(null)
      setExcConflicts(null)
      await loadExceptions()
      const msg = t("availability.exceptionSavedToast")
      toast.success(msg)
      onUpdated?.(msg)
    } catch (err: unknown) {
      if (err instanceof ApiError && err.code === "existing_bookings_conflict" && err.details) {
        setExcConflicts(err.details as BookingConflictDetails)
      } else if (err instanceof Error) {
        setExceptionError(err.message)
        toast.error(err.message)
      }
    } finally {
      setIsSavingException(false)
    }
  }

  const handleDeleteException = async (excId: number) => {
    if (!canManageSchedule) return
    try {
      await staffApi.deleteException(staff.id, excId)
      await loadExceptions()
      const msg = t("availability.exceptionDeletedToast")
      toast.success(msg)
      onUpdated?.(msg)
    } catch (err: unknown) {
      if (err instanceof Error) {
        setExceptionError(err.message)
        toast.error(err.message)
      }
    }
  }

  const handlePrevDay = () => {
    setCurrentDate((prev) => {
      const next = new Date(prev)
      next.setDate(next.getDate() - 1)
      return next
    })
  }

  const handleNextDay = () => {
    setCurrentDate((prev) => {
      const next = new Date(prev)
      next.setDate(next.getDate() + 1)
      return next
    })
  }

  const initials = getInitials(staff.name)
  const isOff = schedule ? !schedule.is_open : false

  // Calculate workload metrics
  const activeAppts = appointments.filter((a) => a.status !== "cancelled" && a.status !== "no_show")
  const totalBookedMinutes = activeAppts.reduce((sum, a) => sum + (a.duration_snapshot_min || 30), 0)
  const clientHours = Math.floor(totalBookedMinutes / 60)
  const clientMinutes = totalBookedMinutes % 60
  const clientTimeFormatted = clientHours > 0 ? `${clientHours}h ${clientMinutes}m` : `${clientMinutes}m`

  const dateHeading = currentDate.toLocaleDateString(
    language === "id" ? "id-ID" : "en-US",
    {
      weekday: "long",
      month: "short",
      day: "numeric",
      timeZone: timezone,
    }
  )

  return (
    <div className="team-schedule-backdrop" onMouseDown={onClose}>
      <aside
        className="team-schedule-drawer"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="team-schedule-title"
      >
        <div className="modal-head">
          <div className="schedule-profile">
            <span className="avatar portrait">{initials}</span>
            <div>
              <span className="section-index">{t("team.scheduleTab").toUpperCase()}</span>
              <h2 id="team-schedule-title">{staff.name}</h2>
              <p>{staff.contact || (staff.active ? t("common.active") : t("common.inactive"))}</p>
            </div>
          </div>
          <button
            className="icon-button"
            onClick={onClose}
            aria-label={t("common.close")}
          >
            ×
          </button>
        </div>

        {/* Navigation Tabs */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "6px",
            marginTop: "18px",
            paddingBottom: "12px",
            borderBottom: "1px solid var(--line)",
          }}
        >
          <button
            type="button"
            className={activeTab === "agenda" ? "primary-button" : "filter-button"}
            style={{ justifyContent: "center", fontSize: "11px", padding: "8px 6px" }}
            onClick={() => setActiveTab("agenda")}
          >
            {t("availability.tabAgenda")}
          </button>
          <button
            type="button"
            className={activeTab === "weekly" ? "primary-button" : "filter-button"}
            style={{ justifyContent: "center", fontSize: "11px", padding: "8px 6px" }}
            onClick={() => setActiveTab("weekly")}
          >
            {t("availability.tabWeekly")}
          </button>
          <button
            type="button"
            className={activeTab === "exceptions" ? "primary-button" : "filter-button"}
            style={{ justifyContent: "center", fontSize: "11px", padding: "8px 6px" }}
            onClick={() => setActiveTab("exceptions")}
          >
            {t("availability.tabExceptions")}
          </button>
        </div>

        {/* === TAB 1: DAILY AGENDA === */}
        {activeTab === "agenda" && (
          <>
            <div className="schedule-datebar">
              <button onClick={handlePrevDay} aria-label="Previous day">
                ‹
              </button>
              <div>
                <strong>{dateHeading}</strong>
                <small>
                  {isOff
                    ? schedule?.shop_closed
                      ? `${t("calendar.closureBannerTitle")}${schedule.reason ? ` · ${schedule.reason}` : ""}`
                      : `${t("team.notScheduled")}${schedule?.reason ? ` · ${schedule.reason}` : ""}`
                    : schedule
                      ? `${schedule.open_time.slice(0, 5)} – ${schedule.close_time.slice(0, 5)}${schedule.source === "staff_exception" && schedule.reason ? ` · ${schedule.reason}` : ""
                      }`
                      : "09:00 – 21:00"}
                </small>
              </div>
              <button onClick={handleNextDay} aria-label="Next day">
                ›
              </button>
            </div>

            {errorMessage && (
              <div
                className="login-error-alert"
                role="alert"
                style={{ margin: "16px 0", color: "var(--red, #cf3c3c)" }}
              >
                <Icon name="bell" size={16} />
                <span>{errorMessage}</span>
              </div>
            )}

            {isLoading ? (
              <div style={{ padding: "48px 24px", textAlign: "center", color: "var(--muted)", fontSize: "11px" }}>
                {t("team.loadingAgenda")}
              </div>
            ) : isOff && activeAppts.length === 0 ? (
              <div className="staff-off-state">
                <span className="avatar portrait">{initials}</span>
                <h3>
                  {schedule?.shop_closed
                    ? t("calendar.closureBannerTitle")
                    : schedule?.source === "staff_exception"
                      ? t("availability.badgeLeave")
                      : t("team.dayOff")}
                </h3>
                <p>
                  {schedule?.reason
                    ? `${schedule.reason} — ${t("team.dayOffDesc", { name: staff.name })}`
                    : t("team.dayOffDesc", { name: staff.name })}
                </p>
              </div>
            ) : (
              <>
                {isOff && activeAppts.length > 0 && (
                  <div
                    role="alert"
                    style={{
                      marginBottom: "14px",
                      padding: "10px 12px",
                      border: "1px solid var(--red, #cf3c3c)",
                      background: "rgba(207, 60, 60, 0.08)",
                      color: "var(--red, #cf3c3c)",
                      fontSize: "11px",
                    }}
                  >
                    <strong>{t("calendar.bookingConflictBadge")}</strong>:{" "}
                    {schedule?.shop_closed
                      ? t("calendar.bookingConflictClosure")
                      : t("calendar.bookingConflictStaff")}
                  </div>
                )}

                <div className="staff-workload">
                  <span>
                    <small>{t("team.bookingsHeader")}</small>
                    <strong>{activeAppts.length}</strong>
                  </span>
                  <span>
                    <small>{t("team.clientTimeHeader")}</small>
                    <strong>{clientTimeFormatted}</strong>
                  </span>
                  <span>
                    <small>{t("team.commissionHeader")}</small>
                    <strong>
                      {staff.commission_bps != null ? `${staff.commission_bps / 100}%` : t("team.standardRate")}
                    </strong>
                  </span>
                </div>

                <div className="staff-agenda">
                  <div className="agenda-line" />
                  {activeAppts.length === 0 ? (
                    <div style={{ padding: "36px 16px", textAlign: "center", color: "var(--muted)", fontSize: "11px" }}>
                      {t("team.noAppointmentsForStaff", { name: staff.name })}
                    </div>
                  ) : (
                    activeAppts.map((item) => {
                      const startTime = formatTimeOnly(item.starts_at, timezone)
                      const endTime = formatTimeOnly(item.ends_at, timezone)
                      const isCheckedIn = item.status === "checked_in"
                      const isCompleted = item.status === "completed"

                      return (
                        <article className="agenda-item" key={item.id}>
                          <div className="agenda-time">
                            <strong>{startTime}</strong>
                            <span>{endTime}</span>
                          </div>
                          <div className={`agenda-block ${isCheckedIn ? "service-dot" : ""}`}>
                            <div>
                              <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                                <Badge
                                  tone={
                                    isCompleted
                                      ? "neutral"
                                      : isCheckedIn
                                        ? "success"
                                        : "neutral"
                                  }
                                >
                                  {isCheckedIn
                                    ? t("status.in_service")
                                    : isCompleted
                                      ? t("status.completed")
                                      : t("status.confirmed")}
                                </Badge>
                                {isOff && !isCompleted && (
                                  <Badge tone="danger">{t("calendar.bookingConflictBadge")}</Badge>
                                )}
                              </div>
                              <span>{item.duration_snapshot_min || 30} {t("common.minutes")}</span>
                            </div>
                            <h3>{item.customer_name}</h3>
                            <p>{item.service_name}</p>
                          </div>
                        </article>
                      )
                    })
                  )}
                </div>
              </>
            )}
          </>
        )}

        {/* === TAB 2: WEEKLY SCHEDULE === */}
        {activeTab === "weekly" && (
          <div style={{ paddingTop: "16px" }}>
            <h3 style={{ margin: "0 0 4px", fontSize: "15px" }}>{t("availability.weeklyTitle")}</h3>
            <p style={{ margin: "0 0 16px", fontSize: "11px", color: "var(--muted)" }}>
              {t("availability.weeklySubtitle", { name: staff.name })}
            </p>

            {weeklyError && (
              <div
                className="login-error-alert"
                role="alert"
                style={{
                  marginBottom: "14px",
                  padding: "10px 12px",
                  border: "1px solid var(--red, #cf3c3c)",
                  background: "rgba(207, 60, 60, 0.08)",
                  color: "var(--red, #cf3c3c)",
                  fontSize: "11px",
                }}
              >
                {weeklyError}
              </div>
            )}

            {isLoadingWeekly ? (
              <div style={{ padding: "32px 0", textAlign: "center", color: "var(--muted)", fontSize: "11px" }}>
                {t("common.loading")}
              </div>
            ) : (
              <div className="hours-list">
                {WEEKDAYS.map((wd) => {
                  const h = weeklyMap[wd.day] || {
                    staff_id: staff.id,
                    day_of_week: wd.day,
                    is_working: wd.day !== 0,
                    open_time: "09:00:00",
                    close_time: "21:00:00",
                  }
                  const dayLabel = language === "id" ? wd.labelId : wd.labelEn

                  return (
                    <div key={wd.day}>
                      <label className="switch">
                        <input
                          type="checkbox"
                          checked={h.is_working}
                          disabled={!canManageSchedule}
                          onChange={(e) => handleToggleWorkDay(wd.day, e.target.checked)}
                        />
                        <i />
                      </label>
                      <strong>{dayLabel}</strong>
                      {h.is_working ? (
                        <>
                          <input
                            type="time"
                            disabled={!canManageSchedule}
                            value={formatTimeInput(h.open_time, "09:00")}
                            onChange={(e) => handleWeeklyTimeChange(wd.day, "open_time", e.target.value)}
                          />
                          <span className="hours-sep">{language === "id" ? "sampai" : "to"}</span>
                          <input
                            type="time"
                            disabled={!canManageSchedule}
                            value={formatTimeInput(h.close_time, "21:00")}
                            onChange={(e) => handleWeeklyTimeChange(wd.day, "close_time", e.target.value)}
                          />
                        </>
                      ) : (
                        <em style={{ gridColumn: "3 / -1", color: "var(--red, #cf3c3c)" }}>
                          {t("availability.dayOff")}
                        </em>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {weeklyConflicts && (
              <div
                role="alert"
                style={{
                  marginTop: "14px",
                  padding: "12px 14px",
                  border: "1px solid var(--red, #cf3c3c)",
                  background: "rgba(207, 60, 60, 0.08)",
                  fontSize: "11px",
                }}
              >
                <strong style={{ color: "var(--red, #cf3c3c)", display: "block", marginBottom: "4px" }}>
                  {t("closures.conflictWarningTitle")}
                </strong>
                <p style={{ margin: "0 0 8px", color: "var(--muted)" }}>
                  {t("closures.conflictWarningDesc")}
                </p>
                <ul style={{ margin: "0 0 10px", paddingLeft: "18px" }}>
                  {(weeklyConflicts.affected_appointments || []).map((a) => (
                    <li key={`appt-${a.id}`}>
                      <strong>{a.customer_name}</strong> — {a.service_name} (
                      {new Date(a.starts_at).toLocaleString(language === "id" ? "id-ID" : "en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      )
                    </li>
                  ))}
                  {(weeklyConflicts.affected_walk_ins || []).map((w) => (
                    <li key={`walkin-${w.id}`}>
                      <strong>{w.customer_name}</strong> — {w.service_name}
                    </li>
                  ))}
                </ul>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    type="button"
                    className="primary-button"
                    style={{ background: "var(--red, #cf3c3c)", borderColor: "var(--red, #cf3c3c)" }}
                    disabled={isSavingWeekly}
                    onClick={() => handleSaveWeeklyHours(true)}
                  >
                    {t("closures.confirmAndSave")}
                  </button>
                  <button
                    type="button"
                    className="filter-button"
                    onClick={() => setWeeklyConflicts(null)}
                  >
                    {t("common.cancel")}
                  </button>
                </div>
              </div>
            )}

            {canManageSchedule && !weeklyConflicts && (
              <button
                type="button"
                className="primary-button"
                style={{ marginTop: "16px", width: "100%", justifyContent: "center" }}
                disabled={isSavingWeekly || !isWeeklyDirty}
                onClick={() => handleSaveWeeklyHours(false)}
              >
                {isSavingWeekly ? t("common.saving") : t("availability.saveWeekly")}
              </button>
            )}
          </div>
        )}

        {/* === TAB 3: LEAVE & EXCEPTIONS === */}
        {activeTab === "exceptions" && (
          <div style={{ paddingTop: "16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px", marginBottom: "14px" }}>
              <div>
                <h3 style={{ margin: "0 0 4px", fontSize: "15px" }}>{t("availability.exceptionsTitle")}</h3>
                <p style={{ margin: 0, fontSize: "11px", color: "var(--muted)" }}>
                  {t("availability.exceptionsSubtitle", { name: staff.name })}
                </p>
              </div>
              {canManageSchedule && !isExceptionFormOpen && (
                <button
                  type="button"
                  className="filter-button"
                  style={{ fontWeight: 600, flexShrink: 0 }}
                  onClick={openCreateException}
                >
                  {t("availability.addException")}
                </button>
              )}
            </div>

            {exceptionError && (
              <div
                className="login-error-alert"
                role="alert"
                style={{
                  marginBottom: "14px",
                  padding: "10px 12px",
                  border: "1px solid var(--red, #cf3c3c)",
                  background: "rgba(207, 60, 60, 0.08)",
                  color: "var(--red, #cf3c3c)",
                  fontSize: "11px",
                }}
              >
                {exceptionError}
              </div>
            )}

            {isExceptionFormOpen && canManageSchedule && (
              <div
                style={{
                  padding: "14px",
                  background: "var(--white)",
                  border: "1px solid var(--line)",
                  marginBottom: "16px",
                }}
              >
                <strong style={{ display: "block", fontSize: "12px", marginBottom: "10px" }}>
                  {editingException ? t("availability.editException") : t("availability.addException")}
                </strong>

                <div className="form-grid">
                  <label>
                    {t("closures.startDate")} *
                    <input
                      type="date"
                      value={excStartDate}
                      onChange={(e) => {
                        const v = e.target.value
                        setExcStartDate(v)
                        if (excEndDate < v) setExcEndDate(v)
                        setExcConflicts(null)
                      }}
                    />
                  </label>
                  <label>
                    {t("closures.endDate")} *
                    <input
                      type="date"
                      min={excStartDate}
                      value={excEndDate}
                      onChange={(e) => {
                        setExcEndDate(e.target.value)
                        setExcConflicts(null)
                      }}
                    />
                  </label>

                  <label className="full">
                    {t("closures.modeLabel")}
                    <select
                      value={excIsWorking ? "adjusted" : "leave"}
                      onChange={(e) => {
                        setExcIsWorking(e.target.value === "adjusted")
                        setExcConflicts(null)
                      }}
                    >
                      <option value="leave">{t("availability.leaveFullDay")}</option>
                      <option value="adjusted">{t("availability.adjustedWorkingHours")}</option>
                    </select>
                  </label>

                  {excIsWorking && (
                    <>
                      <label>
                        {t("closures.openTime")} *
                        <input
                          type="time"
                          value={excOpenTime}
                          onChange={(e) => {
                            setExcOpenTime(e.target.value)
                            setExcConflicts(null)
                          }}
                        />
                      </label>
                      <label>
                        {t("closures.closeTime")} *
                        <input
                          type="time"
                          value={excCloseTime}
                          onChange={(e) => {
                            setExcCloseTime(e.target.value)
                            setExcConflicts(null)
                          }}
                        />
                      </label>
                    </>
                  )}

                  <label className="full">
                    {t("closures.reasonLabel")}
                    <input
                      type="text"
                      value={excReason}
                      placeholder={t("availability.reasonPlaceholder")}
                      onChange={(e) => setExcReason(e.target.value)}
                    />
                  </label>
                </div>

                {excConflicts && (
                  <div
                    role="alert"
                    style={{
                      marginTop: "12px",
                      padding: "12px",
                      border: "1px solid var(--red, #cf3c3c)",
                      background: "rgba(207, 60, 60, 0.08)",
                      fontSize: "11px",
                    }}
                  >
                    <strong style={{ color: "var(--red, #cf3c3c)", display: "block", marginBottom: "4px" }}>
                      {t("closures.conflictWarningTitle")}
                    </strong>
                    <p style={{ margin: "0 0 8px", color: "var(--muted)" }}>
                      {t("closures.conflictWarningDesc")}
                    </p>
                    <ul style={{ margin: "0 0 10px", paddingLeft: "18px" }}>
                      {(excConflicts.affected_appointments || []).map((a) => (
                        <li key={`appt-${a.id}`}>
                          <strong>{a.customer_name}</strong> — {a.service_name} (
                          {new Date(a.starts_at).toLocaleString(language === "id" ? "id-ID" : "en-US", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                          )
                        </li>
                      ))}
                      {(excConflicts.affected_walk_ins || []).map((w) => (
                        <li key={`walkin-${w.id}`}>
                          <strong>{w.customer_name}</strong> — {w.service_name}
                        </li>
                      ))}
                    </ul>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button
                        type="button"
                        className="primary-button"
                        style={{ background: "var(--red, #cf3c3c)", borderColor: "var(--red, #cf3c3c)" }}
                        disabled={isSavingException}
                        onClick={() => handleSaveException(true)}
                      >
                        {t("closures.confirmAndSave")}
                      </button>
                      <button
                        type="button"
                        className="filter-button"
                        onClick={() => setExcConflicts(null)}
                      >
                        {t("common.cancel")}
                      </button>
                    </div>
                  </div>
                )}

                {!excConflicts && (
                  <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
                    <button
                      type="button"
                      className="primary-button"
                      disabled={isSavingException}
                      onClick={() => handleSaveException(false)}
                    >
                      {isSavingException ? t("common.saving") : t("common.save")}
                    </button>
                    <button
                      type="button"
                      className="filter-button"
                      disabled={isSavingException}
                      onClick={() => {
                        setIsExceptionFormOpen(false)
                        setEditingException(null)
                        setExcConflicts(null)
                      }}
                    >
                      {t("common.cancel")}
                    </button>
                  </div>
                )}
              </div>
            )}

            {isLoadingExceptions ? (
              <div style={{ padding: "24px 0", textAlign: "center", color: "var(--muted)", fontSize: "11px" }}>
                {t("common.loading")}
              </div>
            ) : exceptions.length === 0 ? (
              <div
                style={{
                  padding: "24px 14px",
                  border: "1px dashed var(--line)",
                  textAlign: "center",
                  color: "var(--muted)",
                  fontSize: "11px",
                }}
              >
                {t("availability.noExceptions", { name: staff.name })}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {exceptions.map((exc) => {
                  const dateRangeLabel =
                    exc.start_date === exc.end_date
                      ? exc.start_date
                      : `${exc.start_date} – ${exc.end_date}`
                  return (
                    <div
                      key={exc.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "10px",
                        padding: "10px 12px",
                        background: "var(--white)",
                        border: "1px solid var(--line)",
                        borderLeft: exc.is_working
                          ? "3px solid var(--amber, #b7791f)"
                          : "3px solid var(--red, #cf3c3c)",
                      }}
                    >
                      <div>
                        <strong style={{ display: "block", fontSize: "12px" }}>
                          {exc.reason || (exc.is_working ? t("availability.adjustedWorkingHours") : t("availability.leaveFullDay"))}
                        </strong>
                        <small style={{ color: "var(--muted)", fontSize: "10px" }}>{dateRangeLabel}</small>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                        <Badge tone={exc.is_working ? "warning" : "danger"}>
                          {exc.is_working
                            ? t("availability.badgeAdjusted", {
                              open: formatTimeInput(exc.open_time, "09:00"),
                              close: formatTimeInput(exc.close_time, "21:00"),
                            })
                            : t("availability.badgeLeave")}
                        </Badge>
                        {canManageSchedule && (
                          <>
                            <button
                              type="button"
                              className="filter-button"
                              style={{ fontSize: "10px", padding: "4px 8px" }}
                              onClick={() => openEditException(exc)}
                            >
                              {t("common.edit")}
                            </button>
                            <button
                              type="button"
                              className="filter-button"
                              style={{ fontSize: "10px", padding: "4px 8px", color: "var(--red, #cf3c3c)" }}
                              onClick={() => handleDeleteException(exc.id)}
                            >
                              {t("common.delete")}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        <div className="schedule-drawer-actions">
          <button className="filter-button" onClick={onClose}>
            {t("common.close")}
          </button>
        </div>
      </aside>
    </div>
  )
}
