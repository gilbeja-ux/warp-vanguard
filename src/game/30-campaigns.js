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
let LEVELS = [], STORY = [], COMMS = [], CASE_NOTES = [], SPKCOL = {};
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
const campSeedOf = pk => (pk && (pk.seed || pk.id)) || 'x';
const campSeed = () => campSeedOf(typeof CAMP !== 'undefined' && CAMP);
const ramp = (a, b, x) => lerp(a, b, clamp(x, 0, 1));
// endless mode: difficulty is a function of survival time, rebuilt each frame
function endlessCfg(t) {
  const k = clamp(t / 150, 0, 1); // fully spiced after 2.5 minutes
  return {
    name: weekly ? 'WEEKLY LANE' : 'ENDLESS LANE', duration: Infinity, endless: true,
    spawnMin: ramp(1.4, 0.55, k), spawnMax: ramp(2.2, 1.1, k),
    // speed climbs in announced SURGE steps every 100s, hard-capped at 6
    speed: Math.min(0.38 + Math.floor(t / 100) * 0.035, 0.38 + 6 * 0.035),
    doubles: ramp(0, 0.40, k),
    heavies: ramp(0, 0.22, (k - 0.15) / 0.85),
    lines: ramp(0, 0.22, (k - 0.3) / 0.7),
    colors: ramp(0, 0.30, (k - 0.45) / 0.55),
    frags: ramp(0, 0.18, (k - 0.25) / 0.75),
    walls: ramp(0, 0.12, (k - 0.5) / 0.5),
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
const progress = { camp: {}, tutorialDone: false, bossBriefed: false, triadBriefed: false, spinnerBriefed: false, stripBriefed: false, wallBriefed: false, best: 0, weekly: { last: 0, streak: 0, best: 0 } };
