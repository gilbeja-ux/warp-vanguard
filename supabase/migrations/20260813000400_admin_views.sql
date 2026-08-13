-- Warp Vanguard — the numbers, as views the Supabase dashboard can show.
--
-- READ THIS BEFORE TRUSTING ANY COLUMN HERE.
--
-- There is no analytics in this game and there is not going to be: privacy.html
-- promises "no advertising, analytics or tracking of any kind" and the Play Data
-- Safety form says the same. So none of this is instrumentation — it is the
-- residue of running a leaderboard, read sideways. That makes it useful and it
-- makes it partial, in two specific ways that will mislead anyone who forgets:
--
--   1. EVERY BOARD IS CAPPED AT 100 ROWS. submit_verified_run evicts past the
--      top 100 on every write. So a count of rows on a board is its OCCUPANCY,
--      never its traffic — it saturates at 100 and stops moving no matter how
--      many people play. Columns here are named `entries`, not `runs`, for that
--      reason. Do not rename them back.
--   2. ROWS ARE EVICTED, SO `runs` HAS NO RELIABLE HISTORY. A run set in March
--      and evicted in May is gone from March's count too, retroactively. Any time
--      series built on runs.created_at silently rewrites its own past. The one
--      honest clock is auth.users.created_at — identities are never evicted, only
--      deleted on request — which is what player_growth uses.
--
-- And a third, about what is missing entirely: a FAILED verification never writes
-- a row. "Are honest players being rejected?" — the question the stale-verifier
-- 409s raised — is answerable only from the submit-run Edge Function logs. No
-- query here can see it.
--
-- All of these are aggregate by design. Aggregate/statistical use sits inside the
-- legitimate-interest basis privacy.html declares (GDPR Art. 5(1)(b) treats
-- statistical purposes as compatible). Building a per-player picture would not —
-- that is a different purpose than running a leaderboard. Keep it aggregate.
--
-- security_invoker on every view, and revoked from the client roles, so none of
-- this is reachable with the publishable key that ships inside the game.

-- ---------------------------------------------------------------------------
-- The headline. One row, the whole state of play.
-- ---------------------------------------------------------------------------
create or replace view public.admin_overview
with (security_invoker = true) as
select
  (select count(*)::int from auth.users)                                             as players_total,
  (select count(*)::int from auth.users where created_at > now() - interval '7 days')  as players_new_7d,
  (select count(*)::int from auth.users where last_sign_in_at > now() - interval '7 days') as players_seen_7d,
  (select count(*)::int from public.runs)                                            as board_entries,
  (select count(*)::int from public.runs where created_at > now() - interval '7 days') as entries_set_7d,
  (select count(distinct board)::int from public.runs)                               as boards_in_use,
  (select count(*)::int from public.reports)                                         as reports_filed,
  (select count(*)::int from public.runs where name_locked)                          as names_moderated;

comment on view public.admin_overview is
  'One-row summary. players_* come from auth.users (identities are minted when a player opens the leaderboard or submits). board_entries is OCCUPANCY — every board caps at 100.';

-- ---------------------------------------------------------------------------
-- Per board: who is on it, how hard it is, and whether anyone still plays it.
-- `entries` saturates at 100 — read it as "is this board full?", not as traffic.
-- `last_entry` is the useful liveness signal.
-- ---------------------------------------------------------------------------
create or replace view public.board_occupancy
with (security_invoker = true) as
select
  r.board,
  count(*)::int                                                          as entries,      -- caps at 100
  count(distinct r.player_id)::int                                       as players,
  count(*) filter (where r.verified)::int                                as verified,     -- rest are endless (trust-only)
  max(r.score)                                                           as top_score,
  percentile_cont(0.5) within group (order by r.score)::int              as median_score,
  min(r.score)                                                           as cut_off,      -- what it now takes to place
  max(r.created_at)                                                      as last_entry
from public.runs r
group by r.board;

comment on view public.board_occupancy is
  'Per-board standing. entries caps at 100 (eviction) so it is occupancy, not traffic — use last_entry for liveness and cut_off for how hard it has become to place.';

-- ---------------------------------------------------------------------------
-- How far into the contract ladder players actually get.
--
-- This is a FLOOR, not a funnel: it counts players holding a top-100 entry on
-- each level, so it misses everyone who cleared a level without placing, and it
-- saturates once a board fills. Early on — few players, boards not yet full — it
-- is a fair read on where the ladder starts biting. Once boards fill it stops
-- being one, and the shape flattens into "100 everywhere".
-- ---------------------------------------------------------------------------
create or replace view public.ladder_reach
with (security_invoker = true) as
select
  split_part(r.board, ':', 1)                    as campaign,
  (substring(r.board from ':([0-9]+)$'))::int    as level,
  count(distinct r.player_id)::int               as players_placed,
  max(r.score)                                   as top_score,
  percentile_cont(0.5) within group (order by r.score)::int as median_score
from public.runs r
where r.board like '%:%'
  and r.board not like 'weekly:%'
group by 1, 2;

comment on view public.ladder_reach is
  'Campaign ladder. players_placed is a FLOOR (top-100 holders only) and saturates at 100 once a board fills — a proxy for where players stop, not a true funnel.';

-- ---------------------------------------------------------------------------
-- Growth, from the one clock that does not rewrite its own past.
--
-- auth.users rows are minted when a player first opens the leaderboard or submits
-- a score, and are removed only when someone erases their data. So this is honest
-- history — but it is NOT installs and NOT daily actives. A player who never
-- opens the leaderboard never appears here at all, and nothing in this project
-- can see them without adding the analytics the policy forbids.
-- ---------------------------------------------------------------------------
create or replace view public.player_growth
with (security_invoker = true) as
select
  date_trunc('week', created_at)::date                                   as week,
  count(*)::int                                                          as new_players,
  count(*) filter (where last_sign_in_at > created_at + interval '1 day')::int as came_back
from auth.users
group by 1;

comment on view public.player_growth is
  'New leaderboard identities per week (true history — auth rows are not evicted). NOT installs and NOT DAU: a player who never opens the leaderboard never appears.';

-- ---------------------------------------------------------------------------
-- Nothing above ships. The publishable key is inside every copy of the game.
-- ---------------------------------------------------------------------------
revoke all on public.admin_overview   from public, anon, authenticated;
revoke all on public.board_occupancy  from public, anon, authenticated;
revoke all on public.ladder_reach     from public, anon, authenticated;
revoke all on public.player_growth    from public, anon, authenticated;
