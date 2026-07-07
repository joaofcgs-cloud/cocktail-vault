import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({
  fileDataUrl: z.string().min(1).max(20_000_000),
  mimeType: z.string().min(1),
  fileName: z.string().default("payslip"),
});

export interface ParsedPayrollEmployee {
  name: string;
  nif: string;
  role: string;
  base_salary: number;
  hourly_rate: number;
  base_pay: number;
  meal_subsidy: number;
  tips: number;
  gross_pay: number;
  irs: number;
  social_security: number;
  net_pay: number;
  days_worked: number;
  hours_worked: number;
}

export interface ParsedPayroll {
  month: number;
  year: number;
  employees: ParsedPayrollEmployee[];
}

const INSTRUCTIONS = `You are a Portuguese payroll ("recibo de vencimento") parser.
The document may contain MULTIPLE employees (one payslip each). Extract every employee.
For each employee map these Portuguese fields to JSON:
- name: "Nome"
- nif: "Nº Contribuinte"
- role: "Categoria/Profissão"
- base_salary: "Vencimento" (monthly gross base salary)
- hourly_rate: "Salário Hora"
- base_pay: "Vencimento Base" amount under ABONOS
- meal_subsidy: "Subs. Alimentação" amount under ABONOS
- tips: "Gratificacoes ... (gorjetas)" amount under ABONOS (0 if absent)
- gross_pay: "Total Abonos"
- irs: total IRS amount under DESCONTOS
- social_security: "Segurança Social" amount under DESCONTOS
- net_pay: "Total a Receber"
- days_worked: "Dias do Mês" (0 if absent)
- hours_worked: "Horas Semana" (0 if absent)
Also extract the payslip month (1-12) and year from "De ... 2026".
All money values are numbers only (strip € and thousands separators; use a dot for decimals).
Return ONLY valid JSON, no markdown fences, exactly:
{"month":0,"year":0,"employees":[{"name":"","nif":"","role":"","base_salary":0,"hourly_rate":0,"base_pay":0,"meal_subsidy":0,"tips":0,"gross_pay":0,"irs":0,"social_security":0,"net_pay":0,"days_worked":0,"hours_worked":0}]}`;

export const scanPayroll = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => Input.parse(data))
  .handler(async ({ data }): Promise<ParsedPayroll> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI is not configured.");

    const isPdf = data.mimeType === "application/pdf";
    const userContent = isPdf
      ? [
          { type: "text", text: INSTRUCTIONS },
          {
            type: "file",
            file: { filename: data.fileName, file_data: data.fileDataUrl },
          },
        ]
      : [
          { type: "text", text: INSTRUCTIONS },
          { type: "image_url", image_url: { url: data.fileDataUrl } },
        ];

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          {
            role: "system",
            content: "You extract structured payroll data. Return ONLY valid JSON.",
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

    let parsed: ParsedPayroll;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error("Could not read the payslip. Try a clearer file.");
    }

    const now = new Date();
    const num = (v: unknown) => Number(v) || 0;
    return {
      month: num(parsed.month) || now.getMonth() + 1,
      year: num(parsed.year) || now.getFullYear(),
      employees: Array.isArray(parsed.employees)
        ? parsed.employees.map((e) => ({
            name: String(e.name ?? "").trim(),
            nif: String(e.nif ?? "").trim(),
            role: String(e.role ?? "").trim(),
            base_salary: num(e.base_salary),
            hourly_rate: num(e.hourly_rate),
            base_pay: num(e.base_pay),
            meal_subsidy: num(e.meal_subsidy),
            tips: num(e.tips),
            gross_pay: num(e.gross_pay),
            irs: num(e.irs),
            social_security: num(e.social_security),
            net_pay: num(e.net_pay),
            days_worked: num(e.days_worked),
            hours_worked: num(e.hours_worked),
          }))
        : [],
    };
  });
