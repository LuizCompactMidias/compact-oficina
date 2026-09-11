drop policy if exists compact_vehicle_photos_select on storage.objects;
create policy compact_vehicle_photos_select on storage.objects for select to authenticated using (bucket_id='vehicle-photos' and public.has_active_profile_role(array['admin','atendimento','tecnico']));

drop policy if exists "purchase invoices authenticated read" on storage.objects;
create policy purchase_invoices_role_read on storage.objects for select to authenticated using (bucket_id='purchase-invoices' and public.has_active_profile_role(array['admin','financeiro']));
