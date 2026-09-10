import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { BarChart3, CalendarDays, Car, ChevronRight, CircleDollarSign, ClipboardList, LayoutDashboard, LogOut, Menu, PackageSearch, ReceiptText, Settings, UserCog, Users, WalletCards, Wrench, X, BadgeDollarSign, FileInput } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { BRAND } from "@/lib/brand";
import { CustomersManager } from "@/components/admin/CustomersManager";
import { VehiclesManager } from "@/components/admin/VehiclesManager";
import { NewWorkOrderFlow } from "@/components/admin/NewWorkOrderFlow";
import { WorkOrderDetail } from "@/components/admin/WorkOrderDetail";
import { StockManager } from "@/components/admin/StockManager";
import { AgendaManager } from "@/components/admin/AgendaManager";
import { QuotesManager } from "@/components/admin/QuotesManager";
import { ServiceCatalogManager } from "@/components/admin/ServiceCatalogManager";
import { FinanceManager } from "@/components/admin/FinanceManager";
import { CommissionManager } from "@/components/admin/CommissionManager";
import { PurchaseInvoiceManager } from "@/components/admin/PurchaseInvoiceManager";
import { money, STATUS_LABEL, type OrderStatus } from "@/lib/porfirid-queries";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: `Gestão | ${BRAND.name}` }, { name: "description", content: "Painel administrativo completo para oficinas e centros automotivos." }] }),
  component: AdminPage,
});

type ModuleId = "dashboard"|"orders"|"quotes"|"customers"|"vehicles"|"services"|"stock"|"purchases"|"agenda"|"finance"|"commissions"|"reports"|"users"|"settings";
const navItems: Array<{ id: ModuleId; label: string; icon: any }> = [
  { id:"dashboard", label:"Visão geral", icon:LayoutDashboard },
  { id:"orders", label:"Ordens de serviço", icon:ClipboardList },
  { id:"quotes", label:"Orçamentos", icon:ReceiptText },
  { id:"customers", label:"Clientes", icon:Users },
  { id:"vehicles", label:"Veículos", icon:Car },
  { id:"services", label:"Catálogo de serviços", icon:Wrench },
  { id:"stock", label:"Estoque e peças", icon:PackageSearch },
  { id:"purchases", label:"Entrada de Nota Fiscal", icon:FileInput },
  { id:"agenda", label:"Agenda", icon:CalendarDays },
  { id:"finance", label:"Financeiro", icon:WalletCards },
  { id:"commissions", label:"Comissões", icon:BadgeDollarSign },
  { id:"reports", label:"Relatórios", icon:BarChart3 },
  { id:"users", label:"Usuários e acessos", icon:UserCog },
  { id:"settings", label:"Configurações", icon:Settings },
];

const roleModules: Record<string, ModuleId[]> = {
  admin: navItems.map(i=>i.id),
  atendimento: ["dashboard","orders","quotes","customers","vehicles","services","agenda"],
  tecnico: ["dashboard","orders","vehicles","services","stock"],
  financeiro: ["dashboard","purchases","finance","commissions","reports"],
};

function AdminPage(){
  const [active,setActive]=useState<ModuleId>("dashboard");
  const [mobile,setMobile]=useState(false);
  const [email,setEmail]=useState("Equipe COMPACT");
  const [role,setRole]=useState("admin");
  const [openOrder,setOpenOrder]=useState<string|null>(null);
  const navigate=useNavigate();
  useEffect(()=>{void(async()=>{const {data}=await supabase.auth.getUser();if(data.user?.email)setEmail(data.user.email);if(data.user){const {data:p}=await supabase.from("profiles").select("role,active").eq("id",data.user.id).maybeSingle();if(p?.active===false){await supabase.auth.signOut();navigate({to:"/login",replace:true});return}if(p?.role)setRole(p.role)}})()},[navigate]);
  const visible=useMemo(()=>navItems.filter(i=>(roleModules[role]??[]).includes(i.id)),[role]);
  useEffect(()=>{if(!visible.some(i=>i.id===active)&&visible.length)setActive(visible[0].id)},[active,visible]);
  async function signOut(){await supabase.auth.signOut();navigate({to:"/login",replace:true})}
  function select(id:ModuleId){setActive(id);setMobile(false);setOpenOrder(null)}
  const current=visible.find(i=>i.id===active)??visible[0]??navItems[0];
  return <div className="min-h-screen bg-[#f4f5f7] text-[#17181A]">
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 flex-col border-r border-white/8 bg-[#09090a] text-white lg:flex"><Brand/><Navigation items={visible} active={active} select={select}/><UserPanel email={email} role={role} signOut={signOut}/></aside>
    {mobile&&<div className="fixed inset-0 z-50 lg:hidden"><button className="absolute inset-0 bg-black/60" aria-label="Fechar menu" onClick={()=>setMobile(false)}/><aside className="relative flex h-full w-[88%] max-w-80 flex-col bg-[#09090a] text-white"><div className="flex items-center justify-between"><Brand/><button className="mr-4 rounded-xl border border-white/10 p-2" onClick={()=>setMobile(false)}><X className="size-5"/></button></div><Navigation items={visible} active={active} select={select}/><UserPanel email={email} role={role} signOut={signOut}/></aside></div>}
    <main className="lg:pl-72"><header className="sticky top-0 z-30 border-b border-black/6 bg-white/90 backdrop-blur-xl"><div className="flex h-20 items-center gap-4 px-4 sm:px-6 lg:px-8"><button onClick={()=>setMobile(true)} className="rounded-xl border border-black/10 p-2 lg:hidden"><Menu className="size-5"/></button><div className="min-w-0 flex-1"><p className="text-xs font-black uppercase tracking-[.2em] text-[#B97900]">Gestão da oficina</p><h1 className="truncate text-2xl font-black">{openOrder?"Detalhes da Ordem de Serviço":current?.label}</h1></div><button onClick={()=>void signOut()} className="inline-flex items-center gap-2 rounded-xl border border-black/10 px-3 py-2 text-sm font-bold"><LogOut className="size-4"/><span className="hidden sm:inline">Sair</span></button></div></header><section className="p-4 sm:p-6 lg:p-8">{openOrder?<WorkOrderDetail orderId={openOrder} onBack={()=>setOpenOrder(null)}/>:<ModuleSwitch active={active} role={role} openOrder={id=>{setActive("orders");setOpenOrder(id)}}/>}</section></main>
  </div>
}

function Brand(){return <div className="flex h-20 items-center gap-3 px-5"><img src={BRAND.iconUrl} alt="" className="size-12 rounded-2xl object-contain"/><div><p className="text-lg font-black compact-gold-text">COMPACT</p><p className="text-[10px] font-bold uppercase tracking-[.18em] text-white/40">Centro Automotivo</p></div></div>}
function Navigation({items,active,select}:{items:typeof navItems;active:ModuleId;select:(id:ModuleId)=>void}){return <nav className="flex-1 space-y-1 overflow-y-auto px-4 py-4">{items.map(item=>{const I=item.icon,on=active===item.id;return <button key={item.id} onClick={()=>select(item.id)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-bold transition ${on?"bg-[#F0B323] text-black":"text-white/62 hover:bg-white/7 hover:text-white"}`}><I className="size-5"/><span className="flex-1">{item.label}</span>{on&&<ChevronRight className="size-4"/>}</button>})}</nav>}
function UserPanel({email,role,signOut}:{email:string;role:string;signOut:()=>void}){const labels:Record<string,string>={admin:"Administrador",atendimento:"Atendimento",tecnico:"Técnico",financeiro:"Financeiro"};return <div className="border-t border-white/8 p-4"><div className="rounded-2xl bg-white/[.04] p-4"><p className="truncate text-sm font-bold">{email}</p><p className="mt-1 text-xs text-white/35">{labels[role]??role}</p><button onClick={()=>void signOut()} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 py-2 text-xs font-bold text-white/60"><LogOut className="size-4"/>Sair</button></div></div>}

function ModuleSwitch({active,role,openOrder}:{active:ModuleId;role:string;openOrder:(id:string)=>void}){
  if(active==="dashboard")return <Dashboard openOrder={openOrder}/>;
  if(active==="orders")return <Orders openOrder={openOrder}/>;
  if(active==="quotes")return <QuotesManager onOpenOrder={openOrder}/>;
  if(active==="customers")return <CustomersManager userRole={role} onOpenOrder={openOrder}/>;
  if(active==="vehicles")return <VehiclesManager userRole={role} onOpenOrder={openOrder}/>;
  if(active==="services")return <ServiceCatalogManager/>;
  if(active==="stock")return <StockManager/>;
  if(active==="purchases")return <PurchaseInvoiceManager/>;
  if(active==="agenda")return <AgendaManager/>;
  if(active==="finance")return <FinanceManager/>;
  if(active==="commissions")return <CommissionManager/>;
  if(active==="reports")return <Reports/>;
  if(active==="users")return <UsersModule/>;
  return <SettingsPanel/>;
}

function Dashboard({openOrder}:{openOrder:(id:string)=>void}){
  const [metrics,setMetrics]=useState({open:0,customers:0,vehicles:0,revenue:0,ready:0,approval:0});
  const [rows,setRows]=useState<any[]>([]);
  useEffect(()=>{void(async()=>{const [o,c,v]=await Promise.all([supabase.from("work_orders").select("id,order_number,status,total,customers(name),vehicles(plate,brand,model)").order("created_at",{ascending:false}).limit(50),supabase.from("customers").select("id",{count:"exact",head:true}),supabase.from("vehicles").select("id",{count:"exact",head:true})]);const r=(o.data??[]) as any[];setRows(r.slice(0,8));setMetrics({open:r.filter(x=>!["entregue","cancelada"].includes(x.status)).length,customers:c.count??0,vehicles:v.count??0,revenue:r.filter(x=>x.status==="entregue").reduce((s,x)=>s+Number(x.total??0),0),ready:r.filter(x=>x.status==="pronto_entrega").length,approval:r.filter(x=>x.status==="aguardando_aprovacao").length})})()},[]);
  return <div className="space-y-6"><div className="rounded-[2rem] bg-[#111214] p-7 text-white shadow-xl"><p className="text-xs font-black uppercase tracking-[.2em] text-[#F0B323]">Central operacional</p><h2 className="mt-2 text-3xl font-black">Visão geral da oficina</h2><p className="mt-2 text-sm text-white/45">Clientes, veículos, OS, estoque e financeiro integrados.</p></div><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"><Metric label="OS abertas" value={metrics.open} icon={ClipboardList}/><Metric label="Aguardando aprovação" value={metrics.approval} icon={ReceiptText}/><Metric label="Prontas para entrega" value={metrics.ready} icon={Car}/><Metric label="Clientes" value={metrics.customers} icon={Users}/><Metric label="Veículos" value={metrics.vehicles} icon={Car}/><Metric label="Faturamento entregue" value={money(metrics.revenue)} icon={CircleDollarSign}/></div><section className="rounded-2xl border border-black/6 bg-white p-5 shadow-sm"><h3 className="font-black">Últimas ordens de serviço</h3><div className="mt-4 space-y-2">{rows.map(r=><button key={r.id} onClick={()=>openOrder(r.id)} className="flex w-full flex-col gap-2 rounded-xl border border-black/7 p-3 text-left hover:border-[#F0B323]/50 sm:flex-row sm:items-center"><strong className="text-[#8A5F00]">OS #{r.order_number}</strong><span className="flex-1 text-sm">{r.customers?.name??"Cliente"} • {r.vehicles?.brand??""} {r.vehicles?.model??""} • {r.vehicles?.plate??"—"}</span><Status value={r.status}/><strong>{money(Number(r.total??0))}</strong></button>)}{rows.length===0&&<p className="py-6 text-center text-sm text-black/40">Nenhuma OS registrada.</p>}</div></section></div>
}
function Metric({label,value,icon:I}:{label:string;value:string|number;icon:any}){return <div className="rounded-2xl border border-black/6 bg-white p-5 shadow-sm"><div className="flex size-11 items-center justify-center rounded-xl bg-[#F0B323]/15 text-[#8A5F00]"><I className="size-5"/></div><p className="mt-5 text-xs font-bold uppercase tracking-wider text-black/35">{label}</p><p className="mt-1 text-2xl font-black">{value}</p></div>}
function Status({value}:{value:string}){return <span className="rounded-full bg-[#F0B323]/15 px-2.5 py-1 text-[10px] font-black uppercase text-[#7A5400]">{STATUS_LABEL[value as OrderStatus]??value}</span>}

function Orders({openOrder}:{openOrder:(id:string)=>void}){
  const [rows,setRows]=useState<any[]>([]),[showNew,setShowNew]=useState(false),[search,setSearch]=useState("");
  async function load(){const {data}=await supabase.from("work_orders").select("id,order_number,status,total,entry_at,customers(name),vehicles(plate,brand,model)").order("created_at",{ascending:false});setRows((data??[]) as any[])}
  useEffect(()=>{void load()},[]);
  const filtered=useMemo(()=>rows.filter(r=>!search.trim()||String(r.order_number).includes(search)||String(r.customers?.name??"").toLowerCase().includes(search.toLowerCase())||String(r.vehicles?.plate??"").toLowerCase().includes(search.toLowerCase())),[rows,search]);
  if(showNew)return <div className="space-y-4"><button onClick={()=>setShowNew(false)} className="secondaryButton">← Voltar para as OS</button><NewWorkOrderFlow onCreated={result=>{setShowNew(false);void load();openOrder(result.id)}}/></div>;
  return <div className="space-y-5"><div className="flex flex-col gap-3 rounded-2xl border border-black/6 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-xl font-black">Ordens de serviço</h2><p className="mt-1 text-sm text-black/45">Da recepção até a entrega do veículo.</p></div><button onClick={()=>setShowNew(true)} className="goldButton">Nova OS completa</button></div><input className="field max-w-xl" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar por OS, cliente ou placa..."/><div className="grid gap-3">{filtered.map(r=><button key={r.id} onClick={()=>openOrder(r.id)} className="rounded-2xl border border-black/6 bg-white p-5 text-left shadow-sm hover:border-[#F0B323]/50"><div className="flex flex-col gap-3 sm:flex-row sm:items-center"><div className="flex-1"><div className="flex flex-wrap items-center gap-2"><strong className="text-lg text-[#8A5F00]">OS #{r.order_number}</strong><Status value={r.status}/></div><p className="mt-2 font-bold">{r.customers?.name??"Cliente"}</p><p className="mt-1 text-xs text-black/45">{r.vehicles?`${r.vehicles.brand} ${r.vehicles.model} • ${r.vehicles.plate}`:"Veículo"}</p></div><strong className="text-xl">{money(Number(r.total??0))}</strong></div></button>)}{filtered.length===0&&<div className="rounded-2xl border border-dashed border-black/10 bg-white p-10 text-center text-sm text-black/40">Nenhuma OS encontrada.</div>}</div></div>
}

function Reports(){const [rows,setRows]=useState<any[]>([]);useEffect(()=>{void supabase.from("work_orders").select("id,order_number,status,payment_status,subtotal_services,subtotal_parts,discount,total,entry_at,customers(name),vehicles(plate)").order("entry_at",{ascending:false}).then(({data})=>setRows((data??[]) as any[]))},[]);const total=rows.reduce((s,r)=>s+Number(r.total??0),0);return <div className="space-y-5"><div className="rounded-2xl border border-black/6 bg-white p-5 shadow-sm"><h2 className="text-xl font-black">Relatórios operacionais</h2><p className="mt-1 text-sm text-black/45">Resumo de ordens, serviços, peças e faturamento.</p></div><div className="grid gap-4 sm:grid-cols-3"><Metric label="OS registradas" value={rows.length} icon={ClipboardList}/><Metric label="Total em OS" value={money(total)} icon={CircleDollarSign}/><Metric label="Ticket médio" value={money(rows.length?total/rows.length:0)} icon={BarChart3}/></div><div className="overflow-x-auto rounded-2xl border border-black/6 bg-white"><table className="w-full min-w-[860px] text-left text-sm"><thead className="bg-black/[.025] text-xs uppercase text-black/40"><tr><th className="px-4 py-3">OS</th><th>Cliente</th><th>Placa</th><th>Status</th><th>Serviços</th><th>Peças</th><th>Total</th></tr></thead><tbody>{rows.map(r=><tr key={r.id} className="border-t border-black/6"><td className="px-4 py-3 font-black text-[#8A5F00]">#{r.order_number}</td><td>{r.customers?.name??"—"}</td><td>{r.vehicles?.plate??"—"}</td><td><Status value={r.status}/></td><td>{money(r.subtotal_services)}</td><td>{money(r.subtotal_parts)}</td><td className="font-black">{money(r.total)}</td></tr>)}</tbody></table></div></div>}

function UsersModule(){const [rows,setRows]=useState<any[]>([]);useEffect(()=>{void supabase.from("profiles").select("id,full_name,role,active,created_at").order("created_at").then(({data})=>setRows((data??[]) as any[]))},[]);async function update(id:string,patch:any){await supabase.from("profiles").update({...patch,updated_at:new Date().toISOString()}).eq("id",id);setRows(rows.map(r=>r.id===id?{...r,...patch}:r))}return <div className="space-y-5"><div className="rounded-2xl border border-black/6 bg-white p-5 shadow-sm"><h2 className="text-xl font-black">Usuários e acessos</h2><p className="mt-1 text-sm text-black/45">Gerencie função e ativação dos usuários já cadastrados no Auth.</p></div><div className="grid gap-3">{rows.map(r=><div key={r.id} className="rounded-2xl border border-black/6 bg-white p-5 shadow-sm"><div className="grid gap-3 md:grid-cols-[1fr_220px_140px]"><input className="field" value={r.full_name??""} onChange={e=>setRows(rows.map(x=>x.id===r.id?{...x,full_name:e.target.value}:x))} onBlur={()=>void update(r.id,{full_name:r.full_name})}/><select className="field" value={r.role} onChange={e=>void update(r.id,{role:e.target.value})}><option value="admin">Administrador</option><option value="atendimento">Atendimento</option><option value="tecnico">Técnico</option><option value="financeiro">Financeiro</option></select><button onClick={()=>void update(r.id,{active:!r.active})} className={r.active?"secondaryButton":"goldButton"}>{r.active?"Ativo":"Inativo"}</button></div></div>)}</div></div>}

function SettingsPanel(){const [row,setRow]=useState<any>({});const [saved,setSaved]=useState(false);useEffect(()=>{void supabase.from("app_settings").select("*").eq("id",1).maybeSingle().then(({data})=>setRow(data??{}))},[]);async function save(){const {data:user}=await supabase.auth.getUser();await supabase.from("app_settings").upsert({...row,id:1,updated_at:new Date().toISOString(),updated_by:user.user?.id??null});setSaved(true);setTimeout(()=>setSaved(false),2500)}const fields:[string,string][]=[["trade_name","Nome fantasia"],["company_name","Razão social"],["cnpj","CNPJ"],["phone","Telefone"],["whatsapp","WhatsApp"],["email","E-mail"],["website","Website"],["street","Endereço"],["address_number","Número"],["neighborhood","Bairro"],["city","Cidade"],["state","UF"],["zip_code","CEP"],["business_hours","Horário de atendimento"]];return <div className="space-y-5"><div className="rounded-2xl border border-black/6 bg-white p-5 shadow-sm"><h2 className="text-xl font-black">Configurações da oficina</h2><p className="mt-1 text-sm text-black/45">Esses dados alimentam documentos e personalização da instalação.</p></div><div className="rounded-2xl border border-black/6 bg-white p-5 shadow-sm"><div className="grid gap-3 md:grid-cols-2">{fields.map(([key,label])=><label key={key} className="text-sm font-bold"><span>{label}</span><input className="field mt-2" value={row[key]??""} onChange={e=>setRow({...row,[key]:e.target.value})}/></label>)}</div><label className="mt-3 block text-sm font-bold"><span>Slogan</span><textarea className="field mt-2" rows={3} value={row.slogan??""} onChange={e=>setRow({...row,slogan:e.target.value})}/></label><button onClick={()=>void save()} className="goldButton mt-5">{saved?"Configurações salvas":"Salvar configurações"}</button></div></div>}
