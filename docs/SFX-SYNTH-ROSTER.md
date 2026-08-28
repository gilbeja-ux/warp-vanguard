# Every sound in the game

67 sounds. 46 are still spoken by an oscillator. 21 are already recordings. Both
lists are on the soundboard, both are swappable, and both go through one order file.

The machine-readable copy is `scripts/sfx-roster.js`. It is the single source: the
soundboard draws its rows from it, and `npm test` pins it against the game — every
inline line byte for byte, and every take against `SFX_FILES`. Edit a cue in the
game and the roster must move with it.

---

## The words

A label here uses the word the game **prints**, never the word the code uses. `node`
and `hostile` are code words. Neither is ever drawn on a screen.

| Word | What it is | Where the game prints it |
| --- | --- | --- |
| emitter | the two dials the thumbs ride | DUAL EMITTERS · EMITTER FRIED · EMITTER ONLINE |
| ring | the band the emitters ride on | "Slide the dials to ride the ring" |
| pad | the thumb control itself | "Zaps bank charge in your pads" |
| interdictor | the thing that comes at you | INTERDICTOR · ARMORED INTERDICTOR · PHASE-LOCKED |
| shield | what DEFLECTOR SHIELD arms | SHIELD ARMED · SHIELD ABSORBED THE BREACH |
| stability | the health bar | STABILITY +25 · RESTORED · LOST |
| pulse | the banked shot | PULSE CHARGE · PULSE MISSED · PULSE PURGE ×n |
| rail | the track a dead zone seizes | RAIL LATCHED · DEAD ZONE — GO AROUND |
| bonus ribbon | the optional ride | BONUS RIBBON |
| surge | the speed step-up | LANE SURGE · DEEP SURGE |
| warp leech | the boss | WARP LEECH ONLINE · LEECH HIT |

---

## The workflow

1. Drop candidate files into `src/audio/sfx/incoming/`. Any name. `.wav`, `.mp3`,
   `.m4a` or `.ogg`.
2. Run `npm run lab:sound` and open http://localhost:8012/.
3. Press **START AUDIO** once. The page needs a gesture before it can sound.
4. Press **RESCAN incoming/** when you add more files.
5. For each cue: press **SYNTH** (or **CURRENT**, on a row that is already a take)
   to hear what ships today. Choose a file. Press **FILE** to hear the candidate on
   the same bus. Press **A / B** to hear both, 1.4 seconds apart.
6. Set the trim slider until the peak meter agrees with your ear.
7. Type a note for me in the row if the take needs work. Example: `cut the tail at
   0.4s`, or `pitch it down a third`.
8. Press **SAVE ORDER**. It writes `docs/sfx-order.json`.
9. Tell me: **implement the sfx order**.

Everything plays through the game's own sfx bus, its glue compressor, and the H-13
master limiter. What you hear on the board is what a run plays.

---

## What I do when you say "implement the sfx order"

For each pick in `docs/sfx-order.json`, in this order:

1. Move the file from `src/audio/sfx/incoming/` to `src/audio/sfx/`. I rename it
   after the cue key, so `shieldUp` becomes `shield-up.mp3`.
2. Add or update the entry in `SFX_FILES` in [12-sfx.js](src/game/12-sfx.js) with
   your trim.
3. Wire the cue:
   - A **take** row is a re-record. Only the file and the trim change.
   - A cue that already lives in `sfx` gets `if (playSample('key', ...)) return;`
     as its first line. **The synth body stays** as the fallback for a 404 or a
     failed decode. That is the house rule and every shipped take follows it.
   - An inline cue becomes a new `sfx` method first. The synth lines move into it
     verbatim, the call site becomes `sfx.thing()`, and the rule above applies.
4. Update `scripts/sfx-roster.js`: a synth row moves from `SFX_ROSTER` to
   `TAKE_ROSTER`.
5. Run `npm test` and report the levels.

I never delete a synth voice. A cue with a take keeps its oscillator underneath it.

### Four things I raise before wiring

- **A `keep` cue.** A recording cannot follow it. I say so and skip it.
- **A `dead` cue.** It has no caller. Recording it changes nothing until it is
  wired to an event, which is a design decision, not an audio one.
- **`rayCharge`.** Its release IS `BEAM_BURST` in `52-bosses`. A re-cut moves that
  constant with it, or the light stops launching on the release.
- **`miss` and `miss2`.** They alternate. Replace one alone and the pair stops
  matching.

`splash2.mp3` is on neither list. It has its own player and it is the boot splash's
master clock — `SPLASH.dur` is trued from the decoded take, so a replacement of a
different length re-times the whole title sequence. Ask me before you swap it.

---

## Status

| Status | Count | Meaning |
| --- | --- | --- |
| **live** | 32 | the synth is what you hear — a take replaces it |
| **fallback** | 7 | a take already covers it; the synth is the 404 net |
| **keep** | 4 | a number IS the sound; no recording can follow it |
| **dead** | 3 | defined and never called — wire it or delete it |
| **take** | 21 | already a recording; a pick here is a re-record |

---

## The synth cues

### Pickups and the ring

| Cue | Status | Fires | What it says |
| --- | --- | --- | --- |
| `shieldUp` | live | [12-sfx.js:156](src/game/12-sfx.js#L156) · [72-tick.js:758](src/game/72-tick.js#L758) | DEFLECTOR SHIELD caught — the shield arms |
| `heal` | live | [12-sfx.js:163](src/game/12-sfx.js#L163) · [72-tick.js:768](src/game/72-tick.js#L768) | STABILITY RESTORED, and it stands in for EMITTER ONLINE |
| `speedUp` | live | [12-sfx.js:164](src/game/12-sfx.js#L164) · [72-tick.js:388](src/game/72-tick.js#L388) | LANE SURGE / DEEP SURGE |
| `shieldHit` | live | [12-sfx.js:157](src/game/12-sfx.js#L157) · [52-bosses.js:991](src/game/52-bosses.js#L991) | SHIELD ABSORBED THE BREACH |
| `count` | live | [12-sfx.js:160](src/game/12-sfx.js#L160) · [72-tick.js:207](src/game/72-tick.js#L207) | one digit of the resume count and the surge count |
| `padPress1` | live | [72-tick.js:23](src/game/72-tick.js#L23) | one thumb lands on a pad |
| `padPress2` | live | [72-tick.js:23](src/game/72-tick.js#L23) | the pair completes, a fifth up |
| `gatePip` | live | [72-tick.js:30](src/game/72-tick.js#L30) | the lane waits in open space and pips once a second |

### Kills and the volley

| Cue | Status | Fires | What it says |
| --- | --- | --- | --- |
| `x10` | live | [72-tick.js:1001](src/game/72-tick.js#L1001) | the run's first OVERDRIVE x10 |
| `chain` | live | [72-tick.js:1033](src/game/72-tick.js#L1033) | CHAIN OVERDRIVE arcs to the nearest interdictor |
| `volleyCharge` | live | [72-tick.js:698](src/game/72-tick.js#L698) | both emitters dock — the capacitor whine |
| `volleyBlast` | live | [72-tick.js:688](src/game/72-tick.js#L688) | BLAST ×n |
| `volleyFizzle` | live | [72-tick.js:704](src/game/72-tick.js#L704) | a thumb left the pad before the charge completed |
| `pulseMissed` | live | [72-tick.js:857](src/game/72-tick.js#L857) | PULSE MISSED |
| `armorThump` | fallback | [72-tick.js:1050](src/game/72-tick.js#L1050) | an ARMORED INTERDICTOR collapses |
| `keyChime` | fallback | [72-tick.js:1051](src/game/72-tick.js#L1051) | a PHASE-LOCKED interdictor collapses |

### The lane hazards

| Cue | Status | Fires | What it says |
| --- | --- | --- | --- |
| `latchWarn` | live | [51-linter.js:480](src/game/51-linter.js#L480) · [52-bosses.js:341](src/game/52-bosses.js#L341) | a DEAD ZONE enters the lane |
| `railLatched` | live | [72-tick.js:574](src/game/72-tick.js#L574) | RAIL LATCHED |

### The warp leech

| Cue | Status | Fires | What it says |
| --- | --- | --- | --- |
| `leechHit` | live | [52-bosses.js:223](src/game/52-bosses.js#L223) | LEECH HIT — a pulse lands, the only thing that wounds it |
| `wrongKey` | live | [52-bosses.js:194](src/game/52-bosses.js#L194) | WRONG KEY — READ THE LAMP |
| `lampCall` | live | [52-bosses.js:542](src/game/52-bosses.js#L542) | BLUE KEY / WHITE KEY — the pitch says which |
| `lastStand` | live | [52-bosses.js:246](src/game/52-bosses.js#L246) | LAST STAND — BOTH KEYS, AS ONE |
| `shedLayer` | live | [52-bosses.js:269](src/game/52-bosses.js#L269) | IT SHEDS A LAYER — NEW PATTERN |
| `sweepReversed` | live | [52-bosses.js:481](src/game/52-bosses.js#L481) | SWEEP REVERSED |
| `bossCalm` | live | [52-bosses.js:614](src/game/52-bosses.js#L614) | a pattern is survived — back to idle |
| `laneSecured` | live | [52-bosses.js:959](src/game/52-bosses.js#L959) | LANE SECURED |
| `bossDown` | fallback | [12-sfx.js:284](src/game/12-sfx.js#L284) | plays only when `boss-dead.mp3` fails to decode |

### The END card

| Cue | Status | Fires | What it says |
| --- | --- | --- | --- |
| `star1` / `star3` | live | [12-sfx.js:319](src/game/12-sfx.js#L319) · [95-menu.js:788](src/game/95-menu.js#L788) | one star lands; the ladder rises per star |
| `starsFull3` | live | [12-sfx.js:320](src/game/12-sfx.js#L320) · [95-menu.js:792](src/game/95-menu.js#L792) | follows the LAST star — the grade itself |
| `starsFull2` | live | [12-sfx.js:320](src/game/12-sfx.js#L320) | the two-star resolve — a rising fifth |
| `newBest` | live | [12-sfx.js:330](src/game/12-sfx.js#L330) · [95-menu.js:899](src/game/95-menu.js#L899) | the badge stamps once |
| `unlock` | live | [12-sfx.js:336](src/game/12-sfx.js#L336) · [95-menu.js:1002](src/game/95-menu.js#L1002) | the next lane's key lands |
| `traced` | live | [12-sfx.js:340](src/game/12-sfx.js#L340) · [72-tick.js:870](src/game/72-tick.js#L870) | a full ride of the BONUS RIBBON |

### Menus and the boot

| Cue | Status | Fires | What it says |
| --- | --- | --- | --- |
| `menuLaunch` | live | [33-loader.js:205](src/game/33-loader.js#L205) · [60-input.js:476](src/game/60-input.js#L476) | the thump under a screen that leaves |
| `bootGodspeed` | live | [72-tick.js:529](src/game/72-tick.js#L529) | squelch, a double ack, the release — no take covers it |
| `bootLock` | fallback | [72-tick.js:511](src/game/72-tick.js#L511) | plays only without `startup1.mp3` |
| `bootDock` | fallback | [72-tick.js:522](src/game/72-tick.js#L522) | plays only without `startup1.mp3` |
| `bootSignoff` | fallback | [72-tick.js:551](src/game/72-tick.js#L551) | plays only without `restarting.mp3` |

The menu **press** is not here. It is a recording. See `ui` below.

### Keep synth — the number is the sound

| Cue | Fires | Why a recording cannot do it |
| --- | --- | --- |
| `pulseBank` | [12-sfx.js:258](src/game/12-sfx.js#L258) | the frequency IS the fill readout: 300 Hz empty, 820 Hz full |
| `stripDrone` | [10-audio.js:312](src/game/10-audio.js#L312) | 220 Hz to 880 Hz as the BONUS RIBBON is ridden |
| `rayVoice` | [10-audio.js:374](src/game/10-audio.js#L374) | pitch and pan are driven per frame off the light's own rotation |
| `ambientBed` | [10-audio.js:286](src/game/10-audio.js#L286) | `in-warp.mp3` already owns the bed |

### Dead — defined, never called

| Cue | Defined | Note |
| --- | --- | --- |
| `perfect` | [12-sfx.js:159](src/game/12-sfx.js#L159) | **a PERFECT is silent today.** Only the rim answers it. |
| `go` | [12-sfx.js:162](src/game/12-sfx.js#L162) | no caller anywhere |
| `bossShot` | [12-sfx.js:161](src/game/12-sfx.js#L161) | left over from a retired boss |

---

## The recorded takes

Every one of these is swappable on the same board. A pick here is a re-record: the
file and the trim change, the wiring does not.

| Cue | File | Trim | What it says |
| --- | --- | --- | --- |
| `ui` | `mini-hit.wav` | 0.50 | **every press on every menu, panel, star-map plate and board row** |
| `hit` | `hit-1.wav` | 0.80 | an interdictor collapses; the combo winds its rate up to x12 |
| `miss` | `miss.wav` | 0.90 | an interdictor got through |
| `miss2` | `miss2.wav` | 0.90 | the odd-numbered miss — the pair alternates |
| `pick` | `power-up.wav` | 0.60 | the shared pickup sparkle |
| `pulse` | `pulse.mp3` | 1.00 | PULSE PURGE ×n |
| `pulseArm` | `pulse_charge.mp3` | 0.90 | PULSE CHARGED, panned to the pad that owns the orb |
| `volley` | `volley2.mp3` | 1.00 | the bolt leaves the ring |
| `shutdown` | `shutdown.mp3` | 0.90 | EMITTER FRIED |
| `restart` | `restarting.mp3` | 0.90 | EMITTER ONLINE, and the boot ramp's whir |
| `sonar` | `sonar-ping.mp3` | 0.05 | weather, not an event — rate-capped lane-wide |
| `rayCharge` | `ray-charge.mp3` | 0.70 | the ray winds up; **its release is `BEAM_BURST`** |
| `bossPlate` | `boss-plate.mp3` | 0.60 | one file, six plays, pitched 1.20 down to 0.85 |
| `bossArrive` | `boss-arrival.mp3` | 1.00 | WARP LEECH ONLINE — a 9.08s bed, faded out |
| `bossDead` | `boss-dead.mp3` | 0.85 | the implosion — the ceremonial loudest thing in the game |
| `warpIn` | `warp-in.mp3` | 0.27 | the spool-up; it stacks with `startup` on the same beat |
| `inWarp` | `in-warp.mp3` | 0.34 | the lane bed, looped for the whole run |
| `exitWarp` | `exit-warp.mp3` | 0.30 | dropping out of warp, with the win sting inside it |
| `startup` | `startup1.mp3` | 0.90 | the boot sequence, cut at 2s |
| `win` | `win.mp3` | 1.00 | the victory sting |
| `fail` | `failed.mp3` | 0.95 | the run is lost |
