# The OVERCHARGE — built, tested, rolled back

Built 2026-08-27. Rolled back the same day on Gil's call after a live test:
**"too hard to both understand and to capitalize on this enemy."**

The whole change is in `OVERCHARGE.patch` beside this file. Re-apply with
`git apply docs/parked/OVERCHARGE.patch` from a tree at 159e1a0.

## What it was

The `frag` enemy became a live electric charge instead of pure bait.

| Player does | Result |
| --- | --- |
| Volley at z ≥ 0.71 | The charge releases. Everything within ±0.23 of that depth dies. |
| Volley at z < 0.71 | The charge earths through the ring. Both emitters short. |
| Contact at the ring | The emitter fries. Unchanged. |
| A swerve | 25 points, down from 50. |

One constant, `OC_SAFE_Z = 0.71`, drove the shot, the short and the hazard glyph.
It is the ring (hitZ 0.25) plus a quarter of the lane. `OC_BLAST_R = 0.23` was the
blast's half-depth. `OC_SAFE_Z - OC_BLAST_R = 0.48` kept a legal blast clear of the
ring by construction, so only a LATE shot could ever short you.

It shipped 892 passing checks. The rollback is not about defects.

## Why it failed

The object asked the player to read a depth threshold under pressure, then spend
both thumbs for 1.75 seconds on a target that pays nothing unless traffic happens
to be beside it. Two demands, both invisible until you already know them. The
hazard glyph solved the "what is it" half and did nothing for the "when, and is it
worth it" half.

## What is worth keeping

Three pieces here are good independent of the overcharge:

1. **`volleyKill()`** — one ledger for every volley kill, so a blast kill can never
   drift from a bolt kill. Directly reusable by any volley area-damage work.
2. **The depth-slab blast and `drawOcWaves()`** — a ring bounded in depth, filled
   between its two edges. Perspective squeezes ±0.23 of z into a few pixels out in
   the bore, so a pair of honest edge rings reads as one ring going soft. The fill
   is what makes a discharge legible down a bore.
3. **`fragSched` / `OC_SEPARATION`** — charges never enter `sched`, so they were
   invisible to each other and could stack. That hole exists in the shipped game
   too; it only stays harmless while the spawn window keeps charges isolated.

## What it cost, if it is ever revived

Accepting a spawn the old gate rejected shifts every seeded draw downstream, so
every board id moves and stored replays disagree. Two lint findings fell out. One
needed a real edit: C2 L07's heavy beat moved from t 44 to 44.5.

C1's seven lanes were already full, so the burst debut had to give up its hint for
the overcharge to have one. An eighth play level was the clean fix, never taken.
