# Release Plan — WARP VANGUARD

**Where it stands (2026-10-11).** The game is in **open testing on Google Play**
(since 2026-09-18) and **in App Review for the App Store**: 1.0.11, the performance
build, went to both stores on 2026-10-05, and Apple still lists it as "Waiting for
Review". It is not on the App Store yet; the approval reported on 2026-10-08 was not
the App Store release. **1.0.12 is next**: the called first-run course and the screen
type cap (docs/CHANGELOG.md). On iOS it goes in as an update after 1.0.11 is approved:
pulling 1.0.11 out of review to swap the build would give up its place in the queue. **1.1** adds the paid
unlock below (contracts 3–5, built 2026-11-05). Every release ships to both platforms (CLAUDE.md, *Two platforms, one fix*).

## Decisions (locked 2026-08-13, updated since)

| | Decision | Why |
|---|---|---|
| **Store** | Google Play first, then the App Store | Done in that order. Play went to internal, closed and then open testing; the iOS shell was rebuilt 2026-09-04, the Apple Developer enrolment followed, and 1.0.11 is in App Review (submitted 2026-10-05, still waiting on 2026-10-11). `npm run ios:archive` is the upload path. |
| **Money** | **Free until 1.1, then contracts 3–5 behind one unlock** | 1.0.x ships everything free, open testing included. 1.1 sells one non-consumable that opens contracts 3, 4 and 5 (stages 17–40); stages 01–16 and the endless lane stay free. Built 2026-11-05, waiting on the store side ([PAYWALL-CHECKLIST.md](PAYWALL-CHECKLIST.md)). |
| **Leaderboards** | Shipped | Built, verified, deployed: every campaign stage and the weekly lane have a board, and `submit-run` replays each trace before it accepts a score. Free flow (endless) is unranked since 1.0.10. The price was real compliance work — §2. |

### 1.1: the paid unlock (Gil, 2026-11-05; built the same day)

**The model.** Free to try, one purchase, no ads. **Contracts 1 and 2 are free end to
end: stages 01–16, both bosses**, plus the ENDLESS lane. One non-consumable purchase,
about **$1.99**, unlocks **contracts 3, 4 and 5: stages 17–40**, for good. The price
lives in the two store consoles; the game prints the store's own localized string and
never a number of its own. **No** consumables, **no** ads, **no** pay-per-contract: all
three contradict the game's skill-fairness identity.

This replaces the plan of 2026-08-17 (one $2.99 unlock at the stage-09 seam, contracts
2–5 and the weekly board behind it). The structure and the principles carry over; the
seam moves to the end of contract 2.

| | Free | Unlocked |
|---|---|---|
| Qualification, contracts 1 and 2 (stages 01–16, two bosses) | yes | yes |
| FREE FLOW: the ENDLESS lane | yes | yes |
| FREE FLOW: filing a WEEKLY score | yes (Gil: "Weekly stays free") | yes |
| Contracts 3, 4 and 5 (stages 17–40, three bosses) | no | yes |
| Watching any run on any board | yes | yes |

**The principles.**

1. **A license is not progress.** It rides its own key in the save, beside `progress`,
   `settings` and `identity`. RESET CONTRACT and the MY DATA erase never revoke it.
2. **No DRM.** A plain client gate. The boards are guarded by the server's replay
   verifier, not by the flag: a forged flag still cannot forge a run.
3. **The store can grant, never take away.** The game asks the store at start-up, each
   time it comes back to the screen (so a gift code redeemed in the store's own app, or
   a pending payment that cleared, lands without a restart), and when the offer opens.
   It caches the yes. A "no" from a flaky store, or a device signed out of its store, never
   walls a player who paid. Play is never gated on the network.
4. **The wall is inside `startLevel`.** Every door into a stage meets it: the stage
   list, NEXT CONTRACT, the board's FLY THIS LANE, the passcode boss drill. The doors
   also check first, so they open the offer instead of starting a transition.

**The offer** is an in-fiction disc the ring casts, DEEP RANGE CLEARANCE, under the
disc law. It opens after the stage 16 boss verdict (on the report, once its keys land),
on a tap of a locked contract (the disc wears a lock and says GET CLEARANCE), on NEXT
CONTRACT off stage 16, and on a locked door anywhere else. Its keys: NOT NOW, UNLOCK
with the store's price, and ALREADY CLEARED? RESTORE. SETTINGS has a **RESTORE
PURCHASE** row, because App Review rejects an unlock with no restore.

**Two decisions, settled by Gil on 2026-11-05.** Each stays one named constant in
`src/game/34-license.js`, so a change of mind is a one-line change, and `npm test` flies
both values of each:

- `WEEKLY_NEEDS_LICENSE = false` (Gil: "Weekly stays free"): a free player files weekly
  ranked scores. With `true`, a free player would fly the weekly lane unranked, and the
  weekly door would offer FLY UNRANKED beside UNLOCK.
- `GRANDFATHER = 'progress'` (Gil: "Keep their progress"): the game was live and all
  free, so a player who already flew past stage 16 must not meet a paywall over their own
  progress; a player who never got that far sees the offer. The first
  boot of the paywall build stamps the save once: did it exist, and did it hold a star,
  a best or a second opened stage in contracts 3–5. `'progress'` gifts the second kind;
  `'every-save'` gifts every save made before the paywall build; `'none'` gifts nobody.

**The native layer.** One product id on both stores, `com.warpvanguard.game.license`.
Direct store APIs behind a thin plugin in each shell, so there is no third-party data
processor: `LicensePlugin.java` (Play Billing 8) and `LicensePlugin.swift` (StoreKit 2).
The page sends the id; the shells answer `{ owned, price, state }`. A stub adapter plays
the whole flow on the web and in the tests. On the web, `index.html?paywall=fresh` flies
the free tier on a save that has the unlock.

**Analytics.** `licenseTrack()` in `34-license.js` is the one door for offer views,
purchases and restores. It sends nothing until a `track()` exists.

**Gift codes** for Gil, family and friends are store codes, never a code typed into the
game (App Store guideline 3.1.1): Play promo codes and App Store offer codes, plus
Family Sharing on iOS. See [PAYWALL-CHECKLIST.md](PAYWALL-CHECKLIST.md) §4.

**The store side** is Gil's: [PAYWALL-CHECKLIST.md](PAYWALL-CHECKLIST.md) (the Play
payments profile and one-time product, the Paid Apps agreement and the in-app purchase
with its review screenshot, license testers and sandbox accounts).

Post-launch options, unchanged: a cosmetic supporter pack (node skins via the `SPRITES`
hook), and web-portal builds (Poki / CrazyGames / itch.io) as a funnel.

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
      gates INSIDE `startLevel` (built 2026-11-05), so this door hits the same wall.
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
      **https://warp.gb-il.cloud/privacy.html**.
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
7. [ ] **App Store**: enrolment and TestFlight done; App Review for 1.0.11 still waiting (submitted 2026-10-05).
8. [ ] **Play production**, staged rollout (start ~10-20%).
9. [ ] **1.1**: the paid unlock (above), on both stores at once. Code built 2026-11-05; the store side is [PAYWALL-CHECKLIST.md](PAYWALL-CHECKLIST.md).

---

## What is still open

- §2: the Art. 30 record of processing, and a weekly look at the `reports` table.
- §4: the low-end `lowFX` pass and the pre-ship boss tuning pass.
- §5: Play production, then 1.1 and its paywall.
