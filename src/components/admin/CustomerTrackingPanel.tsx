import { useEffect, useMemo, useState } from "react";
import { Check, CheckCircle2, Copy, ExternalLink, Link2, MessageCircle, Save, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { BRAND } from "@/lib/brand";
import { useAppSettings } from "@/lib/app-settings";
import { STATUS_LABEL, type OrderStatus } from "@/lib/porfirid-queries";

const db=supabase as any;
const steps:OrderStatus[]=["recepcao","diagnostico","aguardando_aprovacao","em_execucao","finalizacao","pronto_entrega","entregue"];

export function CustomerTrackingPanel({order}:{order:any}){
 const {data:settings={}}=useAppSettings();
 const [tracking,setTracking]=useState<any>(null),[logs,setLogs]=useState<any[]>([]),[note,setNote]=useState(""),[status,setStatus]=useState<OrderStatus>(order.status),[message,setMessage]=useState(""),[busy,setBusy]=useState(false);
 async function load(){
  const [t,l]=await Promise.all([
   db.from("work_order_tracking").select("*").eq("work_order_id",order.id).maybeSingle(),
   db.from("customer_communication_log").select("*").eq("work_order_id",order.id).order("sent_confirmed_at",{ascending:false,nullsFirst:false}).order("created_at",{ascending:false}).limit(30),
  ]);
  setTracking(t.data);setNote(t.data?.customer_note??"");setStatus((t.data?.status??order.status) as OrderStatus);setLogs(l.data??[])
 }
 useEffect(()=>{void load()},[order.id]);
 const customer=order.customers??{},vehicle=order.vehicles??{};
 const path=tracking?.access_token?`/acompanhar/${tracking.access_token}`:"";
 const url=path&&typeof window!=="undefined"?`${window.location.origin}${path}`:"";
 const savedStatus=(tracking?.status??order.status) as OrderStatus;
 const savedNote=String(tracking?.customer_note??"");
 const hasPending=Boolean(tracking)&&(status!==savedStatus||note.trim()!==savedNote.trim());
 const currentIndex=steps.indexOf(status);
 const text=useMemo(()=>{
  const greeting=settings.whatsapp_greeting||`Olá, ${customer.name??"cliente"}! Aqui é da ${BRAND.name}.`;
  const configured=savedStatus==="pronto_entrega"?(settings.whatsapp_ready_message||""):(settings.whatsapp_tracking_message||"");
  const delivered=savedStatus==="entregue"?"Seu veículo foi entregue. Obrigado pela confiança!":"";
  return `${greeting}\n\n${configured?`${configured}\n\n`:""}${delivered?`${delivered}\n\n`:""}Atualização da OS #${order.order_number}: ${STATUS_LABEL[savedStatus]??savedStatus}.\nVeículo: ${vehicle.brand??""} ${vehicle.model??""} • ${vehicle.plate??""}${savedNote?`\n\nMensagem da oficina: ${savedNote}`:""}${url?`\n\nAcompanhe em tempo real: ${url}`:""}`;
 },[customer.name,order.order_number,savedNote,savedStatus,settings.whatsapp_greeting,settings.whatsapp_ready_message,settings.whatsapp_tracking_message,url,vehicle.brand,vehicle.model,vehicle.plate]);
 const currentConfirmed=logs.some(x=>x.tracking_status===savedStatus&&x.message===text&&x.sent_confirmed_at);
 async function save(){if(!tracking)return;setBusy(true);const {error}=await db.from("work_order_tracking").update({customer_note:note,status,updated_at:new Date().toISOString()}).eq("id",tracking.id);setBusy(false);setMessage(error?error.message:"Etapa e mensagem do acompanhamento atualizadas.");if(!error)await load()}
 async function copy(value:string,label:string){if(!value)return;try{await navigator.clipboard.writeText(value);setMessage(label)}catch{setMessage("Não foi possível copiar automaticamente.")}}
 function openWhatsApp(){
  const phone=String(customer.phone??"").replace(/\D/g,"");
  if(!phone)return setMessage("Cliente sem WhatsApp cadastrado.");
  if(hasPending)return setMessage("Salve a etapa ou o recado antes de abrir o WhatsApp.");
  const normalized=phone.startsWith("55")?phone:`55${phone}`;
  window.open(`https://wa.me/${normalized}?text=${encodeURIComponent(text)}`,"_blank","noopener,noreferrer");
  setMessage("WhatsApp aberto. Depois do envio, clique em “Marcar como enviada”.");
 }
 async function confirmSent(){
  if(!tracking||hasPending)return;
  setBusy(true);setMessage("");
  const {data:auth}=await supabase.auth.getUser();
  const {error}=await db.from("customer_communication_log").insert({work_order_id:order.id,channel:"whatsapp",direction:"outbound",message:text,sent_to:customer.phone??null,tracking_status:savedStatus,sent_confirmed_at:new Date().toISOString(),created_by:auth.user?.id??null});
  setBusy(false);setMessage(error?error.message:"Envio confirmado e registrado no histórico.");if(!error)await load();
 }
 if(settings.tracking_enabled===false)return <div className="rounded-xl border border-dashed border-black/10 p-4 text-sm text-black/45">O acompanhamento público está desativado nas Configurações.</div>;
 if(!tracking)return <div className="rounded-xl border border-dashed border-black/10 p-4 text-sm text-black/45">O link público será criado automaticamente quando a OS for registrada.</div>;
 return <div className="space-y-5">
  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex items-center gap-2"><div className="rounded-lg bg-[#F0B323]/15 p-2 text-[#8A5F00]"><Link2 className="size-4"/></div><p className="font-black">Acompanhamento e comunicação</p></div><p className="mt-2 text-xs leading-relaxed text-black/48">Atualize a etapa, salve e envie manualmente pelo WhatsApp. O sistema só registra o aviso quando a equipe confirmar que ele realmente foi enviado.</p></div><span className="rounded-full bg-emerald-50 px-3 py-1.5 text-[11px] font-black text-emerald-700">Link ativo</span></div>
  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">{steps.map((step,index)=>{const active=status===step,done=index<currentIndex;return <button key={step} type="button" onClick={()=>setStatus(step)} className={`rounded-2xl border p-3 text-left ${active?"border-[#F0B323] bg-[#F0B323]/8":done?"border-emerald-200 bg-emerald-50":"border-black/7 bg-black/[.015]"}`}><div className={`flex size-7 items-center justify-center rounded-full text-xs font-black ${active?"bg-[#F0B323] text-black":done?"bg-emerald-600 text-white":"bg-black/6 text-black/35"}`}>{done?<Check className="size-4"/>:index+1}</div><p className="mt-2 text-xs font-black">{STATUS_LABEL[step]??step}</p></button>})}</div>
  <div className="rounded-xl bg-black/[.025] p-4"><p className="text-[10px] font-black uppercase tracking-wider text-black/35">Link público</p><div className="mt-2 flex flex-col gap-2 sm:flex-row"><input readOnly value={url} className="field flex-1"/><button onClick={()=>void copy(url,"Link copiado.")} className="secondaryButton"><Copy className="size-4"/>Copiar</button><a href={path} target="_blank" rel="noreferrer" className="secondaryButton"><ExternalLink className="size-4"/>Visualizar</a></div></div>
  <label className="block text-sm font-bold">Recado visível ao cliente<textarea rows={4} className="field mt-2 resize-y" value={note} onChange={e=>setNote(e.target.value)} placeholder="Ex.: As peças chegaram e a montagem será concluída ainda hoje."/></label>
  <div className="flex flex-wrap items-center gap-2"><button disabled={busy||!hasPending} onClick={()=>void save()} className="goldButton"><Save className="size-4"/>Salvar atualização</button>{!hasPending&&<span className="inline-flex items-center gap-1.5 rounded-full bg-black/[.035] px-3 py-2 text-xs font-bold text-black/45"><CheckCircle2 className="size-3.5 text-emerald-600"/>Etapa salva</span>}</div>
  {hasPending&&<p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-bold text-amber-800">Você alterou a etapa ou o recado. Salve antes de preparar uma nova mensagem.</p>}
  <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex items-center gap-2 text-emerald-800"><Send className="size-4"/><p className="text-sm font-black">Mensagem: {STATUS_LABEL[savedStatus]??savedStatus}</p></div><p className="mt-1 text-xs text-emerald-800/65">Abra o WhatsApp, confira e envie manualmente. Depois confirme o envio no sistema.</p></div>{currentConfirmed&&<span className="inline-flex items-center gap-2 rounded-xl bg-emerald-100 px-3 py-2 text-xs font-black text-emerald-800"><CheckCircle2 className="size-4"/>Envio confirmado</span>}</div><pre className="mt-4 max-h-72 overflow-y-auto whitespace-pre-wrap rounded-xl bg-white p-4 font-sans text-xs leading-5 text-black/65">{text}</pre><div className="mt-3 flex flex-wrap gap-2"><button disabled={hasPending} onClick={openWhatsApp} className="goldButton"><MessageCircle className="size-4"/>Abrir WhatsApp</button><button disabled={hasPending} onClick={()=>void copy(text,"Mensagem copiada.")} className="secondaryButton"><Copy className="size-4"/>Copiar mensagem</button>{!currentConfirmed&&!hasPending&&<button disabled={busy} onClick={()=>void confirmSent()} className="secondaryButton text-emerald-700"><CheckCircle2 className="size-4"/>Marcar como enviada</button>}</div></div>
  {message&&<p className="rounded-xl bg-[#F0B323]/10 p-3 text-xs font-bold text-[#6F4B00]">{message}</p>}
  <div><div className="flex items-center justify-between"><p className="text-xs font-black uppercase tracking-wider text-black/35">Histórico de comunicação</p>{logs.length>0&&<span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700"><CheckCircle2 className="size-3.5"/>{logs.length} registro(s)</span>}</div><div className="mt-2 space-y-2">{logs.map(x=><div key={x.id} className="rounded-xl bg-black/[.025] p-3 text-xs"><div className="flex flex-wrap justify-between gap-3"><b>{STATUS_LABEL[x.tracking_status as OrderStatus]??x.tracking_status??x.channel} • {x.sent_to??"cliente"}</b><span className="text-black/35">{new Date(x.sent_confirmed_at??x.created_at).toLocaleString("pt-BR")}</span></div><p className="mt-2 whitespace-pre-wrap text-black/60">{x.message}</p></div>)}{logs.length===0&&<p className="text-sm text-black/40">Nenhuma comunicação confirmada.</p>}</div></div>
 </div>;
}
