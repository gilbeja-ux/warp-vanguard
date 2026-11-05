// Store downloads for the traction portal: Google Play and the App Store.
//
// Installs exist only in the stores. Neither store pushes them anywhere, so this
// pulls them, two ways:
//
//   SYNC     the stores' own report APIs, once Gil has made the credentials
//            (docs/STORE-REPORTS-SETUP.md is the exact step list):
//              Play       the Play Console's Cloud Storage bucket of monthly
//                         install reports (stats/installs/…_overview.csv), read
//                         with a service account. The Play Developer Reporting API
//                         covers vitals only, not installs, so the bucket is the way.
//              App Store  the App Store Connect Sales and Trends API, one DAILY
//                         SUMMARY report per day, with a team API key (role Sales).
//   UPLOAD   a CSV or TSV dropped on the page, for the time before the keys exist:
//            a Play overview CSV, an Apple sales report (.txt or .gz), an App Store
//            Connect analytics export, or any two-column `date,installs` file.
//
// WHERE IT KEEPS THINGS. Outside every checkout, so no key can ever be committed
// and a worktree's removal loses nothing: ~/.warp-vanguard/ (or $WV_TRACTION_DIR).
//   store.json          which bucket, which vendor, which key files
//   *.json / *.p8       the credentials themselves, as the stores hand them over
//   store-data.json     the imported days: { play: { days }, ios: { days }, log }
// None of it reaches the browser except the per-day counts.
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');

const DIR = process.env.WV_TRACTION_DIR || path.join(os.homedir(), '.warp-vanguard');
const CFG = path.join(DIR, 'store.json');
const DATA = path.join(DIR, 'store-data.json');
const PLAY_PACKAGE = 'com.warpvanguard.game'; // android/app/build.gradle applicationId; npm test pins the two agree

const readJson = (f, fb) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return fb; } };
function loadData() {
  const d = readJson(DATA, null) || {};
  return { v: 1, play: { days: {}, ...(d.play || {}) }, ios: { days: {}, ...(d.ios || {}) }, log: Array.isArray(d.log) ? d.log : [] };
}
function saveData(d) {
  fs.mkdirSync(DIR, { recursive: true, mode: 0o700 });
  d.log = d.log.slice(-200);
  fs.writeFileSync(DATA, JSON.stringify(d, null, 1), { mode: 0o600 });
}
function loadConfig() { return readJson(CFG, {}) || {}; }
const keyPath = f => (f ? (path.isAbsolute(f) ? f : path.join(DIR, f)) : '');

// ---------------------------------------------------------------------------
// TEXT. Play writes its reports in UTF-16LE with a byte-order mark; Apple gzips
// its sales reports; everything else is UTF-8.
// ---------------------------------------------------------------------------
function decode(buf) {
  if (buf.length > 2 && buf[0] === 0x1f && buf[1] === 0x8b) buf = zlib.gunzipSync(buf);
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) return buf.slice(2).toString('utf16le');
  if (buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff) { const b = Buffer.from(buf.slice(2)); b.swap16(); return b.toString('utf16le'); }
  // UTF-16LE with no mark: every other byte of ASCII is zero
  if (buf.length > 8 && buf[1] === 0 && buf[3] === 0 && buf[0] !== 0) return buf.toString('utf16le');
  let s = buf.toString('utf8');
  if (s.charCodeAt(0) === 0xfeff) s = s.slice(1);
  return s;
}
// one delimited line → fields; quotes allowed, "" is a quote
function splitLine(line, sep) {
  const out = []; let cur = '', q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) { if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true;
    else if (c === sep) { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur);
  return out.map(s => s.trim());
}
function table(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (!lines.length) return { header: [], rows: [] };
  // skip a preamble (an App Store Connect export opens with a title and a range):
  // the header is the first line with a date column in it
  let h = lines.findIndex(l => /(^|[,\t;"])\s*(date|day|begin date)\s*("|[,\t;]|$)/i.test(l));
  if (h < 0) h = 0;
  // the delimiter that splits the header widest
  const sep = ['\t', ',', ';'].map(c => [c, splitLine(lines[h], c).length]).sort((a, b) => b[1] - a[1])[0][0];
  const all = lines.slice(h).map(l => splitLine(l, sep));
  return { header: all[0], rows: all.slice(1) };
}
const num = s => { const n = Number(String(s == null ? '' : s).replace(/[,\s]/g, '')); return Number.isFinite(n) ? n : 0; };
const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const pad2 = n => String(n).padStart(2, '0');
// → 'YYYY-MM-DD', or null. A slashed date is read as Apple writes it: month first.
function isoDay(s) {
  s = String(s || '').trim();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  if (m) return m[1] + '-' + pad2(m[2]) + '-' + pad2(m[3]);
  m = /^(\d{4})(\d{2})(\d{2})$/.exec(s);
  if (m) return m[1] + '-' + m[2] + '-' + m[3];
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if (m) return m[3] + '-' + pad2(m[1]) + '-' + pad2(m[2]);
  m = /^([A-Za-z]{3})[a-z]*\.? (\d{1,2}),? (\d{4})$/.exec(s);
  if (m && MONTHS[m[1].toLowerCase()]) return m[3] + '-' + pad2(MONTHS[m[1].toLowerCase()]) + '-' + pad2(m[2]);
  m = /^(\d{1,2}) ([A-Za-z]{3})[a-z]* (\d{4})$/.exec(s);
  if (m && MONTHS[m[2].toLowerCase()]) return m[3] + '-' + pad2(MONTHS[m[2].toLowerCase()]) + '-' + pad2(m[1]);
  return null;
}
const col = (header, names) => { for (const n of names) { const i = header.findIndex(h => h.toLowerCase() === n.toLowerCase()); if (i >= 0) return i; } return -1; };

// ---------------------------------------------------------------------------
// THE PARSERS. Each answers { store, kind, days: { 'YYYY-MM-DD': { metric: n } } }
// or null when the file is not its shape.
// ---------------------------------------------------------------------------
// Play's monthly overview: one row per day. The column names have moved over the
// years; the first that exists wins.
function parsePlayOverview(t) {
  const H = t.header, di = col(H, ['Date']);
  const inst = col(H, ['Daily User Installs', 'Daily Device Installs', 'Install events', 'User Installs', 'Device Installs']);
  if (di < 0 || inst < 0 || (col(H, ['Package Name']) < 0 && col(H, ['Daily Device Installs', 'Install events']) < 0)) return null;
  const un = col(H, ['Daily User Uninstalls', 'Daily Device Uninstalls', 'Uninstall events']);
  const up = col(H, ['Daily Device Upgrades', 'Update events']);
  const act = col(H, ['Active Device Installs', 'Total User Installs']);
  const days = {};
  for (const r of t.rows) {
    const d = isoDay(r[di]); if (!d) continue;
    days[d] = { installs: num(r[inst]) };
    if (un >= 0) days[d].uninstalls = num(r[un]);
    if (up >= 0) days[d].updates = num(r[up]);
    if (act >= 0) days[d].active = num(r[act]);
  }
  return { store: 'play', kind: 'Play overview report', days };
}
// Apple's DAILY SUMMARY sales report. Units by product type: 1* is a first
// download, 3* a re-download, 7* an update, IA* an in-app purchase.
const APPLE_TYPES = {
  downloads: new Set(['1', '1F', '1T', 'F1', '1E', '1EP', '1EU']),
  redownloads: new Set(['3', '3F', '3T', 'F3']),
  updates: new Set(['7', '7F', '7T', 'F7']),
  iap: new Set(['IA1', 'IA9', 'IAY', 'IAC', 'FI1']),
};
function parseAppleSales(t) {
  const H = t.header, ti = col(H, ['Product Type Identifier']), ui = col(H, ['Units']), di = col(H, ['Begin Date']);
  if (ti < 0 || ui < 0 || di < 0) return null;
  const days = {};
  for (const r of t.rows) {
    const d = isoDay(r[di]); if (!d) continue;
    const k = Object.keys(APPLE_TYPES).find(k2 => APPLE_TYPES[k2].has(String(r[ti]).trim()));
    if (!k) continue;
    const e = days[d] || (days[d] = { downloads: 0, redownloads: 0, updates: 0, iap: 0 });
    e[k] += num(r[ui]);
  }
  return { store: 'ios', kind: 'App Store sales report', days };
}
// Anything else with a date column and a count beside it: an App Store Connect
// analytics export ("Total Downloads", "First-Time Downloads"), a Play Console chart
// export, or a hand-made `date,installs`. The store comes from the upload control.
function parseGeneric(t, store) {
  const H = t.header;
  const di = H.findIndex(h => /^(date|day)$/i.test(h));
  if (di < 0) return null;
  let vi = H.findIndex((h, i) => i !== di && /(first.time downloads|total downloads|downloads|installs|acquisitions|units|install events)/i.test(h));
  if (vi < 0) vi = H.findIndex((h, i) => i !== di && t.rows.some(r => /^[\d,.\s]+$/.test(r[i] || '')));
  if (vi < 0) return null;
  const key = store === 'ios' ? 'downloads' : 'installs';
  const days = {};
  for (const r of t.rows) { const d = isoDay(r[di]); if (d) days[d] = { [key]: num(r[vi]) }; }
  return { store, kind: 'two-column export (' + H[vi] + ')', days };
}
function parseUpload(buf, store) {
  const t = table(decode(buf));
  const out = parsePlayOverview(t) || parseAppleSales(t) || (store === 'play' || store === 'ios' ? parseGeneric(t, store) : null);
  if (!out) throw new Error(store === 'play' || store === 'ios'
    ? 'no date column and count column found in this file'
    : 'not a Play overview or an Apple sales report — pick the store and upload again');
  if (!Object.keys(out.days).length) throw new Error('the file has no dated rows');
  return out;
}
function merge(data, parsed, source) {
  const s = data[parsed.store];
  for (const [d, v] of Object.entries(parsed.days)) s.days[d] = { ...(s.days[d] || {}), ...v };
  const ds = Object.keys(parsed.days).sort();
  data.log.push({ at: new Date().toISOString(), store: parsed.store, source, kind: parsed.kind, days: ds.length, from: ds[0], to: ds[ds.length - 1] });
  return { store: parsed.store, kind: parsed.kind, days: ds.length, from: ds[0], to: ds[ds.length - 1] };
}
function importUpload(buf, store, name) {
  const data = loadData();
  const r = merge(data, parseUpload(buf, store), 'upload ' + String(name || '').slice(0, 80));
  saveData(data);
  return r;
}

// ---------------------------------------------------------------------------
// SYNC: GOOGLE PLAY, through the reports bucket.
// ---------------------------------------------------------------------------
const b64url = b => Buffer.from(b).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
async function googleToken(sa) {
  const now = Math.floor(Date.now() / 1000);
  const head = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/devstorage.read_only',
    aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 }));
  const sig = b64url(crypto.sign('RSA-SHA256', Buffer.from(head + '.' + body), sa.private_key));
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=' + encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer') + '&assertion=' + head + '.' + body + '.' + sig });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) throw new Error('Google refused the service account: ' + (j.error_description || j.error || r.status));
  return j.access_token;
}
async function syncPlay(cfg) {
  const p = cfg.play || {};
  const bucket = String(p.bucket || '').replace(/^gs:\/\//, '').split('/')[0];
  if (!bucket) throw new Error('store.json has no play.bucket (the pubsite_prod_… id from Play Console → Download reports)');
  const sa = readJson(keyPath(p.keyFile || 'play-service-account.json'), null);
  if (!sa || !sa.client_email || !sa.private_key) throw new Error('no service account key at ' + keyPath(p.keyFile || 'play-service-account.json'));
  const pkg = p.package || PLAY_PACKAGE;
  const token = await googleToken(sa);
  const H = { Authorization: 'Bearer ' + token };
  const list = await fetch(`https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucket)}/o?prefix=${encodeURIComponent('stats/installs/installs_' + pkg + '_')}`, { headers: H });
  const lj = await list.json().catch(() => ({}));
  if (!list.ok) throw new Error('the bucket refused the listing (' + list.status + '): ' + ((lj.error && lj.error.message) || '') + ' — has the service account had 24 hours since it was invited?');
  const files = (lj.items || []).map(o => o.name).filter(n => /_overview\.csv$/.test(n)).sort().slice(-14);
  if (!files.length) throw new Error('no installs overview reports in the bucket yet (Play writes the first one a few days after the first install)');
  const data = loadData(); const done = [];
  for (const f of files) {
    const r = await fetch(`https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(f)}?alt=media`, { headers: H });
    if (!r.ok) throw new Error('could not read ' + f + ' (' + r.status + ')');
    const parsed = parsePlayOverview(table(decode(Buffer.from(await r.arrayBuffer()))));
    if (parsed) done.push(merge(data, parsed, 'sync ' + path.basename(f)));
  }
  data.play.syncedAt = new Date().toISOString();
  saveData(data);
  return { store: 'play', files: done.length, days: done.reduce((n, x) => n + x.days, 0) };
}

// ---------------------------------------------------------------------------
// SYNC: THE APP STORE, through Sales and Trends.
// ---------------------------------------------------------------------------
function appleToken(a) {
  const p8 = fs.readFileSync(keyPath(a.keyFile || ('AuthKey_' + a.keyId + '.p8')), 'utf8');
  const now = Math.floor(Date.now() / 1000);
  const head = b64url(JSON.stringify({ alg: 'ES256', kid: a.keyId, typ: 'JWT' }));
  const body = b64url(JSON.stringify({ iss: a.issuerId, iat: now, exp: now + 1100, aud: 'appstoreconnect-v1' }));
  const sig = b64url(crypto.sign('sha256', Buffer.from(head + '.' + body), { key: p8, dsaEncoding: 'ieee-p1363' }));
  return head + '.' + body + '.' + sig;
}
const dayStr = t => new Date(t).toISOString().slice(0, 10);
async function syncAppStore(cfg) {
  const a = cfg.appstore || {};
  for (const k of ['issuerId', 'keyId', 'vendor']) if (!a[k]) throw new Error('store.json has no appstore.' + k);
  const data = loadData();
  // from the day after the newest one held (or 90 days back), to yesterday in Apple's own day
  const held = Object.keys(data.ios.days).filter(d => data.ios.days[d].src === 'api').sort();
  let t = held.length ? Date.parse(held[held.length - 1] + 'T00:00:00Z') + 864e5 : Date.now() - 90 * 864e5;
  const last = Date.now() - 864e5 * 1.5;
  let token = appleToken(a), minted = Date.now(), n = 0, empty = 0;
  for (; t <= last && n < 120; t += 864e5, n++) {
    if (Date.now() - minted > 15 * 60e3) { token = appleToken(a); minted = Date.now(); }
    const d = dayStr(t);
    const q = new URLSearchParams({ 'filter[frequency]': 'DAILY', 'filter[reportDate]': d, 'filter[reportSubType]': 'SUMMARY',
      'filter[reportType]': 'SALES', 'filter[vendorNumber]': String(a.vendor), 'filter[version]': '1_1' });
    const r = await fetch('https://api.appstoreconnect.apple.com/v1/salesReports?' + q, { headers: { Authorization: 'Bearer ' + token, Accept: 'application/a-gzip' } });
    if (r.status === 404) { data.ios.days[d] = { downloads: 0, redownloads: 0, updates: 0, iap: 0, src: 'api' }; empty++; continue; } // no sales that day
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      const e = j.errors && j.errors[0];
      throw new Error('App Store Connect refused ' + d + ' (' + r.status + '): ' + (e ? e.detail || e.title : '') + (r.status === 401 ? ' — check the key id, issuer id and .p8' : ''));
    }
    const parsed = parseAppleSales(table(decode(Buffer.from(await r.arrayBuffer()))));
    const v = (parsed && parsed.days[d]) || { downloads: 0, redownloads: 0, updates: 0, iap: 0 };
    data.ios.days[d] = { ...v, src: 'api' };
  }
  data.ios.syncedAt = new Date().toISOString();
  data.log.push({ at: data.ios.syncedAt, store: 'ios', source: 'sync Sales and Trends', kind: 'App Store sales report', days: n, empty });
  saveData(data);
  return { store: 'ios', days: n, empty };
}

// what the page may know: the days, the log, and which credentials are present
function status() {
  const cfg = loadConfig(), data = loadData();
  const p = cfg.play || {}, a = cfg.appstore || {};
  const playKey = keyPath(p.keyFile || 'play-service-account.json');
  const appleKey = a.keyId ? keyPath(a.keyFile || ('AuthKey_' + a.keyId + '.p8')) : '';
  const clean = days => Object.fromEntries(Object.entries(days).map(([d, v]) => { const { src, ...rest } = v; return [d, rest]; }));
  return {
    dir: DIR,
    play: { ready: !!(p.bucket && fs.existsSync(playKey)), bucket: !!p.bucket, key: fs.existsSync(playKey), syncedAt: data.play.syncedAt || null, days: clean(data.play.days) },
    ios: { ready: !!(a.issuerId && a.keyId && a.vendor && appleKey && fs.existsSync(appleKey)), ids: !!(a.issuerId && a.keyId && a.vendor),
      key: !!(appleKey && fs.existsSync(appleKey)), syncedAt: data.ios.syncedAt || null, days: clean(data.ios.days) },
    log: data.log.slice(-12).reverse(),
  };
}
async function sync(which) {
  const cfg = loadConfig(), out = [];
  if (which === 'play' || which === 'all') out.push(await syncPlay(cfg).catch(e => ({ store: 'play', error: e.message })));
  if (which === 'ios' || which === 'all') out.push(await syncAppStore(cfg).catch(e => ({ store: 'ios', error: e.message })));
  return out;
}

module.exports = { DIR, decode, table, isoDay, parsePlayOverview, parseAppleSales, parseGeneric, parseUpload, importUpload, status, sync, appleToken, PLAY_PACKAGE };
