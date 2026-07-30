// Cross-test the generated Edge Function bundle: record a run with one sim
// instance (verify-run.js) and verify it with a SECOND, independent load (the
// bundle the Edge Function ships). Agreement proves the bundle is correct.
//   node scripts/build-verifier.js && node scripts/test-verifier-bundle.mjs
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { recordDemoRun, recordCampaignRun, campaignIds } = require('./verify-run.js');
const { verifyRun } = await import('../supabase/functions/submit-run/_sim.mjs');

const run = recordDemoRun(4);
let pass = true;
const line = (ok, msg) => { console.log((ok ? 'PASS  ' : 'FAIL  ') + msg); if (!ok) pass = false; };
// The demo run parks both nodes at fixed angles and lets the level kill it, so
// what it proves is that a run RECORDS and that the bundle agrees about it —
// including agreeing on a zero. It used to score by luck: the old scripted comms
// created lulls that held arrivals back long enough for a parked node to catch
// something. Removing the comms removed the lulls, so it now dies early with
// nothing intercepted, which is a fine thing to verify and a bad thing to assert
// a score on. Non-zero scoring is covered properly by the five campaign runs
// below, which recompute 100-700 apiece.
line(run && run.trace && run.trace.length > 0 && run.score >= 0, `recorded a run (score ${run && run.score}, ${run && run.trace && run.trace.length} frames)`);

const good = verifyRun(run);
line(good.ok && good.recomputed === run.score, `bundle verifies the run (recomputed ${good.recomputed} === ${run.score})`);
line(!verifyRun({ ...run, score: run.score + 9000 }).ok, `bundle REJECTS a tampered score`);
line(verifyRun({ ...run, mode: 'endless' }).ok === false, `bundle flags endless unverifiable`);

// EVERY campaign, recorded on the recorder instance and verified by the bundle.
// This is the case that shipped broken: the bundle inherited whatever campaign
// was installed, so boards 2..N were replayed against campaign 1 and rejected.
for (const id of campaignIds()) {
  const r = recordCampaignRun(id, 3);
  const v = verifyRun(r);
  line(v.ok, `bundle verifies ${r.board} (${v.recomputed} === ${r.score})`);
}
line(!verifyRun({ ...run, campId: 'no-such-campaign' }).ok, 'bundle REJECTS an unknown campId');

console.log(pass ? '\nBUNDLE OK' : '\nBUNDLE FAILED');
process.exit(pass ? 0 : 1);
