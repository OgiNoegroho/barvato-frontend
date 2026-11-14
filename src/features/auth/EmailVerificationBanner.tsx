import { useState } from "react"
import { ApiError } from "../../lib/api"
import { useI18n } from "../../lib/i18n"
import { useAuth } from "./AuthContext"
import { Button } from "../../components/ui/Button"

export function EmailVerificationBanner() {
  const { user, isEmailVerified, resendVerification, refreshSession } = useAuth()
  const { t } = useI18n()
  const [sending, setSending] = useState(false)
  const [feedback, setFeedback] = useState<{ kind: "success" | "warning" | "error"; text: string } | null>(null)

  if (!user || !user.email || isEmailVerified) {
    return null
  }

  const handleResend = async () => {
    if (sending) return
    setSending(true)
    setFeedback(null)

    try {
      const res = await resendVerification()
      setFeedback({
        kind: res.deduplicated ? "warning" : "success",
        text: res.deduplicated
          ? t("auth.resendVerificationDeduplicated")
          : t("auth.resendVerificationSent"),
      })
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === "already_verified") {
          setFeedback({ kind: "success", text: t("auth.resendVerificationAlreadyVerified") })
          await refreshSession()
          return
        }
        if (err.isRateLimited || err.code === "rate_limit_exceeded") {
          setFeedback({ kind: "error", text: t("auth.resendVerificationRateLimited") })
          return
        }
      }
      setFeedback({ kind: "error", text: t("auth.resendVerificationError") })
    } finally {
      setSending(false)
    }
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="mx-4 sm:mx-6 lg:mx-8 xl:mx-9 mt-4 rounded-sm border border-amber-300 bg-amber-50/90 px-4 py-3 text-charcoal flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
    >
      <div className="min-w-0">
        <p className="text-xs font-semibold text-amber-900 m-0">
          {t("auth.emailUnverifiedTitle", { email: user.email })}
        </p>
        <p className="text-xs text-amber-800 m-0 mt-0.5 leading-relaxed">
          {t("auth.emailUnverifiedMessage")}
        </p>
        {feedback && (
          <p
            className={`text-xs m-0 mt-1 font-medium ${
              feedback.kind === "success"
                ? "text-emerald-800"
                : feedback.kind === "warning"
                  ? "text-amber-900"
                  : "text-danger"
            }`}
          >
            {feedback.text}
          </p>
        )}
      </div>

      <div className="shrink-0">
        <Button
          type="button"
          variant="secondary"
          disabled={sending}
          onClick={handleResend}
          className="w-full sm:w-auto text-xs"
        >
          {sending ? t("auth.resendingVerification") : t("auth.resendVerificationButton")}
        </Button>
      </div>
    </div>
  )
}
