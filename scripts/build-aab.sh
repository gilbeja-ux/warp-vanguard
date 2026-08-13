#!/usr/bin/env bash
# Build the SIGNED ANDROID APP BUNDLE — the artefact Play accepts.
#
# `npm run apk` stays what it always was: a debug APK you sideload onto a test
# phone. This is its counterpart for the store. The difference matters — Play
# refuses a debug-signed upload, and it wants an .aab, not an .apk.
set -euo pipefail

export JAVA_HOME="${JAVA_HOME:-/opt/homebrew/opt/openjdk@17}"
export ANDROID_HOME="${ANDROID_HOME:-/opt/homebrew/share/android-commandlinetools}"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$JAVA_HOME/bin:$PATH"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [ ! -f android/key.properties ]; then
  echo ""
  echo "✗ android/key.properties is missing — this build would be DEBUG-SIGNED and"
  echo "  Play would reject it."
  echo ""
  echo "  cp android/key.properties.example android/key.properties"
  echo "  ...then create the keystore and fill it in (instructions are in the file)."
  echo ""
  exit 1
fi

# the version lands in the gradle file from package.json — never hand-typed
node scripts/sync-version.js

# same staging discipline as the APK build: dist/ first, then sync, or the
# bundle ships whatever dist/ happened to hold from a previous run
npm run build
npx cap sync android
python3 scripts/make-icons.py

cd android
./gradlew bundleRelease

AAB="$ROOT/android/app/build/outputs/bundle/release/app-release.aab"
DEST="$HOME/Desktop/WarpVanguard.aab"
cp "$AAB" "$DEST"
echo ""
echo "✓ AAB built:     $AAB"
echo "✓ Copied to:     $DEST"
echo ""
echo "  Upload that file to Play Console → Testing → Internal testing."
