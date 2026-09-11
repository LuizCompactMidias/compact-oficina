create or replace function public.apply_default_warranty_on_delivery()
returns trigger
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $$
declare
  v_days integer := 0;
begin
  if new.status = 'entregue' and old.status is distinct from 'entregue' then
    if new.delivered_at is null then
      new.delivered_at := now();
    end if;

    if new.warranty_until is null then
      select coalesce(default_warranty_days,0)
        into v_days
      from public.app_settings
      where id=1;

      if v_days > 0 then
        new.warranty_until := (new.delivered_at at time zone 'America/Sao_Paulo')::date + v_days;
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists work_orders_apply_default_warranty on public.work_orders;
create trigger work_orders_apply_default_warranty
before update of status on public.work_orders
for each row execute function public.apply_default_warranty_on_delivery();

revoke all on function public.apply_default_warranty_on_delivery() from public, anon, authenticated;
