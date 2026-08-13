// Supabase Edge Function: my-data
// The player acting on their OWN leaderboard entries — rename them all, or erase
// them all. Sibling of submit-run, and it works the same way: the client cannot
// touch the runs table (RLS locks writes to the service role), so both verbs go
// through here, and the identity comes from the JWT rather than the body.
//
//   client → POST { action: "rename", name } with the player's auth JWT
//          → verify JWT → player_id → rename_my_runs across every board
//
//   client → POST { action: "delete" } with the player's auth JWT
//          → verify JWT → player_id → delete_my_runs
//          → purge the replay traces those rows pointed at
//          → delete the anonymous auth user itself
//
// THE JWT IS THE PROOF OF OWNERSHIP, and it is the only proof available. These
// are anonymous arcade identities: there is no email to mail a confirmation link
// to, no password to re-enter, and a display name is not evidence of anything —
// anyone can read one off a public board and claim it. What a player does have is
// the device holding the session, and possession of a valid token for `sub` IS
// possession of that identity. So the id is never read from the request body; a
// forged body can only ever address the identity it already holds.
//
// Deploy:  supabase functions deploy my-data --use-api
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are auto-injected.
import { createClient } from "jsr:@supabase/supabase-js@2";

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const svcClient = () => createClient(SB_URL, SERVICE);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

// ---------------------------------------------------------------------------
// Name moderation. DUPLICATED from submit-run rather than shared, for the same
// reason weekOf() is duplicated there: this file is a trust boundary and must be
// able to answer "is this name allowed on a public board" on its own. A rename
// that skipped the filter would be a hole straight through submit-run's gate —
// post a clean name, then rename to whatever you liked.
// Keep the two lists in step.
// ---------------------------------------------------------------------------
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

// decode a JWT's `sub` claim (the user id). Signature is validated upstream by
// the platform's verify_jwt gate, so this is trustworthy.
function jwtSub(token: string): string | null {
  try {
    const p = token.split(".")[1];
    const j = atob(p.replace(/-/g, "+").replace(/_/g, "/").padEnd(p.length + (4 - p.length % 4) % 4, "="));
    return JSON.parse(j).sub || null;
  } catch { return null; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  try {

  const svc = svcClient();

  // 1) server-verified identity. The platform's verify_jwt gate (see config.toml)
  //    has already checked the signature, so `sub` is trustworthy.
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const playerId = jwtSub(token);
  if (!playerId) return json({ error: "not authenticated" }, 401);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "bad json" }, 400); }
  const action = body?.action;

  // ---- RENAME: every row, every board ----------------------------------
  if (action === "rename") {
    // An empty name is a refusal, not a clear: blanking the field would leave a
    // nameless row on a public board with no way to put a name back on it from
    // the client (the entry card only appears on a fresh high score). A player
    // who wants their name OFF the board wants the auto handle, and the client
    // sends that; it is a real name here like any other.
    const name = cleanName(body?.name);
    if (!name) return json({ error: "bad name" }, 400);
    const { data, error } = await svc.rpc("rename_my_runs", { p_player: playerId, p_name: name });
    if (error) return json({ error: "rename failed", detail: error.message }, 500);
    // rename_my_runs answers with three numbers rather than a count, because
    // "nothing happened" has three different causes the player deserves apart:
    //   waitSec > 0  — the daily cooldown; nothing was touched
    //   locked  > 0  — rows a moderator neutralised, which a rename must not undo
    //   rows    = 0  — they simply hold no entries yet
    const r = (data as any[])?.[0] ?? {};
    const rows = r.renamed ?? 0, locked = r.locked ?? 0, waitSec = r.wait_sec ?? 0;
    // The name is only theirs now if something actually moved. Reporting the
    // requested name after a refused rename would leave the client's local handle
    // disagreeing with every board.
    return json({ ok: true, action, name: rows > 0 ? name : null, rows, locked, waitSec });
  }

  // ---- DELETE: rows, then traces, then the identity itself -------------
  if (action === "delete") {
    // Order matters. The rows come first and hand back their trace keys as they
    // go: the keys only exist ON the rows, so purging Storage first would mean
    // reading them, deleting objects, then deleting rows — and a failure in the
    // middle of that leaves rows pointing at traces that are already gone (a
    // board full of Replay buttons that 404). This way a mid-flight failure
    // leaves orphaned OBJECTS instead, which nothing links to and nothing shows.
    const { data: rows, error } = await svc.rpc("delete_my_runs", { p_player: playerId });
    if (error) return json({ error: "delete failed", detail: error.message }, 500);

    const traces: string[] = (rows ?? [])
      .map((r: any) => r?.trace_id)
      .filter((t: unknown): t is string => typeof t === "string" && !!t);

    // Purge the replay objects. Best-effort and NOT fatal: the rows are already
    // gone, so the entries are off every board either way, and failing the whole
    // request here would tell a player their data survived when the visible part
    // of it did not. Orphans are logged for a sweep, not surfaced.
    let tracesDeleted = 0;
    if (traces.length) {
      const { data: gone, error: sErr } = await svc.storage.from("traces").remove(traces);
      if (sErr) console.warn("[my-data] trace purge failed for " + playerId + ": " + sErr.message);
      else tracesDeleted = gone?.length ?? 0;
    }

    // Finally the anonymous user itself. Without this the rows are gone but the
    // identifier that tied them together still exists in auth.users — which is
    // the one piece of this that is unambiguously personal data, so leaving it
    // behind would make "deleted" a half-truth. It goes LAST because it
    // invalidates the very token that authorised this request.
    let identityDeleted = false;
    const { error: uErr } = await svc.auth.admin.deleteUser(playerId);
    if (uErr) console.warn("[my-data] auth user delete failed for " + playerId + ": " + uErr.message);
    else identityDeleted = true;

    // `rows` counts every entry removed; `traces` is the subset that had a replay
    // (endless runs carry none), so they are reported separately rather than one
    // standing in for the other.
    return json({ ok: true, action, rows: rows?.length ?? 0, tracesDeleted, identityDeleted });
  }

  return json({ error: "bad action" }, 400);

  } catch (e) { return json({ error: "unhandled", detail: String((e as any)?.stack ?? e).slice(0, 500) }, 500); }
});
