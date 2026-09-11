revoke all on function public.create_tracking_for_order() from public,anon,authenticated;
revoke all on function public.log_work_order_status_change_compact() from public,anon,authenticated;
grant execute on function public.create_tracking_for_order() to service_role;
grant execute on function public.log_work_order_status_change_compact() to service_role;
