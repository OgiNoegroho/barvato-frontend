import React, { useCallback, useEffect, useRef, useState } from "react"
import { Badge } from "../../components/ui/Badge"
import { Button } from "../../components/ui/Button"
import { Input } from "../../components/ui/Input"
import { Modal } from "../../components/ui/Modal"
import { ApiError, authApi, type AuthMethodsResponse } from "../../lib/api"
import { useI18n } from "../../lib/i18n"
import { useAuth } from "../auth/AuthContext"
import { useToast } from "../../hooks/useToast"
import {
  AUTH_SECURITY_CHANNEL,
  type AuthSecuritySyncMessage,
  computeReauthExpiryMs,
  formatReauthRemaining,
  isReauthWindowActive,
  isUnauthenticatedSessionError,
  mapAccountSecurityError,
  REAUTH_WINDOW_SECONDS,
  shouldFetchMethodsInBackground,
  shouldRefreshOnOAuthNotice,
  validateInitialPassword,
} from "../../lib/accountSecurity"
import type { OAuthSettingsNotice } from "../../lib/routing"
import { ReauthModal } from "./ReauthModal"

type PendingSecurityAction = "link" | "unlink" | null

export interface AccountSecuritySectionProps {
  oauthNotice?: OAuthSettingsNotice | null
}

function formatDateTime(iso: string | null | undefined, language: string): string {
  if (!iso) return "—"
  const parsed = new Date(iso)
  if (Number.isNaN(parsed.getTime())) return iso
  return parsed.toLocaleString(language === "id" ? "id-ID" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  })
}

export function AccountSecuritySection({ oauthNotice = null }: AccountSecuritySectionProps) {
  const { refreshSession } = useAuth()
  const { t, language } = useI18n()
  const toast = useToast()

  const [methods, setMethods] = useState<AuthMethodsResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [reauthExpiresAtMs, setReauthExpiresAtMs] = useState<number | null>(null)
  const [nowMs, setNowMs] = useState(() => Date.now())
  const [isReauthOpen, setIsReauthOpen] = useState(false)
  const [isUnlinkConfirmOpen, setIsUnlinkConfirmOpen] = useState(false)
  const [pendingAction, setPendingAction] = useState<PendingSecurityAction>(null)

  const [actionError, setActionError] = useState<string | null>(null)
  const [isLinking, setIsLinking] = useState(false)
  const [isUnlinking, setIsUnlinking] = useState(false)

  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [isSettingPassword, setIsSettingPassword] = useState(false)

  const inFlightMethodsRef = useRef(false)
  const lastMethodsFetchAtRef = useRef(0)
  const hasLoadedOnceRef = useRef(false)
  const lastHandledNoticeRef = useRef<string | null>(null)
  const channelRef = useRef<BroadcastChannel | null>(null)
  const reauthExpiresAtRef = useRef<number | null>(null)
  const sessionExpiredRef = useRef(false)

  useEffect(() => {
    reauthExpiresAtRef.current = reauthExpiresAtMs
  }, [reauthExpiresAtMs])

  const handleUnauthenticatedError = useCallback(
    (err: unknown): boolean => {
      if (isUnauthenticatedSessionError(err)) {
        if (!sessionExpiredRef.current) {
          sessionExpiredRef.current = true
          void refreshSession()
        }
        return true
      }
      return false
    },
    [refreshSession]
  )

  const broadcastMethodsUpdated = useCallback(() => {
    try {
      const msg: AuthSecuritySyncMessage = { type: "auth-methods-updated" }
      channelRef.current?.postMessage(msg)
    } catch {
      // Ignore BroadcastChannel errors when closed or unsupported
    }
  }, [])

  const loadMethods = useCallback(
    async (options: { silent?: boolean; force?: boolean } = {}) => {
      const { silent = false, force = false } = options
      if (sessionExpiredRef.current || inFlightMethodsRef.current) return
      if (
        !force &&
        hasLoadedOnceRef.current &&
        !shouldFetchMethodsInBackground(inFlightMethodsRef.current, lastMethodsFetchAtRef.current)
      ) {
        return
      }

      inFlightMethodsRef.current = true
      if (!silent || !hasLoadedOnceRef.current) {
        setIsLoading(true)
      }
      setLoadError(null)
      try {
        const res = await authApi.methods()
        hasLoadedOnceRef.current = true
        lastMethodsFetchAtRef.current = Date.now()
        setMethods(res)
        if (!res.reauthenticated) {
          setReauthExpiresAtMs(null)
        }
      } catch (err) {
        if (handleUnauthenticatedError(err)) {
          return
        }
        if (!silent || !hasLoadedOnceRef.current) {
          const mapped = mapAccountSecurityError(err, language)
          setLoadError(mapped.message)
        }
      } finally {
        inFlightMethodsRef.current = false
        setIsLoading(false)
      }
    },
    [language, handleUnauthenticatedError]
  )

  useEffect(() => {
    void loadMethods({ force: true })
  }, [loadMethods])

  useEffect(() => {
    const noticeKey = shouldRefreshOnOAuthNotice(oauthNotice, lastHandledNoticeRef.current)
    if (!noticeKey) return
    lastHandledNoticeRef.current = noticeKey
    if (hasLoadedOnceRef.current) {
      void loadMethods({ force: true, silent: true })
    }
    if (oauthNotice?.kind === "success") {
      broadcastMethodsUpdated()
    }
  }, [oauthNotice, loadMethods, broadcastMethodsUpdated])

  useEffect(() => {
    if (typeof window === "undefined") return

    const syncLocalExpiryAndRefresh = (force = false) => {
      if (sessionExpiredRef.current) return
      const current = Date.now()
      const expiry = reauthExpiresAtRef.current
      if (expiry !== null) {
        setNowMs(current)
        if (current >= expiry) {
          setReauthExpiresAtMs(null)
          setMethods((prev) => (prev ? { ...prev, reauthenticated: false } : prev))
        }
      }
      void loadMethods({ silent: true, force })
    }

    const handleVisibilityChange = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        syncLocalExpiryAndRefresh(false)
      }
    }

    const handleWindowFocus = () => {
      syncLocalExpiryAndRefresh(false)
    }

    window.addEventListener("focus", handleWindowFocus)
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", handleVisibilityChange)
    }

    let channel: BroadcastChannel | null = null
    if (typeof BroadcastChannel !== "undefined") {
      channel = new BroadcastChannel(AUTH_SECURITY_CHANNEL)
      channelRef.current = channel
      channel.onmessage = (event: MessageEvent<AuthSecuritySyncMessage>) => {
        if (event.data?.type === "auth-methods-updated") {
          syncLocalExpiryAndRefresh(true)
        }
      }
    }

    return () => {
      window.removeEventListener("focus", handleWindowFocus)
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", handleVisibilityChange)
      }
      if (channel) {
        channel.onmessage = null
        channel.close()
        if (channelRef.current === channel) {
          channelRef.current = null
        }
      }
    }
  }, [loadMethods])

  useEffect(() => {
    if (reauthExpiresAtMs === null) return
    const timer = window.setInterval(() => {
      const current = Date.now()
      setNowMs(current)
      if (current >= reauthExpiresAtMs) {
        setReauthExpiresAtMs(null)
        setMethods((prev) => (prev ? { ...prev, reauthenticated: false } : prev))
      }
    }, 1000)
    return () => window.clearInterval(timer)
  }, [reauthExpiresAtMs])

  const reauthActive = methods
    ? isReauthWindowActive(reauthExpiresAtMs, methods.reauthenticated, nowMs)
    : false
  const reauthRemaining = formatReauthRemaining(reauthExpiresAtMs, nowMs)

  const executeGoogleLinkStart = useCallback(async () => {
    if (isLinking || isUnlinking) return
    setActionError(null)
    setIsLinking(true)
    try {
      const res = await authApi.googleLinkStart()
      if (typeof window !== "undefined" && res.authorize_url) {
        window.location.assign(res.authorize_url)
        return
      }
      setIsLinking(false)
      setActionError(
        language === "id"
          ? "Gagal mendapatkan tautan otorisasi Google. Silakan coba lagi."
          : "Unable to obtain Google authorization URL. Please try again."
      )
    } catch (err) {
      setIsLinking(false)
      if (handleUnauthenticatedError(err)) return
      const mapped = mapAccountSecurityError(err, language)
      if (mapped.requiresReauth) {
        setReauthExpiresAtMs(null)
        setMethods((prev) => (prev ? { ...prev, reauthenticated: false } : prev))
        setPendingAction("link")
        setIsReauthOpen(true)
        return
      }
      setActionError(mapped.message)
    }
  }, [isLinking, isUnlinking, language, handleUnauthenticatedError])

  const executeGoogleUnlink = useCallback(async () => {
    if (isLinking || isUnlinking) return
    setActionError(null)
    setIsUnlinking(true)
    try {
      await authApi.googleUnlink()
      toast.notify(t("security.googleUnlinkSuccessToast"))
      await loadMethods({ force: true, silent: true })
      broadcastMethodsUpdated()
    } catch (err) {
      if (handleUnauthenticatedError(err)) return
      const mapped = mapAccountSecurityError(err, language)
      if (mapped.requiresReauth) {
        setReauthExpiresAtMs(null)
        setMethods((prev) => (prev ? { ...prev, reauthenticated: false } : prev))
        setPendingAction("unlink")
        setIsReauthOpen(true)
        return
      }
      if (err instanceof ApiError && err.code === "google_not_linked") {
        void loadMethods({ force: true, silent: true })
      }
      setActionError(mapped.message)
    } finally {
      setIsUnlinking(false)
    }
  }, [isLinking, isUnlinking, language, loadMethods, broadcastMethodsUpdated, handleUnauthenticatedError, t, toast])

  const handleRequestLinkGoogle = () => {
    if (isLinking || isUnlinking || !methods?.google_enabled) return
    setActionError(null)
    if (!reauthActive) {
      setPendingAction("link")
      setIsReauthOpen(true)
      return
    }
    void executeGoogleLinkStart()
  }

  const handleRequestUnlinkGoogle = () => {
    if (isLinking || isUnlinking || !methods?.has_password || !methods?.google?.linked) return
    setActionError(null)
    setIsUnlinkConfirmOpen(true)
  }

  const handleConfirmUnlinkGoogle = () => {
    setIsUnlinkConfirmOpen(false)
    if (isLinking || isUnlinking || !methods?.has_password) return
    if (!reauthActive) {
      setPendingAction("unlink")
      setIsReauthOpen(true)
      return
    }
    void executeGoogleUnlink()
  }

  const handleReauthSuccess = (expiresInSeconds: number) => {
    const expiry = computeReauthExpiryMs(expiresInSeconds || REAUTH_WINDOW_SECONDS)
    setNowMs(Date.now())
    setReauthExpiresAtMs(expiry)
    setMethods((prev) => (prev ? { ...prev, reauthenticated: true } : prev))
    setIsReauthOpen(false)
    toast.notify(t("security.reauthSuccessToast"))
    broadcastMethodsUpdated()

    const nextAction = pendingAction
    setPendingAction(null)
    if (nextAction === "link") {
      void executeGoogleLinkStart()
    } else if (nextAction === "unlink") {
      void executeGoogleUnlink()
    }
  }

  const handleSetInitialPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSettingPassword) return

    const validationError = validateInitialPassword(newPassword, confirmPassword, language)
    if (validationError) {
      setPasswordError(validationError)
      return
    }

    setPasswordError(null)
    setIsSettingPassword(true)
    try {
      await authApi.setPassword(newPassword)
      setNewPassword("")
      setConfirmPassword("")
      setShowNewPassword(false)
      setShowConfirmPassword(false)
      toast.notify(t("security.setPasswordSuccessToast"))
      await loadMethods({ force: true, silent: true })
      broadcastMethodsUpdated()
    } catch (err) {
      if (handleUnauthenticatedError(err)) return
      const mapped = mapAccountSecurityError(err, language)
      setPasswordError(mapped.message)
      if (err instanceof ApiError && err.code === "password_already_set") {
        void loadMethods({ force: true, silent: true })
      }
    } finally {
      setIsSettingPassword(false)
    }
  }

  if (isLoading) {
    return (
      <div className="bg-ivory-light border border-stone rounded-sm p-6 text-xs text-muted-text">
        {t("security.loadingMethods")}
      </div>
    )
  }

  if (loadError || !methods) {
    return (
      <div className="bg-ivory-light border border-stone rounded-sm p-6 space-y-3">
        <div className="p-3.5 rounded-sm bg-danger-soft border border-danger-line text-danger space-y-1">
          <div className="text-xs font-bold">{t("security.loadErrorTitle")}</div>
          {loadError && <div className="text-xs">{loadError}</div>}
        </div>
        <Button type="button" variant="secondary" size="sm" onClick={() => void loadMethods({ force: true })}>
          {t("common.retry")}
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {actionError && (
        <div
          role="alert"
          className="p-3.5 rounded-sm bg-danger-soft border border-danger-line text-danger text-xs"
        >
          {actionError}
        </div>
      )}

      {/* Reauthentication Status Card */}
      {methods.has_password && (
        <div className="bg-ivory-light border border-stone rounded-sm p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-charcoal m-0">
                {t("security.reauthStatusTitle")}
              </h3>
              <Badge variant={reauthActive ? "success" : "neutral"}>
                {reauthActive
                  ? reauthRemaining
                    ? t("security.reauthActiveCountdown", { remaining: reauthRemaining })
                    : t("security.reauthActive")
                  : t("security.reauthInactive")}
              </Badge>
            </div>
            {!reauthActive && (
              <p className="text-xs text-muted-text m-0">{t("security.reauthInactive")}</p>
            )}
          </div>
          {!reauthActive && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                setPendingAction(null)
                setIsReauthOpen(true)
              }}
            >
              {t("security.reauthVerifyButton")}
            </Button>
          )}
        </div>
      )}

      {/* Password Authentication Card */}
      <div className="bg-ivory-light border border-stone rounded-sm p-5 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-charcoal m-0">
            {t("security.passwordSectionTitle")}
          </h3>
          <Badge variant={methods.has_password ? "success" : "warning"}>
            {methods.has_password
              ? t("security.passwordConfiguredBadge")
              : t("security.passwordNotSetBadge")}
          </Badge>
        </div>

        <p className="text-xs text-muted-text leading-relaxed m-0">
          {methods.has_password
            ? t("security.passwordConfiguredDesc")
            : t("security.passwordNotSetDesc")}
        </p>

        {!methods.has_password && (
          <form onSubmit={handleSetInitialPassword} className="space-y-3 pt-1 max-w-md" noValidate>
            {passwordError && (
              <div
                role="alert"
                className="p-3 rounded-sm bg-danger-soft border border-danger-line text-danger text-xs"
              >
                {passwordError}
              </div>
            )}

            <Input
              label={t("security.newPasswordLabel")}
              type={showNewPassword ? "text" : "password"}
              autoComplete="new-password"
              helperText={t("security.passwordLengthHint")}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={isSettingPassword}
              className="pr-24"
              rightIcon={
                <button
                  type="button"
                  aria-pressed={showNewPassword}
                  aria-label={`${showNewPassword ? t("security.hidePassword") : t("security.showPassword")} ${t("security.newPasswordLabel")}`}
                  onClick={() => setShowNewPassword((prev) => !prev)}
                  disabled={isSettingPassword}
                  className="bg-transparent border-0 text-xs font-medium text-muted-text hover:text-charcoal cursor-pointer disabled:cursor-not-allowed"
                >
                  {showNewPassword ? t("security.hidePassword") : t("security.showPassword")}
                </button>
              }
              required
            />

            <Input
              label={t("security.confirmPasswordLabel")}
              type={showConfirmPassword ? "text" : "password"}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={isSettingPassword}
              className="pr-24"
              rightIcon={
                <button
                  type="button"
                  aria-pressed={showConfirmPassword}
                  aria-label={`${showConfirmPassword ? t("security.hidePassword") : t("security.showPassword")} ${t("security.confirmPasswordLabel")}`}
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  disabled={isSettingPassword}
                  className="bg-transparent border-0 text-xs font-medium text-muted-text hover:text-charcoal cursor-pointer disabled:cursor-not-allowed"
                >
                  {showConfirmPassword ? t("security.hidePassword") : t("security.showPassword")}
                </button>
              }
              required
            />

            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isSettingPassword}
              disabled={isSettingPassword}
            >
              {isSettingPassword ? t("security.settingPassword") : t("security.setPasswordButton")}
            </Button>
          </form>
        )}
      </div>

      {/* Google Account Linking Card */}
      <div className="bg-ivory-light border border-stone rounded-sm p-5 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-charcoal m-0">
            {t("security.googleSectionTitle")}
          </h3>
          <Badge
            variant={
              !methods.google_enabled
                ? "neutral"
                : methods.google?.linked
                  ? "success"
                  : "neutral"
            }
          >
            {!methods.google_enabled
              ? t("security.googleDisabledBadge")
              : methods.google?.linked
                ? t("security.googleLinkedBadge")
                : t("security.googleUnlinkedBadge")}
          </Badge>
        </div>

        {!methods.google_enabled && (
          <p className="text-xs text-muted-text leading-relaxed m-0">
            {t("security.googleDisabledDesc")}
          </p>
        )}

        {methods.google?.linked ? (
          <div className="space-y-4">
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs m-0 p-3.5 rounded-sm bg-ivory border border-stone">
              <div>
                <dt className="text-muted-text mb-0.5">{t("security.googleEmailLabel")}</dt>
                <dd className="font-semibold text-charcoal m-0 break-all">
                  {methods.google.email}
                </dd>
              </div>
              <div>
                <dt className="text-muted-text mb-0.5">{t("security.googleVerifiedLabel")}</dt>
                <dd className="font-semibold text-charcoal m-0">
                  {methods.google.email_verified
                    ? t("security.googleVerifiedYes")
                    : t("security.googleVerifiedNo")}
                </dd>
              </div>
              <div>
                <dt className="text-muted-text mb-0.5">{t("security.googleLinkedAtLabel")}</dt>
                <dd className="text-charcoal m-0">
                  {formatDateTime(methods.google.linked_at, language)}
                </dd>
              </div>
              <div>
                <dt className="text-muted-text mb-0.5">{t("security.googleLastUsedLabel")}</dt>
                <dd className="text-charcoal m-0">
                  {formatDateTime(methods.google.last_used_at, language)}
                </dd>
              </div>
            </dl>

            {!methods.has_password && (
              <div className="p-3 rounded-sm bg-ivory border border-stone text-xs text-muted-text leading-relaxed">
                {t("security.unlinkRequiresPassword")}
              </div>
            )}

            <Button
              type="button"
              variant="danger"
              size="sm"
              isLoading={isUnlinking}
              disabled={!methods.has_password || isUnlinking || isLinking}
              onClick={handleRequestUnlinkGoogle}
            >
              {isUnlinking ? t("security.googleUnlinking") : t("security.googleUnlinkButton")}
            </Button>
          </div>
        ) : (
          methods.google_enabled && (
            <div>
              <Button
                type="button"
                variant="primary"
                size="sm"
                isLoading={isLinking}
                disabled={isLinking || isUnlinking || !methods.has_password}
                onClick={handleRequestLinkGoogle}
              >
                {isLinking ? t("security.googleLinking") : t("security.googleLinkButton")}
              </Button>
            </div>
          )
        )}
      </div>

      <Modal
        isOpen={isUnlinkConfirmOpen}
        onClose={() => {
          if (!isUnlinking) setIsUnlinkConfirmOpen(false)
        }}
        size="sm"
        closeOnBackdrop={!isUnlinking}
        closeOnEscape={!isUnlinking}
      >
        <div className="p-6 space-y-4">
          <div className="space-y-1.5">
            <h2 className="text-lg font-bold text-charcoal m-0">
              {t("security.unlinkConfirmTitle")}
            </h2>
            <p className="text-xs text-muted-text leading-relaxed m-0">
              {t("security.unlinkConfirmMessage", {
                email: methods.google?.email ?? "",
              })}
            </p>
          </div>

          <div className="flex justify-end gap-2.5 pt-1">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsUnlinkConfirmOpen(false)}
              disabled={isUnlinking}
            >
              {t("common.cancel")}
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={handleConfirmUnlinkGoogle}
              isLoading={isUnlinking}
              disabled={isUnlinking}
            >
              {t("security.unlinkConfirmButton")}
            </Button>
          </div>
        </div>
      </Modal>

      <ReauthModal
        isOpen={isReauthOpen}
        onClose={() => {
          setIsReauthOpen(false)
          setPendingAction(null)
        }}
        onSuccess={handleReauthSuccess}
      />
    </div>
  )
}
