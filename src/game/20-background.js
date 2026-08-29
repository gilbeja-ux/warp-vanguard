'use strict';
// ---------- background (deep data-space behind the tunnel walls) ----------
let bgCanvas = null, vignetteCanvas = null, wallTex = null, wallCloud = null;
let ringFxCv = null, grainCv = null; // prerendered monolith ring + film-grain tile
// …and the viewport that ring was built for. The ring is the hardware the whole
// game is mounted on, so "which size is it" and "did the build succeed" are two
// questions that must be answerable — see ringFx().
let ringFxSig = '', ringFxTried = '';
// A DENSER SKY FOR THE SCREENS THAT ARE MOSTLY SKY.
//
// On a menu the backdrop IS the picture — the bore is not there to fill the middle
// and the eye has nothing to do but read the star field. In the lane the same sky
// is peripheral, mostly behind a wall, and every live star there is per-frame work
// competing with the run.
//
// So the extra population is its own layer: baked into its own sheet and held in
// its own live array, drawn only for the meta screens. The lane pays nothing for
// it. It is placed by the same pass as the main field, off the same galactic band,
// so it is more of the same sky rather than a second sky laid over the first.
let menuSky = null, menuStars = [];
// Eased, never switched. The home screen is one continuous shot out of a run, and
// half a sky appearing between two frames is exactly the pop drawDeepField's
// worldVis was written to avoid — this is that idea, inverted.
let menuSkyVis = 0;
const MENU_STARS = 2200;   // on top of the 1500 everywhere
// THE SKY IS A PLACE, NOT A ROLL OF WALLPAPER. Every load and every device
// rotation used to deal a brand-new sky — buildBackground re-ran its scatter
// straight off Math.random. Baked once per session would still be wrong; the
// game's own rule (relays, moons, city lights) is that a place looks the same
// every time you come back. One fixed seed, swapped in around the build, and
// the sky is the same sky tonight, tomorrow, and after a rotation.
const SKY_SEED = 0x57A22;
// THE SQUADRON IS UNDER WAY — ALWAYS. The sky's motion used to be an orbit: a
// slow sideways pan with depth-split drift rates, the camera riding the lane's
// curve at a relay. Retired 2026-08-02 — Gil: the panning never read as travel.
// What replaced it is the simplest honest thing: we are FLYING, slowly, toward
// the horizon the bore points at, and the sky is two populations split by
// distance:
//
//   · THE FAR FIELD HOLDS STILL. The galactic band, the nebulae, the baked
//     star sheets and their live twinkling half are light-years out — flying
//     forward moves none of them. Their life is scintillation, not travel.
//   · THE NEAR FIELD COMES AT US. The warp blanket (WARP_* below) no longer
//     switches on with the lane: it runs ALWAYS, throttled by laneFlow — a
//     station-keeping crawl on the menus, the full rush under way. Real 1/z
//     projection, so a near star sweeps out fast while a far one creeps for a
//     minute: that IS the parallax, and a launch is now a throttle push on a
//     sky already moving instead of a different sky fading in.
//
// IT LOOPS BY CONSTRUCTION. A blanket star that reaches the canopy or leaves
// the frame is re-dealt at the far plane, forever — there is no strip to wrap
// and no seam to hide, so the cruise never repeats and never ends.
//
// Everything outside the hull flies; nothing inside does. The bore, the ring,
// the HUD, the vignette and the lane's own traffic are the ship's frame, and
// the refraction spikes stay screen-aligned because the streak lives in the
// canopy, not in the star.
const SKY_WS = 1.6;                    // strip width, in screens. The sheets keep
                                       // their off-frame margin: the bake's seam
                                       // discipline (wrapXs) is built on it, and
                                       // the held-out live stars share its space
const SKY_L = { struct: 0.32, clouds: 0.45, bake: 0.55, deep: 1.5 };
                                       // the retired pan rates — every reader
                                       // multiplies them by a pan of zero now
let skyPan = 0;                        // FROZEN AT ZERO: the far field does not
                                       // slide under forward flight. Kept as a
                                       // variable because the strips, the live
                                       // stars and the deep field all key their
                                       // offsets off it — one zero here beats
                                       // deleted math at four sites
let skyStruct = null;                  // the far structure strip (band + dust)
let skyClouds = null;                  // the nebula strip, one plane nearer
let skyW = 0;                          // strip width in px, set by the bake
// (the drifting screen motes are GONE with the rest of the fiber theme. Eighteen
// dots sliding UP the frame on their own blinking cycle made sense as data rising
// through a feed; against a star field they were the only things in the sky moving
// in a straight line, and they read as exactly what they were — sprites.)
// SCINTILLATION, STAR BY STAR.
//
// The backdrop bakes ~1500 stars into a canvas, so the first two attempts at this
// were invisible: anything drawn live on top is a rounding error against a static
// field that size. The third attempt fixed the visibility by modulating a COPY of
// the whole sky — and that is exactly what made it wrong. A sky where every star
// brightens and dims on the same clock is not a sky, it is a dimmer switch.
//
// So: a share of the backdrop is held OUT of the bake and drawn live, at the same
// positions, in the same colours, with the same distribution — and each of those
// stars gets its own rate, its own phase, and its own amplitude. Nothing is
// synchronised with anything. Drawn in place, under the lane, so the depth order
// of the sky is untouched.
//
// What makes it read as sky rather than as blinking lights:
//   · two incommensurate rates per star, so no star ever repeats its own pattern
//   · amplitude by class — most barely move, a few really swim, a handful sit
//     dead still (bright planets do not twinkle, and having some anchors is what
//     makes the movement in the others read as movement)
//   · A GATE, which is the whole timing of the thing: a star is not permitted to
//     scintillate continuously. Every one carries two very slow, incommensurate
//     gate waves, and it only twinkles while their PRODUCT is open — roughly an
//     eighth of the time, at intervals that never repeat. A sky where every star
//     is always shimmering is a screensaver; the effect only reads as atmosphere
//     when most of the field is dead still and the movement wanders around it.
//   · the brightest ones shift COLOUR slightly as they scintillate, warm to cool,
//     which is what a real bright star does through atmosphere and is the single
//     most convincing detail in the whole effect
let liveStars = [];
// class table: [share, amplitude range, rate range].
//
// A star FLARES as well as dims — amplitude runs both ways around its baseline,
// so at the top of a cycle it is brighter than it was ever painted. That is what
// makes a field sparkle rather than merely fade; a star that only ever subtracts
// light reads as something switching off.
//
// Rates are seconds, not tens of seconds. Real scintillation is quick — at the
// first cut's 0.15 rad/s a star took forty seconds to complete one swing, which
// is not twinkling, it is weather.
// Amplitudes above 1 are deliberate and are the point of the whole rebalance: a
// star at amp 1.2 goes fully OUT at the bottom of its swing and comes back to
// well over its painted brightness at the top. That is a star scintillating.
// Anything under ~0.5 is a dimmer being nudged, which is what a dark sky full of
// gently-breathing dots looked like — present in the code, invisible on a phone.
const STAR_CLASS = [
  [0.18, [0.00, 0.00], [0.0, 0.0]],   // steady: the anchors the movement is read against
  [0.36, [0.30, 0.55], [0.9, 2.6]],   // gentle — the body of the field
  [0.32, [0.60, 1.00], [1.3, 4.4]],   // lively: down to nothing, back to full
  [0.14, [1.05, 1.55], [0.6, 2.2]]    // dramatic: hard out, hard flare over the painted level
];
// GATE. Two slow waves per star, multiplied: open only where both happen to be
// high. Periods of 50–140s and no common factor, so a star's bursts never land
// on a schedule and no two stars agree about when to have one. Below GATE_T it
// is dead still; by GATE_1 it is at full class amplitude, smoothstepped between
// so a burst arrives and leaves rather than switching on. These two numbers are
// the density dial: ~30% of a star's life inside a burst, so roughly a quarter
// of the field is working at any moment and the rest is holding still.
const GATE_T = 0.10;
// HOW A STAR BLINKS: IN PAIRS, OVER AND OVER, NOT IN TRAINS.
//
// The gate decides WHEN a star may scintillate; it used to also decide for how
// long, and that was the bug. An open window is tens of seconds wide and the star
// swung at its class rate for every one of them — measured at 4.6 flashes per
// window on the slowest class and 24 on the fastest, peaking at 33 in a row. That
// is not a star through atmosphere, it is a blinking light.
//
// The first fix went too far the other way: ONE pair per open window left a star
// blinking twice every ninety seconds, which dropped the field from ~40% of stars
// working at any instant to ~5% — visibly nothing. The pair is the right unit; it
// just has to REPEAT while the window is open.
//
// So the burst cycles: STAR_BLINKS swings, a rest, and again, for as long as the
// gate holds. The rest is what makes two flashes read as a PAIR rather than as
// the beginning of a train — at 1.0 it is twice the interval between the pair's
// own two flashes, which is the ratio the eye groups on. Any shorter and the
// pairs run together into the train this is fixing.
//
// GATE_T pays for the rest. Half the cycle is now silent, so the threshold drops
// to keep the field as busy as it was: 0.10 opens ~55% of a star's life against
// the old 0.22's ~40%, and 55% × 50% duty lands at ~27% of the field working —
// the same order as the ~40% it replaces, with every event a clean double.
const STAR_BLINKS = 2;
const BURST_PH = STAR_BLINKS * TAU;
const BLINK_GAP = 1.0;                      // rest between doubles, in burst lengths
const CYCLE_PH = BURST_PH * (1 + BLINK_GAP);
// how bright the sky sits when nothing is happening (see the bake). The headroom
// this buys is the other half of the effect — amplitude alone cannot make a
// twinkle visible on a field that is already near its ceiling.
const STAR_REST = 0.62;
// the five colours the whole sky is painted in — the baked field, the live half,
// the close passes and the lane's own blanket all deal from this one table, so
// every star in the game is the same kind of object however it is moving.
const STAR_COLS = ['210,228,255', '255,240,220', '255,208,168', '214,198,255', '190,240,255'];
// ...DEALT BY WEIGHT, never uniformly. A real field is white and blue-white with
// the odd tinted giant; picking 1-in-5 peach and 1-in-5 violet made 40% of the
// bright population visibly COLOURED, and a sky of evenly-sized pastel discs is
// confetti. Weights per index above: cold blue-white, warm white, peach giant,
// violet rarity, icy blue.
const STAR_COL_W = [0.32, 0.30, 0.12, 0.08, 0.18];
function starColI(rnd) {
  let r = rnd(), i = 0;
  for (; i < STAR_COL_W.length - 1; i++) { if (r < STAR_COL_W[i]) break; r -= STAR_COL_W[i]; }
  return i;
}
// THE VIEWPORT UNIT. Star sizes used to be absolute CSS pixels — bloomR 13 on a
// desktop window is a highlight, on a phone's 310px-tall landscape frame it is
// 8% of the sky, and a hundred of those in five candy colours is sprinkles, not
// stars. Everything about a star that has a SIZE scales by this; counts and
// alphas do not (density per screen is a framing choice, and it was right).
// Capped at 1 — the desktop look is the reference, big monitors don't inflate.
let skyUnit = 1;
// WHAT A BRIGHT STAR LOOKS LIKE UP CLOSE. The bloom used to be one number in the
// draw loop: an 8px disc at 0.42 alpha with a linear falloff, which is a small
// bright coin with an edge you can find. These are the dials for the scattered
// version — reach, peak, and the refraction streak that only shows at full flare.
const STARFX = {
  bloomR: 13,        // how far the halo reaches, in px at rest flare
  bloomA: 0.30,      // its peak alpha at the core. Under half the LIGHT of the
                     // disc it replaced once the falloff below is integrated
  spike: 0.24,       // refraction streak strength (0 kills it entirely)
  spikeW: 1.1,       // and how fine that streak is
  // How far it runs, in halo radii. Past about 2 it stops being a star and starts
  // being a lens flare. (Last key, comment above it on purpose: the tuning board
  // reads `key: literal` pairs and a trailing comment on the final line hides it.)
  spikeR: 1.7
};
// The halo's falloff, as [stop, weight]. Kept out of the loop because it is a
// CURVE, not a dial: an exponential shoulder that puts most of the light in the
// inner quarter and lets the rest trail to nothing well inside the radius, so the
// gradient can never present an edge.
const STAR_HALO = [[0, 1], [0.10, 0.62], [0.24, 0.30], [0.44, 0.11], [0.70, 0.028], [1, 0]];
function starClass() {
  let r = Math.random(), i = 0;
  for (; i < STAR_CLASS.length - 1; i++) { if (r < STAR_CLASS[i][0]) break; r -= STAR_CLASS[i][0]; }
  const [, amp, rate] = STAR_CLASS[i];
  const r1 = rand(rate[0], rate[1]) || 0.001, r2 = rand(rate[0], rate[1]) * 1.7 + 0.11;
  return {
    amp: rand(amp[0], amp[1]), r1, r2,
    // the second rate as a RATIO of the first, because the burst clock counts in
    // swings of r1 — this is what keeps the two incommensurate inside one burst
    rr2: r2 / r1,
    g1: rand(0.045, 0.105), g2: rand(0.058, 0.130), gp1: Math.random() * TAU, gp2: Math.random() * TAU
  };
}
let litPanels = [];
// (randCode is retired with the fiber theme — there is no binary on a lane wall.
// The wall's motion is carried by streaked starlight and the marker trains below.)
function buildBackground() {
  // the seed swap: everything scattered in here draws through Math.random — rand,
  // gauss, starClass, all of it — so replacing the source for the build's duration
  // pins the whole sky without threading an rng through thirty call sites. The
  // finally puts the real one back even if a context is refused mid-bake.
  const sysRandom = Math.random;
  Math.random = mulberry32(SKY_SEED);
  try {
    buildBackgroundSeeded();
  } finally {
    Math.random = sysRandom;
  }
}
function buildBackgroundSeeded() {
  // live layer state
  liveStars = [];
  menuStars = [];
  litPanels = [];
  // the viewport unit (see its comment at STAR_COLS). Recomputed here because
  // this build runs on every resize/rotation, so the sky refits with the frame.
  skyUnit = clamp(Math.min(W, H) / 820, 0.38, 1);
  // (the chevron marker trains are GONE. Signage painted on a lane wall was a
  // holdover from thinking of the bore as a built structure — a lit corridor with
  // markings. It is open space with a containment field in it, and the chevrons
  // read as exactly what they were: graphics stuck to nothing.)
  // vignette cache
  vignetteCanvas = document.createElement('canvas');
  vignetteCanvas.width = W * DPR; vignetteCanvas.height = H * DPR;
  const v = vignetteCanvas.getContext('2d');
  v.setTransform(DPR, 0, 0, DPR, 0, 0);
  const vg = v.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.42, W / 2, H / 2, Math.max(W, H) * 0.72);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.38)');
  v.fillStyle = vg; v.fillRect(0, 0, W, H);

  // THE STRIPS — the far field's sheets, SKY_WS screens wide. The extra 0.6
  // screens and the seam discipline are inherited from the panning sky and
  // kept: the bake math is built on them, the seam sits harmlessly off-frame
  // at pan zero, and a strip that stayed seamless costs nothing while a strip
  // that stopped being seamless would owe a re-derivation of every scatter
  // site the day anything pans again.
  //
  // Resolution by content: the structure strip is soft blobs with no edge
  // anywhere, so it bakes at DPR 1 and upscales invisibly — that single choice
  // is most of this feature's memory budget. The star strips carry point cores
  // and cap at DPR 2: two wide sheets at a phone's DPR 3 is real memory, and
  // starlight does not carry text-grade edges.
  const sw = Math.ceil(W * SKY_WS);
  skyW = sw;
  const AREA_K = SKY_WS;               // strips hold SKY_WS screens of sky — counts ride along
  const SKY_DPR = Math.min(DPR, 2);
  skyStruct = document.createElement('canvas');
  skyStruct.width = sw; skyStruct.height = H;
  const sb = skyStruct.getContext('2d');
  // deep navy base — the void the lane is threaded through. It stays near-black:
  // the hyperspace references only go blue during the JUMP, and cruise is dark.
  // It lives on the structure strip, the layer that always covers the frame.
  sb.fillStyle = '#020510'; sb.fillRect(0, 0, sw, H);
  // the nebula strip: the coloured clouds, one plane nearer than the galactic
  // band they used to be baked into. Transparent, DPR 1 like the structure —
  // a cloud has no edge to protect.
  skyClouds = document.createElement('canvas');
  skyClouds.width = sw; skyClouds.height = H;
  const cb = skyClouds.getContext('2d');
  bgCanvas = document.createElement('canvas');
  bgCanvas.width = sw * SKY_DPR; bgCanvas.height = H * SKY_DPR;
  const b = bgCanvas.getContext('2d');
  b.setTransform(SKY_DPR, 0, 0, SKY_DPR, 0, 0);
  // the menu layer's sheet: TRANSPARENT, like the star strip — they composite
  // over the structure rather than replacing it, so they carry stars and
  // nothing else.
  menuSky = document.createElement('canvas');
  menuSky.width = sw * SKY_DPR; menuSky.height = H * SKY_DPR;
  const mb = menuSky.getContext('2d');
  if (mb) mb.setTransform(SKY_DPR, 0, 0, SKY_DPR, 0, 0);
  // SEAMLESS OR NOTHING: a wrapping strip shows its left and right edges butted
  // together, so any feature near an edge must also be stamped one period away.
  // Every scatter site below asks this helper where to stamp.
  const wrapXs = (x, r) => {
    const xs = [x];
    if (x < r) xs.push(x + sw);
    else if (x > sw - r) xs.push(x - sw);
    return xs;
  };

  // --- THE GALACTIC BAND: the backdrop's whole structure ---
  //
  // The references are not scattered nebula clouds. They are the galaxy seen
  // EDGE-ON: one broad band of warm dust crossing the entire frame, brightest
  // along its spine, with a dark dust lane cutting through it. That one
  // structure is what makes a sky read as "somewhere inside a galaxy" instead
  // of as fog, and scattered blobs can never do it because they have no axis.
  //
  // ON A WRAPPING STRIP THE SPINE IS A SINUSOID, and this is not a workaround —
  // it is the projection actually being asked for. The strip is a slice of
  // cylinder around the camera, the galactic plane is a great circle around the
  // observer, and a great circle in cylindrical projection IS a sine wave. One
  // period per circuit, so the seam cannot show, and the old straight diagonal
  // turns out to have been the approximation. The wander harmonics ride integer
  // multiples of the same period for the same reason.
  //
  // All baked: at this distance nothing moves except the drift itself, so it
  // costs two blits per frame, and the deep field parallaxes in front of it —
  // which is what sets the sky's depth order.
  {
    const bandW = Math.min(W, H) * 0.34;          // perpendicular half-width
    const spine = t => H * 0.52 - H * 0.26 * Math.sin(TAU * t / sw + 0.9);
    const wander = t => Math.sin(TAU * 3 * t / sw + 1.7) * bandW * 0.24
      + Math.sin(TAU * 7 * t / sw + 0.6) * bandW * 0.12;
    // gaussian-ish: three uniforms averaged, so density really falls off the spine
    const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;
    const onBand = (t2, perp) => ({ x: t2, y: spine(t2) + perp });
    // one soft blob, stamped once per wrap image its radius demands — every
    // scatter in the structure AND the clouds goes through here, so the seam
    // cannot exist on either strip
    const blob = (tg, x, y, br, col, al, midStop) => {
      for (const bx of wrapXs(x, br)) {
        const gr2 = tg.createRadialGradient(bx, y, 0, bx, y, br);
        gr2.addColorStop(0, `rgba(${col},${al.toFixed(4)})`);
        if (midStop) gr2.addColorStop(0.45, `rgba(${col},${(al * 0.45).toFixed(4)})`);
        gr2.addColorStop(1, `rgba(${col},0)`);
        tg.fillStyle = gr2;
        tg.beginPath(); tg.arc(bx, y, br, 0, TAU); tg.fill();
      }
    };
    // the dust itself — warm along the spine, cooling toward the edges
    sb.save();
    sb.globalCompositeOperation = 'lighter';
    for (let i = 0; i < Math.round(520 * AREA_K); i++) {
      const t2 = Math.random() * sw;
      const wan = wander(t2);
      const perp = gauss() * bandW + wan;
      const q = clamp(1 - Math.abs(perp - wan) / bandW, 0, 1); // 1 on the spine
      const pt = onBand(t2, perp);
      const br = Math.min(W, H) * rand(0.035, 0.15);
      // the band breathes along its length — a ring has no ends to thin toward,
      // so the old ends-fade becomes a periodic swell, seam-safe like the spine
      const along = 0.72 + 0.28 * Math.sin(TAU * 2 * t2 / sw + 2.2);
      const al = (0.008 + Math.random() * 0.026) * (0.30 + q * 1.1) * along;
      if (al < 0.002) continue;
      const col = q > 0.62 ? '196,158,104'        // hot core of the plane
        : q > 0.32 ? '158,120,74'                 // mid dust
        : '96,86,104';                            // cool outskirts
      blob(sb, pt.x, pt.y, br, col, al, true);
    }
    sb.restore();
    // off-band nebulae for colour relief — the reference has a cold patch away
    // from the plane, and the lane palette wants some cyan/violet. Spread over
    // the whole circuit, so the drift keeps trading them in and out of frame —
    // and on their OWN strip, one plane nearer than the band: a cloud drifting
    // slightly faster than the stars behind it is the deepest single cue in
    // the whole stack, because it is the one the eye can hold onto.
    cb.save();
    cb.globalCompositeOperation = 'lighter';
    for (const cl2 of [
      { x: sw * 0.08, y: H * 0.16, r: Math.min(W, H) * 0.34, col: '128,58,58', n: 16 },
      { x: sw * 0.50, y: H * 0.84, r: Math.min(W, H) * 0.30, col: '48,120,138', n: 14 },
      { x: sw * 0.43, y: H * 0.10, r: Math.min(W, H) * 0.26, col: '96,62,140', n: 12 },
      { x: sw * 0.82, y: H * 0.30, r: Math.min(W, H) * 0.30, col: '58,96,128', n: 12 }
    ]) {
      for (let i = 0; i < cl2.n; i++) {
        const ang = Math.random() * TAU, rad = cl2.r * (Math.random() + Math.random()) * 0.5;
        const bx = cl2.x + Math.cos(ang) * rad, by = cl2.y + Math.sin(ang) * rad * 0.78;
        blob(cb, bx, by, cl2.r * rand(0.18, 0.46), cl2.col, 0.008 + Math.random() * 0.020, false);
      }
    }
    cb.restore();
    // THE DARK DUST LANE. The characteristic feature of an edge-on galaxy and the
    // thing that stops the band reading as an airbrushed smear: an opaque ribbon
    // of cold dust lying along the plane, eating the light behind it.
    for (let i = 0; i < Math.round(300 * AREA_K); i++) {
      const t2 = Math.random() * sw;
      const wan = wander(t2);
      const perp = wan + gauss() * bandW * 0.30 + Math.sin(TAU * 5 * t2 / sw + 0.6) * bandW * 0.16;
      const pt = onBand(t2, perp);
      blob(sb, pt.x, pt.y, Math.min(W, H) * rand(0.03, 0.115), '3,4,12', 0.10 + Math.random() * 0.26, false);
    }
    // BACKDROP STARS, concentrated toward the plane the way real ones are. Dense,
    // varied in colour and brightness, with bloom on the bright few. (Colours come
    // off the shared STAR_COLS table up top — the lane's blanket deals from it too.)
    // ONE pass, run twice. The sky the lane sees, then the extra layer the menus
    // get — same band, same falloff off the spine, same colour and brightness
    // distribution, so the denser sky is MORE OF THIS SKY and not a second one
    // sprinkled over it. `tgt` is the sheet it bakes into, `liveArr` the array its
    // held-out share goes live in.
    const emitStars = (nStar, tgt, liveArr) => {
    for (let i = 0; i < nStar; i++) {
      let x3, y3;
      if (Math.random() < 0.62) {                 // in the plane
        const t2 = Math.random() * sw;
        const pt = onBand(t2, wander(t2) + gauss() * bandW * 1.25);
        x3 = ((pt.x % sw) + sw) % sw; y3 = pt.y;
      } else {                                    // the rest of the sky
        x3 = Math.random() * sw; y3 = Math.random() * H;
      }
      if (y3 < -2 || y3 > H + 2) continue;        // the band's spine dips off-frame
      const big = Math.random() < 0.035;
      // × STAR_REST. The resting sky is turned DOWN so a flare has somewhere to
      // go: contrast is a ratio, and against a field already painted at 0.9 the
      // brightest scintillation available is a 10% lift nobody can see. Applied
      // to the whole field, baked and live alike, so the two populations still
      // match while a gated star is idle — the difference has to appear when it
      // twinkles, never as a permanent dimmer on a third of the stars.
      const al3 = (big ? 0.45 + Math.random() * 0.45 : 0.06 + Math.random() * 0.34) * STAR_REST;
      const col3 = STAR_COLS[starColI(Math.random)];
      // the halo rides the star's own brightness — a field where every bright
      // star wears the SAME 13px halo is polka dots; tying reach to luminosity
      // is what makes it read as a population instead of a stamp
      const bk = big ? 0.55 + 0.55 * clamp((al3 / STAR_REST - 0.45) / 0.45, 0, 1) : 1;
      const cs = Math.sqrt(skyUnit);   // cores shrink gentler than halos — a
                                       // star is still a point at any size
      // HELD OUT OF THE BAKE. Every bright star goes live (they are the ones the
      // eye tracks, and there are only ~50 of them) plus a third of the faint
      // field — enough that the movement is everywhere without paying for 1500
      // arcs a frame. The rest stay painted, and are the still sky behind it.
      if (!lowFX && (big || Math.random() < 0.34)) {
        const cl = starClass();
        liveArr.push({
          // STRIP COORDINATES, shared with the bake it was held out of. The
          // star HOLDS this position — the far field does not move under
          // forward flight — and being live buys it exactly one thing now:
          // the scintillation machinery. The travel lives in the warp
          // blanket, in front of all of this.
          x: x3, y: y3,
          col: col3, rgb: col3.split(',').map(Number), al: al3, big, bk,
          r: (big ? rand(1.0, 1.8) : rand(0.3, 0.85)) * (big ? cs : 1),
          // bright stars swing less, in proportion — and this factor keeps their
          // amplitude under 1 whatever class they draw, so a big star always has
          // some light left at the bottom. A faint dot winking fully out is
          // scintillation; the brightest star on screen doing it is a dead pixel.
          amp: cl.amp * (big ? 0.55 : 1),
          r1: cl.r1, r2: cl.r2, rr2: cl.rr2, bph: 0, // bph: burst phase, see STAR_BLINKS
          p1: Math.random() * TAU, p2: Math.random() * TAU,
          g1: cl.g1, g2: cl.g2, gp1: cl.gp1, gp2: cl.gp2, // when it is allowed to twinkle at all
          // only the bright few carry the colour shift — on a 0.5px dot it is
          // invisible, and it is what makes a real star read as burning
          hue: big ? rand(10, 26) : 0
        });
        continue;
      }
      const coreR = big ? rand(1.0, 1.8) * cs : rand(0.3, 0.85);
      const bloomPx = STARFX.bloomR * skyUnit * bk;
      for (const xs of wrapXs(x3, big ? bloomPx : 2)) {
        if (big) {                                // the bright ones bloom
          // On STAR_HALO, like every other bloom in the sky. This path only
          // runs under lowFX — with the effects on, every big star goes live
          // above — and it used to be the two-stop gradient the live draw
          // abandoned, so the one build that can least afford a hard-edged coin
          // was the only one still baking them.
          const gg = tgt.createRadialGradient(xs, y3, 0, xs, y3, bloomPx);
          const a0 = al3 * STARFX.bloomA;
          for (const [p, w] of STAR_HALO) gg.addColorStop(p, `rgba(${col3},${(a0 * w).toFixed(4)})`);
          tgt.fillStyle = gg;
          tgt.beginPath(); tgt.arc(xs, y3, bloomPx, 0, TAU); tgt.fill();
        }
        tgt.fillStyle = `rgba(${col3},${al3.toFixed(3)})`;
        tgt.beginPath(); tgt.arc(xs, y3, coreR, 0, TAU); tgt.fill();
      }
    }
    };
    emitStars(Math.round(1500 * AREA_K), b, liveStars);
    // The menu layer is baked and held even under lowFX — the sheet costs one
    // blit and the live share simply comes out empty there, exactly as the main
    // field's does.
    if (mb) emitStars(Math.round(MENU_STARS * AREA_K), mb, menuStars);
    // (THE CLOSE PASSES ARE GONE — 26 extra-bright stars that swept laterally
    // in front of everything, the old orbit's near plane. Under forward flight
    // a near star doesn't cross the frame, it COMES AT YOU — and the warp
    // blanket's heroes already are exactly that, at every throttle. Keeping
    // them parked would have been two dozen outsized stars going nowhere.)
  }

  // --- the lane wall texture: starlight smeared by transit, stamped at many depths ---
  //
  // The one change that turns a cable into a warp lane: the grain runs RADIALLY,
  // not concentrically. The old wall was hundreds of arc dashes lying ACROSS the
  // direction of travel — stacked circuitry, unmistakably the inside of a duct.
  // Every primitive here runs ALONG it instead, so each depth stamp lines its
  // streaks up with the next and they read as one continuous smear pulled past
  // the hull. Same annulus, same stamping, same twist per depth: only the grain
  // rotated 90°.
  const TS = Math.min(1024, Math.round(Math.min(W, H) * 1.7));
  const half = TS / 2;
  wallTex = document.createElement('canvas');
  wallTex.width = TS; wallTex.height = TS;
  const t = wallTex.getContext('2d');
  t.translate(half, half);
  const inR = half * 0.55, outR = half * 0.98;
  // star colours, not circuit colours: mostly cold, a minority warm, a rare
  // violet. No amber-heavy mix — amber belonged to the data read.
  const pick = (al) => {
    const r = Math.random();
    return r < 0.10 ? `rgba(255,196,130,${al})`   // warm giants
      : r < 0.16 ? `rgba(200,170,255,${al})`      // rare violet
      : r < 0.55 ? `rgba(236,246,255,${al})`      // cold white
      : `rgba(150,205,255,${al})`;                // blue-white
  };
  // NO WARP LINES IN HERE. This texture is stamped at ten receding depths, which
  // means anything baked into it appears TEN TIMES — the same angular pattern at
  // ten radii, marching outward together. That is what read as "organized layers
  // flying in unity", and it is not tunable: it is what stamping one texture
  // repeatedly does. Worse, everything baked here is trapped between inR and outR,
  // so streaks all began and ended at the same radial range and formed visible
  // rings. Stars are not arranged in rings.
  //
  // The warp lines are LIVE particles now (see WARP_STARS / drawStreaks). Each one
  // owns its own angle, depth, length, calibre and radial distance from the axis,
  // so no two agree about anything and there is no repeated pattern to see.
  //
  // What stays here is only faint SURFACE GRAIN — the bore needs a visible skin
  // for leaks to read as holes in a surface rather than as sprites floating in it.
  // Sparse and dim on purpose: the user wants to see space behind it.
  for (let i = 0; i < 130; i++) {
    const rr = rand(inR, outR), a0 = Math.random() * TAU;
    t.fillStyle = pick((0.07 + Math.random() * 0.20).toFixed(2));
    t.save(); t.rotate(a0);
    t.beginPath(); t.arc(rr, 0, Math.random() < 0.10 ? rand(1.1, 1.9) : rand(0.35, 0.9), 0, TAU); t.fill();
    t.restore();
  }
  // FEATHER the annulus. The band used to stop dead at inR and outR, and a hard
  // stop on a circle is a visible arc — "I can see the circle ends". Erase both
  // edges with radial gradients so the skin fades out instead of ending.
  t.save();
  t.globalCompositeOperation = 'destination-out';
  const outFade = t.createRadialGradient(0, 0, outR * 0.72, 0, 0, outR * 1.02);
  outFade.addColorStop(0, 'rgba(0,0,0,0)');
  outFade.addColorStop(1, 'rgba(0,0,0,1)');
  t.fillStyle = outFade;
  t.beginPath(); t.arc(0, 0, outR * 1.02, 0, TAU); t.fill();
  const inFade = t.createRadialGradient(0, 0, inR * 0.55, 0, 0, inR * 1.35);
  inFade.addColorStop(0, 'rgba(0,0,0,1)');
  inFade.addColorStop(1, 'rgba(0,0,0,0)');
  t.fillStyle = inFade;
  t.beginPath(); t.arc(0, 0, inR * 1.35, 0, TAU); t.fill();
  t.restore();
  // (the "dust haze" pass is GONE. It was 4–11px wide strokes, which is precisely
  // the calibre that reads as a flat rounded-rectangle sliding through the bore no
  // matter how it is capped. Depth comes from the warp-line stack and the point
  // stars now; nothing in this texture is wider than about 3px.)

  // --- the TURBULENCE layer: roiling plasma in the throat (hyperspace reference) ---
  // Streaked starlight alone reads as Star Trek warp — clean, fast, empty. The
  // hyperspace look is VOLUMETRIC: a lane wall that boils. This is a second
  // texture of soft blobs stretched along the direction of travel, composited
  // additively over the streaks and stamped with the same depth bands.
  //
  // It is DELIBERATELY featureless. drawTunnel's per-band twist is fixed because
  // "a spinning wall would shear under the leaks" — enemies are painted on the
  // wall at fixed angles. So the churn cannot come from rotation. It comes from
  // per-band alpha breathing at different phases (see drawTunnel), which needs a
  // texture with no trackable features or the shear becomes visible.
  wallCloud = document.createElement('canvas');
  wallCloud.width = TS; wallCloud.height = TS;
  const cl = wallCloud.getContext('2d');
  cl.translate(half, half);
  cl.globalCompositeOperation = 'lighter';
  // A circular clip, because this is a SQUARE canvas holding a round wall. Blobs
  // stretched radially used to run off the sheet and get chopped by its corners,
  // and a chopped soft blob is a hard straight edge — the other half of the
  // "moving rectangles". Extents are constrained below as well, so this is only
  // insurance; if it ever does bite, it bites along the wall's own curve.
  cl.save();
  cl.beginPath(); cl.arc(0, 0, half * 0.995, 0, TAU); cl.clip();
  for (let i = 0; i < 190; i++) {
    const a0 = Math.random() * TAU;
    const stretch = rand(1.6, 3.0);          // elongated along travel — never round
    const rad = rand(half * 0.05, half * 0.11);
    // keep the whole ellipse on the sheet: its radial reach is rad*stretch
    const reach = rad * stretch;
    const hi = outR - reach;
    const lo = Math.min(inR * 0.92, hi);
    const rr = hi > lo ? rand(lo, hi) : lo;
    const r2 = Math.random();
    const col = r2 < 0.16 ? '190,225,255' : r2 < 0.34 ? '120,180,255' : '70,130,225';
    const al = 0.035 + Math.random() * 0.075;
    cl.save();
    cl.rotate(a0); cl.translate(rr, 0); cl.scale(stretch, 1);
    const bg = cl.createRadialGradient(0, 0, 0, 0, 0, rad);
    bg.addColorStop(0, `rgba(${col},${al.toFixed(3)})`);
    bg.addColorStop(0.45, `rgba(${col},${(al * 0.42).toFixed(3)})`);
    bg.addColorStop(1, `rgba(${col},0)`);
    cl.fillStyle = bg;
    cl.beginPath(); cl.arc(0, 0, rad, 0, TAU); cl.fill();
    cl.restore();
  }
  cl.restore(); // close the circular clip
  // feather the haze's own edges for the same reason as the skin's — a soft cloud
  // that stops dead on a circle still draws a visible arc
  cl.save();
  cl.globalCompositeOperation = 'destination-out';
  const cOut = cl.createRadialGradient(0, 0, outR * 0.70, 0, 0, outR * 1.02);
  cOut.addColorStop(0, 'rgba(0,0,0,0)');
  cOut.addColorStop(1, 'rgba(0,0,0,1)');
  cl.fillStyle = cOut;
  cl.beginPath(); cl.arc(0, 0, outR * 1.02, 0, TAU); cl.fill();
  const cIn = cl.createRadialGradient(0, 0, inR * 0.45, 0, 0, inR * 1.35);
  cIn.addColorStop(0, 'rgba(0,0,0,1)');
  cIn.addColorStop(1, 'rgba(0,0,0,0)');
  cl.fillStyle = cIn;
  cl.beginPath(); cl.arc(0, 0, inR * 1.35, 0, TAU); cl.fill();
  cl.restore();
  initWarpSky();   // the lane's sky is scattered on the FRAME, so it waits for one
  buildRingFx();
}
// the node holder ring, reborn as a dark machined monolith (arc lab design):
// matte gunmetal under ONE key light — the lit sector glints, the far side
// dies — with machined hairlines, an engraved index scale, seams and flange
// bolts. Static, so it prerenders once per resize.
// THE RING'S OWN GRADIENT, as a value. The torus reads as metal because of these
// seven stops and nothing else, so the prerender and the live stand-in below take
// them from one place rather than each carrying a copy that can drift.
function ringBandGrad(c, cx, cy, Rin, Rout) {
  const rg = c.createRadialGradient(cx, cy, Rin, cx, cy, Rout);
  rg.addColorStop(0,    'rgb(3,5,9)');
  rg.addColorStop(0.07, arcGun(19));
  rg.addColorStop(0.32, arcGun(35));
  rg.addColorStop(0.46, arcGun(45));
  rg.addColorStop(0.62, arcGun(29));
  rg.addColorStop(0.9,  arcGun(11));
  rg.addColorStop(1,    'rgb(2,3,6)');
  return rg;
}
// THE BAND, DRAWN LIVE. Everything the prerender adds — the key wash, the brushed
// grain, the hairlines, the index scale, the flange bolts — is finish. This is the
// hardware itself, and it costs one stroke. It exists so that a machine which
// cannot allocate the prerender still has a ring to ride: see ringFx().
function drawRingBandPlain() {
  const nodeR = Math.min(W, H) * 0.44, cx = W / 2, cy = H / 2;
  const bh = Math.min(W, H) * 0.055 * ARCFX.bandW;
  ctx.lineWidth = bh * 2;
  ctx.strokeStyle = ringBandGrad(ctx, cx, cy, nodeR - bh, nodeR + bh);
  ctx.beginPath(); ctx.arc(cx, cy, nodeR, 0, TAU); ctx.stroke();
}
// THE RING, ON DEMAND, and it is never allowed to be silently absent.
//
// It used to be built only from resize(), and `ringFxCv` was assigned BEFORE the
// canvas was drawn into — so a refused 2d context (a browser at its canvas budget,
// which is a real limit and one this game got closer to the day the enemy bake
// moved to boot) left a blank canvas assigned, threw out of resize() past
// buildMenuCache() and syncUiLayer(), and the game ran on with no ring at all and
// no way to ever get one back. Gil, 2026-08-29, on seeing exactly that: the ring
// didn't load. So: the build assigns only on success, this asks for the ring the
// frame actually needs, and a failed build is retried once per viewport rather
// than every frame.
function ringFx() {
  const sig = W + 'x' + H + '@' + DPR;
  if (ringFxCv && ringFxSig === sig) return ringFxCv;
  if (ringFxTried === sig) return null;   // already failed at this size — draw the band live
  ringFxTried = sig;
  buildRingFx();
  return ringFxSig === sig ? ringFxCv : null;
}
function buildRingFx() {
  const nodeR = Math.min(W, H) * 0.44, cx = W / 2, cy = H / 2;
  const bh = Math.min(W, H) * 0.055 * ARCFX.bandW;
  const Rin = nodeR - bh, Rout = nodeR + bh;
  const cv = document.createElement('canvas');
  cv.width = W * DPR; cv.height = H * DPR;
  const c = cv.getContext('2d');
  // A CONTEXT CAN BE REFUSED, and the answer is to keep the ring we already have
  // rather than to replace it with a blank one and take the rest of resize() down
  // with a throw. The caller falls back to the live band.
  if (!c || !c.setTransform) return false;
  c.setTransform(DPR, 0, 0, DPR, 0, 0);
  const hairline = (r, base, lit) => { // faint full ring + a glint in the lit sector
    c.lineWidth = 1;
    c.strokeStyle = `rgba(225,235,250,${base.toFixed(3)})`;
    c.beginPath(); c.arc(cx, cy, r, 0, TAU); c.stroke();
    for (const [al, sp] of [[lit, 1.15], [lit * 0.5, 1.95]]) {
      c.strokeStyle = `rgba(225,235,250,${al.toFixed(3)})`;
      c.beginPath(); c.arc(cx, cy, r, LIGHT_A - sp, LIGHT_A + sp); c.stroke();
    }
  };
  // torus value structure: dark edges, a modest crown
  c.lineWidth = bh * 2;
  c.strokeStyle = ringBandGrad(c, cx, cy, Rin, Rout);
  c.beginPath(); c.arc(cx, cy, nodeR, 0, TAU); c.stroke();
  // key-light wash + bore bounce ambient, clipped to the band
  c.save();
  c.beginPath(); c.arc(cx, cy, Rout, 0, TAU); c.arc(cx, cy, Rin, 0, TAU, true); c.clip();
  const kl = c.createLinearGradient(cx + Math.cos(LIGHT_A) * nodeR, cy + Math.sin(LIGHT_A) * nodeR,
    cx - Math.cos(LIGHT_A) * nodeR, cy - Math.sin(LIGHT_A) * nodeR);
  kl.addColorStop(0, `rgba(215,228,250,${(0.13 * ARCFX.metal).toFixed(3)})`);
  kl.addColorStop(0.45, 'rgba(215,228,250,0)');
  kl.addColorStop(0.55, 'rgba(0,0,0,0)');
  kl.addColorStop(1, 'rgba(0,0,0,0.30)');
  c.fillStyle = kl; c.fillRect(0, 0, W, H);
  const bb = c.createRadialGradient(cx, cy, Rin, cx, cy, Rin + bh * 0.8);
  bb.addColorStop(0, 'rgba(100,170,230,0.07)');
  bb.addColorStop(1, 'rgba(100,170,230,0)');
  c.fillStyle = bb; c.fillRect(0, 0, W, H);
  // brushed grain (whisper-quiet at low sheen) + radial machining marks
  for (let i = 0; i < 180; i++) {
    const a0 = i / 180 * TAU, a1 = (i + 1.15) / 180 * TAU;
    const key = Math.pow(0.5 + 0.5 * Math.cos((a0 + a1) / 2 - LIGHT_A), 2.5);
    const grain = arcHash(i) - 0.5;
    const al = ARCFX.sheen * key * (0.05 + Math.max(0, grain) * 0.07);
    const dk = ARCFX.sheen * Math.max(0, -grain) * 0.10;
    c.lineWidth = bh * 2;
    if (al > 0.004) { c.strokeStyle = `rgba(225,235,255,${al.toFixed(3)})`; c.beginPath(); c.arc(cx, cy, nodeR, a0, a1); c.stroke(); }
    if (dk > 0.004) { c.strokeStyle = `rgba(0,0,0,${dk.toFixed(3)})`; c.beginPath(); c.arc(cx, cy, nodeR, a0, a1); c.stroke(); }
  }
  for (let i = 0; i < 240; i++) {
    const a = arcHash(i + 500) * TAU, len = 0.25 + arcHash(i + 900) * 0.6;
    const key = 0.35 + 0.65 * Math.pow(0.5 + 0.5 * Math.cos(a - LIGHT_A), 2);
    const r0 = Rin + arcHash(i + 700) * (1 - len) * bh * 2, r1 = r0 + len * bh * 0.5;
    c.strokeStyle = arcHash(i + 300) > 0.5 ? `rgba(255,255,255,${(0.02 * key).toFixed(3)})` : 'rgba(0,0,0,0.05)';
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
    c.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
    c.stroke();
  }
  c.restore();
  // machined hairlines + engraved index scale + seams with flange bolts
  hairline(Rin + 0.8, 0.10, 0.22 * ARCFX.metal);
  hairline(nodeR - bh * 0.34, 0.035, 0.10 * ARCFX.metal);
  hairline(nodeR + bh * 0.34, 0.035, 0.12 * ARCFX.metal);
  hairline(Rout - bh * 0.16, 0.04, 0.14 * ARCFX.metal);
  c.strokeStyle = 'rgba(0,0,0,0.55)'; c.lineWidth = 1.2;
  c.beginPath(); c.arc(cx, cy, Rout - 0.6, 0, TAU); c.stroke();
  for (let dg = 0; dg < 360; dg += 3) {
    const a = dg * TAU / 360, major = dg % 30 === 0;
    const r1 = Rout - bh * 0.08, r0 = r1 - (major ? bh * 0.22 : bh * 0.1);
    c.strokeStyle = `rgba(190,205,225,${major ? 0.16 : 0.07})`;
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
    c.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
    c.stroke();
  }
  for (let i = 0; i < 4; i++) {
    const a = i * TAU / 4 + TAU / 8, ca = Math.cos(a), sa = Math.sin(a);
    const key = 0.3 + 0.7 * Math.pow(0.5 + 0.5 * Math.cos(a - LIGHT_A), 2);
    c.lineWidth = 1;
    c.strokeStyle = 'rgba(0,0,0,0.4)';
    c.beginPath(); c.moveTo(cx + ca * Rin, cy + sa * Rin); c.lineTo(cx + ca * Rout, cy + sa * Rout); c.stroke();
    c.strokeStyle = `rgba(255,255,255,${(0.05 * key).toFixed(3)})`;
    c.beginPath(); c.moveTo(cx + ca * Rin - sa, cy + sa * Rin + ca); c.lineTo(cx + ca * Rout - sa, cy + sa * Rout + ca); c.stroke();
    for (const off of [-0.028, 0.028]) {
      const ba = a + off, br = nodeR + bh * 0.62;
      const bx = cx + Math.cos(ba) * br, by = cy + Math.sin(ba) * br;
      c.fillStyle = arcGun(26 * key + 8);
      c.beginPath(); c.arc(bx, by, bh * 0.055, 0, TAU); c.fill();
      c.strokeStyle = 'rgba(0,0,0,0.5)'; c.lineWidth = 0.8;
      c.beginPath(); c.arc(bx, by, bh * 0.055, 0, TAU); c.stroke();
    }
  }
  // THE RING IS PUBLISHED HERE, and not one line earlier. It is assigned once the
  // metal is actually ON it, so a build that dies part way leaves the previous
  // ring standing instead of replacing it with an empty rectangle.
  ringFxCv = cv;
  ringFxSig = W + 'x' + H + '@' + DPR;
  // film-grain tile for the photographic finish (guarded for the test stub)
  grainCv = document.createElement('canvas');
  grainCv.width = grainCv.height = 256;
  const gc = grainCv.getContext('2d');
  const im = gc && gc.createImageData && gc.createImageData(256, 256);
  if (im && im.data) {
    for (let i = 0; i < im.data.length; i += 4) {
      const v = 118 + (Math.random() - 0.5) * 255;
      im.data[i] = im.data[i + 1] = im.data[i + 2] = v;
      im.data[i + 3] = 255;
    }
    gc.putImageData(im, 0, 0);
  } else grainCv = null;
  return true;
}
// ---------- THE NEAR SKY: the blanket we fly through, at every speed ----------
//
// ONE FIELD, ONE THROTTLE. This layer used to be the lane's alone — it swapped
// in as the sideways-drifting menu sky swapped out, two skies trading custody
// of the frame. The drift is retired (see the header): we are pointed down the
// bore ALWAYS, and nothing out there may move sideways. A star's bearing off
// the axis is fixed forever; the only thing that changes is how far away it
// is. Every apparent motion in this layer is that one fact projected: a star
// holding perfectly still while we close on it.
//
// So now this field simply never stops. On the menus it idles at WARP_CRUISE —
// the slow fly toward the horizon, near stars gliding out with real parallax,
// far ones creeping for a minute — and the launch is a throttle push on it,
// not a different sky fading in. It loops infinitely by construction: every
// star that reaches the canopy or the frame's edge is re-dealt at the far
// plane. Under way the baked sheet steps back to WARP_SKY behind it; parked,
// the sheet stands at full and this field is the moving quarter in front.
//
// THE PROJECTION IS THE WHOLE FEATURE. A star is a bearing, an off-axis distance
// and a depth. Its screen radius is corner × rf / z — real perspective, not a
// scroll — so it accelerates outward on a hyperbola: at the far plane it creeps
// a few pixels a second, and the same star at a tenth of that depth crosses the
// frame in half a second. That single 1/z IS "the close ones fly by, the far ones
// advance slowly". It is not a tuned curve, it is what travelling looks like, and
// it is the reason this cannot be faked by zooming a sheet.
//
// Everything else here is that projection's consequences:
//   · MOTION BLUR, not decoration. A star's smear is its own screen velocity
//     times a shutter, so the tail LENGTH is the speed reading, and light is
//     conserved along it — a longer smear is a fainter one. Brake the lane and
//     every tail collapses back into its star, which is exactly what dropping
//     out of warp looks like.
//   · DISTANCE BRIGHTNESS, on the same 1/z. A star fades up out of the far plane
//     the whole way in and never fades out — it leaves by leaving the frame.
//   · DOPPLER. At this speed the sky ahead runs blue and the sky going abeam runs
//     red. Dead ahead IS the vanishing point, so the tint is a function of screen
//     radius and nothing else: cool at the centre, warming as a star sweeps out
//     to pass us. Small numbers — it should read as physics, never as a filter.
//   · CLOSE PASSES. A few of the field are dealt onto the axis and dealt bright.
//     They spend fifteen seconds creeping at the vanishing point, brightening,
//     and then leave in one second as a long hot streak. Those are the events
//     that say DISTANCE COVERED: a blanket of anonymous dots reads as speed, but
//     a star you watched arrive and then blew past reads as having got somewhere.
// A BLANKET IS A DENSITY, and this is the number that makes it one. The parked
// sky puts ~940 baked stars on a screen and can afford to because they are
// painted once into a sheet; every one of these is live, every frame, which is
// why the far majority of them are a fillRect and nothing else (see the draw).
// Under it the sheet steps back to WARP_SKY, so the lane is not paying for two
// full skies — it is trading the still one for a moving one, slightly denser.
let WARP_N = 1500;
const WARP_HERO = 5;             // of which, close passes: dealt on the axis, dealt bright
const WARP_Z0 = 1;               // the far plane: where a star enters the field
const WARP_ZN = 0.02;            // the canopy. A SAFETY, not a look — see the rf floor
let WARP_V = 0.30;               // far plane → camera in transits/sec, at traffic speed 1
const WARP_BLUR = 0.085;         // the shutter, in seconds: the smear's whole character
const WARP_TAIL = 0.85;          // and how much of a star's light the smear carries
const WARP_SMEAR = 3;            // …below which there is no smear worth drawing (see the draw)
const WARP_GAIN = 0.66;          // share of a star's brightness that rides 1/z
const WARP_FADE = 0.13;          // depth over which a fresh star fades up out of the far plane
const WARP_CORE = 1.7;           // a star is a POINT plus scatter — the core never grows past this
const WARP_BLOOM = 3.4;          // the scatter's reach, in core radii
const WARP_BLOOM_A = 0.42;       // and its peak, before the star's own brightness
const WARP_SKY = 0.48;           // what is left of the parked sky's baked sheet under way
const WARP_DOPP = 30;            // ± the doppler tint in 0–255 units, dead ahead vs abeam
const WARP_TONES = 6;            // how finely that tint is banded across the frame
// THE STATION-KEEPING THROTTLE: the menus' slow fly toward the horizon, as a
// fraction of full traffic speed. Slow enough that the field reads as coasting
// — a mid-depth star takes the best part of a minute to arrive — and fast
// enough that the eye finds the flow within a couple of seconds of looking.
let WARP_CRUISE = 0.055;
// AND ON THE REPORT, A QUARTER OF IT. The lane brakes to a stop when a level ends
// (flowTgt is 0 for S.END exactly as it is for S.MENU, 72-tick), so the report was
// running this field at precisely the menu's station-keeping crawl — the same slow
// fly toward the horizon, on the one screen whose entire claim is that we arrived.
// Quartering it says PARKED without stopping the sky dead, which would read as a
// frozen frame rather than as a ship at rest.
//
// EASED, AND THE EASE IS FREE. The ramp runs while laneFlow is still braking, and
// the cruise term is weighted by (1 - laneFlow) — so it is worth nearly nothing for
// the whole time it is changing, and the slowdown is never seen happening. Leaving
// the report ramps it straight back; a relaunch pushes laneFlow to 1, which drowns
// the cruise term entirely, so the menu and the next run both get full pace.
//
// The smears come with it for free: a tail is screen velocity × shutter, so at a
// quarter speed they are a quarter as long. Less motion blur IS what slower looks
// like — the arrival reads as settling, not as someone turning an effect down.
let ARRIVE_CRUISE_Q = 0.25;      // the report's share of the menu's pace (?arrive= overrides)
const ARRIVE_EASE = 0.8;         // seconds to cross to it, both directions
let arriveCruise = 1;
// ?warpv=0.5 flies it fast for a taste test, ?warpn=200 thins it out,
// ?cruise=0.2 taste-tests the parked crawl, ?arrive=1 disables the report's slowdown.
if (typeof location !== 'undefined') {
  const qv = /[?&]warpv=([\d.]+)/.exec(location.search);
  if (qv) WARP_V = parseFloat(qv[1]);
  const qn = /[?&]warpn=(\d+)/.exec(location.search);
  if (qn) WARP_N = parseInt(qn[1], 10);
  const qc = /[?&]cruise=([\d.]+)/.exec(location.search);
  if (qc) WARP_CRUISE = parseFloat(qc[1]);
  const qa = /[?&]arrive=([\d.]+)/.exec(location.search);
  if (qa) ARRIVE_CRUISE_Q = parseFloat(qa[1]);
}
let warpStars = [];
// SYSRANDOM, NOT MATH.RANDOM, EVERYWHERE BELOW — the one rule this layer cannot
// break. Campaign and weekly both reseed Math.random for the sim. Weekly used to
// point `spawnRng` at Math.random as well, and that is exactly the bug the split
// fixed: draw code consumes Math.random hundreds of times a frame, so the spawn
// script and the renderer shared one generator and every weekly submission was
// checked against a lane the player never saw. Both modes now run a spawn stream
// of their own (`60-input.js:822`). This field recycles a couple of hundred stars
// a second AT DRAW TIME, so a backdrop rolling on the sim's stream would deal the
// player a different level on a slow phone than on a fast one, and a different one
// again to the headless verifier that renders nothing. A sky may not be able to
// change the game.
const wrand = (a, b) => a + sysRandom() * (b - a);
// And the twinkle classes are DEALT INTO A HAND at build time rather than rolled
// per recycle: starClass() is eight rolls, which at this turnover is the most
// expensive thing a respawn did. A star takes its RATES from the hand and rolls
// its own PHASES — rates repeating across fifty stars is invisible, phases
// repeating is a cluster of the sky blinking in unison, which is the one thing
// the whole gate machinery exists to prevent.
let warpHand = null;
// THE DOPPLER TABLE, built once. The shift is a function of screen radius and
// NOTHING else, so every star of a given colour reads the same ramp — which
// turns what would be a per-star colour mix every frame into an array lookup.
let warpRamp = null;
function buildWarpRamp() {
  warpRamp = STAR_COLS.map(c => {
    const [r, g, b] = c.split(',').map(Number);
    const out = [];
    for (let i = 0; i < WARP_TONES; i++) {
      const k = 1 - 2 * (i + 0.5) / WARP_TONES;   // +1 dead ahead (blue), −1 abeam (red)
      out.push(Math.round(clamp(r - k * WARP_DOPP, 0, 255)) + ','
        + Math.round(clamp(g - k * WARP_DOPP * 0.22, 0, 255)) + ','
        + Math.round(clamp(b + k * WARP_DOPP, 0, 255)));
    }
    return out;
  });
}
// Dealt in place, never reallocated: at speed the field turns over a couple of
// hundred stars a second and a fresh object per recycle is pure garbage.
function warpDeal(st, cr) {
  // WHERE IT ENTERS: a uniform point on the FRAME at the far plane, not on the
  // disc that circumscribes it. The frame is what the eye can see — scattering
  // on the disc deals nearly half of every recycle into corners nothing is drawn
  // in, and lets a star enter already off-screen and pop straight back out.
  const dx = (sysRandom() - 0.5) * W, dy = (sysRandom() - 0.5) * H;
  const a = Math.atan2(dy, dx);
  // The floor is a safety, not a look. A star closer to the axis than the near
  // plane reaches WARP_ZN while still on screen — and vanishing in plain sight at
  // the vanishing point, at its brightest, is the one pop this layer can't hide.
  let rf = Math.max(Math.hypot(dx, dy) / cr, WARP_ZN * 1.4);
  if (st.hero) rf = wrand(0.10, 0.26);   // a close pass rides the axis in
  // a wider bright share than the baked field's 3.5%. A still sky can be carried
  // by its density alone; a moving one needs a scatter of stars the eye can lock
  // onto and WATCH cross, or the whole field reads as one grey texture sliding.
  const big = st.hero || sysRandom() < 0.055;
  const cl = warpHand[(sysRandom() * warpHand.length) | 0];
  st.ca = Math.cos(a); st.sa = Math.sin(a);
  st.rf = rf; st.z = WARP_Z0; st.big = big;
  st.ci = starColI(sysRandom); // same weighted deal as the parked sky — mostly
                               // white and blue-white, tinted giants the minority
  // intrinsic brightness, off the same distribution the baked field is painted
  // with — this is what the star reads as AT THE FAR PLANE, before 1/z lifts it.
  // The floor sits above the sheet's faintest: a painted star gets to be a
  // near-invisible speck because there are fifteen hundred of them holding still,
  // and one that is travelling has to be legible for the travelling to register.
  st.L = (big ? wrand(0.32, 0.66) : wrand(0.09, 0.37)) * STAR_REST;
  st.sz = big ? wrand(0.95, 1.7) : wrand(0.30, 0.85);
  // the sky's own scintillation machinery, so a becalmed blanket is still the
  // same sky the menus have (see STAR_CLASS). Rates off the hand, phases its own.
  st.amp = cl.amp * (big ? 0.5 : 1);
  st.r1 = cl.r1; st.r2 = cl.r2; st.rr2 = cl.rr2; st.bph = 0;
  st.g1 = cl.g1; st.g2 = cl.g2;
  st.p1 = sysRandom() * TAU; st.p2 = sysRandom() * TAU;
  st.gp1 = sysRandom() * TAU; st.gp2 = sysRandom() * TAU;
  return st;
}
// Re-dealt by buildBackground rather than at load: the spawn rectangle IS the
// frame, so the field has to know the screen before it can be scattered on it.
function initWarpSky() {
  const cr = Math.hypot(W, H) / 2 || 1;
  if (!warpRamp) buildWarpRamp();
  // the hand of twinkle classes every recycle draws from. Built HERE, where
  // buildBackground's seed swap is still in force and the cost is a resize —
  // never in the draw, which is the whole point of it being a hand.
  warpHand = [];
  for (let i = 0; i < 48; i++) warpHand.push(starClass());
  warpStars = [];
  warpEdit = null; // a full re-deal supersedes any staged population edit
  for (let i = 0, n = warpPop(); i < n; i++) {
    const st = warpDeal({ hero: i < WARP_HERO }, cr);
    // spread over depth on the opening deal, or the lane launches with the whole
    // field marching in at one distance, in step, like a wall
    st.z = wrand(Math.min(0.95, st.rf + 0.03), WARP_Z0);
    warpStars.push(st);
  }
}
// BY AREA, because this field is scattered on the FRAME and not on a strip —
// and CLAMPED HARD at both ends, which is where the judgement is. A phone's
// landscape frame is around a third of a laptop's, and the phone is the device
// least able to pay for a full one; but the game's whole layout is sized off
// min(W,H), so a sky that thinned in proportion would read as sparse against a
// composition that did not. The floor buys the small screen back most of its
// density, the ceiling stops a desktop window from dealing itself thousands.
function warpPop() {
  const area = clamp(W * H / (1280 * 720), 0.5, 1.15);
  return lowFX ? 230 : Math.round(WARP_N * area);
}
// A TIER CHANGE IS NOT A NEW SKY. setLowFX used to re-deal this whole field, and
// on the menu that is the one layer the eye is resting on: every star it was
// tracking vanished and fifteen hundred strangers appeared — "the starfield
// resets itself". A tier change now keeps every star it already has and stages
// the population difference as an EDIT that rides a fade (applied in the draw):
//   · shrinking marks the tail [from..] — it keeps flying, dims out over
//     WARP_EDIT_FADE, and only then is cut;
//   · growing deals the newcomers into the tail, spread over depth like the
//     opening deal, and fades them up from nothing.
// Heroes live at the head of the array by construction (initWarpSky), so a trim
// from the tail can never eat a close pass mid-flight.
let warpEdit = null; // {from, t, grow} — the staged edit, null when settled
const WARP_EDIT_FADE = 1.2;
function retargetWarpSky() {
  if (!warpHand || !warpStars.length) return initWarpSky(); // never dealt — nothing to preserve
  const n = warpPop(), cur = warpStars.length;
  if (n === cur) { warpEdit = null; return; }
  if (n < cur) { warpEdit = { from: n, t: 0, grow: false }; return; }
  warpEdit = { from: cur, t: 0, grow: true };
  const cr = Math.hypot(W, H) / 2 || 1;
  for (let i = cur; i < n; i++) {
    const st = warpDeal({ hero: false }, cr);
    st.z = wrand(Math.min(0.95, st.rf + 0.03), WARP_Z0);
    warpStars.push(st);
  }
}
function drawWarpSky(vis, bdt) {
  const cx = W / 2, cy = H / 2, cr = Math.hypot(W, H) / 2;
  // laneDive, NOT warpT read raw: warpT is HELD at full while a run is parked, and a
  // held dive is not a dive happening. Read raw it ran the parked sky at 3.6x the
  // menu crawl with warp-stretched smears — on the very screen whose claim is that
  // the ship has not moved yet. Scaling by laneFlow (which laneDive does) is what the
  // five painters in the lane already learned; this was the sixth, and the last.
  const dive = laneDive();
  // ONE speed for the entire sky, because only one thing is moving: us. A star's
  // apparent rate comes from its depth alone — that is the whole physical claim
  // this layer makes, and it is what the per-layer drift rates could never say.
  //
  // THE THROTTLE. laneFlow blends the station-keeping cruise into the run's
  // full rate: a launch is a push on a sky already under way, and the brake
  // settles it back to a crawl — the field itself never stops and never swaps.
  const thr = (state === S.PLAY ? trafficSpeed : 0.4) * laneFlow
    + WARP_CRUISE * arriveCruise * (1 - laneFlow);
  const v = WARP_V * thr * (1 + dive * 2.6);
  // DOPPLER RIDES THE THROTTLE. The tint is banded by screen radius through a
  // prebuilt ramp; at a crawl there is no shift worth the name, so the band
  // index relaxes toward the ramp's middle as the throttle drops. A six-entry
  // remap built once per frame keeps the per-star cost at an array lookup.
  const dopMid = (WARP_TONES - 1) / 2, dopK = clamp(thr / 0.5, 0, 1);
  const dopMap = [];
  for (let i = 0; i < WARP_TONES; i++) dopMap.push(Math.round(dopMid + (i - dopMid) * dopK));
  const tailCap = cr * (0.5 + dive * 1.3);
  const M = 6;
  const baseAl = ctx.globalAlpha;   // the halo blit borrows it and must give it back
  // the staged population edit (see retargetWarpSky): stars at or past editFrom
  // wear editK on top of everything else — out for a trim, up for a top-up. The
  // trim only truncates once its fade has finished, so nothing ever vanishes
  // between two frames.
  let editFrom = Infinity, editK = 1;
  if (warpEdit) {
    warpEdit.t += bdt;
    const u = clamp(warpEdit.t / WARP_EDIT_FADE, 0, 1);
    if (u >= 1) {
      if (!warpEdit.grow) warpStars.length = warpEdit.from;
      warpEdit = null;
    } else { editFrom = warpEdit.from; editK = warpEdit.grow ? u : 1 - u; }
  }
  for (let si = 0; si < warpStars.length; si++) {
    const st = warpStars[si];
    st.z -= v * bdt;
    if (st.z <= WARP_ZN) { warpDeal(st, cr); continue; }
    const rs = cr * st.rf / st.z;
    const px = cx + st.ca * rs, py = cy + st.sa * rs;
    // d(rs)/dt is rs·v/z — the screen velocity, in px/s, of this star right now.
    // The smear is that times the shutter, so the tail is a MEASUREMENT and not
    // a length someone picked.
    const tail = Math.min(rs * (v / st.z) * WARP_BLUR * (1 + dive * 3), tailCap);
    const ix = cx + st.ca * (rs - tail), iy = cy + st.sa * (rs - tail);
    // RECYCLED ON THE TAIL, NEVER THE HEAD (drawStreaks learned this the hard
    // way): the star lives until its whole smear has left the frame. The segment
    // runs outward from a centre that is always inside the frame, so a tail
    // that has cleared the edge guarantees the head has too.
    if (ix < -M || ix > W + M || iy < -M || iy > H + M) { warpDeal(st, cr); continue; }
    const k = starFlare(st, bdt);
    // the near ones do not twinkle: their motion is their life, and a smear that
    // also blinks reads as a fault in the picture rather than as a star
    const tw = 1 + (k - 1) * clamp(1 - tail / 9, 0, 1);
    let al = Math.min(1, st.L * (1 - WARP_GAIN + WARP_GAIN / st.z) * tw * vis
      * clamp((WARP_Z0 - st.z) / WARP_FADE, 0, 1));   // fades up out of the far plane, never down
    if (si >= editFrom) al *= editK;                  // the staged edit's own fade
    if (al < 0.006) continue;
    const col = warpRamp[st.ci][dopMap[Math.min(WARP_TONES - 1, (rs / cr * WARP_TONES) | 0)]];
    const grow = st.sz * (0.6 + 0.4 / st.z);
    const R = Math.min(grow, WARP_CORE);
    if (grow > WARP_CORE) {
      // past a point the rest of the light is scatter, so a near star grows by
      // REACHING FURTHER rather than by widening into a coin. Prerendered sprite,
      // shared with the deep field's — a gradient per near star per frame is what
      // holds the backdrop's bloom down to its fifty brightest.
      const hc = deepHalo(col);
      if (hc) {
        const rr = grow * WARP_BLOOM;
        ctx.globalAlpha = baseAl * Math.min(1, al * WARP_BLOOM_A);
        ctx.drawImage(hc, px - rr, py - rr, rr * 2, rr * 2);
        ctx.globalAlpha = baseAl;
      }
    }
    // WARP_SMEAR is a PERFORMANCE floor, and it is free. A smear shorter than a
    // few pixels is already inside the core that is about to be drawn over it, so
    // every stroke under it was four canvas calls spent on something no eye could
    // resolve — and at this population that was the single most expensive thing
    // the layer did. Measured: it is most of the field on any given frame.
    if (tail > WARP_SMEAR) {
      // LIGHT IS CONSERVED ALONG A SMEAR: the same photons spread over a longer
      // path make a fainter path. Floored, because an exact motion blur at these
      // speeds is invisible and the streak is the entire speed cue — and floored
      // HIGHER for the bright ones, whose long final sweep is the close pass and
      // has to arrive as a stroke of light rather than as a grey hair.
      const ta = al * WARP_TAIL * clamp(R * 5 / tail, st.big ? 0.5 : 0.3, 1);
      // and the same saving from the other end: a smear too faint to land is four
      // more calls nobody sees
      if (ta > 0.02) {
        ctx.lineWidth = Math.max(0.65, R * 1.35);
        if (tail > 18) {
          // only the long ones pay for a taper. A short smear has no room to show
          // one; a long one without it is a solid line with a star stuck on the end.
          const gr = ctx.createLinearGradient(ix, iy, px, py);
          gr.addColorStop(0, `rgba(${col},0)`);
          gr.addColorStop(0.55, `rgba(${col},${(ta * 0.55).toFixed(4)})`);
          gr.addColorStop(1, `rgba(${col},${ta.toFixed(4)})`);
          ctx.strokeStyle = gr;
        } else ctx.strokeStyle = `rgba(${col},${ta.toFixed(4)})`;
        ctx.beginPath(); ctx.moveTo(ix, iy); ctx.lineTo(px, py); ctx.stroke();
      }
    }
    ctx.fillStyle = `rgba(${col},${al.toFixed(3)})`;
    // A SQUARE, under a pixel wide. Most of a blanket this size is sub-pixel far
    // stars, and at that size a rect and an arc are the same two dim pixels —
    // one of them just costs a path, a fill and a curve flattener per star.
    if (R < 0.75) ctx.fillRect(px - R, py - R, R * 2, R * 2);
    else { ctx.beginPath(); ctx.arc(px, py, R, 0, TAU); ctx.fill(); }
  }
}

// animated background layer: drifting motes. (The periodic glitch scanlines are
// GONE — a signal artefact belongs to a screen showing a fiber feed, and this is
// a window onto open space. Nothing tears across a window.)
// the live half of the star field — see STAR_CLASS above. Drawn with the backdrop
// so the sky keeps its depth: everything in the lane still passes IN FRONT of it.
// eased toward 1 on the screens that are mostly sky. Mirrors drawDeepField's
// worldVis, which fades the far WORLDS out over the same half second — the two
// run in opposite directions on purpose: the menus lose the planets and gain the
// stars, so neither transition is a cut.
function tickMenuSky(dt) {
  const want = (parkedSky() || state === S.GUIDE) ? 1 : 0;
  menuSkyVis += clamp(dt / 0.5, 0, 1) * (want - menuSkyVis);
}
// …and the same idea for the throttle: eased on frame time, keyed on state, read by
// the sky's blend. See ARRIVE_CRUISE_Q for why the ease costs nothing to look at.
function tickArriveCruise(dt) {
  const want = state === S.END ? ARRIVE_CRUISE_Q : 1;
  arriveCruise += clamp(dt / ARRIVE_EASE, 0, 1) * (want - arriveCruise);
}
function drawStarField() {
  const bdt = typeof frameDt === 'number' ? frameDt : 0; // bursts advance on frame time, not wall time
  tickMenuSky(bdt);
  tickArriveCruise(bdt);
  // ONE SKY, TWO DISTANCES. The stationary twinkling field is the FAR sky; it
  // still thins under way, because at speed the streaks own the frame and the
  // painted depth steps back to WARP_SKY with its sheet. The blanket is the
  // NEAR sky and it ALWAYS runs — station-keeping crawl on the menus, the full
  // rush in the lane; the throttle blend lives inside drawWarpSky. No handover,
  // no cross-fade: a launch changes the speed of one field, never the field.
  const warpK = laneFlow;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter'; // a flare ADDS light; over the band it
                                            // has to build on what is already there
  if (warpK < 0.996) drawLiveStars(liveStars, 1 - warpK, bdt);
  // the menus' extra field, riding the same fade as its baked sheet
  if (menuSkyVis > 0.004) drawLiveStars(menuStars, menuSkyVis, bdt);
  drawWarpSky(1, bdt);   // the cruise never stops — see the throttle inside
  ctx.restore();
}
// THE GATE AND THE BURST CLOCK, shared by both skies — the drifting field and the
// lane's blanket are the same stars seen from a parked ship and a moving one, so
// they scintillate off one machine. Returns the brightness multiplier: 1 is the
// star exactly as painted, under 1 is a dip, over 1 is a flare brighter than it
// was ever painted. Advances the star's own burst phase, so it must be called
// once per star per frame and never twice.
function starFlare(s, bdt) {
  // THE GATE FIRST: most of the time this is 0 and the star is simply painted,
  // costing one multiply to find out. What survives is a field where a scatter
  // of stars is shimmering and the rest of the sky is holding still.
  let amp = s.amp;
  if (amp) {
    const gu = (0.5 + 0.5 * Math.sin(time * s.g1 + s.gp1))
      * (0.5 + 0.5 * Math.sin(time * s.g2 + s.gp2));
    if (gu <= GATE_T) { s.bph = 0; amp = 0; } // shut: rearmed for the next burst
    else {
      // ACCUMULATED, never time × rate: the phase has to stop advancing while
      // the gate is closed, or the star resumes mid-swing wherever the wall
      // clock happens to have carried it.
      s.bph += bdt * s.r1;
      // where we are in ONE double-then-rest cycle. It wraps, so the pair
      // repeats for as long as the gate holds it open.
      const c = s.bph % CYCLE_PH;
      // sin(πq) is the pair's own envelope — in from nothing, out to nothing,
      // across exactly STAR_BLINKS swings. Past that the star rests, and the
      // rest is what makes the two flashes group as a pair.
      amp = c >= BURST_PH ? 0 : amp * Math.sin(Math.PI * (c / BURST_PH));
    }
  }
  // two incommensurate rates, so a star never repeats its own pattern and no
  // two stars ever agree — driven by the burst phase now, so the second rate
  // stays incommensurate WITHIN a burst rather than across the wall clock.
  // amp 0 (steady class, shut gate, or a spent burst) → a constant.
  const w = amp && (0.62 * (0.5 + 0.5 * Math.sin(s.bph + s.p1))
    + 0.38 * (0.5 + 0.5 * Math.sin(s.bph * s.rr2 + s.p2)));
  // both ways around the baseline: 1-amp at the bottom, 1+amp at the top
  return 1 - amp + 2 * amp * w;
}
function drawLiveStars(arr, vis, bdt) {
  // STATIONARY — these are the far field's twinkling half and the far field
  // holds still under forward flight. What survives of the wrap discipline is
  // one pull: a star scattered at the strip's seam owes its bloom to the left
  // edge, exactly as its baked neighbours were stamped there by wrapXs.
  const M = STARFX.bloomR * skyUnit * 2.5; // margin: a bloom is wider than its star
  for (const s of arr) {
    let sx = s.x;
    if (sx > skyW - M) sx -= skyW;
    if (sx > W + M) continue;  // scattered in the strip's off-frame margin
    const sy = s.y;
    const k = starFlare(s, bdt);   // the gate and the burst clock — see starFlare
    // × vis: the menu field's live half fades with its own baked sheet, so the
    // two halves of that layer arrive and leave together
    const al = Math.min(1, s.al * k * vis);
    if (al < 0.006) continue;
    let col = s.col;
    if (s.hue) {
      // the scintillation colour shift: a bright star seen through anything at all
      // splits toward blue as it dims and toward amber as it flares. Tiny numbers —
      // it should never read as a coloured light, only as a star that is burning.
      const h = Math.sin(time * s.r2 * 1.9 + s.p1) * s.hue;
      const [r0, g0, b0] = s.rgb;
      col = clamp(r0 + h, 0, 255).toFixed(0) + ',' + clamp(g0 + h * 0.15, 0, 255).toFixed(0)
        + ',' + clamp(b0 - h, 0, 255).toFixed(0);
    }
    if (s.big) { // the bright ones bloom — and the bloom SWELLS with the flare,
      const F = STARFX;                 // which is most of what sells a star flaring
      // × skyUnit: proportional to the frame, not absolute pixels — 13px was a
      // highlight on a desktop and candy on a phone. × bk: the star's own
      // luminosity, so the field carries a RANGE of halo sizes.
      const rr = F.bloomR * skyUnit * (s.bk || 1) * (0.55 + 0.75 * k);
      const gg = ctx.createRadialGradient(sx, sy, 0, sx, sy, rr);
      const a0 = al * F.bloomA;
      // SIX STOPS, not two. A two-stop gradient falls off in a straight line, and
      // a straight line has an end: the halo held a visible alpha right up to its
      // radius and then stopped, which is the hard rim. Scattered light does not
      // do that — it drops fast out of the core and then trails away to nothing.
      // The stops below are an exponential-ish curve, so nearly all the light sits
      // in the inner quarter and the outer half is a breath that reaches zero
      // before the edge does. Wider AND fainter than the disc it replaces: the
      // reach is what makes it read as scatter, the low peak is what stops it
      // reading as a lamp.
      for (const [p, w] of STAR_HALO) gg.addColorStop(p, `rgba(${col},${(a0 * w).toFixed(4)})`);
      ctx.fillStyle = gg;
      ctx.beginPath(); ctx.arc(sx, sy, rr, 0, TAU); ctx.fill();
      // REFRACTION. A bright point seen through anything — atmosphere, a canopy,
      // a lens — throws light along an axis, and that streak is most of what says
      // "burning" rather than "dot". Two soft strokes, gated on the flare so they
      // arrive with the scintillation and are gone between bursts: nothing until
      // the star is genuinely brighter than it was painted, and capped there, or a
      // dramatic-class swing grows the streak without end.
      //
      // Uneven arms on purpose — the vertical is shorter, which reads as
      // refraction where an even cross reads as a sparkle stamped on the sky. Each
      // arm gets a gradient over ITS OWN length, so both reach zero exactly where
      // the stroke stops; one gradient shared across both would end the short arm
      // at a third of its alpha, which is the same hard edge this is fixing.
      const sk = F.spike * al * clamp(k - 1, 0, 1);
      if (sk > 0.004) {
        ctx.lineWidth = F.spikeW;
        // screen-aligned even as the sky turns: the streak is thrown by the
        // canopy the star is seen THROUGH, and the canopy is the ship's
        for (const [dx, dy, m] of [[1, 0, 1], [0, 1, 0.62]]) {
          const L = rr * F.spikeR * m;
          const x0 = sx - dx * L, y0 = sy - dy * L, x1 = sx + dx * L, y1 = sy + dy * L;
          const lg = ctx.createLinearGradient(x0, y0, x1, y1);
          lg.addColorStop(0, `rgba(${col},0)`);
          lg.addColorStop(0.5, `rgba(${col},${(sk * m).toFixed(4)})`);
          lg.addColorStop(1, `rgba(${col},0)`);
          ctx.strokeStyle = lg;
          ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
        }
      }
    }
    ctx.fillStyle = `rgba(${col},${al.toFixed(3)})`;
    // the core grows a little too: a star at full flare is not the same size dot
    ctx.beginPath(); ctx.arc(sx, sy, s.r * (0.8 + 0.35 * k), 0, TAU); ctx.fill();
  }
}
// binary / hex snippets racing along the tunnel axis — glyph by glyph, in true perspective,
// flowing both toward and away from the player like live traffic on the line