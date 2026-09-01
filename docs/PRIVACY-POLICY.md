# Privacy Policy

**The policy itself lives in [`privacy.html`](privacy.html)** — that file is the
one published to the web and the one the store points at.

Published URL (GitHub Pages, source = `master` branch `/docs` folder):

> **https://gilbeja-ux.github.io/warp-vanguard/privacy.html**

## Why there is no copy here

A legal document kept in two formats drifts, and the day it drifts is the day
the store is looking at one version and the player at another. There is one
file. Edit `privacy.html`; the change is live when it is pushed.

## What it currently promises

Worth knowing, because the code has to keep these true:

- No advertising, analytics or tracking — **must stay true**; adding any SDK
  that phones home means updating both the policy and the Play Data Safety form.
- Collected: an anonymous player id, the chosen display name, run results, and
  a replay trace. Nothing else — **unless the player sends feedback**, which is
  the one optional pipe, added 2026-09-01.
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
  (`gilbeja.int@gmail.com`) survives as the secondary path and is stated in the
  policy with its real limit: an entry is linked to no name or account anyone
  can look a person up by.
