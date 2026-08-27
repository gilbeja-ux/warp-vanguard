# Housekeeping backlog

Every finding from the 2026-08-21 audit, one row per item, related findings
combined. The `/housekeeping` skill reads this file, offers the open items in
priority order, then walks the chosen one to a solution.

**Item IDs are stable. Never renumber them.** Priority equals the ID order:
H-01 is the most important, H-30 the least. Reorder by moving the priority note,
not the ID.

Status values: `TODO` → `IN PROGRESS` → `BLOCKED` → `DONE`.
When an item ships, set `DONE`, add the version and a one-line result.
`MERGED` means the item was folded into another one and is not worked here.
Its ID is never reused and its original finding is kept under its heading.

Full evidence and context live in [docs/AUDIT-2026-08-21.md](AUDIT-2026-08-21.md).

---

## Status board

| ID | Status | Area | Sev | Title |
|----|--------|------|-----|-------|
| H-01 | DONE | Release | HIGH | Removed as a backlog item — the verifier deploy is the standing pre-AAB routine |
| H-02 | DONE | Backend | HIGH | Boss board integrity — RNG side-stream + bounty decay in code; time tiebreak migration APPLIED LIVE 2026-08-25 with the 1.0.4 deploy |
| H-03 | DONE | Backend | HIGH | Replay-stealing closed — oracle fix + frame-hash binding + private traces bucket ALL LIVE 2026-08-25 with the 1.0.4 deploy |
| H-04 | DONE | Release | HIGH | Recover the deleted feature graphic — restored from HEAD 2026-08-21 |
| H-05 | TODO | Release | HIGH | Turn DEV_KEYS off for production builds |
| H-06 | TODO | Story | HIGH | **THE STORY LADDER** — the single story item. Absorbs H-17 and H-30. Fill the three dead rungs, line-edit the live one, drop the hints |
| H-07 | DONE | Story | HIGH | Pre-run read gate — circle-sweep reveal + inner charge ring + back button; built+tested 2026-08-21 |
| H-08 | DONE | Backend | MED | Weekly board fairness — deep surges press density past surge 6 (Gil: mutators stay legal) |
| H-09 | DONE | Release | MED | Name screened clear (docs/NAME-CLEARANCE.md) + opaque store icon built |
| H-10 | DONE | Balance | MED | Sawtooth fixed — C3 re-sloped, peak between C2 and C4; L7 softened after Gil's playthrough (ships in 1.0.4) |
| H-11 | DONE | Balance | MED | CHAIN OVERDRIVE pays ×scoreMul() AND advances the combo (ships in 1.0.4) |
| H-12 | DONE | Juice | MED | Combo-scaled kill effects + a PERFECT flash + a first-x10 beat |
| H-13 | DONE | Audio | MED | Audio mastering — master limiter over both buses + boss-dead re-trim + a pinned sfx level test |
| H-14 | DONE | Art | MED | Station sun aligned to LIGHT_A + hull darkened + placeholder limb fixed (ships in the next build) |
| H-15 | DONE | Journey | MED | Two arc keys flank the mode wheel — CONTINUE CONTRACT deep-links the frontier, CLAIM TO FAME launches the weekly (ships in the next build) |
| H-16 | DONE | Journey | MED | FLY THIS LANE shares the ring's bottom cap with Show my Run + a weekly retry pinned to its own week (ships in the next build) |
| H-17 | MERGED | Story | — | Folded into H-06 (2026-08-26, Gil's call) — the register pass is rung 2 of the ladder |
| H-18 | DONE | Story | MED | NEXT CONTRACT ▸ on the report + the bark fade fixed (countdown → H-15, dossier → H-06) |
| H-19 | DONE | Decision | MED | Canon settled — episodic contracts; address is Vanguard/vanguards, "runner" only as accent; wolves retired |
| H-20 | DONE | Audio | MED | Audio breadth — verdict tiers + NEW BEST stamp + unlock cue, enlistment/bark typewriters → per-glyph fade, phone-call interruption handler (Gil's cut: no boss-duel music, no sonar phase) |
| H-21 | DONE | Art | LOW | Menu stays grain-free — decision, no code (2026-08-24) |
| H-22 | TODO | Art | LOW | Gate facing variants |
| H-23 | DONE | Journey | LOW | Enlistment tap-to-complete — first tap completes the line, second advances; a dead tap was the real defect, not the wait |
| H-24 | DONE | Journey | LOW | Dead code deleted — scroll machinery, the whole ray-cannon subsystem, and the en.drift orphan; all 41 board ids unchanged |
| H-25 | DONE | Balance | LOW | All five items closed — Gil's live pass on the beats produced the power-up spacing law, the relief drop window, the carpet stand-down, the prism injector and a felt last stand |
| H-26 | DONE | Backend | LOW | Backend hardening — all three built (admin token gate, homoglyph-folding name filter, filed-report + trace residuals); the migration and both function deploys ride the next deploy |
| H-27 | DONE | Art | LOW | GATE aperture rebuilt (frame bug fixed + well + hoops); SPINE 18-pad preview declined by Gil, ribs stay |
| H-28 | DONE | Balance | LOW | Unused depth resolved by deletion — crawlers knob + noCharge drone removed (zero sim cost, all 41 ids unchanged); beat authoring folded into H-25 |
| H-29 | DONE | Docs | LOW | Doc drift swept — 10 stale statements across 6 files + 2 stale code comments; sim id moves (comments only), all 41 board ids unchanged |
| H-30 | MERGED | Content | — | Folded into H-06 (2026-08-26, Gil's call) — the disc art is the ladder's art rung, still deferred |
| H-31 | DONE | Balance | MED | Power-ups never land inside a dead-zone carpet — both spawners fixed + a pinned test (ships in 1.0.4) |
| H-32 | DONE | HUD | MED | Barks redesigned as a broadcast subtitle — tag on its own line, 13px wrapped message (F-012; ships in the next build) |
| H-33 | BLOCKED | Audio | MED | Boss audio realism — ray voice, charge and plates BUILT and Gil's ear pass PASSED; blocked only on the two CC0 takes he is sourcing |
| H-36 | TODO | Audio | MED | Ray takes still absent — ray-charge.mp3 and boss-plate.mp3 are declared but not on disk; the synth placeholder is what ships (H-33's blocker) |
| H-35 | DONE | Release | HIGH | Fingerprint fixed (BATTERY_V 2: immortal pilot + pickups recorded, 40/40 boards play out) AND the skip-the-deploy shortcut retired on Gil's rule |
| H-34 | DONE | Art | MED | Boss lamp misled — the resting phase breathed into the LAST STAND's violet; now red → near-black ember, brightness only (Gil, 2026-08-27) |

---

## H-01 · Redeploy the stale verifier + add a CI staleness guard
- **Status:** DONE (2026-08-21) — removed as a backlog item on Gil's call. The verifier deploy + `db push` happen at EVERY AAB build as the standing pre-version gate (see the ⏰ note below and [[verifier-deploy-before-aab]]), so it is routine, not backlog. The CI staleness guard was dropped with it.
- **Combines:** R-1, backend OP item
- **⏰ PRE-VERSION DEPLOY GATE (Gil, 2026-08-21):** before any new version / AAB, run
  BOTH `npm run deploy:verifier` AND `supabase db push`. `deploy:verifier` also
  deploys the submit-run function, so it carries H-03's server changes too. 1.0.4
  applies TWO migrations via `db push`: `20260821000000_boss_board_time_tiebreak.sql`
  (H-02) and `20260821000001_trace_owner_binding.sql` (H-03). Gil pre-authorized
  running both commands automatically when he asks to create the 1.0.4 AAB — do them
  first, then build, no re-ask.
  ⚠ Caveats to voice once at 1.0.4 build time: (1) both migrations are untested
  against a live DB — check staging first if one exists; (2) H-03's migration takes
  the traces bucket PRIVATE, which breaks replay playback on OLD clients the instant
  it lands, so it MUST ship with the 1.0.4 client, never ahead of it. Also in memory
  [[verifier-deploy-before-aab]] and docs/RELEASE-PLAN.md §5.
- **Issue:** the deployed verifier grades a different game than the code. Local sim id `eee9f0f3f2ae`, server `6393ccefe431`. Commit c8945d7 changed sim source after the last deploy. Every campaign/weekly submission fails until you redeploy.
- **Evidence:** `npm run verifier:status`; `.github/workflows/test.yml` builds the bundle but never checks staleness.
- **My take:** redeploy now, then make CI fail a release when local ≠ server so this cannot recur silently. Deploy only when a score actually moved; a render-only change needs no deploy.
- **Options:** (a) redeploy only; (b) redeploy + add the CI guard; (c) redeploy + CI guard + decide the current-plus-previous sim-id acceptance policy for live clients.

## H-02 · Boss board integrity — seed the boss RNG + add anti-stall
- **Status:** DONE (2026-08-25) — the owed deploy shipped with the 1.0.4 release gate: `npm run deploy:verifier` (server sim id `bfbd7a2099d8`, IN SYNC) + `supabase db push` applied `20260821000000_boss_board_time_tiebreak.sql` to the live DB. End-to-end proven: a real recorded run submitted to the deployed function verified and ranked. · **Area:** Backend/Balance · **Sev:** HIGH
- **Progress (2026-08-21):**
  - DONE in code — the RNG side-stream. A `bossRng` (mulberry32, seeded per boss from levelIdx) now feeds every score-relevant boss draw via `bRand`/`bChance`/`bCoin` (`52-bosses.js`). Cosmetic particle draws (52-bosses.js:213,812,872) stay on Math.random. `spawnRng` is untouched, so only the 5 boss boards' sim ids move.
  - DONE in code — the bounty decay. `bossStallMul` decays the swarm-kill take after 30 kills without a boss hit, floor 0.1; a landed pulse resets `boss.stallKills` (`52-bosses.js` + `72-tick.js:885`).
  - VERIFIED — `npm test` green; verifier bundle rebuilt (new sim id `63ad3a364ab9`) and reproduces every non-boss score; a boss-level record/verify passes for all 5 campaigns and is deterministic across two records.
  - DONE in SQL (not applied) — the faster-run tiebreak. Gil chose the tiebreak over a full time penalty. Migration `supabase/migrations/20260821000000_boss_board_time_tiebreak.sql` adds `time_sec asc` before `created_at` for boss boards ONLY (keys ending `:7`, not weekly), in all 3 ranking sites (leaderboard_top, leaderboard_rank, submit_verified_run eviction) so the invariant holds. Non-boss boards are byte-identical. The client reads rank from these RPCs, so no game-code mirror is needed. Correction to the audit: boss board keys are `<campId>:7` (per-campaign index), not 7/15/23/31/39.
  - OWED before release (batched, one deploy): (1) `npm run deploy:verifier` — the RNG+decay move the 5 boss-board sim ids; (2) `supabase db push` to apply the tiebreak migration. The migration is NOT tested against a live DB (the local harness cannot run these functions) — review against staging first. Nothing was deployed or pushed here.
- **Combines:** A-1, A-4
- **Issue:** the five boss boards reject honest scores AND are farmable. Boss logic draws score-relevant randomness from render-contaminated `Math.random`, not the insulated `spawnRng`, so a rendered fight and the headless re-simulation diverge. Separately, swarm waves respawn forever and pay full combo bounties, so a stalling player scores about 1.5k/s without bound.
- **Evidence:** `52-bosses.js:285,317,329,330,333,405,409`; `72-tick.js:884,912`; verifier exact match `submit-run/index.ts:214`.
- **My take:** fix both in one release, since both move the boss-board sim ids anyway. Route all boss RNG through a dedicated seeded side stream (the `beatStream` pattern). Then decay swarm bounty after round N, or make `timeSec` a ranking penalty on boss boards. Redeploy the verifier with it (ties to H-01).
- **Options:** (a) RNG fix only, leave boards as-is on stall; (b) RNG fix + bounty decay after round N; (c) RNG fix + `timeSec` tiebreak penalty; (d) RNG fix + both anti-stall guards.

## H-03 · Close the replay-stealing hole
- **Status:** DONE (2026-08-25) — the coordinated deploy shipped with the 1.0.4 release gate: `supabase db push` applied `20260821000001_trace_owner_binding.sql` (traces bucket now PRIVATE) and `deploy:verifier` carried the submit-run changes. The storage-privacy battery re-ran against the live project after the push: all 5 checks pass. Known cost, voiced and accepted: old clients lose replay playback until they update to 1.0.4. · **Area:** Backend · **Sev:** HIGH
- **Combines:** A-2, the 400-body oracle leak
- **Progress (2026-08-21) — all code DONE, built and linted:**
  - Oracle fix — the 400 "verification failed" body no longer returns `recomputed`/`integrity`/`steps`/`claimed`/`traceLen` (`submit-run/index.ts`). The client keys "score not verified" off the `error` string, so its handling is unaffected.
  - Frame-hash binding — submit-run SHA-256s the input frames, refuses a submission whose frames already belong to a different player (403), and stamps the hash on the winning row. New column + index in migration `20260821000001_trace_owner_binding.sql`. No ranking-function change (check before write, stamp after).
  - Private bucket + signed URLs — the migration takes the `traces` bucket private; submit-run gained a `trace-url` action that mints a 60s signed URL; the client `lbTrace` now fetches through it (`31-leaderboard.js`). Watching any replay still works; the bucket can no longer be bulk-downloaded.
  - VERIFIED locally: `npm run build` + `npm test` green (BOARD BOOTS); `deno lint` parses the function clean (only pre-existing `no-explicit-any` style warnings).
  - HONEST LIMITS: the hash binding is evadable by perturbing one no-op input frame (the private bucket is the real barrier); no fix proves a human played a run (audit F3).
  - LIVE STORAGE TEST PASSED (2026-08-21) — `node scripts/test-storage-privacy.mjs` proves against the LIVE project, via a scratch private bucket (created + deleted by the script, `traces` untouched, no deploy): anonymous reads denied on the /public/ path and the direct path; a service-role 60s signed URL serves the object to an anonymous fetch byte-for-byte; an expired signed URL is refused. All 5 checks pass. Re-run it after the 1.0.4 `db push` flips `traces` private. Storage quirks the script codes around: a nonexistent-bucket DELETE answers 400 not 404; the single-object DELETE path silently does nothing (use the batch `prefixes` remove, as submit-run does); bucket delete lags the object delete (retry).
  - OWED before release (batches into the 1.0.4 deploy): `npm run deploy:verifier` (which also deploys the submit-run function) + `supabase db push` (applies this migration). ⚠ COORDINATED: the instant the bucket goes private, OLD clients lose replay playback — ship it WITH the 1.0.4 client, never ahead.
- **Issue:** the `traces` bucket is world-readable and nothing binds a trace to its recorder. An attacker downloads a top trace, brute-forces `w/h` + `mutators` against the reproducible sim, and resubmits under their own identity. It verifies and lands. The 400 error body even returns `recomputed`/`integrity`/`steps` as a brute-force oracle.
- **Evidence:** public `traces` bucket; `31-leaderboard.js:99`; `submit-run/index.ts:214`.
- **My take:** bind identity to the trace and stop leaking the oracle. Both are small server changes.
- **Options:** (a) stamp the stored trace with `player_id` + `w/h` + `mutators`, reject a submission whose JWT `sub` differs; (b) dedupe by trace content hash so a trace verifies once; (c) make the bucket private, serve replays by signed URL (the original setup design); (d) do (a) or (b) now, plus stop returning `recomputed`/`integrity`/`steps` in the 400 body.

## H-04 · Recover the deleted feature graphic
- **Status:** DONE (2026-08-21) — `git restore -- docs/store/feature-graphic.png`. Working tree now matches HEAD: a valid 1024×500 8-bit RGB PNG (579,409 bytes, no alpha, the Play spec). No build or deploy involved. If a redesign is ever wanted, re-shoot via `scripts/shot-feature.html`. · **Area:** Release · **Sev:** HIGH
- **Combines:** R-2
- **Issue:** `docs/store/feature-graphic.png` is deleted in the working tree, not committed. It is a required Play asset. It is intact in HEAD.
- **Evidence:** `git status`; `git show HEAD:docs/store/feature-graphic.png` is a valid 1024×500 PNG.
- **My take:** confirm the deletion was not deliberate, then restore. If a re-shoot was intended, regenerate from `scripts/shot-feature.html`.
- **Options:** (a) `git restore -- docs/store/feature-graphic.png`; (b) re-shoot via the rig, then commit; (c) leave deleted because a redesign is planned.

## H-05 · Turn DEV_KEYS off for production builds
- **Status:** TODO · **Area:** Release · **Sev:** HIGH (prod only)
- **Combines:** R-3
- **Issue:** `DEV_KEYS = true` ships a long-press boss-skip. Fine for tester builds. It must be off before production, and it will cross the relay-04 paywall when monetization lands.
- **Evidence:** `40-state.js:148`; `startBossTest` `60-input.js:718`; `menuHold` `99-boot.js:198`.
- **My take:** do not flip it globally now, since testers use it. Gate it to the release build and add it to the pre-production checklist.
- **Options:** (a) flip to `false` now; (b) wire it to a build flag so `sideload`/release forces it off; (c) leave it, add a hard checklist gate before the production AAB.

## H-06 · THE STORY LADDER — the one story item
- **Status:** TODO · **Area:** Story · **Sev:** HIGH (value)
- **Combines:** S-1, S-4, S-5 · **absorbs H-17** (register pass + C5 fork) and **H-30** (the 40 disc keyframes) · **inherits H-18's** dossier client/cargo sub-item
- **MERGED 2026-08-26 on Gil's call:** every story finding is one item now, because they are four rungs of one delivery ladder and fixing them separately hides the shape.

### The ladder — what exists, and what a player actually sees

| Rung | Cadence | Field | Written | State |
|---|---|---|---|---|
| 1 · contract dossier | 5× | `campaign.story` paragraph | 5 paragraphs | **DEAD** — no consumer anywhere in `src/game/` |
| 2 · pre-run disc | 40× | `level.story.line` | 40 lines | **LIVE** — the only rung a player sees |
| 3 · in-run channel | reactive, 4–6/run | `BARKS` in `83-deepfield.js:710` | 14 triggers | LIVE |
| 4 · verdict epilogue | 5× | `verdict.lines` | 5 × 4 lines | **DEAD** — loses to `verdict.line` |

The diagnosis in one comparison. Contract 01 currently ends on *"Good job! The system's economy is now booming!"* One `||` away sits *"Eight legs, one hold, nothing lost. / The consortium paid on arrival and / asked no questions about the wreckage / we left in the lane behind us."*

**The format is not the problem.** Gil asked whether a better delivery exists (2026-08-26). It does not, and the one-liner stays: a 40–60s leg with both thumbs occupied cannot carry more, and `91-briefing.js:412` already states the rule — *one thing said per mission; the in-run comms carry the scene from here* — which is correct. The story reads thin because the one live rung carries the weakest writing while the strongest sits unrendered. **Fill the ladder, do not replace it.**

### FINDING THAT REVERSES THE OLD PLAN — the 39 hints stay dead
The original H-06 said to wire all 40 level `hint` strings. **Do not.** The reactive barks already say the same thing at a better moment:

| `hint` (dead) | bark (live) |
|---|---|
| `NEW THREAT: heavy armor — dock both emitters and HOLD` | `armor inbound. both emitters.` |
| `NEW THREAT: barrier lines — one emitter on each end` | `barrier strung. take an end each.` |
| `NEW THREAT: dead zones — the rail closes, route around` | `wall forming. reroute.` |

`docs/IN-RUN-VOICE.md` deleted 113 scripted lines for exactly this reason, and wiring the hints onto the disc would break the one-thing-per-mission rule as well. Only **two** threat debuts have no bark — paired traffic (C1 L02) and phase-lock (C1 L07) — so the real work is two bark triggers, not 39 revived strings. The hints stay in `campaigns.js` as the Lane Designer's own authoring note.

### The work, rung by rung
1. **Rung 4 — the verdict epilogue.** One precedence change at `91-briefing.js:515`: `const body = c.line || (c.lines || []).join(' ')` prefers the weak line. Prefer `lines`. The closure disc was built with room for it (`isClosure`, no readings band). **Cheapest win in the codebase.**
2. **Rung 1 — the contract dossier.** Wire `campaign.story` onto the contract disc / carousel. This delivers H-18's owed client and cargo with it — no new authored field.
3. **Rung 2 — the register pass (was H-17).** One Lane Designer pass to a single register across the 40 shown lines, using the survey campaign as the model. Fix the mechanical defects and the C5 fork ("president … she" vs "minister of Xeno Relations", plus the "antidote" leftover from the retired virus fiction). Evidence: `campaigns.js:55,95,150,167,234,243,244`. **Aim higher than tone:** make the eight legs of a contract CONTINUOUS, so leg 08 pays off leg 01, instead of 40 isolated captions. Canon is settled (H-19 DONE), so nothing gates this.
4. **Rung 3 — two missing barks.** `firstDouble` and `firstColor`, matching the existing terse-ops voice and the draw-only / counter-not-roll rules in `IN-RUN-VOICE.md`.
5. **Art rung (was H-30) — still deferred.** 0 of 40 per-mission disc keyframes exist; `src/art/disc/` holds only the enlistment and the 5 verdicts, spec in `DISC-ART-SPEC.md`. The destination glam-shot fallback is good by design and covers it. Revisit only after rungs 1–4 land.
- **Options:** (a) rung 4 only — the one-line precedence fix; (b) rungs 4 + 1 + 3 — every code change, no writing; (c) rungs 4 + 1 + 3 + 2 — the full ladder including the register pass, art still deferred; (d) all five, commissioning the 40 keyframes.

## H-07 · Give the pre-run briefing a read gate
- **Status:** DONE (2026-08-21) — Gil's design, iterated with him. On a BRIEFED deploy the pads stay hidden while the disc's story line reveals, then each console is uncovered by a WEDGE that sweeps around from the top — right pad clockwise, left counterclockwise — bringing in the ring, the OFFLINE label, the PLACE THUMB dot, AND the inner pulse-charge track ring (added on Gil's note; the live meter is otherwise held back pre-warp). The grip-release waits until the pads land, so an instant gripper still reads the line; the demo thumb-ghosts return at their normal 1.4s. A BACK arrow (top-right, gamepad B) exits the pre-warp disc to the lane chart. Unbriefed starts (retry/endless/weekly) are untouched. Files: `70-update.js` (`showCard` reveal time, `padsRevealT`/`padsLanded`), `85-enemy-art.js drawDials` (wedge + inner ring), `72-tick.js` (release gate), `90-hud.js` (back button + ghosts), `60-input.js` (`discBack` + touch), `71-gamepad.js` (B). NO sim/replay/deploy impact (pre-run timing + chrome only). `npm test` green (two harness helpers advance past the gate for pre-warp discs only). Tunable: `PADS_IN_DUR` 0.5s. The pulse orbs (`drawPulseOrbs`, gated in `85-enemy-art.js` drawNodes) were leaking empty charge rings at the pads during the come-up while `hw` was still nonzero; they are now held back until `padsLanded` too. Verified by driving a headless Chrome (puppeteer-core + system Chrome) to the real pre-warp screen and capturing the come-up frame by frame. Owed: a device eyeball on the sweep feel. · **Area:** Story · **Sev:** HIGH
- **Combines:** S-2
- **Issue:** both thumbs dismiss the pre-warp disc in 0.35s while a line takes about 1.2s to fade in. A player who does what the screen asks sees zero campaign story.
- **Evidence:** `72-tick.js:89`; `60-input.js:109`; `91-briefing.js:385`.
- **My take:** a soft gate, not a modal stop. Hold the grip-dismiss until the caption's char-fade completes, or keep the line on screen through the warp spool.
- **Options:** (a) hold dismiss until the char-fade finishes; (b) keep the line visible through the warp spool after dismiss; (c) both, tuned so a returning player still launches fast.

## H-08 · Weekly board fairness — lock out mutators + raise the ceiling
- **Status:** DONE (2026-08-21, ships in 1.0.4) — Gil chose the ceiling raise ONLY; mutators stay legal on the weekly board (the mutator lockout and the segment idea are both rejected, do not reopen). DEEP SURGES: past surge 6 each 100s step now presses density (+9%/step, capped ×1.8) and the type mix (per-knob caps; lines+heavies stay under one shared roll) in `endlessCfg` (`30-campaigns.js`), pure in t so weekly stays deterministic. Every deep surge announces like a speed surge — countdown, popup 'DEEP SURGE', HUD header 'PRESSURE RISING' past 6 — and the surge-relief health pickup keeps riding in (`72-tick.js`, `90-hud.js`). `npm run build` + `npm test` green. Sim id moved to `81d7b26d0443`; the standing pre-AAB deploy carries it. · **Area:** Backend/Balance · **Sev:** MED
- **Combines:** A-3, A-5, C-4
- **Issue:** the weekly board mixes mutator runs (up to ×3.9) with plain runs, so the meta forces mutator stacking. And endless/weekly difficulty plateaus near mid-campaign, so the ranked week is an endurance contest, not a skill wall.
- **Evidence:** `mutLive` needs endless `10-audio.js:21`; server never filters `submit-run/index.ts:243`; `endlessCfg` caps at surge 6 `30-campaigns.js:37`.
- **My take:** ship at a week boundary so frozen boards stay untouched. Force mutators off in `startWeekly` (no sim-id impact) and let surges 7+ keep raising density and mix.
- **Options:** (a) mutators off only; (b) raise the ceiling only; (c) both, at a week boundary; (d) segment the board by mutator instead of forcing off.

## H-09 · Clear the name + resolve the icon alpha
- **Status:** DONE (2026-08-21, no version — docs + one asset, nothing ships in the app). Name: a web screening found NO exact collision for "Warp Vanguard" on Play / App Store / Steam / itch.io / USPTO-as-indexed; every "Vanguard" near-mark rates LOW. Full record + caveats in docs/NAME-CLEARANCE.md; STORE-LISTING.md §6 updated. Standing rule: never brand with bare "Vanguard" (collides with Activision, Riot, Bushiroad, Vanguard Group) — use "Warp Vanguard" or "WV". This was a screening, not an attorney search; re-screen at launch. Icon: `docs/store/wv-512-store.png` is the Play upload — the badge composited on opaque `#03060e`, 512×512, 32-bit RGBA with every alpha byte 255. `src/icons/wv-512.png` keeps its transparency for the PWA. · **Area:** Release · **Sev:** MED
- **Combines:** R-6, R-7
- **Issue:** name clearance for "Warp Vanguard" / "Vanguard" is unrun and gates all store copy plus the feature-graphic wordmark. The 512 icon has an alpha channel; the Play spec is 32-bit no alpha.
- **Evidence:** `STORE-LISTING.md` §5, §6; `src/icons/wv-512.png`.
- **My take:** run the search before investing more in copy. Settle the icon at the first Console upload; a flattened variant on opaque `#03060e` is the fallback.
- **Options:** (a) name clearance first; (b) icon alpha first; (c) both together as a "first Console upload" gate.

## H-10 · Fix the sawtooth break between campaigns 2 and 3
- **Status:** DONE (2026-08-22, ships in 1.0.4) — Gil chose the full C3 re-slope. All 7 non-boss C3 levels retuned in `src/campaigns.js`; the boss level is untouched. Metric (mirrors the sim: mean spawn rate × band intensity × speed × (1 + mix cost)) now climbs 1.69 → 4.70 → **5.30** → 6.68 → 10.45 across the campaigns; before, C3 peaked at 3.97 under C2's 4.70. Both C3 lane families climb inside the campaign (reading lanes 0.84 → 1.22 → 1.44; current lanes 2.51 → 3.41 → 4.49) and the L7 finale is now the campaign peak (was below L6). Level identity kept: only windows, speeds, and band intensities moved, plus one closing band on L7 (58–72s @2.2) and walls 0.18 → 0.15 on L5 (the linter's wall-carpet law forced it; L7 keeps 0.18 via a 0.54 window found by a clean-lint sweep). `npm run build` + `npm test` green (751 PASS); lintCampaign clean on all five. FEEL PASS (2026-08-22): Gil played all of C3 — good, except L7 was too hard versus its neighbours. Softened on his call: colors 0.40 → 0.32 (fewer keyed enemies) and the closing band 2.2 → 2.1; peak now 4.91 (was 5.30), still above C2's 4.70 and a gentler step from L6's 4.49. The 0.28/0.30 colors variants FAIL the wall-carpet lint at t≈43.8 — 0.32 is the floor for this config; to go softer, retune the window too (the sweep scripts live in the session scratchpad). `npm test` green (751 PASS); sim id now `2f9f5189dcd8`, carried by the standing pre-AAB deploy. Owed: Gil re-checks L7 on device. · **Area:** Balance · **Sev:** MED
- **Combines:** C-6
- **Issue:** the difficulty-3 campaign never exceeds the difficulty-2 peak. Computed non-boss peaks: C1 1.89 → C2 3.63 → C3 3.17 → C4 5.28 → C5 8.03.
- **Evidence:** `campaigns.js:96-119` vs `139-170`.
- **My take:** nudge C3L6/L7 spawn/speed just past C2L7. Moves those two board ids, so batch with the next sim-id release.
- **Options:** (a) raise C3L7 only; (b) raise C3L6 and C3L7; (c) re-slope all of C3's climb.

## H-11 · Make CHAIN OVERDRIVE pay the combo multiplier
- **Status:** DONE (2026-08-22, ships in 1.0.4) — Gil chose option (b): pay ×`scoreMul()` AND advance the combo. The chain block in `72-tick.js` now mirrors the volley's law (F-003): `combo++` with the full maxCombo bookkeeping, then `cpts = Math.round(cb * 0.5 * mutMul()) * scoreMul()`; the popup shows the multiplier past combo 3. The 0.5 haircut stays — the arc aims itself, so it pays half base. No RNG touched; only scores move. `npm run build` + `npm test` green (752 PASS). Sim id moved to `20a7250eb27b`; the standing pre-AAB deploy carries it. · **Area:** Balance · **Sev:** MED
- **Combines:** C-5
- **Issue:** a chained kill pays base×0.5 with no combo credit. At combo 10 it pays 50 where interception paid 1000–2000, so the pickup is score-negative for score-chasers. This is the same trap the volley just escaped in F-003.
- **Evidence:** `72-tick.js:954`.
- **My take:** pay chained kills ×`scoreMul()`, mirroring the volley fix. Moves ids on every board where the bag can appear, so batch into a sim-id release.
- **Options:** (a) pay ×`scoreMul()`; (b) pay ×`scoreMul()` and advance the combo; (c) leave as a defensive-only tool and document it.

## H-12 · Combo-scaled kill effects + a PERFECT flash + a first-x10 beat
- **Status:** DONE (2026-08-21, ships in the next build) — all three landed. (1) Kill effects scale with `scoreMul()`: `kM = 1 + 0.07·(mul−1)` (x10 → 1.63) widens the rim flash, fattens/brightens the kill comet (`spawnKillStreak` gained a `mul`), and grows the decompile wash (`72-tick.js`, `52-bosses.js`, `99-boot.js`). (2) A PERFECT adds a white-gold rim ping (`w:1.8`) at each firing angle plus a hot spark at the impact. REWORKED on Gil's feedback (the fat round-capped stroke read as a white box behind the emitter): the rim flash is now a thin white-hot filament plus a soft halo, both painted through a radial gradient centred on the hit angle, so the light falls off along the band with no edge and no cap; `w` buys brightness and reach, never thickness. The x10 sweep's lip was thinned to the same filament language. Verified with headless-Chrome screenshots at kill angles (the emitter's own `recoil` flare carries the on-emitter flash; the rim light is the spill). (3) The first x10 of a run fires a one-shot golden sweep — two fronts race from the kill angle around the band and meet far side (`drawBandFX`), with an 'OVERDRIVE x10' popup, a two-tone chime and haptics; `x10Seen` re-arms in the run reset (`60-input.js`). RENDER-ONLY, PROVEN: the behavioral battery was run on a scratch copy with these edits reversed — all 41 board ids identical, so scores are untouched and no deploy is owed beyond the standing pre-AAB gate (the source-hash sim id moved to `a7e5132d9f02`, as any source edit does; the 1.0.4 deploy already carries it). `npm run build` + `npm test` green. Owed: a device eyeball on the sweep + comet feel; `kM`'s 0.07 slope and the 1.1s sweep are the tuning knobs. · **Area:** Juice · **Sev:** MED (production value)
- **Combines:** art findings 1, 2
- **Issue:** at x10 the kill burst is byte-identical to x1. PERFECT differs only by popup text. The scoring system is invisible in the world.
- **Evidence:** `72-tick.js:875-970`; `40-state.js:36`; `52-bosses.js:890`; `99-boot.js:1133`.
- **My take:** highest visible-impact-per-effort item. Scale kill-streak/rim intensity with `scoreMul()`, add a white rim ping at the zap angle for a PERFECT, and give the first x10 a one-shot ring flourish.
- **Options:** (a) combo-scaled burst only; (b) + PERFECT flash; (c) + first-x10 beat; (d) all three.

## H-13 · Audio mastering — master limiter + music through the compressor
- **Status:** DONE (2026-08-22, ships in the next build) — Gil chose (c). (1) A master limiter now sits at the destination (threshold −2 dB, knee 0, ratio 20, attack 1 ms, release 100 ms) and EVERY bus exits through it via `masterBus()`: the sfx compressor chain (`10-audio.js`), the music bus + the crossfade reroute (`11-music.js`), and the splash score (`99-boot.js`). The sfx glue compressor is unchanged in front of it; music was deliberately NOT routed through the sfx compressor (4:1 at −18 would pump the track under every spike). (2) RE-TRIM CORRECTION: measurement (ffmpeg ebur128 true peak) shows boss-ARRIVAL is NOT over full scale (−0.2 dBFS; its 52-bosses comment is corrected) — the clipping take is boss-DEAD at +0.8 dBFS, also the loudest thing in the game at −10.5 LUFS. Its trim went 1.0 → 0.85 (peak −0.6, still the ceremonial loudest); `fail` (+0.1 dBFS) went 1.0 → 0.95. (3) Gil's mid-run ask — ALL sfx measured and pinned: new `scripts/test-sfx-levels.mjs` runs in `npm test`, parses the live SFX_FILES trims, and FAILS on any take that true-peaks over full scale at its shipped trim; it also prints a loudness board (integrated LUFS at trim, loud-first) that informs but never fails. No ffmpeg → clean SKIP, so CI stays green. Render-only, no score moves; the standing pre-AAB deploy covers the source-hash id as always. Board notes for later ears: `pulse` (the player's own shot, −11.5 LUFS eff) out-louds every ceremony, and `hit` (the kill confirmation, −20.1) sits ~8.6 LU under it — a deliberate-or-not gap Gil may want to audition; `warpIn` stays device-settled, untouched. `npm run build` + `npm test` green (789 PASS). Owed: a device listen for the limiter feel on a dense wave. · **Area:** Audio · **Sev:** MED (production value)
- **Combines:** audio HIGH finding
- **Issue:** no limiter sits over the summed output, and music bypasses the sfx compressor. Boss-arrival is mastered hot and peaks above full scale.
- **Evidence:** `11-music.js:241`; `52-bosses.js:87`.
- **My take:** one graph change tames the hot bed and dense-wave stacking. Route `musicGain` through the existing compressor, or add a second one at destination.
- **Options:** (a) route music through the existing compressor; (b) add a dedicated master limiter at destination; (c) both, and re-trim boss-arrival gain.

## H-14 · Align the station sun to the world key light + darken the hull
- **Status:** DONE (2026-08-23, ships in the next build) — Gil chose sun alignment + darken the hull one step. (1) `S3D_LIGHT`'s sun is now `lx:-0.32, ly:0.02, lz:0.95` — through the bake camera (screen up = y·sin(el)+z·cos(el)) it projects to LIGHT_A's ~68° up-left, so stations and planets share one sun; the grazing quality is kept in the toward-camera component (~0.49, unchanged). The fill light rotated with it (`filX:0.47, filY:0.32, filZ:-0.82`) so the bounce still rises into the unlit half. A constraint comment pins the projection law at the dial. (2) `hull`/`hull2` albedos went one step down (×0.8: `[101,105,112]` / `[72,76,83]`), toward the matte-near-black rule. (3) BONUS FIND, fixed: `s3placeholder`'s lit limb used `−lx,−ly` — opposite the bake's sun and blind to the camera basis; it now projects the sun properly, so the placeholder agrees with the sprite that replaces it under ANY sun. VERIFIED: a headless bake harness (scratchpad `render-stations.js`, no browser, stubs the canvas per the headless-art-preview method) rendered all five endpoint builds before and after — all five differ, all five now light from the upper left with a darker hull; TRUSS/FORT/PORT read best, SPINE is moodiest but holds its silhouette on rim light + lamps. Render-only (draw-side files; no spawn/score path touched); the standing pre-AAB deploy covers the source-hash sim id as always. `npm run build` + `npm test` green (794 PASS). Owed: Gil's eyeball on device or in the dest lab (8011 drives these dials live); SPINE's darkness is the one to judge. · **Area:** Art · **Sev:** MED (production value)
- **Combines:** art findings 2, 6
- **Issue:** stations bake under `S3D_LIGHT` (screen-left, ~17° up); planets and enemy plates use `LIGHT_A` (~68° up). The arrival frame shows two suns, with the companion standing in front of the world. The hull also renders mid-grey, above the "matte near-black" rule.
- **Evidence:** `80-tunnel.js:790`; `41-geometry.js:22`; `81-station3d.js:348`. Confirmed in the renders.
- **My take:** rotate `S3D_LIGHT`'s azimuth to match `LIGHT_A`, keep the grazing elevation, rebake. Decide the hull value deliberately rather than inherit it. The dest lab drives these dials live.
- **Options:** (a) sun alignment only; (b) + darken hull/hull2 one step; (c) alignment + accept the sunlit hull as the stations' own read, documented.

## H-15 · Home "re-enter lane" continue + a live weekly caption
- **Status:** DONE (2026-08-23, ships in the next build) — Gil's design, built and proven headless. Two arc keys OUTSIDE the mode wheel on a bigger circle (`SIDEKEY_*` dials, `drawHomeSideKeys` in `92-guide.js`), opposing left/right, in the slices' annular-sector language — LANDSCAPE slabs on Gil's iteration (radially wide `1.02R→1.50R`, angularly short `±0.34`), so every text row sits horizontal. LEFT · CONTINUE CONTRACT: contract key art up top, the next destination's disc-world sprite below (same family as the briefing disc, `planetVariantFor`), the verb + `TITLE` + `STAGE NN` rows between; tap → `switchCampaign` + relay map with the frontier selected (proven: mid-C1 save lands on THE CARGO RUN L06, DEPLOY one tap away). `homeContractTarget()` owns the offer: fresh save → START CONTRACT (C1 L01); lastCamp cleared → the first undelivered contract; ALL delivered → PERFECT THE LANE (lowest sub-3-star lane). RIGHT · CLAIM TO FAME: a baked run shot behind (`src/art/menu/claim-fame.webp`, cut from a live headless weekly run; loader in `95-menu.js`), rim caption `WEEKLY LANE · CLOSES <local end date>` off `weekEndMs`; tap → launches the weekly pre-warp directly (same `b.weekly` launch as the flow wheel); FREE FLOW locked → greyed + `CLEAR STAGE 05 TO UNLOCK`. Gamepad (Gil's call): LB fires CONTINUE CONTRACT and RB fires CLAIM TO FAME, home screen only — the carousel's LB/RB slide is untouched (separate `padPrev` keys) — and the slabs are OFF the focus walk entirely: stick-pointing skips `sector.outer` and so does `gpMove`, so the stick and d-pad own the wheel alone. LB/RB badges ride the slab corners once a controller speaks; a locked slab stays bare and its bumper falls silent. Six pins in scripts/test.js (focus never lands on a slab; LB → relay map at the frontier; RB → weekly launch). Menu-chrome only — no sim/score path touched, no verifier deploy owed beyond the standing pre-AAB gate. `npm run build` + `npm test` green (ALL TESTS PASSED). Gil approved the claim shot (frame A: two interceptors under fire over the bore) and called the landscape reshape; previews live in docs/parked/h15-preview/ (delete after the device pass). Owed: Gil's device eyeball on the slabs. · **Area:** Journey · **Sev:** MED
- **Combines:** journey findings 2, 3
- **Issue:** every session is splash → home → CONTRACTS → dive → DEPLOY, though `lastCamp` and the frontier are persisted. The home weekly caption is static, so the daily reason to return is buried two screens deep.
- **Evidence:** `40-state.js:178`; `92-guide.js:938`.
- **My take:** add a "RE-ENTER LANE" key on home that deep-links to the frontier, and make the FREE FLOW caption dynamic ("week ends in 2d · streak 3").
- **Options:** (a) re-enter key only; (b) dynamic caption only; (c) both.

## H-16 · Board dead-end — FLY THIS LANE + weekly-retry rollover fix
- **Status:** DONE (2026-08-23, ships in the next build) — option (c), both. (1) FLY THIS LANE: a key in the ring's BOTTOM cap, beside Show my Run (Gil's call after a first top-cap draft: the key shares the cap, the two split the chord side by side — FLY left, Show my Run right — and whichever is alone sits centered; the chord is measured at the text line inside the band's inner edge so neither label is clipped). `boardLane()` in `93-board.js` gives the selected board its law: endless → `startEndless` (gated by `flowUnlocked()` like the wheel); weekly → `startWeekly(week)` — a closed week reads PRACTICE THIS LANE, flies as practice, files nothing; campaign → `switchCampaign(ci)` + `startLevel(li, true)` when that relay is unlocked. A locked lane draws the key dimmed with no button behind it. The tap reuses the BACK turn (`boardOut` with an `action`, completed in `99-boot.js`) so the ring turns out and the lane starts at the end of the turn. (2) Rollover pin: both restart sites (`60-input.js` END retry, `91-briefing.js` pause restart) now call `startWeekly(weeklyIdx)` — a retry after the Monday rollover stays on the week it just flew, as a practice lane, instead of silently restarting on the new week's seed. PINNED in scripts/test.js (13 checks): no button while FREE FLOW is locked; the live and a closed week offer the key; it sits below the ring's center; with my run on the board the two keys share one cap, side by side, no overlap; the tap arms `boardOut` with an action and the selected week starts; a retry across a moved clock keeps `weeklyIdx` and `weeklyLive()` is false; a campaign board offers the key for an unlocked relay and nothing for a locked one. Seen in headless Chrome: locked, live, closed, campaign, and the shared cap. Menu chrome only — no sim/score path moved, no deploy owed. No gamepad binding, matching Show my Run. `npm run build` + `npm test` green (ALL TESTS PASSED). · **Area:** Journey · **Sev:** MED
- **Combines:** journey findings 5, 6
- **Issue:** the board opens on the live weekly while FREE FLOW is locked, with no way to play the lane from it. And a weekly retry across the Monday UTC rollover restarts on the new week's lane.
- **Evidence:** `93-board.js:62`; `60-input.js:516`; `startWeekly` `60-input.js:779`.
- **My take:** add a gated FLY THIS LANE key to close the browse→play loop, and pin a weekly retry to its own week when still live.
- **Options:** (a) FLY THIS LANE only; (b) rollover pin only; (c) both.

## H-17 · Story line-edit pass + the C5 continuity fork
- **Status:** MERGED INTO [H-06](#h-06--the-story-ladder--the-one-story-item) (2026-08-26, Gil's call) — it is rung 2 of the ladder. Do not work it here; the detail below is kept as the original finding. · **Area:** Story · **Sev:** MED (no code)
- **Combines:** S-4, S-5
- **Issue:** shown lines mix terse-ops with tour-guide ("So far so good! Let's keep it up."). Mechanical defects sit in shown strings. C5 forks on a shown surface: "president … she" vs "minister of Xeno Relations", plus an "antidote" leftover from the old virus fiction.
- **Evidence:** `campaigns.js:55,95,150,167,234,243,244`.
- **My take:** one Lane Designer pass to a single register, using the survey campaign's lines as the model. No code, gated on the canon decision (H-19).
- **Options:** (a) fix mechanical defects + the C5 fork only; (b) full register pass across all 40 shown lines; (c) hold until H-19 settles canon.

## H-18 · Meta polish — NEXT CONTRACT hook, week countdown, dossier, bark fade
- **Status:** DONE (2026-08-23, ships in the next build) — replanned with Gil, then built. (1) NEXT CONTRACT ▸: winning the final lane of a campaign whose ledger shows the clear now ends on a NEXT CONTRACT ▸ forward key (`95-menu.js` primary chain, `nextCi`); the tap warps straight into the first undelivered contract's frontier, briefed — the home slab's law (`homeContractTarget`) on the report. Handler in `60-input.js` (`nextCon`, target resolved BEFORE the warp so the transition can never strand); gamepad A forwards to it via `END_FORWARD` (`71-gamepad.js`). An ASSISTED boss clear files no star, so the offer correctly stays away. (2) Bark fade: the HUD's fade-out now ends at `barkHold` where the tick retires the line (`90-hud.js`) — a hard-coded 6 had outlived the hold of 4, so every bark cut at full alpha. (3) The week countdown was already COVERED by H-15's CLAIM TO FAME caption (`92-guide.js:1118` prints `WEEKLY LANE · CLOSES <date>`). (4) The dossier client/cargo sub-item MOVED into H-06: no `cargo` field exists — the cargo lives only in each campaign's `story` paragraph, the exact dead copy H-06 wires; the client line was deliberately trimmed from the disc (`92-guide.js:1670`). PINNED in scripts/test.js: the delivered-contract report offers NEXT CONTRACT, A forwards to it, the tap lands on the first undelivered contract's frontier; a mid-life bark paints at full alpha and a bark nearing retirement has faded (a ctx alpha spy over the harness stub). Menu/HUD chrome only — no sim/score path touched; the standing pre-AAB deploy covers the source-hash id as always. `npm run build` + `npm test` green (ALL TESTS PASSED). · **Area:** Story/Meta · **Sev:** MED
- **Combines:** S-3, story lower items (countdown, dossier, bark fade)
- **Issue:** a finished contract gets RESTART/MENU, no "NEXT CONTRACT ▸". The ranked week shows no close countdown. The dossier omits client and cargo. Barks hard-cut without their fade.
- **Evidence:** `95-menu.js:503,961`; `00-core.js:152`; `72-tick.js:250` vs `90-hud.js:961`.
- **My take:** four small, independent surface wins. NEXT CONTRACT and the countdown are the two that most help retention.
- **Options:** (a) NEXT CONTRACT hook only; (b) + week close countdown; (c) + dossier client/cargo; (d) all four including the bark-fade fix.

## H-19 · Settle the canon + the address term
- **Status:** DONE (2026-08-23, no version — decision + docs only). Gil's ruling: (1) CANON = episodic contracts, exactly as `campaigns.js:1-6` states; the `story.json` mystery serial stays a parked draft (acts II–V were never written) and is NOT canon. (2) ADDRESS = the unit is **the vanguards**, comms address the player as *Vanguard*; "runner" survives only as an occasional accent nickname (the two shipped lines in `52-bosses.js` qualify); **wolf/wolves is retired** and must not return to shown text. Recorded in BRAND.md (Name bullet + the old "The wolves" section, now "The vanguards") and PRODUCT.md Brand Commitments. No code change — the shipped lines already obey the ruling. H-06 and H-17 are unblocked.
- **Combines:** naming forks
- **Issue:** two forks block story work. The shipped game is episodic contracts; `story.json` drafts a Renke/Reyes/TRACE mystery serial with acts 2–5 empty. And "wolf/wolves" (PRODUCT.md) never appears in code, which ships "runner".
- **Evidence:** `campaigns.js:3`; `docs/lab/story.json`; PRODUCT.md `:139` vs `:144`; `52-bosses.js:38`.
- **My take:** decide both before H-06/H-17 touch story text. Episodic + "runner" is the lower-cost path and matches the shipped voice.
- **Options:** (a) episodic contracts + "runner"; (b) episodic + switch to "wolf/wolves"; (c) commit to the mystery serial and schedule the writing; (d) decide canon now, defer the address term.

## H-20 · Audio breadth — fanfare tiers, boss-duel music, sonar phase, coverage
- **Status:** DONE (2026-08-23, ships in the next build) · **Area:** Audio · **Sev:** MED (production value)
- **Result:** Gil picked gaps 1, 4 and 5 and cut the ticks. (1) The END card voices the grade: `sfx.star` per pop, `sfx.starsFull` resolves the LAST star (nothing on one, a fifth on two, a flourish on three), `sfx.newBest` stamps the badge at its pop, `sfx.unlock` lands with the keys when THIS run opened a lane (`12-sfx.js`, `95-menu.js`, `61-replay.js`, latches in `40-state.js`). (4) No typewriter ticks — the typewriters themselves went: the enlistment beats (`91-briefing.js`, `ENLIST_TYPE` deleted, the tap gate waits for the last glyph's fade) and the in-run bark ticker (`90-hud.js`) now arrive per glyph on the disc's own LINE_LEAD/STAGGER/FADE. The first-x10 chime already existed (H-12). (5) `audioWake()` resumes the context from ANY parked state, WebKit's `interrupted` included, on the next gesture/show/boot; an interruption mid-run pauses the run (`10-audio.js`, `60-input.js`, `99-boot.js`). The bark-fade pin in `scripts/test.js` reads the alpha per glyph now. 816 checks green. Sim fingerprint HEAD vs working tree: all 41 board ids unchanged, so no verifier deploy is owed. Enlistment fade verified by headless shot at t=0.95 and t=2.2.
- **Follow-up (2026-08-23, Gil: "sometimes no sound on x10 and others"):** measured through the real bus with an audio-thread worklet, the synth accents sat 10-15 dB under the takes they fire beside (x10 chime -21 dBFS under the zap at -9; PERFECT/shieldUp/heal likewise) — masking, not a dropped cue. The glue compressor (≤0.6 dB duck) and main-thread stalls (no loss up to 500 ms on the Mac) were tested and refuted. Fix: an ACCENT bus — every `tone()` enters through `accentGain` at ×3.16 (+10 dB, set by Gil on the phone; `10-audio.js`); the pick take trimmed 0.8 → 0.6; the x10 chime, PERFECT, shieldUp and heal fire 0.12 s after the take on their frame; the exit-warp bed trimmed 0.95 → 0.30 (-10 dB) so the verdict is not buried. Soundboard: `npm run lab:sound` → `scripts/soundboard.html` on 8012, real bus, peak meter, a lift knob to tune ACCENT_LIFT on the phone.
- **Left out on Gil's call:** the boss-duel music treatment and the sonar phase timbre. Re-raise as a new row if wanted; both are render-side and cost no sim id.
- **Combines:** audio upgrades 3, 4, 6, 7 + coverage gaps + interruption handler
- **Issue:** NEW BEST and 1/2/3-star share one cue. The boss duel has no music identity. The sonar tick uses one timbre for every threat. Briefings, unlocks, and combo milestones are silent. No phone-call interruption handler.
- **Evidence:** `61-replay.js:422`; `52-bosses.js`; `72-tick.js:719`; `91-briefing.js`; `60-input.js:342`.
- **My take:** a batch of small wins. Fanfare tiers and the interruption handler ship first. Sonar phase timbre adds threat identity to the one always-on channel.
- **Options:** (a) fanfare tiers only; (b) + boss-duel music treatment (no new track); (c) + sonar phase vocabulary; (d) full batch including interruption handler + briefing tick.

## H-21 · Restore menu film grain
- **Status:** DONE (2026-08-24) — closed as a DECISION, no code change. Gil reviewed a live A/B bench (the real menu frame + the game’s own grain tile animated at alpha 0.02 / 0.012) and chose to keep the menu grain-free on purpose. The "grain + vignette to finish" rule now has a deliberate menu exception — do not re-flag it in a future audit. · **Area:** Art · **Sev:** LOW (one line)
- **Combines:** art finding 3
- **Issue:** the menu is the only state finished without grain, against the "grain + vignette to finish" rule, on the most-stared-at sky.
- **Evidence:** `99-boot.js:1235`.
- **My take:** delete the `state !== S.MENU` test. Verify it stays inside the `lowFX` gate.
- **Options:** (a) remove the state test; (b) remove it but keep the menu grain lighter than in-run.

## H-22 · Gate facing variants
- **Status:** TODO · **Area:** Art · **Sev:** LOW (medium effort)
- **Combines:** the standing gate-facing open item
- **Issue:** all gates face the camera. `rotZ` is wired end-to-end and unused. A yawed gate reads better than the face-on one (confirmed in a render).
- **Evidence:** `81-station3d.js:152,1533,1725`.
- **My take:** two baked facings per gate variant, not continuous rotZ. Record the aperture's projected ellipse at bake so the live spill/approach-light layers follow.
- **Options:** (a) two baked facings + ellipse recording; (b) continuous rotZ with live-layer rework; (c) defer until a new gate relay needs it.

## H-23 · Enlistment tap-to-complete
- **Status:** DONE (option a, 2026-08-27) · **Area:** Journey · **Sev:** LOW
- **THE AUDIT'S NUMBER WAS WRONG, and it changes the diagnosis.** The finding says "about 7s per beat". The real figure is `ENLIST_SCAN + LINE_LEAD + chars × LINE_STAGGER + LINE_FADE` — 1.70s, 1.85s and 1.99s for the three beats, so about **7s TOTAL, not per beat**. The wait was never the problem.
- **The real defect was a DEAD TAP.** `enlistTap()` returned in silence while a line was arriving: no sound, no movement, no prompt. A first-time player taps, gets nothing, and learns that taps do not work on this screen. And `TAP TO CONTINUE` already existed on the plate — they simply never saw it until the wait was already over.
- **Fix.** The first tap snaps the line to full and answers with the same `sfx.tick()` the advance uses; the second advances. The whole disc reads one clock (`enlist.t`), so "complete the line" is a single assignment — the per-glyph fade, the `talking` flag that drives the comms meter, and the gate itself all follow. No second path through the painter.
- **It does NOT break the unskippable rule** at `60-input.js:671`. That rule exists so every word is SHOWN, not so the player must wait; a completed line still shows all of it, at once. There is still no skip control and no route out of `S.ENLIST`. Option (b), a SKIP affordance, WOULD have broken it and was declined for that reason.
- **A mash cannot flash the line.** `ENLIST_HOLD` (0.35s) makes a force-completed line stand before a tap will advance it; without it a double-tap completes and advances inside two frames, and the words are on screen for 16ms — which is not "shown" in any sense the rule meant. A player who simply waited through the typing pays no hold, because the wait was the hold.
- **Verified.** `npm test` green, 6 pins (the old "a tap is ignored" pin was rewritten to the new contract, asserting both that the beat does not advance AND that the line lands whole). Driven in the LIVE game with headless Chrome: mid-sentence → first tap → line complete, `beat` still 0, `snapped` true → second tap held → after the hold, advanced. Both touch and gamepad go through the one `enlistTap()`. **41 boards, 0 moved.**
- **Combines:** journey finding 8
- **Issue:** a tap during enlistment typing does nothing, so a new player waits about 7s per beat with no fast-forward.
- **Evidence:** `60-input.js:676`; `91-briefing.js:1131`.
- **My take:** first tap completes the line, second advances. Standard convention, touches every new player's first minute.
- **Options:** (a) first-tap-completes convention; (b) a small SKIP affordance after the first beat.

## H-24 · Delete dead code — scroll machinery + beam subsystem
- **Status:** DONE (2026-08-24, ships in the next build) — Gil chose the full scope: scroll machinery + beam subsystem + the en.drift orphan from H-28.
  - Scroll machinery: `menuScroll`, `mapListScroll`, the never-written `menuPtr.mapScroll0`/`scroll0`, and the unreachable `menuLbRect` tap branch are gone (`40-state.js`, `60-input.js`, `92-guide.js`). The desktop wheel handler now serves the board lists only. `menuGeom()` slimmed to `{ ccx, ccy, R }` — its list geometry (`maxScroll` etc.) served only the dead scroll. The drag's `moved` flag (tap vs swipe) is kept.
  - Ray-cannon (fused duel) subsystem, whole: `heat`/`overheat`/`beamActive`/`beamAim`/`BEAM_S` state, `drawBeam` (was already uncalled), `beamGeometry`/`beamHitCore`, `beamSound` + `beamOscs`, `sfx.overheatWarn`, every `fused`/`fusedV`/`fireStick` branch (72-tick, 71-gamepad, 80-tunnel, 85-enemy-art), and `boss.mergeT` itself. The design record stays in docs/parked/RAY-CANNON.md.
  - `en.drift` orphan (H-28's leftover): the read in `72-tick.js` and every `= 0` write are gone. No RNG draw was touched — the crawlers burned draw stays exactly as H-28 left it.
  - PROVEN zero sim cost: all 41 board fingerprints byte-identical before/after (sim-fingerprint compare). `npm run build` + `npm test` green (814 PASS — two `mergeT === 0` "no fuse" checks were deleted with the field; the harness lost its `setMenuScroll`/`setBeamAim`/`getHeat`/`isOverheat` helpers, all unused). Verifier bundle rebuilt; the source-hash sim id moved to `f32e9171f2e6` as any source edit does — the standing pre-AAB deploy carries it, nothing is owed now.
  - Untouched on purpose: `b.beams` (the LIVE boss sweep system), `drawLineBeam` (live line-pair art), and the untracked `src/game/80-tunnel.js.bak` (not mine to delete).
- **Area:** Journey/Cleanup · **Sev:** LOW
- **Combines:** journey findings 4, 11
- **Issue:** `menuScroll`, `mapListScroll`, `menuPtr.mapScroll0`, and an unreachable `menuLbRect` branch are written but read by no painter. The beam subsystem is flagged for removal.
- **Evidence:** `60-input.js:240,311,238,430`; `92-guide.js:629`; `40-state.js:157`.
- **My take:** pure removal, zero player impact, but it is live input code writing ghost state. Do the flagged focused removal.
- **Options:** (a) scroll machinery only; (b) + beam subsystem; (c) both plus the `crawlers` dead knob (overlaps H-28).

## H-25 · Boss tuning pass + count volley zaps + split C1L7 lock intro
- **Status:** IN PROGRESS (items 1, 2, 3, 4, 4b BUILT — item 2 closed 2026-08-27 by Gil's live ruling as the L07 debut breath; open: his feel pass on 3-4 and the beats sub-item 5) · **Area:** Balance · **Sev:** LOW
- **Progress (2026-08-24), Gil's per-item ruling and what landed:**
  1. DONE — volley zaps. A volley kill now does `zaps++` in `72-tick.js`, mirroring the H-11 chain fix, so the style tiebreak (`zaps desc`) sees volley players. Pinned: 'a volley kill counts a zap'.
  2. DONE (2026-08-27) — the C1L7 debut breath, on Gil's LIVE ruling. He flew L07 as shipped and ruled: the lane is mostly fine, but the opening stacks too many reds onto the keyed debut — cut the reds by half for the first ~15s (until the first purple). Built as CONTENT, not engine: one band on L07, `bands: [{ t0: 0, t1: 15, mix: { bursts: false, colors: 0.25 } }]` (campaigns.js). No volleys in the breath (a 3-red volley inside the debut was the worst offender), and colors re-tuned 0.36→0.25 so the keyed arrivals/second stay at the lane's own rate while the freed burst ticks flow into the normal branch (the algebra is in the band's comment). At 0:15 `bandCfg` returns the level itself — the tail is byte-identical to the authored lane. L06 untouched, one demand per lane holds. PINNED (5 checks): the single 0–15 window, the in-breath mix, the at-15 identity, an empirical deterministic red count (breath ≤ 65% of the tail's reds), and ≥2 keyed spawns still teaching the debut. Fingerprint compare: exactly ONE board moved — cargo-run:6. Verifier bundle rebuilt (strict id `e9b1add9469b`), BUNDLE OK; the deploy rides the standing pre-AAB routine. Gil flew the built breath live the same day and confirmed: works, keep it.
  2-old. SUPERSEDED — the original lock-split idea. A first build put a colors trickle into L06; Gil rejected it the same day: **never two new enemy demands in one level** — L06 teaches dead zones, full stop. Both knobs are reverted (L06 `colors` 0.00, L07 0.36; campaigns.js is byte-identical to HEAD). Gil will look at L07 live and rule then. If L07 needs relief, the lane-legal levers are: drop `bursts` from L07, or soften its jump — never a second debut in L06.
  3. DONE — prism convergence. Separate floors: slow light `TAU/max(4.8, 6.0−r·0.35)`, fast light keeps `TAU/max(3.8, ...)`. The lights start as before, escalate with rounds, and hold a permanent ~26% gap. Pinned at round 14.
  4. DONE — last-stand escalation, gentle per Gil. `b.lsShifts` counts the swaps; sweep = `TAU/max(4.2, 5.2 − (shifts−1)·0.2)` — shift 1 is unchanged, floor at shift 6 (~24% faster, vs the prism's 3.8 floor). Pinned to the floor.
  4b. DONE (2026-08-25, Gil's design) — the LAST-STAND PURPLE LAMP. The lamp goes steady interdiction violet (purple = the game's "both thumbs" word) with a thin split rim: blue half-arc LEFT, white half-arc RIGHT — the thumbs' own geography, stating the both-keys recipe literally (`leechLampCol` + the lamp draw in `85-enemy-art.js`). The old blue↔white breath was one read from the blink-warning vocabulary and could say "about to flip". RENDER-ONLY, PROVEN: fingerprint compare unchanged (same 7 moved boards as items 1+3, none from this). Pinned: drawOk 'last-stand purple lamp + split-rim frame'. Verified in the LIVE game by headless Chrome (forced blockade last stand via startBossTest + state); preview crop in docs/parked/h25-laststand-lamp.png (delete after Gil's device pass).
  5. DONE (2026-08-27) — authored beats in C2 and C4. Nine beats over seven lanes, each one placed against its lane's own identity, none inventing a demand the lane does not already teach. THE SURVEY (the flood campaign): L02 a placed heavy in the trough between its two bands + a shield before the hot finish; L05 a 3s lull before the current; L07 a heavy in the trough between the two torrents + a shield before the biggest band the campaign throws. THE PATROL (the phase campaign): L01 one blue bait and one white, early and unmistakable — the campaign's thesis stated in traffic instead of only in the hint; L04 a shield as the water reddens; L06 a heavy + a shield; L07 a 3s lull after the first wave breaks + a health cell before the second. PINNED (9 checks): every authored beat ARRIVES in a real deterministic run of its lane (a beat that silently never fires is content that reads as shipped and is not), and the fairness linter clears every survey and patrol lane. `npm test` green.
  5-LIVE PASS (Gil, 2026-08-27). He flew all seven beat lanes and both open finales. Verdicts: patrol L01 ok — the bait thesis lands; patrol L07 tough but fair; patrol L06 ok; survey L07 ok; survey L02 ok. Five defects came out of it, and four of the five were ENGINE bugs the beats merely exposed:
    a. **The power-up spacing law.** "Space out power ups! never have two of them show within 10s of each other." Three sources drop orbs — the filler's clock, an authored beat, and band/surge relief — and none could see the others. Measured: patrol relay 04 had a shield and a chain 0.2s apart, survey relay 02 a shield and a wide 0.1s apart. `PICKUP_GAP = 10` in `40-state.js` with `pickAllowed()` in `51-linter.js`; every drop is gated and a refused drop is DEFERRED, never dropped — filler re-arms its clock, a beat slides late exactly as it already does around a comm window, relief holds its ledger entry. All three defer on `levelT` alone, so no seeded draw moves. The fairness linter's walk mirrors the law draw-for-draw.
    b. **Relief must be able to matter.** "A pointless life pickup on the last enemy." Band relief had no end-of-lane guard, so a hot band ending near the finish sent a patch that arrived as litter — measured at 69.0s of a 70s lane, and on three others. It now obeys the same `dropWindow` the filler does, and relief EXPIRES if the gap never opens within `PICKUP_GAP` of its band's end: relief that arrives 20s downstream is not relief.
    c. **A carpet that finds no clear arc now stands down.** Discovered by the H-31 wall/orb pin firing after (a) moved filler orbs into new windows. The hop loop broke on success and simply FELL OUT on failure, so an exhausted search used its last hop unchecked and the carpet parked on whatever was there. Only a FILLER carpet stands down; an AUTHORED one stays and gets reported, because the linter's job is to tell the author their wall is unfair. Widening the search was tried first and rejected: it only moved which lane lost.
    d. **The prism's shortcut.** "Feels a little slow… we need to spawn a pulse recharge power up when the rays are active and sweeping." The sweep was the fight's dead time: both thumbs dodging, neither charging, nothing to do but wait. An `inject` orb now rides in with the lights — both purge orbs snap to ready, a whole pulse bought back, and the cost is fetching it under two rays with a condemned emitter. Fixed to the sweep's own clock off `bossRng`, never a roll.
    e. **The last stand now tightens where a duel actually reaches.** "Feels good, didn't feel any tightening" — exactly what the numbers predicted: 0.2s steps made shift 2 only 4% faster and put the floor at shift 6, past where a real duel ends. Now 0.45s steps to a 3.6s/rev floor: shift 2 is 9% faster, shift 4 is 35%, and the floor lands at shift 5. The telegraph is untouched.
    f. **The ray sound.** "Our new ray sounds didn't apply here… check they are implemented on all ray instances." They ARE — `bossBeams` fires `rayCharge` and `updateBossFight` drives `raySweep` for every ray user (siphon, prism, and the blockade's last stand, verified by code path and by a headless probe showing live beams on siphon and prism). The real fault is the PRISM being the only fight with two rays at once: each voice was written to sit at `RAY_LEVEL`, so two summed to twice the ceiling, the master limiter pulled the whole mix down to fit, and what reaches the ear is a duck rather than a ray. The bed is now shared (`1/sqrt(n)`) instead of stacked, and the second charge is offset 90ms with a wider pan so the pair reads as two machines waking. NOT CONFIRMED BY EAR — this is the mechanism found by reading and measuring; it needs Gil's listen. The two declared takes are still missing from disk (filed as H-36).
  - **Content changes from the pass:** survey relay 05's 3s hush is replaced by three plain arrivals ("no need for that pause… 3 simple filler enemies, just to move along"). Every other authored beat stands; patrol relay 04's shield and survey relay 02's shield were not misplaced, they were crowded, and (a) is the fix.
  - VERIFIED: `npm test` green (18 new pins, including a walk of all 40 lanes asserting no two orbs within 10s and no unreachable drop). 21 of 41 board ids moved. Verifier bundle rebuilt, BUNDLE OK; `npm run test:coverage` 40/40.
  5-DEPLOY, STATED PLAINLY: the fingerprint says ZERO boards moved — and that is WRONG, not reassuring. Every one of these beats lands at t≥12s, and the battery dies in 4–14s on every board (see H-35). The sim on those seven boards DID change. The verifier MUST ship with this: `npm run deploy:verifier` (bundle rebuilt, strict id `b17711844dcc`, BUNDLE OK). Do not read "no ids moved" as "no deploy needed" for this item.
  5-old. OPEN on Gil's call — authored enemy/pickup beats in C2/C4. Explained in full (plumbing complete, zero content); Gil kept it open for a later batch, not dropped.
  - VERIFIED (after the item-2 revert): `npm run build` + `npm test` green (818 PASS, 4 new pins). Fingerprint compare vs pre-pass: 7/41 board ids moved — survey:7 (the prism boss floors) and cargo-run:0/2/6, survey:0/6, collector:6 (the battery's driver completes volleys there and the scoreboard's zaps stat moved). KNOWN BATTERY LIMIT, stated: shutdown:7 did NOT move — the driver never survives to the last stand, so the shift escalation is pinned through the boss test rig instead. Verifier bundle rebuilt (sim id `83d88d542ee4`); the standing pre-AAB deploy carries everything, nothing deploys early.
- **Combines:** C-7, boss tuning observations, H-28's beat authoring (2026-08-23)
- **Issue:** prism's "unequal speeds" tell converges by round 5. The blockade last-stand sweep never accelerates. Volley kills do not increment `zaps`, undercounting volley styles in the tiebreak. C1L7 stacks the lock debut with bursts at the steepest jump.
- **Evidence:** `52-bosses.js:591,679`; `72-tick.js:625`; `campaigns.js:68`.
- **My take:** escalate the last-stand sweep with rounds, keep prism speeds honestly unequal, count volley zaps, and split C1's lock intro across L6/L7. Boss-board ids move, so batch with H-02.
- **From H-28 (2026-08-23):** author `enemy` and `pickup` beats into C2/C4 while the ids are moving anyway — a placed heavy at a named second/angle, a shield before a hard band. The fairness linter judges every authored beat, so a bad placement fails `npm test`. No engine work: walls/strips already run through the same machinery.
- **Options:** (a) volley zaps + C1L7 split only (cheap); (b) + boss escalation tuning; (c) full pass, batched with H-02.

## H-26 · Backend hardening — name filter, delete residuals, admin auth
- **Status:** DONE (option c — all three, built 2026-08-26 against 1.0.4) · **Area:** Backend · **Sev:** LOW
- **Result (2026-08-26):** all three hardenings built, `npm test` green, 13 new pins.
  1. **Admin auth.** `scripts/admin.js` mints a fresh random token per start, stamps it into the page it serves, and requires it as an `X-Admin-Token` header on BOTH `/api/data` and `/api/act`. A header is the whole defence: a cross-origin form cannot set one, and a cross-origin fetch that tries must pass a CORS preflight this server answers for nothing. A `Host` allow-list refuses a DNS-rebinding hostname. Verified live against a throwaway instance on 8099: no token, wrong token, and a foreign `Host` all answered `forbidden`; the served token worked. Documented in `docs/MODERATION.md`.
  2. **Name filter.** `cleanName` in `submit-run/index.ts` was rebuilt. Confusables are FOLDED to Latin before the ASCII strip, so "FUСK" with a Cyrillic С normalises to `fuck` instead of displaying as "FUK"; NFKC and NFD-plus-mark-strip cover the width, ligature and accent families, and a `FOLD` table covers the Cyrillic/Greek lookalikes Unicode will never merge. Leet mapping now runs BEFORE the punctuation strip, which is what makes the long-dead `@`, `$` and `!` entries fire. The word list is split in two: unambiguous slurs match anywhere, embeddable words match only at a word boundary — so SCUNTHORPE, ESSEX, RACCOON, TORPEDO, CRISIS, SPICE and PEACOCK stop being redacted. A server min-length of 2 was added; under it degrades to `""`, which the boards already print as ANON. **Accepted cost, stated:** "CUMLORD" now passes; the three-reporter auto-redact is the second line, and a false redaction has no appeal route.
  3. **Delete residuals.** New migration `20260826000000_delete_takes_filed_reports.sql` — `delete_my_runs` now also deletes `reports where reporter_id = p_player`. `reports.reporter_id` has no foreign key, so a departed player's id used to survive in every report they ever filed. **Consequence, on purpose:** withdrawing those reports can take a run back under the three-reporter threshold; an auto-redaction that already fired is untouched, because it set `name_locked`. `my-data/index.ts` gained `purgeTraces()`: 100-key batches with one retry each, then a second pass that lists each board folder for `<playerId>-` and removes the stragglers a row list never named. The response now carries `tracesLeft` instead of logging the failure away.
- **DEPLOY DEFERRED TO THE NEXT RELEASE (Gil, 2026-08-26).** Nothing in items 2 and 3 is live. It needs `supabase db push` plus `supabase functions deploy submit-run --use-api` and `supabase functions deploy my-data --use-api`. No sim ids move — no game source was touched — so this rides the standing pre-build deploy routine rather than needing one of its own. Nothing here fixes a live break: the old name filter still catches the common cases, and the residuals are a tidy-up. Item 1 needs no deploy at all — the admin console is local, so the token gate is live at the next `npm run admin`.
- **Combines:** backend lower findings F5, F6, F7
- **Issue:** the name filter is ASCII-only so homoglyphs are stripped not folded, with Scunthorpe false positives and no server min-length. Account delete leaves reports-filed-by and orphaned traces. The local admin `/api/act` runs destructive writes with no auth.
- **Evidence:** `submit-run/index.ts:62`; `my-data/index.ts:129`; `scripts/admin.js:120`.
- **My take:** three independent small hardenings. The admin auth is the one with a real (if bounded) exploit path.
- **Options:** (a) admin auth only; (b) + name-filter NFKC/homoglyph folding + min-length; (c) all three including the delete residuals.

## H-27 · Station bake polish — SPINE hoops + GATE aperture
- **Status:** DONE (2026-08-23, unreleased — ships in the next build) · **Area:** Art · **Sev:** LOW
- **Combines:** art findings 4, 5
- **Result:** GATE only, on Gil's call after a before/after preview (`docs/station-lab/h27-preview.png`).
  - ROOT CAUSE of the flat dish: the gate is stood up with `rotX` AFTER its geometry is built, and the shader sampled the emissive pattern (`eCyl` filaments, `eRad` falloff) after that rotation — so the filaments lay across the wrong plane and never showed. Fix: `S3Mesh.rotX/rotZ` remember the angle (`M.rx`, `M.rz`) and `s3renderSteps` undoes it before sampling. Builds without a rotation are pixel-identical (SPINE before/after `cmp` equal).
  - The dish got its own material: `eRing` (6 hoops packed toward the centre) and `eWell` (a bright core) are two new emissive shapes in the shader; the funnel deepened to `-0.12` with 10 rings. Dials in `s3_gate`: `eWell: [0.15, 2.2]` (radius, gain), `eRing: [6, 0.55, 0.6, 0.735]` (count, depth, packing, radius).
  - SPINE: Gil saw the 18-pad plates+ribs variant and did not take it. The 36 ribs stay.
  - `npm test` green (816 PASS). No sim cost (render only).
  - Lab note: `docs/dest-lab/index.html` renders the gate WITHOUT `rotX` (flat, not stood up) — a pre-existing lab/game drift; with the frame fix both are self-consistent, but the lab still does not show what the game draws. `docs/station-lab/dials.js` was missing and is regenerated (derived file, now gitignored).
- **Issue:** SPINE reads as cogs at rest (36 cladding boxes per torus). GATE's baked aperture is a flat teal dish at rest and leans entirely on live layers.
- **Evidence:** `81-station3d.js:656,368`.
- **My take:** halve SPINE's pad count and vary pad lengths for an armour read. Raise GATE filament contrast or add a centre vortex. Lab-drivable, then rebake.
- **Options:** (a) SPINE only; (b) GATE aperture only; (c) both.

## H-28 · Ship unused depth — crawlers drift, noCharge drone, more beats
- **Status:** DONE (2026-08-23, unreleased — ships in the next build) · **Area:** Balance · **Sev:** LOW (optional depth)
- **Result:** resolved by DELETION, not by content. Gil's call: the crawlers knob and the `noCharge` pressure drone are gone; beat authoring moved to H-25. Board ids byte-identical before/after (all 41), `npm test` green (816 PASS). No verifier deploy needed for this item.
- **Combines:** C-8, C-9, C-10
- **Progress (2026-08-23):** crawlers RETIRED on Gil's call (removed, not shipped). The knob is gone from the loader's band-mix whitelist, the editor's mix list, the linter, and CMS-ROADMAP. The roll's RNG draw STAYS as a named burned draw in `spawnEnemy`/`simEnemy` — dropping it would shift every later `spawnRng()` and move all 41 board ids (proved: fingerprints byte-identical before/after, `npm test` green). Drop the burned draw only in a release that already moves every board.
- **Progress (2026-08-23, later):** the `noCharge` pressure drone DELETED (pulled from the mimic on 2026-08-11, never set anywhere since). Gone: `PURPLE_CLEAR` + the purple law in `leechWave`/`sweepTrickle` (52-bosses.js), the both-thumbs zap branch + feed gate (72-tick.js), the violet palette + procedural-skin switch (85-enemy-art.js), the three purple test blocks + the `PURPLE_CLEAR` export (scripts/test.js), CMS-ROADMAP note. `bChance(opts.purple)` only drew when the option was set, so no board id moved. `en.drift` (72-tick.js:720) is now a pure orphan — left for H-24.
- **Beats:** the engine takes `enemy` (6 types) / `wall` / `strip` / `pickup` / `lull` beats; the campaigns author only `wall` ×12, `strip` ×4, `lull` ×1 across 7 of 40 levels. No `enemy` or `pickup` beat exists. Authoring them is content work that moves each edited board's id → folded into H-25 to ride its verifier deploy.
- **Issue:** three built systems ship no content. `crawlers` is rolled and discarded though `en.drift` exists. The `noCharge` purple pressure drone is one flag from use. Only 3 of the 8 beat types are authored.
- **Evidence:** `50-enemies.js:30`; `72-tick.js:717,856`; `52-bosses.js:56`; `51-linter.js`.
- **My take:** genuine new reads from the two dials, no new inputs. Crawlers cost zero extra RNG draws if drift derives from the already-drawn `spin`. The drone and new beats move edited board ids.
- **Options:** (a) crawlers only (zero sim-id cost on shipped levels); (b) + author enemy/lock beats into C2/C4; (c) + deploy the pressure drone into C5, batched with a sim-id release.

## H-29 · Doc drift pass
- **Status:** DONE (option b — full sweep, 2026-08-26) · **Area:** Docs · **Sev:** LOW
- **Result (2026-08-26):** every claim was checked against the code first. All six audit items were real; two read worse than the audit said and one read better.
  | # | Where | Said | Now says |
  |---|-------|------|----------|
  | 1 | `PRODUCT.md:62` | wheel is TUTORIAL / CAMPAIGN / FREE FLOW | LEADERBOARD / CONTRACTS / FREE FLOW |
  | 2 | `PRODUCT.md:165` | "all four music tracks", a menu track owed | twelve tracks, the menu track shipped, nothing owed |
  | 3 | `PRODUCT.md:171` | screenshots and feature graphic "do not exist yet" | they exist in `docs/store/`; only the preview video is still missing |
  | 4 | `docs/PRIVACY-POLICY.md:24` | "deletion is by email", an in-game control owed | the MY DATA panel shipped; email is the secondary path |
  | 5 | `docs/CLOUD-SAVE-PLAN.md` header + §8 | monetization is "free with ads"; reverses the no-ads line | free demo + $2.99, NO ads; both places now say **do not wire a CMP, an ATT prompt, or an ad SDK** |
  | 6 | `CREDITS.md:10,19,37` | menu is `.mp3`, mode is "daily", map is `SFX_SRC` | `.m4a`, the ranked week, `SFX_FILES` in `src/game/12-sfx.js` |
  | 7 | `docs/RELEASE-PLAN.md:9,42` | the iOS project "does not exist" | `ios/App/` exists, simulator-only, blocked on Apple enrolment |
  | 8 | `src/game/20-background.js:845` | weekly sets `spawnRng = Math.random` | the two streams were split; points at `60-input.js:822` |
- **Three corrections to the audit's own reading.** RELEASE-PLAN states the iOS line **twice** (`:9` and `:42`), not once — both were fixed. CREDITS is **narrower** than the audit says: only the music line was wrong, because the AAC conversion deliberately left the sfx as `.mp3`/`.wav`, and the sfx table was already correct. PRIVACY-POLICY's "no advertising — must stay true" is **not** drift; it agrees with the settled no-ads decision, and it was CLOUD-SAVE-PLAN that contradicted it.
- **Four extra drifts found while sweeping, in the same tables, fixed:** `RELEASE-PLAN.md` said version `1.0.0` / versionCode `1` (it is 1.0.4 / 10004, generated by `scripts/sync-version.js`) and Signing **"Debug only"** (`signingConfigs.release` is used when the keystore is present, and the signed 1.0.4 bundle was cut). `92-guide.js:921` called the middle sector "STORY MODE" two lines above the code that names it `CONTRACTS`.
- **SIM ID MOVES, SCORING DOES NOT.** Two of these were comments inside game source, and `scripts/lib/sim-id.js` hashes every byte of that source — comments included — so the id went `bfbd7a2099d8` → `6151e052dc5c`. A `sim-fingerprint` compare against HEAD proves it is cosmetic: **41 boards, 0 moved.** The next verifier build must therefore be `npm run build:verifier -- --compatible`, which is exactly the case that flag exists for.
- **Combines:** doc drift across the audit
- **Issue:** several docs describe what the code no longer does. PRODUCT.md wheel names + track count + screenshot line; PRIVACY-POLICY.md deletion paragraph; CLOUD-SAVE-PLAN.md monetization header; CREDITS.md format/cadence/symbol; RELEASE-PLAN.md iOS line; the `20-background.js:845` RNG comment.
- **Evidence:** listed in the audit §7.
- **My take:** one reconciliation pass. The CLOUD-SAVE-PLAN monetization header is the one that could mislead a future build (it names an ads/consent flow the game must not have).
- **Options:** (a) fix only the two that could mislead a build (CLOUD-SAVE-PLAN, PRIVACY-POLICY); (b) full doc-drift sweep across all six.

## H-30 · The 40 briefing-disc keyframes
- **Status:** MERGED INTO [H-06](#h-06--the-story-ladder--the-one-story-item) (2026-08-26, Gil's call) — it is the ladder's art rung, and still deferred behind rungs 1–4. Do not work it here; the detail below is kept as the original finding. · **Area:** Content · **Sev:** LOW (largest lift)
- **Combines:** owed art
- **Issue:** 0 of 40 per-mission disc keyframes exist. The destination glam-shot fallback covers it by design, so impact-per-effort is lowest despite being the biggest missing body of art.
- **Evidence:** `src/art/disc/` holds only the enlistment + 5 verdicts; spec in `DISC-ART-SPEC.md`.
- **My take:** lowest priority. The fallback is good. Revisit only after the cheaper story wins (H-06, H-18) land.
- **Options:** (a) defer indefinitely, keep the fallback; (b) author a first batch for campaign 1 only; (c) commission all 40 against the spec.

## H-31 · Power-ups can land inside a dead-zone wall carpet
- **Status:** DONE (2026-08-22, ships in 1.0.4) — both directions closed in `51-linter.js` (the file holds the LIVE spawners, not just the linter): (1) `spawnPickup` routes the orb angle through `clearOfWalls` (golden-angle hops, zero RNG consumed — the draw stream is byte-identical); (2) `spawnWall`'s clash scan now also dodges in-flight orbs (0.9× stream speed, same window law as enemies); (3) the linter walk mirrors both (`simPickup` relocates via `cow`, `simWall` scans `picks`). PROVEN: a whole-roster walk (73 orbs, 127 walls over all 40 levels) found 5 orb-over-wall violations pre-fix — including C3L7, where Gil saw it, plus C4L6 and C5L7 — and 0 after. The invariant is PINNED as a permanent check in `scripts/test.js` ('no power-up ever lands inside a wall carpet'). `npm test` green (752 PASS). Sim id moved to `4e71459899af` (orb angles shift only where an overlap existed); the standing pre-AAB deploy carries it. Tutorial's scripted drill drop is untouched (nothing else on the rim there). · **Area:** Balance · **Sev:** MED
- **Combines:** Gil's playtest find, 2026-08-22 (during the H-10 C3 pass)
- **Issue:** a power-up orb can show over a dead-zone/rim wall. Enemies relocate via `clearOfWalls`, but `spawnPickup` drops the orb at a raw `spawnRng() * TAU` angle, and `spawnWall`'s clash scan covers in-flight enemies only — so a wall can also park on an in-flight orb. Catching such an orb demands entering the carpet.
- **Evidence:** `51-linter.js:476` (live spawnPickup, no clearance); `51-linter.js:415` (spawnWall clash scan, enemies only); the linter's pick verdict only fires for authored beats.
- **My take:** close both directions with the existing reachability law: route the pickup angle through `clearOfWalls`, add in-flight pickups to `spawnWall`'s clash scan, and mirror both in the linter walk. No RNG draw is added, so the stream is unchanged; landed angles move only where an overlap existed.
- **Options:** (a) pickup-side clearance only; (b) both directions + linter mirror (chosen).

## H-32 · In-run barks — cramped, small, glued to the speaker title
- **Status:** DONE (2026-08-25, ships in the next build) — Gil's report (F-012 in docs/USER-FEEDBACK.md). ROOT CAUSE: chip + message shared one chord high in the bore, so the fitter shrank the line to 8-10px, and the chip's border ended 5px past the label while the message started at 6px — one pixel of air. REDESIGN: a broadcast subtitle in `90-hud.js` — the speaker chip (`» CMD`, letterspaced, real padding) stands centered on its own line at H*0.15; the message takes the whole chord beneath it at 13px, word-wrapped to two rows (three only at the 10px floor), the H-20 per-glyph fade kept with its stagger running through the wrap. Draw-only, PROVEN: fingerprint compare unchanged (same 7 moved boards as H-25's items, none from this), and the 'barks are draw-only' pin still holds. The bark-fade pin re-armed on the colon-less tag. `npm test` green. Verified live by headless Chrome — previews docs/parked/h32-bark-short.png + h32-bark-long.png (delete after Gil's device pass). Owed: Gil's device eyeball; knobs are the 13px base, LH 16, and the tag's H*0.15 anchor. · **Area:** HUD · **Sev:** MED (readability)
- **Combines:** F-012
- **Issue:** barks missed a space after the speaker title and read cramped and small.
- **My take:** the single-chord layout was the cause; stacking tag over message returns the whole chord to the message.
- **Options:** (a) stacked subtitle, 13px + wrap (chosen); (b) inline chip with bigger font and padding.

---

## H-33 · Boss audio realism — the ray's voice + the dying plates
- **Status:** IN PROGRESS (option b — hybrid, blended ray; PLUMBING + SYNTH BUILT 2026-08-26, open: Gil's ear on the soundboard, then the two takes he is sourcing) · **Area:** Audio · **Sev:** MED · **Raised by:** Gil, 2026-08-26 (not from the 2026-08-21 audit)
- **Gil's choices, 2026-08-26:** sourcing = **hybrid** (I synth now, he sources the charge and the explosion takes); ray character = **both references blended** — a doppler hum under a resonant metallic formant.
- **BUILT 2026-08-26.** `npm test` green, 10 new pins, **41 boards, 0 moved** (draw-only, as required).
  1. **The sweep is a SUSTAINED synth voice** — `raySweep()` / `raySweepKill()` in `10-audio.js`, one voice per node index so the prism's two lights speak at their own two speeds. Layer A is two sawtooths detuned 16 cents into a resonant lowpass (the saber waver); layer B is looped noise through a high-Q bandpass with a peaking formant (the tripod howl). `RAY_SABER` / `RAY_TRIPOD` are the blend knobs. Pitch, filter and pan are driven from `bm.spd`, `bm.a` and `bm.dir` every frame, so a reversal bends the doppler as it turns instead of firing a 0.2s blip. **Synth was the right call here regardless of sourcing:** the speed varies per boss and per round and the beam reverses mid-flight, so no fixed take can track it.
  2. **The driver sits in `updateBossFight`, not `bossBeams`** — and that placement is load-bearing. `bossBeams` only runs while the fight is in `'sweep'` mode, so a voice started inside it would never be told to stop when the mode moved on. Pinned. A second guard in `99-boot.js` kills the voice whenever the run leaves the lane, which covers a loss, a quit, a pause and a replay exit.
  3. **The charge** — `sfx.rayCharge()`, fired once on beam birth. **REBUILT 2026-08-26 on Gil's note: "should be something more deep and realistic."** The first pass was made of `tone` and `crackle`, which ramp their gain DOWN from the first sample — so it decayed while the picture said it was loading, and it climbed to 470 Hz, which is where a sci-fi beep lives. Two new primitives in `10-audio.js`, `swell()` and `swellNoise()`, are the mirror of those: the gain peaks at the END of the window and a LOWPASS opens alongside it. Mass now comes from the bottom and from the filter, not from pitch — the three layers barely move (38→52, 82→104, 150→300) and what changes is how much of each gets through as it thickens, which is what a machine loading up actually does. It runs **0.44s, past the 0.30s `BEAM_BURST` on purpose**: 0.30s is about eleven cycles of a 38 Hz sub, too tight to read as deep, so the charge releases INTO the rotation instead of stopping dead. No gameplay timing changed — the sweep voice fades in over its own 0.22s, so the two crossfade.
  4. **The plates** — `sfx.bossPlate(n, pan)` replaces the six identical `crackle` + square tones. Each blast is a sub shockwave (74→26 Hz, ringing past the crack — **the part that was missing**), a falling broadband body, a bright crack, and staggered metal debris. It walks heavier off `b.dyingN`, a COUNTER not a roll, so the six ramp into the implosion. Panned to the plate that tore.
  5. **The takes are DECLARED but absent.** `rayCharge: 'audio/sfx/ray-charge.mp3'` and `bossPlate: 'audio/sfx/boss-plate.mp3'` are in `SFX_FILES`. Nothing breaks while the files are missing — `loadSamples`' `.catch` swallows the 404, `playSample` returns false, the synth covers. Drop a file in and it takes over on the next load with **no code change**. `scripts/test-sfx-levels.mjs` now reports an absent declared take as `PEND` instead of failing, so the plumbing could ship before the audio.
  6. **The soundboard grew a section** (port 8012): charge alone, slow light, fast light, reversal at 2.4s, both prism lights at once, stop; plate 0, plate 5, all six, and the whole death into the implosion take. The ray buttons **animate a real sweep** through the real voice, because a one-shot button would audition nothing — the bend and the pan are the sound.
- **SIM ID MOVES, SCORING DOES NOT.** `40122838d969`. Audio is draw-only; a fingerprint compare against HEAD gives 41 boards, 0 moved. The next verifier build takes `-- --compatible` (see the same note on H-29).
- **Gil's ear pass: PASSED (2026-08-27).** First listen: "everything sounds good but the charge up sound... it should be something more deep and realistic." The charge was rebuilt on the swell primitives; second listen: "much better." The `RAY_SABER` / `RAY_TRIPOD` blend and `RAY_LEVEL` stand as built. No knob changed.
- **`BEAM_BURST` question: ANSWERED without touching gameplay.** The charge runs 0.44s and crossfades into the sweep, so the 0.30s burst window stays exactly as it was.
- **ONLY REMAINING WORK — the two CC0 takes, on Gil.** `ray-charge.mp3` and `boss-plate.mp3` are declared in `SFX_FILES` and reported as `PEND` by `test-sfx-levels`. The synth is what ships until they land, and dropping a file in takes over with no code change. **Nothing here is workable without him**, so this item sits until he has the audio.
- **Issue, in Gil's words:** the synth voices are not realistic enough. The ray should feel like a **charge-up** and then a **lightsaber "voom"** as it moves, or the mechanical ray of a *War of the Worlds* tripod. The boss's end-of-fight part explosions should be **more explodey — shockwaves**.

### Part 1 — the sweeping ray has almost no voice
| Beat | Where | Sound today |
|---|---|---|
| birth / charge (`BEAM_BURST` = 0.30s) | `52-bosses.js:447`, const at `:64` | **silent** |
| the sweep rotation (the "voom") | `52-bosses.js:458` | **silent** |
| mid-sweep reversal | `52-bosses.js:452` | one 0.2s `tone(240, 0.2, 'sawtooth', 0.1, 120)` |
| contact fry | `52-bosses.js:468` | `sfx.fry` → reuses `shutdown.mp3`, an emitter *reboot* take |
| retraction | `52-bosses.js:479` | **silent** |

The whole ray therefore reads as a silent visual with one blip on reversal, and its only real cue is a sound authored for a different event.

### Part 2 — six identical plate pops
`52-bosses.js:791-799`. Each of the six torn plates fires exactly `crackle(0.2, 1800, 300, 3, 0.6)` plus `tone(220 - dyingN*20, 0.15, 'square', 0.1, 90)`. No low end, no shockwave, no variation across the six. The comment at `:784` already promises more than the audio delivers: *"the machine dies like a star: convulsions, plates torn away one by one, the lamp guttering out, implosion, shockwave"*. The implosion itself is fine — it plays `boss-dead.mp3` (H-13 levelled it as the ceremonial loudest take).

- **My take — the two parts want OPPOSITE treatments, and that is the whole design call.**
  - The **sweep** must be **synthesised, not sampled**. `bm.spd` varies per boss and per round, the sweep reverses mid-flight (`bm.dir *= -1`), and its duration is a full `TAU` of rotation at a speed the fight sets. A fixed one-shot cannot track any of that; a synth voice reading `bm.a`, `bm.spd` and `bm.dir` can — pitch and filter follow the angular velocity, and the reversal becomes a real doppler turn instead of a blip. That is also how a lightsaber "voom" works: the pitch IS the motion.
  - The **charge-up** and the **plate explosions** want **recorded takes**. Explosions are the hardest thing to fake with oscillators, and this is exactly the split `CREDITS.md` already describes: *reactive sounds are synthesized, big moments use recorded one-shots*.
- **Constraints that already apply:** any new cue must obey the draw-only / no-`Math.random` rule in `docs/IN-RUN-VOICE.md` (a sound that draws from the sim RNG desyncs the replay verifier). Vary the six plates by the existing `b.dyingN` counter, never by a roll. Level any new take through the H-13 master limiter and pin it in `scripts/test-sfx-levels.mjs`; the soundboard on 8012 is the instrument (see the sfx-soundboard memory).
- **Options:** (a) synth-only — build the sweep voice and re-voice the plates with better synthesis, no new files; (b) hybrid — synth sweep + recorded charge and plate takes that Gil sources; (c) recorded-only — Gil sources every cue and the sweep take is retriggered/pitched to approximate the rotation.

---

## H-34 · The resting boss lamp breathed the finale's colour
- **Status:** DONE (2026-08-27) · **Area:** Art · **Sev:** MED · **Raised by:** Gil, 2026-08-27 (not from the 2026-08-21 audit)
- **Issue, in Gil's words:** the red light phase "breathes from red to pink/purple which is misleading — it needs to breathe red → dark red (almost black) so it's clear (on the regular phases)".
- **Evidence:** `85-enemy-art.js:1024` mixed `'255,60,90'` toward `'212,101,255'` at t = 0.3…0.6.
- **Why it mattered more than it looked.** `212,101,255` is the LAST STAND lamp's colour, set on the line directly above, and purple is the game's word for "both thumbs". A resting boss was drifting into the finale's vocabulary every three seconds. The ramp also never actually reached red: it ran `rgb(242,72,140)` → `rgb(229,85,189)`, hot pink into magenta.
- **Fix.** `lampMix('255,60,90', '36,3,9', 0.5 - 0.5 * Math.cos(time * 1.7))`. The breath now changes **brightness only, never hue** — red stays the dominant channel the whole way down, so it cannot be misread. The dark end is a deep ember rather than true black, because a lamp that switched fully off would be its own false signal; the core keeps a white-hot pinpoint and both halos are additive, so the swing reads as the light breathing OUT and back in. The rate dropped 2 → 1.7 (period ~3.7s) because the swing is now the full range instead of a third of it, and at the old rate that much travel read as agitated rather than as breathing. Both numbers are the knob, on the same line.
- **`255,60,90` was NOT touched** — it is the game's hostile-red identity across five files. Only the mix target changed.
- **Verified.** `npm test` green, 4 new pins (one fails if the resting branch ever names the last-stand violet again). A real boss test was driven in headless Chrome and both ends of the breath were looked at: bright is a clear red lamp, dark is a near-black ember with only the white pinpoint left. **41 boards, 0 moved** — render-only.
- **FOUND, NOT CHANGED — open for Gil.** A violet ring hugs the lamp in both frames. It is not the lamp: it is the housing's machined mouth at `85-enemy-art.js:1122`, stroked with `gCol`, the accent that deliberately glitches between the hostile red and the interdiction violet and grows as the boss is wounded. It flickers on `time * 11` rather than breathing, so it is a different rhythm from the one Gil described — but it sits right against the lamp. Asked, not yet answered: leave the glitch, or pull the violet out of the accent too.

## H-35 · The sim fingerprint is near-blind — a late-lane change keeps its board id
- **Status:** DONE (2026-08-27) — Gil's ruling: **check the entire level, all of them, and take no shortcuts in fairness and game integrity.** Both halves built.
  1. **The battery now plays the lane out.** `BATTERY_V` 1 → 2. `driveStep` pins integrity every step, before the step, so a hit still counts in `misses` and still scores — only the run's DEATH is withheld. The synthetic pilot is not being asked to be good; the battery measures what spawns and what scores. Measured after: **40/40 boards play to their full authored duration**, against 0/40 before.
  2. **Pickups are recorded too.** V1's signature listed only enemies, so an authored pickup beat was invisible — caught live on patrol relay 04, whose only beat is one shield. The signature now records each orb by kind and angle. With both fixes the battery sees all 7 of H-25's authored beat lanes; with the immortal pilot alone it saw 6.
  3. **The coverage gate.** `npm run test:coverage` (`scripts/test-fingerprint-coverage.mjs`) replays all 40 ranked boards and FAILS if any one does not play out. It is slow, so it sits outside `npm test`, beside the verifier bundle test in the release routine. It exists so V1's blindness cannot return quietly.
  4. **The shortcut is retired.** Per Gil: "no board ids moved" may NEVER again be used to skip a verifier deploy. If anything under `src/game/` or `src/campaigns.js` changed, the verifier ships with the build. The per-board ids are read for ONE purpose now — telling Gil whether a release forces players to update. Written into [[verifier-deploy-before-aab]] and docs/RELEASE-PLAN.md §5.
  - **COST, STATED:** bumping `BATTERY_V` re-issues **every board id exactly once**. A V1 id and a V2 id describe different amounts of evidence and are not comparable, which is precisely what the version field is for. This must ride a release, and the verifier must deploy with it.
- **Found:** 2026-08-27, while checking H-25 item 5's own deploy claim.
- **Issue:** `scripts/lib/sim-fingerprint.js` says of itself that it "plays every ranked board for its FULL duration and records every spawn rather than sampling". It does not. Its synthetic driver sweeps the emitters and fires a pulse every 240 steps, but it never actually defends the convoy — so integrity reaches 0 and the run ends within seconds. Measured over all 40 campaign boards: **every single one dies in 4.2–14.1 seconds** of a 44–79 second lane, recording **7–14 enemies** each. `boards played to the end: 0/40`.
- **Why it matters:** the board id is the deploy decision. A sim change anywhere past ~6 seconds keeps its id, the deployed verifier is then stale in a way nothing reports, and it re-simulates honest runs to a different score and rejects them. That is the exact failure H-01 existed for, and the fingerprint's own header names it as the trap it was written to avoid ("the sim changes, the id does not... and calls them cheats"). It also means every past "no ids moved → render-only, no deploy needed" ruling in this file rests on ~6 seconds of evidence.
- **Not urgent in practice, and why:** the standing pre-AAB routine deploys the verifier before every build regardless ([[verifier-deploy-before-aab]]), so nothing ships broken today. The defect is that the tool's answer is trusted for the SHORTCUT — skipping a deploy — and that shortcut is unsound.
- **Evidence:** `scripts/lib/sim-fingerprint.js:30-35` (the claim), `:112-127` (`driveStep`, the driver that never defends), `:135` (`boardSignature`, whose loop exits on `S.END`). Coverage table reproduced by the probe in this session's scratchpad.
- **My take:** make the battery survive its own lane. The cheapest honest fix is to clamp integrity inside the fingerprint run only — the battery is measuring *what spawns and what scores*, not whether a synthetic pilot can win — and let the loop run the full duration. That is a battery change, so `BATTERY_V` must bump and **every board id moves once**, which is a release-timed decision, not a quiet edit.
- **Options:** (a) clamp integrity in the battery + bump `BATTERY_V` + one full re-issue of all ids, timed with the next release; (b) drive better instead (a defending driver) so ids stay comparable where behaviour truly did not move — more faithful, much more work, and it still moves ids; (c) leave the battery and delete the shortcut instead: treat every sim-source change as deploy-owed and stop reading the fingerprint as permission to skip.

## H-36 · The two ray takes are still not on disk
- **Status:** TODO · **Area:** Audio · **Sev:** MED
- **Issue:** `12-sfx.js` declares `rayCharge: ['audio/sfx/ray-charge.mp3']` and `bossPlate: ['audio/sfx/boss-plate.mp3']`, and neither file exists in `src/audio/sfx/`. Both fall back to synth, which is what actually ships today. Split out of H-33, which is otherwise built and passed Gil's ear pass.
- **Evidence:** `src/game/12-sfx.js:55`; `ls src/audio/sfx/` shows no `ray-charge.mp3` and no `boss-plate.mp3`.
- **My take:** the fallback is good enough to ship — it is the sound Gil has been flying and approving. Track the takes rather than block on them.
- **Options:** (a) land the two CC0 takes Gil is sourcing; (b) declare the synth final and delete the two declarations; (c) leave the declaration as the standing intent and ship on the fallback.
