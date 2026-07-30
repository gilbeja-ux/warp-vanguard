#!/usr/bin/env node
// Story lab server — desktop-only writing tool for the campaign screenplay.
// NOT part of the store build. Serves docs/lab/ and persists the working copy
// to docs/lab/story.json so Claude can read what you wrote from the repo.
//
//   npm run lab   →   http://localhost:8010
//
// story.json is yours. It is created from seed.json on first run and never
// overwritten from the seed again; every save keeps the previous version at
// story.json.bak.
const http = require('http');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const labDir = path.join(root, 'docs', 'lab');
const fontDir = path.join(root, 'src', 'fonts');
const storyPath = path.join(labDir, 'story.json');
const seedPath = path.join(labDir, 'seed.json');
const port = process.env.PORT || 8010;

// the reference column's shelf — whitelisted, never a path from the client
const DOCS = {
  screenplay: 'SCREENPLAY.md',
  plan: 'SCREENPLAY-PLAN.md',
  voice: 'IN-RUN-VOICE.md',
  art: 'DISC-ART-SPEC.md'
};

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
  '.svg': 'image/svg+xml'
};

function send(res, code, type, body) {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(body);
}

function readStory() {
  if (!fs.existsSync(storyPath)) {
    if (!fs.existsSync(seedPath)) throw new Error('no seed — run: node scripts/lab-seed.js');
    fs.copyFileSync(seedPath, storyPath);
    console.log('seeded docs/lab/story.json');
  }
  return fs.readFileSync(storyPath, 'utf8');
}

function writeStory(body) {
  JSON.parse(body); // reject anything that would leave the file unloadable
  if (fs.existsSync(storyPath)) fs.copyFileSync(storyPath, storyPath + '.bak');
  const tmp = storyPath + '.tmp';
  fs.writeFileSync(tmp, body);
  fs.renameSync(tmp, storyPath); // atomic — a crash mid-write can't truncate the story
}

http.createServer((req, res) => {
  const urlPath = decodeURIComponent(req.url.split('?')[0]);

  if (urlPath === '/api/story') {
    if (req.method === 'GET') {
      try { return send(res, 200, TYPES['.json'], readStory()); }
      catch (e) { return send(res, 500, 'text/plain', e.message); }
    }
    if (req.method === 'PUT') {
      let body = '';
      req.on('data', c => { body += c; if (body.length > 8e6) req.destroy(); });
      req.on('end', () => {
        try { writeStory(body); send(res, 200, TYPES['.json'], '{"ok":true}'); }
        catch (e) { send(res, 400, 'text/plain', e.message); }
      });
      return;
    }
    return send(res, 405, 'text/plain', 'Method not allowed');
  }

  // reference docs, read-only, whitelisted — the narrative record the lab
  // writes against. Served raw; the client renders the markdown.
  if (urlPath === '/api/doc') {
    const name = (req.url.split('?')[1] || '').replace(/^name=/, '');
    const file = DOCS[name];
    if (!file) return send(res, 404, 'text/plain', 'unknown doc');
    return fs.readFile(path.join(root, 'docs', file), 'utf8', (err, txt) =>
      err ? send(res, 404, 'text/plain', 'missing ' + file)
          : send(res, 200, 'text/markdown; charset=utf-8', txt));
  }

  // static: docs/lab/, plus the game's own Audiowide from src/fonts/
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
}).listen(port, '127.0.0.1', () => {
  console.log(`Story lab on http://localhost:${port}`);
  console.log(`Writing to docs/lab/story.json`);
});
