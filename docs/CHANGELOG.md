# Changelog

One entry per released version, newest first. Each entry groups the changes by
what a player meets. The commit trail between two versions is
`git log <prev-tag>..<this-tag>`; this file is the readable digest of it.

---

## 1.0.6 — 2026-09-04 (versionCode 10006)

The open-testing build. The replay viewer stops lying, and the boss shortcut
grows a lock instead of getting cut.

### The replay viewer tells the truth
- **A trace from another era is refused, not played wrong.** The sim moves
  between releases, and an old trace then plays against a world its runner
  never flew. The viewer now recomputes the run silently first; on a mismatch
  the board says REPLAY FROM AN OLDER VERSION instead of playing garbage.
- **The run's own song, held across every rewind.** A scrub back used to draw
  a fresh random track on every drag. The package now carries the take that
  scored the run, and the viewer pins it.
- **The run's own modifiers, not the watcher's.** A watcher with FAST toggled
  on was replaying a faster lane than the run flew. The viewer parks the
  watcher's toggles and applies the package's, exactly as the verifier does.
- **The boss moves the same way every time.** The leech's hover and its death
  convulsion rode the session clock, so a replay or a scrub moved the machine
  somewhere the run never put it. Both ride the run's own clock now.
- **A replay never parks on a briefing disc**, and it never burns the
  watcher's own first-encounter briefings.

### The boss duel shortcut is a tester tool now
- **The long-press on the final relay opens a passcode disc** — BOSS DUEL
  SHORTCUT — instead of dropping straight into the duel. The tester passcode
  launches the drill; a wrong entry shakes the disc and stays; a stray tap
  backs out. The drill still files no score anywhere, as it never did.

## 1.0.5 — 2026-09-01 (versionCode 10005)

67 commits since 1.0.4. The headline: the enemies stop being paintings and
become geometry, the five bosses stop being one machine at five sizes, the
volley becomes worth spending, and the course demonstrates every move instead of
naming it. A private feedback channel closes the version.

### The enemies are hardware now
- **Three hulls, one per role**, built through the same renderer, shadow map and
  materials as the stations and the gate. A tap carries one seat and one drill, a
  heavy carries twin drills, and an anchor carries no drill at all — a winch drum
  and two horns. The silhouette names the role from the horizon, before colour
  resolves.
- **One sun over the whole lane.** Six light directions bake per hull, and the
  view picks the one that lands correctly after the sprite's rotation. Colour is
  never baked: one hull serves red, blue, white and purple.
- **The ring is the reach, drawn.** A hoop subtends the same arc one emitter
  covers at every depth. Put an emitter inside it and the trap is yours.
- **Every screen that depicts an enemy draws the real body** — the bore, the
  field guide, the enlistment disc, the briefing and drill discs, the menu's
  traffic legend, and the de-rez, which now tears the body in the rotation it
  died in. The field guide gained a sixth specimen, the BARRIER.
- **Everyone meets the same body.** The hulls used to bake on two screens only,
  so a first session played the painted stand-in. They lead the boot queue now
  and the splash holds for them behind a LOADING bar. Stage 01 draws 242 hulls
  and no stand-ins.
- **A missed trap flies past** instead of swelling into a blob in your face. The
  bodies also lost a twentieth of their size, and the aim ring was paid the same
  amount back so it still tells the truth about the reach.

### The boss ladder
- **Five machines, five sets of hardware.** The ladder used to escalate scale and
  spin and nothing else, so it read as a zoom. Each leech now inherits typed rim
  mounts — a swarm cradle, an emitter mast, a second mast, a filter drum, an
  armour plate — plus its own machining rhythm, iris blade count and scorch
  level. The blockade draws its inherited mounts in scavenged brass and only its
  own plate in live steel.
- **The rim slots are the health bar.** A landed pulse shears one slot off, low
  slot first, so the blockade sheds salvage before armour. The machine gets less
  busy as the lane gets fuller.
- **The resting lamp breathes red into an ember**, not into pink and purple.
  Purple is the game's word for BOTH THUMBS, so a resting boss was announcing the
  finale every three seconds. The swing changes brightness only, never hue.
- **A boss holds the bore's centre.** Its footprint is a fairness number, so
  every new mark is carved into the rim band the sprite already covered.
- **The prism's sweep offers a way out.** It was dead time. An injector now rides
  in with the lights and buys back a whole pulse, fetched under two rays. The
  last stand tightens in steps anyone reaches.

### The volley, and what left with it
- **The volley detonates.** The bolt cost both thumbs, half a second of dock and
  1.25s of recharge, and deleted exactly one red — so nobody spent it. It now
  takes the neighbours of what it kills, inside an ellipse. It takes what the
  bolt takes: single plain reds and armor, never barrier pairs or phase locks. It
  never chains. The drawn region walks the ellipse's own boundary, so the screen
  cannot disagree with the rule.
- **The reach settled at 0.70 / 2.00**, measured over 4062 traffic snapshots.
  Traffic that arrives together is close in depth and scattered in angle, so the
  angle is the axis that turns the upgrade on.
- **The node killer is retired** — deleted, not disabled. Two fixes for it
  failed. The dead zone is the game's one avoid object now, and it is the better
  one, because it seizes an arc. Its ticks went back to real traffic: about 9%
  more threats across the 35 non-boss lanes, with four authored beats nudged to
  keep the lanes fair.
- **The blast reads as a shockwave** — a front that runs and leaves the wall
  clean, not an outline that sits. Four bench passes with Gil settled it.
- **The fused ray cannon's last residues are gone.** The current arrangement is
  unchanged: you hit a boss with pulses, and a boss sometimes fires a ray at your
  emitters.

### The course teaches again
- **Ten drill discs come back, and each one demonstrates.** The upper three
  quarters are a live diorama of the ring seen down the bore. A short loop plays
  the correct answer — slide, dock, hold, dodge, tap — and dissolves back into
  itself. The words take the bottom quarter and nothing above it.
- **The ten:** the emitters, the interdictor, the dead zone, the armor, the
  volley, the barrier, the phase locks, the power-up, the ribbon, the purge. The
  volley rides the armor stage, because docking both emitters is already that
  stage's answer.
- **Qualification only.** No campaign lane ever stops.
- **The enlistment answers a tap.** The first tap completes the line, the second
  moves on. A tap used to do nothing at all.
- **The field guide names its specimens.** A cell is four bands now: the name,
  the specimen, an emitter chip, the guidance. The chip is a second channel that
  colour was carrying alone.

### The lane clock
- **A countdown rides the progress bar.** A stage outlives its authored duration
  by three to five seconds, so the old arc sat pinned at 100% with the last wave
  still inbound. There is one number now, and the digits and the arc are the same
  value. The counter lands on zero on the frame the lane closes.
- **It says one thing at a time:** LANE OUT and seconds on a lane, pulses landed
  over pulses needed during a duel, REMAINING on a replay's scrub knob.
- **Free flow points at something again.** The endless and weekly arc used to
  divide by a 150s ramp and then point at nothing for the rest of a deep run. It
  fills toward the next step-up and counts down SURGE IN.

### Sound
- **27 cues became recordings**, and no two share a sound. Every one of the 73
  cues has a row, a candidate folder and a verdict — 48 takes, 9 oscillators kept
  on Gil's ear, 5 open. No synth voice was deleted; a failed decode still says
  what the game said before.
- **Three cuts are game constants, not taste.** The volley charge is 0.50s
  because that is the dock. The restart is 1.42s so its end lands on the emitter
  pop. The stage transition starts 0.30s in so its peak arrives on the picture
  cut.
- **A duplicate-recording bug is closed.** Heal, x10 and lane-secured all shipped
  as one file, which surfaced as "the OVERDRIVE x10 chime sounds more than once".
  The test now fails on any two cues sharing a recording.

### Every panel is a disc, and nothing is a broken signal
- **The glitch vocabulary is gone** — torn strips, chromatic fringe, static,
  scanlines, the CRT power-off. A panel opens as a wavefront that leaves the rim
  and closes on the centre. A killed body is reclaimed along the wall's own grid.
  A hit sheds a red warning wave off the ring.
- **PAUSED, SETTINGS and HIGH SCORE are all discs**, wearing the mission disc's
  plate. BACK owns the top-left corner on every screen.
- **A restart travels.** RETRY, RETRY ASSIST and the duel's CONTINUE now run the
  same warp as NEXT STAGE. The freeze-and-shred read as a crash, which was the
  one screen in the game that said something had gone wrong.
- **The boot splash warps the right way.** Both cards travel: the studio mark
  rushes the lens, the badge comes up the bore and parks on its rect. The splash
  paints no warp of its own — the real lane runs underneath and the curtain
  thins.

### Balance and fairness
- **Full health no longer wastes a patch.** A relief orb hands over the next
  thing that still has somewhere to go: the shield, then the pulse. Every orb is
  gold now and the glyph alone names the power.
- **No two power-ups arrive within ten seconds.** Three sources dropped them and
  none could see the others. A refused drop is deferred, never discarded.
- **Nine authored beats** punctuate the survey and the patrol.
- **The lock debut takes a breath.** Stage 07's first fifteen seconds halve the
  reds and hush the volleys.
- **The verification battery stopped dying at six seconds.** Its synthetic pilot
  never defended, so all 40 boards ended in 4 to 14 seconds of a 44 to 79 second
  lane, and "nothing moved" was worthless. All 40 boards play out now, and
  pickups are part of the signature.

### Performance
- **A lane held 191 MB of canvas over 214 surfaces.** Three of the largest were
  things nothing on screen used. The vignette alone was 19 MB to describe two
  colour stops. The lane is 135 MB now, and a refused canvas can no longer take
  the ring with it.

### Feedback — a private note to the developer
- **SYSTEM CONFIG → FEEDBACK.** The settings disc's bottom segment now carries
  **MY DATA · FEEDBACK**. Pick one of four subjects (a bug · an idea · too hard
  or too easy · something else), type up to 600 characters, send. Nothing is
  shown to another player and nothing comes back — the panel says so twice.
- **It is a disc**, wearing the same plate the pause disc and the high-score card
  wear, cast in by the ring. `discSegKeys` gained a one-key form for the CLOSE
  that runs the whole width of the segment.
- **The disc uses its space.** A topic too long for one line breaks across two,
  and the break is **balanced** rather than greedy — the long half goes on the
  lower line, where the circle is wider, so the type keeps its size. Titles sit
  below the crown, which is the narrowest line on a circle, and keep double a
  row's margin from the rim. The note field starts as high as the title allows
  and runs down to the last whole line that clears the segment — six lines on a
  phone, up from three.
- **GET IN TOUCH**, on the right flank, replaces *WE CANNOT REPLY*. It says no
  reply comes back down this channel, then gives a contact address — **tap it and
  it copies**, because an address painted on a canvas cannot be selected. The one
  warning about what you type — *do not include your name or anything private* —
  moved to the floor under the disc, centred, where the eye lands after the
  field.
- **CLOSE left the disc, and the gear took its job.** The settings panel is the
  pause disc wearing another door, and the pause disc's corner key both opens and
  closes it. Three ways out remain: the gear, a tap outside the disc, gamepad B.
- **A note written offline is held, not lost.** One slot, flushed on the next
  connection or when the panel is next opened, dropped unsent after a week.
- **What rides along — four things**, and the left flank names all four: the app
  version, the device model, the screen size, and the stage last played. No
  language, no identifier, no name, no email, no reply address. The model is a
  name like *Pixel 8* that millions of devices share, read once from the browser's
  Client Hints — not a device identifier, and never used to recognise anybody.
  None of it needs a permission, a licence or an entitlement; the Play Data Safety
  form gains one row and the privacy policy one paragraph.
- **MY DATA's delete now takes feedback too**, alongside the runs, the traces,
  the rate-limit ledger and the reports the player filed.
- The privacy policy, the deletion page and the Play Data Safety answers all name
  the new field. Feedback is the one **optional** row on that form.

### For the developer
- **A feedback queue in the admin console** (`npm run admin`), below the report
  queue. Two verbs: Handled, and Delete. The portal (`npm run portal`) shows a
  **new feedback** tile that goes red when the queue is not empty.
- `window.__APP_VERSION` is stamped into `dist/index.html` from `package.json`,
  beside the sim id. `index.html` is not part of the sim hash, so no board id
  moves.

### Play Console "What's new" (paste-ready, under 500 chars)

> Enemies are built, not painted: three real hulls under one sun, and a ring
> that shows exactly what your emitters reach. Five bosses now carry different
> hardware and shed it as you land pulses. The volley detonates — it takes the
> neighbours of whatever it kills. Ten drill discs demonstrate each move instead
> of describing it. A countdown beside the lane bar says how long you must
> survive. Most sounds are new recordings. And you can send feedback from
> SYSTEM CONFIG.

> **DEPLOYED 2026-09-01, before the build.** `supabase db push` applied
> `20260901000000_feedback.sql` and, with it, the `20260826000000` migration
> deferred since August (H-26). `send-feedback` and `my-data` are both live, and
> the verifier was rebuilt and redeployed for this build's sim id.
>
> **`DEV_KEYS` is still `true`** in `src/game/40-state.js`. That is correct for an
> internal-testing upload and wrong for a production release — see RELEASE-PLAN §1
> (H-05). Flip it and rebuild before promoting this bundle to production.

---

## 1.0.4 — 2026-08-25 (versionCode 10004)

26 commits since 1.0.3. The headline: the journey loop closes (home → contract
→ report → next contract), the boss boards finally grade honest runs, and the
whole game got a polish pass on light, sound, and text.

### Journey & menus
- **CONTINUE CONTRACT and CLAIM TO FAME** — two arc keys flank the home wheel.
  The left one deep-links to your frontier lane (or offers START CONTRACT /
  PERFECT THE LANE); the right one launches the live weekly and shows its close
  date. Gamepad: LB / RB on the home screen.
- **NEXT CONTRACT ▸** — a delivered contract's report now hands you straight to
  the next contract's frontier, briefed.
- **FLY THIS LANE** — the leaderboard ring gained a launch key: fly the board
  you are looking at. A closed week flies as practice; a weekly retry stays on
  the week it just flew instead of silently rolling to the new seed.
- **The pre-warp disc earns its screen** — the story line reveals first, then
  each thumb console sweeps in; a back arrow (gamepad B) returns to the chart.
  The campaign map's lanes were re-drawn so every leg arrives where it delivers.

### Balance & fairness
- **Boss duels grade honestly** — boss randomness moved to its own seeded
  stream, so the verifier reproduces every duel; stalling a boss for swarm
  points now decays to nothing; boss boards tiebreak equal scores by the
  faster run.
- **Contract 3 out-climbs contract 2** — all seven lanes re-sloped; the finale
  softened after a played pass.
- **Every kill pays its way** — a chain-overdrive kill advances the combo and
  takes the multiplier; a volley kill now counts in the style tiebreak.
- **No unfair board** — a power-up can never land inside a dead-zone carpet,
  and traffic that cannot finish its ride before a duel no longer spawns.
- **Deep surges keep pressing** — past surge 6 the endless/weekly lane raises
  density and mix, announced like every surge.
- **The finale tightens** — the prism's twin lights keep their speed gap at any
  round, and the blockade's last stand speeds its ray shift by shift under a
  purple lamp with a blue-and-white rim: both keys, fired as one.

### Sound
- **A ceiling over the sum** — a master limiter sits over every bus; the
  boss-down take was re-trimmed; a pinned test keeps every effect under full
  scale.
- **The verdict has a voice** — per-star chimes, a NEW BEST stamp, an unlock
  cue when a run opens a lane; accents lifted +10 dB so the x10 chime and
  PERFECT are audible beside the takes.
- **A phone call no longer mutes the run** — audio resumes from any parked
  state and the run pauses instead.

### Light & text
- **One sun over every arrival** — stations bake under the world key light and
  the hull stepped toward the void; the warp gate's dish got its well and six
  hoops.
- **The score is visible in the world** — kill effects scale with the combo, a
  PERFECT fires a white-hot rim filament, and the first x10 of a run sweeps
  gold around the band.
- **Barks read like broadcasts** — the speaker tag stands on its own line and
  the message holds 13px, wrapped, arriving a glyph at a time.

### Under the hood
- **Replay stealing is closed** — traces are private, served by short-lived
  signed URLs, and bound to their recorder; the verifier's error body no longer
  leaks an oracle. Old clients lose replay playback until they update — the
  accepted cost of the coordinated deploy.
- Two dead subsystems deleted whole (the fused ray-cannon duel, the unused
  crawlers/pressure-drone knobs); the menu's ghost scroll machinery removed;
  all 41 board ids proven unchanged by the cleanup.

### Play Console "What's new" (paste-ready, under 500 chars)

> Jump back in faster: CONTINUE CONTRACT and the weekly CLAIM TO FAME now sit
> on the home screen, and a delivered contract offers the next one. Boss duels
> are fairer — leaderboards verify every run, stalling pays nothing, and the
> finale tightens as you survive it. Plus combo-scaled effects, a mastered
> sound mix, one sun over every station, and easier-to-read comms.

---

## 1.0.3 — 2026-08-20

The baseline for this changelog. Earlier history lives in the git log.
