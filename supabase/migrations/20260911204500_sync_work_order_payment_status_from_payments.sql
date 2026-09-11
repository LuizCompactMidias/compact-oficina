create or replace function public.sync_work_order_payment_status_from_payments()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order_id uuid;
  v_total numeric;
  v_paid numeric;
  v_status text;
begin
  v_order_id := coalesce(new.work_order_id, old.work_order_id);

  if v_order_id is not null then
    select wo.total into v_total from public.work_orders wo where wo.id = v_order_id;
    if found then
      select coalesce(sum(p.amount),0)
        into v_paid
      from public.payments p
      where p.work_order_id = v_order_id
        and p.status in ('confirmado','pago');

      v_status := case
        when coalesce(v_total,0) <= 0 then 'pago'
        when v_paid >= v_total - 0.009 then 'pago'
        when v_paid > 0 then 'parcial'
        else 'pendente'
      end;

      update public.work_orders
         set payment_status = v_status,
             updated_at = now()
       where id = v_order_id
         and payment_status is distinct from v_status;
    end if;
  end if;

  if tg_op = 'UPDATE' and old.work_order_id is distinct from new.work_order_id and old.work_order_id is not null then
    select wo.total into v_total from public.work_orders wo where wo.id = old.work_order_id;
    if found then
      select coalesce(sum(p.amount),0)
        into v_paid
      from public.payments p
      where p.work_order_id = old.work_order_id
        and p.status in ('confirmado','pago');

      v_status := case
        when coalesce(v_total,0) <= 0 then 'pago'
        when v_paid >= v_total - 0.009 then 'pago'
        when v_paid > 0 then 'parcial'
        else 'pendente'
      end;

      update public.work_orders
         set payment_status = v_status,
             updated_at = now()
       where id = old.work_order_id
         and payment_status is distinct from v_status;
    end if;
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists payments_sync_work_order_status on public.payments;
create trigger payments_sync_work_order_status
after insert or update of amount,status,work_order_id or delete on public.payments
for each row execute function public.sync_work_order_payment_status_from_payments();

revoke all on function public.sync_work_order_payment_status_from_payments() from public, anon, authenticated;
grant execute on function public.sync_work_order_payment_status_from_payments() to service_role;
