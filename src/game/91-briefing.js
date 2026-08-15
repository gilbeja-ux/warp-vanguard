'use strict';
// ---------- briefing card (S.INFO) ----------
const INFO_PAL = {
  boss:   { glow: '200,70,255',  shades: ['#b03ae8', '#8a2ad4', '#d465ff', '#6f14b8', '#c44af0'], core: '#b03ae8' },
  normal: { glow: '255,60,90',   shades: ['#e8274b', '#ff5a3c', '#d81f6e', '#b3123a', '#ff8c5a'], core: '#ff5a3c' },
  heavy:  { glow: '200,70,255',  shades: ['#b03ae8', '#8a2ad4', '#d465ff', '#6f14b8', '#c44af0'], core: '#b03ae8' },
  lock:   { glow: '80,170,255',  shades: ['#2f7fe0', '#1c4fae', '#4d9bff', '#12398a', '#3f8af0'], core: '#2f7fe0' },
  frag:   { glow: '90,110,140', shades: ['#2b3242', '#151a26', '#3a4354', '#0d1119', '#232a38'], core: '#2b3242' }
};
// a miniature of the live tap hardware, for briefing cards
function infoTap(r, pal, double) {
  ctx.save();
  ctx.rotate(0.55);
  // hex port plate, squashed for depth
  ctx.save();
  ctx.scale(1, 0.5);
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const ha = i / 6 * TAU + Math.PI / 6;
    i ? ctx.lineTo(Math.cos(ha) * r, Math.sin(ha) * r) : ctx.moveTo(Math.cos(ha) * r, Math.sin(ha) * r);
  }
  ctx.closePath();
  const plate = ctx.createLinearGradient(-r, 0, r, 0);
  plate.addColorStop(0, '#1a2334'); plate.addColorStop(0.5, '#0a0e1a'); plate.addColorStop(1, '#141b2b');
  ctx.fillStyle = plate; ctx.fill();
  ctx.strokeStyle = `rgba(${pal.glow},0.95)`; ctx.lineWidth = Math.max(1.5, r * 0.1); ctx.stroke();
  if (double) {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const ha = i / 6 * TAU + Math.PI / 6;
      i ? ctx.lineTo(Math.cos(ha) * r * 1.35, Math.sin(ha) * r * 1.35) : ctx.moveTo(Math.cos(ha) * r * 1.35, Math.sin(ha) * r * 1.35);
    }
    ctx.closePath();
    ctx.strokeStyle = pal.shades[2]; ctx.lineWidth = Math.max(1, r * 0.06);
    ctx.globalAlpha = 0.55 + 0.3 * Math.sin(time * 4);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  ctx.fillStyle = 'rgba(190,215,240,0.75)';
  for (let i = 0; i < 3; i++) {
    const ha = i / 3 * TAU + Math.PI / 6;
    ctx.beginPath(); ctx.arc(Math.cos(ha) * r * 0.72, Math.sin(ha) * r * 0.72, r * 0.08, 0, TAU); ctx.fill();
  }
  ctx.restore();
  // probe needle with its siphon light-guide
  const L2 = r * 1.7, nw = r * 0.17;
  ctx.beginPath(); ctx.moveTo(-nw, 0); ctx.lineTo(0, -L2); ctx.lineTo(nw, 0); ctx.closePath();
  ctx.fillStyle = '#141b2b'; ctx.fill();
  ctx.strokeStyle = 'rgba(170,195,225,0.55)'; ctx.lineWidth = Math.max(0.8, r * 0.06); ctx.stroke();
  ctx.strokeStyle = `rgba(${pal.glow},0.95)`;
  ctx.lineWidth = Math.max(1, r * 0.09);
  ctx.setLineDash([r * 0.28, r * 0.2]);
  ctx.lineDashOffset = time * r * 2.5;
  ctx.beginPath(); ctx.moveTo(0, -L2); ctx.lineTo(0, 0); ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.arc(0, -L2, Math.max(1, r * 0.11), 0, TAU); ctx.fill();
  ctx.restore();
}
function drawInfoGlyph(kind, cx, cy, r) {
  ctx.save();
  ctx.translate(cx, cy);
  if (kind === 'move') {
    ctx.strokeStyle = 'rgba(10,16,28,0.95)'; ctx.lineWidth = r * 0.34;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
    ctx.strokeStyle = 'rgba(120,220,255,0.4)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(0, 0, r * 0.78, 0, TAU); ctx.stroke();
    const demoA = time * 1.2; // demo dots orbit opposite ways, like the drill asks
    for (const [a, col] of [[Math.PI + demoA, 'rgb(80,170,255)'], [-demoA, '#ffffff']]) {
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(Math.cos(a) * r, Math.sin(a) * r, r * 0.18, 0, TAU); ctx.fill();
    }
  } else if (kind === 'pickup') {
    const gl = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 1.9);
    gl.addColorStop(0, 'rgba(255,210,74,0.5)');
    gl.addColorStop(1, 'rgba(255,210,74,0)');
    ctx.fillStyle = gl;
    ctx.beginPath(); ctx.arc(0, 0, r * 1.9, 0, TAU); ctx.fill();
    ctx.rotate(time * 0.4);
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * TAU;
      i ? ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r) : ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fillStyle = 'rgba(60,40,5,0.9)'; ctx.fill();
    ctx.strokeStyle = '#ffd24a'; ctx.lineWidth = Math.max(2, r * 0.14); ctx.stroke();
    ctx.rotate(-time * 0.4);
    const s2 = r * 0.52;
    ctx.fillStyle = '#ffe9b0';
    ctx.beginPath();
    ctx.moveTo(s2 * 0.3, -s2); ctx.lineTo(-s2 * 0.45, s2 * 0.15); ctx.lineTo(0, s2 * 0.15);
    ctx.lineTo(-s2 * 0.3, s2); ctx.lineTo(s2 * 0.45, -0.15 * s2); ctx.lineTo(0, -0.15 * s2);
    ctx.closePath(); ctx.fill();
  } else if (kind === 'frag') {
    // the same failing body the bore shows — the card that TEACHES the killer
    // can't be the one surface still drawing a clean diamond. Its clock is raw
    // time at a fixed rate, which is safe here: the packet's cadence is
    // constant by design, so there is no state-dependent rate to leap.
    voidPacket(r * 1.05, time * 0.25, time, 7.3);
  } else if (kind === 'line') {
    // two full-size taps torn open along a running crack — the pair IS the
    // threat, so each end is the same hardware the 'normal' glyph shows
    const off = r * 1.6;
    ctx.strokeStyle = 'rgba(255,60,90,0.6)'; ctx.lineWidth = Math.max(2, r * 0.16);
    ctx.setLineDash([r * 0.4, r * 0.28]);
    ctx.lineDashOffset = -time * r * 2;
    ctx.beginPath(); ctx.moveTo(-off, 0); ctx.lineTo(off, 0); ctx.stroke();
    ctx.setLineDash([]);
    for (const sx of [-off, off]) {
      ctx.save(); ctx.translate(sx, 0);
      infoTap(r, INFO_PAL.normal, false);
      ctx.restore();
    }
  } else if (kind === 'wall') {
    // the rim wall: a hazard-striped clamp arc seizing part of the rail
    ctx.lineCap = 'butt';
    ctx.strokeStyle = 'rgba(255,120,30,0.5)';
    ctx.lineWidth = r * 0.6;
    ctx.beginPath(); ctx.arc(0, r * 1.1, r * 1.9, -Math.PI * 0.78, -Math.PI * 0.22); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,154,60,0.95)';
    ctx.lineWidth = r * 0.34;
    ctx.beginPath(); ctx.arc(0, r * 1.1, r * 1.9, -Math.PI * 0.78, -Math.PI * 0.22); ctx.stroke();
    ctx.strokeStyle = 'rgba(30,12,4,0.7)';
    ctx.lineWidth = 2;
    for (let k = 0; k < 6; k++) {
      const a = -Math.PI * 0.72 + k * Math.PI * 0.09;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a - 0.03) * r * 1.62, r * 1.1 + Math.sin(a - 0.03) * r * 1.62);
      ctx.lineTo(Math.cos(a + 0.03) * r * 2.18, r * 1.1 + Math.sin(a + 0.03) * r * 2.18);
      ctx.stroke();
    }
  } else if (kind === 'strip') {
    // the golden bonus stream: a flowing ribbon with its trace marker
    ctx.lineCap = 'round';
    for (const [w2, col, al] of [[r * 0.34, '255,180,40', 0.7], [r * 0.13, '255,235,170', 0.95]]) {
      ctx.strokeStyle = `rgba(${col},${al})`;
      ctx.lineWidth = w2;
      ctx.beginPath();
      for (let k = 0; k <= 20; k++) {
        const t = k / 20;
        const x = lerp(-r * 1.5, r * 1.5, t);
        const y = Math.sin(t * 4.2 + time * 2.5) * r * 0.5;
        k ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.stroke();
    }
    const my2 = Math.sin(0.5 * 4.2 + time * 2.5) * r * 0.5;
    const tg2 = ctx.createRadialGradient(0, my2, 0, 0, my2, r * 0.55);
    tg2.addColorStop(0, 'rgba(255,255,255,0.95)');
    tg2.addColorStop(1, 'rgba(255,60,90,0)');
    ctx.fillStyle = tg2;
    ctx.beginPath(); ctx.arc(0, my2, r * 0.55, 0, TAU); ctx.fill();
  } else if (kind === 'pulse') {
    // a charged pad orb, pinging
    const pu = 1 + Math.sin(time * 6) * 0.12;
    const og2 = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 1.3 * pu);
    og2.addColorStop(0, 'rgba(255,255,255,0.95)');
    og2.addColorStop(0.4, `rgba(${NODE_COLS[0]},0.8)`);
    og2.addColorStop(1, `rgba(${NODE_COLS[0]},0)`);
    ctx.fillStyle = og2;
    ctx.beginPath(); ctx.arc(0, 0, r * 1.3 * pu, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(0, 0, r * 0.32 * pu, 0, TAU); ctx.fill();
    const k2 = (time * 0.9) % 1;
    ctx.strokeStyle = `rgba(${NODE_COLS[0]},${(0.7 * (1 - k2)).toFixed(2)})`;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, r * (0.6 + k2 * 1.3), 0, TAU); ctx.stroke();
  } else {
    // the live threat models: tap hardware in the type's color
    const pal = kind === 'heavy' ? INFO_PAL.heavy : kind === 'lock' ? INFO_PAL.lock : INFO_PAL.normal;
    infoTap(r * (kind === 'heavy' ? 1.15 : 1), pal, kind === 'heavy' || kind === 'lock');
    if (kind === 'heavy') { // both node colors demanded
      ctx.strokeStyle = 'rgba(230,245,255,0.55)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, r * 1.6, 0, TAU); ctx.stroke();
      const oa = time * 1.4;
      ctx.fillStyle = 'rgb(80,170,255)';
      ctx.beginPath(); ctx.arc(Math.cos(oa) * r * 1.6, Math.sin(oa) * r * 1.6, r * 0.16, 0, TAU); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(Math.cos(oa + Math.PI) * r * 1.6, Math.sin(oa + Math.PI) * r * 1.6, r * 0.16, 0, TAU); ctx.fill();
    }
    if (kind === 'lock') { // single matching color
      ctx.strokeStyle = 'rgb(80,170,255)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, r * 1.6, 0, TAU); ctx.stroke();
      const oa = time * 1.4;
      ctx.fillStyle = 'rgb(80,170,255)';
      ctx.beginPath(); ctx.arc(Math.cos(oa) * r * 1.6, Math.sin(oa) * r * 1.6, r * 0.16, 0, TAU); ctx.fill();
    }
  }
  ctx.restore();
}
// DROPPING OUT OF WARP.
//
// What was here: a green wave rolling from the ring to the horizon, and a green
// wash filling everything behind it. It said CLEAR — the lane is secure — which
// is a statement about the LEVEL, delivered as a colour filter over the moment
// the player is meant to be looking at the world they just reached. It also ran
// for over two seconds, so the arrival was spent underneath it.
//
// This says ARRIVED instead, and it is the same event the rest of the ceremony
// is already performing rather than a layer on top of it. Three things land
// together on WARP_COLLAPSE's clock and none of them is drawn here:
//
//   · every warp line collapses back into its star  (laneFlow brake, drawStreaks)
//   · the corridor blows outward past the camera    (laneExit, drawTunnel)
//   · the destination closes the last of its approach (drawFarGlow)
//
// What IS drawn here is the punctuation those three need to read as one impact:
// the flash at the instant of the drop, and the bow wave the lane had been
// holding in front of it going past you. Blue-white, because that is what the
// lane is made of — a green arrival would be the only green in the frame.
function drawWarpCollapse(g) {
  if ((state !== S.END && !replaying) || !endWin || endDropT < 0) return;
  const C = WARP_COLLAPSE;
  // Everything here is on the SAME offset as laneExit(). Without it the flash
  // fired the instant the run ended and was most of the way gone before the lane
  // had begun to let go — punctuation arriving ahead of its sentence.
  const t = endDropT - C.at;
  if (t < 0) return;
  // THE FLASH. No attack — it is already at full on the frame it appears, because
  // an impact that fades IN is not an impact. All of it is gone in a third of a
  // second, which is the whole difference between a flash and a filter.
  const f = clamp(t / C.flash, 0, 1);
  if (f < 1) {
    const a = Math.pow(1 - f, 2.2);
    const rr = Math.max(1, g.nodeR * (0.30 + f * 2.4));
    const gl = ctx.createRadialGradient(g.cx, g.cy, 0, g.cx, g.cy, rr);
    gl.addColorStop(0, `rgba(238,249,255,${(0.80 * a).toFixed(3)})`);
    gl.addColorStop(0.32, `rgba(152,206,255,${(0.28 * a).toFixed(3)})`);
    gl.addColorStop(1, 'rgba(92,150,255,0)');
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = gl;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
  // THE SHOCK. It runs OUTWARD and off the edge of the frame — past you — which
  // is the direction that reads as having arrived somewhere. The old wave ran the
  // other way, toward the horizon, which reads as something LEAVING; that was
  // right for a wave that meant "the lane ahead is clear" and wrong for one that
  // means "you are out". It accelerates the whole way, so it never appears to
  // settle into the frame.
  const s = clamp(t / C.shock, 0, 1);
  if (s < 1) {
    const e = 1 - Math.pow(1 - s, 3);
    const r = g.nodeR * 0.06 + e * Math.max(W, H) * 0.95;
    const a = Math.pow(1 - s, 1.6);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    // three passes, widest and faintest first — the same soft-edge profile the
    // warp lines are built from, so the wave is made of the lane's own material
    for (const [w2, col, k] of [
      [26, '120,190,255', 0.16],
      [9, '190,225,255', 0.34],
      [2.5, '245,252,255', 0.80]
    ]) {
      ctx.lineWidth = Math.max(0.8, w2 * (0.4 + (1 - s) * 0.9));
      ctx.strokeStyle = `rgba(${col},${(k * a).toFixed(3)})`;
      ctx.beginPath(); ctx.arc(g.cx, g.cy, r, 0, TAU); ctx.stroke();
    }
    ctx.restore();
  }
}
// (the green wash, its secured hoops, its clean-traffic motes and its wavefront
// are all gone with it — about 60 lines of ring and gradient work per frame that
// the arrival is better without)
function drawInfoCard() {
  const c = INFO_CARDS[infoCard];
  if (!c) return;
  const g = geo();
  // ZOOM in, ZOOM out — the disc flies up to the operator and back away
  const inQ = clamp((time - infoShownAt) / 0.28, 0, 1);
  const outQ = infoOutAt ? clamp((time - infoOutAt) / 0.18, 0, 1) : 0;
  const pop = 1 - Math.pow(1 - inQ, 3);
  ctx.save();
  ctx.globalAlpha = Math.min(pop, 1 - outQ);
  // gentle dim — drawn UNSCALED so the field dims evenly while the disc flies
  ctx.fillStyle = 'rgba(3,6,14,0.45)'; ctx.fillRect(0, 0, W, H);
  const bk = 1.70158; // ease-out-back: the zoom lands with a breath of overshoot
  const zin = 1 + (bk + 1) * Math.pow(inQ - 1, 3) + bk * Math.pow(inQ - 1, 2);
  const sc2 = (0.3 + 0.7 * zin) * (1 - 0.75 * outQ * outQ);
  ctx.translate(g.cx, g.cy); ctx.scale(sc2, sc2); ctx.translate(-g.cx, -g.cy);
  const R = g.nodeR * 0.9;
  const maxW = g.nodeR * 2 * 0.6; // text never wider than 60% of the ring
  const bg = ctx.createRadialGradient(g.cx, g.cy, R * 0.25, g.cx, g.cy, R);
  bg.addColorStop(0, 'rgba(6,11,24,0.93)');
  bg.addColorStop(0.82, 'rgba(5,9,20,0.88)');
  bg.addColorStop(1, 'rgba(5,9,20,0)');
  ctx.fillStyle = bg;
  ctx.beginPath(); ctx.arc(g.cx, g.cy, R, 0, TAU); ctx.fill();
  // tech border: thin ring with four drifting accent arcs
  ctx.strokeStyle = 'rgba(120,200,255,0.3)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(g.cx, g.cy, R * 0.97, 0, TAU); ctx.stroke();
  ctx.strokeStyle = 'rgba(140,230,255,0.75)'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
  for (let k = 0; k < 4; k++) {
    const a = k / 4 * TAU + Math.PI / 4 + time * 0.15;
    ctx.beginPath(); ctx.arc(g.cx, g.cy, R * 0.97, a - 0.22, a + 0.22); ctx.stroke();
  }
  // shrink type until it honors the width budget
  const fit = (weight, px2, text) => {
    let fs = px2 + 1;
    do { fs--; ctx.font = weight + ' ' + fs + 'px Audiowide, system-ui'; }
    while (fs > 8 && ctx.measureText(text).width > maxW);
    return fs;
  };
  // THE CLOSURE DISC SHARES THE MISSION LAYOUT. `verdict` fires once per campaign, when the
  // last relay's boss goes down, and it wants the same picture-over-caption shape a
  // briefing has rather than the threat-model layout it used to borrow.
  const isStory = /^story/.test(infoCard) || infoCard === 'verdict';
  ctx.textAlign = 'center';
  if (isStory) drawStoryDisc(c, g, R);
  else { // FIELD BRIEFING: a threat model, named, with its drill
    try { ctx.letterSpacing = '3px'; } catch (e) {}
    ctx.fillStyle = 'rgba(140,210,255,0.7)';
    fit('700', 11, 'FIELD BRIEFING');
    ctx.fillText('FIELD BRIEFING', g.cx, g.cy - R * 0.64);
    try { ctx.letterSpacing = '0px'; } catch (e) {}
    drawInfoGlyph(infoCard, g.cx, g.cy - R * 0.33, Math.min(R * 0.16, 40));
    ctx.fillStyle = '#eafaff';
    try { ctx.letterSpacing = '2px'; } catch (e) {}
    fit('800', 22, c.title);
    ctx.fillText(c.title, g.cx, g.cy + R * 0.06);
    try { ctx.letterSpacing = '0px'; } catch (e) {}
    ctx.fillStyle = 'rgba(190,225,255,0.88)';
    const cl = c.lines || [];
    let lf = 15;
    do { lf--; ctx.font = '500 ' + lf + 'px Audiowide, system-ui'; }
    while (lf > 8 && Math.max(0, ...cl.map(l => ctx.measureText(l).width)) > maxW);
    cl.forEach((ln, i) => ctx.fillText(ln, g.cx, g.cy + R * 0.2 + i * (lf + 3)));
  }
  // a mission disc spends its middle on art and readings, so the hint sits lower
  // and quieter — down where the disc has narrowed to little else
  const tapY = g.cy + R * (isStory ? TAP_K : 0.66);
  ctx.fillStyle = 'rgba(140,230,255,' + (0.5 + Math.sin(time * 4) * 0.3).toFixed(2) + ')';
  try { ctx.letterSpacing = isStory ? '2px' : '3px'; } catch (e) {}
  fit('700', isStory ? 9 : 12, 'TAP TO CONTINUE');
  ctx.fillText('TAP TO CONTINUE', g.cx, tapY);
  if (gpSeen) drawPadHint(g.cx + ctx.measureText('TAP TO CONTINUE').width / 2 + 22, tapY - 4, 'A');
  try { ctx.letterSpacing = '0px'; } catch (e) {}
  ctx.textAlign = 'left';
  ctx.restore();
}

// break a sentence to a pixel width under the CURRENT font — returns the rows
// rather than drawing them, so a caller can size a panel to its own text
function wrapRows(text, maxW) {
  const rows = [];
  let line = '';
  for (const w of String(text).split(/\s+/)) {
    if (!w) continue;
    const test = line ? line + ' ' + w : w;
    if (line && ctx.measureText(test).width > maxW) { rows.push(line); line = w; }
    else line = test;
  }
  if (line) rows.push(line);
  return rows;
}

// THE PLOT LINE'S ARRIVAL. It used to type itself in, one character appearing whole with
// a teletype tick under it. A teletype is a machine printing AT you; a briefing arrives.
// Now every character runs its own short fade on a stagger, so the line resolves as a
// soft wave left to right and the last glyph lands about where the typing used to finish.
const BAR_SCALE = 1.5;         // the caption bar's height, over what its rows need
// TAP TO CONTINUE's baseline on a story/closure disc, as a share of R. Shared, because the
// closure's text sizes itself against the room it has BEFORE that line — two places reading
// one number, rather than two numbers drifting apart.
const TAP_K = 0.79;
const LINE_LEAD = 0.25;        // the beat before the first character shows
const LINE_STAGGER = 0.016;    // and the gap between each one starting
const LINE_FADE = 0.34;        // how long one character takes to arrive
const STAT_LEAD = 0.30;        // the readings hold at zero this long…
const STAT_RISE = 0.75;        // …then spin up to their value over this
// PREFIX WIDTHS, CACHED. A per-character fade needs an x per glyph, and taking those from
// cumulative prefix widths — rather than summing each character's own advance — puts every
// glyph exactly where the whole string would have put it, kerning included. Measured once
// per row per font: a card that never changes would otherwise pay ~90 measureText calls a
// frame for a layout that is already settled. The font is IN the key, so a size change
// cannot reuse a stale row.
const CHAR_XS = new Map();
function charXs(row, font) {
  const key = font + '|' + row;
  let xs = CHAR_XS.get(key);
  if (xs) return xs;
  xs = [0];
  for (let i = 1; i <= row.length; i++) xs.push(ctx.measureText(row.slice(0, i)).width);
  if (CHAR_XS.size > 64) CHAR_XS.clear(); // a handful live at a time — a flush is free
  CHAR_XS.set(key, xs);
  return xs;
}

// ---- the mission disc ----
// The keyframe fills the disc wall to wall, masked by the disc itself — the same
// treatment the contract carousel gives a campaign's map image. The plot line
// rides a caption bar across the art's lower edge, full disc width. Below the
// art, two readings of what you're flying into. One thing said per mission; the
// in-run comms carry the scene from here.
// THE FALLBACK IS A HERO SHOT OF THE DESTINATION, not a placeholder.
//
// It used to be a plate in the relay's tint with a threat glyph stamped on it — honest
// about being empty, and it looked it. The lane already knows where it delivers, and that
// world is already rendered per-pixel by the same shader the arrival uses
// (planetVariant → buildPlanetSprite), so the disc can show the actual place for free:
// no file, no download, no decode, and it can never be the wrong world for the lane.
//
// Composed for the disc, not the bore. The circle mask takes the corners and the caption
// bar covers the lower band, so the body is centred horizontally and sits in the middle of
// what is actually VISIBLE (aTop → the caption bar's top), which is a different centre
// from the art box's.
//
// Draw-only, and the randomness proves it: the star scatter runs off its own mulberry32
// keyed by the relay, never Math.random — that IS the sim RNG on a campaign level, and a
// briefing disc that consumed from it would desync the replay verifier.
function drawDiscWorld(g, Rc, aTop, aH, bh, L) {
  const tint = (L && L.tint) || '80,160,255';
  const domeH = Math.max(24, aH - bh);          // what the caption bar leaves visible
  // 0.55, not 0.5: aTop is the circle's topmost POINT, where the mask's visible width is
  // zero, so the geometric middle of the dome still sits high enough to shave the body's
  // crown off. Pushed down until the crown clears the mask with room to spare.
  const cy = aTop + domeH * 0.55;
  // deep space, with the relay's colour lifting the top edge — the same cue the old
  // plate carried, kept because it is what tells two adjacent discs apart at a glance
  const bg = ctx.createLinearGradient(g.cx, aTop, g.cx, aTop + aH);
  bg.addColorStop(0, 'rgba(' + tint + ',0.20)');
  bg.addColorStop(0.55, 'rgba(5,10,22,0.96)');
  bg.addColorStop(1, 'rgba(2,5,12,1)');
  ctx.fillStyle = bg; ctx.fillRect(g.cx - Rc, aTop, Rc * 2, aH);
  const rnd = mulberry32(((levelIdx + 1) * 9176) ^ 0x5f3a);
  for (let i = 0; i < 90; i++) {
    const sx = g.cx - Rc + rnd() * Rc * 2, sy = aTop + rnd() * aH;
    const a2 = 0.14 + rnd() * 0.6, sr = 0.4 + rnd() * 1.0;
    ctx.fillStyle = 'rgba(214,236,255,' + a2.toFixed(2) + ')';
    ctx.beginPath(); ctx.arc(sx, sy, sr, 0, TAU); ctx.fill();
  }
  const V = planetVariant();
  const R = domeH * 0.34;
  // the atmosphere, behind the body — this is most of what makes it read as glamorous
  // rather than as a circle pasted on stars. A STAR gets far less of it: its sprite is
  // already a bloom, and at the planet's setting the haze filled the whole dome orange
  // and buried both the starfield and the relay's tint under it.
  const hazeK = V.emis ? 0.5 : 1, reach = V.emis ? 2.0 : 2.6;
  const hz = ctx.createRadialGradient(g.cx, cy, R * 0.92, g.cx, cy, R * reach);
  hz.addColorStop(0, 'rgba(' + V.atmo + ',' + (0.34 * hazeK).toFixed(3) + ')');
  hz.addColorStop(0.4, 'rgba(' + V.atmo + ',' + (0.11 * hazeK).toFixed(3) + ')');
  hz.addColorStop(1, 'rgba(' + V.atmo + ',0)');
  ctx.fillStyle = hz;
  ctx.beginPath(); ctx.arc(g.cx, cy, R * reach, 0, TAU); ctx.fill();
  const sp = discWorld(V);
  if (sp) {
    const w = sp.S * (R / sp.R);
    ctx.drawImage(sp.cv, g.cx - w / 2, cy - w / 2, w, w);
    // the day/night line, so the body has a direction of light and a lit limb. A star
    // has no night side to draw one on.
    if (!V.emis) drawTerminatorCreep({ x: g.cx, y: cy }, R, 1, destLightA());
  } else {
    // no ImageData (the headless harness stubs it): a lit disc, offset to the key light
    ctx.save();
    ctx.beginPath(); ctx.arc(g.cx, cy, R, 0, TAU); ctx.clip();
    ctx.fillStyle = 'rgba(9,14,26,0.95)';
    ctx.fillRect(g.cx - R, cy - R, R * 2, R * 2);
    const bg2 = ctx.createRadialGradient(
      g.cx + Math.cos(LIGHT_A) * R * 0.62, cy + Math.sin(LIGHT_A) * R * 0.62, R * 0.05,
      g.cx, cy, R * 1.45);
    bg2.addColorStop(0, 'rgba(' + V.z + ',0.75)');
    bg2.addColorStop(1, 'rgba(14,22,44,0)');
    ctx.fillStyle = bg2;
    ctx.fillRect(g.cx - R, cy - R, R * 2, R * 2);
    ctx.restore();
  }
}
function drawStoryDisc(c, g, R) {
  // On the closure disc `slice(5)` is 'ct' → NaN → L is undefined, and that is exactly
  // right: the readings further down describe a LANE, and a closure is not one, so the
  // `if (!L) return` guard drops them with no branch of their own. Its art hangs off the
  // CARD instead of a level, and with no art it falls to the glam shot of the world the
  // contract just delivered to — which is the best possible default for a closure.
  const li = +infoCard.slice(5); // NaN on 'verdict' — see above; the readings read it too
  const L = LEVELS[li];
  const artOf = L || c;
  const Rc = R * 0.965;              // the mask: just inside the border ring
  // THE ART'S BOTTOM EDGE. A closure stops its picture a little higher than a mission does:
  // the mission spends the band below on readings and only needs its plate's worth, while a
  // closure's line sets in that band in the open and wants room to breathe. Measured on a
  // phone, where everything scales but two rows of type still take 0.16R — at 0.34 the line
  // cleared TAP TO CONTINUE by 13px, which fits but reads cramped.
  const artB = g.cy + R * (infoCard === 'verdict' ? 0.26 : 0.34);
  const half = y => Math.sqrt(Math.max(1, Rc * Rc - y * y)); // the chord, half-width
  // THE CLOSURE HAS NO BAR. A verdict fires once per campaign and carries no readings, so
  // the entire band between the picture and TAP TO CONTINUE is empty — the line sets down
  // there in the open, and the picture keeps all of itself. Only a mission disc still needs
  // the plate, because that band is where its LANE LENGTH and DETECTED THREATS live.
  const isClosure = infoCard === 'verdict';
  const clrTop = artB + R * 0.13;                    // where a closure's first row's ink starts
  const clrBot = g.cy + R * TAP_K - R * 0.11;        // …and the floor the hint leaves it
  // measure the line FIRST — the bar is sized by its own wrap, and its width is the disc's
  // chord at its lowest point, not a panel edge
  const body = c.line || (c.lines || []).join(' ');
  // NO CEILING. This used to be min(16, R*0.095), which meant the line sat at 0.044R on a
  // desktop against 0.097R on a phone — less than half the relative size, on a disc where
  // everything else already scales with R. The readings immediately below it were 38px while
  // the line above them was 16. Now the line scales like the rest of the disc, so the type
  // reads the same at every size; the 10px floor stays, since that one is about legibility.
  let ls = Math.max(10, Math.round(R * 0.095)), rows = [], tw = 0;
  for (;;) {
    ctx.font = '500 ' + ls + 'px Audiowide, system-ui';
    // the chord at the LOWEST row either way, so no row runs into the rim
    tw = (isClosure ? half(R * 0.64) : half(R * 0.34)) * 2 - R * 0.16;
    rows = wrapRows(body, tw);
    // DOES THE BLOCK FIT THE BAND — asked directly, not converted into a row count. Counting
    // rows as floor(band / lineHeight) + 1 ignores the first row's cap height, which on a
    // phone is most of a line: it green-lit three rows and the last one sat on top of TAP TO
    // CONTINUE. Deriving it also beats picking a number, since the same disc is 2 rows on a
    // phone and 5 on a tablet.
    const fits = isClosure
      ? (rows.length - 1) * (ls + 5) + ls * 0.9 <= clrBot - clrTop
      : rows.length <= 2;
    if (fits || ls <= 9) break;
    ls--;
  }
  // THE PLATE, CAPPED AS A SHARE OF THE PICTURE. BAR_SCALE gives it 1.5x the height its rows
  // strictly need, which is right on a big disc — but on a phone the same multiplier put it
  // over 42% of the art box against a desktop's 30%. The plate is not disproportionate by
  // accident: its padding (16) and leading (+5) are absolute px, so on a small disc they are
  // a far larger share of it. Rather than tune a second multiplier, state the rule — the
  // plate may not take more than a third of the keyframe, or the keyframe stops being the
  // point. (The spec's own ceiling is 28%; a third is the outside of that.) The floor keeps
  // the clamp from ever cutting into the ink it exists to hold.
  const lh = ls + 5;
  const aTop = g.cy - Rc, aH = artB - aTop;
  const bh = isClosure ? 0 : Math.max(
    (rows.length - 1) * lh + ls * 1.5,
    Math.min((rows.length * lh + 16) * BAR_SCALE, aH * 0.33));
  ctx.save();
  ctx.beginPath(); ctx.arc(g.cx, g.cy, Rc, 0, TAU); ctx.clip();
  const im = discArtImg(artOf);
  if (im) { // cover-fit the keyframe across the full disc width
    const s = Math.max(Rc * 2 / im.w, aH / im.h);
    ctx.drawImage(im.img, g.cx - im.w * s / 2, aTop + aH / 2 - im.h * s / 2, im.w * s, im.h * s);
  } else { // no keyframe on disk yet — a GLAM SHOT of where this lane delivers
    drawDiscWorld(g, Rc, aTop, aH, bh, L);
  }
  // the grade the ENGINE adds, so 40 authored keyframes read as one show: the
  // relay's tint, scanlines, a vignette. Art ships clean — see the disc spec.
  if (L && L.tint) { ctx.fillStyle = 'rgba(' + L.tint + ',0.13)'; ctx.fillRect(g.cx - Rc, aTop, Rc * 2, aH); }
  ctx.fillStyle = 'rgba(2,6,14,0.22)';
  for (let sy = aTop + (Math.floor(time * 8) % 3); sy < artB; sy += 3) ctx.fillRect(g.cx - Rc, sy, Rc * 2, 1);
  const vg = ctx.createRadialGradient(g.cx, aTop + aH * 0.42, aH * 0.3, g.cx, aTop + aH * 0.42, Rc * 1.05);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(2,5,12,0.62)');
  ctx.fillStyle = vg; ctx.fillRect(g.cx - Rc, aTop, Rc * 2, aH);
  // the caption bar rides the art's lower edge, full disc width — the mask gives
  // it curved ends, so it reads as part of the disc rather than a floating panel
  const bTop = artB - bh;            // a closure's bh is 0, so this IS the art's edge
  if (!isClosure) {
    const cg = ctx.createLinearGradient(g.cx, bTop, g.cx, artB);
    cg.addColorStop(0, 'rgba(3,7,16,0.80)');
    cg.addColorStop(0.35, 'rgba(3,7,16,0.94)');
    cg.addColorStop(1, 'rgba(3,7,16,0.94)');
    ctx.fillStyle = cg; ctx.fillRect(g.cx - Rc, bTop, Rc * 2, bh);
  }
  ctx.restore();
  // the art covered the disc's rim — lay the ring and its accent arcs back over
  ctx.strokeStyle = 'rgba(120,200,255,0.3)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(g.cx, g.cy, R * 0.97, 0, TAU); ctx.stroke();
  ctx.strokeStyle = 'rgba(140,230,255,0.75)'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
  for (let k = 0; k < 4; k++) {
    const a = k / 4 * TAU + Math.PI / 4 + time * 0.15;
    ctx.beginPath(); ctx.arc(g.cx, g.cy, R * 0.97, a - 0.22, a + 0.22); ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(140,230,255,0.20)'; ctx.lineWidth = 1; // art meets caption
  ctx.beginPath();
  ctx.moveTo(g.cx - half(artB - g.cy), artB - 0.5);
  ctx.lineTo(g.cx + half(artB - g.cy), artB - 0.5);
  ctx.stroke();
  // the line fades in a character at a time — see LINE_STAGGER for why, and for what
  // this replaced
  const t3 = time - infoShownAt;
  ctx.font = '500 ' + ls + 'px Audiowide, system-ui';
  // INK-CENTRED, not baseline-pinned: measure a row's real ascent and descent so the
  // block sits on the bar's middle. Pinning to the baseline reads high, which is exactly
  // what the taller bar would have made obvious.
  const m3 = ctx.measureText(rows[0] || 'M');
  const asc3 = m3.actualBoundingBoxAscent, desc3 = m3.actualBoundingBoxDescent;
  const capH = (typeof asc3 === 'number' && asc3 > 0) ? asc3 : ls * 0.72;
  const dscH = (typeof desc3 === 'number' && desc3 > 0) ? desc3 : ls * 0.06;
  const inkH = (rows.length - 1) * lh + capH + dscH;
  // a closure sets from the top of its free band; a mission centres in its plate
  const base0 = isClosure
    ? clrTop + Math.max(0, (clrBot - clrTop - inkH) / 2) + capH   // centred in the band
    : bTop + (bh - inkH) / 2 + capH;
  ctx.textAlign = 'left';
  let ci = 0, lastA = -1;
  for (let i = 0; i < rows.length; i++) {
    const ln = rows[i], xs = charXs(ln, ctx.font), y = base0 + i * lh;
    const x0 = g.cx - xs[ln.length] / 2;
    for (let j = 0; j < ln.length; j++) {
      const a = clamp((t3 - LINE_LEAD - ci * LINE_STAGGER) / LINE_FADE, 0, 1);
      ci++;
      if (a < 0.005 || ln[j] === ' ') continue;
      // 20 alpha buckets, so a settled line costs ONE fillStyle string instead of ninety
      const q = Math.round(a * 20) / 20;
      if (q !== lastA) { ctx.fillStyle = 'rgba(222,242,255,' + (0.96 * q).toFixed(3) + ')'; lastA = q; }
      ctx.fillText(ln[j], x0 + xs[j], y);
    }
    ci++; // the wrap ate a space — keep the stagger running across the break
  }
  ctx.textAlign = 'center';
  if (!L) return;
  // the readings: the number, its name under it in a quieter size
  const numY = artB + R * 0.17, labY = numY + R * 0.10;
  const numPx = Math.max(11, Math.round(R * 0.105));
  // EVEN THREE WAYS. These two labels are different lengths, so a shared column offset
  // cannot give them equal margins — DETECTED THREATS ended up 12px off the rim while
  // LANE LENGTH sat 52px off its own side, which is the lopsidedness this fixes.
  //
  // Solved rather than nudged: the row's slack is (chord*2 - wL - wR), split three ways
  // between the left margin, the gap between the columns and the right margin. Equal
  // margins AND an equal centre gap, at any disc size and whatever the labels say. It
  // lands LANE LENGTH within a few px of where it already was and brings DETECTED THREATS
  // in off the rim, which is exactly the move asked for.
  //
  // The widest pair also picks the size, the way the end screen's telemetry does: fitting
  // and then drawing anyway is how labels end up touching a divider on a small phone.
  const chord = half(labY - g.cy);
  const MIN_SLACK = R * 0.055;   // …below which the row is too tight and the type shrinks
  let labPx = Math.max(7, Math.round(R * 0.055)), wL = 0, wR = 0;
  for (;;) {
    ctx.font = '700 ' + labPx + 'px Audiowide, system-ui';
    try { ctx.letterSpacing = '0.5px'; } catch (e) {} // BEFORE the measure, or the fit is
    wL = ctx.measureText('LANE LENGTH').width;        // computed against a narrower string
    wR = ctx.measureText('DETECTED THREATS').width;
    try { ctx.letterSpacing = '0px'; } catch (e) {}
    if (chord * 2 - wL - wR >= MIN_SLACK * 3 || labPx <= 6) break;
    labPx--;
  }
  const slack = Math.max(MIN_SLACK, (chord * 2 - wL - wR) / 3);
  // the readings COUNT UP on arrival: a number that lands, rather than one that was
  // already sitting there when the disc opened. Same clock as the line's fade.
  const rise = 1 - Math.pow(1 - clamp((t3 - STAT_LEAD) / STAT_RISE, 0, 1), 3);
  const stat = (dx, num, label, col) => {
    ctx.font = '700 ' + numPx + 'px Audiowide, system-ui';
    ctx.fillStyle = col;
    ctx.fillText(num, g.cx + dx, numY);
    try { ctx.letterSpacing = '0.5px'; } catch (e) {}
    ctx.font = '700 ' + labPx + 'px Audiowide, system-ui';
    ctx.fillStyle = 'rgba(146,192,232,0.68)';
    ctx.fillText(label, g.cx + dx, labY);
    try { ctx.letterSpacing = '0px'; } catch (e) {}
  };
  stat(-chord + slack + wL / 2, Math.round(L.duration * rise) + 's', 'LANE LENGTH', 'rgba(230,246,255,0.94)');
  stat(chord - slack - wR / 2, String(Math.round(levelThreats(L, li) * rise)), 'DETECTED THREATS', 'rgba(255,210,74,0.96)');
}

// TAP TO FIRE rides the charged pad during the hold
// a tutorial label that rides an enemy's ANGLE but stays clear of the bore
// center: placed just outside the body, but never nearer than minR to the
// axis, so a deep (near-center) enemy's label doesn't pile onto it
function drawRideLabel(text, en, col) {
  const g2 = geo();
  const rg2 = ring(Math.max(en.z, 0.02), g2);
  const off = Math.min(W, H) * (0.075 + Math.sin(time * 4) * 0.006);
  const R = Math.max(rg2.r + off, Math.min(W, H) * 0.26);
  drawTutText(text, g2.cx + Math.cos(en.angle) * R, g2.cy + Math.sin(en.angle) * R,
    col, Math.round(Math.min(W, H) * 0.028));
}
function drawTutText(text, x, y, col, px) { // one pulsing outlined line
  ctx.save();
  ctx.font = '700 ' + px + 'px Audiowide, system-ui';
  // a long label on a trap out at the 3 or 9 o'clock rim would run off the
  // edge — hold it inside the safe area, the way the pulse prompt does
  const halfT = ctx.measureText(text).width / 2 + 6;
  x = clamp(x, SAFE.l + halfT, W - SAFE.r - halfT);
  y = clamp(y, SAFE.t + px, H - SAFE.b - px);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  ctx.globalAlpha = 0.8 + Math.sin(time * 5) * 0.2;
  ctx.strokeStyle = 'rgba(2,4,12,0.85)'; ctx.lineWidth = 4;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = col;
  ctx.fillText(text, x, y);
  ctx.restore();
}

// the gesture ghost: a comet laps the dial rim in the drill direction — it
// teaches the THUMB MOTION itself, not just the goal (blue clockwise, white
// counter, matching the lap meters)
function drawDialComet(i, dir) {
  const d = dialCenter(i === 0 ? 'L' : 'R');
  const w = dir || (i === 0 ? 1 : -1);
  const col = NODE_COLS[i];
  const a = -Math.PI / 2 + time * 2.2 * w;
  for (let k = 0; k < 7; k++) {
    const ta = a - w * k * 0.11;
    ctx.globalAlpha = (1 - k / 7) * 0.75;
    ctx.fillStyle = 'rgba(' + col + ',1)';
    ctx.beginPath();
    ctx.arc(d.x + Math.cos(ta) * d.r, d.y + Math.sin(ta) * d.r, Math.max(1.5, 4.5 - k * 0.55), 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// marching dashed arc from a node toward the tutorial trap, with an arrowhead.
// col overrides the node's color — barriers guide in NEUTRAL cyan because
// either node may take either end; a colored lead would read as an assignment
function drawGuideArc(n, targetA, col) {
  const g2 = geo();
  const rr = g2.nodeR - Math.min(W, H) * 0.055 * 2.0;
  const d = angDiff(targetA, n.angle);
  if (Math.abs(d) < 0.3) return; // close enough — no guide needed
  const dir = Math.sign(d);
  const a0 = n.angle + dir * 0.12, a1 = n.angle + d * 0.82;
  const blue = n === nodes[0]; // arc wears its node's color so pupils know whose lead it is
  ctx.save();
  ctx.strokeStyle = col || (blue ? 'rgba(95,150,255,0.9)' : 'rgba(255,255,255,0.8)');
  ctx.lineWidth = 3;
  ctx.setLineDash([9, 9]);
  ctx.lineDashOffset = -time * 60 * dir;
  ctx.beginPath(); ctx.arc(g2.cx, g2.cy, rr, a0, a1, dir < 0); ctx.stroke();
  ctx.setLineDash([]);
  const hx = g2.cx + Math.cos(a1) * rr, hy = g2.cy + Math.sin(a1) * rr;
  ctx.translate(hx, hy); ctx.rotate(a1 + dir * Math.PI / 2);
  ctx.fillStyle = col || (blue ? 'rgba(150,190,255,0.95)' : 'rgba(255,255,255,0.95)');
  ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(-5, -6); ctx.lineTo(-5, 6); ctx.closePath(); ctx.fill();
  ctx.restore();
}

// QUALIFIED ceremony: lock-in pulses ripple out from the bore and the stamp
// settles in — the boot ceremony's language, closing the loop it opened
function drawQualCeremony(t) {
  const g2 = geo();
  for (const [d, col] of [[0, '140,230,255'], [0.35, '255,255,255']]) {
    const q = clamp((t - d) / 1.1, 0, 1);
    if (q <= 0 || q >= 1) continue;
    ctx.strokeStyle = 'rgba(' + col + ',' + (0.5 * (1 - q)).toFixed(2) + ')';
    ctx.lineWidth = 3 - q * 2;
    ctx.beginPath(); ctx.arc(g2.cx, g2.cy, g2.nodeR * (1 + q * 0.75), 0, TAU); ctx.stroke();
  }
  const q2 = clamp((t - 0.3) / 0.5, 0, 1);
  if (q2 <= 0) return;
  const s = 1 + 0.5 * Math.pow(1 - q2, 2); // stamps down from oversized
  const al = q2 * (t > 2.9 ? clamp((3.4 - t) / 0.5, 0, 1) : 1);
  ctx.save();
  ctx.translate(g2.cx, g2.cy); ctx.scale(s, s);
  ctx.textAlign = 'center';
  try { ctx.letterSpacing = '6px'; } catch (e) {}
  const fs = fitPx('QUALIFIED', 700, Math.round(g2.nodeR * 0.30), g2.nodeR * 1.7, 12);
  ctx.font = '700 ' + fs + 'px Audiowide, system-ui';
  ctx.shadowColor = 'rgba(120,225,255,0.8)'; ctx.shadowBlur = lowFX ? 0 : 22 * al;
  ctx.fillStyle = 'rgba(228,249,255,' + al.toFixed(2) + ')';
  ctx.fillText('QUALIFIED', 0, -fs * 0.1);
  ctx.shadowBlur = 0;
  try { ctx.letterSpacing = '2px'; } catch (e) {}
  // TWO FITTED LINES, and the fitting is the fix. This subtitle was drawn at a flat
  // fs * 0.32 with no fitPx — it held together only because 'THE LANE IS YOURS TO CLEAR'
  // happened to be short enough, so any longer replacement ran off the stamp. Split at the
  // colon clause it reads as a stamp rather than a sentence, which is what this moment is.
  const sub = ['CERTIFICATION: PASSED', 'CLEARED FOR WARP'];
  const ss = Math.max(8, Math.min(...sub.map(l =>
    fitPx(l, 700, Math.round(fs * 0.32), g2.nodeR * 1.7, 8))));
  ctx.font = '700 ' + ss + 'px Audiowide, system-ui';
  ctx.fillStyle = 'rgba(150,215,240,' + (al * 0.9).toFixed(2) + ')';
  sub.forEach((l, i) => ctx.fillText(l, 0, fs * 0.72 + i * (ss + 5)));
  try { ctx.letterSpacing = '0px'; } catch (e) {}
  ctx.textAlign = 'left';
  ctx.restore();
}

// tutorial dock spot: a half-blue/half-white disc on the rim where BOTH
// nodes must meet — the heavy drill's destination, split like its crew
function drawDockSpot(a) {
  const g2 = geo();
  const px = g2.cx + Math.cos(a) * g2.nodeR, py = g2.cy + Math.sin(a) * g2.nodeR;
  const r = Math.min(W, H) * 0.024;
  ctx.save();
  ctx.translate(px, py); ctx.rotate(a); // the split rides the rim's radial axis
  ctx.fillStyle = 'rgba(77,141,255,0.85)';
  ctx.beginPath(); ctx.arc(0, 0, r, Math.PI / 2, Math.PI * 1.5); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath(); ctx.arc(0, 0, r, -Math.PI / 2, Math.PI / 2); ctx.fill();
  ctx.strokeStyle = 'rgba(200,240,255,0.75)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(0, 0, r * (1.3 + Math.sin(time * 5) * 0.12), 0, TAU); ctx.stroke();
  ctx.restore();
}

// tutorial parking spot: a dashed ring on the rim in the color of the node
// meant to fill it (the barrier drill's two ends)
function drawParkSpot(a, col) {
  const g2 = geo();
  const px = g2.cx + Math.cos(a) * g2.nodeR, py = g2.cy + Math.sin(a) * g2.nodeR;
  const r = Math.min(W, H) * 0.028 * (1 + Math.sin(time * 5) * 0.08);
  ctx.save();
  ctx.strokeStyle = col; ctx.lineWidth = 2.5;
  ctx.setLineDash([5, 4]); ctx.lineDashOffset = -time * 20;
  ctx.beginPath(); ctx.arc(px, py, r, 0, TAU); ctx.stroke();
  ctx.restore();
}

// mini landing signal for tutorial node killers, in the rim wall's hazard
// language: once a defender has been fried by one, killers telegraph the arc
// they'll land on — the drill becomes DODGE, not decode
function drawKillerSignal(e) {
  const g2 = geo();
  const near = 1 - clamp((e.z - 1) / (SPAWN_Z - 1), 0, 1); // 0 far → 1 landing
  const span = 0.13, blink = 0.5 + 0.5 * Math.sin(time * 9);
  ctx.save();
  ctx.lineCap = 'butt';
  // soft underglow, then striped hazard ticks — sharper as it closes in
  ctx.strokeStyle = 'rgba(255,120,40,' + (0.10 + 0.16 * near).toFixed(2) + ')';
  ctx.lineWidth = 11;
  ctx.beginPath(); ctx.arc(g2.cx, g2.cy, g2.nodeR, e.angle - span, e.angle + span); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,150,60,' + ((0.35 + 0.45 * near) * (0.55 + 0.45 * blink)).toFixed(2) + ')';
  ctx.lineWidth = 4;
  ctx.setLineDash([6, 5]);
  ctx.lineDashOffset = -time * 30;
  ctx.beginPath(); ctx.arc(g2.cx, g2.cy, g2.nodeR, e.angle - span, e.angle + span); ctx.stroke();
  ctx.restore();
}

// one audio channel row: label · angular toggle · tick-marked slider (shared by pause + menu)
function settingRow(label, key, volKey, y, px, pw, tox) {
  ctx.textAlign = 'left'; ctx.fillStyle = 'rgba(160,225,255,0.95)';
  try { ctx.letterSpacing = '2px'; } catch (e) {}
  ctx.font = '700 12px Audiowide, system-ui';
  ctx.fillText(label, px + 24, y + 4);
  try { ctx.letterSpacing = '0px'; } catch (e) {}
  // angular toggle slab — column sits clear of the widest Audiowide label
  const tx = px + (tox || 162), tw = 52, th = 24, on = settings[key];
  techRect(tx, y - th / 2, tw, th, 6);
  ctx.fillStyle = on ? 'rgba(40,140,210,0.55)' : 'rgba(255,255,255,0.06)'; ctx.fill();
  ctx.strokeStyle = on ? 'rgba(140,230,255,0.8)' : 'rgba(120,180,255,0.3)'; ctx.lineWidth = 1.5;
  techRect(tx, y - th / 2, tw, th, 6); ctx.stroke();
  const ks = th - 9;
  ctx.fillStyle = on ? '#dff6ff' : 'rgba(160,190,230,0.45)';
  ctx.fillRect(on ? tx + tw - ks - 4.5 : tx + 4.5, y - ks / 2, ks, ks);
  pauseTogglesList.push({ x: tx, y: y - th / 2, w: tw, h: th, key });
  if (!volKey) return; // toggle-only row (e.g. haptics)
  // volume rail with depth ticks and a diamond cursor
  const sx = tx + tw + 26, sw2 = px + pw - 36 - sx;
  ctx.lineCap = 'butt';
  ctx.strokeStyle = 'rgba(120,200,255,0.16)'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(sx, y); ctx.lineTo(sx + sw2, y); ctx.stroke();
  ctx.strokeStyle = 'rgba(120,200,255,0.35)'; ctx.lineWidth = 1;
  for (let i = 0; i <= 8; i++) {
    const tx2 = sx + sw2 * i / 8;
    ctx.beginPath(); ctx.moveTo(tx2, y + 6); ctx.lineTo(tx2, y + 10); ctx.stroke();
  }
  const v = settings[volKey];
  ctx.strokeStyle = on ? 'rgba(111,227,255,0.9)' : 'rgba(120,150,200,0.3)'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(sx, y); ctx.lineTo(sx + sw2 * v, y); ctx.stroke();
  ctx.save();
  ctx.translate(sx + sw2 * v, y); ctx.rotate(Math.PI / 4);
  ctx.fillStyle = on ? '#eafaff' : 'rgba(200,210,230,0.5)';
  ctx.fillRect(-6, -6, 12, 12);
  ctx.strokeStyle = on ? 'rgba(111,227,255,0.9)' : 'rgba(160,190,230,0.4)'; ctx.lineWidth = 1.5;
  ctx.strokeRect(-6, -6, 12, 12);
  ctx.restore();
  ctx.lineCap = 'round';
  pauseSlidersList.push({ x: sx, y, w: sw2, key: volKey });
}
// shared toggle/slider hit test — returns true if the tap landed on a control
function settingsTap(x, y, pid) {
  for (const t of pauseTogglesList) {
    if (x > t.x - 8 && x < t.x + t.w + 8 && y > t.y - 8 && y < t.y + t.h + 8) {
      settings[t.key] = !settings[t.key];
      applySettings(); pressUI(t); return true;
    }
  }
  for (const s of pauseSlidersList) {
    if (x > s.x - 14 && x < s.x + s.w + 14 && Math.abs(y - s.y) < 20) {
      settings[s.key] = clamp((x - s.x) / s.w, 0, 1); applySettings();
      pauseDrag[pid] = s; return true;
    }
  }
  return false;
}

// ---------- popup glitch-build (the panel de-rezzes IN, like a decompiled body) --
// Reuses the run's decompile language (see drawGhost): while a panel opens or
// closes it renders to an offscreen buffer and blits back as horizontal strips
// that fly in from a sideways offset, flicker, and lock — the reverse of an
// enemy tearing apart. q eases 0..1 toward the panel's open flag; at q>=1 the
// panel draws straight to screen, crisp. Drawers wrap their panel body in
// popRender(); the full-screen dim stays outside it (never glitched).
const POPFX = {};
const POP_STRIPS = 22;           // horizontal slices the panel resolves in as
// deterministic per-index noise — NO Math.random(): draw must not touch the
// seeded sim stream (a panel can be dissolving during a live PLAY frame).
const popFrac = n => { const x = Math.sin(n * 12.9898) * 43758.5453; return x - Math.floor(x); };
function popFxQ(key, flag) {
  const e = POPFX[key] || (POPFX[key] = { q: 0 });
  e.q = clamp(e.q + (flag ? 1 : -1) * frameDt / 0.26, 0, 1); // ~0.26s each way — a touch longer so the build reads
  return e.q;
}
const popLive = key => !!POPFX[key] && POPFX[key].q > 0;
function popReset() { for (const k in POPFX) POPFX[k].q = 0; } // hard-clear so a panel can't linger open across a state change

let popBuf = null; // offscreen the panel is captured into during the transition
function popEnsureBuf() { // sized to DEVICE pixels so captured text stays crisp on retina
  const w = Math.max(1, Math.ceil(W * DPR)), h = Math.max(1, Math.ceil(H * DPR));
  if (!popBuf) popBuf = document.createElement('canvas');
  if (popBuf.width !== w || popBuf.height !== h) { popBuf.width = w; popBuf.height = h; }
  return popBuf;
}
// Draw `content` (the panel's crisp pixels, in game-space coords) and present it
// with the glitch build/dissolve. px,py,pw,ph bound the panel; a margin captures
// borders + edge glow. At q>=1 content() is drawn straight to screen (crisp).
function popRender(q, px, py, pw, ph, content) {
  if (q >= 1) { content(); return; }                 // settled — no glitch, full sharpness
  const M = 22;                                       // capture margin for borders / edge bars
  const rx = Math.max(0, Math.floor(px - M)), ry = Math.max(0, Math.floor(py - M));
  const rw = Math.min(Math.ceil(W) - rx, Math.ceil(pw + M * 2)), rh = Math.min(Math.ceil(H) - ry, Math.ceil(ph + M * 2));
  const buf = popEnsureBuf(), b = buf.getContext('2d');
  b.setTransform(DPR, 0, 0, DPR, 0, 0);               // panel painted in game coords at device resolution (crisp)
  b.clearRect(rx, ry, rw, rh);
  const prev = ctx; ctx = b;                          // redirect the panel painters into the buffer
  try { content(); } finally { ctx = prev; }
  // content() ALSO registers the panel's tap targets, so it must run every frame
  // the panel is drawn — including the opening/closing frames where q≤0 (the
  // caller clears its hit-lists at the top and repopulates them in content). Only
  // the visible blit below is gated on q>0, so a closed panel shows nothing.
  if (q <= 0) return;
  // blit back as strips: each flies in from a sideways offset, flickers, and locks.
  // source rects are in DEVICE px (buf space); dest rects in game px (main ctx scales them).
  const n = POP_STRIPS, sh = rh / n, D = DPR;
  for (let i = 0; i < n; i++) {
    const t0 = popFrac(i + 1) * 0.5;                  // scrambled start; wide overlap = smooth stream, not a sweep
    const a = clamp((q - t0) / 0.5, 0, 1);            // 0 = not yet, 1 = locked
    if (a <= 0) continue;
    const ease = 1 - Math.pow(1 - a, 3);              // ease-out cubic: strips decelerate into place
    const dir = popFrac(i * 3.7) < 0.5 ? -1 : 1;      // fly in from alternating sides
    const jx = (1 - ease) * dir * rw * 0.55;          // sideways offset collapses to 0
    const fl = a < 0.92 ? (0.55 + 0.45 * popFrac(i * 5.1 + Math.floor(time * 32))) : 1; // flicker only mid-flight
    const sy = ry + i * sh, srcY = sy * D, srcH = sh * D, srcX = rx * D, srcW = rw * D;
    ctx.save();
    // chromatic fringe while travelling — a doubled ghost + cyan/magenta edges, fading as it locks
    const split = (1 - ease) * 9;
    if (split > 0.6) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = ease * fl * 0.45;
      ctx.drawImage(buf, srcX, srcY, srcW, srcH, rx + jx - split, sy, rw, sh);
      ctx.drawImage(buf, srcX, srcY, srcW, srcH, rx + jx + split, sy, rw, sh);
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = 'rgba(0,200,255,0.35)';  ctx.fillRect(rx + jx - split, sy, 2, sh);
      ctx.fillStyle = 'rgba(255,40,120,0.32)'; ctx.fillRect(rx + jx + rw - 2 + split, sy, 2, sh);
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = ease * fl;
    ctx.drawImage(buf, srcX, srcY, srcW, srcH, rx + jx, sy, rw, sh); // the strip itself
    if (a < 0.85) { // a hot leading edge rides each strip mid-flight (the print head)
      ctx.globalAlpha = (1 - a) * 0.7;
      ctx.fillStyle = 'rgba(160,245,255,0.9)';
      ctx.fillRect(rx + jx, sy, rw, 1.4);
    }
    ctx.restore();
  }
}

function drawPause() {
  const q = popFxQ('pause', state === S.PAUSE);
  pauseButtonsList = []; pauseSlidersList = []; pauseTogglesList = [];
  ctx.fillStyle = 'rgba(3,6,14,' + (0.78 * q).toFixed(2) + ')'; ctx.fillRect(0, 0, W, H);
  const pw = Math.min(W * 0.74, 540), ph = Math.min(H * 0.86, 300);
  const px = W / 2 - pw / 2, py = H / 2 - ph / 2;
  popRender(q, px, py, pw, ph, () => {
    ctx.save();
    techPanel(px, py, pw, ph, 'SYSTEM PAUSED');
    // the FIELD GUIDE key rides the header bar — one tap away
    const gk = { x: px + pw - 44, y: py + 6, w: 30, h: 20, action: 'guide', cut: 5 };
    techRect(gk.x, gk.y, gk.w, gk.h, 5);
    ctx.fillStyle = 'rgba(30,120,190,0.30)'; ctx.fill();
    ctx.strokeStyle = 'rgba(140,230,255,0.75)'; ctx.lineWidth = 1.2;
    techRect(gk.x, gk.y, gk.w, gk.h, 5); ctx.stroke();
    ctx.fillStyle = '#dff6ff'; ctx.font = '700 12px Audiowide, system-ui'; ctx.textAlign = 'center';
    ctx.fillText('?', gk.x + gk.w / 2, gk.y + 14.5);
    ctx.textAlign = 'left';
    settingRow('SFX',        'sound',     'soundVol', py + 70,  px, pw);
    settingRow('MUSIC',      'music',     'musicVol', py + 108, px, pw);
    settingRow('HAPTICS',    'haptics',   null,       py + 146, px, pw);
    // TRACK: the run's music, named and skippable — the only place the player can
    // change it, because here the world is frozen and a mistap costs nothing. (It
    // took the slot a decorative console readout used to hold.)
    const trkRow = typeof runTrack === 'number' && trackCount() > 1 ? py + 188 : 0;
    if (trkRow) {
      ctx.textAlign = 'left'; ctx.fillStyle = 'rgba(160,225,255,0.95)';
      try { ctx.letterSpacing = '2px'; } catch (e) {}
      ctx.font = '700 12px Audiowide, system-ui';
      ctx.fillText('TRACK', px + 24, trkRow + 4);
      try { ctx.letterSpacing = '0px'; } catch (e) {}
      const kw = 30, kh = 24, kx0 = px + 162, kx1 = px + pw - 36 - kw;
      for (const [kx, glyph] of [[kx0, '◀'], [kx1, '▶']]) {
        techRect(kx, trkRow - kh / 2, kw, kh, 6);
        ctx.fillStyle = 'rgba(40,140,210,0.35)'; ctx.fill();
        ctx.strokeStyle = 'rgba(140,230,255,0.7)'; ctx.lineWidth = 1.5;
        techRect(kx, trkRow - kh / 2, kw, kh, 6); ctx.stroke();
        ctx.fillStyle = '#dff6ff'; ctx.font = '10px system-ui'; ctx.textAlign = 'center';
        ctx.fillText(glyph, kx + kw / 2, trkRow + 4);
      }
      const nx0 = kx0 + kw + 8, nw = kx1 - 8 - nx0;
      const nm = trackName(runTrack) || 'TRACK ' + (runTrack + 1);
      ctx.textAlign = 'center';
      ctx.font = '700 ' + fitPx(nm, '700', 12, nw, 8) + 'px Audiowide, system-ui';
      ctx.fillStyle = settings.music ? 'rgba(234,250,255,0.95)' : 'rgba(150,180,210,0.45)';
      ctx.fillText(nm, nx0 + nw / 2, trkRow + 4);
      ctx.textAlign = 'left';
    }

    const bh = 44, gap = 12, bw = (pw - 48 - gap * 2) / 3;
    let bx = px + 24; const by = py + ph - bh - 20;
    [['RESUME', 'resume', true], ['RESTART', 'restart', false], ['QUIT', 'menu', false]].forEach(([label, action, primary]) => {
      button(bx, by, bw, bh, label, primary);
      pauseButtonsList.push({ x: bx, y: by, w: bw, h: bh, action, cut: Math.min(12, bh * 0.28) });
      bx += bw + gap;
    });
    // registered AFTER the three main keys so RESUME keeps the pad focus
    pauseButtonsList.push(gk);
    if (trkRow) {
      const kw = 30, kh = 24;
      pauseButtonsList.push({ x: px + 162, y: trkRow - kh / 2, w: kw, h: kh, action: 'trkPrev', cut: 6 });
      pauseButtonsList.push({ x: px + pw - 36 - kw, y: trkRow - kh / 2, w: kw, h: kh, action: 'trkNext', cut: 6 });
    }
    ctx.restore();
  });
  ctx.textAlign = 'left';
}

// step the run's soundtrack by hand. Walks the pool in order (not the bag) so
// ◀/▶ are predictable, and drops any free-flow preload — the seam is now measured
// from THIS take, not the one the player just left.
function skipTrack(dir) {
  const n = trackCount();
  if (typeof runTrack !== 'number' || n < 2) return;
  runTrack = ((runTrack + dir) % n + n) % n;
  dropPreload();
  playTrack(runTrack);
}
function pauseTap(x, y, pid) {
  if (settingsTap(x, y, pid)) return;
  for (const b of pauseButtonsList) {
    if (x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h) {
      pressUI(b);
      if (b.action === 'guide') { enterGuide('pause'); }
      else if (b.action === 'trkPrev' || b.action === 'trkNext') skipTrack(b.action === 'trkNext' ? 1 : -1);
      else if (b.action === 'resume') {
        // paused over the mission disc: hand the briefing back, no count-in —
        // the world under it was never running
        if (pausedFromInfo) { pausedFromInfo = false; state = S.INFO; }
        else { state = S.PLAY; resumeHold = 0.9; resumeDigit = 0; }
      }
      else if (b.action === 'restart') { pausedFromInfo = false; if (qual) startQualification(); else if (weekly) startWeekly(); else if (endless) startEndless(); else startLevel(levelIdx); }
      else { // QUIT rides the same drive-back the end-screen MENU key uses
        pausedFromInfo = false;
        weekly = false; Math.random = sysRandom;
        // training lives in Story Mode now → zoom back out onto its disc
        if (qual) { menuScreen = 'camps'; campScroll = campScrollTgt = 0; campPendingSync = null; }
        else menuScreen = endless ? 'flow' : 'map';
        if (!endless && !qual) mapSel = Math.min(PROG.unlocked - 1, LEVELS.length - 1);
        state = S.MENU; fadeT = 0.35;
        menuFx = qual ? { kind: 'discOut', t: 0, dur: 0.55, disc: 0 } // the training disc recedes into its slot (reverse of the dive-in)
          : menuScreen === 'map' ? { kind: 'panelsIn', t: 0, dur: 0.6, dir: 1, zoom: true }
          : { kind: 'spinIn', t: 0, dur: 0.5, dir: 1, zoom: true };
      }
      return;
    }
  }
}

// ---------- the enlistment (S.ENLIST) ----------
// A VOICE OVER A ROOM. Nothing in this game RENDERS a human — the engine's whole
// cast is machinery, and a modelled person would be the only one and would look
// imported. But an authored keyframe is not the engine: the first disc is a
// painted briefing room, the same kind of picture the forty mission discs are,
// with the channel's own waveform running low over it while he talks.
//
// VANGUARD ACTUAL: in radio convention "Actual" means the commander in person
// rather than the operator holding the handset. The callsign does the work of
// saying who is speaking to you, which is the entire enlistment beat.
//
// HE NEVER NAMES YOU. The player's identity is the handle they type on a
// leaderboard, and a commander who christened them something else would be
// competing with it.
const ENLIST_COL = '235,245,255';       // Lane Command's own colour, from CAMP.factions
const ENLIST_SCAN = 0.52;               // the disc PRINTS in over this — see enlistScanRender
const ENLIST_TYPE = 26;                 // characters per second — a readable transmit rate
const ENLIST_MIN = 0.55;                // a beat cannot be tapped away faster than this
const ENLIST_OUT = 0.7;                 // hand-off fade before the course opens
// The script. Terse-ops register, the same voice the in-run barks use: he is
// briefing a professional, not welcoming a customer — which means SHORT. The
// first draft ran six beats of two full sentences each and read as a manual.
//
// NO CLIENT IS NAMED AND NO CONVOY IS MENTIONED. What rides the lane changes from
// contract to contract, so anything specific said here would be wrong by the second
// one — the lane itself is the only thing this speech can safely be about.
//
// HE NEVER NAMES THE PLAYER. A name would compete with the handle they type on a
// leaderboard, which is the only identity this game gives them. "rookies" is not a
// name and not even singular — it is the room being addressed, which is what the
// first disc's picture shows: a briefing, with more than one recruit in it.
//
// EACH BEAT IS TWO LINES, and the break is authored rather than wrapped — the disc
// sets them exactly as written (see enlistDiscBody), so the split is a pause in his
// delivery, not a consequence of how wide the plate happens to be.
const ENLIST_SCRIPT = [
  ['Welcome to Vanguard Squadron,', 'rookies'],
  ['We protect Warp Lanes.', 'Nothing gets through us!'],
  ['Evaluation course ready.', "Let's see what you're made of."]
];
const ENLIST_SHORT = [
  ['Back on the course.', 'Start when ready.']
];
const enlistScript = () => (enlist && enlist.short) ? ENLIST_SHORT : ENLIST_SCRIPT;
// how long this beat's text takes to type out — the tap gate waits for it, so a
// player can never skip past a line they have not been shown. The scan lead is
// part of the answer because the line does not START until the disc has finished
// printing: leave it out and the gate opens while he is still mid-sentence.
function enlistTypeDur(beat) {
  const ln = enlistScript()[beat];
  if (!ln) return 0;
  return ENLIST_SCAN + ln.join(' ').length / ENLIST_TYPE;
}
// ---------- disc art ----------
// NOTHING HAND-DRAWN, and now nothing hand-LAID-OUT either. These three discs sit
// in a player's memory beside forty real briefings, so they carry the mission
// disc's shape exactly: a picture filling the top of the mask, a caption plate on
// its lower edge, the line inside it. Which is why every painter below is handed
// the WINDOW IT MUST FILL rather than a centre and a radius — a circular vignette
// floating in the middle of a disc is the tell that gave the first pass away.
//
// `covered` is how much of that window's foot the caption plate will take. The
// painters bias their subject up out of it: a kill that lands behind the plate is
// a kill the recruit never sees.

// 1 — THE BRIEFING ROOM, WITH THE CHANNEL LAID OVER IT. This disc carries an
// authored keyframe (`briefing.webp`), loaded through the same LRU the forty
// mission discs use — so the first picture a recruit ever sees is a picture, and
// the spectrum that used to BE the picture is now a comms overlay riding low on
// it. The bands still answer to `live`, which is the typing clock, so the meter
// moves with his sentence and settles the moment he stops.
//
// THE PAINTED CONSOLE IS STILL HERE, underneath, and is not dead code: keyframes
// decode lazily and this disc is on screen within a frame of boot, so the first
// pass through here almost always runs with no image yet. It carries the disc
// until the picture lands, and it is what stands if the file is ever missing.
//
// NO Math.random() ANYWHERE IN HERE. The qualification course is live and parked
// underneath this disc, and its spawns run off a seeded stream — a draw path that
// pulls from Math.random() would desync the replay the leaderboard verifies. Same
// rule as popFrac above; every wobble below is a sine of time and index.
const ENL_BANDS = 34;
// speech, not white noise: three detuned rates beat against each other so no two
// seconds repeat, and a syllable envelope surges the whole meter the way a talking
// voice does. The low bands run hotter than the high ones — a spectrum tilt.
function enlistBand(i, t, live) {
  const n = ENL_BANDS;
  const a = Math.sin(t * 5.9 + i * 0.83);
  const b = Math.sin(t * 3.1 - i * 1.61 + 1.2);
  const c = Math.sin(t * 12.7 + i * 2.27);
  const syll = 0.45 + 0.55 * Math.abs(Math.sin(t * 4.3) * Math.sin(t * 2.1 + 0.6));
  const tilt = 1 - 0.5 * (i / (n - 1));
  const v = Math.abs(a * 0.55 + b * 0.3 + c * 0.15) * syll * tilt;
  // idle is a low carrier hum, not silence — a dead meter reads as a dead channel,
  // and the settled disc is what the player looks at longest while deciding to tap
  return 0.07 + v * (live ? 0.93 : 0.32);
}
let enlShineBuf = null;
// THE LOCKUP, WITH A SPECULAR SWEEP ACROSS THE SHIELD. `source-atop` is what
// confines the band to the artwork's own pixels — but it confines it to whatever
// is already on the canvas, which here is the spectrum. So the badge is composited
// alone in a buffer and blitted whole; painting the band straight onto the disc
// would have put a chrome streak across the waveform behind it.
function enlistShinedLogo(L, x, y, w, h) {
  const D = Math.max(1, DPR || 1);
  const bw = Math.max(1, Math.ceil(w * D)), bh = Math.max(1, Math.ceil(h * D));
  if (!enlShineBuf) enlShineBuf = document.createElement('canvas');
  if (enlShineBuf.width !== bw || enlShineBuf.height !== bh) { enlShineBuf.width = bw; enlShineBuf.height = bh; }
  const b = enlShineBuf.getContext('2d');
  if (!b || !b.setTransform) { ctx.drawImage(L.img, x, y, w, h); return; } // headless — the plain badge stands
  b.setTransform(D, 0, 0, D, 0, 0);
  b.clearRect(0, 0, w, h);
  b.globalCompositeOperation = 'source-over';
  b.drawImage(L.img, 0, 0, w, h);
  // THE SWEEP, AND WHY IT HAS AN ENVELOPE. A band whose position simply wraps
  // modulo the cycle snaps: `time % P` is discontinuous, and the diagonal gradient
  // was still carrying light at both ends of its travel, so every loop showed the
  // glint teleporting back across the shield. Two fixes, and both are needed —
  // the sweep occupies only part of the cycle (a glint is periodic, not constant),
  // and its brightness rides a sine that is ZERO at both ends of that window, so
  // whatever the position does at the wrap there is nothing lit to see move.
  const P = 4.6, SW = 0.40;                     // cycle, and the share of it that sweeps
  const q = (time % P) / P;
  if (q >= SW) return ctx.drawImage(enlShineBuf, 0, 0, bw, bh, x, y, w, h); // resting
  const s = q / SW;                             // 0..1 across the sweep
  const amp = Math.sin(s * Math.PI);            // …lit only in the middle of it
  const gx = (-0.55 + s * 2.1) * w;             // travels from off one edge to off the other
  const gr = b.createLinearGradient(gx, -h * 0.4, gx + w * 0.42, h * 1.4);
  gr.addColorStop(0.00, 'rgba(255,255,255,0)');
  gr.addColorStop(0.38, `rgba(190,232,255,${(0.05 * amp).toFixed(3)})`);
  gr.addColorStop(0.50, `rgba(255,255,255,${(0.46 * amp).toFixed(3)})`);  // the hot line itself
  gr.addColorStop(0.58, `rgba(198,240,255,${(0.16 * amp).toFixed(3)})`);
  gr.addColorStop(1.00, 'rgba(255,255,255,0)');
  b.globalCompositeOperation = 'source-atop';       // metal only — never the space around it
  b.fillStyle = gr;
  b.fillRect(0, 0, w, h);
  b.globalCompositeOperation = 'source-over';
  ctx.drawImage(enlShineBuf, 0, 0, bw, bh, x, y, w, h);
}
const ENLIST_KEYFRAME = 'briefing.webp';  // src/art/disc/ — see that folder's README
// ---------- the holo table, running ----------
// WHERE THE TABLE IS, IN THE PICTURE'S OWN COORDINATES — fractions of the keyframe,
// never of the screen. The caller hands over the rectangle the image was actually
// drawn into, so the push-in below carries all of this with it for free and there is
// exactly one place that knows how the image is fitted.
//
// Measured off the keyframe rather than eyeballed: the file was gridded in normalised
// coordinates and the ellipse read off the grid. If the art is ever regenerated these
// numbers move with it — they are the ONE thing here tied to that particular image.
const HOLO = {
  cx: 0.518, cy: 0.570, rx: 0.168, ry: 0.065,   // the table's lit surface, as an ellipse
  px: 0.506, py: 0.548, pr: 0.030               // the planet standing in the middle of it
};
// PROJECTOR BEHAVIOUR, NOT OBJECT MOTION — and that distinction is the whole design.
// The asteroids in this field are painted into the image and cannot move. Anything
// that ORBITS among them (motes, drifting rocks) would announce that the rest of the
// field is a photograph. A sweep and a projection pulse belong to the machine doing
// the projecting, so they read as the table being ON while its contents hold still.
//
// EVERYTHING IS A SINE OR A MODULO OF THE DISC'S OWN CLOCK. The qualification course
// is parked and live underneath this disc and its spawns run off a seeded stream —
// a draw path that pulled Math.random() would desync the replay the leaderboard
// verifies. Same rule as enlistBand and popFrac; there is no randomness anywhere here.
// THE THREE ALPHAS BELOW (0.14 sweep, 0.20 pulse, 0.15 bloom) ARE THE KNOBS. They
// were set against a tablet-sized disc and then lifted a quarter, because on a phone
// this table is barely 100px across and what read as restraint at that size read as
// nothing at all. Judge them on the device, never on a desktop window.
function enlistHolo(dx, dy, dw, dh, t) {
  const cx = dx + HOLO.cx * dw, cy = dy + HOLO.cy * dh;
  const rx = HOLO.rx * dw, ry = HOLO.ry * dh;
  if (rx < 2 || ry < 1) return;
  // a hologram is never quite steady. Two detuned rates, so the instability never
  // repeats on a countable beat — the same trick enlistBand uses for the same reason.
  const fl = 0.90 + 0.10 * Math.sin(t * 11.3) * Math.sin(t * 4.7);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';   // ADD light to the table, never paint over it
  // the table's own plane: a circle of radius rx, squashed to the ellipse we see it
  // as. Drawing in this space is what keeps the sweep lying ON the table instead of
  // standing up out of it.
  ctx.translate(cx, cy); ctx.scale(1, ry / rx);
  // THE SWEEP, WITH A TAIL. Sliced rather than gradient-filled: a canvas radial
  // gradient fades outward and the fade a radar reads by is ANGULAR, behind the head.
  // …and it is an ANNULUS, not a pie. A wedge that closes on the centre comes to a
  // hard bright point exactly where the planet stands, which is the one part of this
  // hologram that is already the brightest thing on the table.
  const a0 = t * 0.62;                        // radians a second — one turn per ~10s
  const SLICES = 12, TAIL = 1.15, R0 = rx * 0.17, R1 = rx * 0.96;
  for (let i = 0; i < SLICES; i++) {
    const q = i / SLICES;                     // 0 at the head, 1 at the end of the tail
    const al = (1 - q) * (1 - q) * 0.14 * fl;
    const b = a0 - (q + 1 / SLICES) * TAIL, e = a0 - q * TAIL;
    ctx.fillStyle = `rgba(150,235,255,${al.toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(0, 0, R1, b, e);
    ctx.arc(0, 0, R0, e, b, true);
    ctx.closePath(); ctx.fill();
  }
  // TWO PROJECTION PULSES, half a cycle apart, climbing out of the emitter to the
  // rim. The brightness rides a sine that is ZERO at both ends of the travel, so
  // whatever the position does at the wrap there is nothing lit to see jump — the
  // lesson enlistShinedLogo's sweep learned the hard way.
  ctx.lineWidth = Math.max(1, rx * 0.014);
  for (let k = 0; k < 2; k++) {
    const p = ((t / 3.6) + k * 0.5) % 1;
    const al = 0.20 * Math.sin(p * Math.PI) * fl;
    ctx.strokeStyle = `rgba(120,225,255,${al.toFixed(3)})`;
    ctx.beginPath(); ctx.arc(0, 0, rx * (0.14 + p * 0.84), 0, TAU); ctx.stroke();
  }
  ctx.restore();
  // and the planet breathing in the middle of it — in SCREEN space, because a bloom
  // is light in the air above the table rather than something lying on its surface
  const px = dx + HOLO.px * dw, py = dy + HOLO.py * dh, pr = HOLO.pr * dw;
  const br = (0.55 + 0.45 * Math.sin(t * 1.15)) * fl;
  const bg = ctx.createRadialGradient(px, py, pr * 0.2, px, py, pr * 2.8);
  bg.addColorStop(0, `rgba(175,240,255,${(0.15 * br).toFixed(3)})`);
  bg.addColorStop(0.45, `rgba(120,215,255,${(0.07 * br).toFixed(3)})`);
  bg.addColorStop(1, 'rgba(90,190,255,0)');
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = bg;
  ctx.beginPath(); ctx.arc(px, py, pr * 2.8, 0, TAU); ctx.fill();
  ctx.restore();
}
function enlistArtComms(x, y, w, h, covered, live, t) {
  // the console field, painted across the FULL window — the keyframe covers it
  // whole, and until the keyframe is there this IS the picture
  const bgG = ctx.createLinearGradient(x, y, x, y + h);
  bgG.addColorStop(0, 'rgba(10,26,44,0.95)');
  bgG.addColorStop(0.6, 'rgba(4,10,22,0.96)');
  bgG.addColorStop(1, 'rgba(2,6,14,1)');
  ctx.fillStyle = bgG; ctx.fillRect(x, y, w, h);
  // THE KEYFRAME, COVER-FIT — drawStoryDisc's arithmetic, deliberately, so this disc
  // crops its picture the way the forty mission discs crop theirs. `discArtImg`
  // returns null until the file has decoded, and on the frame after boot it usually
  // has not: the painted console below carries the disc until it lands.
  //
  // NO METER OVER THE PICTURE. The spectrum was laid over it at low opacity and tried
  // in three places — on the middle, at the foot of the clear zone, and hugging the
  // caption seam. Low, it dissolved into the holo table's own cyan; high, where it was
  // legible, it was a graph pasted on a photograph. A meter that has to be hidden to be
  // tolerable is not carrying anything. What moves instead is the one thing in the
  // frame that is SUPPOSED to move: the table (enlistHolo), plus the push below.
  //
  // THE PUSH-IN. A still held for the length of a speech is a slide; the same still
  // creeping toward you is a shot. It eases onto an asymptote rather than running out
  // — a move that finishes has a moment where the picture visibly stops, and a recruit
  // who lingers on this beat would spend the rest of it looking at a frozen frame.
  // The cover-fit already throws away 40% of the width, so there is a great deal of
  // frame to push into and nothing new ever enters the mask.
  const im = discArtImg({ art: ENLIST_KEYFRAME });
  if (im) {
    const k = 1 - Math.exp(-Math.max(0, t) / 4.5);
    const s = Math.max(w / im.w, h / im.h) * (1 + 0.062 * k);
    const dw = im.w * s, dh = im.h * s;
    const dx = x + w / 2 - dw / 2 - 0.016 * w * k;   // …and drifts toward the commander
    const dy = y + h / 2 - dh / 2;
    ctx.save();
    ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    ctx.drawImage(im.img, dx, dy, dw, dh);
    enlistHolo(dx, dy, dw, dh, t);
    ctx.restore();
    return;
  }
  // ---- and below: the painted console, when there is no picture ----
  const clearH = h - covered;                   // what the caption plate leaves
  const midY = y + clearH * 0.5;                // the meter's zero line
  const halfH = clearH * 0.42;
  // a faint instrument grid, so the bands read as a READING rather than as decor
  ctx.strokeStyle = `rgba(${ENLIST_COL},0.06)`; ctx.lineWidth = 1;
  ctx.beginPath();
  for (let k = -2; k <= 2; k++) {
    const gy = midY + (k / 2) * halfH;
    ctx.moveTo(x, gy); ctx.lineTo(x + w, gy);
  }
  ctx.stroke();
  // the spectrum. Drawn from the centre out in both directions — the mirrored
  // form is what reads as a WAVEFORM instead of a shop-window equaliser.
  const pad = w * 0.06, bw2 = (w - pad * 2) / ENL_BANDS, bar = bw2 * 0.58;
  for (let i = 0; i < ENL_BANDS; i++) {
    const v = enlistBand(i, time, live);
    const bx = x + pad + i * bw2 + (bw2 - bar) / 2;
    const bhh = Math.max(1, v * halfH);
    // hot core, cool shoulders — the same two-tone the emitters wear
    ctx.fillStyle = `rgba(${NODE_COLS[0]},${(0.34 + v * 0.44).toFixed(2)})`;
    ctx.fillRect(bx, midY - bhh, bar, bhh * 2);
    const cap = Math.max(1, bhh * 0.12);
    ctx.fillStyle = `rgba(210,246,255,${(0.5 + v * 0.5).toFixed(2)})`;
    ctx.fillRect(bx, midY - bhh, bar, cap);
    ctx.fillRect(bx, midY + bhh - cap, bar, cap);
  }
  // the zero line, brighter while he is mid-sentence
  ctx.fillStyle = `rgba(${ENLIST_COL},${live ? 0.34 : 0.18})`;
  ctx.fillRect(x, midY - 0.5, w, 1);
  // THE BADGE, SAT OVER ITS OWN CHANNEL — and deliberately not over all of it. At
  // 0.52 of the width the mark buried the meter and the picture read as a logo with
  // two stray marks beside it; the spectrum is the subject and the badge is what
  // sits ON it.
  const L = (typeof brandLogoSmall === 'function') ? brandLogoSmall() : null;
  if (L && L.w) {
    const fit = Math.min(w * 0.40, clearH * 0.92);
    const sc = fit / Math.max(L.w, L.h);
    const lw = L.w * sc, lh2 = L.h * sc;
    // a soft well behind it: enough to lift the mark off the bands, not so much
    // that it punches a hole through the meter it is supposed to be riding
    const wl = ctx.createRadialGradient(x + w / 2, midY, lw * 0.10, x + w / 2, midY, lw * 0.72);
    wl.addColorStop(0, 'rgba(2,6,14,0.80)');
    wl.addColorStop(0.7, 'rgba(2,6,14,0.46)');
    wl.addColorStop(1, 'rgba(2,6,14,0)');
    ctx.fillStyle = wl;
    ctx.beginPath(); ctx.arc(x + w / 2, midY, lw * 0.72, 0, TAU); ctx.fill();
    enlistShinedLogo(L, x + w / 2 - lw / 2, midY - lh2 / 2, lw, lh2);
  }
}

// 2 — THE JOB, PLAYED LIVE. Not a picture of the game and not a recording of it:
// the REAL body renderers, on a REAL bore projection, in a private geometry sized
// to this window. `ring()` is the shipped projection and `drawEnemy` is the
// shipped art, so this diorama cannot drift from what the recruit is about to
// play — when the enemy art changes, this changes with it, for nothing.
//
// The cage trick is the field guide's (see archWallG in 92-guide.js): hand the
// renderers a geometry object of your own and they paint wherever you point them.
// R0 = nodeR*2.5 and hitZ = 0.25 are geo()'s canonical numbers, so the recession
// here is the recession in the run.
// THE SHOW IS TEN SECONDS OF AN ACTUAL RUN, then a fade and it starts over. The
// first pass was a two-body loop against hand-drawn arcs — a diagram of the game
// rather than the game. Everything that carries the picture now is the shipped
// renderer: drawArcNode paints the emitters (real plasma, real bus-bars, the arc
// flaring white on discharge), drawEnemy paints the traffic, drawGhost de-rezzes
// what dies. Only the bore rings and the discharge bolts are drawn here, and both
// are drawn on the real projection.
//
// STATELESS BY CONSTRUCTION. Every value below is a pure function of the cycle
// clock — nothing is carried between frames and nothing is mutated on a schedule.
// That is what makes the loop seamless: at the wrap every body, every emitter and
// every kill is recomputed from zero, so the show cannot drift, cannot leave a body
// half-killed behind a dropped frame, and needs no reset step.
// PLAYBACK SPEED, and the only knob for it. Every time below — the schedule, the
// travel, the ring flow, the fades — is authored at 1x and read through one scaled
// clock, so the whole show slows or quickens together and nothing has to be retuned
// against anything else. At 1x the traffic arrived faster than the eye could follow
// what the emitters were doing to it.
const ENL_RATE = 0.75;
const ENL_SHOW = 12.5;            // the whole cycle…
const ENL_IN = 0.9;               // …opening on this, and closing on ENL_FADE
const ENL_FADE = 1.2;
const ENL_TRAVEL = 1.60;          // one body's trip, this bore's horizon → the ring
const ENL_LEAD = 0.12;            // the emitter is ON the lane this long before impact
// THE LANE ITSELF MOVES. Depth rings flow outward at this many bore-lengths a
// second — faster than the traffic closes, so the picture reads as the ship running
// the lane with contacts coming up on it, rather than as a target board with things
// sliding around on it. Without this the bore was a set of static circles and the
// whole diorama read as a diagram, however real the bodies on it were.
const ENL_FLOW = 0.85;
// THE RUN. Mixed traffic, because a run is mixed: plain bodies for either emitter,
// the two locks that demand a colour, and heavies that need both at once. Arrivals
// are spread right around the rim now that the bore fills the disc — including the
// lower third, where they pass BEHIND the caption plate. That is the point of the
// full-disc framing: the run does not stop where the text starts, it continues under
// it, and the plate reads as a label laid on a live scene rather than as its floor.
const ENL_SCRIPT = [
  { at: 0.20, a: -Math.PI / 2 - 1.05, type: 'normal', node: 0 },
  { at: 1.05, a: -Math.PI / 2 + 1.15, type: 'normal', node: 1 },
  { at: 1.95, a: -Math.PI / 2 - 0.45, type: 'normal', lock: 0, node: 0 },
  { at: 2.85, a: -Math.PI / 2 + 0.50, type: 'normal', lock: 1, node: 1 },
  { at: 3.80, a: -Math.PI / 2 - 1.55, type: 'heavy',  both: true },
  { at: 4.85, a: -Math.PI / 2 + 0.20, type: 'normal', node: 1 },
  { at: 5.65, a: -Math.PI / 2 - 1.95, type: 'normal', lock: 0, node: 0 },
  { at: 6.50, a: -Math.PI / 2 + 1.70, type: 'normal', node: 1 },
  { at: 7.40, a: -Math.PI / 2 - 0.70, type: 'heavy',  both: true },
  { at: 8.45, a: -Math.PI / 2 + 2.05, type: 'normal', lock: 1, node: 1 },
  { at: 9.20, a: -Math.PI / 2 - 1.25, type: 'normal', node: 0 }
];
const enlTakes = (c, i) => c.both || c.node === i;   // does emitter i answer this one
// THE DIORAMA'S OWN HORIZON, much nearer than the run's SPAWN_Z of 2.1. Depth falls
// off hard (see ring()): over the full range a body spends four fifths of its trip
// as a two-pixel speck on the vanishing point, which in a window this size is the
// entire demonstration. 1.80 is as deep as this bore can usefully go: it is inside
// SPAWN_Z, so drawEnemy's own horizon fade still applies and a body MATERIALISES out
// of the deep rather than appearing at full strength, and it leaves a long approach
// to grow across. Deeper than this and the first half-second is a body too small to
// see at an opacity too low to notice.
const ENL_Z0 = 1.80;
// THE BODIES RUN LARGE FOR THEIR BORE, and that is deliberate. drawEnemy sizes a
// body as a fixed fraction of the RING it sits on, which is right in a run where
// the ring is most of the glass — but this bore is a fifth of that, so a
// proportionally honest body lands at nine pixels and teaches nothing. A quarter
// again keeps the projection nearly honest while making the subject legible — 1.9
// was tuned against a bore half this size and now paints a de-rezzing body as a
// forty-pixel slab across a ninety-pixel ring.
const ENL_BODY_MUL = 1.25;
const ENL_BODIES = {};            // cached, so each body's own fx phase persists
// the two emitters. Real node objects, because drawArcNode reads them — only
// `trailV` carries across frames, and that is a smoothed velocity that self-corrects.
const ENL_NODES = [{ angle: 0, trailV: 0 }, { angle: 0, trailV: 0 }];
// where emitter i is pointing at time `show`: it eases off its last kill and onto
// its next target, ARRIVING just before impact — which is the whole skill of the
// game, so it gets the eased approach rather than a linear track.
function enlistNodeAngle(i, show) {
  let prevA = i ? -Math.PI / 2 + 1.5 : -Math.PI / 2 - 1.5, prevT = -1.2;
  for (const c of ENL_SCRIPT) {
    if (!enlTakes(c, i)) continue;
    const impact = c.at + ENL_TRAVEL;
    if (show < impact) {
      const q = clamp((show - prevT) / Math.max(0.2, impact - ENL_LEAD - prevT), 0, 1);
      return prevA + angDiff(c.a, prevA) * (q * q * (3 - 2 * q));
    }
    prevA = c.a; prevT = impact;
  }
  return prevA;                   // the run is over for this emitter — hold the last kill
}
function enlistArtRun(x, y, w, h, covered) {
  // deep space behind the bore, the same grade the story disc's glam shot uses.
  // Painted at FULL strength and outside the dissolve below: what fades between
  // passes is the RUN, not the window it happens in.
  const bgG = ctx.createLinearGradient(x, y, x, y + h);
  bgG.addColorStop(0, 'rgba(8,18,38,0.92)');
  bgG.addColorStop(0.55, 'rgba(4,9,20,0.96)');
  bgG.addColorStop(1, 'rgba(2,5,12,1)');
  ctx.fillStyle = bgG; ctx.fillRect(x, y, w, h);
  // THE DISC IS THE RING. Not a bore tucked into the space the plate leaves — the
  // node ring is laid ON the mask, so the disc's own rim IS the ring the emitters
  // ride and the traffic arrives on. `covered` is deliberately ignored here: the run
  // owns the whole circle and the caption plate lies over its lower third, which is
  // what makes the scene continue behind the label instead of stopping above it.
  const cx = x + w / 2, cy = y + h / 2;
  const nodeR = (w / 2) * 0.955;              // just inside the mask, so the band clears the rim
  const g2 = { cx, cy, R0: nodeR * 2.5, nodeR, hitZ: 0.25, sw: 0, swy: 0 };
  // the show's own clock: real seconds through the rate above. Everything the run
  // does is phased off THIS, never off `time` directly.
  const st = time * ENL_RATE;
  const show = st % ENL_SHOW;
  // THE DISSOLVE, BOTH ENDS. The run thins out over the last beat and the next pass
  // comes UP out of nothing rather than snapping on — a take that only faded out left
  // the loop with a hard cut at the top, which is the one frame of the cycle the eye
  // is already watching for.
  const fk = Math.min(
    show < ENL_IN ? show / ENL_IN : 1,
    show > ENL_SHOW - ENL_FADE ? Math.max(0, 1 - (show - (ENL_SHOW - ENL_FADE)) / ENL_FADE) : 1);
  if (fk <= 0.004) return;
  ctx.save();
  ctx.globalAlpha *= fk * fk;     // squared: it holds its brightness, then goes
  // THE BORE, FLOWING. Rings ride the real projection from the horizon out past the
  // player, each one a fixed distance behind the last, the whole set sliding forward
  // on one phase — so what the eye tracks is a lane being flown down rather than a
  // set of circles. Each ring fades UP out of the horizon and back DOWN as it reaches
  // the rim, which is what hides the wrap: at both ends of its life it is invisible,
  // so the jump from near to far can never be seen.
  const RINGS = 9;
  const flowP = (st * ENL_FLOW) % 1;
  for (let k = 0; k < RINGS; k++) {
    let u = k / RINGS - flowP;
    u -= Math.floor(u);                         // 0 = out at the rim, 1 = at the horizon
    const rr = ring(g2.hitZ + (ENL_Z0 - g2.hitZ) * u, g2).r;
    if (rr < 1) continue;
    const a = Math.min(1, u * 5) * Math.min(1, (1 - u) * 3.5);
    if (a <= 0.01) continue;
    ctx.strokeStyle = `rgba(${ENLIST_COL},${(0.26 * a).toFixed(3)})`;
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(cx, cy, rr, 0, TAU); ctx.stroke();
  }
  // the band the emitters are mounted on
  ctx.strokeStyle = `rgba(${ENLIST_COL},0.30)`; ctx.lineWidth = Math.max(1.4, nodeR * 0.035);
  ctx.beginPath(); ctx.arc(cx, cy, nodeR, 0, TAU); ctx.stroke();
  // bodies at the size THIS bore wants. drawEnemy scales its art off the glass
  // (min(W,H)·0.06) because in a real run the ring IS the glass — in a window a
  // fifth that size it would paint a body wider than the bore. Scaling about each
  // body's own wall point resizes the art without moving where it sits.
  const bodyS = ENL_BODY_MUL * nodeR / (Math.min(W, H) * 0.44);
  const atWall = a => ({ x: cx + Math.cos(a) * nodeR, y: cy + Math.sin(a) * nodeR });
  const scaledAt = (px, py, draw) => {
    ctx.save();
    ctx.translate(px, py); ctx.scale(bodyS, bodyS); ctx.translate(-px, -py);
    draw();
    ctx.restore();
  };
  // ---- the traffic, and what is left of it ----
  for (let ci = 0; ci < ENL_SCRIPT.length; ci++) {
    const c = ENL_SCRIPT[ci];
    const p = show - c.at;
    if (p < 0) continue;
    const impact = ENL_TRAVEL;
    // built up front, not inside the inbound branch: the de-rez below needs this
    // body's palette, and a cycle joined mid-flight never runs that branch at all
    const key = 'b' + ci;
    const en = ENL_BODIES[key] || (ENL_BODIES[key] = {
      type: c.type, lock: c.lock, z: 0, z0: ENL_Z0, angle: c.a,
      arch: true, sizeMul: c.type === 'heavy' ? 1.2 : 1, speedMul: 1,
      spin: 0, spinMul: 1, age: 9,
      dead: false, resolved: false, failed: false, partner: null });
    if (p < impact) {                            // inbound
      en.z = ENL_Z0 - (ENL_Z0 - g2.hitZ) * (p / impact);
      en.spin = st * (c.type === 'heavy' ? 0.45 : 1.1);
      const rg = ring(Math.max(en.z, 0.02), g2);
      const ex = rg.x + Math.cos(c.a) * rg.r, ey = rg.y + Math.sin(c.a) * rg.r;
      scaledAt(ex, ey, () => drawEnemy(en, g2));
    } else if (p < impact + DECOMP.glitchT) {    // killed: the REAL de-rez, in place
      const wp = atWall(c.a);
      const gh = { a: c.a, z: g2.hitZ, t: p - impact, sizeMul: en.sizeMul,
        pal: enemyPal(en),
        spr: (typeof SPRITES !== 'undefined')
          ? SPRITES[c.lock === 0 ? 'lock0' : c.lock === 1 ? 'lock1' : c.type] : null };
      scaledAt(wp.x, wp.y, () => drawGhost(gh, g2));
    }
  }
  // ---- the emitters, painted by the game's own arc renderer ----
  // bh is the monolith band's half-width. In a run it is min(W,H)·0.055·bandW against
  // a nodeR of 0.44·min(W,H) — so it is 0.125·bandW of the ring, whatever the ring is.
  const bandH = nodeR * 0.125 * ARCFX.bandW;
  for (let i = 0; i < 2; i++) {
    const n = ENL_NODES[i];
    const na = enlistNodeAngle(i, show);
    n.trailV = (n.trailV || 0) * 0.8 + angDiff(na, n.angle) * 0.2;  // the sliding wake
    n.angle = na;
    // the discharge: the arc flares white and its energy visibly drains, both decaying
    // off the most recent kill this emitter made
    let rec = 0, dip = 0;
    for (const c of ENL_SCRIPT) {
      if (!enlTakes(c, i)) continue;
      const since = show - (c.at + ENL_TRAVEL);
      if (since >= 0) { rec = Math.max(0, 1 - since * 4); dip = Math.max(0, 1 - since * 2.2); }
    }
    n.recoil = rec; n.dip = dip; n.held = false;
    drawArcNode(n, g2, i, 0, false, bandH);
  }
  // ---- the bolts, leaping from both bus-bars onto what they just took ----
  // drawArcNode leaves each bar's tip on the node, so this runs after it, exactly as
  // the run's own discharge does
  ctx.lineCap = 'round';
  for (const c of ENL_SCRIPT) {
    const since = show - (c.at + ENL_TRAVEL);
    if (since < 0 || since > ARCFX.zapT) continue;
    const k = 1 - since / ARCFX.zapT;
    const wp = atWall(c.a);
    for (let i = 0; i < 2; i++) {
      if (!enlTakes(c, i)) continue;
      const n = ENL_NODES[i];
      for (const tip of [n.tipA, n.tipB]) {
        if (!tip) continue;
        ctx.strokeStyle = `rgba(${NODE_COLS[i]},${(0.30 * k).toFixed(2)})`;
        ctx.lineWidth = Math.max(1.5, nodeR * 0.05) * k;
        ctx.beginPath(); ctx.moveTo(tip.x, tip.y); ctx.lineTo(wp.x, wp.y); ctx.stroke();
        ctx.strokeStyle = `rgba(255,255,255,${(0.85 * k).toFixed(2)})`;
        ctx.lineWidth = Math.max(0.8, nodeR * 0.016) * k;
        ctx.beginPath(); ctx.moveTo(tip.x, tip.y); ctx.lineTo(wp.x, wp.y); ctx.stroke();
      }
    }
    // …and the rim takes the hit
    ctx.strokeStyle = `rgba(190,235,255,${(0.9 * k).toFixed(2)})`;
    ctx.lineWidth = Math.max(1.2, nodeR * 0.045) * k;
    ctx.beginPath();
    ctx.arc(cx, cy, nodeR, c.a - 0.30 * (1 - k) - 0.05, c.a + 0.30 * (1 - k) + 0.05);
    ctx.stroke();
  }
  ctx.restore();
}

// 3 — THE FIELD, WHICH IS THE FIELD GUIDE. Literally the page: drawGuideLineup is
// the guide screen's own renderer, handed this window instead of the glass. So the
// legend a recruit meets in their first minute IS the page they will open from the
// menu later, and adding a specimen to the guide adds it here for nothing.
// THE PAGE, SCALED — NOT RE-FLOWED. The obvious move is to hand the lineup the
// disc's window as its box, and it does not work: six columns of two-line captions
// re-flowed into a third of the width drive fitPx onto its 9px floor, where the
// captions stop shrinking and start OVERLAPPING each other, and the title and tip
// run out past the rim. Measured on a phone, colW comes to ~44px against an "ANY
// EMITTER" that needs ~55px at the floor — it does not fit at any type size.
//
// So the page is laid out at FULL SCREEN SIZE and the whole thing is scaled down as
// one unit, which is what "the legend screen as the masked image" actually means:
// identical proportions to the page the player opens from the menu, nothing
// colliding, just smaller. The window is close to the glass's own aspect (both are
// wide landscape), so it fills without much waste.
function enlistArtLegend(x, y, w, h, covered) {
  const bgG = ctx.createLinearGradient(x, y, x, y + h);
  bgG.addColorStop(0, 'rgba(7,17,34,0.94)');
  bgG.addColorStop(0.6, 'rgba(4,9,20,0.96)');
  bgG.addColorStop(1, 'rgba(2,5,12,1)');
  ctx.fillStyle = bgG; ctx.fillRect(x, y, w, h);
  const clearH = h - covered;
  const mL = 10 + SAFE.l, mR = 10 + SAFE.r, mT = 8 + SAFE.t, mB = 13 + SAFE.b;
  // BIGGER THAN THE DISC, AND PANNED. Every earlier pass tried to make the whole page
  // fit, and every one of them paid for it in type size — the page is a wide
  // rectangle, the mask is a circle, and fitting the one inside the other means the
  // specimens end up smaller than the thing they are teaching. So it stops fitting:
  // the page is sized to FILL the picture's height and runs wider than the disc,
  // which the mask crops. What is lost is the page's head and foot — its title and
  // its tip — and neither is the point here. The SPECIMENS are the point, and they
  // are what the extra size goes to.
  //
  // The width that overhangs is not thrown away either: the page drifts slowly left
  // and right, so the outermost specimens on each side take their turn in view rather
  // than living permanently behind the rim.
  const s = clearH / H * 1.30;                  // fill the picture band, then some
  const pageW = W * s;
  const pan = Math.max(0, (pageW - w) / 2);     // how far off each edge the page runs
  const drift = pan * Math.sin(time * 0.22);    // …and the slow sweep across it
  ctx.save();
  // clipped to the picture band so the pan cannot smear into the caption plate
  ctx.beginPath(); ctx.rect(x, y, w, clearH); ctx.clip();
  ctx.translate(x + w / 2 - drift, y + clearH / 2);
  ctx.scale(s, s);
  ctx.translate(-W / 2, -H / 2);
  // the page's own box and its own type reference — every number here is the one
  // drawGuide passes, which is the entire point. The title and tip still render:
  // they are what the crop eats, and a page that stopped drawing them would leave a
  // band of nothing where the mask was going to cut anyway.
  drawGuideLineup(
    { x: (mL + mR) / 2, y: mT, w: W - mL - mR, h: H - mB - mT },
    Math.min(W, H),
    { titleMaxW: W - 2 * (mL + 46), hint: false });
  ctx.restore();
}
// `t` is the DISC's clock, not the frame's: it restarts on every beat, and the
// outgoing snapshot is rendered with it pinned past the end (see enlistKeepPrev), so
// a disc on its way out holds the pose it had when the player tapped it.
function enlistArt(beat, x, y, w, h, covered, live, t) {
  ctx.save();
  ctx.lineCap = 'round';
  if (beat === 0) enlistArtComms(x, y, w, h, covered, live, t);
  else if (beat === 1) enlistArtRun(x, y, w, h, covered);
  else enlistArtLegend(x, y, w, h, covered);
  ctx.restore();
}
// ---------- the scan print ----------
// THE DISC ARRIVES THE WAY THE BADGE DOES. It used to fly in on a back-eased zoom,
// which is a UI panel's entrance — but the player has just watched the splash
// PRINT the shield in behind a scan line, and that is the language this game opens
// in. So the same move carries the discs, and it carries every beat change too:
// tap, and the next disc prints over the last one rather than swapping.
//
// The technique is drawSplash's card two (see 99-boot.js): capture the art, then
// reveal only what the scan head has passed, with chromatic ghosts that die as it
// locks. Two differences, both because a disc is not a badge — the scan bar hugs
// the CIRCLE'S CHORD rather than a silhouette, so it reads as printing this disc
// and not a rectangle; and the wobble is deterministic, since the qualification
// course is live underneath and Math.random() in a draw path desyncs its replay.
// IT IS A CROSS WIPE, NOT A REVEAL. The first pass showed the incoming disc above
// the scan head and NOTHING below it, so for half a second the lane showed straight
// through the bottom of the frame and the outgoing disc simply vanished — the head
// read as erasing rather than as printing. The old disc now holds its ground until
// the new one has covered it, which is the whole idea of a wipe.
//
// The outgoing disc is a SNAPSHOT, taken once on the frame the beat turns over, not
// re-rendered live underneath. It is being progressively covered over ~0.5s and a
// second live render every frame would double the cost of the diorama and the field
// guide's six live specimens at exactly the moment the transition wants headroom.
let enlBuf = null, enlPrevBuf = null, enlPrevFor = -1;
function enlistEnsure(c) {
  const D = Math.max(1, DPR || 1);
  const bw = Math.max(1, Math.ceil(W * D)), bh = Math.max(1, Math.ceil(H * D));
  if (c.width !== bw || c.height !== bh) { c.width = bw; c.height = bh; }
  return c;
}
// paint `body` into an offscreen at device resolution, in game-space coords
function enlistToBuf(c, rx, ry, rw, rh, body) {
  const D = Math.max(1, DPR || 1);
  const b = enlistEnsure(c).getContext('2d');
  if (!b || !b.setTransform) return null;
  b.setTransform(D, 0, 0, D, 0, 0);
  b.clearRect(rx, ry, rw, rh);
  const prev = ctx; ctx = b;                        // redirect the disc painters into the buffer
  try { body(); } finally { ctx = prev; }
  return b;
}
// snapshot the disc that is on its way out, so the wipe has something to wipe OVER
function enlistKeepPrev(g, R, body) {
  if (!enlPrevBuf) enlPrevBuf = document.createElement('canvas');
  const M = 26;
  const rx = Math.max(0, Math.floor(g.cx - R - M)), ry = Math.max(0, Math.floor(g.cy - R - M));
  const rw = Math.min(Math.ceil(W) - rx, Math.ceil((R + M) * 2)), rh = Math.min(Math.ceil(H) - ry, Math.ceil((R + M) * 2));
  return !!enlistToBuf(enlPrevBuf, rx, ry, rw, rh, body);
}
function enlistScanRender(g, R, q, body, hasPrev) {
  if (q >= 1) { body(); return; }                  // printed — draw straight to screen
  const M = 26;                                     // margin for the rim's accent arcs and glow
  const rx = Math.max(0, Math.floor(g.cx - R - M)), ry = Math.max(0, Math.floor(g.cy - R - M));
  const rw = Math.min(Math.ceil(W) - rx, Math.ceil((R + M) * 2)), rh = Math.min(Math.ceil(H) - ry, Math.ceil((R + M) * 2));
  if (rw <= 0 || rh <= 0) return;
  const D = Math.max(1, DPR || 1);
  if (!enlBuf) enlBuf = document.createElement('canvas');
  const b = enlistToBuf(enlBuf, rx, ry, rw, rh, body);
  if (!b) { body(); return; }                      // headless — no buffer, no theatre
  const bw = enlBuf.width, bh = enlBuf.height;
  // the outgoing disc, WHOLE and underneath — the new one prints down over it
  if (hasPrev && enlPrevBuf && enlPrevBuf.width)
    ctx.drawImage(enlPrevBuf, rx * D, ry * D, rw * D, rh * D, rx, ry, rw, rh);
  if (q <= 0) return;
  // the print head runs the DISC's own height, not the padded capture box, so the
  // scan starts exactly on the crown and finishes exactly on the foot
  const headY = g.cy - R + R * 2 * q;
  const srcX = rx * D, srcY = ry * D, srcW = rw * D, srcH = rh * D;
  const amt = Math.pow(1 - q, 2);
  ctx.save();
  ctx.beginPath(); ctx.rect(rx, ry, rw, Math.max(0, headY - ry + 2)); ctx.clip();
  if (amt > 0.03) {                                 // chromatic ghosts, dying as it locks
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = amt * 0.4;
    ctx.drawImage(enlBuf, srcX, srcY, srcW, srcH, rx - amt * rw * 0.05, ry, rw, rh);
    ctx.drawImage(enlBuf, srcX, srcY, srcW, srcH, rx + amt * rw * 0.05, ry, rw, rh);
    ctx.restore();
  }
  ctx.drawImage(enlBuf, srcX, srcY, srcW, srcH, rx, ry, rw, rh); // the print — whole, seamless
  ctx.restore();
  // the head itself, sized to the chord it is crossing: zero at the crown, widest
  // at the equator, closing again at the foot. This is what makes it read as the
  // DISC being printed rather than a bar sliding down a box.
  const dy = headY - g.cy;
  const halfW = Math.sqrt(Math.max(0, R * R - dy * dy));
  if (halfW > 0.5) {
    const glowH = R * 0.30;
    const gsc = ctx.createLinearGradient(0, headY - glowH, 0, headY);
    gsc.addColorStop(0, 'rgba(111,227,255,0)');
    gsc.addColorStop(1, 'rgba(111,227,255,0.35)');
    ctx.fillStyle = gsc;
    ctx.fillRect(g.cx - halfW, headY - glowH, halfW * 2, glowH);
    ctx.fillStyle = 'rgba(235,250,255,0.85)';
    ctx.fillRect(g.cx - halfW, headY, halfW * 2, 1.6);
  }
}
// the disc itself: the mission briefing's layout, beat for beat. See drawStoryDisc
// — the mask, the art window, the caption plate riding its lower edge, the rim laid
// back over the top. The numbers are that function's numbers on purpose.
function enlistDiscBody(g, R, lines, t, beat) {
  const Rc = R * 0.965;                    // the mask: just inside the border ring
  // THIRDS, MEASURED ON THE MASK. The plate takes the bottom third of the disc and
  // the picture keeps the top two — stated as a fraction of the circle rather than
  // derived from however tall the text happens to be. Sizing the bar off its own
  // rows is what a mission disc does, and it meant the split moved whenever a line
  // wrapped differently; here the frame is the constant and the type fits into it.
  const dTop = g.cy - Rc, dBot = g.cy + Rc;
  const bTop = dTop + (dBot - dTop) * (2 / 3);
  const bh = dBot - bTop;
  // the art still fills the WHOLE mask and the plate is laid over its foot — the
  // painters are told what the plate covers and keep their subject clear of it, but
  // a picture that stopped dead at the seam would show its own edge there
  const aTop = dTop, aH = dBot - dTop;
  const half = y => Math.sqrt(Math.max(1, Rc * Rc - y * y));
  // THE SCRIPT'S OWN LINE BREAKS ARE KEPT. A mission disc wraps a sentence to the
  // chord because its text is authored as one string; these are authored as two
  // deliberate halves ("Welcome to Vanguard Squadron," / "rookies"), and re-wrapping
  // them to fit would throw away the pause the writer put there. So the only fitting
  // done is shrink-to-chord — EACH ROW AGAINST ITS OWN CHORD, not every row against
  // the lowest and narrowest one. The plate sits below the disc's equator, so a
  // circle gives the top row more width than the bottom, and the beats that fit
  // both rows the same way could not tell the difference. The opening beat can: it
  // is a long line over a short one ("Welcome to Vanguard Squadron," / "rookies"),
  // so measuring it at the foot cost it 2-3px of type it had room for.
  const chordAt = y => half(y - g.cy) * 2 - R * 0.14;
  let ls = Math.max(10, Math.round(R * 0.095));
  for (;;) {
    ctx.font = '500 ' + ls + 'px Audiowide, system-ui';
    const mid = bTop + bh * 0.5, lh0 = ls + 5;
    let fits = true;
    for (let i = 0; i < lines.length && fits; i++)
      fits = ctx.measureText(lines[i]).width <= chordAt(mid + (i - (lines.length - 1) / 2) * lh0);
    if (fits || ls <= 9) break;
    ls--;
  }
  const lh = ls + 5;
  ctx.save();
  ctx.beginPath(); ctx.arc(g.cx, g.cy, Rc, 0, TAU); ctx.clip();
  const full = lines.join(' ').length;
  const typed = Math.min(full, Math.floor((t - ENLIST_SCAN) * ENLIST_TYPE));
  const talking = typed < full && !enlist.out;
  // NO CALLSIGN PLATE. It read as a caption pinned over the picture rather than as
  // part of it, and it cost the art the whole top fifth of the window. Who is
  // speaking is already carried by the line he speaks.
  enlistArt(enlist.short ? 2 : beat, g.cx - Rc, aTop, Rc * 2, aH, bh, talking, t);
  // the grade the ENGINE adds, exactly as it adds it to forty authored keyframes:
  // scanlines and a vignette, so these discs sit in the same show as the briefings
  ctx.fillStyle = 'rgba(2,6,14,0.22)';
  for (let sy = aTop + (Math.floor(time * 8) % 3); sy < bTop; sy += 3) ctx.fillRect(g.cx - Rc, sy, Rc * 2, 1);
  const vg = ctx.createRadialGradient(g.cx, aTop + aH * 0.34, aH * 0.26, g.cx, aTop + aH * 0.34, Rc * 1.05);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(2,5,12,0.62)');
  ctx.fillStyle = vg; ctx.fillRect(g.cx - Rc, aTop, Rc * 2, aH);
  // THE PLATE IS THE DISC'S BOTTOM THIRD, solid to the mask's edge — a bar with open
  // space under it read as a ring with a panel wedged into it rather than as one
  // object. TAP TO CONTINUE sits ON it.
  const cg = ctx.createLinearGradient(g.cx, bTop, g.cx, dBot);
  cg.addColorStop(0, 'rgba(3,7,16,0.78)');
  cg.addColorStop(0.12, 'rgba(3,7,16,0.94)');
  cg.addColorStop(1, 'rgba(3,7,16,0.94)');
  ctx.fillStyle = cg; ctx.fillRect(g.cx - Rc, bTop, Rc * 2, bh);
  ctx.restore();
  // the art covered the disc's rim — lay the ring and its accent arcs back over
  ctx.strokeStyle = `rgba(${ENLIST_COL},0.28)`; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(g.cx, g.cy, R * 0.97, 0, TAU); ctx.stroke();
  ctx.strokeStyle = `rgba(${ENLIST_COL},0.7)`; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
  for (let k = 0; k < 4; k++) {
    const a = k / 4 * TAU + Math.PI / 4 + time * 0.15;
    ctx.beginPath(); ctx.arc(g.cx, g.cy, R * 0.97, a - 0.22, a + 0.22); ctx.stroke();
  }
  ctx.strokeStyle = `rgba(${ENLIST_COL},0.20)`; ctx.lineWidth = 1;  // picture meets plate
  ctx.beginPath();
  ctx.moveTo(g.cx - half(bTop - g.cy), bTop - 0.5);
  ctx.lineTo(g.cx + half(bTop - g.cy), bTop - 0.5);
  ctx.stroke();
  // …and the line he is speaking, typed into the plate, centred on its ink
  ctx.textAlign = 'center';
  ctx.font = '500 ' + ls + 'px Audiowide, system-ui';
  const m3 = ctx.measureText(lines[0] || 'M');
  const asc3 = m3.actualBoundingBoxAscent, desc3 = m3.actualBoundingBoxDescent;
  const capH = (typeof asc3 === 'number' && asc3 > 0) ? asc3 : ls * 0.72;
  const dscH = (typeof desc3 === 'number' && desc3 > 0) ? desc3 : ls * 0.06;
  const inkH = (lines.length - 1) * lh + capH + dscH;
  // CENTRED IN WHAT THE TAP LINE LEAVES, not in the whole plate. TAP TO CONTINUE
  // lives at a fixed radius (TAP_K) and the plate is now a full third of the disc —
  // centring the speech in all of it dropped the second row onto the tap line.
  const tapTop = g.cy + R * TAP_K - R * 0.055;
  const base0 = bTop + Math.max(0, (tapTop - bTop - inkH) / 2) + capH;
  ctx.fillStyle = 'rgba(228,240,254,0.96)';
  let used = 0;
  for (let i2 = 0; i2 < lines.length; i2++) {
    const whole = lines[i2];
    const take = clamp(typed - used, 0, whole.length);
    used += whole.length + 1;
    if (take <= 0) break;
    ctx.fillText(whole.slice(0, take), g.cx, base0 + i2 * lh);
  }
  ctx.textAlign = 'left';
  return talking;
}
// HANDED BACK WHEN HE IS DONE. Between them these two hold a full-screen canvas at
// DEVICE resolution plus a badge-sized one — on a 3x phone that is the thick end of
// 12MB, for a sequence that runs ONCE, on the first launch, and never again. The
// same reasoning that put an LRU on the mission keyframes applies here: the cost is
// not a slow frame, it is a phone carrying the intro's buffers for the whole session.
function enlistArtRelease() {
  for (const c of [enlBuf, enlPrevBuf, enlShineBuf]) if (c) { c.width = c.height = 0; }
  enlBuf = null; enlPrevBuf = null; enlShineBuf = null; enlPrevFor = -1;
  for (const k in ENL_BODIES) delete ENL_BODIES[k];
  // and the briefing-room keyframe, for the same reason: decoded it is ~4MB of RGBA
  // for a disc that will never be drawn again this session. The LRU would get to it
  // eventually — after four missions — but there is nothing to wait for. Handlers
  // off before src, exactly as the eviction path does it (see discArtImg).
  const e = DISCIMG.get('art/disc/' + ENLIST_KEYFRAME);
  if (e) {
    DISCIMG.delete('art/disc/' + ENLIST_KEYFRAME);
    if (e.img) { e.img.onload = e.img.onerror = null; e.img.src = ''; }
  }
}
function drawEnlistment() {
  if (!enlist) return;
  // The splash owns the screen until it is done — the state is claimed before the
  // first frame so the menu never builds, which means this exists during the
  // whole boot theatre and has to stay out of sight for it.
  if (typeof SPLASH !== 'undefined' && SPLASH.on) return;
  const lines = enlistScript()[enlist.beat] || [];
  const g = geo();
  const t = enlist.t;
  const outQ = enlist.out ? clamp(enlist.out / ENLIST_OUT, 0, 1) : 0;

  ctx.save();
  ctx.globalAlpha = 1 - outQ;
  // A LIGHT DIM ONLY. The qualification is already parked and drawing behind
  // this — the lane, the ring, the pads. Blacking it out would make the discs a
  // separate screen again, and the whole point is that they are not.
  ctx.fillStyle = 'rgba(3,6,14,0.5)'; ctx.fillRect(0, 0, W, H);
  // only the ARRIVAL changed — the hand-off still shrinks the disc away as the
  // course opens underneath it
  const sc = 1 - 0.5 * outQ * outQ;
  ctx.translate(g.cx, g.cy); ctx.scale(sc, sc); ctx.translate(-g.cx, -g.cy);
  const R = g.nodeR * 0.9;

  // enlist.t resets to 0 on every beat (see enlistTap), so this one clock prints
  // the first disc AND every disc that replaces it — no separate transition state
  const q = clamp(t / ENLIST_SCAN, 0, 1);
  // THE OUTGOING DISC, SNAPSHOT ONCE. Taken on the first frame after the beat turns
  // over — `enlPrevFor` records which arrival the snapshot belongs to, so it is
  // captured exactly once per transition and not re-rendered every frame of it. The
  // previous beat is drawn with a settled clock: it finished talking before the
  // player could tap, so that is what it looked like when they did.
  if (q < 1 && enlist.beat > 0 && enlPrevFor !== enlist.beat) {
    const pl = enlistScript()[enlist.beat - 1] || [];
    enlPrevFor = enlistKeepPrev(g, R,
      () => enlistDiscBody(g, R, pl, 999, enlist.beat - 1)) ? enlist.beat : -1;
  }
  // the first disc has nothing behind it — it prints onto the open lane, as it should
  const hasPrev = enlist.beat > 0 && enlPrevFor === enlist.beat;
  let talking = false;
  enlistScanRender(g, R, q,
    () => { talking = enlistDiscBody(g, R, lines, t, enlist.beat); }, hasPrev);

  // the tap line sits OUTSIDE the print: an invitation that scanned in half-drawn
  // would be inviting a tap the gate is still refusing
  if (q >= 1 && !talking && !enlist.out) {
    const br = 0.55 + 0.45 * Math.sin(time * 3.4);
    ctx.textAlign = 'center';
    ctx.fillStyle = `rgba(${ENLIST_COL},${(0.28 + br * 0.45).toFixed(2)})`;
    ctx.font = '700 10px Audiowide, system-ui';
    try { ctx.letterSpacing = '3px'; } catch (e) {}
    const last = enlist.beat >= enlistScript().length - 1;
    ctx.fillText(last ? 'TAP TO BEGIN' : 'TAP TO CONTINUE', g.cx, g.cy + R * TAP_K);
    try { ctx.letterSpacing = '0px'; } catch (e) {}
    ctx.textAlign = 'left';
  }
  ctx.restore();
}
