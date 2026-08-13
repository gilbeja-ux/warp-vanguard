# Release Plan — WARP VANGUARD

Target: **Google Play, v1.0.0.** iOS follows as a second phase.

## Decisions (locked 2026-08-13)

| | Decision | Why |
|---|---|---|
| **Store** | Google Play first | Android already builds and installs. iOS costs a project that does not exist yet, a $99/yr account, and a stricter review — all before any real feedback. |
| **Money** | **Free, no IAP in v1** | Fastest route to live: no billing plugin, no entitlement store, no restore-purchase flow, no IAP review. The free-demo + one-time-unlock model (below) lands in 1.1, priced against real retention numbers instead of a guess. |
| **Leaderboards** | Ship them | Built, verified, deployed; the weekly ladder is the retention hook. The price is real compliance work — §2 — and it is worth paying. |

### Deferred to 1.1 — the monetization model (decided 2026-07-14, unchanged)

Free demo + one-time unlock: relays 1–3 free, a single lifetime purchase
(~$2.99–4.99) unlocks the full campaign and FREE FLOW at the existing
relay-04 seam. **No** consumables, **no** forced ads, **no** pay-per-campaign
— all three contradict the game's skill-fairness identity. Implementation:
Play Billing via a Capacitor plugin plus an offline entitlement flag checked
alongside `progress`. Post-launch options: a cosmetic supporter pack (node
skins via the `SPRITES` hook), and web-portal builds (Poki / CrazyGames /
itch.io) as a funnel.

---

## Verified starting state (2026-08-13)

| Fact | Value | Consequence |
|---|---|---|
| App id | `com.warpvanguard.game` | Permanent once published — **cannot be changed**. Confirm before first upload. |
| Version | `1.0.0`, versionCode `1`, versionName `1.0` | Needs a bump discipline (§4). |
| Signing | **Debug only** | Blocker. Play refuses debug-signed uploads. |
| `targetSdk` | 34 | Play enforces a rolling minimum; 34 is very likely below it now. **Verify current requirement.** |
| `minSdk` | 22 | Fine — wide reach. |
| iOS project | **Does not exist** | `@capacitor/ios` is a devDependency but `npx cap add ios` was never run. Phase 2. |
| Orientation | `sensorLandscape` in the manifest | ✅ Already correct — the `@capacitor/screen-orientation` item in the old plan is **not needed**. |
| Icons | Launcher + adaptive + web manifest, regenerated from the new brand | ✅ Done 2026-08-12. |
| Data collected | Anonymous Supabase id, self-chosen handle, scores/stats, input traces | Drives §2 entirely. No ads, no analytics, no tracking SDKs, no email/provider sign-in. |
| CI | None | §4. |
| Dev key | "BOSS TEST" long-press still ships | Blocker — §1. |

---

## §1 — Code blockers (must change before any upload)

- [ ] **Remove the BOSS TEST dev shortcut.** The menu long-press, `startBossTest()`,
      and its `bossTestRun` plumbing (`60-input.js`, `99-boot.js`). Shipping a
      cheat that jumps to any finale undermines the leaderboard's whole claim.
- [ ] **Release signing.** Generate an upload keystore, wire a `release`
      signingConfig reading from `key.properties`, enrol in **Play App Signing**.
      **Add `*.jks`, `*.keystore`, `key.properties` to `.gitignore` FIRST** — they
      are not ignored today, and a committed key is unrecoverable: lose or leak
      the upload key and you cannot ship updates to the same listing.
- [ ] **`targetSdk` bump** to Play's current minimum. Two known knock-ons to test,
      not assume: **edge-to-edge enforcement** (Android 15+ draws under the system
      bars — this game is fullscreen landscape, so verify the ring is not clipped
      on gesture-nav devices) and the **16 KB page-size** requirement for native
      libraries.
- [ ] **`minifyEnabled`/R8** left `false` — decide deliberately. Off is safer for
      a WebView game (no JS is minified by R8 anyway); the size win is negligible.
- [ ] **Bundle format**: build an **AAB** (`bundleRelease`), not the APK. The
      current `npm run apk` script is a sideload artefact and stays that way.

## §2 — Compliance (the cost of leaderboards)

Everything here follows from one fact: the game sends an anonymous id, a
player-chosen handle, and run data to a server.

- [ ] **Privacy policy, publicly hosted at a stable URL.** Mandatory for both
      stores. Must state: anonymous account id, chosen display name, scores and
      input traces; that there is no advertising, analytics or tracking; retention;
      and how to request deletion. *(I can draft it; hosting is yours — GitHub
      Pages off this repo is the cheap answer.)*
- [ ] **Play Data Safety form.** Must match reality exactly, and mismatches are a
      common rejection. Expected answers: collects *User IDs* (anonymous) and
      *App activity / in-game actions*; data **is** transmitted off-device; **not**
      used for tracking or advertising; encrypted in transit; deletion available.
- [ ] **Data deletion path.** Play requires a way to request account/data deletion
      for apps with accounts — anonymous ones included. Cheapest compliant version:
      an in-game "delete my leaderboard data" action that calls a Supabase function
      to purge rows for that player id, plus a stated email/web route for anyone who
      has uninstalled.
- [ ] **UGC handling for player handles.** Server-side moderation already exists
      (`submit-run`). Stores also expect a **report mechanism** and the ability to
      act on reports. Minimum viable: a report control on the board rows plus a
      documented takedown route.
- [ ] **Content rating questionnaire** (IARC, via Play Console). Expect ~E/PEGI 3
      with an interactive-elements flag for **user interaction** (leaderboards +
      handles). Answer honestly; the flag is normal.
- [ ] **CREDITS.md `_TBC_` placeholders.** 13 recorded SFX are CC0/royalty-free but
      the per-file source URLs are still blank. Fill before shipping — attribution
      hygiene, and it is evidence if a claim ever lands.
- [ ] **Name clearance** on "Warp Vanguard" — Play/App Store search plus a
      trademark check. Rebranding after launch costs the listing's whole history.

## §3 — Store listing assets

- [ ] **Screenshots.** Play wants phone shots (min 2, up to 8) plus 7"/10" tablet
      sets if you list tablet support. *I can generate these from the real game
      headlessly at exact device resolutions — the harness already renders arrivals,
      duels and the chart.* `docs/STORE-LISTING-BRIEF.md` already specifies 7 shots.
- [ ] **Feature graphic**, 1024×500 — required, and it is the image at the top of
      the listing. The new brand lockup on a lane backdrop.
- [ ] **App icon**, 512×512 — from the new badge master.
- [ ] **Short (80 char) + full (4000 char) description.** The brief has the copy
      direction; needs writing against the final feature set.
- [ ] **Optional but high-value: a 30s trailer.** Captured from real play.

## §4 — Engineering hygiene

- [ ] **CI**: run `npm test` (the headless harness) and `node scripts/test-board.js`
      on push. The suite is the safety net for a codebase with no type system.
- [ ] **Version discipline**: `package.json`, `versionName`, and `versionCode` move
      together. versionCode must increase on **every** upload, forever.
- [ ] **Verifier/sim-id gate**: any sim change requires rebuild + redeploy +
      `verifier:status`. A shipped client whose sim id differs from the deployed
      function fails every submission. **This becomes far more dangerous once real
      players exist** — an update mid-rollout means two client versions in the wild
      against one server. Decide the policy before launch (recommend: server
      accepts the current and previous sim id).
- [ ] **Low-end device pass**: verify the `lowFX` watchdog trips *and* releases —
      `scripts/bench.js --target=phone --pin=none` shows the latch live.
- [ ] **Pre-ship tuning pass**: boss knobs (`BOSS_FEED`, `LEECH_WAVE_GAP`,
      `LAMP_HOLD`), endless ramp in `endlessCfg()`.

## §5 — Launch sequence

1. Play Console account ($25, one-time). Identity verification can take days — **start this first**, it is the longest pole that involves waiting on someone else.
2. Create the app; reserve `com.warpvanguard.game`.
3. Upload the first AAB to **internal testing** (fastest track, no review wait) — proves signing, install, and the leaderboard path on real devices.
4. Complete the compliance forms (§2). They gate promotion out of testing.
5. **Closed testing** with real testers. Play requires a sustained closed test with a minimum tester count before a personal developer account can go to production — **verify the current threshold and duration**, as it materially sets the launch date.
6. Open testing (optional) → **Production**, staged rollout (start ~10-20%).

---

## Sequencing note

§1 and §4 are mine and can start immediately. §2's forms and §5's account
depend on you. The critical path is almost certainly **the Play account +
closed-testing requirement**, not the code — which is why §5.1 should happen
today even though nothing is ready to upload.
