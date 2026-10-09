-- =====================================================================
-- MIGRATION 013 — was a loss the strategy's fault, or yours?
-- Run in: Supabase Dashboard -> SQL Editor -> New query. Safe to re-run.
-- =====================================================================
--
-- A model that loses because the setup failed is telling you something
-- about the model. A model that "loses" because you entered early is
-- telling you about you. Counting both against the same win rate hides
-- whichever problem you actually have, so losses get a cause.
--
--   'strategy' — the setup played out and did not work
--   'mine'     — execution error: early, late, wrong size, moved the stop
-- ---------------------------------------------------------------------

alter table public.journal_entries add column if not exists fault text;

do $$ begin
  alter table public.journal_entries
    add constraint journal_entries_fault_check
    check (fault is null or fault in ('strategy', 'mine'));
exception when duplicate_object then null; end $$;

create index if not exists journal_fault_idx
  on public.journal_entries(user_id, kind, fault);
