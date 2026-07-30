const puppeteer = require('puppeteer-core');
const CHROME = '/Users/gilbeja/.cache/puppeteer/chrome/mac_arm-151.0.7922.47/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
(async () => {
  const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--allow-file-access-from-files', '--use-gl=swiftshader'] });
  const p = await b.newPage();
  await p.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
  await p.goto('file:///Users/gilbeja/vsCode/data-defenders/src/index.html', { waitUntil: 'load' });
  await p.waitForFunction('document.querySelector("canvas").width > 0');
  await new Promise(r => setTimeout(r, 9000));
  const res = await p.evaluate(() => new Promise(resolve => {
    const src = document.querySelector('canvas');
    const mk = () => { const c = document.createElement('canvas'); c.width = src.width; c.height = src.height; return c; };
    const A = mk(), B = mk();
    const shot = c => { const x = c.getContext('2d', { willReadFrequently: true }); x.clearRect(0,0,c.width,c.height); x.drawImage(src,0,0); return x.getImageData(0,0,c.width,c.height).data; };
    let peak = null, trough = null;
    const real = window.frame;
    window.frame = function (now) {
      real(now);
      const v = skyBreath();
      if (v > 2.2 && !peak) peak = shot(A);
      if (v < 0.5 && !trough) trough = shot(B);
      if (peak && trough) {
        window.frame = real;
        let sp = 0, st = 0, n = 0, over8 = 0, maxd = 0, sp2 = 0, st2 = 0;
        for (let i = 0; i < peak.length; i += 4) {
          const lp = peak[i]*0.299 + peak[i+1]*0.587 + peak[i+2]*0.114;
          const lt = trough[i]*0.299 + trough[i+1]*0.587 + trough[i+2]*0.114;
          sp += lp; st += lt; n++;
          const d = lp - lt; if (d > 8) over8++; if (d > maxd) maxd = d;
          if (lp > 40) sp2++; if (lt > 40) st2++;
        }
        resolve({ peak: sp/n, trough: st/n, ratio: sp/st, over8, n, maxd, brightPeak: sp2, brightTrough: st2 });
      }
    };
  }));
  console.log(`peak mean ${res.peak.toFixed(2)}  trough mean ${res.trough.toFixed(2)}  ->  ${((res.ratio-1)*100).toFixed(1)}% brighter at peak`);
  console.log(`visible (>40) pixels: peak ${res.brightPeak} vs trough ${res.brightTrough}  ->  ${(100*(res.brightPeak/res.brightTrough-1)).toFixed(1)}% more sky visible at peak`);
  console.log(`pixels >8 levels brighter at peak: ${res.over8} / ${res.n} (${(100*res.over8/res.n).toFixed(2)}%)   max delta ${res.maxd.toFixed(0)}`);
  await b.close();
})();
