-- Warp Vanguard — the board hands back the run's INTEGRITY, so RUN TIME can say
-- whether the run finished.
--
-- WHY THIS COLUMN AND NOT A `win` FLAG. The runs table never recorded whether a
-- run was won; captureRun knows it, but submit_verified_run was never given it.
-- It does not have to be. A run ends in exactly one of two places: the lane's
-- duration runs out with the bore clear (a win), or integrity reaches zero (a
-- loss) — see the two calls in src/game/72-tick.js. There is no third exit, so
-- `integrity > 0` IS the win flag, already stored on every row since the table
-- was written, and already recomputed by the verifier rather than claimed by
-- the client. Adding a column would store a second copy of a fact we hold.
--
-- Endless and weekly runs only ever end at zero integrity, which is why the
-- board does not colour their run time: there is nothing to complete.
--
-- The return type changes, so this drops first — `create or replace` cannot
-- change a function's result type. Same reason as 20260813000900.
drop function if exists public.leaderboard_top(text, int, int);
create or replace function public.leaderboard_top(p_board text, p_day int default null, p_limit int default 100)
returns table (
  rank int, id uuid, player_id text, player_name text, score int,
  max_combo int, combo_sec real, time_sec real, zaps int, misses int, perfects int,
  integrity int, verified boolean, trace_id text, created_at timestamptz
)
-- Unchanged from schema.sql apart from the added column. Every run is listed
-- (anonymous model — no profiles gate), including several rows from the SAME
-- player when they've set more than one record on the board. The name shown is
-- the run's own denormalized `player_name`. Only the top 100 rows per board are
-- ever kept (submit_verified_run evicts the rest), and the client asks for the
-- top 50 — the 51-100 buffer backfills the visible board if a row is removed.
-- Tie-break order (used identically everywhere ranks are computed or rows are
-- evicted): higher score, then more hits (zaps), then more perfects, then the
-- EARLIER record (created_at), then id as a final absolute deterministic key.
language sql stable as $$
  select rank() over (order by r.score desc, r.zaps desc, r.perfects desc, r.created_at asc, r.id asc)::int as rank,
         r.id, r.player_id, r.player_name, r.score,
         r.max_combo, r.combo_sec, r.time_sec, r.zaps, r.misses, r.perfects,
         r.integrity, r.verified, r.trace_id, r.created_at
  from public.runs r
  where r.board = p_board
    and (r.day = p_day or (p_day is null and r.day is null))
  order by r.score desc, r.zaps desc, r.perfects desc, r.created_at asc, r.id asc
  limit greatest(1, least(p_limit, 500));
$$;

-- The drop took the grant with it, so it is re-issued. Still anon-executable:
-- reading a public board needs no identity.
grant execute on function public.leaderboard_top(text, int, int) to anon, authenticated;
