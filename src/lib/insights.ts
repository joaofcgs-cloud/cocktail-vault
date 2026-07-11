import type { InventoryItem, Cocktail, FoodItem, Invoice } from "@/lib/db";

export type Severity = "info" | "warning" | "critical";

export interface Insight {
  id: string;
  type: "price" | "margin" | "waste" | "stock" | "supplier" | "target";
  icon: string;
  title: string;
  description: string;
  severity: Severity;
  chips?: string[];
  action: { label: string; to: string };
}

// Cost targets from the V2 knowledge file.
export const COST_TARGETS = {
  food: { target: 28, warning: 30, alert: 32 },
  beverage: { target: 20, warning: 22, alert: 25 },
  prime: { target: 55, warning: 58, alert: 62 },
  labour: { target: 25, warning: 28, alert: 30 },
  margin: { good: 75, warning: 65, alert: 55 },
} as const;

/** Classify an invoice as food / beverage / operating from vendor + category. */
export function classifyInvoice(inv: Invoice): "food" | "beverage" | "operating" {
  const v = (inv.vendor || "").toLowerCase();
  const c = `${inv.category || ""} ${inv.subcategory || ""}`.toLowerCase();
  if (/alcohol|spirit|wine|beer|beverage/.test(c)) return "beverage";
  if (/pura|produtos|regionais|agr|food|produce|continente/.test(v) || /food|produce/.test(c))
    return "food";
  if (/garrafeira|pepper|basil|black pepper|iceology|ice/.test(v)) return "beverage";
  if (/edp|comercial|espelhad|rent|energ|util/.test(v)) return "operating";
  if (/bar supplies|equipment|services/.test(c)) return "operating";
  return "operating";
}

function monthKey(d: string | null): string {
  if (!d) return "";
  return d.slice(0, 7);
}

export interface MonthSpend {
  thisMonth: number;
  lastMonth: number;
  food: number;
  beverage: number;
  operating: number;
}

export function computeSpend(invoices: Invoice[], ref = new Date()): MonthSpend {
  const thisKey = `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, "0")}`;
  const last = new Date(ref.getFullYear(), ref.getMonth() - 1, 1);
  const lastKey = `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, "0")}`;
  let thisMonth = 0,
    lastMonth = 0,
    food = 0,
    beverage = 0,
    operating = 0;
  for (const inv of invoices) {
    const k = monthKey(inv.date);
    const amt = inv.total || 0;
    if (k === thisKey) {
      thisMonth += amt;
      const cls = classifyInvoice(inv);
      if (cls === "food") food += amt;
      else if (cls === "beverage") beverage += amt;
      else operating += amt;
    } else if (k === lastKey) {
      lastMonth += amt;
    }
  }
  return { thisMonth, lastMonth, food, beverage, operating };
}

/** Build actionable AI insights from real data, newest/most-severe first. */
export function buildInsights({
  inventory,
  food,
  cocktails,
  invoices,
}: {
  inventory: InventoryItem[];
  food: FoodItem[];
  cocktails: Cocktail[];
  invoices: Invoice[];
}): Insight[] {
  const out: Insight[] = [];

  // Waste: food expiring soon
  const expiring = food.filter((f) => f.status === "EXPIRING");
  if (expiring.length) {
    const lost = expiring.reduce(
      (s, f) => s + (f.current_stock || 0) * (f.unit_cost || 0),
      0,
    );
    out.push({
      id: "waste-expiring",
      type: "waste",
      icon: "🗑️",
      title: `${expiring.length} item${expiring.length > 1 ? "s" : ""} expiring soon`,
      description: `${expiring
        .slice(0, 3)
        .map((f) => f.name)
        .join(", ")} will spoil, risking ~${lost.toFixed(2)}€ in waste. Batch a prep or feature a special.`,
      severity: "critical",
      chips: expiring.slice(0, 5).map((f) => f.name),
      action: { label: "Review food stock", to: "/stock" },
    });
  }

  // Stock: out of stock spirits
  const outStock = inventory.filter((i) => i.status === "OUT");
  const lowStock = inventory.filter((i) => i.status === "LOW");
  if (outStock.length) {
    out.push({
      id: "stock-out",
      type: "stock",
      icon: "📦",
      title: `${outStock.length} product${outStock.length > 1 ? "s" : ""} out of stock`,
      description: `${outStock
        .slice(0, 3)
        .map((i) => i.name)
        .join(", ")} hit zero. Reorder before service to avoid 86'd drinks.`,
      severity: "critical",
      chips: outStock.slice(0, 5).map((i) => i.name),
      action: { label: "Order low stock", to: "/stock" },
    });
  } else if (lowStock.length >= 3) {
    out.push({
      id: "stock-low",
      type: "stock",
      icon: "📦",
      title: `${lowStock.length} products running low`,
      description: `Below par level: ${lowStock
        .slice(0, 3)
        .map((i) => i.name)
        .join(", ")}. Reorder now to avoid a weekend stockout.`,
      severity: "warning",
      chips: lowStock.slice(0, 5).map((i) => i.name),
      action: { label: "Review stock", to: "/stock" },
    });
  }

  // Margin: cocktails below target
  const weak = cocktails
    .filter((c) => c.margin_percent < COST_TARGETS.margin.warning)
    .sort((a, b) => a.margin_percent - b.margin_percent);
  if (weak.length) {
    const worst = weak[0];
    out.push({
      id: "margin-weak",
      type: "margin",
      icon: "📉",
      title: `${weak.length} cocktail${weak.length > 1 ? "s" : ""} below ${COST_TARGETS.margin.warning}% margin`,
      description: `${worst.name} is at ${worst.margin_percent.toFixed(1)}% margin. Raise price, trim ingredient cost, or feature as premium.`,
      severity: worst.margin_percent < COST_TARGETS.margin.alert ? "critical" : "warning",
      chips: weak.slice(0, 5).map((c) => c.name),
      action: { label: "Review margins", to: "/calculators" },
    });
  }

  // Spend spike vs last month
  const spend = computeSpend(invoices);
  if (spend.lastMonth > 0) {
    const delta = ((spend.thisMonth - spend.lastMonth) / spend.lastMonth) * 100;
    if (delta > 10) {
      out.push({
        id: "spend-spike",
        type: "price",
        icon: "💰",
        title: `Purchases up ${delta.toFixed(1)}% vs last month`,
        description: `You spent ${spend.thisMonth.toFixed(0)}€ this month vs ${spend.lastMonth.toFixed(
          0,
        )}€ last month. Check which suppliers drove the increase.`,
        severity: delta > 25 ? "critical" : "warning",
        action: { label: "See cost breakdown", to: "/costs" },
      });
    }
  }

  const sev = { critical: 0, warning: 1, info: 2 } as const;
  return out.sort((a, b) => sev[a.severity] - sev[b.severity]);
}