const puppeteer = require('puppeteer-core');
const CHROME = '/Users/gilbeja/.cache/puppeteer/chrome/mac_arm-151.0.7922.47/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
(async () => {
  const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--allow-file-access-from-files', '--use-gl=swiftshader'] });
  const p = await b.newPage();
  await p.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
  await p.goto('file:///Users/gilbeja/vsCode/data-defenders/src/index.html', { waitUntil: 'load' });
  await p.waitForFunction('document.querySelector("canvas").width > 0');
  await new Promise(r => setTimeout(r, 9000));
  const rows = await p.evaluate(() => new Promise(resolve => {
    const src = document.querySelector('canvas');
    const c = document.createElement('canvas'); c.width = 320; c.height = 200;
    const x = c.getContext('2d', { willReadFrequently: true });
    const mean = () => { x.clearRect(0,0,320,200); x.drawImage(src,0,0,320,200);
      const d = x.getImageData(0,0,320,200).data; let s=0;
      for (let i=0;i<d.length;i+=4) s += d[i]*0.299+d[i+1]*0.587+d[i+2]*0.114; return s/(d.length/4); };
    const real = window.frame; const out = []; let n = 0;
    window.frame = function (now) {
      const bv = skyBreath();      // value BEFORE the frame draws with it
      real(now); n++;
      if (n % 6 === 0) out.push([bv, mean()]);
      if (out.length >= 120) { window.frame = real; resolve(out); }
    };
  }));
  const bs = rows.map(r => r[0]), ms = rows.map(r => r[1]);
  const mb = bs.reduce((a,c)=>a+c,0)/bs.length, mm = ms.reduce((a,c)=>a+c,0)/ms.length;
  let num=0, db=0, dm=0;
  for (let i=0;i<bs.length;i++){ num += (bs[i]-mb)*(ms[i]-mm); db += (bs[i]-mb)**2; dm += (ms[i]-mm)**2; }
  console.log(`breath ranged ${Math.min(...bs).toFixed(2)}..${Math.max(...bs).toFixed(2)}`);
  console.log(`frame mean ranged ${Math.min(...ms).toFixed(2)}..${Math.max(...ms).toFixed(2)}`);
  console.log(`correlation r = ${(num/Math.sqrt(db*dm)).toFixed(3)}   slope = ${(num/db).toFixed(2)} luminance per copy`);
  await b.close();
})();
