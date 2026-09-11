import { useEffect, useMemo, useState } from "react";
import { Car, History, Search, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { STATUS_LABEL, type OrderStatus } from "@/lib/porfirid-queries";

const db = supabase as any;

export function TechnicianVehiclesManager({ onOpenOrder }: { onOpenOrder: (id: string) => void }) {
  const [rows,setRows]=useState<any[]>([]);
  const [search,setSearch]=useState("");
  const [history,setHistory]=useState<any|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState<string|null>(null);

  async function load(){
    setLoading(true);setError(null);
    const {data,error}=await db.rpc("get_technician_vehicle_directory");
    if(error)setError(error.message); else setRows(data??[]);
    setLoading(false);
  }
  useEffect(()=>{void load()},[]);

  const filtered=useMemo(()=>{const t=search.trim().toLowerCase();return !t?rows:rows.filter((v:any)=>[v.plate,v.brand,v.model,v.version,v.vin,v.color,v.fuel,v.customer_name].some(x=>String(x??"").toLowerCase().includes(t)))},[rows,search]);

  if(loading)return <p className="p-6">Carregando veículos...</p>;
  if(error)return <p className="rounded-xl bg-red-50 p-4 text-sm font-bold text-red-700">{error}</p>;

  return <div className="space-y-5">
    <div className="rounded-2xl border border-[#F0B323]/20 bg-[#F0B323]/8 p-4 text-sm text-[#6F4B00]"><b>Modo técnico.</b> São exibidos somente os dados necessários para execução e histórico do veículo. Dados pessoais completos do cliente ficam restritos ao atendimento/administrador.</div>
    <div className="relative max-w-xl"><Search className="absolute left-3 top-3.5 size-4 text-black/35"/><input className="field pl-10" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar placa, marca, modelo, VIN ou cliente..."/></div>
    <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">{filtered.map((v:any)=><article key={v.id} className="rounded-2xl border border-black/8 bg-white p-5 shadow-sm"><div className="flex items-start gap-3"><div className="flex size-11 items-center justify-center rounded-xl bg-[#F0B323]/15"><Car className="size-5 text-[#9B6600]"/></div><div className="min-w-0 flex-1"><h3 className="font-black">{v.brand} {v.model}</h3><p className="text-sm font-bold text-[#9B6600]">{v.plate}</p><p className="text-xs text-black/45">Cliente: {v.customer_name||"—"}</p><p className="mt-1 text-xs text-black/35">{v.version||"Versão não informada"}{v.vin?` • VIN ${v.vin}`:""}</p></div></div><div className="mt-4 grid grid-cols-4 gap-2 text-center text-xs"><Mini label="Ano" value={String(v.model_year??v.year??"—")}/><Mini label="Km" value={v.current_mileage?Number(v.current_mileage).toLocaleString("pt-BR"):"—"}/><Mini label="OS" value={String(v.order_count??0)}/><Mini label="Agenda" value={String(v.appointment_count??0)}/></div>{v.notes&&<p className="mt-3 rounded-xl bg-black/[.025] p-3 text-xs text-black/55">{v.notes}</p>}<button className="secondaryButton mt-4" onClick={()=>void openHistory(v,setHistory)}><History className="size-4"/>Histórico técnico</button></article>)}</div>
    {filtered.length===0&&<div className="rounded-2xl border border-dashed border-black/10 bg-white p-10 text-center text-sm text-black/40">Nenhum veículo encontrado.</div>}
    {history&&<HistoryModal data={history} onClose={()=>setHistory(null)} onOpenOrder={onOpenOrder}/>} 
  </div>;
}

async function openHistory(vehicle:any,setHistory:(v:any)=>void){
  const [orders,appointments]=await Promise.all([
    db.from("work_orders").select("id,order_number,status,entry_at,promised_at,mileage_in,customer_report,diagnosis").eq("vehicle_id",vehicle.id).order("created_at",{ascending:false}).limit(40),
    db.from("appointments").select("id,scheduled_at,status").eq("vehicle_id",vehicle.id).order("scheduled_at",{ascending:false}).limit(30),
  ]);
  setHistory({vehicle,orders:orders.data??[],appointments:appointments.data??[]});
}

function HistoryModal({data,onClose,onOpenOrder}:{data:any;onClose:()=>void;onOpenOrder:(id:string)=>void}){const v=data.vehicle;return <div className="fixed inset-0 z-[80] overflow-y-auto bg-black/65 p-4"><div className="mx-auto my-8 max-w-4xl rounded-3xl bg-white p-6"><div className="flex justify-between"><div><p className="text-xs font-black uppercase tracking-widest text-[#B97900]">Histórico técnico</p><h2 className="text-2xl font-black">{v.brand} {v.model} • {v.plate}</h2></div><button onClick={onClose}><X/></button></div><div className="mt-5 space-y-5"><div className="grid gap-3 sm:grid-cols-4"><Mini label="OS" value={String(data.orders.length)}/><Mini label="Agenda" value={String(data.appointments.length)}/><Mini label="Ano" value={String(v.model_year??v.year??"—")}/><Mini label="Combustível" value={String(v.fuel??"—")}/></div><div className="rounded-xl bg-black/[.025] p-4 text-sm"><p><b>VIN/Chassi:</b> {v.vin||"—"}</p><p className="mt-1"><b>Quilometragem atual:</b> {v.current_mileage?`${Number(v.current_mileage).toLocaleString("pt-BR")} km`:"—"}</p><p className="mt-1"><b>Observações técnicas:</b> {v.notes||"—"}</p></div><div><h4 className="font-black">Ordens de serviço</h4><div className="mt-2 space-y-2">{data.orders.map((o:any)=><button key={o.id} onClick={()=>onOpenOrder(o.id)} className="flex w-full flex-col gap-2 rounded-xl border border-black/8 p-3 text-left sm:flex-row sm:items-center"><span className="font-black text-[#8A5F00]">OS #{o.order_number}</span><span className="flex-1 text-xs">{STATUS_LABEL[o.status as OrderStatus]??o.status}</span><span className="text-xs text-black/40">{o.entry_at?new Date(o.entry_at).toLocaleDateString("pt-BR"):"—"}</span></button>)}</div></div><div><h4 className="font-black">Agendamentos</h4><div className="mt-2 space-y-2">{data.appointments.map((a:any)=><div key={a.id} className="rounded-xl bg-black/[.03] p-3 text-sm">{new Date(a.scheduled_at).toLocaleString("pt-BR")} • {a.status}</div>)}</div></div></div></div></div>}
function Mini({label,value}:{label:string;value:string}){return <div className="rounded-xl bg-black/[.03] p-2"><p className="text-[10px] font-black uppercase text-black/35">{label}</p><p className="mt-1 font-black">{value}</p></div>}
