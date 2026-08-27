# RETIRED: the fused ray cannon

> **This boss type is retired. Do not revive it, and do not build against it.**
> Gil closed it on 2026-08-27: *"remove all the remains of the 'we fire beams at
> the boss' type"*. The code is gone, this file is the whole record, and nothing
> in the game refers to it any more.

The current bosses are the opposite arrangement, and they stay: **you hit a boss
with PULSES, and it sometimes fires a ray at your emitters.** The player never
fires a beam. Anything that reads the other way round is a remain, and belongs
in this file or in the bin.

This is the one boss control scheme the game tried and reverted, and the reasons
are worth keeping.

## What it was

At `boss.mergeT >= 1` the two carriages **fused** into a single cannon. The left
dial kept steering it; the right dial stopped being an emitter and became a
**fire stick** — an aim knob plus a heat ring. Holding fired a continuous beam
down the bore at the core. Heat climbed while firing, and at full heat the cannon
**overheated** and locked out until it cooled.

Mechanically it was a twin-stick shooter for the length of one fight.

## Why it was parked

It changes what a thumb means. Every other second of the game teaches that the
right dial *is* the white emitter; the duel took that away and handed back a
turret. The fight was legible on its own terms and wrong in the context of the
forty relays around it.

The boss file states the rule it produced, twice:

> `// NO fuse, NO beam, NO stick: the dials stay yours.`
> `mergeT: 0, introT: 0 // controls never change hands — no fuse, ever`

**The lesson, stated so it survives the code:** boss pressure belongs in the
world, not in the player's hands. A boss may slow the lane, take the ring, blind
an emitter or demand a specific phase — it may not redefine a control.

## What could bring it back

Only as an opt-in mode, never inside a campaign — a separate arcade mode, a
mutator, or a bonus fight the player chooses. As soon as it is one relay among
forty it is teaching against the game.

## Where the code went

**Nowhere. It is deleted.** The 45 sites across 9 files that this section used to
list were removed whole by **H-24** on 2026-08-24 (`docs/HOUSEKEEPING.md`), with
all 41 board fingerprints byte-identical before and after: `heat`, `overheat`,
`beamActive`, `beamAim`, `BEAM_S`, `drawBeam`, `beamGeometry`, `beamHitCore`,
`beamSound`, `beamOscs`, `sfx.overheatWarn`, every `fused` / `fusedV` /
`fireStick` branch, and `boss.mergeT` itself.

The last two residues went on 2026-08-27:

- a stale comment in `85-enemy-art.js` that said a rail clamp "fries the cannon";
- `src/game/80-tunnel.js.bak`, an untracked backup that still held
  `if (boss && boss.mergeT >= 1)`. Moved to `docs/parked/80-tunnel.js.bak` so no
  copy of the era is left under `src/`.

**Do not confuse this with the live boss sweep.** `b.beams`, `bossBeams()`,
`raySweep()`, `beamPal()` and `drawLeechBeam()` are the BOSS firing at the
player, which is current and correct. `drawLeechBeam` is named for the leech
FAMILY, not the leech boss; the sweep is the verb of **siphon**, **prism** and
the blockade's last stand. `drawLineBeam` is the live line-pair enemy. None of
those are remains. Leave them alone.

## The idea it was reaching for, done a legal way

The ray cannon wanted a fight about **managing a resource under a clock**. That
is available without touching a control, because the game already banks pulse
charge **per emitter** (`pulseCharge = [0, 0]`, `PULSE_MAX = 45`), and no boss
has ever asked for it.

See **THE CAPACITOR** in the boss proposal: the boss charges a discharge on a
visible clock, only a pulse cancels it, and its intake is phase-keyed and flips
each round — so which thumb has to do the farming keeps changing. Same feeling of
a resource race against a timer. Both dials still mean exactly what they always
meant.
