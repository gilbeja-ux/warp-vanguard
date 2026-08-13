# Credits & Licenses — Warp Vanguard

## Music
Every soundtrack piece in this game — the menu theme and **every file in
`src/audio/music/`** — was composed and produced by the game's author (with
AI-assisted tools) and is owned by the project. No third-party music license is
required. That statement covers the folder as a whole, so tracks can be added,
renamed, or replaced without a per-file entry here.

- **Menu:** `src/audio/Warp Lane Drift.mp3` (215s), wired at `MUSIC_DATA.menu`.
  It replaced *Midnight Terminal Wait* (116s) in commit `262be2d`; the older file
  is no longer referenced and is excluded from the shipped build.
- **Run pool:** everything in `src/audio/music/`. `npm run build` scans that
  folder and writes the list to `src/audio/music/tracks.js`; the display title of
  each track is derived from its filename at runtime. Adding music is a drop-in
  plus a build — renaming the file renames the track, with nothing to keep in sync.

Every run draws its opening track at random from the pool — a shuffled bag, so
all of them play once before any repeats. FREE FLOW (endless and daily) keeps
drawing for as long as the run lasts: the next track is decoded ~14s ahead of
the seam and crossfaded in over 4s under the outgoing one, so a long run never
hears a gap or a hard cut. The daily's *opening* track is derived from the day
number instead, so everyone shares the same first minutes. The track names itself
on screen for a few seconds at the start of a run and at each crossfade, and can
be skipped from the pause panel.

The menu track loops through a 1.2s gain duck at the seam so it crossfades into
itself rather than hard-cutting.

## Fonts
- **Audiowide** — SIL Open Font License 1.1, bundled as a latin subset at
  `src/fonts/audiowide.woff2`. © The Audiowide Project Authors.

## Sound effects
Hybrid. Reactive sounds — zaps, sonar ticks, UI tones, boot pips — are
synthesized at runtime with the Web Audio API. Big moments use **recorded
one-shots**, shipped in `src/audio/sfx/` and wired through the `SFX_SRC` map in
`src/index.html`:

All recorded one-shots are drawn from **CC0 / royalty-free libraries** — the
Sonniss GameAudioGDC bundles, Kenney CC0 packs, and Freesound CC0.

**CC0 requires no attribution.** This table therefore credits the pool rather
than the file: the per-file origins were not recorded at the time, and inventing
them later would be worse than saying so. Nothing here is owed a credit line;
the list exists so anyone reading knows what the audio is and where it came
from as a class.

| Key | File | Use | License |
|---|---|---|---|
| `hit` | `hit-1.wav` | Interception | CC0 / royalty-free |
| `ui` | `mini-hit.wav` | Interface tick | CC0 / royalty-free |
| `miss` | `miss.wav` | Breach | CC0 / royalty-free |
| `miss2` | `miss2.wav` | Breach (alt) | CC0 / royalty-free |
| `pick` | `power-up.wav` | Power-up collected | CC0 / royalty-free |
| `pulse` | `pulse.mp3` | Pulse purge | CC0 / royalty-free |
| `pulseArm` | `pulse_charge.mp3` | An orb reaching full | CC0 / royalty-free |
| `volley` | `volley2.mp3` | Unite-volley fire | CC0 / royalty-free |
| `shutdown` | `shutdown.mp3` | Node fried by a killer or wall | CC0 / royalty-free |
| `restart` | `restarting.mp3` | That node rebooting back online | CC0 / royalty-free |
| `startup` | `startup1.mp3` | Boot sequence as the ring locks in (cut at 2s) | CC0 / royalty-free |
| `fail` | `failed.mp3` | Run lost | CC0 / royalty-free |
| `win` | `win.mp3` | Level secured | CC0 / royalty-free |
| `warpIn` | `warp-in.mp3` | Spooling into the lane | CC0 / royalty-free |
| `inWarp` | `in-warp.mp3` | The lane, looped under a run | CC0 / royalty-free |
| `exitWarp` | `exit-warp.mp3` | Dropping out of warp on a win | CC0 / royalty-free |
| `bossArrive` | `boss-arrival.mp3` | A leech surfacing | author-supplied — **confirm** |
| `bossDead` | `boss-dead.mp3` | A leech breaking up | author-supplied — **confirm** |
| — | `splash2.mp3` | Splash sting | CC0 / royalty-free |

> **The only open question is the last two.** `boss-arrival.mp3` and
> `boss-dead.mp3` were added by hand in August 2026 and did not come through the
> CC0 pool above, so their licence is whatever their actual source says. If they
> came from a paid pack, a subscription library, or anywhere with terms, note it
> here before public launch — that is the one line in this file that could
> actually matter later.

<!-- historical note, kept deliberately: this table used to carry a per-file
     "Source" column of _TBC_ placeholders under a sentence claiming the chain
     of title was "provable at submission". It was not — the column was empty.
     A document that overstates its own evidence is worse than one that admits
     the gap, so the claim went and the gap is stated. -->

## Code
All game code in this repository is original to the project.
