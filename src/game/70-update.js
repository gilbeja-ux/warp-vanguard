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
// ---------- the licence trials ----------
// THE COURSE IS A SET OF SHORT TRIALS (Gil, 2026-10-08). The testers on 1.0.11 called
// the ten-disc qualification too long and too hard to follow, on iOS and Android alike:
// a perfect bot needed 68.7 s and ten disc stops to finish it, a person several minutes.
// Each trial now teaches ONE skill in fifteen to thirty seconds and pays a medal.
//
// THE FIRST RUN IS ONE COURSE, NOT CHAPTERS (Gil, same day, after testing the branch):
// every lesson, back to back in one lane, each one CALLED before it is asked for — no
// trial names, no medal stamps between them (COURSE below). The trials are the practice
// that comes after: each opens on the LICENCE TRIALS screen once the first contract
// reaches the stage where the skill starts to matter. `opens` is a stage NAME (1-based,
// as printed); 0 means always open.
//
// A trial's `stages` are the old curriculum's stage records, verbatim. The drill
// machinery below did not change shape; only the thing that strings stages together did.
// THE VOLLEY STILL RIDES THE ARMOR (2026-08-28): docking both emitters is the armor's
// answer, and the volley is the same dock held half a second longer.
const TRIALS = [
  { id: 'slide',     name: 'SLIDE',       opens: 0, medal: 'time', stages: [{ card: 'move' }] },
  { id: 'intercept', name: 'INTERCEPT',   opens: 0, stages: [{ card: 'normal', queue: ['normal', 'normal', 'normal'] }] },
  { id: 'pickup',    name: 'POWER-UP',    opens: 2, stages: [{ card: 'pickup', queue: ['pickup'] }] },
  { id: 'dock',      name: 'DOCK',        opens: 3, stages: [{ card: 'heavy', queue: ['heavy', 'volley'] }] },
  // the ride charges a pulse, which the column then spends
  { id: 'pulse',     name: 'PULSE',       opens: 4, stages: [{ card: 'strip', queue: ['strip'] }, { card: 'pulse' }] },
  { id: 'net',       name: 'BARRIER NET', opens: 5, stages: [{ card: 'line', queue: ['line', 'line'] }] },
  { id: 'wall',      name: 'DEAD ZONE',   opens: 6, stages: [{ card: 'wall', queue: ['wall'] }] },
  { id: 'phase',     name: 'PHASE LOCK',  opens: 7, stages: [{ card: 'lock', queue: ['lock0', 'lock1'] }] }
];
// THE FIRST-RUN COURSE: every lesson, in the order the lane can teach them — the
// controls, one-thumb interception, steering clear, the two-thumb rules, then the gold
// things — at the old curriculum's rep counts. The trials drill a skill harder (three
// reds, two nets); the course only has to show each one once it has been called.
const COURSE = { id: 'course', name: 'QUALIFICATION', opens: 0, stages: [
  { card: 'move' },
  { card: 'normal', queue: ['normal', 'normal', 'wall'] },
  { card: 'heavy',  queue: ['heavy', 'volley'] },
  { card: 'line',   queue: ['line'] },
  { card: 'lock',   queue: ['lock0', 'lock1'] },
  { card: 'pickup', queue: ['pickup'] },
  { card: 'strip',  queue: ['strip'] },
  { card: 'pulse' }
] };
const TRIAL_GOLD_S = 8;        // SLIDE is scored on drill time (the calls excluded)…
const TRIAL_SILVER_S = 14;     // …every other trial on misses: none is gold, one is silver
const MEDAL_NAMES = ['', 'BRONZE', 'SILVER', 'GOLD'];
const MEDAL_COLS = ['143,224,255', '214,140,82', '214,226,240', '255,210,74'];
const trialById = id => (id === COURSE.id ? COURSE : TRIALS.find(t => t.id === id) || null);
const trialStages = id => trialById(id).stages.map(s => Object.assign({}, s)).concat([{ card: 'done' }]);
// open once the first contract has unlocked the stage that `opens` names
function trialOpen(tr) {
  if (!tr.opens) return true;
  const c = progress.camp && progress.camp['cargo-run'];
  return !!(c && (c.unlocked || 1) >= tr.opens);
}
function trialMedal(t) { // 3 gold, 2 silver, 1 bronze, read off the finished tut
  if (t.medalBy === 'time') return t.work <= TRIAL_GOLD_S ? 3 : t.work <= TRIAL_SILVER_S ? 2 : 1;
  return t.misses === 0 ? 3 : t.misses === 1 ? 2 : 1;
}
// the stage record the live trial is on (what QUAL[tut.stage] used to be)
const tutStage = () => (tut ? tut.qual[tut.stage] : null);
// which trial is in the lane, kept past the end of the run for the report and RESTART
let trialRun = null; // { id, firstRun, medal, newBest }
function newTut(id, firstRun) {
  const tr = trialById(id), qual0 = trialStages(id);
  return {
    trial: id, firstRun: !!firstRun, qual: qual0,
    stage: 0, t: 0, queue: (qual0[0].queue || []).slice(), retry: null, spawned: null,
    called: {}, call: null,                        // CALL AND RESPONSE: see qualNext
    misses: 0, missCounted: false, work: 0, medalBy: tr.medal || 'misses', medal: 0, newBest: false,
    clock: 0, snaps: [], snapAt: -1e9, rewind: null, rewindAt: -1e9, rwSeq: 0, // REWIND: see qualRewind
    aim: makeAim()
  };
}
// CONTROLS CHECK: bring each node onto a lit target on the ring and HOLD. Each rep's
// target materializes off the node's live position when the rep begins, so every rep
// is a deliberate, reachable move; the last rep lights both nodes at once.
function makeAim() {
  return { idx: 0, targets: null, hold: 0, reps: [
    [{ node: 0, off: -2.0 }],                        // blue: reach one way (relative)
    [{ node: 1, off: 2.0 }],                         // white: reach the other
    [{ node: 0, a: -2.5 }, { node: 1, a: -0.64 }],   // both at once, FIXED: opposite upper sides
  ] };
}
// THE DRILL DISCS NO LONGER STOP THE COURSE (2026-10-08). From 2026-08-28 one disc
// opened each lesson and ran a live diorama of the move (drawDiscDemo, 91-briefing).
// The dioramas survive: CALL AND RESPONSE plays them on the live ring, as ghosts, just
// before the same pattern arrives for real (qualNext, drawTutCall). These cards keep
// the drill words for the disc renderer, the field-briefing bench and the tests.
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
// ---------- CALL AND RESPONSE ----------
// Every lesson is a phrase the ring plays to the pupil before it asks for it back.
// In the CALL a ghost of the lesson's own diorama (the DEMO table in 91-briefing, the
// one the drill discs ran) plays on the live ring, rotated onto the bearing the real
// traffic will take. The lane keeps flowing and the music keeps playing, but nothing
// is released. In the RESPONSE the same pattern arrives for real, on that bearing.
//
// A call plays once per kind per trial: the second red of INTERCEPT, the second end
// of a net and the white phase lock get none, the way Rhythm Doctor's cues fall away
// once the pupil has the beat. A miss does not repeat the call; REWIND answers it.
const CALLS_ON = true;         // false = the trials spawn straight away, with no ghost
const CALL_MOVE_DUR = 2.4;     // the SLIDE call: a ghost thumb drags, a ghost emitter follows
const CALL_FADE = 0.25;        // the ghost's fade in and out, seconds
const CALL_KEY = { lock0: 'lock', lock1: 'lock' }; // both phase locks share one lesson
const callKey = k => CALL_KEY[k] || k;
// the call is one loop of its diorama, which was tuned to its own payoff (DEMO_LOOP)
const callDur = key => (key === 'move' ? CALL_MOVE_DUR : (DEMO_LOOP[key] || 4));
// nudge a bearing until it sits clear of both carriages, then clear of the walls
function clearOfNodes(a, gap) {
  for (let h = 0; h < 12; h++) {
    if (!nodes.some(n => Math.abs(angDiff(n.angle, a)) < gap)) break;
    a += 0.45;
  }
  return clearOfWalls(a);
}
// THE BEARING THE RESPONSE WILL TAKE, chosen when the call starts so the ghost can be
// played on it. A reachable move from where the carriages are, never on top of one.
function callAngle(kind) {
  const side = () => (Math.random() < 0.5 ? 1 : -1);
  if (kind === 'heavy' || kind === 'volley') return clearOfNodes(nodes[0].angle + Math.PI, 0.7);
  if (kind === 'wall') return nodes[0].angle + Math.PI * 0.55 * side();
  if (kind === 'lock1') return clearOfNodes(nodes[1].angle + side() * rand(1.1, 1.8), 0.6);
  if (kind === 'normal' || kind === 'lock0') return clearOfNodes(nodes[0].angle + side() * rand(1.1, 1.8), 0.6);
  return clearOfWalls(Math.random() * TAU);
}
function qualNext(kind) {
  const key = callKey(kind);
  const a = kind === 'pulse' ? undefined : callAngle(kind);
  const gap = kind === 'line' ? rand(0.9, 1.3) : undefined;
  if (CALLS_ON && !tut.called[key]) {
    tut.called[key] = 1;
    tut.call = { kind, key, t: 0, dur: callDur(key), a, gap };
    return;
  }
  qualSpawn(kind, a, gap);
}
// `a` (and a net's `gap`) pin the bearing the call was played on; without them each
// kind places itself exactly as it always did
function qualSpawn(kind, a, gap) {
  tut.spawned = kind;
  if (kind === 'pickup') {
    pickups.push({ kind: 'wide', z: SPAWN_Z, angle: a !== undefined ? a : Math.random() * TAU, spin: 0, done: false, tut: true });
    return;
  }
  if (kind === 'strip') {
    const en2 = spawnStrip();
    en2.tut = 'strip';
    en2.len = 0.5; en2.amp = 0.22; en2.frq = 2.2; en2.ph = 0;
    if (a !== undefined) en2.angle = a;
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
    let va = a;
    if (va === undefined) {
      va = nodes[0].angle + Math.PI;
      for (let h = 0; h < 8; h++) {
        if (!nodes.some(n => Math.abs(angDiff(n.angle, va)) < 0.7)) break;
        va += 0.5;
      }
      va = clearOfWalls(va);
    }
    for (const [da, ty] of [[0, 'heavy'], [-0.5, 'normal'], [0.5, 'normal']]) {
      const ev = spawnEnemy(va + da, ty);
      ev.lock = undefined; ev.tut = 'volley';
      ev.z = SPAWN_Z; ev.speedMul = 0.55; // the long approach is the room to hold
    }
    return;
  }
  if (kind === 'wall') {
    // a practice clamp lands ahead — steer clear, or eat the fry and go back
    latches.length = 0;
    const away = a !== undefined ? a : nodes[0].angle + Math.PI * (Math.random() < 0.5 ? 0.55 : -0.55);
    latches.push({ a: away, span0: 0.5, t: 0, dur: 3.2, tele: 2.0, arm: 0.4, z0: 1.3 });
    sfx.latchWarn();
    return;
  }
  if (kind === 'line') {
    const la = a !== undefined ? a : Math.random() * TAU, lg = gap !== undefined ? gap : rand(0.9, 1.3);
    const e1 = spawnEnemy(la, 'line'), e2 = spawnEnemy(la + lg, 'line');
    e1.partner = e2; e2.partner = e1; e1.lineLead = true;
    e1.tut = e2.tut = 'line';
    return;
  }
  let en;
  if (kind === 'lock0' || kind === 'lock1') {
    en = spawnEnemy(a, 'normal');
    en.lock = kind === 'lock0' ? 0 : 1;
  } else en = spawnEnemy(a, kind); // normal | heavy
  en.tut = kind;
}
// ---------- REWIND ----------
// A MISS PULLS THE LANE BACK, IT DOES NOT START THE DRILL OVER (Braid, Forza Horizon,
// Celeste's instant respawn). The trial keeps a short tape of the drill — the traffic,
// the relays, the clamps and the pulse banks, every REWIND_SNAP seconds — and a miss
// winds it back REWIND_BACK seconds, to a moment the missed thing was still inbound.
// The world holds still for REWIND_DUR under a tape-scrub, the ghost marks where the
// emitter belongs, and the lane runs again from there.
//
// The CARRIAGES ARE NOT WOUND BACK. The thumbs are still on the pads, and an emitter
// that jumped away from under a held thumb would read as the controls breaking. A
// fried carriage is mended, though: the fry belongs to the moment being undone.
//
// The trial is unranked (boardKey is null while qual is set) and draws Math.random,
// never spawnRng, so rewinding moves no board. The purge column is never rewound:
// its freeze-and-tap hold has its own state, and a miss there replays the drill.
const REWIND_ON = true;
const REWIND_BACK = 2.0;   // seconds the tape winds back, at most
const REWIND_DUR = 0.85;   // seconds the world holds under the scrub
const REWIND_SNAP = 0.25;  // seconds between tape frames
const REWIND_KEEP = 16;    // tape frames kept: 4 s
const REWIND_GHOST = 2.6;  // seconds the ghost carriage marks the spot after the scrub
// a deep copy that keeps shared references shared — a barrier net's two ends point at
// each other through `partner`, and the copy has to as well
function deepClone(v, seen) {
  if (v === null || typeof v !== 'object') return v;
  seen = seen || new Map();
  if (seen.has(v)) return seen.get(v);
  const out = Array.isArray(v) ? [] : {};
  seen.set(v, out);
  for (const k of Object.keys(v)) { const x = v[k]; if (typeof x !== 'function') out[k] = deepClone(x, seen); }
  return out;
}
function qualSnap(dt) {
  if (!REWIND_ON) return;
  tut.clock += dt;
  if (tut.clock - tut.snapAt < REWIND_SNAP) return;
  tut.snapAt = tut.clock;
  // a tape id on every body, so the rewind can find each one again in an older frame
  // and slide it there instead of making it jump (qualRewind)
  for (const list of [enemies, pickups, latches])
    for (const x of list) if (x.rwId === undefined) x.rwId = ++tut.rwSeq;
  tut.snaps.push({
    clock: tut.clock, spawned: tut.spawned, wallDone: tut.wallDone,
    enemies: deepClone(enemies), pickups: deepClone(pickups), latches: deepClone(latches),
    deadT: nodes.map(n => n.deadT), pulse: pulseCharge.slice()
  });
  if (tut.snaps.length > REWIND_KEEP) tut.snaps.shift();
}
// the tape frame to wind back to: walking back from the newest, the oldest frame
// within REWIND_BACK in which the missed thing was still inbound — never a frame
// from before it existed
function rewindFrame(kind) {
  const alive = s => s.enemies.some(e => e.tut && !e.dead && !e.resolved && !e.failed)
    || s.pickups.some(p => p.tut && !p.done)
    || (kind === 'wall' && s.latches.length > 0 && s.deadT.every(d => d <= 0));
  let pick = null;
  for (let i = tut.snaps.length - 1; i >= 0; i--) {
    const s = tut.snaps[i];
    if (!alive(s)) { if (pick) break; continue; }
    pick = s;
    if (tut.clock - s.clock >= REWIND_BACK) break;
  }
  return pick;
}
function qualRewind(kind) {
  if (!REWIND_ON || kind === 'pulse') return false;
  const s = rewindFrame(kind);
  if (!s) return false;
  // where every body stands NOW, by tape id: the start of its slide back
  const now = new Map();
  for (const x of enemies) if (x.rwId !== undefined) now.set(x.rwId, x.z);
  for (const x of pickups) if (x.rwId !== undefined) now.set(x.rwId, x.z);
  for (const x of latches) if (x.rwId !== undefined) now.set(x.rwId, x.t);
  enemies = deepClone(s.enemies);
  pickups = deepClone(s.pickups);
  latches = deepClone(s.latches);
  // THE TAPE RUNS BACKWARDS, it does not cut (Gil, testing the branch: "it just snaps…
  // we should actually animate back quickly so the orientation isn't lost"). Each body
  // keeps its old place as rwFrom and the tape's as rwTo; qualRewindTick slides it from
  // one to the other while the world holds. A body the tape has but the lane lost (a
  // zapped neighbour) has no `now`, and simply stands at its tape place.
  const arm = (x, key) => {
    const was = now.get(x.rwId);
    x.rwTo = x[key]; x.rwFrom = was !== undefined ? was : x[key]; x[key] = x.rwFrom;
  };
  for (const x of enemies) arm(x, 'z');
  for (const x of pickups) arm(x, 'z');
  for (const x of latches) arm(x, 't');
  pulseCharge = s.pulse.slice();
  s.deadT.forEach((d, i) => { nodes[i].deadT = d; });
  tut.spawned = s.spawned; tut.wallDone = s.wallDone;
  tut.snaps = tut.snaps.filter(f => f.clock <= s.clock);
  tut.clock = s.clock; tut.snapAt = s.clock;
  tut.retry = null; tut.missCounted = false; tut.again = null; tut.t = 0;
  tut.rewind = { t: 0, dur: REWIND_DUR, kind }; tut.rewindAt = time;
  sfx.tutFreeze(); // the tape-warp: the run holds its breath, then picks up again
  buzz([18, 30, 18]);
  return true;
}
// THE SLIDE BACK, on real time while the world holds (72-tick calls this in place of
// moving anything). The bodies run back fast and settle — an ease-out over the first
// REWIND_SLIDE of the scrub — and the rest of it is a beat to find the thumbs again.
const REWIND_SLIDE = 0.75; // share of REWIND_DUR the bodies spend travelling back
function qualRewindTick(dt) {
  const R = tut.rewind;
  R.t += dt;
  const q = clamp(R.t / (R.dur * REWIND_SLIDE), 0, 1), e = 1 - Math.pow(1 - q, 3);
  const slide = (x, key) => { if (x.rwTo !== undefined) x[key] = x.rwFrom + (x.rwTo - x.rwFrom) * e; };
  for (const x of enemies) slide(x, 'z');
  for (const x of pickups) slide(x, 'z');
  for (const x of latches) slide(x, 't');
  if (R.t < R.dur) return;
  for (const list of [enemies, pickups, latches])
    for (const x of list) { delete x.rwFrom; delete x.rwTo; }
  tut.rewind = null;
}
// ---------- the course runs ----------
function advanceQual() {
  tut.stage++;
  tut.t = 0;
  tut.again = null; // a fresh drill speaks in the present tense
  if (tut.stage >= tut.qual.length) { qualFinish(); return; } // safety: 'done' normally ends it
  const c = tutStage().card;
  if (c === 'done') { // no info disc: the medal (or QUALIFIED) stamps in-world
    tut.queue = [];
    tut.medal = trialMedal(tut);
    const P = progress.trials || (progress.trials = {});
    tut.newBest = tut.trial !== COURSE.id && tut.medal > (P[tut.trial] || 0);
    if (tut.trial !== COURSE.id) P[tut.trial] = Math.max(P[tut.trial] || 0, tut.medal); // the course files no medal
    if (trialRun) { trialRun.medal = tut.medal; trialRun.newBest = tut.newBest; }
    saveState();
    // rising clearance chord: the line accepts its defender
    sfx.qualified();
    buzz([30, 40, 90]);
    return;
  }
  tut.queue = (tutStage().queue || []).slice();
  sfx.tick();
  // pre-spawned drills: the hazard is already inbound as the stage opens
  if (c === 'pulse') { tut.queue = []; qualNext(c); }
}
// THE TRIAL IS OVER and the report takes the run. The first-run course files itself as
// done, and its report offers the first contract.
function qualFinish() {
  if (tut.firstRun) progress.tutorialDone = true;
  saveState();
  tut = null;
  endLevel(true);
}
const AIM_HOLD = 0.3; // seconds a node must sit on a target to lock it in
function updateTutorial(dt) {
  // A MISS IS COUNTED ONCE, the moment it lands, and then the tape is tried. Only if
  // there is nothing to wind back to does the old do-over below take the miss.
  if (tut.retry && !tut.missCounted) {
    tut.missCounted = true;
    tut.misses++;
    if (qualRewind(tut.retry)) return;
  }
  if (tut.call) { // the CALL: the ghost plays the move, the lane releases nothing
    tut.call.t += dt;
    if (tut.call.t >= tut.call.dur) {
      const c = tut.call;
      tut.call = null;
      tut.t = 0;
      if (c.kind !== 'move') qualSpawn(c.kind, c.a, c.gap);
      tut.responseAt = time; // drawTutCall's YOUR TURN reads this
    }
    return;
  }
  tut.t += dt;
  const st = tutStage();
  if (st.card !== 'done') { tut.work += dt; qualSnap(dt); }
  if (st.card === 'move') {
    // land each lit target's assigned node inside the zap window, and HOLD;
    // the final rep lights both at once (both must be covered together)
    const A = tut.aim, TOLm = ARCFX.span * tolVis;
    if (!A.targets) {
      A.targets = A.reps[A.idx].map(t => ({ node: t.node, a: t.a !== undefined ? t.a : nodes[t.node].angle + t.off }));
      // the first rep and the two-thumb rep are called; the middle one is the pupil's alone
      const ck = 'move' + A.idx;
      if (CALLS_ON && (A.idx === 0 || A.idx === A.reps.length - 1) && !tut.called[ck]) {
        tut.called[ck] = 1;
        tut.call = { kind: 'move', key: 'move', t: 0, dur: CALL_MOVE_DUR, from: A.targets.map(t => nodes[t.node].angle) };
        tut.work -= dt; // the call is not the pupil's time
        return;
      }
    }
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
    // the stamp runs its course, then the next trial or the report — no hard cut
    if (tut.t > 3.4) qualFinish();
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
      // once the clamp burns off, unless the tape can take the lane back first
      tut.retry = 'wall'; tut.t = 0;
      return; // the miss is counted, and the rewind tried, on the next step
    }
    if (latches.length) return; // still burning — hold the stage
    if (!tut.wallDone && !tut.retry) { // the clamp burned off untouched
      tut.wallDone = true;
      popup(W / 2, H * 0.35, 'ROUTED AROUND', '#7ee262');
    }
  }
  const live = enemies.some(e => !e.dead && !e.resolved) || pickups.some(p => !p.done) || latches.length > 0;
  if (tut.retry && !live && tut.t > 0.9) { // nothing to wind back to: the same drill again
    const k = tut.retry; tut.retry = null; tut.t = 0; tut.missCounted = false;
    tut.again = k; // the label acknowledges the do-over
    qualSpawn(k);
    return;
  }
  if (!live && !tut.retry) {
    if (tut.queue.length) { if (tut.t > 0.7) { tut.t = 0; qualNext(tut.queue.shift()); } }
    else if (tut.t > 0.8) advanceQual();
  }
}
