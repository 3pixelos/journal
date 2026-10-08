-- =====================================================================
-- ONE-OFF DATA EDIT — fold the stop-loss step into Entry, and put the
-- continuation-confluence step last.
--
-- Run in: Supabase Dashboard -> SQL Editor -> New query.
-- This edits your data, not the schema. It is written to be safe to run
-- twice: the second run finds nothing to do and says so.
--
-- Before:  8  AFTER THAT WE LOOK FOR A CONTINUATION CONFLUENCE (FVG / EQUILIBRIUM)
--          9  IF WE GET A CONTINUATION CONFLUENCE WE ENTER THE TRADE
--         10  STOP LOSS BEFORE THE PREVIOUS LOW AND TAKE PROFIT AT THE NEXT HIGH ...
--
-- After:   8  ENTRY — STOP LOSS BEFORE THE PREVIOUS LOW, TAKE PROFIT AT THE NEXT HIGH ...
--          9  AFTER THAT WE LOOK FOR A CONTINUATION CONFLUENCE (FVG / EQUILIBRIUM)
--
-- Note: the Entry step keeps its id, so every tick already recorded against
-- it on past entries survives. The stop-loss step is removed, so its own
-- ticks go with it — its wording now lives inside Entry.
-- ---------------------------------------------------------------------

do $$
declare
  entry_id   uuid;
  conf_id    uuid;
  stop_id    uuid;
  entry_ord  integer;
  conf_ord   integer;
begin
  select id, sort_order into entry_id, entry_ord
  from public.model_checks
  where label ilike '%WE ENTER THE TRADE%'
  order by sort_order limit 1;

  select id, sort_order into conf_id, conf_ord
  from public.model_checks
  where label ilike '%CONTINUATION CONFLUENCE (FVG%'
  order by sort_order limit 1;

  select id into stop_id
  from public.model_checks
  where label ilike 'STOP LOSS BEFORE THE PREVIOUS LOW%'
  order by sort_order limit 1;

  if entry_id is null or conf_id is null then
    raise notice 'Nothing to do — those steps were not found (already changed?).';
    return;
  end if;

  -- 1. Entry absorbs the stop-loss wording.
  update public.model_checks
  set label = 'ENTRY — STOP LOSS BEFORE THE PREVIOUS LOW, TAKE PROFIT AT THE NEXT HIGH / LIQUIDITY DRAW'
  where id = entry_id;

  -- 2. The separate stop-loss step goes.
  if stop_id is not null then
    delete from public.model_checks where id = stop_id;
  end if;

  -- 3. Swap the two so the continuation confluence sits last.
  if conf_ord < entry_ord then
    update public.model_checks set sort_order = conf_ord  where id = entry_id;
    update public.model_checks set sort_order = entry_ord where id = conf_id;
  end if;

  raise notice 'Done — Entry is now step %, continuation confluence is step %.',
    least(conf_ord, entry_ord), greatest(conf_ord, entry_ord);
end $$;

-- Check the result:
-- select sort_order, label from public.model_checks order by model_id, sort_order;
