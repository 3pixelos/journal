-- =====================================================================
-- MIGRATION 012 — change account currency and restate what is already logged
-- Run in: Supabase Dashboard -> SQL Editor -> New query. Safe to re-run.
-- =====================================================================
--
-- Switching currency must not just relabel the numbers. Every trade keeps
-- its contract figure in pnl_usd, so that is the invariant everything is
-- restated from. Goals, loss limits and balances are scaled by the change
-- in rate, because they were set in the old currency.
--
-- It happens in one function so it is atomic: a half-converted account —
-- dollar trades measured against sterling limits — is worse than either.
-- ---------------------------------------------------------------------

create or replace function public.set_account_currency(
  new_currency text,
  new_rate     numeric,
  restate      boolean default true
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  old_rate numeric;
  scale    numeric;
begin
  if new_rate is null or new_rate <= 0 then
    raise exception 'Rate must be greater than zero.';
  end if;

  select fx_rate into old_rate from public.settings where user_id = auth.uid();
  old_rate := coalesce(nullif(old_rate, 0), 1);
  scale := new_rate / old_rate;

  if restate then
    -- Trades restate from their dollar figure, which never changes.
    update public.trades
    set pnl = round(coalesce(pnl_usd, pnl / old_rate) * new_rate, 2),
        account_balance = case
          when account_balance is null then null
          else round(account_balance * scale, 2)
        end,
        fx_rate = new_rate
    where user_id = auth.uid();

    -- Targets and balances were set in the old currency, so they scale.
    update public.settings
    set daily_goal       = round(daily_goal * scale, 2),
        weekly_goal      = round(weekly_goal * scale, 2),
        monthly_goal     = round(monthly_goal * scale, 2),
        daily_max_loss   = round(daily_max_loss * scale, 2),
        weekly_max_loss  = round(weekly_max_loss * scale, 2),
        monthly_max_loss = round(monthly_max_loss * scale, 2)
    where user_id = auth.uid();

    update public.accounts
    set starting_balance = round(starting_balance * scale, 2)
    where user_id = auth.uid();
  end if;

  update public.settings
  set currency = new_currency, fx_rate = new_rate
  where user_id = auth.uid();
end $$;

revoke all on function public.set_account_currency(text, numeric, boolean) from public;
grant execute on function public.set_account_currency(text, numeric, boolean) to authenticated;
