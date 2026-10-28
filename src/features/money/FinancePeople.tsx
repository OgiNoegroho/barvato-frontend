import React, { useState, useEffect, useCallback, useMemo } from "react"
import {
  payrollApi,
  staffApi,
  type PayrollSummaryItem,
  type PayoutRecord,
  type StaffItem,
  ApiError,
} from "../../lib/api"
import { Badge } from "../../components/ui/Badge"
import { Icon } from "../../components/ui/Icon"
import { Toast } from "../../components/layout/Toast"
import { formatRupiah, getInitials } from "../../lib/format"

interface FinancePeopleProps {
  type: "commission" | "payout"
}

export function FinancePeople({ type }: FinancePeopleProps) {
  const isSummary = type === "commission"

  // Date period state (defaults to current month)
  const [periodStart, setPeriodStart] = useState(() => {
    const d = new Date()
    d.setDate(1)
    return d.toISOString().split("T")[0]
  })
  const [periodEnd, setPeriodEnd] = useState(() => {
    const d = new Date()
    // Default to last day of current month
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0)
    return end.toISOString().split("T")[0]
  })

  // Data states
  const [summaryList, setSummaryList] = useState<PayrollSummaryItem[]>([])
  const [payouts, setPayouts] = useState<PayoutRecord[]>([])
  const [staffList, setStaffList] = useState<StaffItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Payout Creation Modal state
  const [isPayoutModalOpen, setIsPayoutModalOpen] = useState(false)
  const [modalStaffId, setModalStaffId] = useState<number | "">("")
  const [modalPeriodStart, setModalPeriodStart] = useState(() => periodStart)
  const [modalPeriodEnd, setModalPeriodEnd] = useState(() => periodEnd)
  const [amountInput, setAmountInput] = useState<string>("")
  const [userHasEditedAmount, setUserHasEditedAmount] = useState<boolean>(false)
  const [modalMethod, setModalMethod] = useState<"transfer" | "cash" | "other">("transfer")
  const [modalRefNumber, setModalRefNumber] = useState("")
  const [modalNote, setModalNote] = useState("")
  const [isCheckingBalance, setIsCheckingBalance] = useState(false)
  const [staffBalanceInfo, setStaffBalanceInfo] = useState<{
    gross: number
    paid: number
    balance: number
  } | null>(null)
  const [isSubmittingPayout, setIsSubmittingPayout] = useState(false)
  const [payoutError, setPayoutError] = useState<string | null>(null)

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const showToast = useCallback((msg: string) => {
    setToastMessage(msg)
    const timer = setTimeout(() => setToastMessage(null), 3500)
    return () => clearTimeout(timer)
  }, [])

  // Safely parse user amount input supporting digits, Indonesian dot/comma formatting, and Rp prefix
  const parsedAmountResult = useMemo(() => {
    if (!amountInput.trim()) return null
    // Strip optional "Rp", "IDR", and whitespace
    const cleaned = amountInput.replace(/^(?:Rp|idr)\s*/i, "").trim().replace(/\s+/g, "")
    // Strip trailing decimal cents (.00 or ,00)
    let numStr = cleaned.replace(/[.,]00$/, "")
    // Strip thousands separators (. or ,)
    numStr = numStr.replace(/[.,]/g, "")
    if (!/^\d+$/.test(numStr)) {
      return { valid: false as const, error: "Please enter a valid numeric amount." }
    }
    const val = parseInt(numStr, 10)
    if (isNaN(val) || val <= 0) {
      return { valid: false as const, error: "Payout amount must be greater than zero." }
    }
    return { valid: true as const, amount: val }
  }, [amountInput])

  const loadData = useCallback(async () => {
    setIsLoading(true)
    setErrorMessage(null)

    try {
      if (isSummary) {
        const [sumRes, staffRes] = await Promise.all([
          payrollApi.getSummary({ from: periodStart, to: periodEnd }),
          staffApi.list(true),
        ])
        setSummaryList(sumRes.summary || [])
        setStaffList(staffRes.staff || [])
      } else {
        const [payoutsRes, staffRes] = await Promise.all([
          payrollApi.listPayouts({ limit: 100 }),
          staffApi.list(true),
        ])
        setPayouts(payoutsRes.payouts || [])
        setStaffList(staffRes.staff || [])
      }
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message || `Failed to load payroll data (${err.code})`)
      } else if (err instanceof Error) {
        setErrorMessage(err.message)
      } else {
        setErrorMessage("Network error loading payroll records.")
      }
    } finally {
      setIsLoading(false)
    }
  }, [isSummary, periodStart, periodEnd])

  useEffect(() => {
    loadData()
  }, [loadData])

  // When modal opens or modal inputs change, fetch the barber's balance for the selected period
  const checkModalBalance = useCallback(
    async (staffId: number, start: string, end: string, autoFill = false) => {
      if (!staffId) return
      setIsCheckingBalance(true)
      try {
        const res = await payrollApi.getSummary({ staff_id: staffId, from: start, to: end })
        if (res.summary && res.summary.length > 0) {
          const item = res.summary[0]
          setStaffBalanceInfo({
            gross: item.gross_earnings,
            paid: item.total_paid,
            balance: item.outstanding_balance,
          })
          // Auto-suggest payout amount equal to remaining balance if requested or user has not typed
          if (autoFill) {
            setAmountInput(item.outstanding_balance > 0 ? String(item.outstanding_balance) : "0")
          }
        } else {
          setStaffBalanceInfo(null)
        }
      } catch {
        setStaffBalanceInfo(null)
      } finally {
        setIsCheckingBalance(false)
      }
    },
    []
  )

  const openPayoutForStaff = (staffId: number) => {
    setModalStaffId(staffId)
    setModalPeriodStart(periodStart)
    setModalPeriodEnd(periodEnd)
    setModalMethod("transfer")
    setModalRefNumber("")
    setModalNote("")
    setAmountInput("")
    setUserHasEditedAmount(false)
    setPayoutError(null)
    setIsPayoutModalOpen(true)
    checkModalBalance(staffId, periodStart, periodEnd, true)
  }

  const openNewPayout = () => {
    const firstStaffId = staffList[0]?.id || ""
    setModalStaffId(firstStaffId)
    setModalPeriodStart(periodStart)
    setModalPeriodEnd(periodEnd)
    setModalMethod("transfer")
    setModalRefNumber("")
    setModalNote("")
    setAmountInput("")
    setUserHasEditedAmount(false)
    setPayoutError(null)
    setIsPayoutModalOpen(true)
    if (firstStaffId) {
      checkModalBalance(Number(firstStaffId), periodStart, periodEnd, true)
    }
  }

  const handleCreatePayout = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSubmittingPayout || !modalStaffId) return

    if (!amountInput.trim()) {
      setPayoutError("Please enter a payout disbursement amount.")
      return
    }

    if (!parsedAmountResult || !parsedAmountResult.valid) {
      setPayoutError(parsedAmountResult?.error || "Invalid payout amount.")
      return
    }

    const numericAmount = parsedAmountResult.amount
    if (staffBalanceInfo && numericAmount > staffBalanceInfo.balance) {
      setPayoutError(
        `Payout amount (${formatRupiah(numericAmount)}) cannot exceed outstanding balance (${formatRupiah(
          staffBalanceInfo.balance
        )}).`
      )
      return
    }

    setIsSubmittingPayout(true)
    setPayoutError(null)

    try {
      await payrollApi.createPayout({
        staff_id: Number(modalStaffId),
        period_start: modalPeriodStart,
        period_end: modalPeriodEnd,
        amount: numericAmount,
        payment_method: modalMethod,
        reference_number: modalRefNumber.trim() || undefined,
        note: modalNote.trim() || undefined,
      })
      showToast("Payout disbursement recorded successfully")
      setIsPayoutModalOpen(false)
      loadData()
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setPayoutError(err.message || `Disbursement failed (${err.code})`)
      } else if (err instanceof Error) {
        setPayoutError(err.message)
      } else {
        setPayoutError("Network error disbursing payout.")
      }
    } finally {
      setIsSubmittingPayout(false)
    }
  }

  const handleVoidPayout = async (payoutId: number) => {
    if (!confirm("Are you sure you want to void this payout?")) return

    try {
      await payrollApi.voidPayout(payoutId, "Voided by shop manager")
      showToast("Payout voided successfully")
      loadData()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to void payout"
      alert(msg)
    }
  }

  // Summary Metrics calculations
  const totalGrossOwed = summaryList.reduce((sum, s) => sum + (s.gross_earnings || 0), 0)
  const totalPaidSum = summaryList.reduce((sum, s) => sum + (s.total_paid || 0), 0)
  const totalOutstanding = summaryList.reduce((sum, s) => sum + (s.outstanding_balance || 0), 0)
  const cumulativePayouts = payouts.reduce((sum, p) => (p.voided_at ? sum : sum + (p.amount || 0)), 0)

  const formatModelBadge = (m: "commission" | "salary" | "hybrid") => {
    switch (m) {
      case "commission":
        return <Badge tone="neutral">Commission</Badge>
      case "salary":
        return <Badge tone="info">Salary</Badge>
      case "hybrid":
        return <Badge tone="success">Hybrid</Badge>
    }
  }

  return (
    <div className="finance-people">
      {/* Pay Period & Top Action Bar */}
      <div className="pay-period" style={{ flexWrap: "wrap", gap: "16px" }}>
        <span>
          <small>{isSummary ? "PAYROLL PERIOD RANGE" : "ALL RECORDED PAYOUTS"}</small>
          {isSummary ? (
            <div style={{ display: "flex", gap: "6px", alignItems: "center", marginTop: "4px" }}>
              <input
                type="date"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
                style={{
                  fontSize: "12px",
                  padding: "4px 8px",
                  border: "1px solid var(--line)",
                  background: "var(--white)",
                }}
              />
              <span style={{ fontSize: "11px", color: "var(--muted)" }}>to</span>
              <input
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
                style={{
                  fontSize: "12px",
                  padding: "4px 8px",
                  border: "1px solid var(--line)",
                  background: "var(--white)",
                }}
              />
            </div>
          ) : (
            <strong>
              {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}
            </strong>
          )}
        </span>

        {isSummary ? (
          <>
            <span>
              <small>TOTAL GROSS ACCRUED</small>
              <strong>{formatRupiah(totalGrossOwed)}</strong>
            </span>
            <span>
              <small>TOTAL PAID OUT</small>
              <strong>{formatRupiah(totalPaidSum)}</strong>
            </span>
            <span>
              <small>OUTSTANDING BALANCE</small>
              <strong style={{ color: totalOutstanding > 0 ? "var(--forest, #2e7d32)" : "var(--ink)" }}>
                {formatRupiah(totalOutstanding)}
              </strong>
            </span>
          </>
        ) : (
          <span>
            <small>CUMULATIVE DISBURSED</small>
            <strong>{formatRupiah(cumulativePayouts)}</strong>
          </span>
        )}

        <button
          type="button"
          className="primary-button"
          onClick={openNewPayout}
          style={{ marginLeft: "auto" }}
        >
          + Disburse Payout
        </button>
      </div>

      {errorMessage && (
        <div
          className="login-error-alert"
          role="alert"
          style={{ margin: "16px 0", color: "var(--red, #cf3c3c)" }}
        >
          <Icon name="bell" size={16} />
          <span>{errorMessage}</span>
          <button
            type="button"
            className="filter-button"
            style={{ marginLeft: "auto", fontSize: "10px" }}
            onClick={loadData}
          >
            Retry
          </button>
        </div>
      )}

      {isLoading ? (
        <div style={{ padding: "48px 0", textAlign: "center", color: "var(--muted)", fontSize: "12px" }}>
          Loading {isSummary ? "payroll summary" : "payout history"}...
        </div>
      ) : isSummary ? (
        /* Unified Payroll Summary Table */
        <div className="money-table" style={{ overflowX: "auto" }}>
          <div
            className="money-tr money-th"
            style={{
              display: "grid",
              gridTemplateColumns: "1.4fr 1fr 1fr 1.2fr 0.8fr 1.1fr 1fr 1.2fr 0.8fr",
              gap: "8px",
            }}
          >
            <span>Barber</span>
            <span>Model</span>
            <span>Salary</span>
            <span>Commission</span>
            <span>Tips</span>
            <span>Gross Total</span>
            <span>Total Paid</span>
            <span>Balance</span>
            <span style={{ textAlign: "right" }}>Action</span>
          </div>

          {summaryList.length === 0 ? (
            <div style={{ padding: "36px 16px", textAlign: "center", color: "var(--muted)", fontSize: "11px" }}>
              No staff compensation or activity records found for this period.
            </div>
          ) : (
            summaryList.map((s) => {
              const initials = getInitials(s.staff_name)
              const hasBalance = s.outstanding_balance > 0

              return (
                <div
                  className="money-tr"
                  key={s.staff_id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1.4fr 1fr 1fr 1.2fr 0.8fr 1.1fr 1fr 1.2fr 0.8fr",
                    gap: "8px",
                    alignItems: "center",
                  }}
                >
                  <span className="client-cell">
                    <span className="avatar small">{initials}</span>
                    <strong>{s.staff_name}</strong>
                  </span>
                  <span>{formatModelBadge(s.model)}</span>
                  <span>{formatRupiah(s.salary_earned)}</span>
                  <span>
                    <strong>{formatRupiah(s.commission_earned)}</strong>
                    <small style={{ color: "var(--muted)", display: "block", fontSize: "9px" }}>
                      {s.completed_jobs} {s.completed_jobs === 1 ? "job" : "jobs"}
                    </small>
                  </span>
                  <span>{formatRupiah(s.tips_earned)}</span>
                  <strong>{formatRupiah(s.gross_earnings)}</strong>
                  <span style={{ color: "var(--muted)" }}>{formatRupiah(s.total_paid)}</span>
                  <strong style={{ color: hasBalance ? "var(--forest, #2e7d32)" : "var(--ink)" }}>
                    {formatRupiah(s.outstanding_balance)}
                  </strong>
                  <span style={{ textAlign: "right" }}>
                    <button
                      type="button"
                      className="filter-button mini"
                      style={{ fontSize: "10px", padding: "4px 8px" }}
                      disabled={!hasBalance}
                      title={hasBalance ? "Disburse payout for this barber" : "No balance outstanding"}
                      onClick={() => openPayoutForStaff(s.staff_id)}
                    >
                      Payout
                    </button>
                  </span>
                </div>
              )
            })
          )}
        </div>
      ) : (
        /* Payout Ledger Table */
        <div className="money-table" style={{ overflowX: "auto" }}>
          <div
            className="money-tr money-th"
            style={{
              display: "grid",
              gridTemplateColumns: "1.4fr 1.3fr 1.1fr 1.2fr 1fr 1.2fr",
              gap: "8px",
            }}
          >
            <span>Barber</span>
            <span>Period</span>
            <span>Method</span>
            <span>Reference / Note</span>
            <span>Amount</span>
            <span style={{ textAlign: "right" }}>Status</span>
          </div>

          {payouts.length === 0 ? (
            <div style={{ padding: "36px 16px", textAlign: "center", color: "var(--muted)", fontSize: "11px" }}>
              No payouts have been disbursed yet. Click "+ Disburse Payout" to record a payout.
            </div>
          ) : (
            payouts.map((p) => {
              const initials = getInitials(p.staff_name || "Barber")
              const isVoided = Boolean(p.voided_at)
              const startDate = p.period_start ? p.period_start.split("T")[0] : ""
              const endDate = p.period_end ? p.period_end.split("T")[0] : ""
              const methodLabel =
                p.payment_method === "cash"
                  ? "Cash"
                  : p.payment_method === "transfer"
                  ? "Transfer"
                  : "Other"

              return (
                <div
                  className="money-tr"
                  key={p.id}>
                  <span className="client-cell">
                    <span className="avatar small">{initials}</span>
                    <strong>{p.staff_name || `Barber #${p.staff_id}`}</strong>
                  </span>
                  <span>
                    {startDate} → {endDate}
                  </span>
                  <span>
                    <Badge tone="neutral">{methodLabel}</Badge>
                  </span>
                  <span>
                    {p.reference_number && (
                      <code style={{ fontSize: "10px", fontWeight: 600, display: "block" }}>
                        {p.reference_number}
                      </code>
                    )}
                    <span style={{ color: "var(--muted)", fontSize: "10px" }}>{p.note || "Payout"}</span>
                  </span>
                  <strong style={{ textDecoration: isVoided ? "line-through" : "none" }}>
                    {formatRupiah(p.amount)}
                  </strong>
                  <span style={{ display: "flex", alignItems: "center", gap: "8px", justifyContent: "flex-end" }}>
                    <Badge tone={isVoided ? "neutral" : "success"}>
                      {isVoided ? "Voided" : "Active Payout"}
                    </Badge>
                    {!isVoided && (
                      <button
                        type="button"
                        className="filter-button mini"
                        style={{ fontSize: "9px", padding: "2px 6px" }}
                        onClick={() => handleVoidPayout(p.id)}
                      >
                        Void
                      </button>
                    )}
                  </span>
                </div>
              )
            })
          )}
        </div>
      )}

      {/* Payout Disbursement Modal */}
      {isPayoutModalOpen && (
        <div className="modal-backdrop" onMouseDown={() => setIsPayoutModalOpen(false)}>
          <div
            className="modal"
            onMouseDown={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="payout-modal-title"
            style={{ maxWidth: "520px", width: "95%", maxHeight: "90vh", overflowY: "auto" }}
          >
            <div className="modal-head">
              <div>
                <span className="section-index">PAYROLL DISBURSEMENT</span>
                <h2 id="payout-modal-title">Record Payout</h2>
              </div>
              <button
                className="icon-button"
                onClick={() => setIsPayoutModalOpen(false)}
                aria-label="Close modal"
              >
                ×
              </button>
            </div>

            {payoutError && (
              <div
                className="login-error-alert"
                role="alert"
                style={{ marginBottom: "16px", color: "var(--red, #cf3c3c)" }}
              >
                <Icon name="bell" size={16} />
                <span>{payoutError}</span>
              </div>
            )}

            <form onSubmit={handleCreatePayout}>
              <div className="form-grid">
                <label className="full">
                  Staff Barber
                  <select
                    value={modalStaffId}
                    onChange={(e) => {
                      const id = Number(e.target.value)
                      setModalStaffId(id)
                      setUserHasEditedAmount(false)
                      checkModalBalance(id, modalPeriodStart, modalPeriodEnd, true)
                    }}
                    required
                  >
                    {staffList.map((st) => (
                      <option value={st.id} key={st.id}>
                        {st.name} ({st.contact || "Staff"})
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Period Start
                  <input
                    type="date"
                    value={modalPeriodStart}
                    onChange={(e) => {
                      setModalPeriodStart(e.target.value)
                      if (modalStaffId) {
                        checkModalBalance(Number(modalStaffId), e.target.value, modalPeriodEnd, false)
                      }
                    }}
                    required
                  />
                </label>

                <label>
                  Period End
                  <input
                    type="date"
                    value={modalPeriodEnd}
                    onChange={(e) => {
                      setModalPeriodEnd(e.target.value)
                      if (modalStaffId) {
                        checkModalBalance(Number(modalStaffId), modalPeriodStart, e.target.value, false)
                      }
                    }}
                    required
                  />
                </label>

                {/* Real-time Barber Balance Info Card */}
                <div
                  className="full"
                  style={{
                    background: "var(--paper)",
                    border: "1px solid var(--line)",
                    padding: "12px",
                    fontSize: "11px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                    <span style={{ color: "var(--muted)", fontWeight: 600 }}>EARNINGS &amp; BALANCE FOR PERIOD</span>
                    {isCheckingBalance && <span style={{ color: "var(--muted)" }}>Checking...</span>}
                  </div>
                  {staffBalanceInfo ? (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px", marginTop: "6px" }}>
                      <div>
                        <div style={{ color: "var(--muted)", fontSize: "9px" }}>GROSS EARNINGS</div>
                        <strong>{formatRupiah(staffBalanceInfo.gross)}</strong>
                      </div>
                      <div>
                        <div style={{ color: "var(--muted)", fontSize: "9px" }}>ALREADY PAID</div>
                        <strong>{formatRupiah(staffBalanceInfo.paid)}</strong>
                      </div>
                      <div>
                        <div style={{ color: "var(--muted)", fontSize: "9px" }}>OUTSTANDING BALANCE</div>
                        <strong
                          style={{
                            color: staffBalanceInfo.balance > 0 ? "var(--forest, #2e7d32)" : "var(--ink)",
                          }}
                        >
                          {formatRupiah(staffBalanceInfo.balance)}
                        </strong>
                      </div>
                    </div>
                  ) : (
                    <div style={{ color: "var(--muted)" }}>Select a barber and date range to inspect balance.</div>
                  )}
                </div>

                <label className="full">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                    <span>Disbursement Amount (Rp)</span>
                    {staffBalanceInfo && staffBalanceInfo.balance > 0 && (
                      <button
                        type="button"
                        className="filter-button"
                        style={{ fontSize: "11px", padding: "2px 8px" }}
                        onClick={() => {
                          setUserHasEditedAmount(true)
                          setAmountInput(String(staffBalanceInfo.balance))
                          setPayoutError(null)
                        }}
                      >
                        Set Full Balance ({formatRupiah(staffBalanceInfo.balance)})
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="e.g. 1.500.000 or 1500000"
                    value={amountInput}
                    onChange={(e) => {
                      setUserHasEditedAmount(true)
                      setAmountInput(e.target.value)
                      setPayoutError(null)
                    }}
                    required
                  />
                  {parsedAmountResult?.valid && (
                    <small style={{ color: "var(--ink)", fontSize: "11px", marginTop: "4px", display: "block" }}>
                      Disbursement: <strong>{formatRupiah(parsedAmountResult.amount)}</strong>
                    </small>
                  )}
                  {parsedAmountResult && !parsedAmountResult.valid && (
                    <small style={{ color: "var(--red, #cf3c3c)", fontSize: "11px", marginTop: "4px", display: "block" }}>
                      {parsedAmountResult.error}
                    </small>
                  )}
                  <small style={{ color: "var(--muted)", fontSize: "10px", marginTop: "4px", display: "block" }}>
                    Enter numbers (e.g. 1500000 or 1.500.000). Supports partial payouts up to the outstanding balance.
                  </small>
                </label>

                <label>
                  Payment Method
                  <select
                    value={modalMethod}
                    onChange={(e) => setModalMethod(e.target.value as "transfer" | "cash" | "other")}
                  >
                    <option value="transfer">Bank Transfer</option>
                    <option value="cash">Cash</option>
                    <option value="other">Other</option>
                  </select>
                </label>

                <label>
                  Reference Number
                  <input
                    placeholder="e.g. BCA-987123 / Trx ID"
                    value={modalRefNumber}
                    onChange={(e) => setModalRefNumber(e.target.value)}
                  />
                </label>

                <label className="full">
                  Disbursement Note
                  <input
                    placeholder="e.g. October monthly salary + commission payout"
                    value={modalNote}
                    onChange={(e) => setModalNote(e.target.value)}
                  />
                </label>
              </div>

              <div className="modal-actions" style={{ marginTop: "24px" }}>
                <button
                  type="button"
                  className="filter-button"
                  onClick={() => setIsPayoutModalOpen(false)}
                  disabled={isSubmittingPayout}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="primary-button"
                  disabled={isSubmittingPayout || !modalStaffId || !amountInput.trim() || (parsedAmountResult != null && !parsedAmountResult.valid)}
                >
                  {isSubmittingPayout ? "Disbursing..." : "Disburse Payout"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {toastMessage && <Toast message={toastMessage} />}
    </div>
  )
}
