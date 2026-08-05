# Store Listing Brief — Google Play

**Status: shaped, awaiting sign-off on two open calls** (see the end of this file).
Produced 2026-07-27 via `/impeccable shape store-listing`. Nothing has been built.

**To resume and build:**

```
/impeccable build the store listing from docs/STORE-LISTING-BRIEF.md
```

That skips discovery — the decisions below are already made. Authority for
product truth is [PRODUCT.md](../PRODUCT.md); authority for materials and color
is [DESIGN.md](../DESIGN.md); Play asset specs and brand tokens are in
[BRAND.md](../BRAND.md).

**Mode: Persuade.** Play now, App Store-ready. Title assumed to be
`Warp Vanguard` (28 of Play's 30 characters).

---

## 1. Job and audience

A skill-hungry arcade player scrolling Play, deciding in roughly four seconds
from an icon, a title, and one screenshot. They are not looking for a story —
they are looking for something with a skill ceiling. The listing's job is to
make an unfamiliar control scheme legible fast enough that it reads as *depth*
rather than *awkwardness*.

That is the whole problem. Two-thumb radial dials are the hardest thing about
this product to sell from a still image, and they are also the reason someone
stays. A listing that leads with spectacle sells a game the player does not get
when they open it.

## 2. Outcome and proof

**Primary action:** install the free demo (relays 1–3). The one-time unlock is a
second, later decision and the listing should not fight for it.

**What is true here that a neighbouring product could not claim:**

- Skill-fairness is absolute — nothing purchasable moves a score. No
  consumables, no ads, no pay-per-campaign.
- The ranked week is the same seeded lane for every player, worldwide, all week.
- Every level is 100% completable. Difficulty rises; impossibility never.
- Real scope: 5 campaigns, 40 relays, 5 distinct bosses (verified against
  `src/campaigns.js`).

**Proof is the imagery itself** — every frame captured from the running build.
There are no players, reviews, download counts, press, or awards. None may be
implied.

## 3. Selected direction

**Structural thesis: Teach → Escalate → Promise.** Play shows the first two or
three shots large and the rest by swipe, so comprehension is front-loaded and
the retention hook lands last.

**Visual authority:** DESIGN.md governs materials and color absolutely — one key
light, no outlines, draw light not paint. Marketing gets layout freedom only for
the caption furniture, which uses the cut-corner plate language.

### The carousel

All landscape 16:9, matching the game's locked orientation.

| # | Shot | Caption |
|---|---|---|
| 1 | Mid-run bore. Both arcs lit, four breaches at staggered depth, one mid-discharge. High combo. | `TWO THUMBS. ONE LINE.` |
| 2 | Nodes docked, white-hot volley core filling the arc window, four reds nose-to-tail in one lane. | `DOCK BOTH. CLEAR THE LANE.` |
| 3 | The warden core — eye lit, plates torn, darts inbound. | `NOTHING GETS THROUGH YOU.` |
| 4 | Lane chart: patrol cordons, green cleared routes flowing, dossier open. | `5 CAMPAIGNS. 40 RELAYS.` |
| 5 | Briefing disc art plate, client name and tier in gold. | `FIVE CONTRACTS. FORTY RELAYS.` |
| 6 | Rim wall crossing the bore with the golden ribbon riding it. | `ROUTE AROUND. RIDE THE GOLD.` |
| 7 | Weekly leaderboard. | `SAME LANE. EVERY PLAYER. ALL WEEK.` |

**Focal moment: shot 1.** It appears beside the icon in search results and
carries more weight than the other six combined. It must show both nodes, the
ring, and depth-staggered threats in one read — the entire game in a frame.

### Feature graphic (1024×500)

The bore off-axis: vanishing point on the right third, wordmark locked left in
clear space, one hostile mid-flight catching the key light. Must survive Play's
center crop and play-button overlay, so nothing load-bearing sits center. No
text beyond the wordmark, and it must not restate the icon.

### Caption furniture

Bottom-anchored cut-corner plate, Audiowide at 3px tracking, Readout Ice on
Panel Glass, never overlapping the ring. Cap at ~32 characters so it survives
thumbnailing.

## 4. Copy

- **Title:** `Warp Vanguard`
- **Short description (80 max):**
  `Command two emitters around a warp lane. Collapse every interdictor. Clear the path.` (83)
  Comprehension first. Alternate, if leading with the differentiator is
  preferred: `Two thumbs. One warp lane. Nothing you can buy will move your score.` (68)
- **Full description (4000 max):** six blocks — the hook; the loop in three
  sentences; the third verb (unite-volley); scope (campaigns, endless, the ranked week);
  the fairness promise stated plainly as a *refusal* list; then an honest
  paywall disclosure naming the relay-04 seam.

## 5. Scope and boundaries

**In scope:** 7 phone screenshots, feature graphic, store copy, and a reusable
capture harness.

**Untouched:** the game. Not one pixel of `src/index.html` changes for
marketing. If a shot needs a state the game cannot reach, the shot changes —
never the game.

**Anti-goals:**

- No fabricated reviews, ratings, awards, or download counts.
- No device frames with hands.
- No mockups or composited fake UI.
- No claims about iOS availability.
- No feature claims for deferred modes (seed sharing, own-music, Data Driver).
- No "#1" or superlatives.

## 6. Production approach

Generalize `scripts/shot-splash.html` into a scene-driven harness. It already
solves the hard parts: lifts the game scripts out of `index.html`, nulls
`AudioContext`, owns the rAF clock, and flips `document.title` to `READY` so a
screenshotter knows the frame is staged. It needs a scene registry — each shot a
deterministic recipe (force state, seed the roster, fast-forward *N* frames,
freeze).

**Capture raw frames and composite captions in a second pass.** Caption copy
will change more than once, and separating the passes makes every revision free
rather than a re-capture.

This harness is independently useful (press kits, future store refreshes) and
can be built on its own, ahead of any asset work.

## 7. Constraints and open decisions — do not invent

- **Name clearance is unrun.** The USPTO TESS and Play/App Store searches
  BRAND.md calls for have not happened. Everything here assumes the full string
  clears. This gates the copy, not the imagery.
- **Price is unset** (~$2.99–4.99). No number appears in any asset.
- **App Store-ready, not App Store-authored.** Assets get sized so the iOS set
  is a mechanical re-export, but no iOS subtitle or promotional text is written —
  the `ios/` platform does not exist yet.
- **No promo video** in this scope.
- **Tablet / large-screen set** not included; phone only.
- **Play's current spec numbers** come from BRAND.md and should be re-verified
  against Play Console before submission — store requirements drift.

---

## Open calls awaiting sign-off

Two judgment calls were made in shaping this. Both follow from skill-fairness
being the actual differentiator, and either could reasonably be overruled:

1. **Shot 1 teaches rather than impresses.** Leading with the bore instead of
   the boss costs immediate spectacle in exchange for comprehension. Overrule by
   promoting shot 3 to first.
2. **The paywall is disclosed in the description** rather than left to Play's
   IAP label. Overrule by cutting the closing block of the full description.
