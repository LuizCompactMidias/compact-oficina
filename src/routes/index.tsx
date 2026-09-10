import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, CalendarCheck, Car, CheckCircle2, ClipboardList, Gauge, MessageCircle, ShieldCheck, Sparkles, Wrench } from "lucide-react";
import { BRAND } from "@/lib/brand";

export const Route = createFileRoute("/")({ component: HomePage });

const services = [
  "Troca de óleo e filtros", "Freios", "Alinhamento e balanceamento", "Pneus", "Mecânica em geral", "Elétrica automotiva", "Embreagem", "Revisão e check-up geral",
];

function HomePage() {
  return <main className="min-h-screen bg-[#070707] text-white">
    <header className="sticky top-0 z-50 border-b border-white/8 bg-[#070707]/90 backdrop-blur-xl">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 lg:px-8">
        <img src={BRAND.logoUrl} alt={BRAND.name} className="h-12 w-auto object-contain" />
        <nav className="hidden items-center gap-7 text-sm font-semibold text-white/65 md:flex"><a href="#servicos" className="hover:text-[#FFC43D]">Serviços</a><a href="#gestao" className="hover:text-[#FFC43D]">Tecnologia</a><a href="#contato" className="hover:text-[#FFC43D]">Contato</a></nav>
        <Link to="/login" className="rounded-xl border border-[#F0B323]/55 bg-[#F0B323]/10 px-4 py-2.5 text-sm font-black text-[#FFC43D] transition hover:bg-[#F0B323] hover:text-black">Área administrativa</Link>
      </div>
    </header>

    <section className="compact-grid relative overflow-hidden">
      <div className="absolute -left-24 top-20 size-72 rounded-full bg-[#F0B323]/10 blur-3xl" /><div className="absolute -right-24 bottom-0 size-96 rounded-full bg-[#F0B323]/8 blur-3xl" />
      <div className="relative mx-auto grid min-h-[720px] max-w-7xl items-center gap-12 px-5 py-20 lg:grid-cols-[1.08fr_.92fr] lg:px-8">
        <div><div className="inline-flex items-center gap-2 rounded-full border border-[#F0B323]/25 bg-[#F0B323]/8 px-4 py-2 text-xs font-black uppercase tracking-[.2em] text-[#FFC43D]"><Sparkles className="size-4" /> Centro automotivo conectado</div><h1 className="mt-7 max-w-4xl text-5xl font-black leading-[.96] tracking-[-.05em] sm:text-6xl xl:text-7xl">Seu carro cuidado com <span className="compact-gold-text">tecnologia, transparência e confiança.</span></h1><p className="mt-7 max-w-2xl text-lg leading-8 text-white/58">Atendimento moderno, acompanhamento de serviços e gestão profissional do primeiro contato até a entrega do veículo.</p><div className="mt-9 flex flex-wrap gap-3"><a href="#contato" className="inline-flex items-center gap-2 rounded-2xl bg-[#F0B323] px-6 py-4 font-black text-black shadow-2xl shadow-amber-500/10 transition hover:bg-[#FFC43D]">Agendar atendimento <ArrowRight className="size-5" /></a><a href="#servicos" className="rounded-2xl border border-white/12 bg-white/[.03] px-6 py-4 font-bold text-white/80 hover:border-[#F0B323]/45">Conhecer serviços</a></div><div className="mt-10 grid max-w-2xl grid-cols-3 gap-3"><MiniStat icon={ShieldCheck} title="Confiança" text="Histórico organizado"/><MiniStat icon={Gauge} title="Agilidade" text="Fluxo de OS digital"/><MiniStat icon={MessageCircle} title="Transparência" text="Cliente acompanha"/></div></div>
        <div className="relative mx-auto w-full max-w-xl"><div className="compact-glow rounded-[2rem] border border-[#F0B323]/22 bg-gradient-to-b from-[#171719] to-[#0c0c0d] p-5"><div className="rounded-[1.5rem] border border-white/8 bg-black/50 p-6"><img src={BRAND.iconUrl} alt="" className="compact-float mx-auto w-[62%] max-w-72"/><div className="mt-7 grid grid-cols-2 gap-3"><Feature icon={ClipboardList} title="Ordem de serviço" text="Fluxo completo"/><Feature icon={CalendarCheck} title="Agenda" text="Horários e retornos"/><Feature icon={Car} title="Veículos" text="Histórico por placa"/><Feature icon={Wrench} title="Oficina" text="Serviços e estoque"/></div></div></div></div>
      </div>
    </section>

    <section id="servicos" className="border-y border-white/8 bg-[#0d0d0f] py-24"><div className="mx-auto max-w-7xl px-5 lg:px-8"><p className="text-xs font-black uppercase tracking-[.24em] text-[#F0B323]">Serviços</p><h2 className="mt-3 max-w-3xl text-4xl font-black tracking-tight sm:text-5xl">Tudo que sua oficina precisa apresentar ao cliente.</h2><div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{services.map((service,i)=><div key={service} className="group rounded-2xl border border-white/8 bg-white/[.025] p-5 transition hover:-translate-y-1 hover:border-[#F0B323]/35"><div className="flex size-10 items-center justify-center rounded-xl bg-[#F0B323]/10 text-[#FFC43D]"><Wrench className="size-5"/></div><h3 className="mt-5 font-black">{service}</h3><p className="mt-2 text-sm leading-6 text-white/45">Atendimento técnico com registro e acompanhamento digital.</p></div>)}</div></div></section>

    <section id="gestao" className="py-24"><div className="mx-auto grid max-w-7xl gap-12 px-5 lg:grid-cols-2 lg:items-center lg:px-8"><div><p className="text-xs font-black uppercase tracking-[.24em] text-[#F0B323]">Tecnologia aplicada</p><h2 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">Da recepção à entrega, cada etapa fica registrada.</h2><p className="mt-6 text-lg leading-8 text-white/50">A plataforma COMPACT reúne clientes, veículos, orçamentos, ordens de serviço, agenda, estoque e financeiro em um único painel.</p></div><div className="grid gap-3 sm:grid-cols-2">{["Cadastro de clientes e veículos","Orçamentos e conversão em OS","Fotos e checklist do veículo","Status e acompanhamento do cliente","Serviços, peças e estoque","Financeiro, despesas e relatórios","Agenda operacional","Usuários e permissões"].map(item=><div key={item} className="flex items-center gap-3 rounded-2xl border border-white/8 bg-[#111214] p-4"><CheckCircle2 className="size-5 shrink-0 text-[#F0B323]"/><span className="font-semibold text-white/75">{item}</span></div>)}</div></div></section>

    <section id="contato" className="pb-24"><div className="mx-auto max-w-7xl px-5 lg:px-8"><div className="rounded-[2rem] border border-[#F0B323]/20 bg-gradient-to-r from-[#17130b] to-[#111214] p-8 sm:p-12"><p className="text-sm font-black uppercase tracking-[.22em] text-[#F0B323]">Atendimento</p><div className="mt-4 flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between"><div><h2 className="max-w-3xl text-3xl font-black sm:text-4xl">Pronto para cuidar do seu veículo?</h2><p className="mt-3 max-w-2xl text-white/50">Configure telefone, WhatsApp, endereço e redes sociais no painel administrativo para cada oficina que receber este template.</p></div><Link to="/login" className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-[#F0B323] px-6 py-4 font-black text-black">Entrar no sistema <ArrowRight className="size-5"/></Link></div></div></div></section>
    <footer className="border-t border-white/8 py-8"><div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 text-sm text-white/35 sm:flex-row sm:items-center sm:justify-between lg:px-8"><span>© {new Date().getFullYear()} {BRAND.name}</span><span>Projeto-base replicável para centros automotivos.</span></div></footer>
  </main>;
}

function MiniStat({icon:Icon,title,text}:{icon:any;title:string;text:string}){return <div className="rounded-2xl border border-white/8 bg-white/[.025] p-4"><Icon className="size-5 text-[#F0B323]"/><p className="mt-3 text-sm font-black">{title}</p><p className="mt-1 text-xs text-white/38">{text}</p></div>}
function Feature({icon:Icon,title,text}:{icon:any;title:string;text:string}){return <div className="rounded-2xl border border-white/8 bg-white/[.025] p-4"><Icon className="size-5 text-[#F0B323]"/><p className="mt-3 text-sm font-black">{title}</p><p className="mt-1 text-xs text-white/35">{text}</p></div>}
