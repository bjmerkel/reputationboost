export interface CustomerRecord {
  id: string;
  business_id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  phone: string;
  email: string | null;
  service_notes: string | null;
  last_service_date: string | null;
  source: string;
  opted_out: boolean;
  review_requested_at: string | null;
  external_ids?: Record<string, string>;
  last_event_at?: string | null;
  last_event_type?: string | null;
  service_address?: string | null;
  service_city?: string | null;
  service_zip?: string | null;
  service_lat?: number | null;
  service_lng?: number | null;
  grid_north?: number | null;
  grid_east?: number | null;
  geo_resolved_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CustomerInput {
  firstName?: string;
  lastName?: string;
  phone: string;
  email?: string;
  serviceNotes?: string;
  lastServiceDate?: string;
  source?: string;
  serviceAddress?: string;
  serviceCity?: string;
  serviceZip?: string;
  serviceLat?: number;
  serviceLng?: number;
  gridNorth?: number;
  gridEast?: number;
  geoResolvedAt?: string;
}

export interface ImportCustomerRow {
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  serviceNotes?: string;
  lastServiceDate?: string;
}

export interface CustomerListOptions {
  eligibleOnly?: boolean;
  limit?: number;
  offset?: number;
}
