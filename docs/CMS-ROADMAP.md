# Campaign CMS — Roadmap

The plan for making campaigns a content pipeline instead of hardcoded levels.
Decided 2026-07-16 after playtester feedback (more campaigns needed — the
current one is finishable in ~30 minutes by a first-time player).

## Core concept: the campaign package

One self-contained JSON file per campaign:

```
{
  id, title, tagline, difficulty,        // picker metadata
  story,                                  // general campaign premise
  map: { theme: 'city' } | { image },     // procedural fallback OR data-URI image
  speakers: [{ id, name, color, portrait }],  // portrait: drawn-id or data-URI
  levels: [{
    name, hint, tint, mapPos: {x, y},     // identity + pin on the map
    story: { title, lines },              // deploy briefing card
    comms: [{ t, speaker, text }],        // in-run chatter (drives story lulls)
    caseNote,                             // report screen line
    duration, speed,
    beats: [ ... ],                       // hand-placed events (walls, ambushes,
                                          //   streams, pickups, lulls)
    bands: [{ t0, t1, intensity, mix }],  // procedural filler between beats
    seed
  }]
}
```

Everything loads through one validated, fairness-linted path — the same path
future community-made campaigns will use. "Admin only" = the editor simply
does not ship in the store build.

## Phases

- **Phase 0 — data-driven game** (in progress)
  Extract the schema; convert the shipped 8 levels + story + comms + map pins
  into package #1 (`THE INVESTIGATION`, procedural city map). Game must play
  identically afterward. Progress/stars become per-campaign (with save
  migration).

- **Phase 1 — beats, bands, linter** (done)
  Timeline compiler (beats + seeded band filler → one deterministic spawn
  schedule). Fairness linter as a pure function: walks a compiled level and
  reports 100%-completable-law violations (dual-node conflicts, wall
  clearance, unreachable streams) with timestamps.

  ### Beats — `level.beats: [ ... ]`

  Hand-placed events on the level clock. `t` is always the ARRIVAL moment at
  the ring (the engine back-times the release by the travel lead, so a heavy
  leaves the horizon earlier than a normal to land on the same cue):

  ```
  { t, kind: 'enemy', type: 'normal'|'heavy'|'line'|'lock0'|'lock1'|'frag', angle? }
  { t, kind: 'wall', angle? }      // rim wall; its latch BITES at t
  { t, kind: 'strip' }             // golden bonus ribbon, head arrives at t
  { t, kind: 'pickup', type? }     // power-up (shield|wide|auto|inject|chain)
  { t, kind: 'lull', dur }         // quiet window: no filler ARRIVALS in [t, t+dur]
  ```

  Rules the runtime enforces:
  - `angle` optional (radians). Omitted → drawn from the beat's own seeded
    side stream. Given → still passes `clearOfWalls`, and walls still run
    their clash hops: fairness beats authorship.
  - Beats never touch the level's main `spawnRng` sequence (each beat has a
    per-index `mulberry32` side stream), so adding/removing beats does not
    reshuffle the procedural filler, and legacy levels replay bit-identically.
  - Beat demand windows are PRE-BOOKED in the `sched` fairness ledger at
    level start, so filler routes around the authored moments from second 0.
  - A beat whose arrival would land inside a comm window (`c.t-0.5 ..
    c.t+3.2`) slides late, past the words — same rule as filler. The linter
    flags the authored overlap so the author can fix the data.
  - `lock0`/`lock1` respect `lockAllowed`: a lock whose node is booked flips
    color or unlocks.

  ### Bands — `level.bands: [{ t0, t1, intensity?, mix? }]`

  While `t0 <= levelT < t1` the spawner runs on `bandCfg(level, t)`:
  `{ ...level, ...mix }` with `spawnMin/spawnMax` divided by `intensity`
  (1 = the level's base cadence, 2 = twice as dense, max 4). `mix` may only
  override the rate knobs (`doubles, heavies, lines, colors, frags, walls,
  crawlers, bursts`) — never speed/duration. Outside every band the level's
  flat knobs apply unchanged; a level without bands is untouched
  (`bandCfg` returns the level object itself).

  ### Fairness linter — `lintLevel(level, idx)` / `lintCampaign(pkg)`

  Pure: simulates the whole spawn timeline (beats + bands + procedural
  filler, exact draw-for-draw mirror of the live spawner) on its own
  `mulberry32` seeded the way the level would be — the live `spawnRng` never
  advances. Returns `[{ t, code, msg }]`; `lintCampaign` maps it over the
  package's levels. Findings are ADVISORY: `installCampaign` console.warns
  them and installs anyway (only `validateCampaign` structural errors
  reject). Since filler is gate-protected by construction, every finding
  involves a beat. Codes:
  - `dual-conflict` — two simultaneous demands both nodes can't cover
    (heavy/line windows, same-color lock double-booking, node killer parked
    on a mandatory dock)
  - `wall-conflict` — an arrival authored onto a live wall carpet (the
    engine would relocate it and break the authored design)
  - `lull-violation` — a beat scheduled inside another beat's lull
  - `comm-overlap` — a beat arrival inside a comm window (it will slide late)
  - `unreachable-strip` — a bonus ride that overlaps a mandatory dual-node
    kill or crosses a wall carpet

- **Phase 2 — the Tunnel Designer (editor.html)** (done)
  Desktop-only page driving the real engine: `src/editor.html` provides the
  layout + `#game` canvas, and `src/editor.js` fetches `index.html`, lifts its
  inline script out (same regex trick as scripts/test.js) and injects it, so
  the ACTUAL game runs inside the editor. The preview pane poses as the game's
  window (`innerWidth`/`innerHeight` getters), and one guarded hook inside the
  game loop (`EDITOR_DRIVE` in `frame()` — inert when the global is absent)
  lets the editor feed the sim clock: 0 freezes the world, real dt plays it.

  What ships:
  - campaign manager (edit/reorder/add levels, meta, speakers, new-from-template)
  - per-level knobs, story card, comms rows (speaker dropdown, 64-char limit),
    case note, map-pin + image/portrait upload (data plumbing only for now)
  - the TUNNEL SCRUBBER: a draggable playhead re-simulates the level
    deterministically (reset + fast-forward with rendering suppressed — the
    same replay law that makes campaign levels bit-identical) and shows the
    true world state at that moment; play/pause preview + play-from-here with
    live input + back-to-editing
  - beat placement by clicking the tunnel (t = playhead, angle = click
    bearing); draggable timeline markers, band lane with intensity/mix
    inspector, live debounced lint panel (findings jump the playhead)
  - layered timeline, video-editor style: TIME · STORY (deploy card + comm
    windows, read-only, click-to-edit) · WALLS · ENEMIES · STREAMS · LULLS ·
    BANDS · FILLER — the filler lane renders the procedurally generated
    arrivals from `lintWalk` (the linter's pure timeline walk, extracted from
    lintLevel behavior-identically), so the whole level is visible at once.
    Marker/tool/chip colors speak the in-game enemy language exactly.
  - wall authoring is honest about fairness: the WALL tool shows a ghost arc
    where the carpet will ACTUALLY land (relocation predicted via lintWalk),
    overlapping wall windows are blocked at placement, and a relocated wall
    carries an inline "authored X, lands Y" warning in the beat list
  - export as pretty JSON / copy-as-campaigns.js-entry; import validates
    through validateCampaign before load

  Launch: `npm run dev` (or `node scripts/serve.js`) →
  http://localhost:8000/editor.html. All editing happens on a deep working
  copy; every apply reinstalls via installCampaign so the scrubber always
  simulates the EDITED data. Pure editor logic lives on the `ED` namespace in
  editor.js and is unit-tested headless by `npm test`.

  NOTE — store builds: `src/editor.html` and `src/editor.js` are dev-only and
  MUST be excluded from store packages ("admin only" = the editor simply does
  not ship). Actual build exclusion is release-phase work (scripts/build.js).

- **Phase 3 — campaign UX in game**
  Campaign picker (CAMPAIGN wheel sector → list when >1), per-campaign
  progress, difficulty tiers on the picker, dormant import path for
  community packages.

## Dev conveniences

- **Gamepad on desktop**: two analog sticks map absolutely to the two nodes
  (stick direction = node angle) for MacBook playtesting. Triggers fire the
  matching pulse, START pauses, A dismisses cards.
