-- =====================================================================
-- MIGRATION 009 — backtesting entries
-- Run in: Supabase Dashboard -> SQL Editor -> New query. Safe to re-run.
-- =====================================================================
--
-- A backtest is the same record as a journal entry with the money taken
-- out: a model, the steps you followed, how it resolved, charts and notes.
-- It therefore reuses journal_entries rather than duplicating the tags,
-- screenshots, step-tracking and RLS that already work — one column says
-- which kind of record it is.
-- ---------------------------------------------------------------------

alter table public.journal_entries
  add column if not exists kind text not null default 'journal';

do $$ begin
  alter table public.journal_entries
    add constraint journal_entries_kind_check
    check (kind in ('journal', 'backtest'));
exception when duplicate_object then null; end $$;

create index if not exists journal_kind_idx
  on public.journal_entries(user_id, kind, entry_date desc);
