'use strict';
// ---- AN ASTEROID FIELD ----
// Not a sphere, so none of the machinery above applies: no limb, no terminator
// across a single body, no atmosphere. It is a SWARM, and what makes a swarm
// read as one is that its members disagree — different sizes, different rock,
// different lumpy outlines, and near ones lit brighter than far ones. Drawn
// back to front into the same buffer, which is all the depth sorting a field of
// opaque rocks needs.
function buildFieldSprite(R, V) {
  const pad = Math.max(3, Math.round(R * 0.85));
  const S = Math.ceil(R * 2 + pad * 2);
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const c = cv.getContext('2d');
  const img = c && c.createImageData && c.createImageData(S, S);
  if (!img || !img.data) return null;
  const D = img.data;
  const cx = S / 2, cy = S / 2, H = PLANET_SHADE;
  let lx = Math.cos(LIGHT_A), ly = Math.sin(LIGHT_A), lz = H.lz;
  const ln = Math.hypot(lx, ly, lz); lx /= ln; ly /= ln; lz /= ln;
  const [z0, z1, z2] = V.z, [e0, e1, e2] = V.belt;
  const sd = V.seed | 0, n = Math.max(1, Math.round(V.field));
  const rocks = [];
  for (let k = 0; k < n; k++) {
    const a = pnHash(k, 1, 0, sd) * TAU;
    // sqrt keeps the scatter even across the disc instead of piling on the centre
    const rad = Math.sqrt(pnHash(k, 2, 0, sd)) * (V.fieldR != null ? V.fieldR : 1.0);
    const depth = pnHash(k, 5, 0, sd);                       // 0 far, 1 near
    rocks.push({
      ox: Math.cos(a) * rad, oy: Math.sin(a) * rad * (V.fieldSq != null ? V.fieldSq : 0.62),
      // cubed so small rocks massively outnumber large ones, as they do
      rr: H.rockMin + (H.rockMax - H.rockMin) * Math.pow(pnHash(k, 3, 0, sd), 3) * (0.45 + 0.85 * depth),
      seed: sd + k * 37, depth,
      // Depth is carried by BRIGHTNESS as much as by size. Without the far rocks
      // genuinely receding, a swarm reads as a heap of pebbles on a table.
      tone: 0.30 + 0.95 * depth * (0.62 + 0.38 * pnHash(k, 4, 0, sd))
    });
  }
  rocks.sort((p, q) => p.depth - q.depth);                   // far first
  for (const rk of rocks) {
    const px = cx + rk.ox * R, py = cy + rk.oy * R, pr = rk.rr * R;
    const x0 = Math.max(0, Math.floor(px - pr * 1.4)), x1 = Math.min(S - 1, Math.ceil(px + pr * 1.4));
    const y0 = Math.max(0, Math.floor(py - pr * 1.4)), y1 = Math.min(S - 1, Math.ceil(py + pr * 1.4));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = (x - px) / pr, dy = (y - py) / pr;
        const d = Math.hypot(dx, dy);
        if (d > 1.45) continue;
        // the outline is a closed loop through the noise, so it wobbles without
        // a seam where it comes back round to itself
        const wob = 0.74 + 0.46 * pnVal(dx / (d || 1) * 2.2, dy / (d || 1) * 2.2, 3.7, rk.seed);
        const u = d / wob;
        if (u > 1) continue;
        const nz = Math.sqrt(Math.max(0, 1 - u * u));
        const nx = dx / wob, ny = dy / wob;
        // pits and mottling, and a normal tipped by the same field so the pits
        // are lit rather than painted
        const g0 = pnFbm(nx * 5, ny * 5, nz * 5, rk.seed, 3, 2, 0.5);
        const gx = pnFbm(nx * 5 + 0.35, ny * 5, nz * 5, rk.seed, 3, 2, 0.5) - g0;
        const gy = pnFbm(nx * 5, ny * 5 + 0.35, nz * 5, rk.seed, 3, 2, 0.5) - g0;
        let bx = nx - gx * H.rockBump, by = ny - gy * H.rockBump, bz = nz;
        const bn = Math.hypot(bx, by, bz) || 1; bx /= bn; by /= bn; bz /= bn;
        const lit = Math.pow(Math.max(0, bx * lx + by * ly + bz * lz), H.litP);
        const alb = (0.7 + 0.6 * g0) * rk.tone;
        const i4 = (y * S + x) * 4;
        const f = lit * alb, a2 = H.amb * alb * 0.5;
        D[i4]     = Math.min(255, z0 * f + e0 * a2);
        D[i4 + 1] = Math.min(255, z1 * f + e1 * a2);
        D[i4 + 2] = Math.min(255, z2 * f + e2 * a2);
        D[i4 + 3] = 255;
      }
    }
  }
  c.putImageData(img, 0, 0);
  return { cv, S, R };
}
function buildPlanetSprite(R, V) {
  if (V.field) return buildFieldSprite(R, V);
  const shellPad = Math.max(3, Math.round(R * (V.emis ? 1.25 : 0.85)));
  // A ringed world needs a much wider canvas than its air shell does. Sizing the
  // canvas off the ring while the shell keeps its own falloff is what stops the
  // atmosphere smearing out to the ring's edge.
  const ringR = Array.isArray(V.ring) ? V.ring : null;
  const pad = ringR ? Math.max(shellPad, Math.round(R * (ringR[1] + 0.10))) : shellPad;
  const S = Math.ceil(R * 2 + pad * 2);
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const c = cv.getContext('2d');
  // Guarded: the headless test harness (and any stubbed 2D context) has no real
  // ImageData. Fall back to a gradient disc there rather than throwing — it will
  // never be seen, but drawFarGlow must not be able to take the frame down.
  const img = c && c.createImageData && c.createImageData(S, S);
  if (!img || !img.data) return null;
  const D = img.data;
  const cx = S / 2, cy = S / 2;
  // Every constant in this loop comes from PLANET_SHADE, so the destinations lab
  // can drive the shading model itself and not just the eight skins.
  const H = PLANET_SHADE;
  // the one world key light, pushed a little toward the viewer so the terminator
  // falls across the visible face rather than exactly on the limb
  let lx = Math.cos(LIGHT_A), ly = Math.sin(LIGHT_A), lz = H.lz;
  const ln = Math.hypot(lx, ly, lz); lx /= ln; ly /= ln; lz /= ln;
  // the spin axis, deliberately TILTED — see (3) above
  let [ax, ay, az] = H.tilt;
  const an = Math.hypot(ax, ay, az); ax /= an; ay /= an; az /= an;
  const padN = shellPad / R;
  const shellEdge2 = (1 + padN) * (1 + padN);
  const limb0 = 1 - H.limbK, h2b = 1 - H.h2m, h3b = 1 - H.h3m;
  const [am0, am1, am2] = H.ambTint;
  const [z0, z1, z2] = V.z, [e0, e1, e2] = V.belt, [t0, t1, t2] = V.atmo;
  // ---- THE RING ----
  // A ring lives in the planet's OWN equatorial plane, so it needs no tilt dials
  // of its own: the spin axis already says where that plane is. Every hard part
  // then falls out of one dot product. A screen pixel (dx, dy) is on the ring
  // plane at the depth that satisfies p·axis = 0, which gives both the true
  // ellipse — no fudged squash — and, from the sign of that depth, whether this
  // is the half passing IN FRONT of the planet or behind it.
  //
  // The two shadows are what sell it, and they are the same ray-plane test run
  // in opposite directions: the ring darkens the planet where the sunline
  // crosses the ring, and the planet darkens the ring where the ring sits inside
  // the sphere's shadow cylinder. Without them a ring is a decal.
  const ringOK = ringR && Math.abs(az) > 0.06;   // edge-on has nothing to draw
  const [ri, ro] = ringR || [0, 0];
  const [rc0, rc1, rc2] = V.ringC || [214, 198, 170];
  const ringLit = 0.30 + 0.70 * Math.abs(ax * lx + ay * ly + az * lz);
  // Opacity across the ring: broad bands and one wide division, plus fine
  // structure. Real rings are not a flat wash and the eye knows it.
  //
  // It depends on RADIUS ALONE, so it is baked into a table once instead of run
  // per pixel. That matters more here than anywhere else in this file: a ringed
  // world's canvas is four times the area of a plain one, and every pixel of it
  // asks this question twice — once for the ring, once for the ring's shadow.
  const RING_LUT_N = 1024;
  const ringLut = ringR ? new Float32Array(RING_LUT_N + 1) : null;
  if (ringLut) {
    const ringA = V.ringA != null ? V.ringA : 0.85;
    for (let i = 0; i <= RING_LUT_N; i++) {
      const u = i / RING_LUT_N;
      let a = 0.55 + 0.45 * pnVal(u * 9, 0.5, 0.5, 21) + 0.30 * pnVal(u * 31, 1.5, 1.5, 47);
      a *= 1 - 0.88 * Math.exp(-Math.pow((u - 0.62) / 0.045, 2));   // the wide division
      a *= 1 - 0.45 * Math.exp(-Math.pow((u - 0.30) / 0.030, 2));   // a narrow one
      a *= Math.min(1, u / 0.06) * Math.min(1, (1 - u) / 0.10);     // soft inner and outer edges
      ringLut[i] = clamp(a, 0, 1) * ringA;
    }
  }
  const ringSpan = ro - ri || 1;
  const ringProfile = (q) => {
    if (q < ri || q > ro) return 0;
    return ringLut[((q - ri) / ringSpan * RING_LUT_N) | 0];
  };
  // where a ring point sits inside the planet's shadow
  const ringShadow = (px, py, pz) => {
    const dl = px * lx + py * ly + pz * lz;
    if (dl > 0) return 1;                                          // sunward of the planet
    const ex = px - dl * lx, ey = py - dl * ly, ez = pz - dl * lz;
    return Math.hypot(ex, ey, ez) < 1 ? H.ringShadow : 1;
  };
  // where the ring shadows the planet
  const ringOnPlanet = (px, py, pz) => {
    if (!ringOK) return 1;
    const la2 = lx * ax + ly * ay + lz * az;
    if (Math.abs(la2) < 1e-4) return 1;
    const t = -(px * ax + py * ay + pz * az) / la2;
    if (t <= 0) return 1;                                          // the ring is behind us
    const qx = px + t * lx, qy = py + t * ly, qz = pz + t * lz;
    return 1 - ringProfile(Math.hypot(qx, qy, qz)) * (1 - H.ringShadow);
  };
  // ---- SOLID WORLDS: the height pass ----
  // Bands are all a gas giant is — weather in latitude, nothing beneath it. A
  // world with a surface needs the opposite, and it needs RELIEF: the reason a
  // crater reads as a hole and not a ring is that its far wall catches the sun
  // and its near wall does not. So terrain is built as an actual height field
  // first, and the colour loop lights it off that field's own gradient. Painting
  // shadows in instead is what made the first cut look like soap bubbles.
  //
  // Everything is sampled on the sphere's NORMAL, so it wraps with no seam and
  // does not pinch at the poles — and on a HALF-RESOLUTION grid, bilinearly
  // upsampled. Terrain is far lower-frequency than the pixel grid (the smallest
  // crater is still tens of pixels across), so the half-res field is visually
  // identical and costs a quarter as much. That matters: this sprite is built
  // mid-run, and the full-res version of this pass was a 170ms freeze.
  // A terrain model the shader does not recognise is NOT terrain. The lab can
  // put any value on this field, and an unknown one has to fall back to a plain
  // banded world — the alternative, which is what shipped first, was that a
  // dragged dial turned 'land' into 0.37, stayed truthy, missed all three colour
  // branches and left a gas giant wearing relief. Nothing here may be able to
  // destroy a world; the worst a dial can do is make it dull.
  const TERR_MODELS = ['land', 'rock', 'ice', 'lava', 'dune'];
  const terr = TERR_MODELS.indexOf(V.terr) >= 0 ? V.terr : null;
  // Every terrain dial is per-world, falling back to the shared model. That
  // fallback is the whole point: PLANET_SHADE moves all nine worlds together,
  // and an override on one world peels it away from the others.
  const dv = (k, g) => (typeof V[k] === 'number' ? V[k] : H[g]);
  const sea = dv('sea', 'seaLvl'), terrF = dv('terrF', 'terrF'), bump = dv('bump', 'bumpK');
  const aridK = dv('arid', 'aridK'), capLat = dv('cap', 'capLat'), cloudA = dv('cloud', 'cloudA');
  const cratF = dv('cratF', 'cratF'), cratD = dv('cratD', 'cratD');
  const lavaLvl = dv('lavaLvl', 'lavaLvl'), lavaK = dv('lavaK', 'lavaK');
  let HB = null, CB = null, GX = null, GY = null, KB = null, HW = 0;
  if (terr) {
    HW = Math.ceil(S / 2) + 1;
    HB = new Float32Array(HW * HW); CB = new Float32Array(HW * HW);
    GX = new Float32Array(HW * HW); GY = new Float32Array(HW * HW); KB = new Float32Array(HW * HW);
    const F = terrF, isLand = terr === 'land', isRock = terr === 'rock';
    const isLava = terr === 'lava', isDune = terr === 'dune';
    const mtn = dv('mtn', 'mtnK'), sd = V.seed | 0;
    const edge2 = Math.pow(1 + 6 / R, 2);
    for (let v = 0; v < HW; v++) {
      for (let u = 0; u < HW; u++) {
        let dx = (u * 2 - cx) / R, dy = (v * 2 - cy) / R;
        let d2 = dx * dx + dy * dy;
        // The disc is a small part of this canvas — most of it is the padding
        // the atmosphere shell needs. Only the disc and one sample of margin
        // are worth any noise at all.
        if (d2 > edge2) continue;
        // Samples that fall off the disc are pulled back onto the limb rather
        // than left at zero, so the gradient at the edge stays honest.
        if (d2 > 0.9998) { const k = Math.sqrt(0.9998 / d2); dx *= k; dy *= k; d2 = 0.9998; }
        const nz = Math.sqrt(1 - d2), i = v * HW + u;
        const cont = pnFbm(dx * F, dy * F, nz * F, sd, H.terrOct, H.terrLac, H.terrGain);
        CB[i] = cont;
        let h = cont;
        if (isLand) {
          // Ranges rise ON the continents and die at the coast — squaring the
          // altitude term is what keeps mountains off the beaches.
          const alt = clamp((cont - sea) / (1 - sea), 0, 1);
          h = cont + pnRidge(dx * F * 2.1, dy * F * 2.1, nz * F * 2.1, sd + 7, 3, H.terrLac, H.terrGain) * alt * alt * mtn;
          KB[i] = pnFbm(dx * H.cloudF, dy * H.cloudF, nz * H.cloudF, sd + 313, 3, H.terrLac, H.terrGain);
        } else if (isRock) {
          const t = pnCrater(dx, dy, nz, sd + 91, cratF);
          const bowl = t < 1 ? -cratD * (1 - t * t) : 0;                    // the floor
          const rim = H.cratRim * Math.exp(-Math.pow((t - 1) / 0.30, 2));   // the raised lip
          h = cont * 0.35 + 0.4 + bowl + rim;
        } else if (isLava) {
          // The crests of a ridged field form a CONNECTED NETWORK, which is what
          // a fissure system is: plates of cooled crust with the melt showing
          // between them. It has to be ONE OCTAVE — stacking octaves the way the
          // mountains do breaks the crest into dots, and thresholding dots gives
          // speckle rather than cracks. Two scales of single-octave ridge, taken
          // at their maximum, give a main rift system with finer branches off it.
          const f1 = pnRidge(dx * H.lavaF, dy * H.lavaF, nz * H.lavaF, sd + 151, 1, 1, 1);
          const f2 = pnRidge(dx * H.lavaF * 2.7, dy * H.lavaF * 2.7, nz * H.lavaF * 2.7, sd + 199, 1, 1, 1);
          const fis = Math.max(f1, f2 * H.lavaBranch);
          KB[i] = fis;
          h = cont * 0.62 - fis * 0.38;                                     // the melt sits LOW
        } else if (isDune) {
          // Dunes are anisotropic: wind carves them long across and sharp along.
          // Squashing one axis of the sample point before the ridge is the whole
          // trick, and it is why this does not read as generic noise.
          h = cont * 0.45 + pnRidge(dx * H.duneF, dy * H.duneF * H.duneA, nz * H.duneF, sd + 5, 3, H.terrLac, H.terrGain) * 0.55;
        } else {
          h = cont * 0.5 + pnRidge(dx * F * 2.6, dy * F * 2.6, nz * F * 2.6, sd + 7, 3, H.terrLac, H.terrGain) * 0.5;
        }
        HB[i] = h;
      }
    }
    // central differences, per full-res pixel (one grid step spans two pixels)
    for (let v = 0; v < HW; v++) {
      for (let u = 0; u < HW; u++) {
        const i = v * HW + u;
        const l = u > 0 ? HB[i - 1] : HB[i], r2 = u < HW - 1 ? HB[i + 1] : HB[i];
        const t = v > 0 ? HB[i - HW] : HB[i], b = v < HW - 1 ? HB[i + HW] : HB[i];
        GX[i] = (r2 - l) * 0.25; GY[i] = (b - t) * 0.25;
      }
    }
  }
  // Bilinear lookup into the half-res fields. The cell and the two fractions are
  // set once per pixel and held here rather than passed in, so reading five
  // fields is five multiply-adds and not five closure setups — this runs on
  // every pixel of the disc and it showed.
  let bi = 0, bax = 0, bay = 0;
  const bl = (A) => {
    const a = A[bi] + (A[bi + 1] - A[bi]) * bax;
    const b = A[bi + HW] + (A[bi + HW + 1] - A[bi + HW]) * bax;
    return a + (b - a) * bay;
  };
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const dx = (x - cx) / R, dy = (y - cy) / R;
      const d2 = dx * dx + dy * dy;
      const i4 = (y * S + x) * 4;
      // the ring, resolved before the body so the near half can cover it
      let rA = 0, rNear = false, rq = 0;
      if (ringOK) {
        const pz = -(dx * ax + dy * ay) / az;
        rq = Math.hypot(dx, dy, pz);
        rA = ringProfile(rq);
        if (rA > 0) { rNear = pz > 0; rA *= ringLit * ringShadow(dx, dy, pz); }
      }
      if (d2 <= 1) {
        const nz = Math.sqrt(1 - d2);
        const limb = limb0 + H.limbK * nz;                    // (2)
        const lat = dx * ax + dy * ay + nz * az;              // (3)
        const b1 = 0.5 + 0.5 * Math.sin(lat * V.bf);
        const b2 = 0.5 + 0.5 * Math.sin(lat * V.bf * H.h2 + H.h2p);
        const b3 = 0.5 + 0.5 * Math.sin(lat * V.bf * H.h3 + H.h3p);
        const band = clamp((b1 * (h2b + H.h2m * b2) * (h3b + H.h3m * b3)) * V.ba, 0, 1);
        let rr = z0 + (e0 - z0) * band, gg = z1 + (e1 - z1) * band, bb = z2 + (e2 - z2) * band;
        // relief: the height field's gradient bends the normal, and the light
        // does the rest. Damped near the limb, where the sphere foreshortens and
        // the screen-space slope would otherwise blow up.
        let nx = dx, ny = dy, nzz = nz, spec = 0, emit = 0;
        if (terr) {
          const fx = x * 0.5, fy = y * 0.5, hu = fx | 0, hv = fy | 0;
          bax = fx - hu; bay = fy - hv; bi = hv * HW + hu;
          const h = bl(HB), cont = bl(CB), gx = bl(GX), gy = bl(GY);
          const damp = bump * R * nz * nz;
          // tangent frame on the sphere, taken from the screen axes
          const bx = 1 - dx * dx, by = -dx * dy, bz = -dx * nz;
          const tx = -dy * dx, ty = 1 - dy * dy, tz = -dy * nz;
          nx -= damp * (gx * bx + gy * tx); ny -= damp * (gx * by + gy * ty); nzz -= damp * (gx * bz + gy * tz);
          const nn = Math.hypot(nx, ny, nzz) || 1; nx /= nn; ny /= nn; nzz /= nn;

          // the cap edge is pushed around by the terrain under it, because a
          // cap that ends on a perfect circle of latitude reads as painted on
          const capT = clamp((Math.abs(lat) - (capLat + (cont - 0.5) * H.capJit)) / H.capW, 0, 1);
          if (terr === 'land') {
            if (cont < sea) {
              // Water. Depth darkens it, and it is the only surface here that
              // glints — a specular lobe is what separates an ocean from a
              // blue-painted rock at a glance.
              const dep = clamp((sea - cont) / sea, 0, 1);
              const sh = 1 - clamp((sea - cont) / H.shoreW, 0, 1);          // shallows at the coast
              rr = e0 * (0.62 + 0.38 * (1 - dep)) + 70 * sh;
              gg = e1 * (0.66 + 0.34 * (1 - dep)) + 60 * sh;
              bb = e2 * (0.78 + 0.22 * (1 - dep)) + 30 * sh;
              spec = H.seaSpec;
            } else {
              // lowland -> highland -> bare rock -> snow, with the snowline
              // walking down toward the poles the way a real one does
              const t = clamp((h - sea) / (1 - sea), 0, 1);
              const arid = clamp((0.42 - Math.abs(lat)) / 0.30, 0, 1) * aridK;    // equatorial deserts
              const rock = clamp((h - H.mtnLvl) / Math.max(0.001, H.snowLvl - H.mtnLvl), 0, 1);
              const snow = clamp((h - (H.snowLvl - Math.abs(lat) * H.snowLat)) / 0.10, 0, 1);
              rr = z0 * (0.80 + 0.34 * t); gg = z1 * (0.80 + 0.34 * t); bb = z2 * (0.80 + 0.26 * t);
              rr += (206 - rr) * arid; gg += (176 - gg) * arid; bb += (122 - bb) * arid;
              rr += (152 - rr) * rock * 0.75; gg += (142 - gg) * rock * 0.75; bb += (132 - bb) * rock * 0.75;
              rr += (250 - rr) * snow; gg += (252 - gg) * snow; bb += (255 - bb) * snow;
            }
            // cloud deck, on its own field and its own scale, banded a little
            // by latitude so it does not read as evenly-spread fog
            const cl = bl(KB) * (0.80 + 0.20 * Math.abs(Math.sin(lat * 5.5)));
            const ca = clamp((cl - H.cloudLvl) / 0.15, 0, 1) * cloudA;
            rr += (255 - rr) * ca; gg += (255 - gg) * ca; bb += (255 - bb) * ca;
            if (ca > 0.22) spec = 0;                                          // cloud kills the glint
          } else if (terr === 'rock') {
            const m = 0.80 + 0.36 * cont;                                     // regolith mottling only —
            rr = z0 * m; gg = z1 * m; bb = z2 * m;                            // the craters are lit, not painted
          } else if (terr === 'lava') {
            // Cooled basalt with melt in the fissures. Three things keep this off
            // the jack-o'-lantern it first was: the melt is a THIN line, not a
            // blob (a wide bright band is what reads as painted-on); the ground
            // either side is HEATED, a dull red gradient that does the work of
            // making the crack look deep; and `emit` makes the melt an actual
            // light source, so it survives the terminator the way real lava does.
            const fis = bl(KB);
            const hot = clamp((fis - lavaLvl) / H.lavaW, 0, 1);                // the melt itself
            const warm = clamp((fis - (lavaLvl - H.lavaHalo)) / H.lavaHalo, 0, 1); // cooling ground
            const cr = 0.68 + 0.56 * cont;                                     // crust mottling
            rr = z0 * cr; gg = z1 * cr; bb = z2 * cr;
            const w3 = warm * warm * warm;
            rr += (e0 * 0.42 - rr) * w3; gg += (e1 * 0.22 - gg) * w3; bb += (e2 * 0.16 - bb) * w3;
            rr += (e0 - rr) * hot; gg += (e1 - gg) * hot; bb += (e2 - bb) * hot;
            emit = hot * hot * lavaK + w3 * lavaK * 0.10;
          } else if (terr === 'dune') {
            // sand reddens in the troughs where it is deep, pales on the crests
            const t = clamp((h - 0.35) / 0.45, 0, 1);
            rr = e0 + (z0 - e0) * t; gg = e1 + (z1 - e1) * t; bb = e2 + (z2 - e2) * t;
          } else if (terr === 'ice') {
            const rift = clamp((0.46 - h) / 0.10, 0, 1);
            rr = z0 * (1 - rift * 0.45) + e0 * rift * 0.45;
            gg = z1 * (1 - rift * 0.40) + e1 * rift * 0.40;
            bb = z2 * (1 - rift * 0.30) + e2 * rift * 0.30;
          }
          if (capT > 0 && terr !== 'rock' && terr !== 'lava' && terr !== 'dune') {  // polar caps, last
            rr += (250 - rr) * capT; gg += (252 - gg) * capT; bb += (255 - bb) * capT;
            spec *= 1 - capT;
          }
          // The bands are not thrown away on a solid world — they come back as a
          // CLIMATE tint. Latitude striping is as real on a world with a surface
          // as on one without, and it keeps `bf` and `ba` meaningful on all nine
          // rather than leaving two dials dead on six of them.
          const bk = 1 + (band - 0.5) * V.ba;
          rr *= bk; gg *= bk; bb *= bk;
        }
        // a star has no night side — it makes its own light
        const ndl = Math.max(0, nx * lx + ny * ly + nzz * lz);
        const lit = (V.emis ? (H.emisBase + (1 - H.emisBase) * nz)
          : Math.pow(ndl, H.litP) * limb) * ringOnPlanet(dx, dy, nz);
        const amb = V.emis ? 0 : H.amb;
        // the sea catches the sun near the sub-solar point; nothing else does
        const sp = spec > 0 ? Math.pow(ndl, H.seaSpecP) * spec * 255 : 0;
        D[i4]     = Math.min(255, rr * lit + am0 * amb + sp);
        D[i4 + 1] = Math.min(255, gg * lit + am1 * amb + sp);
        D[i4 + 2] = Math.min(255, bb * lit + am2 * amb + sp * 0.92);
        D[i4 + 3] = 255;
        if (emit > 0) {   // lava is lit by itself, so it outlives the terminator
          D[i4] = Math.min(255, D[i4] + emit * (e0 / 255) * 255);
          D[i4 + 1] = Math.min(255, D[i4 + 1] + emit * (e1 / 255) * 210);
          D[i4 + 2] = Math.min(255, D[i4 + 2] + emit * (e2 / 255) * 150);
        }
        // molten belts and stars emit regardless of the light
        if (V.glow) {
          const em = band * band * H.glowK;
          D[i4] = Math.min(255, D[i4] + em); D[i4 + 1] = Math.min(255, D[i4 + 1] + em * 0.42); D[i4 + 2] = Math.min(255, D[i4 + 2] + em * 0.12);
        }
        // atmosphere piling up on the limb, brightest where the surface turns away
        const ndl2 = V.emis ? 1 : Math.max(0, dx * lx + dy * ly + nz * lz);
        const rim = Math.pow(1 - nz, H.rimP) * ndl2 * H.rimK * V.ak;
        if (rim > 1) {
          D[i4]     = Math.min(255, D[i4] + rim * (t0 / 255));
          D[i4 + 1] = Math.min(255, D[i4 + 1] + rim * (t1 / 255));
          D[i4 + 2] = Math.min(255, D[i4 + 2] + rim * (t2 / 255));
        }
        // only the half of the ring passing in FRONT survives over the body
        if (rA > 0 && rNear) {
          D[i4]     = D[i4] + (rc0 - D[i4]) * rA;
          D[i4 + 1] = D[i4 + 1] + (rc1 - D[i4 + 1]) * rA;
          D[i4 + 2] = D[i4 + 2] + (rc2 - D[i4 + 2]) * rA;
        }
      } else {
        // Nothing here and nothing coming — leave before the square root. On a
        // ringed world most of the canvas is exactly this, and the sqrt/exp pair
        // below is the single most-run pair of operations in the build.
        if (rA <= 0 && d2 > shellEdge2) { D[i4 + 3] = 0; continue; }
        // the atmosphere shell outside the disc — only where the sun reaches it
        const d = Math.sqrt(d2);
        const t = (d - 1) / padN;
        const fall = t >= 1 ? 0 : Math.exp(-t * (V.emis ? H.shellFallEmis : H.shellFall)) * (1 - t);
        const side = V.emis ? 1 : Math.max(0, (dx * lx + dy * ly) / d);
        const sa = fall <= 0 ? 0
          : Math.max(0, Math.min(255, fall * (H.shellSide + (1 - H.shellSide) * side) * H.shellA * V.ak));
        if (rA <= 0) {
          if (sa <= 0) { D[i4 + 3] = 0; continue; }
          D[i4] = t0; D[i4 + 1] = t1; D[i4 + 2] = t2; D[i4 + 3] = sa;
          continue;
        }
        // Ring over air shell, both partly transparent — so they composite
        // properly rather than one winning. Either half of the ring shows out
        // here; it is only over the body that the far half has to be dropped.
        const sk = sa / 255, ra = rA + sk * (1 - rA);
        const mix = ra > 0 ? rA / ra : 0;
        D[i4]     = t0 + (rc0 - t0) * mix;
        D[i4 + 1] = t1 + (rc1 - t1) * mix;
        D[i4 + 2] = t2 + (rc2 - t2) * mix;
        D[i4 + 3] = Math.min(255, ra * 255);
      }
    }
  }
  c.putImageData(img, 0, 0);
  return { cv, S, R };
}
// <<< DEST-SPRITE
function drawFarGlow(far, vr, g) {
  // 1x at departure, 4x at arrival. laneProgress() is LATCHED and monotonic, so
  // the world never shrinks mid-run and never snaps back when the level ends —
  // it holds its arrival size for whatever the end sequence wants to do with it.
  const grow = 1 + laneProgress() * 3;
  // ARRIVAL. A campaign win IS reaching the destination, so the ceremony finishes
  // the journey for real: the world closes the last of the distance and swells to
  // meet the ring, and the mission report lands on top of it. Losses, endless and
  // qualification never arrive — their world holds at whatever approach it made.
  const arriving = state === S.END && endWin && !endless && !qual;
  let arrive = 0;
  if (arriving) {
    const q = clamp((endT - 0.55) / 2.3, 0, 1); // rides in with the clear-sweep
    arrive = 1 - Math.pow(1 - q, 3);            // fast closing, gentle settle
  }
  const R = Math.max(2, vr * 0.075 * grow) * (1 - arrive) + g.nodeR * 0.52 * arrive;
  const V = planetVariant();
  const breath = 0.5 + 0.5 * Math.sin(time * 0.7);

  // --- the haze shell: what replaced the light rays ---
  const hz = ctx.createRadialGradient(far.x, far.y, R * 0.8, far.x, far.y, R * 4.6);
  hz.addColorStop(0, `rgba(${V.atmo},${(0.075 + 0.02 * breath).toFixed(4)})`);
  hz.addColorStop(0.35, `rgba(${V.atmo},${(0.034 + 0.012 * breath).toFixed(4)})`);
  hz.addColorStop(1, `rgba(${V.atmo},0)`);
  ctx.fillStyle = hz;
  ctx.beginPath(); ctx.arc(far.x, far.y, R * 4.6, 0, TAU); ctx.fill();

  // --- the body ---
  // Stations and gates are machined objects, so they are DRAWN rather than shaded
  // per pixel — and by the same two functions the chart uses, so the thing at the
  // end of the bore is the thing the map promised, only larger.
  const kind = destKindFor((typeof CAMP !== 'undefined' && CAMP && CAMP.id) || 'x',
    levelIdx, !!(LV && LV.boss));
  if (kind === 'station' || kind === 'gate') {
    const laS = destLightA();
    drawDestLife(far, R, g, false, laS); // whatever is round the back, first
    ctx.save();
    ctx.globalAlpha = 0.92;
    const rs = ringSpriteFor(kind, kind === 'station'
      ? stationCoreFor((typeof CAMP !== 'undefined' && CAMP && CAMP.id) || 'x', levelIdx)
      : null);
    if (rs) {
      const w = rs.S * (R * (kind === 'gate' ? 1.25 : 1.15) / rs.R);
      ctx.drawImage(rs.cv, far.x - w / 2, far.y - w / 2, w, w);
    } else {
      drawRingBody(far.x, far.y, R * (kind === 'gate' ? 1.25 : 1.15), kind);
    }
    ctx.restore();
    drawDestLife(far, R, g, true, laS);
    if (1 - arrive > 0.02) drawFarMotes(far, R, grow, breath, 1 - arrive);
    return;
  }
  // A planet is one sprite, scaled continuously — no rebuild while it grows. The
  // one exception is arrival: the approach sprite upscaled 2x+ goes soft, so the
  // first ceremony frame rebuilds it at double resolution — a single hitch, masked
  // by the victory flash, instead of a blurry close-up for the whole report.
  const spriteKey = V.n + (arriving ? '@hi' : '');
  if (planetSpriteKey !== spriteKey) {
    planetSprite = buildPlanetSprite(arriving ? PLANET_REF_R * 2 : PLANET_REF_R, V);
    planetSpriteKey = spriteKey;
  }
  const la = V.emis ? LIGHT_A : destLightA(); // a star has no terminator to creep
  // A swarm has no surface, so nothing that lives ON a world belongs on it — no
  // cities, no aurora, no creeping terminator across a single face, and no moon
  // in orbit around a cloud of rubble. Each rock in buildFieldSprite carries its
  // own terminator already.
  const swarm = !!V.field;
  if (!swarm) drawDestLife(far, R, g, false, la);   // far half of every orbit, occluded by the body
  if (planetSprite) {
    const w = planetSprite.S * (R / planetSprite.R);
    ctx.drawImage(planetSprite.cv, far.x - w / 2, far.y - w / 2, w, w);
  } else {
    // no-ImageData fallback: a lit disc, offset toward the key light
    ctx.save();
    ctx.beginPath(); ctx.arc(far.x, far.y, R, 0, TAU); ctx.clip();
    ctx.fillStyle = 'rgba(9,14,26,0.95)';
    ctx.fillRect(far.x - R, far.y - R, R * 2, R * 2);
    const bg2 = ctx.createRadialGradient(
      far.x + Math.cos(LIGHT_A) * R * 0.62, far.y + Math.sin(LIGHT_A) * R * 0.62, R * 0.05,
      far.x, far.y, R * 1.45);
    bg2.addColorStop(0, `rgba(${V.z},0.75)`);
    bg2.addColorStop(1, 'rgba(14,22,44,0)');
    ctx.fillStyle = bg2;
    ctx.fillRect(far.x - R, far.y - R, R * 2, R * 2);
    ctx.restore();
  }
  // the sun creeps across the face — the shadow goes ON the body, then everything
  // that lives here goes over the top, lit by that same drifted vector
  if (!V.emis && !swarm) drawTerminatorCreep(far, R, clamp((R / g.nodeR - DEST_LIFE.vis0) / DEST_LIFE.vis1, 0, 1), la);
  if (!swarm) drawDestLife(far, R, g, true, la);
  // --- glowing grain in the haze: the atmosphere lit from within ---
  drawFarMotes(far, R, grow, breath, 1 - arrive);
}
// Stateless — each mote is a fixed phase read against the shared clock — so it
// behaves identically in menus, replays and pauses without touching the sim.
//
// FADES OUT ON ARRIVAL (moteK). At approach distance this is grain boiling at the
// limb of a speck; at arrival the same motes are big rings sailing off a body that
// now fills the bore, and they read as debris orbiting the planet. The atmosphere
// is sold by the sprite's own limb at that range — the grain is not needed.
//
// Extracted so the station and gate destinations can share it: they get the same
// dust in their haze as a world does, without duplicating the loop.
function drawFarMotes(far, R, grow, breath, moteK) {
  if (moteK <= 0.02) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const m of farMotes) {
    const k = ((time * m.sp + m.ph) % 1 + 1) % 1;
    const puff = Math.sin(k * Math.PI);              // fades in and out, never pops
    const al = puff * 0.13 * (0.6 + 0.4 * breath) * moteK;
    if (al < 0.008) continue;
    const rr = R * (m.rr + k * 0.9);
    const mx = far.x + Math.cos(m.a) * rr, my = far.y + Math.sin(m.a) * rr * 0.92;
    ctx.fillStyle = m.warm ? `rgba(255,214,170,${al.toFixed(3)})` : `rgba(190,220,255,${al.toFixed(3)})`;
    ctx.beginPath(); ctx.arc(mx, my, Math.max(0.35, m.sz * (0.5 + grow * 0.35)), 0, TAU); ctx.fill();
  }
  ctx.restore();
}
