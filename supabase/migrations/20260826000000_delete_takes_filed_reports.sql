-- ---------------------------------------------------------------------------
-- H-26 · A DELETED PLAYER LEAVES NO REPORTER ID BEHIND.
--
-- delete_my_runs took the player's runs and their rate-limit ledger. Reports
-- ABOUT those runs went with them, because reports.run_id cascades. Reports the
-- player FILED against other people did not: reports.reporter_id is a bare text
-- column with no foreign key — deliberately, since a reporter has no row of their
-- own to point at — so the id of a player who asked to be deleted survived in
-- every report they ever filed. That is the last copy of the one identifier this
-- whole delete exists to remove.
--
-- A CONSEQUENCE, STATED ON PURPOSE. report_run auto-redacts a name once three
-- DISTINCT reporters have filed on it. Withdrawing a departed player's reports can
-- take a run back under that threshold. That is the correct reading: the count is
-- "how many people object", and a deleted account is not a person who objects any
-- more. An auto-redaction that ALREADY fired is untouched — it set name_locked,
-- and nothing here clears it, so a name that was taken away stays taken away.
--
-- The order inside the function does not matter here the way it does in the Edge
-- Function: this is one transaction, so either all three deletes land or none do.
-- ---------------------------------------------------------------------------
drop function if exists public.delete_my_runs(text);
create or replace function public.delete_my_runs(p_player text)
returns table (trace_id text)
language plpgsql as $$
begin
  delete from public.player_limits where player_id = p_player;
  delete from public.reports       where reporter_id = p_player;
  return query delete from public.runs r where r.player_id = p_player returning r.trace_id;
end;
$$;

revoke execute on function public.delete_my_runs(text) from public, anon, authenticated;

comment on function public.delete_my_runs(text) is
  'MY DATA delete: removes the player''s runs (reports about them cascade), their '
  'rate-limit ledger, and the reports they filed on other people. Returns the '
  'trace keys of the deleted runs so the Edge Function can purge Storage. '
  'Service role only.';
