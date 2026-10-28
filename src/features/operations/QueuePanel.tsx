import { useState } from "react"
import type { ApiQueueEntry, StaffItem } from "../../lib/api"
import { Badge } from "../../components/ui/Badge"
import { formatMinutesAgo, formatRupiah, getInitials, formatTimeOnly } from "../../lib/format"

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
  const [assigningId, setAssigningId] = useState<number | null>(null)

  return (
    <aside className="integrated-queue">
      <div className="queue-head">
        <div>
          <span className="section-index">LIVE FLOW</span>
          <h2>
            Walk-in Queue <b>{waiting.length}</b>
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
          <i className="status-dot waiting-dot" /> {waiting.length} waiting
        </span>
        <span>
          <i className="status-dot service-dot" /> {inService.length} in chairs
        </span>
      </div>

      <div className="ops-queue-list">
        {waiting.length === 0 ? (
          <div style={{ padding: "24px 12px", textAlign: "center", color: "var(--muted)", fontSize: "11px" }}>
            No walk-in customers currently waiting.
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
                <small>{item.service_name || "Service"}</small>
                <span className="queue-meta">
                  {item.arrived_at
                    ? `Arrived ${formatTimeOnly(item.arrived_at, timezone)} (${formatMinutesAgo(item.arrived_at)})`
                    : formatMinutesAgo(item.arrived_at)}{" "}
                  · {formatRupiah(item.price_snapshot)}
                </span>
              </div>
              <Badge tone={item.assigned_staff_name ? "neutral" : "warning"}>
                {item.assigned_staff_name || "Unassigned"}
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
                      Assign barber...
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
                            ? `— Busy (serving another customer)`
                            : isUnavailable
                              ? "— Unavailable"
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
                        Assign
                      </button>
                    )}
                    <button
                      className="start"
                      onClick={(event) => {
                        event.stopPropagation()
                        onStart(item)
                      }}
                    >
                      Start
                    </button>
                    <button
                      title="Cancel walk-in"
                      style={{ color: "var(--danger)", border: "none", background: "none", padding: "0 4px" }}
                      onClick={(event) => {
                        event.stopPropagation()
                        if (confirm(`Cancel queue entry for ${item.customer_name}?`)) {
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
            <i className="status-dot service-dot" /> In service
          </span>
          <b>{inService.length}</b>
        </summary>
        {inService.length === 0 ? (
          <div style={{ padding: "12px", color: "var(--muted)", fontSize: "11px" }}>
            No barbers currently serving walk-ins.
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
                    {item.service_name || "Service"} · {item.assigned_staff_name || "Staff"}
                  </small>
                </span>
              </div>
              <button
                className="primary-button compact"
                style={{ fontSize: "10px", minHeight: "26px", padding: "0 8px" }}
                onClick={() => onComplete(item)}
              >
                Complete &amp; Pay
              </button>
            </div>
          ))
        )}
      </details>

      <details className="queue-section completed-section">
        <summary>
          <span>
            <i className="status-dot complete-dot" /> Completed today
          </span>
          <b>{completed.length}</b>
        </summary>
        {completed.length === 0 ? (
          <div style={{ padding: "12px", color: "var(--muted)", fontSize: "11px" }}>
            No completed walk-ins recorded yet today.
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
