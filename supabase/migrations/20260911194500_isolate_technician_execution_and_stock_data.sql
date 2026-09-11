create or replace function public.get_technician_work_order_execution(p_work_order_id uuid)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare v_role text; v_payload jsonb;
begin
 if auth.uid() is null then raise exception 'Autenticação obrigatória.'; end if;
 select role into v_role from public.profiles where id=auth.uid() and active=true;
 if v_role <> 'tecnico' then raise exception 'Função exclusiva do perfil técnico.'; end if;
 if not exists(select 1 from public.work_orders where id=p_work_order_id) then raise exception 'OS não encontrada.'; end if;
 select jsonb_build_object(
  'parts',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'inventory_item_id',p.inventory_item_id,'description',p.description,'quantity',p.quantity,'origin',case when p.inventory_item_id is null then 'manual' else 'estoque' end) order by p.created_at) from public.work_order_parts p where p.work_order_id=p_work_order_id),'[]'::jsonb),
  'services',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'description',s.description,'quantity',s.quantity,'status',s.status,'collaborator_id',s.collaborator_id,'completed_at',s.completed_at,'notes',s.notes) order by s.created_at) from public.work_order_services s where s.work_order_id=p_work_order_id),'[]'::jsonb),
  'inventory',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'name',i.name,'sku',i.sku,'category',i.category,'unit',i.unit,'quantity',i.quantity,'min_quantity',i.min_quantity,'location',i.location) order by i.name) from public.inventory_items i where i.active=true and i.quantity>0),'[]'::jsonb),
  'collaborators',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'job_title',c.job_title) order by c.name) from public.collaborators c where c.active=true),'[]'::jsonb)
 ) into v_payload;
 return v_payload;
end;$$;
revoke all on function public.get_technician_work_order_execution(uuid) from public,anon;
grant execute on function public.get_technician_work_order_execution(uuid) to authenticated,service_role;

create or replace function public.get_technician_stock_snapshot()
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare v_role text; v_payload jsonb;
begin
 if auth.uid() is null then raise exception 'Autenticação obrigatória.'; end if;
 select role into v_role from public.profiles where id=auth.uid() and active=true;
 if v_role <> 'tecnico' then raise exception 'Função exclusiva do perfil técnico.'; end if;
 select jsonb_build_object(
  'items',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'name',i.name,'sku',i.sku,'barcode',i.barcode,'category',i.category,'unit',i.unit,'quantity',i.quantity,'min_quantity',i.min_quantity,'location',i.location,'ncm',i.ncm,'active',i.active) order by i.name) from public.inventory_items i),'[]'::jsonb),
  'movements',coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'inventory_item_id',m.inventory_item_id,'movement_type',m.movement_type,'quantity',m.quantity,'reason',m.reason,'reference_type',m.reference_type,'reference_id',m.reference_id,'created_at',m.created_at) order by m.created_at desc) from public.inventory_movements m where m.created_at>=now()-interval '180 days'),'[]'::jsonb)
 ) into v_payload;
 return v_payload;
end;$$;
revoke all on function public.get_technician_stock_snapshot() from public,anon;
grant execute on function public.get_technician_stock_snapshot() to authenticated,service_role;

create or replace function public.technician_add_inventory_part(p_work_order_id uuid,p_inventory_item_id uuid,p_quantity numeric)
returns uuid language plpgsql security definer set search_path to 'public','pg_temp' as $$
begin
 if not exists(select 1 from public.profiles where id=auth.uid() and active=true and role='tecnico') then raise exception 'Função exclusiva do perfil técnico.'; end if;
 return public.add_inventory_part_to_work_order(p_work_order_id,p_inventory_item_id,p_quantity,null);
end;$$;
revoke all on function public.technician_add_inventory_part(uuid,uuid,numeric) from public,anon;
grant execute on function public.technician_add_inventory_part(uuid,uuid,numeric) to authenticated,service_role;

create or replace function public.technician_remove_inventory_part(p_part_id uuid)
returns numeric language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare v_inventory_item_id uuid;
begin
 if not exists(select 1 from public.profiles where id=auth.uid() and active=true and role='tecnico') then raise exception 'Função exclusiva do perfil técnico.'; end if;
 select inventory_item_id into v_inventory_item_id from public.work_order_parts where id=p_part_id;
 if v_inventory_item_id is null then raise exception 'Peças manuais devem ser alteradas pelo atendimento/administrador.'; end if;
 return public.remove_inventory_part_from_work_order(p_part_id);
end;$$;
revoke all on function public.technician_remove_inventory_part(uuid) from public,anon;
grant execute on function public.technician_remove_inventory_part(uuid) to authenticated,service_role;

create or replace function public.technician_update_service_execution(p_service_id uuid,p_collaborator_id uuid,p_status text)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare v_row public.work_order_services%rowtype;
begin
 if not exists(select 1 from public.profiles where id=auth.uid() and active=true and role='tecnico') then raise exception 'Função exclusiva do perfil técnico.'; end if;
 if p_status not in ('pendente','em_execucao','concluido') then raise exception 'Status técnico inválido.'; end if;
 if p_collaborator_id is not null and not exists(select 1 from public.collaborators where id=p_collaborator_id and active=true) then raise exception 'Colaborador inválido.'; end if;
 select s.* into v_row from public.work_order_services s join public.work_orders wo on wo.id=s.work_order_id where s.id=p_service_id and wo.status not in ('entregue','cancelada') for update;
 if not found then raise exception 'Serviço não encontrado ou OS encerrada.'; end if;
 if p_status='concluido' and p_collaborator_id is null then raise exception 'Escolha o colaborador antes de concluir o serviço.'; end if;
 update public.work_order_services set collaborator_id=p_collaborator_id,status=p_status,completed_at=case when p_status='concluido' then now() else null end where id=p_service_id returning * into v_row;
 return jsonb_build_object('id',v_row.id,'status',v_row.status,'collaborator_id',v_row.collaborator_id,'completed_at',v_row.completed_at);
end;$$;
revoke all on function public.technician_update_service_execution(uuid,uuid,text) from public,anon;
grant execute on function public.technician_update_service_execution(uuid,uuid,text) to authenticated,service_role;

drop policy if exists work_order_parts_authenticated_select on public.work_order_parts;
create policy work_order_parts_business_select on public.work_order_parts for select to authenticated using(public.has_active_profile_role(array['admin','atendimento','financeiro']));
drop policy if exists work_order_parts_ops_insert on public.work_order_parts; drop policy if exists work_order_parts_ops_update on public.work_order_parts; drop policy if exists work_order_parts_ops_delete on public.work_order_parts;
create policy work_order_parts_frontdesk_insert on public.work_order_parts for insert to authenticated with check(public.has_active_profile_role(array['admin','atendimento']));
create policy work_order_parts_frontdesk_update on public.work_order_parts for update to authenticated using(public.has_active_profile_role(array['admin','atendimento'])) with check(public.has_active_profile_role(array['admin','atendimento']));
create policy work_order_parts_frontdesk_delete on public.work_order_parts for delete to authenticated using(public.has_active_profile_role(array['admin','atendimento']));

drop policy if exists work_order_services_authenticated_select on public.work_order_services;
create policy work_order_services_business_select on public.work_order_services for select to authenticated using(public.has_active_profile_role(array['admin','atendimento','financeiro']));
drop policy if exists work_order_services_ops_insert on public.work_order_services; drop policy if exists work_order_services_ops_update on public.work_order_services; drop policy if exists work_order_services_ops_delete on public.work_order_services;
create policy work_order_services_frontdesk_insert on public.work_order_services for insert to authenticated with check(public.has_active_profile_role(array['admin','atendimento']));
create policy work_order_services_frontdesk_update on public.work_order_services for update to authenticated using(public.has_active_profile_role(array['admin','atendimento'])) with check(public.has_active_profile_role(array['admin','atendimento']));
create policy work_order_services_frontdesk_delete on public.work_order_services for delete to authenticated using(public.has_active_profile_role(array['admin','atendimento']));

drop policy if exists inventory_items_authenticated_select on public.inventory_items;
create policy inventory_items_business_select on public.inventory_items for select to authenticated using(public.has_active_profile_role(array['admin','atendimento','financeiro']));
drop policy if exists inventory_movements_authenticated_select on public.inventory_movements;
create policy inventory_movements_business_select on public.inventory_movements for select to authenticated using(public.has_active_profile_role(array['admin','atendimento','financeiro']));
drop policy if exists collaborators_authenticated_select on public.collaborators;
create policy collaborators_business_select on public.collaborators for select to authenticated using(public.has_active_profile_role(array['admin','atendimento','financeiro']));
drop policy if exists vehicle_photos_authenticated_select on public.vehicle_photos;
create policy vehicle_photos_ops_select on public.vehicle_photos for select to authenticated using(public.has_active_profile_role(array['admin','atendimento','tecnico']));
drop policy if exists vehicle_checklists_authenticated_select on public.vehicle_checklists;
create policy vehicle_checklists_ops_select on public.vehicle_checklists for select to authenticated using(public.has_active_profile_role(array['admin','atendimento','tecnico']));