import { useState, useCallback, useRef } from "react"

export function useToast(duration = 2600) {
  const [toast, setToast] = useState("")
  const timerRef = useRef<number | null>(null)

  const notify = useCallback(
    (message: string) => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current)
      }
      setToast(message)
      timerRef.current = window.setTimeout(() => {
        setToast("")
        timerRef.current = null
      }, duration)
    },
    [duration],
  )

  const clear = useCallback(() => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current)
    }
    setToast("")
  }, [])

  return { toast, notify, clear }
}
