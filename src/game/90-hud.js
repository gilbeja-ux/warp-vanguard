'use strict';
// ---------- holographic HUD kit ----------
// chamfered slab — corners cut on the top-left / bottom-right diagonal
function techRect(x, y, w, h, cut) {
  ctx.beginPath();
  ctx.moveTo(x + cut, y);
  ctx.lineTo(x + w, y);
  ctx.lineTo(x + w, y + h - cut);
  ctx.lineTo(x + w - cut, y + h);
  ctx.lineTo(x, y + h);
  ctx.lineTo(x, y + cut);
  ctx.closePath();
}
// floating bracket corners, like a target lock
function cornerBrackets(x, y, w, h, len, col) {
  ctx.strokeStyle = col; ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x, y + len); ctx.lineTo(x, y); ctx.lineTo(x + len, y);
  ctx.moveTo(x + w - len, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + len);
  ctx.moveTo(x + w, y + h - len); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w - len, y + h);
  ctx.moveTo(x + len, y + h); ctx.lineTo(x, y + h); ctx.lineTo(x, y + h - len);
  ctx.stroke();
}
// cluster of small + marks — HUD garnish
function plusCluster(x, y, col) {
  ctx.strokeStyle = col; ctx.lineWidth = 1.5;
  const s = 3.5, gap = 12;
  for (let i = 0; i < 8; i++) {
    if (i === 3 || i === 6) continue; // ragged edge, like the mock
    const cx2 = x + (i % 4) * gap, cy2 = y + ((i / 4) | 0) * gap;
    ctx.beginPath();
    ctx.moveTo(cx2 - s, cy2); ctx.lineTo(cx2 + s, cy2);
    ctx.moveTo(cx2, cy2 - s); ctx.lineTo(cx2, cy2 + s);
    ctx.stroke();
  }
}
// glass console panel with a luminous header band; returns the header height
function techPanel(x, y, w, h, title) {
  const cut = 16;
  techRect(x, y, w, h, cut);
  ctx.fillStyle = 'rgba(4,14,30,0.92)'; ctx.fill();
  ctx.shadowColor = 'rgba(95,215,255,0.55)'; ctx.shadowBlur = lowFX ? 0 : 16;
  ctx.strokeStyle = 'rgba(110,210,255,0.65)'; ctx.lineWidth = 1.5;
  techRect(x, y, w, h, cut); ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(110,210,255,0.16)'; ctx.lineWidth = 1;
  techRect(x + 4, y + 4, w - 8, h - 8, cut - 3); ctx.stroke();
  const hh = 32;
  ctx.save();
  techRect(x, y, w, h, cut); ctx.clip();
  const hg = ctx.createLinearGradient(x, y, x + w * 0.85, y);
  hg.addColorStop(0, 'rgba(80,190,255,0.35)');
  hg.addColorStop(1, 'rgba(80,190,255,0.02)');
  ctx.fillStyle = hg; ctx.fillRect(x, y, w, hh);
  ctx.strokeStyle = 'rgba(120,220,255,0.5)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x, y + hh); ctx.lineTo(x + w, y + hh); ctx.stroke();
  ctx.restore();
  ctx.fillStyle = '#cfeeff';
  try { ctx.letterSpacing = '3px'; } catch (e) {}
  ctx.font = '700 13px Audiowide, system-ui'; ctx.textAlign = 'left';
  ctx.fillText(title, x + 20, y + 21);
  try { ctx.letterSpacing = '0px'; } catch (e) {}
  cornerBrackets(x - 7, y - 7, w + 14, h + 14, 14, 'rgba(120,220,255,0.55)');
  return hh;
}

// level intro: title card + 3-2-1 countdown in the center while the ring forms
// — drawn as the frame's last pass so no rim/HUD layer can obscure the text
// the strip itself: tucked under the PAUSE key in the status corner, clear of
// the bore and of the intro card's centre column. Three bars keep time off the
// detected beat grid, so it reads as the soundtrack rather than another callout.
function drawNowPlaying() {
  if (npT >= NP_DUR || !npName || replaying) return;
  const a = Math.min(1, npT / 0.35) * clamp((NP_DUR - npT) / 0.9, 0, 1);
  if (a <= 0.01) return;
  const x = 12 + SAFE.l, y = 12 + SAFE.t + 46;
  ctx.save();
  ctx.globalAlpha = a;
  ctx.font = '700 10px Audiowide, system-ui';
  try { ctx.letterSpacing = '1px'; } catch (e) {}
  const nw = Math.min(ctx.measureText(npName).width, W * 0.42);
  const h = 22, w = nw + 34;
  techRect(x, y, w, h, 6);
  ctx.fillStyle = 'rgba(6,20,40,0.55)'; ctx.fill();
  ctx.strokeStyle = 'rgba(120,220,255,0.35)'; ctx.lineWidth = 1;
  techRect(x, y, w, h, 6); ctx.stroke();
  // level meter — dead still when the music is off, so the strip never lies
  const on = settings.music && settings.musicVol > 0;
  const beat = beatPeriod > 0 ? time / beatPeriod : time * 2.2;
  for (let i = 0; i < 3; i++) {
    const lvl = on ? 0.35 + 0.65 * Math.abs(Math.sin((beat + i * 0.27) * Math.PI)) : 0.18;
    const bh = 10 * lvl;
    ctx.fillStyle = 'rgba(111,227,255,' + (on ? 0.9 : 0.35) + ')';
    ctx.fillRect(x + 9 + i * 4, y + h / 2 + 5 - bh, 2.5, bh);
  }
  ctx.fillStyle = 'rgba(224,246,255,0.92)';
  ctx.textAlign = 'left';
  ctx.fillText(npName, x + 25, y + h / 2 + 4, nw);
  try { ctx.letterSpacing = '0px'; } catch (e) {}
  ctx.restore();
}
// THE LAUNCH TOOLTIP: the one instruction, sat directly under the AWAITING RUNNER stamp so
// the status and the ask read as a single block. `yTop` is its upper edge — it centres
// itself half its own height below that, so the caller never has to know the font size.
//
// A NOTE ON THE COORDINATES, because I got this wrong once and it cost a round trip. This
// is a LANDSCAPE game: on a portrait-shaped viewport `resize()` sets ROT and paints the
// whole frame through a 90° transform, because the player turns the device. So game space
// IS screen space from the player's point of view, and no orientation branch belongs here.
// What LOOKS like the right-hand edge in a portrait screenshot is the top of the picture —
// rotate the image before judging any of this.
//
// (Corollary: isLandscape() is `W > H` on the game space and is therefore true in both
// device orientations. It is not the question anyone asking about orientation means.)
//
// It also carries the one-pad-down case. Two pads that each say READY on their own give no
// hint the game is waiting for them TOGETHER — the remaining way to be stuck here without
// knowing why.
function drawLaunchTip(a0, yTop) {
  const held = (padHold[0] ? 1 : 0) + (padHold[1] ? 1 : 0);
  // a controller has its own grip and no pad dots to aim at, so it gets told the grip
  // A controller no longer needs a pose taught — a stick moves its emitter and arms its
  // own pad — so the copy stops describing a grip and just says the lane is waiting.
  const lines = held === 1 ? ['ONE MORE', gpSeen ? 'BOTH STICKS' : 'BOTH PADS TOGETHER']
    : ['WARP LANE READY', 'TAKE THE CONTROLS TO START'];
  // TWO LINES, sized to the gap BETWEEN THE PAD DOTS — measured off the pads, not guessed
  // off a fraction of the frame. Sat under the stamp, the plate is at exactly the height
  // the dots live at, and one wide line ran its ends straight through both of them: the
  // instruction covering the target it points to. Narrow enough to pass between them, the
  // text can be half again as big as it was when it spanned the frame.
  const dL = dialCenter('L'), dR = dialCenter('R'), CLR = 52; // CLR ≈ the dot's halo
  const maxW = Math.max(120, (dR.x - dR.r - CLR) - (dL.x + dL.r + CLR));
  const px = Math.min(fitPx(lines[0], '800', Math.min(W * 0.034, 24), maxW, 11),
    fitPx(lines[1], '800', Math.min(W * 0.034, 24), maxW, 11));
  const breath = 0.82 + 0.18 * Math.sin(time * 3.2); // same clock as the pad dots
  const col = held === 1 ? '126,226,98' : '255,210,74';
  ctx.save();
  ctx.globalAlpha = a0;
  ctx.textAlign = 'center';
  ctx.font = '800 ' + px + 'px Audiowide, system-ui';
  try { ctx.letterSpacing = '3px'; } catch (e) {}
  const wid = Math.max(ctx.measureText(lines[0]).width, ctx.measureText(lines[1]).width);
  const gap = px * 1.5, halfW = wid / 2 + px * 0.7, halfH = gap * 0.5 + px * 0.66;
  const ax = W / 2, ay = yTop + halfH;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(ax - halfW, ay - halfH, halfW * 2, halfH * 2, 9);
  else ctx.rect(ax - halfW, ay - halfH, halfW * 2, halfH * 2);
  ctx.fillStyle = 'rgba(4,10,20,0.66)'; ctx.fill();
  ctx.strokeStyle = `rgba(${col},${(0.32 + breath * 0.3).toFixed(2)})`;
  ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = `rgba(${col},${(0.74 + breath * 0.26).toFixed(2)})`;
  ctx.shadowColor = `rgb(${col})`; ctx.shadowBlur = lowFX ? 0 : 12;
  ctx.fillText(lines[0], ax, ay - gap * 0.5 + px * 0.36);
  ctx.fillText(lines[1], ax, ay + gap * 0.5 + px * 0.36);
  ctx.shadowBlur = 0;
  try { ctx.letterSpacing = '0px'; } catch (e) {}
  ctx.textAlign = 'left';
  ctx.restore();
}
// ---------- thumb ghosts ----------
// THE WORDS WERE NOT ENOUGH. The parked gate has always said BOTH PADS TOGETHER
// and new players still sat on it: naming the pads does not tell a hand what to
// do. So it is demonstrated instead — two thumbs slide in from the edges, settle
// on the dots and press, on a loop, until the real ones arrive.
//
// A PATH SAMPLER, NOT A POSITION. Keyframes in, place-on-the-pad out. Teaching a
// sweep later is another keyframe list, not another system — which is the whole
// reason it is built this way rather than as two hard-coded tweens.
//
// Coordinates are game space. This is a landscape game painted through a 90°
// transform (see the note on drawLaunchTip), so there is no orientation branch
// here and there must never be one: dialCenter() already answers in the space
// the player sees.
const GHOST_CYCLE = 2.9;    // one enter → press → fade loop, seconds
const GHOST_STAGGER = 0.30; // the right thumb trails, so it reads as two hands not a mirror
// EXPERTS NEVER SEE IT. Someone who knows the grip has both thumbs down inside a
// second; the demonstration only surfaces for someone who is actually stuck.
const GHOST_DELAY = 1.4;
const GHOST_COL = '198,216,240'; // deliberately off the signal palette — a hand is not a game object

// { at, x, y, down, a } — `down` 0..1 is contact, `a` is opacity
//
// IT LANDS ON THE DOT, NOT THE MIDDLE. padDotXY is the same point drawPadPrompt
// breathes at, taken from there rather than recomputed. The pad centre belongs
// to the PULSE tap; a thumb demonstrated into the middle of the dial teaches the
// wrong gesture, and teaches it at the exact moment the player is copying.
function ghostKeysPlace(side) {
  const d = dialCenter(side);
  const g = padDotXY(d, side === 'L' ? 0 : 1);
  const from = side === 'L' ? -d.r * 2.4 : W + d.r * 2.4;
  const rise = d.r * 1.15; // arrives from below, the way a thumb actually comes up
  return [
    { at: 0.00, x: from, y: g.y + rise, down: 0, a: 0 },
    { at: 0.12, x: from, y: g.y + rise, down: 0, a: 1 },
    { at: 0.54, x: g.x,  y: g.y,        down: 0, a: 1 },
    { at: 0.66, x: g.x,  y: g.y,        down: 1, a: 1 },
    { at: 0.88, x: g.x,  y: g.y,        down: 1, a: 1 },
    { at: 1.00, x: g.x,  y: g.y,        down: 1, a: 0 }
  ];
}
function ghostSample(keys, u) {
  let i = 0;
  while (i < keys.length - 2 && u > keys[i + 1].at) i++;
  const a = keys[i], b = keys[i + 1];
  const span = Math.max(1e-4, b.at - a.at);
  const p = clamp((u - a.at) / span, 0, 1);
  const e = p * p * (3 - 2 * p); // smoothstep — a hand does not move linearly
  return {
    x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e,
    down: a.down + (b.down - a.down) * e,
    a: a.a + (b.a - a.a) * e
  };
}
// One thumb, outline only. An outline can sit directly on the dot it is pointing
// at without hiding it, which a filled hand cannot.
function drawThumbGhost(x, y, side, down, alpha, rad) {
  ctx.save();
  ctx.translate(x, y);
  // local +X trails back toward the hand: down-left for the left thumb, down-right
  // for the right. The tip (local -X) therefore points up onto the pad.
  ctx.rotate(side === 'L' ? Math.PI * 0.75 : Math.PI * 0.25);
  const press = 1 - down * 0.12; // the pad flattens very slightly under contact
  ctx.scale(press, press);
  // PARALLEL SIDES, and they stay that way. A thumb is a rounded-ended SHAFT
  // whose width barely changes from tip to knuckle; the tip is a semicircle of
  // the same width as the shaft and nothing narrows. Everything that tapered
  // read as a cone, and a waisted version — anatomically the more correct one,
  // since a real thumb does pinch at its joint — read as a mushroom. Both were
  // tried, both were worse. Do not reintroduce either.
  // The far end is squared and then hidden by the gradients below, so the shape
  // runs off toward a hand out of frame rather than stopping in mid-air.
  const R = rad, HW = R * 0.58, END = R * 2.6;
  ctx.beginPath();
  ctx.arc(0, 0, HW, Math.PI * 0.5, Math.PI * 1.5);            // the tip: a half-round of shaft width
  ctx.quadraticCurveTo(R * 0.9, -HW * 1.02, END, -HW * 1.10); // barely swells toward the hand
  ctx.lineTo(END, HW * 1.10);
  ctx.quadraticCurveTo(R * 0.9, HW * 1.02, 0, HW);
  ctx.closePath();
  const fade = (a) => {
    const g = ctx.createLinearGradient(-R * 0.56, 0, END, 0);
    g.addColorStop(0, `rgba(${GHOST_COL},${a})`);
    g.addColorStop(0.50, `rgba(${GHOST_COL},${a * 0.92})`);
    g.addColorStop(1, `rgba(${GHOST_COL},0)`);
    return g;
  };
  ctx.fillStyle = fade((0.26 + down * 0.14) * alpha);
  ctx.fill();
  // VOLUME. An even fill inside an outline reads as a paper cut-out however good
  // the silhouette is — the thing that makes it a finger is light falling ACROSS
  // it. One gradient perpendicular to the thumb's axis, clipped to the shape:
  // lit along the back, shadowed on the palm side where the form turns away.
  ctx.save();
  ctx.clip();
  const vg = ctx.createLinearGradient(0, -HW * 1.10, 0, HW * 1.10);
  vg.addColorStop(0, `rgba(255,255,255,${(0.20 * alpha).toFixed(3)})`);
  vg.addColorStop(0.42, `rgba(${GHOST_COL},${(0.05 * alpha).toFixed(3)})`);
  vg.addColorStop(1, `rgba(18,30,52,${(0.30 * alpha).toFixed(3)})`);
  ctx.fillStyle = vg;
  ctx.fillRect(-R * 1.2, -R * 1.4, END + R * 2.6, R * 3);
  ctx.restore();
  ctx.strokeStyle = fade((0.85 + down * 0.15) * alpha);
  ctx.lineWidth = 3;
  if (!lowFX) { ctx.shadowColor = `rgba(${GHOST_COL},0.5)`; ctx.shadowBlur = lowFX ? 0 : 9; }
  ctx.stroke();
  ctx.shadowBlur = 0;
  // THE NAIL: a broad plate at the tip, covering most of the digit's width and
  // running well back from the end. A small inset one reads as a bead.
  //
  // THE HEART SHAPE IT USED TO HAVE WAS A TANGENT BUG, not a styling choice. Two
  // quadratics met head-on at the distal midpoint with opposing tangents, which
  // puts a CUSP exactly at the tip — a notch, and the eye reads a notch at the
  // top of a rounded plate as a heart. Cubics with matched tangents fix it:
  // vertical at the two x-extremes, horizontal at the two y-extremes, so every
  // join is smooth by construction and the free edge is one clean curve.
  //
  // No lunula. The half-moon at the base is real anatomy and it read as a stray
  // ring floating inside the plate — detail that survives a photograph does not
  // necessarily survive a 40px translucent overlay.
  const nW = HW * 0.70, nTip = -HW * 0.70, nBase = R * 0.56;
  const nMid = nTip + (nBase - nTip) * 0.42;  // widest point sits forward, as a nail's does
  ctx.beginPath();
  ctx.moveTo(nTip, 0);
  ctx.bezierCurveTo(nTip, -nW * 0.62, nMid - R * 0.16, -nW, nMid, -nW);
  ctx.bezierCurveTo(nBase - R * 0.16, -nW, nBase, -nW * 0.46, nBase, 0);
  ctx.bezierCurveTo(nBase, nW * 0.46, nBase - R * 0.16, nW, nMid, nW);
  ctx.bezierCurveTo(nMid - R * 0.16, nW, nTip, nW * 0.62, nTip, 0);
  ctx.closePath();
  ctx.fillStyle = `rgba(255,255,255,${(0.17 * alpha).toFixed(3)})`;
  ctx.fill();
  ctx.strokeStyle = `rgba(${GHOST_COL},${(0.95 * alpha).toFixed(3)})`;
  ctx.lineWidth = 2.2;
  ctx.stroke();
  // the interphalangeal crease — where the thumb's one joint folds
  ctx.beginPath();
  ctx.moveTo(R * 1.28, -HW * 0.92);
  ctx.quadraticCurveTo(R * 1.46, 0, R * 1.28, HW * 0.92);
  ctx.strokeStyle = `rgba(${GHOST_COL},${(0.30 * alpha).toFixed(3)})`;
  ctx.lineWidth = 1.6;
  ctx.stroke();
  ctx.restore();
  // contact bloom — the moment of the press, drawn unrotated so it stays a circle
  if (down > 0.01) {
    ctx.save();
    ctx.globalAlpha = alpha * (1 - down) * 0.9 + alpha * 0.25;
    ctx.strokeStyle = `rgba(${GHOST_COL},0.9)`;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y, rad * (0.34 + down * 0.42), 0, TAU); ctx.stroke();
    ctx.restore();
  }
}
function drawThumbGhosts(a0) {
  // a controller has no pads to place a thumb on, and a stick arms its own side
  if (typeof gpSeen !== 'undefined' && gpSeen) return;
  if (typeof preT === 'undefined' || preT < GHOST_DELAY) return;
  const t = preT - GHOST_DELAY;
  for (let i = 0; i < 2; i++) {
    if (padHold[i]) continue;               // that thumb has arrived — its ghost has nothing left to say
    const side = i === 0 ? 'L' : 'R';
    const d = dialCenter(side);
    const u = ((t - i * GHOST_STAGGER) / GHOST_CYCLE) % 1;
    if (u < 0) continue;                    // the trailing thumb waits out its stagger
    const s = ghostSample(ghostKeysPlace(side), u);
    drawThumbGhost(s.x, s.y, side, s.down, s.a * a0, d.r * 0.86);
  }
}
// ---------- the drill ghost: a thumb that DRAGS ----------
// The launch gate demonstrates ARRIVING; this demonstrates the verb the whole
// game is played with. A thumb fades in on the pad where the carriage actually
// is, runs the rim the short way round to the mark, settles on it, and fades —
// on a loop, beside the arrow already drawn out on the ring.
//
// IT IS NOT AN ANALOGY. pointerAngle is atan2 about the pad centre and a landing
// touch names that bearing outright (60-input), so a thumb's angle on the rim IS
// its emitter's angle on the ring, one to one. The demonstration and the required
// motion are the same motion, at the same scale.
//
// It replaces the comet that used to lap this rim. Two things sweeping one circle
// is noise, and a lap that never stops says "turn" where a thumb that stops on
// the mark says "turn THIS far" — which is the part nobody was getting.
const DRAG_GHOST_DELAY = 1.1;  // grace before anyone is shown anything
const DRAG_GHOST_CYCLE = 2.4;  // fade in → sweep → settle on the mark → fade out
// The sweep, in the sampler's own currency: `x` carries PROGRESS ALONG THE ARC
// (0 = where the carriage is, 1 = the mark) rather than a screen coordinate, and
// y goes unused. One dimension, same keyframe machinery — which is exactly what
// the note over ghostKeysPlace promised the next lesson would cost.
//
// `down` is 1 throughout: a drag never leaves the glass. Only the launch gate's
// ghost has an approach to animate.
const GHOST_KEYS_DRAG = [
  { at: 0.00, x: 0, y: 0, down: 1, a: 0 },
  { at: 0.12, x: 0, y: 0, down: 1, a: 1 },
  { at: 0.62, x: 1, y: 0, down: 1, a: 1 },
  { at: 0.86, x: 1, y: 0, down: 1, a: 1 }, // holds on the mark — the destination has to read
  { at: 1.00, x: 1, y: 0, down: 1, a: 0 }
];
let dragGhost = [null, null];   // per node: { a, t0, from, gap, lap }
// Returns { u, from } while a demonstration is running, or null — which is the
// answer most of the time, and deliberately so.
function dragGhostState(i, target) {
  const gap = Math.abs(angDiff(target, nodes[i].angle));
  let s = dragGhost[i];
  if (!s || Math.abs(angDiff(s.a, target)) > 1e-3) {   // a new mark is a new lesson
    // the trailing pad is staggered, so two demonstrations read as two hands
    // rather than one mirrored animation
    dragGhost[i] = { a: target, t0: time + DRAG_GHOST_DELAY + i * GHOST_STAGGER, from: nodes[i].angle, gap, lap: -1 };
    return null;
  }
  // THEY ARE DOING IT. Any real progress toward the mark retires the ghost and
  // re-arms the grace, so this only ever surfaces for someone actually stuck —
  // the same rule the launch gate's GHOST_DELAY follows. Moving the WRONG way
  // does not reset it: that is precisely who the demonstration is for.
  if (gap < s.gap - 0.02) {
    s.gap = gap; s.t0 = time + DRAG_GHOST_DELAY; s.lap = -1;
    return null;
  }
  s.gap = Math.min(s.gap, gap);
  if (time < s.t0) return null;
  const lap = Math.floor((time - s.t0) / DRAG_GHOST_CYCLE);
  // RE-READ THE START ON EVERY LOOP, never per frame. Per frame, a partial drag
  // reshapes the path under the thumb and the ghost looks like it is fighting the
  // hand; latched forever, it goes on demonstrating a journey already half made.
  // Once a loop is the honest middle: each pass starts from wherever they left it.
  if (lap !== s.lap) { s.lap = lap; s.from = nodes[i].angle; }
  return { u: ((time - s.t0) % DRAG_GHOST_CYCLE) / DRAG_GHOST_CYCLE, from: s.from };
}
function drawTutDragGhost(i, target) {
  if (typeof gpSeen !== 'undefined' && gpSeen) return; // a stick is not a thumb
  const st = dragGhostState(i, target);
  if (!st) return;
  const side = i === 0 ? 'L' : 'R';
  const d = dialCenter(side);
  const s = ghostSample(GHOST_KEYS_DRAG, st.u);
  const sweep = angDiff(target, st.from);   // the short way round — the same call the ring's arrow makes,
  const a = st.from + sweep * s.x;          // so the pad and the ring can never point opposite ways
  ctx.save();
  // the wake: the ground already covered, so the gesture leaves a LINE and not
  // just a moving object — the part the comet did well, kept
  ctx.lineCap = 'round';
  ctx.strokeStyle = `rgba(${NODE_COLS[i]},${(0.38 * s.a).toFixed(2)})`;
  ctx.lineWidth = d.r * 0.05;
  ctx.beginPath(); ctx.arc(d.x, d.y, d.r, st.from, a, sweep < 0); ctx.stroke();
  ctx.restore();
  // Rides the rim at the pad's own radius, and does NOT rotate with the bearing:
  // the hand is off-frame and a thumb pivots from a knuckle — one that spun to
  // face its heading would read as a compass needle. Smaller than the gate's
  // ghost (0.86), because this pad is already carrying the drill's mark, its
  // bearing dot and its lock tick.
  drawThumbGhost(d.x + Math.cos(a) * d.r, d.y + Math.sin(a) * d.r, side, s.down, s.a * 0.9, d.r * 0.55);
}
// WARP CALIBRATING: the lock-on, drawn around the destination itself.
//
// The first WARP_CAL seconds after launch, before there is any corridor. A ring closes
// clockwise from twelve o'clock with a live percentage, so the thing the player is waiting
// on is the thing they are looking at — and when it completes, the lane resolves out of it.
// Held at 100% for WARP_CAL_HOLD while it fades, so the completion is legible instead of
// vanishing on the frame it lands.
//
// Drawn in the HUD pass rather than in the tunnel, so it sits over the bore the moment the
// bore appears (overlay text on top — the house rule).
function drawWarpCal() {
  if (!introLatch || introT >= WARP_CAL + WARP_CAL_HOLD) return;
  const g = geo(), far = ring(SPAWN_Z, g);
  const p = clamp(introT / WARP_CAL, 0, 1);
  const a0 = introT <= WARP_CAL ? 1 : 1 - (introT - WARP_CAL) / WARP_CAL_HOLD;
  const R = Math.max(26, Math.min(W, H) * 0.085);
  const done = p >= 1;
  const col = done ? '126,226,98' : '143,224,255';
  ctx.save();
  ctx.globalAlpha = a0;
  ctx.lineCap = 'butt';
  // the track, then the sweep over it
  ctx.strokeStyle = 'rgba(120,170,215,0.20)';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(far.x, far.y, R, 0, TAU); ctx.stroke();
  const a1 = -Math.PI / 2, a2 = a1 + p * TAU;
  ctx.strokeStyle = `rgba(${col},0.95)`;
  ctx.lineWidth = 3.5;
  ctx.shadowColor = `rgb(${col})`; ctx.shadowBlur = lowFX ? 0 : 10;
  ctx.beginPath(); ctx.arc(far.x, far.y, R, a1, a2); ctx.stroke();
  ctx.shadowBlur = 0;
  // the leading head, so the sweep has a direction the eye can catch
  if (!done) {
    ctx.fillStyle = '#eafaff';
    ctx.beginPath(); ctx.arc(far.x + Math.cos(a2) * R, far.y + Math.sin(a2) * R, 3.2, 0, TAU); ctx.fill();
  }
  // four tick marks on the quarters — a gauge, not a spinner
  ctx.strokeStyle = `rgba(${col},0.5)`;
  ctx.lineWidth = 1.5;
  for (let k = 0; k < 4; k++) {
    const ta = a1 + k * Math.PI / 2;
    ctx.beginPath();
    ctx.moveTo(far.x + Math.cos(ta) * (R + 4), far.y + Math.sin(ta) * (R + 4));
    ctx.lineTo(far.x + Math.cos(ta) * (R + 8), far.y + Math.sin(ta) * (R + 8));
    ctx.stroke();
  }
  ctx.textAlign = 'center';
  ctx.fillStyle = `rgba(${col},0.95)`;
  ctx.font = '700 11px Audiowide, system-ui';
  try { ctx.letterSpacing = '2px'; } catch (e) {}
  ctx.fillText(done ? 'LANE ACQUIRED' : 'WARP CALIBRATING', far.x, far.y - R - 16);
  try { ctx.letterSpacing = '0px'; } catch (e) {}
  ctx.font = '700 15px ui-monospace, Menlo, monospace';
  ctx.fillText(Math.round(p * 100) + '%', far.x, far.y + R + 24);
  ctx.textAlign = 'left';
  ctx.restore();
}
function drawIntroCard() {
  // A MISSION DISC OWNS ITS SCREEN. The disc and this card are one merged
  // pre-warp screen now (72-tick): the disc carries the identity and the ask,
  // the pads and ghosts carry the demonstration — the level title, the
  // AWAITING RUNNER stamp and the WARP LANE READY plate would all be saying it
  // again underneath. They return the moment the disc is gone: an unbriefed
  // start never shows a disc, and a lifted grip after the disc's release still
  // lands on the plain parked screen, plate and all.
  if (state === S.INFO) return;
  const L = LV || LEVELS[levelIdx];
  // PARKED: the boot has not started. introT is pinned at 0, so the card's own clock is
  // preT — it fades in off the disc release and then simply holds, with no out-fade,
  // because there is no schedule left to run. The route is what the player reads while
  // they decide to launch, so it stays up rather than flashing past.
  const parked = preLaunch();
  if (parked || introT < INTRO_DUR + 0.5) {
    const t = introT;
    ctx.textAlign = 'center';
    if (parked || t < INTRO_DUR) {
      // ONE fade-in clock across both halves. preT counts the parked wait and stops when
      // the boot starts; t counts the boot. Summed, they are monotonic — so the title does
      // not pop back to zero and re-fade on the frame the runner launches, which is what
      // reading `t` alone did.
      const inA = clamp((preT + t) / 0.5, 0, 1);
      const outA = parked ? 1 : clamp((INTRO_DUR - t) / 0.45, 0, 1);
      const scale = 0.85 + 0.15 * (1 - Math.pow(1 - inA, 3));
      ctx.save();
      ctx.translate(W / 2, H * 0.30);
      ctx.scale(scale, scale);
      ctx.globalAlpha = Math.min(inA, outA);
      try { ctx.letterSpacing = '6px'; } catch (e) {}
      const titleMaxW = ringChord(H * 0.30) / scale;
      ctx.fillStyle = 'rgba(200,235,255,0.85)'; ctx.font = '600 13px Audiowide, system-ui';
      ctx.fillText(endless ? 'SURVIVE' : qual ? 'TRAINING' : 'LEVEL ' + lvNum(curLevelNo(levelIdx)), 0, -34);
      // the level IS its route: where the convoy forms up, and where it delivers
      const lname = curRouteName();
      const tpx = fitPx(lname, '800', Math.min(W * 0.055, 32), titleMaxW, 15);
      ctx.fillStyle = '#eafaff'; ctx.font = '800 ' + tpx + 'px Audiowide, system-ui';
      ctx.shadowColor = '#5fd7ff'; ctx.shadowBlur = lowFX ? 0 : 24;
      ctx.fillText(lname, 0, 0);
      ctx.shadowBlur = 0;
      try { ctx.letterSpacing = '0px'; } catch (e) {}
      // (the level's `hint` used to print here — "NEW THREAT: …" in pink under the route.
      //  Cut: on a parked frame whose whole job is one instruction it was a second thing
      //  demanding to be read, and it is the only place hint was ever shown, so nothing
      //  else needs it. The threat now teaches itself in the lane.)
      ctx.restore();
      // parked, the block drops a little: at 0.52 the stamp's cap height ran through the
      // destination, and the destination is the one thing this frame is built to present
      const ly = H * (parked ? 0.585 : 0.52);
      // CALIBRATION OWNS ITS OWN WINDOW, fade included. The readout the player is waiting on
      // is the ring around the destination, so the stage callout stands down rather than
      // stamping LOCKING ON LANE across it — and that has to cover WARP_CAL_HOLD too, or the
      // stamp lands on the ring's own LANE ACQUIRED and 100% while they are still on screen.
      if (introLatch && t < WARP_CAL + WARP_CAL_HOLD) { ctx.textAlign = 'left'; return; }
      // boot stage callouts, stamped like an ops console — no bounce, no chatter.
      // Stage 2 is PARKED (amber, breathing); 0→1→3 are the boot the hands set off. Stage 3
      // no longer gates anything — with the wait moved to the front it is the last beat
      // before control transfers.
      const stI = parked ? 2 : t >= INTRO_GATE ? 3 : t >= BOOT_LOCK ? 1 : 0;
      const stStart = [0, BOOT_LOCK, 0, INTRO_GATE][stI];
      const ct = t - stStart;
      const labels = ['LOCKING ON LANE', 'ACTIVATING EMITTERS', 'AWAITING RUNNER', 'CLEARED FOR RUN'];
      ctx.save();
      ctx.globalAlpha = parked ? (0.8 + Math.sin(time * 2.5) * 0.15) * inA : Math.min(1, ct / 0.06);
      const lcol = parked ? '#ffd24a' : '#8fe0ff';
      ctx.fillStyle = ct < 0.07 ? '#ffffff' : lcol; // one-flash stamp, then steady
      try { ctx.letterSpacing = '5px'; } catch (e) {}
      const bpx = fitPx(labels[stI], '700', Math.min(W * 0.032, 19), ringChord(H * 0.52, 90), 11);
      ctx.font = '700 ' + bpx + 'px Audiowide, system-ui';
      ctx.shadowColor = lcol; ctx.shadowBlur = lowFX ? 0 : 10;
      try { ctx.letterSpacing = '5px'; } catch (e) {}
      ctx.fillText(labels[stI], W / 2, ly + 8);
      const lw2 = ctx.measureText(labels[stI]).width;
      try { ctx.letterSpacing = '0px'; } catch (e) {}
      ctx.shadowBlur = 0;
      // targeting brackets framing the callout
      const bx = lw2 / 2 + 18, by = 15, arm = 7;
      ctx.strokeStyle = parked ? 'rgba(255,210,74,0.6)' : 'rgba(143,224,255,0.55)';
      ctx.lineWidth = 1.5;
      for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        ctx.beginPath();
        ctx.moveTo(W / 2 + sx * bx - sx * arm, ly + sy * by);
        ctx.lineTo(W / 2 + sx * bx, ly + sy * by);
        ctx.lineTo(W / 2 + sx * bx, ly + sy * by - sy * arm);
        ctx.stroke();
      }
      ctx.restore();
      // monospace status readout under the callout — data garnish, ops style
      let sub = '', subT = stStart;
      if (stI === 0) {
        // distance left to the dock, same motion law — but rebased onto the window this
        // readout is actually ON SCREEN for. Measured from t=0 it opened at 4.2M and had
        // nothing left to count, because calibration owns everything before 1.04s.
        const r0 = WARP_CAL + WARP_CAL_HOLD;
        const rp = clamp((t - r0) / Math.max(0.01, BOOT_LOCK - r0), 0, 1);
        const rngM = (1 - rp * rp * (3 - 2 * rp)) * 26;
        sub = 'RANGE ' + rngM.toFixed(1).padStart(5, '0') + ' M';
        subT = t; // live readout — never flash-stamps
      } else if (stI === 1) {
        if (t >= BOOT_ON) { sub = 'ALL SYSTEMS — ONLINE'; subT = BOOT_ON; }
        else if (t >= BOOT_LOCK + 0.3) { sub = 'CHARGING EMITTERS + CONSOLES'; subT = BOOT_LOCK + 0.3; }
        else sub = 'DOCK CONFIRMED';
      } else if (stI === 3) {
        // carried across the boundary rather than re-stamped: the systems came online at
        // BOOT_ON and nothing has changed since, so the readout should not blink
        sub = 'ALL SYSTEMS — ONLINE'; subT = BOOT_ON;
      }
      if (sub) {
        const sct = t - subT;
        ctx.globalAlpha = Math.min(1, sct / 0.05 + 0.4);
        ctx.fillStyle = sct < 0.07 ? 'rgba(235,250,255,0.95)' : 'rgba(150,200,235,0.75)';
        ctx.font = '600 12px ui-monospace, Menlo, monospace';
        ctx.fillText(sub + (Math.sin(time * 6) > 0 ? ' ▎' : '  '), W / 2, ly + 32);
      }
      // the ask sits under the AWAITING RUNNER stamp: 15 clears the callout's brackets,
      // 16 is the breathing room, and drawLaunchTip drops its own half-height below that
      if (parked) drawLaunchTip(inA, ly + 31);
    } else { // CONTROLS ACTIVE — the lane goes live (Lane Command says godspeed)
      const gt = (t - INTRO_DUR) / 0.6;
      ctx.save();
      ctx.translate(W / 2, H * 0.52);
      ctx.globalAlpha = 1 - gt * gt;
      ctx.fillStyle = gt < 0.1 ? '#ffffff' : '#7ee262';
      ctx.font = '800 ' + Math.min(W * 0.055, 34) + 'px Audiowide, system-ui';
      ctx.shadowColor = '#7ee262'; ctx.shadowBlur = lowFX ? 0 : 22;
      try { ctx.letterSpacing = (4 + gt * 6).toFixed(1) + 'px'; } catch (e) {}
      ctx.fillText('CONTROLS ACTIVE', 0, 14);
      try { ctx.letterSpacing = '0px'; } catch (e) {}
      ctx.shadowBlur = 0;
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
  }
}

// ---------- tutorial focus layer ----------
// One descriptor of the live drill feeds both the pad ghosts and the lesson line, so
// the two aids cannot drift apart. Everything here is render-side; the only state is
// which lesson is showing, and that resets when a fresh tutorial starts (the tut
// object changes).
const TUT_LESSON = {
  move:   'SLIDE THE DIALS \u2014 RIDE THE RING',
  normal: 'ALIGN EITHER EMITTER ON THE RED',
  frag:   'EMITTER KILLER \u2014 LET IT PASS',
  wall:   'DEAD ZONE \u2014 GO AROUND',
  heavy:  'DOCK BOTH EMITTERS TOGETHER',
  line:   'COVER BOTH ENDS \u2014 ONE EACH',
  lock0:  'ONLY THE MATCHING PHASE COLLAPSES IT',
  lock1:  'ONLY THE MATCHING PHASE COLLAPSES IT',
  pickup: 'CATCH THE GOLD RELAY',
  strip:  'RIDE THE CROSSING POINT',
  pulse:  'TAP THE GLOWING CORE'
};
const TUT_ACCENT = {
  move: '143,224,255', normal: '255,96,120', frag: '255,154,60', wall: '255,154,60',
  heavy: '143,224,255', line: '111,227,255', lock0: '95,150,255', lock1: '235,244,255',
  pickup: '255,210,74', strip: '255,210,74', pulse: '255,210,74'
};
let tutFocusRef = null;           // which tut object the lesson state belongs to
let tutLessonKind = null, tutLessonT0 = 0; // for the line's fade-in on change
let tutDescNow = null;            // this frame's descriptor, for drawDials to read
function tutFocusDesc(st, ten) {
  // a fresh tutorial is a fresh pupil: the lesson line and any half-run
  // demonstration both belong to the drill that started them
  if (tutFocusRef !== tut) { tutFocusRef = tut; tutLessonKind = null; dragGhost = [null, null]; }
  // what is being taught RIGHT NOW — the enemy knows best (queue drills like the
  // killer ride inside the 'normal' stage), then the stage's own card
  let kind = ten ? ten.tut : null;
  if (!kind && st.card === 'move' && tut.aim && tut.aim.targets) kind = 'move';
  if (!kind && tut.spawned === 'wall' && latches.length) kind = 'wall';
  if (!kind) return null;
  const ghosts = [];  // { i, a, col } — slots to mirror on the dials
  if (kind === 'move') {
    for (const t of tut.aim.targets) ghosts.push({ i: t.node, a: t.a, col: NODE_COLS[t.node] });
  } else if (ten) {
    if (kind === 'normal') {
      const i = nodes[0] === (Math.abs(angDiff(nodes[0].angle, ten.angle)) <
        Math.abs(angDiff(nodes[1].angle, ten.angle)) ? nodes[0] : nodes[1]) ? 0 : 1;
      ghosts.push({ i, a: ten.angle, col: NODE_COLS[i] });
    } else if (kind === 'heavy') {
      ghosts.push({ i: 0, a: ten.angle, col: NODE_COLS[0] }, { i: 1, a: ten.angle, col: NODE_COLS[1] });
    } else if (kind === 'line' && ten.partner) {
      // each pad takes the end its node is nearer — the same neutral the guide uses
      const aA = ten.angle, aB = ten.partner.angle;
      const straight = Math.abs(angDiff(nodes[0].angle, aA)) + Math.abs(angDiff(nodes[1].angle, aB))
                    <= Math.abs(angDiff(nodes[0].angle, aB)) + Math.abs(angDiff(nodes[1].angle, aA));
      ghosts.push({ i: 0, a: straight ? aA : aB, col: '111,227,255' },
                  { i: 1, a: straight ? aB : aA, col: '111,227,255' });
    } else if (kind === 'lock0' || kind === 'lock1') {
      const i = ten.lock;
      if (i === 0 || i === 1) ghosts.push({ i, a: ten.angle, col: NODE_COLS[i] });
    } else if (kind === 'pickup') {
      const i = Math.abs(angDiff(nodes[0].angle, ten.angle)) <
                Math.abs(angDiff(nodes[1].angle, ten.angle)) ? 0 : 1;
      ghosts.push({ i, a: ten.angle, col: '255,210,74' });
    } else if (kind === 'strip') {
      const kX = clamp(geo().hitZ - ten.z, 0, ten.len);
      const aS = stripAngle(ten, kX);
      const i = Math.abs(angDiff(nodes[0].angle, aS)) <
                Math.abs(angDiff(nodes[1].angle, aS)) ? 0 : 1;
      ghosts.push({ i, a: aS, col: '255,210,74' });
    }
    // frag and the dead zone ghost nothing — the drill is DODGE, and a ghost says "go here"
  }
  return { kind, ghosts };
}
// The ghost: the drill's slot ON THE DIAL, at the same bearing and in the same
// colour as its ring slot. Lands (solid + lock tick) when the node is inside the
// SAME tolerance the ring uses, so the two views can never disagree about "close".
function drawTutPadGhosts(desc) {
  for (const gh of desc.ghosts) {
    const d = dialCenter(gh.i === 0 ? 'L' : 'R');
    const TOLm = ARCFX.span * tolVis;
    const span = Math.max(0.22, TOLm);
    const on = nodes[gh.i].deadT <= 0 && Math.abs(angDiff(nodes[gh.i].angle, gh.a)) < TOLm;
    const puls = on ? 1 : 0.55 + 0.45 * Math.sin(time * 5);
    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(' + gh.col + ',' + (0.20 * puls).toFixed(2) + ')';
    ctx.lineWidth = d.r * 0.30;
    ctx.beginPath(); ctx.arc(d.x, d.y, d.r, gh.a - span, gh.a + span); ctx.stroke();
    ctx.strokeStyle = 'rgba(' + gh.col + ',' + ((on ? 0.95 : 0.7) * puls).toFixed(2) + ')';
    ctx.lineWidth = d.r * 0.10;
    ctx.beginPath(); ctx.arc(d.x, d.y, d.r, gh.a - span, gh.a + span); ctx.stroke();
    // the exact bearing, as a dot just outside the track — the "put it HERE"
    const mx = d.x + Math.cos(gh.a) * d.r * 1.22, my = d.y + Math.sin(gh.a) * d.r * 1.22;
    ctx.fillStyle = 'rgba(' + gh.col + ',' + (0.9 * puls).toFixed(2) + ')';
    ctx.beginPath(); ctx.arc(mx, my, d.r * 0.055 * (on ? 1.4 : 1), 0, TAU); ctx.fill();
    if (on) { // landed: a lock tick winds around the knob, same read as the ring's
      ctx.strokeStyle = 'rgba(' + gh.col + ',0.9)';
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(d.x + Math.cos(gh.a) * d.r, d.y + Math.sin(gh.a) * d.r,
        d.r * 0.16, -Math.PI / 2, -Math.PI / 2 + TAU * 0.999); ctx.stroke();
    }
    ctx.restore();
  }
}
function drawTutLessonLine(desc) {
  const msg = TUT_LESSON[desc.kind];
  if (!msg) return;
  if (tutLessonKind !== desc.kind) { tutLessonKind = desc.kind; tutLessonT0 = time; }
  const a = Math.min(1, (time - tutLessonT0) / 0.35);
  const u = Math.min(W, H);
  const col = TUT_ACCENT[desc.kind] || '143,224,255';
  ctx.save();
  ctx.textAlign = 'center';
  ctx.font = '700 ' + Math.round(u * 0.030) + 'px Audiowide, system-ui';
  const y = H - Math.max(SAFE.b, 8) - u * 0.022;
  ctx.fillStyle = 'rgba(4,8,18,' + (0.55 * a).toFixed(2) + ')';
  const w2 = ctx.measureText(msg).width;
  roundRect(W / 2 - w2 / 2 - u * 0.018, y - u * 0.036, w2 + u * 0.036, u * 0.048, 6); ctx.fill();
  ctx.fillStyle = 'rgba(' + col + ',' + (0.95 * a).toFixed(2) + ')';
  ctx.fillText(msg, W / 2, y);
  ctx.restore();
  ctx.textAlign = 'left';
}
function drawHUD(g) {
  const L = LV || LEVELS[levelIdx];
  const pad = 14;

  // left curved bar: LEVEL PROGRESS (green, hugs the node ring like the mock)
  // radius is clamped so the arc tips + stroke casing always stay on screen —
  // on wide phones the unclamped radius pushed the tips past the top edge
  const bw2 = Math.max(9, Math.min(W, H) * 0.024);
  // tips ride lower (0.34π → 0.28π) so the arcs can sit farther out without
  // clipping the screen edge — clear breathing room between bar and ring
  const ELEV = Math.PI * 0.28;
  const barR = Math.min(g.nodeR + Math.min(W, H) * 0.125, (H / 2 - bw2 - 8) / Math.sin(ELEV));
  const aL0 = Math.PI * 1.06, aL1 = Math.PI + ELEV; // lower-left → upper-left
  // THE GAUGES ARE CONSOLE HARDWARE. They come up on the SAME ramp as the pads, so the
  // whole assembly — ring, arcs, consoles, gauges — powers on as one machine. Parked,
  // there is nothing to hang them on, and a full integrity bar lit over an empty cockpit
  // was by some distance the loudest thing in a frame meant to be stars and a planet.
  //
  // preLaunch FIRST: it is true in S.PLAY, S.PAUSE and S.INFO alike, and the pre-run
  // mission disc is the pre-warp screen now — the arcs must not hang over it any more
  // than over the plain parked lane. The old order asked "which state" before asking
  // "is a run armed", so S.INFO fell into the everything-else 1 and the disc screen
  // wore a lit progress bar over a lane that had not moved. Mid-run cards still read
  // 1 through the state line, exactly as before.
  const gaugeA = preLaunch() ? 0
    : (state !== S.PLAY && state !== S.PAUSE) ? 1
    : introT < INTRO_DUR ? clamp((introT - BOOT_LOCK) / (BOOT_ON - BOOT_LOCK), 0, 1) : 1;
  // THE GAUGES ARRIVE, THEY DO NOT APPEAR. The power ramp used to be alpha alone —
  // hardware fading in place reads as a screen element, not as a thing being raised.
  // Each arc rides a small diagonal slide during the same ramp: in from its own upper
  // outboard corner, settling down onto the ring as the alpha lands. Eased out, so
  // the movement is over before the eye can measure it; zero everywhere but the boot
  // (gaugeA is 0 or 1 there), so replays, cards and the report are byte-identical.
  const gIn = 1 - Math.pow(1 - gaugeA, 3);
  const gs = Math.min(W, H) * 0.035 * (1 - gIn);
  ctx.save();
  ctx.globalAlpha = gaugeA;
  ctx.lineCap = 'round';
  ctx.save();
  ctx.translate(-gs, -gs * 0.7); // the left arc's diagonal: in from the upper left
  ctx.strokeStyle = 'rgba(240,250,255,0.85)'; ctx.lineWidth = bw2 + 5;
  ctx.beginPath(); ctx.arc(g.cx, g.cy, barR, aL0, aL1); ctx.stroke();
  ctx.strokeStyle = '#050a12'; ctx.lineWidth = bw2 + 2;
  ctx.beginPath(); ctx.arc(g.cx, g.cy, barR, aL0, aL1); ctx.stroke();
  // left arc: level progress · endless ramp · CORE health during the duel — or,
  // while watching a replay, the run's position (so it doubles as the scrub bar)
  const prog = replaying ? clamp(tracePlay ? tracePlay.i / Math.max(1, replayMeta.total) : 1, 0, 1)
    : boss ? clamp(boss.hp / boss.maxHp, 0, 1) : endless ? clamp(levelT / 150, 0, 1) : clamp(levelT / L.duration, 0, 1);
  if (prog > 0.005) {
    const aEnd = aL0 + (aL1 - aL0) * prog;
    ctx.strokeStyle = boss ? '#d465ff' : endless ? '#ff9a3c' : '#7ee262';
    ctx.lineWidth = bw2 - 4;
    ctx.beginPath(); ctx.arc(g.cx, g.cy, barR, aL0, aEnd); ctx.stroke();
    if (!boss) { // directional filler: chevrons march toward the tip — forward
      const hw2 = (bw2 - 4) / 2;
      ctx.save();
      ctx.beginPath();
      ctx.arc(g.cx, g.cy, barR + hw2, aL0, aEnd);
      ctx.arc(g.cx, g.cy, barR - hw2, aEnd, aL0, true);
      ctx.closePath(); ctx.clip();
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      const da = 0.05, cw3 = 0.024;               // spacing + chevron depth (rad)
      for (let a2 = aL0 + (time * 0.22) % da; a2 < aEnd + cw3; a2 += da) {
        ctx.beginPath();                          // apex leads, arms trail behind
        ctx.moveTo(g.cx + Math.cos(a2 - cw3) * (barR + hw2 * 0.7), g.cy + Math.sin(a2 - cw3) * (barR + hw2 * 0.7));
        ctx.lineTo(g.cx + Math.cos(a2) * barR, g.cy + Math.sin(a2) * barR);
        ctx.lineTo(g.cx + Math.cos(a2 - cw3) * (barR - hw2 * 0.7), g.cy + Math.sin(a2 - cw3) * (barR - hw2 * 0.7));
        ctx.stroke();
      }
      ctx.restore();
      // glowing head at the fill's leading edge, breathing
      const hx3 = g.cx + Math.cos(aEnd) * barR, hy3 = g.cy + Math.sin(aEnd) * barR;
      const hcol = endless ? '255,154,60' : '126,226,98';
      const hp2 = 0.5 + 0.25 * Math.sin(time * 5);
      const hg3 = ctx.createRadialGradient(hx3, hy3, 0, hx3, hy3, bw2 * 1.15);
      hg3.addColorStop(0, `rgba(255,255,255,${hp2.toFixed(2)})`);
      hg3.addColorStop(0.45, `rgba(${hcol},${(hp2 * 0.7).toFixed(2)})`);
      hg3.addColorStop(1, `rgba(${hcol},0)`);
      ctx.fillStyle = hg3;
      ctx.beginPath(); ctx.arc(hx3, hy3, bw2 * 1.15, 0, TAU); ctx.fill();
    }
  }

  // replay: this arc IS the scrub bar — expose its geometry + draw a grab knob
  if (replaying) {
    replayArc = { cx: g.cx, cy: g.cy, r: barR, a0: aL0, a1: aL1, bw: bw2 };
    const ka = aL0 + (aL1 - aL0) * prog, kx = g.cx + Math.cos(ka) * barR, ky = g.cy + Math.sin(ka) * barR;
    const kr = replayScrub ? 12 : 9;
    ctx.fillStyle = '#eaf6ff'; ctx.beginPath(); ctx.arc(kx, ky, kr, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(140,220,255,0.95)'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(kx, ky, kr, 0, TAU); ctx.stroke();
  }
  ctx.restore(); // end of the left arc's slide

  // right curved bar: 4 life blocks — or a continuous hitpoint bar during the
  // duel. Wears the SAME casing + capsule ends as the progress bar across the
  // bore (same length, same edge radius); only the seams inside stay flat.
  const aR0 = -Math.PI * 0.06, aR1 = -ELEV; // mirrored: lower-right → upper-right
  ctx.save();
  ctx.translate(gs, -gs * 0.7); // the right arc mirrors the slide: in from the upper right
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(240,250,255,0.85)'; ctx.lineWidth = bw2 + 5;
  ctx.beginPath(); ctx.arc(g.cx, g.cy, barR, aR1, aR0); ctx.stroke();
  ctx.strokeStyle = '#050a12'; ctx.lineWidth = bw2 + 2;
  ctx.beginPath(); ctx.arc(g.cx, g.cy, barR, aR1, aR0); ctx.stroke();
  if (boss) {
    const hpF = clamp(integrity / 100, 0, 1);
    if (hpF > 0.005) {
      ctx.strokeStyle = hpF > 0.5 ? '#7ee262' : hpF > 0.25 ? '#ffb340' : '#ff4a5e';
      ctx.lineWidth = bw2 - 4;
      ctx.beginPath(); ctx.arc(g.cx, g.cy, barR, aR0 - (aR0 - aR1) * hpF, aR0); ctx.stroke();
    }
  } else {
    const MAXM = 4, blocksLeft = Math.max(0, Math.ceil(integrity / 25));
    const span = (aR0 - aR1) / MAXM, gap2 = span * 0.07; // thin seams keep them reading as one bar
    const blockCol = i => i < blocksLeft ? '#8fc7ff' : '#0c1626'; // opaque, so caps overlap invisibly
    ctx.lineCap = 'butt';
    ctx.lineWidth = bw2 - 4;
    for (let i = 0; i < MAXM; i++) {
      const s0 = aR0 - (i + 1) * span + (i === MAXM - 1 ? 0 : gap2 / 2);
      const s1 = aR0 - i * span - (i === 0 ? 0 : gap2 / 2);
      ctx.strokeStyle = blockCol(i);
      ctx.beginPath(); ctx.arc(g.cx, g.cy, barR, s0, s1); ctx.stroke();
    }
    // capsule tips: only the whole bar's two ends are rounded, seams stay flat
    ctx.lineCap = 'round';
    for (const [ea, i] of [[aR0, 0], [aR1, MAXM - 1]]) {
      ctx.strokeStyle = blockCol(i);
      ctx.beginPath(); ctx.arc(g.cx, g.cy, barR, ea - 0.0004, ea + 0.0004); ctx.stroke();
    }
  }
  ctx.restore(); // end of the right arc's slide
  ctx.restore(); // end of the gauge assembly's power-up alpha
  ctx.lineCap = 'round';

  // score (right) — suppressed while watching a replay; drawReplayChrome owns the
  // right side there (live score + the run's stat panel).
  // CONSOLE HARDWARE TOO (F-008 correction): a zero lit over a parked ship is the
  // same lie the full integrity bar was. The readout rides the gauges' own power
  // ramp and diagonal — hidden on the whole pre-warp screen, in from the upper
  // right with the stability arc when the warp starts. The PAUSE key below stays
  // out of this block on purpose: it is chrome, not hardware, and the parked
  // screen still needs it.
  ctx.save();
  ctx.globalAlpha = gaugeA;
  ctx.translate(gs, -gs * 0.7);
  const sy = H * 0.12;
  if (!replaying && assist) {
    // the assisted lane flies without a score — the tag stands where the
    // number would, so nobody hunts the HUD for missing points
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(140,210,255,0.85)'; ctx.font = '700 13px Audiowide, system-ui';
    ctx.fillText('LANE ASSIST', W - pad - SAFE.r, sy + 8);
    ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.font = '600 9px Audiowide, system-ui';
    ctx.fillText('NO SCORE', W - pad - SAFE.r, sy + 22);
    ctx.textAlign = 'left';
  } else if (!replaying) {
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffd24a'; ctx.font = '700 20px Audiowide, system-ui';
    ctx.fillText(score.toLocaleString(), W - pad - SAFE.r, sy + 8);
    ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.font = '600 10px Audiowide, system-ui';
    ctx.fillText('SCORE', W - pad - SAFE.r, sy + 24);
    if (combo >= 3) {
      ctx.fillStyle = '#ffd24a'; ctx.font = '700 14px Audiowide, system-ui';
      ctx.fillText('COMBO x' + scoreMul(), W - pad - SAFE.r, sy + 48);
    }
    const mm = mutMul();
    if (mm > 1) {
      ctx.fillStyle = 'rgba(255,210,74,0.85)'; ctx.font = '700 11px Audiowide, system-ui';
      ctx.fillText('MODIFIERS ×' + (Math.round(mm * 100) / 100), W - pad - SAFE.r, sy + 66);
    }
    ctx.textAlign = 'left';
  }
  ctx.restore(); // end of the score readout's power-up ramp

  // while watching a replay the whole HUD-corner is replay chrome (EXIT top-right,
  // transport left, scrub bottom); otherwise the normal PAUSE button (top-left)
  if (replaying) {
    pauseBtnRect = null;
    drawReplayChrome();
  } else {
    pauseBtnRect = { x: 12 + SAFE.l, y: 12 + SAFE.t, w: 38, h: 38 };
    techRect(pauseBtnRect.x, pauseBtnRect.y, pauseBtnRect.w, pauseBtnRect.h, 8);
    ctx.fillStyle = 'rgba(6,20,40,0.6)'; ctx.fill();
    ctx.strokeStyle = 'rgba(120,220,255,0.55)'; ctx.lineWidth = 1.5;
    techRect(pauseBtnRect.x, pauseBtnRect.y, pauseBtnRect.w, pauseBtnRect.h, 8); ctx.stroke();
    ctx.fillStyle = 'rgba(220,245,255,0.92)';
    ctx.fillRect(pauseBtnRect.x + 12, pauseBtnRect.y + 11, 5, 16);
    ctx.fillRect(pauseBtnRect.x + 21, pauseBtnRect.y + 11, 5, 16);
  }

  // H-07: BACK off the pre-warp disc — a left-arrow, top-right, bound to B. Only on
  // the briefed pre-warp screen; every other S.INFO card is dismissed, not exited.
  discBackRect = null;
  if (state === S.INFO && preLaunch()) {
    const bw = 38, bh2 = 38;
    discBackRect = { x: W - 12 - SAFE.r - bw, y: 12 + SAFE.t, w: bw, h: bh2 };
    techRect(discBackRect.x, discBackRect.y, bw, bh2, 8);
    ctx.fillStyle = 'rgba(6,20,40,0.6)'; ctx.fill();
    ctx.strokeStyle = 'rgba(120,220,255,0.55)'; ctx.lineWidth = 1.5;
    techRect(discBackRect.x, discBackRect.y, bw, bh2, 8); ctx.stroke();
    const cx3 = discBackRect.x + bw / 2, cy3 = discBackRect.y + bh2 / 2;
    ctx.strokeStyle = 'rgba(220,245,255,0.92)'; ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(cx3 + 7, cy3); ctx.lineTo(cx3 - 7, cy3);                                  // shaft
    ctx.moveTo(cx3 - 2, cy3 - 6); ctx.lineTo(cx3 - 8, cy3); ctx.lineTo(cx3 - 2, cy3 + 6); // head
    ctx.stroke();
    ctx.lineCap = 'butt';
  }

  // resume countdown after unpausing
  if (resumeHold > 0) {
    const d2 = Math.max(1, Math.ceil(resumeHold / 0.3));
    ctx.textAlign = 'center';
    ctx.globalAlpha = 0.92;
    ctx.fillStyle = '#ffd24a';
    ctx.font = '800 ' + Math.min(W * 0.08, 46) + 'px Audiowide, system-ui';
    ctx.shadowColor = '#ffd24a'; ctx.shadowBlur = lowFX ? 0 : 20;
    ctx.fillText(d2, W / 2, H * 0.45);
    ctx.shadowBlur = 0; ctx.globalAlpha = 1; ctx.textAlign = 'left';
  }

  // active power-up chips (top center) — each chip sizes to its own label;
  // an armed shield rides the row too (cyan, no timer: it waits, not ticks)
  const chips = Object.keys(fx).filter(k => fx[k] > 0)
    .map(k => ({ label: PICKUPS[k].label, frac: clamp(fx[k] / PICKUPS[k].dur, 0, 1) }));
  if (shieldCharge > 0) chips.unshift({ label: 'SHIELD ARMED', cyan: true });
  if (chips.length) {
    ctx.font = '700 10px Audiowide, system-ui';
    const cws = chips.map(c => Math.ceil(ctx.measureText(c.label).width) + 18);
    let x0 = W / 2 - (cws.reduce((a, b) => a + b, 0) + (chips.length - 1) * 8) / 2;
    chips.forEach((c, i) => {
      const cw = cws[i], chh = 20;
      const y0 = 14 + SAFE.t;
      techRect(x0, y0, cw, chh, 6);
      ctx.fillStyle = c.cyan ? 'rgba(8,38,58,0.65)' : 'rgba(60,40,5,0.65)'; ctx.fill();
      ctx.strokeStyle = c.cyan ? 'rgba(143,224,255,0.8)' : 'rgba(255,210,74,0.8)'; ctx.lineWidth = 1;
      techRect(x0, y0, cw, chh, 6); ctx.stroke();
      ctx.fillStyle = c.cyan ? '#d9f2ff' : '#ffe9b0'; ctx.textAlign = 'left';
      ctx.fillText(c.label, x0 + 9, y0 + 14);
      if (c.frac !== undefined) {
        ctx.fillStyle = 'rgba(255,210,74,0.9)';
        ctx.fillRect(x0, y0 + chh + 3, cw * c.frac, 2);
      }
      x0 += cw + 8;
    });
  }

  // intercepted transmission ticker — voices on the line you're guarding.
  // H-32: a BROADCAST SUBTITLE — the speaker tag stands on its own line and the
  // message takes the whole chord beneath it, wrapped on word gaps. The old form
  // packed chip + message into ONE chord: the fitter shrank everything to 8-10px
  // and the chip's border sat 1px off the first glyph, so every bark read
  // cramped and glued to its title. Stacked, the message holds 13px.
  if (commCur && state === S.PLAY) {
    const SPK = SPKCOL; // speaker colors come with the campaign package
    const label = '\u00bb ' + commCur.s;
    // the fade-out must END at barkHold, where the tick retires the line — a
    // hard-coded 6 here once outlived a hold of 4, so every bark cut at full
    // alpha and the authored fade never played
    const fade = commT < 0.2 ? commT / 0.2 : clamp((barkHold - commT) / 0.8, 0, 1);
    ctx.save();
    ctx.globalAlpha = Math.min(1, fade);
    ctx.textAlign = 'left';
    const spkCol = SPK[commCur.s] || '160,215,255';
    // No portrait tile: only two of seven speakers ever had their own face, so the
    // rest wore haulage's suit and the tile said less than the name chip does.
    const tagY = Math.max(14 + SAFE.t + 32, H * 0.15); // tag baseline, inside the bore
    ctx.font = '700 9px Audiowide, system-ui';
    try { ctx.letterSpacing = '2px'; } catch (e) {}
    const lw2 = ctx.measureText(label).width;
    ctx.fillStyle = `rgba(${spkCol},0.16)`;
    roundRect(W / 2 - lw2 / 2 - 9, tagY - 12, lw2 + 18, 17, 5); ctx.fill();
    ctx.strokeStyle = `rgba(${spkCol},0.55)`; ctx.lineWidth = 1;
    roundRect(W / 2 - lw2 / 2 - 9, tagY - 12, lw2 + 18, 17, 5); ctx.stroke();
    ctx.fillStyle = `rgba(${spkCol},0.95)`;
    ctx.fillText(label, W / 2 - lw2 / 2, tagY + 1);
    try { ctx.letterSpacing = '0px'; } catch (e) {}
    // the message: word-wrapped to the chord at each row's own y. 13px unless a
    // long line forces smaller; two rows normally, three only at the 10px floor.
    // (letterSpacing is reset above, so charXs's font-keyed cache stays honest)
    const LH = 16, y1 = tagY + 18;
    const wrapRows = (max) => {
      const rows = []; let line = '';
      for (const w2 of commCur.m.split(' ')) {
        const cand = line ? line + ' ' + w2 : w2;
        if (ctx.measureText(cand).width <= ringChord(y1 + rows.length * LH, 26)) { line = cand; continue; }
        if (line) rows.push(line);
        line = w2;
        if (rows.length >= max) return null; // this size needs too many rows
      }
      if (line) rows.push(line);
      return rows.length > max ? null : rows;
    };
    let rows = null;
    for (let mfz = 13; !rows && mfz >= 10; mfz--) {
      ctx.font = '500 ' + mfz + 'px Audiowide, system-ui';
      rows = wrapRows(mfz > 10 ? 2 : 3);
    }
    if (!rows) rows = [commCur.m]; // pathological unbreakable line: draw it anyway
    // the glyphs arrive on the briefing's own fade (H-20), the one voice all
    // resolving text shares. No lead: a bark is live comms. The stagger index
    // runs on through the wrap, so a wrapped line still reads as one breath.
    let j0 = 0, lastA = -1;
    for (let r2 = 0; r2 < rows.length; r2++) {
      const row = rows[r2], yr = y1 + r2 * LH;
      const xs = charXs(row, ctx.font);
      const rx0 = W / 2 - xs[row.length] / 2;
      for (let j = 0; j < row.length; j++) {
        const a = clamp((commT - (j0 + j) * LINE_STAGGER) / LINE_FADE, 0, 1);
        if (a < 0.005 || row[j] === ' ') continue;
        const q = Math.round(a * 20) / 20;
        if (q !== lastA) { ctx.fillStyle = 'rgba(200,235,255,' + (0.92 * q).toFixed(3) + ')'; lastA = q; }
        ctx.fillText(row[j], rx0 + xs[j], yr);
      }
      j0 += row.length + 1; // the swallowed break space keeps the cadence
    }
    ctx.restore();
  }

  // surge countdown: the header holds, the digits slam in beneath it
  if (endless && !boss && state === S.PLAY) {
    const surge = Math.floor(levelT / 100);
    const toNext = (surge + 1) * 100 - levelT;
    if (toNext <= 4.2 && toNext > 0) {
      const cnt = Math.ceil(toNext);
      const ct = 1 - (toNext - Math.floor(toNext)); // 0..1 through the current second
      const pop = 1.6 - 0.6 * Math.min(ct / 0.25, 1);
      const al = ct < 0.12 ? ct / 0.12 : 1;
      ctx.save();
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(255,154,60,0.92)';
      try { ctx.letterSpacing = '4px'; } catch (e) {}
      // surges past 6 press density, not speed — the header says which is coming
      const hdr = surge >= 6 ? 'PRESSURE RISING' : 'SPEEDING UP';
      ctx.font = '700 ' + fitPx(hdr, '700', 14, ringChord(H * 0.24, 60), 10) + 'px Audiowide, system-ui';
      ctx.fillText(hdr, W / 2, H * 0.24);
      try { ctx.letterSpacing = '0px'; } catch (e) {}
      ctx.translate(W / 2, H * 0.36);
      ctx.scale(pop, pop);
      ctx.globalAlpha = al;
      ctx.fillStyle = '#ffd24a';
      ctx.font = '800 42px Audiowide, system-ui';
      ctx.shadowColor = '#ff9a3c'; ctx.shadowBlur = lowFX ? 0 : 20;
      ctx.fillText(cnt, 0, 14);
      ctx.shadowBlur = 0;
      ctx.restore();
      ctx.textAlign = 'left';
    }
  }

  // qualification guides — the arrows do ALL the teaching, no captions
  // (held until the boot ceremony hands over the controls)
  // FIRST CONTACT WITH ARMOR, outside the drill. The campaign lane that
  // INTRODUCES heavies re-teaches the dock exactly where it first bites: the
  // run's FIRST heavy wears the qualification's own guides — both arrows, the
  // split dock spot, the words — until it resolves, and only while the lane
  // is still unsecured (stars 0). Draw-only: the sim never reads any of it.
  if (!tut && !endless && !qual && levelIdx >= 0 && introT >= INTRO_DUR
      && PROG && PROG.stars && PROG.stars[levelIdx] === 0
      && levelIdx === LEVELS.findIndex(l => (l.heavies || 0) > 0)) {
    if (heavyCue === null) {
      const hv = enemies.find(e => e.type === 'heavy' && !e.dead && !e.resolved && !e.failed);
      if (hv) heavyCue = hv;
    } else if (heavyCue !== 'done' && (heavyCue.dead || heavyCue.resolved || heavyCue.failed)) heavyCue = 'done';
    if (heavyCue && heavyCue !== 'done') {
      drawGuideArc(nodes[0], heavyCue.angle); drawGuideArc(nodes[1], heavyCue.angle);
      drawDockSpot(heavyCue.angle);
      drawRideLabel('USE BOTH EMITTERS', heavyCue, '#8fe0ff');
    }
  }
  tutDescNow = null; // stale ghosts must not survive the drill that made them
  if (tut && tut.stage >= 0 && introT >= INTRO_DUR) {
    const st = QUAL[tut.stage];
    { // curriculum pips: one per drill, so the pupil can SEE the finish line
      const nP = QUAL.length - 1; // 'done' is the ceremony, not a drill
      const uP = Math.min(W, H), gap = uP * 0.032;
      const x0 = W / 2 - (nP - 1) * gap / 2, y0 = SAFE.t + uP * 0.045;
      for (let i = 0; i < nP; i++) {
        const done2 = i < tut.stage, cur = i === tut.stage;
        ctx.globalAlpha = cur ? 0.7 + Math.sin(time * 5) * 0.3 : 1;
        ctx.fillStyle = done2 ? 'rgba(126,226,98,0.9)' : cur ? 'rgba(143,224,255,0.95)' : 'rgba(90,120,160,0.4)';
        ctx.beginPath(); ctx.arc(x0 + i * gap, y0, uP * (done2 || cur ? 0.008 : 0.0055), 0, TAU); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    if (st.card === 'done') drawQualCeremony(tut.t);
    // (No stage banner. Each drill used to announce itself in a stack of text
    // across the CENTER of the bore — the one place the traffic comes from. The
    // labels that ride the traps say the same thing where the eye already is.)
    const nn = a => Math.abs(angDiff(nodes[0].angle, a)) < Math.abs(angDiff(nodes[1].angle, a)) ? nodes[0] : nodes[1];
    const ten = enemies.find(e => e.tut && !e.dead && !e.resolved);

    // ---------- THE FOCUS LAYER ----------
    // Two aids that share one description of the live drill, so they can never
    // disagree about what is being taught (a spotlight dim lived here briefly —
    // Gil cut it on review):
    //   · PAD GHOSTS — the target slot drawn ON THE DIAL at the same bearing, in the
    //     same colour as its ring slot. Every other aid lives on the ring; nothing
    //     ever taught that the pad IS the ring in miniature, and that mapping is the
    //     entire control scheme.
    //   · a LESSON LINE — one imperative above the bottom edge naming the live drill.
    //     The disc gets dismissed and then memory has to carry the lesson; this
    //     carries it instead. Bottom band, never the centre: the centre is where the
    //     traffic arrives from, which is why the stage banners died.
    // All render-only. No sim state, no Math.random, nothing pushed into sim arrays.
    const desc = tutFocusDesc(st, ten);
    if (desc) drawTutLessonLine(desc);
    // the pad ghosts are NOT drawn here: drawDials() runs after drawHUD and lays the
    // dial chrome over anything painted now. The desc is stashed and drawDials calls
    // drawTutPadGhosts itself, last, so the ghost sits on top of the finished dial.
    tutDescNow = desc;

    if (st.card === 'move' && tut.aim.targets) {
      // ALIGN drill: each lit target is a spot on the ring to bring its node
      // onto. The tolerance window glows, a dashed dock marker + a guide arrow
      // from the node point the way, and a ring fills as the node holds on it.
      const A = tut.aim, uT = Math.min(W, H), gT = geo(), TOLm = ARCFX.span * tolVis;
      const holdFrac = clamp(A.hold / AIM_HOLD, 0, 1);
      for (const t of A.targets) {
        const colD = t.node === 0 ? '95,150,255' : '235,244,255';
        const col = `rgba(${colD},0.95)`;
        const cov = nodes[t.node].deadT <= 0 && Math.abs(angDiff(nodes[t.node].angle, t.a)) < TOLm;
        const puls = 0.6 + 0.4 * Math.sin(time * 5);
        const px = gT.cx + Math.cos(t.a) * gT.nodeR, py = gT.cy + Math.sin(t.a) * gT.nodeR;
        // the slot: a bright glowing window on the ring band, additive so it
        // reads over the dark metal — a soft halo under a hot core arc
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineCap = 'round';
        ctx.strokeStyle = `rgba(${colD},${(0.22 * puls).toFixed(2)})`;
        ctx.lineWidth = uT * 0.05;
        ctx.beginPath(); ctx.arc(gT.cx, gT.cy, gT.nodeR, t.a - TOLm, t.a + TOLm); ctx.stroke();
        ctx.strokeStyle = `rgba(${colD},${(0.8 * puls).toFixed(2)})`;
        ctx.lineWidth = uT * 0.018;
        ctx.beginPath(); ctx.arc(gT.cx, gT.cy, gT.nodeR, t.a - TOLm, t.a + TOLm); ctx.stroke();
        // end caps + an inward chevron marking the slot center
        ctx.fillStyle = col;
        for (const e of [-1, 1]) {
          const ca = t.a + e * TOLm;
          ctx.beginPath(); ctx.arc(gT.cx + Math.cos(ca) * gT.nodeR, gT.cy + Math.sin(ca) * gT.nodeR, uT * 0.008, 0, TAU); ctx.fill();
        }
        const mR = gT.nodeR + uT * 0.045 * (1 + 0.12 * Math.sin(time * 5));
        const mx = gT.cx + Math.cos(t.a) * mR, my = gT.cy + Math.sin(t.a) * mR;
        ctx.translate(mx, my); ctx.rotate(t.a);   // chevron points inward, toward the bore
        ctx.beginPath(); ctx.moveTo(-uT * 0.014, -uT * 0.012); ctx.lineTo(0, 0); ctx.lineTo(-uT * 0.014, uT * 0.012);
        ctx.lineWidth = uT * 0.006; ctx.strokeStyle = col; ctx.stroke();
        ctx.restore();
        drawGuideArc(nodes[t.node], t.a, col);     // arrow from the node (hides on arrival)
        // hold-to-lock progress: a ring winding up while the node sits on target
        if (cov && holdFrac > 0) {
          ctx.strokeStyle = col; ctx.lineWidth = 4; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.arc(px, py, uT * 0.045, -Math.PI / 2, -Math.PI / 2 + holdFrac * TAU); ctx.stroke();
        }
      }
    }
    if (ten) {
      if (ten.type === 'heavy') { // both arrows converge on a half-blue/half-white dock spot
        drawGuideArc(nodes[0], ten.angle); drawGuideArc(nodes[1], ten.angle);
        drawDockSpot(ten.angle);
        drawRideLabel('USE BOTH EMITTERS', ten, '#8fe0ff'); // the armor drill, in words
      }
      else if (ten.type === 'line') {
        // EITHER node may take EITHER end — everything guides in neutral cyan
        // so no colored lead reads as an assignment
        const NEU = 'rgba(140,220,255,0.9)';
        drawGuideArc(nodes[0], ten.angle, NEU); if (ten.partner) drawGuideArc(nodes[1], ten.partner.angle, NEU);
        if (ten.partner) { // parking spots on the rim + the arc they'll span, riding the rail
          const g2 = geo();
          const d = angDiff(ten.partner.angle, ten.angle);
          ctx.save();
          ctx.strokeStyle = 'rgba(140,220,255,0.6)'; ctx.lineWidth = 2.5;
          ctx.setLineDash([7, 6]); ctx.lineDashOffset = -time * 24;
          ctx.beginPath(); ctx.arc(g2.cx, g2.cy, g2.nodeR, ten.angle, ten.angle + d, d < 0); ctx.stroke();
          ctx.restore();
          drawParkSpot(ten.angle, 'rgba(140,220,255,0.85)');
          drawParkSpot(ten.partner.angle, 'rgba(140,220,255,0.85)');
        }
      }
      else if (ten.lock !== undefined) drawGuideArc(nodes[ten.lock], ten.angle);
      // killers wear a landing signal — the drill is DODGE, the label says so
      else if (ten.type === 'frag') {
        drawKillerSignal(ten);
        drawRideLabel('DANGER! AVOID!', ten, '#ffb066'); // rides it from spawn
      }
      else drawGuideArc(nn(ten.angle), ten.angle);
      if (st.card === 'normal' && ten.type === 'normal' && ten.lock === undefined) {
        // the tooltip tracks the trap's ANGLE from the moment it spawns, held
        // at a minimum radius so a deep (near-center) trap's label still reads
        // against the bore instead of collapsing onto the axis
        drawRideLabel('INTERCEPT', ten, '#ffb0c0');
      }
      if (ten.type === 'strip') {
        // the ribbon MEANDERS, so its base angle is not where it meets the rail
        // — the label rides the live crossing point, the spot you must hold
        const gS2 = geo();
        const kX = clamp(gS2.hitZ - ten.z, 0, ten.len);
        drawRideLabel('RIDE TO CHARGE UP',
          { angle: stripAngle(ten, kX), z: Math.max(ten.z, gS2.hitZ) }, '#ffd24a');
      }
      if (ten.type === 'strip' && ten.tracing) {
        // the ribbon FEEDS the orb: ride progress winds a gold meter around
        // the destined pad — cause and effect on the same screen, and the
        // meter closing is the exact moment PULSE CHARGED pops
        const gS = geo();
        const ni = ten.traceNode || 0;
        const dS = dialCenter(ni === 0 ? 'L' : 'R');
        const fr = clamp((gS.hitZ - ten.z) / ten.len, 0, 1);
        ctx.lineCap = 'round';
        ctx.strokeStyle = 'rgba(255,210,74,' + (0.6 + Math.sin(time * 8) * 0.25).toFixed(2) + ')';
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(dS.x, dS.y, dS.r + 12, -Math.PI / 2, -Math.PI / 2 + fr * TAU); ctx.stroke();
      }
    }
    const tp = pickups.find(p => p.tut && !p.done);
    if (tp) drawGuideArc(nn(tp.angle), tp.angle);
    for (const lt of latches) { // the practice clamp warns from its landing arc
      const gL = geo();
      const rrL = gL.nodeR - Math.min(W, H) * 0.11;
      drawTutText('DANGER! AVOID!', gL.cx + Math.cos(lt.a) * rrL, gL.cy + Math.sin(lt.a) * rrL,
        '#ffb066', Math.round(Math.min(W, H) * 0.028));
    }
    if (st.card === 'move') { // emphasize the dials — a ghost thumb shows the drag itself
      const A = tut.aim, TOLm = ARCFX.span * tolVis;
      for (let i = 0; i < 2; i++) {
        const d = dialCenter(i === 0 ? 'L' : 'R');
        const pr = d.r + 6 + Math.sin(time * 5) * 3;
        ctx.strokeStyle = `rgba(${NODE_COLS[i]},0.8)`;
        ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(d.x, d.y, pr, 0, TAU); ctx.stroke();
        // a ghost thumb runs THIS rim to the mark and stops on it, retiring the
        // moment the real one starts closing the gap (drawTutDragGhost decides)
        const tgt = A.targets && A.targets.find(t => t.node === i);
        if (tgt && Math.abs(angDiff(nodes[i].angle, tgt.a)) > TOLm) drawTutDragGhost(i, tgt.a);
      }
    }
    if (tut.spawned === 'pulse') { // a banked pulse waits on the dial — ring the ready core
      for (let i = 0; i < 2; i++) {
        if (pulseCharge[i] < PULSE_MAX || nodes[i].deadT > 0) continue;
        const d = dialCenter(i === 0 ? 'L' : 'R');
        const pr = d.r * 0.5 + 8 + Math.sin(time * 6) * 4;
        ctx.strokeStyle = `rgba(${NODE_COLS[i]},0.85)`;
        ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(d.x, d.y, pr, 0, TAU); ctx.stroke();
        if (tut.frozen) { // the hold: the whole run waits on this tap
          const bob = Math.sin(time * 6) * 5;
          // big, breathing, unmissable — the one instruction on a frozen
          // screen. Fixed raster size breathing via SMOOTH ctx.scale (per-
          // frame font-px rounding stepped visibly) at steady alpha (the
          // drawTutText 5Hz flicker read as chopping). Clamped on-screen.
          const u2 = Math.min(W, H);
          const bpx = Math.round(u2 * 0.042);
          const br = 1 + 0.06 * Math.sin(time * 3.2);
          ctx.save();
          ctx.font = '700 ' + bpx + 'px Audiowide, system-ui';
          const halfT = ctx.measureText('FIRE PULSE NOW!').width / 2 + 10;
          ctx.translate(clamp(d.x, halfT * br, W - halfT * br), d.y - d.r - u2 * 0.085 + bob);
          ctx.scale(br, br);
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
          ctx.strokeStyle = 'rgba(2,4,12,0.85)'; ctx.lineWidth = 4;
          ctx.strokeText('FIRE PULSE NOW!', 0, 0);
          ctx.fillStyle = '#8fe0ff';
          ctx.fillText('FIRE PULSE NOW!', 0, 0);
          ctx.restore();
          ctx.save();
          ctx.translate(d.x, d.y - d.r * 0.62 - 12 + bob);
          ctx.fillStyle = 'rgba(143,224,255,0.95)';
          ctx.beginPath(); ctx.moveTo(0, 8); ctx.lineTo(-7, -6); ctx.lineTo(7, -6); ctx.closePath(); ctx.fill();
          ctx.restore();
        }
      }
    }
  }
}
