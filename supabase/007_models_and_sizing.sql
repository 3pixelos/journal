-- =====================================================================
-- MIGRATION 007 — trading models (confluence checklists), contract sizing
-- Run in: Supabase Dashboard -> SQL Editor -> New query. Safe to re-run.
-- =====================================================================

-- ---------------------------------------------------------------------
-- MODELS — a named setup plus the confluences you wait for before entry.
-- ---------------------------------------------------------------------
create table if not exists public.models (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  note       text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists models_user_idx on public.models(user_id, sort_order);
create unique index if not exists models_user_name_unique
  on public.models (user_id, lower(name));

create table if not exists public.model_checks (
  id         uuid primary key default gen_random_uuid(),
  model_id   uuid not null references public.models(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  label      text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists model_checks_model_idx on public.model_checks(model_id, sort_order);

-- Which confluences were actually ticked on a given entry. A row means
-- "confirmed"; absence means it was left unchecked.
create table if not exists public.journal_checks (
  journal_entry_id uuid not null references public.journal_entries(id) on delete cascade,
  check_id         uuid not null references public.model_checks(id) on delete cascade,
  primary key (journal_entry_id, check_id)
);

-- ---------------------------------------------------------------------
-- JOURNAL ENTRIES — the model used, how the plan was executed, and a
-- full play-by-play of what was actually done.
-- ---------------------------------------------------------------------
alter table public.journal_entries
  add column if not exists model_id uuid references public.models(id) on delete set null;
alter table public.journal_entries
  add column if not exists execution text;
alter table public.journal_entries
  add column if not exists execution_notes text;

do $$ begin
  alter table public.journal_entries
    add constraint journal_entries_execution_check
    check (execution is null or execution in
      ('followed', 'early', 'late', 'deviated', 'no_plan'));
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- TRADES — index-futures sizing. Points in, dollars out.
--   1 NQ  = $20 per point      1 MNQ = $2 per point
-- `multiplier` already holds the dollars-per-point, so these columns only
-- add what it could not express: the planned stop and target distances,
-- which side the trade finished on, and the balance it started from.
-- ---------------------------------------------------------------------
alter table public.trades add column if not exists contract        text;
alter table public.trades add column if not exists stop_points     numeric(18,4);
alter table public.trades add column if not exists target_points   numeric(18,4);
alter table public.trades add column if not exists result          text;
alter table public.trades add column if not exists account_balance numeric(14,2);

do $$ begin
  alter table public.trades
    add constraint trades_result_check
    check (result is null or result in ('target', 'stop', 'manual'));
exception when duplicate_object then null; end $$;

-- =====================================================================
-- ROW LEVEL SECURITY
-- =====================================================================
alter table public.models         enable row level security;
alter table public.model_checks   enable row level security;
alter table public.journal_checks enable row level security;

-- Models are yours to write. They are readable by others only when attached
-- to a shared journal entry, so the feed can show which setup was traded —
-- the same rule tags already follow. No P&L is involved either way.
drop policy if exists models_select on public.models;
create policy models_select on public.models
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.journal_entries j
      where j.model_id = models.id and j.is_shared = true
    )
  );

drop policy if exists models_write on public.models;
create policy models_write on public.models
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists model_checks_select on public.model_checks;
create policy model_checks_select on public.model_checks
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.journal_checks jc
      join public.journal_entries j on j.id = jc.journal_entry_id
      where jc.check_id = model_checks.id and j.is_shared = true
    )
  );

drop policy if exists model_checks_write on public.model_checks;
create policy model_checks_write on public.model_checks
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists journal_checks_select on public.journal_checks;
create policy journal_checks_select on public.journal_checks
  for select to authenticated
  using (exists (
    select 1 from public.journal_entries j
    where j.id = journal_checks.journal_entry_id
      and (j.user_id = (select auth.uid()) or j.is_shared = true)
  ));

drop policy if exists journal_checks_write on public.journal_checks;
create policy journal_checks_write on public.journal_checks
  for all to authenticated
  using (exists (
    select 1 from public.journal_entries j
    where j.id = journal_checks.journal_entry_id and j.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.journal_entries j
    where j.id = journal_checks.journal_entry_id and j.user_id = (select auth.uid())
  ));
