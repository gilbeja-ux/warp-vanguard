# Parked: the ray's weld scar

Kept as an option, not deleted. Sibling of [RAY-CANNON.md](RAY-CANNON.md), and the
same rule applies: the reasons are worth keeping next to the code.

Restore with:

    git apply docs/parked/beam-weld-scar.patch

The patch is against `src/game/85-enemy-art.js` at commit `fb5d969`. It was never
committed, so it is not in the history and this file is its only home.

## What it was

Three changes to how a boss sweep is painted. All of it lived in the art file and
none of it touched the sim.

**The weld scar.** A ray does not touch the ring, it heats it. Where the light
stood the band ran white, and when the light moved on that spot cooled through the
ray's own colour and died about a third of a second later. `rayScars` sampled the
live ray's angle behind its head, then `drawRayScars()` drew the trail on two
clocks: a fast one for the glow of the pool, a slow one for the discolouration
left in the metal. Its own note states the hard-won rule: **one arc per age band,
never one arc per sample** — a hundred short additive arcs double up at every
seam and read as a staircase welded onto the rim.

**A recoloured palette.** Four additive passes saturate to white wherever they
overlap, so the blue ray only stayed blue at its edges and both carriages read
white. `beamPal()` gained `core` and `coreW`, pulling the blue down to the blue
carriage's own value and making the white-hot filament narrower and off-white — a
thin white thread inside a blue channel, instead of a blue outline around a white
one.

**A rewritten channel.** The sweep became four additive passes over one writhing
path, with charge packets running outward, arc-over filaments spat sideways off a
clock, a mouth that surges on birth, and a running-white pool where the light met
the band.

## Why it is parked

Gil called it away on 2026-08-27. It is unfinished work, not rejected work: the
scar's own comment block is duplicated in the patch, which is the fingerprint of a
pass that was still mid-edit.

## What it touches, if it comes back

`drawLeechBeam()` is named for the leech FAMILY, not the leech boss. The leech
never shoots. The sweep belongs to **siphon**, **prism** and the blockade's last
stand, so this art is on screen in three campaigns.
