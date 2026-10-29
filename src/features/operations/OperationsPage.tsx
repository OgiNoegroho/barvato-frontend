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
} from "../../lib/api"
import {
  formatRupiah,
  formatPeriodLabel,
  getDateStringInTimezone,
  getWeekRange,
} from "../../lib/format"
import { Icon } from "../../components/ui/Icon"
import { OpsToolbar } from "./OpsToolbar"
import { OpsCalendar } from "./OpsCalendar"
import { QueuePanel } from "./QueuePanel"
import { AppointmentDrawer } from "./AppointmentDrawer"
import { CheckoutModal } from "../../components/CheckoutModal"
import { useI18n } from "../../lib/i18n"

interface OperationsPageProps {
  onWalkin: () => void
  onAppointment: (initialDate?: string) => void
  notify: (message: string) => void
}

export function OperationsPage({
  onWalkin,
  onAppointment,
  notify,
}: OperationsPageProps) {
  const { t, language } = useI18n()
  const [view, setView] = useState("Day")
  const [currentDate, setCurrentDate] = useState<Date>(() => new Date())
  const [timezone, setTimezone] = useState("Asia/Jakarta")
  const [shopHours, setShopHours] = useState<ShopHour[]>([])

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
      const d = new Date(currentDate)
      const firstDay = new Date(d.getFullYear(), d.getMonth(), 1)
      const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0)
      return {
        from: getDateStringInTimezone(firstDay, timezone),
        to: getDateStringInTimezone(lastDay, timezone),
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
      const [queueRes, historyRes, apptsRes, staffRes] = await Promise.all([
        queueApi.list().catch(() => ({ queue: [] })),
        queueApi.history(from, to, 200).catch(() => ({ queue_history: [] })),
        appointmentApi.list(from, to).catch(() => ({ appointments: [] })),
        staffApi.list(true).catch(() => ({ staff: [] })),
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
    } finally {
      setIsLoading(false)
    }
  }, [from, to])

  useEffect(() => {
    loadData()
    // Periodic refresh every 15 seconds to keep queue & calendar synced
    const interval = setInterval(loadData, 15000)
    return () => clearInterval(interval)
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
      notify(`${item.customer_name} assigned to barber`)
      loadData()
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : "Failed to assign barber")
    }
  }

  async function handleStart(item: ApiQueueEntry, override = false) {
    try {
      await queueApi.start(item.id, override)
      setSelectedQueueId(item.id)
      notify(`${item.customer_name} is now in service`)
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
        notify(err instanceof Error ? err.message : "Failed to start service")
      }
    }
  }

  async function handleCancelQueue(item: ApiQueueEntry) {
    try {
      await queueApi.cancel(item.id)
      if (selectedQueueId === item.id) setSelectedQueueId(null)
      notify(`${item.customer_name} removed from queue`)
      loadData()
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : "Failed to cancel queue entry")
    }
  }

  // Appointment actions
  async function handleCheckIn(a: ApiAppointment) {
    try {
      await appointmentApi.checkIn(a.id)
      notify("Customer checked in successfully")
      setDetail(null)
      loadData()
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : "Failed to check in appointment")
    }
  }

  async function handleCancelAppointment(a: ApiAppointment) {
    try {
      await appointmentApi.cancel(a.id)
      notify("Appointment cancelled")
      setDetail(null)
      loadData()
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : "Failed to cancel appointment")
    }
  }

  async function handleNoShow(a: ApiAppointment) {
    try {
      await appointmentApi.noShow(a.id)
      notify("Marked as no-show")
      setDetail(null)
      loadData()
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : "Failed to mark as no-show")
    }
  }

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
      notify(
        `Completed: ${checkoutTarget.customerName} · ${formatRupiah(
          res.payment.amount + res.payment.tip
        )} recorded (${method})`
      )
    } else {
      const res = await appointmentApi.complete(checkoutTarget.id, { method, tip })
      notify(
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
          onCollapse={() => setCollapsed(true)}
          timezone={timezone}
        />

        {collapsed && (
          <button
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
      />

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
