-- Warp Vanguard — the player's own data: rename every run, or erase them all.
--
-- WHY THESE EXIST. The boards hold no name, no email and no device id, but they
-- DO hold a stable per-player identifier (`player_id`, the anonymous auth uid)
-- threaded through every row a person ever set. That identifier is what makes the
-- table personal data rather than a pile of unrelated numbers, and it is the thing
-- a player has to be able to act on. The two verbs are deliberately different in
-- weight:
--
--   rename  — the handle is one handle, denormalized onto every row (see the
--             identity note in schema.sql). Renaming ONE board would leave the same
--             person wearing two names, so a rename is always across all of them.
--   delete  — every row, plus the replay traces they point at, plus the auth user
--             itself (done by the Edge Function; only the rows are dropped here).
--
-- The score survives a rename. That is the point of offering both: taking a name
-- off a public board costs the board nothing, so it is the answer to almost every
-- real request, and the run stays where it was earned.
--
-- ---------------------------------------------------------------------------
-- THESE ARE SERVICE-ROLE ONLY, AND THAT IS LOAD-BEARING.
-- Both take `p_player` as an argument rather than reading auth.uid(), because the
-- caller is the Edge Function (service role), which has already decoded the
-- player's verified JWT. That means an anon caller holding the publishable key
-- could pass ANY player id and wipe a stranger's board. The revokes at the bottom
-- of this file are the only thing standing between those two facts — do not drop
-- them, and do not grant these to anon or authenticated.
-- ---------------------------------------------------------------------------

-- Rename every run this player holds, on every board. Returns how many rows moved
-- so the caller can tell the player what happened ("42 runs renamed") rather than
-- a bare success. The name arrives ALREADY moderated by the Edge Function — the
-- same cleanName() that gates submit-run — so nothing is re-checked here.
create or replace function public.rename_my_runs(p_player text, p_name text)
returns integer
language sql as $$
  with upd as (
    update public.runs
       set player_name = coalesce(p_name, ''),
           updated_at  = now()
     where player_id = p_player
     returning 1
  )
  select count(*)::int from upd;
$$;

-- Erase every run this player holds, and hand back the trace object keys that
-- went with them so the caller can purge Storage too. A row deleted here whose
-- trace survived in the bucket would leave the replay — the player's actual
-- inputs, keyed by their id in the object name — sitting there after we told them
-- it was gone, which would make the promise false rather than merely untidy.
create or replace function public.delete_my_runs(p_player text)
returns table (trace_id text)
language sql as $$
  delete from public.runs r
   where r.player_id = p_player
  returning r.trace_id;
$$;

-- The revokes described at the top. `public` is included because Postgres grants
-- EXECUTE to PUBLIC on newly created functions by default: without this line the
-- destructive one is reachable by anyone holding the publishable key, which ships
-- inside every copy of the game.
revoke execute on function public.rename_my_runs(text, text) from public, anon, authenticated;
revoke execute on function public.delete_my_runs(text)        from public, anon, authenticated;
