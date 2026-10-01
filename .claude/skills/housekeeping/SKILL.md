---
name: housekeeping
description: Work the audit backlog in docs/HOUSEKEEPING.md one item at a time. On trigger, offer the open items in priority order, then explain the chosen one and walk it to a picked solution. Use when Gil says "housekeeping", "/housekeeping", "next backlog item", "let's clear a finding", or wants to pick an audit item to solve.
---

# Housekeeping

Drive the backlog in [docs/HOUSEKEEPING.md](../../../docs/HOUSEKEEPING.md). Each run
takes ONE item from raw finding to a solution the user picked, then records it.

The backlog is the source of truth. Read it fresh every run. Never work from memory
of it, because the statuses change between runs.

## The flow — four steps, in order

### Step 1 — Offer the open items, ordered by importance
1. Read `docs/HOUSEKEEPING.md`.
2. Collect every item whose status is NOT `DONE`. Keep them in ID order, because
   ID order IS priority order (H-01 highest).
3. Print the open items as a short text list first: `ID · Sev · Title`, highest
   first, so the user sees the whole field.
4. Then call `AskUserQuestion` with the FOUR highest-priority open items as the
   options (header "Backlog item"). Put the highest-priority one first. Each option
   label is the ID + a short title; each description is the one-line issue and its
   severity. The user can always pick "Other" to name any H-ID further down.
5. If a run is already `IN PROGRESS`, list it first and ask whether to resume it or
   start a new one. If every item is `DONE`, say so and stop.

Ask nothing else in this step. One question, one purpose: which item.

### Step 2 — Explain the chosen item
After the user picks, write a SHORT briefing in prose, no more than one screen:
- **What it is:** the item's Issue, in plain terms.
- **Where:** the file:line evidence from the item.
- **My take:** the item's "My take", stated as your own recommendation.
Do not ask a question yet. This step is read-only explanation.

### Step 3 — Ask which solution to take
Call `AskUserQuestion` (header "Approach") with the item's `Options` as the
selectable answers, in the file's order, the recommended one first with
"(Recommended)" on its label. If two options fit distinct scopes, say so in each
description. The user's "Other" answer is a free-form direction — honor it.

### Step 4 — Solve and record
1. Set the item's status to `IN PROGRESS` in `docs/HOUSEKEEPING.md` (edit the row in
   the status board AND the item's Status line).
2. Do the work the chosen solution names. Obey every repo rule:
   - A change that moves a score moves sim ids. Batch sim-id-moving items and note
     that `npm run deploy:verifier` must ship with them (see H-01, H-02).
   - Never restart the dev servers (8000, the labs on 8010–8016, 8100, 8200) for a source edit.
   - Never run repo-wide git (stash/reset/checkout); other agents share this repo.
   - Keep `npm test` green.
3. When it lands, set the item to `DONE`, add the version and a one-line result.
   If it is blocked, set `BLOCKED` and name the blocker.
4. Report what changed in one paragraph, then offer to start the next item.

## Rules

- One item per run, unless the user asks to batch related items (some items say
  "batch with H-xx" — surface that in Step 2 and offer to pull the sibling too).
- Never invent items. Everything comes from the file. If the user names a problem
  not in the file, add it as a new `H-NN` row first, then work it.
- Never renumber IDs. Priority changes by reordering, not renaming.
- A decision-only item (e.g. H-19) has no code in Step 4. Record the decision in
  the file and in memory, then stop.
- Keep the explanation in Step 2 tight. The user picked the item to solve it, not
  to re-read the whole audit.
