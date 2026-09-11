revoke execute on function public.create_work_order_intake_v3(jsonb,jsonb,jsonb,jsonb,jsonb,jsonb) from public, anon;
revoke execute on function public.create_quote_v2(jsonb,jsonb,jsonb,jsonb,jsonb) from public, anon;
revoke execute on function public.convert_quote_to_work_order_v2(uuid) from public, anon;
revoke execute on function public.recalculate_work_order(uuid) from public, anon, authenticated;
revoke execute on function public.work_order_item_changed() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

grant execute on function public.create_work_order_intake_v3(jsonb,jsonb,jsonb,jsonb,jsonb,jsonb) to authenticated, service_role;
grant execute on function public.create_quote_v2(jsonb,jsonb,jsonb,jsonb,jsonb) to authenticated, service_role;
grant execute on function public.convert_quote_to_work_order_v2(uuid) to authenticated, service_role;
grant execute on function public.recalculate_work_order(uuid) to service_role;
grant execute on function public.work_order_item_changed() to service_role;
grant execute on function public.handle_new_user() to service_role;
