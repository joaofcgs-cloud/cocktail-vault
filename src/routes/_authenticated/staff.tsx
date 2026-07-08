import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { db, type Staff, type PayrollRecord, type PayrollInvoice } from "@/lib/db";
import { scanPayroll } from "@/lib/payroll.functions";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { eur, num } from "@/lib/format";
import { Download, Lock, Upload, FileText, Trash2, ExternalLink, Sparkles } from "lucide-react";
import { toast } from "sonner";

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

const TABS = ["Staff List", "Payroll", "Monthly Costs", "Tips", "Salary Invoices"] as const;
type Tab = (typeof TABS)[number];

function StaffPage() {
  const { isOwner, user } = useAuth();
  const [tab, setTab] = useState<Tab>("Staff List");
  const qc = useQueryClient();

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

  const { data: invoices = [] } = useQuery({
    queryKey: ["payroll_invoices"],
    queryFn: async (): Promise<PayrollInvoice[]> => {
      const { data, error } = await db
        .from("payroll_invoices")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: isOwner,
  });

  const byId = useMemo(
    () => Object.fromEntries(staff.map((s) => [s.id, s])),
    [staff],
  );

  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadStaff, setUploadStaff] = useState<string>("");
  const now = new Date();
  const [upMonth, setUpMonth] = useState(now.getMonth() + 1);
  const [upYear, setUpYear] = useState(now.getFullYear());
  const [busy, setBusy] = useState(false);
  const [autoRead, setAutoRead] = useState(true);
  const runScan = useServerFn(scanPayroll);

  // Period filter for payroll views (month/year)
  const [period, setPeriod] = useState<string>("all");
  const periods = useMemo(() => {
    const set = new Set<string>();
    for (const p of payroll) set.add(`${p.year}-${String(p.month).padStart(2, "0")}`);
    return [...set].sort((a, b) => b.localeCompare(a));
  }, [payroll]);
  const filteredPayroll = useMemo(() => {
    if (period === "all") return payroll;
    const [y, m] = period.split("-").map(Number);
    return payroll.filter((p) => p.year === y && p.month === m);
  }, [payroll, period]);

  function fileToDataUrl(f: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(f);
    });
  }

  async function importPayroll(file: File) {
    const dataUrl = await fileToDataUrl(file);
    const parsed = await runScan({
      data: { fileDataUrl: dataUrl, mimeType: file.type, fileName: file.name },
    });
    if (!parsed.employees.length) {
      toast.error("AI could not find any employees in this file.");
      return;
    }
    let inserted = 0;
    for (const e of parsed.employees) {
      if (!e.name) continue;
      // Find existing staff by NIF, else by name
      let staffId: string | null = null;
      const existing = staff.find(
        (s) =>
          (e.nif && s.nif === e.nif) ||
          s.name.toLowerCase() === e.name.toLowerCase(),
      );
      if (existing) {
        staffId = existing.id;
        await db
          .from("staff")
          .update({
            role: e.role || existing.role,
            base_salary: e.base_salary || existing.base_salary,
            hourly_rate: e.hourly_rate || existing.hourly_rate,
            nif: e.nif || existing.nif,
          })
          .eq("id", existing.id);
      } else {
        const { data: newStaff } = await db
          .from("staff")
          .insert({
            name: e.name,
            nif: e.nif || null,
            role: e.role || "—",
            base_salary: e.base_salary,
            hourly_rate: e.hourly_rate,
            active: true,
          })
          .select("id")
          .single();
        staffId = newStaff?.id ?? null;
      }
      if (!staffId) continue;
      // Replace any existing record for this staff/month/year
      await db
        .from("payroll_records")
        .delete()
        .eq("staff_id", staffId)
        .eq("month", parsed.month)
        .eq("year", parsed.year);
      await db.from("payroll_records").insert({
        staff_id: staffId,
        month: parsed.month,
        year: parsed.year,
        base_pay: e.base_pay,
        meal_subsidy: e.meal_subsidy,
        tips: e.tips,
        gross_pay: e.gross_pay,
        irs: e.irs,
        social_security: e.social_security,
        net_pay: e.net_pay,
        days_worked: e.days_worked,
        hours_worked: e.hours_worked,
      });
      inserted++;
    }
    setUpMonth(parsed.month);
    setUpYear(parsed.year);
    toast.success(`AI imported ${inserted} payslip${inserted > 1 ? "s" : ""}.`);
    qc.invalidateQueries({ queryKey: ["staff"] });
    qc.invalidateQueries({ queryKey: ["payroll_records"] });
  }

  async function handleUpload(file: File) {
    if (!user?.id) return;
    const okType =
      file.type === "application/pdf" || file.type.startsWith("image/");
    if (!okType) {
      toast.error("Only PDF or image (JPG/PNG) files are allowed.");
      return;
    }
    setBusy(true);
    try {
      const safeName = file.name.replace(/[^\w.\-]/g, "_");
      const path = `${user.id}/payroll/${upYear}-${String(upMonth).padStart(2, "0")}-${Date.now()}-${safeName}`;
      const { error: upErr } = await supabase.storage
        .from("receipts")
        .upload(path, file);
      if (upErr) throw upErr;
      const { error } = await db.from("payroll_invoices").insert({
        staff_id: uploadStaff || null,
        month: upMonth,
        year: upYear,
        file_name: file.name,
        file_path: path,
        uploaded_by: user.id,
      });
      if (error) throw error;
      toast.success("Salary invoice uploaded.");
      qc.invalidateQueries({ queryKey: ["payroll_invoices"] });
      if (autoRead) {
        toast.info("Reading payslip with AI…");
        await importPayroll(file);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleUploadMany(files: File[]) {
    if (!files.length) return;
    for (const f of files) {
      await handleUpload(f);
    }
  }

  async function openInvoice(path: string) {
    const { data, error } = await supabase.storage
      .from("receipts")
      .createSignedUrl(path, 60);
    if (error || !data) {
      toast.error("Could not open file.");
      return;
    }
    window.open(data.signedUrl, "_blank");
  }

  async function deleteInvoice(inv: PayrollInvoice) {
    if (!confirm(`Delete "${inv.file_name}"?`)) return;
    await supabase.storage.from("receipts").remove([inv.file_path]);
    const { error } = await db.from("payroll_invoices").delete().eq("id", inv.id);
    if (error) {
      toast.error("Could not delete record.");
      return;
    }
    toast.success("Deleted.");
    qc.invalidateQueries({ queryKey: ["payroll_invoices"] });
  }

  const totals = useMemo(() => {
    const gross = filteredPayroll.reduce((s, p) => s + p.gross_pay, 0);
    const net = filteredPayroll.reduce((s, p) => s + p.net_pay, 0);
    const tips = filteredPayroll.reduce((s, p) => s + p.tips, 0);
    const base = filteredPayroll.reduce((s, p) => s + p.base_pay, 0);
    const subs = filteredPayroll.reduce((s, p) => s + p.meal_subsidy, 0);
    const ded = filteredPayroll.reduce((s, p) => s + p.irs + p.social_security, 0);
    return { gross, net, tips, base, subs, ded };
  }, [filteredPayroll]);

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
    const rows = filteredPayroll.map((p) => {
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
    a.download = `payroll-${period === "all" ? "all" : period}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const roleTotals = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of filteredPayroll) {
      const s = byId[p.staff_id ?? ""];
      const role = s?.role ?? "Other";
      map.set(role, (map.get(role) ?? 0) + p.gross_pay);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [filteredPayroll, byId]);
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

      {tab === "Salary Invoices" && (
        <div className="space-y-4">
          <Card className="border-border bg-card p-4 md:p-5">
            <h2 className="mb-1 text-sm font-bold uppercase tracking-wide">
              Upload Salary Invoice
            </h2>
            <p className="mb-4 text-xs text-muted-foreground">
              Accepts PDF or image (JPG/PNG) files.
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Employee
                </label>
                <select
                  value={uploadStaff}
                  onChange={(e) => setUploadStaff(e.target.value)}
                  className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm"
                >
                  <option value="">All / General</option>
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Month
                </label>
                <select
                  value={upMonth}
                  onChange={(e) => setUpMonth(Number(e.target.value))}
                  className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm"
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <option key={m} value={m}>
                      {new Date(2000, m - 1).toLocaleString("en", { month: "long" })}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Year
                </label>
                <input
                  type="number"
                  value={upYear}
                  onChange={(e) => setUpYear(Number(e.target.value))}
                  className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm"
                />
              </div>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf,image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                const fs = e.target.files ? Array.from(e.target.files) : [];
                if (fs.length) handleUploadMany(fs);
              }}
            />
            <Button
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              className="mt-4 h-11 gap-2"
            >
              <Upload className="h-4 w-4" />
              {busy ? "Uploading…" : "Upload PDF / JPG"}
            </Button>
            <label className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={autoRead}
                onChange={(e) => setAutoRead(e.target.checked)}
                className="h-4 w-4 accent-teal"
              />
              <Sparkles className="h-4 w-4 text-teal" />
              Auto-read with AI and fill staff &amp; payroll
            </label>
          </Card>

          <Card className="border-border bg-card p-0">
            <div className="border-b border-border px-4 py-3">
              <h2 className="text-sm font-bold uppercase tracking-wide">
                Uploaded Invoices ({invoices.length})
              </h2>
            </div>
            <ul className="divide-y divide-border/60">
              {invoices.map((inv) => (
                <li key={inv.id} className="flex items-center gap-3 px-4 py-3">
                  <FileText className="h-5 w-5 shrink-0 text-teal" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{inv.file_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {byId[inv.staff_id ?? ""]?.name ?? "General"} ·{" "}
                      {new Date(inv.year, inv.month - 1).toLocaleString("en", {
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                  <button
                    onClick={() => openInvoice(inv.file_path)}
                    aria-label="Open"
                    className="grid h-9 w-9 place-items-center rounded-lg text-muted-foreground hover:bg-secondary"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => deleteInvoice(inv)}
                    aria-label="Delete"
                    className="grid h-9 w-9 place-items-center rounded-lg text-red hover:bg-secondary"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
              {invoices.length === 0 && (
                <li className="px-4 py-10 text-center text-sm text-muted-foreground">
                  No salary invoices uploaded yet.
                </li>
              )}
            </ul>
          </Card>
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