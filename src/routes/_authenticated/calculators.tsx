import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { db, type InventoryItem } from "@/lib/db";
import { useInventory, useBatches } from "@/lib/queries";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PourCostGauge } from "@/components/PourCostGauge";
import { eur } from "@/lib/format";
import { Plus, Minus, Trash2, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/calculators")({
  head: () => ({ meta: [{ title: "Calculators — Bar Command Center" }] }),
  component: CalculatorsPage,
});

interface Line {
  key: string;
  inventory_id: string;
  amount_ml: number;
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-lg bg-secondary/60 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 text-lg font-black" style={{ color: tone }}>
        {value}
      </p>
    </div>
  );
}

function CalculatorsPage() {
  const { data: inv = [] } = useInventory();
  const [tab, setTab] = useState("cocktail");
  const [lines, setLines] = useState<Line[]>([]);

  const byId = useMemo(
    () => Object.fromEntries(inv.map((i) => [i.id, i])),
    [inv],
  );

  function addLine(inventory_id: string, amount_ml = 25) {
    setLines((l) => [
      ...l,
      { key: crypto.randomUUID(), inventory_id, amount_ml },
    ]);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black tracking-tight md:text-3xl">
          Calculators
        </h1>
        <p className="text-sm text-muted-foreground">
          Build drinks, batch prep, price wine, kegs and bottles.
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 bg-card p-1">
          <TabsTrigger value="cocktail" className="flex-1">Cocktail</TabsTrigger>
          <TabsTrigger value="batch" className="flex-1">Batch</TabsTrigger>
          <TabsTrigger value="wine" className="flex-1">Wine</TabsTrigger>
          <TabsTrigger value="keg" className="flex-1">Keg</TabsTrigger>
          <TabsTrigger value="bottle" className="flex-1">Bottle</TabsTrigger>
        </TabsList>

        <TabsContent value="cocktail" className="mt-4">
          <CocktailCalc inv={inv} byId={byId} lines={lines} setLines={setLines} />
        </TabsContent>
        <TabsContent value="batch" className="mt-4">
          <BatchCalc inv={inv} byId={byId} />
        </TabsContent>
        <TabsContent value="wine" className="mt-4">
          <WineCalc inv={inv} />
        </TabsContent>
        <TabsContent value="keg" className="mt-4">
          <KegCalc />
        </TabsContent>
        <TabsContent value="bottle" className="mt-4">
          <BottleBreakdown
            inv={inv}
            onAddToDrink={(id) => {
              addLine(id);
              setTab("cocktail");
              toast.success("Added to Cocktail Calculator");
            }}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ---------------- A) Cocktail ---------------- */
function CocktailCalc({
  inv,
  byId,
  lines,
  setLines,
}: {
  inv: InventoryItem[];
  byId: Record<string, InventoryItem>;
  lines: Line[];
  setLines: React.Dispatch<React.SetStateAction<Line[]>>;
}) {
  const qc = useQueryClient();
  const { isOwner } = useAuth();
  const [pick, setPick] = useState("");
  const [name, setName] = useState("");
  const [menuPrice, setMenuPrice] = useState("");

  const rows = lines.map((l) => {
    const item = byId[l.inventory_id];
    const cost = item ? item.cost_per_ml * l.amount_ml : 0;
    const alcoholMl = item ? (item.abv / 100) * l.amount_ml : 0;
    return { ...l, item, cost, alcoholMl };
  });

  const totalCost = rows.reduce((s, r) => s + r.cost, 0);
  const totalVol = rows.reduce((s, r) => s + r.amount_ml, 0);
  const totalAlcohol = rows.reduce((s, r) => s + r.alcoholMl, 0);
  const abv = totalVol > 0 ? (totalAlcohol / totalVol) * 100 : 0;
  const suggested = totalCost / 0.2; // 20% pour cost target
  const price = parseFloat(menuPrice) || 0;
  const pourCost = price > 0 ? (totalCost / price) * 100 : 0;
  const profit = price > 0 ? price - totalCost : 0;

  function setAmount(key: string, amount: number) {
    setLines((l) =>
      l.map((x) => (x.key === key ? { ...x, amount_ml: Math.max(0, amount) } : x)),
    );
  }

  async function save() {
    if (!isOwner) return toast.error("Only Owners can save to the menu.");
    if (!name.trim() || rows.length === 0)
      return toast.error("Add a name and ingredients first.");
    const specs = rows
      .map((r) => `${r.item?.name ?? "?"} ${r.amount_ml}ml`)
      .join(" | ");
    const finalPrice = price > 0 ? Math.round(price) : Math.round(suggested);
    const { data, error } = await db
      .from("cocktails")
      .insert({
        name: name.trim(),
        specs,
        price: finalPrice,
        est_cost: +totalCost.toFixed(2),
        abv_percent: +abv.toFixed(1),
        total_volume_ml: +totalVol.toFixed(0),
      })
      .select("id")
      .single();
    if (error) return toast.error(error.message);
    await db.from("cocktail_ingredients").insert(
      rows.map((r) => ({
        cocktail_id: data.id,
        inventory_id: r.inventory_id,
        amount_ml: r.amount_ml,
        cost_per_ingredient: +r.cost.toFixed(2),
      })),
    );
    qc.invalidateQueries({ queryKey: ["cocktails"] });
    toast.success("Saved to menu.");
    setLines([]);
    setName("");
    setMenuPrice("");
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="border-border bg-card p-4">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide">
          Build a drink
        </h2>
        <div className="flex gap-2">
          <Select value={pick} onValueChange={setPick}>
            <SelectTrigger className="h-11 flex-1">
              <SelectValue placeholder="Add ingredient…" />
            </SelectTrigger>
            <SelectContent>
              {inv.map((i) => (
                <SelectItem key={i.id} value={i.id}>
                  {i.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            className="h-11"
            onClick={() => {
              if (!pick) return;
              setLines((l) => [
                ...l,
                { key: crypto.randomUUID(), inventory_id: pick, amount_ml: 25 },
              ]);
              setPick("");
            }}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        <div className="mt-4 space-y-2">
          {rows.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No ingredients yet. Add from the dropdown above.
            </p>
          )}
          {rows.map((r) => (
            <div
              key={r.key}
              className="flex items-center gap-2 rounded-lg border border-border p-2"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {r.item?.name ?? "Unknown"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {eur(r.cost)} · {((r.item?.abv ?? 0)).toFixed(0)}% ABV
                </p>
              </div>
              <button
                onClick={() => setAmount(r.key, r.amount_ml - 5)}
                className="grid h-9 w-9 place-items-center rounded-md bg-secondary"
                aria-label="less"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="w-14 text-center text-sm tabular-nums">
                {r.amount_ml}ml
              </span>
              <button
                onClick={() => setAmount(r.key, r.amount_ml + 5)}
                className="grid h-9 w-9 place-items-center rounded-md bg-secondary"
                aria-label="more"
              >
                <Plus className="h-4 w-4" />
              </button>
              <button
                onClick={() => setLines((l) => l.filter((x) => x.key !== r.key))}
                className="grid h-9 w-9 place-items-center rounded-md text-red"
                aria-label="remove"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </Card>

      <Card className="border-border bg-card p-4">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide">
          Costing
        </h2>
        <div className="grid grid-cols-2 gap-2">
          <Stat label="Cost / drink" value={eur(totalCost)} tone="var(--red)" />
          <Stat label="Suggested @20%" value={eur(suggested)} tone="var(--teal)" />
          <Stat label="Volume" value={`${totalVol.toFixed(0)}ml`} />
          <Stat label="ABV" value={`${abv.toFixed(1)}%`} tone="var(--purple)" />
        </div>

        <div className="mt-4 space-y-1.5">
          <Label htmlFor="mp">Your menu price (€)</Label>
          <Input
            id="mp"
            type="number"
            step="0.5"
            value={menuPrice}
            onChange={(e) => setMenuPrice(e.target.value)}
            placeholder={suggested ? suggested.toFixed(2) : "0.00"}
            className="h-11"
          />
        </div>

        {price > 0 && (
          <div className="mt-4 space-y-3">
            <PourCostGauge percent={pourCost} />
            <div className="grid grid-cols-2 gap-2">
              <Stat label="Profit / drink" value={eur(profit)} tone="var(--green)" />
              <Stat label="Contribution" value={eur(profit)} tone="var(--green)" />
            </div>
          </div>
        )}

        <div className="mt-4 space-y-1.5">
          <Label htmlFor="cn">Cocktail name</Label>
          <Input
            id="cn"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="New drink"
            className="h-11"
          />
        </div>
        <div className="mt-3 flex gap-2">
          <Button onClick={save} className="h-11 flex-1 font-semibold">
            Save to Menu
          </Button>
          <Button
            variant="outline"
            className="h-11"
            onClick={() => {
              setLines([]);
              setName("");
              setMenuPrice("");
            }}
          >
            <X className="mr-1 h-4 w-4" /> Clear
          </Button>
        </div>
      </Card>
    </div>
  );
}

/* ---------------- B) Batch ---------------- */
function BatchCalc({
  inv,
  byId,
}: {
  inv: InventoryItem[];
  byId: Record<string, InventoryItem>;
}) {
  const qc = useQueryClient();
  const { data: saved = [] } = useBatches();
  const [name, setName] = useState("");
  const [servings, setServings] = useState("10");
  const [pick, setPick] = useState("");
  const [lines, setLines] = useState<
    { key: string; inventory_id: string; per_serving_ml: number; checked: boolean }[]
  >([]);

  const n = parseInt(servings) || 1;
  const rows = lines.map((l) => {
    const item = byId[l.inventory_id];
    const totalMl = l.per_serving_ml * n;
    const cost = item ? item.cost_per_ml * totalMl : 0;
    const alcohol = item ? (item.abv / 100) * totalMl : 0;
    return { ...l, item, totalMl, cost, alcohol };
  });
  const totalCost = rows.reduce((s, r) => s + r.cost, 0);
  const totalVol = rows.reduce((s, r) => s + r.totalMl, 0);
  const abv = totalVol > 0 ? (rows.reduce((s, r) => s + r.alcohol, 0) / totalVol) * 100 : 0;
  const perServing = totalCost / n;
  const doneCount = lines.filter((l) => l.checked).length;
  const progress = lines.length ? (doneCount / lines.length) * 100 : 0;

  async function save() {
    if (!name.trim() || rows.length === 0)
      return toast.error("Add a name and ingredients.");
    const { data, error } = await db
      .from("batch_recipes")
      .insert({
        name: name.trim(),
        total_servings: n,
        total_cost: +totalCost.toFixed(2),
        cost_per_serving: +perServing.toFixed(2),
      })
      .select("id")
      .single();
    if (error) return toast.error(error.message);
    await db.from("batch_ingredients").insert(
      rows.map((r) => ({
        batch_id: data.id,
        inventory_id: r.inventory_id,
        amount_ml: r.totalMl,
        checked: r.checked,
      })),
    );
    qc.invalidateQueries({ queryKey: ["batch_recipes"] });
    toast.success("Batch saved.");
    setName("");
    setLines([]);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="border-border bg-card p-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Batch name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="House sour mix"
              className="h-11"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Servings</Label>
            <Input
              type="number"
              value={servings}
              onChange={(e) => setServings(e.target.value)}
              className="h-11"
            />
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <Select value={pick} onValueChange={setPick}>
            <SelectTrigger className="h-11 flex-1">
              <SelectValue placeholder="Add ingredient (per serving)…" />
            </SelectTrigger>
            <SelectContent>
              {inv.map((i) => (
                <SelectItem key={i.id} value={i.id}>
                  {i.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            className="h-11"
            onClick={() => {
              if (!pick) return;
              setLines((l) => [
                ...l,
                { key: crypto.randomUUID(), inventory_id: pick, per_serving_ml: 25, checked: false },
              ]);
              setPick("");
            }}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        <div className="mt-4 space-y-2">
          {rows.map((r) => (
            <div key={r.key} className="flex items-center gap-2 rounded-lg border border-border p-2">
              <Checkbox
                checked={r.checked}
                onCheckedChange={(c) =>
                  setLines((l) =>
                    l.map((x) => (x.key === r.key ? { ...x, checked: !!c } : x)),
                  )
                }
                className="h-6 w-6"
              />
              <div className="min-w-0 flex-1">
                <p className={`truncate text-sm font-medium ${r.checked ? "line-through text-muted-foreground" : ""}`}>
                  {r.item?.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {r.totalMl.toFixed(0)}ml total · {eur(r.cost)}
                </p>
              </div>
              <Input
                type="number"
                value={r.per_serving_ml}
                onChange={(e) =>
                  setLines((l) =>
                    l.map((x) =>
                      x.key === r.key
                        ? { ...x, per_serving_ml: parseFloat(e.target.value) || 0 }
                        : x,
                    ),
                  )
                }
                className="h-9 w-20"
              />
              <button
                onClick={() => setLines((l) => l.filter((x) => x.key !== r.key))}
                className="grid h-9 w-9 place-items-center rounded-md text-red"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </Card>

      <Card className="border-border bg-card p-4">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide">Batch totals</h2>
        <div className="grid grid-cols-2 gap-2">
          <Stat label="Total cost" value={eur(totalCost)} tone="var(--red)" />
          <Stat label="Per serving" value={eur(perServing)} tone="var(--teal)" />
          <Stat label="Total volume" value={`${totalVol.toFixed(0)}ml`} />
          <Stat label="Batch ABV" value={`${abv.toFixed(1)}%`} tone="var(--purple)" />
        </div>
        <div className="mt-4">
          <div className="mb-1 flex justify-between text-xs text-muted-foreground">
            <span>Make progress</span>
            <span>{doneCount}/{lines.length}</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
        <Button onClick={save} className="mt-4 h-11 w-full font-semibold">
          Save batch recipe
        </Button>

        {saved.length > 0 && (
          <div className="mt-5">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Saved batches
            </p>
            <div className="space-y-1.5">
              {saved.slice(0, 6).map((b) => (
                <div key={b.id} className="flex justify-between text-sm">
                  <span className="truncate">{b.name}</span>
                  <span className="text-muted-foreground">
                    {b.total_servings}× · {eur(b.cost_per_serving)}/serv
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

/* ---------------- C) Wine ---------------- */
function WineCalc({ inv }: { inv: InventoryItem[] }) {
  const [pick, setPick] = useState("");
  const [cost, setCost] = useState("");
  const [size, setSize] = useState("750");
  const [pour, setPour] = useState("150");
  const [priceGlass, setPriceGlass] = useState("");

  function choose(id: string) {
    setPick(id);
    const item = inv.find((i) => i.id === id);
    if (item) {
      setCost(String(item.unit_cost));
      setSize(String(item.bottle_size_ml));
    }
  }

  const bottleCost = parseFloat(cost) || 0;
  const bottleSize = parseFloat(size) || 0;
  const pourSize = parseFloat(pour) || 1;
  const price = parseFloat(priceGlass) || 0;
  const pours = (bottleSize * 0.95) / pourSize;
  const costPerGlass = pours > 0 ? bottleCost / pours : 0;
  const pourCost = price > 0 ? (costPerGlass / price) * 100 : 0;
  const revenue = pours * price;
  const profit = revenue - bottleCost;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="border-border bg-card p-4 space-y-3">
        <div className="space-y-1.5">
          <Label>Wine from inventory</Label>
          <Select value={pick} onValueChange={choose}>
            <SelectTrigger className="h-11"><SelectValue placeholder="Select wine…" /></SelectTrigger>
            <SelectContent>
              {inv.map((i) => (
                <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Bottle cost (€)</Label>
            <Input type="number" value={cost} onChange={(e) => setCost(e.target.value)} className="h-11" />
          </div>
          <div className="space-y-1.5">
            <Label>Bottle size (ml)</Label>
            <Input type="number" value={size} onChange={(e) => setSize(e.target.value)} className="h-11" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Pour size (ml)</Label>
          <Input type="number" value={pour} onChange={(e) => setPour(e.target.value)} className="h-11" />
          <div className="flex gap-2 pt-1">
            {[125, 150, 175].map((p) => (
              <Button key={p} variant="outline" className="h-10 flex-1" onClick={() => setPour(String(p))}>
                {p}ml
              </Button>
            ))}
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Menu price / glass (€)</Label>
          <Input type="number" step="0.5" value={priceGlass} onChange={(e) => setPriceGlass(e.target.value)} className="h-11" />
        </div>
      </Card>

      <Card className="border-border bg-card p-4">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide">Results</h2>
        <div className="grid grid-cols-2 gap-2">
          <Stat label="Pours / bottle" value={pours.toFixed(1)} />
          <Stat label="Cost / glass" value={eur(costPerGlass)} tone="var(--red)" />
          <Stat label="Revenue / bottle" value={eur(revenue)} tone="var(--teal)" />
          <Stat label="Profit / bottle" value={eur(profit)} tone="var(--green)" />
        </div>
        {price > 0 && <div className="mt-4"><PourCostGauge percent={pourCost} /></div>}
        <p className="mt-3 text-xs text-muted-foreground">Accounts for 5% waste per bottle.</p>
      </Card>
    </div>
  );
}

/* ---------------- D) Keg ---------------- */
function KegCalc() {
  const [kegSize, setKegSize] = useState("30");
  const [kegCost, setKegCost] = useState("");
  const [pint, setPint] = useState("500");
  const [price, setPrice] = useState("");

  const litres = parseFloat(kegSize) || 0;
  const cost = parseFloat(kegCost) || 0;
  const pintMl = parseFloat(pint) || 1;
  const menu = parseFloat(price) || 0;
  const pints = (litres * 1000 * 0.9) / pintMl;
  const costPerPint = pints > 0 ? cost / pints : 0;
  const pourCost = menu > 0 ? (costPerPint / menu) * 100 : 0;
  const revenue = pints * menu;
  const profit = revenue - cost;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="border-border bg-card p-4 space-y-3">
        <div className="space-y-1.5">
          <Label>Keg size</Label>
          <div className="flex gap-2">
            {["20", "30", "50"].map((s) => (
              <Button key={s} variant={kegSize === s ? "default" : "outline"} className="h-11 flex-1" onClick={() => setKegSize(s)}>
                {s}L
              </Button>
            ))}
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Keg cost (€)</Label>
          <Input type="number" value={kegCost} onChange={(e) => setKegCost(e.target.value)} className="h-11" />
        </div>
        <div className="space-y-1.5">
          <Label>Pint size</Label>
          <div className="flex gap-2">
            {["330", "500"].map((s) => (
              <Button key={s} variant={pint === s ? "default" : "outline"} className="h-11 flex-1" onClick={() => setPint(s)}>
                {s}ml
              </Button>
            ))}
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Menu price / pint (€)</Label>
          <Input type="number" step="0.5" value={price} onChange={(e) => setPrice(e.target.value)} className="h-11" />
        </div>
      </Card>

      <Card className="border-border bg-card p-4">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide">Results</h2>
        <div className="grid grid-cols-2 gap-2">
          <Stat label="Pints / keg" value={pints.toFixed(0)} />
          <Stat label="Cost / pint" value={eur(costPerPint)} tone="var(--red)" />
          <Stat label="Revenue / keg" value={eur(revenue)} tone="var(--teal)" />
          <Stat label="Profit / keg" value={eur(profit)} tone="var(--green)" />
        </div>
        {menu > 0 && <div className="mt-4"><PourCostGauge percent={pourCost} /></div>}
        <p className="mt-3 text-xs text-muted-foreground">Accounts for 10% foam/line loss.</p>
      </Card>
    </div>
  );
}

/* ---------------- E) Bottle breakdown ---------------- */
function BottleBreakdown({
  inv,
  onAddToDrink,
}: {
  inv: InventoryItem[];
  onAddToDrink: (id: string) => void;
}) {
  const [pick, setPick] = useState("");
  const [custom, setCustom] = useState("30");
  const item = inv.find((i) => i.id === pick);
  const cpml = item?.cost_per_ml ?? 0;
  const customMl = parseFloat(custom) || 0;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="border-border bg-card p-4 space-y-3">
        <div className="space-y-1.5">
          <Label>Select product</Label>
          <Select value={pick} onValueChange={setPick}>
            <SelectTrigger className="h-11"><SelectValue placeholder="Choose a bottle…" /></SelectTrigger>
            <SelectContent>
              {inv.map((i) => (
                <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {item && (
          <>
            <div className="grid grid-cols-3 gap-2">
              <Stat label="Bottle cost" value={eur(item.unit_cost)} />
              <Stat label="Size" value={`${item.bottle_size_ml}ml`} />
              <Stat label="ABV" value={`${item.abv}%`} />
            </div>
            <Button variant="outline" className="h-11 w-full" onClick={() => onAddToDrink(item.id)}>
              <Plus className="mr-1 h-4 w-4" /> Add to Drink
            </Button>
          </>
        )}
      </Card>

      {item && (
        <Card className="border-border bg-card p-4">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide">Per-pour cost</h2>
          <div className="grid grid-cols-3 gap-2">
            <Stat label="25ml" value={eur(cpml * 25)} tone="var(--teal)" />
            <Stat label="30ml" value={eur(cpml * 30)} tone="var(--teal)" />
            <Stat label="50ml" value={eur(cpml * 50)} tone="var(--teal)" />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Stat label="Pours @25ml" value={(item.bottle_size_ml / 25).toFixed(0)} />
            <Stat label="Pours @50ml" value={(item.bottle_size_ml / 50).toFixed(0)} />
          </div>
          <div className="mt-4 space-y-1.5">
            <Label>Custom pour (ml)</Label>
            <Input type="number" value={custom} onChange={(e) => setCustom(e.target.value)} className="h-11" />
            <p className="pt-1 text-sm">
              Cost: <span className="font-black text-orange">{eur(cpml * customMl)}</span>
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}
