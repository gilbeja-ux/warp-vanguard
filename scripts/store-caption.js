#!/usr/bin/env node
'use strict';
// ---------- STORE CAPTION: lay the caption plates on every master ----------
// The captions are Gil's words in docs/store/captions.json (typed in the caption
// editor artifact, 2026-09-24). The plate is the 2026-08 compositor's, unchanged
// (scripts/shot-caption.html: techRect, Panel Glass, cyan edge, Audiowide), so a
// captioned frame is the game's own chrome and not a marketing overlay.
//
//   node scripts/store-caption.js                 # every size, every frame
//   node scripts/store-caption.js --size=play     # one size
//   node scripts/store-caption.js --masters=/path # where the raw sets live (default docs/store/raw)
//
// Output: <masters>/../captioned/<size>/<frame>.png — the raw masters stay raw, so a
// change of wording never needs a re-shoot.
const fs = require('fs');
const path = require('path');
const http = require('http');
const { launchChrome, killChrome, waitForPort, openPage, sleep } = require('./lib/cdp.js');
const { ROOT, ARG } = require('./store-shoot.js');

const MASTERS = path.resolve(ARG.masters || path.join(ROOT, 'docs', 'store', 'raw'));
const OUTDIR = path.join(MASTERS, '..', 'captioned');
const CDP_PORT = parseInt(ARG.cdp || '9345', 10);
const CAPS = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs', 'store', 'captions.json'), 'utf8'));
const SIZES = ARG.size ? String(ARG.size).split(',') : ['play', 'iphone', 'ipad', 'play169'];

// a tiny server: /scripts/shot-caption.html from the repo, /scripts/<frame>.png from
// ONE size's master folder, fonts from src/, and the /shot POST the compositor makes
function serve(sizeDir, outSize) {
  return new Promise(resolve => {
    const TYPES = { '.html': 'text/html; charset=utf-8', '.png': 'image/png', '.woff2': 'font/woff2', '.woff': 'font/woff' };
    const srv = http.createServer((req, res) => {
      const p = decodeURIComponent(req.url.split('?')[0]);
      if (req.method === 'POST' && p === '/shot') {
        const name = new URL(req.url, 'http://x').searchParams.get('name') || 'shot';
        let b = ''; req.on('data', d => { b += d; }); req.on('end', () => {
          const out = path.join(OUTDIR, outSize, path.basename(name) + '.png');
          fs.mkdirSync(path.dirname(out), { recursive: true });
          fs.writeFileSync(out, Buffer.from(b.split(',')[1] || '', 'base64')); res.writeHead(200); res.end('ok');
        });
        return;
      }
      let file;
      if (p.startsWith('/scripts/') && p.endsWith('.png')) file = path.join(sizeDir, path.basename(p));
      else if (p.startsWith('/scripts/') || p.startsWith('/src/')) file = path.join(ROOT, p);
      else file = path.join(ROOT, 'src', p);
      if (!fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); return res.end('Not found'); }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      fs.createReadStream(file).pipe(res);
    });
    srv.listen(0, '127.0.0.1', () => resolve(srv));
  });
}

(async () => {
  let failed = 0;
  for (const size of SIZES) {
    const dir = path.join(MASTERS, size);
    if (!fs.existsSync(dir)) { console.error(`  SKIP  ${size}: no masters in ${dir}`); continue; }
    const srv = await serve(dir, size); const origin = 'http://127.0.0.1:' + srv.address().port;
    const chrome = launchChrome(CDP_PORT, { headless: true, extraArgs: ['--window-size=1200,700'] });
    try {
      await waitForPort(CDP_PORT); const { cdp } = await openPage(CDP_PORT);
      for (const key of Object.keys(CAPS)) {
        if (key.startsWith('_')) continue;
        const c = CAPS[key];
        if (!c.text) {   // an empty field means no plate: the raw frame is the deliverable
          fs.mkdirSync(path.join(OUTDIR, size), { recursive: true });
          fs.copyFileSync(path.join(dir, key + '.png'), path.join(OUTDIR, size, key + '.png'));
          console.log(`  COPY  ${size}/${key}.png (no caption)`); continue;
        }
        const q = new URLSearchParams({ src: key, name: key, text: c.text, sub: c.sub || '', align: c.align || 'left', case: 'keep' });
        await cdp.send('Page.navigate', { url: origin + '/scripts/shot-caption.html?' + q });
        let title = '';
        for (let i = 0; i < 100; i++) { title = await cdp.eval('document.title'); if (/^(READY|FAILED)/.test(title)) break; await sleep(200); }
        if (!/^READY/.test(title)) { failed++; console.error(`  FAIL  ${size}/${key}: ${title}`); continue; }
        console.log(`  DONE  ${size}/${key}.png  "${c.text}"`);
      }
    } finally { await killChrome(chrome); srv.close(); }
  }
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
