-- =====================================================================
-- MIGRATION 003 — journal entries can be marked win / loss / breakeven
-- Run in: Supabase Dashboard -> SQL Editor -> New query. Safe to re-run.
-- =====================================================================

-- The outcome is a label, not a number: it says how the trade went without
-- ever revealing size or P&L, so it is safe on a shared entry.
alter table public.journal_entries
  add column if not exists outcome text;

do $$ begin
  alter table public.journal_entries
    add constraint journal_entries_outcome_check
    check (outcome is null or outcome in ('win', 'loss', 'breakeven'));
exception when duplicate_object then null; end $$;

create index if not exists journal_outcome_idx
  on public.journal_entries(user_id, outcome);
