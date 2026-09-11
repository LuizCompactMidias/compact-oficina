import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ServiceImagePosition = "center" | "top" | "bottom" | "left" | "right";
export type ServiceCardImage = {
  id: string;
  service_slug: string;
  service_title: string;
  image_path: string | null;
  alt_text: string;
  object_position: ServiceImagePosition;
  is_active: boolean;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

const db = supabase as any;
const BUCKET = "service-images";
const ACCEPTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_FILE_SIZE = 5 * 1024 * 1024;

export function serviceImagePublicUrl(path: string) {
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

export function useServiceCardImages() {
  return useQuery({
    queryKey: ["service_card_images"],
    queryFn: async () => {
      const { data, error } = await db.from("service_card_images").select("id,service_slug,service_title,image_path,alt_text,object_position,is_active,updated_by,created_at,updated_at").order("service_title");
      if (error) throw error;
      return (data ?? []) as ServiceCardImage[];
    },
  });
}

export function usePublicServiceCardImages() {
  return useQuery({
    queryKey: ["public_service_card_images"],
    queryFn: async () => {
      const { data, error } = await db.from("service_card_images").select("service_slug,image_path,alt_text,object_position,updated_at").eq("is_active", true).not("image_path", "is", null);
      if (error) throw error;
      return (data ?? []) as Array<Pick<ServiceCardImage, "service_slug" | "image_path" | "alt_text" | "object_position" | "updated_at">>;
    },
    staleTime: 60_000,
  });
}

async function currentUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("Sessão inválida. Entre novamente no sistema.");
  return data.user.id;
}

export async function uploadServiceCardImage(input: { serviceSlug: string; serviceTitle: string; file: File; altText: string; objectPosition: ServiceImagePosition }) {
  if (!ACCEPTED_TYPES.has(input.file.type)) throw new Error("Use uma imagem JPG, PNG ou WebP.");
  if (input.file.size > MAX_FILE_SIZE) throw new Error("A imagem deve ter no máximo 5 MB.");
  const userId = await currentUserId();
  const { data: previous } = await db.from("service_card_images").select("image_path").eq("service_slug", input.serviceSlug).maybeSingle();
  const extension = input.file.type === "image/png" ? "png" : input.file.type === "image/webp" ? "webp" : "jpg";
  const path = `${input.serviceSlug}/${Date.now()}-${crypto.randomUUID()}.${extension}`;
  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, input.file, { cacheControl: "31536000", upsert: false, contentType: input.file.type });
  if (uploadError) throw uploadError;
  const { data, error } = await db.from("service_card_images").upsert({ service_slug: input.serviceSlug, service_title: input.serviceTitle, image_path: path, alt_text: input.altText.trim(), object_position: input.objectPosition, is_active: true, updated_by: userId }, { onConflict: "service_slug" }).select("*").single();
  if (error) { await supabase.storage.from(BUCKET).remove([path]); throw error; }
  if (previous?.image_path && previous.image_path !== path) await supabase.storage.from(BUCKET).remove([previous.image_path]);
  return data as ServiceCardImage;
}

export async function saveServiceCardImageSettings(input: { serviceSlug: string; serviceTitle: string; imagePath: string; altText: string; objectPosition: ServiceImagePosition }) {
  const userId = await currentUserId();
  const { data, error } = await db.from("service_card_images").upsert({ service_slug: input.serviceSlug, service_title: input.serviceTitle, image_path: input.imagePath, alt_text: input.altText.trim(), object_position: input.objectPosition, is_active: true, updated_by: userId }, { onConflict: "service_slug" }).select("*").single();
  if (error) throw error;
  return data as ServiceCardImage;
}

export async function removeServiceCardImage(serviceSlug: string) {
  const { data: current, error: readError } = await db.from("service_card_images").select("image_path").eq("service_slug", serviceSlug).maybeSingle();
  if (readError) throw readError;
  const { error } = await db.from("service_card_images").delete().eq("service_slug", serviceSlug);
  if (error) throw error;
  if (current?.image_path) await supabase.storage.from(BUCKET).remove([current.image_path]);
}
