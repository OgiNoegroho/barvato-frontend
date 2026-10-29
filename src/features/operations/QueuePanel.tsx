import { useState } from "react"
import type { ApiQueueEntry, StaffItem } from "../../lib/api"
import { Badge } from "../../components/ui/Badge"
import { formatMinutesAgo, formatRupiah, getInitials, formatTimeOnly } from "../../lib/format"
import { useI18n } from "../../lib/i18n"

interface QueuePanelProps {
  waiting: ApiQueueEntry[]
  inService: ApiQueueEntry[]
  completed: ApiQueueEntry[]
  staffList: StaffItem[]
  selected: number | null
  onSelect: (id: number | null) => void
  onAssign: (item: ApiQueueEntry, staffId: number) => void
  onStart: (item: ApiQueueEntry) => void
  onComplete: (item: ApiQueueEntry) => void
  onCancel: (item: ApiQueueEntry) => void
  onCollapse: () => void
  timezone?: string
}

export function QueuePanel({
  waiting,
  inService,
  completed,
  staffList,
  selected,
  onSelect,
  onAssign,
  onStart,
  onComplete,
  onCancel,
  onCollapse,
  timezone = "Asia/Jakarta",
}: QueuePanelProps) {
  const { t, language } = useI18n()
  const [assigningId, setAssigningId] = useState<number | null>(null)

  return (
    <aside className="integrated-queue">
      <div className="queue-head">
        <div>
          <span className="section-index">
            {language === "id" ? "ALUR LANGSUNG" : "LIVE FLOW"}
          </span>
          <h2>
            {t("operations.queueTitle")} <b>{waiting.length}</b>
          </h2>
        </div>
        <button
          className="icon-button mini"
          onClick={onCollapse}
          aria-label="Collapse queue"
        >
          ›
        </button>
      </div>

      <div className="queue-summary">
        <span>
          <i className="status-dot waiting-dot" /> {waiting.length} {t("operations.waiting")}
        </span>
        <span>
          <i className="status-dot service-dot" /> {inService.length}{" "}
          {language === "id" ? "di kursi" : "in chairs"}
        </span>
      </div>

      <div className="ops-queue-list">
        {waiting.length === 0 ? (
          <div style={{ padding: "24px 12px", textAlign: "center", color: "var(--muted)", fontSize: "11px" }}>
            {t("operations.noClientsInQueue")}
          </div>
        ) : (
          waiting.map((item, index) => (
            <article
              key={item.id}
              className={`ops-queue-item ${selected === item.id ? "selected" : ""}`}
              onClick={() => onSelect(item.id)}
            >
              <span className="queue-position">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div className="grow">
                <strong>{item.customer_name}</strong>
                <small>{item.service_name || (language === "id" ? "Layanan" : "Service")}</small>
                <span className="queue-meta">
                  {item.arrived_at
                    ? `${language === "id" ? "Tiba" : "Arrived"} ${formatTimeOnly(item.arrived_at, timezone)} (${formatMinutesAgo(item.arrived_at, language)})`
                    : formatMinutesAgo(item.arrived_at, language)}{" "}
                  · {formatRupiah(item.price_snapshot)}
                </span>
              </div>
              <Badge tone={item.assigned_staff_name ? "neutral" : "warning"}>
                {item.assigned_staff_name || (language === "id" ? "Belum Ditugaskan" : "Unassigned")}
              </Badge>

              <div className="queue-quick">
                {assigningId === item.id ? (
                  <select
                    autoFocus
                    style={{ fontSize: "10px", height: "26px", background: "var(--white)" }}
                    defaultValue=""
                    onChange={(e) => {
                      const sId = Number(e.target.value)
                      if (sId) {
                        onAssign(item, sId)
                      }
                      setAssigningId(null)
                    }}
                    onBlur={() => setAssigningId(null)}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <option value="" disabled>
                      {language === "id" ? "Pilih kapster..." : "Assign barber..."}
                    </option>
                    {staffList.map((st) => {
                      const activeInService = inService.find((s) => s.assigned_staff_id === st.id)
                      const isBusy = !!activeInService
                      const isUnavailable = !st.active

                      return (
                        <option
                          key={st.id}
                          value={st.id}
                          disabled={isBusy || isUnavailable}
                        >
                          {st.name}{" "}
                          {isBusy
                            ? language === "id"
                              ? "— Sibuk (melayani pelanggan lain)"
                              : "— Busy (serving another customer)"
                            : isUnavailable
                              ? language === "id"
                                ? "— Tidak tersedia"
                                : "— Unavailable"
                              : language === "id"
                              ? "— Tersedia"
                              : "— Available"}
                        </option>
                      )
                    })}
                  </select>
                ) : (
                  <>
                    {!item.assigned_staff_id && staffList.length > 0 && (
                      <button
                        onClick={(event) => {
                          event.stopPropagation()
                          setAssigningId(item.id)
                        }}
                      >
                        {language === "id" ? "Tugaskan" : "Assign"}
                      </button>
                    )}
                    <button
                      className="start"
                      onClick={(event) => {
                        event.stopPropagation()
                        onStart(item)
                      }}
                    >
                      {t("overview.startService")}
                    </button>
                    <button
                      title={t("operations.cancelQueue")}
                      style={{ color: "var(--danger)", border: "none", background: "none", padding: "0 4px" }}
                      onClick={(event) => {
                        event.stopPropagation()
                        const confirmMsg =
                          language === "id"
                            ? `Batalkan antrean untuk ${item.customer_name}?`
                            : `Cancel queue entry for ${item.customer_name}?`
                        if (confirm(confirmMsg)) {
                          onCancel(item)
                        }
                      }}
                    >
                      ×
                    </button>
                  </>
                )}
              </div>
            </article>
          ))
        )}
      </div>

      <details className="queue-section" open>
        <summary>
          <span>
            <i className="status-dot service-dot" /> {t("operations.inService")}
          </span>
          <b>{inService.length}</b>
        </summary>
        {inService.length === 0 ? (
          <div style={{ padding: "12px", color: "var(--muted)", fontSize: "11px" }}>
            {language === "id"
              ? "Tidak ada kapster yang sedang melayani walk-in."
              : "No barbers currently serving walk-ins."}
          </div>
        ) : (
          inService.map((item) => (
            <div
              className="queue-compact"
              key={item.id}
              style={{ justifyContent: "space-between", alignItems: "center" }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span className="avatar small">{getInitials(item.customer_name)}</span>
                <span>
                  <strong>{item.customer_name}</strong>
                  <small>
                    {item.service_name || (language === "id" ? "Layanan" : "Service")} ·{" "}
                    {item.assigned_staff_name || t("roles.staff")}
                  </small>
                </span>
              </div>
              <button
                className="primary-button compact"
                style={{ fontSize: "10px", minHeight: "26px", padding: "0 8px" }}
                onClick={() => onComplete(item)}
              >
                {language === "id" ? "Selesai & Bayar" : "Complete & Pay"}
              </button>
            </div>
          ))
        )}
      </details>

      <details className="queue-section completed-section">
        <summary>
          <span>
            <i className="status-dot complete-dot" />{" "}
            {language === "id" ? "Selesai hari ini" : "Completed today"}
          </span>
          <b>{completed.length}</b>
        </summary>
        {completed.length === 0 ? (
          <div style={{ padding: "12px", color: "var(--muted)", fontSize: "11px" }}>
            {language === "id"
              ? "Belum ada walk-in yang selesai hari ini."
              : "No completed walk-ins recorded yet today."}
          </div>
        ) : (
          completed.map((item) => (
            <div className="queue-compact muted" key={item.id}>
              <span className="avatar small">{getInitials(item.customer_name)}</span>
              <span>
                <strong>{item.customer_name}</strong>
                <small>{item.service_name} · {formatRupiah(item.price_snapshot)}</small>
              </span>
              <span>{formatTimeOnly(item.finished_at)}</span>
            </div>
          ))
        )}
      </details>
    </aside>
  )
}
