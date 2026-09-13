#!/usr/bin/env bash
# Build, cross-test, deploy and PROBE the leaderboard verifier — one command.
#
# Found 2026-09-08: `deploy:verifier` was build && deploy, and stopped there. It
# never ran the bundle cross-test first, and it never asked the live function
# which sim id it now carries — which is the one fact that matters, and the
# fact scripts/verifier-status.js exists to report. A deploy that ends without
# that probe is a success line, not a success.
#
#   npm run deploy:verifier                  # strict: only this sim id verifies
#   npm run deploy:verifier -- --compatible  # this id AND the recent ones (0 boards moved)
set -euo pipefail
cd "$(dirname "$0")/.."

# THE DATABASE FIRST. The function calls take_submit_slot and the 18-argument
# submit_verified_run; deployed against a database that has not had its
# migrations pushed, every submission is a 500 — and the ?diag probe below
# would still be green, because it never touches a table. So a pending
# migration stops the deploy here.
pending="$(supabase migration list 2>/dev/null | node -e '
  let s = ""; process.stdin.on("data", d => s += d).on("end", () => {
    const m = /\{"migrations":[\s\S]*\}/.exec(s); if (!m) { console.log("?"); return; }
    const rows = JSON.parse(m[0]).migrations || [];
    console.log(rows.filter(r => r.local && !r.remote).map(r => r.local).join(" "));
  });')"
if [ "$pending" = "?" ]; then echo "! could not read the migration list — is the project linked?"; exit 1; fi
if [ -n "$pending" ]; then
  echo "✗ migrations not on the live database yet: $pending"
  echo "  run: supabase db push   (then this again)"
  exit 1
fi

node scripts/build-verifier.js "$@"
node scripts/test-verifier-bundle.mjs
# --use-api: this Mac has no Docker, and the API path needs none
supabase functions deploy submit-run --use-api
echo ""
echo "── probing the live function ──"
node scripts/verifier-status.js
