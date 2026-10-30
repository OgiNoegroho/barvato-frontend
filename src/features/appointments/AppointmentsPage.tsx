import React, { useState, useEffect, useCallback, useMemo } from "react"
import {
  appointmentApi,
  shopApi,
  type ApiAppointment,
  ApiError,
} from "../../lib/api"
import { Badge } from "../../components/ui/Badge"
import { Icon } from "../../components/ui/Icon"
import { Button } from "../../components/ui/Button"
import { BookingModal } from "../../components/BookingModal"
import { CheckoutModal } from "../../components/CheckoutModal"
import { AppointmentDrawer } from "../operations/AppointmentDrawer"
import { useToast } from "../../hooks/useToast"
import {
  getInitials,
  formatTimeOnly,
  formatDateHeading,
  getDateStringInTimezone,
} from "../../lib/format"
import { useI18n, type TranslationKey } from "../../lib/i18n"
import { cn } from "../../lib/utils"

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
      .catch(() => { })
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
  const toast = useToast()

  const dateStr = useMemo(
    () => getDateStringInTimezone(currentDate, timezone),
    [currentDate, timezone]
  )

  const loadAppointments = useCallback(async () => {
    setIsLoading(true)
    setErrorMessage(null)

    try {
      const res = await appointmentApi.list(dateStr, dateStr, undefined, true)
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
    const handleRefresh = () => loadAppointments()
    window.addEventListener("barvato:refresh-data", handleRefresh)
    return () => {
      window.removeEventListener("barvato:refresh-data", handleRefresh)
    }
  }, [loadAppointments])

  // Filter appointments locally by status and search query
  const filteredAppointments = useMemo(() => {
    return appointments.filter((a) => {
      if (statusFilter !== "all" && a.status !== statusFilter) {
        return false
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchName = a.customer_name.toLowerCase().includes(q)
        const matchPhone = a.customer_phone?.toLowerCase().includes(q)
        const matchStaff = a.staff_name.toLowerCase().includes(q)
        const matchService = a.service_name.toLowerCase().includes(q)
        const matchId = String(a.id).includes(q)
        return matchName || matchPhone || matchStaff || matchService || matchId
      }
      return true
    })
  }, [appointments, statusFilter, searchQuery])

  // Navigation handlers
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
      toast.success(`${appt.customer_name} checked in`)
      setSelectedAppointment(null)
      loadAppointments()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to check in"
      toast.error(msg)
    }
  }

  const handleCancel = async (appt: ApiAppointment) => {
    try {
      await appointmentApi.cancel(appt.id)
      toast.success(`Appointment for ${appt.customer_name} cancelled`)
      setSelectedAppointment(null)
      loadAppointments()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to cancel"
      toast.error(msg)
    }
  }

  const handleNoShow = async (appt: ApiAppointment) => {
    try {
      await appointmentApi.noShow(appt.id)
      toast.success(`Appointment for ${appt.customer_name} marked as no-show`)
      setSelectedAppointment(null)
      loadAppointments()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to record no-show"
      toast.error(msg)
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
    try {
      await appointmentApi.complete(checkoutItem.id, { method, tip })
      toast.success(`Payment recorded and appointment completed`)
      setCheckoutItem(null)
      loadAppointments()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to record payment"
      toast.error(msg)
    }
  }

  const dateFormatted = formatDateHeading(
    currentDate,
    timezone,
    language === "id" ? "id-ID" : "en-US"
  )

  const isToday = getDateStringInTimezone(new Date(), timezone) === dateStr

  return (
    <section className="data-section bg-ivory-light border border-stone p-5 sm:p-6 rounded-lg">
      <div className="data-tools flex flex-wrap items-center gap-3 mb-4">
        <div className="search small-search relative flex-1 min-w-[200px]">
          <Icon name="search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-text pointer-events-none" />
          <input
            placeholder={t("appointments.searchPlaceholder")}
            aria-label={t("common.search")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-9 pl-9 pr-3 bg-ivory border border-stone rounded-sm text-xs text-charcoal placeholder:text-muted-text/70 focus:outline-none focus:border-copper"
          />
        </div>

        <select
          className="filter-button h-9 px-3 bg-ivory border border-stone rounded-sm text-xs font-medium text-charcoal focus:border-copper outline-none cursor-pointer"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label={t("common.filter")}
        >
          <option value="all">{t("common.status")}: {t("common.all")}</option>
          <option value="confirmed">{t("status.confirmed")}</option>
          <option value="checked_in">{t("status.checked_in")}</option>
          <option value="completed">{t("status.completed")}</option>
          <option value="cancelled">{t("status.cancelled")}</option>
          <option value="no_show">{t("status.no_show")}</option>
        </select>

        <div className="inline-flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            onClick={handlePrevDay}
            aria-label="Previous day"
            className="w-8 h-9 text-sm"
          >
            ‹
          </Button>

          <button
            type="button"
            className={cn(
              "h-9 px-3 border border-stone text-xs font-medium rounded-sm transition-colors cursor-pointer",
              isToday ? "bg-ivory-warm text-charcoal font-semibold border-stone-muted" : "bg-ivory text-muted-text hover:text-charcoal"
            )}
            onClick={handleToday}
          >
            {isToday ? `${t("operations.today")} (${dateFormatted})` : dateFormatted}
          </button>

          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            onClick={handleNextDay}
            aria-label="Next day"
            className="w-8 h-9 text-sm"
          >
            ›
          </Button>
        </div>

        <Button
          type="button"
          variant="primary"
          onClick={() => setIsBookingModalOpen(true)}
          className="h-9 gap-1.5"
        >
          <Icon name="plus" size={14} /> {t("shell.newBooking")}
        </Button>
      </div>

      {errorMessage && (
        <div
          className="login-error-alert bg-danger-soft border border-danger-line text-danger px-3.5 py-2.5 rounded-sm text-xs flex items-center gap-2 mb-4 leading-normal"
          role="alert"
        >
          <Icon name="bell" size={16} />
          <span className="flex-1">{errorMessage}</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="text-xs h-7 ml-auto"
            onClick={loadAppointments}
          >
            {t("common.retry")}
          </Button>
        </div>
      )}

      <div className="table overflow-x-auto">
        <div className="min-w-[760px]">
          <div className="tr th grid grid-cols-[1.4fr_1.4fr_1.2fr_1.2fr_1fr_40px] gap-3 items-center py-2 border-b border-stone text-2xs uppercase tracking-wider text-muted-text font-bold">
            <span>{t("appointments.colClient")}</span>
            <span>{t("appointments.colServices")}</span>
            <span>{t("appointments.colBarber")}</span>
            <span>{t("appointments.colTime")}</span>
            <span>{t("appointments.colStatus")}</span>
            <span />
          </div>

          {isLoading ? (
            <div className="py-12 text-center text-muted-text text-xs">
              {t("common.loading")}
            </div>
          ) : filteredAppointments.length === 0 ? (
            <div className="py-12 px-4 text-center border-b border-stone">
              <p className="text-xs text-muted-text m-0 mb-3.5">
                {appointments.length === 0
                  ? `${t("appointments.noAppointments")} (${dateFormatted}).`
                  : language === "id"
                    ? "Tidak ada janji temu yang cocok dengan filter pencarian."
                    : "No appointments match your search and filter criteria."}
              </p>
              {appointments.length === 0 && (
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={() => setIsBookingModalOpen(true)}
                >
                  + {t("shell.newBooking")}
                </Button>
              )}
            </div>
          ) : (
            filteredAppointments.map((a) => {
              const initials = getInitials(a.customer_name)
              const startTime = formatTimeOnly(a.starts_at, timezone)
              const endTime = formatTimeOnly(a.ends_at, timezone)

              const statusTone =
                a.status === "completed"
                  ? "neutral"
                  : a.status === "checked_in"
                  ? "success"
                  : a.status === "confirmed"
                  ? "copper"
                  : a.status === "cancelled" || a.status === "no_show"
                  ? "danger"
                  : "warning"

              return (
                <div
                  className="tr grid grid-cols-[1.4fr_1.4fr_1.2fr_1.2fr_1fr_40px] gap-3 items-center py-3 border-b border-stone hover:bg-ivory/50 transition-colors text-xs cursor-pointer"
                  key={a.id}
                  onClick={() => setSelectedAppointment(a)}
                >
                  <div className="client-cell flex items-center gap-2.5 min-w-0">
                    <span className="avatar small w-7 h-7 rounded-full bg-charcoal text-ivory flex items-center justify-center text-2xs font-semibold shrink-0">
                      {initials}
                    </span>
                    <div className="min-w-0">
                      <strong className="block text-xs font-semibold text-charcoal truncate">{a.customer_name}</strong>
                      <small className="block text-2xs text-muted-text truncate">{a.customer_phone || "-"}</small>
                    </div>
                  </div>

                  <div className="min-w-0">
                    <strong className="block text-xs font-medium text-charcoal truncate">{a.service_name}</strong>
                    <small className="block text-2xs text-muted-text">{a.duration_snapshot_min} {language === "id" ? "menit" : "mins"}</small>
                  </div>

                  <div className="min-w-0">
                    <strong className="block text-xs font-medium text-charcoal truncate">{a.staff_name}</strong>
                  </div>

                  <div>
                    <strong className="block text-xs font-medium text-charcoal">{startTime} – {endTime}</strong>
                    <small className="block text-2xs text-muted-text">{a.starts_at.slice(0, 10)}</small>
                  </div>

                  <div>
                    <Badge tone={statusTone} className="capitalize">
                      {t(`status.${a.status}` as TranslationKey)}
                    </Badge>
                  </div>

                  <div className="text-right">
                    <button
                      type="button"
                      className="text-muted-text hover:text-charcoal p-1 rounded hover:bg-stone/20 transition-colors cursor-pointer bg-transparent border-0"
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedAppointment(a)
                      }}
                      aria-label="View appointment details"
                      title="View details"
                    >
                      <Icon name="chevron" size={14} />
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {selectedAppointment && (
        <AppointmentDrawer
          detail={selectedAppointment}
          onClose={() => setSelectedAppointment(null)}
          onCheckIn={handleCheckIn}
          onCancel={handleCancel}
          onNoShow={handleNoShow}
          onComplete={handleInitiateComplete}
        />
      )}

      {isBookingModalOpen && (
        <BookingModal
          kind="appointment"
          initialDate={dateStr}
          onClose={() => setIsBookingModalOpen(false)}
          onSuccess={() => {
            setIsBookingModalOpen(false)
            loadAppointments()
          }}
        />
      )}

      {checkoutItem && (
        <CheckoutModal
          item={checkoutItem}
          onClose={() => setCheckoutItem(null)}
          onConfirm={handleConfirmCheckout}
        />
      )}
    </section>
  )
}
