-- ---------------------------------------------------------------------------
-- Warp Vanguard — PLAY STATISTICS. First-party, small, and never in the way.
-- Written 2026-11-05 for the traction portal (scripts/traction.html on the admin
-- console, port 8200), on Gil's request for "downloads, users, playtimes,
-- progress, OSes, and everything you can think of".
--
-- WHY THIS EXISTS. Until now every number the developer had was the residue of
-- the leaderboard, read sideways (see 20260813000400_admin_views.sql): auth.users
-- counted only the players who touched a board, `runs` capped every board at 100
-- rows, and nothing at all saw a stage that was flown and lost. This adds the
-- three facts a leaderboard cannot give: how long people play, how far they get,
-- and on what.
--
-- THE LIST IS CLOSED, AND IT IS SHORT:
--   telemetry_sessions  one row per app session: when it started, how long the
--                       game was on screen, the platform, the OS version, the
--                       device model, the app version, the locale.
--   telemetry_attempts  one row per stage attempt: mode, contract, stage index,
--                       result, seconds flown, score, LANE ASSIST.
--   telemetry_events    one row per named event, from track(name, props) in
--                       src/game/34-telemetry.js: a fault the error net caught, a
--                       submit outcome, and the tutorial and paywall events the
--                       sessions that build those add later.
-- Nothing else. No advertising id, no device id, no IP column, no free text, no
-- third-party SDK, and nothing leaves this project. A row names a device MODEL —
-- a name millions of devices share — never a device.
--
-- THE IDENTITY IS THE ONE THAT ALREADY EXISTS. player_id is the anonymous
-- Supabase user the leaderboard has always used, taken from the caller's JWT
-- inside telemetry_ingest (auth.uid()) and NEVER from the request body — the same
-- law submit-run, my-data, report-run and send-feedback follow.
--
-- ERASURE IS STRUCTURAL. Every row references auth.users(id) ON DELETE CASCADE,
-- so the last step of MY DATA's delete (my-data deletes the auth user) takes
-- every statistic with it, and so does any admin delete of an identity. my-data
-- also deletes these rows by name before it deletes the user, so a failed user
-- delete still leaves no statistics behind.
--
-- THE LEGAL BASIS IS THE SAME LEGITIMATE INTEREST privacy.html declares for the
-- leaderboard (Art. 6(1)(f)), never consent: aggregate statistics about how a
-- game is played are a compatible statistical purpose (Art. 5(1)(b)). The
-- portal reads these tables only in aggregate. Keep it aggregate.
--
-- THE WRITE PATH IS A NARROW RPC, NOT AN EDGE FUNCTION. A batch is three arrays
-- of short rows; validating them is plain SQL, and an RPC costs no function
-- invocation, no cold start, and no deploy beyond this migration. The function
-- is SECURITY DEFINER because the tables grant the client roles nothing at all:
-- the function is the only door, and it checks every field before it writes.
--
-- THE RATE BAR: 60 calls and 3000 rows per identity per hour, and 300 rows per
-- call. A healthy client sends about one call per five minutes of play.
-- ---------------------------------------------------------------------------

create table if not exists public.telemetry_sessions (
  id           uuid primary key,                 -- crypto.randomUUID() on the device
  player_id    uuid not null references auth.users (id) on delete cascade,
  started_at   timestamptz not null,
  fg_sec       integer not null default 0,       -- seconds the game was on screen
  platform     text not null,                    -- Capacitor.getPlatform(): android | ios | web
  channel      text not null,                    -- store (a shipped shell) | web | dev
  os           text,                             -- 'Android 16' · 'iOS 18.7'
  model        text,                             -- 'SM-S928B' · 'Pixel 9a' · 'iPhone'
  app_version  text,                             -- package.json version, build-stamped
  locale       text,                             -- navigator.language: 'en-GB'
  received_at  timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint telemetry_sessions_fg   check (fg_sec between 0 and 86400),
  constraint telemetry_sessions_plat check (platform in ('android', 'ios', 'web')),
  constraint telemetry_sessions_chan check (channel in ('store', 'web', 'dev')),
  constraint telemetry_sessions_len  check (char_length(coalesce(os, '')) <= 24
    and char_length(coalesce(model, '')) <= 40 and char_length(coalesce(app_version, '')) <= 16
    and char_length(coalesce(locale, '')) <= 16)
);
create index if not exists telemetry_sessions_player_idx  on public.telemetry_sessions (player_id);
create index if not exists telemetry_sessions_started_idx on public.telemetry_sessions (started_at);

create table if not exists public.telemetry_attempts (
  id           uuid primary key,
  -- no foreign key to the session: a row is kept even when its session row was
  -- refused, and the player's own foreign key below is what erasure follows
  session_id   uuid,
  player_id    uuid not null references auth.users (id) on delete cascade,
  at           timestamptz not null,             -- when the attempt began
  mode         text not null,                    -- campaign | weekly | endless | qual | drill
  camp_id      text,                             -- the contract id, campaign mode only
  level_idx    smallint,                         -- ZERO-BASED, code only; the portal prints lvNum(levelNo(ci, li))
  week         integer,                          -- the weekly lane's week index
  result       text not null,                    -- clear | fail | quit
  dur_sec      real not null default 0,          -- levelT: seconds flown, pauses excluded
  score        integer not null default 0,
  assist       boolean not null default false,   -- LANE ASSIST eased the lane
  received_at  timestamptz not null default now(),
  constraint telemetry_attempts_mode   check (mode in ('campaign', 'weekly', 'endless', 'qual', 'drill')),
  constraint telemetry_attempts_result check (result in ('clear', 'fail', 'quit')),
  constraint telemetry_attempts_dur    check (dur_sec >= 0 and dur_sec <= 7200),
  constraint telemetry_attempts_score  check (score >= 0),
  constraint telemetry_attempts_level  check (level_idx is null or level_idx between 0 and 199),
  constraint telemetry_attempts_camp   check (char_length(coalesce(camp_id, '')) <= 32)
);
create index if not exists telemetry_attempts_player_idx on public.telemetry_attempts (player_id);
create index if not exists telemetry_attempts_at_idx     on public.telemetry_attempts (at);

create table if not exists public.telemetry_events (
  id           uuid primary key,
  session_id   uuid,
  player_id    uuid not null references auth.users (id) on delete cascade,
  at           timestamptz not null,
  name         text not null,
  props        jsonb not null default '{}'::jsonb,
  received_at  timestamptz not null default now(),
  -- a name is a short dotted slug ('fault', 'submit', 'tutorial.part'), never a sentence
  constraint telemetry_events_name  check (name ~ '^[a-z][a-z0-9_.]{1,39}$'),
  -- props is one flat object of at most twelve short values; the client trims to this
  constraint telemetry_events_props check (jsonb_typeof(props) = 'object' and octet_length(props::text) <= 1024)
);
create index if not exists telemetry_events_player_idx on public.telemetry_events (player_id);
create index if not exists telemetry_events_at_idx     on public.telemetry_events (at);

-- the rate bar's ledger: one row per identity, a one-hour window
create table if not exists public.telemetry_quota (
  player_id    uuid primary key references auth.users (id) on delete cascade,
  since        timestamptz not null default now(),
  calls        integer not null default 0,
  rows_in      integer not null default 0
);

-- NOBODY BUT THE SERVICE ROLE READS THESE, AND NOBODY WRITES THEM BUT THE FUNCTION.
-- RLS on with no policy at all: the publishable key that ships in the game reaches
-- no row, even if a grant is ever added by mistake.
alter table public.telemetry_sessions enable row level security;
alter table public.telemetry_attempts enable row level security;
alter table public.telemetry_events   enable row level security;
alter table public.telemetry_quota    enable row level security;
revoke all on public.telemetry_sessions from public, anon, authenticated;
revoke all on public.telemetry_attempts from public, anon, authenticated;
revoke all on public.telemetry_events   from public, anon, authenticated;
revoke all on public.telemetry_quota    from public, anon, authenticated;
grant all on table public.telemetry_sessions to service_role;
grant all on table public.telemetry_attempts to service_role;
grant all on table public.telemetry_events   to service_role;
grant all on table public.telemetry_quota    to service_role;

-- ---------------------------------------------------------------------------
-- THE DOOR. One call carries { s: [sessions], a: [attempts], e: [events] }.
--
-- Field names are short because the batch rides a keepalive request on a phone
-- that is being put away (64 KB limit). Times are epoch MILLISECONDS, not ISO
-- strings: a number is checked by one regex and cast without any chance of a
-- parse error, so a bad row is DROPPED and never fails the whole call.
--
-- A row is dropped, not refused, when it is malformed or out of the window (35
-- days back, one day ahead). The client deletes what it sent on any `ok`, so a
-- dropped row is never retried for ever.
--
-- A session row is an UPSERT: the client re-sends the live session with a longer
-- fg_sec at every flush, and the larger value wins. The update is bound to the
-- row's own player, so one identity can never write into another's session.
-- ---------------------------------------------------------------------------
create or replace function public.telemetry_ingest(p_batch jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions as $$
declare
  v_player uuid := auth.uid();
  v_now    timestamptz := now();
  v_lo     bigint := floor(extract(epoch from (now() - interval '35 days')) * 1000)::bigint;
  v_hi     bigint := floor(extract(epoch from (now() + interval '1 day')) * 1000)::bigint;
  v_rows   int;
  v_since  timestamptz;
  v_calls  int;
  v_in     int;
  n_s int := 0; n_a int := 0; n_e int := 0;
  c_uuid constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
begin
  if v_player is null then
    return jsonb_build_object('ok', false, 'error', 'not authenticated');
  end if;
  if p_batch is null or jsonb_typeof(p_batch) <> 'object' then
    return jsonb_build_object('ok', false, 'error', 'bad batch');
  end if;
  v_rows := (case when jsonb_typeof(p_batch->'s') = 'array' then jsonb_array_length(p_batch->'s') else 0 end)
          + (case when jsonb_typeof(p_batch->'a') = 'array' then jsonb_array_length(p_batch->'a') else 0 end)
          + (case when jsonb_typeof(p_batch->'e') = 'array' then jsonb_array_length(p_batch->'e') else 0 end);
  if v_rows > 300 then
    return jsonb_build_object('ok', false, 'error', 'batch too big');
  end if;

  -- the rate bar, under the same per-identity advisory lock the submit bar uses
  perform pg_advisory_xact_lock(hashtext('telemetry:' || v_player::text));
  select q.since, q.calls, q.rows_in into v_since, v_calls, v_in
    from public.telemetry_quota q where q.player_id = v_player;
  if v_since is null or v_since < v_now - interval '1 hour' then
    insert into public.telemetry_quota (player_id, since, calls, rows_in) values (v_player, v_now, 0, 0)
    on conflict (player_id) do update set since = excluded.since, calls = 0, rows_in = 0;
    v_since := v_now; v_calls := 0; v_in := 0;
  end if;
  if v_calls >= 60 or v_in + v_rows > 3000 then
    return jsonb_build_object('ok', false, 'error', 'rate',
      'wait', greatest(1, ceil(extract(epoch from (v_since + interval '1 hour' - v_now))))::int);
  end if;
  update public.telemetry_quota set calls = calls + 1, rows_in = rows_in + v_rows where player_id = v_player;

  -- sessions: one row per id in this batch (an upsert cannot touch a row twice)
  with src as (
    select distinct on (x->>'id') x
      from jsonb_array_elements(case when jsonb_typeof(p_batch->'s') = 'array' then p_batch->'s' else '[]'::jsonb end) x
     where jsonb_typeof(x) = 'object'
       and (x->>'id') ~ c_uuid
       and (x->>'t') ~ '^[0-9]{13}$' and (x->>'t')::bigint between v_lo and v_hi
       and (x->>'p') in ('android', 'ios', 'web')
       and (x->>'ch') in ('store', 'web', 'dev')
     order by x->>'id'
  ), up as (
    insert into public.telemetry_sessions as t
      (id, player_id, started_at, fg_sec, platform, channel, os, model, app_version, locale)
    select (x->>'id')::uuid, v_player, to_timestamp((x->>'t')::bigint / 1000.0),
           case when (x->>'fg') ~ '^[0-9]{1,5}$' then least((x->>'fg')::int, 86400) else 0 end,
           x->>'p', x->>'ch',
           nullif(left(coalesce(x->>'os', ''), 24), ''), nullif(left(coalesce(x->>'m', ''), 40), ''),
           nullif(left(coalesce(x->>'v', ''), 16), ''), nullif(left(coalesce(x->>'l', ''), 16), '')
      from src
    on conflict (id) do update
      set fg_sec = greatest(t.fg_sec, excluded.fg_sec), updated_at = now()
      where t.player_id = excluded.player_id
    returning 1
  ) select count(*) into n_s from up;

  -- attempts: write once; a retried batch meets its own ids and moves on
  with src as (
    select distinct on (x->>'id') x
      from jsonb_array_elements(case when jsonb_typeof(p_batch->'a') = 'array' then p_batch->'a' else '[]'::jsonb end) x
     where jsonb_typeof(x) = 'object'
       and (x->>'id') ~ c_uuid
       and ((x->>'sid') is null or (x->>'sid') ~ c_uuid)
       and (x->>'t') ~ '^[0-9]{13}$' and (x->>'t')::bigint between v_lo and v_hi
       and (x->>'mo') in ('campaign', 'weekly', 'endless', 'qual', 'drill')
       and (x->>'r') in ('clear', 'fail', 'quit')
     order by x->>'id'
  ), ins as (
    insert into public.telemetry_attempts
      (id, session_id, player_id, at, mode, camp_id, level_idx, week, result, dur_sec, score, assist)
    select (x->>'id')::uuid, (x->>'sid')::uuid, v_player, to_timestamp((x->>'t')::bigint / 1000.0),
           x->>'mo',
           nullif(left(coalesce(x->>'c', ''), 32), ''),
           case when (x->>'li') ~ '^[0-9]{1,3}$' and (x->>'li')::int < 200 then (x->>'li')::smallint end,
           case when (x->>'w') ~ '^[0-9]{1,6}$' then (x->>'w')::int end,
           x->>'r',
           case when (x->>'d') ~ '^[0-9]{1,4}(\.[0-9]{1,3})?$' then least((x->>'d')::real, 7200) else 0 end,
           case when (x->>'sc') ~ '^[0-9]{1,9}$' then (x->>'sc')::int else 0 end,
           coalesce(x->>'as', '') = 'true'
      from src
    on conflict (id) do nothing
    returning 1
  ) select count(*) into n_a from ins;

  -- events: a slug and one flat object of at most twelve keys
  with src as (
    select distinct on (x->>'id') x
      from jsonb_array_elements(case when jsonb_typeof(p_batch->'e') = 'array' then p_batch->'e' else '[]'::jsonb end) x
     where jsonb_typeof(x) = 'object'
       and (x->>'id') ~ c_uuid
       and ((x->>'sid') is null or (x->>'sid') ~ c_uuid)
       and (x->>'t') ~ '^[0-9]{13}$' and (x->>'t')::bigint between v_lo and v_hi
       and (x->>'n') ~ '^[a-z][a-z0-9_.]{1,39}$'
       and (x->'pr' is null or (jsonb_typeof(x->'pr') = 'object' and octet_length((x->'pr')::text) <= 1024
            and (select count(*) from jsonb_object_keys(x->'pr')) <= 12))
     order by x->>'id'
  ), ins as (
    insert into public.telemetry_events (id, session_id, player_id, at, name, props)
    select (x->>'id')::uuid, (x->>'sid')::uuid, v_player, to_timestamp((x->>'t')::bigint / 1000.0),
           x->>'n', coalesce(x->'pr', '{}'::jsonb)
      from src
    on conflict (id) do nothing
    returning 1
  ) select count(*) into n_e from ins;

  return jsonb_build_object('ok', true, 's', n_s, 'a', n_a, 'e', n_e);
end;
$$;
-- the client roles reach the function and nothing else; anon never (an anonymous
-- SIGN-IN still carries the authenticated role, so a player with no session yet
-- mints one through lbSession() before the first flush)
revoke execute on function public.telemetry_ingest(jsonb) from public, anon;
grant execute on function public.telemetry_ingest(jsonb) to authenticated;
grant execute on function public.telemetry_ingest(jsonb) to service_role;
comment on function public.telemetry_ingest(jsonb) is
  'The one write path for play statistics. Identity from auth.uid(), never the body; drops malformed rows; 60 calls / 3000 rows per identity per hour.';

-- ---------------------------------------------------------------------------
-- RETENTION: thirteen months, then gone. privacy.html states it, and this is the
-- implementation. Thirteen, not twelve, so a month can be read against the same
-- month a year earlier. The admin console runs it at most once a day while the
-- traction page is open (scripts/admin.js); it can also be run by hand:
--   select public.purge_old_telemetry();
-- ---------------------------------------------------------------------------
create or replace function public.purge_old_telemetry(p_days int default 400)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions as $$
declare n_s int; n_a int; n_e int; n_q int;
begin
  delete from public.telemetry_sessions where started_at < now() - make_interval(days => p_days);
  get diagnostics n_s = row_count;
  delete from public.telemetry_attempts where at < now() - make_interval(days => p_days);
  get diagnostics n_a = row_count;
  delete from public.telemetry_events where at < now() - make_interval(days => p_days);
  get diagnostics n_e = row_count;
  delete from public.telemetry_quota where since < now() - interval '2 days';
  get diagnostics n_q = row_count;
  return jsonb_build_object('sessions', n_s, 'attempts', n_a, 'events', n_e, 'quota', n_q);
end;
$$;
revoke execute on function public.purge_old_telemetry(int) from public, anon, authenticated;
grant execute on function public.purge_old_telemetry(int) to service_role;

comment on table public.telemetry_sessions is
  'One row per app session (src/game/34-telemetry.js). Aggregate reads only (scripts/admin.js traction page). Cascades from auth.users; 13-month retention (purge_old_telemetry).';
comment on table public.telemetry_attempts is
  'One row per stage attempt. level_idx is zero-based and code-only: a person reads the stage as lvNum(levelNo(ci, li)), 01 to 40.';
comment on table public.telemetry_events is
  'track(name, props) rows: fault, submit, and the tutorial/paywall events added later. One flat object of at most twelve keys.';
