const puppeteer = require('puppeteer-core');
const CHROME = '/Users/gilbeja/.cache/puppeteer/chrome/mac_arm-151.0.7922.47/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
(async () => {
  const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--allow-file-access-from-files', '--use-gl=swiftshader'] });
  const p = await b.newPage();
  await p.setViewport({ width: 1280, height: 800, deviceScaleFactor: 2 });
  await p.goto('file:///Users/gilbeja/vsCode/data-defenders/src/index.html', { waitUntil: 'load' });
  await p.waitForFunction('document.querySelector("canvas").width > 0');
  await new Promise(r => setTimeout(r, 9000));
  await p.evaluate(() => {
    const pr = document.createElement('canvas'); pr.width = 160; pr.height = 100;
    const px = pr.getContext('2d', { willReadFrequently: true });
    window.__mean = () => {
      px.clearRect(0, 0, 160, 100);
      px.drawImage(document.querySelector('canvas'), 0, 0, 160, 100);
      const d = px.getImageData(0, 0, 160, 100).data;
      let s = 0; for (let i = 0; i < d.length; i += 4) s += d[i]*0.299 + d[i+1]*0.587 + d[i+2]*0.114;
      return s / (d.length / 4);
    };
    window.__orig = {};
    for (const n of ['drawTunnel','drawDeepField','drawLattice','drawStreaks','drawLaneMedium','drawMenu','drawLiveBg'])
      window.__orig[n] = window[n];
    window.__off = n => { window[n] = () => {}; };
    window.__on = n => { window[n] = window.__orig[n]; };
  });
  const avg = async () => { const v = []; for (let i=0;i<8;i++){ v.push(await p.evaluate('__mean()')); await new Promise(r=>setTimeout(r,80)); } return v.reduce((a,c)=>a+c,0)/v.length; };
  const base = await avg();
  console.log('menu frame mean:', base.toFixed(2));
  for (const n of ['drawTunnel','drawDeepField','drawLattice','drawStreaks','drawLaneMedium','drawMenu','drawLiveBg']) {
    await p.evaluate(x => window.__off(x), n);
    const m = await avg();
    await p.evaluate(x => window.__on(x), n);
    console.log(`  without ${n.padEnd(15)} ${m.toFixed(2)}   (contributes ${(base-m).toFixed(2)}, ${(100*(base-m)/base).toFixed(0)}%)`);
  }
  await b.close();
})();
