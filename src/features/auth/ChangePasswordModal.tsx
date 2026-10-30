import React, { useState } from "react"
import { useAuth } from "./AuthContext"
import { ApiError } from "../../lib/api"
import { Icon } from "../../components/ui/Icon"
import { Button } from "../../components/ui/Button"
import { Input } from "../../components/ui/Input"
import { useI18n } from "../../lib/i18n"
import { useToast } from "../../hooks/useToast"

export function ChangePasswordModal() {
  const { changePassword, logout } = useAuth()
  const { t, language } = useI18n()
  const toast = useToast()
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSubmitting) return

    if (!currentPassword || !newPassword) {
      setErrorMessage(
        language === "id"
          ? "Kata sandi saat ini dan kata sandi baru wajib diisi."
          : "Both current password and new password are required."
      )
      return
    }

    if (newPassword.length < 8) {
      setErrorMessage(
        language === "id"
          ? "Kata sandi baru minimal 8 karakter."
          : "New password must be at least 8 characters long."
      )
      return
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage(t("auth.passwordMismatch"))
      return
    }

    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      await changePassword(currentPassword, newPassword)
      toast.success(
        language === "id" ? "Kata sandi berhasil diperbarui" : "Password updated successfully"
      )
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setErrorMessage(
          err.message ||
            (language === "id" ? "Gagal memperbarui kata sandi." : "Failed to update password.")
        )
      } else {
        setErrorMessage(
          language === "id"
            ? "Kesalahan jaringan: Gagal memperbarui kata sandi."
            : "Network error: Failed to update password."
        )
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="modal-backdrop fixed inset-0 z-modal bg-charcoal/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div
        className="modal bg-ivory-light border border-stone shadow-modal rounded-lg w-full max-w-[460px] p-5 sm:p-6 text-charcoal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="change-pw-title"
      >
        <div className="modal-head pb-3 mb-3 border-b border-stone">
          <div>
            <span className="section-index text-[9px] font-bold tracking-widest text-copper uppercase block mb-1">
              {language === "id" ? "PERSYARATAN KEAMANAN" : "SECURITY REQUIREMENT"}
            </span>
            <h2 id="change-pw-title" className="font-serif text-xl sm:text-2xl text-charcoal m-0">
              {t("auth.mustChangePasswordTitle")}
            </h2>
          </div>
        </div>

        <p className="text-xs text-muted-text leading-relaxed mb-5">
          {t("auth.mustChangePasswordSubtitle")}
        </p>

        {errorMessage && (
          <div className="login-error-alert bg-danger-soft border border-danger-line text-danger px-3.5 py-2.5 rounded-sm text-xs flex items-center gap-2 mb-4 leading-normal" role="alert">
            <Icon name="bell" size={16} />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            type="password"
            autoComplete="current-password"
            label={language === "id" ? "Kata Sandi Saat Ini (Sementara)" : "Current (Temporary) Password"}
            placeholder={language === "id" ? "Masukkan kata sandi saat ini" : "Enter current password"}
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            disabled={isSubmitting}
            required
          />

          <Input
            type="password"
            autoComplete="new-password"
            label={`${t("auth.newPasswordLabel")} (${language === "id" ? "Min. 8 karakter" : "Min. 8 characters"})`}
            placeholder={language === "id" ? "Masukkan kata sandi baru" : "Enter your new password"}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            disabled={isSubmitting}
            required
          />

          <Input
            type="password"
            autoComplete="new-password"
            label={t("auth.confirmPasswordLabel")}
            placeholder={language === "id" ? "Ulangi kata sandi baru" : "Re-enter your new password"}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={isSubmitting}
            required
          />

          <div className="modal-actions flex items-center justify-between pt-4 mt-5 border-t border-stone">
            <Button
              type="button"
              variant="ghost"
              onClick={() => void logout()}
              className="text-danger hover:text-danger hover:bg-danger-soft"
              disabled={isSubmitting}
            >
              {language === "id" ? "Keluar saja" : "Sign out instead"}
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={isSubmitting}
            >
              {isSubmitting
                ? language === "id"
                  ? "Menyimpan kata sandi..."
                  : "Updating Password..."
                : t("auth.saveNewPasswordButton")}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
