import {
  useToast,
  type ToastItem,
  type ToastType,
  inferToastType,
} from "../../hooks/useToast"
import { cn } from "../../lib/utils"

interface ToastProps {
  message?: string | null
  type?: ToastType
  onDismiss?: () => void
}

function ToastIcon({ type }: { type: ToastType }) {
  const iconBase =
    "toast-icon w-5 h-5 rounded-full flex items-center justify-center shrink-0 font-bold text-xs"

  if (type === "error") {
    return (
      <span
        className={cn(iconBase, "toast-icon-error bg-danger-soft text-danger")}
        aria-hidden="true"
      >
        !
      </span>
    )
  }
  if (type === "warning") {
    return (
      <span
        className={cn(
          iconBase,
          "toast-icon-warning bg-amber-soft text-amber-dark",
        )}
        aria-hidden="true"
      >
        !
      </span>
    )
  }
  if (type === "info") {
    return (
      <span
        className={cn(iconBase, "toast-icon-info bg-copper-soft text-copper")}
        aria-hidden="true"
      >
        i
      </span>
    )
  }
  return (
    <span
      className={cn(iconBase, "toast-icon-success bg-forest-soft text-forest")}
      aria-hidden="true"
    >
      ✓
    </span>
  )
}

export function Toast({ message, type, onDismiss }: ToastProps) {
  const { toasts, dismiss } = useToast()

  // Combine context toasts with optional standalone message prop if not already in context
  const items: ToastItem[] =
    toasts.length > 0
      ? toasts
      : message
        ? [
            {
              id: "standalone-toast",
              message,
              type: inferToastType(message, type),
              createdAt: 0,
              durationMs: 3500,
            },
          ]
        : []

  if (items.length === 0) return null

  const variantStyles: Record<ToastType, string> = {
    success: "border-l-[3px] border-l-forest",
    error:
      "border-l-[3px] border-l-danger bg-[#231817] border-danger/40 text-ivory-light",
    warning: "border-l-[3px] border-l-amber",
    info: "border-l-[3px] border-l-copper",
  }

  return (
    <div
      className={cn(
        "toast-viewport",
        "fixed right-4 sm:right-6 bottom-4 sm:bottom-6 z-toast flex flex-col gap-2.5 w-full max-w-[390px] pointer-events-none",
      )}
      aria-label="Toast notifications"
    >
      {items.map((item) => {
        const isUrgent = item.type === "error" || item.type === "warning"
        return (
          <div
            key={item.id}
            className={cn(
              "toast",
              `toast-${item.type}`,
              "pointer-events-auto relative bg-charcoal text-ivory-light border border-stone-muted/30 p-3 sm:px-3.5 sm:py-3 flex items-center gap-2.5 rounded-sm shadow-dropdown text-xs font-sans",
              variantStyles[item.type],
            )}
            role={isUrgent ? "alert" : "status"}
            aria-live={isUrgent ? "assertive" : "polite"}
            aria-atomic="true"
          >
            <ToastIcon type={item.type} />
            <span className="toast-message text-xs font-medium text-ivory-light flex-1 break-words leading-snug">
              {item.message}
            </span>
            <button
              type="button"
              className="toast-close ml-auto shrink-0 w-6 h-6 rounded grid place-items-center text-stone-muted hover:text-ivory-light text-base leading-none transition-colors cursor-pointer border-0 bg-transparent"
              onClick={() => {
                if (item.id === "standalone-toast") {
                  onDismiss?.()
                } else {
                  dismiss(item.id)
                }
              }}
              aria-label="Dismiss notification"
              title="Dismiss"
            >
              ×
            </button>
          </div>
        )
      })}
    </div>
  )
}
