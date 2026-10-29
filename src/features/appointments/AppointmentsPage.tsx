import React, { useState, useEffect, useCallback, useMemo } from "react"
import {
  appointmentApi,
  shopApi,
  type ApiAppointment,
  ApiError,
} from "../../lib/api"
import { Badge } from "../../components/ui/Badge"
import { Icon } from "../../components/ui/Icon"
import { Toast } from "../../components/layout/Toast"
import { BookingModal } from "../../components/BookingModal"
import { CheckoutModal } from "../../components/CheckoutModal"
import { AppointmentDrawer } from "../operations/AppointmentDrawer"
import { getInitials, formatTimeOnly, getDateStringInTimezone } from "../../lib/format"
import { useI18n, type TranslationKey } from "../../lib/i18n"

export function AppointmentsPage() {
  const { t, language } = useI18n()
  const [currentDate, setCurrentDate] = useState(() => new Date())
  const [timezone, setTimezone] = useState("Asia/Jakarta")
  const [appointments, setAppointments] = useState<ApiAppointment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Fetch shop timezone on mount
  useEffect(() => {
    shopApi
      .get()
      .then((res) => {
        if (res?.shop?.timezone) {
          setTimezone(res.shop.timezone)
        }
      })
      .catch(() => {})
  }, [])

  // Filters
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")

  // Modals & Drawers
  const [selectedAppointment, setSelectedAppointment] = useState<ApiAppointment | null>(null)
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false)
  const [checkoutItem, setCheckoutItem] = useState<{
    id: number
    kind: "appointment"
    customerName: string
    serviceName: string
    price: number
    staffName?: string
  } | null>(null)

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const showToast = useCallback((msg: string) => {
    setToastMessage(msg)
    const timer = setTimeout(() => setToastMessage(null), 3500)
    return () => clearTimeout(timer)
  }, [])

  const dateStr = currentDate.toISOString().split("T")[0]

  const loadAppointments = useCallback(async () => {
    setIsLoading(true)
    setErrorMessage(null)

    const from = `${dateStr}T00:00:00Z`
    const to = `${dateStr}T23:59:59Z`

    try {
      const res = await appointmentApi.list(from, to, undefined, true)
      setAppointments(res.appointments || [])
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message || `Failed to load appointments (${err.code})`)
      } else if (err instanceof Error) {
        setErrorMessage(err.message)
      } else {
        setErrorMessage("Network error loading appointments.")
      }
    } finally {
      setIsLoading(false)
    }
  }, [dateStr])

  useEffect(() => {
    loadAppointments()
  }, [loadAppointments])

  // Filter appointments locally by status and search query
  const filteredAppointments = useMemo(() => {
    return appointments.filter((a) => {
      if (statusFilter !== "all" && a.status !== statusFilter) {
        return false
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchesName = a.customer_name.toLowerCase().includes(q)
        const matchesService = a.service_name.toLowerCase().includes(q)
        const matchesBarber = a.staff_name.toLowerCase().includes(q)
        const matchesPhone = a.customer_phone ? a.customer_phone.toLowerCase().includes(q) : false
        return matchesName || matchesService || matchesBarber || matchesPhone
      }
      return true
    })
  }, [appointments, statusFilter, searchQuery])

  // Date Navigation Handlers
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

  const handleToday = () => {
    setCurrentDate(new Date())
  }

  // Appointment Drawer Actions
  const handleCheckIn = async (appt: ApiAppointment) => {
    try {
      await appointmentApi.checkIn(appt.id)
      showToast(`${appt.customer_name} checked in`)
      setSelectedAppointment(null)
      loadAppointments()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to check in"
      alert(msg)
    }
  }

  const handleCancel = async (appt: ApiAppointment) => {
    try {
      await appointmentApi.cancel(appt.id)
      showToast(`Appointment for ${appt.customer_name} cancelled`)
      setSelectedAppointment(null)
      loadAppointments()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to cancel"
      alert(msg)
    }
  }

  const handleNoShow = async (appt: ApiAppointment) => {
    try {
      await appointmentApi.noShow(appt.id)
      showToast(`Appointment for ${appt.customer_name} marked as no-show`)
      setSelectedAppointment(null)
      loadAppointments()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to record no-show"
      alert(msg)
    }
  }

  const handleInitiateComplete = (appt: ApiAppointment) => {
    setSelectedAppointment(null)
    setCheckoutItem({
      id: appt.id,
      kind: "appointment",
      customerName: appt.customer_name,
      serviceName: appt.service_name,
      price: appt.price_snapshot,
      staffName: appt.staff_name,
    })
  }

  const handleConfirmCheckout = async (method: "cash" | "transfer", tip: number) => {
    if (!checkoutItem) return
    await appointmentApi.complete(checkoutItem.id, { method, tip })
    showToast(`Payment recorded and appointment completed`)
    setCheckoutItem(null)
    loadAppointments()
  }

  const dateFormatted = currentDate.toLocaleDateString(
    language === "id" ? "id-ID" : "en-US",
    {
      weekday: "short",
      month: "short",
      day: "numeric",
    }
  )

  const isToday = new Date().toDateString() === currentDate.toDateString()

  return (
    <section className="data-section">
      <div className="data-tools" style={{ alignItems: "center" }}>
        <div className="search small-search">
          <Icon name="search" size={16} />
          <input
            placeholder={t("appointments.searchPlaceholder")}
            aria-label={t("common.search")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <select
          className="filter-button"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label={t("common.filter")}
          style={{ height: "34px", padding: "0 10px", outline: "none", cursor: "pointer" }}
        >
          <option value="all">{t("common.status")}: {t("common.all")}</option>
          <option value="confirmed">{t("status.confirmed")}</option>
          <option value="checked_in">{t("status.checked_in")}</option>
          <option value="completed">{t("status.completed")}</option>
          <option value="cancelled">{t("status.cancelled")}</option>
          <option value="no_show">{t("status.no_show")}</option>
        </select>

        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <button
            type="button"
            className="filter-button mini"
            onClick={handlePrevDay}
            aria-label="Previous day"
            style={{ width: "28px", height: "34px", textAlign: "center", padding: 0 }}
          >
            ‹
          </button>

          <button
            type="button"
            className={`filter-button ${isToday ? "active" : ""}`}
            onClick={handleToday}
            style={{ height: "34px" }}
          >
            {isToday ? `${t("operations.today")} (${dateFormatted})` : dateFormatted}
          </button>

          <button
            type="button"
            className="filter-button mini"
            onClick={handleNextDay}
            aria-label="Next day"
            style={{ width: "28px", height: "34px", textAlign: "center", padding: 0 }}
          >
            ›
          </button>
        </div>

        <button
          type="button"
          className="primary-button"
          onClick={() => setIsBookingModalOpen(true)}
          style={{ height: "34px", display: "flex", alignItems: "center", gap: "6px" }}
        >
          <Icon name="plus" size={14} /> {t("shell.newBooking")}
        </button>
      </div>

      {errorMessage && (
        <div
          className="login-error-alert"
          role="alert"
          style={{ marginBottom: "16px", color: "var(--red, #cf3c3c)" }}
        >
          <Icon name="bell" size={16} />
          <span>{errorMessage}</span>
          <button
            type="button"
            className="filter-button"
            style={{ marginLeft: "auto", fontSize: "10px" }}
            onClick={loadAppointments}
          >
            {t("common.retry")}
          </button>
        </div>
      )}

      <div className="table">
        <div className="tr th">
          <span>{t("appointments.colClient")}</span>
          <span>{t("appointments.colServices")}</span>
          <span>{t("appointments.colBarber")}</span>
          <span>{t("appointments.colTime")}</span>
          <span>{t("appointments.colStatus")}</span>
          <span />
        </div>

        {isLoading ? (
          <div style={{ padding: "48px 0", textAlign: "center", color: "var(--muted)", fontSize: "12px" }}>
            {t("common.loading")}
          </div>
        ) : filteredAppointments.length === 0 ? (
          <div style={{ padding: "48px 16px", textAlign: "center", borderBottom: "1px solid var(--line)" }}>
            <p style={{ color: "var(--muted)", fontSize: "12px", margin: "0 0 14px" }}>
              {appointments.length === 0
                ? `${t("appointments.noAppointments")} (${dateFormatted}).`
                : language === "id"
                ? "Tidak ada janji temu yang cocok dengan filter pencarian."
                : "No appointments match your search and filter criteria."}
            </p>
            {appointments.length === 0 && (
              <button
                type="button"
                className="primary-button mini"
                onClick={() => setIsBookingModalOpen(true)}
              >
                + {t("shell.newBooking")}
              </button>
            )}
          </div>
        ) : (
          filteredAppointments.map((a) => {
            const initials = getInitials(a.customer_name)
            const startTime = formatTimeOnly(a.starts_at)
            const endTime = formatTimeOnly(a.ends_at)

            const badgeTone =
              a.status === "completed"
                ? "neutral"
                : a.status === "checked_in"
                  ? "forest"
                  : a.status === "confirmed"
                    ? "success"
                    : a.status === "cancelled"
                      ? "danger"
                      : "warning"

            const statusKey = `status.${a.status}` as TranslationKey
            const statusLabel = t(statusKey)

            return (
              <div
                className="tr"
                key={a.id}
                onClick={() => setSelectedAppointment(a)}
                style={{ cursor: "pointer" }}
              >
                <span className="client-cell">
                  <span className="avatar small">{initials}</span>
                  <div>
                    <strong style={{ display: "block" }}>{a.customer_name}</strong>
                    {a.customer_phone && (
                      <small style={{ color: "var(--muted)", fontSize: "8px" }}>
                        {a.customer_phone}
                      </small>
                    )}
                  </div>
                </span>
                <span>{a.service_name}</span>
                <span>{a.staff_name}</span>
                <span>
                  {startTime} – {endTime}
                </span>
                <span>
                  <Badge tone={badgeTone}>{statusLabel}</Badge>
                </span>
                <button
                  type="button"
                  className="icon-button mini"
                  aria-label="View appointment details"
                  onClick={(e) => {
                    e.stopPropagation()
                    setSelectedAppointment(a)
                  }}
                >
                  <Icon name="more" />
                </button>
              </div>
            )
          })
        )}
      </div>

      {/* Appointment Drawer */}
      {selectedAppointment && (
        <AppointmentDrawer
          detail={selectedAppointment}
          onClose={() => setSelectedAppointment(null)}
          onCheckIn={handleCheckIn}
          onComplete={handleInitiateComplete}
          onCancel={handleCancel}
          onNoShow={handleNoShow}
        />
      )}

      {/* Checkout Modal */}
      {checkoutItem && (
        <CheckoutModal
          item={checkoutItem}
          onClose={() => setCheckoutItem(null)}
          onConfirm={handleConfirmCheckout}
        />
      )}

      {/* Booking Modal */}
      {isBookingModalOpen && (
        <BookingModal
          kind="appointment"
          initialDate={getDateStringInTimezone(currentDate, timezone)}
          timezone={timezone}
          onClose={() => setIsBookingModalOpen(false)}
          onSuccess={(msg) => {
            showToast(msg)
            loadAppointments()
          }}
        />
      )}

      {toastMessage && <Toast message={toastMessage} />}
    </section>
  )
}
