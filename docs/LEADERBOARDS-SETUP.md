# Leaderboards — Supabase Backend Guide

> ## ⚠️ UPDATE (2026-07-25) — anonymous, no accounts
> Sign-in was cancelled. Identity is **anonymous sessions only**; the display name
> is a **free-typed arcade handle** stored on each run row and moderated by the
> `submit-run` Edge Function (no `profiles`, no uniqueness, no Google/Apple/email).
> Boards **show the top 50** and the DB **keeps the top 100** per board. Apply
> **`supabase/migrate-anonymous.sql`** to move a live project onto this model.
> Ignore the Auth-provider / account sections below.

> ## ⚠️ UPDATE (2026-07-26) — one row per RUN, not per player
> A player can now hold **several rows on the same board** — every run that makes
> the cut stands on its own and is never overwritten by a later run. Each run
> carries a client-minted `run_id` (`captureRun()`), which is the board row's key,
> so the only thing that reuses a row is a re-submit of that same run (the
> "type your handle" rename flow). `leaderboard_rank` returns the player's **best**
> row. The top-100 cap now counts **rows**, not players. Apply
> **`supabase/migrate-multi-entry.sql`** and redeploy `submit-run`.

_Companion to [LEADERBOARDS-RESEARCH.md](LEADERBOARDS-RESEARCH.md). Decisions: **one backend on Supabase** (Auth + Postgres + Edge Functions + Storage), **replay validation** for anti-cheat, per campaign level + per free-flow mode, plus a **replay player** to watch other players' runs. This guide is what **you** set up in Supabase so we can wire the client._

> **History:** we briefly planned LootLocker (boards) + Cloudflare (verifier/traces). We consolidated onto Supabase so the whole backend lives in one account. Nothing game-side was wasted — see "Where the code already is."

---

## Why one provider covers everything

| Need | Supabase piece |
|---|---|
| Player identity | **Auth** — anonymous sessions now, Google/Apple later |
| Leaderboards | **Postgres** — one `runs` table; a "board" is just a value, nothing to pre-create; exact `rank()` ranking |
| Verifier (replays a run to validate its score) | **Edge Function** (Deno) |
| Replay trace storage | **Storage** bucket |
| Server-only score writes (anti-cheat) | **Row-Level Security** — clients read, only the service role writes |

---

## Where the code already is

On the `tutorial-streamline` branch, all covered by `npm test` — and all **provider-agnostic**, so the Supabase switch changed none of it:

- **Fixed-timestep sim** — a run's outcome is a pure function of seed + inputs, proven frame-rate-independent by a regression test. The prerequisite for both replay *validation* and the replay *player*.
- **Player identity** — `identity = { id, autoName, name, provider, email, token, refresh, uid }` in the save blob; a stable `id` + `Defender-<random>` label are minted on first boot (`ensureIdentity()`). Anonymous session + Google/Apple/email sign-in, unique-name claim, sign-out, and delete are all wired (see Step 2).
- **Run capture** — `captureRun()` builds `lastRun`, the submission payload: `{ board, mode, seed, score, timeSec, maxCombo, integrity, misses, perfects, zaps, mutators, verifiable, playerId, playerName, at }`. Called automatically in `endLevel()`.
- **Board keys** — `boardKey()`: `<campId>:<levelIdx>` (e.g. `investigation:2`), `endless`, or `daily`. These are the `board` values in the `runs` table.
- **The schema** — [supabase/schema.sql](../supabase/schema.sql): the `runs` table, RLS write-lockdown, `leaderboard_top` / `leaderboard_rank` / `leaderboard_provisional_rank` reads (all listing-gated by the `profiles` join), the `profiles` table + `check_name_available` / `claim_name` / `delete_my_data` identity RPCs, and the `submit_verified_run` write path.

**Not built yet (next):** input-trace recording (phase 3), the Edge Function verifier + `delete-account` function (phase 4), the board UI (phase 5), the replay player (phase 6), and — optional — supabase-js `linkIdentity` so OAuth keeps the same uid (see Step 2 caveat).

---

## Step 1 — Create the project & run the schema

1. Sign up at **[supabase.com](https://supabase.com)** → **New project** (pick a region near your players; save the DB password).
2. From **Project Settings → API**, copy:
   - **Project URL** (e.g. `https://abcd1234.supabase.co`) — public.
   - **anon public key** — public, ships in the client (RLS keeps it read-only).
   - **service_role key** — **SECRET.** Server-only; it bypasses RLS and is the only thing that can write scores. Never in the client or git.
3. **SQL Editor → paste [supabase/schema.sql](../supabase/schema.sql) → Run.** That's the entire leaderboard backend: one table, the write-lockdown, and the ranking functions. No boards to create — they spring into existence as scores are submitted.

Give me the **Project URL** and **anon key** and I can wire the client's read/display immediately.

---

## Step 2 — Identity (built — this is the spec + the config you must do)

> **Doing the setup?** Follow the click-by-click runbook: [IDENTITY-SETUP.md](IDENTITY-SETUP.md). The rest of this section is the design spec behind it.

**The model (decided & implemented).** Two tiers:

- **Anonymous = the default.** Every player is `Defender-<random>` (a cosmetic local label — never enforced-unique; the auth uid is the real identity). They play freely, see boards, and get a *provisional* rank ("you'd be #N"), but are **not publicly listed**.
- **Signed-in = listed.** After Google / Apple / email sign-in, a player claims a **unique, case-insensitive operator name** and gets a durable listed row. Only named players appear on boards — the `profiles` join in `leaderboard_top`/`_rank` is the single listing gate.

The "sign in to claim rank #N" prompt on the END screen is the conversion hook; the top-right **operator button** (next to the gear, home screen) opens the panel any time.

**What's already coded (client, `src/index.html`):**
- Auto-name minting, `displayName()` / `isSignedIn()`, the operator panel (name field + Google/Apple/email + sign out + delete), the END-screen tease, provisional rank, and all auth calls (raw GoTrue REST — no supabase-js, matching the existing style).
- OAuth returns via URL hash on web and via the `datadefenders://auth` deep link on native (`initAuthDeepLink`).

**What YOU must configure in Supabase (Authentication → Providers / URL Configuration):**
1. **Anonymous** — enable. (Zero-friction play + the verifier's write identity.)
2. **Email** — enable; set the OTP template to send a **6-digit code** (the client uses `verify` with `type: 'email'`, not magic-link click-through).
3. **Google** — enable; paste the OAuth client ID/secret from Google Cloud Console.
4. **Apple** — enable; add the Services ID + key (needs a paid Apple Developer account; required once you ship on iOS, and the App Store *requires* it wherever you offer Google/email).
5. **Redirect URLs** — add every return target: your web origin(s), and the native scheme `datadefenders://auth`.

**Native deep link (for the APK/IPA OAuth return)** — register the custom scheme + add the `@capacitor/app` plugin:
- Android: an `intent-filter` for scheme `datadefenders` host `auth` in `AndroidManifest.xml`.
- iOS: a `CFBundleURLTypes` entry for `datadefenders` in `Info.plist`.
- (Email OTP needs none of this — it's redirect-free, so it works on all three targets immediately. Test with email first.)

> **Same-uid caveat (raw-REST tradeoff).** Sign-in mints a *fresh* session; on **native** the app isn't reloaded so the just-played run resubmits under the new uid and appears instantly. On **web**, the OAuth redirect reloads the page and the in-memory run is lost, so the player is listed from their *next* run. Making OAuth link in-place (same uid, anon runs light up automatically) is the one thing that wants supabase-js's `linkIdentity` — a deliberate future upgrade, noted in the code.

**Account deletion (App Store / Play requirement).** The panel's DELETE calls `delete_my_data()` (clears the player's name + runs immediately) and then a `delete-account` Edge Function that deletes the `auth.users` row with the service role. Build that function alongside the verifier (phase 4); until it exists the client call fails soft, but the game data is already gone via the RPC.

---

## Step 3 — Storage bucket for replay traces

The replay player needs each run's input trace kept, not discarded after verification.

1. **Storage → New bucket** named `traces`, **private** (not public).
2. The Edge Function writes traces with the service role; the client reads a specific trace through a short-lived signed URL the function hands back. (I'll wire this in phase 4/6 — you just create the bucket.)

Traces are tiny — quantized pad-heights per sim step, a few KB gzipped per run.

---

## Step 4 — The verifier (Edge Function)

This is the piece that makes replay validation real — it replays a submitted run against its seed + trace and only writes the score if the replay reproduces it.

```
client run ends
  → client calls the `submit-run` Edge Function with { run, trace } (authed)
  → function replays the headless sim at run.seed + trace, recomputes the score
  → if it matches (campaign/daily):  upload trace to Storage → submit_verified_run(..., verified=true, trace_id)
     if endless (unseeded):          apply sanity caps only    → submit_verified_run(..., verified=false, trace_id)
     else: reject (cheating / desync)
  → returns the accepted rank
```

What you provide: nothing extra — Edge Functions ship with Supabase. I'll set the **service_role key** as a function secret (`supabase secrets set`), never in code. I build the function + a **headless sim entry point** that reuses the exact `update()` we made deterministic (imported into the function — no re-implementation, so the replay can't drift from the game). All score writes flow through here; the client never writes directly.

> **Endless = trust-only, labeled.** Unseeded → unverifiable, so its rows are `verified=false` and the UI tags them "unverified." Campaign + daily are `verified=true`.

---

## Replay player — watch other players' runs 🎬

Verification already replays a run's trace against the deterministic sim; the replay player points that **same trace** at the *renderer* instead of running headless. One trace, two consumers — the spectator replay is almost free.

- **Transport maps onto the fixed-timestep accumulator:** speed = how many `SIM_DT` steps per rendered frame (2× = two/frame, 0.5× = one every other frame, pause = zero), via the existing `EDITOR_DRIVE`-style clock hook with trace inputs injected in place of live input.
- **Full scrubber from day one.** Seed + trace determine every frame, so seeking to any timestamp = re-simulate forward to that step. Headless (draw stripped) the sim runs far faster than real-time, so re-simming a bounded campaign/daily run to any point is milliseconds — instant. (The sim is forward-only; there's no *backward* step, but seeking never needs one.)
- **Snapshots are only an optimization** — cache full sim state every ~5s so smooth *live-dragging* on very long endless runs re-sims from the nearest snapshot instead of from 0. Not needed for click-to-seek.

This is **phase 6**.

---

## Step 5 — Build order once the project exists

After Steps 1–3 (project + schema + `traces` bucket) and sending me the **Project URL + anon key**, I'll build in order:

1. **Client Supabase module** — a `LEADERBOARD` config block (URL + anon key) + anonymous Auth + **read/display** (`leaderboard_top` / `leaderboard_rank`). Works immediately; no verifier needed to *show* boards.
2. **Phase 3** — input-trace recording against the fixed-timestep loop, designed for **both** verification and replay.
3. **Phase 4** — the `submit-run` Edge Function + headless sim entry + trace upload.
4. **Phase 5** — submit-through-verifier + the per-level/per-mode leaderboard screens (daily as flagship).
5. **Phase 6** — the replay player (trace fetch → deterministic playback → transport + scrubber).

**Your move:** create the Supabase project, run `supabase/schema.sql`, add the `traces` bucket, enable anonymous auth, and send me the Project URL + anon key. Then I start on the client module.
