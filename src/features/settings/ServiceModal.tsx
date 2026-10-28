import React, { useState } from "react"
import { servicesApi, type ServiceItem, ApiError } from "../../lib/api"
import { formatRupiah } from "../../lib/format"
import { Icon } from "../../components/ui/Icon"

interface ServiceModalProps {
  service?: ServiceItem | null
  onClose: () => void
  onSuccess: (message: string) => void
}

export function ServiceModal({ service, onClose, onSuccess }: ServiceModalProps) {
  const isEditing = Boolean(service)

  const [name, setName] = useState(service?.name ?? "")
  const [durationMin, setDurationMin] = useState<number>(service?.duration_min ?? 30)
  const [price, setPrice] = useState<number>(service?.price ?? 75000)
  const [active, setActive] = useState<boolean>(service?.active ?? true)

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSubmitting) return

    const trimmedName = name.trim()
    if (!trimmedName) {
      setErrorMessage("Service name is required.")
      return
    }

    if (durationMin <= 0 || !Number.isInteger(durationMin)) {
      setErrorMessage("Duration must be a positive number of minutes.")
      return
    }

    if (price < 0 || !Number.isInteger(price)) {
      setErrorMessage("Price cannot be negative and must be a whole Rupiah amount.")
      return
    }

    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      if (isEditing && service) {
        await servicesApi.update(service.id, {
          name: trimmedName,
          duration_min: durationMin,
          price,
          active,
        })
        onSuccess(`Service "${trimmedName}" updated successfully`)
      } else {
        await servicesApi.create({
          name: trimmedName,
          duration_min: durationMin,
          price,
        })
        onSuccess(`Service "${trimmedName}" created successfully`)
      }
      onClose()
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message || `Failed to save service (${err.code})`)
      } else if (err instanceof Error) {
        setErrorMessage(err.message)
      } else {
        setErrorMessage("An unexpected error occurred while saving the service.")
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className="modal"
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="service-modal-title"
      >
        <div className="modal-head">
          <div>
            <span className="section-index">SERVICE CATALOG</span>
            <h2 id="service-modal-title">{isEditing ? "Edit Service" : "Add New Service"}</h2>
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
              Service Name
              <input
                autoFocus
                placeholder="e.g. Signature Haircut & Styling"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </label>

            <label>
              Duration (minutes)
              <input
                type="number"
                min="5"
                max="480"
                step="5"
                value={durationMin}
                onChange={(e) => setDurationMin(Math.max(1, parseInt(e.target.value, 10) || 0))}
                required
              />
            </label>

            <label>
              Price (IDR)
              <input
                type="number"
                min="0"
                step="5000"
                value={price}
                onChange={(e) => setPrice(Math.max(0, parseInt(e.target.value, 10) || 0))}
                required
              />
              <small style={{ color: "var(--muted)", fontSize: "10px", marginTop: "4px", display: "block" }}>
                Formatted: <strong>{formatRupiah(price)}</strong>
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
                  Service is active (visible in booking and walk-in queue)
                </span>
              </label>
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
              {isSubmitting ? "Saving..." : isEditing ? "Save Changes" : "Create Service"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
