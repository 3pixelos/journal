-- =====================================================================
-- MIGRATION 022 — a line about yourself
-- Run in: Supabase Dashboard -> SQL Editor -> New query. Safe to re-run.
-- =====================================================================
--
-- Shown on the trading floor when someone opens your card. profiles are
-- already readable by anyone signed in, which is what makes the floor work,
-- so this needs no policy of its own.
-- ---------------------------------------------------------------------

alter table public.profiles add column if not exists bio text;
