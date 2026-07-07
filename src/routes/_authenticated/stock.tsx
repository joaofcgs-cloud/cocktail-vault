import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { db, type InventoryItem } from "@/lib/db";
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
import { eur, num, statusBadge } from "@/lib/format";
import { Search, Download, Plus, Minus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/stock")({
  head: () => ({ meta: [{ title: "Stock — Bar Command Center" }] }),
  component: StockPage,
});

function StockPage() {
  const qc = useQueryClient();
  const { isOwner } = useAuth();
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

  const categories = useMemo(
    () => Array.from(new Set(inv.map((i) => i.category))).sort(),
    [inv],
  );

  const filtered = inv.filter((i) => {
    const matchesSearch = i.name
      .toLowerCase()
      .includes(search.toLowerCase());
    const matchesCat = category === "all" || i.category === category;
    return matchesSearch && matchesCat;
  });

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

  function exportCsv() {
    const headers = [
      "Product",
      "Category",
      "Current",
      "Par",
      "Status",
      "Unit Cost",
      "Stock Value",
    ];
    const rows = filtered.map((i) => [
      i.name,
      i.category,
      i.current_stock,
      i.par_level,
      i.status,
      i.unit_cost.toFixed(2),
      (i.current_stock * i.unit_cost).toFixed(2),
    ]);
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
            {filtered.length} of {inv.length} products
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

      <Card className="border-border bg-card p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
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
              {filtered.map((i) => (
                <tr
                  key={i.id}
                  className="border-b border-border/60 last:border-0"
                >
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
              {filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-10 text-center text-muted-foreground"
                  >
                    No products match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
      {!isOwner && (
        <p className="text-xs text-muted-foreground">
          You're signed in as Staff — stock adjustments are Owner-only.
        </p>
      )}
    </div>
  );
}
