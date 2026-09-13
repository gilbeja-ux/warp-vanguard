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

// A REPLACE THAT MATCHED NOTHING IS A FAILURE, NOT A NO-OP. Found 2026-09-08:
// the iOS branch printed its success line with zero matches, and the gradle
// guard passed when versionName was missing as long as versionCode existed.
// Every pattern must match at least once, and the file is read back after the
// write so the log line reports what is on disk, not what was intended.
function sub(text, re, to, label) {
  const n = (text.match(re) || []).length;
  if (n === 0) { console.error(`could not find ${label} — nothing to sync`); process.exit(1); }
  return text.replace(re, to);
}
let g = fs.readFileSync(GRADLE, 'utf8');
g = sub(g, /versionCode\s+\d+/, 'versionCode ' + code, 'versionCode in build.gradle');
g = sub(g, /versionName\s+"[^"]*"/, 'versionName "' + version + '"', 'versionName in build.gradle');
fs.writeFileSync(GRADLE, g);
const gBack = fs.readFileSync(GRADLE, 'utf8');
if (!gBack.includes('versionCode ' + code) || !gBack.includes('versionName "' + version + '"')) {
  console.error('build.gradle did not take the version after the write'); process.exit(1);
}
console.log(`android  versionName "${version}"  versionCode ${code}`);

// ---- iOS, when the platform exists ----
// Same rule, same source. Apple rejects a build whose CFBundleVersion has not
// risen within a version train, exactly as Play does with versionCode — so the
// number is derived here too rather than typed into Xcode, where nobody would
// remember to move it.
const PBX = path.join(ROOT, 'ios', 'App', 'App.xcodeproj', 'project.pbxproj');
if (fs.existsSync(PBX)) {
  let x = fs.readFileSync(PBX, 'utf8');
  x = sub(x, /CURRENT_PROJECT_VERSION = [^;]*;/g, 'CURRENT_PROJECT_VERSION = ' + code + ';', 'CURRENT_PROJECT_VERSION in project.pbxproj');
  x = sub(x, /MARKETING_VERSION = [^;]*;/g, 'MARKETING_VERSION = ' + version + ';', 'MARKETING_VERSION in project.pbxproj');
  fs.writeFileSync(PBX, x);
  const xBack = fs.readFileSync(PBX, 'utf8');
  if (new RegExp('CURRENT_PROJECT_VERSION = (?!' + code + ';)').test(xBack) || new RegExp('MARKETING_VERSION = (?!' + version.replace(/\./g, '\\.') + ';)').test(xBack)) {
    console.error('project.pbxproj still carries another version after the write'); process.exit(1);
  }
  console.log(`ios      MARKETING_VERSION ${version}  CURRENT_PROJECT_VERSION ${code}`);
}
