create table if not exists public.collaborators (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  job_title text,
  phone text,
  commission_percent numeric(5,2) not null default 0 check (commission_percent between 0 and 100),
  commission_active boolean not null default true,
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.work_order_services add column if not exists collaborator_id uuid references public.collaborators(id) on delete set null;
alter table public.work_order_services add column if not exists completed_at timestamptz;

create table if not exists public.service_commission_entries (
  id uuid primary key default gen_random_uuid(),
  work_order_service_id uuid not null unique references public.work_order_services(id) on delete cascade,
  work_order_id uuid not null references public.work_orders(id) on delete cascade,
  order_number bigint not null,
  collaborator_id uuid not null references public.collaborators(id) on delete restrict,
  collaborator_name text not null,
  service_description text not null,
  service_amount numeric(12,2) not null default 0,
  commission_percent numeric(5,2) not null default 0,
  commission_amount numeric(12,2) not null default 0,
  earned_at timestamptz not null default now(),
  status text not null default 'pendente' check (status in ('pendente','pago','cancelado')),
  paid_at timestamptz,
  paid_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.purchase_invoices (
  id uuid primary key default gen_random_uuid(),
  source_type text not null default 'manual' check (source_type in ('xml','printed','manual')),
  supplier_id uuid not null references public.suppliers(id) on delete restrict,
  supplier_name_snapshot text not null,
  supplier_cnpj_snapshot text,
  invoice_number text not null,
  series text,
  access_key text,
  issued_at timestamptz,
  total_amount numeric(12,2) not null default 0,
  status text not null default 'confirmado' check (status in ('confirmado','cancelado')),
  source_file_path text,
  notes text,
  expense_id uuid references public.expenses(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  confirmed_by uuid references public.profiles(id) on delete set null,
  confirmed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.purchase_invoice_items (
  id uuid primary key default gen_random_uuid(),
  purchase_invoice_id uuid not null references public.purchase_invoices(id) on delete cascade,
  inventory_item_id uuid not null references public.inventory_items(id) on delete restrict,
  supplier_code text,
  ean text,
  ncm text,
  cfop text,
  description text not null,
  unit text not null default 'un',
  quantity numeric(12,3) not null check (quantity > 0),
  unit_cost numeric(12,4) not null check (unit_cost >= 0),
  line_total numeric(12,2) not null check (line_total >= 0),
  created_at timestamptz not null default now()
);

create index if not exists service_commission_entries_collab_idx on public.service_commission_entries(collaborator_id, earned_at desc);
create index if not exists purchase_invoices_issued_idx on public.purchase_invoices(issued_at desc);
create index if not exists purchase_invoice_items_invoice_idx on public.purchase_invoice_items(purchase_invoice_id);

alter table public.collaborators enable row level security;
alter table public.service_commission_entries enable row level security;
alter table public.purchase_invoices enable row level security;
alter table public.purchase_invoice_items enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='collaborators' and policyname='authenticated_all_collaborators') then
    create policy authenticated_all_collaborators on public.collaborators for all to authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='service_commission_entries' and policyname='authenticated_all_commissions') then
    create policy authenticated_all_commissions on public.service_commission_entries for all to authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='purchase_invoices' and policyname='authenticated_all_purchase_invoices') then
    create policy authenticated_all_purchase_invoices on public.purchase_invoices for all to authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='purchase_invoice_items' and policyname='authenticated_all_purchase_invoice_items') then
    create policy authenticated_all_purchase_invoice_items on public.purchase_invoice_items for all to authenticated using (true) with check (true);
  end if;
end $$;

create or replace function public.sync_service_commission_entry()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_collab public.collaborators%rowtype; v_order_number bigint; v_amount numeric(12,2);
begin
  if new.status <> 'concluido' or new.collaborator_id is null then
    delete from public.service_commission_entries where work_order_service_id=new.id and status='pendente';
    return new;
  end if;
  select * into v_collab from public.collaborators where id=new.collaborator_id;
  if v_collab.id is null or not v_collab.active or not v_collab.commission_active then return new; end if;
  select order_number into v_order_number from public.work_orders where id=new.work_order_id;
  v_amount:=round((coalesce(new.quantity,1)*coalesce(new.unit_price,0))::numeric,2);
  insert into public.service_commission_entries(work_order_service_id,work_order_id,order_number,collaborator_id,collaborator_name,service_description,service_amount,commission_percent,commission_amount,earned_at,status)
  values(new.id,new.work_order_id,v_order_number,v_collab.id,v_collab.name,new.description,v_amount,v_collab.commission_percent,round((v_amount*v_collab.commission_percent/100)::numeric,2),coalesce(new.completed_at,now()),'pendente')
  on conflict(work_order_service_id) do update set collaborator_id=excluded.collaborator_id,collaborator_name=excluded.collaborator_name,service_description=excluded.service_description,service_amount=excluded.service_amount,commission_percent=excluded.commission_percent,commission_amount=excluded.commission_amount,earned_at=excluded.earned_at,updated_at=now()
  where public.service_commission_entries.status='pendente';
  return new;
end $$;

drop trigger if exists trg_sync_service_commission_entry on public.work_order_services;
create trigger trg_sync_service_commission_entry after insert or update of status, collaborator_id, quantity, unit_price, description on public.work_order_services for each row execute function public.sync_service_commission_entry();

create or replace function public.mark_collaborator_commissions_paid(p_collaborator_id uuid,p_month date)
returns integer language plpgsql security definer set search_path=public as $$
declare v_count integer;
begin
  update public.service_commission_entries set status='pago',paid_at=now(),paid_by=auth.uid(),updated_at=now()
  where collaborator_id=p_collaborator_id and status='pendente' and date_trunc('month',earned_at at time zone 'America/Sao_Paulo')=date_trunc('month',p_month::timestamp);
  get diagnostics v_count=row_count; return v_count;
end $$;
grant execute on function public.mark_collaborator_commissions_paid(uuid,date) to authenticated;

create or replace function public.post_purchase_invoice(p_invoice jsonb,p_items jsonb)
returns table(purchase_invoice_id uuid,expense_id uuid,item_count integer,total_amount numeric)
language plpgsql security definer set search_path=public as $$
declare v_supplier_id uuid; v_invoice_id uuid:=gen_random_uuid(); v_expense_id uuid; v_item jsonb; v_inventory_id uuid; v_total numeric(12,2):=0; v_count integer:=0; v_qty numeric; v_cost numeric; v_name text;
begin
  if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 then raise exception 'A nota precisa ter pelo menos um item.'; end if;
  v_name:=trim(coalesce(p_invoice->>'supplier_name','')); if v_name='' then raise exception 'Informe o fornecedor.'; end if;
  select id into v_supplier_id from public.suppliers where lower(trim(name))=lower(v_name) limit 1;
  if v_supplier_id is null then insert into public.suppliers(name,cpf_cnpj,active) values(v_name,nullif(trim(coalesce(p_invoice->>'supplier_cnpj','')),''),true) returning id into v_supplier_id; end if;
  select coalesce(sum(coalesce((x->>'quantity')::numeric,0)*coalesce((x->>'unit_cost')::numeric,0)),0) into v_total from jsonb_array_elements(p_items) x;
  insert into public.expenses(supplier_id,description,category,amount,status,due_date,document_number,notes,created_by)
  values(v_supplier_id,'NF '||coalesce(p_invoice->>'invoice_number',''),'Compra de estoque',v_total,case when coalesce(p_invoice->>'paid','false')::boolean then 'pago' else 'pendente' end,nullif(p_invoice->>'due_date','')::date,nullif(p_invoice->>'invoice_number',''),nullif(p_invoice->>'notes',''),auth.uid()) returning id into v_expense_id;
  insert into public.purchase_invoices(id,source_type,supplier_id,supplier_name_snapshot,supplier_cnpj_snapshot,invoice_number,series,access_key,issued_at,total_amount,status,expense_id,created_by,confirmed_by)
  values(v_invoice_id,'manual',v_supplier_id,v_name,nullif(p_invoice->>'supplier_cnpj',''),coalesce(p_invoice->>'invoice_number',''),nullif(p_invoice->>'series',''),nullif(p_invoice->>'access_key',''),nullif(p_invoice->>'issued_at','')::timestamptz,v_total,'confirmado',v_expense_id,auth.uid(),auth.uid());
  for v_item in select value from jsonb_array_elements(p_items) loop
    v_qty:=coalesce(nullif(v_item->>'quantity','')::numeric,0); v_cost:=coalesce(nullif(v_item->>'unit_cost','')::numeric,0); if v_qty<=0 then raise exception 'Quantidade inválida.'; end if;
    if nullif(v_item->>'inventory_item_id','') is not null then v_inventory_id:=(v_item->>'inventory_item_id')::uuid; update public.inventory_items set quantity=quantity+v_qty,cost_price=v_cost,updated_at=now() where id=v_inventory_id;
    else insert into public.inventory_items(name,sku,barcode,category,unit,quantity,min_quantity,cost_price,sale_price,ncm,active) values(trim(v_item->>'description'),nullif(v_item->>'sku',''),nullif(v_item->>'barcode',''),coalesce(nullif(v_item->>'category',''),'Peças'),coalesce(nullif(v_item->>'unit',''),'un'),v_qty,0,v_cost,coalesce(nullif(v_item->>'sale_price','')::numeric,v_cost),nullif(v_item->>'ncm',''),true) returning id into v_inventory_id; end if;
    insert into public.purchase_invoice_items(purchase_invoice_id,inventory_item_id,description,unit,quantity,unit_cost,line_total,ncm) values(v_invoice_id,v_inventory_id,trim(v_item->>'description'),coalesce(nullif(v_item->>'unit',''),'un'),v_qty,v_cost,round(v_qty*v_cost,2),nullif(v_item->>'ncm',''));
    insert into public.inventory_movements(inventory_item_id,movement_type,quantity,reason,reference_type,reference_id,created_by) values(v_inventory_id,'entrada',v_qty,'Entrada por nota fiscal','purchase_invoice',v_invoice_id,auth.uid()); v_count:=v_count+1;
  end loop;
  return query select v_invoice_id,v_expense_id,v_count,v_total;
end $$;
grant execute on function public.post_purchase_invoice(jsonb,jsonb) to authenticated;
