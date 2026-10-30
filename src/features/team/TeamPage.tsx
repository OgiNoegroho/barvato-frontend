import React, { useState, useEffect, useCallback } from "react"
import {
  staffApi,
  type StaffItem,
  type StaffHour,
  type StaffException,
  ApiError,
} from "../../lib/api"
import { Badge } from "../../components/ui/Badge"
import { Icon } from "../../components/ui/Icon"
import { Button } from "../../components/ui/Button"
import { getInitials } from "../../lib/format"
import { TeamSchedule } from "./TeamSchedule"
import { StaffModal } from "./StaffModal"
import { BarberCompensationModal } from "./BarberCompensationModal"
import { useI18n } from "../../lib/i18n"
import { useToast } from "../../hooks/useToast"
import { cn } from "../../lib/utils"

export function TeamPage() {
  const { t, language } = useI18n()
  const [staffList, setStaffList] = useState<StaffItem[]>([])
  const [staffHours, setStaffHours] = useState<StaffHour[]>([])
  const [todayExceptions, setTodayExceptions] = useState<StaffException[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const [selectedStaffForSchedule, setSelectedStaffForSchedule] = useState<{
    staff: StaffItem
    tab: "agenda" | "weekly" | "exceptions"
  } | null>(null)
  const [staffForCompensation, setStaffForCompensation] = useState<StaffItem | null>(null)
  const [staffToEdit, setStaffToEdit] = useState<StaffItem | null>(null)
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false)
  const toast = useToast()

  const loadStaff = useCallback(async () => {
    setIsLoading(true)
    setErrorMessage(null)
    const todayStr = new Date().toISOString().slice(0, 10)
    try {
      const [res, hoursRes, excRes] = await Promise.all([
        staffApi.list(false),
        staffApi.getAllHours().catch(() => ({ staff_hours: [] })),
        staffApi.listAllExceptions({ from: todayStr, to: todayStr }).catch(() => ({ exceptions: [] })),
      ])
      setStaffList(res.staff || [])
      setStaffHours(hoursRes.staff_hours || [])
      setTodayExceptions(excRes.exceptions || [])
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

  const todayDow = new Date().getDay()

  return (
    <>
      <div className="flex justify-between items-center mb-5">
        <div>
          <span className="section-index text-2xs font-mono font-bold text-copper uppercase tracking-wider block mb-1">
            {t("team.rosterTab").toUpperCase()}
          </span>
          <h2 className="font-serif text-2xl sm:text-[28px] text-charcoal m-0 leading-tight">
            {t("team.title")}
          </h2>
        </div>
        <Button
          type="button"
          variant="primary"
          onClick={() => {
            setStaffToEdit(null)
            setIsStaffModalOpen(true)
          }}
          className="gap-1.5"
        >
          <Icon name="plus" size={14} /> {t("team.addStaff")}
        </Button>
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
            onClick={loadStaff}
          >
            {t("common.retry")}
          </Button>
        </div>
      )}

      {isLoading ? (
        <div className="py-16 text-center text-muted-text text-xs">
          {t("common.loading")}
        </div>
      ) : staffList.length === 0 && !errorMessage ? (
        <div className="py-12 px-6 text-center bg-ivory-light border border-stone rounded-sm">
          <h3 className="font-serif text-xl text-charcoal m-0 mb-2">
            {language === "id" ? "Belum ada anggota tim" : "No staff members found"}
          </h3>
          <p className="text-xs text-muted-text m-0 mb-5 max-w-md mx-auto leading-relaxed">
            {language === "id"
              ? "Tambahkan kapster dan staf untuk menugaskan janji temu, walk-in, serta melacak komisi."
              : "Add your barbers and staff to assign them appointments, walk-in clients, and track commissions."}
          </p>
          <Button
            type="button"
            variant="primary"
            onClick={() => {
              setStaffToEdit(null)
              setIsStaffModalOpen(true)
            }}
          >
            + {t("team.addStaff")}
          </Button>
        </div>
      ) : (
        <div className="team-grid grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3.5">
          {staffList.map((st, i) => {
            const initials = getInitials(st.name)
            const commissionLabel =
              st.commission_bps != null
                ? `${st.commission_bps / 100}% ${language === "id" ? "komisi" : "commission"}`
                : language === "id"
                ? "Tarif standar"
                : "Standard rate"

            const todayExc = todayExceptions.find((e) => e.staff_id === st.id)
            const todayHour = staffHours.find((h) => h.staff_id === st.id && h.day_of_week === todayDow)

            let todayStatusText = st.active
              ? t("overview.chairAvailable")
              : language === "id"
              ? "Nonaktif"
              : "Inactive"
            let statusToneClass: string = "text-charcoal"

            if (st.active) {
              if (todayExc) {
                if (!todayExc.is_working) {
                  todayStatusText = todayExc.reason
                    ? `${t("calendar.staffLeaveBadge")} (${todayExc.reason})`
                    : t("calendar.staffLeaveBadge")
                  statusToneClass = "text-danger"
                } else if (todayExc.open_time && todayExc.close_time) {
                  todayStatusText = `${todayExc.open_time.slice(0, 5)}–${todayExc.close_time.slice(0, 5)}`
                  statusToneClass = "text-amber"
                }
              } else if (todayHour) {
                if (!todayHour.is_working) {
                  todayStatusText = t("calendar.staffDayOffBadge")
                  statusToneClass = "text-danger"
                } else {
                  todayStatusText = `${todayHour.open_time.slice(0, 5)}–${todayHour.close_time.slice(0, 5)}`
                }
              }
            }

            return (
              <article className="team-card border border-stone border-t-2 border-t-charcoal bg-ivory-light p-4.5 rounded-sm flex flex-col justify-between shadow-subtle" key={st.id}>
                <div>
                  <div className="team-top flex justify-between items-start mb-3">
                    <span className={cn("avatar portrait w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold text-white", `bg-charcoal`)}>
                      {initials}
                    </span>
                    <div className="flex gap-1.5 items-center">
                      <Badge tone={st.active ? "success" : "neutral"}>
                        {st.active ? t("common.active") : t("common.inactive")}
                      </Badge>
                      <button
                        type="button"
                        className="icon-button mini w-7 h-7 rounded-sm border border-stone hover:border-copper hover:bg-ivory flex items-center justify-center text-charcoal transition-colors cursor-pointer"
                        aria-label={`${t("common.edit")} ${st.name}`}
                        title={t("team.editStaff")}
                        onClick={() => {
                          setStaffToEdit(st)
                          setIsStaffModalOpen(true)
                        }}
                      >
                        <Icon name="more" size={14} />
                      </button>
                    </div>
                  </div>

                  <h2 className="font-serif text-xl text-charcoal m-0 mb-1 leading-tight">{st.name}</h2>
                  <p className="text-2xs text-muted-text m-0">{st.contact || t("roles.barber")}</p>

                  <div className="team-stats grid grid-cols-2 border-t border-stone mt-4 pt-3 gap-2">
                    <div>
                      <small className="block text-[7px] text-muted-text tracking-widest uppercase">{t("common.status")}</small>
                      <strong className={cn("block text-xs font-semibold mt-1", statusToneClass)}>
                        {todayStatusText}
                      </strong>
                    </div>
                    <div>
                      <small className="block text-[7px] text-muted-text tracking-widest uppercase">{t("team.commissionRate")}</small>
                      <strong className="block text-xs font-semibold text-charcoal mt-1">{commissionLabel}</strong>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-2">
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs h-8 px-2 justify-center"
                      onClick={() => setStaffForCompensation(st)}
                    >
                      {language === "id" ? "Kompensasi" : "Compensation"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs h-8 px-2 justify-center"
                      onClick={() => setSelectedStaffForSchedule({ staff: st, tab: "exceptions" })}
                    >
                      {t("availability.tabExceptions")}
                    </Button>
                  </div>

                  <Button
                    variant="secondary"
                    size="sm"
                    className="w-full mt-2 justify-center gap-1.5 h-8 text-xs font-medium"
                    onClick={() => setSelectedStaffForSchedule({ staff: st, tab: "agenda" })}
                  >
                    <span>{t("overview.schedule")}</span>
                    <Icon name="arrow" size={14} />
                  </Button>
                </div>
              </article>
            )
          })}
        </div>
      )}

      {selectedStaffForSchedule && (
        <TeamSchedule
          staff={selectedStaffForSchedule.staff}
          initialTab={selectedStaffForSchedule.tab}
          onClose={() => setSelectedStaffForSchedule(null)}
          onUpdated={(msg) => {
            if (msg) toast.success(msg)
            loadStaff()
          }}
        />
      )}

      {staffForCompensation && (
        <BarberCompensationModal
          staff={staffForCompensation}
          onClose={() => setStaffForCompensation(null)}
          onSuccess={(msg) => {
            toast.success(msg)
            loadStaff()
          }}
        />
      )}

      {isStaffModalOpen && (
        <StaffModal
          staff={staffToEdit}
          onClose={() => setIsStaffModalOpen(false)}
          onSuccess={(msg) => {
            toast.success(msg)
            loadStaff()
          }}
        />
      )}
    </>
  )
}
