import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, CheckCircle2, Loader2, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ManualItemsEditor } from "@/components/admin/ManualItemsEditor";
import { money, useCustomers } from "@/lib/porfirid-queries";
import { createWorkOrderIntakeV2, type ManualLineItem } from "@/lib/work-order-intake-v2";

const db = supabase as any;
type Props = { onCreated?: (result: { id: string; orderNumber: number; total: number }) => void };
type ChecklistKey = "mileage_checked" | "fuel_checked" | "front_checked" | "rear_checked" | "left_side_checked" | "right_side_checked" | "wheels_checked" | "tires_checked" | "lights_checked" | "windshield_checked" | "interior_checked" | "dashboard_checked" | "spare_tire_checked" | "tools_checked" | "belongings_checked";

const checklistItems: Array<[ChecklistKey, string]> = [
  ["mileage_checked", "Quilometragem conferida"], ["fuel_checked", "Nível de combustível"], ["front_checked", "Frente do veículo"],
  ["rear_checked", "Traseira do veículo"], ["left_side_checked", "Lateral esquerda"], ["right_side_checked", "Lateral direita"],
  ["wheels_checked", "Rodas"], ["tires_checked", "Pneus"], ["lights_checked", "Iluminação"], ["windshield_checked", "Para-brisa"],
  ["interior_checked", "Interior"], ["dashboard_checked", "Painel / alertas"], ["spare_tire_checked", "Estepe"],
  ["tools_checked", "Ferramentas / macaco"], ["belongings_checked", "Pertences no veículo"],
];

const blankLine = (): ManualLineItem => ({ description: "", quantity: 1, unit_price: 0 });
const emptyChecklist = () => Object.fromEntries(checklistItems.map(([key]) => [key, false])) as Record<ChecklistKey, boolean>;

export function NewWorkOrderFlow({ onCreated }: Props) {
  const queryClient = useQueryClient();
  const { data: customers = [] } = useCustomers();
  const { data: allVehicles = [] } = useQuery({
    queryKey: ["vehicle_options"],
    queryFn: async () => {
      const { data, error } = await db.from("vehicles").select("id,customer_id,plate,brand,model,version,year,model_year,color,fuel,current_mileage,notes").order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const [customerMode, setCustomerMode] = useState<"new" | "existing">(customers.length ? "existing" : "new");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [vehicleMode, setVehicleMode] = useState<"new" | "existing">("new");
  const [selectedVehicleId, setSelectedVehicleId] = useState("");
  const [parts, setParts] = useState<ManualLineItem[]>([blankLine()]);
  const [labor, setLabor] = useState<ManualLineItem[]>([blankLine()]);
  const [photos, setPhotos] = useState<File[]>([]);
  const [checklist, setChecklist] = useState<Record<ChecklistKey, boolean>>(emptyChecklist());
  const [discount, setDiscount] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ id: string; orderNumber: number; total: number; photoWarnings: string[] } | null>(null);

  useEffect(() => {
    if (!customers.length && customerMode === "existing") setCustomerMode("new");
  }, [customers.length, customerMode]);

  const customerVehicles = useMemo(() => allVehicles.filter((vehicle: any) => vehicle.customer_id === selectedCustomerId), [allVehicles, selectedCustomerId]);
  const itemsTotal = useMemo(() => [...parts, ...labor].reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unit_price || 0), 0), [parts, labor]);
  const estimatedTotal = Math.max(itemsTotal - Number(discount || 0), 0);

  function chooseCustomer(id: string) {
    setSelectedCustomerId(id);
    setSelectedVehicleId("");
    const vehicles = allVehicles.filter((vehicle: any) => vehicle.customer_id === id);
    setVehicleMode(vehicles.length ? "existing" : "new");
  }

  function resetFormState() {
    setParts([blankLine()]);
    setLabor([blankLine()]);
    setPhotos([]);
    setChecklist(emptyChecklist());
    setDiscount(0);
    setSelectedCustomerId("");
    setSelectedVehicleId("");
    setCustomerMode(customers.length ? "existing" : "new");
    setVehicleMode("new");
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setError(null);
    setSuccess(null);

    const cleanParts = parts.filter((item) => item.description.trim());
    const cleanLabor = labor.filter((item) => item.description.trim());
    if (!cleanParts.length && !cleanLabor.length) return setError("Informe pelo menos uma peça ou mão de obra.");
    if (customerMode === "existing" && !selectedCustomerId) return setError("Selecione o cliente.");
    if (customerMode === "new" && (!String(form.get("customer_name") ?? "").trim() || !String(form.get("customer_phone") ?? "").trim())) return setError("Preencha nome e WhatsApp do cliente.");
    if (vehicleMode === "existing" && !selectedVehicleId) return setError("Selecione o veículo.");
    if (vehicleMode === "new" && ["plate", "brand", "model"].some((name) => !String(form.get(name) ?? "").trim())) return setError("Preencha placa, marca e modelo do veículo.");

    setSubmitting(true);
    try {
      const result = await createWorkOrderIntakeV2({
        customer: customerMode === "existing" ? { id: selectedCustomerId } : {
          name: String(form.get("customer_name") ?? "").trim(),
          phone: String(form.get("customer_phone") ?? "").trim(),
          cpf_cnpj: String(form.get("cpf_cnpj") ?? "").trim(),
          email: String(form.get("customer_email") ?? "").trim(),
          city: String(form.get("city") ?? "").trim(),
          state: String(form.get("state") ?? "").trim().toUpperCase(),
          notes: String(form.get("customer_notes") ?? "").trim(),
        },
        vehicle: vehicleMode === "existing" ? {
          id: selectedVehicleId,
          current_mileage: String(form.get("mileage_in") ?? "").replace(/\D/g, ""),
        } : {
          plate: String(form.get("plate") ?? "").trim().toUpperCase(),
          brand: String(form.get("brand") ?? "").trim(),
          model: String(form.get("model") ?? "").trim(),
          version: String(form.get("version") ?? "").trim(),
          year: String(form.get("year") ?? "").trim(),
          model_year: String(form.get("model_year") ?? "").trim(),
          color: String(form.get("color") ?? "").trim(),
          fuel: String(form.get("vehicle_fuel") ?? "").trim(),
          current_mileage: String(form.get("mileage_in") ?? "").replace(/\D/g, ""),
          notes: String(form.get("vehicle_notes") ?? "").trim(),
        },
        order: {
          mileage_in: String(form.get("mileage_in") ?? "").replace(/\D/g, ""),
          fuel_level: String(form.get("fuel_level") ?? "").trim(),
          promised_at: String(form.get("promised_at") ?? "").trim(),
          customer_report: String(form.get("customer_report") ?? "").trim(),
          internal_notes: String(form.get("internal_notes") ?? "").trim(),
          discount: String(discount || 0),
        },
        checklist: { ...checklist, damage_notes: String(form.get("damage_notes") ?? "").trim() },
        parts: cleanParts,
        labor: cleanLabor,
        photos,
      });
      setSuccess(result);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
        queryClient.invalidateQueries({ queryKey: ["customers"] }),
        queryClient.invalidateQueries({ queryKey: ["customer_directory"] }),
        queryClient.invalidateQueries({ queryKey: ["vehicles"] }),
        queryClient.invalidateQueries({ queryKey: ["vehicle_directory"] }),
        queryClient.invalidateQueries({ queryKey: ["vehicle_options"] }),
        queryClient.invalidateQueries({ queryKey: ["work_orders"] }),
        queryClient.invalidateQueries({ queryKey: ["inventory_items"] }),
      ]);
      onCreated?.(result);
      formElement.reset();
      resetFormState();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível criar a OS.");
    } finally {
      setSubmitting(false);
    }
  }

  if (success) return <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6"><div className="flex flex-col gap-4 sm:flex-row"><div className="self-start rounded-2xl bg-emerald-600 p-3 text-white"><CheckCircle2 className="size-6" /></div><div><p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">OS criada</p><h3 className="mt-1 text-2xl font-black">OS #{success.orderNumber}</h3><p className="mt-2 text-sm text-black/55">Peças e mão de obra registradas. Total inicial: <strong>{money(success.total)}</strong>.</p>{success.photoWarnings.length > 0 && <p className="mt-2 text-xs font-semibold text-amber-700">{success.photoWarnings.length} foto(s) precisam ser reenviadas.</p>}<button type="button" onClick={() => setSuccess(null)} className="goldButton mt-4">Abrir outra OS</button></div></div></div>;

  return <form onSubmit={submit} className="overflow-hidden rounded-3xl border border-[#F0B323]/25 bg-white shadow-sm">
    <div className="bg-[#111214] px-5 py-5 text-white"><p className="text-xs font-black uppercase tracking-[0.2em] text-[#F0B323]">Nova ordem de serviço</p><h3 className="mt-1 text-xl font-black">Entrada do veículo</h3><p className="mt-1 text-xs text-white/45">Mesmo fluxo operacional da PORFIRIO: cliente, veículo, itens, entrada, checklist, fotos e observações.</p></div>
    <div className="space-y-7 p-5 sm:p-6">
      <Section title="1. Cliente">
        <ModeSwitch value={customerMode} onChange={(mode) => { setCustomerMode(mode); setSelectedCustomerId(""); setSelectedVehicleId(""); setVehicleMode("new"); }} existingLabel={`Cliente existente (${customers.length})`} newLabel="Novo cliente" disableExisting={!customers.length} />
        {customerMode === "existing" ? <label className="mt-3 block space-y-1.5 text-sm font-semibold"><span>Cliente *</span><select value={selectedCustomerId} onChange={(e) => chooseCustomer(e.target.value)} className="field"><option value="">Selecione...</option>{customers.map((customer: any) => <option key={customer.id} value={customer.id}>{customer.name} • {customer.phone}</option>)}</select></label> : <><div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4"><Field name="customer_name" label="Nome *" /><Field name="customer_phone" label="WhatsApp *" /><Field name="cpf_cnpj" label="CPF / CNPJ" /><Field name="customer_email" label="E-mail" type="email" /><Field name="city" label="Cidade" /><Field name="state" label="UF" maxLength={2} /></div><TextArea name="customer_notes" label="Observações do cliente" /></>}
      </Section>

      <Section title="2. Veículo">
        {customerMode === "existing" && selectedCustomerId && <ModeSwitch value={vehicleMode} onChange={(mode) => { setVehicleMode(mode); setSelectedVehicleId(""); }} existingLabel={`Veículo existente (${customerVehicles.length})`} newLabel="Novo veículo" disableExisting={!customerVehicles.length} />}
        {vehicleMode === "existing" && customerMode === "existing" ? <label className="mt-3 block space-y-1.5 text-sm font-semibold"><span>Veículo *</span><select value={selectedVehicleId} onChange={(e) => setSelectedVehicleId(e.target.value)} className="field"><option value="">Selecione...</option>{customerVehicles.map((vehicle: any) => <option key={vehicle.id} value={vehicle.id}>{vehicle.brand} {vehicle.model} • {vehicle.plate}</option>)}</select></label> : <><div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4"><Field name="plate" label="Placa *" /><Field name="brand" label="Marca *" /><Field name="model" label="Modelo *" /><Field name="version" label="Versão" /><Field name="year" label="Ano fabricação" type="number" /><Field name="model_year" label="Ano modelo" type="number" /><Field name="color" label="Cor" /><Field name="vehicle_fuel" label="Combustível" /></div><TextArea name="vehicle_notes" label="Observações técnicas permanentes do veículo" rows={2} /></>}
      </Section>

      <Section title="3. Peças — primeiros itens da OS"><ManualItemsEditor title="Peças utilizadas" subtitle="Selecione do estoque ou digite a peça manualmente, quantidade e valor." singular="peça" items={parts} onChange={setParts} /></Section>
      <Section title="4. Mão de obra"><ManualItemsEditor title="Mão de obra / serviços" subtitle="Informe a descrição do serviço, quantidade e valor da mão de obra." singular="mão de obra" items={labor} onChange={setLabor} /></Section>

      <Section title="5. Entrada, checklist e fotos">
        <div className="grid gap-3 md:grid-cols-3"><Field name="mileage_in" label="Quilometragem" /><Field name="fuel_level" label="Nível de combustível" placeholder="Ex.: 1/2 tanque" /><Field name="promised_at" label="Previsão de entrega" type="datetime-local" /></div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{checklistItems.map(([key, label]) => <label key={key} className="flex items-center gap-2 rounded-xl bg-[#fafafa] px-3 py-2.5 text-xs font-semibold"><input type="checkbox" checked={checklist[key]} onChange={(e) => setChecklist((current) => ({ ...current, [key]: e.target.checked }))} className="accent-[#F0B323]" />{label}</label>)}</div>
        <TextArea name="damage_notes" label="Avarias / observações de entrada" rows={2} />
        <div className="mt-4"><label className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-black/10 bg-white px-4 py-3 text-sm font-black sm:inline-flex sm:w-auto"><Camera className="size-4 text-[#9B6600]" />Anexar fotos de entrada<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple className="hidden" onChange={(e) => setPhotos((current) => [...current, ...Array.from(e.target.files ?? [])])} /></label>{photos.length > 0 && <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">{photos.map((file, index) => <PhotoPreview key={`${file.name}-${index}`} file={file} onRemove={() => setPhotos((current) => current.filter((_, i) => i !== index))} />)}</div>}</div>
      </Section>

      <Section title="6. Relato, observações e total">
        <div className="grid gap-3 lg:grid-cols-2"><TextArea name="customer_report" label="Relato do cliente" /><TextArea name="internal_notes" label="Observações internas" /></div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 sm:items-end"><label className="space-y-1.5 text-sm font-semibold"><span>Desconto</span><input type="number" min="0" step="0.01" value={discount} onChange={(e) => setDiscount(Number(e.target.value))} className="field" /></label><div className="rounded-2xl bg-[#111214] p-4 text-white"><p className="text-xs text-white/45">Total inicial da OS</p><p className="mt-1 text-2xl font-black text-[#FFC43D]">{money(estimatedTotal)}</p></div></div>
      </Section>

      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}
      <button disabled={submitting} type="submit" className="goldButton w-full justify-center py-4 text-sm">{submitting && <Loader2 className="size-4 animate-spin" />}Finalizar abertura da OS</button>
    </div>
  </form>;
}

function ModeSwitch({ value, onChange, existingLabel, newLabel, disableExisting = false }: { value: "new" | "existing"; onChange: (value: "new" | "existing") => void; existingLabel: string; newLabel: string; disableExisting?: boolean }) {
  return <div className="grid w-full grid-cols-1 gap-1 rounded-xl bg-black/5 p-1 sm:inline-grid sm:w-auto sm:grid-cols-2"><button type="button" disabled={disableExisting} onClick={() => onChange("existing")} className={`min-w-0 rounded-lg px-3 py-2 text-xs font-black ${value === "existing" ? "bg-white text-[#8A5F00] shadow-sm" : "text-black/45"} disabled:opacity-35`}>{existingLabel}</button><button type="button" onClick={() => onChange("new")} className={`min-w-0 rounded-lg px-3 py-2 text-xs font-black ${value === "new" ? "bg-white text-[#8A5F00] shadow-sm" : "text-black/45"}`}>{newLabel}</button></div>;
}
function Section({ title, children }: { title: string; children: React.ReactNode }) { return <section><p className="mb-3 text-xs font-black uppercase tracking-[0.15em] text-black/42">{title}</p>{children}</section>; }
function Field({ name, label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { name: string; label: string }) { return <label className="space-y-1.5 text-sm font-semibold"><span>{label}</span><input name={name} {...props} className="field" /></label>; }
function TextArea({ name, label, rows = 3 }: { name: string; label: string; rows?: number }) { return <label className="mt-3 block space-y-1.5 text-sm font-semibold"><span>{label}</span><textarea name={name} rows={rows} className="field resize-y" /></label>; }
function PhotoPreview({ file, onRemove }: { file: File; onRemove: () => void }) { const [url, setUrl] = useState(""); useEffect(() => { const value = URL.createObjectURL(file); setUrl(value); return () => URL.revokeObjectURL(value); }, [file]); return <div className="overflow-hidden rounded-xl border border-black/8 bg-black/5"><div className="aspect-[4/3]">{url && <img src={url} alt={file.name} className="h-full w-full object-cover" />}</div><div className="flex items-center gap-2 p-2"><p className="min-w-0 flex-1 truncate text-[10px] font-semibold">{file.name}</p><button type="button" onClick={onRemove} className="rounded-lg bg-white p-1.5 text-[#9B6600]"><Trash2 className="size-3" /></button></div></div>; }
