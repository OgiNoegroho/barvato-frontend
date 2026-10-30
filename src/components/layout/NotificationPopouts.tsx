import React from "react"
import { Icon } from "../ui/Icon"
import type { IconName } from "../../types"
import { useI18n } from "../../lib/i18n"
import type { NotificationItem } from "../../lib/api"

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

export function NotificationPopouts({ items, onDismiss, onClick }: NotificationPopoutsProps) {
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
    if (cat === "queue" || type.startsWith("queue") || type.includes("walk_in") || type.includes("walkin")) {
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

  return (
    <div className="notif-popouts-container" role="region" aria-label="Incoming notifications">
      {items.map((item) => {
        const notif = item.notification
        const urgent = isHighPriority(notif.type)
        const iconCategory = notif.category === "barber" ? "staff" : notif.category || notif.type.split(".")[0]

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
            <div className="notif-popout-icon">
              <span className={`notif-icon-wrap ${iconCategory}`}>
                <Icon name={getNotificationIcon(notif.type, notif.category)} size={14} />
              </span>
            </div>

            <div className="notif-popout-content">
              <div className="notif-popout-header">
                <span className="notif-popout-title">{notif.title}</span>
                {urgent && (
                  <span className="notif-priority-badge">{t("notifications.priorityHigh")}</span>
                )}
                <span className="notif-popout-time">{t("notifications.justNow")}</span>
              </div>
              <p className="notif-popout-message">{notif.message}</p>
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

