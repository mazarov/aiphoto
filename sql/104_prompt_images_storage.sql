-- ============================================================
-- Prompt Landing — Storage bucket for parsed prompt images
-- Bucket: prompt-images (private)
-- ============================================================

-- 1) Ensure bucket exists (idempotent)
insert into storage.buckets (id, name, public)
values ('prompt-images', 'prompt-images', false)
on conflict (id) do update
set public = excluded.public;

-- 2) Keep bucket private by default
-- (service_role can still read/write via server-side SDK key)

-- Optional: set a conservative size limit and allowed mime types.
-- If these settings are unsupported on your Supabase version,
-- this update is still safe (no-op for missing columns is not supported),
-- so we only update known cross-version fields.
update storage.buckets
set public = false
where id = 'prompt-images';

-- 3) RLS policies for storage.objects
-- We intentionally do not grant public read access.
-- Reads/writes are expected to go through service role.

-- Safe cleanup of old policies with same names
drop policy if exists "prompt_images_no_public_read" on storage.objects;
drop policy if exists "prompt_images_auth_read" on storage.objects;
drop policy if exists "prompt_images_auth_insert" on storage.objects;
drop policy if exists "prompt_images_auth_update" on storage.objects;
drop policy if exists "prompt_images_auth_delete" on storage.objects;

-- Explicitly block anonymous read of this bucket
create policy "prompt_images_no_public_read"
on storage.objects
for select
to anon
using (bucket_id <> 'prompt-images');

-- Optional authenticated access is disabled for MVP.
-- Keep policies absent for authenticated to enforce server-side only access.
-- If needed later, add scoped policies by folder prefix.

