-- =====================================================================
-- MIGRATION 014 — a loss can be blamed on high-impact news
-- Run in: Supabase Dashboard -> SQL Editor -> New query. Safe to re-run.
-- =====================================================================
--
-- A news spike is not the setup failing and it is not an execution error,
-- so it gets its own cause. It still counts against the model — the model
-- did lose — but it is flagged, so a run of red can be read as "the data
-- hit" rather than "the edge is gone".
-- ---------------------------------------------------------------------

alter table public.journal_entries drop constraint if exists journal_entries_fault_check;

alter table public.journal_entries
  add constraint journal_entries_fault_check
  check (fault is null or fault in ('strategy', 'mine', 'news'));
