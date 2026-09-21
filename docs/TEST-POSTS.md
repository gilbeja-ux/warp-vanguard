# Open-test posts

Rewritten 2026-09-18, comparison allowed 2026-09-19. **Genre, per Gil: it is
not an arcade shooter.** It is a rhythm-action game — the family of Guitar
Hero, Beat Saber, osu!, the "note highway" shape — with a literal twist: the lane is a ring around the player, so the brain has to
retranslate movement. Light strategy sits on top (when to dock for the volley,
when to spend a pulse). The pitch is coordination, instinct and flow under
pressure. The word "rhythm" is earned: `beatQuantize` in `11-music.js` snaps
arrivals to the detected beat of the track, and `51-linter.js` lays patterns on
it. Never write "shooter". Naming another game as a comparison is fine (it is
nominative use, and the sub is full of "Galaga-style" posts); one name, once,
in the body, as an anchor and not as a claim of likeness in art or content. The game is in **open testing** on Google Play: the store
link installs for anyone, and testers' feedback in Play stays private. The job
of every post below is feedback that tightens the game before launch, not a
tester count.

**The roster, from `GUIDE_ITEMS` and `INFO_CARDS` (the only source):** red
interdictor (any emitter), purple armored interdictor (both docked together),
blue / white phase-locked (the matching emitter), linked interdictors / barrier
net (one emitter on each end), the pulse-charger ribbon, dead zones, power-ups,
and the UNITE VOLLEY (dock both and hold; a bolt fires and detonates). There is
no black enemy. `docs/STORE-LISTING.md` line 61 still describes one and its
captions still say RELAYS; `docs/testers.html` still says *Closed test*, asks
for a Gmail, and says *relay* twice. All of that is read by the people these
posts send, so it is owed before the first post goes up.

---

## 1. What scored on r/AndroidGaming (evidence, 2026-04 → 2026-09)

Pulled from the Arctic Shift archive of the sub: 100 DEV-flaired posts from the
last two weeks plus 100 "testers" posts from the last year. Bodies read in full
for the top eleven.

| Post | Score | Comments | Shape |
|---|---|---|---|
| Nine Crowns of Faenord released | 105 | 39 | launch, image |
| Heroic Legends Reborn, a 2011 MMO brought back | 53 | 26 | launch, video, a personal story first |
| Solo Dev, First Game: Frolf Fest | 40 | 19 | launch, **gallery of screenshots**, "solo dev, first game" in the title |
| Astro Burn cute-'em-up launched | 21 | 8 | launch, video, "no microtransactions or ads" |
| Looking for Android testers: cozy cat logic puzzle | 12 | 24 | a what-I-need list; the dev answered every comment within the hour |
| No forced ads, solo dev, small and smooth | 12 | 12 | launch, video, four lines |
| Driving game, honest feedback before launch | 4 | 12 | video, the best what-I-need list on the sub |
| Cozy walking game, no ads, no timers | 3 | 8 | video, a story about the dev's twins |

What the winners share, and the losers lack:

1. **`[DEV]` in the title.** The automod removes without it (rule 7A) and
   removes a post with no Play Store link (rule 4B).
2. **A human first line.** "Solo dev here", "my brother and I", "when I was in
   school". The score tracks the story, not the feature list.
3. **"No ads" in the first hundred words**, every time, usually in the title.
4. **One media item, native.** A gallery of screenshots scored 40; a video 53.
   A text post with an imgur link scored 12.
5. **Short.** The 40-point post is 260 words. Nothing over 400 scored.
6. **The ask is three or four questions, and it says honesty beats politeness.**
   "Tearing it apart is more helpful to me than being nice."
7. **The thread is the post.** The cat-puzzle post scored on the dev's replies.
8. **Feedback posts score lower than launch posts** (3 to 12 against 20 to 100)
   but draw more comments per upvote. That is the trade an open test wants.

**r/playmygame is dead for votes.** All 100 of its most recent posts sit at
score 1 with one automod comment. Post there for the backlink only, if at all.

---

## 2. The post — r/AndroidGaming

Flair: DEV. Media: the seven store screenshots from `docs/store/` as a gallery,
`01-bore` first; swap in the 15-second clip when it exists. Post on a weekday
afternoon and stay in the thread six hours. One post in this sub; the
*"it's live"* post at launch is the second and last.

**The link**, with the tag the Play Console acquisition report reads:

```
https://play.google.com/store/apps/details?id=com.warpvanguard.game&referrer=utm_source%3Dreddit-androidgaming%26utm_medium%3Dpost%26utm_campaign%3Dopentest
```

**Title** (the first is the winning shape)

> [DEV] Solo dev, first game — Warp Vanguard, a rhythm-action game with a literal twist: the lane is a ring. Free, no ads, in open testing and I need it torn apart before launch

> [DEV] Beat Saber's shape, for two thumbs on a phone, with the lane twisted into a ring around you. Free, no ads, open test — tell me where you stopped

**Body**

> Solo dev here. Warp Vanguard is a rhythm-action game for two thumbs,
> landscape, on a phone. You know the shape from Beat Saber or Guitar Hero:
> things come down a lane at you, on the beat, and you have to be on each one at
> the instant it crosses. The twist is literal. The lane is a ring around you. Nothing comes down a column; it
> comes out of the dark at any bearing, and each thumb rides one emitter around
> the ring to meet it. For the first few minutes your brain keeps translating
> "up" and "left" into ring angles. Then it stops translating and your thumbs
> just go, and that state, hands ahead of thought under pressure, is the whole
> game.
>
> Red takes either thumb, blue and white want their own, purple wants both
> docked on it together. Dead centre pays double, a streak builds a combo, one
> miss breaks it. There's no aiming and no fire button. The only decisions are
> when to dock both thumbs and hold, which fires one bolt down the lane and
> costs you every other angle for half a second, and when to spend the pulses
> you've banked. I still don't know if the dock reads in the first minute.
> That's what I need you for.
>
> Five contracts of eight stages, a different boss machine at the end of each,
> an endless mode, and a weekly lane that's the same seeded run for everyone.
> Free, no ads, nothing to buy in the test. Plays offline; only the leaderboards
> need a connection.
>
> It's in open testing, so this installs for anyone on Android:
> [link]
>
> Launch is a few weeks out, and this is the window where what you tell me
> actually changes the game. What helps most:
>
> - Where did you stop, and why? Bored, stuck, or broken. The honest one.
> - What was confusing in the first two minutes?
> - What felt unfair, as opposed to hard?
> - Your phone model, if anything stuttered, overheated or looked cut off.
>
> There's a feedback button in the game under settings that sends me the phone
> and the stage with your note, or just reply here. Tearing it apart is more
> useful to me than being nice about it.
>
> If you want to see the five bosses without the hours in between: message me
> and I'll send the passcode that jumps straight to any of them.

**Why each part is there:** the first line is the Frolf and Box Arrow opener;
"rhythm-action" names the family and the one comparison in the body anchors
it in a second; "the lane is a ring" is the twist in five words; the "your brain keeps translating" sentence
is Gil's pitch (coordination, instinct, flow) said the way a player would say
it; the "I still don't know if the dock reads" line is the Highway Chaos honesty that
drew twelve comments; "this is the window where what you tell me changes the
game" gives a stranger a reason to write more than "nice"; the four questions
are the tester guide's own, cut to four; the passcode line is a reason to reply
that no other post on the sub has.

---

## 3. Short variants, same link with its own tag

Change `utm_source` per venue: `toucharcade`, `discord`, `reddit-indiedev`,
`itch`, `il-devs`.

**TouchArcade, Upcoming Games.** Paragraphs one to four of the post, the
gallery inline, the four questions, and a promise to post each build's changes
in the thread. No `[DEV]` tag; say "I'm the developer" in line one. Forum
readers stay for weeks, so the thread is where every build's changelog goes.

**Discord, any server that allows it (ask a mod first).**

> Hi all, solo dev here. Warp Vanguard is a two-thumb rhythm-action game for
> Android, the Beat Saber shape with a literal twist: the lane is a ring around
> you, things come out of the dark at any bearing on the beat, and each thumb rides one emitter round
> the ring to meet them. Docking both fires the one big shot. Five contracts of eight stages, five bosses,
> endless, a weekly seeded lane. Free, no ads, nothing to buy. It's in open
> testing and launch is a few weeks out, so the one thing I want to know is
> where you stopped and why. [link]

**r/IndieDev (devs, not players).** Title: *"A rhythm game where the lane is a
ring around the player. Does the brain retranslate, or does it bounce off?"* Body: paragraph two of the post, the
gallery, the link, and two questions: did the dock read as a move or as a bug
the first time, and did the drill before the stage that needs it stick.

**Hebrew, for Israeli dev groups.**

> היי, אני מפתח סולו, וזה המשחק הראשון שלי: Warp Vanguard, משחק ריתמוס-אקשן
> לשני אגודלים, לרוחב, לאנדרואיד. הצורה של Beat Saber, עם טוויסט מילולי: המסלול
> הוא טבעת סביבכם.
> דברים מגיעים מהחושך מכל כיוון, על הביט, וכל אגודל מזיז פולט אחד על הטבעת כדי
> לפגוש אותם בצבע הנכון בדיוק ברגע שהם חוצים. בדקות הראשונות המוח מתרגם "למעלה"
> ו"שמאלה" לזוויות. אחר כך הוא מפסיק לתרגם והאגודלים פשוט הולכים, וזה כל המשחק.
> סגול מת רק כששני האגודלים נצמדים עליו יחד, וההצמדה הזאת היא גם הירייה הגדולה.
> אין כיוון ואין כפתור ירי. חמישה חוזים של שמונה שלבים, חמישה בוסים, מצב אינסופי, ומסלול שבועי זהה
> לכולם. חינם, בלי פרסומות, בלי רכישות.
>
> המשחק בבדיקה פתוחה בגוגל פליי, אז הקישור מתקין לכולם: [link]
> ההשקה בעוד כמה שבועות, וזה החלון שבו מה שתגידו לי באמת משנה את המשחק. הדבר
> הכי שימושי: איפה הפסקתם לשחק, ולמה. יש כפתור משוב בתוך המשחק בהגדרות.

**A friend, one at a time.**

> Hey [name]. The game's in open testing on Google Play and launch is a few
> weeks out. This is the window where feedback still changes it, so I'd rather
> hear it from you than from a stranger. Install: [link]. Then tell me where you
> stopped and why. "Got bored on stage 3" is the most useful sentence you can
> send me. There's a feedback button in the game under settings, or just
> message me.

---

## 4. Replies in the thread

The cat-puzzle thread scored on the dev's replies, not on the post. Answer every
comment inside the hour for the first six hours. Change a word each time.

- **Any feedback:** *Thanks. "[their sentence]" is exactly what I need. Which phone?*
- **A bug:** *Got it. If it happens again, the feedback button under settings sends me the stage and the phone automatically. Will post here when it's fixed.*
- **Too hard at stage N:** *That's the one I'm watching. Two straight losses on a stage should offer LANE ASSIST at the end screen. Did it show?*
- **Purple won't die:** *Both thumbs on the same bearing, hold half a second. It's the whole game and I'm still learning how to teach it. Where did you look for the answer first?*
- **A fix shipped:** *Fixed in 1.0.x, on the test track now: [one line]. Thanks for the report.*
- **"Not available in your country":** *Which country? The test should be open everywhere; if it isn't, that's on my side and I'll fix the listing.*
- **iOS?** *Built and waiting on an Apple developer account. Android first.*
- **Money?** *All free in the test. After launch the first contract stays free and the rest is a one-time unlock. No ads, no consumables, nothing that moves a score.*
