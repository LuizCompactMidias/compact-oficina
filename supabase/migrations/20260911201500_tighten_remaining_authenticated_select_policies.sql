drop policy if exists vehicles_authenticated_select on public.vehicles;
create policy vehicles_business_select on public.vehicles
for select to authenticated
using (public.has_active_profile_role(array['admin','atendimento','financeiro']));

drop policy if exists suppliers_authenticated_select on public.suppliers;
create policy suppliers_finance_select on public.suppliers
for select to authenticated
using (public.has_active_profile_role(array['admin','financeiro']));

drop policy if exists communication_authenticated_select on public.customer_communication_log;
create policy communication_frontdesk_select on public.customer_communication_log
for select to authenticated
using (public.has_active_profile_role(array['admin','atendimento']));

drop policy if exists work_order_tracking_authenticated_select on public.work_order_tracking;
create policy work_order_tracking_frontdesk_select on public.work_order_tracking
for select to authenticated
using (public.has_active_profile_role(array['admin','atendimento']));

drop policy if exists profiles_authenticated_select on public.profiles;
create policy profiles_self_or_admin_select on public.profiles
for select to authenticated
using (id = auth.uid() or public.has_active_profile_role(array['admin']));
