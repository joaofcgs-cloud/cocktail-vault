import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  db,
  type InventoryItem,
  type Cocktail,
  type PayrollRecord,
  type ServiceCost,
  type FoodItem,
  type Invoice,
} from "@/lib/db";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { eur, num, marginColor } from "@/lib/format";
import {
  buildInsights,
  computeSpend,
  COST_TARGETS,
  type Insight,
  type Severity,
} from "@/lib/insights";
import {
  AlertTriangle,
  ArrowUpCircle,
  Users,
  Receipt,
  ChevronRight,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  Upload,
  Scale,
  Martini,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({ meta: [{ title: "Overview — Bar Command Center" }] }),
  component: Overview,
});

function useInventory() {
  return useQuery({
    queryKey: ["inventory"],
    queryFn: async (): Promise<InventoryItem[]> => {
      const { data, error } = await db
        .from("inventory")
        .select("*")
        .order("name");
      if (error) throw error;
      return data;
    },
  });
}
function useCocktails() {
  return useQuery({
    queryKey: ["cocktails"],
    queryFn: async (): Promise<Cocktail[]> => {
      const { data, error } = await db.from("cocktails").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });
}
function useFood() {
  return useQuery({
    queryKey: ["food_inventory"],
    queryFn: async (): Promise<FoodItem[]> => {
      const { data, error } = await db.from("food_inventory").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });
}
function useInvoices() {
  return useQuery({
    queryKey: ["invoices"],
    queryFn: async (): Promise<Invoice[]> => {
      const { data, error } = await db.from("invoices").select("*").order("date");
      if (error) throw error;
      return data;
    },
  });
}

const SEV_BORDER: Record<Severity, string> = {
  critical: "border-l-red",
  warning: "border-l-orange",
  info: "border-l-teal",
};
const SEV_BTN: Record<Severity, string> = {
  critical: "bg-red/15 text-red hover:bg-red/25",
  warning: "bg-orange/15 text-orange hover:bg-orange/25",
  info: "bg-teal/15 text-teal hover:bg-teal/25",
};

function InsightCard({ insight }: { insight: Insight }) {
  return (
    <Card
      className={`w-[300px] shrink-0 border-border border-l-4 bg-card p-4 md:w-[340px] ${SEV_BORDER[insight.severity]}`}
    >
      <div className="mb-1 flex items-start gap-2">
        <span className="text-lg leading-none">{insight.icon}</span>
        <p className="text-sm font-bold leading-snug">{insight.title}</p>
      </div>
      <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
        {insight.description}
      </p>
      {insight.chips && insight.chips.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {insight.chips.map((c) => (
            <span
              key={c}
              className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold text-muted-foreground"
            >
              {c}
            </span>
          ))}
        </div>
      )}
      <Link
        to={insight.action.to}
        className={`inline-flex min-h-[36px] items-center rounded-lg px-3 text-xs font-bold transition-colors ${SEV_BTN[insight.severity]}`}
      >
        {insight.action.label}
      </Link>
    </Card>
  );
}

function toneForPct(pct: number, t: { warning: number; alert: number }): string {
  if (pct >= t.alert) return "var(--red)";
  if (pct >= t.warning) return "var(--orange)";
  return "var(--green)";
}

function KpiTarget({
  label,
  value,
  sub,
  tone,
  dot,
}: {
  label: string;
  value: string;
  sub?: React.ReactNode;
  tone: string;
  dot?: string;
}) {
  return (
    <Card className="border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        {dot && (
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: dot }}
          />
        )}
      </div>
      <p className="mt-2 text-2xl font-black" style={{ color: tone }}>
        {value}
      </p>
      {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
    </Card>
  );
}

function Overview() {
  const { data: inv = [] } = useInventory();
  const { data: cocktails = [] } = useCocktails();
  const { data: food = [] } = useFood();
  const { data: invoices = [] } = useInvoices();
  const { isOwner } = useAuth();

  const { data: payroll = [] } = useQuery({
    queryKey: ["payroll_records"],
    queryFn: async (): Promise<PayrollRecord[]> => {
      const { data, error } = await db.from("payroll_records").select("*");
      if (error) throw error;
      return data;
    },
    enabled: isOwner,
  });
  const { data: costs = [] } = useQuery({
    queryKey: ["service_costs"],
    queryFn: async (): Promise<ServiceCost[]> => {
      const { data, error } = await db.from("service_costs").select("*");
      if (error) throw error;
      return data;
    },
    enabled: isOwner,
  });

  const payrollTotal = payroll.reduce((s, p) => s + p.gross_pay, 0);
  const fixedTotal = costs
    .filter((c) => c.active)
    .reduce(
      (s, c) =>
        s +
        (c.frequency === "annual"
          ? c.amount / 12
          : c.frequency === "quarterly"
            ? c.amount / 3
            : c.amount),
      0,
    );

  const spend = computeSpend(invoices);
  const spendDelta =
    spend.lastMonth > 0
      ? ((spend.thisMonth - spend.lastMonth) / spend.lastMonth) * 100
      : null;
  const purchTotal = spend.food + spend.beverage + spend.operating || 1;
  const foodPct = (spend.food / purchTotal) * 100;
  const bevPct = (spend.beverage / purchTotal) * 100;

  const insights = buildInsights({ inventory: inv, food, cocktails, invoices });

  const stockValue = inv.reduce(
    (s, i) => s + i.current_stock * i.unit_cost,
    0,
  );
  const out = inv.filter((i) => i.status === "OUT");
  const low = inv.filter((i) => i.status === "LOW");
  const overstocked = inv.filter(
    (i) => i.par_level > 0 && i.current_stock / i.par_level > 1.5,
  );
  const avgMargin =
    cocktails.length > 0
      ? cocktails.reduce((s, c) => s + c.margin_percent, 0) / cocktails.length
      : 0;
  const marginTone =
    avgMargin >= COST_TARGETS.margin.good
      ? "var(--green)"
      : avgMargin >= COST_TARGETS.margin.warning
        ? "var(--orange)"
        : "var(--red)";

  const topValue = [...inv]
    .sort(
      (a, b) =>
        b.current_stock * b.unit_cost - a.current_stock * a.unit_cost,
    )
    .slice(0, 8);
  const maxValue = topValue.length
    ? topValue[0].current_stock * topValue[0].unit_cost
    : 1;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black tracking-tight md:text-3xl">
          Overview
        </h1>
        <p className="text-sm text-muted-foreground">
          What changed in your costs — and what to do about it.
        </p>
      </div>

      {/* AI Cost Manager — this week's insights */}
      <Card className="border-border bg-card p-4 md:p-5">
        <div className="mb-3 flex items-center gap-2">
          <div className="grid h-7 w-7 place-items-center rounded-lg bg-teal/15 text-teal">
            <Sparkles className="h-4 w-4" />
          </div>
          <h2 className="text-sm font-bold uppercase tracking-wide">
            AI Cost Manager · This Week
          </h2>
        </div>
        {insights.length > 0 ? (
          <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
            {insights.map((i) => (
              <InsightCard key={i.id} insight={i} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No alerts right now. Your costs are on track! 🎉
          </p>
        )}
      </Card>

      {/* Financial KPIs vs targets */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        <KpiTarget
          label="Purchases / mo"
          value={eur(spend.thisMonth)}
          tone="var(--foreground)"
          sub={
            spendDelta === null ? (
              "No prior month"
            ) : (
              <span
                className="inline-flex items-center gap-0.5 font-semibold"
                style={{ color: spendDelta > 0 ? "var(--red)" : "var(--green)" }}
              >
                {spendDelta > 0 ? (
                  <ArrowUpRight className="h-3 w-3" />
                ) : (
                  <ArrowDownRight className="h-3 w-3" />
                )}
                {num(Math.abs(spendDelta))}% vs last mo
              </span>
            )
          }
        />
        <KpiTarget
          label="Food Cost"
          value={`${num(foodPct)}%`}
          tone={toneForPct(foodPct, COST_TARGETS.food)}
          dot={toneForPct(foodPct, COST_TARGETS.food)}
          sub={`target ${COST_TARGETS.food.target}% · ${eur(spend.food)}`}
        />
        <KpiTarget
          label="Beverage Cost"
          value={`${num(bevPct)}%`}
          tone={toneForPct(bevPct, COST_TARGETS.beverage)}
          dot={toneForPct(bevPct, COST_TARGETS.beverage)}
          sub={`target ${COST_TARGETS.beverage.target}% · ${eur(spend.beverage)}`}
        />
        <KpiTarget
          label="Avg Margin"
          value={`${num(avgMargin)}%`}
          tone={marginTone}
          dot={marginTone}
          sub={`target ${COST_TARGETS.margin.good}%`}
        />
        <KpiTarget
          label="Stock Value"
          value={eur(stockValue)}
          tone="var(--teal)"
          sub={`${inv.length} products`}
        />
      </div>

      {/* AI interpretation */}
      <Card className="border-border bg-card p-4">
        <p className="text-sm leading-relaxed">
          <span className="font-bold text-teal">AI read: </span>
          {spendDelta !== null && Math.abs(spendDelta) >= 1
            ? `Purchases are ${spendDelta > 0 ? "up" : "down"} ${num(Math.abs(spendDelta))}% vs last month (${eur(spend.thisMonth)}). `
            : `You've spent ${eur(spend.thisMonth)} on purchases this month. `}
          {spend.food + spend.beverage > 0 &&
            `Food is ${num(foodPct)}% and beverage ${num(bevPct)}% of purchases. `}
          {insights.filter((i) => i.severity === "critical").length > 0
            ? `${insights.filter((i) => i.severity === "critical").length} critical item${insights.filter((i) => i.severity === "critical").length > 1 ? "s" : ""} need attention above.`
            : "No critical issues detected — keep it up."}
        </p>
      </Card>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <QuickAction to="/invoices" icon={Upload} label="Upload Invoice" tone="var(--teal)" />
        <QuickAction to="/variance" icon={Scale} label="Check Variance" tone="var(--purple)" ownerOnly isOwner={isOwner} />
        <QuickAction to="/calculators" icon={Martini} label="Review Margins" tone="var(--green)" />
        <QuickAction to="/stock" icon={ArrowUpCircle} label="Order Low Stock" tone="var(--orange)" />
      </div>

      {/* Cost summary cards (owner only) */}
      {isOwner && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Link to="/staff" className="block">
            <Card className="flex items-center justify-between border-border bg-card p-4 transition-colors hover:border-teal/40">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-teal/15 text-teal">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Monthly Payroll
                  </p>
                  <p className="text-xl font-black text-teal">{eur(payrollTotal)}</p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </Card>
          </Link>
          <Link to="/costs" className="block">
            <Card className="flex items-center justify-between border-border bg-card p-4 transition-colors hover:border-orange/40">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-orange/15 text-orange">
                  <Receipt className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Fixed Costs / mo
                  </p>
                  <p className="text-xl font-black text-orange">{eur(fixedTotal)}</p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </Card>
          </Link>
        </div>
      )}

      {/* Alerts */}
      <Card className="border-border bg-card p-4 md:p-5">
        <div className="mb-3 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-orange" />
          <h2 className="text-sm font-bold uppercase tracking-wide">
            Alerts
          </h2>
        </div>
        <div className="space-y-4">
          <AlertGroup
            title="Out of stock"
            items={out}
            className="text-red"
            badge="bg-red/15 text-red"
          />
          <AlertGroup
            title="Running low"
            items={low}
            className="text-orange"
            badge="bg-orange/15 text-orange"
          />
          <AlertGroup
            title="Overstocked"
            items={overstocked}
            className="text-purple"
            badge="bg-purple/15 text-purple"
          />
          {out.length + low.length + overstocked.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Everything looks healthy. 🍸
            </p>
          )}
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Top value stock */}
        <Card className="border-border bg-card p-4 md:p-5">
          <h2 className="mb-4 text-sm font-bold uppercase tracking-wide">
            Top Value Stock
          </h2>
          <div className="space-y-3">
            {topValue.map((i) => {
              const val = i.current_stock * i.unit_cost;
              return (
                <div key={i.id}>
                  <div className="mb-1 flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-medium">
                      {i.name}
                    </span>
                    <span className="shrink-0 text-sm font-bold text-teal">
                      {eur(val)}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full bg-teal"
                      style={{ width: `${(val / maxValue) * 100}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Cocktail margin bars */}
        <Card className="border-border bg-card p-4 md:p-5">
          <h2 className="mb-4 text-sm font-bold uppercase tracking-wide">
            Cocktail Margins
          </h2>
          <div className="space-y-3">
            {[...cocktails]
              .sort((a, b) => b.margin_percent - a.margin_percent)
              .map((c) => (
                <div key={c.id}>
                  <div className="mb-1 flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-medium">
                      {c.name}
                    </span>
                    <span
                      className="shrink-0 text-sm font-bold"
                      style={{ color: marginColor(c.margin_percent) }}
                    >
                      {num(c.margin_percent)}%
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.min(c.margin_percent, 100)}%`,
                        backgroundColor: marginColor(c.margin_percent),
                      }}
                    />
                  </div>
                </div>
              ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

function QuickAction({
  to,
  icon: Icon,
  label,
  tone,
  ownerOnly,
  isOwner,
}: {
  to: string;
  icon: React.ElementType;
  label: string;
  tone: string;
  ownerOnly?: boolean;
  isOwner?: boolean;
}) {
  if (ownerOnly && !isOwner) return null;
  return (
    <Link to={to} className="block">
      <Card className="flex min-h-[64px] items-center gap-3 border-border bg-card p-4 transition-colors hover:border-teal/40">
        <div
          className="grid h-9 w-9 shrink-0 place-items-center rounded-xl"
          style={{ backgroundColor: `color-mix(in srgb, ${tone} 15%, transparent)`, color: tone }}
        >
          <Icon className="h-4 w-4" />
        </div>
        <span className="text-sm font-bold">{label}</span>
      </Card>
    </Link>
  );
}

function AlertGroup({
  title,
  items,
  className,
  badge,
}: {
  title: string;
  items: InventoryItem[];
  className: string;
  badge: string;
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className={`mb-2 text-xs font-bold uppercase tracking-wide ${className}`}>
        {title} · {items.length}
      </p>
      <div className="flex flex-wrap gap-2">
        {items.map((i) => (
          <span
            key={i.id}
            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${badge}`}
          >
            {i.name}
          </span>
        ))}
      </div>
    </div>
  );
}
