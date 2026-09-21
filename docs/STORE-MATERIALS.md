# Store materials — Google Play and the App Store

**Built 2026-09-21, from scratch, on the 1.0.9 build.** This document supersedes the
assets and the copy in [STORE-LISTING.md](STORE-LISTING.md) (2026-08-15). That document
stays in the repo because its sections 3 to 5 record decisions and two harness traps that
are still true. Its screenshots show hulls, a HUD and nouns the game no longer has.

Everything here is re-runnable:

```
node scripts/store-shoot.js                       # 6 stills x 3 sizes + the feature graphic
node scripts/store-shoot.js --scene=boss --size=play --kind=siphon
node scripts/store-shoot.js --video --size=yt     # the gameplay video, picture + sound
node scripts/store-shoot.js --video --size=preview --fps=30
node scripts/store-shoot.js --list
```

---

## 1. The stills

Six frames, in carousel order. Each exists at three pixel sizes. The logical size is a
phone's (or an iPad's), so the layout in the frame is the layout a player holds.

| # | File | Frame | How the frame is found |
|---|---|---|---|
| 01 | `01-midrun.png` | Mid run on **stage 23**. Every hull at every depth: standard, both phase locks, armored, a linked pair. One discharge mid-flight. | A live bolt and nine bodies still standing |
| 02 | `02-boss.png` | The boss of **stage 24**, the Prism, wounded, **both rays lit**, a pulse wave landing | Two rays past their birth burst, both emitters alive, the machine at least one pulse down |
| 03 | `03-contracts.png` | The contract carousel, centred on THE SURVEY | Static screen |
| 04 | `04-stages.png` | The star map and the stage list of THE SURVEY, **stage 13** selected | The lens rides the lane. The frame is inside its dwell at the destination |
| 05 | `05-volley.png` | A unite-volley: emitters docked, the blast taking a column, `BLAST x6` | The blast between 0.10 s and 0.30 s old |
| 06 | `06-home.png` | The home menu: the mode wheel, CONTINUE CONTRACT, the weekly lane | Static screen |

| Folder | Pixels | Logical size x DPR | Slot |
|---|---|---|---|
| `docs/store/raw/play/` | 2160 x 1080 | 1080 x 540 x 2 | Google Play phone screenshots (2:1, the widest shape Play takes) |
| `docs/store/raw/iphone/` | 2868 x 1320 | 956 x 440 x 3 | App Store iPhone 6.9" (Apple scales it down for the smaller phones). Safe area 47 / 47 / 21 |
| `docs/store/raw/ipad/` | 2752 x 2064 | 1376 x 1032 x 2 | App Store iPad 13". Required because the target is universal (`TARGETED_DEVICE_FAMILY = "1,2"`) |

`docs/store/feature-graphic.png` is Play's 1024 x 500 banner. It is built by the
2026-08 compositor ([shot-feature.html](../scripts/shot-feature.html)) on a new bare
plate, `raw/play/00-feature.png`, that carries the new hulls.

### A phone is not 16:9 — the second cut, 2026-09-21

The first cut shot Play and the video at 1920 x 1080, and every lane frame had **the pads
over the ring**. Gil saw it against a screenshot off his phone. `dialCenter` insets the
pads from the corners of the screen, so the distance from a pad to the ring is a function
of the screen's SHAPE: on 16:9 they collide, on a real phone (19.5:9 and wider) they do
not. Three changes:

- **Play and the video are 2:1** (2160 x 1080). Play takes any shape up to 2:1, and YouTube
  takes any shape. `--size=play169` still shoots 1920 x 1080 if a 16:9 slot ever demands
  it, with the collision in it.
- **The iPhone frames wear a safe area.** The game insets its pads by `--sal` / `--sar`,
  so an iPhone frame with no inset is a frame no iPhone shows. The harness sets 47 px, the
  notch phones' inset and the one on Gil's phone.
- **INFERRED, not seen:** the Dynamic Island phones report 62 px. By the arithmetic of
  `dialCenter`, a 956 x 440 screen with 62 puts the pad's rim exactly on the ring's. It
  needs one look on a 6.9" iPhone or its simulator.

And one fix **in the game**: on the iPad frame the pads had a fat outer band. The pad's
radius is capped at phone scale (`min(H, 560)`) but its gauge width was the ring's
measure, `min(W, H) * 0.055`, which has no cap. `padGauge()` in `60-input.js` now carries
the same cap. On a phone H is under 560, so no pixel moves there. It is render-only, but
the sim id hashes every byte: no board moves, and the verifier is rebuilt with
`-- --compatible` before the next AAB, as the standing rule says.

The icon is unchanged: `docs/store/wv-512-store.png` for Play, the asset catalogue for iOS.

### What is real, and what is staged

The rule of the first set stands.

- **Real:** every pixel. Art, light, projection, the lane, the ring, the HUD, the menus.
  `src/` is not modified for marketing. One line is patched **as it is served, never on
  disk**: the DPR cap in `00-core.js` is lifted so the iPhone frame is rendered at
  2868 x 1320 and not upscaled from 1912 x 880. The layout does not change.
- **Staged:** which bodies are in the lane and where, in frames 01 and 05. The game's own
  `spawnEnemy` and `spawnLine` make them. Score and combo are set to a run in good shape.
- **Played, not assembled:** the boss. The scene moves the level clock to the end of stage
  24 and nothing else. The game spawns the machine, the ceremony runs, and an autopilot
  fights it and dodges its rays until the predicate is true.
- **The save** is one player on every frame: contract 1 complete, contract 2 at stage 13,
  call sign `GIL`. The home menu, the carousel and the star map agree with each other.
- **The leaderboard host is blocked** for every capture. No frame shows a board, so no
  name of a real player is in the set.

### Two traps this harness found

1. **Canvas 2D rasters lazily.** With the clock cranked and no compositor frames, 300
   frames of draw calls pile up unrastered and the first `toDataURL` pays for all of them.
   It looked like a hang. The crank now snapshots the canvas into a 1-pixel canvas each
   frame. Do **not** use `getImageData` for that: a few readbacks flip the canvas to
   software raster for good, and a full-size frame then costs 350 ms and not 5 ms.
2. **One large websocket message never arrives.** A 5 MB data URL through Node's built-in
   WebSocket client times out. `grab()` reads the PNG in 768 KB slices.

Both looked like a hang in the game. Neither was. The old freeze hook
(`EDITOR_DRIVE = () => 0`) was suspected first and was tested alone afterwards: it
still returns in 6 ms, and the harness still uses it.

---

## 2. The video

`docs/store/video/` — one full run of **stage 23** (THE COLLECTOR, stage 07 of 08), played
by [the human bot](../scripts/store-bot.js).

| File | What | Spec |
|---|---|---|
| `run-yt.mp4` | The full run: launch on a two-thumb grip, 77 s of lane, LANE CLEARED | 2160 x 1080 (2:1), 60 fps, H.264, AAC 256 k, 1:26. For YouTube, then the Play promo video field |
| `cut-preview.mp4` | 29 s from 0:26 of the same run at the iPhone aspect | 1920 x 886, 30 fps, H.264 High, AAC 256 k. The App Store iPhone preview (15 s to 30 s) |
| `run-preview.mp4` | The full run at the iPhone aspect, the source of the cut | 1920 x 886, 30 fps |
| `run-yt.json`, `run-preview.json` | The run's record: the bot's event log and one line a second | tracked in git; the video files are not |

**The run:** 229,143 points, 3 stars, 108 hits, 71 perfect, 16 volley blasts, 2 pulse taps,
and **1 miss, the planned one**, at 0:47. The hull that passed met a shield that the bot
had caught earlier, so the frame says SHIELD ABSORBED THE BREACH and not STABILITY LOST.
The combo resets and the end card says MISSED 1. Move it with `--mistake=<levelT>`.

**The run is deterministic.** The same seed gave the same 229,143 in every dry run,
picture pass and sound pass, at two sizes. `--seed=` gives a different player.

**Sound sync:** real time is not exactly the sim's, and the first second has a hitch of
about 0.13 s. The driver fits a least-squares line through the body of the run, trims the
sound on the line's intercept and removes its slope with `atempo`. The worst offset after
the fit is 0.010 s (0.11 s before it).

**The run files nothing.** The leaderboard host is blocked and `lbSubmit` is stubbed in
the page, so a bot score cannot reach a live board and the end card has no OFFLINE line.

### How the bot plays

It moves two thumbs and nothing else. It sends real `pointerdown`, `pointermove` and
`pointerup` events to the canvas, so the dials draw the thumbs, the launch gate opens on a
real two-thumb grip, and the game never learns it is not a person. It never writes a game
variable.

- It **sees late**. A body is noticed inside a depth limit and acted on after a reaction
  time of 0.15 s to 0.26 s. The time is 0.02 s to 0.08 s when the next target was already
  in view at the moment the last one died.
- A thumb travels on a **minimum-jerk curve**. The duration follows Fitts's law, so a long
  reach is slower than a short one and no movement is instant. Under time pressure the
  reach is compressed, down to the fastest sweep a thumb makes (11 rad/s).
- It aims with a small error, overshoots some long reaches and corrects, and a thumb at
  rest has tremor. The two thumbs land at different times.
- It plans as a player plans. Keyed work is fixed first: a phase lock, purple armor, the
  two ends of a linked pair. Each standard body then goes to the thumb that can reach it
  and not drop keyed work.
- It routes **around** a dead zone. It docks both thumbs on purple armor, which fires the
  volley. It taps a charged pulse orb as a thumb does: lift, tap the core, put the thumb back.
- **It makes one mistake.** After `mistakeAt` seconds it notices one far body too late. The
  thumb runs at it and arrives late, the body passes, STABILITY LOST shows, the combo
  resets. Then it continues to play correctly.

### Picture and sound are two passes over the same run

- **Picture:** the clock is cranked. Each frame is exactly 1/60 s, rendered at the target
  size and sent to ffmpeg. The video has no dropped frame and no screen recorder in it.
- **Sound:** the page runs in real time with its AudioContext. A MediaRecorder records the
  master limiter, so the track has the music, every sfx and the mix the player hears.
- The bot steps **once per sim step**, reads only sim state, and uses its own seeded
  generator. The two passes are therefore the same run. The driver proves it: the two
  passes must end on the same score, zaps, misses and perfects, or the sound is not muxed.

---

## 3. Copy — Google Play

### Title (30 max)

```
Warp Vanguard
```

### Short description (80 max)

```
Two thumbs. Two emitters. One ring. Hold the warp lane against all that comes.
```

### Full description (4,000 max)

```
You fly point ahead of a freight convoy, down a warp lane that somebody has seeded against it. Two emitters ride the ring around you. Everything that comes up that lane is yours to collapse before it reaches the cargo.

── HOW IT PLAYS ──

Two thumbs, two dials, one shared ring. The left dial runs the blue emitter, the right runs the white. Interdictors arrive out of the dark at every bearing and every depth, and you have exactly as long as the lane is deep to put an emitter on each one.

It is rhythm-action with a ring for a fretboard. Read what is coming. Be there when it lands.

Colour is the rule, not the decoration:

RED — standard. Either emitter takes it.
BLUE / WHITE — phase-locked. Only the matching emitter lands.
PURPLE — armored. Both emitters, together.
LINKED — a barrier between two hulls. One emitter on each end.
GOLD — a pulse charger. Ride it, and it charges you.

── THE THIRD VERB ──

Dock both emitters on one bearing and their phases unite. You give up every other angle for half a second, the charge builds white-hot, and one bolt goes straight down the bore and detonates on what it hits — and takes the hulls around it too. It is a decision you make with the two thumbs you already have, not a new button.

Fill a pulse orb, tap its core, and a wave sweeps the lane clean ahead of you.

── WHAT'S IN IT ──

· Five contracts, forty stages — a different kind of cargo every contract
· Five machines waiting at the end of a contract — the Leech, the Siphon, the Prism, the Mimic, the Blockade — each with its own tell, and rays that hunt one emitter at a time
· FREE FLOW — endless, with the stream stepping up the longer you last
· THE WEEKLY LANE — one seeded lane, identical for every player, open Monday to Sunday. When the week closes its board freezes for good, so a name that lands on it stays there.
· A leaderboard on every stage. Every run on it was replayed and verified by the server, and you can watch any of them.
· LANE ASSIST — an eased retry for the stage that will not give

── WHAT THIS GAME WILL NOT DO ──

No ads.
No consumables.
No energy timers.
Nothing you can buy will move your score.

And every stage is completable. Difficulty comes from density and speed — never from a wave you were never meant to survive.

Plays offline. Landscape, two thumbs, short sessions. Controllers work too.

Clear the lane.
```

## 4. Copy — App Store

| Field | Limit | Text |
|---|---|---|
| Name | 30 | `Warp Vanguard` |
| Subtitle | 30 | `Two-thumb rhythm-action` |
| Promotional text | 170 | `Two emitters, one ring, and a warp lane full of interdictors. Five contracts, forty stages, five boss machines, and a weekly lane that is the same for every player.` |
| Keywords | 100 | `rhythm,arcade,action,space,reflex,tunnel,ring,score,leaderboard,boss,offline,warp,twin stick,music` |
| Description | 4,000 | The Play full description, verbatim. It names no other platform and no price. |

The subtitle and the keywords never say "shooter". The game is rhythm-action with the
ring twist (Gil, 2026-09-18).

---

## 5. Still owed

Character counts, measured: short description 78 of 80, full description 2,362 of 4,000,
subtitle 23 of 30, promotional text 164 of 170, keywords 98 of 100.

1. **Captions.** The frames are raw. The 2026-08 set had a caption plate on each frame, and
   [shot-caption.html](../scripts/shot-caption.html) still does that job:
   `store-shoot.js` serves it and has the `/shot` endpoint it posts to. Gil's call.
2. **The YouTube upload** is Gil's. Play takes the promo video as a YouTube URL: public or
   unlisted, no ads, no age limit.
3. **An iPad preview video** (1600 x 1200) is one more run: `--video --size=previewpad --fps=30`.
4. **Store spec numbers drift.** Check them in Play Console and App Store Connect on the day
   of the upload: Play stills no wider than 2:1 (these are 2160 x 1080) and a 1024 x 500 banner; App Store
   2868 x 1320 and 2752 x 2064 stills; preview 1920 x 886, 15 s to 30 s, 30 fps.
5. **The masters are not in git** (95 MB of stills, 600 MB of video). They are in
   `docs/store/raw/` and `docs/store/video/` on Gil's Mac, and one command makes them again.
