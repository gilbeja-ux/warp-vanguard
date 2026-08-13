// Supabase Edge Function: report-run
// A player flagging SOMEONE ELSE's handle on a public board. Sibling of submit-run
// and my-data, same shape: the client cannot touch the tables (RLS), the identity
// comes from the JWT, and the service role does the write.
//
//   client → POST { runId, reason } with the reporter's auth JWT
//          → verify JWT → reporter id → report_run
//          → one report per (row, reporter); at 3 distinct reporters an
//            UNVERIFIED row's name is redacted and locked (see the migration)
//
// It lives apart from my-data deliberately: that function is a player acting on
// their own identity, this one is a player acting on a stranger's row. Folding
// them together would make one JWT-authorised endpoint that both erases you and
// moderates other people, which is a worse thing to reason about than two files.
//
// WHAT COMES BACK IS ALWAYS THE SAME. The reporter is never told how many others
// reported the row, whether the threshold was crossed, or whether anything was
// redacted — that would publish the bar and turn it into a target. They are told
// their report landed, because it did.
//
// Deploy:  supabase functions deploy report-run --use-api
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

// A CLOSED SET, not free text. Free text would itself be user-generated content
// needing moderation — and it is the field an already-angry person types abuse
// into. These four are also the only reasons that can be acted on mechanically.
const REASONS = new Set(["offensive", "personal", "impersonation", "other"]);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const reporter = jwtSub(token);
  if (!reporter) return json({ error: "not authenticated" }, 401);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "bad json" }, 400); }

  const runId = String(body?.runId ?? "");
  if (!UUID.test(runId)) return json({ error: "bad run" }, 400);
  const reason = REASONS.has(body?.reason) ? body.reason : "other";

  const { data, error } = await svcClient().rpc("report_run", {
    p_run: runId, p_reporter: reporter, p_reason: reason,
  });
  if (error) return json({ error: "report failed", detail: error.message }, 500);

  // logged, not returned — a human reads this when deciding whether a run that
  // sat below the threshold (or a VERIFIED one, which never auto-redacts) needs
  // looking at by hand
  const r = (data as any[])?.[0];
  if (r) console.log(`[report-run] ${runId} reason=${reason} reports=${r.reports} redacted=${r.redacted}`);

  return json({ ok: true });

  } catch (e) { return json({ error: "unhandled", detail: String((e as any)?.stack ?? e).slice(0, 500) }, 500); }
});
