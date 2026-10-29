// Typed API client for Barbershop SaaS backend

export interface ApiErrorPayload {
  code: string
  message: string
  details?: unknown
}

export class ApiError extends Error {
  status: number
  code: string
  details?: unknown

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.code = code
    this.details = details
  }

  get isUnauthorized(): boolean {
    return this.status === 401
  }

  get isForbidden(): boolean {
    return this.status === 403
  }

  get isConflict(): boolean {
    return this.status === 409
  }

  get isRateLimited(): boolean {
    return this.status === 429
  }
}

export interface AuthUser {
  id: number
  name: string
  email: string
  phone: string
  platform_admin?: boolean
  must_change_password: boolean
}

export interface CurrentShop {
  id: number
  name: string
  role: "owner" | "manager" | "barber"
  staff_id?: number
  status: string
  timezone?: string
}

export interface ShopMembership {
  shop_id: number
  shop_name: string
  role: "owner" | "manager" | "barber"
  staff_id?: number
  status: string
  active?: boolean
}

export interface LoginRequest {
  identifier: string
  password: string
}

export interface LoginResponse {
  user: AuthUser
  shop?: CurrentShop
  shops?: ShopMembership[]
  requires_shop_selection: boolean
}

export interface SelectShopRequest {
  shop_id: number
}

export interface SelectShopResponse {
  shop: CurrentShop
}

export interface MeResponse {
  user: AuthUser
  current_shop: CurrentShop | null
  memberships: ShopMembership[]
}

export interface LogoutResponse {
  success: boolean
}

export interface HealthResponse {
  status: string
  db: string
}

export interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown
}

/**
 * Core generic fetch wrapper.
 * Ensures credentials: "include" for session cookies, proper Content-Type handling,
 * and standard backend error envelope decoding.
 */
export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, headers = {}, ...rest } = options

  const reqHeaders: Record<string, string> = {
    Accept: "application/json",
    ...(headers as Record<string, string>),
  }

  let reqBody: string | undefined
  if (body !== undefined && body !== null) {
    reqHeaders["Content-Type"] = "application/json"
    reqBody = typeof body === "string" ? body : JSON.stringify(body)
  }

  let response: Response
  try {
    response = await fetch(path, {
      ...rest,
      credentials: "include",
      headers: reqHeaders,
      body: reqBody,
    })
  } catch (err) {
    // Network errors (e.g. backend unreachable, DNS/connection refusal)
    const message = err instanceof Error ? err.message : "Network error"
    throw new ApiError(0, "network_error", `Failed to reach server: ${message}`)
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return undefined as unknown as T
  }

  const contentType = response.headers.get("Content-Type") || ""
  const isJson = contentType.includes("application/json")

  if (!response.ok) {
    let errorCode = `http_${response.status}`
    let errorMessage = response.statusText || "Request failed"
    let errorDetails: unknown

    if (isJson) {
      try {
        const payload = (await response.json()) as { error?: ApiErrorPayload }
        if (payload?.error) {
          errorCode = payload.error.code || errorCode
          errorMessage = payload.error.message || errorMessage
          errorDetails = payload.error.details
        }
      } catch {
        // Fallback to HTTP status text if JSON parsing fails
      }
    }

    throw new ApiError(response.status, errorCode, errorMessage, errorDetails)
  }

  if (isJson) {
    return (await response.json()) as T
  }

  return (await response.text()) as unknown as T
}

// Authentication API methods
export const authApi = {
  login(credentials: LoginRequest): Promise<LoginResponse> {
    return apiFetch<LoginResponse>("/api/auth/login", {
      method: "POST",
      body: credentials,
    })
  },

  selectShop(shopId: number): Promise<SelectShopResponse> {
    return apiFetch<SelectShopResponse>("/api/auth/select-shop", {
      method: "POST",
      body: { shop_id: shopId },
    })
  },

  me(): Promise<MeResponse> {
    return apiFetch<MeResponse>("/api/me", {
      method: "GET",
    })
  },

  changePassword(currentPassword: string, newPassword: string): Promise<{ success: boolean }> {
    return apiFetch<{ success: boolean }>("/api/auth/change-password", {
      method: "POST",
      body: { current_password: currentPassword, new_password: newPassword },
    })
  },

  logout(): Promise<LogoutResponse> {
    return apiFetch<LogoutResponse>("/api/auth/logout", {
      method: "POST",
    })
  },

  health(): Promise<HealthResponse> {
    return apiFetch<HealthResponse>("/healthz", {
      method: "GET",
    })
  },
}

// Service Catalog Types & API
export interface ServiceItem {
  id: number
  shop_id: number
  name: string
  duration_min: number
  price: number // whole rupiah
  active: boolean
}

export const servicesApi = {
  list(activeOnly = true): Promise<{ services: ServiceItem[] }> {
    const query = activeOnly ? "?active=true" : ""
    return apiFetch<{ services: ServiceItem[] }>(`/api/services${query}`)
  },
  create(data: { name: string; duration_min: number; price: number }): Promise<{ service: ServiceItem }> {
    return apiFetch<{ service: ServiceItem }>("/api/services", {
      method: "POST",
      body: data,
    })
  },
  update(
    id: number,
    data: { name?: string; duration_min?: number; price?: number; active?: boolean }
  ): Promise<{ service: ServiceItem }> {
    return apiFetch<{ service: ServiceItem }>(`/api/services/${id}`, {
      method: "PATCH",
      body: data,
    })
  },
}

// Shop Hours Types & API
export interface ShopDetails {
  id: number
  name: string
  timezone: string
  status: string
  created_at?: string
  updated_at?: string
}

export interface ShopHour {
  day_of_week: number // 0=Sunday .. 6=Saturday
  is_open: boolean
  open_time: string // "09:00:00"
  close_time: string // "21:00:00"
}

export interface AffectedAppointment {
  id: number
  customer_name: string
  staff_id: number
  staff_name: string
  service_name: string
  starts_at: string
  ends_at: string
  status: string
}

export interface AffectedWalkIn {
  id: number
  customer_name: string
  assigned_staff_id?: number | null
  assigned_staff_name?: string | null
  service_name: string
  status: string
  arrived_at: string
  started_at?: string | null
}

export interface BookingConflictDetails {
  affected_appointments: AffectedAppointment[]
  affected_walk_ins: AffectedWalkIn[]
}

export interface ShopClosure {
  id: number
  shop_id: number
  start_date: string // "YYYY-MM-DD"
  end_date: string // "YYYY-MM-DD"
  is_closed: boolean
  open_time?: string | null
  close_time?: string | null
  reason: string
  created_by?: number | null
  created_at: string
  updated_at: string
}

export interface CreateShopClosureRequest {
  start_date: string
  end_date: string
  is_closed: boolean
  open_time?: string | null
  close_time?: string | null
  reason?: string
  confirm_conflicts?: boolean
}

export interface UpdateShopClosureRequest {
  start_date?: string
  end_date?: string
  is_closed?: boolean
  open_time?: string | null
  close_time?: string | null
  reason?: string
  confirm_conflicts?: boolean
}

export const shopApi = {
  get(): Promise<{ shop: ShopDetails }> {
    return apiFetch<{ shop: ShopDetails }>("/api/shop")
  },
  update(data: { name?: string; timezone?: string }): Promise<{ shop: ShopDetails }> {
    return apiFetch<{ shop: ShopDetails }>("/api/shop", {
      method: "PATCH",
      body: data,
    })
  },
  getHours(): Promise<{ hours: ShopHour[] }> {
    return apiFetch<{ hours: ShopHour[] }>("/api/shop/hours")
  },
  updateHours(hours: ShopHour[]): Promise<{ hours: ShopHour[] }> {
    return apiFetch<{ hours: ShopHour[] }>("/api/shop/hours", {
      method: "PUT",
      body: { hours },
    })
  },
  listClosures(from?: string, to?: string): Promise<{ closures: ShopClosure[] }> {
    const qs = new URLSearchParams()
    if (from) qs.set("from", from)
    if (to) qs.set("to", to)
    const query = qs.toString() ? `?${qs.toString()}` : ""
    return apiFetch<{ closures: ShopClosure[] }>(`/api/shop/closures${query}`)
  },
  createClosure(
    data: CreateShopClosureRequest
  ): Promise<{ closure: ShopClosure; conflicts: BookingConflictDetails }> {
    return apiFetch<{ closure: ShopClosure; conflicts: BookingConflictDetails }>("/api/shop/closures", {
      method: "POST",
      body: data,
    })
  },
  updateClosure(
    id: number,
    data: UpdateShopClosureRequest
  ): Promise<{ closure: ShopClosure; conflicts: BookingConflictDetails }> {
    return apiFetch<{ closure: ShopClosure; conflicts: BookingConflictDetails }>(`/api/shop/closures/${id}`, {
      method: "PATCH",
      body: data,
    })
  },
  deleteClosure(id: number): Promise<{ success: boolean }> {
    return apiFetch<{ success: boolean }>(`/api/shop/closures/${id}`, {
      method: "DELETE",
    })
  },
}

// Staff Roster Types & API
export interface StaffItem {
  id: number
  shop_id: number
  name: string
  active: boolean
  commission_bps?: number | null
  contact?: string | null
  role?: string
}

export interface CreateStaffRequest {
  name: string
  commission_bps: number
  contact?: string
  role?: "barber" | "manager"
  create_user?: boolean
  email?: string
  phone?: string
}

export interface CreateStaffResponse {
  staff: StaffItem
  user_id?: number
  temporary_password?: string
}

export interface UpdateStaffRequest {
  name?: string
  commission_bps?: number
  contact?: string
  active?: boolean
}

export interface StaffScheduleItem {
  staff_id: number
  date: string
  day_of_week: number
  is_open: boolean
  open_time: string
  close_time: string
  source?: "shop_hours" | "shop_closure" | "staff_hours" | "staff_exception"
  reason?: string
  shop_closed?: boolean
}

export interface StaffHour {
  staff_id: number
  day_of_week: number // 0=Sunday .. 6=Saturday
  is_working: boolean
  open_time: string // "09:00:00"
  close_time: string // "21:00:00"
}

export interface StaffException {
  id: number
  shop_id: number
  staff_id: number
  staff_name?: string
  start_date: string // "YYYY-MM-DD"
  end_date: string // "YYYY-MM-DD"
  is_working: boolean
  open_time?: string | null
  close_time?: string | null
  reason: string
  created_by?: number | null
  created_at: string
  updated_at: string
}

export interface CreateStaffExceptionRequest {
  start_date: string
  end_date: string
  is_working: boolean
  open_time?: string | null
  close_time?: string | null
  reason?: string
  confirm_conflicts?: boolean
}

export interface UpdateStaffExceptionRequest {
  start_date?: string
  end_date?: string
  is_working?: boolean
  open_time?: string | null
  close_time?: string | null
  reason?: string
  confirm_conflicts?: boolean
}

export interface StaffAvailabilityItem {
  staff_id: number
  name: string
  active: boolean
  available: boolean
  status: "available" | "busy" | "unavailable" | "outside_working_hours"
  reason?: string
  display_label: string
  conflict_type?: "appointment" | "walkin"
  conflict_start?: string
  conflict_end?: string
}

export const staffApi = {
  list(activeOnly = true): Promise<{ staff: StaffItem[] }> {
    const query = activeOnly ? "?active=true" : ""
    return apiFetch<{ staff: StaffItem[] }>(`/api/staff${query}`)
  },
  get(id: number): Promise<{ staff: StaffItem }> {
    return apiFetch<{ staff: StaffItem }>(`/api/staff/${id}`)
  },
  create(data: CreateStaffRequest): Promise<CreateStaffResponse> {
    return apiFetch<CreateStaffResponse>("/api/staff", {
      method: "POST",
      body: data,
    })
  },
  update(id: number, data: UpdateStaffRequest): Promise<{ staff: StaffItem }> {
    return apiFetch<{ staff: StaffItem }>(`/api/staff/${id}`, {
      method: "PATCH",
      body: data,
    })
  },
  getSchedule(id: number, date?: string): Promise<{ schedule: StaffScheduleItem }> {
    const qs = date ? `?date=${encodeURIComponent(date)}` : ""
    return apiFetch<{ schedule: StaffScheduleItem }>(`/api/staff/${id}/schedule${qs}`)
  },
  getAllHours(): Promise<{ staff_hours: StaffHour[] }> {
    return apiFetch<{ staff_hours: StaffHour[] }>("/api/staff/hours")
  },
  getHours(id: number): Promise<{ hours: StaffHour[]; is_custom: boolean }> {
    return apiFetch<{ hours: StaffHour[]; is_custom: boolean }>(`/api/staff/${id}/hours`)
  },
  updateHours(
    id: number,
    hours: StaffHour[],
    confirmConflicts = false
  ): Promise<{ hours: StaffHour[]; is_custom: boolean; conflicts: BookingConflictDetails }> {
    return apiFetch<{ hours: StaffHour[]; is_custom: boolean; conflicts: BookingConflictDetails }>(
      `/api/staff/${id}/hours`,
      {
        method: "PUT",
        body: { hours, confirm_conflicts: confirmConflicts },
      }
    )
  },
  listAllExceptions(params?: {
    from?: string
    to?: string
    staff_id?: number
  }): Promise<{ exceptions: StaffException[] }> {
    const qs = new URLSearchParams()
    if (params?.from) qs.set("from", params.from)
    if (params?.to) qs.set("to", params.to)
    if (params?.staff_id) qs.set("staff_id", String(params.staff_id))
    const query = qs.toString() ? `?${qs.toString()}` : ""
    return apiFetch<{ exceptions: StaffException[] }>(`/api/staff/exceptions${query}`)
  },
  listExceptions(
    staffId: number,
    params?: { from?: string; to?: string }
  ): Promise<{ exceptions: StaffException[] }> {
    const qs = new URLSearchParams()
    if (params?.from) qs.set("from", params.from)
    if (params?.to) qs.set("to", params.to)
    const query = qs.toString() ? `?${qs.toString()}` : ""
    return apiFetch<{ exceptions: StaffException[] }>(`/api/staff/${staffId}/exceptions${query}`)
  },
  createException(
    staffId: number,
    data: CreateStaffExceptionRequest
  ): Promise<{ exception: StaffException; conflicts: BookingConflictDetails }> {
    return apiFetch<{ exception: StaffException; conflicts: BookingConflictDetails }>(
      `/api/staff/${staffId}/exceptions`,
      {
        method: "POST",
        body: data,
      }
    )
  },
  updateException(
    staffId: number,
    excId: number,
    data: UpdateStaffExceptionRequest
  ): Promise<{ exception: StaffException; conflicts: BookingConflictDetails }> {
    return apiFetch<{ exception: StaffException; conflicts: BookingConflictDetails }>(
      `/api/staff/${staffId}/exceptions/${excId}`,
      {
        method: "PATCH",
        body: data,
      }
    )
  },
  deleteException(staffId: number, excId: number): Promise<{ success: boolean }> {
    return apiFetch<{ success: boolean }>(`/api/staff/${staffId}/exceptions/${excId}`, {
      method: "DELETE",
    })
  },
  getAvailability(
    params: {
      starts_at: string
      duration_min: number
      exclude_appointment_id?: number
      kind?: "appointment" | "walkin"
    },
    signal?: AbortSignal
  ): Promise<{ availability: StaffAvailabilityItem[] }> {
    const qs = new URLSearchParams({
      starts_at: params.starts_at,
      duration_min: String(params.duration_min),
    })
    if (params.exclude_appointment_id) {
      qs.set("exclude_appointment_id", String(params.exclude_appointment_id))
    }
    if (params.kind) {
      qs.set("kind", params.kind)
    }
    return apiFetch<{ availability: StaffAvailabilityItem[] }>(
      `/api/staff/availability?${qs.toString()}`,
      { signal }
    )
  },
}

// Customer Directory Types & API
export interface CustomerItem {
  id: number
  shop_id: number
  name: string
  phone?: string | null
  email?: string | null
  notes?: string | null
}

export const customersApi = {
  list(search = ""): Promise<{ customers: CustomerItem[] }> {
    const query = search ? `?q=${encodeURIComponent(search)}` : ""
    return apiFetch<{ customers: CustomerItem[] }>(`/api/customers${query}`)
  },
  create(data: { name: string; phone?: string; email?: string; notes?: string }): Promise<{ customer: CustomerItem }> {
    return apiFetch<{ customer: CustomerItem }>("/api/customers", {
      method: "POST",
      body: data,
    })
  },
}

// Walk-in Queue Types & API
export interface ApiQueueEntry {
  id: number
  shop_id: number
  customer_name: string
  customer_id?: number | null
  customer_phone?: string | null
  service_id: number
  service_name?: string
  assigned_staff_id?: number | null
  assigned_staff_name?: string | null
  status: "waiting" | "in_service" | "completed" | "cancelled"
  price_snapshot: number
  duration_snapshot_min: number
  arrived_at: string
  started_at?: string | null
  finished_at?: string | null
  created_at: string
  updated_at: string
}

export interface CreateQueueRequest {
  customer_name: string
  customer_id?: number | null
  service_id: number
  assigned_staff_id?: number | null
}

export interface ConflictingAppointment {
  appointment_id: number
  customer_name: string
  starts_at: string
  ends_at: string
  status: string
}

export const queueApi = {
  list(): Promise<{ queue: ApiQueueEntry[] }> {
    return apiFetch<{ queue: ApiQueueEntry[] }>("/api/queue")
  },

  history(from?: string, to?: string, limit?: number): Promise<{ queue_history: ApiQueueEntry[] }> {
    const params = new URLSearchParams()
    if (from) params.set("from", from)
    if (to) params.set("to", to)
    if (limit) params.set("limit", String(limit))
    const qs = params.toString() ? `?${params.toString()}` : ""
    return apiFetch<{ queue_history: ApiQueueEntry[] }>(`/api/queue/history${qs}`)
  },

  create(data: CreateQueueRequest): Promise<{ queue_entry: ApiQueueEntry }> {
    return apiFetch<{ queue_entry: ApiQueueEntry }>("/api/queue", {
      method: "POST",
      body: data,
    })
  },

  assign(id: number, staffId: number): Promise<{ success: boolean }> {
    return apiFetch<{ success: boolean }>(`/api/queue/${id}/assign`, {
      method: "POST",
      body: { staff_id: staffId },
    })
  },

  start(id: number, override = false): Promise<{ queue_entry: ApiQueueEntry }> {
    return apiFetch<{ queue_entry: ApiQueueEntry }>(`/api/queue/${id}/start`, {
      method: "POST",
      body: { override },
    })
  },

  cancel(id: number): Promise<{ success: boolean }> {
    return apiFetch<{ success: boolean }>(`/api/queue/${id}/cancel`, {
      method: "POST",
    })
  },

  complete(id: number, data: { method: "cash" | "transfer"; tip: number }): Promise<{ payment: PaymentRecord; status: string }> {
    return apiFetch<{ payment: PaymentRecord; status: string }>(`/api/queue/${id}/complete`, {
      method: "POST",
      body: data,
    })
  },
}

// Appointment Types & API
export interface ApiAppointment {
  id: number
  shop_id: number
  customer_id: number
  customer_name: string
  customer_phone?: string | null
  staff_id: number
  staff_name: string
  service_id: number
  service_name: string
  starts_at: string
  ends_at: string
  status: "confirmed" | "checked_in" | "completed" | "cancelled" | "no_show"
  price_snapshot: number
  duration_snapshot_min: number
  created_at: string
  updated_at: string
}

export interface CreateAppointmentRequest {
  customer_id: number
  staff_id: number
  service_id: number
  starts_at: string // RFC3339
  override?: boolean
}

export interface ConflictingWalkIn {
  queue_entry_id: number
  customer_name: string
  started_at: string
  planned_end: string
}

export const appointmentApi = {
  list(from?: string, to?: string, staffId?: number, includeCancelled = false): Promise<{ appointments: ApiAppointment[] }> {
    const params = new URLSearchParams()
    if (from) params.set("from", from)
    if (to) params.set("to", to)
    if (staffId) params.set("staff_id", String(staffId))
    if (includeCancelled) params.set("include_cancelled", "true")
    const qs = params.toString() ? `?${params.toString()}` : ""
    return apiFetch<{ appointments: ApiAppointment[] }>(`/api/appointments${qs}`)
  },

  get(id: number): Promise<{ appointment: ApiAppointment }> {
    return apiFetch<{ appointment: ApiAppointment }>(`/api/appointments/${id}`)
  },

  create(data: CreateAppointmentRequest): Promise<{ appointment: ApiAppointment }> {
    return apiFetch<{ appointment: ApiAppointment }>("/api/appointments", {
      method: "POST",
      body: data,
    })
  },

  update(
    id: number,
    data: { staff_id?: number; service_id?: number; starts_at?: string; override?: boolean }
  ): Promise<{ appointment: ApiAppointment }> {
    return apiFetch<{ appointment: ApiAppointment }>(`/api/appointments/${id}`, {
      method: "PATCH",
      body: data,
    })
  },

  checkIn(id: number): Promise<{ success: boolean }> {
    return apiFetch<{ success: boolean }>(`/api/appointments/${id}/check-in`, {
      method: "POST",
    })
  },

  cancel(id: number): Promise<{ success: boolean }> {
    return apiFetch<{ success: boolean }>(`/api/appointments/${id}/cancel`, {
      method: "POST",
    })
  },

  noShow(id: number): Promise<{ success: boolean }> {
    return apiFetch<{ success: boolean }>(`/api/appointments/${id}/no-show`, {
      method: "POST",
    })
  },

  complete(id: number, data: { method: "cash" | "transfer"; tip: number }): Promise<{ payment: PaymentRecord; status: string }> {
    return apiFetch<{ payment: PaymentRecord; status: string }>(`/api/appointments/${id}/complete`, {
      method: "POST",
      body: data,
    })
  },
}

// Payment & Checkout Record
export interface PaymentRecord {
  id: number
  shop_id: number
  kind: "charge" | "refund"
  staff_id: number
  staff_name?: string
  service_id: number
  service_name?: string
  appointment_id?: number | null
  queue_entry_id?: number | null
  method: "cash" | "transfer"
  amount: number
  tip: number
  commission_bps: number
  commission_amount: number
  refunded_at?: string | null
  paid_at: string
}

export const paymentApi = {
  list(params: {
    from?: string
    to?: string
    method?: "cash" | "transfer"
    kind?: "charge" | "refund"
    staff_id?: number
    limit?: number
    offset?: number
  } = {}): Promise<{ payments: PaymentRecord[] }> {
    const qs = new URLSearchParams()
    if (params.from) qs.set("from", params.from)
    if (params.to) qs.set("to", params.to)
    if (params.method) qs.set("method", params.method)
    if (params.kind) qs.set("kind", params.kind)
    if (params.staff_id) qs.set("staff_id", String(params.staff_id))
    if (params.limit) qs.set("limit", String(params.limit))
    if (params.offset) qs.set("offset", String(params.offset))
    const query = qs.toString() ? `?${qs.toString()}` : ""
    return apiFetch<{ payments: PaymentRecord[] }>(`/api/payments${query}`)
  },

  refund(id: number): Promise<{ refund: PaymentRecord }> {
    return apiFetch<{ refund: PaymentRecord }>(`/api/payments/${id}/refund`, {
      method: "POST",
    })
  },
}

// Shop Overview API
export interface ShopOverview {
  business_date: string
  timezone: string
  scheduled_count: number
  checked_in_count: number
  completed_count: number
  queue_waiting_count: number
  queue_serving_count: number

  // Financial metrics (populated only for principals with money.view_all permission)
  net_revenue?: number | null
  net_cash?: number | null
  net_transfer?: number | null
  net_tips?: number | null
  completed_jobs?: number | null
  average_ticket?: number | null
}

export const overviewApi = {
  get(params?: { date?: string; from?: string; to?: string } | string): Promise<ShopOverview> {
    let query = ""
    if (typeof params === "string") {
      query = params ? `?date=${encodeURIComponent(params)}` : ""
    } else if (params) {
      const qs = new URLSearchParams()
      if (params.from) qs.set("from", params.from)
      if (params.to) qs.set("to", params.to)
      if (params.date) qs.set("date", params.date)
      const s = qs.toString()
      query = s ? `?${s}` : ""
    }
    return apiFetch<ShopOverview>(`/api/overview${query}`)
  },
}

// Payroll & Compensation API
export interface ShopPayrollSettings {
  shop_id: number
  default_model: "commission" | "salary" | "hybrid"
  default_commission_type: "percentage" | "fixed"
  default_commission_rate_bps: number
  default_fixed_commission_amount: number
  default_monthly_salary: number
  default_tips_policy: "direct" | "pooled"
  updated_at: string
}

export interface BarberCompensationPolicy {
  id: number
  shop_id: number
  staff_id: number
  staff_name?: string
  model: "commission" | "salary" | "hybrid"
  commission_type: "percentage" | "fixed"
  commission_rate_bps: number
  fixed_commission_amount: number
  monthly_salary: number
  effective_from: string
  effective_to?: string | null
  created_by?: number | null
  created_at: string
}

export interface PayrollSummaryItem {
  staff_id: number
  staff_name: string
  model: "commission" | "salary" | "hybrid"
  commission_type: "percentage" | "fixed"
  commission_rate_bps: number
  fixed_commission_amount: number
  monthly_salary: number
  salary_earned: number
  commission_earned: number
  tips_earned: number
  gross_earnings: number
  total_paid: number
  outstanding_balance: number
  completed_jobs: number
}

export interface CommissionItem {
  staff_id: number
  staff_name: string
  net_service_amount: number
  net_commission_amount: number
  net_tips: number
  completed_jobs: number
}

export interface PayoutRecord {
  id: number
  shop_id: number
  staff_id: number
  staff_name?: string
  amount: number
  period_start: string
  period_end: string
  payment_method?: "cash" | "transfer" | "other"
  reference_number?: string | null
  note?: string | null
  created_by?: number | null
  created_at: string
  voided_at?: string | null
  voided_by?: number | null
  void_reason?: string | null
}

export const payrollApi = {
  getSettings(): Promise<{ settings: ShopPayrollSettings }> {
    return apiFetch<{ settings: ShopPayrollSettings }>("/api/settings/payroll")
  },

  updateSettings(data: Partial<ShopPayrollSettings>): Promise<{ settings: ShopPayrollSettings }> {
    return apiFetch<{ settings: ShopPayrollSettings }>("/api/settings/payroll", {
      method: "PUT",
      body: data,
    })
  },

  getStaffCompensation(staffId: number, asOf?: string): Promise<{ active_policy: BarberCompensationPolicy; history: BarberCompensationPolicy[] }> {
    const qs = asOf ? `?as_of=${encodeURIComponent(asOf)}` : ""
    return apiFetch<{ active_policy: BarberCompensationPolicy; history: BarberCompensationPolicy[] }>(`/api/staff/${staffId}/compensation${qs}`)
  },

  createStaffCompensation(staffId: number, data: Partial<BarberCompensationPolicy>): Promise<{ policy: BarberCompensationPolicy }> {
    return apiFetch<{ policy: BarberCompensationPolicy }>(`/api/staff/${staffId}/compensation`, {
      method: "POST",
      body: data,
    })
  },

  getSummary(params: { from?: string; to?: string; staff_id?: number } = {}): Promise<{ summary: PayrollSummaryItem[] }> {
    const qs = new URLSearchParams()
    if (params.from) qs.set("from", params.from)
    if (params.to) qs.set("to", params.to)
    if (params.staff_id) qs.set("staff_id", String(params.staff_id))
    const query = qs.toString() ? `?${qs.toString()}` : ""
    return apiFetch<{ summary: PayrollSummaryItem[] }>(`/api/payroll/summary${query}`)
  },

  getCommissions(params: { from?: string; to?: string; staff_id?: number } = {}): Promise<{ commissions: CommissionItem[] }> {
    const qs = new URLSearchParams()
    if (params.from) qs.set("from", params.from)
    if (params.to) qs.set("to", params.to)
    if (params.staff_id) qs.set("staff_id", String(params.staff_id))
    const query = qs.toString() ? `?${qs.toString()}` : ""
    return apiFetch<{ commissions: CommissionItem[] }>(`/api/payroll/commissions${query}`)
  },

  listPayouts(params: { staff_id?: number; limit?: number; offset?: number } = {}): Promise<{ payouts: PayoutRecord[] }> {
    const qs = new URLSearchParams()
    if (params.staff_id) qs.set("staff_id", String(params.staff_id))
    if (params.limit) qs.set("limit", String(params.limit))
    if (params.offset) qs.set("offset", String(params.offset))
    const query = qs.toString() ? `?${qs.toString()}` : ""
    return apiFetch<{ payouts: PayoutRecord[] }>(`/api/payroll/payouts${query}`)
  },

  createPayout(data: {
    staff_id: number
    period_start: string
    period_end: string
    amount?: number
    payment_method?: string
    reference_number?: string
    note?: string
  }): Promise<{ payout: PayoutRecord }> {
    return apiFetch<{ payout: PayoutRecord }>("/api/payroll/payouts", {
      method: "POST",
      body: data,
    })
  },

  voidPayout(id: number, reason?: string): Promise<{ success: boolean }> {
    return apiFetch<{ success: boolean }>(`/api/payroll/payouts/${id}/void`, {
      method: "POST",
      body: { reason },
    })
  },
}

// Register Closing API
export interface RegisterCloseRecord {
  id: number
  shop_id: number
  business_date: string
  opening_cash: number
  net_cash_sales: number
  expected_cash: number
  counted_cash: number
  difference: number
  note?: string | null
  closed_at: string
  closed_by: number
}

export interface RegisterCloseResponse {
  status: "open" | "closed"
  net_cash_sales: number
  register_close?: RegisterCloseRecord
}

export const registerCloseApi = {
  get(date?: string): Promise<RegisterCloseResponse> {
    const query = date ? `?date=${encodeURIComponent(date)}` : ""
    return apiFetch<RegisterCloseResponse>(`/api/register/close${query}`)
  },

  close(data: {
    business_date: string
    opening_cash: number
    counted_cash: number
    note?: string
  }): Promise<{ register_close: RegisterCloseRecord }> {
    return apiFetch<{ register_close: RegisterCloseRecord }>("/api/register/close", {
      method: "POST",
      body: data,
    })
  },
}

