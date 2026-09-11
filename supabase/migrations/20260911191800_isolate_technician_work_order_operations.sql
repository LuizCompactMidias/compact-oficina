create or replace function public.get_technician_work_orders()
returns table(
  id uuid,
  order_number bigint,
  status text,
  approval_status text,
  entry_at timestamptz,
  promised_at timestamptz,
  customer_name text,
  vehicle_plate text,
  vehicle_brand text,
  vehicle_model text
)
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $$
begin
  if auth.uid() is null then raise exception 'Autenticação obrigatória.'; end if;
  if not exists(select 1 from public.profiles p where p.id=auth.uid() and p.active=true and p.role='tecnico') then
    raise exception 'Função exclusiva do perfil técnico.';
  end if;
  return query
  select wo.id,wo.order_number,wo.status,wo.approval_status,wo.entry_at,wo.promised_at,
         c.name,v.plate,v.brand,v.model
  from public.work_orders wo
  left join public.customers c on c.id=wo.customer_id
  left join public.vehicles v on v.id=wo.vehicle_id
  order by wo.created_at desc;
end;
$$;

create or replace function public.technician_update_work_order_data(
  p_work_order_id uuid,
  p_diagnosis text default null,
  p_customer_report text default null,
  p_customer_notes text default null,
  p_internal_notes text default null,
  p_promised_at timestamptz default null,
  p_mileage_in integer default null,
  p_fuel_level text default null
)
returns void
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $$
declare v_vehicle_id uuid;
begin
  if auth.uid() is null then raise exception 'Autenticação obrigatória.'; end if;
  if not exists(select 1 from public.profiles p where p.id=auth.uid() and p.active=true and p.role='tecnico') then
    raise exception 'Função exclusiva do perfil técnico.';
  end if;
  select vehicle_id into v_vehicle_id from public.work_orders where id=p_work_order_id;
  if v_vehicle_id is null then raise exception 'OS não encontrada ou sem veículo vinculado.'; end if;
  update public.work_orders
     set diagnosis=nullif(trim(coalesce(p_diagnosis,'')),''),
         customer_report=nullif(trim(coalesce(p_customer_report,'')),''),
         customer_notes=nullif(trim(coalesce(p_customer_notes,'')),''),
         internal_notes=nullif(trim(coalesce(p_internal_notes,'')),''),
         promised_at=p_promised_at,
         mileage_in=p_mileage_in,
         fuel_level=nullif(trim(coalesce(p_fuel_level,'')),''),
         updated_at=now()
   where id=p_work_order_id and status not in ('entregue','cancelada');
  if not found then raise exception 'OS encerrada ou não encontrada.'; end if;
  if p_mileage_in is not null then
    update public.vehicles set current_mileage=p_mileage_in,updated_at=now() where id=v_vehicle_id;
  end if;
end;
$$;

create or replace function public.technician_advance_work_order(
  p_work_order_id uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $$
declare v_current text;
begin
  if auth.uid() is null then raise exception 'Autenticação obrigatória.'; end if;
  if not exists(select 1 from public.profiles p where p.id=auth.uid() and p.active=true and p.role='tecnico') then
    raise exception 'Função exclusiva do perfil técnico.';
  end if;
  select status into v_current from public.work_orders where id=p_work_order_id;
  if v_current is null then raise exception 'OS não encontrada.'; end if;
  if not (
    (v_current='recepcao' and p_status='diagnostico') or
    (v_current='diagnostico' and p_status='aguardando_aprovacao') or
    (v_current='em_execucao' and p_status='finalizacao') or
    (v_current='finalizacao' and p_status='pronto_entrega')
  ) then
    raise exception 'Esta transição não é permitida para o perfil técnico.';
  end if;
  update public.work_orders set status=p_status,updated_at=now() where id=p_work_order_id;
  update public.work_order_tracking set status=p_status,updated_at=now() where work_order_id=p_work_order_id;
end;
$$;

revoke all on function public.get_technician_work_orders() from public,anon;
revoke all on function public.technician_update_work_order_data(uuid,text,text,text,text,timestamptz,integer,text) from public,anon;
revoke all on function public.technician_advance_work_order(uuid,text) from public,anon;
grant execute on function public.get_technician_work_orders() to authenticated;
grant execute on function public.technician_update_work_order_data(uuid,text,text,text,text,timestamptz,integer,text) to authenticated;
grant execute on function public.technician_advance_work_order(uuid,text) to authenticated;

drop policy if exists work_orders_authenticated_select on public.work_orders;
drop policy if exists work_orders_role_select on public.work_orders;
create policy work_orders_role_select on public.work_orders for select to authenticated
using (public.has_active_profile_role(array['admin','atendimento','financeiro']));

drop policy if exists work_orders_ops_insert on public.work_orders;
drop policy if exists work_orders_frontdesk_insert on public.work_orders;
create policy work_orders_frontdesk_insert on public.work_orders for insert to authenticated
with check (public.has_active_profile_role(array['admin','atendimento']));

drop policy if exists work_orders_ops_update on public.work_orders;
drop policy if exists work_orders_nontech_update on public.work_orders;
create policy work_orders_nontech_update on public.work_orders for update to authenticated
using (public.has_active_profile_role(array['admin','atendimento','financeiro']))
with check (public.has_active_profile_role(array['admin','atendimento','financeiro']));

drop policy if exists vehicles_ops_update on public.vehicles;
drop policy if exists vehicles_frontdesk_update on public.vehicles;
create policy vehicles_frontdesk_update on public.vehicles for update to authenticated
using (public.has_active_profile_role(array['admin','atendimento']))
with check (public.has_active_profile_role(array['admin','atendimento']));

drop policy if exists vehicles_ops_insert on public.vehicles;
drop policy if exists vehicles_frontdesk_insert on public.vehicles;
create policy vehicles_frontdesk_insert on public.vehicles for insert to authenticated
with check (public.has_active_profile_role(array['admin','atendimento']));
