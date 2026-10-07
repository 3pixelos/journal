-- =====================================================================
-- MIGRATION 008 — store the stop and target as prices, not just distances
-- Run in: Supabase Dashboard -> SQL Editor -> New query. Safe to re-run.
-- =====================================================================
--
-- You think in prices, so prices are what the journal asks for. The point
-- distances stay alongside them: they are what the dollar maths actually
-- uses, and keeping both means editing an entry round-trips exactly.
-- entry_price and exit_price already exist on trades.
-- ---------------------------------------------------------------------

alter table public.trades add column if not exists stop_price   numeric(18,6);
alter table public.trades add column if not exists target_price numeric(18,6);

-- Backfill prices for anything logged with distances only, using the
-- direction to work out which side of entry each level sat on.
update public.trades
set stop_price = case
      when direction = 'long' then entry_price - stop_points
      else entry_price + stop_points
    end
where stop_price is null and stop_points is not null and entry_price is not null;

update public.trades
set target_price = case
      when direction = 'long' then entry_price + target_points
      else entry_price - target_points
    end
where target_price is null and target_points is not null and entry_price is not null;
