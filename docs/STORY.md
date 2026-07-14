# DATA DEFENDER: DARK FIBER — Full Story Script

Every narrative string in the game, in the order a player reads it.
Edit here for review, then port changes into `src/index.html`:

| Text | Where it appears in game | Source in `src/index.html` |
|---|---|---|
| CASE FILE logs | Briefing card on DEPLOY (typewriter) | `STORY` (~line 1725) |
| Level hint | Under the level title during boot | `LEVELS[].hint` (~line 655) |
| Comms | In-level ticker with holo-portraits | `COMMS` (~line 1763) |
| Case note | Victory report screen | `CASE_NOTES` (~line 1753) |

Speakers: **OMNI** = OmniServe HQ (corporate, blue) · **CID** = Cyber
Investigations Dept (white) · **TRACE** = CID's tracer analyst (green) ·
**CORE** = the CID Gateway firewall core (purple).

Premise: OmniServe HQ must deliver critical evidence to the CID across one
fiber line. The player is the hired defender who clears the line, relay by
relay, while the investigation uncovers who is trying to burn the evidence.

---

## LEVEL 1 — OMNISERVE CAMPUS

**LOG 01 — THE CONTRACT**
> OmniServe HQ must deliver evidence
> to the CID across one fiber line.
> You were hired to keep it clean.
> Taps are already on the wire.

*Hint: (none — first level)*

**Comms**
- `t=6` **OMNI**: payload staged. handshake nominal.
- `t=16` **CID**: copy. evidence intake is open.
- `t=28` **OMNI**: then who else is on this line?

**Report** — CASE NOTE: tap signatures logged. someone is listening.

## LEVEL 2 — OLD TOWN GRID

**LOG 02 — PATTERN**
> These taps are not random noise.
> Same make. Same timing.
> Someone wants the evidence gone.
> The CID opens a case file.

*Hint: NEW THREAT: heavy armor — dock both nodes and HOLD*

**Comms**
- `t=6` **TRACE**: tap signatures match. one operator.
- `t=20` **CID**: we are being read. keep transmitting.
- `t=36` **OMNI**: the case files? someone knows.

**Report** — CASE NOTE: one operator confirmed. the CID opens a file.

## LEVEL 3 — METRO EXCHANGE

**LOG 03 — TRAPS**
> Volleys now — probing our reflexes.
> And they seeded the line with
> NODE KILLERS: black traps that fry
> any node that touches them.

*Hint: NEW THREAT: burst transmissions — traps arrive in volleys*

**Comms**
- `t=6` **CID**: black packets are node killers. do not touch.
- `t=22` **OMNI**: who plants traps inside a live line?
- `t=36` **CID**: someone who knows how we defend it.

**Report** — CASE NOTE: recovered node killers are factory-made.

## LEVEL 4 — HARBOR CROSSING

**LOG 04 — THE HARBOR**
> Barrier taps under the harbor mud —
> walls strung to catch the payload
> whole. Cutting a subsea line takes
> resources. This is no lone hacker.

*Hint: NEW THREAT: barrier lines — one node on each end*

**Comms**
- `t=6` **TRACE**: barrier debris under the harbor mud.
- `t=20` **OMNI**: a subsea cut needs a crew and money.
- `t=36` **CID**: or a badge.

**Report** — CASE NOTE: a subsea cut takes resources. or a badge.

## LEVEL 5 — UNDERCITY FIBER

**LOG 05 — UNDERCITY**
> They chain their traps now — walls
> of them, sealing whole sections of
> the rail. We traced the deployment
> key: it holds CID clearance.

*Hint: NEW THREAT: rim walls — the rail closes, route around*

**Comms**
- `t=6` **CID**: they are walling the rail. reroute.
- `t=20` **TRACE**: deployment key holds active clearance.
- `t=34` **CID**: log it. tell no one.

**Report** — CASE NOTE: the wall deployment key holds active clearance.

## LEVEL 6 — FINANCIAL SPINE

**LOG 06 — CREDENTIALS**
> Keyed taps — cut with CURRENT keys,
> rotated this very morning. Whoever
> hunts this line holds live clearance.
> OMNI or CID. Trust no one.

*Hint: NEW THREAT: color-locked traps — match the node color*

**Comms**
- `t=6` **CID**: rotate all credentials. now.
- `t=20` **TRACE**: locks cut with keys rotated TODAY.
- `t=36` **OMNI**: inside. it is someone inside.

**Report** — CASE NOTE: keys rotated TODAY. the leak is inside.

## LEVEL 7 — DARKNET EDGE

**LOG 07 — SIGNATURE**
> Every tap signature matches one
> system: the CID GATEWAY itself.
> The firewall meant to receive the
> evidence is burning it instead.

*Hint: ALL THREATS ACTIVE — maximum traffic*

**Comms**
- `t=6` **TRACE**: signature isolated: CID GATEWAY core.
- `t=20` **OMNI**: the receiver is the thief.
- `t=36` **CID**: …purge authorized. deliver it.

**Report** — CASE NOTE: signature match — CID GATEWAY. purge authorized.

## LEVEL 8 — CID GATEWAY (boss)

**LOG 08 — THE GATEWAY**
> The gateway core was turned — bought
> to keep the evidence out of court.
> Purge it, deliver the payload,
> and close the case.

*Hint: THE FIREWALL CORE AWAITS — six bolts close the case*

**Comms**
- `t=4` **CORE**: the evidence is contaminated. I am the cure.
- `t=16` **CID**: burn it out, defender. close the case.

**Mid-duel comm** — `on kill` **CID**: core down. bring it home, defender.

**LOG 09 — VERDICT** *(epilogue card, after the core dies)*
> The gateway burned. The payload
> reached the CID intact. Warrants
> went out within the hour — the
> buyer wore a badge. Case closed.

**Report** — CASE CLOSED: gateway purged. evidence delivered.

---

*Boot sequence flavor (every level): LOCKING ON STREAM → ACTIVATING SYSTEMS →
AWAITING OPERATOR → CONTROLS ACTIVE, with the CID comm "godspeed, defender."*

## Mid-run briefing cards (first encounter only)

**RIM WALL** (first wall, level 5+)
> They chain their traps now: a wall
> seizes part of your rail, then burns
> off within seconds. Crossing it
> FRIES the node — route the other way.

**BONUS STREAM** (first golden ribbon, level 5+ / free flow)
> A golden stream rides the wall.
> OPTIONAL: keep a node ON its crossing
> point head to tail — a full ride
> charges that node's PULSE to maximum.

*(Rim walls escalate the node-killer family: point traps at level 3, walls at
level 5, and the Gateway core throwing them on demand at level 8. The old
hostile data stream became the optional golden bonus ribbon.)*
