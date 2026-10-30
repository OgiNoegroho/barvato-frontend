import React from "react"
import { cn } from "../../lib/utils"

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
    <div className="chair-row min-h-[70px] grid grid-cols-[auto_1fr_auto] sm:grid-cols-[auto_1fr_1.6fr_1.2fr_auto] gap-3 items-center py-2.5 sm:py-3 border-b border-stone last:border-b-0">
      <span
        className={cn(
          "avatar w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 transition-colors",
          free ? "bg-stone/50 text-muted-text" : "bg-charcoal text-ivory-light"
        )}
      >
        {initials}
      </span>

      <div className="barber min-w-0">
        <strong className="block text-xs font-semibold text-charcoal truncate">{name}</strong>
        <small className="block text-2xs text-muted-text mt-0.5 truncate">{role}</small>
      </div>

      <div className="chair-client flex items-center gap-2 min-w-0 col-span-2 sm:col-span-1">
        <span
          className={cn(
            "status-dot w-2 h-2 rounded-full shrink-0",
            free ? "bg-stone" : "bg-forest animate-pulse"
          )}
        />
        <div className="min-w-0 flex-1">
          <strong className="block text-xs font-medium text-charcoal truncate">{client}</strong>
          <small className="block text-2xs text-muted-text mt-0.5 truncate">{service}</small>
        </div>
      </div>

      <div className="progress-wrap flex items-center gap-2.5 text-2xs text-muted-text col-start-3 row-start-1 sm:col-start-auto sm:row-start-auto">
        <div className="progress w-14 h-1 bg-ivory-warm rounded-full overflow-hidden shrink-0">
          <i
            className="block h-full bg-copper transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="font-mono text-2xs whitespace-nowrap">{time}</span>
      </div>
    </div>
  )
}
