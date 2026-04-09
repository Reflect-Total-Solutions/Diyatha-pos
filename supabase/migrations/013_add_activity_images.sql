-- 013_add_activity_images.sql

-- 1. Add image_url to activities table
alter table public.activities
add column if not exists image_url text;

-- 2. Create the activity-images bucket
insert into storage.buckets (id, name, public, "file_size_limit", "allowed_mime_types")
values ('activity-images', 'activity-images', true, 5242880, '{image/png,image/jpeg,image/webp,image/svg+xml,image/gif}')
on conflict (id) do update set 
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- 3. Set up RLS policies for storage.objects

-- Allow public read access to activity-images
create policy "public_read_activity_images"
  on storage.objects
  for select
  using (bucket_id = 'activity-images');

-- Allow admins to insert/upload images
create policy "admin_insert_activity_images"
  on storage.objects
  for insert
  with check (
    bucket_id = 'activity-images' 
    and (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin' OR auth.jwt() -> 'user_metadata' ->> 'role' = 'admin' OR auth.jwt() ->> 'role' = 'admin')
  );

-- Allow admins to update images
create policy "admin_update_activity_images"
  on storage.objects
  for update
  using (
    bucket_id = 'activity-images' 
    and (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin' OR auth.jwt() -> 'user_metadata' ->> 'role' = 'admin' OR auth.jwt() ->> 'role' = 'admin')
  );

-- Allow admins to delete images
create policy "admin_delete_activity_images"
  on storage.objects
  for delete
  using (
    bucket_id = 'activity-images' 
    and (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin' OR auth.jwt() -> 'user_metadata' ->> 'role' = 'admin' OR auth.jwt() ->> 'role' = 'admin')
  );
