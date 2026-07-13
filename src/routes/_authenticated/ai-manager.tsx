import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useRef, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { eur, num } from "@/lib/format";
import {
  useCompanies,
  useGroupCocktails,
  useGroupPreps,
  findBar,
  barShort,
  buildSharedComparisons,
  signatureNames,
  barStats,
  marginOf,
  costOf,
  LAB_WEEKLY_COST,
  LAB_WEEKLY_REVENUE,
  LAB_WEEKLY_PROFIT,
  LAB_MARKUP,
  LAB_MARKET_MARKUP,
  LAB_BALANCES,
  LAB_SCHEDULE,
  AI_MEMORY,
  ADDRESS_ROUTING,
  VENDOR_HISTORY,
  type Company,
  type GroupCocktail,
  type GroupPrep,
} from "@/lib/group";
import {
  Brain,
  Network,
  ReceiptText,
  Wallet,
  Boxes,
  Martini,
  FlaskConical,
  AlertTriangle,
  TrendingUp,
  ArrowRight,
  Send,
  Sparkles,
  CheckCircle2,
  MapPin,
  Clock,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/ai-manager")({
  head: () => ({
    meta: [
      { title: "AI Group Manager — Imprensa Command Center" },
      {
        name: "description",
        content:
          "Multi-agent AI financial controller across the Plataforma Boémia group: benchmarking, invoice routing, cost, inventory, menu and Lab intelligence.",
      },
    ],
  }),
  component: AiManager,
});

type AgentKey =
  | "orchestrator"
  | "groupai"
  | "invoice"
  | "cost"
  | "inventory"
  | "menu"
  | "lab";

const AGENTS: { key: AgentKey; label: string; icon: typeof Brain }[] = [
  { key: "orchestrator", label: "Orchestrator", icon: Network },
  { key: "groupai", label: "GroupAI", icon: Brain },
  { key: "invoice", label: "Invoice AI", icon: ReceiptText },
  { key: "cost", label: "Cost AI", icon: Wallet },
  { key: "inventory", label: "Inventory AI", icon: Boxes },
  { key: "menu", label: "Menu AI", icon: Martini },
  { key: "lab", label: "Lab AI", icon: FlaskConical },
];

const SEV = {
  critical: "bg-red/15 text-red border-red/30",
  warning: "bg-orange/15 text-orange border-orange/30",
  info: "bg-teal/15 text-teal border-teal/30",
} as const;

function AiManager() {
  const { data: companies = [] } = useCompanies();
  const { data: cocktails = [] } = useGroupCocktails();
  const { data: preps = [] } = useGroupPreps();

  const [agent, setAgent] = useState<AgentKey>("orchestrator");
  const [companyId, setCompanyId] = useState<string>("all");

  // persist company selector
  useEffect(() => {
    const saved = localStorage.getItem("ai-manager:company");
    if (saved) setCompanyId(saved);
  }, []);
  useEffect(() => {
    localStorage.setItem("ai-manager:company", companyId);
  }, [companyId]);

  const pr = findBar(companies, "Principe");
  const baixa = findBar(companies, "Baixa");
  const lab = companies.find((c) => c.type === "lab");

  const ctx = useMemo(
    () => ({ companies, cocktails, preps, pr, baixa, lab, companyId }),
    [companies, cocktails, preps, pr, baixa, lab, companyId],
  );

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-black tracking-tight">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-purple/15 text-purple">
              <Sparkles className="h-5 w-5" />
            </span>
            AI Group Manager
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Multi-agent controller across the Plataforma Boémia group.
          </p>
        </div>
      </div>

      {/* Company selector (persists) */}
      <div className="flex flex-wrap gap-2">
        <CompanyChip
          active={companyId === "all"}
          label="All Companies"
          color="#a29bfe"
          onClick={() => setCompanyId("all")}
        />
        {companies
          .filter((c) => c.type !== "holding")
          .map((c) => (
            <CompanyChip
              key={c.id}
              active={companyId === c.id}
              label={barShort(c)}
              color={c.brand_color}
              onClick={() => setCompanyId(c.id)}
            />
          ))}
      </div>

      {/* Agent tabs */}
      <div className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
        {AGENTS.map((a) => {
          const active = agent === a.key;
          return (
            <button
              key={a.key}
              onClick={() => setAgent(a.key)}
              className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                active
                  ? "bg-purple/15 text-purple"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
            >
              <a.icon className="h-4 w-4" />
              {a.label}
            </button>
          );
        })}
      </div>

      {/* Agent content */}
      {agent === "orchestrator" && <Orchestrator {...ctx} />}
      {agent === "groupai" && <GroupAI {...ctx} />}
      {agent === "invoice" && <InvoiceAI />}
      {agent === "cost" && <CostAI {...ctx} />}
      {agent === "inventory" && <InventoryAI {...ctx} />}
      {agent === "menu" && <MenuAI {...ctx} />}
      {agent === "lab" && <LabAI {...ctx} />}

      {/* Ask questions + memory always available */}
      <AskQuestions ctx={ctx} />
      <MemoryView />
    </div>
  );
}

/* ---------- shared UI ---------- */
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

function Insight({
  sev,
  company,
  children,
  action,
}: {
  sev: keyof typeof SEV;
  company: string;
  children: React.ReactNode;
  action?: string;
}) {
  return (
    <div className={`rounded-xl border p-3 ${SEV[sev]}`}>
      <div className="mb-1 flex items-center gap-2">
        <Badge
          variant="outline"
          className="border-current/30 bg-background/30 text-[10px] font-bold uppercase"
        >
          {company}
        </Badge>
        <span className="text-[10px] font-bold uppercase tracking-wide opacity-70">
          {sev}
        </span>
      </div>
      <p className="text-sm leading-relaxed text-foreground">{children}</p>
      {action && (
        <button className="mt-2 inline-flex items-center gap-1 rounded-md bg-background/40 px-2.5 py-1 text-xs font-semibold">
          {action} <ArrowRight className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

function SectionCard({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof Brain;
  children: React.ReactNode;
}) {
  return (
    <Card className="space-y-3 p-4">
      <h2 className="flex items-center gap-2 text-sm font-bold">
        <Icon className="h-4 w-4 text-purple" /> {title}
      </h2>
      {children}
    </Card>
  );
}

/* ---------- Types for agent ctx ---------- */
interface Ctx {
  companies: Company[];
  cocktails: GroupCocktail[];
  preps: GroupPrep[];
  pr?: Company;
  baixa?: Company;
  lab?: Company;
  companyId: string;
}

/* ---------- A) Orchestrator ---------- */
function Orchestrator(ctx: Ctx) {
  const shared = buildSharedComparisons(ctx.cocktails, ctx.pr, ctx.baixa);
  const differentials = shared.filter((s) => !s.standardized);
  const monthlyImpact = differentials.reduce((s, d) => s + Math.abs(d.diff), 0) * 120; // ~120 drinks/mo est.
  return (
    <div className="space-y-3">
      <SectionCard title="Group crisis summary" icon={AlertTriangle}>
        <div className="space-y-2">
          <Insight sev="critical" company="Baixa" action="Open Cost AI">
            Food-cost alert — Baixa is trending above the 28% target. Highest
            priority in the group this week.
          </Insight>
          <Insight sev="warning" company="Príncipe Real" action="Push Chentenario">
            Stockout risk on <strong>Leche de Tigre</strong> — affects every
            signature that uses it. Both bars should push Chentenario.
          </Insight>
        </div>
      </SectionCard>

      <SectionCard title="Cross-company impact" icon={Network}>
        <Insight sev="warning" company="All bars">
          Olive-oil / <strong>Gin Azeitona</strong> input price increase affects{" "}
          <strong>all bars</strong>. Consolidated estimated monthly impact:{" "}
          <strong>{eur(340)}</strong>.
        </Insight>
        {differentials.length > 0 && (
          <Insight sev="info" company="PR vs Baixa">
            {differentials.length} shared cocktails are priced differently across
            bars (e.g. {differentials[0].name} {eur(differentials[0].prPrice)} vs{" "}
            {eur(differentials[0].baixaPrice)}). Standardising could shift roughly{" "}
            <strong>{eur(monthlyImpact)}</strong>/mo.
          </Insight>
        )}
      </SectionCard>

      <SectionCard title="Priority queue" icon={TrendingUp}>
        <div className="space-y-2">
          <QueueRow
            color="#ff6b6b"
            company="Baixa"
            text="Review food-cost drivers"
            action="Check variance"
          />
          <QueueRow
            color="#4ecdc4"
            company="Príncipe Real"
            text="Order Leche de Tigre ingredients from Lab"
            action="Order"
          />
          <QueueRow
            color="#fd79a8"
            company="Lab"
            text="Collect overdue balance from Baixa (5 days)"
            action="Remind"
          />
        </div>
      </SectionCard>
    </div>
  );
}
function QueueRow({
  color,
  company,
  text,
  action,
}: {
  color: string;
  company: string;
  text: string;
  action: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-secondary/40 p-2.5">
      <span className="h-8 w-1 rounded-full" style={{ backgroundColor: color }} />
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
          {company}
        </p>
        <p className="truncate text-sm font-medium">{text}</p>
      </div>
      <Button size="sm" variant="secondary" className="h-8 shrink-0 text-xs">
        {action}
      </Button>
    </div>
  );
}

/* ---------- B) GroupAI ---------- */
function GroupAI(ctx: Ctx) {
  const shared = buildSharedComparisons(ctx.cocktails, ctx.pr, ctx.baixa);
  const prNames = signatureNames(ctx.cocktails, ctx.pr);
  const bxNames = signatureNames(ctx.cocktails, ctx.baixa);
  const prStat = ctx.pr ? barStats(ctx.cocktails, ctx.pr, bxNames) : undefined;
  const bxStat = ctx.baixa ? barStats(ctx.cocktails, ctx.baixa, prNames) : undefined;
  const prPreps = 9;
  const bxPreps = 17;
  const top = shared.find((s) => !s.standardized);
  return (
    <div className="space-y-3">
      <SectionCard title="Cross-bar benchmarking" icon={Brain}>
        <div className="space-y-2">
          {top && (
            <Insight sev="info" company="PR vs Baixa">
              <strong>{top.name}</strong> margin: PR {num(marginFor(ctx, ctx.pr, top.name))}%
              ({eur(top.prPrice)}) vs Baixa {num(marginFor(ctx, ctx.baixa, top.name))}% (
              {eur(top.baixaPrice)}). Baixa earns{" "}
              <strong>{eur(Math.abs(top.diff))}</strong> more per drink.
            </Insight>
          )}
          {prStat && bxStat && (
            <Insight sev="info" company="PR vs Baixa">
              PR has <strong>{prStat.unique}</strong> unique signatures, Baixa has{" "}
              <strong>{bxStat.unique}</strong>.{" "}
              {prStat.unique >= bxStat.unique
                ? "PR has more menu variety but higher waste risk."
                : "Baixa has more menu variety but higher waste risk."}
            </Insight>
          )}
          <Insight sev="warning" company="Baixa">
            Baixa is more Lab-dependent (<strong>{bxPreps} preps</strong> vs PR's{" "}
            <strong>{prPreps}</strong>). If the Lab fails, Baixa loses ~81% of its
            signatures.
          </Insight>
        </div>
      </SectionCard>

      <SectionCard title="Price differential alerts" icon={AlertTriangle}>
        {shared.filter((s) => !s.standardized).length === 0 ? (
          <p className="text-sm text-muted-foreground">
            All shared cocktails are standardised across bars.
          </p>
        ) : (
          <div className="space-y-2">
            {shared
              .filter((s) => !s.standardized)
              .map((s) => (
                <Insight key={s.name} sev="warning" company="PR vs Baixa">
                  <strong>{s.name}</strong> {s.diff > 0 ? "+" : ""}
                  {eur(s.diff)} at Baixa ({eur(s.prPrice)} → {eur(s.baixaPrice)},{" "}
                  {s.diff > 0 ? "+" : ""}
                  {num(s.diffPct)}%). Consider standardising?
                </Insight>
              ))}
          </div>
        )}
      </SectionCard>

      <SectionCard title="Lab profitability" icon={FlaskConical}>
        <Insight sev="info" company="Cocktail Lab">
          Weekly production <strong>{eur(LAB_WEEKLY_COST)}</strong> cost →{" "}
          <strong>{eur(LAB_WEEKLY_REVENUE)}</strong> revenue. Profit:{" "}
          <strong>{eur(LAB_WEEKLY_PROFIT)}/week</strong> (~
          {eur(LAB_WEEKLY_PROFIT * 4.33)}/mo).
        </Insight>
      </SectionCard>
    </div>
  );
}
function marginFor(ctx: Ctx, bar: Company | undefined, name: string): number {
  if (!bar) return 0;
  const c = ctx.cocktails.find((x) => x.company_id === bar.id && x.name === name);
  return c ? marginOf(c) : 0;
}

/* ---------- C) Invoice AI ---------- */
function InvoiceAI() {
  return (
    <div className="space-y-3">
      <SectionCard title="Smart routing by delivery address" icon={MapPin}>
        <div className="space-y-2">
          {ADDRESS_ROUTING.map((r) => (
            <div
              key={r.address}
              className="flex items-center gap-3 rounded-lg border border-border bg-secondary/40 p-2.5"
            >
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: r.accent }}
              />
              <p className="flex-1 text-sm">
                <span className="font-mono text-xs text-muted-foreground">
                  {r.address}
                </span>{" "}
                <ArrowRight className="inline h-3 w-3" />{" "}
                <span className="font-semibold">{r.company}</span>
              </p>
            </div>
          ))}
        </div>
      </SectionCard>
      <SectionCard title="Vendor history" icon={Clock}>
        <ul className="space-y-1.5">
          {VENDOR_HISTORY.map((v) => (
            <li key={v} className="flex gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-teal" /> {v}
            </li>
          ))}
        </ul>
      </SectionCard>
      <SectionCard title="Routing accuracy" icon={TrendingUp}>
        <div className="grid grid-cols-3 gap-2 text-center">
          <Metric label="Auto-routed" value="94%" color="#2ed573" />
          <Metric label="Needs review" value="6%" color="#ffa502" />
          <Metric label="Mis-routed" value="0%" color="#4ecdc4" />
        </div>
      </SectionCard>
    </div>
  );
}
function Metric({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-lg border border-border bg-secondary/40 p-3">
      <p className="text-lg font-black" style={{ color }}>
        {value}
      </p>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
    </div>
  );
}

/* ---------- D) Cost AI ---------- */
function CostAI(ctx: Ctx) {
  const shared = buildSharedComparisons(ctx.cocktails, ctx.pr, ctx.baixa);
  return (
    <div className="space-y-3">
      <SectionCard title="Per-company cost analysis" icon={Wallet}>
        <div className="space-y-2">
          {shared.slice(0, 6).map((s) => {
            const prC = ctx.cocktails.find(
              (c) => c.company_id === ctx.pr?.id && c.name === s.name,
            );
            const bxC = ctx.cocktails.find(
              (c) => c.company_id === ctx.baixa?.id && c.name === s.name,
            );
            return (
              <div
                key={s.name}
                className="rounded-lg border border-border bg-secondary/40 p-2.5"
              >
                <p className="mb-1 text-sm font-bold">{s.name}</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {prC && (
                    <CostLine bar="Príncipe Real" c={prC} color="#4ecdc4" />
                  )}
                  {bxC && <CostLine bar="Baixa" c={bxC} color="#ffa502" />}
                </div>
              </div>
            );
          })}
        </div>
      </SectionCard>
      <SectionCard title="Variable-cost cocktails" icon={AlertTriangle}>
        <Insight sev="info" company="Príncipe Real">
          <strong>Bodoni</strong> variable cost: ~70% of customers choose House
          Gin ({eur(0.95)}), 30% House Rum ({eur(0.85)}). Blended pour cost ~
          {eur(0.92)}.
        </Insight>
      </SectionCard>
    </div>
  );
}
function CostLine({ bar, c, color }: { bar: string; c: GroupCocktail; color: string }) {
  const est = c.est_cost <= 0;
  return (
    <div className="rounded-md bg-background/40 p-2">
      <p className="font-bold" style={{ color }}>
        {bar}
      </p>
      <p className="text-muted-foreground">
        {eur(c.price)} · {est ? "est. " : ""}cost {eur(costOf(c))} · margin{" "}
        <span className="font-semibold text-foreground">{num(marginOf(c))}%</span>
      </p>
    </div>
  );
}

/* ---------- E) Inventory AI ---------- */
function InventoryAI(ctx: Ctx) {
  return (
    <div className="space-y-3">
      <SectionCard title="Per-company variance + Lab supply" icon={Boxes}>
        <div className="space-y-2">
          <Insight sev="critical" company="Both bars" action="Push Chentenario">
            <strong>Leche de Tigre</strong> expires in ~2 days. Both bars need a
            Chentenario push to consume it before waste.
          </Insight>
          <Insight sev="warning" company="Príncipe Real" action="Feature Bariol">
            Prep <strong>Bariol</strong> (7-day shelf) at PR: 3 days old, ~40%
            remaining. Feature Bariol this weekend?
          </Insight>
          <Insight sev="info" company="Cocktail Lab">
            Lab holds {ctx.preps.length} active preps supplying both bars. Rotate
            oldest-first to protect margin.
          </Insight>
        </div>
      </SectionCard>
    </div>
  );
}

/* ---------- F) Menu AI ---------- */
function MenuAI(ctx: Ctx) {
  const shared = buildSharedComparisons(ctx.cocktails, ctx.pr, ctx.baixa);
  return (
    <div className="space-y-3">
      <SectionCard title="Per-bar pricing matrix" icon={Martini}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                <th className="py-1.5 pr-2">Cocktail</th>
                <th className="px-2">PR</th>
                <th className="px-2">Baixa</th>
                <th className="px-2">Diff</th>
                <th className="px-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {shared.map((s) => (
                <tr key={s.name} className="border-t border-border">
                  <td className="py-2 pr-2 font-semibold">{s.name}</td>
                  <td className="px-2">{eur(s.prPrice)}</td>
                  <td className="px-2">{eur(s.baixaPrice)}</td>
                  <td className="px-2">
                    {s.diff === 0 ? "—" : `${s.diff > 0 ? "+" : ""}${eur(s.diff)} (${
                      s.diff > 0 ? "+" : ""
                    }${num(s.diffPct)}%)`}
                  </td>
                  <td className="px-2">
                    {s.standardized ? (
                      <Badge className="bg-green/15 text-green">Standardized</Badge>
                    ) : (
                      <Badge className="bg-orange/15 text-orange">Differential</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {shared.some((s) => !s.standardized) && (
        <SectionCard title="Standardize shared prices?" icon={TrendingUp}>
          <p className="mb-2 text-sm text-muted-foreground">
            {shared.filter((s) => !s.standardized).length} cocktails differ across
            bars. Owner prefers €0.50 increments.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" className="bg-teal text-background hover:bg-teal/90">
              Yes — set all to {eur(12)}
            </Button>
            <Button size="sm" variant="secondary">
              No — keep differential
            </Button>
          </div>
        </SectionCard>
      )}

      <SectionCard title="Bodoni optimization" icon={Martini}>
        <Insight sev="info" company="Príncipe Real">
          Raise the Rum option to {eur(13)}? A {eur(1)} premium for the alternative
          spirit captures the 30% who choose House Rum without touching the Gin
          base price.
        </Insight>
      </SectionCard>
    </div>
  );
}

/* ---------- G) Lab AI ---------- */
function LabAI(ctx: Ctx) {
  const prepNames = new Set(ctx.preps.map((p) => p.name));
  return (
    <div className="space-y-3">
      <SectionCard title="Weekly production schedule" icon={FlaskConical}>
        <div className="space-y-2">
          {LAB_SCHEDULE.map((d) => (
            <div
              key={d.day}
              className="rounded-lg border border-border bg-secondary/40 p-2.5"
            >
              <p className="mb-1 text-xs font-bold text-pink">{d.day}</p>
              <div className="flex flex-wrap gap-1.5">
                {d.preps.map((p) => (
                  <Badge
                    key={p}
                    variant="outline"
                    className={`text-[11px] ${
                      prepNames.has(p) ? "border-pink/40 text-foreground" : "opacity-60"
                    }`}
                  >
                    {p}
                  </Badge>
                ))}
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Transfer price optimization" icon={Wallet}>
        <Insight sev="warning" company="Cocktail Lab">
          Current inter-company markup <strong>{LAB_MARKUP}%</strong>. Market rate
          is <strong>{LAB_MARKET_MARKUP}</strong>. Raising to 35% lifts Lab weekly
          profit from {eur(LAB_WEEKLY_PROFIT)} toward{" "}
          {eur(LAB_WEEKLY_PROFIT + LAB_WEEKLY_COST * 0.05)}.
        </Insight>
      </SectionCard>

      <SectionCard title="Outstanding balances" icon={AlertTriangle}>
        <div className="space-y-2">
          {LAB_BALANCES.map((b) => (
            <div
              key={b.bar}
              className="flex items-center justify-between rounded-lg border border-border bg-secondary/40 p-2.5"
            >
              <span className="text-sm font-semibold">{b.bar} owes Lab</span>
              <span className="flex items-center gap-2">
                <span className="font-black">{eur(b.amount)}</span>
                {b.overdueDays > 0 && (
                  <Badge className="bg-red/15 text-red">
                    Overdue {b.overdueDays}d
                  </Badge>
                )}
              </span>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

/* ---------- H) Ask Questions ---------- */
const SUGGESTED = [
  "Why is Didot €1 cheaper at Príncipe Real?",
  "How much does the Lab make per month?",
  "Which bar should I focus on this week?",
  "What preps expire in the next 3 days?",
];

function answer(q: string, ctx: Ctx): string {
  const s = q.toLowerCase();
  const shared = buildSharedComparisons(ctx.cocktails, ctx.pr, ctx.baixa);
  if (s.includes("didot")) {
    const d = shared.find((x) => x.name === "Didot");
    if (d)
      return `Didot is ${eur(d.prPrice)} at Príncipe Real vs ${eur(
        d.baixaPrice,
      )} at Baixa — a ${eur(Math.abs(d.diff))} (${num(
        Math.abs(d.diffPct),
      )}%) difference. Baixa sits in a higher-footfall location and carries the group's ~4.5% price premium, so it earns ${eur(
        Math.abs(d.diff),
      )} more per drink on the same recipe.`;
    return "Didot isn't shared across both bars in the current data.";
  }
  if (s.includes("lab") && (s.includes("month") || s.includes("make") || s.includes("profit"))) {
    return `The Cocktail Lab nets ${eur(LAB_WEEKLY_PROFIT)}/week (${eur(
      LAB_WEEKLY_REVENUE,
    )} revenue − ${eur(LAB_WEEKLY_COST)} cost), which is about ${eur(
      LAB_WEEKLY_PROFIT * 4.33,
    )}/month at the current ${LAB_MARKUP}% transfer markup.`;
  }
  if (s.includes("focus") || s.includes("this week")) {
    return `Focus on Baixa — it has the group's critical food-cost alert and owes the Lab ${eur(
      2600,
    )} (5 days overdue). Second priority: Príncipe Real's Leche de Tigre stockout risk.`;
  }
  if (s.includes("expire") || s.includes("prep")) {
    return `Leche de Tigre expires in ~2 days (used across signatures at both bars). Bariol at PR is 3 days into a 7-day shelf (~40% left) — feature it this weekend. The Lab currently manages ${ctx.preps.length} active preps.`;
  }
  if (s.includes("standard")) {
    const diff = shared.filter((x) => !x.standardized);
    return diff.length
      ? `${diff.length} shared cocktails are priced differently: ${diff
          .map((d) => `${d.name} (${eur(d.prPrice)}/${eur(d.baixaPrice)})`)
          .join(", ")}. Standardising to €12 aligns with the owner's €0.50-increment preference.`
      : "All shared cocktails are already standardised across both bars.";
  }
  return "I answer from live group data — try asking about a specific cocktail, the Lab's profit, which bar to prioritise, or expiring preps.";
}

function AskQuestions({ ctx }: { ctx: Ctx }) {
  const [msgs, setMsgs] = useState<{ role: "user" | "ai"; text: string }[]>([]);
  const [input, setInput] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs]);
  function ask(q: string) {
    if (!q.trim()) return;
    setMsgs((m) => [...m, { role: "user", text: q }, { role: "ai", text: answer(q, ctx) }]);
    setInput("");
  }
  return (
    <SectionCard title="Ask the AI (context-aware)" icon={Sparkles}>
      <div className="flex flex-wrap gap-1.5">
        {SUGGESTED.map((q) => (
          <button
            key={q}
            onClick={() => ask(q)}
            className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            {q}
          </button>
        ))}
      </div>
      {msgs.length > 0 && (
        <div className="max-h-72 space-y-2 overflow-y-auto rounded-lg border border-border bg-secondary/30 p-3">
          {msgs.map((m, i) => (
            <div
              key={i}
              className={m.role === "user" ? "flex justify-end" : "flex justify-start"}
            >
              <div
                className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                  m.role === "user"
                    ? "bg-purple text-background"
                    : "bg-background text-foreground"
                }`}
              >
                {m.text}
              </div>
            </div>
          ))}
          <div ref={endRef} />
        </div>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
        }}
        className="flex gap-2"
      >
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about margins, the Lab, pricing…"
          className="h-10"
        />
        <Button type="submit" size="icon" className="h-10 w-10 shrink-0">
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </SectionCard>
  );
}

/* ---------- I) AI Memory ---------- */
function MemoryView() {
  return (
    <SectionCard title="AI Memory" icon={Brain}>
      <ul className="space-y-1.5">
        {AI_MEMORY.map((m) => (
          <li
            key={m}
            className="flex gap-2 rounded-lg border border-border bg-secondary/30 p-2.5 text-sm"
          >
            <Brain className="mt-0.5 h-4 w-4 shrink-0 text-purple" /> {m}
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}
