# House law

## The noun is STAGE. Stages are named 01–08. There is no stage 0.

Gil settled the noun on 2026-08-27: **STAGE**, on every screen. The HUD, the star map,
the leaderboard, the replay banner, the Archive and the Lane Designer all say it. `LEVEL`
and `RELAY` are gone from player-facing copy. The CODE keeps `levelIdx`, `levelNo`,
`LEVELS` and `FLOW_UNLOCK_LEVEL` — the code's vocabulary is not the player's.

The numbers keep coming back because two different things wear a stage's index, and only
one of them is a name.

| Thing | Form | Base | Who reads it |
| --- | --- | --- | --- |
| `levelIdx`, `li` | `6` | zero | code only |
| a board key, `boardKey()` | `cargo-run:6` | zero | the leaderboard database |
| a stage's NAME | `07` | one | the player, Gil, every doc |

`lvNum(levelNo(ci, li))` is the ONE renderer for a name. It is `li + 1`, zero-padded.
Never build a stage name any other way — including from a bare constant such as
`FLOW_UNLOCK_LEVEL`, which printed an unpadded `5` until 2026-08-27.

### The rules

1. **Speak in display numbers.** The boss lane of a contract is **stage 08**. Never
   call it 07, and never call it `survey:07`.
2. **A board key is an id, not a name.** Write `survey:7` when you mean the key.
   Never zero-pad a key — `survey:07` is an index wearing a name's clothes, and that
   is the exact mistake that keeps happening.
3. **Code keeps `levelIdx`.** Do not renumber the internal index, and do not rename a
   board key. Board keys are persisted rows in Supabase; renaming one orphans every
   score on it.
4. **Nothing on any screen shows a bare index.** Every player-visible number goes
   through `lvNum`.
5. **On the star map a plate rides the world its level DEPARTS from.** Gil's ruling,
   2026-08-27. Plate `01` sits on the core the convoy forms up at; plate `02` sits on
   DRAOS MINOR I, which level 01 delivered to and level 02 leaves; plate `08` sits on
   the boss run's departure. The chain's last world ends a lane and starts none, so it
   carries the caption `DESTINATION`, never a hexagon — a hexagon there reads as a ninth
   stage. A plate's position comes off `SEGS[i][0]`, the level's own leg, never off
   `relayDestPos` — the core is not a relay and has no index to look up.

   The **stage list still names a stage by its destination** (`01 DRAOS MINOR I`), and
   that is deliberate: the map's job is "which lane is this", the list's job is "where
   does it go". Do not "fix" the disagreement.

### The guard

`scripts/test.js`, section **STAGE NUMBERS: THERE IS NO STAGE 0**, pins all of it: the
two helpers, every call site in every drawing file, the star map plate riding a departure,
the `DESTINATION` caption, the STAGE noun on every drawn string, and the names end to end
— `01` for the first lane, `08` for its boss, `09` where the second contract picks up, no
`00` anywhere, and no two stages sharing a name. `npm test` fails if any of it moves.

### Settled

`LEVEL` vs `STAGE` was open for one round. It is closed: **STAGE**, everywhere a player
reads it. A pin fails the build if any drawn string says `LEVEL` again.
