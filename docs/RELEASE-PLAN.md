# Release Plan — WARP VANGUARD

## Business model (decided 2026-07-14)

**Free demo + one-time unlock.**

- Campaign relays 1–3 playable free; a single lifetime purchase
  (~$2.99–4.99, price to be finalized) unlocks the full campaign and
  FREE FLOW. The paywall sits at the existing relay-04 seam where
  FREE FLOW already unlocks.
- **No** consumable microtransactions, **no** forced ads, **no**
  pay-per-campaign — all three contradict the game's skill-fairness
  identity (scores must measure skill, nothing purchasable).
- Implementation: Google Play Billing via a Capacitor plugin + an offline
  entitlement flag checked alongside `progress`. No server for v1.
- Later options (post-launch, only if warranted):
  - Cosmetic supporter pack — node skins via the existing `SPRITES` hook,
    tunnel color themes. Fair-play compatible.
  - Web-portal builds (Poki / CrazyGames / itch.io) as rev-share
    distribution and a marketing funnel toward the Play Store version.

## Release-readiness checklist (deferred until content settles)

- [ ] Remove the temporary "BOSS TEST (DEV)" menu key and `startBossTest()`
      (grep "BOSS TEST" in `src/index.html`)
- [x] App icons — Android launcher icons are the DD shield badge
      (`android/app/src/main/res/mipmap-*/ic_launcher*.png`), and the web
      manifest ships `any` + `maskable` variants from `src/icons/`.
      **iOS still pending** — the `ios/` platform has not been added yet.
- [ ] Orientation lock via `@capacitor/screen-orientation` (native plugin —
      iOS ignores `screen.orientation.lock()` from the web layer)
- [ ] Device test pass on low-end Android (verify the `lowFX` perf watchdog
      trips well)
- [ ] Verify haptics on a real iOS device (`@capacitor/haptics` needs
      `npm install && npm run sync` + native build)
- [ ] Google Play Billing plugin + entitlement flag + demo gating at relay 04
- [ ] Store metadata, screenshots, privacy declarations; version bump
      discipline in `package.json`
- [ ] CI: run `npm test` (headless harness in `scripts/test.js`) on push
- [ ] Pre-ship tuning pass: boss difficulty knobs (`hp`, drain tick in
      `spawnBoss`/update), endless ramp pacing in `endlessCfg()`
- [ ] Name clearance: USPTO TESS + Play/App Store search on the final name
      (see BRAND.md)

## Assets still owed (author)

- ~~New menu track~~ — **done.** *Midnight Terminal Wait* (116s) is wired at
  `MUSIC_DATA.menu`. The seam-duck block in `updateMusic` was kept rather than
  removed: it crossfades the loop through a 1.2s gain dip at the boundary.
- **SFX origin logging** — 13 recorded one-shots ship in `src/audio/sfx/`, all
  CC0 / royalty-free (Sonniss, Kenney, Freesound CC0). The license is settled;
  what's missing is which pack or URL each file came from. CREDITS.md has the
  table with `_TBC_` placeholders ready to fill.
