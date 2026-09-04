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

## Two platforms, one fix. iOS is always upload-ready.

Gil's standing order, 2026-09-04: **every fix lands on both platforms, every time.** The
iOS shell must stay in step with Android so that the day an Apple Developer ID exists,
the upload is `npm run ios:archive` and nothing else — no catch-up, no "let me check
whether iOS still builds".

What that means in practice:

1. **A native decision is made twice.** Anything that lives in `AndroidManifest.xml`,
   `build.gradle` or the Android splash/icon set has a twin in `ios/App/App/Info.plist`,
   `GameViewController.swift`, `AppDelegate.swift` or the launch storyboard. Change one,
   change the other in the same commit. BUILD.md lists the pairs.
2. **A version moves in three places at once,** and only through `scripts/sync-version.js`
   — never by hand in Xcode or Gradle. `npm test` fails if the iOS project's version drifts
   from package.json.
3. **Every store cut proves both shells.** `npm run aab` ends by compiling the iOS app for
   the simulator (`scripts/build-ios.sh --no-install`). A Play upload with a broken iOS build
   does not happen.
4. **A Capacitor upgrade is one job for both platforms**, with a fresh R8 device pass on
   Android and a simulator pass on iOS before either ships.

The guard is `npm test`, section **THE iOS SHELL**, plus the iOS step at the end of
`scripts/build-aab.sh`.


## The disc law: nothing touches the edge of a disc

Gil, 2026-09-04, after saying it for the third time. Every panel in the game is a disc
the ring casts (the kit is in `src/game/91-briefing.js`: `discPlate`, `discRows`,
`discSegKeys`, `discSlab`, `discPara`). **No text, key, field or rail may touch the rim.**

1. **Fit to the chord at the element's OWN height.** `discChord(R, dy)` is the half-width
   of the circle at `dy` off centre. A key or field is fitted at its widest corner; a
   line of text at the top of its glyphs on the upper half and the bottom on the lower.
2. **Text goes through `discPara`.** It wraps every line to its own chord minus
   `DISC_TEXT_PAD`. Never wrap a paragraph to one fixed width, and never to the chord of
   its first line — the disc is drawn at desktop sizes too, and that is where the words
   land on the rim.
3. **Keys and rails keep `DISC_PAD` off the rim; text and FIELDS keep `DISC_TEXT_PAD`,**
   which is wider. A rail end may sit near the edge; a word, or a box that holds words,
   may not. Fit a field with `discFieldHx(R, fy, fh, cy)` — never with `DISC_PAD`.
4. **A title keeps `DISC_TITLE_PAD` at the top of its capitals, and a long title BREAKS.**
   `discPlate` fits each title line to the crown's chord; a 14-letter title fitted to one
   line comes out the size of a caption. Pass `'RENAME\nMY RUNS'`, never a shrunken line.
5. **Check at a desktop size, not only a phone.** The overflow shows at 1600 wide first.

`npm test` pins the kit and pins MY DATA to it. A new disc that wraps its own text fails
the pin.
