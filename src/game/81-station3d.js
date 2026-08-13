'use strict';
// ---------- STATIONS AND GATES, BUILT RATHER THAN DRAWN ----------
//
// What stood here before was vector art: a torus of 26 facets, one gradient each,
// a perfect circular outline. Beside a per-pixel-shaded planet six inches away it
// read as a drawing, and two redesigns inside that model did not change it —
// because the problem was never linework. It was that nothing turned against a
// light, nothing cast onto anything, and every surface was the same grey.
//
// Those are geometry problems. So a station is GEOMETRY here — real parts, a real
// sun, a shadow map — rendered once into a sprite and cached, exactly the bargain
// the planets already make. A bake can afford to be slow and physically honest in
// a way a per-frame draw never could.
//
//   geometry -> shadow map -> G-buffer -> occlusion -> shade -> bloom -> sprite
//
// The bake is CHUNKED (see s3renderSteps): it yields between slices of work, so
// the whole thing runs a few milliseconds at a time on the menu instead of
// freezing the frame for half a second. Until a build's sprite exists, s3draw
// stands its own placeholder mass there (s3placeholder) — the old vector torus is
// gone, and with it the second, incompatible idea of what a station looks like.


// >>> DEST-S3D
// The renderer and the five builds. Lifted verbatim by the destinations lab, so
// it may reach only S3D_LIGHT, S3D_LAMPS, lerp and the DOM (for its own offscreen
// canvases). Nothing here touches game state.
//
// Names are prefixed because every file in src/game/ shares one global scope, and
// `box` / `render` / `add` are not names to claim across a whole game.
// The blink model itself. The numbers it reads live in DEST-DATA with every
// other destination dial; this is the code that turns them into a brightness.
function s3lamp(kind, t, ph) {
  const B = S3D_LAMPS;
  if (kind === 'beacon') {
    const k = 0.5 + 0.5 * Math.sin((t / B.beaconP + ph) * 6.2831853);
    return 0.06 + 0.94 * Math.pow(k, B.beaconD);   // long dark, short swell
  }
  if (kind === 'strobe') {
    const u = ((t / B.strobeP + ph) % 1 + 1) % 1;
    const f = (c) => Math.max(0, 1 - Math.abs(u - c) / B.strobeW);
    return 0.05 + 0.95 * Math.min(1, f(0.02) + f(0.02 + B.strobeGap));
  }
  if (kind === 'slow') {
    const u = ((t / B.slowP + ph) % 1 + 1) % 1;
    return u < B.slowOff ? 0.08 : 0.92;
  }
  return 1 - B.steadyK + B.steadyK * Math.sin(t * B.steadyP + ph * 6.2831853);
}
const V3dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const V3cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const V3sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const V3scl = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const V3norm = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const S3_ZUP = [0, 0, 1];
const s3clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;
function s3hash(a, b, c) {
  let h = Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul(c | 0, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function s3vnoise(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const sx = xf * xf * (3 - 2 * xf), sy = yf * yf * (3 - 2 * yf), sz = zf * zf * (3 - 2 * zf);
  let r = 0;
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) for (let k = 0; k < 2; k++)
    r += (i ? sx : 1 - sx) * (j ? sy : 1 - sy) * (k ? sz : 1 - sz) * s3hash(xi + i, yi + j, zi + k);
  return r;
}
function s3fbm(x, y, z, oct) {
  let a = 0.5, f = 1, s = 0;
  for (let i = 0; i < oct; i++) { s += a * s3vnoise(x * f, y * f, z * f); f *= 2.03; a *= 0.5; }
  return s / (1 - Math.pow(0.5, oct)) * 0.5;
}
function s3rng(seed) {
  let s = (seed >>> 0) || 1;
  return () => {
    s = Math.imul(s ^ (s >>> 15), 2246822507);
    s = Math.imul(s ^ (s >>> 13), 3266489909);
    return ((s ^ (s >>> 16)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------- the mesh
class S3Mesh {
  constructor() {
    this.P = []; this.N = []; this.UV = []; this.T = [];
    this.mats = []; this.lamps = []; this._pid = 0;
  }
  mat(m) {
    const M = Object.assign({
      a: [140, 145, 155], g: 26, s: 0.30, e: 0, ec: [255, 200, 120],
      pl: null, jit: 0.10, grime: 0.55
    }, m);
    // sRGB -> linear ONCE, here. Shading in gamma space was what made the first
    // pass read as grey clay: two stacked gammas crush the whole value range
    // into the middle, and every surface converges on the same mid tone.
    M.al = M.a.map(c => Math.pow(c / 255, 2.2));
    M.el = M.ec.map(c => Math.pow(c / 255, 2.2));
    this.mats.push(M);
    return this.mats.length - 1;
  }
  // A PART is one physical component, and every triangle of it shares a tone.
  // Jittering per triangle gave a crate six different faces, which averages back
  // out to no variation at all.
  part() { return ++this._pid; }
  vert(p, n, uv) {
    this.P.push(p[0], p[1], p[2]); this.N.push(n[0], n[1], n[2]);
    this.UV.push(uv ? uv[0] : 0, uv ? uv[1] : 0);
    return this.P.length / 3 - 1;
  }
  tri(a, b, c, m) { this.T.push(a, b, c, m, this._pid); }
  quad(p0, p1, p2, p3, m, uv) {
    const n = V3norm(V3cross(V3sub(p1, p0), V3sub(p3, p0)));
    const U = uv || [[0, 0], [1, 0], [1, 1], [0, 1]];
    const a = this.vert(p0, n, U[0]), b = this.vert(p1, n, U[1]);
    const c = this.vert(p2, n, U[2]), d = this.vert(p3, n, U[3]);
    this.tri(a, b, c, m); this.tri(a, c, d, m);
  }
  // A LAMP IS A POSITION, NOT A PIXEL. It comes back out of the bake as screen
  // coordinates so the game can draw it live and blink it — which is the whole
  // reason the station reads as occupied rather than as a photograph of one.
  lamp(p, c, r, ph, kind) { this.lamps.push({ p, c, r, ph: ph || 0, k: kind || 'steady' }); }
  // STAND A BUILD UP. Rotating about X after the fact is what lets a ring built in
  // the XY plane read as a PORTAL rather than as a hoop lying on a table: the bake's
  // camera sits 32° above that plane (S3D_LIGHT.el), so an XY ring projects to a
  // squashed horizontal ellipse, while an XZ one stands almost square to the lens
  // with its mouth toward the viewer.
  //
  // Positions AND NORMALS AND LAMPS. Rotating positions alone would leave every
  // surface lit as though it still faced the old way — the shading would slide off
  // the geometry — and leave the blinking lamps hanging where the hull used to be.
  rotX(a) {
    const c = Math.cos(a), s = Math.sin(a);
    for (const A of [this.P, this.N]) {
      for (let i = 0; i < A.length; i += 3) {
        const y = A[i + 1], z = A[i + 2];
        A[i + 1] = y * c - z * s; A[i + 2] = y * s + z * c;
      }
    }
    for (const L of this.lamps) {
      const y = L.p[1], z = L.p[2];
      L.p = [L.p[0], y * c - z * s, y * s + z * c];
    }
    return this;
  }
  // …and YAW, for pointing a stood-up gate somewhere other than straight at the lens.
  // Applied after rotX, so a gate's mouth swings from facing the camera round to
  // facing left or right — which is the axis a per-location facing would move.
  // Costs nothing until a build declares it.
  rotZ(a) {
    const c = Math.cos(a), s = Math.sin(a);
    for (const A of [this.P, this.N]) {
      for (let i = 0; i < A.length; i += 3) {
        const x = A[i], y = A[i + 1];
        A[i] = x * c - y * s; A[i + 1] = x * s + y * c;
      }
    }
    for (const L of this.lamps) {
      const x = L.p[0], y = L.p[1];
      L.p = [x * c - y * s, x * s + y * c, L.p[2]];
    }
    return this;
  }
}

// ---------------------------------------------------------------- primitives
function s3basis(ax) {
  const a = V3norm(ax);
  const u = V3norm(V3cross(a, Math.abs(a[2]) < 0.9 ? S3_ZUP : [1, 0, 0]));
  return [u, V3cross(a, u), a];
}
// a box from a centre and three half-extent VECTORS
function s3box(M, o, ex, ey, ez, m) {
  M.part();
  const c = (i, j, k) => [o[0] + ex[0] * i + ey[0] * j + ez[0] * k,
                          o[1] + ex[1] * i + ey[1] * j + ez[1] * k,
                          o[2] + ex[2] * i + ey[2] * j + ez[2] * k];
  M.quad(c(1, -1, -1), c(1, 1, -1), c(1, 1, 1), c(1, -1, 1), m);
  M.quad(c(-1, 1, -1), c(-1, -1, -1), c(-1, -1, 1), c(-1, 1, 1), m);
  M.quad(c(1, 1, -1), c(-1, 1, -1), c(-1, 1, 1), c(1, 1, 1), m);
  M.quad(c(-1, -1, -1), c(1, -1, -1), c(1, -1, 1), c(-1, -1, 1), m);
  M.quad(c(-1, -1, 1), c(1, -1, 1), c(1, 1, 1), c(-1, 1, 1), m);
  M.quad(c(-1, 1, -1), c(1, 1, -1), c(1, -1, -1), c(-1, -1, -1), m);
}
// a cylinder with SMOOTH side normals — what makes a drum read as round rather
// than as a stack of flat strips
function s3cyl(M, o, ax, r, hl, seg, m, caps) {
  M.part();
  const [u, v, a] = s3basis(ax);
  const ring = (h) => {
    const out = [];
    for (let i = 0; i < seg; i++) {
      const t = (i / seg) * 6.2831853, cx = Math.cos(t), sy = Math.sin(t);
      const n = V3norm([u[0] * cx + v[0] * sy, u[1] * cx + v[1] * sy, u[2] * cx + v[2] * sy]);
      out.push({ n, t: i / seg,
        p: [o[0] + n[0] * r + a[0] * h, o[1] + n[1] * r + a[1] * h, o[2] + n[2] * r + a[2] * h] });
    }
    return out;
  };
  const A = ring(-hl), B = ring(hl);
  for (let i = 0; i < seg; i++) {
    const j = (i + 1) % seg;
    const i0 = M.vert(A[i].p, A[i].n, [i * 0.5, 0]), i1 = M.vert(A[j].p, A[j].n, [(i + 1) * 0.5, 0]);
    const i2 = M.vert(B[j].p, B[j].n, [(i + 1) * 0.5, hl * 2]), i3 = M.vert(B[i].p, B[i].n, [i * 0.5, hl * 2]);
    M.tri(i0, i1, i2, m); M.tri(i0, i2, i3, m);
  }
  if (caps !== false) for (const [h, nn] of [[-hl, V3scl(a, -1)], [hl, a]]) {
    const cIdx = M.vert([o[0] + a[0] * h, o[1] + a[1] * h, o[2] + a[2] * h], nn, [0.5, 0.5]);
    const rr = ring(h);
    for (let i = 0; i < seg; i++) {
      const j = (i + 1) % seg;
      M.tri(cIdx, M.vert(rr[i].p, nn, [0, 0]), M.vert(rr[j].p, nn, [1, 0]), m);
    }
  }
}
function s3sphere(M, o, r, su, sv, m) {
  M.part();
  const g = [];
  for (let i = 0; i <= sv; i++) {
    const ph = (i / sv) * Math.PI, sp = Math.sin(ph), cp = Math.cos(ph), row = [];
    for (let j = 0; j < su; j++) {
      const th = (j / su) * 6.2831853, n = [sp * Math.cos(th), sp * Math.sin(th), cp];
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
// An extruded annulus — the shape a station ring actually is. `gap` cuts a wedge
// clean out of it, so a docking mouth is a HOLE with walls you can see into,
// rather than a bright rectangle painted on the hull.
function s3annulus(M, rIn, rOut, z0, z1, seg, m, opt) {
  opt = opt || {};
  const gap = opt.gap;
  const inGap = a => {
    if (!gap) return false;
    const span = ((gap[1] - gap[0]) % 6.2831853 + 6.2831853) % 6.2831853;
    return (((a - gap[0]) % 6.2831853 + 6.2831853) % 6.2831853) < span;
  };
  const step = 6.2831853 / seg;
  const P = (r, a, z) => [Math.cos(a) * r, Math.sin(a) * r, z];
  for (let i = 0; i < seg; i++) {
    const a0 = i * step, a1 = (i + 1) * step, am = (a0 + a1) * 0.5;
    if (inGap(am)) continue;
    M.part();   // one part per bay, so the ring reads as armour plates
    M.quad(P(rIn, a0, z1), P(rOut, a0, z1), P(rOut, a1, z1), P(rIn, a1, z1), m);
    M.quad(P(rIn, a0, z0), P(rIn, a1, z0), P(rOut, a1, z0), P(rOut, a0, z0), m);
    const wall = (r, sgn, mm) => {
      const n0 = [Math.cos(a0) * sgn, Math.sin(a0) * sgn, 0], n1 = [Math.cos(a1) * sgn, Math.sin(a1) * sgn, 0];
      const v0 = M.vert(P(r, a0, z0), n0, [0, 0]), v1 = M.vert(P(r, a1, z0), n1, [1, 0]);
      const v2 = M.vert(P(r, a1, z1), n1, [1, 1]), v3 = M.vert(P(r, a0, z1), n0, [0, 1]);
      M.tri(v0, v1, v2, mm); M.tri(v0, v2, v3, mm);
    };
    wall(rOut, 1, opt.mOut === undefined ? m : opt.mOut);
    wall(rIn, -1, opt.mIn === undefined ? m : opt.mIn);
  }
  if (gap) {
    M.part();
    for (const a of gap) M.quad(P(rIn, a, z0), P(rOut, a, z0), P(rOut, a, z1), P(rIn, a, z1),
      opt.mCut === undefined ? m : opt.mCut);
  }
}
function s3torus(M, R, r, segU, segV, m, z) {
  M.part(); z = z || 0;
  const g = [];
  for (let i = 0; i < segU; i++) {
    const a = (i / segU) * 6.2831853, ca = Math.cos(a), sa = Math.sin(a), row = [];
    for (let j = 0; j < segV; j++) {
      const b = (j / segV) * 6.2831853, cb = Math.cos(b), sb = Math.sin(b);
      row.push(M.vert([ca * (R + r * cb), sa * (R + r * cb), z + r * sb], [ca * cb, sa * cb, sb],
        [i * 0.25, j / segV]));
    }
    g.push(row);
  }
  for (let i = 0; i < segU; i++) for (let j = 0; j < segV; j++) {
    const i2 = (i + 1) % segU, j2 = (j + 1) % segV;
    M.tri(g[i][j], g[i2][j], g[i2][j2], m); M.tri(g[i][j], g[i2][j2], g[i][j2], m);
  }
}
// a structural beam — square section, so it catches light on two faces and reads
// as a girder rather than as a line
function s3beam(M, p0, p1, w, m) {
  const d = V3sub(p1, p0), L = Math.hypot(d[0], d[1], d[2]);
  if (L < 1e-6) return;
  const a = V3scl(d, 1 / L), [u, v] = s3basis(a);
  s3box(M, V3scl([p0[0] + p1[0], p0[1] + p1[1], p0[2] + p1[2]], 0.5),
    V3scl(u, w), V3scl(v, w), V3scl(a, L * 0.5), m);
}
// A truss run: parallel chords plus the zig-zag web between them. A solid beam is
// a stick; a truss is a structure, and the difference shows at the silhouette
// where you see through it to the stars.
function s3truss(M, a, rA, rB, z, w, bays, m) {
  const ca = Math.cos(a), sa = Math.sin(a);
  const P = (r, dz, dt) => [ca * r - sa * dt, sa * r + ca * dt, z + dz];
  for (const [dz, dt] of [[w, 0], [-w, 0], [0, w], [0, -w]]) s3beam(M, P(rA, dz, dt), P(rB, dz, dt), w * 0.30, m);
  for (let i = 0; i < bays; i++) {
    const r0 = lerp(rA, rB, i / bays), r1 = lerp(rA, rB, (i + 1) / bays);
    s3beam(M, P(r0, w, 0), P(r1, -w, 0), w * 0.20, m);
    s3beam(M, P(r0, 0, w), P(r1, 0, -w), w * 0.20, m);
    s3beam(M, P(r1, w, 0), P(r1, -w, 0), w * 0.20, m);
  }
}
function s3dish(M, o, ax, r, depth, m) {
  M.part();
  const [u, v, a] = s3basis(ax), seg = 26, rings = 5;
  const pt = (rr, k) => {
    const dz = -depth * (1 - (rr / r) * (rr / r)), cw = Math.cos(k) * rr, sw = Math.sin(k) * rr;
    return [o[0] + u[0] * cw + v[0] * sw + a[0] * dz,
            o[1] + u[1] * cw + v[1] * sw + a[1] * dz,
            o[2] + u[2] * cw + v[2] * sw + a[2] * dz];
  };
  for (let i = 0; i < rings; i++) {
    const r0 = r * (i / rings), r1 = r * ((i + 1) / rings);
    for (let j = 0; j < seg; j++) {
      const k0 = j / seg * 6.2831853, k1 = (j + 1) / seg * 6.2831853;
      M.quad(pt(r0, k0), pt(r1, k0), pt(r1, k1), pt(r0, k1), m);
    }
  }
  s3beam(M, o, [o[0] + a[0] * r * 0.75, o[1] + a[1] * r * 0.75, o[2] + a[2] * r * 0.75], r * 0.035, m);
}
// a solar array on a boom. The cell lines come from the panel-line material, so
// one quad still reads as hundreds of cells.
function s3array(M, o, ax, span, chord, mBoom, mPanel, out) {
  const [u, , a] = s3basis(ax);
  const c = [o[0] + a[0] * out, o[1] + a[1] * out, o[2] + a[2] * out];
  s3beam(M, o, c, span * 0.018, mBoom);
  const hx = span * 0.5, hy = chord * 0.5;
  const P = (s, t) => [c[0] + a[0] * s + u[0] * t, c[1] + a[1] * s + u[1] * t, c[2] + a[2] * s + u[2] * t];
  M.part();
  M.quad(P(-hx, -hy), P(hx, -hy), P(hx, hy), P(-hx, hy), mPanel);
  M.quad(P(-hx, hy), P(hx, hy), P(hx, -hy), P(-hx, -hy), mPanel);
  for (const s of [-hx, hx]) s3beam(M, P(s, -hy), P(s, hy), span * 0.010, mBoom);
}

// ---------------------------------------------------------------- the steel
// The values matter more than the hues. A hull painted one mid grey is a clay
// model however well it is lit, so the set runs from near-white trim down to a
// dark that is nearly the void, and every part is jittered off its base.
function s3palette(M, accent) {
  const RING_PL = { m: 'cyl', f: [104, 17, 0], w: 0.040 };
  return {
    hull:  M.mat({ a: [126, 131, 140], g: 42, s: 0.46, pl: RING_PL, jit: 0.26, grime: 0.66 }),
    hull2: M.mat({ a: [ 90,  95, 104], g: 34, s: 0.38, pl: RING_PL, jit: 0.30, grime: 0.76 }),
    // the greeble deck: no panel lines (they only bisect a 3cm crate), wide tonal
    // spread, so a hundred components never read as one moulded surface
    dark:  M.mat({ a: [ 46,  50,  58], g: 26, s: 0.26, jit: 0.42, grime: 0.78 }),
    light: M.mat({ a: [158, 162, 170], g: 54, s: 0.55, jit: 0.38, grime: 0.56 }),
    mid:   M.mat({ a: [ 98, 103, 112], g: 36, s: 0.40, jit: 0.44, grime: 0.70 }),
    truss: M.mat({ a: [ 80,  85,  94], g: 30, s: 0.34, jit: 0.28, grime: 0.68 }),
    panel: M.mat({ a: [ 20,  28,  56], g: 140, s: 0.92, pl: { m: 'cart', f: [58, 58, 58], w: 0.055 }, jit: 0.10, grime: 0.26 }),
    rad:   M.mat({ a: [190, 194, 200], g: 18, s: 0.16, pl: { m: 'cart', f: [30, 30, 30], w: 0.06 }, jit: 0.10, grime: 0.44 }),
    haz:   M.mat({ a: [184,  88,  34], g: 30, s: 0.34, jit: 0.18, grime: 0.60 }),
    win:   M.mat({ a: [24, 23, 22], g: 20, s: 0.12, e: 0.62, ec: [255, 192, 112], eJit: 1, jit: 0, grime: 0.25 }),
    // A HANGAR THROAT is not a window: it is a big volume with worklights in it,
    // so it wants to be dimmer and less saturated than a cabin pane. At window
    // brightness a bay this size is a flat slab of yellow and the eye reads paint.
    bay:   M.mat({ a: [46, 40, 32], g: 22, s: 0.20, e: 0.30, ec: [255, 208, 150], jit: 0.10, grime: 0.45 }),
    // `fx` marks this surface as LIVE: the bake writes a mask of wherever it
    // ended up visible, and the throat's energy is then drawn over the sprite
    // each frame through that mask. The baked filaments are the standing
    // structure of the field; what moves rides on top of them.
    field: M.mat({ a: [6, 16, 20], g: 20, s: 0.05, e: 0.62, ec: accent || [78, 226, 246],
                   eCyl: [7.5, 2.6], eRad: [0.06, 0.80, 2.4], jit: 0, grime: 0, fx: 1 })
  };
}
// A row of lit windows round a wall — set mostly INTO it, with a shallow lip
// proud. A pane standing off the hull by its own depth is a stud, not a window.
function s3winRow(M, r, z, n, mw, o) {
  o = o || {};
  const w = o.w || 0.016, h = o.h || 0.020, d = o.d || 0.006, sgn = o.inward ? -1 : 1;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * 6.2831853 + (o.p || 0);
    if (o.skip && o.skip(a)) continue;
    const ca = Math.cos(a), sa = Math.sin(a), rr = r + d * 0.28 * sgn;
    s3box(M, [ca * rr, sa * rr, z], V3scl([ca * sgn, sa * sgn, 0], d), V3scl([-sa, ca, 0], w), [0, 0, h], mw);
  }
}
// THE COMPLEXITY LEVER. S3D_LIGHT.detail has two jobs, and it needs both to
// read as "how much machinery is on this thing".
//
//   s3det()      scales the greeble COUNT — the fine hardware scattered over
//                every surface. On its own this only makes a build noisier or
//                quieter; the silhouette never changes, because every hero
//                piece is written out by hand and always ran.
//   s3has(rank)  is the other half: each OPTIONAL piece carries a rank — how
//                essential it is — and stands only while detail is at least
//                that. So winding the dial down actually strips dishes, masts,
//                radiators and antenna clusters off the outline, and winding it
//                past 1 bolts extra ones on.
//
// The ranks are chosen so that the structure a build is RECOGNISED by — its
// rings, its spine, its piers, its aperture — is never optional. What comes and
// goes is everything hung off that structure.
//
//   ≤0.50  hero hardware: the main dish, the solar arrays
//    0.55  masts and the things standing on them
//    0.70  radiators, outriggers, cranes, secondary clusters
//    0.85  ancillary cylinders and pods
//    0.90  the finest trim: extra window rows
//    1.15  EXTRAS — hardware that exists only above the shipped setting
const s3det = () => (S3D_LIGHT.detail === undefined ? 1 : S3D_LIGHT.detail);
const s3has = rank => s3det() >= rank;

// THE GREEBLE PASS — the single biggest realism lever here. What matters is not
// the count but the HIERARCHY: a few hero blocks with clusters of fine hardware
// around them. Uniform detail reads as texture; varied detail reads as machinery.
// Four component forms, and a few degrees of scatter, so nothing reads as a
// pattern stamped round a ring.
function s3greebleRing(M, r0, r1, ztop, n, mats, rnd, o) {
  o = o || {};
  n = Math.max(4, Math.round(n * s3det()));
  const hi = o.h === undefined ? 0.030 : o.h, lo = o.h0 === undefined ? 0.008 : o.h0;
  const up = hi >= 0 ? 1 : -1, H = Math.abs(hi), H0 = Math.abs(lo);
  for (let i = 0; i < n; i++) {
    const a = rnd() * 6.2831853, r = lerp(r0, r1, rnd());
    const ca = Math.cos(a), sa = Math.sin(a);
    const yaw = (rnd() - 0.5) * 0.55, cy = Math.cos(a + yaw), sy = Math.sin(a + yaw);
    const rad = [cy, sy, 0], tan = [-sy, cy, 0], bx = ca * r, by = sa * r;
    const m = mats[(rnd() * mats.length) | 0];
    const t = rnd(), cls = t < 0.10 ? 2 : t < 0.36 ? 1 : 0;
    const S = cls === 2 ? lerp(1.9, 3.2, rnd()) : cls === 1 ? lerp(0.95, 1.5, rnd()) : lerp(0.35, 0.8, rnd());
    const w = lerp(0.013, 0.032, Math.pow(rnd(), 1.4)) * S;
    const l = lerp(0.013, 0.036, Math.pow(rnd(), 1.3)) * S;
    const h = lerp(H0, H, Math.pow(rnd(), 1.6)) * (cls === 2 ? lerp(1.1, 2.1, rnd()) : cls === 1 ? 1 : 0.62);
    const form = rnd();
    if (form < 0.60) {
      s3box(M, [bx, by, ztop + up * h], V3scl(rad, w), V3scl(tan, l), [0, 0, up * h], m);
      if (rnd() < 0.42) {
        const ox = (rnd() - 0.5) * w * 0.7, oy = (rnd() - 0.5) * l * 0.7, h2 = h * lerp(0.35, 0.9, rnd());
        s3box(M, [bx + rad[0] * ox + tan[0] * oy, by + rad[1] * ox + tan[1] * oy, ztop + up * (h * 2 + h2)],
          V3scl(rad, w * lerp(0.32, 0.66, rnd())), V3scl(tan, l * lerp(0.32, 0.66, rnd())), [0, 0, up * h2],
          mats[(rnd() * mats.length) | 0]);
      }
    } else if (form < 0.76) {
      const rr = Math.min(w, l) * lerp(0.8, 1.15, rnd());
      s3cyl(M, [bx, by, ztop + up * h], [0, 0, 1], rr, h, 16, m, true);
      if (rnd() < 0.5) s3cyl(M, [bx, by, ztop + up * h * 2.15], [0, 0, 1], rr * 0.72, h * 0.16, 16,
        mats[(rnd() * mats.length) | 0], true);
    } else if (form < 0.88) {
      const len = l * lerp(2.2, 4.5, rnd()), rr = Math.min(w, 0.020) * lerp(0.5, 0.95, rnd());
      s3cyl(M, [bx, by, ztop + up * (rr + h * 0.25)], tan, rr, len, 12, m, true);
      for (const s of [-0.62, 0.62])
        s3box(M, [bx + tan[0] * len * s, by + tan[1] * len * s, ztop + up * rr * 0.6],
          V3scl(rad, rr * 1.4), V3scl(tan, rr * 0.7), [0, 0, up * rr * 1.3], mats[(rnd() * mats.length) | 0]);
    } else {
      const mh = h * lerp(2.6, 5.5, rnd()), rr = Math.max(0.0022, w * 0.10);
      s3cyl(M, [bx, by, ztop + up * mh], [0, 0, 1], rr, mh, 8, m, false);
      s3box(M, [bx, by, ztop + up * 0.012], V3scl(rad, rr * 3.4), V3scl(tan, rr * 3.4), [0, 0, up * 0.012], m);
    }
  }
}
// hardware hanging off a vertical wall — thruster blocks, antenna housings, the
// things that stop the outline being a circle
function s3greebleWall(M, r, z0, z1, n, mats, rnd, o) {
  o = o || {};
  n = Math.max(3, Math.round(n * s3det()));
  for (let i = 0; i < n; i++) {
    const a = rnd() * 6.2831853, z = lerp(z0, z1, rnd());
    const ca = Math.cos(a), sa = Math.sin(a);
    const d = lerp(0.010, (o && o.d) || 0.045, Math.pow(rnd(), 1.6));
    const w = lerp(0.010, 0.045, rnd()), h = lerp(0.008, Math.min(0.05, (z1 - z0) * 0.42), rnd());
    s3box(M, [ca * (r + d), sa * (r + d), z], V3scl([ca, sa, 0], d), V3scl([-sa, ca, 0], w), [0, 0, h],
      mats[(rnd() * mats.length) | 0]);
  }
}

// ================================================================ THE BUILDS
// One per campaign's final destination. Each is a different ANSWER to what a
// place at the end of a contract is for, and that is what the silhouette carries
// from three seconds out — which is all the read you get on approach.

// ---- 1. TRUSS DISC. A drydock: concentric structural rings tied by radial
// trusses, the whole face built over. The densest of the five.
function s3_truss(M, seed) {
  const rnd = s3rng(seed || 3311), P = s3palette(M);
  const rings = [
    { r0: 0.880, r1: 1.000, z: 0.050, hv: 1 },
    { r0: 0.635, r1: 0.775, z: 0.034 },
    { r0: 0.400, r1: 0.520, z: 0.030 },
    { r0: 0.170, r1: 0.275, z: 0.044 }
  ];
  for (const R of rings) {
    s3annulus(M, R.r0, R.r1, -R.z, R.z, 84, P.hull, { mIn: P.hull2, mOut: R.hv ? P.hull2 : P.hull });
    s3greebleRing(M, R.r0 + 0.012, R.r1 - 0.012, R.z, R.hv ? 135 : 72, [P.mid, P.hull2, P.light, P.dark], rnd, { h: R.hv ? 0.105 : 0.078 });
    s3greebleRing(M, R.r0 + 0.012, R.r1 - 0.012, -R.z, R.hv ? 66 : 34, [P.hull2, P.dark, P.mid], rnd, { h: -0.070, h0: -0.010 });
    s3greebleWall(M, R.r1, -R.z * 0.9, R.z * 0.9, R.hv ? 46 : 22, [P.hull2, P.dark, P.light], rnd, { d: 0.055 });
  }
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * 6.2831853 + 0.13;
    s3truss(M, a, 0.24, 0.99, 0, 0.034, 11, P.truss);
    s3box(M, [Math.cos(a) * 0.83, Math.sin(a) * 0.83, 0.070],
      V3scl([Math.cos(a), Math.sin(a), 0], 0.055), V3scl([-Math.sin(a), Math.cos(a), 0], 0.042), [0, 0, 0.070], P.mid);
  }
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * 6.2831853 + 0.13 + 6.2831853 / 48;
    s3beam(M, [Math.cos(a) * 0.26, Math.sin(a) * 0.26, 0], [Math.cos(a) * 0.98, Math.sin(a) * 0.98, 0], 0.010, P.truss);
  }
  s3cyl(M, [0, 0, 0.02], [0, 0, 1], 0.175, 0.175, 44, P.hull, true);
  s3cyl(M, [0, 0, 0.21], [0, 0, 1], 0.135, 0.055, 40, P.light, true);
  s3cyl(M, [0, 0, -0.20], [0, 0, 1], 0.115, 0.050, 36, P.hull2, true);
  if (s3has(0.55)) { // the mast, and the beacon that rides its cap
    s3cyl(M, [0, 0, 0.36], [0, 0, 1], 0.030, 0.120, 16, P.hull2, true);
    s3cyl(M, [0, 0, 0.50], [0, 0, 1], 0.070, 0.030, 24, P.light, true);
    M.lamp([0, 0, 0.535], [255, 255, 255], 0.016, 0, 'strobe');
  }
  s3winRow(M, 0.176, 0.06, 34, P.win, { w: 0.009, h: 0.020, d: 0.006 });
  if (s3has(0.90)) s3winRow(M, 0.176, -0.05, 34, P.win, { w: 0.009, h: 0.020, d: 0.006 });
  s3greebleRing(M, 0.05, 0.16, 0.195, 30, [P.mid, P.dark, P.light], rnd, { h: 0.040 });
  if (s3has(0.90)) for (const R of rings.slice(0, 3)) {
    s3winRow(M, R.r0, 0, 84, P.win, { inward: 1, w: 0.0085, h: 0.030, d: 0.006 });
    s3winRow(M, R.r1, 0, 84, P.win, { w: 0.0085, h: 0.030, d: 0.006 });
  }
  // hangar throats cut into the rim, lit from inside
  if (s3has(0.70)) for (let i = 0; i < 4; i++) {
    const a = (i / 4) * 6.2831853 + 0.9, ca = Math.cos(a), sa = Math.sin(a);
    s3box(M, [ca * 0.955, sa * 0.955, 0], V3scl([ca, sa, 0], 0.050), V3scl([-sa, ca, 0], 0.075), [0, 0, 0.045], P.dark);
    s3box(M, [ca * 0.925, sa * 0.925, 0], V3scl([ca, sa, 0], 0.012), V3scl([-sa, ca, 0], 0.058), [0, 0, 0.032], P.bay);
  }
  if (s3has(0.70)) for (let i = 0; i < 3; i++) { // outriggers past the rim
    const a = (i / 3) * 6.2831853 + 2.0;
    s3beam(M, [Math.cos(a) * 0.98, Math.sin(a) * 0.98, 0.02], [Math.cos(a) * 1.30, Math.sin(a) * 1.30, 0.16], 0.007, P.truss);
  }
  if (s3has(0.50)) s3dish(M, [0.52, -0.62, 0.30], [0.30, -0.42, 0.86], 0.13, 0.055, P.light);
  if (s3has(1.15)) s3dish(M, [-0.44, 0.58, -0.26], [-0.26, 0.40, -0.88], 0.10, 0.044, P.light);
  if (s3has(0.50)) {
    s3array(M, [0, 0, 0.30], [-0.72, 0.69, 0.06], 0.62, 0.20, P.truss, P.panel, 1.28);
    s3array(M, [0, 0, -0.24], [0.72, -0.69, -0.06], 0.62, 0.20, P.truss, P.panel, 1.28);
  }
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * 6.2831853;
    M.lamp([Math.cos(a) * 1.002, Math.sin(a) * 1.002, 0.056], [255, 74, 60], 0.0075, i / 22, 'beacon');
  }
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * 6.2831853 + 0.4;
    M.lamp([Math.cos(a) * 0.69, Math.sin(a) * 0.69, 0.040], [190, 230, 255], 0.008, i * 0.13, 'steady');
  }
  return M;
}

// ---- 2. FORTRESS RING. The shipped shape done solid: a thick armoured hoop
// with a hole cut clean through it, spokes to a pressurised core.
function s3_fortress(M, seed) {
  const rnd = s3rng(seed || 8821), P = s3palette(M);
  // the mouth faces the VIEWER. In this projection the near side of the ring is
  // -y, so a bay anywhere else is a hole you never see into.
  const DOCK = [-1.87, -1.27];
  s3annulus(M, 0.665, 1.0, -0.205, 0.205, 60, P.hull, { gap: DOCK, mIn: P.hull2, mOut: P.hull, mCut: P.dark });
  for (let i = 0; i < 30; i++) {
    const a = (i / 30) * 6.2831853 + 6.2831853 / 60;
    const t = Math.atan2(Math.sin(a), Math.cos(a));
    if (t > DOCK[0] - 0.12 && t < DOCK[1] + 0.12) continue;
    const ca = Math.cos(a), sa = Math.sin(a);
    s3box(M, [ca * 1.012, sa * 1.012, 0], V3scl([ca, sa, 0], 0.014), V3scl([-sa, ca, 0], 0.088), [0, 0, 0.165], P.hull2);
  }
  s3greebleRing(M, 0.685, 0.985, 0.205, 145, [P.mid, P.hull2, P.light, P.dark], rnd, { h: 0.070 });
  s3greebleRing(M, 0.685, 0.985, -0.205, 66, [P.hull2, P.dark, P.mid], rnd, { h: -0.048, h0: -0.008 });
  s3greebleWall(M, 1.0, -0.17, 0.17, 52, [P.hull2, P.dark, P.mid, P.light], rnd, { d: 0.060 });
  {
    const am = (DOCK[0] + DOCK[1]) * 0.5, ca = Math.cos(am), sa = Math.sin(am);
    for (const a of DOCK)
      s3box(M, [Math.cos(a) * 0.83, Math.sin(a) * 0.83, 0], V3scl([Math.cos(a), Math.sin(a), 0], 0.17),
        V3scl([-Math.sin(a), Math.cos(a), 0], 0.012), [0, 0, 0.205], P.dark);
    s3box(M, [ca * 0.70, sa * 0.70, 0], V3scl([ca, sa, 0], 0.030), V3scl([-sa, ca, 0], 0.185), [0, 0, 0.175], P.dark);
    s3box(M, [ca * 0.735, sa * 0.735, 0], V3scl([ca, sa, 0], 0.008), V3scl([-sa, ca, 0], 0.150), [0, 0, 0.120], P.bay);
    // gantries across the mouth: something in the bay for the light to fall on,
    // so it reads as a space with depth rather than a lit rectangle
    for (const t of [-0.55, 0, 0.55])
      s3beam(M, [ca * 0.70 - sa * t * 0.16, sa * 0.70 + ca * t * 0.16, -0.11],
                [ca * 0.70 - sa * t * 0.16, sa * 0.70 + ca * t * 0.16, 0.11], 0.011, P.dark);
    for (const z of [-0.06, 0.06])
      s3beam(M, [ca * 0.71 - sa * 0.14, sa * 0.71 + ca * 0.14, z],
                [ca * 0.71 + sa * 0.14, sa * 0.71 - ca * 0.14, z], 0.009, P.dark);
    for (const z of [0.17, -0.17]) for (const t of [-1, 1])
      s3box(M, [ca * 0.90 - sa * t * 0.20, sa * 0.90 + ca * t * 0.20, z],
        V3scl([ca, sa, 0], 0.10), V3scl([-sa, ca, 0], 0.012), [0, 0, 0.014], P.haz);
    M.lamp([ca * 0.755, sa * 0.755, 0.130], [255, 176, 64], 0.011, 0.0, 'slow');
    M.lamp([ca * 0.755, sa * 0.755, -0.130], [255, 176, 64], 0.011, 0.5, 'slow');
  }
  const skip = a => { const t = Math.atan2(Math.sin(a), Math.cos(a)); return t > DOCK[0] - 0.1 && t < DOCK[1] + 0.1; };
  for (const z of [0.085, -0.020, -0.125])
    s3winRow(M, 0.665, z, 86, P.win, { inward: 1, w: 0.0090, h: z === -0.125 ? 0.020 : 0.026, d: 0.007, skip });
  for (let i = 0; i < 4; i++) s3truss(M, (i / 4) * 6.2831853 + 0.78, 0.21, 0.67, 0, 0.040, 6, P.truss);
  s3cyl(M, [0, 0, 0], [0, 0, 1], 0.205, 0.235, 44, P.hull, true);
  s3cyl(M, [0, 0, 0.255], [0, 0, 1], 0.150, 0.045, 36, P.light, true);
  s3cyl(M, [0, 0, -0.255], [0, 0, 1], 0.150, 0.045, 36, P.hull2, true);
  s3winRow(M, 0.206, 0.10, 34, P.win, { w: 0.0095, h: 0.024, d: 0.007 });
  if (s3has(0.90)) s3winRow(M, 0.206, -0.02, 34, P.win, { w: 0.0095, h: 0.024, d: 0.007 });
  s3greebleRing(M, 0.03, 0.14, 0.300, 24, [P.mid, P.dark, P.light], rnd, { h: 0.036 });
  if (s3has(0.85)) for (let i = 0; i < 5; i++) { // pods round the core, each lit
    const a = (i / 5) * 6.2831853 + 0.3, ca = Math.cos(a), sa = Math.sin(a);
    s3cyl(M, [ca * 0.245, sa * 0.245, 0.14], [ca, sa, 0], 0.028, 0.045, 14, P.light, true);
    M.lamp([ca * 0.295, sa * 0.295, 0.14], [140, 230, 255], 0.009, i * 0.2, 'steady');
  }
  if (s3has(0.55)) { // THE MAST, with its dish and strobe. One gate for the lot:
    s3beam(M, [0, 0, 0.30], [0, 0, 0.86], 0.011, P.truss);  // drop the mast on its
    if (s3has(0.80)) for (let i = 1; i <= 4; i++) {          // own and the dish floats
      const z = 0.30 + (0.56 * i / 5), w = 0.045 * (1 - i / 6);
      s3beam(M, [-w, 0, z], [w, 0, z], 0.007, P.truss);
      s3beam(M, [0, -w, z], [0, w, z], 0.007, P.truss);
    }
    s3dish(M, [0, 0, 0.88], [0.18, -0.36, 0.92], 0.10, 0.042, P.light);
    M.lamp([0, 0, 0.875], [255, 255, 255], 0.017, 0, 'strobe');
  }
  if (s3has(0.50)) {
    s3array(M, [0, 0, 0.05], [-0.985, 0.174, 0], 0.70, 0.26, P.truss, P.panel, 1.42);
    s3array(M, [0, 0, -0.05], [0.985, -0.174, 0], 0.70, 0.26, P.truss, P.panel, 1.42);
  }
  if (s3has(0.70)) for (const s of [-1, 1]) { // radiator wings on their booms
    const a = 1.9 + (s > 0 ? 0 : Math.PI), ca = Math.cos(a), sa = Math.sin(a);
    s3beam(M, [ca * 0.20, sa * 0.20, 0.10], [ca * 0.55, sa * 0.55, 0.32], 0.010, P.truss);
    s3box(M, [ca * 0.66, sa * 0.66, 0.40], V3scl([ca, sa, 0], 0.18), V3scl([-sa, ca, 0], 0.115), [0, 0, 0.004], P.rad);
  }
  if (s3has(1.15)) for (const s of [-1, 1]) { // ...and a second pair, above 1
    const a = 0.35 + (s > 0 ? 0 : Math.PI), ca = Math.cos(a), sa = Math.sin(a);
    s3beam(M, [ca * 0.20, sa * 0.20, -0.10], [ca * 0.52, sa * 0.52, -0.30], 0.009, P.truss);
    s3box(M, [ca * 0.62, sa * 0.62, -0.37], V3scl([ca, sa, 0], 0.15), V3scl([-sa, ca, 0], 0.095), [0, 0, 0.004], P.rad);
  }
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * 6.2831853;
    M.lamp([Math.cos(a) * 1.004, Math.sin(a) * 1.004, 0.212], [255, 74, 60], 0.0080, i / 20, 'beacon');
  }
  return M;
}

// ---- 3. SPINE & TORUS. The classic, and the only one taller than it is wide.
function s3_spine(M, seed) {
  const rnd = s3rng(seed || 5507), P = s3palette(M);
  s3cyl(M, [0, 0, 0], [0, 0, 1], 0.072, 1.85, 30, P.hull, true);
  for (let i = -7; i <= 7; i++) s3cyl(M, [0, 0, i * 0.235], [0, 0, 1], 0.092, 0.020, 26, P.light, true);
  s3greebleWall(M, 0.072, -1.74, 1.74, 130, [P.hull2, P.dark, P.mid, P.light], rnd, { d: 0.032 });
  s3cyl(M, [0, 0, -1.24], [0, 0, 1], 0.150, 0.215, 30, P.hull, true);
  s3winRow(M, 0.151, -1.24, 26, P.win, { w: 0.010, h: 0.024, d: 0.007 });
  s3sphere(M, [0, 0, -1.72], 0.128, 26, 16, P.light);
  s3cyl(M, [0, 0, 1.06], [0, 0, 1], 0.125, 0.170, 26, P.hull, true);
  s3winRow(M, 0.126, 1.06, 24, P.win, { w: 0.010, h: 0.022, d: 0.007 });
  if (s3has(0.75)) { // tankage blistered off the spine
    s3sphere(M, [0.165, 0.07, -0.28], 0.078, 22, 14, P.light);
    s3sphere(M, [-0.165, -0.07, -0.28], 0.078, 22, 14, P.light);
  }
  if (s3has(1.15)) { // a second pair, higher up, above the shipped setting
    s3sphere(M, [0.150, -0.09, 0.52], 0.066, 20, 13, P.light);
    s3sphere(M, [-0.150, 0.09, 0.52], 0.066, 20, 13, P.light);
  }
  if (s3has(0.85)) for (let i = 0; i < 5; i++) { // machinery pods on the shaft
    const a = (i / 5) * 6.2831853 + 0.4, ca = Math.cos(a), sa = Math.sin(a), z = lerp(-1.0, 0.9, rnd());
    s3cyl(M, [ca * 0.12, sa * 0.12, z], [ca, sa, 0], 0.042, 0.075, 16, P.hull2, true);
  }
  const hoop = (R, r, z, spokes) => {
    s3torus(M, R, r, 96, 22, P.hull, z);
    for (let i = 0; i < 36; i++) {
      const a = (i / 36) * 6.2831853, ca = Math.cos(a), sa = Math.sin(a);
      s3box(M, [ca * R, sa * R, z], V3scl([ca, sa, 0], r * 1.10), V3scl([-sa, ca, 0], r * 0.16), [0, 0, r * 1.10], P.hull2);
    }
    s3greebleRing(M, R - r * 0.5, R + r * 0.5, z + r * 0.92, 52, [P.mid, P.light, P.dark], rnd, { h: 0.030 });
    for (let i = 0; i < spokes; i++) s3truss(M, (i / spokes) * 6.2831853 + 0.2, 0.06, R - r * 0.8, z, r * 0.55, 7, P.truss);
    s3winRow(M, R + r * 0.96, z, 84, P.win, { w: 0.010, h: 0.016, d: 0.005 });
    if (s3has(0.90)) s3winRow(M, R - r * 0.96, z, 84, P.win, { inward: 1, w: 0.010, h: 0.016, d: 0.005 });
  };
  hoop(0.780, 0.108, 0.360, 8);
  hoop(0.440, 0.068, -0.780, 6);
  if (s3has(0.50)) {
    s3array(M, [0, 0, -1.55], [-0.94, 0.34, 0], 0.62, 0.24, P.truss, P.panel, 0.95);
    s3array(M, [0, 0, -1.55], [0.94, -0.34, 0], 0.62, 0.24, P.truss, P.panel, 0.95);
  }
  if (s3has(0.50)) s3dish(M, [0, 0, 1.92], [0.22, -0.34, 0.91], 0.17, 0.070, P.light);
  if (s3has(1.15)) s3dish(M, [0.22, 0.10, 1.30], [0.86, 0.34, 0.38], 0.11, 0.046, P.light);
  for (let i = 0; i < 7; i++) M.lamp([0, 0, -1.60 + i * 0.52], [255, 74, 60], 0.0080, i / 7, 'beacon');
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * 6.2831853;
    M.lamp([Math.cos(a) * 0.890, Math.sin(a) * 0.890, 0.360], [190, 230, 255], 0.008, i * 0.07, 'steady');
  }
  M.lamp([0, 0, 1.99], [255, 255, 255], 0.014, 0, 'strobe');
  return M;
}

// ---- 4. PORT & PIERS. A working port — and the moored hulls are the scale cue
// that makes everything else read as big.
function s3_port(M, seed) {
  const rnd = s3rng(seed || 9143), P = s3palette(M);
  s3cyl(M, [0, 0, -0.36], [0, 0, 1], 0.230, 0.170, 34, P.hull, true);
  s3cyl(M, [0, 0, 0.10], [0, 0, 1], 0.140, 0.310, 30, P.hull, true);
  s3cyl(M, [0, 0, 0.47], [0, 0, 1], 0.255, 0.075, 36, P.light, true);
  s3cyl(M, [0, 0, 0.575], [0, 0, 1], 0.165, 0.045, 30, P.hull2, true);
  if (s3has(0.55)) { // the mast and its strobe — see the fortress, same rule
    s3cyl(M, [0, 0, 0.78], [0, 0, 1], 0.028, 0.170, 14, P.hull2, true);
    M.lamp([0, 0, 0.965], [255, 255, 255], 0.016, 0, 'strobe');
  }
  s3greebleWall(M, 0.140, -0.15, 0.38, 40, [P.hull2, P.dark, P.mid, P.light], rnd, { d: 0.035 });
  s3greebleRing(M, 0.05, 0.24, 0.545, 26, [P.mid, P.dark, P.light], rnd, { h: 0.032 });
  s3winRow(M, 0.256, 0.47, 34, P.win, { w: 0.016, h: 0.044, d: 0.008 });
  for (const z of s3has(0.90) ? [0.30, 0.16, 0.02] : [0.16]) s3winRow(M, 0.141, z, 26, P.win, { w: 0.012, h: 0.020, d: 0.007 });
  s3winRow(M, 0.231, -0.36, 30, P.win, { w: 0.014, h: 0.030, d: 0.008 });
  if (s3has(0.50)) s3dish(M, [0.20, -0.16, 0.60], [0.42, -0.34, 0.84], 0.11, 0.046, P.light);
  if (s3has(1.15)) s3dish(M, [-0.18, 0.19, 0.56], [-0.40, 0.42, 0.81], 0.085, 0.036, P.light);
  s3annulus(M, 0.560, 0.815, -0.055, 0.075, 72, P.hull, { mIn: P.hull2 });
  s3greebleRing(M, 0.575, 0.800, 0.075, 118, [P.mid, P.hull2, P.light, P.dark], rnd, { h: 0.060 });
  s3greebleRing(M, 0.575, 0.800, -0.055, 50, [P.hull2, P.dark, P.mid], rnd, { h: -0.036, h0: -0.006 });
  s3greebleWall(M, 0.815, -0.045, 0.065, 34, [P.hull2, P.dark, P.mid, P.light], rnd, { d: 0.042 });
  s3winRow(M, 0.560, 0.010, 66, P.win, { inward: 1, w: 0.012, h: 0.024, d: 0.007 });
  s3winRow(M, 0.816, 0.010, 66, P.win, { w: 0.012, h: 0.024, d: 0.007 });
  for (let i = 0; i < 6; i++) s3truss(M, (i / 6) * 6.2831853 + 0.45, 0.15, 0.565, 0.01, 0.030, 5, P.truss);
  const PIERS = 5;
  for (let i = 0; i < PIERS; i++) {
    const a = (i / PIERS) * 6.2831853 + 0.62, ca = Math.cos(a), sa = Math.sin(a);
    const rad = [ca, sa, 0], tan = [-sa, ca, 0];
    s3truss(M, a, 0.80, 1.46, -0.10, 0.033, 11, P.truss);
    for (let k = 0; k < 4; k++) {
      const r = lerp(0.88, 1.38, (k + 0.5) / 4);
      s3box(M, [ca * r, sa * r, -0.10], V3scl(rad, 0.045), V3scl(tan, 0.060), [0, 0, 0.052], P.hull2);
      s3box(M, [ca * r, sa * r, -0.155], V3scl(rad, 0.020), V3scl(tan, 0.030), [0, 0, 0.020], P.bay);
    }
    s3box(M, [ca * 1.46, sa * 1.46, -0.10], V3scl(rad, 0.030), V3scl(tan, 0.085), [0, 0, 0.070], P.hull);
    M.lamp([ca * 1.50, sa * 1.50, -0.10], [255, 74, 60], 0.0090, i / PIERS, 'beacon');
    // the cranes: the working machinery on the piers, and the first thing a
    // quiet port loses
    if (s3has(0.70) && (i % 2 === 0 || s3has(1.15))) {
      const off = 0.135, cx = ca * 1.14 - sa * off, cy = sa * 1.14 + ca * off;
      s3box(M, [cx, cy, -0.10], V3scl(rad, 0.235), V3scl(tan, 0.048), [0, 0, 0.046], P.light);
      s3box(M, [cx - rad[0] * 0.20, cy - rad[1] * 0.20, -0.10], V3scl(rad, 0.055), V3scl(tan, 0.030), [0, 0, 0.030], P.hull2);
      s3box(M, [cx + rad[0] * 0.26, cy + rad[1] * 0.26, -0.10], V3scl(rad, 0.030), V3scl(tan, 0.036), [0, 0, 0.034], P.dark);
      M.lamp([cx + rad[0] * 0.30, cy + rad[1] * 0.30, -0.10], [150, 220, 255], 0.014, i * 0.21, 'slow');
      s3beam(M, [ca * 1.14, sa * 1.14, -0.10], [cx - tan[0] * 0.05, cy - tan[1] * 0.05, -0.10], 0.012, P.truss);
    }
  }
  if (s3has(0.50)) {
    s3array(M, [0, 0, 0.20], [-0.62, -0.78, 0.10], 0.52, 0.20, P.truss, P.panel, 1.22);
    s3array(M, [0, 0, 0.20], [0.62, 0.78, 0.10], 0.52, 0.20, P.truss, P.panel, 1.22);
  }
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * 6.2831853;
    M.lamp([Math.cos(a) * 0.820, Math.sin(a) * 0.820, 0.078], [190, 230, 255], 0.008, i * 0.06, 'steady');
  }
  return M;
}

// ---- 5. THE GATE. The aperture is the point, but it is not the object: what
// sells it is the hardware that costs something to hold it open.
function s3_gate(M, seed, accent) {
  const rnd = s3rng(seed || 4409), P = s3palette(M, accent || [78, 226, 246]);
  s3annulus(M, 0.755, 1.0, -0.145, 0.145, 72, P.hull, { mIn: P.hull2 });
  s3greebleRing(M, 0.770, 0.985, 0.145, 110, [P.mid, P.hull2, P.light, P.dark], rnd, { h: 0.052 });
  s3greebleRing(M, 0.770, 0.985, -0.145, 40, [P.hull2, P.dark, P.mid], rnd, { h: -0.034, h0: -0.006 });
  s3greebleWall(M, 1.0, -0.12, 0.12, 48, [P.hull2, P.dark, P.mid, P.light], rnd, { d: 0.052 });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * 6.2831853 + 0.2, ca = Math.cos(a), sa = Math.sin(a);
    const rad = [ca, sa, 0], tan = [-sa, ca, 0];
    s3box(M, [ca * 0.905, sa * 0.905, 0], V3scl(rad, 0.115), V3scl(tan, 0.078), [0, 0, 0.195], P.hull);
    s3box(M, [ca * 0.905, sa * 0.905, 0.215], V3scl(rad, 0.075), V3scl(tan, 0.050), [0, 0, 0.030], P.mid);
    s3box(M, [ca * 0.905, sa * 0.905, -0.215], V3scl(rad, 0.065), V3scl(tan, 0.044), [0, 0, 0.030], P.hull2);
    s3cyl(M, [ca * 0.775, sa * 0.775, 0], [ca, sa, 0], 0.058, 0.045, 20, P.hull2, true);
    // the emitter nozzle. NEVER optional — it is what the aperture hangs off
    s3cyl(M, [ca * 0.735, sa * 0.735, 0], [ca, sa, 0], 0.040, 0.012, 20, P.field, true);
    if (s3has(0.70)) for (const t of [-1, 1]) { // capacitor stacks either side
      const b = a + t * 0.14;
      s3cyl(M, [Math.cos(b) * 0.865, Math.sin(b) * 0.865, 0.135], [0, 0, 1], 0.030, 0.075, 16, P.mid, true);
      s3box(M, [Math.cos(b) * 0.955, Math.sin(b) * 0.955, -0.055],
        V3scl([Math.cos(b), Math.sin(b), 0], 0.048), V3scl([-Math.sin(b), Math.cos(b), 0], 0.030), [0, 0, 0.075], P.dark);
    }
    if (s3has(1.15)) { // an antenna off every emitter, above the shipped setting
      s3cyl(M, [ca * 0.930, sa * 0.930, 0.320], [0, 0, 1], 0.006, 0.115, 8, P.hull2, false);
      s3box(M, [ca * 0.930, sa * 0.930, 0.200], V3scl(rad, 0.022), V3scl(tan, 0.022), [0, 0, 0.014], P.mid);
    }
    M.lamp([ca * 0.905, sa * 0.905, 0.250], [255, 74, 60], 0.0095, i / 8, 'beacon');
    M.lamp([ca * 0.760, sa * 0.760, 0.055], [110, 236, 246], 0.010, i / 8, 'slow');
    if (s3has(0.85)) { // the bracing web between the emitter blocks
      const b2 = a + 6.2831853 / 16;
      s3beam(M, [ca * 0.905, sa * 0.905, 0.16], [Math.cos(b2) * 0.99, Math.sin(b2) * 0.99, 0.02], 0.014, P.truss);
      s3beam(M, [ca * 0.905, sa * 0.905, -0.16], [Math.cos(b2) * 0.99, Math.sin(b2) * 0.99, -0.02], 0.014, P.truss);
    }
  }
  // the aperture, as a shallow dish of field: a surface that catches the eye,
  // and real geometry, so the near half of the ring occludes it for free
  {
    M.part();
    const seg = 64, rings = 6, rMax = 0.735, zz = r => -0.055 * (1 - (r / rMax) * (r / rMax));
    for (let i = 0; i < rings; i++) {
      const r0 = rMax * (i / rings), r1 = rMax * ((i + 1) / rings);
      for (let j = 0; j < seg; j++) {
        const k0 = (j / seg) * 6.2831853, k1 = ((j + 1) / seg) * 6.2831853;
        M.quad([Math.cos(k0) * r0, Math.sin(k0) * r0, zz(r0)], [Math.cos(k0) * r1, Math.sin(k0) * r1, zz(r1)],
               [Math.cos(k1) * r1, Math.sin(k1) * r1, zz(r1)], [Math.cos(k1) * r0, Math.sin(k1) * r0, zz(r0)], P.field);
      }
    }
  }
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * 6.2831853;
    M.lamp([Math.cos(a) * 1.004, Math.sin(a) * 1.004, 0.150], [255, 74, 60], 0.0070, i / 24, 'beacon');
  }
  return M;
}

// The registry. `cam` is how much of the sprite one station radius takes, tuned
// per build so the whole thing — piers, spine, arrays — fits inside its canvas.
// ---- 6-8. THE WARP LEECH, in three rings. One machine family for all five
// campaign duels: an outlaw engine clamped across the lane's centre. The draw
// (85-enemy-art) stamps these concentrically with a live counter-rotation per
// ring, so the bake stays cheap and the spin costs a canvas rotate. The seven
// hulls of the retired duels (cutter, the warden's three bodies, the beacon,
// the array's two pieces) went with their fights.
//
// All three face the LENS, like the array hub did: rotX(+90°) takes a build
// described in the XY plane and stands it square to the camera with its +Z
// features toward the viewer. A wheel-train's whole job is being read head-on.

// LCHRIM — the outer sprocket. The silhouette IS the read: an annulus (the
// bore shows through the middle) with twelve hazard-tipped dogs stood off it.
function s3_lchrim(M, seed) {
  const rnd = s3rng(seed || 5507), P = s3palette(M);
  s3annulus(M, 0.46, 0.60, -0.04, 0.06, 36, P.hull);          // the wheel body
  s3annulus(M, 0.44, 0.47, 0.05, 0.075, 36, P.light);         // inner lip collar
  s3annulus(M, 0.585, 0.615, 0.05, 0.075, 36, P.haz);         // hazard rim band
  s3greebleRing(M, 0.47, 0.585, 0.062, 40, [P.mid, P.dark, P.light], rnd, { h: 0.028 });
  for (let i = 0; i < 12; i++) { // THE TEETH — sprocket dogs, hazard-tipped
    const a = i / 12 * 6.2831853, ca = Math.cos(a), sa = Math.sin(a);
    s3box(M, [ca * 0.645, sa * 0.645, 0.01], V3scl([ca, sa, 0], 0.045),
      V3scl([-sa, ca, 0], 0.052), [0, 0, 0.050], P.hull2);
    s3box(M, [ca * 0.695, sa * 0.695, 0.01], V3scl([ca, sa, 0], 0.014),
      V3scl([-sa, ca, 0], 0.036), [0, 0, 0.040], P.haz);
  }
  // LIT WINDOWS ARE THE SCALE CUE, here as everywhere: a machine with a crew
  // deck is a machine with a size. One sparse row — a leech is mostly engine.
  s3winRow(M, 0.605, -0.01, 24, P.win, { w: 0.013, h: 0.026, d: 0.008 });
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * 6.2831853;
    M.lamp([Math.cos(a) * 0.57, Math.sin(a) * 0.57, 0.08], [255, 74, 60], 0.0075, i / 8, 'beacon');
  }
  return M;
}
// LCHGEAR — the bearing race: rollers riding between two shallow annuli, with
// a toothed inner edge biting toward the hub. Spins against the sprocket.
function s3_lchgear(M, seed) {
  const rnd = s3rng(seed || 6841), P = s3palette(M);
  s3annulus(M, 0.30, 0.42, -0.03, 0.02, 32, P.hull2);
  s3annulus(M, 0.30, 0.42, 0.065, 0.095, 32, P.dark);
  for (let i = 0; i < 10; i++) { // TEN ROLLERS — the bearing read, and the spin tell
    const a = i / 10 * 6.2831853;
    s3sphere(M, [Math.cos(a) * 0.36, Math.sin(a) * 0.36, 0.045], 0.052, 12, 8, P.light);
  }
  for (let i = 0; i < 16; i++) { // the toothed inner edge
    const a = (i + 0.5) / 16 * 6.2831853, ca = Math.cos(a), sa = Math.sin(a);
    s3box(M, [ca * 0.28, sa * 0.28, 0.01], V3scl([ca, sa, 0], 0.026),
      V3scl([-sa, ca, 0], 0.022), [0, 0, 0.030], P.mid);
  }
  s3greebleRing(M, 0.31, 0.41, 0.024, 24, [P.mid, P.dark], rnd, { h: 0.020 });
  for (let i = 0; i < 5; i++) { // the interdiction's violet, on its own hardware
    const a = i / 5 * 6.2831853;
    M.lamp([Math.cos(a) * 0.41, Math.sin(a) * 0.41, 0.09], [212, 101, 255], 0.006, i / 5, 'beacon');
  }
  return M;
}
// LCHHUB — the lamp housing: a drum with a recessed mouth (the live lamp burns
// INSIDE it — colour is the fight's tell, so it is never baked) and four
// hazard-tipped clamp jaws. The machine is FASTENED to the lane; these say so.
function s3_lchhub(M, seed) {
  const rnd = s3rng(seed || 9173), P = s3palette(M);
  s3cyl(M, [0, 0, 0], [0, 0, 1], 0.30, 0.075, 28, P.hull, true);
  s3greebleRing(M, 0.20, 0.30, 0.077, 26, [P.mid, P.light, P.dark], rnd, { h: 0.026 });
  s3annulus(M, 0.285, 0.315, 0.07, 0.10, 28, P.haz);
  // the mouth: recessed bay, so the live lamp appears to leave a real opening
  s3cyl(M, [0, 0, 0.09], [0, 0, 1], 0.185, 0.020, 24, P.dark, true);
  s3cyl(M, [0, 0, 0.105], [0, 0, 1], 0.135, 0.014, 22, P.bay, true);
  for (let i = 0; i < 8; i++) { // iris louvres around the mouth
    const a = i / 8 * 6.2831853, ca = Math.cos(a), sa = Math.sin(a);
    s3box(M, [ca * 0.16, sa * 0.16, 0.10], V3scl([ca, sa, 0], 0.05),
      V3scl([-sa, ca, 0], 0.018), [0, 0, 0.014], P.mid);
  }
  for (let i = 0; i < 4; i++) { // FOUR CLAMP JAWS, set between the iris blades
    const a = i / 4 * 6.2831853 + 0.3927, ca = Math.cos(a), sa = Math.sin(a);
    s3box(M, [ca * 0.36, sa * 0.36, 0.0], V3scl([ca, sa, 0], 0.085),
      V3scl([-sa, ca, 0], 0.045), [0, 0, 0.055], P.hull2);
    s3box(M, [ca * 0.445, sa * 0.445, 0.0], V3scl([ca, sa, 0], 0.020),
      V3scl([-sa, ca, 0], 0.032), [0, 0, 0.046], P.haz);
  }
  s3winRow(M, 0.302, -0.02, 14, P.win, { w: 0.012, h: 0.022, d: 0.007 });
  M.lamp([0, 0, 0.12], [255, 90, 90], 0.020, 0, 'steady'); // the mouth smoulders under the live lamp
  return M;
}

const S3D_BUILDS = [
  { id: 'TRUSS', n: 'truss disc',    kind: 'station', cam: 0.40,  fn: s3_truss },
  { id: 'FORT',  n: 'fortress ring', kind: 'station', cam: 0.40,  fn: s3_fortress },
  { id: 'SPINE', n: 'spine & torus', kind: 'station', cam: 0.255, fn: s3_spine },
  { id: 'PORT',  n: 'port & piers',  kind: 'station', cam: 0.305, fn: s3_port },
  // rotX: a gate is a PORTAL, so it stands square to the lens with its mouth facing
  // the viewer, instead of lying flat as a hoop seen from above. -90° about X takes
  // the ring's plane from XY to XZ and points its aperture down +Y, which is the
  // direction the camera looks FROM (see s3renderSteps: V = -d).
  { id: 'GATE',  n: 'gate',          kind: 'gate',    cam: 0.41,  fn: s3_gate, rotX: -Math.PI / 2 },
  // kind 'boss', not 'station': s3BuildFor deals only from the stations, so a hull
  // registered here can never turn up moored at a relay as scenery.
  // THE WARP LEECH, in three concentric rings the draw counter-rotates live.
  // NO rotX, unlike the hulls this roster replaced: the wheels stay flat in
  // the XY plane and `el` raises the camera to look almost straight down at
  // them. That bakes each ring CIRCULAR — at the default elevation a ring
  // bakes as an ellipse, and an ellipse under ctx.rotate wobbles like a
  // tumbling coin instead of spinning like a wheel. Not exactly 90°: dead
  // vertical degenerates the camera basis (cross with Z-up goes to zero).
  { id: 'LCHRIM',  n: 'leech sprocket', kind: 'boss', cam: 0.66, fn: s3_lchrim,  el: 1.45 },
  { id: 'LCHGEAR', n: 'leech bearing',  kind: 'boss', cam: 1.05, fn: s3_lchgear, el: 1.45 },
  { id: 'LCHHUB',  n: 'leech housing',  kind: 'boss', cam: 1.02, fn: s3_lchhub,  el: 1.45 }
];

// ---------------------------------------------------------------- the render
// CHUNKED. Each `yield` is a safe pause point, so the driver can spend a few
// milliseconds a frame on this and stop. A bake that blocks for half a second is
// a visible stall on the menu, and on a slow phone it is several.
function* s3renderSteps(M, opt) {
  const H = S3D_LIGHT;
  const SS = opt.ss || 2;
  const W = (opt.w || 300) * SS, HH = (opt.h || 300) * SS;
  const S = (opt.scale || 120) * SS;
  const cx = W * 0.5, cy = HH * 0.5;
  const el = opt.el === undefined ? H.el : opt.el, D = opt.dist || H.dist;
  const d = [0, -Math.cos(el), Math.sin(el)];
  const camR = V3norm(V3cross(S3_ZUP, d)), camU = V3cross(d, camR), V = V3scl(d, -1);
  const L = V3norm([H.lx, H.ly, H.lz]);
  const FIL = V3norm([H.filX, H.filY, H.filZ]);
  const SUN = [H.sun, H.sun * H.sunG, H.sun * H.sunB];
  const nP = M.P.length / 3, T = M.T, nT = T.length / 5;
  // Triangles per slice. The driver checks the clock BETWEEN slices, so a slice
  // that takes longer than the whole budget overshoots it — the chunk has to be
  // small enough that one of them is cheap even on a slow phone.
  const CH = 300;

  // ---- shadow map: an orthographic depth buffer from the sun ----
  const SM = opt.sm || (SS > 1 ? 1536 : 768);
  const lr = V3norm(V3cross(S3_ZUP, L)), lu = V3cross(L, lr);
  const lsx = new Float32Array(nP), lsy = new Float32Array(nP), lsz = new Float32Array(nP);
  let lx0 = 1e9, lx1 = -1e9, ly0 = 1e9, ly1 = -1e9;
  for (let i = 0; i < nP; i++) {
    const x = M.P[i * 3], y = M.P[i * 3 + 1], z = M.P[i * 3 + 2];
    const a = x * lr[0] + y * lr[1] + z * lr[2], b = x * lu[0] + y * lu[1] + z * lu[2];
    lsx[i] = a; lsy[i] = b; lsz[i] = -(x * L[0] + y * L[1] + z * L[2]);
    if (a < lx0) lx0 = a; if (a > lx1) lx1 = a;
    if (b < ly0) ly0 = b; if (b > ly1) ly1 = b;
    if ((i & 8191) === 8191) yield;
  }
  const lScale = (SM - 2) / Math.max(lx1 - lx0, ly1 - ly0, 1e-6);
  const shadowBuf = new Float32Array(SM * SM).fill(1e9);
  const toSMx = a => (a - lx0) * lScale + 1, toSMy = b => (b - ly0) * lScale + 1;
  for (let t = 0; t < T.length; t += 5) {
    const a = T[t], b = T[t + 1], c = T[t + 2];
    s3rasterDepth(shadowBuf, SM, SM, toSMx(lsx[a]), toSMy(lsy[a]), lsz[a],
      toSMx(lsx[b]), toSMy(lsy[b]), lsz[b], toSMx(lsx[c]), toSMy(lsy[c]), lsz[c]);
    if ((t / 5) % CH === CH - 1) yield;
  }
  const texel = 1 / lScale;
  yield;

  // ---- G-buffer ----
  const zb = new Float32Array(W * HH).fill(1e9);
  const gp = new Float32Array(W * HH * 3), gn = new Float32Array(W * HH * 3);
  const gm = new Int32Array(W * HH).fill(-1), gj = new Float32Array(W * HH);
  const sx = new Float32Array(nP), sy = new Float32Array(nP), sz = new Float32Array(nP);
  for (let i = 0; i < nP; i++) {
    const x = M.P[i * 3], y = M.P[i * 3 + 1], z = M.P[i * 3 + 2];
    const vz = D - (x * d[0] + y * d[1] + z * d[2]), k = D / Math.max(0.1, vz);
    sx[i] = cx + (x * camR[0] + y * camR[1] + z * camR[2]) * k * S;
    sy[i] = cy - (x * camU[0] + y * camU[1] + z * camU[2]) * k * S;
    sz[i] = vz;
    if ((i & 8191) === 8191) yield;
  }
  const P = M.P, N = M.N;
  for (let t = 0; t < T.length; t += 5) {
    const a = T[t], b = T[t + 1], c = T[t + 2], mi = T[t + 3];
    const jit = s3hash(T[t + 4], 7, 3);
    const ax = sx[a], ay = sy[a], bx = sx[b], by = sy[b], cx2 = sx[c], cy2 = sy[c];
    const x0 = Math.max(0, Math.floor(Math.min(ax, bx, cx2))), x1 = Math.min(W - 1, Math.ceil(Math.max(ax, bx, cx2)));
    const y0 = Math.max(0, Math.floor(Math.min(ay, by, cy2))), y1 = Math.min(HH - 1, Math.ceil(Math.max(ay, by, cy2)));
    if (x1 >= x0 && y1 >= y0) {
      const area = (bx - ax) * (cy2 - ay) - (by - ay) * (cx2 - ax);
      if (Math.abs(area) > 1e-9) {
        const ia = 1 / area;
        for (let py = y0; py <= y1; py++) {
          const fy = py + 0.5;
          for (let px = x0; px <= x1; px++) {
            const fx = px + 0.5;
            const w0 = ((bx - ax) * (fy - ay) - (by - ay) * (fx - ax)) * ia;
            const w1 = ((fx - ax) * (cy2 - ay) - (fy - ay) * (cx2 - ax)) * ia;
            const w2 = 1 - w0 - w1;
            if (w0 < 0 || w1 < 0 || w2 < 0) continue;
            const z = sz[a] * w2 + sz[b] * w1 + sz[c] * w0, o = py * W + px;
            if (z >= zb[o]) continue;
            zb[o] = z;
            gp[o * 3] = P[a * 3] * w2 + P[b * 3] * w1 + P[c * 3] * w0;
            gp[o * 3 + 1] = P[a * 3 + 1] * w2 + P[b * 3 + 1] * w1 + P[c * 3 + 1] * w0;
            gp[o * 3 + 2] = P[a * 3 + 2] * w2 + P[b * 3 + 2] * w1 + P[c * 3 + 2] * w0;
            gn[o * 3] = N[a * 3] * w2 + N[b * 3] * w1 + N[c * 3] * w0;
            gn[o * 3 + 1] = N[a * 3 + 1] * w2 + N[b * 3 + 1] * w1 + N[c * 3 + 1] * w0;
            gn[o * 3 + 2] = N[a * 3 + 2] * w2 + N[b * 3 + 2] * w1 + N[c * 3 + 2] * w0;
            gm[o] = mi; gj[o] = jit;
          }
        }
      }
    }
    if ((t / 5) % CH === CH - 1) yield;
  }
  yield;

  // ---- occlusion, straight off the depth buffer ----
  // It darkens every place two parts meet without knowing anything about either
  // of them. This is most of what grounds two hundred crates onto one deck.
  const ao = new Float32Array(W * HH).fill(1);
  const rad = H.aoR, NS = 12;
  for (let py = 0; py < HH; py++) {
    for (let px = 0; px < W; px++) {
      const o = py * W + px;
      if (gm[o] < 0) continue;
      const pr = Math.max(2, (rad * D / zb[o]) * S);
      const P0x = gp[o * 3], P0y = gp[o * 3 + 1], P0z = gp[o * 3 + 2];
      const nn = V3norm([gn[o * 3], gn[o * 3 + 1], gn[o * 3 + 2]]);
      let occ = 0, tot = 0;
      const rot = s3hash(px, py, 11) * 6.2831853;
      for (let s = 0; s < NS; s++) {
        const ang = rot + s * 2.3999, rr = pr * Math.sqrt((s + 0.5) / NS);
        const qx = (px + Math.cos(ang) * rr) | 0, qy = (py + Math.sin(ang) * rr) | 0;
        if (qx < 0 || qy < 0 || qx >= W || qy >= HH) continue;
        const q = qy * W + qx;
        tot++;
        if (gm[q] < 0) continue;
        const vx = gp[q * 3] - P0x, vy = gp[q * 3 + 1] - P0y, vz2 = gp[q * 3 + 2] - P0z;
        const dl = Math.hypot(vx, vy, vz2);
        if (dl < 1e-5 || dl > rad * 2.2) continue;
        const ndv = (vx * nn[0] + vy * nn[1] + vz2 * nn[2]) / dl;
        if (ndv > 0.08) occ += (ndv - 0.08) * (1 / (1 + dl / rad));
      }
      if (tot) ao[o] = Math.max(0.06, 1 - H.aoK * (occ / tot) * 2.6);
    }
    if (py % 16 === 15) yield;
  }
  {
    // Chunked by ROW, not by pass. A whole separable pass over a 600x600 buffer
    // is a third of a second on a slow phone — yielding only between passes put
    // one 460 ms frame in the middle of the menu.
    const tmp = new Float32Array(W * HH), br = Math.max(1, Math.round(2 * SS));
    for (let pass = 0; pass < 2; pass++) {
      for (let py = 0; py < HH; py++) {
        for (let px = 0; px < W; px++) {
          let s = 0, n = 0;
          for (let k = -br; k <= br; k++) {
            const q = px + k; if (q < 0 || q >= W) continue;
            const o2 = py * W + q; if (gm[o2] < 0) continue;
            s += ao[o2]; n++;
          }
          tmp[py * W + px] = n ? s / n : 1;
        }
        if (py % 24 === 23) yield;
      }
      for (let py = 0; py < HH; py++) {
        for (let px = 0; px < W; px++) {
          let s = 0, n = 0;
          for (let k = -br; k <= br; k++) {
            const q = py + k; if (q < 0 || q >= HH) continue;
            const o2 = q * W + px; if (gm[o2] < 0) continue;
            s += tmp[o2]; n++;
          }
          ao[py * W + px] = n ? s / n : 1;
        }
        if (py % 24 === 23) yield;
      }
    }
  }

  // ---- lamps: project them, and keep the ones the hull does not hide ----
  const lamps = [];
  for (const lp of M.lamps) {
    const p = lp.p;
    const vz = D - (p[0] * d[0] + p[1] * d[1] + p[2] * d[2]), k = D / Math.max(0.1, vz);
    const px = cx + (p[0] * camR[0] + p[1] * camR[1] + p[2] * camR[2]) * k * S;
    const py = cy - (p[0] * camU[0] + p[1] * camU[1] + p[2] * camU[2]) * k * S;
    const ix = px | 0, iy = py | 0;
    if (ix < 0 || iy < 0 || ix >= W || iy >= HH) continue;
    if (zb[iy * W + ix] < vz - 0.012) continue;
    lamps.push({ x: px / SS, y: py / SS, c: lp.c[0] + ',' + lp.c[1] + ',' + lp.c[2],
      r: Math.max(0.6, lp.r * S / SS), ph: lp.ph, k: lp.k,
      wx: p[0], wy: p[1], wz: p[2],
      lr: lp.c[0] / 255, lg: lp.c[1] / 255, lb: lp.c[2] / 255 });
  }
  yield;

  // ---- shade ----
  const col = new Float32Array(W * HH * 3), emi = new Float32Array(W * HH * 3);
  const lampR2 = H.lampR * H.lampR;
  const lampRef2 = Math.pow(H.lampR * H.lampRef, 2);
  for (let py = 0; py < HH; py++) {
    for (let px = 0; px < W; px++) {
      const o = py * W + px, mi = gm[o];
      if (mi < 0) continue;
      const m = M.mats[mi];
      let n = [gn[o * 3], gn[o * 3 + 1], gn[o * 3 + 2]];
      const nl = Math.hypot(n[0], n[1], n[2]) || 1;
      n = [n[0] / nl, n[1] / nl, n[2] / nl];
      if (n[0] * V[0] + n[1] * V[1] + n[2] * V[2] > 0) n = [-n[0], -n[1], -n[2]];
      const P0 = [gp[o * 3], gp[o * 3 + 1], gp[o * 3 + 2]];
      // surface: per-part tone, a hue drift with it, grime, panel lines
      let k = 1 + (gj[o] - 0.5) * 2 * m.jit, gloss = 1;
      const tj = (s3hash((gj[o] * 8192) | 0, 91, 13) - 0.5) * (m.jit > 0 ? 0.14 : 0);
      if (m.grime > 0) {
        const gr = s3fbm(P0[0] * 5.1, P0[1] * 5.1, P0[2] * 5.1, 4);
        const st = s3fbm(P0[0] * 3.4, P0[1] * 3.4, P0[2] * 34, 2);
        const dirt = s3clamp01((gr - 0.34) * 2.6) * 0.62 + s3clamp01((st - 0.42) * 3.0) * 0.38;
        k *= 1 - m.grime * dirt * 0.75;
        gloss = 1 - m.grime * dirt * 0.85;
      }
      if (m.pl) {
        const f = m.pl.f, w = m.pl.w || 0.03;
        let c0, c1, c2;
        if (m.pl.m === 'cyl') {
          c0 = Math.atan2(P0[1], P0[0]) / 6.2831853 * f[0];
          c1 = Math.hypot(P0[0], P0[1]) * f[1]; c2 = P0[2] * f[2];
        } else { c0 = P0[0] * f[0]; c1 = P0[1] * f[1]; c2 = P0[2] * f[2]; }
        let dd = 9;
        for (const c of [c0, c1, c2]) if (c) dd = Math.min(dd, Math.abs(c - Math.round(c)));
        if (dd < w) k *= 0.66 + 0.34 * (dd / w);   // a groove, and no bright lip:
      }                                            // a lip beside every line tiles the hull
      const alb = [m.al[0] * k * (1 + tj), m.al[1] * k, m.al[2] * k * (1 - tj)];
      // the sun, and whether this pixel can see it
      const ndl = n[0] * L[0] + n[1] * L[1] + n[2] * L[2];
      let sh = 1;
      if (ndl > 0) {
        const a = P0[0] * lr[0] + P0[1] * lr[1] + P0[2] * lr[2];
        const b = P0[0] * lu[0] + P0[1] * lu[1] + P0[2] * lu[2];
        const z = -(P0[0] * L[0] + P0[1] * L[1] + P0[2] * L[2]);
        const tx = toSMx(a) | 0, ty = toSMy(b) | 0;
        const bias = texel * (0.9 + 2.4 * Math.sqrt(Math.max(0, 1 - ndl * ndl)) / Math.max(0.12, ndl)) + 0.0016;
        let lit = 0;
        for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
          const qx = tx + i, qy = ty + j;
          lit += (qx < 0 || qy < 0 || qx >= SM || qy >= SM || z - bias <= shadowBuf[qy * SM + qx]) ? 1 : 0;
        }
        sh = H.shadowFloor + (1 - H.shadowFloor) * (lit / 9);
      }
      const A = ao[o], lam = Math.max(0, ndl) * sh;
      let r = alb[0] * lam * SUN[0], g = alb[1] * lam * SUN[1], b = alb[2] * lam * SUN[2];
      const upk = 0.5 + 0.5 * n[2];
      r += alb[0] * (H.skyR * upk + H.gndR * (1 - upk)) * A;
      g += alb[1] * (H.skyG * upk + H.gndG * (1 - upk)) * A;
      b += alb[2] * (H.skyB * upk + H.gndB * (1 - upk)) * A;
      const fk = Math.max(0, n[0] * FIL[0] + n[1] * FIL[1] + n[2] * FIL[2]) * A;
      r += alb[0] * fk * H.filR; g += alb[1] * fk * H.filG; b += alb[2] * fk * H.filB;
      if (m.s > 0 && ndl > 0) {
        const Hh = V3norm([L[0] - V[0], L[1] - V[1], L[2] - V[2]]);
        const nh = Math.max(0, n[0] * Hh[0] + n[1] * Hh[1] + n[2] * Hh[2]);
        const fz = 1 + 2.6 * Math.pow(1 - Math.min(1, Math.abs(n[0] * V[0] + n[1] * V[1] + n[2] * V[2])), 4);
        const sp = Math.pow(nh, m.g * (0.45 + 0.55 * gloss)) * m.s * gloss * sh * A * fz;
        r += sp * SUN[0] * (0.35 + 0.65 * alb[0] / (alb[0] + 0.04));
        g += sp * SUN[1] * (0.35 + 0.65 * alb[1] / (alb[1] + 0.04));
        b += sp * SUN[2] * (0.35 + 0.65 * alb[2] / (alb[2] + 0.04));
      }
      // LAMPS AS LIGHTS. Inverse square, gated by the surface normal, so a
      // running light actually pools on the metal it is bolted to.
      if (H.lampK > 0) {
        for (let li = 0; li < lamps.length; li++) {
          const lp = lamps[li];
          const dx = lp.wx - P0[0], dy = lp.wy - P0[1], dz = lp.wz - P0[2];
          const d2 = dx * dx + dy * dy + dz * dz;
          if (d2 > lampR2) continue;
          const dl = Math.sqrt(d2) || 1e-4;
          const nd = (dx * n[0] + dy * n[1] + dz * n[2]) / dl;
          if (nd <= 0) continue;
          const fall = 1 - d2 / lampR2;          // and a soft cutoff at the reach,
          const kk = H.lampK * nd * fall * fall   // so no lamp has a hard edge
            * (lampRef2 / (d2 + lampRef2));
          r += kk * lp.lr; g += kk * lp.lg; b += kk * lp.lb;
        }
      }
      const fres = Math.pow(1 - Math.min(1, Math.abs(n[0] * V[0] + n[1] * V[1] + n[2] * V[2])), 3.4);
      const rim = fres * H.rimK * A;
      r += rim * 0.42; g += rim * 0.62; b += rim;
      if (m.e > 0) {
        let fl = 1;
        if (m.eJit) {
          const h1 = s3hash((gj[o] * 4096) | 0, 17, 5);
          fl = h1 < 0.13 ? 0.04 : 0.45 + 0.75 * s3hash((gj[o] * 4096) | 0, 29, 7);
        }
        if (m.eCyl) {
          // sampled in CYLINDRICAL coordinates, so the noise stretches into
          // radial filaments — a field being drawn toward its emitters
          const ang = Math.atan2(P0[1], P0[0]), rr = Math.hypot(P0[0], P0[1]);
          const f1 = s3fbm(Math.cos(ang) * m.eCyl[0], Math.sin(ang) * m.eCyl[0], rr * m.eCyl[1], 3);
          const f2 = s3fbm(Math.cos(ang) * m.eCyl[0] * 2.7 + 5, Math.sin(ang) * m.eCyl[0] * 2.7, rr * m.eCyl[1] * 0.4, 2);
          fl *= 0.10 + 2.0 * Math.pow(s3clamp01(f1 * 0.65 + f2 * 0.55), 1.6);
        }
        if (m.eRad) {
          const rr = Math.hypot(P0[0], P0[1]);
          fl *= m.eRad[0] + (1 - m.eRad[0]) * Math.pow(s3clamp01(rr / m.eRad[1]), m.eRad[2] || 2.2);
        }
        const e = m.e * fl;
        r += m.el[0] * e; g += m.el[1] * e; b += m.el[2] * e;
        emi[o * 3] = m.el[0] * e; emi[o * 3 + 1] = m.el[1] * e; emi[o * 3 + 2] = m.el[2] * e;
      }
      col[o * 3] = r; col[o * 3 + 1] = g; col[o * 3 + 2] = b;
    }
    if (py % 12 === 11) yield;
  }
  yield;

  // ---- bloom, so lit windows spill into the dark ----
  {
    const bw = W >> 2, bh = HH >> 2;
    const b0 = new Float32Array(bw * bh * 3), b1 = new Float32Array(bw * bh * 3);
    for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
      let r = 0, g = 0, b = 0;
      for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
        const o = ((y * 4 + j) * W + x * 4 + i) * 3;
        r += emi[o]; g += emi[o + 1]; b += emi[o + 2];
      }
      const o = (y * bw + x) * 3;
      b0[o] = r / 16; b0[o + 1] = g / 16; b0[o + 2] = b / 16;
    }
    const blur = (rad2) => {
      for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
        let r = 0, g = 0, b = 0, n = 0;
        for (let k = -rad2; k <= rad2; k++) {
          const o = (y * bw + Math.min(bw - 1, Math.max(0, x + k))) * 3;
          r += b0[o]; g += b0[o + 1]; b += b0[o + 2]; n++;
        }
        const o = (y * bw + x) * 3; b1[o] = r / n; b1[o + 1] = g / n; b1[o + 2] = b / n;
      }
      for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
        let r = 0, g = 0, b = 0, n = 0;
        for (let k = -rad2; k <= rad2; k++) {
          const o = (Math.min(bh - 1, Math.max(0, y + k)) * bw + x) * 3;
          r += b1[o]; g += b1[o + 1]; b += b1[o + 2]; n++;
        }
        const o = (y * bw + x) * 3; b0[o] = r / n; b0[o + 1] = g / n; b0[o + 2] = b / n;
      }
    };
    blur(3); yield; blur(6); yield;
    for (let y = 0; y < HH; y++) {
      for (let x = 0; x < W; x++) {
        const s = (Math.min(bh - 1, y >> 2) * bw + Math.min(bw - 1, x >> 2)) * 3, o = (y * W + x) * 3;
        col[o] += b0[s] * H.bloom; col[o + 1] += b0[s + 1] * H.bloom; col[o + 2] += b0[s + 2] * H.bloom;
      }
      if (y % 48 === 47) yield;
    }
  }
  yield;

  // ---- resolve: one filmic shoulder in linear, then exactly one sRGB encode ----
  const outW = W / SS, outH = HH / SS;
  const cv = document.createElement('canvas');
  cv.width = outW; cv.height = outH;
  const oc = cv.getContext('2d');
  const img = oc && oc.createImageData && oc.createImageData(outW, outH);
  if (!img || !img.data) return null;
  // THE LIVE-SURFACE MASK. Coverage of every `fx` material that survived the
  // depth test — so the throat's animation is occluded by the near half of the
  // ring for free, exactly as the baked field already is. Built in the same
  // resolve loop because that is the only place the subsamples are still here.
  const fxMat = M.mats.map(m => (m && m.fx ? 1 : 0));
  const anyFx = fxMat.indexOf(1) >= 0;
  const fimg = anyFx ? oc.createImageData(outW, outH) : null;
  const fdat = fimg && fimg.data;
  let fxHit = 0;
  const dat = img.data, EXP = H.exposure;
  const tm = c => {
    c = Math.max(0, c) * EXP;
    c = (c * (2.51 * c + 0.03)) / (c * (2.43 * c + 0.59) + 0.14);
    return Math.min(255, Math.round(Math.pow(Math.min(1, c), 1 / 2.2) * 255));
  };
  for (let y = 0; y < outH; y++) {
    for (let x = 0; x < outW; x++) {
      let r = 0, g = 0, b = 0, a = 0, fx = 0;
      for (let j = 0; j < SS; j++) for (let i = 0; i < SS; i++) {
        const o = (y * SS + j) * W + x * SS + i;
        r += col[o * 3]; g += col[o * 3 + 1]; b += col[o * 3 + 2];
        a += gm[o] >= 0 ? 1 : Math.min(1, (col[o * 3] + col[o * 3 + 1] + col[o * 3 + 2]) * 1.4);
        if (fdat && gm[o] >= 0) fx += fxMat[gm[o]];
      }
      const nn = SS * SS, o2 = (y * outW + x) * 4;
      dat[o2] = tm(r / nn); dat[o2 + 1] = tm(g / nn); dat[o2 + 2] = tm(b / nn);
      dat[o2 + 3] = Math.min(255, Math.round(a / nn * 255));
      if (fdat && fx) {
        fdat[o2] = 255; fdat[o2 + 1] = 255; fdat[o2 + 2] = 255;
        fdat[o2 + 3] = Math.round(fx / nn * 255);
        fxHit++;
      }
    }
    if (y % 32 === 31) yield;
  }
  oc.putImageData(img, 0, 0);
  let field = null;
  if (fdat && fxHit) {                 // a build with no live surface carries no mask
    field = document.createElement('canvas');
    field.width = outW; field.height = outH;
    const fc = field.getContext('2d');
    if (fc) fc.putImageData(fimg, 0, 0); else field = null;
  }
  return { cv, S: outW, R: S / SS, lamps, field };
}
// depth-only raster, for the shadow pass
function s3rasterDepth(buf, W, H, ax, ay, az, bx, by, bz, cx, cy, cz) {
  const x0 = Math.max(0, Math.floor(Math.min(ax, bx, cx))), x1 = Math.min(W - 1, Math.ceil(Math.max(ax, bx, cx)));
  const y0 = Math.max(0, Math.floor(Math.min(ay, by, cy))), y1 = Math.min(H - 1, Math.ceil(Math.max(ay, by, cy)));
  if (x1 < x0 || y1 < y0) return;
  const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
  if (Math.abs(area) < 1e-9) return;
  const ia = 1 / area;
  for (let py = y0; py <= y1; py++) {
    const fy = py + 0.5;
    for (let px = x0; px <= x1; px++) {
      const fx = px + 0.5;
      const w0 = ((bx - ax) * (fy - ay) - (by - ay) * (fx - ax)) * ia;
      const w1 = ((fx - ax) * (cy - ay) - (fy - ay) * (cx - ax)) * ia;
      if (w0 < 0 || w1 < 0 || 1 - w0 - w1 < 0) continue;
      const z = az * (1 - w0 - w1) + bz * w1 + cz * w0, o = py * W + px;
      if (z < buf[o]) buf[o] = z;
    }
  }
}
// the synchronous door, for the lab and for anything that wants it now
function s3render(M, opt) {
  const it = s3renderSteps(M, opt);
  let r = it.next();
  while (!r.done) r = it.next();
  return r.value;
}

// ---------------------------------------------------- THE LIVE THROAT
// The animated half of a gate. Everything here is composited THROUGH the bake's
// `fx` mask, so it can be drawn as loosely as it likes — anything that lands
// outside the aperture, or behind the near half of the ring, is cut away by the
// mask rather than by arithmetic.

// One scratch surface per size. Masking needs a surface of its own, and the
// alternative — a new canvas every frame — is a garbage-collection stutter on
// exactly the device that can least afford one.
const _s3fx = {};
function s3fxSurface(n) {
  let s = _s3fx[n];
  if (s === undefined) {
    s = null;
    if (typeof document !== 'undefined') {
      const el = document.createElement('canvas');
      el.width = n; el.height = n;
      const c = el.getContext && el.getContext('2d');
      if (c) s = { el, c };
    }
    _s3fx[n] = s;
  }
  return s;
}
// FILM GRAIN, as film actually does it: a few frames of fixed grain cycled, not
// fresh noise every frame. Fresh-every-frame is video noise, and the eye knows
// the difference. Baked once, on demand, and never if this context cannot make
// an ImageData (the same wall the sprites themselves hit).
let _s3grain;
function s3grainTiles() {
  if (_s3grain !== undefined) return _s3grain;
  _s3grain = [];
  if (typeof document === 'undefined') return _s3grain;
  const N = 64;
  for (let k = 0; k < 3; k++) {
    const el = document.createElement('canvas');
    el.width = N; el.height = N;
    const c = el.getContext && el.getContext('2d');
    const img = c && c.createImageData && c.createImageData(N, N);
    if (!img || !img.data) { _s3grain = []; return _s3grain; }
    const d = img.data;
    for (let i = 0; i < N * N; i++) {
      // squared, so the field is mostly quiet with occasional bright specks —
      // an even spread of grey reads as a screen door over the aperture
      const v = s3hash(i % N, (i / N) | 0, 17 + k * 131);
      d[i * 4] = 255; d[i * 4 + 1] = 255; d[i * 4 + 2] = 255;
      d[i * 4 + 3] = Math.round(v * v * 255);
    }
    c.putImageData(img, 0, 0);
    _s3grain.push(el);
  }
  return _s3grain;
}
// Draw the live throat for a sprite that has one, at the size it is on screen.
// `c` and `t` are passed rather than read off the module so the lab can drive
// this on its own canvas and its own clock.
// THE LANE LEANING OUT OF THE MOUTH.
//
// s3warp paints the throat THROUGH the bake's mask, which is exactly right for
// something living inside the aperture and wrong for this: a corridor that stops at
// the hardware isn't coming out of anywhere. So this one draws unmasked, on the game
// canvas, over the ring — because it is in front of it.
//
// The gate now stands square to the lens, so its axis points very nearly AT the
// camera and the spill is foreshortened to almost nothing: end-on, a corridor reads
// as a bloom with the corridor's walls in it, not as a beam. Hence a bloom plus a
// few faint shafts. When gates start facing left and right (see rotZ on the registry)
// the same axis maths gives a real beam instead, and only `ax`/`ay` change.
function s3lane(c, sp, x, y, w, alpha, t) {
  const F = typeof S3D_WARP === 'undefined' ? null : S3D_WARP;
  if (!F || !sp || !sp.field || !(w >= F.minPx) || !(F.lane > 0.002)) return;
  const R = (sp.R / sp.S) * w * 0.85;                 // aperture radius, on screen
  if (!(R > 1)) return;
  const breath = 1 + F.pulse * Math.sin(t * (6.2831853 / Math.max(0.2, F.pulseP)));
  const reach = R * F.laneLen * breath;
  const a = F.lane * breath * (alpha === undefined ? 1 : alpha);
  c.save();
  c.globalCompositeOperation = 'lighter';
  // the spill itself: brightest at the mouth, gone by the time it has come a
  // gate-and-a-bit toward you
  const gl = c.createRadialGradient(x, y, R * 0.10, x, y, R + reach);
  gl.addColorStop(0, 'rgba(' + F.col + ',' + (a * 0.85).toFixed(3) + ')');
  gl.addColorStop(0.42, 'rgba(' + F.col + ',' + (a * 0.32).toFixed(3) + ')');
  gl.addColorStop(1, 'rgba(' + F.col + ',0)');
  c.fillStyle = gl;
  c.beginPath(); c.arc(x, y, R + reach, 0, 6.2831853); c.fill();
  // …and the corridor itself, as RINGS FALLING INTO THE MOUTH. Radial spokes were
  // the first attempt and they read as clock hands: end-on, a corridor is not spokes,
  // it is hoops — which is exactly how the game draws its lane everywhere else.
  //
  // THE RINGS RUN INWARD, and they run in PERSPECTIVE (Gil, 2026-08-12). They used
  // to be born at the aperture and swell outward on a LINEAR radius, which gave two
  // wrong readings at once: a gate exhaling, and — because linear spacing has no
  // convergence — concentric circles stamped on top of the hardware rather than a
  // corridor leading away to it. Now each hoop is given a DEPTH and its radius is
  // R * (gateZ / z), the honest 1/z projection: hoops released near the camera come
  // in wide and, as z walks toward the gate's own depth, they shrink AND bunch up
  // against the mouth exactly the way real perspective packs them. That convergence
  // is the distance cue; the eye reads a receding tunnel instead of a flat decal.
  //
  // Squashed on the same axis as the aperture, so the hoops sit in the mouth's plane
  // instead of floating in front of it.
  // ---- THE APPROACH LANE: beacons on a road in, sequenced toward the gate ----
  // A LANE ARRIVES FROM SOMEWHERE, which is what makes this work where hoops
  // could not: markers on your own sight line to the gate project concentrically
  // (rings on the hardware), but a lane is allowed — required, even — to come in
  // from the side, and reads as a road the moment it does.
  //
  // The beacons are one straight line in space running out from the gate toward
  // the camera's side of it. Position, spacing and size are all the SAME 1/z
  // projection, so they bunch and shrink toward the gate exactly as a real
  // approach does; only their brightness is authored, and that is the sequenced
  // flasher sweeping gateward to say WHICH WAY IN.
  const NL = Math.max(0, Math.round(F.laneLights === undefined ? 0 : F.laneLights));
  if (NL > 1) {
    const sq = Math.max(0.12, sp.apUp ? Math.cos(S3D_LIGHT.el) : Math.sin(S3D_LIGHT.el));
    const cx0 = (typeof W === 'number' ? W : 0) * 0.5, cy0 = (typeof H === 'number' ? H : 0) * 0.5;
    // DOWN THE SCENE'S OWN PERSPECTIVE. Everything here is drawn to a vanishing
    // point at the frame's centre — it is why the warp streaks rake outward from
    // it — so the corridor lies along the radial through the gate and matches
    // them. Picking any other axis (a flat horizontal, say) draws a lane
    // CROSSING the scene, which is the diagonal it read as.
    let axx = x - cx0, axy = y - cy0;
    const al0 = Math.hypot(axx, axy);
    if (al0 < 1e-3) { axx = 0; axy = 1; } else { axx /= al0; axy /= al0; }
    axy += F.laneDrop === undefined ? 0.30 : F.laneDrop; // ...and a few degrees under it
    const al = Math.hypot(axx, axy) || 1;
    axx /= al; axy /= al;
    // the rails run either side of that axis. Their separation carries the SAME
    // 1/z as everything else, which is what makes two parallel lines of lights
    // converge on the gate the way a runway's edges do.
    const pxn = -axy, pyn = axx * sq;     // squashed like the aperture it leads to
    const rail = (F.laneRail === undefined ? 1.15 : F.laneRail) * R;
    const zN = Math.max(0.12, Math.min(0.95, F.laneNear === undefined ? 0.52 : F.laneNear));
    const spread = (F.laneReach === undefined ? 3.2 : F.laneReach) / (1 / zN - 1); // far end lands at laneReach
    const head = 1 - ((t * (F.laneSeq === undefined ? 0.55 : F.laneSeq)) % 1);     // sweeps 1 → 0: inbound
    const base = F.laneBase === undefined ? 0.42 : F.laneBase;
    const lr = (F.laneR === undefined ? 0.05 : F.laneR) * R;
    const col = F.laneCol || F.col;
    for (let i = 0; i < NL; i++) {
      const s = i / (NL - 1);              // 0 at the gate, 1 at the far end
      const z = 1 - s * (1 - zN);          // ...and nearer the lens as it goes
      const inv = 1 / z;
      const off = spread * R * (inv - 1);  // the projection that spaces them
      // the sequenced flash: a head running down the lane toward the mouth, the
      // way approach lighting tells a pilot which end is the runway
      const d = ((s - head) % 1 + 1) % 1;
      const lit = base + (1 - base) * Math.pow(1 - d, 10);
      const rr = lr * inv;                 // nearer beacons are bigger
      if (rr < 0.05) continue; // floored below, so only the truly absent are skipped
      // the lane carries its OWN brightness: the spill's soft wash is the wrong
      // ceiling for a point source, which lives or dies on contrast
      const A = (alpha === undefined ? 1 : alpha) * breath
        * (F.laneLit === undefined ? 0.95 : F.laneLit) * lit;
      for (const side of [-1, 1]) {        // one rail each side of the corridor
        const px = x + axx * off + pxn * rail * inv * side;
        const py = y + axy * off + pyn * rail * inv * side;
        // A POINT SOURCE, drawn the way the station lamps are: a hard little
        // core carrying almost all the brightness, inside a halo that falls off
        // FAST. A single wide gradient — which is what this was — has to choose
        // between a soft ball and a flat disc, and either way it reads as an
        // object rather than as a light seen from a long way off.
        const hr = rr * 2.8;
        const gl2 = c.createRadialGradient(px, py, 0, px, py, hr);
        gl2.addColorStop(0.00, 'rgba(' + col + ',' + (A * 0.75).toFixed(3) + ')');
        gl2.addColorStop(0.20, 'rgba(' + col + ',' + (A * 0.28).toFixed(3) + ')');
        gl2.addColorStop(0.55, 'rgba(' + col + ',' + (A * 0.07).toFixed(3) + ')');
        gl2.addColorStop(1, 'rgba(' + col + ',0)');
        c.fillStyle = gl2;
        c.beginPath(); c.arc(px, py, hr, 0, 6.2831853); c.fill();
        // the filament: near white-hot and SMALL, floored at sub-pixel range so
        // a distant marker dims rather than disappearing — a light that drops
        // out entirely just reads as a gap in the chain
        c.fillStyle = 'rgba(236,255,240,' + Math.min(1, A * 1.35).toFixed(3) + ')';
        c.beginPath(); c.arc(px, py, Math.max(0.7, rr * 0.44), 0, 6.2831853); c.fill();
      }
    }
  }
  c.restore();
}

function s3warp(c, sp, x, y, w, alpha, t) {
  const F = typeof S3D_WARP === 'undefined' ? null : S3D_WARP;
  if (!F || !sp || !sp.field || !(w >= F.minPx)) return;
  // The surface is sized to what is ON SCREEN, not to the sprite: for most of an
  // approach the gate is smaller than this sentence, and a 300px scratch buffer
  // for a 30px destination is the whole cost of the effect wasted.
  //
  // SNAPPED to a power of two, which is the whole reason a cache works here. An
  // approach grows the gate by a fraction of a pixel a frame, so keying the
  // cache on the exact width would mint a new canvas almost every frame and
  // keep every one of them. This way the entire run uses five.
  const want = Math.min(sp.S, Math.max(24, Math.ceil(w)));
  const n = Math.min(sp.S, 1 << Math.ceil(Math.log2(want)));
  const S = s3fxSurface(n);
  if (!S) return;
  const g = S.c, k = n / sp.S;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = 'source-over';
  g.clearRect(0, 0, n, n);
  const cx = n / 2, cy = n / 2;
  // The aperture is a circle seen at an angle, so on screen it is an ellipse. WHICH
  // ellipse depends on how the gate stands: a flat gate's mouth lies in the camera's
  // ground plane and squashes by sin(el); an upright one faces the lens and squashes
  // by cos(el) — nearly round. sp.apUp is recorded at bake time from the same
  // registry flag that did the rotating, so the two cannot drift apart.
  // Draw in circle space; the mask trims the overshoot.
  const sq = Math.max(0.12, sp.apUp ? Math.cos(S3D_LIGHT.el) : Math.sin(S3D_LIGHT.el));
  const R = sp.R * k * 0.85;
  const breath = 1 + F.pulse * Math.sin(t * (6.2831853 / Math.max(0.2, F.pulseP)));
  g.save();
  g.translate(cx, cy);
  g.scale(1, sq);
  // the standing glow the filaments fall into
  if (F.core > 0.002 && R > 1) {
    const gl = g.createRadialGradient(0, 0, 0, 0, 0, R);
    gl.addColorStop(0, 'rgba(' + F.col + ',' + (F.core * breath).toFixed(3) + ')');
    gl.addColorStop(0.45, 'rgba(' + F.col + ',' + (F.core * breath * 0.30).toFixed(3) + ')');
    gl.addColorStop(1, 'rgba(' + F.col + ',0)');
    g.fillStyle = gl;
    g.beginPath(); g.arc(0, 0, R, 0, 6.2831853); g.fill();
  }
  // ...and the filaments themselves, falling in and twisting as they go
  g.lineCap = 'round';
  const NS = Math.max(0, Math.round(F.streaks));
  for (let i = 0; i < NS; i++) {
    const ph = s3hash(i, 3, 91), rate = 0.62 + s3hash(i, 7, 13) * 0.9;
    const q = ((t * F.speed * rate + ph) % 1 + 1) % 1;
    const fade = Math.sin(q * Math.PI);          // fades in and out, never pops
    if (fade < 0.03) continue;
    const a0 = s3hash(i, 11, 29) * 6.2831853;
    const twist = F.swirl * (s3hash(i, 5, 71) < 0.5 ? -1 : 1);
    const head = R * (1 - q), tail = Math.min(R * 1.02, head + R * F.len);
    const wid = Math.max(0.5, F.streakW * k * (0.6 + fade * 0.7));
    const path = (from, to) => {
      g.beginPath();
      for (let s = 0; s <= 5; s++) {
        const u = s / 5, rr = from + (to - from) * u;
        const aa = a0 + twist * (1 - rr / R);
        const px = Math.cos(aa) * rr, py = Math.sin(aa) * rr;
        s ? g.lineTo(px, py) : g.moveTo(px, py);
      }
      g.stroke();
    };
    g.strokeStyle = 'rgba(' + F.col + ',' + (F.bright * fade * 0.30).toFixed(3) + ')';
    g.lineWidth = wid * 2.2;
    path(tail, head);
    g.strokeStyle = 'rgba(' + F.col + ',' + (F.bright * fade).toFixed(3) + ')';
    g.lineWidth = wid;
    path(tail, head);
    g.strokeStyle = 'rgba(255,255,255,' + (F.bright * fade * 0.55).toFixed(3) + ')';
    g.lineWidth = Math.max(0.4, wid * 0.42);
    path(head + (tail - head) * 0.55, head);     // the hot leading end
  }
  g.restore();
  // grain last, in SCREEN space — it is the film the shot is on, not something
  // lying on the disc
  if (F.grain > 0.004) {
    const tiles = s3grainTiles();
    if (tiles.length) {
      const step = Math.floor(t * Math.max(1, F.grainFps));
      const tile = tiles[((step % tiles.length) + tiles.length) % tiles.length];
      const px = Math.max(1, F.grainPx * k), side = tile.width * px;
      const ox = -((s3hash(step, 1, 5) * side) | 0), oy = -((s3hash(step, 2, 9) * side) | 0);
      g.save();
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = F.grain;
      g.imageSmoothingEnabled = false;
      for (let yy = oy; yy < n; yy += side) for (let xx = ox; xx < n; xx += side)
        g.drawImage(tile, xx, yy, side, side);
      g.restore();
    }
  }
  // and the whole layer through the bake's mask, so the ring occludes it
  g.globalCompositeOperation = 'destination-in';
  g.drawImage(sp.field, 0, 0, n, n);
  g.globalCompositeOperation = 'source-over';
  c.save();
  c.globalCompositeOperation = 'lighter';
  if (alpha !== undefined && alpha < 1) c.globalAlpha = alpha;
  c.drawImage(S.el, x - w / 2, y - w / 2, w, w);
  c.restore();
}
// <<< DEST-S3D

// ---------- THE CAMPAIGN'S FINAL DESTINATION ----------
// >>> DEST-S3D-PICK
// Every contract ends somewhere specific, and it is the same place every time —
// the one relay in the galaxy a player can learn by sight. Gil's mapping, in
// campaign order, so the ladder escalates: a working port, then a gate, then the
// long spine, then the drydock, then the fortress at the far end.
//
// The last level of a campaign is its boss, and destKindFor sends bosses to a
// star. The FINAL destination outranks that: you fight the interdictor at the
// gates of the place you were escorting the convoy to, which is a better story
// than fighting it at an anonymous sun.
// The build standing at each campaign's endpoint — one baked model per contract,
// authored for that arrival. Keyed by campaign id (these were the retired slugs
// until the deal became data; see DEST_DEAL in 80-tunnel). DEST_DEAL's last cell
// per campaign says the same thing and the test suite asserts they agree.
const S3D_FINAL = {
  'cargo-run': 'PORT',
  'survey': 'GATE',
  'collector': 'SPINE',
  'patrol': 'TRUSS',
  'delegation': 'FORT'
};
const s3build = id => S3D_BUILDS.find(b => b.id === id) || S3D_BUILDS[0];
// Is this relay a campaign's endpoint? Only the LAST level counts, and only for
// a campaign that has a build assigned.
function s3FinalFor(campId, lv) {
  const id = S3D_FINAL[campId];
  if (!id) return null;
  // Matched on the id, which is what every caller passes and what S3D_FINAL is keyed
  // by. This asked for the seed while the keys were slugs; when they briefly disagreed
  // it found nothing and fell back to last = 7, which was right only because every
  // campaign happens to have eight relays.
  const camp = typeof CAMPAIGNS !== 'undefined' && CAMPAIGNS.find(c => c.id === campId);
  const last = camp && camp.levels ? camp.levels.length - 1 : 7;
  return lv === last ? id : null;
}
// Which build stands at a given relay. The endpoint is fixed; everywhere else is
// dealt off its own hash stream, so an ordinary station relay is still one of
// the four and still the same one every time you fly it.
function s3BuildFor(campId, lv, kind) {
  const fin = s3FinalFor(campId, lv);
  if (fin) return fin;
  if (kind === 'gate') return 'GATE';   // a gate relay is a gate, whatever the deal says
  const frozen = dealBuildId(campId, lv);
  if (frozen) return frozen;
  let h = 0x811c9dc5;
  const id = (campId || 'x') + '#s3';
  for (let i = 0; i < id.length; i++) { h ^= id.charCodeAt(i); h = Math.imul(h, 16777619); }
  h ^= lv + 1; h = Math.imul(h, 16777619);
  h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); h ^= h >>> 15;
  const st = S3D_BUILDS.filter(b => b.kind === 'station');
  return st[(h >>> 0) % st.length].id;
}
// <<< DEST-S3D-PICK

// ---------- THE BAKE, SPREAD OVER THE MENU ----------
// Gil's call, and the right one: the sprites are built while the player is
// picking a contract, not during a run and not in a loading bar. Each build gets
// a few milliseconds a frame until it is done.
const S3D_REF = 300;              // sprite side, in CSS pixels
const s3Sprites = {};             // id -> { cv, S, R, lamps, mips } | 'fail'
let s3Job = null, s3Queue = [], s3Started = false;
let s3Blocked = false;            // set once if this environment has no ImageData
// Mip chain: the chart draws these at three or four pixels, and downscaling a
// 300px sprite that far in one step aliases into confetti. Halving repeatedly
// costs almost nothing and is what a GPU would do anyway.
function s3mips(cv) {
  const out = [cv];
  let cur = cv;
  while (cur.width > 16) {
    const n = document.createElement('canvas');
    n.width = Math.max(8, cur.width >> 1); n.height = Math.max(8, cur.height >> 1);
    const c = n.getContext('2d');
    if (!c || !c.drawImage) break;
    c.imageSmoothingEnabled = true;
    c.drawImage(cur, 0, 0, n.width, n.height);
    out.push(n); cur = n;
  }
  return out;
}
function s3Enqueue() {
  if (s3Started) return;
  s3Started = true;
  // endpoints first — they are the ones a player is flying toward — then the rest
  const first = Object.keys(S3D_FINAL).map(c => S3D_FINAL[c]);
  s3Queue = first.concat(S3D_BUILDS.map(b => b.id).filter(id => first.indexOf(id) < 0))
    .filter((id, i, a) => a.indexOf(id) === i);
}
// Spend up to `budget` ms. Returns true while there is still work to do.
function s3Pump(budget) {
  if (s3Blocked) return false;
  const t0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  const now = () => (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  while (now() - t0 < budget) {
    if (!s3Job) {
      const id = s3Queue.shift();
      if (!id) return false;
      if (s3Sprites[id]) continue;
      const B = s3build(id);
      const M = new S3Mesh();
      const slow = typeof lowFX !== 'undefined' && lowFX;
      const ss = slow ? 1 : 2, ref = slow ? 200 : S3D_REF;
      // On a device already asking for reduced effects, thin the hardware out
      // too: the mesh build is the one step that cannot be sliced, so the only
      // lever on its cost is how much of it there is.
      const keep = S3D_LIGHT.detail;
      if (slow) S3D_LIGHT.detail = (keep === undefined ? 1 : keep) * S3D_LIGHT.detailLow;
      try {
        B.fn(M, 4801 + id.charCodeAt(0) * 131);
        // …then stand it up if the build asks to. Declared per build rather than
        // baked into the builder's coordinates: s3_gate describes a ring in the XY
        // plane in the same terms every other ring here uses, and one rotation at
        // the end is far less to get wrong than swapping axes across sixty calls.
        if (B.rotX) M.rotX(B.rotX);
        if (B.rotZ) M.rotZ(B.rotZ);   // yaw last: swing the stood-up mouth off-axis
      }
      catch (e) { S3D_LIGHT.detail = keep; s3Sprites[id] = 'fail'; continue; }
      S3D_LIGHT.detail = keep;
      s3Job = { id, it: s3renderSteps(M, { w: ref, h: ref, ss, scale: ref * B.cam, el: B.el }) };
      // Constructing the geometry is one long unchunked call — 38k triangles for
      // the drydock — so it gets the frame to itself. Rendering on the same slice
      // is what turns a long frame into a visibly dropped one.
      return true;
    }
    let r;
    try { r = s3Job.it.next(); }
    catch (e) { s3Sprites[s3Job.id] = 'fail'; s3Job = null; continue; }
    if (r.done) {
      const v = r.value;
      if (v && v.cv) {
        v.mips = s3mips(v.cv);
        // THE APERTURE'S SCREEN SHAPE, recorded here so the live throat layer cannot
        // disagree with the geometry it is painting over. A gate built flat has its
        // mouth in the XY plane, which the camera sees from S3D_LIGHT.el above — so
        // it projects to an ellipse squashed by sin(el). Stand the gate upright and
        // the mouth moves to XZ, facing the lens, and the squash becomes cos(el):
        // nearly a circle. s3warp used to hardcode sin(el), which was right only for
        // as long as every gate lay flat.
        const B2 = s3build(s3Job.id);
        v.apUp = !!(B2 && B2.rotX);
        s3Sprites[s3Job.id] = v;
      }
      else { s3Sprites[s3Job.id] = 'fail'; s3Blocked = true; s3Job = null; return false; }
      s3Job = null;
    }
  }
  return true;
}
const s3SpriteFor = id => {
  const s = s3Sprites[id];
  return s && s !== 'fail' ? s : null;
};

// ---------- DRAWING ONE ----------
// The sprite is the metal; the lamps go over it live. That split is the entire
// reason the thing reads as occupied — a baked light is a painted dot, and a
// painted dot on a station is the same tell as a painted window on a house.
function s3drawLamps(sp, x, y, k, alpha) {
  const H = S3D_LIGHT;
  if (k < 0.02 || alpha < 0.02) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const L of sp.lamps) {
    const b = s3lamp(L.k, time, L.ph) * alpha;
    if (b < 0.03) continue;
    const px = x + (L.x - sp.S * 0.5) * k, py = y + (L.y - sp.S * 0.5) * k;
    const r = Math.max(0.35, L.r * k), R = r * H.haloR;
    // THE SOFT FALLOFF. Three stops, not two: a bright core, a shoulder that
    // carries most of the light, and a long tail. A single linear gradient reads
    // as a disc with a soft edge; this reads as a light.
    const g = ctx.createRadialGradient(px, py, 0, px, py, R);
    g.addColorStop(0, 'rgba(' + L.c + ',' + (H.haloA * b).toFixed(3) + ')');
    g.addColorStop(0.16, 'rgba(' + L.c + ',' + (H.haloA * b * 0.26).toFixed(3) + ')');
    g.addColorStop(0.48, 'rgba(' + L.c + ',' + (H.haloA * b * 0.055).toFixed(3) + ')');
    g.addColorStop(1, 'rgba(' + L.c + ',0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(px, py, R, 0, TAU); ctx.fill();
    // REFRACTION, in the two ways a bright point actually breaks up: a cold
    // skirt outside the warm centre, and a diffraction cross. Both are faint —
    // above a whisper they stop reading as optics and start reading as a filter.
    if (H.chroma > 0.01) {
      const g2 = ctx.createRadialGradient(px, py, R * 0.30, px, py, R * 0.92);
      g2.addColorStop(0, 'rgba(150,205,255,0)');
      g2.addColorStop(0.55, 'rgba(150,205,255,' + (H.chroma * b * 0.055).toFixed(3) + ')');
      g2.addColorStop(1, 'rgba(120,170,255,0)');
      ctx.fillStyle = g2;
      ctx.beginPath(); ctx.arc(px, py, R * 0.92, 0, TAU); ctx.fill();
    }
    if (H.spike > 0.01 && r >= H.spikeMin) {
      const len = R * H.spikeL;
      const sg = ctx.createLinearGradient(px - len, py, px + len, py);
      const sa = (H.spike * b * 0.30).toFixed(3);
      sg.addColorStop(0, 'rgba(' + L.c + ',0)');
      sg.addColorStop(0.5, 'rgba(' + L.c + ',' + sa + ')');
      sg.addColorStop(1, 'rgba(' + L.c + ',0)');
      ctx.fillStyle = sg;
      ctx.fillRect(px - len, py - r * 0.30, len * 2, r * 0.60);
      const sg2 = ctx.createLinearGradient(px, py - len, px, py + len);
      sg2.addColorStop(0, 'rgba(' + L.c + ',0)');
      sg2.addColorStop(0.5, 'rgba(' + L.c + ',' + sa + ')');
      sg2.addColorStop(1, 'rgba(' + L.c + ',0)');
      ctx.fillStyle = sg2;
      ctx.fillRect(px - r * 0.30, py - len, r * 0.60, len * 2);
    }
    ctx.fillStyle = 'rgba(' + L.c + ',' + (H.coreA * b).toFixed(3) + ')';
    ctx.beginPath(); ctx.arc(px, py, r, 0, TAU); ctx.fill();
  }
  ctx.restore();
}
// WHAT STANDS THERE BEFORE THE SPRITE EXISTS.
//
// There used to be a whole second station renderer for this — the flat-shaded
// vector torus — which meant the game carried two incompatible ideas of what a
// station looks like so that one of them could cover a gap measured in seconds.
// That is a bad trade: it doubled the art to maintain and it put a shape on
// screen that the destination was never going to settle into.
//
// This is the honest version. A dark hull disc with a lit upper limb, on the
// same key light and the same steel as the build that is about to replace it.
// It is not a station and does not pretend to be one — it is the mass, at the
// right size, in the right light. In practice it is only ever seen as a chart
// chip in the first seconds on the menu, and as a speck at the far end of the
// bore, because the destination spends most of its approach smaller than this
// paragraph's full stop.
function s3placeholder(x, y, R, alpha) {
  if (R < 0.6) return;
  const H = S3D_LIGHT;
  const lx = -H.lx, ly = -H.ly;                 // toward the lit limb, on screen
  const n = Math.hypot(lx, ly) || 1;
  ctx.save();
  if (alpha !== undefined && alpha < 1) ctx.globalAlpha = alpha;
  const sq = Math.max(0.12, Math.sin(H.el));    // the same squash the builds sit at
  ctx.beginPath();
  ctx.ellipse(x, y, R, R * sq, 0, 0, TAU);
  const g = ctx.createRadialGradient(
    x + (lx / n) * R * 0.55, y + (ly / n) * R * sq * 0.55, R * 0.05, x, y, R * 1.25);
  g.addColorStop(0, 'rgba(96,101,110,0.95)');
  g.addColorStop(0.55, 'rgba(48,52,60,0.92)');
  g.addColorStop(1, 'rgba(20,23,30,0.90)');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.restore();
}
// Draw a build at radius R (in station radii -> pixels). Always draws something:
// the baked sprite if it exists, the placeholder above if the bake has not
// reached this build yet. Returns true when what landed was the real thing.
function s3draw(x, y, R, id, alpha, noLamps) {
  const sp = s3SpriteFor(id);
  if (!sp) { s3placeholder(x, y, R, alpha === undefined ? 1 : alpha); return false; }
  const w = sp.S * (R / sp.R);
  // pick the mip whose width is nearest above the target, so a chart chip is a
  // filtered downscale rather than a point-sampled mess
  let cv = sp.cv;
  if (sp.mips && w < sp.S * 0.6) {
    for (const m of sp.mips) { if (m.width >= w) cv = m; else break; }
  }
  ctx.save();
  if (alpha !== undefined && alpha < 1) ctx.globalAlpha = alpha;
  ctx.drawImage(cv, x - w / 2, y - w / 2, w, w);
  ctx.restore();
  // a gate's throat is alive — the same call that skips lamps skips this, since
  // both are the "this is a chip on a chart" case
  if (!noLamps) s3warp(ctx, sp, x, y, w, alpha === undefined ? 1 : alpha, time);
  // the lane leaning out of the mouth, over the hardware because it is in front of it
  if (!noLamps) s3lane(ctx, sp, x, y, w, alpha === undefined ? 1 : alpha, time);
  if (!noLamps) s3drawLamps(sp, x, y, w / sp.S, alpha === undefined ? 1 : alpha);
  return true;
}

// Queue the builds at boot. Nothing renders here — s3Enqueue only writes a list;
// the work happens a few milliseconds at a time in the frame loop, and only on
// the menu.
s3Enqueue();
