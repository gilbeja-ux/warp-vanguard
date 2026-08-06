'use strict';
// ---------- enemy bodies: GLITCH, painted ON the wall ----------
// decals live in (angle x depth) space and project as annular arcs around the
// tunnel axis, so they foreshorten with the bore — genuinely attached to the
// wall, not billboards hovering in it.
function wallPatch(g, a, halfA, z0, z1, col, alpha) {
  const r0 = ring(Math.max(Math.min(z0, z1), 0.02), g).r; // nearer edge (bigger radius)
  const r1 = ring(Math.max(Math.max(z0, z1), 0.02), g).r;
  const rm = (r0 + r1) / 2;
  if (rm < 3) return;
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = col;
  ctx.lineCap = 'butt';
  ctx.lineWidth = Math.max(0.7, r0 - r1);
  ctx.beginPath(); ctx.arc(g.cx, g.cy, rm, a - halfA, a + halfA); ctx.stroke();
}
function drawNailBreach(en, g, fade, PAL) {
  const rg = ring(Math.max(en.z, 0.02), g);
  const x = rg.x + Math.cos(en.angle) * rg.r, y = rg.y + Math.sin(en.angle) * rg.r;
  const wallW = clamp(rg.r / g.nodeR, 0.06, 2);
  const mul = en.sizeMul || 1;
  const S = Math.min(W, H) * 0.05 * wallW * mul * ENEMYFX.size; // nail scale, wall-foreshortened
  // STATIC per-body seed — the old en.spin-based seed drifted every frame,
  // strobing every seed-phased effect. Derived from spawn angle, no RNG draw
  // (spawnRng order is gameplay-deterministic and must not shift).
  if (en.fxSeed === undefined) { en.fxSeed = (en.angle * 39.7) % 10; en.fxPh = 0; en.fxT = time; }
  const seed = en.fxSeed;
  const lockKind = en.lock !== undefined, heavy = en.type === 'heavy';
  // into-the-bore direction (toward the axis) and the wall tangent
  const ux = (g.cx - x) / (rg.r || 1), uy = (g.cy - y) / (rg.r || 1);
  const tx2 = -uy, ty2 = ux;
  const tanA = Math.atan2(ty2, tx2);
  const urg = urgency(en, g); // 0→1 over the last ~1.5s — everything below leans on it
  const SQ = ENEMYFX.squash;
  // urgency effect clock, ACCUMULATED per enemy: rates may only scale the
  // increment, never multiply raw `time` — time*(k+urg) leaps whole cycles
  // the instant urg ramps, strobing packets/rings into visual noise
  const dtF = clamp(time - en.fxT, 0, 0.1); en.fxT = time;
  en.fxPh += dtF * (1 + urg * 1.2);
  const uph = en.fxPh;

  // exfil beam: on the far side of the wall, the tap transmits its haul OUT
  // to the outside world — a type-colored cone rising away from the bore,
  // wide at the plate and CONVERGING as it recedes (perspective), dissolving
  // into the dark. Additive light, not hardware.
  if (ENEMYFX.mBeamI > 0.02) {
    const BL = S * 2.4 * ENEMYFX.mBeamL;
    const fl2 = 0.8 + 0.2 * Math.sin(time * 6.5 + seed * 2);
    const w0b = S * 0.55, w1b = S * 0.06;
    const ex2 = x - ux * BL, ey2 = y - uy * BL;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const [wm2, am] of [[1.6, 0.09], [1.0, 0.20], [0.45, 0.34]]) {
      const bg3 = ctx.createLinearGradient(x, y, ex2, ey2);
      bg3.addColorStop(0, `rgba(${PAL.glow},${(am * ENEMYFX.mBeamI * fl2 * fade).toFixed(3)})`);
      bg3.addColorStop(0.3, `rgba(${PAL.glow},${(am * 0.55 * ENEMYFX.mBeamI * fl2 * fade).toFixed(3)})`);
      bg3.addColorStop(1, `rgba(${PAL.glow},0)`);
      ctx.fillStyle = bg3;
      ctx.beginPath();
      ctx.moveTo(x + tx2 * w0b * wm2, y + ty2 * w0b * wm2);
      ctx.lineTo(ex2 + tx2 * w1b * wm2, ey2 + ty2 * w1b * wm2);
      ctx.lineTo(ex2 - tx2 * w1b * wm2, ey2 - ty2 * w1b * wm2);
      ctx.lineTo(x - tx2 * w0b * wm2, y - ty2 * w0b * wm2);
      ctx.closePath(); ctx.fill();
    }
    if (!lowFX) for (let i = 0; i < 2; i++) { // packets escaping, shrinking away
      const q = (time * 0.45 + i / 2 + seed * 0.2) % 1;
      const px3 = lerp(x, ex2, q), py3 = lerp(y, ey2, q);
      const pw = Math.max(1, lerp(w0b * 0.55, w1b * 1.6, q));
      const pa = (1 - q * 0.6) * Math.min(1, q * 4) * 0.30 * ENEMYFX.mBeamI * fade;
      const pg2 = ctx.createRadialGradient(px3, py3, 0, px3, py3, pw);
      pg2.addColorStop(0, `rgba(${PAL.glow},${pa.toFixed(3)})`);
      pg2.addColorStop(1, `rgba(${PAL.glow},0)`);
      ctx.fillStyle = pg2;
      ctx.beginPath(); ctx.arc(px3, py3, pw, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  // impact cracks in the wall around the puncture (locks are clean punches)
  if (!lockKind && wallW > 0.12 && ENEMYFX.mCrack > 0.05) {
    ctx.lineCap = 'round';
    for (let c = 0; c < (heavy ? 4 : 2); c++) {
      const h1 = Math.sin(seed * 7 + c * 5.13);
      const dirA = h1 > 0 ? 1 : -1;
      const flick = 0.5 + 0.4 * Math.sin(time * (4 + c) + seed + c * 2.1);
      ctx.strokeStyle = `rgba(${PAL.glow},${(fade * 0.45 * flick).toFixed(2)})`;
      ctx.lineWidth = Math.max(0.8, wallW * 1.8);
      ctx.beginPath();
      let a = en.angle + dirA * 0.02, z = en.z + Math.sin(seed * 11 + c * 3.7) * 0.02;
      let started = false;
      const steps = 2 + Math.round(ENEMYFX.mCrack);
      for (let sN = 0; sN <= steps; sN++) {
        const rr = ring(Math.max(z, 0.02), g).r;
        const px2 = g.cx + Math.cos(a) * rr, py2 = g.cy + Math.sin(a) * rr;
        started ? ctx.lineTo(px2, py2) : ctx.moveTo(px2, py2);
        started = true;
        a += dirA * (0.028 + 0.015 * Math.sin(seed * 3 + c * 7 + sN * 4.2)) * ENEMYFX.mCrack;
        z += 0.016 * Math.sin(seed * 5 + c * 9 + sN * 2.6) * ENEMYFX.mCrack;
      }
      ctx.stroke();
    }
  }

  // grounding — ONE soft radial pool squashed to the wall: near-black scorch
  // at the center melting into contact shadow, plus the tap's light pooling
  // into the surface. No hard-edged wall patches — nothing reads as a square.
  ctx.globalAlpha = fade;
  ctx.save();
  ctx.translate(x, y); ctx.rotate(tanA); ctx.scale(1, SQ);
  const sh2 = ctx.createRadialGradient(0, 0, 0, 0, 0, S * 1.7);
  sh2.addColorStop(0, 'rgba(1,2,8,0.8)');
  sh2.addColorStop(0.4, 'rgba(0,2,8,0.35)');
  sh2.addColorStop(1, 'rgba(0,2,8,0)');
  ctx.fillStyle = sh2;
  ctx.beginPath(); ctx.arc(0, 0, S * 1.7, 0, TAU); ctx.fill();
  ctx.globalCompositeOperation = 'lighter';
  const bl3 = ctx.createRadialGradient(0, 0, 0, 0, 0, S * 2.3);
  bl3.addColorStop(0, `rgba(${PAL.glow},${(fade * 0.16).toFixed(3)})`);
  bl3.addColorStop(0.5, `rgba(${PAL.glow},${(fade * 0.07).toFixed(3)})`);
  bl3.addColorStop(1, `rgba(${PAL.glow},0)`);
  ctx.fillStyle = bl3;
  ctx.beginPath(); ctx.arc(0, 0, S * 2.3, 0, TAU); ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  ctx.restore();

  // breach ripple: a wave train expanding ACROSS the wall — each ring is a
  // loop in (angle x radius) space, so its long edges bow along the tunnel's
  // hoops instead of cutting straight through them
  const wallRing = P => {
    ctx.beginPath();
    const N = 22;
    for (let i = 0; i <= N; i++) {
      const t = i / N * TAU;
      const a = en.angle + Math.cos(t) * P / rg.r;
      const rt = rg.r + Math.sin(t) * P * SQ;
      const px2 = g.cx + Math.cos(a) * rt, py2 = g.cy + Math.sin(a) * rt;
      i ? ctx.lineTo(px2, py2) : ctx.moveTo(px2, py2);
    }
  };
  if (!en.arch) for (const ph of [0, 0.5]) { // guide specimens sit calm — no wave train
    const rip = (uph * 0.8 + seed + ph) % 1;
    ctx.strokeStyle = `rgba(${PAL.glow},${(fade * (0.5 + urg * 0.3) * (1 - rip) * (ph ? 0.5 : 1)).toFixed(2)})`;
    ctx.lineWidth = Math.max(1, S * 0.1 * (1 - rip * 0.5));
    wallRing(S * (0.7 + rip * 1.8));
    ctx.stroke();
  }

  // hex port plate — machined gunmetal shaded off the world key light,
  // chamfered bevel, seam glow at the joint, breathing vent slots
  const hexR = S * 0.72;
  const lightLocal = LIGHT_A - tanA;           // key light rotated into plate space
  const key = 0.35 + 0.65 * Math.pow(0.5 + 0.5 * Math.cos(en.angle - LIGHT_A), 2);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tanA);
  ctx.scale(1, SQ); // squash to the wall's local foreshortening
  const hexPath = r => {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const ha = i / 6 * TAU + Math.PI / 6;
      i ? ctx.lineTo(Math.cos(ha) * r, Math.sin(ha) * r) : ctx.moveTo(Math.cos(ha) * r, Math.sin(ha) * r);
    }
    ctx.closePath();
  };
  const lx = Math.cos(lightLocal) * hexR, ly = Math.sin(lightLocal) * hexR;
  const plate = ctx.createLinearGradient(lx, ly, -lx, -ly);
  plate.addColorStop(0, enGun(30 + 30 * key));
  plate.addColorStop(0.5, enGun(16 + 12 * key));
  plate.addColorStop(1, enGun(9));
  hexPath(hexR);
  ctx.globalAlpha = fade * 0.92;
  ctx.fillStyle = plate; ctx.fill();
  ctx.globalAlpha = fade;
  // chamfered bevel: lit hairline + inner shadow step
  hexPath(hexR * 0.99);
  ctx.strokeStyle = `rgba(225,235,255,${(0.10 + 0.25 * key).toFixed(2)})`;
  ctx.lineWidth = Math.max(0.7, S * 0.035); ctx.stroke();
  hexPath(hexR * 0.84);
  ctx.strokeStyle = 'rgba(0,0,0,0.45)';
  ctx.lineWidth = Math.max(0.7, S * 0.05); ctx.stroke();
  // seam glow: the tap's energy leaking at the machined joint
  if (ENEMYFX.mSeam > 0.02) {
    hexPath(hexR * 0.92);
    ctx.strokeStyle = `rgba(${PAL.glow},${(ENEMYFX.mSeam * (0.35 + 0.3 * Math.sin(time * 3 + seed))).toFixed(2)})`;
    ctx.lineWidth = Math.max(0.8, S * 0.05); ctx.stroke();
    for (let i = 0; i < 3; i++) { // vent slots, breathing with the siphon
      const va = i / 3 * TAU + Math.PI / 2;
      const vk = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(time * 4 + i * 2.1 + seed));
      ctx.strokeStyle = `rgba(${PAL.glow},${(ENEMYFX.mSeam * vk * 0.8).toFixed(2)})`;
      ctx.lineWidth = Math.max(0.8, S * 0.045);
      ctx.beginPath();
      ctx.moveTo(Math.cos(va) * hexR * 0.3, Math.sin(va) * hexR * 0.3);
      ctx.lineTo(Math.cos(va) * hexR * 0.58, Math.sin(va) * hexR * 0.58);
      ctx.stroke();
    }
  }
  if (lockKind || heavy) { // outer machined ring on keyed/armored taps
    hexPath(hexR * 1.32);
    ctx.strokeStyle = PAL.lights[0];
    ctx.lineWidth = Math.max(0.7, S * 0.05);
    ctx.globalAlpha = fade * (0.5 + 0.3 * Math.sin(time * 4 + seed));
    ctx.stroke();
    ctx.globalAlpha = fade;
  }
  ctx.restore();

  // the wall's own hoops run OVER the plate's edges — the hardware sits IN the
  // surface, and the surface keeps going
  ctx.globalAlpha = fade * 0.3;
  ctx.strokeStyle = 'rgba(120,200,255,0.9)';
  ctx.lineWidth = Math.max(0.6, wallW * 1.2);
  for (const dz2 of [-0.028, 0.028]) {
    const rr3 = ring(Math.max(en.z + dz2 * mul, 0.02), g).r;
    ctx.beginPath(); ctx.arc(g.cx, g.cy, rr3, en.angle - 0.045 * mul, en.angle + 0.045 * mul); ctx.stroke();
  }
  ctx.globalAlpha = fade;

  // where the auger enters the plate: NO ring hardware — just a soft dark
  // seam squeezed out at the SIDES of the shaft; the drill hides it in front
  const L2 = S * (heavy ? 1.35 : 1.0) * ENEMYFX.mDrill;
  const nw = S * 0.15;
  const tipX = x + ux * L2, tipY = y + uy * L2;
  ctx.save();
  ctx.translate(x, y); ctx.rotate(tanA); ctx.scale(1, SQ * 0.55);
  const sg3 = ctx.createRadialGradient(0, 0, 0, 0, 0, S * 0.22);
  sg3.addColorStop(0, 'rgba(2,4,10,0.85)');
  sg3.addColorStop(0.7, 'rgba(2,4,10,0.5)');
  sg3.addColorStop(1, 'rgba(2,4,10,0)');
  ctx.fillStyle = sg3;
  ctx.beginPath(); ctx.arc(0, 0, S * 0.22, 0, TAU); ctx.fill();
  ctx.restore();
  // the TYPE RING: the telegraph — a breathing ring in the required node's
  // color around the drill base, half-hidden by the shaft passing through
  // it. Heavies split it: blue side + white side. (Replaces orbit sigils.)
  ctx.save();
  ctx.translate(x, y); ctx.rotate(tanA); ctx.scale(1, SQ);
  const bb = 0.5 + 0.5 * Math.sin(uph * 2.2 + seed);
  const halves = heavy
    ? [['80,170,255', Math.PI / 2, Math.PI * 1.5], ['255,255,255', -Math.PI / 2, Math.PI / 2]]
    : [[en.lock === 0 ? '80,170,255' : en.lock === 1 ? '255,255,255' : PAL.glow, 0, TAU]];
  for (const [col, a0, a1] of halves) {
    ctx.strokeStyle = `rgba(${col},${(0.16 + 0.28 * bb).toFixed(2)})`;   // soft halo pass
    ctx.lineWidth = Math.max(1.6, S * 0.17);
    ctx.beginPath(); ctx.arc(0, 0, S * 0.23, a0, a1); ctx.stroke();
    ctx.strokeStyle = `rgba(${col},${(0.5 + 0.45 * bb).toFixed(2)})`;    // ring core
    ctx.lineWidth = Math.max(0.9, S * 0.06);
    ctx.beginPath(); ctx.arc(0, 0, S * 0.23, a0, a1); ctx.stroke();
  }
  ctx.restore();
  // auger drill: graphite — neutral near-black, dull metal; the lit flank
  // lifts a touch, the shaded flank sinks to black. Flutes are dark machined
  // grooves crawling toward the BASE (it pulls material out of the wall).
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x + tx2 * nw, y + ty2 * nw);
  ctx.lineTo(tipX + tx2 * nw * 0.2, tipY + ty2 * nw * 0.2);
  ctx.lineTo(tipX - tx2 * nw * 0.2, tipY - ty2 * nw * 0.2);
  ctx.lineTo(x - tx2 * nw, y - ty2 * nw);
  ctx.closePath();
  const lit = (tx2 * Math.cos(LIGHT_A) + ty2 * Math.sin(LIGHT_A)) > 0 ? 1 : -1;
  const gg2 = ctx.createLinearGradient(x + tx2 * lit * nw, y + ty2 * lit * nw,
                                       x - tx2 * lit * nw, y - ty2 * lit * nw);
  gg2.addColorStop(0, '#222327');
  gg2.addColorStop(0.55, '#131417');
  gg2.addColorStop(1, '#0a0b0d');
  ctx.fillStyle = gg2; ctx.fill();
  ctx.clip();                                   // flutes live inside the shaft
  ctx.strokeStyle = 'rgba(180,185,195,0.10)';   // faintest dull graphite luster
  ctx.lineWidth = Math.max(0.8, S * 0.05);
  ctx.beginPath();
  ctx.moveTo(x + tx2 * lit * nw * 0.55, y + ty2 * lit * nw * 0.55);
  ctx.lineTo(tipX + tx2 * lit * nw * 0.1, tipY + ty2 * lit * nw * 0.1);
  ctx.stroke();
  const pitch = S * 0.22;
  const off = pitch - (time * ENEMYFX.mSpin * S * 0.35) % pitch;
  ctx.strokeStyle = 'rgba(5,9,18,0.65)';        // flutes are dark machined grooves
  ctx.lineWidth = Math.max(0.7, S * 0.05);
  for (let d = -pitch + off; d < L2 + pitch; d += pitch) {
    const q0 = clamp(d / L2, 0, 1), wq = nw * (1 - q0 * 0.8);
    const bx = x + ux * d, by = y + uy * d;
    ctx.beginPath();                            // slanted band = one helix turn
    ctx.moveTo(bx + tx2 * wq, by + ty2 * wq);
    ctx.lineTo(bx - tx2 * wq + ux * pitch * 0.45, by - ty2 * wq + uy * pitch * 0.45);
    ctx.stroke();
  }
  ctx.restore();
  // black flank edges — the silhouette does the work, no light outline
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = Math.max(0.6, S * 0.035);
  for (const sgn of [1, -1]) {
    ctx.beginPath();
    ctx.moveTo(x + tx2 * sgn * nw, y + ty2 * sgn * nw);
    ctx.lineTo(tipX + tx2 * sgn * nw * 0.2, tipY + ty2 * sgn * nw * 0.2);
    ctx.stroke();
  }
  // siphon: packets of stolen energy climbing OUT of the stream, tip → plate,
  // each streaming a tail, swelling as it nears the tap, absorbed at the base.
  // The tip itself stays a bare cutting point — no hot spot, no circle.
  ctx.strokeStyle = `rgba(${PAL.glow},0.25)`;
  ctx.lineWidth = Math.max(0.6, S * 0.04);
  ctx.beginPath(); ctx.moveTo(tipX, tipY); ctx.lineTo(x, y); ctx.stroke();
  ctx.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    const q = (uph * 0.55 + i / 3 + seed * 0.1) % 1;
    const fo = clamp((1 - q) / 0.22, 0, 1);   // absorbed into the tap near the base
    const hx = lerp(tipX, x, q), hy = lerp(tipY, y, q);
    const tq = Math.max(0, q - 0.16);
    const tx3 = lerp(tipX, x, tq), ty3 = lerp(tipY, y, tq);
    const tg2 = ctx.createLinearGradient(tx3, ty3, hx, hy);
    tg2.addColorStop(0, `rgba(${PAL.glow},0)`);
    tg2.addColorStop(1, `rgba(${PAL.glow},${(0.9 * fo).toFixed(2)})`);
    ctx.strokeStyle = tg2;
    ctx.lineWidth = Math.max(0.8, S * 0.06) * (0.7 + q * 0.6);
    ctx.beginPath(); ctx.moveTo(tx3, ty3); ctx.lineTo(hx, hy); ctx.stroke();
    const bq = Math.max(0, q - 0.035);        // white-hot head bead (elongated)
    ctx.strokeStyle = `rgba(255,255,255,${(0.75 * fade * fo).toFixed(2)})`;
    ctx.lineWidth = Math.max(0.7, S * 0.045) * (0.7 + q * 0.6);
    ctx.beginPath(); ctx.moveTo(lerp(tipX, x, bq), lerp(tipY, y, bq)); ctx.lineTo(hx, hy); ctx.stroke();
  }
  ctx.lineCap = 'butt';

  // drill sparks at the cutting tip — the spray thickens as arrival closes in
  if (!lowFX && en.z < 1.6 && Math.random() < (0.25 + urg * 0.5) * fade) {
    particles.push({
      x: tipX, y: tipY,
      vx: ux * rand(0.4, 1.2) + tx2 * rand(-0.8, 0.8), vy: uy * rand(0.4, 1.2) + ty2 * rand(-0.8, 0.8),
      life: 0.35, decay: 2.8, color: `rgb(${PAL.glow})`, size: rand(0.6, 1.2) * Math.max(0.5, wallW)
    });
  }
  // gold payload specks being siphoned into the puncture
  if (!lowFX && en.z < 1.5 && Math.random() < 0.35 * fade) {
    const sa = en.angle + rand(-1, 1) * 0.14;
    const sz = en.z + rand(-0.08, 0.08);
    const rr2 = ring(Math.max(sz, 0.02), g).r;
    const sx = g.cx + Math.cos(sa) * rr2, sy = g.cy + Math.sin(sa) * rr2;
    particles.push({ x: sx, y: sy, vx: (x - sx) * 0.09, vy: (y - sy) * 0.09,
      life: 0.4, decay: 2.6, color: '#ffd24a', size: rand(0.6, 1.3) * wallW * 1.6 });
  }
  ctx.globalAlpha = fade;
}
// the data stream ribbon: a luminous curved band on the wall. the hot marker is
// where it crosses the ring — that point must stay covered head to tail
function drawStrip(en, g, fade) {
  const segs = 16;
  const dim = en.failed ? 0.28 : 1;
  // GOLDEN bonus ribbon; while a node rides it, it takes that node's color
  const gN = en.failed ? 0 : (en.traceGlow || 0) * 0.85;
  const nc = en.traceNode === 1 ? [255, 255, 255] : [111, 227, 255];
  const mix = (r0, g0, b0) =>
    `rgba(${Math.round(lerp(r0, nc[0], gN))},${Math.round(lerp(g0, nc[1], gN))},${Math.round(lerp(b0, nc[2], gN))},1)`;
  const cBase = mix(255, 180, 40), cHi = mix(255, 235, 170);
  for (let s2 = 0; s2 < segs; s2++) {
    const k0 = s2 / segs * en.len, k1 = (s2 + 1) / segs * en.len;
    const z0 = en.z + k0, z1 = en.z + k1;
    if (z1 <= g.hitZ * 0.55 || z0 >= SPAWN_Z - 0.03) continue;
    const aMid = stripAngle(en, (k0 + k1) / 2);
    const flow = 0.5 + 0.4 * Math.sin(time * 9 - s2 * 0.9);
    wallPatch(g, aMid, 0.055, z0, z1 + 0.005, cBase, fade * 0.7 * dim);
    wallPatch(g, aMid, 0.021, z0, z1 + 0.005, cHi, fade * flow * dim);
  }
  // trace marker at the ring crossing
  if (!en.failed && en.z <= g.hitZ && en.z + en.len >= g.hitZ) {
    const aReq = stripAngle(en, g.hitZ - en.z);
    const px2 = g.cx + Math.cos(aReq) * g.nodeR, py2 = g.cy + Math.sin(aReq) * g.nodeR;
    const mr = Math.min(W, H) * 0.032;
    ctx.globalAlpha = 1;
    const tg = ctx.createRadialGradient(px2, py2, 0, px2, py2, mr);
    tg.addColorStop(0, en.tracing ? 'rgba(255,255,255,0.95)' : 'rgba(255,225,150,0.85)');
    tg.addColorStop(1, 'rgba(255,180,40,0)');
    ctx.fillStyle = tg;
    ctx.beginPath(); ctx.arc(px2, py2, mr, 0, TAU); ctx.fill();
    ctx.strokeStyle = en.tracing ? 'rgba(255,255,255,0.9)' : 'rgba(255,210,110,0.75)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(px2, py2, mr * 0.45 * (1 + Math.sin(time * 8) * 0.15), 0, TAU); ctx.stroke();
  }
  ctx.globalAlpha = fade;
}

// birth fade: everything materializes over its first ~0.35s (alpha 0→1 plus a
// touch of scale) so nothing ever POPS into existence — deep horizon spawns
// and early-clamped mid-bore drops alike emerge from the glow. Draw-only:
// zero effect on hitboxes or timing.
const birthFade = o => clamp((o.age || 0) / 0.35, 0, 1);
// per-type palettes — the color IS the gameplay language: red = any node,
// blue/white = matching node, purple = both nodes, orange = it moves.
// shared by the body renderer and the decompile, so a death speaks in the
// body's own inks
function enemyPal(en) {
  return en.type === 'frag'
    ? { glow: '90,110,140',
        shades: ['#2b3242', '#151a26', '#3a4354', '#0d1119', '#232a38'],
        lights: ['#4a5568', '#5a6a80', '#3a4354'] }
    : en.type === 'heavy'
    ? { glow: '200,70,255',
        shades: ['#b03ae8', '#8a2ad4', '#d465ff', '#6f14b8', '#c44af0'],
        lights: ['#eab8ff', '#f3d4ff', '#d98cff'] }
    : en.lock === 0
    ? { glow: '80,170,255',
        shades: ['#2f7fe0', '#1c4fae', '#4d9bff', '#12398a', '#3f8af0'],
        lights: ['#a8ccff', '#d0e4ff', '#7db2ff'] }
    : en.lock === 1
    ? { glow: '225,240,255',
        shades: ['#c8d6e6', '#9fb2c8', '#e8f2fc', '#8194ab', '#d5e2f0'],
        lights: ['#ffffff', '#eef6ff', '#dbe8f6'] }
    : { glow: '255,60,90',
        shades: ['#e8274b', '#ff5a3c', '#d81f6e', '#b3123a', '#ff8c5a'],
        lights: ['#ff9db0', '#ffc9d4', '#ff8ba0'] };
}

// the glitch-out: a killed body freezes where it died and de-rezzes — its
// skin tears into horizontal strips that displace sideways, flicker, drop
// out, and finally collapse toward the body's midline. Sprite skins tear as
// image strips; procedural bodies tear as a diamond silhouette in their own
// plating shades.
function drawGhost(gh, g) {
  const k = gh.t / DECOMP.glitchT;
  const rg = ring(gh.z, g);
  const x = rg.x + Math.cos(gh.a) * rg.r, y = rg.y + Math.sin(gh.a) * rg.r;
  const size = Math.min(W, H) * 0.06 * clamp(rg.r / g.nodeR, 0.1, 2) * gh.sizeMul;
  const S = DECOMP.slices;
  const half = gh.spr ? size * 1.7 : size; // sprite skins draw on a wider box
  const collapse = Math.max(0, (k - 0.55) / 0.45) * 0.8; // the strips fall into the midline
  for (let i = 0; i < S; i++) {
    if (Math.random() < k * 0.6) continue; // strips drop out as the de-rez deepens
    const jx = (Math.random() - 0.5) * size * DECOMP.jitter * (0.3 + k);
    const y0 = -half + 2 * half * (i / S), h = 2 * half / S;
    const yd = y + (y0 + h / 2) * (1 - collapse) - h / 2;
    ctx.globalAlpha = (1 - k) * (0.5 + Math.random() * 0.5);
    if (gh.spr) {
      const sh = gh.spr.height;
      ctx.drawImage(gh.spr, 0, sh * (i / S), gh.spr.width, sh / S, x - half + jx, yd, half * 2, h);
    } else {
      const f = (y0 + h / 2) / half; // -1..1 down the body: a diamond profile
      const hw = Math.max(1, size * (1 - Math.abs(f) * 0.9));
      ctx.fillStyle = gh.pal.shades[i % gh.pal.shades.length];
      ctx.fillRect(x - hw + jx, yd, hw * 2, h);
    }
  }
  ctx.globalAlpha = 1;
}

// the node killer's body: SIGNAL LOSS.
// The void packet keeps its mass, its light-swallowing halo and its slow rim
// glint (the glint is what sells the BAIT — a beautiful object you must not
// touch). What it does now is FAIL: horizontal tear bands displace sideways and
// drop out entirely, and the rim splits into red/cyan chromatic fringes, which
// is what finally gives the void an edge you can find at the horizon — being
// black-on-black in a dark bore was its old weakness.
// Deliberately CONSTANT with depth: it never escalates as it closes, because
// escalation reads as "hostile, shoot it" and this one has to stay bait. It is
// not angrier up close; it is just wrong, the whole way in.
// Shared by the live body, the field guide specimen and the briefing card, so
// no surface can show a clean diamond the enemy no longer is. The caller
// translates to the body centre; everything here is local.
function voidPacket(pr, rot, ph, seed) {
  if (pr < 1) return;
  // corruption clock: events fire often, but `burst` is a STRENGTH rolled once
  // per event off the STATIC seed, not a flag — most events are a one-band
  // nudge, a few are a full tear. A fast cadence at one fixed intensity reads
  // as a blinking light; the variety is what makes it read as a bad signal.
  // bands need real pixels to read as slices — the level card's traffic legend
  // draws this at r≈8, where ten of them would be mush. Too small to slice =
  // no corruption at all, which is also true of a horizon spawn.
  const bands = Math.max(1, Math.min(lowFX ? 6 : FRAGFX.vBands, Math.floor(pr / 3)));
  const period = FRAGFX.vHold + FRAGFX.vBurst;
  const clk = ph * (0.85 + 0.3 * fhash(seed));
  const ev = Math.floor(clk / period);
  const burst = bands < 4 ? 0
    : (clk % period) > FRAGFX.vHold ? 0.28 + 0.72 * fhash(seed * 1.7 + ev * 17.3) : 0;
  const tk = Math.floor(ph * FRAGFX.vStep); // stepped re-roll

  const diamond = r => {
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.quadraticCurveTo(r * 0.55, -r * 0.55, r, 0);
    ctx.quadraticCurveTo(r * 0.55, r * 0.55, 0, r);
    ctx.quadraticCurveTo(-r * 0.55, r * 0.55, -r, 0);
    ctx.quadraticCurveTo(-r * 0.55, -r * 0.55, 0, -r);
    ctx.closePath();
  };
  // built once in local space and reused by every band — the gradient travels
  // with a displaced slice, which is what a torn image actually does
  const fg = ctx.createRadialGradient(0, 0, 0, 0, 0, pr);
  fg.addColorStop(0, '#0a0c1a');
  fg.addColorStop(0.55, '#04050d');
  fg.addColorStop(1, '#010104');
  // a sub-pixel split vanishes at horizon size, which is exactly where the void
  // used to disappear — so the fringe has a hard pixel FLOOR. Not an escalation:
  // the same look, just never allowed to reach zero.
  const cs = Math.max(Math.min(0.7, pr * 0.08), pr * FRAGFX.vChroma * (1 + burst * (FRAGFX.vChromaB - 1)));
  const rimW = Math.max(0.8, pr * 0.045);
  const ext = pr * 1.04;                     // the diamond never reaches past pr
  const bh = 2 * ext / bands;
  for (let i = 0; i < bands; i++) {
    const hTorn = fhash(seed * 7.3 + i * 13.1 + tk * 3.77);
    const hMag  = fhash(seed * 3.1 + i * 29.3 + tk * 5.13);
    const hDrop = fhash(seed * 5.9 + i * 41.7 + tk * 2.31);
    if (hDrop < FRAGFX.vDrop * burst) {        // dropout — the tunnel shows THROUGH the body
      // a blown-out sliver where the signal died: the only light this thing
      // ever emits, and what lets an event punch at mid-bore distance
      if (FRAGFX.vFlash > 0.02 && hMag < 0.55) {
        ctx.fillStyle = `rgba(170,190,225,${(0.3 * FRAGFX.vFlash * burst).toFixed(2)})`;
        ctx.fillRect(-pr * 0.9, -ext + i * bh + bh * 0.35, pr * 1.8, Math.max(1, bh * 0.3));
      }
      continue;
    }
    const dx = hTorn < FRAGFX.vTearN * burst ? (hMag - 0.5) * 2 * FRAGFX.vTear * burst * pr : 0;
    ctx.save();
    // the tear is a SCANLINE, so the clip is screen-horizontal — taken before
    // the body's own slow rotation
    ctx.beginPath(); ctx.rect(-pr * 2.4, -ext + i * bh, pr * 4.8, bh + 0.6); ctx.clip();
    ctx.translate(dx, 0);
    ctx.rotate(rot);
    diamond(pr);
    ctx.fillStyle = fg; ctx.fill();
    diamond(pr * 0.94);
    ctx.strokeStyle = 'rgba(70,85,120,0.32)'; ctx.lineWidth = Math.max(1.2, pr * 0.09); ctx.stroke();
    // chromatic aberration on the rim, drawn ADDITIVE: while the two fringes
    // overlap they sum back into the old pale hairline edge, and as the split
    // widens they peel apart into red and cyan. One value walks the whole way
    // from "clean diamond" to "broken transmission".
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineWidth = rimW;
    for (const [ox, col] of [[-cs, '210,60,80'], [cs, '60,175,220']]) {
      ctx.save(); ctx.translate(ox, 0);
      diamond(pr);
      ctx.strokeStyle = `rgba(${col},${FRAGFX.vChromaI.toFixed(2)})`; ctx.stroke();
      ctx.restore();
    }
    diamond(pr);
    ctx.strokeStyle = `rgba(120,140,175,${(0.2 + 0.45 * FRAGFX.vChromaI).toFixed(2)})`; ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();
  }
  // finishes that read across the whole body: the nebular sheen deep inside, a
  // dim scan sweep so it is never fully STILL between events, then the glint
  ctx.save();
  ctx.rotate(rot);
  diamond(pr); ctx.clip();
  ctx.fillStyle = 'rgba(90,70,160,0.12)';
  ctx.beginPath(); ctx.ellipse(-pr * 0.25, -pr * 0.2, pr * 0.5, pr * 0.35, 0.6, 0, TAU); ctx.fill();
  ctx.rotate(-rot);                            // the sweep is screen-horizontal too
  if (FRAGFX.vScan > 0.02 && !lowFX) {
    ctx.fillStyle = `rgba(150,170,205,${(0.09 * FRAGFX.vScan).toFixed(3)})`;
    for (let k = 0; k < 2; k++) {
      const sy = ((ph * 0.19 + k * 0.5) % 1) * 2.4 * pr - 1.2 * pr;
      ctx.fillRect(-pr * 1.3, sy, pr * 2.6, Math.max(1, pr * 0.1));
    }
  }
  ctx.restore();
  if (FRAGFX.vGlint > 0.02) {                  // light caught on the edge — the bait
    const ga = rot * 3;
    const gr = pr * (1 - 0.22 * Math.pow(Math.sin(2 * ga), 2));
    const gx = Math.cos(ga) * gr, gy = Math.sin(ga) * gr;
    const gg = ctx.createRadialGradient(gx, gy, 0, gx, gy, pr * 0.3);
    gg.addColorStop(0, `rgba(220,235,255,${(0.7 * FRAGFX.vGlint).toFixed(2)})`);
    gg.addColorStop(1, 'rgba(220,235,255,0)');
    ctx.fillStyle = gg;
    ctx.beginPath(); ctx.arc(gx, gy, pr * 0.3, 0, TAU); ctx.fill();
  }
}
// cheap deterministic hash for the packet's corruption rolls — no RNG stream is
// touched, so the campaign's spawn sequence can never shift because of an FX draw
const fhash = i => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

function drawEnemy(en, g) {
  const rg = ring(Math.max(en.z, 0.02), g);
  const x = rg.x + Math.cos(en.angle) * rg.r;
  const y = rg.y + Math.sin(en.angle) * rg.r;
  const birth = birthFade(en);
  // size tracks the WALL geometry (rg.r/nodeR), not raw z — bodies scale in
  // lockstep with the ring they sit on, so they read as glued to the tunnel
  // size tracks the WALL geometry, and the floor is low enough that a horizon
  // spawn is a couple of pixels — it has to GROW the whole way in, never arrive
  // half-grown. Birth ramps scale as well as alpha so mid-bore drops swell out
  // of the deep instead of blinking on at their local size.
  let size = Math.min(W, H) * 0.06 * clamp(rg.r / g.nodeR, 0.045, 2) * (en.sizeMul || 1) * (0.45 + 0.55 * birth);
  // missed traps balloon past the ring and dissolve; fresh ones fade in from the deep
  let fade = en.resolved ? clamp(en.z / g.hitZ, 0, 1) : 1;
  fade *= clamp((SPAWN_Z - 0.02 - en.z) / 0.45, 0, 1); // long, soft entrance at the horizon
  fade *= birth;
  if (fade <= 0.005) return;
  if (en.resolved) size *= 1 + (1 - clamp(en.z / g.hitZ, 0, 1)) * 1.6;
  const PAL = enemyPal(en);

  ctx.save();
  ctx.globalAlpha = fade;

  if (en.type === 'strip') { // ribbons draw themselves entirely on the wall
    drawStrip(en, g, fade);
    ctx.restore();
    return;
  }

  const spr = SPRITES[en.lock === 0 ? 'lock0' : en.lock === 1 ? 'lock1' : en.type];

  // hot glow at the wall point — except payload packets, which swallow light.
  // the glow breathes harder as arrival closes in: near threats burn brightest
  const urg = urgency(en, g);
  const pulse = 1 + Math.sin(en.spin * 2) * 0.08 + urg * 0.1 * Math.sin(time * 10);
  const gl = ctx.createRadialGradient(x, y, 0, x, y, size * 2.4 * pulse);
  if (en.type === 'frag') {
    gl.addColorStop(0, 'rgba(1,2,8,0.75)');
    gl.addColorStop(0.55, 'rgba(2,4,12,0.35)');
    gl.addColorStop(1, 'rgba(4,6,16,0)');
  } else {
    gl.addColorStop(0, `rgba(${PAL.glow},${(0.5 + urg * 0.3).toFixed(2)})`);
    gl.addColorStop(0.5, `rgba(${PAL.glow},${(0.16 + urg * 0.12).toFixed(2)})`);
    gl.addColorStop(1, `rgba(${PAL.glow},0)`);
  }
  ctx.fillStyle = gl;
  ctx.beginPath(); ctx.arc(x, y, size * 2.4 * pulse, 0, TAU); ctx.fill();

  if (spr) {
    // sprite skin replaces the procedural body (glow + sigils stay live)
    ctx.drawImage(spr, x - size * 1.7, y - size * 1.7, size * 3.4, size * 3.4);
  } else if (en.type === 'frag') {
    // payload packet: a void-black rounded diamond FLOATING in the bore — the
    // payload rides the stream; only corruption clings to the walls. It renders
    // as a failing signal (voidPacket) on a clock that is its own: a STATIC
    // seed off the spawn angle, and a phase that only ever ACCUMULATES, with no
    // urgency term — this body is bait and must not escalate as it closes.
    if (en.fxSeed === undefined) {
      en.fxSeed = 3 + ((en.angle * 39.7) % 10) * 9.7;
      en.fxPh = (en.angle * 7.3) % 3;          // stagger the start, no RNG draw
      en.fxT = time;
    }
    en.fxPh += clamp(time - en.fxT, 0, 0.1); en.fxT = time;
    ctx.save();
    ctx.translate(x, y);
    voidPacket(size * (1 + Math.sin(en.spin * 2) * 0.06), en.spin * 0.3, en.fxPh, en.fxSeed);
    ctx.restore();
  } else {
    drawNailBreach(en, g, fade, PAL);
  }
  // warp-in flash — ONLY for authored mid-bore drops, which genuinely appear out
  // of nothing and need the telegraph. A horizon spawn must never announce
  // itself; it just resolves out of the dark as it closes.
  if (en.age < 0.3 && (en.z0 || SPAWN_Z) < 1.2) {
    const wa = 1 - en.age / 0.3;
    ctx.strokeStyle = 'rgba(255,255,255,' + (wa * 0.8).toFixed(2) + ')';
    ctx.lineWidth = Math.max(1, size * 0.15 * wa);
    ctx.beginPath(); ctx.arc(x, y, size * (1.2 + (1 - wa) * 1.6), 0, TAU); ctx.stroke();
  }
  // (orbit sigils removed — the breathing type ring at the drill base is the
  // lock telegraph now, visible from spawn)
  ctx.restore();
}

// arrival pings: a pulse on the rim where something is about to land
function drawArrivalPings(g) {
  if (state === S.MENU) return;
  const pr = g.nodeR + Math.min(W, H) * 0.055 * 0.9;
  const mark = (a, col, z) => {
    if (z <= g.hitZ) return;
    const p2 = clamp(1 - (z - g.hitZ) / 0.28, 0, 1);
    if (p2 <= 0) return;
    const al = p2 * (0.35 + 0.4 * (Math.sin(time * (6 + p2 * 10)) * 0.5 + 0.5));
    ctx.strokeStyle = 'rgba(' + col + ',' + al.toFixed(2) + ')';
    ctx.lineWidth = 3 + p2 * 2;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(g.cx, g.cy, pr, a - 0.09, a + 0.09); ctx.stroke();
  };
  for (const en of enemies) {
    if (en.dead || en.resolved) continue;
    const col = en.type === 'frag' ? '140,150,170'
      : en.type === 'heavy' ? '200,70,255'
      : en.lock === 0 ? '80,170,255'
      : en.lock === 1 ? '240,248,255'
      : '255,60,90';
    mark(en.angle, col, en.z);
  }
  for (const p of pickups) if (!p.done) mark(p.angle, '255,210,74', p.z);
}

// lightning arcs from node carriages to zapped traps — jagged, fast fade
function drawBolts() {
  for (const b of bolts) {
    const a = clamp(b.life / b.max, 0, 1);
    const dx = b.x2 - b.x1, dy = b.y2 - b.y1;
    const dl = Math.hypot(dx, dy) || 1;
    const nx = -dy / dl, ny = dx / dl;
    ctx.lineCap = 'round';
    for (let pass = 0; pass < 2; pass++) {
      ctx.strokeStyle = pass === 0 ? 'rgba(140,215,255,' + (a * 0.85).toFixed(2) + ')' : 'rgba(255,255,255,' + a.toFixed(2) + ')';
      ctx.lineWidth = pass === 0 ? 4 : 1.5;
      ctx.beginPath();
      ctx.moveTo(b.x1, b.y1);
      const segs = 7;
      for (let i = 1; i < segs; i++) {
        const t = i / segs;
        const off = (Math.random() - 0.5) * 16 * a;
        ctx.lineTo(b.x1 + dx * t + nx * off, b.y1 + dy * t + ny * off);
      }
      ctx.lineTo(b.x2, b.y2);
      ctx.stroke();
    }
  }
}

// golden power-up orb with a kind-specific icon
function drawPickup(p, g) {
  const rg = ring(Math.max(p.z, 0.02), g);
  const x = rg.x + Math.cos(p.angle) * rg.r, y = rg.y + Math.sin(p.angle) * rg.r;
  const size = Math.min(W, H) * 0.042 * clamp(rg.r / g.nodeR, 0.12, 1.6);
  let fade = clamp((SPAWN_Z - 0.05 - p.z) / 0.3, 0, 1);
  fade *= birthFade(p); // materialize, never pop
  if (p.done) fade *= clamp(p.z / g.hitZ, 0, 1);
  if (fade <= 0.005) return;
  ctx.save();
  ctx.globalAlpha = fade;
  ctx.translate(x, y);
  const pulse = 1 + Math.sin(time * 5 + p.spin) * 0.1;
  const gl = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 2.6 * pulse);
  gl.addColorStop(0, 'rgba(255,210,74,0.55)');
  gl.addColorStop(1, 'rgba(255,210,74,0)');
  ctx.fillStyle = gl;
  ctx.beginPath(); ctx.arc(0, 0, size * 2.6 * pulse, 0, TAU); ctx.fill();
  ctx.rotate(p.spin * 0.6);
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a2 = i / 6 * TAU;
    i ? ctx.lineTo(Math.cos(a2) * size, Math.sin(a2) * size) : ctx.moveTo(Math.cos(a2) * size, Math.sin(a2) * size);
  }
  ctx.closePath();
  ctx.fillStyle = 'rgba(60,40,5,0.85)'; ctx.fill();
  ctx.strokeStyle = '#ffd24a'; ctx.lineWidth = Math.max(1, size * 0.14); ctx.stroke();
  ctx.rotate(-p.spin * 0.6);
  ctx.strokeStyle = '#ffe9b0'; ctx.fillStyle = '#ffe9b0';
  ctx.lineWidth = Math.max(1, size * 0.12); ctx.lineCap = 'round';
  const s2 = size * 0.52;
  if (p.kind === 'shield') { // heater shield
    ctx.beginPath();
    ctx.moveTo(0, -s2);
    ctx.lineTo(s2 * 0.8, -s2 * 0.5); ctx.lineTo(s2 * 0.8, s2 * 0.15);
    ctx.quadraticCurveTo(s2 * 0.8, s2 * 0.7, 0, s2);
    ctx.quadraticCurveTo(-s2 * 0.8, s2 * 0.7, -s2 * 0.8, s2 * 0.15);
    ctx.lineTo(-s2 * 0.8, -s2 * 0.5);
    ctx.closePath(); ctx.stroke();
  } else if (p.kind === 'inject') { // charged orb, ready core
    ctx.beginPath(); ctx.arc(0, 0, s2 * 0.95, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, s2 * 0.38, 0, TAU); ctx.fill();
  } else if (p.kind === 'chain') { // twin bolts — the arc jumps
    for (const ox of [-s2 * 0.42, s2 * 0.42]) {
      ctx.beginPath();
      ctx.moveTo(ox + s2 * 0.2, -s2 * 0.75); ctx.lineTo(ox - s2 * 0.3, s2 * 0.1); ctx.lineTo(ox, s2 * 0.1);
      ctx.lineTo(ox - s2 * 0.2, s2 * 0.75); ctx.lineTo(ox + s2 * 0.3, -0.1 * s2); ctx.lineTo(ox, -0.1 * s2);
      ctx.closePath(); ctx.fill();
    }
  } else if (p.kind === 'wide') { // widening arcs
    ctx.beginPath(); ctx.arc(0, 0, s2 * 0.55, -0.9, 0.9); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, s2 * 1.05, -0.7, 0.7); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, s2 * 0.55, Math.PI - 0.9, Math.PI + 0.9); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, s2 * 1.05, Math.PI - 0.7, Math.PI + 0.7); ctx.stroke();
  } else { // lightning bolt
    ctx.beginPath();
    ctx.moveTo(s2 * 0.3, -s2); ctx.lineTo(-s2 * 0.45, s2 * 0.15); ctx.lineTo(0, s2 * 0.15);
    ctx.lineTo(-s2 * 0.3, s2); ctx.lineTo(s2 * 0.45, -0.15 * s2); ctx.lineTo(0, -0.15 * s2);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

// energy wall strung between the two ends of a barrier pair — drawn under the traps
function drawLineBeam(en, g) {
  const p = en.partner;
  if (!p || (en.dead && p.dead)) return;
  const rg = ring(Math.max(en.z, 0.02), g);
  let fade = en.resolved ? clamp(en.z / g.hitZ, 0, 1) : 1;
  fade *= clamp((SPAWN_Z - 0.05 - en.z) / 0.3, 0, 1);
  if (fade <= 0.005) return;
  // a live crack RUNNING ALONG THE WALL between the two ruptures — take the
  // short way around, marching dashes sell the energy
  const d = angDiff(p.angle, en.angle);
  const lw = Math.max(1.5, clamp(rg.r / g.nodeR, 0.08, 2) * 6);
  ctx.save();
  ctx.lineCap = 'round';
  ctx.globalAlpha = fade * 0.5;
  ctx.strokeStyle = 'rgba(255,60,90,0.75)';
  ctx.lineWidth = lw * 2.2;
  ctx.beginPath(); ctx.arc(g.cx, g.cy, rg.r, en.angle, en.angle + d, d < 0); ctx.stroke();
  ctx.globalAlpha = fade * 0.9;
  ctx.strokeStyle = 'rgba(255,180,195,0.95)';
  ctx.lineWidth = Math.max(1, lw * 0.55);
  ctx.setLineDash([lw * 2.2, lw * 1.4]);
  ctx.lineDashOffset = -time * 90 * Math.sign(d || 1);
  ctx.beginPath(); ctx.arc(g.cx, g.cy, rg.r, en.angle, en.angle + d, d < 0); ctx.stroke();
  ctx.setLineDash([]);
  // stray sparks arcing off the fissure
  if (!lowFX && Math.random() < 0.3 * fade) {
    const sa = en.angle + d * Math.random();
    burst(g.cx + Math.cos(sa) * rg.r, g.cy + Math.sin(sa) * rg.r, '#ff8ba0', 1, 1.4);
  }
  ctx.restore();
}

// the warden core — flying deep in the tunnel, plus its bullet-hell return fire
// boss rail clamps: molten orange arcs seizing part of the ring — crossing one
// fries the cannon. They burn away from both ends and are gone within 3s.
function drawLatches(g, bz) {
  if (!latches.length) return;
  ctx.save();
  ctx.lineCap = 'butt';
  for (const lt of latches) {
    // the carpet is CONTINUOUS: its depth-length is exactly dur seconds of
    // travel, so what remains on the tunnel is what remains of the clamp —
    // one object approaching, crossing, and being consumed at the ring.
    // (boss grapples have tele=0: no carpet, the dart is their telegraph)
    if (lt.tele > 0) {
      const z0 = lt.z0 || 1.35;
      const v2 = (z0 - g.hitZ) / lt.tele;      // approach speed
      const len = v2 * lt.dur;                 // 3s worth of carpet
      const headZ = z0 - v2 * lt.t;
      const tailZ = headZ + len;
      const zA = Math.max(headZ, g.hitZ), zB = Math.min(tailZ, 2.08);
      if (zB > zA + 0.01) {
        const fadeIn = clamp(lt.t / 0.35, 0, 1);
        // the carpet's width at depth z = the clamp's width at the moment that
        // piece reaches the ring — a tapering tongue whose shape IS the timer,
        // matching the rim arc exactly as it feeds through
        const wAt = z => lt.span0 * clamp(1 - (lt.t + (z - g.hitZ) / v2 - lt.tele) / lt.dur, 0, 1);
        // rendered in the game's own light language — no painted fill: a
        // colonnade of luminous amber hazard bars (the tunnel's hoop grammar,
        // clipped to the wedge) glued to the body and marching in with it,
        // over a faint warm haze that marks the closed AREA
        ctx.globalCompositeOperation = 'lighter';
        for (let s2 = 0; s2 < 6; s2++) { // the haze
          const bz0 = headZ + len * s2 / 6, bz1 = headZ + len * (s2 + 1) / 6;
          const sz0 = Math.max(bz0, g.hitZ), sz1 = Math.min(bz1, 2.05);
          if (sz1 <= sz0 + 0.004) continue;
          const hwH = wAt(Math.max((bz0 + bz1) / 2, g.hitZ)) * 0.9;
          if (hwH <= 0.006) continue;
          const alH = fadeIn * clamp((SPAWN_Z - 0.05 - sz0) / 0.35, 0, 1);
          wallPatch(g, lt.a, hwH, sz0, sz1 + 0.004, 'rgba(255,60,90,1)', alH * 0.09);
        }
        const BARS = 9;
        for (let k2 = 0; k2 <= BARS; k2++) { // the bars: threat-red ALARM lights,
          // adjacent bars strobing in antiphase — a warning, never an invitation
          // (gold belongs to bonuses; this must read nothing like the ribbon)
          const bzM = headZ + len * k2 / BARS;
          if (bzM < g.hitZ || bzM > 2.05) continue;
          const hw = wAt(bzM) * 0.94;
          if (hw <= 0.006) continue;
          const strobe = 0.55 + 0.45 * Math.sin(time * 5.5 + (k2 % 2) * Math.PI);
          const al = fadeIn * clamp((SPAWN_Z - 0.05 - bzM) / 0.35, 0, 1) * strobe;
          if (al < 0.02) continue;
          wallPatch(g, lt.a, hw, bzM, bzM + 0.028, 'rgba(255,60,90,1)', al * 0.8);
          wallPatch(g, lt.a, hw, bzM, bzM + 0.012, 'rgba(255,170,185,1)', al * 0.5); // hot core line
        }
        ctx.globalCompositeOperation = 'source-over';
        if (headZ > g.hitZ) { // red-hot leading edge, until it docks
          const rgF = ring(Math.max(headZ, 0.02), g);
          const hwF = wAt(headZ);
          ctx.globalAlpha = 0.8 * fadeIn;
          ctx.strokeStyle = 'rgba(255,190,200,0.95)';
          ctx.lineWidth = Math.max(1.2, 3.5 * rgF.s * 3);
          ctx.beginPath(); ctx.arc(g.cx, g.cy, rgF.r, lt.a - hwF, lt.a + hwF); ctx.stroke();
          ctx.globalAlpha = 1;
        }
      }
    }
    if (lt.t < lt.tele) { // still inbound: landing zone dashed on the rim
      const q = lt.t / lt.tele;
      ctx.strokeStyle = `rgba(255,154,60,${(0.25 + q * 0.35 + Math.sin(time * 16) * 0.15).toFixed(2)})`;
      ctx.lineWidth = 2.5;
      ctx.setLineDash([5, 7]);
      ctx.beginPath(); ctx.arc(g.cx, g.cy, g.nodeR + bz / 2, lt.a - lt.span0, lt.a + lt.span0); ctx.stroke();
      ctx.setLineDash([]);
      continue;
    }
    const lt2 = lt.t - lt.tele;
    const half = lt.span0 * (1 - lt2 / lt.dur);
    if (half <= 0.01) continue;
    const arm = lt2 < lt.arm; // landing blink — a beat of grace before it bites
    let al = arm ? (Math.sin(time * 30) > 0 ? 0.9 : 0.25) : 0.9;
    const ending = clamp((lt.dur - lt2) / 0.6, 0, 1);
    if (ending < 1) al *= (Math.sin(time * 24) > 0 ? 1 : 0.5) * (0.5 + ending * 0.5); // blinking out — clear soon
    ctx.strokeStyle = `rgba(255,120,30,${(al * 0.45).toFixed(2)})`; // molten bed
    ctx.lineWidth = bz * 1.05;
    ctx.beginPath(); ctx.arc(g.cx, g.cy, g.nodeR + bz / 2, lt.a - half, lt.a + half); ctx.stroke();
    ctx.strokeStyle = `rgba(255,154,60,${al.toFixed(2)})`;
    ctx.lineWidth = bz * 0.55;
    ctx.beginPath(); ctx.arc(g.cx, g.cy, g.nodeR + bz / 2, lt.a - half, lt.a + half); ctx.stroke();
    // hazard chevrons marching across the clamp
    ctx.strokeStyle = `rgba(30,12,4,${(al * 0.6).toFixed(2)})`;
    ctx.lineWidth = 3;
    for (let a2 = lt.a - half + 0.045; a2 < lt.a + half - 0.02; a2 += 0.09) {
      ctx.beginPath();
      ctx.moveTo(g.cx + Math.cos(a2 - 0.022) * (g.nodeR + bz * 0.15), g.cy + Math.sin(a2 - 0.022) * (g.nodeR + bz * 0.15));
      ctx.lineTo(g.cx + Math.cos(a2 + 0.022) * (g.nodeR + bz * 0.85), g.cy + Math.sin(a2 + 0.022) * (g.nodeR + bz * 0.85));
      ctx.stroke();
    }
    // white-hot burn-off heads at both receding ends
    for (const s2 of [-1, 1]) {
      const ha = lt.a + s2 * half;
      const hx = g.cx + Math.cos(ha) * (g.nodeR + bz / 2), hy = g.cy + Math.sin(ha) * (g.nodeR + bz / 2);
      ctx.fillStyle = 'rgba(255,240,210,0.95)';
      ctx.beginPath(); ctx.arc(hx, hy, 2.5, 0, TAU); ctx.fill();
      if (state === S.PLAY && Math.random() < 0.3) burst(hx, hy, '#ffb478', 2, 2);
    }
  }
  ctx.restore();
}

function drawBoss(g) {
  const b = boss;
  // orbs first: race from the core's depth out to the ring, growing with perspective
  const railR = g.nodeR - Math.min(W, H) * 0.055 * 0.86;
  for (const sh of b.shots) {
    const k = clamp(sh.t / sh.dur, 0, 1);
    const posAt = kk => {
      const z = lerp(sh.zb, g.hitZ, kk);
      const rg = ring(z, g);
      const tu = Math.cos(sh.th) * (railR / g.nodeR), tv = Math.sin(sh.th) * (railR / g.nodeR);
      return { x: rg.x + lerp(sh.u0, tu, kk) * rg.r, y: rg.y + lerp(sh.v0, tv, kk) * rg.r, s: rg.s };
    };
    const p = posAt(k), p2 = posAt(Math.min(1, k + 0.05));
    const dirA = Math.atan2(p2.y - p.y, p2.x - p.x); // it flies point-first
    const os = Math.min(W, H) * 0.055 * p.s;
    // grapples burn orange; darts are threat-red, glitching violet for a frame
    const oc = sh.latch ? '255,154,60'
      : Math.sin(time * 11 + sh.th * 5.7) > 0.86 ? '212,101,255' : '255,60,90';
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(dirA);
    // motion trail streaking behind the dart
    const tg = ctx.createLinearGradient(-os * 6, 0, os * 1.2, 0);
    tg.addColorStop(0, `rgba(${oc},0)`);
    tg.addColorStop(1, `rgba(${oc},0.55)`);
    ctx.strokeStyle = tg;
    ctx.lineWidth = Math.max(1.5, os * 0.5);
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-os * 6, 0); ctx.lineTo(os * 0.6, 0); ctx.stroke();
    // the dart: a dark needle with a hot edge — hull, not a bubble
    ctx.fillStyle = 'rgba(10,4,18,0.95)';
    ctx.strokeStyle = `rgba(${oc},0.9)`;
    ctx.lineWidth = Math.max(1, os * 0.14);
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(os * 2.1, 0);
    ctx.lineTo(-os * 1.4, -os * 0.6);
    ctx.lineTo(-os * 0.7, 0);
    ctx.lineTo(-os * 1.4, os * 0.6);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    // white-hot tip
    const tp = ctx.createRadialGradient(os * 2.1, 0, 0, os * 2.1, 0, os * 1.1);
    tp.addColorStop(0, 'rgba(255,255,255,0.95)');
    tp.addColorStop(0.4, `rgba(${oc},0.5)`);
    tp.addColorStop(1, `rgba(${oc},0)`);
    ctx.fillStyle = tp;
    ctx.beginPath(); ctx.arc(os * 2.1, 0, os * 1.1, 0, TAU); ctx.fill();
    ctx.restore();
    if (sh.latch) { // where it will bite: the doomed stretch of rail blinks
      const halfP = 0.5 * clamp(sh.t / sh.dur, 0, 1);
      ctx.strokeStyle = `rgba(255,154,60,${(0.35 + Math.sin(time * 16) * 0.2).toFixed(2)})`;
      ctx.lineWidth = 2.5;
      ctx.setLineDash([5, 7]);
      ctx.beginPath(); ctx.arc(g.cx, g.cy, g.nodeR + Math.min(W, H) * 0.0275, sh.th - halfP, sh.th + halfP); ctx.stroke();
      ctx.setLineDash([]);
    }
  }
  // ceremony/death staging: the arrival dims the world; the death collapses it
  const cerQ0 = b.introT < BOSS_CER ? clamp(b.introT / BOSS_CER, 0, 1) : 1;
  if (cerQ0 < 1) { // the tunnel's light drains as the truth surfaces
    ctx.fillStyle = `rgba(2,1,8,${(cerQ0 * 0.4).toFixed(2)})`;
    ctx.fillRect(0, 0, W, H);
  }
  if (b.kind === 'triad' && b.dying === undefined) {
    // one machine in three bodies: the links go under the bodies
    drawTriadLinks(g);
    for (const c of b.cores) if (!c.dead) drawVoidCore(g, c);
    // charge telegraph: the firing body blooms before its dart spray
    for (const c of b.cores) {
      if (c.dead || !(c.chargeT > 0)) continue;
      const q = 1 - c.chargeT / 0.55;
      const cr2 = c.sSize * (1.5 + q * 0.9);
      const cg3 = ctx.createRadialGradient(c.sx, c.sy, 0, c.sx, c.sy, cr2);
      cg3.addColorStop(0, `rgba(255,120,150,${(0.30 + q * 0.45).toFixed(2)})`);
      cg3.addColorStop(1, 'rgba(255,60,90,0)');
      ctx.fillStyle = cg3;
      ctx.beginPath(); ctx.arc(c.sx, c.sy, cr2, 0, TAU); ctx.fill();
    }
    for (const bm of b.booms) { // mini implosions where a body went down
      const q = clamp(bm.t / 0.9, 0, 1);
      for (const [spd, col, w2] of [[1, '255,255,255', 2.5], [0.7, '212,101,255', 1.5]]) {
        const rr2 = q * spd * Math.min(W, H) * 0.45;
        if (rr2 < 2) continue;
        ctx.strokeStyle = `rgba(${col},${((1 - q) * 0.8).toFixed(2)})`;
        ctx.lineWidth = w2 + (1 - q) * 4;
        ctx.beginPath(); ctx.arc(bm.x, bm.y, rr2, 0, TAU); ctx.stroke();
      }
    }
  } else {
    if (b.kind === 'spinner' && b.dying === undefined) drawSpinnerBeam(g); // the light, under the lamp
    drawVoidCore(g, b);
    if (b.kind === 'spinner' && b.shieldT > 0) { // bolt fizzle: the shield shimmer
      const q = 1 - b.shieldT / 0.6;
      ctx.save();
      ctx.strokeStyle = `rgba(143,224,255,${((1 - q) * 0.8).toFixed(2)})`;
      ctx.lineWidth = 2.5;
      const shR = b.sSize * (1.15 + q * 0.5);
      ctx.beginPath();
      for (let k = 0; k <= 6; k++) {
        const a2 = k / 6 * TAU + b.spin * 0.3;
        ctx[k ? 'lineTo' : 'moveTo'](b.sx + Math.cos(a2) * shR, b.sy + Math.sin(a2) * shR);
      }
      ctx.stroke();
      ctx.restore();
    }
  }
  drawBossOverlays(g);
}
// the CORE body: a rogue intelligence rendered as ABSENCE — a void sphere that
// eats the tunnel's light, warps the data fabric into itself, wears dark
// armor plates, and watches the player with a slit eye. Parameterized on a
// view `c` (the boss itself, or one of the triad's mini bodies) so all three
// bosses share one machined-optics look.
// WHICH HULL A BOSS BODY WEARS. drawVoidCore is called with the boss itself for the
// core and the beacon, and once per body for the warden's triad — the triad's bodies
// carry a `name`, which is what tells the two cases apart.
//
// Returning null is the honest answer for anything without a build: the drawn body
// below is still the fallback, and the triad's DEATH ceremony deliberately takes it,
// because the implosion it plays is animation the baked sprite cannot do.
const TRIAD_HULL = { WALL: 'WALL', SHREDDER: 'SHRED', GHOST: 'GHOST' };
// per-hull on-screen scale. Each build frames itself with its own `cam`, so one factor
// would leave the beacon tiny next to the cutter — these are set by eye against the
// bore, which is the only place the comparison means anything.
const BOSS_HULL_R = { CUTTER: 1.95, WALL: 1.70, SHRED: 1.70, GHOST: 1.80, BEACN: 1.85,
  // the conductor is the centrepiece of its fight, not a dot in the bore — these are
  // set against the ring, which is the only comparison that means anything
  ARRHUB: 2.30, ARRARM: 1.70 };
// THE ARRAY IS TWO SPRITES, not one. The hub holds the centre and each live arm is
// stamped at its own bearing, so an arm can aim (the telegraph) and shear off (the
// damage) independently. One baked sprite could do neither.
function drawArrayRig(b, size, haze) {
  const hub = s3SpriteFor('ARRHUB'), arm = s3SpriteFor('ARRARM');
  if (!hub || !arm) return false;
  const R = size * BOSS_HULL_R.ARRHUB;
  for (const a2 of b.arms) {
    const shearing = a2.shear >= 0 && a2.shear < 1.1;
    if (!a2.live && !shearing) continue;
    ctx.save();
    ctx.rotate(a2.a);
    // a sheared arm tumbles outward and fades — the machine visibly loses hardware
    let al = haze;
    if (shearing) {
      const q = a2.shear / 1.1;
      ctx.translate(R * (0.9 + q * 1.5), 0);
      ctx.rotate(q * 1.4);
      al = haze * (1 - q);
    } else {
      ctx.translate(R * 0.9, 0);
    }
    s3draw(0, 0, size * BOSS_HULL_R.ARRARM, 'ARRARM', al);
    // the conducting arm runs its throat hot, which is the tell that it is about to release
    if (a2.live && a2.lit > 0.02) {
      ctx.globalCompositeOperation = 'lighter';
      const lg = ctx.createRadialGradient(size * 0.75, 0, 0, size * 0.75, 0, size * 0.95);
      lg.addColorStop(0, `rgba(255,225,180,${(0.55 * a2.lit * haze).toFixed(2)})`);
      lg.addColorStop(1, 'rgba(255,150,60,0)');
      ctx.fillStyle = lg;
      ctx.beginPath(); ctx.arc(size * 0.75, 0, size * 0.95, 0, TAU); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.restore();
  }
  s3draw(0, 0, R, 'ARRHUB', haze);
  // the bare core, exposed: the one window where a bolt is an answer
  if (b.exposeT > 0) {
    const vp = 0.55 + Math.sin(time * 15) * 0.45;
    ctx.globalCompositeOperation = 'lighter';
    const eg = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 1.5);
    eg.addColorStop(0, `rgba(255,240,210,${(0.55 * vp * haze).toFixed(2)})`);
    eg.addColorStop(0.5, `rgba(255,150,60,${(0.30 * vp * haze).toFixed(2)})`);
    eg.addColorStop(1, 'rgba(255,110,40,0)');
    ctx.fillStyle = eg;
    ctx.beginPath(); ctx.arc(0, 0, size * 1.5, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }
  return true;
}
function bossHullId(v) {
  if (v.name) return TRIAD_HULL[v.name] || null;
  if (v.kind === 'spinner') return 'BEACN';
  if (v.kind === 'core') return 'CUTTER';
  return null;
}
function drawVoidCore(g, c) {
  const b = c; // the body below reads the classic field names off the view
  const cerQ = b.introT < BOSS_CER ? clamp(b.introT / BOSS_CER, 0, 1) : 1;
  const dieQ = b.dying !== undefined ? b.dying : -1;
  let size = b.sSize;   // no breathing pulse: on a baked hull it reads as the model resizing
  if (dieQ > 2.3) size *= Math.max(0.01, 1 - (dieQ - 2.3) / 0.3); // implosion
  ctx.save();
  ctx.globalAlpha = 0.72 + 0.28 * (1 - clamp(b.z, 0, 1)); // deeper = hazier
  ctx.translate(b.sx, b.sy);
  const haze = ctx.globalAlpha;
  const flash = b.hurtT > 0 ? b.hurtT / 0.15 : 0;
  const dmg = 1 - clamp(b.hp / b.maxHp, 0, 1);
  const seed = b.spin * 3.3;
  const tear = Math.sin(time * 2.3 + seed) > 0.9 - dmg * 0.5 ? 1 : 0;
  // NO POSITIONAL TWITCH. `tear` used to also translate the whole body by a
  // sin(time*51) shake whenever it fired — about every 2.7s, which is the "jitter
  // every second or so" Gil reported. It read as a rendering fault rather than as
  // menace, and on a baked hull it reads as the sprite slipping. `tear` survives only
  // as the glitch-colour gate below, which is where it earned its keep.
  // red-dominant livery to match the eye — the purple survives only as
  // GLITCHES: parts flicker back to warden violet for a frame, far more
  // often while the body is tearing
  const gCol = ph => Math.sin(time * 11 + ph * 5.7) > (tear ? 0.45 : 0.86) ? '212,101,255' : '255,60,90';
  // it EATS light — the tunnel dims around it before anything is drawn
  const dk = ctx.createRadialGradient(0, 0, size * 0.5, 0, 0, size * 3.1);
  dk.addColorStop(0, 'rgba(2,1,8,0.8)');
  dk.addColorStop(0.55, 'rgba(4,2,12,0.4)');
  dk.addColorStop(1, 'rgba(4,2,12,0)');
  ctx.fillStyle = dk;
  ctx.beginPath(); ctx.arc(0, 0, size * 3.1, 0, TAU); ctx.fill();
  // ---- THE HULL IS BAKED HARDWARE, NOT LINE ART ----
  // The interdictor is an S3D mesh through the same renderer that builds the stations
  // the player arrives at — real materials, greebling, lit windows, lamps over the top.
  // Everything below this branch is the drawn body it replaces, kept as the fallback for
  // the frames before the bake lands (it is queued with the stations and pumped on the
  // menu, so in practice it is ready long before a relay-8 duel).
  //
  // Only the core boss has a hull: triad bodies come through this same function.
  if (b.kind === 'array' && b.arms && drawArrayRig(b, size, haze)) { ctx.restore(); return; }
  const hullId = bossHullId(b);
  if (hullId && s3SpriteFor(hullId)) {
    const hk = clamp(b.coreHeat === undefined ? 0 : b.coreHeat, 0, 1);
    const venting = b.ventT > 0;
    const R = size * BOSS_HULL_R[hullId];
    // NO BANK. A slow idle roll lived here to keep the hull from looking pasted on,
    // but the direction is a machine holding station rather than a ship under way, and
    // any rotation on a fixed installation reads as drift.
    if (flash > 0.3) { // struck: a white wash over the metal, through the sprite's own mask
      s3draw(0, 0, R, hullId, haze);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = haze * 0.5 * flash;
      s3draw(0, 0, R, hullId, 1, true);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = haze;
    } else {
      s3draw(0, 0, R, hullId, haze);
    }
    // THE HEAT RIDES OVER THE BAKED RADIATORS. A wash rather than drawn fins: the fins
    // are real geometry now, so the glow only has to say how hot they are — and a wash
    // survives the bank, which hand-placed bars would not.
    if (b.coreHeat !== undefined && (hk > 0.04 || venting)) {
      const hCol = hk < 0.34 ? '190,70,40' : hk < 0.67 ? '255,130,45' : '255,215,175';
      ctx.globalCompositeOperation = 'lighter';
      const hg = ctx.createRadialGradient(0, 0, size * 0.15, 0, 0, size * 1.75);
      hg.addColorStop(0, `rgba(${hCol},${(0.30 * hk * haze).toFixed(2)})`);
      hg.addColorStop(0.55, `rgba(${hCol},${(0.20 * hk * haze).toFixed(2)})`);
      hg.addColorStop(1, `rgba(${hCol},0)`);
      ctx.fillStyle = hg;
      ctx.beginPath(); ctx.arc(0, 0, size * 1.75, 0, TAU); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }
    if (venting) {
      // the panels are open. The loudest the hull ever gets, because it is the only
      // moment the player is meant to stop dodging and commit.
      const vp = 0.6 + Math.sin(time * 17) * 0.4;
      ctx.globalCompositeOperation = 'lighter';
      const vg = ctx.createRadialGradient(0, 0, size * 0.3, 0, 0, size * 2.5);
      vg.addColorStop(0, `rgba(255,242,220,${(0.44 * vp * haze).toFixed(2)})`);
      vg.addColorStop(0.42, `rgba(255,155,65,${(0.30 * vp * haze).toFixed(2)})`);
      vg.addColorStop(1, 'rgba(255,110,40,0)');
      ctx.fillStyle = vg;
      ctx.beginPath(); ctx.arc(0, 0, size * 2.5, 0, TAU); ctx.fill();
      // plumes off the radiator roots, up and down — which is where the slabs sit once
      // the hull is laid horizontal (model +X becomes screen vertical; see the rotZ note)
      ctx.strokeStyle = `rgba(255,236,205,${(0.75 * vp * haze).toFixed(2)})`;
      ctx.lineWidth = Math.max(2, size * 0.075);
      ctx.lineCap = 'round';
      for (const sgn of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(-size * 0.25, sgn * size * 0.55);
        ctx.lineTo(-size * 0.30, sgn * size * (1.35 + vp * 0.55));
        ctx.stroke();
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = `rgba(255,205,150,${(0.60 * haze).toFixed(2)})`;
      ctx.lineWidth = Math.max(1.4, size * 0.05);
      ctx.setLineDash([size * 0.30, size * 0.20]);
      ctx.beginPath(); ctx.arc(0, 0, size * (1.45 + vp * 0.10), 0, TAU); ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.restore();
    return;
  }
  // accretion: the data fabric warps in — streaks spiral into the mass,
  // swirling faster and redder as it dies
  ctx.lineCap = 'round';
  for (let i = 0; i < 14; i++) {
    const ph = (time * (0.16 + (i % 5) * 0.03) + i * 0.618) % 1;
    const al = Math.sin(ph * Math.PI) * (0.3 + dmg * 0.2) * haze;
    if (al < 0.02) continue;
    const a0 = i * 2.39 + b.spin * 0.7 + ph * 2.2;
    ctx.strokeStyle = `rgba(${gCol(i)},${al.toFixed(2)})`;
    ctx.lineWidth = Math.max(1, size * 0.035 * (1 - ph * 0.5));
    ctx.beginPath(); ctx.arc(0, 0, size * lerp(2.9, 0.78, ph), a0, a0 + 0.55 + ph * 0.5); ctx.stroke();
  }
  // dark armor plates on two counter-rotating tracks — they shear off at each
  // sixth of its health, so the fight's progress reads on the machine itself
  const segsAlive = Math.ceil(clamp(b.hp / b.maxHp, 0, 1) * 6);
  const plates = (rr, tilt, dir, alMul) => {
    ctx.save();
    ctx.rotate(Math.sin(time * 0.4 * dir) * 0.35);
    ctx.scale(1, tilt);
    for (let k = 0; k < 6; k++) {
      if (k >= segsAlive) continue;
      const a0 = k / 6 * TAU + b.spin * 0.55 * dir;
      ctx.save();
      ctx.translate(Math.cos(a0) * size * rr, Math.sin(a0) * size * rr);
      ctx.rotate(a0 + Math.PI / 2);
      ctx.fillStyle = `rgba(8,4,16,${(0.92 * alMul).toFixed(2)})`;
      ctx.strokeStyle = `rgba(${gCol(k * 1.7 + dir)},${((0.5 + flash * 0.5) * alMul).toFixed(2)})`;
      ctx.lineWidth = Math.max(1, size * 0.03);
      ctx.beginPath(); // an angular shard of hull, not a neat tile
      ctx.moveTo(-size * 0.30, 0);
      ctx.lineTo(-size * 0.10, -size * 0.13);
      ctx.lineTo(size * 0.30, -size * 0.07);
      ctx.lineTo(size * 0.16, size * 0.12);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  };
  plates(1.75, 0.6, -1, 0.55); // far track, behind the body
  // the void sphere — mostly absence, lit only at its horizon
  const sph = ctx.createRadialGradient(-size * 0.25, -size * 0.28, size * 0.1, 0, 0, size * 0.98);
  sph.addColorStop(0, 'rgba(26,12,44,1)');
  sph.addColorStop(0.55, 'rgba(9,4,18,1)');
  sph.addColorStop(1, 'rgba(3,1,8,1)');
  ctx.fillStyle = sph;
  ctx.beginPath(); ctx.arc(0, 0, size * 0.95, 0, TAU); ctx.fill();
  // event-horizon rim: hot crimson catch above (glitching violet), red below
  ctx.lineWidth = Math.max(1.5, size * 0.05);
  ctx.strokeStyle = `rgba(${gCol(2.4)},${(0.55 + flash * 0.45).toFixed(2)})`;
  ctx.beginPath(); ctx.arc(0, 0, size * 0.95, Math.PI * 0.8, Math.PI * 1.7); ctx.stroke();
  ctx.strokeStyle = `rgba(255,60,90,${(0.35 + dmg * 0.35).toFixed(2)})`;
  ctx.beginPath(); ctx.arc(0, 0, size * 0.95, Math.PI * 0.05, Math.PI * 0.55); ctx.stroke();
  // corruption lightning crawling the sphere when it tears or takes fire
  if (tear || flash > 0.4) {
    ctx.strokeStyle = `rgba(240,200,255,${(0.5 + flash * 0.4).toFixed(2)})`;
    ctx.lineWidth = Math.max(1, size * 0.02);
    ctx.beginPath();
    let lx = -size * 0.7, ly = Math.sin(time * 9 + seed) * size * 0.4;
    ctx.moveTo(lx, ly);
    for (let k2 = 1; k2 <= 5; k2++) {
      lx += size * 0.28;
      ly += Math.sin(time * 31 + seed + k2 * 7) * size * 0.22 - ly * 0.3;
      ctx.lineTo(lx, ly);
    }
    ctx.stroke();
  }
  // the EYE — HAL-class: one great lens fills the face, and it is watching
  // YOU. The burning fixation point leads toward the cannon with tiny
  // deterministic saccades — it re-fixates like something that thinks.
  const railR2 = g.nodeR - Math.min(W, H) * 0.055 * 0.86;
  const lkx = g.cx + Math.cos(nodes[0].angle) * railR2 - b.sx;
  const lky = g.cy + Math.sin(nodes[0].angle) * railR2 - b.sy;
  const lkd = Math.hypot(lkx, lky) || 1;
  const ux2 = lkx / lkd, uy2 = lky / lkd;
  const sacT = Math.floor(time * (dieQ >= 0 ? 7 : 1.3)); // dying: the gaze panics
  const sac1 = Math.sin(sacT * 12.9898) * 0.5, sac2 = Math.sin(sacT * 78.233) * 0.5;
  const eyeR = size * 0.8;
  // ignition on arrival, guttering out in death
  const eyeA = cerQ < 1 ? clamp((b.introT - 1.5) / 0.9, 0, 1) * (Math.sin(time * 31) > -0.4 ? 1 : 0.3)
    : dieQ >= 0 ? Math.max(0, 1 - dieQ / 2.3) * (Math.sin(time * 23) > -0.2 ? 1 : 0.25)
    : 1;
  ctx.save();
  ctx.globalAlpha *= Math.max(0.03, eyeA);
  const ex = ux2 * size * 0.07, ey = uy2 * size * 0.07; // the lens leans at its prey
  // the barrel: a deep dark well — the red lives at the BOTTOM of it
  const wg = ctx.createRadialGradient(ex, ey, 0, ex, ey, eyeR);
  wg.addColorStop(0, 'rgba(30,4,12,1)');
  wg.addColorStop(0.7, 'rgba(16,2,8,1)');
  wg.addColorStop(1, 'rgba(8,1,5,1)');
  ctx.fillStyle = wg;
  ctx.beginPath(); ctx.arc(ex, ey, eyeR, 0, TAU); ctx.fill();
  // stacked glass elements — each deeper ring shifts further toward the prey,
  // and that parallax is what makes it read as a BARREL, not a disc
  for (let j = 1; j <= 4; j++) {
    const rj = eyeR * (1 - j * 0.185);
    const ox = ex + ux2 * eyeR * 0.055 * j + (j > 2 ? sac1 * eyeR * 0.03 : 0);
    const oy = ey + uy2 * eyeR * 0.055 * j + (j > 2 ? sac2 * eyeR * 0.03 : 0);
    ctx.strokeStyle = `rgba(255,70,95,${(0.14 + j * 0.09 + flash * 0.2).toFixed(2)})`;
    ctx.lineWidth = Math.max(0.8, size * (0.014 + j * 0.004));
    ctx.beginPath(); ctx.arc(ox, oy, rj, 0, TAU); ctx.stroke();
    // cold glass glint riding the upper-left of each element
    ctx.strokeStyle = `rgba(210,230,255,${(0.05 + j * 0.02).toFixed(2)})`;
    ctx.lineWidth = Math.max(0.6, size * 0.01);
    ctx.beginPath(); ctx.arc(ox, oy, rj, Math.PI * 0.85, Math.PI * 1.35); ctx.stroke();
  }
  // aperture: a machined 7-blade iris around the sensor, contracting under fire
  const px3 = ex + ux2 * eyeR * 0.22 + sac1 * eyeR * 0.05;
  const py3 = ey + uy2 * eyeR * 0.22 + sac2 * eyeR * 0.05;
  const bR = eyeR * (0.34 - flash * 0.08);
  ctx.strokeStyle = `rgba(255,90,110,${(0.5 + flash * 0.4).toFixed(2)})`;
  ctx.lineWidth = Math.max(1, size * 0.02);
  ctx.beginPath();
  for (let k2 = 0; k2 < 7; k2++) {
    const a2 = k2 / 7 * TAU + b.spin * 0.25;
    ctx[k2 ? 'lineTo' : 'moveTo'](px3 + Math.cos(a2) * bR, py3 + Math.sin(a2) * bR);
  }
  ctx.closePath(); ctx.stroke();
  // the sensor at the bottom of the well — a small furious source, not a wash
  const sg = ctx.createRadialGradient(px3, py3, 0, px3, py3, bR * 0.85);
  sg.addColorStop(0, flash > 0.3 ? '#ffffff' : 'rgba(255,235,220,1)');
  sg.addColorStop(0.25, 'rgba(255,110,110,0.9)');
  sg.addColorStop(0.7, 'rgba(190,25,50,0.5)');
  sg.addColorStop(1, 'rgba(120,8,30,0)');
  ctx.fillStyle = sg;
  ctx.beginPath(); ctx.arc(px3, py3, bR * 0.85, 0, TAU); ctx.fill();
  // sensor reticle etched on the glass — hairline cross through the fixation point
  ctx.strokeStyle = 'rgba(255,180,190,0.22)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(px3 - bR * 1.5, py3); ctx.lineTo(px3 + bR * 1.5, py3);
  ctx.moveTo(px3, py3 - bR * 1.5); ctx.lineTo(px3, py3 + bR * 1.5);
  ctx.stroke();
  // machined lens lip — red steel, glitching violet — with focus-ring ticks
  ctx.strokeStyle = `rgba(${gCol(0.3)},${(0.5 + flash * 0.4).toFixed(2)})`;
  ctx.lineWidth = Math.max(1.2, size * 0.035);
  ctx.beginPath(); ctx.arc(ex, ey, eyeR, 0, TAU); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,120,140,0.4)';
  ctx.lineWidth = Math.max(0.8, size * 0.015);
  for (let k2 = 0; k2 < 12; k2++) {
    const a2 = k2 / 12 * TAU;
    ctx.beginPath();
    ctx.moveTo(ex + Math.cos(a2) * eyeR * 0.93, ey + Math.sin(a2) * eyeR * 0.93);
    ctx.lineTo(ex + Math.cos(a2) * eyeR * 0.99, ey + Math.sin(a2) * eyeR * 0.99);
    ctx.stroke();
  }
  // specular catch on the glass — it's a lens, not a hole
  ctx.fillStyle = 'rgba(220,235,255,0.25)';
  ctx.beginPath(); ctx.ellipse(ex - eyeR * 0.42, ey - eyeR * 0.48, eyeR * 0.2, eyeR * 0.1, -0.6, 0, TAU); ctx.fill();
  ctx.restore(); // eye ignition/gutter alpha
  plates(1.4, 0.85, 1, 1); // near track, riding in front
  // chromatic ghost rims when tearing — it can't hold its own outline
  if (tear || dieQ > 0.2) {
    ctx.globalAlpha = haze * 0.5;
    for (const [gc, gs2] of [['255,60,90', 1], ['110,200,255', -1]]) {
      ctx.strokeStyle = `rgba(${gc},0.5)`;
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(gs2 * size * 0.1, 0, size * 0.95, 0, TAU); ctx.stroke();
    }
    ctx.globalAlpha = haze;
  }
  // beam contact: targeting brackets stamp onto the core — the same bracket
  // grammar as the boot callouts, so "designated" reads instantly
  if (b.hurtT > 0 && dieQ < 0) {
    const br = size * 1.25, armL = size * 0.3;
    ctx.strokeStyle = `rgba(255,255,255,${(0.45 + flash * 0.5).toFixed(2)})`;
    ctx.lineWidth = 1.5;
    for (const [sx2, sy2] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      ctx.beginPath();
      ctx.moveTo(sx2 * br - sx2 * armL, sy2 * br);
      ctx.lineTo(sx2 * br, sy2 * br);
      ctx.lineTo(sx2 * br, sy2 * br - sy2 * armL);
      ctx.stroke();
    }
  }
  // ---- THE RADIATORS ARE THE HEAT GAUGE ----
  // The hull says how close the vent is, so nothing has to be read off a HUD. At this
  // range the body is a few dozen pixels and a bar there would be unreadable — but a
  // COLOUR is not, which is the same reason the beacon's beam carries its phase.
  // Dull red, then orange, then white, then the panels blow.
  //
  // Drawn LAST, on top of the hull. The first attempt put this next to the dark
  // gradient near the top of the function, and the fins vanished completely behind the
  // body — only the plumes and the aperture ring cleared it. Every radius here starts
  // outside size*1.0 for the same reason: it has to read at 26px, in a bore, at speed.
  // Guarded: triad bodies come through this same function and have no radiators.
  if (b.coreHeat !== undefined && dieQ < 0) {
    const hk = clamp(b.coreHeat, 0, 1);
    const venting = b.ventT > 0;
    const hCol = hk < 0.34 ? '190,60,40' : hk < 0.67 ? '255,130,45' : '255,230,195';
    if (hk > 0.02 || venting) {
      // four fin stubs down each flank, brightening and lengthening with the load
      const fa = 0.35 + hk * 0.60;
      ctx.strokeStyle = `rgba(${hCol},${(fa * haze).toFixed(2)})`;
      ctx.lineWidth = Math.max(1.6, size * 0.085);
      ctx.lineCap = 'butt';
      for (let f = 0; f < 4; f++) {
        const fy = (f - 1.5) * size * 0.30;
        for (const sgn of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(sgn * size * 1.04, fy);
          ctx.lineTo(sgn * size * (1.04 + 0.46 * (0.40 + hk * 0.60)), fy);
          ctx.stroke();
        }
      }
      if (hk > 0.5) { // hot enough to bloom around the fin roots
        ctx.globalCompositeOperation = 'lighter';
        const rg2 = ctx.createRadialGradient(0, 0, size * 0.9, 0, 0, size * 2.0);
        rg2.addColorStop(0, `rgba(${hCol},${(0.16 * (hk - 0.5) * 2 * haze).toFixed(2)})`);
        rg2.addColorStop(1, `rgba(${hCol},0)`);
        ctx.fillStyle = rg2;
        ctx.beginPath(); ctx.arc(0, 0, size * 2.0, 0, TAU); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
      }
    }
    if (venting) {
      // the panels are open: a hot bloom and two plumes dumping heat sideways. The
      // loudest the body ever gets, because it is the only moment the player is meant
      // to stop dodging and commit.
      const vp = 0.6 + Math.sin(time * 17) * 0.4;
      ctx.globalCompositeOperation = 'lighter';
      const vg = ctx.createRadialGradient(0, 0, size * 0.5, 0, 0, size * 2.6);
      vg.addColorStop(0, `rgba(255,240,215,${(0.50 * vp * haze).toFixed(2)})`);
      vg.addColorStop(0.4, `rgba(255,150,60,${(0.34 * vp * haze).toFixed(2)})`);
      vg.addColorStop(1, 'rgba(255,110,40,0)');
      ctx.fillStyle = vg;
      ctx.beginPath(); ctx.arc(0, 0, size * 2.6, 0, TAU); ctx.fill();
      ctx.strokeStyle = `rgba(255,232,200,${(0.80 * vp * haze).toFixed(2)})`;
      ctx.lineWidth = Math.max(2, size * 0.085);
      ctx.lineCap = 'round';
      for (const sgn of [-1, 1]) { // two plumes, venting sideways
        ctx.beginPath();
        ctx.moveTo(sgn * size * 0.9, 0);
        ctx.lineTo(sgn * size * (1.9 + vp * 0.8), -size * 0.20 * sgn);
        ctx.stroke();
      }
      ctx.globalCompositeOperation = 'source-over';
      // an aperture ring, so it reads as PANELS OPEN rather than merely as hot
      ctx.strokeStyle = `rgba(255,205,150,${(0.70 * haze).toFixed(2)})`;
      ctx.lineWidth = Math.max(1.4, size * 0.055);
      ctx.setLineDash([size * 0.30, size * 0.20]);
      ctx.beginPath(); ctx.arc(0, 0, size * (1.16 + vp * 0.10), 0, TAU); ctx.stroke();
      ctx.setLineDash([]);
    }
  }
  ctx.restore();
}
// arrival title stamp + death shockwaves — the shared ceremony dressing
function drawBossOverlays(g) {
  const b = boss;
  const bd = BOSS_DEFS[b.kind];
  const cerQ = b.introT < BOSS_CER ? clamp(b.introT / BOSS_CER, 0, 1) : 1;
  // ARRIVAL: the name stamps in while the eye ignites
  if (cerQ < 1 && b.introT > 1.7) {
    const ta = clamp((b.introT - 1.7) / 0.25, 0, 1);
    ctx.save();
    ctx.textAlign = 'center';
    ctx.globalAlpha = ta;
    ctx.fillStyle = b.introT < 1.8 ? '#ffffff' : '#d465ff';
    try { ctx.letterSpacing = '5px'; } catch (e) {}
    const btpx = fitPx(bd.title, '800', Math.min(W * 0.05, 30), ringChord(H * 0.26), 13);
    ctx.font = '800 ' + btpx + 'px Audiowide, system-ui';
    ctx.shadowColor = '#d465ff'; ctx.shadowBlur = lowFX ? 0 : 20;
    ctx.fillText(bd.title, W / 2, H * 0.26);
    try { ctx.letterSpacing = '0px'; } catch (e) {}
    ctx.shadowBlur = 0;
    const bspx = fitPx(bd.sub, '600', 11, ringChord(H * 0.26 + 22), 8);
    ctx.font = '600 ' + bspx + 'px Audiowide, system-ui';
    ctx.fillStyle = 'rgba(234,184,255,0.85)';
    ctx.fillText(bd.sub, W / 2, H * 0.26 + 22);
    ctx.restore();
  }
  // DEATH: the implosion lets go — shockwaves and a white world-flash
  if (b.boom) {
    const bq = clamp((b.dying - 2.3) / 0.8, 0, 1);
    ctx.save();
    ctx.lineCap = 'butt';
    for (const [spd, col, w2] of [[1, '255,255,255', 3], [0.75, '212,101,255', 2], [0.55, '255,154,60', 1.5]]) {
      const rr2 = bq * spd * Math.min(W, H) * 1.1;
      if (rr2 < 2) continue;
      ctx.strokeStyle = `rgba(${col},${((1 - bq) * 0.85).toFixed(2)})`;
      ctx.lineWidth = w2 + (1 - bq) * 6;
      ctx.beginPath(); ctx.arc(b.sx, b.sy, rr2, 0, TAU); ctx.stroke();
    }
    ctx.fillStyle = `rgba(255,255,255,${((1 - bq) * 0.55).toFixed(2)})`;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
}
// the triad's energy links: crackling filaments strung between the bodies —
// the visual proof this is ONE machine in three bodies. Deterministic sin
// jitter (no RNG, no allocations) keeps the crackle alive and phones happy.
function drawTriadLinks(g) {
  const b = boss;
  ctx.save();
  ctx.lineCap = 'round';
  const SEG = 7;
  for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) {
    const c1 = b.cores[i], c2 = b.cores[j];
    if (c1.dead || c2.dead) continue; // a dead body drops its links
    let nx = -(c2.sy - c1.sy), ny = c2.sx - c1.sx;
    const nl = Math.hypot(nx, ny) || 1;
    nx /= nl; ny /= nl;
    const amp0 = Math.min(c1.sSize, c2.sSize) * 0.35;
    for (const [lw, col, amp] of [
      [Math.max(2, c1.sSize * 0.16), 'rgba(212,101,255,0.22)', 0.45],
      [Math.max(1, c1.sSize * 0.05), 'rgba(255,120,150,0.75)', 1]
    ]) {
      ctx.strokeStyle = col;
      ctx.lineWidth = lw;
      ctx.beginPath();
      ctx.moveTo(c1.sx, c1.sy);
      for (let k = 1; k < SEG; k++) {
        const q = k / SEG;
        const off = Math.sin(time * 13 + k * 5.1 + i * 7 + j * 3) * Math.sin(q * Math.PI) * amp0 * amp;
        ctx.lineTo(lerp(c1.sx, c2.sx, q) + nx * off, lerp(c1.sy, c2.sy, q) + ny * off);
      }
      ctx.lineTo(c2.sx, c2.sy);
      ctx.stroke();
    }
    // a data pulse rides each link — one bloodstream through three bodies
    const pq = (time * 0.7 + (i * 2 + j) * 0.37) % 1;
    const px2 = lerp(c1.sx, c2.sx, pq), py2 = lerp(c1.sy, c2.sy, pq);
    const pr2 = Math.max(2, c1.sSize * 0.14);
    const pg2 = ctx.createRadialGradient(px2, py2, 0, px2, py2, pr2 * 2.2);
    pg2.addColorStop(0, 'rgba(255,255,255,0.9)');
    pg2.addColorStop(0.4, 'rgba(212,101,255,0.5)');
    pg2.addColorStop(1, 'rgba(212,101,255,0)');
    ctx.fillStyle = pg2;
    ctx.beginPath(); ctx.arc(px2, py2, pr2 * 2.2, 0, TAU); ctx.fill();
  }
  ctx.restore();
}
// the BEACON's lighthouse beam — drawn as LIGHT, never a surface: a white-hot
// filament in a soft additive wedge from the lamp to beyond the ring, plus a
// hazard bloom where the light rakes the rail (the WYSIWYG danger readout)
// THE LIGHT WEARS THE EMITTER IT CONDEMNS. This used to be Payload Gold, which was
// two problems in one: gold is reserved for things the player GAINS, and a single
// colour cannot say which carriage has to run. The beam now takes the condemned
// node's own colour, in the telegraph as well as the sweep — the tell has to be
// readable BEFORE the lamp fires, or the phase is a coin toss instead of a read.
function spinBeamPal(b) {
  const ph = b.beamPhase || 0;
  return ph === 0
    // blue carriage condemned: unmistakably its blue, with a white-hot core
    ? { wide: '90,180,255', mid: '150,215,255', hot: '235,248,255', rim: '80,150,255' }
    // white carriage: cooled to silver so it never reads as "no colour", and the
    // rim goes steel rather than blue so the two are told apart at a glance
    : { wide: '196,214,232', mid: '232,242,252', hot: '255,255,255', rim: '190,206,224' };
}
function drawSpinnerBeam(g) {
  const b = boss;
  const A = b.beamA;
  const P = spinBeamPal(b);
  const exR = g.R0 * 1.05; // past the ring — the light leaves the screen
  const ex = g.cx + Math.cos(A) * exR, ey2 = g.cy + Math.sin(A) * exR;
  if (b.mode === 'tele') { // the ghost line sweeps up: aim first, fire second
    const pl = 0.35 + Math.sin(time * 14) * 0.22;
    ctx.save();
    // THE TELL HAS TO LAND, and the first attempt put it on the lamp: the beacon is
    // ~12px on screen from four hundred away down the bore, so a swatch on its
    // housing was invisible and a 2px ghost line lost the argument with the bore.
    // Everything below is at RING scale instead, because that is where the player is
    // looking — the read decides which thumb has to run, and a read that has to be
    // hunted for is the same as no read at all.
    ctx.setLineDash([7, 8]);
    ctx.strokeStyle = `rgba(${P.mid},${(0.55 + pl * 0.45).toFixed(2)})`;
    ctx.lineWidth = 3.5;
    ctx.beginPath(); ctx.moveTo(b.sx, b.sy); ctx.lineTo(ex, ey2); ctx.stroke();
    ctx.setLineDash([]);
    for (let k = 1; k <= 3; k++) { // chevrons lead the coming rotation
      const a2 = A + b.beamDir * 0.18 * k;
      ctx.strokeStyle = `rgba(${P.mid},${(pl * (1 - k * 0.22) * 1.5).toFixed(2)})`;
      ctx.lineWidth = 4.5;
      ctx.beginPath(); ctx.arc(g.cx, g.cy, g.nodeR, a2 - 0.05, a2 + 0.05); ctx.stroke();
    }
    // and the condemned carriage is marked ON ITSELF. A colour somewhere else asks
    // the player to remember which emitter is which; a halo around the actual thumb
    // does not.
    const cRail = g.nodeR - Math.min(W, H) * 0.055 * 0.86;
    const cn = nodes[b.beamPhase || 0];
    if (cn) {
      const cxx = g.cx + Math.cos(cn.angle) * cRail, cyy = g.cy + Math.sin(cn.angle) * cRail;
      const rr = Math.min(W, H) * (0.032 + 0.010 * Math.sin(time * 9));
      ctx.strokeStyle = `rgba(${P.hot},${(0.45 + pl * 0.55).toFixed(2)})`;
      ctx.lineWidth = 2.6;
      ctx.beginPath(); ctx.arc(cxx, cyy, rr, 0, TAU); ctx.stroke();
      ctx.strokeStyle = `rgba(${P.rim},${(0.28 + pl * 0.35).toFixed(2)})`;
      ctx.lineWidth = 5.5;
      ctx.beginPath(); ctx.arc(cxx, cyy, rr * 1.5, 0, TAU); ctx.stroke();
    }
    ctx.restore();
    return;
  }
  if (b.mode !== 'sweep') return;
  ctx.save();
  // the glow wedge
  const wr = Math.hypot(ex - b.sx, ey2 - b.sy);
  const wg2 = ctx.createRadialGradient(b.sx, b.sy, b.sSize * 0.3, b.sx, b.sy, wr);
  wg2.addColorStop(0, `rgba(${P.hot},0.5)`);
  wg2.addColorStop(0.35, `rgba(${P.mid},0.22)`);
  wg2.addColorStop(1, `rgba(${P.wide},0.05)`);
  ctx.fillStyle = wg2;
  const HW = 0.16; // wedge half-angle
  ctx.beginPath();
  ctx.moveTo(b.sx, b.sy);
  ctx.lineTo(g.cx + Math.cos(A - HW) * exR, g.cy + Math.sin(A - HW) * exR);
  ctx.arc(g.cx, g.cy, exR, A - HW, A + HW);
  ctx.closePath(); ctx.fill();
  // the filament — constant angular speed, readable and fair
  ctx.lineCap = 'round';
  for (const [lw, col] of [[9, `rgba(${P.wide},0.35)`], [4, `rgba(${P.mid},0.8)`], [1.6, `rgba(${P.hot},0.98)`]]) {
    ctx.strokeStyle = col;
    ctx.lineWidth = lw;
    ctx.beginPath(); ctx.moveTo(b.sx, b.sy); ctx.lineTo(ex, ey2); ctx.stroke();
  }
  // hazard bloom where the light crosses the ring
  ctx.strokeStyle = `rgba(${P.rim},${(0.55 + Math.sin(time * 22) * 0.2).toFixed(2)})`;
  ctx.lineWidth = Math.min(W, H) * 0.02;
  ctx.beginPath(); ctx.arc(g.cx, g.cy, g.nodeR, A - SPIN_BEAM_HALF, A + SPIN_BEAM_HALF); ctx.stroke();
  const hx = g.cx + Math.cos(A) * g.nodeR, hy = g.cy + Math.sin(A) * g.nodeR;
  // sysRandom, not Math.random: in a seeded lane Math.random IS the spawn stream, and
  // the server replays without ever drawing a frame. Draw code must not spend it.
  if (sysRandom() < 0.5) burst(hx, hy, `rgb(${P.hot})`, 1, 2.5);
  ctx.restore();
}
// the fused ray cannon: aim barrel + a straight perspective-tapered beam
function drawBeam(g) {
  const b = boss;
  if (!b || b.mergeT < 1) return;
  const seg = beamGeometry(g);
  const size = Math.min(W, H) * 0.038;
  const heatCol = heat < 0.5 ? '140,225,255' : heat < 0.8 ? '255,190,90' : '255,90,70';
  const bAng = Math.atan2(seg.ty - seg.sy, seg.tx - seg.sx);
  // barrel tracks the ray
  ctx.save();
  ctx.translate(seg.sx, seg.sy);
  ctx.rotate(bAng);
  ctx.fillStyle = '#0d1626';
  roundRect(0, -size * 0.24, size * 1.5, size * 0.48, 4); ctx.fill();
  ctx.strokeStyle = 'rgba(' + heatCol + ',0.9)'; ctx.lineWidth = 1.5;
  roundRect(0, -size * 0.24, size * 1.5, size * 0.48, 4); ctx.stroke();
  ctx.fillStyle = 'rgba(' + heatCol + ',' + (0.35 + heat * 0.6).toFixed(2) + ')';
  ctx.fillRect(size * 0.25, -size * 0.12, size * 1.1 * heat, size * 0.24); // heat window
  ctx.restore();
  if (!beamActive) return;
  // endpoint: the core when the ray connects, else the wall/deep exit
  const hit = beamHitCore(g);
  const dx = seg.tx - seg.sx, dy = seg.ty - seg.sy;
  const len = Math.hypot(dx, dy) || 1;
  let ex, ey, endScale;
  if (hit) {
    ex = seg.sx + dx / len * hit.t;
    ey = seg.sy + dy / len * hit.t;
    endScale = Math.max(0.15, ring(b.z, g).s / ring(g.hitZ, g).s);
  } else {
    ex = seg.tx; ey = seg.ty;
    endScale = Math.max(0.12, seg.endS);
  }
  const bx0 = seg.sx + Math.cos(bAng) * size * 1.4, by0 = seg.sy + Math.sin(bAng) * size * 1.4;
  const wob = Math.sin(time * 40) * 1.5;
  ctx.lineCap = 'round';
  const SEGS = 10;
  for (const [wBase, col] of [[13 + wob, 'rgba(' + heatCol + ',0.30)'], [6, 'rgba(' + heatCol + ',0.7)'], [2.2, 'rgba(255,255,255,0.95)']]) {
    ctx.strokeStyle = col;
    for (let i = 1; i <= SEGS; i++) {
      const t0 = (i - 1) / SEGS, t1 = i / SEGS;
      ctx.lineWidth = Math.max(0.4, wBase * lerp(1, endScale, (t0 + t1) / 2));
      ctx.beginPath();
      ctx.moveTo(lerp(bx0, ex, t0), lerp(by0, ey, t0));
      ctx.lineTo(lerp(bx0, ex, t1), lerp(by0, ey, t1));
      ctx.stroke();
    }
  }
  if (hit) { // impact bloom on the core
    const ig = ctx.createRadialGradient(b.sx, b.sy, 0, b.sx, b.sy, b.sSize * 1.5);
    ig.addColorStop(0, 'rgba(255,255,255,0.85)');
    ig.addColorStop(0.4, 'rgba(' + heatCol + ',0.5)');
    ig.addColorStop(1, 'rgba(' + heatCol + ',0)');
    ctx.fillStyle = ig;
    ctx.beginPath(); ctx.arc(b.sx, b.sy, b.sSize * 1.5, 0, TAU); ctx.fill();
  } else if (seg.zExit < 0.99) { // scorch spark where the ray rakes the tunnel wall
    ctx.fillStyle = 'rgba(' + heatCol + ',0.7)';
    ctx.beginPath(); ctx.arc(ex, ey, Math.max(2, 9 * endScale), 0, TAU); ctx.fill();
    if (Math.random() < 0.4) burst(ex, ey, '#ffd9a0', 1, 2);
  }
}


// THE NODE HOLDER RING — the physical hardware the arcs are mounted on: the
// matte black plate, its boot fly-in, its exit, and the dock flare.
//
// Lifted out of frame() so it can be drawn WITHOUT booting a game. The tuning
// board loads every file except 99-boot.js (whose top level starts a run), and
// this lived inside frame() — so a preview of the arcs or of a body painted ON
// the ring had no ring under it. Returns the band half-unit the caller needs.
function drawHolderRing(g) {
  // node holder ring: thick matte black like the mock, with faked soft shadow for depth
  const bz = Math.min(W, H) * 0.055;
  // boot: the ring launches from the operator's own viewpoint and flies INTO
  // the tunnel, braking into the dock — perspective-true (the same 1/(1+6z)
  // law as the traffic), so it reads as deploying hardware, not a UI transition
  // …and while the run is PARKED there is no ring at all: it has not been sent for yet.
  // bootRingS() holds it at its launch scale (~3.3x, blown past the frame edges) which
  // still leaves two fat arcs crossing the picture, and dock markers waiting at a rim
  // nothing is flying towards. Both are ceremony, and the ceremony has not started.
  const parked = preLaunch();
  const bootRing = (state === S.PLAY || state === S.PAUSE) && introT < INTRO_DUR + 1;
  const ringS = bootRingS(g);
  if (bootRing && !parked && introT < BOOT_LOCK) {
    const p = clamp(introT / BOOT_LOCK, 0, 1);
    // dock markers wait at the rim: hairline target circle + four braces
    const ba = 0.5 + 0.4 * p;
    ctx.setLineDash([3, 9]);
    ctx.strokeStyle = `rgba(160,220,255,${(ba * 0.35).toFixed(2)})`;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(g.cx, g.cy, g.nodeR, 0, TAU); ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineWidth = 2;
    ctx.strokeStyle = `rgba(160,220,255,${(ba * 0.8).toFixed(2)})`;
    for (let k = 0; k < 4; k++) {
      const a2 = k * Math.PI / 2 + Math.PI / 4;
      ctx.beginPath(); ctx.arc(g.cx, g.cy, g.nodeR, a2 - 0.09, a2 + 0.09); ctx.stroke();
    }
  }
  // THE RING LEAVES TOO. It arrived by flying INTO the lane on the boot; the
  // arrival is that in reverse — it blows out past the eye on the same
  // accelerating law as the corridor, and nothing is left framing the world.
  const rExit = laneExit();
  const ringOutS = 1 + rExit * rExit * 3.6, ringOutA = 1 - rExit;
  if (state !== S.MENU && state !== S.GUIDE && !parked && ringOutA > 0.004) {
    // the PHYSICAL ring exists only in the game — menus, the Archive and the parked
    // pre-launch drift stay open so the boot's ring arrival lands with real contrast
    const sc = ringS * ringOutS;
    const al = (ringS !== 1 ? 0.35 + 0.65 * clamp(introT / BOOT_LOCK, 0, 1) : 1) * ringOutA;
    const xf = sc !== 1 || al < 1;
    if (xf) {
      ctx.save();
      ctx.translate(g.cx, g.cy); ctx.scale(sc, sc); ctx.translate(-g.cx, -g.cy);
      ctx.globalAlpha = al; // condenses out of the eye on the boot, drains on the way out
    }
    // soft occlusion shadow behind the band, then the prerendered monolith
    ctx.strokeStyle = 'rgba(0,0,0,0.14)'; ctx.lineWidth = bz * 1.6;
    ctx.beginPath(); ctx.arc(g.cx, g.cy, g.nodeR, 0, TAU); ctx.stroke();
    if (ringFxCv) ctx.drawImage(ringFxCv, 0, 0, W, H);
    // warm river light still catches the band's lower outer edge — and goes out
    // with the convoy when the lane parks
    if (laneFlow > 0.01) {
      ctx.beginPath(); ctx.arc(g.cx, g.cy, g.nodeR + bz * ARCFX.bandW * 0.9, Math.PI * 0.28, Math.PI * 0.72);
      ctx.strokeStyle = `rgba(255,190,100,${(0.20 * laneFlow).toFixed(3)})`; ctx.lineWidth = 2; ctx.stroke();
    }
    if (xf) { ctx.restore(); ctx.globalAlpha = 1; }
  }
  // the dock: a rim flare and white/blue shockwaves ring off the lock moment
  if (bootRing) {
    const lp = introT - BOOT_LOCK;
    if (lp >= 0 && lp < 0.85) {
      ctx.save(); ctx.lineCap = 'butt';
      const flare = clamp(1 - lp / 0.25, 0, 1);
      if (flare > 0) {
        ctx.strokeStyle = `rgba(235,250,255,${(flare * 0.85).toFixed(2)})`;
        ctx.lineWidth = bz * 0.5;
        ctx.beginPath(); ctx.arc(g.cx, g.cy, g.nodeR, 0, TAU); ctx.stroke();
      }
      for (const [dly, col, dir, spread] of [
        [0, '235,250,255', 1, 0.5],    // white pulse out
        [0.12, '111,227,255', 1, 0.5], // blue pulse chasing it
        [0.06, '111,227,255', -1, 0.3] // faint blue pulse collapsing inward
      ]) {
        const q = (lp - dly) / 0.6;
        if (q <= 0 || q >= 1) continue;
        const e2 = 1 - Math.pow(1 - q, 2);
        ctx.strokeStyle = `rgba(${col},${((1 - q) * (dir > 0 ? 0.6 : 0.35)).toFixed(2)})`;
        ctx.lineWidth = 2.5 * (1 - q) + 0.5;
        ctx.beginPath();
        ctx.arc(g.cx, g.cy, g.nodeR * (1 + dir * e2 * spread), 0, TAU);
        ctx.stroke();
      }
      ctx.restore();
    }
  }
  return bz;
}
function drawNodes(g) {
  // …and while the run is PARKED, neither does the hardware they are mounted on. The
  // arcs ride the ring's fly-in as one assembly, so at a held introT of 0 they sit at
  // the same ~3.3x launch scale — which does not read as "not here yet", it reads as
  // two fat arcs parked across the corners of the frame. Nothing has been sent for.
  if (preLaunch()) { drawPulseOrbs(g); return; }
  const bzn = Math.min(W, H) * 0.055;
  const bh = bzn * ARCFX.bandW;                   // the monolith band's half-width
  const fused = boss && boss.mergeT >= 1;
  // boot: the arcs fly in mounted on the ring, one piece of hardware
  const bs0 = bootRingS(g);
  if (bs0 !== 1) {
    ctx.save();
    ctx.translate(g.cx, g.cy); ctx.scale(bs0, bs0); ctx.translate(-g.cx, -g.cy);
    ctx.globalAlpha = 0.35 + 0.65 * clamp(introT / BOOT_LOCK, 0, 1);
  }
  for (let i = 0; i < 2; i++) {
    if (fused && i === 1) continue; // one combined cannon arc
    const n = nodes[i];
    const vel = angDiff(n.angle, n.prevA === undefined ? n.angle : n.prevA);
    n.trailV = (n.trailV || 0) * 0.8 + vel * 0.2;
    n.prevA = n.angle;
    // boot and node-killer share ONE cycle, rb 1 → 0:
    // snap shut → dead sliver + amber ember → regrow (cold) → reignite.
    // Boot caps at 0.88 — the arcs ARRIVE as slivers; the snap-shut phase
    // (rb > 0.88) belongs to the fry only, never to the fly-in.
    const bootRb = state !== S.MENU && introT < INTRO_DUR
      ? 0.88 * clamp((BOOT_ON - introT) / (BOOT_ON - BOOT_LOCK), 0, 1) : 0;
    const rb = Math.max(clamp((n.deadT || 0) / 2, 0, 1), bootRb);
    drawArcNode(n, g, i, rb, fused, bh);
  }
  if (bs0 !== 1) { ctx.restore(); ctx.globalAlpha = 1; }
  drawPulseOrbs(g);
}

// THE NODE: an energy arc wrapped around the monolith band, bounded by two
// machined bus-bars — a living sector of the ring itself. Its span IS the
// zap window (ARCFX.span · tolVis), so what glows is exactly what covers.
// Design + tuning were locked in the arc lab; ARCFX above is the record.
function drawArcNode(n, g, i, rb, fused, bh) {
  const a = n.angle;
  const col = fused ? '160,240,255' : NODE_COLS[i];
  const hex = fused ? '#a0f0ff' : NODE_HEX[i];
  const zapK = clamp(n.recoil || 0, 0, 1);        // discharge flare (recoil decays fast)
  let spanK = 1, energyK = 1;
  if (rb > 0.88)      spanK = lerp(1, 0.045, smoothT((1 - rb) / 0.12));   // the snap
  else if (rb > 0.45) spanK = 0.045;                                      // dead sliver
  else if (rb > 0.1) {                                                    // regrowth, slight overshoot
    const gt = (0.45 - rb) / 0.35;
    const eb = 1 + 2.70158 * Math.pow(gt - 1, 3) + 1.70158 * Math.pow(gt - 1, 2);
    spanK = 0.045 + 0.955 * eb;
  }
  if (rb > 0.1)     energyK = 0;                                          // grown but cold
  else if (rb > 0)  energyK = smoothT((0.1 - rb) / 0.1) * (0.35 + 0.65 * Math.random()); // ignition sputter
  const span = ARCFX.span * tolVis * (fused ? 1.5 : 1) * Math.max(spanK, 0.04);
  // energy breathes at idle, surges when hostiles near this sector, dips on a zap
  let th = 0;
  if (state === S.PLAY || state === S.PAUSE) {
    for (const en of enemies) {
      if (en.dead || en.resolved || en.failed || en.type === 'frag' || en.type === 'strip') continue;
      const near = clamp(1 - Math.abs(angDiff(en.angle, a)) / 1.1, 0, 1) *
                   clamp((0.7 - en.z) / 0.7 + 0.35, 0, 1);
      if (near > th) th = near;
    }
  }
  const dipK = ARCFX.dip * smoothT(clamp(n.dip || 0, 0, 1));
  const L = clamp((1 - dipK) * (1 + ARCFX.breath * 0.4 * Math.sin(time * 2.1 + i * 2.1))
    + th * 0.25 + zapK, 0.15, 1.6) * ARCFX.energy * energyK * (n.held ? 1.15 : 1)
    * (volley.charge > 0.02 ? 1 - clamp(volley.charge / 0.5, 0, 1) * 0.4 : 1); // draining into the volley
  const barA = bh * ARCFX.barW * 0.6 / g.nodeR;   // bars eat a little of the span
  const ea0 = a - span, ea1 = a + span;
  const ia0 = ea0 + barA, ia1 = ea1 - barA;       // the live sector between the bars
  const live = L > 0.05 && ia1 - ia0 > 0.012;     // collapsed or cold: no plasma to draw
  // wake: a sliding arc smears its energy along the band
  const tl = clamp(Math.abs(n.trailV) * 10, 0, 1.2);
  if (tl > 0.04 && live) {
    const dir = Math.sign(n.trailV) || 1;
    ctx.lineCap = 'round';
    ctx.strokeStyle = `rgba(${col},0.18)`;
    ctx.lineWidth = bh * 1.4;
    ctx.beginPath(); ctx.arc(g.cx, g.cy, g.nodeR, a - dir * (span + tl), a - dir * span, dir < 0); ctx.stroke();
  }
  if (live) {
    // surface wash + escaping halo: the band's metal glows under the plasma
    ctx.lineCap = 'butt';
    ctx.strokeStyle = `rgba(${col},${clamp(0.10 * L, 0, 0.5).toFixed(3)})`;
    ctx.lineWidth = bh * 1.9;
    ctx.beginPath(); ctx.arc(g.cx, g.cy, g.nodeR, ia0, ia1); ctx.stroke();
    ctx.strokeStyle = `rgba(${col},${clamp(0.16 * L, 0, 0.7).toFixed(3)})`;
    ctx.lineWidth = bh * 0.9;
    ctx.beginPath(); ctx.arc(g.cx, g.cy, g.nodeR, ia0, ia1); ctx.stroke();
    ctx.strokeStyle = `rgba(${col},${clamp(0.05 * L, 0, 0.3).toFixed(3)})`;
    ctx.lineWidth = bh * 3.1;
    ctx.beginPath(); ctx.arc(g.cx, g.cy, g.nodeR, ia0, ia1); ctx.stroke();
    // filaments: live electricity crawling bar-to-bar around the band
    ctx.lineCap = 'round';
    const NF = lowFX ? 4 : ARCFX.fils, SEGS = lowFX ? 12 : 18;
    for (let f = 0; f < NF; f++) {
      const hot = f === 0;                        // one white-hot lead filament
      ctx.strokeStyle = hot
        ? `rgba(255,255,255,${clamp((0.5 + zapK * 0.5) * Math.min(1, L), 0, 1).toFixed(2)})`
        : `rgba(${col},${clamp((0.3 + 0.25 * Math.random()) * Math.min(1, L), 0, 0.9).toFixed(2)})`;
      ctx.lineWidth = hot ? Math.max(1.2, bh * 0.07) : Math.max(1, bh * 0.05);
      ctx.beginPath();
      for (let k = 0; k <= SEGS; k++) {
        const q = k / SEGS;
        const ang = ia0 + (ia1 - ia0) * q;
        const pinch = Math.sin(q * Math.PI);      // filaments meet the bars cleanly
        const frq = 6 + f * 2.6 + arcHash(f) * 3; // each filament owns its waveform
        const wob = Math.sin(q * span * 14 * frq / 7 + time * (5 + f * 1.7) + f * 2.3 + i * 2.1)
          * bh * ARCFX.wobble * pinch * (0.55 + arcHash(f + 9) * 0.7)
          + (Math.random() - 0.5) * bh * 0.14 * pinch * (1 + zapK * 2);
        const rr = g.nodeR + wob;
        k ? ctx.lineTo(g.cx + Math.cos(ang) * rr, g.cy + Math.sin(ang) * rr)
          : ctx.moveTo(g.cx + Math.cos(ang) * rr, g.cy + Math.sin(ang) * rr);
      }
      ctx.stroke();
    }
    // stray sparks flick off an agitated arc
    if (state === S.PLAY && !lowFX && Math.random() < 0.08 + th * 0.25 + zapK * 0.4) {
      const sa2 = rand(ia0, ia1);
      particles.push({
        x: g.cx + Math.cos(sa2) * (g.nodeR + rand(-bh, bh)),
        y: g.cy + Math.sin(sa2) * (g.nodeR + rand(-bh, bh)),
        vx: rand(-1, 1), vy: rand(-1, 1), life: rand(0.15, 0.35), decay: 3,
        color: hex, size: rand(0.8, 1.6) });
    }
    // wide-arc overcharge: the golden shimmer rides the arc's outer edge
    const wideGlow = clamp((tolVis - 1) / 0.7, 0, 1);
    if (wideGlow > 0.02 && !fused) {
      ctx.strokeStyle = `rgba(255,210,74,${(wideGlow * (0.35 + Math.sin(time * 6) * 0.15)).toFixed(2)})`;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(g.cx, g.cy, g.nodeR + bh * 1.35, ia0, ia1); ctx.stroke();
    }
    // fingertip grip (immersive scheme): hairline rails bracket the held arc
    if (n.held) {
      ctx.strokeStyle = `rgba(${col},${(0.4 + Math.sin(time * 5) * 0.12).toFixed(2)})`;
      ctx.lineWidth = 1.4;
      for (const rr3 of [g.nodeR - bh * 1.25, g.nodeR + bh * 1.25]) {
        ctx.beginPath(); ctx.arc(g.cx, g.cy, rr3, ea0, ea1); ctx.stroke();
      }
    }
  }
  // the bus-bars: machined metal ends that BIND the arc — radial bars laid
  // across the band, lit by the same world key light as the monolith
  for (const se of [-1, 1]) {
    const ea = se < 0 ? ea0 : ea1;
    const key = 0.3 + 0.7 * Math.pow(0.5 + 0.5 * Math.cos(ea - LIGHT_A), 2);
    const bw = bh * ARCFX.barW;                   // tangent width
    const ov = bh * 0.32;                         // radial overhang past the band
    ctx.save();
    ctx.translate(g.cx + Math.cos(ea) * g.nodeR, g.cy + Math.sin(ea) * g.nodeR);
    ctx.rotate(ea);                               // +x = radially outward
    // cast shadow onto the band, away from the key light
    const lightLocal = LIGHT_A - ea;
    ctx.save();
    ctx.translate(Math.cos(lightLocal + Math.PI) * 2.5, Math.sin(lightLocal + Math.PI) * 2.5);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(-bh - ov, -bw / 2, (bh + ov) * 2, bw);
    ctx.restore();
    // bar body: dark machined steel, crowned like the ring's cross-section
    const bg2 = ctx.createLinearGradient(-bh - ov, 0, bh + ov, 0);
    bg2.addColorStop(0,    arcGun(14));
    bg2.addColorStop(0.28, arcGun(26 + 34 * key));
    bg2.addColorStop(0.5,  arcGun(38 + 30 * key));
    bg2.addColorStop(0.72, arcGun(22 + 20 * key));
    bg2.addColorStop(1,    arcGun(12));
    ctx.fillStyle = bg2;
    ctx.beginPath(); ctx.roundRect(-bh - ov, -bw / 2, (bh + ov) * 2, bw, bw * 0.18); ctx.fill();
    // machined edge highlight on the lit flank + bolt heads on the overhangs
    ctx.strokeStyle = `rgba(225,235,255,${(0.06 + 0.16 * key).toFixed(3)})`;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(-bh - ov + 2, -bw / 2 + 0.8); ctx.lineTo(bh + ov - 2, -bw / 2 + 0.8); ctx.stroke();
    ctx.fillStyle = arcGun(30 * key + 12);
    for (const sx of [-1, 1]) {
      ctx.beginPath(); ctx.arc(sx * (bh + ov - bw * 0.32), 0, bw * 0.14, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.arc(sx * (bh + ov - bw * 0.32), 0, bw * 0.14, 0, TAU); ctx.stroke();
    }
    // emissive inner face: the electrode edge the arc is born from
    const fy = -se * bw / 2;                      // the face looking INTO the arc
    ctx.strokeStyle = `rgba(${col},${clamp(0.55 * L + zapK * 0.45, 0, 1).toFixed(2)})`;
    ctx.lineWidth = Math.max(1.4, bw * 0.13);
    ctx.beginPath(); ctx.moveTo(-bh * 0.85, fy); ctx.lineTo(bh * 0.85, fy); ctx.stroke();
    ctx.strokeStyle = `rgba(255,255,255,${clamp(0.35 * L + zapK * 0.6, 0, 1).toFixed(2)})`;
    ctx.lineWidth = Math.max(0.8, bw * 0.05);
    ctx.beginPath(); ctx.moveTo(-bh * 0.6, fy); ctx.lineTo(bh * 0.6, fy); ctx.stroke();
    // contact glow pooling where the plasma meets the electrode
    const cg = ctx.createRadialGradient(0, fy, 0, 0, fy, bh * 0.8);
    cg.addColorStop(0, `rgba(${col},${clamp(0.3 * L + zapK * 0.4, 0, 0.8).toFixed(2)})`);
    cg.addColorStop(1, `rgba(${col},0)`);
    ctx.fillStyle = cg;
    ctx.beginPath(); ctx.arc(0, fy, bh * 0.8, 0, TAU); ctx.fill();
    // fried: the electrode smolders amber, strengthening as the reboot completes
    if (rb > 0) {
      const emb = (0.18 + (1 - rb) * 0.4) * (Math.random() < 0.12 ? 1.8 : 1);
      ctx.strokeStyle = `rgba(255,180,120,${clamp(emb, 0, 0.9).toFixed(2)})`;
      ctx.lineWidth = Math.max(1, bw * 0.08);
      ctx.beginPath(); ctx.moveTo(-bh * 0.7, fy); ctx.lineTo(bh * 0.7, fy); ctx.stroke();
    }
    ctx.restore();
    // the discharge leaps from the bars — remember their world positions
    const wt = { x: g.cx + Math.cos(ea) * g.nodeR, y: g.cy + Math.sin(ea) * g.nodeR };
    if (se < 0) n.tipA = wt; else n.tipB = wt;
  }
  // collapsed: a weak amber ember arcs across the gap, sputtering. It rides the
  // BAND rather than the chord — walked in ANGLE from bar to bar at the rail's
  // own radius, so as the bars part during the reboot the ember bends with the
  // ring instead of cutting a straight line across the bore.
  if (rb > 0.1 && rb < 0.88) {
    if (Math.random() < 0.55) {
      ctx.strokeStyle = `rgba(255,180,120,${rand(0.25, 0.55).toFixed(2)})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      const EQ = 6; // enough segments that a wide gap still reads as a curve
      for (let q = 0; q <= EQ; q++) {
        const t2 = q / EQ;
        const ang = ea0 + (ea1 - ea0) * t2;
        const jit = q && q < EQ ? rand(-2, 2) : 0; // the ends stay welded to the electrodes
        const rr4 = g.nodeR + jit;
        const ex = g.cx + Math.cos(ang) * rr4, ey = g.cy + Math.sin(ang) * rr4;
        q ? ctx.lineTo(ex, ey) : ctx.moveTo(ex, ey);
      }
      ctx.stroke();
    }
    if (state === S.PLAY && Math.random() < 0.2) particles.push({
      x: g.cx + Math.cos(a) * g.nodeR + rand(-3, 3), y: g.cy + Math.sin(a) * g.nodeR + rand(-3, 3),
      vx: rand(-0.8, 0.8), vy: rand(-0.8, 0.8), life: rand(0.2, 0.45), decay: 2.6,
      color: '#ffb478', size: rand(0.8, 1.5) });
  }
}

// the unite-volley releases: a focused bolt from the docked nodes
function fireVolley(g) {
  const reach = SPAWN_Z; // the bolt runs the whole tunnel
  volley.charge = 0;
  volley.cd = 1.25; // re-charge gap — shooting crowds is worse than zapping them
  const a = volley.aimA !== undefined ? volley.aimA
    : nodes[0].angle + angDiff(nodes[1].angle, nodes[0].angle) / 2;
  const sh = { a, z: g.hitZ, reach, dead: false };
  if (boss && boss.introT >= BOSS_CER && boss.dying === undefined) {
    sh.homing = true; sh.t = 0; // the duel bolt hunts the core itself
    const railR = g.nodeR - Math.min(W, H) * 0.055 * 0.86;
    sh.sx0 = g.cx + Math.cos(a) * railR; sh.sy0 = g.cy + Math.sin(a) * railR;
    if (boss.kind === 'triad') { // the bolt answers to the AIM: nearest body wins
      const c = nearestTriadCore(a);
      sh.coreI = c ? c.i : 0;
    }
  }
  volley.shots.push(sh);
  for (const n of nodes) { n.recoil = 1; n.dip = 1; }
  const hx = g.cx + Math.cos(a) * g.nodeR, hy = g.cy + Math.sin(a) * g.nodeR;
  burst(hx, hy, '#bfeaff', 20, 5);
  burst(hx, hy, '#ffffff', 12, 6);
  if (!playSample('volley')) {
    tone(1900, 0.03, 'square', 0.09);   // capacitor snap
    crackle(0.22, 2400, 400, 2, 0.6);   // discharge
    tone(90, 0.15, 'sine', 0.14, 55);   // sub kick
  }
  // both hands held the dock — both feel the snap. Unless the lane is EMPTY:
  // parked nodes auto-dock and auto-fire forever, and a volley into nothing is
  // scenery — the pad mutes (fx zeros), the phone keeps its familiar tick.
  buzz([15, 10, 25], (boss || enemies.some(e => !e.dead && !e.resolved))
    ? { strong: 0.5, weak: 0.9 } : { strong: 0, weak: 0 });
}
// charge halo + the bolt comet riding the bore
function drawVolley(g) {
  if (volley.charge > 0.02) {
    const a = volley.aimA !== undefined ? volley.aimA
      : nodes[0].angle + angDiff(nodes[1].angle, nodes[0].angle) / 2;
    const q = volley.charge / 0.5; // 0..1 through the half-second charge
    const bh = Math.min(W, H) * 0.055 * ARCFX.bandW;
    const fusedV = boss && boss.mergeT >= 1;
    // the charge condenses IN the band: both docked arcs pour into a
    // white-hot core sector growing out of the aim point — when it fills
    // the arc window, the bolt flies (the in-world progress read)
    const segHalf = Math.max(0.02, ARCFX.span * tolVis * (fusedV ? 1.5 : 1) * 0.85 * q);
    ctx.lineCap = 'round';
    for (const [lw, colr, al] of [
      [bh * 2.6, '140,225,255', 0.10 + q * 0.16],
      [bh * 1.1, '140,225,255', 0.22 + q * 0.4],
      [bh * 0.4, '255,255,255', 0.3 + q * 0.65],
    ]) {
      ctx.strokeStyle = `rgba(${colr},${al.toFixed(2)})`;
      ctx.lineWidth = lw;
      ctx.beginPath(); ctx.arc(g.cx, g.cy, g.nodeR, a - segHalf, a + segHalf); ctx.stroke();
    }
    // crackle feeders: every electrode discharges into the growing core
    for (const n of (fusedV ? [nodes[0]] : nodes)) {
      for (const [tip, sN] of [[n.tipA, -1], [n.tipB, 1]]) {
        if (!tip || Math.random() > 0.3 + q * 0.5) continue;
        const end = a + sN * segHalf;
        const ex = g.cx + Math.cos(end) * g.nodeR, ey = g.cy + Math.sin(end) * g.nodeR;
        ctx.strokeStyle = `rgba(190,235,255,${(0.3 + q * 0.5).toFixed(2)})`;
        ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(tip.x, tip.y);
        for (let k2 = 1; k2 < 5; k2++) {
          const t2 = k2 / 5;
          ctx.lineTo(lerp(tip.x, ex, t2) + rand(-3, 3), lerp(tip.y, ey, t2) + rand(-3, 3));
        }
        ctx.lineTo(ex, ey); ctx.stroke();
      }
    }
    if (Math.random() < q * 0.7) // gathering sparks at the core
      burst(g.cx + Math.cos(a) * g.nodeR, g.cy + Math.sin(a) * g.nodeR, '#8fe0ff', 2, 2.5);
  }
  for (const sh of volley.shots) {
    if (sh.dead) continue;
    let x, y, s;
    if (sh.homing && boss) { // screen-space sprint to its core (triad: the aimed body)
      const tc = boltTargetCore(sh);
      const e = sh.t * sh.t;
      x = lerp(sh.sx0, tc.sx, e); y = lerp(sh.sy0, tc.sy, e);
      s = 1 - sh.t * 0.5;
    } else {
      const rg = ring(sh.z, g);
      x = rg.x + Math.cos(sh.a) * rg.r; y = rg.y + Math.sin(sh.a) * rg.r;
      s = rg.s * 3;
    }
    const br = Math.max(3, Math.min(W, H) * 0.02 * s);
    const bg2 = ctx.createRadialGradient(x, y, 0, x, y, br * 2.6);
    bg2.addColorStop(0, 'rgba(255,255,255,0.95)');
    bg2.addColorStop(0.4, 'rgba(140,225,255,0.6)');
    bg2.addColorStop(1, 'rgba(140,225,255,0)');
    ctx.fillStyle = bg2;
    ctx.beginPath(); ctx.arc(x, y, br * 2.6, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(x, y, br * 0.55, 0, TAU); ctx.fill();
    if (!sh.homing) { // wavefront arc hugging the wall at the bolt's depth
      const rg = ring(sh.z, g);
      ctx.strokeStyle = 'rgba(140,225,255,0.7)';
      ctx.lineWidth = Math.max(1.5, 4 * rg.s * 3);
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(g.cx, g.cy, rg.r, sh.a - 0.22, sh.a + 0.22); ctx.stroke();
    }
  }
}

// PAD FEEDBACK STATE — render-only, decayed on the UI clock inside
// drawPulseOrbs, so the sim, the trace and the verifier never see it.
//   bank  1 -> 0   a kick each time charge lands: the meniscus flashes and an
//                  inward ripple is swallowed — energy ARRIVING
//   fire  1 -> 0   the send-off: the vessel drains and a ring leaves,
//                  instead of the old cut from full to nothing
//   vis            the DISPLAYED fill level, chasing the true one — the lag
//                  is what turns each bank into a pour instead of a jump
let pulseFx = [{ bank: 0, fire: 0, vis: 0 }, { bank: 0, fire: 0, vis: 0 }];
// a ready orb tapped: unleash that node's wave from the ring into the deep
function firePulse(i) {
  if (traceRec) traceFireQ.push(i); // record the tap; on replay traceApply re-fires it
  pulseCharge[i] = 0;
  pulseFx[i].fire = 1; // the vessel drains on this clock — see drawPulseOrbs
  pulseWaves.push({ z: geo().hitZ, kills: 0, i, col: i === 0 ? NODE_COLS[0] : '240,248,255' });
  shake = Math.min(shake + 0.7, 1);
  sfx.pulseFire();
  buzz([30, 30, 90], { side: i, strong: 0.9, weak: 0.6 }); // the firing hand's trigger
  if (tut && tut.spawned === 'pulse' && !tut.fired) { // the hold releases
    tut.fired = true; tut.frozen = false; tut.t = 0;
    tone(90, 0.5, 'sine', 0.08, 660); // tape-warp back up: the run breathes again
  }
}
// the wave: a white-hot front racing down the tunnel, dragging a glowing wake
// that fills the whole cave behind it
function drawPulseWave(g) {
  for (const wv of pulseWaves) {
    const a = clamp(1.25 - wv.z, 0.15, 1);
    ctx.lineCap = 'round';
    // wake: rings trailing from the front back toward the player, melting away
    for (let k = 5; k >= 1; k--) {
      const zT = wv.z - k * 0.055;
      if (zT <= g.hitZ * 0.8) continue;
      const rt = ring(zT, g);
      const ka = a * (1 - k / 6) * 0.3;
      ctx.lineWidth = Math.max(2, (14 + k * 7) * rt.s * 3);
      ctx.strokeStyle = `rgba(${wv.col},${ka.toFixed(2)})`;
      ctx.beginPath(); ctx.arc(rt.x, rt.y, rt.r, 0, TAU); ctx.stroke();
    }
    // front: layered hot ring + a forward glow washing the cave ahead
    const rg = ring(wv.z, g);
    const fg = ctx.createRadialGradient(rg.x, rg.y, rg.r * 0.35, rg.x, rg.y, rg.r * 1.15);
    fg.addColorStop(0, 'rgba(0,0,0,0)');
    fg.addColorStop(0.85, `rgba(${wv.col},${(a * 0.16).toFixed(2)})`);
    fg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = fg;
    ctx.beginPath(); ctx.arc(rg.x, rg.y, rg.r * 1.2, 0, TAU); ctx.fill();
    for (const [w2, col] of [
      [22, `rgba(${wv.col},${(a * 0.3).toFixed(2)})`],
      [9, `rgba(${wv.col},${(a * 0.7).toFixed(2)})`],
      [3, `rgba(255,255,255,${(a * 0.95).toFixed(2)})`]
    ]) {
      ctx.lineWidth = Math.max(1, w2 * rg.s * 3);
      ctx.strokeStyle = col;
      ctx.beginPath(); ctx.arc(rg.x, rg.y, rg.r, 0, TAU); ctx.stroke();
    }
  }
}
// THE PULSE VESSEL — an empty circle in each pad core that fills with its
// emitter's energy, Gil's redesign of the whole charge readout. The old thin
// progress ring plus a growing orb told the truth but taught nothing; a
// visible EMPTY vessel is the button, on screen from the first frame, so the
// player knows the shape of the thing they will eventually press. Charge
// pours in as a rising fill with a lit meniscus — and the rise is EASED, so
// each bank is a pour, not a jump of the needle.
//
// Feedback beats, all render-only:
//   · BANK — the fill rises to its new level, the meniscus flashes, and a
//     ripple is swallowed into the vessel. Inward, because energy is arriving.
//   · READY — the vessel runs white-hot, and the energy wants OUT: a corona
//     strains past the pad rim, pressure points wander the rim and flare, and
//     rim waves push outward. Glow and mass only — no grain, no linework.
//   · FIRE — the vessel DRAINS on the fire clock while one bright ring
//     carries the energy off toward the bore. It used to cut to nothing
//     between two frames, a pop at the player's most powerful moment.
function drawPulseOrbs(g) {
  if (boss) return; // the duel owns the pads
  const fdt = typeof frameDt === 'number' ? frameDt : 0;
  for (let i = 0; i < 2; i++) {
    const fx2 = pulseFx[i];
    fx2.bank = Math.max(0, fx2.bank - fdt / 0.32);
    fx2.fire = Math.max(0, fx2.fire - fdt / 0.34);
    const frac = clamp(pulseCharge[i] / PULSE_MAX, 0, 1);
    // the displayed level chases the true one — this lag IS the pour. On fire
    // it rides the fire clock down instead, so the drain and the send-off ring
    // are one motion.
    if (fx2.fire > 0.01 && frac <= 0.02) fx2.vis = Math.min(fx2.vis, fx2.fire);
    else fx2.vis += (frac - fx2.vis) * Math.min(1, fdt * 5.5);
    const vis = clamp(fx2.vis, 0, 1);
    const d = dialCenter(i === 0 ? 'L' : 'R');
    const col = NODE_COLS[i];
    const ready = frac >= 1;
    // READY: the energy wants out. Everything here lives OUTSIDE the meter,
    // around the pad, and everything is soft light under pressure.
    if (ready) {
      const bz2 = Math.min(W, H) * 0.055;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      // the corona: an aura past the pad rim whose reach TREMBLES on two
      // incommensurate rates — a contained thing pushing at its container
      const strain = 1.16 + 0.055 * Math.sin(time * 5.3 + i) + 0.04 * Math.sin(time * 7.7 + i * 2.1);
      const cor = ctx.createRadialGradient(d.x, d.y, d.r * 0.92, d.x, d.y, d.r * strain + bz2);
      cor.addColorStop(0, `rgba(${col},0)`);
      cor.addColorStop(0.45, `rgba(${col},${(0.13 + 0.05 * Math.sin(time * 3.1 + i)).toFixed(3)})`);
      cor.addColorStop(1, `rgba(${col},0)`);
      ctx.fillStyle = cor;
      ctx.beginPath(); ctx.arc(d.x, d.y, d.r * strain + bz2, 0, TAU); ctx.fill();
      // pressure points: three soft hotspots wandering the rim, each flaring
      // on its own phase — the crack about to happen, never happening
      for (let k = 0; k < 3; k++) {
        const wob = Math.sin(time * 0.6 + k * 2.1 + i * 1.3) * 0.5;
        const pa = i * 1.3 + k / 3 * TAU + time * 0.35 + wob;
        const flare = Math.pow(0.5 + 0.5 * Math.sin(time * 6.3 + k * 2.6 + i * 3.1), 3);
        if (flare < 0.03) continue;
        const hx = d.x + Math.cos(pa) * d.r * 1.04, hy = d.y + Math.sin(pa) * d.r * 1.04;
        const hr = bz2 * (1.1 + flare * 0.8);
        const hg = ctx.createRadialGradient(hx, hy, 0, hx, hy, hr);
        hg.addColorStop(0, `rgba(${col},${(0.30 * flare).toFixed(3)})`);
        hg.addColorStop(0.5, `rgba(${col},${(0.12 * flare).toFixed(3)})`);
        hg.addColorStop(1, `rgba(${col},0)`);
        ctx.fillStyle = hg;
        ctx.beginPath(); ctx.arc(hx, hy, hr, 0, TAU); ctx.fill();
      }
      ctx.restore();
      // rim waves: pressure escaping in rings off the pad edge
      const k2 = (time * 0.9 + i * 0.5) % 1;
      ctx.strokeStyle = `rgba(${col},${(0.45 * (1 - k2)).toFixed(2)})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(d.x, d.y, d.r * (1.02 + k2 * 0.26), 0, TAU); ctx.stroke();
    }
    // THE BAR, back by request — the ring meter was the right readout all
    // along; it was just thin and it jumped. Now it is THICK, the track is
    // visible from the first frame (the empty gauge is how the button teaches
    // itself), and the sweep chases the true level through fx2.vis — every
    // bank is a pour along the arc, not a step. A glowing tip rides the
    // leading edge, because the growing end IS the thing to watch.
    const rm = d.r * 0.44;
    const lw = Math.max(7, d.r * 0.085);
    ctx.lineCap = 'round';
    ctx.strokeStyle = `rgba(${col},0.22)`;
    ctx.lineWidth = lw;
    ctx.beginPath(); ctx.arc(d.x, d.y, rm, 0, TAU); ctx.stroke();
    if (vis > 0.004) {
      const a1 = -Math.PI / 2 + vis * TAU;
      ctx.strokeStyle = `rgba(${col},${(ready ? 0.95 : 0.62 + 0.28 * fx2.bank).toFixed(2)})`;
      ctx.lineWidth = lw + fx2.bank * 3;
      ctx.beginPath(); ctx.arc(d.x, d.y, rm, -Math.PI / 2, a1); ctx.stroke();
      // the tip: a hot head on the leading edge — white while a bank lands,
      // the emitter's colour between
      const tg2 = ctx.createRadialGradient(
        d.x + Math.cos(a1) * rm, d.y + Math.sin(a1) * rm, 0,
        d.x + Math.cos(a1) * rm, d.y + Math.sin(a1) * rm, lw * (1.3 + fx2.bank * 0.8));
      tg2.addColorStop(0, `rgba(255,255,255,${(0.5 + 0.45 * fx2.bank).toFixed(2)})`);
      tg2.addColorStop(0.4, `rgba(${col},${(0.35 + 0.3 * fx2.bank).toFixed(2)})`);
      tg2.addColorStop(1, `rgba(${col},0)`);
      ctx.fillStyle = tg2;
      ctx.beginPath();
      ctx.arc(d.x + Math.cos(a1) * rm, d.y + Math.sin(a1) * rm, lw * (1.3 + fx2.bank * 0.8), 0, TAU);
      ctx.fill();
    }
    // READY: a compact core lights at the centre — the thing the tutorial
    // says to tap. Small on purpose; the meter and the straining pad carry
    // the state, the core is the target.
    if ((ready || fx2.fire > 0.01) && !(frac <= 0.02 && fx2.fire <= 0.01)) {
      const cq = ready ? 1 : fx2.fire;
      const cr = d.r * 0.11 * (1 + 0.1 * Math.sin(time * 6 + i)) * cq;
      const cg2 = ctx.createRadialGradient(d.x, d.y, 0, d.x, d.y, cr * 2.6);
      cg2.addColorStop(0, `rgba(255,255,255,${(0.95 * cq).toFixed(2)})`);
      cg2.addColorStop(0.4, `rgba(${col},${(0.6 * cq).toFixed(2)})`);
      cg2.addColorStop(1, `rgba(${col},0)`);
      ctx.fillStyle = cg2;
      ctx.beginPath(); ctx.arc(d.x, d.y, cr * 2.6, 0, TAU); ctx.fill();
    }
    // THE BANK RIPPLE — the heartbeat, kept: a ring swallowed into the meter
    // as the kick decays
    if (fx2.bank > 0.01) {
      const q = fx2.bank;
      ctx.strokeStyle = `rgba(${col},${(0.65 * (1 - q * 0.4)).toFixed(2)})`;
      ctx.lineWidth = 2 + 2.5 * q;
      ctx.beginPath(); ctx.arc(d.x, d.y, rm * (1.05 + q * 0.9), 0, TAU); ctx.stroke();
    }
    // THE SEND-OFF: the meter unwinds on the fire clock (vis rides it above)
    // while one bright ring carries the energy off toward the bore
    if (fx2.fire > 0.01 && frac <= 0.02) {
      const q = fx2.fire;
      ctx.strokeStyle = `rgba(${col},${(0.7 * q).toFixed(2)})`;
      ctx.lineWidth = 2.5 + 2 * q;
      ctx.beginPath(); ctx.arc(d.x, d.y, rm * (0.5 + (1 - q) * 1.6), 0, TAU); ctx.stroke();
    }
  }
}

// awaiting operator: the per-pad prompt. Amber and breathing until that thumb lands,
// green and steady once it has. Drawn on the DORMANT console while the run is parked —
// the pads are the only thing on screen the player can act on, so the ask belongs on
// them — and again at the far end of the boot for the gamepad's two-stick grip.
function drawPadPrompt(i, d, tut) {
  const okI = padHold[i];
  // THE TARGET: a breathing dot on the RIM, on the side facing the BORE.
  //
  // On the rim rather than in the middle because the rim is what a dial is steered by, and
  // a touch on the pad is ABSOLUTE — the node jumps to whatever angle the finger lands on,
  // so any point works mechanically and the dot's only job is to be obvious.
  //
  // Which is why it is not at nodes[i].angle, which was the first thing I tried: resetLevel
  // parks both angles pointing down-frame and the pads live in the bottom corners, so that
  // rim point sits half off the screen. Aimed at the bore it is always fully in frame, and
  // it draws the line between the pad and the ring it drives.
  //
  // Breath + sonar ping together: the breath says "alive", the outward rings say "touch".
  // A pulse on its own reads as a status light.
  if (!okI) {
    // THE GESTURE, ANIMATED OUTWARD. A dot travels from the pad's middle out to the rim
    // and away from the bore, looping — and because the two pads sit either side of the
    // screen, the two dots visibly move in OPPOSITE directions, which is the shape of
    // the thing the gate actually wants.
    //
    // The static version aimed a breathing dot AT the bore. For touch that was fine — a
    // pad tap is absolute, so any rim point works and the dot only had to be obvious.
    // For a controller it said nothing: the gamepad gate needs the two sticks pointing
    // roughly APART (see 71-gamepad), and a still dot communicates a place to press, not
    // a direction to push. Measured, the gate does not care WHICH way — both-inward and
    // both-outward are the same 2.8 rad apart on every plausible frame, since adding pi
    // to both bearings preserves their separation. So this is a legibility fix, not a
    // rule change: it shows one gesture that works instead of implying a press a stick
    // cannot perform.
    const gp = geo();
    const away = Math.atan2(d.y - gp.cy, d.x - gp.cx);   // away from the bore, per pad
    const ca = Math.cos(away), sa = Math.sin(away);
    const br = 0.5 + 0.5 * Math.sin(time * 3.2);
    const r0 = d.r * 0.14, r1 = d.r * 1.16;              // from the hub, out past the rim
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    // the track the gesture runs along, so the direction reads even between pulses
    ctx.strokeStyle = 'rgba(255,205,80,0.20)';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 5]);
    ctx.beginPath();
    ctx.moveTo(d.x + ca * r0, d.y + sa * r0);
    ctx.lineTo(d.x + ca * r1, d.y + sa * r1);
    ctx.stroke();
    ctx.setLineDash([]);
    // two travellers half a cycle apart — one is always in flight. A single pulse spends
    // a third of its loop invisible, which reads as a flicker rather than as a move.
    const RUN = 1.15;
    for (const ph of [(time / RUN) % 1, ((time / RUN) + 0.5) % 1]) {
      const e = ph * ph * (3 - 2 * ph);                  // eases out gently, arrives fast
      const rr = r0 + (r1 - r0) * e;
      const fx3 = d.x + ca * rr, fy3 = d.y + sa * rr;
      const fade = Math.sin(Math.min(1, ph / 0.86) * Math.PI);
      if (fade < 0.02) continue;
      // a comet: the trail behind it is what makes the direction unmistakable
      const back = Math.max(r0, rr - d.r * 0.5);
      const tg = ctx.createLinearGradient(d.x + ca * back, d.y + sa * back, fx3, fy3);
      tg.addColorStop(0, 'rgba(255,196,60,0)');
      tg.addColorStop(1, 'rgba(255,224,140,' + (0.42 * fade).toFixed(2) + ')');
      ctx.strokeStyle = tg;
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(d.x + ca * back, d.y + sa * back);
      ctx.lineTo(fx3, fy3);
      ctx.stroke();
      const hg = ctx.createRadialGradient(fx3, fy3, 0, fx3, fy3, 22);
      hg.addColorStop(0, 'rgba(255,232,166,' + (0.62 * fade).toFixed(2) + ')');
      hg.addColorStop(1, 'rgba(255,190,60,0)');
      ctx.fillStyle = hg;
      ctx.beginPath(); ctx.arc(fx3, fy3, 22, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,252,238,' + (0.92 * fade).toFixed(2) + ')';
      ctx.beginPath(); ctx.arc(fx3, fy3, 4.6, 0, TAU); ctx.fill();
    }
    // the destination: a breathing mark on the rim where the push ends up
    const ex3 = d.x + ca * d.r, ey3 = d.y + sa * d.r;
    ctx.strokeStyle = 'rgba(255,214,90,' + (0.30 + br * 0.34).toFixed(2) + ')';
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(ex3, ey3, 8 + br * 3, 0, TAU); ctx.stroke();
    ctx.restore();
  }
  ctx.strokeStyle = okI ? 'rgba(126,226,98,0.9)'
    : `rgba(255,210,74,${(0.45 + Math.sin(time * 5) * 0.3).toFixed(2)})`;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(d.x, d.y, d.r + 9, 0, TAU); ctx.stroke();
  ctx.textAlign = 'center';
  ctx.fillStyle = okI ? 'rgba(126,226,98,0.9)' : 'rgba(255,210,74,0.85)';
  ctx.font = '700 10px Audiowide, system-ui';
  ctx.fillText(okI ? 'READY' : 'PUSH OUT', d.x, d.y - d.r - 14);
  ctx.textAlign = 'left';
  // first boot: the gesture ghost already laps the rim, so the pupil learns the
  // thumb motion before the controls are even handed over
  if (tut) drawDialComet(i);
}
function drawDials() {
  const bz = Math.min(W, H) * 0.055; // pad gauge width
  const parked = preLaunch();
  const booting = state === S.PLAY && introT < INTRO_DUR;
  const padsLive = introT >= BOOT_LOCK; // consoles charge the moment the ring docks
  // (no !parked needed: parked pins introT at 0, which is already short of BOOT_LOCK)
  for (let i = 0; i < 2; i++) {
    const side = i === 0 ? 'L' : 'R';
    const d = dialCenter(side);
    const n = nodes[i];
    if (booting && !padsLive) { // dormant console: a dark ring, standing by
      // A TOUCH LIGHTS THE PAD, whatever the emitters are doing.
      //
      // The startup ramp is the ship's business and does not finish until BOOT_ON; the
      // player needs to know their thumb landed NOW. It used to say so with one small
      // green word on a console that stayed dark, which is not an answer to "did that
      // register?" — so the whole gauge ring lights in that emitter's own colour, which
      // is also the colour its arc will be wearing thirty frames later.
      // …and it STAYS lit from the touch straight into the power-up ramp. Gated on
      // padHold alone rather than on `parked`, because a dormant console that lights on
      // contact and then goes dark again for the 1.5s until the ring docks takes back the
      // one piece of feedback the player just earned.
      const armed = padHold[i];
      const col0 = NODE_COLS[i];
      if (armed) {
        ctx.fillStyle = `rgba(${col0},0.10)`;
        ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, TAU); ctx.fill();
      }
      ctx.strokeStyle = armed ? `rgba(${col0},0.8)` : 'rgba(90,120,160,0.22)';
      ctx.lineWidth = bz * 0.85;
      ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, TAU); ctx.stroke();
      ctx.textAlign = 'center';
      ctx.fillStyle = armed ? `rgba(${col0},0.95)` : 'rgba(120,150,185,0.45)';
      ctx.font = '600 9px Audiowide, system-ui';
      ctx.fillText(armed ? 'ARMED' : 'OFFLINE', d.x, d.y + 3);
      ctx.textAlign = 'left';
      if (parked) drawPadPrompt(i, d, tut);
      continue;
    }
    const col = NODE_COLS[i];
    // console boot: power sweeps around the ring while the gauge condenses in,
    // on the same clock as the node reboot ramps
    const pw = booting ? clamp((introT - BOOT_LOCK) / (BOOT_ON - BOOT_LOCK), 0, 1) : 1;
    if (pw < 1) {
      ctx.strokeStyle = 'rgba(90,120,160,0.22)';
      ctx.lineWidth = bz * 0.85;
      ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, TAU); ctx.stroke();
      ctx.lineCap = 'round';
      ctx.strokeStyle = `rgba(${col},0.8)`;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(d.x, d.y, d.r, -Math.PI / 2, -Math.PI / 2 + pw * TAU); ctx.stroke();
      ctx.globalAlpha = 0.15 + 0.85 * pw;
    }
    const ptr = Object.values(pointers).find(q => q.side === side && q.lastA !== undefined);
    const held = !!ptr;
    ctx.lineCap = 'round';
    // radar backing
    ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, TAU);
    ctx.fillStyle = 'rgba(10,20,45,0.35)'; ctx.fill();
    // 360° gauge — the ARCS strips' language wrapped full circle:
    // wide translucent track between two thin rails, compass ticks across it
    ctx.strokeStyle = `rgba(${col},${held ? 0.3 : 0.16})`;
    ctx.lineWidth = bz * 0.85;
    ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, TAU); ctx.stroke();
    ctx.strokeStyle = `rgba(${col},0.4)`;
    ctx.lineWidth = 1.5;
    for (const rr of [d.r - bz * 0.42, d.r + bz * 0.42]) {
      ctx.beginPath(); ctx.arc(d.x, d.y, rr, 0, TAU); ctx.stroke();
    }
    for (let t = 0; t < 8; t++) { // majors at the cardinals, minors between
      const a2 = t / 8 * TAU, wMul = t % 2 === 0 ? 1 : 0.55;
      ctx.strokeStyle = `rgba(${col},${t % 2 === 0 ? 0.5 : 0.28})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(d.x + Math.cos(a2) * (d.r - bz * 0.42 * wMul), d.y + Math.sin(a2) * (d.r - bz * 0.42 * wMul));
      ctx.lineTo(d.x + Math.cos(a2) * (d.r + bz * 0.42 * wMul), d.y + Math.sin(a2) * (d.r + bz * 0.42 * wMul));
      ctx.stroke();
    }
    // boss duel: the right dial is the fire stick — heat ring + aim knob
    const fireStick = boss && boss.mergeT >= 1 && side === 'R';
    if (fireStick) {
      const hcol = heat < 0.5 ? '111,227,255' : heat < 0.8 ? '255,180,80' : '255,70,70';
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(' + hcol + ',' + (overheat ? (Math.sin(time * 12) > 0 ? 0.95 : 0.3) : 0.85).toFixed(2) + ')';
      ctx.lineWidth = 5;
      if (heat > 0.005) {
        ctx.beginPath(); ctx.arc(d.x, d.y, d.r + 7, -Math.PI / 2, -Math.PI / 2 + heat * TAU); ctx.stroke();
      }
      if (overheat) {
        ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,80,80,0.9)'; ctx.font = '700 11px Audiowide, system-ui';
        ctx.fillText('OVERHEAT', d.x, d.y - d.r - 14);
        ctx.textAlign = 'left';
      }
    }
    // thumb — during the duel the right thumb is the stick position itself
    const kx = fireStick ? d.x + beamAim.x * d.r : d.x + Math.cos(n.angle) * d.r;
    const ky = fireStick ? d.y + beamAim.y * d.r : d.y + Math.sin(n.angle) * d.r;
    const ts = bz * (held || fireStick ? 0.4 : 0.3);
    const gl = ctx.createRadialGradient(kx, ky, 0, kx, ky, ts * 2.2);
    gl.addColorStop(0, `rgba(${col},0.6)`);
    gl.addColorStop(1, `rgba(${col},0)`);
    ctx.fillStyle = gl;
    ctx.beginPath(); ctx.arc(kx, ky, ts * 2.2, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgb(' + col + ')'; // the knob wears its PAD's color, both sides
    ctx.beginPath(); ctx.arc(kx, ky, ts, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(240,252,255,0.8)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(kx, ky, ts, 0, TAU); ctx.stroke();
    // virtual extension: a drifted grip re-projects the gauge under the finger —
    // the bigger wheel IS the fine-aim leverage, now visible
    if (held && !fireStick && ptr.px !== undefined) {
      const fr = Math.hypot(ptr.px - d.x, ptr.py - d.y);
      if (fr > d.r + bz * 0.7) {
        const fa = Math.atan2(ptr.py - d.y, ptr.px - d.x);
        ctx.setLineDash([9, 11]);
        ctx.strokeStyle = `rgba(${col},0.22)`;
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(d.x, d.y, fr, 0, TAU); ctx.stroke();
        ctx.setLineDash([]);
        // spoke from the track out to the fingertip
        ctx.strokeStyle = `rgba(${col},0.3)`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(d.x + Math.cos(fa) * (d.r + bz * 0.42), d.y + Math.sin(fa) * (d.r + bz * 0.42));
        ctx.lineTo(d.x + Math.cos(fa) * (fr - ts * 1.3), d.y + Math.sin(fa) * (fr - ts * 1.3));
        ctx.stroke();
        // ghost thumb riding the extended wheel, right under the finger
        ctx.strokeStyle = `rgba(${col},0.75)`;
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(d.x + Math.cos(fa) * fr, d.y + Math.sin(fa) * fr, ts * 0.8, 0, TAU); ctx.stroke();
      }
    }
    if (booting && padsLive) {
      // the sweep completes, THEN the check lights it up
      const flash = introT >= BOOT_ON ? clamp(1 - (introT - BOOT_ON) / 0.4, 0, 1) : 0;
      if (flash > 0) {
        ctx.strokeStyle = `rgba(${col},${(flash * 0.8).toFixed(2)})`;
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(d.x, d.y, d.r + 6, 0, TAU); ctx.stroke();
      }
      // A REMINDER, no longer a gate. The thumbs are what started this boot, so by
      // INTRO_GATE the normal case is two hands already down — prompting them would be
      // noise. It only speaks to a runner who LET GO on the way in, which is the one
      // case where control is about to transfer to nobody.
      if (introT >= INTRO_GATE - 0.01 && !padHold[i]) drawPadPrompt(i, d, tut);
    }
    // radar blips: live enemy positions — angle matches the tunnel, radius =
    // how far along the APPROACH. The old mapping clamped z to [0,1], but an
    // enemy spawns at z 2.1 — so for most of its flight the blip sat frozen
    // near the centre, then "launched" outward in the last stretch, which is
    // exactly the broken read Gil caught. blipQ is the whole journey, spawn
    // to ring, so a blip moves from the moment its enemy does.
    const blipQ = z => clamp((SPAWN_Z - z) / (SPAWN_Z - 0.25), 0, 1);
    const blipXY = en => {
      const rr = d.r * (0.10 + 0.80 * blipQ(en.z));
      return { x: d.x + Math.cos(en.angle) * rr, y: d.y + Math.sin(en.angle) * rr };
    };
    for (const en of enemies) {
      if (en.dead || en.resolved) continue;
      const q3 = blipQ(en.z);
      const { x: bx, y: by } = blipXY(en);
      const bs = (2 + q3 * 4.5) * (en.type === 'heavy' ? 1.5 : 1);
      const urgent = q3 > 0.82 && Math.sin(time * 10) > 0; // blink when close
      const al = urgent || q3 <= 0.82 ? 0.45 + 0.5 * q3 : 0.4;
      // barrier pairs show their wall on the radar too
      if (en.lineLead && en.partner && !en.partner.dead) {
        const p2 = blipXY(en.partner);
        ctx.strokeStyle = `rgba(255,80,110,${al * 0.6})`; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(p2.x, p2.y); ctx.stroke();
      }
      ctx.fillStyle = en.type === 'frag'
        ? `rgba(140,150,170,${al})`
        : en.type === 'heavy'
        ? `rgba(200,80,255,${al})`
        : en.lock === 0
        ? `rgba(80,170,255,${al})`
        : en.lock === 1
        ? `rgba(240,248,255,${al})`
        : `rgba(220,50,50,${al})`;
      ctx.fillRect(bx - bs / 2, by - bs / 2, bs, bs);
    }
    // golden pickup blips — same journey mapping as the hostiles
    for (const p of pickups) {
      if (p.done) continue;
      const { x: gx, y: gy } = blipXY(p);
      ctx.fillStyle = 'rgba(255,210,74,0.9)';
      ctx.beginPath(); ctx.arc(gx, gy, 2 + blipQ(p.z) * 2.5, 0, TAU); ctx.fill();
    }
    // the warden core: oversized blinking blip at its tunnel position
    if (boss) {
      const rr2 = d.r * clamp(boss.rad || 0, 0, 1) * 0.85;
      const bx2 = d.x + Math.cos(boss.ang || 0) * rr2, by2 = d.y + Math.sin(boss.ang || 0) * rr2;
      ctx.fillStyle = Math.sin(time * 8) > 0 ? 'rgba(210,80,255,0.95)' : 'rgba(210,80,255,0.45)';
      const bs2 = 7;
      ctx.fillRect(bx2 - bs2 / 2, by2 - bs2 / 2, bs2, bs2);
    }
    ctx.globalAlpha = 1; // boot condense-in ends with this console
  }
  // tutorial pad ghosts, LAST — over the finished dial, or the chrome buries them
  if (typeof tutDescNow !== 'undefined' && tutDescNow && tutDescNow.ghosts.length)
    drawTutPadGhosts(tutDescNow);
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
