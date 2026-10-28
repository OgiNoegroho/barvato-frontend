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
  type StaffItem,
  type ShopPayrollSettings,
  ApiError,
} from "../../lib/api"
import { formatRupiah, getInitials } from "../../lib/format"
import { ServiceModal } from "./ServiceModal"
import { StaffModal } from "../team/StaffModal"
import { useAuth } from "../auth/AuthContext"

interface SettingsContentProps {
  section: string
}

const WEEKDAYS = [
  { day: 1, label: "Monday" },
  { day: 2, label: "Tuesday" },
  { day: 3, label: "Wednesday" },
  { day: 4, label: "Thursday" },
  { day: 5, label: "Friday" },
  { day: 6, label: "Saturday" },
  { day: 0, label: "Sunday" },
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
  const headers: Record<string, [string, string]> = {
    "Shop profile": [
      "Your shop details",
      "Information shown on booking confirmations and client receipts.",
    ],
    "Hours & availability": [
      "Business hours",
      "Set regular operating hours and booking availability.",
    ],
    "Services & pricing": [
      "Service menu",
      "Manage duration, pricing, and online availability.",
    ],
    "Staff & permissions": [
      "Staff access",
      "Invite staff and control what each role can access.",
    ],
    "Payroll & Compensation": [
      "Payroll & compensation defaults",
      "Configure default compensation rules for newly created barbers. Existing barbers retain their agreements.",
    ],
    Notifications: [
      "Client notifications",
      "Choose when customers and staff receive updates.",
    ],
    Billing: [
      "Plan and billing",
      "Manage your subscription, invoices, and payment method.",
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

  // --- Business Hours State ---
  const [hoursMap, setHoursMap] = useState<Record<number, ShopHour>>({})
  const [isLoadingHours, setIsLoadingHours] = useState(false)
  const [hoursError, setHoursError] = useState<string | null>(null)
  const [isHoursDirty, setIsHoursDirty] = useState(false)
  const [isSavingHours, setIsSavingHours] = useState(false)

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
    }
  }, [section, loadHours])

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
          setHoursError(`Closing time must be after opening time for ${wd.label} (${openVal} - ${closeVal}).`)
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
              Loading operating hours from server...
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

                return (
                  <div key={wd.label}>
                    <label className="switch">
                      <input
                        type="checkbox"
                        checked={hour.is_open}
                        onChange={(e) => handleToggleDay(wd.day, e.target.checked)}
                      />
                      <i />
                    </label>
                    <strong>{wd.label}</strong>
                    {hour.is_open ? (
                      <>
                        <input
                          type="time"
                          value={formatTimeForInput(hour.open_time, "09:00")}
                          onChange={(e) => handleTimeChange(wd.day, "open_time", e.target.value)}
                        />
                        <span>to</span>
                        <input
                          type="time"
                          value={formatTimeForInput(hour.close_time, "21:00")}
                          onChange={(e) => handleTimeChange(wd.day, "close_time", e.target.value)}
                        />
                      </>
                    ) : (
                      <em style={{ gridColumn: "3 / -1" }}>Closed</em>
                    )}
                  </div>
                )
              })}
            </div>
          )}
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
              Loading service catalog from server...
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
                No services configured yet for this shop.
              </p>
              <p style={{ color: "var(--muted)", margin: "0 0 16px", fontSize: "10px" }}>
                Add haircuts, shaves, and grooming services so clients can book appointments and enter the walk-in queue.
              </p>
            </div>
          ) : (
            services.map((srv) => (
              <div key={srv.id}>
                <span>
                  <strong>{srv.name}</strong>
                  <small>
                    {srv.active
                      ? "Available for online booking & walk-ins"
                      : "Inactive (hidden from booking and queue)"}
                  </small>
                </span>
                <span style={{ fontSize: "11px", color: "var(--muted)", minWidth: "55px" }}>
                  {srv.duration_min} min
                </span>
                <strong style={{ fontSize: "11px", minWidth: "90px" }}>
                  {formatRupiah(srv.price)}
                </strong>
                <Badge tone={srv.active ? "success" : "neutral"}>
                  {srv.active ? "Active" : "Inactive"}
                </Badge>
                <button
                  type="button"
                  className="icon-button mini"
                  aria-label={`Edit ${srv.name}`}
                  title="Edit service details"
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
            <span>+ Add service</span>
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
              Loading staff directory from server...
            </div>
          ) : staffList.length === 0 && !staffError ? (
            <div style={{ padding: "36px 16px", textAlign: "center", borderBottom: "1px solid var(--line)" }}>
              <p style={{ color: "var(--muted)", margin: "0 0 12px", fontSize: "12px" }}>
                No staff members configured yet.
              </p>
            </div>
          ) : (
            staffList.map((st) => {
              const initials = getInitials(st.name)
              const rateLabel =
                st.commission_bps != null ? `${st.commission_bps / 100}% commission` : "Standard rate"

              return (
                <div key={st.id}>
                  <span className="client-cell">
                    <span className="avatar small">{initials}</span>
                    <span>
                      <strong>{st.name}</strong>
                      <small>{st.contact || (st.active ? "Active account" : "Inactive account")}</small>
                    </span>
                  </span>
                  <span style={{ fontSize: "11px", color: "var(--muted)" }}>{rateLabel}</span>
                  <Badge tone={st.active ? "success" : "neutral"}>
                    {st.active ? "Active" : "Inactive"}
                  </Badge>
                  <button
                    type="button"
                    className="filter-button"
                    onClick={() => {
                      setStaffToEdit(st)
                      setIsStaffModalOpen(true)
                    }}
                  >
                    Manage
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
            <span>+ Add staff member</span>
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

      {/* --- Notifications (Unchanged) --- */}
      {section === "Notifications" && (
        <div className="notification-settings">
          {[
            [
              "Appointment confirmations",
              "Sent immediately after a new booking",
            ],
            ["24-hour reminders", "Reduce no-shows with an automatic reminder"],
            [
              "Queue status updates",
              "Notify walk-ins when their chair is almost ready",
            ],
            [
              "Daily owner summary",
              "Revenue and operations summary at closing",
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

      {/* --- Billing (Unchanged) --- */}
      {section === "Billing" && (
        <div className="billing-panel">
          <div>
            <Badge tone="success">Active plan</Badge>
            <h3>Professional</h3>
            <p>Up to 10 staff members · Unlimited appointments</p>
            <strong>
              $79 <small>/ month</small>
            </strong>
            <button className="filter-button">Change plan</button>
          </div>
          <div>
            <span className="section-index">PAYMENT METHOD</span>
            <p>
              <strong>Visa ending in 4242</strong>
              <br />
              Expires 08/27
            </p>
            <button className="filter-button">Update card</button>
          </div>
          <div>
            <span className="section-index">LATEST INVOICE</span>
            <p>
              <strong>May 1, 2025</strong>
              <br />
              $79.00 · Paid
            </p>
            <button className="filter-button">Download PDF</button>
          </div>
        </div>
      )}

      {/* --- Payroll & Compensation Defaults --- */}
      {section === "Payroll & Compensation" && (
        <div className="form-grid">
          <label className="full">
            <span>DEFAULT COMPENSATION MODEL FOR NEW BARBERS</span>
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
              <option value="commission">Commission per completed service</option>
              <option value="salary">Fixed monthly salary</option>
              <option value="hybrid">Base salary plus commission</option>
            </select>
          </label>

          {(payrollSettings.default_model === "commission" ||
            payrollSettings.default_model === "hybrid") && (
            <>
              <label>
                <span>COMMISSION CALCULATION METHOD</span>
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
                  <option value="percentage">Percentage of service price (%)</option>
                  <option value="fixed">Fixed amount per completed service (Rp)</option>
                </select>
              </label>

              {payrollSettings.default_commission_type === "percentage" ? (
                <label>
                  <span>DEFAULT COMMISSION RATE (%)</span>
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
                  <span>FIXED COMMISSION AMOUNT (RP)</span>
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
              <span>DEFAULT MONTHLY BASE SALARY (RP)</span>
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
            <span>DEFAULT TIPS POLICY</span>
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
              <option value="direct">Direct tips (100% to serving barber)</option>
              <option value="pooled">Pooled / shop-wide tips</option>
            </select>
          </label>

          <p className="full" style={{ fontSize: "11px", color: "var(--muted)", margin: "4px 0 0" }}>
            * Note: These settings are used as initial defaults when creating new barbers. Existing barbers' compensation agreements remain untouched.
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
            ? "Saving shop profile..."
            : isShopDirty
            ? "Save changes *"
            : "Profile saved"}
        </button>
      )}

      {section === "Hours & availability" && (
        <button
          type="button"
          className="primary-button settings-save"
          onClick={handleSaveHours}
          disabled={isSavingHours || !isHoursDirty}
        >
          {isSavingHours
            ? "Saving hours..."
            : isHoursDirty
            ? "Save changes *"
            : "Hours saved"}
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
            ? "Saving defaults..."
            : isPayrollDirty
            ? "Save changes *"
            : "Defaults saved"}
        </button>
      )}

      {section !== "Billing" &&
        section !== "Shop profile" &&
        section !== "Hours & availability" &&
        section !== "Services & pricing" &&
        section !== "Payroll & Compensation" && (
          <button className="primary-button settings-save">Save changes</button>
        )}

      {toastMessage && <Toast message={toastMessage} />}
    </section>
  )
}
