'use strict';
// ---------- leaderboard identity of a run ----------
// boardKey names the leaderboard a run belongs to — one per campaign level, one per
// free-flow mode, and ONE PER WEEK for the ranked ladder. Qualification/tutorial
// runs are unranked → null.
//
// Each week is its own board rather than one 'weekly' board partitioned by a `day`
// column, and that is what makes the ladder work: the server's top-100 eviction and
// its ranking are already per-board, so a finished week keeps its own field
// untouched forever, and a new week arrives as a new board instead of displacing
// anyone. The week index is in the key, so nothing has to be passed alongside it.
function boardKey() {
  if (qual || levelIdx === -1 && !endless) return null;
  // an LANE ASSIST run flies an EASED lane — it can never file a score,
  // and saying so here covers every downstream path at once (capture, submit,
  // provisional rank, local bests)
  if (assist) return null;
  // A FINISHED WEEK IS UNRANKED, and saying so here rather than at the submit call
  // is what makes it airtight: every downstream path — the submit, the "you made the
  // top 50" name card, the rank lookup — already treats a null board as unranked, so
  // replaying last week for practice cannot file a score by any route.
  if (weekly) return weeklyLive() ? 'weekly:' + weeklyIdx : null;
  if (endless) return 'endless';
  return (CAMP ? CAMP.id : 'campaign') + ':' + levelIdx;
}
// A RANK LOOKUP COMING HOME. Split out of endLevel's callback so the staleness
// rule is a thing that can be stated and tested, rather than a condition buried
// in a promise. Two ways to be stale, and both have bitten: the player has left
// the report (state), or another run has ended since this call went out
// (serial) — which is how an assisted run, whose own score is unranked and
// unrecorded, was handed the previous run's high-score card.
function applyProvisional(bk, serial, r) {
  if (serial !== endSerial || state !== S.END) return;
  endProvisional = r;
  if (r && r.rank <= LB_SHOW) { nameEntry = { board: bk }; nameEntryDraft = identity.name || ''; }
}
// the week index out of a 'weekly:<n>' key, or null for any other board
const weekOfBoard = key => {
  const m = /^weekly:(-?\d+)$/.exec(String(key || ''));
  return m ? (m[1] | 0) : null;
};
// A run's own id — the board's ROW identity. Every finished run gets a fresh
// one, so a player can hold SEVERAL rows on a board (each a different record);
// a rename re-submit carries the SAME runId, so it renames that row instead of
// filing the run twice. sysRandom, not Math.random: weekly swaps in a seeded PRNG
// during the run and doesn't hand it back until the end of endLevel.
function newRunId() {
  return (globalThis.crypto && crypto.randomUUID) ? crypto.randomUUID()
    : 'r-' + Date.now().toString(36) + '-' + Math.floor(sysRandom() * 1e9).toString(36);
}
// captureRun snapshots everything a leaderboard submission needs. The `seed`
// pins the run to a reproducible stream (level index for campaigns, WEEK INDEX for
// the weekly ladder); endless is unseeded → `seed:null` and `verifiable:false`, so
// it can only ever be a trust board unless it's reseeded. mutators alter scoring,
// so they're recorded — a ranked board locks or filters on them. The input
// trace (phase 3) attaches here later as `run.trace` for replay verification.
function captureRun(win) {
  const mode = weekly ? 'weekly' : endless ? 'endless' : 'campaign';
  const active = Object.keys(mutators).filter(k => mutLive(k)); // what BIT, not what was toggled
  lastRun = {
    // ONE ROW PER PLAYER ON A WEEKLY BOARD. run_id is part of the row key, so a
    // fresh id per run is what lets a player hold several rows on a campaign board —
    // arcade-style, every record standing on its own. A week is far too long for
    // that: one strong player would fill the top 50 with their own attempts. The
    // empty run_id collapses all of a player's weekly runs onto a single row, and
    // submit_verified_run's upsert only moves that row on a genuine
    // (score, zaps, perfects) improvement — so more tries improve YOUR line and
    // nobody else's, which is the whole point of giving people a week.
    runId: weekly ? '' : newRunId(),
    board: boardKey(), mode, win,
    seed: weekly ? weeklyIdx : mode === 'campaign' ? levelIdx : null,
    campId: CAMP ? CAMP.id : null, levelIdx: mode === 'campaign' ? levelIdx : null,
    score, timeSec: Math.round(levelT * 1000) / 1000, maxCombo, comboSec: Math.round(maxComboSec * 10) / 10,
    integrity, misses, perfects, zaps,
    mutators: active, mutMul: mutMul(),
    verifiable: mode !== 'endless', // only seeded modes can be replay-checked
    playerId: lbUid(), playerName: displayName(),
    w: W, h: H, // viewport the run was played at — the verifier replays at the same geometry
    at: Date.now()
  };
  return lastRun;
}

// one fixed sim step with trace record/replay wired in — the primitive frame()
// loops during play AND the verifier loops to replay a run headless. Returns
// false only when a replay runs off the end of its trace.
function simStep() {
  if (tracePlay) {
    const fr = tracePlay.frames[tracePlay.i++];
    if (!fr) return false;      // trace exhausted
    nodes[0].angle = fr.a0; nodes[1].angle = fr.a1;
    padHold[0] = !!(fr.h & 1); padHold[1] = !!(fr.h & 2);
    if (fr.f) for (const i of fr.f) firePulse(i);
    update(SIM_DT);
    return true;
  }
  // RECORD only steps where the sim ACTUALLY ADVANCES. Capture this step's input
  // before update() (input drives the sim), then commit it only if levelT moved.
  // Frozen steps — the boot intro, briefing cards (S.INFO), pauses, the post-pause
  // 3-2-1 — leave levelT untouched; excluding them makes a run's trace a pure
  // function of (seed, input), independent of any UX pauses or first-encounter
  // briefings the player hit. The verifier replays with the intro skipped and
  // briefings suppressed, so it only ever produces advancing steps — both sides
  // then step the sim the same number of times.
  const rec = (traceRec && state === S.PLAY)
    ? { a0: nodes[0].angle, a1: nodes[1].angle, h: (padHold[0] ? 1 : 0) | (padHold[1] ? 2 : 0), f: traceFireQ.length ? traceFireQ.slice() : 0 }
    : null;
  const buf = traceRec;   // hold the array ref — endLevel's stopTrace() may null traceRec mid-update, yet this final advancing frame still belongs in the run
  const lt0 = levelT;
  update(SIM_DT);
  if (rec && levelT !== lt0) { buf.push(rec); traceFireQ.length = 0; } // committed → fires consumed
  return true;
}
// record and replay are mutually exclusive — one control scheme owns the sim
function startTrace() { traceRec = []; tracePlay = null; traceFireQ.length = 0; }
function stopTrace() { const f = traceRec; traceRec = null; return f; }
// the trace owns every angle from here on — drop any bearing the live run left
// pending, so nothing can tug a carriage the moment the viewer is closed again
function startReplay(frames) { tracePlay = { frames, i: 0 }; traceRec = null; for (const n of nodes) n.slew = null; }
function stopReplay() { tracePlay = null; }
// ---------- watch another player's run ----------
let replaying = false, replayMeta = null, replayPkg = null, replayReturnCamp = null;
let replayPaused = false, replaySpeed = 1, replaySeekTo = -1, replayScrub = null;
let replayEnded = false;  // trace ran out — HOLD on the last frame (play → restart) instead of exiting
let replayArc = null;     // the level progress arc's geometry, for scrub hit-testing
const REPLAY_SPEEDS = [0.25, 0.5, 1, 2, 4];
let replayCtrls = { back: null, pause: null, play: null, slow: null, fast: null };
// reseed the exact world a run was played in (canonical geometry → only needs
// mode/levelIdx/seed) and arm its trace. Switches to the run's CAMPAIGN so its
// level config matches. Used to launch AND to rewind on a scrub.
function reseedReplay(seeking) {
  const p = replayPkg;
  if (p.mode === 'weekly') startWeekly(p.seed);
  else {
    if (p.campId && (!CAMP || CAMP.id !== p.campId)) { const cp = CAMPAIGNS.find(c => c.id === p.campId); if (cp) installCampaign(cp); }
    startLevel(Number.isInteger(p.levelIdx) ? p.levelIdx : 0); // campaign: fixed per-level seed
  }
  // resetRun (inside the start call above) clears `replaying` on principle — this is
  // the one caller entitled to it, so it re-asserts. Order matters: after the start.
  replaying = true;
  introT = 999; introCd = 0;            // dive straight in — no boot ceremony
  if (seeking) { warpT = 0; fadeT = 0; } // a scrub rewind rebuilds from frame 0 — no fly-in each drag
  endDropT = -1; endWin = false;         // clear any finished-run drop from a prior pass
  state = S.PLAY;
  startReplay(p.frames);                // tracePlay on, recording off
}
let replayXfer = null;      // leaderboard<->player transition: { dir: 1 (to player) | -1 (to board), t }
const XFER_DUR = 0.82;
function launchReplay(pkg, meta, hold) {
  if (!pkg || !Array.isArray(pkg.frames) || !pkg.frames.length) return false;
  replayPkg = pkg;
  replayReturnCamp = CAMP ? CAMP.id : null; // restore the player's own campaign on exit
  replaying = true;                          // guard endLevel during the silent pre-run
  // PRE-RUN: play the whole trace once, MUTED, to capture the run's final stats
  // (the trace is already server-verified, so these numbers are trustworthy).
  simMuted = true;
  reseedReplay(true);
  let guard = pkg.frames.length + 4;
  while (tracePlay && tracePlay.i < pkg.frames.length && guard-- > 0) { if (!simStep()) break; }
  const fin = { score, zaps, misses, perfects, maxCombo, comboSec: maxComboSec };
  simMuted = false;
  // rewind to the top for the real, rendered playback
  replayPaused = false; replaySpeed = 1; replaySeekTo = -1; replayScrub = null; replayEnded = false;
  replayMeta = { name: (meta && meta.name) || 'RUNNER', mode: pkg.mode, levelIdx: pkg.levelIdx, final: fin, total: pkg.frames.length };
  reseedReplay();
  if (hold) replayPaused = true; // hold on frame 0 while the enter transition runs
  musicDuck = 1;
  sfxFade = sfxFadeTgt = 0; // silence the enter (incl. the muted stat pre-run's drone) — fades in when playback starts
  return true;
}
// advance + resolve the leaderboard<->player transition (called each frame)
function tickReplayXfer(dt) {
  if (!replayXfer) return;
  replayXfer.t += dt;
  if (replayXfer.t >= XFER_DUR) {
    const dir = replayXfer.dir; replayXfer = null;
    if (dir === 1) { replayPaused = false; sfxFadeTgt = 1; sfxFadeRate = 2.5; }  // enter done → the run plays, sound fades in over ~1s
    else exitReplay();                     // exit done → back to the board
  }
}
function exitReplay() {
  replaying = false; replayMeta = null; replayScrub = null; replayEnded = false;
  sfxFade = sfxFadeTgt = 1; // leaving the player — restore the sfx bus for the menu
  replayMusicVol = 1; musicRate = 1; // restore the music multiplier/rate for the menu take
  const rc = replayReturnCamp; replayPkg = null; replayReturnCamp = null;
  stopReplay(); stripSound(false, 0);
  Math.random = sysRandom;
  if (rc && (!CAMP || CAMP.id !== rc)) { const cp = CAMPAIGNS.find(c => c.id === rc); if (cp) installCampaign(cp); } // back to the player's campaign
  state = S.MENU; menuScreen = 'board'; // back to the leaderboard we launched from
}
function replayLevelName() {
  if (!replayMeta) return '';
  if (replayMeta.mode === 'weekly') return 'WEEK ' + weekLabel(replayMeta.seed | 0);
  if (replayMeta.mode === 'endless') return 'FREE FLOW';
  const ci = CAMP ? CAMPAIGNS.indexOf(CAMP) : -1; // reseed already switched CAMP to the run's campaign
  return 'CAMPAIGN ' + (ci + 1) + '   |   LEVEL ' + lvNum(levelNo(ci, replayMeta.levelIdx || 0));
}
// seek to an absolute frame. Forward is a cheap continue; backward rewinds to 0
// and fast-forwards (the sim is stateful — you can't jump without replaying).
function replayDoSeek(target) {
  if (!tracePlay) return;
  const n = tracePlay.frames.length;
  target = clamp(Math.round(target), 0, n - 2); // stop short of the endLevel frame
  if (target < tracePlay.i) reseedReplay(true);  // rewind → rebuild from the top (no fly-in)
  let guard = n + 4;
  while (tracePlay.i < target && guard-- > 0) { if (!simStep()) break; }
  simAcc = 0;
}
function replaySetSpeed(dir) {
  replaySpeed = REPLAY_SPEEDS[clamp(REPLAY_SPEEDS.indexOf(replaySpeed) + dir, 0, REPLAY_SPEEDS.length - 1)];
  sfx.tick();
}
// scrubbing rides the LEVEL PROGRESS ARC (the green arc drawn by drawHUD). The
// pointer angle around the bore maps to a fraction of the run.
function replayArcProg(px, py) {
  const A = replayArc; if (!A) return 0;
  let a = Math.atan2(py - A.cy, px - A.cx); if (a < 0) a += TAU;
  return clamp((a - A.a0) / (A.a1 - A.a0), 0, 1);
}
// a fresh grab must land ON the arc band (radius + angle); returns a fraction or null
function replayArcHit(px, py) {
  const A = replayArc; if (!A) return null;
  if (Math.abs(Math.hypot(px - A.cx, py - A.cy) - A.r) > A.bw * 2.4) return null;
  let a = Math.atan2(py - A.cy, px - A.cx); if (a < 0) a += TAU;
  if (a < A.a0 - 0.08 || a > A.a1 + 0.08) return null;
  return clamp((a - A.a0) / (A.a1 - A.a0), 0, 1);
}
function replaySeekFrac(frac) { replaySeekTo = clamp(frac, 0, 1) * (replayMeta.total - 1); }
// all replay chrome: transport cluster (top-left: back/pause/play + speed pill),
// the run's stat panel (right: live score + final summary), and the scrub bar
// with a draggable knob (bottom).
function drawReplayChrome() {
  if (!replayMeta) return;
  const f = replayMeta.final || {}, P = replayCtrls;
  ctx.save(); ctx.textAlign = 'left'; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const box = (r, fill, stroke) => {
    techRect(r.x, r.y, r.w, r.h, 9); ctx.fillStyle = fill || 'rgba(6,20,40,0.62)'; ctx.fill();
    ctx.strokeStyle = stroke || 'rgba(120,220,255,0.55)'; ctx.lineWidth = 1.4; techRect(r.x, r.y, r.w, r.h, 9); ctx.stroke();
  };
  const chev = (cx, cy, dir) => { ctx.beginPath(); ctx.moveTo(cx + dir * 3, cy - 5); ctx.lineTo(cx - dir * 3, cy); ctx.lineTo(cx + dir * 3, cy + 5); ctx.stroke(); };

  // ---- enter/exit transition: the play controls fly in from the LEFT, the run
  // info from the RIGHT, the bottom stats from the BOTTOM (reverse to leave) ----
  let ctrlOff = 0, infoOff = 0, statOff = 0;
  if (replayXfer) {
    if (replayXfer.dir === 1) { // enter — fly IN once the board has cleared
      const cq = clamp((replayXfer.t - 0.4) / 0.42, 0, 1), sq = clamp((replayXfer.t - 0.46) / 0.36, 0, 1);
      ctrlOff = -(1 - cq) * (1 - cq) * W * 0.5; infoOff = (1 - cq) * (1 - cq) * W * 0.5; statOff = (1 - sq) * (1 - sq) * H * 0.5;
    } else { // exit — fly OUT (stats leave first, then the side clusters)
      const cq = clamp((replayXfer.t - 0.1) / 0.34, 0, 1), sq = clamp(replayXfer.t / 0.32, 0, 1);
      ctrlOff = -cq * cq * W * 0.5; infoOff = cq * cq * W * 0.5; statOff = sq * sq * H * 0.5;
    }
  }

  ctx.save(); ctx.translate(ctrlOff, 0);
  // ---- LEFT row: BACK (red), PAUSE, PLAY ----
  // hug the corner — cap the notch inset so the cluster never floats in dead space
  const bs = 44, y0 = 10 + Math.min(SAFE.t, 10), x0 = 10 + Math.min(SAFE.l, 10);
  P.back = { x: x0, y: y0, w: bs, h: bs };
  box(P.back, 'rgba(60,16,20,0.74)', 'rgba(255,120,110,0.78)');
  ctx.strokeStyle = 'rgba(255,195,190,0.95)'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(P.back.x + 25, P.back.y + 13); ctx.lineTo(P.back.x + 15, P.back.y + 22); ctx.lineTo(P.back.x + 25, P.back.y + 31); ctx.stroke();
  P.pause = { x: x0 + bs + 16, y: y0, w: bs, h: bs };
  box(P.pause, replayPaused ? 'rgba(140,220,255,0.20)' : 'rgba(6,20,40,0.62)');
  ctx.fillStyle = 'rgba(220,245,255,0.95)'; ctx.fillRect(P.pause.x + 15, P.pause.y + 13, 5, 18); ctx.fillRect(P.pause.x + 24, P.pause.y + 13, 5, 18);
  P.play = { x: P.pause.x + bs + 8, y: y0, w: bs, h: bs };
  box(P.play, (replayEnded || !replayPaused) ? 'rgba(140,220,255,0.20)' : 'rgba(6,20,40,0.62)');
  const pcx = P.play.x + bs / 2, pcy = P.play.y + bs / 2;
  ctx.fillStyle = 'rgba(220,245,255,0.95)'; ctx.strokeStyle = 'rgba(220,245,255,0.95)';
  if (replayEnded) { // RESTART: ¾ circular arrow + a play triangle in the middle
    ctx.lineWidth = 2.4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(pcx, pcy, 10, Math.PI * 0.32, Math.PI * 1.95); ctx.stroke();
    const ea = Math.PI * 1.95, ex = pcx + Math.cos(ea) * 10, ey = pcy + Math.sin(ea) * 10;
    ctx.beginPath(); ctx.moveTo(ex - 6, ey - 1); ctx.lineTo(ex, ey - 5); ctx.lineTo(ex + 2, ey + 3); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(pcx - 3, pcy - 4); ctx.lineTo(pcx - 3, pcy + 4); ctx.lineTo(pcx + 4, pcy); ctx.closePath(); ctx.fill();
  } else { // PLAY triangle
    ctx.beginPath(); ctx.moveTo(pcx - 6, pcy - 9); ctx.lineTo(pcx - 6, pcy + 9); ctx.lineTo(pcx + 9, pcy); ctx.closePath(); ctx.fill();
  }

  // ---- LEFT row 2: speed control « x1 » as one joined pill ----
  const spy = y0 + bs + 12, pillX = x0, pillW = P.play.x + bs - x0, pillH = 38, seg = pillW / 3;
  box({ x: pillX, y: spy, w: pillW, h: pillH });
  ctx.strokeStyle = 'rgba(120,220,255,0.26)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(pillX + seg, spy + 7); ctx.lineTo(pillX + seg, spy + pillH - 7); ctx.moveTo(pillX + 2 * seg, spy + 7); ctx.lineTo(pillX + 2 * seg, spy + pillH - 7); ctx.stroke();
  P.slow = { x: pillX, y: spy, w: seg, h: pillH };
  P.fast = { x: pillX + 2 * seg, y: spy, w: seg, h: pillH };
  ctx.strokeStyle = 'rgba(220,245,255,0.95)'; ctx.lineWidth = 2.2;
  chev(pillX + seg * 0.5 - 5, spy + pillH / 2, 1); chev(pillX + seg * 0.5 + 3, spy + pillH / 2, 1);  // slower « (points left)
  chev(pillX + seg * 2.5 - 3, spy + pillH / 2, -1); chev(pillX + seg * 2.5 + 5, spy + pillH / 2, -1); // faster » (points right)
  ctx.fillStyle = replaySpeed !== 1 ? '#ffd24a' : '#eaf6ff'; ctx.font = '700 15px Audiowide, system-ui'; ctx.textAlign = 'center';
  ctx.fillText('x' + replaySpeed, pillX + seg * 1.5, spy + pillH / 2 + 5);
  ctx.restore(); // end left controls

  ctx.save(); ctx.translate(infoOff, 0);
  // ---- TOP-RIGHT: live SCORE, then Campaign|Level (small, clears the integrity arc), then Operator ----
  const xR = W - 16 - SAFE.r;
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.font = '600 10px Audiowide, system-ui';
  ctx.fillText('SCORE', xR, 22 + SAFE.t);
  ctx.fillStyle = '#ffd24a'; ctx.font = '700 22px Audiowide, system-ui';
  ctx.fillText(score.toLocaleString(), xR, 46 + SAFE.t);
  ctx.fillStyle = 'rgba(140,220,255,0.9)'; ctx.font = '700 10px Audiowide, system-ui'; // shrunk so it clears the data-integrity arc
  ctx.fillText(replayLevelName(), xR, 64 + SAFE.t);
  ctx.fillStyle = 'rgba(150,190,225,0.6)'; ctx.font = '600 10px Audiowide, system-ui';
  ctx.fillText('RUNNER', xR, 84 + SAFE.t);
  ctx.fillStyle = '#eaf6ff'; ctx.font = '700 15px Audiowide, system-ui';
  ctx.fillText(('' + replayMeta.name).toUpperCase().slice(0, 16), xR, 102 + SAFE.t);
  ctx.restore(); // end top-right run info

  ctx.save(); ctx.translate(0, statOff);
  // ---- BOTTOM LINE: the four run stats spread across the freed space below/beside the pads ----
  const lp = dialCenter('L'), rp = dialCenter('R');
  const by = Math.min(lp.y + lp.r + 20, H - SAFE.b - 20);   // a baseline just below the pads
  const threats = (f.zaps || 0) + (f.misses || 0);
  const pct = f.zaps ? Math.round((f.perfects || 0) / f.zaps * 100) : 0;
  const stat = (x, align, label, value, col) => {
    ctx.textAlign = align;
    ctx.fillStyle = 'rgba(150,190,225,0.62)'; ctx.font = '600 10px Audiowide, system-ui'; ctx.fillText(label, x, by - 5);
    ctx.fillStyle = col || '#eaf6ff'; ctx.font = '700 16px Audiowide, system-ui'; ctx.fillText(value, x, by + 15);
  };
  stat(14 + Math.min(SAFE.l, 14), 'left', 'TOTAL SCORE', (f.score || 0).toLocaleString(), '#ffd24a');   // far left
  stat(lp.x + lp.r - 8, 'left', 'MAX. COMBO', 'x' + (f.maxCombo || 0) + (f.comboSec ? ' (' + Math.round(f.comboSec) + 's)' : '')); // right of the left pad, nudged left to clear the ring
  stat(rp.x - rp.r - 18, 'right', 'HITS', (f.zaps || 0) + ' / ' + threats);                             // left of the right pad
  stat(xR, 'right', 'PERFECT', (f.perfects || 0) + ' (' + pct + '%)');                                  // far right
  ctx.textAlign = 'left';
  ctx.restore(); // end bottom stats
  // NB: the scrub bar is the LEVEL PROGRESS ARC itself (drawn + knobbed in drawHUD) —
  // no separate bottom bar.

  ctx.restore(); ctx.textAlign = 'left';
}
// canonical verification state: mark every first-encounter briefing as seen so
// no INFO card fires during the headless warm-up (the replay itself is already
// guarded by !tracePlay). Operates on the throwaway headless `progress`.
function markBriefingsSeen() {
  progress.wallBriefed = progress.stripBriefed = true; // the boss discs are gone; these two remain
}
// Put the sim in a canonical, save-state-independent baseline for verification:
// all mutators off + briefings seen. The verifier then re-applies the run's OWN
// mutators. Without this, a runtime's persisted localStorage (Deno/edge keep a
// real one) leaks mutators/flags into the replay and breaks reproducibility.
function resetCanonical() {
  for (const k in mutators) if (typeof mutators[k] === 'boolean') mutators[k] = false;
  markBriefingsSeen();
}
// the sim's geometry (geo()/travelTime, hence spawn timing) is a function of the
// viewport aspect ratio, so a run is only reproducible at the SAME W/H it was
// recorded at. captureRun records them; the verifier sets them before replaying.
// (headless, resize() never runs, so W/H would otherwise be 0 → geo() NaN.)
function setViewport(w, h) { W = w > 0 ? w : 800; H = h > 0 ? h : 450; }
// headless test hook: dismiss a briefing card (what a player tap does), so a
// faithful client-flow test can exercise the briefing → PLAY-only-trace path.
function dismissInfo() { if (state === S.INFO && !infoOutAt) infoOutAt = time; }

function endLevel(win) {
  const frames = stopTrace(); // close the recording started in resetRun
  // THE BORE EMPTIES WITH THE RUN. Belt-and-braces behind the spawn windows: a
  // win already requires enemies.length === 0, but anything else still in
  // transit — a drop nobody took, a clamp dead zone mid-feed — would ride out the
  // whole ceremony hanging in open space next to the destination. It goes here,
  // on the frame the run ends, under the victory flash. (Replays too: they play
  // the same finish.) A failed run keeps its traps — you are still in the lane.
  pickups = []; latches = []; pulseWaves = [];
  if (win) enemies = [];
  // watching a replay: the run reached its end. NO submit, NO progress writes,
  // and NO end screen — but DO play the finish beat (the victory clear-sweep +
  // sound) so the replay ends like the real level. The frame loop then holds on
  // the final frame (play button becomes restart); the viewer leaves via BACK.
  if (replaying) { endWin = win; endDropT = win ? 0 : -1; if (win) sfx.arrive(); else sfx.fail(); return; }
  // the END screen may offer RETRY DUEL when the fight itself is what ended us
  bossFailed = !win && !!boss && !endless && !qual && !tut;
  // a boss-test drill never files: its clock jump is invisible to the trace,
  // so no verifier on earth could reproduce it. A CONTINUED run never files
  // either — that is the continue's price, stated on the button that took it.
  if (boardKey() && !bossTestRun && !bossRetried) { captureRun(win); lastRun.trace = frames; lbSubmit(lastRun); } // capture, attach trace, submit (async, fire-and-forget)
  // did this score make the visible board (top 50)? If so, pop the 80s arcade
  // name-entry card on the END screen — every qualifying run, pre-filled with the
  // player's last handle so returning players can keep it or type something new.
  endProvisional = null; nameEntry = null; nameEntryDraft = '';
  const mySerial = ++endSerial;
  if (boardKey() && !qual && !bossTestRun && !bossRetried && score > 0) {
    const bk = boardKey();
    lbProvisional(bk, score, zaps, perfects).then(r => applyProvisional(bk, mySerial, r));
  }
  endDropT = win ? 0 : -1;            // victory: the lane drops out of warp
  stripSound(false, 0);
  endRunMusic();
  endWin = win; endT = 0; endFxStars = 0; endTickT = 0; nbHold = 0;
  nbFx = false; endKeysFx = false; endUnlocked = false;
  endStars = win && !endless && !qual && !assist ? (integrity >= 90 ? 3 : integrity >= 60 ? 2 : 1) : 0;
  // LANE ASSIST bookkeeping: a campaign lane counts consecutive losses in
  // this session; two invite the eased retry (the END screen reads the count).
  // ANY clear of the lane — assisted or not — resets it.
  if (!endless && !qual && levelIdx >= 0) {
    const lk = (CAMP ? CAMP.id : 'campaign') + ':' + levelIdx;
    if (win) delete laneFails[lk]; else laneFails[lk] = (laneFails[lk] || 0) + 1;
  }
  if (qual) {
    sfx.win();
  } else if (endless) {
    progress.best = Math.max(progress.best || 0, score);
    if (weekly) {
      Math.random = sysRandom;
      const wk = weeklyIdx;
      const D = progress.weekly || (progress.weekly = { last: 0, streak: 0, best: 0 });
      // consecutive WEEKS now, not days — and only the live week counts toward it,
      // so grinding old lanes for practice cannot inflate a streak
      if (weeklyLive() && D.last !== wk) D.streak = wk === D.last + 1 ? (D.streak || 0) + 1 : 1;
      if (weeklyLive()) D.last = wk;
      D.best = Math.max(D.best || 0, score);
    }
    saveState();
    sfx.fail();
  } else if (win) {
    // a CONTINUED win still completes — stars and the route are the point of
    // the continue — but the record book stays closed to it: no local best,
    // no NEW BEST badge, exactly as the RETRY DUEL button said.
    // an ASSISTED clear advances the ROUTE and nothing else: no stars, no
    // best, no NEW BEST. The eased lane is a different lane, and its numbers
    // don't belong in the record book (endStars is already 0 above).
    if (!assist) PROG.stars[levelIdx] = Math.max(PROG.stars[levelIdx], endStars);
    const nextUnlocked = Math.min(levelIdx + 2, LEVELS.length);
    endUnlocked = nextUnlocked > PROG.unlocked; // a NEW lane opened — the report's keys voice it
    PROG.unlocked = Math.max(PROG.unlocked, nextUnlocked);
    endNewBest = !assist && !bossRetried && score > (PROG.bests[levelIdx] || 0);
    if (!bossRetried && !assist) PROG.bests[levelIdx] = Math.max(PROG.bests[levelIdx] || 0, score);
    saveState();
    sfx.arrive();   // dropping out of warp, the sting rising through its tail
  } else { endNewBest = false; sfx.fail(); }
  Math.random = sysRandom; // run over — hand real randomness back to the END screen + menus
  state = S.END;
}
