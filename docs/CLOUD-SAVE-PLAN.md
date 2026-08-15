# Cloud Save & Identity Recovery — plan

**Status:** scoped, not built. Decided 2026-08-15. Build post-launch.

**Decision:** progress follows the player's **Google / Apple platform account**,
with **as little friction as possible** — the target is *zero sign-in UI*. The
in-game reset stays the escape hatch, which imposes a specific requirement on
the merge (see §5, and read it before building anything).

**Monetization context (decided 2026-08-15):** free with ads, one purchase
removes them, through Play Billing / StoreKit. This supersedes the free-demo +
relay-04 unlock model in `docs/RELEASE-PLAN.md`. It also reverses
`docs/PRIVACY-POLICY.md`'s "no advertising — must stay true" and forces an EEA/UK
consent flow (Google's certified-CMP requirement) plus an iOS ATT prompt if IDFA
is used. Those are separate work items, not this document's, but they land on the
same first-launch screen this plan is trying to keep clean. See §8.

---

## 1. The problem

`player_id` **is** the Supabase anonymous auth uid, and the only proof of
identity anywhere in the system is possession of a JWT for that `sub`.
`supabase/functions/my-data/index.ts:19` says it outright:

> possession of a valid token for `sub` IS the proof

That session lives in `localStorage`, in the same save blob as everything else
(`STORE_KEY = 'warpVanguard.v1'`, written by `saveState()`).

So when a player reinstalls or moves to a new phone, the refresh token goes with
it. Next boot, `lbSession()` finds no `identity.refresh`, falls through to
`/auth/v1/signup`, and mints a **brand new uid**
(`src/game/31-leaderboard.js:132-135`). That costs two things:

1. **Campaign progress.** Never on the server. The schema has `runs`,
   `player_limits` and `reports` — no progress table.
2. **Their leaderboard identity.** Their `runs` rows are keyed to the old uid.
   Now unauthenticatable: unrenameable, undeletable, invisible to MY DATA.

Any fix that restores **`localStorage` itself** solves both at once, because the
refresh token rides along with the progress. That observation drives §3.

---

## 2. Friction is the design constraint

The brief is minimum friction. Ranked by what the player has to do:

| | Player does | Restores | Cross-device live sync |
|---|---|---|---|
| **Tier 0** — OS backup | **nothing** | on reinstall / new device | iOS yes, Android no |
| **Tier 1** — PGS Saved Games | silent on Android for most | any time | yes |
| **Tier 2** — Supabase sync + identity link | silent, after a link | any time | yes, plus web |

**Start at Tier 0.** It is the only one with genuinely zero UI, it needs no
Supabase changes, no Edge Function and no account linking, and — because it
restores the whole save blob — it fixes the leaderboard identity problem as a
side effect. Go further only if a gap in §3 actually bites.

---

## 3. Tier 0 — the platform already does this

### iOS: `NSUbiquitousKeyValueStore`

iCloud key-value storage. No prompt, no sign-in, no UI at all: it syncs against
the Apple ID already on the device and pushes between the player's devices
automatically. Limits are 1 MB and 1024 keys; the save is a few KB. This is a
genuine cross-device sync with zero friction, which is the best outcome
available on either platform.

### Android: Auto Backup

Backs the app's data up to the user's Google Drive and restores on install. No
sign-in, no prompt, no code — but **restore happens only at install time**, so
two simultaneously-active devices will not converge. Given the brief, that is
the right trade for v1.

**Do not rely on WebView `localStorage` surviving Auto Backup.** WebView data
backup is inconsistent across versions, and `app_webview` is a directory Google
has at times advised excluding. Instead mirror the save blob into
**`@capacitor/preferences`** (SharedPreferences on Android, `NSUserDefaults` on
iOS), which is backed up reliably. `localStorage` stays the working copy; the
Preferences copy is the durable one, written on the same debounce as §7.

On boot: if `localStorage` is empty and a Preferences copy exists, that is a
restored install — adopt it wholesale, session token included, and the player is
back with their uid, their runs and their progress intact.

### What Tier 0 does not do

- Android: no live sync between two active devices.
- Neither: no web build coverage (out of scope — post-launch portal funnel).
- Neither: no recovery if the player declines OS backup or wipes it.

---

## 4. What syncs

**Syncs:** `progress.camp[id].{unlocked, stars[], bests[]}`, `progress.best`,
`progress.weekly.{last, streak, best}`, the `{enlisted, tutorialDone,
stripBriefed, wallBriefed}` flags, `identity.name`, and — Tier 0 only, because
it is a whole-blob restore — `identity.{id, uid, refresh}`.

**Never syncs:** `settings.*` (volume on a tablet is not volume on a phone) and
`mutators` (a per-device loadout; `mutLive()` already gates it to flow runs).

At Tier 1/2, where the payload is chosen rather than a blob copy,
`identity.{token, refresh}` must be **excluded** — syncing session material
through a third party is handing out credentials.

---

## 5. The reset trap — read this before designing the merge

Progress fields are monotonic (they only go up), so the natural merge is a
per-field join: `max` for `unlocked`, `stars[i]`, `bests[i]`, `best`,
`weekly.best`; logical OR for the flags; `weekly.{last, streak}` joined as one
unit by higher `last`, tie-broken on `streak`. That join is commutative and
idempotent, so sync order never matters and retries are free.

**But a monotonic join makes reset impossible.** `max(0, 8) = 8`. The moment
cloud save exists, RESET CONTRACT clears the local copy, the next
sync/restore reads the old value back, and the reset silently un-does itself.
The escape hatch stops working precisely because the merge is well-behaved.

**Fix: a reset epoch.** Carry an integer `resetEpoch` in the synced blob.

```
merge(a, b):
  if a.resetEpoch !== b.resetEpoch → the higher epoch wins WHOLESALE
  else                             → the monotonic per-field join above
```

Reset increments the epoch locally and pushes. A wipe now beats any older
state on any device, and within an epoch the safe join still applies.

Two follow-ons:

- **The current reset is per-campaign**, not global (`RESET CONTRACT`, long-press
  the ↺ key — `src/game/92-guide.js:657`). Either the epoch is per-campaign, or
  a global reset is added. Per-campaign is truer to what exists.
- MY DATA's *delete* is a different verb — it erases leaderboard **runs**, not
  progress. Keep them distinct in the UI; conflating them would be a data-loss
  surprise.

---

## 6. Tier 1 / Tier 2 — only if Tier 0's gaps bite

**Tier 1 — Play Games Saved Games.** PGS v2 signs in silently for most Android
users. Buys live cross-device sync and any-time restore. Costs a native plugin.

**Tier 2 — Supabase `player_progress` + identity link.** A `player_id`-keyed
`jsonb` row, service-role only like everything else, written through an Edge
Function that derives `player_id` from the verified JWT `sub` and **never from
the body** — the discipline `submit-run` already set
(`supabase/functions/submit-run/index.ts:7`). **The merge must run server-side**:
a client-side merge lets a modified client push a lower value and erase progress.

Supabase can link an OAuth identity onto an anonymous user **preserving the
uid**, so a player's existing board rows survive the upgrade. **Never merge two
populated uids** — board rows carry per-row `name_locked` flags and report
history, so there is no non-destructive join. Link before divergence.

If Tier 2 ships, MY DATA's delete path **must** learn about the new table, or a
deleted player's progress outlives their account.

---

## 7. Client integration

- `saveState()` (`src/game/32-save.js:70`) stays the single local writer. Do not
  make it async or network-aware — it is called from hot paths. Mirroring and
  syncing are separate, debounced concerns.
- `lbSession()` (`src/game/31-leaderboard.js:126`) stays the single auth choke
  point. At Tier 0 it needs no change at all.
- Push on: level completion, return from background, app start. Debounced,
  coalesced, never blocking.
- Offline is invisible: play is entirely local already. Follow the `lbRpc`
  posture — deadline, `res.ok`, fail soft, never a modal.

---

## 8. Privacy

Tier 0 adds **no personal data to our database** and no new processing: the OS
copies the app's own data to the player's own cloud account. It should not
change the Data Safety form or the privacy policy.

The **ads decision does both**, and independently of this plan: an ad SDK
collects the Advertising ID, which changes the Play Data Safety declaration and
the App Store privacy labels, requires a certified CMP in the EEA/UK, and
contradicts `docs/PRIVACY-POLICY.md:20` as written. The Art. 6(1)(f) basis for
*leaderboard* data can survive — bases are per-purpose — but that argument has to
be made deliberately rather than inherited.

---

## 9. Open questions

1. Does `@capacitor/preferences` data reliably survive Android Auto Backup and
   iOS restore in practice? **Verify on real devices before committing** — the
   whole of Tier 0 rests on it.
2. Confirm `NSUbiquitousKeyValueStore` is reachable from Capacitor without a
   custom plugin, or cost the plugin.
3. Decide per-campaign vs global reset epoch (§5).
4. Does the ad-free entitlement share this rail? Play Billing restores it against
   the Google account natively, so probably yes — decide whether it and cloud
   save are one piece of work.

## 10. What not to do

- Do not ship cloud save without a reset epoch (§5) — it breaks the reset button.
- Do not trust WebView `localStorage` to survive Auto Backup (§3).
- Do not merge on the client, or merge two populated uids (§6).
- Do not sync settings, mutators, or session tokens above Tier 0 (§4).
- Do not make `saveState()` network-aware, or block any screen on a sync (§7).
