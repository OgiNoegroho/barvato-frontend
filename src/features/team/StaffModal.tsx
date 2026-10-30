import React, { useState } from "react"
import {
  staffApi,
  type StaffItem,
  type CreateStaffResponse,
  ApiError,
} from "../../lib/api"
import { Icon } from "../../components/ui/Icon"
import { Button } from "../../components/ui/Button"
import { Input } from "../../components/ui/Input"
import { useI18n } from "../../lib/i18n"

interface StaffModalProps {
  staff?: StaffItem | null
  onClose: () => void
  onSuccess: (message: string) => void
}

export function StaffModal({ staff, onClose, onSuccess }: StaffModalProps) {
  const isEditing = Boolean(staff)
  const { t, language } = useI18n()

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

    if (!isEditing && (commissionPct < 0 || commissionPct > 100)) {
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
      <div className="modal-backdrop fixed inset-0 z-modal bg-charcoal/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto" onMouseDown={onClose}>
        <div
          className="modal bg-ivory-light border border-stone shadow-modal rounded-lg w-full max-w-[480px] p-5 sm:p-6 text-charcoal"
          onMouseDown={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="staff-success-title"
        >
          <div className="modal-head pb-3 mb-4 border-b border-stone flex items-center justify-between">
            <div>
              <span className="section-index text-[9px] font-bold tracking-widest text-copper uppercase block mb-1">
                {t("team.provisioningTitle")}
              </span>
              <h2 id="staff-success-title" className="font-serif text-xl sm:text-2xl text-charcoal m-0">
                {t("team.accountCreated")}
              </h2>
            </div>
            <button
              type="button"
              className="icon-button p-1 text-muted-text hover:text-charcoal text-lg leading-none rounded hover:bg-stone/20 cursor-pointer bg-transparent border-0"
              onClick={onClose}
              aria-label={t("common.close")}
            >
              ×
            </button>
          </div>

          <div className="bg-ivory border border-stone p-4 rounded-sm mb-4">
            <p className="text-xs text-charcoal leading-relaxed m-0 mb-3">
              {t("team.credentialsNotice", { name: createdResult.staff.name })}
            </p>

            <div className="bg-ivory-light border border-stone p-3 rounded-sm text-xs space-y-2">
              <div className="flex">
                <span className="text-muted-text w-28 shrink-0">{t("team.loginId")}</span>
                <strong className="text-charcoal font-semibold">{email.trim() || phone.trim()}</strong>
              </div>
              <div className="flex">
                <span className="text-muted-text w-28 shrink-0">{t("team.tempPassword")}</span>
                <code className="text-sm font-mono text-amber font-bold">
                  {createdResult.temporary_password}
                </code>
              </div>
              <div className="flex">
                <span className="text-muted-text w-28 shrink-0">{t("team.assignedRole")}</span>
                <span className="capitalize font-semibold text-charcoal">{t(`roles.${role}` as any)}</span>
              </div>
            </div>

            <p className="text-[10px] text-muted-text mt-3 mb-0 leading-normal">
              {t("team.mustChangeNotice")}
            </p>
          </div>

          <div className="modal-actions flex justify-end pt-3 border-t border-stone">
            <Button type="button" variant="primary" onClick={onClose}>
              {t("common.close")}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="modal-backdrop fixed inset-0 z-modal bg-charcoal/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto" onMouseDown={onClose}>
      <div
        className="modal bg-ivory-light border border-stone shadow-modal rounded-lg w-full max-w-[500px] p-5 sm:p-6 text-charcoal"
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="staff-modal-title"
      >
        <div className="modal-head pb-3 mb-4 border-b border-stone flex items-center justify-between">
          <div>
            <span className="section-index text-[9px] font-bold tracking-widest text-copper uppercase block mb-1">
              {language === "id" ? "MANAJEMEN STAF" : "STAFF MANAGEMENT"}
            </span>
            <h2 id="staff-modal-title" className="font-serif text-xl sm:text-2xl text-charcoal m-0">
              {isEditing
                ? language === "id"
                  ? "Ubah Data Staf"
                  : "Edit Staff Member"
                : t("team.addStaff")}
            </h2>
          </div>
          <button
            type="button"
            className="icon-button p-1 text-muted-text hover:text-charcoal text-lg leading-none rounded hover:bg-stone/20 cursor-pointer bg-transparent border-0"
            onClick={onClose}
            aria-label={t("common.close")}
          >
            ×
          </button>
        </div>

        {errorMessage && (
          <div
            className="login-error-alert bg-danger-soft border border-danger-line text-danger px-3.5 py-2.5 rounded-sm text-xs flex items-center gap-2 mb-4 leading-normal"
            role="alert"
          >
            <Icon name="bell" size={16} />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            autoFocus
            label={t("team.modalName")}
            placeholder={language === "id" ? "cth. Budi Pratama" : "e.g. Julian Ross"}
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={isSubmitting}
            required
          />

          {!isEditing ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label={language === "id" ? "Kontak (Telepon/Email)" : "Contact (Phone or Email)"}
                placeholder="081299990002"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                disabled={isSubmitting}
              />

              <Input
                type="number"
                min="0"
                max="100"
                step="0.5"
                label={`${t("team.commissionRate")} (%)`}
                helperText={`Basis points: ${Math.round(commissionPct * 100)} bps`}
                value={commissionPct}
                onChange={(e) => setCommissionPct(parseFloat(e.target.value) || 0)}
                disabled={isSubmitting}
                required
              />
            </div>
          ) : (
            <Input
              label={language === "id" ? "Kontak (Telepon/Email)" : "Contact (Phone or Email)"}
              placeholder="081299990002"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              disabled={isSubmitting}
            />
          )}

          {isEditing && (
            <label className="flex items-center gap-2.5 pt-1 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
                className="w-4 h-4 rounded text-copper focus:ring-copper cursor-pointer"
                disabled={isSubmitting}
              />
              <span className="text-xs font-medium text-charcoal">
                {language === "id"
                  ? "Staf aktif (dapat menerima janji temu dan penugasan antrean)"
                  : "Staff member is active (can take appointments and queue assignments)"}
              </span>
            </label>
          )}

          {!isEditing && (
            <div className="border-t border-stone pt-3.5 mt-2">
              <label className="flex items-center gap-2.5 mb-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={createUser}
                  onChange={(e) => setCreateUser(e.target.checked)}
                  className="w-4 h-4 rounded text-copper focus:ring-copper cursor-pointer"
                  disabled={isSubmitting}
                />
                <span className="text-xs font-semibold text-charcoal">
                  {language === "id"
                    ? "Buat akun login untuk anggota staf ini"
                    : "Create login credentials for this staff member"}
                </span>
              </label>

              {createUser && (
                <div className="space-y-3 bg-ivory p-3.5 border border-stone rounded-sm">
                  <div>
                    <label className="text-2xs font-bold uppercase tracking-wider text-charcoal block mb-1">
                      {t("team.modalRole")}
                    </label>
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value as "barber" | "manager")}
                      className="h-10 w-full appearance-none rounded-sm border border-stone bg-ivory-light px-3 text-sm text-charcoal focus:border-copper focus:ring-1 focus:ring-copper outline-none"
                      disabled={isSubmitting}
                    >
                      <option value="barber">{t("roles.barber")}</option>
                      <option value="manager">{t("roles.manager")}</option>
                    </select>
                  </div>

                  <Input
                    type="email"
                    label={t("team.modalEmail")}
                    placeholder="barber@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isSubmitting}
                  />

                  <Input
                    label={t("team.modalPhone")}
                    placeholder="081299990002"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>
              )}
            </div>
          )}

          <div className="modal-actions flex items-center justify-end gap-2.5 pt-4 mt-5 border-t border-stone">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              {t("common.cancel")}
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={isSubmitting}
            >
              {isSubmitting
                ? t("common.saving")
                : isEditing
                ? t("common.save")
                : t("team.addStaff")}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
