-- Configurações.
drop policy if exists authenticated_all on public.app_settings;
create policy app_settings_authenticated_select on public.app_settings for select to authenticated using (true);
create policy app_settings_admin_insert on public.app_settings for insert to authenticated with check (public.has_active_profile_role(array['admin']));
create policy app_settings_admin_update on public.app_settings for update to authenticated using (public.has_active_profile_role(array['admin'])) with check (public.has_active_profile_role(array['admin']));
create policy app_settings_admin_delete on public.app_settings for delete to authenticated using (public.has_active_profile_role(array['admin']));

-- Agenda.
drop policy if exists authenticated_all on public.appointments;
create policy appointments_authenticated_select on public.appointments for select to authenticated using (true);
create policy appointments_frontdesk_insert on public.appointments for insert to authenticated with check (public.has_active_profile_role(array['admin','atendimento']));
create policy appointments_frontdesk_update on public.appointments for update to authenticated using (public.has_active_profile_role(array['admin','atendimento'])) with check (public.has_active_profile_role(array['admin','atendimento']));
create policy appointments_frontdesk_delete on public.appointments for delete to authenticated using (public.has_active_profile_role(array['admin','atendimento']));

-- Comunicação com cliente.
drop policy if exists communication_authenticated_all on public.customer_communication_log;
create policy communication_authenticated_select on public.customer_communication_log for select to authenticated using (true);
create policy communication_ops_insert on public.customer_communication_log for insert to authenticated with check (public.has_active_profile_role(array['admin','atendimento','tecnico']));
create policy communication_ops_update on public.customer_communication_log for update to authenticated using (public.has_active_profile_role(array['admin','atendimento','tecnico'])) with check (public.has_active_profile_role(array['admin','atendimento','tecnico']));
create policy communication_admin_delete on public.customer_communication_log for delete to authenticated using (public.has_active_profile_role(array['admin']));

-- Clientes e veículos.
drop policy if exists authenticated_all on public.customers;
create policy customers_authenticated_select on public.customers for select to authenticated using (true);
create policy customers_ops_insert on public.customers for insert to authenticated with check (public.has_active_profile_role(array['admin','atendimento','tecnico']));
create policy customers_ops_update on public.customers for update to authenticated using (public.has_active_profile_role(array['admin','atendimento','tecnico'])) with check (public.has_active_profile_role(array['admin','atendimento','tecnico']));
create policy customers_admin_delete on public.customers for delete to authenticated using (public.has_active_profile_role(array['admin']));

drop policy if exists authenticated_all on public.vehicles;
create policy vehicles_authenticated_select on public.vehicles for select to authenticated using (true);
create policy vehicles_ops_insert on public.vehicles for insert to authenticated with check (public.has_active_profile_role(array['admin','atendimento','tecnico']));
create policy vehicles_ops_update on public.vehicles for update to authenticated using (public.has_active_profile_role(array['admin','atendimento','tecnico'])) with check (public.has_active_profile_role(array['admin','atendimento','tecnico']));
create policy vehicles_admin_delete on public.vehicles for delete to authenticated using (public.has_active_profile_role(array['admin']));

-- Orçamentos.
drop policy if exists authenticated_all on public.quotes;
create policy quotes_authenticated_select on public.quotes for select to authenticated using (true);
create policy quotes_frontdesk_insert on public.quotes for insert to authenticated with check (public.has_active_profile_role(array['admin','atendimento']));
create policy quotes_frontdesk_update on public.quotes for update to authenticated using (public.has_active_profile_role(array['admin','atendimento'])) with check (public.has_active_profile_role(array['admin','atendimento']));
create policy quotes_admin_delete on public.quotes for delete to authenticated using (public.has_active_profile_role(array['admin']));

drop policy if exists authenticated_all on public.quote_items;
create policy quote_items_authenticated_select on public.quote_items for select to authenticated using (true);
create policy quote_items_frontdesk_insert on public.quote_items for insert to authenticated with check (public.has_active_profile_role(array['admin','atendimento']));
create policy quote_items_frontdesk_update on public.quote_items for update to authenticated using (public.has_active_profile_role(array['admin','atendimento'])) with check (public.has_active_profile_role(array['admin','atendimento']));
create policy quote_items_admin_delete on public.quote_items for delete to authenticated using (public.has_active_profile_role(array['admin']));

-- Catálogo de serviços: leitura para equipe; manutenção por admin.
drop policy if exists authenticated_all on public.service_catalog;
create policy service_catalog_authenticated_select on public.service_catalog for select to authenticated using (true);
create policy service_catalog_admin_insert on public.service_catalog for insert to authenticated with check (public.has_active_profile_role(array['admin']));
create policy service_catalog_admin_update on public.service_catalog for update to authenticated using (public.has_active_profile_role(array['admin'])) with check (public.has_active_profile_role(array['admin']));
create policy service_catalog_admin_delete on public.service_catalog for delete to authenticated using (public.has_active_profile_role(array['admin']));

-- Fornecedores.
drop policy if exists authenticated_all on public.suppliers;
create policy suppliers_authenticated_select on public.suppliers for select to authenticated using (true);
create policy suppliers_finance_insert on public.suppliers for insert to authenticated with check (public.has_active_profile_role(array['admin','financeiro']));
create policy suppliers_finance_update on public.suppliers for update to authenticated using (public.has_active_profile_role(array['admin','financeiro'])) with check (public.has_active_profile_role(array['admin','financeiro']));
create policy suppliers_admin_delete on public.suppliers for delete to authenticated using (public.has_active_profile_role(array['admin']));

-- Checklist, fotos, peças, serviços e tracking da OS.
drop policy if exists vehicle_checklists_authenticated_all on public.vehicle_checklists;
create policy vehicle_checklists_authenticated_select on public.vehicle_checklists for select to authenticated using (true);
create policy vehicle_checklists_ops_insert on public.vehicle_checklists for insert to authenticated with check (public.has_active_profile_role(array['admin','atendimento','tecnico']));
create policy vehicle_checklists_ops_update on public.vehicle_checklists for update to authenticated using (public.has_active_profile_role(array['admin','atendimento','tecnico'])) with check (public.has_active_profile_role(array['admin','atendimento','tecnico']));
create policy vehicle_checklists_admin_delete on public.vehicle_checklists for delete to authenticated using (public.has_active_profile_role(array['admin']));

drop policy if exists authenticated_all on public.vehicle_photos;
create policy vehicle_photos_authenticated_select on public.vehicle_photos for select to authenticated using (true);
create policy vehicle_photos_ops_insert on public.vehicle_photos for insert to authenticated with check (public.has_active_profile_role(array['admin','atendimento','tecnico']));
create policy vehicle_photos_ops_update on public.vehicle_photos for update to authenticated using (public.has_active_profile_role(array['admin','atendimento','tecnico'])) with check (public.has_active_profile_role(array['admin','atendimento','tecnico']));
create policy vehicle_photos_ops_delete on public.vehicle_photos for delete to authenticated using (public.has_active_profile_role(array['admin','atendimento','tecnico']));

drop policy if exists authenticated_all on public.work_order_parts;
create policy work_order_parts_authenticated_select on public.work_order_parts for select to authenticated using (true);
create policy work_order_parts_ops_insert on public.work_order_parts for insert to authenticated with check (public.has_active_profile_role(array['admin','atendimento','tecnico']));
create policy work_order_parts_ops_update on public.work_order_parts for update to authenticated using (public.has_active_profile_role(array['admin','atendimento','tecnico'])) with check (public.has_active_profile_role(array['admin','atendimento','tecnico']));
create policy work_order_parts_ops_delete on public.work_order_parts for delete to authenticated using (public.has_active_profile_role(array['admin','atendimento','tecnico']));

drop policy if exists authenticated_all on public.work_order_services;
create policy work_order_services_authenticated_select on public.work_order_services for select to authenticated using (true);
create policy work_order_services_ops_insert on public.work_order_services for insert to authenticated with check (public.has_active_profile_role(array['admin','atendimento','tecnico']));
create policy work_order_services_ops_update on public.work_order_services for update to authenticated using (public.has_active_profile_role(array['admin','atendimento','tecnico'])) with check (public.has_active_profile_role(array['admin','atendimento','tecnico']));
create policy work_order_services_ops_delete on public.work_order_services for delete to authenticated using (public.has_active_profile_role(array['admin','atendimento','tecnico']));

drop policy if exists authenticated_all on public.work_order_tracking;
create policy work_order_tracking_authenticated_select on public.work_order_tracking for select to authenticated using (true);
create policy work_order_tracking_ops_insert on public.work_order_tracking for insert to authenticated with check (public.has_active_profile_role(array['admin','atendimento','tecnico']));
create policy work_order_tracking_ops_update on public.work_order_tracking for update to authenticated using (public.has_active_profile_role(array['admin','atendimento','tecnico'])) with check (public.has_active_profile_role(array['admin','atendimento','tecnico']));
create policy work_order_tracking_admin_delete on public.work_order_tracking for delete to authenticated using (public.has_active_profile_role(array['admin']));
