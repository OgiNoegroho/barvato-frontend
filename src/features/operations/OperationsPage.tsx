import { useState, useEffect, useCallback, useMemo } from "react"
import {
  queueApi,
  appointmentApi,
  staffApi,
  shopApi,
  ApiError,
  type ApiQueueEntry,
  type ApiAppointment,
  type StaffItem,
  type ShopHour,
  type ShopClosure,
  type StaffHour,
  type StaffException,
} from "../../lib/api"
import {
  formatRupiah,
  formatPeriodLabel,
  getDateStringInTimezone,
  getWeekRange,
  getMonthRange,
} from "../../lib/format"
import { getBookingConflictReason } from "../../lib/timeline"
import { Icon } from "../../components/ui/Icon"
import { OpsToolbar } from "./OpsToolbar"
import { OpsCalendar } from "./OpsCalendar"
import { QueuePanel } from "./QueuePanel"
import { AppointmentDrawer } from "./AppointmentDrawer"
import { TeamSchedule } from "../team/TeamSchedule"
import { CheckoutModal } from "../../components/CheckoutModal"
import { useI18n } from "../../lib/i18n"
import { useToast } from "../../hooks/useToast"

interface OperationsPageProps {
  onWalkin: () => void
  onAppointment: (initialDate?: string) => void
  notify?: (message: string) => void
  targetAppointmentId?: number | null
  targetQueueId?: number | null
  targetDate?: string | null
  onClearTarget?: () => void
}

export function OperationsPage({
  onWalkin,
  onAppointment,
  targetAppointmentId,
  targetQueueId,
  targetDate,
  onClearTarget,
}: OperationsPageProps) {
  const { t, language } = useI18n()
  const toast = useToast()
  const [view, setView] = useState("Day")
  const [currentDate, setCurrentDate] = useState<Date>(() => new Date())
  const [timezone, setTimezone] = useState("Asia/Jakarta")
  const [shopHours, setShopHours] = useState<ShopHour[]>([])
  const [shopClosures, setShopClosures] = useState<ShopClosure[]>([])
  const [staffHours, setStaffHours] = useState<StaffHour[]>([])
  const [staffExceptions, setStaffExceptions] = useState<StaffException[]>([])
  const [scheduleStaff, setScheduleStaff] = useState<StaffItem | null>(null)

  const [collapsed, setCollapsed] = useState(false)
  const [selectedQueueId, setSelectedQueueId] = useState<number | null>(null)
  const [detail, setDetail] = useState<ApiAppointment | null>(null)

  // Filters
  const [barberFilter, setBarberFilter] = useState<number | "all">("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState<string>("")

  // Real backend domain state
  const [queueItems, setQueueItems] = useState<ApiQueueEntry[]>([])
  const [completedQueue, setCompletedQueue] = useState<ApiQueueEntry[]>([])
  const [appointments, setAppointments] = useState<ApiAppointment[]>([])
  const [staffList, setStaffList] = useState<StaffItem[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Checkout modal state
  const [checkoutTarget, setCheckoutTarget] = useState<{
    id: number
    kind: "queue" | "appointment"
    customerName: string
    serviceName: string
    price: number
    staffName?: string
  } | null>(null)

  // Handle external navigation targets (e.g. from notification clicks)
  useEffect(() => {
    if (targetAppointmentId) {
      appointmentApi
        .get(targetAppointmentId)
        .then((res) => {
          if (res.appointment) {
            setDetail(res.appointment)
            const apptDate = new Date(res.appointment.starts_at)
            if (!isNaN(apptDate.getTime())) {
              setCurrentDate(apptDate)
            }
          }
        })
        .catch(() => { })
      onClearTarget?.()
    }
  }, [targetAppointmentId, onClearTarget])

  useEffect(() => {
    if (targetQueueId) {
      setSelectedQueueId(targetQueueId)
      setCollapsed(false)
      onClearTarget?.()
    }
  }, [targetQueueId, onClearTarget])

  useEffect(() => {
    if (targetDate && !targetAppointmentId) {
      const parsed = targetDate.includes("T")
        ? new Date(targetDate)
        : new Date(`${targetDate}T12:00:00Z`)
      if (!isNaN(parsed.getTime())) {
        setCurrentDate(parsed)
      }
      onClearTarget?.()
    }
  }, [targetDate, targetAppointmentId, onClearTarget])

  // Fetch shop profile (timezone) and business hours on mount
  useEffect(() => {
    Promise.all([
      shopApi.get().catch(() => null),
      shopApi.getHours().catch(() => ({ hours: [] })),
    ]).then(([shopRes, hoursRes]) => {
      if (shopRes?.shop?.timezone) {
        setTimezone(shopRes.shop.timezone)
      }
      if (hoursRes?.hours) {
        setShopHours(hoursRes.hours)
      }
    })
  }, [])

  const activeLocale = language === "id" ? "id-ID" : "en-US"

  // Calculate API query date range and toolbar label based on view and currentDate
  const { from, to, label } = useMemo(() => {
    if (view === "Month") {
      const { fromStr, toStr } = getMonthRange(currentDate, timezone)
      return {
        from: fromStr,
        to: toStr,
        label: formatPeriodLabel(currentDate, "Month", timezone, activeLocale),
      }
    }
    if (view === "Week") {
      const { start, end } = getWeekRange(currentDate, timezone)
      return {
        from: getDateStringInTimezone(start, timezone),
        to: getDateStringInTimezone(end, timezone),
        label: formatPeriodLabel(currentDate, "Week", timezone, activeLocale),
      }
    }
    // Default "Day" view
    const dayStr = getDateStringInTimezone(currentDate, timezone)
    return {
      from: dayStr,
      to: dayStr,
      label: formatPeriodLabel(currentDate, "Day", timezone, activeLocale),
    }
  }, [currentDate, view, timezone, activeLocale])

  const loadData = useCallback(async () => {
    try {
      const [
        queueRes,
        historyRes,
        apptsRes,
        staffRes,
        closuresRes,
        staffHoursRes,
        staffExcRes,
      ] = await Promise.all([
        queueApi.list().catch(() => ({ queue: [] })),
        queueApi.history(from, to, 200).catch(() => ({ queue_history: [] })),
        appointmentApi.list(from, to).catch(() => ({ appointments: [] })),
        staffApi.list(true).catch(() => ({ staff: [] })),
        shopApi.listClosures().catch(() => ({ closures: [] })),
        staffApi.getAllHours().catch(() => ({ staff_hours: [] })),
        staffApi.listAllExceptions().catch(() => ({ exceptions: [] })),
      ])

      const liveQueue = queueRes.queue || []
      const historyQueue = historyRes.queue_history || []

      // Merge live and historical queue entries without duplicates
      const mergedMap = new Map<number, ApiQueueEntry>()
      for (const item of historyQueue) {
        mergedMap.set(item.id, item)
      }
      // Live records overwrite history to preserve real-time status transitions
      for (const item of liveQueue) {
        mergedMap.set(item.id, item)
      }
      const allQueueItems = Array.from(mergedMap.values())

      setQueueItems(allQueueItems)
      setCompletedQueue(
        allQueueItems.filter((h) => h.status === "completed")
      )
      setAppointments(apptsRes.appointments || [])
      setStaffList(staffRes.staff || [])
      setShopClosures(closuresRes.closures || [])
      setStaffHours(staffHoursRes.staff_hours || [])
      setStaffExceptions(staffExcRes.exceptions || [])
    } finally {
      setIsLoading(false)
    }
  }, [from, to])

  useEffect(() => {
    loadData()
    // Periodic refresh every 15 seconds to keep queue & calendar synced
    const interval = setInterval(loadData, 15000)
    const handleRefresh = () => loadData()
    window.addEventListener("barvato:refresh-data", handleRefresh)
    return () => {
      clearInterval(interval)
      window.removeEventListener("barvato:refresh-data", handleRefresh)
    }
  }, [loadData])

  // Navigation handlers
  function handlePrev() {
    setCurrentDate((prev) => {
      const next = new Date(prev)
      if (view === "Month") {
        next.setMonth(next.getMonth() - 1)
      } else if (view === "Week") {
        next.setDate(next.getDate() - 7)
      } else {
        next.setDate(next.getDate() - 1)
      }
      return next
    })
  }

  function handleNext() {
    setCurrentDate((prev) => {
      const next = new Date(prev)
      if (view === "Month") {
        next.setMonth(next.getMonth() + 1)
      } else if (view === "Week") {
        next.setDate(next.getDate() + 7)
      } else {
        next.setDate(next.getDate() + 1)
      }
      return next
    })
  }

  function handleToday() {
    setCurrentDate(new Date())
  }

  // Filtered appointments & staff
  const filteredAppointments = useMemo(() => {
    return appointments.filter((a) => {
      if (barberFilter !== "all" && a.staff_id !== barberFilter) return false
      if (statusFilter !== "all" && a.status !== statusFilter) return false
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchCustomer = a.customer_name?.toLowerCase().includes(q)
        const matchService = a.service_name?.toLowerCase().includes(q)
        if (!matchCustomer && !matchService) return false
      }
      return true
    })
  }, [appointments, barberFilter, statusFilter, searchQuery])

  const filteredQueueItems = useMemo(() => {
    return queueItems.filter((q) => {
      if (barberFilter !== "all" && q.assigned_staff_id !== barberFilter) return false
      if (statusFilter !== "all") {
        if (statusFilter === "completed" && q.status !== "completed") return false
        if (statusFilter === "in_service" && q.status !== "in_service") return false
        if (statusFilter === "waiting" && q.status !== "waiting") return false
        if (statusFilter === "cancelled" && q.status !== "cancelled") return false
        if (statusFilter === "scheduled" || statusFilter === "checked_in") return false
      }
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase()
        const matchCustomer = q.customer_name?.toLowerCase().includes(query)
        const matchService = q.service_name?.toLowerCase().includes(query)
        if (!matchCustomer && !matchService) return false
      }
      return true
    })
  }, [queueItems, barberFilter, statusFilter, searchQuery])

  const displayedStaffList = useMemo(() => {
    if (barberFilter === "all") return staffList
    return staffList.filter((s) => s.id === barberFilter)
  }, [staffList, barberFilter])

  const waiting = queueItems.filter((item) => item.status === "waiting")
  const inService = queueItems.filter((item) => item.status === "in_service")

  // Queue actions
  async function handleAssign(item: ApiQueueEntry, staffId: number) {
    try {
      await queueApi.assign(item.id, staffId)
      toast.success(`${item.customer_name} assigned to barber`)
      loadData()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to assign barber")
    }
  }

  async function handleStart(item: ApiQueueEntry, override = false) {
    try {
      await queueApi.start(item.id, override)
      setSelectedQueueId(item.id)
      toast.success(`${item.customer_name} is now in service`)
      loadData()
    } catch (err: unknown) {
      if (err instanceof ApiError && err.code === "schedule_conflict") {
        if (
          confirm(
            "Schedule Warning: Starting this walk-in collides with an upcoming appointment for this barber. Override and proceed anyway?"
          )
        ) {
          handleStart(item, true)
        }
      } else {
        toast.error(err instanceof Error ? err.message : "Failed to start service")
      }
    }
  }

  async function handleCancelQueue(item: ApiQueueEntry) {
    try {
      await queueApi.cancel(item.id)
      if (selectedQueueId === item.id) setSelectedQueueId(null)
      toast.success(`${item.customer_name} removed from queue`)
      loadData()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to cancel queue entry")
    }
  }

  // Appointment actions
  async function handleCheckIn(a: ApiAppointment) {
    try {
      await appointmentApi.checkIn(a.id)
      toast.success("Customer checked in successfully")
      setDetail(null)
      loadData()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to check in appointment")
    }
  }

  async function handleCancelAppointment(a: ApiAppointment) {
    try {
      await appointmentApi.cancel(a.id)
      toast.success("Appointment cancelled successfully")
      setDetail(null)
      loadData()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to cancel appointment")
    }
  }

  async function handleNoShow(a: ApiAppointment) {
    try {
      await appointmentApi.noShow(a.id)
      toast.success("Marked as no-show")
      setDetail(null)
      loadData()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to mark as no-show")
    }
  }

  async function handleRescheduleAppointment(
    id: number,
    data: { staff_id: number; starts_at: string; override?: boolean }
  ) {
    try {
      const res = await appointmentApi.update(id, data)
      setDetail(res.appointment)
      toast.success(t("calendar.rescheduleSuccess"))
      loadData()
    } catch (err: unknown) {
      if (err instanceof ApiError && err.code === "schedule_conflict" && !data.override) {
        if (confirm(t("booking.conflictScheduleWarning"))) {
          await handleRescheduleAppointment(id, { ...data, override: true })
          return
        }
      }
      toast.error(err instanceof Error ? err.message : "Failed to reschedule appointment")
      throw err
    }
  }

  const detailConflictReason = useMemo(() => {
    if (!detail) return null
    if (detail.status !== "confirmed" && detail.status !== "checked_in") return null
    return getBookingConflictReason(
      {
        startsAt: detail.starts_at,
        endsAt: detail.ends_at,
        staffId: detail.staff_id,
      },
      {
        timezone,
        shopHours,
        shopClosures,
        staffHours,
        staffExceptions,
      }
    )
  }, [detail, timezone, shopHours, shopClosures, staffHours, staffExceptions])

  // Checkout modal flow
  function openQueueCheckout(item: ApiQueueEntry) {
    const assignedBarber = staffList.find((s) => s.id === item.assigned_staff_id)
    setCheckoutTarget({
      id: item.id,
      kind: "queue",
      customerName: item.customer_name,
      serviceName: item.service_name || "Service",
      price: item.price_snapshot,
      staffName: assignedBarber?.name,
    })
  }

  function openAppointmentCheckout(a: ApiAppointment) {
    setCheckoutTarget({
      id: a.id,
      kind: "appointment",
      customerName: a.customer_name,
      serviceName: a.service_name,
      price: a.price_snapshot,
      staffName: a.staff_name,
    })
  }

  async function handleConfirmPayment(method: "cash" | "transfer", tip: number) {
    if (!checkoutTarget) return

    if (checkoutTarget.kind === "queue") {
      const res = await queueApi.complete(checkoutTarget.id, { method, tip })
      toast.success(
        `Completed: ${checkoutTarget.customerName} · ${formatRupiah(
          res.payment.amount + res.payment.tip
        )} recorded (${method})`
      )
    } else {
      const res = await appointmentApi.complete(checkoutTarget.id, { method, tip })
      toast.success(
        `Completed: ${checkoutTarget.customerName} · ${formatRupiah(
          res.payment.amount + res.payment.tip
        )} recorded (${method})`
      )
      setDetail(null)
    }

    loadData()
  }

  return (
    <div className={`operations ${collapsed ? "queue-collapsed" : ""}`}>
      <OpsToolbar
        view={view}
        onViewChange={setView}
        currentDateLabel={label}
        onPrev={handlePrev}
        onNext={handleNext}
        onToday={handleToday}
        onAppointment={() => onAppointment(getDateStringInTimezone(currentDate, timezone))}
        onWalkin={onWalkin}
        barberFilter={barberFilter}
        onBarberFilterChange={setBarberFilter}
        staffList={staffList}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      <div className="ops-body">
        <OpsCalendar
          selectedQueueId={selectedQueueId}
          onSelectQueue={(id) => {
            setSelectedQueueId(id)
            if (collapsed) setCollapsed(false)
          }}
          detail={detail}
          onSelectDetail={setDetail}
          queueItems={filteredQueueItems}
          appointments={filteredAppointments}
          staffList={displayedStaffList}
          currentDate={currentDate}
          view={view}
          timezone={timezone}
          shopHours={shopHours}
          shopClosures={shopClosures}
          staffHours={staffHours}
          staffExceptions={staffExceptions}
          onManageStaffSchedule={(staff) => setScheduleStaff(staff)}
        />

        <QueuePanel
          waiting={waiting}
          inService={inService}
          completed={completedQueue}
          staffList={staffList}
          selected={selectedQueueId}
          onSelect={setSelectedQueueId}
          onAssign={handleAssign}
          onStart={(item) => handleStart(item, false)}
          onComplete={openQueueCheckout}
          onCancel={handleCancelQueue}
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed((prev) => !prev)}
          onCollapse={() => setCollapsed(true)}
          timezone={timezone}
        />

        {collapsed && (
          <button
            type="button"
            title={language === "id" ? "Buka antrean langsung" : "Reopen walk-in queue"}
            className="queue-reopen"
            onClick={() => setCollapsed(false)}
            aria-label="Reopen walk-in queue"
          >
            <Icon name="users" />
            <span>{waiting.length}</span>
          </button>
        )}
      </div>

      <AppointmentDrawer
        detail={detail}
        onClose={() => setDetail(null)}
        onCheckIn={handleCheckIn}
        onComplete={openAppointmentCheckout}
        onCancel={handleCancelAppointment}
        onNoShow={handleNoShow}
        conflictReason={detailConflictReason}
        staffList={staffList}
        timezone={timezone}
        onReschedule={handleRescheduleAppointment}
      />

      {scheduleStaff && (
        <TeamSchedule
          staff={scheduleStaff}
          onClose={() => {
            setScheduleStaff(null)
            loadData()
          }}
          onUpdated={(msg) => {
            if (msg) toast.success(msg)
            loadData()
          }}
        />
      )}

      {checkoutTarget && (
        <CheckoutModal
          item={checkoutTarget}
          onClose={() => setCheckoutTarget(null)}
          onConfirm={handleConfirmPayment}
        />
      )}
    </div>
  )
}
