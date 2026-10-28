import type { ApiAppointment } from "../../lib/api"
import { Badge } from "../../components/ui/Badge"
import { formatRupiah, formatTimeOnly } from "../../lib/format"

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

  return (
    <aside className="detail-drawer">
      <div className="modal-head">
        <div>
          <span className="section-index">APPOINTMENT DETAILS</span>
          <h2>{detail.customer_name}</h2>
        </div>
        <button
          className="icon-button"
          onClick={onClose}
          aria-label="Close drawer"
        >
          ×
        </button>
      </div>

      <div className="detail-status">
        <Badge tone={tone}>{detail.status.replace("_", " ").toUpperCase()}</Badge>
        <span>Booking #{detail.id}</span>
      </div>

      <dl>
        <div>
          <dt>Service</dt>
          <dd>{detail.service_name}</dd>
        </div>
        <div>
          <dt>Time</dt>
          <dd>
            {formatTimeOnly(detail.starts_at)} – {formatTimeOnly(detail.ends_at)}
          </dd>
        </div>
        <div>
          <dt>Barber</dt>
          <dd>{detail.staff_name}</dd>
        </div>
        <div>
          <dt>Price</dt>
          <dd style={{ fontWeight: 700 }}>{formatRupiah(detail.price_snapshot)}</dd>
        </div>
        {detail.customer_phone && (
          <div>
            <dt>Contact</dt>
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
            Check in Customer
          </button>
        )}

        {isCheckedIn && (
          <button
            className="primary-button wide-detail"
            onClick={() => onComplete(detail)}
            style={{ width: "100%", marginBottom: "12px", background: "var(--forest)", borderColor: "var(--forest)" }}
          >
            Complete &amp; Record Payment
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
            ✓ This appointment has been completed and paid.
          </div>
        )}

        {(isConfirmed || isCheckedIn) && (
          <div className="detail-links">
            <button
              onClick={() => {
                if (confirm(`Mark appointment #${detail.id} as No-Show?`)) {
                  onNoShow(detail)
                }
              }}
            >
              Mark No-Show
            </button>
            <button
              className="danger"
              onClick={() => {
                if (confirm(`Cancel appointment for ${detail.customer_name}?`)) {
                  onCancel(detail)
                }
              }}
            >
              Cancel Appointment
            </button>
          </div>
        )}
      </div>
    </aside>
  )
}
