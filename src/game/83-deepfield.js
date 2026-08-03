'use strict';
// ---------- THE DEEP FIELD: real space outside the lane ----------
// The lane is a contained corridor, not a sealed pipe, so what lies OUTSIDE it
// has to be visible through the field wall — and it has to move at the WRONG
// speed. Distant mass has almost no angular motion, so this layer drifts at a
// small fraction of the wall's rate and accelerates outward with distance from
// the axis (true radial parallax: the radius grows geometrically, so a mote
// near the axis crawls and one near the screen edge sweeps).
//
// That mismatch IS the illusion. The wall screams past, the stars barely move,
// and the corridor reads as a narrow thing threaded through open space rather
// than as the only thing that exists.
//
// Drawn BEFORE the wall, so the wall's sparse strokes veil it instead of hiding
// it, and the far void pool still swallows everything near the beacon — new
// motes emerge out of that darkness instead of popping in.
let deepStars = [], deepRocks = [], deepWisps = [];
let worldVis = 1; // the far worlds are a LANE feature — they fade off the menus, see drawDeepField
// Emerge / recycle radius, in half-min-side units. R1 must clear the SCREEN
// CORNERS or motes wink out in plain sight: the corner sits at
// hypot(W/2, H/2) / (min(W,H)/2), which is ~2.04 on 16:9 and worse on wider
// aspects. 1.75 put the recycle boundary inside the visible frame. Everything
// also fades out approaching it — clearing the corner is the belt, the fade is
// the braces, and nothing in this layer may ever pop.
const DEEP_R0 = 0.16, DEEP_R1 = 2.6, DEEP_FADE = 0.55;
const DEEP_PARALLAX = 0.12;           // fraction of the wall's rate — the whole trick, named not buried
// A STAR IS A POINT PLUS SCATTER, NEVER A FILLED DISC.
//
// This layer drew one flat arc per star at its full radius. That is fine while
// the radius is under a pixel or so, and it stops being fine the moment it is
// not: parallax carries a near star out to r≈2.6, and the biggest ones were
// landing as ~5px hard-edged grey coins sitting in a sky where every other star
// is a point. It is the same failure STAR_HALO was written to cure for the
// backdrop's bright stars, and the cure is the same — the core stays a POINT and
// everything past it is scattered light on that identical curve, so the two
// fields agree about what a star is.
//
// The halo is a PRERENDERED SPRITE, not a gradient. There are 430 of these and
// createRadialGradient per star per frame is the reason the backdrop only ever
// blooms its ~50 brightest; blitting one cached sprite costs a drawImage and
// scales to the whole field.
const DEEP_CORE = 1.1;                // the hard point never grows past this
const DEEP_BLOOM = 3.2;               // halo reach, in core radii
const DEEP_BLOOM_A = 0.5;             // its peak alpha, before the star's own
const deepHaloCv = {};
function deepHalo(col) {
  if (deepHaloCv[col] !== undefined) return deepHaloCv[col];
  let cv = null;
  if (typeof document !== 'undefined') {
    const S = 64, h = S / 2;
    cv = document.createElement('canvas');
    cv.width = cv.height = S;
    const c = cv.getContext('2d');
    if (c) {
      const gg = c.createRadialGradient(h, h, 0, h, h, h);
      for (const [p, w] of STAR_HALO) gg.addColorStop(p, `rgba(${col},${w.toFixed(4)})`);
      c.fillStyle = gg;
      c.fillRect(0, 0, S, S);
    } else cv = null;
  }
  deepHaloCv[col] = cv;
  return cv;
}
function mkDeepStar() {
  return {
    a: Math.random() * TAU,
    rf: DEEP_R0 + Math.random() * (DEEP_R1 - DEEP_R0),
    sz: Math.random() < 0.14 ? rand(1.5, 2.6) : rand(0.5, 1.3),
    al: 0.12 + Math.random() * 0.40,
    warm: Math.random() < 0.16,
    sp: rand(0.8, 1.25),
    // SCINTILLATION. A star field that holds perfectly still is a texture; one
    // that breathes is a sky. Each star gets its own rate and phase so nothing
    // beats in time, and a few are slow BLINKERS that go nearly out and come
    // back — those are the ones the eye catches and follows.
    tw: rand(0.35, 2.6), tp: Math.random() * TAU, blink: Math.random() < DEST_LIFE.blinkP
  };
}
// THE FAR BODIES ARE DESTINATIONS, not paintings of them.
//
// They used to be drawn right here: a dark disc, a gradient for the lit limb, a
// couple of stroked arcs for a ring, a few straight lines for bands. Every dial in
// it was a guess at what the real renderer already computes, and the result read
// as what it was — a cartoon planet parked next to a per-pixel shaded one. The eye
// catches that instantly, because the two objects disagree about what a sphere is.
//
// So a deep-sky world is now dealt from PLANET_TYPES and built by
// buildPlanetSprite, exactly like the world at the end of the bore, only small and
// far and dim. Terrain, cloud, ring shadows, atmosphere on the limb, and above all
// the ONE key light — all of it comes free, and every body in the frame is finally
// the same kind of object lit by the same sun.
//
// The deck is every skin EXCEPT the swarms: an asteroid field is 296 rocks, and at
// the size a deep body gets here its smallest land under a pixel, so it arrives as
// grain rather than as a place.
// !named too: a named world is a specific PLACE, and a copy of it drifting
// anonymously through the deep field would say the opposite
const DEEP_WORLDS = PLANET_TYPES.filter(p => !p.field && !p.named);
// THE SKY'S HAND: a few skins, dealt once and held for the session.
//
// Not a free pick out of the whole deck every time a body recycles, and the reason
// is COST, not taste. Each skin is a per-pixel sprite, and a ringed world takes
// ~20ms to shade even at this size. Dealt freely, a body drifting off the edge
// could hand the very next frame a fresh 20ms build in the middle of a run. Dealt
// from a hand of four, warmed one per frame on the way in (see drawDeepField), a
// recycle can only ever hit the cache.
//
// It reads better too: four bodies drawn from four skins is one region of space,
// where a body that came back as a different world every time it wrapped was a
// slideshow of the catalogue.
let deepHand = null;
function dealDeepHand() {
  if (deepHand) return deepHand;   // held across re-inits — a perf shed must never re-deal
  const deck = DEEP_WORLDS.slice();
  deepHand = [];
  for (let i = 0; i < 4 && deck.length; i++) deepHand.push(deck.splice((Math.random() * deck.length) | 0, 1)[0]);
  return deepHand;
}
// THE WARM QUEUE: every small-body sprite a later frame can ask for — this
// session's deep hand, and the three skins a destination's moon can be dealt. The
// moons belong here and not in their own region because the cost is the same
// cost: a body shaded during a run is a dropped frame, and the only free place to
// pay for one is the home screen.
let warmJobs = null, warmN = 0;
function mkDeepRock() {
  const big = Math.random() < 0.25;  // a couple of nearer ones, the rest far off
  const hand = dealDeepHand();
  return {
    a: Math.random() * TAU,
    rf: DEEP_R0 + Math.random() * (DEEP_R1 - DEEP_R0),
    // SMALLER than the painted ones were. A real world holds up at this size where
    // a gradient disc never did, and the destination has to stay the biggest thing
    // in the sky — anything out here that rivals it is competing for its job.
    sz: big ? rand(0.013, 0.021) : rand(0.006, 0.012),  // fraction of min side
    // Dimmed by distance, but NOT to a ghost. Under about 0.4 a world stops
    // occluding the void behind it and starts reading as a transparency laid over
    // the backdrop — which is the exact failure the painted discs had. The nearer
    // ones carry more of it, and that difference is the other half of the distance
    // cue the size is already making.
    al: (big ? 0.48 : 0.34) + Math.random() * 0.20,
    V: hand[(Math.random() * hand.length) | 0],
    sp: rand(0.7, 1.1)
  };
}
// the CRUISE WISP: a long, very faint, motion-blurred star. This is the whole
// character of the reference's cruise footage — the sky is not points OR streaks,
// it is dense points with a few long soft smears drifting among them. Faint on
// purpose: at cruise the blur is barely there, and anything brighter reads as a
// jump instead of a transit.
function mkDeepWisp() {
  return {
    a: Math.random() * TAU,
    rf: DEEP_R0 + Math.random() * (DEEP_R1 - DEEP_R0),
    len: rand(0.10, 0.42),            // in rf units — scales with distance for free
    al: 0.035 + Math.random() * 0.085,
    w: rand(0.6, 1.9),
    warm: Math.random() < 0.10,
    sp: rand(0.85, 1.2)
  };
}
function initDeepField() {
  // ref 3's sky is DENSE — the old 210 read as a sparse sprinkle against it
  // FEWER WORLDS. Nine bodies in a sky is a solar system seen from inside it, and
  // it made the frame busy in the one layer that is supposed to be empty distance.
  // Four means the frame usually holds one or two, and each one is an event.
  const nS = lowFX ? 150 : 430, nR = lowFX ? 2 : 4, nW = lowFX ? 24 : 74;
  deepStars = []; deepRocks = []; deepWisps = [];
  // SEEDED, same trick and same reason as buildBackground: this is the sky the
  // home screen opens on, and it must be the same sky every load. The layer
  // drifts and recycles off the live clock during play, so two long sessions
  // diverge — but they diverge from the same opening deal.
  const sysRandom = Math.random;
  Math.random = mulberry32(SKY_SEED ^ 0xDEEF);
  try {
    for (let i = 0; i < nS; i++) deepStars.push(mkDeepStar());
    for (let i = 0; i < nR; i++) deepRocks.push(mkDeepRock());
    for (let i = 0; i < nW; i++) deepWisps.push(mkDeepWisp());
  } finally {
    Math.random = sysRandom;
  }
}
initDeepField();
// THE SKY IS DRAWN EVERYWHERE, INCLUDING MENUS. It used to bail on S.MENU, from
// back when the menu was a console rather than a window: you sat at a home screen
// with a baked backdrop and nothing alive in it. The lane is parked out here
// (laneFlow 0), so none of this MOVES on a menu — the wisps, which are pure
// motion smears, take themselves out. What is left is a sky, and it is stars.
//
// THE WORLDS DO NOT SURVIVE THE MENUS. Parked, they hang dead still in frame, and
// a motionless world behind a menu card reads as a decal stuck on the wallpaper —
// the parallax was the only thing selling it as a body with distance behind it. They go for the meta screens and come back with the
// lane. Faded rather than cut: the home screen is one continuous shot out of the
// run, and a planet vanishing between two frames is worse than the planet. Stars
// stay — a point of light needs no parallax to be believed.
function drawDeepField(g, dt) {
  const SR = Math.min(W, H) * 0.5; // NOT S — that is the state enum, and shadowing it TDZs S.MENU above
  const dive = clamp(warpT / 0.9, 0, 1);
  const rate = (state === S.PLAY ? trafficSpeed : 0.4) * DEEP_PARALLAX * (1 + dive * 2.5) * laneFlow;
  // THE ORBIT DRIFT, nearest-layer edition. The pads hang the wrap span past
  // both screen edges so the modulo jump always happens off-frame — a body
  // exits one side, crosses its pad unseen, and re-enters the other. Rocks get
  // a deep pad because a world plus its halo is wide; stars need a sliver.
  const STAR_PAD = 48, ROCK_PAD = Math.min(W, H) * 0.30;
  const deepPan = skyPan * SKY_L.deep;
  const wrapPan = (x, pad) => {
    const p = pad === undefined ? STAR_PAD : pad, span = W + 2 * p;
    return ((x + p) % span + span) % span - p;
  };
  ctx.save();
  // ONE SKIN WARMED PER FRAME, until the queue is empty. Building them all where
  // the hand is dealt would put the cost on the page load, ahead of the first
  // paint; building each where it is first drawn can put one in the middle of a
  // run. A handful of early frames on the home screen is where it is free.
  if (!warmJobs) warmJobs = dealDeepHand().map(V => () => deepWorld(V))
    .concat(MOON_TYPES.map(V => () => moonSprite(V)));
  if (warmN < warmJobs.length) warmJobs[warmN++]();
  worldVis += clamp(dt / 0.5, 0, 1) * ((state === S.MENU || state === S.GUIDE ? 0 : 1) - worldVis);
  // --- worlds first, so stars always pass IN FRONT of them, never behind ---
  if (worldVis > 0.004) for (const rk of deepRocks) {
    rk.rf *= 1 + dt * rate * rk.sp;
    if (rk.rf > DEEP_R1) { Object.assign(rk, mkDeepRock()); rk.rf = DEEP_R0; }
    // worlds drift slower than the loose stars — they are bigger and farther,
    // and the rate split between them IS the depth read
    const px = wrapPan(g.cx + Math.cos(rk.a) * rk.rf * SR + skyPan * 0.6, ROCK_PAD), py = g.cy + Math.sin(rk.a) * rk.rf * SR;
    const rad = Math.min(W, H) * rk.sz * (0.5 + rk.rf * 0.34); // swells as it comes abeam
    const rkEdge = clamp((DEEP_R1 - rk.rf) / DEEP_FADE, 0, 1) * clamp((rk.rf - DEEP_R0) / 0.30, 0, 1);
    if (rkEdge <= 0.01) continue; // faded both ends — never a pop, never a snap
    if (px < -rad * 3 || px > W + rad * 3 || py < -rad * 3 || py > H + rad * 3) continue;
    const al = rk.al * rkEdge * worldVis;
    // ONE globalAlpha over a fully shaded sprite. The old code faded a dozen
    // hand-mixed colours independently, which is how a body ended up with a lit
    // limb brighter than its own daylight side. Dimming the finished world instead
    // is also what distance actually does to it.
    const sp = deepWorld(rk.V);
    ctx.save();
    ctx.globalAlpha = al;
    if (sp) {
      const w = sp.S * (rad / sp.R);   // the canvas carries ring + air pad — scale it whole
      ctx.drawImage(sp.cv, px - w / 2, py - w / 2, w, w);
    } else {
      // no-ImageData fallback, same one drawFarGlow keeps: a disc lit off the world
      // key light. Never seen outside the headless harness, and the deep field must
      // not be able to take a frame down.
      const lg = ctx.createRadialGradient(
        px + Math.cos(LIGHT_A) * rad * 0.62, py + Math.sin(LIGHT_A) * rad * 0.62, 0, px, py, rad * 1.45);
      lg.addColorStop(0, `rgba(${rk.V.z},0.85)`);
      lg.addColorStop(1, 'rgba(14,22,44,0)');
      ctx.fillStyle = lg;
      ctx.beginPath(); ctx.arc(px, py, rad, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }
  // --- the cruise wisps: long soft smears drifting among the points ---
  // Radial, so they agree with the direction of travel, and longer the further
  // out they are — which falls out of scaling their length in rf units.
  for (const wp of deepWisps) {
    wp.rf *= 1 + dt * rate * wp.sp;
    if (wp.rf > DEEP_R1) { Object.assign(wp, mkDeepWisp()); wp.rf = DEEP_R0; }
    const ca = Math.cos(wp.a), sa = Math.sin(wp.a); // wisps are transit smears — the lane's own motion owns them
    const r0 = wp.rf * SR, r1 = (wp.rf + wp.len * (0.35 + wp.rf)) * SR;
    const x0 = g.cx + ca * r0, y0 = g.cy + sa * r0;
    const x1 = g.cx + ca * r1, y1 = g.cy + sa * r1;
    if (Math.max(x0, x1) < -8 || Math.min(x0, x1) > W + 8) continue;
    if (Math.max(y0, y1) < -8 || Math.min(y0, y1) > H + 8) continue;
    const near = clamp((wp.rf - DEEP_R0) / 0.5, 0, 1) * clamp((DEEP_R1 - wp.rf) / DEEP_FADE, 0, 1);
    // × laneFlow: a wisp is a motion smear — a parked lane must not hang them
    const al = wp.al * (0.35 + 0.65 * near) * (1 + dive * 2.2) * laneFlow;
    const col = wp.warm ? '255,226,190' : '206,230,255';
    // PER-WISP GRADIENT, KEPT. The streak taper's unit-space trick was applied here
    // too and reverted after measuring: 74 gradients a frame is not enough to read
    // on device (deepField+traffic moved 1.72 -> 1.74ms, i.e. nothing), where the
    // streaks' 726 a frame is worth 36%. It also needed a width floor, because a
    // sub-pixel pen antialiases differently under a transform (4/255 at lineWidth
    // 0.8, 1/255 at 1.4) — and wisp widths run 0.5-2.75px, so the floor excluded
    // most of them anyway. Not worth a branch and a cache for an unmeasurable gain.
    const grd = ctx.createLinearGradient(x0, y0, x1, y1);
    grd.addColorStop(0, `rgba(${col},0)`);
    grd.addColorStop(0.4, `rgba(${col},${al.toFixed(3)})`);
    grd.addColorStop(1, `rgba(${col},0)`);
    ctx.strokeStyle = grd;
    ctx.lineWidth = wp.w * (0.7 + wp.rf * 0.5);
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  }
  // --- the slow starfield ---
  const baseAl = ctx.globalAlpha; // the halo blit borrows globalAlpha and must give it back
  for (const st of deepStars) {
    st.rf *= 1 + dt * rate * st.sp;
    if (st.rf > DEEP_R1) { Object.assign(st, mkDeepStar()); st.rf = DEEP_R0; }
    // deepPan: this layer is the NEAREST loose sky, so it drifts fastest — the
    // radial travel-parallax and the orbit drift compose, which is exactly what
    // a window full of space does from a ship that is both moving and turning.
    // The wrap span hangs past both screen edges, so the jump always lands
    // off-frame — a star exits right, crosses the pad unseen, re-enters left.
    const px = wrapPan(g.cx + Math.cos(st.a) * st.rf * SR + deepPan), py = g.cy + Math.sin(st.a) * st.rf * SR;
    if (px < -4 || px > W + 4 || py < -4 || py > H + 4) continue;
    // fades up out of the deep AND back down before the recycle edge — both ends
    const near = clamp((st.rf - DEEP_R0) / 0.5, 0, 1) * clamp((DEEP_R1 - st.rf) / DEEP_FADE, 0, 1);
    // Shallow on purpose. The backdrop's own live stars (STAR_CLASS) carry the
    // scintillation now; this layer is the parallaxing deep field in front of it,
    // and two fields twinkling at full depth reads as static, not as sky.
    const depth = DEST_LIFE.twinkle;
    const tw = st.blink
      ? 0.35 + 0.65 * Math.pow(0.5 + 0.5 * Math.sin(time * st.tw * 0.22 + st.tp), 6) // long dim, brief return
      : 1 - depth + depth * (0.5 + 0.5 * Math.sin(time * st.tw + st.tp));
    const al = st.al * (0.45 + 0.55 * near) * tw;
    const col = st.warm ? '255,214,170' : '216,236,255';
    const R = st.sz * (0.7 + st.rf * 0.45);
    // past a point-sized core the rest of the light becomes scatter, so the star
    // grows by reaching further rather than by widening into a coin
    if (R > DEEP_CORE) {
      const hc = deepHalo(col);
      if (hc) {
        const rr = R * DEEP_BLOOM;
        ctx.globalAlpha = baseAl * Math.min(1, al * DEEP_BLOOM_A);
        ctx.drawImage(hc, px - rr, py - rr, rr * 2, rr * 2);
        ctx.globalAlpha = baseAl;
      }
    }
    ctx.fillStyle = `rgba(${col},${al.toFixed(3)})`;
    ctx.beginPath(); ctx.arc(px, py, Math.min(R, DEEP_CORE), 0, TAU); ctx.fill();
  }
  ctx.restore();
}

// ---------- THE TAPER, BUILT ONCE INSTEAD OF 726 TIMES A FRAME ----------
// Measured on device (OPPO CPH2581, Android 16, 2026-08-03): drawStreaks was 42.5%
// of the frame, and ablating ONLY its gradient construction (?abl=grad) bought
// -24.8% — statistically the same as deleting the whole streak field (-26.9%).
// So the eight additive stroke passes and all that fill are nearly free on a mobile
// GPU; the entire bill was building 726 CanvasGradients per frame, each with five
// addColorStop()s fed a freshly-allocated rgba() string the backend must CSS-parse.
//
// The fix rests on one fact: a CanvasGradient resolves its coordinates in the user
// space IN EFFECT WHEN IT IS PAINTED, not when it was created. So the taper need
// not know where the streak is — build it once from (0,0) to (1,0) and let the
// transform carry it onto the segment. One gradient per colour, for the life of
// the process, and the profile is byte-for-byte the profile that was there before.
//
// ctx is rebindable (withCanvas swaps it for the offscreen bakes and the labs), and
// a gradient belongs to the context that made it — so the cache is dropped if the
// context underneath it changes.
let streakGrads = {};
let streakGradCtx = null;
function streakTaper(col) {
  if (streakGradCtx !== ctx) { streakGradCtx = ctx; streakGrads = {}; }
  const hit = streakGrads[col];
  if (hit) return hit;
  const gr = ctx.createLinearGradient(0, 0, 1, 0);
  gr.addColorStop(0, `rgba(${col},1)`);       // the star
  gr.addColorStop(0.12, `rgba(${col},0.92)`);
  gr.addColorStop(0.42, `rgba(${col},0.42)`); // the trail thinning
  gr.addColorStop(0.75, `rgba(${col},0.12)`);
  gr.addColorStop(1, `rgba(${col},0)`);       // gone
  streakGrads[col] = gr;
  return gr;
}
// The original, still needed below a couple of pixels of length — see the note at
// the call site for why that case cannot go through the transform.
function streakTaperAt(col, x1, y1, x2, y2) {
  const gr = ctx.createLinearGradient(x1, y1, x2, y2);
  gr.addColorStop(0, `rgba(${col},1)`);
  gr.addColorStop(0.12, `rgba(${col},0.92)`);
  gr.addColorStop(0.42, `rgba(${col},0.42)`);
  gr.addColorStop(0.75, `rgba(${col},0.12)`);
  gr.addColorStop(1, `rgba(${col},0)`);
  return gr;
}

function drawStreaks(g, dt) {
  // a wounded convoy is a thinner, dimmer river
  const riverK = state === S.PLAY ? 0.35 + 0.65 * clamp(integrity / 100, 0, 1) : 1;
  const spd = (state === S.PLAY ? trafficSpeed : 0.4) * laneFlow;
  // the ambient smear is SPEED-COUPLED. A fixed-length streak reads as texture
  // no matter how fast the lane runs; a streak that STRETCHES with the traffic
  // reads as velocity. This one number is what makes a fast level feel fast
  // rather than merely busy — and it is what lands the STOP: as laneFlow brakes,
  // every smear collapses back into the star making it, which is precisely what
  // dropping out of warp looks like. Parked (menus), the field is still points.
  const ambSpan = (0.11 + spd * 0.34) * laneFlow;
  for (const st of streaks) {
    const wsp = 1 + (warpT / 0.9) * 5; // warp-dive stretch
    // per-star length, so no two smears are the same size
    const span = (st.gold ? 0.05 : ambSpan * st.lenK) * (1 + (warpT / 0.9) * 3);
    let dz = dt * spd * st.sp * wsp; // the river flows WITH the traffic
    if (st.z + span < EXIT_Z) dz = Math.min(dz, EXIT_CAP); // never a sub-frame exit
    st.z -= dz;
    // RECYCLE ON THE TAIL, NOT THE HEAD. This is the whole reason warp lines kept
    // vanishing in front of the viewer, and no amount of alpha work was ever going
    // to fix it. A streak is a LINE: its head is at z, its tail at z+span. Recycling
    // when the head cleared the frame threw away a hero streak whose tail was still
    // at z≈0.6 — dead centre of the screen. The longest, brightest lines popped the
    // hardest, which is precisely the ones you notice.
    //
    // So the streak lives until its TAIL has gone, and the head is PINNED at the
    // projection floor meanwhile. Pinning is safe because the floor is already far
    // off-screen, and it is necessary because ring()'s scale is 1/(1 + z*6), which
    // divides by zero at z = -1/6 and goes NEGATIVE past it — an unpinned head
    // would flip to the opposite side of the bore.
    //
    // The visible line therefore shortens from the head end as it leaves. That is
    // what flying out of frame actually looks like.
    if (st.z + span <= Z_FLOOR) {
      st.z = 1;
      if (st.gold) st.off = riverOff();
      continue; // nothing to draw on the frame it respawns
    }
    // the convoy's angle is DERIVED, every frame, from where in the channel this
    // ship runs — that is what makes the board's spread dial move the whole river
    // instead of only the ships that happen to recycle while you are dragging it
    if (st.gold) st.a = Math.PI / 2 + st.off * RIVER.spread;
    // THE CONVOY ONLY EXISTS UNDER WAY. The gold river is traffic running the
    // lane with us — parked in a menu there is no convoy to see, so it fades out
    // with the flow and leaves clean starfield behind.
    if (st.gold && (st.ord > riverK || laneFlow < 0.02)) continue;
    const zH = Math.max(st.z, Z_FLOOR);
    const zT = Math.max(Math.min(st.z + span, 1), Z_FLOOR);
    const r1 = ring(zH, g), r2 = ring(zT, g);
    // rmul is the fix for "stars aligned in circles": each star keeps its OWN
    // distance from the axis, held across both ends of its smear so the line
    // still runs true along the direction of travel.
    const rm = st.gold ? rand(0.86, 0.99) : st.rmul;
    const rr1 = r1.r * rm;
    const x1 = r1.x + Math.cos(st.a) * rr1, y1 = r1.y + Math.sin(st.a) * rr1;
    const x2 = r2.x + Math.cos(st.a) * r2.r * rm, y2 = r2.y + Math.sin(st.a) * r2.r * rm;
    // THE BANKS, at RIVER.bank. Off by default — the river has always ended where
    // it ends. Wound up, alpha falls with the SQUARE of the distance from
    // mid-channel, so the middle keeps full weight and only the outer third dims.
    const bank = st.gold ? Math.max(0, 1 - RIVER.bank * st.off * st.off) : 1;
    // no near-fade on the warp lines: the `clamp(1 + z/0.1)` term that used to be
    // here is exactly what made them dissolve in front of the viewer
    const al = st.gold
      ? Math.min(1 - zH, 1.05) * 0.75 * clamp(1 + zH / 0.1, 0, 1) * laneFlow * bank
      : Math.min(1 - zH, 1.05) * 0.46 * st.br; // translucent: you see stars THROUGH a warp line
    if (st.gold) {
      ctx.strokeStyle = `rgba(255,196,88,${al.toFixed(2)})`;
      ctx.lineWidth = lerp(0.5, 2.6, 1 - zH);
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    } else {
      // the live warp lines: a STACK of narrow additive strokes, light blue
      // outside to white-hot core. Never one wide stroke — that is a capsule, and
      // a capsule reads as a flat surface. Calibre is per-star now, so the field
      // has heavy hero lines and fine ones instead of one uniform gauge.
      // The original 1.55 cap existed because a single wide pass carried real
      // alpha and turned into a capsule. With eight passes and the widest at 0.010
      // alpha, a broad stroke is a breath of glow rather than a surface, so shafts
      // are allowed to get genuinely wide. Still capped, just far higher.
      const k = Math.min(9, lerp(0.6, 1.25, 1 - zH) * st.cal);
      // THE TAPER — this is what makes a smear a smear.
      //
      // Every pass used to be a flat rgba() stroke: uniform alpha from head to
      // tail, which is a SOLID LINE by construction. No stack of them, however
      // soft or wide, could ever read as a star's trail, because a trail is
      // defined by fading out behind the thing making it.
      //
      // Each stroke now runs a gradient from the leading end (x1/y1, the star
      // itself) back to the trailing end (x2/y2, deeper down the bore) where it
      // reaches zero. One gradient is built per colour the star uses and reused
      // across the passes that share it, with globalAlpha carrying each pass's
      // weight — three gradients per star rather than six.
      const dx = x2 - x1, dy = y2 - y1;
      const len = Math.hypot(dx, dy);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round';
      // UNIT SPACE ABOVE A COUPLE OF PIXELS, THE OLD PATH BELOW IT.
      //
      // [dx, dy; -dy, dx] is a pure rotation times a UNIFORM scale of len — its
      // determinant is len². Uniform is the whole point: a non-uniform map would
      // give an elliptical pen and elliptical round caps, and the smear would stop
      // matching. lineWidth is divided by len so len × (w·k/len) lands back on
      // exactly the w·k it was before. transform(), never setTransform() — the
      // ambient DPR matrix, the shake translate and the replay world-zoom all live
      // in the current transform and must be composed with, not replaced.
      //
      // The floor exists because of the PARKED case, not for safety margin: on a
      // menu laneFlow → 0, so ambSpan → 0 and every smear collapses to a
      // sub-pixel segment under a pen up to a hundred wide. The five stops then
      // compress into less than a pixel and the painted result is a lopsided dot —
      // which IS the parked look, and reproducing it through the transform would
      // ask the rasteriser for a hundred-thousand-pixel pen. Play is where the
      // measured 24.8% lives, and in play every smear is far past this floor.
      // ?abl=nounit forces the pre-2026-08-03 path — a real gradient rebuilt per
      // streak per frame — so the cached-vs-rebuilt delta can be measured
      // INTERLEAVED against the current code in one session. Comparing across two
      // sessions cannot separate the win from the phone warming up, and on this
      // hardware the drift is the same order as the win.
      const unit = len >= 2 && !abl('grad') && !abl('nounit');
      if (unit) ctx.transform(dx, dy, -dy, dx, x1, y1);
      const grads = unit ? null : [];
      const pi0 = abl('passes') ? LIVE_WARP_PASSES.length - 1 : st.p0;
      for (let pi = pi0; pi < LIVE_WARP_PASSES.length; pi++) {
        const [w, ci, aMul] = LIVE_WARP_PASSES[pi];
        const a2 = al * aMul;
        if (a2 < 0.008) continue;
        const col = ci === 2 ? '255,255,255' : st.tint[ci];
        ctx.globalAlpha = Math.min(1, a2);
        if (unit) {
          ctx.strokeStyle = streakTaper(col);
          ctx.lineWidth = (w * k) / len;
          ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(1, 0); ctx.stroke();
        } else {
          if (!grads[ci]) grads[ci] = abl('grad') ? `rgba(${col},1)` : streakTaperAt(col, x1, y1, x2, y2);
          ctx.strokeStyle = grads[ci];
          ctx.lineWidth = w * k;
          ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
      ctx.restore();
    }
    // hot core on the nearest gold particles
    if (st.gold && zH < 0.35) {
      ctx.strokeStyle = `rgba(255,238,190,${(al * 0.7).toFixed(2)})`;
      ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    }
    // the LEADING HEAD on a near ambient streak: the point the star still
    // occupies before the smear behind it. A streak with a head has a direction;
    // a bare line is ambiguous, and ambiguity is what made the old wall read flat.
    //
    // It is a GRADIENT, never a filled disc — a hard-edged circle at the end of a
    // soft ribbon reads as a snowball stuck to it. And it scales with sqrt of
    // calibre, capped: calibre is a WIDTH property, and a shaft nine strokes wide
    // does not have a head nine times bigger, it has a slightly stronger glow.
    // At speed only near streaks carry a head; parked, the reach opens to the
    // whole bore so the becalmed lane reads as a field of still stars, not a void.
    const headZ = 0.55 + 0.45 * (1 - laneFlow);
    if (!st.gold && zH < headZ && !abl('heads')) {
      const hk = clamp(1 - zH / headZ, 0, 1) * Math.min(2, Math.sqrt(st.cal || 1));
      // parked, these ARE the sky — so they scintillate like it. At speed they are
      // smears, where a twinkle would just read as flicker, so it fades in with the
      // stop. Phase comes off the star's own angle: no extra state to carry.
      const tw = 1 - (1 - laneFlow) * 0.4 * (0.5 + 0.5 * Math.sin(time * (1.1 + st.rmul) + st.a * 7.3));
      const ha = Math.min(1, al * hk * 0.9 * tw);
      if (ha > 0.01) {
        // LEFT AS A PER-STAR GRADIENT, DELIBERATELY. A baked sprite was built and
        // measured on device (2026-08-03) and reverted: interleaved against this
        // path it came out 0.15ms apart — inside the run-to-run spread, and
        // actually SLOWER in two reps of three. The earlier -7.1% from ?abl=heads
        // was the cost of the head's composite fill, which a sprite still pays;
        // only the gradient construction goes away, and unlike the taper below
        // there is one of these per star rather than three. So the sprite bought
        // nothing measurable while shifting pixels by up to 3/255 and adding 147KB
        // of bakes. If heads ever need to get cheaper, the lever is drawing fewer
        // or smaller ones — which changes the look and is a design decision.
        const hr = Math.max(1.2, 2.6 * hk);
        const hg = ctx.createRadialGradient(x1, y1, 0, x1, y1, hr);
        hg.addColorStop(0, `rgba(255,255,255,${ha.toFixed(3)})`);
        hg.addColorStop(0.35, `rgba(${st.tint[1]},${(ha * 0.4).toFixed(3)})`);
        hg.addColorStop(1, `rgba(${st.tint[0]},0)`);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = hg;
        ctx.beginPath(); ctx.arc(x1, y1, hr, 0, TAU); ctx.fill();
        ctx.restore();
      }
    }
  }
}

// ---------- THE LANE MEDIUM: what makes it space instead of a diagram ----------
// Warp lines alone read as technical — a clean radial hatch, evenly lit, all one
// material. Real space is filthy: gas you fly through, dust that catches the
// light, chunks tumbling past close enough to see them turn. This layer is that
// mess, and it rides the same z axis as everything else so it shares the bore's
// perspective for free.
//
// Both sets fade IN from the deep and never fade out — like the warp lines, they
// fly past the camera rather than dissolving in front of it.
const GAS_COLS = [
  '64,148,190',   // cold teal
  '148,88,180',   // violet
  '190,138,78',   // warm dust
  '82,116,200',   // deep blue
  '178,98,112',   // rose
  '70,170,150'    // green-teal
];
let gasWisps = [];
function mkGas() {
  return {
    a: Math.random() * TAU, z: Math.random(),
    rmul: rand(0.30, 1.65),
    sz: rand(0.16, 0.58),                 // radius as a fraction of the ring radius
    stretch: rand(1.5, 3.4),              // drawn out along travel
    col: GAS_COLS[Math.random() * GAS_COLS.length | 0],
    al: 0.020 + Math.random() * 0.055,
    sp: rand(0.5, 0.9)                    // gas LAGS the stars — parallax between layers
  };
}
// (the debris chunks are GONE. Angular polygons tumbling at the camera read as
// "weird polygons flying towards me" rather than as rock — at the size and speed
// they passed there was never enough silhouette to sell them as anything. The
// lane's texture comes from gas and the starfield instead.)
function initLaneMedium() {
  const nG = lowFX ? 10 : 26; // more gas now that it carries the medium alone
  gasWisps = [];
  for (let i = 0; i < nG; i++) gasWisps.push(mkGas());
}
initLaneMedium();
function drawLaneMedium(g, dt) {
  if (state === S.MENU) return;
  const exitK = 1 - laneExit(); // the medium is what the LANE is full of
  if (exitK <= 0.004) return;
  const spd = (state === S.PLAY ? trafficSpeed : 0.4) * laneFlow;
  const wsp = 1 + (warpT / 0.9) * 5;
  const dive = clamp(warpT / 0.9, 0, 1);
  // --- gas first: everything else moves through it ---
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const gs of gasWisps) {
    gs.z -= dt * spd * gs.sp * wsp;
    if (gs.z <= -0.14) { Object.assign(gs, mkGas()); gs.z = 1; }
    const rg = ring(gs.z, g);
    const rad = rg.r * gs.sz;
    if (rad < 2) continue;
    const px = rg.x + Math.cos(gs.a) * rg.r * gs.rmul;
    const py = rg.y + Math.sin(gs.a) * rg.r * gs.rmul;
    const reach = rad * gs.stretch;
    if (px < -reach || px > W + reach || py < -reach || py > H + reach) continue;
    const al = gs.al * Math.min(1, (1 - gs.z) * 3.2) * (1 + dive * 1.4) * exitK; // fades in, never out
    if (al < 0.002) continue;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(gs.a);              // long axis lies along the direction of travel
    ctx.scale(gs.stretch, 1);
    const grd = ctx.createRadialGradient(0, 0, 0, 0, 0, rad);
    grd.addColorStop(0, `rgba(${gs.col},${al.toFixed(4)})`);
    grd.addColorStop(0.45, `rgba(${gs.col},${(al * 0.45).toFixed(4)})`);
    grd.addColorStop(1, `rgba(${gs.col},0)`);
    ctx.fillStyle = grd;
    ctx.beginPath(); ctx.arc(0, 0, rad, 0, TAU); ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}


// ---------- THE HANDLER'S BARKS ----------
// Replaces 113 lines of scripted chatter that fired on a fixed clock. The lane
// channel stops carrying story and starts carrying REACTION: the handler comments
// on what just happened, or says nothing at all.
//
// Two rules here are correctness, not taste, and both come from the same fact —
// campaign levels reseed Math.random with mulberry32, so Math.random IS the sim
// RNG and the replay verifier reruns it:
//
//   1. DRAW-ONLY. Nothing in here may touch sim state or advance any RNG. Every
//      trigger is a POLL of state that already exists; no spawner is hooked, so
//      the sim cannot tell whether barks are on.
//   2. VARIANT CHOICE IS A COUNTER, NOT A ROLL. BARKS[id][n++ % len]. A roll here
//      would desync every replay and invalidate leaderboard submissions.
//
// Beyond that: never queue (a stale bark comments on something that stopped being
// true), priority interrupts, and silence is fine — a quiet run is a clean run.
const BARKS = {
  deploy:      ['lane is yours, runner.', "clock's running. keep it clean.",
                "we're live. eyes up.", 'corridor is hot. go.'],
  firstHeavy:  ['armor inbound. both emitters.', "that one's plated. hold the bolt.",
                "heavy. you'll need the pair."],
  firstLine:   ['barrier strung. take an end each.', 'pair job. split the emitters.',
                'two ends, two emitters.'],
  firstWall:   ['wall forming. reroute.', "they're sealing the rail. move.",
                'clamp coming down. get off it.'],
  firstFrag:   ["black charge. don't touch it.", 'emitter killer on the rail. steer.',
                'that one bites. go around.'],
  ribbon:      ['clean current. ride it.', 'gold on the lane. take it.',
                'free charge. go get it.'],
  pickup:      ['good grab.', "that'll hold.", 'logged.', 'useful.'],
  streak:      ["you're ahead of them.", 'nice line.', 'keep that rhythm.',
                "they can't place a hit."],
  cleanHalf:   ["halfway. nothing's through.", "convoy's intact. stay on it.",
                'clean so far. hold it.'],
  nodeLost:    ["emitter's down. hold what's left.", "we're one short. tighten up.",
                "lost one. don't lose the lane."],
  lastStretch: ["final stretch. they'll throw everything.",
                "almost home. don't ease off.", 'last leg. finish it.'],
  bossOpen:    ["that's the core. six hits.", 'there it is. dock and hold.'],
  bossLow:     ["it's failing. finish it.", 'one more. put it down.'],
  win:         ["lane's clear. good work.", 'convoy delivered. logged.'],
  loss:        ["lane's gone. we'll re-run it.", 'they got through. again.']
};
// pri 1 = highest · cd = per-trigger cooldown · once = at most once per run
const BARK_CFG = {
  deploy:      { pri: 5, cd: 0,  once: 1 },
  firstHeavy:  { pri: 3, cd: 8,  once: 1 },
  firstLine:   { pri: 3, cd: 8,  once: 1 },
  firstWall:   { pri: 2, cd: 8,  once: 1 },
  firstFrag:   { pri: 2, cd: 8,  once: 1 },
  ribbon:      { pri: 4, cd: 12, once: 1 },
  pickup:      { pri: 6, cd: 20, once: 0 },
  streak:      { pri: 4, cd: 25, once: 0 },
  cleanHalf:   { pri: 5, cd: 0,  once: 1 },
  nodeLost:    { pri: 1, cd: 6,  once: 0 },
  lastStretch: { pri: 4, cd: 0,  once: 1 },
  bossOpen:    { pri: 1, cd: 0,  once: 1 },
  bossLow:     { pri: 1, cd: 0,  once: 1 },
  win:         { pri: 1, cd: 0,  once: 1 },
  loss:        { pri: 1, cd: 0,  once: 1 }
};
const barkHold = 4;              // reactive lines go stale fast
let barkN = {}, barkAt = {}, barkFired = {}, barkGlobal = 0, barkPri = 9, barkSeen = {};
function resetBarks() { barkN = {}; barkAt = {}; barkFired = {}; barkGlobal = 0; barkPri = 9; barkSeen = {}; }
function bark(id) {
  const cfg = BARK_CFG[id]; if (!cfg) return;
  if (cfg.once && barkFired[id]) return;
  if (barkGlobal > 0) return;                       // global 7s floor
  if ((barkAt[id] || -99) + (cfg.cd || 0) > levelT) return;
  // priority interrupts: equal or lower is DROPPED, never queued
  if (commCur && cfg.pri >= barkPri) return;
  const pool = (CAMP && CAMP.barks && CAMP.barks[id]) || BARKS[id];
  if (!pool || !pool.length) return;
  const n = (barkN[id] = (barkN[id] || 0) + 1) - 1;
  commCur = { s: 'CMD', m: pool[n % pool.length] };  // counter, never a roll
  commT = 0; barkPri = cfg.pri; barkGlobal = 7;
  barkAt[id] = levelT; barkFired[id] = 1;
}
// Everything below is a POLL. No spawner is hooked and no sim value is written,
// so the run plays out identically whether or not anyone is listening.
function updateBarks(dt) {
  if (barkGlobal > 0) barkGlobal = Math.max(0, barkGlobal - dt);
  if (!commCur) barkPri = 9;
  if (state !== S.PLAY || tut) return;
  const L = LV || LEVELS[levelIdx];
  if (boss) {
    bark('bossOpen');
    if (boss.hp <= 1) bark('bossLow');
    return;                                          // the warden owns the channel
  }
  if (levelT > 1.5) bark('deploy');
  // first-of-kind: read the live wave rather than hooking the spawner
  for (const e of enemies) {
    if (e.dead || e.resolved) continue;
    if (e.type === 'heavy') bark('firstHeavy');
    else if (e.type === 'frag') bark('firstFrag');
    else if (e.type === 'line') bark('firstLine');
    else if (e.type === 'strip') bark('ribbon');
  }
  // a rim wall is live when the ring has a seized arc — read the enemy list for
  // the wall type rather than hooking the beat that schedules it
  for (const e of enemies) if (!e.dead && e.type === 'wall') { bark('firstWall'); break; }
  if (combo >= 10) bark('streak');
  if (integrity < 100 && !barkSeen.hurt) { barkSeen.hurt = 1; }
  if (barkSeen.hurt && integrity < barkSeen.lastInt) bark('nodeLost');
  barkSeen.lastInt = integrity;
  // a power-up landing shows up as an effect timer or a shield charge appearing —
  // no counter needs to be added to the sim to notice it
  const armed = (fx.wide > 0 ? 1 : 0) + (fx.auto > 0 ? 2 : 0) + (fx.chain > 0 ? 4 : 0) + (shieldCharge > 0 ? 8 : 0);
  if (armed && armed !== barkSeen.armed) bark('pickup');
  barkSeen.armed = armed;
  if (!endless && L && L.duration) {
    const f = levelT / L.duration;
    if (f > 0.5 && integrity >= 100) bark('cleanHalf');
    if (f > 0.85) bark('lastStretch');
  }
}
