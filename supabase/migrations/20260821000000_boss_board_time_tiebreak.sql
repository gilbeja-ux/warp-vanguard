-- Warp Vanguard — H-02: on a BOSS board, the faster run wins a tie.
--
-- WHY. A boss duel has no natural end for a staller: the swarm respawns forever,
-- so a player who refuses to fire a pulse can farm it. The sim-side bounty decay
-- (bossStallMul, 52-bosses.js) is the real cap on that. This is the second, softer
-- guard the player asked for: among runs that tie on the board's own key
-- (score, then zaps, then perfects), the one that CLEARED THE BOSS FASTER ranks
-- first. It does not stop farming on its own — a higher score still wins — it just
-- rewards efficiency once scores are equal.
--
-- THE INVARIANT. The tie-break order is used IDENTICALLY in three places, or the
-- board contradicts itself (a row shown in the top 50 gets evicted, or a player's
-- reported rank disagrees with the list): leaderboard_top (display), leaderboard_rank
-- (a player's own standing), and submit_verified_run's eviction (which rows survive).
-- All three change together here. The client computes no rank of its own — it reads
-- these RPCs — so there is nothing to mirror in game code.
--
-- IDENTIFYING A BOSS BOARD IN SQL. A campaign board key is `<campId>:<0..7>` and the
-- boss is always level index 7 (the 8th and last level of every campaign). So the
-- five boss boards are exactly the keys ending in `:7` that are not weekly boards
-- (a `weekly:7` week also ends in `:7`). `endless` has no `:7`. If a campaign ever
-- stops ending on index 7, this predicate is what to revisit.
--
-- The term is `(case when <boss> then time_sec end) asc nulls last`. On a non-boss
-- board every row's CASE is NULL, so the term is constant and the order falls
-- through to created_at exactly as before — non-boss boards are byte-identical.
--
-- NO RETURN TYPES CHANGE, so these are plain `create or replace` (grants survive).
-- NOT TESTED against a live database here — the local harness cannot run these
-- functions. Review against staging, then apply with the release (supabase db push),
-- alongside the verifier deploy H-02 already needs.

-- 1) display ranking ---------------------------------------------------------
create or replace function public.leaderboard_top(p_board text, p_day int default null, p_limit int default 100)
returns table (
  rank int, id uuid, player_id text, player_name text, score int,
  max_combo int, combo_sec real, time_sec real, zaps int, misses int, perfects int,
  integrity int, verified boolean, trace_id text, created_at timestamptz
)
language sql stable as $$
  select rank() over (order by r.score desc, r.zaps desc, r.perfects desc,
           (case when (p_board like '%:7' and p_board not like 'weekly:%') then r.time_sec end) asc nulls last,
           r.created_at asc, r.id asc)::int as rank,
         r.id, r.player_id, r.player_name, r.score,
         r.max_combo, r.combo_sec, r.time_sec, r.zaps, r.misses, r.perfects,
         r.integrity, r.verified, r.trace_id, r.created_at
  from public.runs r
  where r.board = p_board
    and (r.day = p_day or (p_day is null and r.day is null))
  order by r.score desc, r.zaps desc, r.perfects desc,
           (case when (p_board like '%:7' and p_board not like 'weekly:%') then r.time_sec end) asc nulls last,
           r.created_at asc, r.id asc
  limit greatest(1, least(p_limit, 500));
$$;

-- 2) a player's own standing -------------------------------------------------
create or replace function public.leaderboard_rank(p_board text, p_day int, p_player text)
returns table (rank int, score int, total int)
language sql stable as $$
  with ranked as (
    select r.player_id, r.score,
           rank() over (order by r.score desc, r.zaps desc, r.perfects desc,
             (case when (p_board like '%:7' and p_board not like 'weekly:%') then r.time_sec end) asc nulls last,
             r.created_at asc, r.id asc)::int as rank
    from public.runs r
    where r.board = p_board and (r.day = p_day or (p_day is null and r.day is null))
  )
  select r.rank, r.score, (select count(*)::int from ranked) as total
  from ranked r where r.player_id = p_player
  order by r.rank asc
  limit 1;
$$;

-- 3) write path: same tie-break in the eviction, so display and survival agree
create or replace function public.submit_verified_run(
  p_board text, p_day int, p_player text, p_name text, p_score int,
  p_max_combo int, p_time_sec real, p_integrity int, p_misses int, p_perfects int,
  p_mutators text[], p_seed int, p_verified boolean, p_trace_id text,
  p_zaps int default 0, p_combo_sec real default 0, p_run_id text default ''
) returns table (evicted_trace text)
language sql as $$
  -- Insert this run. It only ever collides with ITSELF — same (board, day, player,
  -- run_id) — the rename re-submit. The NAME adopts the latest submission; the
  -- score/stats/trace only move when the resubmission is genuinely better under the
  -- board's tie-break. That gate stays a same-run comparison (a run cannot beat its
  -- own time), so the faster-run rule lives only in the cross-run eviction below.
  insert into public.runs as r
    (board, day, player_id, run_id, player_name, score, max_combo, combo_sec, time_sec,
     integrity, zaps, misses, perfects, mutators, seed, verified, trace_id)
  values
    (p_board, p_day, p_player, coalesce(p_run_id,''), coalesce(p_name,''), p_score, p_max_combo, p_combo_sec, p_time_sec,
     p_integrity, p_zaps, p_misses, p_perfects, coalesce(p_mutators,'{}'), p_seed, p_verified, p_trace_id)
  on conflict (board, (coalesce(day, -1)), player_id, run_id) do update set
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

  -- Evict past the top 100 of this (board, day), same tie-break as the read RPCs,
  -- and hand back the trace keys the caller must purge from Storage.
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
