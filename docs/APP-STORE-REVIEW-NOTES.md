# App Store Review — the answers, prepared

Apple's first review of 1.0.10 (2026-10-02) came back "Guideline 2.1 — Information
Needed": a new developer account gets asked for a screen recording plus six written
answers, and Apple asks that the same text sit in App Store Connect → App Review
Information → Notes on every future submission. Paste the block below; keep it true
(see docs/PLAY-CONSOLE-ANSWERS.md for the Play side, which says the same things).

Revisit items 1 and 4 when 1.1 adds the in-app unlock.

## The recording (item 1)

Physical iPhone, current iOS, the build under review installed from TestFlight.
Start the recording from Control Center, then tap the icon on the Home Screen.
Under about three minutes:

1. Splash and enrolment to the menu.
2. One full stage (stage 01), the automatic score submission, the leaderboard.
3. On the leaderboard: the REPORT link on another player's row (the closed list of
   reasons), then MY DATA: rename my runs, and the delete-my-runs confirmation
   (cancel is fine).
4. Pause disc, field guide, FEEDBACK form.

## The reply (paste in full)

```
Thank you for the review. Answers to the six items follow; the same text is in the Notes field.

1. SCREEN RECORDING
The attached recording was captured on an iPhone running iOS [VERSION], starting from the app launch on the Home Screen. It shows the splash and enrolment, one full stage, the automatic score submission, the leaderboard, the REPORT link on a leaderboard row, the MY DATA panel (rename my runs, delete my runs), the pause menu, the field guide and the feedback form.
- Account registration, login and account deletion: the app has no account creation and no login. Each device opens an anonymous session, which is used only to post scores. There is therefore no registration, login or account-deletion flow. A player can still delete everything the app holds about their device from the MY DATA panel (shown in the recording).
- User-generated content: the only user-generated content is the leaderboard handle, a short name typed by the player. Handles are filtered by a word list at submission, every player can report another player's row from the leaderboard with a closed set of reasons (offensive, personal information, impersonation, other), a reported handle is redacted automatically after reports from three different players, and the contact address hello@gb-il.cloud is published in the privacy policy. There is no chat, messaging, profile or other communication between players.
- Paid content: there are no in-app purchases and no paid features in this version. All content is free.

2. PURPOSE AND AUDIENCE
Warp Vanguard is a rhythm-action arcade game. The player steers two nodes on a ring with both thumbs, in landscape, to escort a convoy through a warp lane and clear the enemies on the beat. It is a single-player game for a general audience (rated 4+), with an optional online leaderboard. It solves no problem beyond play: the value is a short, skill-based session that is easy to pick up and hard to master.

3. SETUP AND ACCESS
No setup, no credentials and no sample files are needed. Launch the app, follow the short enrolment, and play. Everything in the app is reachable from the main menu. Scores are posted automatically at the end of a ranked stage; the leaderboard is behind the LEADERBOARD key on the menu. The app plays fully offline; only the leaderboard needs a network connection.

4. EXTERNAL SERVICES
- Supabase (supabase.com): hosted Postgres database, anonymous authentication and serverless functions for the leaderboard, score verification, player reports, data rename/deletion and the feedback form. Data in transit is HTTPS.
- GitHub Pages: hosts the privacy policy and the support page (https://gilbeja-ux.github.io/warp-vanguard/privacy.html).
No payment processor, no advertising network, no analytics SDK, no AI service and no third-party sign-in are used.

5. REGIONAL DIFFERENCES
None. The app has the same features and content in every region. The one leaderboard is global.

6. REGULATED INDUSTRY / PROTECTED MATERIAL
Not applicable. The app is not in a regulated industry. The code, artwork and music are original and owned by the developer. The recorded sound effects come from royalty-free sound libraries and are used under CC0 or the Pixabay Content License, and the two fonts (Audiowide and Rajdhani) are used under the SIL Open Font License 1.1. Each licence permits use in a commercial app, and CC0 and the Pixabay licence require no attribution. The sources and licences are recorded in the project's credits file.
```

Item 6 was corrected on 2026-10-10. It used to say all sound was original, and it
is not: `CREDITS.md` records the CC0 sound effects (Sonniss GameAudioGDC, Kenney,
Freesound), the Pixabay takes and the two OFL fonts. There is no in-app credits
screen, so the reply points at the credits file and claims nothing more. The
three takes that once had no recorded source (`rayCharge`, `bossPlate`, `sonar`)
are Pixabay, confirmed by Gil on 2026-10-10, so the reply is ready to paste as it
stands.
