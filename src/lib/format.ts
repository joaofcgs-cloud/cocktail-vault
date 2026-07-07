import type { InventoryStatus } from "@/lib/db";

export const eur = (n: number) =>
  new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
  }).format(n || 0);

export const num = (n: number, d = 1) =>
  (n ?? 0).toLocaleString("en-IE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: d,
  });

// Tailwind text/border/bg helpers keyed to status
export const statusColor: Record<InventoryStatus, string> = {
  OUT: "text-red",
  LOW: "text-orange",
  OK: "text-teal",
  GOOD: "text-green",
};

export const statusBadge: Record<InventoryStatus, string> = {
  OUT: "bg-red/15 text-red",
  LOW: "bg-orange/15 text-orange",
  OK: "bg-teal/15 text-teal",
  GOOD: "bg-green/15 text-green",
};

// margin color thresholds
export function marginColor(m: number): string {
  if (m >= 78) return "var(--green)";
  if (m >= 74) return "var(--teal)";
  if (m >= 70) return "var(--orange)";
  return "var(--red)";
}
