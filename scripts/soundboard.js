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
  '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.wav': 'audio/wav', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };
http.createServer((req, res) => {
  let u = decodeURIComponent(req.url.split('?')[0]);
  if (u === '/') u = '/scripts/soundboard.html';
  const f = path.join(root, path.normalize(u));
  if (!f.startsWith(root)) { res.writeHead(403); return res.end(); }
  fs.readFile(f, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(f).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  });
}).listen(port, '0.0.0.0', () => console.log('soundboard: http://localhost:' + port + '/'));
