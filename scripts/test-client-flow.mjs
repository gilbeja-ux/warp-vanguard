// Faithful CLIENT-flow test against the DEPLOYED function: record a run the way
// the real game does (fresh save state → briefing fires mid-level, real device
// viewport, player dismisses the card), then submit it. Proves the in-game path
// — not just the canonical Node demo — verifies end-to-end.
//   node scripts/test-client-flow.mjs
import { createRequire } from 'module';
const realFetch = globalThis.fetch.bind(globalThis);
const realPerf = globalThis.performance;
const require = createRequire(import.meta.url);
const { recordClientRun } = require('./verify-run.js');
globalThis.performance = realPerf;
const fetch = realFetch;

const BASE = 'https://ghkbjlgcdrszkawfbxdr.supabase.co';
const KEY = 'sb_publishable_B3MngfknmPrLc-uo0ho11A_Jnmphekl';
const h = { apikey: KEY, 'Content-Type': 'application/json' };

const sess = await (await fetch(BASE + '/auth/v1/signup', { method: 'POST', headers: h, body: '{}' })).json();
if (!sess.access_token) { console.error('anon sign-in failed', sess); process.exit(1); }

const run = recordClientRun(4, 1280, 720); // level 4 (has walls → briefing), 1280x720 device
console.log('client run →', { board: run.board, score: run.score, w: run.w, h: run.h, frames: run.trace.length, briefingFired: run._briefingFired });

const res = await fetch(BASE + '/functions/v1/submit-run', {
  method: 'POST', headers: { ...h, Authorization: 'Bearer ' + sess.access_token },
  body: JSON.stringify({ run, name: 'CLIENTTEST' }),
});
const out = await res.json();
console.log('function status:', res.status);
console.log('function said:', JSON.stringify(out));
console.log(res.status === 200 && out.verified ? '\nCLIENT FLOW OK — a real briefing-interrupted run verified on the edge' : '\nCLIENT FLOW FAILED');
process.exit(res.status === 200 && out.verified ? 0 : 1);
