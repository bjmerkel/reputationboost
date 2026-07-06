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
