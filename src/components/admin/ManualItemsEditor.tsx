import { Plus, Trash2 } from "lucide-react";
import { InventoryPartsPicker } from "@/components/admin/InventoryPartsPicker";
import { money } from "@/lib/porfirid-queries";
import type { ManualLineItem } from "@/lib/work-order-intake-v2";

export function ManualItemsEditor({ title, subtitle, singular, items, onChange }: { title: string; subtitle: string; singular: string; items: ManualLineItem[]; onChange: (items: ManualLineItem[]) => void }) {
  const isParts = singular.toLowerCase().includes("peça");
  const stockItems = isParts ? items.filter((item) => Boolean(item.inventory_item_id)) : [];
  const manualItems = isParts ? items.filter((item) => !item.inventory_item_id) : items;
  const subtotal = items.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unit_price || 0), 0);
  function mergeManual(nextManual: ManualLineItem[]) { onChange(isParts ? [...stockItems, ...nextManual] : nextManual); }
  function add() { mergeManual([...manualItems, { description: "", quantity: 1, unit_price: 0 }]); }
  function update(index: number, values: Partial<ManualLineItem>) { mergeManual(manualItems.map((item, itemIndex) => itemIndex === index ? { ...item, ...values } : item)); }
  function remove(index: number) { mergeManual(manualItems.filter((_, itemIndex) => itemIndex !== index)); }

  return <div className="space-y-4">
    {isParts && <InventoryPartsPicker items={stockItems} onChange={(nextStock) => onChange([...nextStock, ...manualItems])} mode={title.toLowerCase().includes("orçamento") ? "quote" : "work_order"} />}
    <section className="rounded-2xl border border-black/7 bg-white p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><h4 className="font-black">{isParts ? "Peças manuais" : title}</h4><p className="mt-1 text-xs leading-relaxed text-black/45">{isParts ? "Use quando a peça ainda não estiver cadastrada no estoque." : subtitle}</p></div><button type="button" onClick={add} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#111214] px-3 py-2.5 text-xs font-black text-white"><Plus className="size-4" /> Adicionar {singular}</button></div>
      {manualItems.length === 0 ? <div className="mt-4 rounded-xl border border-dashed border-black/12 bg-[#fafafa] p-5 text-center text-sm text-black/42">Nenhum item manual lançado.</div> : <div className="mt-4 space-y-3">{manualItems.map((item, index) => <div key={index} className="grid gap-2 rounded-xl bg-[#fafafa] p-3 md:grid-cols-[1.8fr_0.45fr_0.75fr_0.75fr_auto] md:items-end"><label className="space-y-1.5 text-xs font-bold text-black/60"><span>Descrição *</span><input value={item.description} onChange={(e)=>update(index,{description:e.target.value})} className="field bg-white" /></label><label className="space-y-1.5 text-xs font-bold text-black/60"><span>Qtd.</span><input type="number" min="0.01" step="0.01" value={item.quantity} onChange={(e)=>update(index,{quantity:Number(e.target.value)})} className="field bg-white" /></label><label className="space-y-1.5 text-xs font-bold text-black/60"><span>Valor unit.</span><input type="number" min="0" step="0.01" value={item.unit_price} onChange={(e)=>update(index,{unit_price:Number(e.target.value)})} className="field bg-white" /></label><div className="rounded-xl bg-white px-3 py-3"><p className="text-[10px] font-bold uppercase tracking-wider text-black/35">Total</p><p className="mt-1 text-sm font-black">{money(Number(item.quantity||0)*Number(item.unit_price||0))}</p></div><button type="button" onClick={()=>remove(index)} className="inline-flex items-center justify-center rounded-xl border border-[#F0B323]/25 p-3 text-[#9B6600]"><Trash2 className="size-4" /></button></div>)}</div>}
      <div className="mt-4 flex justify-end border-t border-black/6 pt-3 text-sm"><span className="mr-3 text-black/45">Subtotal geral</span><strong>{money(subtotal)}</strong></div>
    </section>
  </div>;
}
