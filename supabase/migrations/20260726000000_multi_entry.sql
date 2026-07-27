-- Applied copy of supabase/migrate-multi-entry.sql (see that file for the full
-- rationale). Kept here so `supabase db push` can apply it to the linked project.

-- Migration: one-row-per-player → one-row-per-RUN (multiple entries per player).
-- Run once on the LIVE project (Supabase SQL editor or `supabase db push`).
-- Idempotent: safe to re-run. Pairs with the updated schema.sql.
--
-- What changes:
--   * a player can now hold SEVERAL rows on the same board — each finished run
--     that makes the cut stands on its own and is never overwritten by a later
--     run (the old upsert kept only their best);
--   * a new `run_id` column carries the client's per-run id (captureRun()) and
--     becomes part of the row key, so the ONLY thing that reuses a row is a
--     re-submit of that same run — i.e. the "type your handle" rename flow;
--   * leaderboard_rank returns the player's BEST row (they may match several).
--
-- Existing rows keep run_id = '' and stay exactly where they are. A stale app
-- build that sends no run_id also lands on '' and keeps the old
-- one-row-per-player behaviour, so nothing breaks mid-rollout.
--
-- The top-100 cap per (board, day) is unchanged, but it now counts ROWS rather
-- than players: a player's own weaker run is evicted like anyone else's.

-- ---------------------------------------------------------------------------
-- 1) The run_id column + the new row key
-- ---------------------------------------------------------------------------
alter table public.runs add column if not exists run_id text not null default '';

-- Drop the old one-row-per-player key and key rows by run instead. It is dropped
-- BY SHAPE, not by name: any unique index/constraint on runs that does NOT
-- mention run_id is a legacy one-row-per-player key, and leaving one behind is
-- the whole bug — the new index would exist while the old one still rejects a
-- player's second run (or silently collapses it). The primary key is exempt.
do $$
declare r record;
begin
  -- unique CONSTRAINTS first (dropping their index directly is not allowed)
  for r in
    select con.conname
      from pg_constraint con
      join pg_class t on t.oid = con.conrelid
      join pg_namespace n on n.oid = t.relnamespace
     where n.nspname = 'public' and t.relname = 'runs' and con.contype = 'u'
       and pg_get_constraintdef(con.oid) not like '%run_id%'
  loop
    execute format('alter table public.runs drop constraint %I', r.conname);
  end loop;
  -- then plain unique INDEXes (this is what schema.sql has always created)
  for r in
    select c.relname
      from pg_index x
      join pg_class c on c.oid = x.indexrelid
      join pg_class t on t.oid = x.indrelid
      join pg_namespace n on n.oid = t.relnamespace
     where n.nspname = 'public' and t.relname = 'runs'
       and x.indisunique and not x.indisprimary
       and pg_get_indexdef(x.indexrelid) not like '%run_id%'
  loop
    execute format('drop index public.%I', r.relname);
  end loop;
end $$;

-- Every existing row has run_id = '' and there is at most one row per
-- (board, day, player) today, so the new index builds without a conflict.
create unique index if not exists runs_board_day_player_run
  on public.runs (board, (coalesce(day, -1)), player_id, run_id);

-- a player's own rows on a board (leaderboard_rank scans these)
create index if not exists runs_board_player on public.runs (board, player_id);

-- ---------------------------------------------------------------------------
-- 2) leaderboard_rank: a player may match several rows — return their best
-- ---------------------------------------------------------------------------
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
  from ranked r where r.player_id = p_player
  order by r.rank asc
  limit 1;
$$;

-- ---------------------------------------------------------------------------
-- 3) Write path: insert per run, collide only with the same run (rename)
-- ---------------------------------------------------------------------------
-- The signature gained p_run_id. `create or replace` with a DIFFERENT parameter
-- list would ADD an overload rather than replace, leaving the old
-- one-row-per-player function callable and the RPC ambiguous — so drop it first.
drop function if exists public.submit_verified_run(
  text, int, text, text, int, int, real, int, int, int, text[], int, boolean, text, int, real
);

create or replace function public.submit_verified_run(
  p_board text, p_day int, p_player text, p_name text, p_score int,
  p_max_combo int, p_time_sec real, p_integrity int, p_misses int, p_perfects int,
  p_mutators text[], p_seed int, p_verified boolean, p_trace_id text,
  p_zaps int default 0, p_combo_sec real default 0, p_run_id text default ''
) returns void
language sql as $$
  -- Insert this run. It only ever collides with ITSELF — same (board, day,
  -- player, run_id) — which is the rename re-submit, not a different run. On that
  -- collision the NAME adopts the latest submission (the freshly-typed handle),
  -- while the score/stats/trace only move when the resubmission is genuinely
  -- better under the SAME tie-break the board ranks by (CASE-gated, so a rename
  -- can never downgrade the stored run). created_at is left untouched.
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

  -- Evict past the top 100 of this (board, day) — same deterministic tie-break
  -- as leaderboard_top. The cap counts ROWS, not players.
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

-- submit_verified_run stays service-role only (never granted to anon), so the
-- dropped-and-recreated function needs no re-grant. The read RPCs are unchanged.
