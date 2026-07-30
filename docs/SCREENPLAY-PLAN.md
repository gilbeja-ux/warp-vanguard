# The story rewrite — plan of work

A full rewrite of all 45 logs against a new spine: you are a **Lane Authority
operator**, a freelancer running contracts, who gets read into a corruption
investigation one mission at a time.

This document is the contract. It locks what we decided, what the format allows,
and the order we build it. The writing itself lives in `docs/SCREENPLAY.md`.

---

## The spine

> The Lane Authority licenses operators, hired to run point ahead of convoys. You are
> one of them, running contracts for clients.
>
> The first contract is ordinary. The second is a rebooking. After the third, the
> client tells you the part he was holding back: you were not hired, you were
> **chosen** — a new operator with no history, brought in to rule out corruption,
> because the data you have been defending is evidence in an investigation that
> reaches high-ranking government officers.
>
> After the fourth, you are given a contact: a **commander in Lane Command**, running
> that investigation. From there the job inverts. You stop only defending the line
> and start harvesting it — every trap you destroy is recovered, analyzed by CID,
> and turned into a name.
>
> Use CID's capabilities. Take them out one by one. Cut the head off the snake.

## Decisions — locked

| | |
|---|---|
| **Scope** | Full rewrite, all 5 campaigns, 45 logs. Level names, tuning and difficulty curve stay untouched. |
| **Beat placement** | The reveal ladder (ordinary → rebooked → chosen → commander) lands inside **Campaign 1's first four missions**. C2–C5 carry the flush-out and the head of the snake. |
| **Client** | One client, straight with you. He rebooks you deliberately — the rebooking *is* the tell. |
| **Evidence loop** | Real, not fictional: destroyed enemy counts (already tracked) feed a **TRACE ANALYSIS** line on the victory report. The gameplay verb produces the story beat. |
| **In-run voice** | The channel changes hands. M1–M4 it is **DEFENDERS DISPATCH** — bored, procedural, contractual. From M5 the same slot is **the commander**. The tonal switch does the storytelling for free. |
| **Setting** | One named reach, near-future. Its harbor, old moorings, trade spine and sublanes are the existing level names — they already read as one chart. |
| **Tone** | It comes for you. Mid-game they stop attacking the line and start attacking the operator. |
| **Structure** | Straight chronology, mission 1 to 40, present tense. |
| **Briefing** | Three art beats per mission, tapped through, inside the existing disc. |

## Decisions — open

- The commander: name, rank, and what is wrong with her.
- The operator: callsign — and whether the leaderboard handle becomes the name
  she says out loud (`docs/IDENTITY-SETUP.md` already stores one).
- The client: name, company, what he is actually shipping.
- The reach: name.
- Whether **OMNI** and **TRACE** survive as speakers, or collapse into
  client + commander.

---

## The format contract

Everything below is measured from the running code, not estimated.

### Geometry

The disc is `R = 0.396 × min(W, H)`; the text column is
`maxW = 0.528 × min(W, H)` — **206 CSS px** on a phone in landscape
([index.html:8694-8695](../src/index.html#L8694-L8695)).

### The font rule — no shrinking

Today the body loop shrinks 14px → 8px until the lines fit
([index.html:8732-8734](../src/index.html#L8732-L8734)). That is deleted. The body
size is **fixed**; overflow wraps, and a beat that still overruns scrolls.

Audiowide measures ~0.63 em/char, so a locked 14px gives **~23 characters per
line**. Moving body copy to a real text face at the same size buys ~30% more —
**~29 characters** — and reads better under a briefing's dim. Audiowide stays on
the kicker, the title and TAP TO CONTINUE; the brand does not change.

### The budget

| | |
|---|---|
| Per line | ~29 characters |
| Lines visible per beat | 4 |
| **Per beat (one disc)** | **~115 characters** |
| Beats per mission | **1–3, as the mission needs** |
| Per mission | ~115–345 characters |
| Across the game | ~2,000 words of on-screen text |

Scrolling is the safety valve for the rare long beat — the reveal, the verdicts —
not the default. If a beat needs to scroll to be read, it is written wrong.

### Beat count is a pacing tool, not a template

**Three discs is a maximum, not a quota.** A mission gets the beats its story
earns and no more:

| Beats | When | Examples |
|---|---|---|
| **1** | Pace missions, escalation, "more of the same but worse" | C3 M18 GHOST CURRENT, C5 M38 DEEP TRANSIT |
| **2** | A situation plus a turn | most missions |
| **3** | Reveals, arrivals, and the moment a campaign changes shape | C1 M3 THE OFFER, C1 M4 THE CONTACT, C3 M22 BLADE |

This matters twice over. It gives the campaign a rhythm — a run of one-beat
missions makes the next three-beat briefing land like a stop — and it takes the
art budget from ~120 images down to a realistic **70–85**.

### What this means for the writing

Sixty words a mission is not a limitation on the story, it is a division of
labour:

- **The image carries the action.** Where we are, who is in the room, what it
  looks like when a relay dies.
- **The text carries the spoken line and one hard fact.** Nothing else earns its
  characters.

This is how a screenplay already works. The scene description becomes the
**IMAGE BRIEF**; only what is said lands on the disc.

---

## The story lab

`npm run lab` → <http://localhost:8010>. Desktop-only, not part of the store
build.

The screenplay is too big to write in one markdown file, so the writing happens
in a tool instead:

| | |
|---|---|
| **Rail** | Five acts, eight missions and a verdict each. Status dot per mission, gold `✳` where there is an open ask. |
| **Act page** | Premise, the full act outline, and the spread — every mission's beat in order, clickable. |
| **Mission page** | Beat · scene · briefing discs · hint · case note · TRACE analysis · notes. |
| **Discs** | 1–3 per mission, each with a title, four lines, and an **art description** — the shot the image is generated from. |
| **Live budget** | Every line counts against 29 characters as you type, and the preview beside it is **206 px wide at 14 px** — the real text column on a phone in landscape. What fits there is what fits in game. |
| **Tuning strip** | Duration, speed, the mechanic this mission introduces and its boss kind, read straight from `src/campaigns.js`. The story is fitted to the curve that already works. |
| **Ask Claude** | A button on every mission and act. The ask is written into `story.json`, so it is in the repo — paste the copied prompt and I read it from there. |
| **Reference column** | The whole narrative record, start to finish, live from `docs/` — a column beside the editor rather than an overlay, because you read it *while* you write. Doc switcher, jump list, find-in-document, and **excerpt-taking**: select any passage and `Insert →` drops it into the field you were last typing in. `⌘\` toggles it. |

**Files.** `docs/lab/story.json` is the working copy and the source of truth for
the rewrite; it is created from `seed.json` on first run, never overwritten from
the seed again, and every save keeps the previous version at `story.json.bak`.
`npm run lab:seed` regenerates the seed from `src/campaigns.js` — it does not
touch `story.json`.

`docs/SCREENPLAY.md` stays the readable narrative record: the bible and the
five-act outline. The lab holds the per-mission work.

## Two documents, one derived from the other

**`docs/SCREENPLAY.md`** is where the writing lives — elaborate, unconstrained,
the thing worth reading on its own. One scene per mission:

```
MISSION 03 — METRO EXCHANGE                        [C1 · reveal]
INT. RELAY SUBSTATION — NIGHT

    Scene, action, dialogue. As long as it needs to be. This is the
    document Gil reads, argues with, and generates art from.

IMAGE BRIEF
  beat 1 — [shot, subject, light, palette]
  beat 2 — [...]
  beat 3 — [...]

DERIVED  ← the contract with the engine
  title      LOG 03 — THE OFFER
  beat 1     2-4 lines, ≤29 chars each
  beat 2     ...
  beat 3     ...
  hint       ...
  caseNote   ...
  analysis   TRACE ANALYSIS line, keyed to an enemy type
  barks      any per-mission overrides
```

**`src/campaigns.js`** receives only the DERIVED blocks. `docs/STORY.md` — the
current flat script — is retired and regenerated from the screenplay once the
rewrite lands, so there is exactly one source of truth.

## Order of work

1. **The bible** — one page: the reach, the cast, the rules of the world, the
   corruption ladder, and who knows what when. Agreed before a word of scene work.
2. **Campaign 1 in full** — 8 missions + verdict, written as the template. This is
   the one we argue about. Everything downstream copies its shape.
3. **Campaigns 2–5** — 32 missions + 4 verdicts against the locked template.
4. **Port** — DERIVED blocks into `campaigns.js`; update `PRODUCT.md`, `BRAND.md`
   and `docs/STORE-LISTING-BRIEF.md` to the new premise; retire `docs/STORY.md`.
5. **Build** — the art pipeline. `art:` is specified in `docs/DISC-ART-SPEC.md`
   but **nothing in `index.html` reads it yet**. Needs: the three-beat tap-through,
   the fixed-size body with scroll, the letterbox panel, and lazy image loading.

Steps 1–4 are writing and can run ahead of step 5 — the game keeps working with
the procedural glyph until the art lands, one disc at a time.

## Notes carried forward

- **The anomaly rule.** Missions 1–3 are the client screening you. Each must plant
  one detail that only makes sense after the reveal — a fee that clears too fast,
  an instruction too specific, a client who never asks what you found. The reveal
  should detonate three missions the player already played, not just announce a twist.
- **`docs/IN-RUN-VOICE.md`** is written but unexecuted: it replaces 113 scripted
  comms with ~35 reactive barks. The commander taking the channel at M5 is the
  same slot, so the two land together.
- **Campaign 3 (SIGNAL LOST, the dead coast)** is currently a ghost story with no
  corruption in it. Under the new spine it either earns a tie-in or is deliberately
  the breather case. Decide during step 1.
- **Campaign 4 (THE BAIT)** already *is* "flush him out." It survives the rewrite
  nearly intact in structure.
- The validator caps: level name ≤28 chars, comm ≤64 chars, `story.lines` any
  length ([index.html:1341](../src/index.html#L1341)).
