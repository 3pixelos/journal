-- =====================================================================
-- TRADING JOURNAL — full schema, relations, RLS and storage policies
-- Run this whole file once in: Supabase Dashboard -> SQL Editor -> New query
-- Safe to re-run (idempotent).
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- ENUMS
-- ---------------------------------------------------------------------
do $$ begin
  create type trade_direction as enum ('long', 'short');
exception when duplicate_object then null; end $$;

do $$ begin
  create type tag_kind as enum ('strategy', 'setup', 'mistake', 'other');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- PROFILES  (public-ish: only a display name is visible to other traders)
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Trader',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- SETTINGS  (strictly private: goals, risk limits — never shared)
-- ---------------------------------------------------------------------
create table if not exists public.settings (
  user_id         uuid primary key references auth.users(id) on delete cascade,
  weekly_goal     numeric(14,2) not null default 1000,
  weekly_max_loss numeric(14,2) not null default 500,
  daily_max_loss  numeric(14,2) not null default 250,
  currency        text not null default 'USD',
  updated_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- ACCOUNTS  (private)
-- ---------------------------------------------------------------------
create table if not exists public.accounts (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  name             text not null,
  broker           text,
  starting_balance numeric(14,2) not null default 0,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  unique (user_id, name)
);
create index if not exists accounts_user_idx on public.accounts(user_id);

-- ---------------------------------------------------------------------
-- TAGS  (owned per user; readable by others only when attached to a
--        shared journal entry, so the shared feed can render its chips)
-- ---------------------------------------------------------------------
create table if not exists public.tags (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  kind       tag_kind not null default 'strategy',
  color      text not null default '#6366f1',
  created_at timestamptz not null default now(),
  unique (user_id, name, kind)
);
create index if not exists tags_user_idx on public.tags(user_id);

-- ---------------------------------------------------------------------
-- TRADES  (strictly private — never exposed to other users)
-- ---------------------------------------------------------------------
create table if not exists public.trades (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  account_id  uuid references public.accounts(id) on delete set null,
  symbol      text not null,
  direction   trade_direction not null default 'long',
  entry_price numeric(18,6),
  exit_price  numeric(18,6),
  quantity    numeric(18,6) not null default 1,
  multiplier  numeric(18,6) not null default 1,   -- contract multiplier (MNQ=2, ES=50, stocks=1)
  fees        numeric(14,2) not null default 0,
  pnl         numeric(14,2) not null default 0,   -- net P&L, auto-computed in UI, editable
  trade_date  date not null default (now() at time zone 'utc')::date,
  opened_at   timestamptz,
  closed_at   timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists trades_user_date_idx on public.trades(user_id, trade_date desc);
create index if not exists trades_user_symbol_idx on public.trades(user_id, symbol);

create table if not exists public.trade_tags (
  trade_id uuid not null references public.trades(id) on delete cascade,
  tag_id   uuid not null references public.tags(id) on delete cascade,
  primary key (trade_id, tag_id)
);

-- ---------------------------------------------------------------------
-- JOURNAL ENTRIES  (the ONE shared surface; is_shared = false keeps it private)
-- Never carries P&L: the shared feed shows narrative + tags + screenshots only.
-- ---------------------------------------------------------------------
create table if not exists public.journal_entries (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  trade_id     uuid references public.trades(id) on delete set null,
  title        text not null default '',
  entry_date   date not null default (now() at time zone 'utc')::date,
  setup        text,          -- setup / strategy
  reasoning    text,          -- why I took it
  emotions     text,          -- mental state
  mistakes     text,          -- what went wrong
  improvements text,          -- what I'd do differently
  is_shared    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists journal_user_date_idx on public.journal_entries(user_id, entry_date desc);
create index if not exists journal_shared_idx on public.journal_entries(is_shared, entry_date desc);

create table if not exists public.journal_tags (
  journal_entry_id uuid not null references public.journal_entries(id) on delete cascade,
  tag_id           uuid not null references public.tags(id) on delete cascade,
  primary key (journal_entry_id, tag_id)
);

-- ---------------------------------------------------------------------
-- ATTACHMENTS  (chart screenshots in Supabase Storage)
-- Visible to others only when hanging off a shared journal entry.
-- ---------------------------------------------------------------------
create table if not exists public.attachments (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  trade_id         uuid references public.trades(id) on delete cascade,
  journal_entry_id uuid references public.journal_entries(id) on delete cascade,
  storage_path     text not null unique,   -- '<uid>/<uuid>.png' inside bucket trade-screenshots
  caption          text,
  created_at       timestamptz not null default now()
);
create index if not exists attachments_trade_idx on public.attachments(trade_id);
create index if not exists attachments_journal_idx on public.attachments(journal_entry_id);

-- ---------------------------------------------------------------------
-- DAILY CHECKLIST  (private)
-- ---------------------------------------------------------------------
create table if not exists public.checklist_items (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  label      text not null,
  sort_order integer not null default 0,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists checklist_items_user_idx on public.checklist_items(user_id, sort_order);

create table if not exists public.checklist_logs (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  item_id      uuid not null references public.checklist_items(id) on delete cascade,
  log_date     date not null,
  completed    boolean not null default true,
  completed_at timestamptz not null default now(),
  unique (user_id, item_id, log_date)
);
create index if not exists checklist_logs_user_date_idx on public.checklist_logs(user_id, log_date desc);

-- ---------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_profiles_touch on public.profiles;
create trigger trg_profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_trades_touch on public.trades;
create trigger trg_trades_touch before update on public.trades
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_journal_touch on public.journal_entries;
create trigger trg_journal_touch before update on public.journal_entries
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- NEW USER BOOTSTRAP: profile + settings + a starter checklist
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;

  insert into public.settings (user_id) values (new.id)
  on conflict (user_id) do nothing;

  insert into public.checklist_items (user_id, label, sort_order) values
    (new.id, 'Check the economic calendar for today''s news', 1),
    (new.id, 'Mark key levels (overnight high/low, prior day H/L)', 2),
    (new.id, 'Define risk per trade', 3),
    (new.id, 'Set max loss for the day', 4),
    (new.id, 'Review yesterday''s journal entry', 5),
    (new.id, 'Confirm I am rested and focused', 6)
  on conflict do nothing;

  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =====================================================================
-- ROW LEVEL SECURITY
-- =====================================================================
alter table public.profiles         enable row level security;
alter table public.settings         enable row level security;
alter table public.accounts         enable row level security;
alter table public.tags             enable row level security;
alter table public.trades           enable row level security;
alter table public.trade_tags       enable row level security;
alter table public.journal_entries  enable row level security;
alter table public.journal_tags     enable row level security;
alter table public.attachments      enable row level security;
alter table public.checklist_items  enable row level security;
alter table public.checklist_logs   enable row level security;

-- ---- PROFILES: everyone signed in can read display names (needed for the
-- ---- shared journal byline); you can only write your own.
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated using (true);

drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles
  for insert to authenticated with check (id = (select auth.uid()));

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- ---- SETTINGS: fully private
drop policy if exists settings_all on public.settings;
create policy settings_all on public.settings
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ---- ACCOUNTS: fully private
drop policy if exists accounts_all on public.accounts;
create policy accounts_all on public.accounts
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ---- TRADES: fully private. No one else can ever select a row.
drop policy if exists trades_all on public.trades;
create policy trades_all on public.trades
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ---- TRADE_TAGS: private, gated through the parent trade
drop policy if exists trade_tags_all on public.trade_tags;
create policy trade_tags_all on public.trade_tags
  for all to authenticated
  using (exists (select 1 from public.trades t
                 where t.id = trade_tags.trade_id and t.user_id = (select auth.uid())))
  with check (exists (select 1 from public.trades t
                 where t.id = trade_tags.trade_id and t.user_id = (select auth.uid())));

-- ---- JOURNAL ENTRIES: read your own OR anyone's shared entry.
-- ---- Write/update/delete only your own.
drop policy if exists journal_select on public.journal_entries;
create policy journal_select on public.journal_entries
  for select to authenticated
  using (user_id = (select auth.uid()) or is_shared = true);

drop policy if exists journal_insert on public.journal_entries;
create policy journal_insert on public.journal_entries
  for insert to authenticated with check (user_id = (select auth.uid()));

drop policy if exists journal_update on public.journal_entries;
create policy journal_update on public.journal_entries
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists journal_delete on public.journal_entries;
create policy journal_delete on public.journal_entries
  for delete to authenticated using (user_id = (select auth.uid()));

-- ---- TAGS: your own, plus any tag attached to a shared journal entry
drop policy if exists tags_select on public.tags;
create policy tags_select on public.tags
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.journal_tags jt
      join public.journal_entries j on j.id = jt.journal_entry_id
      where jt.tag_id = tags.id and j.is_shared = true
    )
  );

drop policy if exists tags_write on public.tags;
create policy tags_write on public.tags
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ---- JOURNAL_TAGS: visible when the parent entry is visible
drop policy if exists journal_tags_select on public.journal_tags;
create policy journal_tags_select on public.journal_tags
  for select to authenticated
  using (exists (select 1 from public.journal_entries j
                 where j.id = journal_tags.journal_entry_id
                   and (j.user_id = (select auth.uid()) or j.is_shared = true)));

drop policy if exists journal_tags_write on public.journal_tags;
create policy journal_tags_write on public.journal_tags
  for all to authenticated
  using (exists (select 1 from public.journal_entries j
                 where j.id = journal_tags.journal_entry_id and j.user_id = (select auth.uid())))
  with check (exists (select 1 from public.journal_entries j
                 where j.id = journal_tags.journal_entry_id and j.user_id = (select auth.uid())));

-- ---- ATTACHMENTS: your own, plus screenshots on a shared journal entry
drop policy if exists attachments_select on public.attachments;
create policy attachments_select on public.attachments
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.journal_entries j
      where j.id = attachments.journal_entry_id and j.is_shared = true
    )
  );

drop policy if exists attachments_write on public.attachments;
create policy attachments_write on public.attachments
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ---- CHECKLIST: fully private
drop policy if exists checklist_items_all on public.checklist_items;
create policy checklist_items_all on public.checklist_items
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists checklist_logs_all on public.checklist_logs;
create policy checklist_logs_all on public.checklist_logs
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- =====================================================================
-- STORAGE: private bucket for chart screenshots
-- Paths are always '<auth.uid()>/<filename>' so the first folder segment
-- is the owner check.
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('trade-screenshots', 'trade-screenshots', false, 10485760,
        array['image/png','image/jpeg','image/jpg','image/webp','image/gif'])
on conflict (id) do update
  set public = false,
      file_size_limit = 10485760,
      allowed_mime_types = array['image/png','image/jpeg','image/jpg','image/webp','image/gif'];

drop policy if exists "screenshots read own or shared" on storage.objects;
create policy "screenshots read own or shared" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'trade-screenshots'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or exists (
        select 1 from public.attachments a
        join public.journal_entries j on j.id = a.journal_entry_id
        where a.storage_path = storage.objects.name and j.is_shared = true
      )
    )
  );

drop policy if exists "screenshots insert own" on storage.objects;
create policy "screenshots insert own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'trade-screenshots'
              and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "screenshots update own" on storage.objects;
create policy "screenshots update own" on storage.objects
  for update to authenticated
  using (bucket_id = 'trade-screenshots'
         and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "screenshots delete own" on storage.objects;
create policy "screenshots delete own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'trade-screenshots'
         and (storage.foldername(name))[1] = (select auth.uid())::text);

-- =====================================================================
-- BACKFILL for users that existed before this schema was installed
-- =====================================================================
insert into public.profiles (id, display_name)
select u.id, coalesce(u.raw_user_meta_data->>'display_name', split_part(u.email, '@', 1))
from auth.users u
on conflict (id) do nothing;

insert into public.settings (user_id)
select u.id from auth.users u
on conflict (user_id) do nothing;
