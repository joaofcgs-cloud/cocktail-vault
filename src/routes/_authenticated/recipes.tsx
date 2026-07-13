import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { eur, num } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import {
  useCompanies,
  useGroupCocktails,
  useGroupPreps,
  useCostTargets,
  findBar,
  barShort,
  marginOf,
  costOf,
  SHARED_COCKTAILS,
  RECIPE_COMPOSITION,
  compTotal,
  suggestedPrice,
  BEVERAGE_COST_TARGET,
  BODONI_INSIGHT,
  prepEconomics,
  DEFAULT_MARKUP_PERCENT,
  type Company,
  type GroupCocktail,
} from "@/lib/group";
import {
  Martini,
  Building2,
  FlaskConical,
  Calculator,
  ArrowRight,
  Copy,
  Sparkles,
  Clock,
  TrendingUp,
  Lock,
  ChevronRight,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/recipes")({
  head: () => ({
    meta: [
      { title: "Recipes & Margins — Imprensa Group Command Center" },
      {
        name: "description",
        content:
          "Group menu true-cost calculation, per-bar pricing, Lab batch economics and cost-composition drill-down across the Plataforma Boémia group.",
      },
    ],
  }),
  component: RecipesPage,
});

const TABS = [
  { key: "menu", label: "Group Menu", icon: Martini },
  { key: "pricing", label: "Per-Bar Pricing", icon: Building2 },
  { key: "batches", label: "Lab Batches", icon: FlaskConical },
  { key: "analysis", label: "Cost Analysis", icon: Calculator },
] as const;
type TabKey = (typeof TABS)[number]["key"];

function marginBadge(m: number) {
  if (m >= 78) return "bg-green/15 text-green";
  if (m >= 72) return "bg-teal/15 text-teal";
  if (m >= 65) return "bg-orange/15 text-orange";
  return "bg-red/15 text-red";
}

function RecipesPage() {
  const [tab, setTab] = useState<TabKey>("menu");
  const { isOwner } = useAuth();

  const { data: companies = [] } = useCompanies();
  const { data: cocktails = [] } = useGroupCocktails();
  const { data: preps = [] } = useGroupPreps();

  const pr = findBar(companies, "Principe");
  const baixa = findBar(companies, "Baixa");

  return (
    <div className="mx-auto w-full max-w-6xl px-3 pb-24 pt-4 md:px-6">
      <header className="mb-4">
        <h1 className="text-xl font-semibold text-foreground md:text-2xl">
          Recipes &amp; Margins
        </h1>
        <p className="text-sm text-muted-foreground">
          True-cost recipes, per-bar pricing and Lab batch profitability across the group.
        </p>
        <div className="mt-2">
          <Badge
            className={
              isOwner
                ? "bg-purple/15 text-purple"
                : "bg-secondary text-muted-foreground"
            }
          >
            {isOwner ? "Owner — full edit access" : "Bar manager — price adjust only"}
          </Badge>
        </div>
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
                active ? "bg-teal/15 text-teal" : "text-muted-foreground hover:bg-card"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "menu" && <GroupMenuTab isOwner={isOwner} />}
      {tab === "pricing" && (
        <PerBarPricingTab
          cocktails={cocktails}
          pr={pr}
          baixa={baixa}
          isOwner={isOwner}
        />
      )}
      {tab === "batches" && (
        <LabBatchesTab preps={preps} companies={companies} />
      )}
      {tab === "analysis" && (
        <CostAnalysisTab companies={companies} pr={pr} baixa={baixa} />
      )}
    </div>
  );
}

/* ---------------- Group Menu ---------------- */
function GroupMenuTab({ isOwner }: { isOwner: boolean }) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Shared cocktails served across both bars. TRUE cost is built from real spirit,
        food, prep and garnish inputs. Suggested price targets the group{" "}
        {BEVERAGE_COST_TARGET}% beverage-cost benchmark.
      </p>
      {SHARED_COCKTAILS.map((name) => {
        const comp = RECIPE_COMPOSITION[name];
        const cost = compTotal(comp);
        const price = suggestedPrice(cost);
        const margin = ((price - cost) / price) * 100;
        return (
          <Card key={name} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold">{name}</h3>
                <p className="text-xs text-muted-foreground">Group signature</p>
              </div>
              <Badge className="bg-teal/15 text-teal">Shared</Badge>
            </div>

            <div className="mt-3 grid grid-cols-4 gap-2 text-center text-xs">
              <Comp label="Spirit" v={comp.spirit} />
              <Comp label="Food" v={comp.food} />
              <Comp label="Prep" v={comp.prep} />
              <Comp label="Garnish" v={comp.garnish} />
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-sm">
              <span className="text-muted-foreground">
                TRUE cost{" "}
                <span className="font-semibold text-foreground">{eur(cost)}</span>
              </span>
              <span className="text-muted-foreground">
                Suggested price{" "}
                <span className="font-semibold text-foreground">{eur(price)}</span>
              </span>
              <Badge className={marginBadge(margin)}>{num(margin, 0)}% margin</Badge>
            </div>

            <div className="mt-3">
              <Button
                size="sm"
                variant="outline"
                disabled={!isOwner}
                onClick={() =>
                  toast.success(`${name}: recipe updated`, {
                    description: `Standard price set to ${eur(price)} group-wide.`,
                  })
                }
              >
                {isOwner ? (
                  <>Apply standard price <ArrowRight className="ml-1.5 h-3.5 w-3.5" /></>
                ) : (
                  <><Lock className="mr-1.5 h-3.5 w-3.5" /> Owner only</>
                )}
              </Button>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
function Comp({ label, v }: { label: string; v: number }) {
  return (
    <div className="rounded-lg bg-secondary/50 p-2">
      <p className="font-semibold text-foreground">{eur(v)}</p>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  );
}

/* ---------------- Per-Bar Pricing ---------------- */
function PerBarPricingTab({
  cocktails,
  pr,
  baixa,
  isOwner,
}: {
  cocktails: GroupCocktail[];
  pr?: Company;
  baixa?: Company;
  isOwner: boolean;
}) {
  const rows = useMemo(() => {
    if (!pr || !baixa) return [];
    return SHARED_COCKTAILS.map((name) => {
      const prC = cocktails.find((c) => c.company_id === pr.id && c.name === name);
      const bxC = cocktails.find((c) => c.company_id === baixa.id && c.name === name);
      return { name, prC, bxC };
    }).filter((r) => r.prC && r.bxC);
  }, [cocktails, pr, baixa]);

  return (
    <div className="space-y-3">
      <Card className="overflow-x-auto p-0">
        <table className="w-full min-w-[520px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="p-3 font-medium">Cocktail</th>
              <th className="p-3 font-medium" style={{ color: pr?.brand_color }}>
                {barShort(pr)}
              </th>
              <th className="p-3 font-medium" style={{ color: baixa?.brand_color }}>
                {barShort(baixa)}
              </th>
              <th className="p-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ name, prC, bxC }) => {
              const prM = marginOf(prC!);
              const bxM = marginOf(bxC!);
              const same = prC!.price === bxC!.price;
              return (
                <tr key={name} className="border-b border-border/60 last:border-0">
                  <td className="p-3 font-medium">{name}</td>
                  <td className="p-3">
                    <div className="font-semibold">{eur(prC!.price)}</div>
                    <Badge className={`${marginBadge(prM)} mt-1`}>
                      {num(prM, 0)}%
                    </Badge>
                  </td>
                  <td className="p-3">
                    <div className="font-semibold">{eur(bxC!.price)}</div>
                    <Badge className={`${marginBadge(bxM)} mt-1`}>
                      {num(bxM, 0)}%
                    </Badge>
                  </td>
                  <td className="p-3">
                    <div className="flex justify-end gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-xs"
                        disabled={same}
                        onClick={() =>
                          toast.success(`${name} synced to group price`, {
                            description: same
                              ? "Already aligned."
                              : `Both bars set to ${eur(Math.max(prC!.price, bxC!.price))}.`,
                          })
                        }
                      >
                        <Copy className="mr-1 h-3 w-3" /> Sync
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-xs"
                        onClick={() =>
                          toast.info(`Customize ${name} for a bar`, {
                            description: isOwner
                              ? "Owner can set per-bar overrides."
                              : "Bar managers can adjust their own bar's price.",
                          })
                        }
                      >
                        Customize
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      {/* Bodoni house-spirit AI insight */}
      <Card className="border-purple/30 bg-purple/5 p-4">
        <div className="mb-2 flex items-center gap-2 text-purple">
          <Sparkles className="h-4 w-4" />
          <span className="text-sm font-semibold">Bodoni — house-spirit insight</span>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {BODONI_INSIGHT.map((b) => (
            <div
              key={b.name}
              className="rounded-lg bg-card p-3 text-sm"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">{b.name}</span>
                <Badge className={marginBadge(b.margin)}>{b.margin}%</Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {eur(b.price)} · {b.share}% of customers choose this
              </p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-foreground">
          House Rum sells at {eur(12)} with a 74% margin —{" "}
          <span className="font-semibold text-purple">raise Rum to €13?</span> Only 30%
          of guests pick it, so demand impact is low while margin rises to ~76%.
        </p>
      </Card>
    </div>
  );
}

/* ---------------- Lab Batches ---------------- */
function LabBatchesTab({
  preps,
  companies,
}: {
  preps: import("@/lib/group").GroupPrep[];
  companies: Company[];
}) {
  const [q, setQ] = useState("");
  const bars = companies.filter((c) => c.type === "bar");
  const filtered = preps.filter((p) =>
    p.name.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {preps.length} prep recipes · {DEFAULT_MARKUP_PERCENT}% transfer markup to each bar
        </p>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search preps…"
          className="h-8 w-40 rounded-lg border border-border bg-card px-3 text-xs outline-none focus:border-teal"
        />
      </div>

      {/* Production scheduler highlight */}
      <Card className="border-orange/30 bg-orange/5 p-4">
        <div className="mb-1 flex items-center gap-2 text-orange">
          <Clock className="h-4 w-4" />
          <span className="text-sm font-semibold">Batch production scheduler</span>
        </div>
        <p className="text-xs text-foreground">
          <span className="font-semibold">Leche de Tigre:</span> 3-day shelf life. Produce
          Monday for both bars to cover the week without waste.
        </p>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2">
        {filtered.map((prep) => {
          const e = prepEconomics(prep);
          return (
            <Card key={prep.id} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm font-semibold leading-tight">{prep.name}</h3>
                <Badge className="bg-purple/15 text-purple">
                  {e.shelfLifeDays}d shelf
                </Badge>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <Metric
                  label="Production cost"
                  value={eur(e.productionCost)}
                  sub={`${num(e.yieldMl, 0)}ml batch`}
                  est={e.estimated}
                />
                <Metric
                  label="Transfer price"
                  value={eur(e.transferPricePerBatch)}
                  sub={`+${DEFAULT_MARKUP_PERCENT}% to bars`}
                />
              </div>
              <div className="mt-3 rounded-lg bg-green/5 p-2 text-xs">
                <div className="flex items-center gap-1.5 font-medium text-green">
                  <TrendingUp className="h-3.5 w-3.5" /> Bar margin impact
                </div>
                <p className="mt-1 text-foreground">
                  Lab batch{" "}
                  <span className="font-semibold text-green">{eur(e.labPerDrink)}/drink</span>{" "}
                  vs retail{" "}
                  <span className="font-semibold">{eur(e.retailPerDrink)}/drink</span> —
                  saves {eur(e.savingPerDrink)}/drink.
                </p>
              </div>
              <div className="mt-2 flex gap-1.5">
                {bars.map((b) => (
                  <Button
                    key={b.id}
                    size="sm"
                    variant="outline"
                    className="h-7 flex-1 px-2 text-[11px]"
                    onClick={() =>
                      toast.success(`Scheduled ${prep.name} → ${barShort(b)}`, {
                        description: `Transfer at ${eur(e.transferPricePerBatch)} (${e.shelfLifeDays}-day shelf).`,
                      })
                    }
                  >
                    → {barShort(b)}
                  </Button>
                ))}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
function Metric({
  label,
  value,
  sub,
  est,
}: {
  label: string;
  value: string;
  sub?: string;
  est?: boolean;
}) {
  return (
    <div className="rounded-lg bg-secondary/50 p-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="font-semibold text-foreground">
        {value}
        {est && <span className="ml-1 text-[10px] text-muted-foreground">est.</span>}
      </p>
      {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

/* ---------------- Cost Analysis ---------------- */
function CostAnalysisTab({
  companies,
  pr,
  baixa,
}: {
  companies: Company[];
  pr?: Company;
  baixa?: Company;
}) {
  const [scope, setScope] = useState<string>("group");
  const scopes = [
    { id: "group", label: "Group" },
    ...companies.filter((c) => c.type === "bar").map((c) => ({ id: c.id, label: barShort(c) })),
  ];

  return (
    <div className="space-y-3">
      <div className="flex gap-1 overflow-x-auto">
        {scopes.map((s) => (
          <button
            key={s.id}
            onClick={() => setScope(s.id)}
            className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium ${
              scope === s.id ? "bg-teal/15 text-teal" : "text-muted-foreground hover:bg-card"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {SHARED_COCKTAILS.map((name) => {
        const c = RECIPE_COMPOSITION[name];
        const total = compTotal(c);
        const parts = [
          { label: "spirit", v: c.spirit, color: "#4ecdc4" },
          { label: "food", v: c.food, color: "#ffa502" },
          { label: "prep", v: c.prep, color: "#a29bfe" },
          { label: "garnish", v: c.garnish, color: "#2ed573" },
        ];
        return (
          <Card key={name} className="p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">{name}</h3>
              <span className="text-sm font-semibold">{eur(total)} TRUE cost</span>
            </div>
            <div className="mt-3 flex h-3 overflow-hidden rounded-full">
              {parts.map((p) => (
                <div
                  key={p.label}
                  style={{ width: `${(p.v / total) * 100}%`, background: p.color }}
                />
              ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
              {parts.map((p) => (
                <span key={p.label} className="flex items-center gap-1.5">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full"
                    style={{ background: p.color }}
                  />
                  {p.label} {eur(p.v)}
                </span>
              ))}
            </div>
          </Card>
        );
      })}

      {/* Food-cost drill-down */}
      <Card className="border-orange/30 bg-orange/5 p-4">
        <div className="mb-2 flex items-center gap-2 text-orange">
          <ChevronRight className="h-4 w-4" />
          <span className="text-sm font-semibold">
            Why does Baixa have higher food cost?
          </span>
        </div>
        <ul className="space-y-1.5 text-xs text-foreground">
          <li>
            • Baixa food cost <span className="font-semibold">30.1%</span> vs Príncipe Real{" "}
            <span className="font-semibold">26.4%</span> (target 28%).
          </li>
          <li>• Baixa pays 15% more for lime — not yet consolidated through the Lab.</li>
          <li>• Higher garnish waste (4.6% vs 3.2%) on citrus-heavy specs.</li>
          <li>
            • Fix: route lime + citrus preps via Lab batches to cut{" "}
            <span className="font-semibold text-green">~€0.27/drink</span>.
          </li>
        </ul>
      </Card>
    </div>
  );
}
