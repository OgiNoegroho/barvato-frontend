import React, { useState, useEffect, useCallback } from "react"
import { Badge } from "../../components/ui/Badge"
import { Icon } from "../../components/ui/Icon"
import { Toast } from "../../components/layout/Toast"
import {
  servicesApi,
  shopApi,
  staffApi,
  payrollApi,
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

  // --- Toast feedback state ---
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const showToast = useCallback((msg: string) => {
    setToastMessage(msg)
    const timer = setTimeout(() => setToastMessage(null), 3500)
    return () => clearTimeout(timer)
  }, [])

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
    <section className="settings-form">
      <span className="section-index">{section.toUpperCase()}</span>
      <h2>{title}</h2>
      <p>{description}</p>

      {/* --- Shop Profile (Activated) --- */}
      {section === "Shop profile" && (
        <div>
          {/* --- Language Selector --- */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "16px 18px",
              background: "var(--surface-raised, #faf9f7)",
              border: "1px solid var(--line)",
              marginBottom: "20px",
              flexWrap: "wrap",
              gap: "12px",
            }}
          >
            <div>
              <span
                style={{
                  fontSize: "10px",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  color: "var(--muted)",
                  display: "block",
                  marginBottom: "2px",
                }}
              >
                {t("settings.languageTitle")}
              </span>
              <strong style={{ fontSize: "13px", color: "var(--ink)", display: "block" }}>
                {t("settings.languageSubtitle")}
              </strong>
            </div>
            <div>
              <select
                aria-label={t("settings.languageTitle")}
                value={language}
                onChange={(e) => setLanguage(e.target.value as "id" | "en")}
                className="filter-button"
                style={{
                  height: "36px",
                  padding: "0 28px 0 12px",
                  fontSize: "12px",
                  fontWeight: 600,
                  color: "var(--ink)",
                  background: "var(--white)",
                  border: "1px solid var(--line)",
                  borderRadius: "4px",
                  cursor: "pointer",
                  outline: "none",
                }}
              >
                <option value="id">Bahasa Indonesia</option>
                <option value="en">English</option>
              </select>
            </div>
          </div>

          {shopError && (
            <div
              className="login-error-alert"
              role="alert"
              style={{
                marginBottom: "16px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 14px",
                border: "1px solid var(--danger)",
                background: "rgba(207, 60, 60, 0.08)",
                color: "var(--red, #cf3c3c)",
                fontSize: "11px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Icon name="bell" size={16} />
                <span>{shopError}</span>
              </div>
              <button
                type="button"
                className="text-button"
                onClick={loadShopDetails}
                style={{ fontSize: "11px", textDecoration: "underline", color: "inherit", cursor: "pointer" }}
              >
                Retry
              </button>
            </div>
          )}

          {isLoadingShop ? (
            <div style={{ padding: "36px 0", textAlign: "center", color: "var(--muted)", fontSize: "11px" }}>
              Loading shop profile from server...
            </div>
          ) : !shopDetails ? (
            <div style={{ padding: "32px 0", textAlign: "center", color: "var(--muted)", fontSize: "11px" }}>
              No shop profile available.
            </div>
          ) : (
            <div>
              {!canManageSettings && (
                <div
                  style={{
                    marginBottom: "20px",
                    padding: "12px 14px",
                    background: "var(--surface-raised, #f6f5f3)",
                    border: "1px solid var(--line)",
                    fontSize: "11px",
                    color: "var(--muted)",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <Icon name="bell" size={14} />
                  <span>
                    Shop profile details can only be modified by the shop owner. You are signed in as a{" "}
                    <strong style={{ textTransform: "capitalize", color: "var(--ink)" }}>{currentShop?.role || "staff member"}</strong> (read-only mode).
                  </span>
                </div>
              )}

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "14px 16px",
                  background: "var(--surface-raised, #faf9f7)",
                  border: "1px solid var(--line)",
                  marginBottom: "20px",
                }}
              >
                <div>
                  <span style={{ fontSize: "9px", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted)", display: "block" }}>
                    Tenant Identity
                  </span>
                  <strong style={{ fontSize: "13px", color: "var(--ink)" }}>
                    Shop #{shopDetails.id}
                  </strong>
                </div>
                <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "8px" }}>
                  <Badge tone={shopDetails.status === "active" ? "success" : "neutral"}>
                    {shopDetails.status.toUpperCase()}
                  </Badge>
                  {shopDetails.created_at && (
                    <span style={{ fontSize: "10px", color: "var(--muted)" }}>
                      Established {new Date(shopDetails.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </span>
                  )}
                </div>
              </div>

              <div className="form-grid">
                <label className="full">
                  Barbershop Business Name *
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
                  />
                </label>

                <label>
                  Operating Timezone *
                  <select
                    value={shopTimezone}
                    disabled={!canManageSettings || isSavingShop}
                    onChange={(e) => {
                      setShopTimezone(e.target.value)
                      setIsShopDirty(true)
                    }}
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
                </label>

                <label>
                  Subscription Status
                  <input
                    type="text"
                    value={shopDetails.status.toUpperCase()}
                    disabled
                    readOnly
                    style={{ background: "var(--surface-raised, #f6f5f3)", cursor: "not-allowed" }}
                  />
                </label>
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
              className="login-error-alert"
              role="alert"
              style={{ marginBottom: "16px", color: "var(--red, #cf3c3c)" }}
            >
              <Icon name="bell" size={16} />
              <span>{hoursError}</span>
            </div>
          )}

          {isLoadingHours ? (
            <div style={{ padding: "32px 0", textAlign: "center", color: "var(--muted)", fontSize: "11px" }}>
              {language === "id" ? "Memuat jam operasional dari server..." : "Loading operating hours from server..."}
            </div>
          ) : (
            <div className="hours-list">
              {WEEKDAYS.map((wd) => {
                const hour = hoursMap[wd.day] || {
                  day_of_week: wd.day,
                  is_open: wd.day !== 0,
                  open_time: "09:00:00",
                  close_time: "21:00:00",
                }
                const dayLabel = language === "id" ? wd.labelId : wd.labelEn

                return (
                  <div key={wd.day}>
                    <label className="switch">
                      <input
                        type="checkbox"
                        checked={hour.is_open}
                        disabled={!canManageSchedule}
                        onChange={(e) => handleToggleDay(wd.day, e.target.checked)}
                      />
                      <i />
                    </label>
                    <strong>{dayLabel}</strong>
                    {hour.is_open ? (
                      <>
                        <input
                          type="time"
                          disabled={!canManageSchedule}
                          value={formatTimeForInput(hour.open_time, "09:00")}
                          onChange={(e) => handleTimeChange(wd.day, "open_time", e.target.value)}
                        />
                        <span className="hours-sep">{language === "id" ? "sampai" : "to"}</span>
                        <input
                          type="time"
                          disabled={!canManageSchedule}
                          value={formatTimeForInput(hour.close_time, "21:00")}
                          onChange={(e) => handleTimeChange(wd.day, "close_time", e.target.value)}
                        />
                      </>
                    ) : (
                      <em style={{ gridColumn: "3 / -1" }}>{t("settings.dayClosed")}</em>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {canManageSchedule && (
            <button
              type="button"
              className="primary-button settings-save"
              style={{ marginTop: "16px" }}
              onClick={handleSaveHours}
              disabled={isSavingHours || !isHoursDirty}
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
            </button>
          )}

          {/* --- Shop Closures & Special Operating Hours --- */}
          <div
            style={{
              marginTop: "36px",
              paddingTop: "28px",
              borderTop: "1px solid var(--line)",
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px", flexWrap: "wrap", marginBottom: "16px" }}>
              <div>
                <h3 style={{ margin: "0 0 4px", fontSize: "15px", color: "var(--ink)" }}>
                  {t("closures.title")}
                </h3>
                <p style={{ margin: 0, fontSize: "11px", color: "var(--muted)" }}>
                  {t("closures.subtitle")}
                </p>
              </div>
              {canManageSchedule && !isClosureFormOpen && (
                <button
                  type="button"
                  className="filter-button"
                  style={{ fontWeight: 600 }}
                  onClick={openCreateClosure}
                >
                  {t("closures.addButton")}
                </button>
              )}
            </div>

            {closureError && (
              <div
                className="login-error-alert"
                role="alert"
                style={{
                  marginBottom: "14px",
                  padding: "10px 14px",
                  border: "1px solid var(--danger)",
                  background: "rgba(207, 60, 60, 0.08)",
                  color: "var(--red, #cf3c3c)",
                  fontSize: "11px",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <Icon name="bell" size={14} />
                <span>{closureError}</span>
              </div>
            )}

            {isClosureFormOpen && canManageSchedule && (
              <div
                style={{
                  padding: "16px",
                  background: "var(--surface-raised, #faf9f7)",
                  border: "1px solid var(--line)",
                  marginBottom: "18px",
                }}
              >
                <strong style={{ display: "block", fontSize: "12px", marginBottom: "12px", color: "var(--ink)" }}>
                  {editingClosure ? t("closures.editTitle") : t("closures.createTitle")}
                </strong>

                <div className="form-grid">
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
                    style={{
                      marginTop: "14px",
                      padding: "12px 14px",
                      border: "1px solid var(--red, #cf3c3c)",
                      background: "rgba(207, 60, 60, 0.08)",
                      color: "var(--ink)",
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
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button
                        type="button"
                        className="primary-button"
                        style={{ background: "var(--red, #cf3c3c)", borderColor: "var(--red, #cf3c3c)" }}
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
                  <div style={{ display: "flex", gap: "8px", marginTop: "14px" }}>
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
              <div style={{ padding: "18px 0", fontSize: "11px", color: "var(--muted)" }}>
                {t("common.loading")}
              </div>
            ) : closures.length === 0 ? (
              <div
                style={{
                  padding: "20px 14px",
                  border: "1px dashed var(--line)",
                  textAlign: "center",
                  color: "var(--muted)",
                  fontSize: "11px",
                }}
              >
                {t("closures.empty")}
              </div>
            ) : (
              <div className="service-settings">
                {closures.map((c) => {
                  const dateLabel =
                    c.start_date === c.end_date
                      ? c.start_date
                      : `${c.start_date} – ${c.end_date}`
                  return (
                    <div
                      key={c.id}
                      style={{
                        borderLeft: c.is_closed
                          ? "3px solid var(--red, #cf3c3c)"
                          : "3px solid var(--amber, #b7791f)",
                        paddingLeft: "10px",
                      }}
                    >
                      <span>
                        <strong>{c.reason || (c.is_closed ? t("closures.badgeClosed") : t("closures.title"))}</strong>
                        <small>{dateLabel}</small>
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
                        <div style={{ display: "flex", gap: "6px" }}>
                          <button
                            type="button"
                            className="filter-button"
                            onClick={() => openEditClosure(c)}
                          >
                            {t("common.edit")}
                          </button>
                          <button
                            type="button"
                            className="filter-button"
                            style={{ color: "var(--red, #cf3c3c)" }}
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
        <div className="service-settings">
          {servicesError && (
            <div
              className="login-error-alert"
              role="alert"
              style={{ marginBottom: "16px", color: "var(--red, #cf3c3c)" }}
            >
              <Icon name="bell" size={16} />
              <span>{servicesError}</span>
              <button
                type="button"
                className="filter-button"
                style={{ marginLeft: "auto", fontSize: "10px" }}
                onClick={loadServices}
              >
                Retry
              </button>
            </div>
          )}

          {isLoadingServices ? (
            <div style={{ padding: "32px 0", textAlign: "center", color: "var(--muted)", fontSize: "11px" }}>
              {language === "id" ? "Memuat katalog layanan dari server..." : "Loading service catalog from server..."}
            </div>
          ) : services.length === 0 && !servicesError ? (
            <div
              style={{
                padding: "36px 16px",
                textAlign: "center",
                borderBottom: "1px solid var(--line)",
              }}
            >
              <p style={{ color: "var(--muted)", margin: "0 0 12px", fontSize: "12px" }}>
                {t("settings.servicesEmpty")}
              </p>
              <p style={{ color: "var(--muted)", margin: "0 0 16px", fontSize: "10px" }}>
                {t("settings.servicesEmptyDesc")}
              </p>
            </div>
          ) : (
            services.map((srv) => (
              <div key={srv.id}>
                <span>
                  <strong>{srv.name}</strong>
                  <small>
                    {srv.active
                      ? language === "id"
                        ? "Tersedia untuk reservasi online & datang langsung"
                        : "Available for online booking & walk-ins"
                      : language === "id"
                        ? "Nonaktif (tersembunyi dari reservasi dan antrean)"
                        : "Inactive (hidden from booking and queue)"}
                  </small>
                </span>
                <span style={{ fontSize: "11px", color: "var(--muted)", minWidth: "55px" }}>
                  {srv.duration_min} {t("common.minutes")}
                </span>
                <strong style={{ fontSize: "11px", minWidth: "90px" }}>
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
            className="wide-button"
            style={{ marginTop: "16px" }}
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
        <div className="service-settings">
          {staffError && (
            <div
              className="login-error-alert"
              role="alert"
              style={{ marginBottom: "16px", color: "var(--red, #cf3c3c)" }}
            >
              <Icon name="bell" size={16} />
              <span>{staffError}</span>
              <button
                type="button"
                className="filter-button"
                style={{ marginLeft: "auto", fontSize: "10px" }}
                onClick={loadStaff}
              >
                Retry
              </button>
            </div>
          )}

          {isLoadingStaff ? (
            <div style={{ padding: "32px 0", textAlign: "center", color: "var(--muted)", fontSize: "11px" }}>
              {t("settings.staffLoading")}
            </div>
          ) : staffList.length === 0 && !staffError ? (
            <div style={{ padding: "36px 16px", textAlign: "center", borderBottom: "1px solid var(--line)" }}>
              <p style={{ color: "var(--muted)", margin: "0 0 12px", fontSize: "12px" }}>
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
                <div key={st.id}>
                  <span className="client-cell">
                    <span className="avatar small">{initials}</span>
                    <span>
                      <strong>{st.name}</strong>
                      <small>
                        {st.contact || (st.active
                          ? language === "id" ? "Akun aktif" : "Active account"
                          : language === "id" ? "Akun nonaktif" : "Inactive account")}
                      </small>
                    </span>
                  </span>
                  <span style={{ fontSize: "11px", color: "var(--muted)" }}>{rateLabel}</span>
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
            className="wide-button"
            style={{ marginTop: "16px" }}
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

      {/* --- Notifications (Localized) --- */}
      {section === "Notifications" && (
        <div className="notification-settings">
          {[
            [
              t("settings.notifApptConfirm"),
              t("settings.notifApptConfirmDesc"),
            ],
            [
              t("settings.notifReminder"),
              t("settings.notifReminderDesc"),
            ],
            [
              t("settings.notifQueue"),
              t("settings.notifQueueDesc"),
            ],
            [
              t("settings.notifDailySummary"),
              t("settings.notifDailySummaryDesc"),
            ],
          ].map((x, i) => (
            <label key={x[0]}>
              <span>
                <strong>{x[0]}</strong>
                <small>{x[1]}</small>
              </span>
              <span className="switch">
                <input type="checkbox" defaultChecked={i < 3} />
                <i />
              </span>
            </label>
          ))}
        </div>
      )}

      {/* --- Billing (Localized) --- */}
      {section === "Billing" && (
        <div className="billing-panel">
          <div>
            <Badge tone="success">{t("settings.billingActivePlan")}</Badge>
            <h3>{t("settings.billingPlanName")}</h3>
            <p>{t("settings.billingPlanDesc")}</p>
            <strong>
              $79 <small>{t("settings.billingPerMonth")}</small>
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
        <div className="form-grid">
          <label className="full">
            <span>{t("settings.payrollModelLabel")}</span>
            <select
              value={payrollSettings.default_model}
              onChange={(e) => {
                setPayrollSettings({
                  ...payrollSettings,
                  default_model: e.target.value as "commission" | "salary" | "hybrid",
                })
                setIsPayrollDirty(true)
              }}
            >
              <option value="commission">{t("settings.payrollModelCommission")}</option>
              <option value="salary">{t("settings.payrollModelSalary")}</option>
              <option value="hybrid">{t("settings.payrollModelHybrid")}</option>
            </select>
          </label>

          {(payrollSettings.default_model === "commission" ||
            payrollSettings.default_model === "hybrid") && (
              <>
                <label>
                  <span>{t("settings.payrollMethodLabel")}</span>
                  <select
                    value={payrollSettings.default_commission_type}
                    onChange={(e) => {
                      setPayrollSettings({
                        ...payrollSettings,
                        default_commission_type: e.target.value as "percentage" | "fixed",
                      })
                      setIsPayrollDirty(true)
                    }}
                  >
                    <option value="percentage">{t("settings.payrollMethodPercentage")}</option>
                    <option value="fixed">{t("settings.payrollMethodFixed")}</option>
                  </select>
                </label>

                {payrollSettings.default_commission_type === "percentage" ? (
                  <label>
                    <span>{t("settings.payrollRateLabel")}</span>
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
                    />
                  </label>
                ) : (
                  <label>
                    <span>{t("settings.payrollFixedLabel")}</span>
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
                    />
                  </label>
                )}
              </>
            )}

          {(payrollSettings.default_model === "salary" ||
            payrollSettings.default_model === "hybrid") && (
              <label className="full">
                <span>{t("settings.payrollSalaryLabel")}</span>
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
                />
              </label>
            )}

          <label className="full">
            <span>{t("settings.payrollTipsPolicyLabel")}</span>
            <select
              value={payrollSettings.default_tips_policy}
              onChange={(e) => {
                setPayrollSettings({
                  ...payrollSettings,
                  default_tips_policy: e.target.value as "direct" | "pooled",
                })
                setIsPayrollDirty(true)
              }}
            >
              <option value="direct">{t("settings.payrollTipsDirect")}</option>
              <option value="pooled">{t("settings.payrollTipsPooled")}</option>
            </select>
          </label>

          <p className="full" style={{ fontSize: "11px", color: "var(--muted)", margin: "4px 0 0" }}>
            {t("settings.payrollNote")}
          </p>
        </div>
      )}

      {/* --- Section Save Action --- */}
      {section === "Shop profile" && (
        <button
          type="button"
          className="primary-button settings-save"
          onClick={handleSaveShop}
          disabled={!canManageSettings || isSavingShop || !isShopDirty || !shopName.trim()}
        >
          {isSavingShop
            ? language === "id"
              ? "Menyimpan profil toko..."
              : "Saving shop profile..."
            : isShopDirty
              ? language === "id"
                ? "Simpan perubahan *"
                : "Save changes *"
              : language === "id"
                ? "Profil tersimpan"
                : "Profile saved"}
        </button>
      )}

      {section === "Payroll & Compensation" && (
        <button
          type="button"
          className="primary-button settings-save"
          onClick={handleSavePayrollSettings}
          disabled={isSavingPayroll || !isPayrollDirty}
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
        </button>
      )}

      {section !== "Billing" &&
        section !== "Shop profile" &&
        section !== "Hours & availability" &&
        section !== "Services & pricing" &&
        section !== "Payroll & Compensation" && (
          <button className="primary-button settings-save">{t("common.save")}</button>
        )}

      {toastMessage && <Toast message={toastMessage} />}
    </section>
  )
}
