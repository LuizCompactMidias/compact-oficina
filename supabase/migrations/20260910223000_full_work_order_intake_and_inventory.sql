-- COMPACT Centro Automotivo: checklist, estoque, fotos e abertura completa de OS.

create table if not exists public.vehicle_checklists (
  id uuid primary key default gen_random_uuid(),
  work_order_id uuid not null unique references public.work_orders(id) on delete cascade,
  mileage_checked boolean not null default false,
  fuel_checked boolean not null default false,
  front_checked boolean not null default false,
  rear_checked boolean not null default false,
  left_side_checked boolean not null default false,
  right_side_checked boolean not null default false,
  wheels_checked boolean not null default false,
  tires_checked boolean not null default false,
  lights_checked boolean not null default false,
  windshield_checked boolean not null default false,
  interior_checked boolean not null default false,
  dashboard_checked boolean not null default false,
  spare_tire_checked boolean not null default false,
  tools_checked boolean not null default false,
  belongings_checked boolean not null default false,
  damage_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.vehicle_checklists enable row level security;
drop policy if exists vehicle_checklists_authenticated_all on public.vehicle_checklists;
create policy vehicle_checklists_authenticated_all on public.vehicle_checklists for all to authenticated using (true) with check (true);
grant select,insert,update,delete on public.vehicle_checklists to authenticated;

create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  inventory_item_id uuid not null references public.inventory_items(id) on delete restrict,
  movement_type text not null check (movement_type in ('entrada','saida','ajuste')),
  quantity numeric(12,3) not null check (quantity > 0),
  unit_cost numeric(12,4),
  reason text,
  reference_type text,
  reference_id uuid,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists inventory_movements_item_idx on public.inventory_movements(inventory_item_id,created_at desc);
alter table public.inventory_movements enable row level security;
drop policy if exists inventory_movements_authenticated_all on public.inventory_movements;
create policy inventory_movements_authenticated_all on public.inventory_movements for all to authenticated using (true) with check (true);
grant select,insert,update,delete on public.inventory_movements to authenticated;

create or replace function public.add_inventory_part_to_work_order(p_work_order_id uuid,p_inventory_item_id uuid,p_quantity numeric,p_unit_price numeric)
returns uuid language plpgsql security invoker set search_path=public,pg_temp as $$
declare v_item public.inventory_items%rowtype; v_part_id uuid;
begin
  if auth.uid() is null then raise exception 'Sessão inválida'; end if;
  if p_quantity is null or p_quantity<=0 then raise exception 'Quantidade inválida'; end if;
  select * into v_item from public.inventory_items where id=p_inventory_item_id and active=true for update;
  if v_item.id is null then raise exception 'Item de estoque não encontrado ou inativo'; end if;
  if coalesce(v_item.quantity,0)<p_quantity then raise exception 'Saldo insuficiente para %',v_item.name; end if;
  insert into public.work_order_parts(work_order_id,inventory_item_id,description,quantity,unit_cost,unit_price)
  values(p_work_order_id,v_item.id,v_item.name,p_quantity,coalesce(v_item.cost_price,0),coalesce(p_unit_price,v_item.sale_price,0)) returning id into v_part_id;
  update public.inventory_items set quantity=quantity-p_quantity,updated_at=now() where id=v_item.id;
  insert into public.inventory_movements(inventory_item_id,movement_type,quantity,unit_cost,reason,reference_type,reference_id,created_by)
  values(v_item.id,'saida',p_quantity,v_item.cost_price,'Uso em ordem de serviço','work_order',p_work_order_id,auth.uid());
  return v_part_id;
end;$$;
grant execute on function public.add_inventory_part_to_work_order(uuid,uuid,numeric,numeric) to authenticated;

create or replace function public.create_work_order_intake_v3(
 p_customer jsonb,p_vehicle jsonb,p_order jsonb,p_checklist jsonb default '{}'::jsonb,p_parts jsonb default '[]'::jsonb,p_services jsonb default '[]'::jsonb)
returns table(work_order_id uuid,order_number bigint,total numeric)
language plpgsql security invoker set search_path=public,pg_temp as $$
declare v_customer_id uuid;v_vehicle_id uuid;v_work_order_id uuid;v_item jsonb;
begin
 if auth.uid() is null then raise exception 'Sessão inválida'; end if;
 if not exists(select 1 from public.profiles where id=auth.uid() and active=true and role in ('admin','atendimento')) then raise exception 'Sem permissão para abrir ordem de serviço'; end if;
 if nullif(p_customer->>'id','') is not null then v_customer_id:=(p_customer->>'id')::uuid;
 else insert into public.customers(name,cpf_cnpj,phone,email,cep,address,address_number,neighborhood,city,state,notes)
 values(trim(p_customer->>'name'),nullif(trim(coalesce(p_customer->>'cpf_cnpj','')),''),trim(p_customer->>'phone'),nullif(trim(coalesce(p_customer->>'email','')),''),nullif(trim(coalesce(p_customer->>'cep','')),''),nullif(trim(coalesce(p_customer->>'address','')),''),nullif(trim(coalesce(p_customer->>'address_number','')),''),nullif(trim(coalesce(p_customer->>'neighborhood','')),''),nullif(trim(coalesce(p_customer->>'city','')),''),nullif(trim(coalesce(p_customer->>'state','')),''),nullif(trim(coalesce(p_customer->>'notes','')),'')) returning id into v_customer_id; end if;
 if nullif(p_vehicle->>'id','') is not null then v_vehicle_id:=(p_vehicle->>'id')::uuid;update public.vehicles set current_mileage=coalesce(nullif(p_vehicle->>'current_mileage','')::integer,current_mileage),updated_at=now() where id=v_vehicle_id and customer_id=v_customer_id;
 else insert into public.vehicles(customer_id,plate,vin,brand,model,version,year,model_year,color,fuel,current_mileage,notes)
 values(v_customer_id,upper(trim(p_vehicle->>'plate')),nullif(trim(coalesce(p_vehicle->>'vin','')),''),trim(p_vehicle->>'brand'),trim(p_vehicle->>'model'),nullif(trim(coalesce(p_vehicle->>'version','')),''),nullif(p_vehicle->>'year','')::integer,nullif(p_vehicle->>'model_year','')::integer,nullif(trim(coalesce(p_vehicle->>'color','')),''),nullif(trim(coalesce(p_vehicle->>'fuel','')),''),nullif(p_vehicle->>'current_mileage','')::integer,nullif(trim(coalesce(p_vehicle->>'notes','')),'')) returning id into v_vehicle_id; end if;
 insert into public.work_orders(customer_id,vehicle_id,status,mileage_in,fuel_level,promised_at,customer_report,diagnosis,internal_notes,customer_notes,discount,created_by)
 values(v_customer_id,v_vehicle_id,'recepcao',nullif(p_order->>'mileage_in','')::integer,nullif(trim(coalesce(p_order->>'fuel_level','')),''),case when nullif(p_order->>'promised_at','') is null then null else (p_order->>'promised_at')::timestamp at time zone 'America/Sao_Paulo' end,nullif(trim(coalesce(p_order->>'customer_report','')),''),nullif(trim(coalesce(p_order->>'diagnosis','')),''),nullif(trim(coalesce(p_order->>'internal_notes','')),''),nullif(trim(coalesce(p_order->>'customer_notes','')),''),coalesce(nullif(p_order->>'discount','')::numeric,0),auth.uid()) returning id into v_work_order_id;
 insert into public.vehicle_checklists(work_order_id,mileage_checked,fuel_checked,front_checked,rear_checked,left_side_checked,right_side_checked,wheels_checked,tires_checked,lights_checked,windshield_checked,interior_checked,dashboard_checked,spare_tire_checked,tools_checked,belongings_checked,damage_notes)
 values(v_work_order_id,coalesce((p_checklist->>'mileage_checked')::boolean,false),coalesce((p_checklist->>'fuel_checked')::boolean,false),coalesce((p_checklist->>'front_checked')::boolean,false),coalesce((p_checklist->>'rear_checked')::boolean,false),coalesce((p_checklist->>'left_side_checked')::boolean,false),coalesce((p_checklist->>'right_side_checked')::boolean,false),coalesce((p_checklist->>'wheels_checked')::boolean,false),coalesce((p_checklist->>'tires_checked')::boolean,false),coalesce((p_checklist->>'lights_checked')::boolean,false),coalesce((p_checklist->>'windshield_checked')::boolean,false),coalesce((p_checklist->>'interior_checked')::boolean,false),coalesce((p_checklist->>'dashboard_checked')::boolean,false),coalesce((p_checklist->>'spare_tire_checked')::boolean,false),coalesce((p_checklist->>'tools_checked')::boolean,false),coalesce((p_checklist->>'belongings_checked')::boolean,false),nullif(trim(coalesce(p_checklist->>'damage_notes','')),''));
 for v_item in select value from jsonb_array_elements(coalesce(p_parts,'[]'::jsonb)) loop
  if nullif(v_item->>'inventory_item_id','') is not null then perform public.add_inventory_part_to_work_order(v_work_order_id,(v_item->>'inventory_item_id')::uuid,coalesce(nullif(v_item->>'quantity','')::numeric,1),coalesce(nullif(v_item->>'unit_price','')::numeric,0));
  elsif length(trim(coalesce(v_item->>'description','')))>0 then insert into public.work_order_parts(work_order_id,inventory_item_id,description,quantity,unit_price,unit_cost) values(v_work_order_id,null,trim(v_item->>'description'),coalesce(nullif(v_item->>'quantity','')::numeric,1),coalesce(nullif(v_item->>'unit_price','')::numeric,0),0); end if;
 end loop;
 for v_item in select value from jsonb_array_elements(coalesce(p_services,'[]'::jsonb)) loop
  if length(trim(coalesce(v_item->>'description','')))>0 then insert into public.work_order_services(work_order_id,service_id,description,quantity,unit_price,cost_price,status) values(v_work_order_id,nullif(v_item->>'service_id','')::uuid,trim(v_item->>'description'),coalesce(nullif(v_item->>'quantity','')::numeric,1),coalesce(nullif(v_item->>'unit_price','')::numeric,0),coalesce(nullif(v_item->>'cost_price','')::numeric,0),'pendente'); end if;
 end loop;
 return query select wo.id,wo.order_number,wo.total from public.work_orders wo where wo.id=v_work_order_id;
end;$$;
grant execute on function public.create_work_order_intake_v3(jsonb,jsonb,jsonb,jsonb,jsonb,jsonb) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('vehicle-photos','vehicle-photos',false,10485760,array['image/jpeg','image/png','image/webp','image/gif'])
on conflict(id) do update set file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists "compact_vehicle_photos_select" on storage.objects;
create policy "compact_vehicle_photos_select" on storage.objects for select to authenticated using(bucket_id='vehicle-photos');
drop policy if exists "compact_vehicle_photos_insert" on storage.objects;
create policy "compact_vehicle_photos_insert" on storage.objects for insert to authenticated with check(bucket_id='vehicle-photos');
drop policy if exists "compact_vehicle_photos_update" on storage.objects;
create policy "compact_vehicle_photos_update" on storage.objects for update to authenticated using(bucket_id='vehicle-photos') with check(bucket_id='vehicle-photos');
drop policy if exists "compact_vehicle_photos_delete" on storage.objects;
create policy "compact_vehicle_photos_delete" on storage.objects for delete to authenticated using(bucket_id='vehicle-photos');
