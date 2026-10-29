import React, { useState, useEffect, useCallback } from "react"
import { staffApi, type StaffItem, ApiError } from "../../lib/api"
import { Badge } from "../../components/ui/Badge"
import { Icon } from "../../components/ui/Icon"
import { Toast } from "../../components/layout/Toast"
import { getInitials } from "../../lib/format"
import { TeamSchedule } from "./TeamSchedule"
import { StaffModal } from "./StaffModal"
import { BarberCompensationModal } from "./BarberCompensationModal"
import { useI18n } from "../../lib/i18n"

export function TeamPage() {
  const { t, language } = useI18n()
  const [staffList, setStaffList] = useState<StaffItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const [selectedStaffForSchedule, setSelectedStaffForSchedule] = useState<StaffItem | null>(null)
  const [staffForCompensation, setStaffForCompensation] = useState<StaffItem | null>(null)
  const [staffToEdit, setStaffToEdit] = useState<StaffItem | null>(null)
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg)
    const timer = setTimeout(() => setToastMessage(null), 3500)
    return () => clearTimeout(timer)
  }, [])

  const loadStaff = useCallback(async () => {
    setIsLoading(true)
    setErrorMessage(null)
    try {
      const res = await staffApi.list(false)
      setStaffList(res.staff || [])
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message || `Failed to load team roster (${err.code})`)
      } else if (err instanceof Error) {
        setErrorMessage(err.message)
      } else {
        setErrorMessage("Failed to load staff list. Please check your network connection.")
      }
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadStaff()
  }, [loadStaff])

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <div>
          <span className="section-index">{t("team.rosterTab").toUpperCase()}</span>
          <h2 style={{ font: "28px var(--serif)", margin: "4px 0 0" }}>{t("team.title")}</h2>
        </div>
        <button
          type="button"
          className="primary-button"
          onClick={() => {
            setStaffToEdit(null)
            setIsStaffModalOpen(true)
          }}
        >
          <Icon name="plus" size={14} /> {t("team.addStaff")}
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
            onClick={loadStaff}
          >
            {t("common.retry")}
          </button>
        </div>
      )}

      {isLoading ? (
        <div style={{ padding: "64px 0", textAlign: "center", color: "var(--muted)", fontSize: "12px" }}>
          {t("common.loading")}
        </div>
      ) : staffList.length === 0 && !errorMessage ? (
        <div
          style={{
            padding: "48px 24px",
            textAlign: "center",
            background: "var(--paper)",
            border: "1px solid var(--line)",
          }}
        >
          <h3 style={{ font: "22px var(--serif)", margin: "0 0 8px" }}>
            {language === "id" ? "Belum ada anggota tim" : "No staff members found"}
          </h3>
          <p style={{ color: "var(--muted)", fontSize: "12px", margin: "0 0 20px" }}>
            {language === "id"
              ? "Tambahkan kapster dan staf untuk menugaskan janji temu, walk-in, serta melacak komisi."
              : "Add your barbers and staff to assign them appointments, walk-in clients, and track commissions."}
          </p>
          <button
            type="button"
            className="primary-button"
            onClick={() => {
              setStaffToEdit(null)
              setIsStaffModalOpen(true)
            }}
          >
            + {t("team.addStaff")}
          </button>
        </div>
      ) : (
        <div className="team-grid">
          {staffList.map((st, i) => {
            const initials = getInitials(st.name)
            const commissionLabel =
              st.commission_bps != null
                ? `${st.commission_bps / 100}% ${language === "id" ? "komisi" : "commission"}`
                : language === "id"
                ? "Tarif standar"
                : "Standard rate"

            return (
              <article className="team-card" key={st.id}>
                <div className="team-top">
                  <span className={`avatar portrait p${i % 4}`}>{initials}</span>
                  <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                    <Badge tone={st.active ? "success" : "neutral"}>
                      {st.active ? t("common.active") : t("common.inactive")}
                    </Badge>
                    <button
                      type="button"
                      className="icon-button mini"
                      aria-label={`${t("common.edit")} ${st.name}`}
                      title={t("team.editStaff")}
                      onClick={() => {
                        setStaffToEdit(st)
                        setIsStaffModalOpen(true)
                      }}
                    >
                      <Icon name="more" />
                    </button>
                  </div>
                </div>

                <h2>{st.name}</h2>
                <p>{st.contact || t("roles.barber")}</p>

                <div className="team-stats">
                  <span>
                    <small>{t("common.status").toUpperCase()}</small>
                    <strong style={{ fontSize: "11px" }}>
                      {st.active
                        ? t("overview.chairAvailable")
                        : language === "id"
                        ? "Libur"
                        : "Off Duty"}
                    </strong>
                  </span>
                  <span>
                    <small>{t("team.commissionRate").toUpperCase()}</small>
                    <strong style={{ fontSize: "11px" }}>{commissionLabel}</strong>
                  </span>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginTop: "12px" }}>
                  <button
                    className="filter-button"
                    style={{ fontSize: "11px", padding: "8px 6px", justifyContent: "center" }}
                    onClick={() => setStaffForCompensation(st)}
                  >
                    {language === "id" ? "Kompensasi" : "Compensation"}
                  </button>
                  <button
                    className="wide-button"
                    style={{ margin: 0, justifyContent: "center" }}
                    onClick={() => setSelectedStaffForSchedule(st)}
                  >
                    {t("overview.schedule")} <Icon name="arrow" size={15} />
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      )}

      {selectedStaffForSchedule && (
        <TeamSchedule
          staff={selectedStaffForSchedule}
          onClose={() => setSelectedStaffForSchedule(null)}
        />
      )}

      {staffForCompensation && (
        <BarberCompensationModal
          staff={staffForCompensation}
          onClose={() => setStaffForCompensation(null)}
          onSuccess={(msg) => {
            showToast(msg)
            loadStaff()
          }}
        />
      )}

      {isStaffModalOpen && (
        <StaffModal
          staff={staffToEdit}
          onClose={() => setIsStaffModalOpen(false)}
          onSuccess={(msg) => {
            showToast(msg)
            loadStaff()
          }}
        />
      )}

      {toastMessage && <Toast message={toastMessage} />}
    </>
  )
}
