// End-to-end test against the DEPLOYED submit-run function: record a real run,
// sign in anonymously, submit it, and print what the cloud verifier decided.
//   node scripts/test-deployed.mjs
import { createRequire } from 'module';
// verify-run.js stubs global fetch/performance for the headless sim — snapshot
// the real ones first and restore them, or Node's fetch breaks on response timing.
const realFetch = globalThis.fetch.bind(globalThis);
const realPerf = globalThis.performance;
const require = createRequire(import.meta.url);
const { recordDemoRun } = require('./verify-run.js');
globalThis.performance = realPerf;
const fetch = realFetch;

const BASE = 'https://ghkbjlgcdrszkawfbxdr.supabase.co';
const KEY = 'sb_publishable_B3MngfknmPrLc-uo0ho11A_Jnmphekl';
const h = { apikey: KEY, 'Content-Type': 'application/json' };

const sess = await (await fetch(BASE + '/auth/v1/signup', { method: 'POST', headers: h, body: '{}' })).json();
if (!sess.access_token) { console.error('anon sign-in failed', sess); process.exit(1); }

const run = recordDemoRun(4);
console.log('recorded run →', { board: run.board, score: run.score, frames: run.trace.length });

const res = await fetch(BASE + '/functions/v1/submit-run', {
  method: 'POST',
  headers: { ...h, Authorization: 'Bearer ' + sess.access_token },
  body: JSON.stringify({ run, name: 'CLOUDTEST' })
});
console.log('function status:', res.status);
console.log('function said:', await res.text());
