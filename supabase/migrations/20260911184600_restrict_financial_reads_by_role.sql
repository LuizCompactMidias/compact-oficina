drop policy if exists expenses_authenticated_select on public.expenses;
create policy expenses_finance_select on public.expenses for select to authenticated using (public.has_active_profile_role(array['admin','financeiro']));

drop policy if exists payments_authenticated_select on public.payments;
create policy payments_finance_select on public.payments for select to authenticated using (public.has_active_profile_role(array['admin','financeiro']));

drop policy if exists purchase_invoices_authenticated_select on public.purchase_invoices;
create policy purchase_invoices_finance_select on public.purchase_invoices for select to authenticated using (public.has_active_profile_role(array['admin','financeiro']));

drop policy if exists purchase_invoice_items_authenticated_select on public.purchase_invoice_items;
create policy purchase_invoice_items_finance_select on public.purchase_invoice_items for select to authenticated using (public.has_active_profile_role(array['admin','financeiro']));

drop policy if exists commissions_authenticated_select on public.service_commission_entries;
create policy commissions_finance_select on public.service_commission_entries for select to authenticated using (public.has_active_profile_role(array['admin','financeiro']));
