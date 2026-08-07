'use strict';
// THE BRIEFING DISC LAB — every disc text in the game, on one page, writing back to the
// file that actually holds them.
//
// Sibling of scripts/dest-lab.js and it follows that lab's rules, which were learned the
// hard way: read the real source rather than a copy, fail LOUDLY when a literal cannot be
// found instead of writing something plausible, keep the previous file alongside as .bak,
// and write through a temp + rename so a crash mid-write cannot truncate the campaigns.
//
// AND IT DOES NOT DRAW ITS OWN DISC. A lab that reimplements the renderer starts lying the
// first time the renderer changes — this one embeds the real game and drives it into its
// own S.INFO state, the way the Lane Designer does, so the preview IS the game's output.
// That is why /game/ is mounted: the iframe has to be same-origin to be driven at all.
const fs = require('fs');
const http = require('http');
const path = require('path');

const root = path.join(__dirname, '..');
const labDir = path.join(root, 'docs', 'disc-lab');
const fontDir = path.join(root, 'src', 'fonts');
const srcDir = path.join(root, 'src');
const campPath = path.join(srcDir, 'campaigns.js');
const port = process.env.PORT || 8013;

// The one hard limit the game enforces on a disc line, from the installer's validator at
// src/game/33-loader.js:37. Duplicated here because the validator needs game globals to
// run — scripts/test.js asserts the two numbers still agree, so this cannot drift quietly.
const MISSION_MAX = 96;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};
const send = (res, code, type, body) => {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(body);
};

// src/campaigns.js is a plain declaration with no dependencies, so it evaluates in a bare
// Function — no game globals, no DOM. Same trick dest-lab uses.
function readPackages(text) {
  const box = {};
  new Function('out', '"use strict";' + text + ';out.p = CAMPAIGN_PACKAGES;')(box);
  if (!Array.isArray(box.p)) throw new Error('campaigns.js did not yield CAMPAIGN_PACKAGES');
  return box.p;
}

// ---------- slots: every editable text, with its exact span in the source ----------
// A slot is one string literal. `where` is the honest answer to "does this show up on a
// disc", because two of these do not and a tool that implies otherwise wastes the author's
// time. See the field audit in the page header.
const SLOT_KINDS = {
  mission: { where: 'the mission disc, before the lane', max: MISSION_MAX, hard: true },
  closure: { where: 'the closure disc, after the boss', max: 120, hard: false },
  epilogue: { where: 'authored epilogue — the validator requires it, the disc does not read it', max: 60, hard: false },
  brief: { where: 'contract brief — authored, but NOT drawn anywhere in the game today', max: 400, hard: false }
};

// Enumerate in SOURCE order: brief, then each level's line, then the closure line, then
// the epilogue rows. The forward-only scan below depends on this matching the file.
function slotList(pkgs) {
  const out = [];
  pkgs.forEach((p, pi) => {
    const camp = p.id || ('camp' + pi);
    if (typeof p.story === 'string') out.push({ id: camp + '/brief', camp, kind: 'brief', label: 'CONTRACT BRIEF', value: p.story });
    (p.levels || []).forEach((l, li) => {
      const st = l && l.story;
      if (!st) return;
      if (typeof st.line === 'string')
        out.push({ id: camp + '/level/' + li, camp, kind: 'mission', label: 'STAGE ' + (li + 1), value: st.line });
      (st.lines || []).forEach((s, j) => {
        out.push({ id: camp + '/level/' + li + '/lines/' + j, camp, kind: 'mission', label: 'STAGE ' + (li + 1) + ' · ROW ' + (j + 1), value: s });
      });
    });
    const v = p.verdict;
    if (v) {
      if (typeof v.line === 'string') out.push({ id: camp + '/verdict', camp, kind: 'closure', label: 'CLOSURE LINE', value: v.line });
      (v.lines || []).forEach((s, j) => {
        out.push({ id: camp + '/verdict/lines/' + j, camp, kind: 'epilogue', label: 'EPILOGUE ROW ' + (j + 1), value: s });
      });
    }
  });
  return out;
}

// The literal as this file would write it. campaigns.js is single-quoted throughout with
// no escapes today, but a value the author types could introduce either.
const singleQ = v => "'" + String(v).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
const doubleQ = v => '"' + String(v).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';

// Locate each slot's literal, walking FORWARD so two campaigns sharing an identical line
// can never be confused for each other. If a forward match misses, fall back to a global
// search and accept it only when it is unique — anything else is an error, never a guess.
function locate(text, slots) {
  let cursor = 0;
  for (const s of slots) {
    let found = -1, lit = '';
    for (const enc of [singleQ, doubleQ]) {
      const cand = enc(s.value);
      let i = text.indexOf(cand, cursor);
      if (i < 0) {
        const first = text.indexOf(cand);
        if (first >= 0 && text.indexOf(cand, first + 1) < 0) i = first; // unique: safe
      }
      if (i >= 0) { found = i; lit = cand; break; }
    }
    if (found < 0)
      throw new Error(`could not find the literal for ${s.id} in campaigns.js — ` +
        `it is written in a form this lab does not recognise, so nothing was written`);
    s.start = found;
    s.end = found + lit.length;
    cursor = s.end;
  }
  return slots;
}

function validate(kind, value) {
  const spec = SLOT_KINDS[kind];
  if (typeof value !== 'string') return 'not a string';
  if (!value.trim()) return 'empty — the validator rejects a blank story card';
  if (spec.hard && value.length > spec.max)
    return `${value.length} characters — the installer rejects anything over ${spec.max}`;
  return null;
}

// ---------- the write ----------
// PURE, so the tests can exercise every refusal and the whole round trip without writing a
// byte into the repo. applyEdits is only the IO around it.
function patch(text, edits) {
  const slots = locate(text, slotList(readPackages(text)));
  const byId = new Map(slots.map(s => [s.id, s]));

  const bad = [];
  const todo = [];
  for (const e of edits) {
    const s = byId.get(e.id);
    if (!s) { bad.push(`${e.id}: no such text in campaigns.js`); continue; }
    // OPTIMISTIC CONCURRENCY. `was` is what the page was showing when it was edited; if
    // the file has moved since (another agent, a hand edit), refuse rather than clobber.
    if (typeof e.was === 'string' && e.was !== s.value) {
      bad.push(`${e.id}: changed on disk since the page loaded — reload before saving`);
      continue;
    }
    const err = validate(s.kind, e.value);
    if (err) { bad.push(`${s.camp} ${s.label}: ${err}`); continue; }
    if (e.value !== s.value) todo.push({ s, value: e.value });
  }
  if (bad.length) throw new Error(bad.join('\n'));
  if (!todo.length) throw new Error('nothing changed — every value already matches the file');

  // back to front, so an earlier replacement cannot invalidate a later offset
  todo.sort((a, b) => b.s.start - a.s.start);
  let next = text;
  for (const t of todo) next = next.slice(0, t.s.start) + singleQ(t.value) + next.slice(t.s.end);

  // VERIFY BEFORE COMMITTING. Re-evaluate the patched source and confirm every edit reads
  // back — a patch that produced valid JS with the wrong value would otherwise ship.
  let after;
  try { after = new Map(slotList(readPackages(next)).map(s => [s.id, s.value])); }
  catch (e) { throw new Error('the patched campaigns.js does not evaluate: ' + e.message + ' — nothing was written'); }
  for (const t of todo) {
    if (after.get(t.s.id) !== t.value)
      throw new Error(`verification failed for ${t.s.id} — nothing was written`);
  }

  return { next, wrote: todo.map(t => t.s.id) };
}

function applyEdits(edits) {
  const text = fs.readFileSync(campPath, 'utf8');
  const { next, wrote } = patch(text, edits);
  fs.copyFileSync(campPath, campPath + '.bak');
  const tmp = campPath + '.tmp';
  fs.writeFileSync(tmp, next);
  fs.renameSync(tmp, campPath); // atomic — a crash mid-write cannot truncate the campaigns
  return wrote;
}

function discPayload() {
  const text = fs.readFileSync(campPath, 'utf8');
  const pkgs = readPackages(text);
  const slots = slotList(pkgs);
  const byCamp = new Map();
  for (const p of pkgs) byCamp.set(p.id, { id: p.id, title: p.title || p.id, tagline: p.tagline || '', slots: [] });
  for (const s of slots) {
    const c = byCamp.get(s.camp);
    if (c) c.slots.push({ id: s.id, kind: s.kind, label: s.label, value: s.value });
  }
  return {
    kinds: SLOT_KINDS,
    missionMax: MISSION_MAX,
    campaigns: [...byCamp.values()]
  };
}

// ---------- server ----------
const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent(req.url.split('?')[0]);

  if (urlPath === '/api/discs') {
    try { return send(res, 200, TYPES['.json'], JSON.stringify(discPayload())); }
    catch (e) { return send(res, 500, 'text/plain', e.message); }
  }

  if (urlPath === '/api/apply' && req.method === 'POST') {
    let body = '';
    req.on('data', d => { body += d; if (body.length > 1e6) req.destroy(); });
    req.on('end', () => {
      try {
        const wrote = applyEdits(JSON.parse(body).edits || []);
        console.log('wrote ' + wrote.length + ' text' + (wrote.length === 1 ? '' : 's') +
          ' → src/campaigns.js (previous kept alongside as .bak)');
        wrote.forEach(id => console.log('   · ' + id));
        send(res, 200, TYPES['.json'], JSON.stringify({ ok: true, wrote }));
      } catch (e) { send(res, 400, 'text/plain', e.message); }
    });
    return;
  }

  // /game/ is the real game, same-origin so the preview iframe can be driven
  let filePath;
  if (urlPath.startsWith('/game/')) {
    filePath = path.join(srcDir, path.normalize(urlPath.slice(6)) || 'index.html');
    if (!filePath.startsWith(srcDir)) return send(res, 403, 'text/plain', 'Forbidden');
  } else if (urlPath.startsWith('/fonts/')) {
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

// Only LISTEN when run as a command — requiring this file is how the tests check the
// locate/patch round-trip, and a require that seizes the port would take it from the lab
// the author already has open in a tab.
if (require.main === module) {
  server.listen(port, '127.0.0.1', () => {
    console.log(`Briefing disc lab on http://localhost:${port}`);
    console.log('Reading and writing src/campaigns.js; the game itself is mounted at /game/');
  });
}

module.exports = { readPackages, slotList, locate, validate, patch, applyEdits, discPayload, singleQ, MISSION_MAX };
