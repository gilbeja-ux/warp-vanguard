'use strict';
// ---------- perf watchdog: shed visual load if the frame rate slips, and give it
// back once the device has shown it can carry it ----------
// The two directions are deliberately asymmetric. Dropping detail is urgent and
// happens anywhere: a device drowning mid-run needs relief on the spot. Restoring it
// is not urgent at all, so it is fussy — several consecutive calm windows AND a
// menu. This used to be a one-way latch (`if (lowFX …) return`), which meant one bad
// two-second window bought a permanently thinner sky, no film grain and no panel
// bloom for the whole session, with no path back short of restarting the app. A
// player who trips it while a boss is on screen should not still be looking at the
// reduced game twenty minutes later.
//
// WHY RECOVERY IS MENU-ONLY, and it is not politeness. initStreaks and friends
// consume Math.random, and startWeekly points spawnRng AT Math.random — so rebuilding
// a field mid-run would deal a weekly player a different lane. Between runs endLevel
// has already restored sysRandom, so a rebuild there cannot touch a seeded stream.
// (The drop has always carried that hazard; recovery declines to add a second one.)
//
// And it does not need slicing: the five rebuilds together measure 0.9ms on a
// desktop and about 4.5ms on a mid-tier phone — median of seven, 2026-08-03 — which
// is a fraction of a frame, on the one screen where s3Pump is already handed 3-8ms
// of slack. Budgeting it would be machinery in service of a cost that isn't there.
const PERF_DROP = 1 / 42;   // sustained worse than this and detail goes
const PERF_RAISE = 1 / 57;  // sustained better than this and it may come back
// HITTING VSYNC IS NOT THE SAME AS BEING FINE. Everything above measures the gap
// BETWEEN frames, which is the frame RATE. A phone spending 15ms of every 16.7ms
// doing work is at ~90% utilisation — hot, throttling soon — and its gap is a
// perfect 16.7ms, so the watchdog above sees nothing and sheds nothing. It only
// reacts once the heat has already forced frames to drop, which is exactly the
// order a player reports it in: warms up first, unplayable second.
//
// So the frame's own WORK time is watched too. 11.7ms of a 16.7ms budget is the
// line: comfortably above what a healthy frame costs, comfortably below the
// point where the gap itself would have given it away.
const PERF_BUSY = 0.0117;   // sustained work-per-frame above this = shed detail
const PERF_IDLE = 0.0080;   // …and below this before it may come back
const PERF_CALM = 3;        // calm 2s windows needed to restore — x perfTrips, so
                            // each relapse raises the bar and a weak device settles

function setLowFX(on) {
  if (lowFX === on) return;
  lowFX = on;
  // the populations are read off lowFX at build time, so they all change here.
  // The two the eye can be RESTING ON when this fires — the deep field and the
  // warp blanket, i.e. the whole visible sky on a menu — retarget in place and
  // stage the difference behind a fade (see retargetWarpSky), because a re-deal
  // there is a visible reset of the sky. The lane-only layers rebuild outright:
  // they are invisible on the menus, and mid-run the frame is busy enough that
  // their re-deal has never read as an event.
  initStreaks();
  retargetDeepField();
  retargetWarpSky();
  initLaneMedium();
  initAmbTraffic();
}

// fed by frame(), once per PAINTED frame — an unpainted one does almost no work
// and would only dilute the average toward "healthy"
let workAcc = 0, workN = 0, workAvg = 0;
function perfWork(ms) {
  // SANITY-GATE THE SAMPLE. `spent` is performance.now() minus the timestamp rAF
  // handed us, which is only a duration while both come from the same clock. A
  // harness driving frame() with synthetic timestamps produces enormous negative
  // values, and one of those poisons the rolling average into never tripping —
  // which is exactly how this was found. In production a sample outside this
  // range is a tab-switch or a clock step, and is equally not frame work.
  if (!(ms > 0) || ms > 100) return;
  workAcc += ms; workN++;
}
function perfWatch(rawDt) {
  // ignore startup jank, tab-switch gaps, and a clock that stepped BACKWARDS.
  // frame() already guards the sim against reverse time (see the clamp on dt), but
  // this accumulator did not: one negative delta drove perfWin far below zero and
  // the watchdog then went blind for as long as it took to climb back, unable to
  // either shed load or restore it. It never showed up before because the old
  // one-way latch stopped reading this function the moment it fired.
  //
  // …AND THE WARM-UP IS STARTUP JANK TOO. The 5s grace was measured against the
  // splash, but the menu's first seconds bake a world skin per frame (warmJobs in
  // drawDeepField) on top of JIT warm-up and the loader's decode GC — and those
  // frames landed inside the first 2s window, tripping the shed on hardware that
  // is fine at steady state. The trip called initWarpSky/initDeepField, and THAT
  // was the "starfield resets itself ~5s after load" on the menu. So: no samples
  // until the warm queue has drained.
  if (time < 5 || (warmJobs && warmN < warmJobs.length) || rawDt > 0.5 || rawDt <= 0) return;
  perfAcc += rawDt; perfN++; perfWin += rawDt;
  if (perfWin < 2) return;             // ~2s rolling window
  const avg = perfAcc / perfN;
  workAvg = workN ? (workAcc / workN) / 1000 : 0; // ms -> seconds, same units as avg
  perfAcc = 0; perfN = 0; perfWin = 0; workAcc = 0; workN = 0;
  if (!lowFX) {
    // either signal is enough: dropping frames, OR making the budget but working
    // far too hard to get there
    if (avg > PERF_DROP || workAvg > PERF_BUSY) { setLowFX(true); perfTrips++; perfCalm = 0; }
    return;
  }
  // and BOTH must be calm to come back, or a device that is merely keeping up by
  // burning itself would win its detail back and start the cycle again
  if (avg > PERF_RAISE || workAvg > PERF_IDLE) { perfCalm = 0; return; }
  perfCalm++;
  // max(1, …) so a lowFX forced from outside the watchdog (a dev flag, the bench's
  // tier pin) still needs a real calm window rather than restoring on the first one
  if (perfCalm >= PERF_CALM * Math.max(1, perfTrips) && (state === S.MENU || state === S.GUIDE)) {
    setLowFX(false);
    perfCalm = 0;
  }
}

// ---------- main loop ----------
let last = performance.now();
let frameDt = 0; // this frame's wall-clock dt — drives UI fx even when the sim clock is held
// fixed-timestep sim: the world only ever advances in SIM_DT slices, however
// fast or slow the display runs, so seed + inputs fully determine a run — the
// foundation replay verification stands on. SIM_MAX_SUB caps catch-up so a slow
// device degrades to slo-mo instead of spiralling; the accumulator carries the
// remainder across frames.
const SIM_DT = 1 / 60, SIM_MAX_SUB = 5;
let simAcc = 0;
// ---------- screen transitions + button press feedback ----------
// warp: a dive down the lane. It is the ONE screen transition a level change
// uses — a restart travels exactly like a hand-off to the next stage. The old
// derez shred (a retry de-rezzing the failed frame in place) is deleted; it
// read as a fault, not as a departure. The action fires at the covered midpoint.
let trans = null;   // {mode, t, dur, mid, fired}
let uiPress = null; // {x,y,w,h | sector, t, fn}
// choreographed menu moves: the wheel spins out/in, map panels fly in/out,
// deploys LAUNCH the whole menu at the viewer
let menuFx = null;  // {kind:'spinOut'|'spinIn'|'panelsIn'|'panelsOut'|'launch', t, dur, to, action}
function startTrans(mode, fn) {
  if (trans) { if (fn) fn(); return; }
  trans = { mode, t: 0, dur: mode === 'warp' ? 0.62 : 0.26, mid: fn, fired: false };
  if (mode === 'warp') {
    // packet flush: a descending whoosh as the run's data dives to the node,
    // then a bright rising ping at the switch as the next node blooms open
    sfx.transWarp();
  }
  else sfx.transCut();
}
function pressUI(rect, fn) { // micro-interaction: flash NOW, act on the beat
  uiPress = Object.assign({ t: 0, fn }, rect);
  sfx.tick();
  buzz(8);
}
// the enlistment runs on the RAW frame clock, not the sim: it is a screen, and
// the world behind it is not being simulated.
function tickEnlist(dt) {
  if (!enlist) return;
  if (SPLASH.on) return; // held behind the boot theatre — see drawEnlistment
  enlist.t += dt;
  if (!enlist.out) return;
  enlist.out += dt;
  if (enlist.out >= ENLIST_OUT) {
    // he has posted them to the course. Record the meeting only now, on the way
    // out: quitting halfway through should replay it, not silently consume it.
    progress.enlisted = true;
    saveState();
    enlist = null;
    enlistArtRelease(); // the discs' scan and shine buffers — see 91-briefing.js
    state = S.PLAY; // the course was started when the discs went up — just uncover it
  }
}
function tickUI(dt) {
  tickEnlist(dt);
  marqT += dt * 0.17; // the cameraless marquee clock — the lens ride's rate exactly
  // the NOW PLAYING strip holds while paused — skip a track from the pause panel
  // and the strip is still there to confirm it when the run resumes
  if (npT < NP_DUR && state !== S.PAUSE) npT += dt;
  if (uiPress) {
    uiPress.t += dt;
    if (uiPress.t >= 0.09 && uiPress.fn) { const f = uiPress.fn; uiPress.fn = null; f(); }
    if (uiPress.t > 0.3) uiPress = null;
  }
  // final-relay hold → the CORE duel, once the ring completes
  // the ↺ hold: fills for RESET_HOLD, then the confirm modal takes over
  if (resetHold && (state !== S.MENU || menuScreen !== 'map' || menuFx || menuConfirm)) resetHold = null;
  else if (resetHold) {
    resetHold.t += dt;
    if (resetHold.t >= RESET_HOLD) {
      resetHold = null; menuConfirm = true; sfx.tick(); buzz(20);
      menuPtr = null; // eat the release — it must not land as a backdrop tap
    }
  }
  // the boss-test long-press: tester builds only (see DEV_KEYS in 40-state)
  if (menuHold && (!DEV_KEYS || state !== S.MENU || menuScreen !== 'map' || menuFx || menuConfirm)) menuHold = null;
  else if (menuHold) {
    menuHold.t += dt;
    if (menuHold.t >= HOLD_BOSS) {
      menuHold = null;
      buzz(20); tone(70, 0.45, 'sine', 0.12, 260);
      menuFx = { kind: 'launch', t: 0, dur: 0.5, action: startBossTest };
    }
  }
  if (trans) {
    trans.t += dt;
    if (!trans.fired && trans.t >= trans.dur * 0.5) { trans.fired = true; if (trans.mid) trans.mid(); }
    if (trans.t >= trans.dur) trans = null;
  }
  campScroll += (campScrollTgt - campScroll) * Math.min(1, dt * 8); // carousel glide
  // a tap on an off-center disc glided it to center — once it settles, dive in
  if (campPendingSync !== null && state === S.MENU && menuScreen === 'camps' && !menuFx
      && Math.round(campScrollTgt) === campPendingSync && Math.abs(campScroll - campScrollTgt) < 0.02) {
    const di = campPendingSync; campPendingSync = null;
    campScroll = campScrollTgt = di; // snap the last hair, then zoom
    syncDisc(di);
  }
  if (menuFx) {
    menuFx.t += dt;
    if (menuFx.t >= menuFx.dur) {
      const f = menuFx;
      menuFx = null;
      if (f.kind === 'spinOut') {
        menuScreen = f.to;
        menuFx = f.to === 'board' ? { kind: 'boardIn', t: 0, dur: 0.62 }       // board: ring turns in, columns fly in one by one
          : f.to === 'map' ? { kind: 'panelsIn', t: 0, dur: 0.6, dir: f.dir || 1 }
          : { kind: 'spinIn', t: 0, dur: 0.35, dir: f.dir || 1 };
      } else if (f.kind === 'boardOut') { // leaving the board → back to where it opened
        menuScreen = f.to;
        if (f.action) f.action(); // FLY THIS LANE: the ring has turned out — start the lane
        else menuFx = f.to === 'map' ? { kind: 'panelsIn', t: 0, dur: 0.6, dir: -1 }
          : { kind: 'spinIn', t: 0, dur: 0.35, dir: -1 };
      } else if (f.kind === 'discZoom') {
        // the disc became the tunnel — its relay map takes over
        menuScreen = 'map';
        menuFx = { kind: 'panelsIn', t: 0, dur: 0.6, dir: 1, fromDisc: true };
      } else if (f.kind === 'panelsOut') {
        // backing out of the map: with several campaigns the disc shrinks
        // back into its slot on the carousel; single campaign goes home
        if (CAMPAIGNS.length > 1) {
          menuScreen = 'camps';
          const di = discOfCamp(Math.max(0, CAMPAIGNS.indexOf(CAMP)));
          campScroll = campScrollTgt = di;
          menuFx = { kind: 'discOut', t: 0, dur: 0.5, disc: di };
        } else {
          menuScreen = 'home';
          menuFx = { kind: 'spinIn', t: 0, dur: 0.35, dir: -1 }; // back = counterclockwise
        }
      } else if (f.kind === 'launch' && f.action) f.action();
    }
  }
}
// map fly-ins: per-row offset from the left (staggered head to tail), dossier
// from the right — reversed on the way out and during a launch
function menuRowOff(i, rows) {
  if (!menuFx) return 0;
  const span = 220 + SAFE.l;
  if (menuFx.kind === 'panelsIn') {
    const q = clamp((menuFx.t - i / rows * 0.28) / 0.32, 0, 1);
    return -span * Math.pow(1 - q, 2);
  }
  if (menuFx.kind === 'panelsOut' || menuFx.kind === 'launch') {
    const q = clamp((menuFx.t - i / rows * 0.16) / 0.26, 0, 1);
    return -span * q * q;
  }
  return 0;
}
// leaderboard side columns: each item/card arrives (boardIn) or leaves (boardOut)
// one-by-one from its side. vidx = its order in the visible stack.
function boardRowOff(vidx, dir) {
  const span = W * 0.5 * (dir === 'right' ? 1 : -1);
  if (replayXfer) { // player transition: fly OUT to the sides (enter) / back IN (exit, late)
    if (replayXfer.dir === 1) { const q = clamp((replayXfer.t - vidx * 0.04) / 0.3, 0, 1); return span * q * q; }
    const q = clamp((replayXfer.t - 0.42 - vidx * 0.045) / 0.32, 0, 1); return span * Math.pow(1 - q, 2);
  }
  if (!menuFx || (menuFx.kind !== 'boardIn' && menuFx.kind !== 'boardOut')) return 0;
  if (menuFx.kind === 'boardIn') { const q = clamp((menuFx.t - vidx * 0.045) / 0.28, 0, 1); return span * Math.pow(1 - q, 2); }
  const q = clamp((menuFx.t - vidx * 0.035) / 0.24, 0, 1); return span * q * q; // boardOut: slide back out
}
function menuCardOff() {
  if (!menuFx) return 0;
  const span = W * 0.42;
  if (menuFx.kind === 'panelsIn') return span * Math.pow(1 - clamp(menuFx.t / 0.45, 0, 1), 2);
  if (menuFx.kind === 'panelsOut' || menuFx.kind === 'launch') return span * Math.pow(clamp(menuFx.t / 0.3, 0, 1), 2);
  return 0;
}
function drawTrans() {
  // THE PRESS FLASH IS GONE. It outlined the tapped key for 0.2s, and every
  // version of it was wrong: it painted at the key's pre-transition coordinates,
  // so on any key that moves the screen it hung in space after the screen left,
  // and it read as a box. A press already has feedback that cannot desync from
  // the layout — the tick, the haptic, and the transition itself starting.
  // pressUI still exists and still defers its action by 0.09s so the sound lands
  // before the screen moves; only the outline is removed.
  if (!trans) return;
  const q = trans.t / trans.dur;
  const cover = 1 - Math.abs(q * 2 - 1); // 0 -> 1 (switch) -> 0
  { // warp: PACKET FLUSH — the run's data dives down the bore to the
    // next node, which blooms back out toward the player. Directional, diegetic:
    // everything travels toward the vanishing point in the first half, then out
    // of it in the second, so it reads as ARRIVAL at a new node (not a starburst).
    const g2 = geo();
    const cx = g2.cx, cy = g2.cy;
    const maxR = Math.hypot(W, H) / 2;
    ctx.fillStyle = `rgba(2,4,10,${(cover * 0.6).toFixed(2)})`;
    ctx.fillRect(-20, -20, W + 40, H + 40);
    ctx.lineCap = 'round';
    // speed-streaks that RUSH INWARD at the vanishing point — sells the dive
    for (let i = 0; i < 40; i++) {
      const a = i / 40 * TAU + Math.sin(i * 7.13) * 0.2;
      const seed = (i * 0.618) % 1;
      const head = (0.06 + seed * 0.92) * maxR * (1 - q * 0.82); // sweeps rim -> center
      const len = maxR * (0.12 + 0.42 * cover);
      ctx.strokeStyle = i % 4 === 0 ? `rgba(255,210,74,${(cover * 0.5).toFixed(2)})`
        : `rgba(140,215,255,${(cover * 0.55).toFixed(2)})`;
      ctx.lineWidth = 1 + cover * 2;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * (head + len), cy + Math.sin(a) * (head + len));
      ctx.lineTo(cx + Math.cos(a) * head, cy + Math.sin(a) * head);
      ctx.stroke();
    }
    // the packet: a short train of tunnel rings (real ring() depth math) diving
    // to z=1, then the next node's rings opening back out from z=1 -> 0
    for (let i = 0; i < 5; i++) {
      let z, alpha;
      if (q < 0.5) { const pa = q / 0.5; z = clamp(pa * 1.15 - i * 0.06, 0, 1); alpha = pa; }
      else { const pb = (q - 0.5) / 0.5; z = clamp(1 - pb * 1.15 + i * 0.06, 0, 1); alpha = 1 - pb * 0.6; }
      const r = g2.R0 / (1 + z * 6);
      ctx.strokeStyle = i % 2 === 0 ? `rgba(255,222,120,${(alpha * 0.7).toFixed(2)})`
        : `rgba(150,225,255,${(alpha * 0.7).toFixed(2)})`;
      ctx.lineWidth = 2 + (1 - z) * 4;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, TAU);
      ctx.stroke();
    }
    // bloom at the switch — data secured, warm gold core
    const bloom = clamp(1 - Math.abs(q - 0.5) * 5, 0, 1);
    if (bloom > 0) {
      const bg2 = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxR * 0.9);
      bg2.addColorStop(0, `rgba(235,248,255,${(bloom * 0.9).toFixed(2)})`);
      bg2.addColorStop(0.5, `rgba(255,230,150,${(bloom * 0.3).toFixed(2)})`);
      bg2.addColorStop(1, 'rgba(235,248,255,0)');
      ctx.fillStyle = bg2;
      ctx.fillRect(0, 0, W, H);
    }
  }
}

// ---------- boot splash: GB Interactive → warp-in → WARP VANGUARD ----------
// The menu runs live underneath from the very first frame; the splash is an
// opaque curtain staged on top of it. That makes the finale free: the badge
// materializes exactly where the menu's hub badge lives, then the curtain
// thins to nothing and the menu has "faded in behind the logo". splash2.mp3
// scores the ride and is the master clock once it runs — the sequence ends
// with the take, and playTrack('menu') is the hand-off it was building to.
// On autoplay-blocked browsers the first tap unlocks the score mid-sequence;
// any tap after that (or any tap when sound already runs) skips to the menu.
const SPLASH = {
  on: typeof Image !== 'undefined' && !globalThis.EDITOR_DRIVE, // headless tests + the editor skip the theater
  t: 0, dur: 8.1,      // sequence clock (sec); dur trued from the decoded take
  buf: null, lp: null, // decoded splash2 + its audible window
  src: null, gain: null, startAC: 0, startOff: 0,
  built: false,        // wheel cue fired — the menu is building beneath us
  held: false,         // the boot gate has the sequence stopped (see SPL.hold)
  holdT: 0,            // …for this long, which is the hang guard's only input
  holdMax: 30,         // and the longest it may ever hold. Not a budget — a HANG
                       // GUARD. Every real bake finishes in single-digit seconds,
                       // so anything past this is a renderer that has stopped
                       // answering, and a black screen forever is worse than a
                       // menu reached with a body still missing.
  skip: false          // …and a tap arrived while it was stopped; go the moment it lifts
};
// the beat sheet, in seconds against the 8.1s take. The finale is a staged
// build: reveal thins the curtain (the game's tunnel fades in), wheel cues
// the menu itself — the mode wheel spins in behind the badge and the corner
// furniture flies in from its nearest screen edge (see introE / menuIntroAt)
//
// `hold` is the boot gate, and it sits on the LAST OPAQUE BEAT — one frame before
// reveal starts thinning the curtain. A gate any later would hold on a half-open
// stage, which reads as a hang rather than as a load.
const SPL = { gb: 0.35, type: 1.3, cast: 3.0, crush: 3.82, df: 4.3, settle: 5.5, hold: 5.52, reveal: 5.55, wheel: 6.35 };
// THE RIDE'S KNOBS, in one place. The beat sheet above says WHEN; this says HOW
// HARD. Every number here is a look, not a timing, so it can move without the
// score and the sequence disagreeing.
const SPLFLY = {
  gbZoom: 9,        // how far past the lens the GB card blows. 1 = it never leaves
  gbFade: 2.6,      // …and how late it gives up its light. Higher holds longer
  badgeFar: 0.05,   // the badge's size at the horizon, as a fraction of its dock
  badgeEase: 2.6,   // the arrival curve. Higher leaves the distance faster
  wake: 3,          // trailing copies down the lane behind the badge
  wakeGap: 0.10,    // …and the depth step between them
  boreIn: 0.86,     // curtain LEFT once the bore has faded up under the studio card
  veil: 0.55        // …and once the warp opens for the hand-over. Lower shows more
};
const GB_TAG = 'GB Interactive';
const GBIMG = { img: null, w: 0, h: 0 };
if (SPLASH.on) {
  GBIMG.img = new Image();
  GBIMG.img.onload = () => { GBIMG.w = GBIMG.img.naturalWidth || 1; GBIMG.h = GBIMG.img.naturalHeight || 1; };
  GBIMG.img.onerror = () => {}; // no mark on disk — the typed tag carries the card alone
  GBIMG.img.src = 'icons/GB-logo-hollow.png';
}
function splashBoot() { // once at load: decode the score and try to run it
  brandLogo(); // and kick the badge's lazy decode NOW — card two needs it by SPL.df
  initAC(); if (!AC) return;
  audioWake(); // Capacitor allows it; browsers wait for a tap
  fetch('audio/sfx/splash2.mp3')
    .then(r => r.arrayBuffer()).then(a => AC.decodeAudioData(a))
    .then(buf => {
      SPLASH.buf = buf;
      SPLASH.lp = loopPoints(buf, 0.004);           // encoder padding mapped out
      SPLASH.dur = SPLASH.lp.end - SPLASH.lp.start; // the sequence ENDS with the take
    })
    .catch(() => {}); // silent splash — the frame clock carries the timing alone
}
function splashAudioTry() { // start (or join) the score the moment audio is allowed
  if (!SPLASH.on || SPLASH.src || !SPLASH.buf || !AC || AC.state !== 'running' || !settings.music) return;
  const off = SPLASH.lp.start + SPLASH.t;
  if (off >= SPLASH.lp.end - 0.15) return; // too late — nothing left worth playing
  try {
    SPLASH.gain = AC.createGain();
    SPLASH.gain.gain.value = musicVolume();
    SPLASH.gain.connect(masterBus());
    if (SPLASH.t > 0.1 && SPLASH.gain.gain.setValueAtTime) { // joining mid-take — ease in, don't slam
      SPLASH.gain.gain.setValueAtTime(0.0001, AC.currentTime);
      SPLASH.gain.gain.exponentialRampToValueAtTime(Math.max(musicVolume(), 0.001), AC.currentTime + 0.3);
    }
    SPLASH.src = AC.createBufferSource();
    SPLASH.src.buffer = SPLASH.buf;
    SPLASH.src.connect(SPLASH.gain);
    SPLASH.src.start(0, off);
    SPLASH.startAC = AC.currentTime; SPLASH.startOff = SPLASH.t; // audio-clock anchor
  } catch (e) { SPLASH.src = null; SPLASH.gain = null; }
}
// The one question both the sequence and the skip ask: may the curtain open?
const splashGateOpen = () => s3BreachReady() || SPLASH.holdT >= SPLASH.holdMax;
function splashEnd(skip) {
  if (!SPLASH.on) return;
  // THE GATE OUTRANKS THE SKIP. A tap during the load is remembered, not obeyed:
  // it opens the curtain the instant the last hull lands. Without this the one
  // player most likely to skip — the impatient one, on the slowest phone — is
  // the only player who gets into a lane before its bodies exist.
  if (!splashGateOpen()) { SPLASH.skip = true; return; }
  SPLASH.on = false;
  if (SPLASH.src && AC) { // bow out fast on a skip; a natural end is already silent
    try {
      SPLASH.gain.gain.setValueAtTime(SPLASH.gain.gain.value, AC.currentTime);
      SPLASH.gain.gain.exponentialRampToValueAtTime(0.0001, AC.currentTime + 0.25);
      SPLASH.src.stop(AC.currentTime + 0.3);
    } catch (e) { try { SPLASH.src.stop(); } catch (e2) {} }
  }
  SPLASH.src = null; SPLASH.gain = null; SPLASH.buf = null;
  if (skip) fadeT = 0.35;  // screen-stitch over the jump cut
  playTrack('menu');       // …and the menu music takes over, fading in as normal
}
function splashTap() {
  if (SPLASH.t < 0.3) return; // launch tap-through guard
  const hadAudio = !!SPLASH.src;
  splashAudioTry(); // this tap may be the very unlock the score was waiting for
  if (!hadAudio && SPLASH.src) return; // …then it joins the sequence instead of skipping it
  // resume() still in flight from audio() — treat this tap as the unlock too
  if (!SPLASH.src && SPLASH.buf && AC && AC.state !== 'running' && settings.music) return;
  splashEnd(true);
}
function splashBadge() { // where the menu wants the logo — the hub badge's rect
  if (menuBadge) return menuBadge; // the live menu underneath drew this frame — exact
  const lg = brandLogo(); if (!lg) return null;
  const { ccx, ccy, R } = menuGeom();
  const r0 = R * 0.38, fit = r0 * 2 * 1.575; // mirror drawMenuHome's hub math
  const sc = Math.min(fit / lg.w, fit / lg.h);
  const w2 = lg.w * sc, h2 = lg.h * sc;
  return { img: lg.img, x: ccx - w2 / 2, y: ccy - h2 / 2 + h2 * 0.04, w: w2, h: h2 };
}
// an image torn into horizontal bands, each thrown sideways by amt; ghost
// doubles under it fake the chromatic smear
// THE WARP IS THE GAME'S OWN WARP. The splash used to paint streaks of its own —
// first a scatter re-rolled every frame, then a hand-rolled field on its own
// loops. Both were a SECOND warp drawn over the first, and a second warp can
// only ever disagree with the real one about speed, colour and direction. Gil,
// 2026-08-31: use the warp-in a level starts with.
//
// So it does. The lane is already running underneath — the curtain was simply
// painted over it — and the launch that pushes it is two numbers the tick owns:
// `warpT`, the 0.9s WARP_DIVE shove, and `laneFlow`, the spool from a standstill
// to full lane. splashLane() writes both off the beat sheet, the curtain thins to
// a veil so the field shows through, and the badge flies up the same bore the
// stars come out of. One lane, one direction, and nothing to keep in sync.
//
// Both numbers are PURELY VISUAL (see the tick's note on laneFlow), and the
// splash releases them before it ends: warpT burns to 0 on its own clock, and
// the writes stop at SPL.reveal so the tick's own brake drops the lane out of
// warp as the menu arrives.
function splashLane(t) {
  if (state !== S.MENU) return;                // …and never on the first-boot path,
                                               // which parks a run back there — see
                                               // the veil's note in drawSplash
  if (t < SPL.crush || t > SPL.reveal) return; // before the rush and after the
                                               // hand-off, the lane is the menu's
  laneFlow = clamp((t - SPL.crush) / (SPL.df - SPL.crush), 0, 1); // spool to full by the cut
  warpT = Math.max(0, WARP_DIVE - Math.max(0, t - SPL.df));       // …and the shove lands ON it
}
// THE BORE IS THE ONLY LIGHT LEFT. There was a cast wavefront here too — a ring
// on its own repeating clock, crossing the studio card again and again. Gil,
// 2026-08-31: "the first rings coming over the GB Interactive logo are weird…
// maybe they can be the actual bore coming in a fade in fashion". They can, and
// it is the same lesson as the streaks one beat earlier: the game already draws
// the thing, so the splash should UNCOVER it rather than imitate it. There is no
// painted warp light on this card at all now. The curtain simply lets the bore up.
// THE HOLD'S OWN SLICE. Nothing on the stage is moving but a progress arc, so
// the bake takes most of the frame instead of the menu's polite 8ms — a held
// splash is a load, and a load that paces itself is just a longer load.
function splashHoldPump() {
  s3Pump(S3D_LIGHT.bakeHold);
}
// The readout, and it only ever appears on a machine slow enough to need it.
// Deliberately small and low: the badge is the picture, this is a footnote to it.
function drawSplashHold(u) {
  const keys = s3BreachKeys();
  const done = keys.filter(k => s3Sprites[k] !== undefined).length;
  const q = keys.length ? done / keys.length : 1;
  const bw = u * 0.30, bh = Math.max(2, u * 0.006);
  const bx = (W - bw) / 2, by = H * 0.78;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.font = '500 ' + Math.round(u * 0.026) + 'px Audiowide, system-ui';
  ctx.fillStyle = 'rgba(111,227,255,0.55)';
  ctx.fillText('LOADING', W / 2, by - u * 0.028);
  ctx.fillStyle = 'rgba(111,227,255,0.16)';
  ctx.fillRect(bx, by, bw, bh);
  ctx.fillStyle = 'rgba(111,227,255,0.85)';
  ctx.fillRect(bx, by, bw * q, bh);
  ctx.restore();
}
// A SPLASH THAT IS OFF HAS NO GATE, so the bake is paid on the spot instead.
// Boot pays it for the contexts that start without a curtain; this pays it for
// the ones that drop the curtain later — `SPLASH.on = false` is how every
// store-shot harness stages its frame, and a picture taken before the hulls
// land is a picture of the wrong body. Once, then never again.
let s3Paid = false;
function splashlessBake() {
  if (s3Paid) return;              // …and it latches on EVERY exit, so the common
  s3Paid = true;                   // case — a gated game, already ready — asks once
  if (s3BreachReady() || typeof Image === 'undefined') return;
  s3BreachDrain(20000);
}
function drawSplash(rawDt) {
  if (!SPLASH.on) { splashlessBake(); return; }
  splashAudioTry();
  // the score is the master clock once it runs (rAF gaps can't drift it);
  // until then the frame clock stands in. A HELD sequence reads neither: the
  // gate has stopped the beat sheet, and the score plays on underneath it.
  if (SPLASH.held) { SPLASH.holdT += clamp(rawDt, 0, 0.05); splashHoldPump(); }
  else if (SPLASH.src && AC) SPLASH.t = SPLASH.startOff + (AC.currentTime - SPLASH.startAC);
  else SPLASH.t += clamp(rawDt, 0, 0.05);
  const gateOpen = splashGateOpen();
  // THE BOOT GATE. The enemy's body is a baked hull, and a hull that lands
  // mid-session changes the game under the player — so the curtain does not open
  // until every hull is in. On any machine that finishes inside the sequence this
  // costs exactly nothing; on a slow one it is the load, shown honestly.
  if (!SPLASH.held && SPLASH.t >= SPL.hold && !gateOpen) {
    SPLASH.held = true; SPLASH.t = SPL.hold;
  } else if (SPLASH.held && gateOpen) {
    SPLASH.held = false;
    // re-anchor the score: it ran on through the hold, so the sequence resumes
    // against where the take ACTUALLY is, not where it was when we stopped
    if (SPLASH.src && AC) { SPLASH.startOff = SPLASH.t; SPLASH.startAC = AC.currentTime; }
    if (SPLASH.skip) { splashEnd(true); return; }
  }
  if (SPLASH.t >= SPLASH.dur) { splashEnd(false); return; }
  const t = SPLASH.t, u = Math.min(W, H);
  const ss = (a, b) => { const q = clamp((t - a) / (b - a), 0, 1); return q * q * (3 - 2 * q); };
  splashLane(t); // the lane under the curtain launches — it is the game's warp-in
  ctx.save();
  ctx.textAlign = 'center';
  // the wheel cue: hand the stage to the menu — it spins its wheel in behind
  // the badge (the same choreography as returning from a sub-screen) and
  // starts the corner fly-ins
  if (t >= SPL.wheel && !SPLASH.built) {
    SPLASH.built = true;
    menuIntroAt = time;
    if (!menuFx) menuFx = { kind: 'spinIn', t: 0, dur: 0.6, dir: 1 };
  }
  // THE CURTAIN, IN THREE STAGES, and every one of them is the same move: it
  // lifts to show what the game is already drawing.
  //
  //   1. OPAQUE, through the mark and the typed tag. The studio card is the
  //      studio's and nothing else is on it.
  //   2. THE BORE, from SPL.cast. The curtain eases back to SPLFLY.boreIn and the
  //      lane's own mouth comes up under the logo — far off and barely there, the
  //      destination arriving rather than an effect starting.
  //   3. THE VEIL, from the rush. It opens to SPLFLY.veil for the hand-over, so
  //      the badge flies up a lane that is running, not a painted one.
  //
  // The reveal takes the last of it and the menu is behind the logo, as before.
  //
  // NONE OF IT OPENS ON A DIRTY STAGE. A first-ever boot claims S.ENLIST before
  // the first frame, and that path parks the run behind the curtain — the ring and
  // the pads, dead centre, which is the exact patch of screen the badge flies out
  // of. So a first boot keeps its opaque curtain to the reveal and gets the flight
  // over black. It is the one boot in a player's life; it does not get to be the
  // one that shows the badge landing on top of the ring.
  const veilOK = state === S.MENU;
  const open = veilOK
    ? (1 - SPLFLY.boreIn) * ss(SPL.cast, SPL.crush)
      + (SPLFLY.boreIn - SPLFLY.veil) * ss(SPL.crush, SPL.df)
    : 0;
  ctx.globalAlpha = (1 - open) * (1 - ss(SPL.reveal, SPL.reveal + 0.95));
  ctx.fillStyle = 'rgb(2,4,10)';
  ctx.fillRect(-20, -20, W + 40, H + 40);
  ctx.globalAlpha = 1;
  // how much of the lane's light falls ON the mark. It builds as the bore comes
  // up behind the card and decays once the badge has the stage. This is the only
  // thing the old cast clock is still asked for — the ring it used to drive is
  // gone, and the light it lends the logo is the part that was worth keeping.
  let castAmt = t < SPL.cast
    ? 0
    : t < SPL.df
      ? Math.pow((t - SPL.cast) / (SPL.df - SPL.cast), 1.1)
      : Math.max(0, 1 - (t - SPL.df) / (SPL.settle - SPL.df)) * 0.85;

  // ---- card one: the GB mark over black ----
  if (t < SPL.df) {
    const crushQ = clamp((t - SPL.crush) / (SPL.df - SPL.crush), 0, 1);
    const gbA = ss(SPL.gb, SPL.gb + 1.15);
    const gcx = W / 2, gcy = H * 0.44, gw = u * 0.51;
    if (gbA > 0) {
      ctx.save();
      // INTO THE LENS. The card used to recede into the bore, which reads as the
      // studio walking away. It ARRIVES instead: the mark rushes the camera,
      // blows past it, and the badge comes up the same lane behind it. That is
      // the whole sentence of the splash — we warp FROM GB TO WARP VANGUARD —
      // and it only reads if both cards travel the same way.
      // …and it rushes down the LANE's axis, not the card's: the vanishing point
      // is the screen centre, which is where drawWarpSky and the bore both put it.
      // A card that flew at its own centre would leave on a different heading from
      // the stars behind it, which is the disagreement this whole pass is fixing.
      const zc = 1 + Math.pow(crushQ, 2.3) * SPLFLY.gbZoom;
      ctx.translate(W / 2, H / 2); ctx.scale(zc, zc); ctx.translate(-W / 2, -H / 2);
      ctx.globalAlpha = gbA * (1 - Math.pow(crushQ, SPLFLY.gbFade));
      const gh = GBIMG.w ? gw * GBIMG.h / GBIMG.w : 0;
      if (GBIMG.w) {
        const gx = gcx - gw / 2, gy = gcy - gh / 2 - u * 0.05;
        ctx.drawImage(GBIMG.img, gx, gy, gw, gh);   // whole and seamless — never torn
        if (castAmt > 0.03) {                        // …and the bore's light falls ON the mark
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha *= castAmt * 0.45;
          ctx.drawImage(GBIMG.img, gx, gy, gw, gh);
          ctx.restore();
        }
      }
      // the studio tag types itself out under the mark
      const shown = Math.floor(clamp((t - SPL.type) / 0.055, 0, GB_TAG.length));
      if (shown > 0) {
        const fs = Math.max(14, Math.round(u * 0.052));
        ctx.font = '500 ' + fs + 'px Audiowide, system-ui';
        try { ctx.letterSpacing = (fs * 0.14).toFixed(1) + 'px'; } catch (e) {}
        const ty = gcy + gh / 2 + u * 0.055;
        ctx.fillStyle = 'rgba(225,240,255,0.92)';
        ctx.fillText(GB_TAG.slice(0, shown), gcx, ty);
        if (t < SPL.cast && (shown < GB_TAG.length || Math.sin(t * 9) > -0.2)) { // block cursor
          const tw = ctx.measureText(GB_TAG.slice(0, shown)).width;
          ctx.fillStyle = 'rgba(111,227,255,0.85)';
          ctx.fillRect(gcx + tw / 2 + fs * 0.18, ty - fs * 0.78, fs * 0.5, fs * 0.92);
        }
        try { ctx.letterSpacing = '0px'; } catch (e) {}
      }
      ctx.restore();
      if (crushQ > 0) { // the warp flash, ON THE BORE — the point the card leaves through
        const fa = Math.sin(crushQ * Math.PI), fx = W / 2, fy = H / 2;
        const fg = ctx.createRadialGradient(fx, fy, 0, fx, fy, u * 0.30 * (0.35 + crushQ));
        fg.addColorStop(0, 'rgba(235,250,255,' + (fa * 0.85).toFixed(3) + ')');
        fg.addColorStop(0.55, 'rgba(150,225,255,' + (fa * 0.25).toFixed(3) + ')');
        fg.addColorStop(1, 'rgba(150,225,255,0)');
        ctx.fillStyle = fg;
        ctx.fillRect(fx - u, fy - u, u * 2, u * 2);
        ctx.globalAlpha = 1;
      }
    }
  }

  // ---- card two: the badge flies up the lane into the menu's hub ----
  // It comes out of the SAME BORE the GB mark just left through: a point at the
  // vanishing centre that grows along its own ray until it parks exactly on the
  // rect the menu holds the badge in. Position and scale share one number — a
  // pinhole, so the flight is a straight run at the camera and nothing else.
  // The badge no longer materializes in place; it travels, because the card
  // before it travels, and the pair of them is the sentence GB → WARP VANGUARD.
  if (t >= SPL.df) {
    const b = splashBadge();
    if (b) {
      const vx = W / 2, vy = H / 2;                          // the bore — drawWarpSky's own centre
      const bcx = b.x + b.w / 2, bcy = b.y + b.h / 2;        // …and the dock it flies to
      const raw = clamp((t - SPL.df) / (SPL.settle - SPL.df), 0, 1);
      const ease = 1 - Math.pow(1 - raw, SPLFLY.badgeEase);   // out of the distance fast, docks slow
      const sc = SPLFLY.badgeFar + (1 - SPLFLY.badgeFar) * ease;
      // draw the badge at one depth on the lane. P maps to VP + (P - VP) * d,
      // which is the pinhole and the reason the run needs no separate path.
      const lane = (d, fn) => {
        ctx.save();
        ctx.translate(vx + (bcx - vx) * d, vy + (bcy - vy) * d);
        ctx.scale(d, d);
        ctx.translate(-bcx, -bcy);
        fn();
        ctx.restore();
      };
      const draw = () => ctx.drawImage(b.img, b.x, b.y, b.w, b.h);
      ctx.save();
      // the wake: copies a step further down the lane, so the run has a trail
      // instead of a jump. They die as the badge parks.
      if (raw < 0.95) {
        ctx.globalCompositeOperation = 'lighter';
        for (let k = 1; k <= SPLFLY.wake; k++) {
          ctx.globalAlpha = 0.26 * (1 - raw) / k;
          lane(sc * (1 - k * SPLFLY.wakeGap), draw);
        }
        ctx.globalCompositeOperation = 'source-over';
      }
      ctx.globalAlpha = Math.min(1, raw * 5);
      // THE BADGE ARRIVES LIT, NOT BROKEN. This was a pair of chromatic ghosts
      // either side of the print plus a few displaced echo slices sparking off
      // it — the decompile's language, on the game's own crest. What is left is
      // the projection that put it there: the mark glows out of the light it
      // was cast in, and the glow settles as the print docks.
      const glow = Math.pow(1 - ease, 1.5);
      if (glow > 0.03) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha *= glow * 0.7;
        lane(sc, draw);
        ctx.restore();
      }
      lane(sc, draw); // the print itself — whole and seamless, at every depth
      ctx.restore();
    }
  }

  if (SPLASH.held) drawSplashHold(u);
  const fl = 1 - clamp(Math.abs(t - SPL.df) / 0.09, 0, 1); // the white pop at the cut
  if (fl > 0) {
    ctx.globalAlpha = fl * 0.5;
    ctx.fillStyle = '#eaf6ff';
    ctx.fillRect(-20, -20, W + 40, H + 40);
  }
  ctx.restore();
}

// Depth-sorted draw order, reused across frames. Render-only: the sim never reads
// it, and the comparator is the one that was inline here before.
const drawOrder = [];
const EMPTY_DRAW = [];
const byDepth = (a, b) => b.z - a.z;

// ---------- the 60fps render cap ----------
// A GALAXY S23 IS A 120Hz PANEL, and rAF fires at the panel's rate. The sim is
// fixed-step at SIM_DT (1/60) and does not care, so every frame past 60 was a
// second full render — same picture, twice the GPU, twice the heat. That is the
// shape of a "the phone gets hot and the game becomes unplayable" report: not a
// slow frame, a sustained one.
//
// THE RULE IS NOT A FLAT 16.7ms THRESHOLD. That would halve a 90Hz panel to 45,
// which judders worse than the heat. Instead a frame is skipped only when the
// NEXT vsync would still land inside the budget — so 120Hz renders every second
// tick (60fps), while 90Hz and 60Hz render every tick and are left alone.
const RENDER_MIN = 1 / 60;
let vsyncEst = 0;    // observed refresh interval, seconds — a slowly decaying minimum
let lastRender = 0;  // clock of the last frame actually drawn
let prevTick = 0;    // clock of the previous rAF, drawn or not
let paintN = 0;      // frames actually painted — the profiler's real fps, and what the cap is judged on
// Answers "should this rAF paint?" — and NOTHING else. The sim is deliberately
// left out of it: skipping simulation would make the game frame-rate dependent,
// which is the one property the fixed timestep exists to guarantee and which the
// leaderboard's replay verification is built on top of.
function shouldRender(now) {
  const gap = (now - lastRender) / 1000;
  if (!lastRender || !prevTick) { prevTick = lastRender = now; return true; }
  // the smallest gap that keeps recurring IS the refresh period. It decays upward
  // by 2% a frame so a backgrounded tab re-learns rather than latching onto a
  // stale fast estimate.
  const g = (now - prevTick) / 1000;
  if (g > 0.0005) vsyncEst = vsyncEst ? Math.min(vsyncEst * 1.02, g) : g;
  prevTick = now;
  // gap > 0 is not paranoia: a headless harness drives frame() with a fixed
  // timestamp, and without it the cap would skip every draw and the render tests
  // would pass by never rendering anything.
  if (gap > 0 && gap < RENDER_MIN - vsyncEst * 0.5 - 1e-4) return false;
  lastRender = now;
  return true;
}
function frame(now) {
  const painting = shouldRender(now);
  const rawDt = (now - last) / 1000;
  let dt = clamp(rawDt, 0, 0.05); // clock can step backwards (timer quirks) — never simulate in reverse
  frameDt = dt;
  last = now;
  prof('ui');
  perfWatch(rawDt);
  tickUI(dt);       // press feedback + screen transitions — once per rendered frame, raw clock
  tickReplayXfer(dt); // leaderboard<->player enter/exit transition
  pollGamepad(dt);  // sample the controller once per frame; the sim reads the latch each step
  // tunnel designer hook: editor.html feeds the sim clock (0 = hold the world,
  // draw only). The global never exists in the game — this branch is inert here.
  if (globalThis.EDITOR_DRIVE) {
    dt = EDITOR_DRIVE(dt); // the editor drives the clock directly (0 holds the world)
    update(dt);            // single-stepped; render below follows the same driven dt
  } else {
    // fixed-timestep integration — the world advances in SIM_DT slices only.
    // simStep() carries the trace record/replay hooks; a replay that runs off
    // the end of its trace stops the loop.
    // replay transport: apply a pending scrub, then advance at the chosen speed
    // (frozen while paused, scrubbing, or held at the end)
    if (replaying && replaySeekTo >= 0) {
      const seekFrame = replaySeekTo;
      const pm = simMuted; simMuted = true; replayDoSeek(replaySeekTo); simMuted = pm; replaySeekTo = -1; // silent fast-forward — no sfx pile-up
      if (replayScrub) { const t = seekFrame * SIM_DT; if (Math.abs(t - musicScrubT) > 0.12) { seekMusicTo(t); musicScrubT = t; } } // quiet music-preview follows the thumb (throttled)
    }
    prof('sim');
    simAcc += replaying ? ((replayPaused || replayScrub || replayEnded) ? 0 : dt * replaySpeed) : dt;
    let steps = 0;
    while (simAcc >= SIM_DT && steps < SIM_MAX_SUB) {
      if (!simStep()) { if (replaying) { replayEnded = true; replayPaused = true; simAcc = 0; } else stopReplay(); break; } // HOLD on the last frame, don't auto-exit
      simAcc -= SIM_DT; steps++;
    }
    if (steps >= SIM_MAX_SUB) simAcc = 0; // fell far behind: shed the backlog, never spiral
    // a frozen replay (paused / scrubbing / held-at-end / exiting) doesn't step the
    // sim, so updateMusic never runs — tick it here so the pause/exit fades ease on
    if (replaying && (replayPaused || replayScrub || replayEnded)) updateMusic(rawDt);
    // run the drop-out clock frame-side while a replay plays/holds its finish
    // (the sim's S.END advance never runs during a replay)
    if (replaying && endWin && endDropT >= 0 && endDropT < 8) endDropT += dt;
  }
  // ease the sfx bus toward its target (real clock: fades even while the replay
  // is paused/scrubbing) — smooths the replay enter + scrub-knob mute/unmute
  sfxFade += (sfxFadeTgt - sfxFade) * Math.min(1, rawDt * sfxFadeRate);
  if (sfxGain) sfxGain.gain.value = sfxBusGain();
  if (state !== S.PLAY) stripSound(false, 0); // pause/menus never hold the drone
  // H-33: same guard for the ray. updateBossFight stops it on the mode change and
  // on death, but a run that ENDS mid-sweep — a loss, a quit, a pause, a replay
  // exit — never reaches either, and a held oscillator would sing on into the menu.
  if (state !== S.PLAY || !boss) raySweepKill();
  // The engine bed runs for exactly as long as the lane does, and one call per frame
  // is what makes that true of EVERY exit — win, loss, quit, pause into a menu. On a
  // collapsed lane it cuts hard (the second argument): nothing arrived, so the engine
  // stops rather than coasting away under the report.
  ambient(state === S.PLAY, state === S.END && !endWin);
  prof('bg');

  // THE CAP. Everything above ran: the clock, the sim, audio, input. Only the
  // painting is skipped, and only on a panel fast enough that the skipped frame
  // would have been an identical picture.
  if (!painting) { requestAnimationFrame(frame); return; }
  paintN++;

  ctx.save();
  if (shake > 0) ctx.translate(rand(-1, 1) * shake * 6, rand(-1, 1) * shake * 6);

  // background
  ctx.clearRect(-20, -20, W + 40, H + 40);
  // replay enter/exit: the whole WORLD (tunnel, pads, enemies) flies in with a
  // zoom + fade so the reveal isn't abrupt — early on the way in, late on the way
  // out, so it never fights the chrome's own fly-in
  let worldZoom = 1, worldAlpha = 1;
  if (replayXfer) {
    if (replayXfer.dir === 1) { const q = clamp(replayXfer.t / 0.5, 0, 1), e = 1 - (1 - q) * (1 - q); worldAlpha = e; worldZoom = 0.66 + 0.34 * e; }   // fly TOWARDS the user: grow from deep in the tunnel up to full
    else { const q = clamp((replayXfer.t - 0.35) / 0.45, 0, 1), e = q * q; worldAlpha = 1 - e; worldZoom = 1 - 0.34 * e; }                        // fly OUTWARD: recede back down the tunnel
  }
  const worldFx = !!replayXfer;
  if (worldFx) { ctx.save(); ctx.globalAlpha = worldAlpha; ctx.translate(W / 2, H / 2); ctx.scale(worldZoom, worldZoom); ctx.translate(-W / 2, -H / 2); }
  // THE SKY HOLDS ITS BEARINGS. The strips are the FAR field — the band, the
  // nebulae, the baked star sheets — and under forward flight nothing that far
  // away moves: the travel lives in the warp blanket, which now cruises at
  // every throttle (see 20-background's header). skyPan is pinned at zero; the
  // strip machinery stays because the sheets were baked seam-disciplined on it
  // and the deep field keys its (now zero) offsets off the same variable. The
  // vignette stays put below: it is the canopy's own darkening, ship-frame.
  const stripPan = (cv, rate, alpha) => {
    if (!cv) return;
    const off = (skyPan * rate) % skyW;
    if (alpha !== undefined) ctx.globalAlpha = alpha;
    ctx.drawImage(cv, -off, 0, skyW, H);
    ctx.drawImage(cv, skyW - off, 0, skyW, H);
    if (alpha !== undefined) ctx.globalAlpha = 1;
  };
  stripPan(skyStruct, SKY_L.struct);   // band and dust — the far wall
  stripPan(skyClouds, SKY_L.clouds);   // the nebulae, one plane nearer
  // the dense baked star field, and the only sheet that gives way under the lane's
  // own sky: a painted star CANNOT come at you, so at speed it steps back to
  // WARP_SKY and becomes the unreachable blanket the blanket is flown against.
  // The band and its dust stay at full — at this distance nothing moves, which is
  // exactly the claim a galaxy that never shifts is making.
  stripPan(bgCanvas, SKY_L.bake, 1 - laneFlow * (1 - WARP_SKY));
  // the denser sky the meta screens get, over the structure and under
  // everything else. Its live half is drawn inside drawStarField on the
  // same fade.
  if (menuSkyVis > 0.004) stripPan(menuSky, SKY_L.bake, menuSkyVis);
  prof('starField');
  drawStarField();  // the half of the backdrop that is allowed to move

  const g = geo();

  // open space OUTSIDE the lane, before the wall goes down — the wall's sparse
  // strokes veil it rather than hide it, so the corridor reads as threaded
  // through something bigger than itself
  prof('deepField+traffic');
  drawDeepField(g, dt);
  drawAmbTraffic(g); // other people's business, crossing the deep on every screen

  // the tunnel fills the whole screen — no clipping, we're inside it
  prof('tunnel');
  drawTunnel(g);
  drawLattice(g);
  drawRangeRings(g);
  drawSurgeWave(g);
  prof('laneMedium');
  drawLaneMedium(g, dt); // gas + debris the warp lines fly through
  prof('streaks');
  if (!abl('streaks')) drawStreaks(g, dt);
  prof('ring');
  // warm glow rising off the golden river — no convoy, no glow
  if (laneFlow > 0.01) {
    const rgl = ctx.createRadialGradient(g.cx, H * 0.95, 0, g.cx, H * 0.95, Math.min(W, H) * 0.75);
    rgl.addColorStop(0, `rgba(255,180,70,${(0.12 * laneFlow).toFixed(3)})`);
    rgl.addColorStop(1, 'rgba(255,180,70,0)');
    ctx.fillStyle = rgl;
    ctx.fillRect(0, 0, W, H);
  }

  // atmospheric depth fog — mid-distance haze INSIDE the tunnel, so it goes when
  // the tunnel does. Vacuum has no haze in it, and the arrival wants clean sky.
  const fogK = 1 - laneExit();
  if (fogK > 0.004) {
    const fogG = ctx.createRadialGradient(g.cx, g.cy, g.nodeR * 0.1, g.cx, g.cy, g.nodeR * 1.4);
    fogG.addColorStop(0, 'rgba(10,22,48,0)');
    fogG.addColorStop(0.45, `rgba(10,22,48,${(0.12 * fogK).toFixed(3)})`);
    fogG.addColorStop(1, 'rgba(10,22,48,0)');
    ctx.fillStyle = fogG;
    ctx.fillRect(0, 0, W, H);
  }

  // THE FIELD GUIDE KEEPS THE CONTEXT BEHIND IT. This used to blank the run's
  // world — ring FX, bodies, pickups, nodes, HUD popups — on the frame the page
  // opened, and every attempt to soften that was softening the wrong thing.
  // Gil's call, 2026-09-01: the page is an overlay with its OWN mask, and what a
  // mask covers stays covered rather than deleted. So a player who opens the
  // guide mid-run still sees the run they are in, dimmed, and the only thing
  // that moves across the transition is the page.
  //
  // Only the enlistment still stands the hardware down, and for its own reason: The course is already running behind them, but none of
  // its hardware has been sent for: the ring flies in with the warp start and the
  // pads light with it, which is the moment the player is handed the controls.
  // Drawing either early spends that moment early — and a pulse meter glowing at
  // each edge while a disc is still talking is furniture for controls that do not
  // work yet. drawHolderRing already stands its monolith down while parked; the
  // pads come in under drawNodes, which is what `hw` gates.
  const noRig = state === S.ENLIST;
  const bz = noRig ? Math.min(W, H) * 0.055 : drawHolderRing(g);
  // EVERYTHING ON THE BAND POWERS DOWN WITH THE RUN. rimFX and latches only
  // decay while the sim is in PLAY, so at the report they hang on the rim
  // forever — the last few hits frozen as bright arcs, and a banked shield still
  // bathing the whole ring in charge. The ceremony fades the lot out.
  //
  // And it is ZERO wherever the physical ring itself isn't drawn. The band FX
  // are lighting ON that hardware: in a menu or the Archive there is no ring to
  // light, so a run's last hits were floating in the middle of the contract
  // chooser as bare arcs. Nothing on the band outlives the ring it sits on.
  const hw = state === S.MENU || noRig ? 0 : endPower();
  prof('bandFX');
  drawBandFX(now, g, bz, hw);
  prof('enemies');
  // Reused scratch buffer + a hoisted comparator: this ran `enemies.slice().sort(
  // (a,b) => ...)` every rendered frame, allocating an array and a fresh closure
  // each time. Depth order is unchanged — same comparator, same input order.
  let sorted = drawOrder;
  if (runVis <= 0.004) sorted = EMPTY_DRAW;
  else { drawOrder.length = 0; for (const en of enemies) drawOrder.push(en); drawOrder.sort(byDepth); }
  if (runVis < 1) { ctx.save(); ctx.globalAlpha *= runVis; }
  for (const en of sorted) if (en.lineLead) drawLineBeam(en, g); // beams sit under the traps
  for (const en of sorted) drawEnemy(en, g);
  drawVolleyBlasts(g); // the blast sits OVER the traffic it just swallowed
  for (const gh of runVis <= 0.004 ? [] : ghosts) drawGhost(gh, g); // dead bodies de-rezzing in place
  for (const p of runVis <= 0.004 ? [] : pickups) drawPickup(p, g);
  if (runVis < 1) ctx.restore();
  if (hw > 0.004) drawPulseWave(g); // a fired pulse is hardware too — it goes with the ring
  drawWarpCollapse(g);
  if (boss && state !== S.MENU) drawBoss(g);

  if (state !== S.MENU && hw > 0.004) { // the arcs and their orbs, same fade
    if (hw < 1) { ctx.save(); ctx.globalAlpha = hw; }
    drawNodes(g);
    drawVolley(g);
    if (hw < 1) ctx.restore();
  }

  prof('ephemera');
  drawEphemera(false); // the page masks the run's ephemera now, it does not delete them

  prof('postChain');
  drawPostChain(rawDt, worldFx, g);

  ctx.restore();
  // THE BAKE'S TIME IS EVERY SCREEN THAT IS NOT A RUN. Gil's call stands on the
  // part that matters — the sprites never get built DURING a run — but the window
  // used to be the menu and the Archive alone, and that is what let a new player
  // sit through a five-second enlistment and a mission disc with the queue
  // untouched, then meet a lane whose bodies had not been built yet.
  //
  // So: the splash, the enlistment, the menu, the Archive, a briefing, a pause,
  // a results card — and the PARKED lane, which waits for two thumbs and is not a
  // run until it has them. The budget is small enough that a frame it lands on
  // still makes 60, and it only shrinks if that frame was already long.
  if (SPLASH.on || state !== S.PLAY || preLaunch()) {
    // Budget off THIS FRAME'S OWN WORK, not off rawDt. rawDt is the wall clock
    // between frames, which at 60fps is 16.7ms of mostly vsync wait — subtracting
    // it from a budget leaves a negative number every single frame, and the bake
    // never gets a slice.
    const used = performance.now() - now;
    s3Pump(Math.max(S3D_LIGHT.bakeMin, Math.min(S3D_LIGHT.bakeMs, 11 - used)));
  }
  if (PAD_TEST) drawPadTest(); // ?padtest — the controller diagnostic, over everything
  // THE FRAME'S OWN COST, measured at the very end so it includes everything —
  // the bake pump and the profiler included. This is the number the watchdog
  // needs and never had: what the device actually spent, as opposed to how long
  // it waited for the next vsync.
  const spent = performance.now() - now;
  if (profOn()) { profFrame(spent); drawProfiler(); }
  perfWork(spent);
  requestAnimationFrame(frame);
}
// Light ON the ring hardware: reactive rim segments, the shield collar and its
// flash. Scaled by hw, which is zero wherever the physical ring isn't drawn —
// band FX must never outlive the ring they sit on.
function drawBandFX(now, g, bz, hw) {
  // reactive rim: zaps and misses light the segment they happened on.
  // NOT a fat round-capped stroke (it read as a white box behind the emitter):
  // a thin hot filament riding the band, inside a soft halo. Both are painted
  // through a radial gradient centred on the hit angle, so the light falls off
  // along the arc and across it — no edge, no cap, just a fading glow. A combo
  // or a PERFECT (w) buys brightness and reach, never thickness.
  for (const fx2 of hw <= 0.004 ? [] : rimFX) {
    const wM = fx2.w || 1;
    const al = Math.min(1, fx2.t / 0.45) * Math.min(1.3, 0.7 + wM * 0.3) * hw;
    const R = g.nodeR + bz / 2;
    const px = g.cx + Math.cos(fx2.a) * R, py = g.cy + Math.sin(fx2.a) * R;
    const reach = R * 0.36 * (0.8 + wM * 0.3); // how far the light spills along the band
    ctx.lineCap = 'butt';
    // the halo: band-hugging, dying out well before the arc ends
    const gh = ctx.createRadialGradient(px, py, 0, px, py, reach);
    gh.addColorStop(0, 'rgba(' + fx2.col + ',' + (al * 0.60).toFixed(3) + ')');
    gh.addColorStop(1, 'rgba(' + fx2.col + ',0)');
    ctx.strokeStyle = gh;
    ctx.lineWidth = bz * 1.15;
    ctx.beginPath(); ctx.arc(g.cx, g.cy, R, fx2.a - 0.6, fx2.a + 0.6); ctx.stroke();
    // the filament: thin, white-hot at the centre, cooling into the segment's colour
    const gf = ctx.createRadialGradient(px, py, 0, px, py, reach);
    gf.addColorStop(0, 'rgba(255,255,255,' + (al * 0.95).toFixed(3) + ')');
    gf.addColorStop(0.35, 'rgba(' + fx2.col + ',' + (al * 0.80).toFixed(3) + ')');
    gf.addColorStop(1, 'rgba(' + fx2.col + ',0)');
    ctx.strokeStyle = gf;
    ctx.lineWidth = Math.max(1, bz * 0.16);
    ctx.beginPath(); ctx.arc(g.cx, g.cy, R, fx2.a - 0.6, fx2.a + 0.6); ctx.stroke();
  }
  // the first-x10 flourish: two golden fronts race from the kill's angle both
  // ways around the band and meet on the far side — one sweep, then gone
  if (x10FxT > 0 && hw > 0.004) {
    const q = smoothT(clamp(1 - x10FxT / 1.1, 0, 1));
    const a0 = x10FxA - Math.PI * q, a1 = x10FxA + Math.PI * q;
    const alf = Math.pow(1 - q, 0.6) * hw;
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(255,210,74,' + (alf * 0.22).toFixed(2) + ')';
    ctx.lineWidth = bz * 2.4;
    ctx.beginPath(); ctx.arc(g.cx, g.cy, g.nodeR + bz / 2, a0, a1); ctx.stroke();
    // the lip stays a filament — the same thin-light language as the rim flash
    ctx.strokeStyle = 'rgba(255,232,150,' + (alf * 0.9).toFixed(2) + ')';
    ctx.lineWidth = Math.max(1, bz * 0.3);
    ctx.beginPath(); ctx.arc(g.cx, g.cy, g.nodeR + bz / 2, a0, a1); ctx.stroke();
    if (q > 0.01 && q < 0.99) for (const fa of [a0, a1]) { // the white-hot heads
      const hx = g.cx + Math.cos(fa) * (g.nodeR + bz / 2), hy = g.cy + Math.sin(fa) * (g.nodeR + bz / 2);
      const hr2 = bz * 1.5;
      const gl2 = ctx.createRadialGradient(hx, hy, 0, hx, hy, hr2);
      gl2.addColorStop(0, 'rgba(255,250,225,' + (alf * 0.9).toFixed(2) + ')');
      gl2.addColorStop(1, 'rgba(255,210,74,0)');
      ctx.fillStyle = gl2;
      ctx.beginPath(); ctx.arc(hx, hy, hr2, 0, TAU); ctx.fill();
    }
    ctx.lineCap = 'butt';
  }
  // a wounded rim sputters
  if (state === S.PLAY && integrity <= 25 && Math.random() < 0.25) {
    const ra = Math.random() * TAU;
    burst(g.cx + Math.cos(ra) * (g.nodeR + bz / 2), g.cy + Math.sin(ra) * (g.nodeR + bz / 2), '#8fc7ff', 2, 2);
  }
  if (hw > 0.004) {
    if (hw < 1) { ctx.save(); ctx.globalAlpha = hw; }
    drawLatches(g, bz);
    drawArrivalPings(g);
    if (hw < 1) ctx.restore();
  }
  if (shieldCharge > 0 && hw > 0.004) {
    // THE SHIELD: the monolith ITSELF runs hot — the whole band bathes
    // in charge, both machined lips light up, filaments crawl the full
    // circle and twin charge sectors circulate. Unmissable: the ring is
    // STRONGER right now.
    const shBh = Math.min(W, H) * 0.055 * ARCFX.bandW;
    const Rin = g.nodeR - shBh, Rout = g.nodeR + shBh;
    // every alpha in this block is derived from br2 (the grain included), so the
    // power-down rides in here and the whole charged band dims as one thing
    const br2 = (0.55 + 0.2 * Math.sin(time * 3)) * hw;   // deep breathing
    // charge-in: the glow SPREADS around the collar from the pickup's angle,
    // two hot fronts racing both ways until they meet on the far side
    const spQ = shieldUpT > 0 ? smoothT(clamp(1 - shieldUpT / 0.6, 0, 1)) : 1;
    const sh0 = shieldUpA - Math.PI * spQ, sh1 = shieldUpA + Math.PI * spQ;
    ctx.save();
    // the whole band bathed in energy + an aura radiating past it
    ctx.lineCap = 'round';
    ctx.strokeStyle = `rgba(120,210,255,${(br2 * 0.30).toFixed(2)})`;
    ctx.lineWidth = shBh * 2.1;
    ctx.beginPath(); ctx.arc(g.cx, g.cy, g.nodeR, sh0, sh1); ctx.stroke();
    ctx.strokeStyle = `rgba(120,210,255,${(br2 * 0.12).toFixed(2)})`;
    ctx.lineWidth = shBh * 3.8;
    ctx.beginPath(); ctx.arc(g.cx, g.cy, g.nodeR, sh0, sh1); ctx.stroke();
    // both machined lips lit hard
    ctx.strokeStyle = `rgba(160,230,255,${(br2 * 0.95).toFixed(2)})`;
    ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.arc(g.cx, g.cy, Rout, sh0, sh1); ctx.stroke();
    ctx.beginPath(); ctx.arc(g.cx, g.cy, Rin, sh0, sh1); ctx.stroke();
    ctx.strokeStyle = `rgba(160,230,255,${(br2 * 0.45).toFixed(2)})`;
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(g.cx, g.cy, Rout + 4, sh0, sh1); ctx.stroke();
    if (spQ < 1) { // the racing fronts: white-hot heads + a spark shower
      for (const fa of [sh0, sh1]) {
        const fx2 = g.cx + Math.cos(fa) * g.nodeR, fy2 = g.cy + Math.sin(fa) * g.nodeR;
        const fg = ctx.createRadialGradient(fx2, fy2, 0, fx2, fy2, shBh * 1.1);
        fg.addColorStop(0, 'rgba(255,255,255,0.95)');
        fg.addColorStop(0.4, 'rgba(160,230,255,0.5)');
        fg.addColorStop(1, 'rgba(160,230,255,0)');
        ctx.fillStyle = fg;
        ctx.beginPath(); ctx.arc(fx2, fy2, shBh * 1.1, 0, TAU); ctx.fill();
        if (state === S.PLAY && Math.random() < 0.5) particles.push({
          x: fx2, y: fy2, vx: rand(-1.5, 1.5), vy: rand(-1.5, 1.5),
          life: rand(0.2, 0.4), decay: 2.8, color: '#bfeaff', size: rand(0.8, 1.8) });
      }
    }
    // scintillation: animated grain INSIDE the band — the glow gets a living
    // texture, like charge boiling in the metal (reuses the film-grain tile)
    if (grainCv && !lowFX) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(g.cx, g.cy, Rout + 3, sh0, sh1);
      ctx.arc(g.cx, g.cy, Rin - 3, sh1, sh0, true);
      ctx.closePath();
      ctx.clip();
      ctx.globalCompositeOperation = 'lighter';
      for (const [spd, sc, al] of [[41, 1, 0.10], [67, 0.5, 0.07]]) { // two speeds, two grains
        ctx.globalAlpha = al * br2 * 1.7;
        const ox = (Math.floor(time * spd) * 97) % 256, oy = (Math.floor(time * spd) * 53) % 256;
        const ts = 256 * sc;
        for (let yy = -oy * sc; yy < H; yy += ts) for (let xx = -ox * sc; xx < W; xx += ts)
          ctx.drawImage(grainCv, xx, yy, ts, ts);
      }
      ctx.restore();
    }
    ctx.restore();
  }
  if (shieldFlashT > 0 && hw > 0.004) {
    // the catch: the sheath drains around the collar INTO the breach point,
    // brightening as it concentrates, and cracks white where it lands
    const shBh = Math.min(W, H) * 0.055 * ARCFX.bandW;
    const sr = g.nodeR + shBh;
    const q = 1 - shieldFlashT / 0.5;
    const half = Math.PI * (1 - q * q);            // ease in as it collapses
    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = `rgba(120,210,255,${(0.2 + q * 0.3).toFixed(2)})`;   // the glow itself drains
    ctx.lineWidth = shBh * 2.1;
    ctx.beginPath(); ctx.arc(g.cx, g.cy, g.nodeR, shieldHitA - half, shieldHitA + half); ctx.stroke();
    ctx.strokeStyle = `rgba(190,240,255,${(0.65 + q * 0.35).toFixed(2)})`;
    ctx.lineWidth = 2.5 + q * 4;
    ctx.beginPath(); ctx.arc(g.cx, g.cy, sr, shieldHitA - half, shieldHitA + half); ctx.stroke();
    const hx = g.cx + Math.cos(shieldHitA) * sr, hy = g.cy + Math.sin(shieldHitA) * sr;
    ctx.strokeStyle = `rgba(255,255,255,${(0.9 * (1 - q)).toFixed(2)})`;
    ctx.lineWidth = 1.4;
    for (let k = 0; k < 3; k++) {                  // white cracks at the catch
      const ra2 = Math.random() * TAU;
      let px2 = hx, py2 = hy;
      ctx.beginPath(); ctx.moveTo(px2, py2);
      for (let k2 = 0; k2 < 3; k2++) {
        px2 += Math.cos(ra2) * shBh * 0.5 + rand(-3, 3);
        py2 += Math.sin(ra2) * shBh * 0.5 + rand(-3, 3);
        ctx.lineTo(px2, py2);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  // traps render over the ring — missed ones fly past the player and fade
}
// The short-lived stuff thrown off by play: particles, the healed wash, bolts,
// reprogrammed-packet streaks and score popups. All of it hides in the guide.
function drawEphemera(inGuide) {
  // particles + popups (over everything)
  ctx.lineCap = 'round';
  for (const p of inGuide ? [] : particles) {
    // charge fragments: fine streaks along their motion, not blobs — light in transit
    ctx.globalAlpha = clamp(p.life, 0, 1);
    ctx.strokeStyle = p.color;
    ctx.lineWidth = Math.max(0.5, p.size * 0.6);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x - p.vx * 2.4 - 0.5, p.y - p.vy * 2.4 - 0.5);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  if (ripples.length && !inGuide) { // the healed wash, soaking into the wall
    const gD = geo();
    for (const rp of ripples) {
      const k = rp.t / DECOMP.rippleT, rg = ring(rp.z, gD);
      const sc = clamp(rg.r / gD.nodeR, 0.1, 2); // wall-lockstep scale, like the bodies
      const A = DECOMP.rippleR * rp.mul * (1 - Math.pow(1 - k, 3)); // angular reach along the ring
      const zd = A * 0.34 * (1 + 6 * rp.z) / 6;  // axial reach, sized so the loop reads round ON the wall
      // the wash is a disc drawn ON the cylinder: every sample point is an
      // (angle, z) wall coordinate projected through ring(), so the patch
      // bends around the bore and foreshortens with depth — geometry, not a decal
      ctx.beginPath();
      for (let i = 0; i <= 28; i++) {
        const ph = i / 28 * TAU;
        const th = rp.a + A * Math.cos(ph);
        const r2 = ring(Math.max(0.012, rp.z + zd * Math.sin(ph)), gD);
        const sx = r2.x + Math.cos(th) * r2.r, sy = r2.y + Math.sin(th) * r2.r;
        i ? ctx.lineTo(sx, sy) : ctx.moveTo(sx, sy);
      }
      ctx.closePath();
      // healed: a neon-green wash that soaks the wall and drains away
      ctx.globalAlpha = 1;
      ctx.fillStyle = 'rgba(57,255,20,' + (DECOMP.fill * (1 - k)).toFixed(3) + ')';
      ctx.fill();
      ctx.globalAlpha = (1 - k) * DECOMP.edge;
      ctx.strokeStyle = 'rgba(57,255,20,1)';
      ctx.lineWidth = Math.max(0.8, 3 * sc * (1 - k));
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  if (!inGuide) drawBolts();
  if (killStreaks.length && !inGuide) { // reprogrammed packets tracing home along the wall
    const g2 = geo(), u = Math.min(W, H);
    const P = (aa, z) => { const rg = ring(z, g2); return { x: rg.x + Math.cos(aa) * rg.r, y: rg.y + Math.sin(aa) * rg.r, s: rg.s }; };
    ctx.globalCompositeOperation = 'lighter';
    const DUR = 0.15, RUN = 0.62; // a comet: one hot zip down the bore, gone in a blink
    for (const st of killStreaks) {
      const m = st.m || 1; // a high-combo kill launches a fatter, brighter comet
      const q = st.t / DUR;
      const heat = Math.pow(1 - q, 1.5);              // the head loses heat as it runs
      const glob = q < 0.7 ? 1 : (1 - q) / 0.3;       // the tail snuffs right after
      const zHead = st.z + RUN * (1 - Math.pow(1 - q, 2));   // the head eases forward
      const zTail = Math.max(st.z, zHead - RUN * (0.30 + 0.5 * q)); // the tail lets go late
      if (zTail >= SPAWN_Z) continue;
      const SEG = 6;
      for (let i = 0; i < SEG; i++) {
        const f0 = i / SEG, f1 = (i + 1) / SEG; // 0 = tail, 1 = head
        const z0 = Math.min(lerp(zTail, zHead, f0), SPAWN_Z), z1 = Math.min(lerp(zTail, zHead, f1), SPAWN_Z);
        const wa0 = 0.075 * m * (0.35 + f0 * 0.65), wa1 = 0.075 * m * (0.35 + f1 * 0.65); // fat at the head
        const c00 = P(st.a - wa0, z0), c01 = P(st.a + wa0, z0);
        const c11 = P(st.a + wa1, z1), c10 = P(st.a - wa1, z1);
        ctx.globalAlpha = glob * (0.30 + 0.70 * heat) * (0.05 + 0.14 * f0) * Math.min(1.4, m);
        ctx.fillStyle = 'rgb(126,226,98)';
        ctx.beginPath();
        ctx.moveTo(c00.x, c00.y); ctx.lineTo(c01.x, c01.y);
        ctx.lineTo(c11.x, c11.y); ctx.lineTo(c10.x, c10.y);
        ctx.closePath(); ctx.fill();
      }
      // white-hot filament along the spine, brightest at the head
      ctx.lineCap = 'round';
      for (let i = 0; i < SEG; i++) {
        const p0 = P(st.a, lerp(zTail, zHead, i / SEG)), p1 = P(st.a, Math.min(lerp(zTail, zHead, (i + 1) / SEG), SPAWN_Z));
        ctx.globalAlpha = glob * heat * (0.08 + 0.40 * (i / SEG));
        ctx.strokeStyle = 'rgba(228,255,220,0.95)';
        ctx.lineWidth = u * 0.0045 * m * (0.5 + (i / SEG));
        ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
      }
      ctx.lineCap = 'butt';
      const hp = P(st.a, Math.min(zHead, SPAWN_Z)); // the head: a hot green mote
      const hr = u * 0.016 * m * (hp.s / 0.4) * (0.45 + 0.55 * heat); // it shrinks as it cools
      const gl = ctx.createRadialGradient(hp.x, hp.y, 0, hp.x, hp.y, hr);
      gl.addColorStop(0, 'rgba(235,255,230,' + (0.8 * glob * heat).toFixed(2) + ')');
      gl.addColorStop(1, 'rgba(126,226,98,0)');
      ctx.globalAlpha = 1;
      ctx.fillStyle = gl;
      ctx.beginPath(); ctx.arc(hp.x, hp.y, hr, 0, TAU); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }
  ctx.textAlign = 'center';
  for (const p of inGuide ? [] : popups) {
    const al = clamp(p.life, 0, 1);
    ctx.font = '700 15px Audiowide, system-ui';
    const tw = ctx.measureText(p.text).width;
    const px = clamp(p.x, tw / 2 + 12, W - tw / 2 - 12); // plates stay on screen
    ctx.globalAlpha = al * 0.72; // backing plate so popups read over any traffic
    ctx.fillStyle = 'rgba(4,10,22,0.9)';
    roundRect(px - tw / 2 - 9, p.y - 15, tw + 18, 21, 6); ctx.fill();
    ctx.globalAlpha = al * 0.5;
    ctx.strokeStyle = p.color; ctx.lineWidth = 1;
    roundRect(px - tw / 2 - 9, p.y - 15, tw + 18, 21, 6); ctx.stroke();
    ctx.globalAlpha = al;
    ctx.fillStyle = p.color;
    ctx.fillText(p.text, px, p.y);
  }
  ctx.globalAlpha = 1; ctx.textAlign = 'left';
}
// The finishing chain, in order: vignette, film grain, colour grade, level tint,
// the HUD, the low-integrity warning, the damage flash, and the fade. Everything
// here paints OVER the world, so order within it is the whole design.
// The colour grade. Only its warm floor moves, and only with laneFlow — so it is
// rebuilt when that changes by a hundredth, which is finer than the eye can read
// on an 8% alpha wash and ~100x fewer builds than one a frame.
let gradeCv = null, gradeKey = '';
function gradeGrad() {
  const k = W + 'x' + H + ':' + Math.round(laneFlow * 100);
  if (gradeCv && gradeKey === k && gradeCtx === ctx) return gradeCv;
  const gr = ctx.createLinearGradient(0, 0, 0, H);
  gr.addColorStop(0, 'rgba(18,55,110,0.10)');   // cool up top
  gr.addColorStop(0.55, 'rgba(0,0,0,0)');
  // the warm floor is BOUNCE off the convoy, so it leaves with it — parked, the
  // frame grades cool top to bottom and the lane reads as cold open space
  gr.addColorStop(1, `rgba(255,150,50,${(0.08 * laneFlow).toFixed(3)})`);
  gradeCv = gr; gradeKey = k; gradeCtx = ctx;
  return gr;
}
// The level tint never changes WITHIN a level, so this is built once per relay
// instead of sixty times a second for its entire duration.
let tintCv = null, tintKey = '';
let gradeCtx = null, tintCtx = null;
function tintGrad(tint) {
  const k = W + 'x' + H + ':' + tint;
  if (tintCv && tintKey === k && tintCtx === ctx) return tintCv;
  const gr = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75);
  gr.addColorStop(0, `rgba(${tint},0)`);
  gr.addColorStop(1, `rgba(${tint},0.11)`);
  tintCv = gr; tintKey = k; tintCtx = ctx;
  return gr;
}
// The cinematic vignette: two stops, straight onto the frame. It used to be a
// full-screen cached canvas, which is 19MB to describe a gradient — see the note
// in buildBackgroundSeeded. The gradient object is what gets cached, and it is
// rebuilt only when the frame changes size.
function drawVignette() {
  if (!vignetteGrad) {
    vignetteGrad = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.42,
      W / 2, H / 2, Math.max(W, H) * 0.72);
    if (!vignetteGrad) return;
    vignetteGrad.addColorStop(0, 'rgba(0,0,0,0)');
    vignetteGrad.addColorStop(1, 'rgba(0,0,0,0.38)');
  }
  ctx.fillStyle = vignetteGrad;
  ctx.fillRect(0, 0, W, H);
}
function drawPostChain(rawDt, worldFx, g) {
  // cinematic vignette + color grade (under the HUD so controls stay crisp)
  drawVignette();
  // film-grain finish (ARCFX.grain) — skipped on struggling devices
  if (grainCv && !lowFX && state !== S.MENU) {
    ctx.globalAlpha = 0.05 * ARCFX.grain;
    const gox = (Math.floor(time * 24) * 97) % 256, goy = (Math.floor(time * 24) * 53) % 256;
    for (let gy = -goy; gy < H; gy += 256) for (let gx = -gox; gx < W; gx += 256)
      ctx.drawImage(grainCv, gx, gy);
    ctx.globalAlpha = 1;
  }
  // THE SAME LESSON drawStreaks ALREADY PAID FOR. Device profiling (OPPO
  // CPH2581, 2026-08-03) found the streak field's whole bill was CONSTRUCTING
  // gradients — five addColorStop()s each, every one handed a freshly allocated
  // rgba() string the backend has to CSS-parse — while the painting itself was
  // nearly free. These two are the same shape and were missed: two full-screen
  // gradients rebuilt from scratch 60 times a second, for the entire run.
  //
  // Both are cached on what they actually depend on. A CanvasGradient belongs to
  // the context that made it, so the cache is dropped when ctx is rebound
  // (withCanvas swaps it for the offscreen bakes) and when the frame resizes.
  ctx.fillStyle = gradeGrad();
  ctx.fillRect(0, 0, W, H);

  // per-level color identity: each relay tints the air at the edges
  if ((state === S.PLAY || state === S.PAUSE || state === S.INFO) && LV && LV.tint) {
    ctx.fillStyle = tintGrad(LV.tint);
    ctx.fillRect(0, 0, W, H);
  }

  if (state === S.PLAY) {
    drawHUD(g); drawDials(); drawWarpCal(); drawIntroCard(); drawNowPlaying();
    if (popLive('pause')) drawPause(); // resume: the panel erases behind its scan
    if (worldFx) ctx.restore(); // end the replay world fly-in (board overlay is NOT zoomed)
    // leaderboard<->player transition: the board rides ON TOP of the (paused)
    // replay — its cards fly out / the ring zooms into the lens, revealing the run
    if (replayXfer && replayPkg) { menuButtons = []; drawMenuBoard(); }
  }
  else if (state === S.PAUSE) { drawHUD(g); drawDials(); drawWarpCal(); drawIntroCard(); drawPause(); }
  else if (state === S.INFO) {
    drawHUD(g); drawDials(); drawWarpCal(); drawIntroCard(); drawInfoCard();
    // …AND THE PAUSE DISC'S ERASE. Pausing over the mission disc sets
    // pausedFromInfo, so RESUME lands back in S.INFO — a branch that never drew
    // drawPause, so the disc vanished on the frame it was told to close instead
    // of casting back out at the ring. Every state the pause key can be pressed
    // from now draws the cast on the way out.
    if (popLive('pause')) drawPause();
  }
  // NOTHING BUT THE DISC. The course is already running underneath, but none of
  // its furniture is drawn: no pads, no AWAITING RUNNER, no bore. All of it
  // arrives at once when the last disc lifts, which is the moment the player is
  // being handed the controls — showing it early spends that moment early.
  else if (state === S.ENLIST) drawEnlistment();
  else if (state === S.GUIDE) {
    // THE PAGE IS AN OVERLAY, and this branch draws what it sits ON. The screen
    // that opened the page keeps drawing AT FULL for as long as the page is
    // open. It is never faded and never replaced, so the context a player had
    // when they pressed the key is the context they still have while they read.
    //
    // What separates the two is the page's own mask — a full-screen fill that
    // comes in with the lineup and goes out with it (GUIDEFX.mask, 92-guide.js).
    // That fill IS the transition. Cross-fading the layer underneath was the
    // wrong idea twice over: it threw away the context, and the things that
    // could not fade with it were exactly the things that popped.
    //
    // The page itself is drawn at the very END of the frame, not here. See the
    // drawGuide call after drawMenuBadgeTop.
    if (guide && guide.from === 'pause') {
      drawHUD(g); drawDials(); drawWarpCal(); drawIntroCard(); drawPause();
    } else {
      drawMenu(g);
      // THE LOGO HOLDS ITS POST, exactly as it does under a settings popup.
      // drawMenuBadgeTop returns on any state but S.MENU, so the badge — the
      // brightest object on the home screen — used to vanish on the first frame
      // the page opened while everything around it was still at full.
      if (menuScreen === 'home' && menuBadge && !menuPopUp()) stampMenuBadge(g);
    }
    // …and none of its keys are live while the page owns the taps. guidePointer
    // is what the input dispatch calls in S.GUIDE, but a menu that painted its
    // hit rects would leave them in the list for anything that reads it later.
    menuButtons = [];
  }
  else if (state === S.MENU) {
    if (SPLASH.on && SPLASH.t < SPL.wheel) { /* boot stage one: only the tunnel
      breathes behind the badge — the menu waits for its wheel cue */ }
    else if (menuFx && menuFx.kind === 'launch') {
      const q = clamp(menuFx.t / menuFx.dur, 0, 1), e2 = q * q;
      ctx.save();
      ctx.translate(g.cx, g.cy); ctx.scale(1 + e2 * 1.7, 1 + e2 * 1.7); ctx.translate(-g.cx, -g.cy);
      ctx.globalAlpha = 1 - e2;
      drawMenu(g);
      ctx.restore();
    } else if (menuFx && menuFx.zoom) {
      // launch, run backwards: the menu lives BEHIND the run, so returning
      // from a level it drives back into view — oversized and faint, settling
      const q = clamp(menuFx.t / menuFx.dur, 0, 1), e2 = (1 - q) * (1 - q);
      ctx.save();
      ctx.translate(g.cx, g.cy); ctx.scale(1 + e2 * 1.7, 1 + e2 * 1.7); ctx.translate(-g.cx, -g.cy);
      ctx.globalAlpha = 1 - e2;
      drawMenu(g);
      ctx.restore();
    } else drawMenu(g);
  }
  else drawEnd(g);
  drawGpHints();

  // SYSTEM CRITICAL — the RING warns, not the screen. This pass used to tear
  // horizontal bands across the frame with a red offset line under each, which is
  // a broken-signal artefact: the language of a corrupted feed. The player is not
  // watching a feed. They are inside a bore, holding a ring, losing a hull. So
  // damage rides the hardware now: a warning wave sheds off the rim and washes
  // outward, faster and hotter as the payload goes, and the last block adds the
  // heartbeat vignette on top of it.
  if (state === S.PLAY && integrity <= 50) {
    const gi = (50 - integrity) / 50;
    // BURNED DRAWS — DO NOT DELETE. The tear pass pulled Math.random() every frame
    // it ran, and inside a run Math.random IS the seeded stream the boss reads
    // (see the boss board RNG note). Dropping those pulls would move the sim on
    // every board where the hull gets this low in a fight, and old replays would
    // stop agreeing with the boards they set. The draws stay, exactly as many and
    // in exactly the order the tear made them. Only the pixels are gone.
    if (Math.random() < 0.15 + gi * 0.35) {
      for (let i = 0; i < 1 + gi * 3; i++) { Math.random(); rand(2, 6 + gi * 10); rand(-30, 30); }
    }
    const per = 1.5 - gi * 0.85;                  // the alarm quickens as the hull goes
    ctx.save();
    ctx.lineCap = 'round';
    for (let i = 0; i < 2; i++) {
      const p2 = ((time / per) + i * 0.5) % 1;
      const rr = g.nodeR * (0.94 + p2 * 1.15);    // sheds off the rim, outward past the corners
      const a2 = (0.10 + gi * 0.26) * Math.sin(Math.PI * p2);
      if (a2 <= 0.004) continue;
      ctx.strokeStyle = 'rgba(255,70,90,' + a2.toFixed(3) + ')';
      ctx.lineWidth = 2 + gi * 5;
      ctx.beginPath(); ctx.arc(g.cx, g.cy, rr, 0, TAU); ctx.stroke();
    }
    // the rim itself, pulsing red under the wave that just left it
    const rp = (0.08 + gi * 0.30) * (0.45 + 0.55 * Math.sin(time * TAU / per));
    ctx.strokeStyle = 'rgba(255,60,80,' + Math.max(0, rp).toFixed(3) + ')';
    ctx.lineWidth = 2.5 + gi * 3;
    ctx.beginPath(); ctx.arc(g.cx, g.cy, g.nodeR, 0, TAU); ctx.stroke();
    ctx.restore();
    if (integrity <= 25) { // heartbeat vignette on the last block
      const pulse = (Math.sin(time * 5) * 0.5 + 0.5) * 0.22;
      const hv = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.72);
      hv.addColorStop(0, 'rgba(255,40,60,0)');
      hv.addColorStop(1, 'rgba(255,40,60,' + pulse.toFixed(2) + ')');
      ctx.fillStyle = hv; ctx.fillRect(0, 0, W, H);
    }
  }

  // red damage vignette
  if (redFlash > 0) {
    const v = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.7);
    v.addColorStop(0, 'rgba(255,40,60,0)');
    v.addColorStop(1, `rgba(255,40,60,${(redFlash * 0.4).toFixed(2)})`);
    ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
  }

  // screen-stitch fade between scenes
  if (fadeT > 0) {
    fadeT = Math.max(0, fadeT - rawDt);
    ctx.fillStyle = 'rgba(2,4,10,' + (fadeT / 0.35 * 0.9).toFixed(2) + ')';
    ctx.fillRect(-20, -20, W + 40, H + 40);
  }

  drawTrans(); // transitions + press feedback ride over everything
  drawMenuBadgeTop(g); // …except the logo, which rides over the press feedback
  // …AND THE FIELD GUIDE IS OVER ALL OF IT. The page used to draw down in the
  // state dispatch, which put it UNDER the press feedback and under the hub
  // badge — so the one thing on the home screen that draws at top z punched a
  // hole through the lineup. It is the top layer now. Nothing but the boot
  // curtain goes over it, and it no-ops when no page is open.
  drawGuide(g);
  drawSplash(rawDt); // …and the boot splash curtains the whole stage at launch
}

resize();
requestAnimationFrame(frame);
// offline capability + PWA installability (no-op on insecure origins)
// The service worker is for the WEB build only. Inside the Capacitor shell every
// asset is already on local storage, and androidScheme:"https" makes
// isSecureContext true there — so this registered anyway and sw.js's unbounded
// write-through cache copied the whole soundtrack into Cache Storage a second
// time. Up to ~40MB of duplicated audio, which the player sees as the app's size
// in Android settings, bought nothing at all.
if ('serviceWorker' in navigator && window.isSecureContext && !window.Capacitor) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
// A NOTE WRITTEN OFFLINE GETS ITS CHANCE HERE. openFeedback() also flushes, but a
// player who wrote one on a train and never opened the panel again would otherwise
// hold it until it aged out. Deferred well past boot on purpose: it needs an
// anonymous session, and nothing about a week-old note is urgent enough to compete
// with the first frames for the network.
setTimeout(() => { try { flushFeedback(); } catch (e) {} }, 4000);
// …and ask the browser for the device model once. It is a Client Hints call, so
// it is async and answered off the critical path; a note sent before it lands
// falls back to the coarse family the user agent still admits to.
try { fbDeviceInit(); } catch (e) {}
// boot: the splash decodes its score and tries to run it right away — the
// Capacitor app WebView allows it; desktop browsers that block autoplay let
// the first tap unlock it mid-sequence. Contexts without the splash (headless
// tests, the editor) keep the old behavior: straight to the menu track.
// (deferred a tick: the MUSIC_DATA manifest script below hasn't parsed yet)
setTimeout(() => {
  if (SPLASH.on) splashBoot();
  else if (state === S.MENU) playTrack('menu');
}, 0);
// NO SPLASH MEANS NO GATE, so those contexts pay the bake up front instead.
// The Lane Designer, the store-shot pages and anything else driving the clock
// itself get one blocking drain here — they freeze the world on frame one, so a
// hull that arrives on frame two arrives after the picture was taken. The
// headless harness is excluded by the same test the splash uses: no Image, no
// bake worth spending seconds on.
if (!SPLASH.on && typeof Image !== 'undefined') s3BreachDrain(20000);

// A NEW PLAYER NEVER SEES THE MENU. This is claimed HERE, at the end of boot and
// before the first frame, rather than when the splash ends — the splash reveals
// the menu underneath itself during its last two seconds (SPL.wheel), so routing
// on splashEnd let the wheel build, show, and then get replaced. Owning `state`
// up front means the menu is never constructed at all.
//
// Nobody who has qualified sees this again. Someone who met him but never
// finished the course gets the short re-entry instead of the full script.
if (!progress.tutorialDone) startEnlistment(progress.enlisted, true);
