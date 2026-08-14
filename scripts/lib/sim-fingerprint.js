'use strict';
/*
 * THE BEHAVIOURAL FINGERPRINT — what a build DOES, not what it is made of.
 *
 * The old sim id was a sha256 of campaigns.js plus all 34 game files, so a
 * changed comment, a menu colour or a line of HUD text forced a verifier
 * redeploy and rejected every score until it happened. That is friction with no
 * safety in it, and it fired for real over a tutorial-only change.
 *
 * The tempting fix — hash only the "sim files" — is a trap. fireVolley(), which
 * kills enemies and awards score, lives in 85-enemy-art.js. Any hand-maintained
 * list of which files matter will eventually be wrong, and it fails in the
 * dangerous direction: the sim changes, the id does not, and the server replays
 * real runs against stale logic and calls them cheats.
 *
 * So the sim is asked instead of inspected. Every ranked board is played here,
 * headless, from its own seed, under a FIXED synthetic input trace, and what
 * comes out is hashed: every enemy that appeared, at what angle, in what order,
 * plus the final scoreboard. Two builds share a board's id exactly when they
 * would score that board identically — which is what the old file said it did
 * and only approximated.
 *
 *   art, music, menus, HUD, comments  ->  identical outcomes  ->  same id
 *   spawn rate, speed, scoring, waves ->  different outcome   ->  new id
 *   fireVolley edited inside an art file -> still caught
 *
 * PER BOARD, so a change to relay 3 invalidates relay 3 and nothing else.
 *
 * THE LIMIT, STATED PLAINLY: this can only see divergence the battery exercises.
 * A sim change on a path no board reaches would keep its id and then fail
 * verification confusingly — the very bug being designed out. That is why the
 * battery plays every ranked board for its FULL duration and records every
 * spawn rather than sampling, and why the driver moves the emitters and fires
 * pulses instead of idling: a run that never shoots cannot notice a change to
 * shooting.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { gameSource } = require('./game-source.js');

// The battery's own version. Bump it when the driver or the recorded signature
// changes shape — otherwise a cached fingerprint from an older battery would be
// reused against a newer one and silently compared against different evidence.
const BATTERY_V = 1;

// ---------- DOM / Web-API stubs (mirrors scripts/verify-run.js) ----------
function installStubs() {
  const grad = { addColorStop() {} };
  let canvasStub;
  const ctxStub = new Proxy({}, {
    get: (t, k) => {
      if (k === 'canvas') return canvasStub;
      return (...a) => (String(k).startsWith('create') ? grad : (k === 'measureText' ? { width: 10 } : undefined));
    },
    set: () => true
  });
  canvasStub = { width: 0, height: 0, style: {}, getContext: () => ctxStub, addEventListener() {}, setPointerCapture() {} };
  global.document = {
    getElementById: () => canvasStub,
    createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => ctxStub }),
    documentElement: {}, addEventListener() {}, hidden: false
  };
  const makeBuf = () => { const d = new Float32Array(10000); for (let i = 500; i < 9000; i++) d[i] = 0.5; return { sampleRate: 1000, length: 10000, duration: 10, getChannelData: () => d }; };
  class FakeGain { constructor() { this.gain = { value: 1, setValueAtTime() {}, exponentialRampToValueAtTime() {} }; } connect() {} disconnect() {} }
  class FakeSrc { constructor() { this.buffer = null; this.loop = false; this.loopStart = 0; this.loopEnd = 0; this.playbackRate = { value: 1 }; } connect() {} disconnect() {} start() { this.started = true; } stop() {} }
  class FakeAC {
    constructor() { this.state = 'running'; this.destination = {}; this.currentTime = 0; }
    createGain() { return new FakeGain(); }
    createBufferSource() { return new FakeSrc(); }
    createBiquadFilter() { return { type: '', frequency: { value: 0 }, Q: { value: 1 }, connect() {}, disconnect() {} }; }
    createOscillator() { return { type: '', frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, start() {}, stop() {} }; }
    decodeAudioData() { return Promise.resolve(makeBuf()); }
    resume() { return Promise.resolve(); } suspend() { return Promise.resolve(); }
  }
  global.fetch = () => Promise.resolve({ arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) });
  global.window = { innerWidth: 800, innerHeight: 450, devicePixelRatio: 1, addEventListener() {}, AudioContext: FakeAC, MUSIC_DATA: { menu: 'menu.mp3', levels: ['l1.mp3', 'l2.mp3', 'l3.mp3'] } };
  global.getComputedStyle = () => ({ getPropertyValue: () => '0px' });
  global.localStorage = { getItem: () => null, setItem() {} };
  global.requestAnimationFrame = () => {};
  global.screen = {};
  // Node 22 exposes navigator and performance as GETTER-ONLY globals. verify-run.js
  // dodges this by not being strict-mode, where the assignment silently no-ops;
  // this file is strict, so the same write throws. Either way the built-in stays
  // and the sim guards its use, so a failed stub is the correct outcome — it just
  // has to be allowed to fail.
  for (const [k, v] of [['navigator', {}], ['performance', { now: () => 0 }]]) {
    try { global[k] = v; } catch (e) { /* getter-only: Node's own is fine */ }
  }
}

// ---------- load the sim ----------
function loadSim(root) {
  installStubs();
  const campaigns = fs.readFileSync(path.join(root, 'src', 'campaigns.js'), 'utf8');
  let code = campaigns + '\n' + gameSource(root);
  code = code.replace("'use strict';", '') + `
;globalThis.__fp = {
  S, setState: v => { state = v; }, setIntro: v => { introT = v; introCd = 0; },
  startLevel, startWeekly, simStep, resetCanonical, setViewport, markBriefingsSeen,
  CAMPAIGNS, installCampaign, LEVELS: () => LEVELS,
  enemies: () => enemies, nodes, getState: () => state,
  setPadHold: (a, b) => { padHold[0] = a; padHold[1] = b; },
  firePulse, getPulse: () => pulseCharge, PULSE_MAX: () => PULSE_MAX,
  stats: () => ({ score, integrity, misses, zaps, perfects, maxCombo })
};`;
  // eslint-disable-next-line no-eval
  (0, eval)(code);
  return globalThis.__fp;
}

// ---------- the driver ----------
// A FIXED, SEEDLESS input pattern. It must be identical on every machine and in
// every build, so it derives purely from the step counter — no Math.random, no
// clock. It sweeps both emitters at different rates so they cross the whole ring
// and each other, holds the pads down so the run actually launches, and spends a
// pulse whenever one is charged. Between them those exercise arrival, collision,
// scoring, combo and the pulse path — the things a sim change would move.
function driveStep(V, i) {
  const n = V.nodes;
  n[0].angle = Math.sin(i * 0.017) * Math.PI;
  n[1].angle = Math.sin(i * 0.011 + 1.7) * Math.PI;
  if (i % 240 === 0) {
    const p = V.getPulse();
    for (let k = 0; k < 2; k++) if (p[k] >= V.PULSE_MAX()) { V.firePulse(k); break; }
  }
  V.simStep();
}

// Play one board and reduce it to a string. Every spawn is recorded in order —
// type and angle to five places — because "no enemy removed, none added, none
// moved" is exactly the claim the fingerprint is making, and a summary count
// would miss a swap. The final scoreboard follows, which catches scoring changes
// that leave the traffic untouched.
function boardSignature(V, steps) {
  const seen = new WeakSet(), sig = [];
  for (let i = 0; i < steps && V.getState() !== V.S.END; i++) {
    driveStep(V, i);
    for (const e of V.enemies()) if (!seen.has(e)) { seen.add(e); sig.push(e.type + '@' + Number(e.angle).toFixed(5)); }
  }
  const s = V.stats();
  sig.push(`|${s.score}/${s.integrity}/${s.misses}/${s.zaps}/${s.perfects}/${s.maxCombo}`);
  return sig.join(',');
}

const hash12 = (str) => crypto.createHash('sha256').update(str).digest('hex').slice(0, 12);

function playBoard(V, setup, steps) {
  V.resetCanonical();
  V.setViewport(800, 450);
  setup();
  V.setIntro(999);
  V.setState(V.S.PLAY);
  V.setPadHold(true, true); // both thumbs down, or the level parks and nothing arrives
  return boardSignature(V, steps);
}

// ---------- the battery ----------
function computeLevels(root) {
  const V = loadSim(root);
  // THE WARM-UP MATTERS. The first sim run after a fresh module load sits in a
  // different lazy-init state than every subsequent one (verify-run.js learned
  // this the hard way); runs 1..N are bit-identical to each other but not to run
  // 0. Burn one throwaway board so the battery records the stable regime.
  V.installCampaign(V.CAMPAIGNS[0]);
  playBoard(V, () => V.startLevel(0), 600);

  const out = {};
  for (const camp of V.CAMPAIGNS) {
    V.installCampaign(camp);
    const levels = V.LEVELS();
    for (let i = 0; i < levels.length; i++) {
      const dur = Number(levels[i] && levels[i].duration) || 60;
      const steps = Math.min(Math.ceil(dur * 60) + 240, 6000); // the level, plus its ending
      const sig = playBoard(V, () => { V.installCampaign(camp); V.startLevel(i); }, steps);
      out[`${camp.id}:${i}`] = hash12(sig);
    }
  }
  // the weekly lane is generated from its week index, so it is fingerprinted at a
  // FIXED week — what is being pinned is the generator, not one particular week
  out.weekly = hash12(playBoard(V, () => V.startWeekly(2953), 4000));
  return out;
}

// ---------- cache ----------
// The source hash stops being the IDENTITY and becomes the CACHE KEY: if not one
// byte changed, the battery cannot have produced anything different, so it is
// skipped. That keeps `npm run build` fast during normal work and pays the cost
// only when something actually moved.
function simLevels(root, opts) {
  const src = crypto.createHash('sha256')
    .update(fs.readFileSync(path.join(root, 'src', 'campaigns.js'), 'utf8'))
    .update(gameSource(root))
    .digest('hex');
  const key = `${BATTERY_V}:${src}`;
  const cachePath = path.join(root, '.sim-fingerprint.json');
  if (!(opts && opts.force)) {
    try {
      const c = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
      if (c.key === key) return c.levels;
    } catch (e) { /* no usable cache — fall through and compute */ }
  }
  const levels = computeLevels(root);
  try { fs.writeFileSync(cachePath, JSON.stringify({ key, levels }, null, 2) + '\n'); } catch (e) {}
  return levels;
}

// one id over the whole map, for the places that only need "did anything move" —
// verifier-status, and the client's single-value stamp
const simDigest = (levels) =>
  hash12(Object.keys(levels).sort().map(k => k + '=' + levels[k]).join(';'));

module.exports = { simLevels, simDigest, computeLevels, BATTERY_V };
