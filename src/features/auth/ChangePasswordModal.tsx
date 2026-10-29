import React, { useState } from "react"
import { useAuth } from "./AuthContext"
import { ApiError } from "../../lib/api"
import { Icon } from "../../components/ui/Icon"
import { useI18n } from "../../lib/i18n"

export function ChangePasswordModal() {
  const { changePassword, logout } = useAuth()
  const { t, language } = useI18n()
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
    <div className="modal-backdrop">
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="change-pw-title"
        style={{ width: "min(460px, 100%)" }}
      >
        <div className="modal-head">
          <div>
            <span className="section-index">
              {language === "id" ? "PERSYARATAN KEAMANAN" : "SECURITY REQUIREMENT"}
            </span>
            <h2 id="change-pw-title">{t("auth.mustChangePasswordTitle")}</h2>
          </div>
        </div>

        <p style={{ fontSize: "12px", color: "var(--muted)", lineHeight: 1.5, marginBottom: "20px" }}>
          {t("auth.mustChangePasswordSubtitle")}
        </p>

        {errorMessage && (
          <div className="login-error-alert" role="alert" style={{ marginBottom: "16px" }}>
            <Icon name="bell" size={16} />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group" style={{ marginBottom: "14px" }}>
            <label>
              {language === "id" ? "Kata Sandi Saat Ini (Sementara)" : "Current (Temporary) Password"}
              <input
                type="password"
                autoComplete="current-password"
                placeholder={language === "id" ? "Masukkan kata sandi saat ini" : "Enter current password"}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
            </label>
          </div>

          <div className="form-group" style={{ marginBottom: "14px" }}>
            <label>
              {t("auth.newPasswordLabel")} ({language === "id" ? "Min. 8 karakter" : "Min. 8 characters"})
              <input
                type="password"
                autoComplete="new-password"
                placeholder={language === "id" ? "Masukkan kata sandi baru" : "Enter your new password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
            </label>
          </div>

          <div className="form-group" style={{ marginBottom: "20px" }}>
            <label>
              {t("auth.confirmPasswordLabel")}
              <input
                type="password"
                autoComplete="new-password"
                placeholder={language === "id" ? "Ulangi kata sandi baru" : "Re-enter your new password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </label>
          </div>

          <div className="modal-actions" style={{ justifyContent: "space-between" }}>
            <button
              type="button"
              className="text-button"
              onClick={() => void logout()}
              style={{ color: "var(--danger)" }}
            >
              {language === "id" ? "Keluar saja" : "Sign out instead"}
            </button>
            <button
              type="submit"
              className="primary-button"
              disabled={isSubmitting}
            >
              {isSubmitting
                ? language === "id"
                  ? "Menyimpan kata sandi..."
                  : "Updating Password..."
                : t("auth.saveNewPasswordButton")}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
