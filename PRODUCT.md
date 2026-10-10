# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

Shipped to stores as a Capacitor wrapper (the Play bundle via `npm run aab`, a
debug APK via `npm run apk`, the App Store build via `npm run ios:archive`) and
playable as an offline-capable PWA. The wrapper does not make the design
language native — the game is a single full-bleed canvas with its own
vocabulary, and future surfaces follow that vocabulary rather than iOS/Android
system UI.

## Users

**Primary: skill-hungry arcade players.** They chase mastery and the
leaderboard, play in short high-replay sessions, and accept a demanding control
scheme because getting good *is* the reward. When difficulty and onboarding
gentleness conflict, difficulty and fairness win.

Consequence already encoded in the game: DIALS is the only control scheme,
chosen because pads are "challenging but encourage skill play and train
hand-eye coordination." ARCS was judged unfair against DIALS for scores, and
ARCS and IMMERSIVE were deleted from the code on 2026-07-27 (d0c859e); git
history has both.

## Product Purpose

WARP VANGUARD is a mobile rhythm-action game played on a ring. The player flies
point ahead of a freight convoy down its assigned warp lane, commanding two
radial emitters around the lane's bore and collapsing the interdictors seeded to
pull the convoy out of transit. Success means a player keeps coming back to beat
their own line — clean runs, longer combos, a better place on this week's board.

## Positioning

Two-thumb radial dual-emitter control on a single shared ring, where **color is
the rule set, not decoration**. The emitters run opposed phase, ⊕ and ⊖, and
every interdictor is cast with a phase lock: red = unphased, either emitter;
blue/white = locked to that phase; purple = superposed, both emitters docked.
The one thing never to touch is a DEAD ZONE, a seized arc of the rail that fries
an emitter crossing it. (A black "phase inverter", the node killer, was the
other avoid object until it was deleted on 2026-08-27.) A third verb,
UNITE-VOLLEY, comes from docking both emitters together rather than from a new
button — docking superposes the phases, which is *why* a docked pair answers
purple — and its bolt detonates on what it hits. Every input the player has is
spatial, so difficulty scales by what arrives and where, never by adding
controls.

Two commitments a neighbouring game could not truthfully copy:

- **Skill-fairness is absolute.** Nothing purchasable affects score. No
  consumable IAP, no ads, no pay-per-campaign — all three were rejected
  as contradicting the identity.
- **The 100%-able rule.** Every stage must be fully completable; no enemy,
  power-up, or bonus stream may be forced-lost. Difficulty rises, impossibility
  never.

## Operating Context

Played on a phone held **landscape** in two hands, both thumbs resting on
bottom-corner dial pads. Sessions are short and repeated. Play works fully
offline; the network is needed only to post a score to a board, read a board,
and send a feedback note (a note written offline waits and sends later).

Structure the player moves through: a mode wheel (LEADERBOARD / CONTRACTS / FREE
FLOW) → for contracts, the star map with a stage list and dossier → mission
disc → in-lane run → mission report. The chart is a defended volume: the core
systems wrapped in patrol cordons, and the five contracts spiral outward through
them, each one working a thinner belt of escort cover than the last — the
chart's own explanation for why a lane carries more interdictors the further out
you work. FREE FLOW (the WEEKLY LANE, which leads it, and the ENDLESS LANE)
unlocks once stage 05 is complete. Stages are numbered continuously across the
whole story — contract 1 owns 01–08, with its boss at stage 08, and contract 2
picks up at 09.

## Capabilities and Constraints

**Shipped**

- 5 sequential contracts (`src/campaigns.js`), 8 stages each — forty stages —
  difficulty 1–5 on a sawtooth curve: each contract resets its floor below the
  prior peak, then climbs past it. Every contract owns a signature mechanic and
  escorts a different *kind* of cargo; the player is always the escort and the
  phase polarity never flips.
- A first-run course that calls every lesson as an instructor's demonstration on the
  ring before asking for it; an ENDLESS LANE with timed stream surges; and the
  WEEKLY LANE, the ranked week, seeded per Mon–Sun week (UTC) — an identical stream for
  every player for seven days, which is long enough to learn the lane and keep
  coming back at your own row. When the week closes its board freezes for good, so
  a name that lands on it stays there; the next week opens a new board above it.
- Threat vocabulary: plain interdictors, doubles, armored interdictors (both
  emitters together), barrier nets, phase-locked interdictors, dead zones, burst
  volleys, and the optional golden bonus ribbon. The node killer is gone
  (deleted 2026-08-27, when the volley bolt learned to detonate); the dead zone is
  the one avoid object now.
- Bosses: every contract ends on its eighth stage on a WARP LEECH — stage 08 in
  the first contract, then 16, 24, 32 and 40, because stage names run on across
  contracts. One machine family, five machines, one per contract: THE WARP
  LEECH, THE SIPHON, THE PRISM, THE MIMIC and THE BLOCKADE (`bossKind` in
  `src/campaigns.js`, the fights in `src/game/52-bosses.js`). Only a pulse wounds a leech; what changes from
  contract to contract is how the charge is earned and what hunts you while you
  earn it. The earlier wardens (core, triad, spinner) were retired with that
  roster in 2026-08.
- Power-ups: deflector shield, wide arc, auto-zap, pulse injected, chain
  overdrive, and STABILITY +25 (scheduled, never rolled). Slow-mo was removed as
  useless.
- Leaderboards, built on Supabase: an anonymous session per device, a
  free-typed handle moderated at submit, and a replay verifier — the
  `submit-run` Edge Function replays the run's input trace with a bundled copy of
  the sim and refuses any score that does not recompute. Every contract stage has
  a board, and so does each WEEKLY LANE week. The ENDLESS LANE has no board since
  1.0.10 (2026-09-24): it is unseeded, procedural per player, so no server can
  replay it, and it stays as practice against your own best.
- Offline play, haptics, auto-pause on app switch, safe-area aware layout, and
  a `lowFX` performance watchdog for low-end devices.

**Constraints**

- Contract stages are deterministic drills — spawns draw from a seeded
  `spawnRng` and the fairness gate reads a booked-arrival ledger, so player
  performance cannot alter the script. The 2026-07-30 theme shift changed no
  numbers: all 683 difficulty fields in `src/campaigns.js` were byte-identical to
  the DARK FIBER values. Tests assert replay equality; anything
  that consumes an extra RNG draw shifts the whole sequence and breaks it — and
  breaks every stored replay the verifier holds, so a sim change ships only with
  a verifier deploy (`npm run deploy:verifier`, see CLAUDE.md).
- The game is plain JavaScript in ordered topic files, `src/game/00-core.js`
  through `src/game/99-boot.js` (load order in `src/game/manifest.json`), loaded
  by `src/index.html` as classic script tags that share one global scope. It
  left the single `src/index.html` file on 2026-07-31 (docs/REFACTOR-PLAN.md).
  The interface is canvas-only: everything renders through 2D canvas painters,
  and there is no DOM UI layer to lean on. The one DOM element is a text field
  laid over the canvas while a player types (a handle, a feedback note).
- `npm test` (`scripts/test.js`) is a headless DOM-stubbed harness driving the
  real game code; it must stay green.
- No HUD elements for depth or priority. Range rings, per-enemy countdowns,
  flow-line chains, and priority numbers were all built and reverted as
  clutter. Urgency lives on the enemy body plus panned sonar ticks.

**Business model (decided 2026-07-14; seam moved and re-affirmed 2026-09-04)**

Free demo + one-time unlock. Contract 1 is free end to end — stages 01–08,
its boss included — and a single lifetime purchase of **$2.99** unlocks
contracts 2–5 at the **stage-09 seam**, plus filing a score on the WEEKLY LANE.
The offer comes after the contract 1 boss, never at a locked door mid-contract.
**No ads**, no consumables, no pay-per-campaign. (The seam sat at stage 04 until
2026-09-04, when Gil moved it to the end of contract 1.) The paywall lands in
**1.1**: Google Play Billing via a Capacitor plugin plus an offline entitlement
flag, checked inside `startLevel`. Until then — and through open testing — every
contract ships free. Full plan in [docs/RELEASE-PLAN.md](docs/RELEASE-PLAN.md).

**Store name (cleared 2026-08-21)**

**WARP VANGUARD** screened clear for the store title: no game, app, studio or
trademark with the exact compound turned up on any store or register searched.
One standing rule comes with it: never brand with bare "Vanguard". The record is
[docs/NAME-CLEARANCE.md](docs/NAME-CLEARANCE.md). ("Data Defenders" collided
with two existing Play Store apps, which is part of why the name changed.)

**Open / undecided**

- Deferred and explicitly not to be started unasked: user-created stages via
  shareable seed codes, a "play your own music" mode, and the "Data Driver"
  pilot mode.

## Brand Commitments

- Name: **WARP VANGUARD** — a squadron, because "we're an elite
  group, not a single hired gun." Short form WARP LANE. Tagline *Clear the lane.*
  In-world the unit is **the vanguards**, and comms address the player as
  *Vanguard* (settled 2026-08-23, H-19; the earlier wolf/wolves callsign is retired).
- Logo is the user's shield badge, loaded from `src/logo.webp`. **Done** — the badge
  reads WARP VANGUARD and the icon set carries the V monogram (`src/icons/wv-*.png`,
  renamed from the `df-` Dark Fiber prefix 2026-08-05; the monogram itself was a W
  until 2026-08-14). No old lettering ships. The story voice may use "runner" as an occasional
  accent nickname; every brand surface is the squadron.
- Voice: terse operational radio traffic. Three speakers on every contract: the
  client (HAUL, Meridian Haulage, on contract 1; SURV, TRDR, FLOT and DELG on the
  others), CMD (Lane Command, the handler) and WARD (the interdiction, the
  leeches' one voice, heard in boss fights). Lowercase clipped barks in-run
  ([docs/IN-RUN-VOICE.md](docs/IN-RUN-VOICE.md)); the plot lives on the mission
  discs.
- The full brand record — tokens, mark, typography, chrome grammar, audio
  direction, store asset specs — lives in [BRAND.md](BRAND.md) and is binding
  for marketing and store surfaces.
- Realism rules the user established for any "realistic" art request in this
  project: one world key light everything obeys, matte near-black metal with
  contrast only at machined edges, no outlines ever, draw light rather than
  painting surfaces, film grain + vignette to finish.

## Evidence on Hand

- Playable game: `src/index.html`, which loads `src/campaigns.js` and the
  `src/game/*.js` files (build with `npm run build`, serve with `npm run dev`).
- The theme shift's full translation record — what changed, what survived
  verbatim, and what art is owed — is [docs/THEME-SHIFT.md](docs/THEME-SHIFT.md).
- Complete narrative script for all contracts in [src/campaigns.js](src/campaigns.js)
  — every briefing and hint in reading order. (The scripted comm lines were
  replaced by reactive barks on 2026-07-30; their pool is `BARKS` in
  `src/game/83-deepfield.js`.)
- All twelve music tracks are composed by the author (AI-assisted), no licensing
  risk; logged in [CREDITS.md](CREDITS.md) — eleven stage tracks in
  `src/audio/music/` plus the menu track, which shipped. Nothing is owed.
- The prototype tuning labs were removed on 2026-07-28 once their looks were
  settled and locked into the game's `*FX` constant blocks. They live on in git
  history (`git log -- src/arclab.html`). New ones were built as needed and are
  desktop tools that never ship; THE PORT MAP in CLAUDE.md lists them.
- Store stills, the feature graphic and a gameplay video exist; the record and
  the commands that remake them are in
  [docs/STORE-MATERIALS.md](docs/STORE-MATERIALS.md). The game has been in open
  testing on Google Play since 2026-09-18, and player feedback is logged in
  [docs/USER-FEEDBACK.md](docs/USER-FEEDBACK.md). There are no reviews, download
  counts, press or testimonials on record — future work must not fabricate any.

## Product Principles

1. **Skill is the only currency.** Nothing bought, unlocked, or configured may
   change a score. Fairness is what the leaderboard measures.
2. **Every run is winnable.** Difficulty comes from density and speed, never
   from unavoidable loss.
3. **Teach in the world, not in a panel.** New threats announce themselves
   through in-world banners, riding tooltips, and drills the player performs —
   the tutorial has no modal stops. A drill is shown as a ghost on the live ring
   just before it is asked for, and a miss rewinds the lane rather than stopping it.
4. **One control scheme, more verbs.** New depth comes from what the two dials
   can already express, not from new inputs or a second scheme.
5. **Information lives on the object.** Urgency, threat type, and state read
   from the enemy body, the ring, and sound — not from added HUD chrome.

## Accessibility & Inclusion

**Decided: color coding is the design and stays.** Red / blue / white / purple
/ black carry the phase rule set, and future work should not add redundant
non-color cues at the cost of the language. Accessibility effort goes elsewhere instead:

- `lowFX` performance watchdog for low-end Android devices.
- Haptics (needs verification on a real iOS device).
- Safe-area aware layout and thumb reachability on the corner dial pads.
- ARCS could return from git history (deleted 2026-07-27, d0c859e) as an
  accessibility option — but never as a scored-competition scheme, since it was
  judged unfair against DIALS.

### What the art already carries without color (audited 2026-08-15)

The decision above is not "color is the only cue" — the bodies carry more
non-color redundancy than the rule implies, and it is worth having on the record
so a future pass does not go re-adding cues that already exist:

- **Heavy / "purple" (dock both emitters)** is not painted as a purple disc. Its
  ring is drawn in TWO HALVES, one blue and one white
  (`85-enemy-art.js` `halves`) — a literal depiction of "both phases at once"
  that survives hue loss entirely. It also carries **four** cores where a plain
  tap has two, and a drill **1.35×** longer. Purple appears in its telegraph and
  sprite, but the body never depends on it.
- ~~**The phase inverter (never touch)** is a void-black rounded diamond~~ — that
  body was the node killer, deleted 2026-08-27. The avoid object now is the dead
  zone, a seized arc of the rail rather than a hull, so it too reads by shape.
- **Locks and heavies** both take an outer machined ring, separating "keyed or
  armored" from "plain" without color.

**The one genuine color-only read** is `lock0` (blue, left emitter) vs `lock1`
(white, right emitter): same silhouette, same machined ring, same core count,
distinguished by hue and luminance alone. It is also the single most frequent
decision in the game. This is accepted, not overlooked — it is a blue-vs-white
pair, so it separates on luminance and survives red-green deficiency; the real
exposure is monochromacy, a dim screen, or bright ambient light. If it is ever
revisited, the lever is a silhouette difference on the lock ring (a notch count,
say), **not** a palette swap — a palette swap would break the phase language the
decision above protects, and a shape cue would not.
