// The ONE name filter. submit-run files a handle through it and my-data renames through it
// (audit 2026-11-05: my-data kept an older, weaker copy that drifted). Pinned by npm test.
// ---------------------------------------------------------------------------
// Name moderation — the SERVER-side backstop for the arcade handle. The client
// live-filters as the player types (UX), but that's bypassable, so every name is
// re-checked here before it can land on a public board. A run's SCORE is legit
// even if its name is filthy, so we don't reject the submit — we neutralise the
// name (→ "REDACTED") and keep the score.
//
// H-26 rebuilt the matching in three ways:
//
//   1. FOLD BEFORE STRIP. The old filter deleted every non-ASCII character and
//      then matched, so "FUСK" with a Cyrillic С became the displayed "FUK" —
//      not blocked, and still legible as the word. Confusables are now mapped to
//      their Latin twins FIRST, so that name normalises to "fuck" and is caught.
//      NFKC handles the width/ligature families (ｎ, ﬁ, ①); NFD-plus-mark-strip
//      handles the accents (é → e); the FOLD table handles the rest, which is
//      the Cyrillic and Greek lookalikes Unicode will never merge for us.
//
//   2. TWO LISTS, TWO TESTS. Matching every word as a substring is what redacts
//      SCUNTHORPE, ESSEX, RACCOON, TORPEDO and CRISIS. Words that embed innocently
//      live in BLOCKED_WORD and must appear as a whole word; the unambiguous slurs
//      stay in BLOCKED_SUB and match anywhere, including through spacing tricks.
//      The cost is real and accepted: "CUMLORD" passes. The report pipe (three
//      reporters → auto-redact) is the second line for exactly that case, and a
//      false redaction of an innocent handle has no such appeal route.
//
//   3. A SERVER MIN-LENGTH. The client refuses a 1-character handle; nothing did
//      on this side, so a hand-rolled POST could take a single letter — or a lone
//      "I" — onto a public board. Under two characters now degrades to "", which
//      the boards already render as ANON.
const BLOCKED_SUB = [
  "nigger", "nigga", "faggot", "retard", "rapist", "kike", "wetback",
  "fuck", "bitch", "bastard", "asshole", "pussy", "vagina", "whore", "slut",
  "porn", "hitler", "kkk", "molest", "incest", "penis",
];
const BLOCKED_WORD = [
  "rape", "spic", "chink", "coon", "shit", "dick", "cock", "boner", "cum",
  "cunt", "jizz", "wank", "twat", "prick", "anus", "sex", "nazi", "isis",
  "pedo", "semen",
];
const LEET: Record<string, string> = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "8": "b", "@": "a", "$": "s", "!": "i" };

// Confusables Unicode does NOT normalise away, because they are genuinely
// different letters — they only LOOK the same. Cyrillic first, then Greek, then
// the odd Latin letter with a stroke that NFD cannot decompose.
const FOLD: Record<string, string> = {
  // Cyrillic. Looked up lowercased, which is what catches the uppercase pairs —
  // А Е О Р С Т У Х В К М Н are pixel-identical to their Latin twins.
  "а": "a", "в": "b", "е": "e", "ё": "e", "з": "3", "к": "k", "м": "m", "н": "h",
  "о": "o", "р": "p", "с": "c", "т": "t", "у": "y", "х": "x", "ѕ": "s", "і": "i",
  "ї": "i", "ј": "j", "ԁ": "d", "һ": "h", "ԛ": "q", "ԝ": "w", "ӏ": "l",
  // Greek.
  "α": "a", "β": "b", "γ": "y", "ε": "e", "ζ": "z", "η": "n", "ι": "i", "κ": "k",
  "μ": "u", "ν": "v", "ο": "o", "ρ": "p", "τ": "t", "υ": "u", "χ": "x",
  // Latin letters whose stroke or ligature NFD cannot take apart.
  "ł": "l", "ø": "o", "đ": "d", "ð": "d", "þ": "p", "ı": "i", "ſ": "s", "œ": "oe",
  "æ": "ae", "ß": "ss",
};

// One canonical form, used for BOTH the display name and the match. Everything
// that follows reads ASCII, which is what the rest of this pipeline expects.
function foldName(raw: string): string {
  let s = raw.normalize("NFKC").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  s = s.replace(/[^\x00-\x7f]/g, (c) => FOLD[c.toLowerCase()] ?? FOLD[c] ?? c);
  return s;
}

export function cleanName(n: unknown): string {
  const src = foldName(String(n ?? ""));
  const clean = src.replace(/[^\w \-]/g, "").replace(/\s+/g, " ").trim().slice(0, 14);
  // Under two characters is not a handle. Empty is the honest answer, and the
  // boards already print ANON for it.
  if (clean.length < 2) return "";
  // LEET RUNS BEFORE THE PUNCTUATION STRIP, and that ordering is the fix. The old
  // filter stripped "@", "$" and "!" as non-word characters and only then consulted
  // the LEET table, so those three entries could never fire and "$h!t" sailed
  // through. Read the symbol while it is still there, then strip.
  const leet = src.toLowerCase().replace(/[013457@$!]/g, (c) => LEET[c] ?? c)
    .replace(/[^\w \-]/g, "").replace(/\s+/g, " ").trim().slice(0, 14);
  // TIGHT drops every separator, so "n i g g e r" collapses to the word. LOOSE
  // keeps one space per separator run, so a word test has boundaries to anchor to.
  // The two forms exist because the two lists need opposite things.
  const tight = leet.replace(/[\s_\-]/g, "");
  const loose = leet.replace(/[_\-]+/g, " ").replace(/\s+/g, " ").trim();
  if (BLOCKED_SUB.some((w) => tight.includes(w))) return "REDACTED";
  // A word match, or the whole handle being nothing but that word — so a bare
  // "SEX" and a spaced "S E X" are both caught while ESSEX is not.
  if (BLOCKED_WORD.some((w) => new RegExp(`(^| )${w}(s|z|ed|er|ing)?( |$)`).test(loose) || tight === w)) return "REDACTED";
  return clean;
}
