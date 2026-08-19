# User feedback log

One entry per piece of player feedback. New entries go under OPEN.
When an item ships: move it to DONE, add a one-line solution, and add the
app version that carries the fix (package.json `version` at merge time).

Status values: OPEN (raw feedback) → DECIDED (design settled) →
BUILT (on master, awaiting a release) → DONE (shipped, version noted).

---

## BUILT — awaiting release

### F-001 · Learning curve too steep on lane 2
- **Date:** 2026-08-19 · **Source:** multiple players · **Status:** BUILT (2026-08-19)
- **Feedback:** the difficulty jump from lane 1 to lane 2 (THE CARGO RUN) loses new players.
- **Decision (Gil):** lane 2 introduces doubles ONLY; heavies (purples) move later; add a
  first-contact dock cue on the campaign's first heavy.
- **Solution:** cargo-run re-staged to one new threat per lane — 2: doubles, 3: heavies,
  4: bursts+killers, 5: barriers, 6: dead zones, 7: phase locks + max traffic. Slot traffic
  ramps unchanged. The lane that introduces heavies shows the qualification dock guides on
  the run's first heavy while the lane is unsecured (draw-only). Moves cargo-run board sim ids.

### F-002 · Player request: difficulty levels per lane
- **Date:** 2026-08-19 · **Source:** one player suggestion · **Status:** BUILT (2026-08-19)
- **Feedback:** let players pick a difficulty per lane.
- **Decision (Gil):** no tier system. LANE ASSIST on retry instead: no scoring at all,
  unranked, no shields (stars) on the end; progress unlocks.
- **Solution:** after 2 straight losses on a campaign lane the END screen offers
  LANE ASSIST — spawn gaps ×1.3, speed ×0.9 over a copy of the authored table.
  boardKey → null, no score shown or recorded, no stars, no bests; route unlock advances.
  Loss counter is session-only. Retry keeps the mode; the duel continue keeps it too.
  Presented in a shared amber OFFER SLOT at centre-bottom (see F-004) — the same slot
  RETRY DUEL uses. Gamepad: X takes the assist, A stays plain RETRY.
  Note: an assist-only clear never marks the campaign cleared (stars gate flow unlock and
  campaign-cleared checks) — intentional, revisit if players report it.

### F-003 · The volley is useless and costs points
- **Date:** 2026-08-19 · **Source:** player feedback · **Status:** BUILT (2026-08-19)
- **Feedback:** no enemy requires the volley, and it pays a flat bounty with no combo
  credit — so it deducts potential points.
- **Decision (Gil):** C2 + C3 — pay it into the combo economy AND add a depth bonus, so
  power players max score with it and defensive players pre-clear with it. No new enemy.
- **Solution:** a volley kill now advances the combo and takes the ×combo multiplier, plus
  a depth bonus (up to +140 base at the horizon). Still no perfect ×2 and no pulse feed;
  cooldown and the frag-replication punishment unchanged. Guide tip updated. Moves all
  campaign/weekly board sim ids.

### F-004 · The costed offers were hard to find
- **Date:** 2026-08-19 · **Source:** Gil, reviewing the assist build · **Status:** BUILT (2026-08-19)
- **Feedback:** LANE ASSIST was buried in the left stack, its price line ran into the next
  key, and RETRY DUEL wore navigation's colour like every other button.
- **Solution:** one shared amber OFFER SLOT at centre-bottom of the report, anchored upward
  off the numbers block so it never lands on the telemetry. It holds RETRY DUEL when a duel
  is lost, else LANE ASSIST; the duel wins the slot when both apply. The price prints under
  it. Sides keep plain navigation: RETRY right (labelled FULL RETRY beside a duel offer),
  MENU left. `button()` gained a `tone` argument; amber means "a costed way forward".

### F-005 · The controller focus ring did not drive A
- **Date:** 2026-08-19 · **Source:** Gil · **Status:** BUILT (2026-08-19)
- **Feedback:** walking the focus ring onto a key and pressing A fired the report's
  hard-mapped FORWARD instead of the key under the ring.
- **Solution:** while the ring is up, A presses the focused key everywhere. The per-key
  letter badges fade out for exactly that long, because the two readings of A cannot both
  be advertised. Five seconds of stillness fades the ring out over 0.6s and hands A back to
  its own verb with the badges. The wheel glow and mutator highlight follow the same clock.

### F-006 · The high-score card opened on a LANE ASSIST report
- **Date:** 2026-08-19 · **Source:** Gil, testing the assist · **Status:** BUILT (2026-08-19)
- **Feedback:** finished a LANE ASSIST run and got the leaderboard name-entry popup, on a
  run that files no score.
- **Cause:** the provisional-rank lookup fired at endLevel and its callback asked only
  "are we on an END screen?". That is true of the NEXT run's report too, so a ranked run's
  lookup — which can land up to 10s late — opened the card over the assisted report that
  followed it. The assist guards themselves were correct; the race was not covered.
- **Solution:** every endLevel takes the next `endSerial`; the callback (now the named
  `applyProvisional`) does nothing unless it still holds that serial AND the player is
  still on the report. Regression tests cover the stale lookup, the live one, and a
  lookup landing off the report.

### F-007 · A restart after an assisted clear stayed assisted
- **Date:** 2026-08-19 · **Source:** Gil · **Status:** BUILT (2026-08-19)
- **Feedback:** after clearing a lane on LANE ASSIST, RESTART flew it eased again. A player
  who has just cleared it wants to fly it for real and set a record.
- **Solution:** the ease sticks until the lane is CLEARED, then it is spent. A retry off a
  won assisted lane starts normal and ranks; a retry off a LOST one stays eased, because
  the player is still stuck and that is the point. The key reads RETRY RANKED after an
  assisted clear, since the run behind it showed no score anywhere and 'RESTART' alone
  would not say that this one counts.

---

## OPEN

(none)

---

## DONE

(none yet — F-001..F-003 move here with the release version)

---

## Release checklist for the batch above
1. Bump the version, build, and test on device.
2. `npm run build:verifier && npm run deploy:verifier` — MUST ship together with the
   app update (strict sim ids; do not use `--compatible`, the sim genuinely changed).
3. Move F-001..F-003 to DONE with the version.
