/**
 * Formatting utilities for Indonesian Rupiah, dates, and names
 */

export function formatRupiah(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return "Rp 0"
  }
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatTimeOnly(
  isoOrDate: string | Date | null | undefined,
  timeZone = "Asia/Jakarta"
): string {
  if (!isoOrDate) return ""
  const date = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate
  if (isNaN(date.getTime())) return ""
  return date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  })
}

export function formatDateHeading(
  date: Date = new Date(),
  timeZone = "Asia/Jakarta",
  locale = "id-ID"
): string {
  return date.toLocaleDateString(locale, {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone,
  })
}

export function formatDateShort(
  isoOrDate: string | Date | null | undefined,
  timeZone = "Asia/Jakarta",
  locale = "id-ID"
): string {
  if (!isoOrDate) return ""
  const date = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate
  if (isNaN(date.getTime())) return ""
  return date.toLocaleDateString(locale, {
    weekday: "short",
    month: "numeric",
    day: "numeric",
    timeZone,
  })
}

export function getTimeInTimezone(
  isoOrDate: string | Date,
  timeZone = "Asia/Jakarta"
): { hour: number; minute: number } {
  const date = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate
  if (isNaN(date.getTime())) return { hour: 0, minute: 0 }
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  })
  const parts = formatter.formatToParts(date)
  const hourPart = parts.find((p) => p.type === "hour")?.value ?? "0"
  const minPart = parts.find((p) => p.type === "minute")?.value ?? "0"
  return {
    hour: parseInt(hourPart, 10) % 24,
    minute: parseInt(minPart, 10),
  }
}

export function getDateStringInTimezone(
  isoOrDate: string | Date = new Date(),
  timeZone = "Asia/Jakarta"
): string {
  const date = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate
  if (isNaN(date.getTime())) return ""
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
  return formatter.format(date)
}

export function getDatePartsInTimezone(
  isoOrDate: string | Date = new Date(),
  timeZone = "Asia/Jakarta"
): { year: number; month: number; day: number } {
  const dateStr = getDateStringInTimezone(isoOrDate, timeZone)
  const [yearStr, monthStr, dayStr] = dateStr.split("-")
  return {
    year: parseInt(yearStr, 10),
    month: parseInt(monthStr, 10),
    day: parseInt(dayStr, 10),
  }
}

export function getDayOfWeekInTimezone(
  isoOrDate: string | Date = new Date(),
  timeZone = "Asia/Jakarta"
): number {
  const date = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate
  if (isNaN(date.getTime())) return 0
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
  })
  const dayName = formatter.format(date)
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  }
  return map[dayName] ?? 0
}

export function getWeekRange(
  date: Date,
  timeZone = "Asia/Jakarta"
): { start: Date; end: Date } {
  const { year, month, day } = getDatePartsInTimezone(date, timeZone)
  // Day of week in shop timezone: 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  const dow = getDayOfWeekInTimezone(date, timeZone)
  const diffToMonday = dow === 0 ? -6 : 1 - dow

  const mondayUtc = new Date(Date.UTC(year, month - 1, day + diffToMonday))
  const sundayUtc = new Date(Date.UTC(year, month - 1, day + diffToMonday + 6))

  const mondayStr = mondayUtc.toISOString().slice(0, 10)
  const sundayStr = sundayUtc.toISOString().slice(0, 10)

  const start = new Date(getIsoWithTimezone(mondayStr, "00:00", timeZone))
  const end = new Date(getIsoWithTimezone(sundayStr, "23:59", timeZone))
  end.setUTCSeconds(59, 999)
  return { start, end }
}

export function getMonthRange(
  date: Date,
  timeZone = "Asia/Jakarta"
): { start: Date; end: Date; fromStr: string; toStr: string } {
  const { year, month } = getDatePartsInTimezone(date, timeZone)
  const firstDayUtc = new Date(Date.UTC(year, month - 1, 1))
  const lastDayUtc = new Date(Date.UTC(year, month, 0))

  const fromStr = firstDayUtc.toISOString().slice(0, 10)
  const toStr = lastDayUtc.toISOString().slice(0, 10)

  const start = new Date(getIsoWithTimezone(fromStr, "00:00", timeZone))
  const end = new Date(getIsoWithTimezone(toStr, "23:59", timeZone))
  end.setUTCSeconds(59, 999)
  return { start, end, fromStr, toStr }
}

export function formatPeriodLabel(
  date: Date,
  view: string,
  timeZone = "Asia/Jakarta",
  locale = "id-ID"
): string {
  if (view === "Month" || view === "Bulan") {
    return date.toLocaleDateString(locale, {
      month: "long",
      year: "numeric",
      timeZone,
    })
  }
  if (view === "Week" || view === "Minggu") {
    const { start, end } = getWeekRange(date, timeZone)
    const startStr = start.toLocaleDateString(locale, {
      month: "short",
      day: "numeric",
      timeZone,
    })
    const endStr = end.toLocaleDateString(locale, {
      month: "short",
      day: "numeric",
      timeZone,
    })
    return `${startStr} – ${endStr}`
  }
  // Default "Day"
  return formatDateHeading(date, timeZone, locale)
}

export function getInitials(name: string | null | undefined): string {
  if (!name) return "•"
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function formatMinutesAgo(
  isoString: string | null | undefined,
  lang: "id" | "en" = "id"
): string {
  if (!isoString) return ""
  const arrived = new Date(isoString).getTime()
  const diffMin = Math.max(0, Math.floor((Date.now() - arrived) / (60 * 1000)))
  if (lang === "id") {
    if (diffMin === 0) return "Baru tiba"
    if (diffMin === 1) return "1 mnt lalu"
    return `${diffMin} mnt lalu`
  }
  if (diffMin === 0) return "Just arrived"
  if (diffMin === 1) return "1 min ago"
  return `${diffMin} mins ago`
}

export function getIsoWithTimezone(
  dateStr: string,
  timeStr: string,
  timeZone = "Asia/Jakarta"
): string {
  if (!dateStr || !timeStr) return new Date().toISOString()
  const parts = dateStr.split("-").map(Number)
  if (parts.length < 3 || parts.some(isNaN)) return new Date().toISOString()
  const [y, m, d] = parts
  const timeParts = timeStr.split(":").map(Number)
  const h = isNaN(timeParts[0]) ? 0 : timeParts[0]
  const min = isNaN(timeParts[1]) ? 0 : timeParts[1]
  const probe = new Date(Date.UTC(y, m - 1, d, h, min, 0))
  if (isNaN(probe.getTime())) return new Date().toISOString()
  const tzParts = getTimeInTimezone(probe, timeZone)
  const tzDate = getDatePartsInTimezone(probe, timeZone)
  const localTzTime = Date.UTC(tzDate.year, tzDate.month - 1, tzDate.day, tzParts.hour, tzParts.minute, 0)
  const offsetMs = localTzTime - probe.getTime()
  const exactUtc = new Date(probe.getTime() - offsetMs)
  return isNaN(exactUtc.getTime()) ? new Date().toISOString() : exactUtc.toISOString()
}
