import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  db,
  type InventoryItem,
  type Cocktail,
  type PayrollRecord,
  type ServiceCost,
} from "@/lib/db";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { eur, num, marginColor } from "@/lib/format";
import {
  AlertTriangle,
  PackageX,
  TriangleAlert,
  ArrowUpCircle,
  Wallet,
  Boxes,
  Percent,
  Users,
  Receipt,
  ChevronRight,
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

function Kpi({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  tone: string;
}) {
  return (
    <Card className="border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <Icon className="h-4 w-4" style={{ color: tone }} />
      </div>
      <p className="mt-2 text-2xl font-black" style={{ color: tone }}>
        {value}
      </p>
    </Card>
  );
}

function Overview() {
  const { data: inv = [] } = useInventory();
  const { data: cocktails = [] } = useCocktails();
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
          Live snapshot of your bar.
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        <Kpi
          label="Stock Value"
          value={eur(stockValue)}
          icon={Wallet}
          tone="var(--teal)"
        />
        <Kpi
          label="Products"
          value={String(inv.length)}
          icon={Boxes}
          tone="var(--foreground)"
        />
        <Kpi
          label="Out of Stock"
          value={String(out.length)}
          icon={PackageX}
          tone="var(--red)"
        />
        <Kpi
          label="Low Stock"
          value={String(low.length)}
          icon={TriangleAlert}
          tone="var(--orange)"
        />
        <Kpi
          label="Avg Margin"
          value={`${num(avgMargin)}%`}
          icon={Percent}
          tone="var(--green)"
        />
      </div>

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
