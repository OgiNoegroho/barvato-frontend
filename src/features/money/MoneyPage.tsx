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
import { Toast } from "../../components/layout/Toast"
import { formatRupiah, formatTimeOnly, getDatePartsInTimezone, getDateStringInTimezone } from "../../lib/format"
import { FinancePeople } from "./FinancePeople"
import { DailyClose } from "./DailyClose"

export function MoneyPage() {
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
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const showToast = useCallback((msg: string) => {
    setToastMessage(msg)
    const timer = setTimeout(() => setToastMessage(null), 3500)
    return () => clearTimeout(timer)
  }, [])

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

    if (periodPreset === "Today") {
      fromStr = todayStr
      toStr = todayStr
      const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        weekday: "long",
        month: "short",
        day: "numeric",
        year: "numeric",
      })
      dateHeading = formatter.format(new Date())
      periodLabel = "TODAY"
      completedSub = "completed services today"
    } else if (periodPreset === "7 days") {
      // 7 calendar days total: today and previous 6 calendar days
      const fromUtc = new Date(todayUtc.getTime() - 6 * 24 * 60 * 60 * 1000)
      fromStr = getDateStringInTimezone(fromUtc, "UTC")
      toStr = todayStr
      const f1 = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric" }).format(fromUtc)
      const f2 = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" }).format(todayUtc)
      dateHeading = `${f1} – ${f2}`
      periodLabel = "LAST 7 DAYS"
      completedSub = "completed services in last 7 days"
    } else if (periodPreset === "30 days") {
      // 30 calendar days total: today and previous 29 calendar days
      const fromUtc = new Date(todayUtc.getTime() - 29 * 24 * 60 * 60 * 1000)
      fromStr = getDateStringInTimezone(fromUtc, "UTC")
      toStr = todayStr
      const f1 = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric" }).format(fromUtc)
      const f2 = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" }).format(todayUtc)
      dateHeading = `${f1} – ${f2}`
      periodLabel = "LAST 30 DAYS"
      completedSub = "completed services in last 30 days"
    }

    return { fromStr, toStr, dateHeading, periodLabel, completedSub }
  }, [periodPreset, timezone])

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
        setErrorMessage("Network error loading financial data.")
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
      if (methodFilter !== "all" && p.method !== methodFilter) {
        return false
      }
      if (kindFilter !== "all" && p.kind !== kindFilter) {
        return false
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchesStaff = (p.staff_name || "").toLowerCase().includes(q)
        const matchesService = (p.service_name || "").toLowerCase().includes(q)
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
      showToast(`Transaction #${paymentId} refunded successfully`)
      loadFinancialData()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to process refund"
      alert(msg)
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
      <div className="money-toolbar">
        <div className="segmented">
          {(["Today", "7 days", "30 days"] as const).map((x) => (
            <button
              className={periodPreset === x ? "active" : ""}
              onClick={() => setPeriodPreset(x)}
              key={x}
            >
              {x}
            </button>
          ))}
        </div>
        <button className="filter-button" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <Icon name="calendar" size={14} /> {dateHeading}
        </button>
      </div>

      {errorMessage && (
        <div
          className="login-error-alert"
          role="alert"
          style={{ marginBottom: "20px", color: "var(--red, #cf3c3c)" }}
        >
          <Icon name="bell" size={16} />
          <span>{errorMessage}</span>
          <button
            type="button"
            className="filter-button"
            style={{ marginLeft: "auto", fontSize: "10px" }}
            onClick={loadFinancialData}
          >
            Retry
          </button>
        </div>
      )}

      {/* Finance Hero Banner */}
      <div className="finance-hero">
        <div>
          <span className="label">NET REVENUE · {periodLabel}</span>
          <strong>{formatRupiah(overview?.net_revenue ?? 0)}</strong>
          <p>{overview?.completed_jobs ?? overview?.completed_count ?? 0} {completedSub}</p>
        </div>
        <div className="finance-split">
          <span>
            <small>CASH COLLECTED</small>
            <strong>{formatRupiah(overview?.net_cash ?? 0)}</strong>
          </span>
          <span>
            <small>TRANSFER COLLECTED</small>
            <strong>{formatRupiah(overview?.net_transfer ?? 0)}</strong>
          </span>
          <span>
            <small>TIPS COLLECTED</small>
            <strong>{formatRupiah(overview?.net_tips ?? 0)}</strong>
          </span>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="finance-metrics">
        <article>
          <span className="section-index">PAYMENT METHOD BREAKDOWN</span>
          <strong>{formatRupiah(overview?.net_revenue ?? 0)}</strong>
          <p>
            <i className="legend card-legend" /> Transfer {formatRupiah(overview?.net_transfer ?? 0)}{" "}
            <i className="legend cash-legend" /> Cash {formatRupiah(overview?.net_cash ?? 0)}
          </p>
        </article>
        <article>
          <span className="section-index">COMMISSIONS ACCRUED</span>
          <strong>{formatRupiah(commissionsTotal)}</strong>
          <p>Current active pay cycle</p>
        </article>
        <article>
          <span className="section-index">AVERAGE TICKET</span>
          <strong>{formatRupiah(avgTicket)}</strong>
          <p>Per completed chair</p>
        </article>
        <article>
          <span className="section-index">OPERATIONS COUNT</span>
          <strong>
            {totalBookings + totalWalkins} total
          </strong>
          <p>
            {totalBookings} bookings · {totalWalkins} walk-ins
          </p>
        </article>
      </div>

      {/* Tabs and Detail Section */}
      <section className="data-section finance-detail">
        <div className="finance-tabs">
          {["Transactions", "Commissions", "Payouts", "Daily close"].map((x) => (
            <button
              className={tab === x ? "active" : ""}
              onClick={() => setTab(x)}
              key={x}
            >
              {x}
            </button>
          ))}
        </div>

        {tab === "Transactions" && (
          <>
            <div className="data-tools" style={{ alignItems: "center" }}>
              <div className="search small-search">
                <Icon name="search" size={15} />
                <input
                  placeholder="Search barber, service, or #ID..."
                  aria-label="Search transactions"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <select
                className="filter-button"
                value={methodFilter}
                onChange={(e) => setMethodFilter(e.target.value)}
                aria-label="Filter by payment method"
                style={{ height: "34px", padding: "0 10px", outline: "none", cursor: "pointer" }}
              >
                <option value="all">Method: All</option>
                <option value="cash">Cash</option>
                <option value="transfer">Bank Transfer</option>
              </select>

              <select
                className="filter-button"
                value={kindFilter}
                onChange={(e) => setKindFilter(e.target.value)}
                aria-label="Filter by transaction type"
                style={{ height: "34px", padding: "0 10px", outline: "none", cursor: "pointer" }}
              >
                <option value="all">Type: All</option>
                <option value="charge">Charge</option>
                <option value="refund">Refund</option>
              </select>
            </div>

            <div className="money-table">
              <div className="money-tr money-th">
                <span>Date &amp; time</span>
                <span>Transaction</span>
                <span>Service</span>
                <span>Barber</span>
                <span>Payment</span>
                <span>Type</span>
                <span>Amount</span>
              </div>

              {isLoading ? (
                <div style={{ padding: "48px 0", textAlign: "center", color: "var(--muted)", fontSize: "12px" }}>
                  Loading payment ledger from server...
                </div>
              ) : filteredPayments.length === 0 ? (
                <div style={{ padding: "48px 16px", textAlign: "center", borderBottom: "1px solid var(--line)" }}>
                  <p style={{ color: "var(--muted)", fontSize: "12px", margin: "0" }}>
                    {payments.length === 0
                      ? "No financial transactions recorded yet."
                      : "No transactions match your search and filter criteria."}
                  </p>
                </div>
              ) : (
                filteredPayments.map((p) => {
                  const dateStrFormatted = new Date(p.paid_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })
                  const timeFormatted = formatTimeOnly(p.paid_at)
                  const isRefund = p.kind === "refund"
                  const isAlreadyRefunded = Boolean(p.refunded_at)

                  return (
                    <div className="money-tr" key={p.id}>
                      <span>
                        <strong>{dateStrFormatted}</strong>
                        <small>{timeFormatted}</small>
                      </span>
                      <span>
                        <strong>Receipt #{p.id}</strong>
                        <small>{p.appointment_id ? `Booking #${p.appointment_id}` : p.queue_entry_id ? `Queue #${p.queue_entry_id}` : "POS"}</small>
                      </span>
                      <span>{p.service_name || "Custom Service"}</span>
                      <span>{p.staff_name || "Unassigned"}</span>
                      <span>
                        <Badge tone="neutral">
                          {p.method === "cash" ? "Cash" : "Transfer"}
                        </Badge>
                      </span>
                      <span>
                        <Badge tone={isRefund ? "warning" : "success"}>
                          {isRefund ? "Refund" : isAlreadyRefunded ? "Refunded" : "Paid"}
                        </Badge>
                      </span>
                      <span style={{ display: "flex", alignItems: "center", gap: "8px", justifyContent: "flex-end" }}>
                        <strong style={{ color: isRefund ? "var(--amber, orange)" : "var(--ink)" }}>
                          {isRefund ? `-${formatRupiah(p.amount)}` : formatRupiah(p.amount)}
                        </strong>
                        {!isRefund && !isAlreadyRefunded && (
                          <button
                            type="button"
                            className="filter-button mini"
                            style={{ fontSize: "9px", padding: "2px 6px" }}
                            title="Refund transaction"
                            onClick={() => handleRefund(p.id)}
                          >
                            Refund
                          </button>
                        )}
                      </span>
                    </div>
                  )
                })
              )}
            </div>
          </>
        )}

        {tab === "Commissions" && <FinancePeople type="commission" />}
        {tab === "Payouts" && <FinancePeople type="payout" />}
        {tab === "Daily close" && <DailyClose />}
      </section>

      {toastMessage && <Toast message={toastMessage} />}
    </div>
  )
}
