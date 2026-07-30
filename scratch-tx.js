const puppeteer = require('puppeteer-core');
const CHROME = '/Users/gilbeja/.cache/puppeteer/chrome/mac_arm-151.0.7922.47/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
(async () => {
  const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--allow-file-access-from-files', '--use-gl=swiftshader'] });
  const p = await b.newPage();
  await p.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
  await p.goto('file:///Users/gilbeja/vsCode/data-defenders/src/index.html', { waitUntil: 'load' });
  await p.waitForFunction('document.querySelector("canvas").width > 0');
  await new Promise(r => setTimeout(r, 8000));
  const r = await p.evaluate(() => {
    const c = document.querySelector('canvas').getContext('2d');
    const real = window.drawSkyBreath;
    let info = null;
    window.drawSkyBreath = function () {
      if (!info) {
        const t = c.getTransform();
        info = { transform: [t.a, t.b, t.c, t.d, t.e, t.f], alpha: c.globalAlpha, gco: c.globalCompositeOperation,
                 W: typeof W !== 'undefined' ? W : null, H, DPR, breath: skyBreath(),
                 cv: [skyBreathCv.width, skyBreathCv.height], skyBW, skyBH };
      }
      return real.apply(this, arguments);
    };
    return new Promise(res => setTimeout(() => { window.drawSkyBreath = real; res(info); }, 500));
  });
  console.log(JSON.stringify(r, null, 1));
  await b.close();
})();
