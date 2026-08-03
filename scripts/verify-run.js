#!/usr/bin/env node
/*
 * Headless RUN VERIFIER — the core of the Supabase `submit-run` Edge Function,
 * built and tested in Node first so we can prove it before porting to Deno.
 *
 * It loads the REAL game sim (the same <script> the browser runs) behind DOM
 * stubs, reseeds to a submitted run's world, replays the run's input trace via
 * simStep(), and recomputes the score. Because it runs the identical code path
 * the game runs, a legitimate run reproduces its score exactly; a tampered
 * score (or trace) does not.
 *
 *   verifyRun(run) -> { ok, recomputed, expected, integrity, steps, reason }
 *
 * run = { mode:'campaign'|'daily'|'endless', levelIdx, seed, score, trace }
 *
 * Endless is unseeded → unverifiable (returns ok:false, reason).
 * Self-test:  node scripts/verify-run.js --selftest
 */
// NB: intentionally NOT strict-mode — Node 22 exposes navigator/performance as
// getter-only globals; non-strict lets our stub assignments no-op like the test
// harness does, leaving Node's built-ins in place (the sim guards their use).
const fs = require('fs');
const path = require('path');

// ---------- DOM / Web-API stubs (mirrors scripts/test.js) ----------
const grad = { addColorStop() {} };
let canvasStub; // referenced by the ctx proxy below (resolved at call time)
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
function makeBuf() { const d = new Float32Array(10000); for (let i = 500; i < 9000; i++) d[i] = 0.5; return { sampleRate: 1000, length: 10000, duration: 10, getChannelData: () => d }; }
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
global.navigator = {};
global.performance = { now: () => 0 };
global.requestAnimationFrame = () => {};
global.screen = {};

// ---------- load the real sim ----------
const root = path.join(__dirname, '..');
const campaigns = fs.readFileSync(path.join(root, 'src', 'campaigns.js'), 'utf8');
// campaigns.js loads before the game files in the page — mirror that order here
let code = campaigns + '\n' + require('./lib/game-source.js').gameSource(root);
code = code.replace("'use strict';", '') + `
;globalThis.__vg = {
  S, setState: v => { state = v; }, setIntro: v => { introT = v; introCd = 0; },
  startLevel, startDaily, startEndless,
  startTrace, stopTrace, startReplay, stopReplay, simStep, markBriefingsSeen, resetCanonical, setViewport, dismissInfo, mutators,
  spawnEnemy, nodes, geo, getState: () => state, getLastRun: () => lastRun,
  CAMPAIGNS, installCampaign, getCamp: () => CAMP,
  firePulse, getPulse: () => pulseCharge, setPulse: v => { pulseCharge = v; }, PULSE_MAX: () => PULSE_MAX,
  enemies: () => enemies, ring: z => ring(z, geo()),
  setPadHold: (a, b) => { padHold[0] = a; padHold[1] = b; }, introT: () => introT, setResumeHold: v => { resumeHold = v; },
  stats: () => ({ score, integrity, misses, zaps, perfects, maxCombo, comboSec: maxComboSec })
};`;
eval(code);
const V = globalThis.__vg;

// The very first sim run after a fresh module load sits in a different lazy-init
// state than every subsequent run (runs 1..N are bit-identical). The real client
// is always warmed up (boot → menu → music → play), so we run one throwaway pass
// to enter that same stable regime before recording or verifying.
function warmUp(level) {
  V.startLevel(level | 0); V.setIntro(999); V.setState(V.S.PLAY);
  for (let i = 0; i < 4000 && V.getState() !== V.S.END; i++) V.simStep(); // full run — trigger any lazy per-level init
}

// ---------- the verifier ----------
function verifyRun(run) {
  if (!run || !Array.isArray(run.trace)) return { ok: false, reason: 'no trace' };
  if (run.mode === 'endless') return { ok: false, reason: 'endless is unseeded — unverifiable' };
  V.resetCanonical(); V.setViewport(run.w || 0, run.h || 0); // canonical baseline + reproduce the run's geometry
  if (Array.isArray(run.mutators)) for (const k of run.mutators) if (k in V.mutators) V.mutators[k] = true; // re-apply the run's own mutators
  // INSTALL THE RUN'S CAMPAIGN FIRST. levelIdx is an index INTO a campaign, so
  // without this every board outside campaign 1 was replayed against campaign 1's
  // level of the same number — a different level entirely, so the score never
  // reproduced and the run was silently rejected. (The client's own replay path
  // already did this; the verifier did not.)
  if (run.mode !== 'daily') {
    const camp = run.campId ? (V.CAMPAIGNS || []).find(c => c.id === run.campId) : null;
    if (run.campId && !camp) return { ok: false, reason: 'unknown campaign ' + run.campId };
    V.installCampaign(camp || V.CAMPAIGNS[0]);
  }
  warmUp(run.levelIdx);

  // reseed to the exact world the run was played in
  if (run.mode === 'daily') {
    const realNow = Date.now;
    Date.now = () => run.seed * 864e5;   // pin startDaily's day-seed to the run's day
    try { V.startDaily(); } finally { Date.now = realNow; }
  } else {
    V.startLevel(run.levelIdx | 0);      // campaign: fixed per-level seed
  }
  V.setIntro(999); V.setState(V.S.PLAY); // skip the boot gate; drive the sim directly

  // replay the recorded input, step for step
  V.startReplay(run.trace);
  let steps = 0;
  const cap = run.trace.length + 8;      // simStep() returns false when the trace runs out
  while (V.simStep() && steps < cap) steps++;
  V.stopReplay();

  const s = V.stats();
  return {
    ok: s.score === run.score,
    recomputed: s.score, expected: run.score,
    integrity: s.integrity, steps,
    // server-trusted detail stats for the leaderboard row (Hits / Perfect / combo duration)
    zaps: s.zaps, misses: s.misses, perfects: s.perfects, maxCombo: s.maxCombo, comboSec: s.comboSec
  };
}

// ---------- self-test: record a run, then verify it ----------
function selfTest() {
  const LVL = 4;
  V.resetCanonical(); V.setViewport(800, 450);
  warmUp(LVL);
  // record via the REAL lifecycle: resetRun starts the trace, endLevel finalizes
  // it into lastRun. No manual spawns — everything comes from (seed, input).
  //
  // TRACK THE TRAFFIC; DO NOT PARK ON A GUESS. This held both nodes at 0 and PI,
  // which scored 100 when it was written and 0 by 2026-08-03. Nothing broke in the
  // sim: level 4's hostiles now arrive at 4.57, 3.48, 0.49, 1.55 … and the zap
  // tolerance is about +/-0.31 rad, so two fixed angles intercepted nothing,
  // integrity bled out in five misses, and `score > 0` failed on a run that had
  // simply never hit anything. The assertion was right — the AIM was a hostage to
  // level content, and it was silently wrong for 15 commits.
  //
  // Aiming at whatever is closest keeps the run purely seed+input driven (the trace
  // records the resulting angles either way, so replay is untouched) and it scores
  // ~17k instead of 100, which exercises far more of the scoring path.
  V.startLevel(LVL); V.setIntro(999); V.setState(V.S.PLAY);
  for (let i = 0; i < 4000 && V.getState() !== V.S.END; i++) {
    const live = V.enemies().filter(e => !e.dead).sort((a, b) => a.z - b.z);
    if (live[0]) V.nodes[0].angle = live[0].angle;
    if (live[1]) V.nodes[1].angle = live[1].angle;
    else if (live[0]) V.nodes[1].angle = live[0].angle + Math.PI;
    V.simStep();
  }
  const run = V.getLastRun(); // the actual submission payload: { mode, levelIdx, seed, score, trace, ... }

  let pass = true;
  const line = (ok, msg) => { console.log((ok ? 'PASS  ' : 'FAIL  ') + msg); if (!ok) pass = false; };
  if (!run || !run.trace) { console.log('FAIL  the run produced no lastRun/trace'); process.exit(1); }

  const good = verifyRun(run);
  const tampered = verifyRun({ ...run, score: run.score + 5000 });
  line(run.score > 0 && run.trace.length > 0, `recorded a seed-driven run (score ${run.score}, ${run.trace.length} frames)`);
  line(good.ok && good.recomputed === run.score, `a legit run verifies (recomputed ${good.recomputed} === ${run.score})`);
  line(!tampered.ok, `a tampered score is REJECTED (claimed ${run.score + 5000}, real ${tampered.recomputed})`);
  line(verifyRun({ mode: 'endless', trace: run.trace }).ok === false, 'endless is reported unverifiable');

  // DAILY MUST VERIFY TOO, and until 2026-08-03 it could not. It is submitted with
  // verifiable:true, so every daily score was being replay-checked against a lane
  // the player never played, for two reasons: startDaily pointed spawnRng at
  // Math.random itself — which the RENDER path consumes hundreds of times a frame,
  // and the server draws nothing — and daily reached beatQuantize, which reads
  // AC.currentTime on a server that has no audio at all.
  //
  // ⚠️ WHAT THIS BLOCK CANNOT SEE, so nobody mistakes it for the guard: this harness
  // never draws. Record and replay both run bare simStep(), so both sides are
  // server-shaped and agree with each other even when the client would diverge — a
  // reverted spawnRng fix still passes here (with a different score, which is the
  // tell). That blindness is structural and is exactly why the fault survived. The
  // tests that actually catch it live in scripts/test.js, which drives the real
  // frame() and therefore renders: the daily lane-signature comparison across frame
  // rates, and the beatQuantize spy. This block proves the remaining, separate
  // thing — that a daily run is verifiable end to end at all.
  {
    const realNow = Date.now;
    Date.now = () => 20000 * 864e5;              // a fixed day, so the record is reproducible
    try {
      V.resetCanonical(); V.setViewport(800, 450);
      V.startDaily(); V.setIntro(999); V.setState(V.S.PLAY);
      // ONE node tracking, one parked. A daily is endless: it only finishes when
      // integrity runs out, so aiming both nodes perfectly would keep it alive
      // forever and endLevel would never fire, leaving lastRun stale and traceless.
      // Half-covering the lane scores real points AND still bleeds out.
      for (let i = 0; i < 40000 && V.getState() !== V.S.END; i++) {
        const live = V.enemies().filter(e => !e.dead).sort((a2, b2) => a2.z - b2.z);
        if (live[0]) V.nodes[0].angle = live[0].angle;
        V.simStep();
      }
      const dr = V.getLastRun();
      const ok = !!dr && dr.mode === 'daily' && dr.verifiable === true && !!dr.trace && dr.trace.length > 0;
      line(ok, `recorded a daily run (mode ${dr && dr.mode}, score ${dr && dr.score}, ${dr && dr.trace ? dr.trace.length : 'NO'} frames)`);
      if (!ok) { console.log('FAIL  daily run never finished — cannot verify it'); pass = false; }
      const dv = verifyRun(dr);
      line(dv.ok && dv.recomputed === dr.score,
        `a daily run VERIFIES (recomputed ${dv.recomputed} === ${dr.score})`);
      line(!verifyRun({ ...dr, score: dr.score + 5000 }).ok, 'a tampered daily score is REJECTED');
    } finally { Date.now = realNow; }
  }

  // EVERY campaign must verify from a cold start. levelIdx is an index INTO a
  // campaign, so a verifier that inherits whatever campaign happens to be
  // installed replays the wrong level for boards 2..N and rejects real scores.
  for (const camp of V.CAMPAIGNS) {
    V.installCampaign(camp);
    V.resetCanonical(); V.setViewport(1280, 720);
    V.startLevel(3); V.setIntro(999); V.setState(V.S.PLAY);
    for (let i = 0; i < 8000 && V.getState() !== V.S.END; i++) { V.nodes[0].angle = 0; V.nodes[1].angle = Math.PI; V.simStep(); }
    const r2 = V.getLastRun();
    V.installCampaign(V.CAMPAIGNS[0]); // a cold Edge Function starts on the default campaign
    const v2 = verifyRun(r2);
    line(v2.ok, `${r2.board} verifies from a cold start (${v2.recomputed} === ${r2.score})`);
    if (camp === V.CAMPAIGNS[1]) { // and tampering is still caught on a non-default campaign
      line(!verifyRun({ ...r2, score: r2.score + 5000 }).ok, `${r2.board}: a tampered score is still REJECTED`);
      line(!verifyRun({ ...r2, campId: 'no-such-campaign' }).ok, 'an unknown campId is REJECTED, not silently defaulted');
    }
  }
  console.log(pass ? '\nVERIFIER OK' : '\nVERIFIER FAILED');
  process.exit(pass ? 0 : 1);
}

// record a real, seed-driven run (parked nodes killing seeded traffic) and
// return its submission payload — used to cross-test the Edge Function bundle.
function recordDemoRun(levelIdx = 4) {
  V.resetCanonical(); V.setViewport(800, 450); // canonical run (mutators off, fixed geometry)
  warmUp(levelIdx);
  V.startLevel(levelIdx); V.setIntro(999); V.setState(V.S.PLAY);
  for (let i = 0; i < 4000 && V.getState() !== V.S.END; i++) { V.nodes[0].angle = 0; V.nodes[1].angle = Math.PI; V.simStep(); }
  return V.getLastRun();
}

// record a run the way the REAL CLIENT does: fresh save-state (so a first-play
// briefing FIRES mid-level), a real device viewport, and the player dismisses
// the card. Proves the briefing → PLAY-only-trace path verifies. Run in a fresh
// process so `progress` starts clean.
function recordClientRun(levelIdx = 4, w = 1280, h = 720, drive, realIntro = false) {
  V.setViewport(w, h);
  V.startLevel(levelIdx);
  if (realIntro) { V.setState(V.S.PLAY); V.setPadHold(true, true); } // play the FULL boot intro (thumbs down), as the browser does
  else { V.setIntro(999); V.setState(V.S.PLAY); }
  let brief = false;
  for (let i = 0; i < 8000 && V.getState() !== V.S.END; i++) {
    if (V.getState() === V.S.INFO) { brief = true; V.dismissInfo(); V.simStep(); continue; } // player reads + taps
    if (realIntro) V.setPadHold(true, true); // keep thumbs on the pads through the boot gate
    if (drive) drive(i, V.nodes); else { V.nodes[0].angle = 0; V.nodes[1].angle = Math.PI; }
    V.simStep();
  }
  const run = V.getLastRun();
  if (run) run._briefingFired = brief;
  return run;
}

// record a run on a SPECIFIC campaign's level — the cross-campaign case the
// verifier used to get wrong. Uses this module's own sim instance, so it stays
// valid even after another sim (the Edge bundle) overwrites globalThis.__vg.
function recordCampaignRun(campId, levelIdx = 3) {
  const camp = V.CAMPAIGNS.find(c => c.id === campId);
  if (!camp) throw new Error('unknown campaign ' + campId);
  V.installCampaign(camp);
  V.resetCanonical(); V.setViewport(1280, 720);
  V.startLevel(levelIdx); V.setIntro(999); V.setState(V.S.PLAY);
  for (let i = 0; i < 8000 && V.getState() !== V.S.END; i++) {
    V.nodes[0].angle = 0; V.nodes[1].angle = Math.PI; V.simStep();
  }
  return V.getLastRun();
}
const campaignIds = () => V.CAMPAIGNS.map(c => c.id);

module.exports = { verifyRun, recordDemoRun, recordClientRun, recordCampaignRun, campaignIds };
if (require.main === module && process.argv.includes('--selftest')) selfTest();
