'use strict';
// THE TUNING BOARD, client side.
//
// Two rules shape everything here:
//
// 1. THE PREVIEW IS THE GAME. src/game/*.js is loaded in manifest order — the
//    real files, not a copy — and previews draw by repointing the game's own
//    `ctx` at a panel canvas, which is exactly how the game bakes its sprites.
//    The five labs that came before this one were deleted for copy-pasting
//    painters and drifting; there is nothing here to drift.
//
// 2. NOTHING IS WRITTEN UNTIL YOU COMMIT. Moving a dial changes the live value
//    in the loaded game so the preview answers immediately, and records the
//    pending edit. Source is only touched by Commit, which swaps literals in
//    place and leaves every comment standing.

// SCOPED IN AN IIFE, DELIBERATELY. This page loads the real game into the same
// document, and a classic script's top-level `const`/`let` land in the shared
// global lexical scope. `const state` here collided with `let state` in
// 40-state.js — a duplicate global binding is a SyntaxError, so that whole file
// silently failed to execute and every later preview died on a missing global
// with no clue which file was to blame. Declaring nothing globally makes that
// class of bug impossible. Assignments to the game's own `ctx`/`W`/`H`/`DPR`
// still work from in here: those are writes to an outer binding, not declarations.
(function () {
const $ = (s, r = document) => r.querySelector(s);
const el = (tag, cls, txt) => { const n = document.createElement(tag); if (cls) n.className = cls; if (txt != null) n.textContent = txt; return n; };

const state = {
  groups: [],
  current: null,
  pending: new Map(),   // "file::CONST::key" -> {file, constName, key, from, to}
  loaded: false,
  raf: 0,
};

// ---------------------------------------------------------------------------
// Load the real game, in order, minus its boot file. 99-boot.js ends with
// resize() and requestAnimationFrame(frame) — loading it would start an actual
// game underneath the board. Every painter lives in the files before it.
async function loadGame(files) {
  for (const f of files) {
    if (f === '99-boot.js') continue;
    await new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = '/game/' + f;
      s.async = false;
      s.onload = res;
      s.onerror = () => rej(new Error('failed to load ' + f));
      document.head.appendChild(s);
    });
  }
  state.loaded = true;

  // A script that THROWS still fires onload, so "it loaded" is not "it ran".
  // Check a sentinel global from each end of the chain and name the file that
  // failed, rather than letting the first preview report a bare ReferenceError.
  const SENTINELS = [
    ['00-core.js', 'ctx'], ['40-state.js', 'warpT'], ['41-geometry.js', 'geo'],
    ['80-tunnel.js', 'drawTunnel'], ['83-deepfield.js', 'drawStreaks'], ['90-hud.js', 'drawHUD'],
  ];
  const dead = SENTINELS.filter(([, g]) => {
    try { return eval('typeof ' + g) === 'undefined'; } catch (e) { return true; }
  });
  if (dead.length) {
    state.loaded = false;
    throw new Error('these files loaded but did not run: ' + dead.map(([f]) => f).join(', ')
      + ' — check the browser console for the SyntaxError');
  }
}

// Painters read W/H/DPR/ctx as globals. They are `let` in 00-core.js, which puts
// them in the shared global lexical scope — this script can borrow them, draw,
// and hand them back. `ctx` is documented as rebindable for exactly this.
function withStage(cv, draw) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = cv.clientWidth || 480, h = cv.clientHeight || 300;
  cv.width = w * dpr; cv.height = h * dpr;
  const c2 = cv.getContext('2d');
  const keep = { ctx, W, H, DPR };   // hand the game back exactly what it had
  try {
    ctx = c2; W = w; H = h; DPR = dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    draw(geo());
    return null;
  } catch (e) {
    return e;
  } finally {
    try { ctx = keep.ctx; W = keep.W; H = keep.H; DPR = keep.DPR; } catch (e) {}
  }
}

// ---------------------------------------------------------------------------
// PREVIEW DRIVERS. Each sets up only the state its painter needs, then calls the
// painter. They are deliberately thin: any logic here is logic that could drift.
const DRIVERS = {
  arcs(g) {
    drawTunnel(g);
    if (typeof nodes !== 'undefined' && nodes[0]) {
      nodes[0].angle = -Math.PI * 0.75;
      nodes[1].angle = -Math.PI * 0.25;
      for (const n of nodes) drawArcNode(n, g);
    }
  },
  enemies(g) {
    drawTunnel(g);
    const kinds = ['normal', 'double', 'heavy', 'frag'];
    kinds.forEach((k, i) => {
      const e = {
        type: k === 'normal' ? 'normal' : k, angle: (i / kinds.length) * Math.PI * 2 - Math.PI / 2,
        z: 0.30, lock: k === 'heavy' ? undefined : (i % 2 ? 0 : undefined),
        hp: 1, len: 0.1, q: 0, seed: i * 97,
      };
      try { drawEnemy(e, g); } catch (err) { /* a kind this build does not paint */ }
    });
  },
  streaks(g) {
    drawStarField();
    drawDeepField(g, 1 / 60);
    drawTunnel(g);
    drawStreaks(g, 1 / 60);
  },
  planet(g) {
    drawStarField();
    drawTunnel(g);
    if (typeof drawDestination === 'function') drawDestination(g);
    else if (typeof drawFarGlow === 'function') drawFarGlow({ x: g.cx, y: g.cy }, 90, g);
  },
  hud(g) {
    drawTunnel(g);
    if (typeof drawHUD === 'function') drawHUD(g);
  },
};

// ---------------------------------------------------------------------------
// Live value application. Writing straight into the loaded game's constant is
// what makes the preview honest — the painter reads the same object the game
// reads, so what you see is what Commit will write.
function applyLive(constName, key, value) {
  try {
    const target = window[constName] !== undefined ? window[constName] : eval(constName);
    if (key == null) {
      // scalar consts are `const`, so they cannot be reassigned at runtime;
      // the preview for these is necessarily static and Commit is the only path
      return false;
    }
    if (target && typeof target === 'object') { target[key] = value; return true; }
  } catch (e) {}
  return false;
}

function pendKey(file, constName, key) { return `${file}::${constName}::${key == null ? '' : key}`; }

function setPending(file, constName, key, from, to) {
  const k = pendKey(file, constName, key);
  if (JSON.stringify(from) === JSON.stringify(to)) state.pending.delete(k);
  else state.pending.set(k, { file, constName, key, from, to });
  syncHeader();
  renderNav();
}

function syncHeader() {
  const n = state.pending.size;
  const d = $('#dirty');
  d.textContent = n === 0 ? 'no changes' : n === 1 ? '1 change pending' : `${n} changes pending`;
  d.classList.toggle('on', n > 0);
  // per-KEY too: ARCFX.span is art everywhere except that it is also the zap
  // tolerance, so a const-level check alone would miss the one that matters most
  const sim = [...state.pending.values()].some(p =>
    SIM_KEYS.has(p.constName) || (p.key != null && SIM_KEYS.has(p.constName + '.' + p.key)));
  $('#commit').disabled = n === 0;
  $('#revert').disabled = n === 0;
  $('#commit').classList.toggle('sim', sim);
  $('#commit').textContent = sim ? 'Commit · sim' : 'Commit';
}

let SIM_KEYS = new Set();

// ---------------------------------------------------------------------------
function renderNav() {
  const nav = $('#nav');
  nav.textContent = '';
  nav.appendChild(el('div', 'navhead', 'Subsystems'));
  for (const g of state.groups) {
    const b = el('button', 'grp');
    b.setAttribute('aria-current', String(state.current === g.id));
    b.appendChild(el('span', null, g.title));
    if (g.simAffecting) b.appendChild(el('span', 'sim', 'sim'));
    const n = [...state.pending.values()].filter(p => g.consts.includes(p.constName)).length;
    const tag = el('span', 'n' + (n ? ' on' : ''), n ? String(n) : String(g.values.length));
    b.appendChild(tag);
    b.onclick = () => { state.current = g.id; renderNav(); renderGroup(); };
    nav.appendChild(b);
  }
}

function numberDial(host, g, c, key, spec) {
  const cur = spec.value;
  const row = el('div', 'dial');
  row.appendChild(el('label', null, key));
  // a dial that changes what a SCORE IS gets said so at the dial, not only in a
  // banner at the top of a long panel you may have scrolled past
  row.appendChild(spec.sim ? el('span', 'simtag', 'sim') : el('span'));
  const val = el('span', 'val', String(cur));
  row.appendChild(val);

  const line = el('div', 'row');
  const mag = Math.abs(cur) || 1;
  const lo = cur === 0 ? -1 : (cur > 0 ? 0 : cur * 2);
  const hi = cur === 0 ? 1 : (cur > 0 ? cur * 2.5 : 0);
  const step = mag >= 20 ? 1 : mag >= 2 ? 0.05 : 0.001;
  const range = el('input');
  range.type = 'range'; range.min = lo; range.max = hi; range.step = step; range.value = cur;
  range.setAttribute('aria-label', `${c.name} ${key}`);
  const reset = el('button', 'reset', 'reset');
  reset.disabled = true;

  const push = v => {
    val.textContent = String(v);
    row.classList.toggle('changed', v !== cur);
    row.classList.toggle('simdirty', spec.sim && v !== cur);
    reset.disabled = v === cur;
    applyLive(c.name, key, v);
    setPending(g.file, c.name, key, cur, v);
    schedulePreview();
  };
  range.oninput = () => push(Math.round(Number(range.value) / step) * step);
  reset.onclick = () => { range.value = cur; push(cur); };
  line.appendChild(range); line.appendChild(reset);
  row.appendChild(line);
  host.appendChild(row);
}

function colorDial(host, g, c, key, spec) {
  const cur = spec.value;
  const row = el('div', 'dial');
  row.appendChild(el('label', null, key));
  const isHex = /^#[0-9a-f]{3,8}$/i.test(cur);
  const swatch = el('input');
  swatch.type = isHex ? 'color' : 'hidden';
  if (isHex) swatch.value = cur.length === 4
    ? '#' + cur.slice(1).split('').map(ch => ch + ch).join('') : cur.slice(0, 7);
  row.appendChild(isHex ? swatch : el('span'));
  const val = el('span', 'val', isHex ? '' : '');
  row.appendChild(val);
  const line = el('div', 'row');
  const text = el('input'); text.type = 'text'; text.value = cur;
  text.setAttribute('aria-label', `${c.name} ${key}`);
  const push = v => {
    row.classList.toggle('changed', v !== cur);
    applyLive(c.name, key, v);
    setPending(g.file, c.name, key, cur, v);
    schedulePreview();
  };
  text.oninput = () => { if (isHex && /^#[0-9a-f]{6}$/i.test(text.value)) swatch.value = text.value; push(text.value); };
  if (isHex) swatch.oninput = () => { text.value = swatch.value; push(swatch.value); };
  line.appendChild(text);
  row.appendChild(line);
  host.appendChild(row);
}

function renderGroup() {
  const g = state.groups.find(x => x.id === state.current);
  const host = $('#dials');
  host.textContent = '';
  if (!g) { host.appendChild(el('p', 'empty', 'Pick a subsystem.')); return; }

  host.appendChild(el('h1', 'title', g.title));
  host.appendChild(el('p', 'blurb', g.blurb));

  if (g.simAffecting) {
    const w = el('div', 'warn');
    w.innerHTML = 'These values are part of <b>what a score is</b>. Committing here changes the '
      + 'simulation, so the deployed leaderboard verifier stops matching and real runs get rejected '
      + 'until you run <b>npm run deploy:verifier</b>.';
    host.appendChild(w);
  }

  for (const c of g.values) {
    const box = el('div', 'const');
    const head = el('div', 'constname');
    head.appendChild(el('span', null, c.name));
    if (c.simAffecting) head.appendChild(el('em', null, 'sim'));
    head.appendChild(el('span', 'constfile', g.file));
    box.appendChild(head);

    if (c.kind === 'missing') {
      box.appendChild(el('p', 'empty', 'not found in source: ' + c.error));
    } else if (c.kind === 'number') {
      numberDial(box, g, c, null, { value: c.value, sim: c.simAffecting });
      // a scalar const cannot be rebound at runtime, so say so rather than
      // letting the preview look broken
      const note = el('p', 'pvnote', 'scalar const — preview updates after Commit + reload');
      box.appendChild(note);
    } else if (c.kind === 'object') {
      const keys = Object.entries(c.value);
      if (!keys.length) box.appendChild(el('p', 'empty', 'no plain literals in this table'));
      for (const [key, spec] of keys) {
        if (spec.type === 'number') numberDial(box, g, c, key, spec);
        else if (spec.type === 'string') colorDial(box, g, c, key, spec);
      }
    } else {
      box.appendChild(el('p', 'empty', 'not a simple table — edit in source'));
    }
    host.appendChild(box);
  }
  renderPreview();
}

// ---------------------------------------------------------------------------
function schedulePreview() {
  if (state.raf) return;
  state.raf = requestAnimationFrame(() => { state.raf = 0; drawPreview(); });
}

function renderPreview() {
  const g = state.groups.find(x => x.id === state.current);
  const aside = $('#preview');
  aside.textContent = '';
  if (!g) return;
  aside.appendChild(el('div', 'pvhead', 'Preview'));
  if (!DRIVERS[g.preview]) {
    aside.appendChild(el('p', 'empty',
      'No canvas preview for this group — these values are timings and rules, not a look. '
      + 'The numbers are still live and Commit still writes them.'));
    return;
  }
  const stage = el('div', 'stage');
  const cv = el('canvas'); cv.id = 'stage';
  stage.appendChild(cv);
  aside.appendChild(stage);
  aside.appendChild(el('p', 'pvnote', 'drawn by the game’s own painters — src/game/*.js, loaded here'));
  drawPreview();
}

function drawPreview() {
  const g = state.groups.find(x => x.id === state.current);
  const cv = $('#stage');
  if (!g || !cv || !state.loaded || !DRIVERS[g.preview]) return;
  const err = withStage(cv, DRIVERS[g.preview]);
  const note = $('#preview .pvnote');
  if (note) {
    note.classList.toggle('err', !!err);
    note.textContent = err
      ? 'preview failed: ' + err.message
      : 'drawn by the game’s own painters — src/game/*.js, loaded here';
  }
}

// ---------------------------------------------------------------------------
function toast(msg, bad) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.toggle('bad', !!bad);
  t.classList.add('on');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('on'), bad ? 6000 : 3200);
}

async function commit() {
  const byFile = {};
  for (const p of state.pending.values()) {
    byFile[p.file] = byFile[p.file] || {};
    if (p.key == null) byFile[p.file][p.constName] = p.to;
    else {
      byFile[p.file][p.constName] = byFile[p.file][p.constName] || {};
      byFile[p.file][p.constName][p.key] = p.to;
    }
  }
  const res = await fetch('/api/commit', { method: 'POST', body: JSON.stringify(byFile) });
  const text = await res.text();
  if (!res.ok) return toast('Commit failed — ' + text, true);
  const out = JSON.parse(text);
  state.pending.clear();
  syncHeader();
  toast(out.simTouched
    ? 'Written. The sim changed — run npm run deploy:verifier before submitting scores.'
    : 'Written to ' + out.touched.join(', ') + ' — a .bak is beside each file.');
  await boot(true);
}

// ---------------------------------------------------------------------------
async function boot(reloadOnly) {
  const data = await (await fetch('/api/tuning')).json();
  state.groups = data.groups;
  SIM_KEYS = new Set(state.groups.flatMap(g => g.values.flatMap(v => [
    ...(v.simAffecting ? [v.name] : []),
    ...(v.kind === 'object' ? Object.entries(v.value).filter(([, sp]) => sp.sim).map(([k]) => v.name + '.' + k) : []),
  ])));
  if (!state.current) state.current = state.groups[0] && state.groups[0].id;
  if (!state.loaded && !reloadOnly) {
    try { await loadGame(data.gameFiles); }
    catch (e) { toast('The game did not load: ' + e.message + ' — dials still work, previews will not.', true); }
  }
  renderNav();
  renderGroup();
  syncHeader();
}

$('#commit').onclick = commit;
$('#revert').onclick = () => {
  state.pending.clear(); syncHeader();
  toast('Reverted — nothing had been written yet.');
  boot(true);
};
window.addEventListener('resize', () => schedulePreview());

fetch('/api/simid').then(r => r.ok ? r.text() : '').then(t => { if (t) $('#simid').textContent = t; }).catch(() => {});
boot();
})();
