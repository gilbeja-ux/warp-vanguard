'use strict';
// ---------- FIELD GUIDE (S.GUIDE): one page — know your enemy ----------
// The pause header's ? key and the home screen's ? key open a single-screen
// lineup: every trap type rendered LIVE by the real body renderers, one line
// of guidance under each, and the volley tip at the foot. No navigation —
// tap anywhere (or Esc / B / START) to hand back to whoever opened it.
// wall geometry that lands a live body at (sx, sy): a ring of radius rr passes
// through the point at hitZ exactly (see geo()/ring()), so the real renderers
// paint the specimen "on the wall" of a little private bore
function archWallG(sx, sy, rr, a) {
  return { cx: sx - Math.cos(a) * rr, cy: sy - Math.sin(a) * rr, R0: rr * 2.5, nodeR: rr, hitZ: 0.25, sw: 0, swy: 0 };
}
const ARCH_SPECIMENS = {}; // cached caged bodies — their fx phase lives on them
function archBody(key, mk) { return ARCH_SPECIMENS[key] || (ARCH_SPECIMENS[key] = mk()); }
// drawEnemy sizes bodies off min(W,H) — the SCREEN — so a specimen would ignore
// its cell entirely and only the ring around it would grow. Rebase the scale on
// the cell radius (0.135·min side is the reference cell these k values were
// drawn against), so art and cage grow together.
const archArtK = (r, k) => k * r / (Math.min(W, H) * 0.135);
function archTapSpec(key, type, lock, cx, cy, r, k) {
  // mounted at the BOTTOM of the private bore (angle +π/2, axis above), so the
  // body reads floor-standing: drill rising into the bore, beam venting down
  const en = archBody(key, () => ({ type, lock, z: 0.25, z0: SPAWN_Z, angle: Math.PI / 2, arch: true,
    sizeMul: type === 'frag' ? 0.8 : type === 'heavy' ? 1.2 : 1, speedMul: 1,
    spin: 0, spinMul: 1, age: 9, dead: false, resolved: false, failed: false, partner: null }));
  en.spin = time * (type === 'heavy' ? 0.45 : 1);
  const g2 = archWallG(cx, cy, r * 2.4, Math.PI / 2);
  ctx.save();
  const s = archArtK(r, k);
  ctx.translate(cx, cy); ctx.scale(s, s); ctx.translate(-cx, -cy);
  drawEnemy(en, g2);
  ctx.restore();
}
// (the dashed containment ring is gone — it cost every specimen the room it
// enclosed, and the bodies read better at full size with their label beneath)
// the lineup — color IS the guidance, so each caption wears its type's ink
const GUIDE_ITEMS = [
  { cap: ['HIT WITH', 'ANY EMITTER'], col: '255,96,120',
    draw: (cx, cy, r) => archTapSpec('n1', 'normal', undefined, cx, cy, r, 0.5) },
  { cap: ['HIT WITH', 'BOTH EMITTERS'], col: '212,101,255',
    draw: (cx, cy, r) => archTapSpec('hv', 'heavy', undefined, cx, cy, r, 0.46) },
  { cap: ['HIT WITH', 'BLUE ⊕'], col: '80,170,255',
    draw: (cx, cy, r) => archTapSpec('lk0', 'normal', 0, cx, cy, r, 0.5) },
  { cap: ['HIT WITH', 'WHITE ⊖'], col: '235,245,255',
    draw: (cx, cy, r) => archTapSpec('lk1', 'normal', 1, cx, cy, r, 0.5) },
  { cap: ['DANGER!', 'STEER CLEAR'], col: '160,175,200',
    draw: (cx, cy, r) => archTapSpec('frag', 'frag', undefined, cx, cy, r, 0.95) },
  { cap: ['RIDE TO', 'CHARGE PULSE'], col: '255,210,74',
    draw: (cx, cy, r) => { // the ribbon in its true 3D form: a STATIC snake of
      // wall arcs receding into a private bore (real wallPatch projection),
      // with a ride-light sweeping it head-to-tail, letting go, and looping
      // the bore is offset so the ribbon it carries lands CENTRED in the cage,
      // like every other specimen (the strip only ever hangs below its axis)
      const g2 = { cx, cy: cy - r * 0.65, R0: r * 2.85, nodeR: r * 1.14, hitZ: 0.25, sw: 0, swy: 0 };
      const segs = 26, zN = 0.32, zF = 0.92;
      const T = 4, t = time % T;
      const front = clamp(t / 2.6, 0, 1);                       // the ride, head to tail
      const fadeOut = t < 2.7 ? 1 : clamp(1 - (t - 2.7) / 1.2, 0, 1); // then it lets go
      ctx.save();
      for (let s2 = 0; s2 < segs; s2++) {
        const p0 = s2 / segs, pm = (s2 + 0.5) / segs;
        const z0 = zN + p0 * (zF - zN), z1 = zN + (p0 + 1 / segs) * (zF - zN);
        const aMid = Math.PI / 2 + 0.4 * Math.sin((pm - 0.5) * 3.6); // fixed centered S — no drift
        wallPatch(g2, aMid, 0.26, z0, z1 + 0.02, 'rgba(255,180,40,1)', 0.42);
        const lit = clamp((front - p0) * 5, 0, 1) * fadeOut;
        if (lit > 0.02) {
          wallPatch(g2, aMid, 0.17, z0, z1 + 0.02, 'rgba(255,235,170,1)', lit);
          if (lit < 0.95) // the hot frontier — where the node is riding right now
            wallPatch(g2, aMid, 0.09, z0, z1 + 0.02, 'rgba(255,255,255,1)', (1 - lit) * fadeOut);
        }
      }
      ctx.restore();
    } },
];
let guideCloseRect = null;
function enterGuide(from) { guide = { from, t: 0, closing: 0 }; state = S.GUIDE; sfx.tick(); }
function closeGuide() {
  if (!guide || guide.closing) return;
  guide.closing = 1e-4;
  sfx.tick();
}
function guidePointer(P) { // one pager: any tap hands back (the X is an affordance)
  if (!guide || guide.closing || guide.t < 0.25) return;
  const c = guideCloseRect;
  if (c && P.x > c.x - 8 && P.x < c.x + c.w + 8 && P.y > c.y - 8 && P.y < c.y + c.h + 8) pressUI(c);
  closeGuide();
}
// ---- the lineup, drawn into an arbitrary box ----
// ONE RENDERER, TWO HOMES. The field guide screen passes its safe rect; the
// enlistment's third disc passes the window inside its mask. That is the whole
// reason this is a parameter and not a screen fraction — the legend a recruit is
// shown in the first minute has to BE the page they later open from the menu,
// and two copies of a lineup drift the moment a specimen is added.
//
// `u` is the type-scale reference, passed rather than derived: the full page wants
// to size against the glass (min(W,H)) while a disc wants to size against its own
// window, and deriving it from the box would silently shrink the shipped page.
//
// The box's CENTRE is the axis for everything, and its width is what the columns
// divide — which reproduces the page's long-standing behaviour of laying the
// lineup out on the average of the two safe margins rather than on each one.
const GUIDE_TIP = 'TIP: DOCK BOTH EMITTERS TO FIRE \u2014 DEEP KILLS PAY A BONUS';
function drawGuideLineup(box, u, opts) {
  const o = opts || {};
  const cx0 = box.x + box.w / 2;
  const n = GUIDE_ITEMS.length;
  const colW = box.w / n;
  const gap = Math.max(6, u * 0.03);
  ctx.textAlign = 'center';
  // title: grows into the width the close key leaves clear on both flanks
  let titleY = box.y;
  if (o.title !== false) {
    try { ctx.letterSpacing = '3px'; } catch (e) {}
    const titlePx = fitPx('FIELD GUIDE // KNOW YOUR ENEMY', '700', Math.round(u * 0.055),
      o.titleMaxW === undefined ? box.w : o.titleMaxW, 10);
    titleY = box.y + titlePx;
    ctx.fillStyle = 'rgba(140,210,255,0.8)';
    ctx.font = '700 ' + titlePx + 'px Audiowide, system-ui';
    ctx.fillText('FIELD GUIDE // KNOW YOUR ENEMY', cx0, titleY);
    try { ctx.letterSpacing = '0px'; } catch (e) {}
  }
  // ONE caption size for the whole lineup: the widest line anywhere sets it, so
  // no item's guidance reads smaller than its neighbour's (measured WITH the
  // caption letter-spacing, since that's what the drawn width will carry)
  try { ctx.letterSpacing = '1px'; } catch (e) {}
  let capFs = Math.round(u * 0.06);
  for (const it of GUIDE_ITEMS)
    for (const ln of it.cap) capFs = Math.min(capFs, fitPx(ln, '700', capFs, colW - 8));
  try { ctx.letterSpacing = '0px'; } catch (e) {}
  // foot: the tip fills the safe width, but never shouts over the guidance it
  // supports — the captions ARE the page. The dismiss hint tucks under it.
  try { ctx.letterSpacing = '2px'; } catch (e) {}
  const tipPx = o.tip === false ? 0
    : fitPx(GUIDE_TIP, '700', Math.round(Math.min(u * 0.06, capFs * 1.35)), box.w, 9);
  try { ctx.letterSpacing = '0px'; } catch (e) {}
  const hintPx = o.hint === false ? 0 : clamp(Math.round(u * 0.028), 9, 15);
  const hintY = box.y + box.h;
  // with no hint the tip takes the foot itself, so the band keeps the room the
  // dismiss line would have eaten rather than leaving a gap nothing sits in
  const tipY = o.hint === false ? hintY : hintY - hintPx - gap * 0.9;
  // A plain row: specimen, its two lines underneath. With no ring drawn around
  // them the bodies answer only to their own footprint, so they take four
  // fifths of the column — the plates never meet, and the glows that do are
  // soft light. Height is the other ceiling: whatever the band leaves once the
  // captions have their two lines.
  const capH = capFs * 2 + 5;
  const capGap = gap * 0.6;
  const bandTop = titleY + (o.title === false ? 0 : gap);
  const bandBot = (o.tip === false ? hintY : tipY - tipPx) - gap;
  const bandH = bandBot - bandTop;
  // a body is NOT a circle: the drill reaches high, the plate sits low. Budget
  // the two directions separately so the label tucks under the plate instead of
  // floating where a ring's rim used to be.
  const ART_UP = 0.85, ART_DN = 0.45;
  const cellR = Math.max(12, Math.min(colW * 0.85, u * 0.42,
    (bandH - capH - capGap) / (ART_UP + ART_DN)));
  const blockH = cellR * (ART_UP + ART_DN) + capGap + capH;
  const cyS = bandTop + (bandH - blockH) / 2 + cellR * ART_UP;
  const capY = cyS + cellR * ART_DN + capGap + capFs;
  const x0 = cx0 - colW * n / 2;
  GUIDE_ITEMS.forEach((it, i) => {
    const cx = x0 + colW * (i + 0.5);
    it.draw(cx, cyS, cellR);
    ctx.textAlign = 'center';
    try { ctx.letterSpacing = '1px'; } catch (e) {}
    ctx.fillStyle = `rgb(${it.col})`;
    ctx.font = '700 ' + capFs + 'px Audiowide, system-ui';
    it.cap.forEach((ln, li) => ctx.fillText(ln, cx, capY + li * (capFs + 5)));
    try { ctx.letterSpacing = '0px'; } catch (e) {}
  });
  // the tip + the way out
  try { ctx.letterSpacing = '2px'; } catch (e) {}
  if (o.tip !== false) {
    ctx.fillStyle = '#ffd24a';
    ctx.font = '700 ' + tipPx + 'px Audiowide, system-ui';
    ctx.fillText(GUIDE_TIP, cx0, tipY);
  }
  if (o.hint !== false) {
    ctx.fillStyle = 'rgba(140,230,255,' + (0.45 + Math.sin(time * 4) * 0.25).toFixed(2) + ')';
    ctx.font = '700 ' + hintPx + 'px Audiowide, system-ui';
    ctx.fillText('TAP TO CONTINUE', cx0, hintY);
  }
  try { ctx.letterSpacing = '0px'; } catch (e) {}
  ctx.textAlign = 'left';
}
function drawGuide(g) {
  guideCloseRect = null;
  if (!guide) return;
  guide.t += frameDt; // UI clock — the sim never runs here
  if (guide.closing) {
    guide.closing += frameDt;
    if (guide.closing >= 0.18) { // hand back to whoever opened the page
      state = guide.from === 'pause' ? S.PAUSE : S.MENU;
      guide = null;
      return;
    }
  }
  const inQ = smoothT(clamp(guide.t / 0.28, 0, 1));
  const outQ = guide.closing ? clamp(guide.closing / 0.18, 0, 1) : 0;
  const master = Math.min(inQ, 1 - outQ);
  // gentle dim so the lineup reads over the live bore
  ctx.fillStyle = 'rgba(3,6,14,' + (0.62 * master).toFixed(2) + ')';
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  const sc2 = 0.9 + 0.1 * inQ - 0.06 * outQ; // a breath of zoom, briefing-disc style
  ctx.translate(W / 2, H / 2); ctx.scale(sc2, sc2); ctx.translate(-W / 2, -H / 2);
  ctx.globalAlpha = master;
  // ---- layout: the page FILLS the safe rect. Nothing is pinned to a fixed
  // screen fraction — every size is grown until it hits the room actually
  // available, so a phone gets the largest lineup its glass can carry. ----
  const mL = 10 + SAFE.l, mR = 10 + SAFE.r, mT = 8 + SAFE.t, mB = 13 + SAFE.b;
  // x is the average of the two margins, not the left one: it keeps the lineup
  // centred on the glass (where the title sets) on an asymmetric notch
  drawGuideLineup(
    { x: (mL + mR) / 2, y: mT, w: W - mL - mR, h: H - mB - mT },
    Math.min(W, H),
    { titleMaxW: W - 2 * (mL + 46) });
  ctx.restore();
  // close key (where the pause key lives in-run), steady outside the zoom
  ctx.save();
  ctx.globalAlpha = master;
  guideCloseRect = { x: 12 + SAFE.l, y: 12 + SAFE.t, w: 38, h: 38 };
  const ck = guideCloseRect;
  techRect(ck.x, ck.y, ck.w, ck.h, 8);
  ctx.fillStyle = 'rgba(6,20,40,0.6)'; ctx.fill();
  ctx.strokeStyle = 'rgba(120,220,255,0.55)'; ctx.lineWidth = 1.5;
  techRect(ck.x, ck.y, ck.w, ck.h, 8); ctx.stroke();
  ctx.strokeStyle = 'rgba(200,240,255,0.9)'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(ck.x + 13, ck.y + 13); ctx.lineTo(ck.x + 25, ck.y + 25);
  ctx.moveTo(ck.x + 25, ck.y + 13); ctx.lineTo(ck.x + 13, ck.y + 25);
  ctx.stroke();
  ctx.restore();
}


function drawStars(cx, cy, count, size, t) {
  for (let i = 0; i < 3; i++) {
    const x = cx + (i - 1) * size * 2.6;
    const on = i < count && t > 0.4 + i * 0.35;
    ctx.save();
    ctx.translate(x, cy);
    const pop = on ? 1 + Math.max(0, 0.5 - (t - (0.4 + i * 0.35))) * 1.2 : 1;
    ctx.scale(pop, pop);
    shieldPath(0, 0, size);
    ctx.fillStyle = on ? '#ffd24a' : 'rgba(255,255,255,0.15)';
    ctx.fill();
    ctx.restore();
  }
}

// A KEY'S COLOUR IS ITS CLASS. Cyan is navigation — every ordinary way through
// a screen. Amber is an OFFER: a costed way forward the game holds out only when
// the player is stuck (LANE ASSIST, RETRY DUEL). Two of those existed, in two
// places, wearing navigation's colour, and both were easy to miss. One palette,
// one slot, one meaning.
const KEY_TONE = {
  cyan: { on: 'rgba(30,120,190,0.35)', off: 'rgba(10,36,64,0.45)', glow: 'rgba(95,215,255,0.8)',
    edge: 'rgba(150,238,255,0.95)', edge2: 'rgba(95,200,255,0.55)', bar: '#a8ecff', bar2: 'rgba(120,220,255,0.7)',
    tick: 'rgba(168,236,255,0.9)', tick2: 'rgba(120,220,255,0.5)', text: '#eefaff', text2: '#bfeaff' },
  amber: { on: 'rgba(150,96,10,0.38)', off: 'rgba(48,32,6,0.5)', glow: 'rgba(255,196,80,0.8)',
    edge: 'rgba(255,214,120,0.95)', edge2: 'rgba(240,180,70,0.6)', bar: '#ffd88a', bar2: 'rgba(255,200,110,0.75)',
    tick: 'rgba(255,214,140,0.9)', tick2: 'rgba(255,200,110,0.55)', text: '#fff3dc', text2: '#ffdfa8' }
};
function button(x, y, w, h, label, primary, locked, tone) {
  // holographic console key: chamfered glass slab, luminous edge, energy bar on the left
  const T = KEY_TONE[tone] || KEY_TONE.cyan;
  const cut = Math.min(12, h * 0.28);
  techRect(x, y, w, h, cut);
  ctx.fillStyle = locked ? 'rgba(90,160,255,0.05)' : primary ? T.on : T.off;
  ctx.fill();
  if (locked) {
    // hazard hatching across the disabled key
    ctx.save();
    techRect(x, y, w, h, cut); ctx.clip();
    ctx.strokeStyle = 'rgba(120,180,255,0.10)'; ctx.lineWidth = 6;
    for (let sx = x - h; sx < x + w; sx += 20) {
      ctx.beginPath(); ctx.moveTo(sx, y + h + 2); ctx.lineTo(sx + h + 4, y - 2); ctx.stroke();
    }
    ctx.restore();
    ctx.strokeStyle = 'rgba(120,180,255,0.20)'; ctx.lineWidth = 1;
    techRect(x, y, w, h, cut); ctx.stroke();
  } else {
    ctx.shadowColor = T.glow; ctx.shadowBlur = lowFX ? 0 : (primary ? 14 : 6);
    ctx.strokeStyle = primary ? T.edge : T.edge2;
    ctx.lineWidth = 1.5;
    techRect(x, y, w, h, cut); ctx.stroke();
    ctx.shadowBlur = 0;
    // energy bar + bottom-right corner tick
    ctx.fillStyle = primary ? T.bar : T.bar2;
    ctx.fillRect(x + 6, y + h * 0.28, 3, h * 0.44);
    ctx.strokeStyle = primary ? T.tick : T.tick2;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + w - cut - 8, y + h - 3.5); ctx.lineTo(x + w - cut + 2, y + h - 3.5);
    ctx.stroke();
  }
  ctx.fillStyle = locked ? 'rgba(160,200,255,0.3)' : primary ? T.text : T.text2;
  try { ctx.letterSpacing = '2px'; } catch (e) {}
  ctx.font = '600 14px Audiowide, system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(label, x + w / 2, y + h / 2 + 1);
  try { ctx.letterSpacing = '0px'; } catch (e) {}
  ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
}

// crest silhouette traced from the game logo, normalized to r (half-width 0.92r):
// peaked top, shoulders bulging out to the widest point, then a straight taper to
// the tip. Vertices are the logo's own outline, sampled and simplified.
const CREST = [
  [0, -1.004], [0.853, -0.808], [0.92, -0.189], [0.724, 0.413], [0, 1.004],
  [-0.724, 0.413], [-0.92, -0.189], [-0.853, -0.808]
];
function shieldPath(cx, cy, r) {
  ctx.beginPath();
  for (let i = 0; i < CREST.length; i++) {
    const vx = cx + CREST[i][0] * r, vy = cy + CREST[i][1] * r;
    i === 0 ? ctx.moveTo(vx, vy) : ctx.lineTo(vx, vy);
  }
  ctx.closePath();
}
// rank shield, filled gold when earned
function star5(cx, cy, r, filled) {
  shieldPath(cx, cy, r);
  if (filled) {
    ctx.fillStyle = '#ffd24a'; ctx.fill();
    ctx.strokeStyle = 'rgba(90,60,0,0.55)'; ctx.lineWidth = 1; ctx.stroke();
  } else {
    ctx.strokeStyle = 'rgba(235,248,255,0.8)'; ctx.lineWidth = 1.5;
    ctx.lineJoin = 'round'; ctx.stroke(); ctx.lineJoin = 'miter';
  }
}
function padlock(cx, cy, s) {
  ctx.strokeStyle = 'rgba(220,240,255,0.5)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(cx, cy - s * 0.35, s * 0.55, Math.PI, 0); ctx.stroke();
  ctx.fillStyle = 'rgba(220,240,255,0.5)';
  roundRect(cx - s * 0.8, cy - s * 0.35, s * 1.6, s * 1.1, 2); ctx.fill();
}
// level select key — the game's console-key look, with the rating / lock badge on the right
function levelKey(x, y, w, h, num, name, stars, locked, primary) {
  const cut = Math.min(12, h * 0.28);
  techRect(x, y, w, h, cut);
  ctx.fillStyle = locked ? 'rgba(90,160,255,0.05)' : primary ? 'rgba(30,120,190,0.35)' : 'rgba(10,36,64,0.45)';
  ctx.fill();
  if (locked) {
    ctx.save(); techRect(x, y, w, h, cut); ctx.clip();
    ctx.strokeStyle = 'rgba(120,180,255,0.10)'; ctx.lineWidth = 6;
    for (let sx = x - h; sx < x + w; sx += 20) {
      ctx.beginPath(); ctx.moveTo(sx, y + h + 2); ctx.lineTo(sx + h + 4, y - 2); ctx.stroke();
    }
    ctx.restore();
    ctx.strokeStyle = 'rgba(120,180,255,0.20)'; ctx.lineWidth = 1;
    techRect(x, y, w, h, cut); ctx.stroke();
  } else {
    ctx.shadowColor = 'rgba(95,215,255,0.8)'; ctx.shadowBlur = lowFX ? 0 : (primary ? 14 : 6);
    ctx.strokeStyle = primary ? 'rgba(150,238,255,0.95)' : 'rgba(95,200,255,0.55)';
    ctx.lineWidth = 1.5;
    techRect(x, y, w, h, cut); ctx.stroke();
    ctx.shadowBlur = 0;
    // energy bar + bottom-right corner tick, same as the other console keys
    ctx.fillStyle = primary ? '#a8ecff' : 'rgba(120,220,255,0.7)';
    ctx.fillRect(x + 6, y + h * 0.28, 3, h * 0.44);
    ctx.strokeStyle = primary ? 'rgba(168,236,255,0.9)' : 'rgba(120,220,255,0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + w - cut - 8, y + h - 3.5); ctx.lineTo(x + w - cut + 2, y + h - 3.5);
    ctx.stroke();
  }
  // number + name
  ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  ctx.fillStyle = locked ? 'rgba(220,240,255,0.35)' : '#f2faff';
  ctx.font = '800 15px Audiowide, system-ui';
  ctx.fillText(num, x + 20, y + h / 2 + 1);
  ctx.fillStyle = locked ? 'rgba(220,240,255,0.35)' : '#ffffff';
  ctx.font = '700 14px Audiowide, system-ui';
  try { ctx.letterSpacing = '1px'; } catch (e) {}
  ctx.fillText(name, x + 42, y + h / 2 + 1);
  try { ctx.letterSpacing = '0px'; } catch (e) {}
  ctx.textBaseline = 'alphabetic';
  // rating stars, or a padlock in a rounded badge
  if (locked) {
    roundRect(x + w - 41, y + h / 2 - 13, 26, 26, 6);
    ctx.strokeStyle = 'rgba(220,240,255,0.55)'; ctx.lineWidth = 1.5; ctx.stroke();
    padlock(x + w - 28, y + h / 2, 7);
  } else if (stars >= 0) {
    for (let i = 0; i < 3; i++) star5(x + w - 70 + i * 23, y + h / 2, 8.5, i < stars);
  }
}

// geometry shared by the static menu layer and the live level keys
function menuGeom() {
  const ccx = W / 2, ccy = H / 2;
  // H·0.52 made the outer disc 104% of the screen tall — cut top and bottom
  // on anything wider than ~1.73:1, which is every phone and half the desktop
  // windows. 0.47 keeps the whole circle inside the frame with a breath of
  // margin, and every screen that shares this geometry (the map lens, the
  // free-flow wheel, the leaderboard) follows from this one number.
  const R = Math.min(H * 0.47, W * 0.30);
  const bw = Math.min(R * 1.4, W * 0.42), bh = 46, gap = 13;
  const items = LEVELS.length + 4; // + qualification, endless, weekly, and the TEMP boss-test key
  const listY = ccy - R + 52;
  const contentH = items * (bh + gap) - gap;
  const viewH = H - listY - 6;
  const maxScroll = Math.max(0, contentH - viewH);
  return { ccx, ccy, R, bw, bh, gap, items, listY, contentH, viewH, maxScroll };
}
// static menu furniture — repainted only on resize, blitted every frame
function paintMenuStatic() {
  const { ccx, ccy, R } = menuGeom();
  // HUD garnish
  plusCluster(W - 118, 26, 'rgba(120,220,255,0.45)');
  plusCluster(W - 140, H - 40, 'rgba(120,220,255,0.25)');
  ctx.font = '10px monospace'; ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(120,210,255,0.45)'; ctx.fillRect(W - 96, H - 54, 76, 2);
  ctx.fillStyle = 'rgba(120,210,255,0.25)'; ctx.fillRect(W - 96, H - 49, 76, 2);
  // block logo — stacked DATA / DEFE / NDER, top-left (small brand on the map,
  // where the relay list needs the column)
  ctx.textAlign = 'left';
  // ON THE MAP THE HEADER IS ONE LOCKUP, not a badge with a caption dropped
  // under it: the badge stands as tall as BOTH lines, and the contract name
  // starts where the game name starts. headX carries that shared left edge down
  // to the title below, so the two can never drift apart — the badge is free to
  // change size and the alignment follows it.
  const twoLine = menuScreen === 'map';
  let headX = 20 + SAFE.l;
  if (menuScreen === 'flow' || menuScreen === 'map') { // small brand line up top
    const sm = brandLogoSmall();
    if (sm) {
      // one line: optically centred on the brand baseline. two: centred on the
      // PAIR, so it spans the cap of the game name to the baseline of the
      // contract, and still clears the rule at y=56.
      const bh2 = twoLine ? 40 : 26, bw2 = bh2 * (sm.w / sm.h);
      ctx.drawImage(sm.img, headX, (twoLine ? 10 : 6) + SAFE.t, bw2, bh2);
      headX += bw2 + 8;
    }
    ctx.fillStyle = 'rgba(198,214,234,0.7)'; ctx.font = '900 12px Audiowide, system-ui';
    ctx.fillText('WARP VANGUARD', headX, 24 + SAFE.t);
  }
  if (menuScreen === 'map') {
    // the lens mouth: the ring becomes a viewport over the city
    const RM = mapR();
    const dg = ctx.createRadialGradient(ccx, ccy, RM * 0.2, ccx, ccy, RM);
    dg.addColorStop(0, 'rgba(2,6,14,0.92)');
    dg.addColorStop(1, 'rgba(3,9,20,0.85)');
    ctx.beginPath(); ctx.arc(ccx, ccy, RM, 0, TAU);
    ctx.fillStyle = dg; ctx.fill();
    ctx.strokeStyle = 'rgba(100,190,255,0.25)'; ctx.lineWidth = 2; ctx.stroke();
    // the title lives LEFT, over the relay column — never across the lens
    ctx.textAlign = 'left';
    const tlx = 10 + SAFE.l * 0.6;
    ctx.fillStyle = '#f2faff'; ctx.font = '700 13px Audiowide, system-ui';
    try { ctx.letterSpacing = '2px'; } catch (e) {}
    ctx.fillText(CAMP.title, headX, 46 + SAFE.t); // shares the brand line's left edge
    try { ctx.letterSpacing = '0px'; } catch (e) {}
    { // separator: from the left edge all the way to the rim
      const sy = 56 + SAFE.t, dy2 = ccy - sy;
      const endX = Math.abs(dy2) < RM ? ccx - Math.sqrt(RM * RM - dy2 * dy2) + 6 : ccx - RM * 0.3;
      const sg = ctx.createLinearGradient(tlx, 0, endX, 0);
      sg.addColorStop(0, 'rgba(120,210,255,0.55)');
      sg.addColorStop(1, 'rgba(120,210,255,0.08)');
      ctx.strokeStyle = sg; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(tlx, sy); ctx.lineTo(endX, sy); ctx.stroke();
    }
  } else {
    // tunnel disc — a dark mouth in the center that makes the mode keys pop.
    // The rim rides JUST beyond the wedges (they end at 0.92R): an outer circle
    // is a frame for the buttons it holds, not a horizon of its own.
    const dR = R * 0.96;
    const dg = ctx.createRadialGradient(ccx, ccy, dR * 0.2, ccx, ccy, dR);
    dg.addColorStop(0, 'rgba(2,5,12,0.78)');
    dg.addColorStop(0.85, 'rgba(3,8,18,0.62)');
    dg.addColorStop(1, 'rgba(4,10,22,0.55)');
    ctx.beginPath(); ctx.arc(ccx, ccy, dR, 0, TAU);
    ctx.fillStyle = dg; ctx.fill();
    ctx.strokeStyle = 'rgba(100,190,255,0.14)'; ctx.lineWidth = 1.5; ctx.stroke();
    // no headers over the wheels — the hub names the screen
  }
}
let menuCache = null, menuCacheScreen = null;
function buildMenuCache() {
  if (!W || !H) return;
  menuCacheScreen = menuScreen;
  menuCache = document.createElement('canvas');
  menuCache.width = W * DPR; menuCache.height = H * DPR;
  withCanvas(menuCache, () => {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    paintMenuStatic();
  });
}

// boot build-in: after the splash's wheel cue, each furniture cluster eases
// from its nearest screen edge into place. 1 = settled (and always 1 outside
// the boot intro, so the steady-state menu costs nothing).
let menuIntroAt = null;
function introE(delay) {
  if (menuIntroAt === null) return 1;
  if (time - menuIntroAt > 2.5) { menuIntroAt = null; return 1; } // everyone's home
  const q = clamp((time - menuIntroAt - delay) / 0.5, 0, 1);
  return 1 - Math.pow(1 - q, 3);
}
function drawMenu(g) {
  menuButtons = [];
  menuBadge = null; // repopulated by the home wheel; stays null on other screens
  if (!menuCache || menuCacheScreen !== menuScreen) buildMenuCache();
  if (menuCache) { // static furniture breathes in with the wheel on boot
    ctx.globalAlpha = introE(0);
    ctx.drawImage(menuCache, 0, 0, W, H);
    ctx.globalAlpha = 1;
  }
  const { ccx, ccy, R, bw, bh, gap, listY, contentH, viewH, maxScroll } = menuGeom();

  ctx.font = '10px monospace'; ctx.textAlign = 'left';
  // bottom-left: diagnostic carousel — count up fast, hold ~5s, then the next block
  // in the bar lights up white and a fresh count begins (HOME garnish only)
  if (menuScreen === 'home') {
  ctx.save();
  ctx.translate(-(1 - introE(0.35)) * 280, 0); // boot: flies in from the left
  const CYCLE = 6.5, COUNT = 1.5;
  const cyc = Math.floor(time / CYCLE), ct = time - cyc * CYCLE;
  const cp = clamp(ct / COUNT, 0, 1);
  const activeBlk = cyc % 4;
  const grp = i => {
    const tgt = ((cyc * 7919 + i * 337) % 90) + 10; // stable per-cycle targets, 10–99
    return String(Math.floor(tgt * cp)).padStart(2, '0');
  };
  ctx.fillStyle = 'rgba(120,210,255,0.55)';
  ctx.fillText(grp(0) + '.' + grp(1) + '.' + grp(2), 20, H - 20);
  for (let i = 0; i < 4; i++) {
    const active = i === activeBlk;
    const blink = active && cp < 1 && Math.sin(time * 14) > 0; // flickers while counting
    ctx.fillStyle = active
      ? (blink ? 'rgba(235,250,255,0.35)' : 'rgba(235,250,255,0.9)')
      : 'rgba(120,210,255,0.3)';
    ctx.fillRect(20 + i * 15, H - 40, 11, 5);
  }
  ctx.restore();
  }
  // bottom-right: live nav coordinates drifting as we ride the tunnel,
  // capped by the build stamp — changes with ANY code change, so a stale
  // cached build is spottable at a glance
  ctx.save();
  ctx.translate((1 - introE(0.5)) * 280, 0); // boot: flies in from the right
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(120,210,255,0.5)';
  ctx.fillText(String(Math.floor(44589 + time * 12.4) % 100000).padStart(5, '0'), W - 20, H - 34);
  ctx.fillText(String(Math.floor(45895 + time * 31.7) % 100000).padStart(5, '0'), W - 20, H - 22);
  ctx.fillStyle = 'rgba(120,210,255,0.35)';
  ctx.fillText('BLD ' + BUILD, W - 20, H - 48);
  ctx.restore();
  ctx.textAlign = 'right';

  // top-right cluster: boot drops it in from above the screen edge
  ctx.save();
  ctx.translate(0, -(1 - introE(0.2)) * 140);
  // fullscreen key (left of the gear; hidden when already chromeless, and on the
  // board screen — its corner belongs to the BACK button there, per the mock)
  menuFsRect = null;
  if (menuScreen !== 'board' && !inStandalone() && !(document.fullscreenElement || document.webkitFullscreenElement)) {
    menuFsRect = { x: W - 96 - SAFE.r, y: 12 + SAFE.t, w: 38, h: 38 };
    const f = menuFsRect;
    techRect(f.x, f.y, f.w, f.h, 8);
    ctx.fillStyle = 'rgba(6,20,40,0.6)'; ctx.fill();
    ctx.strokeStyle = 'rgba(120,220,255,0.55)'; ctx.lineWidth = 1.5;
    techRect(f.x, f.y, f.w, f.h, 8); ctx.stroke();
    // expand-arrows icon
    ctx.strokeStyle = 'rgba(200,240,255,0.9)'; ctx.lineWidth = 2; ctx.lineCap = 'round';
    for (const [cx2, cy2, dx, dy] of [[f.x + 11, f.y + 11, -1, -1], [f.x + 27, f.y + 11, 1, -1], [f.x + 11, f.y + 27, -1, 1], [f.x + 27, f.y + 27, 1, 1]]) {
      ctx.beginPath();
      ctx.moveTo(cx2 + dx * 3, cy2 + dy * 3); ctx.lineTo(cx2 - dx * 2, cy2 + dy * 3);
      ctx.moveTo(cx2 + dx * 3, cy2 + dy * 3); ctx.lineTo(cx2 + dx * 3, cy2 - dy * 2);
      ctx.stroke();
    }
  }

  // audio config key (top-right) — not on the board screen (its corner is the BACK button, per the mock)
  menuGearRect = null;
  if (menuScreen !== 'board') {
    menuGearRect = { x: W - 50 - SAFE.r, y: 12 + SAFE.t, w: 38, h: 38 };
    const r = menuGearRect;
    techRect(r.x, r.y, r.w, r.h, 8);
    ctx.fillStyle = 'rgba(6,20,40,0.6)'; ctx.fill();
    ctx.strokeStyle = 'rgba(120,220,255,0.55)'; ctx.lineWidth = 1.5;
    techRect(r.x, r.y, r.w, r.h, 8); ctx.stroke();
    ctx.strokeStyle = 'rgba(200,240,255,0.9)'; ctx.lineWidth = 1.5;
    const knobX = [r.x + 24, r.x + 13, r.x + 27];
    for (let i = 0; i < 3; i++) {
      const gy = r.y + 11 + i * 8;
      ctx.beginPath(); ctx.moveTo(r.x + 8, gy); ctx.lineTo(r.x + 30, gy); ctx.stroke();
      ctx.fillStyle = '#dff6ff';
      ctx.fillRect(knobX[i] - 2.5, gy - 3.5, 5, 7);
    }
  }
  // (the OPERATOR button used to sit here, home only, left of the gear — removed
  // along with its panel. The handle is asked for on the END screen instead.)
  // FIELD GUIDE key (home only, left of the cluster)
  menuGuideRect = null;
  if (menuScreen === 'home') {
    menuGuideRect = { x: W - (menuFsRect ? 142 : 96) - SAFE.r, y: 12 + SAFE.t, w: 38, h: 38 };
    const qk = menuGuideRect;
    techRect(qk.x, qk.y, qk.w, qk.h, 8);
    ctx.fillStyle = 'rgba(6,20,40,0.6)'; ctx.fill();
    ctx.strokeStyle = 'rgba(120,220,255,0.55)'; ctx.lineWidth = 1.5;
    techRect(qk.x, qk.y, qk.w, qk.h, 8); ctx.stroke();
    ctx.fillStyle = 'rgba(200,240,255,0.9)';
    ctx.font = '700 17px Audiowide, system-ui'; ctx.textAlign = 'center';
    ctx.fillText('?', qk.x + qk.w / 2, qk.y + 26);
    ctx.textAlign = 'right';
  }
  ctx.restore(); // top-right cluster fly-in

  // back key on sub-screens (left of the fullscreen/gear cluster; the board
  // screen draws its own corner back button)
  menuBackRect = null;
  menuMutRects = [];
  if (menuScreen !== 'home' && menuScreen !== 'board') {
    menuBackRect = { x: W - (menuFsRect ? 142 : 96) - SAFE.r, y: 12 + SAFE.t, w: 38, h: 38 };
    const bk = menuBackRect;
    techRect(bk.x, bk.y, bk.w, bk.h, 8);
    ctx.fillStyle = 'rgba(6,20,40,0.6)'; ctx.fill();
    ctx.strokeStyle = 'rgba(120,220,255,0.55)'; ctx.lineWidth = 1.5;
    techRect(bk.x, bk.y, bk.w, bk.h, 8); ctx.stroke();
    ctx.strokeStyle = 'rgba(200,240,255,0.9)'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(bk.x + 24, bk.y + 11); ctx.lineTo(bk.x + 14, bk.y + 19); ctx.lineTo(bk.x + 24, bk.y + 27);
    ctx.stroke();
  }

  // LEADERBOARD now lives as a ring quarter on the home wheel (drawMenuHome),
  // so there's no side rect to draw here anymore.
  menuLbRect = null;

  if (menuScreen === 'map') drawMenuMap();
  else if (menuScreen === 'flow') drawMenuFlow();
  else if (menuScreen === 'camps') drawMenuCamps(ccx, ccy, R);
  else if (menuScreen === 'board') drawMenuBoard();
  else drawMenuHome(ccx, ccy, R);

  if (menuPopUp() && menuBadge) stampMenuBadge(g); // badge holds its post, under the popup
  if (menuSettings || popLive('set')) drawMenuSettings(); // …through the erase too
  if (menuConfirm || popLive('confirm')) drawResetConfirm();
  // MY DATA sits on top of SYSTEM CONFIG, because that is one of its two doors —
  // drawn last so the settings panel dims behind it rather than over it
  if (myData || popLive('mydata')) drawMyData();
  if (report || popLive('report')) drawReport();
}
// the launch/zoom transform frame() wraps around the whole menu — mirrored so
// the floating badge scales and fades in lockstep with the rest of the wheel
function menuMenuXform() {
  if (menuFx && menuFx.kind === 'launch') { const q = clamp(menuFx.t / menuFx.dur, 0, 1), e2 = q * q; return { s: 1 + e2 * 1.7, a: 1 - e2 }; }
  if (menuFx && menuFx.zoom) { const q = clamp(menuFx.t / menuFx.dur, 0, 1), e2 = (1 - q) * (1 - q); return { s: 1 + e2 * 1.7, a: 1 - e2 }; }
  return { s: 1, a: 1 };
}
// replay the hub shield on top of the press flash / transitions so the logo
// always leads the screen
function stampMenuBadge(g) { // the hub shield at its home spot
  const xf = menuMenuXform();
  ctx.save();
  ctx.translate(g.cx, g.cy); ctx.scale(xf.s, xf.s); ctx.translate(-g.cx, -g.cy);
  ctx.globalAlpha = xf.a * menuBadge.alpha;
  ctx.drawImage(menuBadge.img, menuBadge.x, menuBadge.y, menuBadge.w, menuBadge.h);
  ctx.restore();
}
// with a popup up the badge doesn't vanish — it steps back INTO the scene
// (stamped under the popup's dim by drawMenu) instead of riding on top
const menuPopUp = () => menuSettings || menuConfirm || myData || report
  || popLive('set') || popLive('confirm') || popLive('mydata') || popLive('report');
function drawMenuBadgeTop(g) {
  if (state !== S.MENU || menuScreen !== 'home' || !menuBadge || menuPopUp()) return;
  stampMenuBadge(g);
}
// "erase all progress?" modal — the only way to wipe a campaign
function drawResetConfirm() {
  const q = popFxQ('confirm', !!menuConfirm);
  menuConfirmBtns = [];
  ctx.fillStyle = 'rgba(2,6,14,' + (0.72 * q).toFixed(2) + ')'; ctx.fillRect(0, 0, W, H); // dim the menu behind
  const pw = Math.min(W - 48, 420), ph = 172;
  const px = (W - pw) / 2, py = (H - ph) / 2;
  popRender(q, px, py, pw, ph, () => {
  ctx.save();
  techRect(px, py, pw, ph, 12);
  ctx.fillStyle = 'rgba(8,18,34,0.98)'; ctx.fill();
  ctx.strokeStyle = 'rgba(255,110,110,0.7)'; ctx.lineWidth = 1.5;
  techRect(px, py, pw, ph, 12); ctx.stroke();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ff9a9a'; ctx.font = '800 15px Audiowide, system-ui';
  ctx.fillText('RESET CONTRACT', W / 2, py + 34);
  ctx.fillStyle = 'rgba(220,235,255,0.9)'; ctx.font = '500 12px Audiowide, system-ui';
  ctx.fillText("This will erase this campaign's progress,", W / 2, py + 66);
  ctx.fillText('are you sure?', W / 2, py + 86);
  // two keys: Cancel (calm) · Reset Campaign (red)
  const bw = (pw - 48) / 2, bh = 38, byb = py + ph - bh - 20;
  const cx0 = px + 16, rx0 = px + pw - 16 - bw;
  const cancel = { x: cx0, y: byb, w: bw, h: bh, confirm: 'cancel' };
  techRect(cancel.x, cancel.y, bw, bh, 8);
  ctx.fillStyle = 'rgba(20,44,72,0.9)'; ctx.fill();
  ctx.strokeStyle = 'rgba(120,200,255,0.55)'; ctx.lineWidth = 1.2; techRect(cancel.x, cancel.y, bw, bh, 8); ctx.stroke();
  ctx.fillStyle = '#dff2ff'; ctx.font = '700 12px Audiowide, system-ui';
  ctx.fillText('CANCEL', cancel.x + bw / 2, byb + bh / 2 + 4);
  const wipe = { x: rx0, y: byb, w: bw, h: bh, confirm: 'wipe' };
  techRect(wipe.x, wipe.y, bw, bh, 8);
  ctx.fillStyle = 'rgba(120,26,26,0.92)'; ctx.fill();
  ctx.strokeStyle = 'rgba(255,120,120,0.85)'; ctx.lineWidth = 1.2; techRect(wipe.x, wipe.y, bw, bh, 8); ctx.stroke();
  ctx.fillStyle = '#ffd9d9'; ctx.font = '700 12px Audiowide, system-ui';
  ctx.fillText('RESET CONTRACT', wipe.x + bw / 2, byb + bh / 2 + 4);
  ctx.textAlign = 'left';
  menuConfirmBtns.push(cancel, wipe);
  ctx.restore();
  });
}

// ---------------------------------------------------------------------------
// MY DATA — rename every run I hold, or erase them all. See the note in
// 40-state.js for why both verbs are offered and why two screens open this.
//
// The panel is deliberately plain-spoken. Every line here is a PROMISE the code
// has to keep, so it says exactly what each verb touches and what it leaves
// alone — the commonest fear at this button is "will I lose my campaign", and
// the answer is no, in as many words.
// ---------------------------------------------------------------------------
// "TRY AGAIN IN 7H 20M" beats "in 26400 seconds". Rounds UP to the minute so the
// panel never says 0M while the server is still refusing.
function fmtWait(sec) {
  const m = Math.ceil(Math.max(0, sec) / 60), h = Math.floor(m / 60);
  return h ? h + 'H ' + (m % 60) + 'M' : m + 'M';
}
function mdKey(btns, x, y, w, h, label, tone, tag) {
  const T = tone === 'danger' ? ['rgba(120,26,26,0.92)', 'rgba(255,120,120,0.85)', '#ffd9d9']
    : tone === 'go' ? ['rgba(26,86,58,0.92)', 'rgba(126,226,98,0.8)', '#dcffd2']
    : ['rgba(20,44,72,0.9)', 'rgba(120,200,255,0.55)', '#dff2ff'];
  techRect(x, y, w, h, 8); ctx.fillStyle = T[0]; ctx.fill();
  ctx.strokeStyle = T[1]; ctx.lineWidth = 1.2; techRect(x, y, w, h, 8); ctx.stroke();
  ctx.fillStyle = T[2]; ctx.font = '700 12px Audiowide, system-ui'; ctx.textAlign = 'center';
  ctx.fillText(label, x + w / 2, y + h / 2 + 4);
  btns.push({ x, y, w, h, tag });
}
function drawMyData() {
  const q = popFxQ('mydata', !!myData);
  myDataBtns = [];
  const st = myData ? myData.step : 'menu', busy = !!(myData && myData.busy);
  ctx.fillStyle = 'rgba(2,6,14,' + (0.72 * q).toFixed(2) + ')'; ctx.fillRect(0, 0, W, H);
  const pw = Math.min(W - 48, 470);
  const ph = st === 'menu' ? 262 : st === 'rename' ? 236 : st === 'done' ? 190 : 250;
  const px = (W - pw) / 2, py = (H - ph) / 2;
  // the DOM field belongs to the rename step alone — drop it the moment we leave,
  // or an invisible input keeps the keyboard up over the confirm screen
  if (!(myData && st === 'rename') && overlayField === 'mydata') clearField();
  popRender(q, px, py, pw, ph, () => {
  ctx.save();
  techRect(px, py, pw, ph, 12);
  ctx.fillStyle = 'rgba(8,18,34,0.98)'; ctx.fill();
  ctx.strokeStyle = st === 'confirm' ? 'rgba(255,110,110,0.7)' : 'rgba(120,200,255,0.6)'; ctx.lineWidth = 1.5;
  techRect(px, py, pw, ph, 12); ctx.stroke();
  ctx.textAlign = 'center';
  const line = (s, y, col, w) => { ctx.fillStyle = col || 'rgba(220,235,255,0.9)'; ctx.font = (w || '500') + ' 12px Audiowide, system-ui'; ctx.fillText(s, W / 2, y); };
  const bw = pw - 44, bx = px + 22;

  if (st === 'menu') {
    ctx.fillStyle = '#9fd8ff'; ctx.font = '800 15px Audiowide, system-ui';
    ctx.fillText('MY DATA', W / 2, py + 34);
    line('The boards hold a name you chose and the runs', py + 62);
    line('you set. Both are yours to change.', py + 80);
    mdKey(myDataBtns, bx, py + 100, bw, 38, 'RENAME MY RUNS', 'calm', 'toRename');
    line('Your scores stay — only the name changes.', py + 154, 'rgba(150,190,225,0.75)');
    mdKey(myDataBtns, bx, py + 168, bw, 38, 'DELETE MY RUNS', 'danger', 'toConfirm');
    mdKey(myDataBtns, px + pw / 2 - 60, py + ph - 46, 120, 34, 'CLOSE', 'calm', 'close');
  }
  else if (st === 'rename') {
    ctx.fillStyle = '#9fd8ff'; ctx.font = '800 15px Audiowide, system-ui';
    ctx.fillText('RENAME MY RUNS', W / 2, py + 34);
    line('This name replaces the old one on every run', py + 60);
    line('you hold, on every board. Scores are untouched.', py + 78);
    const fr = { x: px + 40, y: py + 96, w: pw - 80, h: 40 };
    mountField('mydata', fr, { placeholder: 'ENTER YOUR HANDLE', value: myDataDraft, maxLength: NAME_MAX,
      onInput: v => { myDataDraft = sanitizeName(v); }, onEnter: () => myDataAct('save') });
    const ok = nameStatus(myDataDraft) === 'ok';
    line(ok ? 'Do not use your real name.' : 'At least 2 characters, nothing offensive.',
      py + 154, ok ? 'rgba(150,190,225,0.75)' : 'rgba(255,170,120,0.9)');
    const hw = (pw - 56) / 2;
    mdKey(myDataBtns, px + 22, py + ph - 56, hw, 38, 'CANCEL', 'calm', 'toMenu');
    if (ok && !busy) mdKey(myDataBtns, px + pw - 22 - hw, py + ph - 56, hw, 38, 'SAVE', 'go', 'save');
    else { ctx.globalAlpha = 0.4; mdKey([], px + pw - 22 - hw, py + ph - 56, hw, 38, busy ? 'SAVING…' : 'SAVE', 'go', 'save'); ctx.globalAlpha = 1; }
  }
  else if (st === 'confirm') {
    ctx.fillStyle = '#ff9a9a'; ctx.font = '800 15px Audiowide, system-ui';
    ctx.fillText('DELETE MY RUNS', W / 2, py + 34);
    line('Every run you hold is removed from every board,', py + 64);
    line('with its replay and this device’s board identity.', py + 82);
    line('Your campaign progress and local bests are kept.', py + 108, 'rgba(150,220,150,0.9)');
    line('This cannot be undone.', py + 134, '#ff9a9a', '700');
    const hw = (pw - 56) / 2;
    mdKey(myDataBtns, px + 22, py + ph - 56, hw, 38, 'CANCEL', 'calm', 'toMenu');
    if (!busy) mdKey(myDataBtns, px + pw - 22 - hw, py + ph - 56, hw, 38, 'DELETE', 'danger', 'delete');
    else { ctx.globalAlpha = 0.4; mdKey([], px + pw - 22 - hw, py + ph - 56, hw, 38, 'DELETING…', 'danger', 'delete'); ctx.globalAlpha = 1; }
  }
  else { // 'done' — the result line, and one way out
    ctx.fillStyle = myData && myData.bad ? '#ff9a9a' : '#7ee262'; ctx.font = '800 15px Audiowide, system-ui';
    ctx.fillText(myData && myData.bad ? 'NOTHING CHANGED' : 'DONE', W / 2, py + 40);
    line((myData && myData.msg) || '', py + 76);
    mdKey(myDataBtns, px + pw / 2 - 60, py + ph - 50, 120, 34, 'CLOSE', 'calm', 'close');
  }
  ctx.textAlign = 'left';
  ctx.restore();
  });
}
// ---------------------------------------------------------------------------
// REPORT THIS — flagging someone else's handle. Three canned reasons and a way
// out; tapping a reason IS the confirmation, so there is no second step asking
// "are you sure" about a reversible, non-destructive act.
//
// Cheating is deliberately not on this list: the verifier replays every campaign
// and weekly run, so a verified row is provably legitimate and a cheating report
// against one could only be explained away, never acted on. This pipe carries the
// NAME, which is the only thing on a board a human has to judge.
// ---------------------------------------------------------------------------
const REPORT_REASONS = [
  ['offensive',     'OFFENSIVE OR HATEFUL'],
  ['personal',      'A REAL NAME OR PERSONAL INFO'],
  ['impersonation', 'IMPERSONATING SOMEONE'],
];
function drawReport() {
  const q = popFxQ('report', !!report);
  reportBtns = [];
  const done = !!(report && report.done), busy = !!(report && report.busy);
  ctx.fillStyle = 'rgba(2,6,14,' + (0.72 * q).toFixed(2) + ')'; ctx.fillRect(0, 0, W, H);
  const pw = Math.min(W - 48, 430), ph = done ? 178 : 250;
  const px = (W - pw) / 2, py = (H - ph) / 2;
  popRender(q, px, py, pw, ph, () => {
  ctx.save();
  techRect(px, py, pw, ph, 12);
  ctx.fillStyle = 'rgba(8,18,34,0.98)'; ctx.fill();
  ctx.strokeStyle = 'rgba(224,110,110,0.6)'; ctx.lineWidth = 1.5;
  techRect(px, py, pw, ph, 12); ctx.stroke();
  ctx.textAlign = 'center';
  if (done) {
    ctx.fillStyle = report && report.bad ? '#ff9a9a' : '#7ee262'; ctx.font = '800 15px Audiowide, system-ui';
    ctx.fillText(report && report.bad ? 'NOT SENT' : 'REPORTED', W / 2, py + 44);
    ctx.fillStyle = 'rgba(220,235,255,0.9)'; ctx.font = '500 12px Audiowide, system-ui';
    ctx.fillText((report && report.msg) || '', W / 2, py + 78);
    mdKey(reportBtns, px + pw / 2 - 60, py + ph - 50, 120, 34, 'CLOSE', 'calm', 'close');
  } else {
    ctx.fillStyle = '#e08a8a'; ctx.font = '800 15px Audiowide, system-ui';
    ctx.fillText('REPORT THIS NAME', W / 2, py + 34);
    ctx.fillStyle = 'rgba(180,205,230,0.85)'; ctx.font = '500 11px Audiowide, system-ui';
    ctx.fillText('“' + String((report && report.row && report.row.player_name) || 'ANON').slice(0, 16) + '”', W / 2, py + 58);
    ctx.fillStyle = 'rgba(150,190,225,0.7)'; ctx.font = '500 10px Audiowide, system-ui';
    ctx.fillText('The score is not affected. What is wrong with it?', W / 2, py + 78);
    REPORT_REASONS.forEach(([key, label], i) => {
      const y = py + 92 + i * 40;
      if (busy) { ctx.globalAlpha = 0.4; mdKey([], px + 22, y, pw - 44, 34, label, 'calm', key); ctx.globalAlpha = 1; }
      else mdKey(reportBtns, px + 22, y, pw - 44, 34, label, 'calm', key);
    });
    mdKey(reportBtns, px + pw / 2 - 60, py + ph - 44, 120, 30, busy ? 'SENDING…' : 'CANCEL', 'calm', 'close');
  }
  ctx.textAlign = 'left';
  ctx.restore();
  });
}
function reportAct(tag) {
  if (!report) return;
  if (tag === 'close') { closeReport(); return; }
  if (report.busy || report.done) return;
  const id = report.row && report.row.id;
  if (!id) { report.done = true; report.bad = true; report.msg = 'THIS ENTRY IS NO LONGER ON THE BOARD'; return; }
  report.busy = true;
  lbReport(id, tag).then(r => {
    if (!report) return;
    report.busy = false; report.done = true; report.bad = !r.ok;
    // What a reporter is told is the SAME every time, and says nothing about how
    // many others reported the row or whether anything happened to it. Publishing
    // the threshold would turn it into a target.
    report.msg = r.ok ? 'Thanks — a human will look at this name.' : (r.human || 'COULD NOT SEND');
  });
}

// the panel's verbs. Kept out of the drawer so the network calls can't be fired
// twice by a redraw, and so `busy` is the single thing gating a second tap.
function myDataAct(tag) {
  if (!myData) return;
  if (tag === 'close') { closeMyData(); return; }
  if (tag === 'toMenu') { clearField(); myData.step = 'menu'; myData.msg = ''; return; }
  if (tag === 'toRename') { myDataDraft = identity.name || ''; myData.step = 'rename'; return; }
  if (tag === 'toConfirm') { myData.step = 'confirm'; return; }
  if (myData.busy) return; // a second tap while the first is in flight does nothing
  if (tag === 'save') {
    if (nameStatus(myDataDraft) !== 'ok') return;
    const want = sanitizeName(myDataDraft).trim();
    myData.busy = true; clearField();
    lbMyData('rename', want).then(r => {
      if (!myData) return;                       // panel closed under us — nothing to report to
      myData.busy = false; myData.step = 'done';
      const rows = r.rows || 0, locked = r.locked || 0, wait = r.waitSec || 0;
      // "nothing happened" has four different causes and they are not the same
      // news. Collapsing them into one message is how a player concludes the
      // button is broken when it is in fact working exactly as designed.
      if (!r.ok)        { myData.bad = true;  myData.msg = r.human || 'COULD NOT REACH THE BOARDS'; }
      else if (wait > 0){ myData.bad = true;  myData.msg = 'ALREADY RENAMED TODAY — TRY AGAIN IN ' + fmtWait(wait); }
      else if (!rows && locked) { myData.bad = true; myData.msg = 'THOSE ENTRIES WERE MODERATED AND CANNOT BE RENAMED'; }
      else if (!rows)   { myData.bad = true;  myData.msg = 'YOU HOLD NO ENTRIES ON ANY BOARD YET'; }
      else {
        myData.bad = false;
        // report what the BOARD now says, not what was typed — the server runs the
        // same word filter submit-run does, so a blocked handle comes back REDACTED
        myData.msg = rows + ' run' + (rows === 1 ? '' : 's') + ' now read “' + (r.name || want) + '”'
          + (locked ? ' · ' + locked + ' moderated ' + (locked === 1 ? 'entry' : 'entries') + ' kept' : '');
        // the open board still shows the OLD name — refetch it. Not `boardData = null`:
        // nothing polls for that, so the screen would sit on SYNCING… forever.
        if (boardSel.mode) loadBoard();
      }
    });
    return;
  }
  if (tag === 'delete') {
    myData.busy = true;
    lbMyData('delete').then(r => {
      if (!myData) return;
      myData.busy = false; myData.step = 'done'; myData.bad = !r.ok;
      myData.msg = r.ok ? (r.rows || 0) + ' run' + (r.rows === 1 ? '' : 's') + ' erased from the boards'
        : (r.human || 'COULD NOT REACH THE BOARDS');
      if (r.ok && boardSel.mode) loadBoard(); // my rows are gone from it — pull the board again
    });
  }
}

function drawMenuHome(ccx, ccy, R) {
  // the MODE WHEEL: the ring's whole interior, cut like a pie into four
  // quarters, with the brand living in the hub — nothing overlaps the ring
  // again. TUTORIAL + LEADERBOARD ride the top corners; CAMPAIGN + FREE FLOW
  // the bottom corners.
  const campDone = anyCampaignCleared();
  const flowOpen = flowUnlocked();
  const r1 = R * 0.92, r0 = R * 0.38;
  // three slices now: LEADERBOARD owns the top, STORY MODE + FREE FLOW the
  // bottom corners (training moved into Story Mode as its lead disc).
  const SECTORS = [
    { mode: 'board', name: 'LEADERBOARD', glyph: '▲', cap: 'top runs',
      mid: -Math.PI / 2, locked: false, primary: false, col: '255,210,74' },
    { mode: 'campaign', name: 'CONTRACTS', glyph: 'C', cap: 'five clients · ' + LEVELS.length + ' stages each',
      mid: Math.PI * 5 / 6, locked: false, primary: !campDone, col: '126,226,98' },
    { mode: 'flow', name: 'FREE FLOW', glyph: '∞', cap: flowOpen ? 'endless · the ranked week' : 'complete level ' + FLOW_UNLOCK_LEVEL + ' to unlock',
      mid: Math.PI / 6, locked: !flowOpen, primary: campDone, col: '120,220,255' }
  ];
  const THIRD = TAU / SECTORS.length; // slice width (name kept for the arc-width math below)
  // choreography: the wheel spins out/in around screen changes
  let rot = 0, wheelAl = 1;
  if (menuFx && menuFx.kind === 'spinOut') { const q = clamp(menuFx.t / menuFx.dur, 0, 1); rot = (menuFx.dir || 1) * q * q * 1.5; wheelAl = 1 - q; }
  if (menuFx && menuFx.kind === 'spinIn') { const q = clamp(menuFx.t / menuFx.dur, 0, 1); rot = -(menuFx.dir || 1) * 1.5 * Math.pow(1 - q, 2); wheelAl = q; }
  ctx.save();
  ctx.globalAlpha = wheelAl;
  ctx.textAlign = 'center';
  // ONE shared label size so all four names match — start LARGE and shrink
  // until the widest ('LEADERBOARD') fills USE of its quarter arc, then every
  // slice draws at that size, centered in the band's radial height so their
  // heights line up too. USE keeps a clean margin off each slice's sides.
  const USE = 0.78;                 // fraction of the quarter arc a label may span
  const OUT = 0.72;                 // label radius in the band: 0.5 = center, →1 rides the outer edge (a longer arc = room for a bigger font)
  let ts = Math.round(R * 0.19);    // start big; the fit loop finds the ceiling
  const labelFits = () => {
    ctx.font = '800 ' + ts + 'px Audiowide, system-ui';
    try { ctx.letterSpacing = (ts * 0.10).toFixed(1) + 'px'; } catch (e) {}
    const trr = r0 + (r1 - r0) * OUT - ts * 0.36;
    return SECTORS.every(s => ctx.measureText(s.name).width <= USE * THIRD * trr);
  };
  while (ts > 8 && !labelFits()) ts--;
  try { ctx.letterSpacing = '0px'; } catch (e) {}
  // arcText sits TOP labels (unflipped) OUTward of the baseline circle and
  // BOTTOM labels (flipped) INward, so a single radius offsets the two halves
  // by a full cap-height. Nudge the radius the opposite way per side so every
  // glyph's VISUAL center lands on baseR — top & bottom line up.
  const baseR = r0 + (r1 - r0) * OUT;   // label center radius, pushed toward the outer edge
  const arcW = USE * THIRD / 0.86;      // matches arcText's 0.86 fill → no re-shrink
  for (const sc0 of SECTORS) {
    const myIdx = menuButtons.length; // the tap-list index this slice takes below
    const sc = Object.assign({}, sc0, { mid: sc0.mid + rot });
    const a0 = sc.mid - THIRD / 2 + 0.02, a1 = sc.mid + THIRD / 2 - 0.02;
    // a controller's focus owns the glow; without one, progression suggests
    const hot = gpNavLive() ? myIdx === gpSel : sc.primary && !sc.locked;
    // slice body
    ctx.beginPath();
    ctx.arc(ccx, ccy, r1, a0, a1);
    ctx.arc(ccx, ccy, r0, a1, a0, true);
    ctx.closePath();
    ctx.fillStyle = sc.locked ? 'rgba(8,16,30,0.55)'
      : hot ? `rgba(${sc.col},${(0.10 + Math.sin(time * 2.5) * 0.04).toFixed(2)})`
      : 'rgba(10,24,48,0.42)';
    ctx.fill();
    ctx.strokeStyle = sc.locked ? 'rgba(90,130,170,0.3)'
      : hot ? `rgba(${sc.col},${(0.75 + Math.sin(time * 2.5) * 0.2).toFixed(2)})`
      : `rgba(${sc.col},0.4)`;
    ctx.lineWidth = hot ? 2.5 : 1.5;
    ctx.stroke();
    // just the NAME, curved with the slice — the badge owns the center, so
    // glyphs, captions and status marks are gone and the title breathes;
    // each mode wears its own color, centered in the slice's radial height
    try { ctx.letterSpacing = (ts * 0.10).toFixed(1) + 'px'; } catch (e) {}
    const flip = Math.sin(sc0.mid) > 0;             // bottom slices read outward-up
    const tr = baseR + (flip ? ts * 0.36 : -ts * 0.36); // flipped→push out, unflipped→pull in, so centers align on baseR
    arcText(sc.name, ccx, ccy, tr, sc.mid, ts,
      sc.locked ? 'rgba(150,180,210,0.45)' : `rgb(${sc.col})`, '800', arcW,
      flip); // orientation pinned to the slice's HOME angle
    try { ctx.letterSpacing = '0px'; } catch (e) {}
    menuButtons.push({ sector: { cx: ccx, cy: ccy, r0, r1, a0: sc0.mid - THIRD / 2 + 0.02, a1: sc0.mid + THIRD / 2 - 0.02 }, mode: sc.mode, locked: sc.locked });
  }
  // the HUB: the shield badge holds the wheel's center; the quiet text
  // core stands in until the badge file ships
  ctx.beginPath(); ctx.arc(ccx, ccy, r0 - R * 0.03, 0, TAU);
  ctx.fillStyle = 'rgba(4,10,22,0.85)'; ctx.fill();
  ctx.strokeStyle = 'rgba(120,220,255,0.4)'; ctx.lineWidth = 1.5; ctx.stroke();
  const hubLg = brandLogo();
  if (hubLg) {
    const fit = r0 * 2 * 1.575; // the badge OVERLAPS the slices — it leads the screen
    const sc2 = Math.min(fit / hubLg.w, fit / hubLg.h);
    const lw3 = hubLg.w * sc2, lh3 = hubLg.h * sc2;
    // ride a touch low (proportional, so every resolution agrees) so the
    // shield's chin caps the side slices' inner ends. The badge itself is NOT
    // stamped here — it's replayed ON TOP of the press/scene FX (drawMenuBadgeTop)
    // so the logo is never occluded by a click flash or transition, and never
    // double-composited over its own soft glow.
    const bx = ccx - lw3 / 2, by = ccy - lh3 / 2 + lh3 * 0.04;
    menuBadge = { img: hubLg.img, x: bx, y: by, w: lw3, h: lh3, alpha: wheelAl };
  } else {
    ctx.strokeStyle = `rgba(255,210,74,${(0.35 + Math.sin(time * 1.8) * 0.12).toFixed(2)})`;
    ctx.beginPath(); ctx.arc(ccx, ccy, r0 * 0.55, 0, TAU); ctx.stroke();
    try { ctx.letterSpacing = '2px'; } catch (e) {}
    ctx.fillStyle = 'rgba(255,210,74,0.9)';
    ctx.font = '700 ' + Math.max(9, Math.round(R * 0.05)) + 'px Audiowide, system-ui';
    ctx.fillText('VANGUARD', ccx, ccy + R * 0.014);
    try { ctx.letterSpacing = '0px'; } catch (e) {}
  }
  ctx.restore();
  // the BIG logo, left of the wheel — rides out with the forward spin and
  // back in with the reverse (the map keeps only the small brand up top)
  let logoOff = 0, logoAl = 1;
  if (menuFx && menuFx.kind === 'spinOut') { const q = clamp(menuFx.t / menuFx.dur, 0, 1); logoOff = -q * q * 340; logoAl = 1 - q; }
  if (menuFx && menuFx.kind === 'spinIn') { const q = clamp(menuFx.t / menuFx.dur, 0, 1); logoOff = -Math.pow(1 - q, 2) * 340; logoAl = q; }
  ctx.save();
  ctx.globalAlpha = logoAl;
  ctx.textAlign = 'left';
  const lg = brandLogo();
  if (lg) {
    // the badge holds the hub — the left column stays clear
  } else { // fallback: the drawn stack, until the badge file ships
    const fs = Math.min(H * 0.115, Math.max(20, (ccx - R - SAFE.l) * 0.24));
    const lx = 22 + SAFE.l + logoOff, llh = fs * 1.04;
    let ly = 30 + SAFE.t + fs;
    ctx.font = '900 ' + fs.toFixed(0) + 'px Audiowide, system-ui';
    try { ctx.letterSpacing = (fs * 0.08).toFixed(1) + 'px'; } catch (e) {}
    ctx.shadowColor = 'rgba(0,10,30,0.85)'; ctx.shadowBlur = lowFX ? 0 : 8; ctx.shadowOffsetY = 3;
    ctx.fillStyle = '#c6d6ea';
    for (const t2 of ['WARP']) { ctx.fillText(t2, lx, ly); ly += llh; }
    ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    try { ctx.letterSpacing = '3px'; } catch (e) {}
    ctx.fillStyle = 'rgba(255,210,74,0.85)'; ctx.font = '700 ' + Math.max(10, fs * 0.42).toFixed(0) + 'px Audiowide, system-ui';
    ctx.fillText('VANGUARD', lx + 2, ly + 4);
    try { ctx.letterSpacing = '0px'; } catch (e) {}
  }
  ctx.restore();
  ctx.textAlign = 'left';
}

// contract carousel: every campaign is a DISC — a bore-ringed lens whose
// top third is the route map and whose lower two thirds carry the dossier —
// laid out in a horizontal, scrollable line. TAKE CONTRACT zooms the disc up
// into the tunnel and opens its relay map.
let campScroll = 0, campScrollTgt = 0; // disc index at stage center (eased)
let campPendingSync = null;            // a tapped off-center disc glides to center, THEN dives in
const CAMPS_SOON = []; // teaser discs — all five campaigns now ship real
function drawMenuCamps(ccx, ccy, R) {
  // entry/exit: the row flies in from the LEFT on arrival and out to the
  // RIGHT on back — the mode wheel spins on the other side of the crossfade
  let rowOff = 0, rowAl = 1;
  if (menuFx && menuFx.kind === 'spinIn') { const q = clamp(menuFx.t / menuFx.dur, 0, 1); rowOff = W * 0.7 * Math.pow(1 - q, 2); rowAl = q; } // in from the RIGHT
  if (menuFx && menuFx.kind === 'spinOut') { const q = clamp(menuFx.t / menuFx.dur, 0, 1); rowOff = W * 0.7 * q * q; rowAl = 1 - q; }
  // sync zoom: the chosen disc swells into the tunnel; the rest fall away
  let zoomI = -1, zq = 0;
  if (menuFx && menuFx.kind === 'discZoom') { zoomI = menuFx.disc; zq = clamp(menuFx.t / menuFx.dur, 0, 1); }
  if (menuFx && menuFx.kind === 'discOut') { zoomI = menuFx.disc; zq = 1 - clamp(menuFx.t / menuFx.dur, 0, 1); }
  const total = discCount();
  const R2 = Math.min(H * 0.34, W * 0.185);
  const dx = R2 * 2.3;
  ctx.save();
  ctx.globalAlpha = rowAl;
  ctx.textAlign = 'center';
  // screen title — same voice as LEADERBOARD (800 Audiowide, wide tracking)
  try { ctx.letterSpacing = '4px'; } catch (e) {}
  const tfs = Math.max(14, Math.round(Math.min(H * 0.045, W * 0.032, (ccy - R2) * 0.42)));
  ctx.font = '800 ' + tfs + 'px Audiowide, system-ui';
  ctx.fillStyle = 'rgba(207,232,255,' + (0.92 * rowAl * (1 - zq)).toFixed(2) + ')';
  // CENTRED IN ITS OWN BAND — the strip between the top of the frame and the
  // top of the discs. It used to hang a fixed 30px off the disc tops, which is
  // not a position but a leftover: on a short screen it crowded the row, on a
  // tall one it stranded halfway up with all the air above it. Baseline MIDDLE
  // so the two gaps read optically equal rather than off a font's ascent.
  ctx.textBaseline = 'middle';
  ctx.fillText('CHOOSE A CONTRACT', ccx, SAFE.t + (ccy - R2 - SAFE.t) * 0.5);
  ctx.textBaseline = 'alphabetic';
  try { ctx.letterSpacing = '0px'; } catch (e) {}
  // every disc titles at ONE size: the tightest fit across the whole row
  let uniT = Math.round(R2 * 0.17);
  for (let i = 0; i < total; i++) {
    const d = discAt(i);
    const t2 = d.kind === 'train' ? 'VANGUARD TRAINING' : d.kind === 'camp' ? d.pk.title : CAMPS_SOON[d.si];
    uniT = Math.min(uniT, fitPx(t2, 800, Math.round(R2 * 0.17), R2 * 1.5, 10));
  }
  let zx = 0, zy = 0, zr = 0; // the zooming disc draws LAST, over its siblings
  for (let i = 0; i < total; i++) {
    const cx2 = ccx + (i - campScroll) * dx + rowOff;
    if (cx2 < -R2 * 1.6 || cx2 > W + R2 * 1.6) continue; // off-stage
    if (i === zoomI && zq > 0) { zx = cx2; zy = ccy; zr = R2; continue; }
    if (zq > 0) ctx.globalAlpha = rowAl * (1 - zq); // siblings fall away
    drawCampDisc(i, cx2, ccy, R2, 0, uniT);
    ctx.globalAlpha = rowAl;
  }
  if (zoomI >= 0 && zq > 0 && zr) {
    // draw at BASE size under a smooth scale transform — text px stay fixed,
    // so nothing jitters while the disc swells into the lens
    const ze = zq * zq, k = lerp(R2, mapR(), ze) / R2;
    ctx.save();
    ctx.translate(lerp(zx, ccx, ze), lerp(zy, ccy, ze));
    ctx.scale(k, k);
    drawCampDisc(zoomI, 0, 0, R2, zq, uniT);
    ctx.restore();
  }
  // scroll hints: chevrons + a dot per disc, only when something is off-stage
  if (zq === 0 && total * dx > W * 0.9) {
    const hy = ccy + R2 + 30;
    ctx.font = '700 11px Audiowide, system-ui';
    for (const [dir, sym, on] of [[-1, '\u2039', campScrollTgt > 0], [1, '\u203a', campScrollTgt < total - 1]]) {
      if (!on) continue;
      const hx = ccx + dir * R2 * 1.6;
      const hb = { x: hx - 17, y: hy - 17, w: 34, h: 34 };
      techRect(hb.x, hb.y, hb.w, hb.h, 8);
      ctx.fillStyle = 'rgba(8,22,44,0.7)'; ctx.fill();
      ctx.strokeStyle = 'rgba(120,210,255,0.5)'; ctx.lineWidth = 1.2;
      techRect(hb.x, hb.y, hb.w, hb.h, 8); ctx.stroke();
      ctx.fillStyle = '#cfeaff';
      ctx.font = '700 18px Audiowide, system-ui';
      ctx.fillText(sym, hx, hy + 6);
      menuButtons.push({ ...hb, scrollDir: dir });
    }
    for (let i = 0; i < total; i++) { // position dots
      ctx.beginPath();
      ctx.arc(ccx + (i - (total - 1) / 2) * 14, hy + 1, i === Math.round(campScrollTgt) ? 3.2 : 2, 0, TAU);
      ctx.fillStyle = i === Math.round(campScrollTgt) ? 'rgba(140,230,255,0.95)' : 'rgba(120,180,255,0.35)';
      ctx.fill();
    }
  }
  ctx.textAlign = 'left';
  ctx.restore();
  ctx.globalAlpha = 1;
}
// one campaign disc: a miniature bore. zq>0 = mid sync-zoom (contents fade
// as the disc becomes the tunnel itself)
// ---------- LIVE DISC ART ----------
// A still bitmap on a disc reads as a printed plate. Two effects, both deliberately
// under the threshold of conscious notice — the test is that you should only catch
// them if you stare at one disc for five seconds:
//
//   DRIFT. The source rect is cropped a few percent tighter than the disc needs and
//   the crop wanders inside that margin. Costs nothing, needs no authoring, and works
//   on every strip including ones added later.
//
//   THRUSTERS. Hand-placed hotspots, because a bitmap's pixels cannot be animated but
//   additive light over them can. Normalised to the image so they ride the drift; the
//   positions were read off each strip by eye, which is the only way to get them right.
//
// Both live here rather than in the disc painter so any surface that paints camp art
// can call one function and get the same behaviour.
const DISC_GLOW = {
  // RE-READ FOR THE 2:1 STRIPS. The re-cut kept full master width, so x carried over;
  // every y was re-read off the new strips because the vertical band changed entirely.
  'cargo-run.webp':  [{ x: 0.152, y: 0.700, r: 0.058, c: '190,220,255' },
                      { x: 0.565, y: 0.760, r: 0.064, c: '205,230,255' },
                      { x: 0.930, y: 0.790, r: 0.062, c: '205,230,255' }],
  'survey.webp':     [{ x: 0.505, y: 0.700, r: 0.062, c: '140,215,255' },
                      { x: 0.600, y: 0.560, r: 0.048, c: '170,230,255' }],
  'collector.webp':  [{ x: 0.878, y: 0.620, r: 0.080, c: '90,240,225' }],
  'patrol.webp':     [{ x: 0.305, y: 0.240, r: 0.066, c: '200,150,255' },
                      { x: 0.612, y: 0.360, r: 0.075, c: '190,160,255' }],
  'delegation.webp': [{ x: 0.648, y: 0.650, r: 0.054, c: '215,235,255' },
                      { x: 0.945, y: 0.800, r: 0.058, c: '200,225,255' }]
};
const DISC_ART_CROP = 0.965;   // how much of the strip shows — the rest is drift margin
// NOT EVERY PLATE IS AN EXTERIOR. The training disc is a simulator cockpit: there is no
// hull to hold still while a sky slides behind it, and no engine to breathe, so a drifting
// starfield over it would just be dirt crawling on a window. It renders as a plate.
// Gil's call, and the right one — the effects are for ships in flight.
const DISC_STILL = { 'training.webp': 1 };
// ---------- PARALLAX ----------
// The ship and the starfield are baked into ONE opaque bitmap, so they cannot be pulled
// apart and moved at different rates. What can be done is add a layer that was never in
// the plate: a procedural starfield, drifting COUNTER to it. Relative motion is then the
// sum of both, so each layer's own movement can stay under the noticing threshold while
// the parallax still reads.
//
// The trick that makes it honest rather than a smear: additive light self-masks. A dim
// star over bright hull metal is imperceptible; over black space it is the whole signal.
// So a drifting star layer already behaves like a BACKGROUND layer — and sampling each
// strip's luminance once makes it exact, fading stars out wherever the plate is bright
// so they never crawl across the ship.
const DISC_LUMA = new Map();     // art key -> { w, h, a } | null when unreadable
function discLuma(im2, key) {
  if (DISC_LUMA.has(key)) return DISC_LUMA.get(key);
  const LW = 84, LH = 28;        // coarse on purpose: this is a mask, not a thumbnail
  let v = null;
  try {
    const c = document.createElement('canvas');
    c.width = LW; c.height = LH;
    const g2 = c.getContext('2d');
    if (g2 && g2.drawImage && g2.getImageData) {
      g2.drawImage(im2.img, 0, 0, LW, LH);
      const d = g2.getImageData(0, 0, LW, LH).data;
      const a = new Uint8Array(LW * LH);
      for (let i = 0; i < LW * LH; i++)
        a[i] = (d[i * 4] * 0.30 + d[i * 4 + 1] * 0.59 + d[i * 4 + 2] * 0.11) | 0;
      v = { w: LW, h: LH, a };
    }
  } catch (e) { v = null; }      // a stubbed ctx, or a tainted canvas: fall back gracefully
  DISC_LUMA.set(key, v);
  return v;
}
// Stars are seeded off the art name, so a disc's sky is its own and never re-scatters
// between frames. mulberry32, not Math.random — this is draw code.
const DISC_SKY = new Map();
function discSky(key) {
  let sky = DISC_SKY.get(key);
  if (sky) return sky;
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 16777619); }
  const rnd = mulberry32(h >>> 0);
  sky = [];
  // DUST, NOT STARS. The first pass drew ~1-2px specks at up to 0.45 alpha, which read as
  // a second population of stars competing with the ones painted into the plate. Finer and
  // fainter, and more of them: dust is something you notice the texture of, not the grains.
  for (let i = 0; i < 190; i++)
    sky.push({ u: rnd(), v: rnd(),
      s: 0.20 + rnd() * 0.40,            // size
      a: 0.10 + rnd() * 0.28,            // base brightness
      w: 0.5 + rnd() * 2.2,              // twinkle rate
      ph: rnd() * 6.2831853,
      near: rnd() < 0.10 });             // a few sit closer and travel further
  DISC_SKY.set(key, sky);
  return sky;
}
function drawLiveCampArt(im2, pk, x, y, r, mh) {
  // aspect-preserving fit: sh0 is the source height whose ratio to the full width matches
  // the art box, so a strip authored at any aspect centre-crops rather than stretching
  const sh0 = Math.min(im2.w * (mh / (r * 2)), im2.h);
  const y0 = clamp((im2.h - sh0) / 2, 0, im2.h);
  if (DISC_STILL[(pk && pk.art) || '']) {   // a plate: no drift, no sky, no thrusters
    ctx.drawImage(im2.img, 0, y0, im2.w, sh0, x - r, y - r, r * 2, mh);
    return;
  }
  const K = DISC_ART_CROP;
  const sw = im2.w * K, sh = sh0 * K;
  // periods chosen coprime-ish (19s and 27s) so the loop never announces itself, and
  // slow enough that five seconds of staring is about a quarter of one sweep
  const px = 0.5 + 0.5 * Math.sin(time * 0.33);
  const py = 0.5 + 0.5 * Math.sin(time * 0.23 + 1.7);
  const ox = (im2.w - sw) * px;
  const oy = y0 + (sh0 - sh) * py;
  ctx.drawImage(im2.img, ox, oy, sw, sh, x - r, y - r, r * 2, mh);
  // BLOOM BREATHE: the same frame again, additive, at a hair of alpha. Additive means
  // it lifts only what is already bright, so it reads as light in the scene rather than
  // as a flat wash over the whole plate.
  // 0.005..0.065, not 0.01..0.10: at a tenth of additive alpha the whole plate visibly
  // brightened, which crosses from "the scene has light in it" into "the screen is
  // pulsing". The thruster cores carry the presence; this only has to keep the frame
  // from sitting perfectly dead.
  const bl = 0.035 + 0.030 * Math.sin(time * 0.41 + 0.6);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = bl;
  ctx.drawImage(im2.img, ox, oy, sw, sh, x - r, y - r, r * 2, mh);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  // ---- the counter-drifting sky ----
  const key = (pk && pk.art) || 'x';
  const sky = discSky(key), lum = discLuma(im2, key);
  ctx.globalCompositeOperation = 'lighter';
  // counter-drift: the plate rides px/py, the sky rides the opposite side of the same
  // sweep, so the two separate at twice either one's speed
  const qx = (1 - px), qy = (1 - py);
  for (const st of sky) {
    const far = st.near ? 2.1 : 1;
    // the star's home is in SOURCE space, so it shares the plate's frame of reference
    const su = st.u * im2.w + (im2.w - sw) * (qx - 0.5) * far * 1.9;
    const sv = st.v * im2.h + (sh0 - sh) * (qy - 0.5) * far * 1.9;
    const u2 = (su - ox) / sw, v2 = (sv - oy) / sh;
    if (u2 < 0 || u2 > 1 || v2 < 0 || v2 > 1) continue;
    // OFF THE HULL. Bright plate -> no star; dark space -> full star. Without this the
    // sky crawls over the ship, which is the exact opposite of a parallax read.
    let mask = 1;
    if (lum) {
      const lx = clamp((st.u * lum.w) | 0, 0, lum.w - 1);
      const ly = clamp((st.v * lum.h) | 0, 0, lum.h - 1);
      mask = clamp(1 - lum.a[ly * lum.w + lx] / 120, 0, 1);
    }
    if (mask < 0.05) continue;
    const tw = 0.55 + 0.45 * Math.sin(time * st.w + st.ph);
    const al = st.a * mask * tw * (st.near ? 0.42 : 0.30);
    if (al < 0.008) continue;
    const gx2 = x - r + u2 * r * 2, gy2 = y - r + v2 * mh;
    // the floor is 0.35px, not 1px: a sub-pixel arc still paints, at reduced coverage,
    // which is exactly what a dust grain should be. Clamping it up to a whole pixel is
    // what made these read as hard little dots.
    const rr2 = st.s * (st.near ? 1.35 : 0.85) * Math.max(0.35, Math.min(W, H) * 0.0013);
    ctx.fillStyle = 'rgba(226,240,255,' + al.toFixed(3) + ')';
    ctx.beginPath(); ctx.arc(gx2, gy2, rr2, 0, TAU); ctx.fill();
  }
  // the thrusters, mapped through the SAME source rect so they track the drift
  const spots = DISC_GLOW[(pk && pk.art) || ''] || [];
  for (let k = 0; k < spots.length; k++) {
    const sp = spots[k];
    const u = (sp.x * im2.w - ox) / sw, v = (sp.y * im2.h - oy) / sh;
    if (u < -0.15 || u > 1.15 || v < -0.15 || v > 1.15) continue; // drifted out of frame
    const gx = x - r + u * r * 2, gy = y - r + v * mh;
    // each hotspot gets its own phase off its index, so a pair of nozzles never
    // pulses in lockstep — two engines breathing as one reads as a blinking light
    const pk2 = 0.62 + 0.38 * Math.sin(time * 1.35 + k * 2.1);
    const rr = sp.r * r * 2 * (0.92 + 0.08 * pk2);
    const gg = ctx.createRadialGradient(gx, gy, 0, gx, gy, rr);
    gg.addColorStop(0, 'rgba(' + sp.c + ',' + (0.34 * pk2).toFixed(3) + ')');
    gg.addColorStop(0.45, 'rgba(' + sp.c + ',' + (0.15 * pk2).toFixed(3) + ')');
    gg.addColorStop(1, 'rgba(' + sp.c + ',0)');
    ctx.fillStyle = gg;
    ctx.beginPath(); ctx.arc(gx, gy, rr, 0, TAU); ctx.fill();
  }
  ctx.restore();
}
function drawCampDisc(i, x, y, r, zq, tpx) {
  const d = discAt(i);
  const train = d.kind === 'train';
  const real = d.kind === 'camp';   // a real contract (training + teasers are not)
  const solid = real || train;      // gets the lit bore + border; teasers stay dim
  // training carries a pseudo-package too, so this is NOT `real ? d.pk : null` — every
  // other read of pk below stays behind `real`, because only a contract has a title,
  // a progress record or a place in the campaign list. The strip is what they share.
  const pk = d.pk || null;
  const title = train ? 'VANGUARD TRAINING' : real ? pk.title : CAMPS_SOON[d.si];
  const cp = real ? (progress.camp[pk.id] || { unlocked: 1, stars: [] }) : null;
  const done = train ? progress.tutorialDone : real && campaignCleared(pk.id);
  const active = real && pk === CAMP;
  const contentAl = 1 - zq;
  ctx.save();
  // the bore: deep radial well + concentric rings, ringed like the tunnel
  const well = ctx.createRadialGradient(x, y, r * 0.1, x, y, r);
  well.addColorStop(0, solid ? 'rgba(30,48,84,0.95)' : 'rgba(16,22,36,0.95)');
  well.addColorStop(1, 'rgba(4,8,18,0.98)');
  ctx.fillStyle = well;
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  for (let k = 1; k <= 3; k++) {
    ctx.strokeStyle = 'rgba(90,160,230,' + (0.10 - k * 0.02).toFixed(2) + ')';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(x, y, r * (1 - k * 0.16), 0, TAU); ctx.stroke();
  }
  ctx.strokeStyle = done ? 'rgba(126,226,98,0.8)' : active ? 'rgba(140,230,255,0.95)' : train ? 'rgba(111,227,255,0.7)' : real ? 'rgba(120,180,255,0.45)' : 'rgba(110,140,180,0.3)';
  ctx.lineWidth = active ? 2.5 : 1.5;
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
  ctx.strokeStyle = 'rgba(60,110,180,0.25)';
  ctx.beginPath(); ctx.arc(x, y, r * 1.05, 0, TAU); ctx.stroke();
  if (contentAl <= 0.02) { ctx.restore(); return; } // fully a tunnel now
  ctx.globalAlpha *= contentAl;
  ctx.beginPath(); ctx.arc(x, y, r * 0.97, 0, TAU); ctx.clip();
  // top third: a real crop of the star chart the route map flies over — same
  // sheet, same cordons, same live systems. The whole strip draws inside its own
  // RECT clip: a cordon ellipse is hundreds of world-px across, so without one it
  // sweeps straight down through the dossier text below.
  // HALF THE CIRCLE IS PICTURE. The art box ran to y - r/3; Gil wants the image given
  // more room, so the chord sits on the centre line. The box is 2r x r — exactly 2:1 —
  // and the strips were re-cut from their masters at 1152x576 to match, full width
  // preserved, because width-cropping the old 3:1 strips would have amputated the
  // yacht's stern and the right-hand haulers.
  const sepY = y;
  const mh = sepY - (y - r);
  ctx.save();
  ctx.beginPath(); ctx.rect(x - r, y - r, r * 2, mh); ctx.clip();
  ctx.fillStyle = 'rgba(8,18,36,0.85)';
  ctx.fillRect(x - r, y - r, r * 2, mh);
  const rng = mulberry32(0xD15C + i * 7919);
  let painted = false; // a real picture landed on the strip, so nothing stands in for one
  if (pk) { // the client's art, else the campaign's own map image, else the chart crop
    // `art` outranks `map.image` here: this strip is the contract's face, and once a
    // campaign has a picture of its client that is what belongs on it. The map image is
    // still the right thing on the map SCREEN, which is a different surface.
    const im2 = campArtImg(pk) || campMapImg(pk);
    if (im2) {
      painted = true;
      drawLiveCampArt(im2, pk, x, y, r, mh);
    } else {
      if (!cityBase) buildCity();
      // each disc previews the stretch of city ITS case works — the inner
      // cases show the lit core, the late ones the dark out past the rings
      const ch = CITY_CHAINS[CAMPAIGNS.indexOf(pk)];
      let cx2 = CITY_W / 2, cy2 = CITY_H / 2, sw2 = CITY_W * 0.55;
      if (ch && ch.pts.length) {
        let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
        for (const p2 of ch.pts) { x0 = Math.min(x0, p2.x); y0 = Math.min(y0, p2.y); x1 = Math.max(x1, p2.x); y1 = Math.max(y1, p2.y); }
        cx2 = (x0 + x1) / 2; cy2 = (y0 + y1) / 2;
        sw2 = clamp((x1 - x0) * 1.25, 620, CITY_W);
      }
      const sh2 = sw2 * (mh / (r * 2));
      const sx2 = clamp(cx2 - sw2 / 2, 0, Math.max(0, CITY_W - sw2));
      const sy2 = clamp(cy2 - sh2 / 2, 0, Math.max(0, CITY_H - sh2));
      ctx.drawImage(cityBase, sx2 * BASE_K, sy2 * BASE_K, sw2 * BASE_K, sh2 * BASE_K, x - r, y - r, r * 2, mh);
      // the disc shares the live layers, so its crop gets the same sharp stars,
      // cordons and star systems the lens does — one pass, no second version to
      // drift. Type is the one thing it drops: 12px is a headline at this size.
      { const dz = (r * 2) / sw2;
        const ox = (x - r) - sx2 * dz, oy = (y - r) - sy2 * dz;
        drawGalaxyOverlay({ ox, oy, z: dz }, x, y, r, false);
        drawSystemsLive(p2 => ox + p2.x * dz, p2 => oy + p2.y * dz, dz, x, y, r);
      }
    }
  }
  if (train && !painted) { // a practice reticle stands in for the route map — but only
    // while there is no picture on the strip, and it is drawn AFTER it, so a decode that
    // lands late would otherwise put crosshairs across the ship
    const ty = (y - r + sepY) / 2, tr = (sepY - (y - r)) * 0.36;
    ctx.strokeStyle = 'rgba(111,227,255,0.55)'; ctx.lineWidth = 1.2;
    for (let k = 1; k <= 3; k++) { ctx.beginPath(); ctx.arc(x, ty, tr * k / 3, 0, TAU); ctx.stroke(); }
    ctx.beginPath();
    ctx.moveTo(x - tr * 1.25, ty); ctx.lineTo(x + tr * 1.25, ty);
    ctx.moveTo(x, ty - tr * 1.25); ctx.lineTo(x, ty + tr * 1.25);
    ctx.stroke();
    ctx.fillStyle = 'rgba(111,227,255,0.9)';
    ctx.beginPath(); ctx.arc(x, ty, 2.2, 0, TAU); ctx.fill();
  } else if (!real && !train) { // static for the teasers — `!train` because a painted
    // training disc now falls past the branch above, and must not land here instead
    ctx.fillStyle = 'rgba(120,170,230,0.25)';
    for (let k = 0; k < 26; k++) ctx.fillRect(x - r + rng() * r * 2, y - r + rng() * (r * 0.6), 2, 2);
  }
  ctx.restore(); // end of the map strip's rect clip
  ctx.strokeStyle = 'rgba(120,200,255,0.35)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x - r, sepY); ctx.lineTo(x + r, sepY); ctx.stroke();
  // dossier: big title, then the data lines
  // TIER n -> m, lifted out of a package's tagline. Taglines are authored as
  // 'CLIENT NAME · TIER 1 → 3', so the tier is whichever segment mentions one; anything
  // else and the whole tagline is the honest fallback rather than a blank line.
  function tierOf(pack) {
    const t = (pack && pack.tagline) || '';
    const seg = t.split('·').map(v => v.trim()).find(v => /tier/i.test(v));
    return seg || t;
  }
  // THE TITLE LIVES ON THE PICTURE. Bottom edge of the art, over a scrim — a dark
  // gradient rising to the chord — so it reads on a bright plate, with a soft cyan
  // glow. shadowBlur is fine here: this is the menu, not the run.
  ctx.textAlign = 'center';
  const scrim = ctx.createLinearGradient(x, sepY - r * 0.34, x, sepY);
  scrim.addColorStop(0, 'rgba(4,10,22,0)');
  scrim.addColorStop(1, 'rgba(4,10,22,0.82)');
  ctx.fillStyle = scrim;
  ctx.fillRect(x - r, sepY - r * 0.34, r * 2, r * 0.34);
  if (tpx === undefined) tpx = fitPx(title, 800, Math.round(r * 0.17), r * 1.7, 10);
  ctx.font = '800 ' + tpx + 'px Audiowide, system-ui';
  ctx.save();
  ctx.shadowColor = solid ? 'rgba(120,215,255,0.85)' : 'rgba(120,215,255,0.35)';
  ctx.shadowBlur = lowFX ? 0 : r * 0.055;
  ctx.fillStyle = solid ? '#eaf7ff' : 'rgba(150,175,210,0.8)';
  ctx.fillText(title, x, sepY - r * 0.055);
  ctx.fillText(title, x, sepY - r * 0.055);   // twice: the glow builds, the face stays crisp
  ctx.restore();
  ctx.font = '700 ' + Math.max(9, Math.round(r * 0.085)) + 'px Audiowide, system-ui';
  if (train) {
    ctx.fillStyle = done ? 'rgba(126,226,98,0.95)' : 'rgba(140,200,240,0.8)';
    ctx.fillText(done ? 'QUALIFIED ✓' : 'QUALIFICATION RUN', x, sepY + r * 0.20);
    ctx.font = '500 ' + Math.max(8, Math.round(r * 0.07)) + 'px Audiowide, system-ui';
    ctx.fillStyle = 'rgba(130,180,225,0.7)';
    // one line, in the same slot the contracts use for their tier range. It used to list
    // the curriculum over two lines, which is the disc explaining itself before you have
    // seen any of it — the drills teach that far better than a caption can.
    ctx.fillText('LEARN THE ESSENTIALS', x, sepY + r * 0.42);
  } else if (real) {
    const starSum = (cp.stars || []).reduce((a2, b2) => a2 + b2, 0);
    ctx.fillStyle = 'rgba(160,210,250,0.85)';
    // draw the relay/difficulty line, then a small gold shield + rating count after it
    const rateStr = starSum + '/' + pk.levels.length * 3;
    // STAGES, and no difficulty triangles: the tier range on the bottom line already
    // says how hard a contract is, and says it in the fiction's own terms.
    const headStr = pk.levels.length + ' STAGES \u00b7 ';
    const sPx = Math.max(9, Math.round(r * 0.085));
    const shR = sPx * 0.5, gap = shR * 0.9;
    const headW = ctx.measureText(headStr).width;
    const rateW = ctx.measureText(rateStr).width;
    const totW = headW + shR * 2 + gap + rateW;
    const lineY = sepY + r * 0.20;
    ctx.textAlign = 'left';
    ctx.fillText(headStr, x - totW / 2, lineY);
    const shX = x - totW / 2 + headW + shR;
    shieldPath(shX, lineY - sPx * 0.32, shR);
    ctx.fillStyle = '#ffd24a'; ctx.fill();
    ctx.fillStyle = 'rgba(160,210,250,0.85)';
    ctx.fillText(rateStr, shX + shR + gap, lineY);
    ctx.textAlign = 'center';
    ctx.fillStyle = done ? 'rgba(126,226,98,0.95)' : 'rgba(140,200,240,0.8)';
    // a COUNT, not a level id — level numbers run continuously across campaigns
    ctx.fillText(done ? 'CONTRACT COMPLETE' : Math.min(cp.unlocked || 1, pk.levels.length) + ' / ' + pk.levels.length + ' STAGES', x, sepY + r * 0.375);
    // THE TIER RANGE ONLY. A tagline reads 'HAULERS CONSORTIUM · TIER 1 → 3' — and the
    // client is already the disc's whole picture and its title, so printing it again
    // underneath was the line explaining what the disc had just shown. What is left is
    // the one thing said nowhere else: how deep the contract goes.
    ctx.font = '500 ' + Math.max(8, Math.round(r * 0.07)) + 'px Audiowide, system-ui';
    ctx.fillStyle = 'rgba(130,180,225,0.7)';
    ctx.fillText(tierOf(pk), x, sepY + r * 0.52);
  }
  if (solid) {
    // TAKE CONTRACT: the disc's own bottom segment — the circle edge IS the
    // button edge; a chord line separates it from the dossier
    const rr2 = r * 0.97, dSeg = r * 0.60;
    const aSeg = Math.asin(clamp(dSeg / rr2, 0, 1)); // chord intersection angle
    ctx.beginPath();
    ctx.arc(x, y, rr2, aSeg, Math.PI - aSeg);
    ctx.closePath();
    ctx.fillStyle = active ? 'rgba(40,120,190,0.5)' : 'rgba(14,40,72,0.8)'; ctx.fill();
    const chHalf = rr2 * Math.cos(aSeg);
    ctx.strokeStyle = 'rgba(140,230,255,0.75)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(x - chHalf, y + dSeg); ctx.lineTo(x + chHalf, y + dSeg); ctx.stroke();
    ctx.font = '700 ' + Math.max(10, Math.round(r * 0.085)) + 'px Audiowide, system-ui';
    ctx.fillStyle = '#dff4ff';
    ctx.textAlign = 'center';
    ctx.fillText(train ? (done ? '\u25b6 RETRAIN' : '\u25b6 BEGIN TRAINING') : '\u25b6 TAKE CONTRACT', x, y + dSeg + (rr2 - dSeg) * 0.56);
    if (zq === 0) { // mid-zoom the disc is scenery, not a control
      menuButtons.push({ x: x - chHalf, y: y + dSeg, w: chHalf * 2, h: rr2 - dSeg, sync: i,
        seg: { cx: x, cy: y, r: rr2, d: dSeg } }); // press flash wears the segment shape
      menuButtons.push({ x: x - r, y: y - r, w: r * 2, h: r + dSeg, campDisc: i }); // body = bring to center
    }
  } else {
    ctx.fillStyle = 'rgba(150,175,210,0.75)';
    ctx.fillText('COMING SOON', x, sepY + r * 0.24);
    ctx.font = '500 ' + Math.max(8, Math.round(r * 0.07)) + 'px Audiowide, system-ui';
    ctx.fillStyle = 'rgba(120,150,190,0.55)';
    ctx.fillText('a new contract is being drawn up', x, sepY + r * 0.44);
  }
  ctx.textAlign = 'left';
  ctx.restore();
}
function drawMenuFlow() {
  const { ccx, ccy, R } = menuGeom();
  // both lanes ride the same gate as the FREE FLOW key itself — opening the
  // door onto two locked halves would be a dead end
  const endlessOpen = flowUnlocked();
  const weeklyOpen = flowUnlocked();
  const r1 = R * 0.92, r0 = R * 0.38;
  const D = progress.weekly;
  let rot = 0, wheelAl = 1; // same spin choreography as the mode wheel
  if (menuFx && menuFx.kind === 'spinOut') { const q = clamp(menuFx.t / menuFx.dur, 0, 1); rot = (menuFx.dir || 1) * q * q * 1.5; wheelAl = 1 - q; }
  if (menuFx && menuFx.kind === 'spinIn') { const q = clamp(menuFx.t / menuFx.dur, 0, 1); rot = -(menuFx.dir || 1) * 1.5 * Math.pow(1 - q, 2); wheelAl = q; }
  const HALVES = [
    { key: 'endless', glyph: '∞', name: 'ENDLESS LANE', mid: -Math.PI / 2, locked: !endlessOpen, col: '255,210,74',
      cap: endlessOpen ? 'procedural · no mercy' + (progress.best > 0 ? ' · BEST ' + progress.best.toLocaleString() : '') : 'complete level ' + FLOW_UNLOCK_LEVEL + ' to unlock' },
    { key: 'weekly', glyph: '◈', name: 'WEEKLY LANE', mid: Math.PI / 2, locked: !weeklyOpen, col: '140,220,255',
      cap: weeklyOpen ? 'one seeded lane all week' + (D && D.best ? ' · BEST ' + D.best.toLocaleString() : '') : 'complete level ' + FLOW_UNLOCK_LEVEL + ' to unlock',
      streak: weeklyOpen ? weeklyStreak() : null }
  ];
  ctx.save();
  ctx.globalAlpha = wheelAl;
  ctx.textAlign = 'center';
  for (const hv of HALVES) {
    const myIdx = menuButtons.length; // the tap-list index this half takes below
    const mid = hv.mid + rot;
    const a0 = mid - Math.PI / 2 + 0.03, a1 = mid + Math.PI / 2 - 0.03;
    ctx.beginPath();
    ctx.arc(ccx, ccy, r1, a0, a1);
    ctx.arc(ccx, ccy, r0, a1, a0, true);
    ctx.closePath();
    // a controller's focus owns the glow; without one, ENDLESS suggests
    const hot = gpNavLive() ? myIdx === gpSel : !hv.locked && hv.key === 'endless';
    ctx.fillStyle = hv.locked ? 'rgba(8,16,30,0.55)'
      : hot ? `rgba(${hv.col},${(0.09 + Math.sin(time * 2.5) * 0.03).toFixed(2)})` : 'rgba(10,24,48,0.42)';
    ctx.fill();
    ctx.strokeStyle = hv.locked ? 'rgba(90,130,170,0.3)' : `rgba(${hv.col},${hot ? 0.8 : 0.45})`;
    ctx.lineWidth = hot ? 2.5 : 1.5;
    ctx.stroke();
    const rm = (r0 + r1) / 2;
    const tx = ccx + Math.cos(mid) * rm, ty = ccy + Math.sin(mid) * rm;
    ctx.fillStyle = hv.locked ? 'rgba(140,170,200,0.35)' : `rgba(${hv.col},0.9)`;
    ctx.font = '800 ' + Math.round(R * 0.11) + 'px Audiowide, system-ui';
    ctx.fillText(hv.glyph, tx, ty + R * 0.035);
    arcText(hv.name, ccx, ccy, r1 - R * 0.135, mid, Math.round(R * 0.07),
      hv.locked ? 'rgba(150,180,210,0.45)' : '#eaf6ff', '800', Math.PI * 0.9);
    arcText(hv.cap, ccx, ccy, r0 + R * 0.075, mid, Math.max(8, Math.round(R * 0.04)),
      hv.locked ? 'rgba(140,170,200,0.4)' : 'rgba(160,215,255,0.75)', '500', Math.PI * 0.9);
    // THE STREAK RIDES ITS OWN LINE. It is not a description of the lane — it is
    // the player's standing in it — so it gets its own weight and its own colour
    // rather than a third clause on a caption already carrying the mode and the
    // best. Amber when the streak is alive but unfiled (this week still has to be
    // earned, and that is the whole reason to be looking at this screen); the
    // lane's own blue once the week is banked.
    //
    // It sits in the band BETWEEN the caption and the glyph. The obvious slot —
    // just inside the caption, toward the hub — was tried and collided: the arc
    // radii there are only R*0.05 apart and the two lines print into each other.
    // This gap is the widest empty run in the sector.
    if (hv.streak) {
      const st = hv.streak;
      arcText(st.held ? 'STREAK ' + st.n + ' WK — BANKED' : 'STREAK ' + st.n + ' WK — ENDS SUNDAY',
        ccx, ccy, r0 + R * 0.155, mid, Math.max(8, Math.round(R * 0.037)),
        st.held ? 'rgba(140,220,255,0.9)' : 'rgba(255,196,74,0.95)', '800', Math.PI * 0.9);
    }
    menuButtons.push({ sector: { cx: ccx, cy: ccy, r0, r1, a0: hv.mid - Math.PI / 2 + 0.03, a1: hv.mid + Math.PI / 2 - 0.03 },
      endless: hv.key === 'endless', weekly: hv.key === 'weekly', locked: hv.locked });
  }
  // hub
  ctx.beginPath(); ctx.arc(ccx, ccy, r0 - R * 0.03, 0, TAU);
  ctx.fillStyle = 'rgba(4,10,22,0.85)'; ctx.fill();
  ctx.strokeStyle = 'rgba(120,220,255,0.4)'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = 'rgba(120,220,255,0.9)';
  try { ctx.letterSpacing = '2px'; } catch (e) {}
  ctx.font = '800 ' + Math.round(R * 0.062) + 'px Audiowide, system-ui';
  ctx.fillText('FREE', ccx, ccy - R * 0.02);
  ctx.fillText('FLOW', ccx, ccy + R * 0.05);
  try { ctx.letterSpacing = '0px'; } catch (e) {}
  ctx.restore();
  ctx.textAlign = 'left';

  // score modifiers — the campaign reward for players chasing numbers.
  // Locked they still SHOW (padlocked, like the wheel halves) so a fresh
  // device knows the reward exists.
  {
    const mutsOpen = anyCampaignCleared();
    const MUTS = [['oneLife', '1 LIFE', '×2'], ['fast', 'FAST LANE', '×1.5'], ['noPickups', 'NO PICKUPS', '×1.3']];
    // relay-key sizing: as tall as the map's level keys, as wide as the wheel allows
    const mx = 26 + SAFE.l, mh = 34, mgap = 9;
    const mw = clamp(ccx - r1 - mx - 16, 128, 240);
    let my2 = Math.max(H * 0.5 - 20, 96 + SAFE.t);
    ctx.font = '700 10px Audiowide, system-ui';
    ctx.fillStyle = 'rgba(120,210,255,0.75)';
    try { ctx.letterSpacing = '2px'; } catch (e) {}
    ctx.fillText('MODIFIERS', mx, my2 - 12);
    try { ctx.letterSpacing = '0px'; } catch (e) {}
    let mi = 0;
    const mutOff = i => { // same staggered fly-in/out grammar as the relay list
      if (!menuFx) return 0;
      const span = 200 + SAFE.l + mw;
      if (menuFx.kind === 'spinIn') { const q = clamp((menuFx.t - i * 0.08) / 0.26, 0, 1); return -span * Math.pow(1 - q, 2); }
      if (menuFx.kind === 'spinOut' || menuFx.kind === 'launch') { const q = clamp((menuFx.t - i * 0.06) / 0.2, 0, 1); return -span * q * q; }
      return 0;
    };
    for (const [key, label, mult] of MUTS) {
      const r2 = { x: mx + mutOff(mi++), y: my2, w: mw, h: mh, key };
      const on = mutsOpen && mutators[key];
      const hot = mutsOpen && gpNavLive() && menuButtons[gpSel] && menuButtons[gpSel].mut === key;
      techRect(r2.x, r2.y, r2.w, r2.h, 6);
      ctx.fillStyle = on ? 'rgba(120,80,10,0.55)' : mutsOpen ? 'rgba(6,20,40,0.55)' : 'rgba(8,16,30,0.4)';
      ctx.fill();
      ctx.strokeStyle = on ? 'rgba(255,210,74,0.9)' : hot ? 'rgba(140,230,255,0.7)'
        : mutsOpen ? 'rgba(120,180,255,0.35)' : 'rgba(120,180,255,0.15)';
      ctx.lineWidth = 1.5;
      techRect(r2.x, r2.y, r2.w, r2.h, 6); ctx.stroke();
      ctx.textBaseline = 'middle';
      ctx.fillStyle = on ? '#ffe9b0' : mutsOpen ? 'rgba(160,200,240,0.7)' : 'rgba(160,200,240,0.35)';
      ctx.font = '700 11px Audiowide, system-ui';
      ctx.fillText(label, r2.x + 12, r2.y + mh / 2 + 1);
      ctx.textAlign = 'right';
      ctx.fillStyle = on ? '#ffd24a' : 'rgba(160,200,240,' + (mutsOpen ? 0.5 : 0.3) + ')';
      ctx.fillText(mult, r2.x + r2.w - (mutsOpen ? 10 : 30), r2.y + mh / 2 + 1); // locked: clear of the padlock
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      if (mutsOpen) {
        menuMutRects.push(r2);
        menuButtons.push({ x: r2.x, y: r2.y, w: r2.w, h: r2.h, mut: key }); // the pad walks here too
      } else padlock(r2.x + r2.w - 16, r2.y + mh / 2, 5);
      my2 += mh + mgap;
    }
    const mm2 = mutsOpen ? mutMulRaw() : 1; // the loadout preview — raw, the menu is not a run
    if (mm2 > 1) {
      ctx.fillStyle = '#ffd24a'; ctx.font = '700 11px Audiowide, system-ui';
      ctx.fillText('SCORE ×' + (Math.round(mm2 * 100) / 100), mx, my2 + 10);
    } else if (!mutsOpen) {
      ctx.fillStyle = 'rgba(140,170,200,0.5)'; ctx.font = '500 10px Audiowide, system-ui';
      ctx.fillText('finish a contract to unlock', mx, my2 + 10);
    }
  }
}
