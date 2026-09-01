#!/usr/bin/env node
// Portal — one page that says which local tools are up, and what state the
// project is in.
//
//   npm run portal   →   http://localhost:8015
//
// WHY IT IS LOCAL AND STAYS LOCAL. Two of the things it points at cannot be
// hosted: the admin console holds the service_role key (which bypasses RLS on
// everything), and the story/dest/tuning/disc labs read and WRITE files in this
// checkout — story.json, campaigns.js, dest-tuning.json. A hosted copy would need
// an auth system to protect the first and would be staring at files that do not
// exist for the rest. There is nothing to gain and a key to lose.
//
// The health check runs HERE, not in the browser: each lab serves its own origin
// with no CORS headers, so a page on :8015 cannot see whether :8010 answered — it
// can only watch a request fail, which looks identical to the server being down.
// Node has no such restriction.
const http = require('http');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const page = path.join(__dirname, 'portal.html');
const port = process.env.PORT || 8015;

// Every long-lived local server, in one list. Gil keeps these in browser tabs for
// whole sessions — see the ports note in .claude/skills/dev-servers/SKILL.md.
const SERVERS = [
  { port: 8000, name: 'Game',              cmd: 'npm run dev',      what: 'the game itself, served from src/ — also the LAN address for phone testing' },
  { port: 8000, name: 'Lane Designer',     cmd: 'npm run dev',      path: 'editor.html',
    what: 'the campaign editor: tunnel beats, bands and story cards, driving the real engine' },
  { port: 8010, name: 'Story lab',         cmd: 'npm run lab',      what: 'the campaign screenplay: briefing discs, radio barks, mission text' },
  { port: 8011, name: 'Destinations lab',  cmd: 'npm run lab:dest', what: 'the sky at each relay — suns, moons, planets, deep field' },
  { port: 8012, name: 'Tuning board',      cmd: 'npm run lab:tune', what: 'difficulty and feel knobs, live against the running sim' },
  { port: 8013, name: 'Disc lab',          cmd: 'npm run lab:disc', what: 'briefing-disc art and layout' },
  { port: 8014, name: 'Admin console',     cmd: 'npm run admin',    what: 'leaderboard moderation queue and the numbers' },
];

// A server is UP if it answers at all. Not "answers 200": the tuning board and the
// labs return different things at /, and a 404 from a live server is still a live
// server. What we are distinguishing is answered-vs-refused.
//
// A row with a `path` is the exception. The Lane Designer has no server of its own
// — it is a page on the game dev server — so the thing that can go missing is the
// page, not the port. There a 404 means down.
async function ping(p, pagePath) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 1200);
  try {
    const r = await fetch('http://127.0.0.1:' + p + '/' + (pagePath || ''), { signal: ac.signal });
    return { up: pagePath ? r.status < 400 : true, status: r.status };
  } catch { return { up: false }; }
  finally { clearTimeout(t); }
}

// THE SILENT KILLER, SURFACED. Change the sim, forget to redeploy, and the server
// replays every submission against the old rules and rejects the lot — in-game
// that reads as "verification failed", which looks like a scoring bug and is not
// one. It has cost this project two debugging sessions. Same mtime comparison
// scripts/build.js does, so the portal and the build agree.
function verifierState() {
  const simPath = path.join(root, 'supabase', 'functions', 'submit-run', '_sim.mjs');
  if (!fs.existsSync(simPath)) return { known: false, reason: 'no bundle built yet' };
  const built = fs.statSync(simPath).mtimeMs;
  const gameDir = path.join(root, 'src', 'game');
  const watched = ['src/campaigns.js'].concat(
    fs.existsSync(gameDir) ? fs.readdirSync(gameDir).filter(f => f.endsWith('.js')).map(f => 'src/game/' + f) : []);
  const stale = watched.filter(f => {
    const fp = path.join(root, f);
    return fs.existsSync(fp) && fs.statSync(fp).mtimeMs > built;
  });
  let local = null;
  try { local = require('./lib/sim-id.js').simId(root); } catch (e) {}
  return { known: true, stale, local };
}

// If the admin console is up, borrow its numbers rather than opening a second
// connection to Supabase — this process deliberately holds no service key.
async function adminSummary(up) {
  if (!up) return null;
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 2500);
  try {
    const r = await fetch('http://127.0.0.1:8014/api/data', { signal: ac.signal });
    const d = await r.json();
    if (!d.overview) return null;
    // `feedback_open` is counted HERE rather than added to the admin_overview view.
    // The console already fetched the queue, so the number is free — and that view
    // is defined in migrations/ and corrected in two more, which is exactly the
    // drift this project keeps warning itself about. One more copy of it, for one
    // integer, is a bad trade.
    return { ...d.overview, feedback_open: Array.isArray(d.feedback) ? d.feedback.filter(x => x.open).length : 0 };
  } catch { return null; }
  finally { clearTimeout(t); }
}

function send(res, code, type, body) {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(body);
}

http.createServer(async (req, res) => {
  const url = req.url.split('?')[0];
  try {
    if (url === '/') return send(res, 200, 'text/html; charset=utf-8', fs.readFileSync(page));
    // The GB mark, read from the game's own icon set rather than copied here, so
    // there is one file to change if the logo ever changes.
    if (url === '/favicon.png') {
      const ico = path.join(root, 'src', 'icons', 'gb-logo.png');
      if (!fs.existsSync(ico)) return send(res, 404, 'text/plain', 'no logo');
      return send(res, 200, 'image/png', fs.readFileSync(ico));
    }
    if (url === '/api/status') {
      const pings = await Promise.all(SERVERS.map(s => ping(s.port, s.path)));
      const servers = SERVERS.map((s, i) => ({ ...s, ...pings[i] }));
      const admin = await adminSummary(servers.find(s => s.port === 8014).up);
      return send(res, 200, 'application/json',
        JSON.stringify({ servers, verifier: verifierState(), admin, self: port }));
    }
    send(res, 404, 'text/plain', 'not found');
  } catch (e) {
    send(res, 500, 'application/json', JSON.stringify({ error: String(e.message || e) }));
  }
}).listen(port, '127.0.0.1', () => {
  console.log(`\n  Portal  →  http://localhost:${port}`);
  console.log(`  localhost only. Holds no keys — the admin console keeps its own.\n`);
});
