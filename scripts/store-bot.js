'use strict';
// ---------- THE HUMAN BOT: two thumbs on the pads, for the store video ----------
// This source runs INSIDE the game page. It plays a stage the way a person does,
// through the game's own pointer handlers — real pointerdown / pointermove /
// pointerup events on the canvas, so the dials draw the thumbs, the launch gate
// opens on a real two-thumb grip, and the run could have been recorded as a trace.
//
// TUNED AGAINST PEOPLE, NOT AGAINST TASTE (2026-09-21). The first cut moved on one clean
// minimum-jerk curve per target and Gil called it mechanical. scripts/store-study.js and a
// kinematics pass over five verified human replays off the live boards said why:
//
//                                   people            first bot
//   a 0.5 rad reach takes           0.30 s            0.18 s
//   a 2.3 rad reach takes           0.5 - 0.8 s       0.32 s
//   speed peaks inside one reach    2.4 - 11          1.0   (one perfect bell)
//   where the speed peaks           37% of the way    50%
//   small adjustments at rest       1.5 - 2.7 a s     0.4 a s
//   both thumbs at rest             23 - 36% of time  67%
//   both moving, of moving time     40 - 51%          24%
//   on target before it lands       0.4 - 0.65 s mid; a quarter under 0.25 s; a tenth under 0.1 s
//                                                     0.87 s mid; 1% under 0.1 s
//   aim, off centre                 0.06 - 0.10 rad   0.026 rad
//   PERFECT share                   56 - 71%          94%
//
// So, all of it tunable in CFG:
//   · a reach is SLOW and its duration is spread (Fitts, log-normal), with the speed peaking
//     early and a long homing tail — and the speed WOBBLES along the way, because a thumb on
//     glass is a run of small pushes, never one bell;
//   · the first push usually lands SHORT, sometimes long, and a correction follows;
//   · aim is loose, and a thumb waiting on a target keeps FIDGETING toward it;
//   · the start is not always prompt: some reaches wait and arrive at the LAST MOMENT, some
//     dawdle, some go at once and sit early;
//   · the hands are COUPLED: when one thumb goes, the other often goes with it;
//   · an idle thumb does not freeze: it drifts toward what is coming next;
//   · it still sees late, routes AROUND a dead zone, taps a pulse orb the way a thumb does
//     (lift, tap the core, replant), and ONCE, at CFG.mistakeAt, notices a body too late.
//
// It never writes a game variable. It reads the world and moves two thumbs.
module.exports = `(function () {
  const CFG = Object.assign({
    seed: 7,               // a player who drops exactly one body on stage 23 (seeds 11, 23 and 31 do too)
    seeZ: 1.70,            // deeper than this a body is a speck nobody acts on
    land: [0.70, 1.05],    // s after start: when each thumb lands on its pad
    react: [0.15, 0.26],   // s: a target that is new to the eye
    reactNext: [0.02, 0.09], // s: a target that was already in view when the last one died
    fittsA: 0.05, fittsB: 0.165, fittsW: 0.22,   // fitted to the human medians: 0.5 rad 0.30 s, 1.2 rad 0.46 s, 2.3 rad 0.60 s
    durSigma: 0.28,        // log-normal spread of a reach's duration
    skew: 0.72,            // < 1 puts the speed peak early (people: 37% of the way)
    wobble: 0.55, wobbleRate: 0.30,   // how hard, and how fast, the speed wavers inside a reach
    shortMean: -0.055, shortSigma: 0.075, // the first push, as a share of the reach: mostly short, sometimes long
    fixGap: [0.04, 0.11], fixDur: [0.09, 0.18], fixMin: 0.045, // the correction after it
    rushSpeed: 12,         // rad/s: the fastest a hurried thumb sweeps the pad
    aimSigma: 0.11, aimMax: 0.24,     // where the first settle lands, off centre
    fidget: [0.22, 0.65], fidgetKeep: 0.55, fidgetSigma: 0.04, // at rest on a target: every so often, a nudge closer
    lateP: 0.24, lateLead: [0.03, 0.13],  // some reaches start late and arrive with this much to spare
    dawdleP: 0.30, dawdle: [0.10, 0.45],  // some wait a beat first, when there is time
    coupleP: 0.70,         // one thumb going pulls the other's pending reach along with it
    idle: [0.35, 0.8], idleReach: 0.7, idleWander: 0.22, // an idle thumb drifts toward what is next
    tremor: 0.006,
    padR: 0.80,            // where on the pad the thumb rides, as a fraction of its radius
    zoneMargin: 0.16,      // rad kept clear of a dead zone's edge
    pulseCrowd: 4,         // live bodies in view that make a charged orb worth a tap
    mistakeAt: 26,         // levelT (s): the first suitable body after this is seen too late
    mistakeLateZ: 0.10,    // …it is noticed only this far from the ring
  }, window.__BOT_CFG || {});

  let rs = CFG.seed >>> 0;
  const rnd = () => { rs = (rs + 0x6D2B79F5) >>> 0; let t = rs; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const rr = (a, b) => a + (b - a) * rnd();
  const gauss = () => { let u = 0; for (let i = 0; i < 4; i++) u += rnd(); return (u - 2) / 0.5774; };   // ~N(0,1)
  const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
  const cv = document.getElementById('game');
  cv.setPointerCapture = () => {}; cv.releasePointerCapture = () => {};   // a synthetic pointer id has no capture to take

  const T = [0, 1].map(i => ({ i, id: 21 + i, side: i ? 'R' : 'L', down: false, th: 0, rad: CFG.padR, move: null, queue: [],
    goal: null, pend: null, busyUntil: 0, tr: 0, seq: null, flinch: 0, n: 0, fidgetAt: 0, idleAt: 0, style: '' }));
  const seen = new Map();      // body -> { at, em, err, late }
  const log = [];
  let clock = 0, started = false, mistake = null, mistakeDone = false, next = [null, null], last = { misses: 0, zaps: 0, vfx: 0, fried: [0, 0] };

  function fire(type, th, x, y) {
    cv.dispatchEvent(new PointerEvent(type, { pointerId: th.id, pointerType: 'touch', isPrimary: th.i === 0, clientX: x, clientY: y, bubbles: true, cancelable: true }));
  }
  function padXY(th, ang, rad) { const d = dialCenter(th.side); return { x: d.x + Math.cos(ang) * d.r * rad, y: d.y + Math.sin(ang) * d.r * rad }; }

  // ---- what is in the lane, as a person would list it ----
  function threats() {
    const g = geo(), out = [];
    for (const e of enemies) {
      if (e.dead || e.resolved || e.failed || e.z <= g.hitZ) continue;
      if (e.type === 'strip') continue;
      if (e.type === 'line' && !e.lineLead && e.partner && e.partner.lineLead) continue;   // the lead speaks for the pair
      if (e.z > CFG.seeZ) continue;
      out.push({ e, t: (e.z - g.hitZ) / (trafficSpeed * (e.speedMul || 1)),
        need: e.type === 'heavy' ? 'both' : (e.type === 'line' && e.partner) ? 'pair' : e.lock !== undefined ? e.lock : 'any' });
    }
    const L = LV || LEVELS[levelIdx];
    for (const p of pickups) {
      if (p.dead || p.done || p.z <= g.hitZ || p.z > CFG.seeZ) continue;
      out.push({ e: p, t: (p.z - g.hitZ) / (L.speed * 0.9), need: 'any', pickup: true });
    }
    return out.sort((a, b) => a.t - b.t);
  }
  // dead zones, from the first dash of the telegraph: a person routes around the warning
  function zones() {
    return latches.map(lt => ({ a: lt.a, half: lt.span0 + CFG.zoneMargin, core: lt.span0 + 0.05 }));
  }
  const inZone = (a, zs) => zs.some(z => Math.abs(angDiff(a, z.a)) < z.half);
  function crosses(from, delta, zs) {
    const n = Math.max(2, Math.ceil(Math.abs(delta) / 0.05));
    // the MARGIN is for where a thumb comes to rest. A path is only barred by the zone
    // itself, and a carriage that is already inside one may always leave it outward.
    for (const z of zs) {
      const startIn = Math.abs(angDiff(from, z.a)) < z.core;
      for (let k = 1; k <= n; k++) {
        const off = angDiff(from + delta * k / n, z.a);
        if (Math.abs(off) < z.core && !(startIn && Math.sign(off) === Math.sign(delta))) return true;
      }
    }
    return false;
  }
  // the way round: the short arc unless a dead zone sits on it
  function route(from, to, zs) {
    const d = angDiff(to, from);
    if (!crosses(from, d, zs)) return d;
    const long = d > 0 ? d - TAU : d + TAU;
    if (!crosses(from, long, zs)) return long;
    return null;
  }

  // THE PLAN, as a player holds it: what is KEYED to a thumb is fixed first (a lock,
  // purple armor, a barrier's two ends), and every plain body then goes to the thumb
  // that can reach it without dropping one of those. A plain body changes hands
  // while it is still far off; close in, the thumb that has it keeps it.
  function plan() {
    const zs = zones(), th = threats(), g = geo();
    const C = [[], []];                       // per thumb: { e, a, t }
    const reach = D => 0.10 + D / 9;          // s a thumb needs between two bearings
    const clash = (i, a, t) => C[i].some(c => Math.abs(c.t - t) < reach(Math.abs(angDiff(c.a, a))));
    const note = x => {
      let s = seen.get(x.e);
      if (!s) {
        const er = () => Math.max(-CFG.aimMax, Math.min(CFG.aimMax, gauss() * CFG.aimSigma));
        s = { at: clock, em: -1, err: er(), err2: er() };
        // THE ONE MISTAKE: a plain or keyed single body, far from the thumb that would take it
        if (!mistake && !mistakeDone && levelT >= CFG.mistakeAt && !x.pickup && x.need !== 'both' && x.need !== 'pair' && x.e.z > 1.0) {
          const em = x.need === 'any' ? (Math.abs(angDiff(x.e.angle, nodes[0].angle)) > Math.abs(angDiff(x.e.angle, nodes[1].angle)) ? 0 : 1) : x.need;   // the FARTHER thumb
          if (Math.abs(angDiff(x.e.angle, nodes[em].angle)) > 1.6) { s.late = true; s.em = em; mistake = x.e; log.push({ t: clock, levelT, ev: 'mistake-armed', em }); }
        }
        seen.set(x.e, s);
      }
      return s;
    };
    const live = [];
    for (const x of th) {
      const s = note(x);
      if (s.late && x.e.z > g.hitZ + CFG.mistakeLateZ) continue;        // not noticed yet
      if (x.need !== 'pair' && inZone(x.e.angle, zs)) continue;          // nobody can stand there
      live.push([x, s]);
    }
    for (const [x, s] of live) {
      const a = x.e.angle;
      if (x.need === 'both') { C[0].push({ e: x.e, a0: a, a: a + s.err, t: x.t }); C[1].push({ e: x.e, a0: a, a: a + s.err2, t: x.t }); }
      else if (x.need === 'pair') {
        const pa = x.e.partner.angle;
        if (s.em < 0) s.em = (Math.abs(angDiff(a, nodes[0].angle)) + Math.abs(angDiff(pa, nodes[1].angle)) <= Math.abs(angDiff(a, nodes[1].angle)) + Math.abs(angDiff(pa, nodes[0].angle))) ? 0 : 1;
        C[s.em].push({ e: x.e, a0: a, a: a + s.err, t: x.t }); C[1 - s.em].push({ e: x.e, a0: pa, a: pa + s.err2, t: x.t });
      } else if (x.need !== 'any') { s.em = x.need; C[s.em].push({ e: x.e, a0: a, a: a + s.err, t: x.t, rush: !s.late }); }
    }
    for (const [x, s] of live) {
      if (x.need !== 'any') continue;
      const a = x.e.angle;
      const cost = i => {
        const prev = C[i].filter(c => c.t <= x.t).sort((p, q) => q.t - p.t)[0];
        return Math.abs(angDiff(a, prev ? prev.a : nodes[i].angle)) + (clash(i, a, x.t) ? 6 : 0) + (nodes[i].deadT > x.t ? 9 : 0);
      };
      const best = cost(0) <= cost(1) ? 0 : 1;
      if (s.em < 0) s.em = best;
      else if (!s.late && s.em !== best && cost(s.em) - cost(best) > 3 && (x.t > 0.45 || nodes[s.em].deadT > x.t)) s.em = best;   // hands it over
      C[s.em].push({ e: x.e, a0: a, a: a + s.err, t: x.t, rush: !s.late });
    }
    const want = [0, 1].map(i => C[i].sort((p, q) => p.t - q.t)[0] || null);
    next = [0, 1].map(i => C[i][1] || null);

    // nothing to answer: a free thumb rides a gold ribbon that is at the ring
    for (const i of [0, 1]) {
      if (want[i]) continue;
      const g = geo();
      const st = enemies.find(e => e.type === 'strip' && !e.dead && !e.failed && e.z < g.hitZ + 0.45 && e.z + e.len > g.hitZ && (!e.tracing || e.traceNode === i) && !(want[1 - i] && want[1 - i].e === e));
      if (st) { const a = stripAngle(st, Math.max(0, g.hitZ - st.z)); if (!inZone(a, zs)) want[i] = { e: st, a, t: 0, track: true }; }
    }
    return { want, zs };
  }

  const fittsT = D => CFG.fittsA + CFG.fittsB * Math.log2(D / CFG.fittsW + 1);
  // ONE PUSH of a thumb: d radians over dur seconds. soft = an unhurried push, which wavers.
  const push = (th, d, dur, wait, soft) => ({ from: null, d, dur, u: 0, wait: wait || 0, soft });
  function startMove(th, to, zs, avail, dur0, flick) {
    // routed on the CARRIAGE's angle: the knob mirrors the thumb's deltas, and it is the
    // carriage that a dead zone fries. The thumb then travels the same arc.
    const na = nodes[th.i].angle;
    const d = route(na, to, zs);
    if (d === null) return false;
    const D = Math.abs(d);
    if (D < 0.012) return true;
    let dur = dur0 || fittsT(D) * Math.exp(gauss() * CFG.durSigma);
    // UNDER TIME PRESSURE A THUMB HURRIES: the reach is squeezed into the time there is,
    // down to the fastest sweep a thumb makes. A hurried reach is one clean throw.
    let rushed = !!flick;
    if (avail !== undefined && dur > avail * 0.8) { dur = Math.max(D / CFG.rushSpeed, avail * 0.8, 0.07); rushed = true; }
    // THE FIRST PUSH MISSES THE MARK, mostly short. The correction is a second, smaller push.
    let first = d, fix = 0;
    if (!rushed && D > 0.25) {
      const off = Math.max(-0.22, Math.min(0.16, CFG.shortMean + gauss() * CFG.shortSigma)) * D;
      if (!crosses(na, d + Math.sign(d) * off, zs)) { first = d + Math.sign(d) * off; fix = d - first; }
    }
    th.queue = [push(th, first, dur, 0, !rushed)];
    if (Math.abs(fix) > CFG.fixMin) th.queue.push(push(th, fix, rr(CFG.fixDur[0], CFG.fixDur[1]), rr(CFG.fixGap[0], CFG.fixGap[1]), true));
    th.move = null;
    return true;
  }

  function stepThumb(th, w, zs, dt) {
    // a pulse tap in progress owns the thumb
    if (th.seq) {
      const s = th.seq, d = dialCenter(th.side);
      if (s.k === 0 && clock >= s.at) { const p = padXY(th, th.th, th.rad); fire('pointerup', th, p.x, p.y); th.down = false; s.k = 1; s.at = clock + rr(0.10, 0.15); }
      else if (s.k === 1 && clock >= s.at) { s.px = d.x + rr(-0.12, 0.12) * d.r; s.py = d.y + rr(-0.12, 0.12) * d.r; fire('pointerdown', th, s.px, s.py); s.k = 2; s.at = clock + rr(0.05, 0.09); log.push({ t: clock, levelT, ev: 'pulse-tap', em: th.i }); }
      else if (s.k === 2 && clock >= s.at) { fire('pointerup', th, s.px, s.py); s.k = 3; s.at = clock + rr(0.11, 0.17); }
      else if (s.k === 3 && clock >= s.at) { th.th = nodes[th.i].angle; const p = padXY(th, th.th, th.rad); fire('pointerdown', th, p.x, p.y); th.down = true; th.seq = null; th.goal = null; th.pend = null; th.queue = []; th.move = null; }
      return;
    }
    if (!th.down) return;
    th.n += (gauss() - th.n) * CFG.wobbleRate;                 // the waver every push rides on
    const busy = !!th.move || (th.queue && th.queue.length > 0);
    // a new goal is noticed, then acted on — promptly, after a beat, or at the last moment
    const ge = w ? w.e : null;
    if (ge !== (th.goal ? th.goal.e : null) && ge !== (th.pend ? th.pend.e : null)) {
      if (!w) { th.pend = null; th.goal = null; }
      else {
        const s = seen.get(w.e), known = s && clock - s.at > 0.45 && !s.late;
        const react = (known ? rr(CFG.reactNext[0], CFG.reactNext[1]) : rr(CFG.react[0], CFG.react[1])) + th.flinch;
        th.flinch = 0;
        const D = Math.abs(angDiff(w.a, nodes[th.i].angle));
        const dur = fittsT(Math.max(D, 0.05)) * Math.exp(gauss() * CFG.durSigma);
        let at = clock + react, flick = 0;
        const slack = w.t - react - dur;                        // time to spare if it went at once
        if (s && s.late) at = clock + rr(0.05, 0.08);
        else if (!w.track && slack > 0.30 && rnd() < CFG.lateP) {
          // THE LAST-MOMENT FLICK: the thumb stays where it is, then goes in one fast throw
          flick = Math.max(D / CFG.rushSpeed * 1.35, 0.11);
          at = clock + w.t - flick - rr(CFG.lateLead[0], CFG.lateLead[1]); th.style = 'late';
        }
        else if (!w.track && slack > 0.45 && rnd() < CFG.dawdleP) { at = clock + react + Math.min(rr(CFG.dawdle[0], CFG.dawdle[1]), slack - 0.3); th.style = 'dawdle'; }
        else th.style = 'prompt';
        th.pend = { e: w.e, at, a: w.a, a0: w.a0 === undefined ? w.a : w.a0, track: w.track, dur: flick || dur, flick: flick > 0 };
      }
    }
    // the lane can move under a late start: never let a pending reach run out of time
    if (th.pend && th.pend.e && w && w.e === th.pend.e && w.rush !== false && th.pend.at > clock && w.t - (th.pend.at - clock) < th.pend.dur + 0.06) th.pend.at = clock;
    if (th.pend && clock >= th.pend.at && !busy) {
      const live = th.pend.e && w && w.e === th.pend.e;
      if (startMove(th, th.pend.a, zs, live && w.rush !== false ? w.t : undefined, th.pend.dur, th.pend.flick)) {
        th.goal = th.pend; th.pend = null; th.fidgetAt = 0;
        // THE HANDS ARE COUPLED: the other thumb's waiting reach often goes now too
        const o = T[1 - th.i];
        if (o.pend && o.pend.at > clock && o.pend.at - clock < 0.7 && rnd() < CFG.coupleP) o.pend.at = clock + rr(0, 0.06);
      }
    }
    if (!th.move && th.queue && th.queue.length) { th.move = th.queue.shift(); th.move.from = null; }
    if (th.move) {
      const m = th.move;
      if (m.wait > 0) m.wait -= dt;
      else {
        if (m.from === null) m.from = th.th;
        // time itself wavers inside an unhurried push, so the speed has several peaks and
        // never one clean bell — but the push still ends where it was sent
        const rate = m.soft ? Math.max(0.25, Math.min(1.9, 1 + CFG.wobble * th.n)) : 1;
        m.u = Math.min(1, m.u + dt / m.dur * rate);
        const v = Math.pow(m.u, CFG.skew), mj = v * v * v * (10 - 15 * v + 6 * v * v);
        th.th = m.from + m.d * mj;
        if (m.u >= 1) th.move = null;
      }
    } else if (th.goal && th.goal.track && w && w.e === th.goal.e) {
      // a ribbon meanders: follow it with a short lag, never a snap
      const na = nodes[th.i].angle, d = angDiff(w.a, na); if (!crosses(na, d, zs)) th.th += d * Math.min(1, dt / 0.07);
    } else {
      th.tr += (gauss() * CFG.tremor - th.tr) * 0.25; th.th += th.tr * 0.5;
      const na = nodes[th.i].angle;
      // a dead zone grows a telegraph under a resting thumb: step out of it
      if (inZone(na, zs) && !th.pend) { const z = zs.find(q => Math.abs(angDiff(na, q.a)) < q.half); const side = angDiff(na, z.a) >= 0 ? 1 : -1; th.pend = { e: null, at: clock + rr(0.18, 0.28), a: z.a + side * (z.half + 0.12), dur: 0 }; }
      else if (th.goal && th.goal.e && w && w.e === th.goal.e && !th.goal.track) {
        // WAITING ON A TARGET, a thumb keeps nudging toward it: each nudge keeps part of the
        // error it had and adds a little of its own
        if (!th.fidgetAt) th.fidgetAt = clock + rr(CFG.fidget[0], CFG.fidget[1]);
        if (clock >= th.fidgetAt && w.t > 0.14) {
          const err = angDiff(na, th.goal.a0) * CFG.fidgetKeep + gauss() * CFG.fidgetSigma;
          const d = angDiff(th.goal.a0 + err, na);
          if (Math.abs(d) > 0.008 && !crosses(na, d, zs)) th.queue = [push(th, d, rr(0.06, 0.13), 0, true)];
          th.fidgetAt = clock + rr(CFG.fidget[0], CFG.fidget[1]);
        }
      } else if (!w && !th.pend) {
        // NOTHING TO ANSWER: an idle thumb drifts toward what is coming next, or just wanders
        if (!th.idleAt) th.idleAt = clock + rr(CFG.idle[0], CFG.idle[1]);
        if (clock >= th.idleAt) {
          const nx = next[th.i];
          const d = nx ? angDiff(nx.a, na) * CFG.idleReach * rr(0.6, 1) : gauss() * CFG.idleWander;
          if (Math.abs(d) > 0.03 && !crosses(na, d, zs)) th.queue = [push(th, d, fittsT(Math.abs(d)) * rr(1.2, 1.9), 0, true)];
          th.idleAt = clock + rr(CFG.idle[0], CFG.idle[1]);
        }
      }
    }
    const p = padXY(th, th.th, th.rad);
    fire('pointermove', th, p.x, p.y);
  }

  function watch() {
    // the body meant to be missed died some other way (a blast took it): pick another
    if (mistake && mistake.dead && !mistakeDone) { mistake = null; log.push({ t: clock, levelT, ev: 'mistake-rearmed' }); }
    if (mistake && mistake.resolved && !mistake.dead) mistakeDone = true;
    // ONE MISTAKE IS THE BRIEF. A loose player can drop a body on their own; when that
    // happens first, it IS the mistake, and the planned one is stood down.
    if (misses > last.misses && !mistakeDone) { mistakeDone = true; if (mistake) { const ms = seen.get(mistake); if (ms) ms.late = false; } mistake = mistake || {}; log.push({ t: clock, levelT, ev: 'mistake-spent' }); }
    if (misses > last.misses) { const bad = enemies.filter(e => e.resolved && !e.dead && !e._botSaw); bad.forEach(e => { e._botSaw = 1; }); const s0 = bad[0] && seen.get(bad[0]);
      log.push({ t: +clock.toFixed(2), levelT: +levelT.toFixed(2), ev: 'miss', n: misses, who: bad.map(e => e.type + ':' + e.lock + '@' + e.angle.toFixed(2) + (e.partner ? '/' + e.partner.angle.toFixed(2) : '')), em: s0 ? s0.em : null, late: !!(s0 && s0.late), sawAgo: s0 ? +(clock - s0.at).toFixed(2) : null, nodes: [nodes[0].angle, nodes[1].angle].map(a => +wrap(a).toFixed(2)), dead: [nodes[0].deadT > 0, nodes[1].deadT > 0], goals: T.map(t => t.goal && t.goal.e ? (t.goal.e.type || 'pickup') + '@' + (+t.goal.a).toFixed(2) : null), pend: T.map(t => !!t.pend), moving: T.map(t => !!t.move), style: T.map(t => t.style), zones: latches.map(l => l.a.toFixed(2) + '±' + l.span0.toFixed(2)) }); for (const th of T) th.flinch = rr(0.12, 0.22); }
    if (volleyFX.length > last.vfx) log.push({ t: clock, levelT, ev: 'volley-blast', kills: volleyFX[volleyFX.length - 1].kills });
    for (const i of [0, 1]) { if (nodes[i].deadT > 0 && !last.fried[i]) log.push({ t: clock, levelT, ev: 'fried', em: i }); last.fried[i] = nodes[i].deadT > 0 ? 1 : 0; }
    last.misses = misses; last.zaps = zaps; last.vfx = volleyFX.length;
  }

  return {
    log, cfg: CFG,
    // one call per 1/60 s frame, BEFORE the frame is cranked
    step(dt) {
      if (state !== S.PLAY && state !== S.INFO) return;
      clock += dt;
      for (const th of T) {
        if (!th.down && !th.seq && clock >= CFG.land[th.i] && !th.landed) {
          th.landed = true; th.th = nodes[th.i].angle + rr(-0.05, 0.05);
          const p = padXY(th, th.th, th.rad); fire('pointerdown', th, p.x, p.y); th.down = true;
          log.push({ t: clock, levelT, ev: 'thumb-down', em: th.i });
        }
      }
      if (preLaunch() || introT < INTRO_DUR) { for (const th of T) if (th.down) { const p = padXY(th, th.th, th.rad); fire('pointermove', th, p.x, p.y); } return; }
      const { want, zs } = plan();
      // a charged orb, a crowded lane, and a thumb with a moment to spare
      for (const th of T) {
        if (th.seq || !th.down || boss) continue;
        const crowd = enemies.filter(e => !e.dead && !e.resolved && !e.failed && e.type !== 'strip' && e.z < 1.25).length;
        if (pulseCharge[th.i] >= PULSE_MAX && !(nodes[th.i].deadT > 0) && crowd >= CFG.pulseCrowd && (!want[th.i] || want[th.i].t > 1.2) && !th.move && !th.queue.length && clock > th.busyUntil) {
          th.seq = { k: 0, at: clock + rr(0.04, 0.10) }; th.busyUntil = clock + 3;
        }
      }
      for (const th of T) stepThumb(th, want[th.i], zs, dt);
      watch();
    },
    lift() { for (const th of T) if (th.down) { const p = padXY(th, th.th, th.rad); fire('pointerup', th, p.x, p.y); th.down = false; } }
  };
})()`;
