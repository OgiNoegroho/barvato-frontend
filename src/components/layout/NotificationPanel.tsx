import { useState, useEffect, useCallback, useRef } from "react"
import { Icon } from "../ui/Icon"
import type { IconName } from "../../types"
import { useI18n } from "../../lib/i18n"
import { useAuth } from "../../features/auth/AuthContext"
import { useToast } from "../../hooks/useToast"
import {
  notificationsApi,
  ApiError,
  NOTIFICATIONS_CHANGED_EVENT,
  type NotificationItem,
  type NotificationCategory,
} from "../../lib/api"
import { formatMinutesAgo } from "../../lib/format"

interface NotificationPanelProps {
  isOpen: boolean
  onClose: () => void
  onNavigate: (item: NotificationItem) => void
  unreadCount: number
  onUnreadCountChange: (count: number) => void
  anchorRef?: React.RefObject<HTMLElement | null>
}

export function NotificationPanel({
  isOpen,
  onClose,
  onNavigate,
  unreadCount,
  onUnreadCountChange,
  anchorRef,
}: NotificationPanelProps) {
  const { t, language } = useI18n()
  const { retrySession } = useAuth()
  const toast = useToast()
  const [filter, setFilter] = useState<"all" | "unread">("all")
  const [category, setCategory] = useState<"all" | NotificationCategory>("all")
  const [items, setItems] = useState<NotificationItem[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [nextBeforeId, setNextBeforeId] = useState<number | null>(null)
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false)
  const panelRef = useRef<HTMLElement>(null)

  const handleApiError = useCallback(
    (err: unknown, fallbackMessage: string): string => {
      if (err instanceof ApiError && err.isUnauthorized) {
        onClose()
        retrySession()
        return err.message || fallbackMessage
      }
      if (err instanceof Error && err.message) {
        return err.message
      }
      return fallbackMessage
    },
    [onClose, retrySession]
  )

  const loadNotifications = useCallback(
    async (unreadOnly: boolean, cat: "all" | NotificationCategory, reset = true) => {
      if (reset) {
        setIsLoading(true)
        setError(null)
        setActionError(null)
        setItems([])
        setNextBeforeId(null)
      }
      try {
        const res = await notificationsApi.list({
          unread_only: unreadOnly,
          category: cat === "all" ? undefined : cat,
          limit: 20,
        })
        setItems(res.notifications || [])
        setNextBeforeId(res.next_before_id ?? null)
        onUnreadCountChange(res.unread_count ?? 0)
      } catch (err: unknown) {
        setError(handleApiError(err, t("notifications.errorLoading")))
      } finally {
        setIsLoading(false)
      }
    },
    [onUnreadCountChange, handleApiError, t]
  )

  // Load when panel opens, filter changes, or category changes
  useEffect(() => {
    if (!isOpen) return
    void loadNotifications(filter === "unread", category)

    const handleChanged = () => {
      void loadNotifications(filter === "unread", category, false)
    }
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, handleChanged)
    return () => {
      window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, handleChanged)
    }
  }, [isOpen, filter, category, loadNotifications])

  // Close when clicking outside the notification anchor / popover
  useEffect(() => {
    if (!isOpen) return
    function handlePointerDown(e: MouseEvent | TouchEvent) {
      const target = e.target as Node | null
      if (!target) return
      if (panelRef.current?.contains(target)) return
      if (anchorRef?.current?.contains(target)) return
      onClose()
    }
    document.addEventListener("mousedown", handlePointerDown)
    document.addEventListener("touchstart", handlePointerDown, { passive: true })
    return () => {
      document.removeEventListener("mousedown", handlePointerDown)
      document.removeEventListener("touchstart", handlePointerDown)
    }
  }, [isOpen, onClose, anchorRef])

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, onClose])

  const handleLoadMore = async () => {
    if (!nextBeforeId || isLoadingMore) return
    setIsLoadingMore(true)
    setActionError(null)
    try {
      const res = await notificationsApi.list({
        unread_only: filter === "unread",
        category: category === "all" ? undefined : category,
        before_id: nextBeforeId,
        limit: 20,
      })
      setItems((prev) => [...prev, ...(res.notifications || [])])
      setNextBeforeId(res.next_before_id ?? null)
    } catch (err: unknown) {
      const msg = handleApiError(err, t("notifications.errorLoading"))
      setActionError(msg)
      toast.error(msg)
    } finally {
      setIsLoadingMore(false)
    }
  }

  const handleMarkOneRead = async (e: React.MouseEvent, item: NotificationItem) => {
    e.stopPropagation()
    if (item.read_at) return
    setActionError(null)

    // Optimistically update
    const nowIso = new Date().toISOString()
    setItems((prev) =>
      filter === "unread"
        ? prev.filter((n) => n.id !== item.id)
        : prev.map((n) => (n.id === item.id ? { ...n, read_at: nowIso } : n))
    )
    onUnreadCountChange(Math.max(0, unreadCount - 1))

    try {
      await notificationsApi.markRead(item.id)
      toast.success(
        language === "id" ? "Notifikasi ditandai sudah dibaca" : "Notification marked as read"
      )
    } catch (err: unknown) {
      const msg = handleApiError(err, t("notifications.errorLoading"))
      setActionError(msg)
      toast.error(msg)
      void loadNotifications(filter === "unread", category, false)
    }
  }

  const handleMarkAllRead = async () => {
    if (unreadCount === 0 || isLoading) return
    setActionError(null)

    // Optimistically mark all in local state
    const nowIso = new Date().toISOString()
    setItems((prev) =>
      filter === "unread" ? [] : prev.map((n) => ({ ...n, read_at: n.read_at || nowIso }))
    )
    onUnreadCountChange(0)

    try {
      await notificationsApi.markAllRead()
      toast.success(
        language === "id"
          ? "Semua notifikasi ditandai sudah dibaca"
          : "All notifications marked as read"
      )
    } catch (err: unknown) {
      const msg = handleApiError(err, t("notifications.errorLoading"))
      setActionError(msg)
      toast.error(msg)
      void loadNotifications(filter === "unread", category, false)
    }
  }

  const handleItemClick = async (item: NotificationItem) => {
    if (!item.read_at) {
      const nowIso = new Date().toISOString()
      setItems((prev) =>
        filter === "unread"
          ? prev.filter((n) => n.id !== item.id)
          : prev.map((n) => (n.id === item.id ? { ...n, read_at: nowIso } : n))
      )
      onUnreadCountChange(Math.max(0, unreadCount - 1))
      notificationsApi.markRead(item.id).catch((err) => {
        if (err instanceof ApiError && err.isUnauthorized) {
          retrySession()
        }
      })
    }

    onClose()
    if (item.entity_type && item.entity_id) {
      onNavigate(item)
    }
  }

  const formatTimestamp = (dateIso: string) => {
    if (!dateIso) return ""
    const timestamp = new Date(dateIso).getTime()
    const diffHours = (Date.now() - timestamp) / (3600 * 1000)

    if (diffHours < 1) {
      return formatMinutesAgo(dateIso, language)
    }
    if (diffHours < 24) {
      const h = Math.floor(diffHours)
      return language === "id" ? `${h} jam lalu` : `${h}h ago`
    }
    const d = new Date(dateIso)
    return d.toLocaleDateString(language === "id" ? "id-ID" : "en-US", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const getNotificationIcon = (type: string, cat?: string): IconName => {
    if (
      cat === "finance" ||
      type.startsWith("finance") ||
      type.includes("payment") ||
      type.includes("payout") ||
      type.includes("daily_close")
    ) {
      return "wallet"
    }
    if (
      cat === "barber" ||
      cat === "staff" ||
      type.startsWith("barber") ||
      type.startsWith("staff") ||
      type.includes("shift") ||
      type.includes("unavailable")
    ) {
      return "scissors"
    }
    if (cat === "queue" || type.startsWith("queue") || type.includes("walk_in")) {
      return "users"
    }
    if (cat === "appointment" || type.startsWith("appointment")) {
      return "calendar"
    }
    if (type.startsWith("operations")) {
      return "clock"
    }
    return "bell"
  }

  const isHighPriority = (type: string): boolean => {
    return (
      type.includes("overdue") ||
      type.includes("excessive_wait") ||
      type.includes("cancelled") ||
      type.includes("unavailable") ||
      type.includes("closure")
    )
  }

  const categories: Array<{ key: "all" | NotificationCategory; label: string }> = [
    { key: "all", label: t("notifications.categoryAll") },
    { key: "appointment", label: t("notifications.categoryAppointments") },
    { key: "queue", label: t("notifications.categoryQueue") },
    { key: "staff", label: t("notifications.categoryStaff") },
    { key: "finance", label: t("notifications.categoryFinance") },
  ]

  if (!isOpen) return null

  return (
    <aside
      ref={panelRef}
      className="notif-panel"
      role="dialog"
      aria-modal="false"
      aria-label={t("notifications.title")}
    >
      <div className="notif-head">
        <div className="notif-title-group">
          <span className="section-index">BARVATO / NOTIFICATIONS</span>
          <h2>{t("notifications.title")}</h2>
        </div>
        <div className="notif-head-actions">
          {unreadCount > 0 && (
            <button
              type="button"
              className="text-button compact-action"
              onClick={handleMarkAllRead}
              title={t("notifications.markAllRead")}
            >
              {t("notifications.markAllRead")}
            </button>
          )}
          <button
            type="button"
            className="icon-button mini notif-close-btn"
            onClick={onClose}
            aria-label={t("common.close")}
          >
            ×
          </button>
        </div>
      </div>

      <div className="notif-filters" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={filter === "all"}
          className={`notif-filter-tab ${filter === "all" ? "active" : ""}`}
          onClick={() => setFilter("all")}
        >
          {t("notifications.filterAll")}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={filter === "unread"}
          className={`notif-filter-tab ${filter === "unread" ? "active" : ""}`}
          onClick={() => setFilter("unread")}
        >
          {t("notifications.filterUnread")}
          {unreadCount > 0 && (
            <span className="notif-filter-badge">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>
      </div>

      <div className="notif-categories" role="tablist" aria-label="Notification Categories">
        {categories.map((c) => (
          <button
            key={c.key}
            type="button"
            role="tab"
            aria-selected={category === c.key}
            className={`notif-cat-chip ${category === c.key ? "active" : ""}`}
            onClick={() => setCategory(c.key)}
          >
            {c.label}
          </button>
        ))}
      </div>

      {actionError && (
        <div className="notif-inline-error" role="alert">
          <span>{actionError}</span>
          <button
            type="button"
            className="text-button compact-action"
            onClick={() => {
              setActionError(null)
              void loadNotifications(filter === "unread", category, false)
            }}
          >
            {t("common.retry")}
          </button>
        </div>
      )}

      <div className="notif-body">
        {isLoading ? (
          <div className="notif-state-box">
            <div className="loading-spinner" />
            <p>{t("notifications.loading")}</p>
          </div>
        ) : error ? (
          <div className="notif-state-box error">
            <p>{error}</p>
            <button
              type="button"
              className="filter-button"
              onClick={() => loadNotifications(filter === "unread", category)}
            >
              {t("common.retry")}
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="notif-state-box empty">
            <div className="notif-empty-icon">
              <Icon name="bell" size={24} />
            </div>
            <h3>{t("notifications.empty")}</h3>
            <p>{t("notifications.emptyDesc")}</p>
          </div>
        ) : (
          <div className="notif-list">
            {items.map((item) => {
              const isUnread = !item.read_at
              const isClickable = Boolean(item.entity_type && item.entity_id)
              const iconCategory = item.category || item.type.split(".")[0]
              const urgent = isHighPriority(item.type)

              return (
                <div
                  key={item.id}
                  className={`notif-item ${isUnread ? "unread" : "read"} ${
                    isClickable ? "clickable" : ""
                  }`}
                  onClick={() => handleItemClick(item)}
                  role={isClickable ? "button" : undefined}
                  tabIndex={isClickable ? 0 : undefined}
                  onKeyDown={(e) => {
                    if (isClickable && (e.key === "Enter" || e.key === " ")) {
                      handleItemClick(item)
                    }
                  }}
                >
                  <div className="notif-icon-col">
                    <span className={`notif-icon-wrap ${iconCategory}`}>
                      <Icon name={getNotificationIcon(item.type, item.category)} size={15} />
                    </span>
                  </div>

                  <div className="notif-content-col">
                    <div className="notif-item-header">
                      <span className="notif-item-title">{item.title}</span>
                      {urgent && (
                        <span className="notif-priority-badge">
                          {t("notifications.priorityHigh")}
                        </span>
                      )}
                      <span className="notif-item-time">{formatTimestamp(item.created_at)}</span>
                    </div>
                    <p className="notif-item-message">{item.message}</p>
                  </div>

                  <div className="notif-action-col">
                    {isUnread && (
                      <button
                        type="button"
                        className="notif-mark-read-btn"
                        onClick={(e) => handleMarkOneRead(e, item)}
                        aria-label={t("notifications.markRead")}
                        title={t("notifications.markRead")}
                      >
                        <span className="notif-unread-dot" />
                      </button>
                    )}
                  </div>
                </div>
              )
            })}

            {nextBeforeId && (
              <div className="notif-load-more">
                <button
                  type="button"
                  className="filter-button wide"
                  onClick={handleLoadMore}
                  disabled={isLoadingMore}
                >
                  {isLoadingMore ? t("common.loading") || "..." : t("notifications.loadMore")}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  )
}
