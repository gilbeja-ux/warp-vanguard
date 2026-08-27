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

### F-008 · The mission disc was a redundant click-through
- **Date:** 2026-08-20 · **Source:** Gil · **Status:** BUILT (2026-08-21)
- **Feedback:** a briefed deploy was two screens — read the disc, tap it away, and only
  then meet the pads and the wait for hands. Merge the disc into the pre-warp screen; the
  only thing lost is the WARP LANE READY plate, and the thumb ghosts make it intuitive.
- **Solution:** the pre-run disc IS the pre-warp screen. The pads are live under it, the
  ghosts demonstrate on the real pads, and BOTH THUMBS DOWN releases the disc straight
  into the boot. The disc's hint reads TAKE THE CONTROLS; its full-screen dim is gone so
  the pads read as yours. Mid-run cards and the verdict keep TAP TO CONTINUE. A gamepad's
  sticks grip through the disc the same way; A still dismisses to the plain parked screen,
  which unbriefed starts (retries, endless, weekly) keep unchanged.
- **Correction (2026-08-21, Gil, with reference shots):** the merged screen first drew the
  pads as live in-warp consoles — `booting` in drawDials asked for S.PLAY, so S.INFO fell
  through to the powered gauge. The disc screen now shows the same dormant consoles the
  parked lane shows (dark ring, OFFLINE, the PLACE THUMB dot). And the lane-progress /
  stability arcs no longer hang over the pre-warp screen at all: preLaunch() now outranks
  the state check in their alpha, and they arrive on the power-up ramp with a small eased
  diagonal slide — in from their upper outboard corners — instead of fading in place.
  The score readout (and its COMBO / MODIFIERS / LANE ASSIST tags) rides the same ramp
  and the right arc's diagonal: a zero lit over a parked ship was the same lie the full
  integrity bar was. The PAUSE key stays: it is chrome, not console hardware.

### F-009 · The pre-run disc undersold its screen
- **Date:** 2026-08-20 · **Source:** Gil · **Status:** BUILT (2026-08-21)
- **Feedback:** the disc was visibly smaller than the map lens the player just left, and
  was not using the space.
- **Solution:** story-layout discs (missions + the closure verdict) now share the map
  lens's exact formula — min(H·0.47, W·0.30)·0.92 — so a deploy keeps one disc size from
  selection through briefing. Field briefings keep the tighter plate, sized to sit inside
  the live ring they interrupt.

### F-010 · The parked sky flew too fast
- **Date:** 2026-08-20 · **Source:** Gil · **Status:** BUILT (2026-08-21)
- **Feedback:** on the pre-level screen the stars rush, but the ship has not launched —
  they should move at menu speed until the warp engages.
- **Cause:** warpT (the entry dive) is HELD at full while parked so the shove lands on the
  dock — but drawWarpSky read it raw, so the parked blanket ran at 3.6× the menu crawl
  with warp-stretched smears. Five painters had already learned this lesson via laneDive();
  the sky was the sixth.
- **Solution:** drawWarpSky reads laneDive() (the held dive scaled by laneFlow). Parked and
  briefed screens now crawl at exactly the menu's station-keeping pace, and the dive still
  lands with the dock.

### F-011 · The menu starfield "reset itself" ~5s after load
- **Date:** 2026-08-20 · **Source:** Gil · **Status:** BUILT (2026-08-21)
- **Feedback:** about five seconds after the app loads, the menu's starfield pops — it
  resets and flies on as a different sky.
- **Cause:** the perf watchdog's grace ends at time 5 and its first 2s window closes ~7s in
  — right when a warming device can still look slow. A trip called initWarpSky and
  initDeepField outright: every star the eye was tracking vanished and a re-dealt field
  appeared. The reset WAS the shed (and a later restore popped the same way).
- **Solution:** two halves. The watchdog no longer samples until the deep-field warm queue
  (one world-skin bake per frame) has drained, so warm-up cost cannot trip it. And a tier
  change no longer re-deals the visible sky at all: the warp blanket and the deep field
  retarget in place — the tail of the population fades out over 1.2s before it is cut, and
  restored stars fade up from nothing (retargetWarpSky / retargetDeepField). The lane-only
  layers (streaks, medium, traffic) still rebuild outright; they are invisible on menus.

### F-012 · In-run barks are cramped, small, and glued to the speaker title
- **Date:** 2026-08-25 · **Source:** Gil · **Status:** BUILT (2026-08-25)
- **Feedback:** the barks during a run miss a space after the speaker title, and the line
  reads cramped and small — a better, easier-to-read design is wanted.
- **Cause:** chip + message shared ONE chord high in the bore. The fitter shrank the whole
  line to 8-10px to fit, and the chip's border ended 5px past the label while the message
  started at 6px — one pixel of air, so the title read glued to the text.
- **Solution (H-32):** a broadcast subtitle. The speaker chip (`» CMD`, letterspaced, real
  padding) stands centered on its own line; the message takes the whole chord beneath it at
  13px, word-wrapped to two rows (three only at the 10px floor). The per-glyph H-20 fade is
  kept, its stagger running through the wrap. Draw-only — board ids unchanged.

### F-013 · Three sourced takes; the sonar cut, then restored as weather
- **Date:** 2026-08-27 · **Source:** Gil · **Status:** BUILT (2026-08-27)
- **Feedback:** three downloaded sfx, mapped by Gil. The sonar beep "needs to be cut so it
  doesn't overload the soundstage". The sci-fi charge-up is the boss ray's wind-up, and
  "the ray should start when this ends". The space explosion is the mini explosion before
  the boss's main blast, "multiplied instead of the current synthes... with different
  pitches so it sounds different, like explosions of different parts".
- **Cause:** not a defect. `rayCharge` and `bossPlate` were DECLARED paths waiting on takes
  (H-33); the sonar had no declared path at all and was a bare 0.05s sine.
- **Solution:** three cut takes in `src/audio/sfx/`, all fail-soft over the synth voices,
  which stay as the fallback.
  - `sonar-ping.mp3` (0.20s, trim **0.05**) — **cut, then restored at a whisper, same day.**
    Gil flew the first build and cut the cue outright: "especially on the later stages, it
    just becomes an annoyance. always beeping." Then: "maybe we can reinstate the sonar
    pulses but lower the volume a lot so it's just a background indicator."
    **The volume was only half of it.** The complaint was a LATE STAGE, where a dozen live
    hostiles each run their own blip train — a continuous tone at any level. So the restore
    is two changes, not one:
      - trim 0.16 → **0.05** (true peak −29.3 dBFS): the quietest take on the roster by
        ~9 dB, and about 4 dB under the bare sine it replaced. Every other take is an
        EVENT; this one is weather.
      - **`SONAR_GAP = 0.26`**, a LANE-WIDE floor between any two pings, timed on the
        audio clock. The take is re-cut to 0.20s — shorter than the gap — so a ping always
        ends before the next may start and the cue can never overlap into a drone.
    Measured on a real stage 07 run, 20s with the pads held: the scheduler asked for **157
    pings (7.8/s)**, **53 sounded (2.6/s)**, smallest observed gap **0.267s**. Hard ceiling
    3.8/s however dense the lane gets.
    The per-hostile scheduler in `72-tick.js` is byte-identical to before the cue was cut,
    which is what makes both the removal and the restore provably board-neutral (0 of 41,
    checked both ways). The density fix lives on the audio side and touches no sim state.
  - `ray-charge.mp3` (1.225s, trim 0.7) — and **`BEAM_BURST` is now the take's length**.
    `RAY_CHARGE_RELEASE` (1.05s) is where the take peaks and lets go; the rotation starts
    there, so the wind-up and the launch are one event. The sustained bed's crossfade
    (`RAY_BED_FADE`) was moved to end on that release too.
  - `boss-plate.mp3` (1.22s, trim 0.6) — one file played six times down the `dyingN`
    ladder, pitched 1.20 → 0.85. The source's 4s reverb is cut at 0.85s, or six of them
    under the death take is a wash.
- **THIS IS A FIGHT CHANGE, NOT ONLY A SOUND ONE.** The telegraph before a light may turn
  or fry went 0.30s → 1.05s. Every sweep round is 0.75s longer per light and reads easier.
- **THE RANKED FINGERPRINT DID NOT SEE IT.** The battery reported 0 of 41 boards moved, and
  that is wrong here: on the boss lanes of THE SURVEY and THE COLLECTOR (level 08 of each,
  board keys `survey:7` and `collector:7` — a board key holds a zero-based INDEX, never a
  level's name) the boss surfaces at step 3000 and
  the first ray at step 3206, against a 3240-step budget — the ray never finishes its birth
  inside the battery. Driven to 6000 steps the same lanes score 1342→1322 and 1235→935.
  Deploy the verifier STRICT. See OPEN below.


---

## OPEN

### O-001 · The sim fingerprint is blind to every boss fight
- **Found:** 2026-08-27, while checking F-013's blast radius.
- The battery plays each lane for `duration * 60 + 240` steps. On the five lanes that carry
  a boss (level 08 of each contract) the machine surfaces at about step 3000 against a
  3240-step budget, so the fight
  is 240 steps of an encounter that runs 3000. `BEAM_BURST` moved 0.30s → 1.05s, which
  re-scores two of those lanes outright, and `simDigest` still reported 0 of 41 boards
  moved. Every "nothing moved" answer about boss code is currently worthless.
- The fix is a bigger step budget on boss lanes, or a boss-aware signature. Neither is in
  F-013's scope. Until then, treat `--compatible` as unavailable for any boss change.

---

## DONE

(none yet — F-001..F-003 move here with the release version)

---

## Release checklist for the batch above
1. Bump the version, build, and test on device.
2. `npm run build:verifier && npm run deploy:verifier` — MUST ship together with the
   app update (strict sim ids; do not use `--compatible`, the sim genuinely changed).
3. Move F-001..F-003 to DONE with the version.
