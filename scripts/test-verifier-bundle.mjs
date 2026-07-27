// Cross-test the generated Edge Function bundle: record a run with one sim
// instance (verify-run.js) and verify it with a SECOND, independent load (the
// bundle the Edge Function ships). Agreement proves the bundle is correct.
//   node scripts/build-verifier.js && node scripts/test-verifier-bundle.mjs
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { recordDemoRun } = require('./verify-run.js');
const { verifyRun } = await import('../supabase/functions/submit-run/_sim.mjs');

const run = recordDemoRun(4);
let pass = true;
const line = (ok, msg) => { console.log((ok ? 'PASS  ' : 'FAIL  ') + msg); if (!ok) pass = false; };
line(run && run.trace && run.trace.length > 0 && run.score > 0, `recorded a run (score ${run && run.score}, ${run && run.trace && run.trace.length} frames)`);

const good = verifyRun(run);
line(good.ok && good.recomputed === run.score, `bundle verifies the run (recomputed ${good.recomputed} === ${run.score})`);
line(!verifyRun({ ...run, score: run.score + 9000 }).ok, `bundle REJECTS a tampered score`);
line(verifyRun({ ...run, mode: 'endless' }).ok === false, `bundle flags endless unverifiable`);

console.log(pass ? '\nBUNDLE OK' : '\nBUNDLE FAILED');
process.exit(pass ? 0 : 1);
