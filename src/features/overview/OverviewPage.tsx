import React, { useState, useEffect, useCallback, useMemo } from "react"
import { Badge } from "../../components/ui/Badge"
import { Icon } from "../../components/ui/Icon"
import { Button } from "../../components/ui/Button"
import {
  overviewApi,
  queueApi,
  appointmentApi,
  staffApi,
  shopApi,
  type ShopOverview,
  type ApiQueueEntry,
  type ApiAppointment,
  type StaffItem,
  type ShopHour,
  ApiError,
} from "../../lib/api"
import {
  formatRupiah,
  formatMinutesAgo,
  getInitials,
  getDateStringInTimezone,
  getDayOfWeekInTimezone,
} from "../../lib/format"
import { Chair } from "./Chair"
import { useI18n } from "../../lib/i18n"
import { cn } from "../../lib/utils"

interface OverviewPageProps {
  onSchedule: () => void
  onQueue: () => void
  onNew: () => void
}

export function OverviewPage({
  onSchedule,
  onQueue,
  onNew,
}: OverviewPageProps) {
  const { t, language } = useI18n()
  const [overview, setOverview] = useState<ShopOverview | null>(null)
  const [queue, setQueue] = useState<ApiQueueEntry[]>([])
  const [appointments, setAppointments] = useState<ApiAppointment[]>([])
  const [staff, setStaff] = useState<StaffItem[]>([])
  const [hours, setHours] = useState<ShopHour[]>([])

  const [timezone, setTimezone] = useState("Asia/Jakarta")
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const todayStr = useMemo(
    () => getDateStringInTimezone(new Date(), timezone),
    [timezone]
  )

  const loadDashboardData = useCallback(async () => {
    setIsLoading(true)
    setErrorMessage(null)

    try {
      const [shopRes, overviewRes, queueRes, apptsRes, staffRes, hoursRes] =
        await Promise.all([
          shopApi.get().catch(() => null),
          overviewApi.get(todayStr).catch(() => null),
          queueApi.list().catch(() => ({ queue: [] })),
          appointmentApi.list(todayStr, todayStr, undefined, false).catch(() => ({ appointments: [] })),
          staffApi.list(true).catch(() => ({ staff: [] })),
          shopApi.getHours().catch(() => ({ hours: [] })),
        ])

      if (shopRes?.shop?.timezone && shopRes.shop.timezone !== timezone) {
        setTimezone(shopRes.shop.timezone)
      }

      setOverview(overviewRes)
      setQueue(queueRes.queue || [])
      setAppointments(apptsRes.appointments || [])
      setStaff(staffRes.staff || [])
      setHours(hoursRes.hours || [])
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message || `Failed to load overview data (${err.code})`)
      } else if (err instanceof Error) {
        setErrorMessage(err.message)
      } else {
        setErrorMessage(
          language === "id"
            ? "Kesalahan jaringan saat memuat dasbor."
            : "Network error loading dashboard."
        )
      }
    } finally {
      setIsLoading(false)
    }
  }, [todayStr, language])

  useEffect(() => {
    loadDashboardData()
  }, [loadDashboardData])

  // Waiting queue entries
  const waitingQueue = useMemo(
    () => queue.filter((q) => q.status === "waiting"),
    [queue]
  )

  // In-service queue entries
  const servingQueue = useMemo(
    () => queue.filter((q) => q.status === "in_service"),
    [queue]
  )

  // Checked-in (in chair) appointments
  const inChairAppts = useMemo(
    () => appointments.filter((a) => a.status === "checked_in"),
    [appointments]
  )

  // Calculate shop open status for today
  const todayDayOfWeek = getDayOfWeekInTimezone(new Date(), timezone)
  const todayHours = hours.find((h) => h.day_of_week === todayDayOfWeek)
  const isShopOpenToday = todayHours ? todayHours.is_open : true
  const closingTimeFormatted = todayHours?.close_time
    ? todayHours.close_time.slice(0, 5)
    : "21:00"

  // Average ticket
  const avgTicket = overview?.average_ticket ?? 0

  // Total appointments
  const totalAppointments = overview
    ? overview.scheduled_count + overview.checked_in_count + overview.completed_count
    : appointments.length
  const completedAppointments = overview?.completed_count ?? 0
  const remainingAppointments = overview
    ? overview.scheduled_count + overview.checked_in_count
    : Math.max(0, appointments.length - completedAppointments)

  // Total walk-ins
  const totalWalkins = overview
    ? overview.queue_waiting_count + overview.queue_serving_count
    : queue.length
  const waitingWalkins = overview?.queue_waiting_count ?? waitingQueue.length

  return (
    <div className="overview-layout grid grid-cols-1 xl:grid-cols-[minmax(0,1.65fr)_minmax(300px,0.75fr)] gap-4.5 items-start">
      <section className="today-panel bg-ivory-light border border-stone p-5 sm:p-6 rounded-lg">
        <div className="section-head flex items-center justify-between gap-4 mb-4">
          <div className="flex items-baseline gap-3">
            <span className="section-index text-2xs font-mono font-bold text-copper uppercase tracking-wider">01</span>
            <h2 className="font-serif text-2xl sm:text-[26px] text-charcoal leading-tight m-0">
              {language === "id" ? "Sekilas Hari Ini" : "Today at a glance"}
            </h2>
          </div>
          <Badge tone={isShopOpenToday ? "success" : "neutral"}>
            {isShopOpenToday
              ? language === "id"
                ? `Buka · hingga ${closingTimeFormatted}`
                : `Open · until ${closingTimeFormatted}`
              : language === "id"
                ? "Tutup hari ini"
                : "Closed today"}
          </Badge>
        </div>

        {errorMessage && (
          <div
            className="login-error-alert bg-danger-soft border border-danger-line text-danger px-3.5 py-2.5 rounded-sm text-xs flex items-center gap-2 mb-4 leading-normal"
            role="alert"
          >
            <Icon name="bell" size={16} />
            <span className="flex-1">{errorMessage}</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs h-7 ml-auto"
              onClick={loadDashboardData}
            >
              {t("common.retry")}
            </Button>
          </div>
        )}

        <div className="pulse-row grid grid-cols-2 md:grid-cols-[1.5fr_repeat(3,1fr)] border border-stone my-5 sm:my-6 rounded-sm bg-ivory-light overflow-hidden">
          <div className="pulse-feature p-4 sm:p-5 border-r border-b md:border-b-0 border-stone">
            <span className="label text-[9px] uppercase tracking-widest text-muted-text font-bold block mb-1">{t("money.netRevenue")}</span>
            <strong className="font-serif text-2xl sm:text-3xl text-charcoal block leading-tight">{formatRupiah(overview?.net_revenue ?? 0)}</strong>
            <span className="text-2xs text-muted-text mt-1 block">
              {overview?.completed_jobs ?? completedAppointments}{" "}
              {language === "id" ? "layanan selesai hari ini" : "completed services today"}
            </span>
          </div>

          <div className="pulse-stat p-4 sm:p-5 border-stone border-b md:border-b-0 max-md:border-r-0 md:border-r">
            <span className="label text-[9px] uppercase tracking-widest text-muted-text font-bold block mb-1">{t("nav.appointments")}</span>
            <strong className="font-serif text-xl sm:text-2xl text-charcoal block leading-tight">
              {completedAppointments}
              <em className="text-stone-muted not-italic text-sm"> / {totalAppointments}</em>
            </strong>
            <small className="text-2xs text-muted-text mt-1 block">
              {remainingAppointments} {language === "id" ? "tersisa hari ini" : "remaining today"}
            </small>
          </div>

          <div className="pulse-stat p-4 sm:p-5 border-r border-stone">
            <span className="label text-[9px] uppercase tracking-widest text-muted-text font-bold block mb-1">{t("shell.walkin")}</span>
            <strong className="font-serif text-xl sm:text-2xl text-charcoal block leading-tight">{totalWalkins}</strong>
            <small className="text-2xs text-muted-text mt-1 block">
              {waitingWalkins} {language === "id" ? "sedang menunggu" : "currently waiting"}
            </small>
          </div>

          <div className="pulse-stat p-4 sm:p-5">
            <span className="label text-[9px] uppercase tracking-widest text-muted-text font-bold block mb-1">{language === "id" ? "Rata-rata Transaksi" : "Avg. ticket"}</span>
            <strong className="font-serif text-xl sm:text-2xl text-charcoal block leading-tight">{formatRupiah(avgTicket)}</strong>
            <small className="text-2xs text-muted-text mt-1 block">{language === "id" ? "Per layanan selesai" : "Per completed chair"}</small>
          </div>
        </div>

        <div className="section-head schedule-title border-t border-stone pt-5 mt-6 flex items-center justify-between gap-4">
          <div className="flex items-baseline gap-3">
            <span className="section-index text-2xs font-mono font-bold text-copper uppercase tracking-wider">02</span>
            <h2 className="font-serif text-2xl sm:text-[26px] text-charcoal leading-tight m-0">{t("overview.liveChairs")}</h2>
          </div>
          <button
            type="button"
            className="text-button inline-flex items-center gap-1.5 text-xs font-semibold text-charcoal hover:text-copper transition-colors cursor-pointer bg-transparent border-0 p-0"
            onClick={onSchedule}
          >
            {t("overview.schedule")} <Icon name="chevron" size={14} />
          </button>
        </div>

        <div className="chair-list mt-2.5">
          {isLoading ? (
            <div className="py-8 text-center text-muted-text text-xs">
              {t("common.loading")}
            </div>
          ) : staff.length === 0 ? (
            <div className="py-8 px-4 text-center text-muted-text text-xs border-b border-stone">
              {language === "id"
                ? "Tidak ada kapster aktif. Tambahkan staf di menu Tim atau Pengaturan."
                : "No active barbers in staff roster. Add barbers under Team or Settings."}
            </div>
          ) : (
            staff.map((barber) => {
              // 1. Check if barber is currently serving a walk-in
              const activeWalkIn = servingQueue.find(
                (q) => q.assigned_staff_id === barber.id
              )

              // 2. Check if barber is currently serving a checked-in appointment
              const activeAppt = inChairAppts.find(
                (a) => a.staff_id === barber.id
              )

              const activeJob = activeWalkIn || activeAppt
              const isFree = !activeJob

              let clientName = t("overview.chairAvailable")
              let serviceName =
                language === "id"
                  ? "Siap untuk walk-in atau reservasi"
                  : "Ready for walk-in or booking"
              let progressPct = 0
              let timeLeft = language === "id" ? "Siap" : "Ready"

              if (activeJob) {
                clientName = activeJob.customer_name
                serviceName = activeJob.service_name || (language === "id" ? "Layanan Grooming" : "Grooming Service")
                const duration = activeJob.duration_snapshot_min || 30

                const startTimeStr =
                  "started_at" in activeJob && activeJob.started_at
                    ? activeJob.started_at
                    : "starts_at" in activeJob
                      ? activeJob.starts_at
                      : activeJob.created_at

                const startMs = new Date(startTimeStr).getTime()
                const elapsedMin = Math.max(0, Math.floor((Date.now() - startMs) / (60 * 1000)))
                progressPct = Math.min(100, Math.round((elapsedMin / duration) * 100))
                const remainingMin = Math.max(1, duration - elapsedMin)
                timeLeft = language === "id" ? `${remainingMin} mnt lagi` : `${remainingMin} min left`
              }

              return (
                <Chair
                  key={barber.id}
                  initials={getInitials(barber.name)}
                  name={barber.name}
                  client={clientName}
                  service={serviceName}
                  time={timeLeft}
                  progress={progressPct}
                  free={isFree}
                  role={barber.contact || t("roles.barber")}
                />
              )
            })
          )}
        </div>
      </section>

      <aside className="side-stack flex flex-col md:grid md:grid-cols-[1.2fr_1fr] xl:flex xl:flex-col gap-3.5">
        <section className="queue-panel bg-ivory-light border border-stone p-5 sm:p-6 rounded-lg flex flex-col">
          <div className="section-head flex items-center justify-between gap-4 mb-3">
            <div className="flex items-baseline gap-3">
              <span className="section-index text-2xs font-mono font-bold text-copper uppercase tracking-wider">03</span>
              <h2 className="font-serif text-2xl text-charcoal leading-tight m-0">{t("overview.queue")}</h2>
            </div>
            <button
              type="button"
              className="icon-button mini w-7 h-7 rounded-sm border border-stone hover:border-copper hover:bg-ivory flex items-center justify-center text-charcoal transition-colors cursor-pointer"
              onClick={onNew}
              aria-label={t("shell.walkin")}
              title={t("shell.walkin")}
            >
              <Icon name="plus" size={16} />
            </button>
          </div>

          <div className="wait-callout flex justify-between items-center bg-charcoal text-white my-3 px-3.5 py-2.5 text-xs rounded-sm">
            <span>
              <b className="text-copper-soft">{waitingQueue.length}</b> {t("operations.waiting")}
            </span>
            <span>
              {language === "id" ? "Di kursi" : "In chairs"} <b className="text-copper-soft">{servingQueue.length}</b>
            </span>
          </div>

          {isLoading ? (
            <div className="py-6 text-center text-muted-text text-xs">
              {t("common.loading")}
            </div>
          ) : waitingQueue.length === 0 ? (
            <div className="py-6 px-3 text-center text-muted-text text-xs">
              {t("overview.emptyQueue")}
            </div>
          ) : (
            waitingQueue.slice(0, 5).map((item, index) => {
              const waitTime = formatMinutesAgo(item.arrived_at, language)

              return (
                <div className="queue-mini flex items-center gap-2.5 min-h-[52px] border-b border-stone py-2 last:border-b-0" key={item.id}>
                  <span className="queue-no font-serif text-sm text-muted-text w-5">0{index + 1}</span>
                  <span className="avatar w-7 h-7 rounded-full bg-charcoal text-ivory flex items-center justify-center text-xs font-semibold shrink-0">
                    {getInitials(item.customer_name)}
                  </span>
                  <div className="grow min-w-0">
                    <strong className="block text-xs font-semibold text-charcoal truncate">{item.customer_name}</strong>
                    <small className="block text-2xs text-muted-text mt-0.5 truncate">
                      {item.service_name || (language === "id" ? "Cukur Rambut" : "Haircut")}
                    </small>
                  </div>
                  <span className="wait text-xs text-copper font-bold whitespace-nowrap">{waitTime}</span>
                </div>
              )
            })
          )}

          <button
            type="button"
            className="wide-button w-full py-2.5 px-3 bg-ivory border border-stone rounded-sm hover:border-copper hover:bg-ivory-warm text-xs font-semibold text-charcoal flex items-center justify-between cursor-pointer transition-all mt-4"
            onClick={onQueue}
          >
            <span>{language === "id" ? "Kelola antrean" : "Manage queue"}</span>
            <Icon name="arrow" size={16} />
          </button>
        </section>

        <section className="payments-strip border border-stone grid grid-cols-[1fr_1fr_auto] p-3.5 bg-ivory-light rounded-sm items-center gap-3">
          <div className="border-r border-stone pr-3">
            <span className="block text-2xs text-muted-text uppercase tracking-wider font-semibold">{t("payment.transfer")}</span>
            <strong className="block font-serif text-base text-charcoal mt-0.5">{formatRupiah(overview?.net_transfer ?? 0)}</strong>
          </div>
          <div className="border-r border-stone pr-3">
            <span className="block text-2xs text-muted-text uppercase tracking-wider font-semibold">{t("payment.cash")}</span>
            <strong className="block font-serif text-base text-charcoal mt-0.5">{formatRupiah(overview?.net_cash ?? 0)}</strong>
          </div>
          <button
            type="button"
            className="p-1.5 text-muted-text hover:text-charcoal transition-colors cursor-pointer bg-transparent border-0"
            aria-label="Refresh financial overview"
            title="Refresh overview metrics"
            onClick={loadDashboardData}
          >
            <Icon name="more" size={16} />
          </button>
        </section>
      </aside>
    </div>
  )
}
