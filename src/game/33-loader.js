'use strict';
// ---------- campaign loader ----------
// every package — bundled today, community-made tomorrow — enters through
// validateCampaign + installCampaign. The validator is the gate that will
// keep future user-made packages inside the rules; keep it strict.
function validateCampaign(p) {
  const errs = [];
  const str = v => typeof v === 'string' && v.length > 0;
  if (!p || typeof p !== 'object') return ['not an object'];
  if (!str(p.id) || !/^[a-z0-9-]{1,32}$/.test(p.id)) errs.push('bad id');
  if (p.format !== 1) errs.push('unknown format version');
  if (!str(p.title) || p.title.length > 40) errs.push('bad title');
  if (!Array.isArray(p.speakers) || p.speakers.some(s => !str(s.id) || !/^\d{1,3},\d{1,3},\d{1,3}$/.test(s.color || ''))) errs.push('bad speakers');
  if (!Array.isArray(p.levels) || !p.levels.length || p.levels.length > 32) { errs.push('bad levels'); return errs; }
  const spk = new Set((p.speakers || []).map(s => s.id));
  p.levels.forEach((l, i) => {
    const tag = 'level ' + (i + 1) + ': ';
    // NO `name` CHECK, because there is no such field. A relay is named by WHERE
    // IT DELIVERS — levelRouteName() reads the destination the chart places for
    // this contract — and that is what the menu, the HUD and the leaderboard all
    // show. Demanding a name here made packages carry a
    // second, competing label that nothing ever read: the bundled contracts sat
    // for months with a corrupt-badge investigation's level names inside a
    // survey campaign, invisible because no screen displays them. A package
    // that still carries one is accepted and ignored, so exported UGC and older
    // packages keep installing.
    if (!(l.duration > 0 && l.duration <= 600)) errs.push(tag + 'bad duration');
    if (!(l.speed > 0 && l.speed <= 2)) errs.push(tag + 'bad speed');
    if (!(l.spawnMin > 0 && l.spawnMax >= l.spawnMin)) errs.push(tag + 'bad spawn window');
    for (const k of ['doubles', 'heavies', 'lines', 'colors', 'frags', 'walls'])
      if (l[k] !== undefined && !(l[k] >= 0 && l[k] <= 1)) errs.push(tag + 'bad ' + k + ' rate');
    // boss finales may pick their intruder; the engine defaults to 'core'
    if (!/^\d{1,3},\d{1,3},\d{1,3}$/.test(l.tint || '')) errs.push(tag + 'bad tint');
    // a mission disc carries ONE plot line. { title, lines[] } is the pre-art
    // shape and still installs, so older packages and exported UGC keep working
    if (l.story && !(str(l.story.line) || (Array.isArray(l.story.lines) && l.story.lines.every(str)))) errs.push(tag + 'bad story card');
    if (l.story && str(l.story.line) && l.story.line.length > 96) errs.push(tag + 'story line too long');
    // disc art: a bundled file name, or a self-contained data URI for UGC
    if (l.art !== undefined && !(str(l.art) && (/^data:image\//.test(l.art) ? l.art.length <= 400000 : /^[\w-]+\.(webp|png|jpg)$/.test(l.art)))) errs.push(tag + 'bad art');
    // author notes: carried with the level, never read by the engine or shown
    if (l.notes !== undefined && !(typeof l.notes === 'string' && l.notes.length <= 4000)) errs.push(tag + 'bad notes');
    if (i === 0 && p.verdict && !(str(p.verdict.title) && Array.isArray(p.verdict.lines) && p.verdict.lines.every(str))) errs.push('bad verdict card');
    // Either delivery, matching the rule for a level's `art` two lines up: a bundled file
    // name (cacheable, lazy, no base64 tax on campaigns.js) or a self-contained data URI
    // for exported/UGC packages. It used to demand the data URI, which forced every
    // bundled campaign to carry its strip as ~33%-inflated base64 parsed at boot.
    // the contract disc's client strip, and the closure disc's own keyframe — same two
    // deliveries as a level's `art`: a bundled file name, or a self-contained data URI
    const artOk = v => str(v) && (/^data:image\//.test(v) ? v.length <= 400000 : /^[\w-]+\.(webp|png|jpg)$/.test(v));
    if (i === 0 && p.art !== undefined && !artOk(p.art)) errs.push('bad campaign art');
    if (i === 0 && p.verdict && p.verdict.art !== undefined && !artOk(p.verdict.art)) errs.push('bad verdict art');
    if (i === 0 && p.map && p.map.image !== undefined
      && !(str(p.map.image) && (/^data:image\//.test(p.map.image)
        ? p.map.image.length <= 400000 : /^[\w-]+\.(webp|png|jpg)$/.test(p.map.image))))
      errs.push('bad map image (data:image URI under 400KB, or a .webp/.png/.jpg file name)');
    if (l.mapPos && !(l.mapPos.x >= 0 && l.mapPos.x <= 1 && l.mapPos.y >= 0 && l.mapPos.y <= 1)) errs.push(tag + 'bad mapPos (0..1)');
    // the leech roster (2026-08: core/triad/spinner/array retired with their fights)
    if (l.bossKind !== undefined && (!l.boss || !['leech', 'siphon', 'prism', 'mimic', 'blockade'].includes(l.bossKind))) errs.push(tag + 'bad bossKind');
    (l.comms || []).forEach(c => {
      if (!(c.t >= 0 && c.t < l.duration) || !spk.has(c.s) || !str(c.m) || c.m.length > 64) errs.push(tag + 'bad comm');
    });
    // beats: hand-placed timeline events (structural checks only — fairness
    // findings are lintCampaign WARNINGS, never rejection grounds)
    const BK = { enemy: 1, wall: 1, strip: 1, pickup: 1, lull: 1 };
    const ET = { normal: 1, heavy: 1, line: 1, lock0: 1, lock1: 1, frag: 1 };
    const PK = { shield: 1, wide: 1, auto: 1, inject: 1, chain: 1, health: 1 }; // mirrors PICKUPS (declared later — TDZ at boot)
    if (l.beats !== undefined && !Array.isArray(l.beats)) errs.push(tag + 'bad beats');
    (Array.isArray(l.beats) ? l.beats : []).forEach(b => {
      if (!b || !BK[b.kind] || !(b.t >= 0 && b.t < l.duration)) { errs.push(tag + 'bad beat'); return; }
      if (b.kind === 'enemy' && !ET[b.type || 'normal']) errs.push(tag + 'bad beat enemy type');
      if (b.kind === 'pickup' && b.type !== undefined && !PK[b.type]) errs.push(tag + 'bad beat pickup type');
      if (b.kind === 'lull' && !(b.dur > 0 && b.t + b.dur <= l.duration)) errs.push(tag + 'bad lull');
      if (b.angle !== undefined && !isFinite(b.angle)) errs.push(tag + 'bad beat angle');
      // force: the author's override — the beat lands EXACTLY as written, no
      // fairness relocation. The linter still judges it (that's the safety net)
      if (b.force !== undefined && typeof b.force !== 'boolean') errs.push(tag + 'bad beat force');
    });
    // bands: only the rate knobs may be mixed — speed/duration stay level-wide
    const MK = { doubles: 1, heavies: 1, lines: 1, colors: 1, frags: 1, walls: 1, crawlers: 1, bursts: 1 };
    if (l.bands !== undefined && !Array.isArray(l.bands)) errs.push(tag + 'bad bands');
    (Array.isArray(l.bands) ? l.bands : []).forEach(b => {
      if (!b || !(b.t0 >= 0 && b.t1 > b.t0 && b.t1 <= l.duration)) { errs.push(tag + 'bad band window'); return; }
      if (b.intensity !== undefined && !(b.intensity > 0 && b.intensity <= 4)) errs.push(tag + 'bad band intensity');
      for (const k of Object.keys(b.mix || {})) {
        if (!MK[k]) errs.push(tag + 'bad band mix key');
        else if (k !== 'bursts' && !(b.mix[k] >= 0 && b.mix[k] <= 1)) errs.push(tag + 'bad band mix ' + k);
      }
    });
  });
  return errs;
}
// advisory fairness pass: one findings array per level. Callers (editor,
// import UI, tests) surface these as WARNINGS — install never rejects on them
function lintCampaign(p) {
  return (p && Array.isArray(p.levels) ? p.levels : []).map((l, i) => lintLevel(l, i));
}
// DETECTED THREATS — the count a mission disc promises. Read off lintWalk, the
// pure draw-for-draw mirror of the live spawner, so it is the number that
// actually arrives rather than an estimate off the spawn window. Cached per
// level: the walk is arithmetic over a 1/60s timeline, cheap but not per-frame.
const THREATN = {};
function levelThreats(L, idx) {
  const key = (CAMP ? CAMP.id : '?') + '#' + idx;
  if (THREATN[key] !== undefined) return THREATN[key];
  let n = 0;
  try {
    const { arr, walls } = lintWalk(L, idx);
    const paired = new Set();
    for (const rec of arr) {
      if (rec.type === 'strip') continue;          // a bonus ride, not a threat
      if (rec.type === 'line') {                   // a barrier is ONE threat with two ends
        if (paired.has(rec)) continue;
        if (rec.pair) paired.add(rec.pair);
      }
      n++;
    }
    n += walls.length;                             // a rim wall seizes rail — it counts
  } catch (e) { n = 0; }
  return (THREATN[key] = n);
}
function installCampaign(p) {
  const errs = validateCampaign(p);
  if (errs.length) { console.error('campaign rejected:', errs); return false; }
  if (lintReady) { // fairness findings are warnings only — the package still installs
    const lint = lintCampaign(p);
    if (lint.some(li => li.length)) console.warn('campaign lint (advisory):',
      lint.flatMap((li, i) => li.map(v => 'L' + (i + 1) + ' @' + v.t.toFixed(1) + 's ' + v.code + ': ' + v.msg)));
  }
  CAMP = p;
  LEVELS = p.levels;
  STORY = p.levels.map(l => l.story || null);
  COMMS = p.levels.map(l => l.comms || []);
  SPKCOL = {};
  for (const s of p.speakers) SPKCOL[s.id] = s.color;
  // per-campaign progress rides along, padded to this package's level count
  const c = progress.camp[p.id] || (progress.camp[p.id] = { unlocked: 1, stars: [], bests: [] });
  // COERCE BEFORE PADDING. These come off localStorage, which is player-writable
  // and survives every update — a save that predates a shape, or one somebody
  // poked at, would otherwise take `.push` on a non-array and throw HERE, during
  // install, before a single frame is drawn. A boot crash is the one failure a
  // tester cannot report from inside the game, so it is worth two lines.
  if (!Array.isArray(c.stars)) c.stars = [];
  if (!Array.isArray(c.bests)) c.bests = [];
  while (c.stars.length < LEVELS.length) c.stars.push(0);
  while (c.bests.length < LEVELS.length) c.bests.push(0);
  c.unlocked = Math.min(Math.max(1, c.unlocked || 1), LEVELS.length);
  PROG = c;
  if (infoCardsReady) registerStoryCards(); // first install runs before INFO_CARDS exists
  return true;
}
let infoCardsReady = false;
let lintReady = false; // lintLevel leans on consts declared below — first install runs before they exist
function registerStoryCards() {
  for (const k of Object.keys(THREATN)) delete THREATN[k]; // the Designer edits levels in place
  for (const k of Object.keys(INFO_CARDS)) if (/^story\d+$/.test(k)) delete INFO_CARDS[k];
  STORY.forEach((st2, i) => { if (st2) INFO_CARDS['story' + i] = st2; });
  if (CAMP && CAMP.verdict) INFO_CARDS.verdict = CAMP.verdict; // the epilogue is the campaign's own
}
// which campaigns has this player finished? FREE FLOW and the score
// modifiers unlock off ANY cleared campaign, not just the active one
function campaignCleared(id) {
  const c = progress.camp[id], pk = CAMPAIGNS.find(p => p.id === id);
  return !!(c && pk && c.stars[pk.levels.length - 1] > 0);
}
const anyCampaignCleared = () => CAMPAIGNS.some(p => campaignCleared(p.id));
// levels carry ONE continuous number across the whole story — campaign 1 owns
// 01-08, campaign 2 picks up at 09 — so a level number names exactly one level
const campBase = ci => CAMPAIGNS.slice(0, Math.max(0, ci)).reduce((n, p) => n + p.levels.length, 0);
const levelNo = (ci, li) => campBase(ci) + li + 1;
const curLevelNo = li => levelNo(CAMP ? CAMPAIGNS.indexOf(CAMP) : -1, li);
const lvNum = n => (n < 10 ? '0' : '') + n;
// FREE FLOW opens once the fifth level of the first campaign is secured
const FLOW_UNLOCK_LEVEL = 5;
function flowUnlocked() {
  const first = CAMPAIGNS[0], c = first && progress.camp[first.id];
  return !!(c && c.stars[FLOW_UNLOCK_LEVEL - 1] > 0) || anyCampaignCleared();
}
function switchCampaign(i) {
  if (!CAMPAIGNS[i] || CAMPAIGNS[i] === CAMP) return;
  installCampaign(CAMPAIGNS[i]);
  progress.lastCamp = CAMPAIGNS[i].id;
  saveState();
}
// The Story Mode carousel leads with a VANGUARD TRAINING disc, then the real
// campaigns, then any teasers. A carousel index maps to a disc descriptor via
// discAt(); a campaign index maps to its carousel slot via discOfCamp().
const TRAIN_DISCS = 1;
const discCount = () => TRAIN_DISCS + CAMPAIGNS.length + CAMPS_SOON.length;
// Training is not a contract and has no client, but its disc has the same face — so it
// carries a PSEUDO-PACKAGE, enough of one to ride the strip path the contracts use
// (campArtImg keys off id + art, and nothing else here is read). The `_` id keeps it out
// of the namespace a real package id could occupy.
const TRAIN_PKG = { id: '_train', art: 'training.webp' };
function discAt(i) {
  if (i < TRAIN_DISCS) return { kind: 'train', pk: TRAIN_PKG };
  const j = i - TRAIN_DISCS;
  if (j < CAMPAIGNS.length) return { kind: 'camp', ci: j, pk: CAMPAIGNS[j] };
  return { kind: 'soon', si: j - CAMPAIGNS.length };
}
const discOfCamp = ci => TRAIN_DISCS + ci;
// Sync a carousel disc: training launches the qualification run; a contract
// zooms into its relay map.
function syncDisc(di) {
  const d = discAt(di);
  if (d.kind === 'train') { menuFx = { kind: 'launch', t: 0, dur: 0.5, action: startQualification }; tone(70, 0.45, 'sine', 0.12, 260); return; }
  if (d.kind !== 'camp') return;
  switchCampaign(d.ci);
  mapSel = Math.min(PROG.unlocked - 1, LEVELS.length - 1);
  campScrollTgt = di;
  menuFx = { kind: 'discZoom', t: 0, dur: 0.55, disc: di };
  tone(70, 0.45, 'sine', 0.12, 260);
}
// boot into the campaign the player last had open
installCampaign(CAMPAIGNS.find(p => p.id === progress.lastCamp) || CAMPAIGNS[0]);
