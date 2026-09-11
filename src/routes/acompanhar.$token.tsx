import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Car, Check, Clock3, Loader2, MessageCircle, ShieldCheck, Wrench } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { BRAND } from "@/lib/brand";

export const Route=createFileRoute("/acompanhar/$token")({
  head:()=>({meta:[{title:`Acompanhe seu veículo | ${BRAND.name}`},{name:"description",content:`Acompanhe o andamento do seu veículo no ${BRAND.name}.`},{name:"robots",content:"noindex,nofollow"}]}),
  component:TrackingPage,
});

const steps=[
  {id:"recepcao",label:"Recepção",description:"Seu veículo foi recebido e os dados de entrada foram registrados."},
  {id:"diagnostico",label:"Diagnóstico",description:"Nossa equipe está avaliando o veículo e identificando os serviços necessários."},
  {id:"aguardando_aprovacao",label:"Aguardando aprovação",description:"O diagnóstico foi concluído e o orçamento está aguardando aprovação."},
  {id:"em_execucao",label:"Em execução",description:"Os serviços aprovados estão sendo executados pela equipe técnica."},
  {id:"finalizacao",label:"Finalização",description:"Os serviços principais terminaram e o veículo está em conferência final."},
  {id:"pronto_entrega",label:"Pronto para retirada",description:"Seu veículo está pronto para retirada na oficina."},
  {id:"entregue",label:"Entregue",description:"Atendimento concluído e veículo entregue."},
] as const;
const labels:Record<string,string>={...Object.fromEntries(steps.map(s=>[s.id,s.label])),cancelada:"Cancelada",pendente:"Pendente",concluido:"Concluído",em_execucao:"Em execução"};

function TrackingPage(){
  const {token}=Route.useParams();
  const validToken=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(token);
  const [data,setData]=useState<any>(null),[loading,setLoading]=useState(validToken),[error,setError]=useState("");
  useEffect(()=>{if(!validToken)return;void supabase.rpc("get_vehicle_tracking" as any,{p_token:token} as any).then(({data,error})=>{if(error)setError(error.message);else setData(data);setLoading(false)})},[token,validToken]);

  if(!validToken||error||(!loading&&!data))return <InvalidTracking/>;
  if(loading)return <Shell><Loader2 className="mx-auto size-9 animate-spin text-[#F0B323]"/><p className="mt-4 text-center text-white/45">Carregando o andamento do seu veículo...</p></Shell>;

  const status=data.tracking?.status||data.order?.status||"recepcao";
  const currentIndex=steps.findIndex(s=>s.id===status);
  const history=data.status_history??[],services=data.services??[];
  const vehicleName=[data.vehicle?.brand,data.vehicle?.model].filter(Boolean).join(" ")||"Seu veículo";
  const updatedAt=data.tracking?.updated_at||history.at(-1)?.created_at||data.order?.entry_at;
  const whatsapp=String(data.shop?.whatsapp||data.shop?.phone||"").replace(/\D/g,"");
  const whatsappUrl=whatsapp?`https://wa.me/${whatsapp.startsWith("55")?whatsapp:`55${whatsapp}`}`:"";
  const cancelled=status==="cancelada";

  return <main className="min-h-screen bg-[#070707] text-white">
    <header className="border-b border-white/8 bg-[#070707]"><div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6"><Link to="/"><img src={BRAND.logoUrl} alt={BRAND.name} className="h-12 w-auto max-w-[210px] object-contain"/></Link>{whatsappUrl&&<a href={whatsappUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-[#F0B323]/25 px-3 py-2 text-xs font-black text-[#FFC43D]"><MessageCircle className="size-4"/>Falar com a oficina</a>}</div></header>
    <div className="compact-grid min-h-[calc(100vh-81px)]"><div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
      <section className="rounded-[2rem] border border-[#F0B323]/18 bg-[#111214]/95 p-5 shadow-2xl sm:p-8">
        <div className="flex flex-col gap-5 border-b border-white/8 pb-6 sm:flex-row sm:items-start sm:justify-between"><div><div className="inline-flex items-center gap-2 rounded-full border border-[#F0B323]/25 bg-[#F0B323]/8 px-3 py-1.5 text-xs font-black text-[#FFC43D]"><ShieldCheck className="size-4"/>Acompanhamento seguro</div><h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">Olá, {data.customer?.name||"cliente"}</h1><p className="mt-2 text-sm leading-relaxed text-white/48">Acompanhe aqui o andamento do seu veículo sem precisar criar cadastro ou senha.</p></div>{updatedAt&&<div className="rounded-2xl border border-white/8 bg-white/[.035] px-4 py-3 text-sm"><p className="text-[10px] font-bold uppercase tracking-wider text-white/35">Última atualização</p><p className="mt-1 font-black">{new Date(updatedAt).toLocaleString("pt-BR")}</p></div>}</div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3"><Info icon={Car} label="Veículo" value={`${vehicleName}${data.vehicle?.plate?` • ${data.vehicle.plate}`:""}`}/><Info icon={Wrench} label="Status atual" value={labels[status]||status}/><Info icon={Clock3} label="Previsão" value={data.order?.promised_at?new Date(data.order.promised_at).toLocaleString("pt-BR"):"A definir"}/></div>

        {cancelled&&<div className="mt-6 rounded-2xl border border-red-400/20 bg-red-500/8 p-5"><p className="font-black text-red-200">Esta ordem de serviço foi cancelada.</p><p className="mt-1 text-sm text-red-100/60">Para mais informações, entre em contato diretamente com a oficina.</p></div>}

        {!cancelled&&<section className="mt-8"><p className="text-xs font-black uppercase tracking-[.18em] text-[#F0B323]">Andamento do serviço</p><div className="mt-5 space-y-0">{steps.map((step,index)=>{const current=index===currentIndex,completed=index<currentIndex,future=index>currentIndex;return <div key={step.id} className="relative grid grid-cols-[44px_1fr] gap-3 pb-6 last:pb-0">{index<steps.length-1&&<div className={`absolute left-[21px] top-10 h-[calc(100%-16px)] w-px ${completed?"bg-[#F0B323]":"bg-white/10"}`}/>}<div className={`relative z-10 flex size-11 items-center justify-center rounded-full border-2 ${current?"border-[#F0B323] bg-[#F0B323] text-black":completed?"border-[#F0B323] bg-[#111214] text-[#FFC43D]":"border-white/10 bg-[#111214] text-white/25"}`}>{completed?<Check className="size-5" strokeWidth={3}/>:<span className="text-sm font-black">{index+1}</span>}</div><div className={`rounded-2xl border p-4 ${current?"border-[#F0B323]/30 bg-[#F0B323]/[.06]":"border-white/7 bg-white/[.02]"}`}><div className="flex flex-wrap items-center justify-between gap-2"><h2 className={`font-black ${future?"text-white/35":"text-white/80"}`}>{step.label}</h2>{current&&<span className="rounded-full bg-[#F0B323] px-2.5 py-1 text-[10px] font-black uppercase text-black">Etapa atual</span>}{completed&&<span className="text-[10px] font-bold uppercase tracking-wider text-[#FFC43D]">Concluído</span>}</div><p className={`mt-1 text-xs leading-relaxed ${future?"text-white/25":"text-white/45"}`}>{step.description}</p></div></div>})}</div></section>}

        {data.tracking?.customer_note&&<section className="mt-6 rounded-2xl border border-[#F0B323]/20 bg-[#F0B323]/8 p-5"><p className="text-[10px] font-black uppercase tracking-[.18em] text-[#FFC43D]">Recado da oficina</p><p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-white/75">{data.tracking.customer_note}</p></section>}

        {services.length>0&&<section className="mt-6 rounded-2xl border border-white/8 bg-white/[.025] p-5"><h2 className="font-black">Serviços desta OS</h2><div className="mt-4 space-y-2">{services.map((s:any,i:number)=><div key={i} className="flex items-center justify-between gap-3 rounded-xl bg-black/20 p-3"><span className="text-sm font-semibold text-white/75">{s.description}</span><span className="rounded-full bg-[#F0B323]/12 px-2 py-1 text-[10px] font-black uppercase text-[#FFC43D]">{labels[s.status]||s.status||"Pendente"}</span></div>)}</div></section>}

        {history.length>0&&<section className="mt-6 rounded-2xl border border-white/8 bg-white/[.025] p-5"><h2 className="font-black">Histórico de andamento</h2><div className="mt-4 space-y-3">{history.slice().reverse().map((h:any,i:number)=><div key={i} className="flex gap-3 text-sm"><div className="mt-1.5 size-2 shrink-0 rounded-full bg-[#F0B323]"/><div><p className="font-bold">{labels[h.to_status]||h.to_status}</p><p className="mt-1 text-xs text-white/35">{new Date(h.created_at).toLocaleString("pt-BR")}</p></div></div>)}</div></section>}

        <section className="mt-6 rounded-2xl border border-white/8 bg-black/25 p-5"><div className="flex items-start gap-3"><MessageCircle className="mt-0.5 size-5 shrink-0 text-[#F0B323]"/><div><p className="font-black">Precisa falar com a equipe?</p><p className="mt-1 text-sm leading-relaxed text-white/45">Entre em contato com {data.shop?.name||BRAND.name}.{data.shop?.business_hours?` Atendimento: ${data.shop.business_hours}.`:""}</p>{whatsappUrl&&<a href={whatsappUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#F0B323] px-4 py-2.5 text-sm font-black text-black"><MessageCircle className="size-4"/>WhatsApp {data.shop?.whatsapp||data.shop?.phone||""}</a>}</div></div></section>
      </section>
      <p className="mt-6 text-center text-[11px] leading-relaxed text-white/25">Este link é exclusivo deste atendimento. Nenhum valor, endereço, documento pessoal ou observação interna da oficina é exibido nesta página.</p>
    </div></div>
  </main>;
}

function InvalidTracking(){return <Shell><img src={BRAND.iconUrl} alt="" className="mx-auto size-20 rounded-3xl object-contain"/><h1 className="mt-5 text-center text-2xl font-black">Link de acompanhamento inválido</h1><p className="mt-2 text-center text-sm leading-relaxed text-white/45">Este link pode estar incorreto, ter sido substituído ou o acompanhamento pode estar desativado. Peça à oficina um novo link.</p><Link to="/" className="mx-auto mt-6 block w-fit rounded-xl bg-[#F0B323] px-4 py-3 text-sm font-black text-black">Voltar ao site</Link></Shell>}
function Shell({children}:{children:React.ReactNode}){return <main className="compact-grid flex min-h-screen items-center justify-center bg-[#070707] px-4 py-10 text-white"><div className="w-full max-w-3xl rounded-[2rem] border border-[#F0B323]/18 bg-[#111214]/95 p-6 shadow-2xl sm:p-8">{children}</div></main>}
function Info({icon:Icon,label,value}:{icon:any;label:string;value:string}){return <div className="rounded-2xl border border-white/8 bg-black/25 p-4"><Icon className="size-5 text-[#F0B323]"/><p className="mt-3 text-[10px] font-bold uppercase tracking-wider text-white/35">{label}</p><p className="mt-1 font-black">{value}</p></div>}
