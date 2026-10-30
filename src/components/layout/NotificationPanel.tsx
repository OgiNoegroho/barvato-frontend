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
import { cn } from "../../lib/utils"

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
    [onClose, retrySession],
  )

  const loadNotifications = useCallback(
    async (
      unreadOnly: boolean,
      cat: "all" | NotificationCategory,
      reset = true,
    ) => {
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
    [onUnreadCountChange, handleApiError, t],
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
    document.addEventListener("touchstart", handlePointerDown, {
      passive: true,
    })
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

  const handleMarkAllRead = async () => {
    setActionError(null)
    const prevItems = items
    const prevCount = unreadCount
    const nowIso = new Date().toISOString()

    // Optimistic update
    setItems((prev) =>
      prev.map((item) => (item.read_at ? item : { ...item, read_at: nowIso })),
    )
    onUnreadCountChange(0)

    try {
      await notificationsApi.markAllRead()
      window.dispatchEvent(new CustomEvent(NOTIFICATIONS_CHANGED_EVENT))
      toast.success(t("notifications.markAllRead"))
    } catch (err: unknown) {
      setItems(prevItems)
      onUnreadCountChange(prevCount)
      const msg = handleApiError(err, t("notifications.errorLoading"))
      setActionError(msg)
      toast.error(msg)
    }
  }

  const handleMarkOneRead = async (
    e: React.MouseEvent,
    item: NotificationItem,
  ) => {
    e.stopPropagation()
    setActionError(null)
    if (item.read_at) return

    const nowIso = new Date().toISOString()
    const prevItems = items
    const prevCount = unreadCount

    // Optimistic update
    setItems((prev) =>
      prev.map((it) => (it.id === item.id ? { ...it, read_at: nowIso } : it)),
    )
    onUnreadCountChange(Math.max(0, unreadCount - 1))

    try {
      await notificationsApi.markRead(item.id)
      window.dispatchEvent(new CustomEvent(NOTIFICATIONS_CHANGED_EVENT))
    } catch (err: unknown) {
      setItems(prevItems)
      onUnreadCountChange(prevCount)
      const msg = handleApiError(err, t("notifications.errorLoading"))
      setActionError(msg)
      toast.error(msg)
    }
  }

  const handleLoadMore = async () => {
    if (!nextBeforeId || isLoadingMore) return
    setIsLoadingMore(true)
    setActionError(null)
    try {
      const res = await notificationsApi.list({
        unread_only: filter === "unread",
        category: category === "all" ? undefined : category,
        limit: 20,
        before_id: nextBeforeId,
      })
      setItems((prev) => [...prev, ...(res.notifications || [])])
      setNextBeforeId(res.next_before_id ?? null)
      onUnreadCountChange(res.unread_count ?? unreadCount)
    } catch (err: unknown) {
      const msg = handleApiError(err, t("notifications.errorLoading"))
      setActionError(msg)
      toast.error(msg)
    } finally {
      setIsLoadingMore(false)
    }
  }

  const handleItemClick = async (item: NotificationItem) => {
    if (!item.read_at) {
      const nowIso = new Date().toISOString()
      setItems((prev) =>
        prev.map((it) => (it.id === item.id ? { ...it, read_at: nowIso } : it)),
      )
      onUnreadCountChange(Math.max(0, unreadCount - 1))
      try {
        await notificationsApi.markRead(item.id)
        window.dispatchEvent(new CustomEvent(NOTIFICATIONS_CHANGED_EVENT))
      } catch {
        // Optimistic
      }
    }

    if (item.entity_type && item.entity_id) {
      onClose()
      onNavigate(item)
    }
  }

  const formatTimestamp = (dateIso: string): string => {
    return formatMinutesAgo(dateIso, language)
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
    if (
      cat === "queue" ||
      type.startsWith("queue") ||
      type.includes("walk_in")
    ) {
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

  const getCategoryIconStyles = (cat: string) => {
    switch (cat) {
      case "finance":
        return "bg-[#f3ebd7] text-[#916b15]"
      case "staff":
      case "barber":
        return "bg-[#e6ecf2] text-[#345c85]"
      case "queue":
        return "bg-[#e3ebe2] text-forest"
      case "appointment":
      default:
        return "bg-copper-soft text-copper"
    }
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

  const categories: Array<{ key: "all" | NotificationCategory; label: string }> =
    [
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
      className={cn(
        "notif-panel",
        "absolute top-[calc(100%+10px)] right-0 max-md:-right-2 w-[440px] max-w-[calc(100vw-24px)] bg-ivory border border-stone shadow-modal rounded-lg flex flex-col max-h-[calc(100vh-120px)] max-md:max-h-[calc(100vh-100px)] z-50 text-charcoal overflow-hidden select-none",
      )}
      role="dialog"
      aria-modal="false"
      aria-label={t("notifications.title")}
    >
      <div
        className={cn(
          "notif-head",
          "flex items-start justify-between p-4 sm:p-5 border-b border-stone bg-ivory-light",
        )}
      >
        <div className="notif-title-group">
          <span className="section-index text-2xs font-bold uppercase tracking-wider text-muted-text block">
            BARVATO / NOTIFICATIONS
          </span>
          <h2 className="font-serif text-2xl font-normal text-charcoal mt-0.5">
            {t("notifications.title")}
          </h2>
        </div>
        <div className="notif-head-actions flex items-center gap-3">
          {unreadCount > 0 && (
            <button
              type="button"
              className="text-button compact-action text-xs font-semibold text-charcoal border-b border-charcoal hover:text-copper hover:border-copper transition-colors bg-transparent p-0 cursor-pointer"
              onClick={handleMarkAllRead}
              title={t("notifications.markAllRead")}
            >
              {t("notifications.markAllRead")}
            </button>
          )}
          <button
            type="button"
            className="icon-button mini notif-close-btn w-7 h-7 rounded grid place-items-center border border-stone hover:border-copper/70 hover:bg-ivory text-charcoal transition-colors bg-transparent cursor-pointer text-base leading-none"
            onClick={onClose}
            aria-label={t("common.close")}
          >
            ×
          </button>
        </div>
      </div>

      <div
        className={cn(
          "notif-filters",
          "flex border-b border-stone bg-ivory-warm/40 px-3 sm:px-4",
        )}
        role="tablist"
      >
        <button
          type="button"
          role="tab"
          aria-selected={filter === "all"}
          className={cn(
            "notif-filter-tab",
            "flex items-center gap-2 py-2.5 px-3 text-xs font-semibold text-muted-text hover:text-charcoal border-b-2 border-transparent transition-colors cursor-pointer bg-transparent",
            filter === "all" && "active border-copper text-copper font-bold",
          )}
          onClick={() => setFilter("all")}
        >
          {t("notifications.filterAll")}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={filter === "unread"}
          className={cn(
            "notif-filter-tab",
            "flex items-center gap-2 py-2.5 px-3 text-xs font-semibold text-muted-text hover:text-charcoal border-b-2 border-transparent transition-colors cursor-pointer bg-transparent",
            filter === "unread" && "active border-copper text-copper font-bold",
          )}
          onClick={() => setFilter("unread")}
        >
          {t("notifications.filterUnread")}
          {unreadCount > 0 && (
            <span className="notif-filter-badge bg-copper text-ivory-light text-[9px] font-bold px-1.5 py-0.2 rounded-full leading-none">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>
      </div>

      <div
        className="notif-categories"
        role="tablist"
        aria-label="Notification Categories"
      >
        {categories.map((c) => (
          <button
            key={c.key}
            type="button"
            role="tab"
            aria-selected={category === c.key}
            className={cn(
              "notif-cat-chip",
              "px-2.5 py-1 text-2xs font-bold uppercase tracking-wider rounded-full border border-stone/80 text-muted-text hover:border-copper/70 hover:text-charcoal transition-colors whitespace-nowrap cursor-pointer bg-transparent",
              category === c.key &&
                "active bg-charcoal text-ivory-light border-charcoal font-bold",
            )}
            onClick={() => setCategory(c.key)}
          >
            {c.label}
          </button>
        ))}
      </div>

      {actionError && (
        <div
          className={cn(
            "notif-inline-error",
            "flex items-center justify-between gap-3 p-3 bg-danger-soft border-b border-danger-line text-danger text-xs font-medium",
          )}
          role="alert"
        >
          <span>{actionError}</span>
          <button
            type="button"
            className="text-button compact-action text-xs font-bold text-danger border-b border-danger hover:opacity-80 transition-opacity bg-transparent p-0 cursor-pointer"
            onClick={() => {
              setActionError(null)
              void loadNotifications(filter === "unread", category, false)
            }}
          >
            {t("common.retry")}
          </button>
        </div>
      )}

      <div
        className={cn(
          "notif-body",
          "flex-1 overflow-y-auto overflow-x-hidden divide-y divide-stone/50",
        )}
      >
        {isLoading ? (
          <div className="notif-state-box p-8 text-center flex flex-col items-center justify-center gap-2.5 text-muted-text">
            <div className="loading-spinner w-5 h-5 rounded-full border-2 border-stone border-t-copper animate-spin" />
            <p className="text-xs">{t("notifications.loading")}</p>
          </div>
        ) : error ? (
          <div className="notif-state-box error p-8 text-center flex flex-col items-center justify-center gap-2.5 text-danger">
            <p className="text-xs font-medium">{error}</p>
            <button
              type="button"
              className="filter-button mt-1 px-3 py-1.5 rounded-sm border border-stone bg-ivory-light hover:bg-ivory text-xs font-semibold text-charcoal transition-colors cursor-pointer"
              onClick={() => loadNotifications(filter === "unread", category)}
            >
              {t("common.retry")}
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="notif-state-box empty p-8 text-center flex flex-col items-center justify-center gap-2 text-muted-text">
            <div className="notif-empty-icon text-stone mb-1">
              <Icon name="bell" size={28} />
            </div>
            <h3 className="font-serif text-lg font-normal text-charcoal m-0">
              {t("notifications.empty")}
            </h3>
            <p className="text-xs text-muted-text m-0">
              {t("notifications.emptyDesc")}
            </p>
          </div>
        ) : (
          <div className="notif-list divide-y divide-stone/40">
            {items.map((item) => {
              const isUnread = !item.read_at
              const isClickable = Boolean(item.entity_type && item.entity_id)
              const iconCategory = item.category || item.type.split(".")[0]
              const urgent = isHighPriority(item.type)

              return (
                <div
                  key={item.id}
                  className={cn(
                    "notif-item",
                    "p-3 sm:px-4 sm:py-3.5 flex items-start gap-3 hover:bg-ivory-light cursor-pointer transition-colors text-left",
                    isUnread &&
                      "unread bg-ivory-light/90 relative before:absolute before:left-0 before:top-2 before:bottom-2 before:w-1 before:bg-copper before:rounded-r",
                    isClickable && "clickable",
                  )}
                  onClick={() => handleItemClick(item)}
                  role={isClickable ? "button" : undefined}
                  tabIndex={isClickable ? 0 : undefined}
                  onKeyDown={(e) => {
                    if (isClickable && (e.key === "Enter" || e.key === " ")) {
                      handleItemClick(item)
                    }
                  }}
                >
                  <div className="notif-icon-col shrink-0 mt-0.5">
                    <span
                      className={cn(
                        "notif-icon-wrap w-7 h-7 rounded-full flex items-center justify-center shrink-0",
                        iconCategory,
                        getCategoryIconStyles(iconCategory),
                      )}
                    >
                      <Icon
                        name={getNotificationIcon(item.type, item.category)}
                        size={14}
                      />
                    </span>
                  </div>

                  <div className="notif-content-col min-w-0 flex-1 overflow-hidden">
                    <div className="notif-item-header flex items-center gap-1.5 mb-0.5 flex-wrap">
                      <span className="notif-item-title text-xs font-semibold text-charcoal break-words flex-1 min-w-[120px]">
                        {item.title}
                      </span>
                      {urgent && (
                        <span className="notif-priority-badge">
                          {t("notifications.priorityHigh")}
                        </span>
                      )}
                      <span className="notif-item-time text-2xs text-muted-text shrink-0 font-medium ml-auto">
                        {formatTimestamp(item.created_at)}
                      </span>
                    </div>
                    <p className="notif-item-message text-xs text-muted-text leading-relaxed break-words m-0">
                      {item.message}
                    </p>
                  </div>

                  <div className="notif-action-col shrink-0 ml-1">
                    {isUnread && (
                      <button
                        type="button"
                        className="notif-mark-read-btn p-1.5 rounded-full text-stone hover:text-copper transition-colors cursor-pointer border-0 bg-transparent"
                        onClick={(e) => handleMarkOneRead(e, item)}
                        aria-label={t("notifications.markRead")}
                        title={t("notifications.markRead")}
                      >
                        <span className="notif-unread-dot w-2 h-2 rounded-full bg-copper block" />
                      </button>
                    )}
                  </div>
                </div>
              )
            })}

            {nextBeforeId && (
              <div className="notif-load-more p-3 text-center bg-ivory-light">
                <button
                  type="button"
                  className="filter-button w-full py-2 px-3 text-xs font-semibold border border-stone rounded-sm bg-ivory hover:bg-ivory-warm text-charcoal transition-colors cursor-pointer disabled:opacity-60"
                  onClick={handleLoadMore}
                  disabled={isLoadingMore}
                >
                  {isLoadingMore
                    ? t("notifications.loading")
                    : t("notifications.loadMore")}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  )
}
