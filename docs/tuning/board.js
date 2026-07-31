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
// ---------------------------------------------------------------------------
// THE PREVIEW IS A RUNNING GAME.
//
// Not a driver written for the board — an actual run, booted into the stage
// canvas and held on a leash. This is the same trick src/editor.js uses to embed
// the game in the Lane Designer, and it is here for the reason that tool exists:
// every preview bug on this board came from inventing a scene instead of running
// one. Bodies with no birth age. A ring that lived inside frame(). Enemies flying
// backwards because a hand-rolled loop counted depth the wrong way. None of that
// is possible now, because nothing is hand-rolled — the game draws itself.
//
// The one hook is EDITOR_DRIVE, which the game's own frame() already consults:
// return 0 and the world freezes (draw only), return dt*k and it runs at k speed.
const SCENE = { camp: 0, level: 0, playing: true, speed: 1, booted: false };

async function bootGame(files, scalars) {
  const stage = document.querySelector('.stage');
  // the preview pane IS the game's window — resize() sizes off these
  Object.defineProperty(window, 'innerWidth', { get: () => stage.clientWidth, configurable: true });
  Object.defineProperty(window, 'innerHeight', { get: () => stage.clientHeight, configurable: true });
  // never register the game's service worker from a tool (stale-cache hazard)
  try {
    Object.defineProperty(navigator, 'serviceWorker', {
      value: { register: () => Promise.reject(new Error('tuning board: sw disabled')) }, configurable: true,
    });
  } catch (e) {}

  // the clock leash, read by frame() in 99-boot.js
  window.EDITOR_DRIVE = (dt) => {
    if (!SCENE.playing) return 0;         // frozen: the world holds, drawing continues
    integrity = 100;                      // a tuning preview never flatlines mid-look
    return dt * SCENE.speed;
  };

  // UNFREEZING THE SCALARS. Tuning values like DEEP_PARALLAX are `const`, so
  // their dials could never move the running game. The board rewrites
  // `const NAME =` to `let NAME =` for exactly the names it offers, as it loads.
  // It is the only edit made to what runs; it changes a binding, never a value.
  const unfreeze = new RegExp('^const (' + (scalars || []).join('|') + ')\\s*=', 'gm');
  for (const f of ['campaigns.js', 'audio/music/tracks.js']) {
    await inject(await (await fetch('/' + f)).text(), f);
  }
  for (const f of files) {
    let text = await (await fetch('/game/' + f)).text();
    if (scalars && scalars.length) text = text.replace(unfreeze, 'let $1 =');
    await inject(text, 'game/' + f);
  }
  // index.html still carries the soundtrack manifest inline — the game needs it
  const shell = await (await fetch('/shell')).text().catch(() => '');
  for (const m of shell.matchAll(/<script>([\s\S]*?)<\/script>/g)) await inject(m[1], 'shell');

  // a tool session must never touch the real save, or make noise
  try { saveState = () => {}; } catch (e) {}
  try { settings.sound = false; settings.music = false; settings.haptics = false; } catch (e) {}
  try { progress.tutorialDone = progress.bossBriefed = progress.stripBriefed = progress.wallBriefed = true; } catch (e) {}

  UI.loaded = true;
  SCENE.booted = true;
}

// executes synchronously, in order, in this page's global scope — the same way
// the editor injects it, and the reason the game's globals are reachable here
function inject(src, name) {
  const s = document.createElement('script');
  s.textContent = src + '\n//# sourceURL=/' + name;
  document.body.appendChild(s);
  return Promise.resolve();
}

// Put the running game into a named scene. startLevel is the game's own entry
// point, so what plays is what ships.
function playScene(campIdx, levelIdx2) {
  if (!SCENE.booted) return;
  try {
    const camp = CAMPAIGNS[campIdx] || CAMPAIGNS[0];
    if (camp && (!CAMP || CAMP.id !== camp.id)) installCampaign(camp);
    SCENE.camp = campIdx;
    SCENE.level = Math.min(levelIdx2, (LEVELS || []).length - 1);
    startLevel(SCENE.level);
    introT = 999; introCd = 0;   // skip the boot ceremony — a preview is already deployed
    state = S.PLAY;
  } catch (e) { note('scene failed: ' + e.message, true); }
}

function sceneName() {
  try {
    const c = CAMPAIGNS[SCENE.camp], lv = (LEVELS || [])[SCENE.level];
    return `${(c && c.title) || 'campaign'} · ${(lv && lv.name) || 'level ' + (SCENE.level + 1)}`;
  } catch (e) { return 'no scene'; }
}

// ---------------------------------------------------------------------------
// Live value application. Writing straight into the loaded game's constant is
// what makes the preview honest — the painter reads the same object the game
// reads, so what you see is what Commit will write.
function applyLive(constName, key, value) {
  try {
    if (key == null) {
      // a scalar: assignable because bootGame unfroze it to `let`
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
// The game owns its own rAF loop, so a changed dial shows up on the very next
// frame with nothing for the board to schedule. This exists only so callers
// need not care.
function schedulePreview() {}

function note(msg, bad) {
  const n = $('#pvinfo');
  if (!n) return;
  n.textContent = msg;
  n.className = 'pvnote' + (bad ? ' err' : '');
}

// The preview panel: what scene is running, and the controls to drive it. These
// are the SAME verbs the game already has — pick a lane, play, freeze, change
// speed — not a vocabulary invented for this tool.
function renderPreview() {
  const g = UI.groups.find(x => x.id === UI.current);
  const ctl = $('#pvctl');
  if (!ctl) return;
  ctl.textContent = '';
  if (!UI.loaded) { note('the game did not load — dials still write, previews will not', true); return; }

  // a panel may name the scene that shows its subject best
  if (g && g.scene && !SCENE.pinned) {
    const c = CAMPAIGNS.findIndex(x => x.id === g.scene.camp);
    playScene(c < 0 ? 0 : c, g.scene.level || 0);
  }
  note(sceneName());

  const box = el('div', 'pvctl');
  box.appendChild(el('div', 'pvhead', 'Scene'));

  // campaign, by title
  const campRow = el('div', 'ctl');
  campRow.appendChild(el('label', null, 'contract'));
  campRow.appendChild(el('span'));
  const campLine = el('div', 'row');
  (CAMPAIGNS || []).forEach((c, i) => {
    const b = el('button', 'pill' + (i === SCENE.camp ? ' on' : ''), c.title || c.id);
    b.onclick = () => { SCENE.pinned = true; playScene(i, 0); renderPreview(); };
    campLine.appendChild(b);
  });
  campRow.appendChild(campLine);
  box.appendChild(campRow);

  // level, by NAME — the game's own names, never an index
  const lvRow = el('div', 'ctl');
  lvRow.appendChild(el('label', null, 'lane'));
  lvRow.appendChild(el('span'));
  const lvLine = el('div', 'row');
  (LEVELS || []).forEach((lv, i) => {
    const b = el('button', 'pill' + (i === SCENE.level ? ' on' : ''), lv.name || 'lane ' + (i + 1));
    b.onclick = () => { SCENE.pinned = true; playScene(SCENE.camp, i); renderPreview(); };
    lvLine.appendChild(b);
  });
  lvRow.appendChild(lvLine);
  box.appendChild(lvRow);

  // transport
  box.appendChild(el('div', 'pvhead', 'Playback'));
  const tr = el('div', 'ctl');
  tr.appendChild(el('label', null, 'transport'));
  tr.appendChild(el('span'));
  const trLine = el('div', 'row');
  const playBtn = el('button', 'pill' + (SCENE.playing ? ' on' : ''), SCENE.playing ? 'pause' : 'play');
  playBtn.onclick = () => {
    SCENE.playing = !SCENE.playing;
    playBtn.textContent = SCENE.playing ? 'pause' : 'play';
    playBtn.classList.toggle('on', SCENE.playing);
  };
  trLine.appendChild(playBtn);
  const again = el('button', 'pill', 'restart');
  again.onclick = () => playScene(SCENE.camp, SCENE.level);
  trLine.appendChild(again);
  for (const sp of [0.25, 0.5, 1, 2, 4]) {
    const b = el('button', 'pill' + (sp === SCENE.speed ? ' on' : ''), sp + '\u00d7');
    b.onclick = () => {
      SCENE.speed = sp;
      [...trLine.children].forEach(x => { if (x.textContent.endsWith('\u00d7')) x.classList.toggle('on', x === b); });
    };
    trLine.appendChild(b);
  }
  tr.appendChild(trLine);
  box.appendChild(tr);
  ctl.appendChild(box);
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
    try { await bootGame(data.gameFiles, data.scalars); }
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
