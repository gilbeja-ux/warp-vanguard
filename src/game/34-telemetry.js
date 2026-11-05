'use strict';
// ---------- play statistics: first-party, small, never in the way (2026-11-05) ----------
// Gil asked for a traction portal: "downloads, users, playtimes, progress, OSes,
// and everything you can think of". The leaderboard could answer none of the
// middle three — it only ever saw the runs that posted a score — so the game now
// reports three kinds of row to its own Supabase project and to nobody else:
//
//   a SESSION  — one per app session: start, seconds on screen, platform, OS
//                version, device model, app version, locale
//   an ATTEMPT — one per stage attempt: mode, contract, stage index, result,
//                seconds flown, score, LANE ASSIST
//   an EVENT   — track(name, props): a fault the error net caught, a submit
//                outcome, and whatever the tutorial and paywall add later
//
// The server half is supabase/migrations/20261105000000_telemetry.sql, and the
// reader is the traction page on the admin console (scripts/admin.js, 8200).
//
// FOUR RULES THIS FILE KEEPS, AND npm test PINS EACH ONE:
//   1. IT NEVER TOUCHES THE SIM. It reads run state at the two ends of a run and
//      writes none. Ids come from crypto.randomUUID, never Math.random: the sim
//      owns that stream (campaign levels reseed it), and one stray draw would move
//      every board. The verifier bundles this file too; there it is inert.
//   2. IT NEVER BLOCKS OR SLOWS THE GAME. Nothing here runs per frame. Rows go to
//      a small localStorage queue; a flush is one async request, batched, on a
//      timer, at the end of a stage, and when the app is put away.
//   3. IT ONLY RUNS IN A REAL BUILD. A shipped shell, or a stamped build on a real
//      web host. A dev page (localhost, a LAN address, file://), an automated
//      browser (the smoke suite) and the headless harness send nothing. `?tel=1`
//      turns a dev page on to test the pipe, and its rows say channel 'dev'.
//   4. IT CARRIES NO IDENTIFIER OF ITS OWN. The rows ride the anonymous Supabase
//      session the leaderboard already uses (lbSession), and the server takes the
//      player id from that JWT. A device MODEL is a name millions of devices share;
//      no advertising id, device id or serial is ever read. MY DATA's delete
//      erases every row (the foreign key cascades from the auth user).
//
// The basis is the same legitimate interest privacy.html declares for the
// leaderboard, never consent: no prompt, no ATT, no third-party SDK.
const TEL = {
  on: false,                 // decided once, at boot, by telLive()
  key: 'warpVanguard.telemetry',
  cap: 300,                  // rows per queue; the oldest goes first past this
  maxAgeMs: 30 * 864e5,      // a row older than this is dropped unsent (the server takes 35 days)
  gapMs: 30 * 60e3,          // a hide longer than this ends the app session
  flushMs: 5 * 60e3,         // the foreground flush cadence
  soonMs: 4000,              // a stage's row lands about this long after its END
  batch: 300, finalBatch: 150, // rows per call; a keepalive request has a 64 KB ceiling
  timeout: 15000,
};
let telState = null;      // the persisted record: { v, off, cur, open, q: { s, a, e }, faultAt }
let telOpen = null;       // the attempt in flight, in memory
let telFgFrom = 0;        // when the current on-screen stretch began (0 while hidden)
let telHiddenAt = 0;      // when the app was put away (0 while on screen)
let telFlushing = false;
let telWaitUntil = 0;     // a server-side rate bar or a missing endpoint holds flushes until this
let telTimer = null, telSoonTimer = null;
let telWired = false;      // the lifecycle listeners go on once, whatever telSetOff does
const TEL_NAME = /^[a-z][a-z0-9_.]{1,39}$/;

// A v4 uuid from the platform's CSPRNG. Never Math.random (rule 1).
function telUuid() {
  try {
    const c = globalThis.crypto;
    if (c && typeof c.randomUUID === 'function') return c.randomUUID();
    if (c && typeof c.getRandomValues === 'function') {
      const b = new Uint8Array(16); c.getRandomValues(b);
      b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
      const h = Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
      return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20);
    }
  } catch (e) {}
  return null;
}
// a timer that never keeps a headless process alive (Node timers have unref; a
// browser's are numbers and need nothing)
function telLater(fn, ms) { const t = setTimeout(fn, ms); if (t && typeof t.unref === 'function') t.unref(); return t; }

// WHICH KIND OF BUILD THIS IS. Capacitor serves a shipped shell from
// https://localhost (Android) and capacitor://localhost (iOS), so the native test
// comes first; a shell with no version stamp is a developer's live-reload build.
function telChannel() {
  const stamped = !!(typeof window !== 'undefined' && window.__APP_VERSION);
  let native = false;
  try { native = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()); } catch (e) {}
  if (native) return stamped ? 'store' : 'dev';
  const loc = window.location || {};
  const host = String(loc.hostname || '');
  if (loc.protocol === 'file:' || !host) return 'dev';
  if (/^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1\]?$)/.test(host) || /\.(local|localhost|test)$/.test(host)) return 'dev';
  return stamped ? 'web' : 'dev';
}
function telLive() {
  try {
    if (typeof window === 'undefined' || typeof document === 'undefined' || !window.location) return false;
    if (typeof fetch === 'undefined' || typeof localStorage === 'undefined') return false;
    if (typeof LEADERBOARD === 'undefined' || !LEADERBOARD.enabled) return false;
    if (typeof navigator !== 'undefined' && navigator.webdriver) return false; // an automated browser is a test, never a player
    if (!telUuid()) return false;
    if (telChannel() === 'dev' && !/[?&]tel=1(&|$)/.test(String(window.location.search || ''))) return false;
    return true;
  } catch (e) { return false; }
}

// ---- the device, coarse on purpose ----
const telUa = () => (typeof navigator !== 'undefined' && navigator.userAgent) || '';
function telOs() {
  const ua = telUa();
  let m = /Android (\d+(?:\.\d+)?)/.exec(ua);
  if (m) return 'Android ' + m[1];
  m = /(?:iPhone|iPad|iPod)[^)]*? OS (\d+)_(\d+)/.exec(ua);
  if (m) return 'iOS ' + m[1] + '.' + m[2];
  // an iPad asking for desktop pages says Macintosh; the shell knows better
  if (/Macintosh/.test(ua) && storePlatform() === 'ios') return 'iPadOS';
  m = /Mac OS X (\d+)[_.](\d+)/.exec(ua);
  if (m) return 'macOS ' + m[1] + '.' + m[2];
  if (/Windows NT/.test(ua)) return 'Windows';
  if (/Linux/.test(ua)) return 'Linux';
  return '';
}
function telModelUa() {
  const ua = telUa();
  // the Android WebView still names the model ('SM-S928B Build/…'); reduced Chrome says 'K'
  const m = /Android [^;)]*;\s*([^;)]+?)\s+Build\//.exec(ua) || /Android [^;)]*;\s*([^;)]+?)\)/.exec(ua);
  if (m && m[1] !== 'K' && m[1] !== 'wv') return m[1].slice(0, 40);
  const i = /(iPhone|iPad|iPod)/.exec(ua);
  if (i) return i[1];
  if (/Macintosh/.test(ua) && storePlatform() === 'ios') return 'iPad';
  return '';
}
// Chromium's client hints answer the model a reduced UA hides. Async, asked once.
function telModelHint() {
  try {
    const d = navigator.userAgentData;
    if (!d || !d.getHighEntropyValues) return;
    d.getHighEntropyValues(['model']).then(v => {
      if (v && v.model && telState && telState.cur && !telState.cur.m) { telState.cur.m = String(v.model).slice(0, 40); telSave(); }
    }).catch(() => {});
  } catch (e) {}
}

// ---- the persisted record ----
function telBlank() { return { v: 1, off: false, cur: null, open: null, q: { s: [], a: [], e: [] }, faultAt: '' }; }
function telLoad() {
  try {
    const r = JSON.parse(localStorage.getItem(TEL.key) || 'null');
    if (r && r.v === 1 && r.q && Array.isArray(r.q.s) && Array.isArray(r.q.a) && Array.isArray(r.q.e)) return r;
  } catch (e) {}
  return telBlank();
}
function telSave() { try { if (telState) localStorage.setItem(TEL.key, JSON.stringify(telState)); } catch (e) {} }
function telPush(kind, row) {
  const q = telState.q[kind];
  q.push(row);
  const old = Date.now() - TEL.maxAgeMs;
  while (q.length && (q.length > TEL.cap || !(q[0].t > old))) q.shift();
  telSave();
}

// ---- the app session ----
function telNewSession() {
  return { id: telUuid(), t: Date.now(), fg: 0, p: storePlatform(), ch: telChannel(),
    os: telOs(), m: telModelUa(), v: String((window.__APP_VERSION) || '').slice(0, 16),
    l: String((typeof navigator !== 'undefined' && navigator.language) || '').slice(0, 16) };
}
// fold the on-screen time so far into the session, so a killed app keeps it
function telBank() {
  const c = telState && telState.cur;
  if (!c || !telFgFrom) return;
  const now = Date.now();
  c.fg = Math.min(86400, (c.fg || 0) + Math.max(0, (now - telFgFrom) / 1000));
  telFgFrom = now;
}
const telRow = c => Object.assign({}, c, { fg: Math.round(Math.min(86400, c.fg || 0)) });

// ---- a stage attempt ----
// telAttemptOpen runs FIRST in resetRun, where the caller has already chosen the
// next run (levelIdx, endless, weekly, qual) but the last run's numbers (score,
// levelT, assist, replaying) still stand. So it closes an unfinished attempt as a
// QUIT with its own numbers, then snapshots the mode of the one now beginning.
function telMode() {
  if (qual) return 'qual';
  if (weekly) return 'weekly';
  if (endless) return 'endless';
  return 'campaign';
}
function telAttemptOpen() {
  if (!TEL.on || !telState) return;
  try {
    if (telOpen) telAttemptClose('quit'); // a restart, or a new run over one never finished
    const mo = telMode();
    telOpen = { id: telUuid(), sid: telState.cur && telState.cur.id, t: Date.now(), mo,
      c: mo === 'campaign' && CAMP ? CAMP.id : null,
      li: mo === 'campaign' && Number.isInteger(levelIdx) && levelIdx >= 0 ? levelIdx : null,
      w: mo === 'weekly' && Number.isInteger(weeklyIdx) ? weeklyIdx : null };
  } catch (e) { telOpen = null; }
}
// the run's own numbers, read and never written
function telAttemptNumbers(a) {
  a.d = Math.round(Math.min(7200, Math.max(0, Number.isFinite(levelT) ? levelT : 0)) * 10) / 10;
  a.sc = Math.max(0, Math.floor(Number.isFinite(score) ? score : 0));
  a.as = !!assist;
  if (bossTestRun) a.mo = 'drill'; // the passcode boss drill is a tester's tool, never a player's attempt
  return a;
}
function telAttemptClose(result) {
  if (!TEL.on || !telOpen) return;
  try {
    const a = telOpen; telOpen = null;
    if (replaying) return;             // watching a run is not flying one
    a.r = result === 'clear' || result === 'fail' ? result : 'quit';
    telPush('a', telAttemptNumbers(a));
    telSoon();
  } catch (e) {}
}
// reseedReplay calls this right after it re-asserts `replaying`: the start call
// it made opened an attempt, and a replay is not one
function telAttemptDrop() { telOpen = null; }

// ---- track(name, props): the one door for named events ----
// name: a short dotted slug ('fault', 'submit', 'tutorial.part'). props: ONE flat
// object, at most twelve keys, each value a number, a boolean, null or a short
// string. Anything else is dropped here rather than refused by the server. Safe
// to call at any time: it answers false and does nothing when statistics are off.
function telProps(p) {
  const out = {};
  if (!p || typeof p !== 'object') return out;
  let n = 0;
  for (const k of Object.keys(p)) {
    if (n >= 12) break;
    if (!/^[a-z][a-z0-9_]{0,23}$/i.test(k)) continue;
    const v = p[k];
    if (typeof v === 'number') { if (!Number.isFinite(v)) continue; out[k] = Math.round(v * 1000) / 1000; }
    else if (typeof v === 'boolean' || v === null) out[k] = v;
    else if (typeof v === 'string') out[k] = v.slice(0, 64);
    else continue;
    n++;
  }
  while (JSON.stringify(out).length > 900) delete out[Object.keys(out).pop()];
  return out;
}
function track(name, props) {
  if (!TEL.on || !telState || telState.off) return false;
  if (typeof name !== 'string' || !TEL_NAME.test(name)) return false;
  try {
    telPush('e', { id: telUuid(), sid: telState.cur && telState.cur.id, t: Date.now(), n: name, pr: telProps(props) });
    telSoon(10000);
    return true;
  } catch (e) { return false; }
}

// A RANKED SUBMISSION'S OUTCOME (lbSubmit, 31-leaderboard.js). A refused score
// never writes a row anywhere, so this is the only count of verifier rejects and
// stale builds the developer gets. `why` is one of: ok · outdated · verify · rate
// · refused · offline · timeout. The board is named by its parts, never its key.
function telSubmit(run, status, why) {
  if (!run) return false;
  return track('submit', { mo: run.mode || '', c: run.campId || null,
    li: Number.isInteger(run.levelIdx) && run.levelIdx >= 0 ? run.levelIdx : null,
    w: run.mode === 'weekly' && Number.isInteger(run.seed) ? run.seed : null,
    st: status | 0, why: String(why || '') });
}

// ---- the flush ----
function telSoon(ms) {
  if (!TEL.on || telSoonTimer) return;
  telSoonTimer = telLater(() => { telSoonTimer = null; telFlush(false); }, ms || TEL.soonMs);
}
function telArm() {
  if (!TEL.on) return;
  if (telTimer) clearTimeout(telTimer);
  telTimer = telLater(() => { telTimer = null; if (!telHiddenAt) { telFlush(false); telArm(); } }, TEL.flushMs);
}
async function telFlush(final) {
  if (!TEL.on || !telState || telState.off || telFlushing) return false;
  if (Date.now() < telWaitUntil) return false;
  telBank();
  const q = telState.q, cap = final ? TEL.finalBatch : TEL.batch;
  const s = q.s.slice(0, 40).map(telRow);
  if (telState.cur) s.push(telRow(telState.cur)); // the live session rides every call; the server keeps the longest
  const a = q.a.slice(0, Math.max(0, cap - s.length));
  const e = q.e.slice(0, Math.max(0, cap - s.length - a.length));
  telSave();
  telFlushing = true;
  try {
    const token = await lbSession();
    if (!token) return false;
    const res = await lbFetch(LEADERBOARD.url + '/rest/v1/rpc/telemetry_ingest', {
      method: 'POST', keepalive: !!final,
      headers: { apikey: LEADERBOARD.key, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_batch: { s, a, e } })
    }, TEL.timeout);
    let d = null;
    try { d = res && typeof res.json === 'function' ? await res.json() : null; } catch (e2) { d = null; }
    if (res && res.ok && d && d.ok) {
      const sent = new Set(s.concat(a, e).map(r => r.id));
      q.s = q.s.filter(r => !sent.has(r.id));
      q.a = q.a.filter(r => !sent.has(r.id));
      q.e = q.e.filter(r => !sent.has(r.id));
      telSave();
      return true;
    }
    // a rate bar names its wait; a missing endpoint (before the migration is
    // pushed) or any other refusal holds the queue for an hour, and keeps it
    if (d && d.error === 'rate') telWaitUntil = Date.now() + Math.max(60, d.wait | 0) * 1000;
    else if (res && res.status >= 400 && res.status !== 401) telWaitUntil = Date.now() + 3600e3;
    return false;
  } catch (e) { return false; } // offline, or timed out: the rows wait in the queue
  finally { telFlushing = false; }
}

// ---- the app's own lifecycle ----
function telHide() {
  if (!TEL.on || telHiddenAt) return;
  telHiddenAt = Date.now();
  telBank(); telFgFrom = 0;
  // a killed app never comes back to close its stage, so the next launch does it
  try { telState.open = telOpen ? telAttemptNumbers(Object.assign({}, telOpen)) : null; } catch (e) { telState.open = null; }
  telSave();
  telFlush(true);
}
function telShow() {
  if (!TEL.on || !telHiddenAt) return;
  const away = Date.now() - telHiddenAt;
  telHiddenAt = 0;
  telState.open = null; // still alive: the attempt in memory is the truth again
  if (away > TEL.gapMs) { if (telState.cur) telPush('s', telRow(telState.cur)); telState.cur = telNewSession(); }
  telFgFrom = Date.now();
  telSave();
  telArm();
}
// A SYSTEM FAULT, COUNTED. The error net (99-boot.js) keeps its record in one
// localStorage slot, and the next feedback note carries the message (the
// 2026-09-06 decision). This sends a COUNT and nothing else: where it broke and
// which version, never the message, so the note stays the one place the words go.
function telFaultCheck() {
  try {
    const raw = localStorage.getItem(FB_ERROR_KEY);
    if (!raw) return;
    const r = JSON.parse(raw) || {};
    if (!r.at || r.at === telState.faultAt) return;
    telState.faultAt = r.at;
    track('fault', { where: String(r.where || '').slice(0, 24), ver: String(r.ver || '').slice(0, 16) });
  } catch (e) {}
}
function telBoot() {
  TEL.on = telLive();
  if (!TEL.on) return;
  telState = telLoad();
  if (telState.off) { TEL.on = false; return; }
  // the last launch's session and its unfinished stage, closed now
  if (telState.cur) telPush('s', telRow(telState.cur));
  if (telState.open) { const a = telState.open; a.r = 'quit'; telPush('a', a); }
  telState.open = null;
  telState.cur = telNewSession();
  telFgFrom = Date.now();
  telSave();
  telFaultCheck();
  telModelHint();
  if (!telWired) try {
    telWired = true;
    document.addEventListener('visibilitychange', () => { if (document.hidden) telHide(); else telShow(); });
    window.addEventListener('pagehide', telHide);
    const app = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App;
    if (app && typeof app.addListener === 'function') { app.addListener('pause', telHide); app.addListener('resume', telShow); }
  } catch (e) {}
  telSoon(8000);
  telArm();
}

// MY DATA's delete (lbForgetIdentity) calls this: rows still queued belong to the
// identity that was just erased, and flushing them would file them under the new one.
function telForget() {
  telOpen = null;
  if (!telState) return;
  telState.q = { s: [], a: [], e: [] };
  telState.open = null;
  if (TEL.on) { telState.cur = telNewSession(); telFgFrom = telHiddenAt ? 0 : Date.now(); }
  telSave();
}
// The objection switch (GDPR Art. 21). Off empties the queue and sends nothing
// again on this device; on starts a fresh session. No screen calls it yet.
function telSetOff(off) {
  if (!telState) telState = telLoad();
  telState.off = !!off;
  if (off) { telState.q = { s: [], a: [], e: [] }; telState.cur = null; telState.open = null; telOpen = null; TEL.on = false; telSave(); return; }
  telSave();
  telBoot();
}
const telIsOff = () => !!(telState && telState.off);

telBoot();
