'use strict';
// R3D — a tiny software 3D renderer for baking station sprites.
//
// Why a real renderer and not more vector art: the thing that separates "machined
// metal" from "a drawing of metal" is not linework, it is (a) surfaces that turn
// against a light, (b) parts that cast shadows ON each other, (c) dirt in the
// crevices, and (d) hundreds of small components each slightly different. All four
// need geometry and a depth buffer. This is a bake — it runs once per station and
// the result is a cached sprite — so it can afford to be slow and correct.
//
// Pipeline: geometry -> shadow map (ortho, from the sun) -> G-buffer (z, world pos,
// normal, material, uv) -> SSAO off the depth -> deferred shade -> bloom -> RGBA.

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scl = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const norm = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const ZUP = [0, 0, 1];
const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;

// ---- value noise, for grime and surface variation ----
function hashi(a, b, c) {
  let h = Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul(c | 0, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function vnoise(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const sx = xf * xf * (3 - 2 * xf), sy = yf * yf * (3 - 2 * yf), sz = zf * zf * (3 - 2 * zf);
  let r = 0;
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) for (let k = 0; k < 2; k++) {
    const w = (i ? sx : 1 - sx) * (j ? sy : 1 - sy) * (k ? sz : 1 - sz);
    r += w * hashi(xi + i, yi + j, zi + k);
  }
  return r;
}
function fbm(x, y, z, oct) {
  let a = 0.5, f = 1, s = 0;
  for (let i = 0; i < oct; i++) { s += a * vnoise(x * f, y * f, z * f); f *= 2.03; a *= 0.5; }
  return s / (1 - Math.pow(0.5, oct)) * 0.5;
}

// ============================================================ MESH

class Mesh {
  constructor() {
    this.P = [];      // positions, flat xyz
    this.N = [];      // normals, flat xyz
    this.UV = [];     // uv, flat uv
    this.T = [];      // triangles: [i0,i1,i2, matIdx, jitterSeed]
    this.mats = [];
    this.lamps = [];  // live blinking lights: {p, c, r, ph, sp}
    this._seq = 0;
  }
  mat(m) {
    const M = Object.assign({
      a: [140, 145, 155],   // albedo, as sRGB 0..255 (converted to linear on use)
      g: 26,                // gloss exponent
      s: 0.30,              // specular strength
      e: 0,                 // emissive strength
      ec: [255, 200, 120],  // emissive colour
      pl: null,             // panel lines: {m:'cyl'|'cart', f:[a,b,c], w}
      jit: 0.10,            // per-PART albedo jitter — the plate-variation cue
      grime: 0.55           // how hard the world-space dirt noise bites
    }, m);
    // sRGB -> linear once, here, so shading happens in the space light actually
    // works in. Doing it per pixel was what made every surface converge on the
    // same mid grey: two gammas stacked crush the whole range into the middle.
    M.al = M.a.map(c => Math.pow(c / 255, 2.2));
    M.el = M.ec.map(c => Math.pow(c / 255, 2.2));
    this.mats.push(M);
    return this.mats.length - 1;
  }
  // A PART is one physical component. Every triangle of one box shares a jitter,
  // because a crate is one shade of grey on all six sides — jittering per triangle
  // gave every box six different faces, which averaged out to no variation at all.
  part() { this._pid = (this._pid || 0) + 1; return this._pid; }
  vert(p, n, uv) {
    this.P.push(p[0], p[1], p[2]);
    this.N.push(n[0], n[1], n[2]);
    this.UV.push(uv ? uv[0] : 0, uv ? uv[1] : 0);
    return this.P.length / 3 - 1;
  }
  tri(a, b, c, m) { this.T.push(a, b, c, m, this._pid || 0); }
  // a flat quad; normal from the winding, uv 0..1 across it unless given
  quad(p0, p1, p2, p3, m, uv) {
    const n = norm(cross(sub(p1, p0), sub(p3, p0)));
    const U = uv || [[0, 0], [1, 0], [1, 1], [0, 1]];
    const a = this.vert(p0, n, U[0]), b = this.vert(p1, n, U[1]);
    const c = this.vert(p2, n, U[2]), d = this.vert(p3, n, U[3]);
    this.tri(a, b, c, m); this.tri(a, c, d, m);
  }
  lamp(p, c, r, ph, sp) { this.lamps.push({ p, c, r, ph: ph || 0, sp: sp === undefined ? 1 : sp }); }
}

// ---- primitive builders. Every one takes explicit basis vectors so a part can
// sit anywhere on the ring without a matrix stack. ----

// A box from a centre and three half-extent VECTORS.
function box(M, o, ex, ey, ez, m, uvS) {
  M.part();
  const c = (i, j, k) => [
    o[0] + ex[0] * i + ey[0] * j + ez[0] * k,
    o[1] + ex[1] * i + ey[1] * j + ez[1] * k,
    o[2] + ex[2] * i + ey[2] * j + ez[2] * k];
  const s = uvS || 1;
  const lx = Math.hypot(ex[0], ex[1], ex[2]) * 2 * s;
  const ly = Math.hypot(ey[0], ey[1], ey[2]) * 2 * s;
  const lz = Math.hypot(ez[0], ez[1], ez[2]) * 2 * s;
  const q = (a, b, cc, d, w, h) => M.quad(a, b, cc, d, m, [[0, 0], [w, 0], [w, h], [0, h]]);
  q(c(1, -1, -1), c(1, 1, -1), c(1, 1, 1), c(1, -1, 1), ly, lz);
  q(c(-1, 1, -1), c(-1, -1, -1), c(-1, -1, 1), c(-1, 1, 1), ly, lz);
  q(c(1, 1, -1), c(-1, 1, -1), c(-1, 1, 1), c(1, 1, 1), lx, lz);
  q(c(-1, -1, -1), c(1, -1, -1), c(1, -1, 1), c(-1, -1, 1), lx, lz);
  q(c(-1, -1, 1), c(1, -1, 1), c(1, 1, 1), c(-1, 1, 1), lx, ly);
  q(c(-1, 1, -1), c(1, 1, -1), c(1, -1, -1), c(-1, -1, -1), lx, ly);
}

// perpendicular basis for an axis
function basis(ax) {
  const a = norm(ax);
  let t = Math.abs(a[2]) < 0.9 ? ZUP : [1, 0, 0];
  const u = norm(cross(a, t));
  return [u, cross(a, u), a];
}

// A cylinder with SMOOTH side normals — what makes a drum read as round rather
// than as a stack of flat strips.
function cyl(M, o, ax, r, hl, seg, m, caps, r2) {
  M.part();
  const [u, v, a] = basis(ax);
  const rb = r, rt = r2 === undefined ? r : r2;
  const ring = (rad, h) => {
    const out = [];
    for (let i = 0; i < seg; i++) {
      const t = (i / seg) * Math.PI * 2, cx = Math.cos(t), sy = Math.sin(t);
      const n = norm([u[0] * cx + v[0] * sy, u[1] * cx + v[1] * sy, u[2] * cx + v[2] * sy]);
      const p = [o[0] + n[0] * rad + a[0] * h, o[1] + n[1] * rad + a[1] * h, o[2] + n[2] * rad + a[2] * h];
      out.push({ p, n, t: i / seg });
    }
    return out;
  };
  const A = ring(rb, -hl), B = ring(rt, hl);
  for (let i = 0; i < seg; i++) {
    const j = (i + 1) % seg;
    const i0 = M.vert(A[i].p, A[i].n, [A[i].t * seg * 0.5, 0]);
    const i1 = M.vert(A[j].p, A[j].n, [(A[i].t * seg + 1) * 0.5, 0]);
    const i2 = M.vert(B[j].p, B[j].n, [(A[i].t * seg + 1) * 0.5, hl * 2]);
    const i3 = M.vert(B[i].p, B[i].n, [A[i].t * seg * 0.5, hl * 2]);
    M.tri(i0, i1, i2, m); M.tri(i0, i2, i3, m);
  }
  if (caps !== false) {
    for (const [R, h, nn] of [[rb, -hl, scl(a, -1)], [rt, hl, a]]) {
      const cIdx = M.vert([o[0] + a[0] * h, o[1] + a[1] * h, o[2] + a[2] * h], nn, [0.5, 0.5]);
      const rr = ring(R, h);
      for (let i = 0; i < seg; i++) {
        const j = (i + 1) % seg;
        const p0 = M.vert(rr[i].p, nn, [0.5 + Math.cos(rr[i].t * 6.2832) * 0.5, 0.5 + Math.sin(rr[i].t * 6.2832) * 0.5]);
        const p1 = M.vert(rr[j].p, nn, [0.5 + Math.cos(rr[j].t * 6.2832) * 0.5, 0.5 + Math.sin(rr[j].t * 6.2832) * 0.5]);
        M.tri(cIdx, p0, p1, m);
      }
    }
  }
}

// An extruded annulus — the shape a station ring actually is. `gap` cuts a wedge
// out of it (in radians, [from, to]) so a docking mouth can be a real hole in the
// armour rather than a bright rectangle painted on it.
function annulus(M, rIn, rOut, z0, z1, seg, m, opt) {
  opt = opt || {};
  const gap = opt.gap;
  const inGap = a => {
    if (!gap) return false;
    let t = ((a - gap[0]) % 6.2832 + 6.2832) % 6.2832;
    return t < ((gap[1] - gap[0]) % 6.2832 + 6.2832) % 6.2832;
  };
  const uvS = opt.uvS || 1;
  const step = Math.PI * 2 / seg;
  const P = (r, a, z) => [Math.cos(a) * r, Math.sin(a) * r, z];
  for (let i = 0; i < seg; i++) {
    const a0 = i * step, a1 = (i + 1) * step, am = (a0 + a1) * 0.5;
    if (inGap(am)) continue;
    M.part();
    const u0 = i * uvS, u1 = (i + 1) * uvS;
    // top + bottom plates
    M.quad(P(rIn, a0, z1), P(rOut, a0, z1), P(rOut, a1, z1), P(rIn, a1, z1), m,
      [[u0, 0], [u0, 1], [u1, 1], [u1, 0]]);
    if (opt.bottom !== false)
      M.quad(P(rIn, a0, z0), P(rIn, a1, z0), P(rOut, a1, z0), P(rOut, a0, z0), m,
        [[u0, 0], [u1, 0], [u1, 1], [u0, 1]]);
    // walls, with smooth normals round the circumference
    const wall = (r, sgn, mm) => {
      const n0 = [Math.cos(a0) * sgn, Math.sin(a0) * sgn, 0], n1 = [Math.cos(a1) * sgn, Math.sin(a1) * sgn, 0];
      const v0 = M.vert(P(r, a0, z0), n0, [u0, 0]), v1 = M.vert(P(r, a1, z0), n1, [u1, 0]);
      const v2 = M.vert(P(r, a1, z1), n1, [u1, 1]), v3 = M.vert(P(r, a0, z1), n0, [u0, 1]);
      M.tri(v0, v1, v2, mm); M.tri(v0, v2, v3, mm);
    };
    wall(rOut, 1, opt.mOut === undefined ? m : opt.mOut);
    wall(rIn, -1, opt.mIn === undefined ? m : opt.mIn);
  }
  // the cut faces at either end of the gap — a hole has WALLS, and seeing them is
  // what makes it a recess instead of a notch drawn on the outline
  if (gap) {
    M.part();
    for (const a of gap) {
      M.quad(P(rIn, a, z0), P(rOut, a, z0), P(rOut, a, z1), P(rIn, a, z1),
        opt.mCut === undefined ? m : opt.mCut);
    }
  }
}

function torus(M, R, r, segU, segV, m, z) {
  M.part();
  z = z || 0;
  const g = [];
  for (let i = 0; i < segU; i++) {
    const a = (i / segU) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
    const row = [];
    for (let j = 0; j < segV; j++) {
      const b = (j / segV) * Math.PI * 2, cb = Math.cos(b), sb = Math.sin(b);
      const n = [ca * cb, sa * cb, sb];
      row.push(M.vert([ca * (R + r * cb), sa * (R + r * cb), z + r * sb], n, [i / segU * segU * 0.25, j / segV]));
    }
    g.push(row);
  }
  for (let i = 0; i < segU; i++) for (let j = 0; j < segV; j++) {
    const i2 = (i + 1) % segU, j2 = (j + 1) % segV;
    M.tri(g[i][j], g[i2][j], g[i2][j2], m); M.tri(g[i][j], g[i2][j2], g[i][j2], m);
  }
}

// A structural beam between two points — square section, so it catches light on
// two faces and reads as a girder rather than a line.
function beam(M, p0, p1, w, m, h) {
  const d = sub(p1, p0), L = Math.hypot(d[0], d[1], d[2]);
  if (L < 1e-6) return;
  M.part();
  const a = scl(d, 1 / L), [u, v] = basis(a);
  box(M, scl(add(p0, p1), 0.5), scl(u, w), scl(v, h === undefined ? w : h), scl(a, L * 0.5), m, 1);
}

// ============================================================ RENDER

function render(M, opt) {
  const SS = opt.ss || 2;
  const W = (opt.w || 480) * SS, H = (opt.h || 480) * SS;
  const S = (opt.scale || 200) * SS;          // pixels per world unit at the origin
  const el = opt.el === undefined ? 0.56 : opt.el;   // camera elevation over the ring plane
  const az = opt.az || 0;
  const D = opt.dist || 9;                     // camera distance, in world units
  const cx = W * 0.5 + (opt.ox || 0) * SS, cy = H * 0.5 + (opt.oy || 0) * SS;

  const d = [Math.sin(az) * Math.cos(el), -Math.cos(az) * Math.cos(el), Math.sin(el)];
  const camR = norm(cross(ZUP, d));
  const camU = cross(d, camR);
  const camF = scl(d, -1);
  // A GRAZING key light, not one over the camera's shoulder. Relief is only
  // visible where something can cast onto something else, and a light down the
  // view axis casts everything neatly behind itself where you cannot see it.
  const L = norm(opt.light || [-0.80, -0.26, 0.46]);   // direction TO the sun
  const SUN = opt.sun || [2.55, 2.42, 2.18];
  const SKY = opt.sky || [0.052, 0.070, 0.125];        // cool fill from the star field
  const GND = opt.gnd || [0.012, 0.013, 0.020];        // the void: nearly nothing
  const FIL = norm(opt.fill || [0.62, 0.55, -0.30]);   // cold bounce from the far side
  const FILC = opt.fillC || [0.075, 0.098, 0.155];
  const nP = M.P.length / 3;

  // ---------- shadow map ----------
  const SM = opt.sm || 2048;
  const lr = norm(cross(ZUP, L)), lu = cross(L, lr);
  const lsx = new Float32Array(nP), lsy = new Float32Array(nP), lsz = new Float32Array(nP);
  let lx0 = 1e9, lx1 = -1e9, ly0 = 1e9, ly1 = -1e9;
  for (let i = 0; i < nP; i++) {
    const x = M.P[i * 3], y = M.P[i * 3 + 1], z = M.P[i * 3 + 2];
    const a = x * lr[0] + y * lr[1] + z * lr[2];
    const b = x * lu[0] + y * lu[1] + z * lu[2];
    lsx[i] = a; lsy[i] = b; lsz[i] = -(x * L[0] + y * L[1] + z * L[2]);
    if (a < lx0) lx0 = a; if (a > lx1) lx1 = a;
    if (b < ly0) ly0 = b; if (b > ly1) ly1 = b;
  }
  const lpad = 0.02 * Math.max(lx1 - lx0, ly1 - ly0);
  lx0 -= lpad; lx1 += lpad; ly0 -= lpad; ly1 += lpad;
  const lScale = (SM - 2) / Math.max(lx1 - lx0, ly1 - ly0, 1e-6);
  const shadowBuf = new Float32Array(SM * SM).fill(1e9);
  const toSMx = a => (a - lx0) * lScale + 1, toSMy = b => (b - ly0) * lScale + 1;
  {
    const T = M.T;
    for (let t = 0; t < T.length; t += 5) {
      const a = T[t], b = T[t + 1], c = T[t + 2];
      rasterDepth(shadowBuf, SM, SM,
        toSMx(lsx[a]), toSMy(lsy[a]), lsz[a],
        toSMx(lsx[b]), toSMy(lsy[b]), lsz[b],
        toSMx(lsx[c]), toSMy(lsy[c]), lsz[c]);
    }
  }
  const worldPerTexel = 1 / lScale;

  // ---------- G-buffer ----------
  const zb = new Float32Array(W * H).fill(1e9);
  const gp = new Float32Array(W * H * 3);   // world pos
  const gn = new Float32Array(W * H * 3);   // normal
  const gu = new Float32Array(W * H * 2);   // uv
  const gm = new Int32Array(W * H).fill(-1);
  const gj = new Float32Array(W * H);       // per-face jitter
  const sx = new Float32Array(nP), sy = new Float32Array(nP), sz = new Float32Array(nP);
  for (let i = 0; i < nP; i++) {
    const x = M.P[i * 3], y = M.P[i * 3 + 1], z = M.P[i * 3 + 2];
    const vz = D - (x * d[0] + y * d[1] + z * d[2]);
    const k = D / Math.max(0.1, vz);
    sx[i] = cx + (x * camR[0] + y * camR[1] + z * camR[2]) * k * S;
    sy[i] = cy - (x * camU[0] + y * camU[1] + z * camU[2]) * k * S;
    sz[i] = vz;
  }
  {
    const T = M.T, P = M.P, N = M.N, UV = M.UV;
    for (let t = 0; t < T.length; t += 5) {
      const a = T[t], b = T[t + 1], c = T[t + 2], mi = T[t + 3];
      const jit = hashi(T[t + 4], 7, 3);
      rasterG(a, b, c, mi, jit);
      function rasterG(a, b, c, mi, jit) {
        const ax = sx[a], ay = sy[a], bx = sx[b], by = sy[b], cx2 = sx[c], cy2 = sy[c];
        let x0 = Math.max(0, Math.floor(Math.min(ax, bx, cx2)));
        let x1 = Math.min(W - 1, Math.ceil(Math.max(ax, bx, cx2)));
        let y0 = Math.max(0, Math.floor(Math.min(ay, by, cy2)));
        let y1 = Math.min(H - 1, Math.ceil(Math.max(ay, by, cy2)));
        if (x1 < x0 || y1 < y0) return;
        const area = (bx - ax) * (cy2 - ay) - (by - ay) * (cx2 - ax);
        if (Math.abs(area) < 1e-9) return;
        const ia = 1 / area;
        for (let py = y0; py <= y1; py++) {
          const fy = py + 0.5;
          for (let px = x0; px <= x1; px++) {
            const fx = px + 0.5;
            let w0 = ((bx - ax) * (fy - ay) - (by - ay) * (fx - ax)) * ia;   // weight of c
            let w1 = ((fx - ax) * (cy2 - ay) - (fy - ay) * (cx2 - ax)) * ia; // weight of b
            const w2 = 1 - w0 - w1;                                          // weight of a
            if (w0 < 0 || w1 < 0 || w2 < 0) continue;
            const z = sz[a] * w2 + sz[b] * w1 + sz[c] * w0;
            const o = py * W + px;
            if (z >= zb[o]) continue;
            zb[o] = z;
            gp[o * 3] = P[a * 3] * w2 + P[b * 3] * w1 + P[c * 3] * w0;
            gp[o * 3 + 1] = P[a * 3 + 1] * w2 + P[b * 3 + 1] * w1 + P[c * 3 + 1] * w0;
            gp[o * 3 + 2] = P[a * 3 + 2] * w2 + P[b * 3 + 2] * w1 + P[c * 3 + 2] * w0;
            gn[o * 3] = N[a * 3] * w2 + N[b * 3] * w1 + N[c * 3] * w0;
            gn[o * 3 + 1] = N[a * 3 + 1] * w2 + N[b * 3 + 1] * w1 + N[c * 3 + 1] * w0;
            gn[o * 3 + 2] = N[a * 3 + 2] * w2 + N[b * 3 + 2] * w1 + N[c * 3 + 2] * w0;
            gu[o * 2] = UV[a * 2] * w2 + UV[b * 2] * w1 + UV[c * 2] * w0;
            gu[o * 2 + 1] = UV[a * 2 + 1] * w2 + UV[b * 2 + 1] * w1 + UV[c * 2 + 1] * w0;
            gm[o] = mi; gj[o] = jit;
          }
        }
      }
    }
  }

  // ---------- SSAO: the dirt in the crevices ----------
  // Reads the depth buffer, not the geometry, so it darkens every place two parts
  // meet without knowing anything about them. This is most of what sells "built".
  const ao = new Float32Array(W * H).fill(1);
  {
    const rad = (opt.aoR || 0.075);              // world units
    const NS = 12;
    const K = opt.aoK === undefined ? 1.25 : opt.aoK;
    for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) {
      const o = py * W + px;
      if (gm[o] < 0) continue;
      const pz = zb[o];
      const pr = Math.max(2, (rad * D / pz) * S);   // radius in pixels at this depth
      const P0 = [gp[o * 3], gp[o * 3 + 1], gp[o * 3 + 2]];
      const N0 = norm([gn[o * 3], gn[o * 3 + 1], gn[o * 3 + 2]]);
      let occ = 0, tot = 0;
      const rot = hashi(px, py, 11) * 6.2832;
      for (let s = 0; s < NS; s++) {
        const ang = rot + s * 2.3999, rr = pr * Math.sqrt((s + 0.5) / NS);
        const qx = (px + Math.cos(ang) * rr) | 0, qy = (py + Math.sin(ang) * rr) | 0;
        if (qx < 0 || qy < 0 || qx >= W || qy >= H) continue;
        const q = qy * W + qx;
        tot++;
        if (gm[q] < 0) continue;
        const v = [gp[q * 3] - P0[0], gp[q * 3 + 1] - P0[1], gp[q * 3 + 2] - P0[2]];
        const dl = Math.hypot(v[0], v[1], v[2]);
        if (dl < 1e-5 || dl > rad * 2.2) continue;
        const ndv = (v[0] * N0[0] + v[1] * N0[1] + v[2] * N0[2]) / dl;
        if (ndv > 0.08) occ += (ndv - 0.08) * (1 / (1 + dl / rad));
      }
      if (tot) ao[o] = Math.max(0.06, 1 - K * (occ / tot) * 2.6);
    }
    // blur the AO so it reads as shading rather than as noise
    const tmp = new Float32Array(W * H);
    const br = Math.max(1, Math.round(2 * SS));
    for (let pass = 0; pass < 2; pass++) {
      for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) {
        let s = 0, n = 0;
        for (let k = -br; k <= br; k++) {
          const q = px + k; if (q < 0 || q >= W) continue;
          const o2 = py * W + q; if (gm[o2] < 0) continue;
          s += ao[o2]; n++;
        }
        tmp[py * W + px] = n ? s / n : 1;
      }
      for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) {
        let s = 0, n = 0;
        for (let k = -br; k <= br; k++) {
          const q = py + k; if (q < 0 || q >= H) continue;
          const o2 = q * W + px; if (gm[o2] < 0) continue;
          s += tmp[o2]; n++;
        }
        ao[py * W + px] = n ? s / n : 1;
      }
    }
  }

  // ---------- deferred shade ----------
  const col = new Float32Array(W * H * 3);
  const emi = new Float32Array(W * H * 3);
  const V = camF;
  for (let o = 0; o < W * H; o++) {
    const mi = gm[o];
    if (mi < 0) continue;
    const m = M.mats[mi];
    let n = [gn[o * 3], gn[o * 3 + 1], gn[o * 3 + 2]];
    const nl = Math.hypot(n[0], n[1], n[2]) || 1;
    n = [n[0] / nl, n[1] / nl, n[2] / nl];
    if (n[0] * V[0] + n[1] * V[1] + n[2] * V[2] > 0) n = [-n[0], -n[1], -n[2]]; // two-sided
    const P0 = [gp[o * 3], gp[o * 3 + 1], gp[o * 3 + 2]];

    // ---- surface: plate jitter + grime + panel lines ----
    // Per-part tone. THE cheapest realism cue there is: a hull assembled from two
    // hundred components, no two of which came out of the same batch.
    let k = 1 + (gj[o] - 0.5) * 2 * m.jit;
    let gloss = 1;
    // ...and a little HUE drift with it. Batches of plate differ in tint as well
    // as in value; one grey for everything is the thing that says "rendered".
    const tj = (hashi((gj[o] * 8192) | 0, 91, 13) - 0.5) * (m.jit > 0 ? 0.14 : 0);
    if (m.grime > 0) {
      // two scales of dirt: broad staining, and a fine streak that runs along the
      // spin axis the way anything venting on a rotating hull leaves a mark
      const gr = fbm(P0[0] * 5.1, P0[1] * 5.1, P0[2] * 5.1, 4);
      const st = fbm(P0[0] * 3.4, P0[1] * 3.4, P0[2] * 34, 2);
      const dirt = clamp01((gr - 0.34) * 2.6) * 0.62 + clamp01((st - 0.42) * 3.0) * 0.38;
      k *= 1 - m.grime * dirt * 0.75;
      gloss = 1 - m.grime * dirt * 0.85;   // dirt is matte — it kills the specular
    }
    if (m.pl) {
      const f = m.pl.f, w = m.pl.w || 0.03;
      let c0, c1, c2;
      if (m.pl.m === 'cyl') {
        const ang = Math.atan2(P0[1], P0[0]) / 6.2832;
        c0 = ang * f[0]; c1 = Math.hypot(P0[0], P0[1]) * f[1]; c2 = P0[2] * f[2];
      } else { c0 = P0[0] * f[0]; c1 = P0[1] * f[1]; c2 = P0[2] * f[2]; }
      let d = 9;
      for (const c of [c0, c1, c2]) if (c) d = Math.min(d, Math.abs(c - Math.round(c)));
      if (d < w) {
        const t = d / w;
        k *= 0.66 + 0.34 * t;            // a groove, and nothing else: a bright lip
      }                                  // beside every line tiles the whole hull
    }
    const alb = [m.al[0] * k * (1 + tj), m.al[1] * k, m.al[2] * k * (1 - tj)];

    // ---- sun + its shadow ----
    const ndl = n[0] * L[0] + n[1] * L[1] + n[2] * L[2];
    let sh = 1;
    if (ndl > 0) {
      const a = P0[0] * lr[0] + P0[1] * lr[1] + P0[2] * lr[2];
      const b = P0[0] * lu[0] + P0[1] * lu[1] + P0[2] * lu[2];
      const z = -(P0[0] * L[0] + P0[1] * L[1] + P0[2] * L[2]);
      const tx = toSMx(a), ty = toSMy(b);
      const bias = worldPerTexel * (0.9 + 2.4 * Math.sqrt(Math.max(0, 1 - ndl * ndl)) / Math.max(0.12, ndl)) + 0.0016;
      let lit = 0, cnt = 0;
      for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
        const qx = (tx + i) | 0, qy = (ty + j) | 0;
        if (qx < 0 || qy < 0 || qx >= SM || qy >= SM) { lit++; cnt++; continue; }
        lit += (z - bias <= shadowBuf[qy * SM + qx]) ? 1 : 0; cnt++;
      }
      sh = lit / cnt;
      sh = 0.012 + 0.988 * sh;   // vacuum shadows are HARD — almost nothing bounces
    }
    const A = ao[o];
    const lam = Math.max(0, ndl) * sh;
    let r = alb[0] * lam * SUN[0], g2 = alb[1] * lam * SUN[1], b2 = alb[2] * lam * SUN[2];

    // ---- ambient: cool sky above, near-nothing below, gated by occlusion ----
    const upk = 0.5 + 0.5 * n[2];
    r += alb[0] * (SKY[0] * upk + GND[0] * (1 - upk)) * A;
    g2 += alb[1] * (SKY[1] * upk + GND[1] * (1 - upk)) * A;
    b2 += alb[2] * (SKY[2] * upk + GND[2] * (1 - upk)) * A;

    // ---- FILL: a second, dim, cold light from the far side. Without it the
    // unlit half of every station is a black hole and the silhouette dies; with
    // it the dark side still turns, which is what says "solid" in shadow.
    const fk = Math.max(0, n[0] * FIL[0] + n[1] * FIL[1] + n[2] * FIL[2]) * A;
    r += alb[0] * fk * FILC[0]; g2 += alb[1] * fk * FILC[1]; b2 += alb[2] * fk * FILC[2];

    // ---- specular: the actual "this is metal" term ----
    if (m.s > 0 && ndl > 0) {
      const Hh = norm([L[0] - V[0], L[1] - V[1], L[2] - V[2]]);
      const nh = Math.max(0, n[0] * Hh[0] + n[1] * Hh[1] + n[2] * Hh[2]);
      // metal tints its own highlight, and a grazing view brightens it (Fresnel)
      const fz = 1 + 2.6 * Math.pow(1 - Math.min(1, Math.abs(n[0] * V[0] + n[1] * V[1] + n[2] * V[2])), 4);
      const sp = Math.pow(nh, m.g * (0.45 + 0.55 * gloss)) * m.s * gloss * sh * A * fz;
      r += sp * SUN[0] * (0.35 + 0.65 * alb[0] / (alb[0] + 0.04));
      g2 += sp * SUN[1] * (0.35 + 0.65 * alb[1] / (alb[1] + 0.04));
      b2 += sp * SUN[2] * (0.35 + 0.65 * alb[2] / (alb[2] + 0.04));
    }
    // ---- rim: the star field wrapping the silhouette ----
    const fres = Math.pow(1 - Math.min(1, Math.abs(n[0] * V[0] + n[1] * V[1] + n[2] * V[2])), 3.4);
    const rim = fres * 0.055 * A;
    r += rim * 0.42; g2 += rim * 0.62; b2 += rim * 1.0;

    if (m.e > 0) {
      // Windows are not all on, and the ones that are are not all the same. The
      // jitter is quantised per window BOX, so a pane is uniformly lit or dark
      // rather than dissolving into speckle.
      let fl = 1;
      if (m.eJit) {
        const h = hashi(gj[o] * 4096 | 0, 17, 5);
        fl = h < 0.13 ? 0.04 : 0.45 + 0.75 * hashi(gj[o] * 4096 | 0, 29, 7);
      }
      if (m.eNoise) {
        const n1 = fbm(P0[0] * m.eNoise, P0[1] * m.eNoise, P0[2] * m.eNoise * 0.4, 3);
        const n2 = fbm(P0[0] * m.eNoise * 3.1 + 11, P0[1] * m.eNoise * 3.1, 4.3, 2);
        fl *= 0.18 + 1.5 * n1 * (0.55 + 0.75 * n2);
      }
      if (m.eCyl) {
        // sampled in CYLINDRICAL coords, so the noise stretches into radial
        // filaments — a field being drawn toward its emitters, not a stain
        const ang = Math.atan2(P0[1], P0[0]), rr = Math.hypot(P0[0], P0[1]);
        const f1 = fbm(Math.cos(ang) * m.eCyl[0], Math.sin(ang) * m.eCyl[0], rr * m.eCyl[1], 3);
        const f2 = fbm(Math.cos(ang) * m.eCyl[0] * 2.7 + 5, Math.sin(ang) * m.eCyl[0] * 2.7, rr * m.eCyl[1] * 0.4, 2);
        fl *= 0.10 + 2.0 * Math.pow(clamp01(f1 * 0.65 + f2 * 0.55), 1.6);
      }
      if (m.eRad) {   // brightest where the field meets the hardware that holds it
        const rr = Math.hypot(P0[0], P0[1]);
        fl *= m.eRad[0] + (1 - m.eRad[0]) * Math.pow(clamp01(rr / m.eRad[1]), m.eRad[2] || 2.2);
      }
      const e = m.e * fl;
      r += m.el[0] * e; g2 += m.el[1] * e; b2 += m.el[2] * e;
      emi[o * 3] = m.el[0] * e; emi[o * 3 + 1] = m.el[1] * e; emi[o * 3 + 2] = m.el[2] * e;
    }
    col[o * 3] = r; col[o * 3 + 1] = g2; col[o * 3 + 2] = b2;
  }

  // ---------- bloom off the emissives, so lit windows spill into the dark ----------
  {
    const bw = W >> 2, bh = H >> 2;
    const b0 = new Float32Array(bw * bh * 3), b1 = new Float32Array(bw * bh * 3);
    for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
      let r = 0, g2 = 0, b2 = 0;
      for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
        const o = ((y * 4 + j) * W + x * 4 + i) * 3;
        r += emi[o]; g2 += emi[o + 1]; b2 += emi[o + 2];
      }
      const o = (y * bw + x) * 3;
      b0[o] = r / 16; b0[o + 1] = g2 / 16; b0[o + 2] = b2 / 16;
    }
    const blur = (src, dst, rad) => {
      for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
        let r = 0, g2 = 0, b2 = 0, n = 0;
        for (let k = -rad; k <= rad; k++) {
          const q = Math.min(bw - 1, Math.max(0, x + k)) ;
          const o = (y * bw + q) * 3;
          r += src[o]; g2 += src[o + 1]; b2 += src[o + 2]; n++;
        }
        const o = (y * bw + x) * 3; dst[o] = r / n; dst[o + 1] = g2 / n; dst[o + 2] = b2 / n;
      }
      for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
        let r = 0, g2 = 0, b2 = 0, n = 0;
        for (let k = -rad; k <= rad; k++) {
          const q = Math.min(bh - 1, Math.max(0, y + k));
          const o = (q * bw + x) * 3;
          r += dst[o]; g2 += dst[o + 1]; b2 += dst[o + 2]; n++;
        }
        const o = (y * bw + x) * 3; src[o] = r / n; src[o + 1] = g2 / n; src[o + 2] = b2 / n;
      }
    };
    blur(b0, b1, 3); blur(b0, b1, 6);
    const BK = opt.bloom === undefined ? 0.62 : opt.bloom;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const bx = Math.min(bw - 1, x >> 2), by = Math.min(bh - 1, y >> 2);
      const s = (by * bw + bx) * 3, o = (y * W + x) * 3;
      col[o] += b0[s] * BK; col[o + 1] += b0[s + 1] * BK; col[o + 2] += b0[s + 2] * BK;
    }
  }

  // ---------- resolve: tone map, downsample, alpha ----------
  const out = document.createElement('canvas');
  out.width = W / SS; out.height = H / SS;
  const octx = out.getContext('2d');
  const img = octx.createImageData(out.width, out.height);
  const dat = img.data;
  const EXP = opt.exposure === undefined ? 0.62 : opt.exposure;
  for (let y = 0; y < out.height; y++) for (let x = 0; x < out.width; x++) {
    let r = 0, g2 = 0, b2 = 0, a = 0;
    for (let j = 0; j < SS; j++) for (let i = 0; i < SS; i++) {
      const o = ((y * SS + j) * W + x * SS + i);
      r += col[o * 3]; g2 += col[o * 3 + 1]; b2 += col[o * 3 + 2];
      a += gm[o] >= 0 ? 1 : Math.min(1, (col[o * 3] + col[o * 3 + 1] + col[o * 3 + 2]) * 1.4);
    }
    const n = SS * SS;
    r /= n; g2 /= n; b2 /= n; a /= n;
    // one filmic shoulder in LINEAR, then one sRGB encode. Exactly one gamma.
    const tm = c => {
      c = Math.max(0, c) * EXP;
      c = (c * (2.51 * c + 0.03)) / (c * (2.43 * c + 0.59) + 0.14);
      return Math.min(255, Math.round(Math.pow(Math.min(1, c), 1 / 2.2) * 255));
    };
    const o = (y * out.width + x) * 4;
    dat[o] = tm(r); dat[o + 1] = tm(g2); dat[o + 2] = tm(b2); dat[o + 3] = Math.min(255, Math.round(a * 255));
  }
  octx.putImageData(img, 0, 0);

  // ---------- the lamps, projected and depth-tested ----------
  // Positions only: they are drawn LIVE over the sprite so the station blinks.
  const lamps = [];
  for (const lp of M.lamps) {
    const p = lp.p;
    const vz = D - (p[0] * d[0] + p[1] * d[1] + p[2] * d[2]);
    const k = D / Math.max(0.1, vz);
    const px = cx + (p[0] * camR[0] + p[1] * camR[1] + p[2] * camR[2]) * k * S;
    const py = cy - (p[0] * camU[0] + p[1] * camU[1] + p[2] * camU[2]) * k * S;
    const ix = px | 0, iy = py | 0;
    if (ix < 0 || iy < 0 || ix >= W || iy >= H) continue;
    if (zb[iy * W + ix] < vz - 0.012) continue;         // behind the hull
    lamps.push({ x: px / SS, y: py / SS, c: lp.c, r: lp.r * S / SS, ph: lp.ph, sp: lp.sp });
  }
  return { cv: out, lamps, S: out.width };
}

// depth-only raster, for the shadow pass
function rasterDepth(buf, W, H, ax, ay, az, bx, by, bz, cx, cy, cz) {
  let x0 = Math.max(0, Math.floor(Math.min(ax, bx, cx)));
  let x1 = Math.min(W - 1, Math.ceil(Math.max(ax, bx, cx)));
  let y0 = Math.max(0, Math.floor(Math.min(ay, by, cy)));
  let y1 = Math.min(H - 1, Math.ceil(Math.max(ay, by, cy)));
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
      const w2 = 1 - w0 - w1;
      if (w0 < 0 || w1 < 0 || w2 < 0) continue;
      const z = az * w2 + bz * w1 + cz * w0;
      const o = py * W + px;
      if (z < buf[o]) buf[o] = z;
    }
  }
}
