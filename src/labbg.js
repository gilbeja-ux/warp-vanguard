'use strict';
// The game's tunnel background, extracted for the FX labs so devices can be
// judged in their real context. Painters are kept in lockstep with
// index.html's (buildBackground / drawLiveBg / drawTunnel / drawStreaks /
// drawLattice / drawWallCode / vignette) as of 2026-07-20 — if the game's
// background changes, re-port here.
// Usage (lab owns geo/ring math and the rAF loop):
//   LabBG.resize(W, H)      on resize
//   LabBG.step(dt)          from the lab's sim step (fast-forward safe)
//   LabBG.draw(ctx, g, ring) first thing in the frame
//   LabBG.vignette(ctx)     last thing in the frame
const LabBG = (() => {
  const TAU = Math.PI * 2;
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const lerp = (a, b, t) => a + (b - a) * t;
  const SPAWN_Z = 2.1, SEAMS = 14, SEAM_OFF = 0.12, HOOP_SPACING = 0.28;
  const trafficSpeed = 0.4;             // the game's shared motion clock, base rate
  let W = 0, H = 0, time = 0;
  let bgCanvas = null, vignetteCanvas = null, wallTex = null;
  let bgMotes = [], wallSnips = [], streaks = [];
  let glitchT = 0, glitchY = 0, nextGlitch = 3, tunnelScroll = 0, wallDist = 0;

  function randCode() {
    let s = '';
    const hex = Math.random() < 0.25;
    const len = hex ? 4 + (Math.random() * 4 | 0) : 6 + (Math.random() * 9 | 0);
    for (let j = 0; j < len; j++) s += hex ? '0123456789ABCDEF'[Math.random() * 16 | 0] : (Math.random() < 0.5 ? '0' : '1');
    return hex ? '0x' + s : s;
  }

  function resize(w, h) {
    W = w; H = h;
    bgMotes = [];
    for (let i = 0; i < 18; i++) {
      bgMotes.push({ x: Math.random() * W, y: Math.random() * H, sp: rand(4, 14), r: rand(0.6, 1.8), ph: rand(0, TAU), white: Math.random() < 0.3 });
    }
    wallSnips = [];
    for (let i = 0; i < 30; i++) {
      wallSnips.push({
        a: Math.random() * TAU, z: Math.random(), str: randCode().slice(0, 9),
        amber: Math.random() < 0.22, sp: rand(0.7, 1.4),
        dir: Math.random() < 0.6 ? -1 : 1
      });
    }
    streaks = [];
    for (let i = 0; i < 190; i++) {
      streaks.push({ z: Math.random(), a: Math.PI / 2 + rand(-0.55, 0.55), gold: true, sp: rand(0.92, 1.12) });
    }
    for (let i = 0; i < 110; i++) {
      streaks.push({ z: Math.random(), a: Math.random() * TAU, gold: false, amber: Math.random() < 0.22, sp: rand(0.88, 1.08) });
    }
    // vignette cache
    vignetteCanvas = document.createElement('canvas');
    vignetteCanvas.width = W; vignetteCanvas.height = H;
    const v = vignetteCanvas.getContext('2d');
    const vg = v.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.42, W / 2, H / 2, Math.max(W, H) * 0.72);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.38)');
    v.fillStyle = vg; v.fillRect(0, 0, W, H);
    // deep navy base + circuit traces + binary blocks + data chips
    bgCanvas = document.createElement('canvas');
    bgCanvas.width = W; bgCanvas.height = H;
    const b = bgCanvas.getContext('2d');
    b.fillStyle = '#020510'; b.fillRect(0, 0, W, H);
    for (let i = 0; i < 85; i++) {
      const roll = Math.random();
      b.strokeStyle = roll < 0.22
        ? 'rgba(255,180,80,' + (0.04 + Math.random() * 0.08).toFixed(2) + ')'
        : roll < 0.32
          ? 'rgba(230,245,255,' + (0.04 + Math.random() * 0.07).toFixed(2) + ')'
          : 'rgba(70,150,240,' + (0.04 + Math.random() * 0.1).toFixed(2) + ')';
      b.lineWidth = Math.random() < 0.15 ? 2 : 1;
      b.beginPath();
      let x = Math.random() * W, y = Math.random() * H;
      b.moveTo(x, y);
      for (let j = 0; j < 4; j++) {
        if (Math.random() < 0.5) x += rand(-80, 80); else y += rand(-50, 50);
        b.lineTo(x, y);
      }
      b.stroke();
    }
    b.font = '9px monospace';
    for (let i = 0; i < 130; i++) {
      const al = 0.04 + Math.random() * 0.12;
      const roll = Math.random();
      b.fillStyle = roll < 0.22 ? 'rgba(255,190,90,' + al.toFixed(2) + ')'
        : roll < 0.32 ? 'rgba(235,248,255,' + al.toFixed(2) + ')'
        : 'rgba(90,170,255,' + al.toFixed(2) + ')';
      b.fillText(randCode(), Math.random() * W, Math.random() * H);
    }
    for (let i = 0; i < 45; i++) {
      const al = 0.05 + Math.random() * 0.1;
      b.fillStyle = Math.random() < 0.25 ? 'rgba(255,185,80,' + al.toFixed(2) + ')' : 'rgba(100,180,255,' + al.toFixed(2) + ')';
      b.fillRect(Math.random() * W, Math.random() * H, rand(3, 14), rand(2, 5));
    }
    // the tunnel wall texture: one dense annulus of raw data
    const TS = Math.min(1024, Math.round(Math.min(W, H) * 1.7));
    const half = TS / 2;
    wallTex = document.createElement('canvas');
    wallTex.width = TS; wallTex.height = TS;
    const t = wallTex.getContext('2d');
    t.translate(half, half);
    const inR = half * 0.55, outR = half * 0.98;
    const pick = al => {
      const r = Math.random();
      return r < 0.2 ? 'rgba(255,185,80,' + al + ')' : r < 0.35 ? 'rgba(235,248,255,' + al + ')' : 'rgba(80,180,255,' + al + ')';
    };
    for (let i = 0; i < 650; i++) {
      const rr = rand(inR, outR);
      const a0 = Math.random() * TAU, len = rand(0.03, 0.5);
      t.strokeStyle = pick((0.1 + Math.random() * 0.4).toFixed(2));
      t.lineWidth = Math.random() < 0.12 ? rand(2, 3.2) : rand(0.6, 1.6);
      t.beginPath(); t.arc(0, 0, rr, a0, a0 + len); t.stroke();
    }
    t.textAlign = 'center';
    for (let i = 0; i < 170; i++) {
      const rr = rand(inR, outR), a0 = Math.random() * TAU;
      t.save();
      t.rotate(a0); t.translate(rr, 0); t.rotate(Math.PI / 2);
      t.font = (7 + Math.random() * 7 | 0) + 'px monospace';
      t.fillStyle = pick((0.12 + Math.random() * 0.3).toFixed(2));
      t.fillText(randCode(), 0, 0);
      t.restore();
    }
    for (let i = 0; i < 140; i++) {
      const rr = rand(inR, outR - 14), a0 = Math.random() * TAU;
      t.strokeStyle = pick((0.1 + Math.random() * 0.3).toFixed(2));
      t.lineWidth = 1;
      t.save(); t.rotate(a0);
      t.beginPath(); t.moveTo(rr, 0); t.lineTo(rr + rand(3, 14), 0); t.stroke();
      t.restore();
    }
    for (let i = 0; i < 160; i++) {
      const rr = rand(inR, outR), a0 = Math.random() * TAU;
      t.fillStyle = pick((0.15 + Math.random() * 0.4).toFixed(2));
      t.save(); t.rotate(a0);
      t.fillRect(rr, 0, rand(1.5, 6), rand(1, 2.5));
      t.restore();
    }
  }

  function step(dt) {
    time += dt;
    tunnelScroll = (tunnelScroll + dt * trafficSpeed * 10) % 10;
    wallDist += dt * trafficSpeed;
    for (const m of bgMotes) {
      m.y -= m.sp * dt;
      if (m.y < -4) { m.y = H + 4; m.x = Math.random() * W; }
    }
    nextGlitch -= dt;
    if (nextGlitch <= 0) { glitchT = 0.12; glitchY = Math.random() * H; nextGlitch = rand(2.5, 6.5); }
    if (glitchT > 0) glitchT -= dt;
    const dz = 0.045;
    for (const c of wallSnips) {
      c.z += dt * trafficSpeed * c.sp * c.dir;
      if (c.dir < 0 && c.z < -0.08 - c.str.length * dz) { c.z = 1; c.a = Math.random() * TAU; c.str = randCode().slice(0, 9); }
      if (c.dir > 0 && c.z > 1) { c.z = -0.05; c.a = Math.random() * TAU; c.str = randCode().slice(0, 9); }
    }
    for (const st of streaks) {
      st.z -= dt * trafficSpeed * st.sp;
      if (st.z <= -0.08) { st.z = 1; if (st.gold) st.a = Math.PI / 2 + rand(-0.55, 0.55); }
    }
  }

  function draw(ctx, g, ring) {
    ctx.drawImage(bgCanvas, 0, 0);
    // drifting motes + rare glitch scanlines
    for (const m of bgMotes) {
      const al = 0.06 + (Math.sin(time * 2 + m.ph) * 0.5 + 0.5) * 0.1;
      ctx.fillStyle = m.white ? 'rgba(255,255,255,' + al.toFixed(2) + ')' : 'rgba(120,220,255,' + al.toFixed(2) + ')';
      ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, TAU); ctx.fill();
    }
    if (glitchT > 0) {
      ctx.fillStyle = 'rgba(90,220,255,0.05)';
      ctx.fillRect(0, glitchY, W, 3);
      ctx.fillStyle = 'rgba(255,140,40,0.05)';
      ctx.fillRect(0, glitchY + 7, W, 2);
    }
    // the wall: one dense annulus of data, stamped at receding depths
    const N = 10;
    for (let i = N - 1; i >= 0; i--) {
      const z = (((i - tunnelScroll) % N) + N) % N / N;
      const rg = ring(z, g);
      const hs = rg.r / 0.75;
      if (hs < 5) continue;
      const a = (1 - z) * 0.85 + 0.08;
      ctx.save();
      ctx.translate(rg.x, rg.y);
      ctx.rotate(i * 0.55);
      ctx.globalAlpha = a;
      ctx.drawImage(wallTex, -hs, -hs, hs * 2, hs * 2);
      ctx.restore();
      if (z > 0.85) {
        const z2 = z - 1;
        const rg2 = ring(z2, g);
        const hs2 = rg2.r / 0.75;
        const a2 = clamp(1 + z2 / 0.15, 0, 1) * 0.9;
        if (a2 > 0.01) {
          ctx.save();
          ctx.translate(rg2.x, rg2.y);
          ctx.rotate(i * 0.55);
          ctx.globalAlpha = a2;
          ctx.drawImage(wallTex, -hs2, -hs2, hs2 * 2, hs2 * 2);
          ctx.restore();
        }
      }
    }
    ctx.globalAlpha = 1;
    // warm-white vanish point
    const far = ring(1, g);
    const grad = ctx.createRadialGradient(far.x, far.y, 0, far.x, far.y, far.r * 4.5);
    grad.addColorStop(0, 'rgba(255,244,220,0.6)');
    grad.addColorStop(0.35, 'rgba(255,200,110,0.16)');
    grad.addColorStop(0.7, 'rgba(90,160,255,0.07)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(far.x - far.r * 4.5, far.y - far.r * 4.5, far.r * 9, far.r * 9);
    // the gold payload river + ambient sparks
    for (const st of streaks) {
      const r1 = ring(st.z, g), r2 = ring(Math.min(st.z + (st.gold ? 0.05 : 0.09), 1), g);
      const rr1 = st.gold ? r1.r * rand(0.86, 0.99) : r1.r * 0.97;
      const x1 = r1.x + Math.cos(st.a) * rr1, y1 = r1.y + Math.sin(st.a) * rr1;
      const x2 = r2.x + Math.cos(st.a) * r2.r * 0.95, y2 = r2.y + Math.sin(st.a) * r2.r * 0.95;
      const al = Math.min(1 - st.z, 1.05) * (st.gold ? 0.75 : 0.3) * clamp(1 + st.z / 0.1, 0, 1);
      if (al <= 0.01) continue;
      ctx.strokeStyle = st.gold ? 'rgba(255,196,88,' + al.toFixed(2) + ')'
        : st.amber ? 'rgba(255,185,90,' + al.toFixed(2) + ')' : 'rgba(140,215,255,' + al.toFixed(2) + ')';
      ctx.lineWidth = st.gold ? lerp(0.5, 2.6, 1 - st.z) : 1;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      if (st.gold && st.z < 0.35) {
        ctx.strokeStyle = 'rgba(255,238,190,' + (al * 0.7).toFixed(2) + ')';
        ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      }
    }
    // lattice: seams + hoops riding with the traffic
    ctx.save();
    ctx.lineCap = 'butt';
    const rFar = ring(SPAWN_Z, g).r, rNear = ring(Math.max(0.02, g.hitZ * 0.4), g).r;
    for (let i = 0; i < SEAMS; i++) {
      const a = i / SEAMS * TAU + SEAM_OFF;
      const fx2 = g.cx + Math.cos(a) * rFar, fy2 = g.cy + Math.sin(a) * rFar;
      const nx2 = g.cx + Math.cos(a) * rNear, ny2 = g.cy + Math.sin(a) * rNear;
      const grd = ctx.createLinearGradient(fx2, fy2, nx2, ny2);
      grd.addColorStop(0, 'rgba(90,170,235,0)');
      grd.addColorStop(0.3, 'rgba(90,170,235,0.26)');
      grd.addColorStop(1, 'rgba(90,170,235,0.08)');
      ctx.strokeStyle = grd;
      ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(fx2, fy2); ctx.lineTo(nx2, ny2); ctx.stroke();
    }
    const off = ((wallDist % HOOP_SPACING) + HOOP_SPACING) % HOOP_SPACING;
    for (let z = SPAWN_Z - off; z > g.hitZ * 0.4; z -= HOOP_SPACING) {
      const rr = ring(z, g);
      const a = clamp((SPAWN_Z - 0.05 - z) / 0.4, 0, 1) * 0.26;
      ctx.strokeStyle = 'rgba(120,200,255,' + a.toFixed(2) + ')';
      ctx.lineWidth = Math.max(0.8, rr.r / g.nodeR * 1.5);
      ctx.beginPath(); ctx.arc(g.cx, g.cy, rr.r, 0, TAU); ctx.stroke();
    }
    ctx.restore();
    // glyph traffic racing along the tunnel axis
    const dz = 0.045;
    ctx.textAlign = 'center';
    for (const c of wallSnips) {
      const cosA = Math.cos(c.a), sinA = Math.sin(c.a);
      for (let j = 0; j < c.str.length; j++) {
        const zj = c.z + j * dz;
        if (zj > 1 || zj < -0.07) continue;
        const rg = ring(zj, g);
        const fs = 46 * rg.s;
        if (fs < 4) continue;
        const x = rg.x + cosA * rg.r * 0.985, y = rg.y + sinA * rg.r * 0.985;
        const al = Math.min(1 - zj, 1.05) * 0.6 * clamp((zj + 0.07) / 0.12, 0, 1);
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(c.a);
        ctx.font = Math.min(fs, 17).toFixed(1) + 'px monospace';
        ctx.fillStyle = c.amber ? 'rgba(255,190,85,' + al.toFixed(2) + ')' : 'rgba(130,200,255,' + al.toFixed(2) + ')';
        ctx.fillText(c.str[j], 0, 0);
        ctx.restore();
      }
    }
  }

  const vignette = ctx => { ctx.drawImage(vignetteCanvas, 0, 0); };
  return { resize, step, draw, vignette };
})();
