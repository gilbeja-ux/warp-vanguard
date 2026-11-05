// Supabase Edge Function: submit-run
// The ONLY path a score enters the leaderboard. It verifies the run by replaying
// its input trace headless against the seed (campaign/weekly), then writes the
// score with the service role. The client CANNOT write directly (RLS).
//
//   client → POST { run, name } with the player's auth JWT
//   → verify JWT → player_id (server-trusted, never from the body)
//   → verifyRun replays the trace, recomputes the score
//   → campaign/weekly: score must match → upload trace to Storage, write verified=true
//   → endless: REFUSED (400). The endless lane is unseeded — procedural per player,
//     nothing to re-simulate — so it has no board at all since 2026-09-18. It used
//     to be the one trust-only board (sanity-capped, written verified=false); an
//     old client that still files one is turned away here.
//
// Deploy:  supabase functions deploy submit-run
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / SUPABASE_ANON_KEY are auto-injected.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { cleanName } from "../_shared/name.ts";

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

// A hard ceiling on replay work, by mode (audit 2026-11-05; it was one 200_000 frames, ~55 min).
// CAMPAIGN: the longest lane is stage 31, 75 s + 0.70 s burst drain + (2.10 - 0.03) / (0.62 * 0.82)
// = 79.77 s, 4787 frames; 6000 (100 s) leaves 20 s for the 3-5 s tail and a slow device.
// WEEKLY has no end by design (duration Infinity), but the lane stops escalating at surge 15,
// t = 1500 s; 108_000 frames (30 min) sits past that, so only a run past the last wall is refused.
const MAX_TRACE = 6_000;
const MAX_TRACE_WEEKLY = 108_000;
// One frame of a trace as the client records it: {a0, a1, h, f}. Anything else would
// crash the replay (a 500 that reads as a verifier fault) or buy CPU for nothing.
const goodFrame = (f: any) =>
  f && typeof f === "object" && Number.isFinite(f.a0) && Number.isFinite(f.a1)
  && Number.isInteger(f.h) && f.h >= 0 && f.h <= 3
  && (f.f === undefined || f.f === 0 || (Array.isArray(f.f) && f.f.length <= 2 && f.f.every((i: any) => i === 0 || i === 1)));


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

// SHA-256 hex of a string — fingerprints a run's input frames so a replay can be
// bound to its first submitter (H-03). Not a proof on its own: an attacker can
// perturb one no-op frame to change the hash. The PRIVATE traces bucket is the
// real barrier; this catches the naive copy-paste resubmission.
async function sha256hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// THE WEEK, COMPUTED HERE, FROM THIS CLOCK. Mon–Sun, UTC. Epoch day 0 was a
// Thursday, so week 0 opens on day -3 — hence the +3. Must stay identical to weekOf()
// in src/game/00-core.js; it is duplicated rather than imported because this file is
// the trust boundary and has to be able to answer "what week is it" without loading
// the game.
const weekOf = (ms: number) => Math.floor((Math.floor(ms / 864e5) + 3) / 7);
// THE SUNDAY TURN. A lane in flight at 23:59:59 UTC ends on the week that just
// closed. Ten minutes of grace lets that one honest run land on the board it was
// played on; after that a closed week is closed for good.
const WEEK_GRACE_MS = 10 * 60 * 1000;

// rebuild the board key from the VERIFIED run params — never trust the client's
// string (else a level-0 run could be filed under a hard board).
//
// A WEEKLY RUN CAN ONLY EVER LAND ON THE LIVE WEEK. The ladder's whole promise is
// that a closed week is closed for good, so the week is taken from the SERVER's clock
// and the run's claimed seed must match it. A client that replays an old lane — or
// simply lies about which week it played — files nothing: no late entry, no rewriting
// a finished board, no backdating a name onto a week that has already been won.
function boardKeyFor(run: any): string | null {
  if (run.mode === "endless") return null; // no board: unseeded, unverifiable
  if (run.mode === "weekly") {
    const now = Date.now(), live = weekOf(now);
    if (!Number.isInteger(run.seed)) return null;
    if (run.seed === live) return `weekly:${live}`;
    const weekStart = (7 * live - 3) * 864e5; // Monday 00:00 UTC of the live week
    if (run.seed === live - 1 && now - weekStart < WEEK_GRACE_MS) return `weekly:${run.seed}`;
    return null; // closed or bogus week
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

  // REPLAY URL MINTING (H-03). The traces bucket is private, so a replay is
  // fetched through a short-lived signed URL, not a public one. Any authenticated
  // player may watch any replay — that is the social feature — so this only turns
  // a trace id into a signed URL; it does not gate on ownership. The id pattern is
  // pinned to `<board>/<file>.json` so nothing else in the bucket can be reached.
  if (body && body.action === "trace-url") {
    const tid = String(body.traceId ?? "");
    if (!/^[A-Za-z0-9_\-]+\/[A-Za-z0-9_.\-]+\.json$/.test(tid)) return json({ error: "bad traceId" }, 400);
    const { data: signed, error: sErr } = await svc.storage.from("traces").createSignedUrl(tid, 60);
    if (sErr || !signed?.signedUrl) return json({ error: "not found" }, 404);
    const url = signed.signedUrl.startsWith("http") ? signed.signedUrl : SB_URL + signed.signedUrl;
    return json({ url });
  }

  const run = body?.run;
  if (!run || typeof run !== "object") return json({ error: "no run" }, 400);
  if (!Number.isInteger(run.score) || run.score < 0) return json({ error: "bad score" }, 400);
  // a trace is required — every board is a verified board now
  if (!Array.isArray(run.trace) || run.trace.length === 0
    || run.trace.length > (run.mode === "weekly" ? MAX_TRACE_WEEKLY : MAX_TRACE) || !run.trace.every(goodFrame))
    return json({ error: "bad trace" }, 400);

  const board = boardKeyFor(run);
  if (!board) return json({ error: "bad board" }, 400);
  // campaign seed must equal the level it claims (the seed IS the level index)
  if (run.mode === "campaign" && run.seed !== run.levelIdx) return json({ error: "seed/level mismatch" }, 400);

  // the `day` column belonged to the daily lane; the weekly ladder carries its week
  // in the board KEY instead, so every board now writes a NULL day
  const day = null;

  // 3) verify (campaign/weekly)
  let verified = false;
  let score = run.score;
  let traceId: string | null = null;
  let traceHash: string | null = null;
  // detail stats stored on the row (for the leaderboard details panel). They come
  // from the SERVER's replay; the client's claimed numbers below are placeholders
  // that the replay overwrites.
  // timeSec is the boss tie-break (time_sec asc on a %:7 board): for a verified
  // run it is the SERVER's clock, never the client's (audit A1).
  let stat = { maxCombo: run.maxCombo | 0, comboSec: +run.comboSec || 0, zaps: run.zaps | 0, misses: run.misses | 0, perfects: run.perfects | 0, integrity: run.integrity | 0,
    timeSec: Math.max(0, +run.timeSec || 0) };

  {
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
    // THE BAR BEFORE THE REPLAY (audit A6), and AFTER the cheap refusals — a
    // bad board or a stale build spends no slot. Counted in the database under an
    // advisory lock, so a script cannot spend the verifier's CPU. Thirty in ten
    // minutes: a loss files too (endLevel submits every ended lane), so a player
    // dying fast and restarting is about fifteen; a script is thousands.
    const { data: wait, error: barErr } = await svc.rpc("take_submit_slot", { p_player: playerId });
    if (barErr) return json({ error: "write failed", detail: barErr.message }, 500);
    if (typeof wait === "number" && wait > 0) return json({ error: "too many runs", wait }, 429);
    let res;
    try { res = m.verifyRun(run); } catch (e) { return json({ error: "verify crashed", detail: String((e as any)?.stack ?? e) }, 500); }
    // H-03: a bare failure — no recomputed / integrity / steps. Those fields were
    // a brute-force oracle: an attacker replaying a stolen trace could read back
    // the server's numbers to search for the missing w/h + mutators. The client
    // keys "score not verified" off the `error` string, so this stays sufficient.
    if (!res.ok) return json({ error: "verification failed" }, 400);
    verified = true;
    score = res.recomputed; // write the SERVER's number, not the client's
    stat = { maxCombo: res.maxCombo | 0, comboSec: +res.comboSec || 0, zaps: res.zaps | 0, misses: res.misses | 0, perfects: res.perfects | 0, integrity: res.integrity | 0,
      timeSec: Math.max(0, +res.timeSec || 0) };
    // REPLAY-STEALING GUARD (H-03). Fingerprint the input frames and refuse a
    // submission whose frames already belong to a DIFFERENT player. Verifying only
    // proves "these inputs make this score", not "this player played it", so a
    // stolen trace verifies. This binds a frame sequence to its first submitter.
    // Only rows written since the migration carry a hash, so it protects going
    // forward; the private bucket is what stops the frames being downloaded at all.
    traceHash = await sha256hex(JSON.stringify(run.trace));
    const { data: clash } = await svc.from("runs").select("player_id").eq("trace_hash", traceHash).neq("player_id", playerId).limit(1);
    if (clash && clash.length) return json({ error: "replay already submitted by another player" }, 403);
    // persist the trace for the replay player
    // storage object names must avoid ':' (board keys like "investigation:4").
    // Upload via the REST API directly (storage-js was returning opaque errors).
    traceId = `${board.replace(/[^a-zA-Z0-9-]/g, "_")}/${playerId}-${crypto.randomUUID()}.json`;
    // store a SELF-CONTAINED replay package: geometry is canonical now, so
    // (mode, levelIdx, seed) fully reseeds the world — the client replays it
    // faithfully on any screen without needing the board context.
    // v2: the package also carries the take that scored the run and the run's own
    // modifiers, so the replay viewer can rebuild the exact lane (music included)
    // instead of guessing — the client applies both on reseed.
    const pkg = { v: 2, mode: run.mode, levelIdx: run.levelIdx ?? null, seed: run.seed ?? null, campId: run.campId ?? null,
      track: Number.isInteger(run.track) ? run.track : null,
      mutators: Array.isArray(run.mutators) ? run.mutators.filter((m: unknown) => typeof m === "string").slice(0, 8) : [],
      frames: run.trace };
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
  // ORPHAN BOOKKEEPING (audit 2026-11-05). The write may keep the old row's trace (a resubmit that
  // does not beat it) or swap to the new one; either way one file ends up referenced by nothing.
  // Read the row's pointer before and after, and delete whichever file the row no longer holds.
  const runId = cleanRunId(run.runId);
  const rowTrace = async () => (await svc.from("runs").select("trace_id").eq("board", board).eq("player_id", playerId).eq("run_id", runId).maybeSingle()).data?.trace_id ?? null;
  const prevTrace = await rowTrace();
  const { data: evicted, error: wErr } = await svc.rpc("submit_verified_run", {
    p_board: board, p_day: day, p_player: playerId, p_name: cleanName(body.name ?? run.playerName),
    p_run_id: runId,
    p_score: score, p_max_combo: stat.maxCombo, p_combo_sec: stat.comboSec, p_time_sec: stat.timeSec,
    p_integrity: stat.integrity, p_zaps: stat.zaps, p_misses: stat.misses, p_perfects: stat.perfects,
    p_mutators: Array.isArray(run.mutators) ? run.mutators.filter((m: unknown) => typeof m === "string").slice(0, 8) : [], p_seed: run.seed ?? null,
    p_verified: verified, p_trace_id: traceId,
    // the frame hash rides the row itself (audit A7): check and stamp used to be
    // two statements, and two submissions of one stolen trace could pass between
    // them. A partial UNIQUE index on trace_hash now makes the database the judge.
    p_trace_hash: traceHash,
  });
  if (wErr) {
    // ANY failed write leaves the object uploaded a moment ago pointing at no row. 23505 is the
    // trace_hash index: these exact frames are already on the board.
    if (traceId) { const { error: dErr } = await svc.storage.from("traces").remove([traceId]); if (dErr) console.warn(`[submit-run] orphan ${traceId} not removed: ${dErr.message}`); }
    if ((wErr as any).code === "23505") return json({ error: "replay already submitted" }, 403);
    return json({ error: "write failed", detail: wErr.message }, 500);
  }
  const keptTrace = traceId ? await rowTrace() : null;

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
  // a failed read (keptTrace null) deletes nothing: better an orphan than the live replay
  if (keptTrace) for (const t of [traceId, prevTrace]) if (t && t !== keptTrace && !dead.includes(t)) dead.push(t); // the file the row no longer holds
  if (dead.length) {
    const { error: sErr } = await svc.storage.from("traces").remove(dead);
    if (sErr) console.warn(`[submit-run] evicted ${dead.length} trace(s), purge failed: ${sErr.message}`);
  }

  // 5) hand back the standing — the player's BEST row when they hold several
  const { data: rank } = await svc.rpc("leaderboard_rank", { p_board: board, p_day: day, p_player: playerId });
  return json({ ok: true, verified, score, board, rank: rank?.[0] ?? null });

  } catch (e) { return json({ error: "unhandled", detail: String((e as any)?.stack ?? e).slice(0, 500) }, 500); }
});
