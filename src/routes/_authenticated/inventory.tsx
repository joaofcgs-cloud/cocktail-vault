import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { eur, num } from "@/lib/format";
import {
  useCompanies,
  useCompanyInventory,
  useVarianceReports,
  usePriceHistory,
  useProducts,
  useTransfers,
  useBusinessEvents,
  buildGroupStock,
  latestPrices,
  daysUntil,
  barShort,
  companyById,
  type Company,
  type CompanyInventoryRow,
  type InvKind,
  type InvStatus,
} from "@/lib/group";
import {
  Boxes,
  Layers,
  Scale,
  LineChart,
  ListChecks,
  AlertTriangle,
  ArrowLeftRight,
  Download,
  Upload,
  FlaskConical,
  Clock,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/inventory")({
  head: () => ({
    meta: [
      { title: "Inventory — Imprensa Command Center" },
      {
        name: "description",
        content:
          "Per-company and group-wide stock across the Plataforma Boémia group: spirits, food and Lab preps with variance, price history and inter-company transfers.",
      },
    ],
  }),
  component: InventoryPage,
});

type Tab = "company" | "group" | "variance" | "prices" | "events";
const TABS: { key: Tab; label: string; icon: typeof Boxes }[] = [
  { key: "company", label: "By Company", icon: Boxes },
  { key: "group", label: "Group View", icon: Layers },
  { key: "variance", label: "Variance", icon: Scale },
  { key: "prices", label: "Price History", icon: LineChart },
  { key: "events", label: "Event Log", icon: ListChecks },
];

const STATUS_BADGE: Record<InvStatus, string> = {
  OUT: "bg-red/15 text-red border-red/30",
  LOW: "bg-orange/15 text-orange border-orange/30",
  OK: "bg-yellow-500/15 text-yellow-500 border-yellow-500/30",
  GOOD: "bg-green/15 text-green border-green/30",
  EXPIRING: "bg-purple/15 text-purple border-purple/30",
};

function InventoryPage() {
  const { data: companies = [] } = useCompanies();
  const [tab, setTab] = useState<Tab>("company");

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-black tracking-tight">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-teal/15 text-teal">
            <Boxes className="h-5 w-5" />
          </span>
          Inventory
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Per-company and group-wide stock. Lab inventory is kept separate; transfers update both sides.
        </p>
      </div>

      <div className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                active
                  ? "bg-teal/15 text-teal"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "company" && <ByCompanyTab companies={companies} />}
      {tab === "group" && <GroupViewTab companies={companies} />}
      {tab === "variance" && <VarianceTab companies={companies} />}
      {tab === "prices" && <PriceHistoryTab companies={companies} />}
      {tab === "events" && <EventLogTab companies={companies} />}
    </div>
  );
}

/* ---------- shared bits ---------- */
function CompanyChip({
  active,
  label,
  color,
  onClick,
}: {
  active: boolean;
  label: string;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold transition-colors ${
        active ? "border-transparent text-background" : "border-border text-foreground"
      }`}
      style={active ? { backgroundColor: color } : undefined}
    >
      <span
        className="h-2 w-2 rounded-full"
        style={{ backgroundColor: active ? "var(--background)" : color }}
      />
      {label}
    </button>
  );
}

function StatusPill({ status }: { status: InvStatus }) {
  return (
    <Badge variant="outline" className={`${STATUS_BADGE[status]} font-bold`}>
      {status}
    </Badge>
  );
}

function expiryLabel(date: string | null): { text: string; danger: boolean } | null {
  const d = daysUntil(date);
  if (d === null) return null;
  if (d < 0) return { text: "Expired", danger: true };
  if (d === 0) return { text: "expires today", danger: true };
  return { text: `expires in ${d} day${d === 1 ? "" : "s"}`, danger: d <= 2 };
}

/* ---------- A) By Company ---------- */
type KindFilter = "all" | InvKind;

function ByCompanyTab({ companies }: { companies: Company[] }) {
  const qc = useQueryClient();
  const { data: rows = [] } = useCompanyInventory();
  const selectable = companies.filter((c) => c.type !== "holding");
  const pr = companies.find((c) => c.commercial_name.includes("Principe"));
  const [companyId, setCompanyId] = useState<string>("");
  const [kind, setKind] = useState<KindFilter>("all");

  const activeId = companyId || pr?.id || selectable[0]?.id || "";
  const company = companyById(companies, activeId);
  const isLab = company?.type === "lab";

  const items = useMemo(
    () =>
      rows
        .filter((r) => r.company_id === activeId)
        .filter((r) => kind === "all" || r.kind === kind),
    [rows, activeId, kind],
  );

  const bars = companies.filter((c) => c.type === "bar");
  const lab = companies.find((c) => c.type === "lab");

  async function transfer(row: CompanyInventoryRow, toCompanyId: string, qty: number) {
    const dest = companyById(companies, toCompanyId);
    // find or create the matching row on the destination
    const destRow = rows.find(
      (r) =>
        r.company_id === toCompanyId &&
        r.kind === row.kind &&
        r.name === row.name,
    );
    // decrement source
    await db
      .from("company_inventory")
      .update({ current_stock: Math.max(0, row.current_stock - qty) })
      .eq("id", row.id);
    // increment / create destination
    if (destRow) {
      await db
        .from("company_inventory")
        .update({ current_stock: destRow.current_stock + qty })
        .eq("id", destRow.id);
    } else {
      await db.from("company_inventory").insert({
        company_id: toCompanyId,
        kind: row.kind,
        product_id: row.product_id,
        prep_recipe_id: row.prep_recipe_id,
        name: row.name,
        current_stock: qty,
        par_level: row.par_level,
        unit: row.unit,
        unit_cost: row.unit_cost,
        expiry_date: row.expiry_date,
      });
    }
    await db.from("business_events").insert({
      company_id: toCompanyId,
      event_type: "INTER_COMPANY_DELIVERY",
      entity_type: "company_inventory",
      payload: {
        item: row.name,
        quantity: qty,
        unit: row.unit,
        from: barShort(company),
        to: barShort(dest),
      },
    });
    await qc.invalidateQueries({ queryKey: ["company_inventory"] });
    await qc.invalidateQueries({ queryKey: ["business_events_group"] });
    toast.success(`Transferred ${qty}${row.unit} ${row.name} → ${barShort(dest)}`);
  }

  return (
    <div className="space-y-4">
      {/* Company selector */}
      <div className="flex flex-wrap gap-2">
        {selectable.map((c) => (
          <CompanyChip
            key={c.id}
            active={activeId === c.id}
            label={barShort(c)}
            color={c.brand_color}
            onClick={() => setCompanyId(c.id)}
          />
        ))}
      </div>

      {/* Kind toggle */}
      <div className="flex flex-wrap gap-1">
        {(["all", "spirit", "food", "prep"] as KindFilter[]).map((k) => (
          <button
            key={k}
            onClick={() => setKind(k)}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold capitalize transition-colors ${
              kind === k
                ? "bg-teal/15 text-teal"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            }`}
          >
            {k === "spirit" ? "Spirits" : k === "food" ? "Food" : k === "prep" ? "Preps" : "All"}
          </button>
        ))}
      </div>

      {isLab && (
        <Card className="border-pink/30 bg-pink/5 p-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5 font-bold text-pink">
            <FlaskConical className="h-4 w-4" /> Cocktail Lab inventory
          </span>
          <p className="mt-1">
            The Lab holds batch ingredients, resale stock and production materials —
            kept separate from the bars. Preps are produced here and transferred to bars.
          </p>
        </Card>
      )}

      {items.length === 0 && (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          No {kind === "all" ? "" : kind} stock recorded for {barShort(company)}.
        </Card>
      )}

      <div className="space-y-2">
        {items.map((row) => {
          const exp = expiryLabel(row.expiry_date);
          const ratio = row.par_level > 0 ? row.current_stock / row.par_level : 1;
          return (
            <Card key={row.id} className="p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold">{row.name}</span>
                    <StatusPill status={row.status} />
                    <Badge variant="outline" className="border-border text-[10px] capitalize text-muted-foreground">
                      {row.kind}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    <b className="text-foreground">
                      {num(row.current_stock)}
                      {row.unit}
                    </b>{" "}
                    / par {num(row.par_level)}
                    {row.unit} · {eur(row.unit_cost)}/{row.unit}
                    {exp && (
                      <>
                        {" · "}
                        <span className={exp.danger ? "font-bold text-purple" : ""}>
                          <Clock className="mr-0.5 inline h-3 w-3" />
                          {exp.text}
                        </span>
                      </>
                    )}
                  </p>
                  {/* stock bar */}
                  <div className="mt-2 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-secondary">
                    <div
                      className={`h-full rounded-full ${
                        ratio <= 0
                          ? "bg-red"
                          : ratio < 0.5
                            ? "bg-orange"
                            : ratio < 1
                              ? "bg-yellow-500"
                              : "bg-green"
                      }`}
                      style={{ width: `${Math.min(100, ratio * 100)}%` }}
                    />
                  </div>
                </div>
                {/* Transfer actions */}
                <div className="flex shrink-0 flex-col gap-1.5">
                  {!isLab && lab && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1 text-xs"
                      onClick={() => {
                        const labRow = rows.find(
                          (r) => r.company_id === lab.id && r.kind === row.kind && r.name === row.name,
                        );
                        if (!labRow || labRow.current_stock <= 0) {
                          toast.error(`Lab has no ${row.name} in stock`);
                          return;
                        }
                        transfer(labRow, activeId, Math.min(2, labRow.current_stock));
                      }}
                    >
                      <Download className="h-3.5 w-3.5" /> Request from Lab
                    </Button>
                  )}
                  {isLab &&
                    bars.map((b) => (
                      <Button
                        key={b.id}
                        size="sm"
                        variant="outline"
                        className="h-8 gap-1 text-xs"
                        disabled={row.current_stock <= 0}
                        onClick={() => transfer(row, b.id, Math.min(2, row.current_stock))}
                        style={{ color: b.brand_color }}
                      >
                        <Upload className="h-3.5 w-3.5" /> To {barShort(b)}
                      </Button>
                    ))}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- B) Group View ---------- */
function GroupViewTab({ companies }: { companies: Company[] }) {
  const { data: rows = [] } = useCompanyInventory();
  const cols = companies.filter((c) => c.type !== "holding");
  const matrix = useMemo(() => buildGroupStock(rows, companies), [rows, companies]);

  // red flags: a bar is OUT while another company holds plenty
  const flags = useMemo(() => {
    const out: { name: string; unit: string; outAt: Company; holder: Company; qty: number }[] = [];
    for (const g of matrix) {
      for (const c of cols) {
        const qty = g.perCompany[c.id] ?? 0;
        if (qty <= 0) {
          // find biggest holder
          let best: { c: Company; q: number } | null = null;
          for (const other of cols) {
            if (other.id === c.id) continue;
            const q = g.perCompany[other.id] ?? 0;
            if (q > 0 && (!best || q > best.q)) best = { c: other, q };
          }
          if (best) out.push({ name: g.name, unit: g.unit, outAt: c, holder: best.c, qty: best.q });
        }
      }
    }
    return out;
  }, [matrix, cols]);

  return (
    <div className="space-y-4">
      {flags.length > 0 && (
        <Card className="border-red/30 bg-red/5 p-3">
          <p className="flex items-center gap-1.5 text-sm font-bold text-red">
            <AlertTriangle className="h-4 w-4" /> Red flags
          </p>
          <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
            {flags.map((f, i) => (
              <li key={i} className="flex items-center gap-1.5">
                <ArrowLeftRight className="h-3.5 w-3.5 shrink-0 text-red" />
                <span>
                  <b style={{ color: f.outAt.brand_color }}>{barShort(f.outAt)}</b> has 0
                  {f.unit} <b className="text-foreground">{f.name}</b> (OUT).{" "}
                  <b style={{ color: f.holder.brand_color }}>{barShort(f.holder)}</b> has{" "}
                  {num(f.qty)}
                  {f.unit}. Recommend transfer.
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card className="p-0">
        <div className="border-b border-border p-3">
          <p className="text-sm font-bold">Where is what?</p>
          <p className="text-xs text-muted-foreground">Stock across every company, with group totals.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="p-3 font-semibold">Item</th>
                {cols.map((c) => (
                  <th key={c.id} className="p-3 text-right font-semibold" style={{ color: c.brand_color }}>
                    {barShort(c)}
                  </th>
                ))}
                <th className="p-3 text-right font-semibold">Group total</th>
              </tr>
            </thead>
            <tbody>
              {matrix.map((g) => (
                <tr key={`${g.kind}:${g.name}`} className="border-b border-border/50 last:border-0">
                  <td className="p-3">
                    <span className="font-semibold">{g.name}</span>
                    <span className="ml-2 text-[10px] capitalize text-muted-foreground">{g.kind}</span>
                  </td>
                  {cols.map((c) => {
                    const q = g.perCompany[c.id] ?? 0;
                    return (
                      <td
                        key={c.id}
                        className={`p-3 text-right tabular-nums ${q <= 0 ? "font-bold text-red" : ""}`}
                      >
                        {num(q)}
                        {g.unit}
                      </td>
                    );
                  })}
                  <td className="p-3 text-right font-bold tabular-nums">
                    {num(g.total)}
                    {g.unit}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

/* ---------- C) Variance ---------- */
function VarianceTab({ companies }: { companies: Company[] }) {
  const { data: reports = [] } = useVarianceReports();
  const lab = companies.find((c) => c.type === "lab");
  const bars = companies.filter((c) => c.type === "bar");

  const barReports = reports.filter((r) => r.company_id !== lab?.id);
  const labReports = reports.filter((r) => r.company_id === lab?.id);

  // cross-bar comparison per metric
  const metrics = [...new Set(barReports.map((r) => r.metric))];

  function vColor(v: number) {
    const a = Math.abs(v);
    return a >= 15 ? "text-red" : a >= 8 ? "text-orange" : "text-green";
  }

  return (
    <div className="space-y-4">
      {/* Cross-bar comparison */}
      <Card className="p-3">
        <p className="text-sm font-bold">Cross-bar comparison</p>
        <div className="mt-3 space-y-3">
          {metrics.map((m) => (
            <div key={m}>
              <p className="text-xs font-semibold text-muted-foreground">{m}</p>
              <div className="mt-1 flex flex-wrap gap-3">
                {bars.map((b) => {
                  const r = barReports.find((x) => x.company_id === b.id && x.metric === m);
                  if (!r) return null;
                  return (
                    <span key={b.id} className="text-sm">
                      <b style={{ color: b.brand_color }}>{barShort(b)}</b>{" "}
                      <span className={`font-bold ${vColor(r.variance)}`}>
                        {r.variance > 0 ? "+" : ""}
                        {num(r.variance)}%
                      </span>
                    </span>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Per-company variance rows */}
      <Card className="p-0">
        <div className="border-b border-border p-3 text-sm font-bold">Per-company variance</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="p-3 font-semibold">Company</th>
                <th className="p-3 font-semibold">Metric</th>
                <th className="p-3 text-right font-semibold">Expected</th>
                <th className="p-3 text-right font-semibold">Actual</th>
                <th className="p-3 text-right font-semibold">Variance</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => {
                const c = companyById(companies, r.company_id);
                return (
                  <tr key={r.id} className="border-b border-border/50 last:border-0">
                    <td className="p-3 font-semibold" style={{ color: c?.brand_color }}>
                      {barShort(c)}
                    </td>
                    <td className="p-3">{r.metric}</td>
                    <td className="p-3 text-right tabular-nums">{num(r.expected)}</td>
                    <td className="p-3 text-right tabular-nums">{num(r.actual)}</td>
                    <td className={`p-3 text-right font-bold tabular-nums ${vColor(r.variance)}`}>
                      {r.variance > 0 ? "+" : ""}
                      {num(r.variance)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Lab variance */}
      {labReports.length > 0 && (
        <Card className="border-pink/30 bg-pink/5 p-3">
          <p className="flex items-center gap-1.5 text-sm font-bold text-pink">
            <FlaskConical className="h-4 w-4" /> Lab batch variance
          </p>
          <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
            {labReports.map((r) => (
              <li key={r.id}>
                <b className="text-foreground">{r.metric}</b>: {r.notes}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

/* ---------- D) Price History ---------- */
function PriceHistoryTab({ companies }: { companies: Company[] }) {
  const { data: history = [] } = usePriceHistory();
  const { data: products = [] } = useProducts();
  const { data: transfers = [] } = useTransfers();
  const cols = companies.filter((c) => c.type !== "holding");
  const productName = (id: string) => products.find((p) => p.id === id)?.name ?? "—";
  const latest = useMemo(() => latestPrices(history), [history]);

  // group latest by product
  const byProduct = useMemo(() => {
    const map = new Map<string, { name: string; perCompany: Record<string, number> }>();
    for (const l of latest) {
      let g = map.get(l.productId);
      if (!g) {
        g = { name: productName(l.productId), perCompany: {} };
        map.set(l.productId, g);
      }
      g.perCompany[l.companyId] = l.price;
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latest, products]);

  const labResale = transfers.filter((t) => t.kind === "resale" || t.kind === "batch");

  return (
    <div className="space-y-4">
      <Card className="p-0">
        <div className="border-b border-border p-3 text-sm font-bold">Per-company price tracking (latest)</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="p-3 font-semibold">Product</th>
                {cols.map((c) => (
                  <th key={c.id} className="p-3 text-right font-semibold" style={{ color: c.brand_color }}>
                    {barShort(c)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {byProduct.map((g) => (
                <tr key={g.name} className="border-b border-border/50 last:border-0">
                  <td className="p-3 font-semibold">{g.name}</td>
                  {cols.map((c) => {
                    const v = g.perCompany[c.id];
                    return (
                      <td key={c.id} className="p-3 text-right tabular-nums">
                        {v != null ? eur(v) : "—"}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="border-pink/30 bg-pink/5 p-0">
        <div className="flex items-center gap-1.5 border-b border-pink/20 p-3 text-sm font-bold text-pink">
          <FlaskConical className="h-4 w-4" /> Lab transfer price history
        </div>
        {labResale.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">No Lab transfers recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-pink/20 text-left text-xs text-muted-foreground">
                  <th className="p-3 font-semibold">Batch / item</th>
                  <th className="p-3 text-right font-semibold">Prod. cost</th>
                  <th className="p-3 text-right font-semibold">Markup</th>
                  <th className="p-3 text-right font-semibold">Transfer price</th>
                  <th className="p-3 text-right font-semibold">Date</th>
                </tr>
              </thead>
              <tbody>
                {labResale.map((t) => (
                  <tr key={t.id} className="border-b border-pink/10 last:border-0">
                    <td className="p-3 font-semibold">{t.item_name}</td>
                    <td className="p-3 text-right tabular-nums">{eur(t.production_cost)}</td>
                    <td className="p-3 text-right tabular-nums">{num(t.markup_percent, 0)}%</td>
                    <td className="p-3 text-right font-bold tabular-nums text-pink">
                      {eur(t.transfer_price)}
                    </td>
                    <td className="p-3 text-right text-xs text-muted-foreground">
                      {new Date(t.created_at).toLocaleDateString("pt-PT")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

/* ---------- E) Event Log ---------- */
const INTER_CO_EVENTS = new Set([
  "INTER_COMPANY_DELIVERY",
  "INTER_COMPANY_SALE",
]);

function EventLogTab({ companies }: { companies: Company[] }) {
  const { data: events = [] } = useBusinessEvents();
  const selectable = companies.filter((c) => c.type !== "holding");
  const [companyId, setCompanyId] = useState<string>("all");

  const filtered = events
    .filter((e) =>
      ["company_inventory", "inventory", "inter_company_transfers"].includes(
        e.entity_type ?? "",
      ) ||
      INTER_CO_EVENTS.has(e.event_type) ||
      e.event_type.startsWith("STOCK") ||
      e.event_type.startsWith("PREP") ||
      e.event_type === "EXPIRY_WARNING" ||
      e.event_type === "VARIANCE_DETECTED",
    )
    .filter((e) => companyId === "all" || e.company_id === companyId);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <CompanyChip
          active={companyId === "all"}
          label="All Companies"
          color="#a29bfe"
          onClick={() => setCompanyId("all")}
        />
        {selectable.map((c) => (
          <CompanyChip
            key={c.id}
            active={companyId === c.id}
            label={barShort(c)}
            color={c.brand_color}
            onClick={() => setCompanyId(c.id)}
          />
        ))}
      </div>

      {filtered.length === 0 && (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          No stock movements recorded yet.
        </Card>
      )}

      <div className="space-y-2">
        {filtered.map((e) => {
          const c = companyById(companies, e.company_id);
          const isInterCo = INTER_CO_EVENTS.has(e.event_type);
          const p = (e.payload ?? {}) as Record<string, unknown>;
          return (
            <Card
              key={e.id}
              className={`p-3 ${isInterCo ? "border-teal/40 bg-teal/5" : ""}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant="outline"
                      className={`text-[10px] font-bold ${
                        isInterCo ? "border-teal/40 text-teal" : "border-border text-muted-foreground"
                      }`}
                    >
                      {isInterCo && <ArrowLeftRight className="mr-1 h-3 w-3" />}
                      {e.event_type.replaceAll("_", " ")}
                    </Badge>
                    {c && (
                      <span className="text-xs font-bold" style={{ color: c.brand_color }}>
                        {barShort(c)}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {p.item ? (
                      <>
                        <b className="text-foreground">
                          {String(p.quantity ?? "")}
                          {String(p.unit ?? "")} {String(p.item)}
                        </b>
                        {p.from && p.to ? (
                          <>
                            {" "}
                            {String(p.from)} → {String(p.to)}
                          </>
                        ) : null}
                      </>
                    ) : (
                      <span className="capitalize">{e.entity_type ?? "event"}</span>
                    )}
                  </p>
                </div>
                <span className="shrink-0 text-[10px] text-muted-foreground">
                  {new Date(e.created_at).toLocaleString("pt-PT", {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}