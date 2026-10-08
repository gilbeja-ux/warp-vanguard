#!/usr/bin/env node
'use strict';
// ---------- COURSE FLY: a perfect pupil flies the qualification in the REAL game ----------
// Boots a fresh save in headless Chrome, taps through the enlistment as fast as the
// gates allow, lands both thumbs through the touch path, then plays every drill with
// a bot that answers each hazard the way the lesson asks. It prints the enlistment
// time, the launch-to-QUALIFIED game time, the number of disc stops and retries, and
// a timeline of every stage and disc; one screenshot per drill lands in
// smoke-shots/course/ (phone viewport: rotate the PNGs 90° before judging).
//
// Written 2026-10-08 to measure the course before the cut in docs/TUTORIAL-PLAN.md
// (F-017), and the instrument for the after: 68.7 s, 10 stops, 0 retries on that day.
//
//   node scripts/course-fly.js                     # against the dev server on 8000
//   node scripts/course-fly.js --origin=http://127.0.0.1:8020 --headed --keep
//
// It does not own a server: it needs the game served from src/ (npm run dev, port
// 8000 in THE PORT MAP), and it blocks the leaderboard host so a fly never mints an
// anonymous identity on the live project.
const fs = require('fs');
const path = require('path');
const { sleep, launchChrome, killChrome, waitForPort, openPage } = require('./lib/cdp.js');
const ARG = {};
for (const a of process.argv.slice(2)) { const m = /^--([^=]+)(?:=(.*))?$/.exec(a); if (m) ARG[m[1]] = m[2] === undefined ? true : m[2]; }
const ORIGIN = ARG.origin || 'http://127.0.0.1:8000';
const OUT = path.join(__dirname, '..', 'smoke-shots', 'course'); fs.mkdirSync(OUT, { recursive: true });
const CDP_PORT = parseInt(ARG.cdp || '9342', 10);
const VIEW = [390, 844];
const G = expr => `(() => { try { return (${expr}); } catch (e) { return '__err:' + (e && e.message || e); } })()`;

const BOT = `window.__bot = { discs: 0, retries: 0, lastAgain: null, log: [], lastKey: null, t0: null };
window.__botTick = function () {
  const B = window.__bot;
  if (state === S.INFO) {
    if (!infoOutAt && time - infoShownAt > 0.6) { infoOutAt = time; B.discs++; B.log.push([+time.toFixed(1), 'disc ' + infoCard]); }
    return;
  }
  if (state !== S.PLAY || !tut) return;
  if (B.t0 === null) B.t0 = time;
  const st = tutStage();
  const key = st.card + ':' + (tut.spawned || '-') + ':' + (tut.aim && tut.aim.idx);
  if (key !== B.lastKey) { B.lastKey = key; B.log.push([+time.toFixed(1), 'stage ' + key]); }
  if (tut.again && tut.again !== B.lastAgain) { B.lastAgain = tut.again; B.retries++; B.log.push([+time.toFixed(1), 'RETRY ' + tut.again]); }
  if (st.card === 'move') { if (tut.aim.targets) for (const t of tut.aim.targets) nodes[t.node].slew = t.a; return; }
  if (tut.frozen) { const i = pulseCharge[0] >= PULSE_MAX ? 0 : 1; firePulse(i); return; }
  const live = enemies.filter(e => !e.dead && !e.resolved && !e.failed && e.type !== 'frag');
  const strip = live.find(e => e.type === 'strip');
  const ens = live.filter(e => e.type !== 'strip').sort((a, b) => a.z - b.z);
  const pk = pickups.find(p => !p.done);
  const g = geo();
  if (latches.length && !ens.length) { // the dead zone: park both well away
    const a = latches[0].a + Math.PI; nodes[0].slew = a - 0.4; nodes[1].slew = a + 0.4; return;
  }
  const near = ens[0];
  if (near) {
    if (near.type === 'line' && near.partner) { nodes[0].slew = near.angle; nodes[1].slew = near.partner.angle; return; }
    if (near.type === 'heavy') { nodes[0].slew = near.angle; nodes[1].slew = near.angle; return; }
    if (near.lock === 0 || near.lock === 1) { nodes[near.lock].slew = near.angle; return; }
    // plain: the nearer node takes it, the other waits on the next one
    const i = Math.abs(angDiff(nodes[0].angle, near.angle)) < Math.abs(angDiff(nodes[1].angle, near.angle)) ? 0 : 1;
    nodes[i].slew = near.angle;
    const nx = ens.find(e => e !== near && e.lock === undefined && e.type === 'normal');
    if (nx) nodes[1 - i].slew = nx.angle;
    return;
  }
  if (pk) { nodes[0].slew = pk.angle; return; }
  if (strip) { const kX = clamp(g.hitZ - strip.z, 0, strip.len); nodes[0].slew = stripAngle(strip, kX); return; }
}; 1`;

async function main() {
  const chrome = launchChrome(CDP_PORT, { headless: !ARG.headed, extraArgs: [`--window-size=${VIEW[0]},${VIEW[1]}`] });
  let cdp;
  const log = [];
  try {
    await waitForPort(CDP_PORT);
    ({ cdp } = await openPage(CDP_PORT));
    cdp.on('Runtime.exceptionThrown', p => { const d = p.exceptionDetails || {}; log.push('EXC ' + ((d.exception && d.exception.description) || d.text)); });
    await cdp.send('Network.enable');
    await cdp.send('Network.setBlockedURLs', { urls: ['*supabase.co*'] });
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: VIEW[0], height: VIEW[1], deviceScaleFactor: 1, mobile: true });
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true });
    const until = async (expr, ms, every = 100) => { const t0 = Date.now(); for (;;) { let v = null; try { v = await cdp.eval(G(expr)); } catch (e) {} if (v === true) return true; if (Date.now() - t0 > ms) return false; await sleep(every); } };
    const shot = async name => { const r = await cdp.send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(OUT, `${name}.png`), Buffer.from(r.data, 'base64')); };
    const ev = async e => cdp.eval(G(e));
    const touchAt = async (points, type) => {
      const rot = await ev('ROT === true'); const iw = await ev('window.innerWidth');
      const touchPoints = points.map((p, i) => rot === true ? { x: iw - p.y, y: p.x, id: i } : { x: p.x, y: p.y, id: i });
      await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : touchPoints });
    };
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: `try { localStorage.clear(); } catch (e) {}` });
    await cdp.send('Page.navigate', { url: ORIGIN + '/index.html' });
    if (!await until("typeof frame === 'function' && typeof startLevel === 'function'", 20000, 250)) throw new Error('never booted');
    if (!await until('s3BreachReady() === true', 35000, 250)) throw new Error('bake never finished');
    await ev('(splashEnd(true), 1)');
    if (!await until('state === S.ENLIST', 4000)) throw new Error('no enlistment');
    const tE0 = Date.now();
    for (;;) {
      const o = JSON.parse(await ev('JSON.stringify({ e: !!enlist, out: enlist ? enlist.out : null, state })'));
      if (!o.e && o.state === 1) break;
      if (o.e && !o.out) await ev('(enlistTap(), 1)');
      await sleep(300);
      if (Date.now() - tE0 > 60000) throw new Error('enlistment never ended');
    }
    console.log('enlistment, tapped as fast as allowed: ' + ((Date.now() - tE0) / 1000).toFixed(1) + ' s');
    const pads = JSON.parse(await ev("JSON.stringify([dialCenter('L'), dialCenter('R')])"));
    await touchAt([pads[0]], 'touchStart'); await sleep(200);
    await touchAt(pads, 'touchStart');
    if (!await until('preLaunch() === false', 4000)) throw new Error('no launch');
    await touchAt([], 'touchEnd');
    const tLaunch = await ev('time');
    await cdp.eval(BOT);
    let lastShotKey = '';
    const tW0 = Date.now();
    for (;;) {
      const s = JSON.parse(await ev('(window.__botTick(), JSON.stringify({ done: progress.tutorialDone, state, key: __bot.lastKey, card: tut && tutStage().card, spawned: tut && tut.spawned, time }))'));
      if (s.done) break;
      const sk = s.state === 4 ? 'disc' : (s.card + '-' + s.spawned);
      if (sk !== lastShotKey) { lastShotKey = sk; await sleep(500); await shot(String(Math.round(s.time - tLaunch)).padStart(3, '0') + '-' + sk); }
      if (Date.now() - tW0 > 300000) { console.log('TIMEOUT at ' + JSON.stringify(s)); break; }
      await sleep(100);
    }
    const tEnd = await ev('time');
    const B = JSON.parse(await ev('JSON.stringify(__bot)'));
    console.log('course, launch to QUALIFIED: ' + (tEnd - tLaunch).toFixed(1) + ' s of game time');
    console.log('disc stops: ' + B.discs + '   retries: ' + B.retries);
    for (const [t, m] of B.log) console.log('  ' + (t - tLaunch).toFixed(1).padStart(6) + '  ' + m);
    if (log.length) console.log('errors: ' + JSON.stringify(log));
  } finally {
    if (cdp && !ARG.keep) cdp.close();
    if (!ARG.keep) await killChrome(chrome);
  }
}
main().catch(e => { console.error('FAIL', e); process.exit(1); });
