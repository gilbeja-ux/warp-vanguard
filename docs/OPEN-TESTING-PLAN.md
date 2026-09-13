# Open testing plan — recruit, listen, ship

Written 2026-09-13, on the day 1.0.8 was cut. This is the plan for the test
period between now and production. It covers four questions: who tests and where
they come from, how feedback is collected and worked, how long the test runs and
what the update cadence is, and when the game goes live.

The test is also the first marketing test. Every channel gets its own tagged
link, every tester gets asked the same three questions, and the answers set the
launch pitch and the 1.1 price.

---

## 0. Starting position (verified 2026-09-13)

| Fact | Value | Source |
|---|---|---|
| Build | 1.0.8, versionCode 10008 | `package.json`, CHANGELOG |
| Store URL | `play.google.com/store/apps/details?id=com.warpvanguard.game` answers 404 from outside Play | fetched 2026-09-13; consistent with a closed test, which has no public listing |
| Opt-in URL | `play.google.com/apps/testing/com.warpvanguard.game` | `docs/testers.html` |
| Tester guide | `https://gilbeja-ux.github.io/warp-vanguard/testers.html` — says *Closed test*, asks for the 14-day hold | live, 200 |
| Feedback form | Google Form, 7 questions, none required: *Is it fun?* (YES! / yes? / Not really), phone, where you stopped, what confused you, what felt unfair, stutter/overheat/wrong, anything else | linked from the tester guide |
| In-game feedback | SETTINGS → FEEDBACK disc: A BUG / AN IDEA / TOO HARD OR TOO EASY / SOMETHING ELSE, 600 chars, carries build + device model + place + screen, and the last SYSTEM FAULT with its ten-step trail. Lands in Supabase, counted on the portal's *new feedback* tile. One-way; the flank prints `hello@gb-il.cloud` | `docs/FEEDBACK-PLAN.md`, `92-guide.js` |
| Server telemetry | `runs` rows (a loss files too since 1.0.8), `ladder_reach`, `player_growth`, `board_occupancy` views | `docs/MODERATION.md` |
| Play's rule | Personal accounts created after 2023-11-13: **12 testers opted in continuously for 14 days** before applying for production; Google also looks at whether they used the app; the application asks three things (how you recruited and engaged testers; audience, value, expected installs; what you changed from feedback); review usually ≤ 7 days | Play Console Help 14151465 |
| Feedback log | `docs/USER-FEEDBACK.md`, F-001…F-005, statuses OPEN → DECIDED → BUILT → DONE | repo |

Two things this plan does **not** decide, because the Console decides them:
whether production access is already granted (if it is, skip Phase 1), and
whether the current track is closed or open (the 404 says closed; check the
Console's *Testing* page).

---

## 1. Calendar

Three phases, about nine weeks, go-live in mid-November.

| Phase | Dates | Track | Purpose | Builds |
|---|---|---|---|---|
| **1 · Closed test** | 2026-09-14 → 2026-10-04 (3 weeks) | Closed | Satisfy the 12 / 14 rule with people who will actually stay. Find the crashes and the first-two-minutes confusion. | 1.0.8 now; 1.0.9 on 2026-09-28 |
| **Apply** | 2026-10-05 | — | Production-access application, answered from the feedback log. | — |
| **2 · Open test** | 2026-10-12 → 2026-11-08 (4 weeks) | Open | Public listing, strangers, volume. Measure the funnel, the pitch, the channels. Ask the price question. | 1.0.10 on 2026-10-12 (the open-test build), 1.0.11 on 2026-10-26 |
| **Freeze** | 2026-11-02 | Open | Release candidate = 1.0.11 + hotfixes only. One quiet week. | 1.0.12 only if a crash forces it |
| **3 · Go live** | 2026-11-10 (Tuesday) | Production | Staged rollout 20 % → 50 % → 100 % over ten days. | the frozen RC, unchanged |
| **1.1** | January 2027 | Production | Paywall at the stage-09 seam, priced from the open-test answers and December's retention. | 1.1.0 |

Why these lengths:

- **Closed, three weeks, not two.** The 14-day clock runs per tester from their
  opt-in, not from the first install, and the last tester to join starts it
  again. Recruit in the first four days; the clock then clears for everyone by
  day 18; three days of slack.
- **Open, four weeks.** Two builds is the minimum to *show* a change made from
  feedback, and the application and the Reddit threads both want that story.
  Longer than four weeks and the game is being polished, not tested.
- **Freeze a week.** The build that goes to production is the build that ran the
  last week of open testing. Nothing ships to production that a stranger has not
  already run for seven days.
- **Tuesday go-live.** A Tuesday puts the 20 % stage on weekdays when Gil is at
  the desk and a crash can be met with a hotfix before the weekend traffic.
- **Not December.** Play review slows in the second half of December and the
  1.1 billing build should not be the one that meets that queue.

Production access does not force a launch. Apply as soon as the 14 days clear;
the open track keeps running in parallel.

---

## 2. Recruiting — who, where, and in which phase

### 2.1 Three kinds of tester

| Tier | Who | What they are for | How many | Where |
|---|---|---|---|---|
| **A · The warm circle** | friends, family, colleagues, the GB-IL network, Israeli dev communities | Satisfy the 12 / 14 rule. They stay installed because they were asked to. Weak signal on fun, strong on *first two minutes* because they are not arcade players. | 20–25 opted in, to end with 12+ who actually opened it | direct message, one at a time, with the tester-guide link |
| **B · Genre players** | people who already play twin-stick / bullet-hell / rhythm-timing arcade games on a phone | The real signal: is it fun, is stage 02 too steep, is the boss a puzzle or a wall, would they pay. | 100–500 installs in the open phase | Reddit, TouchArcade, Discord, itch.io — §2.3 |
| **C · Tester swaps** | strangers who install your app so you install theirs | Count only. Google now checks engagement, so a swap tester who never opens the app can hurt the application. | 0 by preference; at most 5 to close a gap | r/AndroidClosedTesting and similar, never a paid farm |

**Do not buy testers.** A paid "12 testers, 14 days" service produces a cohort
that installs once and never opens the app. The 2026 review checks usage, and
the application asks how you recruited; a bought cohort fails both.

### 2.2 Phase 1 — the closed test is the warm circle

Closed testing has no public listing and every tester must be added by Gmail
address, so a Reddit post in this phase is friction for strangers and a broken
link for anyone not yet added. Keep Reddit for Phase 2.

1. Write one message, send it individually, never as a group blast. The tester
   guide already says the important things; the message adds the one favour:
   *stay opted in for two weeks*.
2. Ask each person for the Gmail their Play Store uses before sending the link.
   The guide says why. Most support requests in a closed test are the wrong
   account.
3. Keep a roster (name, Gmail, opt-in date, phone model, day-3 form sent,
   day-14 form sent). The application's first question is answered from it.
4. On day 3 and day 14, send the Google Form. Day 3 is *first impressions*;
   day 14 is *did you come back, and where did you stop*.
5. Between, do not nag. The in-game disc is where a bug goes the moment it
   happens; the form is the scheduled survey; the roster is the count.

### 2.3 Phase 2 — the open test is where the strangers come from

Open testing has a public store page, one link works for everyone, and testers
leave **private** feedback in Play, not public ratings. That is the safest
possible moment to put the game in front of strangers: a bad first week does
not stick to the store rating.

**r/AndroidGaming — yes, with conditions.** It is the largest Android-only
player community, and it is a *player* sub, tired of "I need 12 testers" posts.
The rules were not fetched from here (Reddit blocks the fetch); read the
sidebar the day before posting. What is consistently true of the sub and of the
gaming subs generally: developers must flair and disclose, one post per game,
no bare links, and a post that is a request gets removed or ignored while a post
that *shows* the game gets installs. So:

- **Lead with 15 seconds of the volley or the boss**, vertical, captured on a
  phone, no menu, no splash. Text over the clip: two thumbs, one lane.
- **Title names the hook, not the ask.** *"Two thumbs, one ring: I made a
  landscape arcade game where docking both thumbs fires the only shot that
  kills purple. Open test on Play, free, no ads."* Not *"Looking for testers"*.
- **Body: three lines** — what it is, what is free (all of it, no ads, no IAP),
  one link, one question (*"Where did you stop, and why?"*). Comments feed the
  ranking; a question is how you get them.
- **Reply to every comment within the hour** for the first six hours, and post
  the fix in the same thread when it ships (*"stage 02 doubles are later now,
  1.0.11"*). That public follow-through is the marketing.
- **One post per sub, ever, per phase.** A second post in the same sub is spam
  and reads as such. The *"it's live"* post in November is the second post.

**The rest of the map, in order of expected signal:**

| Where | Why | Note |
|---|---|---|
| **r/playmygame** | exists for exactly this; feedback-per-post norms | small, but every reply is a real tester |
| **r/IndieDev, r/indiegames** | dev peers; sharp on onboarding and readability | flair rules; devs, not the target audience |
| **TouchArcade forums → Upcoming Games / beta threads** | the one forum where mobile arcade players still gather and *write* | slow, long-lived; a thread keeps producing for weeks |
| **Discord: r/AndroidGaming's server, indie mobile dev servers** | fast conversation; testers who will answer a follow-up question | ask before posting a link |
| **itch.io** | a web page for the game with the Play link; the dev-log community tests things | an HTML5 build could live here too — §2.5 |
| **r/iosgaming** | not now; no iOS build can leave the Mac until the Apple enrolment exists | Phase 2 of the release plan |
| **Israeli dev communities (GameIS and the like)** | the warm circle's second ring; good for Phase 1 count | Hebrew post, same clip |
| **r/AndroidClosedTesting and swap subs** | count only, Phase 1 only, last resort | see Tier C |

### 2.4 Measure the channel, not the feeling

Every link that leaves the desk carries a UTM referrer, one per channel. Play
Console's acquisition report breaks store-page visitors and installers down by
UTM source, so a Reddit post and a TouchArcade thread are compared as numbers.

```
https://play.google.com/store/apps/details?id=com.warpvanguard.game&referrer=utm_source%3Dreddit%26utm_medium%3Dpost%26utm_campaign%3Dopentest
https://play.google.com/store/apps/details?id=com.warpvanguard.game&referrer=utm_source%3Dtoucharcade%26utm_medium%3Dthread%26utm_campaign%3Dopentest
https://play.google.com/store/apps/details?id=com.warpvanguard.game&referrer=utm_source%3Dtesters-page%26utm_medium%3Dweb%26utm_campaign%3Dopentest
```

The number that matters per channel is **installers ÷ store-page visitors**.
That ratio is the store listing's grade, not the channel's. A channel with many
visitors and few installers says the *listing* lost them — icon, first
screenshot, short description — and that is a change to make during open
testing, while nothing is on the record.

### 2.5 Option: a play-in-browser link

The game is HTML5 and `dist/` is a complete web build. A phone-browser link on
the itch.io page or the tester guide lets a Reddit reader play in five seconds
without an install, and that is the highest-converting thing an arcade game can
offer. Cost: a place to host `dist/` (GitHub Pages under `/play` is free), a
one-line "install it from Play for the real thing" bar, and the risk that a
desktop visitor judges a two-thumb game with a mouse. Worth doing for Phase 2
if it costs a day; not worth a week.

---

## 3. Collecting feedback — every channel, one log

### 3.1 The channels and what each is for

| Channel | Kind | When | Carries | Lands |
|---|---|---|---|---|
| **In-game FEEDBACK disc** | reactive, one note | the moment something happens | topic, 600 chars, build, device model, place, screen, last fault + trail | Supabase → portal *new feedback* tile |
| **Google Form** | scheduled survey | day 3 and day 14 for closed testers; once, at day 7, for open testers | fun / phone / where stopped / confusing / unfair / performance / anything | Forms sheet |
| **Reddit / forum threads** | public conversation | the week after each post | reactions, comparisons, screenshots | the thread; copy the useful line into the log |
| **Play Console** | quantitative | daily | installs, uninstalls, ANR + native crash, pre-launch report, testers' private feedback (open track) | Console |
| **Supabase views** | quantitative | weekly | `ladder_reach` (how far players get), `player_growth` (new identities/week), `runs` losses (which stage kills) | portal |
| **Email** | fallback | any | whatever the player writes | inbox |

The in-game disc is the primary channel and the only one that carries context;
the form is the one that asks the same question of everyone; the threads are
where strangers say what they would never type into a form. Nothing new is
needed. The gap is not a channel, it is a *ritual*.

### 3.2 The form — five changes

The form matches the tester guide's questions, which is right. Change five
things before Phase 2:

1. **Make *Is it fun?* required.** It is the one number; an unanswered form
   should not exist.
2. **Add *How far did you get?*** — multiple choice: `01–02`, `03–05`,
   `06–07`, `08 (the boss)`, `beat the boss`, `contract 2 or beyond`. The
   server only sees players who opened the board; the form sees everyone.
3. **Add the price question.** *"Contract 1 is free. Would you pay $2.99 once
   to unlock contracts 2–5 and the weekly ladder?"* — `Yes` / `Maybe, if…`
   (short answer) / `No`. This is the one fact the 1.1 build is waiting on,
   and the open test is the only place to ask a stranger before it exists.
4. **Add *How did you find it?*** — `Reddit`, `a friend`, `TouchArcade`,
   `Discord`, `other`. The UTM report measures clicks; this measures memory,
   and the two disagree in useful ways.
5. **Add an optional contact** — *"Reddit handle or email, if I may ask a
   follow-up"*. Optional, stated as such; a tester who reaches the boss and
   says *unfair* is worth one reply.

Keep it under two minutes. Seven to ten questions, not more.

### 3.3 The weekly ritual (Mondays, 45 minutes)

1. **Portal first.** Read every new feedback note. Each one becomes either a
   line in `docs/USER-FEEDBACK.md` under OPEN, or nothing. A note with a
   SYSTEM FAULT attached is a P1 and skips the queue.
2. **Form sheet.** Tally *Is it fun?*, *how far*, *would you pay*. Three numbers
   on one line in the log, with the date.
3. **Views.** `ladder_reach` and the losses by stage. Where the losses pile up
   is the stage to look at; where the reach stops is the stage to fix.
4. **Threads.** Read the week's Reddit and forum replies; copy the useful ones
   in with the source.
5. **Decide.** Each OPEN item gets DECIDED or a reason it stays open. The
   decided ones go on the next build. Anything decided is answered publicly
   where it was raised.

The log already has the right shape (F-001…F-005, status ladder, version
noted at DONE). The production-access application's third question — *what did
you change from testing feedback* — is a copy of the DONE section.

### 3.4 What to watch, and the numbers that say "not yet"

| Signal | Where | Go-live threshold |
|---|---|---|
| Faults | FEEDBACK notes with a SYSTEM FAULT attached | zero on the RC for seven days |
| Native crashes / ANR | Play Console | crash-free sessions ≥ 99.5 % on the RC |
| Fun | form, *Is it fun?* | ≥ 70 % `YES!`, ≤ 10 % `Not really`, on ≥ 30 answers |
| Stage-02 cliff | losses by stage, form *how far* | stage 02 is not the modal stop; F-001 said it was |
| Reach | form *how far* + `ladder_reach` | ≥ 25 % of testers reach stage 08 |
| Would pay | form | recorded, not gated; it prices 1.1 |
| Store listing | Console acquisition, per UTM | installers ÷ visitors ≥ 25 % on the Reddit link |
| Uninstalls | Console, test track | no single day where uninstalls exceed installs after week 1 |

These are floors, not targets. A floor not met blocks the go-live date and moves
it by one build, not by a month.

---

## 4. Update schedule

### 4.1 During the test

- **Cadence: one scheduled build every two weeks**, dated in §1. Testers
  update silently through Play; a build does not reset any tester's 14-day
  clock.
- **Hotfix rule: a crash gets a build within 48 hours**, out of cadence. A
  SYSTEM FAULT note, a Console crash cluster, or a fault a tester describes
  twice is a crash.
- **Nothing else out of cadence.** A balance change waits for the scheduled
  build so that the build has a changelog worth a Reddit reply.
- **Before every build, in this order** (the standing rules, no exceptions):
  `supabase functions deploy` for the verifier and `supabase db push`;
  `npm test`; `npm run test:smoke`; `npm run aab`, which also compiles the iOS
  shell. Bump the version only through `scripts/sync-version.js`.
- **Changelog per build in `docs/CHANGELOG.md`**, in player words, and a
  three-line version of it as the Play release note. The release note is read
  by testers who never read Reddit; write it for them.
- **Freeze from 2026-11-02.** The RC takes hotfixes only. A hotfix on the RC
  restarts the seven-day fault-free clock in §3.4.

### 4.2 After go-live

| Window | Cadence | Content |
|---|---|---|
| Weeks 1–4 | every two weeks, hotfix in 48 h | what the first strangers report; the rollout goes 20 → 50 → 100 across weeks 1–2 |
| Months 2–3 | monthly | tuning, the tablet layout if the data asks for it, small content |
| January 2027 | 1.1 | the paywall at the stage-09 seam, priced from the open-test answers and the December reach numbers, gated inside `startLevel` |
| After 1.1 | monthly, then as needed | cloud save per `CLOUD-SAVE-PLAN.md`, iOS when the enrolment exists |

---

## 5. Go-live

### 5.1 The gate

All of these, or the date moves one build:

- [ ] Every §3.4 floor met on the RC.
- [ ] `docs/USER-FEEDBACK.md` has no OPEN item marked P1.
- [ ] The Data Safety form matches the RC byte for byte (`PLAY-CONSOLE-ANSWERS.md`), including the *Other user-generated content* row for feedback notes.
- [ ] The privacy policy and delete-data page are live at their stable URLs (both answer 200 today).
- [ ] The verifier deployed for the RC's sim id, and the migration pushed.
- [ ] The tester guide's *Closed test* heading and the boss-shortcut paragraph are updated: the shortcut ships behind a passcode, the page said it would be removed.
- [ ] The store listing's screenshots show the RC's art (the boss, the volley, the disc), and the short description is the one that won the UTM comparison.
- [ ] The Reddit and forum threads each have a final reply with the fix list.

### 5.2 The rollout

1. **Promote the RC** from the open track to production. Do not rebuild.
   Open-test installs become production installs automatically; they keep the
   game.
2. **20 % for three days.** Watch crashes and the feedback tile daily.
3. **50 % for three days.** Same watch.
4. **100 %.** Post *"it's live"* in the same threads, once each, with the
   change list since the test build. Thank the closed testers by name in the
   tester guide if they agree.
5. **Week 2:** the first production ratings arrive. Reply to every review in
   the first month; on Play a reply moves the rating more than a fix does.

### 5.3 What go-live does not wait for

- iOS. The enrolment is a separate decision; the shell is one archive from
  upload whenever it lands.
- The paywall. Production ships all-free; 1.1 prices it.
- Cloud save. Scoped, not built, per its own plan.
- A tablet layout. The guide already lists it as known.

---

## 6. The three application answers, drafted

Google asks these when applying for production access. Draft them in week two
of the closed test, from the roster and the log, and paste them in on 2026-10-05.

1. **How did you recruit testers and how did they engage?** — *N testers
   recruited individually from my personal and professional network and from
   the Israeli game-development community, each given a tester guide
   (`testers.html`), surveyed on day 3 and day 14 through a form, and able to
   file bugs from inside the game. K of N reached stage 08; M filed feedback.*
2. **Who is it for, what is its value, how many installs do you expect?** —
   *Phone players of arcade and twin-stick games who want a skill game with no
   ads and nothing to buy that moves the score. Free contract of eight stages
   with a boss; four more contracts and a weekly ladder. Expected first-year
   installs in the low thousands, organic.*
3. **What did you change from feedback, and why is it ready?** — the DONE
   section of `docs/USER-FEEDBACK.md`, one line each: F-001 stage 02 restaged
   to one new threat per lane, F-002 LANE ASSIST, F-003 the volley pays,
   F-004 the offer slot, F-005 the controller focus ring, plus whatever
   1.0.9 carries.
