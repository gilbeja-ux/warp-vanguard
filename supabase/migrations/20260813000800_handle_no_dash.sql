-- Warp Vanguard — the auto handle loses its dash, and gains a character.
--
-- 'Vanguard-' + 6 hex is 15 characters. NAME_MAX is 14. So every auto handle ever
-- submitted was sliced a digit short — by sanitizeName() on the client and
-- cleanName() in submit-run — and the boards are full of 'Vanguard-25A43'. The
-- code claimed "6 hex chars ≈ 16M labels" and was delivering about a million.
--
-- Dropping the dash frees exactly the character that was being eaten:
-- 'Vanguard' + 6 hex is 14, which fits whole. Mirrors the change to
-- ensureIdentity() in src/game/31-leaderboard.js — keep the two in step, because
-- a reset issued from the admin console should be indistinguishable from a handle
-- the game minted itself.
create or replace function public.reset_entry_name(p_run uuid, p_all boolean default false)
returns text
language plpgsql as $$
begin
  return public.rename_entry(
    p_run,
    'Vanguard' || upper(encode(gen_random_bytes(3), 'hex')),
    p_all);
end;
$$;

revoke execute on function public.reset_entry_name(uuid, boolean) from public, anon, authenticated;

-- EXISTING ROWS ARE LEFT ALONE, deliberately. A board entry is a record of what a
-- player was called when they set it, and rewriting 230 of them to change a
-- punctuation mark would edit history to no one's benefit — the old ones are still
-- perfectly good labels. New handles take the new shape; the client does the same
-- for saves it already holds, so a given player's label converges the next time
-- they play rather than being rewritten underneath them.
