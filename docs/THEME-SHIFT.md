# Theme shift — DARK FIBER → VANGUARD SQUADRON

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
2. **`CID` survives as an acronym.** Cyber Investigations Department becomes
   **Convoy Integrity Division**. Same three letters, same institutional
   register, same role — the authority that receives evidence and cannot trust
   its own building. 71 occurrences in source need no edit.
3. **The engine's nouns were already spatial.** `bore`, `tunnel`, `ring`,
   `relay`, `rail`, `node`, `arc` — every one of them reads *better* in a warp
   lane than in a cable. The identifiers do not move.

## What survives verbatim

Not translated. Already correct.

| | Why it works unchanged |
|---|---|
| **OmniServe** | "The largest carrier on it, hosting the load nobody thinks about." Change what it carries from records to freight and every word of the existing description holds. |
| **Meridian** | Reads as a system as naturally as a city. Now the **Meridian Reach** — the settled volume the lane network serves. |
| **The Ring** | People who run a place quietly and never touch a line themselves. Setting-agnostic. And the name now doubles: a ring of powerful holdings around the core systems. |
| **THE ARCHITECT** | A program with four jobs, iterating, never shipping the same weakness twice. Nothing about it is data-specific. |
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
| operator | **runner** | Already the player's callsign. Now also the trade. |
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

## Owed art

Code and copy can carry the theme most of the way. These need the author.

1. **The badge.** Shield rim and warp bore both survive. The interlocked gold
   **DD** monogram does not. Spec in [BRAND.md](../BRAND.md) — a wolf mark over
   the bore, which reads at 48px where four letters would not.
2. **The full lockup** — `src/logo.png` relettered: WARP LANE large, VANGUARD
   SQUADRON beneath, *WLVS* between the two gold rules.
3. **Character plates.** `src/Characters/` holds seven; the cast survives the
   shift intact, so whether they need regenerating is a look question, not a
   story one.
