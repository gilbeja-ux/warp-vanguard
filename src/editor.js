'use strict';
// ============================================================
// TUNNEL DESIGNER — Phase 2 campaign editor (desktop only).
// editor.html embeds the REAL game (the inline script from index.html is
// injected verbatim) and drives its clock through the EDITOR_DRIVE hook.
// The ED namespace below is pure and DOM-free — scripts/test.js evals this
// file headless and unit-tests it. Everything past the __EDITOR_PAGE__
// guard is page wiring. NOT part of the store build (see docs/CMS-ROADMAP.md).
// NOTE: every top-level name here is ed-prefixed — the game script is
// injected into the same global scope later, so collisions would throw.
// ============================================================

const ED = {
  // ---------- primitives ----------
  clone(o) { return JSON.parse(JSON.stringify(o)); },
  norm(a) { const TAU = Math.PI * 2; a %= TAU; return a < 0 ? a + TAU : a; },
  angDiff(a, b) {
    const TAU = Math.PI * 2;
    let d = (a - b) % TAU;
    if (d > Math.PI) d -= TAU;
    if (d < -Math.PI) d += TAU;
    return d;
  },
  snap(t, step) { step = step || 0.1; return +(Math.round(t / step) * step).toFixed(2); },
  // timeline math: 0..duration maps linearly onto 0..w pixels
  t2x(t, dur, w) { return dur > 0 ? t / dur * w : 0; },
  x2t(x, dur, w) { return w > 0 ? Math.max(0, Math.min(dur, x / w * dur)) : 0; },
  clampComm(m) { return String(m).slice(0, 64); },
  tintToHex(tint) {
    const p = String(tint || '').split(',').map(n => Math.max(0, Math.min(255, parseInt(n, 10) || 0)));
    while (p.length < 3) p.push(0);
    return '#' + p.slice(0, 3).map(n => n.toString(16).padStart(2, '0')).join('');
  },
  hexToTint(hex) {
    const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
    return m ? parseInt(m[1], 16) + ',' + parseInt(m[2], 16) + ',' + parseInt(m[3], 16) : '0,0,0';
  },

  // ---------- factories ----------
  // No `name`. A relay is named by the route it flies, and that is generated
  // from the chart — see edRouteName(). A field here would be a second label
  // that nothing displays, which is exactly what this format just shed.
  newLevel() {
    return {
      tint: '80,160,255', duration: 45,
      spawnMin: 1.2, spawnMax: 2.0, speed: 0.4,
      doubles: 0, heavies: 0, lines: 0, colors: 0, track: 0,
      story: { title: 'LOG — NEW STAGE', lines: ['edit this briefing'] },
      comms: []
    };
  },
  newCampaign() {
    return {
      id: 'new-campaign', format: 1, title: 'NEW CAMPAIGN', tagline: 'UNTITLED CONTRACT', difficulty: 1,
      story: 'describe the contract here.',
      map: { theme: 'chart' },
      speakers: [{ id: 'OMNI', name: 'Meridian Haulage', color: '111,227,255' }],
      levels: [ED.newLevel()]
    };
  },
  makeBeat(tool, t, angle) {
    if (tool === 'wall') return { t, kind: 'wall', angle };
    if (tool === 'strip') return { t, kind: 'strip' };
    if (tool === 'pickup') return { t, kind: 'pickup' };
    if (tool === 'lull') return { t, kind: 'lull', dur: 4 };
    return { t, kind: 'enemy', type: tool, angle }; // normal|heavy|line|lock0|lock1
  },

  // ---------- beat mutators (always keep beats sorted by t) ----------
  clampBeatT(level, beat, t) {
    const max = beat.kind === 'lull' ? level.duration - (beat.dur || 1) : level.duration - 0.1;
    return Math.max(0, Math.min(ED.snap(t), Math.max(0, ED.snap(max))));
  },
  addBeat(level, beat) {
    if (!level.beats) level.beats = [];
    beat.t = ED.clampBeatT(level, beat, beat.t);
    level.beats.push(beat);
    level.beats.sort((a, b) => a.t - b.t);
    return beat;
  },
  retimeBeat(level, beat, t) {
    beat.t = ED.clampBeatT(level, beat, t);
    (level.beats || []).sort((a, b) => a.t - b.t);
    return beat.t;
  },
  deleteBeat(level, beat) {
    const i = (level.beats || []).indexOf(beat);
    if (i < 0) return false;
    level.beats.splice(i, 1);
    if (!level.beats.length) delete level.beats;
    return true;
  },
  // wall-vs-wall: a wall owns its stretch of the rail from release
  // (t - travel: the telegraph rides in with the traffic) until burn-off
  // (t + 3.6). A second wall inside that window whose arc overlaps (both
  // half-spans + node tolerance = 1.3 — the engine's reachability law) would
  // be golden-angle hopped; the editor surfaces that as a conflict CHOICE
  // (cancel / auto-place / override), never a silent fix.
  wallFits(level, t, angle, trav) {
    for (const w of level.beats || []) {
      if (w.kind !== 'wall') continue;
      if (Math.abs(w.t - t) >= trav + 3.6) continue; // rim windows clear of each other
      if (angle === undefined || w.angle === undefined)
        return { ok: false, why: 'window overlaps the seeded-arc wall at ' + w.t + 's' };
      if (Math.abs(ED.angDiff(angle, w.angle)) < 1.3)
        return { ok: false, why: 'arc overlaps the wall at ' + w.t + 's' };
    }
    return { ok: true };
  },
  // ---------- track packing (video-editor semantics) ----------
  // display time-extent of a beat — generous enough that chips never collide
  // visually. trav/speed come from the level (tests pass them explicitly).
  beatExtent(b, opts) {
    const trav = (opts && opts.trav) || 4.6, speed = (opts && opts.speed) || 0.4;
    if (b.kind === 'wall') return [b.t - trav, b.t + 3.6];    // telegraph ride-in + burn-off
    if (b.kind === 'strip') return [b.t, b.t + 0.85 / speed]; // longest head-to-tail ride
    if (b.kind === 'lull') return [b.t, b.t + (b.dur || 1)];
    return [b.t - 0.8, b.t + 0.8];                            // enemy / pickup chip
  },
  // greedy first-fit onto packed tracks: sorted by extent start, each beat
  // takes the LOWEST track whose previous occupant has already ended —
  // touching edges share a track, only genuine overlap opens a new one.
  // Returns one track index per beat, aligned to the INPUT order.
  packLanes(beats, opts) {
    const order = beats.map((b, i) => i)
      .sort((a, b2) => ED.beatExtent(beats[a], opts)[0] - ED.beatExtent(beats[b2], opts)[0]);
    const ends = []; // per-track end of the last placed extent
    const out = new Array(beats.length).fill(0);
    for (const i of order) {
      const ex = ED.beatExtent(beats[i], opts);
      let k = ends.findIndex(e => ex[0] >= e - 1e-9);
      if (k < 0) { k = ends.length; ends.push(ex[1]); }
      else ends[k] = ex[1];
      out[i] = k;
    }
    return out;
  },

  // ---------- band mutators ----------
  addBand(level, t0, t1) {
    if (!level.bands) level.bands = [];
    const b = { t0: ED.snap(t0), t1: ED.snap(t1), intensity: 1.5 };
    level.bands.push(b);
    ED.normalizeBands(level);
    return (level.bands || []).includes(b) ? b : null;
  },
  // clamp into [0, duration], order the windows, clip overlaps (the later
  // band yields) and drop slivers — output always passes validateCampaign
  normalizeBands(level) {
    const bs = level.bands || [];
    for (const b of bs) {
      b.t0 = Math.max(0, Math.min(+b.t0 || 0, level.duration));
      b.t1 = Math.max(0, Math.min(+b.t1 || 0, level.duration));
      if (b.t1 < b.t0) { const s = b.t0; b.t0 = b.t1; b.t1 = s; }
    }
    bs.sort((a, b) => a.t0 - b.t0);
    for (let i = 1; i < bs.length; i++) bs[i].t0 = Math.max(bs[i].t0, bs[i - 1].t1);
    const keep = bs.filter(b => b.t1 - b.t0 >= 0.5);
    if (keep.length) level.bands = keep; else delete level.bands;
    return level.bands || [];
  },

  // ---------- level ops ----------
  addLevel(pkg, i) {
    const l = ED.newLevel();
    pkg.levels.splice(i === undefined ? pkg.levels.length : i, 0, l);
    return l;
  },
  removeLevel(pkg, i) {
    if (pkg.levels.length <= 1) return false; // a campaign is never empty
    pkg.levels.splice(i, 1);
    return true;
  },
  moveLevel(pkg, from, to) {
    if (to < 0 || to >= pkg.levels.length || from === to || !pkg.levels[from]) return from;
    const l = pkg.levels.splice(from, 1)[0];
    pkg.levels.splice(to, 0, l);
    return to;
  },

  // ---------- package I/O ----------
  exportJSON(pkg) { return JSON.stringify(pkg, null, 2); },
  exportEntry(pkg) {
    return '// paste inside CAMPAIGN_PACKAGES in src/campaigns.js (mind the comma)\n' + JSON.stringify(pkg, null, 2);
  },
  // validate is injected (the game's validateCampaign) so this stays DOM-free
  importJSON(text, validate) {
    let pkg;
    try { pkg = JSON.parse(text); } catch (e) { return { errors: ['not valid JSON: ' + e.message] }; }
    const errs = (validate || (() => []))(pkg);
    return errs.length ? { errors: errs } : { pkg };
  },

  // the in-game enemy color language — toolbox underlines, timeline markers,
  // beat-list chips and filler ticks all speak it: normal/barrier RED, heavy
  // PURPLE, locks BLUE/WHITE, node-killer BLACK, wall latch-ORANGE
  // (255,150,60), bonus stream + power-up GOLD, lull neutral gray-blue
  colors: {
    normal: '#ff5468', heavy: '#d465ff', line: '#ff5468', lock0: '#4d9bff',
    lock1: '#ffffff', wall: '#ff963c', strip: '#ffd24a',
    pickup: '#ffd24a', lull: '#46608c'
  },
  chip(key) {
    const c = ED.colors[key] || '#46608c';
    if (key === 'pickup') return { bg: 'transparent', bd: c, tick: c };    // gold RING — the solid gold chip is the strip
    if (key === 'line') return { bg: c, bd: '#ff8ba0', tick: c };          // red base, pinkish beam accent
    if (key === 'lock1') return { bg: c, bd: '#5a6a85', tick: c };
    if (key === 'lull') return { bg: 'rgba(70,96,140,0.27)', bd: '#7ea2d8', tick: '#7ea2d8' };
    return { bg: c, bd: '#000', tick: c };
  },
  beatKey(b) { return b.kind === 'enemy' ? (b.type || 'normal') : b.kind; }
};
globalThis.ED = ED;

// ============================================================
// page wiring — only on editor.html (scripts/test.js stops above)
// ============================================================
const EDUI = {
  pkg: null, li: 0, playhead: 0, scrubMs: 0,
  mode: 'edit',            // 'edit' | 'play' (preview) | 'live' (real input)
  tool: 'select', selBeat: null, selBand: null, selComm: -1,
  errs: [], sources: [], applyT: 0, seekT: 0, seekRaf: 0,
  walk: null,              // lintWalk of the active level — filler lane + wall predictions
  ghost: null, ghostEv: null, ghostRaf: 0, flash: null, flashT: 0,
  markerOf: null,          // beat -> timeline marker element (hover highlight)
  commRows: [], closedTracks: new Set(), dlg: null,
  dragging: false, booted: false
};
const EDTOOLS = ['select', 'normal', 'heavy', 'line', 'lock0', 'lock1', 'wall', 'strip', 'pickup', 'lull'];
const EDPICKUPS = ['', 'shield', 'wide', 'auto', 'inject', 'chain'];
const EDKNOBS = ['doubles', 'heavies', 'lines', 'colors', 'walls'];
const EDMIX = ['doubles', 'heavies', 'lines', 'colors', 'walls'];

function edq(id) { return document.getElementById(id); }
function edLv() { return EDUI.pkg.levels[EDUI.li]; }
function edEl(tag, cls, parent) {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (parent) parent.appendChild(el);
  return el;
}
function edReadFile(file, cb) {
  const r = new FileReader();
  r.onload = () => cb(String(r.result));
  r.readAsDataURL(file);
}

// ---------- boot: embed the real game ----------
async function edBoot() {
  const stage = edq('edStage');
  // The game is authored as ordered files in src/game/ and loaded by index.html
  // as ordered <script src> tags. This used to lift the ONE inline <script> out
  // of index.html; after the split that block is just the soundtrack manifest, so
  // the editor booted with no game in it at all. Load the manifest's files, in
  // its order, then whatever inline blocks index.html still carries.
  const html = await (await fetch('index.html')).text();
  const manifest = await (await fetch('game/manifest.json')).json();
  const files = await Promise.all(manifest.files.map(f => fetch('game/' + f.file).then(r => r.text())));
  const inline = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  const blocks = [...files, ...inline];
  // the preview pane IS the game's window — resize() sizes off these
  Object.defineProperty(window, 'innerWidth', { get: () => stage.clientWidth, configurable: true });
  Object.defineProperty(window, 'innerHeight', { get: () => stage.clientHeight, configurable: true });
  // never register the game's service worker from the editor (stale-cache hazard on localhost)
  try {
    Object.defineProperty(navigator, 'serviceWorker', {
      value: { register: () => Promise.reject(new Error('tunnel designer: sw disabled')) }, configurable: true
    });
  } catch (e) { /* keep going — worst case the SW registers */ }
  // the one hook inside the game loop: 0 freezes the world (draw only)
  window.EDITOR_DRIVE = dt => {
    if (EDUI.mode === 'edit') return 0;
    if (EDUI.mode === 'play') integrity = 100; // preview never flatlines — the designer is watching traffic
    return dt;
  };
  for (const src of blocks) {
    const s = document.createElement('script');
    s.textContent = src;
    document.body.appendChild(s); // executes synchronously
  }
  // the editor session must never touch the designer's real save — or ears
  saveState = () => {};
  settings.sound = false; settings.music = false; settings.haptics = false;
  // no first-time briefing cards mid-scrub
  progress.tutorialDone = progress.bossBriefed = progress.stripBriefed = progress.wallBriefed = true;

  edBuildStatic();
  EDUI.sources = CAMPAIGNS.map(p => ({ label: p.title, pkg: p }));
  edLoadPkg(ED.clone(CAMPAIGNS[0]), 0);
  EDUI.booted = true;
  requestAnimationFrame(edLoop);
  window.addEventListener('resize', () => { edRenderTimeline(); });
}

// ---------- deterministic scrubbing ----------
// world state at time T = reset + fast-forward. Rendering is naturally
// suppressed: the loop below runs synchronously between two rAF frames.
function edScrub(T) {
  if (EDUI.errs.length) return; // world holds the last good package
  const lv = edLv();
  T = Math.max(0, Math.min(T, lv.duration - 0.05));
  EDUI.playhead = T;
  const t0 = performance.now();
  startLevel(EDUI.li);
  introT = 999; introCd = 0; // skip the boot ceremony — this is a seek
  let guard = Math.ceil(T / 0.05) + 400;
  while (levelT < T && state === S.PLAY && guard-- > 0) {
    integrity = 100; // pinned: the seek must reach T even through un-zapped breaches
    update(0.05);
  }
  fadeT = 0; warpT = 0; // and no deploy flash either
  EDUI.scrubMs = performance.now() - t0;
  edPlacePlayhead(); edClock(); edHud();
}
function edSeek(t) { // rAF-throttled: timeline drags re-simulate at most once a frame
  EDUI.seekT = t;
  if (!EDUI.seekRaf) EDUI.seekRaf = requestAnimationFrame(() => { EDUI.seekRaf = 0; edScrub(EDUI.seekT); });
}

// ---------- edit -> validate -> install -> re-simulate ----------
function edApply(now) {
  clearTimeout(EDUI.applyT);
  const run = () => {
    EDUI.errs = validateCampaign(EDUI.pkg);
    EDUI.walk = null;
    if (!EDUI.errs.length) {
      installCampaign(ED.clone(EDUI.pkg)); // the scrubber always simulates the EDITED data
      edScrub(EDUI.playhead);
      // the disc preview is sticky: the scrub above dropped the world back into
      // PLAY, so put the card back and the plot line rewraps as it is typed
      if (EDUI.discPreview) edShowDisc();
      // the linter's walk feeds the FILLER lane + wall-relocation verdicts
      try { EDUI.walk = lintWalk(edLv(), EDUI.li); } catch (e) { /* lane goes dark, editing continues */ }
    }
    edRenderLint();
    if (!EDUI.dragging) { edRenderTimeline(); edRenderBeatList(); }
    edHud();
  };
  if (now) run(); else EDUI.applyT = setTimeout(run, 250);
}

function edLoadPkg(p, srcIdx) {
  if (srcIdx !== undefined) EDUI.srcIdx = srcIdx;
  EDUI.pkg = p; EDUI.li = 0; EDUI.playhead = 0;
  EDUI.selBeat = EDUI.selBand = null; EDUI.selComm = -1; EDUI.mode = 'edit';
  edApply(true);
  edRenderCampaign(srcIdx);
  edRenderLevel(); edRenderBeatList(); edRenderBandIns(); edTransport();
}
function edSelectLevel(i) {
  EDUI.li = Math.max(0, Math.min(i, EDUI.pkg.levels.length - 1));
  EDUI.playhead = 0; EDUI.selBeat = EDUI.selBand = null; EDUI.selComm = -1;
  edGhostClear();
  if (EDUI.mode !== 'edit') { EDUI.mode = 'edit'; edTransport(); }
  edApply(true);
  edRenderCampaign(); edRenderLevel(); edRenderBeatList(); edRenderBandIns();
}

// ---------- transport ----------
function edTransport() {
  edq('edPlay').innerHTML = EDUI.mode === 'play' ? '&#9208; PAUSE' : '&#9655; PLAY';
  edq('edPlay').classList.toggle('on', EDUI.mode === 'play');
  edq('edPlay').style.display = EDUI.mode === 'live' ? 'none' : '';
  edq('edLive').style.display = EDUI.mode === 'edit' ? '' : 'none';
  edq('edStop').style.display = EDUI.mode === 'edit' ? 'none' : '';
  edq('edOv').classList.toggle('live', EDUI.mode === 'live');
  edHud();
}
function edTogglePlay() {
  if (EDUI.errs.length) return;
  if (EDUI.mode === 'edit') EDUI.mode = 'play';
  else if (EDUI.mode === 'play') { EDUI.mode = 'edit'; edScrub(levelT); } // canonical state at the pause point
  edTransport();
}
function edGoLive() {
  if (EDUI.errs.length || EDUI.mode !== 'edit') return;
  EDUI.mode = 'live';
  edTransport();
}
function edBackToEdit() {
  const t = Math.min(levelT, edLv().duration - 0.05);
  EDUI.mode = 'edit';
  edScrub(t); // live play diverged from the script — restore the deterministic state
  edTransport();
}
function edLoop() {
  requestAnimationFrame(edLoop);
  if (!EDUI.booted) return;
  if (EDUI.mode !== 'edit') {
    EDUI.playhead = Math.min(levelT, edLv().duration);
    edPlacePlayhead(); edClock();
    if (EDUI.mode === 'play' && (state !== S.PLAY || levelT >= edLv().duration - 0.05)) edBackToEdit();
    if (EDUI.mode === 'live' && state === S.MENU) edBackToEdit(); // player quit the run
  } else if (state === S.PAUSE) {
    state = S.PLAY; // tab-hidden autopause — the editor clock is frozen anyway
  }
}

// ---------- stage HUD + clock ----------
function edClock() {
  edq('edClock').textContent = EDUI.playhead.toFixed(1) + ' / ' + edLv().duration + 's';
  edq('edMs').textContent = EDUI.mode === 'edit' ? 'scrub ' + EDUI.scrubMs.toFixed(0) + 'ms' : '';
}
function edHud() {
  const h = edq('edHud');
  const mode = EDUI.mode === 'edit'
    ? 'EDITING — world frozen at ' + EDUI.playhead.toFixed(1) + 's'
    : EDUI.mode === 'play' ? 'PREVIEW (integrity pinned)' : 'LIVE INPUT — the canvas is the game';
  const tool = EDUI.mode === 'edit' && EDUI.tool !== 'select'
    ? '<br>tool: ' + EDUI.tool.toUpperCase() + ' — click the tunnel to place at t=' + EDUI.playhead.toFixed(1) + 's' : '';
  let ghost = '';
  if (EDUI.ghost) {
    const gh = EDUI.ghost;
    ghost = !gh.fit.ok ? '<br><span class="warn">' + gh.fit.why + ' — click for options (1/2/3)</span>'
      : gh.moved ? '<br><span class="warn">fairness would relocate — authored ' + gh.aA.toFixed(2) + ', lands ' + gh.aR.toFixed(2) + ' — click for options</span>'
      : '<br>wall lands at ' + gh.aA.toFixed(2) + ' rad — as authored';
  }
  const flash = EDUI.flash ? '<br><span class="warn">' + EDUI.flash + '</span>' : '';
  const bad = EDUI.errs.length ? '<br><span class="warn">PACKAGE INVALID — canvas shows the last good data</span>' : '';
  h.innerHTML = mode + tool + ghost + flash + bad;
}
function edFlash(msg) { // transient stage warning (e.g. a blocked wall click)
  EDUI.flash = msg;
  clearTimeout(EDUI.flashT);
  EDUI.flashT = setTimeout(() => { EDUI.flash = null; edHud(); }, 2000);
  edHud();
}
// nominal travel time of a wall carpet, same law as the linter (hitZ 0.25)
function edWallTrav() { return (SPAWN_Z - 0.25) / edLv().speed; }
// the fairness verdict for any angle-authored beat, from the cached walk:
// where did it actually LAND, and did the engine move it?
function edWalkLanded(b) {
  if (!EDUI.walk || b.angle === undefined) return null;
  const bi = (edLv().beats || []).indexOf(b);
  let a;
  if (b.kind === 'wall') {
    const w = EDUI.walk.walls.find(w2 => w2.beat === bi);
    if (!w) return null; // slid past the level end or never released
    a = w.a;
  } else {
    const rec = EDUI.walk.arr.find(r => r.beat === bi);
    if (!rec) return null;
    a = rec.angle;
  }
  return { a: ED.norm(a), moved: Math.abs(ED.angDiff(a, b.angle)) > 0.02 };
}
// predict where a CANDIDATE beat would land: clone the level, add it, walk
function edPredictLanded(beat) {
  const cl = ED.clone(edLv());
  const nb = ED.addBeat(cl, ED.clone(beat));
  const bi = cl.beats.indexOf(nb);
  try {
    const wk = lintWalk(cl, EDUI.li);
    if (beat.kind === 'wall') { const w = wk.walls.find(w2 => w2.beat === bi); return w ? ED.norm(w.a) : undefined; }
    const rec = wk.arr.find(r => r.beat === bi);
    return rec ? ED.norm(rec.angle) : undefined;
  } catch (e) { return undefined; }
}
// would this placement conflict with fairness? null = clean, else the dialog payload
function edPredictConflict(beat) {
  if (beat.angle === undefined) return null; // seeded angles carry no authored intent
  let msg = null;
  if (beat.kind === 'wall') {
    const fit = ED.wallFits(edLv(), beat.t, beat.angle, edWallTrav());
    if (!fit.ok) msg = 'WALL vs WALL — ' + fit.why;
  }
  const landed = edPredictLanded(beat);
  if (!msg && landed !== undefined && Math.abs(ED.angDiff(landed, beat.angle)) > 0.02)
    msg = 'fairness would relocate this ' + (beat.kind === 'wall' ? 'wall' : 'beat') +
      ': authored ' + beat.angle.toFixed(2) + ' → lands ' + landed.toFixed(2);
  return msg ? { msg, landed } : null;
}

// ---------- the fairness dialog: conflicts are a CHOICE, never a silent fix ----------
function edOpenDialog(beat, verdict) {
  EDUI.dlg = { beat, verdict };
  edq('edDlgMsg').textContent = verdict.msg;
  edq('edDlg2').textContent = '2 · AUTO-PLACE' +
    (verdict.landed !== undefined ? ' (lands at ' + verdict.landed.toFixed(2) + ')' : '');
  edq('edDlg').style.display = 'flex';
}
function edCloseDialog() {
  EDUI.dlg = null;
  edq('edDlg').style.display = 'none';
}
function edDlgChoose(n) {
  const d = EDUI.dlg;
  if (!d) return;
  edCloseDialog();
  if (n === 1) return;                 // 1 CANCEL — no placement
  if (n === 3) d.beat.force = true;    // 3 OVERRIDE — place EXACTLY as authored ⚡
  ED.addBeat(edLv(), d.beat);          // 2 AUTO-PLACE — the engine resolves it at runtime
  EDUI.selBeat = d.beat; EDUI.selBand = null;
  edApply(true);
  if (n === 2 && d.verdict.landed !== undefined) edFlash('auto-placed — lands at ' + d.verdict.landed.toFixed(2));
  if (n === 3) edFlash('override placed ⚡ — the linter will still judge it');
}

// ---------- wall ghost: preview where the carpet would ACTUALLY land ----------
function edGhostClear() {
  const c = edq('edGhost');
  c.getContext('2d').clearRect(0, 0, c.width, c.height);
  if (EDUI.ghost) { EDUI.ghost = null; edHud(); }
}
function edGhostDraw() {
  const c = edq('edGhost'), stage = edq('edStage');
  if (c.width !== stage.clientWidth || c.height !== stage.clientHeight) {
    c.width = stage.clientWidth; c.height = stage.clientHeight;
  }
  const x = c.getContext('2d');
  x.clearRect(0, 0, c.width, c.height);
  EDUI.ghost = null;
  const ev = EDUI.ghostEv;
  if (!ev || EDUI.tool !== 'wall' || EDUI.mode !== 'edit' || EDUI.errs.length) { edHud(); return; }
  const lv = edLv(), g = geo();
  const aA = ED.norm(Math.atan2(ev.y - g.cy, ev.x - g.cx));
  const t = ED.snap(EDUI.playhead);
  const fit = ED.wallFits(lv, t, aA, edWallTrav());
  let aR = aA, moved = false;
  if (fit.ok) {
    // predict the landed arc with the linter's own walk: clone the level, add
    // the candidate beat, and read back where simWall put it (clash hops incl.)
    const cl = ED.clone(lv);
    const nb = ED.addBeat(cl, ED.makeBeat('wall', t, +aA.toFixed(3)));
    const bi = cl.beats.indexOf(nb);
    try {
      const w = lintWalk(cl, EDUI.li).walls.find(w2 => w2.beat === bi);
      if (w) { aR = ED.norm(w.a); moved = Math.abs(ED.angDiff(aR, aA)) > 0.02; }
    } catch (err) { /* preview only — never blocks editing */ }
  }
  const span = 0.5; // latch half-span
  const arc = (ang, color, lw, alpha, dash) => {
    x.save();
    x.globalAlpha = alpha; x.strokeStyle = color; x.lineWidth = lw; x.setLineDash(dash); x.lineCap = 'round';
    x.beginPath(); x.arc(g.cx, g.cy, g.nodeR, ang - span, ang + span); x.stroke();
    x.restore();
  };
  if (!fit.ok) arc(aA, '#8fa4c8', 4, 0.45, [3, 6]);                                  // greyed: click will not place
  else if (moved) { arc(aA, '#8fa4c8', 3, 0.4, [3, 6]); arc(aR, '#ff963c', 6, 0.9, [8, 5]); } // authored scar + landed arc
  else arc(aA, '#ff963c', 6, 0.9, [8, 5]);
  EDUI.ghost = { fit, aA, aR, moved };
  edHud();
}

// ---------- static wiring: transport, tools, lanes, keys, io ----------
function edBuildStatic() {
  // collapsible side sections + timeline lane headers
  for (const sec of document.querySelectorAll('.sec > h2'))
    sec.addEventListener('click', () => sec.parentElement.classList.toggle('closed'));
  for (const head of document.querySelectorAll('.laneHead'))
    head.addEventListener('click', () => head.parentElement.classList.toggle('closed'));

  edq('edHome').addEventListener('click', () => { if (EDUI.mode === 'edit') edScrub(0); });
  edq('edPlay').addEventListener('click', edTogglePlay);
  edq('edLive').addEventListener('click', edGoLive);
  edq('edStop').addEventListener('click', edBackToEdit);

  // beat tool palette (short labels — eleven tools share one bar)
  const toolNames = { select: 'SEL', normal: 'NORM', heavy: 'HVY', line: 'LINE', lock0: 'LK0',
    lock1: 'LK1', wall: 'WALL', strip: 'STRIP', pickup: 'PICK', lull: 'LULL' };
  const tools = edq('edTools');
  for (const t of EDTOOLS) {
    const b = edEl('button', t === 'select' ? 'on' : '', tools);
    b.textContent = toolNames[t];
    b.title = t;
    b.dataset.tool = t;
    if (t !== 'select') b.style.borderBottom = '2px solid ' + ED.chip(t).tick;
    b.addEventListener('click', () => {
      EDUI.tool = t;
      for (const o of tools.children) o.classList.toggle('on', o.dataset.tool === t);
      if (t !== 'wall') edGhostClear();
      edHud();
    });
  }

  // keyboard: typing must never leak into the game's key handlers; the
  // fairness dialog answers to 1/2/3; DELETE / SPACE are editor verbs
  window.addEventListener('keydown', e => {
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) { e.stopImmediatePropagation(); return; }
    if (EDUI.dlg) {
      if (e.key === '1' || e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); edDlgChoose(1); }
      if (e.key === '2') { e.preventDefault(); e.stopImmediatePropagation(); edDlgChoose(2); }
      if (e.key === '3') { e.preventDefault(); e.stopImmediatePropagation(); edDlgChoose(3); }
      return;
    }
    if (EDUI.mode === 'live') return; // the game owns the keys during live play
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); edDeleteSel(); }
    if (e.key === ' ') { e.preventDefault(); e.stopImmediatePropagation(); edTogglePlay(); }
  }, true);
  edq('edDlg1').addEventListener('click', () => edDlgChoose(1));
  edq('edDlg2').addEventListener('click', () => edDlgChoose(2));
  edq('edDlg3').addEventListener('click', () => edDlgChoose(3));

  // canvas overlay: click-to-place beats (t = playhead, angle = click bearing).
  // every placement re-applies + re-scrubs, so its effect shows immediately.
  // A conflicting placement opens the fairness dialog instead of placing.
  edq('edOv').addEventListener('pointerdown', e => {
    if (EDUI.mode === 'play') edTogglePlay(); // placing implies pausing
    if (EDUI.mode !== 'edit' || EDUI.tool === 'select' || EDUI.errs.length || EDUI.dlg) return;
    const g = geo(); // the real game's bore geometry — canvas sits at page (0,0)
    const angle = ED.norm(Math.atan2(e.clientY - g.cy, e.clientX - g.cx));
    const withAngle = EDUI.tool !== 'strip' && EDUI.tool !== 'pickup' && EDUI.tool !== 'lull';
    const t = ED.snap(EDUI.playhead);
    const beat = ED.makeBeat(EDUI.tool, t, withAngle ? +angle.toFixed(3) : undefined);
    if (beat.angle === undefined) delete beat.angle;
    const conflict = edPredictConflict(beat);
    if (conflict) { edOpenDialog(beat, conflict); return; } // 1 cancel · 2 auto · 3 override
    ED.addBeat(edLv(), beat);
    EDUI.selBeat = beat; EDUI.selBand = null;
    edApply(true);
    if (EDUI.tool === 'wall') edGhostDraw(); // the guard windows just changed under the cursor
  });
  // wall tool: live ghost of the resolved landing arc under the cursor
  const ov = edq('edOv');
  ov.addEventListener('pointermove', e => {
    if (EDUI.tool !== 'wall' || EDUI.mode !== 'edit') return;
    EDUI.ghostEv = { x: e.clientX, y: e.clientY };
    if (!EDUI.ghostRaf) EDUI.ghostRaf = requestAnimationFrame(() => { EDUI.ghostRaf = 0; edGhostDraw(); });
  });
  ov.addEventListener('pointerleave', () => { EDUI.ghostEv = null; edGhostClear(); });

  // ruler: seek / drag the playhead
  const ruler = edq('edRuler');
  ruler.addEventListener('pointerdown', e => {
    if (EDUI.mode === 'live') return;
    if (EDUI.mode === 'play') edTogglePlay();
    const rect = ruler.getBoundingClientRect();
    const seek = ev => edSeek(ED.x2t(ev.clientX - rect.left, edLv().duration, ruler.clientWidth));
    ruler.setPointerCapture(e.pointerId);
    seek(e);
    const mv = ev => seek(ev);
    const up = () => { ruler.removeEventListener('pointermove', mv); ruler.removeEventListener('pointerup', up); };
    ruler.addEventListener('pointermove', mv);
    ruler.addEventListener('pointerup', up);
  });

  // band lane: drag empty space to carve a band, drag blocks/edges to move/resize
  const lane = edq('edBandLane');
  lane.addEventListener('pointerdown', e => {
    if (EDUI.mode !== 'edit') return;
    const lv = edLv();
    const rect = lane.getBoundingClientRect();
    const tx = ev => ED.x2t(ev.clientX - rect.left, lv.duration, lane.clientWidth);
    const blockEl = e.target.closest ? e.target.closest('.bandM') : null;
    const band = blockEl ? lv.bands[+blockEl.dataset.i] : null;
    const edge = e.target.classList && e.target.classList.contains('bEdge') ? (e.target.classList.contains('l') ? 'l' : 'r') : null;
    const t0 = tx(e);
    let ghost = null, grab = band ? { t0: band.t0, t1: band.t1, at: t0 } : null;
    if (band) { EDUI.selBeat = null; EDUI.selBand = band; edRenderTimeline(); edRenderBandIns(); edRenderBeatList(); }
    EDUI.dragging = true;
    lane.setPointerCapture(e.pointerId);
    const mv = ev => {
      const t = tx(ev);
      if (band && edge) { // resize
        if (edge === 'l') band.t0 = Math.min(t, band.t1 - 0.5); else band.t1 = Math.max(t, band.t0 + 0.5);
        band.t0 = Math.max(0, ED.snap(band.t0)); band.t1 = Math.min(lv.duration, ED.snap(band.t1));
      } else if (band) { // move, width kept
        const w = grab.t1 - grab.t0;
        let n0 = ED.snap(grab.t0 + (t - grab.at));
        n0 = Math.max(0, Math.min(n0, lv.duration - w));
        band.t0 = n0; band.t1 = ED.snap(n0 + w);
      } else { // carve a new one
        if (!ghost) { ghost = edEl('div', 'bandM', lane); ghost.style.pointerEvents = 'none'; }
        const a = Math.min(t0, t), b = Math.max(t0, t);
        ghost._a = a; ghost._b = b;
        ghost.style.left = ED.t2x(a, lv.duration, lane.clientWidth) + 'px';
        ghost.style.width = ED.t2x(b - a, lv.duration, lane.clientWidth) + 'px';
      }
      if (band) edPaintBands();
    };
    const up = () => {
      lane.removeEventListener('pointermove', mv); lane.removeEventListener('pointerup', up);
      EDUI.dragging = false;
      if (ghost) {
        const nb = ghost._b - ghost._a >= 0.5 ? ED.addBand(lv, ghost._a, ghost._b) : null;
        ghost.remove();
        if (nb) { EDUI.selBand = nb; EDUI.selBeat = null; }
      }
      ED.normalizeBands(lv);
      if (EDUI.selBand && !(lv.bands || []).includes(EDUI.selBand)) EDUI.selBand = null;
      edApply(true); edRenderBandIns(); edRenderBeatList();
    };
    lane.addEventListener('pointermove', mv);
    lane.addEventListener('pointerup', up);
  });

  // campaign manager
  edq('cPick').addEventListener('change', e => {
    const src = EDUI.sources[+e.target.value];
    if (src) edLoadPkg(ED.clone(src.pkg), +e.target.value);
  });
  edq('cNew').addEventListener('click', () => {
    const p = ED.newCampaign();
    EDUI.sources.push({ label: p.title + ' *', pkg: ED.clone(p) });
    edLoadPkg(p, EDUI.sources.length - 1);
  });
  edq('cDup').addEventListener('click', () => {
    const p = ED.clone(EDUI.pkg);
    p.id = (p.id + '-copy').slice(0, 32); p.title = (p.title + ' COPY').slice(0, 40);
    EDUI.sources.push({ label: p.title + ' *', pkg: ED.clone(p) });
    edLoadPkg(p, EDUI.sources.length - 1);
  });
  const cBind = (id, key, xf) => edq(id).addEventListener('input', e => {
    EDUI.pkg[key] = xf ? xf(e.target.value) : e.target.value;
    edApply();
  });
  cBind('cId', 'id'); cBind('cTitle', 'title'); cBind('cTag', 'tagline');
  cBind('cDiff', 'difficulty', v => Math.max(1, Math.min(5, +v || 1)));
  cBind('cStory', 'story');
  edq('cAddSpk').addEventListener('click', () => {
    EDUI.pkg.speakers.push({ id: 'SPK' + (EDUI.pkg.speakers.length + 1), name: 'new speaker', color: '160,200,255' });
    edApply(); edRenderCampaign(); edRenderLevel(); // comm dropdowns list speakers
  });
  edq('cAddLvl').addEventListener('click', () => {
    ED.addLevel(EDUI.pkg);
    edApply(true); edRenderCampaign();
  });

  // level fields
  const lBind = (id, key, xf, ev) => edq(id).addEventListener(ev || 'input', e => {
    const v = xf ? xf(e.target.value, e.target) : e.target.value;
    if (v === undefined) delete edLv()[key]; else edLv()[key] = v;
    edApply();
  });
  lBind('lHint', 'hint', v => v || undefined);
  lBind('lTint', 'tint', v => { const t = ED.hexToTint(v); edq('lTintTxt').textContent = t; return t; });
  lBind('lTrack', 'track', v => +v, 'change');
  lBind('lBoss', 'boss', (v, el) => el.checked || undefined, 'change');
  lBind('lBursts', 'bursts', (v, el) => el.checked || undefined, 'change');
  lBind('lSpeed', 'speed', v => +v || 0.1);
  lBind('lSMin', 'spawnMin', v => +v || 0.1);
  lBind('lSMax', 'spawnMax', v => +v || 0.1);
  edq('lDur').addEventListener('change', e => {
    const lv = edLv();
    lv.duration = Math.max(10, Math.min(600, +e.target.value || 45));
    for (const b of lv.beats || []) ED.retimeBeat(lv, b, b.t); // pull beats back inside
    ED.normalizeBands(lv);
    edApply(true); edRenderBeatList(); edRenderBandIns();
  });
  // one plot line per mission — the disc has room for a sentence, not a log
  const story = () => {
    const line = edq('lStoryL').value.replace(/\s+/g, ' ').trim().slice(0, 96);
    if (!line) delete edLv().story;
    else edLv().story = { line };
    edDiscInfo();
    edApply();
  };
  edq('lStoryL').addEventListener('input', story);
  // ---- the mission disc: art, and private notes ----
  edq('lArt').addEventListener('click', () => edPickFile('image/*', f => edReadFile(f, uri => {
    edLv().art = uri;                    // embedded: the package stays self-contained
    edApply(); edRenderLevel();
  })));
  edq('lArtClr').addEventListener('click', () => { delete edLv().art; edApply(); edRenderLevel(); });
  edq('lArtFile').addEventListener('input', e => {
    const v = e.target.value.trim();
    if (!v) delete edLv().art; else edLv().art = v;
    edDiscInfo(); edApply();
  });
  edq('lNotes').addEventListener('input', e => {
    const v = e.target.value;
    if (!v.trim()) delete edLv().notes; else edLv().notes = v.slice(0, 4000);
    edApply();
  });
  edq('lDiscPrev').addEventListener('click', () => {
    EDUI.discPreview = !EDUI.discPreview;
    if (EDUI.discPreview) edShowDisc(); else edScrub(EDUI.playhead);
    edDiscInfo();
  });
  edq('lAddComm').addEventListener('click', () => {
    const lv = edLv();
    if (!lv.comms) lv.comms = [];
    lv.comms.push({ t: ED.snap(EDUI.playhead), s: (EDUI.pkg.speakers[0] || {}).id || 'OMNI', m: 'message' });
    edApply(); edRenderLevel();
  });

  // map plumbing
  edq('edMapBox').addEventListener('click', e => {
    const r = e.currentTarget.getBoundingClientRect();
    edLv().mapPos = { x: +((e.clientX - r.left) / r.width).toFixed(3), y: +((e.clientY - r.top) / r.height).toFixed(3) };
    edApply(); edPaintMap();
  });
  edq('mapImg').addEventListener('click', () => edPickFile('image/*', f => edReadFile(f, uri => {
    EDUI.pkg.map = { image: uri };
    edApply(); edPaintMap();
  })));
  edq('mapImgClr').addEventListener('click', () => { EDUI.pkg.map = { theme: 'chart' }; edApply(); edPaintMap(); });

  // export / import
  edq('ioDl').addEventListener('click', () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([ED.exportJSON(EDUI.pkg)], { type: 'application/json' }));
    a.download = (EDUI.pkg.id || 'campaign') + '.json';
    a.click();
    URL.revokeObjectURL(a.href);
  });
  edq('ioCopy').addEventListener('click', async e => {
    try { await navigator.clipboard.writeText(ED.exportEntry(EDUI.pkg)); e.target.textContent = 'COPIED ✓'; }
    catch (err) { e.target.textContent = 'COPY FAILED'; }
    setTimeout(() => { e.target.textContent = 'COPY campaigns.js ENTRY'; }, 1400);
  });
  edq('ioLoad').addEventListener('click', () => edImportText(edq('ioIn').value));
  edq('ioFile').addEventListener('click', () => edPickFile('.json,application/json', f => {
    const r = new FileReader();
    r.onload = () => edImportText(String(r.result));
    r.readAsText(f);
  }));
}
function edPickFile(accept, cb) {
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = accept;
  inp.addEventListener('change', () => { if (inp.files[0]) cb(inp.files[0]); });
  inp.click();
}

// ---------- the mission disc ----------
// The preview drives the EMBEDDED GAME into its own S.INFO state, so the panel
// shows the real renderer rather than a mock that could drift from it. edApply
// re-asserts it after every edit, so typing the plot line rewraps live.
function edShowDisc() {
  if (EDUI.errs.length || !LEVELS[EDUI.li]) return;
  levelIdx = EDUI.li; LV = LEVELS[EDUI.li];
  introT = 999; introCd = 0;
  if (!INFO_CARDS['story' + EDUI.li]) return;
  showCard('story' + EDUI.li);
  // the editor holds the sim clock at dt=0, so the card's zoom-in and its
  // teletype would never advance — backdate the open so it draws fully arrived
  infoShownAt = time - 6;
}
// the readouts under the art and the plot line: what the level actually carries,
// and where it breaks the budgets the disc renderer enforces
const EDART_AR = 1.479; // the disc's art box — 1.93R wide by 1.305R tall
function edDiscInfo() {
  const lv = edLv();
  const art = lv.art || '';
  const ai = edq('lArtInfo');
  let msg;
  if (!art) msg = 'no art — the disc falls back to a plate in this level’s tint';
  else if (/^data:image\//.test(art)) {
    const kb = Math.round(art.length / 1024);
    msg = 'embedded, ' + kb + ' KB'
      + (art.length > 400000 ? ' — OVER the 400 KB package cap, this will not install' : '');
  } else if (/^[\w-]+\.(webp|png|jpg)$/.test(art)) msg = 'file — expects src/art/disc/' + art;
  else msg = 'INVALID name — use letters, digits, - and a .webp/.png/.jpg extension';
  const im = art ? discArtImg(lv) : null;   // null until it decodes; kicks off the load
  // DISCIMG is an LRU Map now (see the note on discArtImg), not a plain object
  const miss = art && !im && DISCIMG.get(/^data:image\//.test(art) ? art : 'art/disc/' + art);
  if (im) {
    const ar = im.w / im.h;
    msg += '  ·  ' + im.w + '×' + im.h + '  ·  ' + (Math.abs(ar - EDART_AR) < 0.12
      ? 'aspect fits the disc box'
      : 'aspect ' + ar.toFixed(2) + ':1 vs the box’s 1.48:1 — expect a crop');
    if (im.w < 1000) msg += '  ·  under 1000px wide, soft on a tablet';
  } else if (miss && miss.err) {
    msg += '  ·  NOT FOUND — the disc will draw the tint plate';
  } else if (art) {
    msg += '  ·  loading…';
    clearTimeout(EDUI.artT);              // re-read once the image lands, or fails
    EDUI.artT = setTimeout(edDiscInfo, 400);
  }
  ai.textContent = msg;
  const body = (lv.story && (lv.story.line || (lv.story.lines || []).join(' '))) || '';
  const n = body.length;
  edq('lStoryInfo').textContent = !n ? 'no plot line — this mission says nothing on deploy'
    : n + ' chars · ' + (n > 96 ? 'OVER the 96 limit, this will not install'
      : n > 58 ? 'long — the type shrinks to hold two rows'
        : 'fits two rows at full size on the smallest phone');
  edq('lDiscPrevInfo').textContent = EDUI.discPreview
    ? 'live — edits rewrap in the stage. Click again to return to the tunnel.'
    : '';
  edq('lDiscPrev').classList.toggle('on', !!EDUI.discPreview);
}
function edImportText(text) {
  const res = ED.importJSON(text, validateCampaign);
  const msg = edq('ioMsg');
  msg.innerHTML = '';
  if (res.errors) {
    for (const er of res.errors) edEl('div', 'err', msg).textContent = '✕ ' + er;
    return;
  }
  edEl('div', 'ok', msg).textContent = '✓ package valid — loaded as working copy';
  EDUI.sources.push({ label: (res.pkg.title || res.pkg.id) + ' (imported)', pkg: ED.clone(res.pkg) });
  edLoadPkg(res.pkg, EDUI.sources.length - 1);
}
function edDeleteSel() {
  if (EDUI.selBeat) {
    ED.deleteBeat(edLv(), EDUI.selBeat);
    EDUI.selBeat = null;
  } else if (EDUI.selBand) {
    const bs = edLv().bands || [];
    const i = bs.indexOf(EDUI.selBand);
    if (i >= 0) bs.splice(i, 1);
    if (!bs.length) delete edLv().bands;
    EDUI.selBand = null;
  } else return;
  edApply(true); edRenderBeatList(); edRenderBandIns();
}

// ---------- timeline rendering: one lane per ingredient ----------
function edPlacePlayhead() {
  const tr = edq('edRuler'); // the playhead spans every lane; tracks share one x-origin
  edq('edPh').style.left = (tr.offsetLeft + ED.t2x(EDUI.playhead, edLv().duration, tr.clientWidth)) + 'px';
}
function edRenderTimeline() {
  const lv = edLv();
  const w = edq('edRuler').clientWidth;
  EDUI.markerOf = new Map();
  // TIME
  const ruler = edq('edRuler');
  ruler.innerHTML = '';
  const step = lv.duration > 180 ? 30 : lv.duration > 90 ? 10 : 5;
  for (let t = 0; t <= lv.duration; t += step) {
    const x = ED.t2x(t, lv.duration, w);
    edEl('div', 'tick', ruler).style.left = x + 'px';
    if (!t) continue;
    const l = edEl('div', 'tickL', ruler);
    l.style.left = (x + 3) + 'px';
    l.textContent = t + 's';
  }
  // STORY (read-only): deploy card at t=0 + each comm's on-screen window
  const st = edq('edStoryLane');
  st.innerHTML = '';
  if (lv.story) {
    const sb = edEl('div', 'storyB', st);
    sb.style.left = '0px';
    sb.style.width = Math.max(46, ED.t2x(3, lv.duration, w)) + 'px';
    const sl = lv.story.line || (lv.story.lines || []).join(' ');
    sb.textContent = sl;
    sb.title = 'mission disc: ' + sl + '  (click to edit)';
    sb.style.cursor = 'pointer';
    sb.addEventListener('click', () => {
      edq('secDisc').classList.remove('closed');
      edq('lStoryL').focus();
      edq('secDisc').scrollIntoView({ block: 'center', behavior: 'smooth' });
    });
  }
  (lv.comms || []).forEach((cm, i) => {
    const spk = (EDUI.pkg.speakers || []).find(s => s.id === cm.s);
    const col = spk ? spk.color : '110,143,184';
    const b = edEl('div', 'commB' + (i === EDUI.selComm ? ' hot' : ''), st);
    b.style.left = ED.t2x(Math.max(0, cm.t - 0.5), lv.duration, w) + 'px'; // the window filler routes around
    b.style.width = Math.max(20, ED.t2x(3.7, lv.duration, w)) + 'px';
    b.style.borderColor = 'rgb(' + col + ')';
    b.style.background = 'rgba(' + col + ',0.22)';
    b.style.color = 'rgb(' + col + ')';
    b.textContent = cm.s + ' ' + cm.m;
    b.title = cm.t + 's ' + cm.s + ': ' + cm.m + ' — click to edit';
    b.addEventListener('click', () => edSelectComm(i));
  });
  // authored beats: a pool of PACKED tracks, video-editor style — sequential
  // beats share TRACK 1, genuinely simultaneous ones open TRACK 2/3/…; type
  // identity lives in the chip color. Lulls pack too: they're authored range
  // chips whose whole meaning is their position BETWEEN the other clips.
  const tracksEl = edq('edTracks');
  tracksEl.innerHTML = '';
  const beats = lv.beats || [];
  const laneIdx = ED.packLanes(beats, { trav: edWallTrav(), speed: lv.speed });
  const nTracks = beats.length ? Math.max.apply(null, laneIdx) + 1 : 1;
  const trackEls = [];
  for (let k = 0; k < nTracks; k++) {
    const row = edEl('div', 'laneRow' + (EDUI.closedTracks.has(k) ? ' closed' : ''), tracksEl);
    const head = edEl('div', 'laneHead', row);
    head.textContent = 'TRACK ' + (k + 1);
    head.title = 'authored beats, packed — click to collapse';
    head.addEventListener('click', () => {
      if (EDUI.closedTracks.has(k)) EDUI.closedTracks.delete(k); else EDUI.closedTracks.add(k);
      row.classList.toggle('closed');
    });
    trackEls.push(edEl('div', 'laneTrack trackLane', row));
  }
  beats.forEach((b, i) => {
    const track = trackEls[laneIdx[i]];
    let el;
    if (b.kind === 'lull') {
      el = edEl('div', 'lullM', track);
      el.style.left = ED.t2x(b.t, lv.duration, w) + 'px';
      el.style.width = Math.max(6, ED.t2x(b.dur || 1, lv.duration, w)) + 'px';
      el.title = 'lull ' + b.t + 's +' + b.dur + 's';
    } else {
      const key = ED.beatKey(b), ch = ED.chip(key);
      el = edEl('div', 'beatM' + (key === 'pickup' ? ' hollow' : '') + (b.force ? ' forced' : ''), track);
      el.style.left = ED.t2x(b.t, lv.duration, w) + 'px';
      el.style.background = ch.bg;
      el.style.borderColor = ch.bd;
      el.title = key + ' @ ' + b.t + 's' + (b.force ? ' — FORCED (placed exactly as authored)' : '');
      const wk = b.force ? null : edWalkLanded(b); // fairness verdict straight on the marker
      if (wk && wk.moved) {
        el.title += ' — RELOCATED by fairness, lands at ' + wk.a.toFixed(2);
        el.style.boxShadow = '0 0 6px var(--gold)';
      }
    }
    if (b === EDUI.selBeat) el.classList.add('sel');
    el._beat = b;
    EDUI.markerOf.set(b, el);
    edWireBeatDrag(el, track);
  });
  // FILLER (read-only): the procedurally generated arrivals for the current
  // knobs + bands, from the linter's pure walk — the whole level at a glance
  const fl = edq('edFillerLane');
  fl.innerHTML = '';
  if (EDUI.walk) {
    const tick = (t, key, wide, label) => {
      const tk = edEl('div', 'fillT', fl);
      tk.style.left = ED.t2x(t, lv.duration, w) + 'px';
      tk.style.background = ED.chip(key).tick;
      if (wide) tk.style.width = '5px';
      tk.title = label + ' @ ' + t.toFixed(1) + 's (filler)';
    };
    for (const rec of EDUI.walk.arr) {
      if (rec.beat !== undefined) continue; // authored — lives on its lane
      const key = rec.lock === 0 ? 'lock0' : rec.lock === 1 ? 'lock1' : (ED.colors[rec.type] ? rec.type : 'normal');
      tick(rec.t, key, false, key);
    }
    for (const wl of EDUI.walk.walls) if (wl.beat === undefined) tick(wl.tLand, 'wall', true, 'wall');
    for (const p of EDUI.walk.picks) if (p.beat === undefined) tick(p.t, 'pickup', false, 'power-up');
  }
  edPaintBands();
  edPlacePlayhead(); edClock();
}
function edSelectComm(i) { // a comm block on the STORY lane jumps to its editor row
  EDUI.selComm = i;
  edq('secLevel').classList.remove('closed');
  edRenderLevel();
  edRenderTimeline();
  const row = EDUI.commRows[i];
  if (row) row.scrollIntoView({ block: 'center', behavior: 'smooth' });
}
function edWireBeatDrag(el, bl) {
  el.addEventListener('pointerdown', e => {
    if (EDUI.mode !== 'edit') return;
    e.stopPropagation();
    const lv = edLv(), b = el._beat;
    EDUI.selBeat = b; EDUI.selBand = null;
    for (const [bb, m] of EDUI.markerOf) m.classList.toggle('sel', bb === b);
    edRenderBeatList(); edRenderBandIns();
    const rect = bl.getBoundingClientRect();
    const off = e.clientX - rect.left - ED.t2x(b.t, lv.duration, bl.clientWidth);
    EDUI.dragging = true;
    el.setPointerCapture(e.pointerId);
    const mv = ev => { // live retime: move the DOM, resimulate on drop
      const t = ED.x2t(ev.clientX - rect.left - off, lv.duration, bl.clientWidth);
      ED.retimeBeat(lv, b, t);
      el.style.left = ED.t2x(b.t, lv.duration, bl.clientWidth) + 'px';
      el.title = ED.beatKey(b) + ' @ ' + b.t + 's';
    };
    const up = () => {
      el.removeEventListener('pointermove', mv); el.removeEventListener('pointerup', up);
      EDUI.dragging = false;
      edApply(true);
    };
    el.addEventListener('pointermove', mv);
    el.addEventListener('pointerup', up);
  });
}
function edPaintBands() {
  const lv = edLv();
  const lane = edq('edBandLane');
  lane.innerHTML = '';
  (lv.bands || []).forEach((b, i) => {
    const el = edEl('div', 'bandM' + (b === EDUI.selBand ? ' sel' : ''), lane);
    el.dataset.i = i;
    el.style.left = ED.t2x(b.t0, lv.duration, lane.clientWidth) + 'px';
    el.style.width = Math.max(8, ED.t2x(b.t1 - b.t0, lv.duration, lane.clientWidth)) + 'px';
    el.textContent = '×' + (b.intensity || 1);
    el.title = b.t0 + '–' + b.t1 + 's · intensity ' + (b.intensity || 1) + (b.mix ? ' · mix' : '');
    edEl('div', 'bEdge l', el);
    edEl('div', 'bEdge r', el);
  });
}

// ---------- side panels ----------
function edRenderCampaign(srcIdx) {
  const p = EDUI.pkg;
  const pick = edq('cPick');
  pick.innerHTML = '';
  EDUI.sources.forEach((s, i) => {
    const o = edEl('option', '', pick);
    o.value = i; o.textContent = s.label;
  });
  pick.value = srcIdx !== undefined ? srcIdx : (EDUI.srcIdx || 0);
  edq('cId').value = p.id || '';
  edq('cTitle').value = p.title || '';
  edq('cTag').value = p.tagline || '';
  edq('cDiff').value = p.difficulty || 1;
  edq('cStory').value = p.story || '';
  // speakers
  const sp = edq('cSpeakers');
  sp.innerHTML = '';
  (p.speakers || []).forEach((s, i) => {
    const row = edEl('div', 'row', sp);
    const sw = edEl('span', 'swatch', row);
    sw.style.background = 'rgb(' + s.color + ')';
    const idIn = edEl('input', '', row); idIn.value = s.id; idIn.style.width = '58px';
    idIn.addEventListener('input', e => { s.id = e.target.value.toUpperCase(); edApply(); });
    const nmIn = edEl('input', '', row); nmIn.value = s.name || ''; nmIn.style.flex = '1';
    nmIn.addEventListener('input', e => { s.name = e.target.value; edApply(); });
    const col = edEl('input', '', row); col.type = 'color'; col.value = ED.tintToHex(s.color);
    col.addEventListener('input', e => { s.color = ED.hexToTint(e.target.value); sw.style.background = 'rgb(' + s.color + ')'; edApply(); });
    if (s.portrait && s.portrait.image) { const im = edEl('img', 'portrait', row); im.src = s.portrait.image; }
    const pb = edEl('button', '', row); pb.textContent = 'IMG'; pb.title = 'upload portrait (data plumbing only)';
    pb.addEventListener('click', () => edPickFile('image/*', f => edReadFile(f, uri => {
      s.portrait = { image: uri }; edApply(); edRenderCampaign();
    })));
    const x = edEl('button', 'xbtn danger', row); x.textContent = '✕';
    x.addEventListener('click', () => { p.speakers.splice(i, 1); edApply(); edRenderCampaign(); edRenderLevel(); });
  });
  // levels
  const ll = edq('cLevels');
  ll.innerHTML = '';
  p.levels.forEach((l, i) => {
    const row = edEl('div', 'row click' + (i === EDUI.li ? ' sel' : ''), ll);
    const nm = edEl('span', '', row);
    nm.textContent = (i + 1) + '. ' + edRouteName(i) + (l.boss ? ' ◆' : '');
    nm.style.flex = '1';
    row.addEventListener('click', () => edSelectLevel(i));
    const up = edEl('button', 'xbtn', row); up.textContent = '▲';
    up.addEventListener('click', e => {
      e.stopPropagation();
      const to = ED.moveLevel(p, i, i - 1);
      if (EDUI.li === i) EDUI.li = to;
      edApply(true); edRenderCampaign();
    });
    const dn = edEl('button', 'xbtn', row); dn.textContent = '▼';
    dn.addEventListener('click', e => {
      e.stopPropagation();
      const to = ED.moveLevel(p, i, i + 1);
      if (EDUI.li === i) EDUI.li = to;
      edApply(true); edRenderCampaign();
    });
    const x = edEl('button', 'xbtn danger', row); x.textContent = '✕';
    x.addEventListener('click', e => {
      e.stopPropagation();
      if (!ED.removeLevel(p, i)) return;
      if (EDUI.li >= p.levels.length) EDUI.li = p.levels.length - 1;
      edSelectLevel(EDUI.li);
    });
  });
}
// What the PLAYER reads for this relay. The game generates it from the chart —
// levelRouteName(campaignIndex, level) — so the Designer shows the same string
// rather than an authored label that would only ever disagree with it. Falls
// back to the bare number if the chart has not been built yet (a fresh package
// the galaxy has never placed).
function edRouteName(li) {
  try {
    const n = levelRouteName(EDUI.srcIdx || 0, li);
    if (n) return n;
  } catch (e) { /* no chart yet */ }
  return 'STAGE ' + String(li + 1).padStart(2, '0');
}
function edRenderLevel() {
  const lv = edLv();
  edq('lRoute').value = edRouteName(EDUI.li);
  edq('lHint').value = lv.hint || '';
  edq('lTint').value = ED.tintToHex(lv.tint);
  edq('lTintTxt').textContent = lv.tint;
  edq('lTrack').value = lv.track || 0;
  edq('lBoss').checked = !!lv.boss;
  edq('lBursts').checked = !!lv.bursts;
  edq('lDur').value = lv.duration;
  edq('lSpeed').value = lv.speed;
  edq('lSMin').value = lv.spawnMin;
  edq('lSMax').value = lv.spawnMax;
  const kn = edq('lKnobs');
  kn.innerHTML = '';
  for (const k of EDKNOBS) {
    const cell = edEl('div', '', kn);
    const lab = edEl('label', '', cell); lab.textContent = k;
    const inp = edEl('input', '', cell);
    inp.type = 'number'; inp.min = 0; inp.max = 1; inp.step = 0.01;
    inp.value = lv[k] || 0;
    inp.addEventListener('input', e => { lv[k] = Math.max(0, Math.min(1, +e.target.value || 0)); edApply(); });
  }
  edq('lStoryL').value = lv.story ? (lv.story.line || (lv.story.lines || []).join(' ')) : '';
  edq('lNotes').value = lv.notes || '';
  // an embedded keyframe is a 400 KB string — never put that in a text field
  const embedded = /^data:image\//.test(lv.art || '');
  edq('lArtFile').value = embedded ? '' : (lv.art || '');
  edq('lArtFile').disabled = embedded;
  edq('lArtFile').placeholder = embedded
    ? 'an uploaded image is embedded — CLEAR it to reference a file instead'
    : 'cargo-run-04.webp — a file in src/art/disc/';
  edDiscInfo();
  // comms
  const cm = edq('lComms');
  cm.innerHTML = '';
  EDUI.commRows = [];
  (lv.comms || []).forEach((c, i) => {
    const row = edEl('div', 'row' + (i === EDUI.selComm ? ' sel' : ''), cm);
    EDUI.commRows.push(row);
    const t = edEl('input', '', row); t.type = 'number'; t.step = 0.5; t.value = c.t; t.style.width = '52px';
    t.addEventListener('input', e => { c.t = +e.target.value || 0; edApply(); });
    const s = edEl('select', '', row);
    for (const spk of EDUI.pkg.speakers || []) {
      const o = edEl('option', '', s); o.value = spk.id; o.textContent = spk.id;
    }
    s.value = c.s;
    s.addEventListener('change', e => { c.s = e.target.value; edApply(); });
    const m = edEl('input', '', row); m.maxLength = 64; m.value = c.m; m.style.flex = '1';
    m.addEventListener('input', e => { c.m = ED.clampComm(e.target.value); edApply(); });
    const x = edEl('button', 'xbtn danger', row); x.textContent = '✕';
    x.addEventListener('click', () => { lv.comms.splice(i, 1); EDUI.selComm = -1; edApply(); edRenderLevel(); });
  });
  edPaintMap();
}
function edPaintMap() {
  const box = edq('edMapBox');
  box.innerHTML = '';
  const img = EDUI.pkg.map && EDUI.pkg.map.image;
  box.style.backgroundImage = img ? 'url(' + img + ')' : 'none';
  EDUI.pkg.levels.forEach((l, i) => {
    if (!l.mapPos) return;
    const pin = edEl('div', 'pin' + (i === EDUI.li ? ' act' : ''), box);
    pin.style.left = (l.mapPos.x * 100) + '%';
    pin.style.top = (l.mapPos.y * 100) + '%';
    pin.textContent = i + 1;
  });
}
function edRenderBeatList() {
  const lv = edLv();
  const el = edq('bList');
  el.innerHTML = '';
  const sorted = (lv.beats || []).slice().sort((a, b) => a.t - b.t);
  for (const b of sorted) {
    const row = edEl('div', 'row click' + (b === EDUI.selBeat ? ' sel' : ''), el);
    row.addEventListener('click', () => {
      EDUI.selBeat = b; EDUI.selBand = null;
      edRenderBeatList(); edRenderTimeline(); edRenderBandIns();
    });
    // hovering a row lights up its timeline marker
    row.addEventListener('mouseenter', () => {
      const m = EDUI.markerOf && EDUI.markerOf.get(b);
      if (m) m.classList.add('hov');
    });
    row.addEventListener('mouseleave', () => {
      const m = EDUI.markerOf && EDUI.markerOf.get(b);
      if (m) m.classList.remove('hov');
    });
    const ch = ED.chip(ED.beatKey(b));
    const sw = edEl('span', 'swatch', row);
    sw.style.background = ch.bg; sw.style.borderColor = ch.bd;
    const t = edEl('input', '', row); t.type = 'number'; t.step = 0.1; t.value = b.t; t.style.width = '58px'; t.title = 't (arrival)';
    t.addEventListener('change', e => { ED.retimeBeat(lv, b, +e.target.value || 0); edApply(true); edRenderBeatList(); });
    const tag = edEl('span', '', row); tag.textContent = b.kind;
    if (b.kind === 'enemy' || b.kind === 'pickup') {
      const s = edEl('select', '', row);
      const opts = b.kind === 'enemy' ? ['normal', 'heavy', 'line', 'lock0', 'lock1'] : EDPICKUPS;
      for (const o of opts) { const op = edEl('option', '', s); op.value = o; op.textContent = o || '(random)'; }
      s.value = b.type || '';
      s.addEventListener('change', e => {
        if (e.target.value) b.type = e.target.value; else delete b.type;
        const c2 = ED.chip(ED.beatKey(b));
        sw.style.background = c2.bg; sw.style.borderColor = c2.bd;
        edApply(true);
      });
    }
    if (b.kind === 'lull') {
      const d = edEl('input', '', row); d.type = 'number'; d.step = 0.5; d.min = 0.5; d.value = b.dur; d.style.width = '52px'; d.title = 'dur';
      d.addEventListener('change', e => {
        b.dur = Math.max(0.5, +e.target.value || 1);
        ED.retimeBeat(lv, b, b.t); // keep t+dur inside the level
        edApply(true);
      });
    } else if (b.kind !== 'strip' && b.kind !== 'pickup') {
      const a = edEl('input', '', row); a.type = 'number'; a.step = 0.1; a.style.width = '58px';
      a.placeholder = 'auto'; a.title = 'angle (radians, blank = seeded)';
      a.value = b.angle !== undefined ? b.angle : '';
      a.addEventListener('change', e => {
        if (e.target.value === '') delete b.angle; else b.angle = +ED.norm(+e.target.value).toFixed(3);
        edApply(true);
      });
    }
    if (b.force) { // ⚡ override badge — click to hand the beat back to fairness
      const fz = edEl('button', 'xbtn zap', row);
      fz.textContent = '⚡';
      fz.title = 'FORCED — placed exactly as authored, fairness bypassed. Click to clear.';
      fz.addEventListener('click', e => {
        e.stopPropagation();
        delete b.force;
        edApply(true);
      });
    }
    const x = edEl('button', 'xbtn danger', row); x.textContent = '✕';
    x.addEventListener('click', e => {
      e.stopPropagation();
      ED.deleteBeat(lv, b);
      if (EDUI.selBeat === b) EDUI.selBeat = null;
      edApply(true); edRenderBeatList();
    });
    if (!b.force && b.angle !== undefined) { // the engine moved an authored beat — say so, inline
      const wk = edWalkLanded(b);
      if (wk && wk.moved) {
        const warn = edEl('div', 'bwarn', row);
        warn.textContent = '⚠ relocated by fairness — authored ' + b.angle.toFixed(2) + ', lands ' + wk.a.toFixed(2);
      }
    }
  }
  if (!sorted.length) edEl('div', 'hintNote', el).textContent = 'no beats yet — arm a tool and click the tunnel.';
}
function edRenderBandIns() {
  const el = edq('bandIns');
  el.innerHTML = '';
  const lv = edLv(), b = EDUI.selBand;
  if (!b || !(lv.bands || []).includes(b)) {
    edEl('div', 'hintNote', el).textContent = (lv.bands || []).length
      ? 'click a band block to edit it.' : 'no bands yet.';
    return;
  }
  const rowT = edEl('div', 'row', el);
  const labT = edEl('label', '', rowT); labT.textContent = 'window';
  const t0 = edEl('input', '', rowT); t0.type = 'number'; t0.step = 0.5; t0.value = b.t0;
  const t1 = edEl('input', '', rowT); t1.type = 'number'; t1.step = 0.5; t1.value = b.t1;
  const reT = () => {
    b.t0 = +t0.value || 0; b.t1 = +t1.value || 0;
    ED.normalizeBands(lv);
    if (!(lv.bands || []).includes(b)) EDUI.selBand = null;
    edApply(true); edRenderBandIns();
  };
  t0.addEventListener('change', reT); t1.addEventListener('change', reT);
  const rowI = edEl('div', 'row', el);
  const labI = edEl('label', '', rowI); labI.textContent = 'intensity';
  const rng = edEl('input', '', rowI); rng.type = 'range'; rng.min = 0.5; rng.max = 4; rng.step = 0.1; rng.value = b.intensity || 1; rng.style.flex = '1';
  const val = edEl('span', '', rowI); val.textContent = '×' + (b.intensity || 1);
  rng.addEventListener('input', e => { b.intensity = +e.target.value; val.textContent = '×' + b.intensity; edApply(); edPaintBands(); });
  edEl('div', 'hintNote', el).textContent = 'mix overrides (rate knobs only — blank = inherit from the level):';
  const grid = edEl('div', 'grid3', el);
  for (const k of EDMIX) {
    const cell = edEl('div', '', grid);
    const lab = edEl('label', '', cell); lab.textContent = k;
    const inp = edEl('input', '', cell); inp.type = 'number'; inp.min = 0; inp.max = 1; inp.step = 0.05;
    inp.value = b.mix && b.mix[k] !== undefined ? b.mix[k] : '';
    inp.placeholder = '—';
    inp.addEventListener('change', e => {
      if (e.target.value === '') { if (b.mix) { delete b.mix[k]; if (!Object.keys(b.mix).length) delete b.mix; } }
      else { (b.mix = b.mix || {})[k] = Math.max(0, Math.min(1, +e.target.value || 0)); }
      edApply();
    });
  }
  const cell = edEl('div', '', grid);
  const lab = edEl('label', '', cell); lab.textContent = 'bursts';
  const sel = edEl('select', '', cell);
  for (const [v, n] of [['', 'inherit'], ['1', 'on'], ['0', 'off']]) {
    const o = edEl('option', '', sel); o.value = v; o.textContent = n;
  }
  sel.value = !b.mix || b.mix.bursts === undefined ? '' : (b.mix.bursts ? '1' : '0');
  sel.addEventListener('change', e => {
    if (e.target.value === '') { if (b.mix) { delete b.mix.bursts; if (!Object.keys(b.mix).length) delete b.mix; } }
    else (b.mix = b.mix || {}).bursts = e.target.value === '1';
    edApply();
  });
  const rowD = edEl('div', 'row', el);
  const del = edEl('button', 'danger', rowD); del.textContent = 'DELETE BAND';
  del.addEventListener('click', () => { EDUI.selBand = b; edDeleteSel(); });
}
function edRenderLint() {
  const el = edq('lintBody');
  el.innerHTML = '';
  if (EDUI.errs.length) {
    edEl('div', 'err', el).textContent = 'STRUCTURAL — package NOT installed:';
    for (const er of EDUI.errs) edEl('div', 'err', el).textContent = '✕ ' + er;
    return;
  }
  let all;
  try { all = lintCampaign(EDUI.pkg); }
  catch (e) { edEl('div', 'err', el).textContent = 'linter crashed: ' + e.message; return; }
  const mine = all[EDUI.li] || [];
  const total = all.reduce((n, li2) => n + li2.length, 0);
  edEl('div', total ? 'hintNote' : 'ok', el).textContent = total
    ? total + ' advisory finding' + (total > 1 ? 's' : '') + ' across the campaign — this level: ' + mine.length
    : '✓ campaign lints clean — every level obeys the 100%-completable law';
  for (const f of mine) {
    const row = edEl('div', 'lintRow', el);
    row.innerHTML = '<b>' + f.t.toFixed(1) + 's</b> ' + f.code + ' — ' + f.msg;
    row.title = 'jump the playhead to ' + f.t.toFixed(1) + 's';
    row.addEventListener('click', () => {
      if (EDUI.mode !== 'edit') edBackToEdit();
      edScrub(Math.max(0, f.t - 0.5)); // land just before the moment
    });
  }
  all.forEach((li2, i) => {
    if (i === EDUI.li || !li2.length) return;
    const row = edEl('div', 'lintRow', el);
    row.innerHTML = 'L' + (i + 1) + ' ' + edRouteName(i) + ': <b>' + li2.length + '</b> finding' + (li2.length > 1 ? 's' : '');
    row.addEventListener('click', () => edSelectLevel(i));
  });
}

if (typeof window !== 'undefined' && window.__EDITOR_PAGE__) edBoot();
