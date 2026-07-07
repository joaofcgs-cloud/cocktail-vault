import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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
}

export const scanReceipt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => Input.parse(data))
  .handler(async ({ data }): Promise<ParsedReceipt> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI is not configured.");

    const instruction =
      'Extract from this invoice/receipt: vendor, date (YYYY-MM-DD), line items with product, qty, unit price, total. Return JSON exactly: {"vendor":"","date":"","items":[{"product":"","qty":0,"unit_price":0,"total":0}],"grand_total":0}';

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
    };
  });
