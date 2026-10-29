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
import { formatRupiah, getIsoWithTimezone } from "../lib/format"
import { Icon } from "./ui/Icon"
import { useI18n } from "../lib/i18n"

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
  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], [])
  const [appointmentDate, setAppointmentDate] = useState(initialDate || todayStr)
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
      .catch(() => {})
  }, [])

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
        }
      } finally {
        if (mounted) setIsLoadingCatalog(false)
      }
    }

    loadCatalog()
    return () => {
      mounted = false
    }
  }, [initialStaffId])

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

        setAvailabilityList(res.availability || [])
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
  ])

  // Lookup the currently selected barber's availability status
  const selectedStaffAvailability = useMemo(() => {
    if (!selectedStaffId) return null
    return availabilityList.find((a) => a.staff_id === Number(selectedStaffId)) || null
  }, [selectedStaffId, availabilityList])

  // Check if the shop itself is closed at the selected time across all kapsters
  const shopClosedReason = useMemo(() => {
    if (availabilityList.length === 0) return null
    const first = availabilityList[0]
    if (!first.available && first.reason && first.reason.toLowerCase().startsWith("shop closed")) {
      return first.reason
    }
    return null
  }, [availabilityList])

  // Formatted validation message when selected barber is busy or unavailable
  const staffValidationMessage = useMemo(() => {
    if (shopClosedReason) {
      return t("booking.shopClosedError", { reason: shopClosedReason })
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
        ? `${selectedStaffAvailability.name} sedang melayani pelanggan lain. Pilih kapster lain atau ubah waktu.`
        : `${selectedStaffAvailability.name} is currently serving another customer. Choose another barber or change the time.`
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
  }, [selectedStaffAvailability, shopClosedReason, t, language])

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
    Boolean(shopClosedReason) ||
    !customerName.trim() ||
    !selectedServiceId ||
    (!isWalkin && !selectedStaffId) ||
    Boolean(
      selectedStaffAvailability &&
        !selectedStaffAvailability.available &&
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
          } catch {
            if (!isWalkin) {
              throw new Error(
                language === "id"
                  ? "Gagal mendaftarkan pelanggan. Periksa format nomor telepon."
                  : "Failed to register customer record. Please check phone format."
              )
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
        onSuccess(
          language === "id"
            ? `${trimmedName} ditambahkan ke antrean walk-in`
            : `${trimmedName} added to walk-in queue`
        )
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
        onSuccess(
          language === "id"
            ? `Janji temu berhasil dibuat untuk ${trimmedName} pukul ${appointmentTime}`
            : `Appointment booked for ${trimmedName} at ${appointmentTime}`
        )
        onClose()
      }
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.isConflict) {
          if (err.code === "shop_closed") {
            setErrorMessage(
              t("booking.shopClosedError", { reason: err.message })
            )
            return
          }
          if (err.code === "staff_unavailable") {
            setErrorMessage(err.message)
            return
          }
          if (err.code === "schedule_conflict") {
            setConflictPrompt(t("booking.conflictScheduleWarning"))
            return
          }
          if (err.code === "appointment_overlap") {
            setErrorMessage(t("booking.conflictAppointmentOverlap"))
            return
          }
          if (err.code === "barber_busy") {
            setErrorMessage(err.message || t("booking.conflictBarberBusy"))
            return
          }
        }
        setErrorMessage(err.message || t("common.error"))
      } else {
        setErrorMessage(err instanceof Error ? err.message : t("common.error"))
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  // Barbers to display in dropdown (using dynamic availability if loaded, falling back to staff list)
  const displayedBarbers = availabilityList.length > 0 ? availabilityList : staff

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className="modal"
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className="modal-head">
          <div>
            <span className="section-index">
              {isWalkin
                ? language === "id"
                  ? "ANTREAN WALK-IN"
                  : "WALK-IN QUEUE"
                : language === "id"
                ? "RESERVASI JANJI TEMU"
                : "APPOINTMENT BOOKING"}
            </span>
            <h2 id="modal-title">
              {isWalkin ? t("booking.titleWalkin") : t("booking.titleAppointment")}
            </h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label={t("common.close")}>
            ×
          </button>
        </div>

        {isPastDate && (
          <div
            style={{
              background: "#f7f7f5",
              border: "1px solid #e2e0d8",
              padding: "8px 12px",
              borderRadius: "4px",
              marginBottom: "16px",
              fontSize: "11px",
              color: "#555",
            }}
          >
            ℹ️ <strong>{language === "id" ? "Tanggal lampau dipilih:" : "Historical date selected:"}</strong>{" "}
            {language === "id"
              ? `Janji temu ini dijadwalkan untuk tanggal yang telah lewat (${appointmentDate}). Pemeriksaan bentrok jadwal tetap berlaku.`
              : `This appointment is scheduled for a past date (${appointmentDate}). Existing overlap and barber availability checks will still apply.`}
          </div>
        )}

        {errorMessage && (
          <div className="login-error-alert" role="alert" style={{ marginBottom: "16px" }}>
            <Icon name="bell" size={16} />
            <span>{errorMessage}</span>
          </div>
        )}

        {conflictPrompt && (
          <div
            style={{
              background: "#fef8ee",
              border: "1px solid #f3d49e",
              padding: "14px",
              borderRadius: "4px",
              marginBottom: "16px",
            }}
          >
            <p style={{ margin: "0 0 12px", fontSize: "12px", color: "var(--amber)", lineHeight: 1.4 }}>
              <strong>{language === "id" ? "Bentrok Terdeteksi:" : "Overlap Detected:"}</strong> {conflictPrompt}
            </p>
            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
              <button
                type="button"
                className="filter-button"
                onClick={() => setConflictPrompt(null)}
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                className="primary-button"
                onClick={(e) => handleSubmit(e, true)}
                disabled={isSubmitting}
              >
                {language === "id" ? "Tetap Jadwalkan (Abaikan)" : "Override & Book"}
              </button>
            </div>
          </div>
        )}

        <form onSubmit={(e) => handleSubmit(e, false)}>
          <div className="form-grid">
            <label className="full">
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
              />
            </label>

            {/* Quick customer matches */}
            {customerName.length >= 2 && !selectedCustomerId && (
              <div
                className="full"
                style={{
                  maxHeight: "100px",
                  overflowY: "auto",
                  border: "1px solid var(--line)",
                  background: "var(--paper-2)",
                  padding: "4px 8px",
                  borderRadius: "3px",
                  marginTop: "-8px",
                  marginBottom: "8px",
                }}
              >
                <small style={{ display: "block", color: "var(--muted)", marginBottom: "4px" }}>
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
                      style={{
                        display: "block",
                        width: "100%",
                        textAlign: "left",
                        padding: "4px 6px",
                        background: "none",
                        border: "none",
                        fontSize: "11px",
                        cursor: "pointer",
                      }}
                    >
                      <strong>{c.name}</strong> {c.phone ? `(${c.phone})` : ""}
                    </button>
                  ))}
              </div>
            )}

            <label className="full">
              {t("booking.clientPhone")}
              <input
                placeholder={language === "id" ? "cth. 08123456789 atau +628123456789" : "e.g. 08123456789 or +628123456789"}
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
              />
            </label>

            <label className="full">
              {t("booking.selectServices")}
              <select
                value={selectedServiceId}
                onChange={(e) => setSelectedServiceId(Number(e.target.value))}
                required
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
                <label>
                  {t("booking.date")}
                  <input
                    type="date"
                    value={appointmentDate}
                    onChange={(e) => setAppointmentDate(e.target.value)}
                    required
                  />
                </label>
                <label>
                  {t("booking.time")}
                  <input
                    type="time"
                    value={appointmentTime}
                    onChange={(e) => setAppointmentTime(e.target.value)}
                    required
                  />
                </label>
              </>
            )}

            <label className="full">
              {t("booking.barber")}
              <select
                value={selectedStaffId}
                onChange={(e) =>
                  setSelectedStaffId(e.target.value === "" ? "" : Number(e.target.value))
                }
                required={!isWalkin}
              >
                {isWalkin && (
                  <option value="">{t("booking.anyBarber")}</option>
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
                  const isSelected = selectedStaffId === staffId
                  // Barber remains visible, but disabled for a new assignment if unavailable
                  const isDisabled = !isAvailable && !isSelected

                  return (
                    <option key={staffId} value={staffId} disabled={isDisabled}>
                      {b.name} — {displayLabel}
                    </option>
                  )
                })}
              </select>
              {isLoadingAvailability && (
                <small
                  style={{
                    color: "var(--muted)",
                    fontSize: "11px",
                    marginTop: "4px",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <span className="btn-spinner" style={{ width: "10px", height: "10px" }} />{" "}
                  {language === "id" ? "Memeriksa ketersediaan kapster..." : "Checking barber availability..."}
                </small>
              )}
              {availabilityError && (
                <div style={{ color: "var(--danger)", fontSize: "11px", marginTop: "4px" }}>
                  ⚠️ {availabilityError}
                </div>
              )}
              {staffValidationMessage && (
                <div
                  style={{
                    background: shopClosedReason ? "rgba(207, 60, 60, 0.1)" : "#fef8ee",
                    border: shopClosedReason
                      ? "1px solid rgba(207, 60, 60, 0.35)"
                      : "1px solid #f3d49e",
                    borderRadius: "4px",
                    padding: "8px 10px",
                    marginTop: "6px",
                    color: shopClosedReason ? "var(--danger)" : "#75521e",
                    fontSize: "11px",
                    lineHeight: "1.4",
                  }}
                >
                  ⚠️ {staffValidationMessage}
                </div>
              )}
            </label>
          </div>

          <div className="modal-actions">
            <button
              type="button"
              className="filter-button"
              onClick={onClose}
              disabled={isSubmitting}
            >
              {t("common.cancel")}
            </button>
            <button type="submit" className="primary-button" disabled={isSubmitDisabled}>
              {isSubmitting ? (
                <>
                  <span className="btn-spinner" />
                  <span>{t("common.saving")}</span>
                </>
              ) : isWalkin ? (
                t("booking.confirmWalkin")
              ) : (
                t("booking.confirmBooking")
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
