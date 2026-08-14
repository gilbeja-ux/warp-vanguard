'use strict';
/*
 * The fingerprint's acceptance test, as a standalone process.
 *
 * IT CANNOT LIVE INSIDE scripts/test.js. computeLevels() installs its own DOM
 * stubs, which replaces global.window — inside that harness it swaps the music
 * manifest out from under the running game and fails an unrelated test three
 * thousand lines away. A build-time tool has no business sharing a process with
 * the sim it is measuring.
 *
 * Proves the two claims that justify replacing a whole-source hash:
 *   · something the sim never reads moves NO board id
 *   · a change to one relay's traffic moves THAT relay and nothing else
 *
 * Prints one JSON line prefixed FPRESULT. Restores every file it touched.
 */
const fs = require('fs');
const path = require('path');
const fp = require('./sim-fingerprint.js');

const root = path.join(__dirname, '..', '..');
const hud = path.join(root, 'src', 'game', '90-hud.js');
const camp = path.join(root, 'src', 'campaigns.js');
const SPAWN = 'spawnMin: 1.50';

const base = fp.computeLevels(root);
const keys = Object.keys(base);
const hud0 = fs.readFileSync(hud, 'utf8');
const camp0 = fs.readFileSync(camp, 'utf8');

let artMoved = -1;
let simMoved = ['<not run>'];
try {
  // 1. a comment the sim never reads
  fs.writeFileSync(hud, hud0 + '\n// a comment the sim never reads\n');
  const art = fp.computeLevels(root);
  artMoved = keys.filter(k => base[k] !== art[k]).length;
  fs.writeFileSync(hud, hud0);

  // 2. one relay's traffic
  const at = camp0.indexOf(SPAWN);
  if (at < 0) throw new Error('the probe\'s anchor ' + SPAWN + ' is no longer in campaigns.js');
  fs.writeFileSync(camp, camp0.slice(0, at) + 'spawnMin: 1.10' + camp0.slice(at + SPAWN.length));
  const sim = fp.computeLevels(root);
  simMoved = keys.filter(k => base[k] !== sim[k]);
} finally {
  // restored whatever happened — this process edits the working tree
  fs.writeFileSync(hud, hud0);
  fs.writeFileSync(camp, camp0);
}

process.stdout.write('FPRESULT' + JSON.stringify({
  boards: keys.length,
  unique: new Set(Object.values(base)).size,
  weekly: !!base.weekly,
  artMoved,
  simMoved
}));
