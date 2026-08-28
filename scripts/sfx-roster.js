'use strict';
// ============================================================================
// THE SYNTH ROSTER — every cue the game still speaks with an oscillator.
//
// ONE SOURCE OF TRUTH, read by three things:
//   · scripts/soundboard.html — draws a row per cue and auditions it
//   · scripts/test.js         — pins every `pin` line against its real source
//   · me, when Gil says "implement the sfx order"
//
// WHY THE `pin` FIELD EXISTS. A cue that lives inside `sfx` can be auditioned by
// calling it — `sfx.shieldUp()` IS the game's voice, never a copy. A cue written
// inline in the middle of a game file has no function to call, so the board has
// to hold a COPY of those lines. A copy rots. Every `pin` line is checked, byte
// for byte, against the file named in `where`, so `npm test` fails the moment the
// board and the game disagree. Retune a cue in the game and you must retune it
// here, which is the point.
//
// STATUS
//   live     — the synth IS what the game plays. A take dropped in replaces it.
//   fallback — a recorded take already covers this; the synth plays only if the
//              decode fails. A new take is a re-record, not a first record.
//   keep     — must stay synth. A parameter IS the sound (the pitch reads out a
//              fill, a progress, a rotation). No fixed recording can follow it.
//   dead     — defined and never called. Wire it or delete it; do not record it.
//   take     — already a recording (TAKE_ROSTER below). Swappable all the same.
//
// TWO ROSTERS, ONE BOARD. `SFX_ROSTER` is the oscillators. `TAKE_ROSTER` is the
// 21 rows of `SFX_FILES` — the sounds that are ALREADY recordings. The second
// list exists because "the menu advance sound" is one of them (`ui`), and a board
// that only offered the synths could not swap it. Both lists render the same way
// and share one order file, so a re-record and a first record are one gesture.
// `npm test` pins TAKE_ROSTER against `SFX_FILES` in both directions: a take
// added to the game and not to the board fails the build.
// ============================================================================
// ----------------------------------------------------------------------------
// THE WORDS. A label here uses the word the GAME PRINTS, never the word the code
// uses and never one I invented. `node` and `hostile` are code; neither is ever
// drawn on a screen. "Collar" was mine, and it was wrong: the thing the shield
// pickup arms is the SHIELD.
//
//   emitter      the two dials the thumbs ride    DUAL EMITTERS / EMITTER FRIED
//   ring         the band the emitters ride on    "ride the ring"
//   pad          the thumb control itself         "charge in your pads"
//   interdictor  the thing that comes at you      INTERDICTOR / ARMORED / PHASE-LOCKED
//   shield       what DEFLECTOR SHIELD arms       SHIELD ARMED / ABSORBED THE BREACH
//   stability    the health bar                   STABILITY +25 / RESTORED / LOST
//   pulse        the banked shot                  PULSE CHARGE / MISSED / PURGE ×n
//   rail         the track a dead zone seizes     RAIL LATCHED / DEAD ZONE
//   bonus ribbon the optional ride                BONUS RIBBON
//   surge        the speed step-up                LANE SURGE / DEEP SURGE
//   warp leech   the boss                         WARP LEECH ONLINE / LEECH HIT
// ----------------------------------------------------------------------------
const SFX_ROSTER = [
  // ---------------------------------------------------------------- pickups
  { key: 'shieldUp', label: 'the shield arms', group: 'Pickups & the ring',
    where: '12-sfx.js:156 · fires 72-tick.js:758', status: 'live',
    brief: 'DEFLECTOR SHIELD caught — the shield arms 0.12s behind the pickup sparkle',
    code: ['sfx.shieldUp();'] },
  { key: 'heal', label: 'stability restored', group: 'Pickups & the ring',
    where: '12-sfx.js:163 · fires 72-tick.js:768, 966, 347', status: 'live',
    brief: 'STABILITY RESTORED — and it stands in for EMITTER ONLINE when the reboot take is absent',
    code: ['sfx.heal();'] },
  { key: 'speedUp', label: 'lane surge', group: 'Pickups & the ring',
    where: '12-sfx.js:164 · fires 72-tick.js:388', status: 'live',
    brief: 'LANE SURGE / DEEP SURGE — the lane steps up a speed',
    code: ['sfx.speedUp();'] },
  { key: 'shieldHit', label: 'the shield absorbs a breach', group: 'Pickups & the ring',
    where: '12-sfx.js:157 · fires 52-bosses.js:991', status: 'live',
    brief: 'SHIELD ABSORBED THE BREACH — it spends the charge instead of the run',
    code: ['sfx.shieldHit();'] },
  { key: 'count', label: 'countdown digit', group: 'Pickups & the ring',
    where: '12-sfx.js:160 · fires 72-tick.js:207, 381', status: 'live',
    brief: 'one digit of the resume count and of the surge count',
    code: ['sfx.count();'] },
  { key: 'padPress1', label: 'first thumb lands', group: 'Pickups & the ring',
    where: '72-tick.js:23', status: 'live', pinFile: '72-tick.js',
    brief: 'one thumb on a pad — the lower of the two acks',
    code: ['const other = 0;',
      "tone(other ? 1046 : 698, 0.05, 'square', 0.05);",
      "tone(other ? 1568 : 1046, 0.04, 'sine', 0.03, null, null, 0.05);"],
    pin: ["tone(other ? 1046 : 698, 0.05, 'square', 0.05);",
      "tone(other ? 1568 : 1046, 0.04, 'sine', 0.03, null, null, 0.05);"] },
  { key: 'padPress2', label: 'second thumb lands', group: 'Pickups & the ring',
    where: '72-tick.js:23', status: 'live', pinFile: '72-tick.js',
    brief: 'the pair completes — the same ack, a fifth up',
    code: ['const other = 1;',
      "tone(other ? 1046 : 698, 0.05, 'square', 0.05);",
      "tone(other ? 1568 : 1046, 0.04, 'sine', 0.03, null, null, 0.05);"],
    pin: [] },
  { key: 'gatePip', label: 'the parked pip', group: 'Pickups & the ring',
    where: '72-tick.js:30', status: 'live', pinFile: '72-tick.js',
    brief: 'the lane waits in open space and pips once a second',
    code: ["tone(960, 0.03, 'sine', 0.03);"] },

  // ------------------------------------------------------------------- kills
  { key: 'x10', label: 'OVERDRIVE x10 chime', group: 'Kills & the volley',
    where: '72-tick.js:1001', status: 'live', pinFile: '72-tick.js',
    brief: 'the run’s first x10 — rides 0.12s behind the zap take',
    code: ["tone(1046, 0.14, 'triangle', 0.09, 1568, null, 0.12);",
      "tone(1568, 0.2, 'triangle', 0.07, 2093, null, 0.22);"] },
  { key: 'chain', label: 'chain overdrive', group: 'Kills & the volley',
    where: '72-tick.js:1033', status: 'live', pinFile: '72-tick.js',
    brief: 'CHAIN OVERDRIVE — the zap arcs to the nearest interdictor and takes it too',
    code: ["tone(1976, 0.1, 'triangle', 0.08, 2960);"] },
  { key: 'volleyCharge', label: 'the emitters dock', group: 'Kills & the volley',
    where: '72-tick.js:698', status: 'live', pinFile: '72-tick.js',
    brief: 'both emitters dock — half a second of whine before the bolt',
    code: ['crackle(0.5, 300, 2200, 2, 0.28);'] },
  { key: 'volleyBlast', label: 'the blast', group: 'Kills & the volley',
    where: '72-tick.js:688', status: 'live', pinFile: '72-tick.js',
    brief: 'BLAST ×n — the bolt reaches its mark and takes the interdictors around it',
    code: ['crackle(0.18, 900, 2600, 2, 0.45);'] },
  { key: 'volleyFizzle', label: 'the dock breaks', group: 'Kills & the volley',
    where: '72-tick.js:704', status: 'live', pinFile: '72-tick.js',
    brief: 'a thumb left the pad before the charge completed',
    code: ["tone(600, 0.08, 'sine', 0.04, 380);"] },
  { key: 'pulseMissed', label: 'a pulse answers nothing', group: 'Kills & the volley',
    where: '72-tick.js:857', status: 'live', pinFile: '72-tick.js',
    brief: 'PULSE MISSED — a pulse fired and answered nothing',
    code: ["tone(520, 0.14, 'sine', 0.05, 390);"] },
  { key: 'armorThump', label: 'an armored interdictor', group: 'Kills & the volley',
    where: '72-tick.js:1050, 667', status: 'fallback', pinFile: '72-tick.js',
    brief: 'an ARMORED INTERDICTOR collapses — layered only when the hit take is absent',
    code: ["tone(110, 0.2, 'square', 0.13, 60);"] },
  { key: 'keyChime', label: 'a phase-locked interdictor', group: 'Kills & the volley',
    where: '72-tick.js:1051', status: 'fallback', pinFile: '72-tick.js',
    brief: 'a PHASE-LOCKED interdictor collapses — layered only without the hit take',
    code: ["tone(1568, 0.12, 'triangle', 0.09, 1976);"] },

  // -------------------------------------------------------------- the hazard
  { key: 'latchWarn', label: 'a dead zone enters the lane', group: 'The lane hazards',
    where: '51-linter.js:480 · also 52-bosses.js:341', status: 'live', pinFile: '51-linter.js',
    brief: 'a dry double tick and static as the dead zone arrives',
    code: ["tone(1180, 0.02, 'square', 0.05); tone(1180, 0.02, 'square', 0.05, null, null, 0.22);",
      'crackle(0.25, 500, 1800, 2, 0.3);'] },
  { key: 'railLatched', label: 'the rail is latched', group: 'The lane hazards',
    where: '72-tick.js:574', status: 'live', pinFile: '72-tick.js',
    brief: 'RAIL LATCHED — the dead zone seizes part of the rail',
    code: ["tone(140, 0.3, 'sawtooth', 0.12, 70);", 'crackle(0.3, 2400, 500, 4, 0.6);'] },

  // ---------------------------------------------------------------- the boss
  { key: 'leechHit', label: 'the warp leech is hit', group: 'The warp leech',
    where: '52-bosses.js:223', status: 'live', pinFile: '52-bosses.js',
    brief: 'LEECH HIT — a pulse lands on the WARP LEECH, the only thing that wounds it',
    code: ["tone(70, 0.3, 'sine', 0.2, 40);", 'crackle(0.35, 2000, 300, 2, 0.8);'] },
  { key: 'wrongKey', label: 'wrong key fizzle', group: 'The warp leech',
    where: '52-bosses.js:194, 207', status: 'live', pinFile: '52-bosses.js',
    brief: 'the lamp was misread — a fizzle, not thunder',
    code: ["tone(620, 0.12, 'sine', 0.08, 340);", 'crackle(0.15, 1600, 700, 1, 0.3);'] },
  { key: 'lampCall', label: 'the lamp calls a key', group: 'The warp leech',
    where: '52-bosses.js:542', status: 'live', pinFile: '52-bosses.js',
    brief: 'BLUE KEY / WHITE KEY — the pitch says which',
    code: ['const b = { lamp: 0 };',
      "tone(b.lamp === 0 ? 520 : 660, 0.12, 'sine', 0.07, b.lamp === 0 ? 400 : 520);"],
    pin: ["tone(b.lamp === 0 ? 520 : 660, 0.12, 'sine', 0.07, b.lamp === 0 ? 400 : 520);"] },
  { key: 'lastStand', label: 'LAST STAND', group: 'The warp leech',
    where: '52-bosses.js:246', status: 'live', pinFile: '52-bosses.js',
    brief: 'the final gesture is called — both keys, as one',
    code: ["tone(160, 0.5, 'sawtooth', 0.14, 60);", 'crackle(0.45, 3200, 700, 6, 1.0, 0.1);'] },
  { key: 'shedLayer', label: 'it sheds a layer', group: 'The warp leech',
    where: '52-bosses.js:269', status: 'live', pinFile: '52-bosses.js',
    brief: 'a round ends — NEW PATTERN',
    code: ["tone(150, 0.5, 'sawtooth', 0.13, 70);", 'crackle(0.4, 2600, 600, 4, 0.8);'] },
  { key: 'sweepReversed', label: 'SWEEP REVERSED', group: 'The warp leech',
    where: '52-bosses.js:481', status: 'live', pinFile: '52-bosses.js',
    brief: 'the light turns back — the one cue that fires under the ray',
    code: ["tone(240, 0.2, 'sawtooth', 0.1, 120);"] },
  { key: 'bossCalm', label: 'the warp leech goes idle', group: 'The warp leech',
    where: '52-bosses.js:614, 687', status: 'live', pinFile: '52-bosses.js',
    brief: 'a pattern is survived — a flat double blip back to idle',
    code: ["tone(960, 0.04, 'sine', 0.06); tone(960, 0.04, 'sine', 0.06, null, null, 0.16);"] },
  { key: 'laneSecured', label: 'LANE SECURED', group: 'The warp leech',
    where: '52-bosses.js:959', status: 'live', pinFile: '52-bosses.js',
    brief: 'LANE SECURED — the last interdictor of a wave is gone',
    code: ["tone(784, 0.18, 'triangle', 0.1, 1046);",
      "tone(1046, 0.22, 'triangle', 0.08, 1568, null, 0.12);"] },
  { key: 'bossDown', label: 'implosion (fallback)', group: 'The warp leech',
    where: '12-sfx.js:284 · fires 52-bosses.js:894', status: 'fallback',
    brief: 'plays only when boss-dead.mp3 fails to decode',
    code: ['sfx.bossDown();'] },

  // -------------------------------------------------------------- the verdict
  { key: 'star1', label: 'star pop 1', group: 'The END card',
    where: '12-sfx.js:319 · fires 95-menu.js:788', status: 'live',
    brief: 'one star lands on the card; the ladder rises per star',
    code: ['sfx.star(1);'] },
  { key: 'star3', label: 'star pop 3', group: 'The END card',
    where: '12-sfx.js:319 · fires 95-menu.js:788', status: 'live',
    brief: 'the same chime, top of the ladder',
    code: ['sfx.star(3);'] },
  { key: 'starsFull3', label: 'grade resolves · 3★', group: 'The END card',
    where: '12-sfx.js:320 · fires 95-menu.js:792', status: 'live',
    brief: 'follows the LAST star — the grade itself',
    code: ['sfx.starsFull(3);'] },
  { key: 'starsFull2', label: 'grade resolves · 2★', group: 'The END card',
    where: '12-sfx.js:320 · fires 95-menu.js:792', status: 'live',
    brief: 'the two-star resolve — a rising fifth',
    code: ['sfx.starsFull(2);'] },
  { key: 'newBest', label: 'NEW BEST stamp', group: 'The END card',
    where: '12-sfx.js:330 · fires 95-menu.js:899', status: 'live',
    brief: 'the badge stamps once',
    code: ['sfx.newBest();'] },
  { key: 'unlock', label: 'lane unlock', group: 'The END card',
    where: '12-sfx.js:336 · fires 95-menu.js:1002', status: 'live',
    brief: 'the next lane’s key lands',
    code: ['sfx.unlock();'] },
  { key: 'traced', label: 'the bonus ribbon is ridden', group: 'The END card',
    where: '12-sfx.js:340 · fires 72-tick.js:870', status: 'live',
    brief: 'a full ride of the BONUS RIBBON, head to tail — it banks a whole pulse',
    code: ['sfx.traced();'] },

  // ----------------------------------------------------------------- the boot
  { key: 'menuLaunch', label: 'menu launch thump', group: 'Menus & the boot',
    where: '33-loader.js:205, 211 · 60-input.js:476-491', status: 'live', pinFile: '33-loader.js',
    brief: 'a disc is synced or a lane is deployed — the screen leaves',
    code: ["tone(70, 0.45, 'sine', 0.12, 260);"] },
  { key: 'bootGodspeed', label: 'GODSPEED ack', group: 'Menus & the boot',
    where: '72-tick.js:529', status: 'live', pinFile: '72-tick.js',
    brief: 'squelch, a terse double ack, and the release — no take covers it',
    code: ['crackle(0.07, 1300, 2700, 2, 0.4);',
      "tone(740, 0.05, 'square', 0.09, null, null, 0.08);",
      "tone(740, 0.05, 'square', 0.09, null, null, 0.17);",
      "tone(58, 0.4, 'sine', 0.22, 42);"] },
  { key: 'bootLock', label: 'boot · the lock', group: 'Menus & the boot',
    where: '72-tick.js:511', status: 'fallback', pinFile: '72-tick.js',
    brief: 'plays only when startup1.mp3 is absent',
    code: ["tone(36, BOOT_LOCK, 'sine', 0.10, 58);", 'crackle(BOOT_LOCK, 70, 300, 0.8, 0.22);',
      'for (let k = 0; k < 7; k++) {',
      '  const dly = BOOT_LOCK * (1 - Math.pow(1 - (k + 1) / 7.6, 1.9));',
      "  tone(1240, 0.016, 'square', 0.03 + k * 0.004, null, null, dly);", '}'],
    pin: ["tone(36, BOOT_LOCK, 'sine', 0.10, 58);", 'crackle(BOOT_LOCK, 70, 300, 0.8, 0.22);'] },
  { key: 'bootDock', label: 'boot · the dock', group: 'Menus & the boot',
    where: '72-tick.js:522', status: 'fallback', pinFile: '72-tick.js',
    brief: 'plays only when startup1.mp3 is absent',
    code: ["tone(90, 0.25, 'sine', 0.24, 40);", "tone(1850, 0.02, 'square', 0.07);",
      'crackle(0.3, 1100, 240, 1.4, 0.5);', 'crackle(0.7, 160, 1100, 2, 0.28, 0.15);'],
    pin: ["tone(90, 0.25, 'sine', 0.24, 40);", "tone(1850, 0.02, 'square', 0.07);",
      'crackle(0.3, 1100, 240, 1.4, 0.5);'] },
  { key: 'bootSignoff', label: 'boot · sign-off clicks', group: 'Menus & the boot',
    where: '72-tick.js:551', status: 'fallback', pinFile: '72-tick.js',
    brief: 'plays only when restarting.mp3 is absent',
    code: ["tone(1500, 0.014, 'square', 0.05);",
      "tone(215, 0.07, 'square', 0.05); tone(260, 0.07, 'square', 0.04);",
      "tone(1250, 0.02, 'square', 0.06, null, null, 0.09);",
      "tone(1250, 0.02, 'square', 0.06, null, null, 0.18);"] },

  // -------------------------------------------------- must stay an oscillator
  { key: 'pulseBank', label: 'a pulse orb fills', group: 'KEEP SYNTH · the number is the sound',
    where: '12-sfx.js:258 · fires 72-tick.js:954', status: 'keep',
    brief: 'the FREQUENCY is the fill readout — 300 Hz empty, 820 Hz full',
    code: ['sfx.pulseBank(0.15, 0); setTimeout(() => sfx.pulseBank(0.5, 0), 260);'
      + ' setTimeout(() => sfx.pulseBank(0.85, 0), 520); setTimeout(() => sfx.pulseBank(1, 0), 780);'] },
  { key: 'stripDrone', label: 'the bonus ribbon drone', group: 'KEEP SYNTH · the number is the sound',
    where: '10-audio.js:312 · fires 72-tick.js:370', status: 'keep',
    brief: 'a rolling tone from 220 Hz to 880 Hz as the BONUS RIBBON is ridden',
    code: ['stripSound(true, 0);',
      'let p = 0; const iv = setInterval(() => { p += 0.03; stripSound(true, p);',
      '  if (p >= 1) { clearInterval(iv); stripSound(false, 0); sfx.traced(); } }, 40);'] },
  { key: 'rayVoice', label: 'the sweeping ray bed', group: 'KEEP SYNTH · the number is the sound',
    where: '10-audio.js:374, 426', status: 'keep',
    brief: 'pitch and pan are driven per frame off the light’s own rotation',
    code: ['/* the RAY section above drives the real sweep — use its buttons */'] },
  { key: 'ambientBed', label: 'in-warp bed (fallback)', group: 'KEEP SYNTH · the number is the sound',
    where: '10-audio.js:286', status: 'fallback',
    brief: 'in-warp.mp3 owns the bed; the synth runs only until it decodes',
    code: ['/* covered by in-warp.mp3 — nothing to replace */'] },

  // ------------------------------------------------------------------ unwired
  { key: 'perfect', label: 'PERFECT ping', group: 'DEAD · defined, never called',
    where: '12-sfx.js:159', status: 'dead',
    brief: 'a PERFECT is SILENT in the game today — only the rim answers it',
    code: ['sfx.perfect();'] },
  { key: 'go', label: 'GO', group: 'DEAD · defined, never called',
    where: '12-sfx.js:162', status: 'dead',
    brief: 'no caller anywhere in the game',
    code: ['sfx.go();'] },
  { key: 'bossShot', label: 'boss shot', group: 'DEAD · defined, never called',
    where: '12-sfx.js:161', status: 'dead',
    brief: 'left over from a retired boss — no caller',
    code: ['sfx.bossShot();'] }
];

// ============================================================================
// THE TAKE ROSTER — every sound that is ALREADY a recording.
//
// One row per key of `SFX_FILES` in 12-sfx.js, in that file's own order. Each
// `code` calls the REAL player, never a copy: `sfx.tick()` is what a menu press
// runs, `sfx.zap(1, 0)` is what a kill runs, and the five takes with no `sfx`
// method of their own are auditioned through `playSample`, which is the function
// the game itself calls. Swapping one of these is a RE-RECORD: the file changes,
// the wiring does not.
// ============================================================================
const TAKE_ROSTER = [
  { key: 'ui', label: 'menu press · the advance tick', group: 'TAKES · the menus', status: 'take',
    file: 'mini-hit.wav', trim: 0.5,
    where: '12-sfx.js:349 · pressUI() at 99-boot.js:155',
    brief: 'EVERY press on every menu, panel, star-map plate and board row goes through here',
    code: ['sfx.tick();'] },
  { key: 'hit', label: 'the kill', group: 'TAKES · the run', status: 'take',
    file: 'hit-1.wav', trim: 0.8,
    where: '12-sfx.js:141 · fires 72-tick.js:1048, 662',
    brief: 'an interdictor collapses — the combo winds its playback rate up to x12',
    code: ['sfx.zap(1, 0); setTimeout(() => sfx.zap(6, 0), 400); setTimeout(() => sfx.zap(12, 0), 800);'] },
  { key: 'miss', label: 'a miss', group: 'TAKES · the run', status: 'take',
    file: 'miss.wav', trim: 0.9,
    where: '12-sfx.js:165 · fires 72-tick.js:1073, 850',
    brief: 'an interdictor got through — two takes alternate off the miss counter',
    code: ["playSample('miss', 1, 0);"] },
  { key: 'miss2', label: 'a miss · the other take', group: 'TAKES · the run', status: 'take',
    file: 'miss2.wav', trim: 0.9,
    where: '12-sfx.js:165', brief: 'the odd-numbered miss — replace it WITH its partner or the pair stops matching',
    code: ["playSample('miss2', 1, 0);"] },
  { key: 'pick', label: 'a pickup', group: 'TAKES · the run', status: 'take',
    file: 'power-up.wav', trim: 0.6,
    where: '12-sfx.js:150 · fires 72-tick.js:758, 764, 768',
    brief: 'the shared sparkle — the shield, the stability patch and the pulse arm ride 0.12s behind it',
    code: ['sfx.pick();'] },
  { key: 'pulse', label: 'the pulse fires', group: 'TAKES · the run', status: 'take',
    file: 'pulse.mp3', trim: 1.0,
    where: '12-sfx.js:247 · fires 85-enemy-art.js:1987',
    brief: 'PULSE PURGE ×n — an armed orb is spent',
    code: ['sfx.pulseFire();'] },
  { key: 'pulseArm', label: 'an orb reaches full', group: 'TAKES · the run', status: 'take',
    file: 'pulse_charge.mp3', trim: 0.9,
    where: '12-sfx.js:263 · fires 72-tick.js:952, 879, 764',
    brief: 'PULSE CHARGED — panned to the pad that owns the orb, so which side is armed is audible',
    code: ['sfx.pulseArmed(-0.7); setTimeout(() => sfx.pulseArmed(0.7), 700);'] },
  { key: 'volley', label: 'the volley launches', group: 'TAKES · the run', status: 'take',
    file: 'volley2.mp3', trim: 1.0,
    where: '12-sfx.js · fires 85-enemy-art.js:1896',
    brief: 'the bolt leaves the ring and flies the bore',
    code: ["playSample('volley');"] },
  { key: 'shutdown', label: 'an emitter is fried', group: 'TAKES · the run', status: 'take',
    file: 'shutdown.mp3', trim: 0.9,
    where: '12-sfx.js:171 · fires 72-tick.js:590, 52-bosses.js:495',
    brief: 'EMITTER FRIED — a dead zone or a boss light takes an emitter down',
    code: ['sfx.fry(0);'] },
  { key: 'restart', label: 'an emitter comes back online', group: 'TAKES · the run', status: 'take',
    file: 'restarting.mp3', trim: 0.9,
    where: '12-sfx.js · fires 72-tick.js:341, 520',
    brief: 'EMITTER ONLINE — and the same whir carries the boot ramp',
    code: ["playSample('restart', 1, 0);"] },
  { key: 'sonar', label: 'the sonar ping', group: 'TAKES · the run', status: 'take',
    file: 'sonar-ping.mp3', trim: 0.05,
    where: '10-audio.js:494 · fires per interdictor from updateEnemy',
    brief: 'WEATHER, not an event — the quietest take by ~9 dB, and rate-capped lane-wide',
    code: ['const s0 = state; state = S.PLAY;',
      'try { sonarTick(1250, 0); } finally { state = s0; }'] },
  { key: 'rayCharge', label: 'the ray winds up', group: 'TAKES · the warp leech', status: 'take',
    file: 'ray-charge.mp3', trim: 0.7,
    where: '12-sfx.js:187 · its release IS BEAM_BURST in 52-bosses',
    brief: 'RE-CUT THIS AND BEAM_BURST MOVES WITH IT — the light launches on the release',
    code: ['sfx.rayCharge(0);'] },
  { key: 'bossPlate', label: 'one plate tears off', group: 'TAKES · the warp leech', status: 'take',
    file: 'boss-plate.mp3', trim: 0.6,
    where: '12-sfx.js:226 · six plays, pitched down the dyingN ladder',
    brief: 'ONE file played six times at 1.20 down to 0.85 — that spread is the effect',
    code: ['for (let i = 0; i < 6; i++) setTimeout(() => sfx.bossPlate(i, i % 2 ? 0.5 : -0.5), i * 320);'] },
  { key: 'bossArrive', label: 'the warp leech surfaces', group: 'TAKES · the warp leech', status: 'take',
    file: 'boss-arrival.mp3', trim: 1.0,
    where: '12-sfx.js:277 · fires from spawnBoss',
    brief: 'WARP LEECH ONLINE — a 9.08s BED, faded out over the duel’s first beat',
    code: ['sfx.bossArrive(4, 1.2);'] },
  { key: 'bossDead', label: 'the implosion', group: 'TAKES · the warp leech', status: 'take',
    file: 'boss-dead.mp3', trim: 0.85,
    where: '12-sfx.js:283 · started 1.43s EARLY so its blast lands on the implosion',
    brief: 'the ceremonial loudest thing in the game — BOSS_DEAD_IMPACT is its 1.43s figure',
    code: ['sfx.bossDeadTake();'] },
  { key: 'warpIn', label: 'the spool-up', group: 'TAKES · the warp', status: 'take',
    file: 'warp-in.mp3', trim: 0.27,
    where: '12-sfx.js · fires 72-tick.js:507',
    brief: 'a BED under the boot — it stacks with `startup` on the same beat, ~10 dB down',
    code: ["playSample('warpIn');"] },
  { key: 'inWarp', label: 'the lane bed', group: 'TAKES · the warp', status: 'take',
    file: 'in-warp.mp3', trim: 0.34,
    where: '10-audio.js:243 · LOOPED under the whole run',
    brief: 'loops inside its audible region — a take with a click at the seam is unusable',
    code: ['ambient(true); setTimeout(() => ambient(false), 7000);'] },
  { key: 'exitWarp', label: 'dropping out of warp', group: 'TAKES · the warp', status: 'take',
    file: 'exit-warp.mp3', trim: 0.30,
    where: '12-sfx.js:294 · the win sting rises through it at EXIT_STING',
    brief: 'a BED for the verdict, not the verdict — WARP_COLLAPSE.at is its 0.44s swell',
    code: ['sfx.arrive();'] },
  { key: 'startup', label: 'the boot sequence', group: 'TAKES · the warp', status: 'take',
    file: 'startup1.mp3', trim: 0.9,
    where: '12-sfx.js · fires 72-tick.js:509',
    brief: 'cut at 2s — the ring locking in. The boot’s synth cues hide behind it',
    code: ["playSample('startup');"] },
  { key: 'win', label: 'the victory sting', group: 'TAKES · the verdict', status: 'take',
    file: 'win.mp3', trim: 1.0,
    where: '12-sfx.js:302 · scheduled inside the exit-warp drop',
    brief: 'the END card’s star chimes land on top of it',
    code: ['sfx.win();'] },
  { key: 'fail', label: 'the run is lost', group: 'TAKES · the verdict', status: 'take',
    file: 'failed.mp3', trim: 0.95,
    where: '12-sfx.js:345',
    brief: 'the raw take true-peaks +0.1 dBFS; the trim is what seats it under 0',
    code: ['sfx.fail();'] }
];

// splash2.mp3 is deliberately NOT on either roster. It has its own player in
// 99-boot.js and it is the boot splash's MASTER CLOCK — SPLASH.dur is trued from
// the decoded take, so a replacement of a different length re-times the whole
// title sequence. Swapping it is a sequence edit, not a cue swap. Ask first.

if (typeof module !== 'undefined' && module.exports) module.exports = { SFX_ROSTER, TAKE_ROSTER };
if (typeof window !== 'undefined') { window.SFX_ROSTER = SFX_ROSTER; window.TAKE_ROSTER = TAKE_ROSTER; }
