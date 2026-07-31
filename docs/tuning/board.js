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

// Named UI, not `state`. The game has a global `state` (the run's mode) and this
// file shares its scope; calling this one `state` shadowed the game's and made
// `state = S.PLAY` in withWorld throw "Assignment to constant variable" — the
// board was assigning to its own const. Nothing here may take a game global's name.
const UI = {
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
async function loadGame(files, scalars) {
  // UNFREEZING THE SCALARS. Tuning values like DEEP_PARALLAX and PLANET_REF_R are
  // declared `const`, so a slider for them could change the source on Commit but
  // could never move the preview — half the board's dials did nothing at all.
  //
  // So the board rewrites `const NAME =` to `let NAME =` for exactly the names
  // the registry offers as dials, as it loads. It is the ONLY edit made to what
  // the board runs; it changes a binding's mutability and never a value, and the
  // files on disk are untouched. Everything else is the game verbatim.
  const unfreeze = new RegExp('^const (' + (scalars || []).join('|') + ')\\s*=', 'gm');
  for (const f of files) {
    if (f === '99-boot.js') continue;
    let text = await (await fetch('/game/' + f)).text();
    if (scalars && scalars.length) text = text.replace(unfreeze, 'let $1 =');
    await new Promise((res, rej) => {
      const s = document.createElement('script');
      // a Blob keeps the file's identity in stack traces, so an error still
      // names the game file rather than a data: URL
      s.src = URL.createObjectURL(new Blob([text + '\n//# sourceURL=/game/' + f], { type: 'text/javascript' }));
      s.async = false;
      s.onload = () => { URL.revokeObjectURL(s.src); res(); };
      s.onerror = () => rej(new Error('failed to load ' + f));
      document.head.appendChild(s);
    });
  }
  UI.loaded = true;

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
    UI.loaded = false;
    throw new Error('these files loaded but did not run: ' + dead.map(([f]) => f).join(', ')
      + ' — check the browser console for the SyntaxError');
  }
}

// Painters read W/H/DPR/ctx as globals. They are `let` in 00-core.js, which puts
// them in the shared global lexical scope — this script can borrow them, draw,
// and hand them back. `ctx` is documented as rebindable for exactly this.
function withStage(cv, draw, dt) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = cv.clientWidth || 480, h = cv.clientHeight || 300;
  if (cv.width !== Math.round(w * dpr)) { cv.width = w * dpr; cv.height = h * dpr; }
  const c2 = cv.getContext('2d');
  const keep = { ctx, W, H, DPR };   // hand the game back exactly what it had
  try {
    ctx = c2; W = w; H = h; DPR = dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    withWorld(() => draw(geo(), dt));
    return null;
  } catch (e) {
    return e;
  } finally {
    try { ctx = keep.ctx; W = keep.W; H = keep.H; DPR = keep.DPR; } catch (e) {}
  }
}

// A RUNNING world, borrowed for the length of one draw.
//
// This is what was missing. The painters are gated on run state — laneFlow
// multiplies EVERY streak, runVis fades the whole run out, drawNodes reads
// introT, and the destination only grows once laneProgress climbs. Drawn in the
// menu's parked world the painters were behaving perfectly and correctly drawing
// almost nothing, which reads as "the preview is broken".
function withWorld(fn) {
  const keep = { state, laneFlow, runVis, introT, time, warpT, levelT, lanePlanetProg, endSweep, endT, endWin, tolVis, trafficSpeed };
  try {
    state = S.PLAY;
    laneFlow = 1; runVis = 1; tolVis = 1;
    introT = 999;                 // past the boot gate: hardware is up
    warpT = 0;                    // not mid-dive
    endSweep = -1; endT = 0; endWin = false;
    lanePlanetProg = WORLD.progress;
    trafficSpeed = WORLD.speed;
    time = WORLD.t;
    fn();
  } finally {
    state = keep.state; laneFlow = keep.laneFlow; runVis = keep.runVis; introT = keep.introT;
    time = keep.time; warpT = keep.warpT; levelT = keep.levelT; lanePlanetProg = keep.lanePlanetProg;
    endSweep = keep.endSweep; endT = keep.endT; endWin = keep.endWin; tolVis = keep.tolVis;
    trafficSpeed = keep.trafficSpeed;
  }
}

// The preview clock. Streaks, the deep field and the lane medium are MOTION —
// a still frame of them says nothing about what you just changed, so previews
// run continuously while one is on screen and stop when it is not.
const WORLD = { t: 0, progress: 0.55, speed: 0.4, raf: 0, last: 0, bodies: null, bodiesKey: null, ctl: {} };

// The preview clock. Streaks, the deep field and the de-rez are MOTION — a still
// frame of them says nothing about the value you just moved — so a mounted
// preview runs continuously and stops the moment it is not on screen.
function startLoop() {
  if (WORLD.raf) return;
  WORLD.last = performance.now();
  const tick = (now) => {
    WORLD.raf = 0;
    const dt = Math.min(0.05, (now - WORLD.last) / 1000);
    WORLD.last = now;
    WORLD.t += dt;
    drawPreview(dt);
    if (currentDriver()) WORLD.raf = requestAnimationFrame(tick);
  };
  WORLD.raf = requestAnimationFrame(tick);
}
function stopLoop() { if (WORLD.raf) cancelAnimationFrame(WORLD.raf); WORLD.raf = 0; }

// Each preview needs its SUBJECT framed, not a generic view of the lane with the
// thing you are tuning somewhere in it. Deep field wants the lane running fast;
// planets want the world arrived and large; bodies want to sit at the ring where
// they are biggest. This is the difference between a preview and a screenshot.
// ---------------------------------------------------------------------------
// PREVIEW DRIVERS.
//
// Each one SHOWS THE THING ITS PANEL ADJUSTS, at a size you can judge, with
// whatever controls that subject needs to be testable — a body scale, an
// approach speed, a trigger for a one-shot animation. A preview you cannot drive
// is a screenshot.
//
// Every driver enters the game WHERE THE GAME ENTERS IT: drawNodes rather than
// drawArcNode, spawnEnemy rather than an object literal, decompile() rather than
// a hand-built ghost. Reaching past a wrapper is what put a NaN in a gradient.
const DRIVERS = {
  arcs: {
    world: { progress: 0.35, speed: 0.45 },
    controls: [
      { id: 'sweep', label: 'node sweep', min: 0, max: 1, step: 0.01, value: 0.35 },
      { id: 'dip', label: 'discharge dip', min: 0, max: 1, step: 0.01, value: 0 },
      { id: 'ring', label: 'show ring', type: 'toggle', value: 1 },
      { id: 'lane', label: 'show lane', type: 'toggle', value: 1 },
    ],
    draw(g, dt, C) {
      if (C.lane) lane(g, dt); else backdrop(g, dt);
      if (C.ring) drawHolderRing(g);
      nodes[0].angle = -Math.PI * 0.72 + Math.sin(WORLD.t * 0.6) * C.sweep;
      nodes[1].angle = -Math.PI * 0.28 + Math.cos(WORLD.t * 0.5) * C.sweep;
      nodes[0].dip = nodes[1].dip = C.dip;
      drawNodes(g);
    },
  },

  enemies: {
    world: { progress: 0.30, speed: 0.30 },
    controls: [
      { id: 'kind', label: 'body', type: 'pick', options: ['all', 'normal', 'line', 'heavy', 'frag', 'strip'], value: 'all' },
      { id: 'scale', label: 'body scale', min: 0.5, max: 4, step: 0.05, value: 2.2 },
      { id: 'depth', label: 'depth', min: 0.1, max: 1, step: 0.01, value: 0.34 },
      { id: 'approach', label: 'fly in', type: 'toggle', value: 0 },
      { id: 'ring', label: 'show ring', type: 'toggle', value: 1 },
      { id: 'lane', label: 'show lane', type: 'toggle', value: 1 },
    ],
    draw(g, dt, C) {
      if (C.lane) lane(g, dt); else backdrop(g, dt);
      if (C.ring) drawHolderRing(g);
      const kinds = C.kind === 'all' ? ['normal', 'line', 'heavy', 'frag'] : [C.kind];
      const keep = enemies.slice();
      try {
        if (!WORLD.bodies || WORLD.bodiesKey !== C.kind) {
          enemies.length = 0;
          kinds.forEach((k, i) => {
            const e = spawnEnemy((i / kinds.length) * Math.PI * 2 - Math.PI / 2, k);
            if (e) e.__i = i / kinds.length;
          });
          WORLD.bodies = enemies.slice();
          WORLD.bodiesKey = C.kind;
        }
        for (const e of WORLD.bodies) {
          e.sizeMul = C.scale;                       // the painter's own scale hook
          // AGE IS WHY BODIES WERE INVISIBLE. drawEnemy multiplies its alpha by
          // birthFade(en) = age/0.35 and returns outright below 0.005, and `age`
          // is advanced by the sim — which a preview does not run. Spawned bodies
          // sat there fully formed at zero opacity. The preview owns the clock
          // here, so it ages them itself.
          e.age = (e.age || 0) + dt;
          // z is DEPTH: the lane runs toward the player, so an approaching body's
          // z falls. Counting it up flew them backwards out of the bore.
          e.z = C.approach
            ? 0.95 - ((WORLD.t * 0.12 + e.__i) % 1) * 0.85
            : C.depth;
          if (C.approach && e.z > 0.92) e.age = 0;   // fresh at the horizon: re-show the birth
        }
        enemies.length = 0;
        for (const e of WORLD.bodies) enemies.push(e);
        for (const e of WORLD.bodies) drawEnemy(e, g);
      } finally { enemies.length = 0; for (const e of keep) enemies.push(e); }
    },
  },

  decomp: {
    world: { progress: 0.30, speed: 0.25 },
    controls: [
      { id: 'kind', label: 'body', type: 'pick', options: ['normal', 'line', 'heavy', 'frag'], value: 'normal' },
      { id: 'scale', label: 'body scale', min: 0.5, max: 4, step: 0.05, value: 2.4 },
      { id: 'rate', label: 'replay every', min: 0.4, max: 4, step: 0.1, value: 1.4, unit: 's' },
      { id: 'ring', label: 'show ring', type: 'toggle', value: 1 },
      { id: 'lane', label: 'show lane', type: 'toggle', value: 0 },
    ],
    draw(g, dt, C) {
      if (C.lane) lane(g, dt); else backdrop(g, dt);
      if (C.ring) drawHolderRing(g);
      // Ghosts come from the game's own decompile(), so what you are watching is
      // the real de-rez, not a re-creation of it.
      const keep = ghosts.slice();
      try {
        WORLD.killT = (WORLD.killT || 0) - dt;
        if (WORLD.killT <= 0) {
          WORLD.killT = C.rate;
          ghosts.length = 0;
          const e = spawnEnemy(-Math.PI / 2, C.kind);
          if (e) { e.sizeMul = C.scale; e.age = 1; decompile(-Math.PI / 2, g.hitZ * 1.15, e, 1); }
          const born = ghosts.slice();
          enemies.length = 0;
          WORLD.ghosts = born;
        }
        ghosts.length = 0;
        for (const gh of (WORLD.ghosts || [])) { gh.t += dt; if (gh.t < DECOMP.glitchT) ghosts.push(gh); }
        for (const gh of ghosts) drawGhost(gh, g);
      } finally { ghosts.length = 0; for (const gh of keep) ghosts.push(gh); }
    },
  },

  streaks: {
    world: { progress: 0.20, speed: 1.15 },
    controls: [
      { id: 'speed', label: 'lane speed', min: 0, max: 3, step: 0.05, value: 1.15 },
      { id: 'flow', label: 'lane flow', min: 0, max: 1, step: 0.01, value: 1 },
      { id: 'dive', label: 'warp dive', min: 0, max: 0.9, step: 0.01, value: 0 },
      { id: 'tunnel', label: 'show tunnel', type: 'toggle', value: 1 },
    ],
    draw(g, dt, C) {
      WORLD.speed = C.speed; laneFlow = C.flow; warpT = C.dive;
      drawStarField();
      drawDeepField(g, dt);
      if (C.tunnel) drawTunnel(g);
      drawLaneMedium(g, dt);
      drawStreaks(g, dt);
    },
  },

  planet: {
    world: { progress: 1, speed: 0.25 },
    controls: [
      { id: 'progress', label: 'arrival', min: 0, max: 1, step: 0.01, value: 1 },
      { id: 'level', label: 'world', type: 'pick', options: ['0', '1', '2', '3', '4', '5', '6', '7'], value: '3' },
      { id: 'tunnel', label: 'show tunnel', type: 'toggle', value: 1 },
    ],
    draw(g, dt, C) {
      WORLD.progress = C.progress;
      lanePlanetProg = C.progress;
      levelIdx = +C.level;
      drawStarField();
      drawDeepField(g, dt);
      if (C.tunnel) drawTunnel(g); else drawFarGlow(ring(SPAWN_Z, g), g.nodeR, g);
    },
  },

  hud: {
    world: { progress: 0.55, speed: 0.4 },
    controls: [
      { id: 'integrity', label: 'integrity', min: 0, max: 100, step: 1, value: 62 },
      { id: 'combo', label: 'combo', min: 0, max: 10, step: 1, value: 4 },
      { id: 'score', label: 'score', min: 0, max: 60000, step: 100, value: 12500 },
    ],
    draw(g, dt, C) {
      lane(g, dt);
      integrity = C.integrity; combo = C.combo; score = C.score;
      drawHolderRing(g);
      drawNodes(g);
      drawHUD(g);
    },
  },
};

// shared backdrops — the lane, or just the space it runs through
function lane(g, dt) {
  drawStarField();
  drawDeepField(g, dt);
  drawTunnel(g);
  drawLaneMedium(g, dt);
  drawStreaks(g, dt);
}
function backdrop(g, dt) { drawStarField(); drawDeepField(g, dt); }

function currentDriver() {
  const g = UI.groups.find(x => x.id === UI.current);
  return g && DRIVERS[g.preview] ? DRIVERS[g.preview] : null;
}

// live control values for the mounted preview, keyed by control id
function ctlValues(drv) {
  const out = {};
  for (const c of drv.controls || []) out[c.id] = WORLD.ctl[c.id] !== undefined ? WORLD.ctl[c.id] : c.value;
  return out;
}

// ---------------------------------------------------------------------------
// Live value application. Writing straight into the loaded game's constant is
// what makes the preview honest — the painter reads the same object the game
// reads, so what you see is what Commit will write.
function applyLive(constName, key, value) {
  try {
    if (key == null) {
      // a scalar: assignable because loadGame unfroze it to `let`
      eval(constName + ' = ' + JSON.stringify(value));
      return true;
    }
    const target = eval(constName);
    if (target && typeof target === 'object') { target[key] = value; return true; }
  } catch (e) {}
  return false;
}

function pendKey(file, constName, key) { return `${file}::${constName}::${key == null ? '' : key}`; }

function setPending(file, constName, key, from, to) {
  const k = pendKey(file, constName, key);
  if (JSON.stringify(from) === JSON.stringify(to)) UI.pending.delete(k);
  else UI.pending.set(k, { file, constName, key, from, to });
  syncHeader();
  renderNav();
}

function syncHeader() {
  const n = UI.pending.size;
  const d = $('#dirty');
  d.textContent = n === 0 ? 'no changes' : n === 1 ? '1 change pending' : `${n} changes pending`;
  d.classList.toggle('on', n > 0);
  // per-KEY too: ARCFX.span is art everywhere except that it is also the zap
  // tolerance, so a const-level check alone would miss the one that matters most
  const sim = [...UI.pending.values()].some(p =>
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
  for (const g of UI.groups) {
    const b = el('button', 'grp');
    b.setAttribute('aria-current', String(UI.current === g.id));
    b.appendChild(el('span', null, g.title));
    if (g.simAffecting) b.appendChild(el('span', 'sim', 'sim'));
    const n = [...UI.pending.values()].filter(p => g.consts.includes(p.constName)).length;
    const tag = el('span', 'n' + (n ? ' on' : ''), n ? String(n) : String(g.values.length));
    b.appendChild(tag);
    b.onclick = () => { UI.current = g.id; renderNav(); renderGroup(); };
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
  const g = UI.groups.find(x => x.id === UI.current);
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
    } else if (c.kind === 'object') {
      const dials = Object.entries(c.value);
      if (!dials.length) box.appendChild(el('p', 'empty', 'no plain literals in this table'));
      for (const [key, spec] of dials) {
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
// the loop already redraws every frame; this only matters if it is not running
function schedulePreview() { if (!WORLD.raf) drawPreview(); }

const PVNOTE = 'drawn by the game’s own painters — src/game/*.js, loaded here';

function renderPreview() {
  const g = UI.groups.find(x => x.id === UI.current);
  const aside = $('#preview');
  stopLoop();
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
  aside.appendChild(el('p', 'pvnote', PVNOTE));
  if (!UI.loaded) {
    const n = $('#preview .pvnote');
    if (n) { n.classList.add('err'); n.textContent = 'the game did not load — previews unavailable'; }
    return;
  }
  const drv = DRIVERS[g.preview];
  const w = drv.world || {};
  WORLD.progress = w.progress != null ? w.progress : 0.55;
  WORLD.speed = w.speed != null ? w.speed : 0.4;
  WORLD.bodies = null; WORLD.bodiesKey = null; WORLD.ghosts = null; WORLD.killT = 0;
  WORLD.ctl = {};
  for (const c of drv.controls || []) WORLD.ctl[c.id] = c.value;
  aside.appendChild(controlStrip(drv));
  startLoop();
}

// The controls a SUBJECT needs to be testable — scale it, drive it, freeze it,
// trigger the one-shot. Separate from the dials on the left, which change the
// game; nothing here is ever written to source.
function controlStrip(drv) {
  const box = el('div', 'pvctl');
  if (!drv.controls || !drv.controls.length) return box;
  box.appendChild(el('div', 'pvhead', 'Preview controls'));
  for (const c of drv.controls) {
    const row = el('div', 'ctl');
    row.appendChild(el('label', null, c.label));
    const val = el('span', 'val', c.type === 'toggle' ? (c.value ? 'on' : 'off') : String(c.value) + (c.unit || ''));
    row.appendChild(val);
    const line = el('div', 'row');

    if (c.type === 'toggle') {
      const b = el('button', 'pill' + (c.value ? ' on' : ''), c.value ? 'on' : 'off');
      b.onclick = () => {
        const next = WORLD.ctl[c.id] ? 0 : 1;
        WORLD.ctl[c.id] = next;
        b.textContent = next ? 'on' : 'off'; val.textContent = next ? 'on' : 'off';
        b.classList.toggle('on', !!next);
        schedulePreview();
      };
      line.appendChild(b);
    } else if (c.type === 'pick') {
      for (const opt of c.options) {
        const b = el('button', 'pill' + (opt === c.value ? ' on' : ''), opt);
        b.onclick = () => {
          WORLD.ctl[c.id] = opt;
          WORLD.bodies = null; WORLD.bodiesKey = null;   // the subject changed
          [...line.children].forEach(x => x.classList.toggle('on', x === b));
          val.textContent = opt;
          schedulePreview();
        };
        line.appendChild(b);
      }
    } else {
      const r = el('input');
      r.type = 'range'; r.min = c.min; r.max = c.max; r.step = c.step; r.value = c.value;
      r.setAttribute('aria-label', c.label);
      r.oninput = () => {
        WORLD.ctl[c.id] = Number(r.value);
        val.textContent = r.value + (c.unit || '');
        schedulePreview();
      };
      line.appendChild(r);
    }
    row.appendChild(line);
    box.appendChild(row);
  }
  return box;
}

function drawPreview(dt) {
  const drv = currentDriver();
  const cv = $('#stage');
  if (!drv || !cv || !UI.loaded) return;
  const C = ctlValues(drv);
  const err = withStage(cv, (g, d) => drv.draw(g, d, C), dt || 1 / 60);
  const note = $('#preview .pvnote');
  if (note) {
    note.classList.toggle('err', !!err);
    note.textContent = err ? 'preview failed: ' + err.message : PVNOTE;
  }
  if (err) stopLoop();   // a broken painter must not spin at 60fps throwing
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
  for (const p of UI.pending.values()) {
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
  UI.pending.clear();
  syncHeader();
  toast(out.simTouched
    ? 'Written. The sim changed — run npm run deploy:verifier before submitting scores.'
    : 'Written to ' + out.touched.join(', ') + ' — a .bak is beside each file.');
  await boot(true);
}

// ---------------------------------------------------------------------------
async function boot(reloadOnly) {
  const data = await (await fetch('/api/tuning')).json();
  UI.groups = data.groups;
  SIM_KEYS = new Set(UI.groups.flatMap(g => g.values.flatMap(v => [
    ...(v.simAffecting ? [v.name] : []),
    ...(v.kind === 'object' ? Object.entries(v.value).filter(([, sp]) => sp.sim).map(([k]) => v.name + '.' + k) : []),
  ])));
  if (!UI.current) UI.current = UI.groups[0] && UI.groups[0].id;
  if (!UI.loaded && !reloadOnly) {
    try { await loadGame(data.gameFiles); }
    catch (e) { toast('The game did not load: ' + e.message + ' — dials still work, previews will not.', true); }
  }
  renderNav();
  renderGroup();
  syncHeader();
}

$('#commit').onclick = commit;
$('#revert').onclick = () => {
  // Put the ORIGINAL values back into the loaded game first. Clearing the
  // pending list alone left the preview showing edits that no longer existed
  // anywhere — the dials said one thing and the canvas another.
  for (const p of UI.pending.values()) applyLive(p.constName, p.key, p.from);
  UI.pending.clear();
  syncHeader();
  toast('Reverted — nothing had been written yet.');
  boot(true);
};
window.addEventListener('resize', () => schedulePreview());

fetch('/api/simid').then(r => r.ok ? r.text() : '').then(t => { if (t) $('#simid').textContent = t; }).catch(() => {});
boot();
})();
