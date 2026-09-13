-- ---------------------------------------------------------------------------
-- Warp Vanguard — the write path trusts less (2026-09-08 audit, A1 A6 A7 A8).
--
-- FOUR THINGS, ONE MIGRATION, because three of them touch submit_verified_run
-- and a function's signature can only change once per push.
--
-- 1) THE BOSS TIE-BREAK STOPS TRUSTING THE PHONE (A1). Boss boards order equal
--    scores by time_sec asc. The verifier recomputed the score frame by frame and
--    then wrote the CLIENT's time beside it — one edited number won every boss
--    tie. The verifier now returns the run's clock (build-verifier.js) and the
--    Edge Function writes that; here the table refuses a negative time at all.
--
-- 2) A SUBMISSION BAR PER PLAYER (A6). Nothing throttled one identity, and each
--    verified submission replays up to 200 000 frames on the server. The bar is
--    taken BEFORE the replay, in one short transaction under an advisory lock,
--    so the expensive work is never spent on the caller who is over it. Thirty
--    in ten minutes: a LOSS files too (endLevel submits every ended lane), so a
--    player dying fast and restarting makes about fifteen; a script makes thousands.
--
-- 3) THE REPLAY-OWNER STAMP IS ATOMIC (A7). submit-run checked the frame hash,
--    wrote the row, then stamped the hash in a second statement — two concurrent
--    submissions of the same stolen trace both passed the check. The hash is a
--    parameter now, written with the row, and a partial UNIQUE index makes the
--    database refuse a second owner instead of a read-then-write.
--
-- 4) CHECK RULES THE FUNCTION CAPS ALREADY IMPLY (A8). The row is the last line
--    of defence and it had one rule (score >= 0).
--
-- THE TIE-BREAK ORDER DOES NOT CHANGE. leaderboard_top, leaderboard_rank and
-- the eviction below still agree byte for byte; only the insert gains a column.
-- Board keys are untouched: they are persisted ids.
-- ---------------------------------------------------------------------------

-- 4) rules on the row --------------------------------------------------------
-- Rows written under the old function carried the client's numbers unchecked;
-- a CHECK validates existing rows, so they are brought inside the rule first or
-- one bad row would roll back this whole file.
update public.runs set
  time_sec = greatest(0, time_sec), combo_sec = greatest(0, combo_sec),
  zaps = greatest(0, zaps), misses = greatest(0, misses), perfects = greatest(0, perfects),
  max_combo = greatest(0, max_combo), integrity = greatest(0, integrity),
  player_name = left(player_name, 14), mutators = mutators[1:8]
 where time_sec < 0 or combo_sec < 0 or zaps < 0 or misses < 0 or perfects < 0 or max_combo < 0
    or integrity < 0 or char_length(player_name) > 14 or cardinality(mutators) > 8;
alter table public.runs
  add constraint runs_time_nonneg   check (time_sec >= 0 and combo_sec >= 0),
  add constraint runs_stats_nonneg  check (zaps >= 0 and misses >= 0 and perfects >= 0 and max_combo >= 0 and integrity >= 0),
  add constraint runs_name_len      check (char_length(player_name) <= 14),
  add constraint runs_mutators_len  check (cardinality(mutators) <= 8);

alter table public.feedback
  add constraint feedback_ctx_len check (
    char_length(coalesce(error, ''))  <= 500 and char_length(coalesce(build, ''))  <= 120 and
    char_length(coalesce(device, '')) <= 120 and char_length(coalesce(screen, '')) <= 120 and
    char_length(coalesce(place, ''))  <= 120);

-- 3) one owner per trace ----------------------------------------------------
drop index if exists public.runs_trace_hash_idx;
create unique index if not exists runs_trace_hash_uq on public.runs (trace_hash) where trace_hash is not null;

-- 2) the submission bar ------------------------------------------------------
-- two columns on the ledger that already exists for the rename cooldown; the
-- same "one row per player, no profile" discipline. delete_my_runs takes the row.
alter table public.player_limits
  add column if not exists submit_since timestamptz,
  add column if not exists submit_n     int not null default 0;

-- Returns 0 when the caller may submit now (and counts the attempt), else the
-- seconds to wait. A fixed window: the first submission opens it, the thirtieth
-- inside it is the last, the next one waits for the window to close.
create or replace function public.take_submit_slot(p_player text, p_max int default 30, p_window_sec int default 600)
returns int
language plpgsql
set search_path = public, extensions as $$
declare v_since timestamptz; v_n int; v_age int;
begin
  perform pg_advisory_xact_lock(hashtext(p_player));
  select pl.submit_since, pl.submit_n into v_since, v_n
    from public.player_limits pl where pl.player_id = p_player;
  v_age := coalesce(floor(extract(epoch from (now() - v_since)))::int, p_window_sec);
  if v_since is null or v_age >= p_window_sec then
    insert into public.player_limits (player_id, submit_since, submit_n) values (p_player, now(), 1)
    on conflict (player_id) do update set submit_since = now(), submit_n = 1;
    return 0;
  end if;
  if v_n >= p_max then
    return greatest(1, p_window_sec - v_age);
  end if;
  update public.player_limits set submit_n = submit_n + 1 where player_id = p_player;
  return 0;
end;
$$;
revoke execute on function public.take_submit_slot(text, int, int) from public, anon, authenticated;

-- the two check-then-write bars that already existed race no more (A8)
create or replace function public.rename_my_runs(p_player text, p_name text, p_cooldown_sec int default 86400)
returns table (renamed int, locked int, wait_sec int)
language plpgsql
set search_path = public, extensions as $$
declare
  v_last timestamptz;
  v_wait int := 0;
  n_ren  int := 0;
  n_lock int := 0;
begin
  perform pg_advisory_xact_lock(hashtext(p_player));
  select pl.renamed_at into v_last from public.player_limits pl where pl.player_id = p_player;
  if v_last is not null then
    v_wait := greatest(0, p_cooldown_sec - floor(extract(epoch from (now() - v_last)))::int);
  end if;
  select count(*)::int into n_lock
    from public.runs r where r.player_id = p_player and r.name_locked;
  if v_wait > 0 then
    return query select 0, n_lock, v_wait; return;
  end if;
  update public.runs
     set player_name = coalesce(p_name, ''), updated_at = now()
   where player_id = p_player and not name_locked;
  get diagnostics n_ren = row_count;
  if n_ren > 0 then
    insert into public.player_limits (player_id, renamed_at) values (p_player, now())
    on conflict (player_id) do update set renamed_at = now();
  end if;
  return query select n_ren, n_lock, 0;
end;
$$;

create or replace function public.file_feedback(
  p_player   text,
  p_topic    text,
  p_body     text,
  p_build    text default null,
  p_device   text default null,
  p_screen   text default null,
  p_place    text default null,
  p_error    text default null
) returns table (filed boolean, dropped text)
language plpgsql
set search_path = public, extensions as $$
declare
  v_body  text;
  v_topic text;
  n_day   int;
begin
  perform pg_advisory_xact_lock(hashtext(p_player));
  v_body := left(btrim(coalesce(p_body, '')), 600);
  if v_body = '' then
    return query select false, 'empty'; return;
  end if;
  v_topic := coalesce(nullif(p_topic, ''), 'other');
  if v_topic not in ('bug', 'idea', 'balance', 'other') then v_topic := 'other'; end if;
  if exists (select 1 from public.feedback f
              where f.player_id = p_player and f.created_at > now() - interval '10 minutes') then
    return query select false, 'too soon'; return;
  end if;
  select count(*)::int into n_day from public.feedback f
   where f.player_id = p_player and f.created_at > now() - interval '24 hours';
  if n_day >= 5 then
    return query select false, 'daily cap'; return;
  end if;
  insert into public.feedback (player_id, topic, body, build, device, screen, place, error)
  values (p_player, v_topic, v_body, left(p_build, 120), left(p_device, 120), left(p_screen, 120), left(p_place, 120), left(p_error, 500));
  return query select true, null::text;
end;
$$;

-- 1) + 3) the write, with the hash on the row ---------------------------------
-- The signature gains p_trace_hash at the end, so the old one is dropped first:
-- CREATE OR REPLACE with a new parameter list would add an overload and leave
-- the old, anon-executable one in place.
drop function if exists public.submit_verified_run(text, int, text, text, int, int, real, int, int, int, text[], int, boolean, text, int, real, text);
create or replace function public.submit_verified_run(
  p_board text, p_day int, p_player text, p_name text, p_score int,
  p_max_combo int, p_time_sec real, p_integrity int, p_misses int, p_perfects int,
  p_mutators text[], p_seed int, p_verified boolean, p_trace_id text,
  p_zaps int default 0, p_combo_sec real default 0, p_run_id text default '',
  p_trace_hash text default null
) returns table (evicted_trace text)
language sql
set search_path = public, extensions as $$
  insert into public.runs as r
    (board, day, player_id, run_id, player_name, score, max_combo, combo_sec, time_sec,
     integrity, zaps, misses, perfects, mutators, seed, verified, trace_id, trace_hash)
  values
    (p_board, p_day, p_player, coalesce(p_run_id,''), coalesce(p_name,''), p_score, p_max_combo, p_combo_sec, p_time_sec,
     p_integrity, p_zaps, p_misses, p_perfects, coalesce(p_mutators,'{}'), p_seed, p_verified, p_trace_id, p_trace_hash)
  on conflict (board, (coalesce(day, -1)), player_id, run_id) do update set
    player_name = excluded.player_name,
    score      = case when (excluded.score, excluded.zaps, excluded.perfects) > (r.score, r.zaps, r.perfects) then excluded.score      else r.score      end,
    max_combo  = case when (excluded.score, excluded.zaps, excluded.perfects) > (r.score, r.zaps, r.perfects) then excluded.max_combo  else r.max_combo  end,
    combo_sec  = case when (excluded.score, excluded.zaps, excluded.perfects) > (r.score, r.zaps, r.perfects) then excluded.combo_sec  else r.combo_sec  end,
    time_sec   = case when (excluded.score, excluded.zaps, excluded.perfects) > (r.score, r.zaps, r.perfects) then excluded.time_sec   else r.time_sec   end,
    integrity  = case when (excluded.score, excluded.zaps, excluded.perfects) > (r.score, r.zaps, r.perfects) then excluded.integrity  else r.integrity  end,
    zaps       = case when (excluded.score, excluded.zaps, excluded.perfects) > (r.score, r.zaps, r.perfects) then excluded.zaps       else r.zaps       end,
    misses     = case when (excluded.score, excluded.zaps, excluded.perfects) > (r.score, r.zaps, r.perfects) then excluded.misses     else r.misses     end,
    perfects   = case when (excluded.score, excluded.zaps, excluded.perfects) > (r.score, r.zaps, r.perfects) then excluded.perfects   else r.perfects   end,
    mutators   = case when (excluded.score, excluded.zaps, excluded.perfects) > (r.score, r.zaps, r.perfects) then excluded.mutators   else r.mutators   end,
    seed       = case when (excluded.score, excluded.zaps, excluded.perfects) > (r.score, r.zaps, r.perfects) then excluded.seed       else r.seed       end,
    verified   = case when (excluded.score, excluded.zaps, excluded.perfects) > (r.score, r.zaps, r.perfects) then excluded.verified   else r.verified   end,
    trace_id   = case when (excluded.score, excluded.zaps, excluded.perfects) > (r.score, r.zaps, r.perfects) then excluded.trace_id   else r.trace_id   end,
    trace_hash = case when (excluded.score, excluded.zaps, excluded.perfects) > (r.score, r.zaps, r.perfects) then excluded.trace_hash else r.trace_hash end,
    updated_at = now();

  delete from public.runs d
   where d.board = p_board
     and coalesce(d.day, -1) = coalesce(p_day, -1)
     and d.id not in (
       select r2.id from public.runs r2
        where r2.board = p_board and coalesce(r2.day, -1) = coalesce(p_day, -1)
        order by r2.score desc, r2.zaps desc, r2.perfects desc,
                 (case when (p_board like '%:7' and p_board not like 'weekly:%') then r2.time_sec end) asc nulls last,
                 r2.created_at asc, r2.id asc
        limit 100
     )
  returning d.trace_id;
$$;
revoke execute on function public.submit_verified_run(text, int, text, text, int, int, real, int, int, int, text[], int, boolean, text, int, real, text, text)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- MY DATA TAKES THE BACKUP TOO (A4). runs_backup_20260902 kept 172 rows from 16
-- players after the pre-Play wipe, and delete_my_runs never looked at it. While
-- the table exists a delete clears the player from it; when it is dropped the
-- dynamic statement simply stops running.
-- ---------------------------------------------------------------------------
drop function if exists public.delete_my_runs(text);
create or replace function public.delete_my_runs(p_player text)
returns table (trace_id text)
language plpgsql
set search_path = public, extensions as $$
begin
  delete from public.player_limits where player_id = p_player;
  delete from public.reports       where reporter_id = p_player;
  delete from public.feedback      where player_id = p_player;
  if to_regclass('public.runs_backup_20260902') is not null then
    execute 'delete from public.runs_backup_20260902 where player_id = $1' using p_player;
  end if;
  return query delete from public.runs r where r.player_id = p_player returning r.trace_id;
end;
$$;
revoke execute on function public.delete_my_runs(text) from public, anon, authenticated;
comment on function public.delete_my_runs(text) is
  'MY DATA delete: removes the player''s runs (reports about them cascade), their '
  'rate-limit ledger, the reports they filed on other people, the feedback they '
  'sent, and their rows in the 2026-09-02 backup while it exists. Returns the trace '
  'keys of the deleted runs so the Edge Function can purge Storage. Service role only.';
