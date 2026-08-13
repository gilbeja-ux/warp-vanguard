-- Warp Vanguard — eviction stops leaking replays.
--
-- THE LEAK. Every board caps at 100 rows, and submit_verified_run enforces that by
-- deleting the surplus on every write. The row goes; the replay it pointed at does
-- not. Storage is a different system and Postgres cannot reach it, so the object
-- simply stays — for ever, referenced by nothing, reachable by nothing.
--
-- Measured before the pre-Play wipe: 337 trace objects against 228 rows that
-- pointed at one. A third of the bucket was already garbage, and the ratio only
-- goes one way — the busier a board gets, the more it evicts, and every eviction
-- adds a file that will never be read again.
--
-- THE FIX. The function already knows exactly which traces just became garbage: it
-- is deleting the rows that hold them. So it hands them back, and submit-run — which
-- called it, and does have Storage access — purges them. Same shape as
-- delete_my_runs, which has returned its trace keys for the same reason since it
-- was written.
--
-- Return type changes from void, so this drops first: `create or replace` cannot
-- change a function's result type.
drop function if exists public.submit_verified_run(
  text, int, text, text, int, int, real, int, int, int, text[], int, boolean, text, int, real, text
);
create or replace function public.submit_verified_run(
  p_board text, p_day int, p_player text, p_name text, p_score int,
  p_max_combo int, p_time_sec real, p_integrity int, p_misses int, p_perfects int,
  p_mutators text[], p_seed int, p_verified boolean, p_trace_id text,
  p_zaps int default 0, p_combo_sec real default 0, p_run_id text default ''
) returns table (evicted_trace text)
language sql as $$
  -- Insert this run. It only ever collides with ITSELF — same (board, day,
  -- player, run_id) — which is the rename re-submit, not a different run. On that
  -- collision the NAME adopts the latest submission, while the score/stats/trace
  -- only move when the resubmission is genuinely better under the SAME tie-break
  -- the board ranks by.
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

  -- Evict past the top 100 of this (board, day), and SAY WHAT WENT. The caller
  -- deletes these objects from Storage; a NULL comes back for an endless row,
  -- which never had a trace, and the caller filters those out.
  delete from public.runs d
   where d.board = p_board
     and coalesce(d.day, -1) = coalesce(p_day, -1)
     and d.id not in (
       select r2.id from public.runs r2
        where r2.board = p_board and coalesce(r2.day, -1) = coalesce(p_day, -1)
        order by r2.score desc, r2.zaps desc, r2.perfects desc, r2.created_at asc, r2.id asc
        limit 100
     )
  returning d.trace_id;
$$;

-- Unchanged: still not granted to anon. The Edge Function calls it with the
-- service role, which is what makes the write path enforceable at all.
