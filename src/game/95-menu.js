'use strict';
// ---- briefing disc art: one keyframe per mission (docs/DISC-ART-SPEC.md) ----
// Lazy-decoded on first draw, so boot never waits on 40 images. A level with no
// art — or one whose image hasn't decoded yet — gets the tint plate instead, so
// art can land one disc at a time without anything popping in half-drawn.
const DISCIMG = {}; // decoded per source
function discArtImg(L) {
  const src = L && L.art;
  if (!src || typeof Image === 'undefined') return null;
  const url = /^data:image\//.test(src) ? src : 'art/disc/' + src;
  let e2 = DISCIMG[url];
  if (!e2) {
    e2 = DISCIMG[url] = { img: new Image(), w: 0, h: 0, err: false };
    e2.img.onload = () => { e2.w = e2.img.naturalWidth || 1; e2.h = e2.img.naturalHeight || 1; };
    e2.img.onerror = () => { e2.err = true; }; // not on disk — the tint plate stands,
    e2.img.src = url;                          // and the Designer reports the miss
  }
  return e2.w ? e2 : null;
}
// ---- image maps: a package may bring its OWN world (map.image + mapPos pins) ----
const MAPIMG = {}; // decoded per campaign id
function campMapImg(pk) {
  if (!pk || !pk.map || !pk.map.image || typeof Image === 'undefined') return null;
  let e2 = MAPIMG[pk.id];
  if (!e2) {
    e2 = MAPIMG[pk.id] = { img: new Image(), w: 0, h: 0 };
    e2.img.onload = () => { e2.w = e2.img.naturalWidth || 1; e2.h = e2.img.naturalHeight || 1; menuCache = null; };
    e2.img.src = pk.map.image;
  }
  return e2.w ? e2 : null; // null until decoded — callers fall back to the city
}
function imgPin(i) { // a level's pin in image-world pixels (graceful when unset)
  const im = MAPIMG[CAMP.id];
  const n = LEVELS.length, li = Math.min(i, n - 1);
  const l = LEVELS[li];
  const p2 = l && l.mapPos ? l.mapPos : { x: 0.15 + 0.7 * (li / Math.max(1, n - 1)), y: 0.5 };
  return { x: p2.x * im.w, y: p2.y * im.h };
}
function imgSegs() { // runs lead away from each relay toward the next pin
  const segs = [];
  for (let k = 0; k < LEVELS.length; k++) {
    const a = imgPin(k);
    segs.push(k < LEVELS.length - 1 ? [a, imgPin(k + 1)] : [a, { x: a.x + 1, y: a.y + 1 }]);
  }
  return segs;
}
function mapHex(x, y, r) {
  ctx.beginPath();
  for (let k = 0; k < 6; k++) {
    const a = k / 6 * TAU - Math.PI / 2;
    k ? ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r) : ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  ctx.closePath();
}
function drawMenuMap() {
  const { ccx, ccy } = menuGeom();
  const R = mapR();
  const IM = campMapImg(CAMP); // image-mode: the package brought its own world
  if (!IM && !cityBase) buildCity();
  const WW = IM ? IM.w : CITY_W, WH = IM ? IM.h : CITY_H;
  const SEGS = IM ? imgSegs() : citySegs();
  const RPT = i => IM ? imgPin(i) : relayW(i);
  const frontier = Math.min(PROG.unlocked - 1, LEVELS.length - 1);
  // camera: frame the ENTIRE selected run — center on its bounding box and
  // zoom out until it fits inside the lens
  // THE APPROACH. The camera no longer frames the whole run — it closes on the
  // DESTINATION, because that is the thing being chosen and it is now the size of
  // any other world on the chart rather than a marker standing in for one.
  //
  // Zoom is set so the destination's own system fills a good part of the lens,
  // which is what makes a planet on an orbit legible at all.
  const seg = SEGS[mapSel];
  const dsel = IM ? null : relayDest(mapSel);
  // RIDE THE LANE. Framing the whole run would push the zoom back out until the
  // destinations were specks again — the exact problem we just fixed — so instead
  // the camera flies the lane at close range, end to end and back, dwelling a
  // moment at each destination. You see where the convoy forms up, the corridor
  // it takes, and where it delivers, without giving up the scale that makes a
  // planet on an orbit legible.
  if (mapRideSel !== mapSel) { mapRideSel = mapSel; mapRideT = 0; }
  mapRideT += (frameDt || 0.016) * 0.17;            // ~6s each way
  const ping = mapRideT % 2, raw = ping < 1 ? ping : 2 - ping;
  const held = clamp((raw - 0.14) / 0.72, 0, 1);    // dwell at both ends
  const ride = held * held * (3 - 2 * held);        // ease in and out of the run
  mapRideK = ride;                                 // the relay list reads this to scroll its name
  const focus = IM ? seg[seg.length - 1] : polyAt(seg, ride);
  // zoom so the destination's own system fills a good part of the lens
  let sysR = 40;
  if (dsel) for (const pl of dsel.sys.planets) sysR = Math.max(sysR, pl.o * 1.35);
  const zt = clamp((R - 40) / sysR, 0.34, 6);
  const tx2 = clamp(focus.x, 0, WW);
  const ty2 = clamp(focus.y, 0, WH);
  if (mapCamSnap) { mapCamX = tx2; mapCamY = ty2; mapZoom = zt; mapCamSnap = false; }
  // Time-based easing, ~1000ms to settle, so the approach reads the same on any
  // refresh rate. The old per-frame 0.08 lerp was both faster and frame-rate
  // dependent — it arrived in about a third of a second on a 60Hz screen and
  // twice as fast on a 120Hz one.
  {
    // ~1000ms to settle on a NEW selection; once riding, the target moves with
    // the camera so this reads as a smooth tracking shot rather than a lag
    const k = 1 - Math.pow(0.02, Math.min(0.05, frameDt || 0.016) / 1.0);
    mapCamX += (tx2 - mapCamX) * k;
    mapCamY += (ty2 - mapCamY) * k;
    mapZoom += (zt - mapZoom) * k;
  }
  const wx = p2 => ccx + (p2.x - mapCamX) * mapZoom; // world -> screen (zoomed)
  const wy = p2 => ccy + (p2.y - mapCamY) * mapZoom;

  // ---- inside the lens ----
  // the map CIRCLES into view while the wheel circles out (and reverses):
  // forward arrives rotating clockwise; back departs counterclockwise
  let mapRot = 0, mapAl = 1, discRimAl = 0;
  if (menuFx && menuFx.kind === 'panelsIn') {
    const q = clamp(menuFx.t / 0.42, 0, 1);
    mapRot = -(menuFx.dir || 1) * 0.9 * Math.pow(1 - q, 2);
    mapAl = q;
    if (menuFx.fromDisc) { mapRot = 0; discRimAl = 1 - q; } // disc-born: pure crossfade, no spin
  } else if (menuFx && menuFx.kind === 'panelsOut') {
    const q = clamp(menuFx.t / menuFx.dur, 0, 1);
    mapAl = 1 - q;
    // heading back to the carousel: pure zoom-out crossfade (no spin) so it
    // mirrors the disc-born zoom-in; only the home-bound exit still spins
    if (CAMPAIGNS.length > 1) { mapRot = 0; discRimAl = q; } // disc rim rises to meet the shrink-out
    else mapRot = (menuFx.dir || -1) * 0.9 * q * q;
  }
  ctx.save();
  ctx.beginPath(); ctx.arc(ccx, ccy, R - 5, 0, TAU); ctx.clip();
  if (mapRot !== 0 || mapAl < 1) {
    ctx.translate(ccx, ccy); ctx.rotate(mapRot); ctx.translate(-ccx, -ccy);
    ctx.globalAlpha = mapAl;
  }
  // LAYER 1: the world sheet — a package image, or the procedural city
  {
    const bx0 = ccx - mapCamX * mapZoom, by0 = ccy - mapCamY * mapZoom;
    const bw0 = WW * mapZoom, bh0 = WH * mapZoom;
    if (IM) {
      ctx.fillStyle = '#04070f';
      ctx.fillRect(ccx - R, ccy - R, R * 2, R * 2);
      ctx.drawImage(IM.img, bx0, by0, bw0, bh0);
      // readability veil — the route and relays stay the loudest layer
      ctx.fillStyle = 'rgba(4,10,22,0.28)';
      ctx.fillRect(ccx - R, ccy - R, R * 2, R * 2);
    } else {
      ctx.fillStyle = '#02060f'; // the sheet is bigger than the lens can ever reach
      ctx.fillRect(ccx - R, ccy - R, R * 2, R * 2);
      ctx.drawImage(cityBase, bx0, by0, bw0, bh0);
    }
  }
  // LAYER 2: each level's cable run, leading AWAY from its relay —
  // secured lines flow green with live data, unsecured wait as dashed blue.
  // The runs are BURIED: they draw under the towers and ghost up through them.
  // The one you are looking at is then repeated over the skyline (LAYER 4), so
  // a dense downtown can never swallow the line you are about to defend.
  ctx.lineCap = 'round';
  // the chevron train, shared by secured and available lanes: same motion, the
  // colour is the only thing that says which. Traffic is traffic.
  const chevrons = (pts2, col, ar) => {
    let Ltot = 0;
    for (let i = 1; i < pts2.length; i++) Ltot += Math.hypot(pts2[i].x - pts2[i - 1].x, pts2[i].y - pts2[i - 1].y);
    if (Ltot < 1) return;
    ctx.strokeStyle = col;
    ctx.lineWidth = 1.5;
    const step = 38, ph2 = (time * 30) % step;
    for (let d = ph2 + 6; d < Ltot - 4; d += step) {
      const p0 = polyAt(pts2, d / Ltot), p1 = polyAt(pts2, Math.min(1, (d + 4) / Ltot));
      const ang = Math.atan2(wy(p1) - wy(p0), wx(p1) - wx(p0)); // screen-space heading
      const cxs = wx(p0), cys = wy(p0);
      ctx.beginPath();
      ctx.moveTo(cxs - Math.cos(ang - 0.55) * ar, cys - Math.sin(ang - 0.55) * ar);
      ctx.lineTo(cxs, cys);
      ctx.lineTo(cxs - Math.cos(ang + 0.55) * ar, cys - Math.sin(ang + 0.55) * ar);
      ctx.stroke();
    }
  };
  const drawRun = k => {
    const pts2 = SEGS[k];
    const done = PROG.stars[k] > 0;
    const lockedRun = k + 1 > PROG.unlocked;
    const trace = () => {
      ctx.beginPath();
      pts2.forEach((p2, pi) => pi ? ctx.lineTo(wx(p2), wy(p2)) : ctx.moveTo(wx(p2), wy(p2)));
      ctx.stroke();
    };
    const sel = k === mapSel;
    if (sel) { // the selected run glows under everything above it
      ctx.strokeStyle = done ? 'rgba(150,255,140,0.26)' : 'rgba(140,210,255,0.26)';
      ctx.lineWidth = 10; ctx.setLineDash([]);
      trace();
    }
    if (done) {
      if (!sel) { // secured but not in focus: a quiet green ghost
        ctx.strokeStyle = 'rgba(126,226,98,0.3)'; ctx.lineWidth = 2; ctx.setLineDash([]);
        trace();
      } else { // selected: solid green, chevrons marching toward the next relay
        ctx.strokeStyle = 'rgba(126,226,98,0.85)'; ctx.lineWidth = 3; ctx.setLineDash([]);
        trace();
        chevrons(pts2, 'rgba(215,255,185,0.9)', 4.5);
      }
    } else if (!sel) {
      // LOCKED reads as unreachable: a deeper blue, barely there. AVAILABLE reads
      // as merely not-selected — same cyan family as its chevrons, so the two
      // states are told apart by value and not by shape alone.
      ctx.strokeStyle = lockedRun ? 'rgba(48,86,150,0.16)' : 'rgba(110,185,255,0.30)';
      ctx.lineWidth = lockedRun ? 1.6 : 2;
      ctx.setLineDash([6, 7]); ctx.lineDashOffset = 0;
      trace();
      ctx.setLineDash([]);
      // available lanes carry traffic too — the corridor is open, it is just not
      // secured yet. Locked ones carry none: nothing is flying out there.
      if (!lockedRun) chevrons(pts2, 'rgba(150,225,255,0.42)', 3.4);
    } else { // selected + unsecured: dashed blue, breathing
      const br = 0.5 + 0.5 * Math.sin(time * 2.2); // slow breath
      ctx.strokeStyle = `rgba(120,195,255,${(0.14 + br * 0.2).toFixed(2)})`;
      ctx.lineWidth = 9 + br * 4; // soft halo swells and fades under the dashes
      ctx.setLineDash([]);
      trace();
      ctx.strokeStyle = `rgba(150,215,255,${(0.6 + br * 0.4).toFixed(2)})`;
      ctx.lineWidth = 2.5;
      ctx.setLineDash([6, 7]); ctx.lineDashOffset = 0;
      trace();
      ctx.setLineDash([]);
      // the same marching chevrons the secured lanes get, in cyan
      chevrons(pts2, 'rgba(198,240,255,0.9)', 4.5);
    }
  };
  for (let k = 0; k < SEGS.length; k++) drawRun(k);
  // LAYER 3: the blueprint wireframe above — transparent, so the buried
  // cables stay readable through the whole city (procedural world only)
  if (!IM) {
    const bx0 = ccx - mapCamX * mapZoom, by0 = ccy - mapCamY * mapZoom;
    const bw0 = CITY_W * mapZoom, bh0 = CITY_H * mapZoom;
    drawGalaxyOverlay({ ox: ccx - mapCamX * mapZoom, oy: ccy - mapCamY * mapZoom, z: mapZoom }, ccx, ccy, R);
    drawSystemsLive(wx, wy, mapZoom, ccx, ccy, R);
    // LAYER 4: the selected run again, over the skyline — the line in focus
    drawRun(mapSel);
  }
  // (The terminus marker is GONE. It drew a bordered box — green once delivered
  // — at relayW(LEVELS.length), which for every campaign but the last IS the next
  // campaign's first system. So a green CITY_TERMS badge sat directly on top of a
  // star. The run already ends at its final destination, and that destination has
  // its own marker and its own name.)
  // relay markers: the DESTINATION itself, with its numbered plate riding above
  // it. The plate keeps its original panel background — a number burned over a
  // lit world was hard to read AND hid the thing it was labelling — so the body
  // sits clear below and a short leader points down at it.
  const nr = Math.min(W, H) * 0.03;
  for (let i = 0; i < LEVELS.length; i++) {
    // Cull on the DESTINATION, which is where the marker actually draws — the
    // system centre can sit well outside the lens while the planet it holds is
    // dead centre of it.
    { const dp0 = relayDestPos(i);
      if (Math.hypot(wx(dp0) - ccx, wy(dp0) - ccy) > R + nr * 8) continue; }
    const locked = i + 1 > PROG.unlocked;
    const cleared = PROG.stars[i] > 0;
    const isFrontier = i === frontier && !cleared;
    const isBoss = !!LEVELS[i].boss;
    const campId = (typeof CAMP !== 'undefined' && CAMP && CAMP.id) || 'x';
    // 40% smaller than the first cut: at full size the bodies crowded each other
    // and left no room for the systems and lanes around them
    // ---- the destination body ----
    // It is NOT drawn here any more. The body is a planet on an orbit (or the
    // star) inside the system that drawSystemsLive already paints, at the same
    // scale as every other world on the chart — a destination is a place in a
    // system, not a system-sized object sitting where a system should be. All
    // this pass adds is a reticle saying WHICH body, and the camera closes in far
    // enough to read it.
    const dp = relayDestPos(i);
    const mx2 = wx(dp), my2 = wy(dp);
    const dR = Math.max(3.5, nr * 0.30);
    ctx.save();
    ctx.globalAlpha = locked ? 0.4 : 1;
    ctx.strokeStyle = locked ? 'rgba(150,190,240,0.5)'
      : isBoss ? 'rgba(212,101,255,0.95)' : 'rgba(126,226,98,0.95)';
    ctx.lineWidth = 1.3;
    // an open reticle, so the body it marks stays visible inside it
    for (let k = 0; k < 4; k++) {
      const a2 = k * (TAU / 4) + TAU / 8;
      ctx.beginPath();
      ctx.arc(mx2, my2, dR, a2 - 0.42, a2 + 0.42);
      ctx.stroke();
    }
    ctx.restore();
    if (isFrontier || i === mapSel) {
      ctx.strokeStyle = i === mapSel ? 'rgba(240,252,255,0.9)'
        : `rgba(255,210,74,${(0.7 + Math.sin(time * 4) * 0.3).toFixed(2)})`;
      ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.arc(mx2, my2, dR * 1.7, 0, TAU); ctx.stroke();
    }
    // ---- the numbered plate, riding above ----
    const py3 = my2 - dR - nr * 0.95;
    const r = nr * 0.72;
    mapHex(mx2, py3, r);
    ctx.fillStyle = locked ? 'rgba(10,18,34,0.85)' : cleared ? 'rgba(16,50,72,0.92)' : 'rgba(12,30,55,0.92)';
    ctx.fill();
    if (isFrontier) ctx.strokeStyle = `rgba(255,210,74,${(0.7 + Math.sin(time * 4) * 0.3).toFixed(2)})`;
    else ctx.strokeStyle = locked ? 'rgba(120,180,255,0.25)' : isBoss ? 'rgba(212,101,255,0.85)' : 'rgba(111,227,255,0.85)';
    ctx.lineWidth = isFrontier ? 2 : 1.5;
    mapHex(mx2, py3, r); ctx.stroke();
    ctx.strokeStyle = locked ? 'rgba(120,180,255,0.20)' : 'rgba(111,227,255,0.45)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(mx2, py3 + r); ctx.lineTo(mx2, my2 - dR * 1.05); ctx.stroke();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = locked ? 'rgba(200,225,255,0.35)' : '#f2faff';
    const num = String(curLevelNo(i));
    ctx.font = '800 ' + Math.round(r * (num.length > 1 ? 0.6 : 0.75)) + 'px Audiowide, system-ui';
    ctx.fillText(locked ? '·' : num, mx2, py3 + 1);
    ctx.textBaseline = 'alphabetic';
    if (cleared) for (let k = 0; k < 3; k++) star5(mx2 - 11 + k * 11, my2 + dR + 9, 4, k < PROG.stars[i]);
    ctx.textAlign = 'left';
    // the hit box spans plate AND body, so either can be tapped
    menuButtons.push({ x: mx2 - 22, y: py3 - 20, w: 44, h: (my2 + dR + 12) - (py3 - 20), node: i, locked: false });
  }
  // lens optics: an inner vignette. The rotating radar needle is GONE — it swept
  // a bright wedge across everything twice a minute and there is nothing on this
  // chart it was reporting.
  const vg = ctx.createRadialGradient(ccx, ccy, R * 0.55, ccx, ccy, R);
  vg.addColorStop(0, 'rgba(2,6,14,0)');
  vg.addColorStop(1, 'rgba(2,6,14,0.55)');
  ctx.fillStyle = vg;
  ctx.beginPath(); ctx.arc(ccx, ccy, R, 0, TAU); ctx.fill();
  ctx.restore();
  // lens rim
  ctx.strokeStyle = 'rgba(111,227,255,0.35)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(ccx, ccy, R - 5, 0, TAU); ctx.stroke();
  if (discRimAl > 0) { // the campaign disc's rim, mid-crossfade with the lens
    ctx.save();
    ctx.globalAlpha = discRimAl;
    ctx.strokeStyle = 'rgba(140,230,255,0.95)'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(ccx, ccy, R, 0, TAU); ctx.stroke();
    ctx.strokeStyle = 'rgba(60,110,180,0.35)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(ccx, ccy, R * 1.05, 0, TAU); ctx.stroke();
    ctx.restore();
  }

  drawMapList(ccx, ccy, R, frontier);
  ctx.save();
  ctx.translate(menuCardOff(), 0); // the dossier flows in from the right
  drawMapCard(mapSel, frontier, ccx, ccy, R);
  ctx.restore();

  // RESET CAMPAIGN — a lone dim ↺ key beside the last relay row. PRESS AND
  // HOLD (touch, or the pad's SELECT) to fill the ring; completing the fill
  // opens the confirm modal. The ring reacting the instant you press teaches
  // the hold by itself — and a stray tap does nothing at all.
  if (mapLastRowH) {
    const rby = mapLastRowY, rbh = mapLastRowH;
    const dyC = (rby + rbh / 2) - ccy;
    const lensR = ccx + Math.sqrt(Math.max(0, (R + 14) * (R + 14) - dyC * dyC)); // rim x at this row
    const ir = Math.max(10, Math.round(rbh * 0.42));
    const icx = lensR + 10 + ir, icy = rby + rbh / 2;
    const hq = clamp(Math.max(resetHold ? resetHold.t : 0, padSelHold) / RESET_HOLD, 0, 1);
    ctx.strokeStyle = `rgba(220,140,140,${(0.28 + hq * 0.5).toFixed(2)})`;
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(icx, icy, ir, 0, TAU); ctx.stroke();
    if (hq > 0) { // the commitment ring fills from 12 o'clock — release aborts
      ctx.strokeStyle = 'rgba(255,110,110,0.9)';
      ctx.lineWidth = 2.5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(icx, icy, ir + 3.5, -Math.PI / 2, -Math.PI / 2 + hq * TAU); ctx.stroke();
    }
    ctx.fillStyle = `rgba(230,160,160,${(0.5 + hq * 0.5).toFixed(2)})`;
    ctx.font = '600 ' + Math.round(ir * 1.25) + 'px system-ui';
    // ↺ isn't centered inside its em-box, so 'middle'/'center' leaves it high
    // and left. Center the actual GLYPH INK via its bounding box (adapts to
    // whatever font renders per platform); fall back to box-centering headless.
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    const gm = ctx.measureText('↺');
    const aL = gm.actualBoundingBoxLeft, aR = gm.actualBoundingBoxRight;
    const aA = gm.actualBoundingBoxAscent, aD = gm.actualBoundingBoxDescent;
    if ([aL, aR, aA, aD].every(v => typeof v === 'number')) {
      ctx.fillText('↺', icx - (aR - aL) / 2, icy + (aA - aD) / 2);
    } else {
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('↺', icx, icy);
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    }
    resetIconRect = { x: icx - ir - 10, y: icy - ir - 10, w: (ir + 10) * 2, h: (ir + 10) * 2 };
    if (gpSeen) drawPadHint(icx, icy + ir + 16, 'SEL');
  } else resetIconRect = null;

  // hidden dev gesture: hold the FINAL relay for HOLD_BOSS seconds to drop
  // straight into the CORE duel — a charging ring gives quiet feedback
  if (menuHold) {
    const p = clamp(menuHold.t / HOLD_BOSS, 0, 1);
    ctx.save();
    ctx.strokeStyle = 'rgba(212,101,255,0.9)'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(menuHold.x, menuHold.y, 26, -Math.PI / 2, -Math.PI / 2 + p * TAU);
    ctx.stroke();
    ctx.restore();
  }
}
// left column: the relay list — the selector that drives the lens
function drawMapList(ccx, ccy, R, frontier) {
  ctx.textAlign = 'left';
  const lx2 = 10 + SAFE.l * 0.6;
  const rows = LEVELS.length;
  const topY = 68 + SAFE.t, botY = H - 16; // list starts under brand + title + rule
  const gap2 = 6;
  const rh = clamp((botY - topY - (rows - 1) * gap2) / rows, 20, 34); // ALL rows fit — no scroll
  let ly2 = topY + Math.max(0, (botY - topY - (rows * (rh + gap2) - gap2)) / 2);
  // ONE width for every key; right edges land on the lens circle, so the
  // column stacks as an arc of identical keys hugging the rim
  const lw2 = Math.max(140, (ccx - (R + 14)) - lx2 - 8);
  for (let i = 0; i < rows; i++) {
    const dyC = (ly2 + rh / 2) - ccy;
    const lensL = Math.abs(dyC) < R + 14 ? ccx - Math.sqrt(Math.max(0, (R + 14) * (R + 14) - dyC * dyC)) : ccx - R * 0.2;
    const rx = lensL - 8 - lw2; // right-aligned to the rim
    const locked = i + 1 > PROG.unlocked;
    const sel = i === mapSel;
    ctx.save();
    ctx.translate(menuRowOff(i, rows), 0); // staggered fly-in from the left
    techRect(rx, ly2, lw2, rh, 6);
    ctx.fillStyle = sel ? 'rgba(30,120,190,0.4)' : locked ? 'rgba(90,160,255,0.04)' : 'rgba(10,36,64,0.5)';
    ctx.fill();
    ctx.strokeStyle = sel ? 'rgba(150,238,255,0.95)'
      : i === frontier && !locked ? 'rgba(255,210,74,0.6)'
      : locked ? 'rgba(120,180,255,0.15)' : 'rgba(95,200,255,0.4)';
    ctx.lineWidth = sel ? 1.5 : 1;
    techRect(rx, ly2, lw2, rh, 6); ctx.stroke();
    // title only — the dossier owns stars and stats
    ctx.fillStyle = locked ? 'rgba(220,240,255,0.3)' : '#f2faff';
    const nm = lvNum(curLevelNo(i)) + '  ' + levelTitle(i);
    // Driven by the camera's position along the lane, not by a clock of its own.
    // The dwell at each destination comes free: the ride already holds there.
    const padR = locked ? 34 : 18;
    ctx.font = '700 11px Audiowide, system-ui';
    ctx.textBaseline = 'middle';
    drawMarquee('relay' + i, nm, rx + 10, ly2 + rh / 2 + 1, lw2 - padR - 4, sel ? mapRideK : null);
    ctx.textBaseline = 'alphabetic';
    if (locked) padlock(rx + lw2 - 14, ly2 + rh / 2, 5);
    ctx.restore();
    menuButtons.push({ x: rx, y: ly2, w: lw2, h: rh, node: i, locked: false });
    if (i === rows - 1) { mapLastRowY = ly2; mapLastRowH = rh; } // the reset key aligns to this
    ly2 += rh + gap2;
  }
}
function drawMapCard(li, frontier, ccx, ccy, R) {
  ctx.textAlign = 'left';
  const L2 = LEVELS[li];
  const locked = li + 1 > PROG.unlocked;
  const px2 = ccx + R + 12;
  const pw = Math.max(120, W - SAFE.r - 14 - px2);
  const ph = Math.min(H - 100, 236);
  const py2 = ccy - ph / 2;
  techRect(px2, py2, pw, ph, 10);
  ctx.fillStyle = 'rgba(5,14,30,0.82)'; ctx.fill();
  ctx.strokeStyle = locked ? 'rgba(120,180,255,0.25)' : 'rgba(111,227,255,0.45)'; ctx.lineWidth = 1.5;
  techRect(px2, py2, pw, ph, 10); ctx.stroke();
  ctx.fillStyle = locked ? 'rgba(220,240,255,0.5)' : 'rgba(140,200,255,0.6)';
  ctx.font = '700 9px Audiowide, system-ui';
  ctx.fillText('LEVEL ' + lvNum(curLevelNo(li)), px2 + 14, py2 + 20);
  if (locked) {
    ctx.fillStyle = 'rgba(220,240,255,0.55)'; ctx.font = '700 12px Audiowide, system-ui';
    ctx.fillText('SEALED', px2 + 14, py2 + 44);
    ctx.fillStyle = 'rgba(160,200,240,0.45)'; ctx.font = '500 9px Audiowide, system-ui';
    ctx.fillText('secure the previous', px2 + 14, py2 + 64);
    ctx.fillText('relay to unseal', px2 + 14, py2 + 78);
    padlock(px2 + pw / 2, py2 + ph - 40, 9);
    return;
  }
  // The dossier names the same route the list does, so it overruns the same way —
  // and it rides the same lens position, so card and row read as one label.
  ctx.fillStyle = '#f2faff'; ctx.font = '700 12px Audiowide, system-ui';
  drawMarquee('card', levelTitle(li), px2 + 14, py2 + 40, pw - 28, mapRideK);
  for (let k = 0; k < 3; k++) star5(px2 + 22 + k * 20, py2 + 56, 7, k < PROG.stars[li]);
  // fixed rows top-down, deploy pinned to the bottom — nothing overlaps
  ctx.fillStyle = 'rgba(160,215,255,0.8)'; ctx.font = '600 9px Audiowide, system-ui';
  ctx.fillText((L2.boss ? 'WARDEN DUEL · ' : '') + 'RUN ' + L2.duration + 's · TRAFFIC ' + Math.round(L2.speed * 100), px2 + 14, py2 + 78);
  if ((PROG.bests[li] || 0) > 0) {
    ctx.fillStyle = 'rgba(255,210,74,0.85)';
    ctx.fillText('BEST ' + PROG.bests[li].toLocaleString(), px2 + 14, py2 + 92);
  }
  const kinds = ['normal'];
  if (L2.heavies) kinds.push('heavy');
  if (L2.lines) kinds.push('line');
  if (L2.colors) kinds.push('lock');
  if (L2.walls) kinds.push('wall');
  if (L2.frags) kinds.push('frag');
  if (L2.boss) kinds.push('boss');
  // how much of the city's shield still reaches this relay — the cover thins
  // with every perimeter you leave behind, and the traffic thickens to match
  if (!campMapImg(CAMP)) {
    const cov = relayCover(li);
    const cc = cov.pct > 60 ? '126,226,98' : cov.pct > 30 ? '255,200,80' : '255,110,110';
    ctx.fillStyle = 'rgba(140,200,255,0.6)'; ctx.font = '500 8px Audiowide, system-ui';
    ctx.fillText('CORDON 0' + cov.ring + ' · ' + cov.name, px2 + 14, py2 + 106);
    ctx.textAlign = 'right';
    ctx.fillStyle = `rgba(${cc},0.9)`; ctx.font = '600 8px Audiowide, system-ui';
    ctx.fillText('COVER ' + cov.pct + '%', px2 + pw - 14, py2 + 106);
    ctx.textAlign = 'left';
    const bw2 = pw - 28, by3 = py2 + 112;
    ctx.fillStyle = 'rgba(120,180,255,0.14)'; ctx.fillRect(px2 + 14, by3, bw2, 4);
    ctx.fillStyle = `rgba(${cc},0.85)`; ctx.fillRect(px2 + 14, by3, bw2 * cov.pct / 100, 4);
  }
  const dw = pw - 24, dh = 34;
  const dx2 = px2 + 12, dy2 = py2 + ph - dh - 12;
  // the traffic legend stacks UP from the deploy key, so a short panel squeezes
  // the gap above it rather than sliding glyphs under the button
  const gRows = Math.ceil(kinds.length / 5), gy = dy2 - 20 - (gRows - 1) * 26;
  ctx.fillStyle = 'rgba(140,200,255,0.55)'; ctx.font = '500 8px Audiowide, system-ui';
  ctx.fillText('EXPECTED TRAFFIC', px2 + 14, gy - 16);
  kinds.forEach((k, ki) => {
    const col2 = ki % 5, row2 = Math.floor(ki / 5);
    drawInfoGlyph(k, px2 + 26 + col2 * 26, gy + row2 * 26, 8);
  });
  levelKey(dx2, dy2, dw, dh, '▶', 'DEPLOY', -1, false, li === frontier);
  menuButtons.push({ x: dx2, y: dy2, w: dw, h: dh, deploy: li, locked: false });
}

// audio config overlay on the main menu — same controls as the pause panel
function drawMenuSettings() {
  const q = popFxQ('set', menuSettings);
  pauseSlidersList = []; pauseTogglesList = []; menuSetButtons = [];
  ctx.fillStyle = 'rgba(3,6,14,' + (0.62 * q).toFixed(2) + ')'; ctx.fillRect(0, 0, W, H);
  const pw = Math.min(W * 0.72, 520), ph = Math.min(H * 0.84, 300);
  const px = W / 2 - pw / 2, py = H / 2 - ph / 2;
  menuSetPanel = { x: px, y: py, w: pw, h: ph };
  popRender(q, px, py, pw, ph, () => {
    ctx.save();
    techPanel(px, py, pw, ph, 'SYSTEM CONFIG');
    settingRow('SFX',     'sound',   'soundVol', py + 76,  px, pw);
    settingRow('MUSIC',   'music',   'musicVol', py + 120, px, pw);
    settingRow('HAPTICS', 'haptics', null,       py + 164, px, pw);
    const bw = 160, bh = 42;
    button(W / 2 - bw / 2, py + ph - bh - 20, bw, bh, 'CLOSE', true);
    menuSetButtons.push({ x: W / 2 - bw / 2, y: py + ph - bh - 20, w: bw, h: bh, action: 'close' });
    ctx.restore();
  });
  ctx.textAlign = 'left';
}

// keep exactly one DOM text field mounted for the current view; reposition it on
// resize, (re)create it only when the field it represents changes
let overlayField = '';
function mountField(kind, rect, opts) {
  if (overlayField === kind && overlayEl) {
    overlayEl.style.left = rect.x + 'px'; overlayEl.style.top = rect.y + 'px';
    overlayEl.style.width = rect.w + 'px'; overlayEl.style.height = rect.h + 'px';
    return;
  }
  overlayField = kind; overlayInput(rect, opts);
}
function clearField() { overlayField = ''; hideOverlay(); }

function drawEnd(g) {
  endButtons = [];
  const ph = (a, b2) => clamp((endT - a) / (b2 - a), 0, 1);
  // wins let the clear-sweep roll first; losses resolve fast
  const T = endWin
    ? { panel0: 0.95, panel1: 1.4, cnt0: 1.4, cnt1: 2.55, stars: 1.6, stats: 2.6 }
    : { panel0: 0.05, panel1: 0.40, cnt0: 0.35, cnt1: 1.00, stars: 99,   stats: 1.0 };
  const btnAt = endBtnAt();

  // the live (now cleared) scene keeps breathing beneath — dim it gently. Wins
  // stay lighter: the destination world is swelling in behind the data and the
  // whole point is to see it arrive.
  const dimK = endWin && !endless && !qual ? 0.18 : 0.5;
  ctx.fillStyle = 'rgba(3,6,14,' + (dimK * (endWin ? ph(0.75, 1.2) : ph(0, 0.45))).toFixed(2) + ')';
  ctx.fillRect(0, 0, W, H);
  if (endWin && endT < 0.35) { // victory flash seals the run
    ctx.fillStyle = 'rgba(126,226,98,' + (0.28 * (1 - endT / 0.35)).toFixed(2) + ')';
    ctx.fillRect(0, 0, W, H);
  }
  const pA = ph(T.panel0, T.panel1);
  if (pA <= 0.001) return;

  const R = g.nodeR * 0.94;
  const maxW = g.nodeR * 2 * 0.62;
  const endCol = endless ? '#ffb340' : endWin ? '#69e05c' : '#ff4a5e';
  const fit = (weight, px2, text) => {
    let fs = px2 + 1;
    do { fs--; ctx.font = weight + ' ' + fs + 'px Audiowide, system-ui'; }
    while (fs > 8 && ctx.measureText(text).width > maxW);
    return fs;
  };

  ctx.save();
  ctx.globalAlpha = pA;
  // No report disc. The destination world IS the backdrop — the data floats
  // straight on the scene, carried by a dark shadow instead of a panel.
  ctx.textAlign = 'center';
  // the scene shows through at 0.18, so the data leans harder on its own shadow
  ctx.shadowColor = 'rgba(2,5,12,0.95)'; ctx.shadowBlur = lowFX ? 0 : 9;
  // mode line
  const modeName = endless ? (daily ? 'DAILY LANE' : 'ENDLESS LANE') : qual ? 'QUALIFICATION' : curRouteName();
  try { ctx.letterSpacing = '3px'; } catch (e) {}
  ctx.fillStyle = 'rgba(140,210,255,0.7)';
  fit('700', 11, 'MISSION REPORT  //  ' + modeName);
  ctx.fillText('MISSION REPORT  //  ' + modeName, g.cx, g.cy - R * 0.64);
  try { ctx.letterSpacing = '0px'; } catch (e) {}

  // banner slams in
  const tPop = 1 + 0.22 * (1 - ph(T.panel0, T.panel0 + 0.3));
  const banner = endless ? 'LANE COLLAPSED' : qual ? (endWin ? 'QUALIFIED' : 'TRAINING ABORTED') : endWin ? 'LANE CLEARED' : 'WARP LANE UNSTABLE';
  ctx.save();
  ctx.translate(g.cx, g.cy - R * 0.38);
  ctx.scale(tPop, tPop);
  ctx.fillStyle = endCol;
  try { ctx.letterSpacing = '4px'; } catch (e) {}
  fit('800', 30, banner);
  ctx.shadowColor = endCol; ctx.shadowBlur = 22;
  ctx.fillText(banner, 0, 0);
  ctx.shadowBlur = 0;
  try { ctx.letterSpacing = '0px'; } catch (e) {}
  ctx.restore();

  // stars pop one by one, each with a chime
  if (endWin && !qual && !endless) {
    drawStars(g.cx, g.cy - R * 0.16, endStars, Math.min(W, H) * 0.045, endT - T.stars);
    let popped = 0;
    for (let i = 0; i < endStars; i++) if (endT - T.stars > 0.4 + i * 0.35) popped++;
    if (popped > endFxStars) { endFxStars = popped; tone(760 + popped * 220, 0.2, 'triangle', 0.13, 900 + popped * 260); }
  }

  // the score counts itself up
  const cntP = 1 - Math.pow(1 - ph(T.cnt0, T.cnt1), 3);
  const shown = Math.round(score * cntP);
  const counting = cntP > 0 && cntP < 1 && score > 0;
  if (counting && time - endTickT > 0.07) { endTickT = time; tone(1500, 0.025, 'square', 0.035); }
  ctx.fillStyle = '#eaf4ff';
  ctx.font = '700 ' + (28 + (counting ? 2 : 0)) + 'px Audiowide, system-ui';
  ctx.fillText(shown.toLocaleString(), g.cx, g.cy + R * 0.1);
  ctx.fillStyle = 'rgba(160,215,255,0.7)'; ctx.font = '600 11px Audiowide, system-ui';
  try { ctx.letterSpacing = '3px'; } catch (e) {}
  ctx.fillText('SCORE', g.cx, g.cy + R * 0.1 + 20);
  try { ctx.letterSpacing = '0px'; } catch (e) {}

  // stats + best reveal after the count settles
  ctx.globalAlpha = pA * ph(T.stats, T.stats + 0.3);
  ctx.fillStyle = 'rgba(150,215,255,0.85)'; ctx.font = '11px monospace';
  ctx.fillText('intercepted ' + zaps + '   //   perfect ' + perfects, g.cx, g.cy + R * 0.36);
  ctx.fillText('missed ' + misses + '   //   integrity ' + Math.round(integrity) + '%', g.cx, g.cy + R * 0.36 + 17);
  const bestVal = endless ? (daily ? (progress.daily && progress.daily.best) : progress.best) : PROG.bests[levelIdx];
  const isNew = endless ? (score >= (bestVal || 0) && score > 0) : endNewBest;
  if ((endless || (!qual && (endWin || (bestVal || 0) > 0))) && bestVal !== undefined) {
    ctx.fillStyle = isNew ? '#ffd24a' : 'rgba(255,210,74,0.7)';
    ctx.font = '700 13px Audiowide, system-ui';
    ctx.fillText((isNew ? 'NEW BEST  ' : 'BEST  ') + (bestVal || 0).toLocaleString(), g.cx, g.cy + R * 0.36 + 44);
  }
  // leaderboard sync status (ranked runs) — green on success, amber on a problem
  if (lbStatus && !qual) {
    ctx.globalAlpha = pA;
    ctx.textAlign = 'center';
    ctx.fillStyle = /RANK|SUBMITTED/.test(lbStatus) ? 'rgba(120,255,170,0.9)' : 'rgba(255,150,90,0.95)';
    ctx.font = '600 10px Audiowide, system-ui';
    ctx.fillText('◈ ' + lbStatus, g.cx, g.cy + R * 0.36 + 80);
  }

  // buttons live OUTSIDE the ring, in the side margins. While the high-score card
  // is up they're GATED: drawn locked (the takeover scrim dims them) and NOT
  // registered as hit targets, so Continue waits until the player saves or skips.
  ctx.shadowBlur = 0; // the data's floating shadow stops here — keys shade themselves
  const bA = ph(btnAt, btnAt + 0.4);
  if (bA > 0.001) {
    ctx.globalAlpha = pA * bA;
    const gated = !!nameEntry;
    const rise = 14 * (1 - bA);
    const margin = g.cx - g.nodeR;
    const bw = Math.min(Math.max(margin * 0.82, 120), 200), bh = 50;
    const lx = margin / 2, rx = W - margin / 2;
    const primary = endWin && !endless && !qual && levelIdx + 1 < LEVELS.length
      ? { label: 'NEXT LEVEL ▸', action: 'next' }
      : { label: endWin ? 'REPLAY' : 'RETRY', action: 'retry' };
    const secondary = [];
    if (primary.action === 'next') secondary.push({ label: 'REPLAY', action: 'retry' });
    secondary.push({ label: 'MENU', action: 'menu' });
    const bcut = Math.min(12, bh * 0.28); // the button()'s own chamfer — the focus ring matches it
    button(rx - bw / 2, g.cy - bh / 2 + rise, bw, bh, primary.label, !gated, gated);
    if (!gated) endButtons.push({ x: rx - bw / 2, y: g.cy - bh / 2, w: bw, h: bh, action: primary.action, cut: bcut });
    let sy = g.cy - (secondary.length * bh + (secondary.length - 1) * 14) / 2;
    for (const b of secondary) {
      button(lx - bw / 2, sy + rise, bw, bh, b.label, false, gated);
      if (!gated) endButtons.push({ x: lx - bw / 2, y: sy, w: bw, h: bh, action: b.action, cut: bcut });
      sy += bh + 14;
    }
  }

  // 80s arcade name entry — the CRESCENDO TAKEOVER. Once the ceremony has played
  // (bA), the run's board rank leads, the rest dims back behind a scrim, and the
  // handle card owns the screen; Continue stays gated (above) until save/skip.
  // Free-typed, live-filtered here (UX) and re-moderated server-side (enforcement).
  nameEntryBtns = [];
  if (!nameEntry && overlayField === 'entry') clearField(); // card gone → drop the DOM field
  if (nameEntry && bA > 0.001) {
    nameEntryFx = Math.min(1, nameEntryFx + frameDt / 0.42);
    const to = 1 - Math.pow(1 - nameEntryFx, 3);      // ease-out entrance
    // scrim pulls the ceremony + gated side keys back for focus
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(3,6,14,' + (0.6 * to).toFixed(3) + ')';
    ctx.fillRect(0, 0, W, H);

    const cw = Math.min(W * 0.84, 344), chh = 226;
    const cx0 = g.cx - cw / 2, cy0 = g.cy - chh / 2;
    const P = 18;
    ctx.save();
    ctx.globalAlpha = to;
    techPanel(cx0, cy0, cw, chh, 'HIGH SCORE');

    // hero: the board rank — the dopamine, so it leads (gold, with a slight pop)
    const rk = endProvisional && endProvisional.rank;
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.save();
    ctx.translate(g.cx, cy0 + 66); ctx.scale(0.82 + 0.18 * to, 0.82 + 0.18 * to);
    if (rk) {
      const big = '#' + rk, sub = '  / ' + LB_SHOW;
      ctx.font = '700 27px Audiowide, system-ui'; const wB = ctx.measureText(big).width;
      ctx.font = '600 14px Audiowide, system-ui'; const wS = ctx.measureText(sub).width;
      const x0 = -(wB + wS) / 2;
      ctx.textAlign = 'left';
      ctx.fillStyle = '#ffe27a'; ctx.shadowColor = 'rgba(255,207,74,0.6)'; ctx.shadowBlur = lowFX ? 0 : 12;
      ctx.font = '700 27px Audiowide, system-ui'; ctx.fillText(big, x0, 0);
      ctx.shadowBlur = 0; ctx.fillStyle = 'rgba(150,200,235,0.75)';
      ctx.font = '600 14px Audiowide, system-ui'; ctx.fillText(sub, x0 + wB, 0);
    } else {
      ctx.fillStyle = '#ffe27a'; ctx.font = '700 18px Audiowide, system-ui';
      ctx.fillText('YOU MADE THE BOARD', 0, 0);
    }
    ctx.restore();

    ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(150,210,255,0.72)';
    try { ctx.letterSpacing = '2px'; } catch (e) {}
    ctx.font = '600 9px Audiowide, system-ui';
    ctx.fillText('LOG YOUR RUNNER HANDLE', g.cx, cy0 + 88);
    try { ctx.letterSpacing = '0px'; } catch (e) {}

    // the handle field. During the entrance it's a static plate; once settled the
    // live DOM input mounts in the same spot (seamless, and keeps the caret native).
    const fx = cx0 + P, fw = cw - P * 2, fy = cy0 + 98, fh = 40;
    const st = nameStatus(nameEntryDraft);
    const settled = to > 0.9;
    if (settled) {
      mountField('entry', { x: fx, y: fy, w: fw, h: fh },
        { placeholder: 'ENTER YOUR HANDLE', value: nameEntryDraft, maxLength: NAME_MAX, onInput: onEntryInput, onEnter: () => confirmNameEntry() });
    } else {
      techRect(fx, fy, fw, fh, 6); ctx.fillStyle = 'rgba(4,12,22,0.85)'; ctx.fill();
      ctx.strokeStyle = 'rgba(120,180,255,0.35)'; ctx.lineWidth = 1.5; techRect(fx, fy, fw, fh, 6); ctx.stroke();
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      const has = !!nameEntryDraft;
      ctx.fillStyle = has ? '#eafaff' : 'rgba(150,200,235,0.5)';
      ctx.font = '600 17px Audiowide, system-ui';
      try { ctx.letterSpacing = '1px'; } catch (e) {}
      ctx.fillText((has ? nameEntryDraft : 'ENTER YOUR HANDLE').toUpperCase(), fx + 14, fy + fh / 2 + 1);
      try { ctx.letterSpacing = '0px'; } catch (e) {}
      ctx.textBaseline = 'alphabetic';
    }
    const pipC = st === 'ok' ? '#6effa8' : (st === 'bad' || st === 'short') ? '#ff7a7a' : 'rgba(120,180,255,0.3)';
    ctx.fillStyle = pipC; ctx.beginPath(); ctx.arc(fx + fw - 15, fy + fh / 2, 4, 0, TAU); ctx.fill();
    if (st === 'bad' || st === 'short') {
      ctx.textAlign = 'left'; ctx.fillStyle = 'rgba(255,140,140,0.9)'; ctx.font = '10px monospace';
      ctx.fillText(st === 'bad' ? 'not allowed' : 'too short', fx + 2, fy + fh + 14);
    }

    // save (gated on a clean handle) + skip (always). Only live once settled.
    const by = cy0 + chh - P - 42, bh2 = 42, bgap = 10;
    const svw = fw * 0.62, skw = fw - svw - bgap;
    button(fx, by, svw, bh2, 'SAVE', st === 'ok', st !== 'ok' || !settled);
    button(fx + svw + bgap, by, skw, bh2, 'SKIP', false, !settled);
    if (settled) {
      if (st === 'ok') nameEntryBtns.push({ x: fx, y: by, w: svw, h: bh2, action: 'nameConfirm' });
      nameEntryBtns.push({ x: fx + svw + bgap, y: by, w: skw, h: bh2, action: 'nameSkip' });
    }
    ctx.restore();
  }

  ctx.restore();
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';
}
