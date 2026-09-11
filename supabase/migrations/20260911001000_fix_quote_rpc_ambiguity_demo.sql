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
  if not exists(select 1 from public.profiles pr where pr.id=v_user and pr.active=true and pr.role in ('admin','atendimento')) then raise exception 'Usuário sem permissão para criar orçamento'; end if;
  v_customer_id := nullif(p_customer->>'id','')::uuid;
  v_vehicle_id := nullif(p_vehicle->>'id','')::uuid;
  if v_customer_id is null or not exists(select 1 from public.customers c where c.id=v_customer_id) then raise exception 'Cliente inválido'; end if;
  if v_vehicle_id is null or not exists(select 1 from public.vehicles v where v.id=v_vehicle_id and v.customer_id=v_customer_id) then raise exception 'Veículo inválido para este cliente'; end if;
  insert into public.quotes(customer_id,vehicle_id,status,discount,notes,valid_until,created_by)
  values(v_customer_id,v_vehicle_id,'rascunho',v_discount,nullif(trim(coalesce(p_quote->>'notes','')),''),nullif(p_quote->>'valid_until','')::date,v_user)
  returning id,quotes.quote_number into v_quote_id,v_quote_number;
  for v_item in select value from jsonb_array_elements(coalesce(p_parts,'[]'::jsonb)) loop
    if length(trim(coalesce(v_item->>'description',''))) > 0 then
      if nullif(v_item->>'inventory_item_id','') is not null and not exists(select 1 from public.inventory_items ii where ii.id=(v_item->>'inventory_item_id')::uuid and ii.active=true) then raise exception 'Peça de estoque inválida: %',trim(v_item->>'description'); end if;
      insert into public.quote_items(quote_id,item_type,description,quantity,unit_price,inventory_item_id)
      values(v_quote_id,'part',trim(v_item->>'description'),greatest(coalesce(nullif(v_item->>'quantity','')::numeric,1),0.001),greatest(coalesce(nullif(v_item->>'unit_price','')::numeric,0),0),nullif(v_item->>'inventory_item_id','')::uuid);
      v_parts:=v_parts+greatest(coalesce(nullif(v_item->>'quantity','')::numeric,1),0.001)*greatest(coalesce(nullif(v_item->>'unit_price','')::numeric,0),0);
    end if;
  end loop;
  for v_item in select value from jsonb_array_elements(coalesce(p_labor,'[]'::jsonb)) loop
    if length(trim(coalesce(v_item->>'description',''))) > 0 then
      insert into public.quote_items(quote_id,item_type,description,quantity,unit_price)
      values(v_quote_id,'service',trim(v_item->>'description'),greatest(coalesce(nullif(v_item->>'quantity','')::numeric,1),0.001),greatest(coalesce(nullif(v_item->>'unit_price','')::numeric,0),0));
      v_labor:=v_labor+greatest(coalesce(nullif(v_item->>'quantity','')::numeric,1),0.001)*greatest(coalesce(nullif(v_item->>'unit_price','')::numeric,0),0);
    end if;
  end loop;
  if not exists(select 1 from public.quote_items qi where qi.quote_id=v_quote_id) then raise exception 'Informe ao menos uma peça ou serviço'; end if;
  v_total:=greatest(v_parts+v_labor-v_discount,0);
  update public.quotes q set subtotal_parts=v_parts,subtotal_labor=v_labor,total=v_total,updated_at=now() where q.id=v_quote_id;
  return query select v_quote_id,v_quote_number,v_total;
end;
$$;
