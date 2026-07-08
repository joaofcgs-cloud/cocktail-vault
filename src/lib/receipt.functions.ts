import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { CATEGORY_TREE } from "@/lib/categories";

const CATEGORY_GUIDE = Object.entries(CATEGORY_TREE)
  .map(([cat, subs]) => `- ${cat}: ${subs.join(", ")}`)
  .join("\n");

const Input = z.object({
  // Image or PDF as a data URL (data:<mime>;base64,...)
  fileDataUrl: z.string().min(1).max(25_000_000).optional(),
  mimeType: z.string().optional(),
  filename: z.string().optional(),
  // Extracted plain-text content (spreadsheets, CSV, text files)
  textContent: z.string().max(2_000_000).optional(),
});

export interface ParsedReceipt {
  vendor: string;
  date: string;
  items: { product: string; qty: number; unit_price: number; total: number }[];
  grand_total: number;
  category: string;
  subcategory: string;
}

export const scanReceipt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => Input.parse(data))
  .handler(async ({ data }): Promise<ParsedReceipt> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI is not configured.");

    const instruction =
      [
        "Extract structured data from this invoice/receipt.",
        "vendor: the SUPPLIER / seller who ISSUED the invoice (the company whose name and tax number head the document, near the logo or 'Fatura'), NOT the customer/buyer/recipient (do not use fields labelled Cliente, Adquirente, Local de descarga, or the ship-to company).",
        "date: the issue date (Data Emissão) in YYYY-MM-DD.",
        "For each purchased line item: product name, qty (quantity), unit_price (net unit price), total (line total).",
        "Skip items whose quantity is 0 (they are catalogue/price-list rows, not purchases).",
        "Numbers may use a comma as the decimal separator and a dot/space as thousands separator (European format) — normalise them to plain decimals with a dot.",
        "grand_total: the final payable TOTAL of the invoice (the 'TOTAL' including tax), as a number.",
        "Classify the whole invoice into ONE category and ONE subcategory from this taxonomy (use the exact spelling), based on the vendor and the line items:",
        CATEGORY_GUIDE,
        "category: the best-fitting top-level category. subcategory: the best-fitting subcategory within that category. If unsure, pick the closest match.",
        'Return ONLY this JSON: {"vendor":"","date":"","items":[{"product":"","qty":0,"unit_price":0,"total":0}],"grand_total":0,"category":"","subcategory":""}',
      ].join("\n");

    const userContent: unknown[] = [{ type: "text", text: instruction }];
    if (data.textContent && data.textContent.trim()) {
      userContent.push({
        type: "text",
        text: `Here is the invoice content:\n\n${data.textContent}`,
      });
    } else if (data.fileDataUrl) {
      const mime = data.mimeType ?? "";
      if (mime.startsWith("image/")) {
        userContent.push({ type: "image_url", image_url: { url: data.fileDataUrl } });
      } else {
        userContent.push({
          type: "file",
          file: {
            filename: data.filename || "invoice.pdf",
            file_data: data.fileDataUrl,
          },
        });
      }
    } else {
      throw new Error("No file content provided.");
    }

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "You are a receipt parser. Return ONLY valid JSON, no markdown fences.",
          },
          {
            role: "user",
            content: userContent,
          },
        ],
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      if (res.status === 429) throw new Error("AI rate limit — try again shortly.");
      if (res.status === 402) throw new Error("AI credits exhausted.");
      throw new Error(`AI request failed [${res.status}]: ${body}`);
    }

    const json = await res.json();
    let text: string = json?.choices?.[0]?.message?.content ?? "";
    text = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();

    let parsed: ParsedReceipt;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error("Could not read the receipt. Try a clearer photo.");
    }
    return {
      vendor: parsed.vendor ?? "",
      date: parsed.date ?? new Date().toISOString().slice(0, 10),
      items: Array.isArray(parsed.items) ? parsed.items : [],
      grand_total: Number(parsed.grand_total) || 0,
      category: parsed.category ?? "",
      subcategory: parsed.subcategory ?? "",
    };
  });
