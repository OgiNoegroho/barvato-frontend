import React, { useState, useEffect, useCallback, useMemo, useRef } from "react"
import {
  overviewApi,
  paymentApi,
  payrollApi,
  type ShopOverview,
  type PaymentRecord,
  ApiError,
} from "../../lib/api"
import { Badge } from "../../components/ui/Badge"
import { Icon } from "../../components/ui/Icon"
import { Button } from "../../components/ui/Button"
import { formatRupiah, formatTimeOnly, getDatePartsInTimezone, getDateStringInTimezone } from "../../lib/format"
import { FinancePeople } from "./FinancePeople"
import { DailyClose } from "./DailyClose"
import { useI18n } from "../../lib/i18n"
import { useToast } from "../../hooks/useToast"
import { cn } from "../../lib/utils"

export function MoneyPage() {
  const { t, language } = useI18n()
  const [tab, setTab] = useState("Transactions")
  const [periodPreset, setPeriodPreset] = useState<"Today" | "7 days" | "30 days">("Today")

  // Overview Metrics State
  const [overview, setOverview] = useState<ShopOverview | null>(null)
  const [commissionsTotal, setCommissionsTotal] = useState<number>(0)
  const [payments, setPayments] = useState<PaymentRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Filters for Transactions
  const [searchQuery, setSearchQuery] = useState("")
  const [methodFilter, setMethodFilter] = useState<string>("all")
  const [kindFilter, setKindFilter] = useState<string>("all")

  // Toast feedback
  const toast = useToast()

  // Use shop timezone from overview, defaulting to Asia/Jakarta
  const timezone = overview?.timezone || "Asia/Jakarta"

  // Compute exact half-open boundaries [fromStr, toStr] and headings in shop timezone
  const { fromStr, toStr, dateHeading, periodLabel, completedSub } = useMemo(() => {
    const todayParts = getDatePartsInTimezone(new Date(), timezone)
    const todayUtc = new Date(Date.UTC(todayParts.year, todayParts.month - 1, todayParts.day))
    const todayStr = getDateStringInTimezone(todayUtc, "UTC")

    let fromStr = todayStr
    let toStr = todayStr
    let dateHeading = ""
    let periodLabel = ""
    let completedSub = ""

    const activeLocale = language === "id" ? "id-ID" : "en-US"

    if (periodPreset === "Today") {
      fromStr = todayStr
      toStr = todayStr
      const formatter = new Intl.DateTimeFormat(activeLocale, {
        timeZone: timezone,
        weekday: "long",
        month: "short",
        day: "numeric",
        year: "numeric",
      })
      dateHeading = formatter.format(new Date())
      periodLabel = language === "id" ? "HARI INI" : "TODAY"
      completedSub = language === "id" ? "layanan selesai hari ini" : "completed services today"
    } else if (periodPreset === "7 days") {
      const fromUtc = new Date(todayUtc.getTime() - 6 * 24 * 60 * 60 * 1000)
      fromStr = getDateStringInTimezone(fromUtc, "UTC")
      toStr = todayStr
      const f1 = new Intl.DateTimeFormat(activeLocale, { timeZone: "UTC", month: "short", day: "numeric" }).format(fromUtc)
      const f2 = new Intl.DateTimeFormat(activeLocale, { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" }).format(todayUtc)
      dateHeading = `${f1} – ${f2}`
      periodLabel = language === "id" ? "7 HARI TERAKHIR" : "LAST 7 DAYS"
      completedSub = language === "id" ? "layanan selesai dalam 7 hari terakhir" : "completed services in last 7 days"
    } else if (periodPreset === "30 days") {
      const fromUtc = new Date(todayUtc.getTime() - 29 * 24 * 60 * 60 * 1000)
      fromStr = getDateStringInTimezone(fromUtc, "UTC")
      toStr = todayStr
      const f1 = new Intl.DateTimeFormat(activeLocale, { timeZone: "UTC", month: "short", day: "numeric" }).format(fromUtc)
      const f2 = new Intl.DateTimeFormat(activeLocale, { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" }).format(todayUtc)
      dateHeading = `${f1} – ${f2}`
      periodLabel = language === "id" ? "30 HARI TERAKHIR" : "LAST 30 DAYS"
      completedSub = language === "id" ? "layanan selesai dalam 30 hari terakhir" : "completed services in last 30 days"
    }

    return { fromStr, toStr, dateHeading, periodLabel, completedSub }
  }, [periodPreset, timezone, language])

  // Request sequence ref to prevent older async responses from overwriting newer results
  const requestSeqRef = useRef(0)

  const loadFinancialData = useCallback(async () => {
    const currentSeq = ++requestSeqRef.current
    setIsLoading(true)
    setErrorMessage(null)

    try {
      const [overviewRes, paymentsRes, commsRes] = await Promise.all([
        overviewApi.get({ from: fromStr, to: toStr }).catch(() => null),
        paymentApi.list({ from: fromStr, to: toStr, limit: 100 }).catch(() => ({ payments: [] })),
        payrollApi.getCommissions({ from: fromStr, to: toStr }).catch(() => ({ commissions: [] })),
      ])

      if (currentSeq !== requestSeqRef.current) return

      setOverview(overviewRes)
      setPayments(paymentsRes.payments || [])
      const totalComms = (commsRes.commissions || []).reduce(
        (sum, c) => sum + (c.net_commission_amount || 0),
        0
      )
      setCommissionsTotal(totalComms)
    } catch (err: unknown) {
      if (currentSeq !== requestSeqRef.current) return
      if (err instanceof ApiError) {
        setErrorMessage(err.message || `Failed to load financial records (${err.code})`)
      } else if (err instanceof Error) {
        setErrorMessage(err.message)
      } else {
        setErrorMessage("Network error loading financial records.")
      }
    } finally {
      if (currentSeq === requestSeqRef.current) {
        setIsLoading(false)
      }
    }
  }, [fromStr, toStr])

  useEffect(() => {
    loadFinancialData()
  }, [loadFinancialData])

  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
      if (methodFilter !== "all" && p.method !== methodFilter) return false
      if (kindFilter !== "all" && p.kind !== kindFilter) return false
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchesStaff = p.staff_name?.toLowerCase().includes(q)
        const matchesService = p.service_name?.toLowerCase().includes(q)
        const matchesId = String(p.id).includes(q)
        return matchesStaff || matchesService || matchesId
      }
      return true
    })
  }, [payments, methodFilter, kindFilter, searchQuery])

  const handleRefund = async (paymentId: number) => {
    if (!confirm(`Are you sure you want to process a full refund for transaction #${paymentId}?`)) {
      return
    }

    try {
      await paymentApi.refund(paymentId)
      toast.success(`Transaction #${paymentId} refunded successfully`)
      loadFinancialData()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to process refund"
      toast.error(msg)
    }
  }

  const avgTicket = overview?.average_ticket ?? 0

  const totalBookings =
    (overview?.scheduled_count ?? 0) +
    (overview?.checked_in_count ?? 0) +
    (overview?.completed_count ?? 0)
  const totalWalkins =
    (overview?.queue_waiting_count ?? 0) +
    (overview?.queue_serving_count ?? 0)

  return (
    <div className="money-workspace">
      <div className="money-toolbar flex flex-wrap items-center gap-2 mb-3.5">
        <div className="segmented inline-flex p-0.5 bg-ivory-warm border border-stone rounded-sm">
          {[
            { id: "Today" as const, label: language === "id" ? "Hari ini" : "Today" },
            { id: "7 days" as const, label: language === "id" ? "7 hari" : "7 days" },
            { id: "30 days" as const, label: language === "id" ? "30 hari" : "30 days" },
          ].map((x) => (
            <button
              key={x.id}
              type="button"
              className={cn(
                "px-3 py-1 text-xs rounded-xs font-medium transition-colors cursor-pointer border-0",
                periodPreset === x.id
                  ? "active bg-ivory-light text-charcoal font-semibold shadow-subtle"
                  : "bg-transparent text-muted-text hover:text-charcoal"
              )}
              onClick={() => setPeriodPreset(x.id)}
            >
              {x.label}
            </button>
          ))}
        </div>
        <div className="filter-button inline-flex items-center gap-1.5 px-3 py-1.5 bg-ivory-light border border-stone rounded-sm text-xs font-medium text-charcoal">
          <Icon name="calendar" size={14} /> {dateHeading}
        </div>
      </div>

      {errorMessage && (
        <div
          className="login-error-alert bg-danger-soft border border-danger-line text-danger px-3.5 py-2.5 rounded-sm text-xs flex items-center gap-2 mb-5 leading-normal"
          role="alert"
        >
          <Icon name="bell" size={16} />
          <span className="flex-1">{errorMessage}</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="text-xs h-7 ml-auto"
            onClick={loadFinancialData}
          >
            {t("common.retry")}
          </Button>
        </div>
      )}

      {/* Finance Hero Banner */}
      <div className="finance-hero bg-charcoal text-white rounded-lg p-5 sm:p-7 flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-5 shadow-card">
        <div>
          <span className="label text-[9px] uppercase tracking-widest text-[#aeb1ab] font-bold block mb-1">
            {t("money.netRevenue").toUpperCase()} · {periodLabel}
          </span>
          <strong className="block font-serif text-3xl sm:text-4xl text-white my-1 leading-tight">
            {formatRupiah(overview?.net_revenue ?? 0)}
          </strong>
          <p className="text-xs text-[#aeb1ab] m-0">
            {overview?.completed_jobs ?? overview?.completed_count ?? 0} {completedSub}
          </p>
        </div>
        <div className="finance-split flex flex-wrap gap-6 sm:gap-8">
          <div>
            <small className="block text-[8px] uppercase tracking-wider text-[#999d97] font-bold">{t("money.cashCollected").toUpperCase()}</small>
            <strong className="block font-serif text-lg sm:text-xl text-white mt-1">{formatRupiah(overview?.net_cash ?? 0)}</strong>
          </div>
          <div>
            <small className="block text-[8px] uppercase tracking-wider text-[#999d97] font-bold">{t("money.cardTransferCollected").toUpperCase()}</small>
            <strong className="block font-serif text-lg sm:text-xl text-white mt-1">{formatRupiah(overview?.net_transfer ?? 0)}</strong>
          </div>
          <div>
            <small className="block text-[8px] uppercase tracking-wider text-[#999d97] font-bold">{language === "id" ? "TIP DITERIMA" : "TIPS COLLECTED"}</small>
            <strong className="block font-serif text-lg sm:text-xl text-white mt-1">{formatRupiah(overview?.net_tips ?? 0)}</strong>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="finance-metrics grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 border border-stone bg-ivory-light rounded-sm mb-5 divide-y sm:divide-y-0 sm:divide-x divide-stone shadow-subtle">
        <article className="p-4 sm:p-4.5">
          <span className="section-index text-2xs font-mono font-bold text-copper uppercase tracking-wider block mb-1">
            {language === "id" ? "RINCIAN METODE PEMBAYARAN" : "PAYMENT METHOD BREAKDOWN"}
          </span>
          <strong className="block font-serif text-xl sm:text-2xl text-charcoal my-1 leading-tight">{formatRupiah(overview?.net_revenue ?? 0)}</strong>
          <p className="text-2xs text-muted-text m-0 flex items-center gap-1.5 flex-wrap">
            <span className="w-1.5 h-1.5 rounded-full bg-copper inline-block" /> Transfer {formatRupiah(overview?.net_transfer ?? 0)}{" "}
            <span className="w-1.5 h-1.5 rounded-full bg-forest inline-block ml-1" /> {t("payment.cash")} {formatRupiah(overview?.net_cash ?? 0)}
          </p>
        </article>
        <article className="p-4 sm:p-4.5">
          <span className="section-index text-2xs font-mono font-bold text-copper uppercase tracking-wider block mb-1">
            {language === "id" ? "AKUMULASI KOMISI" : "COMMISSIONS ACCRUED"}
          </span>
          <strong className="block font-serif text-xl sm:text-2xl text-charcoal my-1 leading-tight">{formatRupiah(commissionsTotal)}</strong>
          <p className="text-2xs text-muted-text m-0">{language === "id" ? "Siklus pembayaran aktif saat ini" : "Current active pay cycle"}</p>
        </article>
        <article className="p-4 sm:p-4.5">
          <span className="section-index text-2xs font-mono font-bold text-copper uppercase tracking-wider block mb-1">
            {language === "id" ? "RATA-RATA TRANSAKSI" : "AVERAGE TICKET"}
          </span>
          <strong className="block font-serif text-xl sm:text-2xl text-charcoal my-1 leading-tight">{formatRupiah(avgTicket)}</strong>
          <p className="text-2xs text-muted-text m-0">{language === "id" ? "Per layanan selesai" : "Per completed chair"}</p>
        </article>
        <article className="p-4 sm:p-4.5">
          <span className="section-index text-2xs font-mono font-bold text-copper uppercase tracking-wider block mb-1">
            {language === "id" ? "TOTAL OPERASIONAL" : "OPERATIONS COUNT"}
          </span>
          <strong className="block font-serif text-xl sm:text-2xl text-charcoal my-1 leading-tight">
            {totalBookings + totalWalkins} {language === "id" ? "total" : "total"}
          </strong>
          <p className="text-2xs text-muted-text m-0">
            {totalBookings} {language === "id" ? "janji temu" : "bookings"} · {totalWalkins} {language === "id" ? "datang langsung" : "walk-ins"}
          </p>
        </article>
      </div>

      {/* Tabs and Detail Section */}
      <section className="data-section finance-detail bg-ivory-light border border-stone p-5 sm:p-6 rounded-lg">
        <div className="finance-tabs flex border-b border-stone mb-4 overflow-x-auto">
          {[
            { id: "Transactions", label: language === "id" ? "Transaksi" : "Transactions" },
            { id: "Commissions", label: language === "id" ? "Komisi" : "Commissions" },
            { id: "Payouts", label: language === "id" ? "Pencairan Komisi" : "Payouts" },
            { id: "Daily close", label: t("money.dailyClose") },
          ].map((x) => (
            <button
              key={x.id}
              type="button"
              className={cn(
                "px-4 py-3 border-b-2 font-semibold text-xs transition-colors cursor-pointer whitespace-nowrap bg-transparent",
                tab === x.id ? "active border-copper text-charcoal font-bold" : "border-transparent text-muted-text hover:text-charcoal"
              )}
              onClick={() => setTab(x.id)}
            >
              {x.label}
            </button>
          ))}
        </div>

        {tab === "Transactions" && (
          <>
            <div className="data-tools flex flex-wrap items-center gap-3 mb-4">
              <div className="search small-search relative flex-1 min-w-[200px]">
                <Icon name="search" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-text pointer-events-none" />
                <input
                  placeholder={
                    language === "id"
                      ? "Cari kapster, layanan, atau #ID..."
                      : "Search barber, service, or #ID..."
                  }
                  aria-label={t("common.search")}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-9 pl-9 pr-3 bg-ivory border border-stone rounded-sm text-xs text-charcoal placeholder:text-muted-text/70 focus:outline-none focus:border-copper"
                />
              </div>

              <select
                className="filter-button h-9 px-3 bg-ivory border border-stone rounded-sm text-xs font-medium text-charcoal focus:border-copper outline-none cursor-pointer"
                value={methodFilter}
                onChange={(e) => setMethodFilter(e.target.value)}
                aria-label={t("payment.method")}
              >
                <option value="all">{t("payment.method")}: {t("common.all")}</option>
                <option value="cash">{t("payment.cash")}</option>
                <option value="transfer">{t("payment.transfer")}</option>
              </select>

              <select
                className="filter-button h-9 px-3 bg-ivory border border-stone rounded-sm text-xs font-medium text-charcoal focus:border-copper outline-none cursor-pointer"
                value={kindFilter}
                onChange={(e) => setKindFilter(e.target.value)}
                aria-label="Filter by transaction type"
              >
                <option value="all">{language === "id" ? "Tipe: Semua" : "Type: All"}</option>
                <option value="charge">{language === "id" ? "Penerimaan" : "Charge"}</option>
                <option value="refund">{language === "id" ? "Pengembalian (Refund)" : "Refund"}</option>
              </select>
            </div>

            <div className="money-table overflow-x-auto">
              <div className="min-w-[840px]">
                <div className="money-tr money-th grid grid-cols-[1.1fr_1.2fr_1.25fr_1fr_1fr_0.7fr_0.55fr] gap-3 items-center py-2 border-b border-stone text-2xs uppercase tracking-wider text-muted-text font-bold">
                  <span>{language === "id" ? "Tanggal & Waktu" : "Date & time"}</span>
                  <span>{language === "id" ? "Transaksi" : "Transaction"}</span>
                  <span>{t("appointments.colServices")}</span>
                  <span>{t("appointments.colBarber")}</span>
                  <span>{t("payment.method")}</span>
                  <span>{language === "id" ? "Tipe" : "Type"}</span>
                  <span className="text-right">{language === "id" ? "Nominal" : "Amount"}</span>
                </div>

                {isLoading ? (
                  <div className="py-12 text-center text-muted-text text-xs">
                    {t("common.loading")}
                  </div>
                ) : filteredPayments.length === 0 ? (
                  <div className="py-12 text-center text-muted-text text-xs">
                    {language === "id" ? "Tidak ada catatan transaksi" : "No transaction records found"}
                  </div>
                ) : (
                  filteredPayments.map((p) => {
                    const dateStrFormatted = p.paid_at ? p.paid_at.split("T")[0] : ""
                    const timeFormatted = formatTimeOnly(p.paid_at)
                    const isRefund = p.kind === "refund"
                    const isAlreadyRefunded = Boolean(p.refunded_at)

                    return (
                      <div
                        className="money-tr grid grid-cols-[1.1fr_1.2fr_1.25fr_1fr_1fr_0.7fr_0.55fr] gap-3 items-center py-3 border-b border-stone hover:bg-ivory/50 transition-colors text-xs"
                        key={p.id}
                      >
                        <div>
                          <strong className="block text-xs font-semibold text-charcoal">{dateStrFormatted}</strong>
                          <small className="block text-2xs text-muted-text mt-0.5">{timeFormatted}</small>
                        </div>

                        <div>
                          <strong className="block text-xs font-semibold text-charcoal">Receipt #{p.id}</strong>
                          <small className="block text-2xs text-muted-text mt-0.5">
                            {p.appointment_id ? `Booking #${p.appointment_id}` : p.queue_entry_id ? `Queue #${p.queue_entry_id}` : "POS"}
                          </small>
                        </div>

                        <div>
                          <strong className="block text-xs font-medium text-charcoal truncate">{p.service_name || "Custom Service"}</strong>
                        </div>

                        <div>
                          <strong className="block text-xs font-medium text-charcoal">{p.staff_name || "Unassigned"}</strong>
                        </div>

                        <div>
                          <Badge tone="neutral" className="capitalize">
                            {p.method === "cash" ? t("payment.cash") : t("payment.transfer")}
                          </Badge>
                        </div>

                        <div>
                          <Badge tone={isRefund ? "warning" : "success"}>
                            {isRefund ? "Refund" : isAlreadyRefunded ? "Refunded" : "Paid"}
                          </Badge>
                        </div>

                        <div className="text-right">
                          <strong className={cn("block font-serif text-sm", isRefund ? "text-amber" : "text-charcoal font-semibold")}>
                            {isRefund ? `-${formatRupiah(p.amount)}` : formatRupiah(p.amount)}
                          </strong>
                          {!isRefund && !isAlreadyRefunded && (
                            <button
                              type="button"
                              className="text-[10px] text-danger hover:underline mt-1 cursor-pointer bg-transparent border-0 p-0 block ml-auto"
                              onClick={() => handleRefund(p.id)}
                            >
                              Refund
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </>
        )}

        {tab === "Commissions" && <FinancePeople type="commission" />}
        {tab === "Payouts" && <FinancePeople type="payout" />}
        {tab === "Daily close" && <DailyClose />}
      </section>
    </div>
  )
}
