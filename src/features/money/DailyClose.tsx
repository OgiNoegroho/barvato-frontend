import React, { useState, useEffect, useCallback } from "react"
import { registerCloseApi, type RegisterCloseResponse, ApiError } from "../../lib/api"
import { Badge } from "../../components/ui/Badge"
import { Icon } from "../../components/ui/Icon"
import { Toast } from "../../components/layout/Toast"
import { formatRupiah, formatTimeOnly } from "../../lib/format"
import { useI18n } from "../../lib/i18n"

export function DailyClose() {
  const { t, language } = useI18n()
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
        setErrorMessage(language === "id" ? "Kesalahan jaringan saat memuat status kasir" : "Network error loading register status")
      }
    } finally {
      setIsLoading(false)
    }
  }, [dateStr, countedCashInput, language])

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
      setSubmitError(
        language === "id"
          ? "Harap masukkan nominal uang fisik yang telah dihitung di laci."
          : "Please input the counted physical drawer amount."
      )
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
      showToast(t("dailyClose.closeSuccess"))
      loadRegisterState()
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setSubmitError(err.message || `Failed to close register (${err.code})`)
      } else if (err instanceof Error) {
        setSubmitError(err.message)
      } else {
        setSubmitError(
          language === "id"
            ? "Gagal menutup kasir. Periksa koneksi jaringan Anda."
            : "Failed to close register. Please check your network connection."
        )
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const dateHeading = currentDate.toLocaleDateString(language === "id" ? "id-ID" : "en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  })

  const isClosed = data?.status === "closed"
  const rc = data?.register_close

  return (
    <div className="daily-close">
      <div>
        <span className="section-index">{t("dailyClose.summaryTitle")}</span>
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
            {language === "id" ? "Memuat catatan laci kasir..." : "Loading drawer records..."}
          </div>
        ) : isClosed && rc ? (
          <dl>
            <div>
              <dt>{t("dailyClose.openingCash")}</dt>
              <dd>{formatRupiah(rc.opening_cash)}</dd>
            </div>
            <div>
              <dt>{t("dailyClose.netCashSales")}</dt>
              <dd>{formatRupiah(rc.net_cash_sales)}</dd>
            </div>
            <div>
              <dt>{t("dailyClose.expectedDrawer")}</dt>
              <dd>{formatRupiah(rc.expected_cash)}</dd>
            </div>
            <div>
              <dt>{t("dailyClose.countedCash")}</dt>
              <dd style={{ fontWeight: 700 }}>{formatRupiah(rc.counted_cash)}</dd>
            </div>
            <div>
              <dt>{t("dailyClose.discrepancy")}</dt>
              <dd
                style={{
                  color: rc.difference === 0 ? "var(--forest, green)" : "var(--amber, orange)",
                  fontWeight: 700,
                }}
              >
                {rc.difference > 0
                  ? `+${formatRupiah(rc.difference)} (${t("dailyClose.overage")})`
                  : rc.difference < 0
                  ? `${formatRupiah(rc.difference)} (${t("dailyClose.shortage")})`
                  : `Rp 0 (${t("dailyClose.balanced")})`}
              </dd>
            </div>
            {rc.note && (
              <div>
                <dt>{t("dailyClose.closingNote")}</dt>
                <dd style={{ fontStyle: "italic" }}>{rc.note}</dd>
              </div>
            )}
            <div>
              <dt>{t("dailyClose.closedAt")}</dt>
              <dd>{formatTimeOnly(rc.closed_at)}</dd>
            </div>
          </dl>
        ) : (
          <dl>
            <div>
              <dt>{t("dailyClose.openingCashBase")}</dt>
              <dd>{formatRupiah(parsedOpening)}</dd>
            </div>
            <div>
              <dt>{t("dailyClose.todayCashPayments")}</dt>
              <dd>{formatRupiah(netCashSales)}</dd>
            </div>
            <div>
              <dt>{t("dailyClose.cashRefunds")}</dt>
              <dd>Rp 0</dd>
            </div>
            <div>
              <dt>{t("dailyClose.expectedInDrawer")}</dt>
              <dd style={{ fontWeight: 700 }}>{formatRupiah(expectedDrawer)}</dd>
            </div>
          </dl>
        )}
      </div>

      <div className="close-action">
        <Badge tone={isClosed ? "success" : "warning"}>
          {isClosed ? t("dailyClose.registerClosed") : t("dailyClose.closePending")}
        </Badge>
        <h3>{isClosed ? t("dailyClose.reconciledTitle") : t("dailyClose.reconcileTitle")}</h3>
        <p>
          {isClosed
            ? t("dailyClose.reconciledNotice", { date: dateHeading })
            : t("dailyClose.reconcileInstructions")}
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
              {t("dailyClose.openingCashInput")}
              <input
                type="number"
                min="0"
                step="10000"
                value={openingCashInput}
                onChange={(e) => setOpeningCashInput(e.target.value)}
                required
              />
              <small style={{ color: "var(--muted)", fontSize: "9px" }}>
                {language === "id" ? "Format" : "Formatted"}: {formatRupiah(parsedOpening)}
              </small>
            </label>

            <label style={{ marginTop: "8px" }}>
              {t("dailyClose.countedCashInput")}
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
                {language === "id" ? "Format" : "Formatted"}: {formatRupiah(parsedCounted)} · {t("dailyClose.discrepancy")}:{" "}
                <strong style={{ color: difference === 0 ? "var(--forest, green)" : "var(--amber, orange)" }}>
                  {difference >= 0 ? `+${formatRupiah(difference)}` : formatRupiah(difference)}
                </strong>
              </small>
            </label>

            <label style={{ marginTop: "8px" }}>
              {t("dailyClose.noteInput")}
              <textarea
                placeholder={t("dailyClose.notePlaceholder")}
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
              {isSubmitting ? t("dailyClose.finalizing") : t("dailyClose.closeButton")}
            </button>
          </form>
        )}
      </div>

      {toastMessage && <Toast message={toastMessage} />}
    </div>
  )
}
