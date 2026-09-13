-- ---------------------------------------------------------------------------
-- Warp Vanguard — the grants say what the comments say (2026-09-08 audit, A3).
--
-- WHAT WAS TRUE ON THE LIVE PROJECT. Supabase grants every new table and every
-- new function to anon and authenticated by default (via ALTER DEFAULT
-- PRIVILEGES for the postgres role). schema.sql says "submit_verified_run is
-- NOT granted to anon" and "no policies: service role only" — but the ACLs read
-- otherwise: anon and authenticated held EXECUTE on submit_verified_run and
-- INSERT/UPDATE/DELETE/TRUNCATE on runs, reports, feedback, player_limits and
-- the backup table. Row-level security was the ONLY thing refusing those writes,
-- and a single permissive policy in a later migration would have opened the
-- board to unauthenticated score writes. Every other service-only function got
-- an explicit revoke; these did not.
--
-- THE RULE FROM HERE. A player's client only ever calls the four Edge Functions
-- and the three leaderboard_* read RPCs. Everything else is service role. So:
--   * runs keeps SELECT for anon/authenticated — the read RPCs are SECURITY
--     INVOKER and read the table as the caller, under the public-read policy;
--   * runs loses every write right; the four private tables lose everything;
--   * submit_verified_run is revoked like its siblings;
--   * the DEFAULT changes, so a future table or function starts closed and a
--     grant is a decision written in a migration, never an accident.
-- No client behaviour changes: nothing a player does touched these rights.
-- ---------------------------------------------------------------------------

revoke insert, update, delete, truncate, references, trigger on public.runs from public, anon, authenticated;
revoke all on public.reports       from public, anon, authenticated;
revoke all on public.feedback      from public, anon, authenticated;
revoke all on public.player_limits from public, anon, authenticated;
do $$ begin
  if to_regclass('public.runs_backup_20260902') is not null then
    execute 'revoke all on public.runs_backup_20260902 from public, anon, authenticated';
  end if;
end $$;

revoke execute on function public.submit_verified_run(text, int, text, text, int, int, real, int, int, int, text[], int, boolean, text, int, real, text)
  from public, anon, authenticated;

-- new objects start closed
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke execute on functions from anon, authenticated;

-- ---------------------------------------------------------------------------
-- A FIXED search_path ON EVERY FUNCTION (advisor: function_search_path_mutable).
-- Every body already names its tables as public.<table>; the one bare call is
-- gen_random_bytes, which lives in the extensions schema — so the fixed path is
-- public then extensions, and a caller's own search_path can no longer put a
-- look-alike table or function in front of the real one.
-- ---------------------------------------------------------------------------
alter function public.delete_my_runs(text)                                            set search_path = public, extensions;
alter function public.dismiss_reports(uuid)                                           set search_path = public, extensions;
alter function public.file_feedback(text, text, text, text, text, text, text, text)  set search_path = public, extensions;
alter function public.leaderboard_provisional_rank(text, int, int, int, int)          set search_path = public, extensions;
alter function public.leaderboard_rank(text, int, text)                               set search_path = public, extensions;
alter function public.leaderboard_top(text, int, int)                                 set search_path = public, extensions;
alter function public.mark_feedback_handled(uuid)                                     set search_path = public, extensions;
alter function public.moderate_name(uuid)                                             set search_path = public, extensions;
alter function public.moderate_player(uuid)                                           set search_path = public, extensions;
alter function public.purge_old_feedback()                                            set search_path = public, extensions;
alter function public.release_name(uuid)                                              set search_path = public, extensions;
alter function public.rename_entry(uuid, text, boolean)                               set search_path = public, extensions;
alter function public.rename_my_runs(text, text, int)                                 set search_path = public, extensions;
alter function public.report_run(uuid, text, text)                                    set search_path = public, extensions;
alter function public.reset_entry_name(uuid, boolean)                                 set search_path = public, extensions;
alter function public.resolve_reports(uuid)                                           set search_path = public, extensions;
alter function public.submit_verified_run(text, int, text, text, int, int, real, int, int, int, text[], int, boolean, text, int, real, text)
  set search_path = public, extensions;
