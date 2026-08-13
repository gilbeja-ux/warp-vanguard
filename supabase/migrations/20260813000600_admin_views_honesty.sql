-- Warp Vanguard — remove two columns that could not mean what they said.
--
-- admin_overview.players_seen_7d and player_growth.came_back were both built on
-- auth.users.last_sign_in_at. Measured against the live project: 118 of 124 users
-- have last_sign_in_at EXACTLY equal to created_at. The client keeps its session
-- with a refresh-token grant rather than a fresh sign-in, and GoTrue does not
-- advance last_sign_in_at on a refresh — so for this app that column is a copy of
-- the signup time and nothing more.
--
-- Which made `players_seen_7d` a second, worse-named `players_new_7d`, and made
-- `came_back` read ~0 for ever. A metric pinned at zero is worse than an absent
-- one: it does not read as "not measured", it reads as "nobody comes back", and
-- someone would eventually make a decision on it.
--
-- Replaced with two things the data can actually support:
--
--   players_placing   — distinct players holding an entry anywhere. Exact.
--   players_multi_day — players whose entries span more than one calendar day.
--                       A genuine returning-player signal, and a FLOOR: eviction
--                       removes old rows, so it can only ever undercount. That is
--                       the honest direction for a metric to be wrong in.
--
-- Neither pretends to be DAU. Nothing here can be, without the analytics the
-- privacy policy forbids.

drop view if exists public.admin_overview;
create or replace view public.admin_overview
with (security_invoker = true) as
select
  (select count(*)::int from auth.users)                                              as players_total,
  (select count(*)::int from auth.users where created_at > now() - interval '7 days') as players_new_7d,
  (select count(distinct player_id)::int from public.runs)                            as players_placing,
  (select count(*)::int from (
      select player_id from public.runs
       group by player_id
      having count(distinct created_at::date) > 1) t)                                 as players_multi_day,
  (select count(*)::int from public.runs)                                             as board_entries,
  (select count(*)::int from public.runs where created_at > now() - interval '7 days')as entries_set_7d,
  (select count(distinct board)::int from public.runs)                                as boards_in_use,
  (select count(*)::int from public.reports)                                          as reports_filed,
  (select count(*)::int from public.runs where name_locked)                           as names_moderated;

comment on view public.admin_overview is
  'One-row summary. players_total/new come from auth.users (minted when a player opens the leaderboard or submits) — NOT installs, NOT DAU. board_entries is OCCUPANCY: every board caps at 100. players_multi_day is a floor (eviction undercounts it).';

drop view if exists public.player_growth;
create or replace view public.player_growth
with (security_invoker = true) as
select
  date_trunc('week', created_at)::date as week,
  count(*)::int                        as new_players
from auth.users
group by 1;

comment on view public.player_growth is
  'New leaderboard identities per week. True history — auth rows are never evicted. NOT installs and NOT DAU: a player who never opens the leaderboard never appears here at all.';

revoke all on public.admin_overview from public, anon, authenticated;
revoke all on public.player_growth  from public, anon, authenticated;
