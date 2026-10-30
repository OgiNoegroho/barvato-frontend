import React, { useState, useEffect, useCallback, useRef } from "react"
import { Badge } from "../../components/ui/Badge"
import { cn } from "../../lib/utils"
import { Button } from "../../components/ui/Button"
import { Icon } from "../../components/ui/Icon"
import { useToast } from "../../hooks/useToast"
import {
  servicesApi,
  shopApi,
  staffApi,
  payrollApi,
  notificationPreferencesApi,
  type NotificationPreferences,
  type UpdateNotificationPreferencesRequest,
  type ServiceItem,
  type ShopDetails,
  type ShopHour,
  type ShopClosure,
  type BookingConflictDetails,
  type StaffItem,
  type ShopPayrollSettings,
  ApiError,
} from "../../lib/api"
import { formatRupiah, getInitials } from "../../lib/format"
import { ServiceModal } from "./ServiceModal"
import { StaffModal } from "../team/StaffModal"
import { useAuth } from "../auth/AuthContext"
import { useI18n, type TranslationKey } from "../../lib/i18n"

interface SettingsContentProps {
  section: string
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

function formatTimeForInput(val?: string | null, fallback = "09:00"): string {
  if (!val) return fallback
  return val.slice(0, 5)
}

function formatTimeForApi(val?: string | null, fallback = "09:00:00"): string {
  if (!val) return fallback
  if (val.length === 5) return `${val}:00`
  return val
}

export function SettingsContent({ section }: SettingsContentProps) {
  const { t, language, setLanguage } = useI18n()

  const headers: Record<string, [string, string]> = {
    "Shop profile": [
      t("settings.sectionProfile"),
      language === "id"
        ? "Informasi yang ditampilkan pada konfirmasi booking dan struk pelanggan."
        : "Information shown on booking confirmations and client receipts.",
    ],
    "Hours & availability": [
      t("settings.businessHoursTitle"),
      t("settings.businessHoursDesc"),
    ],
    "Services & pricing": [
      t("settings.sectionServices"),
      language === "id"
        ? "Kelola durasi, harga, dan ketersediaan layanan online."
        : "Manage duration, pricing, and online availability.",
    ],
    "Staff & permissions": [
      t("settings.sectionStaff"),
      language === "id"
        ? "Undang staf dan kendalikan hak akses tiap peran."
        : "Invite staff and control what each role can access.",
    ],
    "Payroll & Compensation": [
      t("settings.payrollDefaultsTitle"),
      t("settings.payrollDefaultsDesc"),
    ],
    Notifications: [
      t("settings.sectionNotifications"),
      language === "id"
        ? "Pilih kapan pelanggan dan staf menerima pembaruan."
        : "Choose when customers and staff receive updates.",
    ],
    Billing: [
      t("settings.sectionBilling"),
      language === "id"
        ? "Kelola paket langganan, faktur, dan metode pembayaran."
        : "Manage your subscription, invoices, and payment method.",
    ],
  }

  const [title, description] = headers[section] || [section, ""]

  // --- Toast feedback ---
  const toast = useToast()
  const showToast = useCallback((msg: string) => {
    toast.notify(msg)
  }, [toast])

  const { currentShop, updateCurrentShop } = useAuth()
  const canManageSettings = currentShop?.role === "owner"
  const canManageSchedule = currentShop?.role === "owner" || currentShop?.role === "manager"

  // --- Shop Profile State ---
  const [shopDetails, setShopDetails] = useState<ShopDetails | null>(null)
  const [shopName, setShopName] = useState("")
  const [shopTimezone, setShopTimezone] = useState("Asia/Jakarta")
  const [isLoadingShop, setIsLoadingShop] = useState(false)
  const [shopError, setShopError] = useState<string | null>(null)
  const [isSavingShop, setIsSavingShop] = useState(false)
  const [isShopDirty, setIsShopDirty] = useState(false)

  const loadShopDetails = useCallback(async () => {
    setIsLoadingShop(true)
    setShopError(null)
    try {
      const res = await shopApi.get()
      if (res?.shop) {
        setShopDetails(res.shop)
        setShopName(res.shop.name || "")
        setShopTimezone(res.shop.timezone || "Asia/Jakarta")
        setIsShopDirty(false)
      } else {
        setShopError("No shop information found for this account.")
      }
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setShopError(err.message || "Failed to load shop details.")
      } else {
        setShopError("Network error while loading shop details.")
      }
    } finally {
      setIsLoadingShop(false)
    }
  }, [])

  useEffect(() => {
    if (section === "Shop profile") {
      loadShopDetails()
    }
  }, [section, loadShopDetails])

  // --- Notification Preferences State & Auto-Save Queue ---
  const [notifPrefs, setNotifPrefs] = useState<NotificationPreferences | null>(null)
  const [isLoadingPrefs, setIsLoadingPrefs] = useState(false)
  const [prefsError, setPrefsError] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle")
  const [saveError, setSaveError] = useState<string | null>(null)

  // Refs for tracking queue state and preventing race conditions
  const notifPrefsRef = useRef<NotificationPreferences | null>(null)
  const confirmedPrefsRef = useRef<NotificationPreferences | null>(null)
  const failedAttemptRef = useRef<NotificationPreferences | null>(null)
  const inFlightRef = useRef<boolean>(false)
  const hasPendingRef = useRef<boolean>(false)
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Clear pending timer on unmount
  useEffect(() => {
    return () => {
      if (savedTimerRef.current) {
        clearTimeout(savedTimerRef.current)
      }
    }
  }, [])

  const loadNotifPrefs = useCallback(async () => {
    setIsLoadingPrefs(true)
    setPrefsError(null)
    setSaveStatus("idle")
    setSaveError(null)
    try {
      const res = await notificationPreferencesApi.get()
      if (res?.preferences) {
        setNotifPrefs(res.preferences)
        notifPrefsRef.current = res.preferences
        confirmedPrefsRef.current = res.preferences
        failedAttemptRef.current = null
      }
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setPrefsError(err.message || "Failed to load notification preferences.")
      } else {
        setPrefsError("Network error while loading notification preferences.")
      }
    } finally {
      setIsLoadingPrefs(false)
    }
  }, [])

  useEffect(() => {
    if (section === "Notifications") {
      void loadNotifPrefs()
    }
  }, [section, loadNotifPrefs])

  const processSaveQueue = useCallback(async () => {
    if (inFlightRef.current) {
      hasPendingRef.current = true
      return
    }

    inFlightRef.current = true
    setSaveStatus("saving")
    setSaveError(null)

    while (hasPendingRef.current || inFlightRef.current) {
      hasPendingRef.current = false

      const targetToSave = notifPrefsRef.current
      if (!targetToSave) {
        inFlightRef.current = false
        break
      }

      const payload: UpdateNotificationPreferencesRequest = {
        upcoming_reminder_30m_enabled: targetToSave.upcoming_reminder_30m_enabled,
        upcoming_reminder_15m_enabled: targetToSave.upcoming_reminder_15m_enabled,
        overdue_reminder_enabled: targetToSave.overdue_reminder_enabled,
        overdue_interval_minutes: targetToSave.overdue_interval_minutes,
        max_overdue_reminders: targetToSave.max_overdue_reminders,
        excessive_wait_threshold_minutes: targetToSave.excessive_wait_threshold_minutes,
        queue_alerts_enabled: targetToSave.queue_alerts_enabled,
        barber_shift_alerts_enabled: targetToSave.barber_shift_alerts_enabled,
        financial_alerts_enabled: targetToSave.financial_alerts_enabled,
      }

      try {
        const res = await notificationPreferencesApi.update(payload)
        if (res?.preferences) {
          confirmedPrefsRef.current = res.preferences
          // If no further edits arrived while saving, sync UI with returned canonical state
          if (!hasPendingRef.current) {
            notifPrefsRef.current = res.preferences
            setNotifPrefs(res.preferences)
          }
        }
        failedAttemptRef.current = null
      } catch (err: unknown) {
        // Rollback on failure to the last confirmed server state
        const revertTarget = confirmedPrefsRef.current
        failedAttemptRef.current = targetToSave
        if (revertTarget) {
          notifPrefsRef.current = revertTarget
          setNotifPrefs(revertTarget)
        }
        hasPendingRef.current = false
        inFlightRef.current = false
        setSaveStatus("error")
        const msg =
          err instanceof Error
            ? err.message
            : language === "id"
              ? "Gagal menyimpan pengaturan notifikasi"
              : "Failed to save notification settings"
        setSaveError(msg)
        return
      }

      if (!hasPendingRef.current) {
        inFlightRef.current = false
        break
      }
    }

    inFlightRef.current = false
    setSaveStatus("saved")
    if (savedTimerRef.current) {
      clearTimeout(savedTimerRef.current)
    }
    savedTimerRef.current = setTimeout(() => {
      setSaveStatus("idle")
    }, 2500)
  }, [language])

  const handleRetrySave = useCallback(() => {
    if (!failedAttemptRef.current || !canManageSettings) return
    const retryTarget = failedAttemptRef.current
    notifPrefsRef.current = retryTarget
    setNotifPrefs(retryTarget)
    setSaveError(null)
    void processSaveQueue()
  }, [canManageSettings, processSaveQueue])

  const updatePreference = <K extends keyof UpdateNotificationPreferencesRequest>(
    key: K,
    val: UpdateNotificationPreferencesRequest[K]
  ) => {
    if (!notifPrefsRef.current || !canManageSettings) return
    if (savedTimerRef.current) {
      clearTimeout(savedTimerRef.current)
    }
    const updated: NotificationPreferences = { ...notifPrefsRef.current, [key]: val }
    notifPrefsRef.current = updated
    setNotifPrefs(updated)
    setSaveError(null)
    void processSaveQueue()
  }

  const handleSaveShop = async () => {
    if (!canManageSettings || !shopName.trim()) return
    setIsSavingShop(true)
    try {
      const res = await shopApi.update({
        name: shopName.trim(),
        timezone: shopTimezone,
      })
      if (res?.shop) {
        setShopDetails(res.shop)
        setShopName(res.shop.name)
        setShopTimezone(res.shop.timezone)
        setIsShopDirty(false)
        updateCurrentShop({
          name: res.shop.name,
          timezone: res.shop.timezone,
        })
        showToast("Shop profile updated successfully")
      }
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setShopError(err.message || "Failed to update shop details.")
      } else {
        setShopError("Network error while updating shop details.")
      }
    } finally {
      setIsSavingShop(false)
    }
  }

  // --- Payroll Settings State ---
  const [payrollSettings, setPayrollSettings] = useState<ShopPayrollSettings>({
    shop_id: 0,
    default_model: "commission",
    default_commission_type: "percentage",
    default_commission_rate_bps: 5000,
    default_fixed_commission_amount: 0,
    default_monthly_salary: 0,
    default_tips_policy: "direct",
    updated_at: "",
  })
  const [isSavingPayroll, setIsSavingPayroll] = useState(false)
  const [isPayrollDirty, setIsPayrollDirty] = useState(false)

  const loadPayrollSettings = useCallback(async () => {
    try {
      const res = await payrollApi.getSettings()
      if (res?.settings) {
        setPayrollSettings(res.settings)
        setIsPayrollDirty(false)
      }
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Failed to load payroll settings")
    }
  }, [showToast])

  useEffect(() => {
    if (section === "Payroll & Compensation") {
      loadPayrollSettings()
    }
  }, [section, loadPayrollSettings])

  const handleSavePayrollSettings = async () => {
    setIsSavingPayroll(true)
    try {
      const res = await payrollApi.updateSettings(payrollSettings)
      if (res?.settings) {
        setPayrollSettings(res.settings)
        setIsPayrollDirty(false)
        showToast("Payroll & compensation defaults saved")
      }
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Failed to save payroll settings")
    } finally {
      setIsSavingPayroll(false)
    }
  }

  // --- Services State ---
  const [services, setServices] = useState<ServiceItem[]>([])
  const [isLoadingServices, setIsLoadingServices] = useState(false)
  const [servicesError, setServicesError] = useState<string | null>(null)
  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false)
  const [editingService, setEditingService] = useState<ServiceItem | null>(null)

  const loadServices = useCallback(async () => {
    setIsLoadingServices(true)
    setServicesError(null)
    try {
      const res = await servicesApi.list(false)
      setServices(res.services || [])
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setServicesError(err.message || `Failed to load services (${err.code})`)
      } else if (err instanceof Error) {
        setServicesError(err.message)
      } else {
        setServicesError("Failed to load services. Please check your network connection.")
      }
    } finally {
      setIsLoadingServices(false)
    }
  }, [])

  useEffect(() => {
    if (section === "Services & pricing") {
      loadServices()
    }
  }, [section, loadServices])

  // --- Staff & Permissions State ---
  const [staffList, setStaffList] = useState<StaffItem[]>([])
  const [isLoadingStaff, setIsLoadingStaff] = useState(false)
  const [staffError, setStaffError] = useState<string | null>(null)
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false)
  const [staffToEdit, setStaffToEdit] = useState<StaffItem | null>(null)

  const loadStaff = useCallback(async () => {
    setIsLoadingStaff(true)
    setStaffError(null)
    try {
      const res = await staffApi.list(false)
      setStaffList(res.staff || [])
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setStaffError(err.message || `Failed to load staff (${err.code})`)
      } else if (err instanceof Error) {
        setStaffError(err.message)
      } else {
        setStaffError("Failed to load staff members.")
      }
    } finally {
      setIsLoadingStaff(false)
    }
  }, [])

  useEffect(() => {
    if (section === "Staff & permissions") {
      loadStaff()
    }
  }, [section, loadStaff])

  // --- Business Hours & Shop Closures State ---
  const [hoursMap, setHoursMap] = useState<Record<number, ShopHour>>({})
  const [isLoadingHours, setIsLoadingHours] = useState(false)
  const [hoursError, setHoursError] = useState<string | null>(null)
  const [isHoursDirty, setIsHoursDirty] = useState(false)
  const [isSavingHours, setIsSavingHours] = useState(false)

  const [closures, setClosures] = useState<ShopClosure[]>([])
  const [isLoadingClosures, setIsLoadingClosures] = useState(false)
  const [closureError, setClosureError] = useState<string | null>(null)
  const [isClosureFormOpen, setIsClosureFormOpen] = useState(false)
  const [editingClosure, setEditingClosure] = useState<ShopClosure | null>(null)
  const [closureStartDate, setClosureStartDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [closureEndDate, setClosureEndDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [closureIsClosed, setClosureIsClosed] = useState(true)
  const [closureOpenTime, setClosureOpenTime] = useState("10:00")
  const [closureCloseTime, setClosureCloseTime] = useState("18:00")
  const [closureReason, setClosureReason] = useState("")
  const [isSavingClosure, setIsSavingClosure] = useState(false)
  const [closureConflicts, setClosureConflicts] = useState<BookingConflictDetails | null>(null)

  const loadClosures = useCallback(async () => {
    setIsLoadingClosures(true)
    try {
      const res = await shopApi.listClosures()
      setClosures(res.closures || [])
    } catch (err: unknown) {
      if (err instanceof Error) {
        setClosureError(err.message)
      }
    } finally {
      setIsLoadingClosures(false)
    }
  }, [])

  const openCreateClosure = () => {
    const todayStr = new Date().toISOString().slice(0, 10)
    setEditingClosure(null)
    setClosureStartDate(todayStr)
    setClosureEndDate(todayStr)
    setClosureIsClosed(true)
    setClosureOpenTime("10:00")
    setClosureCloseTime("18:00")
    setClosureReason("")
    setClosureError(null)
    setClosureConflicts(null)
    setIsClosureFormOpen(true)
  }

  const openEditClosure = (c: ShopClosure) => {
    setEditingClosure(c)
    setClosureStartDate(c.start_date)
    setClosureEndDate(c.end_date)
    setClosureIsClosed(c.is_closed)
    setClosureOpenTime(formatTimeForInput(c.open_time, "10:00"))
    setClosureCloseTime(formatTimeForInput(c.close_time, "18:00"))
    setClosureReason(c.reason || "")
    setClosureError(null)
    setClosureConflicts(null)
    setIsClosureFormOpen(true)
  }

  const handleSaveClosure = async (confirmConflicts = false) => {
    if (!canManageSchedule || isSavingClosure) return
    setClosureError(null)

    if (!closureStartDate || !closureEndDate) {
      setClosureError(language === "id" ? "Tanggal mulai dan selesai wajib diisi." : "Start and end dates are required.")
      return
    }
    if (closureEndDate < closureStartDate) {
      setClosureError(
        language === "id"
          ? "Tanggal selesai harus sama atau setelah tanggal mulai."
          : "End date must be on or after start date."
      )
      return
    }
    if (!closureIsClosed && closureOpenTime >= closureCloseTime) {
      setClosureError(
        language === "id"
          ? "Jam tutup harus setelah jam buka."
          : "Closing time must be after opening time."
      )
      return
    }

    setIsSavingClosure(true)
    try {
      const payload = {
        start_date: closureStartDate,
        end_date: closureEndDate,
        is_closed: closureIsClosed,
        open_time: closureIsClosed ? null : formatTimeForApi(closureOpenTime, "10:00:00"),
        close_time: closureIsClosed ? null : formatTimeForApi(closureCloseTime, "18:00:00"),
        reason: closureReason.trim(),
        confirm_conflicts: confirmConflicts,
      }
      if (editingClosure) {
        await shopApi.updateClosure(editingClosure.id, payload)
      } else {
        await shopApi.createClosure(payload)
      }
      setIsClosureFormOpen(false)
      setEditingClosure(null)
      setClosureConflicts(null)
      showToast(t("closures.savedToast"))
      await loadClosures()
    } catch (err: unknown) {
      if (err instanceof ApiError && err.code === "existing_bookings_conflict" && err.details) {
        setClosureConflicts(err.details as BookingConflictDetails)
      } else if (err instanceof Error) {
        setClosureError(err.message)
      } else {
        setClosureError(language === "id" ? "Gagal menyimpan jadwal penutupan." : "Failed to save shop closure.")
      }
    } finally {
      setIsSavingClosure(false)
    }
  }

  const handleDeleteClosure = async (id: number) => {
    if (!canManageSchedule) return
    try {
      await shopApi.deleteClosure(id)
      showToast(t("closures.deletedToast"))
      await loadClosures()
    } catch (err: unknown) {
      if (err instanceof Error) {
        setClosureError(err.message)
      }
    }
  }

  const loadHours = useCallback(async () => {
    setIsLoadingHours(true)
    setHoursError(null)
    try {
      const res = await shopApi.getHours()
      const map: Record<number, ShopHour> = {}
      for (const h of res.hours || []) {
        map[h.day_of_week] = h
      }
      // Ensure all 7 days exist with default fallback if missing
      for (let d = 0; d <= 6; d++) {
        if (!map[d]) {
          map[d] = {
            day_of_week: d,
            is_open: d !== 0, // default Sunday closed
            open_time: "09:00:00",
            close_time: "21:00:00",
          }
        }
      }
      setHoursMap(map)
      setIsHoursDirty(false)
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setHoursError(err.message || `Failed to load shop hours (${err.code})`)
      } else if (err instanceof Error) {
        setHoursError(err.message)
      } else {
        setHoursError("Failed to load shop hours. Please check your network connection.")
      }
    } finally {
      setIsLoadingHours(false)
    }
  }, [])

  useEffect(() => {
    if (section === "Hours & availability") {
      loadHours()
      loadClosures()
    }
  }, [section, loadHours, loadClosures])

  const handleToggleDay = (day: number, checked: boolean) => {
    setHoursMap((prev) => {
      const current = prev[day] || {
        day_of_week: day,
        is_open: false,
        open_time: "09:00:00",
        close_time: "21:00:00",
      }
      return {
        ...prev,
        [day]: { ...current, is_open: checked },
      }
    })
    setIsHoursDirty(true)
  }

  const handleTimeChange = (day: number, field: "open_time" | "close_time", timeStr: string) => {
    setHoursMap((prev) => {
      const current = prev[day] || {
        day_of_week: day,
        is_open: true,
        open_time: "09:00:00",
        close_time: "21:00:00",
      }
      return {
        ...prev,
        [day]: { ...current, [field]: formatTimeForApi(timeStr) },
      }
    })
    setIsHoursDirty(true)
  }

  const handleSaveHours = async () => {
    if (isSavingHours) return

    setHoursError(null)

    // Validate that open_time < close_time for open days
    for (const wd of WEEKDAYS) {
      const h = hoursMap[wd.day]
      if (h && h.is_open) {
        const openVal = formatTimeForInput(h.open_time)
        const closeVal = formatTimeForInput(h.close_time)
        if (openVal >= closeVal) {
          const dayName = language === "id" ? wd.labelId : wd.labelEn
          setHoursError(
            language === "id"
              ? `Jam tutup harus setelah jam buka untuk hari ${dayName} (${openVal} - ${closeVal}).`
              : `Closing time must be after opening time for ${dayName} (${openVal} - ${closeVal}).`
          )
          return
        }
      }
    }

    setIsSavingHours(true)

    // Construct array of all 7 days
    const payload: ShopHour[] = []
    for (let d = 0; d <= 6; d++) {
      const h = hoursMap[d] || {
        day_of_week: d,
        is_open: false,
        open_time: "09:00:00",
        close_time: "21:00:00",
      }
      payload.push({
        day_of_week: d,
        is_open: h.is_open,
        open_time: formatTimeForApi(h.open_time, "09:00:00"),
        close_time: formatTimeForApi(h.close_time, "21:00:00"),
      })
    }

    try {
      const res = await shopApi.updateHours(payload)
      const map: Record<number, ShopHour> = {}
      for (const h of res.hours || []) {
        map[h.day_of_week] = h
      }
      setHoursMap(map)
      setIsHoursDirty(false)
      showToast("Operating hours updated successfully")
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setHoursError(err.message || `Failed to update hours (${err.code})`)
      } else if (err instanceof Error) {
        setHoursError(err.message)
      } else {
        setHoursError("Failed to save operating hours.")
      }
    } finally {
      setIsSavingHours(false)
    }
  }

  return (
    <section className="settings-form max-w-3xl space-y-6">
      <span className="section-index text-[10px] uppercase tracking-wider text-charcoal-muted font-bold block mb-0.5">{section.toUpperCase()}</span>
      <h2 className="font-serif text-2xl text-charcoal-ink mt-1 mb-1">{title}</h2>
      <p className="text-charcoal-muted text-xs mb-6">{description}</p>

      {/* --- Shop Profile (Activated) --- */}
      {section === "Shop profile" && (
        <div>
          {/* --- Language Selector --- */}
          <div className="flex items-center justify-between p-4 bg-ivory-light border border-stone mb-5 flex-wrap gap-3 rounded-lg">
            <div>
              <span className="text-2xs uppercase tracking-wider text-muted-text block mb-0.5">
                {t("settings.languageTitle")}
              </span>
              <strong className="text-sm font-semibold text-charcoal block">
                {t("settings.languageSubtitle")}
              </strong>
            </div>
            <div>
              <select
                aria-label={t("settings.languageTitle")}
                value={language}
                onChange={(e) => setLanguage(e.target.value as "id" | "en")}
                className="h-9 px-3 bg-ivory border border-stone rounded text-xs font-semibold text-charcoal focus:border-copper cursor-pointer outline-none"
              >
                <option value="id">Bahasa Indonesia</option>
                <option value="en">English</option>
              </select>
            </div>
          </div>

          {shopError && (
            <div
              className="login-error-alert mb-4 flex items-center justify-between p-3 border border-danger/30 bg-danger-soft text-danger text-xs rounded-sm"
              role="alert"
            >
              <div className="flex items-center gap-2">
                <Icon name="bell" size={16} />
                <span>{shopError}</span>
              </div>
              <button
                type="button"
                className="text-xs underline text-inherit cursor-pointer bg-transparent border-0 p-0 font-medium"
                onClick={loadShopDetails}
              >
                Retry
              </button>
            </div>
          )}

          {isLoadingShop ? (
            <div className="py-9 text-center text-muted-text text-xs">
              Loading shop profile from server...
            </div>
          ) : !shopDetails ? (
            <div className="py-8 text-center text-muted-text text-xs">
              No shop profile available.
            </div>
          ) : (
            <div>
              {!canManageSettings && (
                <div className="mb-5 p-3.5 bg-ivory-warm/60 border border-stone text-xs text-muted-text flex items-center gap-2 rounded-sm">
                  <Icon name="bell" size={14} />
                  <span>
                    Shop profile details can only be modified by the shop owner. You are signed in as a{" "}
                    <strong className="capitalize text-charcoal font-semibold">{currentShop?.role || "staff member"}</strong> (read-only mode).
                  </span>
                </div>
              )}

              <div className="flex items-center gap-3 p-4 bg-ivory-light border border-stone mb-5 rounded-lg">
                <div>
                  <span className="text-2xs uppercase tracking-wider text-muted-text block">
                    Tenant Identity
                  </span>
                  <strong className="text-sm font-semibold text-charcoal">
                    Shop #{shopDetails.id}
                  </strong>
                </div>
                <div className="ml-auto flex items-center gap-2">
                  <Badge tone={shopDetails.status === "active" ? "success" : "neutral"}>
                    {shopDetails.status.toUpperCase()}
                  </Badge>
                  {shopDetails.created_at && (
                    <span className="text-2xs text-muted-text">
                      Established {new Date(shopDetails.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </span>
                  )}
                </div>
              </div>

              <div className="bg-ivory-light border border-stone rounded-lg p-5 sm:p-6 mb-6 shadow-subtle">
                <h3 className="font-serif text-lg text-charcoal mb-1">
                  {language === "id" ? "Detail Profil Barbershop" : "Barbershop Details"}
                </h3>
                <p className="text-xs text-muted-text mb-4">
                  {language === "id"
                    ? "Konfigurasi utama toko dan lokalisasi zona waktu operasional."
                    : "Core shop configuration and operational timezone localization."}
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="col-span-full">
                    <label className="block text-xs font-semibold text-charcoal mb-1.5">
                      Barbershop Business Name *
                    </label>
                    <input
                      type="text"
                      value={shopName}
                      disabled={!canManageSettings || isSavingShop}
                      onChange={(e) => {
                        setShopName(e.target.value)
                        setIsShopDirty(true)
                      }}
                      placeholder="e.g. Batavia Barbershop"
                      required
                      className="w-full h-9 px-3 bg-ivory border border-stone rounded-sm text-xs font-sans text-charcoal focus:border-copper focus:ring-1 focus:ring-copper outline-none transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-charcoal mb-1.5">
                      Operating Timezone *
                    </label>
                    <select
                      value={shopTimezone}
                      disabled={!canManageSettings || isSavingShop}
                      onChange={(e) => {
                        setShopTimezone(e.target.value)
                        setIsShopDirty(true)
                      }}
                      className="w-full h-9 px-3 bg-ivory border border-stone rounded-sm text-xs font-sans text-charcoal focus:border-copper focus:ring-1 focus:ring-copper outline-none transition-all disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <option value="Asia/Jakarta">Asia/Jakarta (WIB · UTC+7 — Java, Sumatra)</option>
                      <option value="Asia/Makassar">Asia/Makassar (WITA · UTC+8 — Bali, Sulawesi)</option>
                      <option value="Asia/Jayapura">Asia/Jayapura (WIT · UTC+9 — Maluku, Papua)</option>
                      <option value="Asia/Singapore">Asia/Singapore (SGT · UTC+8)</option>
                      <option value="UTC">UTC (Coordinated Universal Time)</option>
                      <option value="America/New_York">America/New_York (Eastern Time)</option>
                      <option value="America/Chicago">America/Chicago (Central Time)</option>
                      <option value="America/Denver">America/Denver (Mountain Time)</option>
                      <option value="America/Los_Angeles">America/Los_Angeles (Pacific Time)</option>
                      <option value="Europe/London">Europe/London (GMT/BST)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-charcoal mb-1.5">
                      Subscription Status
                    </label>
                    <input
                      type="text"
                      value={shopDetails.status.toUpperCase()}
                      disabled
                      readOnly
                      className="w-full h-9 px-3 bg-stone/20 border border-stone rounded-sm text-xs font-sans text-muted-text cursor-not-allowed outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* --- Hours & Availability (Integrated) --- */}
      {section === "Hours & availability" && (
        <div>
          {hoursError && (
            <div
              className="login-error-alert mb-4 flex items-center gap-2 p-3 border border-danger/30 bg-danger-soft text-danger text-xs rounded-sm"
              role="alert"
            >
              <Icon name="bell" size={16} />
              <span>{hoursError}</span>
            </div>
          )}

          {isLoadingHours ? (
            <div className="py-8 text-center text-muted-text text-xs">
              {language === "id" ? "Memuat jam operasional dari server..." : "Loading operating hours from server..."}
            </div>
          ) : (
            <div className="bg-ivory-light border border-stone rounded-lg p-5 sm:p-6 mb-6 shadow-subtle">
              <h3 className="font-serif text-lg text-charcoal mb-1">
                {t("settings.businessHoursTitle")}
              </h3>
              <p className="text-xs text-muted-text mb-4">
                {t("settings.businessHoursDesc")}
              </p>

              <div className="divide-y divide-stone border-y border-stone mb-5">
                {WEEKDAYS.map((wd) => {
                  const hour = hoursMap[wd.day] || {
                    day_of_week: wd.day,
                    is_open: wd.day !== 0,
                    open_time: "09:00:00",
                    close_time: "21:00:00",
                  }
                  const dayLabel = language === "id" ? wd.labelId : wd.labelEn
                  const isOpen = hour.is_open

                  return (
                    <div
                      key={wd.day}
                      className="flex items-center justify-between gap-3 py-3 px-1 min-h-[52px] text-xs"
                    >
                      {/* LEFT: Switch & Day name */}
                      <div className="flex items-center gap-3 w-32 sm:w-44 shrink-0">
                        <label className="switch shrink-0" aria-label={`Toggle ${dayLabel}`}>
                          <input
                            type="checkbox"
                            id={`day-toggle-${wd.day}`}
                            checked={isOpen}
                            disabled={!canManageSchedule}
                            onChange={(e) => handleToggleDay(wd.day, e.target.checked)}
                          />
                          <i />
                        </label>
                        <label
                          htmlFor={`day-toggle-${wd.day}`}
                          className="text-xs font-semibold text-charcoal cursor-pointer select-none"
                        >
                          {dayLabel}
                        </label>
                      </div>

                      {/* RIGHT: Opening & Closing times aligned vertically */}
                      <div className="flex items-center gap-2 sm:gap-3 ml-auto shrink-0">
                        <input
                          type="time"
                          aria-label={`${dayLabel} ${language === "id" ? "Jam buka" : "Opening time"}`}
                          disabled={!canManageSchedule || !isOpen}
                          value={formatTimeForInput(hour.open_time, "09:00")}
                          onChange={(e) => handleTimeChange(wd.day, "open_time", e.target.value)}
                          className="w-[95px] sm:w-[120px] h-8.5 px-2 bg-ivory border border-stone rounded-sm text-xs font-mono text-charcoal focus:border-copper focus:ring-1 focus:ring-copper outline-none transition-all disabled:opacity-40 disabled:bg-stone/20 disabled:cursor-not-allowed text-center"
                        />
                        <span className="text-2xs uppercase tracking-wider text-muted-text w-8 sm:w-10 text-center shrink-0">
                          {language === "id" ? "sampai" : "to"}
                        </span>
                        <input
                          type="time"
                          aria-label={`${dayLabel} ${language === "id" ? "Jam tutup" : "Closing time"}`}
                          disabled={!canManageSchedule || !isOpen}
                          value={formatTimeForInput(hour.close_time, "21:00")}
                          onChange={(e) => handleTimeChange(wd.day, "close_time", e.target.value)}
                          className="w-[95px] sm:w-[120px] h-8.5 px-2 bg-ivory border border-stone rounded-sm text-xs font-mono text-charcoal focus:border-copper focus:ring-1 focus:ring-copper outline-none transition-all disabled:opacity-40 disabled:bg-stone/20 disabled:cursor-not-allowed text-center"
                        />
                      </div>
                    </div>
                  )
                })}
              </div>

              {canManageSchedule && (
                <div className="pt-1">
                  <Button
                    type="button"
                    variant="primary"
                    onClick={handleSaveHours}
                    disabled={isSavingHours || !isHoursDirty}
                    isLoading={isSavingHours}
                  >
                    {isSavingHours
                      ? language === "id"
                        ? "Menyimpan jam operasional..."
                        : "Saving hours..."
                      : isHoursDirty
                        ? language === "id"
                          ? "Simpan perubahan *"
                          : "Save changes *"
                        : language === "id"
                          ? "Jam operasional tersimpan"
                          : "Hours saved"}
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* --- Shop Closures & Special Operating Hours --- */}
          <div className="mt-9 pt-7 border-t border-stone">
            <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
              <div>
                <h3 className="m-0 mb-1 text-sm font-semibold text-charcoal">
                  {t("closures.title")}
                </h3>
                <p className="m-0 text-xs text-muted-text">
                  {t("closures.subtitle")}
                </p>
              </div>
              {canManageSchedule && !isClosureFormOpen && (
                <button
                  type="button"
                  className="filter-button font-semibold"
                  onClick={openCreateClosure}
                >
                  {t("closures.addButton")}
                </button>
              )}
            </div>

            {closureError && (
              <div
                className="login-error-alert mb-3.5 p-3 border border-danger/30 bg-danger-soft text-danger text-xs flex items-center gap-2 rounded-sm"
                role="alert"
              >
                <Icon name="bell" size={14} />
                <span>{closureError}</span>
              </div>
            )}

            {isClosureFormOpen && canManageSchedule && (
              <div className="p-4 bg-ivory-light border border-stone mb-4.5 rounded-lg">
                <strong className="block text-xs font-semibold mb-3 text-charcoal">
                  {editingClosure ? t("closures.editTitle") : t("closures.createTitle")}
                </strong>

                <div className="form-grid grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
                  <label>
                    {t("closures.startDate")} *
                    <input
                      type="date"
                      value={closureStartDate}
                      onChange={(e) => {
                        const v = e.target.value
                        setClosureStartDate(v)
                        if (closureEndDate < v) setClosureEndDate(v)
                        setClosureConflicts(null)
                      }}
                    />
                  </label>
                  <label>
                    {t("closures.endDate")} *
                    <input
                      type="date"
                      min={closureStartDate}
                      value={closureEndDate}
                      onChange={(e) => {
                        setClosureEndDate(e.target.value)
                        setClosureConflicts(null)
                      }}
                    />
                  </label>

                  <label className="full">
                    {t("closures.modeLabel")}
                    <select
                      value={closureIsClosed ? "closed" : "adjusted"}
                      onChange={(e) => {
                        setClosureIsClosed(e.target.value === "closed")
                        setClosureConflicts(null)
                      }}
                    >
                      <option value="closed">{t("closures.fullDayClosed")}</option>
                      <option value="adjusted">{t("closures.adjustedHours")}</option>
                    </select>
                  </label>

                  {!closureIsClosed && (
                    <>
                      <label>
                        {t("closures.openTime")} *
                        <input
                          type="time"
                          value={closureOpenTime}
                          onChange={(e) => {
                            setClosureOpenTime(e.target.value)
                            setClosureConflicts(null)
                          }}
                        />
                      </label>
                      <label>
                        {t("closures.closeTime")} *
                        <input
                          type="time"
                          value={closureCloseTime}
                          onChange={(e) => {
                            setClosureCloseTime(e.target.value)
                            setClosureConflicts(null)
                          }}
                        />
                      </label>
                    </>
                  )}

                  <label className="full">
                    {t("closures.reasonLabel")}
                    <input
                      type="text"
                      value={closureReason}
                      placeholder={t("closures.reasonPlaceholder")}
                      onChange={(e) => setClosureReason(e.target.value)}
                    />
                  </label>
                </div>

                {closureConflicts && (
                  <div
                    role="alert"
                    className="mt-3.5 p-3.5 border border-danger/40 bg-danger-soft text-charcoal text-xs rounded-sm"
                  >
                    <strong className="text-danger block mb-1 font-semibold">
                      {t("closures.conflictWarningTitle")}
                    </strong>
                    <p className="m-0 mb-2 text-muted-text">
                      {t("closures.conflictWarningDesc")}
                    </p>
                    <ul className="m-0 mb-2.5 pl-4.5 list-disc text-xs space-y-1">
                      {(closureConflicts.affected_appointments || []).map((a) => (
                        <li key={`appt-${a.id}`}>
                          <strong>{a.customer_name}</strong> — {a.service_name} ({a.staff_name},{" "}
                          {new Date(a.starts_at).toLocaleString(language === "id" ? "id-ID" : "en-US", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })})
                        </li>
                      ))}
                      {(closureConflicts.affected_walk_ins || []).map((w) => (
                        <li key={`walkin-${w.id}`}>
                          <strong>{w.customer_name}</strong> — {w.service_name} ({w.assigned_staff_name || t("booking.anyBarber")})
                        </li>
                      ))}
                    </ul>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="primary-button bg-danger border-danger hover:bg-danger/90"
                        disabled={isSavingClosure}
                        onClick={() => handleSaveClosure(true)}
                      >
                        {t("closures.confirmAndSave")}
                      </button>
                      <button
                        type="button"
                        className="filter-button"
                        onClick={() => setClosureConflicts(null)}
                      >
                        {t("common.cancel")}
                      </button>
                    </div>
                  </div>
                )}

                {!closureConflicts && (
                  <div className="flex gap-2 mt-3.5">
                    <button
                      type="button"
                      className="primary-button"
                      disabled={isSavingClosure}
                      onClick={() => handleSaveClosure(false)}
                    >
                      {isSavingClosure ? t("common.saving") : t("common.save")}
                    </button>
                    <button
                      type="button"
                      className="filter-button"
                      disabled={isSavingClosure}
                      onClick={() => {
                        setIsClosureFormOpen(false)
                        setEditingClosure(null)
                        setClosureConflicts(null)
                      }}
                    >
                      {t("common.cancel")}
                    </button>
                  </div>
                )}
              </div>
            )}

            {isLoadingClosures ? (
              <div className="py-4.5 text-xs text-muted-text">
                {t("common.loading")}
              </div>
            ) : closures.length === 0 ? (
              <div className="p-5 border border-dashed border-stone text-center text-muted-text text-xs rounded-sm">
                {t("closures.empty")}
              </div>
            ) : (
              <div className="service-settings border-t border-charcoal divide-y divide-stone mb-6">
                {closures.map((c) => {
                  const dateLabel =
                    c.start_date === c.end_date
                      ? c.start_date
                      : `${c.start_date} – ${c.end_date}`
                  return (
                    <div
                      key={c.id}
                      className={cn(
                        "flex items-center justify-between py-3.5 pl-2.5 gap-3 border-l-3",
                        c.is_closed ? "border-danger" : "border-amber"
                      )}
                    >
                      <span className="grow min-w-0">
                        <strong className="block text-xs font-semibold text-charcoal">{c.reason || (c.is_closed ? t("closures.badgeClosed") : t("closures.title"))}</strong>
                        <small className="block text-2xs text-muted-text">{dateLabel}</small>
                      </span>
                      <Badge tone={c.is_closed ? "danger" : "warning"}>
                        {c.is_closed
                          ? t("closures.badgeClosed")
                          : t("closures.badgeAdjusted", {
                              open: formatTimeForInput(c.open_time, "09:00"),
                              close: formatTimeForInput(c.close_time, "21:00"),
                            })}
                      </Badge>
                      {canManageSchedule && (
                        <div className="flex gap-1.5 shrink-0">
                          <button
                            type="button"
                            className="filter-button"
                            onClick={() => openEditClosure(c)}
                          >
                            {t("common.edit")}
                          </button>
                          <button
                            type="button"
                            className="filter-button text-danger hover:border-danger"
                            onClick={() => handleDeleteClosure(c.id)}
                          >
                            {t("common.delete")}
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- Services & Pricing (Integrated) --- */}
      {section === "Services & pricing" && (
        <div className="service-settings border-t border-charcoal divide-y divide-stone mb-6">
          {servicesError && (
            <div
              className="login-error-alert mb-4 flex items-center justify-between p-3 border border-danger/30 bg-danger-soft text-danger text-xs rounded-sm"
              role="alert"
            >
              <div className="flex items-center gap-2">
                <Icon name="bell" size={16} />
                <span>{servicesError}</span>
              </div>
              <button
                type="button"
                className="filter-button text-xs ml-auto"
                onClick={loadServices}
              >
                Retry
              </button>
            </div>
          )}

          {isLoadingServices ? (
            <div className="py-8 text-center text-muted-text text-xs">
              {language === "id" ? "Memuat katalog layanan dari server..." : "Loading service catalog from server..."}
            </div>
          ) : services.length === 0 && !servicesError ? (
            <div className="py-9 px-4 text-center border-b border-stone">
              <p className="text-muted-text m-0 mb-3 text-xs">
                {t("settings.servicesEmpty")}
              </p>
              <p className="text-muted-text m-0 mb-4 text-2xs">
                {t("settings.servicesEmptyDesc")}
              </p>
            </div>
          ) : (
            services.map((srv) => (
              <div key={srv.id} className="flex items-center justify-between py-3.5 gap-3 border-b border-stone">
                <span className="grow min-w-0">
                  <strong className="block text-xs font-semibold text-charcoal truncate">{srv.name}</strong>
                  <small className="block text-2xs text-muted-text truncate">
                    {srv.active
                      ? language === "id"
                        ? "Tersedia untuk reservasi online & datang langsung"
                        : "Available for online booking & walk-ins"
                      : language === "id"
                        ? "Nonaktif (tersembunyi dari reservasi dan antrean)"
                        : "Inactive (hidden from booking and queue)"}
                  </small>
                </span>
                <span className="text-xs text-muted-text min-w-[55px] text-right">
                  {srv.duration_min} {t("common.minutes")}
                </span>
                <strong className="text-xs font-semibold text-charcoal min-w-[90px] text-right">
                  {formatRupiah(srv.price)}
                </strong>
                <Badge tone={srv.active ? "success" : "neutral"}>
                  {srv.active ? t("common.active") : t("common.inactive")}
                </Badge>
                <button
                  type="button"
                  className="icon-button mini"
                  aria-label={`${t("common.edit")} ${srv.name}`}
                  title={language === "id" ? "Ubah detail layanan" : "Edit service details"}
                  onClick={() => {
                    setEditingService(srv)
                    setIsServiceModalOpen(true)
                  }}
                >
                  <Icon name="more" />
                </button>
              </div>
            ))
          )}

          <button
            type="button"
            className="wide-button mt-4"
            onClick={() => {
              setEditingService(null)
              setIsServiceModalOpen(true)
            }}
          >
            <span>+ {t("settings.addService")}</span>
            <Icon name="arrow" size={14} />
          </button>

          {isServiceModalOpen && (
            <ServiceModal
              service={editingService}
              onClose={() => setIsServiceModalOpen(false)}
              onSuccess={(msg) => {
                showToast(msg)
                loadServices()
              }}
            />
          )}
        </div>
      )}

      {/* --- Staff & Permissions (Integrated) --- */}
      {section === "Staff & permissions" && (
        <div className="service-settings border-t border-charcoal divide-y divide-stone mb-6">
          {staffError && (
            <div
              className="login-error-alert mb-4 flex items-center justify-between p-3 border border-danger/30 bg-danger-soft text-danger text-xs rounded-sm"
              role="alert"
            >
              <div className="flex items-center gap-2">
                <Icon name="bell" size={16} />
                <span>{staffError}</span>
              </div>
              <button
                type="button"
                className="filter-button text-xs ml-auto"
                onClick={loadStaff}
              >
                Retry
              </button>
            </div>
          )}

          {isLoadingStaff ? (
            <div className="py-8 text-center text-muted-text text-xs">
              {t("settings.staffLoading")}
            </div>
          ) : staffList.length === 0 && !staffError ? (
            <div className="py-9 px-4 text-center border-b border-stone">
              <p className="text-muted-text m-0 mb-3 text-xs">
                {t("settings.staffEmpty")}
              </p>
            </div>
          ) : (
            staffList.map((st) => {
              const initials = getInitials(st.name)
              const rateLabel =
                st.commission_bps != null
                  ? `${st.commission_bps / 100}% ${language === "id" ? "komisi" : "commission"}`
                  : language === "id"
                    ? "Tarif standar"
                    : "Standard rate"

              return (
                <div key={st.id} className="flex items-center justify-between py-3.5 gap-3 border-b border-stone">
                  <span className="client-cell flex items-center gap-2.5 grow min-w-0">
                    <span className="avatar small">{initials}</span>
                    <span className="min-w-0">
                      <strong className="block text-xs font-semibold text-charcoal truncate">{st.name}</strong>
                      <small className="block text-2xs text-muted-text truncate">
                        {st.contact || (st.active
                          ? language === "id" ? "Akun aktif" : "Active account"
                          : language === "id" ? "Akun nonaktif" : "Inactive account")}
                      </small>
                    </span>
                  </span>
                  <span className="text-xs text-muted-text min-w-[100px] text-right">{rateLabel}</span>
                  <Badge tone={st.active ? "success" : "neutral"}>
                    {st.active ? t("common.active") : t("common.inactive")}
                  </Badge>
                  <button
                    type="button"
                    className="filter-button"
                    onClick={() => {
                      setStaffToEdit(st)
                      setIsStaffModalOpen(true)
                    }}
                  >
                    {t("settings.staffManage")}
                  </button>
                </div>
              )
            })
          )}

          <button
            type="button"
            className="wide-button mt-4"
            onClick={() => {
              setStaffToEdit(null)
              setIsStaffModalOpen(true)
            }}
          >
            <span>{t("settings.staffAddMember")}</span>
            <Icon name="arrow" size={14} />
          </button>

          {isStaffModalOpen && (
            <StaffModal
              staff={staffToEdit}
              onClose={() => setIsStaffModalOpen(false)}
              onSuccess={(msg) => {
                showToast(msg)
                loadStaff()
              }}
            />
          )}
        </div>
      )}

      {/* --- Notifications (Configurable Preferences) --- */}
      {section === "Notifications" && (
        <div className="bg-ivory-light border border-stone rounded-lg p-5 sm:p-6 mb-6 shadow-subtle">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-1">
            <h3 className="font-serif text-lg text-charcoal">
              {t("settings.sectionNotifications")}
            </h3>
            {/* Subtle auto-save status feedback */}
            <div className="flex items-center gap-2 text-xs min-h-[1.5rem]" aria-live="polite">
              {saveStatus === "saving" && (
                <span className="inline-flex items-center gap-1.5 text-muted-text font-medium animate-pulse">
                  <span className="inline-block w-2 h-2 rounded-full bg-copper animate-ping" />
                  {language === "id" ? "Menyimpan..." : "Saving..."}
                </span>
              )}
              {saveStatus === "saved" && (
                <span className="inline-flex items-center gap-1 text-emerald-700 font-medium transition-opacity duration-300">
                  <svg className="w-3.5 h-3.5 text-emerald-600" viewBox="0 0 16 16" fill="currentColor">
                    <path
                      fillRule="evenodd"
                      d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.751.751 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z"
                      clipRule="evenodd"
                    />
                  </svg>
                  {language === "id" ? "Tersimpan" : "Saved"}
                </span>
              )}
              {saveStatus === "error" && (
                <span className="inline-flex items-center gap-1 text-danger font-medium">
                  <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
                    <path
                      fillRule="evenodd"
                      d="M8 15A7 7 0 1 0 8 1a7 7 0 0 0 0 14ZM8 4a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 8 4Zm0 8a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
                      clipRule="evenodd"
                    />
                  </svg>
                  {language === "id" ? "Gagal menyimpan" : "Save failed"}
                </span>
              )}
            </div>
          </div>
          <p className="text-xs text-muted-text mb-4">
            {language === "id"
              ? "Atur preferensi pengingat otomatis dan peringatan operasional barbershop."
              : "Configure automated reminder preferences and operational barbershop alerts."}
          </p>

          {/* Error Banner with Retry */}
          {saveStatus === "error" && saveError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-xs text-danger flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <svg className="w-4 h-4 shrink-0 text-danger" viewBox="0 0 16 16" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    d="M8 15A7 7 0 1 0 8 1a7 7 0 0 0 0 14ZM8 4a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 8 4Zm0 8a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
                    clipRule="evenodd"
                  />
                </svg>
                <span className="truncate">{saveError}</span>
              </div>
              <button
                type="button"
                onClick={handleRetrySave}
                className="shrink-0 px-2.5 py-1 text-2xs font-semibold uppercase tracking-wider text-charcoal bg-ivory border border-stone rounded hover:bg-stone/20 cursor-pointer transition-colors"
              >
                {t("common.retry")}
              </button>
            </div>
          )}

          <div className="divide-y divide-stone border-y border-stone">
            {isLoadingPrefs ? (
              <div className="py-7.5 text-center text-muted-text text-xs">
                {t("notifications.loading")}
              </div>
            ) : prefsError ? (
              <div className="p-5 text-danger text-xs">
                <p>{prefsError}</p>
                <button
                  type="button"
                  className="filter-button mt-2.5 cursor-pointer"
                  onClick={() => void loadNotifPrefs()}
                >
                  {t("common.retry")}
                </button>
              </div>
            ) : notifPrefs ? (
              <>
                {/* 1. Upcoming 30m */}
                <div className="flex items-center justify-between py-3.5 gap-4">
                  <div className="grow min-w-0">
                    <label
                      htmlFor="pref-upcoming-30m"
                      className="block text-xs font-semibold text-charcoal cursor-pointer"
                    >
                      {language === "id"
                        ? "Pengingat Janji Temu 30 Menit"
                        : "30-Minute Upcoming Appointment Reminder"}
                    </label>
                    <small className="block text-2xs text-muted-text mt-0.5">
                      {language === "id"
                        ? "Kirim notifikasi 30 menit sebelum jadwal temu dimulai."
                        : "Send an alert 30 minutes before scheduled start time."}
                    </small>
                  </div>
                  <label htmlFor="pref-upcoming-30m" className="switch shrink-0 cursor-pointer">
                    <input
                      id="pref-upcoming-30m"
                      name="upcoming_reminder_30m_enabled"
                      type="checkbox"
                      checked={notifPrefs.upcoming_reminder_30m_enabled}
                      disabled={!canManageSettings}
                      onChange={(e) => updatePreference("upcoming_reminder_30m_enabled", e.target.checked)}
                    />
                    <i />
                  </label>
                </div>

                {/* 2. Upcoming 15m */}
                <div className="flex items-center justify-between py-3.5 gap-4">
                  <div className="grow min-w-0">
                    <label
                      htmlFor="pref-upcoming-15m"
                      className="block text-xs font-semibold text-charcoal cursor-pointer"
                    >
                      {language === "id"
                        ? "Pengingat Janji Temu 15 Menit"
                        : "15-Minute Upcoming Appointment Reminder"}
                    </label>
                    <small className="block text-2xs text-muted-text mt-0.5">
                      {language === "id"
                        ? "Kirim notifikasi 15 menit sebelum jadwal temu dimulai."
                        : "Send an alert 15 minutes before scheduled start time."}
                    </small>
                  </div>
                  <label htmlFor="pref-upcoming-15m" className="switch shrink-0 cursor-pointer">
                    <input
                      id="pref-upcoming-15m"
                      name="upcoming_reminder_15m_enabled"
                      type="checkbox"
                      checked={notifPrefs.upcoming_reminder_15m_enabled}
                      disabled={!canManageSettings}
                      onChange={(e) => updatePreference("upcoming_reminder_15m_enabled", e.target.checked)}
                    />
                    <i />
                  </label>
                </div>

                {/* 3. Overdue Detection */}
                <div className="flex items-center justify-between py-3.5 gap-4">
                  <div className="grow min-w-0">
                    <label
                      htmlFor="pref-overdue"
                      className="block text-xs font-semibold text-charcoal cursor-pointer"
                    >
                      {language === "id"
                        ? "Peringatan Janji Temu Terlambat (Overdue)"
                        : "Overdue Appointment Alerts"}
                    </label>
                    <small className="block text-2xs text-muted-text mt-0.5">
                      {language === "id"
                        ? "Beri tahu jika janji temu belum check-in atau dimulai setelah jadwalnya lewat."
                        : "Alert if an appointment has not checked in or started after scheduled start."}
                    </small>
                  </div>
                  <div className="notif-setting-action flex items-center gap-3 shrink-0">
                    {notifPrefs.overdue_reminder_enabled && (
                      <select
                        aria-label="Interval pengingat keterlambatan"
                        className="notif-setting-select h-8.5 border border-stone bg-ivory px-2.5 text-xs rounded-sm focus:border-copper focus:ring-1 focus:ring-copper outline-none text-charcoal cursor-pointer"
                        value={notifPrefs.overdue_interval_minutes}
                        disabled={!canManageSettings}
                        onChange={(e) =>
                          updatePreference("overdue_interval_minutes", Number(e.target.value))
                        }
                      >
                        <option value={5}>Setiap 5 menit / Every 5m</option>
                        <option value={10}>Setiap 10 menit / Every 10m</option>
                        <option value={15}>Setiap 15 menit / Every 15m</option>
                        <option value={30}>Setiap 30 menit / Every 30m</option>
                      </select>
                    )}
                    <label htmlFor="pref-overdue" className="switch shrink-0 cursor-pointer">
                      <input
                        id="pref-overdue"
                        name="overdue_reminder_enabled"
                        type="checkbox"
                        checked={notifPrefs.overdue_reminder_enabled}
                        disabled={!canManageSettings}
                        onChange={(e) => updatePreference("overdue_reminder_enabled", e.target.checked)}
                      />
                      <i />
                    </label>
                  </div>
                </div>

                {/* 4. Excessive Queue Wait */}
                <div className="flex items-center justify-between py-3.5 gap-4">
                  <div className="grow min-w-0">
                    <label
                      htmlFor="pref-queue-alerts"
                      className="block text-xs font-semibold text-charcoal cursor-pointer"
                    >
                      {language === "id"
                        ? "Peringatan Waktu Tunggu Antrean Berlebih"
                        : "Excessive Queue Wait Alert"}
                    </label>
                    <small className="block text-2xs text-muted-text mt-0.5">
                      {language === "id"
                        ? "Kirim notifikasi jika antrean walk-in menunggu melebihi batas waktu toleransi."
                        : "Send an alert if walk-in clients wait longer than the designated threshold."}
                    </small>
                  </div>
                  <div className="notif-setting-action flex items-center gap-3 shrink-0">
                    {notifPrefs.queue_alerts_enabled && (
                      <select
                        aria-label="Batas waktu tunggu antrean"
                        className="notif-setting-select h-8.5 border border-stone bg-ivory px-2.5 text-xs rounded-sm focus:border-copper focus:ring-1 focus:ring-copper outline-none text-charcoal cursor-pointer"
                        value={notifPrefs.excessive_wait_threshold_minutes}
                        disabled={!canManageSettings}
                        onChange={(e) =>
                          updatePreference(
                            "excessive_wait_threshold_minutes",
                            Number(e.target.value)
                          )
                        }
                      >
                        <option value={15}>15 menit / 15m</option>
                        <option value={25}>25 menit / 25m</option>
                        <option value={30}>30 menit / 30m</option>
                        <option value={45}>45 menit / 45m</option>
                        <option value={60}>60 menit / 60m</option>
                      </select>
                    )}
                    <label htmlFor="pref-queue-alerts" className="switch shrink-0 cursor-pointer">
                      <input
                        id="pref-queue-alerts"
                        name="queue_alerts_enabled"
                        type="checkbox"
                        checked={notifPrefs.queue_alerts_enabled}
                        disabled={!canManageSettings}
                        onChange={(e) =>
                          updatePreference("queue_alerts_enabled", e.target.checked)
                        }
                      />
                      <i />
                    </label>
                  </div>
                </div>

                {/* 5. Shift Reminders */}
                <div className="flex items-center justify-between py-3.5 gap-4">
                  <div className="grow min-w-0">
                    <label
                      htmlFor="pref-barber-shift"
                      className="block text-xs font-semibold text-charcoal cursor-pointer"
                    >
                      {language === "id"
                        ? "Pengingat Shift Staf & Kapster"
                        : "Staff & Barber Shift Alerts"}
                    </label>
                    <small className="block text-2xs text-muted-text mt-0.5">
                      {language === "id"
                        ? "Peringatan awal sebelum jadwal kerja kapster dimulai dan saat shift berakhir."
                        : "Notify barbers before work shift begins and when shifts conclude."}
                    </small>
                  </div>
                  <label htmlFor="pref-barber-shift" className="switch shrink-0 cursor-pointer">
                    <input
                      id="pref-barber-shift"
                      name="barber_shift_alerts_enabled"
                      type="checkbox"
                      checked={notifPrefs.barber_shift_alerts_enabled}
                      disabled={!canManageSettings}
                      onChange={(e) =>
                        updatePreference("barber_shift_alerts_enabled", e.target.checked)
                      }
                    />
                    <i />
                  </label>
                </div>

                {/* 6. Financial & Register Alerts */}
                <div className="flex items-center justify-between py-3.5 gap-4">
                  <div className="grow min-w-0">
                    <label
                      htmlFor="pref-financial"
                      className="block text-xs font-semibold text-charcoal cursor-pointer"
                    >
                      {language === "id"
                        ? "Notifikasi Transaksi Keuangan & Tutup Kasir"
                        : "Financial Transactions & Daily Register Alerts"}
                    </label>
                    <small className="block text-2xs text-muted-text mt-0.5">
                      {language === "id"
                        ? "Terima pembaruan untuk pembayaran sukses, refund, pencairan, dan rekonsiliasi harian."
                        : "Receive alerts for recorded payments, refunds, payouts, and register closures."}
                    </small>
                  </div>
                  <label htmlFor="pref-financial" className="switch shrink-0 cursor-pointer">
                    <input
                      id="pref-financial"
                      name="financial_alerts_enabled"
                      type="checkbox"
                      checked={notifPrefs.financial_alerts_enabled}
                      disabled={!canManageSettings}
                      onChange={(e) =>
                        updatePreference("financial_alerts_enabled", e.target.checked)
                      }
                    />
                    <i />
                  </label>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}

      {/* --- Billing (Localized) --- */}
      {section === "Billing" && (
        <div className="billing-panel grid grid-cols-1 md:grid-cols-3 border border-stone-line divide-y md:divide-y-0 md:divide-x divide-stone-line bg-white rounded-sm mb-6">
          <div>
            <Badge tone="success">{t("settings.billingActivePlan")}</Badge>
            <h3>{t("settings.billingPlanName")}</h3>
            <p>{t("settings.billingPlanDesc")}</p>
            <strong>
              $79 <small className="block text-2xs text-muted-text mt-0.5">{t("settings.billingPerMonth")}</small>
            </strong>
            <button className="filter-button">{t("settings.billingChangePlan")}</button>
          </div>
          <div>
            <span className="section-index">{t("settings.billingPaymentMethod")}</span>
            <p>
              <strong>{t("settings.billingCardDesc")}</strong>
              <br />
              {t("settings.billingExpires")} 08/27
            </p>
            <button className="filter-button">{t("settings.billingUpdateCard")}</button>
          </div>
          <div>
            <span className="section-index">{t("settings.billingLatestInvoice")}</span>
            <p>
              <strong>
                {new Date(2025, 4, 1).toLocaleDateString(language === "id" ? "id-ID" : "en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </strong>
              <br />
              $79.00 · {t("settings.billingPaid")}
            </p>
            <button className="filter-button">{t("settings.billingDownloadPdf")}</button>
          </div>
        </div>
      )}

      {/* --- Payroll & Compensation Defaults --- */}
      {section === "Payroll & Compensation" && (
        <div className="bg-ivory-light border border-stone rounded-lg p-5 sm:p-6 mb-6 shadow-subtle">
          <h3 className="font-serif text-lg text-charcoal mb-1">
            {t("settings.payrollDefaultsTitle")}
          </h3>
          <p className="text-xs text-muted-text mb-4">
            {t("settings.payrollDefaultsDesc")}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="col-span-full">
              <label className="block text-xs font-semibold text-charcoal mb-1.5">
                {t("settings.payrollModelLabel")}
              </label>
              <select
                value={payrollSettings.default_model}
                onChange={(e) => {
                  setPayrollSettings({
                    ...payrollSettings,
                    default_model: e.target.value as "commission" | "salary" | "hybrid",
                  })
                  setIsPayrollDirty(true)
                }}
                className="w-full h-9 px-3 bg-ivory border border-stone rounded-sm text-xs font-sans text-charcoal focus:border-copper focus:ring-1 focus:ring-copper outline-none transition-all cursor-pointer"
              >
                <option value="commission">{t("settings.payrollModelCommission")}</option>
                <option value="salary">{t("settings.payrollModelSalary")}</option>
                <option value="hybrid">{t("settings.payrollModelHybrid")}</option>
              </select>
            </div>

            {(payrollSettings.default_model === "commission" ||
              payrollSettings.default_model === "hybrid") && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-charcoal mb-1.5">
                      {t("settings.payrollMethodLabel")}
                    </label>
                    <select
                      value={payrollSettings.default_commission_type}
                      onChange={(e) => {
                        setPayrollSettings({
                          ...payrollSettings,
                          default_commission_type: e.target.value as "percentage" | "fixed",
                        })
                        setIsPayrollDirty(true)
                      }}
                      className="w-full h-9 px-3 bg-ivory border border-stone rounded-sm text-xs font-sans text-charcoal focus:border-copper focus:ring-1 focus:ring-copper outline-none transition-all cursor-pointer"
                    >
                      <option value="percentage">{t("settings.payrollMethodPercentage")}</option>
                      <option value="fixed">{t("settings.payrollMethodFixed")}</option>
                    </select>
                  </div>

                  {payrollSettings.default_commission_type === "percentage" ? (
                    <div>
                      <label className="block text-xs font-semibold text-charcoal mb-1.5">
                        {t("settings.payrollRateLabel")}
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.5"
                          value={payrollSettings.default_commission_rate_bps / 100}
                          onChange={(e) => {
                            const pct = Math.max(0, Math.min(100, Number(e.target.value) || 0))
                            setPayrollSettings({
                              ...payrollSettings,
                              default_commission_rate_bps: Math.round(pct * 100),
                            })
                            setIsPayrollDirty(true)
                          }}
                          className="w-full h-9 px-3 pr-8 bg-ivory border border-stone rounded-sm text-xs font-sans text-charcoal focus:border-copper focus:ring-1 focus:ring-copper outline-none transition-all"
                        />
                        <span className="absolute right-3 top-2 text-xs text-muted-text font-bold pointer-events-none">
                          %
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-xs font-semibold text-charcoal mb-1.5">
                        {t("settings.payrollFixedLabel")}
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-2 text-xs text-muted-text font-mono pointer-events-none">
                          Rp
                        </span>
                        <input
                          type="number"
                          min="0"
                          step="5000"
                          value={payrollSettings.default_fixed_commission_amount}
                          onChange={(e) => {
                            setPayrollSettings({
                              ...payrollSettings,
                              default_fixed_commission_amount: Math.max(0, Number(e.target.value) || 0),
                            })
                            setIsPayrollDirty(true)
                          }}
                          className="w-full h-9 pl-9 pr-3 bg-ivory border border-stone rounded-sm text-xs font-sans text-charcoal focus:border-copper focus:ring-1 focus:ring-copper outline-none transition-all"
                        />
                      </div>
                    </div>
                  )}
                </>
              )}

            {(payrollSettings.default_model === "salary" ||
              payrollSettings.default_model === "hybrid") && (
                <div className="col-span-full">
                  <label className="block text-xs font-semibold text-charcoal mb-1.5">
                    {t("settings.payrollSalaryLabel")}
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-xs text-muted-text font-mono pointer-events-none">
                      Rp
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="100000"
                      value={payrollSettings.default_monthly_salary}
                      onChange={(e) => {
                        setPayrollSettings({
                          ...payrollSettings,
                          default_monthly_salary: Math.max(0, Number(e.target.value) || 0),
                        })
                        setIsPayrollDirty(true)
                      }}
                      className="w-full h-9 pl-9 pr-3 bg-ivory border border-stone rounded-sm text-xs font-sans text-charcoal focus:border-copper focus:ring-1 focus:ring-copper outline-none transition-all"
                    />
                  </div>
                </div>
              )}

            <div className="col-span-full">
              <label className="block text-xs font-semibold text-charcoal mb-1.5">
                {t("settings.payrollTipsPolicyLabel")}
              </label>
              <select
                value={payrollSettings.default_tips_policy}
                onChange={(e) => {
                  setPayrollSettings({
                    ...payrollSettings,
                    default_tips_policy: e.target.value as "direct" | "pooled",
                  })
                  setIsPayrollDirty(true)
                }}
                className="w-full h-9 px-3 bg-ivory border border-stone rounded-sm text-xs font-sans text-charcoal focus:border-copper focus:ring-1 focus:ring-copper outline-none transition-all cursor-pointer"
              >
                <option value="direct">{t("settings.payrollTipsDirect")}</option>
                <option value="pooled">{t("settings.payrollTipsPooled")}</option>
              </select>
            </div>
          </div>

          <p className="text-xs text-muted-text mt-4 pt-3 border-t border-stone">
            {t("settings.payrollNote")}
          </p>
        </div>
      )}

      {/* --- Section Save Action --- */}
      {section === "Shop profile" && (
        <div className="pt-2">
          <Button
            type="button"
            variant="primary"
            onClick={handleSaveShop}
            disabled={!canManageSettings || isSavingShop || !isShopDirty || !shopName.trim()}
            isLoading={isSavingShop}
          >
            {isSavingShop
              ? language === "id"
                ? "Menyimpan profil barbershop..."
                : "Saving shop profile..."
              : isShopDirty
                ? language === "id"
                  ? "Simpan perubahan *"
                  : "Save changes *"
                : language === "id"
                  ? "Profil tersimpan"
                  : "Profile saved"}
          </Button>
        </div>
      )}

      {section === "Payroll & Compensation" && (
        <div className="pt-2">
          <Button
            type="button"
            variant="primary"
            onClick={handleSavePayrollSettings}
            disabled={isSavingPayroll || !isPayrollDirty}
            isLoading={isSavingPayroll}
          >
            {isSavingPayroll
              ? language === "id"
                ? "Menyimpan standar kompensasi..."
                : "Saving defaults..."
              : isPayrollDirty
                ? language === "id"
                  ? "Simpan perubahan *"
                  : "Save changes *"
                : language === "id"
                  ? "Standar kompensasi tersimpan"
                  : "Defaults saved"}
          </Button>
        </div>
      )}

      {section !== "Billing" &&
        section !== "Shop profile" &&
        section !== "Hours & availability" &&
        section !== "Services & pricing" &&
        section !== "Payroll & Compensation" &&
        section !== "Notifications" && (
          <button className="primary-button settings-save">{t("common.save")}</button>
        )}
    </section>
  )
}
