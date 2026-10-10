# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Codebase guide

Warp Vanguard is a landscape-only, dual-thumb rhythm-action game: one full-bleed
`<canvas>`, plain JavaScript, no framework, no bundler, no runtime dependency.
`src/index.html` opens at `file://`. The same web bundle ships in Capacitor shells
for Android and iOS, and a Supabase backend holds the leaderboards. Product, story
and visual vocabulary live in `PRODUCT.md`, `BRAND.md` and `DESIGN.md`; the readable
release digest is `docs/CHANGELOG.md`; the audit backlog is `docs/HOUSEKEEPING.md`.

## Commands

| Command | What it does |
| --- | --- |
| `npm test` | The whole pin suite: `scripts/test.js` (game), `scripts/test-board.js` (tuning board), `scripts/test-sfx-levels.mjs` (skips without ffmpeg). Runs in seconds, no browser. |
| `node scripts/test.js` | The game suite alone. There is no filter flag: it is one file of `check(name, cond)` calls grouped by `// ===== section =====` banners. To run one section, read it and call the same `G.*` helpers in a scratch script, or comment out other sections in a worktree. |
| `npm run test:smoke` | The REAL game in headless Chrome over CDP, both viewports, ~90 s. Owns port 8020. `node scripts/smoke.js --viewport=phone --headed --keep` to watch it. Screenshots land in `smoke-shots/`; phone shots are rotated 90°. |
| `npm run test:coverage` | How much of the sim the per-board fingerprint battery actually exercises. |
| `npm run build` | Regenerates `src/audio/music/tracks.js` from `src/audio/music/`, stages `dist/` (a copy of `src/` minus the `NEVER_SHIP` list in `scripts/build.js`), stamps the sim id and app version into `dist/index.html`, and warns if the verifier bundle is older than the sim. |
| `npm run dev` | Build, then serve `src/` on port 8000 with `Cache-Control: no-store`. |
| `npm run lab` / `lab:dest` / `lab:tune` / `lab:disc` / `lab:sound` / `lab:breach` / `lab:leech` | Desktop tuning tools, one port each (see THE PORT MAP below). `lab:dest` writes back into the `DEST-*` regions of the game source; `lab:disc` writes back to `campaigns.js`. None of them ship. |
| `npm run build:verifier` | Bundles the sim into `supabase/functions/submit-run/_sim.mjs` (generated, never hand-edited). Follow with `node scripts/test-verifier-bundle.mjs`. |
| `npm run deploy:verifier` | Checks migrations are pushed, builds, cross-tests, deploys `submit-run` with `--use-api` (no Docker), then probes the live id. Add `-- --compatible` when the fingerprint says 0 boards moved. |
| `npm run verifier:status` | Local sim id versus the deployed one. Exit 1 means stale. |
| `npm run apk` | Debug APK to `~/Desktop/WarpVanguard.apk`, no Android Studio, no sudo. |
| `npm run aab` | Signed Play bundle. Runs `npm test` first and ends by compiling the iOS shell for the simulator. Needs `android/key.properties`. |
| `npm run ios:build` / `ios:device` / `ios:archive` | Simulator, plugged-in iPhone, App Store `.ipa`. Every target runs `sync-version.js` first. |
| `npm run version:sync` / `node scripts/sync-version.js --bump patch` | `package.json` is the only version source; `versionCode` is derived (`major*10000 + minor*100 + patch`) and written into Gradle and the Xcode project. Never edit a version by hand. |
| `npm run hooks:install` | Sets `core.hooksPath` to `.githooks/`. The pre-push hook runs `npm test` on any change under `src`, `scripts`, `android`, `ios`, `supabase`, and refuses to push a sim the deployed verifier does not know. `SKIP_TESTS=1` and `--no-verify` bypass. |
| `npm run admin` / `npm run portal` | Local moderation and tester pages against Supabase. |

The local servers sit in Gil's browser tabs for whole sessions. They re-read source on
every request, so a source edit never needs a restart. Never stop them and never
`pkill -f node`. Start one Gil tests on DETACHED, `nohup npm run <script> > /tmp/<name>.log
2>&1 & disown`, never with `run_in_background`: a background task dies at two hours and
takes the tab with it (Gil, 2026-10-08). The `dev-servers` skill in `.claude/skills/`
holds the check loop. Their ports are house law, below.

## How the game source is organised

`src/game/` holds the game as ordered topic files, `00-core.js` through `99-boot.js`.
`src/game/manifest.json` is the load order; `src/index.html` lists the same files as
`<script src>` tags in that order, and `scripts/lib/game-source.js` concatenates them
into one string for anything that needs the whole sim (the test harness, the verifier
bundle, the labs). **The order is load-bearing**: every file shares one global scope,
top-level code in a later file references declarations in an earlier one, and there
are ~600 globals by design (see `docs/REFACTOR-PLAN.md`, section 5, for what is
deliberately not being done: no ES modules, no namespacing, no bundler, no TypeScript).
`src/campaigns.js` loads before the game files and is part of the sim.

Rough map, by prefix:

- `0x`–`1x`: canvas, resize and the 90° portrait transform (`ROT`), Web Audio, music pool, decoded sfx.
- `2x`–`3x`: the deep background, the campaign package registry, Supabase identity and submission, the save blob, `installCampaign()`.
- `4x`–`5x`: run state and the run trace, geometry, enemy kinds and spawn fairness, the fairness linter, bosses.
- `6x`–`7x`: pointer/key/gamepad input, replay, the qualification curriculum, `update(dt)` in `72-tick.js`.
- `8x`: the tunnel, baked 3D stations, destinations, deep field, the glitch enemy bodies. `fireVolley()` lives in `85-enemy-art.js`, so an "art" file can still change scoring.
- `9x`: HUD kit, briefing discs (`91-briefing.js` is the disc kit), field guide, leaderboard screen, star map, menu, profiler, and `99-boot.js` with the main loop, the error net and the boot splash.

The game runs on a fixed timestep (`SIM_DT = 1/60` in `99-boot.js`). State machine
is `S` in `40-state.js` (`MENU, PLAY, END, PAUSE, INFO, GUIDE, ENLIST`). A campaign
is a JSON-shaped package in `src/campaigns.js`; the game only reads one through
`validateCampaign()` + `installCampaign()` in `33-loader.js`, which fills `LEVELS`.
Campaign levels reseed the RNG, so sim code must draw from `spawnRng()` and never
let render code touch the sim's `Math.random` stream.

## Determinism, the run trace and the verifier

A run records the two node angles, the thumb bits and the pulse fires per fixed step
(`40-state.js`). That trace is what the leaderboard submits. The Supabase Edge
Function `submit-run` is the only write path to the `runs` table: it replays the
trace headless with a bundled copy of the sim and refuses a score that does not
recompute. Endless mode is unseeded and has no board.

Two ids describe a build:

- **sim id** (`scripts/lib/sim-id.js`): a hash of `campaigns.js` plus every game file. Any byte moves it, comments included.
- **per-board fingerprint** (`scripts/lib/sim-fingerprint.js`): every ranked board played headless under a fixed input trace and hashed. Art, HUD and comments do not move it; spawn, speed and scoring do. Cached in `.sim-fingerprint.json`.

After any edit under `src/game/` or `src/campaigns.js`: `npm run build:verifier &&
node scripts/test-verifier-bundle.mjs`, then deploy. EVERY such edit deploys, even a
comment: any byte moves the sim id, and the pre-push hook refuses to push a sim the
deployed verifier does not know. What the change decides is the FLAG. If the fingerprint
says 0 boards moved, `npm run deploy:verifier -- --compatible` (the new id and the recent
ones both verify); if a board moved, `npm run deploy:verifier` strict. Skip it and every
real score comes back `REJECTED 400: verification failed [a vs b]`, which reads as a
scoring bug and is not one. The fingerprint battery sees only what it plays, and it
barely reaches boss fights, so after boss code deploy strict, not `--compatible`.

## The test harness

`scripts/test.js` stubs `document`, the 2D context and Web Audio, appends a
`globalThis.__g = { … }` export block naming the internals it needs, and `eval`s the
whole sim. Tests drive it through `G` (`G.update(dt)`, `G.startLevel(i)`,
`G.enemies()`, `G.getState()`) and the captured canvas handlers. To test a new
internal, add it to the export block near line 150. The harness also pins repo
facts: the Android and iOS decision files, CLAUDE.md phrases, migration SQL, drawn
strings. Some sections read this file, so its house-law headings must not be reworded.

`scripts/test-board.js` uses a STRICT canvas stub that throws on `NaN` coordinates,
because the permissive one once let a broken board pass headless and die in Chrome.

## Adding content: append, never insert

A board is keyed `campId:levelIdx`, and a lane's traffic is seeded from `levelIdx`
alone (`beatStream` in `50-enemies.js`, the burst stream in `72-tick.js`). Nothing in
the sim reads `LEVELS.length`; a boss lane is one with `boss: true`, not the last one.
So a level ADDED AT THE END of a contract, or a whole new contract, moves no existing
board id: every stored replay still verifies and still plays. A level INSERTED before
another, or a reorder, shifts every later `levelIdx`: the same board key now names a
different lane, the stored replays on it fail, and the saved stars and bests slide by
one. `npm test` pins both facts (section **NEW CONTENT IS APPEND-ONLY**).

New content still needs `npm run deploy:verifier` before the build ships, because the
old bundle does not know the new board; the existing ids do not move, so strict is fine.

## Backend

`supabase/` holds `schema.sql`, dated `migrations/`, and five Edge Functions:
`submit-run`, `my-data`, `report-run`, `send-feedback`, and `sim-ids`, which serves the
deployed board ids without a session so the game can mark a stale stage BEFORE it is
flown (the update mark, 2026-10-01: `UPDATE GAME TO POST SCORES` on the stage card, the
list row, the star map plate and the weekly half; a `GAME UPDATE AVAILABLE` key top-left
on the home screen). Its `_ids.mjs` is generated by `build-verifier.js` from the same
ids as the verifier bundle and deployed by `deploy:verifier` in the same run. The CLI is linked;
`supabase db push` and `supabase functions deploy <fn> --use-api` work without Docker.
Board keys (`cargo-run:6`) are persisted rows: never rename or zero-pad one. Identity is
an anonymous Supabase session per device; handles are free-typed and moderated at submit.

## Native shells

`android/` and `ios/` are mostly generated and gitignored. The tracked files carry
decisions and are pinned by `npm test`; `BUILD.md` lists each Android file with its iOS
twin. `capacitor.config.json` points `webDir` at `dist/`, so `cap sync` copies whatever
the last `npm run build` staged. The pre-push hook and `npm run aab` are the gates.

## Conventions the repo already follows

- Commit subjects are full sentences that say what changed and why, often naming the ruling or date. Stage by path.
- Comments carry the reasoning and the date of a decision; keep that when you edit near one.
- Player-facing copy uses the game's printed words (STAGE, Vanguard, warp, lane), never the code's identifiers.
- A change that only Gil can judge by eye ships with named knobs, not a screenshot loop.

# House law

## The noun is STAGE. Stages are named 01–08. There is no stage 0.

Gil settled the noun on 2026-08-27: **STAGE**, on every screen. The HUD, the star map,
the leaderboard, the replay banner, the Archive and the Lane Designer all say it. `LEVEL`
and `RELAY` are gone from player-facing copy. The CODE keeps `levelIdx`, `levelNo`,
`LEVELS` and `FLOW_UNLOCK_LEVEL` — the code's vocabulary is not the player's.

The numbers keep coming back because two different things wear a stage's index, and only
one of them is a name.

| Thing | Form | Base | Who reads it |
| --- | --- | --- | --- |
| `levelIdx`, `li` | `6` | zero | code only |
| a board key, `boardKey()` | `cargo-run:6` | zero | the leaderboard database |
| a stage's NAME | `07` | one | the player, Gil, every doc |

`lvNum(levelNo(ci, li))` is the ONE renderer for a name. `levelNo` is `campBase(ci) + li + 1`
(`33-loader.js`): the stage's place in the whole run of contracts, so names run on from
one contract to the next (`01`–`08` for the first, `09`–`16` for the second), and `lvNum`
zero-pads it.
Never build a stage name any other way — including from a bare constant such as
`FLOW_UNLOCK_LEVEL`, which printed an unpadded `5` until 2026-08-27.

### The rules

1. **Speak in display numbers, 01 to 40, and nothing else.** Gil, 2026-10-10, after
   being handed `survey:6` for the stage the nameplate calls 15: "there is only 1 and
   above, as the number says on the nameplate". Every reply, report, question, commit
   message and doc a person reads names a stage by its number across the whole game,
   01 to 40, plus its destination where that helps: **stage 15, ALTOR WATCH I**. The
   first contract's boss is **stage 08**, the second's **stage 16**. Never a board key,
   never a zero-based index, never "the 7th level of THE SURVEY".
2. **A board key is an id, not a name, and it stays in the code.** `survey:6` is what
   a Supabase row, a test or a log line holds; translate it before a person reads it
   (`lvNum(levelNo(ci, li))`). When a key truly has to be quoted — a SQL query, a
   failing check's output — put the stage number next to it. Never zero-pad a key —
   `survey:07` is an index wearing a name's clothes.
3. **Code keeps `levelIdx`.** Do not renumber the internal index, and do not rename a
   board key. Board keys are persisted rows in Supabase; renaming one orphans every
   score on it.
4. **Nothing on any screen shows a bare index.** Every player-visible number goes
   through `lvNum`.
5. **On the star map a plate rides the world its level DEPARTS from.** Gil's ruling,
   2026-08-27. Plate `01` sits on the core the convoy forms up at; plate `02` sits on
   DRAOS MINOR I, which level 01 delivered to and level 02 leaves; plate `08` sits on
   the boss run's departure. The chain's last world ends a lane and starts none, so it
   carries the caption `DESTINATION`, never a hexagon — a hexagon there reads as a ninth
   stage. A plate's position comes off `SEGS[i][0]`, the level's own leg, never off
   `relayDestPos` — the core is not a relay and has no index to look up.

   The **stage list still names a stage by its destination** (`01 DRAOS MINOR I`), and
   that is deliberate: the map's job is "which lane is this", the list's job is "where
   does it go". Do not "fix" the disagreement.

### The guard

`scripts/test.js`, section **STAGE NUMBERS: THERE IS NO STAGE 0**, pins all of it: the
two helpers, every call site in every drawing file, the star map plate riding a departure,
the `DESTINATION` caption, the STAGE noun on every drawn string, and the names end to end
— `01` for the first lane, `08` for its boss, `09` where the second contract picks up, no
`00` anywhere, and no two stages sharing a name. `npm test` fails if any of it moves.

### Settled

`LEVEL` vs `STAGE` was open for one round. It is closed: **STAGE**, everywhere a player
reads it. A pin fails the build if any drawn string says `LEVEL` again.

## Two platforms, one fix. iOS is always upload-ready.

Gil's standing order, 2026-09-04: **every fix lands on both platforms, every time.** The
game is on both stores (Play open testing, and the App Store since 1.0.11, October 2026),
and every release ships to both. The iOS shell stays in step with Android so that an
App Store upload is `npm run ios:archive` and nothing else — no catch-up, no "let me
check whether iOS still builds".

What that means in practice:

1. **A native decision is made twice.** Anything that lives in `AndroidManifest.xml`,
   `build.gradle` or the Android splash/icon set has a twin in `ios/App/App/Info.plist`,
   `GameViewController.swift`, `AppDelegate.swift` or the launch storyboard. Change one,
   change the other in the same commit. BUILD.md lists the pairs.
2. **A version moves in three places at once,** and only through `scripts/sync-version.js`
   — never by hand in Xcode or Gradle. `npm test` fails if the iOS project's version drifts
   from package.json.
3. **Every store cut proves both shells.** `npm run aab` ends by compiling the iOS app for
   the simulator (`scripts/build-ios.sh --no-install`). A Play upload with a broken iOS build
   does not happen.
4. **A Capacitor upgrade is one job for both platforms**, with a fresh R8 device pass on
   Android and a simulator pass on iOS before either ships.

The guard is `npm test`, section **THE iOS SHELL**, plus the iOS step at the end of
`scripts/build-aab.sh`.


## The disc law: nothing touches the edge of a disc

Gil, 2026-09-04, after saying it for the third time. Every panel in the game is a disc
the ring casts (the kit is in `src/game/91-briefing.js`: `discPlate`, `discRows`,
`discSegKeys`, `discSlab`, `discPara`). **No text, key, field or rail may touch the rim.**

1. **Fit to the chord at the element's OWN height.** `discChord(R, dy)` is the half-width
   of the circle at `dy` off centre. A key or field is fitted at its widest corner; a
   line of text at the top of its glyphs on the upper half and the bottom on the lower.
2. **Text goes through `discPara`.** It wraps every line to its own chord minus
   `DISC_TEXT_PAD`. Never wrap a paragraph to one fixed width, and never to the chord of
   its first line — the disc is drawn at desktop sizes too, and that is where the words
   land on the rim.
3. **Keys and rails keep `DISC_PAD` off the rim; text and FIELDS keep `DISC_TEXT_PAD`,**
   which is wider. A rail end may sit near the edge; a word, or a box that holds words,
   may not. Fit a field with `discFieldHx(R, fy, fh, cy)` — never with `DISC_PAD`.
4. **A title keeps `DISC_TITLE_PAD` at the top of its capitals, and a long title BREAKS.**
   `discPlate` fits each title line to the crown's chord; a 14-letter title fitted to one
   line comes out the size of a caption. Pass `'RENAME\nMY RUNS'`, never a shrunken line.
5. **Check at a desktop size, not only a phone.** The overflow shows at 1600 wide first.

`npm test` pins the kit and pins MY DATA to it. A new disc that wraps its own text fails
the pin.


## THE PORT MAP: one port per web interface

Gil, 2026-09-27, after three tools were found sharing ports. Every local web interface
owns one port, and the map is the whole list. A new lab takes the next free port after
the last lab; nothing else is ever bound below 8300.

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

`npm test` (section **THE PORT MAP**) pins each script's bind, the portal's list, the
smoke suite's refusal list, this table and the `dev-servers` skill. Change a port in
all of them or the build fails.

## Several agents, one checkout

Gil runs more than one Claude agent on this repo at once. A repo-wide git command in one
of them sweeps the others' work: `git stash`, `git reset --hard`, `git checkout .` and
`git add -A` have each cost a day's edits. Written down 2026-09-08.

1. **An agent works in a worktree.** `.claude/worktrees/<task>`, through the native
   worktree tool; git ignores the folder. The main checkout is Gil's own, and no agent
   runs a destructive git command there.
2. **Stage by path, never by sweep.** `git add <file>` for the files you edited. Never
   `git add -A`, `git add .`, `git stash`, `git reset --hard`, `git checkout .` or
   `git clean` — in any checkout.
3. **Finish means merge and remove.** Merge the branch into master, then
   `git worktree remove <path>` and `git branch -d worktree-<task>`. Never push a
   `worktree-*` branch; the branch is scaffolding, not history.
4. **`npm test` runs in the worktree before the merge.** The pre-push hook runs it again.
