create or replace function public.has_active_profile_role(p_roles text[])
returns boolean
language sql
stable
security definer
set search_path to 'public','pg_temp'
as $$
  select exists(
    select 1 from public.profiles p
    where p.id=auth.uid() and p.active=true and p.role=any(p_roles)
  );
$$;
revoke all on function public.has_active_profile_role(text[]) from public,anon;
grant execute on function public.has_active_profile_role(text[]) to authenticated,service_role;

drop policy if exists authenticated_all on public.profiles;
create policy profiles_authenticated_select on public.profiles for select to authenticated using (true);
create policy profiles_admin_insert on public.profiles for insert to authenticated with check (public.has_active_profile_role(array['admin']));
create policy profiles_admin_update on public.profiles for update to authenticated using (public.has_active_profile_role(array['admin'])) with check (public.has_active_profile_role(array['admin']));
create policy profiles_admin_delete on public.profiles for delete to authenticated using (public.has_active_profile_role(array['admin']));

drop policy if exists authenticated_all on public.expenses;
create policy expenses_authenticated_select on public.expenses for select to authenticated using (true);
create policy expenses_finance_insert on public.expenses for insert to authenticated with check (public.has_active_profile_role(array['admin','financeiro']));
create policy expenses_finance_update on public.expenses for update to authenticated using (public.has_active_profile_role(array['admin','financeiro'])) with check (public.has_active_profile_role(array['admin','financeiro']));
create policy expenses_finance_delete on public.expenses for delete to authenticated using (public.has_active_profile_role(array['admin','financeiro']));

drop policy if exists authenticated_all on public.payments;
create policy payments_authenticated_select on public.payments for select to authenticated using (true);
create policy payments_finance_insert on public.payments for insert to authenticated with check (public.has_active_profile_role(array['admin','financeiro']));
create policy payments_finance_update on public.payments for update to authenticated using (public.has_active_profile_role(array['admin','financeiro'])) with check (public.has_active_profile_role(array['admin','financeiro']));
create policy payments_finance_delete on public.payments for delete to authenticated using (public.has_active_profile_role(array['admin','financeiro']));

drop policy if exists authenticated_all_purchase_invoices on public.purchase_invoices;
create policy purchase_invoices_authenticated_select on public.purchase_invoices for select to authenticated using (true);
create policy purchase_invoices_finance_insert on public.purchase_invoices for insert to authenticated with check (public.has_active_profile_role(array['admin','financeiro']));
create policy purchase_invoices_finance_update on public.purchase_invoices for update to authenticated using (public.has_active_profile_role(array['admin','financeiro'])) with check (public.has_active_profile_role(array['admin','financeiro']));
create policy purchase_invoices_finance_delete on public.purchase_invoices for delete to authenticated using (public.has_active_profile_role(array['admin','financeiro']));

drop policy if exists authenticated_all_purchase_invoice_items on public.purchase_invoice_items;
create policy purchase_invoice_items_authenticated_select on public.purchase_invoice_items for select to authenticated using (true);
create policy purchase_invoice_items_finance_insert on public.purchase_invoice_items for insert to authenticated with check (public.has_active_profile_role(array['admin','financeiro']));
create policy purchase_invoice_items_finance_update on public.purchase_invoice_items for update to authenticated using (public.has_active_profile_role(array['admin','financeiro'])) with check (public.has_active_profile_role(array['admin','financeiro']));
create policy purchase_invoice_items_finance_delete on public.purchase_invoice_items for delete to authenticated using (public.has_active_profile_role(array['admin','financeiro']));

drop policy if exists authenticated_all_commissions on public.service_commission_entries;
create policy commissions_authenticated_select on public.service_commission_entries for select to authenticated using (true);
create policy commissions_finance_insert on public.service_commission_entries for insert to authenticated with check (public.has_active_profile_role(array['admin','financeiro']));
create policy commissions_finance_update on public.service_commission_entries for update to authenticated using (public.has_active_profile_role(array['admin','financeiro'])) with check (public.has_active_profile_role(array['admin','financeiro']));
create policy commissions_finance_delete on public.service_commission_entries for delete to authenticated using (public.has_active_profile_role(array['admin','financeiro']));

drop policy if exists authenticated_all_collaborators on public.collaborators;
create policy collaborators_authenticated_select on public.collaborators for select to authenticated using (true);
create policy collaborators_admin_insert on public.collaborators for insert to authenticated with check (public.has_active_profile_role(array['admin']));
create policy collaborators_admin_update on public.collaborators for update to authenticated using (public.has_active_profile_role(array['admin'])) with check (public.has_active_profile_role(array['admin']));
create policy collaborators_admin_delete on public.collaborators for delete to authenticated using (public.has_active_profile_role(array['admin']));

drop policy if exists authenticated_all on public.inventory_items;
create policy inventory_items_authenticated_select on public.inventory_items for select to authenticated using (true);
create policy inventory_items_ops_insert on public.inventory_items for insert to authenticated with check (public.has_active_profile_role(array['admin','atendimento','tecnico']));
create policy inventory_items_ops_update on public.inventory_items for update to authenticated using (public.has_active_profile_role(array['admin','atendimento','tecnico'])) with check (public.has_active_profile_role(array['admin','atendimento','tecnico']));
create policy inventory_items_admin_delete on public.inventory_items for delete to authenticated using (public.has_active_profile_role(array['admin']));

drop policy if exists inventory_movements_authenticated_all on public.inventory_movements;
create policy inventory_movements_authenticated_select on public.inventory_movements for select to authenticated using (true);
create policy inventory_movements_ops_insert on public.inventory_movements for insert to authenticated with check (public.has_active_profile_role(array['admin','atendimento','tecnico']));
create policy inventory_movements_ops_update on public.inventory_movements for update to authenticated using (public.has_active_profile_role(array['admin','atendimento','tecnico'])) with check (public.has_active_profile_role(array['admin','atendimento','tecnico']));
create policy inventory_movements_admin_delete on public.inventory_movements for delete to authenticated using (public.has_active_profile_role(array['admin']));

drop policy if exists authenticated_all on public.work_orders;
create policy work_orders_authenticated_select on public.work_orders for select to authenticated using (true);
create policy work_orders_ops_insert on public.work_orders for insert to authenticated with check (public.has_active_profile_role(array['admin','atendimento','tecnico']));
create policy work_orders_ops_update on public.work_orders for update to authenticated using (public.has_active_profile_role(array['admin','atendimento','tecnico'])) with check (public.has_active_profile_role(array['admin','atendimento','tecnico']));
create policy work_orders_admin_delete on public.work_orders for delete to authenticated using (public.has_active_profile_role(array['admin']));
