drop policy if exists compact_vehicle_photos_insert on storage.objects;
drop policy if exists compact_vehicle_photos_update on storage.objects;
drop policy if exists compact_vehicle_photos_delete on storage.objects;
create policy compact_vehicle_photos_insert on storage.objects for insert to authenticated with check (bucket_id='vehicle-photos' and public.has_active_profile_role(array['admin','atendimento','tecnico']));
create policy compact_vehicle_photos_update on storage.objects for update to authenticated using (bucket_id='vehicle-photos' and public.has_active_profile_role(array['admin','atendimento','tecnico'])) with check (bucket_id='vehicle-photos' and public.has_active_profile_role(array['admin','atendimento','tecnico']));
create policy compact_vehicle_photos_delete on storage.objects for delete to authenticated using (bucket_id='vehicle-photos' and public.has_active_profile_role(array['admin','atendimento','tecnico']));

drop policy if exists "purchase invoices authenticated insert" on storage.objects;
drop policy if exists "purchase invoices authenticated delete" on storage.objects;
create policy purchase_invoices_role_insert on storage.objects for insert to authenticated with check (bucket_id='purchase-invoices' and public.has_active_profile_role(array['admin','financeiro']));
create policy purchase_invoices_role_delete on storage.objects for delete to authenticated using (bucket_id='purchase-invoices' and public.has_active_profile_role(array['admin','financeiro']));
