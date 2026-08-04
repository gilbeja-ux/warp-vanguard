# Briefing disc keyframes

One image per mission, referenced from `campaigns.js` as `art: 'name.webp'` on the level.
Read **[docs/DISC-ART-SPEC.md](../../../docs/DISC-ART-SPEC.md)** before generating any —
the frame, the delivery rules and the composition constraints are what make 40 disparate
images read as one show.

The short version, measured rather than assumed (see the spec for the workings):

| | |
|---|---|
| ship at | **1280 × 864** WebP q75, ≤140 KB — the tablet art box is 1275 × 862 device px |
| aspect | 3:2 (1.481 vs the box's 1.479, so cover-fit crops nothing horizontally) |
| safe zone | subject centred, upper two-thirds. The disc mask eats the corners entirely and the caption bar covers the bottom 16–28% |
| deliver | full colour, full contrast, **no** scanlines / vignette / frame / text — the engine adds its own tint, scanlines, vignette and mask |

`_testcard.png` is a fixture, not content: a 1280 × 864 grid with an 8px red border, a
bottom-28% band and a centred subject disc, so the mask crop, caption overlap and tint
wash can be re-verified against a known image. `_`-prefixed files never ship (scripts/build.js).

A level with no `art` is not broken — it draws a glam shot of that lane's actual
destination world (`drawDiscWorld`), so art can land one disc at a time.
