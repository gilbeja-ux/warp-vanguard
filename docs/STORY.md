# WARP VANGUARD — Full Story Script

Every narrative string in the game, in the order a player reads it.
Edit here for review, then port changes into `src/index.html`:

| Text | Where it appears in game | Source in `src/index.html` |
|---|---|---|
| CASE FILE logs | Briefing card on DEPLOY (typewriter) | `INVESTIGATION.levels[].story` |
| Level hint | Under the level title during boot | `INVESTIGATION.levels[].hint` |
| Comms | In-level ticker with holo-portraits | `INVESTIGATION.levels[].comms` |
| Case note | Victory report screen | `INVESTIGATION.levels[].caseNote` |

All narrative now lives in ONE campaign package object (`const INVESTIGATION`,
~line 660) — the same format the Tunnel Designer will export.

Speakers: **HAUL** = Meridian Haulage (corporate, blue) · **CMD** = Cyber
Investigations Dept (white) · **TRACE** = Lane Command's tracer analyst (green) ·
**CORE** = the Command Gateway warden core (purple).

Premise: Meridian Haulage must deliver critical evidence to Lane Command across one
warp lane. The player runs point ahead of the convoy and clears the lane, relay by
relay, while the investigation uncovers who is trying to burn the evidence.

---

## LEVEL 1 — MERIDIAN HAULAGE

**LOG 01 — THE CONTRACT**
> Meridian Haulage must deliver evidence
> to Lane Command down one warp lane.
> You were hired to keep it clean.
> Interdictors are already seeded.

*Hint: (none — first level)*

**Comms**
- `t=6` **HAUL**: convoy formed up. lane clearance nominal.
- `t=16` **CMD**: copy. evidence intake is open.
- `t=28` **HAUL**: then who else is in this lane?

**Report** — CASE NOTE: interdictor marks logged. someone is watching.

## LEVEL 2 — OLD MOORINGS

**LOG 02 — PATTERN**
> These interdictors are not random noise.
> Same make. Same timing.
> Someone wants the evidence gone.
> Lane Command opens a case file.

*Hint: NEW THREAT: heavy armor — dock both emitters and HOLD*

**Comms**
- `t=6` **TRACE**: interdictor marks match. one dispatcher.
- `t=20` **CMD**: we are being watched. keep hauling.
- `t=36` **HAUL**: the manifests? someone knows.

**Report** — CASE NOTE: one dispatcher confirmed. Lane Command opens a file.

## LEVEL 3 — TRANSIT EXCHANGE

**LOG 03 — TRAPS**
> Volleys now — probing our reflexes.
> And they seeded the line with
> EMITTER KILLERS: black charges that
> invert any emitter that strikes them.

*Hint: NEW THREAT: burst deployments — threats arrive in volleys*

**Comms**
- `t=6` **CMD**: black charges are emitter killers. do not touch.
- `t=22` **HAUL**: who mines a lane with traffic still in it?
- `t=36` **CMD**: someone who knows how we escort it.

**Report** — CASE NOTE: recovered emitter killers are factory-made.

## LEVEL 4 — HARBOR CROSSING

**LOG 04 — THE HARBOR**
> Barrier nets across the crossing —
> walls strung to catch the convoy
> whole. Cutting a subsea line takes
> resources. This is no lone hacker.

*Hint: NEW THREAT: barrier lines — one emitter on each end*

**Comms**
- `t=6` **TRACE**: barrier debris drifting the whole crossing.
- `t=20` **HAUL**: a net that wide needs a crew and money.
- `t=36` **CMD**: or a badge.

**Report** — CASE NOTE: a net that wide takes resources. or a badge.

## LEVEL 5 — SUBLANE DRIFT

**LOG 05 — SUBLANES**
> They chain their traps now — walls
> of them, sealing whole sections of
> the rail. We traced the deployment
> key: it holds Lane Command clearance.

*Hint: NEW THREAT: rim walls — the rail closes, route around*

**Comms**
- `t=6` **CMD**: they are walling the rail. reroute.
- `t=20` **TRACE**: deployment key holds active clearance.
- `t=34` **CMD**: log it. tell no one.

**Report** — CASE NOTE: the wall deployment key holds active clearance.

## LEVEL 6 — TRADE SPINE

**LOG 06 — CREDENTIALS**
> Phase locks — cut with CURRENT keys,
> rotated this very morning. Whoever
> hunts this line holds live clearance.
> HAUL or CMD. Trust no one.

*Hint: NEW THREAT: phase-locked threats — match the emitter*

**Comms**
- `t=6` **CMD**: rotate every clearance. now.
- `t=20` **TRACE**: locks cut with keys rotated TODAY.
- `t=36` **HAUL**: inside. it is someone inside.

**Report** — CASE NOTE: keys rotated TODAY. the leak is inside.

## LEVEL 7 — THE DARK EDGE

**LOG 07 — SIGNATURE**
> Every interdictor mark matches one
> system: the COMMAND GATEWAY itself.
> The warden meant to receive the
> evidence is burning it instead.

*Hint: ALL THREATS ACTIVE — maximum traffic*

**Comms**
- `t=6` **TRACE**: signature isolated: COMMAND GATEWAY warden.
- `t=20` **HAUL**: the receiver is the thief.
- `t=36` **CMD**: …purge authorized. deliver it.

**Report** — CASE NOTE: signature match — COMMAND GATEWAY. purge authorized.

## LEVEL 8 — COMMAND GATEWAY (boss)

**LOG 08 — THE GATEWAY**
> The gateway core was turned — bought
> to keep the evidence out of court.
> Purge it, deliver the convoy,
> and close the case.

*Hint: THE WARDEN CORE AWAITS — six bolts close the case*

**Comms**
- `t=4` **CORE**: the manifest is contaminated. I am the cure.
- `t=16` **CMD**: burn it out, runner. close the case.

**Mid-duel comm** — `on kill` **CMD**: warden down. bring it home, runner.

**LOG 09 — VERDICT** *(epilogue card, after the core dies)*
> The gateway burned. The convoy
> reached Lane Command intact. Warrants
> went out within the hour — the
> buyer wore a badge. Case closed.

**Report** — CASE CLOSED: gateway purged. cargo delivered.

---

*Boot sequence flavor (every level): LOCKING ON STREAM → ACTIVATING SYSTEMS →
AWAITING RUNNER → CONTROLS ACTIVE, with Lane Command comm "godspeed, runner."*

## Mid-run briefing cards (first encounter only)

**RIM WALL** (first wall, level 5+)
> They chain their traps now: a wall
> seizes part of your rail, then burns
> off within seconds. Crossing it
> INVERTS the emitter — route around.

**BONUS STREAM** (first golden ribbon, level 5+ / free flow)
> A golden stream rides the wall.
> OPTIONAL: keep an emitter ON its crossing
> point head to tail — a full ride
> charges that emitter's PULSE to max.

*(Rim walls escalate the emitter-killer family: point charges at level 3, walls at
level 5, and the Gateway core throwing them on demand at level 8. The old
hostile data stream became the optional golden bonus ribbon.)*

---

# CAMPAIGN 2 — GOING DEEPER (THE CORRUPTION CASE)

Premise: The gateway burned and a buyer wore a badge — but a badge takes orders. Someone above the arrest is still burning manifests, and every lane you run digs one layer closer to whoever is behind the corruption.

## LEVEL 1 — EVIDENCE VAULT

**LOG 10 — REOPENED**
> The buyer wore a badge. He also
> took orders. Tonight the sealed
> case archive is being scrubbed —
> someone above him is still awake.

*Hint: volume over trickery — ride the lane, keep the combo*

**Comms**
- `t=6` **CMD**: the vault lane is live. hold it.
- `t=20` **TRACE**: these interdictors know our sealed manifests.
- `t=36` **HAUL**: sealed means six people. count them.

**Report** — CASE NOTE: the scrub list matches SEALED manifests. six suspects.

## LEVEL 2 — PATROL LOOP

**LOG 11 — THE LOOP**
> We tapped the patrol loop.
> Whoever burns evidence files their
> overtime on this loop. Defend the
> wire while TRACE reads the badges.

*Hint: the loop runs HOT — pure traffic, find your rhythm*

**Comms**
- `t=6` **TRACE**: pulling duty rosters off the loop.
- `t=22` **CMD**: four of the six were on watch. narrow it.
- `t=38` **HAUL**: and two of them signed the gateway PO.

**Report** — CASE NOTE: two signatures on the gateway purchase order.

## LEVEL 3 — INTERNAL AFFAIRS

**LOG 12 — CLEAN HANDS**
> Internal Affairs opened their own
> file — then their line lit up with
> phase locks cut from IA credentials.
> The watchers are being watched.

*Hint: phase locks in the flood — glance, match, keep moving*

**Comms**
- `t=6` **CMD**: IA is compromised. assume everything leaks.
- `t=22` **TRACE**: keys cut from an IA terminal. inside again.
- `t=38` **CMD**: clean hands. dirty terminal. noted.

**Report** — CASE NOTE: the IA leak runs through ONE terminal. logged.

## LEVEL 4 — SHELL EXCHANGE

**LOG 13 — PAPER WALLS**
> The gateway money moved through
> shell companies — eleven names,
> one drawer. They flood the line
> with noise to bury one transfer.

*Hint: burst volleys — the flood comes in waves now*

**Comms**
- `t=6` **HAUL**: eleven shells, one registered drawer.
- `t=24` **TRACE**: volley pattern says: hiding ONE charge.
- `t=40` **CMD**: find the charge they protect. follow it.

**Report** — CASE NOTE: one transfer matters. the rest is smoke.

## LEVEL 5 — LAUNDRY LANE

**LOG 14 — THE WASH**
> The transfer washes through a
> crypto mixer under the old mint.
> They wall the rail while value
> moves. Route around. Stay on it.

*Hint: walls in the current — reroute without losing the beat*

**Comms**
- `t=6` **CMD**: they wall the rail on every wash cycle.
- `t=24` **TRACE**: mixer output pings a BLACKSITE relay.
- `t=40` **HAUL**: a blacksite. of course it is.

**Report** — CASE NOTE: the wash empties into a blacksite relay.

## LEVEL 6 — BLACKSITE RELAY

**LOG 15 — OFF THE BOOKS**
> The relay is not on any network
> map. Government-grade hardware,
> zero paperwork. Nobody builds a
> blacksite for one dirty badge.

*Hint: blacksite pace — the fastest lane yet*

**Comms**
- `t=6` **TRACE**: this hardware matches the gateway spec.
- `t=26` **CMD**: same foundry. same mark. same hand.
- `t=44` **HAUL**: the paymaster built BOTH. find him.

**Report** — CASE NOTE: gateway and blacksite share one paymaster.

## LEVEL 7 — THE PAYMASTER

**LOG 16 — THE LEDGER**
> A name signs every invoice: a
> commissioner-level login, retired
> on paper for six years. His ledger
> syncs tonight. Take the line.

*Hint: his ledger floods the lane — survive the torrent*

**Comms**
- `t=6` **CMD**: a retired clearance signing live invoices.
- `t=28` **TRACE**: ledger sync begins. hold the intercept.
- `t=48` **HAUL**: he knows we are reading. he is proud.

**Report** — CASE NOTE: the ledger names every buyer. one clearance signs.

## LEVEL 8 — BADGE ZERO (boss: triad)

**LOG 17 — BADGE ZERO**
> He built himself a private core
> from the stolen gateway schematics
> — his shield, his shredder, his
> alibi. Burn it. End the ladder.

*Hint: his private warden is THREE — shield, shredder, alibi. break each*

**Comms**
- `t=4` **CORE**: my maker is untouchable. so am I.
- `t=16` **CMD**: three heads, one snake. take them all.

**Report** — CASE CLOSED: badge zero indicted. the ladder is ash.

**LOG 18 — THE LADDER** *(epilogue card)*
> The private warden burned with the
> ledger open. Every name on it was
> served by morning — badge zero
> first. The lane is finally quiet.


---

# CAMPAIGN 3 — SIGNAL LOST (THE DEAD REACH)

Premise: Badge Zero is served — and a whole relay chain out along the reach goes dark overnight. No breach, no ransom, just silence. Its automated defences still run with no master, and something has re-lit the dead beacon at the end of the lane.

## LEVEL 1 — DEAD HARBOR

**LOG 19 — SIGNAL LOST**
> Badge Zero is served. Then a whole
> coastal relay chain drops off the
> map overnight. No breach, no ransom
> — just silence. We go in dark.

*Hint: a dead lane — every interdictor here was left ON PURPOSE*

**Comms**
- `t=6` **CMD**: the reach is dark. all of it.
- `t=22` **TRACE**: defences live, crews gone. eerie.
- `t=40` **HAUL**: who mines a lane nobody flies?

**Report** — CASE NOTE: the reach went dark on a SCHEDULE. planned silence.

## LEVEL 2 — GHOST CURRENT

**LOG 20 — GHOST CURRENT**
> The line still carries traffic.
> Nobody sends it. Nobody reads it.
> Ghost traffic on a dead current —
> and something is EATING them.

*Hint: the current still runs — fast, blind, and full*

**Comms**
- `t=6` **TRACE**: traffic with no sender. recorded loops.
- `t=24` **HAUL**: a dead lane that will not die.
- `t=44` **CMD**: ride it. see where it drains.

**Report** — CASE NOTE: the ghost traffic drains toward the old beacon hub.

## LEVEL 3 — CIPHER SHOALS

**LOG 21 — THE SHOALS**
> The shallows are mined with keyed
> locks cut years ago — still armed,
> still rotating their colors on a
> dead man’s schedule. Navigate.

*Hint: shoal water — phase-locked reefs and sealed pairs, read before you steer*

**Comms**
- `t=6` **CMD**: old keys, still turning. mind the phases.
- `t=20` **TRACE**: these locks predate badge zero. YEARS old.
- `t=38` **HAUL**: then who has been winding them?

**Report** — CASE NOTE: the shoal locks are OLDER than the corruption case.

## LEVEL 4 — RIPTIDE

**LOG 22 — RIPTIDE**
> The drain quickens near the hub.
> Whole reels of ghost traffic pulled
> under at once. Hold the line in the
> riptide and do not let go.

*Hint: riptide — do not fight the pace, become it*

**Comms**
- `t=6` **HAUL**: flow rate doubled. tripled. keep up.
- `t=30` **CMD**: steady hands. it wants you rushed.

**Report** — CASE NOTE: the drain pulls harder the closer we get.

## LEVEL 5 — THE SHALLOWS

**LOG 23 — THE SHALLOWS**
> Wrecks everywhere: relays fried by
> their own walls years ago. Whoever
> holds the beacon rehearsed this
> exact defense — on these bones.

*Hint: the rail closes in shallow water — plan two moves ahead*

**Comms**
- `t=6` **TRACE**: wall scars on every hulk out here.
- `t=20` **CMD**: this is a training ground. WAS.
- `t=46` **HAUL**: so the beacon had a teacher once.

**Report** — CASE NOTE: the hulks are practice targets. YEARS of drills.

## LEVEL 6 — UNDERTOW

**LOG 24 — UNDERTOW**
> Under the surface current there is
> a second one, running the OTHER
> way — carrying copies of everything
> we transmit straight to the hub.

*Hint: undertow — the fastest water on the dead reach*

**Comms**
- `t=6` **CMD**: it reads us as we ride. shield nothing.
- `t=38` **TRACE**: copies of OUR traffic in the drain.

**Report** — CASE NOTE: the beacon has been listening since relay one.

## LEVEL 7 — THE NARROWS

**LOG 25 — THE NARROWS**
> One channel left. It is everything
> at once: keys, walls, pairs, ghost
> floods. The beacon watches us
> thread it. It is almost polite.

*Hint: the narrows: every trick on the reach, then open water*

**Comms**
- `t=6` **HAUL**: it is WAITING for us now.
- `t=26` **TRACE**: signal ahead. clean. an invitation.
- `t=54` **CMD**: accept it. emitters hot.

**Report** — CASE NOTE: it let us through. it wanted an audience.

## LEVEL 8 — THE BEACON (boss: spinner)

**LOG 26 — THE LIGHT**
> The beacon was built to guide. Left
> alone with dead orders it guides
> still — burning every ship it sees.
> Stay out of the light. Let it turn.

*Hint: ride the light — survive every sweep and the beacon burns itself out*

**Comms**
- `t=4` **CORE**: i kept the light on. where were you?
- `t=16` **CMD**: ride the beam, runner. let it spend itself.

**Report** — CASE CLOSED: the light is out. the reach sleeps quiet.

**LOG 27 — LIGHTS OUT** *(epilogue card)*
> The beacon burned through its own
> charge and went dark for good. The
> reach came back online by morning.
> Somewhere, a new case is waiting.

