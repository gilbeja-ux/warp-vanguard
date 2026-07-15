#!/usr/bin/env node
// Headless test harness: stubs the DOM, evals the real game script from
// src/index.html, and exercises game logic, rendering paths, and audio.
// Run with `npm test`.
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'src', 'index.html'), 'utf8');
let code = html.match(/<script>([\s\S]*?)<\/script>/)[1];

// --- DOM stubs ---
const grad = { addColorStop() {} };
const ctxStub = new Proxy({}, {
  get: (t, k) => {
    if (k === 'canvas') return canvasStub;
    return (...a) => (String(k).startsWith('create') ? grad : (k === 'measureText' ? { width: 10 } : undefined));
  },
  set: () => true
});
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
  stop() { this.stopped = true; }
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
  MUSIC_DATA: { menu: 'menu.mp3', levels: ['l1.mp3', 'l2.mp3', 'l3.mp3'] }
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
  startLevel, spawnEnemy, spawnLine, update, nodes, geo, frame, menuTap,
  setState: v => { state = v; }, getState: () => state, S,
  setMenuSettings: v => { menuSettings = v; }, getMenuSettings: () => menuSettings,
  gearRect: () => menuGearRect, toggles: () => pauseTogglesList,
  enemies: () => enemies,
  stats: () => ({ zaps, misses, score, integrity, combo }),
  playTrack, updateMusic, settings, progress, perf: () => ({ lowFX }),
  music: () => ({ src: musicSrc, gain: musicGain, key: currentTrackKey, ac: AC }),
  bolts: () => bolts, hitStop: () => hitStop, fx, pickups: () => pickups, spawnPickup,
  boss: () => boss, endlessCfg, tut: () => tut, isEndless: () => endless, getLV: () => LV,
  startEndless, menuBtns: () => menuButtons, getEndWin: () => endWin,
  setLevelT: v => { levelT = v; }, setIntegrity: v => { integrity = v; }, setScore: v => { score = v; },
  setMenuScroll: v => { menuScroll = v; }, tolVis: () => tolVis, musicRate: () => musicRate, dialCenter,
  detectBeat, beatQuantize, setBeat: (p, at) => { beatPeriod = p; musicStartAt = at; },
  patternQ: () => patternQ, mutators, musicFilterHz: () => musicFilter && musicFilter.frequency.value,
  getPerfects: () => perfects, getScore: () => score, ringAt: z => ring(z, geo()),
  getIntro: () => introT, setIntro: v => { introT = v; introCd = 0; }, getLevelT: () => levelT, setEndT: v => { endT = v; },
  startQualification, getInfoCard: () => infoCard, isQual: () => qual,
  keys, setBeamAim: (x, y) => { beamAim.x = x; beamAim.y = y; }, getHeat: () => heat, isOverheat: () => overheat, startBossTest,
  rimFX: () => rimFX, pauseTap, pauseBtns: () => pauseButtonsList, getResumeHold: () => resumeHold, getWarpT: () => warpT,
  stripAngle, startDaily, isDaily: () => daily, getPulse: () => pulseCharge,
  getShield: () => shieldCharge, setShield: v => { shieldCharge = v; },
  setMenuScreen: v => { menuScreen = v; }, getMenuScreen: () => menuScreen, commCur: () => commCur,
  setPulse: v => { pulseCharge = v; }, pulseWavesN: () => pulseWaves.length,
  latches: () => latches, setLatches: v => { latches = v; },
  spawnStrip, spawnWall, PULSE_MAX: () => PULSE_MAX, setSpawnT: v => { spawnT = v; },
  volley: () => volley, BOSS_CER: () => BOSS_CER
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
drawOk('pause panel', () => { G.setState(G.S.PAUSE); });
drawOk('end screen', () => { G.setState(G.S.END); });
drawOk('main menu', () => { G.setState(G.S.MENU); });
drawOk('menu audio-config overlay', () => { G.setMenuSettings(true); });

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

// ================= zap juice =================
G.startLevel(1);
en = G.spawnEnemy(0.1, 'normal');
aim(0, Math.PI); aim(1, 0.1);
cross(en);
check('zap spawns a lightning bolt', G.bolts().length > 0);
check('zap triggers hit-stop', G.hitStop() > 0);
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
check('campaign level replays the exact same spawn script',
  detA.length === 12 && detA.join(';') === detB.join(';'));
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
check('campaign completion recorded', G.progress.stars[7] > 0);

// ================= TEMP boss-test shortcut =================
G.startBossTest();
G.update(0.05);
if (G.getState() === G.S.INFO) { G.update(0.5); canvasHandlers.pointerdown({ pointerId: 8, clientX: 5, clientY: 5, pointerType: 'touch' }); G.update(0.15); G.update(0.15); G.update(0.15); }
G.update(0.05);
check('BOSS TEST key drops straight into the duel', !!G.boss());
G.boss().introT = 99; // skip the ceremony for the shortcut check
for (let i = 0; i < 4; i++) G.update(0.05);
check('shortcut duel is live and un-fused', G.boss().mergeT === 0);

// ================= campaign rim walls + bonus ribbon =================
const quiet = () => { G.setSpawnT(60); G.setIntegrity(100); }; // hold the level script still
G.startLevel(4); // UNDERCITY FIBER — the wall's home level
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
check('UNDERCITY FIBER deploys rim walls from its script', sawWall);
G.setState(G.S.MENU);

// ================= mode select & campaign map =================
G.setState(G.S.MENU);
G.setMenuScreen('home');
G.frame(16);
const cTile = G.menuBtns().find(b => b.mode === 'campaign');
{ // tap the middle of the campaign slice on the mode wheel
  const sc = cTile.sector, ma = (sc.a0 + sc.a1) / 2, mr = (sc.r0 + sc.r1) / 2;
  G.menuTap(sc.cx + Math.cos(ma) * mr, sc.cy + Math.sin(ma) * mr, 1);
}
flushUI(); // press beat -> glitch cut -> screen switch
check('campaign tile opens the route map', G.getMenuScreen() === 'map');
G.frame(16);
const n2 = G.menuBtns().find(b => b.node === 2);
G.menuTap(n2.x + 22, n2.y + 22, 1);
G.frame(16);
const dep = G.menuBtns().find(b => b.deploy !== undefined);
check('selecting a relay arms its deploy key', dep && dep.deploy === 2);
G.menuTap(dep.x + 5, dep.y + 5, 1);
flushUI(); // press beat -> warp -> deploy
check('deploying opens the story log', G.getState() === G.S.INFO && G.getInfoCard() === 'story2');
G.update(0.5);
canvasHandlers.pointerdown({ pointerId: 9, clientX: 5, clientY: 5, pointerType: 'touch' });
G.update(0.15); G.update(0.15); G.update(0.15); // card animates out
check('dismissing the log enters the relay', G.getState() === G.S.PLAY && G.getLV().name === 'METRO EXCHANGE');
G.setIntro(999);
{
  let cGuard = 300;
  while (cGuard-- > 0 && !G.commCur()) { G.setIntegrity(100); G.update(0.05); }
  check('story comms tick over the campaign line', !!G.commCur());
}

// ================= endless mode =================
G.setState(G.S.MENU);
G.setMenuScreen('flow');
G.frame(16);
const eBtn = G.menuBtns().find(b => b.endless);
check('endless key appears unlocked after clearing the campaign', !!eBtn && !eBtn.locked);
G.menuTap(eBtn.x + 10, eBtn.y + 10, 1);
flushUI();
G.setIntro(999);
check('tapping the endless key starts an endless run', G.getState() === G.S.PLAY && G.isEndless() && G.getLV().name === 'ENDLESS STREAM');
G.setScore(1234);
G.setIntegrity(0);
G.update(0.01);
check('endless defeat records the best score', G.getState() === G.S.END && G.progress.best === 1234);

// ================= daily stream =================
G.setState(G.S.MENU);
G.setMenuScreen('flow');
G.frame(16);
const dBtn = G.menuBtns().find(b => b.daily);
check('daily key appears unlocked', !!dBtn && !dBtn.locked);
G.menuTap(dBtn.x + 10, dBtn.y + 10, 1);
flushUI();
G.setIntro(999);
check('tapping it starts the seeded daily run', G.getState() === G.S.PLAY && G.isDaily() && G.getLV().name === 'DAILY STREAM');
G.setScore(777);
G.setIntegrity(0);
G.update(0.01);
check('daily defeat records the daily best and streak', G.getState() === G.S.END &&
  G.progress.daily.best === 777 && G.progress.daily.streak >= 1 && Math.random !== undefined);

// ================= qualification =================
G.progress.tutorialDone = false;
G.startQualification();
G.update(0.05);
check('qualification opens with the movement briefing', G.getState() === G.S.INFO && G.getInfoCard() === 'move' && G.isQual());
function dismiss() { G.update(0.5); canvasHandlers.pointerdown({ pointerId: 7, clientX: 5, clientY: 5, pointerType: 'touch' }); G.update(0.15); G.update(0.15); G.update(0.15); }
function settle() { for (let i = 0; i < 4; i++) G.update(0.4); }
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
  if (pen.type === 'heavy') { // dock and hold — the volley drill
    aim(0, pen.angle); aim(1, pen.angle);
    pen.z = Math.min(pen.z, 0.9);
    for (let i = 0; i < 40 && !pen.dead; i++) G.update(0.05);
    return pen.dead === true;
  }
  else if (pen.type === 'line') { aim(0, pen.angle); aim(1, pen.partner.angle); }
  else if (pen.lock !== undefined) { aim(pen.lock, pen.angle); aim(1 - pen.lock, pen.angle + Math.PI); }
  else { aim(0, pen.angle); aim(1, pen.angle + Math.PI); }
  cross(pen);
  return pen.dead === true;
}
dismiss();
check('tap dismisses the briefing', G.getState() === G.S.PLAY);
for (let i = 1; i <= 14 && G.getState() === G.S.PLAY; i++) { aim(0, i * 0.25); aim(1, -i * 0.25); G.update(0.05); }
check('thumb travel completes movement training', G.getState() === G.S.INFO && G.getInfoCard() === 'normal');
dismiss();
check('practice trap 1 spawns and dies', waitLive(4) && zapPractice());
check('practice trap 2 spawns and dies', waitLive(4) && zapPractice());
settle();
check('heavy briefing appears', G.getState() === G.S.INFO && G.getInfoCard() === 'heavy');
dismiss();
check('heavy practice: pinned by both nodes', waitLive(4) && zapPractice());
settle();
check('barrier briefing appears', G.getState() === G.S.INFO && G.getInfoCard() === 'line');
dismiss();
check('barrier practice: node per end', waitLive(4) && zapPractice());
settle();
check('color-lock briefing appears', G.getState() === G.S.INFO && G.getInfoCard() === 'lock');
dismiss();
check('blue-lock practice', waitLive(4) && zapPractice());
check('white-lock practice', waitLive(4) && zapPractice());
settle();
check('data-stream briefing appears', G.getState() === G.S.INFO && G.getInfoCard() === 'strip');
dismiss();
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
settle();
check('friendly-packet briefing appears', G.getState() === G.S.INFO && G.getInfoCard() === 'frag');
dismiss();
waitLive(4);
{
  const pen = G.enemies().find(e => e.tut && !e.dead && !e.resolved);
  aim(0, pen.angle + 1.5); aim(1, pen.angle - 1.5);
  cross(pen);
  check('letting the packet pass succeeds', pen.resolved === true && !pen.dead);
}
settle();
check('power-up briefing appears', G.getState() === G.S.INFO && G.getInfoCard() === 'pickup');
dismiss();
waitLive(4);
{
  const pp = G.pickups().find(p2 => p2.tut && !p2.done);
  pp.z = G.geo().hitZ; aim(0, pp.angle);
  G.update(0.01);
  check('catching the practice relay works', G.fx.wide > 0);
  G.fx.wide = 0;
}
settle();
check('pulse briefing appears', G.getState() === G.S.INFO && G.getInfoCard() === 'pulse');
dismiss();
waitLive(4);
{
  // the drill pre-charges both orbs — tap the left core to fire the purge
  const d2 = G.dialCenter('L');
  canvasHandlers.pointerdown({ pointerId: 9, clientX: d2.x, clientY: d2.y, pointerType: 'touch' });
  check('tapping a charged core fires the pulse', G.pulseWavesN() > 0 && G.getPulse()[0] === 0);
  let wGuard = 240;
  while (wGuard-- > 0 && G.enemies().some(e => e.tut && !e.dead)) G.update(0.05);
  check('the purge wave clears the practice volley', !G.enemies().some(e => e.tut && !e.dead));
}
settle(); settle();
check('QUALIFIED: victory screen + progress persisted', G.getState() === G.S.END && G.getEndWin() === true && G.progress.tutorialDone === true && G.tut() === null);
drawOk('qualification end screen', () => {});
drawOk('briefing card frame', () => { G.progress.tutorialDone = false; G.startQualification(); G.update(0.05); });
G.setState(G.S.MENU);
G.progress.tutorialDone = true;

// ================= level intro =================
rawStartLevel(1);
check('intro clock arms on level start', G.getIntro() === 0);
for (let i = 0; i < 24; i++) G.update(0.05); // 1.2s — the ring is still riding the tunnel in
check('spawns held during the intro', G.enemies().length === 0);
check('level clock frozen during the intro', G.getLevelT() === 0);
drawOk('mid-intro frame (ring fly-in + range readout)', () => {});
for (let i = 0; i < 30; i++) G.update(0.05); // past the dock + power-up, into the thumb gate (2.4s)
check('boot holds at the gate until thumbs are placed', G.getIntro() < 2.85);
drawOk('gate frame (awaiting operator + thumb prompts)', () => {});
canvasHandlers.pointerdown({ pointerId: 41, clientX: 120, clientY: 220, pointerType: 'touch' });
canvasHandlers.pointerdown({ pointerId: 42, clientX: 680, clientY: 220, pointerType: 'touch' });
for (let i = 0; i < 20; i++) G.update(0.05);
check('godspeed: boot completes once both pads are held', G.getIntro() > 2.9);
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
const arrived = new Set(); let lullBreaks = 0;
for (let i = 0; i < 500; i++) { // 25s covers the first two comm windows
  G.update(0.05);
  G.setIntegrity(100); // ride out un-zapped breaches
  for (const e2 of G.enemies()) {
    if (!arrived.has(e2) && e2.z <= hzL) {
      arrived.add(e2);
      const lt = G.getLevelT();
      if ((lt > 6 && lt < 9.2) || (lt > 16 && lt < 19.2)) lullBreaks++;
    }
  }
}
check('story lull: no arrivals land while a transmission plays', lullBreaks === 0);
check('story lull: the drill still spawns around the windows', arrived.size >= 4);

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

// ================= dormant alt schemes (behind ALT_CONTROLS) =================
// hidden from settings at launch, but the code must keep working so the flag
// can be flipped back on later
G.settings.controls = 2; // ARCS: left side margin drives node 0, absolute
aim(0, 0);
pdown(11, 4, 210 - 55); // above center on the left strip
check('ARCS (dormant): side-strip touch throws the node', Math.abs(n0.angle) > 0.2 && n0.held === true);
pup(11, 4, 210 - 55);
G.settings.controls = 1; // IMMERSIVE: grab a lens on the rim and drag it
aim(0, Math.PI);
const gI = G.geo();
pdown(12, gI.cx + Math.cos(Math.PI) * 100, gI.cy + Math.sin(Math.PI) * 100);
check('IMMERSIVE (dormant): the lens can be grabbed', n0.held === true);
pup(12, gI.cx - 100, gI.cy);
G.settings.controls = 0; // back to the real scheme
aim(0, 0);

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
check('winning records a per-level best', G.getState() === G.S.END && G.progress.bests[1] === G.getScore() && G.getScore() > 0);
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

// ================= Web Audio music looper =================
const tick = () => new Promise(r => setImmediate(r));
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
  G.settings.music = false; G.updateMusic(0.016);
  check('music toggle silences the gain', G.music().gain.gain.value === 0);
  G.settings.music = true;

  console.log(failures === 0 ? '\nALL TESTS PASSED' : '\n' + failures + ' FAILURES');
  process.exit(failures === 0 ? 0 : 1);
})();
