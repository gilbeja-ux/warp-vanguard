# Parked: the fused ray cannon

Kept as an option, not deleted. This is the one boss control scheme the game has
tried and reverted, and the reasons are worth keeping next to the code.

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

## Where the code still is

It is disabled but not removed: `mergeT` is never raised and `beamActive` is
never set, so every branch below is unreachable. Listed so a revival or a
deliberate removal can find all of it — 45 sites, 9 files.

| file | what |
| --- | --- |
| `40-state.js:117-124` | `heat`, `overheat`, `beamActive`, `beamAim` |
| `52-bosses.js:42,66,195-222` | `mergeT`, `beamGeometry`, `beamHitCore` |
| `85-enemy-art.js:1364-1400` | `drawBeam` — barrel, beam, heat window |
| `85-enemy-art.js:1529-1660` | `fused` branches in `drawNodes` / `drawArcNode` |
| `85-enemy-art.js:2189-2210` | the fire-stick dial: heat ring + aim knob |
| `72-tick.js:480-504` | the fused carriage's fry handling (**sim code**) |
| `71-gamepad.js:400-402` | pad mapping skips node 1 while fused |
| `80-tunnel.js:232` | range rings defer to the duel's own instrumentation |
| `11-music.js:725-...` | `beamSound` — the drone, pitch rising with heat |
| `61-replay.js:166,363` | teardown resets `beamActive` |

⚠️ `99-boot.js:1019-1051` also has a `heat` — a **local** const for a warp
streak's head cooling as it runs. Unrelated. Do not touch it.

Removing this is its own change: it reaches into `72-tick.js`, so it moves
`SIM_ID` and needs the verifier redeployed. Worth doing before any boss gains a
real heat mechanic, so the new one is not built next to a corpse that shares its
vocabulary.

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
