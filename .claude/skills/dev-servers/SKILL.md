---
name: dev-servers
description: Run, check, and keep alive this repo's long-lived local servers — the game (8000), the labs (8010–8016), the browser watch (8017), the portal (8100) and the admin console (8200); the full port map is in CLAUDE.md. Use before or after editing src/game/*.js, src/campaigns.js or docs/lab/story.json, whenever a server may have been stopped, and any time the user says a lab or the game "is gone", "is down", or "not available".
---

# Dev servers

Long-lived servers, one port each. Gil keeps them open in browser tabs across whole
sessions, so **if one goes down he sees a dead tab, not an error message** — he
has to notice and ask. That's the failure this skill exists to prevent.

| Port | Command | Interface |
| --- | --- | --- |
| 8000 | `npm run dev` | the game, served from `src/`; also `editor.html`, the Lane Designer |
| 8010 | `npm run lab` | story lab |
| 8011 | `npm run lab:dest` | destinations lab |
| 8012 | `npm run lab:tune` | tuning board |
| 8013 | `npm run lab:disc` | disc lab |
| 8014 | `npm run lab:sound` | sfx soundboard |
| 8015 | `npm run lab:breach` | breach lab |
| 8016 | `npm run lab:leech` | leech lab |
| 8017 | `npm run browsers` | browser watch: every test browser an agent is running, live |
| 8020 | `npm run test:smoke` | the browser smoke suite's own server; never a tab |
| 8100 | `npm run portal` | portal: every tool above, live or dead |
| 8200 | `npm run admin` | admin console (holds the service key) |

The map is law (CLAUDE.md, **THE PORT MAP**) and `npm test` pins every row. A new lab
takes the next free port after 8017. The first three rows are the ones Gil keeps open
all day; `lab:dest` reads *and writes* the `DEST-*` regions of the game source, and
`lab:disc` writes back to `src/campaigns.js`.

## The one rule

**A source edit never requires a server restart.** They re-read from disk on
every request — `serve.js` streams out of `src/` per request, and the labs call
`readGame()` / `readStory()` inside the request handler (`readGame()` concatenates
the `src/game/` topic files through `scripts/lib/game-source.js`). Editing a file in
`src/game/` and hitting refresh is the entire loop.

So the *only* reason a server is ever down is that it was killed. In practice
that means killed by me: a stray `pkill -f`, a `kill %1`, or a foreground
`node scripts/…` that ended with the tool call.

Corollaries worth holding:

- **Never `pkill -f node`** or anything that pattern-matches broadly. It takes
  out every server plus whatever else Gil is running.
- **Launch DETACHED, never with `run_in_background`.** Gil, 2026-10-08: a
  `run_in_background` job dies at the two-hour background limit and takes his tab
  with it, and a foreground launch dies with the tool call and looks like it
  worked. Start every server he tests on with `nohup … & disown` (below). It
  survives the session's job limits. Never hand him the restart.
- **To inspect a lab, `curl` it — don't restart it.** `curl -s
  http://localhost:8011/api/dest-src` returns the lifted `DEST-*` regions as
  JSON; nothing needs to be stopped to read it.
- **If you do stop one, restart it in the same turn**, before you report back.

## Ensure they're up

Idempotent — starts only what's missing, safe to run at any point:

```bash
cd /Users/gilbeja/vsCode/warp-vanguard
for spec in "8000:dev" "8010:lab" "8011:lab:dest"; do   # the always-on three; the rest start on demand
  p=${spec%%:*}; s=${spec#*:}
  if curl -sf -o /dev/null -m 2 "http://localhost:$p/"; then
    echo "$p up"
  else
    echo "$p DOWN — starting \`npm run $s\`"
  fi
done
```

Start anything reported DOWN detached, one Bash call each, then re-run the loop to
confirm:

```bash
cd /Users/gilbeja/vsCode/warp-vanguard
nohup npm run lab:dest > /tmp/wv-lab-dest.log 2>&1 & disown
```

## When a rebuild *is* needed

`npm run build` does three things: it regenerates `src/audio/music/tracks.js`, the
run-pool track list, from the filenames in `src/audio/music/`; it stages `dist/`
(a copy of `src/` minus the `NEVER_SHIP` list in `scripts/build.js`), which is what
`cap sync` copies into both shells; and it stamps the sim id and the app version
into `dist/index.html`. The dev server serves `src/`, not `dist/`, so the only
build that matters to a tab is the track list: run it after adding, removing or
renaming a music file. `npm run icons` is the same story for `src/icons/`.

Neither has anything to do with a server being down.

## After editing src/game/ or src/campaigns.js

Separate standing rule, unrelated to the servers but triggered by the same
edits: rebuild the replay verifier and deploy it, or leaderboard submissions get
rejected.

```bash
npm run build:verifier && node scripts/test-verifier-bundle.mjs
```

**Every such edit deploys**, even a comment: any byte moves the sim id, and the
pre-push hook refuses to push a sim the deployed verifier does not know. The
change decides only the flag. If the fingerprint says 0 boards moved,
`npm run deploy:verifier -- --compatible`; if a board moved, or the edit touched
boss code (the fingerprint barely reaches a boss fight), `npm run deploy:verifier`
strict.
