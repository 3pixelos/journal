-- =====================================================================
-- MIGRATION 017 — write-up fields on a demo trade
-- Run in: Supabase Dashboard -> SQL Editor -> New query. Safe to re-run.
-- =====================================================================
--
-- Backtesting a month is about the decisions, not the tick data. The
-- demo trade now asks for direction, result and amount, plus the same
-- write-up questions the journal asks — the price fields stay on the
-- table, unused, for anything logged before this.
-- ---------------------------------------------------------------------

alter table public.backtest_trades add column if not exists execution_notes text;
alter table public.backtest_trades add column if not exists mistakes        text;
alter table public.backtest_trades add column if not exists improvements    text;
