'use strict';
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

// ---------- WHAT LIVES AT THE DESTINATION ----------
// >>> DEST-LIFE
// The lab lifts this whole region so it can stage a real arrival. It may reach
// only TAU, clamp, time, ctx, mulberry32, LIGHT_A, PLANET_SHADE, DEST_LIFE,
// destKindFor, drawRingBody, PLANET_TYPES, buildPlanetSprite, and the
// CAMP / levelIdx / LV the relay is chosen by.
//
// The arrival made the world big; this is what stops it being a poster of a
// world. Each relay is dealt a HAND from the deck below, off its own hash stream
// (so dealing never disturbs the world-type or destination-kind picks that share
// the seed), and the hand is permanent: a place you have been to has the same
// moon in the same orbit and the same cities in the same valleys next time.
//
// The deck is filtered by what the destination physically IS — a gate has no
// night side to light and no poles to hang aurora on, so it can only be dealt
// the things that live in ORBIT around it.
const DEST_DECK = ['lights', 'aurora', 'moon', 'traffic', 'station'];
// A MOON IS A WORLD TOO, and for a long time it was the last hand-painted body in
// the game: a dark disc with a highlight airbrushed onto it, hanging in a frame
// where the destination beside it is shaded per pixel. At arrival size that is the
// most obvious fake object on screen, because the eye has a real one to compare it
// against six inches away.
//
// So it is dealt a real skin and built by the same renderer as everything else.
// THREE skins, not eighteen: a moon is bare rock or ice, and a small fixed set is
// what lets every one of them be warmed ahead of a run instead of shaded during
// one — the same bargain the deep field's hand makes.
const MOON_TYPES = ['PAL', 'BAS', 'ICE'].map(id => PLANET_TYPES.find(p => p.id === id)).filter(Boolean);
// A moon reaches ~0.18 of the destination's radius, and the destination fills the
// bore on arrival — so this is the size it is actually stamped at, on the frame
// where anything soft would be caught.
const MOON_REF_R = 80;
const moonSprites = {};
function moonSprite(V) {
  if (!(V.n in moonSprites)) moonSprites[V.n] = buildPlanetSprite(MOON_REF_R, V);
  return moonSprites[V.n];
}
let destLifeKey = '', destLifeVal = null;
function destinationLife() {
  const campId = (typeof CAMP !== 'undefined' && CAMP && CAMP.id) || 'x';
  const isBoss = !!(LV && LV.boss);
  const kind = destKindFor(campId, levelIdx, isBoss);
  const key = campId + '#' + levelIdx + '#' + kind;
  if (destLifeKey === key && destLifeVal) return destLifeVal;
  const L = DEST_LIFE;
  let h = 0x9e3779b9;
  for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 16777619); }
  h ^= h >>> 16; h = Math.imul(h, 0x7feb352d); h ^= h >>> 15;
  const rnd = mulberry32(h >>> 0);
  const rr = (a, b) => a + rnd() * (b - a);
  // only a lit rock has cities and poles; a star's face is all day
  const surface = kind === 'planet';
  const deck = DEST_DECK.filter(f => surface || (f !== 'lights' && f !== 'aurora'));
  for (let i = deck.length - 1; i > 0; i--) { // seeded shuffle, then cut the top n
    const j = (rnd() * (i + 1)) | 0;
    const tmp = deck[i]; deck[i] = deck[j]; deck[j] = tmp;
  }
  const n = Math.min(deck.length, L.n0 + ((rnd() * (L.n1 - L.n0 + 1)) | 0));
  const has = {};
  for (let i = 0; i < n; i++) has[deck[i]] = true;
  // CITY LIGHTS come in clusters, because civilisation does: coasts and valleys,
  // not an even sprinkle. Unit-disc coordinates, so they scale with the approach.
  const lights = [];
  if (has.lights) {
    const clus = L.clus0 + ((rnd() * L.clusN) | 0);
    for (let c = 0; c < clus; c++) {
      const ca = rnd() * TAU, cr = Math.sqrt(rnd()) * 0.86;
      const cx0 = Math.cos(ca) * cr, cy0 = Math.sin(ca) * cr;
      const spread = rr(0.05, 0.15);
      const many = 3 + ((rnd() * L.perClus) | 0);
      for (let k = 0; k < many; k++) {
        const sa = rnd() * TAU, sr = Math.pow(rnd(), 0.55) * spread;
        lights.push({
          x: cx0 + Math.cos(sa) * sr, y: cy0 + Math.sin(sa) * sr,
          r: rr(0.0035, 0.0085), b: rr(0.35, 1), ph: rnd() * TAU, sp: rr(0.4, 2.4)
        });
      }
    }
  }
  // Departures FROM this world — the same wake the deep gets, at the scale of the
  // place they are leaving. Positions are in units of R around the body, so they
  // ride the approach without any rescaling.
  const ships = [];
  if (has.traffic) {
    const many = 2 + ((rnd() * (L.shipN - 1)) | 0);
    for (let i = 0; i < many; i++) {
      const a = rnd() * TAU, d = rr(0.45, 1.5);
      ships.push({
        x: Math.cos(a) * d, y: Math.sin(a) * d * 0.9,
        dir: a + rr(-0.7, 0.7),                     // outbound-ish: away from the world
        len: rr(0.35, 0.9), per: rr(L.shipPer[0], L.shipPer[1]), ph: rnd(),
        back: rnd() < 0.35                          // some jump from BEHIND the body
      });
    }
  }
  destLifeKey = key;
  destLifeVal = {
    kind, surface, has, lights, ships,
    aurora: { col: rnd() < 0.62 ? L.auroraC : L.auroraC2, k: rr(0.7, 1.25), ph: rnd() * TAU },
    moon: has.moon ? {
      orb: rr(L.moonO[0], L.moonO[1]), sq: rr(0.16, 0.46), tilt: rr(-0.8, 0.8),
      // ONE draw off the stream, exactly as the warm/cold tint it replaced took —
      // so every other value this relay was ever dealt comes out unchanged and a
      // place you have been to still has its own moon in its own orbit.
      ph: rnd() * TAU, sz: L.moonR * rr(0.62, 1.18), V: MOON_TYPES[(rnd() * MOON_TYPES.length) | 0]
    } : null,
    stn: has.station ? {
      orb: rr(L.stnO[0], L.stnO[1]), sq: rr(0.12, 0.4), tilt: rr(-0.8, 0.8),
      ph: rnd() * TAU, seed: rnd() * 20
    } : null
  };
  return destLifeVal;
}
// Where a body in a tilted orbit SITS. Note the phase is fixed, not clocked: you
// are looking at a system for half a minute, and in half a minute nothing that
// large visibly moves. A moon sliding round its primary while you read a score is
// a time-lapse, and a time-lapse says "animation" where stillness says "place".
// The orbit geometry stays because it still decides where the body sits and
// whether the world is in front of it.
function orbitAt(o, far, R) {
  const ox = Math.cos(o.ph) * R * o.orb, oy = Math.sin(o.ph) * R * o.orb * o.sq;
  const ct = Math.cos(o.tilt), st = Math.sin(o.tilt);
  return { x: far.x + ox * ct - oy * st, y: far.y + ox * st + oy * ct, front: Math.sin(o.ph) > 0 };
}
// THE CREEPING TERMINATOR. The sprite bakes its shading at a fixed light angle,
// so rebuilding it to move the sun is out of the question at these sizes. Instead
// the night side gets a soft shadow whose edge drifts a few degrees on two
// incommensurate periods — the boundary moves, which is the entire read, and the
// baked terminator underneath it never has to.
//
// The angle is its own function because EVERYTHING here shares it: the cities
// hide from this sun, the moon catches it. One vector, one place.
const destLightA = () => LIGHT_A + Math.sin(time * DEST_LIFE.creepRate) * DEST_LIFE.creep
  + Math.sin(time * DEST_LIFE.creepRate * 0.41 + 1.7) * DEST_LIFE.creep * 0.35;
function drawTerminatorCreep(far, R, vis, la) {
  const L = DEST_LIFE;
  if (vis <= 0.02) return;
  const nx = -Math.cos(la), ny = -Math.sin(la); // toward the night limb
  ctx.save();
  ctx.beginPath(); ctx.arc(far.x, far.y, R * 0.995, 0, TAU); ctx.clip();
  const gd = ctx.createLinearGradient(far.x - nx * R, far.y - ny * R, far.x + nx * R, far.y + ny * R);
  gd.addColorStop(0, 'rgba(2,4,10,0)');
  gd.addColorStop(0.52, 'rgba(2,4,10,0)');
  gd.addColorStop(0.8, `rgba(2,4,10,${(L.nightK * 0.5 * vis).toFixed(3)})`);
  gd.addColorStop(1, `rgba(2,4,10,${(L.nightK * vis).toFixed(3)})`);
  ctx.fillStyle = gd;
  ctx.fillRect(far.x - R, far.y - R, R * 2, R * 2);
  ctx.restore();
}
// the unit light vector for a given drift, matching the sprite's own model
function lightVec(la) {
  let lx = Math.cos(la), ly = Math.sin(la), lz = PLANET_SHADE.lz;
  const n = Math.hypot(lx, ly, lz);
  return [lx / n, ly / n, lz / n];
}
// CITY LIGHTS. Only on the night side, only where the surface still faces us
// (nz), and brightest deep in the dark — a light near the terminator is washed
// out by the dusk it sits in. This is the cheapest "inhabited" cue there is.
function drawCityLights(far, R, la, F, vis) {
  const L = DEST_LIFE;
  const [lx, ly, lz] = lightVec(la);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const c of F.lights) {
    const d2 = c.x * c.x + c.y * c.y;
    if (d2 >= 0.97) continue;
    const nz = Math.sqrt(1 - d2);
    const ndl = c.x * lx + c.y * ly + nz * lz;
    if (ndl > 0.03) continue;                        // day side: nothing reads
    const night = clamp(-ndl / 0.3, 0, 1);
    const tw = 0.55 + 0.45 * Math.sin(time * c.sp + c.ph);
    const al = L.lightsO * night * nz * tw * c.b * vis;
    if (al < 0.012) continue;
    ctx.fillStyle = `rgba(${L.lightsC},${al.toFixed(3)})`;
    ctx.beginPath(); ctx.arc(far.x + c.x * R, far.y + c.y * R, Math.max(0.55, c.r * R), 0, TAU); ctx.fill();
  }
  ctx.restore();
}
// AURORA. Hung on the projected pole of the SAME tilted axis the sprite bands
// follow, so it sits where the world's geometry says the pole is. Foreshortened
// along the radius out to the limb, clipped to the disc, and breathing on
// incommensurate periods so it never reads as a pulsing light.
function drawAurora(far, R, F, vis) {
  const L = DEST_LIFE;
  let [ax, ay, az] = PLANET_SHADE.tilt;
  const an = Math.hypot(ax, ay, az); ax /= an; ay /= an; az /= an;
  ctx.save();
  ctx.beginPath(); ctx.arc(far.x, far.y, R * 0.995, 0, TAU); ctx.clip();
  ctx.globalCompositeOperation = 'lighter';
  for (const s of [1, -1]) {
    const facing = az * s;
    if (facing < -0.05) continue;                    // that pole is round the back
    const px = far.x + ax * R * s, py = far.y + ay * R * s;
    const swell = 0.62 + 0.2 * Math.sin(time * 0.37 + F.aurora.ph)
      + 0.12 * Math.sin(time * 0.83 + F.aurora.ph * 2)
      + 0.06 * Math.sin(time * 1.51);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(Math.atan2(py - far.y, px - far.x));  // x now points out to the limb
    ctx.scale(0.34 + 0.55 * Math.abs(facing), 1);    // foreshortened toward the edge
    for (let b = 0; b < L.auroraW; b++) {
      const rad = R * (0.085 + b * 0.05) * (1 + 0.07 * Math.sin(time * (0.6 + b * 0.29) + b * 2));
      const al = L.auroraO * F.aurora.k * swell * vis * (1 - b * 0.24) * (s > 0 ? 1 : 0.45);
      if (al < 0.012) continue;
      ctx.strokeStyle = `rgba(${F.aurora.col},${al.toFixed(3)})`;
      ctx.lineWidth = R * 0.03 * (1 + b * 0.3);
      ctx.beginPath(); ctx.arc(0, 0, rad, 0, TAU); ctx.stroke();
    }
    ctx.restore();
  }
  ctx.restore();
}
// A MOON. Same key light as its primary, so it hangs in the same sun — and it
// is the one feature that gives the frame a clock: you can watch it move.
function drawMoon(far, R, la, F, vis) {
  const p = orbitAt(F.moon, far, R);
  const mr = Math.max(1.5, R * F.moon.sz);
  const sp = F.moon.V && moonSprite(F.moon.V);
  ctx.save();
  ctx.globalAlpha = vis;
  if (sp) {
    const w = sp.S * (mr / sp.R);                    // the canvas carries its air pad — scale it whole
    ctx.drawImage(sp.cv, p.x - w / 2, p.y - w / 2, w, w);
  } else {
    // no-ImageData fallback: the painted body this replaced, kept for the headless
    // harness. A dark disc that occludes what it passes over, and one gradient
    // offset toward the sun so it is at least a sphere rather than a coin.
    const [lx, ly] = lightVec(la);
    ctx.beginPath(); ctx.arc(p.x, p.y, mr, 0, TAU);
    ctx.fillStyle = 'rgba(6,9,18,0.96)';
    ctx.fill();
    const lg = ctx.createRadialGradient(p.x + lx * mr * 0.7, p.y + ly * mr * 0.7, 0, p.x, p.y, mr * 1.5);
    lg.addColorStop(0, `rgba(${DEST_LIFE.moonC},0.95)`);
    lg.addColorStop(0.45, 'rgba(112,116,120,0.3)');
    lg.addColorStop(1, 'rgba(20,28,44,0)');
    ctx.fillStyle = lg;
    ctx.fill();
  }
  ctx.restore();
}
// TRAFFIC: ships leaving. A world with departures off it is a world with
// somewhere to go — and a wake beside the disc is the scale cue that turns a big
// circle into a big PLACE.
function drawShips(far, R, F, vis, back) {
  for (const s of F.ships) {
    if (!!s.back !== back) continue;
    const p = ((time / s.per + s.ph) % 1 + 1) % 1;
    const k = p * s.per / WAKE_TOT;
    if (k >= 1) continue;
    drawWarpWake(far.x + s.x * R, far.y + s.y * R, s.dir, s.len * R, k, DEST_LIFE.shipO * vis);
  }
}
// A STATION in low orbit — drawn by the SAME art the chart and the station
// destinations use, just small and on an orbit. It says the place is worked.
function drawOrbitStation(far, R, F, vis) {
  const p = orbitAt(F.stn, far, R);
  ctx.save();
  ctx.globalAlpha = vis * 0.92;
  drawRingBody(p.x, p.y, Math.max(3, R * DEST_LIFE.stnR), 'station');
  ctx.restore();
}
// The two passes. Everything on a far-half orbit goes down BEFORE the body so the
// body occludes it; everything else goes over the top. `vis` ramps the whole
// layer in with the approach — at a speck's size this detail is only noise.
function drawDestLife(far, R, g, front, la) {
  const L = DEST_LIFE;
  const vis = clamp((R / g.nodeR - L.vis0) / L.vis1, 0, 1);
  if (vis <= 0.01) return;
  const F = destinationLife();
  if (!front) {
    if (F.moon && !orbitAt(F.moon, far, R).front) drawMoon(far, R, la, F, vis);
    if (F.stn && !orbitAt(F.stn, far, R).front) drawOrbitStation(far, R, F, vis);
    if (F.ships.length) drawShips(far, R, F, vis, true);
    return;
  }
  if (F.has.lights && F.lights.length) drawCityLights(far, R, la, F, vis);
  if (F.has.aurora) drawAurora(far, R, F, vis);
  if (F.ships.length) drawShips(far, R, F, vis, false);
  if (F.moon && orbitAt(F.moon, far, R).front) drawMoon(far, R, la, F, vis);
  if (F.stn && orbitAt(F.stn, far, R).front) drawOrbitStation(far, R, F, vis);
}
// <<< DEST-LIFE

// ---------- AMBIENT TRAFFIC: other people are out here ----------
//
// The destination's own traffic only exists once you have arrived somewhere. This
// is the other half: ships crossing the deep on courses that have nothing to do
// with yours, visible from every screen in the game.
//
// It runs off the shared clock and NOT off laneFlow, which is the entire point.
// Your lane is parked while you sit on a menu; the galaxy is not. A home screen
// where a freighter is quietly making its way across the frame is a place you are
// waiting IN, rather than a screen you are looking AT.
//
// Stateless per frame — each ship is a fixed course read against `time` — so it
// costs nothing to have them running in every state, and they never need
// resetting, recycling or pausing.
// THE WAKE ITSELF, in four beats. Specks sliding across the frame read as dots
// moving, because that is all they are; a departure has a SHAPE, and this is it:
//
//   1. a small blue point fades up out of nothing — a drive spooling
//   2. it charges to white, and blooms
//   3. it SNAPS away as a line running off into the distance
//   4. the line burns out from the near end to the far one
//
// Beat 4 is the whole effect. The line does not dim as a unit — it is CONSUMED
// from the tail forward, so what you watch is the trail closing behind something
// that has already gone. Everything is a function of one 0→1 progress value, so a
// wake carries no state and can be driven from any clock.
// >>> DEST-WAKE
// Lifted by the destinations lab too — a relay's traffic IS this wake, so the lab
// cannot stage an arrival without it. Reaches only TAU, clamp and ctx.
const WAKE_T = { in: 0.95, charge: 0.5, shoot: 0.14, burn: 0.8 };
const WAKE_TOT = WAKE_T.in + WAKE_T.charge + WAKE_T.shoot + WAKE_T.burn;
function drawWarpWake(x, y, dir, len, k, alpha) {
  if (k <= 0 || k >= 1 || alpha <= 0.01) return;
  const T = WAKE_T;
  const t = k * WAKE_TOT;
  const ca = Math.cos(dir), sa = Math.sin(dir);
  const pt = (d) => [x + ca * d, y + sa * d];
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  if (t < T.in + T.charge) {
    // beats 1+2: the point, cold and faint, warming to a white-hot pinprick
    const spool = clamp(t / T.in, 0, 1);
    const chg = clamp((t - T.in) / T.charge, 0, 1);
    const a = alpha * (0.35 + 0.65 * spool) * (0.55 + 0.45 * chg);
    const r = 1.1 + spool * 0.7 + chg * 2.2;
    const col = chg > 0 ? `${Math.round(120 + 135 * chg)},${Math.round(190 + 65 * chg)},255` : '120,190,255';
    const gl = ctx.createRadialGradient(x, y, 0, x, y, r * 5);
    gl.addColorStop(0, `rgba(${col},${(a * 0.6).toFixed(3)})`);
    gl.addColorStop(0.4, `rgba(${col},${(a * 0.16).toFixed(3)})`);
    gl.addColorStop(1, `rgba(${col},0)`);
    ctx.fillStyle = gl;
    ctx.beginPath(); ctx.arc(x, y, r * 5, 0, TAU); ctx.fill();
    ctx.fillStyle = `rgba(255,255,255,${(a * (0.35 + 0.65 * chg)).toFixed(3)})`;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    ctx.restore();
    return;
  }
  // beats 3+4: the line. The head races out, then the tail chases it down.
  const shot = clamp((t - T.in - T.charge) / T.shoot, 0, 1);
  const burn = clamp((t - T.in - T.charge - T.shoot) / T.burn, 0, 1);
  const head = len * (1 - Math.pow(1 - shot, 2.2));   // snaps out, decelerating
  const tail = len * Math.pow(burn, 1.5);             // then eats its way forward
  if (tail >= head - 0.5) { ctx.restore(); return; }
  const [x0, y0] = pt(tail), [x1, y1] = pt(head);
  const a = alpha * (1 - burn * 0.55);
  // a gradient along the segment: hot where it is being consumed, thinning into
  // the distance, so the line has a direction and a depth rather than a length
  const gr = ctx.createLinearGradient(x0, y0, x1, y1);
  gr.addColorStop(0, `rgba(150,215,255,${(a * 0.1).toFixed(3)})`);
  gr.addColorStop(0.18, `rgba(210,238,255,${(a * 0.75).toFixed(3)})`);
  gr.addColorStop(0.75, `rgba(255,255,255,${(a * 0.42).toFixed(3)})`);
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  for (const [w, m] of [[3.4, 0.3], [1.5, 0.7], [0.7, 1]]) { // soft shaft, then the core
    ctx.strokeStyle = gr;
    ctx.globalAlpha = m;
    ctx.lineWidth = w * (1 - burn * 0.4);
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  if (shot < 1) { // the head is still a body while it is leaving
    const hg = ctx.createRadialGradient(x1, y1, 0, x1, y1, 7);
    hg.addColorStop(0, `rgba(255,255,255,${(a * 0.9).toFixed(3)})`);
    hg.addColorStop(1, 'rgba(190,225,255,0)');
    ctx.fillStyle = hg;
    ctx.beginPath(); ctx.arc(x1, y1, 7, 0, TAU); ctx.fill();
  }
  ctx.restore();
}
// <<< DEST-WAKE
// Ambient departures: somebody, somewhere off in the deep, jumping out.
//
// STATUS SCREENS ONLY, and RARE. Two reasons it has no business in a live run: a
// bright line snapping across the frame is exactly the shape of a threat cue, and
// the lane already has all the motion it can carry. Off-run it is the opposite —
// the thing that says the galaxy did not stop while you were reading a score.
// One jump every ~20 seconds somewhere on the frame. A departure is an EVENT; at
// any tighter cadence it stops being one.
const AMB_SHIPS = [];
function initAmbTraffic() {
  AMB_SHIPS.length = 0;
  const n = lowFX ? 3 : 6;
  for (let i = 0; i < n; i++) AMB_SHIPS.push({
    x: rand(0.08, 0.92), y: rand(0.08, 0.92),      // fraction of the frame
    dir: Math.random() * TAU,
    len: rand(0.18, 0.5),                          // fraction of the min side
    per: rand(95, 190), ph: Math.random(),
    al: rand(0.5, 0.95)
  });
}
initAmbTraffic();
function drawAmbTraffic(g) {
  if (!AMB_SHIPS.length) return;
  if (state !== S.MENU && state !== S.END && state !== S.GUIDE) return;
  const M = Math.min(W, H);
  for (const s of AMB_SHIPS) {
    const p = ((time / s.per + s.ph) % 1 + 1) % 1;
    const k2 = p * s.per / WAKE_TOT;               // the event occupies the head of the cycle
    if (k2 >= 1) continue;                         // ...and the rest is empty sky
    drawWarpWake(s.x * W, s.y * H, s.dir, s.len * M, k2, s.al);
  }
}


// The projection floor. ring() scales by 1/(1 + z*6), which divides by zero at
// z = -1/6 and returns a NEGATIVE radius past it, flipping whatever it projects to
// the opposite side of the bore. Nothing may be projected beyond this.
const Z_FLOOR = -0.160;
// The exit must never be SUB-FRAME. z can move 0.089 in a single frame during the
// warp dive, while the entire radius blow-up happens inside the last ~0.14 of z —
// so at full dive speed a streak crossed its whole exit between two frames and
// simply stopped existing. Once a streak is past EXIT_Z its step is capped, so
// leaving the frame always takes ~11 frames no matter how fast the sim is running.
// Normal play steps ~0.0095, well under the cap, so nothing there changes at all.
const EXIT_Z = -0.02, EXIT_CAP = 0.012;

// the live warp-line stack: same light-blue-to-white ramp as the baked texture's
// WARP_PASSES, so the moving lines and the wall they ride on are the same
// material. Widest pass is ~2.6px at full calibre — deliberately under the
// threshold where a stroke starts reading as a surface instead of a line.
// A real starfield is not one colour. Blue-white dominates, but yellow-whites,
// oranges and the odd red giant or violet are what stop it reading as a technical
// diagram of a starfield. The CORE always burns white regardless — that is what
// makes them read as light rather than as coloured lines — and only the halo
// carries the star's actual temperature.
const STAR_TINTS = [
  ['110,180,255', '175,215,255'],  // blue-white
  ['110,180,255', '175,215,255'],  // (weighted: most stars are this)
  ['92,206,235', '170,232,250'],   // cyan — heavy in the reference
  ['92,206,235', '170,232,250'],
  ['150,120,255', '198,178,255'],  // violet — the other half of the reference
  ['176,110,240', '214,172,250'],  // purple
  ['255,224,168', '255,240,212'],  // yellow-white
  ['255,188,126', '255,220,178'],  // orange
  ['255,148,116', '255,198,172']   // red giant
];
// width + alpha only; colour comes from the star's own tint pair, core white
// SIX passes, not four, and a much gentler alpha ramp. The reference streaks are
// translucent RIBBONS of light with heavy bloom, not opaque lines — you can see
// straight through them to the stars behind. A smooth falloff across many narrow
// passes gives a soft edge profile; the capsule problem only ever came from ONE
// wide pass carrying real alpha, which is why the widest here is nearly invisible
// on its own and only reads as the outermost breath of the glow.
// EIGHT passes now. The two new entries at the top are very wide and almost
// transparent — they are what a broad shaft of light actually is: not a fat line,
// but a wide soft falloff whose centre happens to be bright. Only the widest class
// pays for them.
//
// A wide stroke is only a capsule when it carries real alpha. At 0.010 a 100px
// stroke is a breath; what makes it read is dozens of them overlapping additively.
const LIVE_WARP_PASSES = [
  [13.0, 0, 0.010],  // outermost — shafts only, essentially invisible alone
  [9.0,  0, 0.018],
  [6.2,  0, 0.030],
  [4.0,  0, 0.055],
  [2.6,  0, 0.105],
  [1.7,  1, 0.200],
  [1.0,  1, 0.400],
  [0.5,  2, 0.780]   // core — white hot, still not fully opaque
];

// THE CONVOY: the gold river running along the floor of the lane, behind and
// below you — the thing you are out here for. It was already this. In the fiber
// theme it was called the payload river, and its `ord` draw-order thins the
// river as integrity drops, so ships visibly stop arriving as the escort fails.
// That mechanic needed no work; it needed a name.
//
// THE SHAPE OF THE CHANNEL, on dials. A wider, soft-banked river was tried here
// and did not read as an improvement in the lane, so these defaults ARE the
// original narrow strip — but they are numbers now instead of literals buried in
// two files, and the tuning board drives all three live (Warp lane & streaks).
//
//   spread · half-width of the channel, radians either side of straight down
//   bias   · 0 spreads ships evenly across it; 1 crowds them into mid-channel and
//            thins them toward the banks, which is the shape of a current
//   bank   · how hard the edges fade out: alpha × (1 − bank · off²). At 0 the
//            river has two hard ends, which is what it has always had
const RIVER = { spread: 0.55, bias: 0, bank: 0 };
// Where in the channel a ship runs, as a unit offset from mid-channel. TWO draws
// whatever the bias is set to, so moving the dial never shifts the random stream
// under a seeded run.
const riverOff = () => (rand(-1, 1) + rand(-1, 1) * RIVER.bias) / (1 + RIVER.bias);
let streaks = [];
function initStreaks() {
  streaks = [];
  // FEWER warp lines and much heavier ones — the reference reads as a handful of
  // confident streaks with space between them, not a dense hatch. Cutting the
  // count is what lets the space behind them show.
  const nGold = lowFX ? 90 : 190, nAmbient = lowFX ? 120 : 300;
  for (let i = 0; i < nGold; i++) {
    streaks.push({
      z: Math.random(),
      // a place in the river, not an angle: drawStreaks turns it into one every
      // frame, so RIVER.spread moves the whole convoy while you drag it
      off: riverOff(),
      gold: true, sp: rand(0.92, 1.12), ord: i / nGold // draw order — the river thins with integrity
    });
  }
  // WARP STARS in three classes, because one gauge of line reads as a hatch no
  // matter how many you draw. FINE lines are thin and crisp, NORMAL is the body of
  // the field, and BURSTS are the thick soft translucent shafts from the reference
  // — wide enough to be light rather than line, and transparent enough that other
  // streaks and the stars behind read straight through them.
  //
  // Class also picks how many glow passes a star pays for (p0 is where it enters
  // the pass table), so the fine ones cost three strokes and only the bursts pay
  // for all six. That is what keeps ~300 live streaks affordable.
  //
  // rmul is the important one for realism — each star's own distance from the
  // axis. Pinning them all to one radius is what used to put every star at a given
  // depth on the same circle, and space has no circles of stars in it.
  for (let i = 0; i < nAmbient; i++) {
    const r = Math.random();
    // 0 fine · 1 normal · 2 burst · 3 SHAFT (broad soft columns of light)
    const cls = r < 0.075 ? 3 : r < 0.20 ? 2 : r < 0.56 ? 1 : 0;
    streaks.push({
      z: Math.random(), a: Math.random() * TAU, gold: false,
      tint: STAR_TINTS[Math.random() * STAR_TINTS.length | 0],
      sp: rand(0.82, 1.14),
      rmul: rand(0.40, 1.55),
      // p0 is where a star enters the pass table, so only shafts pay for the two
      // widest passes and fine lines cost three strokes instead of eight
      p0:   cls === 3 ? 0 : cls === 2 ? 2 : cls === 1 ? 4 : 5,
      lenK: cls === 3 ? rand(2.2, 3.8) : cls === 2 ? rand(1.7, 3.1) : cls === 1 ? rand(0.9, 1.8) : rand(0.45, 1.0),
      cal:  cls === 3 ? rand(4.5, 9.0) : cls === 2 ? rand(2.2, 4.2) : cls === 1 ? rand(0.9, 1.7) : rand(0.45, 0.9),
      br:   cls === 3 ? rand(0.30, 0.55) : cls === 2 ? rand(0.42, 0.72) : cls === 1 ? rand(0.7, 1.15) : rand(0.85, 1.35)
    });
  }
}
initStreaks();
