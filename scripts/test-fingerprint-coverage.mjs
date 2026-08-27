// THE COVERAGE GATE — the fingerprint's evidence, measured.
//
// A board id is only worth what the battery actually played. BATTERY_V 1 claimed
// full-duration coverage and delivered 4–14 seconds per lane, because its
// synthetic pilot never defended and every run ended early; a change past ~6
// seconds kept its id while the sim moved, which is the exact failure the
// fingerprint exists to prevent. V2 pins integrity so the lane plays out.
//
// This gate stops that regressing. It is slow (it replays all 40 ranked boards
// end to end), so it lives outside `npm test` and runs before a release, beside
// the verifier bundle test.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { coverage, BATTERY_V } = require('./lib/sim-fingerprint.js');

const rows = coverage(process.argv[2] || '.');
let short = 0;
console.log(`fingerprint battery V${BATTERY_V} — coverage over ${rows.length} ranked boards`);
for (const r of rows) {
  const frac = r.played / r.duration;
  if (frac < 0.95) {
    short++;
    console.log(`  SHORT ${r.board.padEnd(16)} played ${r.played.toFixed(1)}s of ${r.duration}s (${(frac * 100).toFixed(0)}%)`);
  }
}
if (short) {
  console.log(`\n${short}/${rows.length} boards did NOT play out. Every id from this battery describes`);
  console.log('less than the lane it names, and no "nothing moved" answer from it can be trusted.');
  process.exit(1);
}
console.log(`  all ${rows.length} boards played to their full authored duration`);
console.log('\nCOVERAGE OK');
