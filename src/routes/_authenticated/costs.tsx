import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { db, type ServiceCost, type ServiceCostPayment } from "@/lib/db";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { eur } from "@/lib/format";
import { Download, Lock, CheckCircle2, Clock, AlertOctagon, Check, Pencil } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/costs")({
  head: () => ({ meta: [{ title: "Service Costs — Bar Command Center" }] }),
  component: CostsPage,
});

const CAT_COLOR: Record<string, string> = {
  Property: "var(--red)",
  Utilities: "var(--orange)",
  Technology: "var(--teal)",
  Insurance: "var(--purple)",
  Licenses: "var(--pink)",
  Services: "var(--green)",
  Operations: "var(--foreground)",
  Professional: "var(--teal)",
  Compliance: "var(--orange)",
};

const TABS = ["Dashboard", "By Supplier", "Costs List", "Payments", "Alerts"] as const;
type Tab = (typeof TABS)[number];

const STATUS_BADGE: Record<string, string> = {
  paid: "bg-green/15 text-green",
  pending: "bg-orange/15 text-orange",
  overdue: "bg-red/15 text-red",
};

function CostsPage() {
  const { isOwner } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("Dashboard");
  const [category, setCategory] = useState("all");
  const today = new Date().getDate();
  const now = new Date();
  const [selMonth, setSelMonth] = useState(now.getMonth() + 1);
  const [selYear, setSelYear] = useState(now.getFullYear());
  const [editVendorId, setEditVendorId] = useState<string | null>(null);
  const [editVendorVal, setEditVendorVal] = useState("");
  const [savingVendor, setSavingVendor] = useState(false);

  const { data: costs = [] } = useQuery({
    queryKey: ["service_costs"],
    queryFn: async (): Promise<ServiceCost[]> => {
      const { data, error } = await db
        .from("service_costs")
        .select("*")
        .order("amount", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: isOwner,
  });

  const { data: payments = [] } = useQuery({
    queryKey: ["service_cost_payments"],
    queryFn: async (): Promise<ServiceCostPayment[]> => {
      const { data, error } = await db.from("service_cost_payments").select("*");
      if (error) throw error;
      return data;
    },
    enabled: isOwner,
  });

  // Supplier suggestions: existing cost vendors + invoice vendors, for consistency.
  const { data: invoiceVendors = [] } = useQuery({
    queryKey: ["invoice_vendors"],
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await db.from("invoices").select("vendor");
      if (error) throw error;
      return (data ?? []).map((r) => r.vendor).filter(Boolean) as string[];
    },
    enabled: isOwner,
  });

  const vendorOptions = useMemo(
    () =>
      Array.from(
        new Set(
          [
            ...costs.map((c) => c.vendor?.trim()),
            ...invoiceVendors.map((v) => v?.trim()),
          ].filter(Boolean) as string[],
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [costs, invoiceVendors],
  );

  async function saveVendor(costId: string) {
    const name = editVendorVal.trim();
    setSavingVendor(true);
    try {
      const { error } = await db
        .from("service_costs")
        .update({ vendor: name || null })
        .eq("id", costId);
      if (error) throw error;
      toast.success("Vendor updated.");
      qc.invalidateQueries({ queryKey: ["service_costs"] });
      setEditVendorId(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update vendor");
    } finally {
      setSavingVendor(false);
    }
  }

  const payByCost = useMemo(
    () => Object.fromEntries(payments.map((p) => [p.service_cost_id, p])),
    [payments],
  );

  const monthly = costs
    .filter((c) => c.active)
    .reduce(
      (s, c) =>
        s + (c.frequency === "annual" ? c.amount / 12 : c.frequency === "quarterly" ? c.amount / 3 : c.amount),
      0,
    );
  const paid = payments.filter((p) => p.status === "paid").reduce((s, p) => s + p.amount_paid, 0);
  const pending = costs
    .filter((c) => payByCost[c.id]?.status !== "paid")
    .reduce((s, c) => s + c.amount, 0);
  const nextDue = [...costs]
    .filter((c) => c.active && payByCost[c.id]?.status !== "paid")
    .sort((a, b) => a.due_day - b.due_day)[0];

  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of costs.filter((x) => x.active)) {
      map.set(c.category, (map.get(c.category) ?? 0) + c.amount);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [costs]);
  const catMax = byCategory.length ? byCategory[0][1] : 1;

  const categories = useMemo(
    () => Array.from(new Set(costs.map((c) => c.category))).sort(),
    [costs],
  );
  const listed = costs.filter((c) => category === "all" || c.category === category);

  const MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  const yearOptions = useMemo(() => {
    const set = new Set<number>([now.getFullYear()]);
    payments.forEach((p) => set.add(p.year));
    costs.length; // ensure recompute when costs load
    return [...set].sort((a, b) => b - a);
  }, [payments, now]);

  const bySupplier = useMemo(() => {
    const periodPay = new Map(
      payments
        .filter((p) => p.month === selMonth && p.year === selYear)
        .map((p) => [p.service_cost_id, p]),
    );
    const map = new Map<
      string,
      {
        expected: number;
        paid: number;
        items: { name: string; category: string; expected: number; paid: number; status: string }[];
      }
    >();
    for (const c of costs.filter((x) => x.active)) {
      const supplier = c.vendor || "Other";
      const pay = periodPay.get(c.id);
      const expected =
        c.frequency === "annual"
          ? c.amount / 12
          : c.frequency === "quarterly"
            ? c.amount / 3
            : c.amount;
      const g = map.get(supplier) ?? { expected: 0, paid: 0, items: [] };
      g.expected += expected;
      g.paid += pay?.amount_paid ?? 0;
      g.items.push({
        name: c.name,
        category: c.category,
        expected,
        paid: pay?.amount_paid ?? 0,
        status: pay?.status ?? "pending",
      });
      map.set(supplier, g);
    }
    return [...map.entries()]
      .map(([supplier, g]) => ({
        supplier,
        ...g,
        items: g.items.sort((a, b) => b.expected - a.expected),
      }))
      .sort((a, b) => b.expected - a.expected);
  }, [costs, payments, selMonth, selYear]);

  const periodExpected = bySupplier.reduce((s, g) => s + g.expected, 0);
  const periodPaid = bySupplier.reduce((s, g) => s + g.paid, 0);

  const upcoming = [...costs]
    .filter((c) => c.active && payByCost[c.id]?.status !== "paid")
    .map((c) => ({ cost: c, daysUntil: c.due_day - today }))
    .sort((a, b) => a.daysUntil - b.daysUntil);

  if (!isOwner) {
    return (
      <Card className="mx-auto mt-20 max-w-md border-border bg-card p-8 text-center">
        <Lock className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
        <h1 className="text-lg font-bold">Owners only</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Fixed cost data is restricted to Owner accounts.
        </p>
      </Card>
    );
  }

  async function markPaid(cost: ServiceCost) {
    const pay = payByCost[cost.id];
    if (!pay) return;
    qc.setQueryData<ServiceCostPayment[]>(["service_cost_payments"], (old) =>
      (old ?? []).map((p) =>
        p.id === pay.id
          ? { ...p, status: "paid", amount_paid: cost.amount, payment_date: new Date().toISOString().slice(0, 10) }
          : p,
      ),
    );
    const { error } = await db
      .from("service_cost_payments")
      .update({
        status: "paid",
        amount_paid: cost.amount,
        payment_date: new Date().toISOString().slice(0, 10),
      })
      .eq("id", pay.id);
    if (error) {
      toast.error(error.message);
      qc.invalidateQueries({ queryKey: ["service_cost_payments"] });
    } else {
      toast.success(`${cost.name} marked as paid`);
      qc.invalidateQueries({ queryKey: ["service_cost_payments"] });
    }
  }

  function exportCsv() {
    const headers = ["Service", "Category", "Amount", "Due Day", "Vendor", "Status"];
    const rows = costs.map((c) => [
      c.name,
      c.category,
      c.amount.toFixed(2),
      c.due_day,
      c.vendor ?? "",
      payByCost[c.id]?.status ?? "pending",
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "service-costs.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black tracking-tight md:text-3xl">
          Service Costs
        </h1>
        <p className="text-sm text-muted-foreground">
          {costs.length} fixed costs · {eur(monthly)}/mo
        </p>
      </div>

      <div className="flex gap-1 overflow-x-auto rounded-xl bg-secondary p-1">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`h-10 shrink-0 whitespace-nowrap rounded-lg px-4 text-sm font-semibold transition-colors ${
              tab === t ? "bg-card text-foreground shadow" : "text-muted-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Dashboard" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MiniKpi label="Monthly Fixed" value={eur(monthly)} tone="var(--teal)" />
            <MiniKpi label="Paid" value={eur(paid)} tone="var(--green)" />
            <MiniKpi label="Pending" value={eur(pending)} tone="var(--orange)" />
            <MiniKpi
              label="Next Due"
              value={nextDue ? `Day ${nextDue.due_day}` : "—"}
              tone="var(--pink)"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Card className="border-border bg-card p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Cost per Day Open
              </p>
              <p className="mt-2 text-2xl font-black text-orange">{eur(monthly / 26)}</p>
              <p className="mt-1 text-xs text-muted-foreground">Based on 26 open days/month</p>
            </Card>
            <Card className="border-border bg-card p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Break-even (drinks/day)
              </p>
              <p className="mt-2 text-2xl font-black text-teal">
                {Math.ceil(monthly / 26 / 9)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">At ~€9 profit per drink</p>
            </Card>
          </div>

          <Card className="border-border bg-card p-4 md:p-5">
            <h2 className="mb-4 text-sm font-bold uppercase tracking-wide">
              Cost by Category
            </h2>
            <div className="space-y-3">
              {byCategory.map(([cat, val]) => (
                <div key={cat}>
                  <div className="mb-1 flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-medium">{cat}</span>
                    <span
                      className="shrink-0 text-sm font-bold"
                      style={{ color: CAT_COLOR[cat] ?? "var(--teal)" }}
                    >
                      {eur(val)}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${(val / catMax) * 100}%`, backgroundColor: CAT_COLOR[cat] ?? "var(--teal)" }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {tab === "By Supplier" && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-3">
            <Select value={String(selMonth)} onValueChange={(v) => setSelMonth(Number(v))}>
              <SelectTrigger className="h-11 w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTH_NAMES.map((m, i) => (
                  <SelectItem key={m} value={String(i + 1)}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={String(selYear)} onValueChange={(v) => setSelYear(Number(v))}>
              <SelectTrigger className="h-11 w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {yearOptions.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <MiniKpi label="Expected" value={eur(periodExpected)} tone="var(--teal)" />
            <MiniKpi label="Paid" value={eur(periodPaid)} tone="var(--green)" />
            <MiniKpi
              label="Outstanding"
              value={eur(Math.max(periodExpected - periodPaid, 0))}
              tone="var(--orange)"
            />
          </div>

          {bySupplier.map((g) => (
            <Card key={g.supplier} className="border-border bg-card p-4 md:p-5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-black tracking-tight">{g.supplier}</h2>
                  <p className="text-xs text-muted-foreground">{g.items.length} services</p>
                </div>
                <div className="text-right text-sm">
                  <p className="font-black text-teal">{eur(g.expected)}</p>
                  <p className="text-xs text-muted-foreground">
                    {eur(g.paid)} paid
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                {g.items.map((it) => (
                  <div
                    key={it.name}
                    className="flex items-center justify-between gap-3 border-t border-border/60 pt-2 text-sm first:border-0 first:pt-0"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{it.name}</p>
                      <p className="text-xs text-muted-foreground">{it.category}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="tabular-nums font-semibold">{eur(it.expected)}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-bold ${STATUS_BADGE[it.status] ?? STATUS_BADGE.pending}`}
                      >
                        {it.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ))}
          {bySupplier.length === 0 && (
            <Card className="border-border bg-card p-8 text-center text-muted-foreground">
              No cost data for {MONTH_NAMES[selMonth - 1]} {selYear} yet.
            </Card>
          )}
        </div>
      )}

      {tab === "Costs List" && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="h-11 w-56">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={exportCsv} className="h-11 gap-2">
              <Download className="h-4 w-4" /> Export CSV
            </Button>
          </div>
          <Card className="border-border bg-card p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-3 font-semibold">Service</th>
                    <th className="px-4 py-3 font-semibold">Category</th>
                    <th className="px-4 py-3 text-right font-semibold">Amount</th>
                    <th className="px-4 py-3 text-right font-semibold">Due</th>
                    <th className="px-4 py-3 font-semibold">Vendor</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 text-center font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {listed.map((c) => {
                    const status = payByCost[c.id]?.status ?? "pending";
                    return (
                      <tr key={c.id} className="border-b border-border/60 last:border-0">
                        <td className="px-4 py-3 font-medium">{c.name}</td>
                        <td className="px-4 py-3 text-muted-foreground">{c.category}</td>
                        <td className="px-4 py-3 text-right tabular-nums font-semibold">{eur(c.amount)}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{c.due_day}</td>
                        <td className="px-4 py-3 text-muted-foreground">{c.vendor}</td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${STATUS_BADGE[status]}`}>
                            {status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {status !== "paid" && (
                            <Button size="sm" variant="outline" onClick={() => markPaid(c)} className="h-9">
                              Mark paid
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {tab === "Payments" && (
        <Card className="border-border bg-card p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3 font-semibold">Service</th>
                  <th className="px-4 py-3 text-right font-semibold">Due</th>
                  <th className="px-4 py-3 text-right font-semibold">Paid</th>
                  <th className="px-4 py-3 font-semibold">Date</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {costs.map((c) => {
                  const p = payByCost[c.id];
                  const status = p?.status ?? "pending";
                  return (
                    <tr key={c.id} className="border-b border-border/60 last:border-0">
                      <td className="px-4 py-3 font-medium">{c.name}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{eur(c.amount)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-green">{eur(p?.amount_paid ?? 0)}</td>
                      <td className="px-4 py-3 text-muted-foreground">{p?.payment_date ?? "—"}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${STATUS_BADGE[status]}`}>
                          {status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {tab === "Alerts" && (
        <div className="space-y-3">
          {upcoming.map(({ cost, daysUntil }) => {
            const overdue = daysUntil < 0;
            const soon = daysUntil >= 0 && daysUntil <= 3;
            const Icon = overdue ? AlertOctagon : soon ? Clock : CheckCircle2;
            const tone = overdue ? "text-red" : soon ? "text-orange" : "text-muted-foreground";
            return (
              <Card key={cost.id} className="flex items-center justify-between gap-3 border-border bg-card p-4">
                <div className="flex items-center gap-3">
                  <Icon className={`h-5 w-5 shrink-0 ${tone}`} />
                  <div>
                    <p className="font-semibold">{cost.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {eur(cost.amount)} · due day {cost.due_day}
                    </p>
                  </div>
                </div>
                <span className={`text-sm font-bold ${tone}`}>
                  {overdue
                    ? `${Math.abs(daysUntil)}d overdue`
                    : daysUntil === 0
                      ? "Due today"
                      : `in ${daysUntil}d`}
                </span>
              </Card>
            );
          })}
          {upcoming.length === 0 && (
            <Card className="border-border bg-card p-8 text-center text-muted-foreground">
              All costs are paid this month. 🎉
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

function MiniKpi({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <Card className="border-border bg-card p-4">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <p className="mt-2 text-xl font-black" style={{ color: tone }}>
        {value}
      </p>
    </Card>
  );
}