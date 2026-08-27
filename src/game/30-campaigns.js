'use strict';
// ---------- levels ----------
// ---------- campaign packages ----------
// A campaign is ONE self-contained, JSON-shaped object (no functions) — the
// exact format the Tunnel Designer will export and future community packages
// will import. The game only ever reads a package through installCampaign();
// nothing else touches one directly. See docs/CMS-ROADMAP.md.
// campaign packages ship in src/campaigns.js (loaded just before this
// script); every package still enters through validateCampaign below
const CAMPAIGNS = typeof CAMPAIGN_PACKAGES === 'undefined' ? [] : CAMPAIGN_PACKAGES;
// active-campaign views — populated ONLY by installCampaign()
let CAMP = null, PROG = null;
let LEVELS = [], STORY = [], COMMS = [], SPKCOL = {};
// THE DEAL SEED — deliberately NOT the campaign's id.
//
// An id is identity: progress is stored under it and a leaderboard board is keyed by it. But
// it was also what every destination hash read, so renaming one re-rolled which world and
// which sun sat at each of its relays. The ids were renamed on 2026-08-05 (investigation ->
// cargo-run, the-bait -> patrol, and so on) to stop the code speaking the retired Data
// Defenders story, and that alone would have moved forty destinations — including ones art
// had already been generated for.
//
// So `seed` holds the ORIGINAL slug and the hashes read it: identity moved, the sky did not.
// A new campaign needs no seed; without one this falls back to the id, which is what a
// package author would expect. S3D_FINAL and DEST_NAMED are keyed by seed for the same
// reason — their keys are the old slugs and they still point at the right relays.
// A campaign is identified by its id and nothing else. There WAS a second field,
// `seed`, because the id was also the hash input that dealt all forty relays —
// so the id could not be renamed without re-dealing the game, and the retired
// Data Defenders slugs had to be kept as seeds. DEST_DEAL and DEST_ROLL in
// 80-tunnel hold that deal as data now, so the seed is gone and an id is just a
// name again.
const campIdOf = pk => (pk && pk.id) || 'x';
const campKey = () => campIdOf(typeof CAMP !== 'undefined' && CAMP);
const ramp = (a, b, x) => lerp(a, b, clamp(x, 0, 1));
// endless mode: difficulty is a function of survival time, rebuilt each frame
function endlessCfg(t) {
  const k = clamp(t / 150, 0, 1); // fully spiced after 2.5 minutes
  // DEEP SURGES (H-08): speed stays capped at surge 6 for playability, but the
  // lane used to flatline there and the ranked week became an endurance test.
  // Every surge past 6 now presses density and mix instead — announced like the
  // speed steps, relief pickup and all — so a deep run ends on a skill wall.
  // Pure in t, so weekly's seeded script stays a function of the week.
  const press = 1 + Math.min(Math.max(0, Math.floor(t / 100) - 6) * 0.09, 0.8);
  const pcap = (v, cap) => Math.min(v * press, cap);
  return {
    name: weekly ? 'WEEKLY LANE' : 'ENDLESS LANE', duration: Infinity, endless: true,
    spawnMin: ramp(1.4, 0.55, k) / press, spawnMax: ramp(2.2, 1.1, k) / press,
    // speed climbs in announced SURGE steps every 100s, hard-capped at 6
    speed: Math.min(0.38 + Math.floor(t / 100) * 0.035, 0.38 + 6 * 0.035),
    doubles: pcap(ramp(0, 0.40, k), 0.62),
    // lines + heavies share one roll in trySpawn — their caps must sum below 1
    heavies: pcap(ramp(0, 0.22, (k - 0.15) / 0.85), 0.34),
    lines: pcap(ramp(0, 0.22, (k - 0.3) / 0.7), 0.30),
    colors: pcap(ramp(0, 0.30, (k - 0.45) / 0.55), 0.45),
    walls: pcap(ramp(0, 0.12, (k - 0.5) / 0.5), 0.20),
    bursts: t > 70
  };
}
// bands: timed partial overrides of a level's rate knobs. While t is inside
// [t0, t1) the spawner runs on { ...level, ...mix } and intensity scales the
// cadence (1 = the level's own spawnMin/spawnMax, 2 = twice as dense). Pure:
// the live spawner AND the fairness linter read the exact same function, and
// a level without bands returns ITSELF — legacy levels replay deterministically
function bandCfg(level, t) {
  const bs = level.bands;
  if (!bs || !bs.length) return level;
  const b = bs.find(b2 => t >= b2.t0 && t < b2.t1);
  if (!b) return level;
  const cfg = Object.assign({}, level, b.mix || {});
  const k = b.intensity || 1;
  cfg.spawnMin = level.spawnMin / k;
  cfg.spawnMax = level.spawnMax / k;
  return cfg;
}
// campaign progress lives per campaign id under progress.camp; the flat
// pre-CMS fields (stars/bests/unlocked) migrate into camp['cargo-run']
const progress = { camp: {}, enlisted: false, tutorialDone: false, stripBriefed: false, wallBriefed: false, best: 0, weekly: { last: 0, streak: 0, best: 0 } };
// THE RANKED STREAK, AND WHETHER IT IS STILL STANDING. progress.weekly.streak has
// counted consecutive filed weeks since the ladder shipped and nothing ever drew
// it — the one hook that rewards coming back was being earned invisibly.
//
// The count alone is not the motivating fact; the count PLUS its footing is. A
// streak that already banked THIS week is safe and is a trophy. A streak whose
// last file was LAST week is alive but expires when the week closes on Sunday —
// that is the state worth putting in front of someone opening the menu, and the
// only one that asks for a run. Anything older is broken, and the stale number
// still sitting in the save is history: the next filed run resets it to 1 (see
// endLevel), so it is never shown.
//   held=true  → banked this week      held=false → alive, expires Sunday
function weeklyStreak() {
  const D = progress.weekly;
  if (!D || !D.streak) return null;
  const gap = weekNow() - D.last;
  return gap === 0 ? { n: D.streak, held: true }
    : gap === 1 ? { n: D.streak, held: false }
    : null;
}
