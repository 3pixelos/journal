-- =====================================================================
-- MIGRATION 006 — pick-your-own avatar
-- Run in: Supabase Dashboard -> SQL Editor -> New query. Safe to re-run.
-- =====================================================================
--
-- Avatars are generated in the app from a fixed set of presets, so this only
-- stores which preset was chosen. No image upload, no storage, nothing to
-- moderate — and it renders instantly everywhere the person appears.
-- ---------------------------------------------------------------------

alter table public.profiles add column if not exists avatar text not null default 'mono';

-- Give everyone who predates this a different look instead of all-identical.
update public.profiles p
set avatar = presets.name
from (
  select id, (array['ember','aurora','lime','violet','sunset','ocean',
                    'rose','mint','gold','neon','magma','ice'])[
                 1 + (abs(hashtext(id::text)) % 12)] as name
  from public.profiles
) presets
where p.id = presets.id and p.avatar = 'mono';
