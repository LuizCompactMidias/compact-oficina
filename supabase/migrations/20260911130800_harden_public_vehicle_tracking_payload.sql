create or replace function public.get_vehicle_tracking(p_token uuid)
returns jsonb
language sql
stable
security definer
set search_path to 'public','pg_temp'
as $function$
  select jsonb_build_object(
    'tracking',jsonb_build_object('status',t.status,'customer_note',t.customer_note,'updated_at',t.updated_at),
    'order',jsonb_build_object('order_number',o.order_number,'status',o.status,'promised_at',o.promised_at,'entry_at',o.entry_at,'delivered_at',o.delivered_at),
    'customer',jsonb_build_object('name',c.name),
    'vehicle',jsonb_build_object('plate',v.plate,'brand',v.brand,'model',v.model,'year',v.year,'model_year',v.model_year,'color',v.color),
    'shop',jsonb_build_object('name',coalesce(nullif(s.trade_name,''),nullif(s.company_name,''),'COMPACT Centro Automotivo'),'phone',s.phone,'whatsapp',s.whatsapp,'business_hours',s.business_hours),
    'status_history',coalesce((select jsonb_agg(jsonb_build_object('from_status',h.from_status,'to_status',h.to_status,'created_at',h.created_at) order by h.created_at) from public.work_order_status_history h where h.work_order_id=o.id),'[]'::jsonb),
    'services',coalesce((select jsonb_agg(jsonb_build_object('description',ws.description,'status',ws.status,'completed_at',ws.completed_at) order by ws.created_at) from public.work_order_services ws where ws.work_order_id=o.id),'[]'::jsonb)
  )
  from public.work_order_tracking t
  join public.work_orders o on o.id=t.work_order_id
  join public.customers c on c.id=o.customer_id
  join public.vehicles v on v.id=o.vehicle_id
  left join public.app_settings s on s.id=1
  where t.access_token=p_token and coalesce(s.tracking_enabled,true)=true;
$function$;
revoke all on function public.get_vehicle_tracking(uuid) from public;
grant execute on function public.get_vehicle_tracking(uuid) to anon, authenticated, service_role;
