#!/usr/bin/env node
'use strict';
// ---------- STORE KIN: how do two emitters actually move? ----------
// Pure arithmetic on a replay's a0/a1 columns, no sim: reach duration by size, speed peaks
// inside a reach, where the peak sits, small adjustments at rest, how often both thumbs
// move together. Run it on a human replay and on the bot's (--trace) and compare: it is
// the second instrument scripts/store-bot.js is tuned against (the first is store-study.js).
//   node scripts/store-kin.js trace.json [trace2.json …]
const fs = require('fs');
const q = (a, p) => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : NaN; };
const f2 = x => (Number.isFinite(x) ? x.toFixed(2) : '  - ');
function analyse(name, frames) {
  const A = [frames.map(f => f.a0), frames.map(f => f.a1)];
  const n = frames.length, dt = 1 / 60, TH = 0.35;           // rad/s: below this a thumb is "at rest"
  const out = { name, secs: (n * dt).toFixed(1) };
  const movesAll = [];
  let bothMoving = 0, anyMoving = 0;
  const moving = [new Uint8Array(n), new Uint8Array(n)];
  for (const i of [0, 1]) {
    const a = A[i], v = new Float64Array(n);
    for (let k = 1; k < n; k++) v[k] = (a[k] - a[k - 1]) / dt;
    // smooth speed over 3 frames for segmentation
    const sp = new Float64Array(n);
    for (let k = 1; k < n - 1; k++) sp[k] = (Math.abs(v[k - 1]) + Math.abs(v[k]) + Math.abs(v[k + 1])) / 3;
    let k = 1;
    while (k < n) {
      if (sp[k] > TH) {
        let s = k; while (k < n && sp[k] > TH) k++;
        const e = k - 1, amp = a[e] - a[s - 1], dur = (e - s + 1) * dt;
        let pk = 0, pkAt = s, path = 0, rev = 0, lastSign = 0;
        for (let j = s; j <= e; j++) { const av = Math.abs(v[j]); path += av * dt; if (av > pk) { pk = av; pkAt = j; } const sg = Math.sign(v[j]); if (sg && lastSign && sg !== lastSign && av > 0.5) rev++; if (sg) lastSign = sg; }
        // velocity peaks = submovements
        let peaks = 0; for (let j = s + 1; j < e; j++) if (Math.abs(v[j]) > Math.abs(v[j - 1]) && Math.abs(v[j]) >= Math.abs(v[j + 1]) && Math.abs(v[j]) > 1.0) peaks++;
        for (let j = s; j <= e; j++) moving[i][j] = 1;
        movesAll.push({ i, s, e, amp: Math.abs(amp), path, dur, pk, skew: (pkAt - s + 0.5) / (e - s + 1), rev, peaks: Math.max(1, peaks) });
      } else k++;
    }
  }
  for (let k = 0; k < n; k++) { const m = moving[0][k] + moving[1][k]; if (m) anyMoving++; if (m === 2) bothMoving++; }
  const big = movesAll.filter(m => m.path > 0.3), small = movesAll.filter(m => m.path <= 0.3);
  out.movesPerSec = (movesAll.length / (n * dt)).toFixed(2);
  out.bigPerSec = (big.length / (n * dt)).toFixed(2);
  out.restShare = (1 - anyMoving / n).toFixed(2);
  out.bothOfMoving = (bothMoving / Math.max(1, anyMoving)).toFixed(2);
  // onset sync: for each big move of thumb 0, the nearest big-move onset of thumb 1
  const on0 = big.filter(m => m.i === 0).map(m => m.s), on1 = big.filter(m => m.i === 1).map(m => m.s);
  const gaps = on0.map(s => Math.min(...on1.map(t => Math.abs(t - s))) * dt).filter(Number.isFinite);
  out.onsetWithin100ms = (gaps.filter(g => g <= 0.1).length / Math.max(1, gaps.length)).toFixed(2);
  const bins = [[0.3, 0.8], [0.8, 1.6], [1.6, 3.2], [3.2, 9]];
  out.bins = bins.map(([lo, hi]) => { const b = big.filter(m => m.path >= lo && m.path < hi); return `${lo}-${hi}rad n${b.length} dur ${f2(q(b.map(m => m.dur), 0.25))}/${f2(q(b.map(m => m.dur), 0.5))}/${f2(q(b.map(m => m.dur), 0.75))} pk ${f2(q(b.map(m => m.pk), 0.5))} peaks ${f2(b.reduce((s, m) => s + m.peaks, 0) / Math.max(1, b.length))} skew ${f2(q(b.map(m => m.skew), 0.5))} rev% ${f2(b.filter(m => m.rev > 0).length / Math.max(1, b.length))}`; });
  out.smallMoves = `n${small.length} (${(small.length / (n * dt)).toFixed(2)}/s) median path ${f2(q(small.map(m => m.path), 0.5))} dur ${f2(q(small.map(m => m.dur), 0.5))}`;
  out.straightness = f2(q(big.map(m => m.amp / m.path), 0.5)) + ' median, ' + f2(big.filter(m => m.amp / m.path < 0.9).length / Math.max(1, big.length)) + ' of moves bend';
  return out;
}
for (const f of process.argv.slice(2)) {
  const j = JSON.parse(fs.readFileSync(f, 'utf8')); const fr = j.frames || j;
  const o = analyse(f.split('/').pop(), fr);
  console.log(`\n== ${o.name}  ${o.secs}s  moves/s ${o.movesPerSec} (big ${o.bigPerSec})  both thumbs at rest ${o.restShare}  both-moving share of moving time ${o.bothOfMoving}  big onsets within 100ms of the other thumb ${o.onsetWithin100ms}`);
  o.bins.forEach(b => console.log('   ' + b));
  console.log('   small: ' + o.smallMoves + '   straightness: ' + o.straightness);
}
