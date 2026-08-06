'use strict';
// ---------- the boss fights ----------
// one framework, three intruders: every boss shares the arrival ceremony,
// the death ceremony and the verdict — bossKind picks which machine shows up
const BOSS_DEFS = {
  core: {
    title: 'THE WARDEN CORE', sub: 'DOCK BOTH EMITTERS AND HOLD — SIX BOLTS CLOSE THE CONTRACT',
    online: 'WARDEN CORE ONLINE', down: 'WARDEN DOWN',
    speak: 'this lane is mine. nothing you carry leaves it.', card: 'boss', brief: 'bossBriefed'
  },
  triad: {
    title: 'WALL · SHREDDER · GHOST', sub: 'ONE MACHINE IN THREE BODIES — THREE BOLTS EACH',
    online: 'PRIVATE WARDEN ONLINE', down: 'PRIVATE WARDEN DOWN',
    speak: 'my wall. my shredder. my ghost. count to three.', card: 'bossTriad', brief: 'triadBriefed'
  },
  spinner: {
    title: 'THE BEACON', sub: 'OUTRUN THE LIGHT — ITS OWN SWEEP OVERLOADS IT',
    online: 'THE BEACON ONLINE', down: 'BEACON DOWN',
    speak: 'I see everything on this ring. keep running.', card: 'bossSpinner', brief: 'spinnerBriefed'
  }
};
// SHIELD was retired here: it is the DEFLECTOR SHIELD pickup's word, and one
// word cannot mean both a boss body and a power-up. ALIBI went with it — the
// warden is an outlaw interdictor now, not a suspect with a cover story.
const TRIAD_NAMES = ['WALL', 'SHREDDER', 'GHOST'];
const TRIAD_FREE_ARC = 1.6;  // the dockable-arc law: walls may never close the ring
const SPIN_BEAM_HALF = 0.13; // beacon beam half-width at the ring (rad)
// the boss duel: the intruder flies inside the tunnel while the dock-and-hold
// volley (the campaign verb — controls never change hands) takes it apart
function spawnBoss() {
  enemies = []; pickups = []; burstQ = null; patternQ = []; sched = []; latches = []; volley.shots = []; // the lane clears
  const kind = (LV || LEVELS[levelIdx]).bossKind || 'core';
  boss = {
    kind,
    hp: 6, maxHp: 6, // six bolts close the contract; phase 2 at three
    // it FLIES inside the tunnel: cross-section polar (ang, rad) + depth z
    ang: Math.random() * TAU, rad: 0.12, z: 1.55,
    tAng: Math.random() * TAU, tRad: 0.4, tZ: 0.6,
    u: 0, v: 0, sx: W / 2, sy: H / 2, sSize: 40,
    retarget: 1.2, spin: 0, hurtT: 0,
    shootT: 1.6, shots: [],
    mergeT: 0, introT: 0 // controls never change hands — no fuse, ever
  };
  if (kind === 'triad') {
    boss.hp = boss.maxHp = 9;        // three bodies, three bolts each
    boss.formA = Math.random() * TAU; // the triangle's own slow wheel
    boss.formR = 0.04;                // formation radius — opens during the ceremony
    boss.tRad = 0.28;
    boss.cores = TRIAD_NAMES.map((nm, i) => ({
      name: nm, i, hp: 3, maxHp: 3, dead: false,
      spin: Math.random() * TAU, hurtT: 0, chargeT: 0, introT: 0,
      sx: W / 2, sy: H / 2, sSize: 30, u: 0, v: 0, z: 1.55, bear: 0
    }));
    boss.volleyN = 0;   // which body sprays the next dart fan
    boss.volleyT = 2.4;
    boss.latchT = 2.2;  // the arena is RIDDEN with walls — far hotter than boss 1
    boss.booms = [];    // mini implosions of downed bodies
  } else if (kind === 'spinner') {
    boss.hp = boss.maxHp = 4; // four survived sweeps put the light out
    boss.mode = 'tele'; boss.modeT = 1.7;
    boss.beamA = Math.random() * TAU;
    boss.beamDir = Math.random() < 0.5 ? -1 : 1;
    boss.swept = 0; boss.round = 0; boss.shieldT = 0;
    boss.tRad = 0; boss.tZ = 0.5;
  }
  heat = 0; overheat = false; beamActive = false; beamAim.x = 0; beamAim.y = 0;
  const bd = BOSS_DEFS[kind];
  if (!progress[bd.brief] && !tracePlay) { progress[bd.brief] = true; saveState(); showCard(bd.card); }
}
// triad helpers: which body answers to a docked aim bearing
function nearestTriadCore(a) {
  let best = null, bd2 = 99;
  for (const c of boss.cores) {
    if (c.dead) continue;
    const d = Math.abs(angDiff(c.bear, a));
    if (d < bd2) { bd2 = d; best = c; }
  }
  return best;
}
// where a homing bolt is headed — the aimed mini for the triad, else the boss
function boltTargetCore(sh) {
  const b = boss;
  if (b.kind !== 'triad' || b.dying !== undefined) return b;
  let c = b.cores[sh.coreI];
  if (!c || c.dead) { c = nearestTriadCore(sh.a); if (c) sh.coreI = c.i; }
  return c || b;
}
// a downed triad body implodes — the mini version of the death ceremony
function killTriadCore(c) {
  const b = boss;
  c.dead = true;
  b.booms.push({ x: c.sx, y: c.sy, t: 0 });
  burst(c.sx, c.sy, '#ffffff', 40, 7);
  burst(c.sx, c.sy, '#d465ff', 34, 5);
  burst(c.sx, c.sy, '#ff9a3c', 20, 6);
  popup(c.sx, c.sy - c.sSize, c.name + ' DOWN', '#ffd24a');
  score += Math.round(600 * mutMul());
  shake = 1;
  hitStop = Math.min(hitStop + 0.18, 0.22);
  tone(60, 0.4, 'sine', 0.2, 35);
  crackle(0.4, 2200, 300, 3, 0.9);
  buzz([60, 40, 90], { strong: 1, weak: 0.8 }); // a core going down is the whole pad
}
// a homing volley bolt reached its core
function bossVolleyHit(sh) {
  const b = boss;
  if (!b || b.introT < BOSS_CER || b.dying !== undefined) return;
  if (b.kind === 'spinner') { // the beacon is SHIELDED to bolts — survive the sweep instead
    b.shieldT = 0.6;
    burst(b.sx, b.sy, '#8fe0ff', 16, 4);
    popup(b.sx, b.sy - b.sSize, 'SHIELDED — SURVIVE THE SWEEP', '#8fe0ff');
    tone(620, 0.12, 'sine', 0.08, 340); // fizzle, not thunder
    crackle(0.15, 1600, 700, 1, 0.3);
    buzz(10);
    return;
  }
  let cv = b; // the wounded body: the core itself, or the aimed mini
  if (b.kind === 'triad') {
    let c = sh && b.cores[sh.coreI] && !b.cores[sh.coreI].dead ? b.cores[sh.coreI] : null;
    if (!c) c = nearestTriadCore(volley.aimA !== undefined ? volley.aimA : nodes[0].angle);
    if (!c) return;
    c.hp -= 1; c.hurtT = 0.3;
    cv = c;
  }
  b.hp -= 1;
  b.hurtT = 0.3;
  burst(cv.sx, cv.sy, '#ffffff', 30, 6);
  burst(cv.sx, cv.sy, '#d465ff', 26, 5);
  burst(cv.sx + rand(-1, 1) * cv.sSize, cv.sy + rand(-0.6, 0.6) * cv.sSize, '#d465ff', 20, 5); // a plate shears off
  score += Math.round(300 * mutMul());
  popup(cv.sx, cv.sy - cv.sSize, b.kind === 'triad'
    ? cv.name + ' HIT ' + (cv.maxHp - cv.hp) + '/' + cv.maxHp
    : 'CORE HIT ' + (b.maxHp - b.hp) + '/' + b.maxHp, '#eab8ff');
  shake = 1;
  hitStop = Math.min(hitStop + 0.1, 0.14);
  tone(70, 0.3, 'sine', 0.2, 40);
  crackle(0.35, 2000, 300, 2, 0.8);
  buzz([40, 30, 60], { strong: 0.9, weak: 0.5 });
  if (b.kind === 'core' && b.hp === 3 && !b.phase2) {
    b.phase2 = true;
    b.tapT = 1.2;
    popup(W / 2, H * 0.3, 'BREACH PROTOCOL — IT FIGHTS BACK', '#d465ff');
    tone(160, 0.5, 'sawtooth', 0.14, 60);
    crackle(0.45, 3200, 700, 6, 1.0, 0.1);
    buzz([50, 40, 70]);
  }
  if (b.kind === 'triad' && cv.hp <= 0 && b.hp > 0) killTriadCore(cv); // a body implodes; the fight rages on
  if (b.hp <= 0) { // the kill — hand over to the death ceremony
    b.dying = 0; b.dyingN = 0;
    b.shots = []; latches = []; volley.shots = [];
    if (b.kind === 'triad') { // the last body carries the full ceremony
      b.sx = cv.sx; b.sy = cv.sy; b.sSize = cv.sSize; b.z = cv.z;
      for (const c of b.cores) c.dead = true;
    }
    score += Math.round(2000 * mutMul());
    popup(W / 2, H * 0.3, BOSS_DEFS[b.kind].down + '  +' + Math.round(2000 * mutMul()), '#ffd24a');
    beamSound(false, 0);
  }
}
// the core dies like a star: convulsions, plates torn away one by one, the
// eye guttering out, implosion, shockwave — the world runs at quarter speed
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
  if (!b.boom && b.dying > 2.3) { // the implosion lets go
    b.boom = true;
    burst(b.sx, b.sy, '#ffffff', 60, 8);
    burst(b.sx, b.sy, '#d465ff', 50, 6);
    burst(b.sx, b.sy, '#ff9a3c', 30, 7);
    sfx.bossDown();
    shake = 1;
    buzz([80, 40, 120], { strong: 1, weak: 1 }); // the kill
  }
  if (b.dying > 3.2) { // the case closes — verdict, then the report
    boss = null;
    commCur = { s: 'CMD', m: 'warden down. bring it home, runner.' }; commT = 0;
    showCard('verdict');
  }
}
// the beam is a straight screen-space ray: from the cannon toward where the
// stick-deflected direction exits the tunnel (far end or wall). Hit testing
// runs against this exact ray, so what you see is what you hit.
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
// distance/reach test of the core against the ray; null when clear
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
// project the triad formation into screen space — shared by ceremony, fight
// and drawing so the bodies, links and bearings never disagree
function layoutTriad(g) {
  const b = boss;
  b.u = Math.cos(b.ang) * b.rad;
  b.v = Math.sin(b.ang) * b.rad;
  let n2 = 0, ax = 0, ay = 0;
  for (const c of b.cores) {
    if (c.dead) continue;
    const ca = b.formA + c.i * (TAU / 3);
    c.z = b.z + Math.sin(time * 1.7 + c.i * 2.1) * 0.04;
    c.u = b.u + Math.cos(ca) * b.formR;
    c.v = b.v + Math.sin(ca) * b.formR + Math.sin(time * 2.3 + c.i) * 0.03;
    const rg = ring(c.z, g);
    c.sx = rg.x + c.u * rg.r;
    c.sy = rg.y + c.v * rg.r;
    c.sSize = Math.min(W, H) * 0.30 * rg.s * 0.55; // mini bodies of the same machine
    c.bear = Math.atan2(c.sy - g.cy, c.sx - g.cx);  // ring bearing — bolt routing key
    c.introT = b.introT; // the eyes ignite together during the ceremony
    n2++; ax += c.sx; ay += c.sy;
  }
  if (n2) { // the centroid carries the shared fields (HUD, fallbacks)
    b.sx = ax / n2; b.sy = ay / n2;
    b.sSize = b.cores.find(c => !c.dead).sSize;
  }
}
// THE DOCKABLE-ARC LAW: the largest wall-free arc if a latch also landed at
// `cand` (undefined = just the current walls). Live latches AND grapples still
// in flight all count; each occupies half-span + node tolerance to a side.
function latchFreeArc(cand) {
  const occ = [];
  for (const lt of latches) occ.push(lt.a);
  if (boss) for (const sh of boss.shots) if (sh.latch && !sh.done) occ.push(sh.th);
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
// pick a harassment angle that leaves the law intact; null = no legal arc now
function triadLatchAngle() {
  let th = nodes[Math.random() < 0.5 ? 0 : 1].angle + (Math.random() < 0.5 ? -1 : 1) * rand(0.55, 1.0);
  for (let k = 0; k < 10; k++) {
    if (latchFreeArc(th) >= TRIAD_FREE_ARC) return th;
    th += 2.399963; // deterministic golden hop, like clearOfWalls
  }
  return null;
}
// dart + grapple resolution at the rail — identical physics for every boss
function resolveBossShots(dt, g, railR) {
  const b = boss;
  for (const sh of b.shots) {
    sh.t += dt;
    if (!sh.done && sh.t >= sh.dur) {
      sh.done = true;
      const hx = g.cx + Math.cos(sh.th) * railR, hy = g.cy + Math.sin(sh.th) * railR;
      if (sh.latch) { // the grapple bites into the rail (dart WAS the telegraph)
        latches.push({ a: sh.th, span0: 0.5, t: 0, dur: 3, tele: 0, arm: 0.25 });
        burst(hx, hy, '#ff9a3c', 18, 4);
        popup(hx, hy - 20, 'RAIL LATCHED', '#ffb478');
        tone(140, 0.3, 'sawtooth', 0.12, 70);
        crackle(0.3, 2400, 500, 4, 0.6);
        buzz(25);
      } else {
        const clipped = nodes.find(n => Math.abs(angDiff(n.angle, sh.th)) < 0.24);
        if (clipped) { // a dart caught a carriage
          const cx2 = g.cx + Math.cos(clipped.angle) * railR, cy2 = g.cy + Math.sin(clipped.angle) * railR;
          if (!shieldAbsorb(cx2, cy2)) {
            integrity = Math.max(0, integrity - 9);
            redFlash = 1; shake = Math.min(shake + 0.5, 1);
            burst(cx2, cy2, '#ff4a5e', 20, 4);
            sfx.miss();
            buzz([40, 25, 55]);
          }
        } else {
          burst(hx, hy, '#d465ff', 6, 2.2); // splash on the ring
        }
      }
    }
  }
  b.shots = b.shots.filter(sh => sh.t < sh.dur + 0.05);
}
function updateBossFight(dt, g) {
  const b = boss;
  const bd = BOSS_DEFS[b.kind];
  b.spin += dt * 2;
  b.hurtT = Math.max(0, b.hurtT - dt);
  const z0 = g.hitZ;
  const railR = g.nodeR - Math.min(W, H) * 0.055 * 0.86;
  // ARRIVAL CEREMONY — the truth surfaces: the machine rises out of the deep,
  // its eye ignites, it speaks — and only then does the duel begin
  if (b.introT < BOSS_CER) {
    b.introT = Math.min(BOSS_CER, b.introT + dt);
    const q = b.introT / BOSS_CER;
    b.z = lerp(1.55, b.kind === 'spinner' ? 0.5 : 0.55, 1 - Math.pow(1 - q, 2));
    b.ang += dt * 0.35;
    b.rad = b.kind === 'spinner' ? 0.12 * (1 - q) : 0.12; // the beacon claims the exact center
    b.u = Math.cos(b.ang) * b.rad;
    b.v = Math.sin(b.ang) * b.rad;
    const brg0 = ring(b.z, g);
    b.sx = brg0.x + b.u * brg0.r; b.sy = brg0.y + b.v * brg0.r;
    b.sSize = Math.min(W, H) * 0.30 * brg0.s;
    if (b.kind === 'triad') { // the triangle unfolds as it surfaces
      b.formA += dt * 0.5;
      b.formR = lerp(0.05, 0.30, q);
      layoutTriad(g);
      for (const c of b.cores) c.spin += dt * 2;
    }
    if (!b.cer1) { b.cer1 = true; tone(30, 2.6, 'sine', 0.16, 55); crackle(2.4, 60, 260, 1, 0.35); }
    if (!b.cer2 && b.introT > 1.5) { // the eye ignites; it speaks
      b.cer2 = true;
      sfx.bossOnline(); buzz([40, 60, 90], { strong: 0.7, weak: 0.9 }); // arrival: presence, not pain
      // WARD, not CORE: every package defines WARD as 'the interdiction' in the
      // boss's own violet, and nothing defined CORE — so this chip used to miss
      // SPKCOL and fall back to a generic blue. New speakers get added when a
      // fight actually needs a new voice, not implied by a string here.
      commCur = { s: 'WARD', m: bd.speak }; commT = 0;
    }
    if (b.introT >= BOSS_CER) {
      popup(W / 2, H * 0.30, bd.online, '#d465ff');
      shake = 1; buzz([30, 40, 60]);
      tone(160, 0.5, 'sawtooth', 0.14, 60);
    }
    return;
  }
  // DEATH CEREMONY
  if (b.dying !== undefined) { updateBossDeath(dt, g); return; }
  if (b.kind === 'triad')   { updateTriadFight(dt, g);   resolveBossShots(dt, g, railR); return; }
  if (b.kind === 'spinner') { updateSpinnerFight(dt, g); resolveBossShots(dt, g, railR); return; }
  // restless flight inside the tunnel — cross-section polar + depth
  b.retarget -= dt;
  if (b.retarget <= 0) {
    b.retarget = rand(0.9, 1.7) * (b.phase2 ? 0.75 : 1);
    b.tAng = Math.random() * TAU;
    b.tRad = rand(0.1, 0.6);
    b.tZ = rand(z0 + 0.28, z0 + 0.55);
  }
  b.ang += angDiff(b.tAng, b.ang) * Math.min(1, dt * 2.2);
  b.rad = lerp(b.rad, b.tRad, Math.min(1, dt * 2.2));
  b.z = lerp(b.z, b.tZ, Math.min(1, dt * 1.6));
  b.u = Math.cos(b.ang) * b.rad;
  b.v = Math.sin(b.ang) * b.rad + Math.sin(time * 2.3) * 0.05;
  const brg = ring(b.z, g);
  b.sx = brg.x + b.u * brg.r;
  b.sy = brg.y + b.v * brg.r;
  b.sSize = Math.min(W, H) * 0.30 * brg.s;
  // NO fuse, NO beam, NO stick: the dials stay yours. Dock both nodes to
  // charge — the bolt homes on the core (see the volley block in update)
  // PHASE 2 — three hits in, the cornered core punches taps into the wall:
  // zap them like always while you look for the next firing window
  if (b.phase2) {
    b.tapT -= dt;
    if (b.tapT <= 0) {
      b.tapT = rand(2.6, 3.6);
      const en2 = spawnEnemy(undefined, 'normal');
      en2.lock = undefined;
    }
  }
  // bullet-hell return fire: darts hunt EITHER carriage now
  b.shootT -= dt;
  if (b.shootT <= 0) {
    const enrage = b.phase2;
    b.shootT = rand(0.55, 1.0) * (enrage ? 0.6 : 1);
    const A = nodes[Math.random() < 0.5 ? 0 : 1].angle;
    const fireOrb = th => b.shots.push({ u0: b.u, v0: b.v, zb: b.z, th, t: 0, dur: rand(1.0, 1.35) });
    const roll = Math.random();
    if (roll < 0.45) fireOrb(A + rand(-0.12, 0.12)); // aimed
    else if (roll < 0.8) { const sp = rand(0.3, 0.45); fireOrb(A - sp); fireOrb(A); fireOrb(A + sp); } // fan
    else { const off = rand(0.5, 0.9); fireOrb(A - off); fireOrb(A + off); fireOrb(A + rand(-0.15, 0.15)); } // pincer
    sfx.bossShot();
  }
  // RAIL LATCH — the core grapples the rail itself: an orange clamp arc that
  // fries the cannon (node-killer style) if you slide across it. It burns off
  // on its own within 3s — go around the other way, or hold ground and wait.
  b.latchT = (b.latchT === undefined ? 5 : b.latchT) - dt;
  if (b.latchT <= 0 && latches.length < (b.phase2 ? 2 : 1)) {
    b.latchT = rand(5.5, 8) * (b.phase2 ? 0.75 : 1);
    const th = nodes[0].angle + (Math.random() < 0.5 ? -1 : 1) * rand(0.55, 1.0);
    b.shots.push({ u0: b.u, v0: b.v, zb: b.z, th, t: 0, dur: 1.15, latch: true });
    sfx.bossShot();
  }
  // (latch ticking + node fry now live in update() — walls exist campaign-wide)
  resolveBossShots(dt, g, railR);
}
// ---------- triad: one machine in three bodies ----------
// scarce docking is the fight: the ring stays ridden with rail latches (two at
// once) while the bodies spray telegraphed dart fans. The bolt hunts whichever
// body you AIM at; three bolts each, and the survivors only get angrier.
function updateTriadFight(dt, g) {
  const b = boss;
  const z0 = g.hitZ;
  const down = 3 - b.cores.reduce((n2, c) => n2 + (c.dead ? 0 : 1), 0);
  const rage = 1 + down * 0.25; // each lost body speeds the rest up
  // the triangle wheels around the bore as one machine
  b.formA += dt * 0.35 * rage;
  b.retarget -= dt * rage;
  if (b.retarget <= 0) {
    b.retarget = rand(1.1, 2.0);
    b.tAng = Math.random() * TAU;
    b.tRad = rand(0.06, 0.34);
    b.tZ = rand(z0 + 0.32, z0 + 0.58);
  }
  b.ang += angDiff(b.tAng, b.ang) * Math.min(1, dt * 1.8);
  b.rad = lerp(b.rad, b.tRad, Math.min(1, dt * 1.8));
  b.z = lerp(b.z, b.tZ, Math.min(1, dt * 1.4));
  layoutTriad(g);
  for (const c of b.cores) {
    if (c.dead) continue;
    c.spin += dt * (2 + down * 0.7);
    c.hurtT = Math.max(0, c.hurtT - dt);
  }
  for (const bm of b.booms) bm.t += dt;
  b.booms = b.booms.filter(bm => bm.t < 0.9);
  // RADIAL DART FANS — the bodies take turns: a charge glow (the telegraph),
  // then a five-dart spray with dodgeable gaps
  b.volleyT -= dt;
  if (b.volleyT <= 0) {
    b.volleyT = rand(2.6, 3.6) / rage;
    let c = null; // round-robin across the LIVING bodies
    for (let k = 0; k < 3 && !c; k++) {
      const cand = b.cores[b.volleyN++ % 3];
      if (!cand.dead) c = cand;
    }
    if (c) c.chargeT = 0.55; // the glow IS the warning
  }
  for (const c of b.cores) {
    if (c.dead || !(c.chargeT > 0)) continue;
    c.chargeT -= dt;
    if (c.chargeT <= 0) { // the spray flies
      const base = nodes[Math.random() < 0.5 ? 0 : 1].angle + rand(-0.2, 0.2);
      for (let k = -2; k <= 2; k++) {
        b.shots.push({ u0: c.u, v0: c.v, zb: c.z, th: base + k * 0.5, t: 0, dur: rand(1.05, 1.25) });
      }
      sfx.bossShot();
    }
  }
  // WALL PRESSURE — latches come fast and two at a time, but every placement
  // passes the dockable-arc law first: a wall-free arc >= TRIAD_FREE_ARC must
  // survive, so a firing window always exists somewhere on the ring
  b.latchT -= dt;
  const pend = b.shots.reduce((n2, sh) => n2 + (sh.latch && !sh.done ? 1 : 0), 0);
  if (b.latchT <= 0 && latches.length + pend < 2) {
    const th = triadLatchAngle();
    if (th !== null) {
      b.latchT = rand(2.4, 3.6) / rage;
      const c = b.cores.find(c2 => !c2.dead) || b;
      b.shots.push({ u0: c.u, v0: c.v, zb: c.z, th, t: 0, dur: 1.15, latch: true });
      sfx.bossShot();
    } else b.latchT = 0.8; // no legal arc right now — retry shortly
  }
}
// ---------- spinner: THE BEACON — a lighthouse in the bore ----------
// beam rounds: telegraph, then a full-circle sweep the player must outrun with
// BOTH nodes. Completing the rotation overloads the beacon itself — that's the
// only damage it takes (bolts fizzle on its shield). Between sweeps it throws
// a zappable intrusion wave with a rim-wall latch riding along.
function spawnSpinnerWave() {
  const b = boss;
  // the latch lands first so the wave spawns around it (reachability law)
  const th = nodes[0].angle + Math.PI + rand(-0.8, 0.8);
  latches.push({ a: th, span0: 0.5, t: 0, dur: 3, tele: 0.9, arm: 0.4, z0: SPAWN_Z });
  tone(1180, 0.02, 'square', 0.05); tone(1180, 0.02, 'square', 0.05, null, null, 0.22);
  // FAIRNESS: the wave is a CONVOY, not a wall. At most TWO hostiles share an
  // arrival window (one per node), window partners land a half-ring apart so
  // both are reachable, and windows arrive ~0.85s apart down the pipe.
  const n2 = 3 + Math.min(3, b.round); // the waves thicken round by round
  const gapZ = 0.85 * (LV.speed || 0.5) * (mutators.fast ? 1.35 : 1);
  let prevA = Math.random() * TAU;
  for (let k = 0; k < n2; k++) {
    const w = k >> 1; // window index — two seats per window
    let a;
    if (k & 1) { // seat 2: opposite-ish — and NEVER stacked on the partner,
      a = clearOfWalls(prevA + Math.PI + rand(-0.6, 0.6)); // even when a wall
      for (let h = 0; h < 6 && Math.abs(angDiff(a, prevA)) < 1.2; h++)
        a = clearOfWalls(a + 2.399963); // hop shifted it — hop until honestly apart
    } else a = clearOfWalls(prevA + 2.4 + rand(-0.4, 0.4)); // fresh window: hop onward
    const en2 = spawnEnemy(a, 'normal');
    en2.lock = undefined;
    en2.z = SPAWN_Z + w * gapZ; // stagger the windows down the pipe
    if (!(k & 1)) prevA = a;
  }
  popup(W / 2, H * 0.3, 'INTRUSION WAVE', '#d465ff');
  crackle(0.3, 900, 2200, 2, 0.4);
}
function updateSpinnerFight(dt, g) {
  const b = boss;
  b.shieldT = Math.max(0, b.shieldT - dt);
  // the beacon holds the bore's center — a slow, sure hover
  b.ang += dt * 0.3;
  b.rad = lerp(b.rad, 0.05, Math.min(1, dt * 1.5));
  b.z = lerp(b.z, 0.5, Math.min(1, dt * 1.2));
  b.u = Math.cos(b.ang) * b.rad;
  b.v = Math.sin(b.ang) * b.rad + Math.sin(time * 2.3) * 0.03;
  const brg = ring(b.z, g);
  b.sx = brg.x + b.u * brg.r;
  b.sy = brg.y + b.v * brg.r;
  b.sSize = Math.min(W, H) * 0.30 * brg.s;
  b.modeT -= dt;
  if (b.mode === 'tele') { // ghost line up — the lamp charges
    if (b.modeT <= 0) {
      b.mode = 'sweep';
      b.swept = 0;
      b.sweepSpd = TAU / Math.max(4.2, 5.8 - b.round * 0.45); // a touch faster each round
      popup(W / 2, H * 0.3, 'SWEEP ' + (b.round + 1) + '/' + b.maxHp, '#ffd24a');
      tone(180, 0.5, 'sawtooth', 0.13, 90);
      crackle(0.5, 400, 2600, 2, 0.5);
      buzz([30, 30, 50]);
    }
  } else if (b.mode === 'sweep') {
    const dA = b.sweepSpd * dt;
    b.beamA += dA * b.beamDir;
    b.swept += dA;
    // a node caught in the light fries — wall-fry treatment; the sweep rolls on
    const railR = g.nodeR - Math.min(W, H) * 0.055 * 0.86;
    for (let i = 0; i < 2; i++) {
      const n = nodes[i];
      if (n.deadT > 0) continue;
      if (Math.abs(angDiff(n.angle, b.beamA)) < SPIN_BEAM_HALF) {
        n.deadT = 2;
        const px2 = g.cx + Math.cos(n.angle) * railR, py2 = g.cy + Math.sin(n.angle) * railR;
        burst(px2, py2, '#ff9a3c', 22, 4);
        popup(px2, py2 - 24, 'EMITTER FRIED', '#ffb478');
        sfx.fry(Math.cos(n.angle) * 0.6);
        redFlash = Math.max(redFlash, 0.5);
        shake = Math.min(shake + 0.5, 1);
        buzz([40, 30, 60]);
      }
    }
    if (b.swept >= TAU) { // full rotation — the discharge overloads the BEACON
      b.round++;
      b.hp -= 1;
      b.hurtT = 0.45;
      burst(b.sx, b.sy, '#ffffff', 36, 6);
      burst(b.sx, b.sy, '#ffd24a', 26, 5);
      popup(b.sx, b.sy - b.sSize, 'OVERLOAD ' + b.round + '/' + b.maxHp, '#ffd24a');
      shake = 1;
      hitStop = Math.min(hitStop + 0.12, 0.16);
      tone(90, 0.35, 'sine', 0.2, 45);
      crackle(0.4, 2400, 400, 3, 0.8);
      buzz([50, 30, 70]);
      if (b.hp <= 0) { // the light goes out — hand over to the death ceremony
        b.dying = 0; b.dyingN = 0;
        b.shots = []; latches = []; volley.shots = [];
        score += Math.round(2000 * mutMul());
        popup(W / 2, H * 0.3, BOSS_DEFS.spinner.down + '  +' + Math.round(2000 * mutMul()), '#ffd24a');
        beamSound(false, 0);
        return;
      }
      b.mode = 'adds';
      b.modeT = 14; // the add phase can't stall the fight forever
      b.beamDir *= -1; // the next sweep runs the other way
      spawnSpinnerWave();
    }
  } else { // adds: clear the wave (or wait out the timeout) to face the next sweep
    const live = enemies.some(e => !e.dead && !e.resolved && !e.failed && e.type !== 'strip');
    if ((!live && !latches.length) || b.modeT <= 0) {
      b.mode = 'tele';
      b.modeT = 1.7;
      tone(960, 0.04, 'sine', 0.06); tone(960, 0.04, 'sine', 0.06, null, null, 0.16);
    }
  }
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
    spr: SPRITES[en.lock === 0 ? 'lock0' : en.lock === 1 ? 'lock1' : en.type] });
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
