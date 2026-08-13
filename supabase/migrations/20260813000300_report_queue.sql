-- Warp Vanguard — the report queue, as something a human can actually read.
--
-- The `reports` table on its own is unusable for moderating. It holds a run_id, a
-- reporter_id, a reason and a timestamp — and the whole question you are trying to
-- answer ("what does this name say, and should it stay?") is in a DIFFERENT table.
-- Opening reports in the dashboard shows a column of uuids and nothing to judge.
--
-- This view is the join, pre-made: one row per REPORTED RUN rather than per
-- report, carrying the name, the board, the score, whether the run was verified,
-- whether it is already locked, and how many distinct people flagged it. It is
-- what the Table Editor should show you, and what the actions in docs/MODERATION.md
-- take their `run_id` from.
--
-- security_invoker = true is doing real work: without it a view runs with its
-- OWNER's rights, which would punch straight through the RLS on `reports` and
-- expose every report — who filed it, against whom — to anyone holding the
-- publishable key. With it, the view is only as visible as its underlying tables,
-- which for `reports` means: nobody but the service role. The revoke below is the
-- second lock on the same door.
create or replace view public.report_queue
with (security_invoker = true) as
select
  r.id                                  as run_id,      -- every action in MODERATION.md takes this
  r.player_name,
  r.board,
  r.score,
  r.verified,                                           -- true = replay-verified; never auto-redacted
  r.name_locked,                                        -- true = already moderated
  count(*)::int                         as reports,     -- = distinct reporters (one per person, enforced)
  string_agg(distinct rp.reason, ', ')  as reasons,
  min(rp.created_at)                    as first_report,
  max(rp.created_at)                    as last_report
from public.reports rp
join public.runs r on r.id = rp.run_id
group by r.id, r.player_name, r.board, r.score, r.verified, r.name_locked;

revoke all on public.report_queue from public, anon, authenticated;

comment on view public.report_queue is
  'Moderation queue: one row per reported run, with the name and the reporter count. See docs/MODERATION.md.';

-- ---------------------------------------------------------------------------
-- The two responses, as functions, so answering a report is one call with one
-- argument instead of a hand-written UPDATE against a live table. Both are
-- service-role only — they are moderator tools, not player ones.
--
-- moderate_name is what the automatic threshold does, done deliberately: the name
-- is neutralised to the same 'REDACTED' the word filter uses, and LOCKED, without
-- which the player renames it back through MY DATA and the moderation was theatre.
-- The score, rank, replay and row all survive; only the name changes.
-- ---------------------------------------------------------------------------
create or replace function public.moderate_name(p_run uuid)
returns text
language plpgsql as $$
declare was text;
begin
  select player_name into was from public.runs where id = p_run;
  if was is null then return 'no such run'; end if;
  update public.runs
     set player_name = 'REDACTED', name_locked = true, updated_at = now()
   where id = p_run;
  return 'redacted and locked (was: ' || was || ')';
end;
$$;

-- Releasing does NOT restore the old name — it is overwritten and gone. This is
-- deliberate rather than an oversight: for the 'personal' reason (someone's real
-- name on a public board) keeping a copy in order to put it back later would
-- defeat the entire point of taking it down. Release simply lets the player
-- choose a new one through MY DATA.
create or replace function public.release_name(p_run uuid)
returns text
language plpgsql as $$
begin
  update public.runs set name_locked = false, updated_at = now() where id = p_run;
  if not found then return 'no such run'; end if;
  return 'unlocked — the player can now rename it (the old name is gone)';
end;
$$;

revoke execute on function public.moderate_name(uuid) from public, anon, authenticated;
revoke execute on function public.release_name(uuid)  from public, anon, authenticated;
