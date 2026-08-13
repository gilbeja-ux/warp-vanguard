-- Warp Vanguard — reporting a handle on a public board.
--
-- The display name is the ONLY user-generated content in this game, and it is
-- typed free-hand by strangers onto a screen other people read. submit-run
-- already filters it (and my-data re-filters it on rename), but a word list only
-- catches what it was told about: it cannot know that a handle is somebody's real
-- name, or that it is impersonating a player everyone on that board recognises.
-- Those two need a human, and getting them in front of a human needs a report.
--
-- Both stores require this separately from anything about deletion: Play's UGC
-- policy wants an in-app way to report objectionable content AND evidence that
-- reports are acted on; Apple 1.2 wants a filter, a report route, and a timely
-- response. The filter existed. This is the route.
--
-- WHAT THIS DELIBERATELY IS NOT: a cheating report. The verifier replays every
-- campaign and weekly run, so a `verified` row is provably legitimate and a
-- cheating report against one is noise that has to be explained away rather than
-- acted on. Endless is unseeded and unverifiable, so a report there could not be
-- adjudicated either. Mixing that traffic in would bury the reports that need a
-- human in ones that have no answer. This pipe carries the NAME.

create table if not exists public.reports (
  id          uuid primary key default gen_random_uuid(),
  -- ON DELETE CASCADE, deliberately: a report is about a row on a board, so it
  -- stops meaning anything the moment that row leaves. Rows leave constantly —
  -- submit_verified_run evicts past the top 100 every time someone posts — and a
  -- report pointing at an evicted run would be a permanent item in a queue with
  -- nothing at the other end of it. delete_my_runs cleans up through here too.
  run_id      uuid not null references public.runs(id) on delete cascade,
  reporter_id text not null,                  -- the REPORTER's player_id, from their JWT
  reason      text not null default 'other',  -- 'offensive' | 'personal' | 'impersonation' | 'other'
  created_at  timestamptz not null default now()
);

-- ONE report per person per row. Without this, three friends is not the threshold
-- below — one person tapping three times is, and the auto-action becomes a weapon
-- rather than a safety valve.
create unique index if not exists reports_run_reporter on public.reports (run_id, reporter_id);
create index if not exists reports_run on public.reports (run_id);
create index if not exists reports_created on public.reports (created_at desc);

-- RLS on with NO policies at all: no client role can read or write this table.
-- Reports are written by the Edge Function with the service role, and read by a
-- human in the Supabase dashboard. A player must not be able to see who reported
-- whom, or how close a row is to the threshold.
alter table public.reports enable row level security;

-- ---------------------------------------------------------------------------
-- File a report, and act on it if the bar is met.
--
-- THE BAR: three DISTINCT reporters, and only on an UNVERIFIED row. That split is
-- Gil's call and it is about what is at stake. A verified campaign or weekly run
-- is a record somebody earned and the board's whole promise is that it stands, so
-- an automatic action there is worth more to a brigade than it is to a moderator
-- — those queue for review instead. An endless row is trust-only and unreplayable,
-- so nothing is lost by resetting its name and restoring it later if the report
-- was bad faith.
--
-- The action is a REDACTION, never a deletion: the score, the rank, the replay and
-- the row all survive; only the name is neutralised, to the same 'REDACTED' that
-- submit-run's word filter uses, so the board speaks one vocabulary. The player
-- can put a name back themselves through MY DATA, which makes even a wrong
-- redaction an inconvenience rather than a loss.
--
-- Service-role only, like every other write here. `p_reporter` is an argument
-- rather than auth.uid() because the caller is the Edge Function holding the
-- reporter's verified JWT — which means an anon caller could forge one, hence the
-- revoke at the bottom.
-- ---------------------------------------------------------------------------
create or replace function public.report_run(p_run uuid, p_reporter text, p_reason text)
returns table (reports int, redacted boolean)
language plpgsql as $$
declare
  v_owner    text;
  v_verified boolean;
  n          int;
  did        boolean := false;
begin
  select r.player_id, r.verified into v_owner, v_verified
    from public.runs r where r.id = p_run;

  -- the row is gone (evicted past the top 100, or erased by its owner). Answer
  -- normally rather than erroring: from the reporter's side the report landed,
  -- and the thing they objected to is already off the board.
  if v_owner is null then
    return query select 0::int, false; return;
  end if;

  -- reporting yourself is accepted and dropped. The client hides the control on
  -- your own rows, so reaching here means a forged request — and the honest
  -- answer to that is to do nothing quietly, not to explain what was detected.
  if v_owner = p_reporter then
    return query select 0::int, false; return;
  end if;

  insert into public.reports (run_id, reporter_id, reason)
  values (p_run, p_reporter, coalesce(nullif(p_reason, ''), 'other'))
  on conflict (run_id, reporter_id) do nothing;   -- re-reporting is a no-op, not an error

  select count(distinct reporter_id)::int into n
    from public.reports where run_id = p_run;

  if n >= 3 and not v_verified then
    update public.runs
       set player_name = 'REDACTED', updated_at = now()
     where id = p_run and player_name <> 'REDACTED';
    did := found;
  end if;

  return query select n, did;
end;
$$;

revoke execute on function public.report_run(uuid, text, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- leaderboard_top gains the row's `id`, because a report has to name the row it
-- is about and nothing else in the payload identifies one: rank shifts as scores
-- land, player_id is not unique per row (a player may hold several), and
-- created_at is a tie-break rather than a key.
--
-- CREATE OR REPLACE cannot change a function's return type, so this drops first.
-- The client reads fields by name off the returned objects, so the extra column
-- is invisible to any build that does not ask for it.
-- ---------------------------------------------------------------------------
drop function if exists public.leaderboard_top(text, int, int);
create or replace function public.leaderboard_top(p_board text, p_day int default null, p_limit int default 100)
returns table (
  rank int, id uuid, player_id text, player_name text, score int,
  max_combo int, combo_sec real, time_sec real, zaps int, misses int, perfects int,
  verified boolean, trace_id text, created_at timestamptz
)
language sql stable as $$
  select rank() over (order by r.score desc, r.zaps desc, r.perfects desc, r.created_at asc, r.id asc)::int as rank,
         r.id, r.player_id, r.player_name, r.score,
         r.max_combo, r.combo_sec, r.time_sec, r.zaps, r.misses, r.perfects,
         r.verified, r.trace_id, r.created_at
  from public.runs r
  where r.board = p_board
    and (r.day = p_day or (p_day is null and r.day is null))
  order by r.score desc, r.zaps desc, r.perfects desc, r.created_at asc, r.id asc
  limit greatest(1, least(p_limit, 500));
$$;
grant execute on function public.leaderboard_top(text, int, int) to anon, authenticated;
