// Mechanic data model - matches backend schema
export interface Mechanic {
  id: number;
  name: string;
  phone: string;
  location: string;
  latitude: number | null;
  longitude: number | null;
  specialty: string;
  rating: number;
  total_ratings: number;
  is_available: boolean;
  vehicle_type: string;
}

// Attachment types for rich problem descriptions
export type AttachmentType = 'image' | 'audio' | 'document';

export interface Attachment {
  id: string;
  type: AttachmentType;
  url: string;
  filename?: string;
  mime_type?: string;
  created_at?: string;
}

// Job data model
export type JobStatus =
  | 'pending'
  | 'accepted'
  | 'en_route'
  | 'arrived'
  | 'service_started'
  | 'completed'
  | 'rejected';

export interface Job {
  id: number;
  vehicle_type: string;
  problem_description: string;
  attachments?: Attachment[]; // Optional array of customer attachments
  customer_location: string;
  customer_latitude: number | null;
  customer_longitude: number | null;
  status: JobStatus;
  created_at: string;
}

// Auth types
export interface LoginCredentials {
  phone: string;
  password: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  mechanic: Mechanic;
}

export interface ApiError {
  detail: string;
  status_code?: number;
}
