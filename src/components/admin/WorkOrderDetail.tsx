import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, Clock3, CreditCard, FileText, Loader2, ReceiptText, RefreshCw, ShieldCheck, Wrench } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { money, STATUS_LABEL, type OrderStatus } from "@/lib/porfirid-queries";
import { printWorkOrderDocument } from "@/lib/work-order-documents";
import { useAppSettings } from "@/lib/app-settings";
import { CustomerTrackingPanel } from "@/components/admin/CustomerTrackingPanel";
import { WorkOrderPartsPanel } from "@/components/admin/WorkOrderPartsPanel";
import { WorkOrderPhotosPanel } from "@/components/admin/WorkOrderPhotosPanel";
import { ServiceExecutionCommissionPanel } from "@/components/admin/ServiceExecutionCommissionPanel";

const db = supabase as any;
const workflow: OrderStatus[] = ["recepcao","diagnostico","aguardando_aprovacao","em_execucao","finalizacao","pronto_entrega","entregue"];
const defaultPaymentMethods = ["PIX","Dinheiro","Débito","Crédito","Transferência","Outro"];
const checklistLabels: Array<[string,string]> = [
  ["mileage_checked","Quilometragem conferida"],["fuel_checked","Nível de combustível"],["front_checked","Frente do veículo"],
  ["rear_checked","Traseira do veículo"],["left_side_checked","Lateral esquerda"],["right_side_checked","Lateral direita"],
  ["wheels_checked","Rodas"],["tires_checked","Pneus"],["lights_checked","Iluminação"],["windshield_checked","Para-brisa"],
  ["interior_checked","Interior"],["dashboard_checked","Painel / alertas"],["spare_tire_checked","Estepe"],
  ["tools_checked","Ferramentas / macaco"],["belongings_checked","Pertences no veículo"],
];

export function WorkOrderDetail({ orderId, onBack, userRole = "admin" }: { orderId: string; onBack: () => void; userRole?: string }) {
  const { data: settings } = useAppSettings();
  const [order,setOrder]=useState<any>(null);
  const [services,setServices]=useState<any[]>([]);
  const [parts,setParts]=useState<any[]>([]);
  const [photos,setPhotos]=useState<any[]>([]);
  const [payments,setPayments]=useState<any[]>([]);
  const [history,setHistory]=useState<any[]>([]);
  const [checklist,setChecklist]=useState<any>(null);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const [success,setSuccess]=useState<string|null>(null);
  const [paymentAmount,setPaymentAmount]=useState("");
  const [paymentMethod,setPaymentMethod]=useState("PIX");
  const [installments,setInstallments]=useState(1);
  const [edit,setEdit]=useState({diagnosis:"",customer_report:"",customer_notes:"",internal_notes:"",promised_at:"",mileage_in:"",fuel_level:""});

  const enabledPaymentMethods = useMemo(() => settings?.payment_methods?.length ? settings.payment_methods : defaultPaymentMethods,[settings?.payment_methods]);
  const requirePaymentBeforeDelivery = settings?.require_payment_before_delivery ?? true;
  const allowPartialApproval = settings?.allow_partial_approval ?? true;
  const canOperate = ["admin","atendimento","tecnico"].includes(userRole);
  const canApprove = ["admin","atendimento"].includes(userRole);
  const canReceivePayment = ["admin","financeiro"].includes(userRole);
  const canViewFinancial = ["admin","financeiro"].includes(userRole);
  const canViewCommercial = ["admin","atendimento","financeiro"].includes(userRole);
  const canCancel = userRole === "admin";

  useEffect(()=>{
    if(enabledPaymentMethods.length && !enabledPaymentMethods.includes(paymentMethod)) setPaymentMethod(enabledPaymentMethods[0]!);
  },[enabledPaymentMethods,paymentMethod]);

  async function load(){
    setLoading(true); setError(null);
    try{
      const [o,s,p,ph,pay,cl,h]=await Promise.all([
        db.from("work_orders").select("*, customers(*), vehicles(*)").eq("id",orderId).single(),
        db.from("work_order_services").select("*").eq("work_order_id",orderId).order("created_at"),
        db.from("work_order_parts").select("*").eq("work_order_id",orderId).order("created_at"),
        db.from("vehicle_photos").select("*").eq("work_order_id",orderId).order("created_at"),
        canViewFinancial?db.from("payments").select("*").eq("work_order_id",orderId).order("created_at"):Promise.resolve({data:[],error:null}),
        db.from("vehicle_checklists").select("*").eq("work_order_id",orderId).maybeSingle(),
        db.from("work_order_status_history").select("*").eq("work_order_id",orderId).order("created_at"),
      ]);
      if(o.error)throw o.error;
      setOrder(o.data); setServices(s.data??[]); setParts(p.data??[]); setPhotos(ph.data??[]); setPayments(pay.data??[]); setChecklist(cl.data??null); setHistory(h.data??[]);
      setEdit({
        diagnosis:o.data?.diagnosis??"", customer_report:o.data?.customer_report??"", customer_notes:o.data?.customer_notes??"", internal_notes:o.data?.internal_notes??"",
        promised_at:o.data?.promised_at?String(o.data.promised_at).slice(0,16):"", mileage_in:o.data?.mileage_in?String(o.data.mileage_in):"", fuel_level:o.data?.fuel_level??"",
      });
    }catch(e:any){setError(e.message??"Erro ao carregar OS")}finally{setLoading(false)}
  }
  useEffect(()=>{void load()},[orderId,canViewFinancial]);

  const paid=useMemo(()=>payments.filter(p=>["confirmado","pago"].includes(p.status)).reduce((s,p)=>s+Number(p.amount||0),0),[payments]);
  const balance=Math.max(Number(order?.total||0)-paid,0);
  const currentIndex=order?workflow.indexOf(order.status as OrderStatus):-1;
  const nextStatus=currentIndex>=0&&currentIndex<workflow.length-1?workflow[currentIndex+1]:null;
  const waitingApproval=order?.status==="aguardando_aprovacao"&&!["aprovado","parcial"].includes(order?.approval_status);
  const waitingPayment=requirePaymentBeforeDelivery&&nextStatus==="entregue"&&order?.payment_status!=="pago";
  const closed=["entregue","cancelada"].includes(order?.status);
  const technicalTransitions:OrderStatus[]=["diagnostico","aguardando_aprovacao","finalizacao","pronto_entrega"];
  const roleCanAdvance=Boolean(nextStatus)&&(["admin","atendimento"].includes(userRole)||(userRole==="tecnico"&&technicalTransitions.includes(nextStatus as OrderStatus)));
  const canAdvance=Boolean(nextStatus)&&roleCanAdvance&&!waitingApproval&&!waitingPayment&&!closed;
  const checklistDone=checklist?checklistLabels.filter(([key])=>Boolean(checklist[key])).length:0;

  async function updateStatus(status:OrderStatus){
    setSaving(true);setError(null);setSuccess(null);
    try{
      if(status==="em_execucao"&&!canApprove)throw new Error("A aprovação do orçamento deve ser registrada pelo atendimento ou administrador.");
      if(status==="entregue"&&!canApprove)throw new Error("A entrega do veículo deve ser registrada pelo atendimento ou administrador.");
      if(status==="em_execucao"&&!["aprovado","parcial"].includes(order.approval_status))throw new Error("Aprove o orçamento antes de iniciar a execução.");
      if(status==="entregue"&&requirePaymentBeforeDelivery&&order?.payment_status!=="pago")throw new Error("Registre o pagamento integral antes da entrega.");
      const patch:any={status,updated_at:new Date().toISOString()};
      if(status==="entregue")patch.delivered_at=new Date().toISOString();
      const {error}=await db.from("work_orders").update(patch).eq("id",orderId);if(error)throw error;
      await db.from("work_order_tracking").update({status,updated_at:new Date().toISOString()}).eq("work_order_id",orderId);
      await load();setSuccess(`Status alterado para ${STATUS_LABEL[status]??status}.`);
    }catch(e:any){setError(e.message??"Não foi possível alterar o status.")}finally{setSaving(false)}
  }

  async function approval(status:"aprovado"|"parcial"|"recusado"){
    setSaving(true);setError(null);setSuccess(null);
    try{
      if(!canApprove)throw new Error("A aprovação do orçamento deve ser registrada pelo atendimento ou administrador.");
      if(status==="parcial"&&!allowPartialApproval)throw new Error("A aprovação parcial está desabilitada nas Configurações.");
      const approved=status!=="recusado";
      const patch:any={approval_status:status,approved_at:approved?new Date().toISOString():null,updated_at:new Date().toISOString()};
      if(approved&&order.status==="aguardando_aprovacao")patch.status="em_execucao";
      const {error}=await db.from("work_orders").update(patch).eq("id",orderId);if(error)throw error;
      if(patch.status)await db.from("work_order_tracking").update({status:patch.status,updated_at:new Date().toISOString()}).eq("work_order_id",orderId);
      await load();
      setSuccess(status==="aprovado"?"Orçamento aprovado e OS liberada para execução.":status==="parcial"?"Aprovação parcial registrada e OS liberada para execução.":"Orçamento recusado.");
    }catch(e:any){setError(e.message??"Não foi possível registrar a aprovação.")}finally{setSaving(false)}
  }

  async function saveTechnicalData(){
    setSaving(true);setError(null);setSuccess(null);
    try{
      if(!canOperate)throw new Error("Seu perfil possui acesso somente para consulta nesta OS.");
      const mileage=edit.mileage_in.replace(/\D/g,"");
      const {error}=await db.from("work_orders").update({
        diagnosis:edit.diagnosis.trim()||null, customer_report:edit.customer_report.trim()||null, customer_notes:edit.customer_notes.trim()||null,
        internal_notes:edit.internal_notes.trim()||null, promised_at:edit.promised_at?new Date(edit.promised_at).toISOString():null,
        mileage_in:mileage?Number(mileage):null, fuel_level:edit.fuel_level.trim()||null, updated_at:new Date().toISOString(),
      }).eq("id",orderId); if(error)throw error;
      if(order.vehicle_id&&mileage)await db.from("vehicles").update({current_mileage:Number(mileage),updated_at:new Date().toISOString()}).eq("id",order.vehicle_id);
      await load();setSuccess("Dados técnicos da OS atualizados.");
    }catch(e:any){setError(e.message??"Não foi possível salvar os dados.")}finally{setSaving(false)}
  }

  async function addPayment(){
    const amount=Number(paymentAmount||0);if(amount<=0)return setError("Informe um valor de pagamento maior que zero.");
    if(amount>balance+0.009)return setError("O valor informado é maior que o saldo da OS.");
    if(!canReceivePayment)return setError("Seu perfil não possui permissão para registrar pagamentos.");
    if(!enabledPaymentMethods.includes(paymentMethod))return setError("Essa forma de pagamento não está habilitada nas Configurações.");
    setSaving(true);setError(null);setSuccess(null);
    try{
      const {data:auth}=await supabase.auth.getUser();
      const normalizedMethod=paymentMethod.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
      const {error}=await db.from("payments").insert({work_order_id:orderId,amount,method:normalizedMethod,installments,status:"confirmado",paid_at:new Date().toISOString(),created_by:auth.user?.id??null});if(error)throw error;
      const newPaid=paid+amount;const payment_status=newPaid>=Number(order.total||0)-0.009?"pago":"parcial";
      const {error:orderError}=await db.from("work_orders").update({payment_status,updated_at:new Date().toISOString()}).eq("id",orderId);if(orderError)throw orderError;
      setPaymentAmount("");await load();setSuccess("Pagamento registrado.");
    }catch(e:any){setError(e.message??"Não foi possível registrar o pagamento.")}finally{setSaving(false)}
  }

  if(loading)return <div className="rounded-2xl bg-white p-10 text-center"><Loader2 className="mx-auto size-6 animate-spin text-[#B97900]"/></div>;
  if(error&&!order)return <div className="rounded-2xl bg-red-50 p-5 text-red-700">{error}<button onClick={onBack} className="ml-3 underline">Voltar</button></div>;
  const customer=order.customers,vehicle=order.vehicles,documentPayload={order,services,parts,payments};

  return <div className="space-y-5">
    <div className="flex flex-col gap-4 rounded-3xl bg-[#111214] p-6 text-white sm:flex-row sm:items-center"><button onClick={onBack} className="rounded-xl border border-white/10 p-3"><ArrowLeft className="size-5"/></button><div className="flex-1"><p className="text-xs font-black uppercase tracking-[.18em] text-[#F0B323]">Ordem de serviço</p><h2 className="mt-1 text-3xl font-black">OS #{order.order_number}</h2><p className="mt-2 text-sm text-white/50">{customer?.name} • {vehicle?`${vehicle.brand} ${vehicle.model} • ${vehicle.plate}`:"Veículo"}</p></div><div className="flex flex-wrap justify-end gap-2">{canViewCommercial&&<><button onClick={()=>printWorkOrderDocument(documentPayload,"os")} className="rounded-xl border border-white/12 px-3 py-2 text-xs font-black"><FileText className="mr-1 inline size-4"/>OS / PDF</button><button onClick={()=>printWorkOrderDocument(documentPayload,"orcamento")} className="rounded-xl border border-white/12 px-3 py-2 text-xs font-black"><ReceiptText className="mr-1 inline size-4"/>Orçamento</button></>}{canViewFinancial&&paid>0&&<button onClick={()=>printWorkOrderDocument(documentPayload,"recibo")} className="rounded-xl bg-[#F0B323] px-3 py-2 text-xs font-black text-black">Recibo</button>}{canViewCommercial&&<div className="w-full text-right"><p className="text-xs text-white/40">Total</p><p className="text-2xl font-black text-[#FFC43D]">{money(Number(order.total||0))}</p></div>}</div></div>
    {(error||success)&&<div className={`rounded-xl p-3 text-sm font-bold ${error?"bg-red-50 text-red-700":"bg-emerald-50 text-emerald-700"}`}>{error??success}</div>}
    {userRole==="financeiro"&&<div className="rounded-xl bg-sky-50 p-3 text-sm font-bold text-sky-800">Visualização financeira: os controles operacionais desta OS ficam bloqueados para este perfil.</div>}

    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Status" value={STATUS_LABEL[order.status as OrderStatus]??order.status}/><Metric label="Aprovação" value={String(order.approval_status??"pendente")}/>{canViewFinancial&&<Metric label="Pagamento" value={String(order.payment_status??"pendente")}/>} {canViewCommercial&&<Metric label="Total" value={money(Number(order.total||0))}/>}</div>

    <Card title="Fluxo da oficina" icon={RefreshCw}><div className="flex flex-wrap items-center gap-2">{workflow.map((status,index)=><span key={status} className={`rounded-full px-3 py-2 text-xs font-black ${status===order.status?"bg-[#F0B323] text-black":index<currentIndex?"bg-emerald-100 text-emerald-700":"bg-black/5 text-black/40"}`}>{STATUS_LABEL[status]}</span>)}</div>{waitingApproval&&<p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm font-bold text-amber-800">O orçamento precisa ser aprovado antes da execução.</p>}{waitingPayment&&<p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm font-bold text-amber-800">Registre o pagamento integral antes de entregar o veículo.</p>}{!requirePaymentBeforeDelivery&&nextStatus==="entregue"&&order?.payment_status!=="pago"&&<p className="mt-4 rounded-xl bg-sky-50 p-3 text-sm font-bold text-sky-800">{canViewFinancial?`A oficina permite entrega com saldo em aberto. Saldo atual: ${money(balance)}.`:"A oficina permite entrega mesmo com pagamento ainda não integralmente registrado."}</p>}<div className="mt-4 flex flex-wrap gap-2">{canAdvance&&nextStatus&&<button disabled={saving} onClick={()=>void updateStatus(nextStatus)} className="goldButton">Avançar para {STATUS_LABEL[nextStatus]}</button>}{canCancel&&!closed&&<button disabled={saving} onClick={()=>void updateStatus("cancelada")} className="secondaryButton text-red-700">Cancelar OS</button>}{nextStatus&&!canAdvance&&!closed&&userRole==="tecnico"&&!technicalTransitions.includes(nextStatus as OrderStatus)&&<span className="rounded-xl bg-black/[.035] px-3 py-2 text-xs font-bold text-black/45">Próxima etapa exige atendimento/admin.</span>}</div></Card>

    {order.status==="aguardando_aprovacao"&&canApprove&&<Card title="Aprovação do orçamento" icon={CheckCircle2}><div className="flex flex-wrap gap-2"><button disabled={saving} onClick={()=>void approval("aprovado")} className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-black text-white">Aprovar orçamento</button>{allowPartialApproval&&<button disabled={saving} onClick={()=>void approval("parcial")} className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm font-black text-amber-800">Aprovação parcial</button>}<button disabled={saving} onClick={()=>void approval("recusado")} className="rounded-xl border border-red-200 px-4 py-2.5 text-sm font-black text-red-700">Recusar orçamento</button></div></Card>}

    <div className="grid gap-4 xl:grid-cols-[1.55fr_.9fr]"><div className="space-y-4">
      <Card title="Peças e mão de obra" icon={Wrench}><WorkOrderPartsPanel workOrderId={orderId} parts={parts} locked={closed||!canOperate}/></Card>
      <ServiceExecutionCommissionPanel workOrderId={orderId} services={services} locked={closed||!canOperate} userRole={userRole}/>
      <Card title="Fotos antes e depois" icon={ShieldCheck}><WorkOrderPhotosPanel workOrderId={orderId} vehicleId={order.vehicle_id} photos={photos} locked={closed||!canOperate}/></Card>
      {canOperate&&<Card title="Acompanhamento e WhatsApp" icon={CheckCircle2}><CustomerTrackingPanel order={order}/></Card>}
      <Card title="Histórico da OS" icon={Clock3}>{history.length===0?<p className="text-sm text-black/45">Nenhuma mudança registrada.</p>:<div className="space-y-2">{history.map((item:any)=><div key={item.id} className="flex gap-3 rounded-xl bg-black/[.025] p-3"><div className="mt-1.5 size-2 shrink-0 rounded-full bg-[#F0B323]"/><div><p className="text-sm font-bold">{item.from_status?`${STATUS_LABEL[item.from_status as OrderStatus]??item.from_status} → `:"Entrada → "}{STATUS_LABEL[item.to_status as OrderStatus]??item.to_status}</p><p className="mt-1 text-xs text-black/40">{new Date(item.created_at).toLocaleString("pt-BR")}</p></div></div>)}</div>}</Card>
    </div><div className="space-y-4">
      <Card title="Cliente completo" icon={ShieldCheck}>
        <Info label="Nome" value={customer?.name}/><Info label="WhatsApp / telefone" value={customer?.phone}/><Info label="CPF / CNPJ" value={customer?.cpf_cnpj}/><Info label="E-mail" value={customer?.email}/>
        <Info label="Endereço" value={[customer?.address,customer?.address_number].filter(Boolean).join(", ")}/><Info label="Bairro" value={customer?.neighborhood}/><Info label="Cidade / UF" value={[customer?.city,customer?.state].filter(Boolean).join(" / ")}/><Info label="CEP" value={customer?.cep}/><Info label="Observações do cliente" value={customer?.notes}/>
      </Card>
      <Card title="Veículo completo" icon={ShieldCheck}>
        <Info label="Veículo" value={vehicle?`${vehicle.brand??""} ${vehicle.model??""}`.trim():null}/><Info label="Versão" value={vehicle?.version}/><Info label="Placa" value={vehicle?.plate}/><Info label="Chassi / VIN" value={vehicle?.vin}/>
        <Info label="Ano fabricação / modelo" value={[vehicle?.year,vehicle?.model_year].filter(Boolean).join(" / ")}/><Info label="Cor" value={vehicle?.color}/><Info label="Combustível" value={vehicle?.fuel}/><Info label="KM atual" value={vehicle?.current_mileage?`${Number(vehicle.current_mileage).toLocaleString("pt-BR")} km`:null}/><Info label="Observações técnicas permanentes" value={vehicle?.notes}/>
      </Card>
      <Card title="Checklist completo de entrada" icon={CheckCircle2}>
        <div className="mb-3 grid grid-cols-2 gap-2"><Metric label="Conferidos" value={`${checklistDone}/15`}/><Metric label="Avarias" value={checklist?.damage_notes?"Registradas":"Sem observação"}/></div>
        <div className="grid gap-2 sm:grid-cols-2">{checklistLabels.map(([key,label])=><div key={key} className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold ${checklist?.[key]?"bg-emerald-50 text-emerald-700":"bg-black/[.035] text-black/40"}`}><CheckCircle2 className="size-3.5"/>{label}</div>)}</div>
        {checklist?.damage_notes&&<div className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900"><b>Avarias / observações:</b><p className="mt-1 whitespace-pre-wrap">{checklist.damage_notes}</p></div>}
      </Card>
      <Card title="Dados técnicos da OS" icon={Wrench}>
        {canOperate?<><EditField label="Quilometragem de entrada" value={edit.mileage_in} onChange={v=>setEdit({...edit,mileage_in:v})}/><EditField label="Nível de combustível" value={edit.fuel_level} onChange={v=>setEdit({...edit,fuel_level:v})}/><EditArea label="Relato do cliente" value={edit.customer_report} onChange={v=>setEdit({...edit,customer_report:v})}/><EditArea label="Diagnóstico" value={edit.diagnosis} onChange={v=>setEdit({...edit,diagnosis:v})}/><EditArea label="Observações para o cliente" value={edit.customer_notes} onChange={v=>setEdit({...edit,customer_notes:v})}/><EditArea label="Observações internas" value={edit.internal_notes} onChange={v=>setEdit({...edit,internal_notes:v})}/><label className="block text-xs font-black uppercase text-black/40">Previsão de entrega<input type="datetime-local" className="field mt-1" value={edit.promised_at} onChange={e=>setEdit({...edit,promised_at:e.target.value})}/></label>{!closed&&<button disabled={saving} onClick={()=>void saveTechnicalData()} className="goldButton mt-3 w-full">Salvar dados técnicos</button>}</>:<><Info label="Quilometragem de entrada" value={order.mileage_in?`${Number(order.mileage_in).toLocaleString("pt-BR")} km`:null}/><Info label="Nível de combustível" value={order.fuel_level}/><Info label="Relato do cliente" value={order.customer_report}/><Info label="Diagnóstico" value={order.diagnosis}/><Info label="Observações para o cliente" value={order.customer_notes}/><Info label="Previsão de entrega" value={order.promised_at?new Date(order.promised_at).toLocaleString("pt-BR"):null}/></>}
      </Card>
      {canViewFinancial&&<Card title="Financeiro da OS" icon={CreditCard}><div className="grid grid-cols-2 gap-3"><Metric label="Serviços" value={money(Number(order.subtotal_services||0))}/><Metric label="Peças" value={money(Number(order.subtotal_parts||0))}/><Metric label="Desconto" value={money(Number(order.discount||0))}/><Metric label="Total" value={money(Number(order.total||0))}/><Metric label="Recebido" value={money(paid)}/><Metric label="Saldo" value={money(balance)}/></div>{!closed&&balance>0.009&&canReceivePayment&&<div className="mt-4 grid gap-2"><input type="number" min="0.01" step="0.01" className="field" placeholder={`Valor a receber (${money(balance)})`} value={paymentAmount} onChange={e=>setPaymentAmount(e.target.value)}/><select className="field" value={paymentMethod} onChange={e=>setPaymentMethod(e.target.value)}>{enabledPaymentMethods.map(m=><option key={m}>{m}</option>)}</select><input type="number" min="1" max="24" className="field" value={installments} onChange={e=>setInstallments(Math.max(1,Number(e.target.value)||1))}/><button disabled={saving||enabledPaymentMethods.length===0} onClick={()=>void addPayment()} className="goldButton"><CreditCard className="size-4"/>Registrar pagamento</button>{enabledPaymentMethods.length===0&&<p className="text-xs font-bold text-amber-700">Nenhuma forma de pagamento está habilitada nas Configurações.</p>}</div>}{payments.length>0&&<div className="mt-4 space-y-2">{payments.map(p=><div key={p.id} className="flex items-center justify-between rounded-xl bg-black/[.03] p-3 text-xs"><span>{String(p.method||"—")} • {p.installments||1}x • {p.status||"—"} • {p.paid_at?new Date(p.paid_at).toLocaleString("pt-BR"):""}</span><strong>{money(Number(p.amount||0))}</strong></div>)}</div>}</Card>}
    </div></div>
  </div>;
}

function Card({title,icon:Icon,children}:{title:string;icon:any;children:React.ReactNode}){return <section className="rounded-2xl border border-black/6 bg-white p-5 shadow-sm"><div className="mb-4 flex items-center gap-3"><div className="flex size-9 items-center justify-center rounded-xl bg-[#F0B323]/15 text-[#8A5F00]"><Icon className="size-4"/></div><h3 className="flex-1 font-black">{title}</h3></div>{children}</section>}
function Info({label,value}:{label:string;value:any}){if(value===null||value===undefined||value==="")return null;return <div className="border-b border-black/5 py-2 last:border-0"><p className="text-[10px] font-black uppercase tracking-wider text-black/35">{label}</p><p className="mt-1 whitespace-pre-wrap text-sm font-semibold">{String(value)}</p></div>}
function Metric({label,value}:{label:string;value:string}){return <div className="rounded-xl bg-black/[.025] p-3"><p className="text-[10px] font-black uppercase tracking-wider text-black/35">{label}</p><p className="mt-1 font-black">{value}</p></div>}
function EditField({label,value,onChange}:{label:string;value:string;onChange:(value:string)=>void}){return <label className="mb-3 block text-xs font-black uppercase text-black/40">{label}<input className="field mt-1" value={value} onChange={e=>onChange(e.target.value)}/></label>}
function EditArea({label,value,onChange}:{label:string;value:string;onChange:(value:string)=>void}){return <label className="mb-3 block text-xs font-black uppercase text-black/40">{label}<textarea className="field mt-1" rows={3} value={value} onChange={e=>onChange(e.target.value)}/></label>}
