create or replace function public.post_purchase_invoice(p_invoice jsonb, p_items jsonb)
returns table(purchase_invoice_id uuid, expense_id uuid, item_count integer, total_amount numeric)
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_supplier_id uuid;
  v_invoice_id uuid:=coalesce(nullif(p_invoice->>'id','')::uuid,gen_random_uuid());
  v_expense_id uuid;
  v_item jsonb;
  v_inventory_id uuid;
  v_total numeric(12,2):=0;
  v_count integer:=0;
  v_qty numeric;
  v_cost numeric;
  v_name text;
  v_create_expense boolean:=coalesce((p_invoice->>'create_expense')::boolean,true);
  v_role text;
  v_active boolean;
begin
  if auth.uid() is null then raise exception 'Autenticação obrigatória.'; end if;
  select role,active into v_role,v_active from public.profiles where id=auth.uid();
  if coalesce(v_active,false) is not true or v_role not in ('admin','financeiro') then
    raise exception 'Sem permissão para lançar nota fiscal.';
  end if;
  if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 then raise exception 'A nota precisa ter pelo menos um item.'; end if;
  v_name:=trim(coalesce(p_invoice->>'supplier_name','')); if v_name='' then raise exception 'Informe o fornecedor.'; end if;
  select id into v_supplier_id from public.suppliers where lower(trim(name))=lower(v_name) limit 1;
  if v_supplier_id is null then insert into public.suppliers(name,cpf_cnpj,active) values(v_name,nullif(trim(coalesce(p_invoice->>'supplier_cnpj','')),''),true) returning id into v_supplier_id; end if;
  select coalesce(sum(coalesce((x->>'quantity')::numeric,0)*coalesce((x->>'unit_cost')::numeric,0)),0) into v_total from jsonb_array_elements(p_items) x;
  if v_create_expense then
    insert into public.expenses(supplier_id,description,category,amount,status,due_date,document_number,notes,created_by)
    values(v_supplier_id,'NF '||coalesce(p_invoice->>'invoice_number',''),'Compra de estoque',v_total,case when coalesce(p_invoice->>'paid','false')::boolean then 'pago' else 'pendente' end,nullif(p_invoice->>'due_date','')::date,nullif(p_invoice->>'invoice_number',''),nullif(p_invoice->>'notes',''),auth.uid())
    returning id into v_expense_id;
  end if;
  insert into public.purchase_invoices(id,source_type,supplier_id,supplier_name_snapshot,supplier_cnpj_snapshot,invoice_number,series,access_key,issued_at,total_amount,status,source_file_path,expense_id,notes,created_by,confirmed_by)
  values(v_invoice_id,coalesce(nullif(p_invoice->>'source_type',''),'manual'),v_supplier_id,v_name,nullif(p_invoice->>'supplier_cnpj',''),coalesce(p_invoice->>'invoice_number',''),nullif(p_invoice->>'series',''),nullif(regexp_replace(coalesce(p_invoice->>'access_key',''),'\D','','g'),''),nullif(p_invoice->>'issued_at','')::timestamptz,v_total,'confirmado',nullif(p_invoice->>'source_file_path',''),v_expense_id,nullif(p_invoice->>'notes',''),auth.uid(),auth.uid());
  for v_item in select value from jsonb_array_elements(p_items) loop
    v_qty:=coalesce(nullif(v_item->>'quantity','')::numeric,0);
    v_cost:=coalesce(nullif(v_item->>'unit_cost','')::numeric,0);
    if v_qty<=0 then raise exception 'Quantidade inválida.'; end if;
    if nullif(v_item->>'inventory_item_id','') is not null then
      v_inventory_id:=(v_item->>'inventory_item_id')::uuid;
      update public.inventory_items set quantity=quantity+v_qty,cost_price=v_cost,updated_at=now() where id=v_inventory_id;
      if not found then raise exception 'Item de estoque não encontrado.'; end if;
    else
      insert into public.inventory_items(name,sku,barcode,category,unit,quantity,min_quantity,cost_price,sale_price,ncm,active)
      values(trim(v_item->>'description'),nullif(v_item->>'sku',''),coalesce(nullif(v_item->>'barcode',''),nullif(v_item->>'ean','')),coalesce(nullif(v_item->>'category',''),'Peças'),coalesce(nullif(v_item->>'unit',''),'un'),v_qty,coalesce(nullif(v_item->>'min_quantity','')::numeric,0),v_cost,coalesce(nullif(v_item->>'sale_price','')::numeric,v_cost),nullif(v_item->>'ncm',''),true)
      returning id into v_inventory_id;
    end if;
    insert into public.purchase_invoice_items(purchase_invoice_id,inventory_item_id,supplier_code,ean,ncm,cfop,description,unit,quantity,unit_cost,line_total)
    values(v_invoice_id,v_inventory_id,nullif(v_item->>'supplier_code',''),nullif(v_item->>'ean',''),nullif(v_item->>'ncm',''),nullif(v_item->>'cfop',''),trim(v_item->>'description'),coalesce(nullif(v_item->>'unit',''),'un'),v_qty,v_cost,round(v_qty*v_cost,2));
    insert into public.inventory_movements(inventory_item_id,movement_type,quantity,reason,reference_type,reference_id,created_by)
    values(v_inventory_id,'entrada',v_qty,'Entrada por nota fiscal','purchase_invoice',v_invoice_id,auth.uid());
    v_count:=v_count+1;
  end loop;
  return query select v_invoice_id,v_expense_id,v_count,v_total;
end;
$function$;

create or replace function public.mark_collaborator_commissions_paid(p_collaborator_id uuid, p_month date)
returns integer
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_count integer;
  v_role text;
  v_active boolean;
begin
  if auth.uid() is null then raise exception 'Autenticação obrigatória.'; end if;
  select role,active into v_role,v_active from public.profiles where id=auth.uid();
  if coalesce(v_active,false) is not true or v_role not in ('admin','financeiro') then
    raise exception 'Sem permissão para quitar comissões.';
  end if;
  update public.service_commission_entries
  set status='pago', paid_at=now(), paid_by=auth.uid(), updated_at=now()
  where collaborator_id=p_collaborator_id and status='pendente'
    and date_trunc('month', earned_at at time zone 'America/Sao_Paulo') = date_trunc('month', p_month::timestamp);
  get diagnostics v_count = row_count;
  return v_count;
end;
$function$;

revoke all on function public.post_purchase_invoice(jsonb,jsonb) from public,anon;
revoke all on function public.mark_collaborator_commissions_paid(uuid,date) from public,anon;
grant execute on function public.post_purchase_invoice(jsonb,jsonb) to authenticated,service_role;
grant execute on function public.mark_collaborator_commissions_paid(uuid,date) to authenticated,service_role;

revoke all on function public.sync_service_commission_entry() from public,anon,authenticated;
grant execute on function public.sync_service_commission_entry() to service_role;
