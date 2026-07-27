-- Migration: add per-run detail stats (zaps + combo_sec) for the redesigned
-- leaderboard's details panel. Run ONCE in the Supabase SQL editor.
-- Idempotent: safe to run again. (schema.sql already carries these for fresh installs.)

-- 1) new columns (misses / perfects / max_combo already exist)
alter table public.runs add column if not exists zaps      int  not null default 0;
alter table public.runs add column if not exists combo_sec real not null default 0;

-- 2) leaderboard_top now returns the detail stats too. Its RETURN shape changed,
--    so it must be dropped before recreation.
drop function if exists public.leaderboard_top(text, int, int);
create function public.leaderboard_top(p_board text, p_day int default null, p_limit int default 100)
returns table (
  rank int, player_id text, player_name text, score int,
  max_combo int, combo_sec real, time_sec real, zaps int, misses int, perfects int,
  verified boolean, trace_id text, created_at timestamptz
)
language sql stable as $$
  select rank() over (order by r.score desc)::int as rank,
         r.player_id, r.player_name, r.score,
         r.max_combo, r.combo_sec, r.time_sec, r.zaps, r.misses, r.perfects,
         r.verified, r.trace_id, r.created_at
  from public.runs r
  where r.board = p_board
    and (r.day = p_day or (p_day is null and r.day is null))
  order by r.score desc
  limit greatest(1, least(p_limit, 500));
$$;
grant execute on function public.leaderboard_top(text, int, int) to anon, authenticated;

-- 3) submit_verified_run gains p_zaps + p_combo_sec. Drop the old 14-arg version
--    so there's no overload ambiguity, then recreate.
drop function if exists public.submit_verified_run(
  text, int, text, text, int, int, real, int, int, int, text[], int, boolean, text);
create function public.submit_verified_run(
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
    score = excluded.score, max_combo = excluded.max_combo, combo_sec = excluded.combo_sec, time_sec = excluded.time_sec,
    integrity = excluded.integrity, zaps = excluded.zaps, misses = excluded.misses, perfects = excluded.perfects,
    mutators = excluded.mutators, seed = excluded.seed, verified = excluded.verified,
    trace_id = excluded.trace_id, updated_at = now()
  where excluded.score > r.score;
$$;
