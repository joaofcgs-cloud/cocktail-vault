import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { eur, num } from "@/lib/format";
import {
  useVarianceReports,
  companyById,
  useCompanies,
  barShort,
  GROUP_REVENUE,
  GROUP_REVENUE_TOTAL,
  DIDOT_PRICE_INSIGHT,
  MENU_MATRIX,
  QUADRANT_META,
  STAFF_COSTS,
  GROUP_LABOUR_PCT,
  REVENUE_TREND,
  type Quadrant,
  type BarKey,
} from "@/lib/group";
import { toast } from "sonner";
import {
  Layers,
  Euro,
  Percent,
  TrendingUp,
  Grid3x3,
  Scale,
  Users,
  Lightbulb,
  MousePointerClick,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/sales")({
  head: () => ({
    meta: [
      { title: "Sales Analytics — Imprensa Group Command Center" },
      {
        name: "description",
        content:
          "Multi-company sales analytics for the Plataforma Boémia group: group overview, revenue, margins, trends, menu engineering matrix, variance and staff costs with real cocktails.",
      },
    ],
  }),
  component: SalesPage,
});

const TABS = [
  { key: "overview", label: "Group Overview", icon: Layers },
  { key: "revenue", label: "Revenue", icon: Euro },
  { key: "margins", label: "Margins", icon: Percent },
  { key: "trends", label: "Trends", icon: TrendingUp },
  { key: "matrix", label: "Menu Matrix", icon: Grid3x3 },
  { key: "variance", label: "Variance", icon: Scale },
  { key: "staff", label: "Staff", icon: Users },
] as const;
type TabKey = (typeof TABS)[number]["key"];

const SCOPES = [
  { key: "group", label: "Whole Group" },
  { key: "PR", label: "Príncipe Real" },
  { key: "Baixa", label: "Baixa" },
  { key: "Lab", label: "Cocktail Lab" },
] as const;
type Scope = (typeof SCOPES)[number]["key"];

const tooltipStyle = {
  backgroundColor: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 12,
  color: "var(--foreground)",
};
const axis = { fontSize: 11, fill: "var(--muted-foreground)" };

function SalesPage() {
  const [tab, setTab] = useState<TabKey>("overview");
  const [scope, setScope] = useState<Scope>("group");

  return (
    <div className="mx-auto w-full max-w-6xl px-3 pb-24 pt-4 md:px-6">
      <header className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground md:text-2xl">Sales Analytics</h1>
          <p className="text-sm text-muted-foreground">
            Real cocktail mix across the group — revenue, margins, menu engineering and labour.
          </p>
        </div>
        <Select value={scope} onValueChange={(v) => setScope(v as Scope)}>
          <SelectTrigger className="w-full md:w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SCOPES.map((s) => (
              <SelectItem key={s.key} value={s.key}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </header>

      {/* Tab bar */}
      <div className="-mx-3 mb-4 flex gap-1 overflow-x-auto px-3 pb-1 md:mx-0 md:px-0">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                active ? "bg-teal/15 text-teal" : "text-muted-foreground hover:bg-card"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "overview" && <OverviewTab />}
      {tab === "revenue" && <RevenueTab scope={scope} />}
      {tab === "margins" && <MarginsTab scope={scope} />}
      {tab === "trends" && <TrendsTab scope={scope} />}
      {tab === "matrix" && <MatrixTab scope={scope} />}
      {tab === "variance" && <VarianceTab scope={scope} />}
      {tab === "staff" && <StaffTab scope={scope} />}
    </div>
  );
}

/* ---------- helpers ---------- */
function scopeKeys(scope: Scope): BarKey[] {
  return scope === "group" ? ["PR", "Baixa", "Lab"] : [scope];
}
function inScope(bar: "PR" | "Baixa" | "Both", scope: Scope): boolean {
  if (scope === "group") return true;
  if (scope === "Lab") return false;
  return bar === scope || bar === "Both";
}
function Insight({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-teal/30 bg-teal/10 p-3 text-sm text-foreground">
      <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-teal" />
      <span>{text}</span>
    </div>
  );
}

/* ---------- A) Group Overview ---------- */
function OverviewTab() {
  const data = GROUP_REVENUE.map((b) => ({ name: barShort2(b.key), revenue: b.revenue, color: b.color }));
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Group revenue / mo" value={eur(GROUP_REVENUE_TOTAL)} />
        {GROUP_REVENUE.map((b) => (
          <Stat
            key={b.key}
            label={`${barShort2(b.key)} contribution`}
            value={eur(b.revenue)}
            sub={`${b.pct}%`}
            color={b.color}
          />
        ))}
      </div>

      <Card className="p-4">
        <h3 className="mb-3 text-sm font-medium text-foreground">Per-bar contribution</h3>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" tick={axis} />
              <YAxis tick={axis} tickFormatter={(v) => `€${v / 1000}k`} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => eur(v)} />
              <Bar dataKey="revenue" radius={[6, 6, 0, 0]}>
                {data.map((d, i) => (
                  <Cell key={i} fill={d.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <button
        className="w-full text-left"
        onClick={() => toast(DIDOT_PRICE_INSIGHT.label, { description: DIDOT_PRICE_INSIGHT.detail })}
      >
        <Insight
          text={`${DIDOT_PRICE_INSIGHT.label}: +${eur(DIDOT_PRICE_INSIGHT.monthlyGain)}/month. Tap for detail.`}
        />
      </button>
    </div>
  );
}

/* ---------- B) Revenue ---------- */
function RevenueTab({ scope }: { scope: Scope }) {
  const keys = scopeKeys(scope);
  const bars = GROUP_REVENUE.filter((b) => keys.includes(b.key));
  const total = bars.reduce((s, b) => s + b.revenue, 0);
  const data = bars.map((b) => ({ name: barShort2(b.key), revenue: b.revenue, color: b.color }));
  return (
    <div className="space-y-4">
      <Stat label={scope === "group" ? "Group revenue / mo" : "Revenue / mo"} value={eur(total)} />
      <Card className="p-4">
        <h3 className="mb-3 text-sm font-medium text-foreground">Monthly revenue</h3>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" tick={axis} />
              <YAxis tick={axis} tickFormatter={(v) => `€${v / 1000}k`} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => eur(v)} />
              <Bar dataKey="revenue" radius={[6, 6, 0, 0]}>
                {data.map((d, i) => (
                  <Cell key={i} fill={d.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
      {scope === "group" && (
        <Insight text="Príncipe Real drives 40% of group revenue; Lab resale is the fastest-growing line (+24% YoY)." />
      )}
    </div>
  );
}

/* ---------- C) Margins ---------- */
function MarginsTab({ scope }: { scope: Scope }) {
  const items = MENU_MATRIX.filter((m) => inScope(m.bar, scope)).sort((a, b) => b.margin - a.margin);
  const data = items.map((m) => ({ name: m.name, margin: m.margin, color: QUADRANT_META[m.quadrant].color }));
  const avg = items.length ? Math.round((items.reduce((s, m) => s + m.margin, 0) / items.length) * 10) / 10 : 0;
  return (
    <div className="space-y-4">
      <Stat label="Avg cocktail margin" value={`${num(avg)}%`} />
      <Card className="p-4">
        <h3 className="mb-3 text-sm font-medium text-foreground">Margin by cocktail</h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis type="number" domain={[0, 100]} tick={axis} tickFormatter={(v) => `${v}%`} />
              <YAxis type="category" dataKey="name" width={82} tick={axis} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => `${v}%`} />
              <Bar dataKey="margin" radius={[0, 6, 6, 0]}>
                {data.map((d, i) => (
                  <Cell key={i} fill={d.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
      <Insight text="Serif (58%) drags the average — oyster garnish cost is high. Chentenario leads at 75%." />
    </div>
  );
}

/* ---------- D) Trends ---------- */
function TrendsTab({ scope }: { scope: Scope }) {
  const keys = scopeKeys(scope);
  const data = REVENUE_TREND.map((p) => ({
    month: p.month,
    ...(keys.includes("PR") ? { PR: p.pr } : {}),
    ...(keys.includes("Baixa") ? { Baixa: p.baixa } : {}),
    ...(keys.includes("Lab") ? { Lab: p.lab } : {}),
    event: p.event,
  }));
  const events = REVENUE_TREND.filter((p) => p.event);
  const colorMap: Record<string, string> = { PR: "var(--teal)", Baixa: "var(--orange)", Lab: "var(--pink)" };
  return (
    <div className="space-y-4">
      <Card className="p-4">
        <h3 className="mb-3 text-sm font-medium text-foreground">Revenue trend (6 months)</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="month" tick={axis} />
              <YAxis tick={axis} tickFormatter={(v) => `€${v / 1000}k`} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => eur(v)} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {keys.map((k) => (
                <Line key={k} type="monotone" dataKey={k} stroke={colorMap[k]} strokeWidth={2} dot={{ r: 3 }} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>
      <Card className="p-4">
        <h3 className="mb-2 flex items-center gap-1.5 text-sm font-medium text-foreground">
          <MousePointerClick className="h-3.5 w-3.5 text-teal" /> Event annotations
        </h3>
        <div className="space-y-2">
          {events.map((e) => (
            <button
              key={e.month}
              onClick={() => toast(`${e.month}: ${e.event!.label}`, { description: e.event!.detail })}
              className="flex w-full items-center justify-between rounded-lg border border-border bg-background p-2.5 text-left text-sm transition-colors hover:border-teal/40"
            >
              <span className="text-foreground">
                <span className="text-muted-foreground">{e.month}</span> · {e.event!.label}
              </span>
              <Badge className="bg-teal/15 text-teal">detail</Badge>
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
}

/* ---------- E) Menu Matrix ---------- */
const QUADRANTS: Quadrant[] = ["Star", "Plowhorse", "Puzzle", "Dog"];
function MatrixTab({ scope }: { scope: Scope }) {
  const items = MENU_MATRIX.filter((m) => inScope(m.bar, scope));
  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Menu engineering by margin × popularity. Stars protect · Plowhorses fix cost · Puzzles reposition · Dogs retire.
      </p>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {QUADRANTS.map((q) => {
          const meta = QUADRANT_META[q];
          const list = items.filter((m) => m.quadrant === q);
          return (
            <Card key={q} className="p-4">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-sm font-semibold" style={{ color: meta.color }}>
                  <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: meta.color }} />
                  {q}s
                </h3>
                <span className="text-xs text-muted-foreground">{list.length}</span>
              </div>
              <p className="mb-3 text-xs text-muted-foreground">{meta.advice}</p>
              <div className="space-y-1.5">
                {list.length === 0 && <p className="text-xs text-muted-foreground">None in scope.</p>}
                {list.map((m) => (
                  <div key={m.name} className="flex items-center justify-between rounded-lg bg-background px-2.5 py-2 text-sm">
                    <div>
                      <span className="font-medium text-foreground">{m.name}</span>
                      {m.note && <span className="ml-1.5 text-xs text-red">({m.note})</span>}
                      <div className="text-xs text-muted-foreground">{m.unitsMonth} sold/mo · {m.bar}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium text-foreground">{eur(m.price)}</div>
                      <div className="text-xs" style={{ color: meta.color }}>{m.margin}% margin</div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- F) Variance ---------- */
function VarianceTab({ scope }: { scope: Scope }) {
  const { data: rows = [] } = useVarianceReports();
  const { data: companies = [] } = useCompanies();

  const scoped = rows.filter((r) => {
    if (scope === "group") return true;
    const c = companyById(companies, r.company_id);
    const s = barShort(c);
    if (scope === "PR") return s.includes("Príncipe");
    if (scope === "Baixa") return s.includes("Baixa");
    return c?.type === "lab";
  });

  return (
    <div className="space-y-3">
      {scoped.length === 0 && (
        <Card className="p-4 text-sm text-muted-foreground">No variance reports in scope.</Card>
      )}
      {scoped.map((r) => {
        const c = companyById(companies, r.company_id);
        const over = r.variance > 0;
        return (
          <Card key={r.id} className="p-4">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">{r.metric}</span>
              <Badge className={over ? "bg-red/15 text-red" : "bg-green/15 text-green"}>
                {over ? "+" : ""}
                {num(r.variance)}%
              </Badge>
            </div>
            <div className="text-xs text-muted-foreground">
              {barShort(c)} · {r.period_start} → {r.period_end} · expected {num(r.expected)} vs actual {num(r.actual)}
            </div>
            {r.notes && <p className="mt-2 text-sm text-foreground">{r.notes}</p>}
          </Card>
        );
      })}
    </div>
  );
}

/* ---------- G) Staff ---------- */
function StaffTab({ scope }: { scope: Scope }) {
  const keys = scopeKeys(scope);
  const rows = STAFF_COSTS.filter((r) => keys.includes(r.key));
  const data = rows.map((r) => ({ name: barShort2(r.key), labour: r.labourPct, color: r.color }));
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Group labour cost" value={`${num(GROUP_LABOUR_PCT)}%`} sub="target 25%" />
        {rows.map((r) => (
          <Stat key={r.key} label={`${barShort2(r.key)} labour`} value={`${num(r.labourPct)}%`} sub={eur(r.monthlyCost)} color={r.color} />
        ))}
      </div>
      <Card className="p-4">
        <h3 className="mb-3 text-sm font-medium text-foreground">Labour cost % by company</h3>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" tick={axis} />
              <YAxis tick={axis} tickFormatter={(v) => `${v}%`} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => `${v}%`} />
              <Bar dataKey="labour" radius={[6, 6, 0, 0]}>
                {data.map((d, i) => (
                  <Cell key={i} fill={d.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[420px] text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th className="py-2 pr-3">Company</th>
              <th className="py-2 pr-3">Headcount</th>
              <th className="py-2 pr-3">Labour / mo</th>
              <th className="py-2 pr-3">Revenue / mo</th>
              <th className="py-2">Labour %</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className="border-t border-border">
                <td className="py-2 pr-3 text-foreground">{barShort2(r.key)}</td>
                <td className="py-2 pr-3 text-foreground">{r.headcount}</td>
                <td className="py-2 pr-3 text-foreground">{eur(r.monthlyCost)}</td>
                <td className="py-2 pr-3 text-foreground">{eur(r.revenue)}</td>
                <td className="py-2" style={{ color: r.labourPct > 25 ? "var(--red)" : "var(--green)" }}>
                  {num(r.labourPct)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {scope === "group" && (
        <Insight text="Baixa labour is 27% — 2pts over target. PR and Lab are on/under 25%." />
      )}
    </div>
  );
}

/* ---------- shared UI ---------- */
function Stat({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <Card className="p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-lg font-semibold" style={{ color: color ?? "var(--foreground)" }}>
        {value}
      </div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </Card>
  );
}

function barShort2(k: BarKey): string {
  return k === "PR" ? "Príncipe Real" : k === "Baixa" ? "Baixa" : "Lab";
}
