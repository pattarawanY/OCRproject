export type Role = "teacher" | "staff" | "admin";

export type RequestStatus =
  | "draft"
  | "pending_approval"
  | "rejected"
  | "approved"
  | "receipt_submitted"
  | "receipt_rejected"
  | "completed";

export interface TeacherProfile {
  budget_total: string;
  budget_used: string;
  budget_remaining: string;
}

export interface User {
  user_id: number;
  full_name: string;
  email: string;
  phone: string | null;
  department: string | null;
  role: Role;
  is_active: boolean;
  created_at: string;
  teacher_profile: TeacherProfile | null;
}

export interface ExpenseItem {
  item_id: number;
  category: string;
  description: string | null;
  estimated_amount: string;
  actual_amount: string | null;
}

export interface Trip {
  trip_id?: number;
  flight_number: string | null;
  airline: string | null;
  airline_id: number | null;
  departure_location: string | null;
  departure_datetime: string | null;
  arrival_location: string | null;
  arrival_datetime: string | null;
}

export interface HotelStay {
  stay_id?: number;
  hotel_id: number | null;
  hotel_name: string | null;
  city: string | null;
  country: string | null;
  check_in_date: string | null;
  check_out_date: string | null;
}

export interface StatusHistory {
  history_id: number;
  status: RequestStatus;
  note: string | null;
  changed_at: string;
  changed_by: number | null;
}

export interface ReceiptIssue {
  issue_id: number;
  issue_type: string;
  description: string;
  resolved: boolean;
}

export interface ExtractedFields {
  document_type: string;
  document_type_label: string;
  book_no: string | null;
  receipt_no: string | null;
  payee_name: string | null;
  payee_address: string | null;
  date: string | null;
  amount: number | null;
  currency: string | null;
  amount_in_words: string | null;
  description: string | null;
  has_signature: boolean;
  tax_id: string | null;
  paid_at_counter_service: boolean;
  guest_name: string | null;
  check_in: string | null;
  check_out: string | null;
  flight_numbers: string[];
  category: string | null;
  [key: string]: unknown;
}

export interface Receipt {
  receipt_id: number;
  request_id: number | null;
  sample_id: number | null;
  mode: "live" | "upload";
  image_file: string | null;
  ocr_data: { raw_text?: string; fields?: ExtractedFields };
  translated_text: string | null;
  source_language: string | null;
  status: "draft" | "flagged" | "valid" | "invalid";
  created_at: string;
  issues: ReceiptIssue[];
}

export interface OCRCheckResult {
  receipt: Receipt;
  passed: boolean;
  warnings: string[];
}

export interface RequestSummary {
  request_id: number;
  request_type: "reimburse" | "no_reimburse";
  activity_type: string;
  event_name: string;
  location: string;
  start_date: string;
  end_date: string;
  status: RequestStatus;
  estimated_amount: string;
  actual_amount: string | null;
  submitted_at: string | null;
  updated_at: string;
  user: { user_id: number; full_name: string; email: string; department: string | null };
}

export interface TravelRequest extends RequestSummary {
  event_url: string | null;
  attachment_file: string | null;
  approved_at: string | null;
  expense_items: ExpenseItem[];
  trips: Trip[];
  hotel_stays: HotelStay[];
  history: StatusHistory[];
  receipts: Receipt[];
}

export interface RequestActionResult {
  request: TravelRequest;
  warnings: string[];
}

export interface DocumentSample {
  sample_id: number;
  document_type: string;
  description: string | null;
  file: string | null;
  required_elements: string[];
  managed_by: number | null;
}

export interface Hotel {
  hotel_id: number;
  name: string;
  city: string | null;
  country: string | null;
  continent: string;
  sample_folio_file: string | null;
  sample_receipt_file: string | null;
  notes: string | null;
}

export interface Airline {
  airline_id: number;
  name: string;
  code: string | null;
  country: string | null;
  continent: string;
  notes: string | null;
}

export interface Notification {
  notification_id: number;
  related_request_id: number | null;
  related_receipt_id: number | null;
  type: "warning" | "status_update" | "reminder";
  subject: string;
  message: string | null;
  is_read: boolean;
  sent_at: string;
}

export interface DashboardStats {
  by_status: Record<string, number>;
  request_count: number;
  total_reimbursed: number;
  total_estimated: number;
  budgets: {
    user_id: number;
    full_name: string;
    budget_total: number;
    budget_used: number;
    budget_remaining: number;
  }[];
  user_count: number;
  users_by_role: Record<Role, number>;
}

export interface Option {
  key: string;
  label: string;
}
