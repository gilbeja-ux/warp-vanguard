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
# Homebrew JDK 17 (formula, installs under /opt/homebrew — no password needed)
brew install openjdk@17 android-commandlinetools

# Android SDK packages + license acceptance
export ANDROID_HOME=/opt/homebrew/share/android-commandlinetools
yes | sdkmanager --sdk_root=$ANDROID_HOME --licenses
sdkmanager --sdk_root=$ANDROID_HOME "platform-tools" "platforms;android-34" "build-tools;34.0.0"

# npm deps + native Android project
npm install
npx cap add android            # generates android/ (git-ignored)
echo "sdk.dir=$ANDROID_HOME" > android/local.properties
```

> The Temurin JDK **cask** (`brew install --cask temurin`) needs a sudo password
> and can't be scripted headlessly — that's why we use the `openjdk@17` formula.

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
