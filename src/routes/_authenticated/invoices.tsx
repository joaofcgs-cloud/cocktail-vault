import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { db, type Invoice } from "@/lib/db";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { eur } from "@/lib/format";
import { Plus, MessageSquare, ImageUp, Paperclip, ScanLine, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { scanReceipt } from "@/lib/receipt.functions";

export const Route = createFileRoute("/_authenticated/invoices")({
  head: () => ({ meta: [{ title: "Invoices — Bar Command Center" }] }),
  component: InvoicesPage,
});

function InvoicesPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [vendor, setVendor] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [total, setTotal] = useState("");
  const [items, setItems] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState(false);
  const runScan = useServerFn(scanReceipt);

  const { data: invoices = [] } = useQuery({
    queryKey: ["invoices"],
    queryFn: async (): Promise<Invoice[]> => {
      const { data, error } = await db
        .from("invoices")
        .select("*")
        .order("date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  function reset() {
    setVendor("");
    setDate(new Date().toISOString().slice(0, 10));
    setTotal("");
    setItems("");
    setFile(null);
  }

  async function submit() {
    if (!vendor.trim()) {
      toast.error("Vendor is required.");
      return;
    }
    setBusy(true);
    try {
      let receipt_url: string | null = null;
      if (file) {
        const path = `${user?.id}/${Date.now()}-${file.name}`;
        const { error: upErr } = await supabase.storage
          .from("receipts")
          .upload(path, file);
        if (upErr) throw upErr;
        receipt_url = path;
      }
      const { error } = await db.from("invoices").insert({
        vendor: vendor.trim(),
        date,
        total: parseFloat(total) || 0,
        items: items.trim() || null,
        receipt_url,
        created_by: user?.id,
      });
      if (error) throw error;
      toast.success("Invoice added.");
      qc.invalidateQueries({ queryKey: ["invoices"] });
      setOpen(false);
      reset();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add invoice");
    } finally {
      setBusy(false);
    }
  }

  async function openReceipt(path: string) {
    const { data, error } = await supabase.storage
      .from("receipts")
      .createSignedUrl(path, 60);
    if (error || !data) {
      toast.error("Could not open receipt.");
      return;
    }
    window.open(data.signedUrl, "_blank");
  }

  function fileToDataUrl(f: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(f);
    });
  }

  async function handleScan(f: File) {
    setScanning(true);
    try {
      const dataUrl = await fileToDataUrl(f);
      const parsed = await runScan({ data: { imageDataUrl: dataUrl } });
      setVendor(parsed.vendor || "");
      if (parsed.date) setDate(parsed.date);
      setTotal(String(parsed.grand_total || ""));
      setItems(
        parsed.items
          .map((it) => `${it.qty}× ${it.product} @ ${it.unit_price} = ${it.total}`)
          .join("\n"),
      );
      setFile(f);
      setOpen(true);
      toast.success("Receipt scanned — review and save.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Scan failed");
    } finally {
      setScanning(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight md:text-3xl">
            Invoices
          </h1>
          <p className="text-sm text-muted-foreground">
            {invoices.length} recorded
          </p>
        </div>
        <div className="flex gap-2">
        <label className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-md bg-teal px-4 text-sm font-semibold text-primary-foreground">
          {scanning ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ScanLine className="h-4 w-4" />
          )}
          {scanning ? "Scanning…" : "Scan Receipt"}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            disabled={scanning}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleScan(f);
              e.target.value = "";
            }}
          />
        </label>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="h-11 gap-2 font-semibold">
              <Plus className="h-4 w-4" /> Add Manual
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add Invoice</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="vendor">Vendor</Label>
                <Input
                  id="vendor"
                  value={vendor}
                  onChange={(e) => setVendor(e.target.value)}
                  placeholder="Supplier name"
                  className="h-11"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="date">Date</Label>
                  <Input
                    id="date"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="h-11"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="total">Total (€)</Label>
                  <Input
                    id="total"
                    type="number"
                    step="0.01"
                    value={total}
                    onChange={(e) => setTotal(e.target.value)}
                    placeholder="0.00"
                    className="h-11"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="items">Items</Label>
                <Textarea
                  id="items"
                  value={items}
                  onChange={(e) => setItems(e.target.value)}
                  placeholder="What was on this invoice…"
                  rows={3}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="receipt">Receipt photo (optional)</Label>
                <label className="flex h-11 cursor-pointer items-center gap-2 rounded-md border border-dashed border-border px-3 text-sm text-muted-foreground">
                  <ImageUp className="h-4 w-4" />
                  {file ? file.name : "Upload receipt photo"}
                  <input
                    id="receipt"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />
                </label>
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={submit}
                disabled={busy}
                className="h-11 w-full font-semibold"
              >
                {busy ? "Saving…" : "Save invoice"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Staff instruction box */}
      <Card className="border-teal/30 bg-teal/10 p-4">
        <div className="flex gap-3">
          <MessageSquare className="mt-0.5 h-5 w-5 shrink-0 text-teal" />
          <div className="text-sm">
            <p className="font-bold text-teal">Tell staff</p>
            <p className="text-foreground/90">
              Snap receipt photo → send to WhatsApp group → manager forwards to
              admin.
            </p>
          </div>
        </div>
      </Card>

      <Card className="border-border bg-card p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3 font-semibold">Vendor</th>
                <th className="px-4 py-3 font-semibold">Date</th>
                <th className="px-4 py-3 text-right font-semibold">Total</th>
                <th className="px-4 py-3 font-semibold">Items</th>
                <th className="px-4 py-3 font-semibold">Receipt</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr
                  key={inv.id}
                  className="border-b border-border/60 last:border-0"
                >
                  <td className="px-4 py-3 font-medium">{inv.vendor}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {inv.date ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">
                    {eur(inv.total)}
                  </td>
                  <td className="max-w-[280px] px-4 py-3 text-muted-foreground">
                    <span className="line-clamp-2">{inv.items ?? "—"}</span>
                  </td>
                  <td className="px-4 py-3">
                    {inv.receipt_url ? (
                      <button
                        onClick={() => openReceipt(inv.receipt_url!)}
                        className="inline-flex items-center gap-1 text-teal hover:underline"
                      >
                        <Paperclip className="h-4 w-4" /> View
                      </button>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))}
              {invoices.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-10 text-center text-muted-foreground"
                  >
                    No invoices yet. Add your first one.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
