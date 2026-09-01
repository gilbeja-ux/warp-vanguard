// Supabase Edge Function: send-feedback
// A player writing a private note to the developer. Fourth sibling of submit-run,
// my-data and report-run, same shape: the client cannot touch the table (RLS), the
// identity comes from the JWT, and the service role does the write.
//
//   client → POST { topic, text, meta } with the player's auth JWT
//          → verify JWT → player id → file_feedback
//          → the row lands, or the rate bar drops it. Either way: { ok: true }
//
// It lives apart from report-run deliberately, even though the two are nearly the
// same file. That one is a player acting on a STRANGER's row and its payload is a
// closed set of reasons; this one is a player writing FREE TEXT about the game to
// the person who wrote it. Folding them together would put a moderation endpoint
// and a suggestion box behind one door, and the free-text field would inherit the
// argument for why report-run must never have one.
//
// WHAT COMES BACK IS ALWAYS THE SAME. The writer is never told that a note was
// dropped for coming too soon, or that they have used today's five. Publishing a
// bar makes it a target — the same reasoning report-run uses for its threshold —
// and there is a kinder reason too: someone told "refused" retypes the note and
// sends it four more times. The drop is logged, where a developer can see it.
//
// Deploy:  supabase functions deploy send-feedback --use-api
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

// A CLOSED SET, because it routes a queue rather than describing a note. The words
// the player reads are longer and warmer ('TOO HARD / TOO EASY'); these are the
// keys, and they match the table's check constraint exactly.
const TOPICS = new Set(["bug", "idea", "balance", "other"]);

// The one hard limit on the text. 600 is enough for a real bug report and short
// enough that a queue of them stays readable. The client caps it too — this is the
// copy that matters, because a client is a request header away from being a script.
const BODY_MAX = 600;

// The two context fields are short labels, never prose. A cap on each keeps a
// forged body from turning the row into a payload.
const META_MAX = 120;

// Control characters would survive into the admin console and break its layout;
// a newline is the one a player types on purpose, so it survives.
const clean = (v: unknown, max: number) =>
  typeof v === "string"
    ? v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ").slice(0, max).trim() || null
    : null;

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
  const player = jwtSub(token);
  if (!player) return json({ error: "not authenticated" }, 401);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "bad json" }, 400); }

  // An empty note is the ONE thing worth refusing out loud. It cannot be a rate
  // bar the player must not learn about, and it cannot be anything but a bug on
  // this side — the panel locks SEND until a character is typed.
  const text = clean(body?.text, BODY_MAX);
  if (!text) return json({ error: "empty note" }, 400);

  const topic = TOPICS.has(body?.topic) ? body.topic : "other";
  const meta = body?.meta ?? {};

  const { data, error } = await svcClient().rpc("file_feedback", {
    p_player: player,
    p_topic: topic,
    p_body: text,
    p_build: clean(meta.build, META_MAX),
    p_device: clean(meta.device, META_MAX),
    p_screen: clean(meta.screen, META_MAX),
    p_place: clean(meta.place, META_MAX),
  });
  // A REAL FAILURE IS STILL A FAILURE. The rate bar is silent, but a database that
  // did not answer is not a bar — saying ok there would throw away a note the
  // player believes they sent. The client holds it in its outbox and retries.
  if (error) return json({ error: "feedback failed", detail: error.message }, 500);

  // logged, not returned — this is where a developer sees that someone hit the bar
  const r = (data as any[])?.[0];
  if (r) console.log(`[send-feedback] topic=${topic} filed=${r.filed}${r.dropped ? ` dropped=${r.dropped}` : ""}`);

  return json({ ok: true });

  } catch (e) { return json({ error: "unhandled", detail: String((e as any)?.stack ?? e).slice(0, 500) }, 500); }
});
