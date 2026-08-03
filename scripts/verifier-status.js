#!/usr/bin/env node
// Is the DEPLOYED leaderboard verifier still the sim you are playing?
//
//   npm run verifier:status
//
// The leaderboard's worst failure mode is silent. Change the sim, forget to
// redeploy, and the server replays every submission against the old rules and
// rejects the lot — surfacing in-game as "verification failed [48320 vs 52620]",
// which reads as a scoring bug and is not one. It has cost this project two
// debugging sessions, so it is now one command and one number.
//
// Exit 0 = in sync. Exit 1 = stale (or unreachable), and it says what to run.
'use strict';
const path = require('path');
const root = path.join(__dirname, '..');
const { simId } = require('./lib/sim-id.js');

const BASE = 'https://ghkbjlgcdrszkawfbxdr.supabase.co';
const KEY = 'sb_publishable_B3MngfknmPrLc-uo0ho11A_Jnmphekl';

(async () => {
  const local = simId(root);
  process.stdout.write(`local  sim id: ${local}\n`);

  let deployed = null, why = null;
  try {
    // ?diag=1 runs _diag(), which reports the id its bundle was cut from — and
    // does it by loading and stepping the sim, so a pass also proves the deployed
    // bundle still boots in the edge runtime
    const res = await fetch(BASE + '/functions/v1/submit-run?diag=1', {
      method: 'GET',
      headers: { apikey: KEY, Authorization: 'Bearer ' + KEY },
    });
    const body = await res.json().catch(() => ({}));
    if (body.loadError) why = 'the deployed bundle fails to load: ' + String(body.loadError).slice(0, 200);
    else if (!body.simId) why = 'the deployed verifier predates sim ids — it is definitely older than this checkout';
    else deployed = body.simId;
  } catch (e) {
    why = 'could not reach the function: ' + e.message;
  }

  process.stdout.write(`server sim id: ${deployed || '(none)'}\n\n`);

  if (deployed && deployed === local) {
    process.stdout.write('IN SYNC — submitted scores will verify.\n');
    process.exit(0);
  }
  process.stdout.write('STALE — the server is simulating a different game.\n');
  if (why) process.stdout.write('  ' + why + '\n');
  process.stdout.write('  Every campaign/weekly submission will be REJECTED until you run:\n');
  process.stdout.write('    npm run deploy:verifier\n');
  process.exit(1);
})();
