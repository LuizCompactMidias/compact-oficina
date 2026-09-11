create or replace function public.frontdesk_add_manual_part(p_work_order_id uuid,p_description text,p_quantity numeric,p_unit_price numeric)
returns uuid language plpgsql security definer set search_path='public','pg_temp' as $$
declare v_id uuid; v_status text;
begin
 if auth.uid() is null then raise exception 'Autenticação obrigatória.'; end if;
 if not public.has_active_profile_role(array['admin','atendimento']) then raise exception 'Sem permissão.'; end if;
 if nullif(trim(coalesce(p_description,'')),'') is null or coalesce(p_quantity,0)<=0 or coalesce(p_unit_price,0)<0 then raise exception 'Dados inválidos.'; end if;
 select status into v_status from public.work_orders where id=p_work_order_id;
 if v_status is null then raise exception 'OS não encontrada.'; end if;
 if v_status in ('entregue','cancelada') then raise exception 'OS encerrada.'; end if;
 insert into public.work_order_parts(work_order_id,inventory_item_id,description,quantity,unit_cost,unit_price)
 values(p_work_order_id,null,trim(p_description),p_quantity,0,p_unit_price) returning id into v_id;
 return v_id;
end;$$;

create or replace function public.frontdesk_add_manual_labor(p_work_order_id uuid,p_description text,p_quantity numeric,p_unit_price numeric)
returns uuid language plpgsql security definer set search_path='public','pg_temp' as $$
declare v_id uuid; v_status text;
begin
 if auth.uid() is null then raise exception 'Autenticação obrigatória.'; end if;
 if not public.has_active_profile_role(array['admin','atendimento']) then raise exception 'Sem permissão.'; end if;
 if nullif(trim(coalesce(p_description,'')),'') is null or coalesce(p_quantity,0)<=0 or coalesce(p_unit_price,0)<0 then raise exception 'Dados inválidos.'; end if;
 select status into v_status from public.work_orders where id=p_work_order_id;
 if v_status is null then raise exception 'OS não encontrada.'; end if;
 if v_status in ('entregue','cancelada') then raise exception 'OS encerrada.'; end if;
 insert into public.work_order_services(work_order_id,service_id,description,quantity,unit_price,cost_price,status)
 values(p_work_order_id,null,trim(p_description),p_quantity,p_unit_price,0,'pendente') returning id into v_id;
 return v_id;
end;$$;

create or replace function public.frontdesk_remove_part(p_part_id uuid)
returns void language plpgsql security definer set search_path='public','pg_temp' as $$
declare v_inventory uuid;
begin
 if auth.uid() is null then raise exception 'Autenticação obrigatória.'; end if;
 if not public.has_active_profile_role(array['admin','atendimento']) then raise exception 'Sem permissão.'; end if;
 select inventory_item_id into v_inventory from public.work_order_parts where id=p_part_id;
 if not found then raise exception 'Peça não encontrada.'; end if;
 if v_inventory is not null then perform public.remove_inventory_part_from_work_order(p_part_id); else delete from public.work_order_parts where id=p_part_id; end if;
end;$$;

create or replace function public.frontdesk_remove_labor(p_service_id uuid)
returns void language plpgsql security definer set search_path='public','pg_temp' as $$
begin
 if auth.uid() is null then raise exception 'Autenticação obrigatória.'; end if;
 if not public.has_active_profile_role(array['admin','atendimento']) then raise exception 'Sem permissão.'; end if;
 delete from public.work_order_services where id=p_service_id and service_id is null;
 if not found then raise exception 'Mão de obra manual não encontrada.'; end if;
end;$$;

create or replace function public.frontdesk_update_service_execution(p_service_id uuid,p_collaborator_id uuid,p_status text)
returns jsonb language plpgsql security definer set search_path='public','pg_temp' as $$
declare v_row public.work_order_services%rowtype;
begin
 if auth.uid() is null then raise exception 'Autenticação obrigatória.'; end if;
 if not public.has_active_profile_role(array['admin','atendimento']) then raise exception 'Sem permissão.'; end if;
 if p_status not in ('pendente','aprovado','em_execucao','concluido','recusado') then raise exception 'Status inválido.'; end if;
 update public.work_order_services set collaborator_id=p_collaborator_id,status=p_status,completed_at=case when p_status='concluido' then now() else null end where id=p_service_id returning * into v_row;
 if v_row.id is null then raise exception 'Serviço não encontrado.'; end if;
 return jsonb_build_object('id',v_row.id,'work_order_id',v_row.work_order_id,'collaborator_id',v_row.collaborator_id,'status',v_row.status,'completed_at',v_row.completed_at);
end;$$;

revoke all on function public.frontdesk_add_manual_part(uuid,text,numeric,numeric), public.frontdesk_add_manual_labor(uuid,text,numeric,numeric), public.frontdesk_remove_part(uuid), public.frontdesk_remove_labor(uuid), public.frontdesk_update_service_execution(uuid,uuid,text) from public,anon;
grant execute on function public.frontdesk_add_manual_part(uuid,text,numeric,numeric), public.frontdesk_add_manual_labor(uuid,text,numeric,numeric), public.frontdesk_remove_part(uuid), public.frontdesk_remove_labor(uuid), public.frontdesk_update_service_execution(uuid,uuid,text) to authenticated,service_role;

drop policy if exists work_order_parts_frontdesk_insert on public.work_order_parts;
drop policy if exists work_order_parts_frontdesk_update on public.work_order_parts;
drop policy if exists work_order_parts_frontdesk_delete on public.work_order_parts;
create policy work_order_parts_admin_insert on public.work_order_parts for insert to authenticated with check (public.has_active_profile_role(array['admin']));
create policy work_order_parts_admin_update on public.work_order_parts for update to authenticated using (public.has_active_profile_role(array['admin'])) with check (public.has_active_profile_role(array['admin']));
create policy work_order_parts_admin_delete on public.work_order_parts for delete to authenticated using (public.has_active_profile_role(array['admin']));
drop policy if exists work_order_services_frontdesk_insert on public.work_order_services;
drop policy if exists work_order_services_frontdesk_update on public.work_order_services;
drop policy if exists work_order_services_frontdesk_delete on public.work_order_services;
create policy work_order_services_admin_insert on public.work_order_services for insert to authenticated with check (public.has_active_profile_role(array['admin']));
create policy work_order_services_admin_update on public.work_order_services for update to authenticated using (public.has_active_profile_role(array['admin'])) with check (public.has_active_profile_role(array['admin']));
create policy work_order_services_admin_delete on public.work_order_services for delete to authenticated using (public.has_active_profile_role(array['admin']));
