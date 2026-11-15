import React, { useEffect, useRef, useState } from "react"
import { Modal } from "../../components/ui/Modal"
import { Input } from "../../components/ui/Input"
import { Button } from "../../components/ui/Button"
import { authApi } from "../../lib/api"
import { useAuth } from "../auth/AuthContext"
import { useI18n } from "../../lib/i18n"
import {
  isUnauthenticatedSessionError,
  mapAccountSecurityError,
} from "../../lib/accountSecurity"

export interface ReauthModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (expiresInSeconds: number) => void
}

export function ReauthModal({ isOpen, onClose, onSuccess }: ReauthModalProps) {
  const { refreshSession } = useAuth()
  const { t, language } = useI18n()
  const [password, setPassword] = useState("")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const sessionExpiredRef = useRef(false)

  useEffect(() => {
    setPassword("")
    setErrorMessage(null)
    setIsSubmitting(false)
    sessionExpiredRef.current = false
  }, [isOpen])

  const handleClose = () => {
    if (isSubmitting) return
    setPassword("")
    setErrorMessage(null)
    onClose()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSubmitting) return

    if (!password) {
      setErrorMessage(
        language === "id" ? "Kata sandi wajib diisi." : "Password is required."
      )
      return
    }

    setErrorMessage(null)
    setIsSubmitting(true)
    try {
      const res = await authApi.reauthenticate(password)
      setPassword("")
      onSuccess(res.expires_in_seconds)
    } catch (err) {
      if (isUnauthenticatedSessionError(err)) {
        if (!sessionExpiredRef.current) {
          sessionExpiredRef.current = true
          setPassword("")
          onClose()
          void refreshSession()
        }
        return
      }
      const mapped = mapAccountSecurityError(err, language)
      setErrorMessage(mapped.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      size="sm"
      closeOnBackdrop={!isSubmitting}
      closeOnEscape={!isSubmitting}
    >
      <form onSubmit={handleSubmit} className="p-6 space-y-5" noValidate>
        <div className="space-y-1.5">
          <h2 className="text-lg font-bold text-charcoal m-0">
            {t("security.reauthModalTitle")}
          </h2>
          <p className="text-xs text-muted-text leading-relaxed m-0">
            {t("security.reauthModalSubtitle")}
          </p>
        </div>

        {errorMessage && (
          <div
            role="alert"
            className="p-3 rounded-sm bg-danger-soft border border-danger-line text-danger text-xs"
          >
            {errorMessage}
          </div>
        )}

        <Input
          label={t("security.reauthPasswordLabel")}
          placeholder={t("security.reauthPasswordPlaceholder")}
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={isSubmitting}
          required
        />

        <div className="flex justify-end gap-2.5 pt-1">
          <Button
            type="button"
            variant="secondary"
            onClick={handleClose}
            disabled={isSubmitting}
          >
            {t("common.cancel")}
          </Button>
          <Button
            type="submit"
            variant="primary"
            isLoading={isSubmitting}
            disabled={isSubmitting}
          >
            {isSubmitting ? t("security.reauthVerifying") : t("security.reauthConfirmButton")}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
