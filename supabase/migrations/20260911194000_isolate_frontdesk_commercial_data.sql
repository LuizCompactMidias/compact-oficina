create or replace function public.get_frontdesk_work_order_items(p_work_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path='public','pg_temp'
as $$
begin
  if auth.uid() is null then raise exception 'Autenticação obrigatória.'; end if;
  if not public.has_active_profile_role(array['admin','atendimento']) then raise exception 'Sem permissão.'; end if;
  return jsonb_build_object(
    'parts', coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'work_order_id',p.work_order_id,'inventory_item_id',p.inventory_item_id,'description',p.description,'quantity',p.quantity,'unit_price',p.unit_price,'created_at',p.created_at) order by p.created_at) from public.work_order_parts p where p.work_order_id=p_work_order_id),'[]'::jsonb),
    'services', coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'work_order_id',s.work_order_id,'service_id',s.service_id,'description',s.description,'quantity',s.quantity,'unit_price',s.unit_price,'status',s.status,'collaborator_id',s.collaborator_id,'notes',s.notes,'completed_at',s.completed_at,'created_at',s.created_at) order by s.created_at) from public.work_order_services s where s.work_order_id=p_work_order_id),'[]'::jsonb)
  );
end;$$;

create or replace function public.get_frontdesk_inventory()
returns table(id uuid,name text,sku text,category text,unit text,quantity numeric,min_quantity numeric,sale_price numeric,location text,active boolean)
language plpgsql security definer set search_path='public','pg_temp' as $$
begin
  if auth.uid() is null then raise exception 'Autenticação obrigatória.'; end if;
  if not public.has_active_profile_role(array['admin','atendimento']) then raise exception 'Sem permissão.'; end if;
  return query select i.id,i.name,i.sku,i.category,i.unit,i.quantity,i.min_quantity,i.sale_price,i.location,i.active from public.inventory_items i order by i.name;
end;$$;

create or replace function public.get_frontdesk_collaborator_directory()
returns table(id uuid,name text,job_title text,active boolean)
language plpgsql security definer set search_path='public','pg_temp' as $$
begin
  if auth.uid() is null then raise exception 'Autenticação obrigatória.'; end if;
  if not public.has_active_profile_role(array['admin','atendimento','tecnico']) then raise exception 'Sem permissão.'; end if;
  return query select c.id,c.name,c.job_title,c.active from public.collaborators c where c.active=true order by c.name;
end;$$;

revoke all on function public.get_frontdesk_work_order_items(uuid), public.get_frontdesk_inventory(), public.get_frontdesk_collaborator_directory() from public,anon;
grant execute on function public.get_frontdesk_work_order_items(uuid), public.get_frontdesk_inventory(), public.get_frontdesk_collaborator_directory() to authenticated,service_role;

drop policy if exists collaborators_business_select on public.collaborators;
create policy collaborators_admin_finance_select on public.collaborators for select to authenticated using (public.has_active_profile_role(array['admin','financeiro']));
drop policy if exists inventory_items_business_select on public.inventory_items;
create policy inventory_items_admin_finance_select on public.inventory_items for select to authenticated using (public.has_active_profile_role(array['admin','financeiro']));
drop policy if exists inventory_movements_business_select on public.inventory_movements;
create policy inventory_movements_admin_finance_select on public.inventory_movements for select to authenticated using (public.has_active_profile_role(array['admin','financeiro']));
drop policy if exists work_order_parts_business_select on public.work_order_parts;
create policy work_order_parts_admin_finance_select on public.work_order_parts for select to authenticated using (public.has_active_profile_role(array['admin','financeiro']));
drop policy if exists work_order_services_business_select on public.work_order_services;
create policy work_order_services_admin_finance_select on public.work_order_services for select to authenticated using (public.has_active_profile_role(array['admin','financeiro']));
