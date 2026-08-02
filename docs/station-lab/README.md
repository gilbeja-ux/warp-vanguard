# Station lab — the built destinations

**The renderer that ships lives in `src/game/81-station3d.js`.** This directory is
the standalone preview harness for it: the same code, driven headlessly so a
change can be looked at without starting a run.

The station that shipped before (`drawRingBody`, the `DEST-RING` region of
`src/game/80-tunnel.js`) was flat-shaded vector art: 26 facets, one gradient each,
a perfect circular outline. **It is gone** — deleted along with `RING_KINDS`,
`CORE_KINDS`, `RING_SHADE`, the core designs and the ring sprite cache, about 430
lines in all. Keeping it as a bake-time fallback meant the game carried two
incompatible ideas of what a station looks like in order to cover a gap measured
in seconds. What covers that gap now is `s3placeholder`: a dark hull disc on the
same key light and the same steel as the build about to replace it — the mass, at
the right size, in the right light, making no claim to be a station.

## What the renderer is

A small software 3D pipeline that **bakes** a station once and caches it as a
sprite — the same bargain the planets already make, so it can afford to be slow
and physically honest.

    geometry → shadow map (ortho, from the sun) → G-buffer → SSAO → shade → bloom → sprite

Four things do the work, in order of how much they matter:

1. **A grazing key light plus a shadow map.** Parts cast onto the parts below
   them. A light down the view axis hides every shadow behind the thing casting
   it, which is why the old art had no relief.
2. **Occlusion straight off the depth buffer.** Darkens every join without
   knowing what met what. It is what grounds 200 crates onto one deck.
3. **Per-part tone and hue drift.** A hull painted one grey is a clay model
   however well it is lit.
4. **A greeble pass with a size hierarchy.** A few hero blocks, clusters of fine
   hardware, four component forms. Uniform detail reads as texture; varied detail
   reads as machinery.

Shading runs in **linear** light with exactly one sRGB encode at the end. Two
stacked gammas was the bug that made the first pass look like grey clay.

The bake is a **generator**: it yields between slices, and the frame loop spends
a few milliseconds a frame on it while the player is on the menu.

## The builds, one per contract

| campaign | build | tris | lamps |
| --- | --- | ---: | ---: |
| C1 · investigation | port & piers | 17,680 | 25 |
| C2 · going-deeper | gate | 11,028 | 40 |
| C3 · signal-lost | spine & torus | 28,084 | 22 |
| C4 · the-bait | truss disc | 38,584 | 31 |
| C5 · shutdown | fortress ring | 16,036 | 28 |

A campaign's endpoint is its **last level**, and it outranks the boss star: you
fight the interdictor at the gates of the place you were escorting the convoy to.
Ordinary station relays are dealt one of the four station builds off their own
hash, so the same builds serve as the stations in orbit around worlds and the
installations on the galaxy chart.

Lamps come out of the bake as **coordinates**, not pixels, so they are drawn live
over the sprite. Four behaviours — steady, beacon, strobe, slow — all taken from
real vehicle lighting, all deliberately slow.

## Measured, in the game

| | desktop | 6× CPU throttle |
| --- | ---: | ---: |
| all five baked | 2.7 s | 17 s |
| frame median while baking | 8.5 ms | 34 ms |
| frame p99 | 18.4 ms | 90 ms |
| longest single slice | ~13 ms | 77 ms |

Two things had to be fixed to get there, both worth knowing about before touching
the scheduler:

- **Budget off the frame's own work, not `rawDt`.** `rawDt` is the wall clock
  between frames — at 60 fps that is 16.7 ms of mostly vsync wait, so subtracting
  it from a budget leaves a negative number every frame and the bake never runs.
- **A guaranteed floor (`bakeMin`).** Budgeting purely on spare time meant a
  device slow enough to have none never baked at all and kept the old art
  forever.

## Tuning

Every number is in the destinations lab (`npm run lab:dest`) under **STATIONS 3D**
— light and material, how the lights blink, and a tab per build. The tables live
in the `DEST-DATA` region with every other destination dial, so the lab writes
them straight back to the game.

The single most consequential dial is `lz`, how low the sun sits.

## Files here

| file | what it is |
| --- | --- |
| `r3d.js`, `models.js` | the original standalone prototype (kept: it is the readable version) |
| `sheet.html` | contact sheet of all five, from the prototype |
| `hero2.html` | one build large from **the game's own file** (`?m=FORT`), or `?mode=ladder` |
| `verify.html` | the campaign → build mapping, rendered from the game's file |
| `shot2.js` | headless screenshot: `node shot2.js <url> <out.png>` |
| `timing.js` | measures bake time and frame impact against a running dev server |

Rendering needs Chrome; it runs through `puppeteer-core`, which the repo already
has. `hero2.html` and `verify.html` need `dials.js` beside them — regenerate it by
lifting `S3D_LIGHT` and `S3D_LAMPS` out of the `DEST-DATA` region.

    node docs/station-lab/shot2.js "file://$PWD/docs/station-lab/sheet.html" /tmp/sheet.png
    node docs/station-lab/timing.js 6      # with the dev server up on :8000
