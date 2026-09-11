create or replace function public.sync_tracking_status_from_work_order()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status is distinct from old.status then
    update public.work_order_tracking
       set status = new.status,
           updated_at = now()
     where work_order_id = new.id
       and status is distinct from new.status;
  end if;
  return new;
end;
$$;

drop trigger if exists work_orders_sync_tracking_status on public.work_orders;
create trigger work_orders_sync_tracking_status
after update of status on public.work_orders
for each row execute function public.sync_tracking_status_from_work_order();

revoke all on function public.sync_tracking_status_from_work_order() from public, anon, authenticated;
grant execute on function public.sync_tracking_status_from_work_order() to service_role;
