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
  replayLoading = r.trace_id; sfx.tick();
  lbTrace(r.trace_id).then(pkg => {
    if (replayLoading !== r.trace_id) return;
    replayLoading = null;
    if (!pkg) { replayErr = 'REPLAY UNAVAILABLE'; return; }
    // launch PAUSED on frame 0, then run the enter transition (board flies out /
    // zooms into the ring, the player's chrome flies in)
    if (launchReplay(pkg, { name: r.player_name, score: r.score, mode: boardSel.mode }, true)) replayXfer = { dir: 1, t: 0 };
  });
}
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
  const fLab = F(H * 0.024), fVal = F(H * 0.026), fName = F(H * 0.030);
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
  const bk = menuBackRect = { x: W - 50 - SAFE.r, y: 12 + SAFE.t, w: 38, h: 38 };
  ctx.save(); ctx.globalAlpha = backA;
  techRect(bk.x, bk.y, bk.w, bk.h, 8);
  ctx.fillStyle = 'rgba(6,20,40,0.6)'; ctx.fill();
  ctx.strokeStyle = 'rgba(120,220,255,0.55)'; ctx.lineWidth = 1.5;
  techRect(bk.x, bk.y, bk.w, bk.h, 8); ctx.stroke();
  ctx.strokeStyle = 'rgba(200,240,255,0.9)'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(bk.x + 24, bk.y + 11); ctx.lineTo(bk.x + 14, bk.y + 19); ctx.lineTo(bk.x + 24, bk.y + 27);
  ctx.stroke();
  ctx.restore();

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
          // level index rides the gutter LEFT of the card, right-aligned into a
          // scannable column — kept out of the card so the name's width is untouched
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
  // "Show my Run" baseline: inside the ring's inner edge, but never off-screen
  // (the disc may overflow the bottom edge slightly, like the mock)
  const showBase = Math.min(cy + R - bz * 0.9, H - SAFE.b) - H * 0.042;
  const capBotY = showBase - fShow - H * 0.022; // the bottom cap's chord edge (exists only with my run)
  if (!boardSel.mode) { // nothing picked yet — the prompt, centered in the ring
    ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(185,218,246,0.82)'; ctx.font = '700 ' + Math.round(fRow * 0.9) + 'px Audiowide, system-ui';
    ['CHOOSE A LEVEL', 'TO SEE', 'LEADING SCORES'].forEach((w, i) => ctx.fillText(w, cx, cy + (i - 1) * fRow * 1.45));
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
  // bottom cap: a smaller segment carrying Show my Run — only when I'm on this board
  if (mine) {
    capSeg(capBotY, cy + R);
    ctx.font = '700 ' + fShow + 'px Audiowide, system-ui';
    const tw = ctx.measureText('Show my Run').width;
    ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(90,190,255,0.95)';
    ctx.fillText('Show my Run', cx, showBase);
    menuButtons.push({ x: cx - tw / 2 - 14, y: capBotY, w: tw + 28, h: cy + R - capBotY, boardShowMe: mine.rank });
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
      const nameW = Math.min(Math.min(bk.x - 12, rEdge) - lX, ctx.measureText(nm).width + 36); // shrink to fit the name
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
    ];
    // vertical budget: name + 5 detail cards + the Replay button (same height as a
    // detail card) must all fit above the screen bottom
    const bottom = H - SAFE.b - H * 0.025;
    const dCardH = Math.min(Math.min(H * 0.092, 76), (bottom - dy - 6 * cardGap) / 6);
    details.forEach(([label, fin, disp], i) => {
      ctx.save(); ctx.translate(boardRowOff(i + 1, 'right'), 0);
      const lX = archL(dy + dCardH / 2);
      ctx.font = '700 ' + fVal + 'px Audiowide, system-ui'; const wV = ctx.measureText(fin).width;
      ctx.font = '600 ' + fLab + 'px Audiowide, system-ui'; const wL = ctx.measureText(label).width;
      const cw = Math.min(rEdge - lX, Math.max(wV, wL) + 36); // content-fit
      card(lX, dy, cw, dCardH, false);
      ctx.textAlign = 'left'; ctx.fillStyle = 'rgba(232,245,255,0.94)'; ctx.font = '600 ' + fLab + 'px Audiowide, system-ui';
      ctx.fillText(label, lX + 16, dy + dCardH * 0.40);
      ctx.fillStyle = '#ffd24a'; ctx.font = '700 ' + fVal + 'px Audiowide, system-ui';
      ctx.fillText(disp, lX + 16, dy + dCardH * 0.82, cw - 32);
      ctx.restore();
      dy += dCardH + cardGap;
    });

    // Replay — the primary action: the standard dark card, but a GOLD outline
    // (+ faint gold glow) marks it as the button, in line with the rest of the UI
    const can = !!sel.trace_id, repH2 = dCardH, repY = dy, repX = archL(repY + repH2 / 2), cyR = repY + repH2 / 2;
    const rf = F(H * 0.032), tri = repH2 * 0.24, triX = repX + repH2 * 0.55;
    ctx.font = '800 ' + rf + 'px Audiowide, system-ui';
    const repW = Math.min(rEdge - repX, triX + tri + 16 + ctx.measureText('Replay').width + 20 - repX);
    ctx.save(); ctx.translate(boardRowOff(6, 'right'), 0);
    ctx.globalAlpha = can ? 1 : 0.4;
    techRect(repX, repY, repW, repH2, 8); ctx.fillStyle = 'rgba(8,18,36,0.82)'; ctx.fill();
    ctx.shadowColor = 'rgba(255,210,74,0.45)'; ctx.shadowBlur = can ? 12 : 0;
    ctx.strokeStyle = '#ffd24a'; ctx.lineWidth = 2.2; techRect(repX, repY, repW, repH2, 8); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffd24a'; // gold play triangle
    ctx.beginPath(); ctx.moveTo(triX - tri * 0.7, cyR - tri); ctx.lineTo(triX - tri * 0.7, cyR + tri); ctx.lineTo(triX + tri, cyR); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#f2f9ff'; ctx.textAlign = 'left'; ctx.fillText('Replay', triX + tri + 16, cyR + rf * 0.36);
    ctx.globalAlpha = 1;
    ctx.restore();
    if (can) menuButtons.push({ x: repX, y: repY, w: repW, h: repH2, boardReplaySel: sel });
    ctx.restore(); // end right column
  }
  ctx.textAlign = 'left';
}
