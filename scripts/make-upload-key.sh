#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# CREATE THE PLAY UPLOAD KEY — run this ONCE, ever.
#
#   bash scripts/make-upload-key.sh
#
# What it makes:
#   ~/warp-vanguard-upload.jks   the signing identity itself
#   android/key.properties       how the build finds it (gitignored)
#   ~/Documents/warp-vanguard-key-backup/   a second copy + the password
#
# WHY THIS IS A SCRIPT AND NOT A CHAT MESSAGE: the password it generates must
# not pass through an AI transcript, a chat log, or anything that gets stored
# somewhere you did not choose. It is printed to YOUR terminal and nowhere else.
#
# It REFUSES to overwrite an existing keystore. That refusal is the most
# important line in the file — regenerating the key after the app is published
# means the listing can never be updated again.
# ---------------------------------------------------------------------------
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
KEYSTORE="$HOME/warp-vanguard-upload.jks"
PROPS="$ROOT/android/key.properties"
BACKUP="$HOME/Documents/warp-vanguard-key-backup"
ALIAS="upload"

bold=$'\033[1m'; dim=$'\033[2m'; grn=$'\033[32m'; red=$'\033[31m'; ylw=$'\033[33m'; off=$'\033[0m'

say()  { printf '%s\n' "$*"; }
step() { printf '\n%s▸ %s%s\n' "$bold" "$*" "$off"; }
ok()   { printf '%s  ✓ %s%s\n' "$grn" "$*" "$off"; }
warn() { printf '%s  ! %s%s\n' "$ylw" "$*" "$off"; }
die()  { printf '\n%s  ✗ %s%s\n\n' "$red" "$*" "$off"; exit 1; }

say ""
say "${bold}Warp Vanguard — upload key${off}"
say "${dim}This creates the signing identity for your Play listing.${off}"

# --- 0. refuse to clobber ---------------------------------------------------
if [ -f "$KEYSTORE" ]; then
  say ""
  say "${ylw}A keystore already exists:${off} $KEYSTORE"
  say ""
  say "Nothing has been changed. If this is the key you already published with,"
  say "that is exactly right — keep it and stop here."
  say ""
  say "If you are certain it is unused and want to start over, move it aside"
  say "yourself first:"
  say "   mv $KEYSTORE $KEYSTORE.old"
  say ""
  exit 0
fi

# --- 1. find a working keytool ---------------------------------------------
# /usr/bin/keytool on macOS is a shim that fails with no JDK installed; the
# Homebrew JDK this project already builds with is the reliable one.
KT=""
for cand in /opt/homebrew/opt/openjdk@17/bin/keytool "${JAVA_HOME:-}/bin/keytool" "$(command -v keytool 2>/dev/null || true)"; do
  [ -n "$cand" ] && [ -x "$cand" ] || continue
  if "$cand" -help >/dev/null 2>&1; then KT="$cand"; break; fi
done
[ -n "$KT" ] || die "No working keytool found. Install Java:  brew install openjdk@17"
step "Using keytool"
ok "$KT"

# --- 2. generate a password -------------------------------------------------
# 32 chars from a URL/shell-safe alphabet. Generated rather than chosen because
# a keystore password is typed roughly never and stored in a manager — there is
# no reason for it to be memorable, and every reason for it to be strong.
step "Generating a password"
# `set -o pipefail` + `head -c` is a trap: head closes the pipe at 32 bytes, tr
# takes SIGPIPE, and the pipeline reports failure even though it did its job —
# which under `set -e` kills the script silently. Drop pipefail for this one
# subshell rather than papering over it with `|| true`, which would also hide a
# genuine failure.
PW="$(set +o pipefail; LC_ALL=C tr -dc 'A-Za-z0-9' < /dev/urandom | head -c 32)"
[ ${#PW} -eq 32 ] || die "Password generation failed."
ok "32 characters, random"

# --- 3. create the keystore -------------------------------------------------
# The certificate identity fields are cosmetic for an upload key — Play never
# displays them and never verifies them. validity 10000 days ≈ 27 years; Play
# requires the cert to outlive 22 October 2033.
step "Creating the keystore"
"$KT" -genkeypair \
  -keystore "$KEYSTORE" \
  -alias "$ALIAS" \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -storepass "$PW" -keypass "$PW" \
  -dname "CN=Warp Vanguard, OU=Games, O=Warp Vanguard, L=Tel Aviv, C=IL" \
  >/dev/null 2>&1 || die "keytool failed to create the keystore."
chmod 600 "$KEYSTORE"
ok "$KEYSTORE"

# --- 4. wire it into the build ---------------------------------------------
step "Writing android/key.properties"
cat > "$PROPS" <<EOF
storeFile=$KEYSTORE
storePassword=$PW
keyAlias=$ALIAS
keyPassword=$PW
EOF
chmod 600 "$PROPS"
ok "$PROPS  ${dim}(gitignored)${off}"

# --- 5. back it up ----------------------------------------------------------
step "Backing up"
mkdir -p "$BACKUP"
cp "$KEYSTORE" "$BACKUP/"
cat > "$BACKUP/PASSWORD.txt" <<EOF
WARP VANGUARD — PLAY UPLOAD KEY
================================
Keystore : warp-vanguard-upload.jks   (the copy beside this file)
Alias    : $ALIAS
Password : $PW
           (same value for both the store password and the key password)

Created  : $(date '+%Y-%m-%d')
App      : com.warpvanguard.game

WITHOUT THIS FILE AND THIS PASSWORD YOU CANNOT SHIP AN UPDATE.
Copy both into a password manager. This folder is not a backup —
it is on the same disk as the original.
EOF
chmod 600 "$BACKUP/PASSWORD.txt"
ok "$BACKUP"

# --- 6. prove it works ------------------------------------------------------
step "Verifying"
FP="$("$KT" -list -v -keystore "$KEYSTORE" -alias "$ALIAS" -storepass "$PW" 2>/dev/null | grep 'SHA1:' | head -1 | sed 's/^[[:space:]]*//')"
[ -n "$FP" ] || die "Created the keystore but could not read it back."
ok "Readable, and the build can find it"
say "${dim}     $FP${off}"

# --- 7. the only part that needs a human -----------------------------------
cat <<EOF

${bold}════════════════════════════════════════════════════════════════${off}
${bold}  YOUR KEYSTORE PASSWORD${off}
${bold}════════════════════════════════════════════════════════════════${off}

      ${bold}$PW${off}

  ${ylw}Copy it into your password manager now, before you close
  this window.${off} It is also saved at:

      $BACKUP/PASSWORD.txt

  That folder is on this Mac. If this Mac dies, so does your
  ability to update the app — so put the password AND a copy of
  the .jks file somewhere else too.

${bold}════════════════════════════════════════════════════════════════${off}

  ${grn}Done.${off} Tell Claude "key is ready" and it will build the AAB.

EOF
