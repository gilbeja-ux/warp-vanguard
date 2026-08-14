// Supabase Edge Function: submit-run
// The ONLY path a score enters the leaderboard. It verifies the run by replaying
// its input trace headless against the seed (campaign/weekly), then writes the
// score with the service role. The client CANNOT write directly (RLS).
//
//   client → POST { run, name } with the player's auth JWT
//   → verify JWT → player_id (server-trusted, never from the body)
//   → verifyRun replays the trace, recomputes the score
//   → campaign/weekly: score must match → upload trace to Storage, write verified=true
//   → endless: unseeded → sanity-cap only, write verified=false ("unverified" badge)
//
// Deploy:  supabase functions deploy submit-run
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / SUPABASE_ANON_KEY are auto-injected.
import { createClient } from "jsr:@supabase/supabase-js@2";

// load the sim bundle lazily + defensively so a load failure is REPORTED, not a
// blank 500 (the edge runtime hides top-level import crashes).
let _sim: any = null, _simErr: string | null = null;
async function getSim() {
  if (_sim || _simErr) return _sim;
  try { _sim = await import("./_sim.mjs"); } catch (e) { _simErr = String((e as any)?.stack ?? e); }
  return _sim;
}

// NB: do NOT name this `URL` — it would shadow the global URL constructor.
const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// The sim bundle stubs the GLOBAL fetch (for headless audio) when it loads, which
// would break Supabase calls. Capture the real fetch now, before any getSim(),
// and use it for every Supabase/storage request.
const realFetch = globalThis.fetch.bind(globalThis);
const svcClient = () => createClient(SB_URL, SERVICE, { global: { fetch: realFetch } });

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const MAX_TRACE = 200_000;       // ~55 min at 60Hz — a hard ceiling to bound work
const MAX_ENDLESS = 100_000_000; // trust-only sanity cap for the unseeded board

// ---------------------------------------------------------------------------
// Name moderation — the SERVER-side backstop for the arcade handle. The client
// live-filters as the player types (UX), but that's bypassable, so every name is
// re-checked here before it can land on a public board. A run's SCORE is legit
// even if its name is filthy, so we don't reject the submit — we neutralise the
// name (→ "REDACTED") and keep the score. Matching is done on a normalised form
// (lowercased, separators stripped, common leet unmapped) so "a_s_s" / "@ss" /
// "4ss" don't sail through. Extend BLOCKED as needed.
const BLOCKED = [
  "nigger", "nigga", "faggot", "retard", "rape", "rapist", "cunt", "spic",
  "chink", "kike", "wetback", "coon", "fuck", "shit", "bitch", "bastard",
  "dick", "cock", "penis", "pussy", "vagina", "whore", "slut", "boner",
  "cum", "jizz", "wank", "twat", "prick", "asshole", "anus", "sex", "porn",
  "nazi", "hitler", "isis", "kkk", "pedo", "molest", "incest", "semen",
];
const LEET: Record<string, string> = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "8": "b", "@": "a", "$": "s", "!": "i" };
function cleanName(n: unknown): string {
  const clean = String(n ?? "").replace(/[^\w \-]/g, "").replace(/\s+/g, " ").trim().slice(0, 14);
  if (!clean) return "";
  const norm = clean.toLowerCase().replace(/[\s_\-]/g, "").replace(/[013457@$!]/g, (c) => LEET[c] ?? c);
  return BLOCKED.some((w) => norm.includes(w)) ? "REDACTED" : clean;
}

// The client's per-run id — the leaderboard row key WITHIN this player's rows.
// A fresh run mints a fresh id (→ a new row, so earlier records survive); the
// rename re-submit sends the same one (→ that row is updated in place). Kept to
// a safe charset and length since it goes straight into a unique key. An empty /
// junk value degrades to '' — the old one-row-per-player behaviour, which is the
// right fallback for a stale app build.
function cleanRunId(v: unknown): string {
  return String(v ?? "").replace(/[^a-zA-Z0-9._-]/g, "").slice(0, 64);
}

// decode a JWT's `sub` claim (the user id). Signature is validated upstream by
// the platform's verify_jwt gate, so this is trustworthy.
function jwtSub(token: string): string | null {
  try {
    const p = token.split(".")[1];
    const json = atob(p.replace(/-/g, "+").replace(/_/g, "/").padEnd(p.length + (4 - p.length % 4) % 4, "="));
    return JSON.parse(json).sub || null;
  } catch { return null; }
}

// THE WEEK, COMPUTED HERE, FROM THIS CLOCK. Mon–Sun, UTC. Epoch day 0 was a
// Thursday, so week 0 opens on day -3 — hence the +3. Must stay identical to weekOf()
// in src/game/00-core.js; it is duplicated rather than imported because this file is
// the trust boundary and has to be able to answer "what week is it" without loading
// the game.
const weekOf = (ms: number) => Math.floor((Math.floor(ms / 864e5) + 3) / 7);

// rebuild the board key from the VERIFIED run params — never trust the client's
// string (else a level-0 run could be filed under a hard board).
//
// A WEEKLY RUN CAN ONLY EVER LAND ON THE LIVE WEEK. The ladder's whole promise is
// that a closed week is closed for good, so the week is taken from the SERVER's clock
// and the run's claimed seed must match it. A client that replays an old lane — or
// simply lies about which week it played — files nothing: no late entry, no rewriting
// a finished board, no backdating a name onto a week that has already been won.
function boardKeyFor(run: any): string | null {
  if (run.mode === "endless") return "endless";
  if (run.mode === "weekly") {
    const live = weekOf(Date.now());
    if (!Number.isInteger(run.seed) || run.seed !== live) return null; // closed or bogus week
    return `weekly:${live}`;
  }
  if (run.mode === "campaign" && typeof run.campId === "string" && Number.isInteger(run.levelIdx))
    return `${run.campId}:${run.levelIdx}`;
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  // health check (needs a valid JWT like everything else): confirms the sim loads
  const dq = new URL(req.url).searchParams;
  if (dq.get("diag")) {
    const m = await getSim();
    if (!m) return json({ importError: _simErr }, 500);
    try { return json(m._diag()); } catch (e) { return json({ diagError: String((e as any)?.stack ?? e) }, 500); }
  }
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  try {

  const svc = svcClient();

  // 1) server-verified identity from the JWT. The platform's verify_jwt gate (on
  //    — see config.toml) has already validated the SIGNATURE before we run, so
  //    the `sub` claim is trustworthy; decode it for the player id.
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  const playerId = jwtSub(token);
  if (!playerId) return json({ error: "not authenticated" }, 401);

  // 2) parse + shape-check
  let body: any;
  try { body = await req.json(); } catch { return json({ error: "bad json" }, 400); }
  const run = body?.run;
  if (!run || typeof run !== "object") return json({ error: "no run" }, 400);
  if (!Number.isInteger(run.score) || run.score < 0) return json({ error: "bad score" }, 400);
  // a trace is required for the verifiable modes; endless is trust-only (no trace)
  if (run.mode !== "endless" && (!Array.isArray(run.trace) || run.trace.length === 0 || run.trace.length > MAX_TRACE))
    return json({ error: "bad trace" }, 400);

  const board = boardKeyFor(run);
  if (!board) return json({ error: "bad board" }, 400);
  // campaign seed must equal the level it claims (the seed IS the level index)
  if (run.mode === "campaign" && run.seed !== run.levelIdx) return json({ error: "seed/level mismatch" }, 400);

  // the `day` column belonged to the daily lane; the weekly ladder carries its week
  // in the board KEY instead, so every board now writes a NULL day
  const day = null;

  // 3) verify (campaign/weekly) or sanity-cap (endless)
  let verified = false;
  let score = run.score;
  let traceId: string | null = null;
  // detail stats stored on the row (for the leaderboard details panel). For a
  // verified run these come from the SERVER's replay; for endless (trust-only)
  // they're the client's own claimed numbers.
  let stat = { maxCombo: run.maxCombo | 0, comboSec: +run.comboSec || 0, zaps: run.zaps | 0, misses: run.misses | 0, perfects: run.perfects | 0, integrity: run.integrity | 0 };

  if (run.mode === "endless") {
    if (run.score > MAX_ENDLESS) return json({ error: "implausible score" }, 400);
    verified = false; // unseeded → trust-only, tagged "unverified" in the UI
  } else {
    const m = await getSim();
    if (!m) return json({ error: "sim load failed", detail: _simErr }, 500);
    // ---- OUT OF DATE, OR FORGED? ----
    // Verification replays the run with THIS build's copy of the game. A client
    // on an older build computes a different run from the same inputs, so its
    // score fails to match — and, from here, that is indistinguishable from a
    // forgery. It was being reported as one, which tells an honest player that
    // their legitimate run "failed verification".
    //
    // The client now states which rules it played by. A mismatch is answered
    // 409 with a distinct error, so the app can say "update available" instead.
    // It is NOT waved through: an old build plays by different rules, so its
    // scores genuinely are not comparable and do not belong on the same board.
    // Clients that send no id at all (dev builds) skip the check and are
    // verified normally — they will simply fail if they really are stale.
    const clientSim = typeof body?.simId === "string" ? body.simId : null;
    const clientBoard = typeof body?.boardSim === "string" ? body.boardSim : null;
    // THE CHECK IS PER BOARD. The old one compared a hash of the whole build, so
    // a menu colour or a comment told every player their client was outdated and
    // rejected scores that could not possibly have been affected. A board's
    // behavioural id moves only when that board would score a run differently —
    // see scripts/lib/sim-fingerprint.js.
    //
    // This is not a loosening of trust. The trace is still fully re-simulated
    // against this bundle; the id only decides whether to answer "your build is
    // too old" instead of scoring a run whose numbers could never match.
    const boards = (m.SIM_LEVELS ?? null) as Record<string, string> | null;
    const boardKeyForSim = run.mode === "weekly" ? "weekly"
      : (run.mode === "campaign" && typeof run.campId === "string" && Number.isInteger(run.levelIdx))
        ? `${run.campId}:${run.levelIdx}` : null;
    const wantBoard = boards && boardKeyForSim ? boards[boardKeyForSim] ?? null : null;
    if (clientBoard && wantBoard && clientBoard !== wantBoard)
      return json({ error: "client outdated", board: boardKeyForSim, clientSim: clientBoard, serverSim: wantBoard }, 409);
    // FALLBACK for a client built before per-board ids existed: the old
    // build-wide comparison, with its rollout window. Once every client in the
    // wild sends boardSim this branch stops being reachable.
    if (!clientBoard && clientSim) {
      const accepted: string[] = Array.isArray(m.SIM_ACCEPT) && m.SIM_ACCEPT.length
        ? m.SIM_ACCEPT : (m.SIM_ID ? [m.SIM_ID] : []);
      if (accepted.length && !accepted.includes(clientSim))
        return json({ error: "client outdated", clientSim, serverSim: m.SIM_ID }, 409);
    }
    let res;
    try { res = m.verifyRun(run); } catch (e) { return json({ error: "verify crashed", detail: String((e as any)?.stack ?? e) }, 500); }
    if (!res.ok) return json({ error: "verification failed", claimed: run.score, recomputed: res.recomputed, integrity: res.integrity, steps: res.steps, traceLen: run.trace.length }, 400);
    verified = true;
    score = res.recomputed; // write the SERVER's number, not the client's
    stat = { maxCombo: res.maxCombo | 0, comboSec: +res.comboSec || 0, zaps: res.zaps | 0, misses: res.misses | 0, perfects: res.perfects | 0, integrity: res.integrity | 0 };
    // persist the trace for the replay player
    // storage object names must avoid ':' (board keys like "investigation:4").
    // Upload via the REST API directly (storage-js was returning opaque errors).
    traceId = `${board.replace(/[^a-zA-Z0-9-]/g, "_")}/${playerId}-${crypto.randomUUID()}.json`;
    // store a SELF-CONTAINED replay package: geometry is canonical now, so
    // (mode, levelIdx, seed) fully reseeds the world — the client replays it
    // faithfully on any screen without needing the board context.
    const pkg = { v: 1, mode: run.mode, levelIdx: run.levelIdx ?? null, seed: run.seed ?? null, campId: run.campId ?? null, frames: run.trace };
    const up = await realFetch(`${SB_URL}/storage/v1/object/traces/${traceId}`, {
      method: "POST",
      headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json", "x-upsert": "true" },
      body: JSON.stringify(pkg),
    });
    if (!up.ok) return json({ error: "trace upload failed", status: up.status, detail: (await up.text()).slice(0, 300) }, 500);
  }

  // 4) the only write — one row per RUN (a player can hold several on a board),
  //    carrying the trace pointer. run_id is the row key, scoped by player_id, so
  //    it can only ever address this player's own row: worst case they overwrite
  //    a run of their own, which is exactly what the rename flow wants.
  const { data: evicted, error: wErr } = await svc.rpc("submit_verified_run", {
    p_board: board, p_day: day, p_player: playerId, p_name: cleanName(body.name ?? run.playerName),
    p_run_id: cleanRunId(run.runId),
    p_score: score, p_max_combo: stat.maxCombo, p_combo_sec: stat.comboSec, p_time_sec: +run.timeSec || 0,
    p_integrity: stat.integrity, p_zaps: stat.zaps, p_misses: stat.misses, p_perfects: stat.perfects,
    p_mutators: Array.isArray(run.mutators) ? run.mutators : [], p_seed: run.seed ?? null,
    p_verified: verified, p_trace_id: traceId,
  });
  if (wErr) return json({ error: "write failed", detail: wErr.message }, 500);

  // ---- PURGE THE REPLAYS THAT JUST FELL OFF THE BOARD ----
  // The write above evicts everything past the top 100 and hands back the trace
  // keys those rows were holding. Postgres cannot reach Storage, so if we do not
  // delete them here nobody ever will: the object outlives its row for ever,
  // referenced by nothing and reachable by nothing. Before the pre-Play wipe the
  // bucket held 337 objects against 228 live pointers — a third of it garbage,
  // and the ratio only grows, because the busier a board is the more it evicts.
  //
  // Best-effort and never fatal. The score is already safely on the board by this
  // point, and failing a player's submission because a cleanup job could not
  // delete somebody else's old file would be the wrong trade every time. A miss
  // leaves an orphan — the exact thing that was happening on every write before.
  const dead = (evicted ?? [])
    .map((r: any) => r?.evicted_trace)
    .filter((t: unknown): t is string => typeof t === "string" && !!t);
  if (dead.length) {
    const { error: sErr } = await svc.storage.from("traces").remove(dead);
    if (sErr) console.warn(`[submit-run] evicted ${dead.length} trace(s), purge failed: ${sErr.message}`);
  }

  // 5) hand back the standing — the player's BEST row when they hold several
  const { data: rank } = await svc.rpc("leaderboard_rank", { p_board: board, p_day: day, p_player: playerId });
  return json({ ok: true, verified, score, board, rank: rank?.[0] ?? null });

  } catch (e) { return json({ error: "unhandled", detail: String((e as any)?.stack ?? e).slice(0, 500) }, 500); }
});
