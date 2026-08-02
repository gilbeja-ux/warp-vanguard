const puppeteer = require('/Users/gilbeja/vsCode/warp-vanguard/node_modules/puppeteer-core');
const arg = process.argv[2] || (__dirname + '/sheet.html');
const page_url = /^file:\/\//.test(arg) ? arg : 'file://' + arg;
const out = process.argv[3] || __dirname + '/sheet.png';
(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: 'new', args: ['--no-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 2400, height: 1400 });
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto(page_url, { waitUntil: 'load' });
  await page.waitForFunction('window.__done === true', { timeout: 180000 }).catch(e => errs.push('TIMEOUT ' + e.message));
  const log = await page.evaluate(() => window.__log || '');
  const el = await page.$('#c');
  if (el) await el.screenshot({ path: out });
  await browser.close();
  if (errs.length) console.error('ERRORS:\n' + errs.join('\n'));
  console.log(log);
  console.log('wrote ' + out);
})();
