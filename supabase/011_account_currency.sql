-- =====================================================================
-- MIGRATION 011 — account currency and USD conversion
-- Run in: Supabase Dashboard -> SQL Editor -> New query. Safe to re-run.
-- =====================================================================
--
-- NQ and MNQ settle in USD, but the account they land in might not be.
-- A GBP account taking $150.50 of index points sees £114.64 arrive, so the
-- journal has to hold both: the contract figure in USD, and what the
-- account actually moved by.
--
--   settings.currency  — what the account is denominated in
--   settings.fx_rate   — account-currency units per 1 USD (GBP ≈ 0.7617)
--   trades.fx_rate     — the rate used for that trade, so history does not
--                        silently re-price when the rate changes
--   trades.pnl         — in account currency, which is what goals, limits
--                        and the calendar are measured against
--   trades.pnl_usd     — the same trade in contract currency
-- ---------------------------------------------------------------------

alter table public.settings
  add column if not exists fx_rate numeric(14,6) not null default 1;

-- `currency` already exists from the original schema; make sure it is sane.
update public.settings set currency = 'USD' where currency is null or currency = '';

alter table public.trades add column if not exists fx_rate numeric(14,6) not null default 1;
alter table public.trades add column if not exists pnl_usd numeric(14,2);

-- Everything logged so far was recorded in contract currency with no
-- conversion, so USD and account figures are the same for those rows.
update public.trades set pnl_usd = pnl where pnl_usd is null;
