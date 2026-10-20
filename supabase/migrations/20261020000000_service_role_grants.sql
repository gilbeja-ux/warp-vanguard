-- ---------------------------------------------------------------------------
-- Warp Vanguard — every grant written down, service_role's too (2026-10-20).
--
-- WHAT CHANGES ON 2026-10-30. Supabase stops granting new tables, views,
-- sequences and functions in public to anon, authenticated AND service_role
-- (the email of 2026-10-20; github.com/orgs/supabase/discussions/45329). An
-- object that exists keeps the rights it holds. grants_closed (2026-09-08)
-- already took anon and authenticated off the default, so what goes on the 30th
-- is service_role's.
--
-- WHY THAT MATTERS HERE. Every service-only function revokes EXECUTE from
-- public, anon and authenticated, and until this file nothing in the repo
-- granted it to service_role: submit-run could call submit_verified_run only
-- because the platform default had handed service_role the right. The chain
-- drops and re-creates functions by signature (submit_verified_run three times,
-- delete_my_runs four), and a re-created function is a new object. After the
-- 30th the next one would come up with no right for service_role, and every
-- score would come back "permission denied for function submit_verified_run",
-- which reads as a verifier fault and is not one. Every function here is
-- SECURITY INVOKER, so the same holds for the tables they write.
--
-- WHAT THIS FILE IS. The whole grant table, written once: what submit-run,
-- my-data, report-run, send-feedback and the admin console reach as
-- service_role, and the read surface the game reaches as anon. On the live project every line names a right the
-- object already holds, so nothing changes. On a project that never had the
-- default (any project created after 2026-05-30) the API roles hold none of
-- these rights until a migration writes them, and this is that migration.
-- Both were replayed on a scratch Postgres on 2026-10-20: under the old default
-- the grants did not move by one entry; under the new one service_role lacked
-- 24 of the 28 objects before this file and none after it.
--
-- THE RULE FROM HERE. A migration that creates or re-creates a table, view or
-- function in public grants it to service_role in the same file, after the
-- create; anon and authenticated get a right only where a read RPC needs it,
-- and never a write right. `npm test` (section SERVICE_ROLE GRANTS ARE WRITTEN)
-- fails a chain where the last create of an object has no grant after it.
-- There are no sequences: every key is a uuid or text.
-- ---------------------------------------------------------------------------

-- TABLES. submit-run writes runs through submit_verified_run as the caller, and
-- the admin console deletes a run or a note directly, so service_role holds the
-- four row rights on all four.
grant select, insert, update, delete on public.runs          to service_role;
grant select, insert, update, delete on public.reports       to service_role;
grant select, insert, update, delete on public.feedback      to service_role;
grant select, insert, update, delete on public.player_limits to service_role;
-- the public board: the leaderboard_* RPCs are SECURITY INVOKER and read runs as the caller
grant select on public.runs to anon, authenticated;

-- VIEWS. The admin console reads every one; nobody else may (each migration
-- that made one revoked it from public, anon and authenticated).
grant select on public.report_queue    to service_role;
grant select on public.feedback_queue  to service_role;
grant select on public.admin_overview  to service_role;
grant select on public.board_occupancy to service_role;
grant select on public.ladder_reach    to service_role;
grant select on public.player_growth   to service_role;

-- FUNCTIONS. Each signature is the one the newest migration that made it wrote.
-- the submit path (submit-run)
grant execute on function public.submit_verified_run(text, int, text, text, int, int, real, int, int, int, text[], int, boolean, text, int, real, text, text)
  to service_role;
grant execute on function public.take_submit_slot(text, int, int)                           to service_role;
-- MY DATA, REPORT and FEEDBACK (my-data, report-run, send-feedback)
grant execute on function public.rename_my_runs(text, text, int)                            to service_role;
grant execute on function public.delete_my_runs(text)                                       to service_role;
grant execute on function public.report_run(uuid, text, text)                               to service_role;
grant execute on function public.file_feedback(text, text, text, text, text, text, text, text) to service_role;
-- the admin console
grant execute on function public.moderate_name(uuid)                                        to service_role;
grant execute on function public.release_name(uuid)                                         to service_role;
grant execute on function public.resolve_reports(uuid)                                      to service_role;
grant execute on function public.moderate_player(uuid)                                      to service_role;
grant execute on function public.rename_entry(uuid, text, boolean)                          to service_role;
grant execute on function public.reset_entry_name(uuid, boolean)                            to service_role;
grant execute on function public.dismiss_reports(uuid)                                      to service_role;
grant execute on function public.mark_feedback_handled(uuid)                                to service_role;
-- docs/MODERATION.md runs this one by hand in the SQL editor; written here so no function is left out
grant execute on function public.purge_old_feedback()                                       to service_role;
-- the three reads: the game calls them with the publishable key, submit-run calls leaderboard_rank
grant execute on function public.leaderboard_top(text, int, int)                  to anon, authenticated, service_role;
grant execute on function public.leaderboard_rank(text, int, text)                to anon, authenticated, service_role;
grant execute on function public.leaderboard_provisional_rank(text, int, int, int, int) to anon, authenticated, service_role;
