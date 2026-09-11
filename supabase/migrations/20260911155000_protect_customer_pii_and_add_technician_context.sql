drop policy if exists customers_authenticated_select on public.customers;
drop policy if exists customers_ops_insert on public.customers;
drop policy if exists customers_ops_update on public.customers;

create policy customers_privileged_select on public.customers
for select to authenticated
using (public.has_active_profile_role(array['admin','atendimento','financeiro']));

create policy customers_frontdesk_insert on public.customers
for insert to authenticated
with check (public.has_active_profile_role(array['admin','atendimento']));

create policy customers_frontdesk_update on public.customers
for update to authenticated
using (public.has_active_profile_role(array['admin','atendimento']))
with check (public.has_active_profile_role(array['admin','atendimento']));

create or replace function public.get_technician_vehicle_directory()
returns table(id uuid,plate text,brand text,model text,version text,year integer,model_year integer,color text,fuel text,vin text,current_mileage integer,notes text,customer_name text,order_count bigint,appointment_count bigint)
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if auth.uid() is null then raise exception 'Autenticação obrigatória.'; end if;
  if not exists(select 1 from public.profiles p where p.id=auth.uid() and p.active=true and p.role='tecnico') then raise exception 'Função exclusiva do perfil técnico.'; end if;
  return query
  select v.id,v.plate,v.brand,v.model,v.version,v.year,v.model_year,v.color,v.fuel,v.vin,v.current_mileage,v.notes,c.name,
         (select count(*) from public.work_orders wo where wo.vehicle_id=v.id),
         (select count(*) from public.appointments a where a.vehicle_id=v.id)
  from public.vehicles v left join public.customers c on c.id=v.customer_id
  order by v.created_at desc;
end; $$;

create or replace function public.get_technician_work_order_context(p_work_order_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_role text; v_payload jsonb;
begin
  if auth.uid() is null then raise exception 'Autenticação obrigatória.'; end if;
  select role into v_role from public.profiles where id=auth.uid() and active=true;
  if v_role<>'tecnico' then raise exception 'Função exclusiva do perfil técnico.'; end if;
  select jsonb_build_object(
    'order',jsonb_build_object('id',wo.id,'order_number',wo.order_number,'status',wo.status,'approval_status',wo.approval_status,'payment_status',wo.payment_status,'customer_id',wo.customer_id,'vehicle_id',wo.vehicle_id,'entry_at',wo.entry_at,'promised_at',wo.promised_at,'delivered_at',wo.delivered_at,'mileage_in',wo.mileage_in,'fuel_level',wo.fuel_level,'customer_report',wo.customer_report,'diagnosis',wo.diagnosis,'customer_notes',wo.customer_notes,'internal_notes',wo.internal_notes,'warranty_until',wo.warranty_until,'subtotal_services',wo.subtotal_services,'subtotal_parts',wo.subtotal_parts,'discount',wo.discount,'total',wo.total,'updated_at',wo.updated_at),
    'customer',jsonb_build_object('id',c.id,'name',c.name),
    'vehicle',jsonb_build_object('id',v.id,'plate',v.plate,'brand',v.brand,'model',v.model,'version',v.version,'year',v.year,'model_year',v.model_year,'color',v.color,'fuel',v.fuel,'vin',v.vin,'current_mileage',v.current_mileage,'notes',v.notes)
  ) into v_payload
  from public.work_orders wo left join public.customers c on c.id=wo.customer_id left join public.vehicles v on v.id=wo.vehicle_id
  where wo.id=p_work_order_id;
  if v_payload is null then raise exception 'OS não encontrada.'; end if;
  return v_payload;
end; $$;

revoke all on function public.get_technician_vehicle_directory() from public,anon;
revoke all on function public.get_technician_work_order_context(uuid) from public,anon;
grant execute on function public.get_technician_vehicle_directory() to authenticated,service_role;
grant execute on function public.get_technician_work_order_context(uuid) to authenticated,service_role;
