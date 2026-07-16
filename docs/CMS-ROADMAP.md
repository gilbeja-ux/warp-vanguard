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

- **Phase 1 — beats, bands, linter**
  Timeline compiler (beats + seeded band filler → one deterministic spawn
  schedule). Fairness linter as a pure function: walks a compiled level and
  reports 100%-completable-law violations (dual-node conflicts, wall
  clearance, unreachable streams) with timestamps.

- **Phase 2 — the Tunnel Designer (editor.html)**
  Desktop-only page driving the real engine (same eval-the-game-script trick
  as scripts/test.js). Video-style scrubbing of the tunnel; click to place
  enemies/pickups/comms at time+angle; band lanes with knobs; map image
  upload + click-to-pin levels; speaker roster + portrait upload; live lint
  panel; play-from-here; package export.

- **Phase 3 — campaign UX in game**
  Campaign picker (CAMPAIGN wheel sector → list when >1), per-campaign
  progress, difficulty tiers on the picker, dormant import path for
  community packages.

## Dev conveniences

- **Gamepad on desktop**: two analog sticks map absolutely to the two nodes
  (stick direction = node angle) for MacBook playtesting. Triggers fire the
  matching pulse, START pauses, A dismisses cards.
