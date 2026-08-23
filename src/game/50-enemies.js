'use strict';
// ---------- enemies ----------
// The spawn path draws from its OWN random stream. Campaign levels seed it per
// level, so every level is a fixed, learnable drill that repeats exactly —
// training for the real thing (endless/weekly, which stay procedural).
let spawnRng = Math.random;
const srand = (a, b) => a + spawnRng() * (b - a);
const schance = p => spawnRng() < p;
const scripted = () => !endless && !qual; // campaign levels replay a fixed script
// A run that will be REPLAY-VERIFIED must not read the music clock. The server
// re-simulates with no AudioContext at all, so anything keyed off AC.currentTime
// puts the two simulations on different rails — and worse, the beat-volley test
// consumes spawnRng() inside a condition gated on `musicSrc`, so even WHETHER the
// spawn stream advances differed between the player and the verifier.
//
// scripted() already excluded campaign for the neighbouring reason (music phase
// varies run to run, and a drill must land the same arrivals every time). Weekly is
// verifiable too and was never excluded, which is half of why weekly could not
// verify. Free-flow endless keeps its beat choreography: it is unseeded and
// trust-only, so nothing re-simulates it.
const beatFree = () => scripted() || weekly;
// enemy types:
//   'normal' — any node zaps it
//   'heavy'  — must be covered by BOTH nodes at the same time
//   'line'   — spawned as a linked pair at the same depth; each end needs its own node
function spawnEnemy(forcedAngle, type) {
  type = type || 'normal';
  const heavy = type === 'heavy';
  const L = bandCfg(LV || LEVELS[levelIdx], levelT); // band mixes reach the lock roll too
  // BURNED DRAW. This was the `crawlers` roll — a knob no level ever set, whose
  // result was thrown away (H-28, 2026-08-23). The draw itself has to stay:
  // every spawnRng() after it would shift, which moves the angle of every
  // enemy on every board and turns each stored replay into a miss. Remove it
  // only in a release that is already moving every board id.
  if (type === 'normal') spawnRng();
  // color-locked traps only answer to one node: 0 = blue (left), 1 = white (right)
  let lock = type === 'normal' && schance(L.colors || 0)
    ? (schance(0.5) ? 0 : 1) : undefined;
  // fairness: a color whose node is already booked flips, or unlocks entirely
  if (lock !== undefined && !lockAllowed(lock)) lock = lockAllowed(1 - lock) ? 1 - lock : undefined;
  const speedMul = heavy ? 0.82 : 1;
  // dropTravel: an early-clamped beat can't back-time before the level start —
  // it materializes partway down the bore instead (CONSTANT speed, never
  // scaled; the birth fade covers the deep entrance) so its arrival keeps the
  // authored cue. null = normal horizon spawn.
  const z0 = dropTravel !== null ? geo().hitZ + dropTravel * trafficSpeed * speedMul : SPAWN_Z;
  const en = {
    type, lock, z: z0, z0, angle: forcedAngle !== undefined ? forcedAngle : clearOfWalls(spawnRng() * TAU),
    // heavy reads as the bigger threat, but only SLIGHTLY — its multiplier
    // stacks on ENEMYFX.size, so the old 1.6 blew up once bodies grew (2026-07-26)
    sizeMul: type === 'frag' ? 0.8 : heavy ? 1.2 : 1, speedMul,
    spin: spawnRng() * TAU, spinMul: heavy ? 0.45 : 1, age: 0, dead: false, partner: null
  };
  enemies.push(en);
  // book the TRUE arrival in the fairness ledger (strips book in spawnStrip
  // with their length; friendlies never book — parity with the live-enemy scan)
  if (type !== 'strip' && type !== 'frag') {
    const tA = levelT + arrivalAt(en.z, en.speedMul);
    sched.push({ t0: tA, t1: tA, type, lock, needsNode: type !== 'normal' || lock !== undefined });
  }
  return en;
}
// barrier line: two linked traps at the same depth with an energy wall strung between them
function spawnLine(forcedA, force) { // beats may pin the lead end's angle; force = verbatim
  let a = forcedA !== undefined ? forcedA : spawnRng() * TAU;
  const gap = srand(0.8, 1.5) * (schance(0.5) ? -1 : 1);
  // clear the whole barrier span of any wall — the pair's dual-node geometry
  // adds its half-gap to the reachability bound
  if (!force) a = clearOfWalls(a + gap / 2, Math.abs(gap) / 2) - gap / 2;
  const e1 = spawnEnemy(a, 'line');
  const e2 = spawnEnemy(a + gap, 'line');
  e1.partner = e2; e2.partner = e1;
  e1.lineLead = true; // the pair's beam and hit test are handled once, by the lead
}
// hand-authored volleys — arrivals land on consecutive beats (da = angle offset)
const PATTERNS = [
  { steps: [{ b: 0, da: 0 }, { b: 1, da: 0.55 }, { b: 2, da: -0.55 }] },                                 // fan
  { steps: [{ b: 0, da: 0 }, { b: 1, da: 0.45 }, { b: 2, da: 0.9 }, { b: 3, da: 1.35 }] },               // sweep
  { steps: [{ b: 0, da: 0 }, { b: 0, da: Math.PI }, { b: 2, da: 0.5 }, { b: 2, da: Math.PI + 0.5 }] },   // pincer
  { steps: [{ b: 0, da: 0 }, { b: 1, da: -0.4 }, { b: 2, da: -0.8 }, { b: 3, da: -1.2 }] }               // stairs
];
// traps drop in at the visual horizon and ride the wall at CONSTANT z-speed —
// perspective alone supplies the acceleration feel, so arrival is extrapolable
const SPAWN_Z = 2.1;
const travelTime = () => (SPAWN_Z - geo().hitZ) / ((LV || LEVELS[levelIdx]).speed * (mutLive('fast') ? 1.35 : 1));
// ---------- spawn fairness ----------
// never schedule an arrival pattern two nodes can't physically cover:
//  · heavies/lines demand BOTH nodes at once — their window must be empty
//  · a strip owns one node for its whole crossing — nothing dual-node or
//    color-bound may share it, and at most one plain trap can
//  · same-color locks can't double-book their node in one window
//  · never more than two hostile arrivals in one window (there are two nodes)
//  · friendlies need a clean window, so covering a trap can't clip them
function arrivalAt(z, speedMul) {
  return (z - geo().hitZ) / ((LV || LEVELS[levelIdx]).speed * (speedMul || 1));
}
// the ledger of booked arrivals (sim-time). Gates read the SCHEDULE, not the
// live enemies — kills don't free a window, so a level's spawn script plays
// out identically no matter how the player performs
let sched = [];
function windowMates(tNew, gap) {
  const tA = levelT + tNew;
  return sched.filter(s => tA > s.t0 - gap && tA < s.t1 + gap);
}
function spawnAllowed(type) {
  const GAP = 0.55; // seconds of arrival separation that reads as "same moment"
  const tNew = arrivalAt(SPAWN_Z, type === 'heavy' ? 0.82 : 1);
  if (type === 'heavy' || type === 'line') {
    // heavies die to the volley now: each needs its own dock+charge+recharge
    // cycle, so consecutive armor must leave breathing room between them
    if (type === 'heavy' && windowMates(tNew, 2.4).some(s => s.type === 'heavy')) return false;
    return windowMates(tNew, GAP * 1.5).length === 0;
  }
  if (type === 'strip') {
    const tA0 = levelT + tNew;
    const tA1 = tA0 + 0.9 / (LV || LEVELS[levelIdx]).speed;
    for (const s of sched) {
      if (s.needsNode && s.t1 > tA0 - GAP && s.t0 < tA1 + GAP) return false;
    }
    return windowMates(tNew, GAP).length <= 1;
  }
  if (type === 'frag') return windowMates(tNew, 0.4).length === 0;
  // plain trap (may become a lock — see lockAllowed)
  const mates = windowMates(tNew, GAP);
  if (mates.some(s => s.type === 'heavy' || s.type === 'line')) return false;
  const strips = mates.filter(s => s.type === 'strip').length;
  return mates.length - strips < (strips ? 1 : 2); // a strip leaves only one free node
}
// a color lock may only spawn if its node isn't already booked in the window
function lockAllowed(lock) {
  const mates = windowMates(arrivalAt(SPAWN_Z, 1), 0.55);
  if (mates.some(s => s.type === 'strip')) return false; // the tracing node is unknowable
  return !mates.some(s => s.lock === lock);
}
// story lull: a scripted spawn that would ARRIVE mid-transmission is held at
// the gate until it can land after the words — every comm plays over a calm
// stretch the player can actually read. The hold consumes no RNG draws, so
// campaign replays stay identical.
function storyHold() {
  if (endless || qual || tut || boss || levelIdx < 0) return 0;
  const cl = COMMS[levelIdx] || [];
  const trav = travelTime();
  // the guarded stretch: typewriter (~1.2s) + a beat to read; the chip lingers
  // past it, but arrivals may resume under a line that's already been read
  const tLand = levelT + trav; // a spawn released now reaches the rim here
  const hit = cl.find(c => tLand > c.t - 0.5 && tLand < c.t + 3.2);
  return hit ? hit.t + 3.2 + 0.3 - trav - levelT : 0;
}
// beat lull: an AUTHORED quiet window ({ t, kind: 'lull', dur } in the level's
// beats). Filler whose arrival would fall inside [t, t+dur] is held at the
// gate — same displacement rule as storyHold, consuming no RNG draws. The
// landing estimate is bracketed [normal, heavy] speed so slow armor released
// just before a lull can't drift into it.
function lullHold() {
  const bl = LV && LV.beats;
  if (!bl || !bl.length) return 0;
  const trav = travelTime();
  const t0 = levelT + trav, t1 = levelT + trav / 0.82;
  let wait = 0;
  for (const b of bl) {
    if (b.kind === 'lull' && t1 > b.t && t0 < b.t + b.dur)
      wait = Math.max(wait, b.t + b.dur + 0.05 - trav - levelT);
  }
  return wait;
}

// ---------- beats ----------
// hand-placed timeline events (schema in docs/CMS-ROADMAP.md). A beat's t is
// its ARRIVAL moment at the ring: the release is back-timed by the travel
// lead so the event lands on cue (early beats clamp at t≈0 via dropTravel).
// Every beat draws from its OWN seeded side stream (like volley replicants,
// which also never touch spawnRng), so the level's main seeded sequence
// stays untouched — same seed, same script, beats or no beats.
let beatSt = null; // { fired: [bool] } for the active scripted level
// remaining-travel override for the spawns of an early-clamped beat: the
// entity materializes partway down the bore at CONSTANT speed so the arrival
// still lands on the authored cue (the birth fade hides the deep entrance)
let dropTravel = null;
const beatStream = (li, bi) => mulberry32((0xBEA75 ^ (li * 7919 + bi * 104729)) >>> 0);
const beatLead = b => b.kind === 'wall' ? travelTime()
  : b.kind === 'pickup' ? arrivalAt(SPAWN_Z, 0.9)
  : arrivalAt(SPAWN_Z, b.kind === 'enemy' && b.type === 'heavy' ? 0.82 : 1);
function initBeats() {
  beatSt = null;
  if (!scripted() || !LV || !LV.beats || !LV.beats.length) return;
  beatSt = { fired: LV.beats.map(() => false) };
  // pre-book every authored demand window so the filler routes around the
  // beats from second zero — the real booking replaces this at spawn time
  LV.beats.forEach((b, bi) => {
    if (b.kind === 'enemy') {
      const lock = b.type === 'lock0' ? 0 : b.type === 'lock1' ? 1 : undefined;
      const type = lock !== undefined ? 'normal' : (b.type || 'normal');
      if (type !== 'frag')
        sched.push({ t0: b.t, t1: b.t, type, lock, needsNode: type !== 'normal' || lock !== undefined, beat: bi });
    } else if (b.kind === 'strip') { // longest possible ride (len ≤ 0.85)
      sched.push({ t0: b.t, t1: b.t + 0.85 / LV.speed, type: 'strip', lock: undefined, needsNode: true, beat: bi });
    }
  });
}
function runBeats() {
  if (!beatSt) return;
  const bl = LV.beats;
  const cl = COMMS[levelIdx] || [];
  for (let bi = 0; bi < bl.length; bi++) {
    if (beatSt.fired[bi]) continue;
    const b = bl[bi];
    if (b.kind === 'lull') { if (levelT >= b.t) beatSt.fired[bi] = true; continue; }
    const lead = beatLead(b);
    if (levelT < b.t - lead) continue;
    // an early beat (t < lead) can't back-time before the level start — its
    // release clamps at t≈0 with a shortened travel (see dropTravel), never
    // a negative time. Ordinary beats keep the full lead.
    const eff = b.t < lead ? Math.max(0.4, b.t - levelT) : lead;
    // a beat that would LAND mid-transmission waits for the words, exactly
    // like filler does — it slides late, never disappears
    const tArr = levelT + eff;
    if (cl.some(c => tArr > c.t - 0.5 && tArr < c.t + 3.2)) continue;
    beatSt.fired[bi] = true;
    fireBeat(b, bi, eff < lead - 1e-9 ? eff : undefined);
  }
}
function fireBeat(b, bi, eff) {
  sched = sched.filter(s => s.beat !== bi); // the live booking replaces the reservation
  const keep = spawnRng;
  spawnRng = beatStream(levelIdx, bi); // side stream — the main script's draws stay aligned
  dropTravel = eff !== undefined ? eff : null; // clamped release: spawn partway down, constant speed
  // reachability: an authored angle relocates only when its dock arc is truly
  // ON a carpet (walls add their own half-span); force skips even that
  const a = b.angle !== undefined
    ? (b.force ? b.angle : clearOfWalls(b.angle, b.kind === 'wall' ? 0.5 : 0))
    : undefined;
  if (b.kind === 'wall') spawnWall(a, b.force, eff);
  else if (b.kind === 'strip') spawnStrip();
  else if (b.kind === 'pickup') { if (!mutLive('noPickups')) spawnPickup(b.type); }
  else if (b.type === 'line') spawnLine(a, b.force);
  else if (b.type === 'lock0' || b.type === 'lock1') {
    // fairness beats authorship: a lock whose node is booked flips or unlocks
    let lock = b.type === 'lock1' ? 1 : 0;
    if (!lockAllowed(lock)) lock = lockAllowed(1 - lock) ? 1 - lock : undefined;
    const en = spawnEnemy(a, 'normal');
    en.lock = lock;
    const s = sched[sched.length - 1]; // patch the booking spawnEnemy just made
    s.lock = lock; s.needsNode = lock !== undefined;
  }
  else spawnEnemy(a, b.type || 'normal');
  dropTravel = null;
  spawnRng = keep;
}
