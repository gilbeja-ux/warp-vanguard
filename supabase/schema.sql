-- Warp Vanguard — leaderboard backend (Supabase / Postgres): THE BASE, NOT THE STATE.
--
-- On a fresh project run this ONCE in the SQL editor, then `supabase db push`:
-- the migrations in supabase/migrations/ start from these tables and replace
-- every function below (they `drop` and `create or replace` by signature). So
-- this file is the 2026-07 starting point that the migration chain assumes, and
-- it is NOT a picture of the live database — the boss tie-break, the replay-owner
-- column, the feedback error field, the submission bar and the closed grants all
-- live in the migrations. Read the newest migration for the current shape of any
-- function; never hand-edit a function here to "keep it in sync" (audit
-- 2026-09-08, A5: the copies had drifted three migrations behind, and a
-- `supabase db dump` needs Docker, which this Mac does not have). A copy that
-- runs AHEAD of the chain is worse than one behind it: a migration's `create or
-- replace` cannot change the result type of a function this file already made,
-- and the replay stops there (2026-10-20, submit_verified_run; `npm test`,
-- section THE FRESH PATH REPLAYS).
--
-- Model: ONE table. A "board" is just a `board` value — there is nothing to
-- pre-create (unlike LootLocker's 42 boards). Campaign boards are
-- '<campId>:<levelIdx>' (e.g. 'investigation:0'), plus 'endless' and one board per
-- WEEK of the ranked ladder: 'weekly:<weekIndex>', a Mon–Sun index (see weekOf()).
-- Keys match boardKey() in src/game/61-replay.js exactly.
--
-- A WEEK IS ITS OWN BOARD, deliberately. The predecessor was a single 'daily' board
-- partitioned by the `day` column, which meant every day shared one field, one
-- top-100 cap and one ranking. Giving each week its own board key means a finished
-- week keeps its own field untouched forever and a new week arrives beside it rather
-- than displacing anyone — which is the entire promise of the ladder: get on a
-- week's board and your name stays on it. Nothing expires it, and the Edge Function
-- refuses any submission whose week is not the live one.
--
-- `day` is therefore LEGACY: nothing writes it any more (every board writes NULL).
-- It stays because the coalesce(day,-1) unique key and the RPC signatures are built
-- on it, and dropping a column is not worth a migration for zero gain.

create extension if not exists "pgcrypto"; -- gen_random_uuid()

-- ---------------------------------------------------------------------------
-- One row per RUN. A player can hold several rows on the same board — every run
-- that makes the cut stands on its own, arcade-style; nothing is overwritten by
-- a later run. The row's identity is the client-minted `run_id`, so the ONLY
-- thing that reuses a row is a re-submit of that same run (the rename flow).
-- ---------------------------------------------------------------------------
create table if not exists public.runs (
  id          uuid primary key default gen_random_uuid(),
  board       text not null,                 -- boardKey(): 'investigation:0' | 'endless' | 'daily'
  day         int,                            -- daily: floor(epoch_seconds/86400); else NULL
  player_id   text not null,                  -- our identity.id (stable device handle / auth uid)
  run_id      text not null default '',       -- captureRun()'s per-run id — the row key (see index below)
  player_name text not null default '',
  score       int  not null check (score >= 0),
  max_combo   int  not null default 0,
  combo_sec   real not null default 0,          -- how long the record combo streak held (a run-detail stat)
  time_sec    real not null default 0,
  integrity   int  not null default 0,
  zaps        int  not null default 0,          -- interceptions (Hits = zaps / (zaps+misses))
  misses      int  not null default 0,
  perfects    int  not null default 0,
  mutators    text[] not null default '{}',   -- active mutator keys (they change scoring)
  seed        int,                            -- level index or day number; NULL for endless
  verified    boolean not null default false, -- true once the Edge Function replays & confirms
  trace_id    text,                           -- Storage object key for the replay; NULL if none
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- one row per (board, day, player, RUN). COALESCE folds the NULL day (non-daily
-- boards) into a single bucket so the constraint holds there too. run_id is in
-- the key, so a player's separate runs are separate rows and only a re-submit of
-- the SAME run (the rename flow) collides and updates in place. run_id is
-- scoped by player_id, so one player's id can never clobber another's row.
-- A client that sends no run_id lands on run_id='' — the old one-row-per-player
-- behaviour, which is the right fallback for a stale app build.
create unique index if not exists runs_board_day_player_run
  on public.runs (board, (coalesce(day, -1)), player_id, run_id);

-- fast "top N of a board" and "top N of a board on a given day"
create index if not exists runs_board_score      on public.runs (board, score desc);
create index if not exists runs_board_day_score   on public.runs (board, day, score desc);
-- a player's own rows on a board (leaderboard_rank scans these)
create index if not exists runs_board_player      on public.runs (board, player_id);

-- ---------------------------------------------------------------------------
-- Write lockdown (the anti-cheat lever). RLS on + PUBLIC READ + NO write policy
-- => anon/authenticated clients can read boards but CANNOT insert/update/delete.
-- The Edge Function verifier writes with the SERVICE ROLE key, which bypasses
-- RLS. So a score can only enter the table after the server has vetted it.
-- ---------------------------------------------------------------------------
alter table public.runs enable row level security;

drop policy if exists runs_public_read on public.runs;
create policy runs_public_read on public.runs
  for select using (true);
-- (intentionally no insert/update/delete policy: writes are service-role only)

-- ---------------------------------------------------------------------------
-- IDENTITY — anonymous, arcade-style. There is NO accounts/profiles table. The
-- stable owner of every run is the anonymous auth uid (player_id); the display
-- name is just a free-typed handle the player enters when they set a high score,
-- stored DENORMALIZED on the run row (runs.player_name). It's moderated at write
-- time by the Edge Function (blocklist + sanitize) — no uniqueness, no sign-in.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- Reads the client calls (via PostgREST RPC with the anon key).
-- ---------------------------------------------------------------------------

-- Top of a board (pass p_day for 'daily', NULL otherwise). Ranked with a window
-- function — exact "rank / of total" for free.
-- `id` is in the payload because a report has to name the row it is about, and
-- nothing else identifies one: rank shifts as scores land, player_id is not unique
-- per row, and created_at is a tie-break rather than a key. See reports, below.
create or replace function public.leaderboard_top(p_board text, p_day int default null, p_limit int default 100)
returns table (
  rank int, id uuid, player_id text, player_name text, score int,
  max_combo int, combo_sec real, time_sec real, zaps int, misses int, perfects int,
  integrity int, verified boolean, trace_id text, created_at timestamptz
)
-- Every run is listed (anonymous model — no profiles gate), including several
-- rows from the SAME player when they've set more than one record on the board.
-- The name shown is the run's own denormalized `player_name`. Only the top 100 rows per board are
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

-- A single player's standing on a board: their BEST row's score + rank, plus the
-- field size. A player may hold several rows (one per run), so this deliberately
-- returns ONE row — the highest-ranked of theirs. `total` is the whole field.
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

-- Where a run WOULD sit on a board — powers the "you made the top 50, enter your
-- handle" high-score check. No row is written; a pure read the client calls with a
-- provisional (score, zaps, perfects) before it decides to show the name-entry card.
-- Uses the SAME tie-break as the board: a row counts as ahead when its
-- (score, zaps, perfects) is >= the provisional tuple — the `>=` folds in exact
-- ties because the fresh run is newest (loses the created_at tie-break) and so
-- ranks below every equal-tuple row that already exists.
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

-- ---------------------------------------------------------------------------
-- THE ONLY WRITE PATH, submit_verified_run, is NOT REPEATED HERE. The Edge
-- Function calls it with the service role key AFTER it has verified the run, and
-- each verified run lands as its own row. It lives in migrations/ alone:
--   20260726000000  one row per RUN: p_run_id joins the signature
--   20260813000900  it hands back the trace keys it evicts, for submit-run to purge
--   20260821000000  a boss board's eviction breaks a tie on the faster clear
--   20260908000100  p_trace_hash, written with the row: one owner per trace
-- This file used to carry a copy, and the copy was the 2026-08-13 shape: the same
-- seventeen arguments the first migration creates, with a different result type.
-- `create or replace` cannot change a result type, so the fresh path stopped at
-- the first migration with "cannot change return type of existing function"
-- (found 2026-10-20, replaying this file and the whole chain on a scratch
-- database). With no copy, that migration's `drop function if exists` finds
-- nothing and its create is the first one.
-- ---------------------------------------------------------------------------

-- leaderboard_top / leaderboard_rank are safe for the anon role to execute;
-- submit_verified_run is NOT granted to anon (service role calls it directly).
grant execute on function public.leaderboard_top(text, int, int) to anon, authenticated;
grant execute on function public.leaderboard_rank(text, int, text) to anon, authenticated;
grant execute on function public.leaderboard_provisional_rank(text, int, int, int, int) to anon, authenticated;

-- GRANTS ARE WRITTEN, NEVER INHERITED. Since 2026-09-08 (migration grants_closed)
-- a new table or function in public starts with no rights for anon or
-- authenticated. From 2026-10-30 Supabase also stops granting service_role on
-- new public tables, views, sequences AND functions, on every project, in every
-- migration and in a local `supabase db reset`. A function a migration drops and
-- creates again is a new function, so it loses service_role's EXECUTE as well.
-- So a migration that creates or re-creates a table, view or function MUST carry
-- its own grants in the same file, after the create, or the Edge Functions get
-- "permission denied":
--   grant select, insert, update, delete on public.<table> to service_role;
--   grant select on public.<view> to service_role;
--   grant execute on function public.<fn>(<arg types>) to service_role;
--   grant select on public.<table> to anon, authenticated;   -- only if a
--   security-invoker read RPC needs it, as runs does. Never a write right.
-- migrations/20261020000000_service_role_grants.sql writes the whole table once,
-- and `npm test` (section SERVICE_ROLE GRANTS ARE WRITTEN) fails a chain where
-- the last create of an object has no service_role grant after it.

-- No name/account RPCs: the display name is a free-typed handle carried on each
-- run row and moderated by the submit-run Edge Function. There is no sign-in,
-- no uniqueness, and no profiles table (see the identity note near the top).

-- ---------------------------------------------------------------------------
-- THE PLAYER'S OWN DATA, and REPORTS on someone else's.
--
-- These live in migrations/ as their own files (20260813000000_my_data.sql and
-- 20260813000100_reports.sql) with the full reasoning; they are repeated here
-- because THIS file is the fresh-project path and a project built from it alone
-- would otherwise come up without them. Read the migrations for the why.
-- ---------------------------------------------------------------------------

-- A rename is guarded twice: it skips rows a moderator (or report_run's
-- threshold) has neutralised, and it is rate-limited to one a day. See
-- migrations/20260813000200_rename_guards.sql for the reasoning on both.
alter table public.runs add column if not exists name_locked boolean not null default false;
-- one timestamp per player and nothing else — a clock for the rate limit, NOT the
-- profiles table this schema keeps refusing to grow
create table if not exists public.player_limits (
  player_id  text primary key,
  renamed_at timestamptz
);
alter table public.player_limits enable row level security;  -- no policies: service role only

-- Rename every run a player holds, on every board (the handle is one handle,
-- denormalized onto every row). The FIRST rename is always free; the cooldown
-- starts only after one that changed something. Service-role only.
create or replace function public.rename_my_runs(p_player text, p_name text, p_cooldown_sec int default 86400)
returns table (renamed int, locked int, wait_sec int)
language plpgsql as $$
declare v_last timestamptz; v_wait int := 0; n_ren int := 0; n_lock int := 0;
begin
  select pl.renamed_at into v_last from public.player_limits pl where pl.player_id = p_player;
  if v_last is not null then
    v_wait := greatest(0, p_cooldown_sec - floor(extract(epoch from (now() - v_last)))::int);
  end if;
  select count(*)::int into n_lock from public.runs r where r.player_id = p_player and r.name_locked;
  if v_wait > 0 then return query select 0, n_lock, v_wait; return; end if;
  update public.runs set player_name = coalesce(p_name, ''), updated_at = now()
   where player_id = p_player and not name_locked;
  get diagnostics n_ren = row_count;
  if n_ren > 0 then
    insert into public.player_limits (player_id, renamed_at) values (p_player, now())
    on conflict (player_id) do update set renamed_at = now();
  end if;
  return query select n_ren, n_lock, 0;
end;
$$;

-- Erase every run a player holds, handing back the trace keys so the caller can
-- purge Storage too. Service-role only. Deliberately NOT blocked by name_locked:
-- erasing the row removes the offending name outright, so there is nothing left
-- to protect.
--
-- IT TAKES EVERY OTHER PLACE THE ID SURVIVES, and that list has grown twice since
-- this copy was first written — which is exactly the drift this file warns about
-- at the bottom. The ledger row went first; migrations/20260826000000 added the
-- reports the player FILED (reports.reporter_id has no foreign key, so nothing
-- cascaded it); migrations/20260901000000 added their feedback. The MIGRATIONS
-- ARE THE SOURCE OF TRUTH for this function. This copy exists so a fresh project
-- built from this file alone can still honour MY DATA, and it must be re-synced
-- whenever a new table learns a player_id.
create or replace function public.delete_my_runs(p_player text)
returns table (trace_id text)
language plpgsql as $$
begin
  delete from public.player_limits where player_id = p_player;
  delete from public.reports       where reporter_id = p_player;
  delete from public.feedback      where player_id = p_player;
  return query delete from public.runs r where r.player_id = p_player returning r.trace_id;
end;
$$;

-- Reports on a handle — the only user-generated content on a board. No client
-- role can read or write this table (RLS on, no policies).
create table if not exists public.reports (
  id          uuid primary key default gen_random_uuid(),
  run_id      uuid not null references public.runs(id) on delete cascade,
  reporter_id text not null,
  reason      text not null default 'other',
  created_at  timestamptz not null default now(),
  -- stamped when a moderator acted (or dismissed); NULL = still open. The report
  -- is kept either way — it is the record of why a name changed.
  handled_at  timestamptz
);
create unique index if not exists reports_run_reporter on public.reports (run_id, reporter_id);
create index if not exists reports_run     on public.reports (run_id);
create index if not exists reports_created on public.reports (created_at desc);
alter table public.reports enable row level security;

-- File a report; redact the name at 3 distinct reporters, UNVERIFIED rows only
-- (a verified run is a record someone earned — those queue for a human).
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
    -- name_locked is what makes the redaction STICK: without it the player puts
    -- the name straight back through MY DATA and moderation is theatre
    update public.runs set player_name = 'REDACTED', name_locked = true, updated_at = now()
     where id = p_run and not name_locked;
    did := found;
  end if;
  return query select n, did;
end;
$$;

-- In-game feedback — a private note to the developer. Repeated here for the same
-- reason `reports` is: delete_my_runs above erases a player's notes, so a project
-- built from this file alone needs the table to exist or MY DATA's delete fails
-- on its first call. Only the TABLE is here. file_feedback, mark_feedback_handled,
-- purge_old_feedback and the feedback_queue view live in
-- migrations/20260901000000_feedback.sql, which `supabase db push` installs, and
-- which carries the whole reasoning: why free text is safe on a private pipe, why
-- there is no reply address, and where the rate bar sits.
create table if not exists public.feedback (
  id          uuid primary key default gen_random_uuid(),
  player_id   text not null,        -- from the JWT, never the request body
  topic       text not null default 'other',
  body        text not null,
  build       text,                 -- app version + build stamp: which code ran
  device      text,                 -- a model name, never an identifier
  screen      text,                 -- 'W×H'
  place       text,                 -- a STAGE DISPLAY NAME, never a bare index
  created_at  timestamptz not null default now(),
  handled_at  timestamptz,          -- NULL = still open
  constraint feedback_topic_ok check (topic in ('bug', 'idea', 'balance', 'other')),
  constraint feedback_body_len check (char_length(body) between 1 and 600)
);
create index if not exists feedback_open    on public.feedback (created_at desc) where handled_at is null;
create index if not exists feedback_player  on public.feedback (player_id);
create index if not exists feedback_created on public.feedback (created_at desc);
alter table public.feedback enable row level security;  -- no policies: service role only

-- None of the three are reachable with the publishable key: they take the player
-- id as an argument (the Edge Functions pass it from a verified JWT), so an anon
-- caller could otherwise name anyone. Postgres grants EXECUTE to PUBLIC on new
-- functions by default — these revokes are the guard, not a formality.
revoke execute on function public.rename_my_runs(text, text, int) from public, anon, authenticated;
revoke execute on function public.delete_my_runs(text)            from public, anon, authenticated;
revoke execute on function public.report_run(uuid, text, text)    from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- THE MODERATION SURFACE — see docs/MODERATION.md.
-- `reports` alone is unusable for judging: it holds uuids, and the name you are
-- deciding about lives in `runs`. This view is that join, one row per reported
-- RUN. security_invoker keeps it as invisible as the table it reads.
-- ---------------------------------------------------------------------------
-- NOT REPEATED HERE, and that is the correction. This file carried its own copies
-- of report_queue, moderate_name and release_name, and within a single session all
-- three had drifted from the migrations: the view was missing player_id,
-- open_reports and handled_at, and moderate_name no longer closed the report it
-- acted on. Two copies of a function is two functions.
--
-- The MODERATION SURFACE therefore lives in migrations/ alone:
--   20260813000300  report_queue, moderate_name, release_name
--   20260813000700  handled_at, resolve_reports, moderate_player, rename_entry,
--                   reset_entry_name, dismiss_reports, the widened report_queue
--   20260813000800  the auto handle loses its dash
-- and the ADMIN views (admin_overview, board_occupancy, ladder_reach,
-- player_growth) in 20260813000400/000500/000600. `supabase db push` installs the
-- lot. THIS file alone is not a working backend: the write path and the
-- submission bar submit-run calls first are migrations too, so a fresh project is
-- this file THEN the chain, never this file alone. What they all mean is in
-- docs/MODERATION.md.

-- The ADMIN views (admin_overview, board_occupancy, ladder_reach, player_growth)
-- are NOT repeated here. They are read-only dashboard tooling, not something the
-- game needs to run, and a fresh project comes up perfectly well without them —
-- whereas keeping four aggregate views correct in two places is how the copies
-- drift apart. They live in migrations/20260813000400_admin_views.sql (and the
-- corrections in ...000500 and ...000600); `supabase db push` installs them.
-- What they mean, and what they cannot mean, is in docs/MODERATION.md.
