'use strict';
// THE BREACH LAB
//
//   npm run lab:breach   →   http://localhost:8013
//
// The enemy bodies, rebuilt as geometry. This is not a mock-up: the page lifts
// the game's own DEST-S3D region — the renderer, the materials and the three
// breach builds — and runs it in a scope holding nothing else, so what the lab
// shows is what the bake produces. If a build ever reaches for a game global it
// fails loudly here instead of drawing something subtly wrong.
//
// The lab writes nothing back yet. The pass is judged first; the port into
// drawEnemy follows the verdict.
const http = require('http');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const labDir = path.join(root, 'docs', 'breach-lab');
const fontDir = path.join(root, 'src', 'fonts');
const port = 8013;
const shotDir = path.join(labDir, 'shots');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2',
  '.png': 'image/png'
};

function send(res, code, type, body) {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(body);
}

// Pull the text between `// >>> NAME` and `// <<< NAME`. Throws loudly rather
// than returning something partial: a lab running on half a region draws a lie.
function region(src, name) {
  const open = src.indexOf('// >>> ' + name);
  const close = src.indexOf('// <<< ' + name);
  if (open < 0 || close < 0 || close < open) {
    throw new Error(`the game has no intact ${name} region — did the markers get edited out?`);
  }
  return src.slice(open, close);
}

// The game is authored as ordered files in src/game/, so a region is read out of
// the WHOLE concatenation. That way a region never goes half-missing because a
// file boundary moved under it.
const { gameSource } = require('./lib/game-source.js');
const readGame = () => gameSource(root);

// The one number the bake camera and the live painter must agree on. The lab
// reads it out of the game rather than repeating it, so a tuned squash cannot
// leave the lab showing a camera the game no longer uses.
function squash() {
  const src = fs.readFileSync(path.join(root, 'src', 'game', '41-geometry.js'), 'utf8');
  const m = src.match(/squash:\s*([0-9.]+)/);
  if (!m) throw new Error('ENEMYFX.squash is gone from 41-geometry.js');
  return parseFloat(m[1]);
}
// THE ZAP WINDOW, in radians either side of a node. `ARCFX.span` is the arc a
// node renders AND the tolerance it zaps within — visual is mechanic — so it is
// the number a body's drawn width has to be judged against. Read out of the game
// for the same reason as the squash: a lab holding its own copy is a lab that
// eventually measures against a rule the game no longer has.
function arcSpan() {
  const src = fs.readFileSync(path.join(root, 'src', 'game', '41-geometry.js'), 'utf8');
  const m = src.match(/span:\s*([0-9.]+)/);
  if (!m) throw new Error('ARCFX.span is gone from 41-geometry.js');
  return parseFloat(m[1]);
}

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent(req.url.split('?')[0]);

  if (urlPath === '/api/breach-src') {
    try {
      const src = readGame();
      return send(res, 200, TYPES['.json'], JSON.stringify({
        rng:  region(src, 'DEST-RNG'),
        data: region(src, 'DEST-DATA'),
        s3d:  region(src, 'DEST-S3D'),
        pick: region(src, 'DEST-S3D-PICK'),
        bore: region(src, 'BORE-PROJ'),
        squash: squash(),
        span: arcSpan()
      }));
    } catch (e) { return send(res, 500, 'text/plain', e.message); }
  }

  // The shot sink. The page bakes, draws one frame and POSTs its canvas here;
  // this writes the PNG so the art can be looked at without a person watching.
  if (urlPath === '/api/shot' && req.method === 'POST') {
    let body = '';
    req.on('data', c => { body += c; if (body.length > 4e7) req.destroy(); });
    req.on('end', () => {
      try {
        const name = (new URL(req.url, 'http://x').searchParams.get('name') || 'shot')
          .replace(/[^a-z0-9_-]/gi, '');
        const b64 = body.slice(body.indexOf(',') + 1);
        const out = path.join(shotDir, name + '.png');
        fs.mkdirSync(shotDir, { recursive: true });
        fs.writeFileSync(out, Buffer.from(b64, 'base64'));
        console.log('wrote ' + path.relative(root, out));
        send(res, 200, TYPES['.json'], '{"ok":true}');
      } catch (e) { send(res, 400, 'text/plain', e.message); }
    });
    return;
  }

  let filePath;
  if (urlPath.startsWith('/fonts/')) {
    filePath = path.join(fontDir, path.normalize(urlPath.slice(7)));
    if (!filePath.startsWith(fontDir)) return send(res, 403, 'text/plain', 'Forbidden');
  } else {
    filePath = path.join(labDir, path.normalize(urlPath === '/' ? '/index.html' : urlPath));
    if (!filePath.startsWith(labDir)) return send(res, 403, 'text/plain', 'Forbidden');
  }
  fs.readFile(filePath, (err, buf) => {
    if (err) return send(res, 404, 'text/plain', 'Not found');
    send(res, 200, TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream', buf);
  });
});

module.exports = { region, readGame, squash, arcSpan };

if (require.main === module) {
  server.listen(port, '127.0.0.1', () => {
    console.log(`Breach lab on http://localhost:${port}`);
    console.log('Reading DEST-S3D out of src/game/*.js — the three breach hulls live there.');
  });
}
