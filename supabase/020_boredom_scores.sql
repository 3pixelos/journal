-- =====================================================================
-- MIGRATION 020 — the Boredom leaderboard
-- Run in: Supabase Dashboard -> SQL Editor -> New query. Safe to re-run.
-- =====================================================================
--
-- The one table in this schema that is meant to be read by everybody. Your
-- trades, your balances and your goals stay yours; a game score is only any
-- fun if the other person can see it.
--
-- One row per player, holding their best, rather than a row per attempt:
-- a leaderboard that lists the same person four times is a list of runs,
-- not a ranking.
-- ---------------------------------------------------------------------

create table if not exists public.boredom_scores (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  best       integer not null default 0,
  best_combo integer not null default 0,
  runs       integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.boredom_scores enable row level security;

-- readable by anyone signed in — that is the entire point of it
drop policy if exists boredom_scores_select on public.boredom_scores;
create policy boredom_scores_select on public.boredom_scores
  for select to authenticated using (true);

-- but only ever written for yourself
drop policy if exists boredom_scores_insert on public.boredom_scores;
create policy boredom_scores_insert on public.boredom_scores
  for insert to authenticated with check (user_id = (select auth.uid()));

drop policy if exists boredom_scores_update on public.boredom_scores;
create policy boredom_scores_update on public.boredom_scores
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------
-- Submitting a run.
--
-- Done in one statement rather than read-then-write on the client: two runs
-- finishing at once would otherwise let the lower score land last and erase
-- the higher one. greatest() means a bad run can never cost you your best.
-- ---------------------------------------------------------------------
create or replace function public.boredom_submit(new_score integer, new_combo integer default 0)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.boredom_scores (user_id, best, best_combo, runs, updated_at)
  values (auth.uid(), greatest(new_score, 0), greatest(new_combo, 0), 1, now())
  on conflict (user_id) do update
    set best       = greatest(public.boredom_scores.best, excluded.best),
        best_combo = greatest(public.boredom_scores.best_combo, excluded.best_combo),
        runs       = public.boredom_scores.runs + 1,
        updated_at = now();
$$;

revoke all on function public.boredom_submit(integer, integer) from public;
grant execute on function public.boredom_submit(integer, integer) to authenticated;
