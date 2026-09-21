#!/usr/bin/env node
'use strict';
// ---------- STORE SHOOT: every store still and the gameplay video, from the REAL page ----------
// Successor to scripts/shot-store.html (2026-08-15). That harness rebuilt index.html
// inside its own page and needed a server with a /shot endpoint. This one does what
// scripts/smoke.js does: a fresh headless Chrome over CDP (scripts/lib/cdp.js), the
// real src/index.html, a seeded save, the real bake gate, and the clock in our hands.
//
//   node scripts/store-shoot.js                          # every still, every size
//   node scripts/store-shoot.js --scene=boss --size=play # one still
//   node scripts/store-shoot.js --video --size=play      # the gameplay video (frames -> ffmpeg)
//   node scripts/store-shoot.js --list
//
// WHAT IS REAL AND WHAT IS STAGED is unchanged from the first set and is written
// up in docs/STORE-LISTING.md: every pixel is shipped code; only the ROSTER of a
// still is placed, by the game's own spawners, and the frame is FOUND by a
// predicate, never counted to. src/ is not modified for marketing. The one patch
// is served, not written: the DPR cap in 00-core.js is lifted for the 3x iPhone
// size so the frame is rendered at the store's pixel size instead of upscaled.
const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const { sleep, launchChrome, killChrome, waitForPort, openPage } = require('./lib/cdp.js');
const { SCENES } = require('./store-scenes.js');

const ARG = {};
for (const a of process.argv.slice(2)) { const m = /^--([^=]+)(?:=(.*))?$/.exec(a); if (m) ARG[m[1]] = m[2] === undefined ? true : m[2]; }
const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const OUT = path.resolve(ARG.out || path.join(ROOT, 'docs', 'store', 'raw'));
const CDP_PORT = parseInt(ARG.cdp || '9341', 10);
const SAVE_KEY = 'warpVanguard.v1';

// logical size x dpr = the store's pixel size. The logical size is a PHONE's (or
// an iPad's), so the layout in the frame is the layout a player holds.
// A PHONE IS NOT 16:9. dialCenter insets the pads from the screen's corners, so on a
// 16:9 canvas they sit ON the ring; on a real phone (19.5:9 and wider) they stand
// clear of it. The first cut shot Play at 1920x1080 and every lane frame had the pads
// over the ring (Gil, 2026-09-21). Play takes anything up to 2:1, so Play is 2:1.
// `safe` is the device's landscape safe area in CSS px: the game reads it from
// --sal/--sar/--sab and insets the pads by it, so an iPhone frame without it is a
// frame no iPhone shows.
// 47, the notch iPhones' inset (and the one on Gil's phone, measured off his screenshot).
// The Dynamic Island phones report 62, and BY THE ARITHMETIC of dialCenter a 956x440
// screen with 62 puts the pad's rim exactly on the ring's. That is INFERRED, not seen on
// a device — it is worth one look on a 6.9 in iPhone. The 6.9 in slot feeds every
// smaller iPhone's listing too, so the frame wears the common inset.
const IPHONE_SAFE = { l: 47, r: 47, t: 0, b: 21 };
const SIZES = {
  play:    { w: 1080, h: 540,  dpr: 2, note: 'Google Play phone, 2160x1080 (2:1, the widest Play takes)' },
  play169: { w: 960,  h: 540,  dpr: 2, note: 'Google Play 16:9, 1920x1080 — the pads overlap the ring at this shape; on request only', onRequest: true },
  iphone:  { w: 956,  h: 440,  dpr: 3, safe: IPHONE_SAFE, note: 'App Store iPhone 6.9 in, 2868x1320' },
  ipad:    { w: 1376, h: 1032, dpr: 2, safe: { l: 0, r: 0, t: 0, b: 20 }, note: 'App Store iPad 13 in, 2752x2064' },
  // video sizes
  yt:      { w: 1080, h: 540, dpr: 2, note: 'YouTube / Play promo video, 2160x1080 (2:1)' },
  preview: { w: 960,  h: 443, dpr: 2, safe: IPHONE_SAFE, note: 'App Store preview, iPhone, 1920x886' },
  previewpad: { w: 800, h: 600, dpr: 2, note: 'App Store preview, iPad, 1600x1200' },
};

// ---------- own server: src/, with the one served patch ----------
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.woff2': 'font/woff2', '.woff': 'font/woff',
  '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };
const DPR_LINE = 'DPR = Math.min(window.devicePixelRatio || 1, 2);';
function startServer() {
  return new Promise((resolve, reject) => {
    const srv = http.createServer((req, res) => {
      let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html';
      // the 2026-08 compositors (shot-feature.html, shot-caption.html) POST their canvas here
      if (req.method === 'POST' && p === '/shot') {
        const name = new URL(req.url, 'http://x').searchParams.get('name') || 'shot';
        let b = ''; req.on('data', d => { b += d; }); req.on('end', () => {
          const out = path.join(OUT, '..', path.basename(name) + '.png');
          fs.writeFileSync(out, Buffer.from(b.split(',')[1] || '', 'base64')); res.writeHead(200); res.end('ok');
        });
        return;
      }
      // …and they expect the repo root: /scripts/<plate>.png is a raw Play frame, /src/ is src/
      let base = SRC;
      if (p.startsWith('/scripts/') && p.endsWith('.png')) { base = path.join(OUT, 'play'); p = '/' + path.basename(p); }
      else if (p.startsWith('/scripts/')) { base = ROOT; }
      else if (p.startsWith('/src/')) { p = p.slice(4); }
      const file = path.join(base, path.normalize(p));
      if (!file.startsWith(base) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); return res.end('Not found'); }
      let body = fs.readFileSync(file);
      if (p === '/game/00-core.js') {
        const s = body.toString('utf8');
        if (!s.includes(DPR_LINE)) { console.error('FATAL: the DPR line moved in 00-core.js; the 3x size cannot be rendered'); process.exit(2); }
        body = Buffer.from(s.replace(DPR_LINE, 'DPR = window.__DPR || Math.min(window.devicePixelRatio || 1, 2);'));
      }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store', 'Content-Length': body.length });
      res.end(body);
    });
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => resolve(srv));
  });
}

const G = expr => `(() => { try { return (${expr}); } catch (e) { return '__err:' + (e && e.message || e); } })()`;

// ---------- the page: boot to the home menu with the clock in our hands ----------
// `crank` true = rAF is collected and fired by window.__crank(n) at exactly 1/60 s
// a frame, and there is NO AudioContext (a live one locks the game's clock to wall
// time). `crank` false = the page runs free, with sound — the video's audio pass.
function initScript({ dpr, crank, save }) {
  return `(() => {
    try { localStorage.setItem(${JSON.stringify(SAVE_KEY)}, ${JSON.stringify(JSON.stringify(save))}); localStorage.removeItem('warpVanguard.lastError'); } catch (e) {}
    window.__DPR = ${dpr};
    // the shells are chromeless: no fullscreen key on a store frame
    try { Object.defineProperty(navigator, 'standalone', { value: true, configurable: true }); } catch (e) {}
    if (${crank ? 'true' : 'false'}) {
      let q = [], t = 1000;
      window.requestAnimationFrame = f => { q.push(f); return q.length; };
      window.cancelAnimationFrame = () => {};
      // FLUSH EVERY FRAME. Canvas 2D records its draws and rasters them lazily; with no
      // compositor asking, 300 cranked frames pile up unrastered and the first
      // toDataURL pays for all of them at once (it looked like a hang). One snapshot
      // per frame makes each frame pay for itself.
      // A drawImage INTO a 1px canvas snapshots the source on the GPU. getImageData
      // would also do it, but a few readbacks flip the canvas to software raster
      // for good and a 1920x1080 frame then costs 350 ms.
      let tiny = null;
      const flush = () => { try { if (!tiny) { const c = document.createElement('canvas'); c.width = c.height = 1; tiny = c.getContext('2d'); } tiny.drawImage(document.getElementById('game'), 0, 0, 1, 1); } catch (e) {} };
      window.__crank = n => { for (let i = 0; i < n; i++) { t += 1000 / 60; const l = q; q = []; for (const f of l) f(t); flush(); } return t; };
      window.AudioContext = undefined; window.webkitAudioContext = undefined;
    }
  })();`;
}

// the save every frame is shot on: ONE player, so adjacent frames agree about them.
// Contract 1 done, contract 2 part flown, the rest open (open testing ships all free).
function storeSave(extra) {
  return {
    progress: Object.assign({
      tutorialDone: true, enlisted: true, stripBriefed: true, wallBriefed: true, lastCamp: 'survey',
      camp: {
        'cargo-run': { unlocked: 8, stars: [3, 3, 3, 2, 3, 3, 2, 3], bests: [] },
        'survey':    { unlocked: 5, stars: [3, 2, 3, 2], bests: [] },
      },
    }, extra || {}),
    identity: { id: 'store-shoot', autoName: 'Vanguard5E7A21', name: 'GIL', service: '', token: '' },
  };
}

async function openGame(size, { crank = true, save, dpr } = {}) {
  const S = Object.assign({}, SIZES[size], dpr ? { dpr } : {});
  const chrome = launchChrome(CDP_PORT, { headless: !ARG.headed, extraArgs: [`--window-size=${S.w},${S.h}`, '--force-device-scale-factor=1'] });
  await waitForPort(CDP_PORT);
  const { cdp } = await openPage(CDP_PORT);
  const errors = [];
  cdp.on('Runtime.exceptionThrown', p => { const d = p.exceptionDetails || {}; errors.push(String((d.exception && d.exception.description) || d.text).split('\n')[0]); });
  await cdp.send('Network.enable');
  await cdp.send('Network.setBlockedURLs', { urls: ARG.live ? [] : ['*supabase.co*'] });
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: S.w, height: S.h, deviceScaleFactor: S.dpr, mobile: false });
  await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: initScript({ dpr: S.dpr, crank, save: save || storeSave() }) });
  return { chrome, cdp, errors, S, crank };
}

async function bootToMenu(page, origin) {
  const { cdp, crank } = page;
  await cdp.send('Page.navigate', { url: origin + '/index.html' });
  const t0 = Date.now();
  for (;;) {
    if (await cdp.eval(G("typeof frame === 'function' && typeof startLevel === 'function' && typeof s3BreachReady === 'function'")) === true) break;
    if (Date.now() - t0 > 20000) throw new Error('the game never booted');
    await sleep(200);
  }
  // the device's safe area, as the shell would report it: set the variables resize() reads,
  // then make it read them (resize() returns early while the canvas size is unchanged)
  if (page.S.safe) {
    const sf = page.S.safe;
    const r = await cdp.eval(G(`(function(){ const st = document.documentElement.style; st.setProperty('--sal', '${sf.l}px'); st.setProperty('--sar', '${sf.r}px'); st.setProperty('--sat', '${sf.t}px'); st.setProperty('--sab', '${sf.b}px'); lastCw = -1; resize(); return SAFE.l + '/' + SAFE.r + '/' + SAFE.b; })()`));
    if (r !== sf.l + '/' + sf.r + '/' + sf.b) throw new Error('the safe area did not take: ' + r);
  }
  // fonts, then the hull bake. The bake is budgeted in REAL milliseconds and is
  // pumped from frameBody while the splash is on, so crank and breathe until done.
  await cdp.eval("document.fonts.load('700 46px Audiowide').then(() => document.fonts.load('600 20px Rajdhani')).then(() => document.fonts.ready).then(() => 1)");
  if (await cdp.eval(G("document.fonts.check('700 46px Audiowide') && document.fonts.check('600 20px Rajdhani')")) !== true) throw new Error('the fonts did not load — every frame would be in the fallback face');
  for (let i = 0; ; i++) {
    if (crank) await cdp.eval('__crank(2)');
    if (await cdp.eval(G('s3BreachReady() === true')) === true) break;
    if (i > 900) throw new Error('the hull bake never finished');
    await sleep(40);
  }
  // …and the REST of the station hardware (boss machines, destinations): the queue
  // is only pumped outside a live run, so drain it here or a boss is a grey disc.
  for (let i = 0; i < 400; i++) {
    const more = await cdp.eval(G("typeof s3Pump === 'function' ? !!s3Pump(120) : false"));
    if (more !== true) break;
    await sleep(5);
  }
  const bake = await cdp.eval(G("JSON.stringify({ blocked: s3Blocked, queued: typeof s3Queue !== 'undefined' ? s3Queue.length : -1, built: Object.keys(s3Sprites).length, fail: Object.keys(s3Sprites).filter(k => s3Sprites[k] === 'fail') })"));
  const b = JSON.parse(bake);
  if (b.blocked || b.fail.length) throw new Error('station bake unavailable: ' + bake);
  await cdp.eval(G('(splashEnd(true), 1)'));
  for (let i = 0; i < 200; i++) {
    if (crank) await cdp.eval('__crank(4)'); else await sleep(50);
    if (await cdp.eval(G("state === S.MENU && SPLASH.on === false")) === true) return b;
  }
  throw new Error('never reached the menu: state ' + await cdp.eval(G("state + '/' + menuScreen + '/' + SPLASH.on")));
}

async function grab(cdp, file) {
  // the canvas's own pixels: exactly the store's size, no compositor in between
  // …in slices: one 5 MB websocket message never arrives at Node's client
  const len = await cdp.eval("(window.__shot = document.getElementById('game').toDataURL('image/png').split(',')[1]).length");
  let b64 = '';
  for (let i = 0; i < len; i += 786432) b64 += await cdp.eval('__shot.slice(' + i + ', ' + (i + 786432) + ')');
  await cdp.eval('window.__shot = null, 1');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, Buffer.from(b64, 'base64'));
}

// ---------- a 2026-08 compositor page: open it, wait for READY in the title ----------
async function compose(origin, url) {
  const chrome = launchChrome(CDP_PORT, { headless: true, extraArgs: ['--window-size=1100,600'] });
  try {
    await waitForPort(CDP_PORT); const { cdp } = await openPage(CDP_PORT);
    await cdp.send('Page.navigate', { url: origin + url });
    for (let i = 0; i < 100; i++) { const t = await cdp.eval('document.title'); if (/^READY/.test(t)) return t; if (/^FAILED/.test(t)) throw new Error(t); await sleep(200); }
    throw new Error('the compositor never said READY');
  } finally { await killChrome(chrome); }
}

// ---------- one still ----------
async function shootStill(key, size, origin) {
  const sc = SCENES[key];
  const page = await openGame(size, { save: storeSave(sc.progress) });
  const { cdp, chrome, errors, S } = page;
  try {
    const bake = await bootToMenu(page, origin);
    const ctx = { size, w: S.w, h: S.h, kind: ARG.kind || null, camp: ARG.camp === undefined ? null : +ARG.camp, sel: ARG.sel === undefined ? null : +ARG.sel, variant: ARG.variant || null };
    const want = typeof sc.want === 'function' ? sc.want(ctx) : sc.want;
    const dbg = m => { if (ARG.debug) console.log('    · ' + m); };
    dbg('menu reached');
    if (sc.setup) { const r = await cdp.eval(G(`(function(){ ${sc.setup(ctx)} ; return 1; })()`)); if (r !== 1) throw new Error('setup: ' + r); }
    // real play under the autopilot first: it is what puts a history in the world
    await cdp.eval(`window.__auto = ${AUTO_SRC}; 1`);
    // in slices: a 1920x1080 frame costs real milliseconds, and one eval has 30 s
    const run = async (n, mode) => { for (let left = n; left > 0; left -= 20) await cdp.eval(`(() => { for (let i = 0; i < ${Math.min(20, left)}; i++) { __auto(${JSON.stringify(mode)}); __crank(1); } return 1; })()`); };
    dbg('setup done'); if (sc.warm) await run(sc.warm, 'play'); dbg('warm done');
    if (sc.stage) { const r = await cdp.eval(G(`(function(){ ${sc.stage(ctx)} ; return 1; })()`)); if (r !== 1) throw new Error('stage: ' + r); }
    dbg('staged'); if (sc.hold) await run(sc.hold, sc.auto || 'off'); dbg('held');
    if (sc.arm && !ARG.noarm) { const r = await cdp.eval(G(`(function(){ ${sc.arm(ctx)} ; return 1; })()`)); if (r !== 1) throw new Error('arm: ' + r); }
    dbg('armed'); let found = !want || !!ARG.nowant, scanned = 0;
    for (; want && !ARG.nowant && scanned < (sc.scan || 600); scanned++) {
      if (await cdp.eval(G(want)) === true) { found = true; break; }
      await run(1, sc.auto || 'off');
    }
    if (!found) throw new Error(`predicate never true after ${scanned} frames — ${await cdp.eval(G(STAT))}`);
    // FREEZE, THEN REPAINT. 99-boot's frame() honours globalThis.EDITOR_DRIVE (the Lane
    // Designer's hook): returning 0 holds the world and draws only. So the overlays are
    // cleared and the frame photographed is exactly the frame the predicate chose.
    await cdp.eval(G(`(function(){ globalThis.EDITOR_DRIVE = () => 0; ${sc.finish || ''}; if (typeof menuCache !== 'undefined') menuCache = null; return 1; })()`));
    if (sc.settle) await sleep(sc.settle);        // a real Image decode (the badge) needs real time
    await cdp.eval('__crank(1)');
    const file = path.join(OUT, size, `${sc.n}-${key}${ARG.tag ? '-' + ARG.tag : ''}.png`);
    await grab(cdp, file);
    console.log(`  SHOT  ${size}/${sc.n}-${key}.png  scan ${scanned}  bake ${bake.built}  ${await cdp.eval(G(STAT))}${errors.length ? '  ERRORS: ' + errors.join(' | ') : ''}`);
    if (errors.length) throw new Error('the page threw during the shot');
  } finally { await killChrome(chrome); }
}

const STAT = "'st' + state + '/' + menuScreen + ' T' + levelT.toFixed(1) + ' en' + enemies.filter(e => !e.dead).length + ' combo' + combo + ' score' + score + (boss ? ' boss:' + boss.kind + ' hp' + boss.hp + ' mode:' + boss.mode + ' beams' + boss.beams.filter(b => !b.done).length : '')";

// The still autopilot: NAMES A BEARING through nodes[].slew, never assigns an
// angle (41-geometry forbids the teleport). 'off' only keeps the run alive.
const AUTO_SRC = `function (mode) {
  if (state !== S.PLAY) return;
  if (integrity < 70) integrity = 100;
  if (mode === 'off' || !mode) return;
  const live = enemies.filter(e => !e.dead && !e.resolved && !e.failed && e.type !== 'strip').sort((a, b) => a.z - b.z);
  if (mode === 'dock') { const tgt = live[0] ? live[0].angle : nodes[0].angle; nodes[0].slew = tgt; nodes[1].slew = tgt; return; }
  if (boss && boss.introT >= BOSS_CER && boss.dying === undefined && mode === 'duel') {
    for (let i = 0; i < 2; i++) if (pulseCharge[i] >= PULSE_MAX && !(nodes[i].deadT > 0) && (boss.lamp < 0 || boss.lamp === i)) { firePulse(i); break; }
  }
  // purple armor wants BOTH emitters, a barrier wants one on each end
  const first = live[0];
  if (first && first.type === 'heavy') { nodes[0].slew = nodes[1].slew = first.angle; return; }
  if (first && first.type === 'line' && first.partner) { nodes[0].slew = first.angle; nodes[1].slew = first.partner.angle; return; }
  const taken = [];
  for (let i = 0; i < 2; i++) {
    const tgt = live.find(e => taken.indexOf(e) < 0 && e.type === 'normal' && (e.lock === undefined || e.lock === i));
    if (tgt) { taken.push(tgt); nodes[i].slew = tgt.angle; }
  }
  // A RAY HUNTS ONE EMITTER (its phase). That carriage runs ahead of its light.
  if (boss && boss.beams) for (const bm of boss.beams) {
    if (bm.done) continue;
    const n = nodes[bm.phase], lead = angDiff(n.angle, bm.a) * bm.dir;   // + = ahead of the sweep
    if (lead > -0.35 && lead < 1.0) n.slew = bm.a + bm.dir * 1.25;
  }
}`;

module.exports = { SIZES, startServer, openGame, bootToMenu, grab, G, sleep, killChrome, ROOT, OUT, ARG, storeSave, STAT };

if (require.main === module) (async () => {
  if (ARG.list) { for (const k in SCENES) console.log(`${SCENES[k].n}  ${k.padEnd(10)} ${SCENES[k].what}`); return; }
  if (ARG.video) { await require('./store-video.js').main(); return; }
  const srv = await startServer();
  const origin = 'http://127.0.0.1:' + srv.address().port;
  const keys = ARG.scene ? String(ARG.scene).split(',') : Object.keys(SCENES);
  const sizes = ARG.size ? String(ARG.size).split(',') : ['play', 'iphone', 'ipad'];
  let failed = 0;
  for (const size of sizes) for (const key of keys) {
    if (SCENES[key] && SCENES[key].only && SCENES[key].only !== size) continue;
    if (!SCENES[key]) { console.error('unknown scene ' + key); failed++; continue; }
    try { await shootStill(key, size, origin); } catch (e) { failed++; console.error(`  FAIL  ${size}/${key}: ${e.message}`); }
  }
  if (ARG.feature || (!ARG.scene && sizes.includes('play'))) { try { await compose(origin, '/scripts/shot-feature.html?src=00-feature&name=feature-graphic'); console.log('  COMPOSED docs/store/feature-graphic.png'); } catch (e) { failed++; console.error('  FAIL  feature graphic: ' + e.message); } }
  srv.close();
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
