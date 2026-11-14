import { useEffect, useRef, useState } from "react"
import { ApiError, authApi } from "../../lib/api"
import { useI18n } from "../../lib/i18n"
import { useAuth } from "./AuthContext"
import { Button } from "../../components/ui/Button"

type VerifyStatus =
  | "loading"
  | "success"
  | "already_verified"
  | "invalid_or_expired"
  | "missing_token"
  | "rate_limited"
  | "error"

// In-memory handoff for StrictMode double-mount so we never touch storage or logs
// while still clearing window.location.hash immediately on first read.
let capturedHashToken: string | null = null
let activeVerifyPromise: Promise<void> | null = null

function extractAndStripFragmentToken(): string {
  if (capturedHashToken !== null) {
    return capturedHashToken
  }
  const rawHash = window.location.hash || ""
  const params = new URLSearchParams(rawHash.startsWith("#") ? rawHash.slice(1) : rawHash)
  const token = (params.get("token") || "").trim()

  if (rawHash) {
    window.history.replaceState(null, "", window.location.pathname + window.location.search)
  }

  capturedHashToken = token
  return token
}

export function VerifyEmailPage({ onContinue }: { onContinue: () => void }) {
  const { user, isAuthenticated, isLoading: authLoading, refreshSession, resendVerification } = useAuth()
  const { t } = useI18n()

  const [status, setStatus] = useState<VerifyStatus>("loading")
  const [resendState, setResendState] = useState<"idle" | "sending" | "sent" | "deduplicated" | "rate_limited" | "error">("idle")
  const tokenRef = useRef<string>("")
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const submitToken = (token: string) => {
    if (!token) {
      if (!authLoading && isAuthenticated && user?.email_verified_at) {
        setStatus("already_verified")
      } else {
        setStatus("missing_token")
      }
      return
    }

    setStatus("loading")
    if (!activeVerifyPromise) {
      activeVerifyPromise = authApi
        .verifyEmail(token)
        .then(async () => {
          capturedHashToken = null
          if (isAuthenticated) {
            await refreshSession()
          }
          if (mountedRef.current) {
            setStatus("success")
          }
        })
        .catch((err) => {
          if (!mountedRef.current) return
          if (err instanceof ApiError) {
            if (err.code === "already_verified") {
              setStatus("already_verified")
              return
            }
            if (err.code === "invalid_or_expired_token" || err.status === 400) {
              if (isAuthenticated && user?.email_verified_at) {
                setStatus("already_verified")
              } else {
                setStatus("invalid_or_expired")
              }
              return
            }
            if (err.isRateLimited || err.code === "rate_limit_exceeded") {
              setStatus("rate_limited")
              return
            }
          }
          setStatus("error")
        })
        .finally(() => {
          activeVerifyPromise = null
        })
    }
  }

  useEffect(() => {
    if (authLoading) return
    const token = extractAndStripFragmentToken()
    tokenRef.current = token
    submitToken(token)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading])

  const handleResend = async () => {
    if (resendState === "sending") return
    setResendState("sending")
    try {
      const res = await resendVerification()
      setResendState(res.deduplicated ? "deduplicated" : "sent")
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === "already_verified") {
          await refreshSession()
          setStatus("already_verified")
          setResendState("idle")
          return
        }
        if (err.isRateLimited || err.code === "rate_limit_exceeded") {
          setResendState("rate_limited")
          return
        }
      }
      setResendState("error")
    }
  }

  const isPositive = status === "success" || status === "already_verified"
  const isWarning = status === "invalid_or_expired" || status === "missing_token" || status === "rate_limited"

  let title = t("auth.verifyEmailTitle")
  let message = t("auth.verifyEmailChecking")
  if (status === "success") {
    title = t("auth.verifyEmailSuccessTitle")
    message = t("auth.verifyEmailSuccessMessage")
  } else if (status === "already_verified") {
    title = t("auth.verifyEmailAlreadyTitle")
    message = t("auth.verifyEmailAlreadyMessage")
  } else if (status === "invalid_or_expired") {
    title = t("auth.verifyEmailInvalidTitle")
    message = t("auth.verifyEmailInvalidMessage")
  } else if (status === "missing_token") {
    title = t("auth.verifyEmailMissingTitle")
    message = t("auth.verifyEmailMissingMessage")
  } else if (status === "rate_limited") {
    title = t("auth.verifyEmailErrorTitle")
    message = t("auth.verifyEmailRateLimited")
  } else if (status === "error") {
    title = t("auth.verifyEmailErrorTitle")
    message = t("auth.verifyEmailErrorMessage")
  }

  return (
    <div className="min-h-screen grid place-items-center bg-ivory p-4 sm:p-6 font-sans text-charcoal">
      <div className="w-full max-w-[440px] bg-ivory-light border border-stone rounded-sm p-6 sm:p-10 shadow-card text-center">
        <span
          className={`w-12 h-12 rounded-full grid place-items-center font-serif text-xl font-bold mx-auto mb-4 text-white ${
            status === "loading"
              ? "bg-copper"
              : isPositive
                ? "bg-emerald-700"
                : isWarning
                  ? "bg-amber-600"
                  : "bg-danger"
          }`}
        >
          {status === "loading" ? "B" : isPositive ? "✓" : "!"}
        </span>

        <h1 className="font-serif text-2xl text-charcoal m-0 mb-2">{title}</h1>
        <p className="text-sm text-muted-text m-0 mb-6 leading-relaxed">{message}</p>

        {status === "loading" && (
          <div className="w-8 h-8 border-[3px] border-copper/20 border-t-copper rounded-full animate-spin mx-auto mb-2" />
        )}

        {status === "error" && tokenRef.current && (
          <div className="mb-3">
            <Button
              type="button"
              variant="primary"
              className="w-full"
              onClick={() => submitToken(tokenRef.current)}
            >
              {t("common.retry")}
            </Button>
          </div>
        )}

        {(status === "invalid_or_expired" || status === "missing_token") && isAuthenticated && user?.email && (
          <div className="mb-4 space-y-2">
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              disabled={resendState === "sending" || resendState === "sent" || resendState === "deduplicated"}
              onClick={handleResend}
            >
              {resendState === "sending" ? t("auth.resendingVerification") : t("auth.resendVerificationButton")}
            </Button>
            {resendState === "sent" && (
              <p className="text-xs text-emerald-700 m-0">{t("auth.resendVerificationSent")}</p>
            )}
            {resendState === "deduplicated" && (
              <p className="text-xs text-amber-700 m-0">{t("auth.resendVerificationDeduplicated")}</p>
            )}
            {resendState === "rate_limited" && (
              <p className="text-xs text-danger m-0">{t("auth.resendVerificationRateLimited")}</p>
            )}
            {resendState === "error" && (
              <p className="text-xs text-danger m-0">{t("auth.resendVerificationError")}</p>
            )}
          </div>
        )}

        {status !== "loading" && (
          <Button type="button" variant="primary" className="w-full" onClick={onContinue}>
            {isAuthenticated ? t("auth.verifyEmailBackToDashboard") : t("auth.verifyEmailBackToLogin")}
          </Button>
        )}
      </div>
    </div>
  )
}
