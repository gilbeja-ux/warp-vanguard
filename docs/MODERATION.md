# Moderation & admin — reading the numbers, answering reports

The only user-generated content in Warp Vanguard is the **display name** on a
leaderboard entry. This is how you see what has been reported and what to do
about it — and, at the end, what the leaderboard data can and cannot tell you
about how the game is going.

## Start here: the admin console

```
npm run portal     →      http://localhost:8015   (everything, live/dead)
npm run admin      →      http://localhost:8014   (the queue itself)
```

The **portal** lists every local tool with a live/dead dot, the command to start any
that are down, whether the verifier is stale, and the leaderboard headline numbers.
It is the one to open first.

Reports as cards with buttons on them — **Rename…**, **Redact**, **Release**,
**Dismiss**, **Delete** — plus the numbers. No uuids to copy, no SQL to type.
Acting on a report marks it handled and moves it to a folded *Handled* section, so
the queue is what is still open rather than everything that ever happened.

**Rename…** opens a drawer: type a handle, or take *reset to VanguardXXXXXX* —
usually the kinder answer, and the right one for the `personal` reason, where the
point is that the name should stop being a name. Either way the entry is locked.

**Every action can apply to all of that player's entries**, via the checkbox in the
rename drawer, or `Redact` with it ticked. This matters: the handle is copied onto
every row a player holds, so redacting only the reported entry leaves the same
string on their other boards and the next report arrives tomorrow from one of them. It is the same shape as the story/dest/tuning/disc labs: a local server and
one page, never deployed, bound to `127.0.0.1` only.

It takes the `service_role` key from the linked Supabase CLI (or
`SUPABASE_SERVICE_ROLE_KEY` if you set one) and **keeps it in the Node process** —
the page talks only to localhost, never to Supabase, so the key is never in the
browser.

The rest of this file is the same work done by hand in the **Supabase dashboard →
SQL Editor** ([project](https://supabase.com/dashboard/project/ghkbjlgcdrszkawfbxdr/sql)),
for when you would rather see the tables directly. The console's buttons call the
very same `moderate_name` / `release_name` functions, so the two agree by
construction.

The `reports` table is unreachable from the game — RLS is on with no policies, so
no client role can read or write it. Only the service role and you can see it.

## Nothing tells you a report arrived

There is no email, no push, no badge. Verified runs **never** auto-act, so they
sit in the queue until a human looks. Make it a habit — a weekly glance is enough
at current traffic.

---

## 1. Don't read the `reports` table

It holds `run_id`, `reporter_id`, `reason`, `created_at` — and the thing you are
trying to judge (*what does this name actually say?*) is in a different table. Open
it and you get a column of uuids and nothing to decide with.

Read **`report_queue`** instead. It is the join, pre-made: one row per reported
*run*, carrying the name, the board, the score, and how many people flagged it.

**Table Editor → `report_queue`**, or in the SQL Editor:

```sql
select * from public.report_queue order by reports desc, last_report desc;
```

Reading it:

| Column | What it tells you |
|---|---|
| `run_id` | The row uuid. Every action below takes this. |
| `reports` | How many *different* people flagged it. A unique index makes stacking impossible, so 3 means three people. |
| `verified` | `true` → a replayed, provably legitimate run. These never auto-redact; they are yours to judge. `false` → endless, trust-only. |
| `name_locked` | `true` → already redacted, automatically or by you. The player cannot rename it back. |
| `reasons` | `offensive`, `personal`, `impersonation`, `other`. Closed set — there is no free text to read. |

Rows already handled by the threshold show `player_name = 'REDACTED'` and
`name_locked = true`. They stay listed as the record of what happened; nothing
further is owed unless you disagree with the automatic call.

`report_queue` is not reachable from the game — it inherits the RLS on `reports`
(`security_invoker`), and is revoked from the client roles on top of that.

## 2. The three responses

Copy the `run_id` from the queue. Each response is one line in the SQL Editor.

**Redact and lock** — the normal action, and the same thing the automatic
threshold does. The name is neutralised, the score, rank and replay are untouched,
and the lock stops the player putting it straight back through MY DATA.

```sql
select public.moderate_name('<run_id>');    -- this entry
select public.moderate_player('<run_id>');  -- every entry this player holds
-- → redacted and locked (was: <the old name>)

select public.rename_entry('<run_id>', 'CALMNAME');   -- set one, locked
select public.rename_entry('<run_id>', 'CALMNAME', true);  -- …on all their entries
select public.reset_entry_name('<run_id>');           -- back to VanguardXXXXXX
select public.dismiss_reports('<run_id>');            -- the report was wrong
```

All of them stamp `reports.handled_at`, so there is no way to change a name and
leave its report looking untouched.

It answers with the name it replaced, so you have a record in your query history
of what you acted on.

**Release** — you redacted something you shouldn't have.

```sql
select public.release_name('<run_id>');
-- → unlocked — the player can now rename it (the old name is gone)
```

Note what this does *not* do: the original name is overwritten and gone. Release
only lets the player choose a new one. Deliberate — for the `personal` case,
keeping a copy of someone's real name so you could restore it later would defeat
the point of taking it down.

**Remove the entry entirely** — rare, and usually wrong.

```sql
delete from public.runs where id = '<run_id>';
```

Its reports and replay trace go with it (`on delete cascade`). Think twice: this
deletes somebody's *score* to solve a problem with their *name*, and redacting
already solved that.

### Handled, not deleted

Acting stamps `reports.handled_at` and the report stays — it is the record of why a
name changed. The console folds those into *Handled*. To drop one entirely:

```sql
delete from public.reports where run_id = '<run_id>';
```

## 3. When to reach for which

- **`personal` — someone's real name, an email, a phone number, a school.**
  Redact, always, without needing to establish who is asking. This is the case
  `privacy.html` promises to act on unconditionally.
- **`offensive`.** Redact if it clears the bar. The word filter already catches
  the obvious; what reaches you is what it could not know about — slang, a
  targeted in-joke, an unfortunate initialism.
- **`impersonation`.** Judgement. Two players picking the same handle is not
  impersonation; a name chosen to be mistaken for a specific known player is.
- **Anything on a `verified` row.** Read it yourself before acting. That is a
  record someone earned, and it is exactly what a brigade would target.

## 4. Checking for brigading

Before acting on a row with a suspiciously fast pile-up, look at who filed:

```sql
select reporter_id,
       count(*)                as filed,
       count(distinct run_id)  as targets,
       min(created_at)         as first,
       max(created_at)         as last
from public.reports
group by reporter_id
having count(*) >= 3
order by count(*) desc;
```

A handful of accounts filing against the same few rows within minutes of each
other is coordination, not consensus. There is no penalty mechanism for it — if
it ever happens, the answer is to release the affected rows and, if it persists,
delete the offending anonymous users in **Auth → Users**.

## 5. The automatic half

`report_run` redacts and locks a name at **three distinct reporters, and only on
an unverified row**. Verified campaign and weekly rows never auto-act.

The reasoning: a verified run is a record somebody earned and the board's whole
promise is that it stands, so an automatic action there is worth more to a brigade
than it is to you. An endless row is trust-only and unreplayable, so resetting its
name costs nothing that cannot be undone.

You can watch it fire in **Edge Functions → report-run → Logs**; each report logs
its row, reason, running count, and whether it tripped the threshold.

To change the bar, edit the `n >= 3` in `report_run`
(`supabase/migrations/20260813000200_rename_guards.sql`, and the copy in
`supabase/schema.sql`), then `supabase db push`.

## 6. What players can do themselves

Renaming and deleting live in the **MY DATA** panel (leaderboard screen, and
System Config). Two guards apply, and both matter here:

- Renaming is **once per 24h**. The first is always immediate; only a second
  change within the day waits.
- Renaming **skips `name_locked` rows**. Deleting never does — erasing the row
  removes the offending name outright, so there is nothing left to protect.

So a player you have moderated can still erase their entry. That is intended.

---

# The numbers

There is **no admin app**, deliberately. Four views make the Supabase dashboard
good enough on its own: open them in **Table Editor**, or chart them under
**Reports**. All are revoked from the client roles, so none is reachable with the
publishable key that ships inside the game.

| View | What it answers |
|---|---|
| `admin_overview` | One row. The whole state of play. |
| `board_occupancy` | Per board: who is on it, how hard it has become, is it still alive. |
| `ladder_reach` | How far into the contract ladder players actually get. |
| `player_growth` | New leaderboard identities per week. |

## Read these caveats once

They are baked into the column names, and forgetting them is how you make a bad
decision from a true number.

**Every board caps at 100 rows.** `submit_verified_run` evicts past the top 100 on
every write. So `entries` is *occupancy*, not traffic — it saturates and stops
moving no matter how many people play. Same reason `ladder_reach.players_placed`
is a **floor**: it counts top-100 holders, misses everyone who cleared a level
without placing, and flattens to "100 everywhere" once boards fill.

**`runs` has no reliable history.** A run set in March and evicted in May vanishes
from March's count too, retroactively. Any time series over `runs.created_at`
quietly rewrites its own past. `player_growth` uses `auth.users.created_at`
instead — those rows are never evicted, only deleted on request — which is why it
is the one honest clock here.

**Nothing here is DAU, and nothing here is installs.** An identity is minted when a
player opens the leaderboard or submits a score. Someone who plays for a month and
never opens the board does not exist in this data. That gap cannot be closed
without adding the analytics `privacy.html` and the Play Data Safety form both
promise are absent.

**A failed verification writes no row.** "Are honest players being rejected?" — the
question the stale-verifier 409s raised — lives only in **Edge Functions →
submit-run → Logs**. No query here can see it.

**Keep it aggregate.** Statistical use sits inside the legitimate-interest basis
the policy declares (GDPR Art. 5(1)(b)). Building a per-player picture would be a
different purpose than running a leaderboard, and is not covered.

## Two columns that were removed

`players_seen_7d` and `came_back` were both built on `auth.users.last_sign_in_at`.
On the live project, 118 of 124 users have it exactly equal to `created_at` — the
client keeps its session with a refresh-token grant, and GoTrue does not advance
that column on a refresh. So one was a worse-named duplicate of `players_new_7d`
and the other would have read ~0 for ever, which reads as *nobody comes back*
rather than *not measured*.

They are now `players_placing` (distinct players holding an entry — exact) and
`players_multi_day` (players whose entries span more than one calendar day — a
real returning-player signal, and a floor, since eviction can only undercount it).
