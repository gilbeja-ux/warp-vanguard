'use strict';
// ---------- drawing ----------

// the wall lattice: longitudinal seams + depth hoops that stream at EXACTLY
// the traffic speed. leaks sit in its cells and ride its hoops — structural
// proof that they are holes in a surface, not sprites in the bore
const SEAMS = 14, SEAM_OFF = 0.12, HOOP_SPACING = 0.28;
function drawLattice(g) {
  if (state === S.MENU) return;
  const exit = laneExit(), exitZ = laneExitZ(), exitK = 1 - exit;
  if (exitK <= 0.004) return; // the corridor is gone — nothing structural left to draw
  ctx.save();
  ctx.lineCap = 'butt';
  // both ends ride the exit, so the seams stretch and sweep out through the frame
  const rFar = ring(Math.max(Z_FLOOR + 0.01, SPAWN_Z - exitZ), g).r;
  const rNear = ring(Math.max(Z_FLOOR + 0.004, g.hitZ * 0.4 - exitZ), g).r;
  for (let i = 0; i < SEAMS; i++) {
    const a = i / SEAMS * TAU + SEAM_OFF;
    const fx2 = g.cx + Math.cos(a) * rFar, fy2 = g.cy + Math.sin(a) * rFar;
    const nx2 = g.cx + Math.cos(a) * rNear, ny2 = g.cy + Math.sin(a) * rNear;
    const grd = ctx.createLinearGradient(fx2, fy2, nx2, ny2);
    grd.addColorStop(0, 'rgba(90,170,235,0)');
    grd.addColorStop(0.3, `rgba(90,170,235,${(0.26 * exitK).toFixed(3)})`);
    grd.addColorStop(1, `rgba(90,170,235,${(0.08 * exitK).toFixed(3)})`);
    ctx.strokeStyle = grd;
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(fx2, fy2); ctx.lineTo(nx2, ny2); ctx.stroke();
  }
  // the FIELD HARMONICS: the hoops that hold the lane open, riding toward the
  // viewer in lockstep with the traffic. In the fiber theme these were structural
  // rings of a duct; here they are the containment field, so they carry the lane
  // carrier's teal and a charge pulse travelling outward along the bore. The
  // spacing and geometry are untouched — leaks still ride these hoops.
  const off = ((wallDist % HOOP_SPACING) + HOOP_SPACING) % HOOP_SPACING;
  // The hoops run all the way to the projection floor, NOT to hitZ*0.4. The old
  // bound cut them at z=0.10, where a hoop's radius is still comfortably inside
  // the frame — so each ring visibly evaporated mid-screen instead of passing
  // the camera. Same disease the warp lines had, same cure: past the floor the
  // radius has blown far outside every screen edge, so the recycle is invisible.
  for (let z0 = SPAWN_Z - off; z0 > -0.155; z0 -= HOOP_SPACING) {
    const z = z0 - exitZ;
    if (z <= Z_FLOOR + 0.004) continue;
    const rr = ring(z, g);
    if (rr.r > Math.max(W, H) * 1.6) continue; // already past every edge — skip the stroke
    const a = clamp((SPAWN_Z - 0.05 - z0) / 0.4, 0, 1) * 0.26 * exitK;
    // a slow charge running down the lane: each hoop brightens as the pulse
    // passes it, so the field reads as powered rather than as inert scaffolding
    const pulse = 0.78 + 0.42 * Math.pow(0.5 + 0.5 * Math.sin((z * 3.1 - time * 1.15) * TAU), 3);
    ctx.strokeStyle = `rgba(96,224,208,${(a * pulse).toFixed(3)})`;
    ctx.lineWidth = Math.max(0.8, rr.r / g.nodeR * 1.5);
    ctx.beginPath(); ctx.arc(g.cx, g.cy, rr.r, 0, TAU); ctx.stroke();
  }
  drawWarpField(g);
  ctx.restore();
}

// THE WARP FIELD: a continuous luminous sheath hugging the lane wall — the
// energy tunnel that highlights the bore against open space. Not arcs, not
// ribbons, not anything with parts: a single unbroken tube of soft teal glow.
//
// Built as ONE prerendered annulus sprite (a ring of light with gaussian-soft
// inner and outer falloff) stamped densely down the bore. The stamps are
// radially symmetric and featureless, so unlike the wall texture they can
// overlap at any spacing without forming a repeating pattern, and there is
// nothing on them to shear under the enemy decals.
//
// The life in it comes from EMANATION, not rotation: a slow charge travelling
// down the tube (a long sine over z sliding with time) and a faint outward
// breath. Both modulate alpha only — the geometry never moves, so the sheath
// reads as the lane's own field rather than as an object in the lane.
let fieldGlowCv = null;
// The bright ring must land EXACTLY on the wall radius or the sheath floats free
// of the bore. The first cut ran its gradient from ringR*0.42 to half, so a stop
// written at "0.60" actually landed at 0.704 while the draw code scaled for 0.62 —
// the glow was painted 14% outside the wall, which is why it read as absent.
// The gradient now spans 0 -> half, so a stop IS its fraction, and FIELD_RING_K
// is that same number. Change one, change the other.
const FIELD_RING_K = 0.62;
function buildFieldGlow() {
  const S = 512, half = S / 2;
  fieldGlowCv = document.createElement('canvas');
  fieldGlowCv.width = fieldGlowCv.height = S;
  const c = fieldGlowCv.getContext('2d');
  const gr = c.createRadialGradient(half, half, 0, half, half, half);
  gr.addColorStop(0.00, 'rgba(96,224,208,0)');
  gr.addColorStop(0.34, 'rgba(96,224,208,0.015)');
  gr.addColorStop(0.50, 'rgba(110,230,215,0.10)');
  gr.addColorStop(0.58, 'rgba(150,242,228,0.30)');
  gr.addColorStop(0.62, 'rgba(196,252,242,0.42)');   // the wall itself — the hot line
  gr.addColorStop(0.67, 'rgba(150,242,228,0.26)');
  gr.addColorStop(0.78, 'rgba(96,224,208,0.075)');
  gr.addColorStop(1.00, 'rgba(96,224,208,0)');
  c.fillStyle = gr;
  c.fillRect(0, 0, S, S);
}
function drawWarpField(g) {
  if (state === S.MENU) return;
  if (!fieldGlowCv) buildFieldGlow();
  const dive = clamp(warpT / 0.9, 0, 1);
  // ORGANIC VISIBILITY. A single sine is a metronome — the eye learns it in two
  // cycles and stops reading it as alive. Three incommensurate periods (11.3s,
  // 4.7s, 2.9s) never line up, so the field swells and thins on no schedule at
  // all, which is what makes it read as something behaving rather than pulsing.
  const swell = 0.55
    + 0.28 * Math.sin(time * 0.556)
    + 0.12 * Math.sin(time * 1.337 + 1.9)
    + 0.05 * Math.sin(time * 2.168 + 0.4);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const N = lowFX ? 16 : 26;
  const exitZ = laneExitZ(), exitK = 1 - laneExit();
  for (let i = 0; i < N && exitK > 0.004; i++) {
    const z0 = SPAWN_Z - 0.03 - (i / (N - 1)) * (SPAWN_Z + 0.10);
    const z = z0 - exitZ;                          // the sheath leaves with its lane
    if (z <= Z_FLOOR + 0.004) continue;
    const rg = ring(z, g);
    const sz = rg.r / FIELD_RING_K;
    if (sz < 6 || rg.r > Math.max(W, H) * 1.8) continue;
    // two charges running the tube at different rates and directions, so the
    // brightness crawling along it never repeats either
    const charge = 0.62
      + 0.26 * Math.sin(z0 * 5.5 - time * 1.35)
      + 0.12 * Math.sin(z0 * 11.2 + time * 0.81);
    const depthK = clamp((SPAWN_Z - 0.04 - z0) / 0.22, 0, 1);
    const al = (0.30 + 0.42 * dive) * depthK * charge * swell * exitK;
    if (al < 0.008) continue;
    ctx.globalAlpha = Math.min(1, al);
    ctx.drawImage(fieldGlowCv, rg.x - sz, rg.y - sz, sz * 2, sz * 2);
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

// range rings: a projected instrument, not wall geometry — three dashed
// hairlines marking 1s / 2s / 3s from the rim at the CURRENT traffic speed.
// On wave levels they breathe apart and together as the stream surges.
// shared gate for the per-enemy depth instrumentation (rings + countdown tags)
// 0→1 as a hostile closes its last ~1.5s to the rim; 1 inside the zap zone.
// The body itself carries the urgency — LED, glow, sparks all key off this.
function urgency(en, g) {
  if (en.resolved || en.failed || en.type === 'frag' || en.type === 'strip') return 0;
  if (en.z <= g.hitZ) return 1;
  const spd = trafficSpeed * (en.speedMul || 1);
  if (spd <= 0) return 0;
  return clamp(1 - (en.z - g.hitZ) / spd / 1.5, 0, 1);
}

function rangeInfo(en, g) {
  if (en.dead || en.resolved || en.failed || en.type === 'frag') return null; // payloads stay calm
  if (en.z <= g.hitZ) return null; // already in the zone — the body itself is the alarm
  const spd = trafficSpeed * (en.speedMul || 1);
  if (spd <= 0) return null;
  const t = (en.z - g.hitZ) / spd;
  // fade in from the horizon like the body, sharpen as arrival closes in
  let al = clamp((SPAWN_Z - 0.05 - en.z) / 0.3, 0, 1) * clamp(1.15 - t * 0.22, 0.3, 1);
  if (t < 1) al *= 0.8 + 0.2 * Math.sin(time * 12); // last second: urgent flicker
  if (al <= 0.02) return null;
  const glow = en.type === 'strip' ? '255,210,74' // golden bonus, not a threat
    : en.type === 'heavy' ? '200,70,255'
    : en.lock === 0 ? '80,170,255'
    : en.lock === 1 ? '225,240,255'
    : '255,60,90';
  return { t, al, glow, rr: ring(en.z, g) };
}

// the surge announcement made visible: an amber wavefront rolling OUT of the
// deep toward the player, wake trailing behind it (deeper z)
function drawSurgeWave(g) {
  if (surgeWaveZ <= 0 || state !== S.PLAY) return;
  const rg = ring(surgeWaveZ, g);
  ctx.save();
  ctx.lineCap = 'round';
  for (let k = 4; k >= 1; k--) { // wake, deeper than the front
    const zw = surgeWaveZ + k * 0.09;
    if (zw >= SPAWN_Z) continue;
    const wr = ring(zw, g);
    ctx.strokeStyle = `rgba(255,154,60,${(0.25 * (1 - k / 5)).toFixed(2)})`;
    ctx.lineWidth = Math.max(1.5, 9 * wr.s * 3 * (1 - k / 6));
    ctx.beginPath(); ctx.arc(g.cx, g.cy, wr.r, 0, TAU); ctx.stroke();
  }
  for (const [w2, col] of [
    [18, 'rgba(255,154,60,0.30)'],
    [7, 'rgba(255,180,80,0.65)'],
    [2.5, 'rgba(255,240,210,0.95)']
  ]) {
    ctx.lineWidth = Math.max(1, w2 * rg.s * 3);
    ctx.strokeStyle = col;
    ctx.beginPath(); ctx.arc(g.cx, g.cy, rg.r, 0, TAU); ctx.stroke();
  }
  ctx.restore();
}

function drawRangeRings(g) {
  // each hostile projects a depth line onto the tunnel at its front edge —
  // brightest at the body, fading as it wraps around the bore
  if (state !== S.PLAY && state !== S.PAUSE && state !== S.INFO) return;
  if (boss && boss.mergeT >= 1) return; // the duel has its own instrumentation
  ctx.save();
  ctx.lineCap = 'butt';
  for (const en of enemies) {
    const ri = rangeInfo(en, g);
    if (!ri) continue;
    const mul = en.sizeMul || 1;
    const rr = ring(Math.max(en.z - 0.055 * mul, 0.02), g).r;
    const a0 = en.type === 'strip' ? stripAngle(en, 0) : en.angle;
    ctx.lineWidth = Math.max(1.1, rr / g.nodeR * 2.1);
    const segs = 16, span = Math.PI;
    for (let s2 = 0; s2 < segs; s2++) {
      const f0 = s2 / segs, f1 = (s2 + 1) / segs;
      const al = ri.al * 0.8 * Math.pow(1 - f0, 1.35);
      if (al <= 0.012) break;
      ctx.strokeStyle = `rgba(${ri.glow},${al.toFixed(2)})`;
      ctx.beginPath(); ctx.arc(g.cx, g.cy, rr, a0 + f0 * span, a0 + f1 * span); ctx.stroke();
      ctx.beginPath(); ctx.arc(g.cx, g.cy, rr, a0 - f1 * span, a0 - f0 * span); ctx.stroke();
    }
  }
  ctx.restore();
}

// LANE FILAMENTS: electrical discharge arcing along the throat, the tendrils
// that make a hyperspace tunnel read as violent rather than merely fast. Each
// runs lengthwise from deep to near, jittered laterally so it snakes along the
// wall, and each lives on a short flicker cycle so the set never looks static.
//
// Stateless — every filament is a fixed seed evaluated against the shared clock,
// so it costs no sim state and behaves identically in replays and pauses.
const LANE_FILS = [];
for (let i = 0; i < 9; i++) {
  LANE_FILS.push({
    a: Math.random() * TAU,        // where on the wall it sits
    ph: Math.random(),             // flicker phase
    rate: rand(0.55, 1.25),        // flicker speed
    wob: rand(0.5, 1.6),           // how much it snakes
    seed: Math.random() * 100,
    warm: Math.random() < 0.18
  });
}
function drawLaneFilaments(g, dive) {
  if (state === S.MENU) return;
  const exitK = 1 - laneExit();
  if (exitK <= 0.004) return; // discharge needs a wall to arc across
  ctx.save();
  ctx.lineCap = 'round';
  const SEG = 9;
  for (const f of LANE_FILS) {
    // each filament is alive for a short slice of its cycle, then gone
    const k = ((time * f.rate + f.ph) % 1 + 1) % 1;
    if (k > 0.42) continue;                       // dark most of the time
    const life = Math.sin(k / 0.42 * Math.PI);    // strike in, strike out
    // DIVE-ONLY. Neither hyperspace reference has arcing tendrils — they were
    // built from a wrong read of Elite's witchspace interior. They earn their
    // keep as violence in the 0.9s entry dive and nowhere else.
    const al = life * (0.015 + 0.5 * dive) * exitK;
    if (al < 0.02) continue;
    const col = f.warm ? '255,206,150' : '150,214,255';
    for (const [w, mul] of [[3.4, 0.32], [1.5, 0.7], [0.7, 1]]) {
      ctx.strokeStyle = `rgba(${col},${(al * mul).toFixed(3)})`;
      ctx.beginPath();
      for (let s2 = 0; s2 <= SEG; s2++) {
        const t2 = s2 / SEG;
        const z = 0.06 + t2 * (SPAWN_Z - 0.1);
        const rg = ring(z, g);
        // the snake: a lateral wander that grows toward the near end, where the
        // wall is closest and the discharge has the most room to move
        const off = Math.sin(t2 * 5.2 + f.seed + time * 2.3) * 0.055 * f.wob * (1 - t2 * 0.6);
        const aa = f.a + off;
        const px = rg.x + Math.cos(aa) * rg.r * 0.99;
        const py = rg.y + Math.sin(aa) * rg.r * 0.99;
        s2 ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
      ctx.lineWidth = Math.max(0.5, w * (0.5 + dive * 0.9));
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawTunnel(g) {
  // the wall is starlight smeared by transit, stamped at receding depths, with a
  // layer of roiling plasma over it — a lane under load, not clean geometry
  const N = 10;
  // during the warp dive the throat goes violent: the turbulence multiplies and
  // the whole wall hots up. warpT is 0.9 on level entry and decays to 0, so the
  // hyperspace-reference intensity lives HERE, in a 0.9s cinematic beat, instead
  // of sitting on top of 70 seconds of play where it would eat threat contrast.
  const dive = clamp(warpT / 0.9, 0, 1);
  // THE JUMP LIFT. References 1 and 2 (hyperspace entry, Elite's charge) sit on a
  // lifted BLUE field — that is what gives their streaks something to burn
  // against. References 3 and 4 (cruise) are near-black. Both are true, of the
  // same ship, seconds apart, so the field lifts only while the dive is running.
  //
  // It is gated rather than dialled down because a permanent lift would put
  // node-blue (#50aaff) interdictors on a blue ground and cost the colour rule
  // the contrast it is built on. For 0.9s, with nothing yet to read, it is free.
  if (dive > 0.01) {
    const far0 = ring(SPAWN_Z, g);
    const lift = ctx.createRadialGradient(far0.x, far0.y, 0, far0.x, far0.y, Math.max(W, H) * 0.75);
    lift.addColorStop(0, `rgba(28,58,120,${(0.50 * dive).toFixed(3)})`);
    lift.addColorStop(0.45, `rgba(22,48,104,${(0.40 * dive).toFixed(3)})`);
    lift.addColorStop(1, `rgba(8,18,52,${(0.14 * dive).toFixed(3)})`);
    ctx.fillStyle = lift;
    ctx.fillRect(0, 0, W, H);
  }
  // one steady haze weight for every band — no per-band phase, no oscillation
  // the haze is stamped at every depth too, so it carries the same repeat problem
  // as anything baked. Kept barely-there during play for that reason; it earns its
  // place only in the dive, where the whole field is meant to go violent.
  const cloudK = 0.07 + 1.6 * dive;
  const exit = laneExit(), exitZ = laneExitZ(), exitK = 1 - exit;
  for (let i = N - 1; i >= 0; i--) {
    const z = (((i - tunnelScroll) % N) + N) % N / N - exitZ;
    if (z <= Z_FLOOR + 0.004 || exitK <= 0.004) continue; // gone past the eye
    const rg = ring(z, g);
    const hs = rg.r / 0.75; // texture band mid-radius maps onto this depth's wall radius
    if (hs < 5) continue;
    const a = (1 - z) * 0.85 + 0.08;
    ctx.save();
    ctx.translate(rg.x, rg.y);
    ctx.rotate(i * 0.55); // each depth band has its own FIXED twist — a spinning wall would shear under the leaks
    ctx.globalAlpha = a * exitK;
    if (wallTex) ctx.drawImage(wallTex, -hs, -hs, hs * 2, hs * 2);
    ctx.restore();
    // a STEADY haze over the streaks. An earlier cut breathed each band's alpha
    // on its own phase to fake convection, and it read as blinking — which is the
    // one thing a wall must never do. There is no time term here at all now: the
    // motion comes from the bands' own depth travel, and the glow lives on the
    // lines themselves. Faint during play, blooming only in the dive.
    if (wallCloud && cloudK > 0.004) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.translate(rg.x, rg.y);
      ctx.rotate(i * 0.55 + 0.9); // fixed offset from the streak band — never time-varying
      ctx.globalAlpha = Math.min(1, a * cloudK) * exitK;
      ctx.drawImage(wallCloud, -hs, -hs, hs * 2, hs * 2);
      ctx.restore();
    }
    // the nearest band keeps sliding past the viewer and fades — no pop at the wrap
    if (z > 0.85 && wallTex) {
      const z2 = z - 1;
      const rg2 = ring(z2, g);
      const hs2 = rg2.r / 0.75;
      const a2 = clamp(1 + z2 / 0.15, 0, 1) * 0.9;
      if (a2 > 0.01) {
        ctx.save();
        ctx.translate(rg2.x, rg2.y);
        ctx.rotate(i * 0.55);
        ctx.globalAlpha = a2 * exitK;
        ctx.drawImage(wallTex, -hs2, -hs2, hs2 * 2, hs2 * 2);
        ctx.restore();
        // the haze rides the wrap band TOO. Leaving it off here was why the effect
        // "disappeared close to your eyes": the streak texture kept travelling past
        // the viewer while its haze cut out from under it.
        if (wallCloud && cloudK > 0.004) {
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.translate(rg2.x, rg2.y);
          ctx.rotate(i * 0.55 + 0.9);
          ctx.globalAlpha = Math.min(1, a2 * cloudK) * exitK;
          ctx.drawImage(wallCloud, -hs2, -hs2, hs2 * 2, hs2 * 2);
          ctx.restore();
        }
      }
    }
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  drawLaneFilaments(g, dive);
  // the far end is a VOID, not a lamp: the bore runs off into unlit distance.
  // A dark pool swallows the wall bands so nothing reads as "wall" out there —
  // and depth is sold instead by data blips winking somewhere down the line,
  // distant traffic too far away to resolve into anything.
  const far = ring(SPAWN_Z, g);
  const vr = Math.max(g.nodeR * 0.36, far.r * 4.5);
  // the pool is the unlit END of a corridor. Once the corridor has gone there is
  // no far end to be dark, so it drains off with it and the sky reaches the world.
  if (exitK > 0.004) {
    const dark = ctx.createRadialGradient(far.x, far.y, 0, far.x, far.y, vr);
    dark.addColorStop(0, `rgba(1,2,7,${(0.97 * exitK).toFixed(3)})`);
    dark.addColorStop(0.4, `rgba(2,4,11,${(0.78 * exitK).toFixed(3)})`);
    dark.addColorStop(0.72, `rgba(3,6,15,${(0.34 * exitK).toFixed(3)})`);
    dark.addColorStop(1, 'rgba(4,8,18,0)');
    ctx.fillStyle = dark;
    ctx.beginPath(); ctx.arc(far.x, far.y, vr, 0, TAU); ctx.fill();
  }
  drawFarGlow(far, vr, g);
}

// THE DESTINATION WORLD. A lane goes somewhere, and the vanishing point is where.
//
// This was a pulsing gold beacon with a cross-glint; it is now a planet, and it
// GROWS as the run progresses — tied to the same fraction the HUD progress arc
// draws, so closing on the world and filling the bar are one motion. Capped at
// 2x its start size, per the brief: it must read as approach, not as arrival.
//
// No light rays. A navigation glint said "signal"; a planet is a body, so what
// sits around it is atmosphere — a soft haze shell and a dusting of glowing grain
// that boils gently at its limb.
//
// Still deliberately dim, and the dark pool in front of it stays. It is a promise
// at the edge of perception, not a lamp lighting the bore, and it sits dead centre
// where every incoming threat is read — so it must never win a contrast fight
// against the colour rule.
const farMotes = [];
for (let i = 0; i < 34; i++) {
  farMotes.push({
    a: Math.random() * TAU,          // bearing around the limb
    rr: 0.55 + Math.random() * 0.75, // how far out in the haze shell it sits
    ph: Math.random(),
    sp: rand(0.10, 0.30),            // slow: this is atmosphere, not sparks
    sz: rand(0.4, 1.5),
    warm: Math.random() < 0.3
  });
}
// How far along the lane we are — the same expression the HUD progress arc uses,
// so the world's growth and the bar are literally the same number.
//
// LATCHED and monotonic. Two reasons. It must never shrink mid-run (a boss's HP
// can tick back up on a heal, and a world that shrinks reads as reversing), and
// it must not collapse to 0 the instant the run leaves S.PLAY — that snapped the
// world back to its departure size exactly at arrival, which is the one moment it
// should be at its largest. It holds until the next level resets it.
let lanePlanetProg = 0;
function laneProgress() {
  if (state === S.PLAY) {
    const L = LV || LEVELS[levelIdx];
    const p = boss ? clamp(1 - boss.hp / boss.maxHp, 0, 1)
      : endless ? clamp(levelT / 150, 0, 1)
      : L ? clamp(levelT / L.duration, 0, 1) : 0;
    if (p > lanePlanetProg) lanePlanetProg = p;
  }
  return lanePlanetProg;
}
// DESTINATION WORLDS.
//
// Rendered PER PIXEL, into a sprite cached per variant. Canvas gradients cannot
// make a sphere: a radial gradient is a flat falloff, and offsetting its centre
// toward the light only fakes the direction, never the FORM. What reads as 3D is
// three things a gradient cannot express —
//
//   1. real surface normals, so brightness follows N·L and the terminator lands
//      where the geometry says it does instead of wherever a colour stop sits;
//   2. limb darkening, because a real sphere dims toward its edge;
//   3. bands that follow LATITUDE ON A TILTED AXIS. That tilt is the whole trick:
//      latitude contours on a tilted sphere project as CURVES, which is what tells
//      the eye it is looking at a ball. On a screen-aligned axis they come out as
//      flat horizontal stripes and it reads as a painted disc.
//
// The sprite is built ONCE per world at a fixed reference resolution and then
// SCALED to whatever size the approach calls for. The first cut rebuilt it every
// time the radius crossed a whole pixel, which meant the world grew in 26 discrete
// 1px jumps across a level — the "choppy" growth. Scaling a single sprite is
// continuous, and costs one drawImage.
// >>> DEST-DATA
// EVERY tunable number for every destination, in one block. The destinations lab
// (`npm run lab:dest`) reads this region, drives it live, and writes it straight
// back — so the lab is not a mock-up of the destinations, it IS them.
//
// Two rules for anything living between the markers: it must be pure data (a
// statement with logic in it will be eaten on the next round-trip), and every
// entry needs a three-letter `id` — that is the handle the lab shows and the one
// to say out loud when asking for a change ("SUN's rim is too hot").
const PLANET_REF_R = 104;
// Per-world skin. z = base surface, belt = band colour, bf = how many bands fit
// on the sphere, ba = how hard they read, atmo = air colour, ak = how much air.
// `terr` picks the surface model: absent = a gas giant, banded and nothing more.
//   'land' continents over sea · 'rock' bombarded regolith · 'ice' fractured sheet
//   'lava' cooled crust with the melt glowing between the plates (it emits, so it
//          survives the terminator) · 'dune' wind-carved sand, no water at all
// Two worlds are not spheres-with-a-skin at all:
//   `ring`  [inner, outer] in radii — a ring in the planet's own equatorial plane,
//           casting a shadow on the planet and taking one from it.
//   `field` a count — an asteroid swarm, drawn by buildFieldSprite instead.
// On a 'land' world `z` is the LAND colour and `belt` is the SEA colour; on a
// 'lava' world `z` is the CRUST and `belt` is the MELT.
//
// EVERY terrain dial can be set here per world and falls back to PLANET_SHADE
// when absent. That is what makes eighteen worlds and not five: `sea` alone
// separates an ocean from a continent, `cratF`/`cratD` a battered moon from a
// lightly-marked one, `lavaLvl` a cooling world from an erupting one.
//   sea · water share      terrF · feature scale (low = bigger)   mtn · range height
//   arid · desert belt     cap · ice caps start at |lat|          cloud · cloud opacity
//   cratF/cratD · craters  lavaLvl/lavaK · melt coverage, glow    bump · relief
//   seed · which world this is, forever
// `bf`/`ba` still apply on solid worlds — as a latitude CLIMATE tint rather than
// gas bands, so no dial is dead on any world.
const PLANET_TYPES = [
  { id: 'TAN', n: 'tan giant',   z: [214, 184, 150], belt: [140, 80, 58],   bf: 8.5,  ba: 1.00, atmo: [140, 178, 230], ak: 1.0 },
  { id: 'VIO', n: 'violet giant',z: [192, 166, 226], belt: [106, 66, 148],  bf: 11.0, ba: 0.95, atmo: [190, 160, 255], ak: 1.0 },
  { id: 'STO', n: 'storm giant', z: [96, 138, 210],  belt: [28, 54, 122],   bf: 7.0,  ba: 0.90, atmo: [120, 170, 255], ak: 1.3 },
  { id: 'GRE', n: 'greenhouse',  z: [226, 208, 158], belt: [198, 172, 118], bf: 4.0,  ba: 0.45, atmo: [255, 226, 160], ak: 2.4 },
  { id: 'RNG', n: 'ringed giant',z: [206, 190, 152], belt: [150, 122, 78],  bf: 9.5,  ba: 0.75, atmo: [200, 200, 235], ak: 1.0, ring: [1.35, 2.30], ringC: [216, 202, 176], ringA: 0.2 },
  { id: 'EAR', n: 'earthlike',   z: [96, 138, 78],   belt: [26, 74, 148],   bf: 6.0,  ba: 0.10, atmo: [130, 190, 255], ak: 1.4, terr: 'land', seed: 87, sea: 0.56, terrF: 3.7, mtn: 0.58, arid: 0.63, cap: 0.9, cloud: 0.77 },
  { id: 'OCN', n: 'ocean',       z: [122, 146, 112], belt: [22, 82, 156],   bf: 6.0,  ba: 0.14, atmo: [130, 190, 255], ak: 1.7, terr: 'land', seed: 29, sea: 0.85, terrF: 2.1, mtn: 0.22, arid: 0.30, cap: 1, cloud: 0.44 },
  { id: 'VRD', n: 'verdant',     z: [118, 168, 86],  belt: [36, 92, 128],   bf: 9.0,  ba: 0.12, atmo: [160, 220, 180], ak: 1.2, terr: 'land', seed: 47, sea: 0.38, terrF: 3.4, mtn: 0.30, arid: 0.15, cap: 0.92, cloud: 0.30 },
  { id: 'TUN', n: 'tundra',      z: [255, 255, 255], belt: [46, 82, 116],   bf: 7.0,  ba: 0.16, atmo: [180, 210, 240], ak: 1.3, terr: 'land', seed: 122, sea: 0.57, terrF: 3.25, mtn: 0.47, arid: 0.00, cap: 0.76, cloud: 0.06 },
  { id: 'RST', n: 'rust desert', z: [200, 140, 96],  belt: [118, 62, 42],   bf: 14.0, ba: 0.30, atmo: [220, 150, 110], ak: 0.7, terr: 'rock', seed: 63, terrF: 2.6, cratF: 4.5, cratD: 0.22, bump: 0.050 },
  { id: 'PAL', n: 'pale rock',   z: [196, 192, 184], belt: [104, 100, 96],  bf: 17.0, ba: 0.25, atmo: [150, 165, 190], ak: 0.5, terr: 'rock', seed: 82, terrF: 3.2, cratF: 8.0, cratD: 0.36, bump: 0.065 },
  { id: 'BAS', n: 'basalt moon', z: [86, 84, 88],    belt: [42, 40, 44],    bf: 15.0, ba: 0.20, atmo: [120, 130, 150], ak: 0.35, terr: 'rock', seed: 104, terrF: 4.0, cratF: 6.5, cratD: 0.40, bump: 0.075 },
  { id: 'DES', n: 'dune sea',    z: [226, 186, 128], belt: [166, 112, 62],  bf: 10.0, ba: 0.22, atmo: [235, 190, 140], ak: 0.9, terr: 'dune', seed: 121, terrF: 2.4, bump: 0.050 },
  { id: 'SUL', n: 'sulphur moon',z: [206, 178, 76],  belt: [232, 138, 44],  bf: 8.0,  ba: 0.18, atmo: [240, 200, 110], ak: 0.6, terr: 'lava', seed: 137, terrF: 3.0, lavaLvl: 0.995, lavaK: 1.5, bump: 0.026 },
  { id: 'VOL', n: 'volcanic',    z: [58, 50, 48],    belt: [255, 122, 40],  bf: 9.0,  ba: 0.14, atmo: [255, 130, 70],  ak: 0.55, terr: 'lava', seed: 152, terrF: 2.4, lavaLvl: 0.90, lavaK: 1.05, bump: 0.045 },
  { id: 'ICE', n: 'ice world',   z: [228, 242, 252], belt: [140, 180, 214], bf: 5.5,  ba: 0.20, atmo: [170, 215, 255], ak: 1.2, terr: 'ice',  seed: 97, terrF: 2.9, cap: 0.72, bump: 0.060 },
  { id: 'AST', n: 'asteroid field', z: [166, 156, 144], belt: [44, 48, 62], bf: 6.0,  ba: 0.20, atmo: [140, 160, 190], ak: 0.4, field: 296, fieldR: 2, fieldSq: 0.58, seed: 85 },
  { id: 'MLT', n: 'molten',      z: [64, 42, 40],    belt: [255, 126, 52],  bf: 12.0, ba: 1.00, atmo: [255, 140, 80],  ak: 1.2, glow: 1 }
];
// The boss sun. Same renderer, but emis kills the night side — it makes its own
// light, so there is no terminator to place.
const PLANET_STAR = { id: 'SUN', n: 'star', z: [255, 226, 150], belt: [245, 245, 245], bf: 17.1, ba: 0.12, atmo: [255, 200, 82], ak: 2.15, emis: 1 };
// The shading model itself — shared by every world above, which is why it is a
// separate table. Move a dial here and all nine change together; that is the
// point. These were loose magic numbers inside the pixel loop until the lab
// needed to reach them.
const PLANET_SHADE = {
  id: 'SHD',
  lz: 0.42,          // key light pushed toward the viewer, so the terminator crosses the visible face
  limbK: 0.55,       // limb darkening depth — 0 is a flat disc, 1 is a black rim
  litP: 0.85,        // N·L falloff curve; lower = flatter, more washed
  amb: 0.22,         // night-side fill, so the dark half is not a hole
  ambTint: [26, 34, 58],  // what colour that fill is — cold, because the fill light is starlight
  emisBase: 0.72,    // a star's floor brightness (emis worlds skip N·L entirely)
  tilt: [0.27, -0.89, 0.36], // THE SPIN AXIS. Tilted on purpose: latitude bands on a
                     // tilted sphere project as curves, and that curve is the single
                     // strongest cue that this is a ball and not a painted circle.
  h2: 2.24, h2p: 1.4, h2m: 0.38,  // 2nd band harmonic: rate, phase, how much it modulates
  h3: 4.8,  h3p: 0.3, h3m: 0.15,  // 3rd, finer
  glowK: 150,        // how hard `glow` belts emit regardless of the light (molten)
  rimP: 2.4, rimK: 210,           // atmosphere piling up on the limb: curve, strength
  shellFall: 3.6, shellFallEmis: 2.2, // outer air shell falloff (tighter for worlds than stars)
  shellSide: 0.16,   // how much shell survives on the unlit side
  shellA: 175,       // shell peak alpha
  ringShadow: 0.16,  // how dark a ring shadow gets — on the planet and on the ring
  rockMin: 0.012,    // smallest rock in an asteroid field, in destination radii
  rockMax: 0.16,     // largest
  rockBump: 0.55,    // how lumpy a rock's lighting is
  // ---- TERRAIN ----
  // Bands alone can only ever make gas giants. These drive the solid worlds:
  // continents, craters, mountains and ice, all sampled as 3D noise on the
  // sphere's own normal so they wrap with no seam and no pinch at the poles.
  terrF: 2.6,        // base terrain frequency — lower is bigger continents
  terrOct: 4,        // fbm octaves. Cost is linear in this; 4 is plenty at sprite size
  terrGain: 0.5, terrLac: 2.0,
  seaLvl: 0.50,      // elevation below this is water on a `land` world (per-type `sea` wins)
  shoreW: 0.030,     // width of the shallows band at the coast
  mtnLvl: 0.66,      // elevation above this takes bare rock, then snow
  snowLvl: 0.80,
  mtnK: 0.26,        // how far ranges rise above the continent they sit on
  aridK: 0.55,       // how far the equatorial belt pulls toward desert
  snowLat: 0.34,     // how far the snowline drops per unit latitude
  bumpK: 0.055,      // relief strength — how hard the height gradient bends the normal
  cratF: 6.0,        // crater cell frequency on `rock` worlds
  cratD: 0.30,       // how deep a crater floor sits
  cratRim: 0.14,     // how high its rim stands
  capLat: 0.88,      // |latitude| beyond which ice caps take over
  capW: 0.07,        // how soft the cap edge is
  capJit: 0.12,      // how ragged the cap edge is — a perfect circle reads as paint
  cloudF: 3.4, cloudLvl: 0.56, cloudA: 0.55,  // cloud deck: scale, coverage, opacity
  seaSpec: 0.55, seaSpecP: 26,  // water is the only thing here that glints
  lavaF: 3.0,        // fissure network scale on a `lava` world
  lavaBranch: 0.70,  // how strongly the finer rift network shows beside the main one
  lavaLvl: 0.90,     // how far up the ridge the melt shows — higher is thinner cracks
  lavaW: 0.040,      // width of the melt line. Wide reads as paint; narrow reads as a crack
  lavaHalo: 0.14,    // how far the heated ground spreads either side of it
  lavaK: 1.30,       // how hard the melt glows, on the night side included
  duneF: 5.5,        // dune scale on a `dune` world
  duneA: 0.22        // dune anisotropy — how far the wind stretches them
};
// STATIONS AND GATES. Both are a TORUS — what separates them is proportion and
// what stands in the throat — so ONE shaded sprite serves both. sq is how hard
// the tilt squashes the ring, `ring` is the tube's orbit, `tube` its thickness.
// A gate has an iris and no hub; a station has a pressurised core and lit ports.
const RING_KINDS = {
  // `ring` outer radius · `band` how much of it is ring (radial width) ·
  // `hgt` thickness out of the plane · `sq` how far the plane is tilted.
  // A Coriolis-class station is SHORT AND FAT: the armour is a quarter of the
  // radius and nearly as thick as it is wide, which is what makes it read as a
  // fortress rather than a hoop.
  station: { id: 'STN', n: 'station', sq: 0.46, ring: 1, band: 0.26, hgt: 0.30, metal: [126, 134, 148], hub: 1, win: 1, iris: null, spokes: 1, inner: 0, panels: 1, mast: 1, dock: 1, core: 'DRM' },
  gate:    { id: 'GAT', n: 'gate',    sq: 0.50, ring: 0.86, band: 0.16, hgt: 0.14, metal: [110, 122, 142], hub: 0, win: 0, iris: [110, 236, 218], spokes: 0, inner: 0, panels: 0, mast: 0, dock: 0, core: 'DRM' }
};
// THE CORE, in five designs. The centre was one drum, which meant every station
// in the game had the same middle — and the middle is the part the eye lands on.
// Picked deterministically off the relay, exactly like a planet's variant, so a
// station you have docked at keeps its own shape forever.
//
// `shape` chooses the silhouette; everything else is proportion, so a design can
// be re-dialled without touching the drawing.
const CORE_KINDS = [
  { id: 'DRM', n: 'drum',     shape: 'drum',    h: 1.35, w: 1.00, seg: 2, port: 5 },
  { id: 'SPH', n: 'sphere',   shape: 'sphere',  h: 1.00, w: 1.10, seg: 1, port: 6 },
  { id: 'SPN', n: 'spindle',  shape: 'spindle', h: 2.10, w: 0.86, seg: 2, port: 4 },
  { id: 'CLS', n: 'cluster',  shape: 'cluster', h: 1.05, w: 1.20, seg: 1, port: 3 },
  { id: 'STK', n: 'stack',    shape: 'stack',   h: 1.90, w: 0.92, seg: 4, port: 4 }
];
// The torus shading model, shared by both kinds — the ring's equivalent of
// PLANET_SHADE, and separate for the same reason: these are the dials that move
// stations and gates TOGETHER.
const RING_SHADE = {
  id: 'RSH',
  amb: 0.19,         // how much metal survives on a face turned from the sun. A
                     // FLOOR against the void, not a taste dial: below about 0.15
                     // the dark side falls under the background and the station
                     // loses half its silhouette against space.
  topAmb: 0.30,      // the top plate never faces the sun squarely — this is its floor
  topLit: 0.72,      // and how much it catches
  innerFaceK: 0.62,  // the far side's inner wall, lit mostly by its own bounce
  facetN: 26,        // armour plates round the ring
  seamA: 0.55,       // how hard the joins between plates read
  seamW: 0.004,      // and how wide
  shadowK: 0.42,     // how dark the core's cast shadow lands on a plate
  shadowW: 1.25,     // the shadow's width, in core radii
  hubR: 0.29,        // the core, as a fraction of the ring's outer radius
  hubC: [118, 126, 142],
  hubH: 1.05, hubEdge: 0.22, hubWinN: 5,
  dockAt: 0.25,      // where round the ring the docking mouth sits, 0..1
  dockN: 2,          // how many plates wide it is
  dockC: [255, 196, 118],
  dockA: 0.80,       // the bay light behind the slot
  dockGlow: 0.15,    // how far that light spills onto the hull
  winC: [255, 206, 120],
  winA: 0.62,        // lit ports at the point facing the sun
  winW: 0.030, winH: 0.30,   // a window on the inner wall: fraction of radius, of thickness
  winRow: 0.34, winGap: 0.22,// where the rows sit up the wall, and their spacing
  innerWinK: 0.85,   // how bright the far side's windows read
  lampK: 3.0,        // how far a light's halo reaches past its core
  spokeN: 4, spokeP: 0.5, spokeW: 0.026,
  panelP: 1.15, panelD: 1.10, panelW: 0.12, panelH: 0.055, panelN: 3,
  panelC: [26, 42, 74], panelA: 0.92, panelSpec: 0.35, boomW: 0.012,
  mastH: 0.40, mastW: 0.014, mastN: 4,
  beaconN: 16, beaconP: 0.2, beaconR: 0.007,
  beaconC: [255, 92, 78], beaconA: 0.72,
  irisA: 0.42        // energy standing in a gate's throat
};
// How often each kind turns up as a mission endpoint, out of 100. Gates take
// whatever planets and stations leave — so these two are the whole dial.
const DEST_MIX = { id: 'MIX', planet: 62, station: 24 };
// WHAT LIVES THERE. A destination that only sits in the frame is a picture; these
// are the things that make it a PLACE. Every arrival gets a creeping terminator
// and a scintillating sky — those are the world and the void behaving, and both
// are free. The rest is a HAND dealt per relay: one arrival has a moon and a
// station over it, the next has aurora and traffic, and the player learns the
// difference. Dealt from the relay's own seed, so a place keeps its life forever.
const DEST_LIFE = {
  id: 'LIF',
  n0: 2, n1: 3,                    // features dealt per relay (inclusive)
  vis0: 0.20, vis1: 0.24,          // R/nodeR where life fades in / reaches full
  creep: 0.15, creepRate: 0.045,   // terminator swing (rad) and how slowly it swings
  nightK: 0.44,                    // how much darker the creeping shadow makes the night limb
  clus0: 7, clusN: 5, perClus: 9,  // city-light clusters, and lights per cluster
  lightsO: 0.62, lightsC: '255,206,140',
  auroraO: 0.55, auroraW: 3, auroraC: '120,255,190', auroraC2: '160,190,255',
  // moon and station carry no period: they are PARKED where their seed puts them.
  // Nothing that big moves in the time you spend looking at a score.
  moonR: 0.15, moonO: [1.5, 2.15], moonC: '198,192,180',
  shipN: 3, shipO: 0.9, shipPer: [70, 160],  // shipPer is the gap BETWEEN departures
  stnR: 0.085, stnO: [1.2, 1.55],
  twinkle: 0.09, blinkP: 0.05      // deep-sky scintillation depth, and how many are slow blinkers
  // (both deliberately small. This layer is 430 points and the backdrop's own
  // gated stars carry the twinkling — if this one breathes as well, the two
  // fields cross-fade against each other and the sky reads as noise.)
};
// <<< DEST-DATA
// >>> DEST-PICK
// Deterministic per campaign + level, so a given relay always shows the same
// world — it is a place, not a random skin, and a player can recognise it.
//
// Split from planetVariant() so the GALAXY MAP can ask the same question about
// any relay, not just the one being flown. Map and lane read from one function,
// so the world on the chart and the world at the end of the bore cannot drift.
function planetVariantFor(campId, lv, isBoss) {
  if (isBoss) return PLANET_STAR; // the duel happens at a sun
  let h = 2166136261;
  const id = campId || 'x';
  for (let i = 0; i < id.length; i++) { h ^= id.charCodeAt(i); h = Math.imul(h, 16777619); }
  h ^= lv + 1; h = Math.imul(h, 16777619);
  // Avalanche before the modulo. Without this, `% 8` reads only the low three
  // bits, which FNV alone does not decorrelate — two campaigns came out with
  // byte-identical destination sequences.
  h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); h ^= h >>> 15;
  return PLANET_TYPES[(h >>> 0) % PLANET_TYPES.length];
}
// Which core this station is built round. Same shape of hash as the planet
// picker, and seeded differently, so the two never correlate — a relay that draws
// the third planet must not also always draw the third core.
function stationCoreFor(campId, lv) {
  let h = 0x811c9dc5;
  const id = (campId || 'x') + '#core';
  for (let i = 0; i < id.length; i++) { h ^= id.charCodeAt(i); h = Math.imul(h, 16777619); }
  h ^= lv + 1; h = Math.imul(h, 16777619);
  h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); h ^= h >>> 15;
  return CORE_KINDS[(h >>> 0) % CORE_KINDS.length].id;
}
// <<< DEST-PICK
function planetVariant() {
  return planetVariantFor((typeof CAMP !== 'undefined' && CAMP && CAMP.id) || 'x',
    levelIdx, !!(LV && LV.boss));
}
// Chart-scale worlds: one small sprite per variant, built once and stamped at
// every relay. Nine sprites cover the whole galaxy map however many relays it
// shows, and they come off the SAME renderer as the destination at the end of
// the lane — so the chip on the chart is literally a small picture of the place
// you are about to fly to.
// STATIONS AND GATES, rendered per pixel like the worlds are.
//
// They were vector line art before — stroked rings with drawn solar panels — and
// at 20px that reads as a doodle next to a shaded planet, which is exactly the
// "kids drawings" problem. A ring is a TORUS, and a torus has a surface normal
// like anything else: the tube's normal swings from pointing outward at its outer
// edge, through straight at the viewer across its middle, to inward at its inner
// edge. Shade that against the same world key light every other body obeys and it
// stops being a drawing and starts being an object.
// >>> DEST-RING
// The lab lifts this region verbatim. It may reach only TAU, LIGHT_A, ctx,
// RING_KINDS, CORE_KINDS and RING_SHADE — every constant lives in RING_SHADE so
// the lab can drive the shading without touching the drawing.
//
// VECTOR ART, deliberately. A pixel shader would be easy here and it is the wrong
// choice: the lab edits SHAPES, and you cannot drag a handle on a pixel loop.
// Everything below is paths and gradients, so the geometry stays editable.
//
// What stops it reading as a doodle is not detail, it is DEPTH — three things
// flat strokes never had:
//
//   1. The ring is drawn in TWO HALVES with the hub and iris between them, so the
//      near half genuinely occludes the far half. That single ordering does more
//      for solidity than any amount of added linework.
//   2. The tube is shaded by a gradient laid along the KEY LIGHT AXIS, not filled
//      with a flat colour, so it turns from lit to dark across its circumference
//      the way a real torus does.
//   3. A specular arc rides only the lit quadrant, which is what says "metal"
//      rather than "line".
// The five cores, lifted out of drawRingBody so the ring body stays readable.
// Still inside DEST-RING: the lab lifts the whole region, and a core is no use
// without the station it sits in.
function drawStationCore(x, y, R, K, H, tone, lamp, P, hubP) {
  const C = CORE_KINDS.find(c => c.id === (K.core || 'DRM')) || CORE_KINDS[0];
  const lx = Math.cos(LIGHT_A);
  const hr = hubP * C.w, hh = hubP * C.h, ey = hr * K.sq;
  const shade = (u) => {
    const k = H.amb + (1 - H.amb) * Math.max(0, Math.cos((u - lx) * 1.35));
    return `rgb(${H.hubC[0] * k | 0},${H.hubC[1] * k | 0},${H.hubC[2] * k | 0})`;
  };
  const across = (x0, y0, w) => {
    const g = ctx.createLinearGradient(x0 - w, y0, x0 + w, y0);
    g.addColorStop(0, shade(-1)); g.addColorStop(0.5, shade(0)); g.addColorStop(1, shade(1));
    return g;
  };
  const drum = (cx2, cy2, w, ht) => {
    const e = w * K.sq;
    ctx.fillStyle = across(cx2, cy2, w);
    ctx.beginPath();
    ctx.moveTo(cx2 - w, cy2 - ht * 0.5);
    ctx.lineTo(cx2 - w, cy2 + ht * 0.5);
    ctx.ellipse(cx2, cy2 + ht * 0.5, w, e, 0, Math.PI, 0, true);
    ctx.lineTo(cx2 + w, cy2 - ht * 0.5);
    ctx.closePath(); ctx.fill();
    const cap = ctx.createLinearGradient(cx2 - w, cy2, cx2 + w, cy2);
    cap.addColorStop(0, shade(-0.4)); cap.addColorStop(1, shade(1));
    ctx.fillStyle = cap;
    ctx.beginPath(); ctx.ellipse(cx2, cy2 - ht * 0.5, w, e, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = `rgba(255,255,255,${H.hubEdge})`;
    ctx.lineWidth = Math.max(0.3, w * 0.06);
    ctx.beginPath(); ctx.ellipse(cx2, cy2 - ht * 0.5, w, e, 0, 0, TAU); ctx.stroke();
  };
  if (C.shape === 'drum') {
    drum(x, y, hr, hh);
    ctx.strokeStyle = `rgba(${H.hubC[0] * 0.45 | 0},${H.hubC[1] * 0.45 | 0},${H.hubC[2] * 0.45 | 0},0.9)`;
    ctx.lineWidth = Math.max(0.3, hr * 0.05);
    for (let i = 0; i < C.seg; i++) {
      const f = -0.15 + 0.33 * (i / Math.max(1, C.seg - 1 || 1));
      ctx.beginPath(); ctx.ellipse(x, y + hh * f, hr, ey, 0, 0, Math.PI); ctx.stroke();
    }
  } else if (C.shape === 'sphere') {
    const ly2 = Math.sin(LIGHT_A);
    const sg = ctx.createRadialGradient(x + lx * hr * 0.55, y + ly2 * hr * 0.55, hr * 0.05, x, y, hr * 1.25);
    sg.addColorStop(0, shade(1)); sg.addColorStop(0.5, shade(0.1)); sg.addColorStop(1, shade(-1));
    ctx.fillStyle = sg;
    ctx.beginPath(); ctx.arc(x, y, hr, 0, TAU); ctx.fill();
    const la2 = Math.atan2(ly2, lx);
    ctx.strokeStyle = `rgba(255,255,255,${H.hubEdge * 0.8})`;
    ctx.lineWidth = Math.max(0.3, hr * 0.07);
    ctx.beginPath(); ctx.arc(x, y, hr * 0.97, la2 - 1.0, la2 + 1.0); ctx.stroke();
    ctx.strokeStyle = `rgba(${H.hubC[0] * 0.45 | 0},${H.hubC[1] * 0.45 | 0},${H.hubC[2] * 0.45 | 0},0.9)`;
    ctx.beginPath(); ctx.ellipse(x, y, hr, hr * K.sq * 0.5, 0, 0, TAU); ctx.stroke();
  } else if (C.shape === 'spindle') {
    ctx.fillStyle = across(x, y, hr);
    ctx.beginPath();
    ctx.moveTo(x, y - hh * 0.5);
    ctx.quadraticCurveTo(x - hr * 1.35, y, x, y + hh * 0.5);
    ctx.quadraticCurveTo(x + hr * 1.35, y, x, y - hh * 0.5);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = `rgba(${H.hubC[0] * 0.5 | 0},${H.hubC[1] * 0.5 | 0},${H.hubC[2] * 0.5 | 0},0.9)`;
    ctx.lineWidth = Math.max(0.3, hr * 0.08);
    for (const f of [-0.16, 0.16]) {
      ctx.beginPath(); ctx.ellipse(x, y + hh * f, hr * 0.92, hr * 0.92 * K.sq, 0, 0, Math.PI); ctx.stroke();
    }
  } else if (C.shape === 'cluster') {
    const off = [[-0.62, 0.10], [0.62, 0.10], [0, -0.30]];
    off.sort((p, q) => p[1] - q[1]);
    for (const [ox, oy] of off) drum(x + ox * hr, y + oy * hr, hr * 0.56, hh * 0.78);
  } else {
    const n = Math.max(2, C.seg);
    for (let i = n - 1; i >= 0; i--) {
      const t = i / (n - 1) - 0.5;
      drum(x, y + t * hh * 1.02, hr * (0.70 + 0.30 * (1 - Math.abs(t) * 1.4)), hh * 0.24);
    }
  }
  for (let i = 0; i < C.port; i++) {
    const u = -0.7 + 1.4 * (i / Math.max(1, C.port - 1));
    const face = 0.3 + 0.7 * Math.max(0, Math.cos((u - lx) * 1.35));
    lamp(x + u * hr, y - hh * 0.06, Math.max(0.3, hr * 0.06), H.winC, H.winA * face * 0.75);
  }
}

function drawRingBody(x, y, R, kind) {
  const K = RING_KINDS[kind] || RING_KINDS.station;
  const H = RING_SHADE;
  // ---- AN EXTRUDED ARMOUR RING, NOT A TUBE ----
  // The habitat hoop this replaced was a stroked ellipse: one curve, however
  // cleverly shaded. A Coriolis-class station is a SOLID — an annulus with real
  // radial width and real thickness — and the thing that makes it read as one is
  // that you see different FACES of it depending on where you look. On the near
  // side the outer wall; on the far side the inner wall, with its windows facing
  // you across the middle. No amount of gradient on a curve can do that.
  //
  // Everything is built in the ring's own plane and projected, so the facets, the
  // walls, the docking mouth and the shadows all agree about one geometry.
  const rOut = R * K.ring, rIn = rOut * (1 - K.band), hz = R * K.hgt * 0.5;
  const sq = K.sq;
  const lx = Math.cos(LIGHT_A), ly = Math.sin(LIGHT_A);
  const Lpx = lx, Lpy = ly / (sq || 1);
  const Ln = Math.hypot(Lpx, Lpy) || 1, Lx = Lpx / Ln, Ly = Lpy / Ln;
  const [m0, m1, m2] = K.metal;
  // plane polar + out-of-plane height -> screen
  const P = (r, a, z) => [x + r * Math.cos(a), y + r * Math.sin(a) * sq - z];
  const tone = (k) => `rgb(${Math.min(255, m0 * k) | 0},${Math.min(255, m1 * k) | 0},${Math.min(255, m2 * k) | 0})`;
  const quad = (p0, p1, p2, p3, fill) => {
    ctx.beginPath();
    ctx.moveTo(p0[0], p0[1]); ctx.lineTo(p1[0], p1[1]);
    ctx.lineTo(p2[0], p2[1]); ctx.lineTo(p3[0], p3[1]); ctx.closePath();
    ctx.fillStyle = fill; ctx.fill();
  };
  const N = Math.max(6, H.facetN | 0);
  const dock0 = Math.round(H.dockAt * N) % N, dockN = Math.max(1, H.dockN | 0);
  const isDock = (i) => { const d = (i - dock0 + N) % N; return d < dockN; };
  // A LAMP IS NOT A DOT: a bright core inside an additive halo that falls off.
  const lamp = (px, py, r, col, a) => {
    const g = ctx.createRadialGradient(px, py, 0, px, py, r * H.lampK);
    g.addColorStop(0, `rgba(${col},${(a * 0.55).toFixed(3)})`);
    g.addColorStop(0.35, `rgba(${col},${(a * 0.16).toFixed(3)})`);
    g.addColorStop(1, `rgba(${col},0)`);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(px, py, r * H.lampK, 0, TAU); ctx.fill();
    ctx.restore();
    ctx.fillStyle = `rgba(${col},${a})`;
    ctx.beginPath(); ctx.arc(px, py, r, 0, TAU); ctx.fill();
  };
  // the core blocks the sun: a facet is in shadow when it sits behind the core
  // along the light line, which in the plane is one dot product and one cross.
  const hubP = rOut * H.hubR / K.ring;
  const inShadow = (am) => {
    const px = Math.cos(am), py = Math.sin(am);
    if (px * Lx + py * Ly > 0) return 1;
    const perp = Math.abs(px * Ly - py * Lx) * rOut;
    return perp < hubP * H.shadowW ? H.shadowK : 1;
  };
  const face = (i) => {
    const a0 = (i / N) * TAU, a1 = ((i + 1) / N) * TAU, am = (a0 + a1) * 0.5;
    return { a0, a1, am, nd: Math.cos(am) * Lx + Math.sin(am) * Ly, near: Math.sin(am) > 0 };
  };
  // one facet: its top plate, then whichever wall this side of the ring shows
  const drawFacet = (f) => {
    const sh = inShadow(f.am);
    const kTop = (H.topAmb + (1 - H.topAmb) * H.topLit) * (0.86 + 0.28 * Math.max(0, f.nd)) * sh;
    quad(P(rIn, f.a0, hz), P(rOut, f.a0, hz), P(rOut, f.a1, hz), P(rIn, f.a1, hz), tone(kTop));
    if (f.near) {
      if (isDock(0) && false) return;
      const kW = (H.amb + (1 - H.amb) * Math.max(0, f.nd)) * sh;
      quad(P(rOut, f.a0, hz), P(rOut, f.a1, hz), P(rOut, f.a1, -hz), P(rOut, f.a0, -hz), tone(kW));
    } else {
      // the far side shows its INNER wall — the surface the station lives on, so
      // this is where the windows go, facing the viewer across the middle
      const kI = (H.amb + (1 - H.amb) * Math.max(0, -f.nd)) * H.innerFaceK * sh;
      quad(P(rIn, f.a0, hz), P(rIn, f.a1, hz), P(rIn, f.a1, -hz), P(rIn, f.a0, -hz), tone(kI));
      if (K.win) {
        const wy = H.winRow;
        for (let r2 = 0; r2 < 2; r2++) {
          const zz = hz * (wy - r2 * H.winGap * 2);
          const p = P(rIn, f.am, zz);
          const lit = 0.55 + 0.45 * ((i2 => (i2 * 2654435761 >>> 0) / 4294967296)(Math.round(f.am * 997) + r2 * 31));
          ctx.fillStyle = `rgba(${H.winC},${(H.winA * lit * H.innerWinK).toFixed(3)})`;
          ctx.fillRect(p[0] - rOut * H.winW * 0.5, p[1] - hz * H.winH * 0.5, rOut * H.winW, hz * H.winH);
        }
      }
    }
    // seams between plates — the ring is BUILT, and armour shows its joins
    ctx.strokeStyle = `rgba(6,10,18,${H.seamA})`;
    ctx.lineWidth = Math.max(0.3, R * H.seamW);
    ctx.beginPath();
    let p = P(rIn, f.a0, hz), q = P(rOut, f.a0, hz);
    ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]);
    if (f.near) { const s = P(rOut, f.a0, -hz); ctx.lineTo(s[0], s[1]); }
    else { const s = P(rIn, f.a0, -hz); ctx.moveTo(p[0], p[1]); ctx.lineTo(s[0], s[1]); }
    ctx.stroke();
  };
  // THE DOCKING MOUTH. The signature of the whole class: a slot cut through the
  // outer armour with the bay lit behind it. It is drawn as a recess — dark
  // shoulders, a bright throat, a lit lip — because a flat bright rectangle on
  // the hull reads as a sticker, and this has to read as a way IN.
  const drawDock = () => {
    const a0 = (dock0 / N) * TAU, a1 = ((dock0 + dockN) / N) * TAU;
    if (Math.sin((a0 + a1) * 0.5) <= 0) return;          // only when it faces us
    const o = rOut * 1.002;
    quad(P(o, a0, hz * 0.72), P(o, a1, hz * 0.72), P(o, a1, -hz * 0.72), P(o, a0, -hz * 0.72), 'rgba(4,7,14,0.96)');
    const c = P(o, (a0 + a1) * 0.5, 0);
    const g = ctx.createRadialGradient(c[0], c[1], 0, c[0], c[1], rOut * H.dockGlow);
    g.addColorStop(0, `rgba(${H.dockC},${H.dockA})`);
    g.addColorStop(0.45, `rgba(${H.dockC},${(H.dockA * 0.22).toFixed(3)})`);
    g.addColorStop(1, `rgba(${H.dockC},0)`);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(c[0], c[1], rOut * H.dockGlow, 0, TAU); ctx.fill();
    ctx.restore();
    quad(P(o, a0 + (a1 - a0) * 0.30, hz * 0.30), P(o, a1 - (a1 - a0) * 0.30, hz * 0.30),
         P(o, a1 - (a1 - a0) * 0.30, -hz * 0.30), P(o, a0 + (a1 - a0) * 0.30, -hz * 0.30),
         `rgba(${H.dockC},${H.dockA})`);
    ctx.strokeStyle = `rgba(${H.dockC},0.85)`;           // the lit lip round the slot
    ctx.lineWidth = Math.max(0.4, R * 0.006);
    ctx.beginPath();
    let p = P(o, a0, hz * 0.72);
    ctx.moveTo(p[0], p[1]);
    for (const [aa, zz] of [[a1, hz * 0.72], [a1, -hz * 0.72], [a0, -hz * 0.72], [a0, hz * 0.72]]) {
      const s = P(o, aa, zz); ctx.lineTo(s[0], s[1]);
    }
    ctx.stroke();
  };
  ctx.save();
  ctx.lineJoin = 'bevel';
  const faces = [];
  for (let i = 0; i < N; i++) faces.push(face(i));
  // ---- 1. the far half, painted back to front ----
  faces.filter(f => !f.near).sort((p, q) => q.am % TAU - p.am % TAU).forEach(drawFacet);
  // ---- 2. what lives inside the ring ----
  if (K.iris) {
    const ir = ctx.createRadialGradient(x, y, 0, x, y, rIn * 0.96);
    ir.addColorStop(0, `rgba(${K.iris},${H.irisA})`);
    ir.addColorStop(0.55, `rgba(${K.iris},${(H.irisA * 0.42).toFixed(3)})`);
    ir.addColorStop(1, `rgba(${K.iris},0)`);
    ctx.fillStyle = ir;
    ctx.beginPath(); ctx.ellipse(x, y, rIn * 0.96, rIn * 0.96 * sq, 0, 0, TAU); ctx.fill();
  }
  if (K.spokes) {
    ctx.strokeStyle = tone(H.amb + (1 - H.amb) * 0.55);
    ctx.lineWidth = Math.max(0.6, R * H.spokeW);
    ctx.beginPath();
    for (let i = 0; i < H.spokeN; i++) {
      const a = H.spokeP + (i / H.spokeN) * TAU;
      const p = P(hubP * 0.9, a, 0), q = P(rIn, a, 0);
      ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]);
    }
    ctx.stroke();
  }
  if (K.panels) {
    for (let w = 0; w < 2; w++) {
      const a = H.panelP + w * Math.PI, ca = Math.cos(a), sa2 = Math.sin(a);
      ctx.strokeStyle = tone(H.amb + (1 - H.amb) * 0.5);
      ctx.lineWidth = Math.max(0.5, R * H.boomW);
      const b0 = P(hubP, a, 0), b1 = P(rOut * H.panelD, a, 0);
      ctx.beginPath(); ctx.moveTo(b0[0], b0[1]); ctx.lineTo(b1[0], b1[1]); ctx.stroke();
      const hw = rOut * H.panelW, hh = rOut * H.panelH;
      const cx2 = Math.cos(a) * rOut * (H.panelD + H.panelW), cy2 = Math.sin(a) * rOut * (H.panelD + H.panelW);
      const pq = (u, v) => [x + cx2 + ca * u - sa2 * v, y + (cy2 + sa2 * u + ca * v) * sq];
      const faceK = 0.35 + 0.65 * Math.max(0, ca * Lx + sa2 * Ly);
      const pc = H.panelC, sheen = Math.round(180 * faceK * H.panelSpec);
      quad(pq(-hw, -hh), pq(hw, -hh), pq(hw, hh), pq(-hw, hh),
        `rgba(${Math.min(255, pc[0] + sheen)},${Math.min(255, pc[1] + sheen)},${Math.min(255, pc[2] + sheen)},${H.panelA})`);
      ctx.beginPath();
      for (let i = 1; i < H.panelN; i++) {
        const u = -hw + 2 * hw * (i / H.panelN);
        const a2 = pq(u, -hh), b2 = pq(u, hh);
        ctx.moveTo(a2[0], a2[1]); ctx.lineTo(b2[0], b2[1]);
      }
      ctx.strokeStyle = 'rgba(8,14,26,0.9)'; ctx.lineWidth = Math.max(0.3, R * 0.004);
      ctx.stroke();
    }
  }
  if (K.hub) drawStationCore(x, y, R, K, H, tone, lamp, P, hubP);
  if (K.mast) {
    const mh = R * H.mastH, mw = R * H.mastW * 2.4;
    ctx.strokeStyle = tone(H.amb + (1 - H.amb) * 0.7);
    ctx.lineWidth = Math.max(0.5, R * H.mastW);
    ctx.beginPath();
    ctx.moveTo(x - mw * 0.5, y); ctx.lineTo(x - mw * 0.22, y - mh);
    ctx.moveTo(x + mw * 0.5, y); ctx.lineTo(x + mw * 0.22, y - mh);
    for (let i = 1; i <= H.mastN; i++) {
      const t = i / (H.mastN + 1), yy = y - mh * t, w2 = mw * (0.5 - 0.28 * t);
      ctx.moveTo(x - w2, yy); ctx.lineTo(x + w2, yy);
    }
    ctx.stroke();
    lamp(x, y - mh, Math.max(0.5, R * 0.018), H.beaconC, H.beaconA);
  }
  // ---- 3. the near half, over everything, then the way in ----
  faces.filter(f => f.near).sort((p, q) => Math.sin(p.am) - Math.sin(q.am)).forEach(drawFacet);
  if (K.dock) drawDock();
  // ---- 4. running lights, on the top plate's outer edge where a hull carries them
  if (K.win) {
    for (let i = 0; i < H.beaconN; i++) {
      const a = H.beaconP + (i / H.beaconN) * TAU;
      const p = P(rOut * 0.985, a, hz);
      lamp(p[0], p[1], Math.max(0.3, R * H.beaconR), H.beaconC, H.beaconA);
    }
  }
  ctx.restore();
  return true;
}
// <<< DEST-RING
const PLANET_CHIP_R = 24;
const planetChips = {};
function planetChip(V) {
  if (!(V.n in planetChips)) planetChips[V.n] = buildPlanetSprite(PLANET_CHIP_R, V);
  return planetChips[V.n];
}
let planetSprite = null, planetSpriteKey = '';
// Stations and gates are CACHED SPRITES, for the same reason planets are: nothing
// in drawRingBody varies with time, so redrawing it every frame buys nothing and
// costs ~1.9ms — a ninth of the frame — now that the tube is a stack of shaded
// strokes rather than one flat band. Built once at a reference radius and scaled,
// so the approach still grows smoothly.
//
// The cache lives HERE and not inside the DEST-RING region on purpose: the region
// stays a pure draw function, so the lab keeps redrawing live as dials move.
const RING_REF_R = 108;
// How far this kind actually reaches, in body radii, ASKED OF THE DIALS rather
// than guessed. A hardcoded pad is how "it is cut in the game but not in the lab"
// bugs start: the lab draws live on an unclipped canvas, so it would never show
// the clipping that a fixed canvas here would introduce the moment someone winds
// the array booms out.
function ringReach(kind) {
  const K = RING_KINDS[kind] || RING_KINDS.station, H = RING_SHADE;
  // The ring is an annulus with thickness now, not a stroked tube — its reach is
  // simply its outer radius, plus whatever the arrays and the mast stick out past
  // it. Reading a field that no longer exists gave NaN here, and a NaN canvas
  // size is a station that silently fails to build in the game while the lab,
  // which draws live and never asks, looks perfectly fine.
  let r = K.ring + K.hgt;
  if (K.panels) r = Math.max(r, K.ring * (H.panelD + 2 * H.panelW));
  if (K.mast) r = Math.max(r, H.mastH + H.mastW * 4);
  return r * 1.08;                       // margin for stroke widths and beacons
}
let ringSprites = {};
function ringSpriteFor(kind, core) {
  const key = kind + ':' + (core || '-');
  if (ringSprites[key]) return ringSprites[key];
  if (core) RING_KINDS[kind].core = core;   // the region reads it off the kind
  const S = Math.ceil(RING_REF_R * ringReach(kind) * 2);
  const cv2 = document.createElement('canvas');
  cv2.width = cv2.height = S;
  const c2 = cv2.getContext('2d');
  if (!c2) return null;
  const keep = ctx;
  ctx = c2;                       // the region draws through the module-level ctx
  try { drawRingBody(S / 2, S / 2, RING_REF_R, kind); } finally { ctx = keep; }
  return (ringSprites[key] = { cv: cv2, S, R: RING_REF_R });
}
// >>> DEST-SPRITE
// The lab lifts this function verbatim and runs it against the live tables, so a
// dial moved in the lab is shaded by the game's own pixel loop. It may reach only
// TAU, clamp, LIGHT_A and PLANET_SHADE.
// Value noise on the SPHERE'S NORMAL, not on the sprite. Sampling in 3D is what
// keeps continents from pinching at the poles or seaming at the back — the
// texture belongs to the ball, not to the picture of it.
function pnHash(i, j, k, seed) {
  let h = (Math.imul(i, 374761393) + Math.imul(j, 668265263) + Math.imul(k, 1013904223) + Math.imul(seed, 362437)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function pnVal(x, y, z, seed) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
  const L = (a, b, t) => a + (b - a) * t;
  const c000 = pnHash(xi, yi, zi, seed),     c100 = pnHash(xi + 1, yi, zi, seed);
  const c010 = pnHash(xi, yi + 1, zi, seed), c110 = pnHash(xi + 1, yi + 1, zi, seed);
  const c001 = pnHash(xi, yi, zi + 1, seed), c101 = pnHash(xi + 1, yi, zi + 1, seed);
  const c011 = pnHash(xi, yi + 1, zi + 1, seed), c111 = pnHash(xi + 1, yi + 1, zi + 1, seed);
  return L(L(L(c000, c100, u), L(c010, c110, u), v), L(L(c001, c101, u), L(c011, c111, u), v), w);
}
function pnFbm(x, y, z, seed, oct, lac, gain) {
  let a = 0, amp = 1, norm = 0, f = 1;
  for (let i = 0; i < oct; i++) {
    a += amp * pnVal(x * f, y * f, z * f, seed + i * 101);
    norm += amp; amp *= gain; f *= lac;
  }
  return a / (norm || 1);
}
// Ridged fbm — the absolute value folded and inverted, which turns smooth hills
// into CRESTS. Mountains are ridges, not bumps, and this is the cheapest honest
// way to say so.
function pnRidge(x, y, z, seed, oct, lac, gain) {
  let a = 0, amp = 1, norm = 0, f = 1;
  for (let i = 0; i < oct; i++) {
    const n = 1 - Math.abs(pnVal(x * f, y * f, z * f, seed + i * 227) * 2 - 1);
    a += amp * n * n; norm += amp; amp *= gain; f *= lac;
  }
  return a / (norm || 1);
}
// Craters: a 3D cellular field. Each cell may hold ONE impact, with its own
// radius — returned as distance normalised by that radius, so 0 is the centre,
// 1 is the rim and >1 is untouched ground. Uniform-radius craters read as
// bubbles; varied ones read as a bombarded surface.
function pnCrater(x, y, z, seed, freq) {
  const px = x * freq, py = y * freq, pz = z * freq;
  const xi = Math.floor(px), yi = Math.floor(py), zi = Math.floor(pz);
  let best = 9;
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (let k = -1; k <= 1; k++) {
    const cxi = xi + i, cyi = yi + j, czi = zi + k;
    if (pnHash(cxi, cyi, czi, seed + 59) < 0.36) continue;          // most cells are unstruck
    const q = pnHash(cxi, cyi, czi, seed + 83);
    const rad = 0.14 + 0.52 * q * q * q;                            // small impacts far outnumber large
    const fx = cxi + pnHash(cxi, cyi, czi, seed);
    const fy = cyi + pnHash(cxi, cyi, czi, seed + 17);
    const fz = czi + pnHash(cxi, cyi, czi, seed + 41);
    const d = Math.hypot(px - fx, py - fy, pz - fz) / rad;
    if (d < best) best = d;
  }
  return best;
}
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