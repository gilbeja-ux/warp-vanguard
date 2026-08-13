-- Warp Vanguard — what the admin console needs to be a queue instead of a list.
--
-- Three gaps, found by using it:
--
--   1. NOTHING WAS EVER "DONE". Acting on a report left it in the list looking
--      exactly like an untouched one, so the queue only ever grew and the only way
--      to clear it was to delete the evidence. Reports now carry handled_at, every
--      action stamps it, and the console can separate open from handled without
--      throwing the record away.
--
--   2. MODERATION ONLY EVER TOUCHED ONE ROW. moderate_name redacts `where id =
--      p_run` — but the handle is denormalized onto EVERY row a player holds, so
--      redacting a reported entry left the same offending name sitting on five
--      other boards. For a genuinely bad name that is not moderation, it is
--      whack-a-mole. moderate_player does the whole player at once.
--
--   3. NO WAY TO SET A NAME. The only verb was 'REDACTED'. Sometimes the right
--      answer is a neutral handle rather than a tombstone — especially for the
--      'personal' reason, where the point is that the name should not be a name.

alter table public.reports add column if not exists handled_at timestamptz;
create index if not exists reports_open on public.reports (run_id) where handled_at is null;

comment on column public.reports.handled_at is
  'Stamped when a moderator acted (or dismissed). NULL = still open. The report is kept either way — it is the record of why a name changed.';

-- Mark every report on a run as dealt with. Called by each action below, so
-- acting on a report always closes it; there is no way to redact something and
-- leave its report looking untouched.
create or replace function public.resolve_reports(p_run uuid)
returns int
language sql as $$
  with upd as (
    update public.reports set handled_at = now()
     where run_id = p_run and handled_at is null returning 1
  ) select count(*)::int from upd;
$$;

-- THIS ENTRY ONLY.
create or replace function public.moderate_name(p_run uuid)
returns text
language plpgsql as $$
declare was text;
begin
  select player_name into was from public.runs where id = p_run;
  if was is null then return 'no such run'; end if;
  update public.runs set player_name = 'REDACTED', name_locked = true, updated_at = now() where id = p_run;
  perform public.resolve_reports(p_run);
  return 'redacted and locked (was: ' || was || ')';
end;
$$;

-- EVERY ENTRY THIS PLAYER HOLDS. The right answer when the NAME is the problem
-- rather than the entry: the same string is on all of their rows, and leaving it
-- on the others means the report gets filed again tomorrow from a different board.
create or replace function public.moderate_player(p_run uuid)
returns text
language plpgsql as $$
declare v_owner text; was text; n int;
begin
  select player_id, player_name into v_owner, was from public.runs where id = p_run;
  if v_owner is null then return 'no such run'; end if;
  update public.runs set player_name = 'REDACTED', name_locked = true, updated_at = now()
   where player_id = v_owner and not name_locked;
  get diagnostics n = row_count;
  perform public.resolve_reports(p_run);
  return n || ' entr' || (case when n = 1 then 'y' else 'ies' end)
       || ' redacted and locked (was: ' || was || ')';
end;
$$;

-- Set a chosen name. Locked, like any moderation — otherwise the player simply
-- changes it back and the decision was advisory. p_all applies it to every entry
-- they hold, for the same reason moderate_player exists.
create or replace function public.rename_entry(p_run uuid, p_name text, p_all boolean default false)
returns text
language plpgsql as $$
declare v_owner text; clean text; n int;
begin
  select player_id into v_owner from public.runs where id = p_run;
  if v_owner is null then return 'no such run'; end if;
  -- same charset and length the game allows, so a moderator cannot mint a handle
  -- the client could never have produced
  clean := left(regexp_replace(coalesce(p_name, ''), '[^\w \-]', '', 'g'), 14);
  if length(trim(clean)) < 2 then return 'name too short'; end if;
  if p_all then
    update public.runs set player_name = clean, name_locked = true, updated_at = now() where player_id = v_owner;
  else
    update public.runs set player_name = clean, name_locked = true, updated_at = now() where id = p_run;
  end if;
  get diagnostics n = row_count;
  perform public.resolve_reports(p_run);
  return n || ' renamed to "' || clean || '" and locked';
end;
$$;

-- Reset to a fresh auto handle — the same Vanguard-XXXXXX shape ensureIdentity()
-- mints in src/game/31-leaderboard.js, so a reset entry is indistinguishable from
-- a player who simply never chose one. Kinder than REDACTED, which reads as an
-- accusation on a public board, and the usual right answer when the reason was
-- 'personal': the name just needs to stop being a name.
create or replace function public.reset_entry_name(p_run uuid, p_all boolean default false)
returns text
language plpgsql as $$
begin
  return public.rename_entry(
    p_run,
    'Vanguard-' || upper(encode(gen_random_bytes(3), 'hex')),
    p_all);
end;
$$;

-- Dismiss: the report was wrong, or already dealt with. The entry is untouched.
create or replace function public.dismiss_reports(p_run uuid)
returns text
language plpgsql as $$
declare n int;
begin
  n := public.resolve_reports(p_run);
  return n || ' report' || (case when n = 1 then '' else 's' end) || ' dismissed — the entry is untouched';
end;
$$;

create or replace function public.release_name(p_run uuid)
returns text
language plpgsql as $$
begin
  update public.runs set name_locked = false, updated_at = now() where id = p_run;
  if not found then return 'no such run'; end if;
  return 'unlocked — the player can rename it (the old name is gone)';
end;
$$;

-- ---------------------------------------------------------------------------
-- The queue gains what the console needs to render a decision rather than a row:
-- who owns it, how many OTHER entries they hold (is this whack-a-mole?), and
-- whether anything is still open.
-- ---------------------------------------------------------------------------
drop view if exists public.report_queue;
create or replace view public.report_queue
with (security_invoker = true) as
select
  r.id                                          as run_id,
  r.player_id,
  r.player_name,
  r.board,
  r.score,
  r.verified,
  r.name_locked,
  count(*)::int                                 as reports,
  count(*) filter (where rp.handled_at is null)::int as open_reports,
  string_agg(distinct rp.reason, ', ')          as reasons,
  min(rp.created_at)                            as first_report,
  max(rp.created_at)                            as last_report,
  max(rp.handled_at)                            as handled_at,
  (select count(*)::int from public.runs r2 where r2.player_id = r.player_id) as player_entries
from public.reports rp
join public.runs r on r.id = rp.run_id
group by r.id, r.player_id, r.player_name, r.board, r.score, r.verified, r.name_locked;

revoke all on public.report_queue from public, anon, authenticated;
revoke execute on function public.resolve_reports(uuid)              from public, anon, authenticated;
revoke execute on function public.moderate_name(uuid)                from public, anon, authenticated;
revoke execute on function public.moderate_player(uuid)              from public, anon, authenticated;
revoke execute on function public.rename_entry(uuid, text, boolean)  from public, anon, authenticated;
revoke execute on function public.reset_entry_name(uuid, boolean)    from public, anon, authenticated;
revoke execute on function public.dismiss_reports(uuid)              from public, anon, authenticated;
revoke execute on function public.release_name(uuid)                 from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- HONEST TILE NAMES.
--
-- `players_total` counted rows in auth.users and was labelled "players". Measured
-- on this project: 124 identities, 47 of them created on a single day, 83 holding
-- no runs at all — one developer testing, not a hundred people. An anonymous
-- identity is minted whenever there is no valid refresh token, so clearing
-- storage, a second browser, an incognito window or a new device each mint
-- another. It counts SESSIONS-EVER, and there is no way to dedupe them to humans
-- without a device fingerprint, which is exactly the tracking the privacy policy
-- forbids. So the column says what it is.
-- ---------------------------------------------------------------------------
drop view if exists public.admin_overview;
create or replace view public.admin_overview
with (security_invoker = true) as
select
  (select count(*)::int from auth.users)                                              as identities_total,
  (select count(*)::int from auth.users where created_at > now() - interval '7 days') as identities_new_7d,
  (select count(distinct player_id)::int from public.runs)                            as identities_placing,
  (select count(*)::int from (
      select player_id from public.runs group by player_id
      having count(distinct created_at::date) > 1) t)                                 as identities_multi_day,
  (select count(*)::int from public.runs)                                             as board_entries,
  (select count(*)::int from public.runs where created_at > now() - interval '7 days')as entries_set_7d,
  (select count(distinct board)::int from public.runs)                                as boards_in_use,
  (select count(*)::int from public.reports where handled_at is null)                 as reports_open,
  (select count(*)::int from public.reports)                                          as reports_total,
  (select count(*)::int from public.runs where name_locked)                           as names_moderated;

comment on view public.admin_overview is
  'identities_* count ANONYMOUS AUTH SESSIONS, not people — a new one is minted whenever there is no valid refresh token (cleared storage, another browser, incognito, a new device). Not installs, not DAU, not humans. board_entries is occupancy: every board caps at 100.';

revoke all on public.admin_overview from public, anon, authenticated;
