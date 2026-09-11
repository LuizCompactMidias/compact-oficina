alter table public.customer_communication_log
  add column if not exists tracking_status text,
  add column if not exists sent_confirmed_at timestamptz;

create index if not exists customer_communication_log_work_order_confirmed_idx
  on public.customer_communication_log(work_order_id, sent_confirmed_at desc);
