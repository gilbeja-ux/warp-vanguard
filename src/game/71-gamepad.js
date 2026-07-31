'use strict';
// ---------- gamepad (desktop playtesting) ----------
// two analog sticks ARE the dials: stick direction maps absolutely to node
// angle (up = top of the ring), triggers spend the matching pulse, START
// pauses, A dismisses info discs. In menus the D-pad walks a focus ring
// across the buttons and A presses the focused one.
let padPrev = { a: false, b: false, y: false, start: false, lt: false, rt: false, stick: false };
let gpSel = 0, gpNav = false; // menu focus index + "a controller drives the menus"
let gpStickDir = ''; // last stick step direction — a NEW direction steps again
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
  if (i < 0) i = list.findIndex(b => b.action === 'retry' || b.endless !== undefined);
  gpSel = Math.max(0, i);
  return true;
}
function gpBackAction() { // B: CANCEL (modal, panel, card) / RESTART (pause + report)
  if (state === S.MENU) {
    if (menuConfirm) { menuConfirm = false; sfx.tick(); return; } // close the modal, go nowhere
    if (menuSettings) { menuSettings = false; sfx.tick(); return; } // close the settings panel
    gpMenuBack();
  } else if (state === S.PAUSE) { // B restarts the level from pause
    const b = pauseButtonsList.find(b2 => b2.action === 'restart');
    if (b) pauseTap(b.x + b.w / 2, b.y + b.h / 2, -7);
    else { state = S.PLAY; resumeHold = 0.9; resumeDigit = 0; sfx.tick(); }
  }
  else if (state === S.INFO) { if (!infoOutAt && time - infoShownAt > 0.35) { infoOutAt = time; sfx.tick(); } }
  else if (state === S.GUIDE) closeGuide(); // B hands the wing back
  else if (state === S.END) {
    if (nameEntry) { closeNameEntry(); sfx.tick(); } // cancel the high-score card
    else gpEndPress('retry'); // B: re-run the level
  }
}
function gpMenuBack() { // one step back through the menu screens
  if (menuScreen === 'home' || menuFx) return;
  sfx.tick();
  menuFx = menuScreen === 'map' ? { kind: 'panelsOut', t: 0, dur: 0.42, dir: -1 }
    : menuScreen === 'board' ? { kind: 'boardOut', t: 0, dur: 0.5, to: boardFrom }
    : { kind: 'spinOut', t: 0, dur: 0.35, to: 'home', dir: -1 };
}
function gpQuitAction() { // Y: BACK a screen in the menus, QUIT the run elsewhere
  if (state === S.MENU) {
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
function gpList() {
  // settings rows (toggles) ride the focus ring too — pause and menu panel alike
  if (state === S.MENU) return menuSettings ? menuSetButtons.concat(pauseTogglesList) : menuButtons;
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
  gpNav = true;
  if (gpSel < 0 || gpSel >= list.length) { gpSel = 0; return; }
  const from = gpCenter(list[gpSel]);
  let best = -1, bestD = 1e9;
  list.forEach((b, i) => {
    if (i === gpSel) return;
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
  if (list && list.length && gpNav && !menuFx && !trans
    && !(state === S.MENU && menuScreen === 'map' && !menuSettings)
    && !(state === S.END && nameEntry)) {
    const fb = list[Math.min(gpSel, list.length - 1)];
    if (fb && !fb.sector) {
      ctx.save();
      ctx.strokeStyle = 'rgba(140,235,255,0.9)'; ctx.lineWidth = 2;
      ctx.shadowColor = 'rgba(120,220,255,0.8)'; ctx.shadowBlur = 8;
      if (keyShapePath(fb, 2)) ctx.stroke();
      ctx.restore();
    }
  }
  // on the report, A is hard-mapped to FORWARD (next, else retry), B re-runs, Y exits
  const endA = state === S.END && list
    ? (list.some(b2 => b2.action === 'next') ? 'next' : 'retry') : null;
  if (list) for (const b of list) {
    let h = null;
    if (b.deploy !== undefined || b.action === 'resume'
      || (endA ? b.action === endA : b.action === 'next')) h = 'A';
    else if (b.back) h = 'Y';
    else if (b.action === 'restart' && state === S.PAUSE) h = 'B';
    else if (b.action === 'retry' && state === S.END) h = 'B'; // when A already owns retry the chain never gets here
    else if (b.action === 'menu' && state !== S.MENU) h = 'Y';
    if (!h || b.sector) continue;
    drawPadHint(b.x + b.w / 2, b.y - 2, h);
  }
  if (state === S.MENU && menuScreen !== 'home' && menuBackRect && !menuSettings)
    drawPadHint(menuBackRect.x + menuBackRect.w / 2, menuBackRect.y + menuBackRect.h + 9, 'Y');
  // the high-score card: A saves (once live), B skips
  if (state === S.END && nameEntry) for (const b of nameEntryBtns)
    drawPadHint(b.x + b.w / 2, b.y - 2, b.action === 'nameConfirm' ? 'A' : 'B');
  if (state === S.PLAY && pauseBtnRect && introT >= INTRO_DUR)
    drawPadHint(pauseBtnRect.x + pauseBtnRect.w / 2, pauseBtnRect.y + pauseBtnRect.h + 10, 'START');
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
  if (SPLASH.on) { // any button skips the intro (a pad press can't unlock audio anyway — just fly)
    const anyBtn = gp.buttons.some(b2 => b2 && b2.pressed);
    if (anyBtn && !padPrev.any) { gpSeen = true; if (SPLASH.t >= 0.3) splashEnd(true); }
    padPrev.any = anyBtn;
    // the skip press must not echo into the menu as a phantom A/B/Y/START
    padPrev.a = press(0); padPrev.b = press(1); padPrev.y = press(3); padPrev.start = press(9);
    return;
  }
  if (!gpSeen && (gp.buttons.some(b2 => b2 && b2.pressed) || gp.axes.some(v => Math.abs(v) > 0.3)))
    gpSeen = true; // first real input → button hints + controller boot gate
  // SELECT held on the route map = the ↺ reset hold, same commitment window
  if (press(8) && state === S.MENU && menuScreen === 'map' && !menuConfirm && !menuFx) {
    padSelHold += dt;
    if (padSelHold >= RESET_HOLD) { padSelHold = 0; menuConfirm = true; sfx.tick(); buzz(20); }
  } else padSelHold = 0;
  const start = press(9);
  if (start && !padPrev.start) {
    if (state === S.PLAY) { state = S.PAUSE; sfx.tick(); } // any time — boot sequence included
    else if (state === S.PAUSE) { state = S.PLAY; resumeHold = 0.9; resumeDigit = 0; sfx.tick(); }
    else if (state === S.GUIDE) closeGuide();
    else if (state === S.MENU && !menuConfirm && !menuFx) { menuSettings = !menuSettings; sfx.tick(); } // START: the settings panel
  }
  padPrev.start = start;
  if (state === S.GUIDE) { // the guide: A dismisses, like an info disc
    const aG = press(0);
    if (aG && !padPrev.a) closeGuide();
    padPrev.a = aG;
  }
  const list = gpList();
  const inSettings = state === S.MENU && menuSettings;
  const onMap = state === S.MENU && menuScreen === 'map' && !inSettings;
  if (list && list.length && onMap) {
    // the map is a LIST, not a maze: up/down picks the relay, A deploys,
    // B backs out. Dev keys (BOSS TEST, RESET) stay mouse-only on purpose.
    // relays arrive twice (the lens marker, the left-column row) and the lens
    // only draws the ones it can see — so key the walk on the RELAY, in order,
    // and take whichever button represents it
    const rows = [...new Map(list.filter(b2 => b2.node !== undefined).map(b2 => [b2.node, b2])).values()]
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
    const sy = stick(0) !== null ? stick(0) : stick(1);
    const hadY = padPrev.stick;
    padPrev.stick = sy !== null;
    if (sy !== null && Math.abs(Math.sin(sy)) > 0.6) { // a NEW direction steps again
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
    const sx2 = stick(0) !== null ? stick(0) : stick(1);
    const hadX = padPrev.stick;
    padPrev.stick = sx2 !== null;
    if (sx2 !== null && Math.abs(Math.cos(sx2)) > 0.6) { // a NEW direction slides again
      const d2 = Math.cos(sx2) > 0 ? 1 : -1;
      if (!hadX || gpStickDir !== 'c' + d2) {
        campScrollTgt = clamp(campScrollTgt + d2, 0, totalD - 1); campPendingSync = null; sfx.tick();
        gpStickDir = 'c' + d2;
      }
    } else if (sx2 === null) gpStickDir = '';
    const aC = press(0);
    if (aC && !padPrev.a && list) {
      const sy2 = list.find(b2 => b2.sync === Math.round(campScrollTgt));
      if (sy2) { gpNav = true; const c = gpCenter(sy2); menuTap(c.x, c.y, -7); }
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
        gpNav = true;
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
    const sa = stick(0) !== null ? stick(0) : stick(1);
    const hadStick = padPrev.stick;
    padPrev.stick = sa !== null;
    if (sa !== null) {
      let pointed = -1;
      list.forEach((b, i) => {
        if (!b.sector) return;
        const s = b.sector;
        let d0 = (sa - s.a0) % TAU; if (d0 < 0) d0 += TAU;
        let span = (s.a1 - s.a0) % TAU; if (span < 0) span += TAU;
        if (d0 <= span) pointed = i;
      });
      if (pointed >= 0) {
        if (pointed !== gpSel && gpNav) sfx.tick();
        gpSel = pointed; gpNav = true;
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
      // on the report it's always FORWARD (next / retry) — B is the menu exit
      const target = onMap ? list.find(b2 => b2.deploy !== undefined) // elsewhere the focused key
        : state === S.END
          ? (list.find(b2 => b2.action === 'next') || list.find(b2 => b2.action === 'retry') || list[Math.min(gpSel, list.length - 1)])
          : list[Math.min(gpSel, list.length - 1)];
      if (target) {
        gpNav = true;
        const c = gpCenter(target);
        if (state === S.MENU) menuTap(c.x, c.y, -7);
        else if (state === S.PAUSE) pauseTap(c.x, c.y, -7);
        else endTap(c.x, c.y);
      }
    }
  }
  padPrev.a = a0;
  if (state !== S.PLAY) return;
  if (introT < INTRO_DUR) {
    // controller grip: both sticks held pointing APART — two thumbs bracing
    // the ring — registers the operator (touch thumbs still work as ever)
    const g0 = stick(0), g1 = stick(1);
    if (g0 !== null && g1 !== null && Math.abs(angDiff(g0, g1)) > 2.1) padHold[0] = padHold[1] = true;
    return;
  }
  const fused = boss && boss.mergeT >= 1;
  for (let i = 0; i < 2; i++) {
    if (fused && i === 1) continue;
    const a = stick(i);
    if (a !== null) nodes[i].angle = a;
  }
  for (const [bi, ni, key] of [[6, 0, 'lt'], [7, 1, 'rt']]) { // LT/RT → pulse
    const dn = press(bi);
    if (dn && !padPrev[key] && !boss && pulseCharge[ni] >= PULSE_MAX && nodes[ni].deadT <= 0) firePulse(ni);
    padPrev[key] = dn;
  }
}
// the SIM steps in fixed SIM_DT chunks (see frame()) so a run's outcome is a
// pure function of seed + inputs — the prerequisite for server-side replay
// verification. UI feedback + input polling stay on the raw clock in frame().