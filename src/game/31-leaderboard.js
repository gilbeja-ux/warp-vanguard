'use strict';
// ---------- player identity ----------
// Anonymous, arcade-style. `id` is a stable per-device handle minted once.
// `autoName` is the throwaway "Vanguard-XXXXXX" label a player wears until they
// type a handle. `name` is the FREE-TYPED arcade handle they enter on a high
// score (no sign-in, no uniqueness — moderated at submit time). `token`/`refresh`
// /`uid` hold the anonymous Supabase session (the server-verified player_id).
// Identity rides in the same save blob.
const identity = { id: '', autoName: '', name: '', service: '', token: '' };
function ensureIdentity() {
  if (!identity.id) {
    identity.id = (globalThis.crypto && crypto.randomUUID) ? crypto.randomUUID()
      : 'wv-' + Date.now().toString(36) + '-' + Math.floor(Math.random() * 1e9).toString(36);
  }
  if (!identity.autoName) {
    // 6 hex chars ≈ 16M labels — collisions are harmless (uid is the real key)
    let s = '';
    if (globalThis.crypto && crypto.getRandomValues) {
      const b = new Uint8Array(3); crypto.getRandomValues(b);
      s = Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
    } else s = Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0');
    identity.autoName = 'Vanguard-' + s.toUpperCase();
  }
  return identity.id;
}
// what the player is CALLED: their claimed name if they have one, else the auto
// label. Signed-in status = they linked a real provider (not anonymous).
const displayName = () => identity.name || identity.autoName || 'Vanguard';

// ---------- leaderboard client (Supabase) ----------
// The client ONLY READS boards. The publishable key is meant to ship (it's in
// every player's browser anyway) and is safe because RLS locks writes to the
// service role — scores enter only through the verifier Edge Function. Every
// call fails soft (resolves null) so the offline PWA degrades to local bests.
const LEADERBOARD = {
  url: 'https://ghkbjlgcdrszkawfbxdr.supabase.co',
  key: 'sb_publishable_B3MngfknmPrLc-uo0ho11A_Jnmphekl',
  enabled: true
};
// the 'daily' board is keyed per UTC day (matches captureRun's daily seed); all
// other boards ignore day.
const lbDay = board => board === 'daily' ? Math.floor(Date.now() / 864e5) : null;
// each board SHOWS the top 50 (the server keeps 100 — the 51-100 buffer backfills
// a removal). A run at rank ≤ LB_SHOW made the cut → it earns the name-entry card.
const LB_SHOW = 50;
async function lbRpc(fn, args) {
  if (!LEADERBOARD.enabled || typeof fetch === 'undefined') return null;
  try {
    const res = await fetch(LEADERBOARD.url + '/rest/v1/rpc/' + fn, {
      method: 'POST',
      headers: { apikey: LEADERBOARD.key, Authorization: 'Bearer ' + LEADERBOARD.key, 'Content-Type': 'application/json' },
      body: JSON.stringify(args)
    });
    return res.ok ? await res.json() : null;
  } catch (e) { return null; } // offline / network error → caller shows local bests
}
// top N of a board → [{ rank, player_id, player_name, score, max_combo, time_sec, verified, trace_id, created_at }]
const lbTop = (board, limit = 100) => lbRpc('leaderboard_top', { p_board: board, p_day: lbDay(board), p_limit: limit });
// one player's standing → [{ rank, score, total }] (empty if they have no entry)
const lbRank = (board, playerId) => lbRpc('leaderboard_rank', { p_board: board, p_day: lbDay(board), p_player: playerId });
// fetch a stored replay from the public traces bucket → { v, mode, levelIdx, seed,
// campId, frames } (the verifier uploads one per verified run). Legacy bare-array
// traces are wrapped so callers always get { frames }.
async function lbTrace(traceId) {
  if (!traceId || typeof fetch === 'undefined') return null;
  try {
    const res = await fetch(LEADERBOARD.url + '/storage/v1/object/public/traces/' + traceId);
    if (!res.ok) return null;
    const j = await res.json();
    return Array.isArray(j) ? { frames: j } : j;
  } catch (e) { return null; }
}

// ---------- score submission (auth + verifier) ----------
// scores enter ONLY through the submit-run Edge Function (the client can't write
// the runs table — RLS). We sign in anonymously for a server-verified identity
// and REUSE it across launches via the stored refresh token, so a player's
// scores stay under one id. identity.uid is that server id (the leaderboard's
// player_id); identity.refresh persists in the save blob.
let lbStatus = ''; // human-readable submit status, shown on the END screen
let lastRun = null; // snapshot of the run that just ended — the leaderboard submission payload (also resubmitted with a new name when the player sets a handle)
async function lbSession() {
  if (typeof fetch === 'undefined') return null;
  if (identity.token && identity.tokenExp && Date.now() < identity.tokenExp - 60000) return identity.token;
  const h = { apikey: LEADERBOARD.key, 'Content-Type': 'application/json' };
  try {
    let res = null;
    if (identity.refresh) // refresh the existing anonymous user — keeps the same player_id
      res = await fetch(LEADERBOARD.url + '/auth/v1/token?grant_type=refresh_token', { method: 'POST', headers: h, body: JSON.stringify({ refresh_token: identity.refresh }) });
    if (!res || !res.ok) // first run (or refresh expired): mint a fresh anonymous user
      res = await fetch(LEADERBOARD.url + '/auth/v1/signup', { method: 'POST', headers: h, body: JSON.stringify({}) });
    if (!res.ok) { lbStatus = 'AUTH HTTP ' + res.status; return null; }
    const d = await res.json();
    if (!d.access_token) { lbStatus = 'AUTH: no token'; return null; }
    identity.token = d.access_token;
    identity.tokenExp = Date.now() + (d.expires_in ? d.expires_in * 1000 : 3600000);
    if (d.refresh_token) identity.refresh = d.refresh_token;
    if (d.user && d.user.id) identity.uid = d.user.id;
    identity.service = 'supabase';
    saveState();
    return identity.token;
  } catch (e) { lbStatus = 'AUTH ERR: ' + (e && e.message || e); return null; }
}
// the player's SERVER id (the runs table's player_id). identity.uid is captured
// during sign-in, but older saves predate it — fall back to decoding the stored
// access token's `sub` claim so "is this row mine?" works without a fresh submit.
function lbUid() {
  if (!identity.uid && identity.token) {
    try {
      const p = identity.token.split('.')[1];
      const j = JSON.parse(atob(p.replace(/-/g, '+').replace(/_/g, '/')));
      if (j.sub) identity.uid = j.sub;
    } catch (e) {}
  }
  return identity.uid || identity.id;
}
let lastSubmit = null; // { ok, verified, score, rank } from the most recent submission — for the END screen
async function lbSubmit(run) {
  if (!LEADERBOARD.enabled || typeof fetch === 'undefined' || !run || !run.board) { lbStatus = 'submit skipped'; return; }
  lbStatus = 'SYNCING…';
  try {
    const token = await lbSession();
    if (!token) return; // lbSession set lbStatus with the reason
    // endless is trust-only and unreplayable — don't ship its (large, useless) trace
    const payload = run.mode === 'endless' ? { ...run, trace: undefined } : run;
    const res = await fetch(LEADERBOARD.url + '/functions/v1/submit-run', {
      method: 'POST',
      headers: { apikey: LEADERBOARD.key, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ run: payload, name: displayName() })
    });
    const txt = await res.text();
    let d = null; try { d = JSON.parse(txt); } catch (e) {}
    if (res.ok && d && d.ok) {
      lastSubmit = d; lbStatus = d.rank ? 'RANK #' + d.rank.rank + ' / ' + d.rank.total : 'SUBMITTED';
      // remember that I have a run on this board (for "Show my Run" even when the
      // anon session id can't be matched to the row) — keyed by board key
      if (d.rank && run.board) { progress.myBoards = progress.myBoards || {}; progress.myBoards[run.board] = d.rank.rank; saveState(); }
    }
    else { lastSubmit = null; lbStatus = 'REJECTED ' + res.status + ': ' + (d && d.error ? d.error : txt.slice(0, 48)) + (d && d.recomputed !== undefined ? ' [' + d.recomputed + ' vs ' + d.claimed + ', ig' + d.integrity + ' st' + d.steps + '/' + d.traceLen + ']' : ''); }
  } catch (e) { lastSubmit = null; lbStatus = 'NET ERR: ' + (e && e.message || e); } // offline / blocked → local best still stands
}
