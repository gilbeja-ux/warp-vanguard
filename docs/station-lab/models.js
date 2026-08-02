'use strict';
// The four station archetypes plus the gate, as 3D geometry.
// Everything is built in a unit space: the station's outer radius is 1.

const TAU2 = Math.PI * 2;
function rng(seed) {
  let s = (seed >>> 0) || 1;
  return () => {
    s = Math.imul(s ^ (s >>> 15), 2246822507);
    s = Math.imul(s ^ (s >>> 13), 3266489909);
    return ((s ^ (s >>> 16)) >>> 0) / 4294967296;
  };
}
const lerp = (a, b, t) => a + (b - a) * t;

// a lat/long sphere — tanks and pressure vessels
function sphere(M, o, r, su, sv, m) {
  const g = [];
  for (let i = 0; i <= sv; i++) {
    const ph = (i / sv) * Math.PI, sp = Math.sin(ph), cp = Math.cos(ph);
    const row = [];
    for (let j = 0; j < su; j++) {
      const th = (j / su) * TAU2;
      const n = [sp * Math.cos(th), sp * Math.sin(th), cp];
      row.push(M.vert([o[0] + n[0] * r, o[1] + n[1] * r, o[2] + n[2] * r], n, [j / su * 3, i / sv * 3]));
    }
    g.push(row);
  }
  for (let i = 0; i < sv; i++) for (let j = 0; j < su; j++) {
    const j2 = (j + 1) % su;
    M.tri(g[i][j], g[i + 1][j], g[i + 1][j2], m);
    M.tri(g[i][j], g[i + 1][j2], g[i][j2], m);
  }
}

// THE GREEBLE PASS. This is the single biggest realism lever in the whole file:
// a ring with 200 small boxes of differing size, height and albedo on it reads as
// machinery, and the identical ring without them reads as a shape. They cost
// nothing — it is a bake — and the SSAO grounds every one of them with a contact
// shadow where it meets the hull.
function greebleRing(M, r0, r1, ztop, n, mats, rnd, o) {
  o = o || {};
  const hi = o.h || 0.030, lo = o.h0 || 0.008;
  const up = hi >= 0 ? 1 : -1, H = Math.abs(hi), H0 = Math.abs(lo);
  for (let i = 0; i < n; i++) {
    const a = (o.arc ? lerp(o.arc[0], o.arc[1], rnd()) : rnd() * TAU2);
    const r = lerp(r0, r1, rnd());
    const ca = Math.cos(a), sa = Math.sin(a);
    // NOT perfectly radial. A field of boxes all square to the ring reads as a
    // pattern; a few degrees of scatter reads as things that were installed.
    const yaw = (rnd() - 0.5) * 0.55;
    const cy2 = Math.cos(a + yaw), sy2 = Math.sin(a + yaw);
    const rad = [cy2, sy2, 0], tan = [-sy2, cy2, 0];
    const base = [ca * r, sa * r, ztop];
    const m = mats[(rnd() * mats.length) | 0];
    // A SIZE HIERARCHY, not a size. Uniform detail is visual noise — the eye reads
    // texture, not machinery. A few big blocks with clusters of small hardware
    // around them is what gives a hull a foreground and a background.
    const t = rnd();
    const cls = t < 0.10 ? 2 : t < 0.36 ? 1 : 0;      // 2 hero · 1 medium · 0 fine
    const S = cls === 2 ? lerp(1.9, 3.2, rnd()) : cls === 1 ? lerp(0.95, 1.5, rnd()) : lerp(0.35, 0.8, rnd());
    const w = lerp(0.013, 0.032, Math.pow(rnd(), 1.4)) * S;
    const l = lerp(0.013, 0.036, Math.pow(rnd(), 1.3)) * S;
    const h = lerp(H0, H, Math.pow(rnd(), 1.6)) * (cls === 2 ? lerp(1.1, 2.1, rnd()) : cls === 1 ? 1 : 0.62);
    const form = rnd();
    if (form < 0.60) {                                  // a block, sometimes stacked
      box(M, [base[0], base[1], ztop + up * h], scl(rad, w), scl(tan, l), [0, 0, up * h], m, o.uvS || 6);
      if (rnd() < 0.42) {
        const w2 = w * lerp(0.32, 0.66, rnd()), l2 = l * lerp(0.32, 0.66, rnd()), h2 = h * lerp(0.35, 0.9, rnd());
        const ox = (rnd() - 0.5) * w * 0.7, oy = (rnd() - 0.5) * l * 0.7;
        box(M, [base[0] + rad[0] * ox + tan[0] * oy, base[1] + rad[1] * ox + tan[1] * oy, ztop + up * (h * 2 + h2)],
          scl(rad, w2), scl(tan, l2), [0, 0, up * h2], mats[(rnd() * mats.length) | 0], 6);
      }
    } else if (form < 0.76) {                           // an upright tank or silo
      const rr = Math.min(w, l) * lerp(0.8, 1.15, rnd());
      cyl(M, [base[0], base[1], ztop + up * h], [0, 0, 1], rr, h, 16, m, true);
      if (rnd() < 0.5) cyl(M, [base[0], base[1], ztop + up * h * 2.15], [0, 0, 1], rr * 0.72, h * 0.16, 16, mats[(rnd() * mats.length) | 0], true);
    } else if (form < 0.88) {                           // a pipe or duct lying along the deck
      const len = l * lerp(2.2, 4.5, rnd()), rr = Math.min(w, 0.020) * lerp(0.5, 0.95, rnd());
      cyl(M, [base[0], base[1], ztop + up * (rr + h * 0.25)], tan, rr, len, 12, m, true);
      for (const s of [-0.62, 0.62])
        box(M, [base[0] + tan[0] * len * s, base[1] + tan[1] * len * s, ztop + up * (rr * 0.6)],
          scl(rad, rr * 1.4), scl(tan, rr * 0.7), [0, 0, up * rr * 1.3], mats[(rnd() * mats.length) | 0], 6);
    } else {                                            // a mast, an aerial, a whip
      const mh = h * lerp(2.6, 5.5, rnd()), rr = Math.max(0.0022, w * 0.10);
      cyl(M, [base[0], base[1], ztop + up * mh], [0, 0, 1], rr, mh, 8, m, false);
      box(M, [base[0], base[1], ztop + up * 0.012], scl(rad, rr * 3.4), scl(tan, rr * 3.4), [0, 0, up * 0.012], m, 6);
    }
  }
}
// Greebles that hang off a vertical WALL — antennae housings, thruster blocks,
// the things that break a perfect circular silhouette.
function greebleWall(M, r, z0, z1, n, mats, rnd, o) {
  o = o || {};
  for (let i = 0; i < n; i++) {
    const a = rnd() * TAU2, z = lerp(z0, z1, rnd());
    const ca = Math.cos(a), sa = Math.sin(a);
    const d = lerp(0.010, o.d || 0.045, Math.pow(rnd(), 1.6));
    const w = lerp(0.010, 0.045, rnd()), h = lerp(0.008, Math.min(0.05, (z1 - z0) * 0.42), rnd());
    box(M, [ca * (r + d), sa * (r + d), z], scl([ca, sa, 0], d), scl([-sa, ca, 0], w), [0, 0, h],
      mats[(rnd() * mats.length) | 0], 6);
  }
}
// A truss run between two radii: parallel chords plus the zig-zag web between
// them. A solid beam is a stick; a truss is a STRUCTURE, and the difference shows
// most at the silhouette, where you see through it to the stars.
function trussRun(M, a, rA, rB, z, w, bays, m) {
  const ca = Math.cos(a), sa = Math.sin(a);
  const P = (r, dz, dt) => [ca * r - sa * dt, sa * r + ca * dt, z + dz];
  const t = w, hh = w;
  for (const [dz, dt] of [[hh, 0], [-hh, 0], [0, t], [0, -t]])
    beam(M, P(rA, dz, dt), P(rB, dz, dt), w * 0.30, m);
  for (let i = 0; i < bays; i++) {
    const r0 = lerp(rA, rB, i / bays), r1 = lerp(rA, rB, (i + 1) / bays);
    beam(M, P(r0, hh, 0), P(r1, -hh, 0), w * 0.20, m);
    beam(M, P(r0, 0, t), P(r1, 0, -t), w * 0.20, m);
    beam(M, P(r1, hh, 0), P(r1, -hh, 0), w * 0.20, m);
  }
}
// A dish: the one curved silhouette that instantly says "this thing listens".
function dish(M, o, ax, r, depth, m) {
  const [u, v, a] = basis(ax);
  const seg = 26, rings = 5;
  const pt = (rr, k) => {
    const dz = -depth * (1 - (rr / r) * (rr / r));
    return [o[0] + u[0] * Math.cos(k) * rr + v[0] * Math.sin(k) * rr + a[0] * dz,
            o[1] + u[1] * Math.cos(k) * rr + v[1] * Math.sin(k) * rr + a[1] * dz,
            o[2] + u[2] * Math.cos(k) * rr + v[2] * Math.sin(k) * rr + a[2] * dz];
  };
  for (let i = 0; i < rings; i++) {
    const r0 = r * (i / rings), r1 = r * ((i + 1) / rings);
    for (let j = 0; j < seg; j++) {
      const k0 = j / seg * TAU2, k1 = (j + 1) / seg * TAU2;
      M.quad(pt(r0, k0), pt(r1, k0), pt(r1, k1), pt(r0, k1), m);
    }
  }
  beam(M, o, [o[0] + a[0] * r * 0.75, o[1] + a[1] * r * 0.75, o[2] + a[2] * r * 0.75], r * 0.035, m);
}
// A solar array on a boom. Cell lines come from the panel-line material, so the
// wing is one quad that still reads as hundreds of cells.
function array(M, o, ax, span, chord, mBoom, mPanel, out) {
  const [u, v, a] = basis(ax);
  const c = [o[0] + a[0] * out, o[1] + a[1] * out, o[2] + a[2] * out];
  beam(M, o, c, span * 0.018, mBoom);
  const hx = span * 0.5, hy = chord * 0.5;
  const P = (s, t) => [c[0] + a[0] * s + u[0] * t, c[1] + a[1] * s + u[1] * t, c[2] + a[2] * s + u[2] * t];
  M.quad(P(-hx, -hy), P(hx, -hy), P(hx, hy), P(-hx, hy), mPanel, [[0, 0], [1, 0], [1, 1], [0, 1]]);
  M.quad(P(-hx, hy), P(hx, hy), P(hx, -hy), P(-hx, -hy), mPanel, [[0, 0], [1, 0], [1, 1], [0, 1]]);
  for (const s of [-hx, hx]) beam(M, P(s, -hy), P(s, hy), span * 0.010, mBoom);
}

// ---------------------------------------------------------------- materials
// REAL STEEL. The values matter more than the hues: a hull painted one mid grey
// is a clay model however well it is lit, so the set runs from near-white trim
// down to a dark that is almost the void, and every part is jittered off its
// base. Panel lines are cylindrical on the ring structures (they follow the way
// the thing was actually assembled) and cartesian on the loose hardware.
function palette(M, o) {
  o = o || {};
  const acc = o.accent || [78, 226, 246];
  // Panel lines belong on the big assembled surfaces only. Run them over the
  // greebles too and every 3cm crate gets bisected, which reads as tiling.
  const RING_PL = { m: 'cyl', f: [104, 17, 0], w: 0.040 };
  return {
    hull:  M.mat({ a: [126, 131, 140], g: 42, s: 0.46, pl: RING_PL, jit: 0.26, grime: 0.66 }),
    hull2: M.mat({ a: [ 90,  95, 104], g: 34, s: 0.38, pl: RING_PL, jit: 0.30, grime: 0.76 }),
    // the greeble deck: no lines, wide tonal spread, so a hundred crates never
    // read as one moulded surface
    dark:  M.mat({ a: [ 46,  50,  58], g: 26, s: 0.26, pl: null, jit: 0.42, grime: 0.78 }),
    light: M.mat({ a: [158, 162, 170], g: 54, s: 0.55, pl: null, jit: 0.38, grime: 0.56 }),
    mid:   M.mat({ a: [ 98, 103, 112], g: 36, s: 0.40, pl: null, jit: 0.44, grime: 0.70 }),
    truss: M.mat({ a: [ 80,  85,  94], g: 30, s: 0.34, pl: null, jit: 0.28, grime: 0.68 }),
    panel: M.mat({ a: [ 20,  28,  56], g: 140, s: 0.92, pl: { m: 'cart', f: [58, 58, 58], w: 0.055 }, jit: 0.10, grime: 0.26 }),
    rad:   M.mat({ a: [190, 194, 200], g: 18, s: 0.16, pl: { m: 'cart', f: [30, 30, 30], w: 0.06 }, jit: 0.10, grime: 0.44 }),
    haz:   M.mat({ a: [184,  88,  34], g: 30, s: 0.34, pl: null, jit: 0.18, grime: 0.60 }),
    win:   M.mat({ a: [24, 23, 22], g: 20, s: 0.12, e: 0.62, ec: [255, 192, 112], eJit: 1, jit: 0, grime: 0.25 }),
    winC:  M.mat({ a: [22, 26, 32], g: 20, s: 0.12, e: 0.50, ec: [150, 210, 255], eJit: 1, jit: 0, grime: 0.25 }),
    field: M.mat({ a: [ 6, 16, 20], g: 20, s: 0.05, e: 0.62, ec: acc, eCyl: [7.5, 2.6], eRad: [0.06, 0.80, 2.4], jit: 0, grime: 0 })
  };
}

// A row of lit windows round a wall. Boxes rather than painted rectangles: a
// window is a hole with light behind it, so it gets a frame and a recess, and the
// AO puts a shadow in the frame.
function winRow(M, r, z, n, mw, o) {
  o = o || {};
  const w = o.w || 0.016, h = o.h || 0.020, d = o.d || 0.006, sgn = o.inward ? -1 : 1;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU2 + (o.p || 0);
    if (o.skip && o.skip(a)) continue;
    const ca = Math.cos(a), sa = Math.sin(a);
    // set mostly INTO the wall, with a shallow lip proud of it. A pane that
    // stands off the hull by its own depth is a stud, not a window.
    const rr = r + d * 0.28 * sgn;
    box(M, [ca * rr, sa * rr, z], scl([ca * sgn, sa * sgn, 0], d), scl([-sa, ca, 0], w), [0, 0, h], mw, 1);
  }
}

// ================================================================ ARCHETYPES

// ---- A. TRUSS DISC / DRYDOCK ----------------------------------------------
// The AKAI reference: concentric structural rings tied together by radial trusses,
// with the whole face packed in machinery. Reads as something BUILT rather than
// moulded, because you can see how it is held together.
function truss_disc(M, seed) {
  const rnd = rng(seed || 3311), P = palette(M);
  // THIN plates carrying tall machinery, not fat solid hoops. The reference disc
  // is mostly structure and shadow; what you read as density is the hardware
  // standing proud of a comparatively slim deck, and the gaps you see through.
  const rings = [
    { r0: 0.880, r1: 1.000, z: 0.050, hv: 1 },
    { r0: 0.635, r1: 0.775, z: 0.034 },
    { r0: 0.400, r1: 0.520, z: 0.030 },
    { r0: 0.170, r1: 0.275, z: 0.044 }
  ];
  for (const R of rings) {
    annulus(M, R.r0, R.r1, -R.z, R.z, 84, P.hull, { uvS: 0.55, mIn: P.hull2, mOut: R.hv ? P.hull2 : P.hull });
    greebleRing(M, R.r0 + 0.012, R.r1 - 0.012, R.z, R.hv ? 135 : 72, [P.mid, P.hull2, P.light, P.dark], rnd, { h: R.hv ? 0.105 : 0.078 });
    greebleRing(M, R.r0 + 0.012, R.r1 - 0.012, -R.z, R.hv ? 66 : 34, [P.hull2, P.dark, P.mid], rnd, { h: -0.070, h0: -0.010 });
    greebleWall(M, R.r1, -R.z * 0.9, R.z * 0.9, R.hv ? 46 : 22, [P.hull2, P.dark, P.light], rnd, { d: 0.055 });
  }
  // the radial structure that ties them: heavy trusses alternating with light spars
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU2 + 0.13;
    trussRun(M, a, 0.24, 0.99, 0, 0.034, 11, P.truss);
    box(M, [Math.cos(a) * 0.83, Math.sin(a) * 0.83, 0.070],
      scl([Math.cos(a), Math.sin(a), 0], 0.055), scl([-Math.sin(a), Math.cos(a), 0], 0.042), [0, 0, 0.070], P.mid, 5);
  }
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * TAU2 + 0.13 + TAU2 / 48;
    beam(M, [Math.cos(a) * 0.26, Math.sin(a) * 0.26, 0], [Math.cos(a) * 0.98, Math.sin(a) * 0.98, 0], 0.010, P.truss);
  }
  // hub: a stack of drums with a spire, so the eye has somewhere to land
  cyl(M, [0, 0, 0.02], [0, 0, 1], 0.175, 0.175, 44, P.hull, true);
  cyl(M, [0, 0, 0.21], [0, 0, 1], 0.135, 0.055, 40, P.light, true);
  cyl(M, [0, 0, -0.20], [0, 0, 1], 0.115, 0.050, 36, P.hull2, true);
  cyl(M, [0, 0, 0.36], [0, 0, 1], 0.030, 0.120, 16, P.hull2, true);
  cyl(M, [0, 0, 0.50], [0, 0, 1], 0.070, 0.030, 24, P.light, true);
  winRow(M, 0.176, 0.06, 34, P.win, { w: 0.009, h: 0.020, d: 0.006 });
  winRow(M, 0.176, -0.05, 34, P.win, { w: 0.009, h: 0.020, d: 0.006 });
  greebleRing(M, 0.05, 0.16, 0.195, 30, [P.mid, P.dark, P.light], rnd, { h: 0.040 });
  // window bands on the inner walls of the big rings — the inhabited part
  for (const R of rings.slice(0, 3)) {
    winRow(M, R.r0, 0, 84, P.win, { inward: 1, w: 0.0085, h: 0.030, d: 0.006 });
    winRow(M, R.r1, 0, 84, P.win, { w: 0.0085, h: 0.030, d: 0.006 });
  }
  // hangar throats cut into the rim: real recesses, lit from inside
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU2 + 0.9, ca = Math.cos(a), sa = Math.sin(a);
    box(M, [ca * 0.955, sa * 0.955, 0], scl([ca, sa, 0], 0.050), scl([-sa, ca, 0], 0.075), [0, 0, 0.045], P.dark, 3);
    box(M, [ca * 0.925, sa * 0.925, 0], scl([ca, sa, 0], 0.012), scl([-sa, ca, 0], 0.058), [0, 0, 0.032], P.win, 1);
  }
  // antennae and arrays — the things that stop the outline being a circle
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * TAU2 + 2.0;
    beam(M, [Math.cos(a) * 0.98, Math.sin(a) * 0.98, 0.02], [Math.cos(a) * 1.30, Math.sin(a) * 1.30, 0.16], 0.007, P.truss);
  }
  dish(M, [0.52, -0.62, 0.30], [0.30, -0.42, 0.86], 0.13, 0.055, P.light);
  array(M, [0, 0, 0.30], [-0.72, 0.69, 0.06], 0.62, 0.20, P.truss, P.panel, 1.28);
  array(M, [0, 0, -0.24], [0.72, -0.69, -0.06], 0.62, 0.20, P.truss, P.panel, 1.28);
  // running lights: red round the rim, white on the masts
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * TAU2;
    M.lamp([Math.cos(a) * 1.002, Math.sin(a) * 1.002, 0.056], [255, 74, 60], 0.010, i * 0.37, 0.9);
  }
  M.lamp([0, 0, 0.535], [255, 255, 255], 0.016, 0, 1.6);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU2 + 0.4;
    M.lamp([Math.cos(a) * 0.69, Math.sin(a) * 0.69, 0.040], [190, 230, 255], 0.008, i * 0.8, 0.55);
  }
  return M;
}

// ---- B. CORIOLIS FORTRESS RING ---------------------------------------------
// The shipped silhouette, rebuilt as a solid: a thick armoured hoop with a real
// hole cut through it for the docking mouth, spokes to a pressurised core, and
// enough hardware on the outer wall that the circle stops being a circle.
function fortress(M, seed) {
  const rnd = rng(seed || 8821), P = palette(M);
  const DOCK = [-0.30, 0.30];
  annulus(M, 0.665, 1.0, -0.205, 0.205, 60, P.hull,
    { uvS: 0.7, gap: DOCK, mIn: P.hull2, mOut: P.hull, mCut: P.dark });
  // armour plating: a shallow raised plate per bay, which is what gives the wall
  // its plate seams and its edge speculars
  for (let i = 0; i < 30; i++) {
    const a = (i / 30) * TAU2 + TAU2 / 60;
    if (a > DOCK[0] + TAU2 && a < DOCK[1] + TAU2) continue;
    if (Math.cos(a - 0) > Math.cos(0.34)) continue;
    const ca = Math.cos(a), sa = Math.sin(a);
    box(M, [ca * 1.012, sa * 1.012, 0], scl([ca, sa, 0], 0.014), scl([-sa, ca, 0], 0.088), [0, 0, 0.165], P.hull2, 3);
  }
  greebleRing(M, 0.685, 0.985, 0.205, 145, [P.mid, P.hull2, P.light, P.dark], rnd, { h: 0.070 });
  greebleRing(M, 0.685, 0.985, -0.205, 66, [P.hull2, P.dark, P.mid], rnd, { h: -0.048, h0: -0.008 });
  greebleWall(M, 1.0, -0.17, 0.17, 52, [P.hull2, P.dark, P.mid, P.light], rnd, { d: 0.060 });
  // the docking mouth as a real recess: cut walls, a dark bay, a lit throat and a
  // lip. You can see INTO it, which is the whole difference from a painted slot.
  {
    const am = (DOCK[0] + DOCK[1]) * 0.5, ca = Math.cos(am), sa = Math.sin(am);
    for (const s of [-1, 1]) {
      const a = s > 0 ? DOCK[1] : DOCK[0];
      box(M, [Math.cos(a) * 0.83, Math.sin(a) * 0.83, 0],
        scl([Math.cos(a), Math.sin(a), 0], 0.17), scl([-Math.sin(a), Math.cos(a), 0], 0.012), [0, 0, 0.205], P.dark, 4);
    }
    box(M, [ca * 0.70, sa * 0.70, 0], scl([ca, sa, 0], 0.030), scl([-sa, ca, 0], 0.185), [0, 0, 0.175], P.dark, 3);
    box(M, [ca * 0.735, sa * 0.735, 0], scl([ca, sa, 0], 0.008), scl([-sa, ca, 0], 0.150), [0, 0, 0.120], P.win, 1);
    for (const z of [0.17, -0.17]) for (const t of [-1, 1])
      box(M, [ca * 0.90 - sa * t * 0.20, sa * 0.90 + ca * t * 0.20, z], scl([ca, sa, 0], 0.10), scl([-sa, ca, 0], 0.012), [0, 0, 0.014], P.haz, 3);
  }
  // window bands on the inner wall — the habitable face, looking across the middle
  const skip = a => { const t = Math.atan2(Math.sin(a), Math.cos(a)); return t > DOCK[0] - 0.1 && t < DOCK[1] + 0.1; };
  winRow(M, 0.665, 0.085, 86, P.win, { inward: 1, w: 0.0090, h: 0.026, d: 0.007, skip });
  winRow(M, 0.665, -0.020, 86, P.win, { inward: 1, w: 0.0090, h: 0.026, d: 0.007, skip });
  winRow(M, 0.665, -0.125, 86, P.win, { inward: 1, w: 0.0090, h: 0.020, d: 0.007, skip });
  // spokes and core
  for (let i = 0; i < 4; i++) trussRun(M, (i / 4) * TAU2 + 0.78, 0.21, 0.67, 0, 0.040, 6, P.truss);
  cyl(M, [0, 0, 0], [0, 0, 1], 0.205, 0.235, 44, P.hull, true);
  cyl(M, [0, 0, 0.255], [0, 0, 1], 0.150, 0.045, 36, P.light, true);
  cyl(M, [0, 0, -0.255], [0, 0, 1], 0.150, 0.045, 36, P.hull2, true);
  winRow(M, 0.206, 0.10, 34, P.win, { w: 0.0095, h: 0.024, d: 0.007 });
  winRow(M, 0.206, -0.02, 34, P.win, { w: 0.0095, h: 0.024, d: 0.007 });
  greebleRing(M, 0.03, 0.14, 0.300, 24, [P.mid, P.dark, P.light], rnd, { h: 0.036 });
  // docking ports round the core: little stubs with lit collars
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU2 + 0.3, ca = Math.cos(a), sa = Math.sin(a);
    cyl(M, [ca * 0.245, sa * 0.245, 0.14], [ca, sa, 0], 0.028, 0.045, 14, P.light, true);
    M.lamp([ca * 0.295, sa * 0.295, 0.14], [140, 230, 255], 0.009, i * 1.1, 1.3);
  }
  // mast
  beam(M, [0, 0, 0.30], [0, 0, 0.86], 0.011, P.truss);
  for (let i = 1; i <= 4; i++) {
    const z = 0.30 + (0.56 * i / 5), w = 0.045 * (1 - i / 6);
    beam(M, [-w, 0, z], [w, 0, z], 0.007, P.truss);
    beam(M, [0, -w, z], [0, w, z], 0.007, P.truss);
  }
  dish(M, [0, 0, 0.88], [0.18, -0.36, 0.92], 0.10, 0.042, P.light);
  // arrays and radiators
  array(M, [0, 0, 0.05], [-0.985, 0.174, 0], 0.70, 0.26, P.truss, P.panel, 1.42);
  array(M, [0, 0, -0.05], [0.985, -0.174, 0], 0.70, 0.26, P.truss, P.panel, 1.42);
  for (const s of [-1, 1]) {
    const a = 1.9 + (s > 0 ? 0 : Math.PI), ca = Math.cos(a), sa = Math.sin(a);
    beam(M, [ca * 0.20, sa * 0.20, 0.10], [ca * 0.55, sa * 0.55, 0.32], 0.010, P.truss);
    box(M, [ca * 0.66, sa * 0.66, 0.40], scl([ca, sa, 0], 0.18), scl([-sa, ca, 0], 0.115), [0, 0, 0.004], P.rad, 4);
  }
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * TAU2;
    M.lamp([Math.cos(a) * 1.004, Math.sin(a) * 1.004, 0.212], [255, 74, 60], 0.011, i * 0.41, 0.85);
  }
  M.lamp([0, 0, 0.875], [255, 255, 255], 0.017, 0, 1.7);
  return M;
}

// ---- C. SPINE & TORUS -------------------------------------------------------
// The classic: a long axial spine with habitat hoops threaded on it. Its whole
// character is the LENGTH — a station that is plainly bigger than it is wide.
function spine(M, seed) {
  const rnd = rng(seed || 5507), P = palette(M);
  // the spine, in segments so it has collars and joins rather than being a rod
  cyl(M, [0, 0, 0], [0, 0, 1], 0.072, 1.85, 30, P.hull, true);
  for (let i = -7; i <= 7; i++) {
    cyl(M, [0, 0, i * 0.235], [0, 0, 1], 0.092, 0.020, 26, P.light, true);
  }
  greebleWall(M, 0.072, -1.74, 1.74, 130, [P.hull2, P.dark, P.mid, P.light], rnd, { d: 0.032 });
  // modules and tanks strung along it
  cyl(M, [0, 0, -1.24], [0, 0, 1], 0.150, 0.215, 30, P.hull, true);
  winRow(M, 0.151, -1.24, 26, P.win, { w: 0.010, h: 0.024, d: 0.007 });
  sphere(M, [0, 0, -1.72], 0.128, 26, 16, P.light);
  cyl(M, [0, 0, 1.06], [0, 0, 1], 0.125, 0.170, 26, P.hull, true);
  winRow(M, 0.126, 1.06, 24, P.win, { w: 0.010, h: 0.022, d: 0.007 });
  sphere(M, [0.165, 0.07, -0.28], 0.078, 22, 14, P.light);
  sphere(M, [-0.165, -0.07, -0.28], 0.078, 22, 14, P.light);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU2 + 0.4, ca = Math.cos(a), sa = Math.sin(a), z = lerp(-1.0, 0.9, rnd());
    cyl(M, [ca * 0.12, sa * 0.12, z], [ca, sa, 0], 0.042, 0.075, 16, P.hull2, true);
  }
  // the hoops
  const hoop = (R, r, z, spokes, wins) => {
    torus(M, R, r, 96, 22, P.hull, z);
    // a rib every few degrees, so the hoop is a built structure not a doughnut
    for (let i = 0; i < 36; i++) {
      const a = (i / 36) * TAU2, ca = Math.cos(a), sa = Math.sin(a);
      box(M, [ca * R, sa * R, z], scl([ca, sa, 0], r * 1.10), scl([-sa, ca, 0], r * 0.16), [0, 0, r * 1.10], P.hull2, 4);
    }
    greebleRing(M, R - r * 0.5, R + r * 0.5, z + r * 0.92, wins ? 52 : 24, [P.mid, P.light, P.dark], rnd, { h: 0.030 });
    for (let i = 0; i < spokes; i++) trussRun(M, (i / spokes) * TAU2 + 0.2, 0.06, R - r * 0.8, z, r * 0.55, 7, P.truss);
    if (wins) {
      winRow(M, R + r * 0.96, z, 84, P.win, { w: 0.010, h: 0.016, d: 0.005 });
      winRow(M, R - r * 0.96, z, 84, P.win, { inward: 1, w: 0.010, h: 0.016, d: 0.005 });
    }
  };
  hoop(0.780, 0.108, 0.360, 8, 1);
  hoop(0.440, 0.068, -0.780, 6, 1);
  // arrays out of the lower spine, a dish off the top
  array(M, [0, 0, -1.55], [-0.94, 0.34, 0], 0.62, 0.24, P.truss, P.panel, 0.95);
  array(M, [0, 0, -1.55], [0.94, -0.34, 0], 0.62, 0.24, P.truss, P.panel, 0.95);
  dish(M, [0, 0, 1.92], [0.22, -0.34, 0.91], 0.17, 0.070, P.light);
  for (let i = 0; i < 7; i++) M.lamp([0, 0, -1.60 + i * 0.52], [255, 74, 60], 0.010, i * 0.6, 0.8);
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * TAU2;
    M.lamp([Math.cos(a) * 0.890, Math.sin(a) * 0.890, 0.360], [190, 230, 255], 0.008, i * 0.45, 0.7);
  }
  M.lamp([0, 0, 1.99], [255, 255, 255], 0.014, 0, 1.5);
  return M;
}

// ---- D. TOWER & DOCKING ARMS ------------------------------------------------
// A working PORT. The tower is the authority, the ring is the town, and the piers
// are why anyone is here — with hulls moored alongside them for scale.
function port(M, seed) {
  const rnd = rng(seed || 9143), P = palette(M);
  // tower
  cyl(M, [0, 0, -0.36], [0, 0, 1], 0.230, 0.170, 34, P.hull, true);
  cyl(M, [0, 0, 0.10], [0, 0, 1], 0.140, 0.310, 30, P.hull, true);
  cyl(M, [0, 0, 0.47], [0, 0, 1], 0.255, 0.075, 36, P.light, true);
  cyl(M, [0, 0, 0.575], [0, 0, 1], 0.165, 0.045, 30, P.hull2, true);
  cyl(M, [0, 0, 0.78], [0, 0, 1], 0.028, 0.170, 14, P.hull2, true);
  greebleWall(M, 0.140, -0.15, 0.38, 40, [P.hull2, P.dark, P.mid, P.light], rnd, { d: 0.035 });
  greebleRing(M, 0.05, 0.24, 0.545, 26, [P.mid, P.dark, P.light], rnd, { h: 0.032 });
  winRow(M, 0.256, 0.47, 34, P.win, { w: 0.016, h: 0.044, d: 0.008 });
  winRow(M, 0.141, 0.30, 26, P.win, { w: 0.012, h: 0.020, d: 0.007 });
  winRow(M, 0.141, 0.16, 26, P.win, { w: 0.012, h: 0.020, d: 0.007 });
  winRow(M, 0.141, 0.02, 26, P.win, { w: 0.012, h: 0.020, d: 0.007 });
  winRow(M, 0.231, -0.36, 30, P.win, { w: 0.014, h: 0.030, d: 0.008 });
  dish(M, [0.20, -0.16, 0.60], [0.42, -0.34, 0.84], 0.11, 0.046, P.light);
  // the town ring
  annulus(M, 0.560, 0.815, -0.055, 0.075, 72, P.hull, { uvS: 0.6, mIn: P.hull2 });
  greebleRing(M, 0.575, 0.800, 0.075, 118, [P.mid, P.hull2, P.light, P.dark], rnd, { h: 0.060 });
  greebleRing(M, 0.575, 0.800, -0.055, 50, [P.hull2, P.dark, P.mid], rnd, { h: -0.036, h0: -0.006 });
  greebleWall(M, 0.815, -0.045, 0.065, 34, [P.hull2, P.dark, P.mid, P.light], rnd, { d: 0.042 });
  winRow(M, 0.560, 0.010, 66, P.win, { inward: 1, w: 0.012, h: 0.024, d: 0.007 });
  winRow(M, 0.816, 0.010, 66, P.win, { w: 0.012, h: 0.024, d: 0.007 });
  for (let i = 0; i < 6; i++) trussRun(M, (i / 6) * TAU2 + 0.45, 0.15, 0.565, 0.01, 0.030, 5, P.truss);
  // the piers, and what is tied up to them
  const PIERS = 5;
  for (let i = 0; i < PIERS; i++) {
    const a = (i / PIERS) * TAU2 + 0.62, ca = Math.cos(a), sa = Math.sin(a);
    const rad = [ca, sa, 0], tan = [-sa, ca, 0];
    trussRun(M, a, 0.80, 1.46, -0.10, 0.033, 11, P.truss);
    for (let k = 0; k < 4; k++) {
      const r = lerp(0.88, 1.38, (k + 0.5) / 4);
      box(M, [ca * r, sa * r, -0.10], scl(rad, 0.045), scl(tan, 0.060), [0, 0, 0.052], P.hull2, 5);
      box(M, [ca * r, sa * r, -0.155], scl(rad, 0.020), scl(tan, 0.030), [0, 0, 0.020], P.win, 1);
    }
    box(M, [ca * 1.46, sa * 1.46, -0.10], scl(rad, 0.030), scl(tan, 0.085), [0, 0, 0.070], P.hull, 4);
    M.lamp([ca * 1.50, sa * 1.50, -0.10], [255, 74, 60], 0.011, i * 0.7, 1.0);
    // a moored hull on some of the piers — the scale cue that makes the pier a pier
    if (i % 2 === 0) {
      const off = 0.135, cx = ca * 1.14 - sa * off, cy2 = sa * 1.14 + ca * off;
      box(M, [cx, cy2, -0.10], scl(rad, 0.235), scl(tan, 0.048), [0, 0, 0.046], P.light, 5);
      box(M, [cx - rad[0] * 0.20, cy2 - rad[1] * 0.20, -0.10], scl(rad, 0.055), scl(tan, 0.030), [0, 0, 0.030], P.hull2, 4);
      box(M, [cx + rad[0] * 0.26, cy2 + rad[1] * 0.26, -0.10], scl(rad, 0.030), scl(tan, 0.036), [0, 0, 0.034], P.dark, 3);
      M.lamp([cx + rad[0] * 0.30, cy2 + rad[1] * 0.30, -0.10], [150, 220, 255], 0.014, i * 1.3, 0.6);
      beam(M, [ca * 1.14, sa * 1.14, -0.10], [cx - tan[0] * 0.05, cy2 - tan[1] * 0.05, -0.10], 0.012, P.truss);
    }
  }
  array(M, [0, 0, 0.20], [-0.62, -0.78, 0.10], 0.52, 0.20, P.truss, P.panel, 1.22);
  array(M, [0, 0, 0.20], [0.62, 0.78, 0.10], 0.52, 0.20, P.truss, P.panel, 1.22);
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * TAU2;
    M.lamp([Math.cos(a) * 0.820, Math.sin(a) * 0.820, 0.078], [190, 230, 255], 0.008, i * 0.5, 0.6);
  }
  M.lamp([0, 0, 0.965], [255, 255, 255], 0.016, 0, 1.8);
  return M;
}

// ---- E. THE GATE ------------------------------------------------------------
// The aperture is the point, but the aperture is not the OBJECT: what sells it is
// the hardware that holds it open. Heavy emitter housings round a machined ring,
// bracing between them, and the field itself sitting inside real metal.
function gate(M, seed, accent) {
  const rnd = rng(seed || 4409), P = palette(M, { accent: accent || [78, 226, 246] });
  annulus(M, 0.755, 1.0, -0.145, 0.145, 72, P.hull, { uvS: 0.7, mIn: P.hull2 });
  greebleRing(M, 0.770, 0.985, 0.145, 110, [P.mid, P.hull2, P.light, P.dark], rnd, { h: 0.052 });
  greebleRing(M, 0.770, 0.985, -0.145, 40, [P.hull2, P.dark, P.mid], rnd, { h: -0.034, h0: -0.006 });
  greebleWall(M, 1.0, -0.12, 0.12, 48, [P.hull2, P.dark, P.mid, P.light], rnd, { d: 0.052 });
  // eight emitters, each a housing with a lit throat aimed at the axis
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU2 + 0.2, ca = Math.cos(a), sa = Math.sin(a);
    const rad = [ca, sa, 0], tan = [-sa, ca, 0];
    box(M, [ca * 0.905, sa * 0.905, 0], scl(rad, 0.115), scl(tan, 0.078), [0, 0, 0.195], P.hull, 4);
    box(M, [ca * 0.905, sa * 0.905, 0.215], scl(rad, 0.075), scl(tan, 0.050), [0, 0, 0.030], P.mid, 4);
    cyl(M, [ca * 0.775, sa * 0.775, 0], [ca, sa, 0], 0.058, 0.045, 20, P.hull2, true);
    cyl(M, [ca * 0.735, sa * 0.735, 0], [ca, sa, 0], 0.040, 0.012, 20, P.field, true);
    // coil stacks and cooling banks either side of each emitter — the machinery
    // that makes the aperture cost something to hold open
    for (const t2 of [-1, 1]) {
      const b2 = a + t2 * 0.14;
      cyl(M, [Math.cos(b2) * 0.865, Math.sin(b2) * 0.865, 0.135], [0, 0, 1], 0.030, 0.075, 16, P.mid, true);
      box(M, [Math.cos(b2) * 0.955, Math.sin(b2) * 0.955, -0.055],
        scl([Math.cos(b2), Math.sin(b2), 0], 0.048), scl([-Math.sin(b2), Math.cos(b2), 0], 0.030), [0, 0, 0.075], P.dark, 4);
    }
    box(M, [ca * 0.905, sa * 0.905, -0.215], scl(rad, 0.065), scl(tan, 0.044), [0, 0, 0.030], P.hull2, 4);
    M.lamp([ca * 0.905, sa * 0.905, 0.250], [255, 74, 60], 0.012, i * 0.55, 1.1);
    // bracing out to the rim between emitters
    const b = a + TAU2 / 16;
    beam(M, [ca * 0.905, sa * 0.905, 0.16], [Math.cos(b) * 0.99, Math.sin(b) * 0.99, 0.02], 0.014, P.truss);
    beam(M, [ca * 0.905, sa * 0.905, -0.16], [Math.cos(b) * 0.99, Math.sin(b) * 0.99, -0.02], 0.014, P.truss);
  }
  // the aperture: a shallow dish of field, so it has a surface that catches the
  // eye rather than being a flat disc of colour
  {
    const seg = 64, rings = 6, rMax = 0.735;
    for (let i = 0; i < rings; i++) {
      const r0 = rMax * (i / rings), r1 = rMax * ((i + 1) / rings);
      for (let j = 0; j < seg; j++) {
        const k0 = (j / seg) * TAU2, k1 = ((j + 1) / seg) * TAU2;
        const zz = r => -0.055 * (1 - (r / rMax) * (r / rMax));
        M.quad([Math.cos(k0) * r0, Math.sin(k0) * r0, zz(r0)],
               [Math.cos(k0) * r1, Math.sin(k0) * r1, zz(r1)],
               [Math.cos(k1) * r1, Math.sin(k1) * r1, zz(r1)],
               [Math.cos(k1) * r0, Math.sin(k1) * r0, zz(r0)], P.field);
      }
    }
  }
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * TAU2;
    M.lamp([Math.cos(a) * 1.004, Math.sin(a) * 1.004, 0.150], [255, 74, 60], 0.009, i * 0.33, 0.75);
  }
  return M;
}

const ARCHETYPES = {
  'truss disc': truss_disc,
  'fortress ring': fortress,
  'spine & torus': spine,
  'port & piers': port,
  'gate': gate
};
