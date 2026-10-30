import { useState, useEffect, useCallback, useRef } from "react"
import type { Page } from "../../types"
import { Icon } from "../ui/Icon"
import { useAuth } from "../../features/auth/AuthContext"
import { useI18n } from "../../lib/i18n"
import {
  notificationsApi,
  ApiError,
  NOTIFICATIONS_CHANGED_EVENT,
  type NotificationItem,
} from "../../lib/api"
import { NotificationPanel } from "./NotificationPanel"
import { NotificationPopouts, type PopoutItem } from "./NotificationPopouts"

interface TopbarProps {
  currentPage: Page
  onNavigate: (page: Page) => void
  onNavigateEntity?: (
    entityType?: string | null,
    entityId?: number | null,
    data?: Record<string, unknown>
  ) => void
}

export function Topbar({ currentPage, onNavigate, onNavigateEntity }: TopbarProps) {
  const { user, currentShop, logout, isAuthenticated, retrySession } = useAuth()
  const { t } = useI18n()
  const [unreadCount, setUnreadCount] = useState<number>(0)
  const [isNotifOpen, setIsNotifOpen] = useState<boolean>(false)
  const [activePopouts, setActivePopouts] = useState<PopoutItem[]>([])
  const [popoutQueue, setPopoutQueue] = useState<NotificationItem[]>([])

  const inFlightRef = useRef<boolean>(false)
  const lastFetchedAtRef = useRef<number>(0)
  const notifAnchorRef = useRef<HTMLDivElement>(null)
  const seenIdsRef = useRef<Set<number>>(new Set())
  const hasInitializedRef = useRef<boolean>(false)
  const lastMaxIdRef = useRef<number>(0)

  // Reset tracking state if shop changes
  useEffect(() => {
    seenIdsRef.current.clear()
    hasInitializedRef.current = false
    lastMaxIdRef.current = 0
    setActivePopouts([])
    setPopoutQueue([])
  }, [currentShop?.id])

  const handleEntityNav = useCallback(
    (item: NotificationItem) => {
      if (onNavigateEntity) {
        onNavigateEntity(item.entity_type, item.entity_id, item.data)
      } else {
        onNavigate("Operations")
      }
    },
    [onNavigateEntity, onNavigate]
  )

  const fetchNotifications = useCallback(
    async (force = false) => {
      if (!isAuthenticated) return
      const now = Date.now()
      if (inFlightRef.current) return
      if (!force && now - lastFetchedAtRef.current < 1500) return

      inFlightRef.current = true
      lastFetchedAtRef.current = now
      try {
        const res = await notificationsApi.list({ limit: 10 })
        const items = res.notifications || []
        setUnreadCount(res.unread_count ?? 0)

        if (!hasInitializedRef.current) {
          // Initial fetch on mount: mark existing items as seen, don't show popouts
          for (const item of items) {
            seenIdsRef.current.add(item.id)
          }
          const maxId = items.reduce((m, item) => (item.id > m ? item.id : m), 0)
          lastMaxIdRef.current = maxId
          hasInitializedRef.current = true
        } else {
          // Subsequent fetch: detect genuinely new unread notifications
          const incoming: NotificationItem[] = []
          for (const item of items) {
            if (!seenIdsRef.current.has(item.id)) {
              seenIdsRef.current.add(item.id)
              if (!item.read_at && item.id > lastMaxIdRef.current) {
                incoming.push(item)
              }
            }
          }
          if (items.length > 0) {
            const maxId = items.reduce((m, item) => (item.id > m ? item.id : m), 0)
            if (maxId > lastMaxIdRef.current) {
              lastMaxIdRef.current = maxId
            }
          }

          if (incoming.length > 0) {
            // Sort ascending so older of the new arrivals show first
            incoming.sort((a, b) => a.id - b.id)
            setPopoutQueue((prev) => [...prev, ...incoming])
          }
        }
      } catch (err) {
        if (err instanceof ApiError && err.isUnauthorized) {
          retrySession()
        }
      } finally {
        inFlightRef.current = false
      }
    },
    [isAuthenticated, retrySession]
  )

  // Promote up to 3 items into active popouts from queue
  useEffect(() => {
    if (activePopouts.length < 3 && popoutQueue.length > 0) {
      const slotsAvailable = 3 - activePopouts.length
      const toPromote = popoutQueue.slice(0, slotsAvailable)
      const remainingQueue = popoutQueue.slice(slotsAvailable)

      const newPopouts: PopoutItem[] = toPromote.map((item) => ({
        id: item.id,
        notification: item,
        addedAt: Date.now(),
      }))

      setPopoutQueue(remainingQueue)
      setActivePopouts((prev) => [...prev, ...newPopouts])
    }
  }, [activePopouts.length, popoutQueue])

  // Auto-dismiss active popouts after 4500ms
  useEffect(() => {
    if (activePopouts.length === 0) return
    const timers = activePopouts.map((item) => {
      const elapsed = Date.now() - item.addedAt
      const remaining = Math.max(0, 4500 - elapsed)
      return setTimeout(() => {
        setActivePopouts((prev) => prev.filter((p) => p.id !== item.id))
      }, remaining)
    })
    return () => {
      timers.forEach(clearTimeout)
    }
  }, [activePopouts])

  const handleDismissPopout = useCallback((id: number) => {
    setActivePopouts((prev) => prev.filter((p) => p.id !== id))
  }, [])

  const handlePopoutClick = useCallback(
    async (item: NotificationItem) => {
      setActivePopouts((prev) => prev.filter((p) => p.id !== item.id))
      try {
        await notificationsApi.markRead(item.id)
        setUnreadCount((prev) => Math.max(0, prev - 1))
      } catch {
        // optimistic
      }
      handleEntityNav(item)
    },
    [handleEntityNav]
  )

  const toggleNotifications = () => {
    setIsNotifOpen((prev) => {
      const next = !prev
      if (next) {
        setActivePopouts([])
      }
      return next
    })
  }

  useEffect(() => {
    void fetchNotifications(true)
    const interval = setInterval(() => {
      if (typeof document === "undefined" || document.visibilityState === "visible") {
        void fetchNotifications(false)
      }
    }, 12000)

    const handleFocus = () => {
      void fetchNotifications(false)
    }
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void fetchNotifications(false)
      }
    }
    const handleNotificationsChanged = () => {
      void fetchNotifications(true)
    }

    window.addEventListener("focus", handleFocus)
    document.addEventListener("visibilitychange", handleVisibilityChange)
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, handleNotificationsChanged)

    return () => {
      clearInterval(interval)
      window.removeEventListener("focus", handleFocus)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, handleNotificationsChanged)
    }
  }, [fetchNotifications])

  const initials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "B"

  return (
    <header className="topbar">
      <div className="mobile-brand">
        <span className="brand-mark">B</span>
        <strong>BARVATO</strong>
      </div>
      <div className="search">
        <Icon name="search" size={17} />
        <input
          aria-label={t("common.search")}
          placeholder={t("shell.searchPlaceholder")}
        />
        <kbd>⌘ K</kbd>
      </div>
      <div className="top-actions">
        <div className="notification-anchor" ref={notifAnchorRef}>
          <button
            type="button"
            className="icon-button notification-trigger"
            onClick={toggleNotifications}
            aria-label={
              unreadCount > 0
                ? `${t("settings.sectionNotifications")} (${unreadCount})`
                : t("settings.sectionNotifications")
            }
            title={t("settings.sectionNotifications")}
            aria-expanded={isNotifOpen}
            aria-haspopup="dialog"
          >
            <Icon name="bell" />
            {unreadCount > 0 && (
              <span className="notif-badge">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </button>

          <NotificationPopouts
            items={isNotifOpen ? [] : activePopouts}
            onDismiss={handleDismissPopout}
            onClick={handlePopoutClick}
          />

          <NotificationPanel
            isOpen={isNotifOpen}
            onClose={() => setIsNotifOpen(false)}
            onNavigate={handleEntityNav}
            unreadCount={unreadCount}
            onUnreadCountChange={setUnreadCount}
            anchorRef={notifAnchorRef}
          />
        </div>

        <button
          type="button"
          className="icon-button"
          onClick={() => onNavigate("Settings")}
          aria-label={t("nav.settings")}
          title={t("nav.settings")}
          aria-current={currentPage === "Settings" ? "page" : undefined}
        >
          <Icon name="settings" />
        </button>
        <button
          className="icon-button"
          onClick={() => void logout()}
          title={`${t("common.signedInAs")} ${user?.name || t("roles.staff")} · ${t("common.signOut")}`}
          aria-label={t("common.signOut")}
        >
          <span style={{ fontSize: "11px", fontWeight: 700 }}>{initials}</span>
        </button>
      </div>
    </header>
  )
}
