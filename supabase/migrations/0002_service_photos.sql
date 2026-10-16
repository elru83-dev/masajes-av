-- =====================================================================
-- Masajes AV · fotos de servicios
-- Se puede ejecutar sobre una base que ya tiene 0001 (es acumulativo).
-- =====================================================================

alter table public.services add column if not exists image_url  text;
alter table public.services add column if not exists image_path text;

-- Bucket público: cualquiera puede ver las fotos, solo la administradora sube o borra.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('services', 'services', true, 2097152, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update
  set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists services_photos_admin_select on storage.objects;
drop policy if exists services_photos_admin_insert on storage.objects;
drop policy if exists services_photos_admin_update on storage.objects;
drop policy if exists services_photos_admin_delete on storage.objects;

create policy services_photos_admin_select on storage.objects
  for select to authenticated using (bucket_id = 'services' and public.is_admin());
create policy services_photos_admin_insert on storage.objects
  for insert to authenticated with check (bucket_id = 'services' and public.is_admin());
create policy services_photos_admin_update on storage.objects
  for update to authenticated using (bucket_id = 'services' and public.is_admin());
create policy services_photos_admin_delete on storage.objects
  for delete to authenticated using (bucket_id = 'services' and public.is_admin());
