'use strict';
// ---------- a tiny Chrome DevTools Protocol client, shared ----------
// Lifted out of scripts/bench.js on 2026-09-08 so the browser smoke suite
// (scripts/smoke.js) and the bench drive the same Chrome the same way.
//
// ZERO DEPENDENCIES. Node 22 ships a global WebSocket, which is the only thing
// a CDP client actually needs. That keeps the project's no-node_modules
// property — the puppeteer-core that the station-lab scripts once leaned on was
// never declared and quietly vanished from node_modules; this cannot.
//
// THE ONE TRICK. `eval` runs in the page's GLOBAL scope. A top-level `let` in a
// classic <script> is a global lexical binding — not a property of globalThis —
// but it IS visible to global evaluation, so `state`, `lowFX` and `SPLASH` are
// all readable (and assignable) by bare name even though `window.state` is not.
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');

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
    this.ws = ws; this.id = 0; this.pending = new Map(); this.listeners = new Map();
    ws.addEventListener('message', ev => {
      let msg; try { msg = JSON.parse(ev.data); } catch (e) { return; }
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.method + ': ' + msg.error.message));
        else resolve(msg.result);
      } else if (msg.method && this.listeners.has(msg.method)) {
        for (const fn of this.listeners.get(msg.method)) { try { fn(msg.params || {}); } catch (e) {} }
      }
    });
  }
  // events: cdp.on('Runtime.exceptionThrown', params => …) — after the domain is enabled
  on(method, fn) {
    if (!this.listeners.has(method)) this.listeners.set(method, []);
    this.listeners.get(method).push(fn);
    return this;
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
  close() { try { this.ws.close(); } catch (e) {} }
}

const CHROME_CANDIDATES = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser',
];

function findChrome() {
  if (process.env.CHROME_BIN && fs.existsSync(process.env.CHROME_BIN)) return process.env.CHROME_BIN;
  for (const p of CHROME_CANDIDATES) if (fs.existsSync(p)) return p;
  throw new Error('Chrome not found (set CHROME_BIN). Looked in:\n  ' + CHROME_CANDIDATES.join('\n  '));
}

// Launch a fresh Chrome with its own profile on a DevTools port. Returns the
// child process; kill it when done — the profile dir is under os.tmpdir().
function launchChrome(port, { headless = true, extraArgs = [] } = {}) {
  const bin = findChrome();
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'wv-cdp-'));
  const args = [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    '--autoplay-policy=no-user-gesture-required',   // the splash score needs no gesture
    '--no-first-run', '--no-default-browser-check',
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
    '--hide-scrollbars',
    ...extraArgs,
    'about:blank',
  ];
  if (headless) args.unshift('--headless=new');
  const proc = spawn(bin, args, { stdio: 'ignore', detached: false });
  // the profile dies with the process: a run used to leave ~75 MB in the temp dir
  proc.on('exit', () => { try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) {} });
  return proc;
}

// Stop a Chrome from launchChrome and WAIT for it to be gone, so the next launch
// on the same DevTools port cannot attach to the one still shutting down.
function killChrome(proc, ms = 5000) {
  return new Promise(resolve => {
    if (!proc || proc.exitCode !== null) return resolve();
    const t = setTimeout(() => { try { proc.kill('SIGKILL'); } catch (e) {} }, ms);
    proc.once('exit', () => { clearTimeout(t); resolve(); });
    try { proc.kill(); } catch (e) { clearTimeout(t); resolve(); }
  });
}

async function waitForPort(port, tries = 60) {
  for (let i = 0; i < tries; i++) {
    try { return await getJSON(`http://127.0.0.1:${port}/json/version`); }
    catch (e) { await sleep(250); }
  }
  throw new Error(`nothing answering on 127.0.0.1:${port}`);
}

// Attach to a page target on that port (reusing about:blank where one exists —
// on a phone we must not spawn tabs endlessly).
async function openPage(port) {
  const list = await getJSON(`http://127.0.0.1:${port}/json/list`);
  let page = list.find(t => t.type === 'page');
  if (!page) {
    await getJSON(`http://127.0.0.1:${port}/json/new?about:blank`).catch(() => {});
    await sleep(500);
    page = (await getJSON(`http://127.0.0.1:${port}/json/list`)).find(t => t.type === 'page');
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

module.exports = { CDP, getJSON, sleep, findChrome, launchChrome, killChrome, waitForPort, openPage };
