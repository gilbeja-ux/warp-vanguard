
'use strict';

// ============================================================
// WARP VANGUARD — dual-thumb radial defense
// ============================================================

const canvas = document.getElementById('game');
// canvas text falls back to system-ui until the display font arrives — force it early
if (document.fonts && document.fonts.load) document.fonts.load('16px Audiowide').catch(() => {});
// alpha:false — AN OPAQUE CANVAS. With the default (alpha:true) the compositor
// must blend the entire canvas against the page on every single frame, a
// full-screen per-pixel operation that buys nothing here: the game paints its own
// background over every pixel, and the page behind it is #03060e, which is what
// an opaque canvas clears to anyway. Costs one word, removes a full-screen blend
// from every frame on every device.
//
// The offscreen bakes in withCanvas() keep their alpha — those genuinely composite.
let ctx = canvas.getContext('2d', { alpha: false }); // rebindable so offscreen layers can reuse the painters
let W = 0, H = 0, DPR = 1;
let SAFE = { t: 0, b: 0, l: 0, r: 0 }; // safe-area insets mapped into game space
function withCanvas(cv, fn) {
  // A REFUSED CONTEXT IS AN ANSWER, NOT A CRASH. A browser at its canvas budget —
  // a long multi-tab session, which is where Gil hit this on 2026-08-29 — hands
  // back null here, and `ctx = null` turned the next drawing call into a throw
  // that unwound through whatever build was in progress. The buffer simply does
  // not get painted; the caller's own guard decides what to do about it.
  const c = cv.getContext('2d');
  if (!c) return false;
  const o = ctx; ctx = c;
  try { fn(); } finally { ctx = o; }
  return true;
}

let ROT = false; // landscape-only: on portrait screens the whole game renders rotated 90°
let lastCw = -1, lastCh = -1, lastDpr = -1, lastRot = null; // what the canvas is CURRENTLY built for
function resize() {
  // A MOUNTED FIELD FREEZES THE GEOMETRY. The only thing that summons a soft
  // keyboard is one of our own text fields (handle entry, MY DATA), and a
  // keyboard is not a viewport change the game should answer:
  //   · Android shrinks window.innerHeight to make room for it, and on a TABLET
  //     held in portrait that shrink can leave the viewport WIDER THAN TALL —
  //     flipping ROT and spinning the whole game 90° under the player, mid-type.
  //     Phones never hit it (portrait stays taller even with a keyboard up),
  //     which is exactly why it survived testing.
  //   · the keyboard fires a BURST of resizes through its open animation, and
  //     every one of them used to re-bake the sky (nine canvases, strips several
  //     screens wide) and the menu cache.
  // Frozen, the canvas simply keeps its pre-keyboard box and the keyboard covers
  // the bottom of it — which is what the player expects to see. clearField()
  // re-runs this once the field is gone, so a REAL rotation performed while
  // typing is picked up the moment the keyboard closes.
  if (overlayEl) return;
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  const cw = window.innerWidth, ch = window.innerHeight;
  ROT = ch > cw;
  // NOTHING MOVED → NOTHING TO REBUILD. A resize event does not imply the
  // viewport actually changed: a scroll-driven URL-bar collapse fires them at
  // the same size, and so does every no-op relayout.
  if (cw === lastCw && ch === lastCh && DPR === lastDpr && ROT === lastRot) return;
  lastCw = cw; lastCh = ch; lastDpr = DPR; lastRot = ROT;
  W = ROT ? ch : cw; H = ROT ? cw : ch;
  canvas.width = cw * DPR; canvas.height = ch * DPR;
  canvas.style.width = cw + 'px'; canvas.style.height = ch + 'px';
  if (ROT) ctx.setTransform(0, DPR, -DPR, 0, cw * DPR, 0);
  else ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  // notch / home-indicator insets, rotated with the game when in portrait
  try {
    const cs = getComputedStyle(document.documentElement);
    const px = v => parseFloat(cs.getPropertyValue(v)) || 0;
    const st = px('--sat'), sb = px('--sab'), sl = px('--sal'), sr = px('--sar');
    SAFE = ROT ? { l: st, r: sb, t: sr, b: sl } : { t: st, b: sb, l: sl, r: sr };
  } catch (e) { SAFE = { t: 0, b: 0, l: 0, r: 0 }; }
  // EACH REBUILD STANDS ALONE. They used to run as three bare statements, so a
  // canvas refused inside the first one threw and the other two never ran — the
  // frame ended up with no menu furniture and a stale UI layer on top of whatever
  // the background got as far as. Gil, 2026-08-29: optimise it so it cannot
  // happen. One failing buffer is a missing buffer, never a missing resize.
  for (const build of [buildBackground, buildMenuCache, syncUiLayer]) {
    try { build(); } catch (e) {}
  }
}
window.addEventListener('resize', resize);
// map screen-space pointer coords into (possibly rotated) game space
function evPos(e) {
  return ROT ? { x: e.clientY, y: window.innerWidth - e.clientX } : { x: e.clientX, y: e.clientY };
}

// ---------- DOM overlay layer (text entry over the canvas) ----------
// The game is drawn on a canvas — and rotated 90° in portrait (ROT) — so a plain
// <input> can't sit at screen coords. This layer is transformed to match the
// canvas exactly, giving a DOM plane whose coordinates ARE game (W×H) space. We
// only ever mount ONE input in it at a time (name / email / OTP), so the native
// mobile keyboard handles text; the canvas draws everything else. Positioned in
// game px, it lines up on top of whatever panel field opened it.
let uiLayer = null, overlayEl = null;
function ensureUiLayer() {
  if (uiLayer) return uiLayer;
  uiLayer = document.createElement('div');
  uiLayer.style.cssText = 'position:fixed;left:0;top:0;transform-origin:0 0;pointer-events:none;z-index:50;';
  document.body.appendChild(uiLayer);
  syncUiLayer();
  return uiLayer;
}
// keep the layer's box + rotation glued to the current canvas transform
function syncUiLayer() {
  if (!uiLayer) return;
  uiLayer.style.width = W + 'px'; uiLayer.style.height = H + 'px';
  // ROT canvas maps game (gx,gy) → css (innerWidth - gy, gx); this is that map
  uiLayer.style.transform = ROT ? 'translate(' + window.innerWidth + 'px,0) rotate(90deg)' : 'none';
}
// mount a text field at game-space rect {x,y,w,h}. opts: value, placeholder,
// type ('text'|'email'), maxLength, onInput(v), onEnter(v). Returns the element.
// `multiline` swaps the <input> for a <textarea>, for the FEEDBACK note. Three
// things change with it and each one is a bug if it does not:
//   · ENTER MUST NOT SEND. On a one-line field Enter is "I am finished"; in a
//     paragraph it is a new line, and preventDefault()ing it leaves a player
//     unable to type a second sentence. So onEnter is simply not wired.
//   · THE TYPE IS NOT AUDIOWIDE. Audiowide is a display face — wide, spaced, all
//     the personality of the game's chrome — and 600 characters of it is both
//     unreadable and far too big for the box. A handle is four words; a bug
//     report is a paragraph, and a paragraph gets a text face.
//   · autocapitalize goes back to 'sentences'. A handle is shouted; a note is
//     written, and forcing lower case on a phone keyboard is a small insult.
function overlayInput(rect, opts) {
  ensureUiLayer(); hideOverlay();
  const multi = !!opts.multiline;
  const el = document.createElement(multi ? 'textarea' : 'input');
  if (!multi) el.type = opts.type || 'text';
  el.value = opts.value || ''; el.placeholder = opts.placeholder || '';
  if (opts.maxLength) el.maxLength = opts.maxLength;
  el.autocapitalize = multi ? 'sentences' : 'off';
  el.autocomplete = opts.autocomplete || 'off'; el.spellcheck = !!multi;
  el.enterKeyHint = multi ? 'enter' : 'done'; el.inputMode = opts.type === 'email' ? 'email' : 'text';
  el.style.cssText = 'position:absolute;box-sizing:border-box;pointer-events:auto;'
    + 'left:' + rect.x + 'px;top:' + rect.y + 'px;width:' + rect.w + 'px;height:' + rect.h + 'px;'
    + 'background:rgba(6,20,40,0.92);border:1.5px solid rgba(140,230,255,0.8);border-radius:6px;'
    + 'color:#eafaff;outline:none;'
    + (multi
      ? 'font:400 14px system-ui, -apple-system, Segoe UI, Roboto, sans-serif;line-height:1.45;'
        + 'letter-spacing:0.2px;padding:8px 11px;resize:none;'
      : 'font:600 15px Audiowide, system-ui;letter-spacing:1px;padding:0 12px;');
  el.addEventListener('input', () => { if (opts.onInput) opts.onInput(el.value); });
  if (!multi) el.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); if (opts.onEnter) opts.onEnter(el.value); } });
  uiLayer.appendChild(el);
  overlayEl = el;
  setTimeout(() => { try { el.focus(); } catch (e) {} }, 0);
  return el;
}
function hideOverlay() { if (overlayEl) { try { overlayEl.remove(); } catch (e) {} overlayEl = null; } }
const overlayValue = () => overlayEl ? overlayEl.value : '';

// ---------- utils ----------
const TAU = Math.PI * 2;
// build stamp: derived from the script's own byte length, so it shifts with
// ANY code change — shown on the home screen to catch stale cached builds
const BUILD = (() => {
  try { return (document.currentScript.textContent.length % 46656).toString(36).toUpperCase().padStart(3, '0'); }
  catch (e) { return '---'; }
})();
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---------- WEEKS: the unit the ranked ladder runs on ----------
// A week is Monday to Sunday, UTC, and a WEEK INDEX is the only thing the ranked
// seed and its board key are derived from — so the lane is identical for everyone
// on Earth for seven days, and the server can recompute which week a submission
// belongs to without trusting the client.
//
// Epoch day 0 (1970-01-01) was a THURSDAY, so the Monday that opens week 0 is day
// -3. That is the whole reason for the +3 before the divide, and the reason not to
// "simplify" it away. Sanity: 2026-08-03 is a Monday and opens its week.
//
// Every week is exactly 7 days. Month-anchored blocks (1-7, 8-14, …) were
// considered and rejected: they end the month with a 3-day block — 1 day in a
// non-leap February — and a ranked ladder where some rounds are a fifth the length
// of others is not a ladder.
const WEEK_MON_OFFSET = 3;
const weekOf = ms => Math.floor((Math.floor(ms / 864e5) + WEEK_MON_OFFSET) / 7);
const weekNow = () => weekOf(Date.now());
const weekStartMs = w => (w * 7 - WEEK_MON_OFFSET) * 864e5;
const weekEndMs = w => weekStartMs(w + 1) - 1;
const MON3 = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
// "3–9 AUG, 2026" · "31 AUG – 6 SEP, 2026" across a month · and both years spelled
// out across a new year, because "28 DEC – 3 JAN, 2027" reads as if December were
// 2027 and the ladder is meant to be a permanent record.
function weekLabel(w) {
  const a = new Date(weekStartMs(w)), b = new Date(weekStartMs(w) + 6 * 864e5);
  const am = a.getUTCMonth(), bm = b.getUTCMonth();
  const ay = a.getUTCFullYear(), by = b.getUTCFullYear();
  if (ay !== by) return a.getUTCDate() + ' ' + MON3[am] + ' ' + ay + ' – ' + b.getUTCDate() + ' ' + MON3[bm] + ' ' + by;
  if (am === bm) return a.getUTCDate() + '–' + b.getUTCDate() + ' ' + MON3[bm] + ', ' + by;
  return a.getUTCDate() + ' ' + MON3[am] + ' – ' + b.getUTCDate() + ' ' + MON3[bm] + ', ' + by;
}
function angDiff(a, b) { let d = (a - b) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; }
const rand = (a, b) => a + Math.random() * (b - a);
