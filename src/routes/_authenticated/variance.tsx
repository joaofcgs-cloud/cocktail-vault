import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { db } from "@/lib/db";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Scale, UploadCloud, AlertTriangle } from "lucide-react";
import { num } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/variance")({
  head: () => ({ meta: [{ title: "Variance — Bar Command Center" }] }),
  component: VariancePage,
});

interface Row {
  product: string;
  expected: number;
  actual: number;
  discrepancy: number;
}

// Parse a Portuguese SAF-T (PT) XML file and aggregate quantity sold per product.
function parseSaft(text: string): Row[] {
  const doc = new DOMParser().parseFromString(text, "application/xml");
  if (doc.querySelector("parsererror")) return [];

  // Namespace-agnostic tag lookup (SAF-T files declare a default namespace).
  const localName = (el: Element, name: string) =>
    Array.from(el.children).filter(
      (c) => c.localName === name || c.nodeName === name,
    );
  const firstText = (el: Element, name: string) =>
    localName(el, name)[0]?.textContent?.trim() ?? "";

  // Optional product master list for nicer names (ProductCode -> Description).
  const nameByCode = new Map<string, string>();
  Array.from(doc.getElementsByTagName("*"))
    .filter((el) => el.localName === "Product")
    .forEach((p) => {
      const code = firstText(p, "ProductCode");
      const desc = firstText(p, "ProductDescription");
      if (code && desc) nameByCode.set(code, desc);
    });

  // Aggregate quantities across all sales-invoice lines.
  const totals = new Map<string, number>();
  const lines = Array.from(doc.getElementsByTagName("*")).filter(
    (el) => el.localName === "Line" && el.closest,
  );
  lines.forEach((line) => {
    // Only count lines that belong to SalesInvoices (skip stock movements etc.).
    let anc: Element | null = line.parentElement;
    let inSales = false;
    while (anc) {
      if (anc.localName === "SalesInvoices" || anc.localName === "Invoice") {
        inSales = true;
        break;
      }
      anc = anc.parentElement;
    }
    if (!inSales) return;

    const code = firstText(line, "ProductCode");
    const desc = firstText(line, "ProductDescription");
    const label = desc || nameByCode.get(code) || code || "Unknown";
    const qty = parseFloat(firstText(line, "Quantity")) || 0;
    if (!label || qty === 0) return;
    totals.set(label, (totals.get(label) ?? 0) + qty);
  });

  return Array.from(totals.entries()).map(([product, actual]) => ({
    product,
    expected: actual,
    actual,
    discrepancy: 0,
  }));
}

function parseCsv(text: string): Row[] {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const split = (l: string) =>
    l.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
  const headers = split(lines[0]).map((h) => h.toLowerCase());
  const find = (opts: string[]) =>
    headers.findIndex((h) => opts.some((o) => h.includes(o)));
  const pi = find(["product", "item", "name", "ingredient"]);
  const ei = find(["expected", "theoretical", "recipe"]);
  const ai = find(["actual", "used", "poured", "consumed", "sold", "qty", "quantity"]);
  const nameIdx = pi >= 0 ? pi : 0;
  const actualIdx = ai >= 0 ? ai : 1;

  return lines.slice(1).map((l) => {
    const cols = split(l);
    const product = cols[nameIdx] ?? "Unknown";
    const actual = parseFloat(cols[actualIdx]) || 0;
    const expected = ei >= 0 ? parseFloat(cols[ei]) || 0 : actual;
    const discrepancy =
      expected > 0 ? ((actual - expected) / expected) * 100 : 0;
    return { product, expected, actual, discrepancy };
  });
}

function VariancePage() {
  const { user, isOwner } = useAuth();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [fileName, setFileName] = useState("");

  async function handleFile(file: File) {
    if (!isOwner) {
      toast.error("Only Owners can run variance analysis.");
      return;
    }
    const text = await file.text();
    const isXml =
      /\.xml$/i.test(file.name) ||
      /^\s*<\?xml/.test(text) ||
      /<AuditFile/i.test(text);
    const parsed = isXml ? parseSaft(text) : parseCsv(text);
    if (parsed.length === 0) {
      toast.error("Couldn't read any rows from that file.");
      return;
    }
    setRows(parsed);
    setFileName(file.name);
    await db.from("sales_uploads").insert({
      file_name: file.name,
      parsed_data: parsed,
      status: "processed",
      created_by: user?.id,
    });
    toast.success(`Analyzed ${parsed.length} rows.`);
  }

  const flagged = (rows ?? []).filter((r) => Math.abs(r.discrepancy) > 10);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black tracking-tight md:text-3xl">
          Variance
        </h1>
        <p className="text-sm text-muted-foreground">
          Compare expected pours against real sales.
        </p>
      </div>

      {/* Upload area */}
      <label
        className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border bg-card px-6 py-12 text-center transition-colors hover:border-teal/50"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const f = e.dataTransfer.files?.[0];
          if (f) handleFile(f);
        }}
      >
        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-teal/15 text-teal">
          <UploadCloud className="h-7 w-7" />
        </div>
        <div>
          <p className="font-semibold">
            Upload your XD sales export to see variance analysis
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Drag & drop or tap to choose a CSV file
          </p>
        </div>
        <input
          type="file"
          accept=".csv,text/csv,.xlsx,application/vnd.ms-excel"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />
      </label>

      {!rows && (
        <Card className="flex items-center gap-3 border-border bg-card p-5 text-muted-foreground">
          <Scale className="h-5 w-5 shrink-0 text-teal" />
          <p className="text-sm">
            No analysis yet. Once you upload a sales export, expected vs actual
            usage, discrepancy % and flagged items appear here.
          </p>
        </Card>
      )}

      {rows && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Card className="border-border bg-card p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Rows analyzed
              </p>
              <p className="mt-1 text-2xl font-black">{rows.length}</p>
            </Card>
            <Card className="border-border bg-card p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Flagged items
              </p>
              <p className="mt-1 text-2xl font-black text-red">
                {flagged.length}
              </p>
            </Card>
            <Card className="col-span-2 border-border bg-card p-4 sm:col-span-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Source file
              </p>
              <p className="mt-1 truncate text-sm font-medium">{fileName}</p>
            </Card>
          </div>

          {flagged.length > 0 && (
            <Card className="border-red/30 bg-red/10 p-4">
              <div className="flex items-center gap-2 text-red">
                <AlertTriangle className="h-4 w-4" />
                <p className="text-sm font-bold">
                  {flagged.length} item(s) over 10% variance
                </p>
              </div>
            </Card>
          )}

          <Card className="border-border bg-card p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-3 font-semibold">Product</th>
                    <th className="px-4 py-3 text-right font-semibold">
                      Expected
                    </th>
                    <th className="px-4 py-3 text-right font-semibold">
                      Actual
                    </th>
                    <th className="px-4 py-3 text-right font-semibold">
                      Discrepancy
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, idx) => {
                    const flag = Math.abs(r.discrepancy) > 10;
                    return (
                      <tr
                        key={idx}
                        className="border-b border-border/60 last:border-0"
                      >
                        <td className="px-4 py-3 font-medium">{r.product}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                          {num(r.expected)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {num(r.actual)}
                        </td>
                        <td
                          className="px-4 py-3 text-right font-bold tabular-nums"
                          style={{
                            color: flag ? "var(--red)" : "var(--green)",
                          }}
                        >
                          {r.discrepancy > 0 ? "+" : ""}
                          {num(r.discrepancy)}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
