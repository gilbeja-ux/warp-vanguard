'use strict';
// ---------- update ----------
function spawnBolt(x1, y1, x2, y2) {
  bolts.push({ x1, y1, x2, y2, life: ARCFX.zapT, max: ARCFX.zapT });
}
// How close the purge column gets before the teaching hold stops the world. Measured
// from the ring (hitZ), so it means the same thing at any lane speed: 0.50 lands the
// nearest trap at z ~0.73 against a hitZ of 0.25, roughly halving the gap the old
// one-second timer left. Lower it to let them bear down further.
const PULSE_HOLD_LEAD = 0.50;
const PULSE_HOLD_CAP = 4;   // backstop, for a pupil who zaps the column instead of waiting
// ---------- qualification curriculum ----------
const QUAL = [
  { card: 'move' },
  // the hazards ride WITH the early traps: intercept the reds, STEER CLEAR
  // of the killer and the wall — no dedicated stages, one flowing lesson
  { card: 'normal', queue: ['normal', 'normal', 'wall'] },
  // THE VOLLEY RIDES THE ARMOR STAGE. It is not a topic of its own: docking both
  // emitters IS the armor's answer, and the volley is that same dock held half a
  // second longer. Teaching it here costs no new stage and breaks no lane law —
  // the demand is unchanged, only the depth of it. It went untaught between
  // 4668d95 and this; the call on 2026-08-28 was to teach it after all, because a
  // bolt that DETONATES is not something a player finds by accident.
  { card: 'heavy',  queue: ['heavy', 'volley'] },
  { card: 'line',   queue: ['line'] },
  { card: 'lock',   queue: ['lock0', 'lock1'] },
  { card: 'pickup', queue: ['pickup'] },
  { card: 'strip',  queue: ['strip'] },        // the ride charges a pulse...
  { card: 'pulse',  queue: ['pulse'] },        // ...which this column spends
  { card: 'done' }
];
// EVERY DRILL IS SHOWN BEFORE IT IS ASKED FOR. One disc opens each lesson, and the
// disc DEMONSTRATES rather than describes: its upper three quarters run a live
// diorama of the ring playing the correct move on a loop, and only the bottom
// quarter carries words (drawDiscDemo, 91-briefing).
//
// The banners this replaces were text stacked over the bore center — the one place
// the traffic arrives from — which is why they went in 6572c74. A disc is not that:
// it STOPS the lane, says its piece where nothing else is happening, and hands the
// run back. The riding labels and dock spots stay exactly as they are; they are the
// reminder, and the disc is the lesson.
const INFO_CARDS = {
  move:   { title: 'DUAL EMITTERS', lines: ['Left thumb — BLUE ⊕. Right — WHITE ⊖.', 'Slide the dials to ride the ring.'] },
  normal: { title: 'INTERDICTOR', lines: ['Align ANY emitter as it crosses.', 'Dead center pays ×2.'] },
  heavy:  { title: 'ARMORED INTERDICTOR', lines: ['Dock BOTH emitters together', 'to collapse it.'] },
  volley: { title: 'UNITE VOLLEY', lines: ['Dock both and HOLD — a bolt fires.', 'It detonates on what it hits.'] },
  line:   { title: 'BARRIER NET', lines: ['Cover BOTH ends —', 'one emitter on each.'] },
  lock:   { title: 'PHASE-LOCKED', lines: ['Only the MATCHING phase', 'collapses it.'] },
  pickup: { title: 'POWER-UP', lines: ['Golden relays arm powers.', 'Catch one with any emitter.'] },
  strip:  { title: 'BONUS RIBBON', lines: ['Optional: ride its crossing point.', 'A full ride banks a full PULSE.'] },
  wall:   { title: 'DEAD ZONE', lines: ['It seizes part of your rail.', 'Crossing FRIES — go around.'] },
  // NOT SHOWN. 'done' has no disc — advanceQual returns before any card and the QUALIFIED
  // stamp is drawn in-world by drawQualCeremony, which owns this wording. Kept in step with
  // it on purpose: a second copy of user-facing copy is a trap, and this one already caught
  // me editing the wrong string once.
  done:   { title: 'QUALIFIED', lines: ['Certification: PASSED. Cleared for warp.', 'Report to Meridian Haulage — your', 'first contract begins at relay 01.'] },
  // A FALLBACK ONLY — every package supplies its own (INFO_CARDS.verdict = CAMP.verdict in
  // 33-loader), so this shows for a package that forgot one. It used to carry the retired
  // investigation's epilogue, which would have been a story from another game.
  verdict: { title: 'CONTRACT — CLOSED', line: 'Delivered. The contract closes.',
    lines: ['Delivered. The contract closes.'] },
  pulse:  { title: 'PULSE CHARGE', lines: ['Zaps bank charge in your pads.', 'A glowing orb: TAP to fire.'] }
};
// ---------- the contracts ----------
// campaign narrative lives in the campaign package (src/campaigns.js):
// story briefings show on deploy, comm chatter ticks mid-run at scripted
// times (deterministic levels keep them in sync). Case notes are still authored
// per level but no longer drawn on the mission report.
// installCampaign() has already filled STORY/COMMS by the time
// they're read; story cards register into INFO_CARDS here, once it exists.
infoCardsReady = true;
lintReady = true;
registerStoryCards();

let infoOutAt = 0; // briefing dismissal animates out before play resumes
// H-07 · THE PRE-WARP READ GATE. On a BRIEFED deploy the disc's story line fades
// in first; the pads stay HIDDEN until it finishes, then fade in on a diagonal
// slide from their lower outboard corners. The grip-release and the demo ghosts
// both wait until the pads have landed, so a player who grips instantly still
// reads the line. An unbriefed parked start (retry, endless, weekly) shows no disc
// and no line, so padsRevealT() returns 1 there and none of this applies.
let infoReadDur = 1.2;    // seconds the shown disc's line needs to fully reveal (set in showCard)
const PADS_IN_DUR = 0.5;  // the pads' diagonal fade-in, after the line lands
function padsRevealT() {  // 0 → 1: hidden while the line reveals, then the pad fly-in
  if (!(state === S.INFO && preLaunch())) return 1; // not a briefed pre-warp disc → pads simply present
  return clamp((time - infoShownAt - infoReadDur) / PADS_IN_DUR, 0, 1);
}
const padsLanded = () => padsRevealT() >= 1;
function showCard(key) {
  // A REPLAY NEVER PARKS ON A DISC. A card sets S.INFO, and S.INFO stops the sim —
  // but simStep() consumes one TRACE frame per call whatever the state, so a card
  // raised over a replay burns the run's remaining input against a world that has
  // stopped moving. Everything after it plays out of step. The boss VERDICT is the
  // one card a replay can reach (the two first-encounter discs are one-shot and the
  // story discs only open a live deploy), and it lands on the last frames of a won
  // boss lane — so the viewer simply holds its finish instead. This also keeps a
  // watched run from burning the WATCHER's own first-encounter briefings below.
  if (tracePlay) return;
  if (key === 'strip' && !progress.stripBriefed) { progress.stripBriefed = true; saveState(); }
  if (key === 'wall' && !progress.wallBriefed) { progress.wallBriefed = true; saveState(); }
  infoOutAt = 0;
  infoCard = key; infoShownAt = time;
  // measure how long THIS disc's line takes to fully fade in (LINE_* are in 91),
  // so the pads wait exactly that long and no longer. Mirrors drawStoryDisc's body.
  const cd = INFO_CARDS[key];
  const body = cd ? (cd.line || (cd.lines || []).join(' ')) : '';
  infoReadDur = LINE_LEAD + (body.length + 1) * LINE_STAGGER + LINE_FADE;
  state = S.INFO;
  sfx.tick();
}
// ---------- one disc per lesson ----------
// Which disc opens which drill. Both colour locks share PHASE-LOCKED, because the
// lesson is the same one twice; every other drill has its own. `move` has no spawn
// of its own, so updateTutorial fires that one by hand.
const QUAL_DISC = {
  move: 'move', normal: 'normal', wall: 'wall', heavy: 'heavy', volley: 'volley',
  line: 'line', lock0: 'lock', lock1: 'lock', pickup: 'pickup', strip: 'strip', pulse: 'pulse'
};
// ONCE PER COURSE, NEVER ON A REPEAT. `tut.seen` lives on the tut object, so a fresh
// qualification is a fresh pupil and a failed drill's do-over never re-shows its disc.
// Returns true when the disc took the frame — the caller must then do nothing else.
function qualDisc(kind) {
  const key = QUAL_DISC[kind];
  if (!key || !tut || tut.seen[key]) return false;
  tut.seen[key] = 1;
  showCard(key);
  return true;
}
// SHOW, THEN SPAWN. The disc parks the run in S.INFO; the pending kind spawns on the
// first tutorial step after it lifts, so the hazard is never already inbound behind
// the words describing it.
function qualNext(kind) {
  if (qualDisc(kind)) { tut.pending = kind; return; }
  qualSpawn(kind);
}
function qualSpawn(kind) {
  tut.spawned = kind;
  if (kind === 'pickup') {
    pickups.push({ kind: 'wide', z: SPAWN_Z, angle: Math.random() * TAU, spin: 0, done: false, tut: true });
    return;
  }
  if (kind === 'strip') {
    const en2 = spawnStrip();
    en2.tut = 'strip';
    en2.len = 0.5; en2.amp = 0.22; en2.frq = 2.2; en2.ph = 0;
    return;
  }
  if (kind === 'pulse') {
    // several traps at once — spend the pulse the RIDE just charged
    // (safety top-up only if the ribbon somehow didn't bank one)
    if (pulseCharge[0] < PULSE_MAX && pulseCharge[1] < PULSE_MAX) pulseCharge[0] = PULSE_MAX;
    // CLEAR OF BOTH EMITTERS. These used to land at Math.random() * TAU, which meant a
    // trap could materialise directly on a parked carriage and die for free — the pupil
    // is then shown a purge wave clearing three traps instead of four, and the drill
    // teaches slightly the wrong thing. It also made the test assert a count that
    // depended on where the thumbs happened to be resting: one failure in four runs.
    // Same reachability discipline the wall drill and the linter already use.
    let pa = nodes[0].angle + Math.PI;
    for (let k = 0; k < 4; k++) {
      for (let h = 0; h < 8; h++) { // nudge off a carriage, then off a wall
        const onNode = nodes.some(n => Math.abs(angDiff(n.angle, pa)) < 0.45);
        if (!onNode) break;
        pa += 0.5;
      }
      pa = clearOfWalls(pa);
      const e3 = spawnEnemy(pa, 'normal');
      e3.lock = undefined; e3.tut = 'pulse';
      e3.z = SPAWN_Z - 0.05 - k * 0.22; // staggered inside the purge wave's reach
      pa += 2.399963; // golden hop, so the four are never bunched
    }
    return;
  }
  if (kind === 'volley') {
    // THE DOCK, HELD. One armored tap with a plain red either side of it, all three
    // on the same lane and all three slowed, so there is room to dock, hold half a
    // second and watch the bolt take the trio. The offsets sit inside the blast's
    // angular semi-axis (VOLLEY_BLAST_A, 72-tick) and share the armor's depth, so a
    // hit on the armor reaches both neighbours — that is the whole lesson.
    //
    // CLEAR OF BOTH CARRIAGES, like the purge column: a trap that materialises on a
    // parked emitter dies for free and demonstrates nothing.
    let va = nodes[0].angle + Math.PI;
    for (let h = 0; h < 8; h++) {
      if (!nodes.some(n => Math.abs(angDiff(n.angle, va)) < 0.7)) break;
      va += 0.5;
    }
    va = clearOfWalls(va);
    for (const [da, ty] of [[0, 'heavy'], [-0.5, 'normal'], [0.5, 'normal']]) {
      const ev = spawnEnemy(va + da, ty);
      ev.lock = undefined; ev.tut = 'volley';
      ev.z = SPAWN_Z; ev.speedMul = 0.55; // the long approach is the room to hold
    }
    return;
  }
  if (kind === 'wall') {
    // a practice clamp lands ahead — steer clear, or eat the fry and retry
    latches.length = 0;
    const away = nodes[0].angle + Math.PI * (Math.random() < 0.5 ? 0.55 : -0.55);
    latches.push({ a: away, span0: 0.5, t: 0, dur: 3.2, tele: 2.0, arm: 0.4, z0: 1.3 });
    sfx.latchWarn();
    return;
  }
  if (kind === 'line') {
    const a = Math.random() * TAU, gap = rand(0.9, 1.3);
    const e1 = spawnEnemy(a, 'line'), e2 = spawnEnemy(a + gap, 'line');
    e1.partner = e2; e2.partner = e1; e1.lineLead = true;
    e1.tut = e2.tut = 'line';
    return;
  }
  let en;
  if (kind === 'lock0' || kind === 'lock1') {
    en = spawnEnemy(undefined, 'normal');
    en.lock = kind === 'lock0' ? 0 : 1;
  } else en = spawnEnemy(undefined, kind); // normal | heavy
  en.tut = kind;
}
function advanceQual() {
  tut.stage++;
  tut.t = 0;
  tut.again = null; // a fresh drill speaks in the present tense
  if (tut.stage >= QUAL.length) { // safety — 'done' normally ends it with air
    progress.tutorialDone = true;
    saveState();
    tut = null;
    endLevel(true);
    return;
  }
  const c = QUAL[tut.stage].card;
  if (c === 'done') { // no info disc — a QUALIFIED ceremony plays in-world
    tut.queue = [];
    // rising clearance chord: the line accepts its defender
    sfx.qualified();
    buzz([30, 40, 90]);
    return;
  }
  // free flow: no disc stop — the hazard itself announces the drill, labelled
  tut.queue = (QUAL[tut.stage].queue || []).slice();
  sfx.tick();
  // pre-spawned drills: the hazard is already inbound as the stage opens
  if (c === 'pulse') { tut.queue = []; qualNext(c); }
}
const AIM_HOLD = 0.3; // seconds a node must sit on a target to lock it in
function updateTutorial(dt) {
  // the drill a disc was holding back, released on the first step after it lifted
  if (tut.pending) { const k = tut.pending; tut.pending = null; qualSpawn(k); return; }
  tut.t += dt;
  const st = QUAL[tut.stage];
  if (st.card === 'move') {
    // the control check has no hazard to gate on, so its disc is fired by hand.
    // updateTutorial runs only outside the boot intro, so this lands the moment the
    // warp-in settles and the pads are already the player's.
    if (qualDisc('move')) return;
    // land each lit target's assigned node inside the zap window, and HOLD;
    // the final rep lights both at once (both must be covered together)
    const A = tut.aim, TOLm = ARCFX.span * tolVis;
    if (!A.targets) A.targets = A.reps[A.idx].map(t => ({ node: t.node, a: t.a !== undefined ? t.a : nodes[t.node].angle + t.off }));
    const covered = t => nodes[t.node].deadT <= 0 && Math.abs(angDiff(nodes[t.node].angle, t.a)) < TOLm;
    A.hold = A.targets.every(covered) ? A.hold + dt : 0;
    if (A.hold >= AIM_HOLD) {
      A.idx++; A.targets = null; A.hold = 0;
      sfx.drillLock(); buzz(12); // lock-in confirm
      if (A.idx >= A.reps.length) advanceQual();
    }
    return;
  }
  if (st.card === 'done') {
    // the QUALIFIED ceremony runs its course, then the report — no hard cut
    if (tut.t > 3.4) {
      progress.tutorialDone = true;
      saveState();
      tut = null;
      endLevel(true);
    }
    return;
  }
  if (st.card === 'pulse' && !tut.fired) {
    // the teaching hold: the tunnel freezes and the music winds down to a stop —
    // TAP TO FIRE points at the charged pad. firePulse() releases the hold and the
    // wave clears the lane.
    // Gated on PROXIMITY, not a stopwatch. It used to fire one second in, which
    // froze the volley at z ~ 1.65 — four distant dots, no drama, and the purge
    // wave's whole point is clearing a crowd that is nearly on top of you. Now the
    // column bears down to just outside the ring before the world stops. The time
    // cap is a backstop for the pupil who zaps the column instead of waiting.
    const pulseNear = enemies.reduce((m, e) =>
      e.tut === 'pulse' && !e.dead && !e.resolved && e.z < m ? e.z : m, 99);
    if (!tut.frozen && (pulseNear <= geo().hitZ + PULSE_HOLD_LEAD || tut.t >= PULSE_HOLD_CAP)) {
      tut.frozen = true;
      // the hold must always be releasable: guarantee a tappable charged pad
      if (!(pulseCharge[0] >= PULSE_MAX && nodes[0].deadT <= 0)
        && !(pulseCharge[1] >= PULSE_MAX && nodes[1].deadT <= 0)) {
        pulseCharge[nodes[0].deadT <= 0 ? 0 : 1] = PULSE_MAX;
      }
      sfx.tutFreeze(); // tape-warp down: the run holds its breath
      buzz([15, 40, 25]);
    }
    return;
  }
  if (tut.spawned === 'wall') { // steer clear of the practice clamp
    if (nodes.some(n => n.deadT > 0) && !tut.retry) {
      // clipped it — the fry STANDS (reboot and all); the drill repeats
      // once the clamp burns off
      tut.retry = 'wall'; tut.t = 0;
    }
    if (latches.length) return; // still burning — hold the stage
    if (!tut.wallDone && !tut.retry) { // the clamp burned off untouched
      tut.wallDone = true;
      popup(W / 2, H * 0.35, 'ROUTED AROUND', '#7ee262');
    }
  }
  const live = enemies.some(e => !e.dead && !e.resolved) || pickups.some(p => !p.done) || latches.length > 0;
  if (tut.retry && !live && tut.t > 0.9) { // practice failed — same drill again
    const k = tut.retry; tut.retry = null; tut.t = 0;
    tut.again = k; // the label acknowledges the do-over
    qualSpawn(k);
    return;
  }
  if (!live && !tut.retry) {
    if (tut.queue.length) { if (tut.t > 0.7) { tut.t = 0; qualNext(tut.queue.shift()); } }
    else if (tut.t > 0.8) advanceQual();
  }
}