# Privacy Policy

**The policy itself lives in [`privacy.html`](privacy.html)** — that file is the
one published to the web and the one the store points at.

Published URL (GitHub Pages, source = `master` branch `/docs` folder):

> **https://warp.gb-il.cloud/privacy.html**

The site moved to `warp.gb-il.cloud` on 2026-10-15, so its address no longer
carries Gil's full name: `docs/CNAME` names the domain, and a `CNAME` record
`warp` → `gilbeja-ux.github.io.` at Namecheap points it at Pages. The old
`gilbeja-ux.github.io/warp-vanguard/` addresses redirect here, so a store field
that still holds one keeps working. Delete `docs/CNAME` before the DNS record,
never after: with the file and no record, the old address redirects to a name
that does not resolve.

## Why there is no copy here

A legal document kept in two formats drifts, and the day it drifts is the day
the store is looking at one version and the player at another. There is one
file. Edit `privacy.html`; the change is live when it is pushed.

## What it currently promises

Worth knowing, because the code has to keep these true:

- No advertising, no tracking and no third-party analytics — **must stay
  true**; adding any SDK that phones home means updating the policy, the Play Data
  Safety form and the App Store privacy label.
- **First-party play statistics, from 2026-11-05** (`src/game/34-telemetry.js`,
  `supabase/migrations/20261105000000_telemetry.sql`): one row per app session
  (start, seconds on screen, platform, OS version, device model, app version,
  locale), one per stage attempt (mode, contract, stage, result, seconds flown,
  score, LANE ASSIST), and named events from `track()` (a fault's site and
  version, never its message; a submit's outcome; the tutorial's and the
  paywall's own events). Same anonymous id, same legitimate-interest basis, read
  only in aggregate (the traction page on the admin console), kept **thirteen
  months** (`purge_old_telemetry()`), erased by *Delete my runs* (the rows cascade
  from the auth user, and `my-data` deletes them by name first). The store-form
  answers that change with it are in `docs/PLAY-STATISTICS-PRIVACY.md`.
- **Open before it ships:** the objection switch. `telSetOff()` exists and no
  screen calls it; `privacy.html` says so in a marked comment.
- Collected: an anonymous player id, the chosen display name, run results, a
  replay trace, and the play statistics above — plus feedback, the one optional
  pipe, added 2026-09-01.
- **Feedback is free text, and it is the second such field in the game.** What
  it carries is listed in `privacy.html` under *Feedback you send us*: the
  message, the subject, the build and sim id, the platform, the screen size, the
  language, the last stage played, and the anonymous player id. It is private to
  the developer, never shown in the game, and it carries **no email and no reply
  address** — that is what keeps the basis legitimate interest rather than
  consent. Adding a reply address would change the basis and is a deliberate
  non-goal; see `docs/FEEDBACK-PLAN.md` §3.7.
- **Feedback is the only thing here with a retention limit.** Kept until it is
  dealt with, then 90 days, and nothing past 12 months. That promise has an
  implementation: `purge_old_feedback()` in
  `supabase/migrations/20260901000000_feedback.sql`. Run it and the promise is
  kept; never run it and the policy is wrong.
- **Deletion is in the game.** The MY DATA panel renames or erases every entry
  the player holds, and `privacy.html` documents it (see its *Your controls*
  table). Erasing takes the rows, their replay traces, the reports the player
  filed, **their feedback**, and the anonymous id itself. The email route
  (`hello@gb-il.cloud`) survives as the secondary path and is stated in the
  policy with its real limit: an entry is linked to no name or account anyone
  can look a person up by.
