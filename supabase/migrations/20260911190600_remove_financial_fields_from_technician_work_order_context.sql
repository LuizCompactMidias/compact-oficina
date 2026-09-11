create or replace function public.get_technician_work_order_context(p_work_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_role text; v_payload jsonb;
begin
  if auth.uid() is null then raise exception 'Autenticação obrigatória.'; end if;
  select role into v_role from public.profiles where id=auth.uid() and active=true;
  if v_role <> 'tecnico' then raise exception 'Função exclusiva do perfil técnico.'; end if;

  select jsonb_build_object(
    'order', jsonb_build_object(
      'id',wo.id,'order_number',wo.order_number,'status',wo.status,'approval_status',wo.approval_status,
      'customer_id',wo.customer_id,'vehicle_id',wo.vehicle_id,
      'entry_at',wo.entry_at,'promised_at',wo.promised_at,'delivered_at',wo.delivered_at,
      'mileage_in',wo.mileage_in,'fuel_level',wo.fuel_level,'customer_report',wo.customer_report,
      'diagnosis',wo.diagnosis,'customer_notes',wo.customer_notes,'internal_notes',wo.internal_notes,
      'warranty_until',wo.warranty_until,'updated_at',wo.updated_at
    ),
    'customer', jsonb_build_object('id',c.id,'name',c.name),
    'vehicle', jsonb_build_object(
      'id',v.id,'plate',v.plate,'brand',v.brand,'model',v.model,'version',v.version,'year',v.year,'model_year',v.model_year,
      'color',v.color,'fuel',v.fuel,'vin',v.vin,'current_mileage',v.current_mileage,'notes',v.notes
    )
  ) into v_payload
  from public.work_orders wo
  left join public.customers c on c.id=wo.customer_id
  left join public.vehicles v on v.id=wo.vehicle_id
  where wo.id=p_work_order_id;

  if v_payload is null then raise exception 'OS não encontrada.'; end if;
  return v_payload;
end;
$$;

revoke all on function public.get_technician_work_order_context(uuid) from public, anon;
grant execute on function public.get_technician_work_order_context(uuid) to authenticated, service_role;
