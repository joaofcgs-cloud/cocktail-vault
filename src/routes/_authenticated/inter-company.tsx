import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
  useGroupPreps,
  useProducts,
  useServiceCosts,
  useCompanyRelationships,
  useTransfers,
  useTransferAllocations,
  useInterCompanyPayments,
  useCostAllocations,
  prepProductionCost,
  transferPrice,
  computeBalances,
  DEFAULT_MARKUP_PERCENT,
  barShort,
  type Company,
  type GroupPrep,
  type Transfer,
} from "@/lib/group";
import { toast } from "sonner";
import {
  ArrowLeftRight,
  Package,
  Split,
  Scale,
  Percent,
  Plus,
  Truck,
  AlertTriangle,
  Bell,
  Wallet,
  TrendingUp,
  FlaskConical,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/inter-company")({
  head: () => ({
    meta: [
      { title: "Inter-Company — Imprensa Group Command Center" },
      {
        name: "description",
        content:
          "Lab-to-bar batch transfers, ingredient resale, shared cost allocation and inter-company balances across the Plataforma Boémia group.",
      },
    ],
  }),
  component: InterCompanyPage,
});

const TABS = [
  { key: "transfers", label: "Lab Transfers", icon: ArrowLeftRight },
  { key: "resale", label: "Ingredient Resale", icon: Package },
  { key: "allocation", label: "Cost Allocation", icon: Split },
  { key: "balances", label: "Balances", icon: Scale },
  { key: "prices", label: "Transfer Prices", icon: Percent },
] as const;
type TabKey = (typeof TABS)[number]["key"];

function InterCompanyPage() {
  const [tab, setTab] = useState<TabKey>("transfers");
  const qc = useQueryClient();

  const { data: companies = [] } = useCompanies();
  const { data: preps = [] } = useGroupPreps();
  const { data: products = [] } = useProducts();
  const { data: serviceCosts = [] } = useServiceCosts();
  const { data: relationships = [] } = useCompanyRelationships();
  const { data: transfers = [] } = useTransfers();
  const { data: allocations = [] } = useTransferAllocations();
  const { data: payments = [] } = useInterCompanyPayments();
  const { data: costAllocs = [] } = useCostAllocations();

  const lab = companies.find((c) => c.type === "lab");
  const holding = companies.find((c) => c.type === "holding");
  const bars = companies.filter((c) => c.type === "bar");

  function refresh() {
    for (const key of [
      "inter_company_transfers",
      "transfer_allocations",
      "inter_company_payments",
      "cost_allocations",
      "company_relationships",
      "business_events_group",
    ]) {
      qc.invalidateQueries({ queryKey: [key] });
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-3 pb-24 pt-4 md:px-6">
      <header className="mb-4">
        <h1 className="text-xl font-semibold text-foreground md:text-2xl">Inter-Company</h1>
        <p className="text-sm text-muted-foreground">
          Cocktail Lab supplies both bars — batch transfers, resale, cost splits and balances.
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
                active ? "bg-pink/15 text-pink" : "text-muted-foreground hover:bg-card"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "transfers" && (
        <TransfersTab
          lab={lab}
          bars={bars}
          preps={preps}
          transfers={transfers}
          allocations={allocations}
          companies={companies}
          onChange={refresh}
        />
      )}
      {tab === "resale" && (
        <ResaleTab
          lab={lab}
          bars={bars}
          products={products}
          transfers={transfers}
          companies={companies}
          onChange={refresh}
        />
      )}
      {tab === "allocation" && (
        <AllocationTab
          holding={holding}
          bars={bars}
          serviceCosts={serviceCosts}
          costAllocs={costAllocs}
          companies={companies}
          onChange={refresh}
        />
      )}
      {tab === "balances" && (
        <BalancesTab
          lab={lab}
          companies={companies}
          transfers={transfers}
          allocations={allocations}
          payments={payments}
          onChange={refresh}
        />
      )}
      {tab === "prices" && (
        <PricesTab
          relationships={relationships}
          transfers={transfers}
          companies={companies}
          onChange={refresh}
        />
      )}
    </div>
  );
}

/* ============================ A) LAB TRANSFERS ============================ */
function TransfersTab({
  lab,
  bars,
  preps,
  transfers,
  allocations,
  companies,
  onChange,
}: {
  lab?: Company;
  bars: Company[];
  preps: GroupPrep[];
  transfers: Transfer[];
  allocations: ReturnType<typeof useTransferAllocations>["data"] & object;
  companies: Company[];
  onChange: () => void;
}) {
  const [open, setOpen] = useState(false);
  const active = transfers.filter((t) => t.kind === "batch" && t.status === "active");
  const allocList = allocations ?? [];

  async function markDelivered(t: Transfer) {
    await db
      .from("inter_company_transfers")
      .update({ status: "delivered", delivered_at: new Date().toISOString() })
      .eq("id", t.id);
    // Inventory sync (both sides) + event + notification
    await db.from("business_events").insert({
      company_id: lab?.id ?? null,
      event_type: "INTER_COMPANY_DELIVERY",
      entity_type: "inter_company_transfer",
      entity_id: t.id,
      payload: { item: t.item_name, yield: t.yield_amount, transfer_price: t.transfer_price },
    });
    const targets = allocList.filter((a) => a.transfer_id === t.id);
    for (const a of targets) {
      await db.from("business_events").insert({
        company_id: a.to_company_id,
        event_type: "STOCK_ADJUSTED",
        entity_type: "inter_company_transfer",
        entity_id: t.id,
        payload: { item: t.item_name, quantity: a.quantity, source: "Cocktail Lab transfer" },
      });
      await db.from("notifications").insert({
        company_id: a.to_company_id,
        title: "Lab delivery received",
        body: `${num(a.quantity)} ${t.yield_unit} of ${t.item_name} added to stock from the Cocktail Lab.`,
        severity: "info",
        link: "/inter-company",
      });
    }
    toast.success(`${t.item_name} marked delivered — bar inventory updated`);
    onChange();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {active.length} active batch {active.length === 1 ? "transfer" : "transfers"} from the Cocktail Lab
        </p>
        <Button size="sm" className="bg-pink text-black hover:bg-pink/90" onClick={() => setOpen(true)}>
          <Plus className="mr-1 h-4 w-4" /> Create Batch Transfer
        </Button>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="p-3 font-medium">Prep</th>
                <th className="p-3 font-medium">Yield</th>
                <th className="p-3 font-medium">Prod. cost</th>
                <th className="p-3 font-medium">Transfer price</th>
                <th className="p-3 font-medium">Allocation</th>
                <th className="p-3 font-medium">Delivery</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {active.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-muted-foreground">
                    No active transfers. Create a batch transfer to supply the bars.
                  </td>
                </tr>
              )}
              {active.map((t) => {
                const allocs = allocList.filter((a) => a.transfer_id === t.id);
                return (
                  <tr key={t.id} className="border-b border-border/60">
                    <td className="p-3 font-medium text-foreground">
                      <FlaskConical className="mr-1 inline h-3.5 w-3.5 text-pink" />
                      {t.item_name}
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {num(t.yield_amount)} {t.yield_unit}
                    </td>
                    <td className="p-3 text-muted-foreground">{eur(t.production_cost)}</td>
                    <td className="p-3 font-medium text-pink">{eur(t.transfer_price)}</td>
                    <td className="p-3 text-xs text-muted-foreground">
                      {allocs.map((a) => {
                        const bar = companies.find((c) => c.id === a.to_company_id);
                        return (
                          <span key={a.id} className="mr-2 whitespace-nowrap">
                            {barShort(bar)}: {num(a.quantity)}
                          </span>
                        );
                      })}
                    </td>
                    <td className="p-3 text-muted-foreground">{t.delivery_date ?? "—"}</td>
                    <td className="p-3">
                      <Button size="sm" variant="outline" onClick={() => markDelivered(t)}>
                        <Truck className="mr-1 h-3.5 w-3.5" /> Mark Delivered
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {open && (
        <BatchTransferDialog
          lab={lab}
          bars={bars}
          preps={preps}
          onClose={() => setOpen(false)}
          onSaved={() => {
            setOpen(false);
            onChange();
          }}
        />
      )}
    </div>
  );
}

function BatchTransferDialog({
  lab,
  bars,
  preps,
  onClose,
  onSaved,
}: {
  lab?: Company;
  bars: Company[];
  preps: GroupPrep[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [prepId, setPrepId] = useState<string>("");
  const [yieldMl, setYieldMl] = useState<number>(2000);
  const [deliveryDate, setDeliveryDate] = useState<string>("");
  const [shares, setShares] = useState<Record<string, number>>(
    Object.fromEntries(bars.map((b) => [b.id, Math.round(100 / Math.max(1, bars.length))])),
  );
  const [saving, setSaving] = useState(false);

  const prep = preps.find((p) => p.id === prepId);
  const { cost, estimated } = prepProductionCost(prep, yieldMl);
  const price = transferPrice(cost, DEFAULT_MARKUP_PERCENT);
  const totalShare = Object.values(shares).reduce((s, v) => s + v, 0);

  async function save() {
    if (!prep) {
      toast.error("Select a prep recipe");
      return;
    }
    setSaving(true);
    const { data: inserted, error } = await db
      .from("inter_company_transfers")
      .insert({
        from_company_id: lab?.id ?? null,
        kind: "batch",
        prep_recipe_id: prep.id,
        item_name: prep.name,
        yield_amount: yieldMl,
        yield_unit: "ml",
        production_cost: Math.round(cost * 100) / 100,
        markup_percent: DEFAULT_MARKUP_PERCENT,
        transfer_price: price,
        delivery_date: deliveryDate || null,
        status: "active",
      })
      .select()
      .single();
    if (error || !inserted) {
      setSaving(false);
      toast.error("Could not create transfer");
      return;
    }
    const allocRows = bars
      .filter((b) => (shares[b.id] ?? 0) > 0)
      .map((b) => {
        const pct = (shares[b.id] ?? 0) / (totalShare || 1);
        return {
          transfer_id: inserted.id,
          to_company_id: b.id,
          quantity: Math.round(yieldMl * pct),
          amount: Math.round(price * pct * 100) / 100,
        };
      });
    if (allocRows.length) await db.from("transfer_allocations").insert(allocRows);
    await db.from("business_events").insert({
      company_id: lab?.id ?? null,
      event_type: "INTER_COMPANY_SALE",
      entity_type: "inter_company_transfer",
      entity_id: inserted.id,
      payload: { item: prep.name, yield: yieldMl, transfer_price: price },
    });
    setSaving(false);
    toast.success(`Batch transfer created — ${prep.name}`);
    onSaved();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Batch Transfer</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="text-xs">Prep recipe ({preps.length} available)</Label>
            <Select value={prepId} onValueChange={setPrepId}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select a prep…" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {preps.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Yield (ml)</Label>
              <Input
                type="number"
                min={0}
                value={yieldMl}
                onChange={(e) => setYieldMl(Number(e.target.value))}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Delivery date</Label>
              <Input
                type="date"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Card className="p-3">
              <p className="text-xs text-muted-foreground">Production cost {estimated && "(est.)"}</p>
              <p className="text-lg font-semibold text-foreground">{eur(cost)}</p>
            </Card>
            <Card className="p-3">
              <p className="text-xs text-muted-foreground">Transfer price (+{DEFAULT_MARKUP_PERCENT}%)</p>
              <p className="text-lg font-semibold text-pink">{eur(price)}</p>
            </Card>
          </div>

          <div className="space-y-3">
            <Label className="text-xs">Allocate to bars</Label>
            {bars.map((b) => (
              <div key={b.id}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="font-medium" style={{ color: b.brand_color }}>
                    {barShort(b)}
                  </span>
                  <span className="text-muted-foreground">
                    {shares[b.id] ?? 0}% · {num(Math.round((yieldMl * (shares[b.id] ?? 0)) / (totalShare || 1)))} ml
                  </span>
                </div>
                <Slider
                  value={[shares[b.id] ?? 0]}
                  onValueChange={([v]) => setShares((s) => ({ ...s, [b.id]: v }))}
                  min={0}
                  max={100}
                  step={5}
                />
              </div>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button className="bg-pink text-black hover:bg-pink/90" disabled={saving} onClick={save}>
            Create transfer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ============================ B) INGREDIENT RESALE ============================ */
function ResaleTab({
  lab,
  bars,
  products,
  transfers,
  companies,
  onChange,
}: {
  lab?: Company;
  bars: Company[];
  products: ReturnType<typeof useProducts>["data"] & object;
  transfers: Transfer[];
  companies: Company[];
  onChange: () => void;
}) {
  const [open, setOpen] = useState(false);
  const resale = transfers.filter((t) => t.kind === "resale");
  const prods = (products ?? []).filter((p: any) => p.default_cost > 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          The Lab resells bulk-bought ingredients to the bars at a small markup.
        </p>
        <Button size="sm" className="bg-pink text-black hover:bg-pink/90" onClick={() => setOpen(true)}>
          <Plus className="mr-1 h-4 w-4" /> Sell to Bar
        </Button>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="p-3 font-medium">Ingredient</th>
                <th className="p-3 font-medium">Qty</th>
                <th className="p-3 font-medium">Cost</th>
                <th className="p-3 font-medium">Resale price</th>
                <th className="p-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {resale.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-muted-foreground">
                    No resale items yet.
                  </td>
                </tr>
              )}
              {resale.map((t) => (
                <tr key={t.id} className="border-b border-border/60">
                  <td className="p-3 font-medium text-foreground">{t.item_name}</td>
                  <td className="p-3 text-muted-foreground">{num(t.yield_amount)}</td>
                  <td className="p-3 text-muted-foreground">{eur(t.production_cost)}</td>
                  <td className="p-3 font-medium text-pink">{eur(t.transfer_price)}</td>
                  <td className="p-3">
                    <Badge variant="outline" className={t.status === "delivered" ? "text-green" : "text-orange"}>
                      {t.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {open && (
        <SellDialog
          lab={lab}
          bars={bars}
          products={prods}
          onClose={() => setOpen(false)}
          onSaved={() => {
            setOpen(false);
            onChange();
          }}
        />
      )}
    </div>
  );
}

function SellDialog({
  lab,
  bars,
  products,
  onClose,
  onSaved,
}: {
  lab?: Company;
  bars: Company[];
  products: any[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [productId, setProductId] = useState("");
  const [qty, setQty] = useState(1);
  const [barId, setBarId] = useState(bars[0]?.id ?? "");
  const [saving, setSaving] = useState(false);
  const MARKUP = 15;

  const product = products.find((p) => p.id === productId);
  const cost = product ? product.default_cost * qty : 0;
  const price = transferPrice(cost, MARKUP);

  async function save() {
    if (!product || !barId) {
      toast.error("Select a product and a bar");
      return;
    }
    setSaving(true);
    const { data: inserted, error } = await db
      .from("inter_company_transfers")
      .insert({
        from_company_id: lab?.id ?? null,
        kind: "resale",
        product_id: product.id,
        item_name: product.name,
        yield_amount: qty,
        yield_unit: "unit",
        production_cost: Math.round(cost * 100) / 100,
        markup_percent: MARKUP,
        transfer_price: price,
        status: "active",
      })
      .select()
      .single();
    if (error || !inserted) {
      setSaving(false);
      toast.error("Could not create resale");
      return;
    }
    await db.from("transfer_allocations").insert({
      transfer_id: inserted.id,
      to_company_id: barId,
      quantity: qty,
      amount: price,
    });
    await db.from("business_events").insert({
      company_id: lab?.id ?? null,
      event_type: "INTER_COMPANY_SALE",
      entity_type: "inter_company_transfer",
      entity_id: inserted.id,
      payload: { item: product.name, qty, resale_price: price },
    });
    setSaving(false);
    toast.success(`${product.name} sold to bar`);
    onSaved();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Sell Ingredient to Bar</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="text-xs">Product</Label>
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select a product…" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {products.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} — {eur(p.default_cost)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Quantity</Label>
              <Input type="number" min={1} value={qty} onChange={(e) => setQty(Number(e.target.value))} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">To bar</Label>
              <Select value={barId} onValueChange={setBarId}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {bars.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {barShort(b)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Card className="p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Cost</span>
              <span>{eur(cost)}</span>
            </div>
            <div className="flex justify-between font-medium text-pink">
              <span>Resale price (+{MARKUP}%)</span>
              <span>{eur(price)}</span>
            </div>
          </Card>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button className="bg-pink text-black hover:bg-pink/90" disabled={saving} onClick={save}>
            Sell
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ============================ C) COST ALLOCATION ============================ */
function AllocationTab({
  holding,
  bars,
  serviceCosts,
  costAllocs,
  companies,
  onChange,
}: {
  holding?: Company;
  bars: Company[];
  serviceCosts: ReturnType<typeof useServiceCosts>["data"] & object;
  costAllocs: ReturnType<typeof useCostAllocations>["data"] & object;
  companies: Company[];
  onChange: () => void;
}) {
  const holdingCosts = (serviceCosts ?? []).filter((c: any) => c.company_id === holding?.id);
  const [saving, setSaving] = useState(false);
  const allocList = costAllocs ?? [];

  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const total = holdingCosts.reduce((s: number, c: any) => s + Number(c.amount), 0);
  const perBar = bars.length ? total / bars.length : 0;
  const pct = bars.length ? Math.round(100 / bars.length) : 0;

  async function apply() {
    if (!holdingCosts.length) {
      toast.error("No holding costs to allocate");
      return;
    }
    setSaving(true);
    const splits = bars.map((b) => ({ company_id: b.id, percent: pct, amount: Math.round(perBar * 100) / 100 }));
    const { data: inserted } = await db
      .from("cost_allocations")
      .insert({
        from_company_id: holding?.id ?? null,
        label: `Holding shared costs — ${month}/${year}`,
        total_amount: Math.round(total * 100) / 100,
        period_month: month,
        period_year: year,
        splits,
        applied: true,
      })
      .select()
      .single();
    await db.from("business_events").insert({
      company_id: holding?.id ?? null,
      event_type: "COST_ALLOCATED",
      entity_type: "cost_allocation",
      entity_id: inserted?.id ?? null,
      payload: { total, split: `${pct}/${pct}`, month, year },
    });
    for (const b of bars) {
      await db.from("notifications").insert({
        company_id: b.id,
        title: "Shared costs allocated",
        body: `${eur(perBar)} of holding costs allocated for ${month}/${year} (${pct}% split).`,
        severity: "info",
        link: "/inter-company",
      });
    }
    setSaving(false);
    toast.success("Holding costs allocated to bars");
    onChange();
  }

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <h3 className="mb-3 text-sm font-semibold text-foreground">
          <Wallet className="mr-1 inline h-4 w-4 text-purple" /> Holding Costs
        </h3>
        <div className="space-y-2 text-sm">
          {holdingCosts.length === 0 && (
            <p className="text-muted-foreground">No holding-level costs recorded.</p>
          )}
          {holdingCosts.map((c: any) => (
            <div key={c.id} className="flex items-center justify-between border-b border-border/50 pb-2">
              <span className="text-foreground">{c.name}</span>
              <span className="text-muted-foreground">
                {eur(Number(c.amount))} <span className="text-xs">/ {c.frequency}</span>
              </span>
            </div>
          ))}
          <div className="flex items-center justify-between pt-2 font-semibold">
            <span>Total</span>
            <span>{eur(total)}</span>
          </div>
        </div>
      </Card>

      <Card className="p-4">
        <h3 className="mb-3 text-sm font-semibold text-foreground">
          <Split className="mr-1 inline h-4 w-4 text-teal" /> Allocation preview — {pct}/{pct} split
        </h3>
        <div className="grid grid-cols-2 gap-3">
          {bars.map((b) => (
            <div key={b.id} className="rounded-lg border border-border p-3">
              <p className="text-xs font-medium" style={{ color: b.brand_color }}>
                {barShort(b)}
              </p>
              <p className="text-lg font-semibold text-foreground">{eur(perBar)}</p>
              <p className="text-xs text-muted-foreground">{pct}% of shared costs</p>
            </div>
          ))}
        </div>
        <Button
          className="mt-4 w-full bg-teal text-black hover:bg-teal/90"
          disabled={saving}
          onClick={apply}
        >
          Apply allocation for {month}/{year}
        </Button>
      </Card>

      {allocList.length > 0 && (
        <Card className="p-4">
          <h3 className="mb-3 text-sm font-semibold text-foreground">Allocation history</h3>
          <div className="space-y-2 text-sm">
            {allocList.map((a) => (
              <div key={a.id} className="flex items-center justify-between border-b border-border/50 pb-2">
                <span className="text-foreground">{a.label}</span>
                <span className="text-muted-foreground">{eur(a.total_amount)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

/* ============================ D) BALANCES ============================ */
function BalancesTab({
  lab,
  companies,
  transfers,
  allocations,
  payments,
  onChange,
}: {
  lab?: Company;
  companies: Company[];
  transfers: Transfer[];
  allocations: ReturnType<typeof useTransferAllocations>["data"] & object;
  payments: ReturnType<typeof useInterCompanyPayments>["data"] & object;
  onChange: () => void;
}) {
  const balances = useMemo(
    () => computeBalances(companies, transfers, allocations ?? [], payments ?? []),
    [companies, transfers, allocations, payments],
  );
  const [payFor, setPayFor] = useState<Company | null>(null);

  async function sendReminder(bar: Company, amount: number) {
    await db.from("notifications").insert({
      company_id: bar.id,
      title: "Payment reminder — Cocktail Lab",
      body: `${barShort(bar)} owes the Lab ${eur(amount)}. Please settle the outstanding balance.`,
      severity: "warning",
      link: "/inter-company",
    });
    toast.success(`Reminder sent to ${barShort(bar)}`);
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {balances.map((b) => {
          const overdue = b.overdueDays > 0;
          return (
            <Card key={b.company.id} className={`p-4 ${overdue ? "border-red/50" : ""}`}>
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium" style={{ color: b.company.brand_color }}>
                  {barShort(b.company)} owes Lab
                </p>
                {overdue && (
                  <Badge className="bg-red/15 text-red">
                    <AlertTriangle className="mr-1 h-3 w-3" /> Overdue {b.overdueDays}d
                  </Badge>
                )}
              </div>
              <p className={`mt-1 text-2xl font-bold ${overdue ? "text-red" : "text-foreground"}`}>
                {eur(b.balance)}
              </p>
              <p className="text-xs text-muted-foreground">
                Billed {eur(b.owedGross)} · Paid {eur(b.paid)}
                {b.lastPayment && ` · last ${b.lastPayment}`}
              </p>
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="outline" onClick={() => sendReminder(b.company, b.balance)}>
                  <Bell className="mr-1 h-3.5 w-3.5" /> Send Reminder
                </Button>
                <Button
                  size="sm"
                  className="bg-green text-black hover:bg-green/90"
                  onClick={() => setPayFor(b.company)}
                >
                  <Wallet className="mr-1 h-3.5 w-3.5" /> Record Payment
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      <Card className="p-4">
        <h3 className="mb-3 text-sm font-semibold text-foreground">Payment history</h3>
        <div className="space-y-2 text-sm">
          {(payments ?? []).length === 0 && (
            <p className="text-muted-foreground">No payments recorded yet.</p>
          )}
          {(payments ?? []).map((p) => {
            const from = companies.find((c) => c.id === p.from_company_id);
            return (
              <div key={p.id} className="flex items-center justify-between border-b border-border/50 pb-2">
                <div>
                  <span className="font-medium text-foreground">{barShort(from)}</span>
                  <span className="text-muted-foreground"> · {p.note ?? "Payment"}</span>
                </div>
                <div className="text-right">
                  <span className="font-medium text-green">{eur(p.amount)}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{p.payment_date}</span>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {payFor && (
        <RecordPaymentDialog
          bar={payFor}
          lab={lab}
          onClose={() => setPayFor(null)}
          onSaved={() => {
            setPayFor(null);
            onChange();
          }}
        />
      )}
    </div>
  );
}

function RecordPaymentDialog({
  bar,
  lab,
  onClose,
  onSaved,
}: {
  bar: Company;
  lab?: Company;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [amount, setAmount] = useState(0);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  async function save() {
    if (amount <= 0) {
      toast.error("Enter a payment amount");
      return;
    }
    setSaving(true);
    await db.from("inter_company_payments").insert({
      from_company_id: bar.id,
      to_company_id: lab?.id ?? null,
      amount,
      payment_date: date,
      note: "Payment recorded",
    });
    await db.from("business_events").insert({
      company_id: bar.id,
      event_type: "PAYMENT_RECORDED",
      entity_type: "inter_company_payment",
      entity_id: null,
      payload: { amount, to: "Cocktail Lab" },
    });
    setSaving(false);
    toast.success(`Payment of ${eur(amount)} recorded`);
    onSaved();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record Payment — {barShort(bar)}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="text-xs">Amount (€)</Label>
            <Input type="number" min={0} value={amount} onChange={(e) => setAmount(Number(e.target.value))} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button className="bg-green text-black hover:bg-green/90" disabled={saving} onClick={save}>
            Record
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ============================ E) TRANSFER PRICES ============================ */
function PricesTab({
  relationships,
  transfers,
  companies,
  onChange,
}: {
  relationships: ReturnType<typeof useCompanyRelationships>["data"] & object;
  transfers: Transfer[];
  companies: Company[];
  onChange: () => void;
}) {
  const rels = relationships ?? [];
  const currentMarkup = rels.length ? rels[0].markup_percent : DEFAULT_MARKUP_PERCENT;
  const recommended = 38;
  const [saving, setSaving] = useState(false);

  // Margin trend per batch type
  const byType = useMemo(() => {
    const map = new Map<string, { count: number; cost: number; price: number }>();
    for (const t of transfers.filter((x) => x.kind === "batch")) {
      const cur = map.get(t.item_name) ?? { count: 0, cost: 0, price: 0 };
      cur.count += 1;
      cur.cost += Number(t.production_cost);
      cur.price += Number(t.transfer_price);
      map.set(t.item_name, cur);
    }
    return Array.from(map.entries()).map(([name, v]) => ({
      name,
      count: v.count,
      margin: v.price > 0 ? ((v.price - v.cost) / v.price) * 100 : 0,
    }));
  }, [transfers]);

  async function applyRecommended() {
    setSaving(true);
    for (const r of rels) {
      await db.from("company_relationships").update({ markup_percent: recommended }).eq("id", r.id);
    }
    setSaving(true);
    await db.from("business_events").insert({
      company_id: companies.find((c) => c.type === "lab")?.id ?? null,
      event_type: "PRICE_CHANGE",
      entity_type: "company_relationship",
      entity_id: null,
      payload: { from: currentMarkup, to: recommended },
    });
    setSaving(false);
    toast.success(`Transfer markup updated to ${recommended}%`);
    onChange();
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Current markup</p>
          <p className="text-3xl font-bold text-pink">{currentMarkup}%</p>
          <p className="text-xs text-muted-foreground">Applied to all Lab → bar transfers</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Market rate</p>
          <p className="text-3xl font-bold text-foreground">35–40%</p>
          <p className="text-xs text-muted-foreground">Industry inter-company benchmark</p>
        </Card>
      </div>

      {currentMarkup < recommended && (
        <Card className="border-orange/40 bg-orange/5 p-4">
          <div className="flex items-start gap-3">
            <TrendingUp className="mt-0.5 h-5 w-5 shrink-0 text-orange" />
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">
                Market rate: 35–40%. Recommend increase to {recommended}%?
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                The current {currentMarkup}% markup sits below market. Raising to {recommended}% keeps
                the Lab profitable without pushing bar cost of goods above target.
              </p>
              <Button
                size="sm"
                className="mt-3 bg-orange text-black hover:bg-orange/90"
                disabled={saving}
                onClick={applyRecommended}
              >
                Increase markup to {recommended}%
              </Button>
            </div>
          </div>
        </Card>
      )}

      <Card className="p-4">
        <h3 className="mb-3 text-sm font-semibold text-foreground">Margin trend per batch type</h3>
        <div className="space-y-2 text-sm">
          {byType.length === 0 && <p className="text-muted-foreground">No batch transfers yet.</p>}
          {byType.map((b) => (
            <div key={b.name} className="flex items-center justify-between border-b border-border/50 pb-2">
              <div>
                <span className="font-medium text-foreground">{b.name}</span>
                <span className="ml-2 text-xs text-muted-foreground">{b.count}x</span>
              </div>
              <span className="font-medium" style={{ color: b.margin >= 23 ? "var(--green)" : "var(--orange)" }}>
                {num(b.margin)}% margin
              </span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
