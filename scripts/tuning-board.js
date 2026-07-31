#!/usr/bin/env node
// THE TUNING BOARD — desktop-only. NOT part of the store build.
//
//   npm run lab:tune   →   http://localhost:8012
//
// Every dial in the game, in one place, each with a preview drawn by the game's
// OWN painter. That last part is the whole design. The five labs that came
// before this were deleted because they copy-pasted the game's draw functions
// and then drifted — `drawEnemy` was 83 lines in the game and 45 in the lab, so
// the lab was quietly lying about what the game looked like.
//
// That cannot happen here: the board loads src/game/*.js, the real files, in
// manifest order. There is no second copy to drift. If a painter changes, the
// preview changes with it, because it IS the painter.
//
// Nothing is written until you press Commit, and a Commit swaps only the literals
// you moved — every comment and every alignment in those tables survives, which
// matters because the reasoning written around those numbers is worth more than
// the numbers.
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { gameFileNames } = require('./lib/game-source.js');
const { constSpan, patchConsts } = require('./lib/patch-source.js');

const root = path.join(__dirname, '..');
const boardDir = path.join(root, 'docs', 'tuning');
const gameDir = path.join(root, 'src', 'game');
const srcDir = path.join(root, 'src');
const port = process.env.PORT || 8012;

// ---------------------------------------------------------------------------
// THE REGISTRY — what is worth a dial, grouped the way you think about the game
// rather than the way the files are ordered. `preview` names a driver in the
// page; `consts` are the source constants the panel owns.
//
// Curated on purpose. Auto-discovery would sweep up SFX_FILES, NAME_LEET and
// every image handle, and a board full of things you must not touch is a board
// nobody trusts.
const REGISTRY = [
  { id: 'arcs', title: 'Arc nodes', preview: 'arcs', file: '41-geometry.js',
    blurb: 'The two emitters you actually drive. ARCFX is the look of the arc itself.',
    consts: ['ARCFX'] },
  { id: 'enemies', title: 'Enemy bodies', preview: 'enemies', file: '41-geometry.js',
    blurb: 'The glitch look, painted ON the wall. ENEMYFX covers the body, FRAGFX the node-killer.',
    consts: ['ENEMYFX', 'FRAGFX'] },
  { id: 'decomp', title: 'Decompile / death', preview: 'decomp', file: '52-bosses.js',
    blurb: 'How a body comes apart when it dies.',
    consts: ['DECOMP'] },
  { id: 'warp', title: 'Warp lane & streaks', preview: 'streaks', file: '82-destinations.js',
    blurb: 'The speed effect, and the gold convoy river on the floor of the bore. '
      + 'RIVER is live — spread moves the whole convoy while you drag it. Counts still live in initStreaks.',
    consts: ['RIVER', 'Z_FLOOR', 'WAKE_T'] },
  { id: 'dive', title: 'Warp dive (level entry)', preview: 'streaks', file: '40-state.js',
    blurb: 'The fly-IN at the start of a lane — NOT the arrival. WARP_DIVE seconds of it, '
      + 'during which the tunnel hots up and every streak stretches to five times its length. '
      + 'Set it to 0 to enter a lane already at speed.',
    consts: ['WARP_DIVE'] },
  { id: 'deep', title: 'Deep field', preview: 'streaks', file: '83-deepfield.js',
    blurb: 'Open space outside the lane, and how much of the wall rate it parallaxes at.',
    consts: ['DEEP_PARALLAX'] },
  { id: 'sky', title: 'Star bloom', preview: 'streaks', file: '20-background.js',
    blurb: 'What a bright star looks like when it flares. The halo curve itself is STAR_HALO in '
      + 'the source (a shape, not a dial); these are its reach, its peak, and the refraction streak.',
    consts: ['STARFX'] },
  { id: 'planets', title: 'Planets', preview: 'planet', file: '80-tunnel.js',
    blurb: 'The pixel shader at the end of the lane. PLANET_SHADE is the palette per world type.',
    consts: ['PLANET_REF_R', 'PLANET_CHIP_R', 'PLANET_STAR', 'DEST_MIX'] },
  { id: 'rings', title: 'Ringed worlds', preview: 'planet', file: '80-tunnel.js',
    blurb: 'Ring systems and their shading.',
    consts: ['RING_REF_R', 'FIELD_RING_K'] },
  { id: 'hud', title: 'HUD & briefing', preview: 'hud', file: '91-briefing.js',
    blurb: 'The holographic kit and the briefing card palette.',
    consts: ['INFO_PAL', 'POP_STRIPS'] },
  { id: 'boot', title: 'Boot & intro timing', preview: 'none', file: '40-state.js',
    blurb: 'The launch sequence clock. These are SECONDS and they are load-bearing for feel.',
    consts: ['BOOT_LOCK', 'BOOT_ON', 'INTRO_GATE', 'INTRO_DUR', 'BOSS_CER', 'RESET_HOLD', 'HOLD_BOSS'] },
  { id: 'play', title: 'Play feel', preview: 'none', file: '70-update.js',
    blurb: 'How forgiving the game is moment to moment.',
    consts: ['AIM_HOLD'] },
  { id: 'fair', title: 'Fairness', preview: 'none', file: '51-linter.js',
    blurb: 'Zap tolerance. Changing this changes what the verifier scores — redeploy after.',
    consts: ['WALL_TOL'] },
  { id: 'music', title: 'Soundtrack', preview: 'none', file: '11-music.js',
    blurb: 'Seams and fades, in seconds.',
    consts: ['MUSIC_FADEIN', 'MUSIC_FADEOUT', 'MUSIC_XFADE', 'MUSIC_LEAD', 'NP_DUR'] },
];

// Constants that feed the leaderboard verifier. Moving one changes what a score
// IS, so the board says so loudly rather than letting it be discovered later as
// "verification failed".
// Entries are a const name, or `CONST.key` where only one dial in a table is
// load-bearing. ARCFX.span is the example that matters: it is the arc's drawn
// half-span AND the zap tolerance the sim scores against — the source says
// "visual = mechanic" — so dragging it as art silently changes difficulty and
// invalidates every deployed verifier. A board that did not know this would be
// worse than no board.
const SIM_AFFECTING = new Set([
  'WALL_TOL', 'AIM_HOLD', 'INTRO_GATE', 'INTRO_DUR', 'BOOT_LOCK', 'BOOT_ON', 'BOSS_CER', 'HOLD_BOSS',
  'ARCFX.span',
]);
const simKey = (name, key) => SIM_AFFECTING.has(name) || (key != null && SIM_AFFECTING.has(name + '.' + key));

// ---------------------------------------------------------------------------
// Reading current values. The source is the truth — there is no cached copy to
// go stale, which is the failure the destinations lab hit twice.
function readConst(file, name) {
  const src = fs.readFileSync(path.join(gameDir, file), 'utf8');
  const span = constSpan(src, name);
  const body = src.slice(span.start, span.end);
  const eq = body.indexOf('=');
  const raw = body.slice(eq + 1).replace(/;\s*$/, '').trim();
  // strip trailing line comments so JSON5-ish parsing has a chance
  let value = null, kind = 'opaque';
  const scalar = raw.match(/^(-?\d*\.?\d+)/);
  if (scalar && !raw.startsWith('{') && !raw.startsWith('[')) { value = Number(scalar[1]); kind = 'number'; }
  else if (raw.startsWith('{')) { value = parseObjectLiterals(raw, name); kind = 'object'; }
  return { name, kind, value, raw: raw.slice(0, 400) };
}

// Pull `key: <literal>` pairs out of an object literal without evaluating it —
// the tables contain expressions and function calls that must not be run here,
// and anything not a plain literal is simply not offered as a dial.
function parseObjectLiterals(raw, owner) {
  const out = {};
  const re = /(?:^|[\s{,])([A-Za-z_$][\w$]*)\s*:\s*(-?\d*\.?\d+|'[^']*'|\[[^\]\n]*\])(?=\s*[,}\n])/g;
  let m;
  while ((m = re.exec(raw))) {
    const [, k, v] = m;
    if (k in out) continue;
    if (v[0] === "'") out[k] = { type: 'string', value: v.slice(1, -1) };
    else if (v[0] === '[') { try { out[k] = { type: 'array', value: JSON.parse(v) }; } catch (e) {} }
    else out[k] = { type: 'number', value: Number(v) };
    if (out[k]) out[k].sim = simKey(owner, k);
  }
  return out;
}

function buildPayload() {
  return REGISTRY.map(g => ({
    ...g,
    simAffecting: g.consts.some(c => [...SIM_AFFECTING].some(e => e === c || e.startsWith(c + '.'))),
    values: g.consts.map(c => {
      try { return { ...readConst(g.file, c), simAffecting: SIM_AFFECTING.has(c) }; }
      catch (e) { return { name: c, kind: 'missing', error: e.message }; }
    }),
  }));
}

// ---------------------------------------------------------------------------
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg', '.jpg': 'image/jpeg',
};
const send = (res, code, type, body) => {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(body);
};

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent(req.url.split('?')[0]);

  // the fingerprint of the sim as it stands, so the board's header can show
  // what the leaderboard verifier would have to match
  if (urlPath === '/api/simid') {
    try { return send(res, 200, 'text/plain', require('./lib/sim-id.js').simId(root)); }
    catch (e) { return send(res, 500, 'text/plain', e.message); }
  }

  if (urlPath === '/api/tuning') {
    try {
      const groups = buildPayload();
      // Scalar tuning values are declared `const`, so the loaded game cannot be
      // re-bound at runtime and their dials would move nothing. The board
      // unfreezes exactly these names to `let` as it loads the source — see
      // loadGame(). It is the only edit the board makes to what it runs, it
      // changes a binding and never a value, and the game files stay untouched.
      const scalars = groups.flatMap(g => g.values.filter(v => v.kind === 'number').map(v => v.name));
      return send(res, 200, TYPES['.json'], JSON.stringify({
        groups,
        gameFiles: gameFileNames(root),
        scalars: [...new Set(scalars)],
      }));
    } catch (e) { return send(res, 500, 'text/plain', e.message); }
  }

  if (urlPath === '/api/commit' && req.method === 'POST') {
    let body = '';
    req.on('data', c => { body += c; if (body.length > 4e6) req.destroy(); });
    req.on('end', () => {
      try {
        // { file: { CONST: {k:v} | scalar } } — grouped by file so each file is
        // read, patched and written exactly once
        const byFile = JSON.parse(body);
        const touched = [];
        for (const [file, updates] of Object.entries(byFile)) {
          if (!gameFileNames(root).includes(file)) throw new Error('not a game file: ' + file);
          patchConsts(path.join(gameDir, file), updates);
          touched.push(file);
        }
        const simTouched = Object.entries(byFile).some(([, u]) => Object.entries(u).some(([name, v]) =>
          SIM_AFFECTING.has(name) || (v && typeof v === 'object' && Object.keys(v).some(k => simKey(name, k)))));
        console.log('committed → ' + touched.join(', ') + (simTouched ? '  [SIM CHANGED — redeploy the verifier]' : ''));
        send(res, 200, TYPES['.json'], JSON.stringify({ ok: true, touched, simTouched }));
      } catch (e) { send(res, 400, 'text/plain', e.message); }
    });
    return;
  }

  // the REAL game files, plus fonts and art, so previews run the actual painters
  let filePath;
  if (urlPath.startsWith('/game/') || urlPath.startsWith('/fonts/') ||
      urlPath.startsWith('/audio/') || urlPath.startsWith('/icons/') ||
      urlPath.endsWith('.webp') || urlPath === '/campaigns.js') {
    filePath = path.join(srcDir, path.normalize(urlPath));
    if (!filePath.startsWith(srcDir)) return send(res, 403, 'text/plain', 'Forbidden');
  } else {
    filePath = path.join(boardDir, path.normalize(urlPath === '/' ? '/index.html' : urlPath));
    if (!filePath.startsWith(boardDir)) return send(res, 403, 'text/plain', 'Forbidden');
  }
  fs.readFile(filePath, (err, buf) => {
    if (err) return send(res, 404, 'text/plain', 'Not found: ' + urlPath);
    send(res, 200, TYPES[path.extname(filePath)] || 'application/octet-stream', buf);
  });
});

if (require.main === module) {
  server.listen(port, () => {
    console.log(`Tuning board on http://localhost:${port}`);
    console.log(`Previews run src/game/*.js directly — there is no second copy to drift.`);
    console.log(`Commits patch literals in place; a .bak is kept beside each file.`);
  });
}

module.exports = { REGISTRY, readConst, buildPayload, SIM_AFFECTING, simKey };
