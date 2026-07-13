import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { db } from "@/lib/db";
import { scanReceipt } from "@/lib/receipt.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { eur } from "@/lib/format";
import {
  useCompanies,
  useInvoices,
  useInvoiceAllocations,
  useBusinessEvents,
  routeInvoice,
  companyById,
  barShort,
  UPLOAD_STAGES,
  type Company,
  type Invoice,
  type UploadStage,
} from "@/lib/group";
import { toast } from "sonner";
import {
  Upload,
  Sparkles,
  History,
  GitBranch,
  Activity,
  ImageUp,
  Camera,
  Loader2,
  CheckCircle2,
  MapPin,
  ArrowLeftRight,
  Split,
  AlertTriangle,
  Check,
  Building2,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/invoices")({
  head: () => ({
    meta: [
      { title: "Invoices — Imprensa Group Command Center" },
      {
        name: "description",
        content:
          "AI-routed multi-company invoices for the Plataforma Boémia group: smart routing, split allocations, price alerts and event log.",
      },
    ],
  }),
  component: InvoicesPage,
});

const TABS = [
  { key: "upload", label: "Upload", icon: Upload },
  { key: "review", label: "AI Review", icon: Sparkles },
  { key: "history", label: "History", icon: History },
  { key: "pending", label: "Pending Routing", icon: GitBranch },
  { key: "events", label: "Event Log", icon: Activity },
] as const;
type TabKey = (typeof TABS)[number]["key"];

function toDataUrl(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

interface Draft {
  vendor: string;
  date: string;
  total: number;
  items: { product: string; qty: number; unit_price: number; total: number }[];
  deliveryAddress: string;
  routedCompanyId?: string;
  confidence: number;
  reason: string;
  split: boolean;
}

function InvoicesPage() {
  const [tab, setTab] = useState<TabKey>("upload");
  const qc = useQueryClient();
  const { data: companies = [] } = useCompanies();
  const { data: invoices = [] } = useInvoices();
  const { data: allocations = [] } = useInvoiceAllocations();
  const { data: events = [] } = useBusinessEvents();

  // Queue of AI-extracted drafts awaiting review. Supports batch uploads —
  // the user reviews/confirms them one at a time; single upload = queue of 1.
  const [queue, setQueue] = useState<Draft[]>([]);
  const draft = queue[0] ?? null;

  const bars = companies.filter((c) => c.type === "bar" || c.type === "lab");
  const pendingCount = invoices.filter(
    (i) => i.status === "pending_routing" || i.routing_confidence < 70,
  ).length;

  const refetch = () =>
    qc.invalidateQueries({ queryKey: ["invoices_group"] }).then(() => {
      qc.invalidateQueries({ queryKey: ["invoice_allocations_group"] });
      qc.invalidateQueries({ queryKey: ["business_events_group"] });
    });

  return (
    <div className="mx-auto w-full max-w-5xl px-3 pb-24 pt-4 md:px-6">
      <header className="mb-4">
        <h1 className="text-xl font-semibold text-foreground md:text-2xl">Invoices</h1>
        <p className="text-sm text-muted-foreground">
          AI-routed across the group — every invoice is assigned to a company.
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
              {t.key === "pending" && pendingCount > 0 && (
                <span className="ml-1 rounded-full bg-orange/20 px-1.5 text-[10px] text-orange">
                  {pendingCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {tab === "upload" && (
        <UploadTab
          companies={companies}
          bars={bars}
          onBatch={(drafts) => {
            if (drafts.length === 0) return;
            setQueue(drafts);
            setTab("review");
          }}
        />
      )}
      {tab === "review" && (
        <ReviewTab
          key={`${queue.length}-${draft?.vendor ?? "none"}`}
          companies={companies}
          bars={bars}
          draft={draft}
          queueTotal={queue.length}
          onDone={async () => {
            const remaining = queue.slice(1);
            setQueue(remaining);
            await refetch();
            if (remaining.length === 0) setTab("history");
          }}
          onSkip={() => {
            const remaining = queue.slice(1);
            setQueue(remaining);
            if (remaining.length === 0) setTab("upload");
          }}
          onGoUpload={() => {
            setQueue([]);
            setTab("upload");
          }}
        />
      )}
      {tab === "history" && (
        <HistoryTab companies={companies} invoices={invoices} allocations={allocations} />
      )}
      {tab === "pending" && (
        <PendingTab companies={companies} bars={bars} invoices={invoices} onChange={refetch} />
      )}
      {tab === "events" && <EventsTab companies={companies} events={events} />}
    </div>
  );
}

function Dot({ color }: { color: string }) {
  return <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: color }} />;
}

function CompanyBadge({ company }: { company?: Company }) {
  if (!company)
    return (
      <Badge variant="outline" className="gap-1 text-[10px] text-orange">
        Unrouted
      </Badge>
    );
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium"
      style={{ background: `${company.brand_color}22`, color: company.brand_color }}
    >
      <Dot color={company.brand_color} />
      {barShort(company)}
    </span>
  );
}

/* ---------- A) Upload ---------- */
function UploadTab({
  companies,
  bars,
  onBatch,
}: {
  companies: Company[];
  bars: Company[];
  onBatch: (drafts: Draft[]) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);
  const scan = useServerFn(scanReceipt);
  const [stage, setStage] = useState<UploadStage | null>(null);
  const [batch, setBatch] = useState<{ done: number; total: number } | null>(null);
  const [preselect, setPreselect] = useState<string>("auto");
  const [split, setSplit] = useState(false);
  const [dragging, setDragging] = useState(false);

  // Scan a single file into a Draft (no UI staging). Throws on failure.
  async function scanOne(file: File): Promise<Draft> {
    const dataUrl = await toDataUrl(file);
    const parsed = await scan({
      data: { fileDataUrl: dataUrl, mimeType: file.type, filename: file.name },
    });
    const addr = "";
    const route = routeInvoice(companies, {
      deliveryAddress: addr,
      vendor: parsed.vendor,
      total: parsed.grand_total,
      date: parsed.date ? new Date(parsed.date) : new Date(),
    });
    const forced = preselect !== "auto" ? preselect : route.company?.id;
    return {
      vendor: parsed.vendor,
      date: parsed.date,
      total: parsed.grand_total,
      items: parsed.items.map((i) => ({
        product: i.product,
        qty: i.qty,
        unit_price: i.unit_price,
        total: i.total,
      })),
      deliveryAddress: addr,
      routedCompanyId: forced,
      confidence: preselect !== "auto" ? 100 : route.confidence,
      reason:
        preselect !== "auto" ? "Manually pre-selected on upload" : route.reason,
      split,
    };
  }

  // Multiple files: scan sequentially with a batch progress counter so the
  // AI gateway isn't hammered, then hand the whole queue to review.
  async function handleFiles(fileList: File[]) {
    const files = fileList.slice(0, 25);
    if (files.length === 1) {
      await handleFile(files[0]);
      return;
    }
    setBatch({ done: 0, total: files.length });
    const drafts: Draft[] = [];
    let failed = 0;
    for (let i = 0; i < files.length; i++) {
      try {
        drafts.push(await scanOne(files[i]));
      } catch (e) {
        console.error(e);
        failed++;
      }
      setBatch({ done: i + 1, total: files.length });
    }
    setBatch(null);
    if (drafts.length === 0) {
      toast.error("Couldn't read any of those files. Try clearer photos or PDFs.");
      return;
    }
    if (failed > 0) {
      toast.warning(`${drafts.length} scanned · ${failed} skipped (unreadable)`);
    } else {
      toast.success(`${drafts.length} invoices scanned — review each below`);
    }
    onBatch(drafts);
  }

  async function handleFile(file: File) {
    try {
      setStage("Uploading");
      setStage("Extracting");
      const draft = await scanOne(file);
      setStage("Routing");
      setStage("Matching");
      await new Promise((r) => setTimeout(r, 300));
      setStage("Analyzing");
      await new Promise((r) => setTimeout(r, 300));
      setStage("Complete");
      onBatch([draft]);
    } catch (e) {
      console.error(e);
      toast.error("Could not read that file. Try a clearer photo or PDF.");
      setStage(null);
    }
  }

  return (
    <div className="space-y-4">
      <input
        ref={fileRef}
        type="file"
        accept="image/*,application/pdf"
        multiple
        hidden
        onChange={(e) => {
          const files = e.target.files;
          if (files && files.length) handleFiles(Array.from(files));
          e.target.value = "";
        }}
      />
      <input
        ref={camRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
      />

      <Card className="p-4">
        <div className="mb-3 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">
              Company (optional override)
            </label>
            <Select value={preselect} onValueChange={setPreselect}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto-route with AI</SelectItem>
                {bars.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {barShort(b)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
              <Checkbox checked={split} onCheckedChange={(v) => setSplit(!!v)} />
              Split invoice across bars (shared cost)
            </label>
          </div>
        </div>

        {batch ? (
          <BatchProgress done={batch.done} total={batch.total} />
        ) : stage ? (
          <UploadProgress stage={stage} />
        ) : (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const fs = e.dataTransfer.files;
              if (fs && fs.length) handleFiles(Array.from(fs));
            }}
            className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
              dragging ? "border-teal bg-teal/5" : "border-border"
            }`}
          >
            <ImageUp className="mb-2 h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-foreground">Drop invoice photos or PDFs</p>
            <p className="mb-4 text-xs text-muted-foreground">
              Select up to 25 at once — vendor, date &amp; prices are always
              AI-extracted, never typed.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
                <ImageUp className="mr-1 h-4 w-4" /> Gallery / Files
              </Button>
              <Button size="sm" variant="outline" onClick={() => camRef.current?.click()}>
                <Camera className="mr-1 h-4 w-4" /> Camera
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

function BatchProgress({ done, total }: { done: number; total: number }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div className="space-y-3 py-6 text-center">
      <Loader2 className="mx-auto h-8 w-8 animate-spin text-teal" />
      <p className="text-sm font-medium text-foreground">
        Scanning invoice {Math.min(done + 1, total)} of {total}…
      </p>
      <p className="text-xs text-muted-foreground">
        {done} of {total} extracted · AI reading vendor, date &amp; prices
      </p>
      <div className="mx-auto h-2 w-full max-w-xs overflow-hidden rounded-full bg-border">
        <div
          className="h-full rounded-full bg-teal transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function UploadProgress({ stage }: { stage: UploadStage }) {
  const idx = UPLOAD_STAGES.indexOf(stage);
  return (
    <div className="space-y-2 py-4">
      {UPLOAD_STAGES.map((s, i) => {
        const done = i < idx || stage === "Complete";
        const active = i === idx && stage !== "Complete";
        return (
          <div key={s} className="flex items-center gap-3 text-sm">
            {done ? (
              <CheckCircle2 className="h-4 w-4 text-green" />
            ) : active ? (
              <Loader2 className="h-4 w-4 animate-spin text-teal" />
            ) : (
              <span className="h-4 w-4 rounded-full border border-border" />
            )}
            <span className={done ? "text-green" : active ? "text-foreground" : "text-muted-foreground"}>
              {s}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ---------- B) AI Review ---------- */
function ReviewTab({
  companies,
  bars,
  draft,
  onDone,
  onGoUpload,
}: {
  companies: Company[];
  bars: Company[];
  draft: Draft | null;
  onDone: () => void;
  onGoUpload: () => void;
}) {
  const [routedId, setRoutedId] = useState<string | undefined>(draft?.routedCompanyId);
  const [splitMode, setSplitMode] = useState(draft?.split ?? false);
  const [prPct, setPrPct] = useState(50);
  const [saving, setSaving] = useState(false);

  const barPair = bars.filter((b) => b.type === "bar");
  const pr = barPair[0];
  const baixa = barPair[1];

  if (!draft) {
    return (
      <Card className="p-6 text-center">
        <p className="text-sm text-muted-foreground">No invoice in review.</p>
        <Button className="mt-3" size="sm" onClick={onGoUpload}>
          Upload an invoice
        </Button>
      </Card>
    );
  }

  const routed = companyById(companies, routedId);
  const conf = routedId === draft.routedCompanyId ? draft.confidence : 100;

  async function save() {
    if (!draft) return;
    setSaving(true);
    try {
      const status = splitMode || routedId ? "confirmed" : "pending_routing";
      const { data: inv, error } = await db
        .from("invoices")
        .insert({
          company_id: splitMode ? null : routedId ?? null,
          vendor: draft.vendor || "Unknown vendor",
          supplier: draft.vendor || null,
          invoice_date: draft.date || null,
          total: draft.total,
          delivery_address: draft.deliveryAddress || null,
          items: draft.items,
          status,
          routing_confidence: splitMode ? 100 : conf,
          routing_reason: splitMode ? "Split across bars (shared cost)" : draft.reason,
          is_split: splitMode,
          is_inter_company: (draft.vendor || "").toLowerCase().includes("lab"),
        })
        .select()
        .single();
      if (error) throw error;

      if (splitMode && pr && baixa) {
        const prAmt = +(draft.total * (prPct / 100)).toFixed(2);
        await db.from("invoice_allocations").insert([
          { invoice_id: inv.id, company_id: pr.id, percentage: prPct, amount: prAmt },
          {
            invoice_id: inv.id,
            company_id: baixa.id,
            percentage: 100 - prPct,
            amount: +(draft.total - prAmt).toFixed(2),
          },
        ]);
        await db.from("business_events").insert({
          company_id: pr.id,
          event_type: "COST_ALLOCATED",
          entity_type: "invoice",
          entity_id: inv.id,
          payload: { split: `${prPct}/${100 - prPct}`, amount: draft.total },
        });
      } else if (routedId) {
        await db.from("business_events").insert({
          company_id: routedId,
          event_type: "INVOICE_UPLOADED",
          entity_type: "invoice",
          entity_id: inv.id,
          payload: { vendor: draft.vendor },
        });
      }
      toast.success(
        splitMode
          ? "Split invoice saved with allocations"
          : routed
            ? `Routed to ${barShort(routed)}`
            : "Saved to Pending Routing",
      );
      onDone();
    } catch (e) {
      console.error(e);
      toast.error("Could not save invoice.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-foreground">{draft.vendor || "Unknown vendor"}</p>
            <p className="text-xs text-muted-foreground">{draft.date || "No date"} · {eur(draft.total)}</p>
          </div>
          <Badge variant="outline" className="text-[10px]">
            AI-extracted
          </Badge>
        </div>
        <div className="space-y-1 rounded-lg bg-background/50 p-2">
          {draft.items.map((it, i) => (
            <div key={i} className="flex justify-between text-xs">
              <span className="text-muted-foreground">
                {it.qty}× {it.product}
              </span>
              <span className="text-foreground">{eur(it.total)}</span>
            </div>
          ))}
        </div>
      </Card>

      {!splitMode && (
        <Card className={`p-4 ${routed ? "border-teal/30 bg-teal/5" : "border-orange/30 bg-orange/5"}`}>
          <div className="mb-2 flex items-center gap-2">
            <MapPin className={`h-4 w-4 ${routed ? "text-teal" : "text-orange"}`} />
            <h2 className="text-sm font-semibold text-foreground">AI routing</h2>
          </div>
          <p className="text-sm text-foreground">
            Routed to: <b>{routed ? barShort(routed) : "Manual routing needed"}</b>{" "}
            <span className={conf >= 85 ? "text-green" : conf >= 70 ? "text-orange" : "text-red"}>
              ({conf}% confidence)
            </span>
          </p>
          <p className="mb-3 text-xs text-muted-foreground">Reason: {draft.reason}</p>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">Reassign:</span>
            <Select value={routedId ?? ""} onValueChange={(v) => setRoutedId(v)}>
              <SelectTrigger className="h-8 w-44 text-xs">
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
          </div>
        </Card>
      )}

      <Card className="p-4">
        <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-foreground">
          <Split className="h-4 w-4 text-pink" />
          <Checkbox checked={splitMode} onCheckedChange={(v) => setSplitMode(!!v)} />
          Split across bars
        </label>
        {splitMode && pr && baixa && (
          <div className="mt-4 space-y-3">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>
                {barShort(pr)}: {prPct}% · {eur(draft.total * (prPct / 100))}
              </span>
              <span>
                {barShort(baixa)}: {100 - prPct}% · {eur(draft.total * ((100 - prPct) / 100))}
              </span>
            </div>
            <Slider value={[prPct]} onValueChange={([v]) => setPrPct(v)} min={0} max={100} step={5} />
          </div>
        )}
      </Card>

      <div className="flex gap-2">
        <Button className="flex-1" onClick={save} disabled={saving || (!splitMode && !routedId)}>
          {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Check className="mr-1 h-4 w-4" />}
          {splitMode ? "Save split invoice" : "Confirm & route"}
        </Button>
        <Button variant="outline" onClick={onGoUpload}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

/* ---------- C) History ---------- */
function HistoryTab({
  companies,
  invoices,
  allocations,
}: {
  companies: Company[];
  invoices: Invoice[];
  allocations: ReturnType<typeof useInvoiceAllocations>["data"];
}) {
  const [filter, setFilter] = useState<string>("all");
  const filtered = invoices.filter((inv) => {
    if (inv.status === "pending_routing") return false;
    if (filter === "all") return true;
    if (inv.is_split) return (allocations ?? []).some((a) => a.invoice_id === inv.id && a.company_id === filter);
    return inv.company_id === filter;
  });

  return (
    <div className="space-y-3">
      <div className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1">
        <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>
          All
        </FilterChip>
        {companies.map((c) => (
          <FilterChip key={c.id} active={filter === c.id} onClick={() => setFilter(c.id)} color={c.brand_color}>
            {barShort(c)}
          </FilterChip>
        ))}
      </div>

      {filtered.map((inv) => {
        const company = companyById(companies, inv.company_id);
        const allocs = (allocations ?? []).filter((a) => a.invoice_id === inv.id);
        return (
          <Card key={inv.id} className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">{inv.vendor}</span>
                  {inv.is_inter_company && (
                    <Badge className="gap-1 bg-pink/15 text-pink" variant="outline">
                      <ArrowLeftRight className="h-3 w-3" /> Inter-company
                    </Badge>
                  )}
                  {inv.is_split && (
                    <Badge className="gap-1 bg-purple/15 text-purple" variant="outline">
                      <Split className="h-3 w-3" /> Split
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {inv.invoice_date} · {inv.delivery_address || "no address"}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-foreground">{eur(inv.total)}</p>
                {inv.is_split ? (
                  <div className="mt-1 flex flex-wrap justify-end gap-1">
                    {allocs.map((a) => (
                      <CompanyBadge key={a.id} company={companyById(companies, a.company_id)} />
                    ))}
                  </div>
                ) : (
                  <div className="mt-1">
                    <CompanyBadge company={company} />
                  </div>
                )}
              </div>
            </div>
          </Card>
        );
      })}
      {filtered.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">No invoices for this filter.</p>
      )}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
  color,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  color?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
        active ? "bg-foreground/10 text-foreground" : "text-muted-foreground hover:bg-card"
      }`}
    >
      {color && <Dot color={color} />}
      {children}
    </button>
  );
}

/* ---------- D) Pending Routing ---------- */
function PendingTab({
  companies,
  bars,
  invoices,
  onChange,
}: {
  companies: Company[];
  bars: Company[];
  invoices: Invoice[];
  onChange: () => Promise<unknown>;
}) {
  const pending = invoices.filter(
    (i) => i.status === "pending_routing" || i.routing_confidence < 70,
  );
  const [picks, setPicks] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function assign(inv: Invoice, companyId: string) {
    setBusy(true);
    try {
      const co = companyById(companies, companyId);
      await db
        .from("invoices")
        .update({
          company_id: companyId,
          status: "confirmed",
          routing_confidence: 100,
          routing_reason: "Manually routed (AI learned from correction)",
        })
        .eq("id", inv.id);
      await db.from("business_events").insert({
        company_id: companyId,
        event_type: "INVOICE_UPLOADED",
        entity_type: "invoice",
        entity_id: inv.id,
        payload: { vendor: inv.vendor, corrected: true },
      });
      toast.success(`${inv.vendor} → ${barShort(co)} · AI will remember this`);
      await onChange();
    } finally {
      setBusy(false);
    }
  }

  async function bulkAssign() {
    const entries = Object.entries(picks).filter(([, v]) => v);
    if (entries.length === 0) return;
    setBusy(true);
    try {
      for (const [id, companyId] of entries) {
        await db
          .from("invoices")
          .update({
            company_id: companyId,
            status: "confirmed",
            routing_confidence: 100,
            routing_reason: "Bulk manual routing",
          })
          .eq("id", id);
      }
      toast.success(`Assigned ${entries.length} invoice(s)`);
      setPicks({});
      await onChange();
    } finally {
      setBusy(false);
    }
  }

  if (pending.length === 0)
    return (
      <Card className="p-8 text-center">
        <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-green" />
        <p className="text-sm text-foreground">Nothing pending — all invoices routed.</p>
      </Card>
    );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {pending.length} invoice(s) below 70% confidence
        </p>
        <Button size="sm" variant="outline" disabled={busy || Object.keys(picks).length === 0} onClick={bulkAssign}>
          Bulk assign
        </Button>
      </div>
      {pending.map((inv) => (
        <Card key={inv.id} className="p-4">
          <div className="mb-2 flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">{inv.vendor}</p>
              <p className="text-xs text-muted-foreground">
                {inv.invoice_date} · {eur(inv.total)}
              </p>
            </div>
            <Badge variant="outline" className="text-[10px] text-orange">
              {inv.routing_confidence}% guess
            </Badge>
          </div>
          <div className="mb-2 space-y-0.5 rounded-lg bg-background/50 p-2">
            {inv.items.slice(0, 3).map((it, i) => (
              <div key={i} className="flex justify-between text-xs text-muted-foreground">
                <span>{it.qty}× {it.product}</span>
                <span>{eur(it.total)}</span>
              </div>
            ))}
          </div>
          <div className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
            <AlertTriangle className="h-3.5 w-3.5 text-orange" />
            AI guess: {inv.routing_reason}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={picks[inv.id] ?? ""}
              onValueChange={(v) => setPicks((p) => ({ ...p, [inv.id]: v }))}
            >
              <SelectTrigger className="h-8 w-44 text-xs">
                <SelectValue placeholder="Assign company" />
              </SelectTrigger>
              <SelectContent>
                {bars.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {barShort(b)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              disabled={busy || !picks[inv.id]}
              onClick={() => picks[inv.id] && assign(inv, picks[inv.id])}
            >
              Route
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}

/* ---------- E) Event Log ---------- */
function EventsTab({
  companies,
  events,
}: {
  companies: Company[];
  events: ReturnType<typeof useBusinessEvents>["data"];
}) {
  const [filter, setFilter] = useState<string>("all");
  const list = (events ?? []).filter(
    (e) => filter === "all" || e.company_id === filter,
  );
  const isInter = (t: string) => t.startsWith("INTER_COMPANY") || t === "COST_ALLOCATED";

  return (
    <div className="space-y-3">
      <div className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1">
        <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>
          All
        </FilterChip>
        {companies.map((c) => (
          <FilterChip key={c.id} active={filter === c.id} onClick={() => setFilter(c.id)} color={c.brand_color}>
            {barShort(c)}
          </FilterChip>
        ))}
      </div>
      {list.map((e) => {
        const co = companyById(companies, e.company_id);
        const inter = isInter(e.event_type);
        return (
          <Card
            key={e.id}
            className={`flex items-start justify-between gap-2 p-3 ${
              inter ? "border-pink/30 bg-pink/5" : ""
            }`}
          >
            <div className="flex items-start gap-2">
              {inter ? (
                <ArrowLeftRight className="mt-0.5 h-4 w-4 text-pink" />
              ) : (
                <Building2 className="mt-0.5 h-4 w-4 text-muted-foreground" />
              )}
              <div>
                <p className="text-xs font-medium text-foreground">
                  {e.event_type.replace(/_/g, " ")}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {e.payload ? JSON.stringify(e.payload).replace(/[{}"]/g, "").replace(/,/g, " · ") : ""}
                </p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  {new Date(e.created_at).toLocaleString()}
                </p>
              </div>
            </div>
            {co && <CompanyBadge company={co} />}
          </Card>
        );
      })}
      {list.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">No events yet.</p>
      )}
    </div>
  );
}