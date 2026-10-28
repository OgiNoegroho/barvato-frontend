import React, { useState, useEffect, useCallback, useMemo } from "react"
import { Badge } from "../../components/ui/Badge"
import { Icon } from "../../components/ui/Icon"
import {
  overviewApi,
  queueApi,
  appointmentApi,
  staffApi,
  shopApi,
  type ShopOverview,
  type ApiQueueEntry,
  type ApiAppointment,
  type StaffItem,
  type ShopHour,
  ApiError,
} from "../../lib/api"
import { formatRupiah, formatMinutesAgo, getInitials } from "../../lib/format"
import { Chair } from "./Chair"

interface OverviewPageProps {
  onSchedule: () => void
  onQueue: () => void
  onNew: () => void
}

export function OverviewPage({
  onSchedule,
  onQueue,
  onNew,
}: OverviewPageProps) {
  const [overview, setOverview] = useState<ShopOverview | null>(null)
  const [queue, setQueue] = useState<ApiQueueEntry[]>([])
  const [appointments, setAppointments] = useState<ApiAppointment[]>([])
  const [staff, setStaff] = useState<StaffItem[]>([])
  const [hours, setHours] = useState<ShopHour[]>([])

  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], [])

  const loadDashboardData = useCallback(async () => {
    setIsLoading(true)
    setErrorMessage(null)

    const from = `${todayStr}T00:00:00Z`
    const to = `${todayStr}T23:59:59Z`

    try {
      const [overviewRes, queueRes, apptsRes, staffRes, hoursRes] =
        await Promise.all([
          overviewApi.get(todayStr).catch(() => null),
          queueApi.list().catch(() => ({ queue: [] })),
          appointmentApi.list(from, to, undefined, false).catch(() => ({ appointments: [] })),
          staffApi.list(true).catch(() => ({ staff: [] })),
          shopApi.getHours().catch(() => ({ hours: [] })),
        ])

      setOverview(overviewRes)
      setQueue(queueRes.queue || [])
      setAppointments(apptsRes.appointments || [])
      setStaff(staffRes.staff || [])
      setHours(hoursRes.hours || [])
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message || `Failed to load overview data (${err.code})`)
      } else if (err instanceof Error) {
        setErrorMessage(err.message)
      } else {
        setErrorMessage("Network error loading dashboard.")
      }
    } finally {
      setIsLoading(false)
    }
  }, [todayStr])

  useEffect(() => {
    loadDashboardData()
  }, [loadDashboardData])

  // Waiting queue entries
  const waitingQueue = useMemo(
    () => queue.filter((q) => q.status === "waiting"),
    [queue]
  )

  // In-service queue entries
  const servingQueue = useMemo(
    () => queue.filter((q) => q.status === "in_service"),
    [queue]
  )

  // Checked-in (in chair) appointments
  const inChairAppts = useMemo(
    () => appointments.filter((a) => a.status === "checked_in"),
    [appointments]
  )

  // Calculate shop open status for today
  const todayDayOfWeek = new Date().getDay()
  const todayHours = hours.find((h) => h.day_of_week === todayDayOfWeek)
  const isShopOpenToday = todayHours ? todayHours.is_open : true
  const closingTimeFormatted = todayHours?.close_time
    ? todayHours.close_time.slice(0, 5)
    : "21:00"

  // Average ticket (computed on backend if available, or fallback to 0)
  const avgTicket = overview?.average_ticket ?? 0

  // Total appointments derived from backend scheduled, checked-in, and completed counts
  const totalAppointments = overview
    ? overview.scheduled_count + overview.checked_in_count + overview.completed_count
    : appointments.length
  const completedAppointments = overview?.completed_count ?? 0
  const remainingAppointments = overview
    ? overview.scheduled_count + overview.checked_in_count
    : Math.max(0, appointments.length - completedAppointments)

  // Total walk-ins derived from backend queue waiting and serving counts
  const totalWalkins = overview
    ? overview.queue_waiting_count + overview.queue_serving_count
    : queue.length
  const waitingWalkins = overview?.queue_waiting_count ?? waitingQueue.length

  return (
    <div className="overview-layout">
      <section className="today-panel">
        <div className="section-head">
          <div>
            <span className="section-index">01</span>
            <h2>Today at a glance</h2>
          </div>
          <Badge tone={isShopOpenToday ? "success" : "neutral"}>
            {isShopOpenToday ? `Open · until ${closingTimeFormatted}` : "Closed today"}
          </Badge>
        </div>

        {errorMessage && (
          <div
            className="login-error-alert"
            role="alert"
            style={{ marginBottom: "16px", color: "var(--red, #cf3c3c)" }}
          >
            <Icon name="bell" size={16} />
            <span>{errorMessage}</span>
            <button
              type="button"
              className="filter-button"
              style={{ marginLeft: "auto", fontSize: "10px" }}
              onClick={loadDashboardData}
            >
              Retry
            </button>
          </div>
        )}

        <div className="pulse-row">
          <div className="pulse-feature">
            <span className="label">Net revenue</span>
            <strong>{formatRupiah(overview?.net_revenue ?? 0)}</strong>
            <span style={{ fontSize: "10px", color: "var(--muted)", marginTop: "4px" }}>
              {overview?.completed_jobs ?? completedAppointments} completed services today
            </span>
          </div>

          <div className="pulse-stat">
            <span className="label">Appointments</span>
            <strong>
              {completedAppointments}
              <em> / {totalAppointments}</em>
            </strong>
            <small>{remainingAppointments} remaining today</small>
          </div>

          <div className="pulse-stat">
            <span className="label">Walk-ins</span>
            <strong>{totalWalkins}</strong>
            <small>{waitingWalkins} currently waiting</small>
          </div>

          <div className="pulse-stat">
            <span className="label">Avg. ticket</span>
            <strong>{formatRupiah(avgTicket)}</strong>
            <small>Per completed chair</small>
          </div>
        </div>

        <div className="section-head schedule-title">
          <div>
            <span className="section-index">02</span>
            <h2>In the chairs</h2>
          </div>
          <button className="text-button" onClick={onSchedule}>
            Schedule <Icon name="chevron" size={14} />
          </button>
        </div>

        <div className="chair-list">
          {isLoading ? (
            <div style={{ padding: "32px 0", textAlign: "center", color: "var(--muted)", fontSize: "11px" }}>
              Loading chair status...
            </div>
          ) : staff.length === 0 ? (
            <div style={{ padding: "32px 16px", textAlign: "center", color: "var(--muted)", fontSize: "12px", borderBottom: "1px solid var(--line)" }}>
              No active barbers in staff roster. Add barbers under Team or Settings.
            </div>
          ) : (
            staff.map((barber) => {
              // 1. Check if barber is currently serving a walk-in
              const activeWalkIn = servingQueue.find(
                (q) => q.assigned_staff_id === barber.id
              )

              // 2. Check if barber is currently serving a checked-in appointment
              const activeAppt = inChairAppts.find(
                (a) => a.staff_id === barber.id
              )

              const activeJob = activeWalkIn || activeAppt
              const isFree = !activeJob

              let clientName = "Available"
              let serviceName = "Ready for walk-in or booking"
              let progressPct = 0
              let timeLeft = "Ready"

              if (activeJob) {
                clientName = activeJob.customer_name
                serviceName = activeJob.service_name || "Grooming Service"
                const duration = activeJob.duration_snapshot_min || 30

                // Calculate progress
                const startTimeStr =
                  "started_at" in activeJob && activeJob.started_at
                    ? activeJob.started_at
                    : "starts_at" in activeJob
                    ? activeJob.starts_at
                    : activeJob.created_at

                const startMs = new Date(startTimeStr).getTime()
                const elapsedMin = Math.max(0, Math.floor((Date.now() - startMs) / (60 * 1000)))
                progressPct = Math.min(100, Math.round((elapsedMin / duration) * 100))
                const remainingMin = Math.max(1, duration - elapsedMin)
                timeLeft = `${remainingMin} min left`
              }

              return (
                <Chair
                  key={barber.id}
                  initials={getInitials(barber.name)}
                  name={barber.name}
                  client={clientName}
                  service={serviceName}
                  time={timeLeft}
                  progress={progressPct}
                  free={isFree}
                  role={barber.contact || "Barber"}
                />
              )
            })
          )}
        </div>
      </section>

      <aside className="side-stack">
        <section className="queue-panel">
          <div className="section-head">
            <div>
              <span className="section-index">03</span>
              <h2>Walk-in queue</h2>
            </div>
            <button
              className="icon-button mini"
              onClick={onNew}
              aria-label="Add walk-in"
              title="Add walk-in customer"
            >
              <Icon name="plus" size={16} />
            </button>
          </div>

          <div className="wait-callout">
            <span>
              <b>{waitingQueue.length}</b> waiting
            </span>
            <span>
              In chairs <b>{servingQueue.length}</b>
            </span>
          </div>

          {isLoading ? (
            <div style={{ padding: "24px 0", textAlign: "center", color: "var(--muted)", fontSize: "11px" }}>
              Loading queue...
            </div>
          ) : waitingQueue.length === 0 ? (
            <div style={{ padding: "24px 12px", textAlign: "center", color: "var(--muted)", fontSize: "11px" }}>
              No walk-in clients waiting in queue.
            </div>
          ) : (
            waitingQueue.slice(0, 5).map((item, index) => {
              const waitTime = formatMinutesAgo(item.arrived_at)

              return (
                <div className="queue-mini" key={item.id}>
                  <span className="queue-no">0{index + 1}</span>
                  <span className="avatar">{getInitials(item.customer_name)}</span>
                  <span className="grow">
                    <strong>{item.customer_name}</strong>
                    <small>{item.service_name || "Haircut"}</small>
                  </span>
                  <span className="wait">{waitTime}</span>
                </div>
              )
            })
          )}

          <button className="wide-button" onClick={onQueue}>
            Manage queue <Icon name="arrow" size={16} />
          </button>
        </section>

        <section className="payments-strip">
          <div>
            <span>Bank Transfer</span>
            <strong>{formatRupiah(overview?.net_transfer ?? 0)}</strong>
          </div>
          <div>
            <span>Cash</span>
            <strong>{formatRupiah(overview?.net_cash ?? 0)}</strong>
          </div>
          <button
            type="button"
            aria-label="Refresh financial overview"
            title="Refresh overview metrics"
            onClick={loadDashboardData}
          >
            <Icon name="more" />
          </button>
        </section>
      </aside>
    </div>
  )
}
