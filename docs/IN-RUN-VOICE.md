# In-run voice — the handler barks

Replaces the scripted comm chatter (113 bespoke lines across 40 levels) with one
reactive voice: **CMD**, the handler. Plot moves entirely to the briefing discs
and case notes; the in-run channel stops carrying story and starts carrying
*reaction*.

## Why

The old chatter fired on a fixed clock (`t = 6 / 20 / 36`) at 8–10px Audiowide on
the aim axis — unreadable under load, and redundant: most case notes already
restate the level's comm reveal, several word-for-word. Deleting all 113 lines
loses no plot.

## Cast rule

| Voice | Where it speaks | Carries |
|---|---|---|
| **CMD** — the handler | In-run barks | Direction, reaction. Never plot. |
| **WARD** — the interdiction | Boss fights only | Taunts: each leech's `speak` line in `BOSS_DEFS`, [src/game/52-bosses.js](../src/game/52-bosses.js). (This row said CORE, the intruder, until the old bosses were retired in 2026-08; WARD is the leech family's one voice.) |
| **HAUL**, **TRACE** | Discs + case notes only | Exposition, the case. |

---

## Rules

These are non-negotiable — the first two are correctness, not taste.

1. **Draw-only. Never touch sim state.** Campaign levels reseed `Math.random`
   with `mulberry32` in `startLevel` ([src/game/60-input.js](../src/game/60-input.js))
   — `Math.random` *is* the sim RNG. A bark that draws from it (or from `spawnRng`)
   desyncs the replay verifier and breaks leaderboard validation.
2. **Variant choice is a counter, not a roll.** `BARKS[id][barkN++ % n]`. Zero
   randomness, deterministic across replays, free.
3. **Never queue.** A bark that can't fire is dropped. Queued barks arrive stale
   and comment on something that stopped being true 6 seconds ago.
4. **Priority interrupts.** A lower-priority bark on screen is replaced
   immediately by a higher one. Equal or lower is dropped.
5. **Global cooldown 7s** on top of per-trigger cooldowns, so barks never stack.
6. **Silence is fine.** A quiet run is a clean run. Target ~4–6 barks per level,
   not 3-per-level guaranteed.
7. **A bark must REACT to something.** There is deliberately no start bark. There
   used to be a `deploy` trigger at `levelT > 1.5` and it broke this rule: nothing
   has happened by then, so all four variants were platitudes ("lane is yours,
   runner", "corridor is hot. go."), and because variant choice is a counter it was
   a *different* platitude every run. The launch already has a voice — Command's
   handover line at the end of the boot (`introStageChange`, stage 4:
   "Vanguard released, Godspeed."). Do not add a second one; if the opening feels
   quiet, that is the boot ceremony's job, not the channel's.

## Trigger table

Priority 1 = highest. "Once" = fires at most once per run.

| id | Fires when | Pri | Cooldown | Once |
|---|---|---|---|---|
| `firstHeavy` | first heavy spawns this run | 3 | 8s | ✓ |
| `firstLine` | first barrier pair spawns | 3 | 8s | ✓ |
| `firstWall` | first latch telegraphs | 2 | 8s | ✓ |
| `ribbon` | golden strip spawns | 4 | 12s | ✓ |
| `pickup` | power-up collected | 6 | 20s | — |
| `streak` | combo crosses 10 | 4 | 25s | — |
| `cleanHalf` | 50% progress, no node lost | 5 | — | ✓ |
| `nodeLost` | a node fries | 1 | 6s | — |
| `lastStretch` | 85% progress | 4 | — | ✓ |
| `bossOpen` | boss engages | 1 | — | ✓ |
| `bossLow` | boss at final hits | 1 | — | ✓ |
| `win` / `loss` | run ends | 1 | — | ✓ |

Boss barks defer to WARD: if a leech taunt is on screen, CMD stays quiet.

A `firstFrag` trigger ("first node killer spawns", priority 2) left with the node
killer on 2026-08-27. The live table is `BARK_CFG` in
[src/game/83-deepfield.js](../src/game/83-deepfield.js).

## The pool

House style, matching the existing comms: lowercase, terse, ≤ 40 characters
(the validator caps comms at 64 — stay well under). Rotate in order.

```js
const BARKS = {
  firstHeavy:  ['armor inbound. both emitters.', "that one's plated. hold the bolt.",
                "heavy. you'll need the pair."],
  firstLine:   ['barrier strung. take an end each.', 'pair job. split the emitters.',
                'two ends, two emitters.'],
  firstWall:   ['wall forming. reroute.', "they're sealing the rail. move.",
                'clamp coming down. get off it.'],
  ribbon:      ['clean current. ride it.', 'gold on the lane. take it.',
                'free charge. go get it.'],
  pickup:      ['good grab.', "that'll hold.", 'logged.', 'useful.'],
  streak:      ["you're ahead of them.", 'nice line.', 'keep that rhythm.',
                "they can't place a hit."],
  cleanHalf:   ["halfway. nothing's through.", "convoy's intact. stay on it.",
                'clean so far. hold it.'],
  nodeLost:    ["emitter's down. hold what's left.", "we're one short. tighten up.",
                "lost one. don't lose the lane."],
  lastStretch: ["final stretch. they'll throw everything.",
                "almost home. don't ease off.", 'last leg. finish it.'],
  bossOpen:    ["that's the leech. pulse it off our lane.", 'there it is. feed on its swarm.'],
  bossLow:     ["it's failing. finish it.", 'one more pulse. put it down.'],
  win:         ["lane's clear. good work.", 'convoy delivered. logged.'],
  loss:        ["lane's gone. we'll re-run it.", 'they got through. again.']
};
```

37 lines, reused across all 40 levels — down from 113 bespoke ones. This block is
a copy of `BARKS` in [src/game/83-deepfield.js](../src/game/83-deepfield.js),
synced 2026-10-10 (the node killer's three lines left on 2026-08-27, and the
words follow the game's own: emitter, lane). The code is the pool of record.

**Per-campaign flavor (optional).** A package may ship `barks: { triggerId: [...] }`
to override any subset; unlisted triggers fall through to the pool above. Useful
for C5 "Shutdown", where the handler is escorting a virus and the tone inverts.

## Legibility

The current ticker is the problem, not the writing. Whatever ships must:

- sit in the **lower safe area**, near the HUD where the eye already checks score
  — not `H * 0.185` on the aim axis
- never shrink below **12px**; if it doesn't fit, the line is too long — cut it
- ~~keep the portrait tile~~ — **removed 2026-08-05.** Only 2 of 7 speakers ever
  had their own face; the rest wore haulage's suit, which said less than the name
  chip does. The line is chip + message now, and it has that width back
- hold for 4s, not 6 — reactive lines go stale fast

## Migration

1. Delete `comms` from all 40 levels in [campaigns.js](../src/campaigns.js) and the
   ticker's clock-driven feed. **Done 2026-07-30:** the bundled packages carry no
   `comms`, the clock-driven feed is gone, and the ticker in
   [src/game/90-hud.js](../src/game/90-hud.js) shows what `bark()` in
   [src/game/83-deepfield.js](../src/game/83-deepfield.js) puts on the line.
2. ~~Keep `caseNote`~~ — **deleted 2026-08-05.** It stopped being drawn on the
   report and nothing read it, so the plot beats it held live in `story` now.
3. Fold any beat that lived *only* in a comm into that level's `story` lines.
4. Keep the comm renderer; repoint it at the bark system and move it down-screen.
5. `validateCampaign` keeps accepting `comms` (older packages stay valid) but the
   bundled campaigns stop using it.
