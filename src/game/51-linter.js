'use strict';
// ---------- fairness linter ----------
// lintLevel walks a level's whole spawn timeline — beats, bands and the
// seeded procedural filler — and reports violations of the 100%-completable
// law as [{ t, code, msg }]. PURE: it runs on its own mulberry32 built from
// the same seed the level would get, so the live spawnRng never advances and
// no game state is touched. Geometry uses a nominal hitZ (the real one moves
// ±0.02 with viewport aspect and never flips a verdict). Codes:
//   dual-conflict     two simultaneous demands both nodes can't cover
//   wall-conflict     an arrival left UNREACHABLE inside a dead zone (the
//                     reachability law: half-span + node tolerance; landed
//                     positions, so force-overridden beats are judged too)
//   lull-violation    a beat scheduled inside another beat's lull
//   comm-overlap      a beat arrival inside a comm window
//   unreachable-strip a bonus ride that forces a wall crossing or abandons
//                     a mandatory dual-node kill
function lintLevel(level, idx) {
  idx = idx || 0;
  const issues = [];
  const seenIss = new Set(); // one finding per moment (a barrier's two ends report as one)
  const bad = (t, code, msg) => {
    const key = code + '|' + msg + '|' + Math.round(t * 10);
    if (seenIss.has(key)) return;
    seenIss.add(key);
    issues.push({ t: Math.round(t * 100) / 100, code, msg });
  };
  const { arr, picks, walls } = lintWalk(level, idx);
  lintVerdicts(bad, level, arr, picks, walls);
  issues.sort((x, y) => x.t - y.t);
  return issues;
}
// the timeline walk behind the linter: a pure, draw-for-draw mirror of the
// live spawner (beats + bands + seeded filler) on its own mulberry32 — the
// live spawnRng never advances. Returns every arrival the level will make:
//   arr   [{t, t1, type, lock, needsNode, angle, pair, beat}]   beat === undefined -> filler
//   picks [{t, angle, beat}]
//   walls [{tRel, tLand, a, aA, beat}]   a = landed arc, aA = authored arc
// lintLevel's verdicts consume this walk; the Tunnel Designer also renders it
// (generated-filler lane, wall-relocation preview). Extracted from lintLevel
// verbatim — behavior identical.
function lintWalk(level, idx) {
  idx = idx || 0;
  const rng = mulberry32((0x51AB1E + idx * 7919) >>> 0);
  let R = rng; // active draw stream — beat firings swap in their side stream
  const dr = () => R();
  const drr = (a2, b2) => a2 + R() * (b2 - a2);
  const dch = p => R() < p;
  const hitZ = 0.25; // nominal viewport
  const lead = mul => (SPAWN_Z - hitZ) / (level.speed * (mul || 1));
  const trav = lead(1);
  const GAP = 0.55;
  const dur = level.duration;
  const beats = level.beats || [];
  const comms = level.comms || [];
  const arr = [];   // arrivals {t, t1, type, lock, needsNode, angle, pair, beat}
  const picks = []; // pickup arrivals {t, angle, beat}
  const walls = []; // {tRel, tLand, a, beat} — live on the rim tLand..tLand+3
  let sched2 = [];
  // --- mirrors of the live fairness helpers, on local state ---
  const liveWalls = tN => walls.filter(w => tN >= w.tRel && tN < w.tLand + 3);
  const cow = (a2, tN, extra) => { // clearOfWalls mirror — same reachability law
    const lw = liveWalls(tN);
    if (!lw.length) return a2;
    for (let k = 0; k < 8; k++) {
      if (!lw.some(w => wallBlocks(angDiff(w.a, a2), 0.5, extra))) break;
      a2 += 2.399963;
    }
    return a2;
  };
  let dropT = null; // early-clamped beat: shortened remaining travel (mirrors dropTravel)
  const mates = (tA, gap) => sched2.filter(s => tA > s.t0 - gap && tA < s.t1 + gap);
  const allow = (type, tN) => {
    const tNew = lead(type === 'heavy' ? 0.82 : 1);
    const tA = tN + tNew;
    if (type === 'heavy' || type === 'line') {
      if (type === 'heavy' && mates(tA, 2.4).some(s => s.type === 'heavy')) return false;
      return mates(tA, GAP * 1.5).length === 0;
    }
    if (type === 'strip') {
      const tA1 = tA + 0.9 / level.speed;
      for (const s of sched2) if (s.needsNode && s.t1 > tA - GAP && s.t0 < tA1 + GAP) return false;
      return mates(tA, GAP).length <= 1;
    }
    const m = mates(tA, GAP);
    if (m.some(s => s.type === 'heavy' || s.type === 'line')) return false;
    const strips = m.filter(s => s.type === 'strip').length;
    return m.length - strips < (strips ? 1 : 2);
  };
  const lockOk = (tN, lk) => {
    const m = mates(tN + lead(1), 0.55);
    if (m.some(s => s.type === 'strip')) return false;
    return !m.some(s => s.lock === lk);
  };
  // --- mirrors of the spawners: draw ORDER matches the live code exactly ---
  function simEnemy(cfg, tN, forcedA, type, beat) {
    type = type || 'normal';
    const heavy = type === 'heavy';
    if (type === 'normal') dr(); // the burned draw (see spawnEnemy)
    let lock = type === 'normal' && dch(cfg.colors || 0) ? (dch(0.5) ? 0 : 1) : undefined;
    if (lock !== undefined && !lockOk(tN, lock)) lock = lockOk(tN, 1 - lock) ? 1 - lock : undefined;
    const angle = forcedA !== undefined ? forcedA : cow(dr() * TAU, tN);
    dr(); // spin
    const tA = tN + (dropT !== null ? dropT : lead(heavy ? 0.82 : 1));
    const rec = { t: tA, t1: tA, type, lock, needsNode: type !== 'normal' || lock !== undefined, angle, beat };
    arr.push(rec);
    if (type !== 'strip')
      sched2.push({ t0: tA, t1: tA, type, lock, needsNode: rec.needsNode });
    return rec;
  }
  function simLine(cfg, tN, forcedA, beat, force) {
    let a2 = forcedA !== undefined ? forcedA : dr() * TAU;
    const gap = drr(0.8, 1.5) * (dch(0.5) ? -1 : 1);
    if (!force) a2 = cow(a2 + gap / 2, tN, Math.abs(gap) / 2) - gap / 2;
    const e1 = simEnemy(cfg, tN, a2, 'line', beat);
    const e2 = simEnemy(cfg, tN, a2 + gap, 'line', beat);
    e1.pair = e2; e2.pair = e1;
  }
  function simStrip(cfg, tN, beat) {
    const rec = simEnemy(cfg, tN, undefined, 'strip', beat);
    rec.angle = cow(rec.angle, tN, 0.5); // meander amplitude joins the bound
    const len = drr(0.5, 0.85);
    drr(0.22, 0.5); dch(0.5); drr(2.2, 4.2); drr(0, TAU); // amp/sign/frq/phase
    rec.t1 = rec.t + len / level.speed;
    sched2.push({ t0: rec.t, t1: rec.t1, type: 'strip', lock: undefined, needsNode: true });
    return rec;
  }
  function simWall(tN, forcedA, beat, force, tele) {
    let a2 = forcedA !== undefined ? forcedA : dr() * TAU;
    const auth = a2; // the AUTHORED arc — the clash hops below may move the real one
    const teleT = tele !== undefined ? tele : trav;
    const wallLife = teleT + 3 + 0.6;
    let clear2 = force || beat !== undefined; // authored dead zones stay and get reported
    for (let k = 0; !force && k < WALL_HOPS; k++) {
      const clash = arr.some(rec => {
        if (rec.type === 'strip') return tN < rec.t1 + 0.4 && wallBlocks(angDiff(rec.angle, a2), 0.5, 0.5);
        const tArr = rec.t - tN;
        return tArr > -0.5 && tArr < wallLife && wallBlocks(angDiff(rec.angle, a2), 0.5);
      }) || picks.some(p => {
        // mirror the live scan: an in-flight orb's landing arc joins the bound
        const tArr = p.t - tN;
        return tArr > -0.5 && tArr < wallLife && wallBlocks(angDiff(p.angle, a2), 0.5);
      });
      if (!clash) { clear2 = true; break; }
      a2 += 2.399963;
    }
    if (!clear2) return; // mirrors the live stand-down
    walls.push({ tRel: tN, tLand: tN + teleT, a: a2, aA: auth, beat });
  }
  // MIRROR OF THE SPACING LAW (PICKUP_GAP, 40-state). The walk has to refuse
  // exactly what the live spawner refuses, or the fairness verdicts describe a
  // lane nobody flies. lastPk is the walk's own copy of lastPickT.
  let lastPk = -1e9;
  const pkAllowed = tN => tN - lastPk >= PICKUP_GAP;
  function simPickup(tN, kind, beat) {
    lastPk = tN;
    if (kind === undefined) dr(); // kind roll
    // mirror the live clearance: the orb relocates off spawn-time dead zones
    picks.push({ t: tN + (dropT !== null ? dropT : lead(0.9)), angle: cow(dr() * TAU, tN), beat });
  }
  // --- mirrors of the drain law (trySpawn): on a boss level nothing launches
  // that cannot finish its whole ride before dur — same gate positions, so the
  // draw order stays aligned when a shut window falls through to the next roll
  const rl = mul => (SPAWN_Z - 0.03) / (level.speed * (mul || 1)); // rideLife mirror (RIDE_OUT = 0.03)
  const fits = (life, tN) => !level.boss || tN + life <= level.duration;
  // --- the run: same tick order as update() (spawner → beats → burst →
  // pickup clock → ribbon clock), same draw order as resetRun/trySpawn ---
  let pkT = drr(16, 24), rbT = drr(11, 15); // resetRun's opening draws
  let lvT = 0, spT = 0.01, bq = null; // first release on the first tick — the tunnel is never empty
  const fired = beats.map(() => false);
  beats.forEach((b, bi) => { // the same pre-bookings initBeats makes
    if (b.kind === 'enemy') {
      const lk = b.type === 'lock0' ? 0 : b.type === 'lock1' ? 1 : undefined;
      const ty = lk !== undefined ? 'normal' : (b.type || 'normal');
      sched2.push({ t0: b.t, t1: b.t, type: ty, lock: lk, needsNode: ty !== 'normal' || lk !== undefined, beat: bi });
    } else if (b.kind === 'strip') sched2.push({ t0: b.t, t1: b.t + 0.85 / level.speed, type: 'strip', lock: undefined, needsNode: true, beat: bi });
  });
  const dt = 1 / 60;
  while (lvT < dur) {
    lvT += dt;
    // filler release (trySpawn)
    spT -= dt;
    if (spT <= 0 && lvT < dur) {
      const tLand = lvT + trav;
      const cHit = comms.find(c => tLand > c.t - 0.5 && tLand < c.t + 3.2);
      let lWait = 0;
      const tL1 = lvT + trav / 0.82;
      for (const b of beats) if (b.kind === 'lull' && tL1 > b.t && tLand < b.t + b.dur)
        lWait = Math.max(lWait, b.t + b.dur + 0.05 - trav - lvT);
      const wait = Math.max(cHit ? cHit.t + 3.2 + 0.3 - trav - lvT : 0, lWait);
      if (wait > 0) spT = wait;
      else {
        sched2 = sched2.filter(s => s.t1 > lvT - 1.5); // same pruning as the live ledger
        const cfg = bandCfg(level, lvT);
        spT = drr(cfg.spawnMin, cfg.spawnMax);
        let done = false;
        if (cfg.bursts && !bq && dch(0.3) && fits(rl(1) + 0.7, lvT) && allow('line', lvT)) {
          bq = { left: 2, t: 0.35 }; simEnemy(cfg, lvT); spT += 0.9; done = true;
        }
        if (!done && dch(cfg.walls || 0) && !liveWalls(lvT).length && fits(trav + 3.6, lvT)) { simWall(lvT); done = true; }
        if (!done) {
          const roll = dr();
          if (roll < cfg.lines && fits(rl(1), lvT) && allow('line', lvT)) simLine(cfg, lvT);
          else if (roll < cfg.lines + cfg.heavies && fits(rl(0.82), lvT) && allow('heavy', lvT)) simEnemy(cfg, lvT, undefined, 'heavy');
          else if (!fits(rl(1), lvT)) { /* the drain law — the lane empties into the duel */ }
          else if (!allow('normal', lvT)) spT = Math.min(spT, 0.35);
          else {
            const a2 = cow(dr() * TAU, lvT);
            simEnemy(cfg, lvT, a2);
            if (dch(cfg.doubles) && allow('normal', lvT)) simEnemy(cfg, lvT, cow(a2 + Math.PI + drr(-0.6, 0.6), lvT));
          }
        }
      }
    }
    // beats (runBeats): released back-timed, sliding past comm windows;
    // early beats clamp at t≈0 with a shortened travel (dropT)
    for (let bi = 0; bi < beats.length; bi++) {
      if (fired[bi]) continue;
      const b = beats[bi];
      if (b.kind === 'lull') { if (lvT >= b.t) fired[bi] = true; continue; }
      const leadB = b.kind === 'wall' ? trav : b.kind === 'pickup' ? lead(0.9)
        : lead(b.kind === 'enemy' && b.type === 'heavy' ? 0.82 : 1);
      if (lvT < b.t - leadB) continue;
      const eff = b.t < leadB ? Math.max(0.4, b.t - lvT) : leadB;
      const tA = lvT + eff;
      if (comms.some(c => tA > c.t - 0.5 && tA < c.t + 3.2)) continue;
      fired[bi] = true;
      sched2 = sched2.filter(s => s.beat !== bi);
      R = beatStream(idx, bi);
      dropT = eff < leadB - 1e-9 ? eff : null;
      const a2 = b.angle !== undefined
        ? (b.force ? b.angle : cow(b.angle, lvT, b.kind === 'wall' ? 0.5 : 0))
        : undefined;
      if (b.kind === 'wall') simWall(lvT, a2, bi, b.force, dropT !== null ? dropT : undefined);
      else if (b.kind === 'strip') simStrip(bandCfg(level, lvT), lvT, bi);
      else if (b.kind === 'pickup') { if (!pkAllowed(lvT)) { fired[bi] = false; continue; } simPickup(lvT, b.type, bi); }
      else if (b.type === 'line') simLine(bandCfg(level, lvT), lvT, a2, bi, b.force);
      else if (b.type === 'lock0' || b.type === 'lock1') {
        let lk = b.type === 'lock1' ? 1 : 0;
        if (!lockOk(lvT, lk)) lk = lockOk(lvT, 1 - lk) ? 1 - lk : undefined;
        const rec = simEnemy(bandCfg(level, lvT), lvT, a2, 'normal', bi);
        rec.lock = lk; rec.needsNode = lk !== undefined;
        const s = sched2[sched2.length - 1];
        s.lock = lk; s.needsNode = rec.needsNode;
      }
      else simEnemy(bandCfg(level, lvT), lvT, a2, b.type || 'normal', bi);
      dropT = null;
      R = rng;
    }
    // burst replicants
    if (bq) {
      bq.t -= dt;
      if (bq.t <= 0) { simEnemy(bandCfg(level, lvT), lvT); bq.left--; bq.t = 0.35; if (!bq.left) bq = null; }
    }
    // pickup + ribbon clocks (ribbons only exist from level 5 up)
    pkT -= dt;
    if (pkT <= 0) {
      const wait = drr(20, 32); // spent either way — the guard sits AFTER the roll
      if (!pkAllowed(lvT)) pkT = PICKUP_GAP - (lvT - lastPk);
      else { pkT = wait; simPickup(lvT); }
    }
    if (idx >= 4) {
      rbT -= dt;
      if (rbT <= 0) {
        if (lvT < dur - 14 && allow('strip', lvT)) { rbT = drr(26, 40); simStrip(bandCfg(level, lvT), lvT); }
        else rbT = 2.5;
      }
    }
  }
  return { arr, picks, walls };
}
// --- verdicts: judge the walk; only beat-involved moments can be findings ---
function lintVerdicts(bad, level, arr, picks, walls) {
  const GAP = 0.55;
  const beats = level.beats || [];
  const comms = level.comms || [];
  // filler-vs-filler pairs already passed the live gates (the sim replays
  // them), so every check demands a BEAT party: beats bypass spawnAllowed and
  // are the only way to author an impossible moment. Windows are spawn-order
  // aware, mirroring the asymmetric live gates (a dual released later needs a
  // 0.825s-clear window; a single landing after a booked dual only needs 0.55)
  const isDual = r => r.type === 'heavy' || r.type === 'line';
  const host = arr.filter(r => r.type !== 'strip');
  const beaty = (...rs) => rs.some(r => r.beat !== undefined);
  for (let i = 0; i < host.length; i++) for (let j = i + 1; j < host.length; j++) {
    const a2 = host[i], b2 = host[j]; // arr is in spawn order
    if (a2.pair === b2 || !beaty(a2, b2)) continue;
    const d2 = Math.abs(a2.t - b2.t);
    if (a2.type === 'heavy' && b2.type === 'heavy' && d2 < 2.4)
      bad(b2.t, 'dual-conflict', 'two heavies inside one volley cycle');
    else if (isDual(b2) && d2 < GAP * 1.5)
      bad(b2.t, 'dual-conflict', 'both-nodes demand overlaps another arrival');
    else if (isDual(a2) && d2 < GAP)
      bad(b2.t, 'dual-conflict', 'arrival lands inside a both-nodes window');
    else if (a2.lock !== undefined && a2.lock === b2.lock && d2 < GAP)
      bad(b2.t, 'dual-conflict', 'same-color locks double-book one node');
  }
  // wall clearance — REACHABILITY (the designer's ruling, the law everywhere):
  // an arrival may share a live wall's window as long as its demanded dock arc
  // stays out of the dead zone (wallBlocks: half-span + node tolerance). Checked
  // on LANDED positions: relocation already saves unforced spawns, so findings
  // surface exactly what an OVERRIDE (force) or a late-landing wall swallowed.
  // Barrier ends are separate arrivals — a pair flags when EITHER demanded end
  // is swallowed; nodes route around any sub-π dead zone from either side, so a
  // clear dock arc is always attainable. Filler-vs-filler stays exempt (the live
  // gates replayed clean).
  const wallHit = (t2, ang) => walls.find(w =>
    t2 > w.tRel - 0.5 && t2 < w.tLand + 3.6 && wallBlocks(angDiff(w.a, ang), 0.5));
  for (const rec of arr) {
    if (rec.type === 'strip') continue;
    const w = wallHit(rec.t, rec.angle);
    if (w && (rec.beat !== undefined || w.beat !== undefined))
      bad(rec.t, 'wall-conflict', 'arrival unreachable inside a dead zone');
  }
  for (const p2 of picks) {
    const w = wallHit(p2.t, p2.angle);
    if (w && (p2.beat !== undefined || w.beat !== undefined))
      bad(p2.t, 'wall-conflict', 'power-up unreachable inside a dead zone');
  }
  // strips: the full ride must stay ownable and clear of walls
  for (const st of arr) {
    if (st.type !== 'strip') continue;
    for (const h of host) if (beaty(st, h) && h.needsNode && h.t1 > st.t - GAP && h.t < st.t1 + GAP) {
      bad(st.t, 'unreachable-strip', 'bonus ride overlaps a mandatory dual-node kill'); break;
    }
    // meander amplitude joins the reachability bound for rides
    for (const w of walls) if ((st.beat !== undefined || w.beat !== undefined) &&
      st.t1 > w.tLand && st.t < w.tLand + 3 && wallBlocks(angDiff(w.a, st.angle), 0.5, 0.5)) {
      bad(st.t, 'unreachable-strip', 'bonus ride crosses a dead zone'); break;
    }
  }
  // beats inside lulls / comm windows (authored times — the runtime slides
  // them late, which is exactly the surprise the author should fix)
  for (const l of beats) {
    if (l.kind !== 'lull') continue;
    for (const b of beats) if (b !== l && b.kind !== 'lull' && b.t > l.t && b.t < l.t + l.dur)
      bad(b.t, 'lull-violation', 'beat scheduled inside another beat\'s lull');
  }
  for (const b of beats) {
    if (b.kind === 'lull') continue;
    const c = comms.find(c2 => b.t > c2.t - 0.5 && b.t < c2.t + 3.2);
    if (c) bad(b.t, 'comm-overlap', 'beat arrival lands inside a comm window');
  }
}

// ---------- THE DRAIN LAW ----------
// On a boss level, the frame levelT crosses L.duration spawnBoss WIPES the
// bore (52-bosses: the lane clears) — so a body still in transit would blink
// out mid-bore, and a dead zone would vanish mid-burn. Nothing launches that
// cannot finish its WHOLE ride before that line (the pickup dropWindow's law,
// made per-ride: a missed trap flies past the ring all the way to z=0.03,
// armor rides at 0.82×, a dead zone needs its approach plus its 3s burn). Slow
// bodies stop first and plain traps keep landing almost to the line, so the
// lane thins naturally into the arrival ceremony instead of cutting to it.
// Guards sit AFTER each schance roll on purpose: the seeded stream advances
// identically whether a window is open or shut. lintWalk mirrors every gate
// in the same position (rl/fits), so the walk stays draw-for-draw.
const RIDE_OUT = 0.03; // the update filter retires a body past this depth
function rideFits(life) {
  const L0 = LV || LEVELS[levelIdx];
  return endless || !L0.boss || levelT + life <= L0.duration;
}
const rideLife = speedMul =>
  (SPAWN_Z - RIDE_OUT) / ((LV || LEVELS[levelIdx]).speed * (mutLive('fast') ? 1.35 : 1) * (speedMul || 1));
function trySpawn(dt) {
  spawnT -= dt;
  if (spawnT <= 0) {
    if (scripted()) {
      const wait = Math.max(storyHold(), lullHold());
      if (wait > 0) { spawnT = wait; return; } // hold the lane for the story / an authored lull
    }
    const L = bandCfg(LV || LEVELS[levelIdx], levelT); // bands may retune the knobs mid-level
    sched = sched.filter(s => s.t1 > levelT - 1.5); // drop long-past bookings
    // verifiable runs skip beat-quantize: music phase varies run to run, the drill
    // must land the same arrivals every time, and the server re-simulates with no
    // audio clock to read. See beatFree() — campaign and WEEKLY both qualify.
    const delay = srand(L.spawnMin, L.spawnMax);
    spawnT = beatFree() ? delay : beatQuantize(delay, travelTime());
    // beat-choreographed volley? (free-flow endless only — it reads the music clock,
    // and note spawnRng() is consumed INSIDE this condition, so a mode that must
    // reproduce cannot be allowed anywhere near it)
    if (!beatFree() && beatPeriod && musicSrc && !patternQ.length && spawnRng() < 0.2) {
      const pat = PATTERNS[(spawnRng() * PATTERNS.length) | 0];
      const base = spawnRng() * TAU;
      const trav = travelTime();
      const pos = AC.currentTime - musicStartAt;
      const first = Math.ceil((pos + trav + 0.3) / beatPeriod);
      for (const st of pat.steps) {
        patternQ.push({ t: (first + st.b) * beatPeriod - pos - trav, angle: clearOfWalls(base + st.da) });
      }
      spawnT += pat.steps.length * beatPeriod * 0.8; // give the volley room
      return;
    }
    // burst transmissions: occasionally a volley of three in rapid succession
    if (L.bursts && !burstQ && schance(0.3) && rideFits(rideLife(1) + 0.7) && spawnAllowed('line')) { // volleys start from a clean window
      burstQ = { left: 2, t: 0.35 };
      spawnEnemy();
      spawnT += 0.9; // breathe after a volley
      return;
    }
    // rim wall: the rail itself closes for a stretch — one at a time
    if (schance(L.walls || 0) && !latches.length && rideFits(travelTime() + 3.6)) { spawnWall(); return; }
    const roll = spawnRng();
    if (roll < L.lines && rideFits(rideLife(1)) && spawnAllowed('line')) { spawnLine(); return; }
    if (roll < L.lines + L.heavies && rideFits(rideLife(0.82)) && spawnAllowed('heavy')) { spawnEnemy(undefined, 'heavy'); return; }
    if (!rideFits(rideLife(1))) return; // the last window shut — the lane drains into the duel
    if (!spawnAllowed('normal')) { spawnT = Math.min(spawnT, 0.35); return; } // wait out the jam
    const a = clearOfWalls(spawnRng() * TAU);
    spawnEnemy(a);
    if (schance(L.doubles) && spawnAllowed('normal')) spawnEnemy(clearOfWalls(a + Math.PI + srand(-0.6, 0.6)));
  }
}
// rim wall: a hazard dead zone seizes part of the rail — telegraphed, then live
// for 3s while it burns off. Crossing it fries the node (node-killer, in area
// form).
// ---------- THE REACHABILITY LAW ----------
// a demanded node position is UNREACHABLE when it falls inside a wall's
// occupied arc: half-span + node zap tolerance (+ the demand's own extra —
// a ribbon's meander amplitude, a barrier's half-gap, a second wall's own
// half-span). This single bound IS the 100%-completable law around walls:
// spawns may coexist with a live dead zone as long as the player can still
// REACH them. The filler gates, beat firing, wall clash hops and the linter
// all share this one definition (the linter mirrors it via wallBlocks too).
const WALL_TOL = 0.3; // node zap tolerance margin
const WALL_HOPS = 8; // golden-angle attempts before a dead zone stands down
const wallBlocks = (d, span, extra) => Math.abs(d) < span + WALL_TOL + (extra || 0);
// keep a candidate angle reachable past every wall arc — deterministic
// golden-angle hops, no RNG consumed, so campaign replays stay identical
function clearOfWalls(a, extra) {
  if (!latches.length) return a;
  for (let k = 0; k < 8; k++) {
    if (!latches.some(lt => wallBlocks(angDiff(lt.a, a), lt.span0, extra))) break;
    a += 2.399963;
  }
  return a;
}

function spawnWall(forcedA, force, teleOverride, beatArc) { // beats may pin the arc; force = verbatim, no hops
  // (No first-encounter disc. Training already drills the rim wall, and the
  // dead zone telegraphs itself — a card here just stopped the run to repeat it.)
  let a = forcedA !== undefined ? forcedA : spawnRng() * TAU;
  const g2 = geo();
  const trav = travelTime(); // the dead zone is world traffic: horizon to rim at stream speed
  const tele = teleOverride !== undefined ? teleOverride : trav; // early-clamped beats bite sooner
  const wallLife = tele + 3 + 0.6; // approach + burn + detour buffer
  // A DEAD ZONE THAT FINDS NO CLEAR ARC STANDS DOWN. The hop loop breaks on success
  // and simply fell out on failure, so an exhausted search used its last hop
  // UNCHECKED — the dead zone parked on whatever was there. It went unnoticed while
  // the eight golden-angle steps happened to succeed; the power-up spacing law
  // moved filler orbs into new windows and two lanes immediately grew a dead zone
  // sitting on an orb (survey relay 05, patrol relay 04). Widening the search is
  // not the fix: it only moves which lane loses. A cycle without a dead zone is a
  // quieter lane. A dead zone on top of a demand is an unreachable one, and the
  // reachability law is the thing that makes a lane 100% completable.
  // The arc draw above is already spent, so standing down keeps the stream aligned.
  // …but only a FILLER dead zone stands down. An AUTHORED one (a beat) keeps its
  // place even when it clashes: the linter's job is to tell the author their wall
  // is unfair, and a wall that quietly deleted itself would hide the mistake
  // instead of reporting it.
  let clear = force || beatArc;
  for (let k = 0; !force && k < WALL_HOPS; k++) {
    const clash = enemies.some(en => {
      if (en.dead || en.resolved || en.failed) return false;
      // a live ribbon meanders — its whole ride corridor must stay reachable
      if (en.type === 'strip') return wallBlocks(angDiff(en.angle, a), 0.5, 0.5);
      const tArr = (en.z - g2.hitZ) / (trafficSpeed * (en.speedMul || 1));
      return tArr > -0.5 && tArr < wallLife && wallBlocks(angDiff(en.angle, a), 0.5);
    }) || pickups.some(p => {
      // an in-flight orb's landing arc joins the bound — a dead zone must never
      // park on a power-up (orbs ride at 0.9x stream speed)
      if (p.done) return false;
      const tArr = (p.z - g2.hitZ) / (trafficSpeed * 0.9);
      return tArr > -0.5 && tArr < wallLife && wallBlocks(angDiff(p.angle, a), 0.5);
    });
    if (!clash) { clear = true; break; }
    a += 2.399963;
  }
  if (!clear) return; // no reachable arc — the lane simply gets no dead zone this cycle
  latches.push({ a, span0: 0.5, t: 0, dur: 3, tele, arm: 0.4, z0: SPAWN_Z });
  // warning: dry double tick + static as the dead zone enters the tunnel
  sfx.latchWarn();
}

// bonus stream: a golden ribbon riding the wall — entirely OPTIONAL. Keep a
// node ON its crossing point head to tail and that node's pulse orb snaps to
// full charge; breaking off just fizzles the bonus, never wounds you.
function spawnStrip() {
  // (No first-encounter disc either — the ribbon is optional and training
  // already teaches the ride. See spawnWall.)
  const en = spawnEnemy(undefined, 'strip');
  en.angle = clearOfWalls(en.angle, 0.5); // the ride meanders — its amplitude joins the reachability bound
  en.len = srand(0.5, 0.85);                             // depth extent of the ribbon
  en.amp = srand(0.22, 0.5) * (schance(0.5) ? -1 : 1);
  en.frq = srand(2.2, 4.2);
  en.ph = srand(0, TAU);
  // book the ride in the fairness ledger even though it's optional: while a
  // ribbon COULD be ridden, nothing dual-node may arrive — taking the bonus
  // must never cost a life (every level is 100%-able, bonuses included)
  sched.push({ t0: levelT + arrivalAt(en.z, 1), t1: levelT + arrivalAt(en.z + en.len, 1),
               type: 'strip', lock: undefined, needsNode: true });
  en.failed = false; en.tracing = false;
  return en;
}
const stripAngle = (en, k) => en.angle + en.amp * Math.sin(k * en.frq + en.ph);
// golden power-up orbs riding the stream; catch one with either node
const PICKUPS = {
  shield: { dur: 0,  label: 'DEFLECTOR SHIELD' }, // absorbs the next breach (one charge)
  wide:   { dur: 10, label: 'WIDE ARC' },
  auto:   { dur: 5,  label: 'AUTO-ZAP' },
  inject: { dur: 0,  label: 'PULSE INJECTED' },  // both emitters snap to ready
  chain:  { dur: 6,  label: 'CHAIN OVERDRIVE' }, // zaps arc to the nearest hostile
  health: { dur: 0,  label: 'STABILITY +25' }    // one stability block back — SCHEDULED, never rolled
};
// THE PATCH NEVER GOES TO WASTE. Reaching for relief you don't need used to pay
// nothing, so a full-stability lane taught the player to ignore the orb — and
// then to ignore ALL orbs, because the reach is the same reach. So the patch
// hands over the next thing that still has somewhere to go: the shield, and
// behind that the pulse. Read LIVE, every frame: the orb's glyph tracks the
// gauge while it flies, so a hit taken mid-flight turns the shield back into a
// cross. Consumes no RNG, so a seeded stream cannot move.
function healYield() {
  if (integrity < (mutLive('oneLife') ? 25 : 100)) return 'health';
  if (shieldCharge <= 0) return 'shield';
  return 'inject';
}
// kinds come from a seeded shuffle-bag: every kind appears once before any
// repeats. A plain uniform roll + per-level fixed seeds froze whole kinds out
// of entire levels forever (chain, chain — and never a shield, on any replay)
let pickupBag = [];
// Is the lane clear for another orb? Consumes no RNG, reads only the clock, so
// a refusal cannot move a seeded stream. See PICKUP_GAP in 40-state.
const pickAllowed = () => levelT - lastPickT >= PICKUP_GAP;
function spawnPickup(kind) { // beats may pin the kind (skipping the bag)
  lastPickT = levelT; // stamped for the spacing law — callers gate with pickAllowed()
  // health never rides the bag: relief is SENT — after hot bands, behind
  // surges, mid-duel — so it lands where the lane just hurt, not at random
  const kinds = Object.keys(PICKUPS).filter(k => k !== 'health');
  const z0 = dropTravel !== null ? geo().hitZ + dropTravel * (LV || LEVELS[levelIdx]).speed * 0.9 : SPAWN_Z;
  if (!kind) {
    if (!pickupBag.length) {
      pickupBag = kinds.slice();
      for (let i = pickupBag.length - 1; i > 0; i--) {
        const j = (spawnRng() * (i + 1)) | 0;
        const tmp = pickupBag[i]; pickupBag[i] = pickupBag[j]; pickupBag[j] = tmp;
      }
    }
    kind = pickupBag.pop();
  }
  // an orb must never land inside a dead zone — same reachability law as
  // enemies (clearOfWalls consumes no RNG, so the stream is unchanged)
  pickups.push({ kind, z: z0, angle: clearOfWalls(spawnRng() * TAU), spin: 0, age: 0, done: false });
}