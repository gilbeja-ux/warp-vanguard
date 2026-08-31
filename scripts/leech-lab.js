#!/usr/bin/env node
'use strict';
// THE LEECH LAB
//
//   npm run lab:leech   →   http://localhost:8014
//
// The five boss machines, held still in the bore so they can be LOOKED AT.
// This is not a mock-up and not a diorama: the lab serves the real src/ tree,
// so what turns on screen is the game's own renderer, the game's own baked
// rings and the game's own boss code. The lab adds exactly one thing — a
// control strip that drops straight into a duel and pins the machine there.
//
// Why it exists: judging a boss meant playing seven lanes to reach one, and by
// then the fight is moving too fast to look at a rim. A still frame answers
// half the question; the other half is motion, and motion needs the real loop.
//
// The lab writes nothing back. Every knob it touches is a knob that already
// exists in the game — LCH_DECK for the crew deck, LEECH_LADDER for the rim
// hardware. Pick a look here, then move the number in the source.
const http = require('http');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', 'src');
const labDir = path.join(__dirname, '..', 'docs', 'leech-lab');
const port = process.env.PORT || 8014;

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4',
  '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.png': 'image/png', '.webp': 'image/webp',
  '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2'
};

http.createServer((req, res) => {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';

  // the lab's own panel, served alongside the game
  if (urlPath === '/leech-lab-panel.js') {
    const body = fs.readFileSync(path.join(labDir, 'panel.js'));
    res.writeHead(200, { 'Content-Type': TYPES['.js'], 'Cache-Control': 'no-store' });
    return res.end(body);
  }

  const filePath = path.join(root, path.normalize(urlPath));
  if (!filePath.startsWith(root)) { res.writeHead(403); return res.end('Forbidden'); }
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    res.writeHead(404); return res.end('Not found');
  }

  // index.html gets ONE extra script, appended after the game's own. It must
  // land after 81-station3d.js (LCH_DECK has to exist before it is tuned) and
  // before the first frame (the bake reads LCH_DECK once, on the menu).
  if (path.extname(filePath) === '.html') {
    let html = fs.readFileSync(filePath, 'utf8');
    html = html.replace('</body>', '<script src="/leech-lab-panel.js"></script>\n</body>');
    res.writeHead(200, { 'Content-Type': TYPES['.html'], 'Cache-Control': 'no-store' });
    return res.end(html);
  }

  const type = TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
  const total = fs.statSync(filePath).size;
  const headers = { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-store' };
  const range = req.headers.range;
  if (range) {
    const m = /bytes=(\d*)-(\d*)/.exec(range);
    let start = m && m[1] ? parseInt(m[1], 10) : 0;
    let end = m && m[2] ? parseInt(m[2], 10) : total - 1;
    if (isNaN(start) || start >= total) { res.writeHead(416, { 'Content-Range': `bytes */${total}` }); return res.end(); }
    if (end >= total) end = total - 1;
    res.writeHead(206, { ...headers, 'Content-Range': `bytes ${start}-${end}/${total}`, 'Content-Length': end - start + 1 });
    return fs.createReadStream(filePath, { start, end }).pipe(res);
  }
  res.writeHead(200, { ...headers, 'Content-Length': total });
  fs.createReadStream(filePath).pipe(res);
}).listen(port, () => {
  console.log('THE LEECH LAB  →  http://localhost:' + port);
  console.log('  1-5 pick a machine · SPACE lands a pulse · R resets · F freezes the spin · Z magnifies');
});
