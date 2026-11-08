-- =====================================================================
-- MIGRATION 024 — B/E: the trade that neither won nor lost
-- Run in: Supabase Dashboard -> SQL Editor -> New query. Safe to re-run.
-- =====================================================================
--
-- Live journal entries have had 'breakeven' since migration 003. Demo
-- trades never did, so a trade that came back flat had to be logged as a
-- small win or a small loss — and either one is a lie to the win rate.
--
-- Break even is its own outcome for the same reason standing aside is: it
-- is a real result that belongs in the count of trades you took and
-- nowhere near wins or losses. The P&L it carries is zero, so every
-- figure derived from the sign of the money stays correct by itself.
-- ---------------------------------------------------------------------

alter table public.backtest_trades drop constraint if exists backtest_trades_outcome_check;

alter table public.backtest_trades
  add constraint backtest_trades_outcome_check
  check (outcome is null or outcome in ('win', 'loss', 'breakeven', 'no_trade'));

-- Journal entries, including the ones on the Backtesting page, already
-- allow it (003, widened in 015). Repeated here only so that running this
-- file on a database that somehow missed those leaves both tables alike.
alter table public.journal_entries drop constraint if exists journal_entries_outcome_check;

alter table public.journal_entries
  add constraint journal_entries_outcome_check
  check (outcome is null or outcome in ('win', 'loss', 'breakeven', 'no_trade'));
