import { supabase } from "@/integrations/supabase/client";

const db = supabase as any;

export type ManualLineItem = {
  description: string;
  quantity: number;
  unit_price: number;
  inventory_item_id?: string | null;
};

export type WorkOrderIntakeV2Payload = {
  customer: Record<string, unknown>;
  vehicle: Record<string, unknown>;
  order: Record<string, unknown>;
  checklist: Record<string, unknown>;
  parts: ManualLineItem[];
  labor: ManualLineItem[];
  photos?: File[];
};

const allowedPhotoTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

function asError(error: unknown, fallback: string) {
  if (error instanceof Error) return error;
  if (error && typeof error === "object" && "message" in error) return new Error(String((error as any).message ?? fallback));
  return new Error(fallback);
}

function safeFileName(name: string) {
  return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-").toLowerCase();
}

export async function createWorkOrderIntakeV2(payload: WorkOrderIntakeV2Payload) {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) throw new Error("Sessão inválida. Entre novamente no sistema.");

  const cleanParts = payload.parts.filter((item) => item.description.trim() && item.quantity > 0);
  const cleanLabor = payload.labor.filter((item) => item.description.trim() && item.quantity > 0);
  if (!cleanParts.length && !cleanLabor.length) throw new Error("Informe pelo menos uma peça ou mão de obra.");

  const { data, error } = await db.rpc("create_work_order_intake_v3", {
    p_customer: payload.customer,
    p_vehicle: payload.vehicle,
    p_order: payload.order,
    p_checklist: payload.checklist,
    p_parts: cleanParts,
    p_services: cleanLabor.map((item) => ({ ...item, service_id: null, cost_price: 0 })),
  });
  if (error) throw asError(error, "Não foi possível criar a ordem de serviço.");

  const created = Array.isArray(data) ? data[0] : data;
  if (!created?.work_order_id) throw new Error("A OS foi criada, mas o retorno do banco ficou incompleto.");

  const { data: orderRow, error: orderError } = await db.from("work_orders").select("id, vehicle_id, order_number, total").eq("id", created.work_order_id).single();
  if (orderError) throw asError(orderError, "Não foi possível carregar a OS criada.");

  const photoWarnings: string[] = [];
  for (const file of payload.photos ?? []) {
    try {
      if (!allowedPhotoTypes.has(file.type)) throw new Error(`${file.name} não está em um formato permitido. Use JPEG, PNG, WebP ou GIF.`);
      if (file.size > 10 * 1024 * 1024) throw new Error(`${file.name} ultrapassa 10 MB.`);
      const path = `${created.work_order_id}/entrada/${crypto.randomUUID()}-${safeFileName(file.name)}`;
      const { error: uploadError } = await supabase.storage.from("vehicle-photos").upload(path, file, { cacheControl: "3600", upsert: false });
      if (uploadError) throw asError(uploadError, `Falha ao enviar ${file.name}`);
      const { error: photoError } = await db.from("vehicle_photos").insert({ work_order_id: created.work_order_id, vehicle_id: orderRow.vehicle_id, photo_type: "entrada", storage_path: path, caption: file.name, uploaded_by: authData.user.id });
      if (photoError) {
        await supabase.storage.from("vehicle-photos").remove([path]);
        throw asError(photoError, `Falha ao registrar ${file.name}`);
      }
    } catch (err) {
      photoWarnings.push(asError(err, `Falha ao enviar ${file.name}`).message);
    }
  }

  return { id: String(created.work_order_id), orderNumber: Number(orderRow.order_number ?? created.order_number ?? 0), total: Number(orderRow.total ?? created.total ?? 0), photoWarnings };
}