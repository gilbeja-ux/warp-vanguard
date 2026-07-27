-- Migration: accounts/profiles model → anonymous arcade name-entry.
-- Run once on the LIVE project (Supabase SQL editor or `supabase db push`).
-- Idempotent: safe to re-run. Pairs with the rewritten schema.sql.
--
-- What changes:
--   * the leaderboard reads stop joining `profiles` — EVERY run is listed, with
--     the free-typed handle stored on the run row (runs.player_name);
--   * submit_verified_run always adopts the latest name, keeps the best score,
--     and evicts everything past the top 100 per board;
--   * the sign-in surface is gone: profiles + name/account RPCs are dropped.
--
-- The board buffer is 100 (client shows 50). Old anonymous rows that were hidden
-- before (no profile) become visible with whatever name they were submitted under
-- ('Defender-XXXX' or blank → the client renders blank as 'ANON'). Wipe the board
-- afterwards if you want a clean slate.

-- ---------------------------------------------------------------------------
-- 1) Reads without the profiles join
-- ---------------------------------------------------------------------------
create or replace function public.leaderboard_top(p_board text, p_day int default null, p_limit int default 100)
returns table (
  rank int, player_id text, player_name text, score int,
  max_combo int, combo_sec real, time_sec real, zaps int, misses int, perfects int,
  verified boolean, trace_id text, created_at timestamptz
)
-- Tie-break order (used identically everywhere ranks are computed or rows are
-- evicted): higher score, then more hits (zaps), then more perfects, then the
-- EARLIER record (created_at), then id as a final absolute deterministic key.
language sql stable as $$
  select rank() over (order by r.score desc, r.zaps desc, r.perfects desc, r.created_at asc, r.id asc)::int as rank,
         r.player_id, r.player_name, r.score,
         r.max_combo, r.combo_sec, r.time_sec, r.zaps, r.misses, r.perfects,
         r.verified, r.trace_id, r.created_at
  from public.runs r
  where r.board = p_board
    and (r.day = p_day or (p_day is null and r.day is null))
  order by r.score desc, r.zaps desc, r.perfects desc, r.created_at asc, r.id asc
  limit greatest(1, least(p_limit, 500));
$$;

create or replace function public.leaderboard_rank(p_board text, p_day int, p_player text)
returns table (rank int, score int, total int)
language sql stable as $$
  with ranked as (
    select r.player_id, r.score,
           rank() over (order by r.score desc, r.zaps desc, r.perfects desc, r.created_at asc, r.id asc)::int as rank
    from public.runs r
    where r.board = p_board and (r.day = p_day or (p_day is null and r.day is null))
  )
  select r.rank, r.score, (select count(*)::int from ranked) as total
  from ranked r where r.player_id = p_player;
$$;

-- Same tie-break as the board: a row counts as ahead when its (score, zaps,
-- perfects) is >= the provisional tuple — the `>=` folds in exact ties because the
-- fresh run is newest (loses the created_at tie-break) and ranks below every
-- equal-tuple row that already exists.
drop function if exists public.leaderboard_provisional_rank(text, int, int);
create or replace function public.leaderboard_provisional_rank(
  p_board text, p_day int, p_score int, p_zaps int default 0, p_perfects int default 0
) returns table (rank int, total int)
language sql stable as $$
  select (1 + count(*) filter (
           where (r.score, r.zaps, r.perfects) >= (p_score, p_zaps, p_perfects)
         ))::int as rank,
         count(*)::int as total
  from public.runs r
  where r.board = p_board and (r.day = p_day or (p_day is null and r.day is null));
$$;

-- The provisional signature CHANGED (added p_zaps/p_perfects), so the old grant
-- was dropped with the old function — re-grant execute on the new signature.
grant execute on function public.leaderboard_provisional_rank(text, int, int, int, int) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2) Write path: always adopt latest name, keep best, evict past top 100
-- ---------------------------------------------------------------------------
create or replace function public.submit_verified_run(
  p_board text, p_day int, p_player text, p_name text, p_score int,
  p_max_combo int, p_time_sec real, p_integrity int, p_misses int, p_perfects int,
  p_mutators text[], p_seed int, p_verified boolean, p_trace_id text,
  p_zaps int default 0, p_combo_sec real default 0
) returns void
language sql as $$
  insert into public.runs as r
    (board, day, player_id, player_name, score, max_combo, combo_sec, time_sec,
     integrity, zaps, misses, perfects, mutators, seed, verified, trace_id)
  values
    (p_board, p_day, p_player, coalesce(p_name,''), p_score, p_max_combo, p_combo_sec, p_time_sec,
     p_integrity, p_zaps, p_misses, p_perfects, coalesce(p_mutators,'{}'), p_seed, p_verified, p_trace_id)
  on conflict (board, (coalesce(day, -1)), player_id) do update set
    player_name = excluded.player_name,
    score     = case when (excluded.score, excluded.zaps, excluded.perfects) > (r.score, r.zaps, r.perfects) then excluded.score     else r.score     end,
    max_combo = case when (excluded.score, excluded.zaps, excluded.perfects) > (r.score, r.zaps, r.perfects) then excluded.max_combo else r.max_combo end,
    combo_sec = case when (excluded.score, excluded.zaps, excluded.perfects) > (r.score, r.zaps, r.perfects) then excluded.combo_sec else r.combo_sec end,
    time_sec  = case when (excluded.score, excluded.zaps, excluded.perfects) > (r.score, r.zaps, r.perfects) then excluded.time_sec  else r.time_sec  end,
    integrity = case when (excluded.score, excluded.zaps, excluded.perfects) > (r.score, r.zaps, r.perfects) then excluded.integrity else r.integrity end,
    zaps      = case when (excluded.score, excluded.zaps, excluded.perfects) > (r.score, r.zaps, r.perfects) then excluded.zaps      else r.zaps      end,
    misses    = case when (excluded.score, excluded.zaps, excluded.perfects) > (r.score, r.zaps, r.perfects) then excluded.misses    else r.misses    end,
    perfects  = case when (excluded.score, excluded.zaps, excluded.perfects) > (r.score, r.zaps, r.perfects) then excluded.perfects  else r.perfects  end,
    mutators  = case when (excluded.score, excluded.zaps, excluded.perfects) > (r.score, r.zaps, r.perfects) then excluded.mutators  else r.mutators  end,
    seed      = case when (excluded.score, excluded.zaps, excluded.perfects) > (r.score, r.zaps, r.perfects) then excluded.seed      else r.seed      end,
    verified  = case when (excluded.score, excluded.zaps, excluded.perfects) > (r.score, r.zaps, r.perfects) then excluded.verified  else r.verified  end,
    trace_id  = case when (excluded.score, excluded.zaps, excluded.perfects) > (r.score, r.zaps, r.perfects) then excluded.trace_id  else r.trace_id  end,
    updated_at = now();

  delete from public.runs d
   where d.board = p_board
     and coalesce(d.day, -1) = coalesce(p_day, -1)
     and d.id not in (
       select r2.id from public.runs r2
        where r2.board = p_board and coalesce(r2.day, -1) = coalesce(p_day, -1)
        order by r2.score desc, r2.zaps desc, r2.perfects desc, r2.created_at asc, r2.id asc
        limit 100
     );
$$;

-- ---------------------------------------------------------------------------
-- 3) One-time eviction pass: enforce the 100-row cap on any existing overflow
--    (per board + day bucket). Uses the same deterministic ordering.
-- ---------------------------------------------------------------------------
delete from public.runs d
 where d.id not in (
   select id from (
     select r.id,
            row_number() over (
              partition by r.board, coalesce(r.day, -1)
              order by r.score desc, r.zaps desc, r.perfects desc, r.created_at asc, r.id asc
            ) as rn
     from public.runs r
   ) ranked
   where rn <= 100
 );

-- ---------------------------------------------------------------------------
-- 4) Tear down the accounts surface (profiles + name/account RPCs)
-- ---------------------------------------------------------------------------
drop function if exists public.claim_name(text);
drop function if exists public.delete_my_data();
drop function if exists public.check_name_available(text);
drop function if exists public.valid_operator_name(text);
drop table    if exists public.profiles cascade;
