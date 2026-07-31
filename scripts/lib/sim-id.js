'use strict';
// A short fingerprint of everything the verifier simulates: the game source and
// the campaign data. Two builds share an id exactly when they would score a run
// identically.
//
// This exists because the leaderboard's worst failure is silent. Change the sim,
// forget to redeploy, and every submission comes back "verification failed
// [48320 vs 52620]" — which reads as a scoring bug and is not one. It has cost
// this project two debugging sessions. Comparing ids turns that into a fact you
// can check in one command: scripts/verifier-status.js.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { gameSource } = require('./game-source.js');

function simId(root) {
  const campaigns = fs.readFileSync(path.join(root, 'src', 'campaigns.js'), 'utf8');
  return crypto.createHash('sha256').update(campaigns).update(gameSource(root)).digest('hex').slice(0, 12);
}

module.exports = { simId };
