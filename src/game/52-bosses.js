'use strict';
// ---------- the boss fights ----------
// ONE FAMILY, FIVE MACHINES. Every campaign ends on a WARP LEECH — an outlaw
// engine clamped across the lane's centre, drinking it. The machines share a
// body plan (counter-rotating sprocket rings around a lamp-core), an arrival
// ceremony, a death ceremony, and ONE damage verb:
//
//   ONLY A PULSE WOUNDS A LEECH. Zaps bank charge, streams bank a full orb,
//   a tap sends the wave down the bore, and the wavefront lands the hit.
//
// What escalates across the five contracts is never the verb — it is how you
// are ALLOWED to earn each charge, and what hunts you while you earn it.
//
// Why static and central: it sits where the eye already is (the centre, where
// traffic arrives from), its threat is expressed on the RING rather than as a
// small object to track, it adds no second stream of fast dots to a screen
// already full of them, and you never have to aim at it — the pulse wave fills
// the whole bore. That last one is what lets a boss stand still.
const BOSS_DEFS = {
  leech: {
    title: 'THE WARP LEECH', sub: 'ZAP ITS SWARM, BANK THE CHARGE — SIX PULSES CUT IT LOOSE',
    online: 'WARP LEECH ONLINE', down: 'WARP LEECH DOWN',
    speak: 'this lane feeds me. you are traffic, nothing more.'
  },
  siphon: {
    title: 'THE SIPHON', sub: 'OUTRUN THE LIGHT — STEAL ITS STREAMS — SIX PULSES',
    online: 'SIPHON ONLINE', down: 'SIPHON DOWN',
    speak: 'the light finds one of you. the stream was never yours.'
  },
  prism: {
    title: 'THE PRISM', sub: 'TWO LIGHTS, ONE EACH — CHARGE IN THE CALMS — SIX PULSES',
    online: 'PRISM ONLINE', down: 'PRISM DOWN',
    speak: 'two lights. two of you. my arithmetic wins.'
  },
  mimic: {
    title: 'THE MIMIC', sub: 'READ THE LAMP — ONLY THE MATCHING PULSE LANDS',
    online: 'MIMIC ONLINE', down: 'MIMIC DOWN',
    speak: 'match me, runner. i change faster than you aim.'
  },
  blockade: {
    title: 'THE BLOCKADE', sub: 'EVERY PATTERN IT OWNS — NINE PULSES RUN IT',
    online: 'BLOCKADE ONLINE', down: 'BLOCKADE BROKEN',
    speak: 'every trick you broke lives on in me. the lane ends here.'
  }
};
// CORE / WARDEN / FIREWALL were retired here with the fights that carried them
// (the array, the triad, the warden core). The machines are leeches now — the
// WARD speaker ('the interdiction') survives as the family's one voice.
//
// THE DUEL ECONOMY. Boss swarms run fat: zap-feed is multiplied while a leech
// is on the lane, so a full orb is ~5 committed kills instead of ~10 and a
// six-pulse fight lands at minutes, not tens of them. Read by the zap-credit
// block in 72-tick. THE tuning knob for fight length.
const BOSS_FEED = 2;
// GIL'S PURPLE LAW (global): a pressure drone DEMANDS BOTH EMITTERS, so it
// never shares an arrival window with ANYTHING — and it claims a clear stretch
// of pipe before and after it. Both thumbs converge on it; nothing else can be
// answered while they do. The radius is deliberately between a window's GAP
// (0.55 — too short: the convergence takes longer than a moment) and heavy
// armor's 2.4s spacing (too long: the lane would go slack around every one).
const PURPLE_CLEAR = 1.0;     // seconds of exclusive pipe, each side
const LEECH_WAVE_GAP = 2.6;   // seconds between swarm releases while the lane still has work
const LEECH_LATCH_ARC = 1.6;  // the dockable-arc law: walls may never close the ring
const SWEEP_BEAM_HALF = 0.13; // beam half-width at the ring (rad)
const SWEEP_ADD_GAP = 1.15;   // trickle spacing for reds released under a sweep
// THE LIGHT IS BORN AND DIES ON SCREEN. A live ray BURSTS from the machine's
// mouth (BEAM_BURST of growth — held stationary, and it cannot fry until it is
// fully out: burned by a beam mid-birth would be a coin toss), and a spent
// rotation's light fades back INTO the mouth it came from (BEAM_FADE, pure
// spectacle riding b.beamFx — the fight machinery is already done with it).
const BEAM_BURST = 0.30;
const BEAM_FADE = 0.35;
// THE DEATH TAKE, aligned to the picture. boss-dead.mp3 is 5.11s with a 1.4s
// build and its blast at 1.43s, so the take is started that far BEFORE the
// implosion: the build scores the convulsions, the blast lands on the flash.
// Both numbers are here because they are one relationship — move the implosion
// (BOSS_BOOM_AT) or re-cut the take (BOSS_DEAD_IMPACT) and the other follows.
const BOSS_BOOM_AT = 2.3;      // when the implosion lets go, in ceremony seconds
const BOSS_DEAD_IMPACT = 1.43; // where the blast sits inside the take
// THE ARRIVAL BED. boss-arrival.mp3 runs 9.08s at full level — far longer than
// the 3.4s ceremony — so it is held across the whole arrival and then eased
// out. HOLD lands in the take's own dip at ~4.5s (a swell would cut off mid
// -phrase), which is about a second into the fight; FADE carries it away from
// there. Raise HOLD to let more of the piece play under the opening.
const ARRIVAL_HOLD = 4.4;
const ARRIVAL_FADE = 1.0;
// AND THE MUSIC GETS OUT OF ITS WAY. The take is mastered hot — it peaks ABOVE
// full scale already, so making it "louder" by gain would only clip it. What
// was actually burying it is the run track playing at full level underneath,
// so the arrival ducks the music for exactly as long as it holds. The duck's
// own 1.2s release then lifts the track back as the take fades, which is why
// this reuses musicDuck rather than adding a second envelope.
const ARRIVAL_DUCK = ARRIVAL_HOLD;
// THE MIMIC'S LAMP. Random flips would be a coin toss, so the lamp keeps three
// promises: a colour HOLDS long enough to bank against, every flip is telegraphed
// by a blink, and the lamp is LOCKED while a pulse is in flight — the shot you
// committed to is judged by the colour you committed at.
const LAMP_HOLD = [2.8, 4.2]; // seconds a colour holds, before round-shrink
const LAMP_BLINK = 0.6;       // blink telegraph before a flip
// the boss duel: the machine holds the bore's centre while the pulse economy
// (the campaign's own verbs — controls never change hands) takes it apart
function spawnBoss() {
  enemies = []; pickups = []; burstQ = null; patternQ = []; sched = []; latches = []; volley.shots = []; // the lane clears
  const kind = (LV || LEVELS[levelIdx]).bossKind || 'leech';
  boss = {
    kind,
    hp: 6, maxHp: 6, // six pulses close the contract (the blockade takes nine)
    // it surfaces from the deep, then claims the exact centre of the bore
    ang: Math.random() * TAU, rad: 0.12, z: 1.55,
    u: 0, v: 0, sx: W / 2, sy: H / 2, sSize: 40,
    spin: 0, hurtT: 0, shieldT: 0,
    round: 0,               // hits landed — every fight's escalation clock
    mode: 'idle', modeT: 0, // the sweep fights' phase machine
    beams: [],              // live/ghost sweeps: { a, dir, spd, phase, swept, rev }
    addT: 0, addA: Math.random() * TAU, sweepAdds: 0,
    lamp: -1, lampT: 0, lampBlink: 0, // -1: no lamp mechanic (core burns red)
    waveT: 1.6, // the first swarm lands just after the ceremony
    mergeT: 0, introT: 0 // controls never change hands — no fuse, ever
  };
  if (kind === 'mimic') {
    boss.lamp = Math.random() < 0.5 ? 0 : 1;
    boss.lampT = rand(LAMP_HOLD[0], LAMP_HOLD[1]);
  } else if (kind === 'blockade') {
    // nine pulses through four shed layers: 1 swarm, 2 siphon, 3 prism, 3 mimic
    boss.hp = boss.maxHp = 9;
    boss.phase = 0; boss.round0 = 0;
  }
  heat = 0; overheat = false; beamActive = false; beamAim.x = 0; beamAim.y = 0;
  // the continue's ledger: what the level EARNED before the duel began — a
  // RETRY DUEL restores exactly this, so only the fight itself is replayed
  bossSnap = { score, zaps, misses, perfects, maxCombo, maxComboSec, fragsHit };
  // THE DRAMA, on the frame the machine surfaces. The take is full level from
  // its first tenth of a second, so it belongs HERE rather than at any later
  // beat of the ceremony — the sound and the rising hull are one arrival.
  sfx.bossArrive(ARRIVAL_HOLD, ARRIVAL_FADE);
  boss.duckT = ARRIVAL_DUCK; // and the track stands down while it plays
  // NO DISC. A boss is met, not read about: the arrival ceremony puts its name
  // and its one-line tell on the ring (85-enemy-art), WARD barks over comms,
  // and ONLINE pops. Everything needed to start reacting is in the picture.
}
// the local escalation clock: the blockade re-zeroes it at each shed layer so
// a layer starts at its own round 0; everyone else reads their lifetime rounds
function bossRound(b) { return b.round - (b.round0 || 0); }
// THE LAMP IS LIVE for the mimic always, and for the blockade once it is down
// to its mimic layer — everywhere else the core just burns hostile red
function bossLampLive() {
  const b = boss;
  return !!b && b.lamp >= 0 && (b.kind === 'mimic' || (b.kind === 'blockade' && b.phase === 3));
}
// a pulse wave reached the machine's depth — the duel's ONLY wound
function bossPulseHit(wv) {
  const b = boss;
  if (!b || b.introT < BOSS_CER || b.dying !== undefined) return;
  const bd = BOSS_DEFS[b.kind];
  if (b.lastStand) {
    // BOTH KEYS, AS ONE — Gil's finale gesture: the kill shot is blue AND
    // white together. Fire the second before the first lands (in practice:
    // both thumbs tap as one); the pair spends into a single killing blow.
    // A lone colour fizzles on the shell like any wrong key.
    const partner = pulseWaves.find(w2 => w2 !== wv && !w2.hitBoss && w2.i !== wv.i);
    if (!partner) {
      b.shieldT = 0.6;
      burst(b.sx, b.sy, '#8fe0ff', 16, 4);
      popup(b.sx, b.sy - b.sSize, 'BOTH KEYS — FIRE THEM TOGETHER', '#eab8ff');
      tone(620, 0.12, 'sine', 0.08, 340); // fizzle, not thunder
      crackle(0.15, 1600, 700, 1, 0.3);
      buzz(10);
      return;
    }
    partner.hitBoss = true; // both waves spend into the one killing blow
  } else if (bossLampLive() && wv.i !== b.lamp) {
    // the mimic's one rule: only the matching colour lands. A wrong-key wave
    // fizzles on the shell — but it still purged the lane on the way in, so a
    // misread costs a shot, never the whole turn.
    b.shieldT = 0.6;
    burst(b.sx, b.sy, '#8fe0ff', 16, 4);
    popup(b.sx, b.sy - b.sSize, 'WRONG KEY — READ THE LAMP', NODE_HEX[b.lamp]);
    tone(620, 0.12, 'sine', 0.08, 340); // fizzle, not thunder
    crackle(0.15, 1600, 700, 1, 0.3);
    buzz(10);
    return;
  }
  b.hp -= 1;
  b.hurtT = 0.3;
  b.round++;
  burst(b.sx, b.sy, '#ffffff', 30, 6);
  burst(b.sx, b.sy, '#d465ff', 26, 5);
  burst(b.sx + rand(-1, 1) * b.sSize, b.sy + rand(-0.6, 0.6) * b.sSize, '#d465ff', 20, 5); // a plate shears off
  score += Math.round(300 * mutMul());
  popup(b.sx, b.sy - b.sSize, 'LEECH HIT ' + (b.maxHp - b.hp) + '/' + b.maxHp, '#eab8ff');
  shake = 1;
  hitStop = Math.min(hitStop + 0.1, 0.14);
  tone(70, 0.3, 'sine', 0.2, 40);
  crackle(0.35, 2000, 300, 2, 0.8);
  buzz([40, 30, 60], { strong: 0.9, weak: 0.5 });
  // THE PATCH POD. Every second wound, the convoy answers: a stability pickup
  // rides the lane. Duels are where the hull bleeds hardest, so relief is
  // scheduled INTO them — landed hits are the clock, which also means the
  // patches come at the player's own pace through the fight.
  if (b.hp > 0 && b.round % 2 === 0 && !mutLive('noPickups')) spawnPickup('health');
  if (b.hp <= 0) { // the kill — hand over to the death ceremony
    b.dying = 0; b.dyingN = 0;
    latches = []; volley.shots = [];
    score += Math.round(2000 * mutMul());
    popup(W / 2, H * 0.3, bd.down + '  +' + Math.round(2000 * mutMul()), '#ffd24a');
    beamSound(false, 0);
    return;
  }
  if (b.kind === 'blockade') {
    blockadeShift(b);
    if (b.hp === 1 && !b.lastStand) {
      // LAST STAND. One pulse from broken, the machine demands the campaign's
      // final gesture: BOTH keys, fired as one (see updateLastStand).
      b.lastStand = true;
      b.lampBlink = 0; b.mode = 'idle'; b.beams = []; b.sweepAdds = 0;
      popup(W / 2, H * 0.3, 'LAST STAND — BOTH KEYS, AS ONE', '#d465ff');
      tone(160, 0.5, 'sawtooth', 0.14, 60);
      crackle(0.45, 3200, 700, 6, 1.0, 0.1);
      buzz([50, 40, 70]);
    }
  }
}
// THE BLOCKADE SHEDS. Its layers are the four patterns of the campaign war,
// outermost first — losing one is progress the machine visibly cannot undo,
// and each fresh layer re-zeroes the local escalation clock so it opens
// readable and sharpens from there.
function blockadeShift(b) {
  const ph = b.hp >= 9 ? 0 : b.hp >= 7 ? 1 : b.hp >= 4 ? 2 : 3;
  if (ph === b.phase) return;
  b.phase = ph;
  b.round0 = b.round;
  b.mode = 'shed'; b.modeT = 1.4; // the stagger: it re-arms, you breathe
  b.beams = []; b.sweepAdds = 0;
  if (ph === 3) {
    b.lamp = Math.random() < 0.5 ? 0 : 1;
    b.lampT = rand(LAMP_HOLD[0], LAMP_HOLD[1]);
    b.lampBlink = 0;
  }
  popup(W / 2, H * 0.3, 'IT SHEDS A LAYER — NEW PATTERN', '#d465ff');
  tone(150, 0.5, 'sawtooth', 0.13, 70);
  crackle(0.4, 2600, 600, 4, 0.8);
  buzz([40, 30, 60]);
}
// ---------- shared machinery ----------
// every leech holds the bore's centre: the machine is the fight's fixed point
function leechHold(b, dt, g) {
  b.ang += dt * 0.12;
  b.rad = lerp(b.rad, 0, Math.min(1, dt * 3));
  b.z = lerp(b.z, 0.5, Math.min(1, dt * 1.5));
  b.u = Math.cos(b.ang) * b.rad;
  b.v = Math.sin(b.ang) * b.rad + Math.sin(time * 2.3) * 0.02;
  const brg = ring(b.z, g);
  b.sx = brg.x + b.u * brg.r;
  b.sy = brg.y + b.v * brg.r;
  b.sSize = Math.min(W, H) * 0.30 * brg.s;
}
// THE DOCKABLE-ARC LAW: the largest wall-free arc if a latch also landed at
// `cand` (undefined = just the current walls); each occupies half-span + node
// tolerance to a side. Walls may never close the ring.
function latchFreeArc(cand) {
  const occ = [];
  for (const lt of latches) occ.push(lt.a);
  if (cand !== undefined) occ.push(cand);
  if (!occ.length) return TAU;
  const HALF = 0.5 + WALL_TOL;
  const as = occ.map(a => ((a % TAU) + TAU) % TAU).sort((x, y) => x - y);
  let best = 0;
  for (let i = 0; i < as.length; i++) {
    const a1 = (i + 1 < as.length ? as[i + 1] : as[0] + TAU) - HALF;
    best = Math.max(best, a1 - (as[i] + HALF));
  }
  return best;
}
// pick a harassment angle that leaves the law intact; null = no legal arc now.
// TWO laws, not one. The dockable-arc law (a firing window always survives) —
// and spawnWall's traffic law, which the first cut of this function skipped:
// no live inbound drone may ARRIVE inside the wall's dangerous life, because a
// red parked on a dead zone is unanswerable by construction. The swarm cadence
// overlaps waves in the pipe, so a latch dropped with wave N+1 must hop around
// wave N's drones still flying in (clearOfWalls covers the other direction:
// new seats route around standing walls).
function leechLatchAngle() {
  const g2 = geo();
  const LIFE = 0.9 + 3 + 0.6; // telegraph + burn + detour buffer (spawnWall's contract)
  let th = nodes[Math.random() < 0.5 ? 0 : 1].angle + (Math.random() < 0.5 ? -1 : 1) * rand(0.55, 1.0);
  for (let k = 0; k < 10; k++) {
    const clash = enemies.some(en => {
      if (en.dead || en.resolved || en.failed) return false;
      // a live ribbon meanders — its whole ride corridor must stay reachable
      if (en.type === 'strip') return wallBlocks(angDiff(en.angle, th), 0.5, 0.5);
      const tArr = (en.z - g2.hitZ) / (trafficSpeed * (en.speedMul || 1));
      return tArr > -0.5 && tArr < LIFE && wallBlocks(angDiff(en.angle, th), 0.5);
    });
    if (!clash && latchFreeArc(th) >= LEECH_LATCH_ARC) return th;
    th += 2.399963; // deterministic golden hop, like clearOfWalls
  }
  return null;
}
// THE SWARM. A leech never shoots — it RELEASES: drone waves the pulse economy
// runs on. The fairness contract is the intrusion wave's, kept whole: at most
// TWO hostiles share an arrival window (one per node), window partners land a
// half-ring apart so both are reachable, windows arrive staggered down the
// pipe — and same-colour locks never share a window, because one node cannot
// be in two places when both seats arrive together.
// opts: { locks: p(colour-locked), purple: p(pressure drone), latch: ride-along wall }
function leechWave(n, opts) {
  opts = opts || {};
  if (opts.latch) { // the wall lands first so the wave spawns around it (reachability law)
    const th = leechLatchAngle();
    if (th !== null) {
      latches.push({ a: th, span0: 0.5, t: 0, dur: 3, tele: 0.9, arm: 0.4, z0: SPAWN_Z });
      tone(1180, 0.02, 'square', 0.05); tone(1180, 0.02, 'square', 0.05, null, null, 0.22);
    }
  }
  const gapZ = 0.85 * (LV.speed || 0.5) * (mutLive('fast') ? 1.35 : 1);
  const GAP = 0.55; // seconds of arrival separation that reads as "same moment"
  let prevA = Math.random() * TAU;
  let seatLock; // the window partner's colour, so a pair can never double-book a node
  for (let k = 0; k < n; k++) {
    let a;
    if (k & 1) { // seat 2: opposite-ish — and NEVER stacked on the partner,
      a = clearOfWalls(prevA + Math.PI + rand(-0.6, 0.6)); // even when a wall
      for (let h = 0; h < 6 && Math.abs(angDiff(a, prevA)) < 1.2; h++)
        a = clearOfWalls(a + 2.399963); // hop shifted it — hop until honestly apart
    } else a = clearOfWalls(prevA + 2.4 + rand(-0.4, 0.4)); // fresh window: hop onward
    // the colour economy: the machine decides which orb your kills may feed.
    // A lock feeds only its own node's orb; a purple pressure drone feeds NOTHING.
    let lock;
    if (opts.locks && Math.random() < opts.locks) {
      lock = Math.random() < 0.5 ? 0 : 1;
      if ((k & 1) && seatLock === lock) lock = 1 - lock; // partners never share a colour
    }
    let purple = lock === undefined && !!opts.purple && Math.random() < opts.purple;
    // THE LEDGER IS THE LAW, across waves as well as within one. The cadence
    // overlaps waves in the pipe, so a seat must book against EVERYTHING still
    // inbound, not just its own wave's partner: spawnAllowed's window
    // arithmetic (≤2 per window, a strip leaves only one free seat), the lock
    // laws (a colour never double-books its node; nothing keyed shares a
    // ribbon's window) — and the purple law: a pressure drone NEVER shares a
    // window with a keyed one. A lock binds one named thumb and a purple
    // demands the other, which books both hands into upkeep with zero charge
    // income — legal by coverage, unfair by economy. When a window can't hold
    // the flavour, the flavour demotes to plain; when it can't hold the SEAT,
    // the seat slides a slot deeper down the pipe.
    //
    // AND THE GRID IS THE LAW'S FLOOR. The pairwise windowMates arithmetic has
    // a blind spot the overlapping cadence exposes: two legal pairs booked
    // 0.3s apart chain into a three-demand squeeze no single pair ever sees.
    // So every seat of every wave snaps its ARRIVAL to one boss-wide grid
    // (one slot = one window): windows either coincide exactly — refereed by
    // the ledger — or sit a full slot apart. The chain cannot be built.
    const spd = LV.speed || 0.5;
    const slotT = gapZ / spd; // one window of pipe, in seconds of arrival
    const horizonT = levelT + (SPAWN_Z - geo().hitZ) / spd;
    let tick = Math.ceil((horizonT + (k >> 1) * slotT) / slotT - 1e-6);
    let tSeat = 0, seatOK = false;
    for (let h = 0; h < 8; h++, tick++) {
      const tArr = tick * slotT;
      if (tArr < horizonT - 1e-6) continue; // never shallower than the horizon
      const mates = sched.filter(s => tArr > s.t0 - GAP && tArr < s.t1 + GAP);
      const strips = mates.filter(s => s.type === 'strip').length;
      // a booked purple OWNS every slot inside its exclusive stretch — slide past it
      if (sched.some(s => s.purple && tArr > s.t0 - PURPLE_CLEAR && tArr < s.t1 + PURPLE_CLEAR)) continue;
      if (mates.length - strips >= (strips ? 1 : 2)) continue; // slot full — next one
      if (lock !== undefined && mates.some(s => s.lock === lock || s.type === 'strip')) lock = undefined;
      // and a CANDIDATE purple needs its whole stretch already empty — both
      // thumbs will converge on it, so nothing may arrive nearby, before or
      // after. A stretch with traffic in it turns the drone plain instead.
      if (purple && sched.some(s => tArr > s.t0 - PURPLE_CLEAR && tArr < s.t1 + PURPLE_CLEAR)) purple = false;
      // THE SPLIT LAW, slot-aware. The half-ring rule above only paired a seat
      // with its own wave's partner — but a slot can be shared ACROSS waves,
      // and slot-mates whose angles were never coordinated can arrive
      // near-stacked (one node asked twice). Hop until honestly apart from
      // every live same-slot mate, or give the slot up and slide on.
      const zAt = geo().hitZ + (tArr - levelT) * spd;
      let apart = true;
      for (let h2 = 0; h2 < 6; h2++) {
        apart = enemies.every(e2 => e2.dead || e2.resolved || e2.failed || e2.type === 'strip'
          || Math.abs(e2.z - zAt) / spd >= GAP
          || Math.abs(angDiff(e2.angle, a)) >= 1.2);
        if (apart) break;
        a = clearOfWalls(a + 2.399963);
      }
      if (!apart) continue; // this slot cannot be split honestly — next one
      tSeat = tArr; seatOK = true;
      break;
    }
    if (!seatOK) continue; // no legal slot within reach — the wave thins by one
    const en = spawnEnemy(a, 'normal');
    en.lock = lock; en.drift = 0;
    en.z = geo().hitZ + (tSeat - levelT) * spd; // seated on its grid slot, deep in the pipe
    if (purple) en.noCharge = true; // pure pressure: zappable by either node, worth nothing
    // re-book at the TRUE arrival: spawnEnemy booked a horizon arrival, but
    // this seat rides deeper — a ledger with wrong times can't referee the
    // next wave (patch the booking spawnEnemy just made, like fireBeat does)
    const bk = sched[sched.length - 1];
    bk.t0 = bk.t1 = tSeat;
    bk.lock = lock; bk.needsNode = lock !== undefined;
    if (purple) bk.purple = true;
    if (!(k & 1)) { prevA = a; seatLock = lock; }
  }
}
// the swarm cadence: release when the lane runs dry, or on the clock —
// whichever comes first. Waves thicken with every hit landed.
function runSwarm(b, dt, opts) {
  b.waveT -= dt;
  const live = enemies.some(e => !e.dead && !e.resolved && !e.failed && e.type !== 'strip');
  if (b.waveT > 0 && live) return;
  b.waveT = LEECH_WAVE_GAP + rand(0, 0.8);
  const r = bossRound(b);
  leechWave(Math.min(9, (opts.n0 || 5) + r), {
    locks: opts.locks, purple: opts.purple,
    latch: opts.latch !== undefined ? opts.latch : r >= 3
  });
  // NO SOUND ON A RELEASE. The first wave lands on the duel's opening frame, so
  // this crackle WAS the encounter's start sound — the last synth noise standing
  // between the ceremony and a proper 'boss incoming' take (Gil, 2026-08-12).
  // The popup says it, the drones arriving say it louder, and the moment is now
  // free for a recorded cue.
  popup(W / 2, H * 0.3, 'SWARM RELEASED', '#d465ff');
}
// A LIGHT IS KEYED TO ONE EMITTER — the beacon's law, kept whole: a beam
// carries `phase` (0 blue / 1 white) and only ever fries its matching
// carriage. The other may sit in the light all day; that is what makes the
// colour worth reading, and what frees a thumb to work.
function startSweeps(b, list) {
  b.beams = list.map(cfg => ({
    a: cfg.a !== undefined ? cfg.a : Math.random() * TAU,
    dir: cfg.dir !== undefined ? cfg.dir : (Math.random() < 0.5 ? -1 : 1),
    spd: cfg.spd, phase: cfg.phase, swept: 0, done: false,
    rev: cfg.rev, reversed: false, warn: false
  }));
}
// advance live sweeps + fry checks; returns true when every rotation completed
function bossBeams(b, dt, g) {
  const railR = g.nodeR - Math.min(W, H) * 0.055 * 0.86;
  let allDone = b.beams.length > 0;
  for (const bm of b.beams) {
    if (bm.done) continue;
    // THE BURST: the ray erupts before it turns — no rotation and NO FRY until
    // the light has visibly reached the ring (WYSIWYG danger, held during birth)
    bm.liveT = (bm.liveT || 0) + dt;
    if (bm.liveT < BEAM_BURST) { allDone = false; continue; }
    // the telegraphed mid-sweep reversal: chevrons flip (warn) well before the
    // light does — an unannounced turn would be a coin toss, not a read
    bm.warn = bm.rev !== undefined && !bm.reversed && bm.swept >= bm.rev * TAU - 0.6;
    if (bm.rev !== undefined && !bm.reversed && bm.swept >= bm.rev * TAU) {
      bm.reversed = true; bm.dir *= -1;
      popup(W / 2, H * 0.34, 'SWEEP REVERSED', NODE_HEX[bm.phase]);
      tone(240, 0.2, 'sawtooth', 0.1, 120);
      buzz(15);
    }
    const dA = bm.spd * dt;
    bm.a += dA * bm.dir;
    bm.swept += dA;
    // ONLY THE CONDEMNED CARRIAGE FRIES — the light wears the emitter it hunts
    const n = nodes[bm.phase];
    if (n.deadT <= 0 && Math.abs(angDiff(n.angle, bm.a)) < SWEEP_BEAM_HALF) {
      n.deadT = 2;
      fryDrain(bm.phase); // the fry tax: the light sets your shot back too
      const px2 = g.cx + Math.cos(n.angle) * railR, py2 = g.cy + Math.sin(n.angle) * railR;
      burst(px2, py2, '#ff9a3c', 22, 4);
      popup(px2, py2 - 24, 'EMITTER FRIED', '#ffb478');
      sfx.fry(Math.cos(n.angle) * 0.6);
      redFlash = Math.max(redFlash, 0.5);
      shake = Math.min(shake + 0.5, 1);
      buzz([40, 30, 60]);
    }
    if (bm.swept < TAU) allDone = false;
    else {
      bm.done = true;
      // THE RETREAT: the spent light fades back into the machine. The fight
      // machinery clears b.beams the moment a rotation set completes, so the
      // retraction rides its own short-lived list (advanced in updateBossFight).
      (b.beamFx = b.beamFx || []).push({ a: bm.a, phase: bm.phase, dying: 0 });
    }
  }
  return allDone;
}
// reds trickled under a sweep, one at a time: the free thumb gets work, but a
// clump would be unanswerable by the single emitter allowed to deal with it
function sweepTrickle(b, dt) {
  if (b.sweepAdds <= 0) return;
  b.addT -= dt;
  if (b.addT > 0) return;
  // the ledger applies here too: a trickled red arriving into an already-full
  // window (wave leftovers still inbound) — or into a purple's exclusive
  // stretch — would be a demand the thumbs can't answer. Hold and retry.
  const tA2 = levelT + arrivalAt(SPAWN_Z, 1);
  const mates = windowMates(arrivalAt(SPAWN_Z, 1), 0.55);
  const strips = mates.filter(s => s.type === 'strip').length;
  if (mates.length - strips >= (strips ? 1 : 2)
    || sched.some(s => s.purple && tA2 > s.t0 - PURPLE_CLEAR && tA2 < s.t1 + PURPLE_CLEAR)) { b.addT = 0.25; return; }
  b.addT = SWEEP_ADD_GAP;
  b.sweepAdds--;
  b.addA = clearOfWalls(b.addA + 2.399963 + rand(-0.35, 0.35)); // hop onward, never stacked
  const en = spawnEnemy(b.addA, 'normal');
  en.lock = undefined; en.drift = 0;
}
// THE MIMIC'S LAMP: hold, blink, flip — and NEVER while a pulse is in flight,
// so the shot you committed to is judged by the colour you committed at
function runLamp(b, dt) {
  if (pulseWaves.some(wv => wv.z < b.z)) return; // locked: a wave is riding
  if (b.lampBlink > 0) {
    b.lampBlink -= dt;
    if (b.lampBlink <= 0) {
      b.lamp = 1 - b.lamp;
      // NO extra last-stand shrink any more: the hunting light IS the
      // desperation — a twitchier lamp on top of it was one read too many
      const shrink = Math.max(0.55, 1 - bossRound(b) * 0.06);
      b.lampT = rand(LAMP_HOLD[0], LAMP_HOLD[1]) * shrink;
      popup(W / 2, H * 0.3, (b.lamp === 0 ? 'BLUE' : 'WHITE') + ' KEY', NODE_HEX[b.lamp]);
      tone(b.lamp === 0 ? 520 : 660, 0.12, 'sine', 0.07, b.lamp === 0 ? 400 : 520);
      buzz(10);
    }
    return;
  }
  b.lampT -= dt;
  if (b.lampT <= 0) b.lampBlink = LAMP_BLINK;
}
// ---------- the five fights ----------
// THE WARP LEECH — the teaching boss. It asks nothing new: zap, bank, tap.
// The lesson is the verb itself, so the only pressure is the swarm — thicker
// and wall-ridden as it loses plates, never a second system to read.
function updateLeechFight(dt, g) {
  runSwarm(boss, dt, { n0: 5 });
}
// THE SIPHON — the beacon's sweep, re-armed: one colour-keyed light condemns
// one emitter while the OTHER earns the shot. Phases alternate what the free
// thumb does: even rounds hang a stream in the lane (a full ride banks a full
// orb), odd rounds trickle reds to zap. Two thumbs, two different jobs.
function updateSiphonFight(dt, g) {
  const b = boss;
  b.modeT -= dt;
  if (b.mode === 'idle' || b.mode === 'tele') {
    if (b.mode === 'idle') {
      b.mode = 'tele'; b.modeT = 1.7;
      const r = bossRound(b);
      startSweeps(b, [{
        phase: Math.random() < 0.5 ? 0 : 1,
        spd: TAU / Math.max(4.0, 5.8 - r * 0.45),
        dir: (r & 1) ? 1 : -1
      }]);
    }
    if (b.modeT <= 0) {
      b.mode = 'sweep';
      const bm = b.beams[0];
      const r = bossRound(b);
      popup(W / 2, H * 0.3, (bm.phase === 0 ? 'BLUE' : 'WHITE') + ' EMITTER CONDEMNED', NODE_HEX[bm.phase]);
      tone(180, 0.5, 'sawtooth', 0.13, 90);
      crackle(0.5, 400, 2600, 2, 0.5);
      buzz([30, 30, 50]);
      if (r & 1) { // odd rounds: reds for the free thumb
        b.sweepAdds = 2 + Math.min(3, r);
        b.addT = 0.45;
      } else { // even rounds: the stream — steal it back
        spawnStrip();
        popup(W / 2, H * 0.36, 'STREAM IN THE LANE — RIDE IT', '#ffd24a');
      }
    }
    return;
  }
  if (b.mode === 'sweep') {
    sweepTrickle(b, dt);
    if (bossBeams(b, dt, g)) {
      b.beams = [];
      b.mode = 'calm'; b.modeT = 10; // the window to finish the charge and fire
    }
    return;
  }
  // calm: clear what is left (or wait out the timeout) to face the next light
  const live = enemies.some(e => !e.dead && !e.resolved && !e.failed && e.type !== 'strip');
  if ((!live && !latches.length) || b.modeT <= 0) {
    b.mode = 'idle';
    tone(960, 0.04, 'sine', 0.06); tone(960, 0.04, 'sine', 0.06, null, null, 0.16);
  }
}
// THE PRISM — it splits the light: TWO beams, one per colour, each frying only
// its own emitter. Two parallel solo-dodges by construction (no cross-trap is
// possible), so the teeth are elsewhere: unequal speeds, opposite directions,
// and a telegraphed mid-sweep reversal that punishes autopilot. Charging
// happens in the calms, against a swarm.
function updatePrismFight(dt, g) {
  const b = boss;
  b.modeT -= dt;
  if (b.mode === 'idle' || b.mode === 'tele') {
    if (b.mode === 'idle') {
      b.mode = 'tele'; b.modeT = 1.7;
      const r = bossRound(b);
      startSweeps(b, [
        { phase: 0, spd: TAU / Math.max(3.8, 6.0 - r * 0.35), dir: -1 },
        { phase: 1, spd: TAU / Math.max(3.8, 4.8 - r * 0.35), dir: 1,
          rev: r >= 2 ? 0.45 + Math.random() * 0.25 : undefined } // the faster light learns to turn
      ]);
    }
    if (b.modeT <= 0) {
      b.mode = 'sweep';
      popup(W / 2, H * 0.3, 'TWIN SWEEP — EACH LIGHT HUNTS ITS OWN', '#eab8ff');
      tone(180, 0.5, 'sawtooth', 0.13, 90);
      crackle(0.5, 400, 2600, 2, 0.5);
      buzz([30, 30, 50]);
      // both thumbs are dodging: the double sweep stays clean until late rounds
      b.sweepAdds = bossRound(b) >= 3 ? 2 : 0;
      b.addT = 1.2;
    }
    return;
  }
  if (b.mode === 'sweep') {
    sweepTrickle(b, dt);
    if (bossBeams(b, dt, g)) {
      b.beams = [];
      b.mode = 'adds'; b.modeT = 14; // the charge window: a swarm to feed on
      leechWave(4 + Math.min(4, bossRound(b)), { latch: bossRound(b) >= 2 });
      popup(W / 2, H * 0.3, 'SWARM RELEASED', '#d465ff'); // silent, like runSwarm's
    }
    return;
  }
  const live = enemies.some(e => !e.dead && !e.resolved && !e.failed && e.type !== 'strip');
  if ((!live && !latches.length) || b.modeT <= 0) {
    b.mode = 'idle';
    tone(960, 0.04, 'sine', 0.06); tone(960, 0.04, 'sine', 0.06, null, null, 0.16);
  }
}
// THE MIMIC — the lamp picks the pulse: only the matching colour lands, and
// the swarm is the charge economy weaponized. Locked drones feed only their
// own node's orb — so target selection IS the fight: kill for the orb the
// lamp is asking for, before it blinks.
//
// NO PURPLE HERE. Pressure drones were in the first cut and Gil pulled them
// (2026-08-11): with a lamp to read and keys to sort, a third drone class
// over-freighted the screen. Plain reds carry the slack — they pressure the
// lane AND feed either orb, which keeps the fight about the lamp. The
// noCharge mechanic itself stays wired (leechWave's purple law included) for
// a future machine with a quieter screen.
function updateMimicFight(dt, g) {
  const b = boss;
  runLamp(b, dt);
  runSwarm(b, dt, {
    n0: 5,
    // at the blockade's LAST STAND the swarm runs PLAIN and the walls stop:
    // the lamp and its hunting light are the whole read. A plain red feeds
    // WHOEVER zaps it, so banking the key becomes choosing the thumb — worked
    // in the light's shadow — instead of chasing colours under a ray.
    locks: b.lastStand ? 0 : 0.6,
    latch: bossRound(b) >= 4 && !b.lastStand
  });
}
// THE BLOCKADE — the last machine is every machine: four layers, outermost
// first, each a pattern the campaigns already taught (swarm, siphon, prism,
// mimic), 1+2+3+3 pulses through them. At one hp it stops layering and spends
// everything: fast lamp plus a sweep keyed to the lamp's own colour.
function updateBlockadeFight(dt, g) {
  const b = boss;
  if (b.mode === 'shed') { // the stagger between layers — it re-arms, you breathe
    b.modeT -= dt;
    if (b.modeT <= 0) { b.mode = 'idle'; b.modeT = 0; }
    return;
  }
  if (b.phase === 0) runSwarm(b, dt, { n0: 5, latch: false });
  else if (b.phase === 1) updateSiphonFight(dt, g);
  else if (b.phase === 2) updatePrismFight(dt, g);
  else if (!b.lastStand) updateMimicFight(dt, g);
  else updateLastStand(dt, g);
}
// THE LAST STAND — the finale's own machine (Gil's design, 2026-08-11): the
// kill shot takes BOTH keys fired as one, so both orbs must be full at once.
// The arithmetic that makes that possible IS the fight: one ray condemns one
// emitter while a SINGLE-FILE line of drones arrives keyed to the other — the
// free thumb charges ITSELF while the condemned thumb runs. Every rotation the
// light swaps sides, so the two orbs fill in alternating shifts. A line, never
// window pairs: one thumb is always busy dodging, and two seats in a window
// would ask three hands of a player who has two.
function updateLastStand(dt, g) {
  const b = boss;
  b.modeT -= dt;
  if (b.mode !== 'tele' && b.mode !== 'sweep') { // arm the next shift — and SWAP
    b.lsPhase = b.lsPhase === undefined ? (Math.random() < 0.5 ? 0 : 1) : 1 - b.lsPhase;
    b.mode = 'tele'; b.modeT = 1.2;
    startSweeps(b, [{ phase: b.lsPhase, spd: TAU / 5.2 }]);
    popup(W / 2, H * 0.34,
      (b.lsPhase === 0 ? 'BLUE RUNS — WHITE FEEDS' : 'WHITE RUNS — BLUE FEEDS'),
      NODE_HEX[1 - b.lsPhase]);
    tone(180, 0.5, 'sawtooth', 0.13, 90);
    buzz([30, 30, 50]);
    return;
  }
  if (b.mode === 'tele') { // the ghost line aims; the shift's colours are set
    if (b.modeT <= 0) b.mode = 'sweep';
    return;
  }
  lastStandLine(b, dt);     // the feeding line flows only while the light does
  if (bossBeams(b, dt, g)) { b.beams = []; b.mode = 'idle'; } // shift over — swap next
}
// the line: single-file drones keyed to the FREE node, on the ledger. Strictly
// one per window — the trickle's own spacing plus an empty-window demand.
function lastStandLine(b, dt) {
  b.addT = (b.addT === undefined ? 0.6 : b.addT) - dt;
  if (b.addT > 0) return;
  const mates = windowMates(arrivalAt(SPAWN_Z, 1), 0.55);
  if (mates.length >= 1) { b.addT = 0.25; return; } // single-file: the window must be EMPTY
  b.addT = SWEEP_ADD_GAP;
  b.addA = clearOfWalls(b.addA + 2.399963 + rand(-0.35, 0.35)); // hop onward, never stacked
  const en = spawnEnemy(b.addA, 'normal');
  en.lock = 1 - b.lsPhase; en.drift = 0; // keyed to the free thumb — it feeds itself
  const bk = sched[sched.length - 1];    // and the ledger knows what it is
  bk.lock = en.lock; bk.needsNode = true;
}
function updateBossFight(dt, g) {
  const b = boss;
  const bd = BOSS_DEFS[b.kind];
  b.spin += dt * 2;
  b.hurtT = Math.max(0, b.hurtT - dt);
  b.shieldT = Math.max(0, b.shieldT - dt);
  // hold the track down under the arrival take (see ARRIVAL_DUCK). Re-asserted
  // every frame rather than set once, because musicDuck decays on its own —
  // letting go is what releases the music, and it releases smoothly for free.
  if (b.duckT > 0) { b.duckT -= dt; musicDuck = 1; }
  if (b.beamFx && b.beamFx.length) { // spent light retreating into the mouth
    for (const f3 of b.beamFx) f3.dying += dt;
    b.beamFx = b.beamFx.filter(f3 => f3.dying < BEAM_FADE);
  }
  // ARRIVAL CEREMONY — the truth surfaces: the machine rises out of the deep,
  // claims the centre, DRINKS whatever charge you were carrying, speaks — and
  // only then does the duel begin
  if (b.introT < BOSS_CER) {
    b.introT = Math.min(BOSS_CER, b.introT + dt);
    const q = b.introT / BOSS_CER;
    b.z = lerp(1.55, 0.5, 1 - Math.pow(1 - q, 2));
    b.ang += dt * 0.35;
    b.rad = 0.12 * (1 - q); // it claims the exact centre
    b.u = Math.cos(b.ang) * b.rad;
    b.v = Math.sin(b.ang) * b.rad;
    const brg0 = ring(b.z, g);
    b.sx = brg0.x + b.u * brg0.r; b.sy = brg0.y + b.v * brg0.r;
    b.sSize = Math.min(W, H) * 0.30 * brg0.s;
    // THE DRINK. Orbs banked on the lane drain off the pads as it arrives —
    // every duel starts with the economy at zero, and the leech is WHY: it
    // drinks charge, that is what a leech is. Guarantees the fight's pacing
    // (six earned cycles) instead of letting two banked orbs skip a third of it.
    let drank = false;
    for (let i = 0; i < 2; i++) {
      if (pulseCharge[i] > 0) {
        pulseCharge[i] = Math.max(0, pulseCharge[i] - dt * PULSE_MAX / 1.2);
        drank = true;
      }
    }
    // THE ARRIVAL IS QUIET NOW (Gil's call, 2026-08-12). It used to carry a
    // 2.6s synth drone + crackle, the bossOnline() sting, a sawtooth stab, and
    // TWO haptic jolts — a stack of synthesised noise announcing a machine that
    // announces itself perfectly well on the ring. The picture, the WARD line
    // and the lane's own music carry it; nothing here plays a note or buzzes.
    if (drank && !b.drankSaid && b.introT > 0.8) {
      b.drankSaid = true;
      popup(W / 2, H * 0.36, 'IT DRINKS YOUR CHARGE', '#d465ff');
    }
    if (!b.cer2 && b.introT > 1.5) { // the lamp ignites; it speaks
      b.cer2 = true;
      // WARD: every package defines WARD as 'the interdiction' in the family's
      // own violet — the one voice all five machines share
      commCur = { s: 'WARD', m: bd.speak }; commT = 0;
    }
    if (b.introT >= BOSS_CER) {
      popup(W / 2, H * 0.30, bd.online, '#d465ff');
      shake = 1; // the world still lurches — that is picture, not noise
    }
    return;
  }
  // DEATH CEREMONY
  if (b.dying !== undefined) { updateBossDeath(dt, g); return; }
  leechHold(b, dt, g);
  if (b.kind === 'leech') updateLeechFight(dt, g);
  else if (b.kind === 'siphon') updateSiphonFight(dt, g);
  else if (b.kind === 'prism') updatePrismFight(dt, g);
  else if (b.kind === 'mimic') updateMimicFight(dt, g);
  else updateBlockadeFight(dt, g);
}
// the machine dies like a star: convulsions, plates torn away one by one, the
// lamp guttering out, implosion, shockwave — the world runs at quarter speed
function updateBossDeath(dt, g) {
  const b = boss;
  b.dying += dt;
  b.hurtT = 0.1;
  b.sx += Math.sin(time * 47) * b.sSize * 0.06;
  b.sy += Math.cos(time * 41) * b.sSize * 0.05;
  if (b.dying > 0.3 + b.dyingN * 0.3 && b.dyingN < 6) { // plates tear away
    b.dyingN++;
    const pa = Math.random() * TAU;
    burst(b.sx + Math.cos(pa) * b.sSize * 1.2, b.sy + Math.sin(pa) * b.sSize * 0.8, '#d465ff', 24, 6);
    crackle(0.2, 1800, 300, 3, 0.6);
    tone(220 - b.dyingN * 20, 0.15, 'square', 0.1, 90);
    shake = Math.min(shake + 0.4, 1);
    buzz(20);
  }
  // the take goes in EARLY, so its blast and the implosion are one event
  if (!b.deadSfx && b.dying >= BOSS_BOOM_AT - BOSS_DEAD_IMPACT) {
    b.deadSfx = sfx.bossDeadTake() ? 'take' : 'none';
  }
  if (!b.boom && b.dying > BOSS_BOOM_AT) { // the implosion lets go
    b.boom = true;
    burst(b.sx, b.sy, '#ffffff', 60, 8);
    burst(b.sx, b.sy, '#d465ff', 50, 6);
    burst(b.sx, b.sy, '#ff9a3c', 30, 7);
    if (b.deadSfx !== 'take') sfx.bossDown(); // the take never decoded — synth it here instead
    shake = 1;
    buzz([80, 40, 120], { strong: 1, weak: 1 }); // the kill
  }
  if (b.dying > 3.2) { // the case closes — verdict, then the report
    boss = null;
    commCur = { s: 'CMD', m: 'leech down. the lane is yours — bring it home, runner.' }; commT = 0;
    showCard('verdict');
  }
}
// the beam is a straight screen-space ray: from the cannon toward where the
// stick-deflected direction exits the tunnel (far end or wall). Hit testing
// runs against this exact ray, so what you see is what you hit.
// (parked ray-cannon machinery — see docs/parked/RAY-CANNON.md)
function beamGeometry(g) {
  const z0 = g.hitZ;
  const railR = g.nodeR - Math.min(W, H) * 0.055 * 0.86;
  const A = nodes[0].angle;
  const sx = g.cx + Math.cos(A) * railR, sy = g.cy + Math.sin(A) * railR;
  const u0x = Math.cos(A), u0y = Math.sin(A);
  let zExit = 1.0;
  for (let z = z0 + 0.02; z < 1; z += 0.02) {
    if (Math.hypot(u0x + beamAim.x * BEAM_S * (z - z0), u0y + beamAim.y * BEAM_S * (z - z0)) > 1.02) { zExit = z; break; }
  }
  const rg = ring(zExit, g);
  const tx = rg.x + (u0x + beamAim.x * BEAM_S * (zExit - z0)) * rg.r;
  const ty = rg.y + (u0y + beamAim.y * BEAM_S * (zExit - z0)) * rg.r;
  return { sx, sy, tx, ty, zExit, endS: rg.s / ring(z0, g).s };
}
// distance/reach test of the machine against the ray; null when clear
function beamHitCore(g) {
  const b = boss;
  const seg = beamGeometry(g);
  const dx = seg.tx - seg.sx, dy = seg.ty - seg.sy;
  const len = Math.hypot(dx, dy) || 1;
  const t = ((b.sx - seg.sx) * dx + (b.sy - seg.sy) * dy) / len;
  const perp = Math.abs((-dy * (b.sx - seg.sx) + dx * (b.sy - seg.sy)) / len);
  if (t > 0 && seg.zExit >= b.z - 0.03 && perp < b.sSize * 1.25) return { seg, t: Math.min(t, len) };
  return null;
}

// ---------- particles ----------
function burst(x, y, color, n, spd) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * TAU, v = rand(0.3, 1) * spd;
    particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1, decay: rand(1.2, 2.6), color, size: rand(0.7, 1.8) });
  }
}
// the decompile: a killed hostile doesn't explode — the body GLITCHES OUT in
// place (its skin tears into displaced strips that flicker and drop away)
// while a translucent green wash ripples across the wall from the death
// point: the tunnel healing over where the corruption sat. Both live in
// (angle, z) wall space, so depth still tells the story.
// the tuning deck — once mirrored 1:1 by a slider lab, now the only copy.
// Tune these numbers directly.
const DECOMP = {
  rippleR: 0.50, // healed-wash reach along the ring (rad)
  rippleT: 0.60, // wash lifetime (s)
  fill: 0.04,    // wash fill alpha
  edge: 0.60,    // wash rim alpha
  glitchT: 0.40, // body de-rez time (s)
  slices: 6,     // glitch strips across the body
  jitter: 1.2,   // strip displacement, in body sizes
};
function decompile(a, z, en, mul) {
  const m = (mul || 1) * (en.sizeMul || 1) * (en.type === 'heavy' ? 1.3 : 1);
  z = Math.max(z, 0.02);
  ghosts.push({ a, z, t: 0, sizeMul: en.sizeMul || 1, pal: enemyPal(en),
    spr: en.noCharge ? null : SPRITES[en.lock === 0 ? 'lock0' : en.lock === 1 ? 'lock1' : en.type] });
  ripples.push({ a, z, t: 0, mul: Math.sqrt(m) });
}
function popup(x, y, text, color) { popups.push({ x, y, text, color, life: 1 }); }
// the kill streak: the enemy, REPROGRAMMED, launches forward as a single
// green tracer from wherever it died (angle + depth) — a bright head easing
// toward the horizon with a tapering tail, riding the wall like it did
// deep kills (volley bolts down the bore) pull the comet's start back inside
// the tunnel so the streak always gets its full run — killed at the horizon,
// the zip would otherwise clip out instantly and read as "no effect"
function spawnKillStreak(a, z) { killStreaks.push({ a, z: clamp(z, 0.05, SPAWN_Z - 0.75), t: 0 }); }
// the LAST hostile of a finished campaign level dies on a beat — every level
// ends like it means it (the boss has its own, bigger version)
function lastKillBeat(justKilled) {
  if (endless || qual || tut || boss || levelT < (LV || LEVELS[levelIdx]).duration) return;
  if (enemies.some(e => e !== justKilled && e !== justKilled.partner
      && !e.dead && !e.resolved && !e.failed && e.type !== 'strip')) return;
  hitStop = Math.min(hitStop + 0.5, 0.5);
  popup(W / 2, H * 0.36, 'LANE SECURED', '#7ee262');
  tone(784, 0.18, 'triangle', 0.1, 1046);
  tone(1046, 0.22, 'triangle', 0.08, 1568, null, 0.12);
  buzz([20, 30, 60]);
}
// THE FRY TAX. Anything that fries an emitter also bleeds its pulse orb —
// three points of banked charge, gone. Without this, sliding through a node
// killer or a dead zone (or eating a leech's light) cost only downtime, and
// downtime is cheap while the orb you were building sits untouched. Now every
// fry sets the SHOT back too, which is what makes the hazards worth respecting.
// Tutorial fries stay free: practice teaches the burn, it doesn't collect on it.
const FRY_DRAIN = 3;
function fryDrain(i) {
  if (pulseCharge[i] <= 0) return;
  const lost = Math.min(FRY_DRAIN, pulseCharge[i]);
  pulseCharge[i] = pulseCharge[i] - lost;
  // said on the pad that lost it — the meter's displayed level chases the truth
  // down (drawPulseOrbs), so the bleed reads as a drain, not a jump
  const d = dialCenter(i === 0 ? 'L' : 'R');
  popup(d.x, d.y - d.r * 0.7, 'CHARGE BLED −' + lost, NODE_HEX[i]);
}
// the shield: eats one breach that would cost integrity. Returns true if
// it fired — the caller skips the damage AND its red-alert dressing.
function shieldAbsorb(x, y, ang) {
  if (shieldCharge <= 0) return false;
  shieldCharge = 0;
  shieldFlashT = 0.5; // the sheath drains around the collar into the hit
  const g0 = geo();
  shieldHitA = ang !== undefined ? ang : Math.atan2(y - g0.cy, x - g0.cx);
  popup(x, y, 'SHIELD ABSORBED THE BREACH', '#8fe0ff');
  if (ang !== undefined) rimFX.push({ a: ang, t: 0.7, col: '143,224,255' });
  burst(x, y, '#8fe0ff', 22, 4);
  shake = Math.min(shake + 0.3, 0.8);
  sfx.shieldHit();
  buzz(20);
  return true;
}
