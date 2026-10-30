import { describe, it } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { NOTIFICATIONS_CHANGED_EVENT } from "./api.ts"
import { enTranslations } from "./i18n/translations/en.ts"
import { idTranslations } from "./i18n/translations/id.ts"
import { inferToastType, upsertToastList, type ToastItem } from "../hooks/useToast.ts"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

describe("1. Notification positioning, translations, and anchor invariants", () => {
  it("1.1 Exports NOTIFICATIONS_CHANGED_EVENT for instant unread badge synchronization", () => {
    assert.equal(NOTIFICATIONS_CHANGED_EVENT, "barvato:notifications-changed")
  })

  it("1.2 Has complete and symmetric English and Indonesian notification translations", () => {
    const keys = [
      "notifications.title",
      "notifications.markAllRead",
      "notifications.markRead",
      "notifications.empty",
      "notifications.emptyDesc",
      "notifications.filterAll",
      "notifications.filterUnread",
      "notifications.loadMore",
      "notifications.loading",
      "notifications.errorLoading",
    ] as const

    for (const key of keys) {
      assert.ok(enTranslations[key] && enTranslations[key].length > 0, `Missing EN translation for ${key}`)
      assert.ok(idTranslations[key] && idTranslations[key].length > 0, `Missing ID translation for ${key}`)
    }
  })

  it("1.3 Topbar anchors NotificationPanel to the bell trigger and handles outside clicks without freezing page scroll", () => {
    const topbarPath = path.resolve(__dirname, "../components/layout/Topbar.tsx")
    const topbarSrc = fs.readFileSync(topbarPath, "utf8")
    assert.match(topbarSrc, /className="notification-anchor"/)
    assert.match(topbarSrc, /notifAnchorRef/)
    assert.match(topbarSrc, /<NotificationPanel[\s\S]*?anchorRef=\{notifAnchorRef\}/)

    const panelPath = path.resolve(__dirname, "../components/layout/NotificationPanel.tsx")
    const panelSrc = fs.readFileSync(panelPath, "utf8")

    // Must handle 401 unauthorized via retrySession
    assert.match(panelSrc, /err\.isUnauthorized/)
    assert.match(panelSrc, /retrySession\(\)/)

    // Must close on outside clicks via document event listener checking anchorRef and panelRef
    assert.match(panelSrc, /document\.addEventListener\("mousedown",\s*handlePointerDown\)/)

    // Must render actionable inline error banner on markRead / markAllRead / loadMore failure
    assert.match(panelSrc, /notif-inline-error/)
  })

  it("1.4 CSS rules in layout.css anchor notification panel to bell icon and keep natural scrolling", () => {
    const cssPath = path.resolve(__dirname, "../styles/layout.css")
    const css = fs.readFileSync(cssPath, "utf8")

    // .topbar and .notification-anchor relative positioning
    assert.match(css, /\.topbar\s*\{[\s\S]*?position:\s*relative;/)
    assert.match(css, /\.notification-anchor\s*\{[\s\S]*?position:\s*relative;[\s\S]*?display:\s*inline-flex;/)

    // Desktop .notif-panel anchored to trigger with z-index above calendar/drawers
    assert.match(css, /\.notif-panel\s*\{[\s\S]*?position:\s*absolute;[\s\S]*?top:\s*calc\(100%\s*\+\s*10px\);[\s\S]*?right:\s*0;/)

    // Independent vertical scroll container with overflow-x hidden
    assert.match(css, /\.notif-body\s*\{[\s\S]*?overflow-y:\s*auto;[\s\S]*?overflow-x:\s*hidden;/)

    // Safe text wrapping for long customer names and messages
    assert.match(css, /\.notif-content-col\s*\{[\s\S]*?overflow-wrap:\s*anywhere;[\s\S]*?word-break:\s*break-word;/)
    assert.match(css, /\.notif-item-title\s*\{[\s\S]*?overflow-wrap:\s*anywhere;[\s\S]*?word-break:\s*break-word;/)
    assert.match(css, /\.notif-item-message\s*\{[\s\S]*?overflow-wrap:\s*anywhere;[\s\S]*?word-break:\s*break-word;/)

    // Mobile breakpoint (@media (max-width: 720px))
    const mobileBlockMatch = css.match(/@media\s*\(max-width:\s*720px\)\s*\{([\s\S]*)\}/)
    assert.ok(mobileBlockMatch, "Expected @media (max-width: 720px) block in layout.css")
    const mobileCss = mobileBlockMatch[1]

    assert.match(mobileCss, /\.notif-panel\s*\{[\s\S]*?position:\s*absolute;/)
    assert.match(mobileCss, /env\(safe-area-inset-bottom,\s*0px\)/)
    assert.match(mobileCss, /\.notif-mark-read-btn\s*\{[\s\S]*?min-width:\s*36px;[\s\S]*?min-height:\s*36px;/)
    assert.match(mobileCss, /\.notif-close-btn\s*\{[\s\S]*?min-width:\s*38px;[\s\S]*?min-height:\s*38px;/)
  })
})

describe("2. Global Toast Notification System invariants", () => {
  it("2.1 Correctly infers toast types from message context when unspecified", () => {
    assert.equal(inferToastType("Appointment created successfully"), "success")
    assert.equal(inferToastType("Failed to save operating hours"), "error")
    assert.equal(inferToastType("Gagal menutup kasir"), "error")
    assert.equal(inferToastType("Warning: schedule conflict detected"), "warning")
    assert.equal(inferToastType("General update", "info"), "info")
    assert.equal(inferToastType("Explicit success", "success"), "success")
  })

  it("2.2 Deduplicates rapid consecutive duplicate messages within the deduplication window", () => {
    const list0: ToastItem[] = []
    const now = 100000

    const step1 = upsertToastList(list0, {
      message: "Appointment created successfully",
      type: "success",
      now,
      dedupeWindowMs: 1500,
    })
    assert.equal(step1.list.length, 1)
    const firstId = step1.item?.id

    // Same message 300ms later should be deduplicated (not appended)
    const step2 = upsertToastList(step1.list, {
      message: "Appointment created successfully",
      type: "success",
      now: now + 300,
      dedupeWindowMs: 1500,
    })
    assert.equal(step2.list.length, 1)
    assert.equal(step2.item?.id, firstId)

    // Different message should be appended
    const step3 = upsertToastList(step2.list, {
      message: "Customer checked in",
      type: "success",
      now: now + 400,
      dedupeWindowMs: 1500,
    })
    assert.equal(step3.list.length, 2)
  })

  it("2.3 Limits visible toasts to maxItems to prevent screen clutter", () => {
    let current: ToastItem[] = []
    for (let i = 1; i <= 6; i++) {
      const res = upsertToastList(current, {
        message: `Action #${i} performed`,
        type: "success",
        now: 1000 + i * 2000,
        maxItems: 4,
      })
      current = res.list
    }
    assert.equal(current.length, 4)
    assert.equal(current[0].message, "Action #3 performed")
    assert.equal(current[3].message, "Action #6 performed")
  })

  it("2.4 layout.css defines .toast-viewport and all 4 toast variants with distinct styles and animations", () => {
    const cssPath = path.resolve(__dirname, "../styles/layout.css")
    const css = fs.readFileSync(cssPath, "utf8")

    assert.match(css, /\.toast-viewport\s*\{[\s\S]*?position:\s*fixed;[\s\S]*?z-index:\s*120;/)
    assert.match(css, /\.toast-success/)
    assert.match(css, /\.toast-error/)
    assert.match(css, /\.toast-warning/)
    assert.match(css, /\.toast-info/)
    assert.match(css, /@keyframes toast-slide-in/)
  })
})

describe("3. Appointment Booking and Selection Invariants", () => {
  it("3.1 BookingModal provides a disabled placeholder option for appointments to prevent desync", () => {
    const bookingModalPath = path.resolve(__dirname, "../components/BookingModal.tsx")
    const src = fs.readFileSync(bookingModalPath, "utf8")

    assert.match(src, /<option value="" disabled>\s*-- \{t\("booking\.barber"\)\} --\s*<\/option>/)
  })

  it("3.2 Auto-selects first active or available barber for appointments", () => {
    const bookingModalPath = path.resolve(__dirname, "../components/BookingModal.tsx")
    const src = fs.readFileSync(bookingModalPath, "utf8")

    assert.match(src, /const firstActive = staffList\.find\(\(s\) => s\.active\)/)
    assert.match(src, /const firstAvail = list\.find\(\(a\) => a\.available\)/)
  })

  it("3.3 Dispatches barvato:refresh-data and Operations/Appointments listen to it", () => {
    const bookingModalPath = path.resolve(__dirname, "../components/BookingModal.tsx")
    const bookingSrc = fs.readFileSync(bookingModalPath, "utf8")
    assert.match(bookingSrc, /window\.dispatchEvent\(new CustomEvent\("barvato:refresh-data"\)\)/)

    const opsPath = path.resolve(__dirname, "../features/operations/OperationsPage.tsx")
    const opsSrc = fs.readFileSync(opsPath, "utf8")
    assert.match(opsSrc, /window\.addEventListener\("barvato:refresh-data",\s*handleRefresh\)/)

    const apptsPath = path.resolve(__dirname, "../features/appointments/AppointmentsPage.tsx")
    const apptsSrc = fs.readFileSync(apptsPath, "utf8")
    assert.match(apptsSrc, /window\.addEventListener\("barvato:refresh-data",\s*handleRefresh\)/)
  })

  it("3.4 Correctly validates appointment submissions including walkin conflict override support", () => {
    const bookingModalPath = path.resolve(__dirname, "../components/BookingModal.tsx")
    const src = fs.readFileSync(bookingModalPath, "utf8")

    // Ensures submit is guarded by date, time, and barber selection
    assert.match(src, /\(!isWalkin && \(!selectedStaffId \|\| !appointmentDate \|\| !appointmentTime\)\)/)
    // Ensures walkin conflicts are permitted to trigger override prompt
    assert.match(src, /selectedStaffAvailability\.conflict_type !== "walkin"/)
  })
})

describe("4. Automated Operational Notifications, Category Filtering, and Preferences", () => {
  it("4.1 Category translations exist and match in English and Indonesian", () => {
    const categoryKeys = [
      "notifications.categoryAll",
      "notifications.categoryAppointments",
      "notifications.categoryQueue",
      "notifications.categoryStaff",
      "notifications.categoryFinance",
      "notifications.priorityHigh",
    ] as const

    for (const key of categoryKeys) {
      assert.ok(enTranslations[key], `Missing English translation for ${key}`)
      assert.ok(idTranslations[key], `Missing Indonesian translation for ${key}`)
    }
  })

  it("4.2 NotificationPanel supports category tabs, priority badges, and entity routing", () => {
    const panelPath = path.resolve(__dirname, "../components/layout/NotificationPanel.tsx")
    const panelSrc = fs.readFileSync(panelPath, "utf8")

    assert.match(panelSrc, /className="notif-categories"/)
    assert.match(panelSrc, /className="notif-priority-badge"/)
    assert.match(panelSrc, /category: cat === "all" \? undefined : cat/)
    assert.match(panelSrc, /wallet/)
    assert.match(panelSrc, /calendar/)
    assert.match(panelSrc, /scissors/)
    assert.match(panelSrc, /users/)
  })

  it("4.3 SettingsContent connects to notificationPreferencesApi and provides operational controls", () => {
    const settingsPath = path.resolve(__dirname, "../features/settings/SettingsContent.tsx")
    const settingsSrc = fs.readFileSync(settingsPath, "utf8")

    assert.match(settingsSrc, /notificationPreferencesApi\.get\(\)/)
    assert.match(settingsSrc, /notificationPreferencesApi\.update\(/)
    assert.match(settingsSrc, /upcoming_reminder_30m_enabled/)
    assert.match(settingsSrc, /upcoming_reminder_15m_enabled/)
    assert.match(settingsSrc, /overdue_reminder_enabled/)
    assert.match(settingsSrc, /overdue_interval_minutes/)
    assert.match(settingsSrc, /excessive_wait_threshold_minutes/)
    assert.match(settingsSrc, /queue_alerts_enabled/)
    assert.match(settingsSrc, /barber_shift_alerts_enabled/)
    assert.match(settingsSrc, /financial_alerts_enabled/)
  })

  it("4.4 Layout CSS defines category tabs, chips, priority badges, and mobile responsiveness", () => {
    const cssPath = path.resolve(__dirname, "../styles/layout.css")
    const css = fs.readFileSync(cssPath, "utf8")

    assert.match(css, /\.notif-categories\s*\{/)
    assert.match(css, /\.notif-cat-chip\s*\{/)
    assert.match(css, /\.notif-cat-chip\.active\s*\{/)
    assert.match(css, /\.notif-priority-badge\s*\{/)
    assert.match(css, /\.notif-icon-wrap\.finance\s*\{/)
    assert.match(css, /\.notif-icon-wrap\.barber\s*\{/)
  })
})

describe("5. Notification Pop-outs and Category Normalization Invariants", () => {
  it("5.1 Topbar anchors NotificationPopouts inside .notification-anchor directly beneath the bell", () => {
    const topbarPath = path.resolve(__dirname, "../components/layout/Topbar.tsx")
    const src = fs.readFileSync(topbarPath, "utf8")

    assert.match(src, /import \{ NotificationPopouts/)
    assert.match(src, /<div className="notification-anchor" ref=\{notifAnchorRef\}>/)
    assert.match(src, /<NotificationPopouts[\s\S]*?items=\{isNotifOpen \? \[\] : activePopouts\}/)
    assert.match(src, /onDismiss=\{handleDismissPopout\}/)
    assert.match(src, /onClick=\{handlePopoutClick\}/)
  })

  it("5.2 Topbar implements pop-out queueing, initial load suppression, and deduplication", () => {
    const topbarPath = path.resolve(__dirname, "../components/layout/Topbar.tsx")
    const src = fs.readFileSync(topbarPath, "utf8")

    // Suppression on initial load
    assert.match(src, /hasInitializedRef/)
    assert.match(src, /seenIdsRef\.current\.add\(item\.id\)/)
    assert.match(src, /lastMaxIdRef/)

    // Max 3 visible cards with queueing
    assert.match(src, /activePopouts\.length < 3 && popoutQueue\.length > 0/)
    assert.match(src, /3 - activePopouts\.length/)

    // Auto-dismiss duration 4500ms
    assert.match(src, /4500 - elapsed/)

    // Dismisses popouts when notification dropdown opens
    assert.match(src, /if \(next\) \{\s*setActivePopouts\(\[\]\)/)
  })

  it("5.3 NotificationPopouts renders category icon, high priority badge, and dismiss button", () => {
    const popoutPath = path.resolve(__dirname, "../components/layout/NotificationPopouts.tsx")
    const src = fs.readFileSync(popoutPath, "utf8")

    assert.match(src, /className="notif-popouts-container"/)
    assert.match(src, /className=\{`notif-popout-card \$\{urgent \? "urgent" : ""\}`\}/)
    assert.match(src, /className="notif-priority-badge"/)
    assert.match(src, /className="notif-popout-close-btn"/)
    assert.match(src, /notifications\.justNow/)
  })

  it("5.4 Layout CSS defines anchored popouts container, cards, keyframe animation, and mobile adaptations", () => {
    const cssPath = path.resolve(__dirname, "../styles/layout.css")
    const css = fs.readFileSync(cssPath, "utf8")

    assert.match(css, /\.notif-popouts-container\s*\{[\s\S]*?position:\s*absolute;[\s\S]*?top:\s*calc\(100%\s*\+\s*8px\);[\s\S]*?right:\s*0;/)
    assert.match(css, /\.notif-popout-card\s*\{[\s\S]*?animation:\s*notif-popout-enter/)
    assert.match(css, /@keyframes notif-popout-enter/)
    assert.match(css, /\.notif-popout-card\.urgent/)

    // Mobile override
    const mobileBlockMatch = css.match(/@media\s*\(max-width:\s*720px\)\s*\{([\s\S]*)\}/)
    assert.ok(mobileBlockMatch, "Expected mobile breakpoint block")
    assert.match(mobileBlockMatch[1], /\.notif-popouts-container\s*\{[\s\S]*?width:\s*min\(320px,\s*calc\(100vw\s*-\s*24px\)\);/)
  })

  it("5.5 NotificationPanel uses canonical categories including staff with i18n support", () => {
    const panelPath = path.resolve(__dirname, "../components/layout/NotificationPanel.tsx")
    const src = fs.readFileSync(panelPath, "utf8")

    assert.match(src, /key:\s*"staff",\s*label:\s*t\("notifications\.categoryStaff"\)/)
    assert.match(src, /key:\s*"appointment"/)
    assert.match(src, /key:\s*"queue"/)
    assert.match(src, /key:\s*"finance"/)
  })
})
