const puppeteer = require('/Users/gilbeja/vsCode/warp-vanguard/node_modules/puppeteer-core');
(async () => {
  const cpu = Number(process.argv[2] || 1);
  const b = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: 'new', args: ['--no-sandbox']
  });
  const page = await b.newPage();
  await page.setViewport({ width: 900, height: 1500 });
  // stamp the moment the pump could first run, and watch frames, from inside
  await page.evaluateOnNewDocument(`
    window.__t0 = null; window.__fr = []; window.__mark = {};
    addEventListener('DOMContentLoaded', () => {
      window.__t0 = performance.now();
      let l = performance.now();
      (function tick(){ const n = performance.now(); window.__fr.push(n - l); l = n;
        try { for (const k of Object.keys(s3Sprites)) if (!(k in window.__mark)) window.__mark[k] = n - window.__t0; } catch(e){}
        requestAnimationFrame(tick); })();
    });
  `);
  await page.goto('http://localhost:8000/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  if (cpu > 1) { const c = await page.createCDPSession(); await c.send('Emulation.setCPUThrottlingRate', { rate: cpu }); }
  for (let i = 0; i < 200; i++) {
    await new Promise(r => setTimeout(r, 400));
    const st = await page.evaluate(`(()=>{try{return {n:Object.keys(s3Sprites).length,q:s3Queue.length,busy:!!s3Job}}catch(e){return{n:0,q:9,busy:1}}})()`);
    if (st.n >= 5 && !st.busy && st.q === 0) break;
  }
  const r = await page.evaluate('({ mark: window.__mark, fr: window.__fr, diag: (typeof s3Diag!==\'undefined\'?s3Diag:null) })');
  const fr = r.fr.slice(20).sort((a, x) => a - x);
  const pct = p => fr[Math.min(fr.length - 1, (fr.length * p) | 0)];
  const marks = Object.entries(r.mark).map(([k, v]) => k + '=' + (v / 1000).toFixed(1) + 's').join(' ');
  const last = Math.max(...Object.values(r.mark)) / 1000;
  console.log(`cpu x${cpu}  all five done at ${last.toFixed(1)}s  [${marks}]`);
  console.log(`         frames: p50=${pct(0.5).toFixed(1)} p95=${pct(0.95).toFixed(1)} p99=${pct(0.99).toFixed(1)} max=${fr[fr.length-1].toFixed(1)} ms   (n=${fr.length})`);
  console.log("         diag(ms):", JSON.stringify(r.diag));
  await b.close();
})();
