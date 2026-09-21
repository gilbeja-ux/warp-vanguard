#!/usr/bin/env node
'use strict';
// ---------- STORE STUDY: how early is a thumb on its target? ----------
// Replays a stored trace (a human's, or the bot's own from --trace) through the REAL
// sim in the real page, and logs every body that reaches the ring: which emitter
// answered it, how long that emitter had been sitting inside the hit window when the
// body arrived (the LEAD), and how far off centre it was (the AIM). This is the
// instrument the human bot is tuned against — scripts/store-bot.js quotes its numbers.
//
//   node scripts/store-study.js trace.json [trace2.json …]
const fs = require('fs');
const { startServer, openGame, bootToMenu, G, killChrome } = require('./store-shoot.js');

const HOOK = `(function (pkg) {
  window.__ev = [];
  const _simStep = simStep;
  simStep = function () {
    if (!tracePlay || simMuted) return _simStep();
    const g = geo(), before = enemies.filter(e => !e.dead && !e.resolved && e.type !== 'strip' && !(e.type === 'line' && !e.lineLead && e.partner && e.partner.lineLead));
    const i = tracePlay.i;
    const r = _simStep();
    for (const e of before) {
      const ring = e.z <= g.hitZ + 0.03;
      if (e.dead && ring) __ev.push({ i, k: 'zap', type: e.type, lock: e.lock === undefined ? -1 : e.lock, a: e.angle, pa: e.partner ? e.partner.angle : null });
      else if (e.resolved && !e.dead) __ev.push({ i, k: 'miss', type: e.type, lock: e.lock === undefined ? -1 : e.lock, a: e.angle, pa: e.partner ? e.partner.angle : null });
    }
    return r;
  };
  const ok = launchReplay(pkg, { name: 'STUDY' });
  return ok ? pkg.frames.length : -1;
})`;

const q = (a, p) => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : NaN; };
const ad = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));

(async () => {
  const files = process.argv.slice(2).filter(a => !a.startsWith('--'));
  const srv = await startServer(); const origin = 'http://127.0.0.1:' + srv.address().port;
  for (const file of files) {
    const pkg = JSON.parse(fs.readFileSync(file, 'utf8'));
    const page = await openGame('play'); const { cdp, chrome } = page;
    try {
      await bootToMenu(page, origin);
      // the package goes over in slices: one big websocket message never arrives
      const s = JSON.stringify(pkg); await cdp.eval('window.__pk = ""; 1');
      for (let i = 0; i < s.length; i += 400000) await cdp.eval('__pk += ' + JSON.stringify(s.slice(i, i + 400000)) + '; 1');
      const n = await cdp.eval(G(`(${HOOK})(JSON.parse(__pk))`));
      if (!(n > 0)) { console.log(file, 'REFUSED', n); continue; }
      for (let f = 0; f < n + 120; f += 120) await cdp.eval('__crank(120)');
      const ev = JSON.parse(await cdp.eval('JSON.stringify(__ev)'));
      const fr = pkg.frames, TOL = 0.314, A = i => [fr[i].a0, fr[i].a1];
      const leads = [], aims = [], rows = [];
      for (const e of ev.filter(x => x.k === 'zap')) {
        const i = Math.min(e.i, fr.length - 1);
        // which emitter(s) were on it, and since when
        const tg = e.type === 'line' && e.pa !== null ? [[e.a, e.pa], [e.pa, e.a]] : [[e.a, e.a]];
        for (const em of [0, 1]) {
          const mine = tg.map(t => t[em]).sort((x, y) => ad(A(i)[em], x) - ad(A(i)[em], y))[0];
          if (ad(A(i)[em], mine) >= TOL) continue;
          if (e.type === 'normal' && e.lock >= 0 && e.lock !== em) continue;
          let j = i; while (j > 0 && ad(A(j - 1)[em], mine) < TOL) j--;
          leads.push((i - j) / 60); aims.push(ad(A(i)[em], mine));
          if (e.type === 'normal' && e.lock < 0) break;   // a plain body needs one
        }
      }
      const misses = ev.filter(x => x.k === 'miss').length, zaps = ev.filter(x => x.k === 'zap').length;
      const share = (lo, hi) => (leads.filter(l => l >= lo && l < hi).length / Math.max(1, leads.length)).toFixed(2);
      console.log(`\n== ${file.split('/').pop()}  ring zaps ${zaps}  misses ${misses}`);
      console.log(`   LEAD (s on target before it lands): p10 ${q(leads, 0.1).toFixed(2)}  p25 ${q(leads, 0.25).toFixed(2)}  p50 ${q(leads, 0.5).toFixed(2)}  p75 ${q(leads, 0.75).toFixed(2)}  p90 ${q(leads, 0.9).toFixed(2)}`);
      console.log(`   last-moment (<0.10s) ${share(0, 0.1)}  late (0.10-0.25) ${share(0.1, 0.25)}  ready (0.25-0.6) ${share(0.25, 0.6)}  early (0.6-1.2) ${share(0.6, 1.2)}  camping (>1.2) ${share(1.2, 99)}`);
      console.log(`   AIM off centre (rad): p25 ${q(aims, 0.25).toFixed(3)}  p50 ${q(aims, 0.5).toFixed(3)}  p75 ${q(aims, 0.75).toFixed(3)}  p90 ${q(aims, 0.9).toFixed(3)}   perfect (<0.11) ${(aims.filter(a => a < 0.11).length / Math.max(1, aims.length)).toFixed(2)}`);
    } finally { await killChrome(chrome); }
  }
  srv.close();
})().catch(e => { console.error(e); process.exit(1); });
