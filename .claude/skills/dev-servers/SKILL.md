---
name: dev-servers
description: Run, check, and keep alive this repo's long-lived local servers — the game (8000), the labs (8010–8016), the portal (8100) and the admin console (8200); the full port map is in CLAUDE.md. Use before or after editing src/index.html, src/campaigns.js or docs/lab/story.json, whenever a server may have been stopped, and any time the user says a lab or the game "is gone", "is down", or "not available".
---

# Dev servers

Three long-lived servers. Gil keeps them open in browser tabs across whole
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
| 8020 | `npm run test:smoke` | the browser smoke suite's own server; never a tab |
| 8100 | `npm run portal` | portal: every tool above, live or dead |
| 8200 | `npm run admin` | admin console (holds the service key) |

The map is law (CLAUDE.md, **THE PORT MAP**) and `npm test` pins every row. A new lab
takes the next free port after 8016. The first three rows are the ones Gil keeps open
all day; `lab:dest` reads *and writes* the `DEST-*` regions of the game source, and
`lab:disc` writes back to `src/campaigns.js`.

## The one rule

**A source edit never requires a server restart.** All three re-read from disk on
every request — `serve.js` streams out of `src/` per request, and both labs call
`readGame()` / `readStory()` inside the request handler. Editing
`src/index.html` and hitting refresh is the entire loop.

So the *only* reason a server is ever down is that it was killed. In practice
that means killed by me: a stray `pkill -f`, a `kill %1`, or a foreground
`node scripts/…` that ended with the tool call.

Corollaries worth holding:

- **Never `pkill -f node`** or anything that pattern-matches broadly. It takes
  out all three plus whatever else Gil is running.
- **Always launch with `run_in_background: true`.** A foreground launch dies with
  the tool call and looks like it worked.
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

Start anything reported DOWN with `npm run <script>` and
`run_in_background: true`, one Bash call each, then re-run the loop to confirm.

## When a rebuild *is* needed

`npm run build` regenerates exactly one thing: `src/audio/music/tracks.js`, the
run-pool track list, from the filenames in `src/audio/music/`. Run it after
adding, removing or renaming a music file — the server does not need restarting,
only the file regenerating. `npm run icons` is the same story for `src/icons/`.

Neither has anything to do with a server being down.

## After editing src/index.html or src/campaigns.js

Separate standing rule, unrelated to the servers but triggered by the same
edits: rebuild the replay verifier or leaderboard submissions get rejected.

```bash
npm run build:verifier && node scripts/test-verifier-bundle.mjs
```

If the bundle still reproduces every campaign score, the change was
rendering-only and **no deploy is needed**. Only a change that moves a score
needs `npm run deploy:verifier`.
