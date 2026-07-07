import { supabase } from "@/integrations/supabase/client";

// The generated Database type is empty until types regenerate, so we expose
// domain row shapes and a loosely-typed client for queries.
export type InventoryStatus = "OUT" | "LOW" | "OK" | "GOOD";

export interface InventoryItem {
  id: string;
  name: string;
  category: string;
  current_stock: number;
  par_level: number;
  unit_cost: number;
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

export interface SalesUpload {
  id: string;
  upload_date: string | null;
  file_name: string | null;
  parsed_data: unknown;
  status: string;
  created_by: string | null;
  created_at: string;
}

export type AppRole = "owner" | "staff";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const db = supabase as any;
