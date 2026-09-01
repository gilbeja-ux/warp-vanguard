# Changelog

One entry per released version, newest first. Each entry groups the changes by
what a player meets. The commit trail between two versions is
`git log <prev-tag>..<this-tag>`; this file is the readable digest of it.

---

## Unreleased

### Feedback — a private note to the developer
- **SYSTEM CONFIG → FEEDBACK.** The settings disc's bottom segment now carries
  **MY DATA · FEEDBACK**. Pick one of four subjects (a bug · an idea · too hard
  or too easy · something else), type up to 600 characters, send. Nothing is
  shown to another player and nothing comes back — the panel says so twice.
- **It is a disc**, wearing the same plate the pause disc and the high-score card
  wear, cast in by the ring. The two things you must know before you send stand
  outside the rim, one on each flank: *SENT WITH* on the left, *WE CANNOT REPLY*
  on the right. `discSegKeys` gained a one-key form for the CLOSE that runs the
  whole width of the segment.
- **CLOSE left the disc, and the gear took its job.** The settings panel is the
  pause disc wearing another door, and the pause disc's corner key both opens and
  closes it. Three ways out remain: the gear, a tap outside the disc, gamepad B.
- **A note written offline is held, not lost.** One slot, flushed on the next
  connection or when the panel is next opened, dropped unsent after a week.
- **What rides along** — app version, build stamp, sim id, platform, screen size,
  the stage last played, and the language. Named in the panel before the send.
  No name, no email, no reply address.
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

> **OWED BEFORE THE NEXT BUILD.** This ships nothing until both run:
> `supabase db push` (applies `20260901000000_feedback.sql`) and
> `supabase functions deploy send-feedback --use-api`. Until then the panel
> exists and every note goes to the outbox. This batches with the deploy already
> deferred from 2026-08-26 (see HOUSEKEEPING H-26).

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
