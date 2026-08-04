'use strict';
// ---------- game state ----------
const S = { MENU: 0, PLAY: 1, END: 2, PAUSE: 3, INFO: 4, GUIDE: 5 }; // INFO: frozen behind a briefing card · GUIDE: the Archive field manual
let state = S.MENU;
let levelIdx = 0, levelT = 0, spawnT = 0;
let integrity = 100, score = 0, zaps = 0, misses = 0, combo = 0, perfects = 0, fragsHit = 0;
let maxCombo = 0; // longest streak this run — a leaderboard display stat + tiebreaker
let comboStartT = 0, maxComboStart = 0, maxComboSec = 0; // duration the record streak held — a replay-panel stat
let simMuted = false; // true during the silent stat pre-run of a replay — gates all sfx
// ---------- run trace (record → verify + replay) ----------
// The single control scheme feeds the sim exactly two continuous inputs — the
// two node angles — plus the thumb-contact bits and discrete pulse fires.
// Recording that per FIXED step makes a run reproducible: the verifier replays
// it headless to recompute the score, and the replay player renders it back.
// We record the RESULT of input (node.angle), so it's independent of how the
// pads produced it. Fires that land between steps attach to the next step.
let traceRec = null;   // frames captured while recording; null = not recording
let tracePlay = null;  // { frames, i } while replaying from a trace; null = live input
let traceFireQ = [];   // pulse-fire node indices seen since the last captured step
// the scoring multiplier climbs 1:1 with the streak up to this cap — the room
// above 5 is headroom for skilled players to keep pulling ahead. Resource
// mechanics (pulse charge, combo-heal) stay pegged at 5 so game balance is
// untouched; only the take grows.
const COMBO_CAP = 10, scoreMul = () => Math.min(combo, COMBO_CAP);
let comboHeal = 0; // zaps banked at max combo — every 5 knit back one integrity block
// pulse charge: each node feeds its OWN orb with the zaps it lands (pick your
// shooter — pick which pulse you bank). A ready orb fires solo on tap: a
// rim-wide wave races down the tunnel with a glowing wake, molecularizing
// every hostile it passes.
const PULSE_MAX = 45;
let pulseCharge = [0, 0], pulseWaves = [];
// unite-volley: dock both nodes on one spot, hold 0.5s to charge, and a
// focused bolt fires straight ahead — the game's third verb: SHOOT
let volley = { charge: 0, cd: 0, shots: [] };
let enemies = [], particles = [], popups = [];
let ghosts = [], ripples = []; // the decompile: de-rezzing bodies + healed-wall washes
let shake = 0, redFlash = 0, tunnelScroll = 0, wallDist = 0, time = 0;
let trafficSpeed = 0.4; // THE shared motion clock: everything on/in the wall moves at this z-speed
const sysRandom = Math.random; // weekly mode swaps in a seeded PRNG for the run
let weekly = false;
// WHICH week is loaded — a Mon–Sun index (see weekOf in 00-core). It is the run's
// seed, its board key, and the thing that decides whether a score can still be
// filed: only the live week accepts one, so a finished board can never move again.
// -1 = no weekly lane loaded.
let weeklyIdx = -1;
// perf watchdog state. perfCalm counts consecutive calm windows toward putting the
// detail back; perfTrips makes each successive relapse harder to recover from, so a
// device that genuinely cannot carry the full look settles instead of oscillating.
let lowFX = false, perfAcc = 0, perfN = 0, perfWin = 0, perfCalm = 0, perfTrips = 0;
let hitStop = 0;              // brief slow-mo after a zap
let rimFX = [];               // reactive rim lighting: {a, t, col}
let resumeHold = 0, resumeDigit = 0; // 3-2-1 after unpausing
// THE WARP DIVE: the fly-IN at the start of a level, not the end. Set to
// WARP_DIVE on entering a lane and decayed to 0 by update(); while it burns, the
// tunnel hots up and every warp streak stretches (see drawStreaks). Nothing in
// it touches scoring — it is pure arrival.
const WARP_DIVE = 0.9;        // seconds of dive; 0 enters the lane already at speed
let warpT = 0;                // live countdown of the above
// LANE FLOW — the master "are we moving" gate over every visual motion source
// (wall bands, hoops, warp lines, gas, deep parallax). Menus sit PARKED in open
// space: the warp begins only when a run does, and the end ceremony brakes the
// lane to a standstill — a win coasts through the destination's arrival swell
// before it stops; a collapsed lane halts hard. Purely visual: enemy z-motion
// is sim-side and never touches this.
let laneFlow = 0;
// RUN VISIBILITY. laneExit() only covers the campaign-WIN arrival, and laneFlow
// only stops the motion — so leaving a run by any other path (a loss, a quit,
// dismissing the report) left the lane's entities frozen on screen behind the
// menu: interdictor plates, their glows, ghosts and pickups sitting under the
// contract carousel as residue. This fades everything the RUN owns once we are
// back in the menu, and the arrays are cleared at the end of the fade so nothing
// lingers off-screen either.
let runVis = 1;
let musicDuck = 0;            // music dips under the end ceremony
let fadeT = 0;                // universal screen-stitch fade
const BOOT_LOCK = 1.5;        // the ring rides the tunnel in and docks at this moment
const BOOT_ON = 2.1;          // nodes AND consoles finish their power ramp together here
const INTRO_GATE = 2.4;       // systems online; the last beat before control transfers
const INTRO_DUR = 2.9;        // boot: (thumbs) -> LOCK -> POWER-UP -> CONTROLS ACTIVE
let introStage = -1;          // last boot stage that fired its sounds
let bootSample = false;       // the startup take carries the boot — synth layers stand down
let bootNodeSample = false;   // the node whir carries the power ramp — ditto
let padHold = [false, false]; // live thumb contact per pad side
let introLatch = false;       // LAUNCHED: both thumbs seen, the ceremony clock is running
let gatePip = 0;              // standby blip metronome while awaiting the operator
let padArm = [false, false];  // per-pad ack edge while parked — see introStageChange
let introT = 999, introCd = -1;
let preT = 0;                 // seconds parked awaiting the runner — the pre-launch clock
// PRE-LAUNCH: the briefing disc is gone, the ceremony has NOT begun. The ship sits in
// the same slow drift the menu sits in, with the destination dead ahead, and the game
// is waiting for both thumbs before anything happens.
//
// This predicate exists because `introT` is HELD at 0 while parked rather than made
// negative — that keeps the ~20 consumers of introT (the ring fly-in, the console power
// ramp, the boot card, the node reboot) on their existing timings, so the ceremony is
// deferred rather than re-timed. The cost is that introT === 0 no longer means "frame 0
// of the boot", and this is the one thing that can tell those two apart.
const preLaunch = () => !introLatch && introT <= 0
  && (state === S.PLAY || state === S.PAUSE || state === S.INFO);
let tolVis = 1;               // eased hit-arc multiplier (wide-arc grows/shrinks smoothly)
let bolts = [];               // lightning arcs (node → trap)
const fx = { wide: 0, auto: 0, chain: 0 }; // power-up effect timers (seconds)
let shieldCharge = 0; // firewall shield: 1 = the next breach is absorbed
let shieldFlashT = 0; // absorb animation clock: the sheath drains into the hit
let shieldHitA = 0;   // where the caught breach struck (the drain's focal angle)
let shieldUpT = 0;    // charge-in animation clock: the glow spreads from the pickup
let shieldUpA = 0;    // where the shield pickup was caught (the spread's origin)
// dev hook: open the game with ?shield to keep the firewall shield armed —
// it re-arms itself after every catch, for effect testing
const DEV_SHIELD = typeof location !== 'undefined' && /[?&]shield/.test(location.search);
let killStreaks = []; // kill streaks: reprogrammed packets tracing home
let pickups = [], pickupT = 20;
let ribbonT = 30; // bonus ribbon cadence — golden ribbons on levels 5+ / endless
let tut = null;               // tutorial controller (level 1, first run)
let boss = null;              // firewall core (levels with boss: true)
const BOSS_CER = 3.4;         // arrival ceremony length — the core emerges before it fights
let latches = [];             // boss rail clamps: {a, span0, t, dur} — orange arcs that fry a crossing node
// DEAD SUBSYSTEM — the fused ray-cannon duel is disabled ("no fuse, ever": boss.mergeT
// is never raised, beamActive never set). Its input is already removed; the render side
// (drawBeam/beamGeometry/beamHitCore + `fused` branches in drawArcNode & boss draw) is
// slated for a focused removal. beamAim is now written nowhere — kept only so the dead
// render branches still reference a valid value.
let heat = 0, overheat = false, beamActive = false; // ray-cannon duel state (dead)
const beamAim = { x: 0, y: 0 };
const BEAM_S = 5;
let burstQ = null;            // pending burst-volley spawns
let patternQ = [];            // beat-choreographed volley schedule
let endless = false, qual = false, LV = null, runTrack = 0; // active run config + its soundtrack
let infoCard = null, infoShownAt = 0; // briefing card (S.INFO)
let menuScroll = 0, menuPtr = null; // level-list scrolling
let menuScreen = 'home'; // 'home' (mode select) | 'map' (campaign route) | 'flow' (free flow) | 'board' (leaderboard)
let mapListScroll = 0;   // relay column scroll (arc scrollbar rides the rim)
// dedicated leaderboard screen: internal mode/level navigation + async board data
// which board is on screen (mode null = none picked yet). `week` is the Mon–Sun index
// of the selected ladder rung — a board key in its own right, so browsing history is
// just moving this number.
let boardSel = { mode: null, camp: 0, level: 0, week: -1 };
let boardSelRank = 1;      // the entry whose details show on the right
let boardCollapsed = {};   // campId -> true when its level list is folded on the left
let boardFoldV = {};       // campId -> animated fold value 0..1 (eases toward open/closed)
let boardDetailKey = '', boardDetailT = 0; // details count-up: which entry + when it was selected
let boardListScroll = 0;   // middle ring-list scroll (px)
let boardLeftScroll = 0;   // left mode/level-list scroll (px)
let boardRects = { left: null, list: null, ring: null }; // hit regions for drag-scroll routing
let boardData = null;  // { key, loading, rows, error } — the last fetch for boardSel
let boardReqId = 0;    // guards against a stale async response overwriting a newer one
let boardFrom = 'flow'; // the screen to return to on back
let replayLoading = null; // trace_id currently being fetched (spinner + de-dupe)
let replayErr = '';       // transient message when a replay can't be fetched
let menuLbRect = null;  // the LEADERBOARD entry key drawn on the flow/map screens
let mapListSelLast = -1; // snap-to-selection only when the selection moves
let mapSel = 0;          // selected relay on the campaign map
let commNext = 0, commCur = null, commT = 0; // intercepted-transmission ticker
let surgeLevel = 0, surgeCount = -1, surgeWaveZ = -1; // free-run speed surges (announced)
let endWin = false, endStars = 0, endT = 0, endNewBest = false;
let endFxStars = 0, endTickT = 0; // ceremony bookkeeping (star chimes, count ticks)
// post-run sign-in tease: where an unlisted (anonymous) player WOULD rank, and
// whether they've dismissed the offer this run
let endProvisional = null, nameEntryBtns = [];
// When the buttons arrive. A win used to hold them to 2.9s because that is how
// long the old green sweep took to roll to the horizon. The drop is over in under
// a second now, so 2.9 was a second and a half of nothing happening.
const endBtnAt = () => endWin ? 1.9 : 1.25;
// POWER-DOWN. The run is over, so the weapons are over: the energy arcs and the
// pulse orbs banked in them bleed off the ring as the ceremony opens, leaving the
// bare monolith framing the destination. The report is not a moment to be still
// holding a charge you can no longer spend.
const endPower = () => state === S.END ? clamp(1 - (endT - 0.15) / 0.6, 0, 1) : 1;
// DROPPING OUT OF WARP. The whole arrival is ONE event on ONE clock: the lane
// lets go, the warp smears snap back into the stars making them, the shock the
// corridor was holding goes past the camera, and the destination closes the last
// of its distance. Anything on a different clock reads as a sequence of effects
// rather than as a thing happening.
//
//   at    · when it starts, in seconds after the run ends. Enough of a beat for
//           the last kill to land and no more
//   dur   · how long the drop takes. This is the number to move if the arrival
//           feels slow — it drives the lane's departure AND the world's swell
//   brake · how long laneFlow takes to reach 0. It is what collapses every warp
//           line back to a point (see drawStreaks), so it IS the drop-out, and
//           it wants to be shorter than `dur` so the stars stop before the
//           corridor has finished leaving
//   flash · the white bloom at the instant of the drop
//   shock · how long the bow wave takes to cross the frame and go past you
const WARP_COLLAPSE = { at: 0.12, dur: 0.72, brake: 0.40, flash: 0.30, shock: 0.55 };
// …and the other end of it: how long the lane takes to get from a dead stop to full
// warp when a run engages. Matched to warp-in.mp3 (2.44s), which plays on the same
// beat, so the sound and the acceleration are one event. Was 0.5s, which was over
// before the eye had found the motion. Purely visual — see the note in 72-tick.
//
// This is the GENERIC spool, used when a lane starts flowing for any other reason.
// A launch does not use it: it runs the two-part curve below off the ceremony clock,
// because a launch has a threshold to cross and a plain ramp has nothing.
const WARP_SPOOL = 2.4;
// THE LAUNCH: what the drive is holding at while the ring is still riding in (`held`),
// and how long the lane takes to go from there to full warp once the ring DOCKS
// (`jump`). The engines wind up under a lane that is barely moving, and the dock is
// what lets go — so full warp lands at BOOT_LOCK + jump = 2.25s, inside the plateau
// warp-in.mp3 holds from 1.6s to its end. Purely visual, same as WARP_SPOOL.
// `held` is 0.10, not 0.30. The sky's throttle is
// `trafficSpeed * laneFlow + WARP_CRUISE * (1 - laneFlow)` (drawWarpSky), so at 0.30 the
// pre-dock lane ran about 3.4x the menu's station-keeping crawl — which is not a ship
// waiting to be launched, it is a ship already cruising. At 0.10 it is ~1.8x the crawl:
// unmistakably under way, unmistakably not yet in the lane. It also buys the jump a far
// bigger step to take, and there is plenty happening over those 1.5s without it — the
// corridor is being laid, the ring is flying in, the lock-on is counting.
const WARP_LAUNCH = { held: 0.10, jump: 0.75, ease: 2.6 };
// THE CALIBRATION, and the one thing it gates.
//
// A launch does not resolve the lane instantly. The destination is locked on FIRST — a
// progress ring closing around it, 0 to 100% — and only when that reads 100% does the
// corridor itself exist. Until then there is nothing but open space and the world you are
// aiming at, which is what turns the bore's arrival into an event rather than furniture
// that was always on screen.
//
// It SNAPS rather than fades, deliberately: the ring completing is the motivation, and a
// corridor easing into view over a fifth of a second reads as a render glitch next to it.
// (A fade would also have to thread an alpha through the band loop's own per-band
// globalAlpha, which does not compose.)
const WARP_CAL = 0.8;         // seconds of lock-on before the lane resolves
const WARP_CAL_HOLD = 0.24;   // …then the ring holds at 100% and fades, over the arrival
// 0.24, just under HOOP_SPACING (0.28), so at most ONE hoop is ever mid-fade: the corridor
// draws itself in ring by ring instead of two at a time in a smear.
const BORE_EDGE = 0.24;       // the corridor's soft leading edge, in z
// IS THE LANE LIT? 0 = a blueprint, 1 = a powered corridor.
//
// The lane is laid as a DRAWING first — hoops and seams, thin and schematic, no texture and
// no glow. What makes it a lit tunnel is the wall's plasma and the field's luminous sheath,
// and those are what "under power" looks like, so they have no business arriving before the
// warp does. They come up on the DOCK, with the jump, which gives the launch a third act:
// draft the lane, dock onto it, then light it and go.
const LANE_LIT_IN = 0.4;      // seconds for the lit lane to come up over the blueprint
const laneLit = () => {
  if (!(state === S.PLAY || state === S.PAUSE || state === S.INFO) || introT >= INTRO_DUR) return 1;
  if (!introLatch) return 0;
  return clamp((introT - BOOT_LOCK) / LANE_LIT_IN, 0, 1);
};
// HOW FAR DOWN THE LANE THE CORRIDOR HAS BEEN LAID, in z. Z_FLOOR is none of it, past
// SPAWN_Z is all of it.
//
// The corridor is built FROM THE SHIP OUTWARD across the calibration, so the near hoops and
// wall bands arrive first and the far end closes on the destination just as the lock-on
// reads 100%. It replaced a snap, and the reason is staggering: with a snap, the bore, the
// ring's fly-in, the lock-on and the drive all began on one frame, and simultaneous is the
// one thing a sequence must not be. Now each has its own moment inside the same 0.8s.
//
// Menus and the end ceremony are untouched — those painters gate on state themselves.
// It is EASED, and that is not a taste call. A ring's screen radius goes as 1/(1 + 6z), so
// a front advancing linearly in z crosses most of the visible frame in its first fifth and
// then spends the rest adding hoops too small to notice — measured, the frame already read
// as built at 29%. Squaring the ramp holds the front out near the frame edge, gives the
// launch a beat of nothing at all, and then sweeps it in to the destination.
const BORE_EASE = 2.0;
const boreReach = () => {
  if (!(state === S.PLAY || state === S.PAUSE || state === S.INFO) || introT >= WARP_CAL)
    return SPAWN_Z + 1;
  // starts a full soft-edge BELOW the floor, so at the instant of launch there is no
  // corridor at all rather than a hoop already sitting at the frame edge
  const z0 = Z_FLOOR - BORE_EDGE;
  if (!introLatch) return z0;
  return z0 + (SPAWN_Z + 1 - z0) * Math.pow(clamp(introT / WARP_CAL, 0, 1), BORE_EASE);
};
// alpha for a piece of corridor at depth z: full behind the front, out ahead of it
const boreK = (z, reach) => clamp((reach - z) / BORE_EDGE, 0, 1);
// THE LANE LETS GO. Arriving means the corridor is behind you, so on a win it
// leaves: the wall bands, field hoops, seams and sheath all blow outward through
// the frame and fade, and what is left is open space with the destination in it.
// No structure, no wash, no fog — the world is the reward and nothing overlays it.
// (Only a true arrival opens up. A collapsed lane or a failed run is still IN the
// lane, and its report keeps the corridor around it.)
const laneExit = () => state === S.END && endWin && !endless && !qual
  ? clamp((endT - WARP_COLLAPSE.at) / WARP_COLLAPSE.dur, 0, 1) : 0;
// how far the whole corridor has slid past the eye, in z. Accelerating: the lane
// releases slowly and then goes all at once, which is what letting go looks like.
const laneExitZ = () => { const e = laneExit(); return e * e * (SPAWN_Z + 0.3); };
// THE ENTRY DIVE, as the PAINTERS should read it.
//
// warpT is now held at full while a run is parked and through the pre-dock spool, so the
// shove lands on the ring's dock instead of being spent on the wait. But a held dive is
// not a dive HAPPENING, and five painters brighten and stretch off it — the lane
// filaments blazed for as long as the player took to reach for the pads, which is how
// this was caught.
//
// laneFlow is exactly the question they mean to ask: is this corridor energised. Scaling
// by it is a no-op for all of normal play (laneFlow is 1 there), and during the launch it
// turns the dive from a switch into something the acceleration brings up with it.
const laneDive = () => clamp(warpT / 0.9, 0, 1) * laneFlow;
// SECONDS SINCE THE DROP, -1 when idle. It used to be `endSweep`, a z position:
// the front of a green wave rolling from the ring to the horizon. Nothing needs a
// z any more — the wave is gone — but the ceremony still needs a clock that runs
// in a REPLAY as well as a live run, which endT does not. So the variable stayed
// and became what it was really being used as.
let endDropT = -1;
let pauseBtnRect = null, pauseButtonsList = [], pauseSlidersList = [], pauseTogglesList = [];
// pausing OVER the mission disc remembers the disc: resume returns to the
// briefing, never into a run the player hasn't armed yet
let pausedFromInfo = false;
let menuSettings = false, menuGearRect = null, menuSetButtons = [], menuSetPanel = null, menuFsRect = null, menuMutRects = [], menuBackRect = null;
let menuGuideRect = null; // the home screen's ? key — opens the field guide
let guide = null; // FIELD GUIDE (S.GUIDE): open-page state (from + in/out clocks)
// 80s arcade name entry — the ONLY handle surface. There is no operator/account
// panel: the handle is asked for exactly when it's earned, on the END screen when
// a run makes the top-50 cut (prefilled with the last one, so it doubles as the
// rename). Nothing to visit, nothing to maintain.
let nameEntry = null;         // { board } while the high-score card is up, else null
let nameEntryDraft = '';      // current text in the high-score handle field
let nameEntryFx = 0;          // 0..1 entrance ramp for the crescendo-takeover card
// the field input handler just sanitizes + stashes; validity is derived
// synchronously via nameStatus() at draw time (no server round-trip — local UX)
function onEntryInput(v) { nameEntryDraft = sanitizeName(v); }
let menuConfirm = false, menuConfirmBtns = []; // reset-campaign confirmation modal
let menuHold = null;   // long-press charge on the last relay → the CORE duel: { node, t }
let resetHold = null;  // long-press on the ↺ key → reset-campaign confirm: { t, x, y }
let padSelHold = 0;    // gamepad twin: SELECT held on the route map
let resetIconRect = null; // the ↺ key's touch target (padded well past the glyph)
const RESET_HOLD = 0.9;   // seconds of commitment before the confirm opens
let menuBadge = null;  // hub shield draw params, replayed on top of the press FX
let mapLastRowY = 0, mapLastRowH = 0; // last relay row's rect — the reset key mirrors it
const HOLD_BOSS = 3;   // seconds to hold the final relay to drop into the boss fight
const pauseDrag = {};
