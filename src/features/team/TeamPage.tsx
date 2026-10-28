import React, { useState, useEffect, useCallback } from "react"
import { staffApi, type StaffItem, ApiError } from "../../lib/api"
import { Badge } from "../../components/ui/Badge"
import { Icon } from "../../components/ui/Icon"
import { Toast } from "../../components/layout/Toast"
import { getInitials } from "../../lib/format"
import { TeamSchedule } from "./TeamSchedule"
import { StaffModal } from "./StaffModal"
import { BarberCompensationModal } from "./BarberCompensationModal"

export function TeamPage() {
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
          <span className="section-index">STAFF ROSTER</span>
          <h2 style={{ font: "28px var(--serif)", margin: "4px 0 0" }}>Team Members</h2>
        </div>
        <button
          type="button"
          className="primary-button"
          onClick={() => {
            setStaffToEdit(null)
            setIsStaffModalOpen(true)
          }}
        >
          <Icon name="plus" size={14} /> Add staff member
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
            Retry
          </button>
        </div>
      )}

      {isLoading ? (
        <div style={{ padding: "64px 0", textAlign: "center", color: "var(--muted)", fontSize: "12px" }}>
          Loading team roster from server...
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
          <h3 style={{ font: "22px var(--serif)", margin: "0 0 8px" }}>No staff members found</h3>
          <p style={{ color: "var(--muted)", fontSize: "12px", margin: "0 0 20px" }}>
            Add your barbers and staff to assign them appointments, walk-in clients, and track commissions.
          </p>
          <button
            type="button"
            className="primary-button"
            onClick={() => {
              setStaffToEdit(null)
              setIsStaffModalOpen(true)
            }}
          >
            + Add first staff member
          </button>
        </div>
      ) : (
        <div className="team-grid">
          {staffList.map((st, i) => {
            const initials = getInitials(st.name)
            const commissionLabel =
              st.commission_bps != null
                ? `${st.commission_bps / 100}% commission`
                : "Standard rate"

            return (
              <article className="team-card" key={st.id}>
                <div className="team-top">
                  <span className={`avatar portrait p${i % 4}`}>{initials}</span>
                  <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                    <Badge tone={st.active ? "success" : "neutral"}>
                      {st.active ? "Active" : "Inactive"}
                    </Badge>
                    <button
                      type="button"
                      className="icon-button mini"
                      aria-label={`Edit ${st.name}`}
                      title="Edit staff details"
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
                <p>{st.contact || "Staff Barber"}</p>

                <div className="team-stats">
                  <span>
                    <small>STATUS</small>
                    <strong style={{ fontSize: "11px" }}>{st.active ? "Available" : "Off Duty"}</strong>
                  </span>
                  <span>
                    <small>COMMISSION</small>
                    <strong style={{ fontSize: "11px" }}>{commissionLabel}</strong>
                  </span>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginTop: "12px" }}>
                  <button
                    className="filter-button"
                    style={{ fontSize: "11px", padding: "8px 6px", justifyContent: "center" }}
                    onClick={() => setStaffForCompensation(st)}
                  >
                    Compensation
                  </button>
                  <button
                    className="wide-button"
                    style={{ margin: 0, justifyContent: "center" }}
                    onClick={() => setSelectedStaffForSchedule(st)}
                  >
                    Schedule <Icon name="arrow" size={15} />
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
