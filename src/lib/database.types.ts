// Generated DB types. Run `npm run gen:types` after `supabase link` to regenerate from schema.
// This is a hand-written subset matching the migrations until that runs.

export type OrderStatus =
  | 'new' | 'under_review' | 'quoted' | 'confirmed'
  | 'in_production' | 'ready' | 'shipped' | 'picked_up'
  | 'invoiced' | 'closed' | 'cancelled';

export type ProductionStatus =
  | 'not_started' | 'started' | 'in_progress'
  | 'sample_approval' | 'full_production' | 'completed';

export type BindingType = 'perfect' | 'saddle' | 'wiro' | 'comb' | 'document' | 'other';
export type DeliveryMethod = 'pickup' | 'courier';
export type ColourMode = 'bw' | 'colour';
export type PaperUsage = 'text' | 'cover' | 'special';
export type LaminationOption = 'glossy' | 'matte' | 'velvet' | 'none';
export type FileType = 'inner_pages' | 'cover_page' | 'print_file';
export type UserRole = 'manager' | 'production' | 'bookstore';
export type PaymentTerms = 'prepay' | 'credit';

export interface UserRow {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  last_login_at: string | null;
}

export interface OrderRow {
  id: string;
  order_number: string | null;
  status: OrderStatus;
  created_at: string;
  updated_at: string;

  client_email: string;
  client_name: string;
  client_phone: string;
  client_organization: string;

  binding_type: BindingType;
  binding_type_other: string | null;
  quantity: number;
  delivery_date: string;
  delivery_method: DeliveryMethod;
  delivery_address: string | null;
  special_instructions: string | null;

  trim_size: string | null;
  trim_size_other: string | null;
  num_pages: number | null;
  paper_type: string | null;
  cover_printing: ColourMode | null;
  inner_printing: ColourMode | null;
  cover_lamination: LaminationOption | null;

  printing_type: ColourMode[] | null;
  printing_sides: string | null;
  paper_size: string | null;
  paper_size_other: string | null;

  unit_production_cost: number | null;
  margin_percent: number;
  inflation_percent: number;
  price_per_copy: number | null;
  total_price: number | null;
  price_breakdown: PriceBreakdown | null;

  production_status: ProductionStatus | null;
  assigned_to: string | null;
  is_on_hold: boolean;
  hold_reason: string | null;

  courier_name: string | null;
  tracking_number: string | null;
  dispatch_date: string | null;

  zoho_invoice_id: string | null;
  invoice_sent_at: string | null;
  payment_received_at: string | null;
  payment_terms: PaymentTerms | null;
}

export interface PriceBreakdown {
  unit_cost: number;
  components: Record<string, number>;
  margin_percent: number;
  inflation_percent: number;
  price_per_copy: number;
  total_price: number;
  quantity: number;
  rate_card_snapshot?: Record<string, unknown>;
  calculated_at: string;
}

export interface OrderFileRow {
  id: string;
  order_id: string;
  file_type: FileType;
  file_name: string;
  storage_path: string;
  file_size_bytes: number | null;
  mime_type: string | null;
  uploaded_at: string;
}

export interface OrderStatusLogRow {
  id: string;
  order_id: string;
  field_changed: string;
  old_value: string | null;
  new_value: string;
  changed_by: string | null;
  changed_at: string;
  notes: string | null;
}

export interface OrderHoldRow {
  id: string;
  order_id: string;
  placed_by: string;
  placed_at: string;
  reason: string;
  resumed_by: string | null;
  resumed_at: string | null;
  production_status_before_hold: string | null;
}

export interface PaperType {
  id: string;
  name: string;
  gsm: number;
  size: string;
  price_per_sheet: number;
  usage: PaperUsage;
  is_active: boolean;
  updated_at: string;
}

export interface PrinterRate {
  id: string;
  printer_name: string;
  colour_mode: ColourMode;
  paper_size: string;
  price_per_sheet: number;
  alt_price: number | null;
  is_active: boolean;
  updated_at: string;
}

export interface LaminationType {
  id: string;
  name: string;
  thickness_microns: number;
  roll_size: string;
  roll_price: number;
  is_active: boolean;
  updated_at: string;
}

export interface OverheadCost {
  id: string;
  name: string;
  cost_per_copy: number;
  is_active: boolean;
  updated_at: string;
}

export interface PricingSettings {
  id: string;
  margin_percent: number;
  inflation_percent: number;
  updated_at: string;
}

export interface ImpositionRule {
  id: string;
  trim_size: string;
  printer_paper_size: string;
  pages_per_sheet: number;
  updated_at: string;
}
