# Briefing disc art — production spec

The contract for the images that sit inside the mission discs
([index.html:8821](../src/index.html#L8821)). Read this **before** generating art —
the frame and delivery rules are what make 40 disparate images read as one show.

## The frame

**There is no rectangular frame.** The keyframe fills the disc wall to wall and
is **masked by the disc itself** — the same treatment the case-file carousel
gives a campaign's map image ([index.html:10259](../src/index.html#L10259)). The
plot line rides a caption bar across the art's lower edge, spanning the full disc
width, and the mask gives that bar curved ends. Nothing sits above the art: no
kicker, no LOG title, no border but the disc's own ring.

```
         ╭─────────────────╮
      ╱▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓╲     the art is clipped by the
    ╱▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓╲   disc — no corners, no inset
   │▓▓▓▓▓▓▓▓ your keyframe ▓▓▓▓▓▓▓│
   │▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│
   │████████████████████████████████│ ← caption bar, full disc width,
   │██ One line. One payload. ██████│   overlaying the art's lower edge
   │────────────────────────────────│
   │    40s            18           │ ← the readings: number over name
   │ FIBER LENGTH  DETECTED THREATS │
    ╲      TAP TO CONTINUE        ╱
      ╰─────────────────────────╯
```

Geometry: `R = 0.396 × min(W, H) × 0.9` CSS px. The mask is a circle of `0.965R`,
just inside the `0.97R` border ring, which is re-stroked over the art. The art
box runs from the top of that circle down to `cy + 0.34R`:

| | |
|---|---|
| art box | `1.93R` wide × `1.305R` tall → **≈ 3:2 (1.48:1)** |
| cover-fit | scaled to cover the box, centred, then circle-masked |
| caption bar | overlays the bottom `16–28%` of that box |

### What this means for composition

- **Compose for a circle, not a rectangle.** The box corners are cropped away
  entirely — at the very top of the box the visible width is zero.
- **Keep the subject in the upper two-thirds.** The caption bar covers the bottom
  16% on a tablet and up to 28% on a small phone. Anything important down there
  is behind text.
- **Centre the subject horizontally.** Cover-fit centres the image, and the mask
  narrows fast toward the top and bottom.

## Pixel sizes

The art box on screen, at DPR 2 (the cap):

| Target | Art box | Notes |
|---|---|---|
| Phone landscape (H ≈ 360 CSS) | 247 × 167 CSS → **495 × 334** device | |
| Phone landscape (H ≈ 390 CSS) | 268 × 181 CSS → **537 × 363** device | |
| Tablet landscape (H ≈ 768 CSS) | 528 × 357 CSS → **1056 × 714** device | the worst case |

- **Ship at 1280 × 864** — 3:2, matches the box aspect almost exactly (1.481 vs
  1.479), so cover-fit crops nothing horizontally. Covers the worst case with
  headroom.
- **Master at 2560 × 1728** — keep these; they're the reserve for future screens.
- **WebP, quality ~75.** Budget ≤ 140 KB per disc at this size. 40 discs ≈ 5 MB.

## Delivery

Two paths, mirroring how map images already work
([index.html:11359](../src/index.html#L11359)):

**Bundled campaigns → file reference.** `art: 'investigation-04.webp'` in the
level, file at `src/art/disc/investigation-04.webp`. Lazy-decoded when the disc
opens, so boot never waits on 40 images.

**UGC / exported packages → data URI.** `art: 'data:image/webp;base64,…'`, capped
at 400 KB by the validator, matching the existing rule for `map.image` that
keeps a package self-contained.

Do **not** put 40 base64 keyframes in `campaigns.js` — that's ~5 MB of string
parsed at boot before the first frame draws.

Offline is already handled: the APK bundles `src/` wholesale, and the web service
worker is network-first with cache-on-fetch ([sw.js](../src/sw.js)) — no precache
list to maintain.

## Fallback — ship art one disc at a time

A level with no `art`, or whose image hasn't decoded yet, draws a plate in the
relay's own `tint` with the threat glyph in it. Nothing breaks, nothing pops in
half-drawn, and campaign 1's art can land without touching 2–5.

## What the engine adds — deliver art clean

Don't grade or decorate for the game; the engine does it, and that's what unifies
40 images into one system:

- the level's **`tint`** at low alpha — each relay's art picks up its own colour
- **scanlines**, drifting, matching the holo-portrait treatment
- a **vignette**, and the circular mask into the disc
- the disc's own **dim + zoom-in** on open

So: full colour, full contrast, no scanlines, no frame, no vignette, no logo.

## Style

- Gritty adult animation. Heavy blacks, hard rim light, limited palette per disc.
- **No text in the art.** It competes with the caption, doesn't localize, and
  will be illegible at 247 CSS px wide.
- Composition survives a small screen: one clear subject, readable as a
  silhouette at thumbnail size. If it needs squinting, it fails.
- Faces and key detail centred and high — the mask crops the corners entirely and
  the caption bar covers the lower band.
- Palette anchors already in the game: field cyan/blue, case-file amber
  `rgb(255,210,74)`, and the speaker colours declared per campaign in
  [campaigns.js](../src/campaigns.js).
- **Speaker portraits are a separate job.** The in-run holo-portraits are
  procedural line art and read well at 28px; don't replace them with crops of
  these keyframes. Authored portraits need their own spec (square, ~128px,
  high-contrast line art) — worth doing after the discs land.

## The caption it shares the frame with

The art carries the mood; the caption carries the plot. One sentence per mission.
Because the bar spans the whole disc, the budget is comfortable — measured
against the real Audiowide face, all 40 current lines render at full size with no
shrinking:

| | chars per row | two rows at full size |
|---|---|---|
| Phone (H 360) | 30 @ 12px | ~60 chars |
| Phone (H 390) | 30 @ 13px | ~60 chars |
| Tablet (H 768) | 49 @ 16px | one row for most lines |

**Write to ~55 characters.** Past that the type shrinks to hold two rows, and
past two rows the bar grows and starts eating the readings below it. The
validator rejects over 96.

## Naming

`src/art/disc/<campaignId>-<NN>.webp` — `NN` is the 1-based level number,
zero-padded. e.g. `investigation-04.webp`, `shutdown-07.webp`.

## Authoring it — the Tunnel Designer

`src/editor.html` → **MISSION DISC** section, per level:

| field | what it does |
|---|---|
| **UPLOAD IMAGE** | embeds the file as a data URI — self-contained, capped at 400 KB |
| **art file** | references `src/art/disc/<name>` instead; the bundled path, no size cost |
| readout | source, KB, decoded pixels, aspect vs the disc's 1.48:1, and `NOT FOUND` when a referenced file isn't on disk |
| **plot line** | the sentence, with a live character count against the two-row budget |
| **case note** | the win-screen payoff |
| **notes** | private, travels with the level, never shown in game or read by the engine |
| **PREVIEW DISC** | drops the embedded game into `S.INFO` for this level — the real renderer, and it stays live so edits rewrap as you type |

Clicking the plot line on the timeline's STORY lane jumps to this section.

## Checklist per disc

- [ ] 2560 × 1728 master kept
- [ ] 1280 × 864 WebP q75, ≤ 140 KB, exported to `src/art/disc/`
- [ ] no text, no frame, no scanlines baked in
- [ ] subject reads at 495 px wide
- [ ] survives a circle crop — corners hold nothing, subject centred and high
- [ ] bottom ~25% is expendable, the caption bar sits there
- [ ] nothing critical in the corners
- [ ] `art:` field added to the level in `campaigns.js`
