import { useState, useEffect } from "react"
import type { ApiAppointment, StaffItem } from "../../lib/api"
import { Badge } from "../../components/ui/Badge"
import {
  formatRupiah,
  formatTimeOnly,
  getDateStringInTimezone,
  getTimeInTimezone,
  getIsoWithTimezone,
} from "../../lib/format"
import { useI18n, type TranslationKey } from "../../lib/i18n"

interface AppointmentDrawerProps {
  detail: ApiAppointment | null
  onClose: () => void
  onCheckIn: (appointment: ApiAppointment) => void
  onComplete: (appointment: ApiAppointment) => void
  onCancel: (appointment: ApiAppointment) => void
  onNoShow: (appointment: ApiAppointment) => void
  conflictReason?: "shop_closed" | "staff_unavailable" | null
  staffList?: StaffItem[]
  timezone?: string
  onReschedule?: (
    id: number,
    data: { staff_id: number; starts_at: string; override?: boolean }
  ) => Promise<void>
}

export function AppointmentDrawer({
  detail,
  onClose,
  onCheckIn,
  onComplete,
  onCancel,
  onNoShow,
  conflictReason = null,
  staffList = [],
  timezone = "Asia/Jakarta",
  onReschedule,
}: AppointmentDrawerProps) {
  const { t, language } = useI18n()
  const [showReschedule, setShowReschedule] = useState(false)
  const [rescheduleDate, setRescheduleDate] = useState("")
  const [rescheduleTime, setRescheduleTime] = useState("10:00")
  const [rescheduleStaffId, setRescheduleStaffId] = useState<number>(0)
  const [isSavingReschedule, setIsSavingReschedule] = useState(false)
  const [rescheduleError, setRescheduleError] = useState<string | null>(null)

  useEffect(() => {
    if (detail) {
      const dateStr = getDateStringInTimezone(detail.starts_at, timezone)
      const { hour, minute } = getTimeInTimezone(detail.starts_at, timezone)
      const timeStr = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`
      setRescheduleDate(dateStr)
      setRescheduleTime(timeStr)
      setRescheduleStaffId(detail.staff_id)
      setRescheduleError(null)
      setShowReschedule(Boolean(conflictReason))
    }
  }, [detail, timezone, conflictReason])

  const isOpen = Boolean(detail)
  useEffect(() => {
    if (!isOpen) return
    const previous = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = previous
    }
  }, [isOpen])

  if (!detail) return null

  const isConfirmed = detail.status === "confirmed"
  const isCheckedIn = detail.status === "checked_in"
  const isCompleted = detail.status === "completed"

  const tone =
    detail.status === "completed"
      ? "neutral"
      : detail.status === "checked_in"
        ? "forest"
        : detail.status === "confirmed"
          ? "success"
          : "danger"

  const statusKey = `status.${detail.status}` as TranslationKey
  const statusLabel = t(statusKey).toUpperCase()

  async function handleSaveReschedule(e: React.FormEvent) {
    e.preventDefault()
    if (!detail || !onReschedule) return
    setIsSavingReschedule(true)
    setRescheduleError(null)
    try {
      const startsAt = getIsoWithTimezone(rescheduleDate, rescheduleTime, timezone)
      await onReschedule(detail.id, {
        staff_id: rescheduleStaffId,
        starts_at: startsAt,
      })
      setShowReschedule(false)
    } catch (err: unknown) {
      setRescheduleError(
        err instanceof Error ? err.message : t("common.error")
      )
    } finally {
      setIsSavingReschedule(false)
    }
  }

  return (
    <aside className="detail-drawer">
      <div className="modal-head">
        <div>
          <span className="section-index">
            {t("operations.appointmentDrawer").toUpperCase()}
          </span>
          <h2>{detail.customer_name}</h2>
        </div>
        <button
          className="icon-button"
          onClick={onClose}
          aria-label={t("common.close")}
        >
          ×
        </button>
      </div>

      <div className="detail-status">
        <Badge tone={tone}>{statusLabel}</Badge>
        {conflictReason && (
          <Badge tone="danger">⚠️ {t("calendar.bookingConflictBadge")}</Badge>
        )}
        <span>
          {language === "id" ? `Reservasi #${detail.id}` : `Booking #${detail.id}`}
        </span>
      </div>

      <div className="detail-body">
      {conflictReason && (isConfirmed || isCheckedIn) && (
        <div
          style={{
            marginTop: "12px",
            padding: "10px 12px",
            borderRadius: "4px",
            background: "rgba(207, 60, 60, 0.1)",
            border: "1px solid rgba(207, 60, 60, 0.35)",
            color: "var(--danger)",
            fontSize: "12px",
            lineHeight: 1.45,
          }}
        >
          ⚠️{" "}
          <strong>
            {conflictReason === "shop_closed"
              ? t("calendar.bookingConflictClosure")
              : t("calendar.bookingConflictStaff")}
          </strong>
        </div>
      )}

      <dl>
        <div>
          <dt>{t("appointments.colServices")}</dt>
          <dd>{detail.service_name}</dd>
        </div>
        <div>
          <dt>{t("appointments.colTime")}</dt>
          <dd>
            {formatTimeOnly(detail.starts_at, timezone)} –{" "}
            {formatTimeOnly(detail.ends_at, timezone)}
          </dd>
        </div>
        <div>
          <dt>{t("appointments.colBarber")}</dt>
          <dd>{detail.staff_name}</dd>
        </div>
        <div>
          <dt>{t("appointments.colPrice")}</dt>
          <dd style={{ fontWeight: 700 }}>{formatRupiah(detail.price_snapshot)}</dd>
        </div>
        {detail.customer_phone && (
          <div>
            <dt>{t("team.colContact")}</dt>
            <dd>{detail.customer_phone}</dd>
          </div>
        )}
      </dl>

      {(isConfirmed || isCheckedIn) && onReschedule && (
        <div style={{ marginTop: "16px" }}>
          {!showReschedule ? (
            <button
              type="button"
              className="filter-button"
              style={{ width: "100%", justifyContent: "center" }}
              onClick={() => setShowReschedule(true)}
            >
              {t("calendar.rescheduleAppointment")}
            </button>
          ) : (
            <form
              onSubmit={handleSaveReschedule}
              style={{
                padding: "12px",
                borderRadius: "4px",
                background: "var(--paper-2)",
                border: "1px solid var(--line)",
              }}
            >
              <strong style={{ display: "block", fontSize: "12px", marginBottom: "10px" }}>
                {t("calendar.rescheduleTitle")}
              </strong>
              {rescheduleError && (
                <div
                  style={{
                    color: "var(--danger)",
                    fontSize: "11px",
                    marginBottom: "8px",
                  }}
                >
                  ⚠️ {rescheduleError}
                </div>
              )}
              <div style={{ display: "grid", gap: "8px" }}>
                <label style={{ fontSize: "11px" }}>
                  {t("calendar.rescheduleDate")}
                  <input
                    type="date"
                    value={rescheduleDate}
                    onChange={(e) => setRescheduleDate(e.target.value)}
                    required
                    style={{ width: "100%", marginTop: "4px" }}
                  />
                </label>
                <label style={{ fontSize: "11px" }}>
                  {t("calendar.rescheduleTime")}
                  <input
                    type="time"
                    value={rescheduleTime}
                    onChange={(e) => setRescheduleTime(e.target.value)}
                    required
                    style={{ width: "100%", marginTop: "4px" }}
                  />
                </label>
                {staffList.length > 0 && (
                  <label style={{ fontSize: "11px" }}>
                    {t("calendar.rescheduleBarber")}
                    <select
                      value={rescheduleStaffId}
                      onChange={(e) => setRescheduleStaffId(Number(e.target.value))}
                      style={{ width: "100%", marginTop: "4px" }}
                    >
                      {staffList.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
              <div
                style={{
                  display: "flex",
                  gap: "8px",
                  justifyContent: "flex-end",
                  marginTop: "10px",
                }}
              >
                <button
                  type="button"
                  className="filter-button"
                  onClick={() => setShowReschedule(false)}
                  disabled={isSavingReschedule}
                >
                  {t("common.cancel")}
                </button>
                <button
                  type="submit"
                  className="primary-button"
                  disabled={isSavingReschedule}
                >
                  {isSavingReschedule
                    ? t("common.saving")
                    : t("calendar.saveReschedule")}
                </button>
              </div>
            </form>
          )}
        </div>
      )}
      </div>

      <div className="detail-footer">
        {isConfirmed && (
          <button
            className="primary-button wide-detail"
            onClick={() => onCheckIn(detail)}
            style={{ width: "100%", marginBottom: "12px" }}
          >
            {language === "id" ? "Tandai Pelanggan Hadir" : "Check in Customer"}
          </button>
        )}

        {isCheckedIn && (
          <button
            className="primary-button wide-detail"
            onClick={() => onComplete(detail)}
            style={{ width: "100%", marginBottom: "12px", background: "var(--forest)", borderColor: "var(--forest)" }}
          >
            {language === "id" ? "Selesaikan & Catat Pembayaran" : "Complete & Record Payment"}
          </button>
        )}

        {isCompleted && (
          <div style={{
            padding: "12px",
            background: "var(--paper-2)",
            textAlign: "center",
            fontSize: "12px",
            borderRadius: "4px",
            marginBottom: "12px",
          }}>
            {language === "id"
              ? "✓ Janji temu ini telah selesai dan dibayar."
              : "✓ This appointment has been completed and paid."}
          </div>
        )}

        {(isConfirmed || isCheckedIn) && (
          <div className="detail-links">
            <button
              onClick={() => {
                const msg =
                  language === "id"
                    ? `Tandai janji temu #${detail.id} sebagai Tidak Hadir (No-Show)?`
                    : `Mark appointment #${detail.id} as No-Show?`
                if (confirm(msg)) {
                  onNoShow(detail)
                }
              }}
            >
              {language === "id" ? "Tandai Tidak Hadir" : "Mark No-Show"}
            </button>
            <button
              className="danger"
              onClick={() => {
                const msg =
                  language === "id"
                    ? `Batalkan janji temu untuk ${detail.customer_name}?`
                    : `Cancel appointment for ${detail.customer_name}?`
                if (confirm(msg)) {
                  onCancel(detail)
                }
              }}
            >
              {t("operations.cancelAppointment")}
            </button>
          </div>
        )}
      </div>
    </aside>
  )
}
