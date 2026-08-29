#!/usr/bin/env node
// Fill the candidate drop tree from Kenney's CC0 audio packs.
//
//   npm run sfx:fetch          download (cached), convert, file into incoming/<cue>/
//   npm run sfx:fetch -- --force   re-copy even where a candidate already exists
//
// WHAT IT DOES
//   1. downloads the six pack zips into .cache/sfx-packs/ (skipped if present)
//   2. unzips them there
//   3. for every cue in scripts/sfx-candidates.js, converts each candidate to
//      WAV and writes it into src/audio/sfx/incoming/<cue>/
//
// WHY WAV. The packs are Ogg Vorbis. iOS Safari cannot decode Ogg, so an ogg
// candidate would audition perfectly in Chrome on the soundboard and then be
// SILENT on the phone — the worst failure mode available, because it passes every
// check on the desk. Converting on the way in means what Gil auditions is what
// ships. ffmpeg does the work; the script stops with a clear message without it.
//
// The filename carries the pack, the original name and the measured duration —
// `sci-fi__forceField_000__0.95s.wav` — so the board's list is readable and a
// take that is too long for its cue is obvious before it is ever played.
const fs = require('fs');
const path = require('path');
const { execFileSync, execSync } = require('child_process');
const { CANDIDATES, PACK_SOURCES } = require('./sfx-candidates.js');
const { SFX_ROSTER, TAKE_ROSTER } = require('./sfx-roster.js');
const { SFX_SEARCH } = require('./sfx-search.js');

const root = path.join(__dirname, '..');
const CACHE = path.join(root, '.cache/sfx-packs');
const INBOX = path.join(root, 'src/audio/sfx/incoming');
const force = process.argv.includes('--force');

function have(cmd) {
  try { execSync('command -v ' + cmd, { stdio: 'ignore' }); return true; } catch (e) { return false; }
}
if (!have('ffmpeg')) {
  console.error('! ffmpeg is required to convert the packs (brew install ffmpeg).');
  console.error('  Without it every candidate would land as .ogg, which iOS cannot decode.');
  process.exit(1);
}

// ---- 1 + 2: the packs, cached ------------------------------------------------
fs.mkdirSync(CACHE, { recursive: true });
for (const [name, url] of Object.entries(PACK_SOURCES)) {
  const dir = path.join(CACHE, name);
  if (fs.existsSync(dir) && fs.readdirSync(dir).length) { console.log('· ' + name + ' (cached)'); continue; }
  const zip = path.join(CACHE, name + '.zip');
  console.log('↓ ' + name);
  execFileSync('curl', ['-sL', '--max-time', '180', '-o', zip, url], { stdio: 'inherit' });
  fs.mkdirSync(dir, { recursive: true });
  execFileSync('unzip', ['-qo', zip, '-d', dir], { stdio: 'inherit' });
  fs.unlinkSync(zip);
}

const dur = f => {
  try {
    return parseFloat(execFileSync('ffprobe',
      ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f], { encoding: 'utf8' }).trim());
  } catch (e) { return 0; }
};

// LENGTH IS A CONSTRAINT. The brief in sfx-search.js gives each cue a window;
// this reads the ceiling out of it so a candidate that overruns can be MARKED
// rather than quietly offered as an equal. Kenney's engine and computer beds are
// a flat 5.00s of real sound, not padding, so this is the difference between "a
// surge cue" and "five seconds of engine playing over the next four hostiles".
function ceiling(len) {
  if (!len) return null;
  let m = (len || '').match(/([\d.]+)\s*[–-]\s*([\d.]+)\s*s/); if (m) return +m[2];
  m = len.match(/UNDER\s*([\d.]+)/i); if (m) return +m[1];
  m = len.match(/([\d.]+)\s*s\s*exactly/i); if (m) return +m[1] * 1.2;
  m = len.match(/~\s*([\d.]+)\s*s/); if (m) return +m[1] * 1.6; // "~1.2s" — a little slack
  m = len.match(/([\d.]+)\s*s/); if (m) return +m[1] * 1.6;      // a bare "0.2s" is a target, not a wall
  return null;
}

// ---- 3: file the candidates --------------------------------------------------
const roster = SFX_ROSTER.concat(TAKE_ROSTER);
let wrote = 0, skipped = 0, missing = [], over = [];
for (const [key, list] of Object.entries(CANDIDATES)) {
  const cue = roster.find(e => e.key === key);
  if (!cue) { missing.push(key + ' (no such cue in the roster)'); continue; }
  const dir = path.join(INBOX, key);
  fs.mkdirSync(dir, { recursive: true });
  const cap = ceiling((SFX_SEARCH[key] || {}).len);

  // measure first, then order: everything that FITS keeps my order, everything
  // that overruns follows it. Both the list and the NEXT button walk the folder
  // in name order, so the 01 slot is what NEXT plays first — it must be a take
  // that could actually ship.
  // an entry is either a pack path or a cut: { from, ss, t, as }
  const found = list.map(e => (typeof e === 'string'
      ? { rel: e, src: path.join(CACHE, e), name: path.basename(e, path.extname(e)) }
      : { rel: e.from, src: path.join(CACHE, e.from), name: e.as, cut: e }))
    .filter(c => { if (fs.existsSync(c.src)) return true; missing.push(key + ' ← ' + c.rel); return false; })
    .map(c => Object.assign(c, { d: c.cut ? c.cut.t : dur(c.src) }));
  const fits = c => cap === null || c.d <= cap;
  const ordered = found.filter(fits).concat(found.filter(c => !fits(c)));
  if (cap !== null && !found.some(fits)) over.push(key + ' (every candidate is over ' + cap + 's)');

  ordered.forEach((c, i) => {
    const pack = c.cut ? 'cut' : c.rel.split('/')[0];
    // a `~` in front of the pack name is the overrun flag — visible in the board's
    // list, in Finder, and in the order file if one is ever picked
    const out = path.join(dir, String(i + 1).padStart(2, '0') + '__' + (fits(c) ? '' : '~') + pack
      + '__' + c.name + '__' + c.d.toFixed(2) + 's.wav');
    if (fs.existsSync(out) && !force) { skipped++; return; }
    // a cut gets a 12ms fade at each end — a hard splice out of a running bed
    // clicks, and a click is the one artefact the ear never forgives
    const args = ['-v', 'error', '-y'];
    if (c.cut) args.push('-ss', String(c.cut.ss), '-t', String(c.cut.t));
    args.push('-i', c.src, '-ac', '1', '-ar', '44100');
    if (c.cut) args.push('-af', 'afade=t=in:st=0:d=0.012,afade=t=out:st=' + Math.max(0, c.cut.t - 0.012) + ':d=0.012');
    args.push(out);
    execFileSync('ffmpeg', args);
    wrote++;
  });
}

console.log('\ncandidates: ' + wrote + ' written, ' + skipped + ' already there');
if (missing.length) {
  console.log('! ' + missing.length + ' not found — the pack layout may have changed:');
  missing.slice(0, 12).forEach(m => console.log('    ' + m));
}
const cues = Object.keys(CANDIDATES).length;
console.log(cues + ' cue folder(s) filled under src/audio/sfx/incoming/');
if (over.length) {
  console.log('\n! ' + over.length + ' cue(s) have NO candidate inside their length brief —');
  console.log('  every take there is marked `~` and needs a cut before it ships:');
  over.forEach(o => console.log('    ' + o));
}
console.log('\nnpm run lab:sound  →  RESCAN  →  audition  →  SAVE ORDER');
console.log('then tell Claude: implement the sfx order');
