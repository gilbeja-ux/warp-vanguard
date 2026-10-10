# Warp Vanguard

A landscape, dual-thumb rhythm-action game for Android and iOS. Each thumb drives
one emitter around the ring at the end of a warp lane; the traffic arrives on the
beat, and a Vanguard escorts the convoy from the core outward by meeting it with
the right emitter at the right moment.

- **Five contracts of eight stages**, named 01 to 40 end to end. Each contract ends
  on a Warp Leech boss duel at its eighth stage (stage 08 in the first contract):
  five bosses, the leech, the siphon, the prism, the mimic and the blockade.
- **A called first-run course**: each lesson is shown as a ghost on the live ring,
  then asked of you; a miss rewinds the lane instead of failing.
- **Verified leaderboards**: every campaign stage and the weekly lane have a board on
  Supabase, and the server replays each run's input trace before it accepts a score.
  Free flow (endless) is unranked practice.
- Touch, keyboard and gamepad. Offline play; the boards need a connection.

It is one full-bleed `<canvas>` in plain JavaScript, with no framework, no bundler
and no runtime dependency. The game lives in `src/game/` as ordered topic files
(`00-core.js` to `99-boot.js`), the campaigns in `src/campaigns.js`, and
`src/index.html` opens straight from `file://`. Capacitor wraps the same web bundle
for Android and iOS.

## Getting started

Node 20 (CI also runs 22). Xcode for iOS, a JDK and the Android SDK for Android
(`npm run apk` needs no Android Studio; see BUILD.md).

```bash
npm install
npm test            # the whole pin suite, headless, in seconds
npm run dev         # build, then serve the game on http://localhost:8000
npm run apk         # debug APK to ~/Desktop
npm run aab         # signed Play bundle (runs npm test, then compiles the iOS shell)
npm run ios:build   # iOS simulator build
npm run ios:archive # App Store .ipa
```

### Local tools

| Port | Command | Interface |
| --- | --- | --- |
| 8000 | `npm run dev` | the game, served from `src/`; also `editor.html`, the Lane Designer |
| 8010 | `npm run lab` | story lab |
| 8011 | `npm run lab:dest` | destinations lab |
| 8012 | `npm run lab:tune` | tuning board |
| 8013 | `npm run lab:disc` | disc lab |
| 8014 | `npm run lab:sound` | sfx soundboard |
| 8015 | `npm run lab:breach` | breach lab |
| 8016 | `npm run lab:leech` | leech lab |
| 8017 | `npm run browsers` | browser watch: every test browser an agent is running, live |
| 8020 | `npm run test:smoke` | the browser smoke suite's own server; never a tab |
| 8100 | `npm run portal` | portal: every tool above, live or dead |
| 8200 | `npm run admin` | admin console (holds the service key) |

## Where to read more

- `CLAUDE.md`: how the source is organised, every command, the determinism and
  verifier rules, and the house laws (STAGE numbering, the disc law, the port map).
- `BUILD.md`: building, signing and shipping both shells.
- `PRODUCT.md`, `BRAND.md`, `DESIGN.md`: the product, the story and the visual language.
- `docs/CHANGELOG.md`: what each release changed, in a player's words.
- `CREDITS.md`: music, fonts and sound effects, with their licences.

## License

MIT
