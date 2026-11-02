-- =====================================================================
-- MIGRATION 018 — stood-aside days inside a backtest month
-- Run in: Supabase Dashboard -> SQL Editor -> New query. Safe to re-run.
-- =====================================================================
--
-- A month you are backtesting has days you would not have traded, and
-- those are part of the result — they are the days the filter worked.
-- They carry no P&L and must stay out of the win rate, so the outcome is
-- recorded explicitly rather than inferred from a zero.
-- ---------------------------------------------------------------------

alter table public.backtest_trades add column if not exists outcome text;

do $$ begin
  alter table public.backtest_trades
    add constraint backtest_trades_outcome_check
    check (outcome is null or outcome in ('win', 'loss', 'no_trade'));
exception when duplicate_object then null; end $$;

-- Anything logged before this had its result in the sign of the P&L.
update public.backtest_trades
set outcome = case when pnl > 0 then 'win' when pnl < 0 then 'loss' end
where outcome is null and pnl <> 0;

create index if not exists backtest_trades_outcome_idx
  on public.backtest_trades(session_id, outcome);
