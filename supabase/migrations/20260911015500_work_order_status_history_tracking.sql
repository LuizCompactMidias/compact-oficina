create table if not exists public.work_order_status_history (
  id uuid primary key default gen_random_uuid(),
  work_order_id uuid not null references public.work_orders(id) on delete cascade,
  from_status text,
  to_status text not null,
  changed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists work_order_status_history_order_idx on public.work_order_status_history(work_order_id,created_at);
alter table public.work_order_status_history enable row level security;
drop policy if exists status_history_authenticated_read on public.work_order_status_history;
create policy status_history_authenticated_read on public.work_order_status_history for select to authenticated using (true);
grant select on public.work_order_status_history to authenticated;
create or replace function public.log_work_order_status_change_compact() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if tg_op='INSERT' or new.status is distinct from old.status then insert into public.work_order_status_history(work_order_id,from_status,to_status,changed_by) values(new.id,case when tg_op='INSERT' then null else old.status end,new.status,auth.uid()); end if;
  return new;
end $$;
drop trigger if exists work_orders_log_status_compact on public.work_orders;
create trigger work_orders_log_status_compact after insert or update of status on public.work_orders for each row execute function public.log_work_order_status_change_compact();
create or replace function public.get_vehicle_tracking(p_token uuid) returns jsonb language sql stable security definer set search_path=public as $$
  select jsonb_build_object('tracking',to_jsonb(t),'order',to_jsonb(o),'customer',jsonb_build_object('name',c.name),'vehicle',jsonb_build_object('plate',v.plate,'brand',v.brand,'model',v.model,'year',v.year,'color',v.color),'status_history',coalesce((select jsonb_agg(jsonb_build_object('from_status',h.from_status,'to_status',h.to_status,'created_at',h.created_at) order by h.created_at) from public.work_order_status_history h where h.work_order_id=o.id),'[]'::jsonb),'services',coalesce((select jsonb_agg(jsonb_build_object('description',s.description,'status',s.status,'completed_at',s.completed_at) order by s.created_at) from public.work_order_services s where s.work_order_id=o.id),'[]'::jsonb)) from public.work_order_tracking t join public.work_orders o on o.id=t.work_order_id join public.customers c on c.id=o.customer_id join public.vehicles v on v.id=o.vehicle_id where t.access_token=p_token;
$$;
grant execute on function public.get_vehicle_tracking(uuid) to anon,authenticated;
