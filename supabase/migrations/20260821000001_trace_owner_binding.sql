-- Warp Vanguard — H-03: close the replay-stealing hole.
--
-- THE HOLE. A "verified" run only proves that its input frames reproduce its
-- score, not that this player played it. The traces bucket was PUBLIC, so anyone
-- could download a top run's frames over a plain URL, resubmit them under their
-- own identity, and the server re-verified them and wrote the row as theirs. The
-- 400 error body even handed back recomputed/integrity/steps, a brute-force
-- oracle for the two fields the stolen package lacked (w/h + mutators).
--
-- TWO CHANGES HERE (the oracle fix and the signed-URL minting live in
-- supabase/functions/submit-run/index.ts; the client fetch in src/game/31-leaderboard.js):
--
-- 1) FRAME-HASH BINDING. submit-run fingerprints the input frames (SHA-256) and
--    refuses a submission whose frames already belong to a DIFFERENT player, then
--    stamps the hash on the winning row. This column stores that fingerprint. It
--    is not a proof — an attacker can perturb one no-op frame to change the hash —
--    so it is the cheap layer that catches naive copy-paste; the private bucket
--    below is the real barrier. Only rows written after this migration carry a
--    hash, so the guard protects going forward.
alter table public.runs add column if not exists trace_hash text;
create index if not exists runs_trace_hash_idx on public.runs (trace_hash);

-- 2) PRIVATE BUCKET. A public bucket is what let the frames be downloaded at all.
--    Private + short-lived signed URLs (minted by submit-run's `trace-url` action)
--    keeps replays watchable but un-harvestable.
--
--    ⚠ COORDINATED DEPLOY. The instant this lands, any client that still fetches
--    the public URL loses replay playback. Ship it WITH the 1.0.4 client that
--    fetches signed URLs, never ahead of it. If this UPDATE lacks privilege on
--    storage.buckets on the hosted project, set the bucket private from the
--    Storage dashboard instead — the column above is the part that must migrate.
update storage.buckets set public = false where id = 'traces';
