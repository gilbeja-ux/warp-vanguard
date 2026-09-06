-- ---------------------------------------------------------------------------
-- Warp Vanguard — FEEDBACK carries the error the game caught (2026-09-06).
--
-- The error net in 99-boot.js records a JavaScript error that stopped the game
-- into one localStorage slot, and the next FEEDBACK note the player sends
-- carries it as a fifth context field. It is prose, not a label, so it has its
-- own column and its own cap; it is present only on a note that follows a
-- caught error, so most rows leave it null.
--
-- Same door as the other four: written only by the Edge Function through
-- file_feedback, read only in the admin console through feedback_queue. The
-- function's argument list changes, so the old signature is dropped rather than
-- overloaded — Postgres would otherwise keep both, and the revoke below would
-- guard only one of them.
-- ---------------------------------------------------------------------------

alter table public.feedback add column if not exists error text;

drop function if exists public.file_feedback(text, text, text, text, text, text, text);

create or replace function public.file_feedback(
  p_player   text,
  p_topic    text,
  p_body     text,
  p_build    text default null,
  p_device   text default null,
  p_screen   text default null,
  p_place    text default null,
  p_error    text default null
) returns table (filed boolean, dropped text)
language plpgsql as $$
declare
  v_body  text;
  v_topic text;
  n_day   int;
begin
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

  insert into public.feedback (player_id, topic, body, build, device, screen, place, error)
  values (p_player, v_topic, v_body, p_build, p_device, p_screen, p_place, left(p_error, 500));

  return query select true, null::text;
end;
$$;

revoke execute on function public.file_feedback(text, text, text, text, text, text, text, text) from public, anon, authenticated;

-- the queue shows the error beside the note it rode in on
create or replace view public.feedback_queue
with (security_invoker = true) as
select
  f.id,
  f.topic,
  f.body,
  f.build,
  f.device,
  f.screen,
  f.place,
  f.created_at,
  f.handled_at,
  (f.handled_at is null)                                   as open,
  floor(extract(epoch from (now() - f.created_at)) / 3600)::int as age_hours,
  f.error
from public.feedback f;

revoke all on public.feedback_queue from public, anon, authenticated;
