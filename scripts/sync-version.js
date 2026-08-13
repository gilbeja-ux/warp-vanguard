#!/usr/bin/env node
/*
 * ONE VERSION, THREE PLACES. package.json is the source of truth; this writes
 * `versionName` and `versionCode` into android/app/build.gradle so a release
 * can never ship with the repo saying one thing and the store another.
 *
 * versionCode is DERIVED, not counted: major*10000 + minor*100 + patch, so
 * 1.0.0 -> 10000 and 1.2.3 -> 10203. That guarantees the number rises with the
 * version — Play rejects an upload whose versionCode has not increased, and it
 * can never be reused, so "I bumped the name but forgot the code" is a wasted
 * upload slot. A derived number cannot forget.
 *
 * `--bump patch|minor|major` moves package.json first, then syncs.
 *   node scripts/sync-version.js              # sync only
 *   node scripts/sync-version.js --bump patch # 1.0.0 -> 1.0.1, then sync
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const PKG = path.join(ROOT, 'package.json');
const GRADLE = path.join(ROOT, 'android', 'app', 'build.gradle');

const pkg = JSON.parse(fs.readFileSync(PKG, 'utf8'));
const bump = (process.argv.find(a => a.startsWith('--bump')) || '').split('=')[1]
  || (process.argv.includes('--bump') ? process.argv[process.argv.indexOf('--bump') + 1] : null);

let [maj, min, pat] = pkg.version.split('.').map(n => parseInt(n, 10) || 0);
if (bump === 'major') { maj++; min = 0; pat = 0; }
else if (bump === 'minor') { min++; pat = 0; }
else if (bump === 'patch') { pat++; }
else if (bump) { console.error('unknown --bump: ' + bump); process.exit(1); }

const version = `${maj}.${min}.${pat}`;
if (version !== pkg.version) {
  pkg.version = version;
  fs.writeFileSync(PKG, JSON.stringify(pkg, null, 2) + '\n');
}
if (maj > 99 || min > 99 || pat > 99) {
  console.error('a component exceeds 99 — the versionCode formula would collide. Widen it here first.');
  process.exit(1);
}
const code = maj * 10000 + min * 100 + pat;

let g = fs.readFileSync(GRADLE, 'utf8');
const before = g;
g = g.replace(/versionCode\s+\d+/, 'versionCode ' + code);
g = g.replace(/versionName\s+"[^"]*"/, 'versionName "' + version + '"');
if (g === before && !/versionCode\s+\d+/.test(before)) {
  console.error('could not find versionCode/versionName in build.gradle');
  process.exit(1);
}
fs.writeFileSync(GRADLE, g);
console.log(`version ${version}  →  versionName "${version}"  versionCode ${code}`);
