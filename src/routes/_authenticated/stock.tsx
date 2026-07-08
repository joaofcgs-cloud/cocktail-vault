import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { db, type InventoryItem, type FoodItem } from "@/lib/db";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { eur, num, statusBadge, foodStatusBadge } from "@/lib/format";
import { Search, Download, Plus, Minus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/stock")({
  head: () => ({ meta: [{ title: "Stock — Bar Command Center" }] }),
  component: StockPage,
});

type Tab = "spirits" | "food" | "all";

function daysUntil(date: string | null): number | null {
  if (!date) return null;
  const d = new Date(date);
  const now = new Date();
  d.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - now.getTime()) / 86400000);
}

function expiryLabel(date: string | null): string {
  const d = daysUntil(date);
  if (d === null) return "—";
  if (d < 0) return "Expired";
  if (d === 0) return "Today";
  return `${d} day${d === 1 ? "" : "s"}`;
}

function StockPage() {
  const qc = useQueryClient();
  const { isOwner } = useAuth();
  const [tab, setTab] = useState<Tab>("spirits");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");

  const { data: inv = [] } = useQuery({
    queryKey: ["inventory"],
    queryFn: async (): Promise<InventoryItem[]> => {
      const { data, error } = await db
        .from("inventory")
        .select("*")
        .order("name");
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

  const categories = useMemo(() => {
    const src =
      tab === "spirits"
        ? inv.map((i) => i.category)
        : tab === "food"
          ? food.map((f) => f.category)
          : [...inv.map((i) => i.category), ...food.map((f) => f.category)];
    return Array.from(new Set(src)).sort();
  }, [tab, inv, food]);

  // reset category filter when switching tabs
  function switchTab(next: Tab) {
    setTab(next);
    setCategory("all");
  }

  const showSpirits = tab === "spirits" || tab === "all";
  const showFood = tab === "food" || tab === "all";

  const filteredInv = inv.filter((i) => {
    if (!showSpirits) return false;
    const matchesSearch = i.name.toLowerCase().includes(search.toLowerCase());
    const matchesCat = category === "all" || i.category === category;
    return matchesSearch && matchesCat;
  });
  const filteredFood = food.filter((f) => {
    if (!showFood) return false;
    const matchesSearch = f.name.toLowerCase().includes(search.toLowerCase());
    const matchesCat = category === "all" || f.category === category;
    return matchesSearch && matchesCat;
  });
  const totalCount = inv.length + food.length;
  const shownCount = filteredInv.length + filteredFood.length;

  async function adjust(item: InventoryItem, delta: number) {
    if (!isOwner) {
      toast.error("Only Owners can adjust stock.");
      return;
    }
    const next = Math.max(0, +(item.current_stock + delta).toFixed(2));
    // optimistic
    qc.setQueryData<InventoryItem[]>(["inventory"], (old) =>
      (old ?? []).map((i) =>
        i.id === item.id ? { ...i, current_stock: next } : i,
      ),
    );
    const { error } = await db
      .from("inventory")
      .update({ current_stock: next })
      .eq("id", item.id);
    if (error) {
      toast.error(error.message);
      qc.invalidateQueries({ queryKey: ["inventory"] });
    } else {
      qc.invalidateQueries({ queryKey: ["inventory"] });
    }
  }

  async function adjustFood(item: FoodItem, delta: number) {
    if (!isOwner) {
      toast.error("Only Owners can adjust stock.");
      return;
    }
    const next = Math.max(0, +(item.current_stock + delta).toFixed(2));
    qc.setQueryData<FoodItem[]>(["food_inventory"], (old) =>
      (old ?? []).map((f) =>
        f.id === item.id ? { ...f, current_stock: next } : f,
      ),
    );
    const { error } = await db
      .from("food_inventory")
      .update({ current_stock: next })
      .eq("id", item.id);
    if (error) toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["food_inventory"] });
  }

  function exportCsv() {
    const headers = [
      "Type",
      "Product",
      "Category",
      "Current",
      "Unit",
      "Par",
      "Status",
      "Unit Cost",
      "Stock Value",
    ];
    const rows: (string | number)[][] = [];
    if (showSpirits)
      filteredInv.forEach((i) =>
        rows.push([
          "Spirit",
          i.name,
          i.category,
          i.current_stock,
          "bottle",
          i.par_level,
          i.status,
          i.unit_cost.toFixed(2),
          (i.current_stock * i.unit_cost).toFixed(2),
        ]),
      );
    if (showFood)
      filteredFood.forEach((f) =>
        rows.push([
          "Food",
          f.name,
          f.category,
          f.current_stock,
          f.unit_type,
          f.par_level,
          f.status,
          f.unit_cost.toFixed(2),
          (f.current_stock * f.unit_cost).toFixed(2),
        ]),
      );
    const csv = [headers, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `stock-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight md:text-3xl">
            Stock
          </h1>
          <p className="text-sm text-muted-foreground">
            {shownCount} of {totalCount} products
          </p>
        </div>
        <Button
          variant="outline"
          onClick={exportCsv}
          className="h-11 gap-2"
        >
          <Download className="h-4 w-4" /> Export CSV
        </Button>
      </div>

      {/* Toggle tabs */}
      <div className="grid w-full grid-cols-3 gap-1 rounded-lg bg-secondary p-1 sm:w-72">
        {(["spirits", "food", "all"] as const).map((t) => (
          <button
            key={t}
            onClick={() => switchTab(t)}
            className={`h-9 rounded-md text-sm font-semibold capitalize transition-colors ${
              tab === t
                ? "bg-card text-foreground shadow"
                : "text-muted-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products…"
            className="h-11 pl-9"
          />
        </div>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="h-11 sm:w-56">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {showSpirits && (
      <Card className="border-border bg-card p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                {tab === "all" && (
                  <th className="px-4 py-3 font-semibold">Type</th>
                )}
                <th className="px-4 py-3 font-semibold">Product</th>
                <th className="px-4 py-3 font-semibold">Category</th>
                <th className="px-4 py-3 text-right font-semibold">Current</th>
                <th className="px-4 py-3 text-right font-semibold">Par</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 text-right font-semibold">Cost</th>
                <th className="px-4 py-3 text-center font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredInv.map((i) => (
                <tr
                  key={i.id}
                  className="border-b border-border/60 last:border-0"
                >
                  {tab === "all" && (
                    <td className="px-4 py-3">🍸</td>
                  )}
                  <td className="px-4 py-3 font-medium">{i.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {i.category}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {num(i.current_stock)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                    {i.par_level}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusBadge[i.status]}`}
                    >
                      {i.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                    {eur(i.unit_cost)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => adjust(i, -0.5)}
                        aria-label={`Decrease ${i.name}`}
                        className="grid h-11 w-11 place-items-center rounded-lg bg-red/15 text-red transition-colors hover:bg-red/25"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => adjust(i, 0.5)}
                        aria-label={`Increase ${i.name}`}
                        className="grid h-11 w-11 place-items-center rounded-lg bg-green/15 text-green transition-colors hover:bg-green/25"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredInv.length === 0 && (
                <tr>
                  <td
                    colSpan={tab === "all" ? 8 : 7}
                    className="px-4 py-10 text-center text-muted-foreground"
                  >
                    No spirits match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
      )}

      {showFood && (
        <Card className="border-border bg-card p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  {tab === "all" && (
                    <th className="px-4 py-3 font-semibold">Type</th>
                  )}
                  <th className="px-4 py-3 font-semibold">Product</th>
                  <th className="px-4 py-3 font-semibold">Category</th>
                  <th className="px-4 py-3 text-right font-semibold">Stock</th>
                  <th className="px-4 py-3 font-semibold">Unit</th>
                  <th className="px-4 py-3 text-right font-semibold">Par</th>
                  <th className="px-4 py-3 text-right font-semibold">Cost</th>
                  <th className="px-4 py-3 font-semibold">Expiry</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 text-center font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredFood.map((f) => (
                  <tr
                    key={f.id}
                    className="border-b border-border/60 last:border-0"
                  >
                    {tab === "all" && <td className="px-4 py-3">🌿</td>}
                    <td className="px-4 py-3 font-medium">{f.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {f.category}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {num(f.current_stock, 2)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {f.unit_type}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                      {f.par_level}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                      {eur(f.unit_cost)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {expiryLabel(f.expiry_date)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-bold ${foodStatusBadge[f.status]}`}
                      >
                        {f.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => adjustFood(f, -0.5)}
                          aria-label={`Decrease ${f.name}`}
                          className="grid h-11 w-11 place-items-center rounded-lg bg-red/15 text-red transition-colors hover:bg-red/25"
                        >
                          <Minus className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => adjustFood(f, 0.5)}
                          aria-label={`Increase ${f.name}`}
                          className="grid h-11 w-11 place-items-center rounded-lg bg-green/15 text-green transition-colors hover:bg-green/25"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredFood.length === 0 && (
                  <tr>
                    <td
                      colSpan={tab === "all" ? 10 : 9}
                      className="px-4 py-10 text-center text-muted-foreground"
                    >
                      No food items yet. Add them below or upload an invoice.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {!isOwner && (
        <p className="text-xs text-muted-foreground">
          You're signed in as Staff — stock adjustments are Owner-only.
        </p>
      )}
    </div>
  );
}
