# Housekeeping backlog

Every finding from the 2026-08-21 audit, one row per item, related findings
combined. The `/housekeeping` skill reads this file, offers the open items in
priority order, then walks the chosen one to a solution.

**Item IDs are stable. Never renumber them.** Priority equals the ID order:
H-01 is the most important, H-30 the least. Reorder by moving the priority note,
not the ID.

Status values: `TODO` → `IN PROGRESS` → `BLOCKED` → `DONE`.
When an item ships, set `DONE`, add the version and a one-line result.

Full evidence and context live in [docs/AUDIT-2026-08-21.md](AUDIT-2026-08-21.md).

---

## Status board

| ID | Status | Area | Sev | Title |
|----|--------|------|-----|-------|
| H-01 | DONE | Release | HIGH | Removed as a backlog item — the verifier deploy is the standing pre-AAB routine |
| H-02 | IN PROGRESS | Backend | HIGH | Boss board integrity — code+SQL DONE & verified; only the release deploy remains (batched with H-01) |
| H-03 | IN PROGRESS | Backend | HIGH | Replay-stealing — code DONE; live storage test PASSED 2026-08-21; only the coordinated 1.0.4 deploy remains |
| H-04 | DONE | Release | HIGH | Recover the deleted feature graphic — restored from HEAD 2026-08-21 |
| H-05 | TODO | Release | HIGH | Turn DEV_KEYS off for production builds |
| H-06 | TODO | Story | HIGH | Wire the dead story copy |
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
| H-17 | TODO | Story | MED | Story line-edit pass + the C5 continuity fork |
| H-18 | DONE | Story | MED | NEXT CONTRACT ▸ on the report + the bark fade fixed (countdown → H-15, dossier → H-06) |
| H-19 | DONE | Decision | MED | Canon settled — episodic contracts; address is Vanguard/vanguards, "runner" only as accent; wolves retired |
| H-20 | TODO | Audio | MED | Audio breadth — fanfare tiers, boss-duel music, sonar phase, coverage |
| H-21 | TODO | Art | LOW | Restore menu film grain |
| H-22 | TODO | Art | LOW | Gate facing variants |
| H-23 | TODO | Journey | LOW | Enlistment tap-to-complete |
| H-24 | TODO | Journey | LOW | Delete dead code — scroll machinery + beam subsystem |
| H-25 | TODO | Balance | LOW | Boss tuning pass + count volley zaps + split C1L7 lock intro |
| H-26 | TODO | Backend | LOW | Backend hardening — name filter, delete residuals, admin auth |
| H-27 | TODO | Art | LOW | Station bake polish — SPINE hoops + GATE aperture |
| H-28 | TODO | Balance | LOW | Ship unused depth — crawlers drift, noCharge drone, more beats |
| H-29 | TODO | Docs | LOW | Doc drift pass |
| H-30 | TODO | Content | LOW | The 40 briefing-disc keyframes |
| H-31 | DONE | Balance | MED | Power-ups never land inside a dead-zone carpet — both spawners fixed + a pinned test (ships in 1.0.4) |

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
- **Status:** IN PROGRESS (chosen: RNG side-stream + bounty decay + timeSec board penalty) · **Area:** Backend/Balance · **Sev:** HIGH
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
- **Status:** IN PROGRESS (chosen: private bucket + signed URLs + frame-hash binding + oracle fix) · **Area:** Backend · **Sev:** HIGH
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

## H-06 · Wire the dead story copy
- **Status:** TODO · **Area:** Story · **Sev:** HIGH (value)
- **Combines:** S-1
- **Issue:** the strongest writing never renders. The five verdict epilogue `lines` lose to a precedence bug, the five campaign `story` paragraphs render nowhere, and all 40 level `hint` strings render nowhere. The closure disc shows the weakest text instead.
- **Evidence:** `91-briefing.js:513`; `campaigns.js:78`; `editor.js:1086`; `90-hud.js:509`.
- **My take:** cheapest story win in the codebase. Start with the verdict lines: one precedence change on the closure disc, which was built with room for them.
- **Inherited from H-18 (2026-08-23):** the dossier client/cargo sub-item lands here. Wiring the `story` paragraph onto the contract disc delivers the client and the cargo with it — no new authored field needed.
- **Options:** (a) verdict epilogue lines only; (b) verdict lines + the story paragraph on the carousel or a dossier tab; (c) all three, with the hint as a subtitle on the pre-run disc.

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
- **Status:** TODO · **Area:** Story · **Sev:** MED (no code)
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
- **Status:** TODO · **Area:** Audio · **Sev:** MED (production value)
- **Combines:** audio upgrades 3, 4, 6, 7 + coverage gaps + interruption handler
- **Issue:** NEW BEST and 1/2/3-star share one cue. The boss duel has no music identity. The sonar tick uses one timbre for every threat. Briefings, unlocks, and combo milestones are silent. No phone-call interruption handler.
- **Evidence:** `61-replay.js:422`; `52-bosses.js`; `72-tick.js:719`; `91-briefing.js`; `60-input.js:342`.
- **My take:** a batch of small wins. Fanfare tiers and the interruption handler ship first. Sonar phase timbre adds threat identity to the one always-on channel.
- **Options:** (a) fanfare tiers only; (b) + boss-duel music treatment (no new track); (c) + sonar phase vocabulary; (d) full batch including interruption handler + briefing tick.

## H-21 · Restore menu film grain
- **Status:** TODO · **Area:** Art · **Sev:** LOW (one line)
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
- **Status:** TODO · **Area:** Journey · **Sev:** LOW
- **Combines:** journey finding 8
- **Issue:** a tap during enlistment typing does nothing, so a new player waits about 7s per beat with no fast-forward.
- **Evidence:** `60-input.js:676`; `91-briefing.js:1131`.
- **My take:** first tap completes the line, second advances. Standard convention, touches every new player's first minute.
- **Options:** (a) first-tap-completes convention; (b) a small SKIP affordance after the first beat.

## H-24 · Delete dead code — scroll machinery + beam subsystem
- **Status:** TODO · **Area:** Journey/Cleanup · **Sev:** LOW
- **Combines:** journey findings 4, 11
- **Issue:** `menuScroll`, `mapListScroll`, `menuPtr.mapScroll0`, and an unreachable `menuLbRect` branch are written but read by no painter. The beam subsystem is flagged for removal.
- **Evidence:** `60-input.js:240,311,238,430`; `92-guide.js:629`; `40-state.js:157`.
- **My take:** pure removal, zero player impact, but it is live input code writing ghost state. Do the flagged focused removal.
- **Options:** (a) scroll machinery only; (b) + beam subsystem; (c) both plus the `crawlers` dead knob (overlaps H-28).

## H-25 · Boss tuning pass + count volley zaps + split C1L7 lock intro
- **Status:** TODO · **Area:** Balance · **Sev:** LOW
- **Combines:** C-7, boss tuning observations
- **Issue:** prism's "unequal speeds" tell converges by round 5. The blockade last-stand sweep never accelerates. Volley kills do not increment `zaps`, undercounting volley styles in the tiebreak. C1L7 stacks the lock debut with bursts at the steepest jump.
- **Evidence:** `52-bosses.js:591,679`; `72-tick.js:625`; `campaigns.js:68`.
- **My take:** escalate the last-stand sweep with rounds, keep prism speeds honestly unequal, count volley zaps, and split C1's lock intro across L6/L7. Boss-board ids move, so batch with H-02.
- **Options:** (a) volley zaps + C1L7 split only (cheap); (b) + boss escalation tuning; (c) full pass, batched with H-02.

## H-26 · Backend hardening — name filter, delete residuals, admin auth
- **Status:** TODO · **Area:** Backend · **Sev:** LOW
- **Combines:** backend lower findings F5, F6, F7
- **Issue:** the name filter is ASCII-only so homoglyphs are stripped not folded, with Scunthorpe false positives and no server min-length. Account delete leaves reports-filed-by and orphaned traces. The local admin `/api/act` runs destructive writes with no auth.
- **Evidence:** `submit-run/index.ts:62`; `my-data/index.ts:129`; `scripts/admin.js:120`.
- **My take:** three independent small hardenings. The admin auth is the one with a real (if bounded) exploit path.
- **Options:** (a) admin auth only; (b) + name-filter NFKC/homoglyph folding + min-length; (c) all three including the delete residuals.

## H-27 · Station bake polish — SPINE hoops + GATE aperture
- **Status:** TODO · **Area:** Art · **Sev:** LOW
- **Combines:** art findings 4, 5
- **Issue:** SPINE reads as cogs at rest (36 cladding boxes per torus). GATE's baked aperture is a flat teal dish at rest and leans entirely on live layers.
- **Evidence:** `81-station3d.js:656,368`.
- **My take:** halve SPINE's pad count and vary pad lengths for an armour read. Raise GATE filament contrast or add a centre vortex. Lab-drivable, then rebake.
- **Options:** (a) SPINE only; (b) GATE aperture only; (c) both.

## H-28 · Ship unused depth — crawlers drift, noCharge drone, more beats
- **Status:** TODO · **Area:** Balance · **Sev:** LOW (optional depth)
- **Combines:** C-8, C-9, C-10
- **Issue:** three built systems ship no content. `crawlers` is rolled and discarded though `en.drift` exists. The `noCharge` purple pressure drone is one flag from use. Only 3 of the 8 beat types are authored.
- **Evidence:** `50-enemies.js:30`; `72-tick.js:717,856`; `52-bosses.js:56`; `51-linter.js`.
- **My take:** genuine new reads from the two dials, no new inputs. Crawlers cost zero extra RNG draws if drift derives from the already-drawn `spin`. The drone and new beats move edited board ids.
- **Options:** (a) crawlers only (zero sim-id cost on shipped levels); (b) + author enemy/lock beats into C2/C4; (c) + deploy the pressure drone into C5, batched with a sim-id release.

## H-29 · Doc drift pass
- **Status:** TODO · **Area:** Docs · **Sev:** LOW
- **Combines:** doc drift across the audit
- **Issue:** several docs describe what the code no longer does. PRODUCT.md wheel names + track count + screenshot line; PRIVACY-POLICY.md deletion paragraph; CLOUD-SAVE-PLAN.md monetization header; CREDITS.md format/cadence/symbol; RELEASE-PLAN.md iOS line; the `20-background.js:845` RNG comment.
- **Evidence:** listed in the audit §7.
- **My take:** one reconciliation pass. The CLOUD-SAVE-PLAN monetization header is the one that could mislead a future build (it names an ads/consent flow the game must not have).
- **Options:** (a) fix only the two that could mislead a build (CLOUD-SAVE-PLAN, PRIVACY-POLICY); (b) full doc-drift sweep across all six.

## H-30 · The 40 briefing-disc keyframes
- **Status:** TODO · **Area:** Content · **Sev:** LOW (largest lift)
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
