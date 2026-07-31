# Refactor plan — codebase audit, 2026-07-28

Status: **plan only, nothing executed.** Written after a read-through of `src/`,
`scripts/`, and `supabase/`. Gil's steer: no specific day-to-day pain, no felt
performance problem — so this is aimed at *structural readiness for future
development* and *preventative* performance work, not at relieving a current
ache. Steps are ranked accordingly, and the low-value ones say so.

---

## 1. What the audit actually found

The headline number is misleading. `src/index.html` is **12,886 lines / 640KB in
one file**, which reads like a warning sign. It isn't one. The file is:

- **properly dispatchered at runtime** — fixed-timestep sim cleanly separated from
  render (`frame()`, index.html:12359), with an accumulator, a sub-step cap, and
  an explicit comment explaining why determinism depends on it;
- **already defended against slow devices** — `perfWatch()` (index.html:11776)
  sheds visual load permanently if the rolling 2s average drops under ~42fps;
- **navigable** — 50+ section banner comments partition the file into named
  regions;
- **genuinely tested** — **396 assertions, all passing, in 5.4 seconds.**

That test suite is the most important fact in this document. It is what makes
any of the work below safe, and it is why I'd rather restructure than rewrite.

There is no rot to clean up here. The question is not "how do we fix this" but
"what does this need to keep scaling."

### Region breakdown of the game script

| Region | Lines | Share |
|---|---|---|
| Sim + logic (state, enemies, beats, bosses, input, update) | ~5,300 | 41% |
| Game render (tunnel, enemy bodies, HUD kit) | ~3,000 | 24% |
| Meta-screen UI (briefing, field guide, leaderboard, route map) | ~3,400 | 26% |
| Loop, transitions, boot splash | ~1,100 | 9% |

The meta-screen quarter is the part that will keep growing as the game ships
more content, and it's the part least entangled with the sim.

---

## 2. The one hard constraint

Everything in this plan is shaped by a single line:

```js
// scripts/build-verifier.js:19
const game = html.match(/<script>([\s\S]*?)<\/script>/)[1];
```

The server-side anti-cheat verifier **inlines the entire game script** into a
697KB Deno module (`supabase/functions/submit-run/_sim.mjs`) and drives it
headlessly to recompute a submitted run's score. Supabase's edge runtime blocks
`eval`, so the game must be inlined as literal module source.

> **Updated 2026-07-31.** Point 1 below was wrong, and the split disproved it.
> The verifier needs the game as **one string**, which is not the same as one
> `<script>` — it now gets that string from `scripts/lib/game-source.js`, which
> concatenates `src/game/*.js` in manifest order. Points 2 and 3 still hold.
> `build-verifier.js` no longer reads `index.html` at all.

Consequences, which are non-negotiable unless we rewrite the anti-cheat build:

1. ~~The game must remain **one inline `<script>`** in `index.html`.~~ It must
   remain **reconstructible as one ordered string**, with no imports.
2. It must keep working with **~730 shared top-level globals** and no imports.
3. It must stay **strict-mode safe** (it is — every file declares `'use strict'`).

This is why the split is *ordered classic script tags*, not ES modules. We change
how the code is **authored and loaded**, and the string the verifier sees is
byte-identical to what it saw before.

---

## 3. Principles

- **The emitted `<script>` must be byte-identical** to today's, at every step of
  the split. This is not a hope — it's a mechanical check (§4, Step 2).
- **`npm test` green after every step.** 396 assertions, 5.4s. No excuses.
- **No visual regressions.** Where a step touches drawing, it needs eyes on the
  real game, not just tests.
- **Stop-anywhere.** Each step lands independently and leaves a shippable game.

---

## 4. The plan

### ~~Step 0 — Repo hygiene~~ — **DONE, 2026-07-28**

- **39MB of stale `.claude/worktrees/`** — three abandoned agent worktrees with
  full copies of `index.html`, `test.js`, `campaigns.js`. Git-ignored, so
  invisible to `git status`, but they polluted every `grep`, `find`, and editor
  search. All three branches (`phase1-beats-bands`, `phase2-editor`,
  `phase3-bosses`) were confirmed fully merged with 0 commits ahead and clean
  working trees before removal via `git worktree remove`. Branches kept.
- 10 stray `.DS_Store` files deleted.
- **Still open:** `src/logo.png` is 504KB and `src/Logo - Small.png` is 228KB.
  Both are referenced (`index.html`, `scripts/shot-splash.html`), so neither is
  dead — but 732KB of PNG for a boot splash is worth a WebP pass (§4).

---

### Step 1 — Extract a tuning surface *(highest value for "easier to adjust")*

The codebase **already established the right pattern** and then only applied it
about a third of the time. These grouped tuning blocks exist and are good:

```
ARCFX  (1631)   ENEMYFX (1652)   FRAGFX (1663)
DECOMP (3081)   POPFX  (8978)    INFO_PAL (8404)
```

Alongside them, 69 top-level `SCREAMING_CASE` constants carry real tuning
meaning — `BOOT_LOCK`, `INTRO_GATE`, `COMBO_CAP`, `SPAWN_Z`, `WALL_TOL`,
`AIM_HOLD`, `BOSS_CER`, `RESET_HOLD`, `HOLD_BOSS`, `MUSIC_XFADE`. But most
numbers are still inline in the draw and sim code.

**Do:** promote the existing pattern to a convention rather than inventing a new
one. One `TUNING` section near the top of the sim file, grouping the scattered
top-level constants by subsystem, keeping the `*FX` object style already in use.
Move inline magic numbers in only where a name genuinely clarifies — a
mechanical sweep that renames every literal would make the code *harder* to
read, not easier.

**Why this is first:** it's the step that most directly serves "easier to
control and adjust," it needs no build changes, and it's independently useful
whether or not Step 2 ever happens.

**Verify:** `npm test`; plus a manual diff review that no value changed.

---

### ~~Step 2 — Split authoring into `src/game/*.js`~~ — **DONE, 2026-07-31**

Shipped, but **not the way this section proposed.** The plan below assumed the
game had to stay one inline `<script>` emitted by a build step. It doesn't.

**What actually shipped:** `index.html` is an 83-line shell that loads 31 ordered
`<script src="game/*.js">` tags. There is no build step and no generated
artifact — the files on disk are the files the browser runs. `scripts/lib/game-source.js`
concatenates them from `src/game/manifest.json` for the three consumers that need
one string (`test.js`, `build-verifier.js`, `verify-run.js`).

**Why the constraint below turned out not to bind:** the risk of separate tags is
that concatenation hoists function declarations across the whole script while
separate tags do not. Measured before committing: **26 top-level executable
statements, zero eager forward references.** And `campaigns.js` already loaded as
its own tag, including over `file://`.

**How it was proven, both mechanically:**

1. **Byte-identity** — the concatenation of `src/game/*.js` is byte-for-byte
   equal to the `<script>` body of the last pre-split commit (857,375 bytes), so
   the verifier bundle rebuilt *byte-identical* too. Zero behaviour change, not
   as a hope but as a diff.
2. **Load order** — all 31 files were run as separate scripts in a shared VM
   context (which reproduces classic-script semantics: function declarations on
   the shared global, top-level `let`/`const` in the shared global lexical
   scope). All 31 load clean.

Three permanent assertions in `test.js` now stop the pieces drifting: tag order
in `index.html` must equal manifest order, every file in `src/game/` must be in
the manifest, and every file after the first must declare its own `'use strict'`
(strict mode is per-script for classic tags).

Each file opens with a `'use strict';` prologue that `game-source.js` strips back
off when concatenating — that stripping is what keeps the byte-identity check
honest.

<details>
<summary>The original build-time-concatenation proposal (superseded)</summary>


**This is the structural centerpiece.** Author the game as ordered files;
`build.js` concatenates them into the single `<script>` in `index.html`.

I checked whether this is actually safe, and it is, for a specific reason:
**there are only 15 top-level executable statements in the entire 12.8k-line
script.** Everything else is function declarations (which hoist across the whole
concatenated script) and `const`/`let` declarations (which just need source
order preserved). The 15 are:

```
window.addEventListener('resize', …)          line   40
installCampaign(…)                            line 1447   ← needs CAMPAIGNS + progress
canvas.addEventListener × 4                   lines 3164–3329
window/document listeners × 4                 lines 3337–3364
registerStoryCards()                          line 4059
initStreaks()                                 line 5529
resize(); requestAnimationFrame(frame)        lines 12819–12820
setTimeout(…)                                 line 12830
```

All sit at natural section boundaries. **If file order matches today's line
order, behaviour is bit-for-bit unchanged** — and that's directly checkable:

> **The guard test:** after the split, `build.js` regenerates `index.html`, and
> the emitted `<script>` body must be **byte-identical** to the pre-split one.
> Diff clean = provably zero behaviour change. Add this as a test so the split
> can never silently drift.

Proposed file layout, cut on existing section banners:

```
src/game/
  00-core.js        40–143     header, canvas, DOM overlay, utils
  10-audio.js      144–793     audio, soundtrack, crossfade, sfx
  20-world.js      794–1063    background, wall code
  30-data.js      1064–1486    campaigns, identity, leaderboard, persistence
  40-state.js     1487–1785    game state, run trace, tuning, geometry, sprites
  50-sim.js       1786–3133    enemies, spawn, beats, linter, bosses, particles
  60-input.js     3134–4039    input, hit areas, replay transport, gamepad
  70-update.js    4040–5340    qualification, investigation, update(dt)
  80-render.js    5341–8379    tunnel, enemy bodies, HUD kit
  90-screens.js   8380–11774   briefing, field guide, leaderboard, route map
  99-loop.js     11775–12871   perf watchdog, main loop, transitions, boot
```

`build-verifier.js` keeps reading `index.html` and needs **no change at all** —
it sees the same single `<script>` it always did.

**Cost to be honest about:** the emitted `index.html` becomes a generated
artifact. Editing it directly would be a footgun, so it needs a header banner
saying so, and the build must run before `dev`/`sync`/`apk` (it already does for
`dev` and `sync`; `apk` should be checked).

**Verify:** byte-identity diff + `npm test` + one real playthrough.

</details>

---

### ~~Step 3 — Make the labs share the game's real code~~ — **RESOLVED by deletion, 2026-07-28**

The five lab harnesses (`arclab`, `ringlab`, `enemylab`, `zaplab`, `fxlab`) plus
`soundboard.html` and `labbg.js` tuned visuals in isolation by **copy-pasting the
game's draw functions**, and they had already drifted — `drawEnemy` was 83 lines
in the game and 45 in `enemylab`, with `enemyPal`, `wallPatch`, `ring`, and
`resize` duplicated the same way. The labs were quietly lying about what the game
looked like.

Rather than re-syncing them, **all seven files were deleted** (3,919 lines). Their
looks were already locked into the game's `*FX` constant blocks, which are now
the single source of truth. Future labs get built fresh against the real painters
— which Step 2's `80-render.js` makes trivial, since a new lab can just
`<script src="game/80-render.js">` instead of copying anything.

Recover any of them from history: `git log --diff-filter=D -- src/enemylab.html`.

---

### Step 4 — Preventative performance *(deliberately last — nothing is slow today)*

Gil reports no felt problem, and `perfWatch` already backstops weak devices. So
this is about preserving headroom, not reclaiming it. Findings, ranked by
value-per-risk:

**Worth doing:**
- **Verifier bundle weight.** `_sim.mjs` is 697KB and includes ~6,400 lines of
  render code that executes against a stubbed `ctx` Proxy on every score
  submission. Trimming render from the bundle would cut it roughly in half and
  speed up cold starts of the edge function.
  ⚠️ **Risk, stated plainly:** this only works if no draw function mutates sim
  state. I have *not* verified that, and it is exactly the kind of coupling that
  hides in a 12.8k-line file. This needs a corpus of real runs verified
  before-and-after with identical results before it ships. If that proves out,
  Step 2's file split makes the exclusion a one-line build change.
- **Gradient caching.** 64 `createLinearGradient`/`createRadialGradient` call
  sites. Any that sit in per-frame paths and don't depend on animated values can
  be built once. Needs profiling first to find which — guessing wastes effort.

**Lower value:**
- 29 `shadowBlur` uses (genuinely expensive on mobile GPUs, but they're part of
  the look — only touch ones in hot loops, and only with `lowFX` in mind).
- 134 `ctx.font =` assignments (string churn; cheap to hoist, small payoff).
- 732KB of splash PNGs → WebP.

**Verify:** profile *before* changing anything, so the wins are measured rather
than assumed. Visual A/B on the real device for anything touching draw.

---

## 5. Explicitly not doing

- **True ES modules.** Would require rewriting `build-verifier.js` around a
  bundler and re-proving replay determinism. All of the ergonomic benefit, none
  of the risk, is available via Step 2.
- **Splitting up the 592 globals into namespaces.** Tempting, but the verifier
  drives the sim through `globalThis.__vg` by referencing ~25 of them by bare
  name, and `scripts/test.js` does the same through `__g`. Namespacing means
  touching both harnesses and every call site, for readability gain only. Not
  worth it.
- **A framework, a bundler, or TypeScript.** The project's zero-dependency,
  open-the-file-and-it-runs property is a real asset — `file://` works today.
- **Rewriting the render code.** It's tuned, it's the game's identity, and
  there's no complaint against it.

---

## 6. Suggested order

| Step | Value | Risk | Depends on | Status |
|---|---|---|---|---|
| 0 · Repo hygiene | Low but free | None | — | **done** 2026-07-28 |
| 1 · Tuning surface | **High** | Low | — | open |
| 2 · File split | **High** | Low (byte-identity guard) | — | **done** 2026-07-31 (as script tags) |
| 3 · Labs | Medium | Low | — | **resolved by deletion** 2026-07-28 |
| 4 · Perf | Low today, preventative | Medium (verifier trim) | Step 2 | see note below |

**Step 4 correction, 2026-07-31.** The verifier-bundle trim was measured and is
**not worth doing**. Its premise was that ~7,000 lines of render code in the
bundle cost the server something per submission. They don't: verification drives
`simStep` and never draws, so a stub-side optimisation moved verification 6.4ms →
6.7ms (nothing) and cold load 22ms → 22ms (nothing). The only cost render code
carries there is bundle parse time, already inside that 22ms. Dropped.

What *is* real, from a CPU profile of the suite: `drawStreaks`, `drawStarField`
and `blob` are per-frame and together ~20% of headless CPU; `clamp` has 268 call
sites. But a headless profile measures JS arithmetic against a stubbed `ctx`, not
rasterisation — **profile on the real device before changing any of it.**

Steps 1 and 2 are the ones I'd actually argue for. Step 4 is honest maintenance
with no current payoff — worth queueing, not worth rushing.

Since the labs are gone, the `*FX` blocks in `index.html` are now the **only**
record of those visual designs. That raises the value of Step 1 (tuning surface):
those constants are no longer one copy of two, they're the original.
