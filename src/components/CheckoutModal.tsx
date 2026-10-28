import React, { useState } from "react"
import { formatRupiah } from "../lib/format"
import { Icon } from "./ui/Icon"

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
      const message = err instanceof Error ? err.message : "Failed to record payment"
      setErrorMessage(message)
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
        aria-labelledby="checkout-title"
      >
        <div className="modal-head">
          <div>
            <span className="section-index">COMPLETE &amp; PAY</span>
            <h2 id="checkout-title">Complete Service</h2>
          </div>
          <button
            className="icon-button"
            onClick={onClose}
            aria-label="Close modal"
          >
            ×
          </button>
        </div>

        {errorMessage && (
          <div className="login-error-alert" role="alert" style={{ marginBottom: "16px" }}>
            <Icon name="bell" size={16} />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="checkout-summary-box" style={{
            background: "var(--paper-2)",
            border: "1px solid var(--line)",
            padding: "16px",
            borderRadius: "4px",
            marginBottom: "20px",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
              <span style={{ fontSize: "12px", color: "var(--muted)" }}>Client:</span>
              <strong style={{ fontSize: "13px" }}>{item.customerName}</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
              <span style={{ fontSize: "12px", color: "var(--muted)" }}>Service:</span>
              <span>{item.serviceName}</span>
            </div>
            {item.staffName && (
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                <span style={{ fontSize: "12px", color: "var(--muted)" }}>Barber:</span>
                <span>{item.staffName}</span>
              </div>
            )}
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              borderTop: "1px dashed var(--line)",
              paddingTop: "10px",
              marginTop: "8px",
            }}>
              <span style={{ fontSize: "12px", fontWeight: 600 }}>Service Price:</span>
              <strong style={{ fontSize: "14px", color: "var(--ink)" }}>{formatRupiah(item.price)}</strong>
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", fontSize: "10px", fontWeight: 700, marginBottom: "8px" }}>
              Payment Method
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <button
                type="button"
                className={`filter-button ${method === "cash" ? "active" : ""}`}
                style={{
                  height: "44px",
                  fontWeight: 600,
                  borderColor: method === "cash" ? "var(--copper)" : "var(--line)",
                  background: method === "cash" ? "var(--paper-2)" : "var(--white)",
                  color: method === "cash" ? "var(--copper)" : "var(--ink)",
                }}
                onClick={() => setMethod("cash")}
              >
                Cash Drawer
              </button>
              <button
                type="button"
                className={`filter-button ${method === "transfer" ? "active" : ""}`}
                style={{
                  height: "44px",
                  fontWeight: 600,
                  borderColor: method === "transfer" ? "var(--copper)" : "var(--line)",
                  background: method === "transfer" ? "var(--paper-2)" : "var(--white)",
                  color: method === "transfer" ? "var(--copper)" : "var(--ink)",
                }}
                onClick={() => setMethod("transfer")}
              >
                Transfer / QRIS
              </button>
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: "20px" }}>
            <label style={{ display: "block", fontSize: "10px", fontWeight: 700, marginBottom: "6px" }}>
              Barber Tip (Optional)
            </label>
            <input
              type="text"
              placeholder="Rp 0"
              value={tipInput === "0" ? "" : formatRupiah(parsedTip)}
              onChange={(e) => {
                const numeric = e.target.value.replace(/\D/g, "")
                setTipInput(numeric || "0")
              }}
              style={{
                width: "100%",
                height: "40px",
                background: "var(--white)",
                border: "1px solid var(--line)",
                padding: "0 12px",
                fontSize: "13px",
              }}
            />
          </div>

          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "14px 16px",
            background: "var(--ink)",
            color: "var(--white)",
            borderRadius: "4px",
            marginBottom: "20px",
          }}>
            <div>
              <span style={{ fontSize: "10px", letterSpacing: "0.08em", opacity: 0.8 }}>TOTAL COLLECTED</span>
              <div style={{ fontSize: "18px", fontWeight: 700, color: "var(--copper-soft)" }}>
                {formatRupiah(totalAmount)}
              </div>
            </div>
            <span style={{ fontSize: "11px", opacity: 0.7 }}>
              {method === "cash" ? "Cash" : "Transfer"}
            </span>
          </div>

          <div className="modal-actions">
            <button type="button" className="filter-button" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </button>
            <button type="submit" className="primary-button" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <span className="btn-spinner" />
                  <span>Recording...</span>
                </>
              ) : (
                <span>Complete &amp; Record Payment</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
