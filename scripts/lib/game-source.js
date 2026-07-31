'use strict';
// The game is AUTHORED as ordered topic files in src/game/ and LOADED by the
// browser as ordered <script src> tags. Anything that needs the whole sim as one
// string — the headless test harness, the anti-cheat verifier bundle — gets it
// from here instead of scraping an inline <script> out of index.html.
//
// Load order is the manifest's order, and it is load-bearing: top-level code in
// one file may reference declarations from earlier files, exactly as it did when
// this was a single script.
const fs = require('fs');
const path = require('path');

const PROLOGUE = "'use strict';\n";

function manifestPath(root) { return path.join(root, 'src', 'game', 'manifest.json'); }

// ordered filenames, e.g. ['00-core.js', '10-audio.js', …]
function gameFileNames(root) {
  return JSON.parse(fs.readFileSync(manifestPath(root), 'utf8')).files.map(f => f.file);
}

// The concatenated game source, byte-identical to the single inline <script>
// this replaced. Every file after the first carries its own 'use strict';
// because strict mode is per-script for classic tags — stripped back off here so
// the join reproduces the original exactly, with one directive at the top.
function gameSource(root) {
  const dir = path.join(root, 'src', 'game');
  return gameFileNames(root)
    .map(f => {
      const text = fs.readFileSync(path.join(dir, f), 'utf8');
      return text.startsWith(PROLOGUE) ? text.slice(PROLOGUE.length) : text;
    })
    .join('\n');
}

module.exports = { gameSource, gameFileNames, manifestPath };
