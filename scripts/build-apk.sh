#!/usr/bin/env bash
# Build a self-contained, offline Android APK for Data Defenders.
# No Android Studio or sudo required — uses the Homebrew JDK 17 formula
# and the android-commandlinetools SDK. See BUILD.md for one-time setup.
set -euo pipefail

export JAVA_HOME="${JAVA_HOME:-/opt/homebrew/opt/openjdk@17}"
export ANDROID_HOME="${ANDROID_HOME:-/opt/homebrew/share/android-commandlinetools}"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$JAVA_HOME/bin:$PATH"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# Copy the latest web assets from src/ into the native project.
npx cap sync android

# Regenerate the launcher icon (cyan-outlined shield = stable build marker).
python3 scripts/make-icons.py

# Compile the debug APK.
cd android
./gradlew assembleDebug

APK="$ROOT/android/app/build/outputs/apk/debug/app-debug.apk"
DEST="$HOME/Desktop/DataDefenders.apk"
cp "$APK" "$DEST"
echo ""
echo "✓ APK built: $APK"
echo "✓ Copied to: $DEST"
