# Brand & Design Tokens — DATA DEFENDERS: DARK FIBER

## Name
- Full: **DATA DEFENDERS: DARK FIBER**  ·  Short: **DARK FIBER**
- Tagline: *Guard the payload.*
- Store subtitle: *Defend the line. Deliver the evidence.*
- Before store submission: run a USPTO TESS + Play/App Store search on the
  final name ("Data Defenders" alone is already in use by two other apps).

## Mark
A **shield badge**: gold rim over a chamfered near-black body, with a receding
blue tunnel grid — concentric hoops and radial spokes converging on a bright
vanishing point — filling the lower half. The bore is the mark.

- **Full lockup** — `src/logo.png`. The badge carrying its own lettering:
  DATA large in cyan-chrome, DEFENDERS beneath it, *Dark Fiber* in gold between
  two gold rules, over the tunnel grid. Used on the menu and marketing surfaces.
  Loaded at runtime by `brandLogo()`; the code keeps an Audiowide drawn stack as
  a fallback if the file is missing.
- **App icon** — `src/icons/df-192.png` / `df-512.png` (`any`) and
  `df-mask-192.png` / `df-mask-512.png` (`maskable`). Same shield with the
  lettering removed and an interlocked gold **DD monogram** over the tunnel
  grid, cyan chevrons top and bottom. Icon = badge only, no wordmark.

The old EMP-emitter mark (coil body, twin prongs, live arc) is **retired**. It
was retired with the thing it depicted: the player node is no longer a device on
the ring, it is a lit arc sector of the ring itself.

## Color tokens
| Token | Value | Meaning |
|---|---|---|
| `--node-blue` | `#50aaff` (80,170,255) | player node 1 — must match the blue lock enemy |
| `--chrome-cyan` | `#6FE3FF` (111,227,255) | UI/console chrome: panels, brackets, headers |
| `--node-white` | `#FFFFFF` / `#EBF5FF` | player node 2, CID |
| `--threat-red` | `#FF3C5A` (255,60,90) | hostile taps, alarms |
| `--armor-purple` | `#D465FF` (212,101,255) | heavies, boss, CORE |
| `--gold` | `#FFD24A` (255,210,74) | pickups, frontier, rewards, attention |
| `--secured-green` | `#7EE262` (126,226,98) | secured runs, wins, TRACE |
| `--infra-teal` | `rgba(80,230,200)` | cable grid, infrastructure |
| `--void` | `#02060E` → `#0A1A34` | backgrounds, blueprint fills |

Rule: color IS gameplay language (red = any node, blue/white = matching node,
purple = both nodes, black = node-killer trap). Marketing assets use only
these tokens.

## Typography
- Display/UI: **Audiowide** (OFL, bundled). Letter-spacing 1–3px for headers.
- Data garnish: monospace (binary rain, hex codes) — never for reading copy.

## Chrome
- `techRect` corner-cut panels, 1.5px strokes, translucent navy fills.
- Track-and-rails gauge grammar for all instruments (pads, coverage, arcs).
- Overlay text always drawn as the frame's last pass.

## Audio direction
- Music: synthwave/cyber, author-produced. Normalize tracks ~-14 LUFS.
- **Menu track: SHIPPED** — *Midnight Terminal Wait*
  (`src/audio/Midnight_Terminal_Wait.mp3`), wired at `MUSIC_DATA.menu`. It
  replaced the 31s *View From The Dashboard*, which has been deleted.
- The **seam duck is retained deliberately**, not removed as the old spec
  planned: `updateMusic` eases the menu track's gain down to 0.12 across the
  1.2s either side of the loop boundary and back up, so the loop crossfades
  through itself instead of hard-cutting. It never touches the opening
  play-through. Run-pool tracks don't use it — they're sample-accurate Web Audio
  loops with encoder padding trimmed via `loopStart`/`loopEnd`.
- **Run pool: `src/audio/music/`** — every track in that folder is a candidate
  for any run, drawn at random from a shuffled bag. FREE FLOW chains them with a
  4s equal-power crossfade so a long run is scored continuously. **The folder is
  the source of truth**: `npm run build` generates the list, and a track's title
  is its filename (uppercased, `_`/`-` → space). Drop a file in to add it; rename
  it to retitle it. There is no per-track wiring anywhere.
- **NOW PLAYING** — the title flashes for ~4s under the PAUSE key at the start of
  a run and at each free-flow crossfade, then clears. Read-only by design: the
  run is live, so **◀ TRACK ▶** lives in the pause panel where a mistap is free.
- SFX: a hybrid. Reactive sounds stay synthesized in Web Audio (zaps pitch-ride
  the combo, and falling pitch reads as failure — resolve upward on success).
  Big moments are **recorded one-shots**, decoded once when audio wakes and
  wired through the `SFX_SRC` map: hit, ui, miss, miss2, pick, pulse, volley,
  shutdown (node fried), restart (node rebooting), startup (boot sequence),
  fail, win, plus the splash sting. Files live in `src/audio/sfx/`.
- Boot-sequence audio stays dry and military: sub rumble, rangefinder pips,
  dock thunk, relay clicks, radio-key double clicks. **No melodic risers or
  pitch slides** — that is what read as comical in the first cut.

## SFX source libraries (CC0 / royalty-free)
The shipped one-shots were pulled from these. Log the specific pack or URL per
file in CREDITS.md before submission — the license is settled, the origin isn't.
- Sonniss GameAudioGDC bundles — royalty-free, no attribution:
  https://sonniss.com/gameaudiogdc/  (2026: https://gdc.sonniss.com/)
- Kenney CC0 packs (UI clicks, sci-fi, impacts): https://kenney.nl/assets?q=audio
- Freesound, filtered to CC0: https://freesound.org/search/?q=electric+arc&license=Creative+Commons+0
  Productive queries: "electric arc zap", "capacitor discharge", "sub impact",
  "camera flash charge", "relay click".

## Store asset specs (Google Play)
- Icon 512×512 PNG (32-bit, <1MB) · Feature graphic 1024×500 (no alpha,
  avoid duplicating the icon) · 2–8 screenshots per device class,
  16:9–9:16, ≥320px, ≤3840px · optional YouTube preview.
- Screenshot set (staged): max-combo tunnel with pulse wave · route map with
  green flowing lines · boss duel · briefing card · each with a one-line
  Audiowide caption strip.
