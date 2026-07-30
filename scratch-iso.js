const puppeteer = require('puppeteer-core');
const CHROME = '/Users/gilbeja/.cache/puppeteer/chrome/mac_arm-151.0.7922.47/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
(async () => {
  const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--allow-file-access-from-files', '--use-gl=swiftshader'] });
  const p = await b.newPage();
  await p.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
  await p.goto('file:///Users/gilbeja/vsCode/data-defenders/src/index.html', { waitUntil: 'load' });
  await p.waitForFunction('document.querySelector("canvas").width > 0');
  await new Promise(r => setTimeout(r, 9000));
  const r = await p.evaluate(() => new Promise(resolve => {
    // count real calls, and log the alpha actually handed to the composite
    window.__calls = 0; window.__alphas = [];
    const realDraw = window.drawSkyBreath;
    window.drawSkyBreath = function () { window.__calls++; window.__alphas.push(skyBreath()); return realDraw.apply(this, arguments); };
    const src = document.querySelector('canvas');
    const c = document.createElement('canvas'); c.width = 320; c.height = 200;
    const x = c.getContext('2d', { willReadFrequently: true });
    const bright = () => { x.clearRect(0,0,320,200); x.drawImage(src,0,0,320,200);
      const d = x.getImageData(0,0,320,200).data; let n = 0;
      for (let i=0;i<d.length;i+=4) if (d[i]*0.299+d[i+1]*0.587+d[i+2]*0.114 > 40) n++; return n; };
    const real = window.frame; const rows = []; let n = 0;
    window.frame = function (now) {
      real(now); n++;
      if (n % 5 === 0) rows.push([+skyBreath().toFixed(2), bright()]);
      if (rows.length >= 40) {
        window.frame = real;
        resolve({ rows, calls: window.__calls, alphaRange: [Math.min(...window.__alphas).toFixed(2), Math.max(...window.__alphas).toFixed(2)], frames: n });
      }
    };
  }));
  console.log(`drawSkyBreath called ${r.calls} times over ${r.frames} frames; alpha range ${r.alphaRange.join(' .. ')}`);
  const lo = r.rows.filter(v => v[0] < 0.8).map(v => v[1]);
  const hi = r.rows.filter(v => v[0] > 1.8).map(v => v[1]);
  const m = a => a.length ? (a.reduce((x,y)=>x+y,0)/a.length) : NaN;
  console.log(`bright pixels (of 64000) — breath low: ${m(lo).toFixed(0)} (n=${lo.length})   breath high: ${m(hi).toFixed(0)} (n=${hi.length})`);
  console.log(`=> ${(100*(m(hi)/m(lo)-1)).toFixed(1)}% more visible sky at the top of a breath`);
  await b.close();
})();
