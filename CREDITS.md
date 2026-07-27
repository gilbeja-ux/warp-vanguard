# Credits & Licenses — Data Defender: Dark Fiber

## Music
All four soundtrack pieces were composed and produced by the game's author
(with AI-assisted tools) and are owned by the project. No third-party music
license is required.

| Track | File | Use | Length |
|---|---|---|---|
| Midnight Terminal Wait | `src/audio/Midnight_Terminal_Wait.mp3` | Menu | 116s |
| Sub Level Three | `src/audio/Sub_Level_Three.mp3` | Levels (track 1) | 170s |
| Steel and Rain | `src/audio/Steel_and_Rain.mp3` | Levels (track 2) | 160s |
| Terminal Velocity | `src/audio/Terminal_Velocity.mp3` | Levels (track 3) | 159s |

Endless/daily runs rotate through the three level tracks at loop boundaries.
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
