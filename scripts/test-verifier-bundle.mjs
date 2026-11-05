// Cross-test the generated Edge Function bundle: record a run with one sim
// instance (verify-run.js) and verify it with a SECOND, independent load (the
// bundle the Edge Function ships). Agreement proves the bundle is correct.
//   node scripts/build-verifier.js && node scripts/test-verifier-bundle.mjs
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { recordDemoRun, recordCampaignRun, recordSlewRun, campaignIds } = require('./verify-run.js');
const slewRun = recordSlewRun(4); // recorded BEFORE the bundle loads its own sim
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
  // the boss tie-break is written from THIS number, so the bundle must return it
  // and it must be the clock the recorder saw
  line(typeof v.timeSec === 'number' && v.timeSec > 0 && Math.abs(v.timeSec - r.timeSec) < 0.05,
    `bundle returns the run's clock for ${r.board} (${v.timeSec} ~ ${r.timeSec})`);
}
line(!verifyRun({ ...run, campId: 'no-such-campaign' }).ok, 'bundle REJECTS an unknown campId');
// THE CARRIAGES TRAVEL. A pad tap or a stick names a bearing and the sim slews to
// it; a run like that was refused for two months (fixed 2026-10-10, 61-replay.js).
{
  const v = verifyRun(slewRun);
  line(slewRun.score > 0 && v.ok && v.recomputed === slewRun.score,
    `bundle verifies a run whose carriages slew (${v.recomputed} === ${slewRun.score})`);
}

// FORGED INPUTS (audit 2026-11-05, findings 1 and 8). The replay used to fire any pad
// on any frame and agreed with its own inflated score; the claimed score stays the
// honest one here, so only the input rules can refuse these.
// NOT forged here: a teleport. No angle bound separates a flick from one (see simStep).
{
  const base = recordCampaignRun(campaignIds()[0], 3);
  const forge = fn => ({ ...base, trace: base.trace.map((f, i) => fn({ ...f }, i)) });
  const refused = (name, r) => { const v = verifyRun(r); line(v.ok === false, `bundle REFUSES ${name} (${v.reason || 'score differs'})`); };
  line(verifyRun(base).ok, 'forgery baseline: the honest run verifies');
  refused('a pulse fired every frame', forge(f => { f.f = [0, 1]; return f; }));
  refused('a pad index that does not exist', forge((f, i) => { if (i === 5) f.f = [7]; return f; }));
  refused('a non-finite angle', forge((f, i) => { if (i === 5) f.a1 = NaN; return f; }));
  line(verifyRun({ ...base, w: 1e9, h: -5 }).ok === true, 'bundle clamps a hostile run width and height and still verifies');
}
// the Edge Function is TypeScript for Deno; pin its gate by shape
{
  const ts = (await import('fs')).readFileSync(new URL('../supabase/functions/submit-run/index.ts', import.meta.url), 'utf8');
  const cap = +/const MAX_TRACE = ([\d_]+)/.exec(ts)[1].replace(/_/g, '');
  line(cap >= 4787 && cap <= 6000, `MAX_TRACE ${cap} covers the longest campaign lane (4787 frames, stage 31) and no more than 100 s`);
  line(/every\(goodFrame\)/.test(ts), 'submit-run checks every trace frame before verifyRun');
}

console.log(pass ? '\nBUNDLE OK' : '\nBUNDLE FAILED');
process.exit(pass ? 0 : 1);
