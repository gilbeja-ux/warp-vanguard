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
  reachability, unreachable streams) with timestamps. The 100%-completable
  law around walls is defined BY reachability, everywhere.

  ### Beats — `level.beats: [ ... ]`

  Hand-placed events on the level clock. `t` is always the ARRIVAL moment at
  the ring (the engine back-times the release by the travel lead, so a heavy
  leaves the horizon earlier than a normal to land on the same cue):

  ```
  { t, kind: 'enemy', type: 'normal'|'heavy'|'line'|'lock0'|'lock1'|'frag', angle?, force? }
  { t, kind: 'wall', angle?, force? } // rim wall; its latch BITES at t
  { t, kind: 'strip' }             // golden bonus ribbon, head arrives at t
  { t, kind: 'pickup', type? }     // power-up (shield|wide|auto|inject|chain)
  { t, kind: 'lull', dur }         // quiet window: no filler ARRIVALS in [t, t+dur]
  ```

  Rules the runtime enforces:
  - `angle` optional (radians). Omitted → drawn from the beat's own seeded
    side stream. Given → used VERBATIM unless the reachability law (below)
    says the demanded dock arc is swallowed by a live wall — only then does
    the fairness pipeline relocate it (golden-angle hops).
  - `force: true` — the author's OVERRIDE: the beat lands exactly as written,
    bypassing relocation and clash hops entirely. The linter still evaluates
    forced beats and reports findings — override places it, lint tells the
    truth. The Tunnel Designer marks overridden beats with a ⚡ badge.
  - REACHABILITY is the one wall-clearance law, everywhere (filler gates,
    beat firing, wall clash hops, the linter): a spawn may coexist with a
    live wall window as long as the node position it demands stays out of
    the carpet's occupied arc — wall half-span + node zap tolerance
    (`wallBlocks` in index.html), plus the demand's own extra (a ribbon's
    meander amplitude, a barrier's half-gap, a second wall's half-span).
  - An early beat (`t` < its travel lead) cannot back-time before the level
    start: its release clamps at t≈0 and the entity materializes partway
    down the bore at CONSTANT speed (the birth fade covers the entrance),
    so the arrival still lands on the authored cue.
  - Beats never touch the level's main `spawnRng` sequence (each beat has a
    per-index `mulberry32` side stream), so adding/removing beats does not
    reshuffle the procedural filler, and legacy levels replay
    deterministically (same seed → same script; exact angles near walls
    follow the reachability law, not historical builds).
  - Fast opening: the first filler release fires on the first post-boot tick
    at full horizon depth (natural speed — never scaled), so the player
    always flies into a tunnel with traffic visibly inbound. Every
    enemy/pickup carries a ~0.35s birth fade — nothing pops into existence.
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
  - `wall-conflict` — an arrival left UNREACHABLE inside a wall carpet: its
    demanded dock arc falls within half-span + node tolerance of the LANDED
    wall. Unforced spawns relocate to safety on their own, so the usual
    culprits are `force`-overridden beats. Barrier pairs / heavies flag when
    either demanded end is swallowed — nodes route around any sub-π carpet,
    so a clear dock arc is otherwise always attainable.
  - `lull-violation` — a beat scheduled inside another beat's lull
  - `comm-overlap` — a beat arrival inside a comm window (it will slide late)
  - `unreachable-strip` — a bonus ride that overlaps a mandatory dual-node
    kill or crosses a wall carpet (meander amplitude joins the bound)

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
    and a relocated beat carries an inline "authored X, lands Y" warning
  - authored beats live on PACKED tracks (video-editor semantics): sequential
    beats share TRACK 1, genuinely simultaneous ones open TRACK 2/3…; type
    identity is the chip color; lulls pack as range chips
  - the FAIRNESS DIALOG: a conflicting placement (wall-vs-wall overlap or a
    predicted relocation) opens a 3-option choice — 1 CANCEL · 2 AUTO-PLACE
    (accept the engine's resolved position) · 3 OVERRIDE ⚡ (`force: true`,
    lands exactly as authored; the lint panel still judges it)
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

- **Phase 3 — campaign UX in game** (mostly done)
  DONE: case-file disc carousel (sync-zoom, swipe, teaser slots), per-campaign
  progress + verdicts + lastCamp restore, any-campaign unlocks, and IMAGE MAPS:
  a package's `map.image` (data:image URI) + per-level `mapPos {x,y in 0..1}`
  now render in the relay-map lens (camera, routes, hexes, chevrons all ride
  the image) and in the disc previews; the procedural city remains the
  fallback. REMAINING: custom speaker portrait rendering, per-campaign boss
  config, the player-facing community import entry, editor exclusion from
  store builds.
  Campaign picker (CAMPAIGN wheel sector → list when >1), per-campaign
  progress, difficulty tiers on the picker, dormant import path for
  community packages.

## Dev conveniences

- **Gamepad on desktop**: two analog sticks map absolutely to the two nodes
  (stick direction = node angle) for MacBook playtesting. Triggers fire the
  matching pulse, START pauses, A dismisses cards.

## Campaign arc & future boss concepts (designer-approved direction)

- Campaign 1 THE CARGO RUN (difficulty 1): teaches the enemy types one by
  one. Finale: the Warden Core (`bossKind: 'core'`).
- Campaign 2 GOING DEEPER (difficulty 2): MASS & FLOW — dense red traffic,
  high speed, few puzzle types; the player "rides" the tunnel. Bands drive
  surge waves. Finale: BADGE ZERO's private core (`bossKind: 'triad'`) —
  three linked mini cores (SHIELD / SHREDDER / ALIBI), destroyed core by
  core, arena riddled with rim walls + dart volleys.
- Campaign 3 SIGNAL LOST (difficulty 3): alternating hard-to-read puzzle
  levels and fast flow bursts (first shipped use of beats + bands). Finale:
  THE BEACON (`bossKind: 'spinner'`) — a rotating beam the player orbits to
  avoid; every COMPLETED sweep overloads the boss (4 sweeps kill it); add
  waves incl. rim walls between sweeps.
- Campaign 4 (BLACK ICE, teaser): TBD.
- Campaign 5 (ZERO DAY, teaser) FINALE CONCEPT — THE TUNNEL ITSELF: the far
  end glows red and attacks in phases — (1) a torrent of reds, (2) walls of
  node killers + rim walls, (3) purples, (4) demanding blue/white keyed
  waves — then the end MATERIALIZES INTO AN ORB killed by one SUPERSHOT the
  player charges for 2 seconds (dock-and-hold, extended charge) for a final
  cinematic kill. Needs: supershot charge mechanic + tunnel-mouth boss body.
