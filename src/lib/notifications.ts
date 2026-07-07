import { supabase } from "@/integrations/supabase/client";
import type { InventoryStatus } from "@/lib/db";

const db = supabase as any;

export interface AppNotification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  status: string;
  read: boolean;
  invoice_id: string | null;
  created_at: string;
}

export function statusEmoji(status: InventoryStatus | string): string {
  switch (status) {
    case "OUT":
      return "🔴";
    case "LOW":
      return "🟠";
    case "OK":
      return "🟡";
    default:
      return "🟢";
  }
}

export interface StockChange {
  name: string;
  qty: number;
  unit?: string;
  newStock: number;
  status: InventoryStatus | string;
}

export function buildStockMessage(args: {
  vendor: string;
  date?: string | null;
  total: number;
  changes: StockChange[];
}): string {
  const { vendor, date, total, changes } = args;
  const lines: string[] = [];
  lines.push(`📦 STOCK UPDATE — ${vendor}`);
  lines.push(`📅 ${date || new Date().toISOString().slice(0, 10)} | 💶 Total: €${total.toFixed(2)}`);
  lines.push("");
  lines.push("Items added:");
  for (const c of changes) {
    lines.push(
      `• ${c.name}: +${c.qty} ${c.unit ?? ""}→ Stock: ${c.newStock} ${statusEmoji(c.status)}`.replace(
        "  ",
        " ",
      ),
    );
  }
  const alerts = changes.filter((c) => c.status === "LOW" || c.status === "OUT");
  if (alerts.length) {
    lines.push("");
    lines.push("⚠️ Alerts:");
    for (const a of alerts) {
      lines.push(`${a.name} now ${a.status} (${a.newStock} units left)`);
    }
  }
  lines.push("");
  lines.push("— Imprensa Bar Command Center");
  return lines.join("\n");
}

export async function createStockNotification(args: {
  userId: string;
  vendor: string;
  date?: string | null;
  total: number;
  changes: StockChange[];
  invoiceId?: string | null;
}): Promise<void> {
  if (!args.changes.length) return;
  const message = buildStockMessage(args);
  await db.from("notifications").insert({
    user_id: args.userId,
    type: "in_app",
    title: `Stock updated — ${args.vendor}`,
    message,
    status: "sent",
    invoice_id: args.invoiceId ?? null,
  });
}
