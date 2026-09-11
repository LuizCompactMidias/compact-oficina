import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
const db=supabase as any;
export type AppSettings={company_name?:string;trade_name?:string;cnpj?:string;phone?:string;whatsapp?:string;email?:string;website?:string;slogan?:string;street?:string;address_number?:string;neighborhood?:string;city?:string;state?:string;zip_code?:string;complement?:string;business_hours?:string;document_header_note?:string;document_footer_note?:string;quote_terms?:string;work_order_terms?:string;receipt_note?:string;whatsapp_greeting?:string;whatsapp_quote_message?:string;whatsapp_tracking_message?:string;whatsapp_ready_message?:string;quote_validity_days?:number;default_warranty_days?:number;require_payment_before_delivery?:boolean;allow_partial_approval?:boolean;tracking_enabled?:boolean;payment_methods?:string[]};
export async function getAppSettings():Promise<AppSettings>{const {data,error}=await db.from("app_settings").select("*").eq("id",1).maybeSingle();if(error)throw error;return data??{}}
export function useAppSettings(){return useQuery({queryKey:["app_settings"],queryFn:getAppSettings,staleTime:60_000})}
