-- =====================================================================
-- MIGRATION 023 — how many backtests someone has run
-- Run in: Supabase Dashboard -> SQL Editor -> New query. Safe to re-run.
-- =====================================================================
--
-- The trading floor card is otherwise built from shared journal entries,
-- because those are the only records everybody can read. Backtests are not
-- like that: the ones on the Backtesting page may be unshared, and the ones
-- on Backtest P&L live in `backtest_trades`, which row-level security keeps
-- to its owner. A plain query therefore cannot count anybody but you.
--
-- So this is deliberately the one place where something crosses that line,
-- and it crosses as narrowly as possible: a count, and nothing attached to
-- it. No dates, no models, no notes, no demo P&L — a number that says how
-- much work someone has put in, which is the thing being asked for. Money
-- and content stay exactly as private as they were.
--
-- The output columns are named `trader` rather than `user_id` so that the
-- body can reference the tables' own `user_id` without ambiguity: in a SQL
-- function the declared output names are in scope too.
-- ---------------------------------------------------------------------

create or replace function public.backtest_counts()
returns table (trader uuid, backtests bigint, journaled bigint, demo_trades bigint)
language sql
security definer
stable
set search_path = public
as $$
  with j as (
    select je.user_id as uid, count(*) as n
    from public.journal_entries je
    where je.kind = 'backtest'
    group by je.user_id
  ), t as (
    select bt.user_id as uid, count(*) as n
    from public.backtest_trades bt
    group by bt.user_id
  )
  select coalesce(j.uid, t.uid),
         coalesce(j.n, 0) + coalesce(t.n, 0),
         coalesce(j.n, 0),
         coalesce(t.n, 0)
  from j full outer join t on t.uid = j.uid;
$$;

-- Signed-in only. Nothing here is public.
revoke all on function public.backtest_counts() from public;
revoke all on function public.backtest_counts() from anon;
grant execute on function public.backtest_counts() to authenticated;
