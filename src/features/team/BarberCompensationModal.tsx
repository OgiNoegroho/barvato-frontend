import React, { useState, useEffect, useCallback } from "react"
import {
  payrollApi,
  type StaffItem,
  type BarberCompensationPolicy,
  ApiError,
} from "../../lib/api"
import { Badge } from "../../components/ui/Badge"
import { Icon } from "../../components/ui/Icon"
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
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className="modal"
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="comp-modal-title"
        style={{ maxWidth: "580px", width: "95%", maxHeight: "90vh", overflowY: "auto" }}
      >
        <div className="modal-head">
          <div>
            <span className="section-index">
              {language === "id" ? "KOMPENSASI & PENGGAJIAN STAF" : "STAFF COMPENSATION & PAYROLL"}
            </span>
            <h2 id="comp-modal-title">{staff.name}</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label={t("common.close")}>
            ×
          </button>
        </div>

        {errorMessage && (
          <div
            className="login-error-alert"
            role="alert"
            style={{ marginBottom: "16px", color: "var(--red, #cf3c3c)" }}
          >
            <Icon name="bell" size={16} />
            <span>{errorMessage}</span>
          </div>
        )}

        {isLoading ? (
          <div style={{ padding: "40px 0", textAlign: "center", color: "var(--muted)", fontSize: "12px" }}>
            {language === "id" ? "Memuat profil kompensasi..." : "Loading compensation profile..."}
          </div>
        ) : (
          <div>
            {/* Active Policy Summary Card */}
            <div
              style={{
                background: "var(--paper)",
                border: "1px solid var(--line)",
                padding: "16px",
                marginBottom: "20px",
                borderRadius: "2px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", color: "var(--muted)" }}>
                  {language === "id" ? "KEBIJAKAN AKTIF SAAT INI" : "CURRENT ACTIVE POLICY"}
                </span>
                {activePolicy && formatModelBadge(activePolicy.model)}
              </div>

              {activePolicy ? (
                <div>
                  <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--ink)", marginBottom: "4px" }}>
                    {formatPolicyDetails(activePolicy)}
                  </div>
                  <div style={{ fontSize: "11px", color: "var(--muted)" }}>
                    {language === "id" ? "Berlaku sejak " : "Effective since "}
                    <strong>{activePolicy.effective_from ? activePolicy.effective_from.split("T")[0] : (language === "id" ? "awal" : "start")}</strong>
                    {activePolicy.effective_to && (
                      <span> {language === "id" ? "hingga" : "until"} {activePolicy.effective_to.split("T")[0]}</span>
                    )}
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: "12px", color: "var(--muted)" }}>
                  {language === "id"
                    ? `Belum ada kebijakan kompensasi yang ditentukan. Menggunakan persentase komisi standar (${staff.commission_bps ? `${staff.commission_bps / 100}%` : "50%"}).`
                    : `No active compensation policy assigned. Falling back to legacy commission rate (${staff.commission_bps ? `${staff.commission_bps / 100}%` : "50%"}).`}
                </div>
              )}
            </div>

            {/* New / Update Policy Form */}
            <form onSubmit={handleSubmit}>
              <div
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  color: "var(--muted)",
                  marginBottom: "12px",
                }}
              >
                {language === "id" ? "Tetapkan Kebijakan Baru (Berlaku Tanggal)" : "Set New Policy (Effective-Dated)"}
              </div>

              {formError && (
                <div
                  className="login-error-alert"
                  role="alert"
                  style={{ marginBottom: "16px", color: "var(--red, #cf3c3c)" }}
                >
                  <Icon name="bell" size={16} />
                  <span>{formError}</span>
                </div>
              )}

              <div className="form-grid">
                <label className="full">
                  {language === "id" ? "Model Kompensasi" : "Compensation Model"}
                  <select
                    value={model}
                    onChange={(e) => setModel(e.target.value as "commission" | "salary" | "hybrid")}
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
                    <label>
                      {language === "id" ? "Struktur Perhitungan Komisi" : "Commission Structure"}
                      <select
                        value={commissionType}
                        onChange={(e) => setCommissionType(e.target.value as "percentage" | "fixed")}
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
                      <label>
                        {language === "id" ? "Persentase Komisi (%)" : "Commission Rate (%)"}
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.5"
                          value={commissionPct}
                          onChange={(e) => setCommissionPct(parseFloat(e.target.value) || 0)}
                          required
                        />
                        <small style={{ color: "var(--muted)", fontSize: "10px", marginTop: "4px", display: "block" }}>
                          Basis points: {Math.round(commissionPct * 100)} bps
                        </small>
                      </label>
                    ) : (
                      <label>
                        {language === "id" ? "Nominal Tetap per Layanan (Rp)" : "Fixed Amount per Job (Rp)"}
                        <input
                          type="number"
                          min="0"
                          step="1000"
                          value={fixedCommissionAmount}
                          onChange={(e) => setFixedCommissionAmount(parseInt(e.target.value, 10) || 0)}
                          required
                        />
                        <small style={{ color: "var(--muted)", fontSize: "10px", marginTop: "4px", display: "block" }}>
                          {language === "id" ? "Format" : "Formatted"}: {formatRupiah(fixedCommissionAmount)}
                        </small>
                      </label>
                    )}
                  </>
                )}

                {(model === "salary" || model === "hybrid") && (
                  <label className={model === "salary" ? "full" : ""}>
                    {language === "id" ? "Gaji Pokok Bulanan (Rp)" : "Monthly Base Salary (Rp)"}
                    <input
                      type="number"
                      min="0"
                      step="50000"
                      value={monthlySalary}
                      onChange={(e) => setMonthlySalary(parseInt(e.target.value, 10) || 0)}
                      required
                    />
                    <small style={{ color: "var(--muted)", fontSize: "10px", marginTop: "4px", display: "block" }}>
                      {language === "id"
                        ? `Prorata untuk bulan berjalan: ${formatRupiah(monthlySalary)} / bulan`
                        : `Prorated for partial months: ${formatRupiah(monthlySalary)} / month`}
                    </small>
                  </label>
                )}

                <label className="full">
                  {language === "id" ? "Tanggal Berlaku (YYYY-MM-DD)" : "Effective Date (YYYY-MM-DD)"}
                  <input
                    type="date"
                    value={effectiveFrom}
                    onChange={(e) => setEffectiveFrom(e.target.value)}
                    required
                  />
                  <small style={{ color: "var(--muted)", fontSize: "10px", marginTop: "4px", display: "block" }}>
                    {language === "id"
                      ? "Pendapatan sebelum tanggal ini akan tetap menggunakan tarif historis sebelumnya."
                      : "Past earnings before this date will preserve their historical rates."}
                  </small>
                </label>
              </div>

              <div style={{ marginTop: "16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <button
                  type="button"
                  className="filter-button"
                  style={{ fontSize: "11px", padding: "4px 8px" }}
                  onClick={() => setShowHistory(!showHistory)}
                >
                  {showHistory
                    ? (language === "id" ? "Sembunyikan Riwayat Kebijakan" : "Hide Policy History")
                    : (language === "id" ? `Lihat Riwayat Kebijakan (${history.length})` : `View Policy History (${history.length})`)}
                </button>

                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    type="button"
                    className="filter-button"
                    onClick={onClose}
                    disabled={isSubmitting}
                  >
                    {t("common.close")}
                  </button>
                  <button
                    type="submit"
                    className="primary-button"
                    disabled={isSubmitting}
                  >
                    {isSubmitting
                      ? (language === "id" ? "Menerapkan..." : "Applying...")
                      : (language === "id" ? "Terapkan Kebijakan Baru" : "Apply New Policy")}
                  </button>
                </div>
              </div>
            </form>

            {/* Policy History Log */}
            {showHistory && (
              <div
                style={{
                  marginTop: "20px",
                  borderTop: "1px solid var(--line)",
                  paddingTop: "14px",
                }}
              >
                <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", marginBottom: "8px" }}>
                  {language === "id" ? "RIWAYAT KEBIJAKAN KOMPENSASI" : "COMPENSATION POLICY HISTORY"}
                </div>

                {history.length === 0 ? (
                  <div style={{ fontSize: "11px", color: "var(--muted)" }}>
                    {language === "id" ? "Belum ada riwayat perubahan kebijakan." : "No recorded policy transitions."}
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {history.map((h) => {
                      const fromStr = h.effective_from ? h.effective_from.split("T")[0] : ""
                      const toStr = h.effective_to ? h.effective_to.split("T")[0] : (language === "id" ? "Sekarang" : "Present")
                      const isCurrent = !h.effective_to

                      return (
                        <div
                          key={h.id}
                          style={{
                            background: isCurrent ? "var(--white)" : "var(--paper)",
                            border: `1px solid ${isCurrent ? "var(--ink)" : "var(--line)"}`,
                            padding: "10px",
                            fontSize: "11px",
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                            <strong>{formatModelBadge(h.model)}</strong>
                            <span style={{ color: "var(--muted)" }}>
                              {fromStr} → {toStr}
                            </span>
                          </div>
                          <div style={{ color: "var(--ink)" }}>{formatPolicyDetails(h)}</div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
