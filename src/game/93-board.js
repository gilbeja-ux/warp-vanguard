'use strict';
// ---------- dedicated leaderboard screen ----------
// key for the currently-selected board — matches boardKey() the runs are stored under
function boardKeyFor() {
  if (boardSel.mode === 'endless') return 'endless';
  if (boardSel.mode === 'weekly') return 'weekly:' + boardSel.week;
  const c = CAMPAIGNS[boardSel.camp] || CAMPAIGNS[0];
  return (c ? c.id : 'campaign') + ':' + boardSel.level;
}
// HOW MANY PAST WEEKS THE LADDER LISTS. The ladder only began when weekly boards
// did, so listing back past that would advertise weeks that never existed. This is
// the week the feature shipped; the list runs from the live week back to it, newest
// first, and grows by one row every Monday.
const WEEK_LADDER_FIRST = 2953; // 3–9 AUG, 2026
// The ladder folds under one header, sharing the campaigns' collapse state so there is one
// mechanism rather than two. '#weeks' cannot collide with a campaign id — the loader holds
// those to /^[a-z0-9-]+$/ — and it is a reserved key rather than a campaign that happens
// not to exist yet.
const BOARD_WEEKS = '#weeks';
// DEV: ?weeks=N pretends the ladder has already run N weeks.
//
// The fold below only has anything to fold once history exists, and history arrives one
// Monday at a time — so in the ladder's first week the feature is invisible and cannot be
// reviewed at all. This makes it reviewable now, and again whenever the list's behaviour at
// twenty or fifty rungs matters.
//
// LISTING ONLY. It cannot affect a score: the board key still comes from the real weekNow(),
// and the server recomputes the live week from its own clock before accepting anything (see
// boardKeyFor in submit-run). Picking a fabricated rung just reads an empty board, honestly.
const WEEK_LADDER_DEV = (() => {
  if (typeof location === 'undefined') return 0;
  const m = /[?&]weeks=(\d+)/.exec(location.search);
  return m ? Math.max(1, Math.min(200, parseInt(m[1], 10) || 0)) : 0;
})();
const weekLadder = () => {
  const now = weekNow(), out = [];
  const first = WEEK_LADDER_DEV ? now - (WEEK_LADDER_DEV - 1) : WEEK_LADDER_FIRST;
  for (let w = now; w >= first; w--) out.push(w);
  return out;
};
// kick off the async fetch for the current selection; a newer request drops stale replies
function loadBoard() {
  const key = boardKeyFor(), req = ++boardReqId;
  boardData = { key, loading: true, rows: null, error: false };
  boardSelRank = 1; boardListScroll = 0; // reset selection + scroll for the new board
  lbTop(key, LB_SHOW).then(rows => {
    if (req !== boardReqId) return; // superseded by a newer selection
    boardData = rows ? { key, loading: false, rows, error: false } : { key, loading: false, rows: null, error: true };
  });
}
function openBoard(from) {
  boardFrom = from || 'home';
  boardSelRank = 1;
  // every campaign starts folded (first open only — respects the player's toggles after)
  CAMPAIGNS.forEach(c => { if (boardCollapsed[c.id] === undefined) { boardCollapsed[c.id] = true; boardFoldV[c.id] = 0; } });
  // the ladder folds too, and starts folded for the same reason the campaigns do
  if (boardCollapsed[BOARD_WEEKS] === undefined) { boardCollapsed[BOARD_WEEKS] = true; boardFoldV[BOARD_WEEKS] = 0; }
  // OPENS ON THE LIVE WEEK. It used to open on a prompt ("choose a level to see leading
  // scores") with nothing loaded, which spent the first interaction on a question that has
  // one obvious answer — the ladder is the competitive spine, and the live rung is the only
  // board still in play. boardPick kicks the fetch off while the screen is still flying in.
  boardPick('weekly');
  lbSession(); // background: mint/refresh the session so identity.uid is known (drives "Show my Run")
  // the current menu screen spins out, then the board circles in (see menuFx completion)
  menuFx = { kind: 'spinOut', t: 0, dur: 0.3, to: 'board', dir: 1 };
}
// pick a board from the left list; a fresh campaign/level/mode reloads
function boardPick(mode, camp, level) {
  boardSel.mode = mode;
  if (mode === 'campaign') { boardSel.camp = camp; boardSel.level = level; }
  if (mode === 'weekly') boardSel.week = (camp === undefined || camp === null) ? weekNow() : camp;
  loadBoard();
}
// the left column: Free Flow, then the WEEKLY LADDER newest-first, then each
// campaign (collapsible) + its levels.
//
// The ladder is the competitive spine of the game now. Every Monday the live week
// closes, keeps its field for good, and a new week appears above it — so the list
// grows downward through history and a name that lands on a finished week stays
// there. The live week is marked; the rest are closed and say so.
function boardLeftItems() {
  const items = [
    { kind: 'mode', mode: 'endless', label: 'FREE FLOW', sel: boardSel.mode === 'endless' },
  ];
  const live = weekNow();
  const rung = w => ({
    kind: 'week', week: w, label: weekLabel(w), live: w === live,
    sel: boardSel.mode === 'weekly' && boardSel.week === w,
  });
  // THE LIVE WEEK STAYS OUT IN THE OPEN. It is the one board anyone can still change, and
  // the thing this screen opens on, so it is not worth a tap. What bloats is the HISTORY:
  // a rung every Monday, never removed, and after a year it buries Free Flow and the five
  // contracts. So only the closed weeks fold, under one header.
  items.push(rung(live));
  const past = weekLadder().filter(w => w !== live);
  if (past.length) { // no header over an empty group — in the ladder's first week there is none
    const folded = !!boardCollapsed[BOARD_WEEKS];
    items.push({ kind: 'weeks', id: BOARD_WEEKS, collapsed: folded, label: 'WEEKLY LANES' });
    for (const w of past) items.push(Object.assign(rung(w), { inGroup: true }));
  }
  CAMPAIGNS.forEach((c, ci) => {
    const collapsed = !!boardCollapsed[c.id];
    items.push({ kind: 'camp', camp: ci, id: c.id, label: (c.title || 'CAMPAIGN ' + (ci + 1)).toUpperCase(), collapsed });
    // levels ride along even when folded — the animated fold factor collapses them
    (c.levels || []).forEach((lv, li) => items.push({
      kind: 'level', camp: ci, level: li, campId: c.id, label: levelRouteName(ci, li),
      sel: boardSel.mode === 'campaign' && boardSel.camp === ci && boardSel.level === li,
    }));
  });
  return items;
}
let boardListGeom = null; // { rowFullH, vH } set at draw — for Show-my-Run scroll math
function boardScrollToRank(rank) {
  if (!boardListGeom) return;
  const { rowFullH, vH } = boardListGeom;
  boardListScroll = (rank - 1) * rowFullH - vH / 2 + rowFullH / 2; // clamped when the list draws
}
function boardReplayLaunch(r) {
  if (replayLoading || !r.trace_id) return;
  replayLoading = r.trace_id; replayErr = ''; sfx.tick();
  lbTrace(r.trace_id).then(pkg => {
    if (replayLoading !== r.trace_id) return;
    replayLoading = null;
    if (!pkg) { replayErr = 'REPLAY UNAVAILABLE'; replayErrAt = time; return; }
    // launch PAUSED on frame 0, then run the enter transition (board flies out /
    // zooms into the ring, the player's chrome flies in)
    if (launchReplay(pkg, { name: r.player_name, score: r.score, mode: boardSel.mode }, true)) replayXfer = { dir: 1, t: 0 };
    // a refused launch says why itself (an older era's trace); anything else quiet is a plain failure
    else if (!replayErr) { replayErr = 'REPLAY UNAVAILABLE'; replayErrAt = time; }
  });
}
// FLY THIS LANE — the board's one way OUT into play. The board used to be a dead
// end: it opens on the live week, and a player who has not yet unlocked FREE FLOW
// could read the field but never fly it (the mode wheel was the only door, and it
// was locked). The key sits in the ring's TOP cap, mirroring Show my Run in the
// bottom one, and flies whatever board is selected:
//   endless   → the endless lane (gated by the FREE FLOW unlock, like the wheel)
//   weekly    → that week's seeded lane; a CLOSED week flies as practice and says
//               so — the submit path is hidden and the server refuses it anyway
//   campaign  → that relay, briefed, if the campaign has unlocked it
// A locked lane still draws the key, dimmed, with no button behind it: the wheel
// and the relay map already say what unlocks it.
function boardLane() {
  const m = boardSel.mode;
  if (m === 'endless') return { label: 'FLY THIS LANE', locked: !flowUnlocked(), go: startEndless };
  if (m === 'weekly') {
    const w = boardSel.week, live = w === weekNow();
    return { label: live ? 'FLY THIS LANE' : 'PRACTICE THIS LANE', locked: !flowUnlocked(), go: () => startWeekly(w) };
  }
  if (m === 'campaign') {
    const ci = boardSel.camp, li = boardSel.level, c = CAMPAIGNS[ci], pc = c && progress.camp[c.id];
    const open = !!c && li < ((pc && pc.unlocked) || 1) && li < c.levels.length;
    return { label: 'FLY THIS LANE', locked: !open, go: () => { switchCampaign(ci); startLevel(li, true); } };
  }
  return null;
}
// TIME SPENT IN WARP — mm:ss, because a run is minutes long and 158.6 reads as a
// measurement rather than a duration. Rounds to the nearest second: the row stores
// tenths, and a tenth is below what a player could act on.
function fmtRunTime(sec) {
  const t = Math.max(0, Math.round(+sec || 0));
  return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0');
}
// DID THIS RUN FINISH? A run ends in exactly two places — the lane's duration
// running out with the bore clear, or integrity hitting zero (see the two endLevel
// calls in 72-tick.js) — so `integrity > 0` IS the completion flag, and no column
// had to be invented for it. It is also the SERVER's number: the verifier recomputes
// integrity from the trace, so the colour cannot be claimed by a client.
//
// Endless and weekly have no finish to reach. They run until integrity is gone, so
// every one of their rows would read as incomplete, which says nothing about the
// run. They stay uncoloured rather than wearing a colour that means "failed".
const runFinished = r => boardSel.mode !== 'endless' && boardSel.mode !== 'weekly' && ((r && r.integrity) | 0) > 0;
function drawMenuBoard() {
  const fmtDate = ts => {
    if (!ts) return '—';
    const d = new Date(ts), MO = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
    const p = n => String(n).padStart(2, '0');
    return p(d.getDate()) + '-' + MO[d.getMonth()] + '-' + d.getFullYear() + ', ' + p(d.getHours()) + ':' + p(d.getMinutes());
  };
  // ---- proportional scale: the mock is 1748×804, so everything keys off H ----
  const F = v => Math.max(10, Math.round(v)); // font floor for readability
  const fTitle = F(H * 0.050), fLeft = F(H * 0.026), fRow = F(H * 0.030), fShow = F(H * 0.021);
  const fName = F(H * 0.030); // the detail rows size their own label/value — see the column below
  const leftRowH = Math.min(H * 0.070, 56), leftGap = Math.min(H * 0.014, 12);
  const rowH = Math.min(H * 0.080, 64), rowGap = Math.min(H * 0.017, 14);
  const cardGap = Math.min(H * 0.017, 14);
  const card = (x, y, w, h, on) => {
    techRect(x, y, w, h, 7); ctx.fillStyle = on ? 'rgba(110,170,230,0.24)' : 'rgba(8,18,36,0.74)'; ctx.fill();
    ctx.strokeStyle = on ? '#eef8ff' : 'rgba(110,165,215,0.5)'; ctx.lineWidth = on ? 2 : 1.2;
    techRect(x, y, w, h, 7); ctx.stroke();
  };

  // ---- columns ----
  const lx = SAFE.l + Math.max(8, W * 0.030 - 20), lw = Math.min(W * 0.205, 380), tb = leftRowH; // tb: the +/- toggle square

  // ---- MIDDLE: the bore ring — CENTERED like the game ring. The interior stays
  // OPEN (the live tunnel shows through behind the entries); solid black circle-
  // segment CAPS carry the title (top) and Show-my-Run (bottom), drawn AFTER the
  // rows so scrolling entries slide underneath them. ----
  const cx = W / 2, cy = H / 2;
  const R = Math.min(H * 0.46, cx - (lx + lw) - W * 0.012);
  const bz = Math.min(W, H) * 0.045; // ring band thickness
  // arch helpers: the x where the ring's OUTER edge sits at a given height, so the
  // side columns can hug the rim like the campaign relay list (copied from it)
  const ro = R + bz / 2 + 6;
  const ringL = yv => { const d = Math.min(Math.abs(yv - cy), ro); return cx - Math.sqrt(ro * ro - d * d); };
  const ringR = yv => { const d = Math.min(Math.abs(yv - cy), ro); return cx + Math.sqrt(ro * ro - d * d); };
  // sink the title to where the ring's INNER chord is wide enough for the whole
  // word — it must live inside the ring's perimeter, never under the band
  ctx.font = '800 ' + fTitle + 'px Audiowide, system-ui';
  const titleW = ctx.measureText('LEADERBOARD').width + fTitle * 0.5; // + letter-spacing slack
  const Rin = R - bz * 0.55, halfNeed = titleW / 2 + 20;
  const tdy = Math.sqrt(Math.max(Rin * Rin * 0.25, Rin * Rin - halfNeed * halfNeed));
  // "Show my Run" baseline: inside the ring's inner edge, but never off-screen
  // (the disc may overflow the bottom edge slightly, like the mock)
  const showBase = Math.min(cy + R - bz * 0.9, H - SAFE.b) - H * 0.042;
  const capBotY = showBase - fShow - H * 0.022; // the bottom cap's chord edge (exists with my run or a lane to fly)
  // FLY THIS LANE shares that bottom cap with Show my Run: the two keys split the
  // chord side by side when both exist, and whichever is alone sits centered.
  const lane = boardLane();
  const titleBase = cy - tdy + fTitle * 0.28;  // nudged up to sit centered in its cap
  const capTopY = titleBase + fTitle * 0.85;   // a clear gap between the title and the list

  // the right info column hugs the ring's outer edge, like the mock
  const rx = cx + R + bz * 0.5 + W * 0.010, rw = Math.max(140, W - SAFE.r - W * 0.020 - rx);

  // ---- transitions: boardIn/boardOut (home<->board) turn the ring; replayXfer
  // (board<->player) zooms the ring into/out of the lens + fades the chrome ----
  let ringRot = 0, ringAlpha = 1, ringZoom = 1, backA = 1;
  if (menuFx && menuFx.kind === 'boardIn') {
    const p = clamp(menuFx.t / (menuFx.dur * 0.62), 0, 1), eo = 1 - (1 - p) * (1 - p); // quick, ease-out
    ringRot = -(1 - eo) * 0.7; ringAlpha = clamp(eo * 1.6, 0, 1);
  } else if (menuFx && menuFx.kind === 'boardOut') {
    const p = clamp(menuFx.t / (menuFx.dur * 0.8), 0, 1), ei = p * p;                   // quick, ease-in
    ringRot = -ei * 0.7; ringAlpha = clamp(1 - ei * 1.25, 0, 1);
  }
  if (replayXfer) { // player transition: the center ZOOMS into the lens (out) / back (in)
    const out = replayXfer.dir === 1 ? clamp(replayXfer.t / 0.5, 0, 1) : 1 - clamp((replayXfer.t - 0.3) / 0.42, 0, 1);
    const eo = out * out;
    ringZoom = 1 + eo * 1.9; ringAlpha = 1 - clamp(eo * 1.3, 0, 1); backA = 1 - out;
  }

  // ---- BACK: the game's STANDARD back key (fades out with the board on the player transition) ----
  // THE KEY SCALES WITH THE BOARD. It was a flat 38px while every other element on
  // this screen keys off H, so on a desktop window it sat at 38 beside 56px mode
  // rows and a 76px Replay key and read as a leftover. It now tracks the left
  // column's own row height, with 38 held as a FLOOR: on a phone that expression
  // falls to 27px, which is below what a thumb can reliably hit.
  // Rounded, because these coordinates are laid out from it and a canvas draws a
  // half-pixel edge soft.
  const keyH = Math.round(Math.max(38, Math.min(H * 0.070, 56)));
  // TOP-LEFT, like every back key in the game as of 2026-08-30 (see 90-hud.js).
  const bk = menuBackRect = { x: 12 + SAFE.l, y: 12 + SAFE.t, w: keyH, h: keyH };
  ctx.save(); ctx.globalAlpha = backA;
  techRect(bk.x, bk.y, bk.w, bk.h, 8);
  ctx.fillStyle = 'rgba(6,20,40,0.6)'; ctx.fill();
  ctx.strokeStyle = 'rgba(120,220,255,0.55)'; ctx.lineWidth = 1.5;
  techRect(bk.x, bk.y, bk.w, bk.h, 8); ctx.stroke();
  ctx.strokeStyle = 'rgba(200,240,255,0.9)'; ctx.lineWidth = Math.max(2, keyH * 0.066); ctx.lineCap = 'round';
  // the chevron is drawn in fractions of the key, not in pixels, so it stays the
  // same glyph at every size instead of shrinking into a corner as the key grows
  ctx.beginPath();
  ctx.moveTo(bk.x + keyH * 0.63, bk.y + keyH * 0.29);
  ctx.lineTo(bk.x + keyH * 0.37, bk.y + keyH * 0.50);
  ctx.lineTo(bk.x + keyH * 0.63, bk.y + keyH * 0.71);
  ctx.stroke();
  ctx.restore();

  // ---- MY DATA: rename every run I hold, or erase them all ----
  // It rides in the top-right corner rather than in the entry-detail column, because
  // it is not about the SELECTED run — both verbs act on every row this player
  // holds, across every board. The detail column describes one entry; this does
  // not belong in it. Always present, never gated on holding a row here: a
  // player with nothing on this board may still hold runs on five others.
  // THE BOX IS MEASURED FROM THE WORDS, not guessed. It was a fixed 84px wide while
  // its type scaled with H, so on a desktop window 'MY DATA' was set at 19px in a
  // box built for 10px type and ran straight out of both ends. Audiowide is a wide
  // face and there is no width the label fits at every viewport — so the label is
  // measured and the key is drawn around it.
  const mdF = F(keyH * 0.34);
  ctx.font = '700 ' + mdF + 'px Audiowide, system-ui';
  const mdW = Math.round(ctx.measureText('MY DATA').width + mdF * 1.8);
  // …and MY DATA took the corner BACK vacated. It cannot ride beside the back key
  // any more: the back key moved to the left corner and the mode column starts
  // there. It is a screen action, not a back control, so the free corner suits it.
  const mdk = { x: W - 12 - SAFE.r - mdW, y: bk.y, w: mdW, h: keyH };
  { ctx.save(); ctx.globalAlpha = backA;
    techRect(mdk.x, mdk.y, mdk.w, mdk.h, 8);
    ctx.fillStyle = 'rgba(6,20,40,0.6)'; ctx.fill();
    ctx.strokeStyle = 'rgba(120,220,255,0.4)'; ctx.lineWidth = 1.5;
    techRect(mdk.x, mdk.y, mdk.w, mdk.h, 8); ctx.stroke();
    ctx.fillStyle = 'rgba(200,240,255,0.85)'; ctx.font = '700 ' + mdF + 'px Audiowide, system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('MY DATA', mdk.x + mdk.w / 2, mdk.y + mdk.h / 2 + mdF * 0.36);
    ctx.textAlign = 'left';
    ctx.restore();
    if (backA > 0.5) menuButtons.push({ x: mdk.x, y: mdk.y, w: mdk.w, h: mdk.h, boardMyData: true }); }

  // ================= LEFT: modes + collapsible campaigns (animated fold) =================
  // ease every foldable group toward its open/closed target — the campaigns and the ladder
  for (const k of CAMPAIGNS.map(c => c.id).concat(BOARD_WEEKS)) {
    const t = boardCollapsed[k] ? 0 : 1, v = boardFoldV[k] === undefined ? 1 : boardFoldV[k];
    boardFoldV[k] = Math.abs(t - v) < 0.01 ? t : v + (t - v) * 0.22;
  }
  const items = boardLeftItems();
  const ind = Math.round(leftRowH * 0.42); // level indent (narrower card, right-aligned to the arc)
  const foldKey = it => it.kind === 'level' ? it.campId : (it.kind === 'week' && it.inGroup) ? BOARD_WEEKS : null;
  const foldOf = it => { const k = foldKey(it); return k === null || boardFoldV[k] === undefined ? 1 : boardFoldV[k]; };
  const listY = SAFE.t + H * 0.035, listBot = H - SAFE.b - H * 0.02, viewH = listBot - listY;
  const totalH = items.reduce((a, it) => a + (leftRowH + leftGap) * foldOf(it), 0);
  boardLeftScroll = clamp(boardLeftScroll, 0, Math.max(0, totalH - viewH));
  // ARCHED column: every card is the same width and RIGHT-aligns to the ring's
  // left rim, so the stack curves to hug the ring (like the campaign relay list)
  const colW = Math.max(150, (cx - ro) - lx - 12);
  boardRects.left = { x: lx - 10, y: listY, w: cx - ro - lx + 24, h: viewH };
  // during the enter/exit fx, widen the clip so items can fly in from off-screen
  const fxOn = !!(menuFx && (menuFx.kind === 'boardIn' || menuFx.kind === 'boardOut')) || !!replayXfer;
  const clipL = fxOn ? -W : lx - 12;
  ctx.save(); ctx.beginPath(); ctx.rect(clipL, listY - 2, cx - clipL, viewH + 4); ctx.clip();
  let yy = listY - boardLeftScroll, vidx = 0;
  for (const it of items) {
    const f = foldOf(it), rh = leftRowH * f;
    if (f > 0.03 && yy + rh > listY - 2 && yy < listBot + 2) {
      ctx.save();
      ctx.translate(boardRowOff(vidx, 'left'), 0);     // arrive / leave one by one
      vidx++;
      ctx.globalAlpha = f;
      ctx.textAlign = 'left';
      const rightX = ringL(yy + rh / 2) - 12;          // right edge rides the ring arc
      const cw = it.kind === 'level' ? colW - ind : colW;
      const cardX = rightX - cw;
      if (it.kind === 'camp' || it.kind === 'weeks') {
        card(cardX, yy, cw, leftRowH, false);
        const th = leftRowH * 0.17, tX = cardX + 14, tcy = yy + leftRowH / 2; // inline +/- box
        ctx.strokeStyle = 'rgba(255,210,74,0.9)'; ctx.lineWidth = 2; ctx.lineCap = 'round';
        ctx.strokeRect(tX, tcy - th, th * 2, th * 2);
        ctx.beginPath(); ctx.moveTo(tX + th * 0.5, tcy); ctx.lineTo(tX + th * 1.5, tcy);
        if (it.collapsed) { ctx.moveTo(tX + th, tcy - th * 0.5); ctx.lineTo(tX + th, tcy + th * 0.5); } ctx.stroke();
        // a header cannot be selected, so the one HOLDING the selected board is the
        // focused row — the same rule the list follows, applied a level up
        const holds = it.kind === 'weeks' ? boardSel.mode === 'weekly'
          : boardSel.mode === 'campaign' && boardSel.camp === it.camp;
        ctx.fillStyle = '#ffd24a'; ctx.font = '700 ' + fLeft + 'px Audiowide, system-ui';
        const labX = tX + th * 2 + 12;
        // (no count on this header. It was here, right-aligned, and the space it reserved
        //  clipped the last letter of WEEKLY LANES — the title is the thing that had to fit,
        //  and the campaign headers carry no count either.)
        drawMarquee('bl' + it.id, it.label, labX, tcy + fLeft * 0.36, cardX + cw - 16 - labX, holds ? marqueeK() : null);
        menuButtons.push({ x: cardX, y: yy, w: cw, h: leftRowH, boardLeft: it });
      } else if (it.kind === 'mode') {
        card(cardX, yy, cw, leftRowH, !!it.sel);
        ctx.fillStyle = it.sel ? '#ffffff' : 'rgba(215,235,252,0.9)'; ctx.font = '700 ' + fLeft + 'px Audiowide, system-ui';
        drawMarquee('bl' + it.mode, it.label, cardX + 16, yy + leftRowH / 2 + fLeft * 0.36, cw - 32, it.sel ? marqueeK() : null);
        menuButtons.push({ x: cardX, y: yy, w: cw, h: leftRowH, boardLeft: it });
      } else if (it.kind === 'week') {
        // A LADDER RUNG. The live week wears the warm accent every live thing in the
        // game wears; a closed week is cool and carries a lock pip, because the whole
        // promise of the ladder is that a finished board cannot move again.
        card(cardX, yy, cw, leftRowH, !!it.sel);
        const cy2 = yy + leftRowH / 2;
        const pipR = Math.max(2.5, leftRowH * 0.09), pipX = cardX + 16 + pipR;
        ctx.beginPath(); ctx.arc(pipX, cy2, pipR, 0, TAU);
        ctx.fillStyle = it.live ? '#ffd24a' : 'rgba(120,165,215,0.55)';
        ctx.fill();
        if (it.live) { // a soft corona: this is the one you can still change
          ctx.beginPath(); ctx.arc(pipX, cy2, pipR * 2.1, 0, TAU);
          ctx.fillStyle = 'rgba(255,210,74,0.16)'; ctx.fill();
        }
        const labX2 = pipX + pipR + 12;
        ctx.fillStyle = it.sel ? '#ffffff' : it.live ? '#ffe9a8' : 'rgba(190,215,240,0.82)';
        ctx.font = '700 ' + fLeft + 'px Audiowide, system-ui';
        drawMarquee('blw' + it.week, it.label, labX2, cy2 + fLeft * 0.36, cw - (labX2 - cardX) - 16, it.sel ? marqueeK() : null);
        menuButtons.push({ x: cardX, y: yy, w: cw, h: leftRowH, boardLeft: it });
      } else {
        card(cardX, yy, cw, rh, !!it.sel);
        if (f > 0.5) {
          // the level NUMBER rides the gutter LEFT of the card, right-aligned into
          // a scannable column — kept out of the card so the name's width is
          // untouched. Number, not index: `it.level` is zero-based, `lvNum(levelNo(
          // ...))` is what a player calls that lane. There is no level 00.
          const numStr = lvNum(levelNo(it.camp, it.level));
          const numPad = Math.round(leftRowH * 0.12);
          const fNum = fitPx(numStr, '700', Math.round(fLeft * 0.82), ind - numPad * 1.5, 8); // two digits still fit the indent
          ctx.textAlign = 'right'; ctx.font = '700 ' + fNum + 'px Audiowide, system-ui';
          ctx.fillStyle = it.sel ? 'rgba(255,255,255,0.85)' : 'rgba(150,195,240,0.6)';
          ctx.fillText(numStr, cardX - numPad, yy + rh / 2 + fNum * 0.36);
          ctx.textAlign = 'left';
          ctx.fillStyle = it.sel ? '#ffffff' : 'rgba(215,235,252,0.9)'; ctx.font = '700 ' + fLeft + 'px Audiowide, system-ui';
          // the board list names the same routes the campaign list does, so it
          // overruns the same way and answers it the same way
          drawMarquee('bl' + it.campId + '#' + it.level, it.label, cardX + 16, yy + rh / 2 + fLeft * 0.36, cw - 32, it.sel ? marqueeK() : null);
        }
        if (f > 0.6) menuButtons.push({ x: cardX, y: yy, w: cw, h: rh, boardLeft: it });
      }
      ctx.restore();
    }
    yy += (leftRowH + leftGap) * f;
  }
  ctx.restore();

  // ================= MIDDLE: ranked list inside the disc =================
  ctx.save(); ctx.globalAlpha = ringAlpha;                 // the whole ring turns / zooms in/out
  ctx.translate(cx, cy); ctx.rotate(ringRot); ctx.scale(ringZoom, ringZoom); ctx.translate(-cx, -cy);
  const bd = boardData, meId = lbUid();
  const centerMsg = (m, col) => { ctx.textAlign = 'center'; ctx.fillStyle = col; ctx.font = '700 ' + fRow + 'px Audiowide, system-ui'; ctx.fillText(m, cx, cy); };
  boardRects.list = null; boardListGeom = null;
  // "mine": my BEST row — I may hold several rows on a board (one per run), and
  // rows arrive already ranked, so the first player_id match is the highest one.
  // If the id can't be matched (anon session drift on mobile), fall back to the
  // row at the rank I stored when I submitted. Every one of my rows still gets
  // the "you" highlight in the list below.
  let mine = bd && bd.rows && bd.rows.find(r => r.player_id === meId);
  if (!mine && bd && bd.rows && bd.rows.length && progress.myBoards && progress.myBoards[bd.key]) {
    const rk = clamp(progress.myBoards[bd.key], 1, bd.rows.length);
    mine = bd.rows[rk - 1] || { rank: rk };
  }
  if (!boardSel.mode) { // nothing picked yet — the prompt, centered in the ring
    ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(185,218,246,0.82)'; ctx.font = '700 ' + Math.round(fRow * 0.9) + 'px Audiowide, system-ui';
    ['CHOOSE A STAGE', 'TO SEE', 'LEADING SCORES'].forEach((w, i) => ctx.fillText(w, cx, cy + (i - 1) * fRow * 1.45));
  }
  else if (!bd || bd.loading) centerMsg('SYNCING…', 'rgba(140,220,255,0.7)');
  else if (bd.error) centerMsg('OFFLINE', 'rgba(255,150,90,0.85)');
  else if (!bd.rows || !bd.rows.length) centerMsg('NO RUNS YET — BE THE FIRST', 'rgba(160,200,230,0.6)');
  else {
    const rows = bd.rows;
    const rowW = Math.min(W * 0.31, R * 1.5), rowX = cx - rowW / 2, rowFullH = rowH + rowGap;
    // the rows band stays inside the ring's INNER edge and between the black caps
    const Ri = R - bz * 0.7;
    const dyMax = Math.sqrt(Math.max(0, Ri * Ri - (rowW / 2) * (rowW / 2))) - 4;
    const viewT = Math.max(cy - dyMax, capTopY + 2);
    const viewB = mine ? Math.min(cy + dyMax, capBotY - 2) : cy + dyMax;
    const vH = viewB - viewT;
    boardListScroll = clamp(boardListScroll, 0, Math.max(0, rows.length * rowFullH - vH));
    boardRects.list = { x: rowX, y: viewT, w: rowW, h: vH };
    boardListGeom = { rowFullH, vH };
    ctx.save(); ctx.beginPath(); ctx.rect(rowX - 6, viewT - 2, rowW + 12, vH + 4); ctx.clip();
    let ey = viewT - boardListScroll;
    for (const r of rows) {
      if (ey + rowH > viewT - 4 && ey < viewB + 4) {
        const selr = r.rank === boardSelRank, you = r.player_id === meId, cy2 = ey + rowH / 2 + fRow * 0.36;
        card(rowX, ey, rowW, rowH, selr);
        ctx.textAlign = 'left'; ctx.font = '700 ' + fRow + 'px Audiowide, system-ui';
        ctx.fillStyle = '#8fd8ff'; ctx.fillText(r.rank, rowX + rowW * 0.045, cy2);
        ctx.fillStyle = you ? '#ffd24a' : '#f2f9ff';
        ctx.fillText(('' + (r.player_name || 'ANON')).slice(0, 16), rowX + rowW * 0.045 + fRow * 2.2, cy2, rowW * 0.50);
        ctx.textAlign = 'right'; ctx.fillStyle = '#ffd24a';
        ctx.fillText((r.score || 0).toLocaleString(), rowX + rowW * 0.955, cy2);
        menuButtons.push({ x: rowX, y: ey, w: rowW, h: rowH, boardRow: r.rank });
      }
      ey += rowFullH;
    }
    ctx.restore();
  }
  // ---- the black circle-segment caps, OVER the rows (entries slide under them) ----
  const capSeg = (y0, y1) => { // solid black segment of the disc between two horizontal edges
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.clip();
    ctx.fillStyle = '#04070d'; ctx.fillRect(cx - R, y0, R * 2, y1 - y0);
    ctx.restore();
  };
  // top cap: the title zone (the text itself draws LAST, on top of the ring)
  capSeg(cy - R, capTopY);
  // bottom cap: a smaller segment carrying the keys — FLY THIS LANE (left) and
  // Show my Run (right, only when I'm on this board). Two keys split the chord
  // at the cap's edge between them with a gap; one key alone sits centered.
  if (mine || lane) {
    capSeg(capBotY, cy + R);
    ctx.font = '700 ' + fShow + 'px Audiowide, system-ui';
    const keys = [];
    if (lane) keys.push({ label: lane.label, col: lane.locked ? 'rgba(90,190,255,0.32)' : 'rgba(90,190,255,0.95)', btn: lane.locked ? null : { boardFly: lane.go } });
    if (mine) keys.push({ label: 'Show my Run', col: 'rgba(90,190,255,0.95)', btn: { boardShowMe: mine.rank } });
    // the usable chord: measured at the text line, inside the band's INNER edge
    // (the band paints over the rows' zone, so a label must stop short of it)
    const Rin2 = R - bz * 0.55, dTxt = showBase - fShow * 0.36 - cy;
    const half = Math.sqrt(Math.max(0, Rin2 * Rin2 - dTxt * dTxt)) - fShow * 0.6;
    const gap = Math.min(W * 0.02, fShow * 1.4);
    const slotW = keys.length > 1 ? (half * 2 - gap) / keys.length : half * 2;
    keys.forEach((k, i) => {
      const kx = keys.length > 1 ? cx - half + slotW * i + gap * i + slotW / 2 : cx;
      const tw = ctx.measureText(k.label).width;
      ctx.textAlign = 'center'; ctx.fillStyle = k.col;
      ctx.fillText(k.label, kx, showBase, slotW - 8);
      if (k.btn) menuButtons.push(Object.assign({ x: kx - Math.min(tw, slotW - 8) / 2 - 14, y: capBotY, w: Math.min(tw, slotW - 8) + 28, h: cy + R - capBotY }, k.btn));
    });
  }

  // the thick matte-black ring band — drawn OVER the rows so they pass beneath
  // it, exactly like the in-game bore ring (no lit edges, per the design)
  ctx.strokeStyle = '#05090f'; ctx.lineWidth = bz;
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();

  // the TITLE — topmost, over the ring, seated inside its perimeter
  ctx.font = '800 ' + fTitle + 'px Audiowide, system-ui';
  try { ctx.letterSpacing = '4px'; } catch (e) {}
  ctx.textAlign = 'center'; ctx.fillStyle = '#cfe8ff';
  ctx.fillText('LEADERBOARD', cx, titleBase);
  try { ctx.letterSpacing = '0px'; } catch (e) {}
  ctx.restore(); // end ring circle-in transform

  // ================= RIGHT: selected entry details (count-up, ring-aligned) =================
  const sel = bd && bd.rows && bd.rows.find(r => r.rank === boardSelRank);
  if (sel) {
    ctx.save(); // right column (each card flies in individually below)
    // count-up: the numbers race from 0 to their values when the selection changes
    const pnow = (typeof performance !== 'undefined' && performance.now ? performance.now() : 0) / 1000;
    const dkey = (bd ? bd.key : '') + '#' + boardSelRank;
    if (dkey !== boardDetailKey) { boardDetailKey = dkey; boardDetailT = pnow; }
    const ap = clamp((pnow - boardDetailT) / 0.6, 0, 1), easeUp = 1 - (1 - ap) * (1 - ap);
    const AN = v => Math.round((v || 0) * easeUp);

    // each card LEFT-aligns to the ring's RIGHT rim at its own height (the mirror
    // of the left column's arch), stood off the rim like the left column
    const archL = yv => ringR(yv) + Math.max(18, W * 0.014), rEdge = W - SAFE.r - 8;
    let dy = 12 + SAFE.t; // top-aligned with the back key
    const nameCardH = Math.min(H * 0.082, 66);
    { ctx.save(); ctx.translate(boardRowOff(0, 'right'), 0);
      const lX = archL(dy + nameCardH / 2), nm = ('' + (sel.player_name || 'ANON')).slice(0, 16);
      ctx.font = '700 ' + fName + 'px Audiowide, system-ui';
      // clear of MY DATA, not merely of BACK. The handle card sits on the SAME row as
      // both keys, and the old clamp stopped at the back key — so a long handle ran
      // underneath MY DATA, which is the neighbour it actually meets first.
      const nameW = Math.min(Math.min(mdk.x - 12, rEdge) - lX, ctx.measureText(nm).width + 36); // shrink to fit the name
      card(lX, dy, nameW, nameCardH, false);
      ctx.textAlign = 'left'; ctx.fillStyle = '#f2f9ff';
      ctx.fillText(nm, lX + 16, dy + nameCardH / 2 + fName * 0.36, nameW - 28);
      ctx.restore(); }
    dy += nameCardH + cardGap;

    const threats = (sel.zaps || 0) + (sel.misses || 0);
    const pct = sel.zaps ? Math.round((sel.perfects || 0) / sel.zaps * 100) : 0;
    const comboSec = Math.round(sel.combo_sec || 0);
    // [label, final value (sizes the card so it doesn't grow mid-count), animated display]
    const details = [
      ['Log Date', fmtDate(sel.created_at), fmtDate(sel.created_at)],
      ['Total Score', (sel.score || 0).toLocaleString(), AN(sel.score).toLocaleString()],
      ['Max. Combo', 'x' + (sel.max_combo || 0) + (comboSec ? ' (' + comboSec + 'sec)' : ''),
                     'x' + AN(sel.max_combo) + (comboSec ? ' (' + AN(comboSec) + 'sec)' : '')],
      ['Hits', (sel.zaps || 0) + ' / ' + threats, AN(sel.zaps) + ' / ' + AN(threats)],
      ['Perfect', (sel.perfects || 0) + ' (' + pct + '%)', AN(sel.perfects) + ' (' + AN(pct) + '%)'],
      // TIME SPENT IN WARP. Last, so it sits against the Replay key — the button
      // that plays exactly this long. Green says the run reached its destination;
      // gold, the panel's ordinary value colour, says it did not. A fourth slot in
      // the tuple carries that, so no other card's colour had to change.
      ['Run Time', fmtRunTime(sel.time_sec), fmtRunTime(AN(sel.time_sec)),
                   runFinished(sel) ? '#7ee262' : '#ffd24a'],
    ];
    // VERTICAL BUDGET: the name card, six stat rows, the Replay key and the report
    // link must all fit above the screen bottom. Replay and the report strip are
    // RESERVED off the top rather than taken out of the slack, because there is no
    // slack to take them from — whatever is left divides among the six rows.
    //
    // SIX STATS IN BOXES DID NOT FIT A PHONE. Every card carried its own plate, its
    // own outline and its own internal padding, so most of the column's height was
    // spent on chrome around two short lines — and the pitch was the card PLUS a
    // gap, because two adjacent plates need air between them or they read as one.
    // Six of those crowded a 390px-tall screen.
    //
    // The plates are gone. A stat is now a dim label over a bright value, parted
    // from the next by a hairline — the same reading the END screen's telemetry
    // strip and the replay chrome's bottom row already use, so this is the third
    // place wearing one design rather than a fourth invention. A rule needs no air
    // around it, so the rows sit flush and the pitch IS the row. That bought enough
    // back to make the VALUE bigger (H*0.030 against the old H*0.026) while still
    // taking less height per stat than five boxed cards did.
    const dLab = F(H * 0.020), dVal = F(H * 0.030);
    const lvGap = Math.max(3, Math.round(H * 0.008));  // label baseline to value baseline
    // A BASELINE IS NOT THE BOTTOM OF THE TYPE. Measuring a row as label + gap +
    // value stops at the value's baseline, so its descenders hung into the air the
    // row thought it had — which put the hairline about two pixels under the digits
    // and made a column that fits look cramped. The tail is counted, and then real
    // padding is added on top of it.
    const valDrop = Math.round(dVal * 0.22);           // the value's tail, below its baseline
    const rowPad = Math.max(4, Math.round(H * 0.011)); // clear air above the label, below the tail
    const rowInk = dLab + lvGap + dVal + valDrop;      // cap-top of the label to the foot of the value
    const bottom = H - SAFE.b - H * 0.025;
    const fRep = F(H * 0.020), repRes = fRep + 16;     // the report link's own strip
    // Replay stays a KEY, so it keeps its plate — it is the one thing here you press,
    // and stripping its box would hide it among the readings. It takes keyH, the
    // height BACK and MY DATA are drawn at, so every key on this screen is one size.
    const repH2 = keyH, repGap = Math.max(10, Math.round(H * 0.018));
    // The row is whichever is larger, the proportional height or the ink plus its
    // padding — so the padding is a floor the row grows to meet, never something the
    // proportional height can squeeze out. The fit still caps both: on a screen with
    // genuinely too little room the padding gives way rather than the column
    // overflowing, which is the right way round.
    const dRowH = Math.min(Math.max(rowInk + rowPad * 2, Math.min(H * 0.082, 76)),
                           (bottom - dy - repH2 - repGap - repRes) / details.length);
    details.forEach(([label, fin, disp, col], i) => {
      ctx.save(); ctx.translate(boardRowOff(i + 1, 'right'), 0);
      const lX = archL(dy + dRowH / 2), inkTop = dy + (dRowH - rowInk) / 2;
      ctx.textAlign = 'left';
      // the label's voice, borrowed verbatim from the replay chrome's stat row
      ctx.fillStyle = 'rgba(150,190,225,0.62)'; ctx.font = '600 ' + dLab + 'px Audiowide, system-ui';
      ctx.fillText(label, lX, inkTop + dLab, rEdge - lX);
      ctx.fillStyle = col || '#ffd24a'; ctx.font = '700 ' + dVal + 'px Audiowide, system-ui';
      ctx.fillText(disp, lX, inkTop + dLab + lvGap + dVal, rEdge - lX);
      // the hairline goes BETWEEN readings only. One under the last row would draw a
      // line directly above the Replay key, which already has an outline of its own.
      if (i < details.length - 1) {
        const ry2 = dy + dRowH;
        ctx.strokeStyle = 'rgba(140,200,255,0.20)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(archL(ry2), ry2 + 0.5); ctx.lineTo(rEdge, ry2 + 0.5); ctx.stroke();
      }
      ctx.restore();
      dy += dRowH;
    });
    dy += repGap;

    // Replay — the primary action: the standard dark card, but a GOLD outline
    // (+ faint gold glow) marks it as the button, in line with the rest of the UI
    const can = !!sel.trace_id, repY = dy, repX = archL(repY + repH2 / 2), cyR = repY + repH2 / 2;
    const rf = F(H * 0.032), tri = repH2 * 0.24, triX = repX + repH2 * 0.55;
    ctx.font = '800 ' + rf + 'px Audiowide, system-ui';
    const repW = Math.min(rEdge - repX, triX + tri + 16 + ctx.measureText('Replay').width + 20 - repX);
    ctx.save(); ctx.translate(boardRowOff(7, 'right'), 0);
    ctx.globalAlpha = can ? 1 : 0.4;
    techRect(repX, repY, repW, repH2, 8); ctx.fillStyle = 'rgba(8,18,36,0.82)'; ctx.fill();
    ctx.shadowColor = 'rgba(255,210,74,0.45)'; ctx.shadowBlur = (can && !lowFX) ? 12 : 0;
    ctx.strokeStyle = '#ffd24a'; ctx.lineWidth = 2.2; techRect(repX, repY, repW, repH2, 8); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffd24a'; // gold play triangle
    ctx.beginPath(); ctx.moveTo(triX - tri * 0.7, cyR - tri); ctx.lineTo(triX - tri * 0.7, cyR + tri); ctx.lineTo(triX + tri, cyR); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#f2f9ff'; ctx.textAlign = 'left'; ctx.fillText('Replay', triX + tri + 16, cyR + rf * 0.36);
    ctx.globalAlpha = 1;
    ctx.restore();
    if (can) menuButtons.push({ x: repX, y: repY, w: repW, h: repH2, boardReplaySel: sel });

    // ---- "report this" — a muted red link, deliberately the quietest thing here ----
    // It is not a card and not a key: reporting is a rare, sober act and giving it
    // a button's weight would put it in the same visual class as Replay, which is
    // the thing people are here to press. Hidden on my OWN rows — MY DATA is the
    // door for those, and self-reporting only ever confuses.
    if (sel.player_id !== meId) {
      const already = lbReported(sel.id);
      const ry = repY + repH2 + 12, rtx = archL(ry + fRep * 0.5) + 4;
      ctx.save(); ctx.translate(boardRowOff(7, 'right'), 0);
      ctx.font = '600 ' + fRep + 'px Audiowide, system-ui'; ctx.textAlign = 'left';
      const label = already ? 'reported' : 'report this';
      ctx.fillStyle = already ? 'rgba(150,170,190,0.55)' : 'rgba(214,104,104,0.78)';
      ctx.fillText(label, rtx, ry + fRep);
      const rtw = ctx.measureText(label).width;
      if (!already) { // a thin underline, so it reads as a link rather than a label
        ctx.strokeStyle = 'rgba(214,104,104,0.34)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(rtx, ry + fRep + 3.5); ctx.lineTo(rtx + rtw, ry + fRep + 3.5); ctx.stroke();
      }
      ctx.restore();
      // the tap target is padded well past the text — this is a small link on a
      // phone, and a miss here lands on nothing rather than on the wrong thing
      if (!already && sel.id) menuButtons.push({ x: rtx - 10, y: ry - 6, w: rtw + 20, h: fRep + 18, boardReport: sel });
    }
    // ---- the replay refusal, said where the button is. replayErr used to be set
    // and never drawn — a failed or refused replay looked like a dead button. It
    // rides the game clock and fades itself out; a new attempt clears it first.
    if (replayErr && time - replayErrAt < 4.5) {
      const ea = clamp(1 - (time - replayErrAt - 3.5) / 1, 0, 1);
      const ey = repY + repH2 + 12 + (sel.player_id !== meId ? fRep + 18 : 0);
      ctx.save(); ctx.translate(boardRowOff(7, 'right'), 0);
      ctx.globalAlpha = ea;
      ctx.font = '600 ' + fRep + 'px Audiowide, system-ui'; ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(255,180,90,0.85)';
      ctx.fillText(replayErr, archL(ey + fRep * 0.5), ey + fRep);
      ctx.restore();
    }
    ctx.restore(); // end right column
  }
  ctx.textAlign = 'left';
}
