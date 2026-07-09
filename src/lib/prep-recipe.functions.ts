import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({
  fileDataUrl: z.string().min(1).max(25_000_000).optional(),
  mimeType: z.string().optional(),
  filename: z.string().optional(),
  textContent: z.string().max(2_000_000).optional(),
});

export interface ParsedPrepIngredient {
  name: string;
  amount: number;
  amount_unit: string;
}

export interface ParsedPrepRecipe {
  name: string;
  yield_amount: number;
  yield_unit: string;
  shelf_life_days: number | null;
  instructions: string;
  ingredients: ParsedPrepIngredient[];
}

export const scanPrepRecipes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => Input.parse(data))
  .handler(async ({ data }): Promise<{ recipes: ParsedPrepRecipe[] }> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI is not configured.");

    const instruction = [
      "Extract every prep/batch recipe from this document (syrups, cordials, infusions, purees, mixes, garnishes, batches).",
      "A document may contain one or many recipes.",
      "For each recipe extract: name, yield_amount (numeric batch yield), yield_unit (e.g. ml, batch, g), shelf_life_days (number of days it keeps, null if unknown), instructions (method text), and ingredients.",
      "For each ingredient extract: name (the ingredient/product name only, no quantity), amount (numeric), amount_unit (one of: gram, ml, leaf, slice, piece, dash, drop, Un).",
      "Normalise European decimals (comma) to a dot. If a quantity is given in kg or L convert to gram or ml.",
      'Return ONLY this JSON: {"recipes":[{"name":"","yield_amount":0,"yield_unit":"ml","shelf_life_days":null,"instructions":"","ingredients":[{"name":"","amount":0,"amount_unit":"gram"}]}]}',
    ].join("\n");

    const userContent: unknown[] = [{ type: "text", text: instruction }];
    if (data.textContent && data.textContent.trim()) {
      userContent.push({
        type: "text",
        text: `Here is the document content:\n\n${data.textContent}`,
      });
    } else if (data.fileDataUrl) {
      const mime = data.mimeType ?? "";
      if (mime.startsWith("image/")) {
        userContent.push({ type: "image_url", image_url: { url: data.fileDataUrl } });
      } else {
        userContent.push({
          type: "file",
          file: { filename: data.filename || "recipes.pdf", file_data: data.fileDataUrl },
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
            content: "You are a recipe parser. Return ONLY valid JSON, no markdown fences.",
          },
          { role: "user", content: userContent },
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

    let parsed: { recipes?: ParsedPrepRecipe[] };
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error("Could not read the recipes from this file.");
    }

    const recipes = Array.isArray(parsed.recipes)
      ? parsed.recipes.map((r) => ({
          name: r.name ?? "",
          yield_amount: Number(r.yield_amount) || 0,
          yield_unit: r.yield_unit || "ml",
          shelf_life_days:
            r.shelf_life_days === null || r.shelf_life_days === undefined
              ? null
              : Number(r.shelf_life_days) || null,
          instructions: r.instructions ?? "",
          ingredients: Array.isArray(r.ingredients)
            ? r.ingredients.map((i) => ({
                name: i.name ?? "",
                amount: Number(i.amount) || 0,
                amount_unit: i.amount_unit || "gram",
              }))
            : [],
        }))
      : [];

    return { recipes };
  });
