import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ManualLineItem } from "@/lib/work-order-intake-v2";

const db = supabase as any;

function asError(error: unknown, fallback: string) {
  if (error instanceof Error) return error;
  if (error && typeof error === "object" && "message" in error) return new Error(String((error as any).message ?? fallback));
  return new Error(fallback);
}

export type QuoteCreatePayload = {
  customer: Record<string, unknown>;
  vehicle: Record<string, unknown>;
  quote: { valid_until?: string; notes?: string; discount?: number };
  parts: ManualLineItem[];
  labor: ManualLineItem[];
};

export function useQuotes() {
  return useQuery({
    queryKey: ["quotes"],
    queryFn: async () => {
      const { data, error } = await db.from("quotes")
        .select("*, customers(*), vehicles(*), quote_items(*)")
        .order("created_at", { ascending: false });
      if (error) throw asError(error, "Não foi possível carregar os orçamentos.");
      return data ?? [];
    },
  });
}

export async function createQuote(payload: QuoteCreatePayload) {
  const { data, error } = await db.rpc("create_quote_v2", {
    p_customer: payload.customer,
    p_vehicle: payload.vehicle,
    p_quote: payload.quote,
    p_parts: payload.parts.filter((item) => item.description.trim()),
    p_labor: payload.labor.filter((item) => item.description.trim()),
  });
  if (error) throw asError(error, "Não foi possível criar o orçamento.");
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.quote_id) throw new Error("O orçamento foi criado, mas o retorno ficou incompleto.");
  return { id: String(row.quote_id), quoteNumber: Number(row.quote_number), total: Number(row.total ?? 0) };
}

export async function updateQuoteStatus(id: string, status: "rascunho" | "enviado" | "aprovado" | "recusado" | "cancelado") {
  const values: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  if (status === "aprovado") values["approved_at"] = new Date().toISOString();
  const { error } = await db.from("quotes").update(values).eq("id", id);
  if (error) throw asError(error, "Não foi possível atualizar o orçamento.");
}

export async function convertQuoteToWorkOrder(id: string) {
  const { data, error } = await db.rpc("convert_quote_to_work_order_v2", { p_quote_id: id });
  if (error) throw asError(error, "Não foi possível transformar o orçamento em OS. Confira o saldo das peças de estoque.");
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.work_order_id) throw new Error("A OS foi criada, mas o retorno ficou incompleto.");
  return { id: String(row.work_order_id), orderNumber: Number(row.order_number) };
}

export function quoteWhatsAppMessage(quote: any) {
  const customer = quote.customers ?? {};
  const vehicle = quote.vehicles ?? {};
  const parts = (quote.quote_items ?? []).filter((item: any) => item.item_type === "part");
  const labor = (quote.quote_items ?? []).filter((item: any) => item.item_type === "service");
  const brl = (value: unknown) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value ?? 0));
  const lines = [
    `Olá, ${customer.name ?? "cliente"}!`, "",
    `Segue o Orçamento #${quote.quote_number} da COMPACT Centro Automotivo.`,
    `Veículo: ${[vehicle.brand, vehicle.model].filter(Boolean).join(" ")} • ${vehicle.plate ?? ""}`, "",
  ];
  if (parts.length) {
    lines.push("Peças");
    parts.forEach((item: any) => lines.push(`• ${item.description} — ${brl(Number(item.quantity) * Number(item.unit_price))}`));
    lines.push("");
  }
  if (labor.length) {
    lines.push("Mão de obra");
    labor.forEach((item: any) => lines.push(`• ${item.description} — ${brl(Number(item.quantity) * Number(item.unit_price))}`));
    lines.push("");
  }
  if (Number(quote.discount ?? 0) > 0) lines.push(`Desconto: ${brl(quote.discount)}`);
  lines.push(`TOTAL: ${brl(quote.total)}`);
  if (quote.valid_until) lines.push(`Validade: ${new Date(`${quote.valid_until}T12:00:00`).toLocaleDateString("pt-BR")}`);
  lines.push("", "Após sua aprovação, transformamos este orçamento em Ordem de Serviço.", "", "COMPACT Centro Automotivo");
  return lines.join("\n");
}

export function openQuoteWhatsApp(quote: any) {
  const phone = String(quote.customers?.phone ?? "").replace(/\D/g, "");
  if (!phone) throw new Error("Cliente sem WhatsApp cadastrado.");
  const normalized = phone.startsWith("55") ? phone : `55${phone}`;
  window.open(`https://wa.me/${normalized}?text=${encodeURIComponent(quoteWhatsAppMessage(quote))}`, "_blank", "noopener,noreferrer");
}
