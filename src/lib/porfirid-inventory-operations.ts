import { supabase } from "@/integrations/supabase/client";

const db = supabase as any;
function asError(error: unknown, fallback: string) {
  if (error instanceof Error) return error;
  if (error && typeof error === "object" && "message" in error) return new Error(String((error as any).message ?? fallback));
  return new Error(fallback);
}
export async function createInventoryItem(input:{sku?:string;name:string;category?:string;unit:string;quantity:number;minQuantity:number;costPrice:number;salePrice:number;location?:string}){
  const {data,error}=await db.rpc("create_inventory_item_with_stock",{p_sku:input.sku?.trim()||null,p_name:input.name.trim(),p_category:input.category?.trim()||null,p_unit:input.unit||"un",p_quantity:input.quantity,p_min_quantity:input.minQuantity,p_cost_price:input.costPrice,p_sale_price:input.salePrice,p_location:input.location?.trim()||null});
  if(error)throw asError(error,"Não foi possível cadastrar o item no estoque."); return {id:String(data)};
}
export async function adjustInventoryStock(input:{inventoryItemId:string;quantity:number;type:"entrada"|"saida"|"ajuste";reason:string;unitCost?:number}){
  const {data,error}=await db.rpc("adjust_inventory_stock",{p_inventory_item_id:input.inventoryItemId,p_quantity:input.quantity,p_type:input.type,p_reason:input.reason.trim()||"Ajuste manual",p_unit_cost:input.unitCost??null});
  if(error)throw asError(error,"Não foi possível atualizar o estoque."); return {quantity:Number(data??0)};
}
export async function addInventoryPartToWorkOrder(input:{workOrderId:string;inventoryItemId:string;quantity:number;unitPrice?:number}){
  const {data,error}=await db.rpc("add_inventory_part_to_work_order",{p_work_order_id:input.workOrderId,p_inventory_item_id:input.inventoryItemId,p_quantity:input.quantity,p_unit_price:input.unitPrice??null});
  if(error)throw asError(error,"Não foi possível lançar a peça na OS."); return data;
}
export async function removeInventoryPartFromWorkOrder(partId:string){const {data,error}=await db.rpc("remove_inventory_part_from_work_order",{p_part_id:partId});if(error)throw asError(error,"Não foi possível remover a peça da OS.");return data;}
