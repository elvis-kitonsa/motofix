import axios from 'axios'
import type { AxiosInstance } from 'axios'
import { noteServerDate } from '@/utils/serverClock'
import type { ServiceRequest, MechanicProfile } from '@/types'

const AUTH_URL           = import.meta.env.VITE_API_AUTH_URL           ?? ''
const MECHANICS_URL      = import.meta.env.VITE_API_MECHANICS_URL      ?? ''
const REQUESTS_URL       = import.meta.env.VITE_API_REQUESTS_URL       ?? ''
// Empty → relative URLs that go through the Vite dev proxy (see vite.config.ts), same as the
// other services. Calling http://localhost:8007 directly is blocked over HTTPS (mixed content + CORS).
const DIAGNOSIS_URL      = import.meta.env.VITE_API_DIAGNOSIS_URL      ?? ''
const SUBSCRIPTIONS_URL  = import.meta.env.VITE_API_SUBSCRIPTIONS_URL  ?? ''

function withAuth(instance: AxiosInstance): AxiosInstance {
  instance.interceptors.request.use(cfg => {
    const token = localStorage.getItem('motofix_sp_token')
    if (token) cfg.headers.Authorization = `Bearer ${token}`
    return cfg
  })
  instance.interceptors.response.use(
    res => {
      // Keep the device's clock in step with the server (for the journey sim).
      noteServerDate(res.headers?.['date'])
      return res
    },
    err => {
      const isLoginCall = err.config?.url?.includes('/auth/login')
      if (err.response?.status === 401 && !isLoginCall) {
        localStorage.removeItem('motofix_sp_token')
        localStorage.removeItem('motofix_sp_user')
        // Use replace so the browser back-button doesn't loop
        window.location.replace('/login')
      }
      return Promise.reject(err)
    }
  )
  return instance
}

const authApi         = withAuth(axios.create({ baseURL: AUTH_URL,      timeout: 30000 }))
const mechanicsApi    = withAuth(axios.create({ baseURL: MECHANICS_URL, timeout: 30000 }))
const requestsApi     = withAuth(axios.create({ baseURL: REQUESTS_URL,  timeout: 30000 }))
const diagnosisApi    = withAuth(axios.create({ baseURL: DIAGNOSIS_URL, timeout: 30000 }))
const subscriptionsApi = withAuth(axios.create({ baseURL: SUBSCRIPTIONS_URL, timeout: 30000 }))

// Normalize a raw backend object (RequestOut or job_acceptance row) to ServiceRequest
export function normalizeRequest(raw: Record<string, unknown>): ServiceRequest {
  const backendStatus = String(raw.status ?? 'pending')
  // backend uses 'service_started'; frontend uses 'in_progress'
  const status = backendStatus === 'service_started' ? 'in_progress' : backendStatus

  const locationStr = String(raw.location ?? '')
  let location_lat: number | undefined
  let location_lng: number | undefined
  const parts = locationStr.split(',').map(Number)
  if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1]) && parts[0] !== 0) {
    location_lat = parts[0]
    location_lng = parts[1]
  }

  return {
    id: String(raw.id ?? raw.request_id ?? ''),
    driver_id: String(raw.user_id ?? ''),
    driver_name: String(raw.customer_name ?? ''),
    service_type: String(raw.service_type ?? ''),
    description: String(raw.description ?? ''),
    media_files: Array.isArray(raw.media_files) ? (raw.media_files as ServiceRequest['media_files']) : [],
    status: status as ServiceRequest['status'],
    location_address: locationStr,
    location_lat,
    location_lng,
    created_at: String(raw.created_at ?? new Date().toISOString()),
    accepted_at:        raw.accepted_at        ? String(raw.accepted_at)        : undefined,
    en_route_at:        raw.en_route_at         ? String(raw.en_route_at)        : undefined,
    service_started_at: raw.service_started_at  ? String(raw.service_started_at) : undefined,
    arrived_at:         raw.arrived_at          ? String(raw.arrived_at)         : undefined,
    completed_at:       raw.completed_at        ? String(raw.completed_at)       : undefined,
    completed_time:     raw.completed_at        ? String(raw.completed_at)       : undefined,
    eta_minutes:        raw.eta_minutes != null ? Number(raw.eta_minutes)        : undefined,
  }
}

// ── Auth service (port 8000) ──────────────────────────────────────────────────

export const authService = {
  login: (identifier: string, password: string) =>
    authApi.post('/auth/login/provider', { identifier, password }),

  requestPhoneOTP: (phone: string) =>
    authApi.post('/auth/provider/phone-otp', { phone }),

  verifyPhoneOTP: (phone: string, otp_code: string) =>
    authApi.post('/auth/provider/verify-phone-otp', { phone, otp_code }),

  requestResetOTP: (phone: string) =>
    authApi.post('/auth/provider/reset-password-otp', { phone }),

  confirmResetPassword: (phone: string, otp_code: string, new_password: string) =>
    authApi.post('/auth/provider/confirm-reset-password', { phone, otp_code, new_password }),
}

// ── Spare parts & tools orders (port 8000, /auth) ───────────────────────────────
export interface ProviderPartsOrder {
  id: number
  fault_label: string | null
  parts: { name: string; price_min: number; price_max: number; qty: number }[]
  dealer_name: string | null
  dealer_phone: string | null
  status: string
  created_at: string
}

export const partsService = {
  /** Record a tools/equipment order the provider sent to a (Google Places) dealer via WhatsApp. */
  createOrder: (data: {
    fault_label?: string | null
    parts?: { name: string; price_min: number; price_max: number; qty: number }[]
    dealer_name?: string | null
    dealer_phone?: string | null
    dealer_place_id?: string | null
  }) => authApi.post<ProviderPartsOrder>('/auth/me/parts-orders', data),
  listOrders: () => authApi.get<ProviderPartsOrder[]>('/auth/me/parts-orders'),
}

// ── Mechanic profile (port 8000 for read; port 8002 for mutations) ────────────

export const mechanicService = {
  getProfile: () => authApi.get<MechanicProfile>('/auth/me/provider'),

  updateAvailability: (val: boolean) =>
    authApi.patch('/auth/provider/me/availability', { is_available: val }),

  submitApplication: (data: FormData) =>
    authApi.post('/providers/applications', data),

  changePassword: (current_password: string, new_password: string) =>
    authApi.patch('/auth/provider/me/password', { current_password, new_password }),

  updateLocation: (lat: number, lng: number, address?: string) =>
    authApi.patch('/auth/provider/me/location', {
      latitude: lat,
      longitude: lng,
      location: address ?? `${lat},${lng}`,
    }),
}

// ── Jobs (port 8001 for accept/status; port 8002 for current job) ─────────────

export const jobService = {
  getActive: async (): Promise<{ data: ServiceRequest[] }> => {
    const res = await mechanicsApi.get<{ job: Record<string, unknown> | null }>(
      '/mechanics/me/current-job'
    )
    const job = res.data?.job
    return { data: job ? [normalizeRequest(job)] : [] }
  },

  getPending: async (): Promise<{ data: ServiceRequest[] }> => {
    const res = await requestsApi.get<Record<string, unknown>[]>('/requests/pending')
    return { data: (res.data ?? []).map(normalizeRequest) }
  },

  // Completed-job history for the signed-in mechanic — proxied via 8002 to dispatch
  getCompleted: async (): Promise<{ data: ServiceRequest[] }> => {
    const res = await mechanicsApi.get<{ jobs: Record<string, unknown>[] }>(
      '/mechanics/me/completed-jobs'
    )
    return { data: (res.data?.jobs ?? []).map(normalizeRequest) }
  },

  // Handled jobs — every request picked up (accepted) and not cancelled. Powers
  // the Today / This-Week counts, which tally from accepted_at (pickup time).
  getHandled: async (): Promise<{ data: ServiceRequest[] }> => {
    const res = await mechanicsApi.get<{ jobs: Record<string, unknown>[] }>(
      '/mechanics/me/handled-jobs'
    )
    return { data: (res.data?.jobs ?? []).map(normalizeRequest) }
  },

  // Finished-job history — completed AND cancelled — for the Job History list.
  getHistory: async (): Promise<{ data: ServiceRequest[] }> => {
    const res = await mechanicsApi.get<{ jobs: Record<string, unknown>[] }>(
      '/mechanics/me/job-history'
    )
    return {
      data: (res.data?.jobs ?? []).map(j => ({
        ...normalizeRequest(j),
        en_route_at:        j.en_route_at        ? String(j.en_route_at)        : undefined,
        service_started_at: j.service_started_at ? String(j.service_started_at) : undefined,
        cancelled_by:       j.cancelled_by  ? String(j.cancelled_by)  : undefined,
        cancel_reason:      j.cancel_reason ? String(j.cancel_reason) : undefined,
      })),
    }
  },

  accept: (id: string | number, etaMinutes?: number | null) =>
    requestsApi.patch<Record<string, unknown>>(
      `/requests/${id}/accept`,
      { eta_minutes: etaMinutes ?? null }
    ),

  reject: (id: string | number) =>
    requestsApi.post(`/requests/${id}/reject`),

  updateStatus: (id: string | number, status: string, extra?: Record<string, unknown>) => {
    // Map frontend 'in_progress' → backend 'service_started'
    const backendStatus = status === 'in_progress' ? 'service_started' : status
    const params: Record<string, unknown> = { status: backendStatus }
    if (extra?.eta_minutes != null) params.eta_minutes = extra.eta_minutes
    if (extra?.cancel_reason != null) params.cancel_reason = extra.cancel_reason
    if (extra?.actual_fee != null) params.actual_fee = extra.actual_fee
    if (extra?.note != null) params.note = extra.note
    return requestsApi.patch<{ new_status: string; cancellation?: { strikes: number; suspended: boolean; limit: number } | null }>(
      `/requests/${id}/status`,
      null,
      { params }
    )
  },

  // Cancel a picked-up job with a reason. Returns the strike/suspension outcome.
  cancel: (id: string | number, reason: string) =>
    requestsApi.patch<{ new_status: string; cancellation?: { strikes: number; suspended: boolean; limit: number } | null }>(
      `/requests/${id}/status`,
      null,
      { params: { status: 'cancelled', cancel_reason: reason } },
    ),

  // This mechanic's consecutive-cancellation strikes + suspension state.
  getStrikes: () =>
    mechanicsApi.get<{ strikes: number; suspended: boolean; limit: number }>('/mechanics/me/strikes'),

  // Persist a completed (simulated) job payment so it appears in admin revenue/payments.
  recordPayment: (id: string | number, method: 'cash' | 'momo') =>
    requestsApi.post(`/payments/record/${id}`, null, { params: { method } }),
}

// ── Reviews (port 8001) ───────────────────────────────────────────────────────

export const reviewService = {
  // The signed-in mechanic's own reviews — proxied via 8002 (mechanicsApi) to dispatch
  getByMechanic: (_id?: string | number) =>
    mechanicsApi.get('/mechanics/me/reviews'),

  submit: (requestId: string | number, data: { rating: number; comment?: string }) =>
    requestsApi.post(`/requests/${requestId}/review`, data),
}

// ── In-job chat (persisted, two-way) — port 8001 via /requests proxy ──────────
export interface JobChatMessage {
  id: number
  request_id: number
  sender_role: 'driver' | 'mechanic'
  sender_id: string
  body: string
  media_type: 'none' | 'voice' | 'image'
  media_url: string | null
  seen_by_driver?: boolean
  seen_by_mechanic?: boolean
  created_at: string
}

export const chatService = {
  list: (requestId: string, role: 'driver' | 'mechanic', markSeen = true) =>
    requestsApi.get<{ request_id: number; messages: JobChatMessage[] }>(
      `/requests/${requestId}/messages`, { params: { role, mark_seen: markSeen } },
    ),

  unread: (requestId: string, role: 'driver' | 'mechanic') =>
    requestsApi.get<{ unread: number }>(
      `/requests/${requestId}/messages/unread`, { params: { role } },
    ),

  markSeen: (requestId: string, role: 'driver' | 'mechanic') =>
    requestsApi.post(`/requests/${requestId}/messages/seen`, { role }),

  sendText: (requestId: string, data: { sender_role: 'driver' | 'mechanic'; sender_id: string; body: string }) =>
    requestsApi.post<JobChatMessage>(`/requests/${requestId}/messages`, data),

  sendMedia: (requestId: string, form: FormData) =>
    requestsApi.post<JobChatMessage>(`/requests/${requestId}/messages/media`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
}

// ── Diagnosis service (port 8007) ─────────────────────────────────────────────

export interface ChatMsg { role: 'user' | 'assistant'; content: string }

export const diagnosisService = {
  // persona 'mechanic' → MOTOBOT gives detailed step-by-step repair guidance (vs driver triage).
  chat: (messages: ChatMsg[], persona: 'driver' | 'mechanic' = 'mechanic') =>
    diagnosisApi.post<{ reply: string; diagnosis_ready: boolean; diagnosis?: Record<string, unknown> }>('/chat', { messages, persona }),

  chatWithImage: (formData: FormData) =>
    diagnosisApi.post<{ reply: string; diagnosis_ready: boolean; diagnosis?: Record<string, unknown> }>('/chat/image', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  // AI UGX price ranges for spare parts (each item a descriptive string, e.g.
  // "Michelin 195/65 R15 tyre x4 for Toyota Premio").
  partsPrice: (items: string[]) =>
    diagnosisApi.post<{
      currency: string
      items: { name: string; price_min: number; price_max: number; new_min: number; new_max: number; used_min: number; used_max: number; note?: string | null }[]
    }>('/parts-price', { items }),
}

// Price suggestion lookup by fault category
export const PRICE_RANGES: Record<string, { min: number; max: number; base: number }> = {
  flat_tyre:           { min: 15000,  max: 50000,   base: 25000  },
  tyre_puncture:       { min: 15000,  max: 50000,   base: 25000  },
  battery_dead:        { min: 20000,  max: 100000,  base: 50000  },
  battery_fault:       { min: 20000,  max: 100000,  base: 50000  },
  fuel_empty:          { min: 10000,  max: 30000,   base: 15000  },
  out_of_fuel:         { min: 10000,  max: 30000,   base: 15000  },
  engine_fault:        { min: 50000,  max: 500000,  base: 150000 },
  engine_overheating:  { min: 50000,  max: 300000,  base: 120000 },
  electrical_fault:    { min: 30000,  max: 300000,  base: 100000 },
  brake_failure:       { min: 50000,  max: 200000,  base: 100000 },
  transmission_fault:  { min: 100000, max: 500000,  base: 200000 },
  towing:              { min: 50000,  max: 250000,  base: 100000 },
  other:               { min: 20000,  max: 300000,  base: 80000  },
}

export function suggestPrice(faultCategory: string, severity = 'medium'): { min: number; max: number; suggested: number } {
  const key = (faultCategory ?? '').toLowerCase().replace(/\s+/g, '_')
  const range = PRICE_RANGES[key] ?? PRICE_RANGES['other']
  const multiplier = severity === 'low' ? 0.7 : severity === 'high' ? 1.5 : severity === 'critical' ? 2.0 : 1.0
  return {
    min: range.min,
    max: range.max,
    suggested: Math.round((range.base * multiplier) / 1000) * 1000,
  }
}

// ── Subscription service (port 8005 via /subscriptions proxy) ────────────────

export interface SubscriptionState {
  mechanic_id: number
  status: 'trial' | 'active' | 'grace' | 'expired'
  plan: string
  amount_ugx: number
  days_left: number
  trial_ends_at?: string
  current_period_end?: string
  grace_ends_at?: string
  payment_ref?: string
}

export const subscriptionService = {
  getMySubscription: () =>
    subscriptionsApi.get<SubscriptionState>('/subscriptions/me'),
}

// ── Platform fees (MOTOFIX revenue — replaces the subscription) ────────────────
// A flat UGX 10,000 is owed per *completed* job (never charged before or during the job).
// 3 unpaid jobs (UGX 30,000) is the strike-three threshold; enforcement (gating/locking) is
// left for production, so for the demo `gated`/`locked` stay false and we only show the balance.
export interface PlatformFeeState {
  mechanic_id: number
  owed_count: number
  owed_amount: number
  fee_per_job: number
  gate_jobs: number
  gated: boolean
  locked: boolean
  jobs: {
    request_id: number
    amount: number          // the platform fee owed on this job (flat 10k)
    created_at: string | null
    service_type?: string | null
    customer_name?: string | null
    location?: string | null
    job_fee?: number | null  // what the mechanic charged/earned on the job (actual_fee)
    completed_at?: string | null
    service_note?: string | null
  }[]
}

export const feesService = {
  getFees: (mechanicId: string | number) =>
    requestsApi.get<PlatformFeeState>(`/fees/${mechanicId}`),
  // Settle owed fees. Pass an AI-parsed `sms_text` (MoMo confirmation) or an `amount`.
  pay: (mechanicId: string | number, body: { sms_text?: string; amount?: number; reference?: string }) =>
    requestsApi.post(`/fees/${mechanicId}/pay`, body),
}

// ── AI-generated, rotating home-screen headlines ──────────────────────────────
export const greetingService = {
  get: (role: 'driver' | 'mechanic', period: string): Promise<string[]> =>
    diagnosisApi.get<{ messages?: string[] }>('/greetings', { params: { role, period } })
      .then(r => r.data?.messages ?? [])
      .catch(() => []),
}

// ── AI job-completion estimate: tickable fixes + cost/transport breakdown ──────
export interface MoneyRange { min: number; max: number }
export interface ServiceEstimate {
  fix_options: string[]
  transport: MoneyRange
  labour: MoneyRange
  parts: MoneyRange
  total: MoneyRange
  source?: string
}
export const estimateService = {
  get: (body: { issue_type?: string; description?: string; distance_km?: number }): Promise<ServiceEstimate | null> =>
    diagnosisApi.post<ServiceEstimate>('/service-estimate', body).then(r => r.data).catch(() => null),
}

// ── Notifications ─────────────────────────────────────────────────────────────

const NOTIF_READ_KEY    = 'motofix_sp_notif_read'
const NOTIF_DELETED_KEY = 'motofix_sp_notif_deleted'

function _getReadIds(): Set<string> {
  try {
    const raw = localStorage.getItem(NOTIF_READ_KEY)
    return raw ? new Set(JSON.parse(raw)) : new Set()
  } catch { return new Set() }
}

function _saveReadIds(ids: Set<string>) {
  try { localStorage.setItem(NOTIF_READ_KEY, JSON.stringify([...ids])) } catch {}
}

function _getDeletedIds(): Set<string> {
  try {
    const raw = localStorage.getItem(NOTIF_DELETED_KEY)
    return raw ? new Set(JSON.parse(raw)) : new Set()
  } catch { return new Set() }
}

export const notificationService = {
  getAll: async (): Promise<{ data: import('@/types').Notification[] }> => {
    try {
      const res = await authApi.get<import('@/types').Notification[]>('/auth/me/notifications')
      const readIds    = _getReadIds()
      const deletedIds = _getDeletedIds()
      const items = (res.data ?? [])
        .filter(n => !deletedIds.has(n.id))
        .map(n => ({ ...n, is_read: readIds.has(n.id) }))
      return { data: items }
    } catch {
      return { data: [] }
    }
  },

  markRead: (id: string): Promise<{ data: object }> => {
    const ids = _getReadIds()
    ids.add(id)
    _saveReadIds(ids)
    return Promise.resolve({ data: {} })
  },

  markAllRead: (allIds?: string[]): Promise<{ data: object }> => {
    const ids = _getReadIds()
    ;(allIds ?? []).forEach(id => ids.add(id))
    _saveReadIds(ids)
    return Promise.resolve({ data: {} })
  },
}

export default authApi
