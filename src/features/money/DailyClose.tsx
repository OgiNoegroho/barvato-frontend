import React, { useState, useEffect, useCallback } from "react"
import { registerCloseApi, type RegisterCloseResponse, ApiError } from "../../lib/api"
import { Badge } from "../../components/ui/Badge"
import { Icon } from "../../components/ui/Icon"
import { Toast } from "../../components/layout/Toast"
import { formatRupiah, formatTimeOnly } from "../../lib/format"

export function DailyClose() {
  const [currentDate, setCurrentDate] = useState(() => new Date())
  const [data, setData] = useState<RegisterCloseResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Form state
  const [openingCashInput, setOpeningCashInput] = useState<string>("200000")
  const [countedCashInput, setCountedCashInput] = useState<string>("")
  const [note, setNote] = useState<string>("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg)
    const timer = setTimeout(() => setToastMessage(null), 3500)
    return () => clearTimeout(timer)
  }, [])

  const dateStr = currentDate.toISOString().split("T")[0]

  const loadRegisterState = useCallback(async () => {
    setIsLoading(true)
    setErrorMessage(null)

    try {
      const res = await registerCloseApi.get(dateStr)
      setData(res)
      if (res.status === "open" && !countedCashInput) {
        const expected = 200000 + (res.net_cash_sales || 0)
        setCountedCashInput(String(Math.max(0, expected)))
      }
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message || `Failed to load register status (${err.code})`)
      } else if (err instanceof Error) {
        setErrorMessage(err.message)
      } else {
        setErrorMessage("Network error loading register status")
      }
    } finally {
      setIsLoading(false)
    }
  }, [dateStr])

  useEffect(() => {
    loadRegisterState()
  }, [loadRegisterState])

  const parsedOpening = Math.max(0, parseInt(openingCashInput.replace(/\D/g, "") || "0", 10))
  const parsedCounted = Math.max(0, parseInt(countedCashInput.replace(/\D/g, "") || "0", 10))
  const netCashSales = data?.net_cash_sales || 0
  const expectedDrawer = parsedOpening + netCashSales
  const difference = parsedCounted - expectedDrawer

  const handleCloseRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSubmitting) return

    if (!countedCashInput.trim()) {
      setSubmitError("Please input the counted physical drawer amount.")
      return
    }

    setIsSubmitting(true)
    setSubmitError(null)

    try {
      await registerCloseApi.close({
        business_date: dateStr,
        opening_cash: parsedOpening,
        counted_cash: parsedCounted,
        note: note.trim() || undefined,
      })
      showToast("Cash register closed and reconciled successfully")
      loadRegisterState()
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setSubmitError(err.message || `Failed to close register (${err.code})`)
      } else if (err instanceof Error) {
        setSubmitError(err.message)
      } else {
        setSubmitError("Failed to close register. Please check your network connection.")
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const dateHeading = currentDate.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  })

  const isClosed = data?.status === "closed"
  const rc = data?.register_close

  return (
    <div className="daily-close">
      <div>
        <span className="section-index">REGISTER SUMMARY</span>
        <h3>{dateHeading}</h3>

        {errorMessage && (
          <div
            className="login-error-alert"
            role="alert"
            style={{ margin: "14px 0", color: "var(--red, #cf3c3c)" }}
          >
            <Icon name="bell" size={16} />
            <span>{errorMessage}</span>
          </div>
        )}

        {isLoading ? (
          <div style={{ padding: "32px 0", color: "var(--muted)", fontSize: "11px" }}>
            Loading drawer records...
          </div>
        ) : isClosed && rc ? (
          <dl>
            <div>
              <dt>Opening cash</dt>
              <dd>{formatRupiah(rc.opening_cash)}</dd>
            </div>
            <div>
              <dt>Net cash sales</dt>
              <dd>{formatRupiah(rc.net_cash_sales)}</dd>
            </div>
            <div>
              <dt>Expected drawer</dt>
              <dd>{formatRupiah(rc.expected_cash)}</dd>
            </div>
            <div>
              <dt>Counted cash</dt>
              <dd style={{ fontWeight: 700 }}>{formatRupiah(rc.counted_cash)}</dd>
            </div>
            <div>
              <dt>Discrepancy</dt>
              <dd
                style={{
                  color: rc.difference === 0 ? "var(--forest, green)" : "var(--amber, orange)",
                  fontWeight: 700,
                }}
              >
                {rc.difference > 0 ? `+${formatRupiah(rc.difference)} (Overage)` : rc.difference < 0 ? `${formatRupiah(rc.difference)} (Shortage)` : "Rp 0 (Balanced)"}
              </dd>
            </div>
            {rc.note && (
              <div>
                <dt>Closing Note</dt>
                <dd style={{ fontStyle: "italic" }}>{rc.note}</dd>
              </div>
            )}
            <div>
              <dt>Closed At</dt>
              <dd>{formatTimeOnly(rc.closed_at)}</dd>
            </div>
          </dl>
        ) : (
          <dl>
            <div>
              <dt>Opening cash base</dt>
              <dd>{formatRupiah(parsedOpening)}</dd>
            </div>
            <div>
              <dt>Today's cash payments</dt>
              <dd>{formatRupiah(netCashSales)}</dd>
            </div>
            <div>
              <dt>Cash refunds</dt>
              <dd>Rp 0</dd>
            </div>
            <div>
              <dt>Expected in drawer</dt>
              <dd style={{ fontWeight: 700 }}>{formatRupiah(expectedDrawer)}</dd>
            </div>
          </dl>
        )}
      </div>

      <div className="close-action">
        <Badge tone={isClosed ? "success" : "warning"}>
          {isClosed ? "Register closed" : "Close pending"}
        </Badge>
        <h3>{isClosed ? "Register Reconciled" : "Reconcile the register"}</h3>
        <p>
          {isClosed
            ? `The cash register for this business date was finalized on ${dateHeading}. No further cash transactions can be added to this drawer.`
            : "Count the physical cash in the drawer and record the closing amount before ending the business day."}
        </p>

        {submitError && (
          <div
            className="login-error-alert"
            role="alert"
            style={{ marginBottom: "16px", color: "var(--red, #cf3c3c)" }}
          >
            <Icon name="bell" size={16} />
            <span>{submitError}</span>
          </div>
        )}

        {!isClosed && (
          <form onSubmit={handleCloseRegister}>
            <label>
              Opening Cash Amount (IDR)
              <input
                type="number"
                min="0"
                step="10000"
                value={openingCashInput}
                onChange={(e) => setOpeningCashInput(e.target.value)}
                required
              />
              <small style={{ color: "var(--muted)", fontSize: "9px" }}>
                Formatted: {formatRupiah(parsedOpening)}
              </small>
            </label>

            <label style={{ marginTop: "8px" }}>
              Counted Physical Cash (IDR)
              <input
                type="number"
                min="0"
                step="5000"
                placeholder="e.g. 750000"
                value={countedCashInput}
                onChange={(e) => setCountedCashInput(e.target.value)}
                required
              />
              <small style={{ color: "var(--muted)", fontSize: "9px" }}>
                Formatted: {formatRupiah(parsedCounted)} · Discrepancy:{" "}
                <strong style={{ color: difference === 0 ? "var(--forest, green)" : "var(--amber, orange)" }}>
                  {difference >= 0 ? `+${formatRupiah(difference)}` : formatRupiah(difference)}
                </strong>
              </small>
            </label>

            <label style={{ marginTop: "8px" }}>
              Closing note
              <textarea
                placeholder="Optional closing notes or discrepancy explanations"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
              />
            </label>

            <button
              type="submit"
              className="primary-button"
              disabled={isSubmitting}
              style={{ marginTop: "12px", width: "100%" }}
            >
              {isSubmitting ? "Finalizing Register..." : "Close business day"}
            </button>
          </form>
        )}
      </div>

      {toastMessage && <Toast message={toastMessage} />}
    </div>
  )
}
