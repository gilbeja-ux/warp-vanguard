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
  newLevel(name) {
    return {
      name: name || 'NEW RELAY', tint: '80,160,255', duration: 45,
      spawnMin: 1.2, spawnMax: 2.0, speed: 0.4,
      doubles: 0, heavies: 0, lines: 0, colors: 0, frags: 0, track: 0,
      story: { title: 'LOG — NEW RELAY', lines: ['edit this briefing'] },
      comms: [], caseNote: ''
    };
  },
  newCampaign() {
    return {
      id: 'new-campaign', format: 1, title: 'NEW CAMPAIGN', tagline: 'UNTITLED CASE', difficulty: 1,
      story: 'describe the case here.',
      map: { theme: 'city' },
      speakers: [{ id: 'OMNI', name: 'OmniServe HQ', color: '111,227,255', portrait: { drawn: 'OMNI' } }],
      levels: [ED.newLevel('FIRST RELAY')]
    };
  },
  makeBeat(tool, t, angle) {
    if (tool === 'wall') return { t, kind: 'wall', angle };
    if (tool === 'strip') return { t, kind: 'strip' };
    if (tool === 'pickup') return { t, kind: 'pickup' };
    if (tool === 'lull') return { t, kind: 'lull', dur: 4 };
    return { t, kind: 'enemy', type: tool, angle }; // normal|heavy|line|lock0|lock1|frag
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
    const l = ED.newLevel('RELAY ' + (pkg.levels.length + 1));
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

  // marker palette (kept here so tests can assert coverage of every tool)
  colors: {
    normal: '#ff6a7a', heavy: '#ffb347', line: '#ffe066', lock0: '#4d8dff',
    lock1: '#f4f8ff', frag: '#d465ff', wall: '#ff8c42', strip: '#ffd24a', pickup: '#7ee262'
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
  tool: 'select', selBeat: null, selBand: null,
  errs: [], sources: [], applyT: 0, seekT: 0, seekRaf: 0,
  dragging: false, booted: false
};
const EDTOOLS = ['select', 'normal', 'heavy', 'line', 'lock0', 'lock1', 'frag', 'wall', 'strip', 'pickup', 'lull'];
const EDPICKUPS = ['', 'shield', 'wide', 'auto', 'inject', 'chain'];
const EDKNOBS = ['doubles', 'heavies', 'lines', 'colors', 'frags', 'walls'];
const EDMIX = ['doubles', 'heavies', 'lines', 'colors', 'frags', 'walls', 'crawlers'];

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
  const html = await (await fetch('index.html')).text();
  // same trick as scripts/test.js: lift every inline script (game + soundtrack
  // manifest) out of the page and run them here, in page order
  const blocks = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
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
    if (!EDUI.errs.length) {
      installCampaign(ED.clone(EDUI.pkg)); // the scrubber always simulates the EDITED data
      edScrub(EDUI.playhead);
    }
    edRenderLint();
    if (!EDUI.dragging) edRenderTimeline();
    edHud();
  };
  if (now) run(); else EDUI.applyT = setTimeout(run, 250);
}

function edLoadPkg(p, srcIdx) {
  if (srcIdx !== undefined) EDUI.srcIdx = srcIdx;
  EDUI.pkg = p; EDUI.li = 0; EDUI.playhead = 0;
  EDUI.selBeat = EDUI.selBand = null; EDUI.mode = 'edit';
  edApply(true);
  edRenderCampaign(srcIdx);
  edRenderLevel(); edRenderBeatList(); edRenderBandIns(); edTransport();
}
function edSelectLevel(i) {
  EDUI.li = Math.max(0, Math.min(i, EDUI.pkg.levels.length - 1));
  EDUI.playhead = 0; EDUI.selBeat = EDUI.selBand = null;
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
  const bad = EDUI.errs.length ? '<br><span class="warn">PACKAGE INVALID — canvas shows the last good data</span>' : '';
  h.innerHTML = mode + tool + bad;
}

// ---------- static wiring: transport, tools, lanes, keys, io ----------
function edBuildStatic() {
  // collapsible side sections
  for (const sec of document.querySelectorAll('.sec > h2'))
    sec.addEventListener('click', () => sec.parentElement.classList.toggle('closed'));

  edq('edHome').addEventListener('click', () => { if (EDUI.mode === 'edit') edScrub(0); });
  edq('edPlay').addEventListener('click', edTogglePlay);
  edq('edLive').addEventListener('click', edGoLive);
  edq('edStop').addEventListener('click', edBackToEdit);

  // beat tool palette (short labels — eleven tools share one bar)
  const toolNames = { select: 'SEL', normal: 'NORM', heavy: 'HVY', line: 'LINE', lock0: 'LK0',
    lock1: 'LK1', frag: 'FRAG', wall: 'WALL', strip: 'STRIP', pickup: 'PICK', lull: 'LULL' };
  const tools = edq('edTools');
  for (const t of EDTOOLS) {
    const b = edEl('button', t === 'select' ? 'on' : '', tools);
    b.textContent = toolNames[t];
    b.title = t;
    b.dataset.tool = t;
    if (ED.colors[t]) b.style.borderBottom = '2px solid ' + ED.colors[t];
    b.addEventListener('click', () => {
      EDUI.tool = t;
      for (const o of tools.children) o.classList.toggle('on', o.dataset.tool === t);
      edHud();
    });
  }

  // keyboard: typing must never leak into the game's key handlers, and
  // DELETE / SPACE are editor verbs
  window.addEventListener('keydown', e => {
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) { e.stopImmediatePropagation(); return; }
    if (EDUI.mode === 'live') return; // the game owns the keys during live play
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); edDeleteSel(); }
    if (e.key === ' ') { e.preventDefault(); e.stopImmediatePropagation(); edTogglePlay(); }
  }, true);

  // canvas overlay: click-to-place beats (t = playhead, angle = click bearing)
  edq('edOv').addEventListener('pointerdown', e => {
    if (EDUI.mode === 'play') edTogglePlay(); // placing implies pausing
    if (EDUI.mode !== 'edit' || EDUI.tool === 'select' || EDUI.errs.length) return;
    const g = geo(); // the real game's bore geometry — canvas sits at page (0,0)
    const angle = ED.norm(Math.atan2(e.clientY - g.cy, e.clientX - g.cx));
    const withAngle = EDUI.tool !== 'strip' && EDUI.tool !== 'pickup' && EDUI.tool !== 'lull';
    const beat = ED.makeBeat(EDUI.tool, ED.snap(EDUI.playhead), withAngle ? +angle.toFixed(3) : undefined);
    if (beat.angle === undefined) delete beat.angle;
    ED.addBeat(edLv(), beat);
    EDUI.selBeat = beat; EDUI.selBand = null;
    edApply(true); edRenderBeatList();
  });

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
  lBind('lName', 'name');
  edq('lName').addEventListener('change', () => edRenderCampaign()); // the levels list shows names
  lBind('lHint', 'hint', v => v || undefined);
  lBind('lTint', 'tint', v => { const t = ED.hexToTint(v); edq('lTintTxt').textContent = t; return t; });
  lBind('lTrack', 'track', v => +v, 'change');
  lBind('lBoss', 'boss', (v, el) => el.checked || undefined, 'change');
  lBind('lBursts', 'bursts', (v, el) => el.checked || undefined, 'change');
  lBind('lSpeed', 'speed', v => +v || 0.1);
  lBind('lSMin', 'spawnMin', v => +v || 0.1);
  lBind('lSMax', 'spawnMax', v => +v || 0.1);
  lBind('lCase', 'caseNote');
  edq('lDur').addEventListener('change', e => {
    const lv = edLv();
    lv.duration = Math.max(10, Math.min(600, +e.target.value || 45));
    for (const b of lv.beats || []) ED.retimeBeat(lv, b, b.t); // pull beats back inside
    ED.normalizeBands(lv);
    edApply(true); edRenderBeatList(); edRenderBandIns();
  });
  const story = () => {
    const t = edq('lStoryT').value.trim();
    const lines = edq('lStoryL').value.split('\n').map(s => s.trim()).filter(Boolean);
    if (!t && !lines.length) delete edLv().story;
    else edLv().story = { title: t || 'LOG', lines: lines.length ? lines : ['…'] };
    edApply();
  };
  edq('lStoryT').addEventListener('input', story);
  edq('lStoryL').addEventListener('input', story);
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
  edq('mapImgClr').addEventListener('click', () => { EDUI.pkg.map = { theme: 'city' }; edApply(); edPaintMap(); });

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

// ---------- timeline rendering ----------
function edPlacePlayhead() {
  const w = edq('edRuler').clientWidth;
  edq('edPh').style.left = ED.t2x(EDUI.playhead, edLv().duration, w) + 'px';
}
function edRenderTimeline() {
  const lv = edLv();
  const w = edq('edRuler').clientWidth;
  // ruler: ticks + comm diamonds
  const ruler = edq('edRuler');
  ruler.innerHTML = '<span class="laneTag">TIME</span>';
  const step = lv.duration > 180 ? 30 : lv.duration > 90 ? 10 : 5;
  for (let t = 0; t <= lv.duration; t += step) {
    const x = ED.t2x(t, lv.duration, w);
    edEl('div', 'tick', ruler).style.left = x + 'px';
    if (!t) continue; // the TIME tag owns the left corner
    const l = edEl('div', 'tickL', ruler);
    l.style.left = (x + 3) + 'px';
    l.textContent = t + 's';
  }
  for (const c of lv.comms || []) {
    const d = edEl('div', 'commD', ruler);
    d.style.left = (ED.t2x(c.t, lv.duration, w) - 3) + 'px';
    const spk = (EDUI.pkg.speakers || []).find(s => s.id === c.s);
    d.style.background = spk ? 'rgb(' + spk.color + ')' : '#888';
    d.title = c.t + 's ' + c.s + ': ' + c.m;
  }
  // beat lane
  const bl = edq('edBeatLane');
  bl.innerHTML = '<span class="laneTag">BEATS</span>';
  for (const b of lv.beats || []) {
    let el;
    if (b.kind === 'lull') {
      el = edEl('div', 'lullM', bl);
      el.style.left = ED.t2x(b.t, lv.duration, w) + 'px';
      el.style.width = Math.max(6, ED.t2x(b.dur || 1, lv.duration, w)) + 'px';
      el.title = 'lull ' + b.t + 's +' + b.dur + 's';
    } else {
      el = edEl('div', 'beatM', bl);
      el.style.left = ED.t2x(b.t, lv.duration, w) + 'px';
      el.style.background = ED.colors[ED.beatKey(b)] || '#999';
      el.title = ED.beatKey(b) + ' @ ' + b.t + 's';
      const lbl = edEl('div', 'bLbl', el);
      lbl.textContent = ED.beatKey(b).slice(0, 4);
    }
    if (b === EDUI.selBeat) el.classList.add('sel');
    el._beat = b;
    edWireBeatDrag(el, bl);
  }
  edPaintBands();
  edPlacePlayhead(); edClock();
}
function edWireBeatDrag(el, bl) {
  el.addEventListener('pointerdown', e => {
    if (EDUI.mode !== 'edit') return;
    e.stopPropagation();
    const lv = edLv(), b = el._beat;
    EDUI.selBeat = b; EDUI.selBand = null;
    for (const o of bl.children) o.classList && o.classList.toggle('sel', o._beat === b);
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
      edApply(true); edRenderBeatList();
    };
    el.addEventListener('pointermove', mv);
    el.addEventListener('pointerup', up);
  });
}
function edPaintBands() {
  const lv = edLv();
  const lane = edq('edBandLane');
  lane.innerHTML = '<span class="laneTag">BANDS</span>';
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
    nm.textContent = (i + 1) + '. ' + l.name + (l.boss ? ' ◆' : '');
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
function edRenderLevel() {
  const lv = edLv();
  edq('lName').value = lv.name || '';
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
  edq('lStoryT').value = lv.story ? lv.story.title : '';
  edq('lStoryL').value = lv.story ? lv.story.lines.join('\n') : '';
  edq('lCase').value = lv.caseNote || '';
  // comms
  const cm = edq('lComms');
  cm.innerHTML = '';
  (lv.comms || []).forEach((c, i) => {
    const row = edEl('div', 'row', cm);
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
    x.addEventListener('click', () => { lv.comms.splice(i, 1); edApply(); edRenderLevel(); });
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
    const sw = edEl('span', 'swatch', row);
    sw.style.background = ED.colors[ED.beatKey(b)] || '#46608c';
    const t = edEl('input', '', row); t.type = 'number'; t.step = 0.1; t.value = b.t; t.style.width = '58px'; t.title = 't (arrival)';
    t.addEventListener('change', e => { ED.retimeBeat(lv, b, +e.target.value || 0); edApply(true); edRenderBeatList(); });
    const tag = edEl('span', '', row); tag.textContent = b.kind;
    if (b.kind === 'enemy' || b.kind === 'pickup') {
      const s = edEl('select', '', row);
      const opts = b.kind === 'enemy' ? ['normal', 'heavy', 'line', 'lock0', 'lock1', 'frag'] : EDPICKUPS;
      for (const o of opts) { const op = edEl('option', '', s); op.value = o; op.textContent = o || '(random)'; }
      s.value = b.type || '';
      s.addEventListener('change', e => {
        if (e.target.value) b.type = e.target.value; else delete b.type;
        sw.style.background = ED.colors[ED.beatKey(b)] || '#46608c';
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
    const x = edEl('button', 'xbtn danger', row); x.textContent = '✕';
    x.addEventListener('click', e => {
      e.stopPropagation();
      ED.deleteBeat(lv, b);
      if (EDUI.selBeat === b) EDUI.selBeat = null;
      edApply(true); edRenderBeatList();
    });
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
    row.innerHTML = 'L' + (i + 1) + ' ' + EDUI.pkg.levels[i].name + ': <b>' + li2.length + '</b> finding' + (li2.length > 1 ? 's' : '');
    row.addEventListener('click', () => edSelectLevel(i));
  });
}

if (typeof window !== 'undefined' && window.__EDITOR_PAGE__) edBoot();
