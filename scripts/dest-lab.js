#!/usr/bin/env node
// DESTINATIONS LAB — desktop-only tuning tool for the things at the ends of lanes.
// NOT part of the store build.
//
//   npm run lab:dest   →   http://localhost:8011
//
// This is not a mock-up of the destinations. The lab lifts three marked regions
// out of src/index.html — the data tables, the planet pixel shader, and the
// vector art — and runs them in the browser exactly as the game does. What you
// see is the game's own renderer; what you move is the game's own numbers.
//
// Writing back is SURGICAL. It never regenerates the block: it finds each key's
// literal inside the DEST-DATA region and swaps only that literal, so every
// comment, every alignment and every line of reasoning in that region survives a
// round-trip. src/index.html.bak holds the previous version after each write.
const http = require('http');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const labDir = path.join(root, 'docs', 'dest-lab');
const fontDir = path.join(root, 'src', 'fonts');
const gamePath = path.join(root, 'src', 'index.html');
const workPath = path.join(labDir, 'dest-tuning.json'); // the working copy, for crash recovery
const port = process.env.PORT || 8011;

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

// ---------- reading the game ----------

// Pull the text between `// >>> NAME` and `// <<< NAME`. Throws loudly rather
// than returning something partial: a lab running on half a region would show
// art that does not exist.
function region(src, name) {
  const open = src.indexOf('// >>> ' + name);
  const close = src.indexOf('// <<< ' + name);
  if (open < 0 || close < 0 || close < open) {
    throw new Error(`src/index.html has no intact ${name} region — did the markers get edited out?`);
  }
  return src.slice(src.indexOf('\n', open) + 1, close);
}

function readGame() {
  return fs.readFileSync(gamePath, 'utf8');
}

// ---------- writing the game ----------

// One literal, formatted the way the source already writes them: numbers keep
// their meaning without trailing float noise, arrays stay on one line.
function lit(v) {
  if (Array.isArray(v)) return '[' + v.map(lit).join(', ') + ']';
  if (typeof v === 'string') return "'" + v.replace(/'/g, "\\'") + "'";
  if (typeof v === 'number') {
    if (Number.isInteger(v)) return String(v);
    return String(Math.round(v * 1e6) / 1e6);
  }
  return JSON.stringify(v);
}

// The inverse of lit(), for comparing what the source says against what the lab
// holds without caring how the number was typed.
function unlit(text) {
  const t = text.trim();
  if (t[0] === '[') return JSON.stringify(JSON.parse(t));
  if (t[0] === "'") return JSON.stringify(t.slice(1, -1).replace(/\\'/g, "'"));
  return JSON.stringify(Number(t));
}

const KEY_VAL = key =>
  new RegExp('(\\b' + key + '\\s*:\\s*)(\\[[^\\]]*\\]|\'[^\']*\'|-?\\d*\\.?\\d+)');

// Where a line's code ends and its trailing comment begins. Needed twice below,
// and for the same reason both times: the comments in DEST-DATA are prose, and
// prose contains apostrophes and colons that would otherwise read as syntax.
function codeEnd(line) {
  let inStr = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inStr) { if (ch === "'" && line[i - 1] !== '\\') inStr = false; continue; }
    if (ch === "'") { inStr = true; continue; }
    if (ch === '/' && line[i + 1] === '/') return i;
  }
  return line.length;
}

// Replace every key of `obj` inside `span`, leaving everything else — comments
// included — untouched. `id` and `n` are identity, never tuning, so they are
// skipped: rewriting them would break the handle the lab and the chat share.
function patchSpan(span, obj) {
  const lines = span.split('\n');
  for (const [k, v] of Object.entries(obj)) {
    if (k === 'id' || k === 'n') continue;
    const re = KEY_VAL(k);
    let hit = false;
    for (let i = 0; i < lines.length && !hit; i++) {
      const cut = codeEnd(lines[i]);
      const code = lines[i].slice(0, cut);
      const m = code.match(re);
      if (!m) continue;
      hit = true;
      // A value that is already what we would write is LEFT ALONE — and the
      // comparison is by VALUE, not by text, so `1.00` counts as 1 and keeps its
      // alignment. Without this every key is rewritten on every save and the
      // diff fills with lines nobody touched, which is the fastest way to make
      // this tool untrustworthy to review.
      if (unlit(m[2]) === JSON.stringify(v)) continue;
      lines[i] = code.replace(re, (_, head) => head + lit(v)) + lines[i].slice(cut);
    }
    if (!hit) throw new Error(`no literal for "${k}" in that block`);
  }
  return lines.join('\n');
}

// The span of a top-level `const NAME = ...;` inside the region, brace-matched so
// a nested array cannot end it early, and comment-blind so prose cannot either.
function constSpan(src, name) {
  const at = src.indexOf('const ' + name + ' =');
  if (at < 0) throw new Error(`DEST-DATA has no ${name}`);
  let i = src.indexOf('=', at) + 1, depth = 0, inStr = false;
  for (; i < src.length; i++) {
    const ch = src[i];
    if (inStr) { if (ch === "'" && src[i - 1] !== '\\') inStr = false; continue; }
    if (ch === "'") { inStr = true; continue; }
    if (ch === '/' && src[i + 1] === '/') { const nl = src.indexOf('\n', i); if (nl < 0) break; i = nl; continue; }
    if (ch === '{' || ch === '[') depth++;
    else if (ch === '}' || ch === ']') depth--;
    else if (ch === ';' && depth === 0) return { start: at, end: i + 1 };
  }
  throw new Error(`${name} never terminates`);
}

// PLANET_TYPES is an array of one-line entries keyed by id. Each entry is found
// by its id and patched in place, so reordering or adding worlds by hand outside
// the lab stays safe.
function patchPlanetTypes(span, list) {
  let out = span;
  for (const p of list) {
    const marker = "id: '" + p.id + "'";
    const at = out.indexOf(marker);
    if (at < 0) throw new Error(`no world with id ${p.id}`);
    const ls = out.lastIndexOf('\n', at) + 1;
    let le = out.indexOf('\n', at);
    if (le < 0) le = out.length;
    out = out.slice(0, ls) + patchSpan(out.slice(ls, le), p) + out.slice(le);
  }
  return out;
}

const SINGLES = ['PLANET_STAR', 'PLANET_SHADE', 'STATION_SPEC', 'GATE_SPEC', 'FIELD_SPEC', 'DEST_MIX'];

function writeGame(payload) {
  const src = readGame();
  const open = src.indexOf('// >>> DEST-DATA');
  const close = src.indexOf('// <<< DEST-DATA');
  if (open < 0 || close < 0) throw new Error('no intact DEST-DATA region');
  const head = src.slice(0, src.indexOf('\n', open) + 1);
  let body = src.slice(src.indexOf('\n', open) + 1, close);
  const tail = src.slice(close);

  if (payload.PLANET_TYPES) {
    const s = constSpan(body, 'PLANET_TYPES');
    body = body.slice(0, s.start) + patchPlanetTypes(body.slice(s.start, s.end), payload.PLANET_TYPES) + body.slice(s.end);
  }
  for (const name of SINGLES) {
    if (!payload[name]) continue;
    const s = constSpan(body, name);
    body = body.slice(0, s.start) + patchSpan(body.slice(s.start, s.end), payload[name]) + body.slice(s.end);
  }
  if (typeof payload.PLANET_REF_R === 'number') {
    body = body.replace(/(const PLANET_REF_R\s*=\s*)\d*\.?\d+/, (_, h) => h + lit(payload.PLANET_REF_R));
  }

  const next = head + body + tail;
  // A write that changed nothing means a key silently missed its literal — the
  // lab should say so rather than claim a save.
  if (next === src) throw new Error('nothing changed — the values already match the game');
  fs.copyFileSync(gamePath, gamePath + '.bak');
  const tmp = gamePath + '.tmp';
  fs.writeFileSync(tmp, next);
  fs.renameSync(tmp, gamePath); // atomic — a crash mid-write cannot truncate the game
}

// ---------- server ----------

// exported so the round-trip (regions extract → sandbox evaluates → writer
// patches without eating comments) can be checked without standing a server up
module.exports = { region, readGame, writeGame };

http.createServer((req, res) => {
  const urlPath = decodeURIComponent(req.url.split('?')[0]);

  // the three regions, straight out of the game
  if (urlPath === '/api/dest-src') {
    try {
      const src = readGame();
      return send(res, 200, TYPES['.json'], JSON.stringify({
        data: region(src, 'DEST-DATA'),
        pick: region(src, 'DEST-PICK'),
        sprite: region(src, 'DEST-SPRITE'),
        art: region(src, 'DEST-ART')
      }));
    } catch (e) { return send(res, 500, 'text/plain', e.message); }
  }

  // the working copy — autosaved every edit so a closed tab loses nothing
  if (urlPath === '/api/work') {
    if (req.method === 'GET') {
      if (!fs.existsSync(workPath)) return send(res, 200, TYPES['.json'], 'null');
      return send(res, 200, TYPES['.json'], fs.readFileSync(workPath, 'utf8'));
    }
    if (req.method === 'PUT') {
      let body = '';
      req.on('data', c => { body += c; if (body.length > 4e6) req.destroy(); });
      req.on('end', () => {
        try {
          JSON.parse(body);
          fs.writeFileSync(workPath, body);
          send(res, 200, TYPES['.json'], '{"ok":true}');
        } catch (e) { send(res, 400, 'text/plain', e.message); }
      });
      return;
    }
    if (req.method === 'DELETE') {
      try { fs.existsSync(workPath) && fs.unlinkSync(workPath); } catch (e) {}
      return send(res, 200, TYPES['.json'], '{"ok":true}');
    }
  }

  // the commit: values go back into src/index.html
  if (urlPath === '/api/apply' && req.method === 'POST') {
    let body = '';
    req.on('data', c => { body += c; if (body.length > 4e6) req.destroy(); });
    req.on('end', () => {
      try {
        writeGame(JSON.parse(body));
        try { fs.existsSync(workPath) && fs.unlinkSync(workPath); } catch (e) {}
        console.log('wrote DEST-DATA → src/index.html (previous kept at src/index.html.bak)');
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
}).listen(port, '127.0.0.1', () => {
  console.log(`Destinations lab on http://localhost:${port}`);
  console.log(`Reading and writing src/index.html between the DEST-DATA markers`);
});
