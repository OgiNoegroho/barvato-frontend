import React, { useState, useEffect, useMemo } from "react"
import {
  servicesApi,
  staffApi,
  customersApi,
  queueApi,
  appointmentApi,
  shopApi,
  ApiError,
  type ServiceItem,
  type StaffItem,
  type CustomerItem,
  type StaffAvailabilityItem,
} from "../lib/api"
import {
  formatRupiah,
  getDateStringInTimezone,
  getIsoWithTimezone,
} from "../lib/format"
import { Icon } from "./ui/Icon"
import { Button } from "./ui/Button"
import { useI18n } from "../lib/i18n"
import { useToast } from "../hooks/useToast"

interface BookingModalProps {
  kind: "appointment" | "walkin"
  initialDate?: string
  initialStaffId?: number
  excludeAppointmentId?: number
  timezone?: string
  onClose: () => void
  onSuccess: (message: string) => void
}

export function BookingModal({
  kind,
  initialDate,
  initialStaffId,
  excludeAppointmentId,
  timezone = "Asia/Jakarta",
  onClose,
  onSuccess,
}: BookingModalProps) {
  const { t, language } = useI18n()
  const toast = useToast()
  const isWalkin = kind === "walkin"

  // Catalog state
  const [services, setServices] = useState<ServiceItem[]>([])
  const [staff, setStaff] = useState<StaffItem[]>([])
  const [customers, setCustomers] = useState<CustomerItem[]>([])
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(true)

  // Shop timezone state
  const [shopTimezone, setShopTimezone] = useState(timezone)

  // Form state
  const [customerName, setCustomerName] = useState("")
  const [customerPhone, setCustomerPhone] = useState("")
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null)
  const [selectedServiceId, setSelectedServiceId] = useState<number | "">("")
  const [selectedStaffId, setSelectedStaffId] = useState<number | "">(initialStaffId ?? "")

  // Date & Time state (for appointments)
  const todayStr = useMemo(
    () => getDateStringInTimezone(new Date(), shopTimezone),
    [shopTimezone]
  )
  const [appointmentDate, setAppointmentDate] = useState(
    () => initialDate || getDateStringInTimezone(new Date(), shopTimezone)
  )
  const [appointmentTime, setAppointmentTime] = useState("10:00")

  // Availability state
  const [availabilityList, setAvailabilityList] = useState<StaffAvailabilityItem[]>([])
  const [isLoadingAvailability, setIsLoadingAvailability] = useState(false)
  const [availabilityError, setAvailabilityError] = useState<string | null>(null)

  // Submission & Conflict state
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [conflictPrompt, setConflictPrompt] = useState<string | null>(null)

  // Fetch shop timezone on mount
  useEffect(() => {
    shopApi
      .get()
      .then((res) => {
        if (res?.shop?.timezone) {
          setShopTimezone(res.shop.timezone)
        }
      })
      .catch(() => { })
  }, [])

  // Sync prop changes
  useEffect(() => {
    if (initialDate) {
      setAppointmentDate(initialDate)
    }
  }, [initialDate])

  useEffect(() => {
    if (initialStaffId) {
      setSelectedStaffId(initialStaffId)
    }
  }, [initialStaffId])

  // Load catalog data
  useEffect(() => {
    let mounted = true
    async function loadCatalog() {
      setIsLoadingCatalog(true)
      try {
        const [servicesRes, staffRes, customersRes] = await Promise.all([
          servicesApi.list(true).catch(() => ({ services: [] })),
          staffApi.list(false).catch(() => ({ staff: [] })),
          customersApi.list("").catch(() => ({ customers: [] })),
        ])

        if (!mounted) return
        const activeServices = servicesRes.services || []
        const staffList = staffRes.staff || []
        setServices(activeServices)
        setStaff(staffList)
        setCustomers(customersRes.customers || [])

        if (activeServices.length > 0) {
          setSelectedServiceId(activeServices[0].id)
        }
        if (initialStaffId) {
          setSelectedStaffId(initialStaffId)
        } else if (!isWalkin && staffList.length > 0) {
          const firstActive = staffList.find((s) => s.active)
          if (firstActive) {
            setSelectedStaffId(firstActive.id)
          }
        }
      } finally {
        if (mounted) setIsLoadingCatalog(false)
      }
    }

    loadCatalog()
    return () => {
      mounted = false
    }
  }, [initialStaffId, isWalkin])

  // Recalculate dynamic barber availability whenever relevant form inputs change
  useEffect(() => {
    if (services.length === 0) return

    const controller = new AbortController()

    async function checkAvailability() {
      setIsLoadingAvailability(true)
      setAvailabilityError(null)

      try {
        let startsAt = ""
        if (isWalkin) {
          startsAt = new Date().toISOString()
        } else {
          startsAt = getIsoWithTimezone(appointmentDate, appointmentTime, shopTimezone)
        }

        const selectedService = services.find((s) => s.id === Number(selectedServiceId))
        const duration = selectedService?.duration_min || 30

        const res = await staffApi.getAvailability(
          {
            starts_at: startsAt,
            duration_min: duration,
            exclude_appointment_id: excludeAppointmentId,
            kind: isWalkin ? "walkin" : "appointment",
          },
          controller.signal
        )

        const list = res.availability || []
        setAvailabilityList(list)

        // Auto-select first available active barber for appointments if none selected
        if (!isWalkin) {
          setSelectedStaffId((current) => {
            if (current) return current
            const firstAvail = list.find((a) => a.available)
            if (firstAvail) return firstAvail.staff_id
            const firstActive = services.length > 0 ? staff.find((s) => s.active) : undefined
            return firstActive ? firstActive.id : ""
          })
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") {
          return
        }
        setAvailabilityError("Failed to check barber availability for the selected time.")
      } finally {
        setIsLoadingAvailability(false)
      }
    }

    checkAvailability()

    return () => {
      controller.abort()
    }
  }, [
    isWalkin,
    appointmentDate,
    appointmentTime,
    selectedServiceId,
    shopTimezone,
    excludeAppointmentId,
    services,
    staff,
  ])

  // Lookup the currently selected barber's availability status
  const selectedStaffAvailability = useMemo(() => {
    if (!selectedStaffId) return null
    return availabilityList.find((a) => a.staff_id === Number(selectedStaffId)) || null
  }, [selectedStaffId, availabilityList])

  // Check if the shop itself is closed or outside operating hours across all kapsters
  const shopClosedReason = useMemo(() => {
    if (availabilityList.length === 0) return null
    const allUnavailable = availabilityList.every(
      (a) =>
        !a.available &&
        (a.reason?.toLowerCase().includes("shop closed") ||
          a.reason?.toLowerCase().includes("day off") ||
          a.status === "outside_working_hours")
    )
    if (allUnavailable && availabilityList.length > 0) {
      const first = availabilityList[0]
      if (first.reason?.toLowerCase().includes("shop closed")) {
        return first.reason
      }
      if (first.status === "outside_working_hours") {
        return language === "id" ? "di luar jam operasional toko" : "outside shop operating hours"
      }
      if (first.reason?.toLowerCase().includes("day off")) {
        return language === "id" ? "toko tutup (hari libur)" : "shop closed (day off)"
      }
    }
    return null
  }, [availabilityList, language])

  // Formatted validation message when selected barber is busy or unavailable
  const staffValidationMessage = useMemo(() => {
    if (shopClosedReason) {
      return t("booking.shopClosedError", { reason: shopClosedReason })
    }
    if (!selectedStaffId && !isWalkin) {
      return language === "id"
        ? "Silakan pilih kapster untuk janji temu ini."
        : "Please select an assigned barber for this appointment."
    }
    if (!selectedStaffAvailability) return null
    if (selectedStaffAvailability.available) return null

    if (selectedStaffAvailability.conflict_type === "appointment") {
      const start = selectedStaffAvailability.conflict_start || ""
      const end = selectedStaffAvailability.conflict_end || ""
      return language === "id"
        ? `${selectedStaffAvailability.name} sudah memiliki janji temu pukul ${start}–${end}. Pilih kapster lain atau ubah waktu.`
        : `${selectedStaffAvailability.name} already has an appointment from ${start} to ${end}. Choose another barber or change the time.`
    }
    if (selectedStaffAvailability.conflict_type === "walkin") {
      return language === "id"
        ? `${selectedStaffAvailability.name} sedang melayani pelanggan lain. Jadwal bentrok ini dapat diabaikan jika Anda tetap ingin menjadwalkan.`
        : `${selectedStaffAvailability.name} is currently serving another customer. You can override and proceed if desired.`
    }
    if (selectedStaffAvailability.status === "outside_working_hours") {
      return t("booking.staffOutsideHoursError")
    }
    if (selectedStaffAvailability.status === "unavailable") {
      return t("booking.staffUnavailableError", {
        name: selectedStaffAvailability.name,
        reason: selectedStaffAvailability.reason || (language === "id" ? "sedang libur/cuti" : "day off"),
      })
    }
    return t("booking.staffUnavailableError", {
      name: selectedStaffAvailability.name,
      reason: selectedStaffAvailability.reason || (language === "id" ? "tidak tersedia" : "unavailable"),
    })
  }, [selectedStaffId, isWalkin, selectedStaffAvailability, shopClosedReason, t, language])

  const handleSelectCustomer = (c: CustomerItem) => {
    setSelectedCustomerId(c.id)
    setCustomerName(c.name)
    setCustomerPhone(c.phone || "")
  }

  const isPastDate = useMemo(() => {
    if (isWalkin) return false
    return appointmentDate < todayStr
  }, [isWalkin, appointmentDate, todayStr])

  const isSubmitDisabled =
    isSubmitting ||
    isLoadingCatalog ||
    isLoadingAvailability ||
    Boolean(shopClosedReason) ||
    !customerName.trim() ||
    !selectedServiceId ||
    (!isWalkin && (!selectedStaffId || !appointmentDate || !appointmentTime)) ||
    Boolean(
      selectedStaffAvailability &&
      !selectedStaffAvailability.available &&
      selectedStaffAvailability.conflict_type !== "walkin" &&
      selectedStaffId !== initialStaffId
    )

  const handleSubmit = async (e: React.FormEvent, override = false) => {
    e.preventDefault()
    if (isSubmitting) return

    const trimmedName = customerName.trim()
    const trimmedPhone = customerPhone.trim()

    if (!trimmedName) {
      setErrorMessage(
        language === "id" ? "Nama pelanggan wajib diisi." : "Customer name is required."
      )
      return
    }

    if (!selectedServiceId) {
      setErrorMessage(
        language === "id" ? "Silakan pilih layanan." : "Please select a service."
      )
      return
    }

    if (!isWalkin && !selectedStaffId) {
      setErrorMessage(
        language === "id"
          ? "Silakan pilih kapster untuk janji temu ini."
          : "Please select an assigned barber for this appointment."
      )
      return
    }

    if (shopClosedReason) {
      setErrorMessage(t("booking.shopClosedError", { reason: shopClosedReason }))
      return
    }

    if (
      !override &&
      selectedStaffAvailability &&
      !selectedStaffAvailability.available &&
      selectedStaffAvailability.conflict_type !== "walkin" &&
      selectedStaffId !== initialStaffId
    ) {
      setErrorMessage(
        staffValidationMessage ||
        (language === "id"
          ? "Kapster yang dipilih tidak tersedia pada waktu ini."
          : "The selected barber is not available at this time.")
      )
      return
    }

    setIsSubmitting(true)
    setErrorMessage(null)
    setConflictPrompt(null)

    try {
      // 1. Resolve or create customer if needed
      let customerId = selectedCustomerId
      if (!customerId) {
        const existing = customers.find(
          (c) =>
            c.name.toLowerCase() === trimmedName.toLowerCase() ||
            (trimmedPhone && c.phone === trimmedPhone)
        )
        if (existing) {
          customerId = existing.id
        } else {
          try {
            const newCust = await customersApi.create({
              name: trimmedName,
              phone: trimmedPhone || undefined,
            })
            customerId = newCust.customer.id
          } catch (err: unknown) {
            if (!isWalkin) {
              const errMsg =
                err instanceof ApiError
                  ? err.message
                  : language === "id"
                    ? "Gagal mendaftarkan pelanggan. Periksa data pelanggan."
                    : "Failed to register customer record. Please check customer details."
              throw new Error(errMsg)
            }
          }
        }
      }

      // 2. Submit Walk-in or Appointment
      if (isWalkin) {
        await queueApi.create({
          customer_name: trimmedName,
          customer_id: customerId,
          service_id: Number(selectedServiceId),
          assigned_staff_id: selectedStaffId ? Number(selectedStaffId) : null,
        })
        const msg =
          language === "id"
            ? `${trimmedName} ditambahkan ke antrean walk-in`
            : `${trimmedName} added to walk-in queue`
        toast.success(msg)
        window.dispatchEvent(new CustomEvent("barvato:refresh-data"))
        onSuccess(msg)
        onClose()
      } else {
        const startsAt = getIsoWithTimezone(appointmentDate, appointmentTime, shopTimezone)

        if (!customerId) {
          throw new Error(
            language === "id"
              ? "Data pelanggan diperlukan untuk menjadwalkan janji temu."
              : "A customer record is required to schedule an appointment."
          )
        }

        await appointmentApi.create({
          customer_id: customerId,
          staff_id: Number(selectedStaffId),
          service_id: Number(selectedServiceId),
          starts_at: startsAt,
          override,
        })
        const msg =
          language === "id"
            ? `Janji temu berhasil dibuat untuk ${trimmedName} pukul ${appointmentTime}`
            : `Appointment booked for ${trimmedName} at ${appointmentTime}`
        toast.success(msg)
        window.dispatchEvent(new CustomEvent("barvato:refresh-data"))
        onSuccess(msg)
        onClose()
      }
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.isConflict) {
          if (err.code === "shop_closed") {
            const msg = t("booking.shopClosedError", { reason: err.message })
            setErrorMessage(msg)
            toast.error(msg)
            return
          }
          if (err.code === "staff_unavailable") {
            setErrorMessage(err.message)
            toast.error(err.message)
            return
          }
          if (err.code === "schedule_conflict") {
            setConflictPrompt(t("booking.conflictScheduleWarning"))
            return
          }
          if (err.code === "appointment_overlap") {
            const msg = t("booking.conflictAppointmentOverlap")
            setErrorMessage(msg)
            toast.error(msg)
            return
          }
          if (err.code === "barber_busy") {
            const msg = err.message || t("booking.conflictBarberBusy")
            setErrorMessage(msg)
            toast.error(msg)
            return
          }
        }
        const msg = err.message || t("common.error")
        setErrorMessage(msg)
        toast.error(msg)
      } else {
        const msg = err instanceof Error ? err.message : t("common.error")
        setErrorMessage(msg)
        toast.error(msg)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  // Barbers to display in dropdown (using dynamic availability if loaded, falling back to staff list)
  const displayedBarbers = availabilityList.length > 0 ? availabilityList : staff

  return (
    <div className="modal-backdrop fixed inset-0 z-modal bg-charcoal/70 backdrop-blur-[1px] grid place-items-center p-4 overflow-y-auto" onMouseDown={onClose}>
      <div
        className="modal w-full max-w-lg bg-ivory-paper border border-stone-line shadow-2xl p-6 rounded-sm text-charcoal-ink my-auto"
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className="modal-head flex items-start justify-between gap-4 mb-4">
          <div>
            <span className="section-index text-[10px] uppercase tracking-wider text-charcoal-muted font-bold block mb-0.5">
              {isWalkin
                ? language === "id"
                  ? "ANTREAN WALK-IN"
                  : "WALK-IN QUEUE"
                : language === "id"
                  ? "RESERVASI JANJI TEMU"
                  : "APPOINTMENT BOOKING"}
            </span>
            <h2 id="modal-title" className="font-serif text-2xl text-charcoal-ink">
              {isWalkin ? t("booking.titleWalkin") : t("booking.titleAppointment")}
            </h2>
          </div>
          <button
            type="button"
            className="icon-button text-charcoal-muted hover:text-charcoal-ink p-1 rounded-sm text-2xl leading-none"
            onClick={onClose}
            aria-label={t("common.close")}
          >
            ×
          </button>
        </div>

        {isPastDate && (
          <div className="bg-stone-100 border border-stone-line p-2.5 rounded-sm mb-4 text-xs text-charcoal-muted">
            ℹ️ <strong>{language === "id" ? "Tanggal lampau dipilih:" : "Historical date selected:"}</strong>{" "}
            {language === "id"
              ? `Janji temu ini dijadwalkan untuk tanggal yang telah lewat (${appointmentDate}). Pemeriksaan bentrok jadwal tetap berlaku.`
              : `This appointment is scheduled for a past date (${appointmentDate}). Existing overlap and barber availability checks will still apply.`}
          </div>
        )}

        {errorMessage && (
          <div className="login-error-alert p-3 bg-red-50/80 border border-red-200 text-danger text-xs rounded-sm flex items-center gap-2 mb-4" role="alert">
            <Icon name="bell" size={16} />
            <span>{errorMessage}</span>
          </div>
        )}

        {conflictPrompt && (
          <div className="bg-amber-50/80 border border-amber-200 p-3.5 rounded-sm mb-4">
            <p className="m-0 mb-3 text-xs text-amber leading-relaxed">
              <strong>{language === "id" ? "Bentrok Terdeteksi:" : "Overlap Detected:"}</strong> {conflictPrompt}
            </p>
            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setConflictPrompt(null)}
              >
                {t("common.cancel")}
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={(e) => handleSubmit(e, true)}
                disabled={isSubmitting}
              >
                {language === "id" ? "Tetap Jadwalkan (Abaikan)" : "Override & Book"}
              </Button>
            </div>
          </div>
        )}

        <form onSubmit={(e) => handleSubmit(e, false)}>
          <div className="form-grid grid grid-cols-1 sm:grid-cols-2 gap-3.5 mb-4">
            <label className="full sm:col-span-2 flex flex-col gap-1 text-xs font-semibold text-charcoal-ink">
              {t("booking.clientName")}
              <input
                autoFocus
                placeholder={
                  language === "id"
                    ? "Masukkan nama lengkap (cth. Budi Santoso)"
                    : "Enter full name (e.g. Budi Santoso)"
                }
                value={customerName}
                onChange={(e) => {
                  setCustomerName(e.target.value)
                  setSelectedCustomerId(null)
                }}
                required
                className="w-full border border-stone-line bg-white px-3 py-2 text-xs rounded-sm text-charcoal-ink focus:outline-none focus:border-copper"
              />
            </label>

            {/* Quick customer matches */}
            {customerName.length >= 2 && !selectedCustomerId && (
              <div className="full sm:col-span-2 max-h-24 overflow-y-auto border border-stone-line bg-stone-50 p-2 rounded-sm -mt-2 mb-2">
                <small className="block text-charcoal-muted text-[10px] mb-1">
                  {language === "id"
                    ? "Pelanggan Terdaftar (Klik untuk isi otomatis):"
                    : "Existing Clients (Click to auto-fill):"}
                </small>
                {customers
                  .filter((c) => c.name.toLowerCase().includes(customerName.toLowerCase()))
                  .slice(0, 3)
                  .map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => handleSelectCustomer(c)}
                      className="block w-full text-left py-1 px-1.5 hover:bg-stone-200/60 text-xs rounded-xs transition-colors"
                    >
                      <strong className="text-charcoal-ink font-semibold">{c.name}</strong> {c.phone ? `(${c.phone})` : ""}
                    </button>
                  ))}
              </div>
            )}

            <label className="full sm:col-span-2 flex flex-col gap-1 text-xs font-semibold text-charcoal-ink">
              {t("booking.clientPhone")}
              <input
                placeholder={language === "id" ? "cth. 08123456789 atau +628123456789" : "e.g. 08123456789 or +628123456789"}
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="w-full border border-stone-line bg-white px-3 py-2 text-xs rounded-sm text-charcoal-ink focus:outline-none focus:border-copper"
              />
            </label>

            <label className="full sm:col-span-2 flex flex-col gap-1 text-xs font-semibold text-charcoal-ink">
              {t("booking.selectServices")}
              <select
                value={selectedServiceId}
                onChange={(e) => setSelectedServiceId(Number(e.target.value))}
                required
                className="w-full border border-stone-line bg-white px-3 py-2 text-xs rounded-sm text-charcoal-ink focus:outline-none focus:border-copper"
              >
                {services.length === 0 ? (
                  <option value="">
                    {language === "id" ? "Tidak ada layanan aktif" : "No active services configured"}
                  </option>
                ) : (
                  services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.duration_min} {t("common.minutes")}) · {formatRupiah(s.price)}
                    </option>
                  ))
                )}
              </select>
            </label>

            {!isWalkin && (
              <>
                <label className="flex flex-col gap-1 text-xs font-semibold text-charcoal-ink">
                  {t("booking.date")}
                  <input
                    type="date"
                    value={appointmentDate}
                    onChange={(e) => setAppointmentDate(e.target.value)}
                    required
                    className="w-full border border-stone-line bg-white px-3 py-2 text-xs rounded-sm text-charcoal-ink focus:outline-none focus:border-copper"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs font-semibold text-charcoal-ink">
                  {t("booking.time")}
                  <input
                    type="time"
                    value={appointmentTime}
                    onChange={(e) => setAppointmentTime(e.target.value)}
                    required
                    className="w-full border border-stone-line bg-white px-3 py-2 text-xs rounded-sm text-charcoal-ink focus:outline-none focus:border-copper"
                  />
                </label>
              </>
            )}

            <label className="full sm:col-span-2 flex flex-col gap-1 text-xs font-semibold text-charcoal-ink">
              {t("booking.barber")}
              <select
                value={selectedStaffId}
                onChange={(e) =>
                  setSelectedStaffId(e.target.value === "" ? "" : Number(e.target.value))
                }
                required={!isWalkin}
                className="w-full border border-stone-line bg-white px-3 py-2 text-xs rounded-sm text-charcoal-ink focus:outline-none focus:border-copper"
              >
                {isWalkin ? (
                  <option value="">{t("booking.anyBarber")}</option>
                ) : (
                  <option value="" disabled>
                    -- {t("booking.barber")} --
                  </option>
                )}
                {displayedBarbers.map((b) => {
                  const staffId = "staff_id" in b ? b.staff_id : b.id
                  const isAvailable = "available" in b ? b.available : b.active
                  const displayLabel =
                    "display_label" in b
                      ? b.display_label
                      : b.active
                        ? language === "id"
                          ? "Tersedia"
                          : "Available"
                        : language === "id"
                          ? "Tidak Tersedia"
                          : "Unavailable"

                  return (
                    <option key={staffId} value={staffId} disabled={!b.active}>
                      {b.name} — {displayLabel}
                    </option>
                  )
                })}
              </select>
              {isLoadingAvailability && (
                <small className="text-charcoal-muted text-[11px] mt-1 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full border-2 border-copper border-t-transparent animate-spin inline-block" />{" "}
                  {language === "id" ? "Memeriksa ketersediaan kapster..." : "Checking barber availability..."}
                </small>
              )}
              {availabilityError && (
                <div className="text-danger text-[11px] mt-1">
                  ⚠️ {availabilityError}
                </div>
              )}
              {staffValidationMessage && (
                <div
                  className={`p-2 rounded-sm mt-1.5 text-xs leading-relaxed border ${
                    shopClosedReason
                      ? "bg-red-50/80 border-red-300 text-danger"
                      : "bg-amber-50/80 border-amber-300 text-[#75521e]"
                  }`}
                >
                  ⚠️ {staffValidationMessage}
                </div>
              )}
            </label>
          </div>

          <div className="modal-actions flex justify-end gap-2 pt-3 border-t border-stone-line mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              {t("common.cancel")}
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={isSubmitDisabled}
              isLoading={isSubmitting}
            >
              {isWalkin ? t("booking.confirmWalkin") : t("booking.confirmBooking")}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
