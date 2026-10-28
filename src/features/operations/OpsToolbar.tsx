import { Icon } from "../../components/ui/Icon"
import type { StaffItem } from "../../lib/api"

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
  return (
    <div className="ops-toolbar">
      <div className="date-switch">
        <button
          aria-label={`Previous ${view.toLowerCase()}`}
          onClick={onPrev}
          type="button"
        >
          ‹
        </button>
        <button
          className="today"
          onClick={onToday}
          type="button"
        >
          Today
        </button>
        <button
          aria-label={`Next ${view.toLowerCase()}`}
          onClick={onNext}
          type="button"
        >
          ›
        </button>
        <span>{currentDateLabel}</span>
      </div>
      <div className="segmented">
        {["Day", "Week", "Month"].map((value) => (
          <button
            key={value}
            className={view === value ? "active" : ""}
            onClick={() => onViewChange(value)}
            type="button"
          >
            {value}
          </button>
        ))}
      </div>
      <select
        className="filter-button"
        value={barberFilter}
        onChange={(e) =>
          onBarberFilterChange?.(
            e.target.value === "all" ? "all" : Number(e.target.value)
          )
        }
        aria-label="Filter by barber"
      >
        <option value="all">All barbers</option>
        {staffList.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
      <select
        className="filter-button status-filter"
        value={statusFilter}
        onChange={(e) => onStatusFilterChange?.(e.target.value)}
        aria-label="Filter by status"
      >
        <option value="all">All statuses</option>
        <option value="scheduled">Scheduled</option>
        <option value="checked_in">Checked In</option>
        <option value="completed">Completed</option>
        <option value="cancelled">Cancelled</option>
      </select>
      <div className="search ops-search">
        <Icon name="search" size={15} />
        <input
          aria-label="Search customers"
          placeholder="Find customer"
          value={searchQuery}
          onChange={(e) => onSearchChange?.(e.target.value)}
        />
      </div>
      <div className="ops-actions">
        <button className="filter-button" onClick={onAppointment} type="button">
          <Icon name="plus" size={14} /> Appointment
        </button>
        <button className="primary-button" onClick={onWalkin} type="button">
          <Icon name="plus" size={15} /> Walk-in
        </button>
      </div>
    </div>
  )
}
