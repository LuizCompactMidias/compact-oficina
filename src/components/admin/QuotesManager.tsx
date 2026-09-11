import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, FileText, Loader2, MessageCircle, Plus, ReceiptText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ManualItemsEditor } from "@/components/admin/ManualItemsEditor";
import { createQuote, convertQuoteToWorkOrder, openQuoteWhatsApp, updateQuoteStatus, useQuotes } from "@/lib/quote-operations";
import { money, useCustomers } from "@/lib/porfirid-queries";
import type { ManualLineItem } from "@/lib/work-order-intake-v2";

const db = supabase as any;
const blankLine = (): ManualLineItem => ({ description: "", quantity: 1, unit_price: 0 });
const statusLabel: Record<string, string> = { rascunho: "Rascunho", enviado: "Enviado", aprovado: "Aprovado", recusado: "Recusado", convertido: "Convertido em OS", cancelado: "Cancelado" };

export function QuotesManager({ onOpenOrder }: { onOpenOrder: (id: string) => void }) {
  const queryClient = useQueryClient();
  const { data: quotes = [], isLoading } = useQuotes();
  const { data: customers = [] } = useCustomers();
  const { data: vehicles = [] } = useQuery({
    queryKey: ["quote_vehicle_options"],
    queryFn: async () => {
      const { data, error } = await db.from("vehicles").select("id,customer_id,plate,brand,model").order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  const [showForm, setShowForm] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [parts, setParts] = useState<ManualLineItem[]>([blankLine()]);
  const [labor, setLabor] = useState<ManualLineItem[]>([blankLine()]);
  const [discount, setDiscount] = useState(0);
  const [validUntil, setValidUntil] = useState("");
  const [notes, setNotes] = useState("");
  const [working, setWorking] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const customerVehicles = useMemo(() => vehicles.filter((v: any) => v.customer_id === customerId), [vehicles, customerId]);
  const total = Math.max([...parts, ...labor].reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unit_price || 0), 0) - discount, 0);

  async function refresh() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["quotes"] }),
      queryClient.invalidateQueries({ queryKey: ["work_orders"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
    ]);
  }

  async function submit() {
    setError(null); setMessage(null);
    if (!customerId || !vehicleId) return setError("Selecione cliente e veículo.");
    if (![...parts, ...labor].some((i) => i.description.trim())) return setError("Informe pelo menos uma peça ou mão de obra.");
    setWorking("create");
    try {
      const result = await createQuote({ customer: { id: customerId }, vehicle: { id: vehicleId }, quote: { valid_until: validUntil, notes, discount }, parts, labor });
      await refresh();
      setMessage(`Orçamento #${result.quoteNumber} criado em ${money(result.total)}.`);
      setShowForm(false); setParts([blankLine()]); setLabor([blankLine()]); setDiscount(0); setNotes(""); setValidUntil("");
    } catch (e) { setError(e instanceof Error ? e.message : "Erro ao criar orçamento."); }
    finally { setWorking(null); }
  }

  async function convert(q: any) {
    if (!window.confirm(`Transformar o orçamento #${q.quote_number} em Ordem de Serviço?`)) return;
    setWorking(`convert-${q.id}`); setError(null);
    try { const result = await convertQuoteToWorkOrder(q.id); await refresh(); setMessage(`Convertido em OS #${result.orderNumber}.`); onOpenOrder(result.id); }
    catch (e) { setError(e instanceof Error ? e.message : "Erro na conversão."); }
    finally { setWorking(null); }
  }

  function printQuote(q: any) {
    const items = q.quote_items ?? [];
    const win = window.open("", "_blank", "width=900,height=800");
    if (!win) return;
    win.document.write(`<html><head><title>Orçamento #${q.quote_number}</title><style>body{font-family:Arial;padding:32px;color:#111}h1{margin:0}table{width:100%;border-collapse:collapse;margin-top:24px}td,th{padding:10px;border-bottom:1px solid #ddd;text-align:left}.total{font-size:24px;font-weight:800;margin-top:24px}</style></head><body><h1>COMPACT Centro Automotivo</h1><p>Orçamento #${q.quote_number}</p><p><strong>${q.customers?.name ?? "Cliente"}</strong><br>${q.vehicles?.brand ?? ""} ${q.vehicles?.model ?? ""} • ${q.vehicles?.plate ?? ""}</p><table><thead><tr><th>Item</th><th>Qtd.</th><th>Unit.</th><th>Total</th></tr></thead><tbody>${items.map((i:any)=>`<tr><td>${i.description}</td><td>${i.quantity}</td><td>${money(i.unit_price)}</td><td>${money(Number(i.quantity)*Number(i.unit_price))}</td></tr>`).join("")}</tbody></table><p class="total">Total: ${money(q.total)}</p><script>window.onload=()=>window.print()</script></body></html>`);
    win.document.close();
  }

  return <div className="space-y-5">
    <div className="flex flex-col gap-4 rounded-2xl border border-black/6 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-xl font-black">Orçamentos</h2><p className="mt-1 text-sm text-black/45">Monte peças e mão de obra, envie pelo WhatsApp e converta em OS.</p></div><button onClick={()=>setShowForm(!showForm)} className="goldButton"><Plus className="size-4"/> {showForm?"Fechar":"Novo orçamento"}</button></div>
    {(message||error)&&<div className={`rounded-xl px-4 py-3 text-sm font-bold ${error?"bg-red-50 text-red-700":"bg-emerald-50 text-emerald-700"}`}>{error??message}</div>}
    {showForm&&<div className="space-y-5 rounded-3xl border border-[#F0B323]/35 bg-white p-5 shadow-sm sm:p-6">
      <div className="grid gap-3 md:grid-cols-2"><label className="text-sm font-bold"><span>Cliente</span><select className="field mt-2" value={customerId} onChange={e=>{setCustomerId(e.target.value);setVehicleId("")}}><option value="">Selecione...</option>{customers.map((c:any)=><option key={c.id} value={c.id}>{c.name} • {c.phone}</option>)}</select></label><label className="text-sm font-bold"><span>Veículo</span><select className="field mt-2" value={vehicleId} onChange={e=>setVehicleId(e.target.value)}><option value="">Selecione...</option>{customerVehicles.map((v:any)=><option key={v.id} value={v.id}>{v.plate} • {v.brand} {v.model}</option>)}</select></label></div>
      <ManualItemsEditor title="Peças do orçamento" subtitle="Selecione do estoque ou inclua itens manuais." singular="peça" items={parts} onChange={setParts}/>
      <ManualItemsEditor title="Mão de obra" subtitle="Inclua todos os serviços previstos." singular="mão de obra" items={labor} onChange={setLabor}/>
      <div className="grid gap-3 md:grid-cols-3"><label className="text-sm font-bold"><span>Validade</span><input type="date" className="field mt-2" value={validUntil} onChange={e=>setValidUntil(e.target.value)}/></label><label className="text-sm font-bold"><span>Desconto</span><input type="number" min="0" step="0.01" className="field mt-2" value={discount} onChange={e=>setDiscount(Number(e.target.value))}/></label><div className="rounded-2xl bg-[#0b0b0c] p-4 text-white"><p className="text-xs text-white/45">Total estimado</p><p className="mt-1 text-2xl font-black text-[#FFC43D]">{money(total)}</p></div></div>
      <label className="block text-sm font-bold"><span>Observações</span><textarea className="field mt-2" rows={3} value={notes} onChange={e=>setNotes(e.target.value)}/></label>
      <button disabled={working==="create"} onClick={()=>void submit()} className="goldButton w-full justify-center">{working==="create"&&<Loader2 className="size-4 animate-spin"/>} Finalizar orçamento</button>
    </div>}
    {isLoading?<div className="rounded-2xl bg-white p-8 text-center text-sm text-black/40">Carregando...</div>:quotes.length===0?<div className="rounded-2xl border border-dashed border-black/12 bg-white p-10 text-center"><ReceiptText className="mx-auto size-8 text-[#B97900]"/><p className="mt-3 font-black">Nenhum orçamento ainda.</p></div>:<div className="space-y-3">{quotes.map((q:any)=><article key={q.id} className="rounded-2xl border border-black/6 bg-white p-5 shadow-sm"><div className="flex flex-col gap-4 xl:flex-row xl:items-center"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="text-lg font-black text-[#9B6600]">Orçamento #{q.quote_number}</span><span className="rounded-full bg-black/5 px-2.5 py-1 text-[10px] font-black uppercase">{statusLabel[q.status]??q.status}</span></div><p className="mt-2 font-bold">{q.customers?.name??"Cliente"}</p><p className="mt-1 text-xs text-black/45">{q.vehicles?.brand} {q.vehicles?.model} • {q.vehicles?.plate}</p></div><p className="text-xl font-black">{money(q.total)}</p><div className="flex flex-wrap gap-2"><button onClick={()=>printQuote(q)} className="secondaryButton"><FileText className="size-4"/> Imprimir</button><button onClick={()=>{try{openQuoteWhatsApp(q);void updateQuoteStatus(q.id,"enviado").then(refresh)}catch(e){setError(e instanceof Error?e.message:"Erro")}}} className="secondaryButton"><MessageCircle className="size-4"/> WhatsApp</button>{q.status!=="convertido"&&<button disabled={working===`convert-${q.id}`} onClick={()=>void convert(q)} className="goldButton"><CheckCircle2 className="size-4"/> Converter em OS</button>}</div></div></article>)}</div>}
  </div>;
}
