'use strict';
// ============================================================================
// THE CANDIDATE MAP — which downloaded sound goes in which cue's folder.
//
// SOURCE: Kenney's audio packs, Creative Commons CC0 (public domain). No
// attribution required, commercial use allowed, so a pick here can ship as-is.
// Six packs, 504 sounds:
//   sci-fi      kenney.nl/assets/sci-fi-sounds      lasers, engines, force fields
//   interface   kenney.nl/assets/interface-sounds   clicks, confirms, errors
//   ui          kenney.nl/assets/ui-audio           clicks, switches, rollovers
//   digital     kenney.nl/assets/digital-audio      zaps, tones, power-ups
//   impact      kenney.nl/assets/impact-sounds      metal, glass, bell, punch
//   jingles     kenney.nl/assets/music-jingles      win/lose stings, 5 timbres
//
// NOT PIXABAY. Their public API covers images and videos only, and pixabay.com
// answers an automated client with a Cloudflare bot check. Kenney publishes
// direct downloads under CC0 and is a better licence for a game that ships.
//
// EVERY CANDIDATE IS CONVERTED TO WAV on the way in. The packs are Ogg Vorbis
// and iOS Safari cannot decode it — an ogg would audition fine in Chrome on the
// board and then be silent on Gil's phone. See scripts/sfx-fetch.js.
//
// ORDER IS MY RECOMMENDATION, BEST FIRST — but sfx-fetch.js re-sorts each list so
// that anything inside the cue's length brief comes before anything that overruns,
// and marks an overrun with a `~`. A trailing comment on an entry says why it is
// last: usually that it is one of Kenney's 5.00s engine beds, which are five real
// seconds of sound and need a cut before they can be a 0.5s cue.
// ============================================================================
const P = {
  scifi: 'sci-fi/Audio/', iface: 'interface/Audio/', ui: 'ui/Audio/',
  dig: 'digital/Audio/', imp: 'impact/Audio/',
  jSteel: 'jingles/Audio/Steel jingles/', jNes: 'jingles/Audio/8-Bit jingles/',
  jPizz: 'jingles/Audio/Pizzicato jingles/', jHit: 'jingles/Audio/Hit jingles/',
  jSax: 'jingles/Audio/Sax jingles/',
  rpg: 'rpg/Audio/', cas: 'casino/Audio/'
};

// A DERIVED CANDIDATE: a slice cut out of a longer take. `from` is a pack path,
// `ss` the start in seconds, `t` the length, `as` the name it lands under.
// This exists because the packs hold radio STATIC as 5-second beds and hold no
// radio EVENT at all — a squelch, a burst, a comm blip. Cutting 0.3s out of the
// bed is the honest way to get one, and it is the same edit I would make by hand.
const cut = (from, ss, t, as) => ({ from, ss, t, as });

// key → [pack-relative paths]. Order is my recommendation, best first.
const CANDIDATES = {
  // ------------------------------------------------------- pickups & the ring
  shieldUp:   [P.scifi + 'forceField_000.ogg', P.scifi + 'forceField_001.ogg', P.scifi + 'forceField_004.ogg',
               P.dig + 'powerUp5.ogg', P.dig + 'powerUp8.ogg', P.dig + 'phaserUp3.ogg'],
  shieldHit:  [P.imp + 'impactBell_heavy_004.ogg', P.iface + 'glass_001.ogg',
               P.iface + 'glass_004.ogg', P.imp + 'impactGlass_light_000.ogg',
               P.imp + 'impactGlass_medium_000.ogg',
               P.scifi + 'forceField_002.ogg'], // 0.96s — a whole shell, not a hit on one
  // _004 deliberately NOT first: x10 owns it, and heal fires many times a run.
  // Two cues at very different rates must never share a take — see 12-sfx.js.
  heal:       [P.iface + 'confirmation_001.ogg', P.iface + 'bong_001.ogg',
               P.iface + 'confirmation_002.ogg', P.dig + 'twoTone1.ogg', P.dig + 'twoTone2.ogg'],
  speedUp:    [P.dig + 'phaserUp1.ogg', P.dig + 'phaserUp3.ogg', P.dig + 'powerUp8.ogg',
               P.dig + 'powerUp12.ogg', P.dig + 'highUp.ogg',
               P.scifi + 'thrusterFire_000.ogg'], // 5.00s bed — needs a cut
  // widened 2026-08-29 — it plays three times in a row, so it must be flat and
  // identical. Anything with a pitch or a ring is wrong here.
  count:      [P.iface + 'tick_004.ogg', P.iface + 'select_007.ogg', P.iface + 'select_008.ogg',
               P.iface + 'toggle_004.ogg', P.iface + 'pluck_001.ogg', P.iface + 'drop_001.ogg',
               P.cas + 'chips-stack-2.ogg', P.iface + 'tick_002.ogg', P.ui + 'switch2.ogg',
               P.iface + 'select_001.ogg'],
  padPress1:  [P.ui + 'click1.ogg', P.ui + 'click3.ogg', P.iface + 'click_001.ogg',
               P.iface + 'click_003.ogg', P.ui + 'switch1.ogg', P.ui + 'mouseclick1.ogg'],
  padPress2:  [P.ui + 'click2.ogg', P.ui + 'click4.ogg', P.iface + 'click_002.ogg',
               P.iface + 'click_004.ogg', P.ui + 'switch3.ogg', P.ui + 'mouserelease1.ogg'],
  gatePip:    [P.iface + 'tick_001.ogg', P.iface + 'tick_002.ogg', P.ui + 'rollover4.ogg',
               P.ui + 'rollover2.ogg', P.iface + 'select_005.ogg'],

  // -------------------------------------------------------- kills & the volley
  x10:        [P.dig + 'pepSound5.ogg', P.dig + 'pepSound1.ogg', P.iface + 'confirmation_004.ogg',
               P.dig + 'phaserUp5.ogg', P.jSteel + 'jingles_STEEL00.ogg',
               P.dig + 'zapTwoTone.ogg'], // 1.31s — long for a chime on a kill
  chain:      [P.scifi + 'laserSmall_001.ogg', P.scifi + 'laserRetro_001.ogg',
               P.scifi + 'laserSmall_003.ogg', P.scifi + 'laserRetro_004.ogg',
               P.dig + 'zap1.ogg'], // 1.02s — long for a chain link
  volleyCharge: [P.dig + 'phaserUp2.ogg', P.dig + 'phaserUp4.ogg', P.dig + 'phaserUp6.ogg',
               P.scifi + 'engineCircular_000.ogg', P.dig + 'powerUp3.ogg'],
  // lowFrequency_explosion_001 is LAST here on purpose: leechHit owns it, and a
  // blast that sounds exactly like wounding the boss teaches the wrong thing.
  volleyBlast:[P.scifi + 'explosionCrunch_000.ogg', P.scifi + 'explosionCrunch_002.ogg',
               P.imp + 'impactMetal_heavy_000.ogg', P.scifi + 'laserLarge_002.ogg',
               P.scifi + 'lowFrequency_explosion_001.ogg'],
  volleyFizzle: [P.dig + 'phaserDown1.ogg', P.dig + 'phaserDown3.ogg', P.dig + 'lowDown.ogg',
               P.iface + 'error_001.ogg', P.dig + 'highDown.ogg'],
  pulseMissed:[P.iface + 'error_002.ogg', P.iface + 'error_004.ogg', P.dig + 'lowDown.ogg',
               P.iface + 'question_001.ogg', P.dig + 'lowRandom.ogg'],
  // widened 2026-08-29 — Gil kept a pick here but asked for more beside it
  armorThump: [P.imp + 'impactMetal_heavy_000.ogg', P.imp + 'impactMetal_heavy_002.ogg',
               P.imp + 'impactMetal_light_000.ogg', P.imp + 'impactTin_medium_000.ogg',
               P.imp + 'impactPlank_medium_000.ogg', P.rpg + 'metalClick.ogg',
               P.imp + 'impactPlate_heavy_000.ogg', P.scifi + 'impactMetal_000.ogg',
               P.imp + 'impactPunch_heavy_000.ogg'],
  // widened 2026-08-29 — Gil asked for more options. The first list had nothing
  // under 0.25s; these are real latches and short bright ticks.
  keyChime:   [P.rpg + 'metalLatch.ogg', P.iface + 'toggle_001.ogg', P.iface + 'pluck_001.ogg',
               P.iface + 'drop_001.ogg', P.iface + 'pluck_002.ogg', P.cas + 'chip-lay-1.ogg',
               P.iface + 'glass_002.ogg', P.iface + 'select_007.ogg', P.rpg + 'metalClick.ogg',
               P.iface + 'confirmation_003.ogg'],

  // ------------------------------------------------------------- lane hazards
  // widened 2026-08-29. The pack glitches are 0.02s — too small to read as a
  // warning — and the static is a 5s bed. The cuts are the missing middle.
  latchWarn:  [cut(P.scifi + 'computerNoise_000.ogg', 0.4, 0.28, 'static-burst-a'),
               cut(P.scifi + 'computerNoise_002.ogg', 1.2, 0.30, 'static-burst-b'),
               P.iface + 'scratch_004.ogg', P.iface + 'scratch_001.ogg',
               P.iface + 'scratch_003.ogg', P.iface + 'question_002.ogg',
               cut(P.scifi + 'computerNoise_001.ogg', 2.1, 0.26, 'static-burst-c'),
               P.iface + 'glitch_001.ogg', P.iface + 'glitch_004.ogg'],
  railLatched:[P.scifi + 'doorClose_000.ogg', P.scifi + 'doorClose_002.ogg',
               P.imp + 'impactMetal_heavy_003.ogg', P.imp + 'impactPlate_heavy_002.ogg',
               P.imp + 'impactMining_000.ogg'],

  // --------------------------------------------------------------- warp leech
  leechHit:   [P.scifi + 'lowFrequency_explosion_001.ogg', P.imp + 'impactPunch_heavy_000.ogg',
               P.imp + 'impactPunch_heavy_002.ogg', P.scifi + 'explosionCrunch_003.ogg',
               P.imp + 'impactMetal_heavy_004.ogg'],
  wrongKey:   [P.iface + 'error_004.ogg', P.iface + 'error_008.ogg', P.iface + 'error_001.ogg',
               P.iface + 'error_002.ogg', P.iface + 'error_007.ogg'],
  lampCall:   [P.dig + 'pepSound2.ogg', P.iface + 'bong_001.ogg', P.iface + 'glass_002.ogg',
               P.iface + 'select_002.ogg', P.dig + 'tone1.ogg'],
  lastStand:  [P.scifi + 'explosionCrunch_004.ogg', P.dig + 'phaserDown2.ogg',
               P.scifi + 'spaceEngineLow_000.ogg', P.dig + 'lowThreeTone.ogg',
               P.scifi + 'lowFrequency_explosion_000.ogg'],
  shedLayer:  [P.scifi + 'impactMetal_003.ogg', P.scifi + 'impactMetal_004.ogg',
               P.imp + 'impactPlate_heavy_003.ogg', P.imp + 'impactPlate_heavy_004.ogg',
               P.scifi + 'explosionCrunch_001.ogg'],
  sweepReversed: [P.dig + 'phaserDown3.ogg', P.dig + 'highDown.ogg', P.scifi + 'laserRetro_003.ogg',
               P.dig + 'lowDown.ogg', P.iface + 'minimize_003.ogg'],
  bossCalm:   [P.dig + 'twoTone2.ogg', P.iface + 'select_001.ogg', P.iface + 'select_004.ogg',
               P.dig + 'pepSound4.ogg', P.iface + 'toggle_002.ogg'],
  // likewise: _003, not _004. It fires every wave.
  laneSecured:[P.iface + 'confirmation_003.ogg', P.iface + 'confirmation_001.ogg',
               P.dig + 'twoTone1.ogg', P.jSteel + 'jingles_STEEL03.ogg',
               P.jPizz + 'jingles_PIZZI03.ogg'],
  bossDown:   [P.scifi + 'lowFrequency_explosion_000.ogg', P.scifi + 'explosionCrunch_004.ogg',
               P.scifi + 'lowFrequency_explosion_001.ogg'],

  // ----------------------------------------------------------------- END card
  // ONE cue, three pitches — see the note on `star` in sfx-roster.js
  star:       [P.iface + 'glass_003.ogg', P.iface + 'glass_005.ogg', P.iface + 'glass_002.ogg',
               P.imp + 'impactBell_heavy_004.ogg', P.iface + 'glass_006.ogg',
               P.imp + 'impactBell_heavy_002.ogg'],
  starsFull2: [P.jSteel + 'jingles_STEEL04.ogg', P.jPizz + 'jingles_PIZZI04.ogg',
               P.iface + 'confirmation_002.ogg', P.dig + 'threeTone2.ogg', P.jNes + 'jingles_NES04.ogg'],
  starsFull3: [P.jSteel + 'jingles_STEEL07.ogg', P.jNes + 'jingles_NES07.ogg',
               P.jPizz + 'jingles_PIZZI07.ogg', P.jHit + 'jingles_HIT07.ogg',
               P.jSteel + 'jingles_STEEL11.ogg'],
  newBest:    [P.imp + 'impactBell_heavy_003.ogg', P.jSteel + 'jingles_STEEL10.ogg',
               P.iface + 'glass_006.ogg', P.jHit + 'jingles_HIT10.ogg', P.dig + 'pepSound1.ogg'],
  unlock:     [P.scifi + 'doorOpen_000.ogg', P.scifi + 'doorOpen_002.ogg', P.iface + 'toggle_001.ogg',
               P.dig + 'twoTone1.ogg', P.iface + 'open_001.ogg'],
  traced:     [P.dig + 'zapThreeToneUp.ogg', P.dig + 'threeTone1.ogg', P.dig + 'pepSound2.ogg',
               P.jPizz + 'jingles_PIZZI02.ogg', P.iface + 'maximize_004.ogg'],

  // ------------------------------------------------------- menus & the boot
  // THE MENU PRESS gets the most candidates: it is the sound Gil raised, and it
  // fires more often than anything else in the game.
  ui:         [P.ui + 'click1.ogg', P.ui + 'click2.ogg', P.ui + 'click3.ogg', P.ui + 'click5.ogg',
               P.iface + 'click_001.ogg', P.iface + 'click_005.ogg', P.ui + 'mouseclick1.ogg',
               P.ui + 'switch11.ogg', P.ui + 'switch22.ogg', P.iface + 'tick_002.ogg'],
  menuLaunch: [P.iface + 'maximize_001.ogg', P.iface + 'maximize_003.ogg', P.scifi + 'doorOpen_001.ogg',
               P.dig + 'phaserUp5.ogg', P.iface + 'open_001.ogg'],
  // widened 2026-08-29 to Gil's own brief: "radio communication, crackle sound,
  // message notification digital". No pack holds a squelch, so the first three are
  // cut out of the radio-static beds — that IS the crackle. The rest are the
  // notification half of the ask.
  bootGodspeed: [cut(P.scifi + 'computerNoise_003.ogg', 0.2, 0.42, 'squelch-open'),
               cut(P.scifi + 'computerNoise_000.ogg', 3.1, 0.55, 'comm-crackle'),
               cut(P.scifi + 'computerNoise_001.ogg', 1.5, 0.38, 'radio-burst'),
               P.dig + 'pepSound1.ogg', P.dig + 'pepSound4.ogg', P.dig + 'pepSound3.ogg',
               P.iface + 'select_003.ogg', P.iface + 'switch_003.ogg',
               P.iface + 'glitch_002.ogg'],
  bootLock:   [P.dig + 'powerUp1.ogg', P.dig + 'powerUp3.ogg', P.dig + 'powerUp12.ogg',
               P.scifi + 'engineCircular_002.ogg'], // 5.00s bed
  bootDock:   [P.dig + 'powerUp10.ogg', P.imp + 'impactPlate_heavy_001.ogg',
               P.dig + 'powerUp6.ogg', P.scifi + 'engineCircular_003.ogg'], // 5.00s bed
  bootSignoff:[P.iface + 'switch_001.ogg', P.iface + 'tick_004.ogg', P.ui + 'switch15.ogg'],

  // ------------------------------------------- transitions & the course
  transWarp:  [P.dig + 'phaserDown2.ogg', P.iface + 'maximize_003.ogg', P.scifi + 'doorOpen_001.ogg',
               P.dig + 'phaserUp5.ogg', P.iface + 'maximize_001.ogg', P.dig + 'phaserDown1.ogg',
               P.scifi + 'laserRetro_004.ogg'],
  transCut:   [P.iface + 'close_001.ogg', P.iface + 'open_001.ogg', P.iface + 'scratch_003.ogg',
               P.iface + 'minimize_003.ogg', P.iface + 'glitch_002.ogg'],
  qualified:  [P.jSteel + 'jingles_STEEL11.ogg', P.jPizz + 'jingles_PIZZI11.ogg',
               P.jNes + 'jingles_NES11.ogg', P.jHit + 'jingles_HIT11.ogg',
               P.jSax + 'jingles_SAX11.ogg'],
  drillLock:  [P.iface + 'toggle_001.ogg', P.iface + 'pluck_001.ogg', P.iface + 'select_007.ogg',
               P.iface + 'drop_001.ogg', P.iface + 'glass_003.ogg'],
  tutFreeze:  [P.dig + 'phaserDown1.ogg', P.dig + 'phaserDown3.ogg', P.dig + 'lowDown.ogg',
               P.dig + 'phaserDown2.ogg', P.dig + 'highDown.ogg'],
  tutRelease: [P.dig + 'phaserUp1.ogg', P.dig + 'phaserUp3.ogg', P.dig + 'highUp.ogg',
               P.dig + 'phaserUp5.ogg', P.dig + 'phaserUp7.ogg'],
  endCount:   [P.iface + 'tick_001.ogg', P.iface + 'tick_002.ogg', P.iface + 'select_001.ogg',
               P.iface + 'select_002.ogg', P.iface + 'select_008.ogg'],

  // ------------------------------------------------ the takes, as re-records
  hit:        [P.scifi + 'laserSmall_000.ogg', P.scifi + 'laserRetro_000.ogg',
               P.scifi + 'laserSmall_003.ogg', P.scifi + 'laserRetro_002.ogg',
               P.scifi + 'laserSmall_002.ogg',
               P.dig + 'laser3.ogg'], // 0.98s — long, but the character is right
  miss:       [P.iface + 'error_007.ogg', P.imp + 'impactSoft_heavy_000.ogg', P.dig + 'lowDown.ogg',
               P.iface + 'error_002.ogg', P.imp + 'impactSoft_medium_000.ogg'],
  miss2:      [P.iface + 'error_008.ogg', P.imp + 'impactSoft_heavy_001.ogg', P.dig + 'lowRandom.ogg',
               P.iface + 'error_004.ogg', P.imp + 'impactSoft_medium_001.ogg'],
  pick:       [P.dig + 'powerUp2.ogg', P.dig + 'powerUp7.ogg', P.dig + 'powerUp11.ogg',
               P.iface + 'maximize_004.ogg', P.dig + 'pepSound3.ogg', P.dig + 'powerUp12.ogg'],
  pulse:      [P.scifi + 'lowFrequency_explosion_000.ogg', P.scifi + 'explosionCrunch_002.ogg',
               P.dig + 'phaserUp7.ogg', P.scifi + 'laserLarge_004.ogg',
               P.scifi + 'lowFrequency_explosion_001.ogg'],
  pulseArm:   [P.dig + 'powerUp4.ogg', P.dig + 'powerUp9.ogg', P.scifi + 'forceField_004.ogg',
               P.dig + 'phaserUp1.ogg', P.dig + 'powerUp1.ogg'],
  volley:     [P.scifi + 'laserLarge_000.ogg', P.scifi + 'laserLarge_001.ogg', P.scifi + 'laserLarge_003.ogg',
               P.dig + 'laser6.ogg', P.dig + 'laser8.ogg'],
  shutdown:   [P.dig + 'phaserDown1.ogg', P.dig + 'phaserDown3.ogg', P.dig + 'phaserDown2.ogg',
               P.dig + 'lowDown.ogg', P.dig + 'powerUp6.ogg',
               P.scifi + 'computerNoise_001.ogg'], // 5.00s bed — needs a cut
  restart:    [P.dig + 'powerUp3.ogg', P.dig + 'powerUp1.ogg', P.dig + 'powerUp12.ogg',
               P.dig + 'powerUp10.ogg', P.dig + 'powerUp11.ogg',
               P.scifi + 'engineCircular_001.ogg'], // 5.00s bed — needs a cut
  sonar:      [P.iface + 'tick_001.ogg', P.ui + 'rollover4.ogg', P.iface + 'select_005.ogg',
               P.ui + 'rollover2.ogg', P.iface + 'tick_002.ogg'],
  rayCharge:  [P.dig + 'powerUp1.ogg', P.dig + 'powerUp3.ogg', P.dig + 'powerUp12.ogg',
               P.dig + 'phaserUp6.ogg',
               P.scifi + 'engineCircular_004.ogg'], // 5.00s bed — cut to the release
  bossPlate:  [P.scifi + 'explosionCrunch_000.ogg', P.scifi + 'explosionCrunch_001.ogg',
               P.scifi + 'explosionCrunch_003.ogg', P.imp + 'impactMetal_heavy_004.ogg',
               P.scifi + 'impactMetal_002.ogg'],
  bossArrive: [P.scifi + 'spaceEngineLarge_002.ogg', P.scifi + 'spaceEngineLarge_004.ogg',
               P.scifi + 'spaceEngineLow_001.ogg', P.scifi + 'spaceEngine_002.ogg',
               P.scifi + 'spaceEngineLow_003.ogg'],
  bossDead:   [P.scifi + 'lowFrequency_explosion_000.ogg', P.scifi + 'explosionCrunch_004.ogg',
               P.scifi + 'lowFrequency_explosion_001.ogg', P.scifi + 'explosionCrunch_003.ogg'],
  warpIn:     [P.scifi + 'thrusterFire_004.ogg', P.scifi + 'spaceEngineLarge_000.ogg',
               P.scifi + 'thrusterFire_001.ogg', P.scifi + 'spaceEngineSmall_003.ogg'],
  inWarp:     [P.scifi + 'spaceEngine_000.ogg', P.scifi + 'spaceEngine_001.ogg',
               P.scifi + 'spaceEngine_003.ogg', P.scifi + 'spaceEngineLow_002.ogg',
               P.scifi + 'spaceEngineLarge_003.ogg'],
  exitWarp:   [P.scifi + 'thrusterFire_001.ogg', P.dig + 'phaserDown2.ogg',
               P.scifi + 'spaceEngineLow_004.ogg', P.scifi + 'thrusterFire_003.ogg'],
  startup:    [P.scifi + 'computerNoise_002.ogg', P.scifi + 'engineCircular_000.ogg',
               P.scifi + 'computerNoise_003.ogg', P.dig + 'powerUp1.ogg'], // beds are RIGHT here — cut to 2s
  win:        [P.jSteel + 'jingles_STEEL09.ogg', P.jNes + 'jingles_NES09.ogg',
               P.jPizz + 'jingles_PIZZI09.ogg', P.jHit + 'jingles_HIT09.ogg',
               P.jSax + 'jingles_SAX09.ogg'],
  fail:       [P.jSteel + 'jingles_STEEL13.ogg', P.jNes + 'jingles_NES13.ogg',
               P.jSax + 'jingles_SAX13.ogg', P.dig + 'lowThreeTone.ogg',
               P.jPizz + 'jingles_PIZZI13.ogg']
};

const PACK_SOURCES = {
  'sci-fi': 'https://kenney.nl/media/pages/assets/sci-fi-sounds/6b296f9ecf-1677589334/kenney_sci-fi-sounds.zip',
  'interface': 'https://kenney.nl/media/pages/assets/interface-sounds/fa43c1dd4d-1677589452/kenney_interface-sounds.zip',
  'ui': 'https://kenney.nl/media/pages/assets/ui-audio/490d233f68-1677590494/kenney_ui-audio.zip',
  'digital': 'https://kenney.nl/media/pages/assets/digital-audio/216eac4753-1677590265/kenney_digital-audio.zip',
  'impact': 'https://kenney.nl/media/pages/assets/impact-sounds/87b4ddecda-1677589768/kenney_impact-sounds.zip',
  'jingles': 'https://kenney.nl/media/pages/assets/music-jingles/f37e530b9e-1677590399/kenney_music-jingles.zip',
  // added 2026-08-29 for the four cues Gil sent back marked "find more options" —
  // the first six packs had almost no short chimes and no radio comms at all
  'rpg': 'https://kenney.nl/media/pages/assets/rpg-audio/8e99002d76-1677590336/kenney_rpg-audio.zip',
  'casino': 'https://kenney.nl/media/pages/assets/casino-audio/2472606a04-1721639069/kenney_casino-audio.zip'
};

if (typeof module !== 'undefined' && module.exports) module.exports = { CANDIDATES, PACK_SOURCES };
