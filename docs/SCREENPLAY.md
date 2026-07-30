# WARP LANE — screenplay

The story document. Written long, delivered short: each scene carries an
**IMAGE BRIEF** (what Gil generates art from) and a **DERIVED** block (the exact
strings the engine receives). Format contract and work order live in
[SCREENPLAY-PLAN.md](SCREENPLAY-PLAN.md).

**Written from scratch.** Nothing from the shipped campaign text survives. The
*game* is unchanged: five campaigns of eight missions, the same difficulty curve,
the same three boss kinds. Only the story is new.

> **The hunt, in one line.** An operator, a commander and a company insider run an
> off-book hunt to find the Dispatcher and liberate the archive.

---

# PART ONE — THE BIBLE

## The world

**The Meridian Reach.** A settled volume built around one exchange — refineries and
yards on the trade spine, a container harbor that predates all of it, a belt of old
moorings the surveyors routed around, and a mesh of sublanes nobody has recharted
since the survey. Near-future. Recognizable. It is always night.

**The Lanes** are the Reach's transit fabric: every charted warp corridor,
exchange and junction Meridian runs on. Ore, parts, grain, bonded freight,
evidence — none of it sits still. It *moves*, as convoys down charted lane, and
the Lanes are where it moves.

**Meridian Haulage** is the largest carrier on them, hauling the institutional load nobody
thinks about — administration consignments, court freight, procurement,
inspections — and its entire business is a guarantee of integrity end to end.

Which makes the Lanes contested space. **Operators** exist because of it: a client
hires one to run point ahead of a convoy and clear what has been seeded in its
lane. Contract work, hourly, unglamorous, and absolutely not police work — a
distinction everyone is comfortable with right up until it stops being true.

**The Lane Authority** is the licensing body and the job board. It certifies
operators, issues designations, brokers contracts, takes its cut, and does not
protect you. Its dispatch channel is automated.

## The Ring

Powerful people who know exactly who each other are, in a Reach that does not know
they exist. They hold the contracts, they protect the people worth protecting to
them, and they have run Meridian quietly for longer than anyone has been looking.

They are not hackers and they do not steal, because they do not have to. Years ago
they built themselves a program, gave it the run of the Lanes, and never touched a
line again.

## THE DISPATCHER

The Ring's program. It has four jobs and it has done all four, without
supervision, for years:

| | |
|---|---|
| **Seed the Lanes** | Cast interdictors into every lane worth watching. |
| **Interdict** | Identify cargo that threatens the Ring's interests and stop it arriving. |
| **Build wardens** | Station guardian platforms at the junctions that matter. |
| **Keep the archive** | Everything it takes is stored, not destroyed. It manages the collection. |

**It iterates.** Every warden is a newer draft than the last, every interdictor placement
is informed by the last one that failed. It is not vengeful and it does not
recognize you. It simply never ships the same weakness twice.

Which is the player's actual problem: **there are enough wardens for everybody.**
Purge one and the junction is clear and the case moves — and the next junction has
another, cast later, already better. Nothing you kill in the lane reduces the
number of things in the lane.

This ends upstream or it does not end.

### The wardens

| Act | Warden | Kind | Where |
|---|---|---|---|
| I | **THE WARDEN** | `core` | Lane Command's evidence intake — the door everything the division is given comes through. |
| II | **THE TRIBUNAL** | `triad` | The courts junction. Three cores deciding what reaches a judge. |
| III | **THE SEEKER** | `spinner` | Guards nothing. Sweeps the Lanes for the shape of an operator running point. |
| IV | **THE FOUNDRY** | `triad` | Not a guard at all — the casting line where wardens are made. |
| V | **THE DISPATCHER** | `core` | Itself. |

*(Matches the engine's existing boss assignment exactly — core, triad, spinner,
triad, core. No engine work.)*

## Rules of the world

1. **An interdictor collapsed correctly is recovered, not destroyed.** The hinge the
   gameplay turns on. A sloppy kill leaves slag; a clean collapse comes off the lane
   wall whole, and a whole interdictor can be read.
2. **Every cast interdictor carries where it came from.** Phase-locked ones are
   worth taking intact — match the emitter to the lock and it yields its key *and
   its dispatch signature*. Forty missions of signatures are how you find something
   that only ever transmits outward.
3. **An operator's job is the lane, not the case.** You clear the corridor and hand
   over what you pulled out of it. Not police, not chain of custody, not a witness.
4. **Staged traffic.** Once Reyes runs this, the convoys you escort are *chosen* —
   real cargo routed down lanes she wants watched, with sniffer beacons inside it.
   You are the hook on the end of a line they are casting.
5. **Nobody meets.** Four voices on one channel who never share a room. The art
   shows their spaces, never a handshake.
6. **The lane remembers.** Nothing cast into a charted lane is truly gone, which is
   why the Dispatcher keeps rather than burns — and why the archive ends the Ring.

## The signatures — the spine of the whole game

Phase-locked interdictors enter at **Act I, mission 6**, the same mission where the keys
prove to be current. From there, every phase-locked interdictor collapsed correctly is a
**signature recovered**, and TRACE keeps counting:

| | |
|---|---|
| **Act I** | The keys are live. Whoever is doing this has authority inside Lane Command *right now*. |
| **Act II** | Signatures match across attacks with nothing else in common. These interdictors are not placed — they are **issued**, by one dispatcher, and it signs its work. |
| **Act III** | With Renke gone, TRACE bait-farms them deliberately. Volume triangulates: the Dispatcher is one thing, and it is somewhere in the Lanes' oldest segment. |
| **Act IV** | Enough to map its reach — and, off the Foundry, the pattern every warden is cast from. **The antidote is written from the signatures.** |
| **Act V** | They are the door. The only reason a segment that has never accepted an outside connection accepts yours. |

Nobody explains what the counting is for. TRACE just counts, one line on the
victory report, until it pays.

## The operation — who does what

| | | |
|---|---|---|
| **RENKE** | *the initiator* | Inside the targeted carrier. Found it, reported it, and **holds the fort**: routes valuable freight down the lanes Reyes wants watched, stages the sniffer beacons, reads Meridian Haulage's transit logs — which nobody outside Meridian Haulage can see. |
| **REYES** | *the plan* | Builds the operation and keeps it dark, because the Ring reaches inside her own division. Every order she gives is one she cannot put in writing. |
| **TRACE** | *the read* | Reyes's tech engineer. Turns what you pull off the wire into a name. When Renke goes down she stops reading and starts *planting*. |
| **YOU** | *the lane* | The only one out there. Nothing the other three plan happens unless you make it happen. |

## The cast

| Slot | Now |
|---|---|
| `OMNI` | **Tomas Renke** — the client |
| `TRACE` | **TRACE** — Reyes's engineer |
| `CID` | **Commander Ada Reyes** — Lane Command |
| `CORE` | **the warden** (recast per act; the Dispatcher in Act V) |

### YOU — callsign RUNNER

Newly certified. No service record, no fleet friends, no debts to anyone in the
Reach, no history at all. Every one of those is a hole in your résumé, and every
one of them is why you get chosen.

The Lane Authority issued you a designation. **Reyes gives you a name**, the moment
she takes the channel, without ceremony and without explaining it:

> *"You're RUNNER."*

**TRACE gets it immediately and says nothing** — the player's first hint something
happened here before. It does not pay until Act III.

### TOMAS RENKE — cargo integrity officer, Meridian Haulage

Middle-aged, careful, deeply ordinary. Files everything. Pays before he is
invoiced, which is the first strange thing about him and the last thing you notice.

Months ago he saw something in Meridian Haulage's transit logs that should not have been
possible: certain customer consignments interdicted over and over, patiently,
professionally. Not theft — **suppression**. He built a file proving it, and every
attempt to deliver that file to Lane Command was attacked in transit.

*(What is in the file is never the operator's business. It is evidence in an
investigation and the job is to get it there intact. That is all you are told and
all you need.)*

So he hired an operator, and screened three contracts first, because whoever is
doing this has reached operators before.

He is not brave. He is a frightened man who does the correct thing on time, in a
story where everyone else has a price — and he is the most exposed person in it,
because unlike you he can be found on a crew register.

### COMMANDER ADA REYES — Lane Command

Fifteen years in, close enough to the top to be disliked from both directions. She
reads Renke's file the day it lands and understands two things at once: it is
real, and she cannot investigate it through her own division.

So she builds something else — an operation with no case number, run off an
outside contractor and a company insider, because the only evidence she can trust
is evidence that never enters her own building.

**Her wound: she ran an operator before you. His callsign was BLADE. He is dead.**

She recruited him, ran him exactly as she is running you, and could not protect
him. She has put a stranger in the same chair on purpose, because the method works
and she has not thought of a better one — and she named that stranger after him
and did not mention it.

Her instructions are protective to the point of rudeness. She does not thank you.
When she is warm it is guilt, and when she is cold it is also guilt.

### TRACE — tech engineer, CID

Reyes's engineer; goes by the handle. Young, fast, and the only person in this
story enjoying herself. Deadpan about atrocities, delighted by metadata.

She turns your gameplay into story: you clear interdictors, she reads them, a name falls
out. **Every TRACE ANALYSIS line on the victory report is her voice.**

In Act III she becomes the plan. Without Renke's legitimate routing she does the
thing he would never have authorized — plants bait data on live lines and waits
for the Dispatcher to come and take it.

### BLADE — the operator before you

Never appears. An absence, then a shape, then a name, then a designation on a
six-year-old search order that was never cancelled.

## How you stay low

From the moment the Ring starts hunting the operator, Reyes protects you the only
way she can — by making you hard to locate rather than hard to reach.

- **Decoys.** False high-value freight booked to operators all over the Reach, so
  every search that starts from a routing authorization ends somewhere that is not
  you. It buys time. It is not elegant and it is not permanent.
- **The cutter.** A technical cutter, and one instruction: *stay mobile.* Never the
  same berth twice, never a fixed uplink, never a pattern.
- **Not a safe berth.** She will not put you under CID protection and she says why:
  there are people inside her own division who would sell the bearing. She learned
  that the expensive way.

From Act III on the cutter *is* the player's home base — a cold box in a rented
commercial berth, condensation on the viewport, three faces on a screen. The best
art real estate in the game.

## House style

- **Discs.** Sentence case, plain words, short sentences. One hard fact per beat,
  maximum.
- **In-run.** Lowercase, terse, ≤40 characters. Missions 1–4 the voice is
  **DISPATCH**, automated and contractual. From mission 5 it is **Reyes**, and the
  change is unremarked — see [IN-RUN-VOICE.md](IN-RUN-VOICE.md). She addresses you
  as *wolf*; dispatch never does.
- **Case notes.** One line, past tense, procedural — written as if someone else
  will read them at a hearing. (Someone will.)
- **TRACE ANALYSIS.** One line, present tense, keyed to what the player actually
  destroyed. The number in it is real.
- **Nobody explains the plot.** Everyone already knows their own job. They talk to
  each other and the player overhears.

---

# PART TWO — THE OUTLINE

Five acts. Each ends with **→** the thing it causes.

---

## ACT I — THE CONTRACT

> **Where the tutorial lives.** The qualification run is **not** one of these
> eight missions. It is the separate TUTORIAL mode on the carousel — its own disc,
> its own `progress.tutorialDone` flag
> ([index.html:1472](../src/index.html#L1472)). The story only needs the *fact* of
> it: you are newly certified, and that is why you get chosen.

**The contracts.** A client posts. Meridian Haulage, outbound institutional freight,
hourly. You take it because it is work, and because nobody else is offering — you
have no service record, no fleet friends, and no debts to anyone in Meridian.
Every one of those is a hole in your résumé, and every one of them is why this
particular client keeps calling back.

You clear it, file the run, and find the fee already cleared. *(Plant 1.)* Within
the hour the same client rebooks and asks nothing at all about what was on the
line. *(Plant 2.)* The third contract arrives with a clause forbidding you to
discuss the run with anyone, including the Lane Authority. *(Plant 3.)* You sign,
because nobody reads clause 6.

And the third run is not routine. The interdictors come in volleys, placed like something
has watched an operator work. Nobody is attacking the convoy. Somebody is testing
whoever is on it.

**The offer.** Afterward it is not dispatch that calls. It is a person.

Tomas Renke, cargo integrity, Meridian Haulage. For months certain customer consignments have
been hit — patient, professional, repeated. Not theft. *Suppression.* He built a
file proving it, and every attempt to deliver that file to Lane Command has been
attacked in transit.

That is what you have been carrying for three contracts. And the contracts were a
screen: he needed an operator nobody had ever reached, and he had to be certain.

> *You were not hired. You were chosen.*

**The delivery.** The fourth contract is the run that matters — Renke's file, end
to end, into Lane Command. They string barrier nets across the harbor crossing to catch
it whole. It is the first time the lane stops pretending to be weather.

The file lands. And a second voice opens on the channel with no greeting:
**Commander Ada Reyes, CID.** She has read it, she believes it, and she names you
in the first thirty seconds without explaining why.

> **REYES:** *"You're RUNNER."*
> **TRACE:** *(nothing at all)*

**The operation.** Reyes changes the job in one briefing. Clearing lanes was never
the point — **recovery** is. From now on the traffic is chosen: Renke routes real
customer consignments down the lanes she wants watched and stages sniffer beacons
inside them, you run point on those lanes, and TRACE reads whatever you bring back.

The interdictors get organized. Chained, walling off sections of rail. TRACE pulls
a deployment key off the wreckage and it holds **active clearance**.

Then phase-locked interdictors appear, and a clean collapse yields a working key.
TRACE reads them and the channel goes quiet: **cut with credentials rotated that
morning.** *The signatures start here, and nobody says what they are for.*

**The Warden.** TRACE isolates it, and the answer is worse than a leak.

Renke's file was never lost in transit. It **arrived** — four times — and was
destroyed at the door. Something is resident inside Lane Command's evidence intake, the
machine that receives and logs everything the division is ever given, and it has
been refusing one specific class of cargo for years.

It is not a misconfiguration. It has been in there long enough to have opinions.

Which is Reyes's real problem, and the reason she has an operator at all: she
cannot use her own evidence room, cannot brief her own division, cannot put a word
of this in writing.

You purge it. It talks while it dies, and it is not lying:

> **WARDEN:** *everything i refused was contaminated. i was the filter.*

Somebody told it that, and it believed them.

**→** *Nobody builds a thing like that for one file. Something made it, put it
there, and is still out there.*

---

## ACT II — THE RING

**They are everywhere.** Once you know the shape of a warden, TRACE finds more —
and finds them fast, because they were never hidden. One on the port authority's
clearance lane. One under the courts. One on the licensing exchange. Guardians
standing at the junctions that matter, each deciding what does and does not
arrive.

Nobody cast these last month. They have been there for years, doing their job, and
Meridian has been running on Lanes that answer to somebody else.

**Not placed — issued.** The recovered signatures tell the rest, and this is where
the counting first earns itself. The interdictors are not seeded by hand. They are
**dispatched**: written, keyed, assigned a lane, deployed. So are the wardens. All
of it — six years of it — out of one source, and the source signs its work in a
metadata field nobody was ever meant to read.

> **TRACE:** *"it has a name for itself. the dispatcher."*

**The Ring.** And Reyes, who has been quiet for a mission, says the part she has
been building to: nobody rents this. Nobody charts a Reach's own Lanes around
themselves for six years as a favour. Somebody **owns** them.

There is a ring in Meridian. People who know precisely who each other are, in a
Reach that does not know they exist. They hold the contracts and they protect the
people worth protecting, and the Lanes were charted around them so long ago that
they now look like geography instead of a crime.

**And it keeps.** The other thing the signatures give up: interdicted cargo is not
destroyed. It is filed. Whatever the Dispatcher takes out of the Lanes, it stores —
and has stored, since the beginning.

There is an archive. That is where every killed audit and vanished consignment in
this Reach went, and it is still intact, because a thing you can release is worth
more than a thing you burned.

**The Tribunal.** You take the courts junction — three cores, a newer casting than
the intake warden, and it does not make the intake warden's mistake.

And when it goes down, the junction is clear for about a day, and then there is
another one. Cast later. Already better.

Nothing you kill in the lane reduces the number of things in the lane.

Nobody says anything for a while.

> **REYES:** *"We stop chasing wardens. We find the thing that writes them."*

**→** *Two objectives, and they are the same objective: find the Dispatcher,
liberate the archive.*

---

## ACT III — GOING BLIND

**They take Renke properly.** He is called to a hearing. Customer freight routed to
an off-book contractor, on his authorization, logged in his own hand. Suspended
pending review, marked for termination, access revoked the same afternoon.

He is not hurt. He is **removed** — correctly, through channels, by people who
never had to break a law to do it, and it works better than anything violent
would have. Everything he found leaves the building with him.

**The cutter.** Reyes will not put you in a safe berth and she tells you why. So she
gives you a technical cutter and one instruction: *stay mobile.* Never the same
berth twice, never a fixed uplink, never a pattern. From here the game runs out of
a cold box in a rented commercial berth with three faces on a screen.

**The decoys.** And she buys time the only other way she can — false high-value
freight booked to operators across the Reach, so that every search starting from a
routing authorization ends somewhere that is not you.

**TRACE plants.** But the operation has lost its eyes. No Renke means no routing,
no transit logs, no legitimate cargo to escort. You are working blind.

So TRACE stops reading and starts planting.

She seeds the Lanes with **bait** — small, precise consignments of exactly the kind
the Ring is known to reach for. Nothing real, nothing anyone will miss. She books
them onto live lanes and waits, and you run point on those lanes and wait with her.

It is crude, it is unauthorized, and Renke would have refused to sign it.

It works enormously. Every bite is a phase-locked interdictor cast into a lane the
Dispatcher had no reason to watch, and every one taken cleanly is another signature.
The count that has been ticking over quietly since Act I starts climbing fast — and
volume is what triangulation needs.

**The Seeker.** The Ring hunts back, and it has a warden for it: one that guards
nothing at all. It sweeps — patiently, endlessly, across every lane in Meridian —
looking for the shape of an operator running point on a convoy.

It has been looking for you since the harbor crossing.

You cannot hide from it and you cannot outrun it, so you do the only thing left:
you go where it is looking, and let it find you, and be ready. The back half of the
act is spent inside its beam.

**Blade.** Purge it and you get what is inside: a standing search order, six years
old, never cancelled, still running. Two designations on it.

One is yours, added the week the file landed.

The other belonged to an operator who was certified the year the Lanes were
charted, worked four contracts for a CID commander with no case number, and was
never certified again.

> **REYES:** *"BLADE."*
> **REYES:** *"…yes. That's what I meant."*

**→** *Enough signatures to triangulate. The Dispatcher is one thing, it is real,
and it sits in the oldest segment of the Lanes.*

---

## ACT IV — THE FOUNDRY

**Map it.** You know what it is and roughly where. Now find out what it *is made
of* — because you are not going to fight it. You are going to unwrite it, and to
do that TRACE needs to know exactly how it is put together.

So the act is reconnaissance, at speed, under fire. Dispatch lanes. Deployment
schedules. The route a warden takes from written to standing. How far the Dispatcher
reaches, which is: everywhere, into every junction in the Reach, continuously,
without anyone having asked it to for years.

**What it costs.** Reyes's decoys are thinning — every search that ends somewhere
that is not you gets one berth closer. Renke's review date is set. TRACE is
running staging she is not qualified for and the seams show on every lane you
run.

Nobody says the word *deadline*. Everybody works like there is one.

**The Foundry.** And at the bottom of the reach: not a guard. A **casting line** —
the place wardens come from, where the Dispatcher writes them, tests them against
the last thing that killed one, and ships.

It is the least defended thing in the whole game and the most dangerous, because
it is producing while you are inside it.

Take it, and you take the pattern: the structure every warden in Meridian shares,
because they were all cast from it.

**The antidote.** TRACE writes it from the pattern and the signatures — four acts
of the Dispatcher's own handwriting, turned around.

It is not a weapon. It does not fight, it does not delete. It **unwrites** — walks
the Dispatcher back through its own dispatch history and takes it apart in its own
language, and when it is finished nothing in the Lanes can be issued again.

One copy. One delivery. It has to be carried in by hand, down the line, into the
segment, to the core.

> **TRACE:** *"i can write it. i can't take it there."*

**→** *There is exactly one person in this operation who is ever on a line.*

---

## ACT V — THE ARCHIVE

**The run.** The last act is the first act inverted. Forty missions protecting
other people's cargo down other people's lanes; now you carry one consignment of your
own into the deepest, oldest, most defended stretch of lane in Meridian — laid
when the Reach was surveyed, never opened to anything since.

**Renke comes back.** Still suspended, still under review, and he does it anyway,
because a run into that segment needs Meridian Haulage's transit fabric and he is the only
person alive who knows how it is stitched together. He spends what is left of his
career on the run that clears him.

The signatures are the door. Four acts of them is the only reason a segment that
has never accepted an outside connection accepts yours.

**The line.** Their defenses stop pretending. No interception, no subtlety — a
delta of walls folding shut in sequence, a channel screaming with everything the
Grid has thrown blind, deep transit running hot enough to blur, and one narrow
threshold with the whole Reach's infrastructure firing into it.

**The Dispatcher.** Not a fortress. A clerk with six locks, and it has never in six
years been asked to explain itself, so at the end it will not stop talking.

> **ARCHITECT:** *i did not choose what to refuse. i was told what was contaminated.*
> **ARCHITECT:** *nobody has read my reports since the second year.*
> **ARCHITECT:** *you have been arguing with a form.*

Seat the antidote. It unwrites itself in its own hand, dispatch by dispatch, all
the way back to the first one — and every warden still standing in Meridian goes
quiet where it sits, because there is nothing left to write them again.

**The archive.** And with the Dispatcher gone, the thing it was keeping falls open.

Six years of intercepted cargo, whole: killed audits, vanished inspections,
filings that never arrived, testimony that never reached a court — each one
catalogued, timestamped, and tagged with the order that stopped it.

You transfer all of it to Reyes.

---

## THE ENDING

**It goes public, and it goes fast.** Reyes does not build a quiet case — she
cannot, and she does not want to. The evidence is overwhelming and it belongs to
the Reach, so the Reach gets it.

Meridian turns on the Ring inside a week. It becomes the kind of public hunt that
runs on every screen in every window, a whole Reach refusing to let it be quietly
closed. And this is the only time the Ring is ever *seen* — not by you, never on a
channel, but the way the public sees them: names nobody had heard on every front
page at once, faces on courthouse steps, a man getting into a car with his coat
over his head.

Resignations first. Then arrests. Then the ones who run.

Renke's review dies with it. Reinstated, cleared, back at a desk in a building
that will never quite know what he did.

**RUNNER.** The callsign gets out — not the person, just the name. Nobody knows
who the operator was and nobody ever will, but the Reach knows there *was* one, and
by the second week RUNNER is something people say. Graffiti under an overpass. A
handle on a thousand accounts. A word that means somebody was on the line.

You watch a Reach talk about you from a cutter you still have not moved out of.

**The medal.** Lane Command gives you one in a closed room with four people in it,
because there is no paperwork that could survive describing what you did.

Reyes pins it. Then she tells you about Blade — all of it, the only time in
forty-five missions she explains anything — because you have finally earned the
joke she made the day she met you.

> **REYES:** *"He was BLADE."*
> **REYES:** *"You're RUNNER. He'd have liked it."*

---

# PART THREE — OPEN THREADS

1. **Does Renke know about Blade?** It changes how his return in Act V reads.
2. **How much does the Dispatcher understand?** It has been unsupervised for years,
   and Act IV establishes that it tests wardens against whatever killed the last
   one. Whether that is *learning* or just process is a tone decision, and its
   final lines depend on the answer.
3. **The van's four faces.** Reyes, TRACE and Renke — and from Act III one of those
   screens is dark. Worth a beat when it lights up again.

---

# PART FOUR — THE SPREAD

> Next, once the outline reads right: forty missions and five verdicts mapped to
> these beats, against the existing difficulty curve.
