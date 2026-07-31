#!/usr/bin/env node
// SMOKE-TEST THE BOARD ITSELF.
//
// Three board bugs shipped in a row — a global collision, a shadowed `state`,
// and a stale `state.pending` the rename missed — and every one of them got past
// a green harness, because the harness only ever exercised the GAME's painters
// and never ran a line of board.js. This runs the board's own boot path against
// the real payload and asserts it actually renders.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..');
const { gameFileNames } = require('./lib/game-source.js');
const { buildPayload } = require('./tuning-board.js');

// --- a DOM stub with just enough behaviour for the board to build its UI ---
// A REAL canvas refuses non-finite coordinates. The permissive stub used
// elsewhere swallows NaN, which is how a broken preview once passed headlessly
// and then died in Chrome. This one fails where Chrome fails.
const STRICT = new Set(['createLinearGradient', 'createRadialGradient', 'arc', 'arcTo', 'ellipse',
  'moveTo', 'lineTo', 'rect', 'fillRect', 'strokeRect', 'clearRect', 'quadraticCurveTo',
  'bezierCurveTo', 'translate', 'scale', 'rotate', 'setTransform', 'drawImage', 'roundRect']);
const paint = { n: 0 };
const grad = { addColorStop() {} };
const CTX2D = new Proxy({}, {
  get: (t, k) => {
    if (k === 'canvas') return { width: 0, height: 0 };
    if (k === 'createImageData') return (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) });
    return (...a) => {
      paint.n++;
      if (STRICT.has(k)) for (let i = 0; i < a.length; i++) {
        if (typeof a[i] === 'number' && !Number.isFinite(a[i])) throw new TypeError(`${k}: argument ${i} is ${a[i]}`);
      }
      return String(k).startsWith('create') ? grad : (k === 'measureText' ? { width: 10 } : undefined);
    };
  },
  set: () => true,
});

function mkEl(tag) {
  const n = {
    tagName: tag, children: [], attrs: {}, style: {}, className: '', _text: '',
    classList: { _s: new Set(), add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); },
      toggle(c, on) { on === undefined ? (this._s.has(c) ? this._s.delete(c) : this._s.add(c)) : (on ? this._s.add(c) : this._s.delete(c)); },
      contains(c) { return this._s.has(c); } },
    appendChild(c) { this.children.push(c); return c; },
    setAttribute(k, v) { this.attrs[k] = v; },
    getContext: () => CTX2D,
    addEventListener() {},
    get textContent() { return this._text; },
    set textContent(v) { this._text = v; if (v === '') this.children.length = 0; },
    get clientWidth() { return 480; }, get clientHeight() { return 300; },
  };
  return n;
}
const nodes = {};
for (const id of ['nav', 'dials', 'preview', 'toast', 'simid', 'dirty', 'commit', 'revert', 'stage']) nodes['#' + id] = mkEl('div');
nodes['#preview .pvnote'] = mkEl('p');
nodes['#commit'].disabled = false;
nodes['#revert'].disabled = false;

const payload = { groups: buildPayload(), gameFiles: gameFileNames(ROOT) };
const SUBJ = {};

const sandbox = {
  console,
  document: {
    querySelector: (s) => nodes[s] || null,
    createElement: mkEl,
    head: { appendChild(s) { LOADED.push(s.src); if (s.onload) setImmediate(s.onload); } },
    getElementById: () => CANVAS,
    body: { appendChild() {} }, addEventListener() {}, documentElement: {}, hidden: false,
    fonts: { load: () => Promise.resolve() },
  },
  window: { addEventListener() {}, devicePixelRatio: 1, innerWidth: 960, innerHeight: 600 },
  performance: { now: () => 0 },
  requestAnimationFrame: () => 0, cancelAnimationFrame: () => {},
  setTimeout, clearTimeout, setImmediate,
  __paint: null, __subj: null,   // filled in below, so the vm can measure one painter
  Blob: function (parts) { this.parts = parts; },
  URL: { createObjectURL: () => 'blob:stub', revokeObjectURL() {} },
  fetch: (url) => Promise.resolve({
    ok: true,
    json: () => Promise.resolve(payload),
    // game files are already in this context; the board only needs their text
    // to exist so its const->let unfreeze pass has something to run on
    text: () => Promise.resolve(url.includes('simid') ? 'deadbeef'
      : url.startsWith('/game/') ? fs.readFileSync(path.join(ROOT, 'src', url.slice(1)), 'utf8') : '{}'),
  }),
};
const CANVAS = mkEl('canvas');
const LOADED = [];
sandbox.globalThis = sandbox;
const ctx = vm.createContext(sandbox);

// The board loads the game itself in the browser; here the game is already in the
// context, so the injected <script> tags just resolve.
for (const pre of ['campaigns.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, 'src', pre), 'utf8'), ctx, { filename: pre });
for (const f of gameFileNames(ROOT).filter(f => f !== '99-boot.js')) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'src', 'game', f), 'utf8'), ctx, { filename: f });
}

// WRAP THE PAINTER EACH PREVIEW EXISTS TO SHOW. Counting total canvas calls is
// useless as a check: a preview whose subject is invisible still paints a
// starfield and looks busy. That is exactly how bodies with a zero birth fade
// passed — drawEnemy returned before its first stroke and nothing noticed.
// So each driver is tied to the ONE painter it is there to show, and that
// painter has to contribute strokes of its own.
sandbox.__paint = paint;
sandbox.__subj = SUBJ;
const SUBJECT_OF = { arcs: 'drawNodes', enemies: 'drawEnemy', decomp: 'drawGhost',
  streaks: 'drawStreaks', planet: 'drawFarGlow', hud: 'drawHUD' };
for (const fn of new Set(Object.values(SUBJECT_OF))) {
  vm.runInContext(`{
    const _orig = ${fn};
    ${fn} = function (...a) {
      const before = __paint.n;
      try { return _orig.apply(this, a); }
      finally { __subj[${JSON.stringify(fn)}] = (__subj[${JSON.stringify(fn)}] || 0) + (__paint.n - before); }
    };
  }`, ctx, { filename: 'wrap:' + fn });
}

let boardErr = null;
process.on('uncaughtException', e => { boardErr = e; });
const boardSrc = fs.readFileSync(path.join(ROOT, 'docs', 'tuning', 'board.js'), 'utf8')
  .replace('const DRIVERS = {', 'const DRIVERS = globalThis.__DRIVERS = {');
try { vm.runInContext(boardSrc, ctx, { filename: 'board.js' }); }
catch (e) { boardErr = e; }

setTimeout(() => {
  const fail = [];
  if (boardErr) fail.push('board.js threw: ' + boardErr.message);

  const navButtons = nodes['#nav'].children.filter(c => c.className === 'grp');
  if (!navButtons.length) fail.push('renderNav produced no subsystem buttons');

  const dialsText = nodes['#dials']._text;
  if (dialsText && dialsText.includes('Loading the game')) fail.push('#dials still says "Loading the game…" — boot never finished');
  if (!nodes['#dials'].children.length) fail.push('renderGroup produced no content');

  // Every preview painted with its own default controls — the board's OWN
  // drivers, lifted from board.js rather than re-typed here. A copy is exactly
  // how the deleted labs drifted from the game.
  const names = vm.runInContext('Object.keys(__DRIVERS || {})', ctx);
  for (const name of names) {
    paint.n = 0;
    for (const k of Object.keys(SUBJ)) delete SUBJ[k];
    try {
      for (let fr = 0; fr < 3; fr++) {
        vm.runInContext(`W=960;H=600;DPR=1;{
          const d = __DRIVERS[${JSON.stringify(name)}];
          const C = {}; for (const c of (d.controls || [])) C[c.id] = c.value;
          state = S.PLAY; laneFlow = 1; runVis = 1; tolVis = 1; introT = 999; warpT = 0;
          endSweep = -1; endT = 0; endWin = false; time = ${(fr + 1) * 0.4};
          lanePlanetProg = (d.world && d.world.progress) || 0.5;
          trafficSpeed = (d.world && d.world.speed) || 0.4;
          d.draw(geo(), 1 / 60, C);
        }`, ctx, { filename: 'driver:' + name });
      }
      // "It did not throw" is not "it drew something". drawEnemy returns before
      // painting when a body's birth fade is zero, which is exactly how bodies
      // stayed invisible while every harness reported success. So each preview
      // is run AGAIN with its backdrop toggles off: what is left is the subject,
      // and the subject has to paint.
      const want = SUBJECT_OF[name];
      const drew = want ? (SUBJ[want] || 0) : null;
      if (want && drew <= 0) fail.push(`preview "${name}" never painted its subject — ${want}() contributed 0 strokes`);
      console.log(`  preview ${name.padEnd(9)} ok   ${String(paint.n).padStart(6)} calls · ${want}() drew ${drew}`);
    } catch (e) {
      fail.push(`preview "${name}" throws: ${e.message}`);
    }
  }

  console.log(`subsystem buttons rendered : ${navButtons.length}`);
  console.log(`dial panel children        : ${nodes['#dials'].children.length}`);
  console.log(`game scripts requested     : ${LOADED.length}`);
  console.log(fail.length ? '\nBOARD BROKEN:\n  ' + fail.join('\n  ') : '\nBOARD BOOTS');
  process.exit(fail.length ? 1 : 0);
}, 300);
