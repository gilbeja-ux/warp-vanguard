# Contract disc strips — the client

One image per campaign, referenced as `art: 'name.webp'` at the **campaign** level in
`campaigns.js`. It replaces the star-chart crop in the contract carousel's top strip.

| | |
|---|---|
| aspect | **3:1** — the strip is `2r` wide × `0.667r` tall (`sepY = y - r/3`) |
| ship at | 1152 × 384 WebP q75 |
| subject | the **client**, not the route — the people who hired you |
| deliver | full colour; this strip gets no tint wash or scanlines (unlike the mission discs) |

Crop behaviour, measured against the live build with a 1152 × 384 test card:

- the **full width and height are used** — at 3:1 the strip's own ratio matches, so
  `drawImage` takes the whole image with no vertical crop
- the **disc dome eats the top corners**, so keep the subject off them
- the **bottom edge is flush with the separator line** under the strip — nothing is cropped
  there, so a horizon or a floor line at the image's bottom lands exactly on that rule

Deliberately **not** `map.image`. That field also drives the full map screen, where route
pins are drawn over it, and pins on a picture of a freight yard are nonsense — so a package
can carry both, meaning different things. `art` outranks `map.image` on this strip.

`_testcard.png` is a fixture, not content; `_`-prefixed files never ship (scripts/build.js).

## What shipped, and how to re-bake it

One `<campaign-id>.webp` per package, named for the `id` so `art:` reads as its own
label. `_<campaign-id>.png` beside it is the **master** — the delivered render, kept for
re-cropping and `_`-prefixed so 9.7MB of source never reaches a device.

The masters arrived ~1407 × 768 (1.83:1), so each loses a vertical band to reach 3:1.
The offsets below were chosen per image, not centred — they place the subject against the
bottom edge (which is flush with the separator rule) and, for `collector`, lift the frame
clear of a generator watermark sitting low-right in the master.

| campaign | client | subject | crop `y` |
|---|---|---|---|
| `training` | — (the qualification run) | dual emitters lit, warp bore ahead | 145 |
| `cargo-run` | Meridian Haulage | container freighters + escort | 280 |
| `survey` | Deep Range Survey | RV COSMOS VOYAGER, solar arrays | 132 |
| `collector` | Vess Andarr, trader | STARFIRE YACHT AETHELGARD | 138 |
| `patrol` | Flotilla Command | warship flotilla | 192 |
| `delegation` | Federation Delegation | STATE SHIP UNITY | 140 |

```sh
W=$(sips -g pixelWidth _<id>.png | grep -oE '[0-9]+$'); H=$((W/3))
ffmpeg -i _<id>.png -vf "crop=$W:$H:0:<y>,scale=1152:384" /tmp/b.png
cwebp -q 75 /tmp/b.png -o <id>.webp
```

`training.webp` is the odd one out: the training disc is not a package and has no client,
so it carries a pseudo-package (`TRAIN_PKG` in `33-loader.js`) purely to reach this strip.
Its practice reticle only draws when nothing painted, so pulling the file restores it.

Delivered names were prefixed `1..5`, but two of them described a different contract than
their number did — the yacht is the lone trader (campaign 3), the survey ship the deep
range expedition (campaign 2). The **subject** decides which package an image belongs to.
