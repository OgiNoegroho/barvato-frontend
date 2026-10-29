import type {
  ShopHour,
  ShopClosure,
  StaffHour,
  StaffException,
  ApiAppointment,
  ApiQueueEntry,
} from "./api.ts"
import {
  getTimeInTimezone,
  getDateStringInTimezone,
  getDayOfWeekInTimezone,
} from "./format.ts"

export const SLOT_HEIGHT = 68

/**
 * Clearly documented default fallback when shop hours are missing, invalid, or unconfigured:
 * Regular fallback hours: 09:00 to 21:00.
 * Dynamic timeline range with +/- 1 hour buffer: 08:00 to 22:00.
 */
export const DEFAULT_OPEN_HOUR = 9
export const DEFAULT_OPEN_MINUTE = 0
export const DEFAULT_CLOSE_HOUR = 21
export const DEFAULT_CLOSE_MINUTE = 0
export const DEFAULT_TIMELINE_START_HOUR = 8
export const DEFAULT_TIMELINE_END_HOUR = 22

export interface TimelineConfig {
  /** The integer hour at which the timeline begins (e.g. 8 for 08:00) */
  startHour: number
  /** The integer hour at which the timeline concludes (e.g. 21 for 21:00, or >24 if overnight) */
  endHour: number
  /** Formatted string of timeline start time (e.g. "08:00") */
  startFormatted: string
  /** Formatted string of timeline end time (e.g. "21:00") */
  endFormatted: string
  /** Array of human-readable hour labels for each grid slot row, e.g. ["8 AM", "9 AM", ...] */
  timeSlots: string[]
  /** Number of 1-hour slots in the timeline */
  totalHours: number
  /** Total height of the timeline grid in pixels (totalHours * slotHeight) */
  totalHeight: number
  /** Whether the timeline spans across midnight into the following calendar morning */
  isOvernight: boolean
  /** Whether the shop is designated as closed on the evaluated calendar date */
  isClosed: boolean
  /** Active shop closure or special operating-hour exception on the evaluated calendar date */
  closure?: ShopClosure | null
  /** Effective opening time (HH:MM) for the evaluated date */
  effectiveOpenTime: string
  /** Effective closing time (HH:MM) for the evaluated date */
  effectiveCloseTime: string
}

export interface CalculateTimelineOptions {
  shopHours?: ShopHour[] | null
  shopClosures?: ShopClosure[] | null
  currentDate?: Date | string
  timezone?: string
  appointments?: ApiAppointment[]
  queueItems?: ApiQueueEntry[]
  slotHeight?: number
  view?: string
}

export interface StaffDayAvailability {
  status: "available" | "day_off" | "leave" | "adjusted" | "custom_hours"
  isWorking: boolean
  openTime?: string | null
  closeTime?: string | null
  reason?: string | null
  exception?: StaffException | null
}

/**
 * Parses time strings formatted like "09:00:00", "09:00", or "21:30".
 */
export function parseTimeString(timeStr?: string | null): { hour: number; minute: number } | null {
  if (!timeStr || typeof timeStr !== "string") return null
  const parts = timeStr.trim().split(":")
  if (parts.length < 2) return null
  const h = parseInt(parts[0], 10)
  const m = parseInt(parts[1], 10)
  if (isNaN(h) || isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) return null
  return { hour: h, minute: m }
}

/**
 * Formats a 24-hour integer (0..23, or modulo for overnight hours) into a standard slot label.
 * e.g. 8 -> "8 AM", 12 -> "12 PM", 13 -> "1 PM", 20 -> "8 PM", 0 -> "12 AM".
 */
export function formatHourLabel(hour: number): string {
  const normalized = ((hour % 24) + 24) % 24
  if (normalized === 0) return "12 AM"
  if (normalized < 12) return `${normalized} AM`
  if (normalized === 12) return "12 PM"
  return `${normalized - 12} PM`
}

/**
 * Calculates dynamic calendar timeline start/end boundaries and slot rows.
 *
 * Rule:
 * timelineStart = openingTime - 1 hour
 * timelineEnd   = closingTime + 1 hour
 *
 * e.g.
 * 09:00–20:00 -> 08:00–21:00
 * 08:00–17:00 -> 07:00–18:00
 * 10:00–22:00 -> 09:00–23:00
 */
export function calculateTimelineConfig(options: CalculateTimelineOptions = {}): TimelineConfig {
  const {
    shopHours,
    shopClosures,
    currentDate = new Date(),
    timezone = "Asia/Jakarta",
    appointments = [],
    queueItems = [],
    slotHeight = SLOT_HEIGHT,
    view = "Day",
  } = options

  const evaluatedDate = typeof currentDate === "string" ? new Date(currentDate) : currentDate
  const dayOfWeek = getDayOfWeekInTimezone(evaluatedDate, timezone)
  const viewedDateStr = getDateStringInTimezone(evaluatedDate, timezone)

  let openHour = DEFAULT_OPEN_HOUR
  let openMinute = DEFAULT_OPEN_MINUTE
  let closeHour = DEFAULT_CLOSE_HOUR
  let closeMinute = DEFAULT_CLOSE_MINUTE
  let isClosed = false
  let activeClosure: ShopClosure | null = null

  if (shopHours && shopHours.length > 0) {
    if (view === "Day") {
      const match = shopHours.find((h) => h.day_of_week === dayOfWeek)
      if (match) {
        if (!match.is_open) {
          isClosed = true
        }
        const parsedOpen = parseTimeString(match.open_time)
        const parsedClose = parseTimeString(match.close_time)
        if (parsedOpen && parsedClose) {
          openHour = parsedOpen.hour
          openMinute = parsedOpen.minute
          closeHour = parsedClose.hour
          closeMinute = parsedClose.minute
        }
      }
    } else {
      // For multi-day views ("Week" or "Month"), envelop the earliest opening
      // and latest closing across all configured open days so no schedule is clipped.
      const openDays = shopHours.filter((h) => h.is_open)
      const daysToExamine = openDays.length > 0 ? openDays : shopHours

      let earliestOpen = 24
      let latestClose = 0

      for (const d of daysToExamine) {
        const pOpen = parseTimeString(d.open_time)
        const pClose = parseTimeString(d.close_time)
        if (pOpen && pClose) {
          earliestOpen = Math.min(earliestOpen, pOpen.hour)
          latestClose = Math.max(latestClose, pClose.hour + (pClose.minute > 0 ? 1 : 0))
        }
      }

      if (earliestOpen < 24 && latestClose > 0) {
        openHour = earliestOpen
        openMinute = 0
        closeHour = latestClose
        closeMinute = 0
      }
    }
  }

  // Evaluate shop closures / special operating hours on the viewed date
  if (view === "Day" && shopClosures && shopClosures.length > 0) {
    const matchingClosures = shopClosures.filter(
      (c) => c.start_date <= viewedDateStr && c.end_date >= viewedDateStr
    )
    if (matchingClosures.length > 0) {
      // Full-day closure takes precedence over adjusted hours if both exist
      activeClosure = matchingClosures.find((c) => c.is_closed) || matchingClosures[0]
      if (activeClosure.is_closed) {
        isClosed = true
      } else {
        isClosed = false
        const parsedOpen = parseTimeString(activeClosure.open_time)
        const parsedClose = parseTimeString(activeClosure.close_time)
        if (parsedOpen && parsedClose) {
          openHour = parsedOpen.hour
          openMinute = parsedOpen.minute
          closeHour = parsedClose.hour
          closeMinute = parsedClose.minute
        }
      }
    }
  }

  // Check for overnight schedule (closeHour < openHour, e.g. 20:00 to 04:00)
  const isOvernight = closeHour < openHour

  // Calculate base timeline boundaries:
  // timelineStart = 1 hour before opening (e.g. 09:00 -> 08:00)
  // timelineEnd   = 1 hour after closing (e.g. 20:00 -> 21:00)
  let startHour: number
  let endHour: number

  if (!isOvernight) {
    startHour = Math.max(0, openHour - 1)
    endHour = closeHour + (closeMinute > 0 ? 2 : 1)
    endHour = Math.min(24, Math.max(startHour + 1, endHour))
  } else {
    // Overnight operation
    startHour = Math.max(0, openHour - 1)
    endHour = 24 + closeHour + (closeMinute > 0 ? 2 : 1)
  }

  // Preserve out-of-hours appointments and walk-ins:
  // If historical bookings or early/late arrivals exist outside standard business hours,
  // expand the timeline dynamically so records never disappear or get clipped out of view.
  const relevantAppointments = appointments.filter((a) => {
    if (!a.starts_at) return false
    const apptDateStr = getDateStringInTimezone(a.starts_at, timezone)
    return view === "Day" ? apptDateStr === viewedDateStr : true
  })

  const relevantWalkins = queueItems.filter((q) => {
    if (!q.arrived_at) return false
    const eventTime =
      (q.status === "completed" || q.status === "in_service") && q.started_at
        ? q.started_at
        : q.arrived_at
    const walkinDateStr = getDateStringInTimezone(eventTime, timezone)
    return view === "Day" ? walkinDateStr === viewedDateStr : true
  })

  for (const a of relevantAppointments) {
    const { hour: aStartH } = getTimeInTimezone(a.starts_at, timezone)
    const { hour: aEndH, minute: aEndM } = getTimeInTimezone(a.ends_at, timezone)

    let effStart = aStartH
    let effEnd = aEndH + (aEndM > 0 ? 1 : 0)

    if (isOvernight) {
      if (effStart < startHour) effStart += 24
      if (effEnd < startHour) effEnd += 24
    }

    if (effStart < startHour) {
      startHour = Math.max(0, effStart - 1)
    }
    if (effEnd > endHour) {
      endHour = isOvernight ? Math.max(endHour, effEnd + 1) : Math.min(24, effEnd + 1)
    }
  }

  for (const q of relevantWalkins) {
    const startTime =
      (q.status === "completed" || q.status === "in_service") && q.started_at
        ? q.started_at
        : q.arrived_at
    const { hour: qStartH } = getTimeInTimezone(startTime, timezone)
    let duration = q.duration_snapshot_min || 30
    if (q.status === "completed" && q.started_at && q.finished_at) {
      const diffMin = Math.round(
        (new Date(q.finished_at).getTime() - new Date(q.started_at).getTime()) / 60000
      )
      if (diffMin >= 5) {
        duration = diffMin
      }
    }
    const endMinutes = qStartH * 60 + duration
    const qEndH = Math.ceil(endMinutes / 60)

    let effStart = qStartH
    let effEnd = qEndH

    if (isOvernight) {
      if (effStart < startHour) effStart += 24
      if (effEnd < startHour) effEnd += 24
    }

    if (effStart < startHour) {
      startHour = Math.max(0, effStart - 1)
    }
    if (effEnd > endHour) {
      endHour = isOvernight ? Math.max(endHour, effEnd + 1) : Math.min(24, effEnd + 1)
    }
  }

  const totalHours = Math.max(1, endHour - startHour)
  const totalHeight = totalHours * slotHeight

  const timeSlots: string[] = []
  for (let h = startHour; h < endHour; h++) {
    timeSlots.push(formatHourLabel(h))
  }

  const startFormatted = `${String(startHour).padStart(2, "0")}:00`
  const endFormatted = `${String(endHour % 24).padStart(2, "0")}:00`
  const effectiveOpenTime = `${String(openHour).padStart(2, "0")}:${String(openMinute).padStart(2, "0")}`
  const effectiveCloseTime = `${String(closeHour).padStart(2, "0")}:${String(closeMinute).padStart(2, "0")}`

  return {
    startHour,
    endHour,
    startFormatted,
    endFormatted,
    timeSlots,
    totalHours,
    totalHeight,
    isOvernight,
    isClosed,
    closure: activeClosure,
    effectiveOpenTime,
    effectiveCloseTime,
  }
}

/**
 * Evaluates a kapster's availability status on a given calendar date (YYYY-MM-DD) and day of week (0-6).
 * Priority: one-time leave/exception (`staff_exceptions`) > recurring weekly schedule (`staff_hours`).
 */
export function getStaffDayAvailability(
  staffId: number,
  dateStr: string,
  dayOfWeek: number,
  staffHours?: StaffHour[] | null,
  staffExceptions?: StaffException[] | null
): StaffDayAvailability {
  if (staffExceptions && staffExceptions.length > 0) {
    const matches = staffExceptions.filter(
      (e) => e.staff_id === staffId && e.start_date <= dateStr && e.end_date >= dateStr
    )
    if (matches.length > 0) {
      const exc = matches.find((e) => !e.is_working) || matches[0]
      if (!exc.is_working) {
        return {
          status: "leave",
          isWorking: false,
          reason: exc.reason,
          exception: exc,
        }
      }
      return {
        status: "adjusted",
        isWorking: true,
        openTime: exc.open_time ? exc.open_time.slice(0, 5) : null,
        closeTime: exc.close_time ? exc.close_time.slice(0, 5) : null,
        reason: exc.reason,
        exception: exc,
      }
    }
  }

  if (staffHours && staffHours.length > 0) {
    const sh = staffHours.find((h) => h.staff_id === staffId && h.day_of_week === dayOfWeek)
    if (sh) {
      if (!sh.is_working) {
        return {
          status: "day_off",
          isWorking: false,
        }
      }
      return {
        status: "custom_hours",
        isWorking: true,
        openTime: sh.open_time ? sh.open_time.slice(0, 5) : null,
        closeTime: sh.close_time ? sh.close_time.slice(0, 5) : null,
      }
    }
  }

  return {
    status: "available",
    isWorking: true,
  }
}

/**
 * Checks whether an appointment or walk-in conflicts with a shop closure, weekly shop closed day,
 * kapster leave/exception, or kapster recurring day off / working hours.
 */
export function getBookingConflictReason(
  item: { startsAt: string; endsAt: string; staffId?: number | null },
  options: {
    timezone: string
    shopHours?: ShopHour[] | null
    shopClosures?: ShopClosure[] | null
    staffHours?: StaffHour[] | null
    staffExceptions?: StaffException[] | null
  }
): "shop_closed" | "staff_unavailable" | null {
  const { timezone, shopHours, shopClosures, staffHours, staffExceptions } = options
  if (!item.startsAt || !item.endsAt) return null

  const dateStr = getDateStringInTimezone(item.startsAt, timezone)
  const dayOfWeek = getDayOfWeekInTimezone(item.startsAt, timezone)
  const startParts = getTimeInTimezone(item.startsAt, timezone)
  const endParts = getTimeInTimezone(item.endsAt, timezone)
  const startHm = `${String(startParts.hour).padStart(2, "0")}:${String(startParts.minute).padStart(2, "0")}`
  const endHm = `${String(endParts.hour).padStart(2, "0")}:${String(endParts.minute).padStart(2, "0")}`

  // 1. Check shop closures on dateStr
  if (shopClosures && shopClosures.length > 0) {
    const matchingClosures = shopClosures.filter(
      (c) => c.start_date <= dateStr && c.end_date >= dateStr
    )
    if (matchingClosures.length > 0) {
      const closure = matchingClosures.find((c) => c.is_closed) || matchingClosures[0]
      if (closure.is_closed) {
        return "shop_closed"
      }
      if (closure.open_time && closure.close_time) {
        const cOpen = closure.open_time.slice(0, 5)
        const cClose = closure.close_time.slice(0, 5)
        if (startHm < cOpen || endHm > cClose) {
          return "shop_closed"
        }
      }
    } else if (shopHours && shopHours.length > 0) {
      const sh = shopHours.find((h) => h.day_of_week === dayOfWeek)
      if (sh && !sh.is_open) {
        return "shop_closed"
      }
    }
  } else if (shopHours && shopHours.length > 0) {
    const sh = shopHours.find((h) => h.day_of_week === dayOfWeek)
    if (sh && !sh.is_open) {
      return "shop_closed"
    }
  }

  // 2. Check kapster availability if staffId is present
  if (item.staffId) {
    const staffAvail = getStaffDayAvailability(
      item.staffId,
      dateStr,
      dayOfWeek,
      staffHours,
      staffExceptions
    )
    if (!staffAvail.isWorking) {
      return "staff_unavailable"
    }
    if (staffAvail.openTime && staffAvail.closeTime) {
      if (startHm < staffAvail.openTime || endHm > staffAvail.closeTime) {
        return "staff_unavailable"
      }
    }
  }

  return null
}

/**
 * Calculates vertical pixel offset for an event or slot relative to timeline startHour.
 */
export function getSlotTop(
  dateStr: string,
  timeZone: string,
  timelineStartHour: number,
  slotHeight = SLOT_HEIGHT,
  totalHeight?: number,
  isOvernight = false
): number {
  const { hour, minute } = getTimeInTimezone(dateStr, timeZone)
  let effectiveHour = hour
  if (isOvernight && hour < timelineStartHour) {
    effectiveHour = hour + 24
  }
  const minsFromStart = (effectiveHour - timelineStartHour) * 60 + minute
  const top = (minsFromStart / 60) * slotHeight
  if (totalHeight != null) {
    return Math.max(0, Math.min(totalHeight, top))
  }
  return Math.max(0, top)
}

/**
 * Calculates current time line position and whether it is within the timeline range.
 */
export function getNowPosition(
  currentTime: Date,
  timeZone: string,
  timelineStartHour: number,
  totalHeight: number,
  slotHeight = SLOT_HEIGHT,
  isOvernight = false
): { top: number; isWithinTimeline: boolean } {
  const { hour, minute } = getTimeInTimezone(currentTime, timeZone)
  let effectiveHour = hour
  if (isOvernight && hour < timelineStartHour) {
    effectiveHour = hour + 24
  }
  const nowMins = (effectiveHour - timelineStartHour) * 60 + minute
  const top = (nowMins / 60) * slotHeight
  const isWithinTimeline = top >= 0 && top <= totalHeight
  return { top, isWithinTimeline }
}
