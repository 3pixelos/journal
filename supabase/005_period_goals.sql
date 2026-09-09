-- =====================================================================
-- MIGRATION 005 — daily / weekly / monthly goals and loss limits
-- Run in: Supabase Dashboard -> SQL Editor -> New query. Safe to re-run.
-- =====================================================================

alter table public.settings add column if not exists daily_goal      numeric(14,2) not null default 200;
alter table public.settings add column if not exists monthly_goal    numeric(14,2) not null default 4000;
alter table public.settings add column if not exists monthly_max_loss numeric(14,2) not null default 2000;

-- Seed the new goals from whatever weekly target is already set, so the
-- day/week/month toggle starts out coherent instead of on the defaults.
update public.settings
set daily_goal   = round(weekly_goal / 5.0, 2),
    monthly_goal = round(weekly_goal * 4.0, 2)
where daily_goal = 200 and monthly_goal = 4000 and weekly_goal <> 1000;

update public.settings
set monthly_max_loss = round(weekly_max_loss * 4.0, 2)
where monthly_max_loss = 2000 and weekly_max_loss <> 500;
