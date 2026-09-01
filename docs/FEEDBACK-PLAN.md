# FEEDBACK — the plan

> ## BUILT — 2026-09-01, branch `feedback-channel`
>
> **Option A** was chosen and built: the segment carries **MY DATA · FEEDBACK**,
> and the gear is the CLOSE. `npm test` passes, with 27 new pins. 0 of 41 board
> sim ids moved, so no leaderboard is affected.
>
> **Not yet deployed.** `supabase db push` and
> `supabase functions deploy send-feedback --use-api` are both still owed; until
> they run, the panel works and every note goes to the outbox. See
> `docs/CHANGELOG.md` → *Unreleased*.
>
> ### The panel is a DISC (Gil, 2026-09-01, after the first build)
>
> §4.5 below says the panel is built from `drawReport` and `drawMyData` — a
> chamfered console slab. **That is now wrong.** Gil's call: it wears the same
> plate the pause disc, SYSTEM CONFIG and the high-score card wear, because a
> rectangle in the middle of those reads as a dialog borrowed from another
> program. What changed:
>
> - `discPlate` + `discSlab` + `discSegKeys`, at the high-score disc's radius
>   (`discR() * 0.86`), cast in by the ring through `popRender`.
> - **`discSegKeys` learned a one-key form.** Pass one key and it is the whole
>   segment, undivided — the shape the contract disc's TAKE CONTRACT key used to
>   hand-roll. It carries `half: 0`, and `discSegHit` reads that as "no seam".
>   The topic and result steps use it for CLOSE; the write step keeps the two
>   halves for BACK and SEND.
> - **The two facts moved outside the rim**, one on each flank: *SENT WITH* on the
>   left, *WE CANNOT REPLY* on the right. They are facts about the disc, not
>   content in it, and the circle keeps its own space. Drawn after `popRender`,
>   because the cast is clipped to the disc's box.
> - **The disc gives up radius before the flanks give up words.** `R` is solved so
>   each side note always keeps a 96px column; on a screen too narrow for both,
>   the circle shrinks instead.
> - **The field is a whole number of lines**, never a share of the radius. The
>   textarea is 13px on every screen, so a box sized as `R * something` lands
>   mid-line — a half-drawn sentence under a clean border reads as a bug.
> - **The field waits for the cast to land** (`q > 0.92`), like the high-score
>   disc's handle field. A static plate carries the draft until then, in the same
>   face and leading, so the swap moves nothing on screen.
> - The scrim went from 0.72 to 0.93. The flanks stand on the bare menu rather
>   than on a plate, and the menu under them is two lit cards.
>
> ### The second pass on the disc (Gil, 2026-09-01)
>
> - **The title wraps and drops.** `discPlate` sets a title on one line at the
>   crown, where the chord is barely wider than a word — fine for PAUSED, and not
>   fine for TOO HARD OR TOO EASY, which overran the plate on both sides. This disc
>   draws its own (`fbTitle`): one line stays exactly where `discPlate` would put
>   it, and a title that does not fit breaks in two **and moves down** into the
>   wider part of the circle rather than climbing further into the crown.
> - **The field takes the room.** It starts as high as the title allows and runs
>   down to the last whole line that clears the segment — six lines on a 844×390
>   phone, up from three. The top is capped at `0.52R` even when there is more room,
>   because the chord narrows toward the crown: past that point every line gained
>   costs more width than it is worth.
> - **§3.7 is amended: there IS an address now.** *GET IN TOUCH* replaces *WE
>   CANNOT REPLY* on the right flank. The pipe is still one-way and still carries no
>   reply address, so the legal basis does not move — the panel says nothing comes
>   back, then hands over ours. `FEEDBACK_EMAIL` in `92-guide.js`; **swap it for the
>   dedicated address when it exists**, and `npm test` fails if it is ever set to
>   something that only looks like an address.
> - **The address is tap-to-copy.** Text painted on a canvas cannot be selected, so
>   without this a player has to retype it off the screen by hand. It is set in a
>   text face, not Audiowide, whose `@` draws as a filled ring and made the address
>   read as two words with a dot between them.
> - **The typing warning moved to the floor**, centred under the disc. It is about
>   what the player types, so it belongs where the eye lands after the field.
>
> ### The third pass: the title keeps its distance (Gil, 2026-09-01)
>
> Gil, on the first wrapped title: *"the T and the R are literally touching the
> edges."* They were, and the arithmetic said otherwise. Two reasons, both fixed:
>
> - **A line of caps is widest ABOVE its baseline.** The budget was measured AT the
>   baseline, which is the one place on the line where no glyph is — the letters
>   rise about 0.73em and up there the circle has already closed in. Every budget
>   is taken at the glyph's top now.
> - **A letter is not a slab.** A key clears the rim by `DISC_PAD` and looks right,
>   because a key has its own drawn edge and the eye reads the gap between two
>   edges. A glyph has no edge, so the same gap reads as a collision. The title
>   keeps `FB_TITLE_PAD`, double a row's margin.
> - **And it does not ride the crown.** `discPlate` puts a title there because its
>   titles are words like PAUSED; these are phrases, and the crown is the narrowest
>   line on the circle. Every title on this disc sits at `FB_TITLE_Y` (0.66R), where
>   the margin can be kept without shrinking the type to buy it. The lede hangs off
>   the title's own bottom rather than a fixed height, so it follows.
> - **The two lines are BALANCED, not filled.** Greedy wrapping puts the long half
>   on the first line, which on a circle is the line with the least room — 'TOO HARD
>   OR' over 'TOO EASY', which only fit by shrinking. The split that minimises the
>   worst overshoot puts OR on the second line, where the chord is wider: **TOO
>   HARD / OR TOO EASY**, at full size. Same idea as `text-wrap: balance`, with the
>   twist that the two lines do not have the same room as each other.
>
> ### The address
>
> Gil, 2026-09-01: ship the existing address for now, a dedicated one before
> launch. `FEEDBACK_EMAIL` in `92-guide.js` is that one constant, and the swap is
> on the release checklist in `docs/RELEASE-PLAN.md` §2.
>
> ### THE PAYLOAD IS FOUR FIELDS (Gil, 2026-09-01) — read this before §3.2
>
> §3.2 below lists eight. **The shipped payload is `build`, `device`, `screen`,
> `place`.** Gil's rule: keep what helps fix bugs, and take nothing that costs a
> permission, a licence or a new declaration.
>
> **Nothing here costs any of those.** Reading a device model through the browser's
> Client Hints needs no manifest permission, no runtime prompt, no entitlement, and
> is not one of Apple's Required Reason APIs. What it costs is documentation —
> `privacy.html`, `delete-data.html`, `MODERATION.md` and `PLAY-CONSOLE-ANSWERS.md`
> all name it, and the Data Safety form still gains exactly one row: *Other
> user-generated content*, optional.
>
> **Dropped, and staying dropped:** `lang`, which says nothing about a bug, and
> `sim_id`, a hash of our own source the version already reports to a human.
>
> **The model is not an identifier**, and that distinction is load-bearing: a name
> millions of devices share, read once, never used to recognise anybody. Deriving a
> persistent id from device signals is fingerprinting, which both stores forbid.
> `npm test` pins that the string stays a coarse label.
>
> **iOS gives the family, not the model.** WKWebView has no Client Hints, so an
> iPhone reads `iPhone · iOS 17.4`. `@capacitor/device` (MIT, no permission) would
> close the gap at the cost of a native rebuild — offered, not taken.
>
> `npm test` pins the shape: the context object's keys must be exactly
> `build,device,place,screen`. A payload grows one convenient field at a time, and
> that pin is the door.
>
> ### The flank named what the note carried, so the note had to carry it (superseded above)
>
> Gil asked for the left flank to read **version no.** and **device model** rather
> than *your build* and *your device*. The first was already true. The second was
> not — §3.2 below sends `'web' | 'android' | 'ios'`, which is a platform.
>
> A label that promises something the payload does not carry is the worst kind of
> wrong in a privacy disclosure, so the payload moved to match the words. The
> `platform` column is **`device`** now — nothing is deployed, so the rename is
> free — and it holds a model.
>
> - **Chrome's UA reduction killed the old trick.** The model used to sit in the
>   user-agent string; it is frozen to `K` on modern Android, in the browser and in
>   the Capacitor WebView alike. It comes from **User Agent Client Hints** now,
>   which is Chromium-only and async — asked once at boot, cached, with the coarse
>   family (`iPhone · iOS 17.4`) as the fallback everywhere else.
> - **No plugin was added.** `@capacitor/device` gives a cleaner answer and costs a
>   native rebuild; Client Hints costs nothing.
> - **It is not an identifier**, and four documents say so in the same words: a
>   model is a name millions of devices share, read once, never used to recognise
>   anybody. *Device or other IDs* stays unticked on the Play form, with the
>   reasoning written beside it.
> - **To reverse it**, `fbDevice()` in `31-leaderboard.js` is one function — return
>   the Capacitor platform alone and the flank goes back to saying *platform*.
>
> ### What differs from the plan below
>
> - **`window.__APP_VERSION`** is new. `BUILD` tells two builds apart but names
>   neither, so `scripts/build.js` now stamps `package.json`'s version into
>   `dist/index.html` beside the sim id. `index.html` is outside the sim hash, so
>   this moves no board id.
> - **`purge_old_feedback()`** is new. §3.5 promised 90 days and a 12-month cap as
>   prose; it is a function in the migration now, so the promise has an
>   implementation instead of a reminder.
> - **`supabase/schema.sql`'s copy of `delete_my_runs` was re-synced.** It was
>   already a migration behind — it never got the filed-reports delete from
>   2026-08-26 — and adding a third divergence on top was not defensible.
> - **The portal gained a `new feedback` tile**, hot when the queue is not empty.
>   Counted in `scripts/portal.js` rather than added to the `admin_overview` view,
>   to avoid a fourth copy of that view.
> - **The test harness's DOM stub was too thin.** `document.createElement` returned
>   a canvas shape with no `addEventListener` and there was no `document.body`, so
>   no test could ever mount a text field. Both are fixed.
> - **`docs/LEADERBOARDS-SETUP.md` was left alone.** It is the historical
>   how-to-create-the-project guide, not an operations doc; the live deploy
>   instructions belong in `docs/MODERATION.md` and `docs/CHANGELOG.md`, and both
>   have them.
>
> Everything else below shipped as written.

---

A player writes a short note inside the game. It lands in a Supabase table. Gil
reads it in the admin console beside the report queue.

Nothing here is a chat. There is no reply channel, no email field, and no thread.
One note goes one way, and the panel says so out loud.

---

## 1. What the player does

1. The player opens SETTINGS from the gear on the menu.
2. The player taps **FEEDBACK** in the disc's bottom segment, beside MY DATA.
3. A panel asks what the note is about. Four keys: **A BUG**, **AN IDEA**,
   **TOO HARD / TOO EASY**, **SOMETHING ELSE**.
4. A text field opens. The player types up to 600 characters.
5. The player taps **SEND**. The panel says `SENT — THANK YOU`, or it says the
   note is held for the next connection.
6. The player taps CLOSE.

The panel never shows another player's words. Feedback is private to Gil.

---

## 2. The one decision Gil must settle

`discSegKeys` in [91-briefing.js:1850](src/game/91-briefing.js#L1850) splits the
disc's bottom segment into exactly **two** halves. Line
[1859](src/game/91-briefing.js#L1859) reads `side = i === 0 ? -1 : 1`, and
`discSegHit` at [1841](src/game/91-briefing.js#L1841) tests one vertical cut.
The segment holds MY DATA and CLOSE today
([95-menu.js:687](src/game/95-menu.js#L687)). FEEDBACK is a third key, and there
is no room for it.

### Option A — MY DATA · FEEDBACK, and the gear becomes the CLOSE (RECOMMENDED)

Both halves become doors. CLOSE leaves the segment. The gear key in the corner
toggles the panel shut, exactly as the pause key in the corner resumes a run.

Why this one:

- The file's own comment says `SYSTEM CONFIG IS THE PAUSE DISC. Same plate, same
  rows, same bottom segment.` The pause disc's segment is RESTART · QUIT and it
  carries no CLOSE. The settings disc is the odd one out today. This removes an
  inconsistency instead of adding one.
- The two keys stay full width, so no type shrinks.
- Three ways out remain: the gear, a tap outside the disc
  ([60-input.js:406](src/game/60-input.js#L406)), and gamepad B
  ([71-gamepad.js:91](src/game/71-gamepad.js#L91)).

Cost: a visible CLOSE key disappears. That is the part Gil must approve.

### Option B — a three-way segment

`discSegKeys` and `discSegPath` grow an N-key form. Measured text width per key,
computed from the real constants:

| Viewport | Base type | Two keys | Three keys, outer | Three keys, middle |
| --- | --- | --- | --- | --- |
| 1180×820 tablet | 27px | 169px | 98px | 142px |
| 932×430 phone | 15px | 97px | 56px | 81px |
| 844×390 phone | 14px | 88px | 51px | 74px |
| 568×320 small phone | 11px | 72px | **42px** | 60px |

`MY DATA` in Audiowide 700 does not fit 42px above the 8px floor that `fitPx`
enforces. Lowering the chord to `segK 0.36` only reaches 50px, and it fattens the
disc's bottom until it no longer matches the pause disc. Option B is legal and it
is ugly on a small phone.

### Option C — CLOSE stays, FEEDBACK becomes a fourth disc row

`discRows` at [91-briefing.js:1811](src/game/91-briefing.js#L1811) already carries
two row types. A third one, a door row, is idiomatic here. But the key then sits
above the segment, not beside MY DATA, which is not what Gil asked for.

**I will build Option A unless Gil says otherwise.**

---

## 3. The nine issues, and the answer to each

### 3.1 Typing on a canvas, in landscape, with a keyboard

The game paints a canvas through a 90° transform. A DOM overlay already solves
text entry: `overlayInput` at [00-core.js:114](src/game/00-core.js#L114) mounts one
positioned `<input>` in a layer whose coordinates are game space. MY DATA's rename
step uses it ([92-guide.js:1004](src/game/92-guide.js#L1004)).

Three changes:

- **`overlayInput` gains `opts.multiline`.** It builds a `<textarea>` instead of an
  `<input>`, with the same CSS plus `padding:8px 12px;resize:none;line-height:1.4`.
- **Enter does not send.** The `keydown` handler must skip `onEnter` when
  `multiline` is set, or the player cannot start a second line.
- **The field sits in the panel's upper half.** An Android keyboard eats about half
  a landscape screen. `resize()` freezes the canvas geometry while a field is up
  ([00-core.js:53](src/game/00-core.js#L53)), so the game keeps its pre-keyboard
  box and the keyboard covers the bottom of it.

Android opens a full-screen extract editor for a landscape `<textarea>`. That is
help, not a problem. The value returns through the same `onInput` callback.

**The trap MY DATA already hit:** a field left mounted keeps the keyboard up over
the next step. [92-guide.js:977](src/game/92-guide.js#L977) drops it on leaving the
rename step. The feedback panel needs the same guard, and a test pin for it.

### 3.2 What is sent besides the words

A bug report with no build id is not actionable. The note carries:

| Field | Source | Why |
| --- | --- | --- |
| `text` | the field, ≤ 600 chars | the note |
| `topic` | the four keys | routes the queue |
| `build` | `BUILD` ([00-core.js:140](src/game/00-core.js#L140)) + app version | which code ran |
| `sim_id` | `window.__SIM_ID` | which rules ran |
| `platform` | `web` / `android` / `ios` | half of all bugs are one platform |
| `screen` | `W×H` | layout bugs |
| `place` | the last STAGE played, as a display name | where the bug was |
| `lang` | `navigator.language` | which words they read |

`place` goes through `lvNum(levelNo(ci, li))`, per the house law in CLAUDE.md.
The stored string is a STAGE name such as `cargo-run 07`, never a bare index.

**No player id in the body.** The server takes it from the JWT `sub` claim, the
same law `my-data` and `report-run` follow
([31-leaderboard.js:260](src/game/31-leaderboard.js#L260)). A tampered body can
only ever address the identity it already holds.

The panel states this in one line before the SEND key.

### 3.3 Spam, abuse, and length

- **Length:** 600 characters, capped on the client by `maxLength` and rejected by
  the server above 600. Control characters are stripped.
- **Rate:** one note per 10 minutes and five per rolling 24 hours, counted from
  the `feedback` table by `player_id`. Over the bar, the function answers `ok`
  and drops the row. The player is never told the bar, exactly as `report_run`
  never publishes its threshold.
- **Abuse aimed at Gil:** possible, and it is the price. The text is private, so
  it needs no word filter — nothing here is shown to another player. The admin
  console gets a **Delete** button per note.
- **No filter, deliberately.** A word list on a private channel only silences a
  frustrated bug report that used a rude word.

### 3.4 Offline

The game is a PWA and is played offline. A note that vanishes because the phone
was in a tunnel is worse than no button.

**A one-slot outbox.** On a failed send the note is written to
`progress.fbOut = { text, topic, ctx, at }` and the panel says
`HELD — IT WILL SEND WHEN YOU ARE ONLINE`. `flushFeedback()` runs when the menu
opens and a session exists. It clears the slot on success. It drops the slot
after 7 days, because a note that arrives out of its build's context is noise.

One slot only. A queue invites a player to fill it, and the second note is nearly
always the first note again.

### 3.5 Privacy, the legal basis, and disclosure

The settled position is **legitimate interest, never consent**
(docs/privacy.html, "Why we are allowed to hold it"). Running and fixing the game
is the interest. Feedback fits it, and nothing here is a new purpose.

Edits:

- **docs/privacy.html** — a subsection under "What is sent to our server, and why"
  naming every field in the table above, the retention rule, and the deletion
  promise. A line under "Your controls" saying MY DATA delete takes feedback too.
- **docs/PRIVACY-POLICY.md** — the same promise, in the summary list.
- **docs/PLAY-CONSOLE-ANSWERS.md** — the Data Safety form gains one collected
  type: free-text user content, optional, not shared, deletable.
- **The panel itself** — `Do not include your name, an email, or anything
  private. We cannot reply.` This is the disclosure that matters, because it is
  the only one a player reads.

**Retention:** a note is kept until Gil marks it handled, then 90 days, then it is
deleted. A hard cap of 12 months on everything. One scheduled SQL delete, or a
manual sweep. The admin console shows the age.

### 3.6 Deletion

MY DATA delete must take feedback. The precedent is
`supabase/migrations/20260826000000_delete_takes_filed_reports.sql`: *a deleted
player leaves no reporter id behind.*

A new migration adds one line to `delete_my_runs`:

```sql
delete from public.feedback where player_id = p_player;
```

**Deleted, not anonymized.** Nulling the id would keep the note, and the note is
free text a player may have typed their own name into. One promise is better than
a clever one. The MY DATA confirm copy gains the words `and any feedback you
sent`.

### 3.7 No reply

An anonymous identity has no address. The panel says so before the send, and the
`SENT` screen says so again. Anyone who wants an answer has the contact address in
docs/privacy.html.

**An optional email field is deliberately deferred.** It would be personal data
collected on consent, which is a second legal basis, a second retention rule, a
second deletion path, and a mailbox Gil must answer. It is a version 2 decision.

### 3.8 Where Gil reads it

The admin console at `npm run admin`, port 8014. It already holds the service key
in the Node process and never puts it in the browser
([admin.js:59](scripts/admin.js#L59)).

- A `feedback_queue` view, in the shape of `report_queue`: open notes first,
  handled folded, newest first.
- `readAll()` at [admin.js:62](scripts/admin.js#L62) gains one `get()`.
- `scripts/admin.html` gains a FEEDBACK tab: topic chip, age, build, platform,
  place, and the words. Two buttons, **Handled** and **Delete**.
- `RPC` at [admin.js:88](scripts/admin.js#L88) gains
  `feedbackHandled → mark_feedback_handled`. The `act()` guard at
  [admin.js:96](scripts/admin.js#L96) tests a uuid already.
- The portal at `npm run portal` gains an open-notes count.

Nothing pushes a notification, exactly as with reports. docs/MODERATION.md gains a
section saying so.

### 3.9 The word on the key

**FEEDBACK** on the disc key. **SEND FEEDBACK** as the panel title. The code, the
table and the function all say `feedback`. One word, one meaning, per the house
law.

---

## 4. The build

### 4.1 Database — `supabase/migrations/2026090100000_feedback.sql`

```
public.feedback
  id           uuid primary key default gen_random_uuid()
  player_id    text not null           -- from the JWT, never the body
  topic        text not null default 'other'
  body         text not null           -- ≤ 600 chars, checked
  build        text
  sim_id       text
  platform     text
  screen       text
  place        text
  lang         text
  created_at   timestamptz not null default now()
  handled_at   timestamptz
```

- RLS on, **no policies**. No client role reads or writes it. The Edge Function
  writes with the service role and Gil reads it. Same law as `reports`.
- `create index feedback_open on public.feedback (created_at desc) where handled_at is null;`
- `file_feedback(p_player, p_topic, p_body, p_meta jsonb)` — service role only,
  `revoke execute ... from public, anon, authenticated`. It enforces the rate bar
  inside the function, so the bar cannot be skipped by a second caller.
- `mark_feedback_handled(p_id uuid)` — service role only.
- `feedback_queue` view, `security_invoker = true`, revoked from client roles.

### 4.2 Edge Function — `supabase/functions/send-feedback/index.ts`

A near-copy of `report-run` ([supabase/functions/report-run/index.ts](supabase/functions/report-run/index.ts)):
same CORS block, same `jwtSub`, same "the answer is always the same" rule.

```
client → POST { topic, text, meta } with the player's auth JWT
       → verify JWT → player id → file_feedback
       → { ok: true }, every time
```

It answers `ok` for a dropped rate-limited note as well, because telling a player
their note was refused invites them to send it four more times.

Deploy: `supabase functions deploy send-feedback --use-api`.

### 4.3 Client network — `src/game/31-leaderboard.js`

`lbFeedback(topic, text, meta)`, in the shape of `lbReport`
([31-leaderboard.js:308](src/game/31-leaderboard.js#L308)): `lbSession()` for the
token, `lbFetch` with the 10s deadline, `lbFail` for the split between the console
line and the human line, and `{ ok, human }` out.

### 4.4 State — `src/game/40-state.js`

Beside `report` at [40-state.js:458](src/game/40-state.js#L458):

```js
let feedback = null;   // { step, topic, busy, done, msg, bad }
let feedbackBtns = [];
let feedbackDraft = '';
function openFeedback() { ... }
function closeFeedback() { feedback = null; feedbackDraft = ''; clearField(); }
```

Steps: `topic` → `write` → `done`.

### 4.5 The panel — `src/game/92-guide.js`

`drawFeedback()`, built from `drawReport()` and `drawMyData()`. It reuses `mdKey`
([92-guide.js:957](src/game/92-guide.js#L957)) and `popRender`, and it registers
the pop key `'feedback'` — `POPFX` is open-ended
([91-briefing.js:1486](src/game/91-briefing.js#L1486)).

Drop the DOM field on every step that is not `write`, per 3.1.

Dispatch beside the other two at
[92-guide.js:875](src/game/92-guide.js#L875), and `menuPopUp()` at
[92-guide.js:896](src/game/92-guide.js#L896) gains `feedback` and
`popLive('feedback')`.

### 4.6 The disc key — `src/game/95-menu.js`

[95-menu.js:687](src/game/95-menu.js#L687) becomes:

```js
[['MY DATA', 'mydata'], ['FEEDBACK', 'feedback']]
```

The gear branch at [60-input.js:420](src/game/60-input.js#L420) toggles rather
than sets: `menuSettings = !menuSettings`.

### 4.7 Input — `src/game/60-input.js`

- [line 123](src/game/60-input.js#L123): add `feedback` to the overlay test.
- Before the `report` branch at [line 351](src/game/60-input.js#L351): a
  `feedback` branch that owns every tap, with no tap-outside dismiss. A stray tap
  must not throw away a half-typed note.
- [line 399](src/game/60-input.js#L399): `if (b.action === 'feedback') { pressUI(b, () => openFeedback()); return; }`
- [line 630](src/game/60-input.js#L630): `if (feedback) closeFeedback();` on a run
  start, beside the other two.

### 4.8 Gamepad — `src/game/71-gamepad.js`

Nine guards name `myData`. Every one takes `feedback` as well: lines
[49](src/game/71-gamepad.js#L49), [91](src/game/71-gamepad.js#L91),
[122](src/game/71-gamepad.js#L122), [208](src/game/71-gamepad.js#L208),
[247](src/game/71-gamepad.js#L247), [251](src/game/71-gamepad.js#L251),
[335](src/game/71-gamepad.js#L335), [344](src/game/71-gamepad.js#L344),
[481](src/game/71-gamepad.js#L481). Line 122 returns the focus list, so it gains
`feedbackBtns`.

### 4.9 The outbox — `src/game/31-leaderboard.js` and `src/game/32-save.js`

`progress.fbOut` is one slot. `flushFeedback()` runs on the menu open. It clears
on success and drops the slot after 7 days.

### 4.10 Docs

docs/privacy.html, docs/PRIVACY-POLICY.md, docs/PLAY-CONSOLE-ANSWERS.md,
docs/MODERATION.md, docs/LEADERBOARDS-SETUP.md, docs/CHANGELOG.md.

### 4.11 Tests — `scripts/test.js`

A section, **FEEDBACK: ONE NOTE, ONE WAY**:

1. The settings segment carries exactly two keys, and they are `mydata` and
   `feedback`, both with `seg.half`.
2. Tapping FEEDBACK opens the panel, and the panel is drawn above SETTINGS.
3. SEND is locked while the note is empty, and unlocked at one character.
4. A 601-character note is cut to 600 before it leaves.
5. Leaving the `write` step drops the DOM field.
6. Starting a run closes the panel.
7. A failed send fills `progress.fbOut`, and a later flush empties it.
8. `place` is a STAGE display name, never a bare index. This is the house law's
   own trap, and it is why the pin exists.
9. Every drawn string in the panel says STAGE, never LEVEL or RELAY.

---

## 5. The order of work

1. Migration, applied with `supabase db push`.
2. Edge Function, deployed with `--use-api`.
3. `lbFeedback` and the outbox.
4. State, panel, disc key.
5. Input and gamepad.
6. Tests, then `npm test`.
7. Docs.
8. Admin console and portal.

The standing rule is to deploy the verifier and push the database **before** any
build. This change does not touch the verifier. It does add a table, so the push
comes first. **I will ask Gil before running either deploy.**

---

## 6. What this plan does not build

- An email field, or any reply. See 3.7.
- A RATE THIS GAME store link. It is a separate, smaller job, and it belongs on
  the win screen rather than in settings.
- A screenshot attachment. It needs Storage, a bucket policy, a size cap and a
  moderation story, and almost no player sends one.
- In-game display of anyone's feedback.
- A push notification when a note arrives. Reports do not have one either.

---

## 7. Size

About 500 lines of new code across 11 files, one migration, and one Edge
Function. The panel and the Edge Function are near-copies of code that already
works, so most of the risk sits in two places: the `<textarea>` behaviour on a
real Android phone in landscape, and the CLOSE key decision in section 2.
