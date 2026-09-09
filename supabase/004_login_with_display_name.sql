-- =====================================================================
-- MIGRATION 004 — sign in with either an email or a display name
-- Run in: Supabase Dashboard -> SQL Editor -> New query. Safe to re-run.
-- =====================================================================
--
-- Supabase Auth authenticates on email only, so the app resolves a display
-- name to its email before calling signInWithPassword. That resolution has
-- to happen before the user is signed in, which means this function is
-- callable anonymously — anyone who can reach the app can turn a known
-- display name into an email address. That is the cost of name-based login.
-- Passwords are never touched here; GoTrue still does the actual auth,
-- keeping its own rate limiting and lockout behaviour.
-- ---------------------------------------------------------------------

-- Display names must be unique, or a name cannot identify one account.
do $$
begin
  create unique index if not exists profiles_display_name_unique
    on public.profiles (lower(display_name));
exception
  when unique_violation then
    raise notice
      'Duplicate display names exist, so the unique index was not created. '
      'Make them unique in the profiles table, then re-run this migration.';
end $$;

create or replace function public.email_for_login(identifier text)
returns text
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  found_email text;
  match_count int;
  needle text := lower(trim(coalesce(identifier, '')));
begin
  if needle = '' then
    return null;
  end if;

  -- Already an email: hand it straight back, no lookup performed.
  if position('@' in needle) > 0 then
    return needle;
  end if;

  select count(*) into match_count
  from public.profiles p
  where lower(p.display_name) = needle;

  -- Ambiguous or unknown names resolve to nothing, so the caller gets the
  -- same "invalid credentials" answer either way.
  if match_count <> 1 then
    return null;
  end if;

  select u.email into found_email
  from public.profiles p
  join auth.users u on u.id = p.id
  where lower(p.display_name) = needle;

  return found_email;
end $$;

revoke all on function public.email_for_login(text) from public;
grant execute on function public.email_for_login(text) to anon, authenticated;
