'use strict';
// ============================================================================
// WHAT TO GO AND FIND — one brief per replaceable cue.
//
// I could not fetch these myself. Pixabay's public API covers images and videos
// only (their own docs list "Search images" and "Search videos" and nothing else),
// and pixabay.com answers an automated client with a Cloudflare bot check. So this
// is the next best thing: for every cue, what the take has to DO, how long it can
// be, and the search terms that find it.
//
// `terms` are ordered best-first. The soundboard turns each into a one-click
// Pixabay search link on that cue's row, and `npm run sfx:folders` writes them
// into the cue's own drop folder as `_what.txt`.
//
// LENGTH IS A CONSTRAINT, NOT A PREFERENCE. Most of these fire many times a
// minute, on top of a music bed and each other. A take that rings for two seconds
// where the cue needs 0.2s is not a louder version of the right sound — it is a
// drone. Where a figure is exact it is because a game constant depends on it, and
// the note says which.
// ============================================================================
const SFX_SEARCH = {
  // ---------------------------------------------------------- pickups & ring
  shieldUp: { len: '0.3–0.6s', want: 'an energy shell powering up — a rising shimmer that ENDS. Not a pad, not a drone.',
    terms: ['shield activate', 'energy shield up', 'force field on', 'sci fi power up short'] },
  heal: { len: '0.3–0.5s', want: 'a warm two-note confirm. It says REPAIRED, not REWARD — keep it away from a coin chime.',
    terms: ['repair complete', 'system restored', 'positive confirm soft', 'heal sound'] },
  speedUp: { len: '0.4–0.8s', want: 'a rising whoosh with weight behind it. Acceleration, not a laser.',
    terms: ['speed boost', 'acceleration whoosh', 'turbo boost', 'power surge rise'] },
  shieldHit: { len: '0.2–0.4s', want: 'a bright impact ON a shell — glassy and absorbed. It must not read as a hull hit.',
    terms: ['shield hit', 'force field impact', 'energy deflect', 'sci fi block'] },
  count: { len: '0.05–0.15s', want: 'one flat electronic tick, identical every time. It plays three times in a row.',
    terms: ['countdown beep', 'timer tick', 'digital blip short'] },
  padPress1: { len: '0.03–0.08s', want: 'a tiny dry contact tick. The pair needs TWO takes about a fifth apart.',
    terms: ['ui tap soft', 'button click dry', 'touch blip'] },
  padPress2: { len: '0.03–0.08s', want: 'the partner of padPress1, higher. Find both in one pack so they match.',
    terms: ['ui tap soft', 'button click dry', 'touch blip high'] },
  gatePip: { len: '0.05–0.12s', want: 'a soft single pip. It repeats once a second for as long as the lane waits, so it must not ring.',
    terms: ['radar pip', 'sonar blip soft', 'idle beep subtle'] },

  // ---------------------------------------------------------- kills & volley
  x10: { len: '0.3–0.5s', want: 'a two-note rising chime, bright and short. It rides 0.12s behind the kill take.',
    terms: ['power up chime', 'level up short', 'achievement bright', 'bonus chime'] },
  chain: { len: '0.1–0.25s', want: 'a fast electric arc that reads as a JUMP to a second target.',
    terms: ['electric arc', 'chain lightning', 'zap arc short', 'electric spark'] },
  volleyCharge: { len: '0.5s exactly', want: 'a capacitor whine that RISES and stops. The dock lasts half a second and the sound is the timer.',
    terms: ['capacitor charge', 'weapon charge up', 'energy charge short'] },
  volleyBlast: { len: '0.2–0.5s', want: 'a wide bright detonation with air in it. Energy, not a gunshot.',
    terms: ['energy explosion', 'plasma blast', 'sci fi explosion short'] },
  volleyFizzle: { len: '0.1–0.2s', want: 'a downward fizzle — a charge losing its grip. Quiet; it is a non-event.',
    terms: ['power down short', 'fizzle out', 'discharge fail'] },
  pulseMissed: { len: '0.15–0.3s', want: 'a hollow soft miss. Disappointment without harshness — the player already lost the shot.',
    terms: ['error soft', 'whiff miss', 'negative blip gentle'] },
  armorThump: { len: '0.15–0.3s', want: 'a low metallic thump — mass giving way.',
    terms: ['metal thud', 'heavy impact', 'armor break'] },
  keyChime: { len: '0.1–0.25s', want: 'a clean keyed chime — a lock releasing.',
    terms: ['unlock chime', 'key confirm', 'digital lock open'] },

  // ------------------------------------------------------------ lane hazards
  latchWarn: { len: '0.25s', want: 'a dry double tick with static behind it. A WARNING, not an alarm — it fires often.',
    terms: ['static burst short', 'warning tick', 'radio interference', 'glitch blip'] },
  railLatched: { len: '0.3s', want: 'a heavy clamp closing on metal, with a low sweep under it.',
    terms: ['metal clamp', 'heavy lock', 'mechanism latch', 'industrial clank'] },

  // -------------------------------------------------------------- warp leech
  leechHit: { len: '0.35–0.6s', want: 'a deep sub-heavy impact into a machine. This is the ONLY thing that wounds the boss — it must feel like damage.',
    terms: ['deep impact bass', 'mech hit heavy', 'sci fi impact deep', 'bass hit'] },
  wrongKey: { len: '0.15s', want: 'a short fizzle. Corrective, never punishing — a misread costs a shot, not the turn.',
    terms: ['error soft short', 'deny blip', 'wrong buzz gentle'] },
  lampCall: { len: '0.12s', want: 'a single clean tone that still reads when pitched two ways (520 Hz and 660 Hz).',
    terms: ['ui tone soft', 'notification blip', 'marimba single note'] },
  lastStand: { len: '0.5s', want: 'a low drop with a big noise burst over it. The machine commits everything.',
    terms: ['sci fi alarm dark', 'threat riser', 'power surge dark', 'danger stinger'] },
  shedLayer: { len: '0.5s', want: 'metal shearing off — a whole stage falling away.',
    terms: ['metal tear', 'armor break heavy', 'debris shed', 'mechanical rip'] },
  sweepReversed: { len: '0.2s', want: 'a short bend downward — a direction change you hear before you see it.',
    terms: ['reverse whoosh short', 'servo turn', 'pitch bend down'] },
  bossCalm: { len: '0.2s', want: 'a flat electronic double blip. All clear, no celebration.',
    terms: ['ui double beep', 'system idle', 'all clear tone'] },
  laneSecured: { len: '0.35s', want: 'a two-note rising confirm, brief and clean. It fires every wave, so it cannot be a fanfare.',
    terms: ['success chime short', 'confirm two note', 'objective complete short'] },
  bossDown: { len: '1.5–3s', want: 'a broadband blast into a long sub tail. FALLBACK ONLY — boss-dead.mp3 covers this unless it fails to decode.',
    terms: ['huge explosion', 'sci fi explosion deep', 'implosion'] },

  // --------------------------------------------------------------- END card
  star: { len: '0.2s', want: 'a bright pop that survives being pitched UP a ladder — ONE take plays stars 1, 2 and 3, so it must not carry a strong pitch of its own.',
    terms: ['star chime', 'bell pop bright', 'reward ding short'] },
  starsFull2: { len: '0.4–0.6s', want: 'a rising fifth, confirmed. The TWO-star verdict — good, not perfect.',
    terms: ['success short', 'confirm rise', 'level complete modest'] },
  starsFull3: { len: '0.5–0.8s', want: 'a short arpeggio into a held bright note. Full marks — the biggest thing on the card.',
    terms: ['success fanfare short', 'level complete', 'reward arpeggio', 'achievement unlocked'] },
  newBest: { len: '0.3–0.5s', want: 'a stamp: a bright ping over a low body. It lands ONCE, on the badge.',
    terms: ['stamp impact', 'achievement ping', 'record set', 'seal stamp'] },
  unlock: { len: '0.3s', want: 'two soft rising notes — a key turning, not a fanfare.',
    terms: ['unlock', 'key turn', 'access granted soft'] },
  traced: { len: '0.3s', want: 'a rising three-note resolve. It ends the ribbon drone, so it must sit on top of a 880 Hz tone.',
    terms: ['collect complete', 'sparkle rise short', 'bonus collected'] },

  // -------------------------------------------------------- menus & the boot
  ui: { len: '0.03–0.08s', want: 'a crisp DRY tick with a tiny body. This is every press on every screen — hundreds a session. Nothing tonal, nothing that rings, nothing anyone could tire of.',
    terms: ['ui click', 'menu tap', 'button click subtle', 'interface tick'] },
  menuLaunch: { len: '0.45s', want: 'a low thump with an upward tail — a screen departing, under the UI tick.',
    terms: ['ui whoosh deep', 'transition thump', 'sub drop short', 'menu swoosh'] },
  bootGodspeed: { len: '0.6s', want: 'radio squelch, two short acks, a low engage. Command hands the lane over.',
    terms: ['radio squelch', 'comm beep', 'transmission start', 'walkie talkie click'] },
  bootLock: { len: '~1.2s', want: 'FALLBACK ONLY — startup1.mp3 covers this. A low lock with accelerating ticks.',
    terms: ['machine startup', 'power lock', 'sci fi boot'] },
  bootDock: { len: '0.7s', want: 'FALLBACK ONLY — startup1.mp3 covers this. A thump with everything charging behind it.',
    terms: ['machine dock', 'power up thump', 'system charge'] },
  bootSignoff: { len: '0.3s', want: 'FALLBACK ONLY — the reboot take (restart.wav) covers this. Flat sign-off clicks.',
    terms: ['relay click', 'switch click', 'terminal beep'] },

  // --------------------------------------------- transitions & the course
  transWarp: { len: '0.6–0.7s', want: 'a MINI WARP: a descending dive, then a bright switch at the halfway point as the next lane opens. The switch must land at 0.30s of 0.62s — that is where the picture cuts.',
    terms: ['warp transition', 'whoosh transition', 'sci fi swoosh', 'teleport short'] },
  transCut: { len: '0.15–0.3s', want: 'a short dry cut. A screen swaps; the player does not travel.',
    terms: ['ui swoosh short', 'transition click', 'digital cut'] },
  qualified: { len: '1.5–2s', want: 'a rising clearance chord. It plays ONCE per player, ever, so it can be the warmest thing in the game.',
    terms: ['achievement unlocked', 'graduation chime', 'success chord rise', 'ceremony'] },
  drillLock: { len: '0.1–0.2s', want: 'a crisp lock-in confirm. It fires per rep, so it cannot be a fanfare.',
    terms: ['lock on', 'target confirm', 'ui confirm short'] },
  tutFreeze: { len: '0.6–1s', want: 'a tape-warp DOWN — everything slowing to a stop. Pairs with tutRelease; find both in one pack.',
    terms: ['tape stop', 'slow down warp', 'power down slow', 'vinyl brake'] },
  tutRelease: { len: '0.4–0.7s', want: 'the tape-warp UP that answers tutFreeze. The pair must obviously be one gesture.',
    terms: ['tape start', 'speed up warp', 'power up slow', 'vinyl spin up'] },
  endCount: { len: 'UNDER 0.05s', want: 'a single tiny tick. It fires every 0.07s for as long as the score counts — anything with a pitch or a tail becomes a machine-gun.',
    terms: ['counter tick', 'ui tick tiny', 'score count blip'] },

  // ------------------------------------------------- the takes, as re-records
  hit: { len: '0.08–0.2s', want: 'a tight digital confirmation that STILL READS when its playback rate is pushed 40% up — the combo pitches this take from x1 to x12.',
    terms: ['laser hit', 'digital zap short', 'sci fi impact short', 'blaster hit'] },
  miss: { len: '0.2–0.35s', want: 'a dull thud with a terse alarm blip. Bad news without harshness.',
    terms: ['error thud', 'alarm blip short', 'negative impact'] },
  miss2: { len: '0.2–0.35s', want: 'the SIBLING of miss — clearly a different take, obviously the same family. They alternate; replace them together or not at all.',
    terms: ['error thud', 'alarm blip short', 'negative impact'] },
  pick: { len: '0.25–0.45s', want: 'a quick ascending sparkle, three notes or fewer. Three other cues ride 0.12s behind it, so it must clear out fast.',
    terms: ['power up collect', 'pickup sparkle', 'item collect short'] },
  pulse: { len: '0.5–0.8s', want: 'a sub drop under a rising pressure sweep. The biggest offensive thing the player owns.',
    terms: ['emp blast', 'shockwave', 'energy pulse blast', 'sci fi boom'] },
  pulseArm: { len: '0.3–0.5s', want: 'a coil topping out, then an octave snap. It must NOT sound like heal() — this says ARMED, not repaired.',
    terms: ['weapon ready', 'charge complete', 'power up ready', 'energy armed'] },
  volley: { len: '0.3–0.5s', want: 'a capacitor snap into a discharge with a sub kick under it.',
    terms: ['laser cannon', 'energy shot heavy', 'plasma fire', 'railgun'] },
  shutdown: { len: '0.4–0.7s', want: 'electricity dying in a coil — a crackle collapsing into nothing.',
    terms: ['power down electric', 'short circuit', 'electricity die', 'system failure'] },
  restart: { len: '0.6–1.0s', want: 'a machine spooling back up — a whir with a thump in it. It also carries the boot ramp.',
    terms: ['machine reboot', 'system startup', 'power up whir', 'engine spool'] },
  sonar: { len: 'UNDER 0.20s — hard limit', want: 'ONE short soft ping that does NOT ring. It fires per interdictor for the whole run; the 0.26s rate cap only works because the take ends before the next one starts.',
    terms: ['sonar ping short', 'radar blip', 'submarine ping'] },
  rayCharge: { len: '~1.2s', want: 'a build that PEAKS and lets go. WARNING: the release point IS the game constant BEAM_BURST — tell me the new figure or the light stops launching on the release.',
    terms: ['laser charge up', 'energy charge deep', 'weapon windup', 'beam charge'] },
  bossPlate: { len: '0.8–1.3s', want: 'one blast that still reads pitched from 1.20 down to 0.85 — it is played six times down that ladder. Cut the reverb tail short or six of them are mush.',
    terms: ['metal explosion', 'debris impact', 'hull breach', 'armor explosion'] },
  bossArrive: { len: '8–10s', want: 'a swelling BED. Arrival and dread, no transient — it is faded out over the duel’s first beat and never heard to its end.',
    terms: ['sci fi drone rise', 'dark riser long', 'ominous swell', 'boss arrival'] },
  bossDead: { len: '~5s', want: 'a build that BLASTS at about 1.4s and rings out by 4s. It starts EARLY so the blast lands on the implosion — tell me the new blast time.',
    terms: ['huge explosion', 'building explosion', 'implosion deep', 'destruction'] },
  warpIn: { len: '~2.4s', want: 'a spool-up that climbs and then PLATEAUS. It is a bed under the boot, ~10 dB below the other cues.',
    terms: ['warp jump', 'hyperspace enter', 'engine spool up', 'sci fi launch'] },
  inWarp: { len: '8–10s', want: 'an engine bed that LOOPS SEAMLESSLY. It plays for the whole run — a click at the seam makes it unusable.',
    terms: ['spaceship engine loop', 'warp drive loop', 'sci fi ambience loop'] },
  exitWarp: { len: '~5s', want: 'a drop out of warp that swells over its first 0.44s. The win sting rises inside it at 2.2s.',
    terms: ['hyperspace exit', 'warp drop out', 'sci fi deceleration'] },
  startup: { len: '~2s', want: 'a boot sequence — power finding its lock.',
    terms: ['computer startup', 'sci fi boot up', 'system online', 'machine power on'] },
  win: { len: '1.5–2.5s', want: 'a rising fanfare into a held bright chord. It plays INSIDE the exit-warp drop, so it must cut through a bed.',
    terms: ['victory fanfare', 'level complete', 'success orchestral short'] },
  fail: { len: '1–2s', want: 'a descending failure. The run is lost — final, not cruel.',
    terms: ['game over', 'fail descending', 'defeat sound', 'power down sad'] }
};
// the one-click search the board puts on each row
const SFX_SEARCH_URL = t => 'https://pixabay.com/sound-effects/search/' + encodeURIComponent(t) + '/';

if (typeof module !== 'undefined' && module.exports) module.exports = { SFX_SEARCH, SFX_SEARCH_URL };
if (typeof window !== 'undefined') { window.SFX_SEARCH = SFX_SEARCH; window.SFX_SEARCH_URL = SFX_SEARCH_URL; }
