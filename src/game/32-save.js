'use strict';
// ---------- operator handle (arcade name) ----------
// The handle is free-typed, local, and moderated at submit time by the Edge
// Function; the client filter below is instant UX only (the server is the real
// gate). Keep the list terse — it just catches the obvious stuff before a player
// commits; the server backstop (submit-run) is authoritative and leet-aware.
const NAME_MAX = 14;
const NAME_BLOCK = ['nigger', 'nigga', 'faggot', 'retard', 'rape', 'cunt', 'spic', 'chink', 'kike', 'coon',
  'fuck', 'shit', 'bitch', 'bastard', 'dick', 'cock', 'penis', 'pussy', 'whore', 'slut', 'cum', 'twat',
  'prick', 'asshole', 'anus', 'sex', 'porn', 'nazi', 'hitler', 'pedo', 'molest'];
const NAME_LEET = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b', '@': 'a', '$': 's', '!': 'i' };
// sanitize a raw field value to what's allowed on a board (letters/digits/space/-/_)
const sanitizeName = s => String(s || '').replace(/[^\w \-]/g, '').replace(/\s+/g, ' ').replace(/^ /, '').slice(0, NAME_MAX);
// live status for the entry field → 'empty' | 'short' | 'bad' | 'ok'
function nameStatus(raw) {
  const clean = sanitizeName(raw).trim();
  if (!clean) return 'empty';
  if (clean.length < 2) return 'short';
  const norm = clean.toLowerCase().replace(/[\s_\-]/g, '').replace(/[013457@$!]/g, c => NAME_LEET[c] || c);
  if (NAME_BLOCK.some(w => norm.includes(w))) return 'bad';
  return 'ok';
}
// commit a typed handle: persist it locally + carry it onto the just-played run
// (resubmit carries the SAME lastRun.runId, so the board renames THAT row in
// place — it does not add a second copy of the run).
function setHandle(name) {
  const clean = sanitizeName(name).trim();
  identity.name = clean; saveState();
  if (lastRun && lastRun.board) lbSubmit({ ...lastRun, playerName: clean });
}
// dismiss / commit the arcade high-score card (defined here so the END tap
// handler can call them; the DOM overlay + sfx exist by the time they run)
function closeNameEntry() { nameEntry = null; nameEntryDraft = ''; clearField(); }
function confirmNameEntry() {
  const raw = overlayValue() || nameEntryDraft;
  if (nameStatus(raw) !== 'ok') return; // the card shows the reason; the button is locked
  setHandle(raw);
  closeNameEntry();
  if (sfx && sfx.tick) sfx.tick();
}
// where a run would rank on a board — decides if it made the top-50 cut. Passes
// the run's hits (zaps) + perfects so the provisional rank uses the SAME tie-break
// as the board (score, then hits, then perfects, then earlier-record).
async function lbProvisional(board, score, zaps = 0, perfects = 0) {
  const r = await lbRpc('leaderboard_provisional_rank', { p_board: board, p_day: lbDay(board), p_score: score, p_zaps: zaps, p_perfects: perfects });
  return Array.isArray(r) && r[0] ? r[0] : null; // { rank, total }
}

// ---------- persistence ----------
const STORE_KEY = 'warpVanguard.v1';
// pre-rename key (2026-07-31). loadState() moves a save across once and deletes
// the old entry, so nothing is left behind; drop both lines once every device
// you care about has booted the renamed build at least once.
const LEGACY_STORE_KEY = 'dataDefenders.v1';
// pre-campaign saves kept flat stars/bests/unlocked — fold them into campaign #1.
// Targets the CURRENT id. Writing the retired 'investigation' here and leaning on the rename
// loop in loadState to move it a few lines later did work, but it meant this function emitted
// a key nothing reads and was only correct because of the order the two ran in.
function migrateSaveShape(dp) {
  if (dp.stars && !dp.camp) {
    dp.camp = { 'cargo-run': {
      unlocked: dp.unlocked || 1,
      stars: dp.stars,
      bests: Array.isArray(dp.bests) ? dp.bests : []
    } };
  }
  delete dp.stars; delete dp.bests; delete dp.unlocked;
  return dp;
}
// THE COURSE CAME IN THREE PARTS ON 2026-11-05 (QUAL_PARTS, 70-update), and a save
// written before that has no flag for parts 2 and 3. Nobody who flew the old course is
// sent through them by force: it taught every lesson, so a save that finished it
// (tutorialDone, which then meant the whole course) has all three. Nor is anyone who
// already got past the stage a part plays before: past stage 03 (stage 04 open, the
// contract's `unlocked` count at 4 or more) files part 2, past stage 07 files part 3.
// A delivered first contract reads 8, so every later contract is covered by the same
// test. Run once, on a loaded save that has no part-2 flag, after the ids are moved.
function migrateQualParts(dp) {
  const c1 = dp.camp && dp.camp[CAMPAIGNS.length ? CAMPAIGNS[0].id : 'cargo-run'];
  const open = (c1 && c1.unlocked) || 1, old = !!dp.tutorialDone;
  dp.qualPart2Done = old || open >= 4;
  dp.qualPart3Done = old || open >= 8;
  return dp;
}
// A LICENSE IS NOT PROGRESS (Gil, 2026-08-17, kept 2026-11-05). It rides its own
// key in the save, beside progress / settings / identity, so RESET CONTRACT and
// the MY DATA erase, which touch progress and the boards, cannot revoke it.
// Declared here because loadState fills it; 34-license.js owns what it means.
//   owned  — the store said this account holds the unlock (cached; boot re-asks)
//   legacy — what the save held the first time a licence-aware build booted,
//            written ONCE: { save, past16 }. GRANDFATHER reads it.
const license = { owned: false, legacy: null };
let saveFoundAtBoot = false; // did loadState find a save at all? (the legacy stamp reads it)
function saveState() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify({ progress, settings, mutators, identity, license })); } catch (e) {}
}
// a named declaration, called once below, so a test can read a written save back
function loadState() {
  try {
    let raw = localStorage.getItem(STORE_KEY);
    if (raw === null) {
      raw = localStorage.getItem(LEGACY_STORE_KEY);
      if (raw !== null) localStorage.removeItem(LEGACY_STORE_KEY);
    }
    // a save was FOUND even when it will not parse: the paywall's legacy stamp
    // (34-license.js) counts a damaged pre-paywall save as a save that existed
    saveFoundAtBoot = raw !== null;
    const d = JSON.parse(raw);
    if (d) {
      if (d.progress) {
        const preParts = !('qualPart2Done' in d.progress); // written before the course split
        Object.assign(progress, migrateSaveShape(d.progress));
        if (!progress.camp) progress.camp = {};
        // ONE-WAY MIGRATION, 2026-08-05. The campaign ids stopped speaking the retired Data
        // Defenders story (investigation -> cargo-run, the-bait -> patrol, ...) and progress
        // is stored under the id, so a save written before the rename would have read as a
        // player who had never played. Moved rather than copied, and only when the new key is
        // absent, so a later save cannot be overwritten by a stale one.
        for (const [was, now] of [['investigation', 'cargo-run'], ['going-deeper', 'survey'],
          ['signal-lost', 'collector'], ['the-bait', 'patrol'], ['shutdown', 'delegation']]) {
          if (progress.camp[was] && !progress.camp[now]) progress.camp[now] = progress.camp[was];
          delete progress.camp[was];
          if (progress.lastCamp === was) progress.lastCamp = now;
        }
        if (preParts) migrateQualParts(progress);
      }
      if (d.settings) Object.assign(settings, d.settings);
      // old default was 0.5 — migrate untouched saves to the new quieter bed
      if (d.settings && Math.abs(d.settings.musicVol - 0.5) < 1e-9) settings.musicVol = 0.32;
      if (d.mutators) Object.assign(mutators, d.mutators);
      if (d.identity) Object.assign(identity, d.identity);
      if (d.license && typeof d.license === 'object') Object.assign(license, d.license);
    }
  } catch (e) {
    // A DAMAGED BLOB MUST NOT BE OVERWRITTEN BLIND (audit 2026-11-05). The next saveState() writes
    // defaults over STORE_KEY, which cost a player their stars, bests and login for good. Park the
    // raw text under a second key first (never over an earlier parked copy), and read the login
    // back out of it by hand so the player keeps their leaderboard rows. Progress is not guessed.
    try {
      const bad = localStorage.getItem(STORE_KEY);
      if (bad && localStorage.getItem(STORE_KEY + '.bad') === null) localStorage.setItem(STORE_KEY + '.bad', bad);
      const pick = k => { const m = new RegExp('"' + k + '":"([^"]+)"').exec(bad || ''); return m && m[1]; };
      if (pick('refresh')) identity.refresh = pick('refresh');
      if (pick('uid')) identity.uid = pick('uid');
    } catch (e2) {}
  }
  ensureIdentity(); // mint a device handle + auto label on first boot; persisted on next save
}
loadState();
