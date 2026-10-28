import React, { useState, useEffect, useCallback } from "react"
import {
  staffApi,
  appointmentApi,
  type StaffItem,
  type StaffScheduleItem,
  type ApiAppointment,
  ApiError,
} from "../../lib/api"
import { Badge } from "../../components/ui/Badge"
import { Icon } from "../../components/ui/Icon"
import { getInitials, formatTimeOnly } from "../../lib/format"

interface TeamScheduleProps {
  staff: StaffItem
  onClose: () => void
}

export function TeamSchedule({ staff, onClose }: TeamScheduleProps) {
  const [currentDate, setCurrentDate] = useState(() => new Date())
  const [schedule, setSchedule] = useState<StaffScheduleItem | null>(null)
  const [appointments, setAppointments] = useState<ApiAppointment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const dateStr = currentDate.toISOString().split("T")[0]

  const loadDayData = useCallback(async () => {
    setIsLoading(true)
    setErrorMessage(null)

    const from = `${dateStr}T00:00:00Z`
    const to = `${dateStr}T23:59:59Z`

    try {
      const [schedRes, apptRes] = await Promise.all([
        staffApi.getSchedule(staff.id, dateStr).catch(() => ({
          schedule: {
            staff_id: staff.id,
            date: dateStr,
            day_of_week: currentDate.getDay(),
            is_open: true,
            open_time: "09:00:00",
            close_time: "21:00:00",
          },
        })),
        appointmentApi.list(from, to, staff.id, true).catch(() => ({ appointments: [] })),
      ])

      setSchedule(schedRes.schedule)
      setAppointments(apptRes.appointments || [])
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message || "Failed to load schedule")
      } else if (err instanceof Error) {
        setErrorMessage(err.message)
      } else {
        setErrorMessage("Network error loading schedule")
      }
    } finally {
      setIsLoading(false)
    }
  }, [staff.id, dateStr, currentDate])

  useEffect(() => {
    loadDayData()
  }, [loadDayData])

  const handlePrevDay = () => {
    setCurrentDate((prev) => {
      const next = new Date(prev)
      next.setDate(next.getDate() - 1)
      return next
    })
  }

  const handleNextDay = () => {
    setCurrentDate((prev) => {
      const next = new Date(prev)
      next.setDate(next.getDate() + 1)
      return next
    })
  }

  const initials = getInitials(staff.name)
  const isOff = schedule ? !schedule.is_open : false

  // Calculate workload metrics
  const activeAppts = appointments.filter((a) => a.status !== "cancelled" && a.status !== "no_show")
  const totalBookedMinutes = activeAppts.reduce((sum, a) => sum + (a.duration_snapshot_min || 30), 0)
  const clientHours = Math.floor(totalBookedMinutes / 60)
  const clientMinutes = totalBookedMinutes % 60
  const clientTimeFormatted = clientHours > 0 ? `${clientHours}h ${clientMinutes}m` : `${clientMinutes}m`

  const dateHeading = currentDate.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  })

  return (
    <div className="team-schedule-backdrop" onMouseDown={onClose}>
      <aside
        className="team-schedule-drawer"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="team-schedule-title"
      >
        <div className="modal-head">
          <div className="schedule-profile">
            <span className="avatar portrait">{initials}</span>
            <div>
              <span className="section-index">TEAM SCHEDULE</span>
              <h2 id="team-schedule-title">{staff.name}</h2>
              <p>{staff.contact || (staff.active ? "Active Barber" : "Inactive Barber")}</p>
            </div>
          </div>
          <button
            className="icon-button"
            onClick={onClose}
            aria-label="Close schedule"
          >
            ×
          </button>
        </div>

        <div className="schedule-datebar">
          <button onClick={handlePrevDay} aria-label="Previous day">
            ‹
          </button>
          <div>
            <strong>{dateHeading}</strong>
            <small>
              {isOff
                ? "Not scheduled / Closed"
                : schedule
                ? `${schedule.open_time.slice(0, 5)} – ${schedule.close_time.slice(0, 5)}`
                : "9:00 AM – 9:00 PM"}
            </small>
          </div>
          <button onClick={handleNextDay} aria-label="Next day">
            ›
          </button>
        </div>

        {errorMessage && (
          <div
            className="login-error-alert"
            role="alert"
            style={{ margin: "16px 20px", color: "var(--red, #cf3c3c)" }}
          >
            <Icon name="bell" size={16} />
            <span>{errorMessage}</span>
          </div>
        )}

        {isLoading ? (
          <div style={{ padding: "48px 24px", textAlign: "center", color: "var(--muted)", fontSize: "11px" }}>
            Loading barber agenda...
          </div>
        ) : isOff ? (
          <div className="staff-off-state">
            <span className="avatar portrait">{initials}</span>
            <h3>Day off</h3>
            <p>{staff.name} isn’t scheduled to work on this day.</p>
          </div>
        ) : (
          <>
            <div className="staff-workload">
              <span>
                <small>BOOKINGS</small>
                <strong>{activeAppts.length}</strong>
              </span>
              <span>
                <small>CLIENT TIME</small>
                <strong>{clientTimeFormatted}</strong>
              </span>
              <span>
                <small>COMMISSION</small>
                <strong>
                  {staff.commission_bps != null ? `${staff.commission_bps / 100}%` : "Standard"}
                </strong>
              </span>
            </div>

            <div className="staff-agenda">
              <div className="agenda-line" />
              {activeAppts.length === 0 ? (
                <div style={{ padding: "36px 16px", textAlign: "center", color: "var(--muted)", fontSize: "11px" }}>
                  No appointments scheduled for {staff.name} on this date.
                </div>
              ) : (
                activeAppts.map((item) => {
                  const startTime = formatTimeOnly(item.starts_at)
                  const endTime = formatTimeOnly(item.ends_at)
                  const isCheckedIn = item.status === "checked_in"
                  const isCompleted = item.status === "completed"

                  return (
                    <article className="agenda-item" key={item.id}>
                      <div className="agenda-time">
                        <strong>{startTime}</strong>
                        <span>{endTime}</span>
                      </div>
                      <div className={`agenda-block ${isCheckedIn ? "service-dot" : ""}`}>
                        <div>
                          <Badge
                            tone={
                              isCompleted
                                ? "neutral"
                                : isCheckedIn
                                ? "success"
                                : "neutral"
                            }
                          >
                            {isCheckedIn
                              ? "In service"
                              : isCompleted
                              ? "Completed"
                              : "Confirmed"}
                          </Badge>
                          <span>{item.duration_snapshot_min || 30} min</span>
                        </div>
                        <h3>{item.customer_name}</h3>
                        <p>{item.service_name}</p>
                      </div>
                    </article>
                  )
                })
              )}
            </div>
          </>
        )}

        <div className="schedule-drawer-actions">
          <button className="filter-button" onClick={onClose}>
            Close
          </button>
        </div>
      </aside>
    </div>
  )
}
