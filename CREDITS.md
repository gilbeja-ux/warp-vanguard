# Credits & Licenses — Warp Vanguard

## Music
Every soundtrack piece in this game — the menu theme and **every file in
`src/audio/music/`** — was composed and produced by the game's author (with
AI-assisted tools) and is owned by the project. No third-party music license is
required. That statement covers the folder as a whole, so tracks can be added,
renamed, or replaced without a per-file entry here.

- **Menu:** `src/audio/Midnight_Terminal_Wait.mp3` (116s), wired at `MUSIC_DATA.menu`.
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

All recorded one-shots are sourced from **CC0 / royalty-free libraries** (the
Sonniss GameAudioGDC bundles, Kenney CC0 packs, and Freesound CC0 — see the
"SFX source libraries" section in BRAND.md). CC0 requires no attribution, but
each file's origin is
logged below so the chain of title is provable at submission.

| Key | File | Use | Source | License |
|---|---|---|---|---|
| `hit` | `hit-1.wav` | Interception | _TBC_ | CC0 / royalty-free |
| `ui` | `mini-hit.wav` | Interface tick | _TBC_ | CC0 / royalty-free |
| `miss` | `miss.wav` | Breach | _TBC_ | CC0 / royalty-free |
| `miss2` | `miss2.wav` | Breach (alt) | _TBC_ | CC0 / royalty-free |
| `pick` | `power-up.wav` | Power-up collected | _TBC_ | CC0 / royalty-free |
| `pulse` | `pulse.mp3` | Pulse purge | _TBC_ | CC0 / royalty-free |
| `volley` | `volley.mp3` | Unite-volley fire | _TBC_ | CC0 / royalty-free |
| `shutdown` | `shutdown.mp3` | Node fried by a killer or wall | _TBC_ | CC0 / royalty-free |
| `restart` | `restarting.mp3` | That node rebooting back online | _TBC_ | CC0 / royalty-free |
| `startup` | `startup1.mp3` | Boot sequence as the ring locks in (cut at 2s) | _TBC_ | CC0 / royalty-free |
| `fail` | `failed.mp3` | Run lost | _TBC_ | CC0 / royalty-free |
| `win` | `win.mp3` | Level secured | _TBC_ | CC0 / royalty-free |
| — | `splash2.mp3` | Splash sting | _TBC_ | CC0 / royalty-free |

> **Before ship:** replace each _TBC_ with the pack or Freesound URL the file
> came from. The license column is already correct; only the origin is missing.

## Code
All game code in this repository is original to the project.
