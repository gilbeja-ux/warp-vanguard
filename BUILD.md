# Building the Android app (offline APK)

Warp Lane ships as a [Capacitor](https://capacitorjs.com) app: the web game
in `src/` is bundled into a native Android project so it runs fully offline — no
browser, no dev server, no wifi. This is done **without Android Studio or sudo**.

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

This runs `scripts/build-apk.sh`, which syncs `src/` into the native project,
compiles a debug APK, and copies it to `~/Desktop/DataDefenders.apk`.

## Install on a phone

- **File transfer:** send the APK to the phone (Drive, email, USB), tap it,
  allow "install unknown apps" for the opening app, then Install.
- **USB cable:** enable USB debugging, then
  `adb install -r ~/Desktop/DataDefenders.apk`.

The debug build is stably signed, so it never expires — good for a permanent
personal copy. It just can't be published to the Play Store without a release
(signed) build.
