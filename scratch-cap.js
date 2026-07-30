// Capture COMPLETE frames: wrap the game's frame() and snapshot after it returns,
// so we never catch a half-drawn canvas. Grabs a peak and a trough of skyBreath().
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const CHROME = '/Users/gilbeja/.cache/puppeteer/chrome/mac_arm-151.0.7922.47/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const dir = process.argv[2];
(async () => {
  const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--allow-file-access-from-files', '--use-gl=swiftshader'] });
  const p = await b.newPage();
  await p.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
  await p.goto('file:///Users/gilbeja/vsCode/data-defenders/src/index.html', { waitUntil: 'load' });
  await p.waitForFunction('document.querySelector("canvas").width > 0');
  await new Promise(r => setTimeout(r, 9000));
  await p.evaluate(() => {
    const buf = document.createElement('canvas');
    const src = document.querySelector('canvas');
    buf.width = src.width; buf.height = src.height;
    const bx = buf.getContext('2d');
    window.__shots = {}; let n2 = 0;
    const real = window.frame;
    window.frame = function (now) {
      real(now);
      n2++;
      if (n2 === 10 && !window.__shots.peak) { bx.clearRect(0,0,buf.width,buf.height); bx.drawImage(src,0,0); window.__shots.peak = buf.toDataURL(); }
      if (n2 === 190 && !window.__shots.trough) { bx.clearRect(0,0,buf.width,buf.height); bx.drawImage(src,0,0); window.__shots.trough = buf.toDataURL(); }
    };
  });
  for (let i = 0; i < 140; i++) {
    const done = await p.evaluate('!!(__shots.peak && __shots.trough)');
    if (done) break;
    await new Promise(r => setTimeout(r, 300));
  }
  const shots = await p.evaluate('__shots');
  for (const k of ['peak', 'trough']) {
    if (!shots[k]) { console.log('missed', k); continue; }
    fs.writeFileSync(dir + '/' + k + '.png', Buffer.from(shots[k].split(',')[1], 'base64'));
    console.log('wrote', k);
  }
  await b.close();
})();
