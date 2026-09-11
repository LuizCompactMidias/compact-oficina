import { useEffect, useMemo, useState } from "react";
import { ClipboardList, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { STATUS_LABEL, type OrderStatus } from "@/lib/porfirid-queries";

const db = supabase as any;

export function TechnicianOrdersManager({ onOpenOrder }: { onOpenOrder: (id: string) => void }) {
  const [rows,setRows]=useState<any[]>([]);
  const [search,setSearch]=useState("");
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState<string|null>(null);

  async function load(){
    setLoading(true);setError(null);
    const {data,error}=await db.rpc("get_technician_work_orders");
    if(error)setError(error.message); else setRows(data??[]);
    setLoading(false);
  }
  useEffect(()=>{void load()},[]);

  const filtered=useMemo(()=>{const t=search.trim().toLowerCase();return !t?rows:rows.filter((r:any)=>[r.order_number,r.customer_name,r.vehicle_plate,r.vehicle_brand,r.vehicle_model,r.status].some(v=>String(v??"").toLowerCase().includes(t)))},[rows,search]);

  if(loading)return <div className="rounded-2xl bg-white p-10 text-center text-sm text-black/45">Carregando ordens de serviço...</div>;
  if(error)return <div className="rounded-xl bg-red-50 p-4 text-sm font-bold text-red-700">{error}</div>;

  return <div className="space-y-5">
    <div className="rounded-2xl border border-[#F0B323]/20 bg-[#F0B323]/8 p-4 text-sm text-[#6F4B00]"><b>Modo técnico.</b> Esta lista traz somente os dados necessários para execução das OS. Valores e dados pessoais completos não são consultados.</div>
    <div className="relative max-w-xl"><Search className="absolute left-3 top-3.5 size-4 text-black/35"/><input className="field pl-10" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar OS, cliente, placa, marca ou modelo..."/></div>
    <div className="grid gap-3">{filtered.map((r:any)=><button key={r.id} onClick={()=>onOpenOrder(r.id)} className="rounded-2xl border border-black/6 bg-white p-5 text-left shadow-sm hover:border-[#F0B323]/50"><div className="flex flex-col gap-3 sm:flex-row sm:items-center"><div className="flex size-11 items-center justify-center rounded-xl bg-[#F0B323]/15 text-[#8A5F00]"><ClipboardList className="size-5"/></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><strong className="text-lg text-[#8A5F00]">OS #{r.order_number}</strong><span className="rounded-full bg-[#F0B323]/15 px-2.5 py-1 text-[10px] font-black uppercase text-[#7A5400]">{STATUS_LABEL[r.status as OrderStatus]??r.status}</span></div><p className="mt-2 font-bold">{r.customer_name||"Cliente"}</p><p className="mt-1 text-xs text-black/45">{[r.vehicle_brand,r.vehicle_model].filter(Boolean).join(" ")} • {r.vehicle_plate||"—"}</p></div><div className="text-right text-xs text-black/40"><p>{r.entry_at?new Date(r.entry_at).toLocaleDateString("pt-BR"):"—"}</p>{r.promised_at&&<p className="mt-1">Previsão: {new Date(r.promised_at).toLocaleString("pt-BR")}</p>}</div></div></button>)}{filtered.length===0&&<div className="rounded-2xl border border-dashed border-black/10 bg-white p-10 text-center text-sm text-black/40">Nenhuma OS encontrada.</div>}</div>
  </div>;
}
