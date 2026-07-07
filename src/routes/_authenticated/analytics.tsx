import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";
import { Card } from "@/components/ui/card";
import { useSales, useCocktails } from "@/lib/queries";
import { eur, num } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/analytics")({
  head: () => ({ meta: [{ title: "Analytics — Bar Command Center" }] }),
  component: Analytics,
});

const PALETTE = [
  "var(--teal)",
  "var(--green)",
  "var(--orange)",
  "var(--purple)",
  "var(--pink)",
  "var(--red)",
];

function ChartCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="border-border bg-card p-4">
      <h2 className="mb-4 text-sm font-bold uppercase tracking-wide">{title}</h2>
      {children}
    </Card>
  );
}

const axis = { fontSize: 11, fill: "var(--muted-foreground)" };
const tooltipStyle = {
  backgroundColor: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 12,
  color: "var(--foreground)",
};

function Analytics() {
  const { data: sales = [] } = useSales();
  const { data: cocktails = [] } = useCocktails();

  const cocktailById = useMemo(
    () => Object.fromEntries(cocktails.map((c) => [c.id, c])),
    [cocktails],
  );

  // daily revenue
  const daily = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of sales) map.set(s.date, (map.get(s.date) ?? 0) + s.revenue);
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, revenue]) => ({
        date: date.slice(5),
        revenue: +revenue.toFixed(0),
      }));
  }, [sales]);

  // per cocktail aggregates
  const perCocktail = useMemo(() => {
    const map = new Map<
      string,
      { name: string; qty: number; revenue: number; profit: number; price: number; margin: number; pourCost: number }
    >();
    for (const s of sales) {
      const c = s.cocktail_id ? cocktailById[s.cocktail_id] : null;
      if (!c) continue;
      const cur =
        map.get(c.id) ??
        {
          name: c.name,
          qty: 0,
          revenue: 0,
          profit: 0,
          price: c.price,
          margin: c.margin_percent,
          pourCost: c.price > 0 ? (c.est_cost / c.price) * 100 : 0,
        };
      cur.qty += s.quantity_sold;
      cur.revenue += s.revenue;
      cur.profit += s.profit;
      map.set(c.id, cur);
    }
    return Array.from(map.values());
  }, [sales, cocktailById]);

  const totalRevenue = sales.reduce((s, x) => s + x.revenue, 0);
  const totalDrinks = sales.reduce((s, x) => s + x.quantity_sold, 0);
  const avgTicket = totalDrinks > 0 ? totalRevenue / totalDrinks : 0;
  const bestDay = daily.reduce(
    (best, d) => (d.revenue > best.revenue ? d : best),
    { date: "—", revenue: 0 },
  );

  const topByRevenue = [...perCocktail].sort((a, b) => b.revenue - a.revenue).slice(0, 10);
  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of sales) {
      const c = s.cocktail_id ? cocktailById[s.cocktail_id] : null;
      const cat = c?.specs?.split("|")[0]?.trim() || "Other";
      map.set(cat, (map.get(cat) ?? 0) + s.revenue);
    }
    return Array.from(map.entries()).map(([name, value]) => ({ name, value: +value.toFixed(0) }));
  }, [sales, cocktailById]);

  const pourCostSorted = [...perCocktail].sort((a, b) => b.pourCost - a.pourCost);
  const profitRanked = [...perCocktail].sort((a, b) => b.profit - a.profit);

  // day of week
  const dow = useMemo(() => {
    const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const totals = new Array(7).fill(0);
    for (const s of sales) {
      const d = new Date(s.date + "T00:00:00");
      totals[d.getDay()] += s.revenue;
    }
    return names.map((name, i) => ({ name, revenue: +totals[i].toFixed(0) }));
  }, [sales]);

  // menu engineering
  const avgQty = perCocktail.length
    ? perCocktail.reduce((s, c) => s + c.qty, 0) / perCocktail.length
    : 0;
  const avgMargin = perCocktail.length
    ? perCocktail.reduce((s, c) => s + c.margin, 0) / perCocktail.length
    : 0;
  const matrix = perCocktail.map((c) => {
    let quad: "Star" | "Puzzle" | "Plowhorse" | "Dog";
    if (c.qty >= avgQty && c.margin >= avgMargin) quad = "Star";
    else if (c.qty < avgQty && c.margin >= avgMargin) quad = "Puzzle";
    else if (c.qty >= avgQty && c.margin < avgMargin) quad = "Plowhorse";
    else quad = "Dog";
    return { ...c, quad };
  });
  const quadColor: Record<string, string> = {
    Star: "var(--green)",
    Puzzle: "var(--orange)",
    Plowhorse: "var(--purple)",
    Dog: "var(--red)",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black tracking-tight md:text-3xl">
          Sales Analytics
        </h1>
        <p className="text-sm text-muted-foreground">Last 30 days</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Total Revenue" value={eur(totalRevenue)} tone="var(--teal)" />
        <Kpi label="Drinks Sold" value={num(totalDrinks, 0)} tone="var(--foreground)" />
        <Kpi label="Avg Ticket" value={eur(avgTicket)} tone="var(--green)" />
        <Kpi label="Best Day" value={`€${bestDay.revenue}`} sub={bestDay.date} tone="var(--orange)" />
      </div>

      <ChartCard title="Daily Revenue">
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={daily} margin={{ left: -18, right: 8, top: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="date" tick={axis} interval={4} />
            <YAxis tick={axis} />
            <Tooltip contentStyle={tooltipStyle} />
            <Line type="monotone" dataKey="revenue" stroke="var(--teal)" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="Revenue by Cocktail (Top 10)">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={topByRevenue} layout="vertical" margin={{ left: 20, right: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
              <XAxis type="number" tick={axis} />
              <YAxis type="category" dataKey="name" tick={axis} width={70} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="revenue" fill="var(--teal)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Revenue by Category">
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={byCategory} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                {byCategory.map((_, i) => (
                  <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Pour Cost % by Cocktail (worst → best)">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={pourCostSorted} layout="vertical" margin={{ left: 20, right: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
              <XAxis type="number" tick={axis} />
              <YAxis type="category" dataKey="name" tick={axis} width={70} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => `${v.toFixed(1)}%`} />
              <Bar dataKey="pourCost" radius={[0, 4, 4, 0]}>
                {pourCostSorted.map((c, i) => (
                  <Cell key={i} fill={c.pourCost > 22 ? "var(--red)" : "var(--green)"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Price vs Margin %">
          <ResponsiveContainer width="100%" height={300}>
            <ScatterChart margin={{ left: -10, right: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis type="number" dataKey="price" name="Price" unit="€" tick={axis} />
              <YAxis type="number" dataKey="margin" name="Margin" unit="%" tick={axis} domain={[60, 90]} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ strokeDasharray: "3 3" }} />
              <Scatter data={perCocktail} fill="var(--purple)" />
            </ScatterChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Sales by Day of Week">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={dow} margin={{ left: -18, right: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" tick={axis} />
              <YAxis tick={axis} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="revenue" fill="var(--orange)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Menu Engineering Matrix">
          <ResponsiveContainer width="100%" height={300}>
            <ScatterChart margin={{ left: -10, right: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis type="number" dataKey="qty" name="Sold" tick={axis} />
              <YAxis type="number" dataKey="margin" name="Margin" unit="%" tick={axis} domain={[60, 90]} />
              <ZAxis type="number" dataKey="profit" range={[60, 400]} />
              <ReferenceLine x={avgQty} stroke="var(--muted-foreground)" strokeDasharray="4 4" />
              <ReferenceLine y={avgMargin} stroke="var(--muted-foreground)" strokeDasharray="4 4" />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(v: number, n: string) => (n === "margin" ? `${v.toFixed(1)}%` : v)}
              />
              <Scatter data={matrix}>
                {matrix.map((c, i) => (
                  <Cell key={i} fill={quadColor[c.quad]} />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
          <div className="mt-3 flex flex-wrap gap-3 text-xs">
            {Object.entries(quadColor).map(([q, c]) => (
              <span key={q} className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: c }} />
                {q}
              </span>
            ))}
          </div>
        </ChartCard>
      </div>

      <ChartCard title="Cocktails Ranked by Profit Contribution">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2 font-semibold">Cocktail</th>
                <th className="px-3 py-2 text-right font-semibold">Sold</th>
                <th className="px-3 py-2 text-right font-semibold">Revenue</th>
                <th className="px-3 py-2 text-right font-semibold">Profit</th>
                <th className="px-3 py-2 text-right font-semibold">Pour %</th>
              </tr>
            </thead>
            <tbody>
              {profitRanked.map((c) => (
                <tr key={c.name} className="border-b border-border/60 last:border-0">
                  <td className="px-3 py-2 font-medium">{c.name}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{c.qty}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{eur(c.revenue)}</td>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums text-green">{eur(c.profit)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{c.pourCost.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ChartCard>
    </div>
  );
}

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone: string }) {
  return (
    <Card className="border-border bg-card p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-black md:text-2xl" style={{ color: tone }}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </Card>
  );
}
