# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

Shipped to stores as a Capacitor wrapper (Android APK via `npm run apk`, iOS
project via `npm run ios`) and playable as an offline-capable PWA. The wrapper
does not make the design language native — the game is a single full-bleed
canvas with its own vocabulary, and future surfaces follow that vocabulary
rather than iOS/Android system UI.

## Users

**Primary: skill-hungry arcade players.** They chase mastery and the
leaderboard, play in short high-replay sessions, and accept a demanding control
scheme because getting good *is* the reward. When difficulty and onboarding
gentleness conflict, difficulty and fairness win.

Consequence already encoded in the game: DIALS is the only player-facing
control scheme, chosen because pads are "challenging but encourage skill play
and train hand-eye coordination." ARCS and IMMERSIVE stay dormant behind
`ALT_CONTROLS = false` — ARCS was judged unfair against DIALS for scores.

## Product Purpose

DATA DEFENDERS: DARK FIBER is a mobile arcade defense game. The player commands
two radial nodes around a fiber-optic tunnel bore, intercepting incoming data
traps so a payload reaches its destination intact. Success means a player keeps
coming back to beat their own line — clean runs, longer combos, a better place
on the daily board.

## Positioning

Two-thumb radial dual-node control on a single shared ring, where **color is
the rule set, not decoration**: red = either node, blue/white = the matching
node, purple = both nodes docked, black = node-killer (never touch). A third
verb, UNITE-VOLLEY, comes from docking both nodes together rather than from a
new button. Every input the player has is spatial, so difficulty scales by
what arrives and where, never by adding controls.

Two commitments a neighbouring game could not truthfully copy:

- **Skill-fairness is absolute.** Nothing purchasable affects score. No
  consumable IAP, no forced ads, no pay-per-campaign — all three were rejected
  as contradicting the identity.
- **The 100%-able rule.** Every level must be fully completable; no enemy,
  power-up, or bonus stream may be forced-lost. Difficulty rises, impossibility
  never.

## Operating Context

Played on a phone held **landscape** in two hands, both thumbs resting on
bottom-corner dial pads. Sessions are short and repeated. Play works fully
offline; the only network dependency is the leaderboard work in flight.

Structure the player moves through: a mode wheel (TUTORIAL / CAMPAIGN / FREE
FLOW) → for campaign, a route map over a blueprint city with a relay list and
dossier → briefing disc → in-tunnel run → victory report. FREE FLOW (endless +
daily) unlocks at relay 04.

## Capabilities and Constraints

**Shipped**

- 5 sequential campaigns (`src/campaigns.js`), 8 levels each, difficulty 1–5 on
  a sawtooth curve — each campaign resets its floor below the prior peak, then
  climbs past it. Every campaign owns a signature mechanic and escorts a
  different *type* of data; the player is always the defender and the color
  polarity never flips.
- Free-flow tutorial (qualification), endless mode with timed stream surges,
  and a daily run seeded per UTC calendar day — identical stream for every
  player, which makes daily the natural competitive mode.
- Threat vocabulary: plain taps, doubles, heavies (dual-node only), barrier
  lines, color-locked taps, frags, node killers, rim walls, burst volleys,
  optional golden bonus ribbon; five bosses (core, triad, spinner, triad, core).
- Power-ups: firewall shield, wide arc, auto-zap, pulse injected, chain
  overdrive. Slow-mo was removed as useless.
- Offline play, haptics, auto-pause on app switch, safe-area aware layout, and
  a `lowFX` performance watchdog for low-end devices.

**Constraints**

- Campaign levels are deterministic drills — spawns draw from a seeded
  `spawnRng` and the fairness gate reads a booked-arrival ledger, so player
  performance cannot alter the script. Tests assert replay equality; anything
  that consumes an extra RNG draw shifts the whole sequence and breaks it.
- The game is one ~11k-line file, `src/index.html`, with a canvas-only
  interface. Everything renders through 2D canvas painters — there is no DOM
  UI layer to lean on.
- `npm test` (`scripts/test.js`) is a headless DOM-stubbed harness driving the
  real game code; it must stay green.
- No HUD elements for depth or priority. Range rings, per-enemy countdowns,
  flow-line chains, and priority numbers were all built and reverted as
  clutter. Urgency lives on the enemy body plus panned sonar ticks.

**Business model (decided 2026-07-14)**

Free demo + one-time unlock: relays 1–3 free, a single lifetime purchase
(~$2.99–4.99, price not finalized) unlocks the full campaign and FREE FLOW at
the existing relay-04 seam. Google Play Billing via a Capacitor plugin plus an
offline entitlement flag; no server for v1. Full plan in
[docs/RELEASE-PLAN.md](docs/RELEASE-PLAN.md).

**Open / undecided**

- Leaderboards: scores persist locally, but player identity, backend, and
  anti-cheat are unbuilt. LootLocker + replay validation is the chosen
  direction, blocked on a deterministic-sim refactor. Supabase groundwork
  exists under `supabase/`.
- Final store name is not cleared — "Data Defenders" alone collides with two
  existing Play Store apps; USPTO TESS + store search still owed.
- Deferred and explicitly not to be started unasked: user-created levels via
  shareable seed codes, a "play your own music" mode, and the "Data Driver"
  pilot mode.

## Brand Commitments

- Name: **DATA DEFENDERS: DARK FIBER** — plural, because "we're an elite group,
  not a single hired gun." Short form DARK FIBER. Tagline *Guard the payload.*
- Logo is the user's shield badge, loaded from `src/logo.png`. The story voice
  may still address the player as "defender" (singular); every brand surface is
  plural.
- Voice: terse operational radio traffic. Four speakers — OMNI (OmniServe HQ),
  CID (Cyber Investigations Dept), TRACE (analyst), CORE (the hostile firewall
  core). Lowercase clipped comms in-level; typewriter case-file logs on
  briefing discs.
- The full brand record — tokens, mark, typography, chrome grammar, audio
  direction, store asset specs — lives in [BRAND.md](BRAND.md) and is binding
  for marketing and store surfaces.
- Realism rules the user established for any "realistic" art request in this
  project: one world key light everything obeys, matte near-black metal with
  contrast only at machined edges, no outlines ever, draw light rather than
  painting surfaces, film grain + vignette to finish.

## Evidence on Hand

- Playable game: `src/index.html` (build with `npm run build`, serve with
  `npm run dev`).
- Complete narrative script for all campaigns in [docs/STORY.md](docs/STORY.md)
  — every case-file log, hint, comm line, and case note in reading order.
- All four music tracks are composed by the author (AI-assisted), no licensing
  risk; logged in [CREDITS.md](CREDITS.md). A replacement menu track is still
  owed by the author (spec in BRAND.md).
- Prototype labs kept in `src/`: `arclab.html`, `enemylab.html`, `ringlab.html`,
  `zaplab.html`, `fxlab.html`, `soundboard.html`, all sharing `src/labbg.js`.
- Store screenshots, feature graphic, and preview video do **not** exist yet.
  There are no players, reviews, download counts, press, or testimonials —
  future work must not fabricate any.

## Product Principles

1. **Skill is the only currency.** Nothing bought, unlocked, or configured may
   change a score. Fairness is what the leaderboard measures.
2. **Every run is winnable.** Difficulty comes from density and speed, never
   from unavoidable loss.
3. **Teach in the world, not in a panel.** New threats announce themselves
   through in-world banners, riding tooltips, and drills the player performs —
   the tutorial has no modal stops.
4. **One control scheme, more verbs.** New depth comes from what the two dials
   can already express, not from new inputs or a second scheme.
5. **Information lives on the object.** Urgency, threat type, and state read
   from the enemy body, the ring, and sound — not from added HUD chrome.

## Accessibility & Inclusion

**Decided: color coding is the design and stays.** Red / blue / white / purple
/ black carry the rule set, and future work should not add redundant non-color
cues at the cost of the language. Accessibility effort goes elsewhere instead:

- `lowFX` performance watchdog for low-end Android devices.
- Haptics (needs verification on a real iOS device).
- Safe-area aware layout and thumb reachability on the corner dial pads.
- ARCS remains fully wired behind `ALT_CONTROLS = false` and could return as an
  accessibility option — but never as a scored-competition scheme, since it was
  judged unfair against DIALS.
