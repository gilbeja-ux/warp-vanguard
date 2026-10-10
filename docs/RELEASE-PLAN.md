# Release Plan — WARP VANGUARD

**Where it stands (2026-10-10).** The game is in **open testing on Google Play**
(since 2026-09-18) and **live on the App Store**: 1.0.11, the performance build,
went to both stores on 2026-10-05. **1.0.12 is next**: the called first-run
course and the screen type cap (docs/CHANGELOG.md). **1.1** adds the paywall
below. Every release ships to both platforms (CLAUDE.md, *Two platforms, one fix*).

## Decisions (locked 2026-08-13, updated since)

| | Decision | Why |
|---|---|---|
| **Store** | Google Play first, then the App Store | Done in that order. Play went to internal, closed and then open testing; the iOS shell was rebuilt 2026-09-04, the Apple Developer enrolment followed, and 1.0.11 passed App Review. `npm run ios:archive` is the upload path. |
| **Money** | **Free, no IAP until 1.1** | Fastest route to live: no billing plugin, no entitlement store, no restore-purchase flow, no IAP review. Open testing ships everything free. The free-demo + one-time-unlock model (below) lands in 1.1. |
| **Leaderboards** | Shipped | Built, verified, deployed: every campaign stage and the weekly lane have a board, and `submit-run` replays each trace before it accepts a score. Free flow (endless) is unranked since 1.0.10. The price was real compliance work — §2. |

### 1.1 — the monetization model (seam moved 2026-09-04, re-affirmed since)

Free demo + one-time unlock: **contract 1 rides free end to end — stages
01–08, boss included** — and a single lifetime purchase ($2.99) unlocks
contracts 2–5 at the **stage-09 seam**, plus filing a score on the WEEKLY
ranked lane. FREE FLOW endless stays free — it opens at stage 05, inside the
free contract, and it has no board to protect. The
offer lands after the contract 1 boss verdict, at peak satisfaction, never at
a locked door mid-campaign. (The seam sat at stage 04 until 2026-09-04; Gil
moved it to the end of contract 1.) **No** consumables,
**no** ads, **no** pay-per-campaign — all three contradict the game's
skill-fairness identity. Implementation: Play Billing and StoreKit via a Capacitor
plugin plus an offline entitlement flag checked alongside `progress` — and the check
must live **inside `startLevel`**, not in menu navigation: the boss-duel
passcode shortcut (and any future door) has to hit the same wall. Post-launch
options: a cosmetic supporter pack (node skins via the `SPRITES` hook), and
web-portal builds (Poki / CrazyGames / itch.io) as a funnel.

**Sequencing note — see `docs/CLOUD-SAVE-PLAN.md`.** A store entitlement is tied
to the store account and restores automatically on reinstall, but campaign
progress is device-local and does not. Shipping billing first therefore ships a
game where the player's *purchase* survives a new phone and their *progress*
does not. Billing already forces an account rail onto both builds, and
cloud save wants the same one, so decide whether the two are one piece of work.

---

## Current state (2026-10-10)

| Fact | Value | Note |
|---|---|---|
| App id | `com.warpvanguard.game` | Permanent; published on both stores. App Store id `6818248157`. |
| Version | `1.0.11`, versionCode `10011`; 1.0.12 next | `scripts/sync-version.js` writes Gradle and the Xcode project from `package.json`, so a hand-edited number cannot drift (§4). |
| Signing | Release keystore + Play App Signing; Apple Developer team | `android/key.properties` (gitignored); `ios:archive` signs with the team. |
| `targetSdk` | 36 | Play's floor moved to 36 on 31 August 2026; done 2026-08-14. |
| `minSdk` | 24 | Capacitor 8's floor (2026-09-04). Android 5.1 and 6.0 drop; under one percent of devices. |
| R8 | `minifyEnabled true`, `shrinkResources true` | Device pass cleared at 1.0.2 on Capacitor 6 and at 1.0.6 on Capacitor 8.5.1; the next one is due at the next Capacitor major. |
| Orientation | `sensorLandscape` in the manifest, landscape-only in the plist | No `@capacitor/screen-orientation` needed. |
| Data collected | Anonymous Supabase id, self-chosen handle, scores/stats, input traces, optional feedback | Drives §2 entirely. No ads, no analytics, no tracking SDKs, no email/provider sign-in. |
| CI | `.github/workflows/test.yml` | The pin suites and the verifier bundle on every push, plus the browser smoke in a real Chrome. |
| Dev key | The boss-duel long-press ships behind a passcode disc | Settled 2026-09-04 (§1). |

---

## §1 — Code blockers (must change before any upload)

- [x] **The BOSS TEST shortcut ships, behind a passcode** (Gil, 2026-09-04 —
      this replaces the old "remove it" item). The long-press now opens a
      "BOSS DUEL SHORTCUT" disc; only the tester passcode (`BOSS_GATE_PASS`
      in `40-state.js`) launches the drill. The boards were never exposed: a
      drill sets `bossTestRun` and files nothing, and the verifier rejects a
      jumped trace. `npm test` pins the gate (wrong passcode holds, right one
      launches, a drill files nothing). Residual: the passcode is plain text
      in the bundle — the only thing behind it is a spoiler. The 1.1 paywall
      must gate INSIDE `startLevel` so this door hits the same wall.
- [x] **Release signing.** An upload keystore, a `release` signingConfig reading
      `key.properties`, and **Play App Signing**. `*.jks`, `*.keystore` and
      `key.properties` are gitignored: a committed key is unrecoverable.
- [x] **`targetSdk` 36**, Play's floor since 31 August 2026 (done 2026-08-14).
- [x] **R8 on** (`minifyEnabled true`, `shrinkResources true`), with a device pass
      at 1.0.2 and again at 1.0.6 on Capacitor 8.5.1.
- [x] **Bundle format**: `npm run aab` builds the signed **AAB**. `npm run apk`
      stays a sideload artefact.

## §2 — Compliance (the cost of leaderboards)

Everything here follows from one fact: the game sends an anonymous id, a
player-chosen handle, and run data to a server.

- [x] **Privacy policy, publicly hosted at a stable URL.** `docs/privacy.html`,
      served by GitHub Pages at
      **https://gilbeja-ux.github.io/warp-vanguard/privacy.html**.
      Owner enables it once: *Settings → Pages → branch `master`, folder `/docs`*.
- [x] **Play Data Safety form.** Filed; the answers are in
      `docs/PLAY-CONSOLE-ANSWERS.md`. Must match reality exactly, and mismatches are a
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
- [x] **Legitimate interest, not consent — keep it that way.** `privacy.html` now
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
      provably legitimate, so that traffic would only bury the reports a human
      must read.

      **Acting on reports** is `report_run`: one report per person per row, and at
      **three distinct reporters an UNVERIFIED row's name is redacted and locked**
      (since 1.0.10 every row that can still be filed is verified, so in practice
      reports queue). Verified campaign/weekly rows never auto-act — they are records someone
      earned, so an automatic action there is worth more to a brigade than to a
      moderator. Those queue; read them in the `reports` table.
- [x] **A dedicated feedback address — DONE 2026-09-01.** `hello@gb-il.cloud`, in
  all five places at once: `FEEDBACK_EMAIL` in `src/game/92-guide.js` (the
  tap-to-copy address on the FEEDBACK disc), `docs/privacy.html`,
  `docs/delete-data.html`, `docs/PRIVACY-POLICY.md` and the Play Console contact
  field. `npm test` fails if the constant is ever set to something that only looks
  like an address. Merged; GitHub Pages serves `/docs` from `master`.

- [ ] **Watch the `reports` table.** Nothing notifies you. Verified rows above the
      threshold sit there until a human looks. Worth a weekly glance, or a Supabase
      scheduled digest if it ever gets traffic.
- [x] **Content rating questionnaire** (IARC, via Play Console). Filed; the answers
      are in `docs/PLAY-CONSOLE-ANSWERS.md`, with the interactive-elements flag for
      **user interaction** (leaderboards + handles).
- [x] **CREDITS.md audio licensing — settled.** The pool takes are CC0 (Sonniss /
      Kenney / Freesound), which requires no attribution; the per-file origins were
      never recorded, and the file now says so instead of claiming a chain of title
      it could not show. The two boss takes are Pixabay Content License — recorded
      separately because Pixabay is *not* CC0 — and it permits commercial use with
      no attribution, so nothing is owed at launch or at the 1.1 paid unlock.
- [x] **Name clearance** on "Warp Vanguard" — screened clear 2026-08-21
      (`docs/NAME-CLEARANCE.md`). Never brand with a bare "Vanguard".

## §3 — Store listing assets

All shipped; `docs/STORE-MATERIALS.md` is the source of store copy and art, and
`scripts/store-shoot.js` re-shoots the stills from the real game.

- [x] **Screenshots**, phone and tablet sets, shot headlessly at exact device sizes.
- [x] **Feature graphic**, 1024×500.
- [x] **App icon**, 512×512 (`docs/store/wv-512-store.png`).
- [x] **Short + full description.**
- [ ] **Optional: a 30s trailer.** `scripts/store-shoot.js --video` records stage
      play with a bot; the captions, the music take and the upload are open.

## §4 — Engineering hygiene

- [x] **CI**: `.github/workflows/test.yml` runs the pin suites and the verifier
      bundle cross-test on every push, and the browser smoke in a real Chrome.
- [x] **Version discipline**: `package.json` is the only source;
      `scripts/sync-version.js` writes `versionName`/`versionCode` and the Xcode
      project's two versions. versionCode rises on every upload, forever.
- [x] **Verifier/sim-id policy**: every sim change deploys the verifier. When the
      fingerprint says 0 boards moved, `--compatible` keeps the recent ids verifying,
      so a player on the previous build is not told to update; when a board moved,
      strict. A build whose board the server no longer knows marks that stage
      `UPDATE GAME TO POST SCORES` before it is flown (the update mark, 2026-10-01).
- [ ] **Low-end device pass**: verify the `lowFX` watchdog trips *and* releases —
      `scripts/bench.js --target=phone --pin=none` shows the latch live.
- [ ] **Pre-ship tuning pass**: boss knobs (`BOSS_FEED`, `LEECH_WAVE_GAP`,
      `LAMP_HOLD`), endless ramp in `endlessCfg()`.

## §5 — Launch sequence

> **⏰ PRE-BUILD DEPLOY GATE (every new version, before the AAB).** Run these two,
> in this order, BEFORE `npm run aab`, or players on the new binary post into a
> stale server / an unmigrated board:
> 1. `npm run deploy:verifier` — required whenever ANYTHING under `src/game/` or
>    `src/campaigns.js` changed, a comment included: any byte moves the sim id, and the
>    pre-push hook refuses a sim the deployed verifier does not know. The change only
>    decides the flag: `-- --compatible` when the fingerprint says 0 boards moved,
>    strict when a board moved or boss code changed (the battery barely reaches a
>    boss fight; see H-35 and `npm run test:coverage`). The fingerprint is evidence
>    for the flag, never permission to skip the deploy (Gil, 2026-08-27).
> 2. `supabase db push` — required whenever a migration is owed. A migration that
>    changes what an older client can read ships WITH the client that needs it,
>    never ahead of it (the 1.0.4 private-traces lesson).

1. [x] Play Console account.
2. [x] Create the app; `com.warpvanguard.game` reserved.
3. [x] **Internal testing** — signing, install and the leaderboard path proven on real devices.
4. [x] The compliance forms (§2).
5. [x] **Closed testing** with real testers.
6. [x] **Open testing**, live since 2026-09-18 (`docs/OPEN-TESTING-PLAN.md`).
7. [x] **App Store**: enrolment, TestFlight, App Review; 1.0.11 approved.
8. [ ] **Play production**, staged rollout (start ~10-20%).
9. [ ] **1.1**: the paywall (above), on both stores at once.

---

## What is still open

- §2: the Art. 30 record of processing, and a weekly look at the `reports` table.
- §4: the low-end `lowFX` pass and the pre-ship boss tuning pass.
- §5: Play production, then 1.1 and its paywall.
