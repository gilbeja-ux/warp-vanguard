#!/usr/bin/env node
'use strict';
// ---------- SMOKE: boot the REAL game in Chrome and fail on what it swallows ----------
// `npm test` evals the sim under a stubbed DOM: fetch always succeeds, decode
// always resolves, the splash is off, the bake gate is skipped. Every loader in
// the game swallows its own failure — a missing font, a renamed sound file, a
// screen stuck on LOADING all ship green through it (audit 2026-09-08, T-1).
//
// This is the other half: a real Chrome, the real first launch, and a walk down
// the main path — splash, bake, enlistment, menu, every disc, a briefing, a
// launch, ten seconds of play, pause, back key, and one deliberate fault to
// prove the error net. It fails on ANY uncaught exception, console.error, or
// same-origin request that does not come back 200. One screenshot per screen.
//
// It owns its server (port 8020 — never 8000/8010/8011, those are Gil's tabs)
// and its Chrome (a fresh profile, headless), and it blocks the leaderboard
// host so a smoke run never mints an anonymous identity on the live project.
// Zero dependencies: the CDP client is scripts/lib/cdp.js, shared with the bench.
//
//   npm run test:smoke                       # both viewports, ~90 s
//   node scripts/smoke.js --viewport=phone   # 390×844 only (the canvas is ROTATED: turn the PNGs before judging)
//   node scripts/smoke.js --headed --keep    # watch it, keep Chrome open at the end
//   node scripts/smoke.js --shots=/tmp/s     # where the PNGs go (default smoke-shots/, gitignored)
const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const { sleep, launchChrome, killChrome, waitForPort, openPage } = require('./lib/cdp.js');

const ARG = {};
for (const a of process.argv.slice(2)) { const m = /^--([^=]+)(?:=(.*))?$/.exec(a); if (m) ARG[m[1]] = m[2] === undefined ? true : m[2]; }
const ROOT = path.join(__dirname, '..');
let PORT = parseInt(ARG.port || '8020', 10);
const CDP_PORT = parseInt(ARG.cdp || '9333', 10);
let ORIGIN = `http://127.0.0.1:${PORT}`;
const SHOTS = path.resolve(ARG.shots || path.join(ROOT, 'smoke-shots'));
const HEADLESS = !ARG.headed;
const VIEWPORTS = { desktop: [1600, 900], phone: [390, 844] };
const WANT = ARG.viewport === 'both' || !ARG.viewport ? ['desktop', 'phone'] : [ARG.viewport];
const SAVE_KEY = 'warpVanguard.v1';
const ERROR_KEY = 'warpVanguard.lastError';
const LB_HOST = '*supabase.co*';
const PLAY_SEC = parseFloat(ARG.play || '10');

if ([8000, 8010, 8011, 8012].includes(PORT)) { console.error('smoke must not sit on a lab port'); process.exit(2); }

// ---------- own server, PROVEN to be its own ----------
// Found on the first run, 2026-09-08: a dev server from a week-old worktree was
// still sitting on 8020, the spawn lost the bind, the health check passed against
// the stranger, and the suite walked a stale checkout — where half the globals
// under test did not exist yet. So: take a FREE port, and after the spawn read
// index.html back and compare it byte for byte with the one on disk.
const get = url => new Promise((res, rej) => http.get(url, r => { let b = []; r.on('data', d => b.push(d)); r.on('end', () => r.statusCode === 200 ? res(Buffer.concat(b)) : rej(new Error('HTTP ' + r.statusCode))); }).on('error', rej));
const inUse = port => get(`http://127.0.0.1:${port}/index.html`).then(() => true, () => false);
async function startServer() {
  if (!ARG.port) for (let tries = 0; tries < 20 && await inUse(PORT); tries++) PORT++;
  else if (await inUse(PORT)) throw new Error(`port ${PORT} is already taken — refusing to test against a server that is not mine`);
  ORIGIN = `http://127.0.0.1:${PORT}`;
  const proc = spawn(process.execPath, [path.join(ROOT, 'scripts', 'serve.js')], { env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' });
  const mine = fs.readFileSync(path.join(ROOT, 'src', 'index.html'));
  for (let i = 0; i < 40; i++) {
    try {
      const got = await get(ORIGIN + '/index.html');
      if (!got.equals(mine)) { proc.kill(); throw new Error(`the server on ${PORT} is not serving this checkout's src/`); }
      console.log(`smoke server: ${ORIGIN} (this checkout's src/, verified)`);
      return proc;
    } catch (e) { if (/not serving/.test(e.message)) throw e; await sleep(250); }
  }
  proc.kill(); throw new Error('the smoke server never answered on ' + PORT);
}

// ---------- the ledger: what the page did that it should not have ----------
function watch(cdp, ledger) {
  const urls = new Map();
  cdp.on('Runtime.exceptionThrown', p => {
    const d = p.exceptionDetails || {};
    const text = (d.exception && (d.exception.description || d.exception.value)) || d.text || 'exception';
    ledger.exceptions.push(String(text).split('\n').slice(0, 3).join(' | '));
  });
  cdp.on('Runtime.consoleAPICalled', p => {
    if (p.type !== 'error' && p.type !== 'warning') return;
    const line = (p.args || []).map(a => a.value !== undefined ? String(a.value) : (a.description || '')).join(' ');
    (p.type === 'error' ? ledger.consoleErrors : ledger.consoleWarnings).push(line.slice(0, 200));
  });
  cdp.on('Network.requestWillBeSent', p => urls.set(p.requestId, p.request && p.request.url));
  cdp.on('Network.loadingFailed', p => {
    const url = urls.get(p.requestId) || '?';
    if (p.blockedReason) { ledger.blocked.push(url); return; }       // the leaderboard host, on purpose
    (url.startsWith(ORIGIN) ? ledger.failedSameOrigin : ledger.failedOther).push(url + ' (' + (p.errorText || 'failed') + ')');
  });
  cdp.on('Network.responseReceived', p => {
    const r = p.response || {};
    if (r.status >= 400) (String(r.url).startsWith(ORIGIN) ? ledger.failedSameOrigin : ledger.failedOther).push(r.status + ' ' + r.url);
  });
}
const newLedger = () => ({ exceptions: [], consoleErrors: [], consoleWarnings: [], failedSameOrigin: [], failedOther: [], blocked: [] });

// ---------- helpers over the page ----------
const G = expr => `(() => { try { return (${expr}); } catch (e) { return '__err:' + (e && e.message || e); } })()`;
async function until(cdp, expr, ms, every = 200) {
  const t0 = Date.now();
  for (;;) {
    let v = null; try { v = await cdp.eval(G(expr)); } catch (e) { v = null; }
    if (v === true) return true;
    if (Date.now() - t0 > ms) return false;
    await sleep(every);
  }
}
async function shot(cdp, name) {
  try {
    const r = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(SHOTS, name + '.png'), Buffer.from(r.data, 'base64'));
  } catch (e) { /* a lost screenshot is not a failed step */ }
}
// game-space (x, y) → screen (x, y). On a phone the landscape canvas is painted
// through a 90° transform (ctx.setTransform(0, DPR, -DPR, 0, canvas.width, 0)),
// so a game point (gx, gy) sits at screen (innerWidth - gy, gx).
async function touchAt(cdp, points, type) {
  const rot = await cdp.eval(G('ROT === true'));
  const iw = await cdp.eval(G('window.innerWidth'));
  const touchPoints = points.map((p, i) => rot === true ? { x: iw - p.y, y: p.x, id: i } : { x: p.x, y: p.y, id: i });
  await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : touchPoints });
}

// ---------- one viewport, start to end ----------
async function runViewport(vp) {
  const [w, h] = VIEWPORTS[vp];
  const ledger = newLedger();
  const steps = [];
  const step = async (name, fn) => {
    const before = ledger.exceptions.length + ledger.consoleErrors.length;
    let ok = false, why = '';
    try { const r = await fn(); ok = r === true || r === undefined; why = r === true || r === undefined ? '' : String(r); }
    catch (e) { why = e.message || String(e); }
    const fresh = ledger.exceptions.length + ledger.consoleErrors.length - before;
    if (fresh) { ok = false; why = (why ? why + '; ' : '') + fresh + ' new error(s) during the step'; }
    steps.push({ name, ok, why });
    console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${vp}: ${name}${why ? '  — ' + why : ''}`);
    if (ARG.debug && cdp) console.log('        ' + await cdp.eval(G("JSON.stringify({ CRASH: typeof CRASH, hb: typeof hardwareBack, st: state, frames: window.frames.length, url: location.href.slice(-24) })")).catch(e => 'debug: ' + e.message));
  };

  const chrome = launchChrome(CDP_PORT, { headless: HEADLESS, extraArgs: [`--window-size=${w},${h}`] });
  let cdp = null;
  try {
    await waitForPort(CDP_PORT);
    ({ cdp } = await openPage(CDP_PORT));
    watch(cdp, ledger);
    await cdp.send('Network.enable');
    await cdp.send('Network.setBlockedURLs', { urls: [LB_HOST] });
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: vp === 'phone' });
    if (vp === 'phone') await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true });

    const boot = async () => {
      await cdp.send('Page.navigate', { url: ORIGIN + '/index.html' });
      if (!await until(cdp, "typeof frame === 'function' && typeof startLevel === 'function'", 20000, 250)) return 'the game never booted';
      return true;
    };

    // ── the first launch, on a fresh save ────────────────────────────────────
    await step('boots, splash on', async () => {
      const r = await boot(); if (r !== true) return r;
      return (await cdp.eval(G('SPLASH.on === true'))) === true || 'SPLASH.on is not true after boot';
    });
    await sleep(1500); await shot(cdp, `${vp}-01-splash`);
    await step('bake gate opens on its own, every hull baked, no fallback ring', async () => {
      if (!await until(cdp, 's3BreachReady() === true', 35000, 250)) return 'the bake never finished (LOADING would hold)';
      const s = await cdp.eval(G("JSON.stringify({ blocked: s3Blocked, all: s3BreachKeys().every(k => s3Sprites[k] && s3Sprites[k] !== 'fail'), holdT: SPLASH.holdT, holdMax: SPLASH.holdMax, tried: ringFxTried })"));
      const o = JSON.parse(s);
      if (o.blocked) return 's3Blocked — this browser refused ImageData';
      if (!o.all) return 'a hull failed to bake';
      if (o.holdT >= o.holdMax) return 'the hang guard opened the gate, not readiness';
      return true;
    });
    await step('fonts arrived and every same-origin asset came back 200', async () => {
      await cdp.eval('document.fonts.ready.then(() => 1)');
      const f = JSON.parse(await cdp.eval(G("JSON.stringify([...document.fonts].map(x => [x.family.replace(/\"/g, ''), x.status]))")));
      const loaded = fam => f.some(([n, s]) => n === fam && s === 'loaded');
      if (!loaded('Audiowide')) return 'Audiowide did not load: ' + JSON.stringify(f);
      if (!loaded('Rajdhani')) return 'Rajdhani did not load: ' + JSON.stringify(f);
      if (ledger.failedSameOrigin.length) return 'failed: ' + ledger.failedSameOrigin.join(', ');
      return true;
    });
    await step('the splash ends in enlistment on a fresh save', async () => {
      await cdp.eval(G('(splashEnd(true), 1)'));
      if (!await until(cdp, 'state === S.ENLIST', 3000)) return 'state is ' + await cdp.eval(G('state'));
      await sleep(600); await shot(cdp, `${vp}-02-enlist`);
      return true;
    });

    // ── the return visit, on a seeded save ───────────────────────────────────
    const seed = JSON.stringify({ progress: { tutorialDone: true, enlisted: true } });
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: `try { localStorage.setItem(${JSON.stringify(SAVE_KEY)}, ${JSON.stringify(seed)}); localStorage.removeItem(${JSON.stringify(ERROR_KEY)}); } catch (e) {}` });
    await step('a seeded save boots to the home menu', async () => {
      const r = await boot(); if (r !== true) return r;
      if (!await until(cdp, 's3BreachReady() === true', 35000, 250)) return 'the bake never finished';
      await cdp.eval(G('(splashEnd(true), 1)'));
      if (!await until(cdp, "state === S.MENU && menuScreen === 'home' && SPLASH.on === false", 4000)) return 'state ' + await cdp.eval(G("state + '/' + menuScreen + '/' + SPLASH.on"));
      await sleep(700); await shot(cdp, `${vp}-03-menu-home`);
      return true;
    });
    for (const scr of ['camps', 'map', 'flow']) {
      await step(`menu screen ${scr} paints`, async () => {
        await cdp.eval(G(`(menuScreen = '${scr}', 1)`)); await sleep(700); await shot(cdp, `${vp}-04-menu-${scr}`); return true;
      });
    }
    await step('the leaderboard opens, and with the host blocked it says so instead of hanging', async () => {
      await cdp.eval(G("(menuScreen = 'home', openBoard('home'), 1)"));
      if (!await until(cdp, "typeof boardData !== 'undefined' && !!boardData && boardData.loading === false", 8000)) return 'the board never stopped loading';
      await sleep(400); await shot(cdp, `${vp}-05-board`);
      await cdp.eval(G("(menuScreen = 'home', 1)"));
      return true;
    });
    const discs = [
      ['settings', "menuSettings = true", "menuSettings = false"],
      ['my-data', "openMyData()", "closeMyData()"],
      ['feedback', "openFeedback()", "closeFeedback()"],
      ['guide', "enterGuide('menu')", "closeGuide()"],
      ['boss-gate', "menuScreen = 'map', bossGate = true", "bossGate = false, menuScreen = 'home'"],
    ];
    for (const [name, open, close] of discs) {
      await step(`disc ${name} opens, paints five frames, closes`, async () => {
        await cdp.eval(G(`(${open}, 1)`)); await sleep(450); await shot(cdp, `${vp}-06-disc-${name}`);
        await cdp.eval(G(`(${close}, 1)`)); await sleep(150);
        return true;
      });
    }

    // ── a stage ──────────────────────────────────────────────────────────────
    await step('a briefed start shows the briefing disc', async () => {
      await cdp.eval(G('(switchCampaign(0), startLevel(0, true), 1)'));
      if (!await until(cdp, 'state === S.INFO', 3000)) return 'state ' + await cdp.eval(G('state'));
      await sleep(600); await shot(cdp, `${vp}-07-briefing`);
      return true;
    });
    await step('two thumbs on the pads launch the lane', async () => {
      await cdp.eval(G('(startLevel(0, false), introT = 999, introCd = 0, 1)'));
      await sleep(300);
      const pads = JSON.parse(await cdp.eval(G('JSON.stringify([dialCenter(0), dialCenter(1)])')));
      if (!pads[0] || typeof pads[0].x !== 'number') return 'dialCenter gave ' + JSON.stringify(pads);
      await touchAt(cdp, pads, 'touchStart');
      if (!await until(cdp, 'state === S.PLAY && preLaunch() === false', 4000)) {
        // fall back to the pad flags, and say so — the touch path is the one under test
        await cdp.eval(G('(padHold[0] = true, padHold[1] = true, 1)'));
        if (!await until(cdp, 'state === S.PLAY && preLaunch() === false', 3000)) return 'the lane never launched';
        return 'launched only after forcing padHold — the touch path did not land';
      }
      const t1 = await cdp.eval(G('time')); await sleep(400); const t2 = await cdp.eval(G('time'));
      return t2 > t1 || 'the clock is not advancing';
    });
    await step(`${PLAY_SEC}s of play under an autopilot: enemies arrive, nothing throws, no fault`, async () => {
      await cdp.eval(`window.__smokeAuto = function () {
        if (state !== S.PLAY) return;
        if (integrity < 70) integrity = 100;
        const live = enemies.filter(e => !e.dead && !e.resolved && !e.failed && e.type !== 'frag' && e.type !== 'strip').sort((a, b) => a.z - b.z);
        const taken = [];
        for (let i = 0; i < 2; i++) {
          const t = live.find(e => taken.indexOf(e) < 0 && (e.lock === undefined || e.lock === i || e.type === 'heavy' || e.type === 'line'));
          if (t) { taken.push(t); nodes[i].slew = t.angle; }
        }
      }; 1`);
      let seen = false; const t0 = Date.now(); let shotMid = false;
      while (Date.now() - t0 < PLAY_SEC * 1000) {
        await sleep(150);
        const s = JSON.parse(await cdp.eval(G('(window.__smokeAuto(), JSON.stringify({ n: enemies.length, st: state, crash: CRASH.on, ig: integrity }))')));
        if (s.n > 0) seen = true;
        if (s.crash) return 'SYSTEM FAULT during play';
        if (!shotMid && Date.now() - t0 > 3000) { shotMid = true; await shot(cdp, `${vp}-08-play-3s`); }
      }
      await shot(cdp, `${vp}-09-play-${PLAY_SEC}s`);
      const st = await cdp.eval(G('state'));
      if (st !== 1) return 'the run left S.PLAY (state ' + st + ')';
      return seen || 'no enemy ever arrived';
    });
    await step('pause, the guide over the pause, resume with a count-in', async () => {
      await cdp.eval(G('(pauseToggle(), 1)'));
      if (!await until(cdp, 'state === S.PAUSE', 2000)) return 'did not pause';
      await sleep(500); await shot(cdp, `${vp}-10-pause`);
      await cdp.eval(G("(enterGuide('pause'), 1)")); await sleep(500); await shot(cdp, `${vp}-11-guide-pause`);
      await cdp.eval(G('(closeGuide(), 1)'));
      if (!await until(cdp, 'state === S.PAUSE', 2000)) return 'the guide did not hand back to the pause';
      await cdp.eval(G('(pauseToggle(), 1)'));
      if (!await until(cdp, 'state === S.PLAY && resumeHold > 0', 2000)) return 'no count-in on resume';
      await shot(cdp, `${vp}-12-count-in`);
      return true;
    });
    await step('the back key pauses, and QUIT on the pause disc lands on the map', async () => {
      await sleep(1200);
      const r = await cdp.eval(G('hardwareBack()'));
      if (!await until(cdp, 'state === S.PAUSE', 2000)) return 'back did not pause (returned ' + r + ')';
      await sleep(400);
      const hit = await cdp.eval(G(`(() => {
        const b = pauseButtonsList.find(b => b.action === 'menu'); if (!b || !b.seg) return 'no QUIT segment';
        const s = b.seg, r = s.r, d = s.d;
        const x = s.cx + (s.half < 0 ? -r * 0.4 : s.half > 0 ? r * 0.4 : 0), y = s.cy + d + (r - d) * 0.4;
        if (!discSegHit(s, x, y)) return 'the computed point misses the segment';
        pauseTap(x, y, 0); return 'ok';
      })()`));
      if (hit !== 'ok') return hit;
      if (!await until(cdp, "state === S.MENU && menuScreen === 'map' && replaying === false", 3000)) return 'state ' + await cdp.eval(G("state + '/' + menuScreen + '/' + replaying"));
      await sleep(900); await shot(cdp, `${vp}-13-back-on-map`);
      return true;
    });

    // ── the error net, for real ──────────────────────────────────────────────
    await step('a thrown frame paints SYSTEM FAULT, records the scene, and a tap restarts', async () => {
      await cdp.eval(G("(update = () => { throw new Error('smoke: deliberate fault'); }, startLevel(0, false), introT = 999, introCd = 0, 1)"));
      if (!await until(cdp, 'CRASH.on === true', 3000)) return 'the fault never latched';
      await sleep(400); await shot(cdp, `${vp}-14-system-fault`);
      const rec = JSON.parse(await cdp.eval(G(`localStorage.getItem(${JSON.stringify(ERROR_KEY)})`)) || 'null');
      if (!rec || rec.where !== 'frame') return 'no frame record in the slot: ' + JSON.stringify(rec);
      if (!/state=/.test(rec.scene || '') || !/board=/.test(rec.scene || '')) return 'the record has no scene: ' + JSON.stringify(rec.scene);
      if (!/smoke: deliberate fault/.test(rec.msg || '')) return 'the record carries the wrong message';
      // the restart tap is armed 700 ms late; then any pointerdown reloads
      await sleep(1000);
      let navigated = false; cdp.on('Page.frameNavigated', () => { navigated = true; });
      const cx = w / 2, cy = h / 2;
      await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: cx, y: cy, button: 'left', clickCount: 1 });
      await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: cx, y: cy, button: 'left', clickCount: 1 });
      if (!await until(cdp, "typeof SPLASH !== 'undefined' && SPLASH.on === true && (typeof CRASH === 'undefined' || CRASH.on === false)", 15000, 250)) return 'the tap did not restart the game';
      return navigated || 'the page did not navigate on the tap';
    });
  } finally {
    if (cdp && !ARG.keep) cdp.close();
    if (!ARG.keep) await killChrome(chrome); // gone, not going — the next viewport reuses the port
  }

  // ── the tallies ──────────────────────────────────────────────────────────
  const failedSteps = steps.filter(s => !s.ok);
  const hard = ledger.exceptions.length + ledger.consoleErrors.length + ledger.failedSameOrigin.length;
  console.log(`  ${vp}: ${steps.length - failedSteps.length}/${steps.length} steps · ${ledger.exceptions.length} exceptions · ${ledger.consoleErrors.length} console errors · ${ledger.failedSameOrigin.length} same-origin failures · ${ledger.consoleWarnings.length} warnings · ${ledger.blocked.length} leaderboard calls blocked`);
  for (const e of ledger.exceptions) console.log('    exception: ' + e);
  for (const e of ledger.consoleErrors) console.log('    console.error: ' + e);
  for (const e of ledger.failedSameOrigin) console.log('    failed: ' + e);
  if (ARG.verbose) for (const e of ledger.consoleWarnings) console.log('    warn: ' + e);
  if (ledger.failedOther.length && ARG.verbose) for (const e of ledger.failedOther) console.log('    other host: ' + e);
  return failedSteps.length === 0 && hard === 0;
}

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const t0 = Date.now();
  const server = await startServer();
  let allOk = true;
  try {
    for (const vp of WANT) {
      console.log(`\n── ${vp} ${VIEWPORTS[vp].join('×')}${vp === 'phone' ? '  (the canvas is rotated: turn the PNGs 90° before judging)' : ''} ──`);
      const ok = await runViewport(vp);
      allOk = allOk && ok;
    }
  } finally {
    try { server.kill(); } catch (e) {}
  }
  console.log(`\n${allOk ? 'SMOKE OK' : 'SMOKE FAILED'}  (${((Date.now() - t0) / 1000).toFixed(0)}s, screenshots in ${SHOTS})`);
  process.exit(allOk ? 0 : 1);
})().catch(e => { console.error('smoke crashed: ' + (e.stack || e)); process.exit(2); });
