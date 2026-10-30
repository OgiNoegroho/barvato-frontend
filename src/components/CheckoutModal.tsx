import React, { useState } from "react"
import { formatRupiah } from "../lib/format"
import { Icon } from "./ui/Icon"
import { Button } from "./ui/Button"
import { useI18n } from "../lib/i18n"
import { useToast } from "../hooks/useToast"
import { cn } from "../lib/utils"

interface CheckoutModalProps {
  item: {
    id: number
    kind: "queue" | "appointment"
    customerName: string
    serviceName: string
    price: number
    staffName?: string
  }
  onClose: () => void
  onConfirm: (method: "cash" | "transfer", tip: number) => Promise<void>
}

export function CheckoutModal({ item, onClose, onConfirm }: CheckoutModalProps) {
  const { t, language } = useI18n()
  const toast = useToast()
  const [method, setMethod] = useState<"cash" | "transfer">("cash")
  const [tipInput, setTipInput] = useState<string>("0")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const parsedTip = Math.max(0, parseInt(tipInput.replace(/\D/g, "") || "0", 10))
  const totalAmount = item.price + parsedTip

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSubmitting) return

    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      await onConfirm(method, parsedTip)
      onClose()
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : language === "id"
            ? "Gagal mencatat pembayaran"
            : "Failed to record payment"
      setErrorMessage(message)
      toast.error(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="modal-backdrop fixed inset-0 z-modal bg-charcoal/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto" onMouseDown={onClose}>
      <div
        className="modal bg-ivory-light border border-stone shadow-modal rounded-lg w-full max-w-[460px] p-5 sm:p-6 text-charcoal"
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="checkout-title"
      >
        <div className="modal-head pb-3 mb-4 border-b border-stone flex items-center justify-between">
          <div>
            <span className="section-index text-[9px] font-bold tracking-widest text-copper uppercase block mb-1">
              {language === "id" ? "SELESAIKAN & BAYAR" : "COMPLETE & PAY"}
            </span>
            <h2 id="checkout-title" className="font-serif text-xl sm:text-2xl text-charcoal m-0">
              {t("checkout.title")}
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
          <div className="login-error-alert bg-danger-soft border border-danger-line text-danger px-3.5 py-2.5 rounded-sm text-xs flex items-center gap-2 mb-4 leading-normal" role="alert">
            <Icon name="bell" size={16} />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="checkout-summary-box bg-ivory border border-stone p-4 rounded-sm space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-text">{t("checkout.billTo")}:</span>
              <strong className="font-semibold text-charcoal">{item.customerName}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-text">{t("appointments.colServices")}:</span>
              <span className="font-medium text-charcoal">{item.serviceName}</span>
            </div>
            {item.staffName && (
              <div className="flex justify-between">
                <span className="text-muted-text">{t("appointments.colBarber")}:</span>
                <span className="font-medium text-charcoal">{item.staffName}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-dashed border-stone pt-2.5 mt-2">
              <span className="font-semibold text-charcoal">
                {language === "id" ? "Tarif Layanan:" : "Service Price:"}
              </span>
              <strong className="font-serif text-sm text-charcoal">{formatRupiah(item.price)}</strong>
            </div>
          </div>

          <div>
            <label className="text-2xs font-bold uppercase tracking-wider text-charcoal block mb-1.5">
              {t("payment.method")}
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                className={cn(
                  "h-11 px-3 border rounded-sm font-semibold text-xs transition-colors cursor-pointer flex items-center justify-center",
                  method === "cash"
                    ? "border-copper bg-copper-soft text-copper font-bold"
                    : "border-stone bg-ivory-light text-charcoal hover:border-stone-muted"
                )}
                onClick={() => setMethod("cash")}
              >
                {t("payment.cash")}
              </button>
              <button
                type="button"
                className={cn(
                  "h-11 px-3 border rounded-sm font-semibold text-xs transition-colors cursor-pointer flex items-center justify-center",
                  method === "transfer"
                    ? "border-copper bg-copper-soft text-copper font-bold"
                    : "border-stone bg-ivory-light text-charcoal hover:border-stone-muted"
                )}
                onClick={() => setMethod("transfer")}
              >
                {language === "id" ? "Transfer Bank / QRIS" : "Transfer / QRIS"}
              </button>
            </div>
          </div>

          <div>
            <label className="text-2xs font-bold uppercase tracking-wider text-charcoal block mb-1.5">
              {language === "id" ? "Uang Tip Kapster (Opsional)" : "Barber Tip (Optional)"}
            </label>
            <input
              type="text"
              placeholder="Rp 0"
              value={tipInput === "0" ? "" : formatRupiah(parsedTip)}
              onChange={(e) => {
                const numeric = e.target.value.replace(/\D/g, "")
                setTipInput(numeric || "0")
              }}
              className="w-full h-10 px-3 bg-ivory border border-stone rounded-sm text-sm text-charcoal focus:border-copper focus:ring-1 focus:ring-copper outline-none"
            />
          </div>

          <div className="flex justify-between items-center p-3.5 sm:p-4 bg-charcoal text-white rounded-sm my-4">
            <div>
              <span className="text-2xs uppercase tracking-wider text-white/70 block">
                {language === "id" ? "TOTAL DITERIMA" : "TOTAL COLLECTED"}
              </span>
              <div className="font-serif text-lg sm:text-xl font-bold text-copper-soft mt-0.5">
                {formatRupiah(totalAmount)}
              </div>
            </div>
            <span className="text-xs text-white/70 capitalize font-medium">
              {method === "cash" ? t("payment.cash") : t("payment.transfer")}
            </span>
          </div>

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
              {language === "id"
                ? "Selesaikan & Catat Pembayaran"
                : "Complete & Record Payment"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
