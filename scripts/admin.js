#!/usr/bin/env node
// Admin console — the moderation queue with buttons on it.
//
//   npm run admin   →   http://localhost:8014
//
// NOT part of any build, never deployed, and deliberately not in docs/ (that
// folder is published by GitHub Pages — see docs/privacy.html). It is the same
// shape as the story/dest/tuning labs: a small local server and one page.
//
// WHY THIS EXISTS AT ALL. `report_queue` made the reports readable in the Supabase
// dashboard, but reading is not answering: acting on one meant copying a uuid into
// the SQL editor and typing a function call, every time, for every report. That is
// a query console, not a flow. The obligation the stores actually impose is to ACT
// on reports, and a tool you avoid using is one you will not act through.
//
// THE SERVICE KEY NEVER REACHES THE BROWSER. The page talks only to this process;
// this process talks to Supabase. That is also why it binds to 127.0.0.1 and not
// 0.0.0.0 like scripts/serve.js does — serve.js hands out the game over the LAN on
// purpose, and this must never be reachable the same way.
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const root = path.join(__dirname, '..');
const page = path.join(__dirname, 'admin.html');
// 8014: 8000 is the game, 8010 the story lab, 8011 destinations, 8012 the tuning
// board, 8013 the disc lab. They all live in open browser tabs — never take one.
const port = process.env.PORT || 8014;

// ONE SOURCE OF TRUTH FOR WHICH PROJECT THIS IS. Parsed out of the game rather
// than pasted here, so a project move cannot leave the admin tool quietly pointed
// at the old database while the game talks to the new one.
const SB_URL = (() => {
  const src = fs.readFileSync(path.join(root, 'src', 'game', '31-leaderboard.js'), 'utf8');
  const m = /url:\s*'(https:\/\/[a-z0-9]+\.supabase\.co)'/.exec(src);
  if (!m) throw new Error('could not find the Supabase url in src/game/31-leaderboard.js');
  return m[1];
})();
const PROJECT_REF = /https:\/\/([a-z0-9]+)\./.exec(SB_URL)[1];

// The key: an env var if you set one, otherwise straight from the linked CLI —
// which is already logged in, so there is nothing to configure and no secret to
// leave lying in a file for someone to commit later.
const KEY = (() => {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) return process.env.SUPABASE_SERVICE_ROLE_KEY.trim();
  try {
    const out = execFileSync('supabase', ['projects', 'api-keys', '--project-ref', PROJECT_REF, '-o', 'json'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    const k = JSON.parse(out).find(r => r.name === 'service_role');
    if (k && k.api_key) return k.api_key;
  } catch (e) { /* fall through to the message below */ }
  console.error('\n  Could not get the service_role key.\n'
    + '  Either log the Supabase CLI in (`supabase login`) or set SUPABASE_SERVICE_ROLE_KEY.\n');
  process.exit(1);
})();

const H = { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' };
const sb = (p, opts) => fetch(SB_URL + '/rest/v1/' + p, { ...opts, headers: { ...H, ...(opts && opts.headers) } });

async function readAll() {
  const get = async (v, q) => {
    const r = await sb(v + (q || ''));
    if (!r.ok) return { error: (await r.text()).slice(0, 200) };
    return r.json();
  };
  const [overview, queue, boards, ladder, growth, feedback] = await Promise.all([
    get('admin_overview', '?select=*'),
    get('report_queue', '?select=*&order=open_reports.desc,last_report.desc'),
    get('board_occupancy', '?select=*&order=last_entry.desc'),
    get('ladder_reach', '?select=*&order=campaign.asc,level.asc'),
    get('player_growth', '?select=*&order=week.desc&limit=12'),
    // OPEN FIRST, THEN NEWEST. Same ordering law as the report queue: the queue is
    // what still needs a human, and everything handled folds away beneath it.
    // Capped, because unlike reports nothing evicts a note — the cap is what keeps
    // a year of them from arriving in one response. purge_old_feedback() is the
    // other half of that; see the migration.
    get('feedback_queue', '?select=*&order=open.desc,created_at.desc&limit=200'),
  ]);
  return { overview: Array.isArray(overview) ? overview[0] : overview, queue, boards, ladder, growth, feedback };
}

// Every verb the page's buttons map onto. All but `delete` go through the SQL
// functions, so the console and the dashboard runbook do literally the same thing
// — one implementation, two front doors. Each of them also stamps handled_at, so
// acting on a report always closes it; there is no path that changes a name and
// leaves its report looking untouched.
//
// `all` means "every entry this player holds" rather than just the reported one.
// The handle is denormalized onto every row, so for a genuinely bad NAME the
// single-row verbs are whack-a-mole — the same string is still on their other
// boards, and the next report arrives tomorrow from one of them.
const RPC = {
  moderate:  (id, o) => [o.all ? 'moderate_player' : 'moderate_name', { p_run: id }],
  // FEEDBACK. `Handled` is the only verb a note normally needs — it is not a
  // report about somebody, so there is nothing to redact, dismiss or release. The
  // id argument is the note's, not a run's; the uuid guard in act() fits both.
  fbHandled: (id)    => ['mark_feedback_handled', { p_id: id }],
  rename:    (id, o) => ['rename_entry',     { p_run: id, p_name: o.name, p_all: !!o.all }],
  reset:     (id, o) => ['reset_entry_name', { p_run: id, p_all: !!o.all }],
  dismiss:   (id)    => ['dismiss_reports',  { p_run: id }],
  release:   (id)    => ['release_name',     { p_run: id }],
};

async function act(action, runId, opts) {
  if (!/^[0-9a-f-]{36}$/i.test(runId || '')) throw new Error('bad run id');
  if (action === 'delete') { // the whole entry; its reports and trace cascade
    const r = await sb('runs?id=eq.' + runId, { method: 'DELETE' });
    if (!r.ok) throw new Error((await r.text()).slice(0, 200));
    return { message: 'entry deleted' };
  }
  // A note is deleted outright rather than moderated. There is no name on it to
  // neutralise and nobody but this console ever reads it, so the only reasons to
  // reach for this are abuse aimed at the developer and a note already dealt with.
  if (action === 'fbDelete') {
    const r = await sb('feedback?id=eq.' + runId, { method: 'DELETE' });
    if (!r.ok) throw new Error((await r.text()).slice(0, 200));
    return { message: 'note deleted' };
  }
  const build = RPC[action];
  if (!build) throw new Error('unknown action');
  const [fn, args] = build(runId, opts || {});
  const r = await sb('rpc/' + fn, { method: 'POST', body: JSON.stringify(args) });
  if (!r.ok) throw new Error((await r.text()).slice(0, 200));
  return { message: await r.json() };
}

// ---------------------------------------------------------------------------
// AUTH. Binding to 127.0.0.1 keeps this off the LAN, but it does NOT keep it away
// from the browser: any page open in any tab can POST to http://localhost:8014,
// and /api/act holds the service key and deletes rows. So every request carries a
// per-process token that only the page this process served can know.
//
// The token is a HEADER, not a cookie or a form field, and that choice is the
// whole defence. A cross-origin <form> cannot set a custom header at all, and a
// cross-origin fetch that tries to set one must first pass a CORS preflight —
// which this server answers for nothing. There is no Access-Control-Allow-* here
// on purpose: a foreign page cannot read our replies even if it does reach us.
//
// The Host check is the second half. A DNS-rebinding attack resolves an attacker
// domain to 127.0.0.1 to make its own origin same-origin with us; the connection
// still arrives with THEIR hostname in Host, so we refuse anything that is not a
// loopback name. Fresh token per start — nothing to leak into a file, nothing to
// commit, and a restarted console invalidates every stale tab.
const TOKEN = crypto.randomBytes(24).toString('hex');
const HOST_OK = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;

// timing-safe, and safe on a length mismatch — timingSafeEqual THROWS on unequal
// buffer lengths, so the length is compared first and a short guess is rejected
// before it can raise.
function tokenOk(v) {
  const got = Buffer.from(String(v || ''));
  const want = Buffer.from(TOKEN);
  return got.length === want.length && crypto.timingSafeEqual(got, want);
}

// One gate for both API routes. The page itself is served without a token — it has
// to be, it is what carries the token — and it holds no data of its own.
function authed(req) {
  return HOST_OK.test(req.headers.host || '') && tokenOk(req.headers['x-admin-token']);
}

// Two statements, not `writeHead(...) || end(...)`. writeHead RETURNS the response
// object, which is truthy, so the `||` short-circuits and end() never runs: the
// socket connects, the request is accepted, and nothing is ever sent back. It
// looks like a network problem and it is a typo. scripts/lab.js has always
// written this as two lines; there was no reason to deviate.
function send(res, code, type, body) {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(body);
}

http.createServer(async (req, res) => {
  const url = req.url.split('?')[0];
  try {
    if (url === '/' ) {
      if (!HOST_OK.test(req.headers.host || '')) return send(res, 403, 'text/plain', 'forbidden');
      // The one place the token crosses into the browser. Stamped per response, so
      // the page a tab is holding is always the token this process is checking.
      return send(res, 200, 'text/html; charset=utf-8',
        fs.readFileSync(page, 'utf8').replace('__ADMIN_TOKEN__', TOKEN));
    }
    if (!authed(req)) return send(res, 403, 'application/json', JSON.stringify({ error: 'forbidden — reload http://localhost:' + port }));
    if (url === '/api/data') return send(res, 200, 'application/json', JSON.stringify(await readAll()));
    if (url === '/api/act' && req.method === 'POST') {
      let body = '';
      for await (const c of req) body += c;
      const { action, runId, ...opts } = JSON.parse(body || '{}');
      return send(res, 200, 'application/json', JSON.stringify(await act(action, runId, opts)));
    }
    send(res, 404, 'text/plain', 'not found');
  } catch (e) {
    send(res, 500, 'application/json', JSON.stringify({ error: String(e.message || e) }));
  }
}).listen(port, '127.0.0.1', () => {
  console.log(`\n  Admin console  →  http://localhost:${port}`);
  console.log(`  project ${PROJECT_REF} · service key held in this process only`);
  console.log(`  localhost only, token-gated — a reload is needed after any restart.\n`);
});
