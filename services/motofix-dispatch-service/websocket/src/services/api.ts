// src/services/api.ts
//
// Three base URLs:
//   VITE_API_URL          → motofix-mechanics-service  (auth, profile, availability, location)
//   VITE_REQUESTS_URL     → motofix-service-requests   (jobs, accept, status, call-partner)
//   VITE_PAYMENTS_URL     → motofix-payments-service   (quotes, earnings, collection)

const MECHANICS_BASE = import.meta.env.VITE_API_URL || "https://motofix-mechanics-service.onrender.com";
const REQUESTS_BASE = import.meta.env.VITE_REQUESTS_URL || "https://motofix-service-requests.onrender.com";
const PAYMENTS_BASE = import.meta.env.VITE_PAYMENTS_URL || "https://motofix-payments-service.onrender.com";

// ─── Auth token helpers ───────────────────────────────────────────────────────

let _token: string | null = localStorage.getItem("motofix_token");
let _mechanicId: number | null = Number(localStorage.getItem("motofix_id")) || null;

export function setToken(token: string, mechanicId: number) {
  _token = token;
  _mechanicId = mechanicId;
  localStorage.setItem("motofix_token", token);
  localStorage.setItem("motofix_id", String(mechanicId));
}

export function clearToken() {
  _token = null;
  _mechanicId = null;
  localStorage.removeItem("motofix_token");
  localStorage.removeItem("motofix_id");
}

export function logout() {
  clearToken();
}

export function getToken() {
  return _token;
}

export function getStoredMechanicId() {
  return _mechanicId;
}

function authHeaders(): HeadersInit {
  return {
    "Content-Type": "application/json",
    ...(_token ? { Authorization: `Bearer ${_token}` } : {}),
  };
}

// Extracts a clean, human-readable error message from any API response
async function extractError(res: Response): Promise<string> {
  try {
    const body = await res.json();
    // FastAPI 422 returns { detail: [ { loc, msg, type } ] }
    if (Array.isArray(body.detail)) {
      return body.detail.map((d: any) => d.msg || JSON.stringify(d)).join(", ");
    }
    if (typeof body.detail === "string") return body.detail;
    if (typeof body.message === "string") return body.message;
    return "Something went wrong. Please try again.";
  } catch {
    return "Something went wrong. Please try again.";
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const message = await extractError(res);
    throw new Error(message);
  }
  return res.json();
}

// ─── Auth endpoints  (→ motofix-mechanics-service) ───────────────────────────

// Raw response shape from our backend
interface _LoginResponse {
  token: string;
  mechanic_id: number;
  name: string;
  phone: string;
}

// Shape AuthContext expects
export interface LoginResponse {
  mechanic: {
    id: number;
    name: string;
    phone: string;
    location: string;
    latitude: null;
    longitude: null;
    specialty: string;
    rating: number;
    total_ratings: number;
    is_available: boolean;
    vehicle_type: string;
  };
}

export interface LoginCredentials {
  phone: string;
  password: string;
}

export async function login(credentials: LoginCredentials): Promise<LoginResponse> {
  const res = await fetch(`${MECHANICS_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone: credentials.phone, password: credentials.password }),
  });
  const data = await handleResponse<_LoginResponse>(res);
  setToken(data.token, data.mechanic_id);

  // Fetch full profile after login so we have all mechanic fields
  try {
    const profile = await getMechanicProfile();
    return { mechanic: profile as any };
  } catch {
    // Fallback: return minimal shape from login response
    return {
      mechanic: {
        id: data.mechanic_id,
        name: data.name,
        phone: data.phone,
        location: "",
        latitude: null,
        longitude: null,
        specialty: "",
        rating: 0,
        total_ratings: 0,
        is_available: false,
        vehicle_type: "car",
      },
    };
  }
}

export async function register(params: {
  name: string;
  phone: string;
  password: string;
  location?: string;
  specialty?: string;
  vehicle_type?: string;
}): Promise<LoginResponse> {
  const res = await fetch(`${MECHANICS_BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  const data = await handleResponse<_LoginResponse>(res);
  setToken(data.token, data.mechanic_id);
  return {
    mechanic: {
      id: data.mechanic_id,
      name: data.name,
      phone: data.phone,
      location: "",
      latitude: null,
      longitude: null,
      specialty: "",
      rating: 0,
      total_ratings: 0,
      is_available: false,
      vehicle_type: "car",
    },
  };
}

export async function getMechanicProfile() {
  const res = await fetch(`${MECHANICS_BASE}/auth/me`, {
    headers: authHeaders(),
  });
  return handleResponse<Record<string, unknown>>(res);
}

// ─── Mechanic self-management  (→ motofix-mechanics-service) ─────────────────

export async function updateAvailability(isAvailable: boolean) {
  const res = await fetch(`${MECHANICS_BASE}/mechanics/me/availability`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify({ is_available: isAvailable }),
  });
  return handleResponse<{ id: number; is_available: boolean }>(res);
}

export async function updateLocation(
  latitude: number,
  longitude: number,
  location?: string
) {
  const res = await fetch(`${MECHANICS_BASE}/mechanics/me/location`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify({ latitude, longitude, ...(location ? { location } : {}) }),
  });
  return handleResponse<Record<string, unknown>>(res);
}

export async function getCurrentJob() {
  const res = await fetch(`${MECHANICS_BASE}/mechanics/me/current-job`, {
    headers: authHeaders(),
  });
  return handleResponse<{ job: Record<string, unknown> | null }>(res);
}

// ─── Job endpoints  (→ motofix-service-requests) ─────────────────────────────

export async function acceptJob(
  requestId: string | number,
  etaMinutes = 15
) {
  const res = await fetch(`${REQUESTS_BASE}/requests/${requestId}/accept`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify({
      eta_minutes: etaMinutes,
    }),
  });
  return handleResponse<Record<string, unknown>>(res);
}

export async function rejectJob(requestId: string | number) {
  try {
    await fetch(`${REQUESTS_BASE}/requests/${requestId}/reject`, {
      method: "POST",
      headers: authHeaders(),
    });
  } catch {
    // Network error — dismissal still happens locally; silent fail is fine.
  }
  return { status: "rejected" };
}

export async function updateJobStatus(
  requestId: string | number,
  status: "en_route" | "arrived" | "service_started" | "completed" | "cancelled"
) {
  const res = await fetch(
    `${REQUESTS_BASE}/requests/${requestId}/status?status=${status}`,
    {
      method: "PATCH",
      headers: authHeaders(),
    }
  );
  return handleResponse<{ detail: string; new_status: string }>(res);
}

export async function getCallPartnerPhone(requestId: string | number) {
  const res = await fetch(
    `${REQUESTS_BASE}/requests/${requestId}/call-partner`,
    { headers: authHeaders() }
  );
  return handleResponse<{ phone: string }>(res);
}

// Alias used by ActiveJobScreen
export const getCallPartner = getCallPartnerPhone;

// ─── Payment / Quote endpoints  (→ motofix-payments-service) ─────────────────

export interface QuoteRecord {
  id: number;
  request_id: number;
  mechanic_id: number;
  quoted_amount: number;
  commission: number;
  mechanic_payout: number;
  quote_approved: boolean;
  collection_status: string;
  disbursement_status: string;
  created_at: string;
}

export interface EarningsRecord {
  id: number;
  request_id: number;
  quoted_amount: number;
  commission: number;
  mechanic_payout: number;
  collection_status: string;
  disbursement_status: string;
  created_at: string;
  customer_name: string;
  service_type: string;
}

export interface EarningsResponse {
  total_earned: number;
  this_month: number;
  earnings: EarningsRecord[];
}

export async function submitQuote(requestId: number, quotedAmount: number, mechanicPhone?: string, mechanicId?: number): Promise<QuoteRecord> {
  let resolvedMechanicId = mechanicId ?? _mechanicId;

  // Fallback: decode mechanic_id from JWT sub if not available in memory/localStorage
  if (!resolvedMechanicId && _token) {
    try {
      const payload = JSON.parse(atob(_token.split('.')[1]));
      const sub = parseInt(payload.sub, 10);
      if (!isNaN(sub) && sub > 0) resolvedMechanicId = sub;
    } catch { /* ignore malformed token */ }
  }

  const res = await fetch(`${PAYMENTS_BASE}/payments/quote`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      request_id: requestId,
      quoted_amount: quotedAmount,
      mechanic_phone: mechanicPhone || undefined,
      mechanic_id: resolvedMechanicId || undefined,
    }),
  });
  return handleResponse<QuoteRecord>(res);
}

export async function getQuote(requestId: number): Promise<QuoteRecord> {
  const res = await fetch(`${PAYMENTS_BASE}/payments/quote/${requestId}`, {
    headers: authHeaders(),
  });
  return handleResponse<QuoteRecord>(res);
}

export async function getEarnings(mechanicId: number): Promise<EarningsResponse> {
  const res = await fetch(`${PAYMENTS_BASE}/payments/earnings/${mechanicId}`, {
    headers: authHeaders(),
  });
  return handleResponse<EarningsResponse>(res);
}