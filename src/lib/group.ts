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
