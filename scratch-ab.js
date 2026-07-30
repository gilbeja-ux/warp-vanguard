// A/B on CONSECUTIVE frames: same moment, breath on vs off. Isolates the pass
// from every other animation in the menu.
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
  const r = await p.evaluate(() => new Promise(resolve => {
    const src = document.querySelector('canvas');
    const realDraw = window.drawSkyBreath;
    let enabled = true;
    window.drawSkyBreath = function () { if (enabled) return realDraw.apply(this, arguments); };
    const cap = document.createElement('canvas'); cap.width = src.width; cap.height = src.height;
    const cx = cap.getContext('2d', { willReadFrequently: true });
    const grab = () => { cx.clearRect(0,0,cap.width,cap.height); cx.drawImage(src,0,0);
      return { data: cx.getImageData(0,0,cap.width,cap.height).data, url: cap.toDataURL() }; };
    const real = window.frame; let n = 0, on = null, off = null, bv = 0;
    window.frame = function (now) {
      // wait for a peak, then render the very next frame without the pass
      if (!on) { enabled = true; real(now); if (skyBreath() > 2.1) { bv = skyBreath(); on = grab(); } return; }
      if (!off) { enabled = false; real(now); off = grab(); enabled = true; window.frame = real;
        let a = 0, c = 0, ba = 0, bc = 0, mx = 0;
        for (let i = 0; i < on.data.length; i += 4) {
          const la = on.data[i]*0.299 + on.data[i+1]*0.587 + on.data[i+2]*0.114;
          const lb = off.data[i]*0.299 + off.data[i+1]*0.587 + off.data[i+2]*0.114;
          a += la; c += lb; if (la > 40) ba++; if (lb > 40) bc++; if (la - lb > mx) mx = la - lb;
        }
        const n2 = on.data.length / 4;
        const at = (d,x,y) => { const i = ((y*cap.width)+x)*4; return [d[i],d[i+1],d[i+2]]; };
        const pts = [[60,60],[200,700],[1200,120],[1240,760],[640,40]];
        const probe = pts.map(q => "(" + q + ") on=" + at(on.data,q[0],q[1]) + " off=" + at(off.data,q[0],q[1]));
        resolve({ probe, breath: bv, meanOn: a/n2, meanOff: c/n2, brightOn: ba, brightOff: bc, maxDelta: mx, on: on.url, off: off.url });
      }
    };
  }));
  fs.writeFileSync(dir + '/ab-on.png', Buffer.from(r.on.split(',')[1], 'base64'));
  fs.writeFileSync(dir + '/ab-off.png', Buffer.from(r.off.split(',')[1], 'base64'));
  console.log(`at breath ${r.breath.toFixed(2)} copies:`);
  console.log(`  mean luminance  ON ${r.meanOn.toFixed(2)}  vs OFF ${r.meanOff.toFixed(2)}   (+${(100*(r.meanOn/r.meanOff-1)).toFixed(1)}%)`);
  console.log(`  visible pixels  ON ${r.brightOn}  vs OFF ${r.brightOff}   (+${(100*(r.brightOn/r.brightOff-1)).toFixed(1)}%)`);
  console.log(`  max per-pixel gain ${r.maxDelta.toFixed(0)} levels`);
  console.log("  dark-sky probes:"); r.probe.forEach(s => console.log("    " + s));
  await b.close();
})();
