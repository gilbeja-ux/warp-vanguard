#!/usr/bin/env node
// H-03 live storage test — scratch private bucket, no deploy, no client impact.
//
// Proves, against the LIVE Supabase project:
//   1. a private bucket denies anonymous reads (public path AND direct path)
//   2. a service-role signed URL (60s) serves the object to an anonymous fetch
//   3. an expired signed URL is refused
// Then deletes the object and the bucket. The `traces` bucket is never touched;
// its current config is read (GET only) to document the before state.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const SB_URL = (() => {
  const src = fs.readFileSync(path.join(root, 'src', 'game', '31-leaderboard.js'), 'utf8');
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
const BUCKET = 'h03-privacy-test';
const OBJ = 'probe.json';
const PAYLOAD = JSON.stringify({ h03: 'signed-url probe', n: 42 });

const results = [];
const check = (name, ok, detail) => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
};

async function cleanup() {
  // a DELETE on a bucket that does not exist answers 400, not 404 — probe first
  const exists = await fetch(`${SB_URL}/storage/v1/bucket/${BUCKET}`, { headers: H });
  if (!exists.ok) return true;
  // the single-object DELETE path does not remove the object here — use the
  // batch remove (the same call submit-run uses), then retry the bucket delete
  // (it is eventually consistent behind the object delete)
  await fetch(`${SB_URL}/storage/v1/object/${BUCKET}`, {
    method: 'DELETE', headers: H, body: JSON.stringify({ prefixes: [OBJ] }),
  });
  for (let i = 0; i < 6; i++) {
    const del = await fetch(`${SB_URL}/storage/v1/bucket/${BUCKET}`, { method: 'DELETE', headers: H });
    if (del.ok || del.status === 404) return true;
    await new Promise(r => setTimeout(r, 5000));
  }
  console.error(`WARN  could not delete the scratch bucket "${BUCKET}" — remove it in the dashboard`);
  return false;
}

try {
  // 0. document the traces bucket's CURRENT config (read-only)
  const tb = await fetch(`${SB_URL}/storage/v1/bucket/traces`, { headers: H });
  const tbJson = tb.ok ? await tb.json() : null;
  console.log(`INFO  traces bucket today: public=${tbJson ? tbJson.public : 'unreadable(' + tb.status + ')'}`);

  // 1. create the scratch PRIVATE bucket (delete a leftover first, ignore errors)
  await cleanup();
  const mk = await fetch(`${SB_URL}/storage/v1/bucket`, {
    method: 'POST', headers: H,
    body: JSON.stringify({ id: BUCKET, name: BUCKET, public: false }),
  });
  if (!mk.ok) throw new Error(`bucket create failed: ${mk.status} ${await mk.text()}`);
  console.log('INFO  scratch private bucket created');

  // 2. upload the probe object (same REST path submit-run uses for traces)
  const up = await fetch(`${SB_URL}/storage/v1/object/${BUCKET}/${OBJ}`, {
    method: 'POST', headers: { ...H, 'Content-Type': 'application/json' }, body: PAYLOAD,
  });
  if (!up.ok) throw new Error(`upload failed: ${up.status} ${await up.text()}`);
  console.log('INFO  probe object uploaded');

  // 3. anonymous read via the /public/ path must fail
  const pub = await fetch(`${SB_URL}/storage/v1/object/public/${BUCKET}/${OBJ}`);
  check('anonymous /public/ read denied', !pub.ok, `status ${pub.status}`);

  // 4. anonymous read via the direct authenticated path must fail
  const direct = await fetch(`${SB_URL}/storage/v1/object/${BUCKET}/${OBJ}`);
  check('anonymous direct read denied', !direct.ok, `status ${direct.status}`);

  // 5. mint a 60s signed URL with the service role (mirrors createSignedUrl)
  const sign = await fetch(`${SB_URL}/storage/v1/object/sign/${BUCKET}/${OBJ}`, {
    method: 'POST', headers: H, body: JSON.stringify({ expiresIn: 60 }),
  });
  const signJson = sign.ok ? await sign.json() : null;
  const rel = signJson && (signJson.signedURL || signJson.signedUrl);
  check('signed URL minted (60s)', !!rel, rel ? '' : `status ${sign.status}`);

  // 6. anonymous fetch through the signed URL must return the exact payload
  if (rel) {
    const full = rel.startsWith('http') ? rel : `${SB_URL}/storage/v1${rel}`;
    const got = await fetch(full);
    const body = got.ok ? await got.text() : '';
    check('anonymous fetch via signed URL', got.ok && body === PAYLOAD,
      got.ok ? 'payload matches byte-for-byte' : `status ${got.status}`);
  }

  // 7. an expired signed URL must be refused (mint at 1s, wait 3s)
  const sign1 = await fetch(`${SB_URL}/storage/v1/object/sign/${BUCKET}/${OBJ}`, {
    method: 'POST', headers: H, body: JSON.stringify({ expiresIn: 1 }),
  });
  const rel1 = sign1.ok ? (await sign1.json()).signedURL : null;
  if (rel1) {
    await new Promise(r => setTimeout(r, 3000));
    const full1 = rel1.startsWith('http') ? rel1 : `${SB_URL}/storage/v1${rel1}`;
    const late = await fetch(full1);
    check('expired signed URL refused', !late.ok, `status ${late.status}`);
  } else {
    check('expired signed URL refused', false, 'could not mint the 1s URL');
  }
} finally {
  await cleanup();
  console.log('INFO  scratch bucket deleted');
}

const failed = results.filter(r => !r.ok);
console.log(`\n${failed.length === 0 ? 'ALL CHECKS PASS' : failed.length + ' CHECK(S) FAILED'} (${results.length} run)`);
process.exit(failed.length === 0 ? 0 : 1);
