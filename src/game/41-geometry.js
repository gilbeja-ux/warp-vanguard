'use strict';
// ---------- arc nodes: look constants (tuned in the arc lab, 2026-07-20) ----------
// The lab was removed once the look was settled — these values ARE the design
// record now, so tune them here.
// The node IS a sector of the ring: an energy arc wrapped around the monolith
// band, bounded by two machined bus-bars. The arc's span IS the zap window.
const ARCFX = {
  bandW: 0.40,  // ring band half-width, ×(0.055·min side)
  metal: 0.50, sheen: 0.00,            // monolith band material
  // arc half-span at tolVis 1 — ALSO the gameplay zap tolerance (visual =
  // mechanic). Kept at the game's balanced 0.314 rather than the lab's 0.24:
  // shrinking it is a difficulty change, not an art change. Dial both at once here.
  span: 0.314,
  fils: 7, energy: 1.90, wobble: 0.50, // the living arc
  breath: 0.20, dip: 0.40, refill: 1.00,
  barW: 0.60,   // bus-bar width, ×band half-width
  zapT: 0.40,   // discharge bolt life
  grain: 0.40,  // film-grain finish
};
const NODE_COLS = ['80,170,255', '255,255,255']; // node 0 matches the BLUE lock enemy now
const NODE_HEX = ['#50aaff', '#ffffff'];
const LIGHT_A = -TAU * 0.31;  // world key light for the monolith ring + bus-bars
const smoothT = t => t * t * (3 - 2 * t);
const arcGun = l => { l *= ARCFX.metal; return `rgb(${Math.round(l * 0.92)},${Math.round(l * 0.96)},${Math.round(Math.min(255, l * 1.04))})`; };
const arcHash = i => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
// enemy body tuning — the BREACH DECK machined design, user-blessed
// 2026-07-21 in the enemy lab (since removed; tune these directly). The
// parasite-direction knobs never made it off the lab bench.
const ENEMYFX = {
  size: 2.25,    // body scale — 1.5× the old 1.5; big enough to read in the bore without crowding it (2026-07-26)
  squash: 0.36,  // wall foreshortening for on-surface parts
  mMetal: 1.00,  // plate metal brightness
  mSeam: 0.55,   // seam glow + vent intensity
  mBeamL: 1.35, mBeamI: 0.60,  // exfil beam length / glow
  mDrill: 1.35, mSpin: 3.50,   // auger length / flute crawl speed
  mCrack: 1.00,  // impact crack reach
};
// THE BAKED BREACH BODIES — the live half of them. The hardware itself is
// geometry (see THE BREACH in 81-station3d.js); these are the numbers the game
// still decides every frame, because they are the ones that must not be baked.
//
// `size` is deliberately absent: a baked body scales off the SAME `size` drawEnemy
// already computes from ENEMYFX.size, so the two families can never end up at
// different scales on the same wall.
const BREACHFX = {
  // Baked light directions per hull. A tap rides the whole way round the bore, so
  // one sprite carries its highlight round with it and the sun appears to orbit
  // the player. Six holds it still. Costs six bakes a hull, on the menu, with a
  // procedural stand-in until they land — and lowFX bakes every other one.
  sunViews: 6,
  sunElev: 0.55,  // how far the key stands out of the plate's plane, in radians
  // THE HULL'S OWN TRIM ON THE SHARED BODY SCALE. `ENEMYFX.size` sets how big a
  // body is and both renderers obey it, but a baked hull is not a flat painting:
  // it carries a drill standing into the bore, a target ring and an exfil beam,
  // so it fills far more of the same footprint than the painter it replaced. At
  // the bare shared scale it crowded the bore. A fifth off puts the HARDWARE just
  // over the old art's plate, while the RING — the aim cue, measured separately
  // below — stays exactly on the emitter's reach.
  //
  // TRIMMED 5% ON 2026-08-29 (Gil): 0.76 -> 0.722. The hulls read a touch heavy
  // in the bore. `ring` below was multiplied by the SAME 1/0.95 in the same edit,
  // so the aim cue did not move a pixel — only the hardware inside it did. Any
  // future trim here has to pay the ring the same way, and npm test says so.
  scale: 0.722,
  ref: 224,       // sprite side in CSS px — a tap is never a station on screen
  tint: 1.10,     // the type colour poured through the bake's coverage mask
  bloom: 0.70,    // and its blurred pass, so the channels bleed into the metal
  ground: 1.00,   // the contact pool squashed onto the wall
  // THE EXFIL BEAM. On the far side of the wall the tap transmits its haul OUT to
  // whoever sent it — a type-coloured cone rising AWAY from the bore, wide at the
  // plate and converging as it recedes. It was in the old painter and dropping it
  // is most of why the baked bodies read smaller than the ones they replaced.
  //
  // It is also free: the cone points radially outward, so it adds presence in the
  // one direction that costs the player nothing to read. Nothing about the aim
  // moves — see BR_WIDE in 81-station3d.js for the axis that is rationed.
  beam: 1.00,     // its length, in body sizes
  beamI: 0.62,    // and its brightness
  // THE TARGET RING — a type-coloured hoop laid on the WALL around the plate,
  // breathing. This is the single cue the old painter had that the baked hull did
  // not, and losing it is most of why the new bodies were hard to pick out and
  // hard to aim at: a hull is a machine, but a ring is a TARGET. It lives in wall
  // space, so it foreshortens with the bore like everything else on it.
  //
  // ITS RADIUS IS THE ZAP WINDOW, DRAWN. An emitter takes a trap when it is within
  // ARCFX.span of the trap's angle, and 1.342 body sizes IS that arc at every
  // depth — because `size` and the depth ring's radius both scale with the same
  // wall fraction, so the ratio never moves:
  //
  //     ring * scale * 0.06 * ENEMYFX.size / 0.44  ==  ARCFX.span
  //
  // So the hoop is not decoration and it is not a guess at one: it is the coverage
  // rule painted on the wall, the same bargain the emitter's own arc already makes.
  // Keep the three numbers in step, or the ring starts lying about the reach.
  ring: 1.4126,   // its radius, in body sizes — see above before changing it
  ringI: 0.85,    // and how hard it burns
  // the drill's own core light, so the shaft reads against a dark bore instead
  // of disappearing into it — the old body's siphon line, in one stroke
  spine: 0.70
};
const enGun = l => { l *= ENEMYFX.mMetal; return `rgb(${Math.round(l * 0.92)},${Math.round(l * 0.96)},${Math.round(Math.min(255, l * 1.04))})`; };

// nodes: [left(blue), right(white)]
// `slew` is a NAMED BEARING, not a position: null means nothing is pending, a
// number means this carriage is running the rim to reach it. See slewNodes.
const nodes = [
  { angle: Math.PI, color: '#1c3f8f', glow: '#4d8dff', slew: null },
  { angle: 0,       color: '#ffffff', glow: '#bfe0ff', slew: null }
];
// THE EMITTER TRAVELS — IT DOES NOT APPEAR.
//
// Every control scheme NAMES A BEARING and the carriage runs to it. No scheme may
// assign an angle outright, because the rim clamps (see updateLatches) only ever
// test the angle a node is AT, never the ground it covered — so a teleport is a
// free pass THROUGH a live dead zone: no frame ever exists with the node inside
// it.
//
// The stick had this hole and was fixed on its own, which was half a fix: a touch
// landing on a pad jumped the carriage across the ring in exactly the same way,
// and that is the input almost everybody plays with. One rate and one integrator
// for every scheme, so the two can never drift apart again.
//
// Deliberately brisk: a half-ring sweep lands in about a fifth of a second, so
// naming a far bearing is still the fast way to travel — just no longer a free
// one. What it must never be again is INSTANT.
const NODE_SLEW = 14;   // rad/s
// Runs inside update(), so the step is a sim step and every angle in between is a
// real angle the latch block tests on the same tick — which is the entire point.
// Being fried on the way is what a dead zone is FOR.
function slewNodes(dt) {
  if (tracePlay) return; // a replay drives angles from the trace; nothing else may move them
  const step = NODE_SLEW * dt;
  for (const n of nodes) {
    if (n.slew === null) continue;
    const d = angDiff(n.slew, n.angle);
    if (Math.abs(d) <= step) { n.angle = n.slew; n.slew = null; } // land ON it, never past
    else n.angle += Math.sign(d) * step;
  }
}

// ---------- geometry ----------
// >>> BORE-PROJ
// The bore's whole projection, in two functions. Marked as a region because the
// breach lab stages bodies in a real bore rather than a drawn approximation of
// one — a lab that guesses the projection is a lab that judges the wrong shape.
function geo() {
  const cx = W / 2, cy = H / 2;
  const nodeR = Math.min(W, H) * 0.44;            // the fixed node holder ring — nearly touches top/bottom
  // CANONICAL CORE: the near ring is pinned at 2.5× the node ring, so hitZ is ALWAYS
  // 0.25 no matter the screen aspect. That makes the reaction window (spawn→ring travel
  // time) and the whole playfield identical on every device — fair leaderboard, portable
  // replays — while the ring keeps its full on-screen size and the background fills the
  // rest of the screen. (Previously R0 = hypot(W,H)/2·1.08, which drifted hitZ 0.12–0.25
  // across aspect ratios; at 16:9 that formula already landed on ~2.5×, so this is a
  // no-op at the tuned aspect and only corrects the off-16:9 cases.)
  const R0 = nodeR * 2.5;
  const hitZ = (R0 / nodeR - 1) / 6;              // ≡ 0.25 exactly, independent of aspect
  // meander disabled: a straight bore keeps every depth ring concentric, so
  // wall decals project as clean annular arcs (a REAL tunnel, not an effect)
  const sw = 0, swy = 0;
  return { cx, cy, R0, nodeR, hitZ, sw, swy };
}
// depth z: 0 = past the player, 1 = far end. Swerve is anchored at the node ring
// (q=0 there), so traps always arrive exactly on the ring.
function ring(z, g) {
  // depth falloff. The linear term is CANONICAL up to the node ring — at z=hitZ
  // the extra term is exactly 0, so r(hitZ) === nodeR and hitZ stays 0.25 on
  // every screen. Past the ring a quadratic kicks in so the bore actually
  // CONVERGES: the far end runs off to a near-point instead of sitting at a
  // third of the ring, and traffic enters the horizon genuinely tiny and grows
  // the whole way in. Purely projective — z, hitboxes and timing are untouched.
  const d = Math.max(0, z - g.hitZ);
  const s = 1 / (1 + z * 6 + d * d * 5);
  let q = (z - g.hitZ) / (1 - g.hitZ);
  if (q < 0) q *= 0.4; // gentle opposite parallax for the wall rushing past the ring
  const off = Math.min(W, H) * 0.25;
  return { x: g.cx + g.sw * off * q, y: g.cy + g.swy * off * 0.7 * q, r: g.R0 * s, s };
}
// <<< BORE-PROJ

// typography helpers: text lives INSIDE the bore — shrink to the clear chord
function ringChord(y, margin) {
  const g2 = geo();
  const dy = Math.abs(y - g2.cy);
  if (dy >= g2.nodeR) return W * 0.4;
  return 2 * Math.sqrt(g2.nodeR * g2.nodeR - dy * dy) - (margin === undefined ? 34 : margin);
}
// text laid along an arc, upright on both halves of the circle
function arcText(text, cx2, cy2, r, midA, px, fill, weight, maxArc, flipOv) {
  ctx.font = (weight || '800') + ' ' + px + 'px Audiowide, system-ui';
  while (px > 8 && ctx.measureText(text).width > (maxArc || TAU) * r * 0.86) {
    px--; ctx.font = (weight || '800') + ' ' + px + 'px Audiowide, system-ui';
  }
  // lower half reads outward-up. Animated callers pass flipOv locked to the
  // RESTING angle so a spin can't toggle the orientation mid-flight
  const flip = flipOv === undefined ? Math.sin(midA) > 0 : flipOv;
  const total = ctx.measureText(text).width;
  let a = midA + (flip ? 1 : -1) * (total / 2) / r;
  ctx.fillStyle = fill;
  const prevAlign = ctx.textAlign;
  ctx.textAlign = 'center';
  for (const ch of text) {
    const w2 = ctx.measureText(ch).width;
    const da = (w2 / 2) / r * (flip ? -1 : 1);
    a += da;
    ctx.save();
    ctx.translate(cx2 + Math.cos(a) * r, cy2 + Math.sin(a) * r);
    ctx.rotate(a + (flip ? -Math.PI / 2 : Math.PI / 2));
    ctx.fillText(ch, 0, 0);
    ctx.restore();
    a += da;
  }
  ctx.textAlign = prevAlign;
}
function fitPx(text, weight, px, maxW, minPx) {
  for (let p2 = Math.round(px); p2 >= (minPx || 9); p2--) {
    ctx.font = weight + ' ' + p2 + 'px Audiowide, system-ui';
    if (ctx.measureText(text).width <= maxW) return p2;
  }
  return minPx || 9;
}

// boot fly-in: >1 while the node ring is still traveling from the operator's
// viewpoint into its dock — shared by the ring pass and the node carriages so
// the whole assembly moves as one piece of hardware
function bootRingS(g) {
  // S.INFO counts as "not yet flown in": while a briefing disc holds the
  // level, the ring stays out of view — it only comes flying once play starts
  if ((state !== S.PLAY && state !== S.PAUSE && state !== S.INFO) || introT >= BOOT_LOCK) return 1;
  const p = clamp(introT / BOOT_LOCK, 0, 1);
  const zz = g.hitZ - (g.hitZ + 0.04) * (1 - p * p * (3 - 2 * p));
  return (g.R0 / (1 + zz * 6)) / g.nodeR;
}

// ---------- optional sprite skins (OFF unless asked for) ----------
// Drop PNGs into src/sprites/ (normal, heavy, lock0, lock1, boss) and they
// replace the procedural bodies automatically; missing files fall back.
//
// OPT-IN, because this ran unconditionally at script-parse time and src/sprites/
// has never existed — so every boot fired six Image() requests that could only
// 404, on the critical path, ahead of the first frame. A directory's absence
// cannot be tested without asking for a file, so the switch is a flag rather than
// a probe: set window.VG_SPRITES (or add ?sprites) and drop the folder in.
const SPRITES = {};
if (typeof Image !== 'undefined' &&
    ((typeof window !== 'undefined' && window.VG_SPRITES) ||
     (typeof location !== 'undefined' && /[?&]sprites/.test(location.search)))) {
  for (const k of ['normal', 'heavy', 'lock0', 'lock1', 'boss']) {
    const img = new Image();
    img.onload = () => { SPRITES[k] = img; };
    img.onerror = () => {};
    img.src = 'sprites/' + k + '.png';
  }
}
