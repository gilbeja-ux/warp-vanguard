'use strict';
// ---------- FRAME PROFILER (dev only, off unless asked for) ----------
// Answers one question the desk cannot: where does a frame actually GO on the
// phone? A headless profile only measures JS arithmetic against a stubbed
// canvas — it has nothing to say about rasterisation, which on a mobile GPU is
// usually the real bill. shadowBlur and big gradients cost almost nothing in the
// test harness and a great deal on glass.
//
// Turn it on with ?prof=1, or F2 on a desktop keyboard. OFF is the default and
// costs one truthiness check per phase marker — call it a few hundred branches a
// second, which is nothing.
//
// It NEVER touches the sim. It reads the clock and writes to its own accumulator;
// it consumes no RNG and mutates no game state, so a profiled run stays
// bit-identical to an unprofiled one and still verifies against the leaderboard.

let PROF = null;

// A phase marker closes the previous phase and opens the named one, so
// instrumenting a render pass is a single line before it rather than a wrapper
// around it. prof(null) closes the last phase without opening another.
function prof(name) {
  if (!PROF) return;
  const t = performance.now();
  if (PROF.cur) PROF.acc[PROF.cur] = (PROF.acc[PROF.cur] || 0) + (t - PROF.mark);
  PROF.cur = name;
  PROF.mark = t;
}

function profOn() { return !!PROF; }

function profToggle(on) {
  if (on === false || (on === undefined && PROF)) { PROF = null; return false; }
  PROF = { acc: {}, cur: null, mark: 0, roll: {}, frames: 0, since: 0, fps: 0, worst: 0, rows: [] };
  return true;
}

// Called once at the end of every frame: fold this frame's accumulator into a
// rolling average, and keep the worst frame seen — a smooth average hides the
// hitch that is actually the complaint.
function profFrame(frameMs) {
  if (!PROF) return;
  prof(null);
  const P = PROF;
  P.frames++;
  P.since += frameMs;
  if (frameMs > P.worst) P.worst = frameMs;
  for (const k in P.acc) P.roll[k] = (P.roll[k] || 0) + P.acc[k];
  // republish once a second, so the numbers are readable rather than strobing
  if (P.since >= 1000) {
    P.fps = Math.round((P.frames * 1000) / P.since);
    P.rows = Object.keys(P.roll)
      .map(k => ({ name: k, ms: P.roll[k] / P.frames }))
      .sort((a, b) => b.ms - a.ms);
    P.total = P.rows.reduce((s, r) => s + r.ms, 0);
    P.peak = P.worst; // the worst single frame in the last second — the hitch
    P.frames = 0; P.since = 0; P.roll = {}; P.worst = 0;
  }
  P.acc = {}; P.cur = null;
}

// The readout. Deliberately plain: monospace, no glow, no rounded anything —
// it must cost nothing itself or it would be measuring its own overhead.
function drawProfiler() {
  if (!PROF || !PROF.rows.length) return;
  const P = PROF;
  const pad = 6, lh = 13, w = 172;
  const h = pad * 2 + lh * (P.rows.length + 2);
  const x = 8 + (typeof SAFE === 'object' ? SAFE.l : 0);
  const y = 8 + (typeof SAFE === 'object' ? SAFE.t : 0);
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.fillStyle = 'rgba(0,0,0,0.78)';
  ctx.fillRect(x, y, w, h);
  ctx.font = '10px ui-monospace, Menlo, monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  const budget = 16.7; // one frame at 60fps
  ctx.fillStyle = P.fps >= 55 ? '#7ee262' : P.fps >= 45 ? '#ffd24a' : '#ff5a5a';
  ctx.fillText(`${P.fps} fps   avg ${P.total.toFixed(1)}ms / ${budget}`, x + pad, y + pad);
  ctx.fillStyle = 'rgba(200,220,255,0.6)';
  ctx.fillText(`worst frame ${(P.peak || 0).toFixed(1)}ms`, x + pad, y + pad + lh);
  let ty = y + pad + lh * 2;
  for (const r of P.rows) {
    const frac = Math.min(1, r.ms / budget);
    ctx.fillStyle = 'rgba(120,190,255,0.22)';         // a bar, so the eye ranks them
    ctx.fillRect(x + pad, ty, (w - pad * 2) * frac, lh - 3);
    ctx.fillStyle = r.ms > budget * 0.25 ? '#ffd24a' : '#cfe3ff';
    ctx.fillText(r.name, x + pad + 2, ty);
    ctx.textAlign = 'right';
    ctx.fillText(r.ms.toFixed(2), x + w - pad, ty);
    ctx.textAlign = 'left';
    ty += lh;
  }
  ctx.restore();
}

// ?prof=1 turns it on at boot. Wrapped because the headless harnesses have no
// location, and the editor page has one that never carries the flag.
try {
  if (typeof location !== 'undefined' && /[?&]prof=1/.test(location.search)) profToggle(true);
} catch (e) {}
