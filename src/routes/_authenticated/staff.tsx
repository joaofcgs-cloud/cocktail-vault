import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { db, type Staff, type PayrollRecord } from "@/lib/db";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { eur, num } from "@/lib/format";
import { Download, Lock } from "lucide-react";

export const Route = createFileRoute("/_authenticated/staff")({
  head: () => ({ meta: [{ title: "Staff & Payroll — Bar Command Center" }] }),
  component: StaffPage,
});

const ROLE_BADGE: Record<string, string> = {
  "CHEFE DE BAR": "bg-purple/15 text-purple",
  "EMPREGADO DE MESA": "bg-teal/15 text-teal",
  COPEIRO: "bg-orange/15 text-orange",
  "GERENTE COMERCIAL": "bg-pink/15 text-pink",
  "Trabalhador de limpeza": "bg-secondary text-muted-foreground",
};

const TABS = ["Staff List", "Payroll", "Monthly Costs", "Tips"] as const;
type Tab = (typeof TABS)[number];

function StaffPage() {
  const { isOwner } = useAuth();
  const [tab, setTab] = useState<Tab>("Staff List");

  const { data: staff = [] } = useQuery({
    queryKey: ["staff"],
    queryFn: async (): Promise<Staff[]> => {
      const { data, error } = await db.from("staff").select("*").order("name");
      if (error) throw error;
      return data;
    },
    enabled: isOwner,
  });

  const { data: payroll = [] } = useQuery({
    queryKey: ["payroll_records"],
    queryFn: async (): Promise<PayrollRecord[]> => {
      const { data, error } = await db
        .from("payroll_records")
        .select("*")
        .order("net_pay", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: isOwner,
  });

  const byId = useMemo(
    () => Object.fromEntries(staff.map((s) => [s.id, s])),
    [staff],
  );

  const totals = useMemo(() => {
    const gross = payroll.reduce((s, p) => s + p.gross_pay, 0);
    const net = payroll.reduce((s, p) => s + p.net_pay, 0);
    const tips = payroll.reduce((s, p) => s + p.tips, 0);
    const base = payroll.reduce((s, p) => s + p.base_pay, 0);
    const subs = payroll.reduce((s, p) => s + p.meal_subsidy, 0);
    const ded = payroll.reduce((s, p) => s + p.irs + p.social_security, 0);
    return { gross, net, tips, base, subs, ded };
  }, [payroll]);

  if (!isOwner) {
    return (
      <Card className="mx-auto mt-20 max-w-md border-border bg-card p-8 text-center">
        <Lock className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
        <h1 className="text-lg font-bold">Owners only</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Staff &amp; payroll data is restricted to Owner accounts.
        </p>
      </Card>
    );
  }

  function exportPayroll() {
    const headers = ["Name", "Role", "Base", "Meal", "Tips", "Gross", "IRS", "SS", "Net", "Days"];
    const rows = payroll.map((p) => {
      const s = byId[p.staff_id ?? ""];
      return [
        s?.name ?? "—",
        s?.role ?? "—",
        p.base_pay.toFixed(2),
        p.meal_subsidy.toFixed(2),
        p.tips.toFixed(2),
        p.gross_pay.toFixed(2),
        p.irs.toFixed(2),
        p.social_security.toFixed(2),
        p.net_pay.toFixed(2),
        p.days_worked,
      ];
    });
    const csv = [headers, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "payroll-2026-06.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const roleTotals = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of payroll) {
      const s = byId[p.staff_id ?? ""];
      const role = s?.role ?? "Other";
      map.set(role, (map.get(role) ?? 0) + p.gross_pay);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [payroll, byId]);
  const roleMax = roleTotals.length ? roleTotals[0][1] : 1;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black tracking-tight md:text-3xl">
          Staff &amp; Payroll
        </h1>
        <p className="text-sm text-muted-foreground">
          {staff.length} employees · June 2026
        </p>
      </div>

      <div className="flex gap-1 overflow-x-auto rounded-xl bg-secondary p-1">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`h-10 shrink-0 whitespace-nowrap rounded-lg px-4 text-sm font-semibold transition-colors ${
              tab === t
                ? "bg-card text-foreground shadow"
                : "text-muted-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Staff List" && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {staff.map((s) => (
            <Card key={s.id} className="border-border bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-bold">{s.name}</p>
                  <p className="text-xs text-muted-foreground">NIF {s.nif}</p>
                </div>
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${s.active ? "bg-green" : "bg-muted-foreground"}`}
                  title={s.active ? "Active" : "Inactive"}
                />
              </div>
              <span
                className={`mt-3 inline-block rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${ROLE_BADGE[s.role] ?? "bg-secondary text-muted-foreground"}`}
              >
                {s.role}
              </span>
              <div className="mt-4 flex items-end justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Base salary</p>
                  <p className="text-lg font-black text-teal">{eur(s.base_salary)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Hourly</p>
                  <p className="text-sm font-semibold">{eur(s.hourly_rate)}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {tab === "Payroll" && (
        <>
          <div className="flex justify-end">
            <Button variant="outline" onClick={exportPayroll} className="h-11 gap-2">
              <Download className="h-4 w-4" /> Export CSV
            </Button>
          </div>
          <Card className="border-border bg-card p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-3 font-semibold">Name</th>
                    <th className="px-4 py-3 text-right font-semibold">Base</th>
                    <th className="px-4 py-3 text-right font-semibold">Meal</th>
                    <th className="px-4 py-3 text-right font-semibold">Tips</th>
                    <th className="px-4 py-3 text-right font-semibold">Gross</th>
                    <th className="px-4 py-3 text-right font-semibold">IRS</th>
                    <th className="px-4 py-3 text-right font-semibold">SS</th>
                    <th className="px-4 py-3 text-right font-semibold">Net</th>
                    <th className="px-4 py-3 text-right font-semibold">Days</th>
                  </tr>
                </thead>
                <tbody>
                  {payroll.map((p) => {
                    const s = byId[p.staff_id ?? ""];
                    return (
                      <tr key={p.id} className="border-b border-border/60 last:border-0">
                        <td className="px-4 py-3 font-medium">{s?.name ?? "—"}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{eur(p.base_pay)}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{eur(p.meal_subsidy)}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-pink">{eur(p.tips)}</td>
                        <td className="px-4 py-3 text-right tabular-nums font-semibold">{eur(p.gross_pay)}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-red">-{eur(p.irs)}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-red">-{eur(p.social_security)}</td>
                        <td className="px-4 py-3 text-right tabular-nums font-bold text-green">{eur(p.net_pay)}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{num(p.days_worked, 0)}</td>
                      </tr>
                    );
                  })}
                  {payroll.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-4 py-10 text-center text-muted-foreground">
                        No payroll records yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {tab === "Monthly Costs" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MiniKpi label="Total Payroll" value={eur(totals.gross)} tone="var(--teal)" />
            <MiniKpi
              label="Avg / Employee"
              value={eur(staff.length ? totals.gross / staff.length : 0)}
              tone="var(--foreground)"
            />
            <MiniKpi label="Tips Total" value={eur(totals.tips)} tone="var(--pink)" />
            <MiniKpi label="Deductions" value={eur(totals.ded)} tone="var(--red)" />
          </div>

          <Card className="border-border bg-card p-4 md:p-5">
            <h2 className="mb-4 text-sm font-bold uppercase tracking-wide">
              Cost Breakdown
            </h2>
            <div className="space-y-3">
              <Bar label="Base Salary" value={totals.base} max={totals.gross} color="var(--teal)" />
              <Bar label="Meal Subsidies" value={totals.subs} max={totals.gross} color="var(--orange)" />
              <Bar label="Tips" value={totals.tips} max={totals.gross} color="var(--pink)" />
              <Bar label="Deductions (IRS + SS)" value={totals.ded} max={totals.gross} color="var(--red)" />
            </div>
          </Card>

          <Card className="border-border bg-card p-4 md:p-5">
            <h2 className="mb-4 text-sm font-bold uppercase tracking-wide">
              Cost by Role
            </h2>
            <div className="space-y-3">
              {roleTotals.map(([role, val]) => (
                <Bar key={role} label={role} value={val} max={roleMax} color="var(--purple)" />
              ))}
            </div>
          </Card>
        </div>
      )}

      {tab === "Tips" && (
        <Card className="border-border bg-card p-4 md:p-5">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wide">Tips by Employee</h2>
            <span className="text-lg font-black text-pink">{eur(totals.tips)}</span>
          </div>
          <div className="space-y-3">
            {[...payroll]
              .sort((a, b) => b.tips - a.tips)
              .map((p) => {
                const s = byId[p.staff_id ?? ""];
                const max = Math.max(...payroll.map((x) => x.tips), 1);
                return (
                  <div key={p.id}>
                    <div className="mb-1 flex items-baseline justify-between gap-2">
                      <span className="truncate text-sm font-medium">{s?.name ?? "—"}</span>
                      <span className="shrink-0 text-sm font-bold text-pink">{eur(p.tips)}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-secondary">
                      <div className="h-full rounded-full bg-pink" style={{ width: `${(p.tips / max) * 100}%` }} />
                    </div>
                  </div>
                );
              })}
          </div>
        </Card>
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

function Bar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className="truncate text-sm font-medium">{label}</span>
        <span className="shrink-0 text-sm font-bold" style={{ color }}>
          {eur(value)}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-secondary">
        <div className="h-full rounded-full" style={{ width: `${max ? (value / max) * 100 : 0}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}