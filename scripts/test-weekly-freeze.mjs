// THE FREEZE, TESTED AGAINST THE DEPLOYED FUNCTION. The ladder's promise is that a
// closed week is closed for good — get a name onto a week's board and it stays there.
// That promise is only as good as the server, because a modified client can claim any
// week it likes. So this asks the live function to file a run onto a PAST week and
// insists it refuses, then files the same run onto the live week and insists it lands.
//
// ⚠️ THIS TEST WRITES TO THE PRODUCTION LADDER. It has to: a freeze check that only
// ever rejects would pass by rejecting everything, so it must also prove the live week
// still accepts a score. It therefore leaves one row per run, named FREEZETEST, and
// recordWeeklyRun deliberately plays badly so that row lands at 0 at the bottom of the
// field rather than at the top of a live ladder. Clear them from the SQL editor with:
//
//   delete from public.runs where player_name = 'FREEZETEST';
//
// Run: node scripts/test-weekly-freeze.mjs   (or npm run test:freeze)
import { createRequire } from 'module';
const realFetch = globalThis.fetch.bind(globalThis);
const realPerf = globalThis.performance;
const require = createRequire(import.meta.url);
const { recordWeeklyRun } = require('./verify-run.js');
globalThis.performance = realPerf;
const fetch = realFetch;

const BASE = 'https://ghkbjlgcdrszkawfbxdr.supabase.co';
const KEY = 'sb_publishable_B3MngfknmPrLc-uo0ho11A_Jnmphekl';
const h = { apikey: KEY, 'Content-Type': 'application/json' };
const weekOf = (ms) => Math.floor((Math.floor(ms / 864e5) + 3) / 7);

const sess = await (await fetch(BASE + '/auth/v1/signup', { method: 'POST', headers: h, body: '{}' })).json();
if (!sess.access_token) { console.error('anon sign-in failed', sess); process.exit(1); }

const submit = (run) => fetch(BASE + '/functions/v1/submit-run', {
  method: 'POST', headers: { ...h, Authorization: 'Bearer ' + sess.access_token },
  body: JSON.stringify({ run, name: 'FREEZETEST' }),
});

const live = weekOf(Date.now());
const run = recordWeeklyRun(1280, 720);
console.log('recorded a weekly run →', { board: run.board, seed: run.seed, score: run.score, frames: run.trace.length });
if (run.seed !== live) { console.error('FAIL  the recorded run is not on the live week', run.seed, live); process.exit(1); }

let pass = true;
const line = (ok, msg) => { console.log((ok ? 'PASS  ' : 'FAIL  ') + msg); if (!ok) pass = false; };

// 1) a CLOSED week must be refused, however the client dresses it up. The score and
//    trace are genuine — only the claimed week is stale, which is exactly the shape of
//    "replay last week's lane and file it late".
for (const back of [1, 5, 52]) {
  const stale = { ...run, seed: live - back, board: `weekly:${live - back}` };
  const res = await submit(stale);
  const out = await res.json().catch(() => ({}));
  line(res.status !== 200 || !out.verified,
    `a run claiming week ${live - back} (${back}w ago) is REFUSED (status ${res.status}${out.error ? ', ' + out.error : ''})`);
}

// 2) …and a future week too, so the ladder cannot be pre-seeded before it opens
{
  const ahead = { ...run, seed: live + 1, board: `weekly:${live + 1}` };
  const res = await submit(ahead);
  const out = await res.json().catch(() => ({}));
  line(res.status !== 200 || !out.verified,
    `a run claiming NEXT week is REFUSED (status ${res.status}${out.error ? ', ' + out.error : ''})`);
}

// 3) the live week still works — otherwise the check above would pass by rejecting
//    everything, which is the failure mode a one-sided test cannot see
{
  const res = await submit(run);
  const out = await res.json().catch(() => ({}));
  line(res.status === 200 && out.verified,
    `the LIVE week accepts and verifies it (status ${res.status}, score ${out.score}${out.rank ? ', rank #' + out.rank.rank + '/' + out.rank.total : ''})`);
  line(String(out.board || '').startsWith('weekly:'), `and files it under ${out.board}`);
}

console.log(pass ? '\nWEEKLY FREEZE OK — only the live week accepts a score' : '\nWEEKLY FREEZE FAILED');
process.exit(pass ? 0 : 1);
