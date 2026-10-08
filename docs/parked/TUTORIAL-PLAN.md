> **REJECTED by Gil, 2026-10-08, the day it was written** ("i don't like these suggestions").
> Kept as a record only. What shipped instead is F-017 in docs/USER-FEEDBACK.md: one
> course in which every lesson is called by an instructor on the ring, a rewind on a
> miss, and no disc stops.

# The course, made short — a plan

Written 2026-10-08, the day Apple approved 1.0.11 and the first testers on both
platforms reported back. Two reports concern the qualification course: one tester
saw no arrows on the first run (F-016), and several, on Android as well as iOS,
called the course too complex or unintuitive (F-017). This is the plan for the
second report, with the first folded in.

The short version: **the course teaches the ring, the contract teaches the threats.**
The course drops from nine lessons and ten disc stops to three lessons and at most
one disc; each threat teaches itself at its first contact in the contract, where
the cargo run already introduces them one per lane; and the course stops
re-starting at every boot.

---

## 0. What the course is today (measured 2026-10-08)

A fresh save goes: splash → three enlistment beats → the parked lane → both thumbs
→ a 2.9 s boot → nine stages, thirteen reps, ten disc stops → QUALIFIED → the
report. A perfect pupil, tapping every disc away as fast as the gates allow, in
the real game in Chrome on a 390×844 phone viewport (scratch `course.js`, 2026-10-08):

| Fact | Value |
|---|---|
| Enlistment, tapped as fast as allowed | 3.4 s |
| Launch to QUALIFIED, game time | 68.7 s |
| Disc stops | 10 |
| Stages / reps | 9 / 13 (move ×3, red ×2, wall, heavy, volley, net, lock ×2, relay, ribbon, column) |
| New nouns on the discs | 10: DUAL EMITTERS, INTERDICTOR, DEAD ZONE, ARMORED INTERDICTOR, UNITE VOLLEY, BARRIER NET, PHASE-LOCKED, POWER-UP, BONUS RIBBON, PULSE CHARGE |
| Retries by the bot | 0 |

A human reads each disc (five to ten seconds), misses a rep or two (each miss
repeats the drill, with no cap), and lands at three to five minutes for the one
screen they see before the game. Stage 01 of the cargo run is 40 s long.

Three facts about the surroundings matter more than the course itself:

1. **It is mandatory, at every boot, until finished.** `99-boot.js:1829` starts the
   enlistment whenever `progress.tutorialDone` is false. QUIT on the pause disc lands on
   the contracts wheel and the cargo run is playable from there — but the next launch
   starts the course again, with the one-line re-entry. Nothing says so.
2. **It duplicates the contract.** The cargo run was re-staged on 2026-08-19 (F-001) to
   one new threat per lane: 02 paired traffic, 03 armor, 04 bursts, 05 barrier nets,
   06 dead zones, 07 phase locks, 08 the boss. Every lane carries a `hint` for its
   threat that no longer prints (cut from the pre-warp screen, `90-hud.js:594`). The
   campaign's first heavy already wears the course's own guides while the lane is
   unsecured (`heavyCue`, `90-hud.js:1255`). So the course teaches seven threats in a
   row, in a minute, that the contract then re-teaches one per lane.
3. **The product doc and the game disagree.** `PRODUCT.md:183` says "the tutorial has
   no modal stops". F-014 (2026-08-28, Gil) put ten back because the stop-free course
   "doesn't work for players". The ruling below has to land in both.

### Diagnosis

The course front-loads the whole threat vocabulary before the first stage. "Too
complex" is the sum: ten stops, ten nouns, and the two-thumb rules (dock BOTH,
cover BOTH ends, only the MATCHING phase) arriving in a row before one-thumb
interception is a habit. "Unintuitive" is the same list read by someone who has not
yet learned that the pad is the ring in miniature — which is the one thing the
course exists to teach, and the one thing it spends the least time on.

F-016 fits the same picture. The first drill's only cue on the ring is one thin
dashed arc, blue, on the left side, while the player's eyes are on the pads (the
pad's ghost thumb waits 1.1 s and retires on any progress). The drawing path was
checked: it is unchanged since 1.0.10, and it draws on both first-run paths in the
real game (see F-016 in `USER-FEEDBACK.md`). The fix is to make the first cue
impossible to miss, not to find a missing arrow.

---

## 1. The plan

### Step 1 — cut the course to the controls

Three lessons, in the game's own language, each one a thing the thumbs must learn
before the contract can teach anything else:

| Lesson | Drill | Why it stays |
|---|---|---|
| MOVE | the three align reps, unchanged | the pad IS the ring in miniature — the entire control scheme |
| INTERCEPT | two plain reds | one thumb, one target, the verb every lane runs on |
| DOCK | one armored interdictor | the ring's only two-thumb verb; nothing in the contract can show "BOTH" by itself |

Everything else leaves the course: the volley, the barrier net, the phase locks, the
relay, the ribbon, the purge column, the dead zone. Expected: about 25 s for a
perfect pupil, about one minute for a human, three nouns.

Discs: the recommendation is **one**, the ARMORED disc, because "both" is the one
rule the picture on the ring cannot carry alone. MOVE is taught by the lit slot, the
arrow and the ghost thumb; INTERCEPT by the riding label. (The ten dioramas are not
wasted — see step 2.)

### Step 2 — each threat teaches itself at first contact, in the contract

Two halves, both draw-only, so no board moves.

**a. The first-contact cue.** `heavyCue` becomes a cue per threat kind: the lane that
INTRODUCES a kind wears the course's guides — the arrows, the dock spot or parking
spots, the riding label — on the run's FIRST specimen of that kind, while the lane is
still unsecured (stars 0), exactly as the armor cue does today. The kinds and the
lanes that introduce them in the cargo run:

| Lane | Kind | Cue |
|---|---|---|
| 01 | plain red | the course just taught it; no cue |
| 01 or 02 | first golden relay | arrow + CATCH THE GOLD RELAY |
| 02 | paired traffic | INTERCEPT on both, one arrow each |
| 03 | armor | exists today |
| 04 | bursts | label only, the verb is the same |
| 05 | barrier net | two neutral arrows, two parking spots, COVER BOTH ENDS |
| 06 | dead zone | DANGER! AVOID! on the landing arc (exists in the course) |
| 07 | phase lock | the matching node's arrow, ONLY THE MATCHING PHASE |
| first ribbon | ribbon | RIDE THE CROSSING POINT, the gold meter on the pad |
| first charged pad | pulse | TAP THE GLOWING CORE on the pad |

The campaign package names the lane's kind (the dead `hint` field becomes
`teach: 'heavy'`, or the loader derives it from the first lane whose rate for a kind
is non-zero). Later contracts inherit the rule for free: a kind's first lane in ANY
contract is cued while unsecured.

**b. The demonstration rides the pre-warp disc.** The lane that introduces a kind
shows that kind's diorama (`drawDiscDemo`, the ten field briefings from F-014) on
its own briefing disc — the upper half the demonstration, the lower half the story
line. This adds **no stop**: the briefing disc is already the pre-warp screen
(F-008), and the player is already reading it with both pads live under it. It keeps
Gil's 2026-08-28 ruling — no campaign LANE stops — and gives every diorama a place
where it is read once, right before it is needed, instead of ten in a row.

The layout is the only part that needs Gil's eye: the disc law applies (nothing
touches the rim; the story line through `discPara`), and the disc lab on 8013 is
the bench. Named knobs: the demo's centre and radius on a story disc, the plate's top.

### Step 3 — the course runs once

- The first launch keeps the enlistment and the course exactly as now.
- QUIT out of the course, or finishing it, marks it seen (`progress.courseSeen`); the
  next boot goes to the home menu. The one-line re-entry (`ENLIST_SHORT`) is retired.
- VANGUARD TRAINING on the contracts wheel re-enters the course at any time, and its
  disc says QUALIFIED or NOT YET QUALIFIED instead of implying a gate.
- Nothing is locked behind it. That is already true today (the cargo run opens from
  the wheel after a QUIT); the change is that the game stops pretending otherwise.

### Step 4 — the first drill's cue cannot be missed (F-016)

- The pad leads. On rep 1 the ghost thumb on the left pad runs from the first frame
  (`DRAG_GHOST_DELAY` 1.1 → 0 for the first rep only), so the first thing the player
  sees move is on the pad under the thumb, not an arc across the ring.
- The ring answers. The target slot is lit (it is today) and the arrow's dash is
  wider and brighter for the move drill than for a mid-lane lead (a knob, not a
  redesign).
- A rep that has not moved for four seconds re-shows the ghost (today real progress
  retires it and a wrong-way drag keeps it; a frozen thumb gets the loop, which is
  right, but only after the 1.1 s grace).
- One arrow at a time. Rep 1 moves the blue thumb only, and the lesson line
  says SLIDE THE DIALS — plural. Rep 1's line should say SLIDE THE BLUE DIAL,
  rep 2's SLIDE THE WHITE DIAL, rep 3's BOTH AT ONCE.

### Step 5 — proof, before and after

- **`npm test`**: pin the course's lesson list and its disc count; pin that every kind
  the cargo run introduces has a first-contact cue and that the lane introducing it
  carries the demo key; keep the existing drag-ghost pins and add the rep-1 case.
- **The smoke**: a new step flies the course on a fresh save through the real touch
  path, counts the stops and screenshots each drill. Today the smoke seeds
  `tutorialDone: true` and never sees the course; and until 2026-10-08 its two-thumb
  step put both thumbs on the RIGHT pad (`dialCenter(0)` is not the left pad) and
  passed on its own fallback. The bot from this session (scratch `course.js`) is the
  starting point — it flies the whole course with zero retries.
- **The verifier**: steps 1, 2a, 3 and 4 are draw-only or inside the unranked
  course; step 2b adds a package key, which moves the sim id and no board. Build with
  `-- --compatible`, deploy before the 1.0.12 cut.
- **`PRODUCT.md:183`**: rewrite the principle to the ruling: "the course has at most
  one stop; a threat is demonstrated on the pre-warp disc of the lane that introduces
  it and cued on its first specimen; no lane stops mid-run."

---

## 2. Decisions for Gil

1. **The course's lessons.** MOVE + INTERCEPT + DOCK (recommended), or keep more.
2. **Discs in the course.** None, one (ARMORED, recommended), or one per lesson.
3. **Where the dioramas go.** The pre-warp disc of the introducing lane (recommended),
   a mid-run first-contact stop (ruled out 2026-08-28), or nowhere — labels only.
4. **The gate.** The course runs once and QUIT counts as seen (recommended), or it
   must be finished before the wheel opens.
5. **The nouns.** The ten names stay on the discs and in the field guide (recommended),
   and the riding labels carry only the verb (INTERCEPT, DOCK BOTH, COVER BOTH ENDS,
   MATCH THE PHASE).

## 3. Order of work

| Order | Work | Size | Moves a board? |
|---|---|---|---|
| 1 | Step 1 (the cut) + step 4 (the first cue) + their pins | one session | no — the course is unranked |
| 2 | Step 2a (the cues) + the smoke step | one session | no — draw-only |
| 3 | Step 2b (the demo on the pre-warp disc) + the disc-lab bench | one to two sessions; the layout is Gil's call | sim id only |
| 4 | Step 3 (the gate) + `PRODUCT.md` | half a session | no |
| 5 | Verifier `--compatible`, 1.0.12 on both shells | the standing rule | — |

What this plan does NOT do: it does not touch the contract's lane plan, any spawn
rate, the boss, or the field guide. The ten dioramas, the riding labels, the dock
spots and the lesson line all survive; they move.
