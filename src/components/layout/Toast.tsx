import { useToast, type ToastItem, type ToastType, inferToastType } from "../../hooks/useToast"

interface ToastProps {
  message?: string | null
  type?: ToastType
  onDismiss?: () => void
}

function ToastIcon({ type }: { type: ToastType }) {
  if (type === "error") {
    return (
      <span className="toast-icon toast-icon-error" aria-hidden="true">
        !
      </span>
    )
  }
  if (type === "warning") {
    return (
      <span className="toast-icon toast-icon-warning" aria-hidden="true">
        !
      </span>
    )
  }
  if (type === "info") {
    return (
      <span className="toast-icon toast-icon-info" aria-hidden="true">
        i
      </span>
    )
  }
  return (
    <span className="toast-icon toast-icon-success" aria-hidden="true">
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

  return (
    <div className="toast-viewport" aria-label="Toast notifications">
      {items.map((item) => {
        const isUrgent = item.type === "error" || item.type === "warning"
        return (
          <div
            key={item.id}
            className={`toast toast-${item.type}`}
            role={isUrgent ? "alert" : "status"}
            aria-live={isUrgent ? "assertive" : "polite"}
            aria-atomic="true"
          >
            <ToastIcon type={item.type} />
            <span className="toast-message">{item.message}</span>
            <button
              type="button"
              className="toast-close"
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
