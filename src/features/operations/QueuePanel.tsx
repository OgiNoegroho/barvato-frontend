import { useState } from "react"
import type { ApiQueueEntry, StaffItem } from "../../lib/api"
import { Badge } from "../../components/ui/Badge"
import { Button } from "../../components/ui/Button"
import { Icon } from "../../components/ui/Icon"
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
  collapsed?: boolean
  onToggleCollapse?: () => void
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
  collapsed = false,
  onToggleCollapse,
  timezone = "Asia/Jakarta",
}: QueuePanelProps) {
  const { t, language } = useI18n()
  const [assigningId, setAssigningId] = useState<number | null>(null)

  const handleToggle = () => {
    if (onToggleCollapse) {
      onToggleCollapse()
    } else {
      onCollapse()
    }
  }

  return (
    <aside
      className="integrated-queue w-full bg-ivory border-l border-stone flex flex-col h-full overflow-hidden"
    >
      {/* Header */}
      <div className="queue-head flex items-center justify-between p-4 border-b border-stone shrink-0">
        <div>
          <span className="section-index text-[10px] uppercase tracking-wider text-charcoal-muted font-bold block mb-0.5">
            {language === "id" ? "ALUR LANGSUNG" : "LIVE FLOW"}
          </span>
          <h2 className="font-serif text-xl text-charcoal">
            {t("operations.queueTitle")}{" "}
            <b className="font-mono text-copper font-normal ml-1">{waiting.length}</b>
          </h2>
        </div>
        <button
          type="button"
          className="w-8 h-8 rounded border border-stone bg-white text-charcoal hover:bg-ivory-warm hover:text-charcoal flex items-center justify-center cursor-pointer transition-colors shadow-subtle shrink-0 z-10"
          onClick={(e) => {
            e.stopPropagation()
            handleToggle()
          }}
          aria-label={language === "id" ? "Tutup panel antrean" : "Collapse queue"}
          title={language === "id" ? "Tutup panel antrean" : "Collapse queue"}
        >
          <Icon
            name="chevron-right"
            size={16}
            className="text-charcoal shrink-0"
          />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Summary Count Bar */}
        <div className="queue-summary flex items-center gap-4 px-4 py-2 bg-ivory-warm border-b border-stone text-xs text-charcoal-muted font-medium">
          <span className="flex items-center gap-1.5">
            <i className="status-dot waiting-dot w-2 h-2 rounded-full bg-copper inline-block" /> {waiting.length} {t("operations.waiting")}
          </span>
          <span className="flex items-center gap-1.5">
            <i className="status-dot service-dot w-2 h-2 rounded-full bg-forest inline-block" /> {inService.length}{" "}
            {language === "id" ? "di kursi" : "in chairs"}
          </span>
        </div>

        {/* Waiting Queue List */}
        <div className="ops-queue-list divide-y divide-stone">
        {waiting.length === 0 ? (
          <div className="py-8 px-4 text-center text-charcoal-muted text-xs">
            {t("operations.noClientsInQueue")}
          </div>
        ) : (
          waiting.map((item, index) => (
            <article
              key={item.id}
              className={`ops-queue-item p-3.5 transition-colors cursor-pointer flex flex-col gap-2 text-xs ${
                selected === item.id ? "selected bg-white border-l-4 border-l-copper shadow-xs" : "hover:bg-white"
              }`}
              onClick={() => onSelect(item.id)}
            >
              <div className="flex items-start gap-3">
                <span className="queue-position font-serif text-lg font-bold text-copper shrink-0">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div className="grow min-w-0">
                  <strong className="block text-xs font-semibold text-charcoal truncate">{item.customer_name}</strong>
                  <small className="block text-charcoal-muted text-[11px] truncate">
                    {item.service_name || (language === "id" ? "Layanan" : "Service")}
                  </small>
                  <span className="queue-meta block text-charcoal-muted text-[10px] mt-0.5">
                    {item.arrived_at
                      ? `${language === "id" ? "Tiba" : "Arrived"} ${formatTimeOnly(item.arrived_at, timezone)} (${formatMinutesAgo(item.arrived_at, language)})`
                      : formatMinutesAgo(item.arrived_at, language)}{" "}
                    · {formatRupiah(item.price_snapshot)}
                  </span>
                </div>
                <div className="shrink-0">
                  <Badge tone={item.assigned_staff_name ? "neutral" : "warning"}>
                    {item.assigned_staff_name || (language === "id" ? "Belum Ditugaskan" : "Unassigned")}
                  </Badge>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="queue-quick flex items-center gap-1.5 pl-7">
                {assigningId === item.id ? (
                  <select
                    autoFocus
                    className="border border-stone bg-white px-2 py-1 text-xs rounded-sm focus:outline-none focus:border-copper text-charcoal w-full"
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
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-[10px] px-2 py-0.5 h-6"
                        onClick={(event) => {
                          event.stopPropagation()
                          setAssigningId(item.id)
                        }}
                      >
                        {language === "id" ? "Tugaskan" : "Assign"}
                      </Button>
                    )}
                    <Button
                      variant="primary"
                      size="sm"
                      className="start text-[10px] px-2 py-0.5 h-6"
                      onClick={(event) => {
                        event.stopPropagation()
                        onStart(item)
                      }}
                    >
                      {t("overview.startService")}
                    </Button>
                    <button
                      type="button"
                      title={t("operations.cancelQueue")}
                      className="text-danger hover:text-red-700 p-1 text-sm leading-none ml-auto"
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

      {/* In-Service Section */}
      <details className="queue-section border-t border-stone" open>
        <summary className="flex items-center justify-between px-4 py-2.5 bg-ivory-warm/50 cursor-pointer text-xs font-semibold text-charcoal select-none">
          <span className="flex items-center gap-1.5">
            <i className="status-dot service-dot w-2 h-2 rounded-full bg-forest inline-block" /> {t("operations.inService")}
          </span>
          <b className="font-mono text-xs font-normal">{inService.length}</b>
        </summary>
        {inService.length === 0 ? (
          <div className="p-3 text-charcoal-muted text-xs">
            {language === "id"
              ? "Tidak ada kapster yang sedang melayani walk-in."
              : "No barbers currently serving walk-ins."}
          </div>
        ) : (
          <div className="divide-y divide-stone bg-white">
            {inService.map((item) => (
              <div
                className="queue-compact flex items-center justify-between gap-2 p-3 text-xs"
                key={item.id}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-7 h-7 rounded-full bg-charcoal text-ivory-light flex items-center justify-center text-[10px] font-bold shrink-0">
                    {getInitials(item.customer_name)}
                  </span>
                  <div className="truncate">
                    <strong className="block text-xs font-semibold text-charcoal truncate">{item.customer_name}</strong>
                    <small className="block text-charcoal-muted text-[10px] truncate">
                      {item.service_name || (language === "id" ? "Layanan" : "Service")} ·{" "}
                      {item.assigned_staff_name || t("roles.staff")}
                    </small>
                  </div>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  className="text-[10px] px-2 py-0.5 h-6 shrink-0"
                  onClick={() => onComplete(item)}
                >
                  {language === "id" ? "Selesai & Bayar" : "Complete & Pay"}
                </Button>
              </div>
            ))}
          </div>
        )}
      </details>

      {/* Completed Section */}
      <details className="queue-section completed-section border-t border-stone">
        <summary className="flex items-center justify-between px-4 py-2.5 bg-ivory-warm/50 cursor-pointer text-xs font-semibold text-charcoal-muted select-none">
          <span className="flex items-center gap-1.5">
            <i className="status-dot complete-dot w-2 h-2 rounded-full bg-charcoal-muted inline-block" />{" "}
            {language === "id" ? "Selesai hari ini" : "Completed today"}
          </span>
          <b className="font-mono text-xs font-normal">{completed.length}</b>
        </summary>
        {completed.length === 0 ? (
          <div className="p-3 text-charcoal-muted text-xs">
            {language === "id"
              ? "Belum ada walk-in yang selesai hari ini."
              : "No completed walk-ins recorded yet today."}
          </div>
        ) : (
          <div className="divide-y divide-stone bg-white">
            {completed.map((item) => (
              <div className="queue-compact flex items-center justify-between gap-2 p-2.5 text-xs opacity-75" key={item.id}>
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-6 h-6 rounded-full bg-stone-muted/50 text-charcoal flex items-center justify-center text-[9px] font-bold shrink-0">
                    {getInitials(item.customer_name)}
                  </span>
                  <div className="truncate">
                    <strong className="block text-xs font-medium text-charcoal truncate">{item.customer_name}</strong>
                    <small className="block text-charcoal-muted text-[10px] truncate">
                      {item.service_name} · {formatRupiah(item.price_snapshot)}
                    </small>
                  </div>
                </div>
                <span className="text-charcoal-muted text-[10px] shrink-0 font-mono">{formatTimeOnly(item.finished_at)}</span>
              </div>
            ))}
          </div>
        )}
      </details>
      </div>
    </aside>
  )
}
