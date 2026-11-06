# Release 1.1.0 — upload and release guide

The first full release, on Google Play (production) and the App Store. Written 2026-11-06.

- **Google Play ships 1.1.1 (10101).** It is the same game as 1.1.0, without the Play
  Billing permission that made Play label the free game *In-app purchases*.
- **The App Store keeps 1.1.0 (10100),** the build you already uploaded. Apple shows the
  label only for an approved product, so iOS needs no new build.

## Already done for you

- [x] The paywall is off: every contract is free. Its code stays built (`PAYWALL-CHECKLIST.md`).
- [x] The boss long-press is off in a store build (Apple 2.5.19): `BOSS_GATE_ON = false`.
- [x] Version 1.1.1 in `package.json`, Gradle and the Xcode project (`sync-version.js`); the uploaded iOS build stays 1.1.0.
- [x] `npm test`, the smoke suite and the coverage gate pass; the verifier is live for the release sim.
- [x] The builds are on your Desktop: `WarpVanguard.aab` (Play) and `WarpVanguard.ipa` (App Store).
- [ ] **Master is pushed**, so the new privacy policy is live at
      https://warp.gb-il.cloud/privacy.html. Do this before you file the privacy forms below.

## 1. Google Play — production

Play Console → Warp Vanguard.

1. **Managed publishing ON.** Publishing overview → Managed publishing → turn it on.
   Then the release waits after review until you press Publish, so both stores can go
   live on the same day.
2. **Data safety.** App content → Data safety → Edit. Use the *Without one* answers in
   `PLAY-STATISTICS-PRIVACY.md` (there is no statistics switch in 1.1.0):
   - Personal info → User IDs: add the purpose **Analytics**.
   - App activity → App interactions: add **Analytics**.
   - App info and performance → **Crash logs**: collected, not shared, Required, Analytics.
   - App info and performance → **Diagnostics**: collected, not shared, Required, Analytics.
   - Tracking or advertising: still **No**. Save.
3. **Trader status: non-trader.** This is on the account, not the app. Play Console →
   **Manage account → Account details → About you** → follow the prompts → **Non-trader**
   → save. Due 2027-02-01; after that date Google blocks updates. 1.1.0 sells nothing and
   shows no ads, so non-trader is true, and the store page shows only your email and
   country. A non-trader has no step per app. Before the paywall goes on, change it to
   **Trader** (`PAYWALL-CHECKLIST.md` §1 step 3).
4. **The release.** Test and release → Production → Create new release.
   - App bundle: upload `~/Desktop/WarpVanguard.aab` (1.1.1). If a release already holds
     the 1.1.0 bundle, remove it there and add 1.1.1.
   - First check the label: upload 1.1.1 to Internal testing too. Internal testing goes
     live in minutes, and the *In-app purchases* line must be gone from the Play page.
   - Release name: `1.1.1 (10101)`.
   - Release notes (en-US): paste the Play text in §3.
   - Countries / regions: if Play asks, add the same list as open testing.
5. **Rollout: 100 %.** A first production release has no old users to protect, and a
   partial rollout hides the game from part of the people your marketing sends.
6. Next → Save → Publishing overview → **Send changes for review**.
7. When review passes (often 1–3 days), press **Publish** on the day you choose.

Open testing can stay as it is: its users get 1.1.1 from production, because 10101 is higher than 10012.

## 2. App Store

1. **Upload the build.** Open the free **Transporter** app (Mac App Store), sign in with
   your Apple ID, drag `~/Desktop/WarpVanguard.ipa` in, press **Deliver**.
   Processing takes about 15–30 minutes; Apple emails you when the build is ready.
2. **EU trader status: check that it says non-trader.** This is on the account, not the
   app. App Store Connect → **Business** → *Agreements* tab → *Compliance* → next to
   *Digital Services Act*, **Complete Compliance Requirements** (or **Edit**) → **This is
   not a trader account** → Done. Account Holder or Admin only; no address or phone. The
   game is already on the EU store, so a status is probably set: check which one. The
   per-app setting is Apps → Warp Vanguard → App Information → App Store Regulations and
   Permits → Digital Services Act. These labels come from Apple's help page (2026-11-06),
   not from the console. Before the paywall goes on, change it to trader
   (`PAYWALL-CHECKLIST.md` §2 step 2).
3. App Store Connect → Apps → Warp Vanguard → **+** next to *iOS App* → version `1.1.0`.
4. **Build:** pick 1.1.0 (10100). No export-compliance question: the Info.plist already
   answers it.
5. **What's New in This Version:** paste the App Store text in §3.
6. **App Privacy** (left menu) → Edit, then **Publish** the change. From
   `PLAY-STATISTICS-PRIVACY.md`:
   - Identifiers → User ID: add the purpose **Analytics**.
   - Add Usage Data → **Product Interaction**: App Functionality + Analytics, linked, no tracking.
   - Add Diagnostics → **Crash Data**: App Functionality + Analytics, linked, no tracking.
   - Add Diagnostics → **Other Diagnostic Data**: Analytics, linked, no tracking.
   - Purchases: leave unticked (the paywall is off).
7. **App Review Information → Notes:** paste the Notes text in §4.
8. **Version Release:** choose **Manually release this version**, so you pick the day.
9. **Add for Review → Submit.** Review is often under 48 hours.
10. When it says *Pending Developer Release*, press **Release This Version** on launch day.

## 3. Release notes (paste as is)

**Google Play — What's new** (under 500 characters):

```
The full release.
• Training now comes in three short parts: the basics before stage 01; armor, barrier nets, dead zones and the golden strip before stage 03; phase locks before stage 07. Replay any part from TRAINING in Settings.
• A charged pulse lights its whole side of the screen. Tap anywhere on that side to fire.
• Fairer leaderboards: the score check now refuses every move the game refuses.
• Many fixes and a smoother first launch.
```

**App Store — What's New in This Version:**

```
The full release of Warp Vanguard.

• Training in three short parts. The basics come before stage 01. Armor, barrier nets, dead zones and the golden strip come before stage 03. Phase locks come before stage 07. Replay any part from TRAINING in Settings.
• A charged pulse now lights its whole side of the screen. Tap anywhere on that side to fire.
• Fairer leaderboards: the score check now refuses every move the game itself refuses.
• Many fixes and a smoother first launch.
```

## 4. App Review Notes for 1.1.0 (paste in full)

```
1. WHAT IS NEW IN 1.1.0
The tutorial now comes in three short parts, played before stages 01, 03 and 07, and each part can be replayed from TRAINING in SETTINGS (the gear key, top right of the main menu). The app now records first-party play statistics (session length, stage attempts, device model and OS version) to improve the game. They are stored with our own backend (Supabase), are not shared, are never used for advertising or tracking, and no analytics SDK is included. The privacy policy describes them.
- Account registration and login: the app has no account creation and no login. Each device opens an anonymous session, used only for the leaderboard and the play statistics. A player can delete everything the app holds about their device from the MY DATA panel.
- User-generated content: the only user-generated content is the leaderboard handle. Handles are filtered at submission, every player can report another player's row from the leaderboard, a handle reported by three different players is redacted automatically, and the contact address hello@gb-il.cloud is in the privacy policy. There is no chat or messaging between players.
- Paid content: there are no in-app purchases and no paid features in this version. All content is free.

2. SETUP AND ACCESS
No setup, no credentials and no sample files are needed. Launch the app, follow the short enrolment, and play. Everything in the app is reachable from the main menu. The app plays fully offline; only the leaderboard needs a network connection.

3. EXTERNAL SERVICES
- Supabase (supabase.com): database, anonymous authentication and serverless functions for the leaderboard, score verification, player reports, data rename and deletion, the feedback form and the play statistics. Data in transit is HTTPS.
- GitHub Pages: hosts the privacy policy and the support page (https://warp.gb-il.cloud/privacy.html).
No payment processor, no advertising network, no analytics SDK, no AI service and no third-party sign-in are used.

4. MATERIAL
The code, artwork and music are original and owned by the developer. The recorded sound effects come from royalty-free libraries under CC0 or the Pixabay Content License, and the two fonts (Audiowide and Rajdhani) are under the SIL Open Font License 1.1. Each licence permits use in a commercial app.
```

## 5. Launch day

1. **Wipe the boards, right before you publish** (Gil, 2026-11-06). Tell Claude
   "wipe the boards for launch", or run it yourself from the repo. It copies every run
   into a backup table first, as the wipes of 2 Sep and 21 Sep did, then empties the
   boards. Filed reports go with their runs; the trace files stay, and the backup rows
   still point to them. Put the launch date in the table name:

   ```bash
   supabase db query --linked "begin; create table public.runs_backup_YYYYMMDD as select * from public.runs; delete from public.runs; commit; select (select count(*) from public.runs) as runs_left, (select count(*) from public.runs_backup_YYYYMMDD) as backed_up;"
   ```

   `runs_left` must be 0 and `backed_up` the old count. The weekly ladder already starts
   at the launch week (`WEEK_LADDER_FIRST = 2967`, 9–15 Nov), so no empty past week shows.
   If the launch slips past 15 Nov, that constant moves to the launch week first.
2. Play: Publishing overview → **Publish**. App Store: **Release This Version**.
3. Check the live game: `npm run verifier:status` says IN SYNC, and a test score posts.
4. Watch the traction page (admin console, port 8200 → `/traction`) for the first players
   and for SYSTEM FAULT counts.
