import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
const db=supabase as any;
export type StaffRole="admin"|"atendimento"|"tecnico"|"financeiro";
export type StaffAccessRow={email:string;full_name:string;role:StaffRole|string;active:boolean;has_account:boolean;profile_id:string|null;invite_used_at:string|null;created_at:string|null};
export const STAFF_ROLE_LABEL:Record<string,string>={admin:"Administrador",atendimento:"Atendimento",tecnico:"Técnico",financeiro:"Financeiro"};
function asError(error:unknown,fallback:string){if(error instanceof Error)return error;if(error&&typeof error==="object"&&"message" in error)return new Error(String((error as any).message??fallback));return new Error(fallback)}
export function useStaffAccess(enabled=true){return useQuery({queryKey:["staff_access"],enabled,queryFn:async()=>{const {data,error}=await db.rpc("list_staff_access");if(error)throw asError(error,"Não foi possível carregar os usuários do sistema.");return(data??[]) as StaffAccessRow[]}})}
export async function manageStaffAccess(input:{email:string;fullName:string;role:StaffRole;active:boolean}){const {error}=await db.rpc("manage_staff_access",{p_email:input.email.trim().toLowerCase(),p_full_name:input.fullName.trim(),p_role:input.role,p_active:input.active});if(error)throw asError(error,"Não foi possível salvar o acesso do usuário.")}
export async function deleteStaffAccess(email:string){const {error}=await db.rpc("delete_staff_access",{p_email:email.trim().toLowerCase()});if(error)throw asError(error,"Não foi possível excluir o usuário.")}
