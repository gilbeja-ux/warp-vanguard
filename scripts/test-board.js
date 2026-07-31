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
function mkEl(tag) {
  const n = {
    tagName: tag, children: [], attrs: {}, style: {}, className: '', _text: '',
    classList: { _s: new Set(), add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); },
      toggle(c, on) { on === undefined ? (this._s.has(c) ? this._s.delete(c) : this._s.add(c)) : (on ? this._s.add(c) : this._s.delete(c)); },
      contains(c) { return this._s.has(c); } },
    appendChild(c) { this.children.push(c); return c; },
    setAttribute(k, v) { this.attrs[k] = v; },
    getContext: () => null,
    addEventListener() {},
    get textContent() { return this._text; },
    set textContent(v) { this._text = v; if (v === '') this.children.length = 0; },
    get clientWidth() { return 480; }, get clientHeight() { return 300; },
  };
  return n;
}
const nodes = {};
for (const id of ['nav', 'dials', 'preview', 'toast', 'simid', 'dirty', 'commit', 'revert']) nodes['#' + id] = mkEl('div');
nodes['#commit'].disabled = false;
nodes['#revert'].disabled = false;

const payload = { groups: buildPayload(), gameFiles: gameFileNames(ROOT) };

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
  fetch: (url) => Promise.resolve({
    ok: true,
    json: () => Promise.resolve(payload),
    text: () => Promise.resolve(url.includes('simid') ? 'deadbeef' : '{}'),
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

let boardErr = null;
process.on('uncaughtException', e => { boardErr = e; });
try { vm.runInContext(fs.readFileSync(path.join(ROOT, 'docs', 'tuning', 'board.js'), 'utf8'), ctx, { filename: 'board.js' }); }
catch (e) { boardErr = e; }

setTimeout(() => {
  const fail = [];
  if (boardErr) fail.push('board.js threw: ' + boardErr.message);

  const navButtons = nodes['#nav'].children.filter(c => c.className === 'grp');
  if (!navButtons.length) fail.push('renderNav produced no subsystem buttons');

  const dialsText = nodes['#dials']._text;
  if (dialsText && dialsText.includes('Loading the game')) fail.push('#dials still says "Loading the game…" — boot never finished');
  if (!nodes['#dials'].children.length) fail.push('renderGroup produced no content');

  console.log(`subsystem buttons rendered : ${navButtons.length}`);
  console.log(`dial panel children        : ${nodes['#dials'].children.length}`);
  console.log(`game scripts requested     : ${LOADED.length}`);
  console.log(fail.length ? '\nBOARD BROKEN:\n  ' + fail.join('\n  ') : '\nBOARD BOOTS');
  process.exit(fail.length ? 1 : 0);
}, 300);
