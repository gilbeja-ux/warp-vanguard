// Direct measurement: sample the canvas at the PEAK and the TROUGH of the breath
// (read from the game's own skyBreath()), and diff. No inference.
const puppeteer = require('puppeteer-core');
const CHROME = '/Users/gilbeja/.cache/puppeteer/chrome/mac_arm-151.0.7922.47/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const PAGE = 'file:///Users/gilbeja/vsCode/data-defenders/src/index.html';

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new',
    args: ['--allow-file-access-from-files', '--use-gl=swiftshader']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 2 });
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
  await page.goto(PAGE, { waitUntil: 'load' });
  await page.waitForFunction('document.querySelector("canvas") && document.querySelector("canvas").width > 0');
  await new Promise(r => setTimeout(r, 12000));

  const diag = await page.evaluate(() => ({
    hasFn: typeof drawSkyBreath === 'function',
    breathNow: typeof skyBreath === 'function' ? skyBreath() : 'n/a',
    cv: typeof skyBreathCv !== 'undefined' && skyBreathCv ? [skyBreathCv.width, skyBreathCv.height] : null,
    mask: typeof skyMaskCv !== 'undefined' && skyMaskCv ? [skyMaskCv.width, skyMaskCv.height] : null,
    bg: typeof bgCanvas !== 'undefined' && bgCanvas ? [bgCanvas.width, bgCanvas.height] : null,
    low: typeof lowFX !== 'undefined' ? lowFX : 'n/a',
    state: typeof state !== 'undefined' ? state : 'n/a'
  }));
  console.log('diagnostics:', JSON.stringify(diag));

  await page.evaluate(() => {
    const p = document.createElement('canvas');
    p.width = 160; p.height = 100;
    const pc = p.getContext('2d', { willReadFrequently: true });
    window.__grab = () => {
      const c = document.querySelector('canvas');
      pc.clearRect(0, 0, 160, 100);
      pc.drawImage(c, 0, 0, 160, 100);
      const d = pc.getImageData(0, 0, 160, 100).data;
      const px = [];
      for (let i = 0; i < d.length; i += 4) px.push(d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114);
      return { px, breath: skyBreath() };
    };
  });

  // catch a peak and a trough of the game's own breath value
  async function waitFor(pred) {
    for (let i = 0; i < 400; i++) {
      const g = await page.evaluate('__grab()');
      if (pred(g.breath)) return g;
      await new Promise(r => setTimeout(r, 60));
    }
    return null;
  }
  const hi = await waitFor(b => b > 1.05);
  const lo = await waitFor(b => b < 0.4);
  console.log('captured breath hi =', hi && hi.breath.toFixed(3), ' lo =', lo && lo.breath.toFixed(3));
  if (hi && lo) {
    let sumH = 0, sumL = 0, big = 0, n = 0;
    for (let i = 0; i < hi.px.length; i++) {
      sumH += hi.px[i]; sumL += lo.px[i]; n++;
      if (hi.px[i] - lo.px[i] > 6) big++;
    }
    console.log(`whole frame: peak ${(sumH / n).toFixed(2)} vs trough ${(sumL / n).toFixed(2)}  ->  ${(100 * (sumH / sumL - 1)).toFixed(1)}% brighter at peak`);
    console.log(`pixels visibly brighter at peak (>6 levels): ${big} / ${n} (${(100 * big / n).toFixed(1)}%)`);
  }
  console.log('page errors:', errs.length ? errs.slice(0, 3) : 'none');
  await browser.close();
})();
