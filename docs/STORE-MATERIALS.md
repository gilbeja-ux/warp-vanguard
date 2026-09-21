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
node scripts/store-shoot.js --video --dry --trace=bot.json   # the run with no camera, saved as a replay
node scripts/store-study.js bot.json human.json              # lead and aim, measured through the real sim
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
  takes any shape. A 16:9 set is shot too (`raw/play169/`, 1920 x 1080) for a slot that
  demands that shape.
- **The iPhone frames wear a safe area.** The game insets its pads by `--sal` / `--sar`,
  so an iPhone frame with no inset is a frame no iPhone shows. The harness sets 47 px, the
  notch phones' inset and the one on Gil's phone.

### The pad law — the third cut, 2026-09-21

The shape was only where the fault SHOWED. The fault was the rule: a pad sat a fixed inset
from the corner and nothing checked it against the ring or the glass. Gil's ruling: **a
pad never touches or overlaps the ring, it never crowds the edge of the screen, and the
spacing is relative, not absolute.** `dialSeat()` in `60-input.js` is that law:

| Clearance | Share of the pad's scale `hh = min(H, 560)` |
|---|---|
| pad rim to ring rim | 0.022 |
| pad rim to the glass | 0.05 |
| pad rim to the safe area | 0.015 |

The old seat comes first, and a screen where it already keeps the law gets it **to the
pixel** — Gil's phone and a desktop do. Where it does not, the seat gives way in the order
that costs the thumb least: in from the edge, out along the row, down toward the corner,
and only then smaller. The ring never gives: `geo()` is canonical on every screen.

| Screen | Before | After |
|---|---|---|
| Notch iPhone 844 x 390 (Gil's) | clear by 9.8 px | the same seat, to the pixel |
| Dynamic Island iPhone 956 x 440 | rims 4 px apart | pad 23 px lower, clear by 9.7 px |
| 2:1 phone, no safe area | pad rim 9 px from the glass | 27 px from the glass |
| 16:9 phone 960 x 540 | pad 22 px INTO the ring | pad at 86%, in the corner, clear by 12 px |
| iPad 13 | pad rim 9 px from the glass | 28 px from the glass, 18 px lower |
| iPad mini | — | pad at 91% |
| Desktop 1600 x 900 | clear by 115 px | the same seat, to the pixel |

The 62 px case was INFERRED from arithmetic in the second cut and is still not seen on a
device; the law now holds there by construction. `npm test`, section **THE PAD LAW**, runs
the law on eleven screen shapes and pins the pixel-identical seats.

The pad's **gauge width** follows the pad too (`padGauge()`): it was the ring's measure,
`min(W, H) * 0.055`, which has no cap, so an iPad drew a fat band on a phone-size pad. It
is now a share of the pad's radius, so a pad the law had to shrink keeps its proportions.

All of it is input layout and drawing. The sim does not read it, no board moves, and a
stored replay plays the same. The sim id hashes every byte, so the verifier is rebuilt
with `-- --compatible` before the next AAB, as the standing rule says.

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

**The run:** 251,640 points, 3 stars, 123 hits, 70 perfect (57%), 10 volley blasts, and
**1 miss, the planned one**, at 0:38: the thumb notices a far body too late and the body
passes. A shield the bot had caught absorbs it, so the frame says SHIELD ABSORBED THE BREACH
and not STABILITY LOST; the combo resets and the end card says MISSED 1. Move it with `--mistake=<levelT>`. If
the loose player drops a body on its own first, that IS the mistake and the planned one
is stood down.

**The run is deterministic.** The same seed gives the same score in every dry run, picture
pass and sound pass, at every size. `--seed=` gives a different player: seeds 7 (the
default), 11, 23 and 31 each drop exactly one body on stage 23.

**Sound sync:** real time is not exactly the sim's, and the first second has a hitch of
about 0.13 s. The driver fits a least-squares line through the body of the run, trims the
sound on the line's intercept and removes its slope with `atempo`. The worst offset after
the fit is 0.010 s (0.11 s before it).

**The run files nothing.** The leaderboard host is blocked and `lbSubmit` is stubbed in
the page, so a bot score cannot reach a live board and the end card has no OFFLINE line.

### How the bot plays — tuned against people

It moves two thumbs and nothing else. It sends real `pointerdown`, `pointermove` and
`pointerup` events to the canvas, so the dials draw the thumbs, the launch gate opens on a
real two-thumb grip, and the game never learns it is not a person. It never writes a game
variable.

The first cut moved on one clean minimum-jerk curve per target, and Gil called it
mechanical. He was right, and the fix was to MEASURE people and stop guessing. Five
verified human replays came off the live boards (read only), and two instruments ran on
them and on the bot's own trace:

- [store-kin.js](../scripts/store-kin.js), a kinematics pass over the emitter angles: how long a reach takes, how many speed peaks
  it has, where the peak sits, how often a resting thumb adjusts, how often both move;
- [store-study.js](../scripts/store-study.js), which replays a trace through the real sim
  and logs, for every body that reaches the ring, how long the answering emitter had been
  inside the hit window (the LEAD) and how far off centre it was (the AIM).

| Measure | People | First bot | Bot now |
|---|---|---|---|
| A 0.5 rad reach | 0.30 s | 0.18 s | 0.30 s |
| A 1.2 rad reach | 0.45 s | 0.25 s | 0.43 s |
| A 2.3 rad reach | 0.5 to 0.8 s | 0.32 s | 0.48 s |
| Speed peaks inside one reach | 2.4 to 11 | 1.0 | 2.9 to 3.8 |
| Where the speed peaks | 37% of the way | 50% | 37% |
| Small adjustments at rest | 1.5 to 2.7 a second | 0.4 | 1.6 |
| Both thumbs at rest | 23 to 36% of the time | 67% | 38% |
| Both moving, of moving time | 40 to 51% | 24% | 30% |
| Lead, median | 0.4 to 0.65 s | 0.87 s | 0.53 s |
| Arrives with under 0.25 s to spare | 20 to 25% | 8% | 14% |
| Aim off centre, median | 0.06 to 0.10 rad | 0.026 | 0.060 |
| PERFECT share | 56 to 71% | 94% | 71% |

What that became, all of it in `CFG` at the top of [store-bot.js](../scripts/store-bot.js):

- A reach is **slow**, and its duration is spread (Fitts's law, log-normal). The speed
  peaks early and has a long tail as the thumb homes in. The speed **wavers** inside the
  reach, because a thumb on glass is a sequence of small pushes and never one bell curve.
- The first push usually lands **short**, sometimes long, and a correction follows.
- Aim is loose. A thumb that waits on a target keeps **nudging** toward it.
- The start is not always prompt. Some reaches wait and go in one fast **last-moment
  flick**, some wait a beat, some go at once and sit early.
- The hands are **coupled**: when one thumb goes, the pending reach of the other often
  goes with it. An idle thumb drifts toward the next body.
- It still sees late, plans keyed work first, routes around a dead zone, docks on purple
  armor (which fires the volley), and taps a charged pulse orb as a thumb does.
- **It makes one mistake.**

One honest limit: the bot PLANS better than the people on the boards. The best human run
on stage 23 is 38,947 and did not finish the lane; the bot clears it with 251,640. Its
hands are human; its triage is not.

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
