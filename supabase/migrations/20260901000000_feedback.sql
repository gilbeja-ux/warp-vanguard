-- ---------------------------------------------------------------------------
-- Warp Vanguard — FEEDBACK. A player writes a note; it lands here; Gil reads it.
--
-- This is the third pipe out of the game, and it is deliberately NOT the other
-- two. `reports` carries a closed set of reasons about SOMEONE ELSE's handle, so
-- it can be acted on mechanically. `my-data` carries a player acting on their own
-- identity. This one carries free text about the GAME, addressed to the person
-- who wrote it, and nothing in it is ever shown to another player.
--
-- That last clause is what makes free text safe here. submit-run and my-data both
-- filter a handle because a handle goes on a public board; report-run refuses free
-- text outright, because a reason field on a stranger's row is where an angry
-- player types abuse and it would then need its own moderation. A private note to
-- the developer has no such audience. A word list on it would only silence a
-- frustrated bug report that used a rude word, so there is no word list.
--
-- WHAT IS NOT HERE, ON PURPOSE:
--   · no reply address, and no thread. An anonymous identity has no address to
--     answer, and ASKING for one would be personal data on a consent basis — a
--     second legal basis, a second retention rule and a second deletion path. So
--     the panel says nothing comes back down this pipe, and hands over the
--     developer's own address instead (GET IN TOUCH, on the disc's right flank).
--     A player who writes to it chose to; the game never collected it.
--   · no attachment. A screenshot needs Storage, a bucket policy, a size cap and
--     a moderation story, and almost nobody sends one.
--   · no per-player history read back into the game. A note goes one way.
-- ---------------------------------------------------------------------------

create table if not exists public.feedback (
  id          uuid primary key default gen_random_uuid(),
  -- the player's server id, taken from their JWT by the Edge Function and NEVER
  -- from the request body — the same law submit-run, my-data and report-run all
  -- follow. Holding a valid token for an id IS holding the id; a tampered body
  -- can only ever address the identity it already has.
  player_id   text not null,
  topic       text not null default 'other',
  body        text not null,
  -- THE CONTEXT, AND IT IS TWO COLUMNS. A bug report with no build id is a wish,
  -- not a report — and everything past that was convenience bought with paperwork.
  -- An earlier cut carried the device model, the screen size and the language;
  -- each came off the DEVICE, and each cost a sentence in privacy.html, a line in
  -- the deletion page and, for the model, a written argument on the Play Data
  -- Safety form. Gil's call: keep only what we need.
  --
  -- Both of these describe the GAME, not the player. Neither says anything about
  -- who or what sent the note.
  build       text,          -- the BUILD stamp + app version: which code ran
  place       text,          -- where they were, as a STAGE DISPLAY NAME (see below)
  created_at  timestamptz not null default now(),
  -- null = still open. Set by mark_feedback_handled from the admin console, which
  -- is the only thing that reads this table.
  handled_at  timestamptz,
  constraint feedback_topic_ok check (topic in ('bug', 'idea', 'balance', 'other')),
  constraint feedback_body_len check (char_length(body) between 1 and 600)
);

-- `place` IS A NAME, NOT AN INDEX. CLAUDE.md's house law: a stage's name is
-- `lvNum(levelNo(ci, li))` — one-based and zero-padded — and a board key is an id
-- that must never be zero-padded. The client sends the NAME ('cargo-run 07'),
-- because this column is read by a human and a human reads stage names. Nothing
-- joins on it, so it carries no id.

-- The queue is read open-first, so the partial index is the whole working set.
create index if not exists feedback_open on public.feedback (created_at desc) where handled_at is null;
create index if not exists feedback_player on public.feedback (player_id);
create index if not exists feedback_created on public.feedback (created_at desc);

-- RLS on with NO policies at all, exactly like `reports`: no client role can read
-- or write this table. The Edge Function writes it with the service role and a
-- human reads it in the admin console. A player must never be able to read
-- another player's note, or their own back.
alter table public.feedback enable row level security;

-- ---------------------------------------------------------------------------
-- File a note.
--
-- THE RATE BAR LIVES IN HERE, not in the Edge Function, so it cannot be skipped
-- by a second caller and so the check and the insert are one transaction. Two
-- bars, and they answer different abuses:
--   · one note per 10 minutes stops a stuck finger and a rage-typing session.
--   · five per rolling 24 hours stops a script.
-- The FIRST note is always free — there is no cooldown to serve before the first
-- one, in the same spirit as rename_my_runs' free first rename.
--
-- Over the bar, the row is DROPPED and the function says so. What the player is
-- told is a separate decision made in the Edge Function, and it is: nothing.
-- Publishing a bar turns it into a target, which is the same reasoning report_run
-- uses for never revealing its threshold.
--
-- Service-role only. `p_player` is an argument rather than auth.uid() because the
-- caller is the Edge Function holding the player's verified JWT — hence the
-- revoke at the bottom.
-- ---------------------------------------------------------------------------
create or replace function public.file_feedback(
  p_player   text,
  p_topic    text,
  p_body     text,
  p_build    text default null,
  p_place    text default null
) returns table (filed boolean, dropped text)
language plpgsql as $$
declare
  v_body  text;
  v_topic text;
  n_day   int;
begin
  -- Trim, then cap. The client caps at 600 too, but a client is a request header
  -- away from being someone else's script, and the column's own check constraint
  -- would raise rather than answer — an exception here would reach the player as
  -- a 500 on a note they typed honestly at 601 characters.
  v_body := left(btrim(coalesce(p_body, '')), 600);
  if v_body = '' then
    return query select false, 'empty'; return;
  end if;

  v_topic := coalesce(nullif(p_topic, ''), 'other');
  if v_topic not in ('bug', 'idea', 'balance', 'other') then v_topic := 'other'; end if;

  if exists (select 1 from public.feedback f
              where f.player_id = p_player and f.created_at > now() - interval '10 minutes') then
    return query select false, 'too soon'; return;
  end if;

  select count(*)::int into n_day from public.feedback f
   where f.player_id = p_player and f.created_at > now() - interval '24 hours';
  if n_day >= 5 then
    return query select false, 'daily cap'; return;
  end if;

  insert into public.feedback (player_id, topic, body, build, place)
  values (p_player, v_topic, v_body, p_build, p_place);

  return query select true, null::text;
end;
$$;

-- ---------------------------------------------------------------------------
-- Mark one note dealt with. The admin console's Handled button, and the mirror of
-- resolve_reports: acting on something closes it, so the queue is what is still
-- open rather than everything that ever arrived.
-- ---------------------------------------------------------------------------
create or replace function public.mark_feedback_handled(p_id uuid)
returns text
language plpgsql as $$
begin
  update public.feedback set handled_at = now() where id = p_id and handled_at is null;
  if not found then return 'already handled, or no such note'; end if;
  return 'marked handled';
end;
$$;

-- ---------------------------------------------------------------------------
-- RETENTION, as a function rather than a promise in a document.
--
-- privacy.html says a note is kept until it is dealt with, then 90 days, and
-- nothing is kept past 12 months. Those two numbers are HERE so the promise has
-- an implementation, and so running it is one call rather than a hand-written
-- DELETE against a live table. Run it from the admin console or the SQL editor;
-- there is no scheduler in this project and one delete a month is not worth one.
-- ---------------------------------------------------------------------------
create or replace function public.purge_old_feedback()
returns table (handled_purged int, expired_purged int)
language plpgsql as $$
declare a int; b int;
begin
  delete from public.feedback where handled_at is not null and handled_at < now() - interval '90 days';
  get diagnostics a = row_count;
  delete from public.feedback where created_at < now() - interval '12 months';
  get diagnostics b = row_count;
  return query select a, b;
end;
$$;

revoke execute on function public.file_feedback(text, text, text, text, text) from public, anon, authenticated;
revoke execute on function public.mark_feedback_handled(uuid) from public, anon, authenticated;
revoke execute on function public.purge_old_feedback()        from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- The queue a human reads. Sibling of report_queue, and the same two locks on the
-- same door: security_invoker = true so the view is only as visible as the table
-- it reads (without it a view runs with its OWNER's rights and punches straight
-- through the RLS above), and a revoke from every client role.
--
-- No join here, unlike report_queue — a note is self-contained, which is the
-- whole reason the context columns exist. What the view adds is the two things a
-- queue is read by: how old, and whether it is still open.
-- ---------------------------------------------------------------------------
create or replace view public.feedback_queue
with (security_invoker = true) as
select
  f.id,
  f.topic,
  f.body,
  f.build,
  f.place,
  f.created_at,
  f.handled_at,
  (f.handled_at is null)                                   as open,
  floor(extract(epoch from (now() - f.created_at)) / 3600)::int as age_hours
from public.feedback f;

revoke all on public.feedback_queue from public, anon, authenticated;

comment on view public.feedback_queue is
  'In-game feedback, newest first, open ones first. Read by scripts/admin.js. '
  'Carries no player_id: a note is judged on what it says, and pairing free text '
  'with the id that wrote it is a per-player picture this project does not build.';

-- ---------------------------------------------------------------------------
-- A DELETED PLAYER LEAVES NO FEEDBACK BEHIND.
--
-- Same law as 20260826000000_delete_takes_filed_reports.sql, applied to the new
-- pipe: delete_my_runs already took the player's runs, their rate-limit ledger and
-- the reports they filed. Their notes are the one remaining place their id
-- survives — and worse than the id, the note is free text they may have typed
-- their own name into.
--
-- DELETED, NOT ANONYMISED. Nulling player_id would keep a useful bug report, and
-- that was tempting. It is the wrong call: the text itself can carry an
-- identifier, and "we removed the link but kept what you wrote" is a cleverer
-- promise than "it is gone". MY DATA offers one promise, so this keeps it.
--
-- One transaction, so either all four deletes land or none do.
-- ---------------------------------------------------------------------------
drop function if exists public.delete_my_runs(text);
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

revoke execute on function public.delete_my_runs(text) from public, anon, authenticated;

comment on function public.delete_my_runs(text) is
  'MY DATA delete: removes the player''s runs (reports about them cascade), their '
  'rate-limit ledger, the reports they filed on other people, and the feedback '
  'they sent. Returns the trace keys of the deleted runs so the Edge Function can '
  'purge Storage. Service role only.';
