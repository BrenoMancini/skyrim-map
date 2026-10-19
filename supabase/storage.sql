-- Skyrim Interactive Map: image storage (reference screenshots attached to markers).
-- Run once in the Supabase SQL editor, after schema.sql.
--
-- Creates a public bucket "map-images" (anyone can view the files by URL) where the
-- anon key may upload images up to 5 MB. Deleting/overwriting is also allowed so a
-- marker's image can be replaced; it's the same open wiki-style policy as the table.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('map-images', 'map-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists "map-images public read"  on storage.objects;
drop policy if exists "map-images anon upload"  on storage.objects;
drop policy if exists "map-images anon update"  on storage.objects;
drop policy if exists "map-images anon delete"  on storage.objects;

create policy "map-images public read"  on storage.objects for select to anon, authenticated using (bucket_id = 'map-images');
create policy "map-images anon upload"  on storage.objects for insert to anon, authenticated with check (bucket_id = 'map-images');
create policy "map-images anon update"  on storage.objects for update to anon, authenticated using (bucket_id = 'map-images') with check (bucket_id = 'map-images');
create policy "map-images anon delete"  on storage.objects for delete to anon, authenticated using (bucket_id = 'map-images');
