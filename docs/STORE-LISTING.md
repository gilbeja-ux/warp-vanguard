# Store Listing — Google Play

**Built 2026-08-15** from [STORE-LISTING-BRIEF.md](STORE-LISTING-BRIEF.md).
Assets in [store/](store/). Everything here is paste-ready except the two items
under **Still owed** at the end.

The brief's two open calls were signed off before the build, and one more came up
during it. All three are recorded under **Decisions taken** so a later reader can
see what was chosen rather than re-deriving it.

---

## 1. Copy

### Title

```
Warp Vanguard
```

13 of Play's 30 characters. *(The brief said 28 — arithmetic slip in the brief,
not a constraint. There is room for a subtitle later if one is ever wanted.)*

### Short description

```
Command two emitters down a warp lane. Collapse every interdictor.
```

**66 of 80.** Comprehension first — it says what your thumbs do. The brief's own
line was 83 and would have been rejected; this is that line cut to fit rather
than replaced.

Alternate, if leading with the differentiator is ever preferred (68 chars):

```
Two thumbs. One warp lane. Nothing you can buy will move your score.
```

### Full description

**1,812 of 4,000 characters.** Paste verbatim.

```
You fly point ahead of a freight convoy, down a warp lane somebody has seeded
against it. Two emitters ride the ring around you. Everything that comes up that
lane is yours to collapse before it reaches the cargo.

── HOW IT PLAYS ──

Two thumbs, two dials, one shared ring. The left dial runs the blue emitter, the
right runs the white. Interdictors arrive out of the dark at every bearing and
every depth, and you have exactly as long as the lane is deep to get an emitter
onto each one.

Colour is the rule, not the decoration:

RED — unphased. Either emitter takes it.
BLUE / WHITE — phase-locked. Only the matching emitter lands.
PURPLE — superposed. Both emitters, docked together.
BLACK — a phase inverter. Touch it and that emitter is down for two
seconds. Let it pass.

── THE THIRD VERB ──

Dock both emitters onto the same bearing and their phases superpose. You give up
every other angle for half a second, the charge builds white-hot, and it fires
one bolt straight down the bore. It is the only answer to purple — and it is a
decision you make with the two thumbs you already have, not a new button.

── WHAT'S IN IT ──

· Five contracts, forty relays — a different kind of cargo every contract
· Five machines waiting at the end of a contract — the Leech, the Siphon,
  the Prism, the Mimic, the Blockade — each with its own tell
· FREE FLOW — endless, with the stream stepping up the longer you last
· THE WEEKLY LANE — one seeded lane, identical for every player, open Monday to
  Sunday. When the week closes its board freezes for good, so a name that lands
  on it stays there.

── WHAT THIS GAME WILL NOT DO ──

No ads.
No consumables.
No energy timers.
Nothing you can buy will move your score.

And every level is completable. Difficulty comes from density and speed — never
from a wave you were never meant to survive.

Plays offline. Landscape, two thumbs, short sessions.

Clear the lane.
```

---

## 2. Assets

All in [store/](store/), captured from the running build at 1920×1080 (16:9).

| File | Shot | Caption |
|---|---|---|
| `01-bore.png` | Mid-run bore — both emitters lit, four breaches at four depths, one discharge mid-flight | `TWO THUMBS. ONE LANE.` |
| `02-volley.png` | Emitters docked, charge white-hot, four reds nose-to-tail down the aimed lane | `DOCK BOTH. CLEAR THE LANE.` |
| `03-boss.png` | The Mimic, arrived and settled at its fighting depth, lamp lit, swarm on the lane | `NOTHING GETS THROUGH YOU.` |
| `04-chart.png` | Lane chart, cleared route running green, relay dossier open | `READ THE LANE. THEN FLY IT.` |
| `05-contract.png` | Contract carousel — THE CARGO RUN, stage count, tier | `FIVE CONTRACTS. FORTY RELAYS.` |
| `06-ribbon.png` | Rim wall across the bore with the golden ribbon riding past it | `ROUTE AROUND. RIDE THE GOLD.` |
| `07-board.png` | Relay 01's board — ten real verified runs, with the selected run's detail open | `ONE RELAY. EVERY RUN. RANKED.` |
| `feature-graphic.png` | 1024×500 — bore off-axis, wordmark left | — |

**Carousel order is Teach → Escalate → Promise.** Play shows the first two or
three large and the rest by swipe, so comprehension is front-loaded and the
retention hook lands last.

**Icon** is already live and needs nothing: `src/icons/wv-512.png` is the
512×512 Play asset, cut from the badge by `npm run icons`.

### How they were made

Two passes, both re-runnable:

```
node scripts/serve.js                  # or any server on the REPO ROOT with a /shot endpoint
/scripts/shot-store.html?scene=bore    # capture — one named recipe per frame
/scripts/shot-caption.html?src=bore&text=TWO%20THUMBS.%20ONE%20LANE.&name=01-bore
/scripts/shot-feature.html?src=feature&name=feature-graphic
```

[shot-store.html](../scripts/shot-store.html) carries the scene registry: each
frame is a named recipe that boots the real game, plays it with an autopilot
holding the thumbs, and places the roster the shot needs.

Most frames then **scan for the frame that satisfies a predicate** rather than
counting to a frame number — a live bolt, a charge at 0.455, the carpet actually
inside the bore, a boss past its own arrival ceremony with a swarm near enough to
read. A recipe that cannot find its frame fails loudly rather than banking a near
miss. `board` waits on the network instead of the sim and yields real time between
frames so the fetch can land. Only `chart` and `contract` carry no predicate:
they are static screens with nothing to wait for.

Captions are a **separate pass** on purpose: copy changes more than once, and a
capture costs about two minutes of real play per frame. Rewording is editing one
list, not re-shooting the set.

### What is real, and what is staged

Worth being precise, since the whole listing's argument is that the imagery is
the proof:

- **Real:** every pixel of art, lighting, projection, the lane, the ring, the
  HUD, the chart, the board, the contract discs. All shipped code, untouched.
  `src/index.html` was not modified for marketing — not one pixel, as the brief
  required.
- **Staged:** which enemies are on the lane and where. Bodies are built by the
  game's own `spawnEnemy`, then placed at chosen depths and bearings, because
  "four reds nose-to-tail" is a real formation but waiting on the dice for it is
  not a pipeline. Score, combo and lane progress are set to a run in good shape.
  The chart is shown with a part-finished campaign — a real save state.
- **Cleared for the frame:** popups, the comms ticker and the de-rez blocks.
  These are timed overlays, so freezing catches them mid-animation; the first
  capture came back with a comms line stopped halfway through its own typewriter.
  They are removed, never rewritten.
- **The leaderboard is the live board, fetched.** Ten server-verified runs on
  relay 01, with the real names on them. Nothing is invented — the ban is on
  fabricating social proof, not on showing the real thing. Note the weekly ladder
  is genuinely empty (both rungs, probed live), which is why the shot is a
  campaign board and not the week.
- **The duel is played, not assembled.** The boss scene moves the level clock and
  nothing else; 72-tick spawns the machine itself, the arrival ceremony runs, and
  the autopilot fights it — zapping the swarm to bank charge and spending a full
  orb when the lamp allows. Every field in that frame was computed by the game.
- **Not present anywhere:** reviews, ratings, download counts, press, awards.
  None are implied.

---

## 3. Decisions taken

**Shot 1 teaches rather than impresses.** *(Brief's call, upheld.)* The bore
leads, not the boss. A boss is category-generic — every arcade shooter has one —
while the bore with two lit emitters and depth-staggered threats is the frame no
competitor can copy. Here the more distinctive choice and the more legible one
agree.

**The paywall is not disclosed in the description.** *(Brief's call, overruled on
sign-off.)* Play's own in-app-purchases label carries it, and the description
ends on the fairness list instead. The refusal list stays literally true —
nothing purchasable moves a score — and claims nothing about the game being
free.

**Shot 5 became the contract carousel, and shot 4's caption changed with it.**
*(New, taken during the build.)* The brief asked shot 5 for "client name and tier
in gold", but those live on the *contract*, not on a level's story card — the
per-level disc drew relay 01's one-liner, "The journey begins", which is the
thinnest sentence in the script and reads as placeholder copy. The carousel
carries the client, the stage count and TIER 1 → 3. That moved scope onto shot 5,
so shot 4 — which had the near-duplicate caption `5 CAMPAIGNS. 40 RELAYS.` —
took the job the chart actually does: `READ THE LANE. THEN FLY IT.`

**The boss shot is the Mimic, not the Leech.** All five were captured and
compared. The leech and the blockade burn a hostile red core; the mimic's lamp is
live, so its centre reads as a blue tell rather than one more red glow — and a
lit lamp is what the brief described for this shot. The other four remain one
parameter away: `?scene=boss&kind=leech`.

**Caption furniture sits over the ring's outer edge, not clear of it.** The brief
asked for captions that never overlap the ring. In a 16:9 frame of this game
there is no region both prominent and empty — the ring fills the middle and the
dial pads hold both bottom corners. What is honoured is the intent: a scrim
carries the lower band into black so the plate never fights the art, and the
ring's lit centre and both emitters stay clear.

---

## 4. The set was shot three times

Two silent-fallback bugs in the harness produced two complete sets of
finished-looking, wrong screenshots. Both are worth reading before anyone builds
another capture tool against this game.

### The station hardware never baked

Gil spotted this one from a single frame: the boss was a flat grey disc where the
game draws an orange-rimmed, silver-plated machine.

`81-station3d.js` bakes its software-3D sprites progressively, and `99-boot.js`
pumps that queue **only while `state` is `MENU` or `GUIDE`** — a deliberate call,
so the build happens while the player picks a contract and never during a run. A
harness that boots straight into `S.PLAY` therefore never pumps, and every
consumer quietly takes its fallback: `drawLeechMachine`'s is a "procedural
stand-in" of dark steel rings, which is exactly what shipped. The chart's endpoint
art and the destination at the end of the bore were on stand-ins too.

The harness now runs `s3Pump` to completion before staging anything, and refuses
to shoot if the bake is unavailable. The sprites are identical to the ones the
menu would have produced — they are just not spread across a minute of someone
choosing a contract.

### The whole set was in the wrong typeface

The first full set had to be scrapped for this alone.

`index.html` carries the `@font-face` for Audiowide in its `<style>` block. The
harness injected only the game's `<script>` tags — the manifest's file list — so
the rule was never declared, and every `fillText` in the game silently fell back
to system-ui: score, combo, menu titles, the chart, the board, the contract cards.
Nothing errored. The frames looked finished, and read as a different, older build.

The harness now takes `index.html` apart and runs all of it — style block, inline
scripts, and sources in document order — and **refuses to shoot** unless
`document.fonts.check('700 46px Audiowide')` passes. `document.fonts.ready` alone
was what hid this: it resolves happily when nothing ever asked for the font.

**The pattern in both:** a fallback that exists for a good reason (no font yet, no
sprite yet) is invisible to a screenshotter, because the frame still renders and
still looks like a game. Both are now hard guards that refuse to capture rather
than degrade — which is the only defence, since neither ever raised an error.

Two other things were wrong in that first set and are fixed:

- **The duel was assembled rather than played.** `spawnBoss()` was called by hand
  and the fight's state written straight in — `introT` past the ceremony, `hp` at
  4, the lamp pinned, the swarm placed body by body. Every field was real; the
  combination was one the fight never produces, because the phase machine
  (`mode`, `beams`, `waveT`) had never run. The scene now moves only the level
  clock and lets the game do the rest.
- **The leaderboard was forged empty.** It was handed `rows: []` on the reasoning
  that a harness has no network — but headless Chrome has one, and relay 01's
  board has ten verified runs on it.

## 5. Reviewed

The finished set went through an independent review against the brief, PRODUCT.md,
DESIGN.md and Play's specs. What it caught, and what was done:

**Fixed.** The caption plate on the board frame was laid over the relay rail and a
list row showed *through* it — translucency reads as depth over the lane's art and
as a collision over another panel, so that one caption moved bottom-right, into
the frame's empty half. The contract frame was shot on an empty save while the
chart beside it showed five relays flown, so the two adjacent frames disagreed
about the same player; both now use the same save. The feature graphic's one
hostile was clipped in half by the banner crop, and a ghost dial-pad ring sat
under the wordmark; the bearing moved and the scrim's falloff was slowed. In the
copy: *interdictor* was doing double duty for both the rank-and-file and the
bosses, which collapsed the scope claim, so the five are now named; a black
inverter takes an emitter down for **two seconds**, not permanently, and the copy
said otherwise; cargo varies per contract, not per relay; the weekly board's
on-screen name is WEEKLY LANES, not "the ranked week"; and the stated character
count was 35 out.

**And the swipe now goes somewhere.** The first cut gave the *teaching* frame the
highest score in the set (43,850), so a player swiping the carousel watched a run
get steadily worse — the Teach → Escalate → Promise thesis running backwards. The
numbers now ladder 14,080 → 26,400 → 41,750 → 61,900, with the combo multiplier
reaching its x10 cap only at the far end.

### Known, and not fixed

Recorded rather than quietly left. None of these block upload:

- **`04-chart.png` is the weakest frame.** The chart's map circle is mostly empty
  space at this campaign — the survey lattice and picket stations DESIGN.md
  describes sit in bands this lens is not over. The dossier panel carries the
  shot. It is worth a second look, and it is a cut candidate if the set is ever
  trimmed to six.
- **Every frame is a flat capture with a caption plate.** No push-in, no diptych,
  no annotated colour rule. The set is consistent and honest; it is not
  inventive. The most valuable single addition would be a crop or push-in on
  shot 1 — at carousel size the two dial pads read as grey donuts, and they are
  what the caption is about.
- **`PRODUCT.md` is stale in two places that touch this listing.** It lists
  leaderboards as "Open / undecided — player identity, backend, and anti-cheat
  are unbuilt", but `supabase/functions/submit-run` ships and `93-board.js`
  implements the weekly freeze, so the ranked-week claim is TRUE and its stated
  authority contradicts it. It also still says "five wardens (core, triad,
  spinner, triad, core)" against the five distinct kinds in `52-bosses.js`.
  Reconcile before submission — the copy needs no change, the record does.
- **The store icon's alpha channel is unverified against Play.** `wv-512.png` is
  the badge at 94% on a transparent surround. If Play's icon slot rejects alpha,
  neither shipped file is right — the maskable pair is cut at 62% for launcher
  crops and is too small for the tile — and a third variant is needed: the badge
  at ~94% on opaque `#03060e`.

## 6. Still owed

Two things gate submission, neither of them design work:

1. **Name clearance is unrun.** The USPTO TESS and Play/App Store searches
   BRAND.md calls for have not happened. Everything here assumes **WARP
   VANGUARD** clears — check it and "Vanguard" alone, separately and as the full
   lockup. This gates the copy, not the imagery: every screenshot survives a
   rename, and only the feature graphic's wordmark would need a rebuild.
2. **Play's spec numbers should be re-verified in Play Console** before upload.
   The ones used here come from BRAND.md — icon 512×512, feature graphic exactly
   1024×500, 2–8 screenshots per device class between 16:9 and 9:16 — and store
   requirements drift.

Deliberately out of scope, per the brief: **price** (unset, ~$2.99–4.99, and no
number appears in any asset), **no promo video**, **phone only** — no tablet or
large-screen set — and **no iOS copy**. The assets are sized so an iOS set is a
mechanical re-export, but no subtitle or promotional text is written, because the
`ios/` platform does not exist yet.
