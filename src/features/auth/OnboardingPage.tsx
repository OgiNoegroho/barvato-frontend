import React, { useCallback, useEffect, useState } from "react"
import { useAuth } from "./AuthContext"
import { authApi, type OnboardingStatusResponse } from "../../lib/api"
import { Button } from "../../components/ui/Button"
import { Icon } from "../../components/ui/Icon"
import { Input } from "../../components/ui/Input"
import { Select } from "../../components/ui/Select"
import { useI18n } from "../../lib/i18n"
import {
  commissionPercentToBps,
  DEFAULT_LEGAL_VERSION,
  mapOnboardingApiError,
  ONBOARDING_TIMEZONES,
  validateOnboardingInput,
} from "../../lib/onboarding"

export interface OnboardingPageProps {
  conflict: string | null
  onDismissConflict: () => void
  onBackToLogin: () => void
  onCompleted: () => void
}

type StatusPhase = "loading" | "ready" | "expired" | "error"

export function OnboardingPage({
  conflict,
  onDismissConflict,
  onBackToLogin,
  onCompleted,
}: OnboardingPageProps) {
  const { refreshSession } = useAuth()
  const { t, language, setLanguage } = useI18n()

  const [statusPhase, setStatusPhase] = useState<StatusPhase>("loading")
  const [statusData, setStatusData] = useState<OnboardingStatusResponse | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [shopName, setShopName] = useState("")
  const [ownerName, setOwnerName] = useState("")
  const [phone, setPhone] = useState("")
  const [timezone, setTimezone] = useState<string>(ONBOARDING_TIMEZONES[0].value)
  const [cutsHair, setCutsHair] = useState(false)
  const [commissionPercent, setCommissionPercent] = useState("40")
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [privacyAccepted, setPrivacyAccepted] = useState(false)

  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)

  const loadStatus = useCallback(async () => {
    setStatusPhase("loading")
    setLoadError(null)
    try {
      const res = await authApi.onboardingStatus()
      if (!res.active) {
        setStatusData(null)
        setStatusPhase("expired")
        return
      }
      setStatusData(res)
      if (res.name) {
        setOwnerName((prev) => (prev.trim() === "" ? res.name ?? "" : prev))
      }
      setStatusPhase("ready")
    } catch (err) {
      const mapped = mapOnboardingApiError(err, language)
      if (mapped.expired) {
        setStatusData(null)
        setStatusPhase("expired")
        return
      }
      setLoadError(mapped.message)
      setStatusPhase("error")
    }
  }, [language])

  useEffect(() => {
    void loadStatus()
  }, [loadStatus])

  const handleCancelOnboarding = async () => {
    if (isSubmitting || isCancelling) return
    setIsCancelling(true)
    setFormError(null)
    try {
      await authApi.onboardingCancel()
      onBackToLogin()
    } catch (err) {
      const mapped = mapOnboardingApiError(err, language)
      if (mapped.expired) {
        onBackToLogin()
        return
      }
      setFormError(mapped.message)
    } finally {
      setIsCancelling(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSubmitting || isCancelling) return

    const validationError = validateOnboardingInput(
      {
        shopName,
        ownerName,
        phone,
        timezone,
        cutsHair,
        commissionPercent,
        termsAccepted,
        privacyAccepted,
      },
      language
    )

    if (validationError) {
      setFormError(validationError)
      return
    }

    setFormError(null)
    setIsSubmitting(true)

    try {
      const commissionBps = cutsHair ? commissionPercentToBps(commissionPercent) ?? 0 : 0
      await authApi.onboardingComplete({
        shop_name: shopName.trim(),
        owner_name: ownerName.trim() || undefined,
        phone: phone.trim() || undefined,
        timezone,
        cuts_hair: cutsHair,
        commission_bps: cutsHair ? commissionBps : undefined,
        terms_accepted: termsAccepted,
        privacy_accepted: privacyAccepted,
        terms_version: DEFAULT_LEGAL_VERSION,
        privacy_version: DEFAULT_LEGAL_VERSION,
      })
      await refreshSession()
      onCompleted()
    } catch (err) {
      const mapped = mapOnboardingApiError(err, language)
      if (mapped.expired) {
        setStatusData(null)
        setStatusPhase("expired")
        return
      }
      setFormError(mapped.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen w-full bg-surface-background flex flex-col justify-center items-center p-4 sm:p-6">
      <div className="w-full max-w-lg mb-4 flex justify-end">
        <button
          type="button"
          onClick={() => setLanguage(language === "id" ? "en" : "id")}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-surface-card border border-border-subtle text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
        >
          <span>{language === "id" ? "Bahasa Indonesia" : "English"}</span>
        </button>
      </div>

      <div className="w-full max-w-lg bg-surface-card rounded-card border border-border-subtle shadow-card p-6 sm:p-8 space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-accent-primary/10 text-accent-primary mb-1">
            <Icon name="scissors" size={24} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-text-primary">
            {t("onboarding.title")}
          </h1>
          <p className="text-sm text-text-secondary">{t("onboarding.subtitle")}</p>
        </div>

        {statusPhase === "loading" && (
          <div className="py-10 flex flex-col items-center gap-3 text-center">
            <div className="w-7 h-7 rounded-full border-2 border-accent-primary border-t-transparent animate-spin" />
            <p className="text-sm font-medium text-text-secondary">
              {t("onboarding.loadingStatus")}
            </p>
          </div>
        )}

        {statusPhase === "error" && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-status-danger-bg border border-status-danger/20 text-status-danger space-y-1.5">
              <div className="font-semibold text-sm">{t("onboarding.loadErrorTitle")}</div>
              {loadError && <p className="text-xs leading-relaxed">{loadError}</p>}
            </div>
            <div className="flex flex-col sm:flex-row gap-2.5">
              <Button
                type="button"
                variant="primary"
                className="w-full"
                onClick={() => void loadStatus()}
              >
                {t("common.retry")}
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="w-full"
                onClick={onBackToLogin}
              >
                {t("onboarding.backToLogin")}
              </Button>
            </div>
          </div>
        )}

        {statusPhase === "expired" && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-status-warning-bg border border-status-warning/20 text-status-warning space-y-1.5">
              <div className="font-semibold text-sm">{t("onboarding.expiredTitle")}</div>
              <p className="text-xs leading-relaxed">{t("onboarding.expiredSubtitle")}</p>
            </div>
            <Button type="button" variant="primary" className="w-full" onClick={onBackToLogin}>
              {t("onboarding.backToLogin")}
            </Button>
          </div>
        )}

        {statusPhase === "ready" && (
          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            {conflict === "active_session" && (
              <div
                role="alert"
                className="p-4 rounded-xl bg-status-warning-bg border border-status-warning/20 text-status-warning space-y-3"
              >
                <p className="text-xs leading-relaxed">
                  {t("onboarding.conflictMessage", {
                    email: statusData?.email ?? "",
                  })}
                </p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={onDismissConflict}
                    disabled={isSubmitting || isCancelling}
                  >
                    {t("onboarding.continueExisting")}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="danger"
                    onClick={() => void handleCancelOnboarding()}
                    disabled={isSubmitting || isCancelling}
                    isLoading={isCancelling}
                  >
                    {t("onboarding.cancelAndRestart")}
                  </Button>
                </div>
              </div>
            )}

            <div className="p-3.5 rounded-xl bg-accent-primary/5 border border-accent-primary/20 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent-primary">
                  {t("onboarding.trialBadge")}
                </span>
                {statusData?.email && (
                  <span className="text-xs font-medium text-text-secondary truncate">
                    {statusData.email}
                  </span>
                )}
              </div>
              <p className="text-xs text-text-secondary leading-relaxed">
                {t("onboarding.trialDescription")}
              </p>
              {statusData?.email && (
                <p className="text-[11px] text-text-muted">
                  {t("onboarding.verifiedEmailLabel")}: {statusData.email}
                </p>
              )}
            </div>

            {formError && (
              <div
                role="alert"
                className="p-3.5 rounded-xl bg-status-danger-bg border border-status-danger/20 text-status-danger text-sm"
              >
                <span>{formError}</span>
              </div>
            )}

            <div className="space-y-4">
              <Input
                label={t("onboarding.shopNameLabel")}
                placeholder={t("onboarding.shopNamePlaceholder")}
                value={shopName}
                onChange={(e) => setShopName(e.target.value)}
                required
                disabled={isSubmitting || isCancelling}
              />

              <Input
                label={t("onboarding.ownerNameLabel")}
                placeholder={t("onboarding.ownerNamePlaceholder")}
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                disabled={isSubmitting || isCancelling}
              />

              <Input
                label={t("onboarding.phoneLabel")}
                placeholder={t("onboarding.phonePlaceholder")}
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={isSubmitting || isCancelling}
              />

              <Select
                label={t("onboarding.timezoneLabel")}
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                disabled={isSubmitting || isCancelling}
                options={ONBOARDING_TIMEZONES.map((tz) => ({
                  value: tz.value,
                  label: language === "id" ? tz.labelId : tz.labelEn,
                }))}
              />

              <div className="p-3.5 rounded-xl bg-surface-subtle border border-border-subtle space-y-3">
                <label className="flex items-start gap-2.5 cursor-pointer text-sm text-text-primary">
                  <input
                    type="checkbox"
                    checked={cutsHair}
                    onChange={(e) => setCutsHair(e.target.checked)}
                    disabled={isSubmitting || isCancelling}
                    className="mt-0.5 h-4 w-4 rounded border-border-strong text-accent-primary focus:ring-accent-primary"
                  />
                  <span>{t("onboarding.cutsHairLabel")}</span>
                </label>

                {cutsHair && (
                  <Input
                    label={t("onboarding.commissionLabel")}
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={commissionPercent}
                    onChange={(e) => setCommissionPercent(e.target.value)}
                    disabled={isSubmitting || isCancelling}
                  />
                )}
              </div>

              <p className="text-xs text-text-muted leading-relaxed">
                {t("onboarding.hoursNote")}
              </p>

              <div className="space-y-2.5 pt-1">
                <label className="flex items-start gap-2.5 cursor-pointer text-xs text-text-secondary">
                  <input
                    type="checkbox"
                    checked={termsAccepted}
                    onChange={(e) => setTermsAccepted(e.target.checked)}
                    disabled={isSubmitting || isCancelling}
                    className="mt-0.5 h-4 w-4 rounded border-border-strong text-accent-primary focus:ring-accent-primary"
                  />
                  <span>{t("onboarding.termsLabel")}</span>
                </label>

                <label className="flex items-start gap-2.5 cursor-pointer text-xs text-text-secondary">
                  <input
                    type="checkbox"
                    checked={privacyAccepted}
                    onChange={(e) => setPrivacyAccepted(e.target.checked)}
                    disabled={isSubmitting || isCancelling}
                    className="mt-0.5 h-4 w-4 rounded border-border-strong text-accent-primary focus:ring-accent-primary"
                  />
                  <span>{t("onboarding.privacyLabel")}</span>
                </label>
              </div>
            </div>

            <div className="flex flex-col gap-2.5 pt-1">
              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-full"
                isLoading={isSubmitting}
                disabled={isSubmitting || isCancelling}
              >
                {isSubmitting ? t("onboarding.submitting") : t("onboarding.submitButton")}
              </Button>

              <Button
                type="button"
                variant="ghost"
                size="md"
                className="w-full"
                isLoading={isCancelling}
                disabled={isSubmitting || isCancelling}
                onClick={() => void handleCancelOnboarding()}
              >
                {isCancelling ? t("onboarding.cancelling") : t("onboarding.cancelButton")}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
