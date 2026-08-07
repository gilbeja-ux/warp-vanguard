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
    // two taps torn open along a running crack
    const off = r * 1.15;
    ctx.strokeStyle = 'rgba(255,60,90,0.6)'; ctx.lineWidth = Math.max(2, r * 0.16);
    ctx.setLineDash([r * 0.4, r * 0.28]);
    ctx.lineDashOffset = -time * r * 2;
    ctx.beginPath(); ctx.moveTo(-off, 0); ctx.lineTo(off, 0); ctx.stroke();
    ctx.setLineDash([]);
    for (const sx of [-off, off]) {
      ctx.save(); ctx.translate(sx, 0);
      infoTap(r * 0.5, INFO_PAL.normal, false);
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
  } else if (kind === 'boss') {
    // mini warden-core: the same corrupted mosaic the duel shows
    const SH = ['#b03ae8', '#8a2ad4', '#d465ff', '#6f14b8'];
    const ext = r * 1.05, cs = ext * 2 / 3;
    for (let rr = 0; rr < 3; rr++) for (let cc = 0; cc < 3; cc++) {
      const fl = 0.55 + 0.45 * Math.sin(time * 6 + rr * 2.7 + cc * 1.3);
      ctx.fillStyle = rr === 1 && cc === 1 ? '#f3d4ff' : SH[(rr * 3 + cc) % SH.length];
      ctx.globalAlpha = rr === 1 && cc === 1 ? 1 : 0.45 + 0.5 * fl;
      ctx.fillRect(-ext + cc * cs + cs * 0.05, -ext + rr * cs + cs * 0.05, cs * 0.9, cs * 0.9);
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(255,255,255,' + (0.3 + 0.5 * (Math.sin(time * 13) * 0.5 + 0.5)).toFixed(2) + ')';
    ctx.fillRect(Math.sin(time * 9) * r * 0.3 - r, Math.sin(time * 3.1) * r * 0.6, r * 2, r * 0.09);
    ctx.strokeStyle = 'rgba(230,245,255,0.55)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, r * 1.45, 0, TAU); ctx.stroke();
    const oa = time * 1.4;
    ctx.fillStyle = 'rgb(80,170,255)';
    ctx.beginPath(); ctx.arc(Math.cos(oa) * r * 1.45, Math.sin(oa) * r * 1.45, r * 0.16, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(Math.cos(oa + Math.PI) * r * 1.45, Math.sin(oa + Math.PI) * r * 1.45, r * 0.16, 0, TAU); ctx.fill();
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
  const tapY = g.cy + R * (isStory ? 0.79 : 0.66);
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
  const artB = g.cy + R * 0.34;      // the art's bottom edge
  const half = y => Math.sqrt(Math.max(1, Rc * Rc - y * y)); // the chord, half-width
  // measure the plot line FIRST — the caption bar is sized by its own wrap, and
  // its width is the disc's chord at the bar's lowest point, not a panel edge
  const body = c.line || (c.lines || []).join(' ');
  let ls = Math.max(10, Math.min(16, Math.round(R * 0.095))), rows = [], tw = 0;
  for (;;) {
    ctx.font = '500 ' + ls + 'px Audiowide, system-ui';
    tw = half(R * 0.34) * 2 - R * 0.16;
    rows = wrapRows(body, tw);
    if (rows.length <= 2 || ls <= 9) break;
    ls--;
  }
  // BAR_SCALE: the bar is 1.5x the height its rows strictly need, and the text is centred
  // in the slack rather than hanging from the top edge — see base0 at the draw.
  const lh = ls + 5, bh = (rows.length * lh + 16) * BAR_SCALE;
  const aTop = g.cy - Rc, aH = artB - aTop;
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
  const bTop = artB - bh;
  const cg = ctx.createLinearGradient(g.cx, bTop, g.cx, artB);
  cg.addColorStop(0, 'rgba(3,7,16,0.80)');
  cg.addColorStop(0.35, 'rgba(3,7,16,0.94)');
  cg.addColorStop(1, 'rgba(3,7,16,0.94)');
  ctx.fillStyle = cg; ctx.fillRect(g.cx - Rc, bTop, Rc * 2, bh);
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
  const base0 = bTop + (bh - inkH) / 2 + capH;
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
  ctx.shadowColor = 'rgba(120,225,255,0.8)'; ctx.shadowBlur = 22 * al;
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
