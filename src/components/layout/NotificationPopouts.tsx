import React from "react"
import { Icon } from "../ui/Icon"
import type { IconName } from "../../types"
import { useI18n } from "../../lib/i18n"
import type { NotificationItem } from "../../lib/api"
import { cn } from "../../lib/utils"

export interface PopoutItem {
  id: number
  notification: NotificationItem
  addedAt: number
}

interface NotificationPopoutsProps {
  items: PopoutItem[]
  onDismiss: (id: number) => void
  onClick: (item: NotificationItem) => void
}

export function NotificationPopouts({
  items,
  onDismiss,
  onClick,
}: NotificationPopoutsProps) {
  const { t } = useI18n()

  if (items.length === 0) return null

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
      type.includes("walk_in") ||
      type.includes("walkin")
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

  const isHighPriority = (type: string): boolean => {
    return (
      type.includes("overdue") ||
      type.includes("excessive_wait") ||
      type.includes("cancelled") ||
      type.includes("unavailable") ||
      type.includes("closure")
    )
  }

  const getCategoryIconStyles = (category: string) => {
    switch (category) {
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

  return (
    <div
      className="notif-popouts-container"
      role="region"
      aria-label="Incoming notifications"
    >
      {items.map((item) => {
        const notif = item.notification
        const urgent = isHighPriority(notif.type)
        const iconCategory =
          notif.category === "barber"
            ? "staff"
            : notif.category || notif.type.split(".")[0]

        return (
          <div
            key={item.id}
            className={`notif-popout-card ${urgent ? "urgent" : ""}`}
            onClick={() => onClick(notif)}
            role="alert"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                onClick(notif)
              }
            }}
          >
            <div className="notif-popout-icon shrink-0">
              <span
                className={cn(
                  "notif-icon-wrap w-7 h-7 rounded-full flex items-center justify-center shrink-0",
                  iconCategory,
                  getCategoryIconStyles(iconCategory),
                )}
              >
                <Icon
                  name={getNotificationIcon(notif.type, notif.category)}
                  size={14}
                />
              </span>
            </div>

            <div className="notif-popout-content min-w-0 flex-1 overflow-hidden">
              <div className="notif-popout-header flex items-center gap-1.5 mb-0.5">
                <span className="notif-popout-title text-xs font-semibold text-charcoal truncate">
                  {notif.title}
                </span>
                {urgent && (
                  <span className="notif-priority-badge">
                    {t("notifications.priorityHigh")}
                  </span>
                )}
                <span className="notif-popout-time text-2xs text-muted-text ml-auto shrink-0 font-medium">
                  {t("notifications.justNow")}
                </span>
              </div>
              <p className="notif-popout-message text-2xs text-muted-text leading-snug line-clamp-2 break-words m-0">
                {notif.message}
              </p>
            </div>

            <button
              type="button"
              className="notif-popout-close-btn"
              onClick={(e) => {
                e.stopPropagation()
                onDismiss(item.id)
              }}
              aria-label={t("common.close")}
              title={t("common.close")}
            >
              ×
            </button>
          </div>
        )
      })}
    </div>
  )
}
