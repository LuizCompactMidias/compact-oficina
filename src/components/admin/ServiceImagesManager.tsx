import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Image as ImageIcon, Loader2, Save, Trash2, Upload } from "lucide-react";
import { removeServiceCardImage, saveServiceCardImageSettings, serviceImagePublicUrl, uploadServiceCardImage, useServiceCardImages, type ServiceImagePosition } from "@/lib/service-image-admin";

const services = [
  { slug: "troca-de-oleo", title: "Troca de óleo e filtros", category: "Manutenção" },
  { slug: "freios", title: "Freios", category: "Freios" },
  { slug: "alinhamento-balanceamento", title: "Alinhamento e balanceamento", category: "Pneus e geometria" },
  { slug: "pneus", title: "Pneus", category: "Pneus" },
  { slug: "mecanica-geral", title: "Mecânica em geral", category: "Mecânica" },
  { slug: "eletrica", title: "Elétrica automotiva", category: "Elétrica" },
  { slug: "embreagem", title: "Embreagem", category: "Transmissão" },
  { slug: "check-up", title: "Revisão e check-up geral", category: "Revisão" },
] as const;

const positions: Array<{ value: ServiceImagePosition; label: string }> = [
  { value: "center", label: "Centro" }, { value: "top", label: "Topo" }, { value: "bottom", label: "Base" }, { value: "left", label: "Esquerda" }, { value: "right", label: "Direita" },
];

type Draft = { altText: string; objectPosition: ServiceImagePosition };

export function ServiceImagesManager() {
  const qc = useQueryClient();
  const { data = [], isLoading, error } = useServiceCardImages();
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [files, setFiles] = useState<Record<string, File | undefined>>({});
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const bySlug = useMemo(() => new Map(data.map((row) => [row.service_slug, row])), [data]);

  useEffect(() => {
    const next: Record<string, Draft> = {};
    for (const service of services) {
      const current = bySlug.get(service.slug);
      next[service.slug] = { altText: current?.alt_text || `${service.title} na COMPACT Centro Automotivo`, objectPosition: current?.object_position || "center" };
    }
    setDrafts(next);
  }, [bySlug]);

  function patch(slug: string, value: Partial<Draft>) {
    setDrafts((current) => ({ ...current, [slug]: { ...(current[slug] ?? { altText: "", objectPosition: "center" }), ...value } }));
    setMessage(null); setActionError(null);
  }

  function chooseFile(slug: string, file?: File) {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return setActionError("Use uma imagem JPG, PNG ou WebP.");
    if (file.size > 5 * 1024 * 1024) return setActionError("A imagem deve ter no máximo 5 MB.");
    setFiles((current) => ({ ...current, [slug]: file }));
    const reader = new FileReader();
    reader.onload = () => { if (typeof reader.result === "string") setPreviews((current) => ({ ...current, [slug]: reader.result as string })); };
    reader.readAsDataURL(file);
  }

  async function refresh() {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["service_card_images"] }),
      qc.invalidateQueries({ queryKey: ["public_service_card_images"] }),
    ]);
  }

  async function upload(slug: string) {
    const service = services.find((item) => item.slug === slug), file = files[slug], draft = drafts[slug];
    if (!service || !file || !draft) return;
    setBusy(slug); setMessage(null); setActionError(null);
    try {
      await uploadServiceCardImage({ serviceSlug: slug, serviceTitle: service.title, file, altText: draft.altText, objectPosition: draft.objectPosition });
      setFiles((current) => ({ ...current, [slug]: undefined }));
      setPreviews((current) => { const next = { ...current }; delete next[slug]; return next; });
      await refresh();
      setMessage(`Imagem de “${service.title}” publicada no site.`);
    } catch (err) { setActionError(err instanceof Error ? err.message : "Não foi possível publicar a imagem."); }
    finally { setBusy(null); }
  }

  async function saveSettings(slug: string) {
    const service = services.find((item) => item.slug === slug), current = bySlug.get(slug), draft = drafts[slug];
    if (!service || !current?.image_path || !draft) return;
    setBusy(slug); setMessage(null); setActionError(null);
    try {
      await saveServiceCardImageSettings({ serviceSlug: slug, serviceTitle: service.title, imagePath: current.image_path, altText: draft.altText, objectPosition: draft.objectPosition });
      await refresh(); setMessage(`Enquadramento e SEO de “${service.title}” atualizados.`);
    } catch (err) { setActionError(err instanceof Error ? err.message : "Não foi possível salvar os ajustes."); }
    finally { setBusy(null); }
  }

  async function remove(slug: string) {
    const service = services.find((item) => item.slug === slug);
    if (!service || !window.confirm(`Remover a imagem personalizada de “${service.title}”?`)) return;
    setBusy(slug); setMessage(null); setActionError(null);
    try { await removeServiceCardImage(slug); await refresh(); setMessage(`Imagem personalizada de “${service.title}” removida.`); }
    catch (err) { setActionError(err instanceof Error ? err.message : "Não foi possível remover a imagem."); }
    finally { setBusy(null); }
  }

  if (isLoading) return <div className="flex min-h-40 items-center justify-center rounded-2xl bg-white"><Loader2 className="size-6 animate-spin text-[#B97900]" /></div>;
  if (error) return <div className="rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-700">Não foi possível carregar as imagens dos serviços.</div>;

  return <div className="space-y-5">
    <div className="rounded-3xl bg-[#111214] p-6 text-white"><p className="text-xs font-black uppercase tracking-[.2em] text-[#F0B323]">Site público</p><h2 className="mt-1 text-2xl font-black">Imagens dos serviços</h2><p className="mt-2 text-sm text-white/45">Publique uma foto por serviço. Ela passa a aparecer nos cards da Home e na página individual do serviço.</p></div>
    {(message || actionError) && <div className={`rounded-xl p-3 text-sm font-bold ${actionError ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>{actionError ?? message}</div>}
    <div className="grid gap-5 xl:grid-cols-2">{services.map((service) => {
      const current = bySlug.get(service.slug), draft = drafts[service.slug] ?? { altText: `${service.title} na COMPACT Centro Automotivo`, objectPosition: "center" as ServiceImagePosition };
      const selected = files[service.slug], preview = previews[service.slug] || (current?.image_path ? `${serviceImagePublicUrl(current.image_path)}?v=${encodeURIComponent(current.updated_at)}` : "");
      const loading = busy === service.slug;
      return <article key={service.slug} className="overflow-hidden rounded-3xl border border-black/7 bg-white shadow-sm">
        <div className="grid sm:grid-cols-[220px_1fr]">
          <div className="relative min-h-52 bg-[#0d0d0f]">{preview ? <img src={preview} alt={draft.altText || service.title} className="h-full min-h-52 w-full object-cover" style={{ objectPosition: draft.objectPosition }} /> : <div className="flex min-h-52 h-full items-center justify-center"><ImageIcon className="size-12 text-[#F0B323]/35" /></div>}<span className="absolute left-3 top-3 rounded-full bg-black/75 px-3 py-1 text-[10px] font-black uppercase text-white">{selected ? "Prévia" : current?.image_path ? "Publicada" : "Sem imagem"}</span></div>
          <div className="p-5"><p className="text-[10px] font-black uppercase tracking-[.16em] text-[#B97900]">{service.category}</p><h3 className="mt-1 text-lg font-black">{service.title}</h3>
            <div className="mt-4 space-y-3"><label className="block text-xs font-bold text-black/60">Texto alternativo (SEO)<input className="field mt-1" value={draft.altText} onChange={(e) => patch(service.slug, { altText: e.target.value })} /></label><label className="block text-xs font-bold text-black/60">Enquadramento<select className="field mt-1" value={draft.objectPosition} onChange={(e) => patch(service.slug, { objectPosition: e.target.value as ServiceImagePosition })}>{positions.map((position) => <option key={position.value} value={position.value}>{position.label}</option>)}</select></label></div>
            <div className="mt-4 flex flex-wrap gap-2 border-t border-black/6 pt-4"><label className="secondaryButton cursor-pointer"><ImageIcon className="size-4" />{selected ? "Trocar foto" : "Escolher foto"}<input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => { chooseFile(service.slug, e.currentTarget.files?.[0]); e.currentTarget.value = ""; }} /></label>{selected && <button disabled={loading} onClick={() => void upload(service.slug)} className="goldButton">{loading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}Publicar</button>}{current?.image_path && <button disabled={loading} onClick={() => void saveSettings(service.slug)} className="secondaryButton"><Save className="size-4" />Salvar ajustes</button>}{current?.image_path && <button disabled={loading} onClick={() => void remove(service.slug)} className="secondaryButton text-red-700"><Trash2 className="size-4" />Remover</button>}</div>
            {selected && <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700"><CheckCircle2 className="size-4" />{selected.name}</p>}
          </div>
        </div>
      </article>;
    })}</div>
  </div>;
}
