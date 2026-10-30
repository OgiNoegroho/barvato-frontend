export type Page = "Overview" | "Operations" | "Appointments" | "Team" | "Money" | "Settings"

export type IconName =
  | "grid"
  | "calendar"
  | "users"
  | "book"
  | "scissors"
  | "wallet"
  | "settings"
  | "plus"
  | "search"
  | "bell"
  | "chevron"
  | "chevron-down"
  | "chevron-up"
  | "chevron-left"
  | "chevron-right"
  | "clock"
  | "more"
  | "arrow"

export type Tone = "copper" | "ink" | "stone" | "forest" | "amber" | string

export interface NavItem {
  label: Page
  icon: IconName
}

export interface Appointment {
  time: string
  end: string
  name: string
  service: string
  barber: string
  tone: Tone
  top: number
  height: number
}

export interface QueueItem {
  id: number
  initials: string
  name: string
  service: string
  wait: string
  barber: string
  state: string
}

export interface OpsQueueItem {
  id: number
  initials: string
  name: string
  service: string
  wait: string
  barber: string
  state: "waiting" | "service" | "completed"
  arrival: string
  assigned?: string
}

export interface TeamMember {
  initials: string
  name: string
  role: string
  bookingsToday: string
  revenue: string
}

export interface TransactionRecord {
  date: string
  time: string
  client: string
  service: string
  barber: string
  payment: string
  status: "Paid" | "Refunded"
  amount: string
}

export interface FinancePerson {
  initials: string
  name: string
  services: string
  revenue: string
  commissionOwed: string
  rate: string
  payoutStatus: string
}
