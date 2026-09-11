create or replace function public.create_quote_v2(
  p_customer jsonb,
  p_vehicle jsonb,
  p_quote jsonb,
  p_parts jsonb default '[]'::jsonb,
  p_labor jsonb default '[]'::jsonb
)
returns table(quote_id uuid, quote_number bigint, total numeric)
language plpgsql
security invoker
set search_path=public,pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_customer_id uuid;
  v_vehicle_id uuid;
  v_quote_id uuid;
  v_quote_number bigint;
  v_item jsonb;
  v_parts numeric := 0;
  v_labor numeric := 0;
  v_discount numeric := greatest(coalesce(nullif(p_quote->>'discount','')::numeric,0),0);
  v_total numeric := 0;
begin
  if v_user is null then raise exception 'Usuário não autenticado'; end if;
  if not exists(select 1 from public.profiles where id=v_user and active=true and role in ('admin','atendimento')) then
    raise exception 'Usuário sem permissão para criar orçamento';
  end if;

  v_customer_id := nullif(p_customer->>'id','')::uuid;
  v_vehicle_id := nullif(p_vehicle->>'id','')::uuid;
  if v_customer_id is null or not exists(select 1 from public.customers where id=v_customer_id) then raise exception 'Cliente inválido'; end if;
  if v_vehicle_id is null or not exists(select 1 from public.vehicles where id=v_vehicle_id and customer_id=v_customer_id) then raise exception 'Veículo inválido para este cliente'; end if;

  insert into public.quotes(customer_id,vehicle_id,status,discount,notes,valid_until,created_by)
  values(v_customer_id,v_vehicle_id,'rascunho',v_discount,nullif(trim(coalesce(p_quote->>'notes','')),''),nullif(p_quote->>'valid_until','')::date,v_user)
  returning id, quotes.quote_number into v_quote_id,v_quote_number;

  for v_item in select value from jsonb_array_elements(coalesce(p_parts,'[]'::jsonb)) loop
    if length(trim(coalesce(v_item->>'description',''))) > 0 then
      if nullif(v_item->>'inventory_item_id','') is not null and not exists(
        select 1 from public.inventory_items where id=(v_item->>'inventory_item_id')::uuid and active=true
      ) then raise exception 'Peça de estoque inválida: %', trim(v_item->>'description'); end if;
      insert into public.quote_items(quote_id,item_type,description,quantity,unit_price,inventory_item_id)
      values(v_quote_id,'peca',trim(v_item->>'description'),greatest(coalesce(nullif(v_item->>'quantity','')::numeric,1),0.001),greatest(coalesce(nullif(v_item->>'unit_price','')::numeric,0),0),nullif(v_item->>'inventory_item_id','')::uuid);
      v_parts := v_parts + greatest(coalesce(nullif(v_item->>'quantity','')::numeric,1),0.001) * greatest(coalesce(nullif(v_item->>'unit_price','')::numeric,0),0);
    end if;
  end loop;

  for v_item in select value from jsonb_array_elements(coalesce(p_labor,'[]'::jsonb)) loop
    if length(trim(coalesce(v_item->>'description',''))) > 0 then
      insert into public.quote_items(quote_id,item_type,description,quantity,unit_price)
      values(v_quote_id,'mao_obra',trim(v_item->>'description'),greatest(coalesce(nullif(v_item->>'quantity','')::numeric,1),0.001),greatest(coalesce(nullif(v_item->>'unit_price','')::numeric,0),0));
      v_labor := v_labor + greatest(coalesce(nullif(v_item->>'quantity','')::numeric,1),0.001) * greatest(coalesce(nullif(v_item->>'unit_price','')::numeric,0),0);
    end if;
  end loop;

  if v_parts + v_labor <= 0 and not exists(select 1 from public.quote_items where quote_id=v_quote_id) then
    raise exception 'Informe ao menos uma peça ou serviço';
  end if;

  v_total := greatest(v_parts + v_labor - v_discount,0);
  update public.quotes set subtotal_parts=v_parts,subtotal_labor=v_labor,total=v_total,updated_at=now() where id=v_quote_id;
  return query select v_quote_id,v_quote_number,v_total;
end;
$$;

revoke all on function public.create_quote_v2(jsonb,jsonb,jsonb,jsonb,jsonb) from public;
grant execute on function public.create_quote_v2(jsonb,jsonb,jsonb,jsonb,jsonb) to authenticated;

create or replace function public.convert_quote_to_work_order_v2(p_quote_id uuid)
returns table(work_order_id uuid, order_number bigint)
language plpgsql
security invoker
set search_path=public,pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_quote public.quotes%rowtype;
  v_work_order_id uuid;
  v_order_number bigint;
  v_item record;
begin
  if v_user is null then raise exception 'Usuário não autenticado'; end if;
  if not exists(select 1 from public.profiles where id=v_user and active=true and role in ('admin','atendimento')) then
    raise exception 'Usuário sem permissão para converter orçamento';
  end if;

  select * into v_quote from public.quotes where id=p_quote_id for update;
  if not found then raise exception 'Orçamento não encontrado'; end if;
  if v_quote.converted_work_order_id is not null or v_quote.status='convertido' then
    return query select wo.id,wo.order_number from public.work_orders wo where wo.id=v_quote.converted_work_order_id;
    return;
  end if;
  if v_quote.status='cancelado' then raise exception 'Orçamento cancelado não pode ser convertido'; end if;

  insert into public.work_orders(customer_id,vehicle_id,status,approval_status,payment_status,customer_report,subtotal_services,subtotal_parts,discount,total,approved_at,created_by)
  values(v_quote.customer_id,v_quote.vehicle_id,'recepcao','aprovado','pendente',concat('OS criada a partir do orçamento #',v_quote.quote_number),0,0,v_quote.discount,0,now(),v_user)
  returning id,work_orders.order_number into v_work_order_id,v_order_number;

  for v_item in select * from public.quote_items where quote_id=p_quote_id order by created_at,id loop
    if v_item.item_type='peca' then
      if v_item.inventory_item_id is not null then
        perform public.add_inventory_part_to_work_order(v_work_order_id,v_item.inventory_item_id,v_item.quantity,v_item.unit_price);
      else
        insert into public.work_order_parts(work_order_id,description,quantity,unit_cost,unit_price)
        values(v_work_order_id,v_item.description,v_item.quantity,0,v_item.unit_price);
      end if;
    else
      insert into public.work_order_services(work_order_id,description,quantity,unit_price,cost_price,status)
      values(v_work_order_id,v_item.description,v_item.quantity,v_item.unit_price,0,'pendente');
    end if;
  end loop;

  update public.quotes set status='convertido',approved_at=coalesce(approved_at,now()),converted_work_order_id=v_work_order_id,updated_at=now() where id=p_quote_id;
  return query select v_work_order_id,v_order_number;
end;
$$;

revoke all on function public.convert_quote_to_work_order_v2(uuid) from public;
grant execute on function public.convert_quote_to_work_order_v2(uuid) to authenticated;
