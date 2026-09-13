#!/usr/bin/env bash
# Build the SIGNED ANDROID APP BUNDLE — the artefact Play accepts.
#
# `npm run apk` stays what it always was: a debug APK you sideload onto a test
# phone. This is its counterpart for the store. The difference matters — Play
# refuses a debug-signed upload, and it wants an .aab, not an .apk.
set -euo pipefail

export JAVA_HOME="${JAVA_HOME:-/opt/homebrew/opt/openjdk@21}"
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

# THE PINS RUN BEFORE THE BUILD. Found 2026-09-08: nothing on the release path
# ran `npm test` — the 1100 checks that guard both shells only fired when
# someone typed the command. A store cut is exactly where they must fire.
echo "── npm test ──"
npm test

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
# PROOF, NOT A SUCCESS LINE. The bundle exists and its manifest carries the
# version package.json says — the manifest is protobuf inside the zip, but a
# versionName is stored as a plain UTF-8 string, so grep -a finds it.
VERSION="$(node -p "require('$ROOT/package.json').version")"
[ -f "$AAB" ] || { echo "✗ no bundle at $AAB"; exit 1; }
if ! unzip -p "$AAB" base/manifest/AndroidManifest.xml | grep -a -q -F -- "$VERSION"; then
  echo "✗ the bundle's manifest does not carry version $VERSION"; exit 1
fi
echo "✓ manifest carries versionName $VERSION"
cp "$AAB" "$DEST"
echo ""
echo "✓ AAB built:     $AAB"
echo "✓ Copied to:     $DEST"
echo ""
echo "  Upload that file to Play Console → Testing → Internal testing."

# ---- BOTH PLATFORMS, EVERY CUT (Gil, 2026-09-04) ----
# The same version, the same dist/, compiled into the iOS shell for the
# simulator. It cannot be signed on this Mac yet, so nothing is uploaded — but a
# Play release with an iOS build that no longer compiles is exactly the drift
# this step exists to catch, so that the day an Apple Developer ID exists the
# upload is `npm run ios:archive` and nothing else. Skip with SKIP_IOS=1 only
# when Xcode itself is the thing that is broken.
if [ "${SKIP_IOS:-}" != "1" ]; then
  echo ""
  echo "── proving the iOS shell at the same version ──"
  cd "$ROOT"
  bash scripts/build-ios.sh --no-install
fi
