create table if not exists public.customer_communication_log (
  id uuid primary key default gen_random_uuid(),
  work_order_id uuid not null references public.work_orders(id) on delete cascade,
  channel text not null default 'whatsapp' check (channel in ('whatsapp','telefone','email','interno')),
  direction text not null default 'outbound' check (direction in ('outbound','inbound','internal')),
  message text not null,
  sent_to text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists customer_communication_log_order_idx on public.customer_communication_log(work_order_id, created_at desc);
alter table public.customer_communication_log enable row level security;
drop policy if exists communication_authenticated_all on public.customer_communication_log;
create policy communication_authenticated_all on public.customer_communication_log for all to authenticated using (true) with check (true);
grant select,insert,update,delete on public.customer_communication_log to authenticated;
