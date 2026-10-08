#!/usr/bin/env node
'use strict';
// ---------- BROWSER WATCH: every test browser an agent is running, live ----------
// Gil, 2026-10-08: "make a page that tracks your open testing browsers so i can see
// what's happening in real time". The smoke suite, the bench, the course bot and every
// scratch script an agent writes launch Chrome through scripts/lib/cdp.js, and each
// launch drops a small file in the registry (os.tmpdir()/wv-test-browsers, one per
// Chrome, removed when it exits). This page lists them and shows each one's screen.
//
// READ-ONLY. It opens a second DevTools client on each page, takes a JPEG of the
// screen and reads a few of the game's own globals (state, menu screen, the trial).
// It never clicks, types, navigates or writes, so a test cannot tell it is watched.
//
//   npm run browsers        # http://127.0.0.1:8017
const fs = require('fs');
const path = require('path');
const http = require('http');
const { CDP, getJSON, REGISTRY } = require('./lib/cdp.js');

const port = process.env.PORT || 8017;
const SHOT_EVERY = 600;   // ms: a browser's screen is captured at most this often
const ENDED_KEEP = 12;    // browsers that have closed, kept on the page as a short history

const live = new Map();   // pid -> { meta, cdp, shot, shotAt, status, busy }
const ended = [];         // { meta, endedAt, status }

const alive = pid => { try { process.kill(pid, 0); return true; } catch (e) { return false; } };
function readRegistry() {
  let files = [];
  try { files = fs.readdirSync(REGISTRY).filter(f => f.endsWith('.json')); } catch (e) {}
  const seen = new Set();
  for (const f of files) {
    let meta;
    try { meta = JSON.parse(fs.readFileSync(path.join(REGISTRY, f), 'utf8')); } catch (e) { continue; }
    if (!alive(meta.pid)) { try { fs.unlinkSync(path.join(REGISTRY, f)); } catch (e) {} continue; } // a crash left it behind
    seen.add(meta.pid);
    if (!live.has(meta.pid)) live.set(meta.pid, { meta, cdp: null, shot: null, shotAt: 0, status: null, busy: false });
  }
  for (const [pid, b] of live) {
    if (seen.has(pid)) continue;
    if (b.cdp) b.cdp.close();
    ended.unshift({ meta: b.meta, endedAt: Date.now(), status: b.status });
    ended.length = Math.min(ended.length, ENDED_KEEP);
    live.delete(pid);
  }
}
// one DevTools client per browser, on its first page target
async function attach(b) {
  if (b.cdp) return b.cdp;
  const list = await getJSON(`http://127.0.0.1:${b.meta.port}/json/list`);
  const page = list.find(t => t.type === 'page');
  if (!page) return null;
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.addEventListener('open', res, { once: true });
    ws.addEventListener('error', () => rej(new Error('ws')), { once: true });
  });
  ws.addEventListener('close', () => { b.cdp = null; });
  b.cdp = new CDP(ws);
  return b.cdp;
}
// what the game says about itself — every read guarded, so an old build or a blank
// page answers with nulls instead of an error
const STATUS = `(() => { const r = { url: location.pathname + location.search };
  try { r.state = Object.keys(S).find(k => S[k] === state) || null; } catch (e) {}
  try { r.screen = menuScreen; } catch (e) {}
  try { if (tut) { r.trial = tut.trial || 'course'; r.card = tut.qual ? tut.qual[tut.stage].card : null;
    r.call = tut.call ? tut.call.key : null; r.rewind = !!tut.rewind; r.misses = tut.misses || 0; } } catch (e) {}
  try { r.level = levelIdx >= 0 && CAMP ? CAMP.id + ':' + levelIdx : null; } catch (e) {}
  return JSON.stringify(r); })()`;
async function refresh(b) {
  if (b.busy || Date.now() - b.shotAt < SHOT_EVERY) return;
  b.busy = true;
  try {
    const cdp = await attach(b);
    if (!cdp) return;
    // a page mid-load can sit on a capture for the client's whole 30 s timeout; give up
    // after 3 s and attach afresh, or one slow boot freezes the card for half a minute
    const cap = cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 55 });
    const r = await Promise.race([cap, new Promise((_, rej) => setTimeout(() => rej(new Error('capture timed out')), 3000))]);
    b.shot = Buffer.from(r.data, 'base64'); b.shotAt = Date.now();
    try { b.status = JSON.parse(await cdp.eval(STATUS)); } catch (e) {}
  } catch (e) {
    if (!b.warned) { b.warned = true; console.error('browser ' + b.meta.pid + ': ' + e.message); }
    if (b.cdp) b.cdp.close(); b.cdp = null;
  } finally { b.busy = false; }
}
setInterval(() => { readRegistry(); for (const b of live.values()) refresh(b); }, 250);

const card = (m, extra) => Object.assign({
  pid: m.pid, script: m.script, args: m.args, worktree: path.basename(m.cwd || ''),
  headless: m.headless, size: m.size, started: m.started
}, extra);
const PAGE = fs.readFileSync(path.join(__dirname, 'browser-watch.html'), 'utf8');

http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/') { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(PAGE); return; }
  if (u.pathname === '/api/browsers') {
    const body = {
      now: Date.now(),
      live: [...live.values()].map(b => card(b.meta, { status: b.status, hasShot: !!b.shot, shotAt: b.shotAt })),
      ended: ended.map(e => card(e.meta, { status: e.status, endedAt: e.endedAt }))
    };
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(body)); return;
  }
  const m = /^\/shot\/(\d+)$/.exec(u.pathname);
  if (m) {
    const b = live.get(+m[1]);
    if (!b || !b.shot) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': 'image/jpeg', 'Cache-Control': 'no-store' }); res.end(b.shot); return;
  }
  res.writeHead(404); res.end('not found');
}).listen(port, '127.0.0.1', () => console.log(`browser watch: http://127.0.0.1:${port}  (registry ${REGISTRY})`));
