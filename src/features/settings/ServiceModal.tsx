import React, { useState } from "react"
import { servicesApi, type ServiceItem, ApiError } from "../../lib/api"
import { formatRupiah } from "../../lib/format"
import { Icon } from "../../components/ui/Icon"
import { Button } from "../../components/ui/Button"
import { Input } from "../../components/ui/Input"
import { useI18n } from "../../lib/i18n"
import { useToast } from "../../hooks/useToast"

interface ServiceModalProps {
  service?: ServiceItem | null
  onClose: () => void
  onSuccess: (message: string) => void
}

export function ServiceModal({ service, onClose, onSuccess }: ServiceModalProps) {
  const isEditing = Boolean(service)
  const { t, language } = useI18n()
  const toast = useToast()

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
      setErrorMessage(language === "id" ? "Nama layanan wajib diisi." : "Service name is required.")
      return
    }

    if (durationMin <= 0 || !Number.isInteger(durationMin)) {
      setErrorMessage(
        language === "id"
          ? "Durasi harus berupa angka menit positif."
          : "Duration must be a positive number of minutes."
      )
      return
    }

    if (price < 0 || !Number.isInteger(price)) {
      setErrorMessage(
        language === "id"
          ? "Harga tidak boleh negatif dan harus berupa nominal bulat."
          : "Price cannot be negative and must be a whole Rupiah amount."
      )
      return
    }

    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      let successMsg = ""
      if (isEditing && service) {
        await servicesApi.update(service.id, {
          name: trimmedName,
          duration_min: durationMin,
          price,
          active,
        })
        successMsg =
          language === "id"
            ? `Layanan "${trimmedName}" berhasil diperbarui`
            : `Service "${trimmedName}" updated successfully`
      } else {
        await servicesApi.create({
          name: trimmedName,
          duration_min: durationMin,
          price,
        })
        successMsg =
          language === "id"
            ? `Layanan "${trimmedName}" berhasil dibuat`
            : `Service "${trimmedName}" created successfully`
      }
      toast.success(successMsg)
      onSuccess(successMsg)
      onClose()
    } catch (err: unknown) {
      let errorMsg = ""
      if (err instanceof ApiError) {
        errorMsg = err.message || `Failed to save service (${err.code})`
      } else if (err instanceof Error) {
        errorMsg = err.message
      } else {
        errorMsg =
          language === "id"
            ? "Terjadi kesalahan saat menyimpan layanan."
            : "An unexpected error occurred while saving the service."
      }
      setErrorMessage(errorMsg)
      toast.error(errorMsg)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="modal-backdrop fixed inset-0 z-modal bg-charcoal/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto" onMouseDown={onClose}>
      <div
        className="modal bg-ivory-light border border-stone shadow-modal rounded-lg w-full max-w-[480px] p-5 sm:p-6 text-charcoal"
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="service-modal-title"
      >
        <div className="modal-head pb-3 mb-4 border-b border-stone flex items-center justify-between">
          <div>
            <span className="section-index text-[9px] font-bold tracking-widest text-copper uppercase block mb-1">
              {language === "id" ? "KATALOG LAYANAN" : "SERVICE CATALOG"}
            </span>
            <h2 id="service-modal-title" className="font-serif text-xl sm:text-2xl text-charcoal m-0">
              {isEditing
                ? language === "id"
                  ? "Ubah Layanan"
                  : "Edit Service"
                : t("settings.addService")}
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
            label={t("settings.serviceName")}
            placeholder={
              language === "id" ? "cth. Potong Rambut Signature & Styling" : "e.g. Signature Haircut & Styling"
            }
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={isSubmitting}
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              type="number"
              min="5"
              max="480"
              step="5"
              label={t("settings.serviceDuration")}
              value={durationMin}
              onChange={(e) => setDurationMin(Math.max(1, parseInt(e.target.value, 10) || 0))}
              disabled={isSubmitting}
              required
            />

            <Input
              type="number"
              min="0"
              step="5000"
              label={t("settings.servicePrice")}
              helperText={`${language === "id" ? "Format" : "Formatted"}: ${formatRupiah(price)}`}
              value={price}
              onChange={(e) => setPrice(Math.max(0, parseInt(e.target.value, 10) || 0))}
              disabled={isSubmitting}
              required
            />
          </div>

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
                  ? "Layanan aktif (terlihat dalam reservasi dan antrean walk-in)"
                  : "Service is active (visible in booking and walk-in queue)"}
              </span>
            </label>
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
                : language === "id"
                ? "Buat Layanan"
                : "Create Service"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
