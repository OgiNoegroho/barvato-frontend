import { Icon } from "../../components/ui/Icon"
import { Button } from "../../components/ui/Button"
import type { StaffItem } from "../../lib/api"
import { useI18n } from "../../lib/i18n"

interface OpsToolbarProps {
  view: string
  onViewChange: (view: string) => void
  currentDateLabel: string
  onPrev: () => void
  onNext: () => void
  onToday: () => void
  onAppointment: () => void
  onWalkin: () => void
  barberFilter?: number | "all"
  onBarberFilterChange?: (barberId: number | "all") => void
  staffList?: StaffItem[]
  statusFilter?: string
  onStatusFilterChange?: (status: string) => void
  searchQuery?: string
  onSearchChange?: (q: string) => void
}

export function OpsToolbar({
  view,
  onViewChange,
  currentDateLabel,
  onPrev,
  onNext,
  onToday,
  onAppointment,
  onWalkin,
  barberFilter = "all",
  onBarberFilterChange,
  staffList = [],
  statusFilter = "all",
  onStatusFilterChange,
  searchQuery = "",
  onSearchChange,
}: OpsToolbarProps) {
  const { t, language } = useI18n()

  const viewLabels: Record<string, string> = {
    Day: t("operations.viewDay"),
    Week: t("operations.viewWeek"),
    Month: t("operations.viewMonth"),
  }

  return (
    <div className="ops-toolbar flex flex-wrap items-center gap-2 sm:gap-3 p-2.5 sm:p-3 bg-white border-b border-stone-line">
      {/* Date Switch */}
      <div className="date-switch flex items-center gap-1.5">
        <button
          aria-label={`Previous ${view.toLowerCase()}`}
          onClick={onPrev}
          type="button"
          className="w-7 h-7 flex items-center justify-center border border-stone-line bg-white hover:border-copper rounded-sm text-sm text-charcoal-ink transition-colors"
        >
          ‹
        </button>
        <button
          className="today px-2.5 h-7 flex items-center justify-center border border-stone-line bg-white hover:border-copper rounded-sm text-xs font-medium text-charcoal-ink transition-colors"
          onClick={onToday}
          type="button"
        >
          {t("operations.today")}
        </button>
        <button
          aria-label={`Next ${view.toLowerCase()}`}
          onClick={onNext}
          type="button"
          className="w-7 h-7 flex items-center justify-center border border-stone-line bg-white hover:border-copper rounded-sm text-sm text-charcoal-ink transition-colors"
        >
          ›
        </button>
        <span className="font-serif text-lg text-charcoal-ink ml-1.5">{currentDateLabel}</span>
      </div>

      {/* Segmented View Controls */}
      <div className="segmented flex bg-ivory-paper p-0.5 rounded-sm border border-stone-line sm:ml-2">
        {["Day", "Week", "Month"].map((value) => (
          <button
            key={value}
            className={`px-2.5 py-1 text-xs rounded-sm transition-all font-medium ${
              view === value
                ? "bg-white text-charcoal-ink shadow-xs font-semibold"
                : "text-charcoal-muted hover:text-charcoal-ink"
            }`}
            onClick={() => onViewChange(value)}
            type="button"
          >
            {viewLabels[value] || value}
          </button>
        ))}
      </div>

      {/* Barber Filter */}
      <select
        className="filter-button h-8 border border-stone-line bg-white px-2 text-xs rounded-sm focus:outline-none focus:border-copper text-charcoal-ink"
        value={barberFilter}
        onChange={(e) =>
          onBarberFilterChange?.(
            e.target.value === "all" ? "all" : Number(e.target.value)
          )
        }
        aria-label={t("operations.allBarbers")}
      >
        <option value="all">{t("operations.allBarbers")}</option>
        {staffList.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>

      {/* Status Filter */}
      <select
        className="filter-button status-filter h-8 border border-stone-line bg-white px-2 text-xs rounded-sm focus:outline-none focus:border-copper text-charcoal-ink"
        value={statusFilter}
        onChange={(e) => onStatusFilterChange?.(e.target.value)}
        aria-label={t("common.filter")}
      >
        <option value="all">{t("appointments.allStatuses")}</option>
        <option value="scheduled">{t("status.confirmed")}</option>
        <option value="checked_in">{t("status.checked_in")}</option>
        <option value="completed">{t("status.completed")}</option>
        <option value="cancelled">{t("status.cancelled")}</option>
      </select>

      {/* Search Input */}
      <div className="search ops-search flex items-center gap-1.5 px-2.5 h-8 border border-stone-line bg-white rounded-sm text-xs focus-within:border-copper ml-auto sm:ml-0">
        <Icon name="search" size={14} className="text-charcoal-muted shrink-0" />
        <input
          aria-label={t("common.search")}
          placeholder={language === "id" ? "Cari pelanggan..." : "Find customer..."}
          value={searchQuery}
          onChange={(e) => onSearchChange?.(e.target.value)}
          className="bg-transparent text-charcoal-ink text-xs focus:outline-none w-28 sm:w-36 placeholder:text-charcoal-muted"
        />
      </div>

      {/* Action Buttons */}
      <div className="ops-actions flex items-center gap-2 ml-auto">
        <Button variant="outline" size="sm" onClick={onAppointment} type="button" className="gap-1.5">
          <Icon name="plus" size={13} /> {t("nav.appointments")}
        </Button>
        <Button variant="primary" size="sm" onClick={onWalkin} type="button" className="gap-1.5">
          <Icon name="plus" size={13} /> {t("shell.walkin")}
        </Button>
      </div>
    </div>
  )
}
