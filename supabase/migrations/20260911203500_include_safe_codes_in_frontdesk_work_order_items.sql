create or replace function public.get_frontdesk_work_order_items(p_work_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
begin
  if auth.uid() is null then raise exception 'Autenticação obrigatória.'; end if;
  if not public.has_active_profile_role(array['admin','atendimento']) then raise exception 'Sem permissão.'; end if;
  return jsonb_build_object(
    'parts', coalesce((select jsonb_agg(jsonb_build_object(
      'id',p.id,'work_order_id',p.work_order_id,'inventory_item_id',p.inventory_item_id,
      'inventory_sku',i.sku,'description',p.description,'quantity',p.quantity,'unit_price',p.unit_price,'created_at',p.created_at
    ) order by p.created_at) from public.work_order_parts p left join public.inventory_items i on i.id=p.inventory_item_id where p.work_order_id=p_work_order_id),'[]'::jsonb),
    'services', coalesce((select jsonb_agg(jsonb_build_object(
      'id',s.id,'work_order_id',s.work_order_id,'service_id',s.service_id,'service_code',c.code,'description',s.description,
      'quantity',s.quantity,'unit_price',s.unit_price,'status',s.status,'collaborator_id',s.collaborator_id,
      'notes',s.notes,'completed_at',s.completed_at,'created_at',s.created_at
    ) order by s.created_at) from public.work_order_services s left join public.service_catalog c on c.id=s.service_id where s.work_order_id=p_work_order_id),'[]'::jsonb)
  );
end;
$function$;
