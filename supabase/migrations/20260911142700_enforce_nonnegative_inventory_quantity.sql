alter table public.inventory_items drop constraint if exists inventory_items_quantity_nonnegative;
alter table public.inventory_items add constraint inventory_items_quantity_nonnegative check (quantity >= 0);
