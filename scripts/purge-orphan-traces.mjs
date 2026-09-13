#!/usr/bin/env node
// Delete the replay files whose board row is gone.
//
// Found 2026-09-08 (audit A4): the boards were wiped on 2026-09-02, the traces
// bucket was not. Every object there is named <board>/<playerId>-<uuid>.json and
// holds a player's inputs — personal data that outlived the row that justified
// it. submit-run purges the traces of rows IT evicts; nothing else ever sweeps.
//
// DRY RUN by default: lists the orphans and stops. `--delete` removes them, one
// hundred at a time, the way my-data/index.ts does. The service key comes from
// SUPABASE_SERVICE_ROLE_KEY or the linked CLI, exactly as test-storage-privacy.mjs.
//
//   node scripts/purge-orphan-traces.mjs            # count and list
//   node scripts/purge-orphan-traces.mjs --delete   # remove them
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SB_URL = (() => {
  const src = fs.readFileSync(path.join(ROOT, 'src', 'game', '31-leaderboard.js'), 'utf8');
  const m = /url:\s*'(https:\/\/[a-z0-9]+\.supabase\.co)'/.exec(src);
  if (!m) throw new Error('no Supabase url in 31-leaderboard.js');
  return m[1];
})();
const REF = /https:\/\/([a-z0-9]+)\./.exec(SB_URL)[1];
const KEY = (() => {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) return process.env.SUPABASE_SERVICE_ROLE_KEY.trim();
  const out = execFileSync('supabase', ['projects', 'api-keys', '--project-ref', REF, '-o', 'json'],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  const k = JSON.parse(out).find(r => r.name === 'service_role');
  if (!k || !k.api_key) throw new Error('no service_role key from the CLI');
  return k.api_key;
})();
const H = { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' };
const DELETE = process.argv.includes('--delete');

async function list(prefix) {
  const out = [];
  for (let offset = 0; ; offset += 1000) {
    const r = await fetch(`${SB_URL}/storage/v1/object/list/traces`, { method: 'POST', headers: H,
      body: JSON.stringify({ prefix, limit: 1000, offset, sortBy: { column: 'name', order: 'asc' } }) });
    if (!r.ok) throw new Error(`list ${prefix || '/'}: HTTP ${r.status} ${(await r.text()).slice(0, 200)}`);
    const rows = await r.json();
    out.push(...rows);
    if (rows.length < 1000) break;
  }
  return out;
}

// the bucket is one level of board folders, then files; the folders are
// independent, so they are listed together
const folders = (await list('')).filter(e => e.id === null).map(e => e.name);
const listAll = async fs => (await Promise.all(fs.map(async f => (await list(f)).filter(e => e.id !== null).map(e => f + '/' + e.name)))).flat();
const objects = await listAll(folders);

// EVERY live pointer, not the first thousand. PostgREST caps a response at
// max_rows (1000); 41 boards × 100 rows plus every frozen week is more than
// that in the steady state, and a truncated set here would call live replays
// orphans and delete them. So: Range pages until a short one.
const live = new Set();
for (let from = 0; ; from += 1000) {
  const rr = await fetch(`${SB_URL}/rest/v1/runs?select=trace_id&trace_id=not.is.null&order=id`, { headers: { ...H, Range: `${from}-${from + 999}` } });
  if (!rr.ok && rr.status !== 416) throw new Error(`runs: HTTP ${rr.status}`);
  const rows = rr.status === 416 ? [] : await rr.json();
  for (const row of rows) live.add(row.trace_id);
  if (rows.length < 1000) break;
}

const orphans = objects.filter(k => !live.has(k));
console.log(`traces bucket: ${objects.length} objects in ${folders.length} board folders; ${live.size} referenced by a row; ${orphans.length} orphans`);
for (const k of orphans.slice(0, 12)) console.log('  ' + k);
if (orphans.length > 12) console.log(`  … and ${orphans.length - 12} more`);

if (!DELETE) { console.log('\ndry run — nothing removed. Re-run with --delete to remove the orphans.'); process.exit(0); }

let removed = 0;
for (let i = 0; i < orphans.length; i += 100) {
  const batch = orphans.slice(i, i + 100);
  const r = await fetch(`${SB_URL}/storage/v1/object/traces`, { method: 'DELETE', headers: H, body: JSON.stringify({ prefixes: batch }) });
  if (!r.ok) throw new Error(`remove: HTTP ${r.status} ${(await r.text()).slice(0, 200)}`);
  removed += (await r.json()).length;
}
const after = await listAll([...new Set(orphans.map(k => k.split('/')[0]))]);
const left = after.filter(k => !live.has(k)).length;
console.log(`removed ${removed}; the swept folders now hold ${after.length} objects, ${left} orphans`);
process.exit(left === 0 ? 0 : 1);
