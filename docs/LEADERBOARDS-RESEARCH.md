# Leaderboards — Research & Scoping

_Investigation done 2026-07-23. Question scoped: what would it take to add leaderboards **per campaign level** and for the **free-flow modes** (endless + daily)?_

**TL;DR:** the scores are already tracked and persisted locally. The hard part is everything around them — player identity, a server, and anti-cheat. All line refs are `src/index.html` unless noted (~10.9k-line single file; ignore stale copies under `.claude/worktrees/*`).

---

## 1. What already exists (the good news)

Every number you'd want to rank is already computed and persisted locally in one `localStorage` blob (`STORE_KEY = 'dataDefenders.v1'`, [index.html:940](../src/index.html#L940)). Saved via `saveState()` ([953](../src/index.html#L953)) as `{ progress, settings, mutators }`; loaded + shape-migrated on boot (`migrateSaveShape` [942](../src/index.html#L942)).

`progress` shape (default [937](../src/index.html#L937)):
```js
progress = {
  camp: {},            // per-campaign-id: { unlocked, stars:[per level], bests:[per level high score] }
  tutorialDone: false,
  bossBriefed, triadBriefed, spinnerBriefed, stripBriefed, wallBriefed,  // one-time briefing flags
  best: 0,             // ENDLESS all-time high score
  daily: { last, streak, best },   // daily-mode state
  lastCamp: <id>       // runtime
}
```

Scores already stored — **no new storage needed to rank existing data:**
- **Per campaign level** — `progress.camp[id].bests[i]`, written in `endLevel()` [3213](../src/index.html#L3213): `PROG.bests[levelIdx] = Math.max(...)`.
- **Endless (free flow)** — `progress.best` [3199](../src/index.html#L3199); shown on the endless menu tile [8790](../src/index.html#L8790).
- **Daily** — `progress.daily.best` (all-time daily best, not per-day) + `.streak` (consecutive-day) [3200-3206](../src/index.html#L3200).

Best-value display selection already unified at [9815](../src/index.html#L9815):
```js
const bestVal = endless ? (daily ? progress.daily.best : progress.best) : PROG.bests[levelIdx];
```

### Scoring internals
- `score` is a single mutable module-level global [1092](../src/index.html#L1092), reset in `resetRun()` [3102](../src/index.html#L3102).
- Accrued via plain `score += ... * mutMul()` in ~a dozen places (2094, 2127, 2152/2562, 4063, 4111, 4139, 4198, 4241, 4303, 4400). `mutMul()` = score multiplier from mutator toggles.
- Run stats at end: `score`, `zaps`, `misses`, `combo`, `perfects`, `fragsHit`, `integrity`. `endStars` computed in `endLevel()` [3195](../src/index.html#L3195) (campaign only; endless/qual = 0).
- **NOT captured/persisted today:** run time (`levelT` exists but isn't saved) and `combo` — would need ~2 lines in `endLevel()` if you want tiebreakers.
- END screen (~9790–9858): count-up score, `zapped/perfect` + `missed/integrity%` line, BEST / NEW BEST reveal, case note, nav buttons.

---

## 2. What's missing (the cost drivers)

The gap between "personal records" and a competitive leaderboard is three things the codebase has **none** of:

| Need | Current state |
|---|---|
| **Identity** (name / player id) | Nothing — no name, account, uuid, or device id anywhere. Searches for `handle/profile/uuid/deviceId/account` = only false positives. Save blob has no per-player field. |
| **Network / backend** | Purely offline. Every `fetch` loads a local audio asset (345, 464, 10107). No XHR/WebSocket/sendBeacon/remote URLs. `manifest.webmanifest` + `capacitor.config.json` have no `server.url` — APK runs bundled files locally. `sw.js` is a same-origin cache proxy, not a backend. |
| **Anti-cheat** | `score` is a plain mutable global in shipped, readable JS — editable from the console in seconds. Persisted bests are unsigned integers in one JSON blob — no hash/checksum. |

The anti-cheat point is the killer for anything global: without server-side validation, an online board gets topped by console-edited scores immediately.

---

## 3. Determinism — the leverage for verification

How each mode is seeded decides what's verifiable. PRNG = `mulberry32(a)` [3171](../src/index.html#L3171). Two streams: `spawnRng` [1309](../src/index.html#L1309) and global `Math.random` (`sysRandom` saved [1107](../src/index.html#L1107)).

- **Campaign levels — DETERMINISTIC.** `startLevel(i)` [3119](../src/index.html#L3119): `spawnRng = mulberry32((0x51AB1E + i*7919) >>> 0)`. Same script every run for everyone. Beats/streams use derived deterministic seeds too.
- **Daily — SEEDED PER CALENDAR DAY, same for everyone.** `startDaily()` [3179](../src/index.html#L3179): `Math.random = mulberry32((dayN * 2654435761) >>> 0)` where `dayN = floor(Date.now()/864e5)` (UTC-day). Identical stream for all players that day. **The natural competitive mode.**
- **Endless — FULLY PROCEDURAL / UNSEEDED.** `startEndless()` [3161](../src/index.html#L3161): `spawnRng = Math.random` (not seeded). Difficulty = pure function of survival time (`endlessCfg(t)` [902](../src/index.html#L902)). Every run unique + **unreproducible → can't be server-validated or compared as "same run."** Leaderboard here = trust-only, or add a seeded "ranked endless" variant (loses the every-run-unique feel).

**Consequence:** campaign + daily scores could be server-validated by replaying a recorded input trace against the known seed. Endless cannot without reseeding.

**Fairness wrinkle:** mutators change scoring (`mutMul()`), so any ranked board must lock mutators for ranked runs or record which were active.

---

## 4. Build tiers

**Tier 0 — Local records board (~1 day).** A screen listing per-level bests + endless/daily bests. All data exists; pure UI, no network, no identity. Not competitive but real and free. Do regardless.

**Tier 1 — Share-code / friends board (~3–5 days, no server).** Add player name + generated id, serialize bests into a shareable code/QR, import friends' codes into a local "friends" board. Offline, no hosting. Cheatable, but social-trust context makes that fine. Good middle ground.

**Tier 2 — Real online leaderboards (~2–4 weeks + ongoing hosting).** Needs all three missing pieces: identity UI, a network layer from scratch (serverless — Supabase/Firebase/Cloudflare KV; Capacitor also opens Google Play Games on Android), and score validation. Use daily/campaign determinism for replay-verification; endless stays trust-based or gets reseeded. Real ongoing commitment: moderation, abuse, cost.

---

## 5. Recommendation

- **Do Tier 0 now** — cheap, uses existing data.
- **Make daily the flagship competitive surface** — it's the only mode already built for fair comparison (shared seed per day + stored best/streak); it just lacks identity + transport.
- **Tier 1 share-codes** = ~80% of the social value at ~10% of the cost, no backend-ops.
- **Only go Tier 2** if committed to running a service. If so, start with daily + campaign (verifiable), decide deliberately about endless.

### Concrete gaps to fill regardless of tier
1. **Identity** — none today; need name entry + generated persistent id in the save blob.
2. **Capture time + combo** at `endLevel()` if you want richer boards / tiebreakers (~2 lines).
3. **Ranked ruleset for mutators** — lock or record them for comparable scores.
