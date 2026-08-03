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
// node killer (void packet) — SIGNAL LOSS. Tuned in the enemy lab, whose
// "copy values" button emitted this block verbatim — which is why every key
// still carries the lab's v-prefix. The lab is gone; the prefix is just history.
const FRAGFX = {
  vBands: 10,      // horizontal slices the body tears along
  vHold: 0.45,     // quiet seconds between corruption events
  vBurst: 0.18,    // how long one event lasts
  vStep: 14,       // offsets re-roll at this Hz — stepped reads digital, per-frame reads fizzy
  vTear: 0.35,     // sideways shift of a torn band (× body radius)
  vTearN: 0.45,    // fraction of bands that tear at full event strength
  vDrop: 0.18,     // fraction that drop out entirely (the tunnel shows through)
  vChroma: 0.02,   // rim chromatic split at rest (× radius, with a hard pixel floor)
  vChromaB: 4.00,  // how far the split widens during an event
  vChromaI: 0.35,  // fringe strength
  vFlash: 0.45,    // blown-out sliver left where a band dropped out
  vScan: 0.50,     // scan sweep crawling the body between events
  vGlint: 0.70,    // the rim glint — the bait
};
const enGun = l => { l *= ENEMYFX.mMetal; return `rgb(${Math.round(l * 0.92)},${Math.round(l * 0.96)},${Math.round(Math.min(255, l * 1.04))})`; };

// nodes: [left(blue), right(white)]
const nodes = [
  { angle: Math.PI, color: '#1c3f8f', glow: '#4d8dff' },
  { angle: 0,       color: '#ffffff', glow: '#bfe0ff' }
];

// ---------- geometry ----------
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
// Drop PNGs into src/sprites/ (normal, heavy, lock0, lock1, frag, boss) and they
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
  for (const k of ['normal', 'heavy', 'lock0', 'lock1', 'frag', 'boss']) {
    const img = new Image();
    img.onload = () => { SPRITES[k] = img; };
    img.onerror = () => {};
    img.src = 'sprites/' + k + '.png';
  }
}
