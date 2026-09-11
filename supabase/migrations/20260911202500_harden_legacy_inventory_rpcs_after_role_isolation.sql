create or replace function public.add_inventory_part_to_work_order(p_work_order_id uuid, p_inventory_item_id uuid, p_quantity numeric, p_unit_price numeric)
returns uuid
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_item public.inventory_items%rowtype;
  v_order public.work_orders%rowtype;
  v_part_id uuid;
  v_user uuid:=auth.uid();
begin
  if v_user is null then raise exception 'Usuário não autenticado'; end if;
  if not exists(select 1 from public.profiles where id=v_user and active=true and role in ('admin','atendimento')) then raise exception 'Sem permissão para lançar peças comerciais na OS'; end if;
  if p_quantity is null or p_quantity<=0 then raise exception 'Quantidade inválida'; end if;
  select * into v_order from public.work_orders where id=p_work_order_id for update;
  if not found then raise exception 'OS não encontrada'; end if;
  if v_order.status in ('entregue','cancelada') then raise exception 'Não é possível lançar peças em uma OS encerrada'; end if;
  select * into v_item from public.inventory_items where id=p_inventory_item_id and active=true for update;
  if not found then raise exception 'Item de estoque não encontrado ou inativo'; end if;
  if coalesce(v_item.quantity,0)<p_quantity then raise exception 'Estoque insuficiente para %. Disponível: % %',v_item.name,v_item.quantity,v_item.unit; end if;
  insert into public.work_order_parts(work_order_id,inventory_item_id,description,quantity,unit_cost,unit_price)
  values(p_work_order_id,v_item.id,v_item.name,p_quantity,coalesce(v_item.cost_price,0),coalesce(p_unit_price,v_item.sale_price,0)) returning id into v_part_id;
  update public.inventory_items set quantity=quantity-p_quantity,updated_at=now() where id=v_item.id;
  insert into public.inventory_movements(inventory_item_id,movement_type,quantity,unit_cost,reason,reference_type,reference_id,created_by)
  values(v_item.id,'saida',p_quantity,v_item.cost_price,'Uso em ordem de serviço','work_order',p_work_order_id,v_user);
  return v_part_id;
end;
$function$;

create or replace function public.remove_inventory_part_from_work_order(p_part_id uuid)
returns numeric
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_part public.work_order_parts%rowtype;
  v_order public.work_orders%rowtype;
  v_remaining numeric;
  v_user uuid:=auth.uid();
begin
  if v_user is null then raise exception 'Usuário não autenticado'; end if;
  if not exists(select 1 from public.profiles where id=v_user and active=true and role in ('admin','atendimento')) then raise exception 'Sem permissão para alterar peças comerciais da OS'; end if;
  select * into v_part from public.work_order_parts where id=p_part_id for update;
  if not found then raise exception 'Peça da OS não encontrada'; end if;
  select * into v_order from public.work_orders where id=v_part.work_order_id for update;
  if v_order.status in ('entregue','cancelada') then raise exception 'Não é possível remover peças de uma OS encerrada'; end if;
  if v_part.inventory_item_id is not null then
    update public.inventory_items set quantity=quantity+v_part.quantity,updated_at=now() where id=v_part.inventory_item_id returning quantity into v_remaining;
    insert into public.inventory_movements(inventory_item_id,movement_type,quantity,unit_cost,reason,reference_type,reference_id,created_by)
    values(v_part.inventory_item_id,'entrada',v_part.quantity,v_part.unit_cost,'Estorno de peça da OS #'||v_order.order_number,'work_order',v_order.id,v_user);
  end if;
  delete from public.work_order_parts where id=p_part_id;
  return v_remaining;
end;
$function$;

create or replace function public.adjust_inventory_stock(p_inventory_item_id uuid, p_quantity numeric, p_type text, p_reason text, p_unit_cost numeric default null)
returns numeric
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_item public.inventory_items%rowtype;
  v_next numeric;
  v_delta numeric;
  v_user uuid := auth.uid();
  v_role text;
  v_movement_cost numeric;
begin
  if v_user is null then raise exception 'Usuário não autenticado'; end if;
  select role into v_role from public.profiles where id=v_user and active=true;
  if v_role not in ('admin','atendimento','tecnico') then raise exception 'Sem permissão para operar o estoque'; end if;
  if p_type not in ('entrada','saida','ajuste') then raise exception 'Tipo de movimentação inválido'; end if;
  if p_quantity is null or p_quantity < 0 then raise exception 'Quantidade inválida'; end if;
  select * into v_item from public.inventory_items where id=p_inventory_item_id for update;
  if not found then raise exception 'Item não encontrado'; end if;
  v_movement_cost:=case when v_role='admin' then coalesce(p_unit_cost,v_item.cost_price) else v_item.cost_price end;
  if p_type='entrada' then
    if p_quantity<=0 then raise exception 'Quantidade deve ser maior que zero'; end if;
    v_next:=v_item.quantity+p_quantity; v_delta:=p_quantity;
  elsif p_type='saida' then
    if p_quantity<=0 then raise exception 'Quantidade deve ser maior que zero'; end if;
    v_next:=v_item.quantity-p_quantity;
    if v_next<0 then raise exception 'Estoque insuficiente. Disponível: % %',v_item.quantity,v_item.unit; end if;
    v_delta:=p_quantity;
  else
    v_next:=p_quantity; v_delta:=abs(v_next-v_item.quantity);
  end if;
  update public.inventory_items set quantity=v_next,updated_at=now() where id=p_inventory_item_id;
  if v_delta>0 then
    insert into public.inventory_movements(inventory_item_id,movement_type,quantity,unit_cost,reason,created_by)
    values(p_inventory_item_id,p_type,v_delta,v_movement_cost,nullif(trim(coalesce(p_reason,'')),''),v_user);
  end if;
  return v_next;
end;
$function$;
