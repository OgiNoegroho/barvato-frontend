import { useState, useEffect } from "react"
import type { ApiAppointment, StaffItem } from "../../lib/api"
import { Badge } from "../../components/ui/Badge"
import { Button } from "../../components/ui/Button"
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
    <>
      <div
        className="fixed inset-0 bg-charcoal/40 z-drawer backdrop-blur-xs transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside className="detail-drawer fixed inset-y-0 right-0 z-drawer w-full max-w-[380px] h-full bg-ivory-light border-l border-stone p-5 sm:p-6 shadow-drawer flex flex-col overflow-hidden">
        {/* Drawer Head */}
        <div className="modal-head flex items-start justify-between gap-4 mb-3 shrink-0">
          <div>
            <span className="section-index text-[10px] uppercase tracking-wider text-muted-text font-bold block mb-0.5">
              {t("operations.appointmentDrawer").toUpperCase()}
            </span>
            <h2 className="font-serif text-2xl text-charcoal">{detail.customer_name}</h2>
          </div>
          <button
            className="icon-button text-muted-text hover:text-charcoal p-1 rounded-sm text-2xl leading-none cursor-pointer"
            onClick={onClose}
            aria-label={t("common.close")}
            type="button"
          >
            ×
          </button>
        </div>

        {/* Status Bar */}
        <div className="detail-status flex items-center justify-between pb-3 border-b border-stone text-xs text-muted-text shrink-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <Badge tone={tone}>{statusLabel}</Badge>
            {conflictReason && (
              <Badge tone="danger">⚠️ {t("calendar.bookingConflictBadge")}</Badge>
            )}
          </div>
          <span className="text-[11px] font-mono">
            {language === "id" ? `Reservasi #${detail.id}` : `Booking #${detail.id}`}
          </span>
        </div>

        {/* Drawer Body */}
        <div className="detail-body flex-1 overflow-y-auto min-h-0 py-3 space-y-4">
          {conflictReason && (isConfirmed || isCheckedIn) && (
            <div
              role="alert"
              className="p-3 bg-danger-soft border border-danger-line text-danger text-xs rounded-sm leading-relaxed"
            >
              ⚠️{" "}
              <strong>
                {conflictReason === "shop_closed"
                  ? t("calendar.bookingConflictClosure")
                  : t("calendar.bookingConflictStaff")}
              </strong>
            </div>
          )}

          <dl className="divide-y divide-stone border-y border-stone text-xs">
            <div className="grid grid-cols-[100px_1fr] py-2.5">
              <dt className="text-muted-text uppercase tracking-wider text-[10px]">{t("appointments.colServices")}</dt>
              <dd className="font-medium text-charcoal">{detail.service_name}</dd>
            </div>
            <div className="grid grid-cols-[100px_1fr] py-2.5">
              <dt className="text-muted-text uppercase tracking-wider text-[10px]">{t("appointments.colTime")}</dt>
              <dd className="font-medium text-charcoal">
                {formatTimeOnly(detail.starts_at, timezone)} – {formatTimeOnly(detail.ends_at, timezone)}
              </dd>
            </div>
            <div className="grid grid-cols-[100px_1fr] py-2.5">
              <dt className="text-muted-text uppercase tracking-wider text-[10px]">{t("appointments.colBarber")}</dt>
              <dd className="font-medium text-charcoal">{detail.staff_name}</dd>
            </div>
            <div className="grid grid-cols-[100px_1fr] py-2.5">
              <dt className="text-muted-text uppercase tracking-wider text-[10px]">{t("appointments.colPrice")}</dt>
              <dd className="font-bold font-mono text-charcoal">{formatRupiah(detail.price_snapshot)}</dd>
            </div>
            {detail.customer_phone && (
              <div className="grid grid-cols-[100px_1fr] py-2.5">
                <dt className="text-muted-text uppercase tracking-wider text-[10px]">{t("team.colContact")}</dt>
                <dd className="font-medium text-charcoal">{detail.customer_phone}</dd>
              </div>
            )}
          </dl>

          {/* Reschedule Section */}
          {(isConfirmed || isCheckedIn) && onReschedule && (
            <div className="pt-2">
              {!showReschedule ? (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-center text-xs"
                  onClick={() => setShowReschedule(true)}
                >
                  {t("calendar.rescheduleAppointment")}
                </Button>
              ) : (
                <form
                  onSubmit={handleSaveReschedule}
                  className="p-3 bg-ivory-light border border-stone rounded-sm space-y-2.5 text-xs shadow-xs"
                >
                  <strong className="block text-xs font-semibold text-charcoal">
                    {t("calendar.rescheduleTitle")}
                  </strong>
                  {rescheduleError && (
                    <div className="text-danger text-[11px]">
                      ⚠️ {rescheduleError}
                    </div>
                  )}
                  <div className="space-y-2">
                    <label className="flex flex-col gap-1 text-[11px] font-medium text-charcoal">
                      {t("calendar.rescheduleDate")}
                      <input
                        type="date"
                        value={rescheduleDate}
                        onChange={(e) => setRescheduleDate(e.target.value)}
                        required
                        className="border border-stone bg-ivory px-2 py-1 text-xs rounded-sm text-charcoal focus:outline-none focus:border-copper"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-[11px] font-medium text-charcoal">
                      {t("calendar.rescheduleTime")}
                      <input
                        type="time"
                        value={rescheduleTime}
                        onChange={(e) => setRescheduleTime(e.target.value)}
                        required
                        className="border border-stone bg-ivory px-2 py-1 text-xs rounded-sm text-charcoal focus:outline-none focus:border-copper"
                      />
                    </label>
                    {staffList.length > 0 && (
                      <label className="flex flex-col gap-1 text-[11px] font-medium text-charcoal">
                        {t("calendar.rescheduleBarber")}
                        <select
                          value={rescheduleStaffId}
                          onChange={(e) => setRescheduleStaffId(Number(e.target.value))}
                          className="border border-stone bg-ivory px-2 py-1 text-xs rounded-sm text-charcoal focus:outline-none focus:border-copper"
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
                  <div className="flex gap-2 justify-end pt-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowReschedule(false)}
                      disabled={isSavingReschedule}
                    >
                      {t("common.cancel")}
                    </Button>
                    <Button
                      type="submit"
                      variant="primary"
                      size="sm"
                      isLoading={isSavingReschedule}
                      disabled={isSavingReschedule}
                    >
                      {isSavingReschedule
                        ? t("common.saving")
                        : t("calendar.saveReschedule")}
                    </Button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>

        {/* Drawer Footer */}
        <div className="detail-footer mt-auto pt-3 border-t border-stone flex flex-col gap-2 shrink-0">
          {isConfirmed && (
            <Button
              variant="primary"
              className="w-full justify-center"
              onClick={() => onCheckIn(detail)}
            >
              {language === "id" ? "Tandai Pelanggan Hadir" : "Check in Customer"}
            </Button>
          )}

          {isCheckedIn && (
            <Button
              variant="primary"
              className="w-full justify-center bg-forest hover:bg-forest/90 border-forest"
              onClick={() => onComplete(detail)}
            >
              {language === "id" ? "Selesaikan & Catat Pembayaran" : "Complete & Record Payment"}
            </Button>
          )}

          {isCompleted && (
            <div className="p-3 bg-ivory border border-stone text-center text-xs text-muted-text rounded-sm">
              {language === "id"
                ? "✓ Janji temu ini telah selesai dan dibayar."
                : "✓ This appointment has been completed and paid."}
            </div>
          )}

          {(isConfirmed || isCheckedIn) && (
            <div className="detail-links flex justify-between items-center text-xs pt-1">
              <button
                type="button"
                className="text-muted-text hover:text-charcoal underline text-[11px] cursor-pointer"
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
                type="button"
                className="text-danger hover:text-red-700 underline text-[11px] cursor-pointer"
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
    </>
  )
}
