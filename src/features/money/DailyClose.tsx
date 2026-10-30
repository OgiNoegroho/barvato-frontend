import React, { useState, useEffect, useCallback } from "react"
import { registerCloseApi, type RegisterCloseResponse, ApiError } from "../../lib/api"
import { Badge } from "../../components/ui/Badge"
import { Button } from "../../components/ui/Button"
import { Icon } from "../../components/ui/Icon"
import { formatRupiah, formatTimeOnly } from "../../lib/format"
import { useI18n } from "../../lib/i18n"
import { useToast } from "../../hooks/useToast"

export function DailyClose() {
  const { t, language } = useI18n()
  const [currentDate] = useState(() => new Date())
  const [data, setData] = useState<RegisterCloseResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Form state
  const [openingCashInput, setOpeningCashInput] = useState<string>("200000")
  const [countedCashInput, setCountedCashInput] = useState<string>("")
  const [note, setNote] = useState<string>("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const toast = useToast()

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
      toast.success(t("dailyClose.closeSuccess"))
      loadRegisterState()
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        const msg = err.message || `Failed to close register (${err.code})`
        setSubmitError(msg)
        toast.error(msg)
      } else if (err instanceof Error) {
        setSubmitError(err.message)
        toast.error(err.message)
      } else {
        const msg =
          language === "id"
            ? "Gagal menutup kasir. Periksa koneksi jaringan Anda."
            : "Failed to close register. Please check your network connection."
        setSubmitError(msg)
        toast.error(msg)
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
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-3">
      <div>
        <span className="text-[10px] uppercase tracking-wider text-charcoal-muted font-bold block mb-1">
          {t("dailyClose.summaryTitle")}
        </span>
        <h3 className="font-serif text-2xl text-charcoal-ink my-2 mb-3">{dateHeading}</h3>

        {errorMessage && (
          <div
            className="my-3 p-3 bg-red-50/80 border border-red-200 text-danger text-xs rounded-sm flex items-center gap-2"
            role="alert"
          >
            <Icon name="bell" size={16} />
            <span>{errorMessage}</span>
          </div>
        )}

        {isLoading ? (
          <div className="py-8 text-charcoal-muted text-xs">
            {language === "id" ? "Memuat catatan laci kasir..." : "Loading drawer records..."}
          </div>
        ) : isClosed && rc ? (
          <dl className="m-0 border-t border-charcoal-ink divide-y divide-stone-line">
            <div className="flex justify-between py-3 text-xs">
              <dt className="text-charcoal-muted">{t("dailyClose.openingCash")}</dt>
              <dd className="font-medium text-charcoal-ink">{formatRupiah(rc.opening_cash)}</dd>
            </div>
            <div className="flex justify-between py-3 text-xs">
              <dt className="text-charcoal-muted">{t("dailyClose.netCashSales")}</dt>
              <dd className="font-medium text-charcoal-ink">{formatRupiah(rc.net_cash_sales)}</dd>
            </div>
            <div className="flex justify-between py-3 text-xs">
              <dt className="text-charcoal-muted">{t("dailyClose.expectedDrawer")}</dt>
              <dd className="font-medium text-charcoal-ink">{formatRupiah(rc.expected_cash)}</dd>
            </div>
            <div className="flex justify-between py-3 text-xs font-bold">
              <dt className="text-charcoal-muted">{t("dailyClose.countedCash")}</dt>
              <dd className="text-charcoal-ink">{formatRupiah(rc.counted_cash)}</dd>
            </div>
            <div className="flex justify-between py-3 text-xs font-bold">
              <dt className="text-charcoal-muted">{t("dailyClose.discrepancy")}</dt>
              <dd className={rc.difference === 0 ? "text-forest" : "text-amber"}>
                {rc.difference > 0
                  ? `+${formatRupiah(rc.difference)} (${t("dailyClose.overage")})`
                  : rc.difference < 0
                  ? `${formatRupiah(rc.difference)} (${t("dailyClose.shortage")})`
                  : `Rp 0 (${t("dailyClose.balanced")})`}
              </dd>
            </div>
            {rc.note && (
              <div className="flex justify-between py-3 text-xs">
                <dt className="text-charcoal-muted">{t("dailyClose.closingNote")}</dt>
                <dd className="italic text-charcoal-ink">{rc.note}</dd>
              </div>
            )}
            <div className="flex justify-between py-3 text-xs">
              <dt className="text-charcoal-muted">{t("dailyClose.closedAt")}</dt>
              <dd className="font-medium text-charcoal-ink">{formatTimeOnly(rc.closed_at)}</dd>
            </div>
          </dl>
        ) : (
          <dl className="m-0 border-t border-charcoal-ink divide-y divide-stone-line">
            <div className="flex justify-between py-3 text-xs">
              <dt className="text-charcoal-muted">{t("dailyClose.openingCashBase")}</dt>
              <dd className="font-medium text-charcoal-ink">{formatRupiah(parsedOpening)}</dd>
            </div>
            <div className="flex justify-between py-3 text-xs">
              <dt className="text-charcoal-muted">{t("dailyClose.todayCashPayments")}</dt>
              <dd className="font-medium text-charcoal-ink">{formatRupiah(netCashSales)}</dd>
            </div>
            <div className="flex justify-between py-3 text-xs">
              <dt className="text-charcoal-muted">{t("dailyClose.cashRefunds")}</dt>
              <dd className="font-medium text-charcoal-ink">Rp 0</dd>
            </div>
            <div className="flex justify-between py-3 text-xs font-bold">
              <dt className="text-charcoal-muted">{t("dailyClose.expectedInDrawer")}</dt>
              <dd className="text-charcoal-ink">{formatRupiah(expectedDrawer)}</dd>
            </div>
          </dl>
        )}
      </div>

      <div className="md:border-l md:border-stone-line md:pl-8 pt-6 md:pt-0 border-t md:border-t-0 border-stone-line flex flex-col gap-3">
        <div>
          <Badge tone={isClosed ? "success" : "warning"}>
            {isClosed ? t("dailyClose.registerClosed") : t("dailyClose.closePending")}
          </Badge>
        </div>
        <h3 className="font-serif text-xl text-charcoal-ink mt-1 mb-1">
          {isClosed ? t("dailyClose.reconciledTitle") : t("dailyClose.reconcileTitle")}
        </h3>
        <p className="text-charcoal-muted text-xs leading-relaxed mb-2">
          {isClosed
            ? t("dailyClose.reconciledNotice", { date: dateHeading })
            : t("dailyClose.reconcileInstructions")}
        </p>

        {submitError && (
          <div
            className="mb-4 p-3 bg-red-50/80 border border-red-200 text-danger text-xs rounded-sm flex items-center gap-2"
            role="alert"
          >
            <Icon name="bell" size={16} />
            <span>{submitError}</span>
          </div>
        )}

        {!isClosed && (
          <form onSubmit={handleCloseRegister} className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-xs font-semibold text-charcoal-ink">
              {t("dailyClose.openingCashInput")}
              <input
                type="number"
                min="0"
                step="10000"
                value={openingCashInput}
                onChange={(e) => setOpeningCashInput(e.target.value)}
                required
                className="border border-stone-line bg-white px-3 py-2 text-xs text-charcoal-ink rounded-sm focus:outline-none focus:border-copper"
              />
              <small className="text-charcoal-muted text-[10px]">
                {language === "id" ? "Format" : "Formatted"}: {formatRupiah(parsedOpening)}
              </small>
            </label>

            <label className="flex flex-col gap-1 text-xs font-semibold text-charcoal-ink">
              {t("dailyClose.countedCashInput")}
              <input
                type="number"
                min="0"
                step="5000"
                placeholder="e.g. 750000"
                value={countedCashInput}
                onChange={(e) => setCountedCashInput(e.target.value)}
                required
                className="border border-stone-line bg-white px-3 py-2 text-xs text-charcoal-ink rounded-sm focus:outline-none focus:border-copper"
              />
              <small className="text-charcoal-muted text-[10px]">
                {language === "id" ? "Format" : "Formatted"}: {formatRupiah(parsedCounted)} · {t("dailyClose.discrepancy")}:{" "}
                <strong className={difference === 0 ? "text-forest" : "text-amber"}>
                  {difference >= 0 ? `+${formatRupiah(difference)}` : formatRupiah(difference)}
                </strong>
              </small>
            </label>

            <label className="flex flex-col gap-1 text-xs font-semibold text-charcoal-ink">
              {t("dailyClose.noteInput")}
              <textarea
                placeholder={t("dailyClose.notePlaceholder")}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                className="border border-stone-line bg-white px-3 py-2 text-xs text-charcoal-ink rounded-sm focus:outline-none focus:border-copper resize-y"
              />
            </label>

            <Button
              type="submit"
              variant="primary"
              isLoading={isSubmitting}
              className="w-full mt-3"
            >
              {isSubmitting ? t("dailyClose.finalizing") : t("dailyClose.closeButton")}
            </Button>
          </form>
        )}
      </div>
    </div>
  )
}
