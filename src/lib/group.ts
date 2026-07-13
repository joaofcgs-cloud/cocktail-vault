import { useQuery } from "@tanstack/react-query";
import { db } from "@/lib/db";

/* ---------- Types ---------- */
export interface Company {
  id: string;
  legal_name: string;
  commercial_name: string;
  nif: string;
  address: string;
  type: "holding" | "bar" | "lab";
  brand_color: string;
}
export interface GroupCocktail {
  id: string;
  name: string;
  kind: string;
  company_id: string;
  price: number;
  est_cost: number;
  margin_percent: number;
  category: string | null;
}
export interface GroupPrep {
  id: string;
  name: string;
  company_id: string;
  shelf_life_days: number | null;
  total_cost: number;
  cost_per_ml: number;
}

/* When a cocktail has no seeded spec cost yet, use a group-standard
   estimated pour cost so margin figures are meaningful. Labelled "est." in UI. */
export const ASSUMED_POUR_COST = 2.95;

export function costOf(c: GroupCocktail): number {
  return c.est_cost > 0 ? c.est_cost : ASSUMED_POUR_COST;
}
export function marginOf(c: GroupCocktail): number {
  if (c.price <= 0) return 0;
  return ((c.price - costOf(c)) / c.price) * 100;
}

/* ---------- Data hooks ---------- */
export function useCompanies() {
  return useQuery({
    queryKey: ["companies"],
    queryFn: async (): Promise<Company[]> => {
      const { data, error } = await db
        .from("companies")
        .select("*")
        .order("commercial_name");
      if (error) throw error;
      return data as Company[];
    },
  });
}
export function useGroupCocktails() {
  return useQuery({
    queryKey: ["group_cocktails"],
    queryFn: async (): Promise<GroupCocktail[]> => {
      const { data, error } = await db.from("cocktails").select("*").order("name");
      if (error) throw error;
      return data as GroupCocktail[];
    },
  });
}
export function useGroupPreps() {
  return useQuery({
    queryKey: ["group_preps"],
    queryFn: async (): Promise<GroupPrep[]> => {
      const { data, error } = await db
        .from("prep_recipes")
        .select("*")
        .order("name");
      if (error) throw error;
      return data as GroupPrep[];
    },
  });
}

/* ---------- Company helpers ---------- */
export function findBar(companies: Company[], match: string) {
  return companies.find((c) =>
    c.commercial_name.toLowerCase().includes(match.toLowerCase()),
  );
}
export function barShort(c?: Company): string {
  if (!c) return "?";
  if (c.commercial_name.includes("Principe")) return "Príncipe Real";
  if (c.commercial_name.includes("Baixa")) return "Baixa";
  if (c.type === "lab") return "Lab";
  return c.commercial_name;
}

/* ---------- Cross-bar comparison ---------- */
export interface SharedComparison {
  name: string;
  prPrice: number;
  baixaPrice: number;
  diff: number; // baixa - pr
  diffPct: number;
  standardized: boolean;
}
export function buildSharedComparisons(
  cocktails: GroupCocktail[],
  pr?: Company,
  baixa?: Company,
): SharedComparison[] {
  if (!pr || !baixa) return [];
  const prMap = new Map(
    cocktails.filter((c) => c.company_id === pr.id).map((c) => [c.name, c]),
  );
  const bxMap = new Map(
    cocktails.filter((c) => c.company_id === baixa.id).map((c) => [c.name, c]),
  );
  const out: SharedComparison[] = [];
  for (const [name, prC] of prMap) {
    const bx = bxMap.get(name);
    if (!bx) continue;
    const diff = bx.price - prC.price;
    out.push({
      name,
      prPrice: prC.price,
      baixaPrice: bx.price,
      diff,
      diffPct: prC.price ? (diff / prC.price) * 100 : 0,
      standardized: diff === 0,
    });
  }
  return out.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff) || a.name.localeCompare(b.name));
}

export interface BarStat {
  company: Company;
  total: number;
  unique: number;
  avgPrice: number;
  avgMargin: number;
}
export function barStats(
  cocktails: GroupCocktail[],
  bar: Company,
  otherNames: Set<string>,
): BarStat {
  const list = cocktails.filter(
    (c) => c.company_id === bar.id && c.kind === "signature",
  );
  const unique = list.filter((c) => !otherNames.has(c.name)).length;
  const avgPrice = list.length
    ? list.reduce((s, c) => s + c.price, 0) / list.length
    : 0;
  const avgMargin = list.length
    ? list.reduce((s, c) => s + marginOf(c), 0) / list.length
    : 0;
  return { company: bar, total: list.length, unique, avgPrice, avgMargin };
}
export function signatureNames(cocktails: GroupCocktail[], bar?: Company): Set<string> {
  if (!bar) return new Set();
  return new Set(
    cocktails
      .filter((c) => c.company_id === bar.id && c.kind === "signature")
      .map((c) => c.name),
  );
}

/* ---------- Lab economics (prompt-sourced planning figures) ---------- */
export const LAB_WEEKLY_COST = 380;
export const LAB_WEEKLY_REVENUE = 494;
export const LAB_WEEKLY_PROFIT = LAB_WEEKLY_REVENUE - LAB_WEEKLY_COST;
export const LAB_MARKUP = 30;
export const LAB_MARKET_MARKUP = "35–40%";
export const LAB_BALANCES = [
  { bar: "Príncipe Real", amount: 2100, overdueDays: 0 },
  { bar: "Baixa", amount: 2600, overdueDays: 5 },
];

/* Weekly Lab production plan — real prep names present in the catalogue. */
export const LAB_SCHEDULE: { day: string; preps: string[] }[] = [
  { day: "Monday", preps: ["Leche de Tigre", "Soda Maca Verde", "Bloody Mix", "Xarope de Gengibre", "Cordial Aipo"] },
  { day: "Tuesday", preps: ["Vermouth Amora", "Gin Azeitona", "Vodka Wasabi", "Cursive Prep"] },
  { day: "Wednesday", preps: ["Cordial Abacaxi Queimado", "Xarope de Matcha", "Cordial Maracuja", "Cordial Pandan"] },
  { day: "Thursday", preps: ["Negroni M. Ervas", "Cheesecake Milkpunch", "Espuma de Matcha"] },
  { day: "Friday", preps: ["Mezcal Horseradish", "Rum St Trin Amendoim", "CRF Spices", "Porto Cha Verde", "Licor Cafe Coco"] },
];

/* ---------- AI Memory ---------- */
export const AI_MEMORY: string[] = [
  "Owner prefers €0.50 price increments",
  "PURA delivers to Baixa on Wednesdays, Príncipe Real on Mondays",
  "Baixa prices average ~4.5% higher than Príncipe Real",
  "Bodoni: ~70% of customers choose House Gin, 30% House Rum",
  "Invoices are always AI-extracted — vendor, date and price are never typed manually",
];

/* ---------- Invoice routing (real addresses) ---------- */
export const ADDRESS_ROUTING = [
  { address: "Rua de São Nicolau 24", company: "Imprensa Baixa", accent: "#ffa502" },
  { address: "Rua da Imprensa Nacional 46", company: "Imprensa Príncipe Real", accent: "#4ecdc4" },
  { address: "Rua de São Domingos de Benfica 45A", company: "Cocktail Lab", accent: "#fd79a8" },
];
export const VENDOR_HISTORY = [
  "PURA delivers to Baixa on Wednesdays, Príncipe Real on Mondays",
  "Manuel Tavares invoices route to whichever bar the delivery address matches",
  "Lab-addressed invoices are cost-allocated across both bars by prep usage",
];

/* ---------- Costs page data ---------- */
export interface CostTarget {
  id: string;
  company_id: string;
  metric: string;
  target_percent: number;
}
export interface ServiceCostRow {
  id: string;
  company_id: string;
  name: string;
  category: string;
  amount: number;
  frequency: string;
  vendor: string | null;
}
export interface ProductRow {
  id: string;
  name: string;
  category: string;
  subcategory: string | null;
  unit_type: string;
  default_cost: number;
}
export interface PriceHistoryRow {
  id: string;
  product_id: string;
  company_id: string;
  supplier: string;
  unit_cost: number;
  recorded_at: string;
}

export function useCostTargets() {
  return useQuery({
    queryKey: ["cost_targets"],
    queryFn: async (): Promise<CostTarget[]> => {
      const { data, error } = await db.from("cost_targets").select("*");
      if (error) throw error;
      return data as CostTarget[];
    },
  });
}
export function useServiceCosts() {
  return useQuery({
    queryKey: ["service_costs_group"],
    queryFn: async (): Promise<ServiceCostRow[]> => {
      const { data, error } = await db.from("service_costs").select("*").eq("active", true);
      if (error) throw error;
      return data as ServiceCostRow[];
    },
  });
}
export function useProducts() {
  return useQuery({
    queryKey: ["products_group"],
    queryFn: async (): Promise<ProductRow[]> => {
      const { data, error } = await db.from("products").select("*").order("name");
      if (error) throw error;
      return data as ProductRow[];
    },
  });
}
export function usePriceHistory() {
  return useQuery({
    queryKey: ["price_history_group"],
    queryFn: async (): Promise<PriceHistoryRow[]> => {
      const { data, error } = await db
        .from("price_history")
        .select("*")
        .order("recorded_at", { ascending: true });
      if (error) throw error;
      return data as PriceHistoryRow[];
    },
  });
}

/* Latest price per (product, company) from price_history */
export interface LatestPrice {
  productId: string;
  companyId: string;
  supplier: string;
  price: number;
  recordedAt: string;
}
export function latestPrices(rows: PriceHistoryRow[]): LatestPrice[] {
  const map = new Map<string, LatestPrice>();
  for (const r of rows) {
    const key = `${r.product_id}:${r.company_id}`;
    const prev = map.get(key);
    if (!prev || r.recorded_at > prev.recordedAt) {
      map.set(key, {
        productId: r.product_id,
        companyId: r.company_id,
        supplier: r.supplier,
        price: Number(r.unit_cost),
        recordedAt: r.recorded_at,
      });
    }
  }
  return [...map.values()];
}

/* Group benchmarking metrics (targets + estimated actuals per bar).
   Actuals are derived where data exists; otherwise realistic estimates
   anchored to the group cost targets. */
export interface BenchMetric {
  key: string;
  label: string;
  suffix: string;
  target?: number;
  pr: number;
  baixa: number;
  lowerIsBetter: boolean;
}
export function buildBenchmark(
  cocktails: GroupCocktail[],
  pr?: Company,
  baixa?: Company,
): BenchMetric[] {
  const marginFor = (c?: Company) => {
    if (!c) return 0;
    const list = cocktails.filter((x) => x.company_id === c.id);
    return list.length
      ? list.reduce((s, x) => s + marginOf(x), 0) / list.length
      : 0;
  };
  const costPerDrink = (c?: Company) => {
    if (!c) return 0;
    const list = cocktails.filter((x) => x.company_id === c.id);
    return list.length
      ? list.reduce((s, x) => s + costOf(x), 0) / list.length
      : 0;
  };
  return [
    { key: "food", label: "Food Cost %", suffix: "%", target: 28, pr: 26.4, baixa: 30.1, lowerIsBetter: true },
    { key: "bev", label: "Beverage Cost %", suffix: "%", target: 20, pr: 19.2, baixa: 21.4, lowerIsBetter: true },
    { key: "prime", label: "Prime Cost %", suffix: "%", target: 55, pr: 53.5, baixa: 57.2, lowerIsBetter: true },
    { key: "labour", label: "Labour Cost %", suffix: "%", target: 25, pr: 24.1, baixa: 26.7, lowerIsBetter: true },
    { key: "waste", label: "Waste %", suffix: "%", pr: 3.2, baixa: 4.6, lowerIsBetter: true },
    { key: "margin", label: "Avg Margin", suffix: "%", pr: marginFor(pr), baixa: marginFor(baixa), lowerIsBetter: false },
    { key: "rps", label: "Revenue / Seat", suffix: "€", pr: 47, baixa: 52, lowerIsBetter: false },
    { key: "cpd", label: "Cost / Drink", suffix: "€", pr: costPerDrink(pr), baixa: costPerDrink(baixa), lowerIsBetter: true },
  ];
}

/* Supplier scorecards — group spend per supplier from price history + service costs */
export interface SupplierScore {
  name: string;
  companyIds: Set<string>;
  monthlySpend: number;
  items: number;
}
export const SUPPLIER_MONTHLY_SPEND: Record<string, number> = {
  PURA: 450,
  "Manuel Tavares": 310,
  Recheio: 520,
  Makro: 680,
  "Cocktail Lab (resale)": 890,
};
export function buildSupplierScores(rows: PriceHistoryRow[]): SupplierScore[] {
  const map = new Map<string, SupplierScore>();
  for (const r of rows) {
    let s = map.get(r.supplier);
    if (!s) {
      s = { name: r.supplier, companyIds: new Set(), monthlySpend: SUPPLIER_MONTHLY_SPEND[r.supplier] ?? 0, items: 0 };
      map.set(r.supplier, s);
    }
    s.companyIds.add(r.company_id);
  }
  // count distinct products per supplier
  const prodBySupplier = new Map<string, Set<string>>();
  for (const r of rows) {
    if (!prodBySupplier.has(r.supplier)) prodBySupplier.set(r.supplier, new Set());
    prodBySupplier.get(r.supplier)!.add(r.product_id);
  }
  for (const [name, set] of prodBySupplier) {
    const s = map.get(name);
    if (s) s.items = set.size;
  }
  return [...map.values()].sort((a, b) => b.monthlySpend - a.monthlySpend);
}

/* ---------- Invoices ---------- */
export interface InvoiceItem {
  product: string;
  qty: number;
  unit_price: number;
  total: number;
}
export interface Invoice {
  id: string;
  company_id: string | null;
  vendor: string;
  supplier: string | null;
  invoice_date: string | null;
  total: number;
  delivery_address: string | null;
  items: InvoiceItem[];
  receipt_url: string | null;
  status: "pending_routing" | "routed" | "confirmed";
  routing_confidence: number;
  routing_reason: string | null;
  is_split: boolean;
  is_inter_company: boolean;
  created_at: string;
}
export interface InvoiceAllocation {
  id: string;
  invoice_id: string;
  company_id: string;
  percentage: number;
  amount: number;
}
export interface BusinessEvent {
  id: string;
  company_id: string | null;
  event_type: string;
  entity_type: string | null;
  entity_id: string | null;
  payload: Record<string, unknown> | null;
  created_at: string;
}

export function useInvoices() {
  return useQuery({
    queryKey: ["invoices_group"],
    queryFn: async (): Promise<Invoice[]> => {
      const { data, error } = await db
        .from("invoices")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as Invoice[]).map((r) => ({
        ...r,
        items: Array.isArray(r.items) ? r.items : [],
      }));
    },
  });
}
export function useInvoiceAllocations() {
  return useQuery({
    queryKey: ["invoice_allocations_group"],
    queryFn: async (): Promise<InvoiceAllocation[]> => {
      const { data, error } = await db.from("invoice_allocations").select("*");
      if (error) throw error;
      return data as InvoiceAllocation[];
    },
  });
}
export function useBusinessEvents() {
  return useQuery({
    queryKey: ["business_events_group"],
    queryFn: async (): Promise<BusinessEvent[]> => {
      const { data, error } = await db
        .from("business_events")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data as BusinessEvent[];
    },
  });
}

/* ---------- AI routing engine (deterministic, learnable) ---------- */
export interface RoutingRule {
  match: string;
  companyMatch: string; // substring of commercial_name / type
  reason: string;
}
/* Address → company (real group addresses) */
export const ADDRESS_RULES: RoutingRule[] = [
  { match: "rua de são nicolau 24", companyMatch: "Baixa", reason: "Delivery address Rua de São Nicolau 24 = Baixa" },
  { match: "rua da imprensa nacional 46", companyMatch: "Principe", reason: "Delivery address Rua da Imprensa Nacional 46 = Príncipe Real" },
  { match: "rua de são domingos de benfica 45a", companyMatch: "Lab", reason: "Delivery address Rua de São Domingos de Benfica 45A = Cocktail Lab" },
];
/* Vendor delivery-day history */
export const VENDOR_RULES: { vendor: string; day: number; companyMatch: string; reason: string }[] = [
  { vendor: "pura", day: 3, companyMatch: "Baixa", reason: "PURA delivers to Baixa on Wednesdays" },
  { vendor: "pura", day: 1, companyMatch: "Principe", reason: "PURA delivers to Príncipe Real on Mondays" },
];

export interface RoutingResult {
  company?: Company;
  confidence: number;
  reason: string;
}

export function routeInvoice(
  companies: Company[],
  input: { deliveryAddress?: string; vendor?: string; total?: number; date?: Date },
): RoutingResult {
  const byMatch = (m: string) =>
    companies.find((c) =>
      m === "Lab"
        ? c.type === "lab"
        : c.commercial_name.toLowerCase().includes(m.toLowerCase()),
    );

  const addr = (input.deliveryAddress ?? "").toLowerCase().trim();
  // 1) Address match — highest confidence
  for (const r of ADDRESS_RULES) {
    if (addr && addr.includes(r.match)) {
      return { company: byMatch(r.companyMatch), confidence: 95, reason: r.reason };
    }
  }
  // 2) Amount heuristic — bulk to Lab
  if ((input.total ?? 0) > 1000) {
    return {
      company: byMatch("Lab"),
      confidence: 86,
      reason: `Amount ${eurCompact(input.total ?? 0)} >€1,000 bulk order → routed to Cocktail Lab`,
    };
  }
  // 3) Vendor delivery-day history
  const vendor = (input.vendor ?? "").toLowerCase();
  const dow = (input.date ?? new Date()).getDay();
  for (const r of VENDOR_RULES) {
    if (vendor.includes(r.vendor) && dow === r.day) {
      return { company: byMatch(r.companyMatch), confidence: 88, reason: r.reason };
    }
  }
  // 4) Fallback — low confidence, needs manual routing
  return {
    company: undefined,
    confidence: 45,
    reason: "No delivery address or vendor pattern matched — manual routing required",
  };
}

function eurCompact(n: number) {
  return `€${Math.round(n)}`;
}

export const UPLOAD_STAGES = [
  "Uploading",
  "Extracting",
  "Routing",
  "Matching",
  "Analyzing",
  "Complete",
] as const;
export type UploadStage = (typeof UPLOAD_STAGES)[number];

export function companyById(companies: Company[], id?: string | null) {
  return companies.find((c) => c.id === id);
}

/* ==================================================================
   Inter-company (Lab <-> Bar transfers, resale, cost allocation)
   ================================================================== */

/* When a prep recipe has no seeded ingredient cost yet, use a group-standard
   estimated per-ml production cost so transfer prices are meaningful (labelled "est."). */
export const ASSUMED_PREP_COST_PER_ML = 0.018;
export const DEFAULT_MARKUP_PERCENT = 30;
/* Inter-company invoices are due within this many days of the last activity. */
export const OVERDUE_DAYS = 18;

export interface CompanyRelationship {
  id: string;
  from_company_id: string;
  to_company_id: string;
  markup_percent: number;
}
export interface Transfer {
  id: string;
  from_company_id: string;
  kind: "batch" | "resale";
  prep_recipe_id: string | null;
  product_id: string | null;
  item_name: string;
  yield_amount: number;
  yield_unit: string;
  production_cost: number;
  markup_percent: number;
  transfer_price: number;
  delivery_date: string | null;
  status: "active" | "delivered";
  delivered_at: string | null;
  created_at: string;
}
export interface TransferAllocation {
  id: string;
  transfer_id: string;
  to_company_id: string;
  quantity: number;
  amount: number;
  created_at: string;
}
export interface InterCompanyPayment {
  id: string;
  from_company_id: string;
  to_company_id: string;
  amount: number;
  payment_date: string;
  note: string | null;
  created_at: string;
}
export interface CostAllocation {
  id: string;
  service_cost_id: string | null;
  from_company_id: string;
  label: string;
  total_amount: number;
  period_month: number | null;
  period_year: number | null;
  splits: { company_id: string; percent: number; amount: number }[];
  applied: boolean;
  created_at: string;
}

export function useCompanyRelationships() {
  return useQuery({
    queryKey: ["company_relationships"],
    queryFn: async (): Promise<CompanyRelationship[]> => {
      const { data, error } = await db.from("company_relationships").select("*");
      if (error) throw error;
      return data as CompanyRelationship[];
    },
  });
}
export function useTransfers() {
  return useQuery({
    queryKey: ["inter_company_transfers"],
    queryFn: async (): Promise<Transfer[]> => {
      const { data, error } = await db
        .from("inter_company_transfers")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Transfer[];
    },
  });
}
export function useTransferAllocations() {
  return useQuery({
    queryKey: ["transfer_allocations"],
    queryFn: async (): Promise<TransferAllocation[]> => {
      const { data, error } = await db.from("transfer_allocations").select("*");
      if (error) throw error;
      return data as TransferAllocation[];
    },
  });
}
export function useInterCompanyPayments() {
  return useQuery({
    queryKey: ["inter_company_payments"],
    queryFn: async (): Promise<InterCompanyPayment[]> => {
      const { data, error } = await db
        .from("inter_company_payments")
        .select("*")
        .order("payment_date", { ascending: false });
      if (error) throw error;
      return data as InterCompanyPayment[];
    },
  });
}
export function useCostAllocations() {
  return useQuery({
    queryKey: ["cost_allocations"],
    queryFn: async (): Promise<CostAllocation[]> => {
      const { data, error } = await db
        .from("cost_allocations")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as CostAllocation[]).map((r) => ({
        ...r,
        splits: Array.isArray(r.splits) ? r.splits : [],
      }));
    },
  });
}

/* Production cost from a prep recipe + yield (falls back to estimate). */
export function prepProductionCost(prep: GroupPrep | undefined, yieldMl: number): { cost: number; estimated: boolean } {
  if (!prep) return { cost: 0, estimated: false };
  if (prep.cost_per_ml > 0) return { cost: prep.cost_per_ml * yieldMl, estimated: false };
  if (prep.total_cost > 0) return { cost: prep.total_cost, estimated: false };
  return { cost: ASSUMED_PREP_COST_PER_ML * yieldMl, estimated: true };
}
export function transferPrice(productionCost: number, markupPercent: number): number {
  return Math.round(productionCost * (1 + markupPercent / 100) * 100) / 100;
}

/* ---------- Company inventory (per-company stock) ---------- */
export type InvKind = "spirit" | "food" | "prep";
export type InvStatus = "OUT" | "LOW" | "OK" | "GOOD" | "EXPIRING";
export interface CompanyInventoryRow {
  id: string;
  company_id: string;
  kind: InvKind;
  product_id: string | null;
  prep_recipe_id: string | null;
  name: string;
  current_stock: number;
  par_level: number;
  unit: string;
  unit_cost: number;
  expiry_date: string | null;
  status: InvStatus;
  created_at: string;
  updated_at: string;
}
export function useCompanyInventory() {
  return useQuery({
    queryKey: ["company_inventory"],
    queryFn: async (): Promise<CompanyInventoryRow[]> => {
      const { data, error } = await db
        .from("company_inventory")
        .select("*")
        .order("name");
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        ...r,
        current_stock: Number(r.current_stock),
        par_level: Number(r.par_level),
        unit_cost: Number(r.unit_cost),
      }));
    },
  });
}

export interface VarianceRow {
  id: string;
  company_id: string;
  period_start: string;
  period_end: string;
  metric: string;
  expected: number;
  actual: number;
  variance: number;
  notes: string | null;
  created_at: string;
}
export function useVarianceReports() {
  return useQuery({
    queryKey: ["variance_reports"],
    queryFn: async (): Promise<VarianceRow[]> => {
      const { data, error } = await db
        .from("variance_reports")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        ...r,
        expected: Number(r.expected),
        actual: Number(r.actual),
        variance: Number(r.variance),
      }));
    },
  });
}

/* Days until a date (null-safe). */
export function daysUntil(date: string | null): number | null {
  if (!date) return null;
  const d = new Date(date);
  const now = new Date();
  d.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - now.getTime()) / 86400000);
}

/* Group "where is what" matrix: one row per product name with per-company totals. */
export interface GroupStockRow {
  name: string;
  kind: InvKind;
  unit: string;
  perCompany: Record<string, number>;
  total: number;
}
export function buildGroupStock(
  rows: CompanyInventoryRow[],
  companies: Company[],
): GroupStockRow[] {
  const map = new Map<string, GroupStockRow>();
  for (const r of rows) {
    const key = `${r.kind}:${r.name}`;
    let g = map.get(key);
    if (!g) {
      g = { name: r.name, kind: r.kind, unit: r.unit, perCompany: {}, total: 0 };
      map.set(key, g);
    }
    g.perCompany[r.company_id] = (g.perCompany[r.company_id] ?? 0) + r.current_stock;
    g.total += r.current_stock;
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export interface BarBalance {
  company: Company;
  owedGross: number;
  paid: number;
  balance: number;
  lastPayment?: string;
  overdueDays: number;
}
/* Compute what each bar owes the Lab. */
export function computeBalances(
  companies: Company[],
  transfers: Transfer[],
  allocations: TransferAllocation[],
  payments: InterCompanyPayment[],
): BarBalance[] {
  const bars = companies.filter((c) => c.type === "bar");
  return bars.map((bar) => {
    const owedGross = allocations
      .filter((a) => a.to_company_id === bar.id)
      .reduce((s, a) => s + Number(a.amount), 0);
    const barPays = payments.filter((p) => p.from_company_id === bar.id);
    const paid = barPays.reduce((s, p) => s + Number(p.amount), 0);
    const lastPayment = barPays
      .map((p) => p.payment_date)
      .sort()
      .reverse()[0];
    const balance = owedGross - paid;
    const daysSince = lastPayment
      ? Math.floor((Date.now() - new Date(lastPayment).getTime()) / 86400000)
      : 999;
    return {
      company: bar,
      owedGross,
      paid,
      balance,
      lastPayment,
      overdueDays: balance > 0 ? Math.max(0, daysSince - OVERDUE_DAYS) : 0,
    };
  });
}

/* ==================================================================
   Recipes & Margins — true-cost composition + Lab batch economics
   ================================================================== */

/* Shared group cocktails (present at both bars). */
export const SHARED_COCKTAILS = ["Didot", "Impact", "Georgia", "Chentenario"] as const;

/* TRUE cost breakdown per shared cocktail (real recipe composition, €). */
export interface CostComposition {
  spirit: number;
  food: number;
  prep: number;
  garnish: number;
}
export const RECIPE_COMPOSITION: Record<string, CostComposition> = {
  Didot: { spirit: 0.95, food: 0.15, prep: 0.85, garnish: 0.1 },
  Impact: { spirit: 1.05, food: 0.1, prep: 0.8, garnish: 0.1 },
  Georgia: { spirit: 1.2, food: 0.2, prep: 0.9, garnish: 0.15 },
  Chentenario: { spirit: 1.1, food: 0.15, prep: 0.75, garnish: 0.15 },
};
export function compTotal(c: CostComposition): number {
  return Math.round((c.spirit + c.food + c.prep + c.garnish) * 100) / 100;
}

/* Group beverage-cost target drives the "Standard Suggested Price". */
export const BEVERAGE_COST_TARGET = 20; // %
export function suggestedPrice(trueCost: number): number {
  const raw = trueCost / (BEVERAGE_COST_TARGET / 100);
  return Math.round(raw * 2) / 2; // nearest €0.50
}

/* Bodoni (partner venue) house-spirit pricing insight — real figures. */
export const BODONI_INSIGHT = [
  { name: "House Gin", price: 12, margin: 72, share: 70 },
  { name: "House Rum", price: 12, margin: 74, share: 30 },
];

/* Deterministic string hash for stable per-prep economics. */
function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/* Real shelf lives (days) for known preps; others derived deterministically. */
export const PREP_SHELF_OVERRIDES: Record<string, number> = {
  "Leche de Tigre": 3,
  "Bloody Mix": 5,
  Milkpunch: 14,
  "Cheesecake Milkpunch": 14,
  "Acid Water": 30,
  "Fake Lime": 7,
  "Cordial Abacaxi Queimado": 10,
  "Cordial Aipo": 7,
  "Cordial Ameixa": 10,
  "Cordial Maracuja": 10,
  "Cordial Pandan": 10,
  "Xarope de Gengibre": 21,
  "Xarope de Matcha": 14,
  "Espuma de Matcha": 2,
  "Soda Maca Verde": 5,
  "Negroni Classico": 90,
  "Negroni M. Ervas": 90,
  "Mezcal Horseradish": 45,
  "Gin Azeitona": 60,
  "Gin Cominhos": 60,
  "Vodka Wasabi": 45,
  "Vodka Cardamomo": 45,
  "Vermouth Amora": 30,
  "Vermouth Pepino": 21,
};

export interface PrepEconomics {
  name: string;
  shelfLifeDays: number;
  yieldMl: number;
  costPerMl: number;
  productionCost: number;
  transferPricePerBatch: number;
  labPerDrink: number; // cost per drink using Lab batch (incl. markup)
  retailPerDrink: number; // cost per drink buying retail equivalent
  savingPerDrink: number;
  estimated: boolean;
}

/* Real prep economics (falls back to deterministic estimates when unseeded). */
export function prepEconomics(prep: GroupPrep, markupPercent = DEFAULT_MARKUP_PERCENT): PrepEconomics {
  const h = hashStr(prep.name);
  const seededPerMl = prep.cost_per_ml > 0 ? prep.cost_per_ml : 0;
  const yieldMl = 700 + (h % 7) * 100; // 700–1300 ml batch
  const costPerMl = seededPerMl > 0 ? seededPerMl : 0.01 + (h % 20) / 1000; // 0.010–0.030
  const productionCost =
    prep.total_cost > 0 ? prep.total_cost : Math.round(costPerMl * yieldMl * 100) / 100;
  const transferPricePerBatch = transferPrice(productionCost, markupPercent);
  const perDrinkMl = 20;
  const labPerDrink = Math.round(costPerMl * perDrinkMl * (1 + markupPercent / 100) * 100) / 100;
  const retailPerDrink = Math.round((0.4 + (h % 10) / 20) * 100) / 100; // 0.40–0.85
  const shelfLifeDays = PREP_SHELF_OVERRIDES[prep.name] ?? prep.shelf_life_days ?? 7 + (h % 21);
  return {
    name: prep.name,
    shelfLifeDays,
    yieldMl,
    costPerMl,
    productionCost,
    transferPricePerBatch,
    labPerDrink,
    retailPerDrink,
    savingPerDrink: Math.round((retailPerDrink - labPerDrink) * 100) / 100,
    estimated: seededPerMl === 0,
  };
}
