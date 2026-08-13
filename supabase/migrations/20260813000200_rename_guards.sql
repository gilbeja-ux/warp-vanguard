-- Warp Vanguard — two guards on renaming.
--
-- The rename shipped without either, and both holes are real:
--
--   1. NO RATE LIMIT. Nothing stopped a player cycling the name on the top of a
--      board as often as they liked, which is board churn at best and a way to
--      annoy everyone reading it at worst.
--   2. A REDACTION COULD BE UNDONE. report_run neutralises a name at three
--      reporters; the player could put it straight back through MY DATA. That
--      makes moderation theatre against exactly the person it exists for.
--
-- This file closes both. Written with explicit DROPs so it applies cleanly
-- whether or not 20260813000000_my_data.sql has already run against this project.

-- ---------------------------------------------------------------------------
-- 1) THE LOCK. Set by a redaction — automatic (report_run) or by hand in the
-- dashboard — and honoured by rename_my_runs, which skips locked rows.
--
-- DELETION IS DELIBERATELY NOT BLOCKED BY THIS. Erasing the row removes the
-- offending name outright, which is a superset of redacting it, so there is
-- nothing to protect; and blocking a player's erasure because we moderated them
-- would be the one refusal here with no defence behind it.
-- ---------------------------------------------------------------------------
alter table public.runs add column if not exists name_locked boolean not null default false;

comment on column public.runs.name_locked is
  'A moderator (or report_run''s threshold) neutralised this name. rename_my_runs skips it; delete still works.';

-- ---------------------------------------------------------------------------
-- 2) THE COOLDOWN LEDGER.
--
-- This is NOT the profiles table the schema keeps refusing to grow. It holds one
-- timestamp and nothing else — no handle, no score, no history, nothing that
-- describes a person. It exists because a rate limit needs a clock somewhere, and
-- runs.updated_at cannot be that clock: playing a run bumps it too, so a player
-- would be locked out of renaming by the act of playing.
-- ---------------------------------------------------------------------------
create table if not exists public.player_limits (
  player_id  text primary key,
  renamed_at timestamptz
);
alter table public.player_limits enable row level security;  -- no policies: service role only

-- ---------------------------------------------------------------------------
-- rename_my_runs, now guarded. Returns enough for the client to say something
-- true rather than just "done":
--   renamed  — rows that actually changed
--   locked   — rows skipped because they were moderated
--   wait_sec — seconds still to wait; > 0 means NOTHING was renamed
--
-- THE FIRST RENAME IS ALWAYS FREE. The cooldown starts after a successful one, so
-- the urgent case this whole feature exists for — "my real name is on a public
-- board" — is never made to wait. Only the second change in a day is.
-- ---------------------------------------------------------------------------
drop function if exists public.rename_my_runs(text, text);
create or replace function public.rename_my_runs(p_player text, p_name text, p_cooldown_sec int default 86400)
returns table (renamed int, locked int, wait_sec int)
language plpgsql as $$
declare
  v_last timestamptz;
  v_wait int := 0;
  n_ren  int := 0;
  n_lock int := 0;
begin
  select pl.renamed_at into v_last from public.player_limits pl where pl.player_id = p_player;
  if v_last is not null then
    v_wait := greatest(0, p_cooldown_sec - floor(extract(epoch from (now() - v_last)))::int);
  end if;

  -- how many of their rows are moderated — reported either way, so the client can
  -- explain a partial rename instead of silently doing less than it said
  select count(*)::int into n_lock
    from public.runs r where r.player_id = p_player and r.name_locked;

  if v_wait > 0 then
    return query select 0, n_lock, v_wait; return;
  end if;

  update public.runs
     set player_name = coalesce(p_name, ''), updated_at = now()
   where player_id = p_player and not name_locked;
  get diagnostics n_ren = row_count;

  -- the clock only starts on a rename that DID something. A player whose rows are
  -- all locked, or who holds none yet, is not put on a cooldown for a no-op.
  if n_ren > 0 then
    insert into public.player_limits (player_id, renamed_at) values (p_player, now())
    on conflict (player_id) do update set renamed_at = now();
  end if;

  return query select n_ren, n_lock, 0;
end;
$$;

-- ---------------------------------------------------------------------------
-- delete_my_runs takes the ledger row with it. The auth user is deleted by the
-- Edge Function moments later so the id never comes back, and a timestamp left
-- behind would be the one trace of a player who asked to have none.
-- ---------------------------------------------------------------------------
drop function if exists public.delete_my_runs(text);
create or replace function public.delete_my_runs(p_player text)
returns table (trace_id text)
language plpgsql as $$
begin
  delete from public.player_limits where player_id = p_player;
  return query delete from public.runs r where r.player_id = p_player returning r.trace_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- report_run sets the lock when it redacts, so the redaction sticks.
-- ---------------------------------------------------------------------------
create or replace function public.report_run(p_run uuid, p_reporter text, p_reason text)
returns table (reports int, redacted boolean)
language plpgsql as $$
declare v_owner text; v_verified boolean; n int; did boolean := false;
begin
  select r.player_id, r.verified into v_owner, v_verified from public.runs r where r.id = p_run;
  if v_owner is null then return query select 0::int, false; return; end if;
  if v_owner = p_reporter then return query select 0::int, false; return; end if;
  insert into public.reports (run_id, reporter_id, reason)
  values (p_run, p_reporter, coalesce(nullif(p_reason, ''), 'other'))
  on conflict (run_id, reporter_id) do nothing;
  select count(distinct reporter_id)::int into n from public.reports where run_id = p_run;
  if n >= 3 and not v_verified then
    update public.runs
       set player_name = 'REDACTED', name_locked = true, updated_at = now()
     where id = p_run and not name_locked;
    did := found;
  end if;
  return query select n, did;
end;
$$;

revoke execute on function public.rename_my_runs(text, text, int) from public, anon, authenticated;
revoke execute on function public.delete_my_runs(text)            from public, anon, authenticated;
revoke execute on function public.report_run(uuid, text, text)    from public, anon, authenticated;

-- TO MODERATE A NAME BY HAND (dashboard SQL editor) — set the lock, or the player
-- puts it straight back:
--   update public.runs set player_name = 'REDACTED', name_locked = true where id = '<row uuid>';
-- To release one you redacted in error:
--   update public.runs set name_locked = false where id = '<row uuid>';
