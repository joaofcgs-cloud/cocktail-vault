import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { db, type Cocktail } from "@/lib/db";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { eur, num, marginColor } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/cocktails")({
  head: () => ({ meta: [{ title: "Cocktails — Bar Command Center" }] }),
  component: CocktailsPage,
});

function CocktailsPage() {
  const [sort, setSort] = useState<"margin" | "price" | "abv">("margin");

  const { data: cocktails = [] } = useQuery({
    queryKey: ["cocktails"],
    queryFn: async (): Promise<Cocktail[]> => {
      const { data, error } = await db.from("cocktails").select("*");
      if (error) throw error;
      return data;
    },
  });

  const sorted = [...cocktails].sort((a, b) =>
    sort === "margin"
      ? b.margin_percent - a.margin_percent
      : sort === "price"
        ? b.price - a.price
        : b.abv_percent - a.abv_percent,
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight md:text-3xl">
            Cocktails
          </h1>
          <p className="text-sm text-muted-foreground">
            {cocktails.length} signature drinks
          </p>
        </div>
        <Select value={sort} onValueChange={(v) => setSort(v as typeof sort)}>
          <SelectTrigger className="h-11 w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="margin">Sort by margin</SelectItem>
            <SelectItem value="price">Sort by price</SelectItem>
            <SelectItem value="abv">Sort by ABV</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sorted.map((c) => {
          const profit = c.price - c.est_cost;
          return (
            <Card
              key={c.id}
              className="flex flex-col border-border bg-card p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-lg font-black tracking-tight">
                  {c.name}
                </h2>
                <span className="shrink-0 text-2xl font-black text-teal">
                  {eur(c.price)}
                </span>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {c.specs}
              </p>

              <div className="mt-4">
                <div className="mb-1 flex items-baseline justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Margin
                  </span>
                  <span
                    className="text-sm font-bold"
                    style={{ color: marginColor(c.margin_percent) }}
                  >
                    {num(c.margin_percent)}%
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.min(c.margin_percent, 100)}%`,
                      backgroundColor: marginColor(c.margin_percent),
                    }}
                  />
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-border pt-4 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Est. cost</p>
                  <p className="font-semibold">{eur(c.est_cost)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">
                    Profit / drink
                  </p>
                  <p className="font-bold text-green">{eur(profit)}</p>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
