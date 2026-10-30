import React, { useState, useEffect, useCallback } from "react"
import {
  payrollApi,
  type StaffItem,
  type BarberCompensationPolicy,
  ApiError,
} from "../../lib/api"
import { Badge } from "../../components/ui/Badge"
import { Button } from "../../components/ui/Button"
import { Icon } from "../../components/ui/Icon"
import { Modal, ModalHeader, ModalTitle, ModalBody, ModalFooter } from "../../components/ui/Modal"
import { formatRupiah } from "../../lib/format"
import { useI18n } from "../../lib/i18n"

interface BarberCompensationModalProps {
  staff: StaffItem
  onClose: () => void
  onSuccess: (message: string) => void
}

export function BarberCompensationModal({
  staff,
  onClose,
  onSuccess,
}: BarberCompensationModalProps) {
  const { t, language } = useI18n()
  const [isLoading, setIsLoading] = useState(true)
  const [activePolicy, setActivePolicy] = useState<BarberCompensationPolicy | null>(null)
  const [history, setHistory] = useState<BarberCompensationPolicy[]>([])
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Policy Form State
  const [model, setModel] = useState<"commission" | "salary" | "hybrid">("commission")
  const [commissionType, setCommissionType] = useState<"percentage" | "fixed">("percentage")
  const [commissionPct, setCommissionPct] = useState<number>(50)
  const [fixedCommissionAmount, setFixedCommissionAmount] = useState<number>(25000)
  const [monthlySalary, setMonthlySalary] = useState<number>(3000000)
  const [effectiveFrom, setEffectiveFrom] = useState(() => new Date().toISOString().split("T")[0])

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [showHistory, setShowHistory] = useState(false)

  const loadPolicies = useCallback(async () => {
    setIsLoading(true)
    setErrorMessage(null)
    try {
      const res = await payrollApi.getStaffCompensation(staff.id)
      setActivePolicy(res.active_policy)
      setHistory(res.history || [])

      if (res.active_policy) {
        setModel(res.active_policy.model)
        setCommissionType(res.active_policy.commission_type || "percentage")
        setCommissionPct(
          res.active_policy.commission_rate_bps
            ? res.active_policy.commission_rate_bps / 100
            : 50
        )
        setFixedCommissionAmount(res.active_policy.fixed_commission_amount || 25000)
        setMonthlySalary(res.active_policy.monthly_salary || 3000000)
      }
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message || `Failed to load compensation policy (${err.code})`)
      } else if (err instanceof Error) {
        setErrorMessage(err.message)
      } else {
        setErrorMessage("Network error loading compensation policy.")
      }
    } finally {
      setIsLoading(false)
    }
  }, [staff.id])

  useEffect(() => {
    loadPolicies()
  }, [loadPolicies])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSubmitting) return

    if (model === "commission" || model === "hybrid") {
      if (commissionType === "percentage") {
        if (commissionPct < 0 || commissionPct > 100) {
          setFormError("Commission percentage must be between 0% and 100%.")
          return
        }
      } else {
        if (fixedCommissionAmount < 0) {
          setFormError("Fixed commission amount cannot be negative.")
          return
        }
      }
    }

    if (model === "salary" || model === "hybrid") {
      if (monthlySalary < 0) {
        setFormError("Monthly salary cannot be negative.")
        return
      }
    }

    if (!effectiveFrom) {
      setFormError("Effective date is required.")
      return
    }

    setIsSubmitting(true)
    setFormError(null)

    try {
      await payrollApi.createStaffCompensation(staff.id, {
        model,
        commission_type: commissionType,
        commission_rate_bps:
          commissionType === "percentage" ? Math.round(commissionPct * 100) : 0,
        fixed_commission_amount:
          commissionType === "fixed" ? Math.round(fixedCommissionAmount) : 0,
        monthly_salary:
          model === "salary" || model === "hybrid" ? Math.round(monthlySalary) : 0,
        effective_from: effectiveFrom,
      })

      onSuccess(`Updated compensation policy for ${staff.name}`)
      await loadPolicies()
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setFormError(err.message || `Failed to update compensation (${err.code})`)
      } else if (err instanceof Error) {
        setFormError(err.message)
      } else {
        setFormError("An unexpected error occurred while saving policy.")
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const formatModelBadge = (m: "commission" | "salary" | "hybrid") => {
    switch (m) {
      case "commission":
        return <Badge tone="neutral">{language === "id" ? "Hanya Komisi" : "Commission Only"}</Badge>
      case "salary":
        return <Badge tone="info">{language === "id" ? "Gaji Tetap" : "Fixed Salary"}</Badge>
      case "hybrid":
        return <Badge tone="success">{language === "id" ? "Gaji Pokok + Komisi" : "Base Salary + Commission"}</Badge>
    }
  }

  const formatPolicyDetails = (p: BarberCompensationPolicy) => {
    const parts: string[] = []
    if (p.model === "salary" || p.model === "hybrid") {
      parts.push(
        `${language === "id" ? "Gaji" : "Salary"}: ${formatRupiah(p.monthly_salary)} / ${language === "id" ? "bulan" : "month"}`
      )
    }
    if (p.model === "commission" || p.model === "hybrid") {
      if (p.commission_type === "fixed") {
        parts.push(
          `${language === "id" ? "Komisi" : "Commission"}: ${formatRupiah(p.fixed_commission_amount)} / ${language === "id" ? "layanan" : "job"}`
        )
      } else {
        parts.push(
          `${language === "id" ? "Komisi" : "Commission"}: ${p.commission_rate_bps / 100}% ${language === "id" ? "per layanan" : "per service"}`
        )
      }
    }
    return parts.join(" · ")
  }

  return (
    <Modal isOpen onClose={onClose} size="md">
      <ModalHeader>
        <div>
          <span className="text-[10px] uppercase tracking-wider text-charcoal-muted font-bold block mb-1">
            {language === "id" ? "KOMPENSASI & PENGGAJIAN STAF" : "STAFF COMPENSATION & PAYROLL"}
          </span>
          <ModalTitle id="comp-modal-title">{staff.name}</ModalTitle>
        </div>
        <button
          type="button"
          className="text-charcoal-muted hover:text-charcoal-ink p-1 rounded-sm text-lg leading-none"
          onClick={onClose}
          aria-label={t("common.close")}
        >
          ×
        </button>
      </ModalHeader>

      <ModalBody>
        {errorMessage && (
          <div
            className="p-3 bg-red-50/80 border border-red-200 text-danger text-xs rounded-sm flex items-center gap-2 mb-3"
            role="alert"
          >
            <Icon name="bell" size={16} />
            <span>{errorMessage}</span>
          </div>
        )}

        {isLoading ? (
          <div className="py-10 text-center text-charcoal-muted text-xs">
            {language === "id" ? "Memuat profil kompensasi..." : "Loading compensation profile..."}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Active Policy Summary Card */}
            <div className="bg-ivory-paper border border-stone-line p-4 rounded-sm">
              <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] font-bold tracking-wider text-charcoal-muted">
                  {language === "id" ? "KEBIJAKAN AKTIF SAAT INI" : "CURRENT ACTIVE POLICY"}
                </span>
                {activePolicy && formatModelBadge(activePolicy.model)}
              </div>

              {activePolicy ? (
                <div>
                  <div className="text-sm font-semibold text-charcoal-ink mb-1">
                    {formatPolicyDetails(activePolicy)}
                  </div>
                  <div className="text-xs text-charcoal-muted">
                    {language === "id" ? "Berlaku sejak " : "Effective since "}
                    <strong>{activePolicy.effective_from ? activePolicy.effective_from.split("T")[0] : (language === "id" ? "awal" : "start")}</strong>
                    {activePolicy.effective_to && (
                      <span> {language === "id" ? "hingga" : "until"} {activePolicy.effective_to.split("T")[0]}</span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-xs text-charcoal-muted">
                  {language === "id"
                    ? `Belum ada kebijakan kompensasi yang ditentukan. Menggunakan persentase komisi standar (${staff.commission_bps ? `${staff.commission_bps / 100}%` : "50%"}).`
                    : `No active compensation policy assigned. Falling back to legacy commission rate (${staff.commission_bps ? `${staff.commission_bps / 100}%` : "50%"}).`}
                </div>
              )}
            </div>

            {/* New / Update Policy Form */}
            <form id="comp-form" onSubmit={handleSubmit} className="space-y-3.5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-charcoal-muted">
                {language === "id" ? "Tetapkan Kebijakan Baru (Berlaku Tanggal)" : "Set New Policy (Effective-Dated)"}
              </div>

              {formError && (
                <div
                  className="p-3 bg-red-50/80 border border-red-200 text-danger text-xs rounded-sm flex items-center gap-2"
                  role="alert"
                >
                  <Icon name="bell" size={16} />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <label className="sm:col-span-2 flex flex-col gap-1 text-xs font-semibold text-charcoal-ink">
                  {language === "id" ? "Model Kompensasi" : "Compensation Model"}
                  <select
                    value={model}
                    onChange={(e) => setModel(e.target.value as "commission" | "salary" | "hybrid")}
                    className="border border-stone-line bg-white px-3 py-2 text-xs text-charcoal-ink rounded-sm focus:outline-none focus:border-copper"
                  >
                    <option value="commission">
                      {language === "id" ? "Komisi per Layanan Selesai" : "Commission per Completed Service"}
                    </option>
                    <option value="salary">
                      {language === "id" ? "Gaji Tetap Bulanan" : "Fixed Monthly Salary"}
                    </option>
                    <option value="hybrid">
                      {language === "id" ? "Gaji Pokok + Komisi per Layanan" : "Base Salary + Commission per Service"}
                    </option>
                  </select>
                </label>

                {(model === "commission" || model === "hybrid") && (
                  <>
                    <label className="flex flex-col gap-1 text-xs font-semibold text-charcoal-ink">
                      {language === "id" ? "Struktur Perhitungan Komisi" : "Commission Structure"}
                      <select
                        value={commissionType}
                        onChange={(e) => setCommissionType(e.target.value as "percentage" | "fixed")}
                        className="border border-stone-line bg-white px-3 py-2 text-xs text-charcoal-ink rounded-sm focus:outline-none focus:border-copper"
                      >
                        <option value="percentage">
                          {language === "id" ? "Persentase Tarif Layanan (%)" : "Percentage of Service Revenue (%)"}
                        </option>
                        <option value="fixed">
                          {language === "id" ? "Nominal Rupiah Tetap per Layanan" : "Fixed Rupiah per Completed Job"}
                        </option>
                      </select>
                    </label>

                    {commissionType === "percentage" ? (
                      <label className="flex flex-col gap-1 text-xs font-semibold text-charcoal-ink">
                        {language === "id" ? "Persentase Komisi (%)" : "Commission Rate (%)"}
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.5"
                          value={commissionPct}
                          onChange={(e) => setCommissionPct(parseFloat(e.target.value) || 0)}
                          required
                          className="border border-stone-line bg-white px-3 py-2 text-xs text-charcoal-ink rounded-sm focus:outline-none focus:border-copper"
                        />
                        <small className="text-charcoal-muted text-[10px]">
                          Basis points: {Math.round(commissionPct * 100)} bps
                        </small>
                      </label>
                    ) : (
                      <label className="flex flex-col gap-1 text-xs font-semibold text-charcoal-ink">
                        {language === "id" ? "Nominal Tetap per Layanan (Rp)" : "Fixed Amount per Job (Rp)"}
                        <input
                          type="number"
                          min="0"
                          step="1000"
                          value={fixedCommissionAmount}
                          onChange={(e) => setFixedCommissionAmount(parseInt(e.target.value, 10) || 0)}
                          required
                          className="border border-stone-line bg-white px-3 py-2 text-xs text-charcoal-ink rounded-sm focus:outline-none focus:border-copper"
                        />
                        <small className="text-charcoal-muted text-[10px]">
                          {language === "id" ? "Format" : "Formatted"}: {formatRupiah(fixedCommissionAmount)}
                        </small>
                      </label>
                    )}
                  </>
                )}

                {(model === "salary" || model === "hybrid") && (
                  <label className={`flex flex-col gap-1 text-xs font-semibold text-charcoal-ink ${model === "salary" ? "sm:col-span-2" : ""}`}>
                    {language === "id" ? "Gaji Pokok Bulanan (Rp)" : "Monthly Base Salary (Rp)"}
                    <input
                      type="number"
                      min="0"
                      step="50000"
                      value={monthlySalary}
                      onChange={(e) => setMonthlySalary(parseInt(e.target.value, 10) || 0)}
                      required
                      className="border border-stone-line bg-white px-3 py-2 text-xs text-charcoal-ink rounded-sm focus:outline-none focus:border-copper"
                    />
                    <small className="text-charcoal-muted text-[10px]">
                      {language === "id"
                        ? `Prorata untuk bulan berjalan: ${formatRupiah(monthlySalary)} / bulan`
                        : `Prorated for partial months: ${formatRupiah(monthlySalary)} / month`}
                    </small>
                  </label>
                )}

                <label className="sm:col-span-2 flex flex-col gap-1 text-xs font-semibold text-charcoal-ink">
                  {language === "id" ? "Tanggal Berlaku (YYYY-MM-DD)" : "Effective Date (YYYY-MM-DD)"}
                  <input
                    type="date"
                    value={effectiveFrom}
                    onChange={(e) => setEffectiveFrom(e.target.value)}
                    required
                    className="border border-stone-line bg-white px-3 py-2 text-xs text-charcoal-ink rounded-sm focus:outline-none focus:border-copper"
                  />
                  <small className="text-charcoal-muted text-[10px]">
                    {language === "id"
                      ? "Pendapatan sebelum tanggal ini akan tetap menggunakan tarif historis sebelumnya."
                      : "Past earnings before this date will preserve their historical rates."}
                  </small>
                </label>
              </div>
            </form>

            {/* Toggle History Button */}
            <div className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowHistory(!showHistory)}
              >
                {showHistory
                  ? (language === "id" ? "Sembunyikan Riwayat Kebijakan" : "Hide Policy History")
                  : (language === "id" ? `Lihat Riwayat Kebijakan (${history.length})` : `View Policy History (${history.length})`)}
              </Button>
            </div>

            {/* Policy History Log */}
            {showHistory && (
              <div className="mt-4 pt-3 border-t border-stone-line space-y-2">
                <div className="text-[10px] font-bold uppercase tracking-wider text-charcoal-muted">
                  {language === "id" ? "RIWAYAT KEBIJAKAN KOMPENSASI" : "COMPENSATION POLICY HISTORY"}
                </div>

                {history.length === 0 ? (
                  <div className="text-xs text-charcoal-muted py-2">
                    {language === "id" ? "Belum ada riwayat perubahan kebijakan." : "No recorded policy transitions."}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {history.map((h) => {
                      const fromStr = h.effective_from ? h.effective_from.split("T")[0] : ""
                      const toStr = h.effective_to ? h.effective_to.split("T")[0] : (language === "id" ? "Sekarang" : "Present")
                      const isCurrent = !h.effective_to

                      return (
                        <div
                          key={h.id}
                          className={`p-2.5 rounded-sm text-xs border ${
                            isCurrent
                              ? "bg-white border-charcoal-ink shadow-xs"
                              : "bg-ivory-paper border-stone-line"
                          }`}
                        >
                          <div className="flex justify-between items-center mb-1">
                            {formatModelBadge(h.model)}
                            <span className="text-charcoal-muted text-[10px]">
                              {fromStr} → {toStr}
                            </span>
                          </div>
                          <div className="text-charcoal-ink">{formatPolicyDetails(h)}</div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </ModalBody>

      <ModalFooter>
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={isSubmitting}
        >
          {t("common.close")}
        </Button>
        <Button
          type="submit"
          form="comp-form"
          variant="primary"
          isLoading={isSubmitting}
          disabled={isSubmitting || isLoading}
        >
          {isSubmitting
            ? (language === "id" ? "Menerapkan..." : "Applying...")
            : (language === "id" ? "Terapkan Kebijakan Baru" : "Apply New Policy")}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
