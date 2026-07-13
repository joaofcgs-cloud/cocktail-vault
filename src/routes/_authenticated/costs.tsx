import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
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
  useGroupCocktails,
  useServiceCosts,
  useProducts,
  usePriceHistory,
  findBar,
  barShort,
  buildBenchmark,
  buildSharedComparisons,
  latestPrices,
  buildSupplierScores,
  marginOf,
  costOf,
  type Company,
  type GroupCocktail,
} from "@/lib/group";
import { toast } from "sonner";
import {
  BarChart3,
  Building2,
  UtensilsCrossed,
  Wine,
  Wrench,
  TrendingUp,
  Truck,
  ArrowRight,
  Copy,
  ChevronRight,
  AlertTriangle,
  Trophy,
  Boxes,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/costs")({
  head: () => ({
    meta: [
      { title: "Costs — Imprensa Group Command Center" },
      {
        name: "description",
        content:
          "Multi-company cost control across the Plataforma Boémia group: group benchmarking, food/beverage/operating costs, price evolution and supplier scorecards.",
      },
    ],
  }),
  component: CostsPage,
});

const TABS = [
  { key: "bench", label: "Group Benchmarking", icon: BarChart3 },
  { key: "company", label: "By Company", icon: Building2 },
  { key: "food", label: "Food", icon: UtensilsCrossed },
  { key: "beverage", label: "Beverage", icon: Wine },
  { key: "operating", label: "Operating", icon: Wrench },
  { key: "price", label: "Price Evolution", icon: TrendingUp },
  { key: "suppliers", label: "Suppliers", icon: Truck },
] as const;
type TabKey = (typeof TABS)[number]["key"];

function CostsPage() {
  const [tab, setTab] = useState<TabKey>("bench");
  const [companyId, setCompanyId] = useState<string>("");

  const { data: companies = [] } = useCompanies();
  const { data: cocktails = [] } = useGroupCocktails();
  const { data: serviceCosts = [] } = useServiceCosts();
  const { data: products = [] } = useProducts();
  const { data: priceRows = [] } = usePriceHistory();

  const pr = findBar(companies, "Principe");
  const baixa = findBar(companies, "Baixa");
  const bars = companies.filter((c) => c.type === "bar");

  // default selected company = first bar
  const selected =
    companies.find((c) => c.id === companyId) ?? pr ?? bars[0];

  return (
    <div className="mx-auto w-full max-w-6xl px-3 pb-24 pt-4 md:px-6">
      <header className="mb-4">
        <h1 className="text-xl font-semibold text-foreground md:text-2xl">Costs</h1>
        <p className="text-sm text-muted-foreground">
          Group-wide cost control — drill from group to company, category, product and invoice.
        </p>
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
                active
                  ? "bg-teal/15 text-teal"
                  : "text-muted-foreground hover:bg-card"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "bench" && (
        <BenchmarkTab companies={companies} cocktails={cocktails} pr={pr} baixa={baixa} />
      )}
      {tab === "company" && (
        <ByCompanyTab
          companies={companies}
          bars={bars}
          selected={selected}
          onSelect={setCompanyId}
          cocktails={cocktails}
          serviceCosts={serviceCosts}
          pr={pr}
          baixa={baixa}
        />
      )}
      {(tab === "food" || tab === "beverage") && (
        <CategoryTab
          kind={tab}
          companies={companies}
          bars={bars}
          selected={selected}
          onSelect={setCompanyId}
          products={products}
          priceRows={priceRows}
        />
      )}
      {tab === "operating" && (
        <OperatingTab
          bars={bars}
          selected={selected}
          onSelect={setCompanyId}
          serviceCosts={serviceCosts}
        />
      )}
      {tab === "price" && (
        <PriceEvolutionTab companies={companies} products={products} priceRows={priceRows} />
      )}
      {tab === "suppliers" && (
        <SuppliersTab companies={companies} priceRows={priceRows} serviceCosts={serviceCosts} />
      )}
    </div>
  );
}

/* ---------- Shared bits ---------- */
function CompanySelect({
  bars,
  selected,
  onSelect,
}: {
  bars: Company[];
  selected?: Company;
  onSelect: (id: string) => void;
}) {
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

function Dot({ color }: { color: string }) {
  return <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: color }} />;
}

/* ---------- A) Group Benchmarking ---------- */
function BenchmarkTab({
  companies,
  cocktails,
  pr,
  baixa,
}: {
  companies: Company[];
  cocktails: GroupCocktail[];
  pr?: Company;
  baixa?: Company;
}) {
  const metrics = useMemo(() => buildBenchmark(cocktails, pr, baixa), [cocktails, pr, baixa]);
  const comparisons = useMemo(
    () => buildSharedComparisons(cocktails, pr, baixa),
    [cocktails, pr, baixa],
  );

  const fmt = (m: (typeof metrics)[number], v: number) =>
    m.suffix === "€" ? eur(v) : `${num(v)}%`;

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden p-0">
        <div className="border-b border-border p-4">
          <h2 className="text-sm font-semibold text-foreground">Metrics × Companies</h2>
          <p className="text-xs text-muted-foreground">Best performer per metric highlighted.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="px-4 py-2 font-medium">Metric</th>
                <th className="px-4 py-2 font-medium">Target</th>
                <th className="px-4 py-2 font-medium">
                  <span className="inline-flex items-center gap-1.5"><Dot color="#4ecdc4" />PR</span>
                </th>
                <th className="px-4 py-2 font-medium">
                  <span className="inline-flex items-center gap-1.5"><Dot color="#ffa502" />Baixa</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {metrics.map((m) => {
                const prBest = m.lowerIsBetter ? m.pr <= m.baixa : m.pr >= m.baixa;
                return (
                  <tr key={m.key} className="border-t border-border/60">
                    <td className="px-4 py-2.5 text-foreground">{m.label}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {m.target != null ? `${m.target}%` : "—"}
                    </td>
                    <td className={`px-4 py-2.5 font-medium ${prBest ? "text-green" : "text-foreground"}`}>
                      {fmt(m, m.pr)}
                    </td>
                    <td className={`px-4 py-2.5 font-medium ${!prBest ? "text-green" : "text-foreground"}`}>
                      {fmt(m, m.baixa)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="p-4">
        <h2 className="mb-3 text-sm font-semibold text-foreground">Cocktail margin comparison</h2>
        <div className="space-y-2">
          {comparisons.slice(0, 8).map((c) => {
            const prC = cocktails.find((x) => x.name === c.name && x.company_id === pr?.id);
            const bxC = cocktails.find((x) => x.name === c.name && x.company_id === baixa?.id);
            const prM = prC ? marginOf(prC) : 0;
            const bxM = bxC ? marginOf(bxC) : 0;
            const diff = bxM - prM;
            return (
              <div
                key={c.name}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-background/50 px-3 py-2"
              >
                <span className="text-sm font-medium text-foreground">{c.name}</span>
                <span className="text-xs text-muted-foreground">
                  PR {num(prM)}% <span className="text-border">|</span> Baixa {num(bxM)}%{" "}
                  <span
                    className={`ml-1 font-semibold ${diff >= 0 ? "text-green" : "text-red"}`}
                  >
                    Diff {diff >= 0 ? "+" : ""}
                    {num(diff)}%
                  </span>
                </span>
              </div>
            );
          })}
          {comparisons.length === 0 && (
            <p className="text-xs text-muted-foreground">No shared cocktails between bars yet.</p>
          )}
        </div>
      </Card>

      {comparisons.filter((c) => c.diff !== 0).length > 0 && (
        <Card className="border-purple/30 bg-purple/5 p-4">
          <div className="mb-3 flex items-center gap-2">
            <Trophy className="h-4 w-4 text-purple" />
            <h2 className="text-sm font-semibold text-foreground">Copy Best Practice</h2>
          </div>
          <div className="space-y-2">
            {comparisons
              .filter((c) => c.diff > 0)
              .slice(0, 4)
              .map((c) => (
                <div
                  key={c.name}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-background/50 px-3 py-2"
                >
                  <span className="text-xs text-muted-foreground">
                    Baixa prices <b className="text-foreground">{c.name}</b> {eur(c.diff)} higher (
                    {eur(c.prPrice)} → {eur(c.baixaPrice)}) — apply to PR?
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 gap-1 text-xs"
                    onClick={() =>
                      toast.success(
                        `Suggested: raise ${c.name} at Príncipe Real to ${eur(c.baixaPrice)}`,
                        { description: "Sent to Menu AI for review — owner approval required." },
                      )
                    }
                  >
                    <Copy className="h-3 w-3" /> Apply to PR
                  </Button>
                </div>
              ))}
          </div>
        </Card>
      )}
    </div>
  );
}

/* ---------- B) By Company ---------- */
function ByCompanyTab({
  bars,
  selected,
  onSelect,
  cocktails,
  serviceCosts,
  pr,
  baixa,
}: {
  companies: Company[];
  bars: Company[];
  selected?: Company;
  onSelect: (id: string) => void;
  cocktails: GroupCocktail[];
  serviceCosts: ReturnType<typeof useServiceCosts>["data"];
  pr?: Company;
  baixa?: Company;
}) {
  const metrics = useMemo(() => buildBenchmark(cocktails, pr, baixa), [cocktails, pr, baixa]);
  const isPR = selected?.id === pr?.id;
  const rows = serviceCosts ?? [];
  const monthlyOps = rows
    .filter((r) => r.company_id === selected?.id)
    .reduce((s, r) => s + Number(r.amount), 0);

  return (
    <div className="space-y-4">
      <CompanySelect bars={bars} selected={selected} onSelect={onSelect} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {metrics
          .filter((m) => ["food", "bev", "prime", "labour"].includes(m.key))
          .map((m) => {
            const val = isPR ? m.pr : m.baixa;
            const groupAvg = (m.pr + m.baixa) / 2;
            const best = m.lowerIsBetter ? Math.min(m.pr, m.baixa) : Math.max(m.pr, m.baixa);
            const overTarget = m.target != null && val > m.target;
            return (
              <Card key={m.key} className="p-3">
                <p className="text-[11px] text-muted-foreground">{m.label}</p>
                <p className={`text-lg font-semibold ${overTarget ? "text-red" : "text-foreground"}`}>
                  {num(val)}%
                </p>
                <p className="text-[10px] text-muted-foreground">
                  vs group {num(groupAvg)}% · best {num(best)}%
                </p>
              </Card>
            );
          })}
      </div>

      <Card className="p-4">
        <h2 className="mb-3 text-sm font-semibold text-foreground">
          Shared cost allocation — {barShort(selected)}
        </h2>
        <div className="space-y-2 text-sm">
          <AllocRow label="Operating costs (this company)" value={eur(monthlyOps)} note="direct" />
          <AllocRow
            label="Cocktail Lab production"
            value={eur(isPR ? 2100 : 2600)}
            note="allocated by prep usage"
            accent="#fd79a8"
          />
          <AllocRow
            label="Holding shared services (accounting, insurance)"
            value={eur(160)}
            note="split 50/50"
            accent="#a29bfe"
          />
        </div>
      </Card>

      <Card className="p-4">
        <div className="mb-2 flex items-center gap-2">
          <Boxes className="h-4 w-4 text-pink" />
          <h2 className="text-sm font-semibold text-foreground">Inter-company purchases</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          {barShort(selected)} buys prep from Cocktail Lab at a 30% markup. Outstanding balance:{" "}
          <b className="text-foreground">{eur(isPR ? 2100 : 2600)}</b>
          {isPR ? "" : " (5 days overdue)"}.
        </p>
      </Card>
    </div>
  );
}

function AllocRow({
  label,
  value,
  note,
  accent = "#4ecdc4",
}: {
  label: string;
  value: string;
  note: string;
  accent?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg bg-background/50 px-3 py-2">
      <span className="flex items-center gap-2">
        <Dot color={accent} />
        <span className="text-foreground">{label}</span>
      </span>
      <span className="text-right">
        <span className="block font-medium text-foreground">{value}</span>
        <span className="block text-[10px] text-muted-foreground">{note}</span>
      </span>
    </div>
  );
}

/* ---------- C) Food / Beverage ---------- */
function CategoryTab({
  kind,
  companies,
  bars,
  selected,
  onSelect,
  products,
  priceRows,
}: {
  kind: "food" | "beverage";
  companies: Company[];
  bars: Company[];
  selected?: Company;
  onSelect: (id: string) => void;
  products: ReturnType<typeof useProducts>["data"];
  priceRows: ReturnType<typeof usePriceHistory>["data"];
}) {
  const cat = kind === "food" ? "food" : "spirit";
  const latest = useMemo(() => latestPrices(priceRows ?? []), [priceRows]);
  const prodList = (products ?? []).filter((p) => p.category === cat);

  // products that have price history rows (real comparable data)
  const withPrices = prodList.filter((p) => latest.some((l) => l.productId === p.id));

  const barById = (id: string) => companies.find((c) => c.id === id);

  return (
    <div className="space-y-4">
      <CompanySelect bars={bars} selected={selected} onSelect={onSelect} />
      <Card className="overflow-hidden p-0">
        <div className="border-b border-border p-4">
          <h2 className="text-sm font-semibold text-foreground">
            {kind === "food" ? "Food" : "Beverage"} — cross-company price comparison
          </h2>
          <p className="text-xs text-muted-foreground">
            Prices per company &amp; supplier. Lab-resale items shown in pink.
          </p>
        </div>
        <div className="divide-y divide-border/60">
          {withPrices.map((p) => {
            const rows = latest.filter((l) => l.productId === p.id);
            const min = Math.min(...rows.map((r) => r.price));
            return (
              <div key={p.id} className="p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">{p.name}</span>
                  <span className="text-[10px] uppercase text-muted-foreground">{p.unit_type || cat}</span>
                </div>
                <div className="space-y-1.5">
                  {rows.map((r) => {
                    const co = barById(r.companyId);
                    const isLab = r.supplier.toLowerCase().includes("lab");
                    return (
                      <div
                        key={r.companyId}
                        className="flex items-center justify-between gap-2 text-xs"
                      >
                        <span className="flex items-center gap-2 text-muted-foreground">
                          <Dot color={co?.brand_color ?? "#666"} />
                          {barShort(co)}
                          <span className={isLab ? "text-pink" : "text-muted-foreground"}>
                            · {r.supplier}
                          </span>
                        </span>
                        <span
                          className={`font-medium ${r.price === min ? "text-green" : "text-foreground"}`}
                        >
                          {eur(r.price)}
                        </span>
                      </div>
                    );
                  })}
                </div>
                {rows.length > 1 && (
                  <p className="mt-2 text-[11px] text-orange">
                    {(() => {
                      const sorted = [...rows].sort((a, b) => b.price - a.price);
                      const hi = sorted[0];
                      const lo = sorted[sorted.length - 1];
                      const pct = ((hi.price - lo.price) / lo.price) * 100;
                      return `${barShort(barById(hi.price === lo.price ? hi.companyId : hi.companyId))} pays ${num(pct)}% more than ${barShort(barById(lo.companyId))}. Consolidate through Lab?`;
                    })()}
                  </p>
                )}
              </div>
            );
          })}
          {withPrices.length === 0 && (
            <p className="p-4 text-xs text-muted-foreground">
              No tracked price data in this category yet.
            </p>
          )}
        </div>
      </Card>
    </div>
  );
}

/* ---------- Operating ---------- */
function OperatingTab({
  bars,
  selected,
  onSelect,
  serviceCosts,
}: {
  bars: Company[];
  selected?: Company;
  onSelect: (id: string) => void;
  serviceCosts: ReturnType<typeof useServiceCosts>["data"];
}) {
  const rows = (serviceCosts ?? []).filter((r) => r.company_id === selected?.id);
  const byCat = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) m.set(r.category, (m.get(r.category) ?? 0) + Number(r.amount));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [rows]);
  const total = rows.reduce((s, r) => s + Number(r.amount), 0);

  return (
    <div className="space-y-4">
      <CompanySelect bars={bars} selected={selected} onSelect={onSelect} />
      <Card className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Operating costs — {barShort(selected)}</h2>
          <span className="text-sm font-semibold text-foreground">{eur(total)}/mo</span>
        </div>
        <div className="space-y-1.5">
          {byCat.map(([cat, amt]) => (
            <div key={cat} className="flex items-center justify-between text-sm">
              <span className="capitalize text-muted-foreground">{cat}</span>
              <span className="text-foreground">{eur(amt)}</span>
            </div>
          ))}
        </div>
      </Card>
      <Card className="overflow-hidden p-0">
        <div className="border-b border-border p-4">
          <h2 className="text-sm font-semibold text-foreground">Line items</h2>
        </div>
        <div className="divide-y divide-border/60">
          {rows
            .sort((a, b) => Number(b.amount) - Number(a.amount))
            .map((r) => (
              <div key={r.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <span className="text-foreground">{r.name}</span>
                <span className="text-muted-foreground">
                  {eur(Number(r.amount))}
                  <span className="ml-2 text-[10px] capitalize">/{r.frequency}</span>
                </span>
              </div>
            ))}
        </div>
      </Card>
    </div>
  );
}

/* ---------- D) Price Evolution ---------- */
function PriceEvolutionTab({
  companies,
  products,
  priceRows,
}: {
  companies: Company[];
  products: ReturnType<typeof useProducts>["data"];
  priceRows: ReturnType<typeof usePriceHistory>["data"];
}) {
  const rows = priceRows ?? [];
  const prodMap = new Map((products ?? []).map((p) => [p.id, p]));
  const barById = (id: string) => companies.find((c) => c.id === id);

  // group by product
  const byProduct = useMemo(() => {
    const m = new Map<string, typeof rows>();
    for (const r of rows) {
      if (!m.has(r.product_id)) m.set(r.product_id, []);
      m.get(r.product_id)!.push(r);
    }
    return m;
  }, [rows]);

  const [productId, setProductId] = useState<string>("");
  const productIds = [...byProduct.keys()];
  const sel = productId || productIds[0];
  const selRows = (byProduct.get(sel) ?? []).slice().sort((a, b) =>
    a.recorded_at.localeCompare(b.recorded_at),
  );

  // "Which bar pays most for Tanqueray?"
  const latest = useMemo(() => latestPrices(rows), [rows]);
  const tanqueray = (products ?? []).find((p) => p.name.toLowerCase().includes("tanqueray"));
  const tanqRows = tanqueray ? latest.filter((l) => l.productId === tanqueray.id) : [];
  const tanqTop = [...tanqRows].sort((a, b) => b.price - a.price)[0];

  // lime consolidation alert
  const lime = (products ?? []).find((p) => p.name.toLowerCase() === "lima");
  const limeRows = lime ? latest.filter((l) => l.productId === lime.id) : [];
  const limeHi = [...limeRows].sort((a, b) => b.price - a.price)[0];
  const limeLo = [...limeRows].sort((a, b) => a.price - b.price)[0];
  const limePct = limeHi && limeLo && limeLo.price ? ((limeHi.price - limeLo.price) / limeLo.price) * 100 : 0;

  return (
    <div className="space-y-4">
      {tanqTop && (
        <Card className="border-teal/30 bg-teal/5 p-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-teal" />
            <p className="text-sm text-foreground">
              <b>{barShort(barById(tanqTop.companyId))}</b> pays most for Tanqueray:{" "}
              <b>{eur(tanqTop.price)}</b> (via {tanqTop.supplier}).
            </p>
          </div>
        </Card>
      )}

      {limeHi && limeLo && limePct > 0 && (
        <Card className="border-orange/30 bg-orange/5 p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-orange" />
            <p className="text-sm text-foreground">
              {barShort(barById(limeHi.companyId))} pays {num(limePct)}% more for lime than{" "}
              {barShort(barById(limeLo.companyId))}. Consolidate through Lab?
            </p>
          </div>
        </Card>
      )}

      <Card className="p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-foreground">Per-company price tracking</h2>
          <Select value={sel} onValueChange={setProductId}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Product" />
            </SelectTrigger>
            <SelectContent>
              {productIds.map((id) => (
                <SelectItem key={id} value={id}>
                  {prodMap.get(id)?.name ?? id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <PriceChart companies={companies} rows={selRows} />
      </Card>
    </div>
  );
}

function PriceChart({
  companies,
  rows,
}: {
  companies: Company[];
  rows: { company_id: string; unit_cost: number; recorded_at: string; supplier: string }[];
}) {
  if (rows.length === 0)
    return <p className="text-xs text-muted-foreground">No price history for this product.</p>;
  const byCompany = new Map<string, typeof rows>();
  for (const r of rows) {
    if (!byCompany.has(r.company_id)) byCompany.set(r.company_id, []);
    byCompany.get(r.company_id)!.push(r);
  }
  const all = rows.map((r) => Number(r.unit_cost));
  const max = Math.max(...all);
  const min = Math.min(...all) * 0.9;
  const dates = [...new Set(rows.map((r) => r.recorded_at))].sort();

  return (
    <div className="space-y-3">
      {[...byCompany.entries()].map(([cid, list]) => {
        const co = companies.find((c) => c.id === cid);
        const sorted = [...list].sort((a, b) => a.recorded_at.localeCompare(b.recorded_at));
        return (
          <div key={cid}>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="flex items-center gap-2 text-foreground">
                <Dot color={co?.brand_color ?? "#666"} />
                {barShort(co)}
              </span>
              <span className="text-muted-foreground">
                {eur(Number(sorted[0].unit_cost))} → {eur(Number(sorted[sorted.length - 1].unit_cost))}
              </span>
            </div>
            <div className="flex items-end gap-1" style={{ height: 48 }}>
              {sorted.map((r, i) => {
                const h = ((Number(r.unit_cost) - min) / (max - min || 1)) * 100;
                return (
                  <div
                    key={i}
                    className="flex-1 rounded-t"
                    style={{
                      height: `${Math.max(h, 6)}%`,
                      background: co?.brand_color ?? "#666",
                      opacity: 0.5 + (0.5 * (i + 1)) / sorted.length,
                    }}
                    title={`${r.recorded_at.slice(0, 10)}: ${eur(Number(r.unit_cost))}`}
                  />
                );
              })}
            </div>
          </div>
        );
      })}
      <div className="flex justify-between text-[10px] text-muted-foreground">
        {dates.map((d) => (
          <span key={d}>{d.slice(5, 7)}/{d.slice(2, 4)}</span>
        ))}
      </div>
    </div>
  );
}

/* ---------- E) Suppliers ---------- */
function SuppliersTab({
  companies,
  priceRows,
  serviceCosts,
}: {
  companies: Company[];
  priceRows: ReturnType<typeof usePriceHistory>["data"];
  serviceCosts: ReturnType<typeof useServiceCosts>["data"];
}) {
  const scores = useMemo(() => buildSupplierScores(priceRows ?? []), [priceRows]);

  return (
    <div className="space-y-4">
      <Card className="border-green/30 bg-green/5 p-4">
        <div className="flex items-center gap-2">
          <Truck className="h-4 w-4 text-green" />
          <p className="text-sm text-foreground">
            If both bars order PURA through Cocktail Lab, save <b>{eur(80)}/month</b> on delivery fees.
          </p>
        </div>
      </Card>

      <div className="grid gap-3 md:grid-cols-2">
        {scores.map((s) => {
          const barCount = [...s.companyIds].filter((id) =>
            companies.some((c) => c.id === id && c.type === "bar"),
          ).length;
          return (
            <Card key={s.name} className="p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-semibold text-foreground">{s.name}</span>
                <Badge variant="outline" className="text-[10px]">
                  {barCount} bar{barCount === 1 ? "" : "s"}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Serves {barCount} bar{barCount === 1 ? "" : "s"}. Total group spend:{" "}
                <b className="text-foreground">{eur(s.monthlySpend)}/month</b>.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {[...s.companyIds].map((id) => {
                  const co = companies.find((c) => c.id === id);
                  if (!co) return null;
                  return (
                    <span
                      key={id}
                      className="flex items-center gap-1 rounded-full bg-background/60 px-2 py-0.5 text-[10px] text-muted-foreground"
                    >
                      <Dot color={co.brand_color} />
                      {barShort(co)}
                    </span>
                  );
                })}
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                {s.items} tracked product{s.items === 1 ? "" : "s"}
              </p>
            </Card>
          );
        })}
        {scores.length === 0 && (
          <p className="text-xs text-muted-foreground">No supplier price data yet.</p>
        )}
      </div>
    </div>
  );
}