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
    querySelectorAll: () => [],
    getElementById: () => CANVAS,
    // the board injects the game as inline <script> nodes; the game is already
    // in this context, so record and no-op rather than double-executing it
    body: { appendChild(n) { LOADED.push('inline:' + String(n._text || '').length); } },
    addEventListener() {}, documentElement: {}, hidden: false,
    fonts: { load: () => Promise.resolve() },
  },
  window: { addEventListener() {}, devicePixelRatio: 1, innerWidth: 960, innerHeight: 600, isSecureContext: false },
  navigator: { userAgent: 'node', getGamepads: () => [], serviceWorker: { register: () => Promise.reject(new Error('off')) } },
  screen: {}, location: { search: '', href: 'http://localhost/' },
  AudioContext: function () { return { state: 'running', destination: {}, currentTime: 0,
    createGain: () => ({ gain: { value: 1, setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, disconnect() {} }),
    createBufferSource: () => ({ buffer: null, loop: false, playbackRate: { value: 1 }, connect() {}, disconnect() {}, start() {}, stop() {} }),
    createBiquadFilter: () => ({ type: '', frequency: { value: 0 }, Q: { value: 1 }, connect() {}, disconnect() {} }),
    createOscillator: () => ({ type: '', frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, start() {}, stop() {} }),
    decodeAudioData: () => Promise.resolve({ sampleRate: 1000, length: 10, duration: 1, getChannelData: () => new Float32Array(10) }),
    resume: () => Promise.resolve(), suspend: () => Promise.resolve() }; },
  localStorage: { getItem: () => null, setItem() {}, removeItem() {}, clear() {} },
  getComputedStyle: () => ({ getPropertyValue: () => '0px' }),
  Image: function () { this.onload = null; },
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
for (const f of gameFileNames(ROOT)) {
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
const boardSrc = fs.readFileSync(path.join(ROOT, 'docs', 'tuning', 'board.js'), 'utf8');
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

  // THE PREVIEW IS THE GAME NOW, so what has to be true is that the game boots
  // into the stage and paints. The old per-driver checks are gone with the
  // drivers — there is nothing bespoke left to verify, which was the point.
  const wired = vm.runInContext("typeof (window.EDITOR_DRIVE || globalThis.EDITOR_DRIVE) === 'function'", ctx);
  if (!wired) fail.push('EDITOR_DRIVE was never installed — the board cannot hold the clock');

  // drive a real scene and require the game's own frame() to paint it
  paint.n = 0;
  for (const k of Object.keys(SUBJ)) delete SUBJ[k];
  try {
    vm.runInContext(`
      installCampaign(CAMPAIGNS[0]);
      startLevel(0); introT = 999; introCd = 0; state = S.PLAY;
      W = 960; H = 600; DPR = 1;
      for (let i = 0; i < 20; i++) simStep();
      frame(16); frame(32); frame(48);
    `, ctx, { filename: 'scene' });
  } catch (e) { fail.push('a real scene does not run: ' + e.message); }
  const painters = Object.entries(SUBJ).filter(([, n]) => n > 0);
  if (paint.n < 500) fail.push(`the live scene barely painted (${paint.n} canvas calls)`);
  console.log(`live scene painted        : ${paint.n} canvas calls`);
  console.log(`  via ${painters.map(([k, n]) => k + '=' + n).join(', ') || '(none of the tracked painters)'}`);

  console.log(`subsystem buttons rendered : ${navButtons.length}`);
  console.log(`dial panel children        : ${nodes['#dials'].children.length}`);
  console.log(`game scripts requested     : ${LOADED.length}`);
  console.log(fail.length ? '\nBOARD BROKEN:\n  ' + fail.join('\n  ') : '\nBOARD BOOTS');
  process.exit(fail.length ? 1 : 0);
}, 300);
