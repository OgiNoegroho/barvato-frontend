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
import { Button } from "../../components/ui/Button"
import { Icon } from "../../components/ui/Icon"
import { Modal, ModalHeader, ModalTitle, ModalBody, ModalFooter } from "../../components/ui/Modal"
import { formatRupiah, getInitials } from "../../lib/format"
import { useI18n } from "../../lib/i18n"
import { useToast } from "../../hooks/useToast"

interface FinancePeopleProps {
  type: "commission" | "payout"
}

export function FinancePeople({ type }: FinancePeopleProps) {
  const isSummary = type === "commission"
  const { t, language } = useI18n()

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
  const [amountInput, setAmountInput] = useState<string>("" )
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
  const toast = useToast()

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
      return {
        valid: false as const,
        error: language === "id" ? "Masukkan nominal angka yang valid." : "Please enter a valid numeric amount.",
      }
    }
    const val = parseInt(numStr, 10)
    if (isNaN(val) || val <= 0) {
      return {
        valid: false as const,
        error: language === "id" ? "Nominal pencairan harus lebih besar dari nol." : "Payout amount must be greater than zero.",
      }
    }
    return { valid: true as const, amount: val }
  }, [amountInput, language])

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
      setPayoutError(language === "id" ? "Harap masukkan nominal pencairan." : "Please enter a payout disbursement amount.")
      return
    }

    if (!parsedAmountResult || !parsedAmountResult.valid) {
      setPayoutError(parsedAmountResult?.error || (language === "id" ? "Nominal pencairan tidak valid." : "Invalid payout amount."))
      return
    }

    const numericAmount = parsedAmountResult.amount
    if (staffBalanceInfo && numericAmount > staffBalanceInfo.balance) {
      setPayoutError(
        language === "id"
          ? `Nominal pencairan (${formatRupiah(numericAmount)}) tidak boleh melebihi sisa saldo (${formatRupiah(staffBalanceInfo.balance)}).`
          : `Payout amount (${formatRupiah(numericAmount)}) cannot exceed outstanding balance (${formatRupiah(
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
      toast.success(t("finance.disburseSuccess"))
      setIsPayoutModalOpen(false)
      loadData()
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setPayoutError(err.message || `Disbursement failed (${err.code})`)
        toast.error(err.message || `Disbursement failed (${err.code})`)
      } else if (err instanceof Error) {
        setPayoutError(err.message)
        toast.error(err.message)
      } else {
        const fallback = language === "id" ? "Kesalahan jaringan saat mencatat pencairan." : "Network error disbursing payout."
        setPayoutError(fallback)
        toast.error(fallback)
      }
    } finally {
      setIsSubmittingPayout(false)
    }
  }

  const handleVoidPayout = async (payoutId: number) => {
    if (!confirm(t("finance.confirmVoid"))) return

    try {
      await payrollApi.voidPayout(payoutId, "Voided by shop manager")
      toast.success(t("finance.voidSuccess"))
      loadData()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : (language === "id" ? "Gagal membatalkan pencairan" : "Failed to void payout")
      toast.error(msg)
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
        return <Badge tone="neutral">{language === "id" ? "Hanya Komisi" : "Commission"}</Badge>
      case "salary":
        return <Badge tone="info">{language === "id" ? "Gaji Pokok" : "Salary"}</Badge>
      case "hybrid":
        return <Badge tone="success">{language === "id" ? "Gaji + Komisi" : "Hybrid"}</Badge>
    }
  }

  return (
    <div className="w-full">
      {/* Pay Period & Top Action Bar */}
      <div className="flex flex-wrap items-center gap-4 sm:gap-8 bg-ivory-paper border border-stone-line p-3.5 mb-4 rounded-sm">
        <div>
          <small className="block text-[10px] uppercase tracking-wider text-charcoal-muted">
            {isSummary ? t("finance.periodRange") : t("finance.allPayouts")}
          </small>
          {isSummary ? (
            <div className="flex items-center gap-1.5 mt-1">
              <input
                type="date"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
                className="text-xs px-2 py-1 border border-stone-line bg-white rounded-sm text-charcoal-ink focus:outline-none focus:border-copper"
              />
              <span className="text-xs text-charcoal-muted">{t("finance.to")}</span>
              <input
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
                className="text-xs px-2 py-1 border border-stone-line bg-white rounded-sm text-charcoal-ink focus:outline-none focus:border-copper"
              />
            </div>
          ) : (
            <strong className="block font-serif text-lg text-charcoal-ink mt-0.5">
              {new Date().toLocaleDateString(language === "id" ? "id-ID" : "en-US", { month: "long", year: "numeric" })}
            </strong>
          )}
        </div>

        {isSummary ? (
          <>
            <div>
              <small className="block text-[10px] uppercase tracking-wider text-charcoal-muted">
                {t("finance.totalGross")}
              </small>
              <strong className="block font-serif text-lg text-charcoal-ink mt-0.5">
                {formatRupiah(totalGrossOwed)}
              </strong>
            </div>
            <div>
              <small className="block text-[10px] uppercase tracking-wider text-charcoal-muted">
                {t("finance.totalPaidOut")}
              </small>
              <strong className="block font-serif text-lg text-charcoal-ink mt-0.5">
                {formatRupiah(totalPaidSum)}
              </strong>
            </div>
            <div>
              <small className="block text-[10px] uppercase tracking-wider text-charcoal-muted">
                {t("finance.outstandingBalance")}
              </small>
              <strong className={`block font-serif text-lg mt-0.5 ${totalOutstanding > 0 ? "text-forest" : "text-charcoal-ink"}`}>
                {formatRupiah(totalOutstanding)}
              </strong>
            </div>
          </>
        ) : (
          <div>
            <small className="block text-[10px] uppercase tracking-wider text-charcoal-muted">
              {t("finance.cumulativeDisbursed")}
            </small>
            <strong className="block font-serif text-lg text-charcoal-ink mt-0.5">
              {formatRupiah(cumulativePayouts)}
            </strong>
          </div>
        )}

        <div className="ml-auto">
          <Button
            type="button"
            variant="primary"
            onClick={openNewPayout}
          >
            {t("finance.disbursePayout")}
          </Button>
        </div>
      </div>

      {errorMessage && (
        <div
          className="my-4 p-3 bg-red-50/80 border border-red-200 text-danger text-xs rounded-sm flex items-center gap-2"
          role="alert"
        >
          <Icon name="bell" size={16} />
          <span>{errorMessage}</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="ml-auto"
            onClick={loadData}
          >
            {t("common.retry")}
          </Button>
        </div>
      )}

      {isLoading ? (
        <div className="py-12 text-center text-charcoal-muted text-xs">
          {isSummary ? t("finance.loadingPayroll") : t("finance.loadingPayouts")}
        </div>
      ) : isSummary ? (
        /* Unified Payroll Summary Table */
        <div className="w-full overflow-x-auto border-t border-charcoal-ink">
          <div className="min-w-[880px]">
            <div className="grid grid-cols-[1.4fr_1fr_1fr_1.2fr_0.8fr_1.1fr_1fr_1.2fr_0.8fr] gap-2 py-3 border-b border-stone-line text-[10px] uppercase tracking-wider font-semibold text-charcoal-muted">
              <span>{t("roles.barber")}</span>
              <span>{t("team.compensationModel")}</span>
              <span>{t("finance.colSalary")}</span>
              <span>{t("team.commissionHeader")}</span>
              <span>{t("money.colTips")}</span>
              <span>{t("finance.colGrossTotal")}</span>
              <span>{t("finance.colTotalPaid")}</span>
              <span>{t("finance.colBalance")}</span>
              <span className="text-right">{t("common.actions")}</span>
            </div>

            {summaryList.length === 0 ? (
              <div className="py-9 px-4 text-center text-charcoal-muted text-xs">
                {t("finance.noRecordsForPeriod")}
              </div>
            ) : (
              summaryList.map((s) => {
                const initials = getInitials(s.staff_name)
                const hasBalance = s.outstanding_balance > 0

                return (
                  <div
                    key={s.staff_id}
                    className="grid grid-cols-[1.4fr_1fr_1fr_1.2fr_0.8fr_1.1fr_1fr_1.2fr_0.8fr] gap-2 py-3 border-b border-stone-line items-center text-xs text-charcoal-ink hover:bg-stone-50/50 transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <span className="w-7 h-7 rounded-full bg-charcoal-ink text-ivory-cream flex items-center justify-center text-[10px] font-bold shrink-0">
                        {initials}
                      </span>
                      <strong className="text-xs font-semibold text-charcoal-ink">{s.staff_name}</strong>
                    </span>
                    <span>{formatModelBadge(s.model)}</span>
                    <span className="font-mono text-xs">{formatRupiah(s.salary_earned)}</span>
                    <div>
                      <strong className="font-mono text-xs block">{formatRupiah(s.commission_earned)}</strong>
                      <small className="text-charcoal-muted block text-[10px]">
                        {t("finance.jobs", { count: s.completed_jobs })}
                      </small>
                    </div>
                    <span className="font-mono text-xs">{formatRupiah(s.tips_earned)}</span>
                    <strong className="font-mono text-xs">{formatRupiah(s.gross_earnings)}</strong>
                    <span className="font-mono text-xs text-charcoal-muted">{formatRupiah(s.total_paid)}</span>
                    <strong className={`font-mono text-xs ${hasBalance ? "text-forest" : "text-charcoal-ink"}`}>
                      {formatRupiah(s.outstanding_balance)}
                    </strong>
                    <span className="text-right">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={!hasBalance}
                        title={hasBalance ? (language === "id" ? "Cairkan komisi/gaji staf ini" : "Disburse payout for this barber") : (language === "id" ? "Tidak ada sisa saldo" : "No balance outstanding")}
                        onClick={() => openPayoutForStaff(s.staff_id)}
                      >
                        {t("finance.payoutButton")}
                      </Button>
                    </span>
                  </div>
                )
              })
            )}
          </div>
        </div>
      ) : (
        /* Payout Ledger Table */
        <div className="w-full overflow-x-auto border-t border-charcoal-ink">
          <div className="min-w-[800px]">
            <div className="grid grid-cols-[1.4fr_1.3fr_1.1fr_1.2fr_1fr_1.2fr] gap-2 py-3 border-b border-stone-line text-[10px] uppercase tracking-wider font-semibold text-charcoal-muted">
              <span>{t("roles.barber")}</span>
              <span>{t("finance.colPeriod")}</span>
              <span>{t("finance.colMethod")}</span>
              <span>{t("finance.colReferenceNote")}</span>
              <span>{t("finance.colAmount")}</span>
              <span className="text-right">{t("common.status")}</span>
            </div>

            {payouts.length === 0 ? (
              <div className="py-9 px-4 text-center text-charcoal-muted text-xs">
                {t("finance.noPayoutsYet")}
              </div>
            ) : (
              payouts.map((p) => {
                const initials = getInitials(p.staff_name || "Barber")
                const isVoided = Boolean(p.voided_at)
                const startDate = p.period_start ? p.period_start.split("T")[0] : ""
                const endDate = p.period_end ? p.period_end.split("T")[0] : ""
                const methodLabel =
                  p.payment_method === "cash"
                    ? t("payment.cash")
                    : p.payment_method === "transfer"
                    ? t("payment.transfer")
                    : (language === "id" ? "Lainnya" : "Other")

                return (
                  <div
                    key={p.id}
                    className="grid grid-cols-[1.4fr_1.3fr_1.1fr_1.2fr_1fr_1.2fr] gap-2 py-3 border-b border-stone-line items-center text-xs text-charcoal-ink hover:bg-stone-50/50 transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <span className="w-7 h-7 rounded-full bg-charcoal-ink text-ivory-cream flex items-center justify-center text-[10px] font-bold shrink-0">
                        {initials}
                      </span>
                      <strong className="text-xs font-semibold text-charcoal-ink">{p.staff_name || `Barber #${p.staff_id}`}</strong>
                    </span>
                    <span className="text-xs text-charcoal-muted">
                      {startDate} → {endDate}
                    </span>
                    <span>
                      <Badge tone="neutral">{methodLabel}</Badge>
                    </span>
                    <div>
                      {p.reference_number && (
                        <code className="text-[10px] font-mono font-semibold block text-charcoal-ink">
                          {p.reference_number}
                        </code>
                      )}
                      <span className="text-charcoal-muted text-xs">{p.note || (language === "id" ? "Pencairan" : "Payout")}</span>
                    </div>
                    <strong className={`font-mono text-xs ${isVoided ? "line-through text-charcoal-muted" : "text-charcoal-ink"}`}>
                      {formatRupiah(p.amount)}
                    </strong>
                    <span className="flex items-center gap-2 justify-end">
                      <Badge tone={isVoided ? "neutral" : "success"}>
                        {isVoided ? t("finance.voided") : t("finance.activePayout")}
                      </Badge>
                      {!isVoided && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleVoidPayout(p.id)}
                        >
                          {t("finance.voidButton")}
                        </Button>
                      )}
                    </span>
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}

      {/* Payout Disbursement Modal */}
      <Modal
        isOpen={isPayoutModalOpen}
        onClose={() => setIsPayoutModalOpen(false)}
        size="md"
      >
        <ModalHeader>
          <div>
            <span className="text-[10px] uppercase tracking-wider text-charcoal-muted font-bold block mb-1">
              {t("finance.periodRange")}
            </span>
            <ModalTitle id="payout-modal-title">{t("finance.recordPayoutTitle")}</ModalTitle>
          </div>
          <button
            type="button"
            className="text-charcoal-muted hover:text-charcoal-ink p-1 rounded-sm text-lg leading-none"
            onClick={() => setIsPayoutModalOpen(false)}
            aria-label={t("common.close")}
          >
            ×
          </button>
        </ModalHeader>

        <ModalBody>
          {payoutError && (
            <div
              className="p-3 bg-red-50/80 border border-red-200 text-danger text-xs rounded-sm flex items-center gap-2 mb-3"
              role="alert"
            >
              <Icon name="bell" size={16} />
              <span>{payoutError}</span>
            </div>
          )}

          <form id="payout-form" onSubmit={handleCreatePayout} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <label className="sm:col-span-2 flex flex-col gap-1 text-xs font-semibold text-charcoal-ink">
                {t("finance.staffBarber")}
                <select
                  value={modalStaffId}
                  onChange={(e) => {
                    const id = Number(e.target.value)
                    setModalStaffId(id)
                    setUserHasEditedAmount(false)
                    checkModalBalance(id, modalPeriodStart, modalPeriodEnd, true)
                  }}
                  required
                  className="border border-stone-line bg-white px-3 py-2 text-xs text-charcoal-ink rounded-sm focus:outline-none focus:border-copper"
                >
                  {staffList.map((st) => (
                    <option value={st.id} key={st.id}>
                      {st.name} ({st.contact || t("roles.staff")})
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1 text-xs font-semibold text-charcoal-ink">
                {t("finance.periodStart")}
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
                  className="border border-stone-line bg-white px-3 py-2 text-xs text-charcoal-ink rounded-sm focus:outline-none focus:border-copper"
                />
              </label>

              <label className="flex flex-col gap-1 text-xs font-semibold text-charcoal-ink">
                {t("finance.periodEnd")}
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
                  className="border border-stone-line bg-white px-3 py-2 text-xs text-charcoal-ink rounded-sm focus:outline-none focus:border-copper"
                />
              </label>

              {/* Real-time Barber Balance Info Card */}
              <div className="sm:col-span-2 bg-ivory-paper border border-stone-line p-3 text-xs rounded-sm">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-charcoal-muted font-semibold text-[10px] uppercase tracking-wider">
                    {t("finance.earningsAndBalance")}
                  </span>
                  {isCheckingBalance && (
                    <span className="text-charcoal-muted text-[10px]">{t("finance.checkingBalance")}</span>
                  )}
                </div>
                {staffBalanceInfo ? (
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    <div>
                      <div className="text-charcoal-muted text-[10px]">{t("finance.grossEarnings")}</div>
                      <strong className="font-mono text-xs">{formatRupiah(staffBalanceInfo.gross)}</strong>
                    </div>
                    <div>
                      <div className="text-charcoal-muted text-[10px]">{t("finance.alreadyPaid")}</div>
                      <strong className="font-mono text-xs">{formatRupiah(staffBalanceInfo.paid)}</strong>
                    </div>
                    <div>
                      <div className="text-charcoal-muted text-[10px]">{t("finance.outstandingBalance")}</div>
                      <strong
                        className={`font-mono text-xs ${
                          staffBalanceInfo.balance > 0 ? "text-forest" : "text-charcoal-ink"
                        }`}
                      >
                        {formatRupiah(staffBalanceInfo.balance)}
                      </strong>
                    </div>
                  </div>
                ) : (
                  <div className="text-charcoal-muted text-xs">
                    {language === "id"
                      ? "Pilih kapster dan rentang tanggal untuk melihat saldo."
                      : "Select a barber and date range to inspect balance."}
                  </div>
                )}
              </div>

              <label className="sm:col-span-2 flex flex-col gap-1 text-xs font-semibold text-charcoal-ink">
                <div className="flex justify-between items-center mb-0.5">
                  <span>{t("finance.disbursementAmount")}</span>
                  {staffBalanceInfo && staffBalanceInfo.balance > 0 && (
                    <button
                      type="button"
                      className="text-[11px] px-2 py-0.5 border border-stone-line rounded-sm hover:border-copper text-charcoal-ink hover:text-copper transition-colors"
                      onClick={() => {
                        setUserHasEditedAmount(true)
                        setAmountInput(String(staffBalanceInfo.balance))
                        setPayoutError(null)
                      }}
                    >
                      {t("finance.setFullBalance", { balance: formatRupiah(staffBalanceInfo.balance) })}
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
                  className="border border-stone-line bg-white px-3 py-2 text-xs text-charcoal-ink rounded-sm focus:outline-none focus:border-copper"
                />
                {parsedAmountResult?.valid && (
                  <small className="text-charcoal-ink text-xs mt-1 block">
                    {language === "id" ? "Nominal pencairan:" : "Disbursement:"} <strong>{formatRupiah(parsedAmountResult.amount)}</strong>
                  </small>
                )}
                {parsedAmountResult && !parsedAmountResult.valid && (
                  <small className="text-danger text-xs mt-1 block">
                    {parsedAmountResult.error}
                  </small>
                )}
                <small className="text-charcoal-muted text-[10px] mt-0.5 block">
                  {t("finance.amountHelper")}
                </small>
              </label>

              <label className="flex flex-col gap-1 text-xs font-semibold text-charcoal-ink">
                {t("payment.method")}
                <select
                  value={modalMethod}
                  onChange={(e) => setModalMethod(e.target.value as "transfer" | "cash" | "other")}
                  className="border border-stone-line bg-white px-3 py-2 text-xs text-charcoal-ink rounded-sm focus:outline-none focus:border-copper"
                >
                  <option value="transfer">{t("payment.transfer")}</option>
                  <option value="cash">{t("payment.cash")}</option>
                  <option value="other">{language === "id" ? "Lainnya" : "Other"}</option>
                </select>
              </label>

              <label className="flex flex-col gap-1 text-xs font-semibold text-charcoal-ink">
                {t("finance.referenceNumber")}
                <input
                  placeholder={t("finance.referencePlaceholder")}
                  value={modalRefNumber}
                  onChange={(e) => setModalRefNumber(e.target.value)}
                  className="border border-stone-line bg-white px-3 py-2 text-xs text-charcoal-ink rounded-sm focus:outline-none focus:border-copper"
                />
              </label>

              <label className="sm:col-span-2 flex flex-col gap-1 text-xs font-semibold text-charcoal-ink">
                {t("finance.disbursementNote")}
                <input
                  placeholder={t("finance.notePlaceholder")}
                  value={modalNote}
                  onChange={(e) => setModalNote(e.target.value)}
                  className="border border-stone-line bg-white px-3 py-2 text-xs text-charcoal-ink rounded-sm focus:outline-none focus:border-copper"
                />
              </label>
            </div>
          </form>
        </ModalBody>

        <ModalFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setIsPayoutModalOpen(false)}
            disabled={isSubmittingPayout}
          >
            {t("common.cancel")}
          </Button>
          <Button
            type="submit"
            form="payout-form"
            variant="primary"
            isLoading={isSubmittingPayout}
            disabled={isSubmittingPayout || !modalStaffId || !amountInput.trim() || (parsedAmountResult != null && !parsedAmountResult.valid)}
          >
            {isSubmittingPayout ? t("finance.disbursing") : t("finance.disbursePayout")}
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  )
}
