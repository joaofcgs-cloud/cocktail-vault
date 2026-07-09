import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  db,
  type FoodItem,
  type PrepRecipe,
  type PrepIngredient,
} from "@/lib/db";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { eur } from "@/lib/format";
import { Plus, Trash2, FlaskConical, Beaker, Upload, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { scanPrepRecipes, type ParsedPrepRecipe } from "@/lib/prep-recipe.functions";
import { useServerFn } from "@tanstack/react-start";
import { bestMatch } from "@/lib/match";

export const Route = createFileRoute("/_authenticated/prep")({
  head: () => ({ meta: [{ title: "Prep — Bar Command Center" }] }),
  component: PrepPage,
});

const UNITS = ["gram", "ml", "leaf", "slice", "piece", "dash", "drop", "Un"];

interface PrepCategory {
  value: string;
  label: string;
  units: string[]; // allowed ingredient units
  yieldUnits: string[];
  single: boolean; // only one ingredient allowed
  wineOnly: boolean; // ingredient must be wine
}

const PREP_CATEGORIES: PrepCategory[] = [
  { value: "food", label: "Food", units: ["gram", "ml"], yieldUnits: ["gram", "ml", "batch"], single: false, wineOnly: false },
  { value: "cocktail", label: "Cocktail", units: ["ml"], yieldUnits: ["ml"], single: false, wineOnly: false },
  { value: "cocktail_batch", label: "Cocktail Batch", units: ["ml"], yieldUnits: ["ml", "batch"], single: false, wineOnly: false },
  { value: "glass_of_wine", label: "Glass of Wine", units: ["ml"], yieldUnits: ["ml"], single: true, wineOnly: true },
];

const CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  PREP_CATEGORIES.map((c) => [c.value, c.label]),
);

function isWine(f: FoodItem | undefined): boolean {
  if (!f) return false;
  const s = `${f.name} ${f.category}`.toLowerCase();
  return s.includes("wine") || s.includes("vinho");
}

interface DraftIngredient {
  food_inventory_id: string;
  amount: number;
  amount_unit: string;
}

interface ImportIngredient {
  name: string;
  amount: number;
  amount_unit: string;
  food_inventory_id: string; // "" = skip / no match
  confidence: number;
}

interface ImportRecipe {
  name: string;
  yield_amount: number;
  yield_unit: string;
  shelf_life_days: number | null;
  instructions: string;
  ingredients: ImportIngredient[];
}

function ingredientCost(food: FoodItem | undefined, amount: number): number {
  if (!food) return 0;
  // For Kg-priced foods, treat gram amounts via cost_per_gram; else per unit.
  if (food.cost_per_gram > 0) return +(food.cost_per_gram * amount).toFixed(4);
  return +(food.cost_per_unit * amount).toFixed(4);
}

function PrepPage() {
  const qc = useQueryClient();
  const { isOwner } = useAuth();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("food");
  const [yieldAmount, setYieldAmount] = useState("500");
  const [yieldUnit, setYieldUnit] = useState("ml");
  const [shelfLife, setShelfLife] = useState("14");
  const [instructions, setInstructions] = useState("");
  const [draft, setDraft] = useState<DraftIngredient[]>([]);
  const [saving, setSaving] = useState(false);
  const runScan = useServerFn(scanPrepRecipes);
  const [importing, setImporting] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [imported, setImported] = useState<ImportRecipe[]>([]);

  const { data: recipes = [] } = useQuery({
    queryKey: ["prep_recipes"],
    queryFn: async (): Promise<PrepRecipe[]> => {
      const { data, error } = await db
        .from("prep_recipes")
        .select("*")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: ingredients = [] } = useQuery({
    queryKey: ["prep_ingredients"],
    queryFn: async (): Promise<PrepIngredient[]> => {
      const { data, error } = await db.from("prep_ingredients").select("*");
      if (error) throw error;
      return data;
    },
  });

  const { data: food = [] } = useQuery({
    queryKey: ["food_inventory"],
    queryFn: async (): Promise<FoodItem[]> => {
      const { data, error } = await db
        .from("food_inventory")
        .select("*")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const foodById = useMemo(
    () => new Map(food.map((f) => [f.id, f])),
    [food],
  );
  const ingredientsByRecipe = useMemo(() => {
    const m = new Map<string, PrepIngredient[]>();
    for (const ing of ingredients) {
      const arr = m.get(ing.prep_recipe_id) ?? [];
      arr.push(ing);
      m.set(ing.prep_recipe_id, arr);
    }
    return m;
  }, [ingredients]);

  const draftTotal = draft.reduce(
    (sum, d) => sum + ingredientCost(foodById.get(d.food_inventory_id), d.amount),
    0,
  );

  const catConfig =
    PREP_CATEGORIES.find((c) => c.value === category) ?? PREP_CATEGORIES[0];
  const selectableFood = useMemo(
    () => (catConfig.wineOnly ? food.filter(isWine) : food),
    [food, catConfig.wineOnly],
  );

  function applyCategory(value: string) {
    const cfg = PREP_CATEGORIES.find((c) => c.value === value) ?? PREP_CATEGORIES[0];
    setCategory(value);
    if (!cfg.yieldUnits.includes(yieldUnit)) setYieldUnit(cfg.yieldUnits[0]);
    setDraft((rows) => {
      let next = rows.map((r) => ({
        ...r,
        amount_unit: cfg.units.includes(r.amount_unit) ? r.amount_unit : cfg.units[0],
      }));
      if (cfg.single) next = next.slice(0, 1);
      return next;
    });
  }

  function resetForm() {
    setName("");
    setCategory("food");
    setYieldAmount("500");
    setYieldUnit("ml");
    setShelfLife("14");
    setInstructions("");
    setDraft([]);
  }

  function addDraftRow() {
    if (catConfig.single && draft.length >= 1) {
      toast.error("A glass of wine allows only one ingredient.");
      return;
    }
    const pool = catConfig.wineOnly ? selectableFood : food;
    if (pool.length === 0) {
      toast.error("Add food items in Stock first.");
      return;
    }
    setDraft((d) => [
      ...d,
      { food_inventory_id: pool[0].id, amount: 1, amount_unit: catConfig.units[0] },
    ]);
  }

  async function saveRecipe() {
    if (!isOwner) {
      toast.error("Only Owners can create prep recipes.");
      return;
    }
    if (!name.trim()) {
      toast.error("Give the prep recipe a name.");
      return;
    }
    setSaving(true);
    const { data: recipe, error } = await db
      .from("prep_recipes")
      .insert({
        name: name.trim(),
        yield_amount: Number(yieldAmount) || 0,
        yield_unit: yieldUnit,
        shelf_life_days: Number(shelfLife) || null,
        instructions: instructions.trim() || null,
      })
      .select()
      .single();
    if (error || !recipe) {
      toast.error(error?.message ?? "Could not save recipe");
      setSaving(false);
      return;
    }
    if (draft.length > 0) {
      const rows = draft.map((d) => ({
        prep_recipe_id: recipe.id,
        food_inventory_id: d.food_inventory_id,
        amount: d.amount,
        amount_unit: d.amount_unit,
        cost: ingredientCost(foodById.get(d.food_inventory_id), d.amount),
      }));
      const { error: ingErr } = await db.from("prep_ingredients").insert(rows);
      if (ingErr) toast.error(ingErr.message);
    }
    toast.success("Prep recipe created");
    setSaving(false);
    setOpen(false);
    resetForm();
    qc.invalidateQueries({ queryKey: ["prep_recipes"] });
    qc.invalidateQueries({ queryKey: ["prep_ingredients"] });
  }

  async function deleteRecipe(id: string) {
    if (!isOwner) return;
    const { error } = await db.from("prep_recipes").delete().eq("id", id);
    if (error) toast.error(error.message);
    else toast.success("Recipe deleted");
    qc.invalidateQueries({ queryKey: ["prep_recipes"] });
    qc.invalidateQueries({ queryKey: ["prep_ingredients"] });
  }

  // ---- File import (PDF / Excel / CSV / text) ----
  function fileToDataUrl(f: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(f);
    });
  }
  function fileToText(f: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsText(f);
    });
  }
  async function spreadsheetToText(f: File): Promise<string> {
    const { read, utils } = await import("xlsx");
    const buf = await f.arrayBuffer();
    const wb = read(buf, { type: "array" });
    return wb.SheetNames.map(
      (name) => `# Sheet: ${name}\n${utils.sheet_to_csv(wb.Sheets[name])}`,
    ).join("\n\n");
  }
  async function buildPayload(f: File) {
    const name = f.name.toLowerCase();
    const mime = f.type;
    if (/\.(xlsx|xls|ods)$/.test(name) || mime.includes("spreadsheet") || mime.includes("excel")) {
      return { textContent: await spreadsheetToText(f) };
    }
    if (mime.startsWith("text/") || /\.(txt|md|csv|tsv|json)$/.test(name)) {
      return { textContent: await fileToText(f) };
    }
    return { fileDataUrl: await fileToDataUrl(f), mimeType: mime, filename: f.name };
  }

  function toImportRecipe(r: ParsedPrepRecipe): ImportRecipe {
    const candidates = food.map((fi) => ({ id: fi.id, name: fi.name }));
    return {
      name: r.name,
      yield_amount: r.yield_amount,
      yield_unit: r.yield_unit,
      shelf_life_days: r.shelf_life_days,
      instructions: r.instructions,
      ingredients: r.ingredients.map((ing) => {
        const m = candidates.length
          ? bestMatch(ing.name, candidates)
          : { id: null, confidence: 0 };
        return {
          name: ing.name,
          amount: ing.amount,
          amount_unit: ing.amount_unit,
          food_inventory_id: m.confidence >= 60 && m.id ? m.id : "",
          confidence: m.confidence,
        };
      }),
    };
  }

  async function handleImportFile(f: File) {
    if (!isOwner) {
      toast.error("Only Owners can import prep recipes.");
      return;
    }
    setImporting(true);
    try {
      const payload = await buildPayload(f);
      const { recipes: parsed } = await runScan({ data: payload });
      if (!parsed.length) {
        toast.error("No recipes found in that file.");
        return;
      }
      setImported(parsed.map(toImportRecipe));
      setReviewOpen(true);
      toast.success(`Read ${parsed.length} recipe${parsed.length === 1 ? "" : "s"}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }

  async function saveImported() {
    if (!isOwner) return;
    setImporting(true);
    let saved = 0;
    for (const r of imported) {
      if (!r.name.trim()) continue;
      const { data: recipe, error } = await db
        .from("prep_recipes")
        .insert({
          name: r.name.trim(),
          yield_amount: r.yield_amount || 0,
          yield_unit: r.yield_unit || "ml",
          shelf_life_days: r.shelf_life_days,
          instructions: r.instructions.trim() || null,
        })
        .select()
        .single();
      if (error || !recipe) {
        toast.error(error?.message ?? "Could not save a recipe");
        continue;
      }
      const rows = r.ingredients
        .filter((i) => i.food_inventory_id)
        .map((i) => ({
          prep_recipe_id: recipe.id,
          food_inventory_id: i.food_inventory_id,
          amount: i.amount,
          amount_unit: i.amount_unit,
          cost: ingredientCost(foodById.get(i.food_inventory_id), i.amount),
        }));
      if (rows.length) {
        const { error: ingErr } = await db.from("prep_ingredients").insert(rows);
        if (ingErr) toast.error(ingErr.message);
      }
      saved++;
    }
    setImporting(false);
    setReviewOpen(false);
    setImported([]);
    if (saved) toast.success(`Saved ${saved} recipe${saved === 1 ? "" : "s"}`);
    qc.invalidateQueries({ queryKey: ["prep_recipes"] });
    qc.invalidateQueries({ queryKey: ["prep_ingredients"] });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight md:text-3xl">
            Prep Lab
          </h1>
          <p className="text-sm text-muted-foreground">
            {recipes.length} house-made batch{recipes.length === 1 ? "" : "es"}
          </p>
        </div>
        {isOwner && (
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" className="h-11 gap-2">
              <label className="cursor-pointer">
                {importing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                {importing ? "Reading…" : "Import PDF / Excel"}
                <input
                  type="file"
                  className="hidden"
                  accept="application/pdf,.pdf,.xlsx,.xls,.csv,.ods,.tsv,.txt,.md,image/*,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                  disabled={importing}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (f) handleImportFile(f);
                  }}
                />
              </label>
            </Button>
            <Button className="h-11 gap-2" onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" /> New Prep Recipe
            </Button>
          </div>
        )}
      </div>

      {recipes.length === 0 ? (
        <Card className="grid place-items-center gap-3 border-dashed border-border bg-card px-6 py-16 text-center">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-teal/15 text-teal">
            <FlaskConical className="h-6 w-6" />
          </div>
          <p className="text-sm text-muted-foreground">
            No prep recipes yet. Create batch syrups, infusions, and cordials
            from your food inventory.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {recipes.map((r) => {
            const ings = ingredientsByRecipe.get(r.id) ?? [];
            return (
              <Card key={r.id} className="border-border bg-card p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-lg font-bold">{r.name}</h2>
                    <p className="text-xs text-muted-foreground">
                      Yields {r.yield_amount} {r.yield_unit} ·{" "}
                      {r.shelf_life_days ?? "?"} day shelf life
                    </p>
                  </div>
                  {isOwner && (
                    <button
                      onClick={() => deleteRecipe(r.id)}
                      aria-label={`Delete ${r.name}`}
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-red/10 text-red hover:bg-red/20"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>

                <div className="mt-4 space-y-1.5 text-sm">
                  {ings.map((ing) => {
                    const f = foodById.get(ing.food_inventory_id ?? "");
                    return (
                      <div
                        key={ing.id}
                        className="flex items-center justify-between gap-2"
                      >
                        <span className="min-w-0 truncate">
                          {f?.name ?? "Unknown"} —{" "}
                          <span className="text-muted-foreground">
                            {ing.amount} {ing.amount_unit}
                          </span>
                        </span>
                        <span className="tabular-nums text-muted-foreground">
                          {eur(ing.cost)}
                        </span>
                      </div>
                    );
                  })}
                  {ings.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      No ingredients recorded.
                    </p>
                  )}
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-sm">
                  <span className="font-semibold">Total cost</span>
                  <span className="font-bold tabular-nums text-teal">
                    {eur(r.total_cost)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Cost per {r.yield_unit}</span>
                  <span className="tabular-nums">
                    {eur(r.cost_per_ml)}
                  </span>
                </div>

                {r.instructions && (
                  <p className="mt-3 whitespace-pre-wrap rounded-lg bg-secondary/50 p-3 text-xs text-muted-foreground">
                    {r.instructions}
                  </p>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Beaker className="h-5 w-5 text-teal" /> New Prep Recipe
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="prep-name">Name</Label>
              <Input
                id="prep-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="House Basil Syrup"
                className="h-11"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="prep-yield">Yield</Label>
                <Input
                  id="prep-yield"
                  type="number"
                  value={yieldAmount}
                  onChange={(e) => setYieldAmount(e.target.value)}
                  className="h-11"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Unit</Label>
                <Select value={yieldUnit} onValueChange={setYieldUnit}>
                  <SelectTrigger className="h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ml">ml</SelectItem>
                    <SelectItem value="batch">batch</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="prep-shelf">Shelf (days)</Label>
                <Input
                  id="prep-shelf"
                  type="number"
                  value={shelfLife}
                  onChange={(e) => setShelfLife(e.target.value)}
                  className="h-11"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Ingredients</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1"
                  onClick={addDraftRow}
                >
                  <Plus className="h-3.5 w-3.5" /> Add
                </Button>
              </div>
              {draft.map((d, idx) => {
                const f = foodById.get(d.food_inventory_id);
                return (
                  <div key={idx} className="flex items-center gap-2">
                    <Select
                      value={d.food_inventory_id}
                      onValueChange={(v) =>
                        setDraft((arr) =>
                          arr.map((x, i) =>
                            i === idx ? { ...x, food_inventory_id: v } : x,
                          ),
                        )
                      }
                    >
                      <SelectTrigger className="h-10 flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {food.map((fi) => (
                          <SelectItem key={fi.id} value={fi.id}>
                            {fi.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      value={d.amount}
                      onChange={(e) =>
                        setDraft((arr) =>
                          arr.map((x, i) =>
                            i === idx
                              ? { ...x, amount: Number(e.target.value) }
                              : x,
                          ),
                        )
                      }
                      className="h-10 w-20"
                    />
                    <Select
                      value={d.amount_unit}
                      onValueChange={(v) =>
                        setDraft((arr) =>
                          arr.map((x, i) =>
                            i === idx ? { ...x, amount_unit: v } : x,
                          ),
                        )
                      }
                    >
                      <SelectTrigger className="h-10 w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {UNITS.map((u) => (
                          <SelectItem key={u} value={u}>
                            {u}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <span className="w-16 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                      {eur(ingredientCost(f, d.amount))}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setDraft((arr) => arr.filter((_, i) => i !== idx))
                      }
                      aria-label="Remove ingredient"
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-red/10 text-red hover:bg-red/20"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
              {draft.length > 0 && (
                <div className="flex items-center justify-between border-t border-border pt-2 text-sm">
                  <span className="font-semibold">Total cost</span>
                  <span className="font-bold tabular-nums text-teal">
                    {eur(draftTotal)}
                  </span>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="prep-instr">Instructions</Label>
              <Textarea
                id="prep-instr"
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="Combine sugar and water, simmer, add basil, steep 20 min…"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setOpen(false);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button onClick={saveRecipe} disabled={saving}>
              {saving ? "Saving…" : "Save Recipe"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-teal" /> Review Imported Recipes
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            Match each ingredient to your ingredient database. Unmatched
            ingredients are skipped from cost. Confirm to save.
          </p>
          <div className="space-y-5">
            {imported.map((r, ri) => (
              <div key={ri} className="rounded-xl border border-border bg-card p-4">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
                  <Input
                    value={r.name}
                    onChange={(e) =>
                      setImported((arr) =>
                        arr.map((x, i) => (i === ri ? { ...x, name: e.target.value } : x)),
                      )
                    }
                    className="h-10 sm:col-span-2"
                    placeholder="Recipe name"
                  />
                  <Input
                    type="number"
                    value={r.yield_amount}
                    onChange={(e) =>
                      setImported((arr) =>
                        arr.map((x, i) =>
                          i === ri ? { ...x, yield_amount: Number(e.target.value) } : x,
                        ),
                      )
                    }
                    className="h-10"
                    placeholder="Yield"
                  />
                  <Input
                    value={r.yield_unit}
                    onChange={(e) =>
                      setImported((arr) =>
                        arr.map((x, i) => (i === ri ? { ...x, yield_unit: e.target.value } : x)),
                      )
                    }
                    className="h-10"
                    placeholder="Unit"
                  />
                </div>
                <div className="mt-3 space-y-2">
                  {r.ingredients.map((ing, ii) => (
                    <div key={ii} className="flex items-center gap-2">
                      <span className="min-w-0 flex-1 truncate text-sm">
                        {ing.name}{" "}
                        <span className="text-muted-foreground">
                          ({ing.amount} {ing.amount_unit})
                        </span>
                      </span>
                      <Select
                        value={ing.food_inventory_id || "none"}
                        onValueChange={(v) =>
                          setImported((arr) =>
                            arr.map((x, i) =>
                              i === ri
                                ? {
                                    ...x,
                                    ingredients: x.ingredients.map((y, j) =>
                                      j === ii
                                        ? { ...y, food_inventory_id: v === "none" ? "" : v }
                                        : y,
                                    ),
                                  }
                                : x,
                            ),
                          )
                        }
                      >
                        <SelectTrigger className="h-9 w-44">
                          <SelectValue placeholder="No match" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">— Skip —</SelectItem>
                          {food.map((fi) => (
                            <SelectItem key={fi.id} value={fi.id}>
                              {fi.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                  {r.ingredients.length === 0 && (
                    <p className="text-xs text-muted-foreground">No ingredients detected.</p>
                  )}
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setReviewOpen(false);
                setImported([]);
              }}
            >
              Cancel
            </Button>
            <Button onClick={saveImported} disabled={importing}>
              {importing ? "Saving…" : `Save ${imported.length} Recipe${imported.length === 1 ? "" : "s"}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}