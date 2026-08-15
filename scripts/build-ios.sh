#!/usr/bin/env bash
# Build the iOS app for Warp Vanguard. The counterpart to build-apk.sh.
#
# Default target is the SIMULATOR, which needs no Apple Developer account and no
# signing identity — `xcodebuild` signs it "to run locally". A build for a real
# device or for App Store Connect needs a paid Apple Developer account; see the
# note at the bottom of this file.
#
#   bash scripts/build-ios.sh              # build, then install to a booted sim
#   bash scripts/build-ios.sh --no-install # build only
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

DERIVED="${DERIVED_DATA:-$ROOT/build/ios}"

# Stage dist/ FIRST, then copy it into the native project — `cap sync` only
# copies whatever webDir already holds, it does not build. Same trap as Android.
npm run build
npx cap sync ios

# Regenerate the iOS icon and launch image from the current badge art. This step
# is the reason the script exists: make-icons.py only ever fed Android, so
# nothing rebuilt the iOS asset catalogue and the app shipped whatever
# `cap add ios` scaffolded — a monogram two versions old, and the stock white
# Capacitor launch image in front of an almost-black game.
python3 scripts/make-ios-assets.py

xcodebuild \
  -workspace ios/App/App.xcworkspace \
  -scheme App \
  -configuration Debug \
  -sdk iphonesimulator \
  -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath "$DERIVED" \
  build

APP="$DERIVED/Build/Products/Debug-iphonesimulator/App.app"
echo ""
echo "✓ built: $APP"

if [ "${1:-}" = "--no-install" ]; then exit 0; fi

# Install into whichever simulator is already booted; boot a default if none is.
if ! xcrun simctl list devices | grep -q "(Booted)"; then
  echo "no simulator booted — booting iPhone 17 Pro"
  xcrun simctl boot "iPhone 17 Pro" >/dev/null 2>&1 || true
  xcrun simctl bootstatus "iPhone 17 Pro" -b >/dev/null 2>&1 || true
fi
xcrun simctl install booted "$APP"
xcrun simctl launch booted com.warpvanguard.game
open -a Simulator
echo "✓ installed and launched"

# ---------------------------------------------------------------------------
# SHIPPING TO A DEVICE OR THE APP STORE
#
# Needs a paid Apple Developer Program membership ($99/yr). Once enrolled:
#   1. Xcode > Settings > Accounts — add the Apple ID, download the profiles.
#   2. Open ios/App/App.xcworkspace, target App > Signing & Capabilities,
#      tick "Automatically manage signing" and pick the team.
#   3. Archive:
#        xcodebuild -workspace ios/App/App.xcworkspace -scheme App \
#          -configuration Release -sdk iphoneos -archivePath build/App.xcarchive \
#          archive
#        xcodebuild -exportArchive -archivePath build/App.xcarchive \
#          -exportPath build/ipa -exportOptionsPlist ios/ExportOptions.plist
#
# There is no free path to a permanent installable build the way the Android
# debug APK gives one — a free personal team can sideload, but the provisioning
# profile expires after 7 days and the app stops opening.
# ---------------------------------------------------------------------------
