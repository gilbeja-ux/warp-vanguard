'use strict';
// ---------- THE STORE SCENE REGISTRY (2026-09-21 set) ----------
// One named recipe per store frame. Every string here runs in the GAME's global
// scope through CDP, so it reads and writes the game's top-level `let`s by bare
// name. Fields, all optional:
//
//   n        carousel position, the file prefix
//   what     one line for --list
//   progress extra fields merged into the seeded save's `progress`
//   setup    ctx => JS. Runs at the home menu. Starts the level or opens the screen.
//   warm     frames of REAL play under the autopilot before anything is staged
//   stage    ctx => JS. Places the roster. Bodies come from the game's own spawners.
//   hold     frames after staging, under `auto`
//   auto     'off' (hands off the carriages) | 'play' | 'dock' | 'duel'
//   arm      ctx => JS. The thing with a fuse on it, lit last.
//   want     JS predicate. The first frame it is true is THE frame.
//   scan     frames to keep asking (default 600)
//   finish   JS on the chosen frame: clears TIMED overlays only, never the lane
//   settle   real ms before the last repaint (an Image decode)
//
// STAGE NUMBERS are display numbers (CLAUDE.md): the comments here say stage 07
// for levelIdx 6. A recipe passes levelIdx to startLevel because that is code.

const CLEAR = 'popups = []; commCur = null; commT = 0;';
// a run in live play with no launch ceremony, part way down its lane
const PLAY = (ci, li, frac) => `
  switchCampaign(${ci}); startLevel(${li}, false); introT = 999; introCd = 0; state = S.PLAY;`;
// both carriages alive and the lane underway before a scene stages itself
const READY = frac => `
  for (const n of nodes) { n.deadT = 0; n.recoil = 0; n.slew = null; }
  ${CLEAR}
  const _L = LV || LEVELS[levelIdx];
  if (_L && _L.duration) { levelT = _L.duration * ${frac}; lanePlanetProg = Math.max(lanePlanetProg, ${frac}); }
  enemies = enemies.filter(() => false); sched.length = 0;
  spawnT = 999; ribbonT = 999; patternQ = []; burstQ = null; latches = [];`;
// place one body: [type, z, bearing, lock]. age past the birth fade.
const PLACE = rows => `
  ${JSON.stringify(rows)}.forEach(([type, z, a, lock]) => {
    if (type === 'line') { const before = enemies.length; spawnLine(a, true); enemies.slice(before).forEach(e => { e.z = e.z0 = z; e.age = 0.9; }); return; }
    const e = spawnEnemy(a, type); e.z = e.z0 = z; e.age = 0.9; if (type === 'normal') e.lock = lock === null ? undefined : lock;
  });`;

const SCENES = {
  // ── 1 · MID RUN: every kind of breach, scattered around the bore ──────────
  midrun: {
    n: '01', what: 'mid run, stage 23, every hull scattered at every depth',
    setup: () => PLAY(2, 6),
    warm: 300,
    stage: () => READY(0.36) + `
      combo = 9; maxCombo = 12; score = 18450;
      pulseCharge = [PULSE_MAX * 0.72, PULSE_MAX];` + PLACE([
['normal', 0.40, 5.45, null], ['normal', 0.52, 2.30, 0], ['heavy', 0.66, 3.95, null],
        ['normal', 0.60, 0.75, 1], ['line', 0.95, 1.45, null], ['normal', 0.84, 4.60, null],
        ['normal', 1.10, 6.05, 1], ['normal', 1.30, 2.95, 0], ['normal', 1.55, 5.0, null] ]) + `
      nodes[0].angle = Math.PI * 0.93; nodes[1].angle = Math.PI * 0.07;`,
    hold: 8, auto: 'off',
    arm: () => `combo = 9; score = 18450;
      const k = spawnEnemy(nodes[0].angle, 'normal'); k.z = k.z0 = geo().hitZ + 0.010; k.lock = undefined; k.age = 1.2;`,
    // combo 10 = the armed kill has LANDED. A bolt alone is not proof: one left over from
    // the warm-up can still be alive here, and the frame then has no discharge in it.
    want: 'bolts.length >= 1 && combo >= 10 && enemies.filter(e => !e.dead).length >= 8',
    scan: 30,
    finish: CLEAR + ' ghosts = [];'
  },

  // ── 2 · THE BOSS: a machine the GAME spawned, with its rays lit ──────────
  // THE DUEL IS PLAYED, NOT ASSEMBLED (docs/STORE-LISTING.md, section 4). The scene
  // moves the level clock to the stage's end and nothing else; 72-tick spawns the
  // machine, the arrival ceremony runs, and the autopilot fights it. The PRISM is
  // stage 24's own boss and the only fight that births two rays at once.
  boss: {
    n: '02', what: 'the boss of stage 24 (the Prism) with both rays lit and its swarm inbound',
    setup: ctx => PLAY(ctx.camp === null ? 2 : ctx.camp, 7),
    warm: 200,
    stage: ctx => `
      ${ctx.kind ? "LV = LV || LEVELS[levelIdx]; LV.bossKind = '" + ctx.kind + "';" : ''}
      for (const n of nodes) { n.deadT = 0; n.recoil = 0; n.slew = null; }
      levelT = (LV || LEVELS[levelIdx]).duration - 0.4;
      enemies = enemies.filter(() => false);
      combo = 17; maxCombo = 21; score = 41750;`,
    hold: 60, auto: 'duel',
    want: `boss && boss.introT >= BOSS_CER && boss.dying === undefined && boss.z < 0.75 && boss.hp <= boss.maxHp - 1 &&
      boss.beams.filter(b => !b.done && (b.liveT || 0) >= BEAM_BURST + 0.5).length >= 2 &&
      nodes.every(n => !(n.deadT > 0))`,
    // a WOUNDED machine: the autopilot banks an orb off the swarm and lands a pulse
    // first, so the PULSES gauge in the frame reads a fight under way, not its start
    scan: 5000,
    finish: CLEAR
  },

  // ── 5 · THE VOLLEY: both emitters docked, the bolt away, the blast landing ─
  volley: {
    n: '05', what: 'a unite-volley: the bolt in flight, or its blast taking a column',
    setup: () => PLAY(2, 6),
    warm: 300,
    stage: () => READY(0.52) + `
      combo = 14; maxCombo = 14; score = 26400;
      pulseCharge = [PULSE_MAX, PULSE_MAX * 0.4];` + PLACE([
        ['normal', 0.78, 2.36, null], ['normal', 0.98, 2.36, null], ['heavy', 1.20, 2.36, null], ['normal', 1.42, 2.36, null],
        ['normal', 0.92, 2.95, null], ['normal', 1.10, 1.80, null], ['normal', 1.30, 3.30, null],
        ['normal', 1.25, 5.30, 1], ['normal', 1.60, 0.40, 0] ]) + `
      nodes[0].angle = 2.30; nodes[1].angle = 2.42; volley.cd = 0; volley.charge = 0;`,
    // 'off', not 'dock': the pair is PLACED docked on the column's bearing, and the
    // charge builds while they stay there. The dock autopilot chased the next body
    // the moment the blast landed and the frame showed the emitters somewhere else.
    hold: 0, auto: 'off',
    want: ctx => ctx.variant === 'bolt'
      ? 'volley.shots.length > 0 && volley.shots[0].z > 0.45'
      : 'volleyFX.some(w => time - w.t0 > 0.10 && time - w.t0 < 0.30)',
    scan: 240,
    // seven kill popups land on one spot in one frame and read as a pile. The BLAST
    // line is the one that names what happened; it stays.
    finish: "popups = popups.filter(p => /BLAST/.test(p.text)); commCur = null; commT = 0;"
  },

  // ── 3 · THE CONTRACTS ─────────────────────────────────────────────────────
  contracts: {
    n: '03', what: 'the contract carousel, centred on THE SURVEY',
    setup: () => `menuScreen = 'camps'; menuFx = null; campScroll = campScrollTgt = discOfCamp(1); campPendingSync = null;`,
    hold: 150, settle: 500
  },

  // ── 4 · THE STAGES ────────────────────────────────────────────────────────
  stages: {
    n: '04', what: 'the star map and stage list of THE SURVEY, stage 13 selected',
    setup: ctx => `switchCampaign(${ctx.camp === null ? 1 : ctx.camp}); menuScreen = 'map'; menuFx = null; mapSel = ${ctx.sel === null ? 4 : ctx.sel}; mapCamSnap = true;`,
    // the lens RIDES the lane, about 6 s each way, and dwells at each end. Frame 345 is
    // inside the dwell at the DESTINATION, with the camera's own easing settled.
    hold: 345, want: 'mapRideK >= 0.999', scan: 120, settle: 500
  },

  // ── 6 · THE MAIN MENU ─────────────────────────────────────────────────────
  home: {
    n: '06', what: 'the home menu: the mode wheel and the hub badge',
    setup: () => `menuScreen = 'home'; menuFx = null;`,
    hold: 180, settle: 500
  },

  // ── THE FEATURE GRAPHIC'S PLATE ───────────────────────────────────────────
  // Not a carousel frame: the bare bore, every piece of chrome stubbed IN THE PAGE
  // (src/ never learns marketing exists), for scripts/shot-feature.html to build the
  // 1024x500 banner on. Bearings are chosen against the BANNER's crop: the plate's
  // centre lands at 70% width, so bodies sit low and left of centre or they fall off.
  feature: {
    n: '00', what: 'the bare bore plate for the 1024x500 feature graphic (Play size only)', only: 'play',
    setup: () => PLAY(2, 6),
    warm: 300,
    stage: () => READY(0.34) + `
      drawHUD = () => {}; drawDials = () => {}; drawWarpCal = () => {}; drawIntroCard = () => {}; drawNowPlaying = () => {}; drawPulseOrbs = () => {};` + PLACE([
        ['normal', 0.72, 0.30, null], ['heavy', 0.78, 2.55, null], ['normal', 1.05, 3.30, 0], ['normal', 1.35, 1.90, 1] ]) + `
      nodes[0].angle = Math.PI * 1.18; nodes[1].angle = Math.PI * 0.16;`,
    hold: 12, auto: 'off',
    finish: CLEAR + ' ghosts = [];'
  },
};

module.exports = { SCENES };
