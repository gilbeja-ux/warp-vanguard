// H-13 · the sfx level board. Measures every take in SFX_FILES with ffmpeg and
// pins ONE invariant: no take, AT ITS SHIPPED TRIM, true-peaks over full scale.
// Loudness (integrated LUFS + trim) is printed as a board, sorted loud-first,
// so a new take that lands out of family is SEEN — but family balance is a call
// for ears, so the board never fails the run. Only a clip does.
//
// ffmpeg is a local instrument, not a repo dependency: no ffmpeg → SKIP, exit 0,
// so CI and a fresh machine stay green. Run `brew install ffmpeg` to arm it.
import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

if (spawnSync('ffmpeg', ['-version']).error) {
  console.log('SKIP  sfx levels (ffmpeg not installed)');
  process.exit(0);
}

// the trim table IS the contract under test — read it from the live source, so
// a new take or a moved trim is measured without touching this file
const src = readFileSync(join(root, 'src/game/12-sfx.js'), 'utf8');
const entries = [];
const re = /(\w+):\s*\['(audio\/sfx\/[^']+)',\s*([\d.]+)\]/g;
for (let m; (m = re.exec(src)); ) entries.push({ key: m[1], file: m[2], trim: +m[3] });

let failures = 0;
function check(name, cond) {
  console.log((cond ? 'PASS' : 'FAIL') + '  ' + name);
  if (!cond) failures++;
}

check('SFX_FILES parsed from 12-sfx.js', entries.length >= 15);

const dB = t => 20 * Math.log10(t);
const board = [];
let pending = 0;
for (const e of entries) {
  // A DECLARED TAKE THAT HAS NOT LANDED YET IS PENDING, NOT A FAILURE (H-33).
  // The roster is allowed to name a file Gil is still sourcing: loadSamples'
  // .catch swallows the 404, playSample returns false, and the synth voice covers
  // the cue — the same fail-soft path every entry relies on. Failing the run here
  // would mean the plumbing could not be committed before the audio arrived, which
  // is exactly backwards. It IS reported, so a pending take cannot be forgotten.
  if (!existsSync(join(root, 'src', e.file))) {
    console.log('PEND  sfx take not delivered yet: ' + e.key + ' (' + e.file + ') — synth voice covers it');
    pending++;
    continue;
  }
  let tp = NaN, lufs = NaN;
  // the ebur128 summary lands on STDERR — that is the stream to parse
  const r = spawnSync(
    'ffmpeg',
    ['-hide_banner', '-nostats', '-i', join(root, 'src', e.file), '-af', 'ebur128=peak=true', '-f', 'null', '-'],
    { encoding: 'utf8' }
  );
  const out = (r.stderr || '') + (r.stdout || '');
  // the summary block: "I: -14.2 LUFS" then "Peak: 0.0 dBFS"
  const mI = /Integrated loudness:\s*\n\s*I:\s*(-?[\d.]+) LUFS/.exec(out);
  const mP = /True peak:\s*\n\s*Peak:\s*(-?[\d.]+) dBFS/.exec(out);
  if (mI) lufs = +mI[1];
  if (mP) tp = +mP[1];
  check('sfx take decodes: ' + e.key + ' (' + e.file + ')', r.status === 0 && Number.isFinite(tp));
  if (!Number.isFinite(tp)) continue;
  const effTP = tp + dB(e.trim);
  const effI = lufs + dB(e.trim); // gated integrated fails (-70) on sub-0.4s takes; shown as-is
  board.push({ key: e.key, trim: e.trim, tp, effTP, effI });
  // 0.05 dB of air over the gate: win.mp3 legitimately masters to exactly 0.0
  check('no clip at shipped trim: ' + e.key + ' (' + effTP.toFixed(1) + ' dBFS)', effTP <= 0.05);
}

if (pending) console.log('\n  ' + pending + ' declared take(s) still pending — the synth voice is what ships until they land');

board.sort((a, b) => b.effI - a.effI);
console.log('\n  loudness board (integrated LUFS at shipped trim, loud first — ears judge family, not this script)');
for (const b of board) {
  console.log(
    '    ' + b.key.padEnd(10) +
    ' eff ' + b.effI.toFixed(1).padStart(6) + ' LUFS' +
    '   truepeak ' + b.effTP.toFixed(1).padStart(5) + ' dBFS' +
    '   (trim ' + b.trim + ')'
  );
}

console.log(failures === 0 ? '\nSFX LEVELS PASS' : '\n' + failures + ' SFX LEVEL FAILURES');
process.exit(failures === 0 ? 0 : 1);
