-- =====================================================================
-- MIGRATION 015 — days you stood aside
-- Run in: Supabase Dashboard -> SQL Editor -> New query. Safe to re-run.
-- =====================================================================
--
-- Reading a bad market and not trading it is a decision worth recording,
-- but it is not a win and it is not a loss. It gets its own outcome so it
-- stays out of the win rate entirely while still showing up as a day you
-- reviewed.
-- ---------------------------------------------------------------------

alter table public.journal_entries drop constraint if exists journal_entries_outcome_check;

alter table public.journal_entries
  add constraint journal_entries_outcome_check
  check (outcome is null or outcome in ('win', 'loss', 'breakeven', 'no_trade'));
