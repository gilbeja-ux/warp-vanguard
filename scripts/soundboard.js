#!/usr/bin/env node
// The sfx soundboard's server (dev only). Serves the REPO ROOT on 8012 so the board
// at scripts/soundboard.html can lift the real game out of src/index.html, the way
// the shot harnesses do — the cues play through the game's own bus, compressor and
// limiter, not a copy. `/` opens the board. Range requests are not needed: sfx are
// fetched whole and decoded.
//   npm run lab:sound   →   http://localhost:8012/   (LAN: http://<mac-ip>:8012/)
const http = require('http');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const port = process.env.PORT || 8012;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json',
  '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.wav': 'audio/wav', '.ogg': 'audio/ogg',
  '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };

// ---- THE ORDER · the one thing this server writes ----------------------------
// The board is a web page, so it cannot put a file in the repo by itself. These
// two routes are the whole link between Gil's ear and my next edit:
//   GET  /__incoming  → what is sitting in src/audio/sfx/incoming/ right now
//   GET  /__order     → the order as last saved
//   POST /__order     → save it to docs/sfx-order.json
// Nothing else is writable, and nothing here ships — scripts/ is dev only.
const INCOMING = path.join(root, 'src/audio/sfx/incoming');
const ORDER = path.join(root, 'docs/sfx-order.json');
const AUDIO_EXT = ['.wav', '.mp3', '.m4a', '.ogg'];
function serveJSON(res, obj, code) {
  res.writeHead(code || 200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(obj));
}

http.createServer((req, res) => {
  let u = decodeURIComponent(req.url.split('?')[0]);
  if (u === '/') u = '/scripts/soundboard.html';
  if (u === '/__incoming') {
    let files = [];
    try {
      files = fs.readdirSync(INCOMING)
        .filter(n => AUDIO_EXT.includes(path.extname(n).toLowerCase()))
        .sort();
    } catch (e) {} // no folder yet is not an error — it just means nothing is dropped
    return serveJSON(res, { files });
  }
  if (u === '/__order' && req.method === 'GET') {
    try { return serveJSON(res, JSON.parse(fs.readFileSync(ORDER, 'utf8'))); }
    catch (e) { return serveJSON(res, { picks: {} }); }
  }
  if (u === '/__order' && req.method === 'POST') {
    let body = '';
    req.on('data', c => { body += c; if (body.length > 1e6) req.destroy(); });
    req.on('end', () => {
      let o;
      try { o = JSON.parse(body); } catch (e) { return serveJSON(res, { ok: false, err: 'bad json' }, 400); }
      o.saved = new Date().toISOString();
      try {
        fs.mkdirSync(path.dirname(ORDER), { recursive: true });
        fs.writeFileSync(ORDER, JSON.stringify(o, null, 2) + '\n');
      } catch (e) { return serveJSON(res, { ok: false, err: e.message }, 500); }
      const n = Object.keys(o.picks || {}).length;
      console.log('order saved: ' + n + ' pick' + (n === 1 ? '' : 's') + ' → docs/sfx-order.json');
      return serveJSON(res, { ok: true, saved: o.saved, n });
    });
    return;
  }
  const f = path.join(root, path.normalize(u));
  if (!f.startsWith(root)) { res.writeHead(403); return res.end(); }
  fs.readFile(f, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(f).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  });
}).listen(port, '0.0.0.0', () => console.log('soundboard: http://localhost:' + port + '/'));
