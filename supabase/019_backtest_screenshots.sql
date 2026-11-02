-- =====================================================================
-- MIGRATION 019 — charts on a demo trade
-- Run in: Supabase Dashboard -> SQL Editor -> New query. Safe to re-run.
-- =====================================================================
--
-- Attachments already hang off a trade or a journal entry; a demo trade
-- gets its own column rather than a second table, so the same uploader,
-- the same private bucket and the same signed-URL path all keep working.
-- The existing row-level policies are on user_id, so they cover these
-- without change.
-- ---------------------------------------------------------------------

alter table public.attachments
  add column if not exists backtest_trade_id uuid
  references public.backtest_trades(id) on delete cascade;

create index if not exists attachments_backtest_idx
  on public.attachments(backtest_trade_id);
