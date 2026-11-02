-- =====================================================================
-- MIGRATION 016 — backtesting with demo money, a month at a time
-- Run in: Supabase Dashboard -> SQL Editor -> New query. Safe to re-run.
-- =====================================================================
--
-- Picking a month and trading it with demo money is a separate exercise
-- from live trading, so it gets its own tables. Putting it in `trades`
-- would have put fake money on the real calendar, in the real equity
-- curve and against the real goals, which is the one thing that must not
-- happen to a trading journal.
--
-- Each session is one month with its own starting balance; its trades
-- carry the same sizing fields as a real one so the same calculator works.
-- ---------------------------------------------------------------------

create table if not exists public.backtest_sessions (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  month            text not null,                    -- 'YYYY-MM'
  starting_balance numeric(14,2) not null default 10000,
  note             text,
  created_at       timestamptz not null default now(),
  constraint backtest_sessions_month_format check (month ~ '^\d{4}-\d{2}$'),
  unique (user_id, month)
);
create index if not exists backtest_sessions_user_idx
  on public.backtest_sessions(user_id, month desc);

create table if not exists public.backtest_trades (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  session_id    uuid not null references public.backtest_sessions(id) on delete cascade,
  model_id      uuid references public.models(id) on delete set null,
  trade_date    date not null,
  contract      text,
  direction     text not null default 'long',
  quantity      numeric(18,6) not null default 1,
  multiplier    numeric(18,6) not null default 1,
  entry_price   numeric(18,6),
  stop_price    numeric(18,6),
  target_price  numeric(18,6),
  exit_price    numeric(18,6),
  stop_points   numeric(18,4),
  target_points numeric(18,4),
  result        text,
  fees          numeric(14,2) not null default 0,
  pnl           numeric(14,2) not null default 0,
  pnl_usd       numeric(14,2),
  fx_rate       numeric(14,6) not null default 1,
  note          text,
  created_at    timestamptz not null default now(),
  constraint backtest_trades_result_check
    check (result is null or result in ('target', 'stop', 'manual')),
  constraint backtest_trades_direction_check
    check (direction in ('long', 'short'))
);
create index if not exists backtest_trades_session_idx
  on public.backtest_trades(session_id, trade_date);

-- =====================================================================
-- RLS — demo money is nobody else's business either
-- =====================================================================
alter table public.backtest_sessions enable row level security;
alter table public.backtest_trades   enable row level security;

drop policy if exists backtest_sessions_all on public.backtest_sessions;
create policy backtest_sessions_all on public.backtest_sessions
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists backtest_trades_all on public.backtest_trades;
create policy backtest_trades_all on public.backtest_trades
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
