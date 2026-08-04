'use strict';
// ---------- update ----------
function spawnBolt(x1, y1, x2, y2) {
  bolts.push({ x1, y1, x2, y2, life: ARCFX.zapT, max: ARCFX.zapT });
}
// ---------- qualification curriculum ----------
const QUAL = [
  { card: 'move' },
  // the hazards ride WITH the early traps: intercept the reds, STEER CLEAR
  // of the killer and the wall — no dedicated stages, one flowing lesson
  { card: 'normal', queue: ['normal', 'frag', 'normal', 'wall'] },
  { card: 'heavy',  queue: ['heavy'] },
  { card: 'line',   queue: ['line'] },
  { card: 'lock',   queue: ['lock0', 'lock1'] },
  { card: 'volley' },                          // a red column, one charged shot
  { card: 'pickup', queue: ['pickup'] },
  { card: 'strip',  queue: ['strip'] },        // the ride charges a pulse...
  { card: 'pulse',  queue: ['pulse'] },        // ...which this volley spends
  { card: 'done' }
];
// the tutorial never stops the run: the arrows, dock spots and riding labels do
// ALL the teaching. (The per-stage banners are gone — they stacked text over the
// bore center, which is exactly where the traffic arrives from.)
const INFO_CARDS = {
  move:   { title: 'DUAL EMITTERS', lines: ['Left thumb — BLUE ⊕. Right — WHITE ⊖.', 'Slide the dials to ride the ring.'] },
  normal: { title: 'INTERDICTOR', lines: ['Align ANY emitter as it crosses.', 'Dead center pays ×2.'] },
  heavy:  { title: 'ARMORED INTERDICTOR', lines: ['Dock BOTH emitters together', 'to collapse it.'] },
  line:   { title: 'BARRIER NET', lines: ['Cover BOTH ends —', 'one emitter on each.'] },
  lock:   { title: 'PHASE-LOCKED', lines: ['Only the MATCHING phase', 'collapses it.'] },
  frag:   { title: 'EMITTER KILLER', lines: ['It INVERTS the emitter that', 'strikes it. Let it pass.'] },
  pickup: { title: 'POWER-UP', lines: ['Golden relays arm powers.', 'Catch one with any emitter.'] },
  strip:  { title: 'BONUS RIBBON', lines: ['Optional: ride its crossing point.', 'A full ride banks a full PULSE.'] },
  wall:   { title: 'RIM WALL', lines: ['It seizes part of your rail.', 'Crossing FRIES — go around.'] },
  // NOT SHOWN. 'done' has no disc — advanceQual returns before any card and the QUALIFIED
  // stamp is drawn in-world by drawQualCeremony, which owns this wording. Kept in step with
  // it on purpose: a second copy of user-facing copy is a trap, and this one already caught
  // me editing the wrong string once.
  done:   { title: 'QUALIFIED', lines: ['Certification: PASSED. Cleared for warp.', 'Report to Meridian Haulage — the', 'investigation begins at relay 01.'] },
  verdict: { title: 'LOG 09 — VERDICT', lines: ['The gateway burned. The convoy', 'reached Lane Command intact. Warrants', 'went out within the hour — the', 'buyer wore a badge. Case closed.'] },
  pulse:  { title: 'PULSE CHARGE', lines: ['Zaps bank charge in your pads.', 'A glowing orb: TAP to fire.'] },
  boss:   { title: 'WARDEN CORE', lines: ['The dials stay YOURS. Dock both', 'emitters and HOLD — the bolt homes', 'on the core. SIX hits close the case.', 'Dodge darts. Mind the latches.'] },
  bossTriad: { title: 'PRIVATE WARDEN ×3', lines: ['One machine in three bodies. The', 'bolt hunts the body you AIM at —', 'three bolts each. The walls come', 'fast: dock in the gaps, then fire.'] },
  bossSpinner: { title: 'THE BEACON', lines: ['Bolts fizzle on its shield. Its', 'sweeping light FRIES a caught', 'emitter — outrun it with both. Each', 'survived sweep overloads it once.'] }
};
// ---------- the investigation ----------
// campaign narrative lives in the campaign package (src/campaigns.js):
// story briefings show on deploy, comm chatter ticks mid-run at scripted
// times (deterministic levels keep them in sync). Case notes are still authored
// per level but no longer drawn on the mission report.
// installCampaign() has already filled STORY/COMMS/CASE_NOTES by the time
// they're read; story cards register into INFO_CARDS here, once it exists.
infoCardsReady = true;
lintReady = true;
registerStoryCards();

let typeN = -1; // teletype progress for story cards
let infoOutAt = 0; // briefing dismissal animates out before play resumes
function showCard(key) {
  if (key === 'strip' && !progress.stripBriefed) { progress.stripBriefed = true; saveState(); }
  if (key === 'wall' && !progress.wallBriefed) { progress.wallBriefed = true; saveState(); }
  typeN = -1;
  infoOutAt = 0;
  infoCard = key; infoShownAt = time;
  state = S.INFO;
  sfx.tick();
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
    for (let k = 0; k < 4; k++) {
      const e3 = spawnEnemy(Math.random() * TAU, 'normal');
      e3.lock = undefined; e3.tut = 'pulse';
      e3.z = SPAWN_Z - 0.05 - k * 0.22; // staggered inside the purge wave's reach
    }
    return;
  }
  if (kind === 'wall') {
    // a practice clamp lands ahead — steer clear, or eat the fry and retry
    latches.length = 0;
    const away = nodes[0].angle + Math.PI * (Math.random() < 0.5 ? 0.55 : -0.55);
    latches.push({ a: away, span0: 0.5, t: 0, dur: 3.2, tele: 2.0, arm: 0.4, z0: 1.3 });
    tone(1180, 0.02, 'square', 0.05); tone(1180, 0.02, 'square', 0.05, null, null, 0.22);
    return;
  }
  if (kind === 'volley') {
    // a COLUMN of reds — one lane, nose to tail down the tunnel. Dock both
    // nodes on the lane and the charged shot clears the lot: fire and forget.
    const a = Math.random() * TAU;
    for (let k = 0; k < 4; k++) {
      const e4 = spawnEnemy(a, 'normal');
      e4.lock = undefined; e4.tut = 'volley'; e4.drift = 0;
      e4.z = SPAWN_Z - 0.05 + k * 0.24; // deeper mates emerge as the column advances
    }
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
  } else en = spawnEnemy(undefined, kind); // normal | heavy | frag
  en.tut = kind;
  en.drift = 0;
  // killers are pure dodge drills — the DANGER! AVOID! label states the
  // consequence instead of making the pupil feel the fry
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
    tone(330, 0.5, 'sine', 0.10);
    tone(415, 0.5, 'sine', 0.09, null, null, 0.14);
    tone(494, 0.6, 'sine', 0.09, null, null, 0.28);
    tone(659, 1.1, 'sine', 0.08, null, null, 0.42);
    buzz([30, 40, 90]);
    return;
  }
  // free flow: no disc stop — the hazard itself announces the drill, labelled
  tut.queue = (QUAL[tut.stage].queue || []).slice();
  sfx.tick();
  // pre-spawned drills: the hazard is already inbound as the stage opens
  if (c === 'volley' || c === 'pulse') { tut.queue = []; qualSpawn(c); }
}
const AIM_HOLD = 0.3; // seconds a node must sit on a target to lock it in
function updateTutorial(dt) {
  tut.t += dt;
  const st = QUAL[tut.stage];
  if (st.card === 'move') {
    // land each lit target's assigned node inside the zap window, and HOLD;
    // the final rep lights both at once (both must be covered together)
    const A = tut.aim, TOLm = ARCFX.span * tolVis;
    if (!A.targets) A.targets = A.reps[A.idx].map(t => ({ node: t.node, a: t.a !== undefined ? t.a : nodes[t.node].angle + t.off }));
    const covered = t => nodes[t.node].deadT <= 0 && Math.abs(angDiff(nodes[t.node].angle, t.a)) < TOLm;
    A.hold = A.targets.every(covered) ? A.hold + dt : 0;
    if (A.hold >= AIM_HOLD) {
      A.idx++; A.targets = null; A.hold = 0;
      tone(880, 0.12, 'sine', 0.08, 1320); buzz(12); // lock-in confirm
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
    // the teaching hold: a beat after the volley shows, the tunnel freezes
    // and the music winds down to a stop — TAP TO FIRE points at the charged
    // pad. firePulse() releases the hold and the wave clears the lane.
    if (!tut.frozen && tut.t >= 1) {
      tut.frozen = true;
      // the hold must always be releasable: guarantee a tappable charged pad
      if (!(pulseCharge[0] >= PULSE_MAX && nodes[0].deadT <= 0)
        && !(pulseCharge[1] >= PULSE_MAX && nodes[1].deadT <= 0)) {
        pulseCharge[nodes[0].deadT <= 0 ? 0 : 1] = PULSE_MAX;
      }
      tone(720, 0.9, 'sine', 0.10, 70); // tape-warp down: the run holds its breath
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
    if (tut.queue.length) { if (tut.t > 0.7) { tut.t = 0; qualSpawn(tut.queue.shift()); } }
    else if (tut.t > 0.8) advanceQual();
  }
}