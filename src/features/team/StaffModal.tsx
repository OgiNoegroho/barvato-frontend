import React, { useState } from "react"
import {
  staffApi,
  type StaffItem,
  type CreateStaffResponse,
  ApiError,
} from "../../lib/api"
import { Icon } from "../../components/ui/Icon"

interface StaffModalProps {
  staff?: StaffItem | null
  onClose: () => void
  onSuccess: (message: string) => void
}

export function StaffModal({ staff, onClose, onSuccess }: StaffModalProps) {
  const isEditing = Boolean(staff)

  const [name, setName] = useState(staff?.name ?? "")
  const [contact, setContact] = useState(staff?.contact ?? "")
  const [commissionPct, setCommissionPct] = useState<number>(
    staff?.commission_bps ? staff.commission_bps / 100 : 50
  )
  const [active, setActive] = useState<boolean>(staff?.active ?? true)

  // Account creation fields (for new staff)
  const [createUser, setCreateUser] = useState(false)
  const [role, setRole] = useState<"barber" | "manager">("barber")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [createdResult, setCreatedResult] = useState<CreateStaffResponse | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSubmitting) return

    const trimmedName = name.trim()
    if (!trimmedName) {
      setErrorMessage("Staff member name is required.")
      return
    }

    if (commissionPct < 0 || commissionPct > 100) {
      setErrorMessage("Commission rate must be between 0% and 100%.")
      return
    }

    const commissionBps = Math.round(commissionPct * 100)

    if (!isEditing && createUser) {
      const trimmedEmail = email.trim()
      const trimmedPhone = phone.trim()
      if (!trimmedEmail && !trimmedPhone) {
        setErrorMessage("Please provide an email or phone number to create a login account.")
        return
      }
    }

    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      if (isEditing && staff) {
        await staffApi.update(staff.id, {
          name: trimmedName,
          contact: contact.trim() || undefined,
          commission_bps: commissionBps,
          active,
        })
        onSuccess(`Staff member "${trimmedName}" updated successfully`)
        onClose()
      } else {
        const res = await staffApi.create({
          name: trimmedName,
          commission_bps: commissionBps,
          contact: contact.trim() || (phone.trim() || email.trim()) || undefined,
          role: createUser ? role : "barber",
          create_user: createUser,
          email: createUser && email.trim() ? email.trim() : undefined,
          phone: createUser && phone.trim() ? phone.trim() : undefined,
        })

        if (res.temporary_password) {
          // Keep modal open to show credentials to the owner
          setCreatedResult(res)
          onSuccess(`Staff member "${trimmedName}" created with login access`)
        } else {
          onSuccess(`Staff member "${trimmedName}" added successfully`)
          onClose()
        }
      }
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message || `Failed to save staff member (${err.code})`)
      } else if (err instanceof Error) {
        setErrorMessage(err.message)
      } else {
        setErrorMessage("An unexpected error occurred while saving the staff member.")
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  // If a temporary password was generated, display credentials card
  if (createdResult && createdResult.temporary_password) {
    return (
      <div className="modal-backdrop" onMouseDown={onClose}>
        <div
          className="modal"
          onMouseDown={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="staff-success-title"
        >
          <div className="modal-head">
            <div>
              <span className="section-index">STAFF PROVISIONING</span>
              <h2 id="staff-success-title">Account Created</h2>
            </div>
            <button className="icon-button" onClick={onClose} aria-label="Close modal">
              ×
            </button>
          </div>

          <div
            style={{
              background: "var(--paper)",
              border: "1px solid var(--line)",
              padding: "20px",
              marginBottom: "20px",
            }}
          >
            <p style={{ margin: "0 0 14px", fontSize: "12px", color: "var(--ink)", lineHeight: 1.5 }}>
              A new staff account has been provisioned for <strong>{createdResult.staff.name}</strong>.
              Please securely share these temporary credentials with them:
            </p>

            <div style={{ background: "var(--white)", border: "1px solid var(--line)", padding: "12px", fontSize: "12px" }}>
              <div style={{ marginBottom: "6px" }}>
                <span style={{ color: "var(--muted)", display: "inline-block", width: "120px" }}>Login ID:</span>
                <strong>{email.trim() || phone.trim()}</strong>
              </div>
              <div style={{ marginBottom: "6px" }}>
                <span style={{ color: "var(--muted)", display: "inline-block", width: "120px" }}>Temp Password:</span>
                <code style={{ fontSize: "13px", color: "var(--amber)", fontWeight: 700 }}>
                  {createdResult.temporary_password}
                </code>
              </div>
              <div>
                <span style={{ color: "var(--muted)", display: "inline-block", width: "120px" }}>Assigned Role:</span>
                <span style={{ textTransform: "capitalize", fontWeight: 600 }}>{role}</span>
              </div>
            </div>

            <p style={{ margin: "14px 0 0", fontSize: "10px", color: "var(--muted)" }}>
              The staff member will be required to change their temporary password upon their first login.
            </p>
          </div>

          <div className="modal-actions">
            <button type="button" className="primary-button" onClick={onClose}>
              Done
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className="modal"
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="staff-modal-title"
      >
        <div className="modal-head">
          <div>
            <span className="section-index">STAFF MANAGEMENT</span>
            <h2 id="staff-modal-title">{isEditing ? "Edit Staff Member" : "Add Staff Member"}</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close modal">
            ×
          </button>
        </div>

        {errorMessage && (
          <div
            className="login-error-alert"
            role="alert"
            style={{ marginBottom: "16px", color: "var(--red, #cf3c3c)" }}
          >
            <Icon name="bell" size={16} />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <label className="full">
              Full Name
              <input
                autoFocus
                placeholder="e.g. Julian Ross"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </label>

            <label>
              Contact (Phone or Email)
              <input
                placeholder="e.g. 081299990002"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
              />
            </label>

            <label>
              Commission Rate (%)
              <input
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={commissionPct}
                onChange={(e) => setCommissionPct(parseFloat(e.target.value) || 0)}
                required
              />
              <small style={{ color: "var(--muted)", fontSize: "10px", marginTop: "4px", display: "block" }}>
                Basis points: <strong>{Math.round(commissionPct * 100)} bps</strong>
              </small>
            </label>

            {isEditing && (
              <label className="full" style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "8px", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                  style={{ width: "16px", height: "16px", cursor: "pointer" }}
                />
                <span style={{ fontSize: "11px", fontWeight: 600 }}>
                  Staff member is active (can take appointments and queue assignments)
                </span>
              </label>
            )}

            {!isEditing && (
              <div className="full" style={{ borderTop: "1px solid var(--line)", paddingTop: "14px", marginTop: "6px" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", marginBottom: "12px" }}>
                  <input
                    type="checkbox"
                    checked={createUser}
                    onChange={(e) => setCreateUser(e.target.checked)}
                    style={{ width: "16px", height: "16px", cursor: "pointer" }}
                  />
                  <span style={{ fontSize: "11px", fontWeight: 600 }}>
                    Create login credentials for this staff member
                  </span>
                </label>

                {createUser && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", background: "var(--white)", padding: "12px", border: "1px solid var(--line)" }}>
                    <label>
                      Account Role
                      <select value={role} onChange={(e) => setRole(e.target.value as "barber" | "manager")}>
                        <option value="barber">Barber</option>
                        <option value="manager">Manager</option>
                      </select>
                    </label>

                    <label>
                      Login Email
                      <input
                        type="email"
                        placeholder="barber@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </label>

                    <label className="full">
                      Login Phone (ID format)
                      <input
                        placeholder="081299990002"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                      />
                    </label>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="modal-actions" style={{ marginTop: "24px" }}>
            <button
              type="button"
              className="filter-button"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="primary-button"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Saving..." : isEditing ? "Save Changes" : "Add Staff Member"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
