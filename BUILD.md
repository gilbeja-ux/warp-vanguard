# Keeping the leaderboard verifier in sync

The server re-simulates every submitted run to verify its score, using a **bundle
of the sim deployed separately** from the game. If the sim changes and that
bundle is not redeployed, the server replays your runs against the old rules and
rejects all of them — which shows up in-game as

```
REJECTED 400: verification failed [48320 vs 52620]
```

That reads as a scoring bug. It is not one, and it has cost two debugging
sessions. So the sim now carries a fingerprint:

```bash
npm run verifier:status     # local id vs deployed id — one number each
npm run deploy:verifier     # rebuild the bundle and ship it
```

Install the git hook once and a push that changes `src/game/` or
`src/campaigns.js` will check the deployed verifier for you:

```bash
npm run hooks:install       # sets core.hooksPath to .githooks/
```

`git push --no-verify` bypasses it when the deploy is deliberately coming later.

---

# Building the Android app (offline APK)

Warp Lane ships as a [Capacitor](https://capacitorjs.com) app: the web game is
bundled into a native Android project so it runs fully offline — no browser, no
dev server, no wifi. This is done **without Android Studio or sudo**.

`npm run build` stages **`dist/`** — a copy of `src/` with everything that should
never reach a device removed — and `webDir` points there. `src/` itself stays the
thing you edit and the thing `npm run dev` serves; `dist/` is generated and
gitignored, so it is never hand-edited and never committed.

The exclusions live in one list (`NEVER_SHIP` in `scripts/build.js`), each entry
verified to have zero references from the game. `webDir` used to point straight at
`src/`, which meant `cap sync` copied the raw source tree: 13.4MB of unreferenced
character plates, a dead 2.7MB menu track, a `.bak` of the tunnel painter, and
`editor.html` — a live dev source-viewer that was reachable *inside the shipped
app*. Staged payload went 66MB → 54MB, and that is with the current menu track,
which the previous APK had never picked up.

## One-time setup

```bash
# Homebrew JDK 21 (formula, installs under /opt/homebrew — no password needed)
brew install openjdk@21 android-commandlinetools

# Android SDK packages + license acceptance
export ANDROID_HOME=/opt/homebrew/share/android-commandlinetools
yes | sdkmanager --sdk_root=$ANDROID_HOME --licenses
sdkmanager --sdk_root=$ANDROID_HOME "platform-tools" "platforms;android-34" "build-tools;34.0.0"

# npm deps + native Android project
npm install
npx cap add android            # generates android/ (git-ignored)
echo "sdk.dir=$ANDROID_HOME" > android/local.properties
```

> Capacitor 8 needs JDK 21. The Temurin JDK **cask** (`brew install --cask temurin`) needs a sudo password
> and can't be scripted headlessly — that's why we use the `openjdk@21` formula.

## Build the APK

```bash
npm run apk
```

This runs `scripts/build-apk.sh`, which stages `dist/`, syncs it into the native
project, compiles a debug APK, and copies it to `~/Desktop/WarpVanguard.apk`.
(It calls `npm run build` first — `cap sync` only copies whatever `webDir` already
holds, so calling sync alone could package a stale `dist/`, or nothing on a fresh clone.)

## Install on a phone

- **File transfer:** send the APK to the phone (Drive, email, USB), tap it,
  allow "install unknown apps" for the opening app, then Install.
- **USB cable:** enable USB debugging, then
  `adb install -r ~/Desktop/WarpVanguard.apk`.

The debug build is stably signed, so it never expires — good for a permanent
personal copy. It just can't be published to the Play Store without a release
(signed) build.

---

# Building the iOS app

The same web bundle ships in a native iOS shell, also via Capacitor. The project
under `ios/` was rebuilt from scratch on 2026-09-04 (Capacitor 8.5.1, CocoaPods,
iOS 15 floor, UIScene lifecycle, iPhone + iPad, landscape only). As with Android, most of `ios/` is
generated and untracked; the files that carry **decisions** are tracked and
`npm test` pins every one of them (section *THE iOS SHELL* in `scripts/test.js`):

| File | Decision |
| --- | --- |
| `ios/App/App/Info.plist` | landscape only on iPhone and iPad, status bar hidden, full screen, games category, export compliance answered |
| `ios/App/App/AppDelegate.swift` | audio session `.playback` + `.mixWithOthers` — the mute switch cannot silence the game |
| `ios/App/App/GameViewController.swift` | defers the top/bottom edge swipes, restates the landscape mask, kills the bounce |
| `ios/App/App/SceneDelegate.swift` | the UIScene lifecycle (Capacitor 8.5); leaves the storyboard's window alone so `GameViewController` stays the root |
| `ios/App/App/Base.lproj/Main.storyboard` | boots `GameViewController`, not the stock bridge controller |
| `ios/App/App/Base.lproj/LaunchScreen.storyboard` | navy background, fitted centred badge — nothing white, nothing cropped |
| `ios/App/App.xcodeproj/project.pbxproj` | bundle id, deployment target 15.0, both versions **generated** by `scripts/sync-version.js` |
| `ios/App/Podfile` | the pod list (`cap sync` rewrites it from package.json) |
| `ios/ExportOptions.plist` | how the archive becomes an App Store Connect .ipa |
| `capacitor.config.json` → `ios` | no scrolling, no zoom, no inset, no link preview, mobile page on iPad, navy web-view background |
| `capacitor.config.json` → `plugins.SystemBars` | `hidden: true` — status bar + home indicator on iOS, system bars on Android, from one key |

## One-time setup

```bash
xcode-select --install          # or full Xcode from the App Store (26.x works)
brew install cocoapods          # 1.17 works
npm install
```

Nothing else. `npm run ios:build` runs `pod install` (through `cap sync ios`),
which creates `App.xcworkspace` and `Pods/` on a fresh clone, and
`scripts/make-ios-assets.py` fills the asset catalogue from `src/icons/wv-512.png`
(the icon is flattened to RGB — App Store Connect rejects an icon with alpha,
after upload, not at build time).

## Three targets

```bash
npm run ios:build      # simulator: build, install, launch (needs no Apple account)
npm run ios:device     # a signed Debug build onto a plugged-in iPhone
npm run ios:archive    # Release .xcarchive → ~/Desktop/WarpVanguard.ipa for App Store Connect
```

Every target first runs `sync-version.js` (both versions from package.json —
`CFBundleVersion` must rise on every upload, exactly like `versionCode`), stages
`dist/`, syncs it in, and regenerates the assets. `bash scripts/build-ios.sh
--no-install` builds for the simulator without launching it.

`ios:device` and `ios:archive` preflight for a code-signing identity and stop
with the steps if there is none. That is the current state of this Mac: **zero
identities, no enrolment**. Enrol ($99/yr), sign Xcode into the team, tick
"Automatically manage signing" on the App target once, and both targets work.
Set `IOS_TEAM_ID` if Xcode knows more than one team. A free personal team can
sign a device build, but its profile dies after 7 days.

## What the shell does not do

- **No `@capacitor/screen-orientation`.** The plist is the lock; the web
  layer's `screen.orientation.lock()` is a no-op in WKWebView and is never
  needed.
- **No splash plugin.** The launch storyboard is navy with the badge; the web
  view's own background is navy; the game's splash takes over from there. There
  is nothing to hide.
- **No service worker.** `99-boot.js` skips registration under Capacitor — the
  bundle is already local.
- **A portrait iPad letterboxes the game** rather than rotating it: that is
  iPadOS's own handling of a landscape-only app. Turn the iPad; it fills.

Both platforms moved from Capacitor 6.2.1 to 8.5.1 on 2026-09-04 in one job
(JDK 21, minSdk 24, AGP 8.13, Gradle 8.14.3, UIScene on iOS). The next major
upgrade is the same shape: `npx cap migrate`, review the diff of every tracked
decision file, an R8 release install on a phone, a simulator pass here.
