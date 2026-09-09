-- =====================================================================
-- MIGRATION 002 — trading reminders + "last active" presence
-- Run this in: Supabase Dashboard -> SQL Editor -> New query
-- Safe to re-run.
-- =====================================================================

-- ---------------------------------------------------------------------
-- REMINDERS — personal trading rules ("no more than 2 trades a day").
-- Private to each trader.
-- ---------------------------------------------------------------------
create table if not exists public.reminders (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  text       text not null,
  note       text,
  is_active  boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists reminders_user_idx on public.reminders(user_id, sort_order);

alter table public.reminders enable row level security;

drop policy if exists reminders_all on public.reminders;
create policy reminders_all on public.reminders
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------
-- PRESENCE — so you can see when your trading partner was last around.
-- Live "online now" comes from Realtime presence; this column is the
-- fallback for "active 2h ago" once they close the tab.
-- ---------------------------------------------------------------------
alter table public.profiles add column if not exists last_seen_at timestamptz;

-- A tiny, self-only heartbeat the app calls every couple of minutes.
create or replace function public.touch_last_seen()
returns void language sql security definer set search_path = public as $$
  update public.profiles set last_seen_at = now() where id = auth.uid();
$$;

grant execute on function public.touch_last_seen() to authenticated;

-- ---------------------------------------------------------------------
-- Give existing users a starter set of reminders (only if they have none)
-- ---------------------------------------------------------------------
insert into public.reminders (user_id, text, note, sort_order)
select u.id, r.text, r.note, r.ord
from auth.users u
cross join (values
  ('No more than 2 trades per day', 'Overtrading is how good days turn red.', 1),
  ('Stop after 2 consecutive losses', 'Walk away. The market will be here tomorrow.', 2),
  ('No trades in the first 5 minutes', 'Let the open settle before committing size.', 3),
  ('Never move a stop loss further away', 'The plan was set before the emotion.', 4),
  ('No revenge trading after a loss', 'The next trade owes you nothing.', 5)
) as r(text, note, ord)
where not exists (select 1 from public.reminders x where x.user_id = u.id);

-- ---------------------------------------------------------------------
-- New signups get the same starter reminders
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

  insert into public.reminders (user_id, text, note, sort_order) values
    (new.id, 'No more than 2 trades per day', 'Overtrading is how good days turn red.', 1),
    (new.id, 'Stop after 2 consecutive losses', 'Walk away. The market will be here tomorrow.', 2),
    (new.id, 'No trades in the first 5 minutes', 'Let the open settle before committing size.', 3),
    (new.id, 'Never move a stop loss further away', 'The plan was set before the emotion.', 4),
    (new.id, 'No revenge trading after a loss', 'The next trade owes you nothing.', 5)
  on conflict do nothing;

  return new;
end $$;
