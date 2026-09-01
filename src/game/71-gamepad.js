'use strict';
// ---------- gamepad (desktop playtesting) ----------
// two analog sticks ARE the dials: stick direction maps absolutely to node
// angle (up = top of the ring), triggers spend the matching pulse, START
// pauses, A dismisses info discs. In menus the D-pad walks a focus ring
// across the buttons and A presses the focused one.
//
// "Absolutely" means the stick names a BEARING, not that the carriage arrives
// there this frame — it runs the rim to get there, at the one rate every control
// scheme travels at. See NODE_SLEW / slewNodes in 41-geometry.
let padPrev = { a: false, b: false, y: false, start: false, lt: false, rt: false, stick: false };
let gpSel = 0, gpNav = false; // menu focus index + "a controller drives the menus"
// HOW LONG THE FOCUS RING DRIVES A. Once the player walks the keys, A stops
// meaning its hard-mapped verb and starts meaning "press THIS one" — which is
// what a focus ring promises, and what it used to break on the report, where A
// fired FORWARD no matter which key wore the ring. The two readings of A cannot
// both be advertised, so they take turns: while the ring is up the per-key
// letter badges fade out, and five seconds after the last navigation the ring
// fades instead and the badges come back with A on its own verb again.
let gpNavAt = -99;             // when the ring was last driven
const GP_NAV_HOLD = 5;         // seconds of stillness before it lets go
const GP_NAV_FADE = 0.6;       // and how long the hand-back takes
function gpNavA() {            // 1 while navigating → 0 once it has faded out
  if (!gpNav) return 0;
  return clamp(1 - (time - gpNavAt - GP_NAV_HOLD) / GP_NAV_FADE, 0, 1);
}
const gpNavLive = () => gpNavA() > 0;   // is the ring the thing A presses?
function gpTouchNav() { gpNav = true; gpNavAt = time; }
let gpStickDir = ''; // last stick step direction — a NEW direction steps again
let gpStickOn = false, gpStickHeld = 0, gpStickGo = false; // menu-stick hysteresis + sustain — see menuStick()
let gpSeen = false; // a controller has spoken — show button hints, arm the stick gate
let gpSig = ''; // screen signature — focus snaps to the primary key on arrival
function gpSyncFocus(list) { // → true when focus just snapped to a fresh screen
  const sig = state + ':' + (state === S.MENU ? menuScreen : '') + (menuSettings ? ':set' : '') + ':' + list.length;
  if (sig === gpSig) return false;
  gpSig = sig;
  // A means CONFIRM: deploy on the map, next on the report, resume in pause,
  // the campaign slice on the wheel — whatever moves the player forward
  let i = list.findIndex(b => b.deploy !== undefined || b.action === 'next' || b.action === 'resume' || b.mode === 'campaign'
    || (b.camp !== undefined && CAMPAIGNS[b.camp] === CAMP));
  if (i < 0 && state === S.END) i = list.indexOf(endForward(list)); // the report's own forward key (continue included)
  if (i < 0) i = list.findIndex(b => b.action === 'retry' || b.endless !== undefined);
  gpSel = Math.max(0, i);
  return true;
}
function gpBackAction() { // B: CANCEL (modal, panel, card) / LEAVE (pause + report)
  if (state === S.MENU) {
    if (report) { closeReport(); sfx.tick(); return; }            // the report panel sits above MY DATA
    if (feedback) { closeFeedback(); sfx.tick(); return; }        // FEEDBACK sits above the settings panel too
    if (myData) { closeMyData(); sfx.tick(); return; }            // MY DATA sits above the settings panel
    if (menuConfirm) { menuConfirm = false; sfx.tick(); return; } // close the modal, go nowhere
    if (menuSettings) { menuSettings = false; sfx.tick(); return; } // close the settings panel
    gpMenuBack();
  }
  else if (state === S.INFO) {
    if (preLaunch()) discBack();                                              // H-07: B backs off the pre-warp disc to the chart
    else if (!infoOutAt && time - infoShownAt > 0.35) { infoOutAt = time; sfx.tick(); } // a mid-run card: B dismisses it
  }
  else if (state === S.GUIDE) closeGuide(); // B hands the wing back
  else if (state === S.END && nameEntry) { closeNameEntry(); sfx.tick(); } // cancel the card
  // ON PAUSE AND ON THE REPORT, B LEAVES — the same door as Y. Gil's call, and it matches
  // the muscle memory a controller brings: B is the way OUT of a screen, everywhere else
  // in this game and in most others. It used to RESTART from both, which put the most
  // destructive option on the button players press to back out. Restart is X now.
  else if (state === S.PAUSE || state === S.END) gpQuitAction();
}
// X: RESTART, on the two screens that can offer one. Deliberately the button nothing else
// uses, so re-running a level is never what a stray B or Y does.
function gpRestartAction() {
  if (state === S.PAUSE) {
    const b = pauseButtonsList.find(b2 => b2.action === 'restart');
    if (b) pauseTap(b.x + b.w / 2, b.y + b.h / 2, -7);
  } else if (state === S.END && !nameEntry) {
    gpEndPress(endRestartAction());
  }
}
// WHAT X MEANS ON THE REPORT. Offered a LANE ASSIST, X is the assist: A already
// owns plain RETRY there (it is the forward key on a loss), so X restarting too
// spent the game's one spare face button on a verb that already had one.
const endRestartAction = () =>
  endButtons.some(b2 => b2.action === 'assist') ? 'assist' : 'retry';
function gpMenuBack() { // one step back through the menu screens
  if (menuScreen === 'home' || menuFx) return;
  sfx.tick();
  menuFx = menuScreen === 'map' ? { kind: 'panelsOut', t: 0, dur: 0.42, dir: -1 }
    : menuScreen === 'board' ? { kind: 'boardOut', t: 0, dur: 0.5, to: boardFrom }
    : { kind: 'spinOut', t: 0, dur: 0.35, to: 'home', dir: -1 };
}
function gpQuitAction() { // Y: BACK a screen in the menus, QUIT the run elsewhere
  if (state === S.MENU) {
    if (report) { closeReport(); sfx.tick(); return; }
    if (feedback) { closeFeedback(); sfx.tick(); return; }
    if (myData) { closeMyData(); sfx.tick(); return; }
    if (menuConfirm) { menuConfirm = false; sfx.tick(); return; }
    if (menuSettings) { menuSettings = false; sfx.tick(); return; }
    gpMenuBack();
  } else if (state === S.PAUSE) {
    const b = pauseButtonsList.find(b2 => b2.action === 'menu');
    if (b) pauseTap(b.x + b.w / 2, b.y + b.h / 2, -7);
  } else if (state === S.GUIDE) closeGuide();
  else if (state === S.END) gpEndPress('menu');
}
function gpEndPress(action) {
  const b = endButtons.find(b2 => b2.action === action);
  if (b) endTap(b.x + b.w / 2, b.y + b.h / 2);
}
// THE REPORT'S FORWARD KEY, in one place. A is hard-mapped to whatever moves
// the player onward, and the report offers exactly one of these at a time:
// NEXT LEVEL after a win, RETRY DUEL after a duel death (the continue), else
// RETRY. It lived inline in three spots — the pad hint, the initial focus and
// the A handler — and when the continue was added, only the screen learned
// about it: A fell through to 'retry' and restarted the whole level, which is
// exactly the wrong door. One list, one order, every consumer.
const END_FORWARD = ['next', 'nextCon', 'contract', 'duel', 'retry'];
function endForward(list) {
  for (const a of END_FORWARD) {
    const b = (list || []).find(b2 => b2.action === a);
    if (b) return b;
  }
  return null;
}
function gpList() {
  // settings rows (toggles) ride the focus ring too — pause and menu panel alike
  // ORDER IS DEPTH. Each panel that draws over another is tested before it, so the
  // focus ring is always on the topmost thing on screen rather than the one behind it.
  if (state === S.MENU) return report ? reportBtns : feedback ? feedbackBtns : myData ? myDataBtns
    : menuSettings ? menuSetButtons.concat(pauseTogglesList) : menuButtons;
  if (state === S.PAUSE) return pauseButtonsList.concat(pauseTogglesList);
  if (state === S.END) return endButtons;
  return null;
}
function gpCenter(b) { // pizza-wheel sectors carry geometry instead of a rect
  if (b.sector) {
    const s = b.sector, ma = (s.a0 + s.a1) / 2, mr = (s.r0 + s.r1) / 2;
    return { x: s.cx + Math.cos(ma) * mr, y: s.cy + Math.sin(ma) * mr };
  }
  return { x: b.x + b.w / 2, y: b.y + b.h / 2 };
}
function gpMove(list, dx, dy) { // nearest button lying in the pressed direction
  gpTouchNav();
  if (gpSel < 0 || gpSel >= list.length) { gpSel = 0; return; }
  const from = gpCenter(list[gpSel]);
  let best = -1, bestD = 1e9;
  list.forEach((b, i) => {
    if (i === gpSel) return;
    // the OUTER arc slabs (H-15) answer LB/RB directly and stay OFF the focus
    // walk — the stick and d-pad own the wheel, the bumpers own the slabs
    if (b.sector && b.sector.outer) return;
    const c = gpCenter(b);
    const along = (c.x - from.x) * dx + (c.y - from.y) * dy;
    if (along <= 8) return;
    const drift = Math.abs((c.x - from.x) * dy) + Math.abs((c.y - from.y) * dx);
    const d = along + drift * 2;
    if (d < bestD) { bestD = d; best = i; }
  });
  if (best >= 0) { gpSel = best; sfx.tick(); }
}
// trace a key's TRUE visible outline — the ONE source of shape for every
// press flash and focus ring: wedge, disc segment, or tech-cornered rect
function keyShapePath(b, pad) {
  if (b.sector) {
    const sc = b.sector;
    ctx.beginPath();
    ctx.arc(sc.cx, sc.cy, sc.r1, sc.a0, sc.a1);
    ctx.arc(sc.cx, sc.cy, sc.r0, sc.a1, sc.a0, true);
    ctx.closePath(); return true;
  }
  if (b.seg) { // circle-segment key: the disc edge IS the button edge
    const sg = b.seg, a2 = Math.asin(clamp(sg.d / sg.r, 0, 1));
    // …and `half` cuts the segment down the vertical, for a disc that carries two
    // keys along its bottom (the pause disc's RESTART / QUIT)
    if (sg.half) {
      ctx.beginPath();
      ctx.moveTo(sg.cx, sg.cy + sg.d);
      if (sg.half < 0) { ctx.lineTo(sg.cx - sg.r * Math.cos(a2), sg.cy + sg.d); ctx.arc(sg.cx, sg.cy, sg.r, Math.PI - a2, Math.PI / 2, true); }
      else { ctx.lineTo(sg.cx + sg.r * Math.cos(a2), sg.cy + sg.d); ctx.arc(sg.cx, sg.cy, sg.r, a2, Math.PI / 2); }
      ctx.closePath(); return true;
    }
    ctx.beginPath();
    ctx.arc(sg.cx, sg.cy, sg.r, a2, Math.PI - a2);
    ctx.closePath(); return true;
  }
  if (b.w) { // keys carry their own chamfer so the ring hugs their true shape
    techRect(b.x - pad, b.y - pad, b.w + pad * 2, b.h + pad * 2, (b.cut !== undefined ? b.cut : 8) + pad);
    return true;
  }
  return false;
}
// tiny controller-button badge (A / B / Y / START) pinned to a key's top edge
function drawPadHint(x, y, label) {
  ctx.save();
  ctx.font = '800 9px Audiowide, system-ui';
  const w = Math.ceil(ctx.measureText(label).width) + 10, h = 14;
  ctx.fillStyle = 'rgba(6,16,30,0.92)';
  roundRect(x - w / 2, y - h / 2, w, h, 4); ctx.fill();
  ctx.strokeStyle = 'rgba(140,235,255,0.9)'; ctx.lineWidth = 1;
  roundRect(x - w / 2, y - h / 2, w, h, 4); ctx.stroke();
  ctx.fillStyle = '#d9f4ff'; ctx.textAlign = 'center';
  ctx.fillText(label, x, y + 3);
  ctx.textAlign = 'left';
  ctx.restore();
}
function drawGpHints() { // once a controller speaks, keys wear their buttons
  if (!gpSeen) return;
  const list = gpList();
  // the focused key wears a ring in its OWN shape (wheel slices glow on their
  // own; the route map draws its relay selection itself)
  // ...and never during a screen change: the ring is drawn from the key's current
  // rect, which is meaningless while the layout is flying in or out.
  const navA = gpNavA(); // the ring's presence — and the badges' absence
  if (list && list.length && navA > 0 && !menuFx && !trans
    && !(state === S.MENU && menuScreen === 'map' && !menuSettings && !myData && !report && !feedback)
    && !(state === S.END && nameEntry)) {
    const fb = list[Math.min(gpSel, list.length - 1)];
    if (fb && !fb.sector) {
      ctx.save();
      ctx.globalAlpha *= navA;
      ctx.strokeStyle = 'rgba(140,235,255,0.9)'; ctx.lineWidth = 2;
      ctx.shadowColor = 'rgba(120,220,255,0.8)'; ctx.shadowBlur = lowFX ? 0 : 8;
      if (keyShapePath(fb, 2)) ctx.stroke();
      ctx.restore();
    }
  }
  // on the report, A is hard-mapped to FORWARD (next / retry duel / retry), Y exits
  const endAB = state === S.END && list ? endForward(list) : null;
  const endA = endAB ? endAB.action : null;
  // ...but only while the focus ring is DOWN. Walking the ring re-points A at
  // whatever it lands on, so the per-key letters would be advertising a map
  // that is not in force — they fade out for exactly as long as the ring is up.
  const hintA = 1 - navA;
  // the report's assist key owns X (see gpRestartAction) — so plain RETRY only
  // wears the X badge on a report that is not offering one
  const assistOffered = state === S.END && list && list.some(b2 => b2.action === 'assist');
  if (list && hintA > 0.01) for (const b of list) {
    let h = null;
    if (b.deploy !== undefined || b.action === 'resume'
      || (endA ? b.action === endA : b.action === 'next')) h = 'A';
    else if (b.back) h = 'Y';
    // restart is X on both screens; leaving is Y (and B does the same, but one glyph per
    // key is the honest hint — a button showing two letters teaches neither)
    else if (b.action === 'restart' && state === S.PAUSE) h = 'X';
    else if (b.action === 'assist' && state === S.END) h = 'X';
    else if (b.action === 'retry' && state === S.END && !assistOffered) h = 'X'; // when A already owns retry the chain never gets here
    else if (b.action === 'menu' && state !== S.MENU) h = 'Y';
    if (!h || b.sector) continue;
    ctx.save();
    ctx.globalAlpha *= hintA;
    drawPadHint(b.x + b.w / 2, b.y - 2, h);
    ctx.restore();
  }
  if (state === S.MENU && menuScreen !== 'home' && menuBackRect && !menuSettings && !myData && !report && !feedback)
    drawPadHint(menuBackRect.x + menuBackRect.w / 2, menuBackRect.y + menuBackRect.h + 9, 'Y');
  // the arc slabs beside the home wheel answer LB / RB — the badge rides each
  // slab's top corner, and a locked slab stays bare (its bumper does nothing)
  if (state === S.MENU && menuScreen === 'home' && !menuSettings && !myData && !report && !feedback && !menuFx)
    for (const b of menuButtons) {
      if (!b.sector || !b.sector.outer || b.locked) continue;
      const s = b.sector, mid = (s.a0 + s.a1) / 2, half = (s.a1 - s.a0) / 2;
      const side = Math.cos(mid) < 0 ? -1 : 1, rm = (s.r0 + s.r1) / 2;
      drawPadHint(s.cx + side * rm * Math.cos(half), s.cy - rm * Math.sin(half) - 10, side < 0 ? 'LB' : 'RB');
    }
  // the high-score card: A saves (once live), B skips
  if (state === S.END && nameEntry) for (const b of nameEntryBtns)
    drawPadHint(b.x + b.w / 2, b.y - 2, b.action === 'nameConfirm' ? 'A' : 'B');
  if (state === S.PLAY && pauseBtnRect && introT >= INTRO_DUR)
    drawPadHint(pauseBtnRect.x + pauseBtnRect.w / 2, pauseBtnRect.y + pauseBtnRect.h + 10, 'START');
  if (state === S.INFO && discBackRect && typeof preLaunch !== 'undefined' && preLaunch()) // H-07: B backs off the pre-warp disc
    drawPadHint(discBackRect.x + discBackRect.w / 2, discBackRect.y + discBackRect.h + 10, 'B');
}
function pollGamepad(dt) {
  if (typeof navigator === 'undefined' || !navigator.getGamepads) return;
  let gp = null;
  try { gp = Array.from(navigator.getGamepads()).find(p => p && p.connected && p.axes.length >= 4); } catch (e) {}
  padDev = gp || null; // buzz() rumbles whatever controller spoke last
  if (!gp) return;
  const press = i => !!(gp.buttons[i] && gp.buttons[i].pressed);
  const stick = i => { // absolute node angle, or null inside the deadzone
    const x = gp.axes[i * 2], y = gp.axes[i * 2 + 1];
    return Math.hypot(x, y) > 0.45 ? Math.atan2(y, x) : null;
  };
  // MENU STICK, WITH HYSTERESIS. A twenty-year-old pot flickering across one
  // threshold reads as a stream of fresh deflections, and every one stepped
  // the focus and ticked the pad — the "silent rumbling" in the menus. Engage
  // HIGH, release LOW: noise inside the band changes nothing. Gameplay keeps
  // stick()'s tighter deadzone — a run wants the response, menus want calm.
  // MENU STICK: the ANGLE reports from raw deflection immediately — the
  // arrival latches below need continuity from the very first frame — but
  // ACTING gates on gpStickGo, which takes hysteresis (engage 0.62, release
  // 0.38) AND sustain (four frames ≈ 66ms). A worn pot can spike past any
  // single threshold for a frame — that was the "very very tiny random
  // movement" — but it cannot HOLD a deflection the way a thumb does.
  const menuStick = () => {
    const m0 = Math.hypot(gp.axes[0], gp.axes[1]);
    const m1 = gp.axes.length >= 4 ? Math.hypot(gp.axes[2], gp.axes[3]) : 0;
    const m = Math.max(m0, m1);
    if (m >= (gpStickOn ? 0.38 : 0.62)) gpStickHeld++; else gpStickHeld = 0;
    gpStickOn = gpStickOn ? m >= 0.38 : gpStickHeld >= 4;
    gpStickGo = gpStickOn;
    if (m < 0.45) return null;
    return m0 >= m1 ? Math.atan2(gp.axes[1], gp.axes[0]) : Math.atan2(gp.axes[3], gp.axes[2]);
  };
  if (SPLASH.on) { // any button skips the intro (a pad press can't unlock audio anyway — just fly)
    const anyBtn = gp.buttons.some(b2 => b2 && b2.pressed);
    if (anyBtn && !padPrev.any) { gpSeen = true; if (SPLASH.t >= 0.3) splashEnd(true); }
    padPrev.any = anyBtn;
    // the skip press must not echo into the menu as a phantom A/B/Y/START
    padPrev.a = press(0); padPrev.b = press(1); padPrev.x = press(2); padPrev.y = press(3); padPrev.start = press(9);
    padPrev.lb = press(4); padPrev.rb = press(5);
    return;
  }
  if (!gpSeen && (gp.buttons.some(b2 => b2 && b2.pressed) || gp.axes.some(v => Math.abs(v) > 0.3)))
    gpSeen = true; // first real input → button hints + controller boot gate
  // the enlistment takes ANY button, the way the splash does. It has one verb —
  // continue — so asking a controller player to find a specific face button for
  // it would be ceremony with no choice behind it.
  if (state === S.ENLIST) {
    const anyE = gp.buttons.some(b2 => b2 && b2.pressed);
    if (anyE && !padPrev.any) enlistTap();
    padPrev.any = anyE;
    padPrev.a = press(0); padPrev.b = press(1); padPrev.x = press(2); padPrev.y = press(3); padPrev.start = press(9);
    padPrev.lb = press(4); padPrev.rb = press(5);
    return;
  }
  // SELECT held on the route map = the ↺ reset hold, same commitment window
  if (press(8) && state === S.MENU && menuScreen === 'map' && !menuConfirm && !menuFx) {
    padSelHold += dt;
    if (padSelHold >= RESET_HOLD) { padSelHold = 0; menuConfirm = true; sfx.tick(); buzz(20); }
  } else padSelHold = 0;
  const start = press(9);
  if (start && !padPrev.start) {
    if (state === S.PLAY) { state = S.PAUSE; sfx.tick(); } // any time — boot sequence included
    else if (state === S.INFO && !infoOutAt) { pausedFromInfo = true; state = S.PAUSE; sfx.tick(); } // over the mission disc too
    else if (state === S.PAUSE) {
      if (pausedFromInfo) { pausedFromInfo = false; state = S.INFO; } // back to the briefing, no count-in
      else { state = S.PLAY; resumeHold = 0.9; resumeDigit = 0; }
      sfx.tick();
    }
    else if (state === S.GUIDE) closeGuide();
    else if (state === S.MENU && !menuConfirm && !myData && !report && !feedback && !menuFx) { menuSettings = !menuSettings; sfx.tick(); } // START: the settings panel
  }
  padPrev.start = start;
  if (state === S.GUIDE) { // the guide: A dismisses, like an info disc
    const aG = press(0);
    if (aG && !padPrev.a) closeGuide();
    padPrev.a = aG;
  }
  const list = gpList();
  const inSettings = state === S.MENU && (menuSettings || !!myData || !!report || !!feedback);
  const onMap = state === S.MENU && menuScreen === 'map' && !inSettings;
  if (list && list.length && onMap) {
    // the map is a LIST, not a maze: up/down picks the relay, A deploys,
    // B backs out. Dev keys (BOSS TEST, RESET) stay mouse-only on purpose.
    // relays arrive twice (the lens marker, the left-column row) and the lens
    // only draws the ones it can see — so key the walk on the RELAY, in order,
    // and take whichever button represents it
    // ...and only the UNLOCKED ones: the walk stops at the frontier, exactly
    // where a tap does, so the stick can't wander into sealed relays
    const rows = [...new Map(list.filter(b2 => b2.node !== undefined && !b2.locked).map(b2 => [b2.node, b2])).values()]
      .sort((r1, r2) => r1.node - r2.node);
    const step = d => {
      const cur = rows.findIndex(r => r.node === mapSel);
      const nx = rows[clamp((cur < 0 ? 0 : cur) + d, 0, rows.length - 1)];
      if (nx && nx.node !== mapSel) { const c = gpCenter(nx); menuTap(c.x, c.y, -7); }
    };
    for (const [bi, d] of [[12, -1], [13, 1]]) {
      const dn = press(bi), key = 'd' + bi;
      if (dn && !padPrev[key]) step(d);
      padPrev[key] = dn;
    }
    padPrev.d14 = press(14); padPrev.d15 = press(15); // eaten — no sideways ghosts
    const sy = menuStick();
    const hadY = padPrev.stick;
    padPrev.stick = sy !== null;
    if (sy !== null && gpStickGo && Math.abs(Math.sin(sy)) > 0.6) { // a NEW direction steps again
      const d = Math.sign(Math.sin(sy)) > 0 ? 1 : -1;
      if (!hadY || gpStickDir !== 'm' + d) { step(d); gpStickDir = 'm' + d; }
    } else if (sy === null) gpStickDir = '';
  } else if (state === S.MENU && menuScreen === 'camps' && !menuFx && !inSettings) {
    // the carousel: LB/RB or left/right slides discs, A syncs the centered case
    const totalD = discCount();
    if (list) { // focus ring rides the centered disc's SYNC key
      const si = list.findIndex(b2 => b2.sync === Math.round(campScrollTgt));
      if (si >= 0) gpSel = si;
    }
    for (const [bi, d] of [[14, -1], [15, 1], [4, -1], [5, 1]]) {
      const dn = press(bi), key = 'd' + bi;
      if (dn && !padPrev[key]) { campScrollTgt = clamp(campScrollTgt + d, 0, totalD - 1); campPendingSync = null; sfx.tick(); }
      padPrev[key] = dn;
    }
    padPrev.d12 = press(12); padPrev.d13 = press(13);
    const sx2 = menuStick();
    const hadX = padPrev.stick;
    padPrev.stick = sx2 !== null;
    if (sx2 !== null && gpStickGo && Math.abs(Math.cos(sx2)) > 0.6) { // a NEW direction slides again
      const d2 = Math.cos(sx2) > 0 ? 1 : -1;
      if (!hadX || gpStickDir !== 'c' + d2) {
        campScrollTgt = clamp(campScrollTgt + d2, 0, totalD - 1); campPendingSync = null; sfx.tick();
        gpStickDir = 'c' + d2;
      }
    } else if (sx2 === null) gpStickDir = '';
    const aC = press(0);
    if (aC && !padPrev.a && list) {
      const sy2 = list.find(b2 => b2.sync === Math.round(campScrollTgt));
      if (sy2) { gpTouchNav(); const c = gpCenter(sy2); menuTap(c.x, c.y, -7); }
    }
    padPrev.a = aC;
  } else if (list && list.length) {
    // fresh screen → focus lands on the CONFIRM key; a stick still deflected
    // from gameplay must not step it (pause arrives with thumbs on the dials)
    const fresh = gpSyncFocus(list);
    // on a focused settings row, left/right rides the volume rail (waking the
    // channel if it was off) instead of moving focus
    const nav = (dx, dy) => {
      const fb = list[Math.min(gpSel, list.length - 1)];
      const volKey = dx && fb && fb.key ? { sound: 'soundVol', music: 'musicVol' }[fb.key] : null;
      if (volKey) {
        gpTouchNav();
        if (!settings[fb.key]) settings[fb.key] = true;
        settings[volKey] = clamp(settings[volKey] + dx * 0.125, 0, 1);
        applySettings(); sfx.tick();
        return;
      }
      gpMove(list, dx, dy);
    };
    for (const [bi, dx, dy] of [[12, 0, -1], [13, 0, 1], [14, -1, 0], [15, 1, 0]]) {
      const dn = press(bi), key = 'd' + bi; // D-pad walks the focus ring
      if (dn && !padPrev[key]) nav(dx, dy);
      padPrev[key] = dn;
    }
    // the analog stick navigates too: on the wheel it POINTS at a slice,
    // elsewhere a fresh deflection acts as one D-pad step
    const sa = menuStick();
    const hadStick = padPrev.stick;
    padPrev.stick = sa !== null;
    if (sa !== null && !gpStickGo) {
      // deflected but not yet ENGAGED (the sustain window). If the screen just
      // arrived, this is a stick still held from gameplay — latch its direction
      // now, silently, so engagement three frames later reads as HELD, never as
      // a fresh push. That latch is what keeps pause opening on RESUME with a
      // thumb still on the dials.
      if (fresh) {
        const dxF = Math.abs(Math.cos(sa)) > Math.abs(Math.sin(sa)) ? Math.sign(Math.cos(sa)) : 0;
        gpStickDir = 'g' + dxF + ':' + (dxF ? 0 : Math.sign(Math.sin(sa)));
      }
    } else if (sa !== null) {
      let pointed = -1;
      list.forEach((b, i) => {
        // the OUTER arc keys (H-15) share every angle with a wheel slice, so a
        // direction alone cannot name them — pointing stays a wheel gesture and
        // the outer ring is walked onto with the d-pad (or a stick step)
        if (!b.sector || b.sector.outer) return;
        const s = b.sector;
        let d0 = (sa - s.a0) % TAU; if (d0 < 0) d0 += TAU;
        let span = (s.a1 - s.a0) % TAU; if (span < 0) span += TAU;
        if (d0 <= span) pointed = i;
      });
      if (pointed >= 0) {
        if (pointed !== gpSel && gpNav) sfx.tick();
        gpSel = pointed; gpTouchNav();
      } else {
        // one push = one step; sweeping to a NEW direction steps again
        // without recentering
        const dx = Math.abs(Math.cos(sa)) > Math.abs(Math.sin(sa)) ? Math.sign(Math.cos(sa)) : 0;
        const dir = 'g' + dx + ':' + (dx ? 0 : Math.sign(Math.sin(sa)));
        if (!hadStick || dir !== gpStickDir) {
          if (!fresh) nav(dx, dx ? 0 : Math.sign(Math.sin(sa)));
          gpStickDir = dir;
        }
      }
    } else gpStickDir = '';
  }
  const bb = press(1); // B — back
  if (bb && !padPrev.b) gpBackAction();
  padPrev.b = bb;
  const yy = press(3); // Y — quit
  if (yy && !padPrev.y) gpQuitAction();
  padPrev.y = yy;
  const xx = press(2); // X — restart (pause + report)
  if (xx && !padPrev.x) gpRestartAction();
  padPrev.x = xx;
  // LB / RB — the two arc slabs beside the home wheel (H-15). Direct triggers
  // on the home screen ONLY, so no other screen's controls move; the slabs are
  // excluded from the focus walk (gpMove) so the stick never wanders onto them.
  const slabOK = state === S.MENU && menuScreen === 'home' && !menuFx
    && !menuSettings && !myData && !report && !feedback && !menuConfirm;
  const lb = press(4);
  if (lb && !padPrev.lb && slabOK) {
    const b = menuButtons.find(b2 => b2.goMap);
    if (b) { const c = gpCenter(b); menuTap(c.x, c.y, -7); }
  }
  padPrev.lb = lb;
  const rb = press(5);
  if (rb && !padPrev.rb && slabOK) {
    // locked (FREE FLOW not yet open) pushes no `weekly` tag, so find() misses
    // and the press falls silent — same answer a tap on the grey slab gives
    const b = menuButtons.find(b2 => b2.weekly && b2.sector && b2.sector.outer);
    if (b) { const c = gpCenter(b); menuTap(c.x, c.y, -7); }
  }
  padPrev.rb = rb;
  const a0 = press(0);
  if (a0 && !padPrev.a) {
    if (state === S.INFO) {
      if (!infoOutAt && time - infoShownAt > 0.35) { infoOutAt = time; sfx.tick(); }
    } else if (state === S.MENU && menuConfirm) {
      // the reset modal: A = RESET (the hold already gated it), B = cancel
      const wb = menuConfirmBtns.find(b2 => b2.confirm === 'wipe');
      if (wb) menuTap(wb.x + wb.w / 2, wb.y + wb.h / 2, -7);
    } else if (state === S.END && nameEntry) {
      // the high-score card: A = SAVE, live once the handle is clean
      const sb = nameEntryBtns.find(b2 => b2.action === 'nameConfirm');
      if (sb) pressUI(sb, () => confirmNameEntry());
    } else if (list && list.length) { // A confirms: on the map that's DEPLOY,
      // and everywhere else the FOCUSED key — once the player has walked the
      // ring onto it. Standing still, the report falls back to its hard map
      // (FORWARD: next / retry duel / retry), which is what the badges say.
      const focused = list[Math.min(gpSel, list.length - 1)];
      const target = onMap ? list.find(b2 => b2.deploy !== undefined)
        : gpNavLive() ? focused
        : state === S.END ? (endForward(list) || focused)
        : focused;
      if (target) {
        if (gpNav) gpTouchNav(); // confirming is activity — the ring keeps its clock
        const c = gpCenter(target);
        if (state === S.MENU) menuTap(c.x, c.y, -7);
        else if (state === S.PAUSE) pauseTap(c.x, c.y, -7);
        else endTap(c.x, c.y);
      }
    }
  }
  padPrev.a = a0;
  // a PRE-RUN mission disc keeps its pads live (72-tick): the stick gate below
  // runs under it, so a controller can grip straight through the disc — A still
  // dismisses it the old way for whoever reads to the end first
  if (state !== S.PLAY && !(state === S.INFO && preLaunch())) return;
  // THE LAUNCH GATE IS A CONTROLS CHECK, NOT A POSE. It used to require both sticks held
  // more than 2.1 rad APART — and that rule was both undiscoverable and pointless: the
  // separation is unchanged by pointing both in or both out (adding pi to two bearings
  // preserves the angle between them), so it rejected nothing a player would plausibly
  // do except hold both sticks the same way, while reading as "there is a secret pose".
  //
  // Now each stick arms its OWN pad the moment it leaves the deadzone, and the emitters
  // answer it live — the node control below is deliberately NOT gated on the intro, so
  // pushing a stick swings that pad's knob exactly as it will mid-run. That IS the check:
  // you move it, it moves, and the run starts when both have answered.
  const inIntro = introT < INTRO_DUR;
  for (let i = 0; i < 2; i++) {
    const a = stick(i);
    // A CENTRED STICK NAMES NOTHING, and must also UNname whatever it last said —
    // otherwise releasing mid-sweep would let the carriage coast on to a bearing
    // the operator has already let go of. It stops where it got to, as it always has.
    if (a === null) { nodes[i].slew = null; continue; }
    // THE EMITTER TRAVELS — it does not appear. The stick names the bearing here;
    // slewNodes runs the rim to it, shortest way about, so every angle in between
    // actually happens and a flick across the ring is no longer a free pass
    // through a live wall. See the note over NODE_SLEW in 41-geometry — the
    // finger names its bearing exactly the same way, through the same integrator.
    nodes[i].slew = a;
    if (inIntro) padHold[i] = true;      // deflection alone is the operator's answer
  }
  if (inIntro) return;                   // no pulse triggers until the lane is live
  for (const [bi, ni, key] of [[6, 0, 'lt'], [7, 1, 'rt']]) { // LT/RT → pulse
    const dn = press(bi);
    // duels run on the pulse — only the boss ceremony and death keep it shut
    const duelOk = !boss || (boss.introT >= BOSS_CER && boss.dying === undefined);
    if (dn && !padPrev[key] && duelOk && pulseCharge[ni] >= PULSE_MAX && nodes[ni].deadT <= 0) firePulse(ni);
    padPrev[key] = dn;
  }
}
// the SIM steps in fixed SIM_DT chunks (see frame()) so a run's outcome is a
// pure function of seed + inputs — the prerequisite for server-side replay
// verification. UI feedback + input polling stay on the raw clock in frame().
// ---------- PAD DIAGNOSTIC (?padtest) ----------
// "I feel nothing" has four different causes and the player cannot tell them
// apart: the pad never reached the browser, the pad has no actuator here, the
// actuator rejects, or the game's own gates are shut. This overlay answers
// which — it lists every gamepad slot as the browser reports it, fires a hard
// test effect at EVERY detected pad once a second (bypassing settings.haptics
// and padDev on purpose — it tests the wire, not the game), and prints what
// the promise actually resolved to. Dev-only: costs nothing without the param.
const PAD_TEST = typeof location !== 'undefined' && /[?&]padtest/.test(location.search);
let padTestLog = [], padTestAt = 0, padTestN = 0;
let padTestBurst = 0; // the test fire is a BURST, and it arms ONLY by explicit
                      // action — the grant click or a SHIFT-click. It used to
                      // arm itself at page load, which meant eight unprompted
                      // shots into the menu on every reload: the exact haunting
                      // this diagnostic exists to catch, caused by it. A
                      // diagnostic must be silent until asked.
function padTestNote(msg) {
  padTestLog.unshift({ t: time, msg });
  if (padTestLog.length > 7) padTestLog.length = 7;
}
function padTestFire() {
  if (padTestBurst <= 0 || time - padTestAt < 1.0) return;
  padTestAt = time;
  padTestBurst--;
  let pads = [];
  try { pads = Array.from(navigator.getGamepads()).filter(p => p); } catch (e) {}
  if (!pads.length) return;
  const n = padTestN++;
  for (const p of pads) {
    const act = p.vibrationActuator;
    const ha = p.hapticActuators && p.hapticActuators[0];
    try {
      if (act && act.playEffect) {
        // rotate through the vocabulary: strong motor, weak motor, triggers
        const kind = n % 3 === 2 && act.effects && act.effects.indexOf('trigger-rumble') >= 0
          ? 'trigger-rumble' : 'dual-rumble';
        const fx = kind === 'trigger-rumble'
          ? { duration: 500, strongMagnitude: 0.3, weakMagnitude: 0.3, leftTrigger: 1, rightTrigger: 1 }
          : n % 3 === 0 ? { duration: 500, strongMagnitude: 1, weakMagnitude: 0 }
          : { duration: 500, strongMagnitude: 0, weakMagnitude: 1 };
        const tag = kind === 'trigger-rumble' ? 'triggers' : n % 3 === 0 ? 'STRONG motor' : 'weak motor';
        act.playEffect(kind, fx)
          .then(r => padTestNote('#' + p.index + ' ' + tag + ' → ' + r))
          .catch(e => padTestNote('#' + p.index + ' ' + tag + ' → REJECTED: ' + (e && e.message || e)));
      } else if (ha && ha.pulse) {
        Promise.resolve(ha.pulse(1, 500))
          .then(r => padTestNote('#' + p.index + ' pulse() → ' + r))
          .catch(e => padTestNote('#' + p.index + ' pulse() → REJECTED: ' + (e && e.message || e)));
      } else padTestNote('#' + p.index + ' has NO actuator in this browser');
    } catch (e) { padTestNote('#' + p.index + ' THREW: ' + (e && e.message || e)); }
  }
  // the WebHID side-door, if granted: full blast both motors, its own send
  // path and its own log line — this is the wire the RumblePad answers on
  if (typeof hidDev !== 'undefined' && hidDev && hidDev.opened) {
    if (hidRumble(1, 1, 500)) padTestNote('webhid ' + (hidFmt ? hidFmt.name : '?') + ' → sent (feel it?)');
  }
}
let padTestRect = null; // the panel IS the grant button — clicks route here
function padTestClick() { // grant on first click; later clicks re-run the burst
  if (typeof hidDev !== 'undefined' && hidDev) { padTestBurst = 8; padTestNote('test burst re-armed'); }
  else hidRumbleRequest();
}
function drawPadTest() {
  padTestFire();
  const lines = [];
  let pads = [];
  try { pads = Array.from(navigator.getGamepads()).filter(p => p); } catch (e) {}
  { // THE VERDICT — one line, plain language, so nobody has to assemble the
    // answer out of five status fields. Everything below it is evidence.
    const pads0 = pads;
    const hidOn = typeof hidDev !== 'undefined' && hidDev && hidDev.opened;
    const anyAct = pads0.some(p2 => p2.vibrationActuator || (p2.hapticActuators && p2.hapticActuators.length));
    lines.push(typeof HID_OFF !== 'undefined' && HID_OFF
      ? '>> SILENT ON PURPOSE: ?nohid is in the URL. Remove it.'
      : !pads0.length ? '>> NO PAD SEEN — press a button on the controller'
      : hidOn ? '>> READY: rumble goes out over WebHID (' + (hidFmt ? hidFmt.name : '?')
        + ') — ' + (typeof hidMonN !== 'undefined' ? hidMonN : 0) + ' sends so far'
      : typeof hidKnown !== 'undefined' && hidKnown
        ? '>> BLOCKED: pad granted but NOT OPEN — another tab of this game holds it'
      : anyAct ? '>> READY: rumble goes out over the Gamepad API'
      : navigator.hid ? '>> ACTION NEEDED: this pad has no Chrome rumble driver. CLICK THIS PANEL to grant WebHID.'
      : '>> NO PATH: no actuator, and this browser has no WebHID');
  }
  lines.push('PAD DIAGNOSTIC — ' + (padTestBurst > 0
    ? 'test burst: ' + padTestBurst + ' shot' + (padTestBurst === 1 ? '' : 's') + ' left'
    : 'test idle — SHIFT-click panel to fire a test burst'));
  if (!pads.length) {
    lines.push('no gamepad exposed. PRESS ANY BUTTON ON THE PAD —');
    lines.push('browsers hide controllers until they speak. If it stays');
    lines.push('empty: pairing/driver, not the game.');
  }
  for (const p of pads) {
    const act = p.vibrationActuator;
    // "no actuator" is the EXPECTED state for any pad Chrome has no rumble
    // driver for — which is why WebHID exists. It used to render in the error
    // colour and read as the fault; it is a routing fact, not a problem.
    const hidOn = typeof hidDev !== 'undefined' && hidDev && hidDev.opened;
    const vib = act
      ? 'vib: ' + (act.effects && act.effects.length ? act.effects.join('+') : (act.type || 'dual-rumble'))
      : p.hapticActuators && p.hapticActuators.length ? 'vib: pulse (FF-style)'
      : hidOn ? 'vib: none via Gamepad API — WebHID is driving it (fine)'
      : 'vib: none via Gamepad API';
    lines.push('#' + p.index + ' "' + String(p.id).slice(0, 44) + '"');
    lines.push('   ' + (p.mapping || 'no mapping') + ' · ' + p.axes.length + ' axes · '
      + p.buttons.length + ' keys · ' + vib);
    // live inputs: phantom axis drift and noisy buttons show up RIGHT HERE —
    // if these dance while the pad lies untouched, the pad is talking, not us
    lines.push('   ax ' + p.axes.map(a2 => (a2 < 0 ? '' : '+') + a2.toFixed(2)).join(' ')
      + ' · down: ' + p.buttons.map((b2, i2) => b2.pressed ? i2 : null).filter(v => v !== null).join(',') || 'none');
  }
  lines.push('game gates: haptics ' + (settings.haptics ? 'ON' : 'OFF — flip it in settings!')
    + ' · padDev ' + (padDev ? 'locked #' + padDev.index : 'none'));
  lines.push(typeof HID_OFF !== 'undefined' && HID_OFF
    ? 'webhid: DISABLED BY ?nohid — drop that param from the URL for rumble'
    : typeof hidDev !== 'undefined' && hidDev
    ? 'webhid: ' + (hidFmt ? hidFmt.name : hidDev.productName) + (hidDev.opened ? ' (open)' : ' (NOT open)')
    : typeof hidKnown !== 'undefined' && hidKnown
    ? 'webhid: granted but NOT OPEN — another tab of this game is holding it'
    : navigator.hid ? 'webhid: none — CLICK THIS PANEL to grant a RumblePad-class pad'
    : 'webhid: unavailable in this browser');
  if (typeof hidDev !== 'undefined' && hidDev)
    lines.push('SHIFT-click panel re-runs the burst · ?hidswap '
      + (typeof HID_SWAP !== 'undefined' && HID_SWAP ? 'ON' : 'off')
      + ' · ?nohid ' + (typeof HID_OFF !== 'undefined' && HID_OFF ? 'ON — we send NOTHING' : 'off')
      + ' · report ?hidfmt=' + (typeof HID_FMT_I !== 'undefined' ? HID_FMT_I : '?') + ' of 0-4');
  lines.push('game buzz: ' + buzzMonN + ' total · last ' + (buzzMonLast || 'none')
    + (buzzMonN ? ' · ' + Math.min(999, time - buzzMonAt).toFixed(1) + 's ago' : ''));
  if (typeof hidMonN !== 'undefined') lines.push('hid sends: ' + hidMonN
    + (hidMonN ? ' · last ' + Math.min(999, time - hidMonAt).toFixed(1) + 's ago' : '')
    + ' — if the pad pulses while this holds still, it is not us');
  for (const l of padTestLog) lines.push((time - l.t).toFixed(0) + 's  ' + l.msg);
  ctx.save();
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  const x = 14 + SAFE.l, y0 = H - 16 - lines.length * 13;
  padTestRect = { x: x - 8, y: y0 - 14, w: 470, h: lines.length * 13 + 20 };
  ctx.fillStyle = 'rgba(2,8,18,0.82)';
  ctx.fillRect(x - 8, y0 - 14, 470, lines.length * 13 + 20);
  ctx.font = '11px ui-monospace, Menlo, monospace';
  ctx.textAlign = 'left';
  lines.forEach((l, i) => {
    ctx.fillStyle = /REJECTED|THREW|FAILED|BLOCKED|NO PAD|NO PATH|SILENT ON PURPOSE/.test(l) ? '#ff8091'
      : /ACTION NEEDED/.test(l) ? '#ffd24a'
      : />> READY|→ complete|→ preempted|reclaimed|adopted/.test(l) ? '#8deda1'
      : 'rgba(200,230,255,0.9)';
    ctx.fillText(l, x, y0 + i * 13);
  });
  ctx.restore();
}
