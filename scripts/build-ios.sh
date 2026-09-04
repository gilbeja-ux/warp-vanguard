#!/usr/bin/env bash
# Build the iOS app for Warp Vanguard. The counterpart to build-apk.sh and
# build-aab.sh, in one script with three targets.
#
#   bash scripts/build-ios.sh                # SIMULATOR: build, install, launch
#   bash scripts/build-ios.sh --no-install   # simulator build only
#   bash scripts/build-ios.sh --device       # a signed Debug build for a plugged-in iPhone
#   bash scripts/build-ios.sh --archive      # Release .xcarchive → .ipa for App Store Connect
#
# The simulator target needs no Apple Developer account: xcodebuild signs it
# "to run locally". --device and --archive need a paid Apple Developer Program
# membership, a signing identity in the login keychain, and Xcode signed in to
# the team. Both preflight for that and stop with the steps if it is missing.
#
#   IOS_TEAM_ID=ABCDE12345   the team to sign with (needed when Xcode knows more
#                            than one, harmless otherwise)
#   IOS_SIM="iPhone 17 Pro"  which simulator to boot when none is running
#   DERIVED_DATA=path        where xcodebuild keeps its build tree (build/ios)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

MODE="${1:-sim}"
case "$MODE" in
  sim|--install) MODE=sim ;;
  --no-install)  MODE=sim-only ;;
  --device)      MODE=device ;;
  --archive)     MODE=archive ;;
  *) echo "unknown option: $MODE  (try --no-install, --device, --archive)"; exit 2 ;;
esac

DERIVED="${DERIVED_DATA:-$ROOT/build/ios}"
WORKSPACE="ios/App/App.xcworkspace"
BUNDLE_ID="$(node -p "require('./capacitor.config.json').appId")"
SIM_NAME="${IOS_SIM:-iPhone 17 Pro}"

# ---- signing preflight: only the two targets that leave the Mac need it ----
if [ "$MODE" = device ] || [ "$MODE" = archive ]; then
  IDENTITIES="$(security find-identity -v -p codesigning 2>/dev/null | grep -c '"' || true)"
  if [ "${IDENTITIES:-0}" -eq 0 ]; then
    cat <<'MSG'

✗ No code-signing identity in the keychain. A build for a device or for the
  App Store cannot be signed on this Mac yet.

  What it takes, once:
    1. Enrol in the Apple Developer Program (developer.apple.com, $99/yr).
    2. Xcode > Settings > Accounts > + > sign in with that Apple ID.
    3. Open ios/App/App.xcworkspace, target App > Signing & Capabilities,
       tick "Automatically manage signing" and pick the team. Xcode creates
       the certificate and profile.
    4. Re-run this script. Set IOS_TEAM_ID=<team id> if Xcode lists more
       than one team.

  A free personal team can sign a --device build, but its profile expires
  after 7 days and the app stops opening — there is no free path to a
  permanent install the way the Android debug APK gives one.

MSG
    exit 1
  fi
fi

# ---- the version lands in the project from package.json — never hand-typed ----
node scripts/sync-version.js

# ---- stage dist/ FIRST, then copy it into the native project ----
# `cap sync` only copies whatever webDir already holds; it does not build. It
# also runs `pod install`, which is what creates App.xcworkspace and Pods/ on a
# fresh clone — those are not tracked, only the decision files are.
npm run build
npx cap sync ios

# ---- regenerate the icon and launch badge from the current art ----
# The asset catalogue is not tracked (only its Contents.json is); this is the
# step that fills it, and it runs on every build so it cannot go stale.
python3 scripts/make-ios-assets.py

TEAM_ARGS=()
if [ -n "${IOS_TEAM_ID:-}" ]; then TEAM_ARGS=(DEVELOPMENT_TEAM="$IOS_TEAM_ID"); fi

case "$MODE" in
  sim|sim-only)
    xcodebuild \
      -workspace "$WORKSPACE" -scheme App -configuration Debug \
      -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' \
      -derivedDataPath "$DERIVED" -quiet build
    APP="$DERIVED/Build/Products/Debug-iphonesimulator/App.app"
    echo ""
    echo "✓ built: $APP"
    [ "$MODE" = sim-only ] && exit 0
    # Install into whichever simulator is already booted; boot one if none is.
    if ! xcrun simctl list devices | grep -q "(Booted)"; then
      echo "no simulator booted — booting $SIM_NAME"
      xcrun simctl boot "$SIM_NAME" >/dev/null 2>&1 || true
      xcrun simctl bootstatus "$SIM_NAME" -b >/dev/null 2>&1 || true
    fi
    xcrun simctl install booted "$APP"
    xcrun simctl launch booted "$BUNDLE_ID" >/dev/null
    open -a Simulator
    echo "✓ installed and launched ($BUNDLE_ID)"
    ;;

  device)
    xcodebuild \
      -workspace "$WORKSPACE" -scheme App -configuration Debug \
      -sdk iphoneos -destination 'generic/platform=iOS' \
      -derivedDataPath "$DERIVED" -allowProvisioningUpdates "${TEAM_ARGS[@]}" \
      -quiet build
    APP="$DERIVED/Build/Products/Debug-iphoneos/App.app"
    echo ""
    echo "✓ built for device: $APP"
    # devicectl (Xcode 15+) installs over USB or wifi onto a paired phone.
    DEV="$(xcrun devicectl list devices 2>/dev/null | awk '/iPhone|iPad/ && /connected|available/ {print $NF; exit}' || true)"
    if [ -n "$DEV" ]; then
      xcrun devicectl device install app --device "$DEV" "$APP"
      xcrun devicectl device process launch --device "$DEV" "$BUNDLE_ID" || true
      echo "✓ installed on $DEV"
    else
      echo "  no paired device found — plug one in and: xcrun devicectl device install app --device <id> \"$APP\""
    fi
    ;;

  archive)
    ARCHIVE="$DERIVED/App.xcarchive"
    EXPORT="$DERIVED/ipa"
    OPTS="$DERIVED/ExportOptions.plist"
    rm -rf "$ARCHIVE" "$EXPORT"
    mkdir -p "$DERIVED"
    cp ios/ExportOptions.plist "$OPTS"
    if [ -n "${IOS_TEAM_ID:-}" ]; then
      /usr/libexec/PlistBuddy -c "Add :teamID string $IOS_TEAM_ID" "$OPTS" >/dev/null
    fi
    xcodebuild \
      -workspace "$WORKSPACE" -scheme App -configuration Release \
      -sdk iphoneos -destination 'generic/platform=iOS' \
      -archivePath "$ARCHIVE" -allowProvisioningUpdates "${TEAM_ARGS[@]}" \
      -quiet archive
    xcodebuild -exportArchive \
      -archivePath "$ARCHIVE" -exportPath "$EXPORT" \
      -exportOptionsPlist "$OPTS" -allowProvisioningUpdates -quiet
    IPA="$(ls "$EXPORT"/*.ipa | head -1)"
    DEST="$HOME/Desktop/WarpVanguard.ipa"
    cp "$IPA" "$DEST"
    echo ""
    echo "✓ archive:   $ARCHIVE"
    echo "✓ IPA:       $IPA"
    echo "✓ Copied to: $DEST"
    echo ""
    echo "  Upload with the Transporter app, or from here:"
    echo "    xcrun altool --upload-app -f \"$DEST\" -t ios --apiKey <key id> --apiIssuer <issuer id>"
    echo "  Then App Store Connect → TestFlight for testers, or → App Store → submit."
    ;;
esac
