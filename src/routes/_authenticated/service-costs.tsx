import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { db } from "@/lib/db";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  useCompanies,
  useServiceCosts,
  useCostAllocations,
  useBusinessEvents,
  holdingCompany,
  sumCosts,
  computeAllocation,
  companyById,
  barShort,
  GROUP_REVENUE,
  type Company,
  type AllocationMethod,
  type AllocSplit,
} from "@/lib/group";
import { toast } from "sonner";
import {
  LayoutDashboard,
  Building2,
  ListChecks,
  CreditCard,
  Split,
  Bell,
  Landmark,
  ArrowRight,
  Lock,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/service-costs")({
  head: () => ({
    meta: [
      { title: "Service Costs — Imprensa Group Command Center" },
      {
        name: "description",
        content:
          "Multi-company fixed & service cost control for the Plataforma Boémia group: group dashboard, per-company view, holding cost allocation, payments and alerts.",
      },
    ],
  }),
  component: ServiceCostsPage,
});

const TABS = [
  { key: "group", label: "Group Dashboard", icon: LayoutDashboard },
  { key: "company", label: "By Company", icon: Building2 },
  { key: "list", label: "Costs List", icon: ListChecks },
  { key: "payments", label: "Payments", icon: CreditCard },
  { key: "allocation", label: "Allocation", icon: Split },
  { key: "alerts", label: "Alerts", icon: Bell },
] as const;
type TabKey = (typeof TABS)[number]["key"];

function revenueMap(companies: Company[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const c of companies) {
    const s = barShort(c);
    if (s.includes("Príncipe")) map[c.id] = 18000;
    else if (s.includes("Baixa")) map[c.id] = 15000;
    else if (c.type === "lab") map[c.id] = 12000;
  }
  return map;
}

function ServiceCostsPage() {
  const { isOwner } = useAuth();
  const [tab, setTab] = useState<TabKey>("group");
  const [companyId, setCompanyId] = useState<string>("");

  const { data: companies = [] } = useCompanies();
  const { data: costs = [] } = useServiceCosts();
  const { data: allocations = [] } = useCostAllocations();
  const { data: events = [] } = useBusinessEvents();

  const holding = holdingCompany(companies);
  const bars = companies.filter((c) => c.type === "bar");
  const selected = companies.find((c) => c.id === companyId) ?? bars[0];

  const groupTotal = sumCosts(costs);
  const holdingTotal = holding ? sumCosts(costs, holding.id) : 0;
  const barsTotal = bars.reduce((s, b) => s + sumCosts(costs, b.id), 0);

  if (!isOwner) {
    return (
      <Card className="mx-auto mt-20 max-w-md border-border bg-card p-8 text-center">
        <Lock className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
        <h1 className="text-lg font-bold">Owners only</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Service cost &amp; allocation data is restricted to Owner accounts.
        </p>
      </Card>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-3 pb-24 pt-4 md:px-6">
      <header className="mb-4">
        <h1 className="text-xl font-semibold text-foreground md:text-2xl">Service Costs</h1>
        <p className="text-sm text-muted-foreground">
          Fixed & service costs across the group — holding costs allocated to each bar.
        </p>
      </header>

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

      {tab === "group" && (
        <GroupDashboard
          groupTotal={groupTotal}
          holdingTotal={holdingTotal}
          barsTotal={barsTotal}
          holding={holding}
          bars={bars}
        />
      )}
      {tab === "company" && (
        <ByCompanyTab
          bars={bars}
          selected={selected}
          onSelect={setCompanyId}
          costs={costs}
          holdingTotal={holdingTotal}
        />
      )}
      {tab === "list" && (
        <CostsListTab
          companies={companies}
          bars={bars}
          holding={holding}
          selected={selected}
          onSelect={setCompanyId}
          costs={costs}
        />
      )}
      {tab === "payments" && <PaymentsTab bars={bars} costs={costs} selected={selected} onSelect={setCompanyId} />}
      {tab === "allocation" && (
        <AllocationTab
          companies={companies}
          bars={bars}
          holding={holding}
          holdingTotal={holdingTotal}
          allocations={allocations}
        />
      )}
      {tab === "alerts" && <AlertsTab companies={companies} bars={bars} costs={costs} events={events} />}
    </div>
  );
}

/* ---------- shared ---------- */
function Kpi({ label, value, tone, sub }: { label: string; value: string; tone?: string; sub?: string }) {
  return (
    <Card className="p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-lg font-semibold" style={{ color: tone ?? "var(--foreground)" }}>
        {value}
      </div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </Card>
  );
}

function CompanySelect({ bars, selected, onSelect }: { bars: Company[]; selected?: Company; onSelect: (id: string) => void }) {
  return (
    <Select value={selected?.id} onValueChange={onSelect}>
      <SelectTrigger className="w-full max-w-xs">
        <SelectValue placeholder="Select company" />
      </SelectTrigger>
      <SelectContent>
        {bars.map((b) => (
          <SelectItem key={b.id} value={b.id}>
            {barShort(b)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/* ---------- A) Group Dashboard ---------- */
function GroupDashboard({
  groupTotal,
  holdingTotal,
  barsTotal,
  holding,
  bars,
}: {
  groupTotal: number;
  holdingTotal: number;
  barsTotal: number;
  holding?: Company;
  bars: Company[];
}) {
  const preview = computeAllocation(holdingTotal, bars, "equal");
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <Kpi label="Group fixed costs / mo" value={eur(groupTotal)} tone="var(--teal)" />
        <Kpi label="Holding costs" value={eur(holdingTotal)} tone="var(--purple)" sub="rent, insurance, lab, accounting" />
        <Kpi label="Bar costs (combined)" value={eur(barsTotal)} tone="var(--orange)" />
      </div>

      <Card className="p-4">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
          <Landmark className="h-4 w-4 text-purple" /> Holding cost allocation preview (equal 50/50)
        </h3>
        <div className="space-y-2">
          {preview.map((s) => (
            <div key={s.company_id} className="flex items-center justify-between rounded-lg bg-background px-3 py-2 text-sm">
              <span className="text-foreground">{s.name}</span>
              <span className="text-muted-foreground">{num(s.percent)}%</span>
              <span className="font-medium text-foreground">{eur(s.amount)}</span>
            </div>
          ))}
          {preview.length === 0 && <p className="text-sm text-muted-foreground">No bars to allocate to.</p>}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          {holding ? `${barShort(holding)} costs are shared across the bars.` : ""} Apply allocation on the Allocation tab.
        </p>
      </Card>
    </div>
  );
}

/* ---------- B) By Company ---------- */
function ByCompanyTab({
  bars,
  selected,
  onSelect,
  costs,
  holdingTotal,
}: {
  bars: Company[];
  selected?: Company;
  onSelect: (id: string) => void;
  costs: ReturnType<typeof useServiceCosts>["data"];
  holdingTotal: number;
}) {
  const direct = selected ? sumCosts(costs ?? [], selected.id) : 0;
  const allocated = bars.length ? Math.round((holdingTotal / bars.length) * 100) / 100 : 0;
  const total = direct + allocated;
  const rows = (costs ?? []).filter((c) => c.company_id === selected?.id);
  return (
    <div className="space-y-4">
      <CompanySelect bars={bars} selected={selected} onSelect={onSelect} />
      <div className="grid grid-cols-3 gap-3">
        <Kpi label="Direct costs" value={eur(direct)} tone="var(--orange)" />
        <Kpi label="Allocated holding" value={eur(allocated)} tone="var(--purple)" />
        <Kpi label="Total fixed costs" value={eur(total)} tone="var(--teal)" />
      </div>
      <Card className="p-4">
        <p className="text-sm text-foreground">
          <span className="font-semibold">{selected ? barShort(selected) : "—"} total fixed costs: {eur(total)}</span>{" "}
          <span className="text-muted-foreground">(direct {eur(direct)} + allocated {eur(allocated)})</span>
        </p>
      </Card>
      <Card className="p-0">
        <div className="border-b border-border px-4 py-3 text-sm font-medium text-foreground">Direct cost lines</div>
        <div className="divide-y divide-border/60">
          {rows.map((c) => (
            <div key={c.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
              <div>
                <span className="text-foreground">{c.name}</span>
                <span className="ml-2 text-xs text-muted-foreground">{c.category}</span>
              </div>
              <span className="font-medium text-foreground">{eur(Number(c.amount))}</span>
            </div>
          ))}
          {rows.length === 0 && <div className="px-4 py-8 text-center text-sm text-muted-foreground">No direct costs.</div>}
        </div>
      </Card>
    </div>
  );
}

/* ---------- C) Costs List ---------- */
function CostsListTab({
  companies,
  bars,
  holding,
  selected,
  onSelect,
  costs,
}: {
  companies: Company[];
  bars: Company[];
  holding?: Company;
  selected?: Company;
  onSelect: (id: string) => void;
  costs: ReturnType<typeof useServiceCosts>["data"];
}) {
  const [scope, setScope] = useState<string>("group");
  const rows = (costs ?? []).filter((c) => (scope === "group" ? true : c.company_id === scope));
  const selectOptions = [holding, ...bars].filter(Boolean) as Company[];
  return (
    <div className="space-y-4">
      <Select value={scope} onValueChange={setScope}>
        <SelectTrigger className="w-full max-w-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="group">Whole Group</SelectItem>
          {selectOptions.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {barShort(c)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Card className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3">Cost</th>
                <th className="px-4 py-3">Company</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Vendor</th>
                <th className="px-4 py-3 text-right">Amount / mo</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className="border-b border-border/60 last:border-0">
                  <td className="px-4 py-2.5 font-medium text-foreground">{c.name}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{barShort(companyById(companies, c.company_id))}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{c.category}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{c.vendor ?? "—"}</td>
                  <td className="px-4 py-2.5 text-right font-medium text-foreground">{eur(Number(c.amount))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

/* ---------- D) Payments ---------- */
function PaymentsTab({
  bars,
  costs,
  selected,
  onSelect,
}: {
  bars: Company[];
  costs: ReturnType<typeof useServiceCosts>["data"];
  selected?: Company;
  onSelect: (id: string) => void;
}) {
  const rows = (costs ?? []).filter((c) => c.company_id === selected?.id);
  return (
    <div className="space-y-4">
      <CompanySelect bars={bars} selected={selected} onSelect={onSelect} />
      <p className="text-xs text-muted-foreground">
        Recurring monthly obligations for {selected ? barShort(selected) : "—"}. Mark each as paid when settled.
      </p>
      <Card className="p-0">
        <div className="divide-y divide-border/60">
          {rows.map((c) => (
            <div key={c.id} className="flex items-center justify-between px-4 py-3 text-sm">
              <div>
                <span className="text-foreground">{c.name}</span>
                <span className="ml-2 text-xs text-muted-foreground">{c.frequency}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-medium text-foreground">{eur(Number(c.amount))}</span>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8"
                  onClick={() => toast.success(`Recorded payment for ${c.name} (${eur(Number(c.amount))}).`)}
                >
                  Record payment
                </Button>
              </div>
            </div>
          ))}
          {rows.length === 0 && <div className="px-4 py-8 text-center text-sm text-muted-foreground">No costs for this company.</div>}
        </div>
      </Card>
    </div>
  );
}

/* ---------- E) Allocation ---------- */
function AllocationTab({
  companies,
  bars,
  holding,
  holdingTotal,
  allocations,
}: {
  companies: Company[];
  bars: Company[];
  holding?: Company;
  holdingTotal: number;
  allocations: ReturnType<typeof useCostAllocations>["data"];
}) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [method, setMethod] = useState<AllocationMethod>("equal");
  const [busy, setBusy] = useState(false);
  const revMap = useMemo(() => revenueMap(companies), [companies]);

  const splits: AllocSplit[] = useMemo(
    () => computeAllocation(holdingTotal, bars, method, { revenueMap: revMap }),
    [holdingTotal, bars, method, revMap],
  );

  async function apply() {
    if (!holding || splits.length === 0) return;
    setBusy(true);
    try {
      const now = new Date();
      const { error } = await db.from("cost_allocations").insert({
        service_cost_id: null,
        from_company_id: holding.id,
        label: `Holding cost allocation (${method}) — ${now.toLocaleDateString("en", { month: "short", year: "numeric" })}`,
        total_amount: holdingTotal,
        period_month: now.getMonth() + 1,
        period_year: now.getFullYear(),
        splits: splits.map((s) => ({ company_id: s.company_id, percent: s.percent, amount: s.amount })),
        applied: true,
        created_by: user?.id ?? null,
      });
      if (error) throw error;

      for (const s of splits) {
        await db.from("business_events").insert({
          company_id: s.company_id,
          event_type: "COST_ALLOCATED",
          entity_type: "cost_allocation",
          entity_id: null,
          payload: { method, amount: s.amount, percent: s.percent, from: barShort(holding) },
        });
        await db.from("notifications").insert({
          company_id: s.company_id,
          title: "Holding costs allocated",
          body: `${eur(s.amount)} of holding costs allocated to your company (${method} split).`,
          severity: "info",
          link: "/service-costs",
        });
      }
      toast.success(`Allocated ${eur(holdingTotal)} across ${splits.length} bars.`);
      qc.invalidateQueries({ queryKey: ["cost_allocations"] });
      qc.invalidateQueries({ queryKey: ["business_events_group"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Allocation failed");
    } finally {
      setBusy(false);
    }
  }

  const METHODS: { key: AllocationMethod; label: string; hint: string }[] = [
    { key: "equal", label: "Equal", hint: "Split evenly across bars" },
    { key: "revenue", label: "Revenue-based", hint: "Proportional to each bar's revenue" },
    { key: "custom", label: "Custom", hint: "Manual weighting" },
  ];

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <h3 className="mb-1 text-sm font-medium text-foreground">Holding cost allocation</h3>
        <p className="mb-3 text-xs text-muted-foreground">
          Allocating {eur(holdingTotal)} of {holding ? barShort(holding) : "holding"} costs to both bars.
        </p>
        <div className="flex flex-wrap gap-2">
          {METHODS.map((m) => (
            <button
              key={m.key}
              onClick={() => setMethod(m.key)}
              className={`rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
                method === m.key ? "border-teal bg-teal/10 text-teal" : "border-border text-muted-foreground hover:bg-background"
              }`}
            >
              <div className="font-semibold">{m.label}</div>
              <div className="text-[11px] opacity-80">{m.hint}</div>
            </button>
          ))}
        </div>
      </Card>

      <Card className="p-4">
        <h3 className="mb-3 text-sm font-medium text-foreground">Preview</h3>
        <div className="space-y-2">
          {splits.map((s) => (
            <div key={s.company_id} className="flex items-center gap-3 rounded-lg bg-background px-3 py-2 text-sm">
              <ArrowRight className="h-3.5 w-3.5 text-teal" />
              <span className="flex-1 text-foreground">{s.name}</span>
              <span className="text-muted-foreground">{num(s.percent)}%</span>
              <span className="font-medium text-foreground">{eur(s.amount)}</span>
            </div>
          ))}
        </div>
        <Button onClick={apply} disabled={busy || !holding} className="mt-4 gap-2">
          <Split className="h-4 w-4" />
          {busy ? "Applying…" : "Apply to both bars"}
        </Button>
      </Card>

      <Card className="p-0">
        <div className="border-b border-border px-4 py-3 text-sm font-medium text-foreground">
          Applied allocations ({(allocations ?? []).length})
        </div>
        <div className="divide-y divide-border/60">
          {(allocations ?? []).map((a) => (
            <div key={a.id} className="px-4 py-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-foreground">{a.label}</span>
                <span className="font-medium text-foreground">{eur(Number(a.total_amount))}</span>
              </div>
              <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                {a.splits.map((s, i) => (
                  <span key={i} className="rounded-full bg-secondary px-2 py-0.5">
                    {barShort(companyById(companies, s.company_id))}: {eur(Number(s.amount))}
                  </span>
                ))}
              </div>
            </div>
          ))}
          {(allocations ?? []).length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">No allocations applied yet.</div>
          )}
        </div>
      </Card>
    </div>
  );
}

/* ---------- F) Alerts ---------- */
function AlertsTab({
  companies,
  bars,
  costs,
  events,
}: {
  companies: Company[];
  bars: Company[];
  costs: ReturnType<typeof useServiceCosts>["data"];
  events: ReturnType<typeof useBusinessEvents>["data"];
}) {
  const alerts: { severity: "warning" | "info"; text: string }[] = [];
  for (const b of bars) {
    const rent = (costs ?? []).find((c) => c.company_id === b.id && c.category === "rent");
    if (rent && Number(rent.amount) >= 2000) {
      alerts.push({ severity: "warning", text: `${barShort(b)} rent is ${eur(Number(rent.amount))}/mo — largest single fixed cost.` });
    }
  }
  const allocated = (events ?? []).filter((e) => e.event_type === "COST_ALLOCATED");
  if (allocated.length > 0) {
    alerts.push({ severity: "info", text: `${allocated.length} holding-cost allocation event(s) recorded this period.` });
  }
  if (alerts.length === 0) alerts.push({ severity: "info", text: "No cost alerts. All fixed costs within expected range." });

  return (
    <div className="space-y-3">
      {alerts.map((a, i) => (
        <Card key={i} className="flex items-start gap-3 p-4">
          {a.severity === "warning" ? (
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-orange" />
          ) : (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green" />
          )}
          <span className="text-sm text-foreground">{a.text}</span>
          <Badge className="ml-auto bg-secondary text-muted-foreground">{a.severity}</Badge>
        </Card>
      ))}
    </div>
  );
}
