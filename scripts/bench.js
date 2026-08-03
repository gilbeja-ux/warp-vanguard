#!/usr/bin/env node
'use strict';
// ---------- FRAME BENCH: drive a real browser, read the real globals ----------
// The on-canvas profiler answers "where does a frame go" but it has to be READ off
// a moving screen, and a phone screenshot is a poor instrument: the numbers strobe,
// the run is 30s long, and the thing you most need to catch — the lowFX latch —
// is one frame wide.
//
// So this drives Chrome over the DevTools Protocol and reads the game's own state
// directly. It does not infer the latch from fps; it polls `lowFX` and
// `warpStars.length` and reports the exact moment they change.
//
// ZERO DEPENDENCIES. Node 22 ships a global WebSocket, which is the only thing a
// CDP client actually needs. That keeps the project's no-node_modules property.
//
// Two targets, and they answer DIFFERENT questions — do not conflate them:
//
//   --target=mac     Mac Chrome, optionally CPU-throttled. Settles MECHANISM
//                    questions (did the latch fire? what changed?) exactly.
//                    CPU throttling emulates the CPU, NOT GPU fill rate, so its
//                    milliseconds say nothing about a phone's blend wall.
//
//   --target=phone   The phone's Chrome, via `adb forward`. Real GPU, real
//                    thermals. The ONLY source of trustworthy milliseconds, and
//                    therefore the only basis for a look-risking optimisation.
//
// Usage:
//   node scripts/bench.js                          # default matrix, mac target
//   node scripts/bench.js --throttle=6             # emulate a slow CPU
//   node scripts/bench.js --target=phone           # needs: adb devices, USB debugging
//   node scripts/bench.js --dur=30 --reps=3        # 30s per config, 3 interleaved reps
//   node scripts/bench.js --configs=,abl=streaks   # comma-list of query suffixes
//
// It never touches the dev server; it only loads pages from it.

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { execFileSync, spawn } = require('child_process');

// ---------- args ----------
const ARG = {};
for (const a of process.argv.slice(2)) {
  const m = /^--([^=]+)(?:=(.*))?$/.exec(a);
  if (m) ARG[m[1]] = m[2] === undefined ? true : m[2];
}
const TARGET   = ARG.target || 'mac';
const PORT     = parseInt(ARG.port || '9222', 10);
const ORIGIN   = ARG.origin || (TARGET === 'phone' ? 'http://192.168.31.254:8000' : 'http://127.0.0.1:8000');
const DUR      = parseFloat(ARG.dur || '30') * 1000;
const REPS     = parseInt(ARG.reps || '3', 10);
const THROTTLE = parseFloat(ARG.throttle || '1');
const LEVEL    = parseInt(ARG.level || '1', 10);      // level 2 is index 1
const SAMPLE   = parseInt(ARG.sample || '250', 10);
const HEADLESS = ARG.headless === undefined ? false : ARG.headless !== 'false';
// 'full' = never let lowFX trip (measure full detail), 'low' = force lowFX on,
// 'none' = leave the watchdog alone. Default 'full': an unpinned ablation measures
// the watchdog instead of the flag.
const PIN = ARG.pin || 'full';
const OUT      = ARG.out || path.join(__dirname, '..', 'bench-results');

// The measurement matrix. '' is the baseline. Order matters: reps are interleaved
// A,B,C,A,B,C so thermal drift shows up as spread between reps instead of being
// silently averaged into one config.
const CONFIGS = (ARG.configs !== undefined
  ? String(ARG.configs).split(',')
  : ['', 'abl=streaks', 'abl=grad', 'abl=heads', 'abl=passes', 'abl=grad,heads']);

// ---------- tiny CDP client ----------
function getJSON(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => {
      let b = '';
      res.on('data', d => { b += d; });
      res.on('end', () => { try { resolve(JSON.parse(b)); } catch (e) { reject(e); } });
    }).on('error', reject);
  });
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

class CDP {
  constructor(ws) {
    this.ws = ws; this.id = 0; this.pending = new Map();
    ws.addEventListener('message', ev => {
      let msg; try { msg = JSON.parse(ev.data); } catch (e) { return; }
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.method + ': ' + msg.error.message));
        else resolve(msg.result);
      }
    });
  }
  send(method, params) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params: params || {} }));
      setTimeout(() => {
        if (this.pending.has(id)) { this.pending.delete(id); reject(new Error(method + ' timed out')); }
      }, 30000);
    });
  }
  // Evaluate in the page's GLOBAL scope. This is the whole trick: a top-level
  // `let` in a classic <script> is a global LEXICAL binding — not a property of
  // globalThis — but it IS visible to later global evaluation. So `lowFX`,
  // `warpStars` and `PROF` are all readable by bare name even though
  // `globalThis.lowFX` is undefined.
  async eval(expr) {
    const r = await this.send('Runtime.evaluate', {
      expression: expr, returnByValue: true, awaitPromise: true
    });
    if (r.exceptionDetails) {
      throw new Error('page eval failed: ' + (r.exceptionDetails.exception
        ? r.exceptionDetails.exception.description : r.exceptionDetails.text));
    }
    return r.result.value;
  }
}

// ---------- browser plumbing ----------
const CHROME_CANDIDATES = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
];

function findChrome() {
  for (const p of CHROME_CANDIDATES) if (fs.existsSync(p)) return p;
  throw new Error('Chrome not found. Looked in:\n  ' + CHROME_CANDIDATES.join('\n  '));
}

function adb(args) {
  return execFileSync('adb', args, { encoding: 'utf8' }).trim();
}

let chromeProc = null;

async function attachMac() {
  const bin = findChrome();
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'wv-bench-'));
  const args = [
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profile}`,
    '--autoplay-policy=no-user-gesture-required',   // the splash score needs no gesture
    '--no-first-run', '--no-default-browser-check',
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
    '--hide-scrollbars',
    'about:blank',
  ];
  if (HEADLESS) args.unshift('--headless=new');
  console.log(`launching ${path.basename(bin)}${HEADLESS ? ' (headless)' : ''} on port ${PORT}`);
  chromeProc = spawn(bin, args, { stdio: 'ignore', detached: false });
  return waitForPort();
}

async function attachPhone() {
  let devices;
  try { devices = adb(['devices']); }
  catch (e) { throw new Error('adb not runnable: ' + e.message); }
  const lines = devices.split('\n').slice(1).filter(l => /\tdevice$/.test(l.trim()));
  if (!lines.length) {
    throw new Error(
      'No device in `adb devices`.\n' +
      '  1. Plug the phone in over USB.\n' +
      '  2. Settings > Developer options > USB debugging = ON.\n' +
      '  3. Accept the "Allow USB debugging?" prompt on the phone.\n' +
      '  4. Open Chrome on the phone (it must be running to expose its socket).\n' +
      '  Then re-run.'
    );
  }
  console.log('device: ' + lines[0].trim().split('\t')[0]);
  // A DOZING SCREEN PAUSES requestAnimationFrame, so the page stops rendering and
  // every sample comes back empty — it looks like the harness broke rather than
  // like the phone fell asleep. Wake it, dismiss the lockscreen, and hold it on
  // for the duration.
  try {
    adb(['shell', 'input', 'keyevent', 'KEYCODE_WAKEUP']);
    adb(['shell', 'svc', 'power', 'stayon', 'usb']);
    const locked = adb(['shell', 'dumpsys', 'window']).match(/mDreamingLockscreen=(true|false)/);
    if (locked && locked[1] === 'true') {
      adb(['shell', 'input', 'swipe', '540', '1600', '540', '500']);
      const still = adb(['shell', 'dumpsys', 'window']).match(/mDreamingLockscreen=(true|false)/);
      if (still && still[1] === 'true') {
        throw new Error('the phone is locked and a swipe did not dismiss it — unlock it by hand (PIN/pattern) and re-run');
      }
    }
    console.log('screen: awake, stay-on while charging');
  } catch (e) {
    if (/locked/.test(e.message)) throw e;
    console.log('  (could not manage screen state: ' + e.message + ')');
  }
  adb(['forward', `tcp:${PORT}`, 'localabstract:chrome_devtools_remote']);
  console.log(`adb forward tcp:${PORT} -> phone Chrome`);
  return waitForPort();
}

async function waitForPort() {
  for (let i = 0; i < 60; i++) {
    try {
      const v = await getJSON(`http://127.0.0.1:${PORT}/json/version`);
      console.log('connected: ' + (v['Browser'] || 'unknown'));
      return;
    } catch (e) { await sleep(250); }
  }
  throw new Error(`nothing answering on 127.0.0.1:${PORT}`);
}

async function openPage(url) {
  // Reuse an existing about:blank/page target where possible; on the phone we must
  // not spawn tabs endlessly.
  const list = await getJSON(`http://127.0.0.1:${PORT}/json/list`);
  let page = list.find(t => t.type === 'page');
  if (!page) {
    await getJSON(`http://127.0.0.1:${PORT}/json/new?about:blank`).catch(() => {});
    await sleep(500);
    page = (await getJSON(`http://127.0.0.1:${PORT}/json/list`)).find(t => t.type === 'page');
  }
  if (!page) throw new Error('no page target available');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.addEventListener('open', res, { once: true });
    ws.addEventListener('error', () => rej(new Error('websocket failed')), { once: true });
  });
  const cdp = new CDP(ws);
  await cdp.send('Runtime.enable');
  await cdp.send('Page.enable');
  return { cdp, ws };
}

// ---------- the sample probe ----------
// One round-trip per sample, returning everything at once. Reads bare global
// lexical names; each is guarded so a rename fails loudly as null rather than
// throwing and killing the run.
const PROBE = `(() => { const g = n => { try { return eval(n); } catch (e) { return null; } };
  const P = g('PROF');
  return JSON.stringify({
    t: performance.now(),
    fps:   P ? P.fps   : null,
    total: P && P.total != null ? +P.total.toFixed(3) : null,
    peak:  P && P.peak  != null ? +P.peak.toFixed(3)  : null,
    rows:  P && P.rows ? P.rows.map(r => [r.name, +r.ms.toFixed(3)]) : null,
    lowFX:   g('lowFX'),
    warp:    (g('warpStars')  || []).length,
    streaks: (g('streaks')    || []).length,
    deep:    (g('deepStars')  || []).length,
    wisps:   (g('deepWisps')  || []).length,
    gas:     (g('gasWisps')   || []).length,
    enemies: (g('enemies')    || []).length,
    time:  g('time'),
    state: g('state'),
    W: g('W'), H: g('H'), DPR: g('DPR')
  });
})()`;

async function runConfig(cdp, suffix, rep) {
  const q = '?prof=1' + (suffix ? '&' + suffix : '');
  const url = `${ORIGIN}/index.html${q}`;
  await cdp.send('Page.navigate', { url });

  // wait for the game to exist
  let ready = false;
  for (let i = 0; i < 80; i++) {
    await sleep(250);
    try {
      if (await cdp.eval(`(() => { try { return typeof frame === 'function' && typeof startLevel === 'function'; } catch (e) { return false; } })()`)) { ready = true; break; }
    } catch (e) { /* still navigating */ }
  }
  if (!ready) throw new Error('game never booted at ' + url);

  // Skip the 8.1s splash and the 3-2-1 intro, then start the level. This changes
  // nothing about steady-state cost — it only removes dead wall time from the run.
  await cdp.eval(`(() => { try { splashEnd(true); } catch (e) {} return 1; })()`);
  await sleep(600);
  await cdp.eval(`(() => { startLevel(${LEVEL}, false); introT = 999; introCd = 0; return 1; })()`);

  // ---------- PIN THE QUALITY TIER ----------
  // Without this, an ablation that lightens the frame stops `lowFX` from tripping,
  // and you end up comparing "streaks off, full detail" against "streaks on,
  // degraded" — two different quality levels. That substitution is what made
  // `?abl=streaks` read as SLOWER than baseline. Measured 2026-08-03.
  //
  // No source edit needed: `perfWatch` is a top-level function declaration in a
  // classic script, so it is a property of the global object and can be replaced
  // at runtime. `lowFX` is a top-level `let` — a global lexical binding, not a
  // globalThis property — but it is in scope for global eval, so it can be
  // assigned. Keeping this out of src/ means SIM_ID is untouched and the
  // leaderboard verifier does not need redeploying to run a benchmark.
  if (PIN === 'full') {
    const ok = await cdp.eval(`(() => { perfWatch = function () {}; return typeof perfWatch === 'function' && lowFX === false; })()`);
    if (!ok) throw new Error('could not pin tier=full (perfWatch not overridable, or lowFX already latched)');
  } else if (PIN === 'low') {
    await cdp.eval(`(() => { perfWatch = function () {};
      lowFX = true;
      initStreaks(); initDeepField(); initWarpSky(); initLaneMedium(); initAmbTraffic();
      return 1; })()`);
  }

  // let it settle before recording: the governor and the caches both need a moment
  await sleep(1500);

  const samples = [];
  const t0 = Date.now();
  let latch = null;
  let prevLowFX = await cdp.eval(`(() => { try { return lowFX; } catch (e) { return null; } })()`);

  while (Date.now() - t0 < DUR) {
    await sleep(SAMPLE);
    let s;
    try { s = JSON.parse(await cdp.eval(PROBE)); } catch (e) { continue; }
    s.wall = Date.now() - t0;
    samples.push(s);
    if (prevLowFX === false && s.lowFX === true && !latch) {
      latch = { wall: s.wall, time: s.time, warpBefore: null, warpAfter: s.warp };
      const prev = samples[samples.length - 2];
      if (prev) latch.warpBefore = prev.warp;
      console.log(`      ! lowFX LATCHED at ${(s.wall / 1000).toFixed(1)}s  (sim time ${Number(s.time).toFixed(1)}s)  warpStars ${latch.warpBefore} -> ${s.warp}`);
    }
    prevLowFX = s.lowFX;
  }
  // Fail loudly rather than reporting an empty run as a row of dashes: an all-null
  // sample set means the page was not rendering (backgrounded tab, dozing screen),
  // not that the config was free.
  if (!samples.some(s => s.total != null && s.fps > 0)) {
    throw new Error('no frames rendered in ' + (DUR / 1000) + 's — is the screen on and the tab in the foreground?');
  }
  return { suffix, rep, samples, latch };
}

// ---------- stats ----------
// STEADY STATE IS THE METRIC THAT MATTERS, and getting this wrong inverted a
// whole conclusion once. A run mean folds together three different regimes: the
// warm-up (caches cold, ~13% slower on its own), the pre-latch window at full
// detail, and the post-latch steady state. When `lowFX` trips mid-run, the mean is
// dominated by the seconds BEFORE the trip — so a config that trips looks slow
// on the mean while actually running faster for the rest of the session, which is
// what the player experiences and what anyone reading the fps counter sees.
// Report both, and lead with steady state.
const SETTLE_FRAC = 0.6;   // ignore the first 60% of a run

function summarize(run) {
  // Ignore samples before the profiler has published its first second, and any
  // sample where the game is not in PLAY.
  const ok = run.samples.filter(s => s.total != null && s.fps != null && s.fps > 0);
  const span = ok.length ? ok[ok.length - 1].wall : 0;
  const settled = ok.filter(s => s.wall >= span * SETTLE_FRAC);
  const nums = k => ok.map(s => s[k]).filter(v => typeof v === 'number');
  const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
  const med = a => { if (!a.length) return null; const b = a.slice().sort((x, y) => x - y); return b[b.length >> 1]; };
  const rows = {};
  for (const s of ok) for (const [n, ms] of (s.rows || [])) {
    (rows[n] = rows[n] || []).push(ms);
  }
  const phase = Object.entries(rows)
    .map(([n, a]) => [n, mean(a)])
    .sort((a, b) => b[1] - a[1]);
  const sNums = k => settled.map(s => s[k]).filter(v => typeof v === 'number');
  return {
    suffix: run.suffix, rep: run.rep, n: ok.length,
    // the headline: steady state, after warm-up and after any latch has settled
    ssMs: mean(sNums('total')), ssFps: mean(sNums('fps')),
    fps: mean(nums('fps')), avgMs: mean(nums('total')),
    medMs: med(nums('total')), peakMs: Math.max(0, ...nums('peak')),
    lowFXfrac: ok.length ? ok.filter(s => s.lowFX === true).length / ok.length : null,
    latchAt: run.latch ? run.latch.wall / 1000 : null,
    warp: med(nums('warp')), streaks: med(nums('streaks')), deep: med(nums('deep')),
    enemies: mean(nums('enemies')),
    phase,
  };
}

function fmt(v, d) { return v == null || Number.isNaN(v) ? '   —  ' : v.toFixed(d === undefined ? 2 : d); }

// ---------- main ----------
(async () => {
  fs.mkdirSync(OUT, { recursive: true });

  if (TARGET === 'phone') await attachPhone();
  else await attachMac();

  const { cdp, ws } = await openPage('about:blank');

  // On a real device, NEVER override metrics — the native viewport and DPR are
  // exactly what we came to measure. Overriding would force a resolution the panel
  // does not have and invalidate every fill-rate number.
  if (TARGET === 'mac') {
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 412, height: 915, deviceScaleFactor: 3, mobile: true,
    }).catch(e => console.log('  (device metrics override skipped: ' + e.message + ')'));
  } else if (ARG.dpr) {
    // THE FILL-RATE PROBE. Fill rate is invisible to a call counter and is the one
    // lever lowFX never touches. Overriding only deviceScaleFactor, keeping the
    // native CSS viewport, renders fewer physical pixels for the same layout — so
    // if frame time falls sharply here and nowhere else, the device is fill-bound
    // and resolution is the prize rather than draw calls.
    const m = await cdp.eval(`JSON.stringify([innerWidth, innerHeight])`).catch(() => '[412,915]');
    const [vw, vh] = JSON.parse(m);
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: vw, height: vh, deviceScaleFactor: parseFloat(ARG.dpr), mobile: true,
    });
    console.log(`fill-rate probe: native ${vw}x${vh} CSS at deviceScaleFactor=${ARG.dpr}`);
  } else {
    console.log('using the device\'s native viewport and DPR (no override)');
  }

  if (THROTTLE > 1) {
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE });
    console.log(`CPU throttle: ${THROTTLE}x  — emulates a slow CPU, NOT GPU fill rate`);
  }

  console.log(`\ntarget=${TARGET}  origin=${ORIGIN}  level=${LEVEL + 1}  ${DUR / 1000}s x ${REPS} reps  pin=${PIN}`);
  console.log(`configs: ${CONFIGS.map(c => c || '(baseline)').join(' | ')}\n`);

  const runs = [];
  for (let rep = 1; rep <= REPS; rep++) {
    for (const suffix of CONFIGS) {                     // interleaved, not blocked
      console.log(`  rep ${rep}  ${(suffix || '(baseline)').padEnd(18)}`);
      try {
        const r = await runConfig(cdp, suffix, rep);
        runs.push(r);
        const s = summarize(r);
        console.log(`      fps ${fmt(s.fps, 1)}  avg ${fmt(s.avgMs)}ms  peak ${fmt(s.peakMs)}ms  lowFX ${((s.lowFXfrac || 0) * 100).toFixed(0)}% of run`);
      } catch (e) {
        console.log('      FAILED: ' + e.message);
      }
    }
  }

  // ---------- report ----------
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const csv = [['config', 'rep', 'wall_s', 'sim_time', 'fps', 'avg_ms', 'peak_ms', 'lowFX', 'warp', 'streaks', 'deep', 'enemies'].join(',')];
  for (const r of runs) for (const s of r.samples) {
    csv.push([JSON.stringify(r.suffix || 'baseline'), r.rep, (s.wall / 1000).toFixed(2), s.time, s.fps, s.total, s.peak, s.lowFX, s.warp, s.streaks, s.deep, s.enemies].join(','));
  }
  const csvPath = path.join(OUT, `bench-${TARGET}-${stamp}.csv`);
  fs.writeFileSync(csvPath, csv.join('\n'));

  const sums = runs.map(summarize);
  console.log('\n=========================================================================');
  console.log(` RESULTS   target=${TARGET}  throttle=${THROTTLE}x  ${DUR / 1000}s/config`);
  console.log('=========================================================================');
  console.log(' config           STEADY   run avg   med ms  peak ms   lowFX%  latch@  warp');
  for (const s of sums) {
    console.log(' ' + (s.suffix || 'baseline').padEnd(17)
      + (fmt(s.ssMs) + 'ms').padStart(9)
      + fmt(s.avgMs).padStart(9)
      + fmt(s.medMs).padStart(9)
      + fmt(s.peakMs).padStart(9)
      + ((s.lowFXfrac == null ? '—' : (s.lowFXfrac * 100).toFixed(0) + '%')).padStart(8)
      + (s.latchAt == null ? '   —  ' : (s.latchAt.toFixed(1) + 's')).padStart(8)
      + String(s.warp == null ? '—' : s.warp).padStart(6));
  }

  // per-config aggregate across reps, with spread — a wide spread means thermal
  // drift and the comparison should not be trusted
  console.log('\n STEADY-STATE MEANS ACROSS REPS (spread = max-min per rep; wide spread = untrustworthy)');
  const byCfg = {};
  for (const s of sums) (byCfg[s.suffix] = byCfg[s.suffix] || []).push(s);
  const base = byCfg[''] && byCfg[''].length
    ? byCfg[''].reduce((a, s) => a + s.ssMs, 0) / byCfg[''].length : null;
  for (const [cfg, list] of Object.entries(byCfg)) {
    const avgs = list.map(s => s.ssMs).filter(v => typeof v === 'number');
    if (!avgs.length) continue;
    const m = avgs.reduce((a, b) => a + b, 0) / avgs.length;
    const spread = Math.max(...avgs) - Math.min(...avgs);
    const delta = base ? ((m - base) / base) * 100 : null;
    const latched = list.filter(s => s.latchAt != null).length;
    console.log(' ' + (cfg || 'baseline').padEnd(19)
      + fmt(m).padStart(9) + 'ms'
      + ('spread ' + fmt(spread)).padStart(15)
      + (delta == null ? '' : ('  ' + (delta >= 0 ? '+' : '') + delta.toFixed(1) + '% vs baseline'))
      + `   latched ${latched}/${list.length}`);
  }

  // PER-CONFIG phase breakdown, averaged across reps. Printing this for the
  // baseline alone hides the one number that isolates a change: whether the phase
  // you edited actually got cheaper. End-to-end frame time can stay flat because
  // the device is bound by something else (thermals, GPU, vsync) while the phase
  // timer still shows the CPU work you removed.
  const phaseNames = [];
  const cfgPhase = {};
  for (const [cfg, list] of Object.entries(byCfg)) {
    const acc = {};
    for (const s of list) for (const [n, ms] of s.phase) (acc[n] = acc[n] || []).push(ms);
    cfgPhase[cfg] = {};
    for (const [n, a] of Object.entries(acc)) {
      cfgPhase[cfg][n] = a.reduce((x, y) => x + y, 0) / a.length;
      if (!phaseNames.includes(n)) phaseNames.push(n);
    }
  }
  const cfgs = Object.keys(byCfg);
  phaseNames.sort((a, b) => (cfgPhase[cfgs[0]][b] || 0) - (cfgPhase[cfgs[0]][a] || 0));
  console.log('\n PHASE BREAKDOWN BY CONFIG (mean ms/frame across reps)');
  console.log(' phase                ' + cfgs.map(c => (c || 'baseline').slice(0, 12).padStart(13)).join(''));
  for (const n of phaseNames) {
    const vals = cfgs.map(c => cfgPhase[c][n]);
    if (!vals.some(v => v >= 0.05)) continue;
    console.log(' ' + n.padEnd(21) + vals.map(v => fmt(v).padStart(13)).join(''));
  }
  console.log(' ' + 'TOTAL'.padEnd(21) + cfgs.map(c =>
    fmt(Object.values(cfgPhase[c]).reduce((a, b) => a + b, 0)).padStart(13)).join(''));

  console.log('\n samples -> ' + csvPath);
  if (THROTTLE > 1 || TARGET === 'mac') {
    console.log('\n NOTE: these milliseconds are NOT a phone measurement. CPU throttling');
    console.log('       emulates the CPU, not GPU fill rate. Use --target=phone before');
    console.log('       accepting any change that risks the look.');
  }

  try { ws.close(); } catch (e) {}
  if (chromeProc) { try { chromeProc.kill(); } catch (e) {} }
  process.exit(0);
})().catch(e => {
  console.error('\nbench failed: ' + e.message);
  if (chromeProc) { try { chromeProc.kill(); } catch (e2) {} }
  process.exit(1);
});
