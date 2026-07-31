'use strict';
// ---------- perf watchdog: shed visual load if the frame rate slips ----------
function perfWatch(rawDt) {
  if (lowFX || time < 5 || rawDt > 0.5) return; // ignore startup jank + tab-switch gaps
  perfAcc += rawDt; perfN++; perfWin += rawDt;
  if (perfWin >= 2) { // ~2s rolling window
    if (perfAcc / perfN > 1 / 42) { // sustained under ~42fps → permanently shed load
      lowFX = true;
      initStreaks();
      initDeepField();
      initLaneMedium();
      initAmbTraffic();
    }
    perfAcc = 0; perfN = 0; perfWin = 0;
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
// glitch: quick chromatic slice cut for menu screens. warp: a dive down the
// the lane for deploys. The action fires at the covered midpoint.
let trans = null;   // {mode, t, dur, mid, fired}
let transSnap = null; // derez: snapshot of the last frame, shredded strip by strip
let uiPress = null; // {x,y,w,h | sector, t, fn}
// choreographed menu moves: the wheel spins out/in, map panels fly in/out,
// deploys LAUNCH the whole menu at the viewer
let menuFx = null;  // {kind:'spinOut'|'spinIn'|'panelsIn'|'panelsOut'|'launch', t, dur, to, action}
function startTrans(mode, fn) {
  if (trans) { if (fn) fn(); return; }
  trans = { mode, t: 0, dur: mode === 'warp' ? 0.62 : mode === 'derez' ? 0.55 : 0.26, mid: fn, fired: false };
  if (mode === 'derez') {
    // RETRY = re-sync, not travel: freeze the failed frame and de-rez it in
    // place (the enemy-decompile language) while the fresh run boots beneath
    transSnap = null;
    try {
      transSnap = document.createElement('canvas');
      transSnap.width = canvas.width; transSnap.height = canvas.height;
      transSnap.getContext('2d').drawImage(canvas, 0, 0);
    } catch (e) { transSnap = null; }
    trans.mid = null; trans.fired = true;
    if (fn) fn();                       // the new run starts NOW, under the shreds
    tone(150, 0.4, 'square', 0.07, 48); // power-down thump...
    crackle(0.4, 2600, 220, 2, 0.5);    // ...through a burst of static
  }
  else if (mode === 'warp') {
    // packet flush: a descending whoosh as the run's data dives to the node,
    // then a bright rising ping at the switch as the next node blooms open
    tone(300, 0.34, 'sine', 0.12, 55); crackle(0.34, 2600, 380, 1.4, 0.35);
    tone(760, 0.2, 'sine', 0.11, 1240, undefined, 0.30);
  }
  else crackle(0.09, 1200, 3200, 2, 0.35);
}
function pressUI(rect, fn) { // micro-interaction: flash NOW, act on the beat
  uiPress = Object.assign({ t: 0, fn }, rect);
  sfx.tick();
  buzz(8);
}
function tickUI(dt) {
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
  if (menuHold && (state !== S.MENU || menuScreen !== 'map' || menuFx || menuConfirm)) menuHold = null;
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
        menuFx = f.to === 'map' ? { kind: 'panelsIn', t: 0, dur: 0.6, dir: -1 }
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
  if (trans.mode === 'derez') {
    // the failed frame de-rezzes in place: displaced strips, dropout, chroma
    // ghosts — drawn in the canvas's native space so it shreds the raw display
    if (transSnap && transSnap.width) {
      const cw2 = transSnap.width, ch2 = transSnap.height;
      const SN = 26, sh2 = ch2 / SN;
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      for (let i = 0; i < SN; i++) {
        if (Math.random() < q * 0.75) continue;              // strips wink out
        const jx = (Math.random() - 0.5) * cw2 * 0.3 * q;
        const yd = i * sh2 + (ch2 / 2 - i * sh2) * q * 0.12; // slight collapse
        ctx.globalAlpha = (1 - q) * (0.55 + Math.random() * 0.45);
        ctx.drawImage(transSnap, 0, i * sh2, cw2, sh2, jx, yd, cw2, Math.max(1, sh2 * (1 - q * 0.3)));
        if (i % 3 === 0) { // chromatic ghost trailing the strip
          ctx.globalAlpha = (1 - q) * 0.10;
          ctx.fillStyle = i % 6 === 0 ? 'rgb(255,60,90)' : 'rgb(111,227,255)';
          ctx.fillRect(jx * 1.6, yd, cw2, sh2 * 0.5);
        }
      }
      ctx.restore();
      ctx.globalAlpha = 1;
    }
    return;
  }
  if (trans.mode === 'glitch') {
    ctx.fillStyle = `rgba(2,4,10,${(cover * 0.9).toFixed(2)})`;
    ctx.fillRect(-20, -20, W + 40, H + 40);
    for (let i = 0; i < 9; i++) { // chromatic slices tearing sideways
      const y0 = i / 9 * H + Math.sin(i * 37.7 + trans.t * 90) * 4;
      const hh = H / 9 * (0.3 + 0.7 * Math.abs(Math.sin(i * 91.3 + trans.t * 47)));
      const off = Math.sin(i * 13.7 + trans.t * 71) * W * 0.2 * cover;
      ctx.fillStyle = i % 3 === 0 ? `rgba(255,60,90,${(cover * 0.22).toFixed(2)})`
        : i % 3 === 1 ? `rgba(111,227,255,${(cover * 0.22).toFixed(2)})`
        : `rgba(220,235,255,${(cover * 0.15).toFixed(2)})`;
      ctx.fillRect(off, y0, W, hh * cover);
    }
  } else { // warp: PACKET FLUSH — the run's data dives down the bore to the
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

// ---------- boot splash: GB Interactive → lane-glitch → WARP LANE ----------
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
  built: false         // wheel cue fired — the menu is building beneath us
};
// the beat sheet, in seconds against the 8.1s take. The finale is a staged
// build: reveal thins the curtain (the game's tunnel fades in), wheel cues
// the menu itself — the mode wheel spins in behind the badge and the corner
// furniture flies in from its nearest screen edge (see introE / menuIntroAt)
const SPL = { gb: 0.35, type: 1.3, glitch: 3.0, crush: 4.1, df: 4.3, settle: 5.5, reveal: 5.55, wheel: 6.35 };
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
  if (AC.state === 'suspended') AC.resume().catch(() => {}); // Capacitor allows it; browsers wait for a tap
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
    SPLASH.gain.connect(AC.destination);
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
function splashEnd(skip) {
  if (!SPLASH.on) return;
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
// per-row silhouette of an image's opaque pixels (normalized spans), computed
// once and cached on the element — lets the scan sweep hug the ART instead of
// the file's bounding box. Rows with no content collapse to a point.
function contentRows(img) {
  if (img.__rows) return img.__rows;
  if (!img.naturalWidth) return []; // not decoded yet — try again next frame
  try {
    const N = 48;
    const cv = document.createElement('canvas');
    cv.width = N; cv.height = N;
    const c2 = cv.getContext('2d', { willReadFrequently: true });
    c2.drawImage(img, 0, 0, N, N);
    const d = c2.getImageData(0, 0, N, N).data;
    const rows = [];
    for (let y = 0; y < N; y++) {
      let x0 = N, x1 = -1;
      for (let x = 0; x < N; x++) {
        if (d[(y * N + x) * 4 + 3] > 24) { if (x < x0) x0 = x; x1 = x; }
      }
      rows.push(x1 < 0 ? { x0: 0.5, x1: 0.5 } : { x0: x0 / N, x1: (x1 + 1) / N });
    }
    img.__rows = rows;
  } catch (e) { img.__rows = []; } // tainted/unreadable — callers fall back to the box
  return img.__rows;
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
function splashSlices(img, x, y, w2, h2, amt) {
  const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
  if (!iw || !ih) return;
  if (amt > 0.03) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha *= amt * 0.4;
    ctx.drawImage(img, x - amt * w2 * 0.07, y + amt * 3, w2, h2);
    ctx.drawImage(img, x + amt * w2 * 0.07, y - amt * 3, w2, h2);
    ctx.restore();
  }
  const bands = 12, bh2 = h2 / bands, sh = ih / bands;
  for (let i = 0; i < bands; i++) {
    const off = Math.random() < amt * 0.7 ? (Math.random() * 2 - 1) * amt * w2 * 0.22 : 0;
    ctx.drawImage(img, 0, sh * i, iw, sh, x + off, y + bh2 * i, w2, bh2);
  }
}
// full-screen artifacts riding over the card: shifted tint bands, raw data
// spray, drifting scanlines — everything scaled by amt
function splashStatic(amt) {
  if (amt <= 0.02) return;
  for (let i = 0, n = 2 + Math.floor(amt * 5); i < n; i++) {
    if (Math.random() > amt) continue;
    const ry = Math.random() * H, rh = rand(2, 6 + amt * 22);
    ctx.fillStyle = ['rgba(111,227,255,0.10)', 'rgba(212,101,255,0.09)', 'rgba(255,60,80,0.07)'][i % 3];
    ctx.fillRect(rand(-40, 40) * amt, ry, W, rh);
  }
  ctx.font = '10px monospace'; ctx.textAlign = 'left';
  const chars = '01<>#$/&:;';
  for (let i = 0, n = Math.floor(amt * 26); i < n; i++) {
    if (Math.random() < 0.5) continue;
    ctx.fillStyle = Math.random() < 0.7 ? 'rgba(111,227,255,0.35)' : 'rgba(126,226,98,0.3)';
    ctx.fillText(chars[(Math.random() * chars.length) | 0], Math.random() * W, Math.random() * H);
  }
  ctx.textAlign = 'center';
  ctx.fillStyle = `rgba(111,227,255,${(amt * 0.05).toFixed(3)})`;
  for (let sy = ((SPLASH.t * 40) % 6) - 6; sy < H; sy += 6) ctx.fillRect(0, sy, W, 1);
}
function drawSplash(rawDt) {
  if (!SPLASH.on) return;
  splashAudioTry();
  // the score is the master clock once it runs (rAF gaps can't drift it);
  // until then the frame clock stands in
  if (SPLASH.src && AC) SPLASH.t = SPLASH.startOff + (AC.currentTime - SPLASH.startAC);
  else SPLASH.t += clamp(rawDt, 0, 0.05);
  if (SPLASH.t >= SPLASH.dur) { splashEnd(false); return; }
  const t = SPLASH.t, u = Math.min(W, H);
  const ss = (a, b) => { const q = clamp((t - a) / (b - a), 0, 1); return q * q * (3 - 2 * q); };
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
  // the curtain: opaque through the build, thinning through the reveal — the
  // LIVE tunnel painted underneath is what shows through (the menu itself
  // waits for the wheel cue)
  ctx.globalAlpha = 1 - ss(SPL.reveal, SPL.reveal + 0.95);
  ctx.fillStyle = 'rgb(2,4,10)';
  ctx.fillRect(-20, -20, W + 40, H + 40);
  ctx.globalAlpha = 1;
  // tear intensity: one micro-glitch tease, then the build to the crush,
  // then a decaying after-shudder while the badge locks in
  let glitchAmt = t < SPL.glitch
    ? 0
    : t < SPL.df
      ? Math.pow((t - SPL.glitch) / (SPL.df - SPL.glitch), 1.5)
      : Math.max(0, 1 - (t - SPL.df) / (SPL.settle - SPL.df)) * 0.7;
  if (t > 2.45 && t < 2.58) glitchAmt = 0.3; // the first flicker of trouble

  // ---- card one: the GB mark over black ----
  if (t < SPL.df) {
    const crushQ = clamp((t - SPL.crush) / (SPL.df - SPL.crush), 0, 1);
    const gbA = ss(SPL.gb, SPL.gb + 1.15);
    const gcx = W / 2, gcy = H * 0.44, gw = u * 0.51;
    if (gbA > 0) {
      ctx.save();
      // CRT power-off: the whole card squeezes into a hot horizontal filament
      ctx.translate(gcx, gcy);
      ctx.scale(1 + crushQ * 0.6, Math.max(0.004, Math.pow(1 - crushQ, 2)));
      ctx.translate(-gcx, -gcy);
      ctx.globalAlpha = gbA * (glitchAmt > 0.05 && Math.random() < glitchAmt * 0.5 ? rand(0.55, 0.95) : 1);
      const gh = GBIMG.w ? gw * GBIMG.h / GBIMG.w : 0;
      if (GBIMG.w) {
        const gx = gcx - gw / 2, gy = gcy - gh / 2 - u * 0.05;
        if (glitchAmt > 0.03) splashSlices(GBIMG.img, gx, gy, gw, gh, glitchAmt);
        else ctx.drawImage(GBIMG.img, gx, gy, gw, gh);
      }
      // the studio tag types itself out under the mark
      const shown = Math.floor(clamp((t - SPL.type) / 0.055, 0, GB_TAG.length));
      if (shown > 0) {
        const fs = Math.max(14, Math.round(u * 0.052));
        ctx.font = '500 ' + fs + 'px Audiowide, system-ui';
        try { ctx.letterSpacing = (fs * 0.14).toFixed(1) + 'px'; } catch (e) {}
        const ty = gcy + gh / 2 + u * 0.055;
        const jx = glitchAmt > 0.1 ? rand(-1, 1) * glitchAmt * 8 : 0;
        ctx.fillStyle = 'rgba(225,240,255,0.92)';
        ctx.fillText(GB_TAG.slice(0, shown), gcx + jx, ty);
        if (t < SPL.glitch && (shown < GB_TAG.length || Math.sin(t * 9) > -0.2)) { // block cursor
          const tw = ctx.measureText(GB_TAG.slice(0, shown)).width;
          ctx.fillStyle = 'rgba(111,227,255,0.85)';
          ctx.fillRect(gcx + jx + tw / 2 + fs * 0.18, ty - fs * 0.78, fs * 0.5, fs * 0.92);
        }
        try { ctx.letterSpacing = '0px'; } catch (e) {}
      }
      ctx.restore();
      if (crushQ > 0) { // the filament flash at the heart of the collapse
        ctx.globalAlpha = Math.sin(crushQ * Math.PI);
        ctx.fillStyle = 'rgba(235,250,255,0.9)';
        const fw = u * 0.6 * (1 - crushQ * 0.5);
        ctx.fillRect(gcx - fw / 2, gcy - 1, fw, 2);
        ctx.globalAlpha = 1;
      }
    }
  }

  // ---- card two: the badge materializes where the menu's hub holds it ----
  if (t >= SPL.df) {
    const b = splashBadge();
    const inQ = ss(SPL.df, SPL.settle);
    if (b) {
      const amt = Math.pow(1 - inQ, 2);
      ctx.save();
      ctx.globalAlpha = Math.min(1, inQ * 1.6) * (Math.random() < amt * 0.4 ? rand(0.5, 0.9) : 1);
      const iw = b.img.naturalWidth || 1, ih = b.img.naturalHeight || 1;
      // the print clip: only what the scan has passed exists — ONE clean rect,
      // so no band seams or missing strips ever cross the art (the glitch
      // texture below is strictly additive: it can add light, never cut black)
      if (inQ < 1) {
        ctx.beginPath();
        ctx.rect(b.x - b.w * 0.1, b.y - b.h * 0.05, b.w * 1.2, b.h * 0.05 + b.h * inQ + 3);
        ctx.clip();
      }
      if (amt > 0.03) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha *= amt * 0.4; // chromatic ghosts fade as it locks
        ctx.drawImage(b.img, b.x - amt * b.w * 0.06, b.y, b.w, b.h);
        ctx.drawImage(b.img, b.x + amt * b.w * 0.06, b.y, b.w, b.h);
        // a few displaced echo slices sparking off the printed part
        ctx.globalAlpha = Math.min(1, inQ * 1.6) * amt * 0.35;
        for (let i = 0; i < 3; i++) {
          if (Math.random() > amt * 0.8) continue;
          const fy = Math.random() * inQ, fh = rand(0.03, 0.08);
          ctx.drawImage(b.img, 0, fy * ih, iw, fh * ih,
            b.x + (Math.random() * 2 - 1) * amt * b.w * 0.15, b.y + fy * b.h, b.w, fh * b.h);
        }
        ctx.restore();
      }
      ctx.drawImage(b.img, b.x, b.y, b.w, b.h); // the print itself — whole and seamless
      if (inQ < 1) { // a scan sweep rakes down the badge as it forms — form-
        // fitting: it enters at the GB mark's CONTENT width and converges onto
        // the shield's per-row silhouette, printing one brand as the other
        const sy = b.y + b.h * inQ;
        const rows = contentRows(b.img);
        const row = rows.length ? rows[clamp(Math.floor(inQ * rows.length), 0, rows.length - 1)] : null;
        const rx = row ? b.x + row.x0 * b.w : b.x, rw = row ? (row.x1 - row.x0) * b.w : b.w;
        let gbW = 0; // GB content width, as a fraction of its file
        for (const r of contentRows(GBIMG.img)) gbW = Math.max(gbW, r.x1 - r.x0);
        if (!gbW) gbW = 0.9; // silhouette unavailable — assume most of the file
        const blend = clamp(inQ * 2.5, 0, 1); // the GB echo dies a third of the way down
        const swW = u * 0.51 * gbW * (1 - blend) + rw * blend;
        const sx = (b.x + b.w / 2) * (1 - blend) + (rx + rw / 2) * blend - swW / 2;
        const gsc = ctx.createLinearGradient(0, sy - b.h * 0.18, 0, sy);
        gsc.addColorStop(0, 'rgba(111,227,255,0)');
        gsc.addColorStop(1, 'rgba(111,227,255,0.35)');
        ctx.fillStyle = gsc;
        ctx.fillRect(sx, sy - b.h * 0.18, swW, b.h * 0.18);
        ctx.fillStyle = 'rgba(235,250,255,0.8)';
        ctx.fillRect(sx, sy, swW, 1.5);
      }
      ctx.restore();
    }
  }

  splashStatic(glitchAmt);
  const fl = 1 - clamp(Math.abs(t - SPL.df) / 0.09, 0, 1); // the white pop at the cut
  if (fl > 0) {
    ctx.globalAlpha = fl * 0.5;
    ctx.fillStyle = '#eaf6ff';
    ctx.fillRect(-20, -20, W + 40, H + 40);
  }
  ctx.restore();
}

function frame(now) {
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
    // roll the victory clear-sweep frame-side while a replay plays/holds its finish
    // (the sim's S.END advance never runs during a replay)
    if (replaying && endWin && endSweep >= 0 && endSweep < SPAWN_Z + 0.4) endSweep += dt * 2.1;
  }
  // ease the sfx bus toward its target (real clock: fades even while the replay
  // is paused/scrubbing) — smooths the replay enter + scrub-knob mute/unmute
  sfxFade += (sfxFadeTgt - sfxFade) * Math.min(1, rawDt * sfxFadeRate);
  if (sfxGain) sfxGain.gain.value = sfxBusGain();
  if (state !== S.PLAY) stripSound(false, 0); // pause/menus never hold the drone
  ambient(state === S.PLAY); // the tunnel bed breathes only during play
  prof('bg');

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
  if (bgCanvas) ctx.drawImage(bgCanvas, 0, 0, W, H);
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

  const bz = drawHolderRing(g);
  // the field guide is its own page: the frozen run's world (ring FX, bodies,
  // pickups, nodes, HUD popups) stays out of sight while it's open
  const inGuide = state === S.GUIDE;
  // EVERYTHING ON THE BAND POWERS DOWN WITH THE RUN. rimFX and latches only
  // decay while the sim is in PLAY, so at the report they hang on the rim
  // forever — the last few hits frozen as bright arcs, and a banked shield still
  // bathing the whole ring in charge. The ceremony fades the lot out.
  //
  // And it is ZERO wherever the physical ring itself isn't drawn. The band FX
  // are lighting ON that hardware: in a menu or the Archive there is no ring to
  // light, so a run's last hits were floating in the middle of the case-file
  // chooser as bare arcs. Nothing on the band outlives the ring it sits on.
  const hw = state === S.MENU || inGuide ? 0 : endPower();
  prof('bandFX');
  drawBandFX(now, g, bz, hw);
  prof('enemies');
  const sorted = (inGuide || runVis <= 0.004) ? [] : enemies.slice().sort((a, b) => b.z - a.z);
  if (runVis < 1) { ctx.save(); ctx.globalAlpha *= runVis; }
  for (const en of sorted) if (en.lineLead) drawLineBeam(en, g); // beams sit under the traps
  for (const en of sorted) drawEnemy(en, g);
  for (const gh of (inGuide || runVis <= 0.004) ? [] : ghosts) drawGhost(gh, g); // dead bodies de-rezzing in place
  for (const p of (inGuide || runVis <= 0.004) ? [] : pickups) drawPickup(p, g);
  if (runVis < 1) ctx.restore();
  if (hw > 0.004) drawPulseWave(g); // a fired pulse is hardware too — it goes with the ring
  drawClearSweep(g);
  if (boss && state !== S.MENU && !inGuide) drawBoss(g);

  if (state !== S.MENU && !inGuide && hw > 0.004) { // the arcs and their orbs, same fade
    if (hw < 1) { ctx.save(); ctx.globalAlpha = hw; }
    drawNodes(g);
    drawVolley(g);
    if (hw < 1) ctx.restore();
  }

  prof('ephemera');
  drawEphemera(inGuide);

  prof('postChain');
  drawPostChain(rawDt, worldFx, g);

  ctx.restore();
  if (profOn()) { profFrame(performance.now() - now); drawProfiler(); }
  requestAnimationFrame(frame);
}
// Light ON the ring hardware: reactive rim segments, the shield collar and its
// flash. Scaled by hw, which is zero wherever the physical ring isn't drawn —
// band FX must never outlive the ring they sit on.
function drawBandFX(now, g, bz, hw) {
  // reactive rim: zaps and misses light the segment they happened on
  for (const fx2 of hw <= 0.004 ? [] : rimFX) {
    const al = Math.min(1, (fx2.t / 0.45) * 0.85) * hw;
    ctx.strokeStyle = 'rgba(' + fx2.col + ',' + al.toFixed(2) + ')';
    ctx.lineWidth = bz * 0.7;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(g.cx, g.cy, g.nodeR + bz / 2, fx2.a - 0.3, fx2.a + 0.3); ctx.stroke();
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
    // FIREWALL SHIELD: the monolith ITSELF runs hot — the whole band bathes
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
        const wa0 = 0.075 * (0.35 + f0 * 0.65), wa1 = 0.075 * (0.35 + f1 * 0.65); // fat at the head
        const c00 = P(st.a - wa0, z0), c01 = P(st.a + wa0, z0);
        const c11 = P(st.a + wa1, z1), c10 = P(st.a - wa1, z1);
        ctx.globalAlpha = glob * (0.30 + 0.70 * heat) * (0.05 + 0.14 * f0);
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
        ctx.lineWidth = u * 0.0045 * (0.5 + (i / SEG));
        ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
      }
      ctx.lineCap = 'butt';
      const hp = P(st.a, Math.min(zHead, SPAWN_Z)); // the head: a hot green mote
      const hr = u * 0.016 * (hp.s / 0.4) * (0.45 + 0.55 * heat); // it shrinks as it cools
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
function drawPostChain(rawDt, worldFx, g) {
  // cinematic vignette + color grade (under the HUD so controls stay crisp)
  if (vignetteCanvas) ctx.drawImage(vignetteCanvas, 0, 0, W, H);
  // film-grain finish (ARCFX.grain) — skipped on struggling devices
  if (grainCv && !lowFX && state !== S.MENU) {
    ctx.globalAlpha = 0.05 * ARCFX.grain;
    const gox = (Math.floor(time * 24) * 97) % 256, goy = (Math.floor(time * 24) * 53) % 256;
    for (let gy = -goy; gy < H; gy += 256) for (let gx = -gox; gx < W; gx += 256)
      ctx.drawImage(grainCv, gx, gy);
    ctx.globalAlpha = 1;
  }
  const grade = ctx.createLinearGradient(0, 0, 0, H);
  grade.addColorStop(0, 'rgba(18,55,110,0.10)');   // cool up top
  grade.addColorStop(0.55, 'rgba(0,0,0,0)');
  // the warm floor is BOUNCE off the convoy, so it leaves with it — parked, the
  // frame grades cool top to bottom and the lane reads as cold open space
  grade.addColorStop(1, `rgba(255,150,50,${(0.08 * laneFlow).toFixed(3)})`);
  ctx.fillStyle = grade;
  ctx.fillRect(0, 0, W, H);

  // per-level color identity: each relay tints the air at the edges
  if ((state === S.PLAY || state === S.PAUSE || state === S.INFO) && LV && LV.tint) {
    const tg2 = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75);
    tg2.addColorStop(0, `rgba(${LV.tint},0)`);
    tg2.addColorStop(1, `rgba(${LV.tint},0.11)`);
    ctx.fillStyle = tg2;
    ctx.fillRect(0, 0, W, H);
  }

  if (state === S.PLAY) {
    drawHUD(g); drawDials(); drawIntroCard(); drawNowPlaying();
    if (popLive('pause')) drawPause(); // resume: the panel erases behind its scan
    if (worldFx) ctx.restore(); // end the replay world fly-in (board overlay is NOT zoomed)
    // leaderboard<->player transition: the board rides ON TOP of the (paused)
    // replay — its cards fly out / the ring zooms into the lens, revealing the run
    if (replayXfer && replayPkg) { menuButtons = []; drawMenuBoard(); }
  }
  else if (state === S.PAUSE) { drawHUD(g); drawDials(); drawIntroCard(); drawPause(); }
  else if (state === S.INFO) { drawHUD(g); drawDials(); drawIntroCard(); drawInfoCard(); }
  else if (state === S.GUIDE) drawGuide(g);
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

  // system-critical glitches — the screen itself degrades with the payload
  if (state === S.PLAY && integrity <= 50) {
    const gi = (50 - integrity) / 50;
    if (Math.random() < 0.15 + gi * 0.35) {
      for (let i = 0; i < 1 + gi * 3; i++) {
        const gy = Math.random() * H, gh = rand(2, 6 + gi * 10);
        ctx.fillStyle = 'rgba(90,220,255,' + (0.04 + gi * 0.07).toFixed(2) + ')';
        ctx.fillRect(0, gy, W, gh);
        ctx.fillStyle = 'rgba(255,60,80,' + (0.03 + gi * 0.06).toFixed(2) + ')';
        ctx.fillRect(rand(-30, 30), gy + gh, W, 2);
      }
    }
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
  drawSplash(rawDt); // …and the boot splash curtains the whole stage at launch
}

resize();
requestAnimationFrame(frame);
// offline capability + PWA installability (no-op on insecure origins)
if ('serviceWorker' in navigator && window.isSecureContext) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
// boot: the splash decodes its score and tries to run it right away — the
// Capacitor app WebView allows it; desktop browsers that block autoplay let
// the first tap unlock it mid-sequence. Contexts without the splash (headless
// tests, the editor) keep the old behavior: straight to the menu track.
// (deferred a tick: the MUSIC_DATA manifest script below hasn't parsed yet)
setTimeout(() => {
  if (SPLASH.on) splashBoot();
  else if (state === S.MENU) playTrack('menu');
}, 0);
