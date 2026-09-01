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
  // NO DASH, AND THAT IS THE WHOLE POINT. 'Vanguard-' + 6 hex is 15 characters
  // against a NAME_MAX of 14, so every auto handle ever submitted was sliced a
  // digit short by sanitizeName() here and cleanName() in submit-run — the boards
  // are full of 'Vanguard-25A43'. The label claimed 16M possibilities and was
  // delivering 1M. Dropping the dash frees exactly the one character that was
  // being eaten: 'Vanguard' + 6 hex is 14, which fits whole.
  if (!identity.autoName) {
    // 6 hex chars ≈ 16M labels — collisions are harmless (uid is the real key)
    let s = '';
    if (globalThis.crypto && crypto.getRandomValues) {
      const b = new Uint8Array(3); crypto.getRandomValues(b);
      s = Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
    } else s = Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0');
    identity.autoName = 'Vanguard' + s.toUpperCase();
  } else if (identity.autoName.indexOf('-') >= 0) {
    // A save from before the change carries the 15-char form, which would go on
    // being truncated for as long as that player never types a handle. Removing
    // the dash keeps every digit they already had AND makes it fit — so their
    // label stops changing shape between the device and the board.
    identity.autoName = identity.autoName.replace('-', '');
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
// NO BOARD USES THE `day` COLUMN ANY MORE. It existed for the daily lane, which
// shared one 'daily' board partitioned per UTC day. The weekly ladder puts the week
// index in the board KEY instead ('weekly:2953'), so each week is a board in its own
// right — which is what gives it its own top-100 field, its own ranking, and a
// permanence a shared board could not offer. Kept as a function because every RPC
// still takes p_day, and the column still exists for the boards recorded under the
// old scheme.
const lbDay = () => null;
// each board SHOWS the top 50 (the server keeps 100 — the 51-100 buffer backfills
// a removal). A run at rank ≤ LB_SHOW made the cut → it earns the name-entry card.
const LB_SHOW = 50;
// EVERY REQUEST GETS A DEADLINE. Without one a fetch can hang for as long as the
// network lets it, and the failure modes that do that are the common ones: a
// captive-portal wifi that accepts the connection and never answers, a phone
// with one bar, a tunnel. The score is already safe on the device by then, but
// the screen sits on "SYNCING…" forever and the player has been told nothing.
// A deadline turns silence into an answer.
const LB_TIMEOUT = 10000;      // reads and auth
const LB_TIMEOUT_SUBMIT = 25000; // a campaign trace is ~200KB uphill on mobile
function lbFetch(url, opts, ms) {
  if (typeof AbortController === 'undefined') return fetch(url, opts); // ancient webview: no deadline, still works
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), ms || LB_TIMEOUT);
  return fetch(url, Object.assign({}, opts, { signal: ac.signal }))
    .finally(() => clearTimeout(timer));
}
async function lbRpc(fn, args) {
  if (!LEADERBOARD.enabled || typeof fetch === 'undefined') return null;
  try {
    const res = await lbFetch(LEADERBOARD.url + '/rest/v1/rpc/' + fn, {
      method: 'POST',
      headers: { apikey: LEADERBOARD.key, Authorization: 'Bearer ' + LEADERBOARD.key, 'Content-Type': 'application/json' },
      body: JSON.stringify(args)
    });
    return res.ok ? await res.json() : null;
  } catch (e) { return null; } // offline / network error / timed out → caller shows local bests
}
// top N of a board → [{ rank, player_id, player_name, score, max_combo, time_sec, verified, trace_id, created_at }]
const lbTop = (board, limit = 100) => lbRpc('leaderboard_top', { p_board: board, p_day: lbDay(board), p_limit: limit });
// one player's standing → [{ rank, score, total }] (empty if they have no entry)
const lbRank = (board, playerId) => lbRpc('leaderboard_rank', { p_board: board, p_day: lbDay(board), p_player: playerId });
// fetch a stored replay → { v, mode, levelIdx, seed, campId, frames } (the verifier
// uploads one per verified run). Legacy bare-array traces are wrapped so callers
// always get { frames }.
// H-03: the traces bucket is PRIVATE now, so we mint a short-lived signed URL
// through submit-run (which needs a session) and then fetch that. Watching any
// replay is allowed — the server signs any valid trace id — but the bucket can no
// longer be bulk-downloaded to steal and resubmit another player's input frames.
async function lbTrace(traceId) {
  if (!traceId || typeof fetch === 'undefined') return null;
  try {
    const token = await lbSession();
    if (!token) return null;
    const sr = await lbFetch(LEADERBOARD.url + '/functions/v1/submit-run', {
      method: 'POST',
      headers: { apikey: LEADERBOARD.key, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'trace-url', traceId })
    }, 15000);
    if (!sr.ok) return null;
    const { url } = await sr.json();
    if (!url) return null;
    const res = await lbFetch(url, undefined, 15000);
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
// WHICH BOARD'S RULES THIS RUN PLAYED BY. Campaign boards are keyed exactly as
// the server keys them; the weekly lane is fingerprinted once as its generator
// rather than per week, since the week index is an input to that generator and
// not a different game. Endless is unranked and unverifiable, so it has none.
function boardSimId(run) {
  const M = (typeof window !== 'undefined' && window.__SIM_LEVELS) || null;
  if (!M || !run) return null;
  if (run.mode === 'weekly') return M.weekly || null;
  if (run.mode === 'campaign' && run.campId && Number.isInteger(run.levelIdx))
    return M[run.campId + ':' + run.levelIdx] || null;
  return null;
}
let lbStatus = ''; // human-readable submit status, shown on the END screen
let lastRun = null; // snapshot of the run that just ended — the leaderboard submission payload (also resubmitted with a new name when the player sets a handle)
async function lbSession() {
  if (typeof fetch === 'undefined') return null;
  if (identity.token && identity.tokenExp && Date.now() < identity.tokenExp - 60000) return identity.token;
  const h = { apikey: LEADERBOARD.key, 'Content-Type': 'application/json' };
  try {
    let res = null;
    if (identity.refresh) // refresh the existing anonymous user — keeps the same player_id
      res = await lbFetch(LEADERBOARD.url + '/auth/v1/token?grant_type=refresh_token', { method: 'POST', headers: h, body: JSON.stringify({ refresh_token: identity.refresh }) });
    if (!res || !res.ok) // first run (or refresh expired): mint a fresh anonymous user
      res = await lbFetch(LEADERBOARD.url + '/auth/v1/signup', { method: 'POST', headers: h, body: JSON.stringify({}) });
    if (!res.ok) { lbFail('AUTH HTTP ' + res.status, 'OFFLINE — SCORE SAVED ON THIS DEVICE'); return null; }
    const d = await res.json();
    if (!d.access_token) { lbFail('AUTH: no token', 'OFFLINE — SCORE SAVED ON THIS DEVICE'); return null; }
    identity.token = d.access_token;
    identity.tokenExp = Date.now() + (d.expires_in ? d.expires_in * 1000 : 3600000);
    if (d.refresh_token) identity.refresh = d.refresh_token;
    if (d.user && d.user.id) identity.uid = d.user.id;
    identity.service = 'supabase';
    saveState();
    return identity.token;
  } catch (e) {
    lbFail('AUTH ERR: ' + (e && e.message || e),
      e && e.name === 'AbortError' ? 'NO ANSWER — SCORE SAVED ON THIS DEVICE'
        : 'OFFLINE — SCORE SAVED ON THIS DEVICE');
    return null;
  }
}
// WHAT A PLAYER IS TOLD, AND WHAT A DEVELOPER NEEDS, ARE DIFFERENT STRINGS.
// The END screen used to print the raw failure — "REJECTED 400: verification
// failed [0 vs 38660, ig0 st2368/2368]" — which is precise, alarming, and
// meaningless to anyone who did not write the verifier. Every one of those is
// a tester bug report about a system that is working correctly.
//
// So: the human line goes on screen, the diagnostic goes to the console where
// a log grab still has it. The human line ALWAYS says the score is safe,
// because it always is — the local best is written before any of this runs.
function lbFail(detail, human) {
  lbStatus = human;
  try { console.warn('[leaderboard] ' + detail); } catch (e) {}
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
  if (!LEADERBOARD.enabled || typeof fetch === 'undefined' || !run || !run.board) { lbStatus = ''; return; }
  lbStatus = 'SYNCING…';
  try {
    const token = await lbSession();
    if (!token) return; // lbSession set lbStatus with the reason
    // endless is trust-only and unreplayable — don't ship its (large, useless) trace
    const payload = run.mode === 'endless' ? { ...run, trace: undefined } : run;
    const res = await lbFetch(LEADERBOARD.url + '/functions/v1/submit-run', {
      method: 'POST',
      headers: { apikey: LEADERBOARD.key, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      // simId: WHICH RULES THIS BUILD PLAYS BY. The server re-simulates with its
      // own copy of the game, so a client a version behind computes a different
      // run from the same inputs — indistinguishable, from the server's side,
      // from a forged one. Sending it lets the server say "you are out of date"
      // instead of "this did not verify", which is the difference between a
      // prompt and an accusation. null on a dev build → the check is skipped.
      body: JSON.stringify({ run: payload, name: displayName(),
        simId: (typeof window !== 'undefined' && window.__SIM_ID) || null,
        // …and the id of THE ONE BOARD this run is claiming. The build-wide id
        // above moves whenever anything moves — a menu colour, a comment — and
        // gating on it told players to update over changes that could not touch
        // their score. This one moves only when this board's own numbers would.
        boardSim: boardSimId(run) })
    }, LB_TIMEOUT_SUBMIT);
    const txt = await res.text();
    let d = null; try { d = JSON.parse(txt); } catch (e) {}
    if (res.ok && d && d.ok) {
      lastSubmit = d; lbStatus = d.rank ? 'RANK #' + d.rank.rank + ' / ' + d.rank.total : 'SUBMITTED';
      // remember that I have a run on this board (for "Show my Run" even when the
      // anon session id can't be matched to the row) — keyed by board key
      if (d.rank && run.board) { progress.myBoards = progress.myBoards || {}; progress.myBoards[run.board] = d.rank.rank; saveState(); }
    }
    else {
      lastSubmit = null;
      const raw = 'REJECTED ' + res.status + ': ' + (d && d.error ? d.error : txt.slice(0, 64))
        + (d && d.recomputed !== undefined ? ' [' + d.recomputed + ' vs ' + d.claimed + ', ig' + d.integrity + ' st' + d.steps + '/' + d.traceLen + ']' : '');
      // A FAILED VERIFY DURING TESTING IS ALMOST ALWAYS A VERSION SKEW: the
      // server re-simulates with ITS copy of the game, so a client that is a
      // build behind computes a different run from the same inputs. Naming the
      // likely cause turns a scary rejection into an action.
      const outdated = res.status === 409 || (d && d.error === 'client outdated');
      const verifyFail = d && (d.error === 'verification failed' || d.recomputed !== undefined);
      lbFail(raw, outdated ? 'UPDATE AVAILABLE — THIS BUILD CAN NO LONGER POST SCORES'
        : verifyFail ? 'SCORE NOT VERIFIED — SAVED ON THIS DEVICE'
        : res.status === 429 ? 'TOO MANY SUBMISSIONS — TRY AGAIN SHORTLY'
        : 'NOT ACCEPTED — SCORE SAVED ON THIS DEVICE');
    }
  } catch (e) {
    lastSubmit = null;
    lbFail('NET ERR: ' + (e && e.message || e),
      e && e.name === 'AbortError' ? 'SYNC TIMED OUT — SCORE SAVED ON THIS DEVICE'
        : 'OFFLINE — SCORE SAVED ON THIS DEVICE');
  }
}

// ---------- the player's own data (rename / erase) ----------
// Both verbs go through the my-data Edge Function, authorised by the anonymous
// session token — which is the ONLY proof of ownership these identities have.
// There is no email to confirm through and no password to re-enter; a handle read
// off a public board proves nothing. Holding a valid token for the id IS holding
// the id, so the request carries no player id at all: the server takes it from
// the JWT, and a tampered body can only ever address the identity it already has.
//
// Resolves { ok, ... } or { ok:false, human } — the caller shows `human` and never
// the raw failure, same split as lbFail().
async function lbMyData(action, name) {
  if (!LEADERBOARD.enabled || typeof fetch === 'undefined') return { ok: false, human: 'UNAVAILABLE OFFLINE' };
  try {
    const token = await lbSession();
    if (!token) return { ok: false, human: 'OFFLINE — TRY AGAIN WHEN CONNECTED' };
    const res = await lbFetch(LEADERBOARD.url + '/functions/v1/my-data', {
      method: 'POST',
      headers: { apikey: LEADERBOARD.key, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, name })
    });
    const txt = await res.text();
    let d = null; try { d = JSON.parse(txt); } catch (e) {}
    if (!res.ok || !d || !d.ok) {
      lbFail('MY-DATA ' + action + ' ' + res.status + ': ' + (d && d.error ? d.error : txt.slice(0, 64)),
        'COULD NOT REACH THE BOARDS — NOTHING CHANGED');
      return { ok: false, human: 'COULD NOT REACH THE BOARDS — NOTHING CHANGED' };
    }
    if (action === 'rename') {
      // adopt the name the SERVER settled on, not the one we typed — it ran the
      // same moderation submit-run does, so a blocked handle comes back REDACTED
      // and the local copy has to agree with what the board now shows. `name` is
      // null when the rename was REFUSED (cooldown, or every row locked): keep the
      // old handle then, or the device would wear a name no board agrees with.
      if (d.name) { identity.name = d.name; saveState(); }
    } else if (action === 'delete') {
      lbForgetIdentity();
    }
    return d;
  } catch (e) {
    lbFail('MY-DATA ' + action + ' ERR: ' + (e && e.message || e),
      e && e.name === 'AbortError' ? 'NO ANSWER — NOTHING CHANGED' : 'OFFLINE — NOTHING CHANGED');
    return { ok: false, human: e && e.name === 'AbortError' ? 'NO ANSWER — NOTHING CHANGED' : 'OFFLINE — NOTHING CHANGED' };
  }
}

// ---------- reporting a handle ----------
// The display name is the only user-generated content on a board, and a word
// filter cannot know that a handle is someone's real name or is impersonating a
// regular. Those need a human, and this is how they reach one.
//
// `reason` is one of a closed set ('offensive' | 'personal' | 'impersonation').
// There is no free-text field on purpose: it would be user content needing its
// own moderation, and it is what an angry player types abuse into.
//
// The answer is deliberately uninformative — the reporter never learns how many
// others reported the row or whether anything happened, because publishing the
// threshold turns it into a target. Reports are remembered LOCALLY so the link
// disarms; that is UX, not enforcement (the server dedupes for real).
async function lbReport(runId, reason) {
  if (!LEADERBOARD.enabled || typeof fetch === 'undefined' || !runId) return { ok: false, human: 'UNAVAILABLE OFFLINE' };
  try {
    const token = await lbSession();
    if (!token) return { ok: false, human: 'OFFLINE — TRY AGAIN WHEN CONNECTED' };
    const res = await lbFetch(LEADERBOARD.url + '/functions/v1/report-run', {
      method: 'POST',
      headers: { apikey: LEADERBOARD.key, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ runId, reason })
    });
    const txt = await res.text();
    let d = null; try { d = JSON.parse(txt); } catch (e) {}
    if (!res.ok || !d || !d.ok) {
      lbFail('REPORT ' + res.status + ': ' + (d && d.error ? d.error : txt.slice(0, 64)), 'COULD NOT SEND — TRY AGAIN LATER');
      return { ok: false, human: 'COULD NOT SEND — TRY AGAIN LATER' };
    }
    progress.reported = progress.reported || {};
    progress.reported[runId] = 1; saveState();
    return d;
  } catch (e) {
    lbFail('REPORT ERR: ' + (e && e.message || e), 'OFFLINE — TRY AGAIN LATER');
    return { ok: false, human: 'OFFLINE — TRY AGAIN LATER' };
  }
}
const lbReported = runId => !!(runId && progress.reported && progress.reported[runId]);

// ---------- feedback: a private note to the developer ----------
// The third pipe out of the game, and the only one carrying free text. It is safe
// to carry it because nothing here is ever shown to another player: submit-run
// filters a handle because a handle goes on a public board, and report-run refuses
// free text because a reason typed about a stranger's row would need its own
// moderation. A note addressed to the person who wrote the game has no audience to
// protect, so it gets no word filter — one would only silence an honest bug report
// that used a rude word.
//
// The identity is the same anonymous session everything else uses, and it is taken
// from the JWT server-side. The body carries no player id at all.
const FEEDBACK_MAX = 600;      // characters. Long enough for a real report, short enough that a queue of them stays readable.
const FEEDBACK_HOLD_MS = 7 * 864e5; // a held note older than this is dropped unsent — see flushFeedback

// WHICH PLATFORM. Capacitor names itself on device; a browser is 'web'. Half of
// all bugs in this game have been one platform's bug, so this column is doing
// real work rather than decorating the row.
function fbPlatform() {
  try {
    if (window.Capacitor && window.Capacitor.getPlatform) return window.Capacitor.getPlatform();
  } catch (e) {}
  return 'web';
}
// WHERE THEY WERE — as a STAGE NAME, never an index. CLAUDE.md's house law:
// lvNum(levelNo(ci, li)) is the one renderer for a stage's name, it is one-based
// and zero-padded, and nothing player-facing or human-read may carry a bare index.
// This column is read by a human in the admin console, so it obeys the law.
function fbPlace() {
  try {
    if (typeof CAMP === 'undefined' || !CAMP || !CAMPAIGNS) return 'menu';
    const ci = Math.max(0, CAMPAIGNS.indexOf(CAMP));
    return CAMP.id + ' stage ' + lvNum(levelNo(ci, levelIdx));
  } catch (e) { return 'menu'; }
}
// Everything the player cannot be expected to type and the developer cannot work
// without. Named to the player, in the panel, before they press SEND.
function fbContext() {
  const ver = (typeof window !== 'undefined' && window.__APP_VERSION) || null;
  return {
    build: (ver ? 'v' + ver + ' ' : '') + BUILD,
    simId: (typeof window !== 'undefined' && window.__SIM_ID) || null,
    platform: fbPlatform(),
    screen: Math.round(W) + '×' + Math.round(H) + (ROT ? ' rot' : ''),
    place: fbPlace(),
    lang: (typeof navigator !== 'undefined' && navigator.language) || null
  };
}

// One attempt. `true` means the note is on the server and can be forgotten;
// `false` means try again later, and is the ONLY thing that fills the outbox.
// A 4xx is deliberately treated as landed: the server refuses an empty note and
// nothing else, so a note the panel let through cannot honestly be retried into
// existence — retrying it forever would be an outbox that never empties.
async function lbFeedbackSend(note) {
  if (!LEADERBOARD.enabled || typeof fetch === 'undefined' || !note) return false;
  try {
    const token = await lbSession();
    if (!token) return false;
    const res = await lbFetch(LEADERBOARD.url + '/functions/v1/send-feedback', {
      method: 'POST',
      headers: { apikey: LEADERBOARD.key, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic: note.topic, text: note.text, meta: note.ctx || {} })
    });
    const txt = await res.text();
    let d = null; try { d = JSON.parse(txt); } catch (e) {}
    if (res.ok && d && d.ok) return true;
    lbFail('FEEDBACK ' + res.status + ': ' + (d && d.error ? d.error : txt.slice(0, 64)), '');
    return res.status >= 400 && res.status < 500; // refused, not lost — stop retrying it
  } catch (e) {
    lbFail('FEEDBACK ERR: ' + (e && e.message || e), '');
    return false;
  }
}

// Send one note. Resolves { ok } on a landed note, or { ok:false, held } when it
// went to the outbox — which the panel says out loud, because "sent" and "held"
// are different news and a player who is told the wrong one writes it twice.
async function lbFeedback(topic, text) {
  const body = String(text || '').slice(0, FEEDBACK_MAX);
  if (!body.trim()) return { ok: false, human: 'NOTHING TO SEND' };
  const note = { topic: topic || 'other', text: body, ctx: fbContext(), at: Date.now() };
  if (await lbFeedbackSend(note)) return { ok: true };
  progress.fbOut = note; saveState();     // ONE slot — see flushFeedback
  return { ok: false, held: true, human: 'HELD — IT WILL SEND WHEN YOU ARE ONLINE' };
}

// ONE SLOT, NOT A QUEUE. This game is a PWA and is played on trains; a note that
// vanished because the phone was in a tunnel is worse than no button at all. But a
// queue invites a player to fill it, and the second note is nearly always the first
// note again — so a new note replaces the held one rather than joining it.
//
// A held note is DROPPED after a week rather than sent. It names a build, and a
// bug report that arrives long after the build it describes has shipped past is
// noise wearing a timestamp.
let fbFlushing = false;
async function flushFeedback() {
  const n = progress && progress.fbOut;
  if (!n || fbFlushing || !LEADERBOARD.enabled || typeof fetch === 'undefined') return;
  if (Date.now() - (n.at || 0) > FEEDBACK_HOLD_MS) { progress.fbOut = null; saveState(); return; }
  fbFlushing = true;
  try { if (await lbFeedbackSend(n)) { progress.fbOut = null; saveState(); } }
  finally { fbFlushing = false; }
}
const fbHeld = () => !!(progress && progress.fbOut);

// Drop every trace of the old identity from this device after a successful erase.
// The server has deleted the auth user, so the session is already dead — but the
// LABELS are still here, and leaving them would quietly rebuild the same person:
// the next submitted score would mint a fresh uid and then wear the same handle
// on the same boards, which is not what "delete my runs" promised. The remembered
// ranks go too (they point at rows that no longer exist), and so does lastRun —
// otherwise the END screen's rename path could resubmit the just-erased run under
// the new identity moments after it was wiped.
//
// Local PROGRESS is deliberately untouched: campaign completion, settings and
// personal bests never left the device, and erasing a leaderboard presence is not
// a request to lose the game. privacy.html says exactly this.
function lbForgetIdentity() {
  identity.id = ''; identity.autoName = ''; identity.name = '';
  identity.uid = ''; identity.token = ''; identity.tokenExp = 0;
  identity.refresh = ''; identity.service = '';
  ensureIdentity();          // mint a fresh device handle + auto label immediately
  progress.myBoards = {};
  // A HELD NOTE GOES TOO. It carries no player id — the server takes that from
  // the JWT at send time — which is exactly the problem: flushing it after an
  // erase would file the departed player's words under the brand-new identity
  // this function just minted. The server has deleted their feedback; the device
  // must not hand it straight back.
  progress.fbOut = null;
  lastRun = null; lastSubmit = null; lbStatus = '';
  saveState();
}
