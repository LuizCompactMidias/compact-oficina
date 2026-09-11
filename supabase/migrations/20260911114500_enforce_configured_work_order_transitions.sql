create or replace function public.enforce_compact_work_order_transition()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_role text;
  v_require_payment boolean := true;
  v_allow_partial boolean := true;
begin
  if new.status is not distinct from old.status then return new; end if;
  select role into v_role from public.profiles where id=auth.uid() and active=true;
  select coalesce(require_payment_before_delivery,true),coalesce(allow_partial_approval,true)
    into v_require_payment,v_allow_partial from public.app_settings where id=1;
  if new.status='cancelada' then
    if v_role is distinct from 'admin' then raise exception 'Somente administradores podem cancelar uma OS'; end if;
    if old.status in ('entregue','cancelada') then raise exception 'Uma OS entregue ou cancelada não pode ser cancelada novamente'; end if;
    return new;
  end if;
  if old.status='cancelada' then raise exception 'Uma OS cancelada não pode retornar ao fluxo operacional'; end if;
  if old.status='recepcao' and new.status<>'diagnostico' then raise exception 'A próxima etapa após Recepção é Diagnóstico';
  elsif old.status='diagnostico' and new.status<>'aguardando_aprovacao' then raise exception 'A próxima etapa após Diagnóstico é Aguardando aprovação';
  elsif old.status='aguardando_aprovacao' and new.status<>'em_execucao' then raise exception 'Após a aprovação, a próxima etapa é Em execução';
  elsif old.status='em_execucao' and new.status<>'finalizacao' then raise exception 'A próxima etapa após Em execução é Finalização';
  elsif old.status='finalizacao' and new.status<>'pronto_entrega' then raise exception 'A próxima etapa após Finalização é Pronto para entrega';
  elsif old.status='pronto_entrega' and new.status<>'entregue' then raise exception 'A próxima etapa após Pronto para entrega é Entregue';
  elsif old.status='entregue' then raise exception 'Uma OS entregue não pode mudar de etapa'; end if;
  if new.status='em_execucao' then
    if v_allow_partial and new.approval_status not in ('aprovado','parcial') then raise exception 'O orçamento precisa estar aprovado antes de iniciar a execução'; end if;
    if not v_allow_partial and new.approval_status<>'aprovado' then raise exception 'A aprovação integral é obrigatória antes da execução'; end if;
  end if;
  if new.status='entregue' and v_require_payment and new.payment_status<>'pago' then raise exception 'O pagamento integral precisa ser registrado antes da entrega'; end if;
  return new;
end;
$$;
drop trigger if exists work_orders_enforce_transition on public.work_orders;
create trigger work_orders_enforce_transition before update of status on public.work_orders for each row execute function public.enforce_compact_work_order_transition();
revoke all on function public.enforce_compact_work_order_transition() from public,anon,authenticated;
