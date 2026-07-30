# Brand & Design Tokens — WARP OVERWATCH: LANE VANGUARDS

## Name
- Full: **WARP OVERWATCH: LANE VANGUARDS**  ·  Short: **WARP OVERWATCH**
- Unit designation, in-world: **WOLV** — *Warp Overwatch: Lane Vanguards*, spoken
  as "wolves". It is the squadron's own callsign root, not a marketing mark:
  comms address the player as **wolf** (`"wolf two, lane is yours."`).
- Tagline: *Clear the lane.*
- Store subtitle: *Run point. Kill the interdiction. Get the convoy through.*
- Before store submission: run a USPTO TESS + Play/App Store search on the final
  name. This name was chosen partly *because* "Data Defenders" already collides
  with two existing Play Store apps — do not let the replacement repeat it.
  Check "Warp Overwatch" and "Vanguard" separately as well as the full lockup.
  **OVERWATCH IS A HEAVILY ENFORCED MARK** (Blizzard, registered in the game
  software class). "Warp Overwatch" is a distinct mark and the in-fiction use is
  a sector role, not a title — but this is the same clearance risk the rename was
  meant to escape. Clear it before any store listing or paid marketing.

## The wolves
The pack is deliberate and the inversion is deliberate. Historically a wolfpack
was the formation that *hunted* convoys. This squadron took the name from the
raiders it replaced:

> *They called the raiders wolves once. Now we run ahead of the convoy, and
> we are what the raiders have to get past.*

Use it for texture, never for exposition. One line of bible, then let the
callsigns carry it.

## Mark
A **shield badge**: gold rim over a chamfered near-black body, with a receding
warp bore — concentric hoops and radial spokes converging on a bright vanishing
point — filling the lower half. **The bore is the mark.** It always was; it is
now literal instead of metaphorical, and needs no explaining.

- **Full lockup** — `src/logo.png`. The badge carrying its own lettering:
  WARP large in cyan-chrome, OVERWATCH beneath it, *Lane Vanguards* in gold
  between two gold rules, over the bore. Menu and marketing surfaces.
  Loaded at runtime by `brandLogo()`; the code keeps an Audiowide drawn stack as
  a fallback if the file is missing — that fallback already letters
  WARP / OVER / WATCH with a LANE VANGUARDS subtitle, and VANGUARDS in the hub.
- **App icon** — `src/icons/*.png` (`any`) and `df-mask-*.png` (`maskable`).
  Same shield with the lettering removed and a **wolf mark** over the bore,
  cyan chevrons top and bottom. Icon = badge only, no wordmark.

**OWED ART.** `src/logo.png` and the icon set still carry DATA DEFENDERS
lettering and the interlocked gold **DD** monogram. Both are retired. The
monogram is replaced by the wolf mark rather than a WOLV monogram, because four
letters do not survive a 48px launcher tile and a wolf silhouette does.

The old EMP-emitter mark (coil body, twin prongs, live arc) stays retired.

## Color tokens
Values unchanged from DARK FIBER. What changed is what they *mean* — the color
rule is now emitter phase, not encryption polarity.

| Token | Value | Meaning |
|---|---|---|
| `--node-blue` | `#50aaff` (80,170,255) | emitter ⊕ — must match the blue phase-lock |
| `--chrome-cyan` | `#6FE3FF` (111,227,255) | UI/console chrome: panels, brackets, headers |
| `--node-white` | `#FFFFFF` / `#EBF5FF` | emitter ⊖, CID |
| `--threat-red` | `#FF3C5A` (255,60,90) | unphased interdictors, alarms |
| `--armor-purple` | `#D465FF` (212,101,255) | superposed threats, heavies, wardens, CORE |
| `--gold` | `#FFD24A` (255,210,74) | pickups, frontier, rewards, attention |
| `--secured-green` | `#7EE262` (126,226,98) | cleared lanes, wins, TRACE |
| `--infra-teal` | `rgba(80,230,200)` | the warp net, lane carrier, infrastructure |
| `--void` | `#02060E` → `#0A1A34` | space, chart fills |
| `--drift-violet` | `rgba(178,132,255)` | the drift: dust, debris, hulks — unnavigable |

**Rule: color IS gameplay language.** Your two emitters run opposed phase, ⊕ and
⊖. Every interdictor is cast with a phase lock, and the lock decides which
emitter can collapse it:

| Color | Lock | Answer |
|---|---|---|
| red | unphased | either emitter |
| blue | locked ⊕ | blue emitter only |
| white | locked ⊖ | white emitter only |
| purple | superposed across both | **both emitters, docked** |
| black | phase inverter | never touch — it inverts the emitter that strikes it |

**Polarity never flips.** ⊕ is always blue; the player is always the escort. No
level inverts the mapping. Marketing assets use only these tokens.

Consequence worth protecting: **UNITE-VOLLEY now has a reason in the fiction.**
Docking superposes the phases, which is *why* a docked pair answers purple. The
third verb is a rule of the world, not a control trick.

## Typography
- Display/UI: **Audiowide** (OFL, bundled). Letter-spacing 1–3px for headers.
- Data garnish: monospace (telemetry, hex bearings) — never for reading copy.

## Chrome
- `techRect` corner-cut panels, 1.5px strokes, translucent navy fills.
- Track-and-rails gauge grammar for all instruments (pads, coverage, arcs).
- Overlay text always drawn as the frame's last pass.

## The lane chart
The route map is one isometric plane seen from above: a survey lattice, lanes in
three traffic tiers, junction diamonds on the trunk crossings, and the **patrol
cordons** as dashed ellipses studded with picket stations. Cover is total at the
core systems and gone past the last cordon — printed on each band, and the
chart's own explanation for why traffic thickens as you work outward.

The **drift** cuts across the southern volume: a dust band and a debris stream,
unnavigable, with hulks adrift in it and lit **spans** where the trunk lanes
cross. Nothing is ever sited in it.

Band names, innermost out: INNER CORDON · PATROL SHELL · OUTER PICKET ·
THE FRINGE · **DARK TRANSIT** (no cover).

## Audio direction
Unchanged by the theme shift — every file and every mapping carries over.

- Music: synthwave/cyber, author-produced. Normalize tracks ~-14 LUFS.
- **Menu track: SHIPPED** — *Midnight Terminal Wait*
  (`src/audio/Midnight_Terminal_Wait.mp3`), wired at `MUSIC_DATA.menu`.
- The **seam duck is retained deliberately**: `updateMusic` eases the menu
  track's gain to 0.12 across the 1.2s either side of the loop boundary and
  back, so the loop crossfades through itself instead of hard-cutting. It never
  touches the opening play-through. Run-pool tracks don't use it — they're
  sample-accurate Web Audio loops with encoder padding trimmed via
  `loopStart`/`loopEnd`.
- **Run pool: `src/audio/music/`** — every track in that folder is a candidate
  for any run, drawn from a shuffled bag. FREE FLOW chains them with a 4s
  equal-power crossfade. **The folder is the source of truth**: `npm run build`
  generates the list, and a track's title is its filename (uppercased, `_`/`-`
  → space). Drop a file in to add it; rename it to retitle it.
- **NOW PLAYING** — the title flashes for ~4s under the PAUSE key at the start of
  a run and at each free-flow crossfade, then clears. Read-only by design; the
  **◀ TRACK ▶** control lives in the pause panel where a mistap is free.
- SFX: a hybrid. Reactive sounds stay synthesized in Web Audio (zaps pitch-ride
  the combo; falling pitch reads as failure — resolve upward on success). Big
  moments are **recorded one-shots**, decoded once when audio wakes and wired
  through the `SFX_SRC` map: hit, ui, miss, miss2, pick, pulse, volley, shutdown
  (emitter inverted), restart (emitter rephasing), startup (boot sequence),
  fail, win, plus the splash sting. Files live in `src/audio/sfx/`.
- Boot-sequence audio stays dry and military: sub rumble, rangefinder pips, dock
  thunk, relay clicks, radio-key double clicks. **No melodic risers or pitch
  slides** — that is what read as comical in the first cut.

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
- Icon 512×512 PNG (32-bit, <1MB) · Feature graphic 1024×500 (no alpha, avoid
  duplicating the icon) · 2–8 screenshots per device class, 16:9–9:16, ≥320px,
  ≤3840px · optional YouTube preview.
- Screenshot set (staged): max-combo bore with pulse wave · lane chart with green
  flowing routes · warden duel · briefing disc · each with a one-line Audiowide
  caption strip.
