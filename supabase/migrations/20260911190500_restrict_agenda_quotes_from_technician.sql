drop policy if exists appointments_authenticated_select on public.appointments;
create policy appointments_frontdesk_select on public.appointments
for select to authenticated
using (public.has_active_profile_role(array['admin','atendimento']));

drop policy if exists quotes_authenticated_select on public.quotes;
create policy quotes_frontdesk_select on public.quotes
for select to authenticated
using (public.has_active_profile_role(array['admin','atendimento']));

drop policy if exists quote_items_authenticated_select on public.quote_items;
create policy quote_items_frontdesk_select on public.quote_items
for select to authenticated
using (public.has_active_profile_role(array['admin','atendimento']));
