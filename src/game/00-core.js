
'use strict';

// ============================================================
// WARP VANGUARD — dual-thumb radial defense
// ============================================================

const canvas = document.getElementById('game');
// canvas text falls back to system-ui until the display font arrives — force it early
if (document.fonts && document.fonts.load) document.fonts.load('16px Audiowide').catch(() => {});
let ctx = canvas.getContext('2d'); // rebindable so offscreen layers can reuse the painters
let W = 0, H = 0, DPR = 1;
let SAFE = { t: 0, b: 0, l: 0, r: 0 }; // safe-area insets mapped into game space
function withCanvas(cv, fn) {
  const o = ctx; ctx = cv.getContext('2d');
  try { fn(); } finally { ctx = o; }
}

let ROT = false; // landscape-only: on portrait screens the whole game renders rotated 90°
function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  const cw = window.innerWidth, ch = window.innerHeight;
  ROT = ch > cw;
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
  buildBackground();
  buildMenuCache();
  syncUiLayer();
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
function overlayInput(rect, opts) {
  ensureUiLayer(); hideOverlay();
  const el = document.createElement('input');
  el.type = opts.type || 'text';
  el.value = opts.value || ''; el.placeholder = opts.placeholder || '';
  if (opts.maxLength) el.maxLength = opts.maxLength;
  el.autocapitalize = 'off'; el.autocomplete = opts.autocomplete || 'off'; el.spellcheck = false;
  el.enterKeyHint = 'done'; el.inputMode = opts.type === 'email' ? 'email' : 'text';
  el.style.cssText = 'position:absolute;box-sizing:border-box;pointer-events:auto;'
    + 'left:' + rect.x + 'px;top:' + rect.y + 'px;width:' + rect.w + 'px;height:' + rect.h + 'px;'
    + 'background:rgba(6,20,40,0.92);border:1.5px solid rgba(140,230,255,0.8);border-radius:6px;'
    + 'color:#eafaff;font:600 15px Audiowide, system-ui;letter-spacing:1px;padding:0 12px;outline:none;';
  el.addEventListener('input', () => { if (opts.onInput) opts.onInput(el.value); });
  el.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); if (opts.onEnter) opts.onEnter(el.value); } });
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
function angDiff(a, b) { let d = (a - b) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; }
const rand = (a, b) => a + Math.random() * (b - a);
