-- COMPACT Centro Automotivo — schema base replicável
-- Execute em um projeto Supabase novo para cada oficina.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null default 'admin' check (role in ('admin','atendimento','tecnico','financeiro')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(), name text not null, phone text not null,
  email text, cpf_cnpj text, cep text, address text, address_number text, neighborhood text, city text, state text, notes text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(), customer_id uuid not null references public.customers(id) on delete cascade,
  plate text not null, brand text not null, model text not null, year int, model_year int, version text, color text, fuel text, vin text,
  current_mileage int, notes text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(plate)
);

create table if not exists public.service_catalog (
  id uuid primary key default gen_random_uuid(), name text not null, code text, category text, description text,
  base_price numeric(12,2) not null default 0, estimated_minutes int, active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(), name text not null, cpf_cnpj text, phone text, email text, contact_name text, notes text,
  active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(), supplier_id uuid references public.suppliers(id) on delete set null,
  name text not null, sku text, barcode text, category text, unit text not null default 'un', quantity numeric(12,3) not null default 0,
  min_quantity numeric(12,3) not null default 0, cost_price numeric(12,2) not null default 0, sale_price numeric(12,2) not null default 0,
  location text, ncm text, active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create sequence if not exists public.work_order_number_seq start 1;
create table if not exists public.work_orders (
  id uuid primary key default gen_random_uuid(), order_number bigint not null default nextval('public.work_order_number_seq'),
  customer_id uuid not null references public.customers(id), vehicle_id uuid not null references public.vehicles(id),
  status text not null default 'recepcao' check (status in ('recepcao','diagnostico','aguardando_aprovacao','em_execucao','finalizacao','pronto_entrega','entregue','cancelada')),
  approval_status text not null default 'pendente', payment_status text not null default 'pendente',
  customer_report text, diagnosis text, customer_notes text, internal_notes text, mileage_in int, fuel_level text,
  subtotal_services numeric(12,2) not null default 0, subtotal_parts numeric(12,2) not null default 0, discount numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0, entry_at timestamptz not null default now(), promised_at timestamptz, approved_at timestamptz,
  delivered_at timestamptz, warranty_until date, assigned_technician uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(order_number)
);

create table if not exists public.work_order_services (
  id uuid primary key default gen_random_uuid(), work_order_id uuid not null references public.work_orders(id) on delete cascade,
  service_id uuid references public.service_catalog(id) on delete set null, description text not null, quantity numeric(12,3) not null default 1,
  unit_price numeric(12,2) not null default 0, cost_price numeric(12,2) not null default 0, status text not null default 'pendente',
  technician_id uuid references public.profiles(id) on delete set null, notes text, completed_at timestamptz, created_at timestamptz not null default now()
);

create table if not exists public.work_order_parts (
  id uuid primary key default gen_random_uuid(), work_order_id uuid not null references public.work_orders(id) on delete cascade,
  inventory_item_id uuid references public.inventory_items(id) on delete set null, description text not null, quantity numeric(12,3) not null default 1,
  unit_cost numeric(12,2) not null default 0, unit_price numeric(12,2) not null default 0, created_at timestamptz not null default now()
);

create sequence if not exists public.quote_number_seq start 1;
create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(), quote_number bigint not null default nextval('public.quote_number_seq'),
  customer_id uuid references public.customers(id), vehicle_id uuid references public.vehicles(id), status text not null default 'rascunho',
  subtotal_labor numeric(12,2) not null default 0, subtotal_parts numeric(12,2) not null default 0, discount numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0, notes text, valid_until date, approved_at timestamptz,
  converted_work_order_id uuid references public.work_orders(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(quote_number)
);

create table if not exists public.quote_items (
  id uuid primary key default gen_random_uuid(), quote_id uuid not null references public.quotes(id) on delete cascade,
  item_type text not null check (item_type in ('service','part')), description text not null, quantity numeric(12,3) not null default 1,
  unit_price numeric(12,2) not null default 0, inventory_item_id uuid references public.inventory_items(id) on delete set null, created_at timestamptz not null default now()
);

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(), customer_id uuid references public.customers(id) on delete cascade,
  vehicle_id uuid references public.vehicles(id) on delete set null, service_id uuid references public.service_catalog(id) on delete set null,
  work_order_id uuid references public.work_orders(id) on delete set null, scheduled_at timestamptz not null, expected_minutes int,
  status text not null default 'agendado', notes text, created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(), work_order_id uuid references public.work_orders(id) on delete cascade,
  amount numeric(12,2) not null, method text not null, installments int not null default 1, status text not null default 'pendente',
  reference text, notes text, paid_at timestamptz, created_by uuid references public.profiles(id) on delete set null, created_at timestamptz not null default now()
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(), supplier_id uuid references public.suppliers(id) on delete set null,
  description text not null, category text, amount numeric(12,2) not null, status text not null default 'pendente', payment_method text,
  due_date date, paid_at timestamptz, document_number text, notes text, created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.work_order_tracking (
  id uuid primary key default gen_random_uuid(), work_order_id uuid not null unique references public.work_orders(id) on delete cascade,
  access_token uuid not null default gen_random_uuid() unique, status text not null default 'recepcao', customer_note text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.vehicle_photos (
  id uuid primary key default gen_random_uuid(), work_order_id uuid not null references public.work_orders(id) on delete cascade,
  vehicle_id uuid not null references public.vehicles(id) on delete cascade, photo_type text not null default 'entrada', storage_path text not null,
  caption text, uploaded_by uuid references public.profiles(id) on delete set null, created_at timestamptz not null default now()
);

create table if not exists public.app_settings (
  id int primary key default 1 check (id=1), trade_name text not null default 'COMPACT Centro Automotivo', company_name text not null default '',
  cnpj text not null default '', phone text not null default '', whatsapp text not null default '', email text not null default '', website text not null default '',
  slogan text not null default 'Tecnologia, confiança e gestão para sua oficina.', street text not null default '', address_number text not null default '',
  neighborhood text not null default '', city text not null default '', state text not null default '', zip_code text not null default '', complement text not null default '',
  business_hours text not null default '', quote_validity_days int not null default 7, default_warranty_days int not null default 90,
  tracking_enabled boolean not null default true, payment_methods text[] not null default array['PIX','Dinheiro','Cartão'],
  updated_at timestamptz not null default now(), updated_by uuid references public.profiles(id) on delete set null
);
insert into public.app_settings(id) values (1) on conflict (id) do nothing;

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$
begin insert into public.profiles(id,full_name,role,active) values(new.id,coalesce(new.raw_user_meta_data->>'full_name',split_part(new.email,'@',1)),'admin',true) on conflict(id) do nothing; return new; end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

create or replace function public.recalculate_work_order(p_id uuid) returns void language plpgsql security definer set search_path=public as $$
declare s numeric; p numeric; d numeric; begin
  select coalesce(sum(quantity*unit_price),0) into s from public.work_order_services where work_order_id=p_id;
  select coalesce(sum(quantity*unit_price),0) into p from public.work_order_parts where work_order_id=p_id;
  select discount into d from public.work_orders where id=p_id;
  update public.work_orders set subtotal_services=s,subtotal_parts=p,total=greatest(0,s+p-coalesce(d,0)),updated_at=now() where id=p_id;
end $$;

create or replace function public.work_order_item_changed() returns trigger language plpgsql security definer set search_path=public as $$
begin perform public.recalculate_work_order(coalesce(new.work_order_id,old.work_order_id)); return coalesce(new,old); end $$;
drop trigger if exists trg_work_order_services_total on public.work_order_services;
create trigger trg_work_order_services_total after insert or update or delete on public.work_order_services for each row execute procedure public.work_order_item_changed();
drop trigger if exists trg_work_order_parts_total on public.work_order_parts;
create trigger trg_work_order_parts_total after insert or update or delete on public.work_order_parts for each row execute procedure public.work_order_item_changed();

create or replace function public.create_tracking_for_order() returns trigger language plpgsql security definer set search_path=public as $$
begin insert into public.work_order_tracking(work_order_id,status) values(new.id,new.status) on conflict(work_order_id) do nothing; return new; end $$;
drop trigger if exists trg_create_tracking on public.work_orders;
create trigger trg_create_tracking after insert on public.work_orders for each row execute procedure public.create_tracking_for_order();

-- RLS: template inicial. Cada oficina pode endurecer regras por perfil depois da implantação.
do $$ declare t text; begin
  foreach t in array array['profiles','customers','vehicles','service_catalog','suppliers','inventory_items','work_orders','work_order_services','work_order_parts','quotes','quote_items','appointments','payments','expenses','work_order_tracking','vehicle_photos','app_settings'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('drop policy if exists authenticated_all on public.%I',t);
    execute format('create policy authenticated_all on public.%I for all to authenticated using (true) with check (true)',t);
  end loop;
end $$;

-- Consulta pública restrita ao token de acompanhamento é feita por função RPC.
create or replace function public.get_vehicle_tracking(p_token uuid) returns jsonb language sql security definer set search_path=public stable as $$
  select jsonb_build_object(
    'tracking', to_jsonb(t),
    'order', to_jsonb(o),
    'customer', jsonb_build_object('name',c.name),
    'vehicle', jsonb_build_object('plate',v.plate,'brand',v.brand,'model',v.model,'year',v.year)
  )
  from public.work_order_tracking t join public.work_orders o on o.id=t.work_order_id join public.customers c on c.id=o.customer_id join public.vehicles v on v.id=o.vehicle_id
  where t.access_token=p_token;
$$;
grant execute on function public.get_vehicle_tracking(uuid) to anon, authenticated;

-- Serviços demo editáveis pelo painel.
insert into public.service_catalog(name,category,description,estimated_minutes) values
('Troca de óleo e filtros','Manutenção','Troca preventiva de óleo, filtro de óleo e inspeção básica.',45),
('Sistema de freios','Segurança','Inspeção e manutenção de pastilhas, discos, fluido e componentes.',90),
('Alinhamento e balanceamento','Pneus e suspensão','Correção de geometria e balanceamento das rodas.',60),
('Troca de pneus','Pneus e suspensão','Substituição, montagem, calibragem e inspeção dos pneus.',45),
('Check-up geral','Revisão','Inspeção preventiva dos principais sistemas do veículo.',120),
('Mecânica em geral','Mecânica','Diagnóstico e reparos mecânicos diversos.',120),
('Elétrica automotiva','Elétrica','Diagnóstico e reparos do sistema elétrico.',90),
('Embreagem','Transmissão','Diagnóstico e manutenção do conjunto de embreagem.',180)
on conflict do nothing;
