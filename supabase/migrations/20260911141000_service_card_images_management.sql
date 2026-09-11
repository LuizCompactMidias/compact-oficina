create table if not exists public.service_card_images (
  id uuid primary key default gen_random_uuid(),
  service_slug text not null unique,
  service_title text not null,
  image_path text,
  alt_text text not null default '',
  object_position text not null default 'center',
  is_active boolean not null default true,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint service_card_images_position_check check (object_position in ('center','top','bottom','left','right'))
);

alter table public.service_card_images enable row level security;

drop policy if exists service_card_images_public_read on public.service_card_images;
create policy service_card_images_public_read on public.service_card_images for select to anon using (is_active = true and image_path is not null);

drop policy if exists service_card_images_staff_read on public.service_card_images;
create policy service_card_images_staff_read on public.service_card_images for select to authenticated using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.active = true)
);

drop policy if exists service_card_images_admin_insert on public.service_card_images;
create policy service_card_images_admin_insert on public.service_card_images for insert to authenticated with check (
  updated_by = auth.uid() and exists (select 1 from public.profiles p where p.id = auth.uid() and p.active = true and p.role = 'admin')
);

drop policy if exists service_card_images_admin_update on public.service_card_images;
create policy service_card_images_admin_update on public.service_card_images for update to authenticated using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.active = true and p.role = 'admin')
) with check (
  updated_by = auth.uid() and exists (select 1 from public.profiles p where p.id = auth.uid() and p.active = true and p.role = 'admin')
);

drop policy if exists service_card_images_admin_delete on public.service_card_images;
create policy service_card_images_admin_delete on public.service_card_images for delete to authenticated using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.active = true and p.role = 'admin')
);

grant select on public.service_card_images to anon, authenticated;
grant insert, update, delete on public.service_card_images to authenticated;

create or replace function public.set_service_card_images_updated_at()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists trg_service_card_images_updated_at on public.service_card_images;
create trigger trg_service_card_images_updated_at before update on public.service_card_images for each row execute function public.set_service_card_images_updated_at();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('service-images','service-images',true,5242880,array['image/jpeg','image/png','image/webp']::text[])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists service_images_public_read on storage.objects;
create policy service_images_public_read on storage.objects for select to public using (bucket_id = 'service-images');

drop policy if exists service_images_admin_insert on storage.objects;
create policy service_images_admin_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'service-images' and exists (select 1 from public.profiles p where p.id = auth.uid() and p.active = true and p.role = 'admin')
);

drop policy if exists service_images_admin_update on storage.objects;
create policy service_images_admin_update on storage.objects for update to authenticated using (
  bucket_id = 'service-images' and exists (select 1 from public.profiles p where p.id = auth.uid() and p.active = true and p.role = 'admin')
) with check (
  bucket_id = 'service-images' and exists (select 1 from public.profiles p where p.id = auth.uid() and p.active = true and p.role = 'admin')
);

drop policy if exists service_images_admin_delete on storage.objects;
create policy service_images_admin_delete on storage.objects for delete to authenticated using (
  bucket_id = 'service-images' and exists (select 1 from public.profiles p where p.id = auth.uid() and p.active = true and p.role = 'admin')
);