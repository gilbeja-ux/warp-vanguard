# Theme shift — DARK FIBER → WARP OVERWATCH

The record of what this branch changes and, more importantly, **what it does not**.
Written first so the shift stays reviewable and reversible: if the theme is
abandoned, this file is the diff to read.

> **The pitch in one line.** You are not defending a data stream inside a cable.
> You are running point ahead of a freight convoy, down its assigned warp lane,
> clearing the interdictors seeded to pull it out of transit.

## Why this is cheap

The mechanic never depended on the fiction. Two emitters on a shared ring,
intercepting things that arrive down a receding bore, where color is the rule
set. Nothing in that sentence is about data.

Three things make the swap close to free:

1. **The bore was always the mark.** BRAND.md's own words. A receding
   hoop-and-spoke tunnel *is* a warp lane, and it needed a paragraph of
   explanation to be a fiber-optic cable. The most expensive art in the game
   gets more legible for zero work.
2. **The institution kept its shape, then lost its name.** Cyber Investigations
   Department first became Convoy Integrity Division — same three letters, so 71
   occurrences needed no edit at all — and was later renamed outright to **Lane
   Command** (speaker id `CMD`) when the last Data Defenders place-names were
   stripped. The role never moved: the authority that receives the evidence and
   cannot trust its own building.
3. **The engine's nouns were already spatial.** `bore`, `tunnel`, `ring`,
   `relay`, `rail`, `node`, `arc` — every one of them reads *better* in a warp
   lane than in a cable. The identifiers do not move.

## What survives verbatim

Not translated. Already correct.

| | Why it works unchanged |
|---|---|
| **Meridian Haulage** | "The largest carrier on it, hosting the load nobody thinks about." Change what it carries from records to freight and every word of the existing description holds. |
| **Meridian** | Reads as a system as naturally as a city. Now the **Meridian Reach** — the settled volume the lane network serves. |
| **The Ring** | People who run a place quietly and never touch a line themselves. Setting-agnostic. And the name now doubles: a ring of powerful holdings around the core systems. |
| **THE DISPATCHER** | A program with four jobs, iterating, never shipping the same weakness twice. Nothing about it is data-specific. |
| **The wardens** | Guardian programs stationed at junctions. Junctions exist in both worlds. Boss kinds `core` / `triad` / `spinner` / `triad` / `core` unchanged. |
| **TRACE** | An analyst who reads what you bring back. Handle, not a job title. |
| **relay** | A waypoint on a route. *More* natural in space than in fiber. All 73 occurrences stand. |
| **bore, tunnel, ring, rail, rim, arc** | Engine and fiction vocabulary both. No edit. |
| **The signature spine** | Every interception yields a **dispatch signature**; forty missions of them triangulate something that only ever transmits outward. Interdictors are manufactured objects with origin marks — the forensics survive intact. |
| **All color tokens** | Values unchanged. Meanings re-explained, not re-assigned. |
| **The entire audio direction** | Synthwave, the seam duck, the run pool, the dry military boot sequence. Theme-agnostic. |

## What changes

| Was | Now | Note |
|---|---|---|
| the Grid | **the Lanes** | The charted warp network. |
| a fiber line | **a warp lane** | |
| dark fiber | **dark transit** | An unlit, uncharted, unpatrolled lane. Same meaning, same menace. |
| the stream / the payload | **the convoy / the cargo** | |
| a tap | **an interdictor** | The player's word for every hostile object on the lane. |
| a packet | **a charge** / **a mine** | |
| node (player-facing) | **emitter** | Engine identifier `node` stays. |
| Data Defenders *(the licensing body)* | **the Lane Authority** | Certifies squadrons, brokers contracts, takes its cut, does not protect you. Dispatch channel still automated. |
| operator *(the trade)* | **operator** — unchanged | Setting-neutral; the Lane Authority still certifies operators. What changed is how the player is *addressed*: callsign **RUNNER**, unit callsign **wolf**. |
| the firewall perimeters *(map)* | **the patrol cordons** | Concentric belts of escort cover around the core systems. |
| FIREWALL *(power-up)* | **DEFLECTOR** | |
| the isometric neon city | **the lane chart** | New `map.theme: 'chart'` painter beside the city one. |
| suppression of records | **suppression of cargo** | The Ring stops shipments, not filings. Same crime, physical goods. |
| evidence in transit | **manifests and cargo in transit** | |

## The color fiction

The one thing the data theme supplied for free and this one has to state. Chosen
model: **emitter phase polarity.**

Your two emitters run opposed phase — ⊕ and ⊖. Every interdictor is cast with a
phase lock, and the lock decides which emitter can collapse it.

| Color | Lock | Answer |
|---|---|---|
| **red** | unphased | either emitter |
| **blue** | locked ⊕ | the blue emitter only |
| **white** | locked ⊖ | the white emitter only |
| **purple** | superposed across both | **both emitters, docked** |
| **black** | a phase inverter | never touch — it inverts the emitter that strikes it |

Consequences to hold:

- **Polarity never flips.** Existing commitment, restated: the player is always
  the escort, and ⊕ is always blue. No level inverts the mapping.
- **UNITE-VOLLEY has a reason now.** Docking the emitters superposes the phases,
  which is *why* a docked pair answers purple and *why* the volley exists at all.
  The third verb stops being a control trick and becomes the fiction's own rule.
- **Black is self-inflicted.** A node killer does not shoot you. You break your
  own emitter on it. That is a better read of the existing punishment.

## What this branch does NOT touch

- Engine identifiers, spawn logic, the seeded `spawnRng`, the booked-arrival
  fairness ledger. Campaign determinism is untouched and `npm test` stays green.
- Difficulty numbers. Every `duration`, `spawnMin/Max`, `speed`, `doubles`,
  `heavies`, `lines`, `colors`, `frags`, `walls` value is carried over exactly.
  The sawtooth curve is tuned; retuning it is not part of a theme change.
- The control scheme, the power-up roster, the 100%-able rule, the business model.
- All audio. Every file, every mapping.

## Deliberately left on the old name

Not oversights — each is a record of something that already happened, or an
identifier with consequences.

| | Why |
|---|---|
| `capacitor.config.json` → `appId: com.datadefenders.game` | The permanent Play Store identity. `appName` was changed; the **appId was not**, because it cannot be changed after first publish and picking the replacement is the author's call. Nothing is published yet, so it is still free to change — decide it before the first store upload. |
| `docs/IDENTITY-SETUP.md` | Marked **SUPERSEDED (2026-07-25)** — those accounts were cancelled. It is a historical record of a flow that no longer exists, including the `com.datadefenders.game` bundle ID. Rewriting it would falsify the record. |
| `knowledge/README.md`, `knowledge/data-defenders-src.html` | A point-in-time snapshot from 2026-07-05. A stale snapshot retitled is still stale. |

## Not landed here, on purpose

`src/campaigns.js` carries the **shipped** story (Investigation → Going Deeper →
Signal Lost → The Bait → Shutdown). [SCREENPLAY.md](SCREENPLAY.md) holds a
*pending narrative rewrite* — Renke, Reyes, the wardens, the signature spine —
that was never applied to the engine.

**Both were themed; neither was swapped for the other.** Landing the narrative
rewrite inside a theme branch would have made this diff unreviewable, and the
two changes want separate review. The work order for the narrative rewrite is
still [SCREENPLAY-PLAN.md](SCREENPLAY-PLAN.md), now written in lane vocabulary.

## Owed art

Code and copy can carry the theme most of the way. These need the author.

1. **The badge.** Shield rim and warp bore both survive. The interlocked gold
   **DD** monogram does not. Spec in [BRAND.md](../BRAND.md) — a wolf mark over
   the bore, which reads at 48px where four letters would not.
2. **The full lockup** — `src/logo.png` relettered: WARP LANE large, VANGUARD
   SQUADRON beneath, *WOLV* between the two gold rules.
3. **Character plates.** `src/Characters/` holds seven; the cast survives the
   shift intact, so whether they need regenerating is a look question, not a
   story one.
