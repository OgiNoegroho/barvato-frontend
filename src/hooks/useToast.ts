import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  useMemo,
} from "react"

export type ToastType = "success" | "error" | "warning" | "info"

export interface ToastItem {
  id: string
  message: string
  type: ToastType
  createdAt: number
  durationMs: number
}

export interface ToastContextValue {
  /** All currently visible toasts in chronological order */
  toasts: ToastItem[]
  /** Backward-compatible latest toast message string (or null) */
  toast: string | null
  /** Trigger a toast notification (defaults to 'success' unless error keywords detected) */
  notify: (message: string, type?: ToastType, durationMs?: number) => string
  /** Trigger a success toast */
  success: (message: string, durationMs?: number) => string
  /** Trigger an error toast */
  error: (message: string, durationMs?: number) => string
  /** Trigger a warning toast */
  warning: (message: string, durationMs?: number) => string
  /** Trigger an info toast */
  info: (message: string, durationMs?: number) => string
  /** Manually dismiss a specific toast by id */
  dismiss: (id: string) => void
  /** Clear all active toasts */
  clear: () => void
}

const DEFAULT_DURATION_MS = 3500
const ERROR_DURATION_MS = 4500
const DEDUPE_WINDOW_MS = 1500
const MAX_VISIBLE_TOASTS = 4

let toastCounter = 0

export function inferToastType(message: string, explicitType?: ToastType): ToastType {
  if (explicitType) return explicitType
  const normalized = message.trim()
  if (
    /^(failed|gagal|error|kesalahan|unable|tidak dapat|network error|unauthorized|forbidden)/i.test(
      normalized
    )
  ) {
    return "error"
  }
  if (/^(warning|peringatan|conflict|konflik)/i.test(normalized)) {
    return "warning"
  }
  return "success"
}

export function upsertToastList(
  current: ToastItem[],
  incoming: {
    message: string
    type?: ToastType
    durationMs?: number
    now?: number
    maxItems?: number
    dedupeWindowMs?: number
  }
): { list: ToastItem[]; item: ToastItem | null } {
  const trimmed = incoming.message.trim()
  if (!trimmed) {
    return { list: current, item: null }
  }

  const now = incoming.now ?? Date.now()
  const type = inferToastType(trimmed, incoming.type)
  const durationMs =
    incoming.durationMs ?? (type === "error" ? ERROR_DURATION_MS : DEFAULT_DURATION_MS)
  const maxItems = incoming.maxItems ?? MAX_VISIBLE_TOASTS
  const dedupeWindowMs = incoming.dedupeWindowMs ?? DEDUPE_WINDOW_MS

  // Check if an identical active toast already exists within the deduplication window
  const existingIndex = current.findIndex(
    (t) =>
      t.type === type &&
      t.message.toLowerCase() === trimmed.toLowerCase() &&
      now - t.createdAt <= Math.max(dedupeWindowMs, t.durationMs)
  )

  if (existingIndex !== -1) {
    const existing = current[existingIndex]
    const updated: ToastItem = {
      ...existing,
      message: trimmed,
      createdAt: now,
      durationMs,
    }
    const nextList = [...current]
    nextList[existingIndex] = updated
    return { list: nextList, item: updated }
  }

  toastCounter += 1
  const newItem: ToastItem = {
    id: `toast-${now}-${toastCounter}`,
    message: trimmed,
    type,
    createdAt: now,
    durationMs,
  }

  const nextList = [...current, newItem].slice(-maxItems)
  return { list: nextList, item: newItem }
}

const ToastContext = createContext<ToastContextValue | null>(null)

function useStandaloneToastState(defaultDurationMs = DEFAULT_DURATION_MS): ToastContextValue {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const dismiss = useCallback((id: string) => {
    const timer = timersRef.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timersRef.current.delete(id)
    }
    setToasts((prev) => prev.filter((item) => item.id !== id))
  }, [])

  const clear = useCallback(() => {
    for (const timer of timersRef.current.values()) {
      clearTimeout(timer)
    }
    timersRef.current.clear()
    setToasts([])
  }, [])

  const scheduleDismiss = useCallback(
    (item: ToastItem) => {
      const prevTimer = timersRef.current.get(item.id)
      if (prevTimer) {
        clearTimeout(prevTimer)
      }
      const timer = setTimeout(() => {
        timersRef.current.delete(item.id)
        setToasts((prev) => prev.filter((t) => t.id !== item.id))
      }, item.durationMs)
      timersRef.current.set(item.id, timer)
    },
    []
  )

  const notify = useCallback(
    (message: string, type?: ToastType, durationMs?: number): string => {
      let targetItem: ToastItem | null = null
      setToasts((prev) => {
        const resolvedType = inferToastType(message, type)
        const resolvedDuration =
          durationMs ??
          (resolvedType === "error"
            ? Math.max(defaultDurationMs, ERROR_DURATION_MS)
            : defaultDurationMs)
        const { list, item } = upsertToastList(prev, {
          message,
          type: resolvedType,
          durationMs: resolvedDuration,
        })
        targetItem = item
        return list
      })

      if (targetItem) {
        scheduleDismiss(targetItem)
        return (targetItem as ToastItem).id
      }
      return ""
    },
    [defaultDurationMs, scheduleDismiss]
  )

  const success = useCallback(
    (message: string, durationMs?: number) => notify(message, "success", durationMs),
    [notify]
  )

  const error = useCallback(
    (message: string, durationMs?: number) => notify(message, "error", durationMs),
    [notify]
  )

  const warning = useCallback(
    (message: string, durationMs?: number) => notify(message, "warning", durationMs),
    [notify]
  )

  const info = useCallback(
    (message: string, durationMs?: number) => notify(message, "info", durationMs),
    [notify]
  )

  useEffect(() => {
    const timers = timersRef.current
    return () => {
      for (const timer of timers.values()) {
        clearTimeout(timer)
      }
      timers.clear()
    }
  }, [])

  const latestToastMessage = toasts.length > 0 ? toasts[toasts.length - 1].message : null

  return useMemo(
    () => ({
      toasts,
      toast: latestToastMessage,
      notify,
      success,
      error,
      warning,
      info,
      dismiss,
      clear,
    }),
    [toasts, latestToastMessage, notify, success, error, warning, info, dismiss, clear]
  )
}

export function ToastProvider({
  children,
  defaultDurationMs = DEFAULT_DURATION_MS,
}: {
  children: React.ReactNode
  defaultDurationMs?: number
}) {
  const value = useStandaloneToastState(defaultDurationMs)
  return React.createElement(ToastContext.Provider, { value }, children)
}

export function useToast(defaultDurationMs = DEFAULT_DURATION_MS): ToastContextValue {
  const context = useContext(ToastContext)
  const fallback = useStandaloneToastState(defaultDurationMs)
  return context ?? fallback
}
