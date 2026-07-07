import { supabase } from "@/integrations/supabase/client";

export type InventoryStatus = "OUT" | "LOW" | "OK" | "GOOD";

export interface InventoryItem {
  id: string;
  name: string;
  category: string;
  current_stock: number;
  par_level: number;
  unit_cost: number;
  bottle_size_ml: number;
  abv: number;
  cost_per_ml: number;
  pours_per_bottle: number;
  status: InventoryStatus;
  created_at: string;
}

export interface Cocktail {
  id: string;
  name: string;
  specs: string | null;
  price: number;
  est_cost: number;
  margin_percent: number;
  abv_percent: number;
  category: string | null;
  total_volume_ml: number;
  created_at: string;
}

export interface Invoice {
  id: string;
  vendor: string;
  date: string | null;
  total: number;
  items: string | null;
  receipt_url: string | null;
  created_by: string | null;
  created_at: string;
}

export interface DailySale {
  id: string;
  date: string;
  cocktail_id: string | null;
  quantity_sold: number;
  revenue: number;
  cost: number;
  profit: number;
  created_at: string;
}

export interface BatchRecipe {
  id: string;
  name: string;
  total_servings: number;
  total_cost: number;
  cost_per_serving: number;
  instructions: string | null;
  created_at: string;
}

export type AppRole = "owner" | "staff";

export interface Staff {
  id: string;
  name: string;
  nif: string | null;
  role: string;
  base_salary: number;
  hourly_rate: number;
  active: boolean;
  created_at: string;
}

export interface PayrollRecord {
  id: string;
  staff_id: string | null;
  month: number;
  year: number;
  base_pay: number;
  meal_subsidy: number;
  tips: number;
  gross_pay: number;
  irs: number;
  social_security: number;
  net_pay: number;
  days_worked: number;
  hours_worked: number;
  created_at: string;
}

export interface ServiceCost {
  id: string;
  name: string;
  category: string;
  amount: number;
  frequency: string;
  due_day: number;
  vendor: string | null;
  auto_renew: boolean;
  active: boolean;
  created_at: string;
}

export interface ServiceCostPayment {
  id: string;
  service_cost_id: string | null;
  month: number;
  year: number;
  amount_paid: number;
  payment_date: string | null;
  status: string;
  receipt_url: string | null;
  created_at: string;
}

export interface PayrollInvoice {
  id: string;
  staff_id: string | null;
  month: number;
  year: number;
  file_name: string;
  file_path: string;
  net_amount: number;
  uploaded_by: string | null;
  created_at: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const db = supabase as any;
