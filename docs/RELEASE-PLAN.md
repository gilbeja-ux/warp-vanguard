# Release Plan — WARP VANGUARD

Target: **Google Play, v1.0.0.** iOS follows as a second phase.

## Decisions (locked 2026-08-13)

| | Decision | Why |
|---|---|---|
| **Store** | Google Play first | Android already builds and installs. iOS now has a project (`ios/App/`), but it builds for the **simulator only** — a device or App Store build needs a $99/yr Apple Developer enrolment and a stricter review, all before any real feedback. |
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

**Sequencing note — see `docs/CLOUD-SAVE-PLAN.md`.** A Play entitlement is tied
to the Google account and restores automatically on reinstall, but campaign
progress is device-local and does not. Shipping billing first therefore ships a
game where the player's *purchase* survives a new phone and their *progress*
does not. Billing already forces an account rail onto the Android build, and
cloud save wants the same one, so decide whether the two are one piece of work.

---

## Verified starting state (2026-08-13)

| Fact | Value | Consequence |
|---|---|---|
| App id | `com.warpvanguard.game` | Permanent once published — **cannot be changed**. Confirm before first upload. |
| Version | `1.0.4`, versionCode `10004`, versionName `1.0.4` | ✅ The discipline landed: `scripts/sync-version.js` writes both from `package.json`, so a hand-edited number cannot drift (§4). |
| Signing | **Release keystore, with a debug fallback** | ✅ `signingConfigs.release` is used when the keystore is present, debug otherwise (`android/app/build.gradle:64`). The signed 1.0.4 bundle was cut. |
| `targetSdk` | 34 | Play enforces a rolling minimum; 34 is very likely below it now. **Verify current requirement.** |
| `minSdk` | 22 | Fine — wide reach. |
| iOS project | **Exists, simulator only** | `ios/App/` was added; `npm run ios:build` runs in the simulator. A device or App Store build is blocked on Apple Developer enrolment. Phase 2. |
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

- [x] **Privacy policy, publicly hosted at a stable URL.** `docs/privacy.html`,
      served by GitHub Pages at
      **https://gilbeja-ux.github.io/warp-vanguard/privacy.html**.
      Owner enables it once: *Settings → Pages → branch `master`, folder `/docs`*.
- [ ] **Play Data Safety form.** Must match reality exactly, and mismatches are a
      common rejection. Expected answers: collects *User IDs* (anonymous) and
      *App activity / in-game actions*; data **is** transmitted off-device; **not**
      used for tracking or advertising; encrypted in transit; deletion available.
- [x] **Data deletion path — SHIPPED IN-APP.** The **MY DATA** panel, reached from
      the leaderboard screen and from *System Config*, offers two verbs backed by
      the `my-data` Edge Function: *rename my runs* (every row, every board) and
      *delete my runs* (rows + replay traces + the anonymous auth user). Ownership
      is proved by the session JWT — the only proof an anonymous identity has, and
      a better one than the old email route, which asked for a display name anyone
      could read off a public board. Email survives as the fallback for players who
      have uninstalled, and `privacy.html` now states plainly that without the
      device-held id we may be unable to identify their entries.

      **Neither store ever required this.** Play's and Apple's deletion mandates
      are scoped to *account creation* — Play defines an app account as a
      user-facing identity serving the user across apps and devices, which the
      Supabase anon uid is not. It was built because GDPR Art. 21 does apply, and
      because the control is the cheapest way to authenticate a request.
- [ ] **Legitimate interest, not consent — keep it that way.** `privacy.html` now
      names Art. 6(1)(f) as the basis. This is deliberate and load-bearing: under
      *consent*, Art. 7(3) makes withdrawal trivial and Art. 17(1)(b) turns it into
      an automatic erasure trigger, so every request would have to be honoured in
      full. Under legitimate interest a player must *object* (Art. 21), and board
      integrity is a defensible ground for keeping the **score** while the **name**
      is reset — which is why the rename exists beside the delete. Do not reword
      the policy into consent language.
- [x] **Supabase DPA — already in force, nothing to click.** Art. 28 requires a
      written contract with any processor handling personal data on your behalf,
      covering security, sub-processors, deletion and audit. Supabase's is the
      [Data Processing Addendum](https://supabase.com/legal/customer-resources/data-processing-addendum)
      (Version 1, 1 August 2026), and it executes **automatically** with the Terms
      of Service — *"acceptance of the Agreement shall have the same effect as
      signing the SCCs"* (Schedule 2 §1.2), with the same wording for the UK
      addendum. There is no dashboard toggle and nothing to sign and email; a
      previous draft of this file said there was, and that was wrong.

      So `privacy.html`'s claim that Supabase acts *"under a data processing
      agreement"* is already true. The Standard Contractual Clauses for
      international transfers come bundled in the same document, which is the
      other thing Art. 28 would otherwise have needed separately.

      **What would change this:** adding any processor that is not Supabase — an
      analytics SDK, a crash reporter, an email service, a CDN that sees user
      data. Each needs its own Art. 28 contract and its own line in the policy.
- [ ] **Art. 30 record of processing.** The <250-employee exemption in Art. 30(5)
      lapses when processing is not "occasional", and a live leaderboard is not.
      One internal page, written once. Art. 27 (EU representative) is the same
      shape of argument and is effectively never enforced at this scale — note it,
      revisit if the game gets big.
- [x] **UGC handling for player handles — SHIPPED.** Three layers now: the client
      filter as you type, the server word-list backstop in `submit-run` (and
      `my-data` on rename), and a **report** route — a muted *report this* link at
      the foot of each entry's detail column, opening three canned reasons
      (offensive / real name or personal info / impersonation). No free text: it
      would be UGC needing its own moderation, and it is the field an angry player
      types abuse into. Cheating is deliberately absent — a verified run is
      provably legitimate and endless is unadjudicable, so that traffic would only
      bury the reports a human must read.

      **Acting on reports** is `report_run`: one report per person per row, and at
      **three distinct reporters an UNVERIFIED row's name is redacted and locked**.
      Verified campaign/weekly rows never auto-act — they are records someone
      earned, so an automatic action there is worth more to a brigade than to a
      moderator. Those queue; read them in the `reports` table.
- [ ] **Watch the `reports` table.** Nothing notifies you. Verified rows above the
      threshold sit there until a human looks. Worth a weekly glance, or a Supabase
      scheduled digest if it ever gets traffic.
- [ ] **Content rating questionnaire** (IARC, via Play Console). Expect ~E/PEGI 3
      with an interactive-elements flag for **user interaction** (leaderboards +
      handles). Answer honestly; the flag is normal.
- [x] **CREDITS.md audio licensing — settled.** The pool takes are CC0 (Sonniss /
      Kenney / Freesound), which requires no attribution; the per-file origins were
      never recorded, and the file now says so instead of claiming a chain of title
      it could not show. The two boss takes are Pixabay Content License — recorded
      separately because Pixabay is *not* CC0 — and it permits commercial use with
      no attribution, so nothing is owed at launch or at the 1.1 paid unlock.
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

> **⏰ PRE-BUILD DEPLOY GATE (every new version, before the AAB).** Run these two,
> in this order, BEFORE `npm run aab`, or players on the new binary post into a
> stale server / an unmigrated board:
> 1. `npm run deploy:verifier` — required whenever ANYTHING under `src/game/` or
>    `src/campaigns.js` changed. NOT "whenever a sim id moved": that shortcut is
>    retired (Gil, 2026-08-27). The fingerprint is evidence, never permission to
>    skip — BATTERY_V 1 played only the first 4–14s of every lane and reported
>    late-lane sim changes as "nothing moved". See H-35 and `npm run test:coverage`,
>    which replays all 40 boards and fails if any does not play out.
> 2. `supabase db push` — required whenever a migration is owed.
>
> **1.0.4 specifically** carries H-02 (boss board integrity) and H-03 (replay-stealing
> fix). `deploy:verifier` ships the new sim bundle AND the changed submit-run function;
> `db push` applies two migrations — `20260821000000_boss_board_time_tiebreak.sql` (H-02)
> and `20260821000001_trace_owner_binding.sql` (H-03). Gil pre-authorized running both
> commands automatically when he asks to create the 1.0.4 AAB.
> ⚠ Two caveats: (1) neither migration was run against a live DB — review against
> staging first if one exists; (2) H-03's migration takes the `traces` bucket PRIVATE,
> which breaks replay playback on any client still fetching the public URL — so it must
> ship WITH the 1.0.4 client (which fetches signed URLs), never ahead of it.

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
