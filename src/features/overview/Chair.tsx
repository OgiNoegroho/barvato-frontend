import React from "react"

export interface ChairProps {
  initials: string
  name: string
  client: string
  service: string
  time: string
  progress: number
  free?: boolean
  role?: string
}

export function Chair({
  initials,
  name,
  client,
  service,
  time,
  progress,
  free,
  role = "Staff barber",
}: ChairProps) {
  return (
    <div className="chair-row">
      <span className={`avatar ${free ? "free" : ""}`}>{initials}</span>
      <div className="barber">
        <strong>{name}</strong>
        <small>{role}</small>
      </div>
      <div className="chair-client">
        <span className={`status-dot ${free ? "" : "service-dot"}`} />
        <div>
          <strong>{client}</strong>
          <small>{service}</small>
        </div>
      </div>
      <div className="progress-wrap">
        <div className="progress">
          <i style={{ width: `${progress}%` }} />
        </div>
        <span>{time}</span>
      </div>
    </div>
  )
}
