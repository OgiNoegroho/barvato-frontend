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
import { Button } from "../../components/ui/Button"
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
  }, [staff.id, dateStr, currentDate, timezone])

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

  const handleToggleWorkDay = (day: number, checked: boolean) => {
    if (!canManageSchedule) return
    setWeeklyMap((prev) => ({
      ...prev,
      [day]: {
        ...(prev[day] || {
          staff_id: staff.id,
          day_of_week: day,
          open_time: "09:00:00",
          close_time: "21:00:00",
        }),
        is_working: checked,
      },
    }))
    setIsWeeklyDirty(true)
    setWeeklyConflicts(null)
  }

  const handleWeeklyTimeChange = (day: number, field: "open_time" | "close_time", val: string) => {
    if (!canManageSchedule) return
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
      setExceptionError(language === "id" ? "Tanggal selesai tidak boleh sebelum tanggal mulai." : "End date cannot be earlier than start date.")
      return
    }

    if (excIsWorking) {
      const o = excOpenTime
      const c = excCloseTime
      if (o >= c) {
        setExceptionError(language === "id" ? "Jam tutup harus lebih malam dari jam buka." : "Close time must be after open time.")
        return
      }
    }

    setIsSavingException(true)

    try {
      if (editingException) {
        await staffApi.updateException(staff.id, editingException.id, {
          start_date: excStartDate,
          end_date: excEndDate,
          is_working: excIsWorking,
          open_time: excIsWorking ? formatTimeApi(excOpenTime) : undefined,
          close_time: excIsWorking ? formatTimeApi(excCloseTime) : undefined,
          reason: excReason.trim() || undefined,
          confirm_conflicts: confirmConflicts,
        })
      } else {
        await staffApi.createException(staff.id, {
          start_date: excStartDate,
          end_date: excEndDate,
          is_working: excIsWorking,
          open_time: excIsWorking ? formatTimeApi(excOpenTime) : undefined,
          close_time: excIsWorking ? formatTimeApi(excCloseTime) : undefined,
          reason: excReason.trim() || undefined,
          confirm_conflicts: confirmConflicts,
        })
      }

      setIsExceptionFormOpen(false)
      setEditingException(null)
      setExcConflicts(null)
      const msg = t("availability.exceptionSavedToast", { name: staff.name })
      toast.success(msg)
      onUpdated?.(msg)
      loadExceptions()
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

  const handleDeleteException = async (exceptionId: number) => {
    if (!canManageSchedule) return
    const confirmMsg = language === "id" ? "Hapus pengecualian jadwal ini?" : "Delete this schedule exception?"
    if (!confirm(confirmMsg)) return

    try {
      await staffApi.deleteException(staff.id, exceptionId)
      const msg = t("availability.exceptionDeletedToast")
      toast.success(msg)
      onUpdated?.(msg)
      loadExceptions()
    } catch (err: unknown) {
      if (err instanceof Error) {
        toast.error(err.message)
      }
    }
  }

  const handlePrevDay = () => {
    const next = new Date(currentDate)
    next.setDate(next.getDate() - 1)
    setCurrentDate(next)
  }

  const handleNextDay = () => {
    const next = new Date(currentDate)
    next.setDate(next.getDate() + 1)
    setCurrentDate(next)
  }

  const dateHeading = currentDate.toLocaleDateString(language === "id" ? "id-ID" : "en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  })

  const initials = getInitials(staff.name)
  const isOff = schedule ? !schedule.is_open : false
  const activeAppts = appointments.filter((a) => a.status !== "cancelled")

  const totalMinutes = activeAppts.reduce((sum, a) => sum + (a.duration_snapshot_min || 30), 0)
  const hoursPart = Math.floor(totalMinutes / 60)
  const minsPart = totalMinutes % 60
  const clientTimeFormatted = `${hoursPart}j ${minsPart}m`

  return (
    <div
      className="team-schedule-backdrop fixed inset-0 z-modal bg-charcoal/60 flex justify-end"
      onMouseDown={onClose}
    >
      <aside
        className="team-schedule-drawer w-full max-w-[520px] h-full bg-ivory-light border-l border-stone shadow-modal p-6 overflow-y-auto flex flex-col"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Profile Header */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-charcoal text-ivory-light flex items-center justify-center font-serif text-lg font-bold shrink-0">
            {initials}
          </div>
          <div>
            <span className="text-[10px] uppercase tracking-wider text-muted-text font-bold block mb-0.5">
              {staff.role === "manager"
                ? t("roles.manager")
                : staff.role === "owner"
                ? t("roles.owner")
                : t("roles.barber")}
            </span>
            <h2 className="font-serif text-2xl text-charcoal">{staff.name}</h2>
          </div>
          <button
            type="button"
            className="ml-auto text-muted-text hover:text-charcoal p-1 rounded-sm text-2xl leading-none cursor-pointer"
            onClick={onClose}
            aria-label={t("common.close")}
          >
            ×
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="grid grid-cols-3 gap-2 mt-4 pb-3 border-b border-stone">
          <Button
            type="button"
            variant={activeTab === "agenda" ? "primary" : "outline"}
            size="sm"
            className="w-full justify-center text-xs"
            onClick={() => setActiveTab("agenda")}
          >
            {t("availability.tabAgenda")}
          </Button>
          <Button
            type="button"
            variant={activeTab === "weekly" ? "primary" : "outline"}
            size="sm"
            className="w-full justify-center text-xs"
            onClick={() => setActiveTab("weekly")}
          >
            {t("availability.tabWeekly")}
          </Button>
          <Button
            type="button"
            variant={activeTab === "exceptions" ? "primary" : "outline"}
            size="sm"
            className="w-full justify-center text-xs"
            onClick={() => setActiveTab("exceptions")}
          >
            {t("availability.tabExceptions")}
          </Button>
        </div>

        {/* === TAB 1: DAILY AGENDA === */}
        {activeTab === "agenda" && (
          <>
            <div className="grid grid-cols-[34px_1fr_34px] items-center gap-2 border-y border-stone py-3 my-4">
              <button
                type="button"
                className="w-8 h-8 flex items-center justify-center border border-stone bg-ivory hover:bg-stone/20 text-charcoal rounded-sm text-sm cursor-pointer transition-colors"
                onClick={handlePrevDay}
                aria-label="Previous day"
              >
                ‹
              </button>
              <div className="text-center">
                <strong className="font-serif text-lg text-charcoal block">{dateHeading}</strong>
                <small className="text-muted-text text-[10px] block mt-0.5">
                  {isOff
                    ? schedule?.shop_closed
                      ? `${t("calendar.closureBannerTitle")}${schedule.reason ? ` · ${schedule.reason}` : ""}`
                      : `${t("team.notScheduled")}${schedule?.reason ? ` · ${schedule.reason}` : ""}`
                    : schedule
                      ? `${schedule.open_time.slice(0, 5)} – ${schedule.close_time.slice(0, 5)}${
                          schedule.source === "staff_exception" && schedule.reason ? ` · ${schedule.reason}` : ""
                        }`
                      : "09:00 – 21:00"}
                </small>
              </div>
              <button
                type="button"
                className="w-8 h-8 flex items-center justify-center border border-stone bg-ivory hover:bg-stone/20 text-charcoal rounded-sm text-sm cursor-pointer transition-colors"
                onClick={handleNextDay}
                aria-label="Next day"
              >
                ›
              </button>
            </div>

            {errorMessage && (
              <div
                className="my-3 p-3 bg-red-50/80 border border-red-200 text-danger text-xs rounded-sm flex items-center gap-2"
                role="alert"
              >
                <Icon name="bell" size={16} />
                <span>{errorMessage}</span>
              </div>
            )}

            {isLoading ? (
              <div className="py-12 px-4 text-center text-muted-text text-xs">
                {t("team.loadingAgenda")}
              </div>
            ) : isOff && activeAppts.length === 0 ? (
              <div className="min-h-[300px] flex flex-col items-center justify-center text-center p-6">
                <div className="w-16 h-16 rounded-full bg-charcoal text-ivory-light flex items-center justify-center font-serif text-2xl font-bold mb-3">
                  {initials}
                </div>
                <h3 className="font-serif text-2xl text-charcoal mb-1">
                  {schedule?.shop_closed
                    ? t("calendar.closureBannerTitle")
                    : schedule?.source === "staff_exception"
                      ? t("availability.badgeLeave")
                      : t("team.dayOff")}
                </h3>
                <p className="text-muted-text text-xs max-w-xs">
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
                    className="mb-3.5 p-3 border border-danger-line bg-danger-soft text-danger text-xs rounded-sm"
                  >
                    <strong>{t("calendar.bookingConflictBadge")}</strong>:{" "}
                    {schedule?.shop_closed
                      ? t("calendar.bookingConflictClosure")
                      : t("calendar.bookingConflictStaff")}
                  </div>
                )}

                <div className="grid grid-cols-3 bg-charcoal text-ivory-light mb-5 rounded-sm divide-x divide-charcoal-muted">
                  <div className="p-3">
                    <small className="block text-[10px] uppercase tracking-wider text-stone-muted">
                      {t("team.bookingsHeader")}
                    </small>
                    <strong className="block font-serif text-xl mt-1 text-ivory-light">{activeAppts.length}</strong>
                  </div>
                  <div className="p-3">
                    <small className="block text-[10px] uppercase tracking-wider text-stone-muted">
                      {t("team.clientTimeHeader")}
                    </small>
                    <strong className="block font-serif text-xl mt-1 text-ivory-light">{clientTimeFormatted}</strong>
                  </div>
                  <div className="p-3">
                    <small className="block text-[10px] uppercase tracking-wider text-stone-muted">
                      {t("team.commissionHeader")}
                    </small>
                    <strong className="block font-serif text-xl mt-1 text-ivory-light">
                      {staff.commission_bps != null ? `${staff.commission_bps / 100}%` : t("team.standardRate")}
                    </strong>
                  </div>
                </div>

                <div className="relative pb-3">
                  {activeAppts.length === 0 ? (
                    <div className="py-9 px-4 text-center text-muted-text text-xs">
                      {t("team.noAppointmentsForStaff", { name: staff.name })}
                    </div>
                  ) : (
                    activeAppts.map((item) => {
                      const startTime = formatTimeOnly(item.starts_at, timezone)
                      const endTime = formatTimeOnly(item.ends_at, timezone)
                      const isCheckedIn = item.status === "checked_in"
                      const isCompleted = item.status === "completed"

                      return (
                        <article className="grid grid-cols-[54px_1fr] gap-2 mb-2.5" key={item.id}>
                          <div className="pt-2 text-xs">
                            <strong className="block text-charcoal">{startTime}</strong>
                            <span className="block text-muted-text text-[10px]">{endTime}</span>
                          </div>
                          <div className={`p-3 bg-ivory-light border border-stone border-l-4 rounded-sm ${isCheckedIn ? "border-l-forest" : "border-l-copper"}`}>
                            <div className="flex justify-between items-center text-xs mb-1">
                              <div className="flex gap-1.5 items-center">
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
                              <span className="text-muted-text text-[10px]">
                                {item.duration_snapshot_min || 30} {t("common.minutes")}
                              </span>
                            </div>
                            <h3 className="font-serif text-base text-charcoal mt-1 mb-0.5">{item.customer_name}</h3>
                            <p className="text-muted-text text-xs">{item.service_name}</p>
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
          <div className="pt-4">
            <h3 className="font-serif text-lg text-charcoal mb-1">{t("availability.weeklyTitle")}</h3>
            <p className="text-xs text-muted-text mb-4">
              {t("availability.weeklySubtitle", { name: staff.name })}
            </p>

            {weeklyError && (
              <div
                className="mb-3.5 p-3 border border-danger-line bg-danger-soft text-danger text-xs rounded-sm"
                role="alert"
              >
                {weeklyError}
              </div>
            )}

            {isLoadingWeekly ? (
              <div className="py-8 text-center text-muted-text text-xs">
                {t("common.loading")}
              </div>
            ) : (
              <div className="space-y-2.5">
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
                    <div
                      key={wd.day}
                      className="grid grid-cols-[auto_1fr_auto_auto_auto] items-center gap-2 p-2.5 bg-ivory-light border border-stone rounded-sm text-xs"
                    >
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          className="sr-only peer"
                          checked={h.is_working}
                          disabled={!canManageSchedule}
                          onChange={(e) => handleToggleWorkDay(wd.day, e.target.checked)}
                        />
                        <div className="w-9 h-5 bg-stone-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-muted after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-copper"></div>
                      </label>
                      <strong className="text-charcoal font-semibold">{dayLabel}</strong>
                      {h.is_working ? (
                        <>
                          <input
                            type="time"
                            disabled={!canManageSchedule}
                            value={formatTimeInput(h.open_time, "09:00")}
                            onChange={(e) => handleWeeklyTimeChange(wd.day, "open_time", e.target.value)}
                            className="border border-stone bg-ivory px-2 py-1 text-xs rounded-sm text-charcoal focus:outline-none focus:border-copper"
                          />
                          <span className="text-muted-text text-[10px]">{language === "id" ? "sampai" : "to"}</span>
                          <input
                            type="time"
                            disabled={!canManageSchedule}
                            value={formatTimeInput(h.close_time, "21:00")}
                            onChange={(e) => handleWeeklyTimeChange(wd.day, "close_time", e.target.value)}
                            className="border border-stone bg-ivory px-2 py-1 text-xs rounded-sm text-charcoal focus:outline-none focus:border-copper"
                          />
                        </>
                      ) : (
                        <em className="col-span-3 text-right text-danger not-italic font-medium">
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
                className="mt-3.5 p-3 border border-danger-line bg-danger-soft text-xs rounded-sm"
              >
                <strong className="text-danger block mb-1">
                  {t("closures.conflictWarningTitle")}
                </strong>
                <p className="text-muted-text mb-2">
                  {t("closures.conflictWarningDesc")}
                </p>
                <ul className="mb-3 pl-4 list-disc space-y-1 text-charcoal">
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
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    disabled={isSavingWeekly}
                    onClick={() => handleSaveWeeklyHours(true)}
                  >
                    {t("closures.confirmAndSave")}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setWeeklyConflicts(null)}
                  >
                    {t("common.cancel")}
                  </Button>
                </div>
              </div>
            )}

            {canManageSchedule && !weeklyConflicts && (
              <Button
                type="button"
                variant="primary"
                className="mt-4 w-full"
                disabled={isSavingWeekly || !isWeeklyDirty}
                isLoading={isSavingWeekly}
                onClick={() => handleSaveWeeklyHours(false)}
              >
                {isSavingWeekly ? t("common.saving") : t("availability.saveWeekly")}
              </Button>
            )}
          </div>
        )}

        {/* === TAB 3: LEAVE & EXCEPTIONS === */}
        {activeTab === "exceptions" && (
          <div className="pt-4">
            <div className="flex justify-between items-start gap-2 mb-3.5">
              <div>
                <h3 className="font-serif text-lg text-charcoal mb-1">{t("availability.exceptionsTitle")}</h3>
                <p className="text-xs text-muted-text">
                  {t("availability.exceptionsSubtitle", { name: staff.name })}
                </p>
              </div>
              {canManageSchedule && !isExceptionFormOpen && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={openCreateException}
                >
                  {t("availability.addException")}
                </Button>
              )}
            </div>

            {exceptionError && (
              <div
                className="mb-3.5 p-3 border border-danger-line bg-danger-soft text-danger text-xs rounded-sm"
                role="alert"
              >
                {exceptionError}
              </div>
            )}

            {isExceptionFormOpen && canManageSchedule && (
              <div className="p-3.5 bg-ivory-light border border-stone rounded-sm mb-4 space-y-3">
                <strong className="block text-xs font-semibold text-charcoal">
                  {editingException ? t("availability.editException") : t("availability.addException")}
                </strong>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <label className="flex flex-col gap-1 font-semibold text-charcoal">
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
                      className="border border-stone bg-ivory px-2 py-1 text-xs rounded-sm text-charcoal focus:outline-none focus:border-copper"
                    />
                  </label>
                  <label className="flex flex-col gap-1 font-semibold text-charcoal">
                    {t("closures.endDate")} *
                    <input
                      type="date"
                      min={excStartDate}
                      value={excEndDate}
                      onChange={(e) => {
                        setExcEndDate(e.target.value)
                        setExcConflicts(null)
                      }}
                      className="border border-stone bg-ivory px-2 py-1 text-xs rounded-sm text-charcoal focus:outline-none focus:border-copper"
                    />
                  </label>

                  <label className="sm:col-span-2 flex flex-col gap-1 font-semibold text-charcoal">
                    {t("closures.modeLabel")}
                    <select
                      value={excIsWorking ? "adjusted" : "leave"}
                      onChange={(e) => {
                        setExcIsWorking(e.target.value === "adjusted")
                        setExcConflicts(null)
                      }}
                      className="border border-stone bg-ivory px-2 py-1 text-xs rounded-sm text-charcoal focus:outline-none focus:border-copper"
                    >
                      <option value="leave">{t("availability.leaveFullDay")}</option>
                      <option value="adjusted">{t("availability.adjustedWorkingHours")}</option>
                    </select>
                  </label>

                  {excIsWorking && (
                    <>
                      <label className="flex flex-col gap-1 font-semibold text-charcoal">
                        {t("closures.openTime")} *
                        <input
                          type="time"
                          value={excOpenTime}
                          onChange={(e) => {
                            setExcOpenTime(e.target.value)
                            setExcConflicts(null)
                          }}
                          className="border border-stone bg-ivory px-2 py-1 text-xs rounded-sm text-charcoal focus:outline-none focus:border-copper"
                        />
                      </label>
                      <label className="flex flex-col gap-1 font-semibold text-charcoal">
                        {t("closures.closeTime")} *
                        <input
                          type="time"
                          value={excCloseTime}
                          onChange={(e) => {
                            setExcCloseTime(e.target.value)
                            setExcConflicts(null)
                          }}
                          className="border border-stone bg-ivory px-2 py-1 text-xs rounded-sm text-charcoal focus:outline-none focus:border-copper"
                        />
                      </label>
                    </>
                  )}

                  <label className="sm:col-span-2 flex flex-col gap-1 font-semibold text-charcoal">
                    {t("closures.reasonLabel")}
                    <input
                      type="text"
                      value={excReason}
                      placeholder={t("availability.reasonPlaceholder")}
                      onChange={(e) => setExcReason(e.target.value)}
                      className="border border-stone bg-ivory px-2 py-1 text-xs rounded-sm text-charcoal focus:outline-none focus:border-copper"
                    />
                  </label>
                </div>

                {excConflicts && (
                  <div
                    role="alert"
                    className="mt-3 p-3 border border-danger-line bg-danger-soft text-xs rounded-sm"
                  >
                    <strong className="text-danger block mb-1">
                      {t("closures.conflictWarningTitle")}
                    </strong>
                    <p className="text-muted-text mb-2">
                      {t("closures.conflictWarningDesc")}
                    </p>
                    <ul className="mb-3 pl-4 list-disc space-y-1 text-charcoal">
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
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="danger"
                        size="sm"
                        disabled={isSavingException}
                        onClick={() => handleSaveException(true)}
                      >
                        {t("closures.confirmAndSave")}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setExcConflicts(null)}
                      >
                        {t("common.cancel")}
                      </Button>
                    </div>
                  </div>
                )}

                {!excConflicts && (
                  <div className="flex gap-2 mt-3">
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      disabled={isSavingException}
                      isLoading={isSavingException}
                      onClick={() => handleSaveException(false)}
                    >
                      {isSavingException ? t("common.saving") : t("common.save")}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isSavingException}
                      onClick={() => {
                        setIsExceptionFormOpen(false)
                        setEditingException(null)
                        setExcConflicts(null)
                      }}
                    >
                      {t("common.cancel")}
                    </Button>
                  </div>
                )}
              </div>
            )}

            {isLoadingExceptions ? (
              <div className="py-6 text-center text-muted-text text-xs">
                {t("common.loading")}
              </div>
            ) : exceptions.length === 0 ? (
              <div className="p-6 border border-dashed border-stone text-center text-muted-text text-xs rounded-sm">
                {t("availability.noExceptions", { name: staff.name })}
              </div>
            ) : (
              <div className="space-y-2">
                {exceptions.map((exc) => {
                  const dateRangeLabel =
                    exc.start_date === exc.end_date
                      ? exc.start_date
                      : `${exc.start_date} – ${exc.end_date}`
                  return (
                    <div
                      key={exc.id}
                      className={`flex items-center justify-between gap-2 p-2.5 bg-ivory-light border border-stone border-l-4 rounded-sm ${
                        exc.is_working ? "border-l-amber" : "border-l-danger"
                      }`}
                    >
                      <div>
                        <strong className="block text-xs font-semibold text-charcoal">
                          {exc.reason || (exc.is_working ? t("availability.adjustedWorkingHours") : t("availability.leaveFullDay"))}
                        </strong>
                        <small className="text-muted-text text-[10px]">{dateRangeLabel}</small>
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
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
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="text-[10px] px-2 py-0.5"
                              onClick={() => openEditException(exc)}
                            >
                              {t("common.edit")}
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="text-[10px] px-2 py-0.5 text-danger hover:border-danger"
                              onClick={() => handleDeleteException(exc.id)}
                            >
                              {t("common.delete")}
                            </Button>
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

        <div className="sticky bottom-[-24px] flex justify-end gap-2 bg-ivory-light border-t border-stone py-3.5 mt-auto">
          <Button variant="outline" size="sm" onClick={onClose}>
            {t("common.close")}
          </Button>
        </div>
      </aside>
    </div>
  )
}
