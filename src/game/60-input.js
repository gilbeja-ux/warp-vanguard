'use strict';
// ---------- input ----------
const pointers = {}; // id -> { side, lastA }
const isLandscape = () => W > H;
function dialCenter(side) {
  if (isLandscape()) {
    // corner dials, proportioned like the mock. the SAME inset on both sides
    // (whichever notch is bigger) keeps the pads symmetric to the centered rim —
    // per-side insets made one pad sit farther from the rim than the other.
    // raised from 0.75 H to where thumbs naturally rest when gripping the device.
    // geometry is capped at phone scale: on a desktop window H is 2-3x a phone's,
    // and uncapped dials swallowed the bore (and hid the pickup feedback under them)
    const hh = Math.min(H, 560);
    const r = hh * 0.21, my = H - hh * 0.36 - SAFE.b * 0.5;
    const inset = Math.max(SAFE.l, SAFE.r);
    const cx = W / 2, edge = hh * 0.25 + inset;   // the natural bottom-corner inset — phones rest here
    const nodeR = Math.min(W, H) * 0.44;          // the bore the pads flank
    // on a wide desktop the corners sit far from the bore; don't let the pads hug the
    // screen edges — cap their spread so they stay just outside the ring, within reach
    const spread = Math.min(cx - edge, nodeR + r + 100);
    return side === 'L' ? { x: cx - spread, y: my, r } : { x: cx + spread, y: my, r };
  }
  const m = Math.min(W, H) * 0.17;
  return side === 'L' ? { x: m * 0.95, y: H - m * 0.95, r: m * 0.72 } : { x: W - m * 0.95, y: H - m * 0.95, r: m * 0.72 };
}
// go fullscreen + lock landscape whenever we aren't already — retried on every
// touch so exiting fullscreen (or a failed first attempt) recovers on the next tap.
// Works on Android Chrome; iPhone Safari has no element fullscreen — there the
// home-screen standalone mode is the fullscreen path.
const inStandalone = () =>
  // Native Capacitor app: the OS already forces landscape + immersive fullscreen,
  // so it's chromeless — hide the fullscreen button and don't fight it.
  (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) ||
  (window.matchMedia && window.matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches) ||
  navigator.standalone;
function toggleFullscreen() {
  try {
    if (document.fullscreenElement || document.webkitFullscreenElement) {
      (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      return;
    }
    const el = document.documentElement;
    const req = el.requestFullscreen || el.webkitRequestFullscreen;
    if (!req) { popup(W / 2, H * 0.32, 'FULLSCREEN NOT SUPPORTED IN THIS BROWSER', '#ff9a3c'); return; }
    const fs = req.call(el);
    if (fs && fs.then) {
      fs.then(() => {
        if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {});
      }).catch(err => popup(W / 2, H * 0.32, 'FULLSCREEN BLOCKED: ' + ((err && err.name) || err), '#ff9a3c'));
    }
  } catch (e) { popup(W / 2, H * 0.32, 'FULLSCREEN ERROR: ' + (e.name || e), '#ff9a3c'); }
}
function tryLockLandscape() {
  try {
    if (document.fullscreenElement || document.webkitFullscreenElement) return;
    if (inStandalone()) return; // installed PWA is already chromeless — don't fight it
    const el = document.documentElement;
    const req = el.requestFullscreen || el.webkitRequestFullscreen;
    if (!req) return;
    const fs = req.call(el);
    if (fs && fs.then) {
      fs.then(() => screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape')).catch(() => {});
    }
  } catch (e) {}
}
function pointerAngle(side, px, py) {
  const d = dialCenter(side);
  return Math.atan2(py - d.y, px - d.x);
}
canvas.addEventListener('pointerdown', e => {
  // A real pointer takes the menus back off controller focus. gpNav latches true
  // the first time an arrow key or stick moves focus and never cleared, so the
  // focused key kept wearing its ring long after the player went back to
  // touching the screen — a box following the cursor around and hanging over
  // transitions. This is the same rule browsers use for :focus-visible: show the
  // ring for keyboard navigation, hide it the moment a pointer is used.
  gpNav = false;
  audio();
  if (e.pointerType === 'touch') tryLockLandscape();
  if (SPLASH.on) { splashTap(); return; } // the splash eats the tap — unlock or skip
  const P = evPos(e);
  // ?padtest: the diagnostic panel doubles as the WebHID grant button — the
  // permission prompt may only open inside a user gesture, and this click is
  // that gesture. ONLY while nothing is granted yet, though: the panel sits
  // over the menu's own bottom-left UI, and a permanent whole-panel click
  // zone was re-arming the full-blast test burst on ordinary menu taps —
  // "random vibrations", straight from the diagnostic itself. Once a device
  // is adopted, plain clicks fall through to the game; SHIFT-click re-runs
  // the burst (WebHID is desktop-only, so a keyboard is always there).
  if (PAD_TEST && padTestRect && P.x > padTestRect.x && P.x < padTestRect.x + padTestRect.w &&
      P.y > padTestRect.y && P.y < padTestRect.y + padTestRect.h &&
      (e.shiftKey || (typeof hidDev !== 'undefined' && !hidDev))) {
    padTestClick();
    return;
  }
  if (state === S.INFO) {
    // the PAUSE key works over the mission disc — the one tap here that does
    // something other than dismiss. Every tap used to feed the dismiss branch,
    // so the button drew as a button and acted as more disc.
    if (!infoOutAt && pauseBtnRect && P.x > pauseBtnRect.x - 8 && P.x < pauseBtnRect.x + pauseBtnRect.w + 8 &&
        P.y > pauseBtnRect.y - 8 && P.y < pauseBtnRect.y + pauseBtnRect.h + 8) {
      pressUI(pauseBtnRect); pausedFromInfo = true; state = S.PAUSE; return;
    }
    // H-07: the BACK arrow (top-right) exits the pre-warp disc to the lane chart.
    if (!infoOutAt && discBackRect && P.x > discBackRect.x - 8 && P.x < discBackRect.x + discBackRect.w + 8 &&
        P.y > discBackRect.y - 8 && P.y < discBackRect.y + discBackRect.h + 8) {
      pressUI(discBackRect); discBack(); return;
    }
    // A PRE-RUN disc is the pre-warp screen (72-tick): this touch is a GRIP, not
    // a dismissal — fall through to the boot gate below, which registers the
    // pointer on its pad exactly as the parked lane would. Both thumbs down is
    // what releases the disc. Mid-run cards still take the tap.
    if (!preLaunch()) {
      if (!infoOutAt && time - infoShownAt > 0.35) { infoOutAt = time; sfx.tick(); }
      return;
    }
  }
  if (state === S.ENLIST) { enlistTap(); return; } // no menu, no skip — forward only
  if (state === S.GUIDE) { guidePointer(P); return; }
  if (state === S.MENU) {
    // overlay + gear act immediately; the level list uses tap-vs-drag on release
    const hitRect = (r, m) => r && P.x > r.x - m && P.x < r.x + r.w + m && P.y > r.y - m && P.y < r.y + r.h + m;
    if (report || myData || menuSettings || menuConfirm || hitRect(menuGearRect, 8) || hitRect(menuFsRect, 6) || hitRect(menuGuideRect, 8)) {
      menuTap(P.x, P.y, e.pointerId);
      return;
    }
    // hidden dev gesture: press-and-hold the final relay to charge the CORE duel
    if (menuScreen === 'map' && !menuFx) {
      const last = LEVELS.length - 1;
      const nb = menuButtons.find(b2 => b2.node === last && P.x > b2.x && P.x < b2.x + b2.w && P.y > b2.y && P.y < b2.y + b2.h);
      if (nb) menuHold = { node: last, t: 0, x: P.x, y: P.y };
      // the ↺ key: press-and-hold to open the reset-campaign confirm
      if (resetIconRect && P.x > resetIconRect.x && P.x < resetIconRect.x + resetIconRect.w
        && P.y > resetIconRect.y && P.y < resetIconRect.y + resetIconRect.h)
        resetHold = { t: 0, x: P.x, y: P.y };
    }
    // on the board screen, note which scroll region the drag began in
    let bZone = null, bScroll0 = 0;
    if (menuScreen === 'board') {
      const inR = r => r && P.x > r.x && P.x < r.x + r.w && P.y > r.y && P.y < r.y + r.h;
      if (inR(boardRects.list)) { bZone = 'list'; bScroll0 = boardListScroll; }
      else if (inR(boardRects.left)) { bZone = 'left'; bScroll0 = boardLeftScroll; }
    }
    menuPtr = { id: e.pointerId, x: P.x, y: P.y, scroll0: menuScroll, camp0: campScroll, lastX: P.x, lastT: e.timeStamp || 0, vx: 0, moved: false, bZone, bScroll0 };
    return;
  }
  if (state === S.END)  { endTap(P.x, P.y); return; }
  if (state === S.PAUSE) { pauseTap(P.x, P.y, e.pointerId); return; }
  // watching a replay: the trace drives the sim — only the transport chrome
  // responds, all gameplay input is swallowed
  if (replaying) {
    if (replayXfer) return; // input frozen while the enter/exit transition plays
    const C = replayCtrls, hit = r => r && P.x > r.x - 8 && P.x < r.x + r.w + 8 && P.y > r.y - 8 && P.y < r.y + r.h + 8;
    const arc = replayArcHit(P.x, P.y);
    if (hit(C.back)) { pressUI(C.back); replayXfer = { dir: -1, t: 0 }; replayPaused = true; } // fly back to the board
    else if (hit(C.play)) { if (replayEnded) { reseedReplay(); replayEnded = false; replayPaused = false; } else replayPaused = false; sfx.tick(); } // play, or RESTART when ended
    else if (hit(C.pause)) { replayPaused = true; sfx.tick(); }
    else if (hit(C.slow)) replaySetSpeed(-1);
    else if (hit(C.fast)) replaySetSpeed(1);
    else if (arc !== null) { replayScrub = { id: e.pointerId }; replayEnded = false; sfxFade = sfxFadeTgt = 0; musicScrubT = -1; replaySeekFrac(arc); } // grab the arc — mute sfx, duck music to a scrub preview
    return;
  }
  // pause button (generous hit area)
  if (pauseBtnRect && P.x > pauseBtnRect.x - 8 && P.x < pauseBtnRect.x + pauseBtnRect.w + 8 &&
      P.y > pauseBtnRect.y - 8 && P.y < pauseBtnRect.y + pauseBtnRect.h + 8) {
    pressUI(pauseBtnRect); state = S.PAUSE; return;
  }
  // boot gate: any grip during the intro registers as a placed thumb.
  // (S.INFO reaches here only for a pre-run disc — see the fall-through above)
  if ((state === S.PLAY || state === S.INFO) && introT < INTRO_DUR) {
    if (e.pointerType === 'mouse') { padHold[0] = padHold[1] = true; } // desktop fallback
    else if (P.x < W / 2) padHold[0] = true;
    else padHold[1] = true;
  }
  // charged pulse orbs: tapping a ready core fires that node's wave, solo.
  // The duel runs on this verb — only the ceremony and the death keep it shut
  if (!boss || (boss.introT >= BOSS_CER && boss.dying === undefined)) {
    for (let i = 0; i < 2; i++) {
      if (pulseCharge[i] < PULSE_MAX || nodes[i].deadT > 0) continue; // fried pads stay dark
      const d = dialCenter(i === 0 ? 'L' : 'R');
      if (Math.hypot(P.x - d.x, P.y - d.y) < d.r * 0.5) {
        firePulse(i);
        return; // the orb owns this tap — no drag starts from it
      }
    }
  }
  const side = P.x < W / 2 ? 'L' : 'R';
  const a0 = pointerAngle(side, P.x, P.y);
  // replant rules: a touch ON the pad NAMES that bearing. The carriage RUNS to it
  // (slewNodes) and arrives under the finger, so a lift-and-replant still ends
  // with thumb and knob together — it simply cannot cross the ring for free any
  // more. This used to be an outright assignment, which is the same teleport the
  // stick was fixed for: tap the far side of a pad and the emitter was through a
  // live dead zone without ever occupying it.
  //
  // Off-pad touches (a drifted grip) stay relative, with the old magnetic snap
  // when close — and a far grab CANCELS any pending run, or the finger's deltas
  // and a leftover bearing would both drive the same carriage.
  //
  // A THUMB THAT LANDS WHERE THE CARRIAGE ALREADY IS HAS NO JOURNEY, and naming a
  // bearing it has already reached would cost the resting-thumb case — far the
  // commonest one — its zero lag: the first drag would steer a destination for a
  // tick instead of moving the knob. So the trivial landing names nothing.
  const ni = side === 'L' ? 0 : 1;
  const dc = dialCenter(side);
  const onPad = Math.hypot(P.x - dc.x, P.y - dc.y) <= dc.r * 1.15;
  const takes = onPad || Math.abs(angDiff(a0, nodes[ni].angle)) < 0.6;
  nodes[ni].slew = (takes && Math.abs(angDiff(a0, nodes[ni].angle)) > 1e-6) ? a0 : null;
  pointers[e.pointerId] = { side, lastA: a0, px: P.x, py: P.y };
  canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', e => {
  const P = evPos(e);
  // scrubbing a replay: the finger's angle around the bore → seek along the run
  if (replayScrub && replayScrub.id === e.pointerId) { replaySeekFrac(replayArcProg(P.x, P.y)); return; }
  if (state === S.GUIDE) return; // the guide is tap-only
  // a drag cancels the final-relay hold — this is a still press, not a scroll
  if (menuHold && Math.hypot(P.x - menuHold.x, P.y - menuHold.y) > 10) menuHold = null;
  if (resetHold && Math.hypot(P.x - resetHold.x, P.y - resetHold.y) > 12) resetHold = null;
  if (menuPtr && menuPtr.id === e.pointerId && state === S.MENU && !menuSettings) {
    if (menuScreen === 'board' && menuPtr.bZone) { // drag-scroll the left list or the ring list
      const dyb = P.y - menuPtr.y;
      if (Math.abs(dyb) > 5) menuPtr.moved = true;
      if (menuPtr.bZone === 'list') boardListScroll = menuPtr.bScroll0 - dyb; // clamped at draw
      else boardLeftScroll = menuPtr.bScroll0 - dyb;
      return;
    }
    if (menuScreen === 'camps' && !menuFx) { // swipe the carousel — discs follow the finger
      const dxp = P.x - menuPtr.x;
      if (Math.abs(dxp) > 6) menuPtr.moved = true;
      const step = Math.min(H * 0.34, W * 0.185) * 2.3;
      const total = discCount();
      campScroll = campScrollTgt = clamp((menuPtr.camp0 || 0) - dxp / step, -0.35, total - 0.65);
      campPendingSync = null; // a manual swipe cancels a queued dive
      const dtm = ((e.timeStamp || 0) - menuPtr.lastT) || 16;
      menuPtr.vx = (P.x - menuPtr.lastX) / dtm * 1000; // px/s, for the release flick
      menuPtr.lastX = P.x; menuPtr.lastT = e.timeStamp || 0;
      return;
    }
    const dy = P.y - menuPtr.y;
    if (Math.abs(dy) > 6) menuPtr.moved = true;
    if (menuScreen === 'map' && menuPtr.x < menuGeom().ccx - mapR() * 0.5) {
      mapListScroll = (menuPtr.mapScroll0 || 0) - dy; // clamped when the list draws
    } else {
      menuScroll = clamp(menuPtr.scroll0 - dy, 0, menuGeom().maxScroll);
    }
    return;
  }
  const sl = pauseDrag[e.pointerId];
  if (sl && (state === S.PAUSE || (state === S.MENU && menuSettings))) {
    settings[sl.key] = clamp((P.x - sl.x) / sl.w, 0, 1);
    applySettings();
    return;
  }
  const p = pointers[e.pointerId];
  // a pre-run disc's pads are LIVE (see the pointerdown fall-through): the grip
  // steers its parked emitter through the disc exactly as it will mid-run
  if (!p || (state !== S.PLAY && !(state === S.INFO && preLaunch()))) return;
  const a = pointerAngle(p.side, P.x, P.y);
  const delta = angDiff(a, p.lastA);
  p.lastA = a;
  p.px = P.x; p.py = P.y; // the dial draws its virtual extension out to here
  const n = nodes[p.side === 'L' ? 0 : 1];
  // STILL TRAVELLING: the finger keeps naming the bearing, so a drag that begins
  // before the carriage has caught up STEERS the destination instead of fighting
  // it — and the run stays one continuous journey the dead zones can catch.
  //
  // On arrival the bearing clears and the hold reverts to pure 1:1 angular
  // deltas, from an offset of zero (the carriage landed under the finger). The
  // knob then keeps a constant offset from the thumb for the rest of the hold,
  // and a drifted (farther) thumb naturally gets finer per-cm aiming — both
  // properties die if the gain is scaled, so don't.
  if (n.slew !== null) n.slew = a;
  else n.angle += delta; // zero-lag: node mirrors the thumb
});
function releasePointer(e) {
  delete pointers[e.pointerId]; delete pauseDrag[e.pointerId];
  // recompute live thumb contact from the remaining pointers
  padHold[0] = Object.values(pointers).some(q => q.side === 'L');
  padHold[1] = Object.values(pointers).some(q => q.side === 'R');
}
canvas.addEventListener('pointerup', e => {
  if (replayScrub && replayScrub.id === e.pointerId) { replayScrub = null; sfxFadeTgt = 1; sfxFadeRate = 6; musicScrubT = -1; } // released the knob → ease sound back
  if (menuPtr && menuPtr.id === e.pointerId) {
    const P = evPos(e);
    if (!menuPtr.moved && state === S.MENU && !menuSettings) menuTap(P.x, P.y, e.pointerId);
    else if (menuPtr.moved && state === S.MENU && menuScreen === 'camps') {
      // release: snap to the nearest disc, a hard flick carries one further
      const total = discCount();
      const flick = Math.abs(menuPtr.vx || 0) > 550 ? -Math.sign(menuPtr.vx) * 0.5 : 0;
      campScrollTgt = clamp(Math.round(campScroll + flick), 0, total - 1);
      sfx.tick();
    }
    menuPtr = null;
  }
  menuHold = null; // lift ends the charge (the boss already fired if it completed)
  resetHold = null;
  releasePointer(e);
});
canvas.addEventListener('pointercancel', e => {
  if (replayScrub && replayScrub.id === e.pointerId) { replayScrub = null; sfxFadeTgt = 1; sfxFadeRate = 6; musicScrubT = -1; }
  if (menuPtr && menuPtr.id === e.pointerId) menuPtr = null;
  menuHold = null;
  resetHold = null;
  releasePointer(e);
});
// desktop: wheel scrolls the level list
window.addEventListener('wheel', e => {
  if (state !== S.MENU || menuSettings) return;
  if (menuScreen === 'board') { // route to the list under the cursor
    const P = evPos(e), inR = r => r && P.x > r.x && P.x < r.x + r.w && P.y > r.y && P.y < r.y + r.h;
    if (inR(boardRects.list)) boardListScroll += e.deltaY * 0.5;
    else boardLeftScroll += e.deltaY * 0.5; // left list is the default target
    return;
  }
  menuScroll = clamp(menuScroll + e.deltaY * 0.5, 0, menuGeom().maxScroll);
}, { passive: true });

// keyboard fallback for desktop testing
const keys = {};
window.addEventListener('keydown', e => {
  keys[e.key] = true; audio();
  // F2 flips the frame profiler, anywhere, including mid-run. It is a dev tool
  // and reads nothing but the clock, so it cannot disturb a run. (P is pause.)
  if (e.key === 'F2') { e.preventDefault(); profToggle(); return; }
  if (state === S.GUIDE) { // the guide: any dismiss key hands back
    if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') closeGuide();
    return;
  }
  if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
    // watching a replay: Escape means LEAVE THE REPLAY, exactly like its BACK control.
    // It used to fall through to the normal pause menu, whose QUIT walks to the menu
    // without exitReplay() — stranding replaying === true for the session.
    if (replaying) { if (!replayXfer) { replayXfer = { dir: -1, t: 0 }; replayPaused = true; sfx.tick(); } return; }
    if (state === S.PLAY) { state = S.PAUSE; sfx.tick(); }
    else if (state === S.INFO && !infoOutAt) { pausedFromInfo = true; state = S.PAUSE; sfx.tick(); }
    else if (state === S.PAUSE) {
      if (pausedFromInfo) { pausedFromInfo = false; state = S.INFO; }
      else { state = S.PLAY; resumeHold = 0.9; resumeDigit = 0; }
      sfx.tick();
    }
  }
});
window.addEventListener('keyup', e => { keys[e.key] = false; });

// auto-pause when the app loses the screen (phone lock, app switch, tab change)
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (state === S.PLAY) state = S.PAUSE;
    if (AC && AC.state === 'running') AC.suspend().catch(() => {});
  } else if (AC && AC.state === 'suspended') {
    AC.resume().catch(() => {});
  }
});

// ---------- menu / end screens hit areas ----------
let menuButtons = [];
function menuTap(x, y, pid) {
  // the report panel sits above everything on the board screen, MY DATA included
  if (report) {
    for (const b of reportBtns) {
      if (x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h) { pressUI(b, () => reportAct(b.tag)); return; }
    }
    return; // no tap-outside dismiss: the panel always carries its own way out
  }
  // MY DATA owns every tap while it's up — it sits above SYSTEM CONFIG (one of
  // its two doors), so it has to be tested before the settings branch or the
  // panel underneath would eat the taps meant for it.
  if (myData) {
    for (const b of myDataBtns) {
      if (x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h) { pressUI(b, () => myDataAct(b.tag)); return; }
    }
    // NO tap-outside-to-dismiss here, unlike the other panels. A stray tap beside
    // a live confirm ("delete everything?") should not quietly close the thing the
    // player is deciding about; the panel always carries its own way out.
    return;
  }
  // the reset-confirm modal owns every tap while it's up
  if (menuConfirm) {
    for (const b of menuConfirmBtns) {
      if (x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h) {
        pressUI(b);
        if (b.confirm === 'wipe') {
          PROG.unlocked = 1;
          PROG.stars = PROG.stars.map(() => 0);
          PROG.bests = PROG.bests.map(() => 0);
          saveState();
          mapSel = 0; mapCamSnap = true;
        }
        menuConfirm = false;
        return;
      }
    }
    // a tap on the dimmed backdrop cancels
    menuConfirm = false; sfx.tick();
    return;
  }
  // one-shot transitions: while an OUTBOUND animation is carrying us to
  // another screen, every key is spent — no restarting the ride mid-ride
  if (menuFx && (menuFx.kind === 'spinOut' || menuFx.kind === 'panelsOut' || menuFx.kind === 'discZoom' || menuFx.kind === 'launch' || menuFx.kind === 'boardIn' || menuFx.kind === 'boardOut')) return;
  if (menuSettings) {
    if (settingsTap(x, y, pid)) return;
    for (const b of menuSetButtons) {
      if (x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h) {
        // MY DATA is the one row that opens something instead of dismissing —
        // the settings panel stays mounted underneath so CLOSE returns to it
        if (b.action === 'mydata') { pressUI(b, () => openMyData()); return; }
        pressUI(b); menuSettings = false; return;
      }
    }
    // tap outside the panel dismisses it
    if (menuSetPanel && (x < menuSetPanel.x || x > menuSetPanel.x + menuSetPanel.w ||
        y < menuSetPanel.y || y > menuSetPanel.y + menuSetPanel.h)) {
      menuSettings = false; sfx.tick();
    }
    return;
  }
  if (menuFsRect && x > menuFsRect.x - 6 && x < menuFsRect.x + menuFsRect.w + 6 &&
      y > menuFsRect.y - 6 && y < menuFsRect.y + menuFsRect.h + 6) {
    toggleFullscreen(); pressUI(menuFsRect); return;
  }
  for (const r2 of menuMutRects) {
    if (x > r2.x - 5 && x < r2.x + r2.w + 5 && y > r2.y - 5 && y < r2.y + r2.h + 5) {
      mutators[r2.key] = !mutators[r2.key]; saveState(); pressUI(r2); return;
    }
  }
  if (menuGearRect && x > menuGearRect.x - 8 && x < menuGearRect.x + menuGearRect.w + 8 &&
      y > menuGearRect.y - 8 && y < menuGearRect.y + menuGearRect.h + 8) {
    menuSettings = true; pressUI(menuGearRect); return;
  }
  if (menuGuideRect && x > menuGuideRect.x - 8 && x < menuGuideRect.x + menuGuideRect.w + 8 &&
      y > menuGuideRect.y - 8 && y < menuGuideRect.y + menuGuideRect.h + 8) {
    pressUI(menuGuideRect); enterGuide('menu'); return;
  }
  if (menuLbRect && x > menuLbRect.x - 8 && x < menuLbRect.x + menuLbRect.w + 8 &&
      y > menuLbRect.y - 8 && y < menuLbRect.y + menuLbRect.h + 8) {
    pressUI(menuLbRect, () => openBoard(menuScreen)); return;
  }
  if (menuBackRect && x > menuBackRect.x - 8 && x < menuBackRect.x + menuBackRect.w + 8 &&
      y > menuBackRect.y - 8 && y < menuBackRect.y + menuBackRect.h + 8) {
    pressUI(menuBackRect, () => {
      campPendingSync = null; // leaving the carousel cancels any queued dive
      if (menuScreen === 'board') menuFx = { kind: 'boardOut', t: 0, dur: 0.5, to: boardFrom }; // columns fly out one by one, ring turns out
      else menuFx = menuScreen === 'map' ? { kind: 'panelsOut', t: 0, dur: 0.42, dir: -1 } : { kind: 'spinOut', t: 0, dur: 0.35, to: 'home', dir: -1 };
    });
    return;
  }
  for (const b of menuButtons) {
    const hit = b.sector
      ? (() => { const dxs = x - b.sector.cx, dys = y - b.sector.cy, rr = Math.hypot(dxs, dys);
          if (rr < b.sector.r0 || rr > b.sector.r1) return false;
          let aa = Math.atan2(dys, dxs);
          const rel = ((aa - b.sector.a0) % TAU + TAU) % TAU;
          return rel < ((b.sector.a1 - b.sector.a0) % TAU + TAU) % TAU; })()
      : (x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h);
    if (hit && !b.locked) {
      if (b.mode === 'campaign') pressUI(b, () => {
        // Story Mode always opens the carousel now (training + every contract).
        // Center on the active case, or on the training disc for a fresh player.
        campScroll = campScrollTgt = progress.tutorialDone ? discOfCamp(Math.max(0, CAMPAIGNS.indexOf(CAMP))) : 0;
        campPendingSync = null;
        menuFx = { kind: 'spinOut', t: 0, dur: 0.35, to: 'camps' };
      });
      else if (b.sync !== undefined) { // TAKE CONTRACT: dive into the disc
        if (Math.abs(b.sync - campScrollTgt) > 0.01) { campScrollTgt = b.sync; campPendingSync = b.sync; sfx.tick(); } // off-center: glide it in first
        else pressUI(b, () => syncDisc(b.sync));
      }
      else if (b.scrollDir !== undefined) {
        campScrollTgt = clamp(campScrollTgt + b.scrollDir, 0, discCount() - 1);
        campPendingSync = null; // browsing, not diving
        pressUI(b);
      }
      else if (b.campDisc !== undefined) { // tapping a side disc glides it in, then dives
        if (Math.abs(b.campDisc - campScrollTgt) > 0.01) { campScrollTgt = b.campDisc; campPendingSync = b.campDisc; sfx.tick(); }
        else { // already center-stage: the WHOLE disc is the sync button
          const sb = menuButtons.find(b2 => b2.sync === b.campDisc) || b;
          pressUI(sb, () => syncDisc(b.campDisc));
        }
      }
      else if (b.mode === 'flow') pressUI(b, () => { menuFx = { kind: 'spinOut', t: 0, dur: 0.35, to: 'flow' }; });
      else if (b.mode === 'board') pressUI(b, () => openBoard('home'));
      else if (b.node !== undefined) { mapSel = b.node; sfx.tick(); }
      else if (b.deploy !== undefined) pressUI(b, () => { menuFx = { kind: 'launch', t: 0, dur: 0.5, action: () => startLevel(b.deploy, true) }; tone(70, 0.45, 'sine', 0.12, 260); });
      else if (b.weekly) pressUI(b, () => { menuFx = { kind: 'launch', t: 0, dur: 0.5, action: startWeekly }; tone(70, 0.45, 'sine', 0.12, 260); });
      else if (b.endless) pressUI(b, () => { menuFx = { kind: 'launch', t: 0, dur: 0.5, action: startEndless }; tone(70, 0.45, 'sine', 0.12, 260); });
      // leaderboard screen controls
      else if (b.boardLeft) pressUI(b, () => { // left list: pick a board or fold a campaign
        const it = b.boardLeft;
        if (it.kind === 'camp' || it.kind === 'weeks') { boardCollapsed[it.id] = !boardCollapsed[it.id]; sfx.tick(); }
        else if (it.kind === 'mode') boardPick(it.mode);
        else if (it.kind === 'week') boardPick('weekly', it.week);
        else boardPick('campaign', it.camp, it.level);
      });
      else if (b.boardRow) pressUI(b, () => { boardSelRank = b.boardRow; sfx.tick(); }); // select an entry → details
      else if (b.boardShowMe) pressUI(b, () => { boardSelRank = b.boardShowMe; boardScrollToRank(b.boardShowMe); sfx.tick(); });
      else if (b.boardMyData) pressUI(b, () => { openMyData(); sfx.tick(); });
      else if (b.boardReport) pressUI(b, () => { openReport(b.boardReport); sfx.tick(); });
      else if (b.boardReplaySel) pressUI(b, () => boardReplayLaunch(b.boardReplaySel)); // watch the selected run
      else sfx.tick();
      return;
    }
  }
}
let endButtons = [];
function endTap(x, y) {
  if (trans || menuFx) return; // a departure is already in motion — keys are spent
  // SKIP MEANS ALL OF IT. This landed on endBtnAt + 0.15, which is before the telemetry
  // and the NEW BEST badge reveal — so the first tap fast-forwarded to the buttons and the
  // second tap left before the badge had appeared at all.
  if (endT < endRevealAt()) { endT = endRevealAt(); return; }
  for (const b of endButtons) {
    if (x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h) {
      closeNameEntry(); // leaving END dismisses the high-score card + its DOM field
      if (b.action === 'retry') pressUI(b, () => startTrans('derez', () => {
        // A CAMPAIGN RETRY KEEPS THE MODE IT JUST FLEW — until the lane is
        // CLEARED. Losing assisted retries assisted: the player is still stuck,
        // and that is the whole point of the ease. Clearing it spends the ease.
        // The run that just landed filed no score and no star, so a restart from
        // a won assisted lane is a player asking to fly it for real; handing them
        // another unranked run would be the one thing they cannot want.
        if (weekly) startWeekly(); else if (endless) startEndless(); else if (qual) startQualification(); else startLevel(levelIdx, false, assist && !endWin);
        warpT = 0; // a re-sync doesn't travel — no warp dive on the way back in
      }));
      else if (b.action === 'assist') pressUI(b, () => startTrans('derez', () => {
        startLevel(levelIdx, false, true); // the eased retry — unranked, no score, no stars
        warpT = 0;
      }));
      else if (b.action === 'duel') pressUI(b, () => startTrans('derez', () => {
        startBossRetry(); // the continue: the duel replays, the run stops ranking
        warpT = 0;
      }));
      else if (b.action === 'next') pressUI(b, () => startTrans('warp', () => startLevel(levelIdx + 1, true)));
      // straight out of the course and into the first contract — the same warp
      // transition a relay-to-relay hand-off uses, because that is what it is
      else if (b.action === 'contract') pressUI(b, () => startTrans('warp', () => {
        switchCampaign(0);
        startLevel(0, true);
      }));
      else pressUI(b, () => { // home in style: the menu drives into view, no glitch
        // training lives in Story Mode now → the report zooms back out INTO its disc
        if (qual) { menuScreen = 'camps'; campScroll = campScrollTgt = 0; campPendingSync = null; }
        else menuScreen = endless ? 'flow' : 'map';
        if (!endless && !qual) mapSel = Math.min(PROG.unlocked - 1, LEVELS.length - 1);
        state = S.MENU; fadeT = 0.35;
        menuFx = qual ? { kind: 'discOut', t: 0, dur: 0.55, disc: 0 } // the training disc recedes into its slot (reverse of the dive-in)
          : menuScreen === 'map' ? { kind: 'panelsIn', t: 0, dur: 0.6, dir: 1, zoom: true }
          : { kind: 'spinIn', t: 0, dur: 0.5, dir: 1, zoom: true };
      });
      return;
    }
  }
  // 80s high-score name entry (the card below the ring on the END screen)
  for (const b of nameEntryBtns) {
    if (x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h) {
      pressUI(b);
      if (b.action === 'nameSkip') closeNameEntry();
      else if (b.action === 'nameConfirm') confirmNameEntry();
      return;
    }
  }
}

function resetRun() {
  // A RUN THAT BEGINS HERE IS THE PLAYER'S. `replaying` is cleared unconditionally,
  // and reseedReplay re-asserts it right after its own start call — so a stuck flag
  // cannot outlive the menu. It could: leaving the replay viewer through any door
  // except its own BACK control (the Escape key was one) kept replaying === true for
  // the whole session, and endLevel's replay guard then swallowed every loss — the
  // invincibility Gil reported. The flag's true owner is the replay system; everyone
  // else starting a run means it OFF.
  replaying = false;
  assist = false;   // every mode starts clean — startLevel re-arms it AFTER this
  heavyCue = null;  // the first-contact armor guides belong to one run only
  // modifiers stay locked until the campaign is cleared
  if (!anyCampaignCleared()) mutators.oneLife = mutators.fast = mutators.noPickups = false;
  // the player must never fly into an EMPTY tunnel: the first release fires on
  // the first post-boot tick at full horizon depth, so traffic is visibly
  // inbound from second zero (natural speed — first CONTACT comes at travel time)
  levelT = 0; spawnT = 0.01;
  lanePlanetProg = 0; // the destination starts far away again
  resetBarks();
  commNext = 0; commCur = null; commT = 0;
  surgeLevel = 0; surgeCount = -1; surgeWaveZ = -1;
  integrity = mutLive('oneLife') ? 25 : 100; // flow loadout — a campaign hull is always whole
  score = 0; zaps = 0; misses = 0; combo = 0; maxCombo = 0; perfects = 0; fragsHit = 0; comboHeal = 0;
  comboStartT = 0; maxComboStart = 0; maxComboSec = 0;
  lbStatus = ''; lastSubmit = null; // clear last run's leaderboard status
  bossTestRun = false; // every real start clears the drill flag (startBossTest re-sets it)
  bossFailed = false; bossRetried = false; bossSnap = null; // continues don't outlive their level (startBossRetry re-marks)
  reliefFired = [];    // each level's hot bands get to send their patch again
  startTrace(); // record this run's input from the first step — for verify + replay
  pulseCharge = [0, 0]; pulseWaves = [];
  volley = { charge: 0, cd: 0, shots: [] };
  enemies = []; particles = []; popups = []; bolts = []; pickups = []; ghosts = []; ripples = [];
  boss = null; burstQ = null; patternQ = []; hitStop = 0;
  heat = 0; overheat = false; beamActive = false; beamSound(false, 0); stripSound(false, 0);
  introT = 0; introCd = -1; introStage = -1; introLatch = false; padHold = [false, false]; gatePip = 0;
  preT = 0; padArm = [false, false]; // parked: introT does not move until both thumbs land
  rimFX = []; latches = []; killStreaks = []; resumeHold = 0; warpT = WARP_DIVE; fadeT = 0.35;
  x10Seen = false; x10FxT = 0; // the first-x10 beat re-arms every run
  // slew last of all: a bearing named in the run being torn down must not still be
  // pulling a carriage off its parked angle on the first tick of the fresh one
  for (const n of nodes) { n.formedFx = false; n.formAt = 0; n.recoil = 0; n.deadT = 0; n.slew = null; }
  fx.wide = fx.auto = fx.chain = 0; shieldCharge = 0; pickupT = srand(16, 24); pickupBag = [];
  ribbonT = srand(11, 15); // first golden ribbon EARLY — its pulse should serve the whole run
  sched = [];
  initBeats(); // authored timeline: arm the beat queue + pre-book its windows
  nodes[0].angle = Math.PI * 0.75;
  nodes[1].angle = Math.PI * 0.25;
  popReset(); // a panel left open on QUIT/RESTART must not reappear (mid-dissolve) on the fresh run
  // popReset only clears the ANIMATION; MY DATA holds real state (a half-typed
  // handle, a live confirm), so it has to be torn down too or it reappears —
  // mid-decision — the next time the menu is drawn.
  if (myData) closeMyData();
  if (report) closeReport();
  state = S.PLAY;
}
// H-07: BACK off the pre-warp disc to the lane chart. The deploy is abandoned (the
// run never armed) and the relay stays selected. Bound to the top-right arrow key
// and to gamepad B. Mirrors the report's map-return transition.
function discBack() {
  const back = levelIdx;
  infoOutAt = 0;
  menuScreen = 'map';
  mapSel = Math.max(0, Math.min(back, LEVELS.length - 1));
  state = S.MENU; fadeT = 0.35;
  menuFx = { kind: 'panelsIn', t: 0, dur: 0.6, dir: 1, zoom: true };
  sfx.tick();
}
function startLevel(i, brief, withAssist) {
  // seed BOTH random streams so a campaign run is FULLY reproducible — the
  // prerequisite for server-side replay verification. spawnRng drives the spawn
  // script; Math.random drives everything else the sim touches (e.g. wall-avoid
  // jitter). The weekly ladder seeds the same way.
  // sysRandom is restored in endLevel so menus keep their real variety.
  weekly = false; Math.random = mulberry32((0x5EED1E + i * 40507) >>> 0);
  levelIdx = i; endless = false; qual = false; LV = LEVELS[i];
  tut = null;
  // fixed seed per level: the same drill, every run — endless is the exam
  spawnRng = mulberry32((0x51AB1E + i * 7919) >>> 0);
  resetRun();
  // LANE ASSIST: re-armed AFTER resetRun (which clears it for every mode).
  // The ease is a pure multiplier over a COPY — the authored table is never
  // touched, and every consumer already reads LV, not LEVELS[i].
  assist = !!withAssist;
  if (assist) LV = Object.assign({}, LEVELS[i], {
    spawnMin: LEVELS[i].spawnMin * 1.3, spawnMax: LEVELS[i].spawnMax * 1.3,
    speed: LEVELS[i].speed * 0.9 });
  runTrack = pickTrack(); // the soundtrack is drawn fresh; the sim never reads it (campaign spawns are scripted)
  armRunMusic();
  if (brief && STORY[i]) showCard('story' + i); // the contract's next leg
}
// QUALIFICATION: the training run — movement, every enemy type, one power-up
// THE ENLISTMENT, and the two ways in.
//   full  — a genuine first run: nothing saved, nobody has qualified.
//   short — they met him already but never finished the course. Replaying six
//           beats at someone who has seen them, with no skip, is a punishment
//           for closing the app; one line and back to work is not.
// UNSKIPPABLE BY CONSTRUCTION: there is no skip control and no route to the
// menu from S.ENLIST. The only exit is forward, into the course.
// `quiet` is for the BOOT claim, which runs during script evaluation — before
// the audio context exists and while the splash is playing its own score. A
// tick there is both wrong (nothing was pressed) and a real hazard: an
// exception thrown at module scope leaves the game half-booted.
function startEnlistment(short, quiet) {
  // THE COURSE IS ALREADY RUNNING BEHIND THE DISCS. It starts here, before the
  // first one appears, so the lane, the ring and the pads are on screen the
  // whole time he is talking — and the last tap does not load anything, it just
  // clears the disc off a level that was there all along. That is what makes the
  // hand-off seamless rather than a cut to a new screen.
  //
  // Nothing runs while the discs are up: the level parks itself until both
  // thumbs land (preLaunch), and no thumb can land through a disc.
  //
  // …and the music is held back. startQualification normally arms the run's take
  // straight away, because it is normally reached by pressing DEPLOY — but here the
  // course is being set up MINUTES of talking before anyone plays it, and arming it
  // now would kill the menu piece under the first disc. The hand-off is armed when
  // the last disc lifts instead; see tickEnlist.
  startQualification(true);
  enlist = { beat: 0, t: 0, short: !!short, out: 0 };
  state = S.ENLIST;
  // and the first disc's keyframe starts decoding NOW rather than on the frame it
  // is first drawn — the splash owns the screen for a second or so after this, so
  // the fetch has somewhere to happen where nobody is looking. Without it the disc
  // prints in as the painted console and the photograph pops in over it mid-scan.
  // The short form never reaches beat 0, so it asks for nothing.
  if (!short && typeof discArtImg === 'function') discArtImg({ art: ENLIST_KEYFRAME });
  if (!quiet) sfx.tick();
}
// advance one beat, or hand off. The gate is the TYPING, not a stopwatch: a tap
// can never skip a line that has not finished arriving, so every word is shown.
function enlistTap() {
  if (!enlist || enlist.out) return;
  if (enlist.t < Math.max(ENLIST_MIN, enlistTypeDur(enlist.beat))) return;
  if (enlist.beat < enlistScript().length - 1) {
    enlist.beat++; enlist.t = 0; sfx.tick();
    return;
  }
  // THE LAST TAP IS THE DEPLOY PRESS, so it gets a deploy's music: the menu piece
  // bows out over a second while the discs lift, the bus holds its silence, and the
  // run's own take is decoded under it so it lands ON the start sequence — the same
  // hand-off every contract gets, and the reason startQualification was told to keep
  // its hands off the bus when the enlistment set the course up.
  enlist.out = 0.0001; // begins the hand-off fade; tickEnlist launches the course
  armRunMusic();
  sfx.tick();
}
// `holdMusic` keeps the menu piece on the bus: the enlistment sets the course up
// long before it is played and does its own deploy fade when the discs clear.
function startQualification(holdMusic) {
  weekly = false; Math.random = sysRandom;
  levelIdx = -1; endless = false; qual = true; spawnRng = Math.random;
  LV = { name: 'QUALIFICATION', duration: Infinity, spawnMin: 9, spawnMax: 9, speed: 0.40,
         doubles: 0, heavies: 0, lines: 0, colors: 0, frags: 0 };
  tut = { stage: 0, t: 0, queue: [], retry: null, spawned: null };
  resetRun();
  // CONTROLS CHECK: bring each node onto a lit target on the ring — the
  // control lesson in the game's OWN language (position a node; then both
  // thumbs at once), replacing the abstract 360° spin. Each rep's target
  // angle materializes off the node's live position when the rep begins, so
  // every rep is a deliberate, reachable move; a target locks after a short
  // HOLD so a swipe-past doesn't count.
  tut.aim = { idx: 0, targets: null, hold: 0, reps: [
    [{ node: 0, off: -2.0 }],                        // blue: reach one way (relative)
    [{ node: 1, off: 2.0 }],                         // white: reach the other
    [{ node: 0, a: -2.5 }, { node: 1, a: -0.64 }],   // both at once — FIXED
  ] };                                               // opposite upper sides, always clear apart
  runTrack = pickTrack();
  if (!holdMusic) armRunMusic();
  // free flow: no greeting disc — boot straight in; the CONTROLS CHECK banner
  // and the marching arrows take it from there
}
// TEMPORARY dev shortcut: jump straight into the leech duel.
// Remove this (and its menu key) before release — grep "BOSS TEST".
function startBossTest() {
  startLevel(LEVELS.length - 1);
  levelT = LEVELS[LEVELS.length - 1].duration; // clock already expired — the leech spawns at once
  introT = 999; introCd = 0;                   // skip the countdown
  // A DRILL, NOT A RUN. The clock jump above is invisible to the trace, so the
  // verifier would replay these inputs against the level from second zero and
  // reject with [0 vs score] — endLevel reads this flag and never files a
  // boss-test run to any board.
  bossTestRun = true;
}
// THE CONTINUE — retry the DUEL only, priced in eligibility: the level's
// earnings come back from the snapshot spawnBoss took, the hull is fresh, and
// the run is marked non-competitive. Completion still counts (stars, the
// campaign's route); the boards, the local bests and the badge do not — a
// continue buys the ending, never the record.
function startBossRetry() {
  const snap = bossSnap;
  // the continue keeps the run's MODE: an assisted duel stays assisted (and
  // stays out of the record book), a standard one stays standard. The global
  // still holds the ended run's value here — resetRun clears it only inside
  // startLevel, after this argument is read.
  startLevel(levelIdx, false, assist);
  if (snap) {
    score = snap.score; zaps = snap.zaps; misses = snap.misses; perfects = snap.perfects;
    maxCombo = snap.maxCombo; maxComboSec = snap.maxComboSec; fragsHit = snap.fragsHit;
  }
  levelT = LEVELS[levelIdx].duration; // the level is already flown — straight to the duel
  introT = 999; introCd = 0;
  bossRetried = true;
  popup(W / 2, H * 0.3, 'DUEL RETRY — THIS RUN NO LONGER RANKS', '#ffb478');
}
function startEndless() {
  weekly = false; Math.random = sysRandom;
  levelIdx = -1; endless = true; qual = false; LV = endlessCfg(0); tut = null;
  spawnRng = Math.random;
  resetRun();
  runTrack = pickTrack();
  armRunMusic();
}
// WEEKLY LANE: one seeded endless lane per Mon–Sun week. Everyone on Earth flies
// the same lane for seven days, which is the point — a week is long enough to learn
// it, and to come back and beat your own row several times. When the week closes its
// board freezes for good (the Edge Function refuses anything that is not the current
// week), so a name that ends up on it stays there.
//
// It replaced a per-DAY lane. A day was too short to master a procedural lane and
// too easy to miss entirely; a week gives the same shared-seed fairness with room to
// actually compete in it.
//
// `w` selects the week, defaulting to the live one. A past week can be replayed for
// practice — see weeklyLive(), which is what gates submission.
// >>> DEST-RNG
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
// <<< DEST-RNG
function startWeekly(w) {
  const weekN = (w === undefined || w === null) ? weekNow() : (w | 0);
  weeklyIdx = weekN;
  Math.random = mulberry32((weekN * 2654435761) >>> 0);
  weekly = true;
  levelIdx = -1; endless = true; qual = false; LV = endlessCfg(0); tut = null;
  // TWO STREAMS, exactly as campaign does above. This used to read
  // `spawnRng = Math.random` — the same function object — so the weekly seed and the
  // spawn script shared one generator. Draw code consumes Math.random (measured: 481
  // calls per rendered frame), and the server verifier re-simulates without drawing
  // anything at all, so the two ran the spawn stream to completely different places
  // and every weekly submission was checked against a lane the player never saw.
  // A run is only verifiable if the spawn script cannot hear the renderer.
  spawnRng = mulberry32((weekN * 2246822519 + 0x51AB1E) >>> 0);
  resetRun();
  runTrack = ((weekN % trackCount()) + trackCount()) % trackCount(); // one shared stream: same week, same opening track for everyone
  armRunMusic();
}
// Is the week being played still open? Only the live week accepts a score. A past
// week is a practice lane — the client hides the submit path and the Edge Function
// refuses it regardless of what a modified client sends.
const weeklyLive = () => weekly && weeklyIdx === weekNow();
