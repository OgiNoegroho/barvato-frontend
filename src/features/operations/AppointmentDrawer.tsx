import type { ApiAppointment } from "../../lib/api"
import { Badge } from "../../components/ui/Badge"
import { formatRupiah, formatTimeOnly } from "../../lib/format"
import { useI18n, type TranslationKey } from "../../lib/i18n"

interface AppointmentDrawerProps {
  detail: ApiAppointment | null
  onClose: () => void
  onCheckIn: (appointment: ApiAppointment) => void
  onComplete: (appointment: ApiAppointment) => void
  onCancel: (appointment: ApiAppointment) => void
  onNoShow: (appointment: ApiAppointment) => void
}

export function AppointmentDrawer({
  detail,
  onClose,
  onCheckIn,
  onComplete,
  onCancel,
  onNoShow,
}: AppointmentDrawerProps) {
  const { t, language } = useI18n()

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
        <span>
          {language === "id" ? `Reservasi #${detail.id}` : `Booking #${detail.id}`}
        </span>
      </div>

      <dl>
        <div>
          <dt>{t("appointments.colServices")}</dt>
          <dd>{detail.service_name}</dd>
        </div>
        <div>
          <dt>{t("appointments.colTime")}</dt>
          <dd>
            {formatTimeOnly(detail.starts_at)} – {formatTimeOnly(detail.ends_at)}
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

      <div style={{ marginTop: "24px" }}>
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
