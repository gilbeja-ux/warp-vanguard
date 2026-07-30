# In-run voice — the handler barks

Replaces the scripted comm chatter (113 bespoke lines across 40 levels) with one
reactive voice: **CID**, the handler. Plot moves entirely to the briefing discs
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
| **CID** — the handler | In-run barks | Direction, reaction. Never plot. |
| **CORE** — the intruder | Boss fights only | Taunts. Already wired at [index.html:2711](../src/index.html#L2711). |
| **OMNI**, **TRACE** | Discs + case notes only | Exposition, the case. |

---

## Rules

These are non-negotiable — the first two are correctness, not taste.

1. **Draw-only. Never touch sim state.** Campaign levels reseed `Math.random`
   with `mulberry32` at [index.html:3498](../src/index.html#L3498) — `Math.random`
   *is* the sim RNG. A bark that draws from it (or from `spawnRng`) desyncs the
   replay verifier and breaks leaderboard validation.
2. **Variant choice is a counter, not a roll.** `BARKS[id][barkN++ % n]`. Zero
   randomness, deterministic across replays, free.
3. **Never queue.** A bark that can't fire is dropped. Queued barks arrive stale
   and comment on something that stopped being true 6 seconds ago.
4. **Priority interrupts.** A lower-priority bark on screen is replaced
   immediately by a higher one. Equal or lower is dropped.
5. **Global cooldown 7s** on top of per-trigger cooldowns, so barks never stack.
6. **Silence is fine.** A quiet run is a clean run. Target ~4–6 barks per level,
   not 3-per-level guaranteed.

## Trigger table

Priority 1 = highest. "Once" = fires at most once per run.

| id | Fires when | Pri | Cooldown | Once |
|---|---|---|---|---|
| `deploy` | 1.5s after the intro clears | 5 | — | ✓ |
| `firstHeavy` | first heavy spawns this run | 3 | 8s | ✓ |
| `firstLine` | first barrier pair spawns | 3 | 8s | ✓ |
| `firstWall` | first latch telegraphs | 2 | 8s | ✓ |
| `firstFrag` | first node killer spawns | 2 | 8s | ✓ |
| `ribbon` | golden strip spawns | 4 | 12s | ✓ |
| `pickup` | power-up collected | 6 | 20s | — |
| `streak` | combo crosses 10 | 4 | 25s | — |
| `cleanHalf` | 50% progress, no node lost | 5 | — | ✓ |
| `nodeLost` | a node fries | 1 | 6s | — |
| `lastStretch` | 85% progress | 4 | — | ✓ |
| `bossOpen` | boss engages | 1 | — | ✓ |
| `bossLow` | boss at final hits | 1 | — | ✓ |
| `win` / `loss` | run ends | 1 | — | ✓ |

Boss barks defer to CORE: if a CORE taunt is on screen, CID stays quiet.

## The pool

House style, matching the existing comms: lowercase, terse, ≤ 40 characters
(the validator caps comms at 64 — stay well under). Rotate in order.

```js
const BARKS = {
  deploy:      ['line is yours, defender.', "clock's running. keep it clean.",
                "we're live. eyes up.", "wire's hot. go."],
  firstHeavy:  ['armor inbound. both nodes.', "that one's plated. hold the bolt.",
                "heavy. you'll need the pair."],
  firstLine:   ['barrier strung. take an end each.', 'pair job. split the nodes.',
                'two ends, two nodes.'],
  firstWall:   ['wall forming. reroute.', "they're sealing the rail. move.",
                'clamp coming down. get off it.'],
  firstFrag:   ["black packet. don't touch it.", 'node killer on the rail. steer.',
                'that one bites. go around.'],
  ribbon:      ['clean current. ride it.', 'gold on the wire. take it.',
                'free charge. go get it.'],
  pickup:      ['good grab.', "that'll hold.", 'logged.', 'useful.'],
  streak:      ["you're ahead of them.", 'nice line.', 'keep that rhythm.',
                "they can't place a hit."],
  cleanHalf:   ["halfway. nothing's through.", "convoy's intact. stay on it.",
                'clean so far. hold it.'],
  nodeLost:    ["node's down. hold what's left.", "we're one short. tighten up.",
                "lost one. don't lose the line."],
  lastStretch: ["final stretch. they'll throw everything.",
                "almost home. don't ease off.", 'last leg. finish it.'],
  bossOpen:    ["that's the core. six hits.", 'there it is. dock and hold.'],
  bossLow:     ["it's failing. finish it.", 'one more. put it down.'],
  win:         ["relay's clear. good work.", 'convoy delivered. logged.'],
  loss:        ["line's gone. we'll re-run it.", 'they got through. again.']
};
```

35 lines, reused across all 40 levels — down from 113 bespoke ones.

**Per-campaign flavor (optional).** A package may ship `barks: { triggerId: [...] }`
to override any subset; unlisted triggers fall through to the pool above. Useful
for C5 "Shutdown", where the handler is escorting a virus and the tone inverts.

## Legibility

The current ticker is the problem, not the writing. Whatever ships must:

- sit in the **lower safe area**, near the HUD where the eye already checks score
  — not `H * 0.185` on the aim axis
- never shrink below **12px**; if it doesn't fit, the line is too long — cut it
- keep the portrait tile (it's good, and it's what makes the voice a character),
  but drop to a smaller chip so the line can grow
- hold for 4s, not 6 — reactive lines go stale fast

## Migration

1. Delete `comms` from all 40 levels in [campaigns.js](../src/campaigns.js) and the
   ticker's clock-driven feed at [index.html:4653-4656](../src/index.html#L4653-L4656).
2. Keep `caseNote` untouched — it already carries every plot beat.
3. Fold any beat that lived *only* in a comm into that level's `story` lines.
4. Keep the comm renderer; repoint it at the bark system and move it down-screen.
5. `validateCampaign` keeps accepting `comms` (older packages stay valid) but the
   bundled campaigns stop using it.
