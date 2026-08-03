-- Weekly ladder: the daily lane becomes a Mon–Sun ranked week.
--
-- Nothing structural changes. A "board" was already just a text value, so each week
-- is simply a new one — 'weekly:2953' and so on — which is what gives every week its
-- own field, its own top-100 cap and its own ranking, and lets a finished week keep
-- all three untouched forever. The freeze itself is enforced in the Edge Function
-- (boardKeyFor refuses any weekly run whose seed is not the live week), because that
-- is the trust boundary; a constraint here could not tell an honest late write from a
-- malicious one.
--
-- So this migration only clears out the retired lane.
--
-- The old daily rows: verified empty before running this (0 rows on board='daily' in
-- production on 2026-08-03), so this is a no-op guard rather than a deletion of real
-- results — it exists to catch anything filed between that check and this deploy, and
-- to make the retirement explicit in the migration history rather than implied by an
-- absence. Gil's call; the day-based lane is not coming back.
delete from public.runs where board = 'daily';

-- `day` is now legacy. Every board writes NULL to it — the week rides in the board
-- KEY instead. The column stays: coalesce(day, -1) is part of the unique row key and
-- of every RPC signature, and dropping it would buy nothing but a wider migration.
comment on column public.runs.day is
  'LEGACY. Was the UTC day of the retired daily lane. Nothing writes it now; the weekly ladder puts its Mon-Sun week index in the board key (weekly:<n>). Kept because coalesce(day,-1) is in the unique row key.';

comment on column public.runs.board is
  'Board key, matching boardKey() in src/game/61-replay.js: ''<campId>:<levelIdx>'' | ''endless'' | ''weekly:<weekIndex>''. One board per ranked week, so a closed week keeps its field for good.';

comment on column public.runs.seed is
  'Reproducible-stream pin: level index for campaigns, Mon-Sun WEEK INDEX for the weekly ladder, NULL for endless. The Edge Function checks a weekly seed against its own clock before accepting the run.';
