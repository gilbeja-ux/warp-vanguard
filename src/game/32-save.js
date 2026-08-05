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
function closeNameEntry() { nameEntry = null; nameEntryDraft = ''; nameEntryFx = 0; clearField(); }
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
function saveState() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify({ progress, settings, mutators, identity })); } catch (e) {}
}
(function loadState() {
  try {
    let raw = localStorage.getItem(STORE_KEY);
    if (raw === null) {
      raw = localStorage.getItem(LEGACY_STORE_KEY);
      if (raw !== null) localStorage.removeItem(LEGACY_STORE_KEY);
    }
    const d = JSON.parse(raw);
    if (d) {
      if (d.progress) {
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
      }
      if (d.settings) Object.assign(settings, d.settings);
      // old default was 0.5 — migrate untouched saves to the new quieter bed
      if (d.settings && Math.abs(d.settings.musicVol - 0.5) < 1e-9) settings.musicVol = 0.32;
      if (d.mutators) Object.assign(mutators, d.mutators);
      if (d.identity) Object.assign(identity, d.identity);
    }
  } catch (e) {}
  ensureIdentity(); // mint a device handle + auto label on first boot; persisted on next save
})();
