import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { db, type Cocktail, type DailySale } from "@/lib/db";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { eur, num, marginColor } from "@/lib/format";
import { Trophy } from "lucide-react";

export const Route = createFileRoute("/_authenticated/sales")({
  head: () => ({ meta: [{ title: "Sales — Bar Command Center" }] }),
  component: SalesPage,
});

// Fixed display order for menu categories
const CATEGORY_ORDER = [
  "Soft Drinks & Beer",
  "Spirits",
  "Signature Cocktails",
  "Classic Cocktails",
  "Wines",
  "Food",
] as const;

const CAT_COLOR: Record<string, string> = {
  "Soft Drinks & Beer": "var(--teal)",
  Spirits: "var(--orange)",
  "Signature Cocktails": "var(--pink)",
  "Classic Cocktails": "var(--purple)",
  Wines: "var(--red)",
  Food: "var(--green)",
};

const tooltipStyle = {
  backgroundColor: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 12,
  color: "var(--foreground)",
};
const axis = { fontSize: 11, fill: "var(--muted-foreground)" };

interface ItemStats extends Cocktail {
  qty: number;
  revenue: number;
  profit: number;
}

function SalesPage() {
  const [catFilter, setCatFilter] = useState("all");

  const { data: items = [] } = useQuery({
    queryKey: ["cocktails"],
    queryFn: async (): Promise<Cocktail[]> => {
      const { data, error } = await db.from("cocktails").select("*");
      if (error) throw error;
      return data;
    },
  });

  const { data: sales = [] } = useQuery({
    queryKey: ["daily_sales"],
    queryFn: async (): Promise<DailySale[]> => {
      const { data, error } = await db.from("daily_sales").select("*");
      if (error) throw error;
      return data;
    },
  });

  // aggregate sales per item
  const salesByItem = useMemo(() => {
    const map = new Map<string, { qty: number; revenue: number; profit: number }>();
    for (const s of sales) {
      if (!s.cocktail_id) continue;
      const cur = map.get(s.cocktail_id) ?? { qty: 0, revenue: 0, profit: 0 };
      cur.qty += s.quantity_sold;
      cur.revenue += s.revenue;
      cur.profit += s.profit;
      map.set(s.cocktail_id, cur);
    }
    return map;
  }, [sales]);

  const enriched: ItemStats[] = useMemo(
    () =>
      items.map((it) => {
        const s = salesByItem.get(it.id) ?? { qty: 0, revenue: 0, profit: 0 };
        return { ...it, ...s };
      }),
    [items, salesByItem],
  );

  // group by category, keeping fixed order + any extra categories after
  const grouped = useMemo(() => {
    const map = new Map<string, ItemStats[]>();
    for (const it of enriched) {
      const cat = it.category || "Uncategorized";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(it);
    }
    const ordered: [string, ItemStats[]][] = [];
    for (const cat of CATEGORY_ORDER) {
      if (map.has(cat)) {
        ordered.push([cat, map.get(cat)!]);
        map.delete(cat);
      }
    }
    for (const [cat, list] of map) ordered.push([cat, list]);
    return ordered.map(
      ([cat, list]) =>
        [
          cat,
          list.sort((a, b) => b.profit - a.profit),
        ] as [string, ItemStats[]],
    );
  }, [enriched]);

  const visibleGroups =
    catFilter === "all" ? grouped : grouped.filter(([c]) => c === catFilter);

  // best sellers by profit (top 10 across all)
  const bestSellers = useMemo(
    () =>
      [...enriched]
        .filter((i) => i.profit > 0)
        .sort((a, b) => b.profit - a.profit)
        .slice(0, 10)
        .map((i) => ({ name: i.name, profit: +i.profit.toFixed(0), category: i.category })),
    [enriched],
  );

  const totalRevenue = enriched.reduce((s, i) => s + i.revenue, 0);
  const totalProfit = enriched.reduce((s, i) => s + i.profit, 0);
  const totalUnits = enriched.reduce((s, i) => s + i.qty, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight md:text-3xl">Sales</h1>
          <p className="text-sm text-muted-foreground">
            {items.length} items · {num(totalUnits, 0)} sold · {eur(totalRevenue)} revenue
          </p>
        </div>
        <Select value={catFilter} onValueChange={setCatFilter}>
          <SelectTrigger className="h-11 w-56">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {grouped.map(([cat]) => (
              <SelectItem key={cat} value={cat}>
                {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Kpi label="Revenue" value={eur(totalRevenue)} tone="var(--teal)" />
        <Kpi label="Profit" value={eur(totalProfit)} tone="var(--green)" />
        <Kpi label="Units Sold" value={num(totalUnits, 0)} tone="var(--foreground)" />
      </div>

      {/* Best sellers */}
      <Card className="border-border bg-card p-4 md:p-5">
        <div className="mb-4 flex items-center gap-2">
          <Trophy className="h-4 w-4 text-orange" />
          <h2 className="text-sm font-bold uppercase tracking-wide">
            Best Sellers by Profit
          </h2>
        </div>
        {bestSellers.length > 0 ? (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={bestSellers} layout="vertical" margin={{ left: 24, right: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
              <XAxis type="number" tick={axis} tickFormatter={(v) => `€${v}`} />
              <YAxis type="category" dataKey="name" tick={axis} width={90} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => eur(v)} />
              <Bar dataKey="profit" radius={[0, 4, 4, 0]}>
                {bestSellers.map((b, i) => (
                  <Cell key={i} fill={CAT_COLOR[b.category ?? ""] ?? "var(--teal)"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No sales recorded yet. Import your sales list to see best sellers.
          </p>
        )}
      </Card>

      {/* Categories */}
      {visibleGroups.map(([cat, list]) => {
        const catRevenue = list.reduce((s, i) => s + i.revenue, 0);
        const catProfit = list.reduce((s, i) => s + i.profit, 0);
        const color = CAT_COLOR[cat] ?? "var(--teal)";
        return (
          <div key={cat} className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: color }}
                />
                <h2 className="text-lg font-black tracking-tight">{cat}</h2>
                <span className="text-xs text-muted-foreground">
                  {list.length} items
                </span>
              </div>
              <div className="text-right text-sm">
                <span className="font-bold" style={{ color }}>
                  {eur(catRevenue)}
                </span>
                <span className="ml-2 text-muted-foreground">
                  · {eur(catProfit)} profit
                </span>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((it) => (
                <Card key={it.id} className="flex flex-col border-border bg-card p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold tracking-tight">{it.name}</h3>
                    <span className="shrink-0 font-black text-teal">{eur(it.price)}</span>
                  </div>
                  {it.specs && (
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {it.specs}
                    </p>
                  )}
                  <div className="mt-3 grid grid-cols-3 gap-2 border-t border-border pt-3 text-xs">
                    <div>
                      <p className="text-muted-foreground">Sold</p>
                      <p className="font-bold">{num(it.qty, 0)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Revenue</p>
                      <p className="font-bold">{eur(it.revenue)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-muted-foreground">Profit</p>
                      <p className="font-bold text-green">{eur(it.profit)}</p>
                    </div>
                  </div>
                  {it.margin_percent > 0 && (
                    <div className="mt-2 flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Margin</span>
                      <span
                        className="font-bold"
                        style={{ color: marginColor(it.margin_percent) }}
                      >
                        {num(it.margin_percent)}%
                      </span>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <Card className="border-border bg-card p-4">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <p className="mt-2 text-lg font-black md:text-xl" style={{ color: tone }}>
        {value}
      </p>
    </Card>
  );
}
