-- =====================================================================
-- MIGRATION 021 — upload your own profile picture
-- Run in: Supabase Dashboard -> SQL Editor -> New query. Safe to re-run.
-- =====================================================================
--
-- The presets stay; this adds a bucket for people who would rather use
-- their own face. profiles.avatar already holds the choice, and it still
-- does: a value with a slash in it is a path in this bucket, anything else
-- is one of the built-in presets.
--
-- The bucket is private, like the screenshots one. Faces are not secrets,
-- but nothing else in this app is readable without a session and there is
-- no reason for the first exception to be a photograph of someone.
-- ---------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 3145728,
        array['image/png','image/jpeg','image/jpg','image/webp','image/gif'])
on conflict (id) do update
  set public = false,
      file_size_limit = 3145728,
      allowed_mime_types = array['image/png','image/jpeg','image/jpg','image/webp','image/gif'];

-- Anyone signed in can see anyone's picture: it appears on the trading
-- floor, in the journal and on the leaderboard, which is the whole point.
drop policy if exists "avatars read" on storage.objects;
create policy "avatars read" on storage.objects
  for select to authenticated
  using (bucket_id = 'avatars');

-- Writing is confined to your own folder, which is the first path segment.
drop policy if exists "avatars write own" on storage.objects;
create policy "avatars write own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars'
              and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "avatars update own" on storage.objects;
create policy "avatars update own" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars'
         and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "avatars delete own" on storage.objects;
create policy "avatars delete own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars'
         and (storage.foldername(name))[1] = (select auth.uid())::text);
