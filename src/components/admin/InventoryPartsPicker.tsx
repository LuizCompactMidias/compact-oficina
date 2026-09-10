import { useMemo, useState } from "react";
import { PackagePlus, Trash2, TriangleAlert } from "lucide-react";
import { money, useInventory } from "@/lib/porfirid-queries";
import type { ManualLineItem } from "@/lib/work-order-intake-v2";

export function InventoryPartsPicker({ items, onChange, mode }: { items: ManualLineItem[]; onChange: (items: ManualLineItem[]) => void; mode: "quote" | "work_order" }) {
  const { data: inventory = [] } = useInventory();
  const available = useMemo(() => inventory.filter((item: any) => item.active && Number(item.quantity) > 0), [inventory]);
  const [selectedId, setSelectedId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const selected = available.find((item: any) => item.id === selectedId) as any;
  const [customPrice, setCustomPrice] = useState<number | null>(null);
  const price = customPrice ?? Number(selected?.sale_price ?? 0);

  function add() {
    if (!selected || quantity <= 0) return;
    const existingIndex = items.findIndex((item) => item.inventory_item_id === selected.id);
    if (existingIndex >= 0) onChange(items.map((item, index) => index === existingIndex ? { ...item, quantity: Number(item.quantity) + quantity, unit_price: price } : item));
    else onChange([...items, { inventory_item_id: selected.id, description: selected.name, quantity, unit_price: price }]);
    setSelectedId(""); setQuantity(1); setCustomPrice(null);
  }

  const total = items.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unit_price || 0), 0);

  return <section className="rounded-2xl border border-[#F0B323]/25 bg-[#F0B323]/[0.035] p-4 sm:p-5">
    <div><h4 className="font-black">Peças cadastradas no estoque</h4><p className="mt-1 text-xs leading-relaxed text-black/45">{mode === "quote" ? "A peça entra no orçamento sem baixar o saldo. A baixa acontece somente quando o orçamento for convertido em OS." : "Ao finalizar a abertura da OS, as quantidades selecionadas serão baixadas automaticamente do estoque."}</p></div>
    {available.length === 0 ? <div className="mt-4 rounded-xl border border-dashed border-black/12 bg-white p-5 text-sm text-black/45">Nenhum item com saldo disponível no estoque.</div> : <div className="mt-4 grid gap-3 md:grid-cols-[1.8fr_0.45fr_0.75fr_auto] md:items-end">
      <label className="space-y-1.5 text-xs font-bold text-black/60"><span>Produto</span><select value={selectedId} onChange={(e) => { setSelectedId(e.target.value); setCustomPrice(null); }} className="field"><option value="">Selecione...</option>{available.map((item: any) => <option key={item.id} value={item.id}>{item.name} • saldo {Number(item.quantity)} {item.unit}</option>)}</select></label>
      <label className="space-y-1.5 text-xs font-bold text-black/60"><span>Qtd.</span><input type="number" min="0.01" step="0.01" value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} className="field" /></label>
      <label className="space-y-1.5 text-xs font-bold text-black/60"><span>Preço unit.</span><input type="number" min="0" step="0.01" value={selected ? price : 0} disabled={!selected} onChange={(e) => setCustomPrice(Number(e.target.value))} className="field disabled:bg-black/5" /></label>
      <button type="button" disabled={!selectedId || quantity <= 0} onClick={add} className="goldButton"><PackagePlus className="size-4" />Adicionar</button>
    </div>}
    {selected && quantity > Number(selected.quantity) && <p className="mt-3 inline-flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800"><TriangleAlert className="size-4" />Quantidade maior que o saldo atual ({Number(selected.quantity)} {selected.unit}).</p>}
    {items.length > 0 && <div className="mt-4 space-y-2">{items.map((item, index) => { const stock = inventory.find((row: any) => row.id === item.inventory_item_id) as any; return <div key={`${item.inventory_item_id}-${index}`} className="flex flex-col gap-2 rounded-xl border border-black/7 bg-white p-3 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><p className="font-black">{item.description}</p><p className="mt-1 text-xs text-black/45">{Number(item.quantity)} × {money(Number(item.unit_price))} • saldo atual {Number(stock?.quantity ?? 0)} {stock?.unit ?? "un"}</p></div><strong>{money(Number(item.quantity) * Number(item.unit_price))}</strong><button type="button" onClick={() => onChange(items.filter((_, i) => i !== index))} className="rounded-lg border border-[#F0B323]/25 p-2 text-[#9B6600]"><Trash2 className="size-4" /></button></div>; })}<div className="flex justify-end border-t border-black/6 pt-3 text-sm"><span className="mr-3 text-black/45">Subtotal do estoque</span><strong>{money(total)}</strong></div></div>}
  </section>;
}
