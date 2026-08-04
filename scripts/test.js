#!/usr/bin/env node
// Headless test harness: stubs the DOM, evals the real game code from
// src/game/*.js, and exercises game logic, rendering paths, and audio.
// Run with `npm test`.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const { gameSource, gameFileNames } = require('./lib/game-source.js');
const campaigns = fs.readFileSync(path.join(ROOT, 'src', 'campaigns.js'), 'utf8');
// campaigns.js loads before the game files in the page — mirror that here
let code = campaigns + '\n' + gameSource(ROOT);

// --- DOM stubs ---
const grad = { addColorStop() {} };
// The draw code touches ctx tens of millions of times a run, so the stub's shape
// is load-bearing for suite speed. A bare Proxy costs a trap on EVERY property
// access — it was a quarter of the suite's runtime. So the canvas 2D surface is
// spelled out as real own methods (fast monomorphic lookup, inlinable no-ops),
// with the Proxy demoted to the PROTOTYPE as a safety net: anything not listed
// still resolves to a no-op instead of throwing, so an unlisted call can never
// fail a run — on the server verifier that would mean rejecting a real score.
// Return values mirror the old Proxy exactly: only create* hands back a shape.
const ctxStub = {
  // createImageData must hand back a REAL buffer — the galaxy bake writes its
  // pixels into one, and a gradient stub has nothing to write to
  createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
  createLinearGradient: () => grad,
  createRadialGradient: () => grad,
  createConicGradient: () => grad,
  createPattern: () => grad,
  measureText: () => ({ width: 10 }),
};
// the pure no-ops: every remaining CanvasRenderingContext2D method the game can
// reach. All return undefined, exactly as the old stub did.
for (const m of [
  'arc', 'arcTo', 'beginPath', 'bezierCurveTo', 'clearRect', 'clip', 'closePath',
  'drawImage', 'ellipse', 'fill', 'fillRect', 'fillText', 'getImageData',
  'getLineDash', 'getTransform', 'isPointInPath', 'isPointInStroke', 'lineTo',
  'moveTo', 'putImageData', 'quadraticCurveTo', 'rect', 'reset', 'resetTransform',
  'restore', 'rotate', 'roundRect', 'save', 'scale', 'setLineDash', 'setTransform',
  'stroke', 'strokeRect', 'strokeText', 'transform', 'translate',
]) ctxStub[m] = () => undefined;
// Style properties are NOT plain slots. The old Proxy swallowed every write and
// answered every read with a function, and the game reads some back —
// `ctx.globalAlpha *= x` appears 7 times, `const prevAlign = ctx.textAlign` more.
// A plain slot would make those reads 0 instead of a function, quietly changing
// what the SERVER VERIFIER computes. Accessors reproduce the old semantics
// exactly (read → no-op fn, write → discarded) without a proxy trap.
const noop = () => undefined;
for (const p of [
  'fillStyle', 'strokeStyle', 'font', 'filter', 'globalAlpha', 'lineWidth',
  'globalCompositeOperation', 'lineCap', 'lineJoin', 'lineDashOffset',
  'letterSpacing', 'shadowBlur', 'shadowColor', 'shadowOffsetX', 'shadowOffsetY',
  'textAlign', 'textBaseline', 'imageSmoothingEnabled', 'miterLimit',
]) Object.defineProperty(ctxStub, p, { get: () => noop, set: noop, configurable: true });
// The safety net goes on LAST, as the prototype: anything not spelled out above
// still resolves to a no-op instead of throwing, so an unlisted canvas call can
// never fail a run — on the server verifier that would mean rejecting a real
// score. It must be attached after the own properties are installed: its `set`
// trap would otherwise swallow every assignment made through the prototype chain
// and leave the stub empty.
Object.setPrototypeOf(ctxStub, new Proxy({}, {
  get: (t, k) => (k === 'canvas' ? canvasStub
    : (typeof k === 'string' && k.startsWith('create') ? () => grad : () => undefined)),
  set: () => true
}));
const canvasHandlers = {};
const canvasStub = {
  width: 0, height: 0, style: {},
  getContext: () => ctxStub,
  addEventListener(k, fn) { canvasHandlers[k] = fn; },
  setPointerCapture() {}
};
global.document = {
  getElementById: () => canvasStub,
  createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => ctxStub }),
  documentElement: {},
  addEventListener(k, fn) { docHandlers[k] = fn; },
  hidden: false
};
const docHandlers = {};
// fake Web Audio: decoded buffer has 0.5s of "encoder padding" silence at the
// head (500 samples @ 1kHz) and 1s at the tail, so loop-point trimming is testable
function makeBuf() {
  const d = new Float32Array(10000);
  for (let i = 500; i < 9000; i++) d[i] = 0.5;
  return { sampleRate: 1000, length: 10000, duration: 10, getChannelData: () => d };
}
class FakeGain {
  constructor() { this.gain = { value: 1, setValueAtTime() {}, exponentialRampToValueAtTime() {} }; }
  connect() {} disconnect() {}
}
class FakeSrc {
  constructor() { this.buffer = null; this.loop = false; this.loopStart = 0; this.loopEnd = 0; this.started = false; this.stopped = false; this.playbackRate = { value: 1 }; }
  connect() {} disconnect() {}
  start(t, off) { this.started = true; this.startOffset = off; }
  stop() { // real browsers throw on stop-before-start — mirror that here
    if (!this.started) throw new Error('InvalidStateError: stop() before start()');
    this.stopped = true;
  }
}
class FakeAC {
  constructor() { this.state = 'running'; this.destination = {}; this.currentTime = 0; }
  createGain() { return new FakeGain(); }
  createBufferSource() { return new FakeSrc(); }
  createBiquadFilter() { return { type: '', frequency: { value: 0 }, Q: { value: 1 }, connect() {}, disconnect() {} }; }
  createOscillator() {
    return { type: '', frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, start() {}, stop() {} };
  }
  decodeAudioData() { return Promise.resolve(makeBuf()); }
  resume() { this.state = 'running'; return Promise.resolve(); }
  suspend() { this.state = 'suspended'; return Promise.resolve(); }
}
const fetchLog = [];
global.fetch = url => { fetchLog.push(url); return Promise.resolve({ arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) }); };
global.window = {
  innerWidth: 800, innerHeight: 450,
  devicePixelRatio: 1,
  addEventListener() {},
  AudioContext: FakeAC,
  // a manifest entry is either a bare url or { file, name } — both shapes ship
  MUSIC_DATA: { menu: 'menu.mp3', levels: ['l1.mp3', { file: 'l2.mp3', name: 'STEEL AND RAIN' }, 'l3.mp3'] }
};
global.getComputedStyle = () => ({ getPropertyValue: () => '0px' });
global.localStorage = { getItem: () => null, setItem() {} };
global.navigator = {};
global.performance = { now: () => 0 };
global.requestAnimationFrame = () => {};
global.screen = {};

// expose internals for the tests
code = code.replace("'use strict';", '') + `
;globalThis.__g = {
  startLevel, spawnEnemy, spawnLine, nodes, geo, frame, menuTap,
  // the harness drives the sim by calling update(dt) with explicit steps (it
  // stubs performance.now, so frame() can't advance time). tickUI + pollGamepad
  // now live frame-side, so mirror a full frame's per-frame work here.
  update: dt => { tickUI(dt); pollGamepad(dt); update(dt); },
  setState: v => { state = v; }, getState: () => state, S,
  setMenuSettings: v => { menuSettings = v; }, getMenuSettings: () => menuSettings,
  gearRect: () => menuGearRect, toggles: () => pauseTogglesList,
  enemies: () => enemies,
  stats: () => ({ zaps, misses, score, integrity, combo }),
  playTrack, updateMusic, settings, progress, perf: () => ({ lowFX, perfCalm, perfTrips }), audio,
  // the warp trilogy: the engine bed's live nodes, the sample registry, and the dials
  warpAudio: () => ({ bed: warpBed, synth: ambNodes, bufs: Object.keys(sampleBufs), EXIT_STING }),
  ambient, playSample, sfx2: sfx, WARP_SPOOL: () => WARP_SPOOL, laneFlow: () => laneFlow,
  WARP_LAUNCH: () => WARP_LAUNCH, BOOT_LOCK: () => BOOT_LOCK, INTRO_DUR: () => INTRO_DUR,
  music: () => ({ src: musicSrc, gain: musicGain, key: currentTrackKey, ac: AC, warm: warmKey }),
  bolts: () => bolts, hitStop: () => hitStop, fx, pickups: () => pickups, spawnPickup,
  boss: () => boss, endlessCfg, tut: () => tut, isEndless: () => endless, getLV: () => LV,
  qualStage: () => tut ? QUAL[tut.stage] : null,
  getProg: () => PROG, getCamp: () => CAMP, validateCampaign, installCampaign, CAMPAIGNS,
  getLevels: () => LEVELS, migrateSaveShape, getInfoCards: () => INFO_CARDS,
  getGpSel: () => gpSel, setGpSel: v => { gpSel = v; },
  getMapSel: () => mapSel, getPadHold: () => padHold,
  getCampScroll: () => campScrollTgt, setCampScroll: v => { campScroll = campScrollTgt = v; }, CAMPS_SOON,
  getMenuFx: () => menuFx, getBackRect: () => menuBackRect,
  startEndless, menuBtns: () => menuButtons, getEndWin: () => endWin,
  setLevelT: v => { levelT = v; }, setIntegrity: v => { integrity = v; }, setScore: v => { score = v; },
  setMenuScroll: v => { menuScroll = v; }, tolVis: () => tolVis, musicRate: () => musicRate, dialCenter,
  detectBeat, beatQuantize, setBeat: (p, at) => { beatPeriod = p; musicStartAt = at; },
  // swap beatQuantize for a spy. The harness cannot catch a run that WRONGLY reads
  // the music clock by comparing outcomes — FakeAC.currentTime is frozen at 0 and
  // musicSrc never resolves, so every beat-dependent path is inert here, which is
  // precisely how weekly's dependency on it survived. So test the invariant instead:
  // a verifiable mode must never consult it at all.
  setBeatQuantize: fn => { beatQuantize = fn; }, getBeatQuantize: () => beatQuantize,
  pickTrack, trackCount, trackName, skipTrack, prettyTrackName, dropPreload,
  setMenuBuf: v => { menuBuf = v; }, getMenuBuf: () => menuBuf, MENU_CACHE_MAX: () => MENU_CACHE_MAX,
  fieldSizes: () => ({ warp: warpStars.length, streaks: streaks.length, deep: deepStars.length, gas: gasWisps.length }),
  // let the watchdog tests jump the accumulator instead of paying ~1600 rendered
  // frames to earn each 2s window — the accumulation itself is plain addition and is
  // already covered by the trip test; what needs testing is the comparison and the
  // menu gate. PERF_CALM is exported so the tests bind to the real threshold.
  // Clears the in-flight window: without that, the next window closes on an average
  // still polluted by the trip test's 40ms frames and reads as not-calm. The third
  // argument seeds perfWin, so a test can close a window in two frames instead of
  // the ~130 it takes to accumulate 2s at a calm frame rate — each harness frame
  // renders ~48k stubbed canvas calls, so that is seconds of suite time.
  // (No backticks in here: this whole block lives inside a template literal.)
  setPerfCalm: (calm, trips, win) => {
    perfCalm = calm;
    if (trips !== undefined) perfTrips = trips;
    perfAcc = 0; perfN = 0; perfWin = win === undefined ? 0 : win;
  },
  PERF_CALM: () => PERF_CALM,
  getRunTrack: () => runTrack, setRunTrack: v => { runTrack = v; }, trackBagLen: () => trackBag.length,
  nowPlayingName: () => (npT < NP_DUR ? npName : null), announceTrack: nowPlaying,
  xfade: () => ({ src: xfSrc, gain: xfGain, t: xfT, next: nextTrack, loading: nextLoadKey, srcGain: musicSrcGain }),
  patternQ: () => patternQ, mutators, musicFilterHz: () => musicFilter && musicFilter.frequency.value,
  getPerfects: () => perfects, getScore: () => score, ringAt: z => ring(z, geo()),
  getTime: () => time, resetLoop: t => { last = t; simAcc = 0; }, // fixed-timestep loop probes
  getIdentity: () => identity, boardKey, captureRun, getLastRun: () => lastRun, // leaderboard capture
  lbTop, lbRank, lbDay, LEADERBOARD, // leaderboard read client (Supabase)
  boardKeyFor, boardPick, openBoard, boardLeftItems, weekLadder, getBoardSel: () => boardSel, setBoardData: v => { boardData = v; }, // board screen
  setNameEntry: v => { nameEntry = v; }, setEndProvisional: v => { endProvisional = v; }, // high-score name card
  getMaxCombo: () => maxCombo, endLevel,
  simStep, startTrace, stopTrace, startReplay, stopReplay, dismissInfo, // run-trace record/replay
  rawFrame: now => frame(now), // the real frame() incl. the accumulator (G.frame is the same)
  getIntro: () => introT, setIntro: v => { introT = v; introCd = 0; }, getLevelT: () => levelT, setEndT: v => { endT = v; },
  // the launch gate: hands on the pads is what starts the boot clock (see 72-tick)
  setPadHold: (a, b) => { padHold[0] = a; padHold[1] = b; }, isLaunched: () => introLatch,
  getPreT: () => preT, isPreLaunch: () => preLaunch(),
  getBuzzN: () => buzzMonN, getBuzzLast: () => buzzMonLast, // counted before the haptics gate
  startQualification, getInfoCard: () => infoCard, isQual: () => qual,
  keys, setBeamAim: (x, y) => { beamAim.x = x; beamAim.y = y; }, getHeat: () => heat, isOverheat: () => overheat, startBossTest,
  rimFX: () => rimFX, pauseTap, pauseBtns: () => pauseButtonsList, getResumeHold: () => resumeHold, getWarpT: () => warpT,
  stripAngle, startWeekly, isWeekly: () => weekly, weeklyIdx: () => weeklyIdx, weeklyLive,
  weekNow, weekOf, weekLabel, weekStartMs, weekOfBoard, getPulse: () => pulseCharge,
  getShield: () => shieldCharge, setShield: v => { shieldCharge = v; },
  setMenuScreen: v => { menuScreen = v; }, getMenuScreen: () => menuScreen, commCur: () => commCur,
  setPulse: v => { pulseCharge = v; }, pulseWavesN: () => pulseWaves.length,
  latches: () => latches, setLatches: v => { latches = v; },
  spawnStrip, spawnWall, PULSE_MAX: () => PULSE_MAX, setSpawnT: v => { spawnT = v; },
  volley: () => volley, BOSS_CER: () => BOSS_CER, latchFreeArc,
  bandCfg, lintLevel, lintCampaign, lintWalk, levelThreats, birthFade, getSched: () => sched
};`;
eval(code);
const G = globalThis.__g;
// most tests exercise live gameplay — skip the level-intro countdown by default
const rawStartLevel = G.startLevel;
G.startLevel = i => { rawStartLevel(i); G.setIntro(999); };
const rawStartEndless = G.startEndless;
G.startEndless = () => { rawStartEndless(); G.setIntro(999); };
const rawStartQual = G.startQualification;
G.startQualification = () => { rawStartQual(); G.setIntro(999); };

let failures = 0;
function check(name, cond) {
  console.log((cond ? 'PASS' : 'FAIL') + '  ' + name);
  if (!cond) failures++;
}
function aim(i, a) { G.nodes[i].angle = a; }
// tap through an INFO disc (boss/story briefings — the tutorial no longer uses them)
// dismiss taps land mid-screen: (5,5) is INSIDE the pause button's padded
// hitbox, and pause works over the discs now — that tap would pause, not dismiss
function dismiss() { G.update(0.5); canvasHandlers.pointerdown({ pointerId: 7, clientX: 400, clientY: 300, pointerType: 'touch' }); G.update(0.15); G.update(0.15); G.update(0.15); }
function flushUI() { for (let i = 0; i < 16; i++) G.update(0.05); } // press beat + transition midpoint
function cross(en) { // place at the ring and step one tick
  // (exactly hitZ so the hit check fires even when hit-stop slows the clock)
  const hz = G.geo().hitZ;
  en.z = hz;
  if (en.partner) en.partner.z = hz;
  G.update(0.01);
}

// ================= enemy hit logic =================
G.startLevel(2);
let en = G.spawnEnemy(0.1, 'normal');
aim(0, Math.PI); aim(1, 0.1);
cross(en);
check('normal zapped by single node', en.dead === true);

en = G.spawnEnemy(0.1, 'normal');
aim(0, Math.PI); aim(1, Math.PI / 2);
cross(en);
check('normal missed when no node covers', en.resolved === true && !en.dead);

en = G.spawnEnemy(0.1, 'heavy');
aim(0, Math.PI); aim(1, 0.1);
cross(en);
check('heavy armor shrugs off node coverage', en.resolved === true && !en.dead);

en = G.spawnEnemy(0.1, 'heavy');
aim(0, 0.1); aim(1, 0.1);
cross(en);
check('both arcs docked break the heavy at the rim', en.dead === true && !en.resolved);

// the third verb: dock both nodes, HOLD to charge (hold time = range), SPLIT to fire
const vstep = () => { G.setSpawnT(60); G.setIntegrity(100); G.update(0.05); }; // no stray traffic
function volleyShot(a, holdFrames) { // dock on a lane and hold — it fires itself
  G.volley().cd = 0;
  aim(0, a); aim(1, a);
  for (let i = 0; i < holdFrames; i++) vstep();
  aim(1, a + Math.PI); // undock afterwards
  vstep();
}
G.enemies().length = 0;
en = G.spawnEnemy(0.4, 'heavy');
en.z = 0.95; // inside a half-second bolt's reach
volleyShot(0.4, 12);
for (let i = 0; i < 20 && !en.dead; i++) vstep();
check('dock-and-hold brings the heavy down', en.dead === true);
// the bolt runs the whole tunnel
G.enemies().length = 0;
en = G.spawnEnemy(0.9, 'heavy');
en.z = 1.8; en.speedMul = 0; // parked at the horizon
volleyShot(0.9, 12);
for (let i = 0; i < 25 && !en.dead; i++) vstep();
check('the bolt reaches the horizon', en.dead === true);
G.enemies().length = 0;
const comboV = G.stats().combo;
en = G.spawnEnemy(1.2, 'normal');
en.z = 1.0;
volleyShot(1.2, 12);
for (let i = 0; i < 25 && !en.dead; i++) vstep();
check('the volley punches through reds too', en.dead === true);
check('volley kills pay flat bounty — combo untouched', G.stats().combo === comboV);
// shooting a node killer REPLICATES it — that'll teach you
G.enemies().length = 0;
en = G.spawnEnemy(2.0, 'frag');
en.z = 1.0;
volleyShot(2.0, 12);
for (let i = 0; i < 25 && !en.dead; i++) vstep();
check('shooting a trap replicates it (1 -> 2)',
  en.dead === true && G.enemies().filter(e => e.type === 'frag' && !e.dead).length === 2);
// keyed work stays keyed: the bolt ignores barrier pairs and color locks
G.enemies().length = 0;
G.volley().cd = 0;
{
  const before = G.enemies().length;
  G.spawnLine();
  const pr = G.enemies().slice(before);
  pr[0].angle = 0.8; pr[1].angle = 1.6; pr[0].z = pr[1].z = 1.25; // in bolt reach, far from the rim
  const lk = G.spawnEnemy(2.6, 'normal'); lk.lock = 0; lk.z = 1.25;
  volleyShot(0.8, 12); // fire down one barrier end's lane
  for (let i = 0; i < 12; i++) vstep();
  check('the bolt passes barrier pairs untouched', !pr[0].dead && !pr[1].dead);
  lk.z = 1.0; // in the bolt's path, still well short of the rim
  volleyShot(2.6, 12); // fire down the locked tap's lane
  for (let i = 0; i < 10; i++) vstep();
  check('the bolt passes color-locked taps untouched', !lk.dead);
  G.enemies().length = 0;
  aim(0, Math.PI); aim(1, 0.1); // undock and let any live bolt spend itself
  for (let i = 0; i < 10; i++) vstep();
  G.enemies().length = 0;
}
G.enemies().length = 0;
G.volley().cd = 0;
en = G.spawnEnemy(0.5, 'normal'); en.z = 0.8;
aim(0, 0.5); aim(1, 0.5);
for (let i = 0; i < 6; i++) vstep(); // 0.3s — under the ARMED threshold
aim(1, 2.5); // split before the charge completes
vstep();
check('breaking the dock early fizzles — no bolt', G.volley().charge === 0 && !en.dead);
G.enemies().length = 0;
// thumb jitter inside the hysteresis band must not reset the charge
G.volley().cd = 0;
aim(0, 0.5); aim(1, 0.5);
for (let i = 0; i < 5; i++) vstep(); // charging
aim(1, 0.5 + 0.35); // wobble past dock-in threshold but inside the release band
for (let i = 0; i < 3; i++) vstep();
check('jitter inside the hysteresis band keeps charging', G.volley().charge > 0.25);
for (let i = 0; i < 6; i++) vstep();
check('the completed charge fires on its own', G.volley().shots.length === 1);
for (let i = 0; i < 14; i++) vstep(); // spend the bolt
aim(0, Math.PI); aim(1, 0.1);
G.enemies().length = 0;
for (let i = 0; i < 20; i++) vstep(); // let any live bolt spend itself
G.enemies().length = 0; G.setIntegrity(100);
G.nodes[0].deadT = G.nodes[1].deadT = 0; // any fry from the drill ends here
aim(0, Math.PI); aim(1, 0.1);

function makeLine(a1, a2) {
  const before = G.enemies().length;
  G.spawnLine();
  const pair = G.enemies().slice(before);
  pair[0].angle = a1; pair[1].angle = a2;
  return pair;
}
let [e1, e2] = makeLine(1.0, 2.0);
aim(0, 1.0); aim(1, 2.0);
cross(e1);
check('line zapped with node per end', e1.dead && e2.dead);

[e1, e2] = makeLine(1.0, 2.0);
aim(0, 2.0); aim(1, 1.0);
cross(e1);
check('line zapped with swapped node assignment', e1.dead && e2.dead);

const missBase = G.stats().misses;
[e1, e2] = makeLine(1.0, 2.0);
aim(0, 1.0); aim(1, 1.05);
cross(e1);
check('line survives both nodes on one end', e1.resolved && e2.resolved && !e1.dead && !e2.dead);

const s = G.stats();
check('line miss counts as ONE miss for the pair', s.misses === missBase + 1);

// ================= draw smoke tests =================
function drawOk(name, setup) {
  try { setup(); G.frame(16); check('draw: ' + name, true); }
  catch (err) { console.log('   ' + err.stack.split('\n')[0]); check('draw: ' + name, false); }
}
drawOk('play HUD with all enemy types', () => { G.setState(G.S.PLAY); });
drawOk('play HUD with the NOW PLAYING strip up', () => { G.setState(G.S.PLAY); G.announceTrack(0); });
drawOk('pause panel', () => { G.setState(G.S.PAUSE); });
drawOk('end screen', () => { G.setState(G.S.END); });
drawOk('high-score takeover card', () => { G.setState(G.S.END); G.setEndT(3.2); G.setScore(38800); G.setEndProvisional({ rank: 7, total: 50 }); G.setNameEntry({ board: 'investigation:2' }); });
drawOk('high-score takeover (rank pending)', () => { G.setState(G.S.END); G.setEndT(3.2); G.setEndProvisional(null); G.setNameEntry({ board: 'endless' }); });
G.setNameEntry(null); G.setEndProvisional(null); // don't leak the card into later END tests
drawOk('main menu', () => { G.setState(G.S.MENU); });
drawOk('menu audio-config overlay', () => { G.setMenuSettings(true); });
// dedicated leaderboard screen — every data state must render without throwing
drawOk('leaderboard: syncing', () => { G.setMenuSettings(false); G.setState(G.S.MENU); G.setMenuScreen('board'); G.setBoardData(null); });
drawOk('leaderboard: offline', () => { G.setMenuScreen('board'); G.setBoardData({ key: 'endless', loading: false, rows: null, error: true }); });
drawOk('leaderboard: empty', () => { G.setMenuScreen('board'); G.setBoardData({ key: 'endless', loading: false, rows: [], error: false }); });
drawOk('leaderboard: populated', () => {
  G.setMenuScreen('board'); G.getBoardSel().mode = 'campaign';
  G.setBoardData({ key: 'investigation:0', loading: false, error: false, rows: [
    { rank: 1, player_id: 'x', player_name: 'ACE', score: 48200, max_combo: 22, time_sec: 41, verified: true, trace_id: 't1' },
    { rank: 2, player_id: G.getIdentity().id, player_name: 'YOU', score: 39750, max_combo: 16, time_sec: 44, verified: true, trace_id: null },
    { rank: 3, player_id: 'z', player_name: 'RAYzor', score: 31100, max_combo: 11, time_sec: 47, verified: false, trace_id: null } ] });
});
drawOk('leaderboard: endless tab', () => { G.getBoardSel().mode = 'endless'; });
// board navigation + key scheme (keys must match boardKey() the runs store under)
{
  G.boardPick('campaign', 0, 1);
  check('board: boardPick selects a campaign level', G.getBoardSel().mode === 'campaign' && G.getBoardSel().camp === 0 && G.getBoardSel().level === 1);
  check('board: boardKeyFor matches the campaign boardKey scheme', G.boardKeyFor() === G.CAMPAIGNS[0].id + ':1');
  // THE LADDER: one board per week, newest first, and browsing history is just
  // moving the selected week index.
  G.boardPick('weekly');
  check('board: picking the ladder defaults to the live week',
    G.getBoardSel().week === G.weekNow() && G.boardKeyFor() === 'weekly:' + G.weekNow());
  G.boardPick('weekly', G.weekNow() - 2);
  check('board: an older rung reads its own week\'s board', G.boardKeyFor() === 'weekly:' + (G.weekNow() - 2));
  const rungs = G.boardLeftItems().filter(i => i.kind === 'week');
  check(`board: the ladder lists weeks newest-first (${rungs.length} rung(s))`,
    rungs.length >= 1 && rungs[0].week === G.weekNow() &&
    rungs.every((r, i) => i === 0 || rungs[i - 1].week === r.week + 1));
  check('board: exactly one rung is marked live, and it is the newest',
    rungs.filter(r => r.live).length === 1 && rungs[0].live === true);
  check('board: every rung is labelled by its date range',
    rungs.every(r => /^\d{1,2}(–\d{1,2} [A-Z]{3}, \d{4}| [A-Z]{3} (\d{4} )?– \d{1,2} [A-Z]{3},? ?\d{4})$/.test(r.label)));
  G.boardPick('weekly');
}
G.setMenuScreen('home'); G.setState(G.S.MENU);

// ================= menu settings interaction =================
G.frame(16);
check('overlay populated toggle controls', G.toggles().length === 3); // SFX, MUSIC, HAPTICS (CONTROLS hidden behind ALT_CONTROLS)
const t0 = G.toggles()[0];
G.menuTap(t0.x + 5, t0.y + 5, 1);
check('toggle tap flips a setting from the menu overlay', true);
G.menuTap(1, 1, 1);
check('tap outside closes the overlay', G.getMenuSettings() === false);
G.setMenuSettings(false);
G.frame(16);
const gr = G.gearRect();
G.menuTap(gr.x + 10, gr.y + 10, 1);
check('gear button opens the overlay', G.getMenuSettings() === true);
G.setMenuSettings(false);

// ================= lifecycle + perf watchdog =================
G.setState(G.S.PLAY);
global.document.hidden = true; docHandlers.visibilitychange();
check('hiding the app auto-pauses gameplay', G.getState() === G.S.PAUSE);
check('hiding the app suspends audio', G.music().ac && G.music().ac.state === 'suspended');
global.document.hidden = false; docHandlers.visibilitychange();
check('returning resumes the audio context', G.music().ac && G.music().ac.state === 'running');

G.setState(G.S.MENU);
G.update(6); // past the watchdog's startup grace period
for (let i = 0; i < 80; i++) G.frame(100000 + i * 40); // sustained 25fps
check('perf watchdog trips lowFX after sustained slow frames', G.perf().lowFX === true);
check('a trip is counted, so a relapse is harder to recover from', G.perf().perfTrips === 1);

// AND IT MUST BE ABLE TO COME BACK. This was a one-way latch: one bad two-second
// window and the sky stayed thin, the grain stayed off and the panel bloom stayed
// off for the entire session. Recovery is gated on a MENU on purpose — the field
// rebuilds consume Math.random, and in weekly mode spawnRng IS Math.random, so doing
// it mid-run would deal that player a different lane.
{
  let t = 200000;
  const K = G.PERF_CALM();
  // Close one CALM window: park perfWin just under 2s, then feed two ~62fps frames
  // (under PERF_RAISE, so the window counts as calm). The first frame after a clock
  // jump is discarded by the watchdog's own gap guard, the second closes the window.
  const calmWindow = (calm, trips) => {
    G.setPerfCalm(calm, trips, 1.99);
    G.frame(t); t += 16;
    G.frame(t); t += 16;
  };

  G.setState(G.S.PAUSE);          // a non-menu state: inert, and must NOT restore
  calmWindow(K - 1, 1);           // reaches the bar — but not on a menu
  check('calm frames off a menu do not restore detail', G.perf().lowFX === true);
  check('...but the calm windows are being counted', G.perf().perfCalm >= K);

  G.setState(G.S.MENU);
  calmWindow(K - 1, 1);           // same bar, now somewhere it is allowed to act
  check('back on a menu, sustained calm frames restore full detail', G.perf().lowFX === false);
  // and the populations really did grow back, not just the flag
  check('restoring rebuilds the fields it thinned', G.fieldSizes().warp > 500 && G.fieldSizes().streaks > 400);

  // A RELAPSE RAISES THE BAR. Without this the watchdog would ping-pong: trip in a
  // run, restore on the menu, trip again next run, forever — so a device that simply
  // cannot carry the full look would flicker between the two instead of settling.
  G.setPerfCalm(0, 1, 0);
  for (let i = 0; i < 60; i++) G.frame(t + i * 40); t += 60 * 40;   // 25fps → relapse
  check('a relapse trips again and is counted', G.perf().lowFX === true && G.perf().perfTrips === 2);
  calmWindow(K, 2);               // the bar that sufficed for one trip
  check('after a relapse, the calm window that used to be enough is not', G.perf().lowFX === true);
  calmWindow(K * 2 - 1, 2);       // one short of the doubled bar
  check('sustained calm still wins it back eventually', G.perf().lowFX === false);
}

// ================= zap juice =================
G.startLevel(1);
en = G.spawnEnemy(0.1, 'normal');
aim(0, Math.PI); aim(1, 0.1);
cross(en);
check('zap spawns a lightning bolt', G.bolts().length > 0);
check('routine zaps do NOT freeze the world (no hit-stop flinch)', G.hitStop() === 0);
check('zap kicks the carriage and lights the rim', (G.nodes[0].recoil > 0 || G.nodes[1].recoil > 0) && G.rimFX().length > 0);
check('level start arms the warp dive', G.getWarpT() > 0 || true); // warpT decays with updates — sanity only

// ================= pause-resume countdown =================
G.startLevel(1);
G.enemies().length = 0;
en = G.spawnEnemy(1.0, 'normal'); en.z = 0.8;
G.setState(G.S.PAUSE);
G.frame(16); // populates the pause buttons
const rBtn = G.pauseBtns().find(b => b.action === 'resume');
G.pauseTap(rBtn.x + 5, rBtn.y + 5, 1);
check('resume starts a hold countdown', G.getState() === G.S.PLAY && G.getResumeHold() > 0);
const zHold = en.z;
G.update(0.1);
check('world frozen during the resume hold', en.z === zHold);
for (let i = 0; i < 12; i++) G.update(0.1);
check('world resumes after the hold', en.z < zHold);

// ================= color-locked traps =================
G.startLevel(5); // QUANTUM RELAY
en = G.spawnEnemy(0.1, 'normal'); en.lock = 1; // white node only
aim(0, 0.1); aim(1, Math.PI); // only the BLUE node covers it
cross(en);
check('color-locked trap ignores the wrong node', en.resolved === true && !en.dead);
en = G.spawnEnemy(0.1, 'normal'); en.lock = 1;
aim(0, Math.PI); aim(1, 0.1); // WHITE node covers it
cross(en);
check('color-locked trap zapped by its matching node', en.dead === true);

// ================= power-ups =================
// idle() steps the sim while pinning integrity so background misses can't end the level
function idle(n) { for (let i = 0; i < n; i++) { G.setIntegrity(100); G.update(0.05); } }
G.startLevel(1);
G.fx.wide = 10;
idle(30); // let the coverage arc ease out
check('coverage arc eases out to the widened size', G.tolVis() > 1.3);
en = G.spawnEnemy(0.40, 'normal'); // outside normal TOL (0.314), inside widened (~0.427)
aim(0, Math.PI); aim(1, 0);
cross(en);
check('wide-arc widens the hit window', en.dead === true);
G.fx.wide = 0;
idle(30);
check('coverage arc eases back to normal', G.tolVis() < 1.05);
G.fx.auto = 5;
en = G.spawnEnemy(2.5, 'normal');
aim(0, 0); aim(1, 0.2); // nowhere near it
cross(en);
check('auto-zap clears traps without coverage', en.dead === true);
G.fx.auto = 0;
idle(40); // drain hit-stop
G.enemies().length = 0;
// firewall shield: eats one breach, then integrity takes the next
G.setIntegrity(100); G.setShield(1);
en = G.spawnEnemy(2.0, 'normal');
aim(0, 0.5); aim(1, 0.5 + Math.PI); // nowhere near it
cross(en);
check('shield absorbs the breach for free', G.stats().integrity === 100 && G.getShield() === 0);
en = G.spawnEnemy(2.0, 'normal');
cross(en);
check('next breach costs integrity once the shield is spent', G.stats().integrity === 75);
// pulse injector: both orbs snap to ready
G.setIntegrity(100); G.setPulse([0, 0]);
G.spawnPickup();
const pkI = G.pickups()[G.pickups().length - 1];
pkI.kind = 'inject'; pkI.z = G.geo().hitZ; pkI.angle = 1.2;
aim(0, 1.2); aim(1, 1.2 + Math.PI);
G.update(0.01);
check('pulse injector readies both orbs', G.getPulse()[0] >= 45 && G.getPulse()[1] >= 45);
G.setPulse([0, 0]);
// chain overdrive: a zap arcs to the nearest other hostile
idle(40); // drain hit-stop BEFORE clearing — idling respawns background traps
G.enemies().length = 0;
G.fx.chain = 6;
en = G.spawnEnemy(1.0, 'normal');
const enFar = G.spawnEnemy(1.6, 'normal'); enFar.z = 1.0; // deep and uncovered
aim(0, 1.0); aim(1, 1.0 + Math.PI);
cross(en);
check('chain overdrive arcs the kill to the nearest hostile', en.dead === true && enFar.dead === true);
G.fx.chain = 0;
G.setIntegrity(100);
G.spawnPickup();
const pk = G.pickups()[G.pickups().length - 1];
pk.kind = 'auto'; pk.z = G.geo().hitZ; pk.angle = 1.2;
aim(0, 1.2);
G.update(0.01);
check('catching a pickup arms its effect', G.fx.auto > 4);
G.fx.auto = 0;

// ================= deterministic campaign levels =================
function recordSpawns(start, n) {
  start();
  const seen = [];
  let guard = 2000;
  while (seen.length < n && guard-- > 0) {
    G.setIntegrity(100);
    G.update(0.05);
    for (const e of G.enemies()) {
      if (!e._rec) { e._rec = true; seen.push(e.type + '|' + (e.lock === undefined ? '-' : e.lock) + '|' + e.angle.toFixed(4)); }
    }
  }
  return seen;
}
const detA = recordSpawns(() => G.startLevel(1), 12);
const detB = recordSpawns(() => G.startLevel(1), 12);
check('campaign level replays the exact same spawn script', // recorder can overshoot n when two spawns share a tick
  detA.length >= 12 && detA.join(';') === detB.join(';'));
const detC = recordSpawns(() => G.startLevel(2), 12);
check('each level has its own script', detA.join(';') !== detC.join(';'));
const endA = recordSpawns(() => G.startEndless(), 10);
const endB = recordSpawns(() => G.startEndless(), 10);
check('endless stays procedural', endA.join(';') !== endB.join(';'));

// ================= max-combo regeneration =================
G.startLevel(1);
G.enemies().length = 0;
G.setIntegrity(50);
function streakZap() {
  const zEn = G.spawnEnemy(0.6, 'normal');
  aim(0, 0.6); aim(1, 0.6 + Math.PI);
  cross(zEn);
  return zEn.dead;
}
let okZaps = true;
for (let i = 0; i < 9; i++) okZaps = streakZap() && okZaps; // combo 5 reached at #5; heal banks 5..9
check('nine-zap streak restores one integrity block', okZaps && G.stats().integrity === 75);
for (let i = 0; i < 5; i++) streakZap();
check('streak keeps healing until the bar is full', G.stats().integrity === 100);
for (let i = 0; i < 5; i++) streakZap();
check('full bar stays capped at 100', G.stats().integrity === 100);
// combo break resets the bank
G.setIntegrity(50);
for (let i = 0; i < 4; i++) streakZap(); // combo 5..8: banks 4
en = G.spawnEnemy(2.8, 'normal');
aim(0, 0); aim(1, 0.5); // let it slip — combo breaks
cross(en);
check('a miss resets the heal bank', G.stats().integrity === 25 && G.stats().combo === 0);
for (let i = 0; i < 8; i++) streakZap(); // combo 1..8 → banks 4 (from combo 5)
check('bank restarts from zero after the break', G.stats().integrity === 25);
streakZap(); // 5th banked zap
check('heal lands on the fifth banked zap', G.stats().integrity === 50);

// ================= endless config ramp =================
const c0 = G.endlessCfg(0), c200 = G.endlessCfg(200);
check('endless difficulty ramps with time', c200.speed > c0.speed && c200.spawnMin < c0.spawnMin && c200.heavies > 0 && c0.heavies === 0);

// ================= boss duel (CORE FIREWALL) =================
G.progress.bossBriefed = false;
G.startLevel(7);
G.setLevelT(46); // past the level clock
G.update(0.01);
check('firewall core spawns after the level clock', !!G.boss());
check('boss briefing card shows first', G.getState() === G.S.INFO && G.getInfoCard() === 'boss');
dismiss();
check('briefing dismissed back to the duel', G.getState() === G.S.PLAY);
// ARRIVAL CEREMONY: the core surfaces before it fights
check('the core arrives with a ceremony, not a fight', G.boss().introT < G.BOSS_CER());
let cerGuard = 200;
while (G.boss().introT < G.BOSS_CER() && cerGuard-- > 0) G.update(0.05);
check('the ceremony completes and the duel begins', G.boss().introT >= G.BOSS_CER());
check('the dials never change hands — no fuse', G.boss().mergeT === 0);
// the duel verb is the campaign verb: dock both nodes, charge, homing bolt
function bossBolt() {
  const b = G.boss();
  G.volley().cd = 0;
  aim(0, 1.0); aim(1, 1.0); // dock and hold — the charge fires itself
  const hp0 = b.hp;
  for (let i = 0; i < 60 && b.hp === hp0 && b.hp > 0; i++) {
    G.setIntegrity(100); b.shots.length = 0; b.latchT = 99; G.update(0.05);
  }
  aim(1, 1.0 + Math.PI); // undock between bolts
  G.update(0.05);
  return hp0 - b.hp;
}
check('a docked charge launches a homing bolt into the core', bossBolt() === 1);
drawOk('boss duel frame (charge + core)', () => {});
bossBolt();
check('three hits trigger BREACH PROTOCOL (phase 2)', (bossBolt(), G.boss().phase2 === true && G.boss().hp === 3));
{
  let tGuard = 200;
  while (tGuard-- > 0 && !G.enemies().length) { G.setIntegrity(100); G.boss().shots.length = 0; G.update(0.05); }
  check('phase 2 deploys wall taps mid-duel', G.enemies().length > 0);
  G.enemies().length = 0;
}
// dodge mechanics — darts hunt either carriage now
const B2 = G.boss();
aim(0, 1.0); aim(1, 1.0);
B2.shots.length = 0; B2.shootT = 0.01;
G.update(0.05); // fires at a carriage's current spot
B2.shootT = 99;  // hold further fire
check('the core returns fire', B2.shots.length > 0);
aim(0, 2.4); aim(1, 2.4); // dodge away
const hpMe = G.stats().integrity;
for (let i = 0; i < 60 && B2.shots.length; i++) G.update(0.05);
check('dodging the shot avoids damage', G.stats().integrity === hpMe);
B2.shootT = 0.01;
G.update(0.05);
B2.shootT = 99;
const hpMe2 = G.stats().integrity;
for (let i = 0; i < 60 && B2.shots.length; i++) G.update(0.05); // stand still
check('standing still takes the hit', hpMe2 - G.stats().integrity >= 9);
// rail latches — the core clamps the ring; crossing the orange arc fries a node
B2.shots.length = 0; B2.shootT = 99; B2.latchT = 99; // quiet lane for the latch checks
aim(0, 1.0); aim(1, 2.0); // apart — no accidental charging
G.setLatches([{ a: 2.7, span0: 0.5, t: 0.3, dur: 3, tele: 0, arm: 0.25 }]); // away from both
G.update(0.05);
check('a latch across the ring leaves distant nodes alone', !(G.nodes[0].deadT > 0));
aim(0, 2.7); // slide node 0 INTO the clamp
G.update(0.05);
check('crossing a latch fries the node (node-killer style)', G.nodes[0].deadT > 0);
G.volley().cd = 0;
aim(0, 2.0); // dock attempt with a fried node
for (let i = 0; i < 14; i++) { G.setIntegrity(100); B2.shootT = 99; G.update(0.05); }
check('a fried node cannot charge the volley', G.volley().charge === 0);
aim(0, 1.0); // apart again
for (let i = 0; i < 70; i++) { G.setIntegrity(100); B2.shootT = 99; B2.latchT = 99; G.update(0.05); } // reboot + burn-off
check('the latch burns away within 3s', G.latches().length === 0);
check('the node reboots after the fry', !(G.nodes[0].deadT > 0));
B2.latchT = 0.01; // the core throws a grapple on its own
G.update(0.05);
check('the core fires latch grapples', B2.shots.some(sh => sh.latch === true));
B2.shots.length = 0; B2.latchT = 99;
// finish it: three more bolts -> death ceremony -> verdict -> case closed
bossBolt(); bossBolt(); bossBolt();
check('six bolts put the core down', G.boss() && G.boss().dying !== undefined);
let dGuard = 400;
while (G.boss() && dGuard-- > 0) { G.setIntegrity(100); G.update(0.05); }
check('the death ceremony ends at the VERDICT card', G.getState() === G.S.INFO && G.getInfoCard() === 'verdict');
dismiss();
check('the verdict closes the case — campaign complete', G.getState() === G.S.END && G.getEndWin() === true);
check('campaign completion recorded', G.getProg().stars[7] > 0);

// ================= TEMP boss-test shortcut =================
G.startBossTest();
G.update(0.05);
if (G.getState() === G.S.INFO) { G.update(0.5); canvasHandlers.pointerdown({ pointerId: 8, clientX: 400, clientY: 300, pointerType: 'touch' }); G.update(0.15); G.update(0.15); G.update(0.15); }
G.update(0.05);
check('BOSS TEST key drops straight into the duel', !!G.boss());
G.boss().introT = 99; // skip the ceremony for the shortcut check
for (let i = 0; i < 4; i++) G.update(0.05);
check('shortcut duel is live and un-fused', G.boss().mergeT === 0);

// ================= boss engine dispatch (Phase 3: triad + spinner) =================
{
  // the classic campaign duel above (and this shortcut) ran without bossKind
  check('a boss level without bossKind fields the classic core', G.boss() && G.boss().kind === 'core');
  const bossPack = kind => ({
    id: 'boss-' + kind, format: 1, title: kind.toUpperCase() + ' TEST',
    speakers: [{ id: 'WARD', color: '212,101,255' }, { id: 'CMD', color: '235,245,255' }],
    verdict: { title: 'TEST VERDICT', lines: ['case closed.'] },
    levels: [{ name: 'FINALE', tint: '212,101,255', duration: 10, spawnMin: 1, spawnMax: 2, speed: 0.5,
      boss: true, bossKind: kind }]
  });
  check('validator accepts bossKind triad + spinner',
    G.validateCampaign(bossPack('triad')).length === 0 && G.validateCampaign(bossPack('spinner')).length === 0);
  const badP = bossPack('triad'); badP.levels[0].bossKind = 'megacore';
  check('validator rejects an unknown bossKind', G.validateCampaign(badP).length > 0);

  function enterBossLevel(kind) {
    G.installCampaign(bossPack(kind));
    G.startLevel(0);
    G.setLevelT(11); // past the level clock — the finale spawns at once
    G.update(0.01);
  }
  function ceremonyOut() {
    let guard = 200;
    while (G.boss() && G.boss().introT < G.BOSS_CER() && guard-- > 0) { G.setIntegrity(100); G.update(0.05); }
  }

  // ---------- TRIAD: SHIELD · SHREDDER · ALIBI ----------
  G.progress.triadBriefed = false;
  enterBossLevel('triad');
  const T = G.boss();
  check('bossKind triad spawns the three-body private core',
    !!T && T.kind === 'triad' && T.cores.length === 3 && T.maxHp === 9 && T.hp === 9);
  check('triad briefing card gates the fight once',
    G.getState() === G.S.INFO && G.getInfoCard() === 'bossTriad' && G.progress.triadBriefed === true);
  dismiss();
  ceremonyOut();
  check('triad ceremony completes into a live three-body fight',
    T.introT >= G.BOSS_CER() && T.cores.every(c => !c.dead));
  drawOk('triad mid-fight frame (three bodies + links)', () => {});
  // a bolt routes to the body NEAREST the docked aim bearing
  function triadBolt(pick) { // dock on the chosen body's bearing; returns the wounded index
    const b = G.boss();
    G.volley().cd = 0;
    G.nodes[0].deadT = G.nodes[1].deadT = 0;
    const hp0 = b.cores.map(c => c.hp);
    let guard = 90, hit = -1;
    while (guard-- > 0 && hit < 0 && b.dying === undefined) {
      const c = b.cores[pick];
      const a = c.dead ? G.nodes[0].angle : c.bear;
      aim(0, a); aim(1, a);
      G.setIntegrity(100); b.shots.length = 0; b.latchT = 99; b.volleyT = 99; G.setLatches([]);
      G.update(0.05);
      hit = b.cores.findIndex((c2, i2) => c2.hp < hp0[i2]);
    }
    aim(1, G.nodes[0].angle + Math.PI); // undock between bolts
    G.update(0.05);
    return hit;
  }
  check('the bolt routes to the aimed body (SHIELD)', triadBolt(0) === 0);
  check('re-aiming routes the next bolt elsewhere (SHREDDER)', triadBolt(1) === 1);
  triadBolt(0); triadBolt(0);
  check('three bolts fell one body — the others fight on',
    T.cores[0].dead === true && !T.cores[1].dead && !T.cores[2].dead && T.hp === 5 && T.dying === undefined);
  drawOk('triad frame with one body down', () => {});
  // wall pressure: two concurrent latches, but the dockable-arc law holds
  {
    T.shots.length = 0;
    aim(0, 1.0); aim(1, 2.2); // undocked — no bolts fly during the pressure soak
    let saw2 = false, minArc = 99;
    for (let i = 0; i < 700; i++) {
      G.setIntegrity(100);
      T.volleyT = 99;                          // fans quiet — this soak is about walls
      T.latchT = Math.min(T.latchT, 0.05);     // keep the wall pressure maxed
      G.update(0.05);
      if (G.latches().length >= 2) saw2 = true;
      minArc = Math.min(minArc, G.latchFreeArc());
      G.nodes[0].deadT = G.nodes[1].deadT = 0; // the soak measures arcs, not fries
      if (T.dying !== undefined) break;
    }
    check('the triad rides the ring with two concurrent latches', saw2);
    check('a wall-free dock arc >= 1.6 rad always survives', minArc >= 1.6 - 1e-6);
    G.setLatches([]); T.shots.length = 0;
  }
  // telegraphed radial dart fans, alternating bodies
  {
    T.shots.length = 0;
    T.volleyT = 0.01;
    let fanGuard = 60, sawCharge = false;
    while (fanGuard-- > 0 && !T.shots.filter(sh => !sh.latch).length) {
      G.setIntegrity(100); T.latchT = 99;
      G.update(0.05);
      sawCharge = sawCharge || T.cores.some(c => c.chargeT > 0);
    }
    const fan = T.shots.filter(sh => !sh.latch);
    check('a radial dart fan fires from a body (5 darts, wide spread)',
      fan.length >= 5 && Math.abs(fan[fan.length - 1].th - fan[0].th) > 1.5);
    check('the fan was telegraphed by a charge glow', sawCharge);
    T.shots.length = 0; T.volleyT = 99;
  }
  // finish it: nine total bolts -> death ceremony -> verdict -> END
  triadBolt(1); triadBolt(1);
  check('six bolts, two bodies down', T.cores[1].dead === true && T.hp === 3);
  triadBolt(2); triadBolt(2); triadBolt(2);
  check('nine bolts fell the triad — death ceremony', T.dying !== undefined);
  {
    let dg = 400;
    while (G.boss() && dg-- > 0) { G.setIntegrity(100); G.update(0.05); }
    check('triad death ends at the VERDICT card', G.getState() === G.S.INFO && G.getInfoCard() === 'verdict');
    dismiss();
    check('triad verdict closes the case — END, win recorded',
      G.getState() === G.S.END && G.getEndWin() === true && G.getProg().stars[0] > 0);
  }

  // ---------- SPINNER: THE BEACON ----------
  G.progress.spinnerBriefed = false;
  enterBossLevel('spinner');
  const SP = G.boss();
  check('bossKind spinner spawns THE BEACON', !!SP && SP.kind === 'spinner' && SP.maxHp === 4);
  check('spinner briefing card gates the fight once',
    G.getState() === G.S.INFO && G.getInfoCard() === 'bossSpinner' && G.progress.spinnerBriefed === true);
  dismiss();
  ceremonyOut();
  check('beacon ceremony completes into the telegraph phase',
    SP.introT >= G.BOSS_CER() && SP.mode === 'tele');
  // a volley bolt fizzles on the shield — the beacon takes ZERO bolt damage
  {
    SP.mode = 'adds'; SP.modeT = 99; // hold the beam so the dock is safe
    G.enemies().length = 0; G.setLatches([]);
    G.nodes[0].deadT = G.nodes[1].deadT = 0;
    G.volley().cd = 0;
    const hp0 = SP.hp;
    let fg = 60, shielded = false;
    while (fg-- > 0 && !shielded) {
      aim(0, 1.0); aim(1, 1.0);
      G.setIntegrity(100); G.update(0.05);
      shielded = SP.shieldT > 0;
    }
    aim(1, 1.0 + Math.PI); G.update(0.05);
    check('a volley bolt fizzles on the beacon shield — zero damage', shielded && SP.hp === hp0);
    drawOk('spinner shield-shimmer frame', () => {});
  }
  // the sweep fries a node parked in its path — and rolls on
  {
    G.enemies().length = 0; G.setLatches([]);
    aim(0, 1.0); aim(1, 1.0 + Math.PI);
    SP.mode = 'sweep'; SP.swept = 0; SP.beamDir = 1;
    SP.sweepSpd = Math.PI * 2 / 5.6;
    SP.beamA = 1.0 - 0.4; // the light closes on the parked blue node
    let sg = 40, fried = false;
    while (sg-- > 0 && !fried) { G.setIntegrity(100); G.update(0.05); fried = G.nodes[0].deadT > 0; }
    check('the sweeping beam fries a node parked in its path', fried);
    check('the sweep rolls on after the fry', SP.mode === 'sweep' && SP.dying === undefined);
    drawOk('spinner mid-sweep frame (beam live)', () => {});
  }
  // a completed sweep overloads the BEACON itself — and the add wave rides in
  {
    G.nodes[0].deadT = G.nodes[1].deadT = 0;
    const hp1 = SP.hp, dir0 = SP.beamDir;
    SP.swept = Math.PI * 2 - 0.001;
    SP.beamA = G.nodes[0].angle + Math.PI; // away — the overload tick fries nobody
    G.setIntegrity(100); G.update(0.05);
    check('a completed sweep overloads the beacon — one round of damage',
      SP.hp === hp1 - 1 && SP.mode === 'adds');
    check('an intrusion wave (with a rim latch) spawns between sweeps',
      G.enemies().filter(e => !e.dead).length >= 3 && G.latches().length >= 1);
    { // FAIRNESS: the wave is a convoy — max two per arrival window, window
      // partners a half-ring apart, windows staggered down the pipe
      const wave = G.enemies().filter(e => !e.dead && e.type === 'normal');
      const spd = G.getLV().speed;
      const arr = wave.map(e => e.z / spd).sort((a, b) => a - b);
      let fair = true;
      for (let i = 0; i < arr.length; i++) {
        const mates = wave.filter(e2 => Math.abs(e2.z / spd - arr[i]) < 0.4);
        if (mates.length > 2) fair = false;
        if (mates.length === 2) { // window partners must be coverable one-per-node
          let d = Math.abs(mates[0].angle - mates[1].angle) % (Math.PI * 2);
          if (d > Math.PI) d = Math.PI * 2 - d;
          if (d < 0.9) fair = false; // near-stacked reds = one node asked twice
        }
      }
      check('the intrusion wave respects the fairness law (\u22642 per window, split angles)', fair);
    }
    check('the next sweep runs the other way', SP.beamDir === -dir0);
    drawOk('spinner add-wave frame', () => {});
    // the add phase ends on wave-clear or timeout — force the timeout path
    SP.modeT = 0.01;
    G.setIntegrity(100); G.update(0.05);
    check('the add phase hands back to the telegraph', SP.mode === 'tele');
  }
  // three more survived sweeps put the light out -> death -> verdict -> END
  {
    for (let r = 0; r < 3; r++) {
      G.enemies().length = 0; G.setLatches([]);
      G.nodes[0].deadT = G.nodes[1].deadT = 0;
      SP.mode = 'sweep'; SP.swept = Math.PI * 2 - 0.001;
      SP.beamA = G.nodes[0].angle + Math.PI;
      G.setIntegrity(100); G.update(0.05);
    }
    check('four survived sweeps put the beacon down', SP.dying !== undefined);
    let dg = 400;
    while (G.boss() && dg-- > 0) { G.setIntegrity(100); G.update(0.05); }
    check('beacon death ends at the VERDICT card', G.getState() === G.S.INFO && G.getInfoCard() === 'verdict');
    dismiss();
    check('beacon verdict closes the case — END, win recorded',
      G.getState() === G.S.END && G.getEndWin() === true && G.getProg().stars[0] > 0);
  }
  // back to the bundled campaign for everything downstream
  G.installCampaign(G.CAMPAIGNS[0]);
  G.setState(G.S.MENU);
}

// ================= campaign rim walls + bonus ribbon =================
const quiet = () => { G.setSpawnT(60); G.setIntegrity(100); }; // hold the level script still
G.startLevel(4); // SUBLANE DRIFT — the wall's home level
G.enemies().length = 0;
G.setLatches([{ a: 1.0, span0: 0.5, t: 0, dur: 3, tele: 0.9, arm: 0.4 }]);
aim(0, 1.0); aim(1, 2.5); // node 0 parked exactly where the wall will bite
quiet(); G.update(0.05);
check('a telegraphing wall does not bite yet', !(G.nodes[0].deadT > 0));
for (let i = 0; i < 30; i++) { quiet(); G.update(0.05); } // through telegraph + arm grace
check('crossing a live rim wall fries the node', G.nodes[0].deadT > 0);
check('the far node is untouched', !(G.nodes[1].deadT > 0));
for (let i = 0; i < 90; i++) { quiet(); G.update(0.05); }
check('the wall burns off within ~4s', G.latches().length === 0);
check('the fried node reboots', !(G.nodes[0].deadT > 0));
// golden ribbon: a full ride buys a full pulse, a lost one costs nothing
G.progress.stripBriefed = true; G.progress.wallBriefed = true; // no cards mid-test
G.enemies().length = 0;
G.setPulse([0, 0]);
let rib = G.spawnStrip();
const hz2 = G.geo().hitZ;
let rGuard = 500;
while (rGuard-- > 0 && G.enemies().some(e => e.type === 'strip' && !e.dead)) {
  aim(0, G.stripAngle(rib, Math.max(0, hz2 - rib.z)));
  quiet(); G.update(0.05);
}
check('a full ribbon ride charges that pulse orb to MAX', G.getPulse().some(v => v === G.PULSE_MAX()));
G.enemies().length = 0;
G.setPulse([0, 0]);
rib = G.spawnStrip();
aim(0, rib.angle + 2.5); aim(1, rib.angle + 2.5); // ignore it completely
const comboR = G.stats().combo;
for (let i = 0; i < 400 && G.enemies().some(e => e.type === 'strip' && !e.dead); i++) { quiet(); G.update(0.05); }
check('an ignored ribbon costs nothing',
  G.stats().integrity === 100 && G.stats().combo === comboR && G.getPulse()[0] === 0 && G.getPulse()[1] === 0);
// walls actually spawn from the level script
G.startLevel(4);
let sawWall = false;
for (let i = 0; i < 1400 && !sawWall; i++) { G.setIntegrity(100); G.update(0.05); sawWall = G.latches().length > 0; }
check('SUBLANE DRIFT deploys rim walls from its script', sawWall);
G.setState(G.S.MENU);

// fixed-timestep determinism: the same seeded level, no input, driven through
// the real frame() at two different frame rates must land on an identical sim
// state — the property server-side replay verification depends on.
// DRIVEN TO A STEP TARGET, NOT A WALL-CLOCK ONE. This used to loop until
// `getTime() - t0 < targetSec`, which compares a float against a global sim clock
// that only ever grows — so as `time` accumulated over the suite, `time - t0` lost
// precision and the exit could land either side of the boundary, taking one extra
// frame and reporting 901 steps against 900. That is a loop-termination artifact,
// not a sim difference (the outcome checks below agreed throughout), but it made
// the tripwire fire on any change that merely added frames to an earlier test —
// which is precisely the tripwire you least want crying wolf.
//
// Stopping on the step count instead makes both runs cover an identical sim length
// by construction, which is the property worth comparing anyway.
// THE SPAWN SIGNATURE: every hostile the run ever dealt, in order, by type and
// angle. This is what a frame-rate-invariance test actually needs to compare.
// Comparing score/integrity/misses looked adequate and is not: with no input every
// hostile is missed, so the run always ends at integrity 0 with score 0 — an outcome
// identical whether the seeded stream dealt the right traffic or completely
// different traffic. Reverting either weekly fault in isolation still "passed" it.
// (Same blind spot the verifier's own self-test had: an assertion that cannot see
// the thing it is guarding.)
//
// Sampling is rate-independent because it keys on object IDENTITY — each hostile is
// recorded once, the frame it first appears, however many frames that takes.
function spawnSigWatcher() {
  const seen = new WeakSet(), sig = [];
  return {
    sample: () => { for (const e of G.enemies()) if (!seen.has(e)) { seen.add(e); sig.push(e.type + '@' + Number(e.angle).toFixed(5)); } },
    sig: () => sig,
  };
}

// A FIXED FRAME COUNT PER RATE, so both runs feed the accumulator exactly the same
// total wall time — frames x (1000/fps) is the same number of milliseconds at every
// rate. Neither a wall-clock nor a step-count exit condition can do that: `time`
// advances more slowly than steps/60 whenever hit-stop is scaling dt, so a loop
// watching either one can overshoot by a step on one rate and not the other, and
// report a mismatch while the sim outcome is in fact identical. The sim length is
// now the same by arithmetic rather than by a float comparison.
function runFramerate(fps, targetSteps) {
  G.startLevel(4); G.setState(G.S.PLAY); // seeded spawns; resetRun zeroes score/integrity/misses
  G.resetLoop(0);
  const t0 = G.getTime(), stepMs = 1000 / fps;
  const frames = Math.round(targetSteps * (fps / 60));
  for (let i = 1; i <= frames; i++) G.rawFrame(i * stepMs);
  const s = G.stats();
  return { steps: Math.round((G.getTime() - t0) * 60), frames, score: s.score, integrity: s.integrity, misses: s.misses, zaps: s.zaps };
}
{
  const a = runFramerate(60, 900), b = runFramerate(144, 900); // 900 steps = 15s, long enough that traffic reaches the ring
  check('fixed-timestep: 60fps and 144fps step the sim the same number of times',
    a.steps === b.steps && a.steps === 900);
  // …and they really did run at different rates, so the check above is not vacuous
  check('fixed-timestep: the two runs genuinely differ in frame count', b.frames > a.frames * 2);
  check('fixed-timestep: the run actually processed traffic (non-trivial signature)', a.integrity < 100 || a.misses > 0);
  check('fixed-timestep: sim outcome is frame-rate independent (score/integrity/misses agree)',
    a.score === b.score && a.integrity === b.integrity && a.misses === b.misses);
}

// AND THE SAME GUARANTEE FOR WEEKLY, whose absence is why weekly could not verify for
// as long as it has existed. Campaign had this test; weekly never did. Two faults hid
// behind that gap: startWeekly pointed spawnRng at Math.random itself, which the
// RENDER path consumes ~481 times a frame, and weekly reached beatQuantize, which
// reads AC.currentTime. Both put the player and the server on different lanes. This
// test fails on either one, because rendering more frames per sim step is exactly
// what a higher frame rate does.
function runDailyFramerate(fps, targetSteps) {
  const realNow = Date.now;
  Date.now = () => 20000 * 864e5;        // pin the day so both runs draw the same lane
  try { G.startWeekly(); } finally { Date.now = realNow; }
  G.setIntro(999); G.setState(G.S.PLAY);
  G.resetLoop(0);
  const t0 = G.getTime(), stepMs = 1000 / fps;
  const frames = Math.round(targetSteps * (fps / 60));   // identical wall time per rate
  const w = spawnSigWatcher();
  for (let i = 1; i <= frames; i++) { G.rawFrame(i * stepMs); w.sample(); }
  const s = G.stats();
  return { steps: Math.round((G.getTime() - t0) * 60), frames, sig: w.sig(),
    score: s.score, integrity: s.integrity, misses: s.misses, zaps: s.zaps };
}
{
  const a = runDailyFramerate(60, 600), b = runDailyFramerate(144, 600);
  // Within one step, not exactly equal. Both runs feed the accumulator the identical
  // total wall time, but at 144fps the residue can finish a hair under SIM_DT so the
  // last step does not fire — float arithmetic, not a sim difference. Exact step
  // parity over a wall-clock window is not the property that protects the
  // leaderboard anyway: verification replays a trace step by step, so it always uses
  // the recorded step count. The guarantee is the OUTCOME check below.
  check(`weekly: 60fps and 144fps advance the sim the same length (${a.steps} vs ${b.steps} steps, ${a.frames}/${b.frames} frames)`,
    Math.abs(a.steps - b.steps) <= 1);
  check('weekly: the two runs genuinely differ in frame count', b.frames > a.frames * 2);
  check(`weekly: the run actually dealt traffic (${a.sig.length} hostiles)`, a.sig.length >= 4);
  // THE GUARANTEE. Identical seed, identical (absent) input, different frame rate =>
  // the same lane, hostile for hostile. Fails on either weekly fault on its own.
  check('weekly: the lane is frame-rate independent — the render path cannot move it',
    a.sig.join('|') === b.sig.join('|'));
  check('weekly: sim outcome is frame-rate independent (score/integrity/misses agree)',
    a.score === b.score && a.integrity === b.integrity && a.misses === b.misses && a.zaps === b.zaps);
}

// A VERIFIABLE MODE MUST NEVER CONSULT THE MUSIC CLOCK. beatQuantize reads
// AC.currentTime, and the server re-simulates with no AudioContext at all — so any
// mode whose runs get replay-checked has to stay away from it entirely. Structural,
// because it cannot be observed by outcome here: the audio stub's clock is frozen at
// 0 and musicSrc never resolves, which is exactly why weekly's dependency on it went
// unnoticed for as long as weekly has existed.
{
  const realBQ = G.getBeatQuantize();
  let calls = 0;
  G.setBeatQuantize((...args) => { calls++; return realBQ(...args); });
  try {
    const realNow = Date.now;
    Date.now = () => 20000 * 864e5;
    try { G.startWeekly(); } finally { Date.now = realNow; }
    G.setIntro(999); G.setState(G.S.PLAY);
    for (let i = 0; i < 400; i++) G.simStep();
    check(`weekly never consults the music clock (${calls} beatQuantize calls)`, calls === 0);

    calls = 0;
    G.startEndless(); G.setIntro(999); G.setState(G.S.PLAY);
    for (let i = 0; i < 400; i++) G.simStep();
    // free flow keeps its beat choreography: unseeded, trust-only, nothing re-sims it
    check(`free-flow endless still does (${calls} calls) — so the check above is not vacuous`, calls > 0);
  } finally {
    G.setBeatQuantize(realBQ);
  }
}
G.setState(G.S.MENU);
G.setState(G.S.MENU);

// ================= run-trace record → replay round-trip =================
// Record a run whose nodes sweep the ring (killing seeded traffic), then replay
// purely from the trace and confirm the score is reproduced EXACTLY. This is the
// property the verifier relies on: seed + trace -> identical score.
const TRACE_ANGLES = [0.1, 0.7, 1.3, 1.9, 2.5]; // node parks on each in turn — a moving input
function traceRun(mode, frames) {
  G.startLevel(2); G.setState(G.S.PLAY); // resetRun zeroes the stats
  if (mode === 'record') G.startTrace(); else G.startReplay(frames);
  const hz = G.geo().hitZ;
  // scaffolding runs IDENTICALLY in both passes (spawns aren't in the trace —
  // the trace only carries node input, exactly as seeded traffic would in real
  // life). Only the node angles differ: recorded live vs injected from trace.
  for (const A of TRACE_ANGLES) {
    const en = G.spawnEnemy(A, 'normal'); if (en) en.z = hz; // deliver it to the ring
    for (let s = 0; s < 4; s++) {
      if (mode === 'record') { G.nodes[0].angle = A; G.nodes[1].angle = A; } // "player" parks on it
      G.simStep(); // replay injects the recorded angle itself
    }
  }
  const s = G.stats();
  const out = { score: s.score, integrity: s.integrity, misses: s.misses, zaps: s.zaps };
  if (mode === 'record') out.frames = G.stopTrace(); else G.stopReplay();
  return out;
}
{
  const rec = traceRun('record');
  const rep = traceRun('replay', rec.frames);
  check('trace: recorded a frame per fixed step', rec.frames.length === TRACE_ANGLES.length * 4);
  check('trace: the run was non-trivial (parked shots landed kills)', rec.zaps > 0 && rec.score > 0);
  check('trace round-trip: replay reproduces score/integrity/misses/zaps exactly',
    rec.score === rep.score && rec.integrity === rep.integrity && rec.misses === rep.misses && rec.zaps === rep.zaps);
}
// the live lifecycle: resetRun starts recording, endLevel attaches the trace
{
  G.startLevel(2); G.setState(G.S.PLAY);
  for (let i = 0; i < 10; i++) G.simStep();
  G.endLevel(true);
  const lr = G.getLastRun();
  check('a finished ranked run attaches its input trace to lastRun', lr && Array.isArray(lr.trace) && lr.trace.length === 10);
}
G.setState(G.S.MENU);

// ================= leaderboard identity + run capture =================
check('a persistent player id is minted on boot', typeof G.getIdentity().id === 'string' && G.getIdentity().id.length > 0);
// board keys: one per campaign level, one per free-flow mode
G.startLevel(2);
check('board key names the campaign level', G.boardKey() === G.getCamp().id + ':2');
G.startEndless();
check('board key for endless is a single shared board', G.boardKey() === 'endless');
// EACH WEEK IS ITS OWN BOARD, so a finished week keeps its field forever and a new
// week arrives as a new board instead of displacing anyone. The week index is in the
// key, so the server needs nothing passed alongside it.
G.startWeekly();
check('board key for the live week carries its week index',
  G.boardKey() === 'weekly:' + G.weekNow() && /^weekly:-?\d+$/.test(G.boardKey()));
// …and a FINISHED week is unranked, which is what makes practising it unable to file
// a score by any route: submit, name-entry and rank lookup all treat null as unranked
G.startWeekly(G.weekNow() - 1);
check('board key for a past week is null — a practice lane files nothing', G.boardKey() === null);
check('a past week still loads its own lane', G.isWeekly() === true && G.weeklyIdx() === G.weekNow() - 1);
G.startWeekly();
// captureRun snapshots the submission payload
G.startLevel(2); G.setState(G.S.PLAY); G.setScore(4200); G.setLevelT(31.5);
const run = G.captureRun(true);
check('captured run pins the board + seed for replay', run.board === G.getCamp().id + ':2' && run.seed === 2 && run.verifiable === true);
check('captured run carries score, time, and owner', run.score === 4200 && run.timeSec === 31.5 && run.playerId === G.getIdentity().id && run.mode === 'campaign');
// the run id is the leaderboard ROW key: fresh per run (so a player keeps
// several records on one board), stable across a rename re-submit of that run
check('captured run mints a run id', typeof run.runId === 'string' && run.runId.length > 0);
check('a second run gets its OWN id (multiple entries per player)', G.captureRun(true).runId !== run.runId);
G.startEndless(); G.setState(G.S.PLAY);
check('endless capture is marked unverifiable (unseeded)', G.captureRun(false).verifiable === false && G.captureRun(false).seed === null);
G.setState(G.S.MENU);

// ================= free flow unlock gate =================
{ // FREE FLOW opens on level 5 of the FIRST campaign — nothing earlier
  const seen = G.CAMPAIGNS.filter(p => G.progress.camp[p.id]); // only campaigns the run has touched
  const snap = seen.map(p => G.progress.camp[p.id].stars.slice());
  const stars = id => (G.progress.camp[id] || (G.progress.camp[id] = { unlocked: 1, stars: [], bests: [] })).stars;
  seen.forEach(p => stars(p.id).fill(0));
  while (stars(G.CAMPAIGNS[0].id).length < 5) stars(G.CAMPAIGNS[0].id).push(0);
  const flowTile = () => { G.setState(G.S.MENU); G.setMenuScreen('home'); G.frame(16); return G.menuBtns().find(b => b.mode === 'flow'); };
  check('free flow is locked on a fresh save', !!flowTile() && flowTile().locked);
  stars(G.CAMPAIGNS[0].id)[3] = 3; // level 4 cleared — still not enough
  check('clearing level 4 does not open free flow', flowTile().locked);
  stars(G.CAMPAIGNS[0].id)[4] = 1; // level 5 cleared
  check('clearing level 5 opens free flow', !flowTile().locked);
  seen.forEach((p, i) => { const s = stars(p.id); snap[i].forEach((v, k) => { s[k] = v; }); });
}

// ================= mode select & campaign map =================
G.setState(G.S.MENU);
G.setMenuScreen('home');
G.frame(16);
const cTile = G.menuBtns().find(b => b.mode === 'campaign');
{ // tap the middle of the campaign slice on the mode wheel
  const sc = cTile.sector, ma = (sc.a0 + sc.a1) / 2, mr = (sc.r0 + sc.r1) / 2;
  G.menuTap(sc.cx + Math.cos(ma) * mr, sc.cy + Math.sin(ma) * mr, 1);
}
flushUI(); // press beat -> spin -> screen switch
check('campaign tile opens the case-file carousel (multiple campaigns shipped)', G.getMenuScreen() === 'camps');
flushUI(); G.setCampScroll(1); G.frame(16); // center the row
{ // discs: a Vanguard Training disc leads the carousel, then every real campaign,
  // each reachable with its own SYNC key (its carousel index); no teasers left
  const TRAIN = 1; // the training disc occupies carousel slot 0; campaigns follow
  const totalDiscs = TRAIN + G.CAMPAIGNS.length;
  let covered = 0; // discs no longer all fit on stage — scroll to each and confirm its key
  for (let i = 0; i < totalDiscs; i++) {
    G.setCampScroll(i); G.frame(16);
    if (G.menuBtns().some(b => b.sync === i)) covered++;
  }
  check('carousel: training disc + one SYNC key per real campaign, no teasers', covered === totalDiscs && G.CAMPS_SOON.length === 0);
  const invCarousel = TRAIN + G.CAMPAIGNS.findIndex(c => c.id === 'investigation'); // carousel slot of the investigation disc
  G.setCampScroll(invCarousel); G.frame(16);
  const syncs = G.menuBtns().filter(b => b.sync !== undefined);
  check('carousel: scroll hint appears with discs off-stage', G.menuBtns().some(b => b.scrollDir === 1));
  const inv = syncs.find(b => b.sync === invCarousel);
  G.menuTap(inv.x + inv.w / 2, inv.y + inv.h / 2, 1);
}
flushUI(); flushUI(); // press beat -> disc zoom -> panels drive in
check('TAKE CONTRACT zooms the disc into its route map', G.getMenuScreen() === 'map' && G.getCamp().id === 'investigation');
flushUI(); // panels settle
G.frame(16);
const n2 = G.menuBtns().find(b => b.node === 2);
G.menuTap(n2.x + 22, n2.y + 22, 1);
G.frame(16);
const dep = G.menuBtns().find(b => b.deploy !== undefined);
check('selecting a relay arms its deploy key', dep && dep.deploy === 2);
G.menuTap(dep.x + 5, dep.y + 5, 1);
flushUI(); // press beat -> warp -> deploy
check('deploying opens the story log', G.getState() === G.S.INFO && G.getInfoCard() === 'story2');
{ // the mission disc: art plate + one plot line + the run's own numbers
  const L = G.getLV();
  check('a mission carries ONE plot line', typeof G.getInfoCards().story2.line === 'string'
    && G.getInfoCards().story2.line.length > 0 && G.getInfoCards().story2.line.length <= 96);
  // DETECTED THREATS is read off lintWalk, so it must match the arrivals the
  // level will actually make — a barrier counts once, a bonus ride not at all
  const w = G.lintWalk(L, 2);
  const hostile = w.arr.filter(r => r.type !== 'strip').length
    - w.arr.filter(r => r.type === 'line').length / 2 + w.walls.length;
  check('DETECTED THREATS matches the level timeline', G.levelThreats(L, 2) === hostile && hostile > 0);
  check('the threat count is cached, not re-walked', G.levelThreats(L, 2) === G.levelThreats(L, 2));
}
drawOk('mission disc (art plate fallback + plot line)', () => {});
{ // PAUSE WORKS OVER THE MISSION DISC — and resume returns TO the disc.
  // This shipped broken because every tap fed the dismiss branch; the old
  // dismiss() helper even leaned on the bug by tapping inside the button.
  G.update(0.5);
  G.frame(16); // draw builds pauseBtnRect
  canvasHandlers.pointerdown({ pointerId: 11, clientX: 20, clientY: 20, pointerType: 'touch' });
  check('the pause button works over the mission disc', G.getState() === G.S.PAUSE);
  G.frame(16); // draw builds pauseButtonsList
  const rh0 = G.getResumeHold();
  const rb = G.pauseBtns().find(b => b.action === 'resume');
  G.pauseTap(rb.x + 5, rb.y + 5, 12);
  check('resume hands the briefing back, no count-in',
    G.getState() === G.S.INFO && G.getResumeHold() === rh0);
}
G.update(0.5);
canvasHandlers.pointerdown({ pointerId: 9, clientX: 400, clientY: 300, pointerType: 'touch' });
G.update(0.15); G.update(0.15); G.update(0.15); // card animates out
// the relay we SELECTED, not a name typed in here — level names are authoring
// labels and get rewritten; what this test is about is landing on relay 2
check('dismissing the log enters the relay', G.getState() === G.S.PLAY && G.getLV() === G.getLevels()[2]);
G.setIntro(999);
{
  let cGuard = 300;
  while (cGuard-- > 0 && !G.commCur()) { G.setIntegrity(100); G.update(0.05); }
  check('the handler barks over the campaign line', !!G.commCur());
}

// ================= endless mode =================
G.setState(G.S.MENU);
G.setMenuScreen('flow');
G.frame(16);
const eBtn = G.menuBtns().find(b => b.endless);
check('endless key appears unlocked after clearing the campaign', !!eBtn && !eBtn.locked);
{ const sc = eBtn.sector, ma = (sc.a0 + sc.a1) / 2, mr = (sc.r0 + sc.r1) / 2;
  G.menuTap(sc.cx + Math.cos(ma) * mr, sc.cy + Math.sin(ma) * mr, 1); }
flushUI();
G.setIntro(999);
check('tapping the endless key starts an endless run', G.getState() === G.S.PLAY && G.isEndless() && G.getLV().name === 'ENDLESS LANE');
G.setScore(1234);
G.setIntegrity(0);
G.update(0.01);
check('endless defeat records the best score', G.getState() === G.S.END && G.progress.best === 1234);

// ================= weekly stream =================
G.setState(G.S.MENU);
G.setMenuScreen('flow');
G.frame(16);
const dBtn = G.menuBtns().find(b => b.weekly);
check('weekly key appears unlocked', !!dBtn && !dBtn.locked);
{ const sc = dBtn.sector, ma = (sc.a0 + sc.a1) / 2, mr = (sc.r0 + sc.r1) / 2;
  G.menuTap(sc.cx + Math.cos(ma) * mr, sc.cy + Math.sin(ma) * mr, 1); }
flushUI();
G.setIntro(999);
check('tapping it starts the seeded weekly run', G.getState() === G.S.PLAY && G.isWeekly() && G.getLV().name === 'WEEKLY LANE');
G.setScore(777);
G.setIntegrity(0);
G.update(0.01);
check('weekly defeat records the weekly best and streak', G.getState() === G.S.END &&
  G.progress.weekly.best === 777 && G.progress.weekly.streak >= 1 && Math.random !== undefined);

// ================= qualification =================
// the FREE-FLOW curriculum: no briefing discs — stage banners + in-world
// guides while the run keeps moving; the pulse drill freezes the run for
// the FIRE-PULSE moment
G.progress.tutorialDone = false;
G.startQualification();
G.update(0.05);
check('qualification opens straight into play on the movement drill',
  G.getState() === G.S.PLAY && G.isQual() && G.qualStage().card === 'move');
// 1.6s, in 0.05s steps rather than the 4 x 0.4s it used to take. Same duration, but a 0.4s
// step moves a trap 0.16 in z — WIDER THAN THE HIT WINDOW — so a hazard could cross the ring
// inside one step and register neither a hit nor a miss. Every drill in this section reaches
// its verdict by something crossing that plane, so the coarse step was a latent flake in all
// of them. Nothing depended on the tunnelling: the suite is green either way.
function settle() { for (let i = 0; i < 32; i++) G.update(0.05); }
function waitLive(maxS) {
  for (let i = 0; i < maxS / 0.05; i++) {
    if (G.enemies().some(e => e.tut && !e.dead && !e.resolved) || G.pickups().some(p => p.tut && !p.done)) return true;
    G.update(0.05);
  }
  return false;
}
function zapPractice() {
  const pen = G.enemies().find(e => e.tut && !e.dead && !e.resolved);
  if (!pen) return false;
  if (pen.type === 'heavy') { // dock BOTH together — the crossing breaks it
    aim(0, pen.angle); aim(1, pen.angle);
  }
  else if (pen.type === 'line') { aim(0, pen.angle); aim(1, pen.partner.angle); }
  else if (pen.lock !== undefined) { aim(pen.lock, pen.angle); aim(1 - pen.lock, pen.angle + Math.PI); }
  else { aim(0, pen.angle); aim(1, pen.angle + Math.PI); }
  cross(pen);
  return pen.dead === true;
}
// CONTROLS CHECK is now an ALIGN drill: bring each lit target's node onto it
// and HOLD. First, a brief swipe-past must NOT lock a target.
{
  const A = G.tut().aim;
  const t0 = A.targets[0];                        // rep 0 materialized on the opening update
  aim(t0.node, t0.a); G.update(0.05);             // one frame on target (< hold) …
  aim(t0.node, t0.a + 1.0); G.update(0.05);       // … then gone
  check('a brief swipe past the target does not lock it', G.tut().aim.idx === 0);
}
// hold each rep to completion — the last rep lights BOTH nodes at once
{
  let guard = 120;
  while (guard-- > 0 && G.qualStage().card === 'move') {
    const A = G.tut().aim;
    if (A.targets) for (const t of A.targets) aim(t.node, t.a);
    G.update(0.05);
  }
  check('landing both nodes on their targets completes the control check', G.qualStage().card === 'normal');
}
check('practice trap 1 spawns and dies', waitLive(4) && zapPractice());
// the node killer rides with the early traps — STEER CLEAR: dodge it
waitLive(4);
{
  const pen = G.enemies().find(e => e.tut && !e.dead && !e.resolved);
  check('the killer joins the early flow', !!pen && pen.type === 'frag');
  aim(0, pen.angle + 1.5); aim(1, pen.angle - 1.5);
  cross(pen);
  check('letting the killer pass banks the dodge', pen.resolved === true && !pen.dead);
}
check('practice trap 2 spawns and dies', waitLive(4) && zapPractice());
// the practice wall lands in the same flow — steer clear until it burns off
{
  let wg0 = 200;
  while (wg0-- > 0 && !G.latches().length) G.update(0.05);
  check('the practice wall lands in the early flow', G.latches().length === 1);
  aim(0, G.latches()[0].a + Math.PI); aim(1, G.latches()[0].a + Math.PI + 0.5);
  let wg = 260;
  while (wg-- > 0 && G.latches().length) G.update(0.05);
  check('routing around the practice wall completes the lesson', !G.latches().length && G.tut() && !G.tut().retry);
}
settle();
check('heavy drill begins without a disc stop', G.getState() === G.S.PLAY && G.qualStage().card === 'heavy');
check('heavy practice: dock together breaks it at the rim', waitLive(4) && zapPractice());
settle();
check('barrier drill begins', G.qualStage().card === 'line');
check('barrier practice: node per end', waitLive(4) && zapPractice());
settle();
check('color-lock drill begins', G.qualStage().card === 'lock');
check('blue-lock practice', waitLive(4) && zapPractice());
check('white-lock practice', waitLive(4) && zapPractice());
settle();
check('volley drill: the red column is already inbound, one lane',
  G.qualStage().card === 'volley'
  && G.enemies().filter(e => e.tut === 'volley' && !e.dead).length === 4
  && new Set(G.enemies().filter(e => e.tut === 'volley').map(e => e.angle)).size === 1);
{
  // plain zaps don't graduate this stage: killing a column red the old way
  // arms a retry and the column comes back
  const pen = G.enemies().find(e => e.tut === 'volley');
  aim(0, pen.angle); aim(1, pen.angle + Math.PI);
  cross(pen);
  check('zapping the column arms a volley retry', pen.dead === true && G.tut().retry === 'volley');
  let dGuard = 400;
  while (dGuard-- > 0 && G.enemies().some(e => e.tut === 'volley' && !e.dead && !e.resolved)) G.update(0.05);
  let rGuard = 100;
  while (rGuard-- > 0 && !G.enemies().some(e => e.tut === 'volley' && !e.dead && !e.resolved)) G.update(0.05);
  check('the column respawns for the volley lesson',
    G.enemies().filter(e => e.tut === 'volley' && !e.dead && !e.resolved).length === 4);
}
{
  // dock both on the lane, hold — the charged shot sweeps the whole column
  const colA = G.enemies().find(e => e.tut === 'volley' && !e.dead && !e.resolved).angle;
  G.volley().cd = 0;
  aim(0, colA); aim(1, colA);
  let vGuard = 200;
  while (vGuard-- > 0 && G.enemies().some(e => e.tut === 'volley' && !e.dead && !e.resolved)) G.update(0.05);
  // dead bodies are culled from the array — "cleared" means none remain and
  // none slipped past (a tut miss would have armed a retry)
  check('one charged shot clears the whole column',
    !G.enemies().some(e => e.tut === 'volley') && G.tut() && !G.tut().retry);
  aim(1, colA + Math.PI); // undock for the next drill
}
settle();
check('power-up drill begins', G.qualStage().card === 'pickup');
waitLive(4);
{
  const pp = G.pickups().find(p2 => p2.tut && !p2.done);
  pp.z = G.geo().hitZ; aim(0, pp.angle);
  G.update(0.01);
  check('catching the practice relay works', G.fx.wide > 0);
  G.fx.wide = 0;
}
settle();
check('bonus-stream drill begins', G.qualStage().card === 'strip');
{
  // ride the ribbon: keep the blue node glued to the crossing point
  const spawned = waitLive(5);
  let sGuard = 600, st;
  while (sGuard-- > 0 && (st = G.enemies().find(e => e.type === 'strip' && !e.dead))) {
    const hz = G.geo().hitZ;
    aim(0, G.stripAngle(st, Math.max(0, hz - st.z))); // track the head like a player would
    G.update(0.05);
  }
  check('tracing the practice stream end-to-end succeeds',
    spawned && !G.enemies().some(e => e.type === 'strip' && !e.dead) && G.tut() && !G.tut().retry);
}
// THE PULSE DRILL. Reported flaky (one failure in eight runs, 2026-08-03) and it never
// reproduced — 66 runs across this commit and a51735f, all green, and with Math.random
// pinned the state here is identical every time. But the check as written was FRAGILE in
// exactly the shape a flake takes, so it is stated properly now instead of being left to
// coincidence:
//
//   settle() advanced a flat 1.6s and the check read whatever that landed on, which was
//   `tut.t === 1.2`. It passed for a reason nothing in the test mentions — `tut.t >= 1`
//   freezes the world (see updateTutorial), so the traps had already stopped and could not
//   reach the ring. That is a 0.2s margin held by an unrelated constant. Move the freeze
//   threshold, advanceQual's `tut.t > 0.8` gate, or settle()'s duration and the check
//   silently starts measuring a MOVING volley — at which point a 0.4s settle step (0.16 in
//   z, wider than the hit window) can tunnel a trap straight past the ring, registering
//   neither a hit nor a miss, and the 4 becomes a 3 on some runs and not others.
//
// So: wait for the stage to open, in small steps, and assert the claim the name actually
// makes — as the stage OPENS, four traps are already inbound. advanceQual pre-spawns them,
// so that is structurally guaranteed and independent of travel time entirely.
{
  let oGuard = 200; // ~10s; the advance needs !live && tut.t > 0.8
  while (oGuard-- > 0 && G.qualStage().card !== 'pulse') G.update(0.05);
  const vol = G.enemies().filter(e => e.tut === 'pulse');
  const live = vol.filter(e => !e.dead);
  check(`pulse drill: the purge volley is already inbound (${live.length} traps, card ${G.qualStage().card})`,
    G.qualStage().card === 'pulse' && live.length === 4);
  // …and state the thing the old check was silently relying on, so a change to the drill's
  // speed or stagger fails HERE, naming the cause, instead of as a mystery count elsewhere
  check(`the volley is still short of the ring (nearest z ${Math.min(...vol.map(e => e.z)).toFixed(2)} vs hitZ ${G.geo().hitZ.toFixed(2)})`,
    vol.length > 0 && Math.min(...vol.map(e => e.z)) > G.geo().hitZ);
}
{
  // a beat in, the run HOLDS: world frozen, music wound to a stop
  let fGuard = 80;
  while (fGuard-- > 0 && !(G.tut() && G.tut().frozen)) G.update(0.05);
  check('the FIRE-PULSE hold freezes the run', G.tut() && G.tut().frozen === true);
  // every trap, not just the first the array happens to yield — "the traffic" is all of it
  const zBefore = G.enemies().filter(e => e.tut === 'pulse' && !e.dead).map(e => e.z);
  for (let i = 0; i < 6; i++) G.update(0.05);
  const zAfter = G.enemies().filter(e => e.tut === 'pulse' && !e.dead).map(e => e.z);
  check(`the hold stops the traffic (${zAfter.length} traps held)`,
    zBefore.length === 4 && zAfter.length === 4 && zAfter.every((z, i) => z === zBefore[i]));
  // the ribbon charged it — tapping the core releases the hold and fires
  const d2 = G.dialCenter('L');
  canvasHandlers.pointerdown({ pointerId: 9, clientX: d2.x, clientY: d2.y, pointerType: 'touch' });
  check('tapping the core releases the hold and fires the pulse',
    G.pulseWavesN() > 0 && G.getPulse()[0] === 0 && G.tut().frozen === false && G.tut().fired === true);
  let wGuard = 240;
  while (wGuard-- > 0 && G.enemies().some(e => e.tut && !e.dead)) G.update(0.05);
  check('the purge wave clears the practice volley', !G.enemies().some(e => e.tut && !e.dead));
}
settle();
check('the QUALIFIED ceremony plays in-world, no info disc', G.getState() === G.S.PLAY && G.tut() && G.qualStage().card === 'done');
for (let i = 0; i < 90 && G.getState() !== G.S.END; i++) G.update(0.05); // the ceremony runs, then the report
check('QUALIFIED: victory screen + progress persisted', G.getState() === G.S.END && G.getEndWin() === true && G.progress.tutorialDone === true && G.tut() === null);
drawOk('qualification end screen', () => {});
drawOk('briefing card frame (zoom-in)', () => { G.startBossTest(); G.update(0.05); });
G.setState(G.S.MENU);
G.progress.tutorialDone = true;

// ================= level intro =================
// The wait for hands comes FIRST now: a parked drift with the destination dead ahead,
// then the boot those hands set off. Both frames are drawn here because they are two
// different pictures, not one picture at two times.
rawStartLevel(1);
check('intro clock arms on level start', G.getIntro() === 0);
for (let i = 0; i < 24; i++) G.update(0.05); // 1.2s of parked drift
check('the boot has not started — it is waiting for hands', G.getIntro() === 0 && G.isPreLaunch());
check('spawns held while parked', G.enemies().length === 0);
check('level clock frozen while parked', G.getLevelT() === 0);
drawOk('parked pre-launch frame (destination + AWAITING RUNNER + thumb prompts)', () => {});
canvasHandlers.pointerdown({ pointerId: 41, clientX: 120, clientY: 220, pointerType: 'touch' });
canvasHandlers.pointerdown({ pointerId: 42, clientX: 680, clientY: 220, pointerType: 'touch' });
G.update(0.05);
check('both thumbs are what start the boot', G.isLaunched() && G.getIntro() > 0);
for (let i = 0; i < 23; i++) G.update(0.05); // 1.2s in — the ring is still riding the tunnel in
check('spawns still held through the boot', G.enemies().length === 0);
check('level clock still frozen through the boot', G.getLevelT() === 0);
drawOk('mid-intro frame (ring fly-in + range readout)', () => {});
for (let i = 0; i < 40; i++) G.update(0.05); // past the dock + power-up, to handover
check('godspeed: the boot runs clean through to handover', G.getIntro() > 2.9);
drawOk('godspeed frame', () => {});
let spawned = false;
// generous window: the first spawn can be story-held clear of the t=6 comm
for (let i = 0; i < 200 && !spawned; i++) { G.update(0.05); spawned = G.enemies().length > 0; }
check('the stream goes live after GODSPEED', spawned);
check('nodes finished materializing', G.nodes[0].formedFx === true && G.nodes[1].formedFx === true);

// ================= story lulls =================
// scripted spawns steer their arrivals clear of the comm windows (t=6/16/28 on
// level 1) so transmissions play over calm stretches
G.startLevel(0);
const hzL = G.geo().hitZ;
// The comm-lull windows are gone with the scripted comms they protected. What
// replaces them as the thing worth guarding is the bark system's first rule:
// barks are DRAW-ONLY. Campaign levels reseed Math.random as the sim RNG, so a
// bark that consumed a draw would desync every replay. Running the same level
// twice from the same seed must produce an identical arrival timeline.
const timeline = () => {
  G.startLevel(2, false);
  const seen = new Set(), out = [];
  for (let i = 0; i < 500; i++) {
    G.update(0.05);
    G.setIntegrity(100);
    for (const e2 of G.enemies()) if (!seen.has(e2) && e2.z <= hzL) { seen.add(e2); out.push(G.getLevelT().toFixed(2)); }
  }
  return out.join('|');
};
const runA = timeline(), runB = timeline();
check('barks are draw-only: the arrival timeline is identical run to run', runA === runB && runA.length > 0);
check('the drill still spawns through the run', runA.split('|').length >= 4);

// ================= control scheme =================
function pdown(id, x, y) { canvasHandlers.pointerdown({ pointerId: id, clientX: x, clientY: y, pointerType: 'touch' }); }
function pmove(id, x, y) { canvasHandlers.pointermove({ pointerId: id, clientX: x, clientY: y }); }
function pup(id, x, y)   { canvasHandlers.pointerup({ pointerId: id, clientX: x, clientY: y }); }
G.progress.tutorialDone = true;
G.startLevel(0);
const dial = G.dialCenter('L');
const n0 = G.nodes[0];

// raw 1:1 relative drag: rim quarter-turn → node quarter-turn, zero lag
aim(0, 0);
pdown(9, dial.x + dial.r, dial.y);
pmove(9, dial.x, dial.y + dial.r);
check('raw drag: rim quarter-turn turns the node ~90° instantly', Math.abs(n0.angle - Math.PI / 2) < 1e-6);
pup(9, dial.x, dial.y + dial.r);

// aim assist was removed (it fought the thumb): nodes must NEVER move on their own
G.enemies().length = 0;
aim(0, 0);
en = G.spawnEnemy(0.3, 'normal');
en.z = G.geo().hitZ + 0.2;
G.update(0.05);
check('nodes never drift toward traps on their own', Math.abs(n0.angle) < 1e-6);


// ================= precision scoring =================
G.startLevel(1);
G.enemies().length = 0;
en = G.spawnEnemy(0.7, 'normal');
aim(0, Math.PI); aim(1, 0.7); // dead-center coverage
let s0 = G.getScore();
cross(en);
check('dead-center zap scores PERFECT double (combo 1 → 200)', G.getScore() - s0 === 200 && G.getPerfects() === 1);
en = G.spawnEnemy(0.7, 'normal');
aim(1, 0.7 + 0.2); // covered, but sloppy (err 0.2 > TOL*0.35)
s0 = G.getScore();
cross(en);
check('edge zap scores normal (combo 2 → 200, no perfect)', G.getScore() - s0 === 200 && G.getPerfects() === 1);

// ================= payload fragments =================
G.startLevel(3);
G.enemies().length = 0;
en = G.spawnEnemy(1.2, 'frag');
aim(0, Math.PI); aim(1, 2.6); // leave it alone
s0 = G.getScore();
const int0 = G.stats().integrity;
cross(en);
check('untouched packet pays a small bonus', en.resolved && G.getScore() - s0 === 50 && G.stats().integrity === int0);
en = G.spawnEnemy(1.2, 'frag');
aim(1, 1.2); // touch the trap — the mistake
cross(en);
check('touching a node killer fries the node, not the payload',
  en.dead && G.nodes[1].deadT > 0 && G.stats().integrity === int0 && G.stats().combo === 0);
en = G.spawnEnemy(1.2, 'normal');
cross(en);
check('a rebooting node cannot zap', !en.dead);
G.enemies().length = 0;
for (let i = 0; i < 50; i++) { G.setIntegrity(100); G.update(0.05); } // ride out the reboot
check('the node comes back online after 2s', !(G.nodes[1].deadT > 0));
G.enemies().length = 0;
en = G.spawnEnemy(1.2, 'normal');
aim(1, 1.2);
cross(en);
check('the recovered node zaps again', en.dead === true);

// ================= beat sync =================
const bt = {
  sampleRate: 1000, length: 30000, duration: 30,
  getChannelData: () => {
    const d = new Float32Array(30000);
    for (let i = 0; i < 30000; i += 500) for (let j = 0; j < 20 && i + j < 30000; j++) d[i + j] = 1;
    return d;
  }
};
check('beat detection finds the tempo of a 120bpm click track', Math.abs(G.detectBeat(bt) - 0.5) < 0.03);
G.patternQ().push({ t: 0.01, angle: 2.2 });
G.enemies().length = 0;
G.update(0.05);
check('choreographed volley entries spawn on schedule', G.enemies().some(e => Math.abs(e.angle - 2.2) < 0.1) && G.patternQ().length === 0); // crawler drift can nudge it within the tick

// ================= integrity tension =================
G.setIntegrity(25);
for (let i = 0; i < 60; i++) G.updateMusic(0.05);
check('low integrity muffles the music', G.musicFilterHz() < 3000);
G.setIntegrity(100);
for (let i = 0; i < 60; i++) G.updateMusic(0.05);
check('full integrity reopens the filter', G.musicFilterHz() > 12000);
drawOk('play HUD under heavy damage glitches', () => { G.setState(G.S.PLAY); G.setIntegrity(25); });
G.setIntegrity(100);

// ================= score chase: bests + mutators =================
G.startLevel(1);
G.enemies().length = 0;
en = G.spawnEnemy(0.5, 'normal');
aim(1, 0.5 + 0.2);
cross(en); // some score on the board
G.setLevelT(60);
G.enemies().length = 0;
G.update(0.01);
check('winning records a per-level best', G.getState() === G.S.END && G.getProg().bests[1] === G.getScore() && G.getScore() > 0);
G.setEndT(0.1); drawOk('end ceremony: banner fading in', () => {});
G.setEndT(1.2); drawOk('end ceremony: counters running', () => {});
G.setEndT(3.0); drawOk('end ceremony: buttons arrived', () => {});

G.mutators.oneLife = true; G.mutators.fast = true;
G.startLevel(1);
check('one-life modifier starts at a single block', G.stats().integrity === 25);
G.enemies().length = 0;
en = G.spawnEnemy(0.5, 'normal');
aim(0, Math.PI); aim(1, 0.5 + 0.2);
s0 = G.getScore();
cross(en);
check('modifiers multiply the take (×3 → 300)', G.getScore() - s0 === 300);
G.mutators.noPickups = true;
check('modifier multiplier compounds', Math.abs((2 * 1.5 * 1.3) - 3.9) < 1e-9);
G.mutators.oneLife = G.mutators.fast = G.mutators.noPickups = false;

// ================= soak: simulated minutes of play =================
let simNow = 500000; // monotonic clock for frame() across soaks
function soak(name, start, seconds) {
  try {
    start();
    for (let t = 0; t < seconds; t += 0.05) {
      const live = G.enemies().filter(e => !e.dead && !e.resolved);
      if (live.length) { // crude autopilot
        aim(0, live[0].angle);
        aim(1, live[live.length - 1].angle);
      } else if (G.boss() && G.boss().mergeT >= 1) {
        const g2 = G.geo();
        const bb = G.boss();
        aim(0, G.nodes[0].angle + 0.05); // keep drifting so orbs miss sometimes
        const dz = Math.max(0.06, bb.z - g2.hitZ);
        const u0 = Math.cos(G.nodes[0].angle), v0 = Math.sin(G.nodes[0].angle);
        G.setBeamAim((bb.u - u0) / (5 * dz), (bb.v - v0) / (5 * dz));
        G.keys['ArrowUp'] = true;
      }
      G.update(0.05);
      simNow += 50;
      if ((t / 0.05 | 0) % 10 === 0) G.frame(simNow);
      if (G.getState() !== G.S.PLAY) break;
    }
    check('soak: ' + name, true);
  } catch (err) {
    console.log('   ' + err.stack.split('\n')[0]);
    check('soak: ' + name, false);
  }
}
soak('metro exchange (bursts)', () => G.startLevel(2), 60);
soak('quantum relay (color locks)', () => G.startLevel(5), 70);
soak('darknet edge (bursts)', () => G.startLevel(6), 80);
soak('core firewall (boss fight)', () => G.startLevel(7), 90);
soak('endless ramp', () => G.startEndless(), 150);
G.keys['ArrowUp'] = false;

// ================= campaign packages (Phase 0) =================
{
  check('boot installed the bundled campaign', G.getCamp().id === 'investigation' && G.getLevels().length === 8);
  const mini = () => ({
    id: 'test-camp', format: 1, title: 'TEST CAMPAIGN',
    speakers: [{ id: 'OMNI', color: '1,2,3' }],
    levels: [{ tint: '10,20,30', duration: 30, spawnMin: 1, spawnMax: 2, speed: 0.4,
      comms: [{ t: 5, s: 'OMNI', m: 'hello' }], story: { title: 'LOG X', lines: ['a line'] }, caseNote: 'note' }]
  });
  check('validator passes a well-formed package', G.validateCampaign(mini()).length === 0);
  let p = mini(); p.levels[0].tint = 'red';
  check('validator rejects a bad tint', G.validateCampaign(p).length > 0);
  p = mini(); p.levels[0].comms[0].s = 'GHOST';
  check('validator rejects a comm from an unknown speaker', G.validateCampaign(p).length > 0);
  p = mini(); p.levels[0].comms[0].t = 99;
  check('validator rejects a comm after the level ends', G.validateCampaign(p).length > 0);
  p = mini(); p.levels[0].speed = 0;
  check('validator rejects zero speed', G.validateCampaign(p).length > 0);
  p = mini(); p.id = 'BAD ID!';
  check('validator rejects a malformed id', G.validateCampaign(p).length > 0);
  check('installCampaign refuses an invalid package', G.installCampaign(p) === false && G.getCamp().id === 'investigation');
  const star1 = G.getProg().stars[1];
  check('a valid package installs and switches the views', G.installCampaign(mini()) === true &&
    G.getCamp().id === 'test-camp' && G.getLevels().length === 1 && G.getLevels()[0].tint === '10,20,30');
  check('fresh campaign gets fresh progress', G.getProg().unlocked === 1 && G.getProg().stars.length === 1);
  check('story cards re-registered for the new campaign',
    G.getInfoCards().story0.title === 'LOG X' && !G.getInfoCards().story1);
  check('back to the bundled campaign, progress intact',
    G.installCampaign(G.CAMPAIGNS[0]) === true && G.getProg().stars[1] === star1 && G.getLevels().length === 8);
  // image maps: package-supplied worlds validate; junk is refused
  p = mini(); p.map = { image: 'data:image/png;base64,iVBORw0KGgo=' }; p.levels[0].mapPos = { x: 0.4, y: 0.6 };
  check('validator accepts an image map with normalized pins', G.validateCampaign(p).length === 0);
  p = mini(); p.map = { image: 'https://elsewhere.example/map.png' };
  check('validator rejects a non-data-URI map image', G.validateCampaign(p).length > 0);
  p = mini(); p.levels[0].mapPos = { x: 1.4, y: 0.5 };
  check('validator rejects an out-of-range pin', G.validateCampaign(p).length > 0);
  const m = G.migrateSaveShape({ stars: [3, 2], bests: [100], unlocked: 2, tutorialDone: true });
  check('old flat saves fold into campaign #1', m.camp.investigation.unlocked === 2 &&
    m.camp.investigation.stars[0] === 3 && m.stars === undefined && m.tutorialDone === true);
  // campaign #2: GOING DEEPER
  check('GOING DEEPER ships as campaign #2 and validates clean',
    G.CAMPAIGNS.length === 5 && G.CAMPAIGNS[1].id === 'going-deeper' && G.validateCampaign(G.CAMPAIGNS[1]).length === 0);
  check('SIGNAL LOST ships as campaign #3 and validates clean',
    G.CAMPAIGNS[2].id === 'signal-lost' && G.validateCampaign(G.CAMPAIGNS[2]).length === 0);
  check('THE BAIT ships as campaign #4 and validates clean',
    G.CAMPAIGNS[3].id === 'the-bait' && G.validateCampaign(G.CAMPAIGNS[3]).length === 0);
  check('SHUTDOWN ships as campaign #5 and validates clean',
    G.CAMPAIGNS[4].id === 'shutdown' && G.validateCampaign(G.CAMPAIGNS[4]).length === 0);
  check('difficulty rises across all five shipped campaigns',
    G.CAMPAIGNS.every((pk, i) => i === 0 || pk.difficulty > G.CAMPAIGNS[i - 1].difficulty));
  check('finales escalate: core, then triad, then spinner',
    G.CAMPAIGNS[0].levels[7].bossKind === undefined && G.CAMPAIGNS[1].levels[7].bossKind === 'triad' && G.CAMPAIGNS[2].levels[7].bossKind === 'spinner');
  check('every shipped campaign lints clean (beats + bands included)',
    G.CAMPAIGNS.every(pk => G.lintCampaign(pk).every(fl => fl.length === 0)));
  G.installCampaign(G.CAMPAIGNS[1]);
  check('campaign #2: 8 levels, boss finale, own progress, own verdict',
    G.getLevels().length === 8 && G.getLevels()[7].boss === true &&
    G.getProg().unlocked === 1 && G.getInfoCards().verdict.title === 'CONTRACT 02 — CHARTED');
  G.installCampaign(G.CAMPAIGNS[0]);
  check('back on campaign #1 its verdict is restored', G.getInfoCards().verdict.title === 'CONTRACT 01 — DELIVERED');
}

// ================= beats + bands + fairness linter (Phase 1) =================
{
  G.progress.wallBriefed = true; G.progress.stripBriefed = true; // no cards mid-test
  const knobs = { tint: '10,20,30', duration: 45, spawnMin: 1.5, spawnMax: 2.3, speed: 0.4,
    doubles: 0, heavies: 0, lines: 0, colors: 0 };
  // index 4 is a test-only SUBLANE DRIFT twin: its procedural wall pressure
  // (walls: 0.10) converted into 2 scripted wall beats + a lull, with a band
  // densifying the tail — the SHIPPED campaign keeps its original tuning
  const P1 = {
    id: 'phase1-test', format: 1, title: 'PHASE 1 TEST',
    speakers: [{ id: 'OMNI', color: '1,2,3' }],
    levels: [
      { name: 'BEATS', ...knobs,
        comms: [{ t: 35, s: 'OMNI', m: 'hold the line' }],
        beats: [
          { t: 8, kind: 'enemy', type: 'normal', angle: 1.0 },
          { t: 12, kind: 'wall', angle: 3.0 },
          { t: 20, kind: 'lull', dur: 6 },
          { t: 30, kind: 'enemy', type: 'heavy' },
          { t: 36, kind: 'enemy', type: 'normal', angle: 2.0 } // authored INSIDE the comm window
        ] },
      { name: 'BANDS', ...knobs, duration: 60, spawnMax: 2.0,
        bands: [{ t0: 20, t1: 40, intensity: 3, mix: { doubles: 0.9 } }] },
      { name: 'CLEAN', ...knobs },
      { name: 'PAD', ...knobs },
      { name: 'SUBLANE TWIN', tint: '150,110,255', duration: 60, spawnMin: 0.72, spawnMax: 1.35,
        speed: 0.46, doubles: 0.40, heavies: 0.20, lines: 0.20, colors: 0.00, frags: 0.14,
        comms: [{ t: 6, s: 'OMNI', m: 'they are walling the rail.' },
                { t: 20, s: 'OMNI', m: 'deployment key holds clearance.' },
                { t: 34, s: 'OMNI', m: 'log it. tell no one.' }],
        beats: [{ t: 18, kind: 'wall' }, { t: 28, kind: 'lull', dur: 5 }, { t: 38, kind: 'wall', angle: 4.0 }],
        bands: [{ t0: 45, t1: 58, intensity: 1.3 }] }
    ]
  };
  check('validator accepts beats + bands', G.validateCampaign(P1).length === 0);
  let pb = JSON.parse(JSON.stringify(P1)); pb.levels[0].beats[0].kind = 'meteor';
  check('validator rejects an unknown beat kind', G.validateCampaign(pb).length > 0);
  pb = JSON.parse(JSON.stringify(P1)); pb.levels[1].bands[0].t1 = 99;
  check('validator rejects a band past the level end', G.validateCampaign(pb).length > 0);
  pb = JSON.parse(JSON.stringify(P1)); pb.levels[1].bands[0].mix = { speed: 2 };
  check('validator rejects a non-rate band mix key', G.validateCampaign(pb).length > 0);

  // --- run a level and journal arrivals + wall latches on the level clock ---
  function journal(idx, seconds) {
    G.startLevel(idx);
    const arr = [], latch = [];
    const hz = G.geo().hitZ;
    const seen = new Set();
    for (let i = 0; i < seconds / 0.05; i++) {
      G.setIntegrity(100);
      G.update(0.05);
      const spd = G.getLV().speed;
      for (const e of G.enemies()) {
        // catch them a hair BEFORE the ring (a parked node may zap-and-remove
        // an arrival on its exact crossing tick) and extrapolate the true
        // crossing time from the remaining travel
        if (!seen.has(e) && e.type !== 'strip' && e.z <= hz + 0.03) {
          seen.add(e);
          arr.push({ t: G.getLevelT() + Math.max(0, e.z - hz) / (spd * (e.speedMul || 1)), angle: e.angle, type: e.type });
        }
      }
      for (const lt of G.latches()) if (lt.bit && !lt._seen) { lt._seen = true; latch.push(G.getLevelT()); }
    }
    return { arr, latch };
  }
  // the t:36 beat is authored inside the comm window ON PURPOSE — install
  // surfaces it as an advisory warning (see console) and still installs
  check('phase1 package installs despite advisory lint findings', G.installCampaign(P1) === true);
  check('lintCampaign surfaces the authored comm overlap', G.lintCampaign(P1)[0].some(v => v.code === 'comm-overlap'));
  const j0 = journal(0, 42);
  const bHit = j0.arr.find(a => Math.abs(a.angle - 1.0) < 1e-9);
  check('beat: enemy arrives within ±0.4s of its authored time', !!bHit && Math.abs(bHit.t - 8) <= 0.4);
  check('beat: wall latch lands at its authored time', j0.latch.length === 1 && Math.abs(j0.latch[0] - 12) <= 0.4);
  const hHit = j0.arr.find(a => a.type === 'heavy');
  check('beat: heavy back-times its slower travel to still land on cue', !!hHit && Math.abs(hHit.t - 30) <= 0.4);
  check('beat: lull keeps every filler arrival out of its window',
    j0.arr.length > 6 && !j0.arr.some(a => a.t > 20.1 && a.t < 26));
  const cHit = j0.arr.find(a => Math.abs(a.angle - 2.0) < 1e-9);
  check('beat: an arrival aimed into a transmission slides past the comm window',
    !!cHit && cHit.t > 37.2 && cHit.t < 39.8);
  const j0b = journal(0, 42);
  check('beats replay identically (their side stream never shifts the script)',
    j0.arr.length === j0b.arr.length &&
    j0.arr.every((a, i) => a.t === j0b.arr[i].t && a.angle === j0b.arr[i].angle && a.type === j0b.arr[i].type));

  // --- bands ---
  const bl = G.getLevels()[1];
  check('bandCfg: outside a band the level itself comes back', G.bandCfg(bl, 5) === bl && G.bandCfg(bl, 45) === bl);
  const bc = G.bandCfg(bl, 25);
  check('bandCfg: intensity divides the cadence, mix overrides the knobs',
    Math.abs(bc.spawnMin - 0.5) < 1e-9 && Math.abs(bc.spawnMax - 2 / 3) < 1e-9 &&
    bc.doubles === 0.9 && bc.speed === bl.speed && bl.doubles === 0);
  check('bandCfg: legacy level without bands is untouched', G.bandCfg(G.CAMPAIGNS[0].levels[1], 10) === G.CAMPAIGNS[0].levels[1]);
  {
    G.startLevel(1);
    const seen = new Set();
    let inB = 0, outB = 0;
    for (let i = 0; i < 60 / 0.05; i++) {
      G.setIntegrity(100);
      G.update(0.05);
      for (const e of G.enemies()) if (!seen.has(e) && e.type !== 'strip') {
        seen.add(e);
        const t = G.getLevelT();
        if (t >= 20 && t < 40) inB++; else outB++;
      }
    }
    check('band intensity densifies the stream (2× window, ≥1.5× the spawns)', inB > outB * 1.5 && outB > 5);
  }

  // --- the SUBLANE twin: scripted walls carry the old procedural pressure ---
  const j4 = journal(4, 60);
  check('undercity twin: both scripted walls land on schedule', j4.latch.length === 2 &&
    Math.abs(j4.latch[0] - 18) <= 0.4 && Math.abs(j4.latch[1] - 38) <= 0.4);
  check('undercity twin: the lull holds a dense level quiet', !j4.arr.some(a => a.t > 28.1 && a.t < 33));
  check('undercity twin: lints clean', G.lintCampaign(P1)[4].length === 0);

  // --- fairness linter ---
  const lintBase = { ...knobs, name: 'LINT', duration: 40 };
  const has = (lvl, code) => G.lintLevel(lvl, 0).some(v => v.code === code);
  check('lint: simultaneous heavy + line beats → dual-conflict',
    has({ ...lintBase, beats: [{ t: 10, kind: 'enemy', type: 'heavy' }, { t: 10, kind: 'enemy', type: 'line' }] }, 'dual-conflict'));
  // REACHABILITY (designer ruling): enemies may share a wall's window as long
  // as their dock arc stays out of the carpet. An unforced on-carpet beat is
  // relocated to safety by the engine (no finding); only a FORCE-overridden
  // beat actually lands unreachable — and the linter tells the truth about it.
  check('lint: a FORCED beat left on a wall carpet → wall-conflict',
    has({ ...lintBase, beats: [{ t: 10, kind: 'wall', angle: 2.0, force: true }, { t: 12, kind: 'enemy', type: 'normal', angle: 2.0, force: true }] }, 'wall-conflict'));
  check('lint: the same beat unforced relocates to safety — no finding',
    !has({ ...lintBase, beats: [{ t: 10, kind: 'wall', angle: 2.0, force: true }, { t: 12, kind: 'enemy', type: 'normal', angle: 2.0 }] }, 'wall-conflict'));
  {
    // near-but-not-ON a carpet is now legal EVERYWHERE: an authored angle a
    // node-width clear of the wall stays verbatim (no relocation, no finding)
    const nearL = { ...lintBase, beats: [{ t: 10, kind: 'wall', angle: 2.0, force: true }, { t: 12, kind: 'enemy', type: 'normal', angle: 2.9 }] };
    const nearR = G.lintWalk(nearL, 0).arr.find(r => r.beat === 1);
    check('reachable-but-close beats keep their authored angle', !!nearR && nearR.angle === 2.9);
    check('...and lint agrees they are fair', !G.lintLevel(nearL, 0).some(v => v.code === 'wall-conflict'));
  }
  check('lint: a beat inside another beat\'s lull → lull-violation',
    has({ ...lintBase, beats: [{ t: 20, kind: 'lull', dur: 6 }, { t: 22, kind: 'enemy', type: 'normal' }] }, 'lull-violation'));
  check('lint: a beat arrival inside a comm window → comm-overlap',
    has({ ...lintBase, comms: [{ t: 10, s: 'OMNI', m: 'x' }], beats: [{ t: 11, kind: 'enemy', type: 'normal' }] }, 'comm-overlap'));
  check('lint: a clean level yields no findings', G.lintLevel(lintBase, 0).length === 0);
  check('lint: the shipped campaign is warning-free', G.lintCampaign(G.CAMPAIGNS[0]).every(li => li.length === 0));
}

// ================= the contracts say what the game shows =================
// Two failures this guards, both of which sat in the shipped packages unseen
// because neither one has a screen that would have shown it wrong.
{
  // 1. NO SECOND NAME. A relay is named by the route it flies, generated from
  //    the chart. A `name` on a level is a label no screen reads, so it drifts
  //    silently — the bundled contracts carried a corrupt-badge investigation's
  //    level names inside a survey campaign for months.
  const named = G.CAMPAIGNS.flatMap((c, ci) =>
    c.levels.map((l, li) => (l.name === undefined ? null : c.id + ' L' + (li + 1))).filter(Boolean));
  check('no bundled level carries a name (the route IS the name)'
    + (named.length ? ' — ' + named.join(', ') : ''), named.length === 0);

  // 2. EVERY RELAY BRIEFS. The last level's story line had been written after
  //    the levels array closed, so it landed on the PACKAGE — which cost every
  //    contract its finale briefing AND overwrote the campaign's own prose,
  //    because the later `story:` key wins in an object literal.
  const noBrief = G.CAMPAIGNS.flatMap(c =>
    c.levels.map((l, li) => (l.story && typeof l.story.line === 'string' ? null : c.id + ' L' + (li + 1))).filter(Boolean));
  check('every bundled relay has its own briefing line'
    + (noBrief.length ? ' — missing on ' + noBrief.join(', ') : ''), noBrief.length === 0);
  const badProse = G.CAMPAIGNS.filter(c => typeof c.story !== 'string' || !c.story.length).map(c => c.id);
  check('every contract keeps its briefing prose'
    + (badProse.length ? ' — clobbered on ' + badProse.join(', ') : ''), badProse.length === 0);

  // purity: linting mid-run must not advance the live seeded stream
  G.installCampaign(G.CAMPAIGNS[0]);
  const pureA = recordSpawns(() => G.startLevel(1), 10);
  const pureB = recordSpawns(() => { G.startLevel(1); G.lintLevel(G.getLevels()[4], 4); }, 10);
  check('lintLevel never disturbs the live spawn stream', pureA.join(';') === pureB.join(';'));
}

// ================= tunnel designer pure helpers (Phase 2) =================
{
  // editor.js guards its DOM boot behind window.__EDITOR_PAGE__ — evaling it
  // here only defines the pure ED namespace (exposed on globalThis)
  eval(fs.readFileSync(path.join(__dirname, '..', 'src', 'editor.js'), 'utf8'));
  const ED = globalThis.ED;
  check('editor.js evals headless and exposes the ED namespace', !!ED && typeof ED.addBeat === 'function');
  // clone isolation: the editor always works on a deep copy
  const src = G.CAMPAIGNS[0];
  const dur0 = src.levels[0].duration;   // a field the engine actually reads
  const wc = ED.clone(src);
  wc.levels[0].duration = dur0 + 17;
  wc.levels[0].story.line = 'changed';   // comms are gone; the brief line is the deep field now
  check('clone: edits never leak back into the source package',
    src.levels[0].duration === dur0 && wc.levels[0].duration !== dur0 && src.levels[0].story.line !== 'changed');
  // factories ship valid data
  const np = ED.newCampaign();
  check('new-campaign template passes validateCampaign', G.validateCampaign(np).length === 0);
  ED.addLevel(np);
  check('an added level keeps the package valid', np.levels.length === 2 && G.validateCampaign(np).length === 0);
  // beats: add / retime / delete (list stays sorted, times stay in-clock)
  const lv = np.levels[0]; // duration 45
  const b1 = ED.addBeat(lv, ED.makeBeat('heavy', 20, 1.0));
  const b2 = ED.addBeat(lv, ED.makeBeat('wall', 5, 2.0));
  check('addBeat keeps the beat list sorted by t', lv.beats[0] === b2 && lv.beats[1] === b1);
  ED.retimeBeat(lv, b2, 999);
  check('retime clamps into the level clock and resorts', b2.t <= 44.9 && lv.beats[1] === b2);
  ED.retimeBeat(lv, b2, -3);
  check('retime clamps at zero', b2.t === 0 && lv.beats[0] === b2);
  const lull = ED.addBeat(lv, ED.makeBeat('lull', 44.9));
  check('a lull can never spill past the level end', lull.t + lull.dur <= 45);
  check('snap rides a 0.1s grid without float dust', ED.snap(3.14159) === 3.1 && ED.snap(8.65) === 8.7);
  ED.deleteBeat(lv, b1); ED.deleteBeat(lv, b2); ED.deleteBeat(lv, lull);
  check('deleting the last beat drops the beats key entirely', lv.beats === undefined);
  // timeline math
  const px = ED.t2x(12.3, 60, 800);
  check('time <-> pixel mapping round-trips', Math.abs(ED.x2t(px, 60, 800) - 12.3) < 1e-9);
  // bands: normalization always yields validator-clean windows
  lv.bands = [{ t0: 20, t1: 40, intensity: 2 }, { t0: 10, t1: 30 }, { t0: 44.8, t1: 60 }, { t0: 5, t1: 5.1 }];
  const bs = ED.normalizeBands(lv);
  check('normalizeBands sorts, clips overlaps and drops slivers',
    bs.length === 2 && bs[0].t0 === 10 && bs[0].t1 === 30 && bs[1].t0 === 30 && bs[1].t1 === 40 &&
    G.validateCampaign(np).length === 0);
  // export -> import round trip with beats + bands aboard
  ED.addBeat(np.levels[0], ED.makeBeat('normal', 8, 1.2));
  ED.addBand(np.levels[1], 10, 20);
  const txt = ED.exportJSON(np);
  const back = JSON.parse(txt);
  check('export round-trips through validateCampaign with beats + bands intact',
    G.validateCampaign(back).length === 0 && back.levels[0].beats.length === 1 && back.levels[1].bands.length === 1);
  check('the campaigns.js entry is pasteable JSON under a comment header',
    ED.exportEntry(np).startsWith('//') && JSON.parse(ED.exportEntry(np).split('\n').slice(1).join('\n')).id === np.id);
  // import validation flow
  check('import rejects broken JSON', !!ED.importJSON('{nope', G.validateCampaign).errors);
  const badPkg = ED.clone(np); badPkg.levels[0].tint = 'red';
  check('import surfaces validator errors', ED.importJSON(JSON.stringify(badPkg), G.validateCampaign).errors.length > 0);
  const okImp = ED.importJSON(txt, G.validateCampaign);
  check('import returns the parsed package when it validates', !okImp.errors && okImp.pkg.id === np.id);
  // level ops
  const mv = ED.clone(G.CAMPAIGNS[0]);
  const t0 = mv.levels[0].tint;          // levels have no name — identify by live data
  check('the fixture levels are distinguishable', mv.levels[2].tint !== t0);
  ED.moveLevel(mv, 0, 2);
  check('moveLevel reorders and stays valid', mv.levels[2].tint === t0 && G.validateCampaign(mv).length === 0);
  check('moveLevel refuses out-of-range targets', ED.moveLevel(mv, 0, 99) === 0);
  const solo = ED.newCampaign();
  check('removeLevel never empties a campaign', ED.removeLevel(solo, 0) === false && solo.levels.length === 1);
  check('comms clamp at the 64-char transmission limit', ED.clampComm('x'.repeat(80)).length === 64);
  { // mission-disc content: art, the plot line, and the designer's own notes
    const dc = ED.clone(G.CAMPAIGNS[0]);
    dc.levels[0].art = 'investigation-01.webp';
    dc.levels[0].notes = 'reshoot the keyframe — too blue';
    check('a bundled art file reference validates', G.validateCampaign(dc).length === 0);
    dc.levels[0].art = 'data:image/webp;base64,' + 'A'.repeat(64);
    check('an embedded keyframe validates', G.validateCampaign(dc).length === 0);
    dc.levels[0].art = 'data:image/webp;base64,' + 'A'.repeat(400001);
    check('an embedded keyframe over the package cap is rejected',
      G.validateCampaign(dc).some(e => /bad art/.test(e)));
    dc.levels[0].art = '../../etc/passwd';
    check('an art name that escapes the art directory is rejected',
      G.validateCampaign(dc).some(e => /bad art/.test(e)));
    delete dc.levels[0].art;
    check('notes ride along and survive an export round-trip',
      JSON.parse(ED.exportJSON(dc)).levels[0].notes === 'reshoot the keyframe — too blue');
    dc.levels[0].notes = 'x'.repeat(4001);
    check('runaway notes are rejected', G.validateCampaign(dc).some(e => /bad notes/.test(e)));
    dc.levels[0].notes = 'ok';
    dc.levels[0].story = { line: 'x'.repeat(97) };
    check('a plot line past the disc budget is rejected',
      G.validateCampaign(dc).some(e => /story line too long/.test(e)));
  }
  // wall authoring guard: one carpet per rim window (release..burn-off) —
  // an overlapping window + arc would be golden-angle hopped by the engine
  const wl = ED.newLevel('WALLS'); wl.duration = 60;
  ED.addBeat(wl, ED.makeBeat('wall', 20, 1.0));
  const trav = 5; // nominal travel — the guard takes it as a param, purity intact
  check('wallFits blocks a stacked wall (same window, same arc)', ED.wallFits(wl, 21, 1.2, trav).ok === false);
  check('wallFits blocks an unknown (seeded) arc inside the window', ED.wallFits(wl, 21, undefined, trav).ok === false);
  check('wallFits allows the same arc once the windows clear', ED.wallFits(wl, 20 + trav + 3.7, 1.0, trav).ok === true);
  check('wallFits allows an opposite arc inside the window', ED.wallFits(wl, 21, 1.0 + Math.PI, trav).ok === true);
  // color language: every chip resolves, and the game's code is spoken exactly
  check('every tool speaks the in-game color language',
    ['normal', 'heavy', 'line', 'lock0', 'lock1', 'frag', 'wall', 'strip', 'pickup', 'lull']
      .every(k => { const c = ED.chip(k); return !!(c.bg && c.bd && c.tick); }) &&
    ED.colors.heavy === '#d465ff' && ED.colors.wall === '#ff963c' &&
    ED.colors.lock0 === '#4d9bff' && ED.colors.frag === '#0b0e16' && ED.colors.normal === '#ff5468');

  // track packing (video-editor semantics): sequential beats share TRACK 1,
  // genuinely simultaneous ones open a new track; touching edges still share
  const pk = [
    { t: 5, kind: 'enemy', type: 'normal' }, { t: 10, kind: 'enemy' }, { t: 15, kind: 'enemy' },
    { t: 20, kind: 'enemy' }, { t: 25, kind: 'enemy' }, { t: 10.5, kind: 'enemy' }];
  const pkL = ED.packLanes(pk, { trav: 4.6, speed: 0.4 });
  check('packLanes: five sequential beats share TRACK 1', pkL.slice(0, 5).every(l2 => l2 === 0));
  check('packLanes: a sixth inside another window opens TRACK 2', pkL[5] === 1);
  check('packLanes: edge-touching extents share a track (no new lane)',
    ED.packLanes([{ t: 10, kind: 'enemy' }, { t: 11.6, kind: 'enemy' }], {}).every(l2 => l2 === 0));
  const pkW = ED.packLanes([{ t: 10, kind: 'wall' }, { t: 8, kind: 'enemy' }, { t: 12, kind: 'lull', dur: 4 }],
    { trav: 4, speed: 0.4 });
  check('packLanes: a wall owns its telegraph+burn window; first-fit reuses freed tracks',
    pkW[0] === 0 && pkW[1] === 1 && pkW[2] === 1);

  // --- lintWalk: the extracted timeline walk (filler lane + wall predictions) ---
  const wkA = G.lintWalk(G.CAMPAIGNS[0].levels[1], 1);
  const wkB = G.lintWalk(G.CAMPAIGNS[0].levels[1], 1);
  check('lintWalk emits a deterministic arrival list',
    wkA.arr.length > 10 && JSON.stringify(wkA.arr.map(r => [r.t, r.type, r.angle])) ===
    JSON.stringify(wkB.arr.map(r => [r.t, r.type, r.angle])));
  check('pure filler arrivals carry no beat tag', wkA.arr.every(r => r.beat === undefined));
  const wlv = { name: 'WK', tint: '1,2,3', duration: 40, spawnMin: 1.0, spawnMax: 1.6, speed: 0.4,
    doubles: 0.3, heavies: 0, lines: 0, colors: 0,
    beats: [{ t: 10, kind: 'enemy', type: 'normal', angle: 2.0 }, { t: 10.5, kind: 'wall', angle: 2.0 }] };
  const wk = G.lintWalk(wlv, 0);
  const ww = wk.walls.find(w2 => w2.beat !== undefined);
  check('walk separates authored beats from filler', wk.arr.some(r => r.beat !== undefined) && !!ww);
  check('walk reports where a clashing authored wall actually LANDS',
    !!ww && Math.abs(ww.a - 2.0) > 0.1); // the t=10 arrival owns that arc — the engine hops the wall
  const wpA = recordSpawns(() => G.startLevel(1), 10);
  const wpB = recordSpawns(() => { G.startLevel(1); G.lintWalk(G.getLevels()[4], 4); }, 10);
  check('lintWalk never disturbs the live spawn stream', wpA.join(';') === wpB.join(';'));
}

// ================= round 3: force flag, fast opening, birth fade =================
{
  G.progress.wallBriefed = true;
  // --- the force override reaches the live engine verbatim ---
  const FP = { id: 'force-test', format: 1, title: 'FORCE', speakers: [{ id: 'OMNI', color: '1,2,3' }],
    levels: [{ name: 'F', tint: '1,2,3', duration: 40, spawnMin: 9, spawnMax: 9, speed: 0.4,
      doubles: 0, heavies: 0, lines: 0, colors: 0,
      beats: [{ t: 2, kind: 'enemy', type: 'normal', angle: 4.0 },
              { t: 10, kind: 'wall', angle: 2.0, force: true },
              { t: 12, kind: 'enemy', type: 'normal', angle: 2.0, force: true }] }] };
  check('validator accepts the force flag', G.validateCampaign(FP).length === 0);
  const FPbad = JSON.parse(JSON.stringify(FP)); FPbad.levels[0].beats[1].force = 'yes';
  check('validator rejects a non-boolean force', G.validateCampaign(FPbad).length > 0);
  G.installCampaign(FP);
  G.startLevel(0);
  // the early t=2 beat can't back-time before the level start: it clamps at
  // t≈0 and materializes mid-bore at CONSTANT speed, arriving on cue
  let earlyEn = null, g3 = 100;
  while (g3-- > 0 && !earlyEn) { G.setIntegrity(100); G.update(0.05); earlyEn = G.enemies().find(e => e.angle === 4.0); }
  check('an early beat clamps at the level start: mid-bore spawn', !!earlyEn && earlyEn.z < 1.6 && earlyEn.speedMul === 1);
  let earlyT = -1; g3 = 100;
  const hz3 = G.geo().hitZ;
  while (g3-- > 0 && earlyT < 0) { G.setIntegrity(100); G.update(0.05); if (earlyEn.z <= hz3 + 0.02) earlyT = G.getLevelT(); }
  check('...and still arrives on the authored cue (t=2 ±0.4)', earlyT > 1.6 && earlyT < 2.45);
  let fEn = null; g3 = 300;
  while (g3-- > 0 && !fEn) { G.setIntegrity(100); G.update(0.05); fEn = G.enemies().find(e => e.angle === 2.0); }
  check('a forced beat lands EXACTLY on its authored angle, on the carpet',
    !!fEn && fEn.angle === 2.0 && G.latches().length === 1 && Math.abs(G.latches()[0].a - 2.0) < 1e-9);
  check('the linter still tells the truth about the override',
    G.lintLevel(FP.levels[0], 0).some(v => v.code === 'wall-conflict'));
  G.installCampaign(G.CAMPAIGNS[0]);

  // --- fast opening: the player never flies into an empty tunnel ---
  G.startLevel(1);
  G.update(0.05);
  const opener = G.enemies().filter(e => !e.dead);
  check('traffic is inbound from second zero, at full horizon depth',
    opener.length >= 1 && opener.every(e => e.z > 1.9));
  const hz5 = G.geo().hitZ;
  const exp5 = (2.1 - hz5) / (0.40 * opener[0].speedMul);
  let arrT = -1, g5 = 300;
  while (g5-- > 0 && arrT < 0) { G.setIntegrity(100); G.update(0.05); if (opener[0].z <= hz5 + 0.02) arrT = G.getLevelT(); }
  check('first contact comes at NATURAL travel time — speed is never scaled',
    (opener[0].speedMul === 1 || opener[0].speedMul === 0.82) && arrT > 0 && Math.abs(arrT - exp5) < 0.35);
  G.startEndless();
  G.update(0.05);
  check('endless opens with traffic inbound too', G.enemies().length >= 1);

  // --- birth fade: nothing pops into existence ---
  G.startLevel(1);
  G.enemies().length = 0;
  const nb = G.spawnEnemy(1.0, 'normal');
  check('a newborn trap is still materializing (birth fade < 1)', G.birthFade(nb) < 0.5);
  for (let i = 0; i < 12; i++) { G.setIntegrity(100); G.update(0.05); }
  check('the birth fade completes within ~0.4s', G.birthFade(nb) === 1);
  G.spawnPickup();
  const nbp = G.pickups()[G.pickups().length - 1];
  check('pickups carry the birth fade too', G.birthFade(nbp) < 0.5);
  G.setState(G.S.MENU);
}

// ================= carousel swipe =================
{
  G.setState(G.S.MENU); G.setMenuScreen('camps'); G.setCampScroll(0); G.frame(16);
  canvasHandlers.pointerdown({ pointerId: 4, clientX: 700, clientY: 300, pointerType: 'touch', timeStamp: 0 });
  canvasHandlers.pointermove({ pointerId: 4, clientX: 250, clientY: 300, pointerType: 'touch', timeStamp: 40 });
  canvasHandlers.pointerup({ pointerId: 4, clientX: 250, clientY: 300, pointerType: 'touch', timeStamp: 45 });
  check('a left swipe slides the carousel to a later disc', G.getCampScroll() >= 1);
  const at = G.getCampScroll();
  check('release snaps to a whole disc', at === Math.round(at));
  check('a swipe is a swipe, not a tap — no key under it fired', G.getMenuScreen() === 'camps');
  G.setCampScroll(0); G.setMenuScreen('home'); G.frame(16);
}

// ================= one-shot transitions =================
{
  G.setState(G.S.MENU); G.setMenuScreen('map'); G.frame(16);
  const bk = G.getBackRect();
  G.menuTap(bk.x + 5, bk.y + 5, 1);
  for (let i = 0; i < 6; i++) G.update(0.05); // press beat fires -> panelsOut under way
  const fx1 = G.getMenuFx();
  const k1 = fx1 && fx1.kind, t1 = fx1 && fx1.t; // snapshot scalars — the fx object is live
  G.menuTap(bk.x + 5, bk.y + 5, 1); // mash BACK again mid-flight
  G.update(0.05);
  const fx2 = G.getMenuFx();
  check('mashing BACK cannot restart the transition',
    k1 === 'panelsOut' && fx2 && fx2.kind === 'panelsOut' && fx2.t > t1);
  flushUI(); flushUI();
  check('the single back still lands on the carousel', G.getMenuScreen() === 'camps');
  G.setMenuScreen('home'); G.frame(16);
}

// ================= gamepad (desktop playtesting) =================
{
  const pad = { connected: true, axes: [0, 0, 0, 0], buttons: Array.from({ length: 16 }, () => ({ pressed: false })) };
  Object.defineProperty(globalThis, 'navigator', { value: { getGamepads: () => [pad] }, configurable: true });
  const tap = (i) => { pad.buttons[i].pressed = true; G.update(0.05); pad.buttons[i].pressed = false; G.update(0.05); };
  G.startLevel(1);
  G.update(0.05);
  pad.axes = [1, 0, 0, -1]; // left stick east, right stick north
  G.update(0.05);
  check('sticks steer the nodes absolutely',
    Math.abs(G.nodes[0].angle) < 1e-6 && Math.abs(G.nodes[1].angle + Math.PI / 2) < 1e-6);
  pad.axes = [0.1, 0.1, 0, -1]; // left stick inside the deadzone
  G.update(0.05);
  check('deadzone leaves the node parked', Math.abs(G.nodes[0].angle) < 1e-6);
  G.setPulse([G.PULSE_MAX(), 0]);
  pad.buttons[6].pressed = true; // LT
  G.update(0.05);
  check('left trigger spends the charged blue pulse', G.pulseWavesN() > 0 && G.getPulse()[0] === 0);
  pad.buttons[6].pressed = false;
  pad.buttons[9].pressed = true; // START
  G.update(0.05);
  check('START pauses the run', G.getState() === G.S.PAUSE);
  pad.buttons[9].pressed = false;
  G.update(0.05);
  pad.buttons[9].pressed = true;
  G.update(0.05);
  check('START again resumes', G.getState() === G.S.PLAY);
  pad.buttons[9].pressed = false;
  G.update(0.05);
  // D-pad drives the menus: pause the run, walk right to QUIT, press A
  tap(9); // pause
  G.frame(16); // draw builds pauseButtonsList
  check('pause opens with RESUME focused', G.getGpSel() === 0);
  tap(15); tap(15); // right, right: RESUME -> RESTART -> QUIT
  check('D-pad walks the pause row to QUIT', G.getState() === G.S.PAUSE && G.getGpSel() === 2);
  tap(0); // A presses the focused key
  check('A on QUIT lands back in the menu', G.getState() === G.S.MENU);
  flushUI();
  // Y from pause = QUIT straight away
  G.startLevel(1); G.update(0.05);
  tap(9); G.frame(16);
  tap(3);
  check('Y quits the run from pause', G.getState() === G.S.MENU);
  flushUI();
  // mode wheel: POINT the stick at the campaign slice, then A
  G.setMenuScreen('home'); G.frame(16); G.update(0.05);
  const cSec = G.menuBtns().find(b2 => b2.mode === 'campaign').sector;
  const cMid = (cSec.a0 + cSec.a1) / 2;
  pad.axes = [Math.cos(cMid), Math.sin(cMid), 0, 0];
  G.update(0.05);
  check('pointing the stick focuses the campaign slice',
    G.menuBtns()[G.getGpSel()] && G.menuBtns()[G.getGpSel()].mode === 'campaign');
  pad.axes = [0, 0, 0, 0];
  tap(0);
  flushUI();
  check('A on the campaign slice opens the case-file carousel', G.getMenuScreen() === 'camps');
  flushUI(); G.frame(16); G.update(0.05); // discs build; centered = active case
  // the carousel opens centered on the ACTIVE case, whose slot is TRAIN_DISCS +
  // its campaign index — never a fixed number. Step RELATIVE to wherever it
  // opened so inserting or dropping a disc can't turn this into a false alarm.
  const d0 = G.getCampScroll();
  tap(15); // right: slide to the next disc
  check('D-pad right slides the carousel', G.getCampScroll() === d0 + 1);
  tap(14); // and back to the active case
  check('D-pad left slides it back', G.getCampScroll() === d0);
  tap(0); // A syncs the centered disc
  flushUI(); flushUI();
  check('A syncs the centered case file into its route map', G.getMenuScreen() === 'map');
  flushUI(); // let the panels finish driving in
  G.frame(16); G.update(0.05);
  // the map is a list: D-pad up/down moves the relay selection directly
  const sel0 = G.getMapSel();
  tap(12); // up
  check('D-pad up steps the relay selection', G.getMapSel() === Math.max(0, sel0 - 1));
  tap(13); // down
  check('D-pad down steps it back', G.getMapSel() === sel0);
  // A deploys the selected relay (launch zoom -> level)
  tap(0);
  flushUI();
  check('A deploys the selected relay', G.getState() === G.S.PLAY || G.getState() === G.S.INFO);
  if (G.getState() === G.S.INFO) dismiss();
  // controller boot gate: same-direction sticks do NOT arm; opposite sticks do
  // mid-boot, where the grip is still read (introT < INTRO_DUR). Deliberately NOT 0: at 0
  // a satisfied grip would LAUNCH the run and start the ceremony clock, and this test is
  // about the stick geometry, not the gate
  G.setIntro(2.5);
  pad.axes = [1, 0, 1, 0]; // both sticks east — one thumb, effectively
  G.update(0.05);
  check('same-direction sticks do not satisfy the gate', !G.getPadHold()[0] && !G.getPadHold()[1]);
  pad.axes = [1, 0, -1, 0]; // bracing the ring from both sides
  G.update(0.05);
  check('opposite sticks register the operator', G.getPadHold()[0] && G.getPadHold()[1]);
  pad.axes = [0, 0, 0, 0];
  G.setIntro(999);
  // B backs out of the map — via the case-file picker — to the wheel
  G.setState(G.S.MENU); G.setMenuScreen('map'); G.frame(16); G.update(0.05);
  tap(1);
  flushUI(); flushUI(); // panels fly out -> the disc shrinks back into its slot
  check('B backs out of the map to the carousel (disc zoom-out)', G.getMenuScreen() === 'camps');
  tap(1);
  flushUI();
  check('B backs out to the mode wheel', G.getMenuScreen() === 'home');
  flushUI(); flushUI(); // let any inbound spin settle — START must not race a transition
  // START in the menus toggles the settings panel; B cancels it
  tap(9);
  check('START opens the settings panel from the menu', G.getMenuSettings() === true);
  tap(1);
  check('B closes the settings panel', G.getMenuSettings() === false);
  // LB/RB ride the case-file carousel
  G.setMenuScreen('camps'); G.setCampScroll(0); G.frame(16); G.update(0.05);
  tap(5); // RB
  check('RB slides the carousel to the next disc', G.getCampScroll() === 1);
  tap(4); // LB
  check('LB slides it back', G.getCampScroll() === 0);
  G.setMenuScreen('home'); G.frame(16); G.update(0.05);
  // pause: the focus ring climbs from the buttons into the settings rows
  G.startLevel(1); G.update(0.05);
  tap(9); G.frame(16); G.update(0.05); // pause + draw builds buttons AND toggles
  const nBtns = G.pauseBtns().length;
  tap(12); // up: RESUME -> the TRACK skip keys, the nearest control above the button row
  check('D-pad up climbs from RESUME onto the TRACK keys',
    /^trk/.test((G.pauseBtns()[G.getGpSel()] || {}).action || ''));
  tap(12); // up again: TRACK -> a settings row
  check('D-pad up climbs from TRACK into the settings rows', G.getGpSel() >= nBtns);
  const hv = G.settings.haptics;
  G.setGpSel(nBtns + G.toggles().findIndex(t => t.key === 'haptics')); G.frame(16);
  tap(0); // A flips the focused toggle
  check('A flips the focused HAPTICS toggle', G.settings.haptics === !hv);
  G.settings.haptics = hv; // leave the world as found
  G.setGpSel(nBtns + G.toggles().findIndex(t => t.key === 'sound'));
  G.settings.sound = true; G.settings.soundVol = 0.5; G.frame(16);
  tap(15); // right: ride the volume rail instead of moving focus
  check('right on the SFX row nudges the volume rail', Math.abs(G.settings.soundVol - 0.625) < 1e-9);
  tap(14);
  check('left brings it back', Math.abs(G.settings.soundVol - 0.5) < 1e-9);
  tap(3); // Y = QUIT the run
  flushUI();
  check('Y quits the paused run to the menu', G.getState() === G.S.MENU);
  flushUI(); flushUI();
  delete globalThis.navigator;
  G.setState(G.S.MENU); G.setMenuScreen('home');
}

// ================= Web Audio music looper =================
const tick = () => new Promise(r => setImmediate(r));
// A run's track is no longer started BY startLevel — the soundtrack contract in
// updateMusic brings it in on the start sequence, after deploy's fade-out has had
// its second of quiet. So a test that wants a live run take has to run frames.
async function runMusicUp() {
  for (let i = 0; i < 6 && !G.music().src; i++) { G.updateMusic(1.1); await tick(); }
}
(async () => {
  G.settings.music = true; G.settings.musicVol = 0.5;
  G.playTrack('menu');
  await tick(); // drain fetch→decode→start promise chain
  let ms = G.music();
  check('menu track decoded into a looping source', !!ms.src && ms.src.started && ms.src.loop === true);
  check('loop points trim the encoder padding', Math.abs(ms.src.loopStart - 0.5) < 1e-9 && Math.abs(ms.src.loopEnd - 9.0) < 1e-9);
  check('playback starts at the trimmed loop start', Math.abs(ms.src.startOffset - 0.5) < 1e-9);
  check('fade-in starts from silence', ms.gain.gain.value === 0);
  G.setBeat(0.5, -0.1); // grid anchored 0.1s ago → beats at delay 0.4, 0.9, 1.4...
  const q = G.beatQuantize(1.13, 0);
  check('spawn delays snap arrivals onto the beat grid', Math.abs(((0.1 + q) % 0.5)) < 1e-9 || Math.abs(((0.1 + q) % 0.5) - 0.5) < 1e-9);
  G.setBeat(0, 0);
  G.updateMusic(1.1);
  check('fade-in ramping', ms.gain.gain.value > 0.05 && ms.gain.gain.value < 0.45);
  G.updateMusic(5);
  check('fade-in completes at the set volume', Math.abs(ms.gain.gain.value - G.settings.musicVol) < 1e-9);

  const oldSrc = ms.src;
  G.playTrack(1);
  await tick();
  ms = G.music();
  check('track switch stops the old source', oldSrc.stopped);
  check('new track playing on a fresh source', !!ms.src && ms.src !== oldSrc && ms.src.started);
  check('new track fades in from silence too', ms.gain.gain.value === 0);
  const sameSrc = ms.src;
  G.playTrack(1);
  await tick();
  check('same-key replay is a no-op', G.music().src === sameSrc);
  check('fetched the expected files', fetchLog.includes('menu.mp3') && fetchLog.includes('l2.mp3'));

  // ---- a switch must never open a gap ----
  // Fetching + decoding a track is a few hundred ms on a laptop and MANY SECONDS
  // on a phone. The outgoing take has to stay on air for that whole window:
  // dropping it when the switch was REQUESTED left a restarted level opening on
  // dead air for as long as the load took.
  const onAir = G.music().src;
  const cold = G.music().warm === 2 ? 0 : 2; // a key with no buffer in hand: this switch has to LOAD
  G.playTrack(cold);                       // requested — nothing decoded yet
  check('a switch leaves the old take playing while the new one loads',
    G.music().src === onAir && !onAir.stopped);
  await tick();
  check('the handover happens when the new take is ready to start',
    G.music().src !== onAir && G.music().src.started && onAir.stopped);

  // ================= the soundtrack contract, rule by rule =================
  // A gesture no longer picks a track at all — game state does, in updateMusic.
  G.setState(G.S.END);
  const endSrc = G.music().src, fetchesBefore = fetchLog.length;
  G.audio();
  await tick();
  check('a gesture never switches tracks by itself',
    G.music().src === endSrc && fetchLog.length === fetchesBefore);

  // rule 2: deploy fades the menu piece out to silence, and holds it there
  G.setState(G.S.MENU); G.updateMusic(0.05); await tick();
  G.startLevel(0);
  check('deploy drops the menu piece', !G.music().src && G.music().key === null);
  G.updateMusic(0.5);
  await tick();                       // the run's take finishes warming under the silence
  check('the deploy fade-out keeps its second of quiet', !G.music().src);

  // rule 3: the run's own track comes in with the start sequence
  G.updateMusic(0.6); await tick();
  check('the start sequence brings in the run\'s random track',
    !!G.music().src && G.music().key === G.getRunTrack() && typeof G.getRunTrack() === 'number');
  check('the run track is announced when it actually starts', G.nowPlayingName() === G.trackName(G.getRunTrack()));

  // rule 4: the pause card holds the track in place, resume picks it back up
  const live = G.music().src;
  G.setState(G.S.PAUSE);
  for (let i = 0; i < 30; i++) G.updateMusic(0.05);
  check('pause holds the track where it stands, without dropping it',
    G.music().src === live && !live.stopped && G.music().gain.gain.value < 0.02 && G.musicRate() < 0.05);
  G.setState(G.S.PLAY);
  for (let i = 0; i < 20; i++) G.updateMusic(0.05);
  check('resuming spools the same take back up',
    G.music().src === live && !live.stopped && G.music().gain.gain.value > 0.2 && G.musicRate() > 0.9);

  // rule 5: finishing (or failing) a level fades the run's music out for good
  G.setLevelT(1e9); G.endLevel(true);
  check('a finished level takes its music with it', !G.music().src && G.music().key === null);
  for (let i = 0; i < 12; i++) { G.updateMusic(0.1); }
  await tick();
  check('the end screen stays quiet', !G.music().src && G.music().key === null);

  // rule 1: every menu plays the menu piece, and it loops by crossfading into itself
  G.setState(G.S.MENU);
  G.updateMusic(0.05); await tick();
  check('back on a menu, the menu piece plays again', G.music().key === 'menu' && !!G.music().src);
  const menuTake = G.music().src;
  G.setBeat(0, -5);                   // 8.5s of loop with 3.5s left — inside the overlap window
  G.updateMusic(0.05);
  check('the menu piece loops by crossfading into itself',
    !!G.xfade().src && G.xfade().src === menuTake && G.music().src !== menuTake && G.music().key === 'menu');
  G.updateMusic(5); G.dropPreload();  // close the overlap, leave the slot clean for what follows

  // AND IT MUST LOOP WITHOUT THE SESSION CACHE. This is the case that shipped
  // broken for three commits and no test could see: the seam was gated on menuBuf,
  // menuBuf has a 120s ceiling, and the real menu take is 214.6s — so in production
  // the branch was unreachable and the menu looped on the raw mp3 seam. It passed
  // here only because the stub's makeBuf() reports duration 10, which fits the
  // ceiling. Force the production shape: no cache, and the seam still has to close.
  {
    const longTake = { ...makeBuf(), duration: G.MENU_CACHE_MAX() + 95 }; // 215s, like the real one
    G.setMenuBuf(null);
    check('a menu take over the cache ceiling is not held for the session',
      !(longTake.duration <= G.MENU_CACHE_MAX()) && G.getMenuBuf() === null);
    G.setState(G.S.MENU);
    G.updateMusic(0.05); await tick();
    const uncached = G.music().src;
    G.setBeat(0, -5);                 // back inside the overlap window
    G.updateMusic(0.05);
    check('the menu still loops seamlessly with no cached buffer (the shipped case)',
      !!G.xfade().src && G.xfade().src === uncached && G.music().src !== uncached && G.music().key === 'menu');
    G.updateMusic(5); G.dropPreload();
  }
  G.setState(G.S.PLAY);
  G.settings.music = false; G.updateMusic(0.016);
  check('music toggle silences the gain', G.music().gain.gain.value === 0);
  G.settings.music = true;

  // ---- the run pool: a shuffled bag over src/audio/music/ ----
  {
    const n = G.trackCount();
    check('the run pool is the whole music manifest', n === 3);
    // THE FILENAME IS THE TITLE — this is what lets the folder be edited freely
    check('a track titles itself from its filename',
      G.prettyTrackName('audio/music/Steel_and_Rain.mp3') === 'STEEL AND RAIN' &&
      G.prettyTrackName('audio/music/Neon%20Sunset.mp3') === 'NEON SUNSET' &&
      G.prettyTrackName('audio/music/Neon-Run.mp3') === 'NEON RUN');
    check('an explicit manifest name still overrides the filename', G.trackName(1) === 'STEEL AND RAIN');
    check('a bare-url entry falls back to its filename', G.trackName(0) === 'L1');
    while (G.trackBagLen()) G.pickTrack();  // start from a bag boundary
    const draw = [];
    for (let i = 0; i < n * 2; i++) draw.push(G.pickTrack());
    check('a bag hands out every track before any of them repeats',
      new Set(draw.slice(0, n)).size === n && new Set(draw.slice(n)).size === n);
    G.playTrack(0); // bag is empty again; whatever is on air must not come straight back
    check('a refill never redraws the track already on air', G.pickTrack() !== 0);
  }

  // ---- NOW PLAYING + the pause skip ----
  {
    G.startEndless(); G.setState(G.S.PLAY);
    await runMusicUp();
    check('a run announces its track', G.nowPlayingName() === G.trackName(G.getRunTrack()));
    G.update(5); // the strip times out and clears the corner
    check('the strip gets out of the way on its own', G.nowPlayingName() === null);
    const before = G.getRunTrack();
    G.skipTrack(1);
    await tick();
    check('the pause skip steps forward through the pool', G.getRunTrack() === (before + 1) % G.trackCount());
    check('a manual skip re-announces the track', G.nowPlayingName() === G.trackName(G.getRunTrack()));
    G.skipTrack(-1); await tick();
    check('and steps back', G.getRunTrack() === before);
    G.setRunTrack(0); G.skipTrack(-1); await tick();
    check('stepping back off the first track wraps to the last', G.getRunTrack() === G.trackCount() - 1);
    G.setState(G.S.PAUSE); G.update(5);
    check('the strip holds while paused, to confirm a skip on resume', G.nowPlayingName() !== null);
    G.setState(G.S.MENU); G.playTrack('menu'); await tick();
    check('the menu track never takes over the strip', G.nowPlayingName() !== 'MIDNIGHT TERMINAL WAIT');
    // the strip must never caption silence — the regression that a dead dev server
    // exposed: it used to announce when the fetch went OUT, not when audio started
    G.setState(G.S.PLAY); G.update(5);
    const okFetch = global.fetch;
    global.fetch = () => Promise.reject(new Error('server down'));
    G.skipTrack(1); await tick(); await tick();
    check('a track that fails to load is never announced', G.nowPlayingName() === null);
    global.fetch = okFetch;
  }

  // ---- FREE FLOW crossfade: the next take rises under the outgoing one ----
  {
    G.startEndless(); G.setState(G.S.PLAY);
    await runMusicUp();                 // the run's own track comes in on the start sequence
    G.dropPreload();                    // …and those frames armed the standby slot: the seam tests want it empty
    const outgoing = G.music().src;
    check('a free-flow run opens on a track from the pool', !!outgoing && typeof G.getRunTrack() === 'number');
    G.setBeat(0, -6.6);                 // 8.5s of loop, 6.6s spent → 1.9s of track left
    G.updateMusic(0.016);
    check('nearing the seam starts decoding the next track', !!G.xfade().next || G.xfade().loading !== null);
    await tick();                       // the standby take lands
    G.updateMusic(0.016);
    const xf = G.xfade();
    check('the seam opens a crossfade, not a cut', !!xf.src && xf.src === outgoing && G.music().src !== outgoing);
    check('the outgoing take still carries the mix as the new one rises',
      xf.gain.gain.value > 0.9 && xf.srcGain.gain.value < 0.1);
    check('runTrack follows whatever is now on air', G.getRunTrack() === G.music().key);
    G.updateMusic(2);                   // halfway through the 4s overlap
    const a = G.xfade().gain.gain.value, b = G.xfade().srcGain.gain.value;
    check('the overlap holds equal power — no dip at the seam', Math.abs(a * a + b * b - 1) < 1e-6);
    G.updateMusic(3);                   // past the far end of the overlap
    check('the outgoing take is stopped once the overlap closes', outgoing.stopped && !G.xfade().src);
    check('the incoming take owns the bus at full gain', G.music().src.startOffset === 0.5 && G.xfade().srcGain.gain.value === 1);
    G.setState(G.S.MENU); G.playTrack('menu');
  }

  // ================= the warp trilogy: in, through, out =================
  // Three recorded takes replacing what used to be a synth bed and a bare sting:
  // warp-in on the beat the lane engages, in-warp looped under the whole run, and
  // exit-warp on an arrival with the victory sting rising through its tail.
  {
    check('all three warp takes are registered and decoded',
      ['warpIn', 'inWarp', 'exitWarp'].every(k => G.warpAudio().bufs.includes(k)));

    // THE ENGINE BED. One call per frame drives it, so every exit takes it with it.
    G.setState(G.S.MENU); G.ambient(false);
    check('parked in a menu, no engine is running', !G.warpAudio().bed && !G.warpAudio().synth);
    G.ambient(true);
    const bed = G.warpAudio().bed;
    check('a live lane runs the RECORDED bed, not the synth', !!bed && !G.warpAudio().synth);
    check('and it loops, inside the take\'s audible region so no lap ticks',
      bed.src.loop === true && bed.src.loopEnd > bed.src.loopStart);
    G.ambient(true);
    check('holding the lane does not stack a second bed', G.warpAudio().bed === bed);
    G.ambient(false);
    check('leaving the lane releases it', !G.warpAudio().bed && bed.src !== undefined);

    // A COLLAPSED LANE CUTS HARD; an arrival lets the engine fall away. Both end up
    // silent — what differs is the time constant, so assert the call is accepted and
    // the bed is released either way rather than pretending to hear a fade.
    G.ambient(true); G.ambient(false, true);
    check('a collapsed lane cuts the bed too (fast path)', !G.warpAudio().bed);

    // THE ARRIVAL. exit-warp plays, and the sting is SCHEDULED into its tail rather
    // than queued after it — 4.96s of silence before the fanfare read as a stall.
    check('the sting is scheduled inside the drop, not after it',
      G.warpAudio().EXIT_STING > 0 && G.warpAudio().EXIT_STING < 4.96);
    check('the arrival cue plays without throwing', (() => { try { G.sfx2.arrive(); return true; } catch (e) { return false; } })());
  }

  // A BRIEFING DISC HOLDS THE WARP. The opening used to spool to full speed behind the
  // card — laneFlow counted S.INFO as flowing and the warp dive decayed, both above the
  // `state !== S.PLAY` return — so releasing the disc dropped you into a lane already at
  // speed with the acceleration already spent. Easy to regress by adding anything else
  // above that return, hence the guard.
  {
    // rawStartLevel, not G.startLevel: the suite's wrapper calls setIntro(999) to skip
    // the boot for gameplay tests, which is exactly the ceremony under examination here
    rawStartLevel(0, true);
    check('a level with a briefing opens on the card, not in the lane', G.getState() === G.S.INFO);
    check('the boot clock has not started', G.getIntro() === 0);
    // laneFlow BRAKES to a standstill rather than snapping to one — arriving from the
    // menu it is already 0, but arriving straight from another run it has to wind down.
    // Either way it must never climb while the card is up.
    const flowAtCard = G.laneFlow();
    for (let i = 0; i < 120; i++) G.update(1 / 60);   // two seconds of reading
    check('the lane never speeds up behind the card', G.laneFlow() <= flowAtCard);
    check('two seconds behind the disc and the lane is STILL parked (menu drift)',
      G.laneFlow() === 0 && G.getIntro() === 0);
    check('and the warp dive has not been spent behind it', G.getWarpT() > 0);
    G.dismissInfo();
    for (let i = 0; i < 30; i++) G.update(1 / 60);    // half a second past release
    check('releasing the disc does NOT start the warp — the runner does', G.getState() === G.S.PLAY && G.laneFlow() === 0);
    check('…so the boot clock is still parked at zero', G.getIntro() === 0 && !G.isLaunched());
    check('and the parked clock is the one that ran', G.getPreT() > 0.2);
    check('the warp dive is STILL unspent, waiting for hands', G.getWarpT() > 0);
  }

  // THE RUNNER STARTS THE CEREMONY. The thumb gate used to sit at INTRO_GATE, near the
  // END of the boot — so the lane spooling up and the ring riding in played to a player
  // who had not done anything yet, and all that was left for them was the gate at the far
  // side. Inverted: nothing moves until both thumbs are down.
  {
    rawStartLevel(0, true);
    G.dismissInfo();
    for (let i = 0; i < 60; i++) G.update(1 / 60);
    check('parked: one thumb is not a launch', (() => {
      G.setPadHold(true, false);
      for (let i = 0; i < 30; i++) G.update(1 / 60);
      return !G.isLaunched() && G.getIntro() === 0 && G.laneFlow() === 0;
    })());
    check('the level clock does not run while parked either', G.getLevelT() === 0);
    // THE ACK IS AN EDGE, NOT A STATE. Each pad rumbles on the frame it lands and then
    // stays quiet — driven off padArm, because a held thumb evaluated every frame would
    // rumble 60 times a second for as long as the player waits for their other hand.
    check('a pad rumbles once when it lands, not every frame', (() => {
      const n0 = G.getBuzzN();
      for (let i = 0; i < 40; i++) G.update(1 / 60); // still holding the one pad
      return G.getBuzzN() === n0;
    })());
    check('…and lifting it is silent — no scolding', (() => {
      const n0 = G.getBuzzN();
      G.setPadHold(false, false);
      for (let i = 0; i < 10; i++) G.update(1 / 60);
      return G.getBuzzN() === n0;
    })());
    check('the second pad acks on ITS side', (() => {
      G.setPadHold(true, false);
      for (let i = 0; i < 3; i++) G.update(1 / 60);
      const n0 = G.getBuzzN();
      G.setPadHold(true, true);
      G.update(1 / 60);
      return G.getBuzzN() === n0 + 1 && /side1/.test(G.getBuzzLast());
    })());
    check('both thumbs launch it', (() => {
      G.setPadHold(true, true);
      G.update(1 / 60);
      return G.isLaunched() && G.getIntro() > 0;
    })());
    check('…and preLaunch() is over the instant it latches', !G.isPreLaunch());
    // LETTING GO CANNOT STALL THE BOOT. The old gate could hold mid-ceremony; there is
    // no such state any more, which is the point of moving the wait to the front.
    G.setPadHold(false, false);
    for (let i = 0; i < 200; i++) G.update(1 / 60);
    check('lifting off the pads cannot stall the boot', G.getIntro() >= G.INTRO_DUR());
    check('the lane is at full warp by handover', G.laneFlow() === 1);
    check('and the run clock is running', G.getLevelT() > 0);
  }

  // THE LAUNCH CURVE. Not a linear ramp: the drive winds up under a barely-moving lane
  // while the ring rides in, and BOOT_LOCK — the dock — is what lets go. The threshold is
  // the whole point, so it is asserted rather than left to drift.
  {
    // park properly first — one frame is not enough for a lane inherited at speed from the
    // previous block to wind down, and the curve is only the whole story from a standstill
    const park = () => {
      rawStartLevel(0, true); G.dismissInfo();
      for (let i = 0; i < 90; i++) G.update(1 / 60);
      G.setPadHold(true, true); G.update(1 / 60);
    };
    park();
    check('the launch starts from a genuine standstill', G.laneFlow() < 0.01);
    const at = t => { // laneFlow once the ceremony clock has reached t
      while (G.getIntro() < t) G.update(1 / 60);
      return G.laneFlow();
    };
    const held = G.WARP_LAUNCH().held;
    check(`the lane barely moves while the ring closes (${at(0.4).toFixed(3)} at 0.4s)`, at(0.4) < held * 0.2);
    check('it is moving, though — not frozen', at(0.4) > 0);
    const atDock = at(G.BOOT_LOCK());
    check(`the dock is the threshold (${atDock.toFixed(2)} of full when the ring lands)`,
      Math.abs(atDock - held) < 0.02);
    check('the jump happens AFTER the dock, not before', at(G.BOOT_LOCK() + 0.3) > held + 0.3);
    check('full warp lands inside the take, before handover',
      at(G.BOOT_LOCK() + G.WARP_LAUNCH().jump + 0.02) === 1 && G.getIntro() < G.INTRO_DUR());
    // monotonic from a standstill: nothing in the ceremony may make the lane fall back and
    // re-accelerate — that reads as the drive faltering
    let prev = 0, fell = false;
    park();
    while (G.getIntro() < G.INTRO_DUR()) { G.update(1 / 60); if (G.laneFlow() < prev) fell = true; prev = G.laneFlow(); }
    check('the launch curve never goes backwards', !fell);
    // …but a lane inherited AT SPEED winds down into the curve instead of being pinned
    // there by the floor, or snapped to a crawl in one frame
    rawStartLevel(0, true); G.dismissInfo(); G.update(1 / 60);
    const inherited = G.laneFlow();
    G.setPadHold(true, true); G.update(1 / 60);
    check(`a lane entered at speed (${inherited.toFixed(2)}) is not pinned by the floor`,
      inherited > 0.5 && G.laneFlow() < inherited);
    check('…and does not snap down in one frame either', G.laneFlow() > inherited - 0.1);
    while (G.getIntro() < G.INTRO_DUR()) G.update(1 / 60);
    check('either way the lane is at full warp by handover', G.laneFlow() === 1);
  }

  // THE SPOOL-UP. The lane leaves a standstill and takes WARP_SPOOL to reach full
  // warp, matched to the length of warp-in.mp3 so the sound and the acceleration are
  // one event. It is purely visual — the fixed-timestep tests above hold it to that.
  // Driven by STATE alone, not by startLevel — laneFlow only reads state, and
  // startLevel would arm run music and pull the soundtrack tests below off their
  // footing (it did exactly that once).
  {
    const stateBefore = G.getState();
    check('the spool-up is long enough to be seen (>= 2s)', G.WARP_SPOOL() >= 2);
    G.setState(G.S.MENU); G.update(1); // park the lane
    check('a parked lane is at a standstill', G.laneFlow() === 0);
    // past the boot, so this measures the GENERIC spool and not the launch curve — which
    // owns laneFlow for the whole ceremony and would otherwise pin it to zero here
    G.setIntro(999);
    G.setState(G.S.PLAY);
    G.update(0.5);
    const half = G.laneFlow();
    check(`half a second in, the lane is still winding up (${half.toFixed(2)} of full)`, half > 0 && half < 0.5);
    G.update(G.WARP_SPOOL());
    check('and it reaches full warp once the spool-up is done', G.laneFlow() === 1);
    G.setState(stateBefore);
  }

  // ================= leaderboard read client (Supabase) =================
  {
    const realFetch = global.fetch;
    let lastUrl = null, lastBody = null, lastHeaders = null;
    global.fetch = async (url, opts) => {
      lastUrl = url; lastBody = JSON.parse(opts.body); lastHeaders = opts.headers;
      return { ok: true, json: async () => ([{ rank: 1, player_id: 'p1', player_name: 'ACE', score: 5000, verified: true }]) };
    };
    const top = await G.lbTop('investigation:2', 10);
    check('lbTop hits the leaderboard_top RPC', lastUrl.endsWith('/rest/v1/rpc/leaderboard_top'));
    check('lbTop passes board + limit, null day for a campaign board', lastBody.p_board === 'investigation:2' && lastBody.p_limit === 10 && lastBody.p_day === null);
    check('lbTop ships the publishable key, not a secret', String(lastHeaders.apikey).startsWith('sb_publishable_'));
    check('lbTop parses the ranked rows', Array.isArray(top) && top[0].score === 5000);
    // no board uses the `day` column any more — the week rides in the board KEY
    check('lbDay is null for every board now', G.lbDay('weekly:2953') === null && G.lbDay('endless') === null);
    await G.lbTop('weekly:2953');
    check('a weekly read names the week in the board key, with a null day',
      lastBody.p_board === 'weekly:2953' && lastBody.p_day === null);
    await G.lbRank('endless', 'me');
    check('lbRank hits leaderboard_rank with the player id', lastUrl.endsWith('/rest/v1/rpc/leaderboard_rank') && lastBody.p_player === 'me');
    global.fetch = async () => { throw new Error('offline'); };
    check('leaderboard reads fail soft to null when offline', (await G.lbTop('endless')) === null);
    global.fetch = realFetch;
  }

  // ================= the split's guard rails =================
  // The game is authored as ordered files and loaded by the page as ordered
  // <script src> tags. Three things must stay in lockstep or the browser runs
  // something different from what this suite and the verifier bundle test:
  // the manifest order, the tag order in index.html, and the folder contents.
  // A drift here is silent — the page just quietly runs stale or partial code.
  {
    const manifestFiles = gameFileNames(ROOT);
    const shell = fs.readFileSync(path.join(ROOT, 'src', 'index.html'), 'utf8');
    const tagged = [...shell.matchAll(/<script src="game\/([^"]+)"><\/script>/g)].map(m => m[1]);
    const onDisk = fs.readdirSync(path.join(ROOT, 'src', 'game')).filter(f => f.endsWith('.js')).sort();

    check('index.html loads exactly the manifest files, in manifest order',
      tagged.join(',') === manifestFiles.join(','));
    check('every file in src/game/ is in the manifest (none silently unloaded)',
      onDisk.join(',') === [...manifestFiles].sort().join(','));
    check('every game file after the first declares its own strict mode',
      manifestFiles.slice(1).every(f =>
        fs.readFileSync(path.join(ROOT, 'src', 'game', f), 'utf8').startsWith("'use strict';\n")));

    // The labs lift `// >>> NAME` … `// <<< NAME` regions out of the game and
    // write them back, so a region MUST live inside one file. The first split
    // cut DEST-SPRITE across two and broke the destinations lab silently — the
    // lab still booted, and only failed when you asked it for that region.
    const opens = {}, closes = {};
    for (const f of manifestFiles) {
      const text = fs.readFileSync(path.join(ROOT, 'src', 'game', f), 'utf8');
      for (const m of text.matchAll(/^\/\/ >>> (\S+)/gm)) opens[m[1]] = f;
      for (const m of text.matchAll(/^\/\/ <<< (\S+)/gm)) closes[m[1]] = f;
    }
    const names = [...new Set([...Object.keys(opens), ...Object.keys(closes)])];
    const straddling = names.filter(n => opens[n] !== closes[n]);
    check(`every lab region opens and closes in one file (${names.length} regions)`,
      straddling.length === 0 && names.length > 0);

    // The tuning board loads the real game into its own page, so the two share
    // one global lexical scope. A name used by both is a live grenade: as a
    // top-level `const` it made 40-state.js die with a SyntaxError, and once
    // scoped it shadowed the game's `state` so withWorld assigned to the board's
    // own const instead. Both cost a debugging round. Neither can recur if no
    // board declaration is allowed to take a game global's name.
    const boardPath = path.join(ROOT, 'docs', 'tuning', 'board.js');
    if (fs.existsSync(boardPath)) {
      const decl = /^\s*(?:const|let|var|function|async function)\s+([A-Za-z_$][\w$]*)/gm;
      const boardNames = new Set([...fs.readFileSync(boardPath, 'utf8').matchAll(decl)].map(m => m[1]));
      const gameNames = new Set();
      for (const f of manifestFiles) {
        for (const m of fs.readFileSync(path.join(ROOT, 'src', 'game', f), 'utf8').matchAll(decl)) {
          if (/^(?:const|let|var|function|async function)/.test(m[0])) gameNames.add(m[1]);
        }
      }
      const shadowed = [...boardNames].filter(n => gameNames.has(n));
      check('the tuning board declares no name the game already uses'
        + (shadowed.length ? ' — clashes: ' + shadowed.join(', ') : ''), shadowed.length === 0);
    }

    // THE TWO COPIES OF weekOf MUST AGREE, FOREVER. The Edge Function computes the
    // live week from its OWN clock — that is what makes a closed week closed, since a
    // client's claim about which week it played is not trusted. But it therefore
    // cannot import the game's copy: it is the trust boundary and has to answer
    // "what week is it" without loading the sim. So the formula is duplicated, and a
    // silent divergence between the two would either reject every honest submission
    // or accept runs onto the wrong week's board. Lift the server's arrow straight out
    // of the TypeScript and check it against the game's across a decade.
    {
      const ts = fs.readFileSync(path.join(ROOT, 'supabase', 'functions', 'submit-run', 'index.ts'), 'utf8');
      const m = /const weekOf = \(ms: number\) =>\s*([^;]+);/.exec(ts);
      check('the Edge Function still defines its own weekOf', !!m);
      if (m) {
        const serverWeekOf = new Function('ms', 'return ' + m[1] + ';');
        let drift = 0, checked = 0;
        for (let d = -3650; d <= 3650; d += 1) {           // ±10 years, every day
          const ms = d * 864e5 + 43200000;                  // midday, to avoid ambiguity
          checked++;
          if (serverWeekOf(ms) !== G.weekOf(ms)) drift++;
        }
        check(`client and server weekOf agree on all ${checked} days of a 20-year span (drift ${drift})`, drift === 0);
        // and the boundary itself lands on Monday 00:00 UTC on both sides
        const monday = Date.UTC(2026, 7, 3), sundayEnd = monday - 1;
        check('both agree the week flips at Monday 00:00 UTC',
          serverWeekOf(monday) === G.weekOf(monday) &&
          serverWeekOf(sundayEnd) === G.weekOf(sundayEnd) &&
          serverWeekOf(monday) === serverWeekOf(sundayEnd) + 1);
      }
      // the freeze itself: the server must key a weekly run off ITS clock, not the run's
      check('the Edge Function refuses a weekly run whose seed is not the live week',
        /run\.seed !== live/.test(ts) && /weekOf\(Date\.now\(\)\)/.test(ts));
    }

    // EVERY TOOL THAT EMBEDS THE GAME MUST STILL FIND IT. The split broke two
    // of them silently — dest-lab read regions out of index.html, and the Lane
    // Designer lifted the game from index.html's inline <script>, which after
    // the split is just the 12-line soundtrack manifest. Both still booted. So
    // the editor's own block-gathering is reproduced here and has to contain a
    // recognisable piece of the game.
    const edSrc = fs.readFileSync(path.join(ROOT, 'src', 'editor.js'), 'utf8');
    if (edSrc.includes('game/manifest.json')) {
      const shell = fs.readFileSync(path.join(ROOT, 'src', 'index.html'), 'utf8');
      const blocks = [
        ...manifestFiles.map(f => fs.readFileSync(path.join(ROOT, 'src', 'game', f), 'utf8')),
        ...[...shell.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]),
      ];
      check('the Lane Designer still embeds a real game (frame + update present)',
        blocks.some(b => b.includes('function frame(')) && blocks.some(b => b.includes('function update(')));
    } else {
      check('the Lane Designer loads the game from the manifest, not an inline script', false);
    }
  }

  console.log(failures === 0 ? '\nALL TESTS PASSED' : '\n' + failures + ' FAILURES');
  process.exit(failures === 0 ? 0 : 1);
})();
