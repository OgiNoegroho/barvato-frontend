import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
  calculateTimelineConfig,
  getSlotTop,
  getNowPosition,
  formatHourLabel,
  parseTimeString,
  DEFAULT_TIMELINE_START_HOUR,
  DEFAULT_TIMELINE_END_HOUR,
} from "./timeline.ts"
import type { ShopHour, ApiAppointment } from "./api.ts"

describe("timeline calculation and dynamic range", () => {
  it("parses time strings correctly", () => {
    assert.deepEqual(parseTimeString("09:00:00"), { hour: 9, minute: 0 })
    assert.deepEqual(parseTimeString("20:30"), { hour: 20, minute: 30 })
    assert.equal(parseTimeString(null), null)
    assert.equal(parseTimeString("invalid"), null)
  })

  it("formats hour labels properly", () => {
    assert.equal(formatHourLabel(8), "8 AM")
    assert.equal(formatHourLabel(12), "12 PM")
    assert.equal(formatHourLabel(13), "1 PM")
    assert.equal(formatHourLabel(20), "8 PM")
    assert.equal(formatHourLabel(21), "9 PM")
    assert.equal(formatHourLabel(0), "12 AM")
  })

  it("1. Opening at 09:00 and closing at 20:00 produces 08:00–21:00", () => {
    // 2026-10-27 is Tuesday (day 2)
    const testDate = new Date("2026-10-27T10:00:00Z")
    const hours: ShopHour[] = [
      { day_of_week: 2, is_open: true, open_time: "09:00:00", close_time: "20:00:00" },
    ]

    const config = calculateTimelineConfig({
      shopHours: hours,
      currentDate: testDate,
      timezone: "Asia/Jakarta",
      slotHeight: 68,
    })

    assert.equal(config.startHour, 8)
    assert.equal(config.endHour, 21)
    assert.equal(config.startFormatted, "08:00")
    assert.equal(config.endFormatted, "21:00")
    assert.equal(config.totalHours, 13)
    assert.equal(config.totalHeight, 13 * 68)
    assert.equal(config.timeSlots[0], "8 AM")
    assert.equal(config.timeSlots[config.timeSlots.length - 1], "8 PM")
    assert.equal(config.timeSlots.length, 13)
  })

  it("2. Different business hours produce the correct range (08:00–17:00 -> 07:00–18:00)", () => {
    const testDate = new Date("2026-10-27T10:00:00Z")
    const hours: ShopHour[] = [
      { day_of_week: 2, is_open: true, open_time: "08:00:00", close_time: "17:00:00" },
    ]

    const config = calculateTimelineConfig({
      shopHours: hours,
      currentDate: testDate,
      timezone: "Asia/Jakarta",
    })

    assert.equal(config.startHour, 7)
    assert.equal(config.endHour, 18)
    assert.equal(config.startFormatted, "07:00")
    assert.equal(config.endFormatted, "18:00")
    assert.equal(config.totalHours, 11)
    assert.equal(config.timeSlots[0], "7 AM")
    assert.equal(config.timeSlots[config.timeSlots.length - 1], "5 PM")
  })

  it("2b. Different business hours produce the correct range (10:00–22:00 -> 09:00–23:00)", () => {
    const testDate = new Date("2026-10-27T10:00:00Z")
    const hours: ShopHour[] = [
      { day_of_week: 2, is_open: true, open_time: "10:00:00", close_time: "22:00:00" },
    ]

    const config = calculateTimelineConfig({
      shopHours: hours,
      currentDate: testDate,
      timezone: "Asia/Jakarta",
    })

    assert.equal(config.startHour, 9)
    assert.equal(config.endHour, 23)
    assert.equal(config.startFormatted, "09:00")
    assert.equal(config.endFormatted, "23:00")
    assert.equal(config.totalHours, 14)
    assert.equal(config.timeSlots[0], "9 AM")
    assert.equal(config.timeSlots[config.timeSlots.length - 1], "10 PM")
  })

  it("3. Changing business hours dynamically updates the timeline", () => {
    const testDate = new Date("2026-10-27T10:00:00Z")

    const morningShift: ShopHour[] = [
      { day_of_week: 2, is_open: true, open_time: "07:00:00", close_time: "15:00:00" },
    ]
    const eveningShift: ShopHour[] = [
      { day_of_week: 2, is_open: true, open_time: "14:00:00", close_time: "23:00:00" },
    ]

    const configMorning = calculateTimelineConfig({
      shopHours: morningShift,
      currentDate: testDate,
      timezone: "Asia/Jakarta",
    })
    const configEvening = calculateTimelineConfig({
      shopHours: eveningShift,
      currentDate: testDate,
      timezone: "Asia/Jakarta",
    })

    assert.equal(configMorning.startFormatted, "06:00")
    assert.equal(configMorning.endFormatted, "16:00")

    assert.equal(configEvening.startFormatted, "13:00")
    assert.equal(configEvening.endFormatted, "00:00")
  })

  it("4. Timeline labels, grid height, and appointment positioning remain aligned", () => {
    const testDate = new Date("2026-10-27T10:00:00Z")
    const hours: ShopHour[] = [
      { day_of_week: 2, is_open: true, open_time: "09:00:00", close_time: "20:00:00" },
    ]
    const slotHeight = 68

    const config = calculateTimelineConfig({
      shopHours: hours,
      currentDate: testDate,
      timezone: "Asia/Jakarta",
      slotHeight,
    })

    // Appointment starts at 10:30 (2.5 hours after 08:00)
    // 2.5 * 68 = 170px
    const top = getSlotTop("2026-10-27T10:30:00+07:00", "Asia/Jakarta", config.startHour, slotHeight)
    assert.equal(top, 2.5 * 68)

    // Appointment at 08:00 should start at y=0
    const topStart = getSlotTop("2026-10-27T08:00:00+07:00", "Asia/Jakarta", config.startHour, slotHeight)
    assert.equal(topStart, 0)

    // Appointment at 20:00 should start at y=12 * 68
    const topLate = getSlotTop("2026-10-27T20:00:00+07:00", "Asia/Jakarta", config.startHour, slotHeight)
    assert.equal(topLate, 12 * 68)
  })

  it("5. Current-time positioning and within-timeline logic works accurately", () => {
    const slotHeight = 68
    const totalHeight = 13 * 68 // 884px (08:00 to 21:00)
    const startHour = 8

    // 14:30 in Jakarta (6.5 hours from 8:00) -> 6.5 * 68 = 442px
    const nowInside = new Date("2026-10-27T14:30:00+07:00")
    const posInside = getNowPosition(nowInside, "Asia/Jakarta", startHour, totalHeight, slotHeight)
    assert.equal(posInside.isWithinTimeline, true)
    assert.equal(posInside.top, 6.5 * 68)

    // 07:00 in Jakarta -> before timeline start (top < 0)
    const nowBefore = new Date("2026-10-27T07:00:00+07:00")
    const posBefore = getNowPosition(nowBefore, "Asia/Jakarta", startHour, totalHeight, slotHeight)
    assert.equal(posBefore.isWithinTimeline, false)

    // 22:00 in Jakarta -> after timeline end (top > totalHeight)
    const nowAfter = new Date("2026-10-27T22:00:00+07:00")
    const posAfter = getNowPosition(nowAfter, "Asia/Jakarta", startHour, totalHeight, slotHeight)
    assert.equal(posAfter.isWithinTimeline, false)
  })

  it("6. Missing business hours use the documented fallback", () => {
    const testDate = new Date("2026-10-27T10:00:00Z")

    // Null / empty hours array
    const configFallback = calculateTimelineConfig({
      shopHours: [],
      currentDate: testDate,
      timezone: "Asia/Jakarta",
    })

    assert.equal(configFallback.startHour, DEFAULT_TIMELINE_START_HOUR)
    assert.equal(configFallback.endHour, DEFAULT_TIMELINE_END_HOUR)
    assert.equal(configFallback.startFormatted, "08:00")
    assert.equal(configFallback.endFormatted, "22:00")
    assert.equal(configFallback.totalHours, 14)
  })

  it("7. Overnight hours (e.g. 20:00 to 04:00) are handled correctly across midnight", () => {
    const testDate = new Date("2026-10-27T10:00:00Z")
    const overnightHours: ShopHour[] = [
      { day_of_week: 2, is_open: true, open_time: "20:00:00", close_time: "04:00:00" },
    ]

    const config = calculateTimelineConfig({
      shopHours: overnightHours,
      currentDate: testDate,
      timezone: "Asia/Jakarta",
    })

    assert.equal(config.isOvernight, true)
    // 1 hour before 20:00 is 19:00
    assert.equal(config.startHour, 19)
    // 1 hour after 04:00 is 05:00 next day (24 + 5 = 29)
    assert.equal(config.endHour, 29)
    assert.equal(config.startFormatted, "19:00")
    assert.equal(config.endFormatted, "05:00")
    assert.equal(config.totalHours, 10)
    assert.equal(config.timeSlots[0], "7 PM")
    assert.equal(config.timeSlots[config.timeSlots.length - 1], "4 AM")
  })

  it("8. Appointments outside regular business hours expand timeline so they never disappear", () => {
    const testDate = new Date("2026-10-27T10:00:00Z")
    const hours: ShopHour[] = [
      { day_of_week: 2, is_open: true, open_time: "09:00:00", close_time: "20:00:00" },
    ]

    // Early appointment at 06:00 AM (starts before base 08:00 timeline start)
    const earlyAppt: ApiAppointment = {
      id: 1,
      shop_id: 1,
      customer_id: 1,
      customer_name: "Early Bird",
      service_id: 1,
      service_name: "Cut",
      staff_id: 1,
      staff_name: "Avery",
      starts_at: "2026-10-27T06:00:00+07:00",
      ends_at: "2026-10-27T07:00:00+07:00",
      duration_snapshot_min: 60,
      price_snapshot: 100000,
      status: "confirmed",
      created_at: "2026-10-26T10:00:00Z",
      updated_at: "2026-10-26T10:00:00Z",
    }

    const config = calculateTimelineConfig({
      shopHours: hours,
      currentDate: testDate,
      timezone: "Asia/Jakarta",
      appointments: [earlyAppt],
    })

    // Timeline start expanded from 8 to 5 (06:00 - 1 hr buffer)
    assert.equal(config.startHour, 5)
    assert.equal(config.endHour, 21)
    assert.equal(config.timeSlots[0], "5 AM")
    assert.equal(config.timeSlots[config.timeSlots.length - 1], "8 PM")

    // The early appointment at 06:00 is positioned at 1 hour offset (68px)
    const earlyTop = getSlotTop(earlyAppt.starts_at, "Asia/Jakarta", config.startHour, 68)
    assert.equal(earlyTop, 68)
  })
})
