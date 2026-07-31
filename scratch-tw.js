// Are the stars actually independent? Sample every live star's brightness over
// time and report the amplitude spread + how correlated random pairs are.
const puppeteer = require('puppeteer-core');
const CHROME = '/Users/gilbeja/.cache/puppeteer/chrome/mac_arm-151.0.7922.47/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
(async () => {
  const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--allow-file-access-from-files','--use-gl=swiftshader'] });
  const p = await b.newPage();
  await p.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
  await p.goto('file://' + __dirname + '/src/index.html', { waitUntil: 'load' });
  await p.waitForFunction('document.querySelector("canvas").width > 0');
  await new Promise(r => setTimeout(r, 6000));
  const r = await p.evaluate(() => {
    const N = 500, DT = 0.05;          // 25 s of star time
    const t0 = time;
    const series = liveStars.map(() => []);
    for (let k = 0; k < N; k++) {
      const t = t0 + k * DT;
      liveStars.forEach((s, i) => {
        const w = s.amp && (0.62 * (0.5 + 0.5 * Math.sin(t * s.r1 + s.p1))
          + 0.38 * (0.5 + 0.5 * Math.sin(t * s.r2 + s.p2)));
        series[i].push(Math.min(1, s.al * (1 - s.amp + 2 * s.amp * w)));
      });
    }
    const swing = series.map(a => { const mn = Math.min(...a), mx = Math.max(...a); return (mx - mn) / (mx || 1); });
    const corr = (a, c) => {
      const ma = a.reduce((x,y)=>x+y,0)/a.length, mc = c.reduce((x,y)=>x+y,0)/c.length;
      let n=0,da=0,dc=0;
      for (let i=0;i<a.length;i++){ n += (a[i]-ma)*(c[i]-mc); da += (a[i]-ma)**2; dc += (c[i]-mc)**2; }
      return (da && dc) ? n/Math.sqrt(da*dc) : 0;
    };
    const pairs = [];
    for (let k = 0; k < 60; k++) {
      const i = (Math.random()*series.length)|0, j = (Math.random()*series.length)|0;
      if (i !== j) pairs.push(Math.abs(corr(series[i], series[j])));
    }
    const q = a => { const s2 = a.slice().sort((x,y)=>x-y); return [s2[0], s2[(s2.length*0.5)|0], s2[s2.length-1]]; };
    return { n: liveStars.length, steady: swing.filter(v => v < 0.02).length,
             swing: q(swing), pairCorr: pairs.reduce((x,y)=>x+y,0)/pairs.length,
             big: liveStars.filter(s => s.big).length };
  });
  console.log(`live stars: ${r.n} (${r.big} bright), of which ${r.steady} are dead steady`);
  console.log(`per-star brightness swing — min ${(100*r.swing[0]).toFixed(0)}%  median ${(100*r.swing[1]).toFixed(0)}%  max ${(100*r.swing[2]).toFixed(0)}%`);
  console.log(`mean |correlation| between random star pairs: ${r.pairCorr.toFixed(3)}  (0 = fully independent, 1 = in lockstep)`);
  await b.close();
})();
