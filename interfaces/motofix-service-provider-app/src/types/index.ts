// types/index.ts — shared TypeScript types for the provider app. These describe the
// shapes of the core things the app deals with (a provider, a job and its status, etc.)
// so screens and the API layer all agree on the same structure. Start here to learn the
// app's vocabulary.

export type ProviderType = 'mechanic' | 'towing_provider'

export type JobStatus =
  | 'pending'
  | 'accepted'
  | 'en_route'
  | 'arrived'
  | 'in_progress'
  | 'service_started'
  | 'awaiting_confirmation'
  | 'completed'
  | 'cancelled'

export interface User {
  id: string
  full_name: string
  phone: string
  email?: string
  role: string
  provider_type?: ProviderType
  is_verified?: boolean
  password_changed?: boolean
  spn?: string
}

export interface MechanicProfile {
  id: string
  full_name: string
  phone: string
  email?: string
  provider_type: ProviderType
  specializations?: string[]
  specialty?: string
  current_location?: string
  service_area?: string
  latitude?: number
  longitude?: number
  is_available: boolean
  is_verified: boolean
  rating?: number
  average_rating?: number
  total_jobs?: number
  jobs_completed?: number
  earnings?: number
  garage_name?: string
  license_number?: string
  vehicle_capacity?: number
  created_at?: string
  spn?: string
}

export interface ServiceRequest {
  id: string
  driver_id: string
  driver_name?: string
  driver_phone?: string
  mechanic_id?: string
  issue_type?: string
  service_type?: string
  description?: string
  media_files?: { url: string; file_type: string; size_kb?: number; uploaded_at?: string }[]
  status: JobStatus
  location?: string
  location_address?: string
  location_lat?: number
  location_lng?: number
  price_estimate?: number
  actual_fee?: number
  service_note?: string
  payment_status?: string
  created_at: string
  accepted_at?: string
  en_route_at?: string
  service_started_at?: string
  arrived_at?: string
  completed_at?: string
  completed_time?: string
  cancelled_by?: string
  cancel_reason?: string
  eta_minutes?: number
  distance_km?: number
}

export interface Notification {
  id: string
  type: string
  title: string
  message: string
  is_read: boolean
  created_at: string
  data?: Record<string, unknown>
}

export interface Review {
  id: string
  service_request_id: string
  mechanic_id: string
  driver_id: string
  driver_name?: string
  stars: number
  comment?: string
  is_approved: boolean
  created_at: string
}

export interface Payment {
  id: string
  service_request_id: string
  amount: number
  status: 'pending' | 'completed' | 'failed'
  method?: string
  created_at: string
}
