'use strict';
// ---------- campaign route map ----------
// the ring becomes a LENS over the LANE CHART — the network seen from above
// the plane. The relay list rides the left column, the dossier the right, and
// selecting a relay glides the lens along the route.
//
// The chart is a DEFENDED volume. The core systems sit at its heart, wrapped in
// concentric PATROL CORDONS, each one thinner than the last. Case 01 flies its
// lanes inside that core; every case after it spirals further out into weaker
// cover until the last one runs dark past the final cordon — which is exactly
// why a lane carries more interdictors the further out you work.
// The sheet is baked at QUARTER resolution and there is only ONE layer now.
// Two full-res layers cost 123MB, which is absurd for a static backdrop. The
// baked content is all diffuse — arms, bulge, dust — and diffuse content is
// precisely what survives an upscale. Everything with an EDGE (the 9000-star
// field, the systems, the cordons) is drawn LIVE and culled to the lens, which
// also made it sharper than baking ever did. 123MB -> 4MB.
const BASE_K = 0.25;
// THE GRID ARTEFACT, and what it actually was. It got blamed on a bloom pass
// that blurred a 5200x3100 temp canvas with ctx.filter — plausible, since a
// filter that large is executed in TILES. That pass is gone and the grid stayed,
// because the grid was never a seam.
//
// Skia DITHERS every gradient it rasterises, with a 4x4 ordered matrix locked to
// device pixels. The arms are ~4800 radial gradients at alpha 0.010-0.040, and
// at those alphas the dither is not a rounding correction — it IS the signal.
// 'lighter' then stacks the SAME matrix 4800 times, in register, until it
// reinforces into a mesh. Measured on the bake: local luminance 18 against a
// lattice amplitude of 6, autocorrelation peaking at lag 4 on both axes. The
// lens magnifies that 4px lattice by the map zoom, which is why it read as a
// grid of cells rather than as grain.
//
// So the diffuse field is accumulated in FLOATS below and handed to the canvas
// as one finished image. There is nothing left for the rasteriser to dither.
// ---------- THE MARQUEE ----------
// This exists because a level name USED to be two place names and an arrow,
// which would not fit at any size — shrinking to 8px only made it illegible in a
// different way, and handing fillText a maxWidth condenses the letters until
// Audiowide stops being Audiowide. A name that overruns its bracket is CLIPPED
// and SCROLLED instead. Every list of names in the game does this the same way,
// so it lives here rather than in the one screen that needed it first.
//
// A name is now ONE destination, so it nearly always fits and this nearly always
// no-ops (`want` is 0 whenever tw <= w). It is kept, not deleted, because
// "nearly" is doing real work: system names are generated, a long one paired
// with a high numeral still overruns a narrow bracket, and community packages
// can push relay counts further out the spiral than the bundled five do. The
// cost of keeping it is one measureText per row per frame; the cost of removing
// it is a name that silently runs off the edge of the leaderboard.
//
// Only the FOCUSED row scrolls. Eight names sliding at once was motion for its
// own sake, and the head of each row is the thing you scan the column by, so an
// unfocused row must show it. Offsets are eased rather than snapped, so losing
// focus walks the name home instead of jumping it.
//
// `k` is the 0..1 travel, and null parks the text at the start.
let marqScroll = {};   // eased offset per key — survives a focus change so it can ease
let marqT = 0;         // the clock for screens with no camera of their own
// THE MARQUEE IS THE CAMERA — on the rare row long enough to still scroll. The
// focused row's name rides the same 0..1 the lens uses to fly the lane, so the
// two are one motion rather than two clocks telling the same story out of step.
//
// This coupling was the whole point when a name was "FROM » TO": the text
// travelled from one end of the route to the other exactly as the camera did,
// and you read the arrival at the moment you reached it. A one-destination name
// has no second half to travel to, so what survives is the weaker version — a
// long name walks while the camera flies. Worth keeping for the rows it still
// catches; not worth mourning, because the route is drawn on the chart, and a
// line between two systems was always going to say it better than a string could.
//
// The leaderboard has no lens to ride, so marqueeK() replays that same ping-pong
// off marqT — identical rate, identical dwell at both ends — and the two screens
// read as one behaviour.
let mapRideK = 0;
function marqueeK() {
  const ping = marqT % 2, raw = ping < 1 ? ping : 2 - ping;
  const held = clamp((raw - 0.14) / 0.72, 0, 1);   // dwell at both ends
  return held * held * (3 - 2 * held);             // ease in and out of the run
}
// Draws `txt` at baseline `by`, clipped to the bracket [x, x + w] and scrolled
// when it overruns it. Font, fill and baseline in force are the ones used — this
// owns only the clip and the offset — and textAlign must be 'left', since the
// offset is measured from the start of the string.
function drawMarquee(key, txt, x, by, w, k) {
  const tw = ctx.measureText(txt).width;
  const want = (k === null || tw <= w) ? 0 : -(tw - w) * k;
  const cur = marqScroll[key] === undefined ? 0 : marqScroll[key];
  // fast ease — enough to smooth a focus change without lagging the camera it is
  // supposed to be moving with
  const ox = marqScroll[key] = cur + (want - cur) * (1 - Math.pow(0.002, Math.min(0.05, frameDt || 0.016) / 0.12));
  ctx.save();
  // one line of text, so only the horizontal bracket is a real edge — the clip is
  // left open vertically rather than guessing the font's box
  ctx.beginPath(); ctx.rect(x - 2, by - H, w + 4, H * 2); ctx.clip();
  ctx.fillText(txt, x + ox, by);
  ctx.restore();
}
let mapRideT = 0, mapRideSel = -1; // the camera's trip along the selected lane
let cityBase = null, mapCamX = 0, mapCamY = 0, mapCamSnap = true, mapZoom = 1;
const mapR = () => menuGeom().R * 0.92; // the lens rim MATCHES the mode wheel — seamless crossfade
const CITY_W = 5200, CITY_H = 3100;
const CITY_CORE = { x: CITY_W * 0.5, y: CITY_H * 0.5 };
// the ground is an iso plane: a CIRCLE painted on it reads as a 2:1 ellipse on
// the sheet, so ground distance counts y at double weight
const groundR = (x, y) => Math.hypot(x - CITY_CORE.x, (y - CITY_CORE.y) * 2);
// The patrol cordons ARE the case bands: CORDON 01 is the belt case 01 works,
// CORDON 02 the belt case 02 works, and so on out. buildCity fits each cordon
// to the relays that actually landed there, so the chart and the dossier never
// disagree about how much escort cover a run still has.
// The cordon bands ARE the campaigns — band N is the region campaign N works, so
// the chart and the case list cannot disagree about where you are. Cover falls
// band by band, which is the map's own account of why the traffic thickens.
const RING_NAMES = ['LOW ORBIT', 'MONITORED SECTORS', 'DEEP SPACE', 'OUTLAW TERRITORY', 'NO MANS LAND'];
const CORE_NAME = 'THE INNER WORLDS', DARK_ZONE = 'NO MANS LAND';
let RINGS = []; // [{ r0, r1, name }] per case band, innermost first
// escort coverage: total at the core, gone by the far edge. This is the number
// the dossier quotes — and the reason the traffic thickens as you go out.
const shieldAt = r => Math.round(100 * clamp(1 - Math.pow(clamp(r / BANDS[BANDS.length - 1][1], 0, 1), 1.4), 0, 1));
// (the drift, the harbor and the debris stream are GONE with the city they
// belonged to. A dust band cutting the sheet made sense on a ground plane; on a
// star chart the equivalent is scenery — asteroid fields, placed as destinations
// like everything else, rather than a river you route around.)
// where each case finally delivers — the terminus past its last relay
// (CITY_TERMS is gone. It hardcoded the old game's police and precinct places
// onto a star chart. A campaign's terminus is simply the
// last destination it delivers to, and that already has a name.)
// one chain per campaign: { pts: [...relays, terminus], segs: [...runs] }.
// The chains are links of ONE spiral, so a case begins exactly where the last
// one delivered.
let CITY_CHAINS = [];
// two offscreen layers: BASE (ground grid, streets, harbor, the perimeters) and
// TOP (the building wireframe). The live route draws between them, so the data
// infrastructure reads as underground — ghosting through the towers.
// ---------- DESTINATION KINDS ----------
// >>> DEST-KIND
// A relay delivers to a BODY: a world, or the system's own primary. Kind is
// chosen deterministically from campaign + level, exactly like the planet
// variant, so the chart and the end of the lane always agree about what is out
// there.
//
// Stations and gates USED to be answers here, and a quarter of every contract
// was flown to one. They are not places you arrive at any more — they are what
// stands in front of the place you arrive at (see the companion in DEST_LIFE).
// What that bought: the build no longer has to fill the bore to be seen, so it
// is read at a size where its detail survives instead of one where it becomes
// wallpaper, and every arrival now has a world behind it to give it a scale.
//
// Asteroid fields are scenery only — you fly THROUGH a field, you do not arrive
// at one — so they are never a mission endpoint.
function destKindFor(campId, lv, isBoss) {
  // A CONTRACT'S ENDPOINT IS ALWAYS A WORLD. It used to BE the fortress or the
  // gate; now the convoy is delivering to somewhere that fortress guards, and
  // the fortress is the thing hanging in front of it as you come in.
  if (typeof s3FinalFor === 'function' && s3FinalFor(campId, lv)) return 'planet';
  if (namedDestFor(campId, lv)) return 'planet'; // a named world IS its relay's destination
  // A FROZEN CELL ALREADY SAYS WHICH BODY IS THERE, and a sun is a sun — so the
  // kind is read off the variant rather than dealt a second time from a hash that
  // could disagree with it.
  const vid = dealVariantId(campId, lv);
  if (vid) return STAR_IDS[vid] ? 'star' : 'planet';
  let h = 0x811c9dc5;
  const id = (campId || 'x') + '#' + lv;
  for (let i = 0; i < id.length; i++) { h ^= id.charCodeAt(i); h = Math.imul(h, 16777619); }
  h ^= h >>> 15; h = Math.imul(h, 0x2545f491); h ^= h >>> 13;
  const q = (h >>> 0) % 100;
  // A DUEL NO LONGER MEANS A SUN. `isBoss` used to force one, which read as a
  // rule the moment you noticed it — every boss on the same anonymous star. A
  // boss relay is dealt its destination like any other, so an interdiction
  // happens wherever the contract was going: usually a world, sometimes a
  // primary. The argument stays because callers pass it and the chart asks.
  return q < DEST_MIX.star ? 'star' : 'planet';
}
// <<< DEST-KIND
// (drawStationArt / drawGateArt / drawFieldArt are RETIRED, and so is the shaded
// vector torus that replaced them. Both were line art, which at chart scale reads
// as a doodle beside a shaded planet. Stations and gates are the BUILT sprites
// now — s3draw, off the same bake the destination uses, so the chip on the chart
// is a small picture of the place you fly to. Asteroid fields are gone with the
// scenery model that needed them: a galaxy is star systems.)

// ---------- THE GALAXY CHART ----------
// Replaces the isometric city wholesale. The structure that survives is the one
// that was never about a city: relays spiralling OUTWARD from the centre, one
// cordon band per campaign, and cover falling as you go. What changes is that the
// centre is now a SUN, the bands are its orbits, and the things at the ends of
// lanes are worlds, stations and gates instead of street junctions.
//
// The dog-legged routing goes with it. Runs used to corner along an avenue grid,
// which was the last thing on this map that could only be a city — stars do not
// have street corners. Lanes are now polar interpolations: radius and bearing
// eased together around the sun, so every run curves the way an orbit does.
const polarOf = p => {
  const dx = p.x - CITY_CORE.x, dy = (p.y - CITY_CORE.y) * 2;
  return { r: Math.hypot(dx, dy), a: Math.atan2(dy, dx) };
};
const fromPolar = (r, a) => ({ x: CITY_CORE.x + Math.cos(a) * r, y: CITY_CORE.y + Math.sin(a) * r * 0.5 });
function laneArc(A, B) {
  // STRAIGHT. A warp lane is a charted corridor between two points, not an orbit:
  // nothing is falling around anything while it flies one. The polar
  // interpolation that used to be here bent every run into an arc, which read as
  // orbital mechanics and made two lanes to neighbouring systems curve apart from
  // each other for no reason a navigator could give.
  //
  // Still returned as a polyline so polyAt() can ride it and the chevron spacing
  // still walks it evenly.
  const N = 8, out = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    out.push({ x: A.x + (B.x - A.x) * t, y: A.y + (B.y - A.y) * t });
  }
  return out;
}

// THE CORDONS ARE FIXED STRUCTURE, and relays are scattered INSIDE them.
//
// The first cut had this backwards: relays marched around a smooth spiral and the
// cordons were then fitted to wherever they landed. That is why the chart read as
// organised — a clockwise procession with rings drawn around it. Now the bands are
// declared up front, campaign N owns band N, and its relays are scattered at
// random bearings and random depths within that annulus. The band still says
// exactly what it said before about cover; the walk through it is no longer a
// parade.
// Deliberately SMALL against the 5200x3100 sheet. Vastness cannot come from a
// bigger bitmap — two layers at this size are already 123MB — so it comes from
// the RATIO: the whole patrolled region spans about a fifth of the chart, the
// lens closes in on one hop, and a run shows roughly 7% of the galaxy.
const BANDS = [[170, 340], [340, 520], [520, 720], [720, 930], [930, 1150]];
let SCENERY = [];   // non-mission destinations: the rest of the settled volume
// THE SPLIT THAT FIXES THE PIXELATION: bake only what has no EDGE.
//
// The lens zooms to 2.2x over a half-res sheet — 4.4x magnification. Smooth
// gradients survive that invisibly, which is why arms, bulge and dust lanes can
// still bake. Stars, cordon dashes and type cannot: magnified 4.4x a star is a
// block and a label is mush. Those are DATA now, drawn live at screen
// resolution, so they stay sharp at any zoom the lens reaches.
let GAL_STARS = [];
// Every system and every world gets a NAME, dealt off its own seed so it is
// permanent — a place you have flown to is called the same thing next time.
const NM_A = ['AL', 'BEL', 'CAS', 'DRA', 'ERI', 'FOR', 'GAL', 'HYD', 'IND', 'KEP',
              'LYR', 'MEN', 'NOR', 'ORI', 'PYX', 'QUI', 'RIG', 'SER', 'TAU', 'VEG',
              'XAN', 'ZUB', 'CET', 'MIR', 'ALT', 'DEN'];
const NM_B = ['', 'A', 'AR', 'EN', 'IS', 'OR', 'US', 'AN', 'EL', 'IX', 'OS', 'YR'];
const NM_C = ['', '', '', ' PRIME', ' MINOR', ' MAJOR', ' REACH', ' DEEP', ' WATCH'];
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];
function sysName(seed) {
  let h = (seed * 2654435761) >>> 0;
  const a = NM_A[h % NM_A.length]; h = Math.imul(h ^ h >>> 13, 0x5bd1e995) >>> 0;
  const b = NM_B[h % NM_B.length]; h = Math.imul(h ^ h >>> 11, 0x27d4eb2d) >>> 0;
  const c = NM_C[h % NM_C.length]; h = Math.imul(h ^ h >>> 9, 0x85ebca6b) >>> 0;
  return a + b + c + (c ? '' : ' ' + (100 + h % 899));
}
// A destination is a BODY IN a system, never a system itself. It is either one of
// the planets on an orbit or the star at the centre — and if it is the star, the
// star is what a star looks like, never a planet wearing a sun's job.
function relayDest(i) { const p2 = relayW(i); return p2 && p2.sys ? p2 : null; }
function relayDestPos(i) {
  const p2 = relayW(i);
  return (p2 && p2.dx !== undefined) ? { x: p2.dx, y: p2.dy } : p2;
}
// Named for ANY relay, not just the one on screen, so the campaign list and the
// briefing disc can both ask.
function destNameAt(ci, li) {
  if (!CITY_CHAINS.length) buildCity();
  const ch = CITY_CHAINS[clamp(ci, 0, CITY_CHAINS.length - 1)];
  const p2 = ch && ch.pts[clamp(li, 0, ch.pts.length - 1)];
  return (p2 && p2.dname) || 'UNCHARTED';
}
// The level's name is WHERE IT DELIVERS. Nothing else.
//
// It used to be the whole leg — "FROM » TO" — which is true to the fiction and
// wrong on every surface that shows it. Two system names and a chevron is a
// string long enough to need shrinking in the menu, truncating on the
// leaderboard and eliding in the HUD, and the FROM half carries no information
// the player does not already have: it is the level they just finished. What
// they are actually reading for is the far end, and it was the half that lost
// the fight for space. The route is still on the chart, drawn, where a route
// belongs.
//
// The name is kept for its callers — nothing outside this file cares that a leg
// stopped having two ends.
function levelRouteName(ci, li) {
  if (!CITY_CHAINS.length) buildCity();
  return destNameAt(ci, li);
}
// the route for the level being flown right now
function levelTitle(i) { return levelRouteName(Math.max(0, CAMPAIGNS.indexOf(CAMP)), i); }
function curRouteName() {
  const ci = Math.max(0, CAMPAIGNS.indexOf(CAMP));
  return levelRouteName(ci, levelIdx);
}
function buildCity() {
  const rng = mulberry32(0xC17C0DE);

  // ---- placement: scattered inside each cordon, then walked ----
  const counts = (CAMPAIGNS.length ? CAMPAIGNS : [{ levels: new Array(8) }]).map(p => p.levels.length);
  const bandOf = ci => BANDS[Math.min(ci, BANDS.length - 1)];
  const pts = [];
  let prev = null;
  for (let ci = 0; ci < counts.length; ci++) {
    const n = counts[ci];
    // A CONTRACT SPANS TIERS. Campaign N no longer sits inside cordon N: it flies
    // the route its brief states, so the cargo run really does start in safe space
    // and end in tier 3, and the delegation really does cross all five cordons.
    // Relay k advances along that span, so the run reads outward as a journey —
    // but its BEARING stays random inside the sector, which is what keeps it from
    // becoming the parade we removed.
    const camp = CAMPAIGNS[ci];
    const T = (camp && camp.tiers) || [ci + 1, ci + 1];
    const t0 = clamp(T[0] - 1, 0, BANDS.length - 1), t1 = clamp(T[1] - 1, 0, BANDS.length - 1);
    const b0 = BANDS[t0][0], b1 = BANDS[t1][1];
    const radAt = k => {
      const f = n > 1 ? k / (n - 1) : 0;
      const tf = t0 + f * (t1 - t0);
      const bi = Math.min(BANDS.length - 1, Math.floor(tf)), frac = tf - bi;
      const [c0, c1] = BANDS[bi];
      // sit inside the tier this leg belongs to, with a little slack either way
      return clamp(c0 + frac * (c1 - c0) + (rng() - 0.5) * (c1 - c0) * 0.5, b0, b1);
    };
    // A ROUTE IS WALKED, NOT SCATTERED. Relays used to land at a random bearing
    // anywhere in a wide sector, so a leg regularly crossed half the chart
    // while its level lasted fifty seconds. Each relay now STEPS from the one
    // before it, and the step is the level's own duration mapped to world
    // units — the lane on the chart resembles the flight it stands for.
    // Radius still advances through the contract's stated tiers (radAt, above
    // — that fiction is load-bearing); only the BEARING is solved, swept one
    // way so the whole ladder works around the core contract by contract.
    // Where the tiers demand more radius than the duration buys — a delegation
    // crossing every cordon, a boss leg diving back toward the core for the
    // next contract — the radial distance wins and the leg is as short as the
    // band structure allows.
    const legLen = d => 30 + (d || 55) * 1.6;
    for (let k = 0; k < n; k++) {
      const r = radAt(k);
      if (!prev) { // the very first relay of the whole chart
        const p2 = fromPolar(r, -2.35 + (rng() - 0.5) * 0.3);
        pts.push(p2); prev = p2;
        continue;
      }
      // the leg this step creates is the lane DRAWN for the level before it:
      // seg[k-1] runs relay k-1 → relay k, and a campaign boundary hands the
      // boss leg to the next contract's first system
      const lv = k > 0 ? camp && camp.levels[k - 1]
        : CAMPAIGNS[ci - 1] && CAMPAIGNS[ci - 1].levels[CAMPAIGNS[ci - 1].levels.length - 1];
      const L = legLen(lv && lv.duration);
      const pa = polarOf(prev).a;
      const at = da => fromPolar(r, pa + da);
      const dist = da => { const q = at(da); return Math.hypot(q.x - prev.x, q.y - prev.y); };
      // solve the sweep for the chord. The radial jump may already spend the
      // whole budget — then the bearing barely moves — otherwise bisect on the
      // squashed plane, where a closed form is not worth having.
      let da = 0.025 + rng() * 0.03;
      if (dist(da) < L) {
        let lo = da, hi = 0.35;
        while (dist(hi) < L && hi < 2.2) hi += 0.25;
        for (let b = 0; b < 22; b++) {
          const mid = (lo + hi) / 2;
          if (dist(mid) < L) lo = mid; else hi = mid;
        }
        da = (lo + hi) / 2 + (rng() - 0.5) * 0.04;
      }
      // hold the frame and keep the SYSTEMS apart — extend the sweep until
      // clear, and ALWAYS place: a dropped relay would tear the chain, which
      // is exactly what the old 900-guard scatter could silently do.
      let best = at(da), bestSep = -1;
      for (let t = 0; t < 40; t++) {
        const c2 = at(da + t * 0.09);
        if (c2.x < 150 || c2.x > CITY_W - 150 || c2.y < 130 || c2.y > CITY_H - 130) continue;
        let sep = 1e9;
        for (const q of pts) sep = Math.min(sep, Math.hypot(q.x - c2.x, (q.y - c2.y) * 2));
        if (sep >= 120) { best = c2; break; }
        if (sep > bestSep) { bestSep = sep; best = c2; }
      }
      pts.push(best); prev = best;
    }
  }
  // the final terminus: where the last case delivers, just past the last cordon
  {
    const last = prev || fromPolar(BANDS[0][0], -2.35);
    const pl = polarOf(last);
    pts.push(fromPolar(Math.min(BANDS[BANDS.length - 1][1] + 190, CITY_W * 0.46), pl.a + 0.22));
  }
  // (segs are built AFTER the destinations exist — see below — because a lane
  // joins the bodies a convoy actually flies between, not the middles of the
  // systems that happen to contain them.)
  let segs = [];
  // cordons come straight from the band table — they are the structure the relays
  // were placed inside, not a fit after the fact
  RINGS = BANDS.slice(0, Math.max(1, counts.length)).map((b, i) => ({
    r0: b[0], r1: b[1], name: RING_NAMES[Math.min(i, RING_NAMES.length - 1)]
  }));

  // ---- STAR SYSTEMS: what a galaxy is actually made of ----
  // Not scattered glyphs. A system is ONE star with planets around it, and the
  // galaxy is hundreds of them — denser along the arms, thinning into the halo.
  // Drawing them as systems rather than as icons is the whole difference between
  // a chart that reads as space and one that reads as a diagram of space.
  SCENERY = [];
  const STAR_CLASS = [
    { c: '190,214,255', g: '120,170,255', r: 3.4 },  // blue-white
    { c: '236,244,255', g: '170,200,255', r: 2.8 },  // white
    { c: '255,244,206', g: '255,214,140', r: 2.6 },  // yellow
    { c: '255,214,158', g: '255,170,90',  r: 2.3 },  // orange
    { c: '255,176,140', g: '255,120,70',  r: 2.0 },  // red dwarf
    { c: '255,176,140', g: '255,120,70',  r: 2.0 }
  ];
  // two logarithmic arms, the same squash as everything else on this chart
  // Arms are LANES with dark space between them, not a wash. The spread used to
  // be 130+t*340 — wide enough that the two arms merged into one continuous fog
  // across the whole operating region.
  const armAt = (t, arm) => {
    const a2 = arm * Math.PI + t * 4.4;
    const rr = 300 + Math.pow(t, 0.88) * 2500;
    return { a: a2, r: rr, spread: 90 + t * 200 };
  };
  const mkSystem = (x, y, force) => {
    if (x < 60 || x > CITY_W - 60 || y < 50 || y > CITY_H - 50) return;
    const far = groundR(x, y);
    const cls = STAR_CLASS[rng() * STAR_CLASS.length | 0];
    // Compact on purpose. Sprawling systems cannot be packed without their
    // outer orbits crossing, and a band has to hold eight relays plus scenery.
    const np = 2 + (rng() * 3 | 0);
    const planets = [];
    let orb = cls.r * 2.4 + rng() * 4;
    for (let k = 0; k < np; k++) {
      orb += 3.5 + rng() * 5;
      planets.push({ o: orb, a: rng() * TAU, sz: 0.7 + rng() * 1.3, V: PLANET_TYPES[rng() * PLANET_TYPES.length | 0] });
    }
    // A system's REACH is its outermost orbit, not its star. Two systems whose
    // reaches overlap draw planets through each other and read as one confused
    // object — so the test is reach-to-reach, never centre-to-centre.
    const reach = (planets.length ? planets[planets.length - 1].o : cls.r * 4) * 1.15;
    if (!force) for (const q of SCENERY) {
      if (Math.hypot(q.x - x, (q.y - y) * 2) < reach + q.reach + 14) return null;
    }
    const sy = { x, y, cls, planets, far, reach, station: rng() < 0.14, seed: rng() * 100 };
    sy.name = sysName(Math.floor(x * 31 + y * 17));
    SCENERY.push(sy);
    return sy;
  };
  // Every relay is a system, and one body inside it is the destination.
  //
  // The destination rides ON THE POINT rather than in a side table keyed by the
  // global index. The first cut used RELAY_SYS[globalIndex] while relayW() indexes
  // the CURRENT campaign's chain — so campaigns 2-5 read another campaign's
  // systems entirely. Chains are slices of these same point objects, so hanging
  // the data here means every view agrees by construction.
  for (let g = 0; g < pts.length; g++) {
    // force: a relay's system is mandatory, so it is placed before any scenery
    // and never rejected for overlap — the scenery packs around it instead
    const sy = mkSystem(pts[g].x, pts[g].y, true);
    if (!sy) continue;
    // which campaign and level this global point belongs to
    let ci = 0, li = g;
    while (ci < counts.length - 1 && li >= counts[ci]) { li -= counts[ci]; ci++; }
    const camp = CAMPAIGNS[ci];
    const lv = camp && camp.levels && camp.levels[li];
    const boss = !!(lv && lv.boss);
    const campId = campIdOf(camp);
    // WHERE IN THE SYSTEM THE DELIVERY IS, and it is destKindFor that says so —
    // not `boss`. Pinning bosses to the centre was the chart's own copy of the
    // every-duel-happens-at-a-sun rule, and it disagreed with the lane the
    // moment the lane stopped believing it. One function decides, both views
    // follow, which is what this file has always claimed.
    const kind = destKindFor(campId, li, boss);
    const slot = kind === 'star' ? -1 : (Math.abs(Math.floor(pts[g].x * 13 + pts[g].y * 7)) % sy.planets.length);
    pts[g].sys = sy; pts[g].slot = slot; pts[g].campId = campId; pts[g].li = li; pts[g].boss = boss;
    // ...AND THE BODY WEARS WHAT YOU WILL ACTUALLY ARRIVE AT. destKindFor above
    // settled star-vs-world, but the body's LOOK was still whatever mkSystem's
    // own rng dealt it — so the chart showed an ice giant for a relay that flies
    // you to a molten world, and the map was decorative rather than a chart.
    // Both views now read planetVariantFor/starFor, which is the same deal the
    // lane's own destination is built from (DEST_DEAL, then the hash walk).
    //
    // Overwritten HERE, on the one body the relay delivers to, rather than in
    // mkSystem: every other world in the system is scenery and keeps its rolled
    // look, so systems stay varied while the destination tells the truth.
    if (typeof planetVariantFor === 'function') {
      const V = planetVariantFor(campId, li, boss);
      if (V && slot >= 0) sy.planets[slot].V = V; // planetChip(V) bakes the world you land at
      else if (V && V.z) {
        // the primary IS the destination, so the chart's sun wears the dealt
        // sun's own colours: `z` is its core, `atmo` its halo. Joined to
        // strings because STAR_CLASS carries "r,g,b" text while a variant
        // carries [r,g,b] — the template literal hides that, and hiding it is
        // how the next reader gets a surprise.
        sy.cls = { c: V.z.join(','), g: (V.atmo || V.z).join(','), r: sy.cls.r };
      }
    }
    // The primary carries the system's bare name; a world carries its numeral.
    // The STATION and GATE suffixes are gone with the kinds that earned them —
    // an installation is no longer the destination, so it no longer names one.
    if (slot < 0) { pts[g].dx = sy.x; pts[g].dy = sy.y; pts[g].dname = sy.name; }
    else {
      const pl = sy.planets[slot];
      pts[g].dx = sy.x + Math.cos(pl.a) * pl.o;
      pts[g].dy = sy.y + Math.sin(pl.a) * pl.o * 0.5;
      pts[g].dname = sy.name + ' ' + ROMAN[Math.min(slot, ROMAN.length - 1)];
    }
    sy.relay = g;
  }
  for (let arm = 0; arm < 2; arm++) {
    for (let i = 0; i < 300; i++) {
      const t = Math.pow(rng(), 0.72);
      const A2 = armAt(t, arm);
      const off = ((rng() + rng() + rng() - 1.5) / 1.5) * A2.spread;
      const ang2 = A2.a + off / Math.max(60, A2.r);
      const rr = A2.r + off * 0.6;
      mkSystem(CITY_CORE.x + Math.cos(ang2) * rr, CITY_CORE.y + Math.sin(ang2) * rr * 0.5);
    }
  }
  for (let i = 0; i < 260; i++) {           // the halo — sparser, everywhere
    const rr = 200 + Math.pow(rng(), 0.6) * 2650;
    const ang2 = rng() * TAU;
    mkSystem(CITY_CORE.x + Math.cos(ang2) * rr, CITY_CORE.y + Math.sin(ang2) * rr * 0.5);
  }
  // Now the lanes: destination to destination. Leaving them on system centres was
  // why the routes did not move when the destinations did.
  segs = [];
  for (let k = 0; k + 1 < pts.length; k++) {
    const A2 = { x: pts[k].dx !== undefined ? pts[k].dx : pts[k].x, y: pts[k].dy !== undefined ? pts[k].dy : pts[k].y };
    const B2 = { x: pts[k + 1].dx !== undefined ? pts[k + 1].dx : pts[k + 1].x, y: pts[k + 1].dy !== undefined ? pts[k + 1].dy : pts[k + 1].y };
    segs.push(laneArc(A2, B2));
  }
  CITY_CHAINS = counts.map((n, ci) => {
    const base = counts.slice(0, ci).reduce((s2, v) => s2 + v, 0);
    const cp = pts.slice(base, base + n + 1), cs = segs.slice(base, base + n);
    while (cp.length < n + 1) cp.push(cp[cp.length - 1] || pts[pts.length - 1]);
    while (cs.length < n) cs.push([cp[cs.length], cp[cs.length + 1]]);
    return { pts: cp, segs: cs };
  });
  // the field: generated once, drawn live. Colours deal from the sky's ONE
  // weighted table (STAR_COLS/starColI, 20-background) — the chart had its own
  // copy dealt uniformly, so a fifth of its brights were lavender and a fifth
  // peach, which is confetti, not a field. And no two bright stars share a
  // size any more: 1.6 for every one of them was the other half of the candy —
  // the bloom rides r, so varying r is what makes them read as a population.
  GAL_STARS = [];
  for (let i = 0; i < 9000; i++) {
    const big = rng() < 0.016;
    GAL_STARS.push({
      x: rng() * CITY_W, y: rng() * CITY_H, big,
      a: big ? 0.45 + rng() * 0.5 : 0.05 + rng() * 0.26,
      r: big ? 0.9 + rng() * 0.9 : 0.28 + rng() * 0.65,
      c: STAR_COLS[starColI(rng)]
    });
  }

  // ---------- BASE: the galaxy ----------
  // Painted into a float field rather than onto the canvas — see the note by
  // BASE_K for why every one of these blobs used to arrive pre-dithered.
  const BW = Math.round(CITY_W * BASE_K), BH = Math.round(CITY_H * BASE_K);
  const fld = new Float32Array(BW * BH * 3);
  for (let i = 0; i < BW * BH; i++) { fld[i * 3] = 1; fld[i * 3 + 1] = 2; fld[i * 3 + 2] = 7; } // #010207
  // One blob, in WORLD coordinates so the placement maths below is unchanged.
  // `yw` squashes it onto the iso plane, `mid` gives the bulge its two-slope
  // profile, and `over` paints dark dust the way source-over would.
  const blob = (wx2, wy2, wr, yw, col, al, mid, over) => {
    const cx2 = wx2 * BASE_K, cy2 = wy2 * BASE_K, rx = wr * BASE_K, ry = rx / yw;
    if (rx < 0.5) return;
    const x0 = Math.max(0, Math.ceil(cx2 - rx)), x1 = Math.min(BW - 1, Math.floor(cx2 + rx));
    const y0 = Math.max(0, Math.ceil(cy2 - ry)), y1 = Math.min(BH - 1, Math.floor(cy2 + ry));
    for (let y = y0; y <= y1; y++) {
      const dy2 = (y - cy2) * yw;
      for (let x = x0; x <= x1; x++) {
        const dx2 = x - cx2;
        const t = Math.sqrt(dx2 * dx2 + dy2 * dy2) / rx;
        if (t >= 1) continue;
        // a canvas radial gradient is LINEAR between its stops — match that, so
        // the field is the same picture the gradients painted, minus the dither
        const a2 = al * (mid ? (t < 0.45 ? 1 - t * (0.55 / 0.45) : 0.45 * (1 - (t - 0.45) / 0.55)) : 1 - t);
        const i2 = (y * BW + x) * 3;
        if (over) {
          fld[i2] += (col[0] - fld[i2]) * a2;
          fld[i2 + 1] += (col[1] - fld[i2 + 1]) * a2;
          fld[i2 + 2] += (col[2] - fld[i2 + 2]) * a2;
        } else {
          fld[i2] += col[0] * a2; fld[i2 + 1] += col[1] * a2; fld[i2 + 2] += col[2] * a2;
        }
      }
    }
  };
  // --- the arms: dust and unresolved starlight wound out of the core ---
  // arms run blue-white at the edges where young stars are, warmer inward
  // The inner arms were warm out to t<0.30, which on this radius scale is ~1100px
  // — again the whole operating region. The warm band is now the innermost tenth
  // only, and much less yellow: dusty rose rather than sodium.
  const ARM_WARM = [168, 150, 158], ARM_EDGE = [186, 206, 255], ARM_MID = [132, 150, 214];
  for (let arm = 0; arm < 2; arm++) {
    for (let i = 0; i < 2000; i++) {
      const t = Math.pow(rng(), 0.78);
      const A2 = armAt(t, arm);
      const off = ((rng() + rng() + rng() - 1.5) / 1.5) * A2.spread;
      const ang2 = A2.a + off / Math.max(60, A2.r);
      const rr = A2.r + off * 0.6;
      const x2 = CITY_CORE.x + Math.cos(ang2) * rr, y2 = CITY_CORE.y + Math.sin(ang2) * rr * 0.5;
      const q = 1 - Math.min(1, Math.abs(off) / A2.spread);
      const br = 26 + rng() * 130;
      const col = t < 0.10 ? ARM_WARM : q > 0.55 ? ARM_EDGE : ARM_MID;
      // MEASURED, not guessed. Accumulated over 4800 additive blobs the old alpha
      // reached ~0.44 mean coverage at r=600-800 — where every campaign is flown —
      // which is four times the bulge's peak and is what the yellow wash actually
      // was. This lands it near 0.075: arms you can see, through which you can
      // still see space.
      const al = (0.0025 + rng() * 0.008) * (0.25 + q) * (1 - t * 0.35);
      blob(x2, y2, br, 1, col, al);
    }
  }
  // --- the bulge: the old yellow core every spiral has ---
  // THE BULGE, resized and cooled.
  //
  // It is not a nebula — it is the old-star core every spiral galaxy has. The
  // problem was scale, not identity: its outermost shell was 1150px, which is
  // EXACTLY where the outermost cordon now sits. It had been sized when the bands
  // reached 2340, and shrinking them never rescaled it, so a core became a fog
  // laid evenly over the whole patrolled region — a wash the entire game happens
  // inside of, which is why it read as a haze rather than as a place.
  //
  // It now stops inside the first cordon. From LOW ORBIT you see a bright core
  // nearby; from NO MANS LAND it is a distant glow behind you, which is what a
  // galactic core should do. Cooled and roughly halved as well.
  for (const [rad, col, al] of [[520, [96, 122, 176], 0.020], [320, [132, 164, 214], 0.030], [190, [186, 212, 246], 0.052], [95, [226, 240, 255], 0.085]])
    blob(CITY_CORE.x, CITY_CORE.y, rad, 2, col, al, true);
  // --- DARK DUST LANES: the feature that stops arms reading as airbrush ---
  const DUST = [2, 3, 10];
  for (let arm = 0; arm < 2; arm++) {
    for (let i = 0; i < 900; i++) {
      const t = Math.pow(rng(), 0.8);
      const A2 = armAt(t, arm);
      // the lane rides just INSIDE its arm, as real dust does
      const off = -A2.spread * (0.30 + rng() * 0.45) + (rng() - 0.5) * A2.spread * 0.35;
      const ang2 = A2.a + off / Math.max(60, A2.r);
      const rr = A2.r + off * 0.6;
      const x2 = CITY_CORE.x + Math.cos(ang2) * rr, y2 = CITY_CORE.y + Math.sin(ang2) * rr * 0.5;
      blob(x2, y2, 24 + rng() * 96, 1, DUST, 0.10 + rng() * 0.26, false, true);
    }
  }
  cityBase = document.createElement('canvas');
  cityBase.width = BW; cityBase.height = BH;
  withCanvas(cityBase, () => {
    const im = ctx.createImageData && ctx.createImageData(BW, BH), px = im && im.data;
    // Guarded like buildPlanetSprite: a stubbed 2D context (the headless harness)
    // has no real ImageData, and the chart must not be able to take a frame down.
    if (!px) return;
    for (let i = 0, n = BW * BH; i < n; i++) {
      // a RANDOM half-LSB of dither. The field is smooth enough to band across a
      // 4x upscale otherwise, and random noise cannot stack into a lattice the
      // way an ordered matrix does — which is the entire point of doing this here
      const j = i * 4, k = i * 3, d2 = rng() - 0.5;
      px[j] = Math.min(255, fld[k] + d2);
      px[j + 1] = Math.min(255, fld[k + 1] + d2);
      px[j + 2] = Math.min(255, fld[k + 2] + d2);
      px[j + 3] = 255;
    }
    ctx.putImageData(im, 0, 0);
  });

}

// A STAR, drawn the way a camera records one.
//
// The cartoon version is a filled disc inside a wide even halo — a sticker with a
// gradient behind it. Three things separate that from a photograph, and none of
// them is detail:
//
//   1. THE FALLOFF IS STEEP. Real glow is roughly a power law: blinding at the
//      centre, half gone within a fraction of the radius, a long faint skirt after
//      that. An even gradient over a wide radius reads as a painted circle because
//      nothing in nature falls off linearly.
//   2. THE CORE SATURATES TO WHITE. A star's colour lives in its halo; the middle
//      of any star bright enough to see is clipped white on any sensor. Drawing
//      the core in the star's own colour is what makes it look like a coloured
//      dot instead of a light.
//   3. DIFFRACTION SPIKES. Four thin crossed rays, from the optics rather than the
//      star. Nothing else says "this is a photograph of space" so cheaply — and
//      only bright stars get them, which is itself the cue that reads as exposure.
function drawStarPoint(x, y, coreR, hot, tint, bright) {
  // LAYERED BLOOM. A real bloom is not one gradient — it is a bright tight one
  // sitting inside progressively wider, fainter ones. One gradient forces a
  // choice between a hard little dot (steep) and a flat painted circle (shallow);
  // three nested ones sum to a soft core with a long, gentle tail and never show
  // an edge anywhere. Radii and alphas fall roughly geometrically, which is what
  // makes the sum look like light instead of like a stack of circles.
  for (const [k, a] of [[3.4, 0.40], [9, 0.115], [22, 0.032], [46, 0.011]]) {
    const r = coreR * k;
    if (r < 0.8) continue;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const A = a * bright;
    g.addColorStop(0.00, `rgba(${tint},${A.toFixed(4)})`);
    g.addColorStop(0.22, `rgba(${tint},${(A * 0.42).toFixed(4)})`);
    g.addColorStop(0.52, `rgba(${tint},${(A * 0.13).toFixed(4)})`);
    g.addColorStop(1.00, `rgba(${tint},0)`);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  }
  // the clipped white core: a star's colour lives in its halo, and the middle of
  // anything bright enough to see is blown out white on any sensor. Soft-edged —
  // a hard disc here is the single thing that most says "sticker".
  const cr = Math.max(0.8, coreR * 2.1);
  const cg = ctx.createRadialGradient(x, y, 0, x, y, cr);
  cg.addColorStop(0.00, `rgba(255,255,255,${Math.min(1, 0.92 * bright).toFixed(3)})`);
  cg.addColorStop(0.35, `rgba(${hot},${(0.55 * bright).toFixed(3)})`);
  cg.addColorStop(0.70, `rgba(${hot},${(0.14 * bright).toFixed(3)})`);
  cg.addColorStop(1.00, `rgba(${hot},0)`);
  ctx.fillStyle = cg;
  ctx.beginPath(); ctx.arc(x, y, cr, 0, TAU); ctx.fill();
  // A WHISPER OF FLARE, not four lines. The spikes were opaque hard-edged quads
  // and read as a decal stuck on the glow. They are barely-there now — a tenth of
  // the old alpha, shorter, and drawn as two passes so the width itself fades:
  // a wide soft one under a narrow brighter one. Only the brightest get any, and
  // that selectivity is what reads as exposure rather than as decoration.
  if (bright > 0.78 && coreR > 1.1) {
    const L = coreR * 9;
    ctx.save();
    ctx.translate(x, y);
    for (let k = 0; k < 2; k++) {
      ctx.rotate(k * Math.PI / 2);
      for (const [wk, ak] of [[0.95, 0.030], [0.34, 0.075]]) {
        const w = Math.max(0.4, coreR * wk);
        const sg = ctx.createLinearGradient(-L, 0, L, 0);
        const A = ak * bright;
        sg.addColorStop(0.00, `rgba(${tint},0)`);
        sg.addColorStop(0.30, `rgba(${tint},${(A * 0.35).toFixed(4)})`);
        sg.addColorStop(0.50, `rgba(255,255,255,${A.toFixed(4)})`);
        sg.addColorStop(0.70, `rgba(${tint},${(A * 0.35).toFixed(4)})`);
        sg.addColorStop(1.00, `rgba(${tint},0)`);
        ctx.fillStyle = sg;
        ctx.beginPath();
        ctx.moveTo(-L, 0); ctx.lineTo(0, -w); ctx.lineTo(L, 0); ctx.lineTo(0, w);
        ctx.closePath(); ctx.fill();
      }
    }
    ctx.restore();
  }
}


// Stars, cordons and labels, drawn LIVE at screen resolution — everything with an
// EDGE. `tf` maps world to screen (sx = tf.ox + x * tf.z); the map lens and the
// briefing disc's crop each supply one, so both views share this single pass and
// cannot drift apart.
// `labels` off draws the chart WITHOUT its type — the cordon names are set at a
// fixed 12px, which is a headline inside a contract disc's map strip and a
// caption inside the full lens. The rings carry the geography on their own.
function drawGalaxyOverlay(tf, ccx, ccy, R, labels) {
  if (labels === undefined) labels = true;
  const z = tf.z, pad = 8;
  for (const st of GAL_STARS) {
    const sx = tf.ox + st.x * z, sy = tf.oy + st.y * z;
    if (Math.hypot(sx - ccx, sy - ccy) > R + pad) continue;   // a star has no extent
    if (st.big) {
      // the few bright ones get the full treatment, spikes included
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      drawStarPoint(sx, sy, Math.max(0.7, st.r * z * 0.75), st.c, st.c, Math.min(1, st.a * 1.15));
      ctx.restore();
    } else {
      ctx.fillStyle = `rgba(${st.c},${st.a.toFixed(3)})`;
      // never below a pixel — a sub-pixel star is a grey smear, and a field of
      // smears is the mush we are getting rid of
      ctx.beginPath(); ctx.arc(sx, sy, Math.max(0.55, st.r * z), 0, TAU); ctx.fill();
    }
  }
  const cx2 = tf.ox + CITY_CORE.x * z, cy2 = tf.oy + CITY_CORE.y * z;
  const ell = r => { ctx.beginPath(); ctx.ellipse(cx2, cy2, r * z, r * 0.5 * z, 0, 0, TAU); };
  // The risk hues are back — they rank the cordons at a glance and nothing else
  // on the chart carries that meaning. What made them shout was never the colour
  // but the INK: a near-solid dash pattern at full strength. Widely spaced dashes
  // and a much dimmer stroke keep the ranking and give the route the foreground.
  const ringCol = i => i < 1 ? '126,226,98' : i < 3 ? '255,200,80' : '255,110,110';
  const perimeter = (r, col, a) => {
    ctx.save();
    ctx.strokeStyle = `rgba(${col},${a.toFixed(2)})`;
    ctx.lineWidth = 1.6;
    ctx.setLineDash([10, 54]);   // was [18,12] — nearly solid; now mostly gap
    ell(r); ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = `rgba(${col},${(a * 0.13).toFixed(2)})`;
    ctx.lineWidth = 6;
    ell(r); ctx.stroke();
    // picket stations: fewer and smaller, so the ring reads as a sparse patrol
    // line rather than a studded band
    ctx.fillStyle = `rgba(${col},${(a * 0.55).toFixed(2)})`;
    for (let k = 0; k < 14; k++) {
      const a2 = k / 14 * TAU;
      ctx.fillRect(cx2 + Math.cos(a2) * r * z - 1.5, cy2 + Math.sin(a2) * r * 0.5 * z - 1.5, 3, 3);
    }
    ctx.restore();
  };
  if (RINGS.length) perimeter(RINGS[0].r0, '126,226,98', 0.30);
  // (The cordon labels are gone — 'CORDON 0N · NAME' and its COVER readout used
  // to ride each ring and simply got in the way of the route. The dossier already
  // carries both for the relay you are looking at, which is where a number you
  // might act on belongs.)
  RINGS.forEach((ring2, i) => {
    const q = 1 - i / Math.max(1, RINGS.length);
    perimeter(ring2.r1, ringCol(i), 0.16 + q * 0.18);
  });

  if (labels && RINGS.length) {
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(255,222,160,0.9)';
    ctx.font = '700 12px Audiowide, system-ui';
    ctx.fillText(CORE_NAME, cx2 - RINGS[0].r0 * 0.5 * z, cy2 - RINGS[0].r0 * 0.26 * z - 7);
  }
}

// The star systems, drawn LIVE and culled to the lens. They used to be baked into
// a second full-res layer that cost 61MB on its own; there are only ever a few
// dozen inside the lens, so drawing them costs less than storing them — and they
// come out sharp at any zoom instead of being a magnified bitmap.
function drawSystemsLive(wx, wy, z, ccx, ccy, R) {
  if (!SCENERY.length) return;
  // ride the caller's alpha instead of overwriting it — a contract disc mid
  // sync-zoom, and the lens mid fade-in, are both drawn under one
  const ga0 = ctx.globalAlpha;
  const pad = 60;
  for (const sy of SCENERY) {
    const sx = wx(sy), syy = wy(sy);
    // Cull by the system's OWN reach, not by its centre. Orbits run out to ~40
    // world px, which at 6x zoom is 240 screen px — a fixed 60px pad threw away
    // systems whose planets were plainly inside the lens. That is what made
    // things vanish as the camera moved.
    let reach = 0;
    for (const pl of sy.planets) reach = Math.max(reach, pl.o * 1.3);
    if (Math.hypot(sx - ccx, syy - ccy) > R + reach * z + 24) continue;
    const fade = clamp(1 - (sy.far - 900) / 2400, 0.30, 1);
    ctx.save();
    ctx.globalAlpha = ga0 * fade;
    // orbits first, hairline — they are what make a dot read as a SYSTEM
    ctx.strokeStyle = 'rgba(150,186,240,0.13)'; ctx.lineWidth = 0.6;
    for (const pl of sy.planets) {
      const o = pl.o * z;
      if (o < 2.5) continue;
      ctx.beginPath(); ctx.ellipse(sx, syy, o, o * 0.5, 0, 0, TAU); ctx.stroke();
    }
    // the planets on them — the SAME shaded sprites the destinations use, so a
    // world in a passing system is the same kind of object as the one you fly to
    for (const pl of sy.planets) {
      const px = sx + Math.cos(pl.a) * pl.o * z, py = syy + Math.sin(pl.a) * pl.o * 0.5 * z;
      const pr = pl.sz * z;
      if (pr < 0.45) continue;
      const chip = pr > 1.6 && planetChip(pl.V);
      if (chip) {
        const w = chip.S * (pr / chip.R);
        ctx.drawImage(chip.cv, px - w / 2, py - w / 2, w, w);
      } else {
        ctx.fillStyle = `rgba(${pl.V.z},0.85)`;
        ctx.beginPath(); ctx.arc(px, py, Math.max(0.5, pr), 0, TAU); ctx.fill();
      }
    }
    ctx.globalCompositeOperation = 'lighter';
    drawStarPoint(sx, syy, Math.max(0.55, sy.cls.r * z * 0.62), sy.cls.c, sy.cls.g, 1);
    ctx.globalCompositeOperation = 'source-over';
    // an installation off an outer orbit, on some systems
    if (sy.station && sy.planets.length) {
      const pl = sy.planets[sy.planets.length - 1];
      const o = pl.o * 1.15 * z;
      if (o > 4) {
        const ix = sx + Math.cos(pl.a + 0.9) * o, iy = syy + Math.sin(pl.a + 0.9) * o * 0.5;
        {
          // A decorative installation in a background system, not a relay — so
          // its build comes off the SYSTEM's own seed, and it is the same one
          // every time the chart is opened. No lamps: at three pixels a halo IS
          // the chip.
          const cr = Math.max(1.2, 1.9 * z);
          const st = S3D_BUILDS.filter(b => b.kind === 'station');
          const bid = st[Math.abs(Math.floor(sy.seed * 7)) % st.length].id;
          s3draw(ix, iy, cr, bid, 1, true);
        }
      }
    }
    ctx.restore();
  }
  ctx.globalAlpha = ga0;
}
// the chain belongs to the CURRENT case — each one works its own band of rings
function cityChain() {
  if (!CITY_CHAINS.length) buildCity();
  const ci = CAMP ? CAMPAIGNS.indexOf(CAMP) : 0;
  return CITY_CHAINS[Math.max(0, ci)] || CITY_CHAINS[0];
}
const citySegs = () => cityChain().segs;
function relayW(i) {
  const ch = cityChain();
  return ch.pts[clamp(i < 0 ? 0 : i, 0, ch.pts.length - 1)];
}
// how much cover a relay still has. The RING is the case's band — a run cannot
// be better covered than the one before it just because its junction happened
// to land a street closer in — so the number falls level by level, all the way
// out to the last case working with no cover at all.
function relayCover(i) {
  if (!RINGS.length) buildCity();
  const ci = clamp(CAMP ? CAMPAIGNS.indexOf(CAMP) : 0, 0, RINGS.length - 1);
  const band = RINGS[ci], n = Math.max(1, LEVELS.length - 1);
  return {
    ring: ci + 1,
    name: band.name,
    pct: shieldAt(lerp(band.r0, band.r1, clamp(i, 0, n) / n))
  };
}
// point at parameter t (0..1) along a polyline
function polyAt(pts2, t) {
  let tot = 0;
  for (let i = 1; i < pts2.length; i++) tot += Math.hypot(pts2[i].x - pts2[i - 1].x, pts2[i].y - pts2[i - 1].y);
  let d = t * tot;
  for (let i = 1; i < pts2.length; i++) {
    const seg = Math.hypot(pts2[i].x - pts2[i - 1].x, pts2[i].y - pts2[i - 1].y);
    if (d <= seg || i === pts2.length - 1) {
      const q = seg > 0 ? d / seg : 0;
      return { x: lerp(pts2[i - 1].x, pts2[i].x, q), y: lerp(pts2[i - 1].y, pts2[i].y, q) };
    }
    d -= seg;
  }
  return pts2[pts2.length - 1];
}
// The full lockup (src/logo.webp) and the badge-only mark (src/logo-small.webp).
// The drawn brand stays as the fallback: a missing file must degrade to type, not
// to nothing.
//
// Filenames are lowercase and hyphenated on purpose. They arrived as "Logo.png"
// and "Logo - Small.png", which resolves fine on macOS because its filesystem is
// case-insensitive — and 404s on Linux hosting and inside the Android package,
// where it would have shipped with no brand at all and no error anyone would see
// in development.
//
// WebP, and LOSSLESS: 728KB of PNG became 490KB with every pixel bit-identical
// (verified, not assumed). These two are also the masters `npm run icons` cuts
// the launcher set from, so a lossy encode would have quietly degraded the app
// icon too — which is why the saving stops at the format and doesn't touch the
// art.
let LOGOIMG = null, LOGOSM = null;
function brandLogoSmall() {
  if (typeof Image === 'undefined') return null;
  if (!LOGOSM) {
    LOGOSM = { img: new Image(), w: 0, h: 0 };
    LOGOSM.img.onload = () => { LOGOSM.w = LOGOSM.img.naturalWidth || 1; LOGOSM.h = LOGOSM.img.naturalHeight || 1; menuCache = null; };
    LOGOSM.img.onerror = () => {};
    LOGOSM.img.src = 'logo-small.webp';
  }
  return LOGOSM.w ? LOGOSM : null;
}
function brandLogo() {
  if (typeof Image === 'undefined') return null;
  if (!LOGOIMG) {
    LOGOIMG = { img: new Image(), w: 0, h: 0 };
    LOGOIMG.img.onload = () => { LOGOIMG.w = LOGOIMG.img.naturalWidth || 1; LOGOIMG.h = LOGOIMG.img.naturalHeight || 1; menuCache = null; };
    LOGOIMG.img.onerror = () => {}; // no badge on disk — the drawn brand stands
    LOGOIMG.img.src = 'logo.webp';
  }
  return LOGOIMG.w ? LOGOIMG : null;
}