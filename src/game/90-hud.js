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
function drawIntroCard() {
  const L = LV || LEVELS[levelIdx];
  if (introT < INTRO_DUR + 0.5) {
    const t = introT;
    ctx.textAlign = 'center';
    if (t < INTRO_DUR) {
      const inA = clamp(t / 0.35, 0, 1);
      const outA = clamp((INTRO_DUR - t) / 0.45, 0, 1);
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
      ctx.shadowColor = '#5fd7ff'; ctx.shadowBlur = 24;
      ctx.fillText(lname, 0, 0);
      ctx.shadowBlur = 0;
      try { ctx.letterSpacing = '0px'; } catch (e) {}
      if (L.hint) {
        const hpx = fitPx(L.hint, '600', 12, titleMaxW, 9);
        ctx.fillStyle = '#ffb8c8'; ctx.font = '600 ' + hpx + 'px Audiowide, system-ui';
        ctx.fillText(L.hint, 0, 26);
      }
      ctx.restore();
      // boot stage callouts, stamped like an ops console — no bounce, no chatter
      const stI = t >= INTRO_GATE ? 3 : t >= BOOT_LOCK ? 1 : 0;
      const stStart = [0, BOOT_LOCK, 0, INTRO_GATE][stI];
      const ct = t - stStart;
      const labels = ['LOCKING ON LANE', 'ACTIVATING EMITTERS', '', 'AWAITING RUNNER'];
      const ly = H * 0.52;
      ctx.save();
      ctx.globalAlpha = stI === 3 ? 0.8 + Math.sin(time * 2.5) * 0.15 : Math.min(1, ct / 0.06);
      const lcol = stI === 3 ? '#ffd24a' : '#8fe0ff';
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
      ctx.strokeStyle = stI === 3 ? 'rgba(255,210,74,0.6)' : 'rgba(143,224,255,0.55)';
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
        const rp = clamp(t / BOOT_LOCK, 0, 1); // distance left to the dock, same motion law
        const rngM = (1 - rp * rp * (3 - 2 * rp)) * 26;
        sub = 'RANGE ' + rngM.toFixed(1).padStart(5, '0') + ' M';
        subT = t; // live readout — never flash-stamps
      } else if (stI === 1) {
        if (t >= BOOT_ON) { sub = 'ALL SYSTEMS — ONLINE'; subT = BOOT_ON; }
        else if (t >= BOOT_LOCK + 0.3) { sub = 'CHARGING NODES + CONSOLES'; subT = BOOT_LOCK + 0.3; }
        else sub = 'DOCK CONFIRMED';
      }
      if (sub) {
        const sct = t - subT;
        ctx.globalAlpha = Math.min(1, sct / 0.05 + 0.4);
        ctx.fillStyle = sct < 0.07 ? 'rgba(235,250,255,0.95)' : 'rgba(150,200,235,0.75)';
        ctx.font = '600 12px ui-monospace, Menlo, monospace';
        ctx.fillText(sub + (Math.sin(time * 6) > 0 ? ' ▎' : '  '), W / 2, ly + 32);
      }
      if (stI === 3) { // the gate explains itself
        ctx.globalAlpha = 0.85;
        ctx.fillStyle = 'rgba(200,235,255,0.8)';
        ctx.font = '500 11px Audiowide, system-ui';
        ctx.fillText(gpSeen ? 'HOLD BOTH STICKS — OPPOSITE SIDES' : 'PLACE BOTH THUMBS ON THE PADS', W / 2, ly + 32);
      }
    } else { // CONTROLS ACTIVE — the lane goes live (Lane Command says godspeed)
      const gt = (t - INTRO_DUR) / 0.6;
      ctx.save();
      ctx.translate(W / 2, H * 0.52);
      ctx.globalAlpha = 1 - gt * gt;
      ctx.fillStyle = gt < 0.1 ? '#ffffff' : '#7ee262';
      ctx.font = '800 ' + Math.min(W * 0.055, 34) + 'px Audiowide, system-ui';
      ctx.shadowColor = '#7ee262'; ctx.shadowBlur = 22;
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

// procedural holo-portraits for the comm line — line-art busts in the
// speaker's color, scanlined and flickering like a tapped video feed.
// HAUL: suit + lapel pin · CMD: peaked cap + badge · TRACE: hooded, face
// lost to glitch bars · CORE: nothing human, a spiked core
function drawCommFace(s, cx2, cy3, r, col) {
  ctx.save();
  ctx.translate(cx2, cy3);
  const flick = 0.8 + Math.sin(time * 13) * 0.1 + (Math.random() < 0.04 ? -0.3 : 0);
  ctx.globalAlpha *= Math.max(0.4, flick);
  ctx.strokeStyle = `rgba(${col},0.9)`;
  ctx.fillStyle = `rgba(${col},0.16)`;
  ctx.lineWidth = 1.4;
  ctx.lineJoin = 'round';
  if (s === 'WARD') { // the rogue warden: a void disc, watching
    ctx.fillStyle = 'rgba(3,1,8,0.95)';
    ctx.beginPath(); ctx.arc(0, 0, r * 0.88, 0, TAU); ctx.fill();
    ctx.strokeStyle = `rgba(${col},0.9)`;
    ctx.beginPath(); ctx.arc(0, 0, r * 0.88, Math.PI * 0.75, Math.PI * 1.8); ctx.stroke(); // horizon rim
    ctx.strokeStyle = 'rgba(255,60,90,0.6)';
    ctx.beginPath(); ctx.arc(0, 0, r * 0.88, Math.PI * 0.08, Math.PI * 0.5); ctx.stroke(); // red underglow
    const ig = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 0.62); // the HAL lens
    ig.addColorStop(0, 'rgba(255,240,225,0.98)');
    ig.addColorStop(0.25, 'rgba(255,110,110,0.95)');
    ig.addColorStop(0.6, 'rgba(170,25,55,0.9)');
    ig.addColorStop(1, 'rgba(40,4,16,0)');
    ctx.fillStyle = ig;
    ctx.beginPath(); ctx.arc(0, 0, r * 0.62, 0, TAU); ctx.fill();
  } else if (s === 'TRACE') { // hooded silhouette
    ctx.beginPath();
    ctx.moveTo(-r, r * 1.05);
    ctx.quadraticCurveTo(-r * 1.05, -r * 0.55, 0, -r * 1.02);
    ctx.quadraticCurveTo(r * 1.05, -r * 0.55, r, r * 1.05);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(3,6,14,0.85)'; // void where the face should be
    ctx.beginPath(); ctx.arc(0, -r * 0.08, r * 0.5, 0, TAU); ctx.fill();
    for (const gy of [-0.28, 0, 0.24]) {  // glitch bars scanning the void
      const gw = r * (0.34 + Math.sin(time * 7 + gy * 9) * 0.14);
      ctx.beginPath(); ctx.moveTo(-gw, (gy - 0.08) * r); ctx.lineTo(gw, (gy - 0.08) * r); ctx.stroke();
    }
  } else { // HAUL / CMD: head + shoulders, each with their uniform's tell
    ctx.beginPath(); ctx.arc(0, -r * 0.32, r * 0.42, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-r * 0.95, r * 1.05);
    ctx.quadraticCurveTo(0, r * 0.05, r * 0.95, r * 1.05);
    ctx.fill(); ctx.stroke();
    if (s === 'CMD') { // peaked cap seated ON the head, badge on the dome
      ctx.fillStyle = 'rgba(6,12,26,0.9)'; // solid crown so the head reads as capped
      ctx.beginPath();
      ctx.moveTo(-r * 0.62, -r * 0.52);
      ctx.quadraticCurveTo(0, -r * 1.1, r * 0.62, -r * 0.52);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-r * 0.66, -r * 0.5); ctx.lineTo(r * 0.66, -r * 0.5); ctx.stroke();
      ctx.fillStyle = `rgba(${col},0.95)`;
      ctx.beginPath(); ctx.arc(0, -r * 0.74, r * 0.08, 0, TAU); ctx.fill();
    } else { // HAUL: corporate tie + lapel pin
      ctx.beginPath();
      ctx.moveTo(0, r * 0.22); ctx.lineTo(-r * 0.13, r * 0.52);
      ctx.lineTo(0, r * 0.95); ctx.lineTo(r * 0.13, r * 0.52);
      ctx.closePath(); ctx.stroke();
      ctx.fillStyle = `rgba(${col},0.95)`;
      ctx.beginPath(); ctx.arc(r * 0.48, r * 0.6, r * 0.07, 0, TAU); ctx.fill();
    }
  }
  ctx.strokeStyle = `rgba(${col},0.10)`; // transmission scanlines over the feed
  ctx.lineWidth = 1;
  for (let sy = -r; sy < r * 1.1; sy += 3) {
    ctx.beginPath(); ctx.moveTo(-r, sy); ctx.lineTo(r, sy); ctx.stroke();
  }
  ctx.restore();
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
  ctx.lineCap = 'round';
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

  // right curved bar: 4 life blocks — or a continuous hitpoint bar during the
  // duel. Wears the SAME casing + capsule ends as the progress bar across the
  // bore (same length, same edge radius); only the seams inside stay flat.
  const aR0 = -Math.PI * 0.06, aR1 = -ELEV; // mirrored: lower-right → upper-right
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
  ctx.lineCap = 'round';

  // score (right) — suppressed while watching a replay; drawReplayChrome owns the
  // right side there (live score + the run's stat panel)
  const sy = H * 0.12;
  if (!replaying) {
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

  // resume countdown after unpausing
  if (resumeHold > 0) {
    const d2 = Math.max(1, Math.ceil(resumeHold / 0.3));
    ctx.textAlign = 'center';
    ctx.globalAlpha = 0.92;
    ctx.fillStyle = '#ffd24a';
    ctx.font = '800 ' + Math.min(W * 0.08, 46) + 'px Audiowide, system-ui';
    ctx.shadowColor = '#ffd24a'; ctx.shadowBlur = 20;
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

  // intercepted transmission ticker — voices on the line you're guarding
  if (commCur && state === S.PLAY) {
    const SPK = SPKCOL; // speaker colors come with the campaign package
    const label = '\u00bb ' + commCur.s + ':';
    const chars = Math.floor(commT * 38);
    const txt = commCur.m.slice(0, chars);
    const fade = commT < 0.2 ? commT / 0.2 : clamp((6 - commT) / 0.8, 0, 1);
    ctx.save();
    ctx.globalAlpha = Math.min(1, fade);
    const cy2 = Math.max(14 + SAFE.t + 38, H * 0.185); // inside the bore's clear width
    const pr = 14, pb = pr * 2 + 8; // holo-portrait tile + its gap
    // shrink the line until portrait + chip + message fit the chord here
    let cfz = 10, lw2, tw2;
    for (; cfz >= 8; cfz--) {
      ctx.font = '700 ' + cfz + 'px Audiowide, system-ui';
      lw2 = ctx.measureText(label).width;
      ctx.font = '500 ' + cfz + 'px Audiowide, system-ui';
      tw2 = ctx.measureText(commCur.m).width;
      if (pb + lw2 + 6 + tw2 <= ringChord(cy2, 26)) break;
    }
    const x0 = W / 2 - (pb + lw2 + 6 + tw2) / 2 + pb;
    ctx.textAlign = 'left';
    const spkCol = SPK[commCur.s] || '160,215,255';
    // portrait tile, chamfered like the rest of the HUD chrome — the voice
    // gets a face, like a rough video call from inside the wire
    const bx = x0 - 6 - pb + 4, by = cy2 - 4 - pr;
    ctx.fillStyle = 'rgba(6,12,26,0.8)';
    techRect(bx, by, pr * 2, pr * 2, 5); ctx.fill();
    ctx.save();
    techRect(bx, by, pr * 2, pr * 2, 5); ctx.clip();
    drawCommFace(commCur.s, bx + pr, by + pr + 1.5, pr * 0.82, spkCol);
    ctx.restore();
    ctx.strokeStyle = `rgba(${spkCol},0.55)`; ctx.lineWidth = 1;
    techRect(bx, by, pr * 2, pr * 2, 5); ctx.stroke();
    ctx.fillStyle = `rgba(${spkCol},0.14)`;
    roundRect(x0 - 6, cy2 - 11, lw2 + 11, 15, 4); ctx.fill();
    ctx.strokeStyle = `rgba(${spkCol},0.5)`; ctx.lineWidth = 1;
    roundRect(x0 - 6, cy2 - 11, lw2 + 11, 15, 4); ctx.stroke();
    ctx.fillStyle = `rgba(${spkCol},0.95)`;
    ctx.font = '700 ' + cfz + 'px Audiowide, system-ui';
    ctx.fillText(label, x0, cy2);
    ctx.fillStyle = 'rgba(200,235,255,0.92)';
    ctx.font = '500 ' + cfz + 'px Audiowide, system-ui';
    ctx.fillText(txt + (chars < commCur.m.length ? '\u258c' : ''), x0 + lw2 + 6, cy2);
    ctx.restore();
  }

  // surge countdown: the header holds, the digits slam in beneath it
  if (endless && !boss && state === S.PLAY) {
    const surge = Math.floor(levelT / 100);
    const toNext = (surge + 1) * 100 - levelT;
    if (surge < 6 && toNext <= 4.2 && toNext > 0) {
      const cnt = Math.ceil(toNext);
      const ct = 1 - (toNext - Math.floor(toNext)); // 0..1 through the current second
      const pop = 1.6 - 0.6 * Math.min(ct / 0.25, 1);
      const al = ct < 0.12 ? ct / 0.12 : 1;
      ctx.save();
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(255,154,60,0.92)';
      try { ctx.letterSpacing = '4px'; } catch (e) {}
      ctx.font = '700 ' + fitPx('SPEEDING UP', '700', 14, ringChord(H * 0.24, 60), 10) + 'px Audiowide, system-ui';
      ctx.fillText('SPEEDING UP', W / 2, H * 0.24);
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
    { // stage banner: the drill announces itself from the CENTER of the bore,
      // wrapped into a narrow stack so it never spans across the traffic —
      // shown ONCE per stage and held until the next stage takes over
      const bn = TUT_BANNERS[st.card];
      if (bn && !tut.frozen) {
        const wrapB = (s, max) => {
          const out = []; let cur = '';
          for (const w of s.split(' ')) {
            if (cur && (cur + ' ' + w).length > max) { out.push(cur); cur = w; }
            else cur = cur ? cur + ' ' + w : w;
          }
          if (cur) out.push(cur);
          return out;
        };
        const al = clamp(tut.t / 0.25, 0, 1);
        const uB = Math.min(W, H), bx = W / 2;
        const tl = wrapB(bn.title, 11);
        const px1 = Math.round(uB * 0.036); // ~15% smaller than the 0.042 first cut
        const lh1 = px1 * 1.2;
        let by = H / 2 - tl.length * lh1 / 2 + lh1 / 2;
        ctx.save();
        ctx.globalAlpha = al;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
        ctx.font = '700 ' + px1 + 'px Audiowide, system-ui';
        for (const ln of tl) {
          ctx.strokeStyle = 'rgba(2,4,12,0.8)'; ctx.lineWidth = 6;
          ctx.strokeText(ln, bx, by);
          ctx.fillStyle = 'rgba(191,234,255,0.97)';
          ctx.fillText(ln, bx, by);
          by += lh1;
        }
        ctx.restore();
        ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      }
    }
    const nn = a => Math.abs(angDiff(nodes[0].angle, a)) < Math.abs(angDiff(nodes[1].angle, a)) ? nodes[0] : nodes[1];
    const ten = enemies.find(e => e.tut && !e.dead && !e.resolved);
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
      else if (ten.tut === 'volley') { // dock BOTH on the column's lane — one shot, whole column
        drawGuideArc(nodes[0], ten.angle); drawGuideArc(nodes[1], ten.angle);
        drawDockSpot(ten.angle);
      }
      else if (ten.lock !== undefined) drawGuideArc(nodes[ten.lock], ten.angle);
      // killers wear a landing signal — the drill is DODGE, the label says so
      else if (ten.type === 'frag') {
        drawKillerSignal(ten);
        drawRideLabel('STEER CLEAR!', ten, '#ffb066'); // from spawn, clears the title
      }
      else drawGuideArc(nn(ten.angle), ten.angle);
      if (st.card === 'normal' && ten.type === 'normal' && ten.lock === undefined) {
        // the tooltip tracks the trap's ANGLE from the moment it spawns, but
        // is held at a minimum radius so a dead-center (deep) enemy's label
        // never lands on the stage title holding the bore center
        drawRideLabel('INTERCEPT', ten, '#ffb0c0');
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
      drawTutText('STEER CLEAR!', gL.cx + Math.cos(lt.a) * rrL, gL.cy + Math.sin(lt.a) * rrL,
        '#ffb066', Math.round(Math.min(W, H) * 0.028));
    }
    if (st.card === 'move') { // emphasize the dials — the ghost hints which way to drag
      const A = tut.aim, TOLm = ARCFX.span * tolVis;
      for (let i = 0; i < 2; i++) {
        const d = dialCenter(i === 0 ? 'L' : 'R');
        const pr = d.r + 6 + Math.sin(time * 5) * 3;
        ctx.strokeStyle = `rgba(${NODE_COLS[i]},0.8)`;
        ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(d.x, d.y, pr, 0, TAU); ctx.stroke();
        // a gesture ghost laps THIS dial toward its target, retiring on arrival
        const tgt = A.targets && A.targets.find(t => t.node === i);
        if (tgt && Math.abs(angDiff(nodes[i].angle, tgt.a)) > TOLm)
          drawDialComet(i, Math.sign(angDiff(tgt.a, nodes[i].angle)) || 1);
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
