import React, { useState } from "react"
import { useAuth } from "./AuthContext"
import { ApiError } from "../../lib/api"
import { Icon } from "../../components/ui/Icon"

export function ChangePasswordModal() {
  const { changePassword, logout } = useAuth()
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSubmitting) return

    if (!currentPassword || !newPassword) {
      setErrorMessage("Both current password and new password are required.")
      return
    }

    if (newPassword.length < 8) {
      setErrorMessage("New password must be at least 8 characters long.")
      return
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage("New passwords do not match.")
      return
    }

    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      await changePassword(currentPassword, newPassword)
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message || "Failed to update password.")
      } else {
        setErrorMessage("Network error: Failed to update password.")
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
            <span className="section-index">SECURITY REQUIREMENT</span>
            <h2 id="change-pw-title">Change Password</h2>
          </div>
        </div>

        <p style={{ fontSize: "12px", color: "var(--muted)", lineHeight: 1.5, marginBottom: "20px" }}>
          You are currently using a temporary password. You must establish a new permanent password to access shop operations.
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
              Current (Temporary) Password
              <input
                type="password"
                autoComplete="current-password"
                placeholder="Enter current password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
            </label>
          </div>

          <div className="form-group" style={{ marginBottom: "14px" }}>
            <label>
              New Password (Min. 8 characters)
              <input
                type="password"
                autoComplete="new-password"
                placeholder="Enter your new password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
            </label>
          </div>

          <div className="form-group" style={{ marginBottom: "20px" }}>
            <label>
              Confirm New Password
              <input
                type="password"
                autoComplete="new-password"
                placeholder="Re-enter your new password"
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
              Sign out instead
            </button>
            <button
              type="submit"
              className="primary-button"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Updating Password..." : "Update Password & Continue"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
