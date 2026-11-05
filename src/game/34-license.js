'use strict';
// ============================================================================
// THE LICENSE: contracts 3, 4 and 5 behind one purchase (Gil, 2026-11-05)
// ============================================================================
// Contracts 1 and 2 (stages 01-16) are free, and so is the ENDLESS lane. One
// non-consumable purchase, the same product id on both stores, opens contracts
// 3, 4 and 5 (stages 17-40). This replaces the plan of 2026-08-17 (one unlock at
// the stage-09 seam): same structure, same two principles, a later seam.
//
// THE PRICE LIVES IN THE STORE CONSOLES. The game prints the string the store
// hands back, already localized (its currency, its decimal mark, its order), and
// never a number of its own. With no answer yet the key says UNLOCK and nothing else.
//
// TWO PRINCIPLES, unchanged since 2026-08-17:
// 1. A LICENSE IS NOT PROGRESS. `license` (32-save.js) rides its own key in the
//    save. RESET CONTRACT wipes a contract's PROG, the MY DATA erase deletes runs
//    on the boards; neither reads or writes `license`.
// 2. NO DRM. A plain client gate. The boards are guarded by the server's replay
//    verifier, not by this flag: a forged flag still cannot forge a run. Nothing
//    here is hardened, on purpose.
//
// THE WALL IS INSIDE startLevel (60-input.js), so every door hits it: the stage
// list, NEXT CONTRACT, the board's FLY THIS LANE, the passcode boss drill, any
// door added later. The doors also check first (contractLocked) so they can
// open the offer cleanly instead of starting a transition that goes nowhere.

const FREE_CONTRACTS = 2;                              // contracts 1 and 2: stages 01-16
const LICENSE_PRODUCT = 'com.warpvanguard.game.license'; // the same string in both store consoles

// ---- THE TWO DECISIONS: SETTLED BY GIL, 2026-11-05 ----
// Each stays one named constant, so a later change of mind is a one-line change,
// and npm test (THE PAYWALL) flies both values of each.
//
// 1. May a free player FILE a weekly ranked score? Gil: "Weekly stays free" (false).
//    true would let a free player fly the weekly lane, unranked, with boardKey()
//    filing nothing for it.
const WEEKLY_NEEDS_LICENSE = false;
// 2. Who keeps the paid stages they had before the wall went up? Gil: "Keep their
//    progress" ('progress'). The game was live and all free, so a player who
//    already flew past stage 16 must not meet a paywall over their own progress;
//    a player who never got that far sees the offer.
//      'progress'   — a save that held progress past stage 16 when this build
//                     first booted: a star, a best, or a second stage opened in
//                     contract 3, 4 or 5 (the default)
//      'every-save' — every save made before the paywall build
//      'none'       — nobody
//    The save's state at that first boot is stamped ONCE (license.legacy), so
//    widening this later still reaches every player who updated in between.
const GRANDFATHER = 'progress';

// THE WALL STANDS ONLY WHERE A PLAYER CAN MEET IT. A headless sim (the server
// verifier, the fingerprint battery, the test harness, the board linter) has no
// screen to hang an offer on and replays every board by design; it has no
// Image either, the same test the boot theater uses (SPLASH.on, 99-boot.js).
// The Lane Designer drives the clock itself (EDITOR_DRIVE) and is a tool, not a
// door. A browser tool that flies a paid stage on purpose (the store shoot, the
// bench, the labs) sets `licenseWall = false` before it starts the stage.
let licenseWall = typeof Image !== 'undefined';
const wallUp = () => licenseWall && !globalThis.EDITOR_DRIVE;

// ---- the gift ----
// Does the save show progress past stage 16? Contracts are open side by side, so
// a record for contract 3 exists the moment someone opens its chart; only play
// leaves a star, a best, or a second stage opened behind it.
function savePast16() {
  return CAMPAIGNS.some((pk, ci) => {
    if (ci < FREE_CONTRACTS) return false;
    const c = progress.camp[pk.id];
    return !!c && ((c.unlocked || 1) > 1
      || (Array.isArray(c.stars) && c.stars.some(s => s > 0))
      || (Array.isArray(c.bests) && c.bests.some(b => b > 0)));
  });
}
// ?paywall=fresh (web only, see licenseBoot): this session ignores the gift
let paywallFresh = false;
function grandfathered() {
  if (paywallFresh) return false;
  const L = license.legacy;
  if (!L || typeof L !== 'object') return false;
  return GRANDFATHER === 'every-save' ? !!L.save : GRANDFATHER === 'progress' ? !!L.past16 : false;
}
// ---- the questions every door asks ----
const licensed = () => !!license.owned || grandfathered();
const contractLocked = ci => wallUp() && ci >= FREE_CONTRACTS && !licensed();
const weeklyLocked = () => wallUp() && WEEKLY_NEEDS_LICENSE && !licensed();
// the names the offer prints: every stage number through lvNum (CLAUDE.md, house law)
function paidRange() {
  const last = CAMPAIGNS.length - 1;
  if (last < FREE_CONTRACTS) return '';
  return lvNum(levelNo(FREE_CONTRACTS, 0)) + '–' + lvNum(levelNo(last, CAMPAIGNS[last].levels.length - 1));
}
function freeRange() {
  const f = Math.min(FREE_CONTRACTS, CAMPAIGNS.length) - 1;
  return f < 0 ? '' : lvNum(levelNo(0, 0)) + '–' + lvNum(levelNo(f, CAMPAIGNS[f].levels.length - 1));
}

// ---- ONE DOOR FOR ANALYTICS ----
// The play statistics' track() (34-telemetry.js) gets three events from here and
// nowhere else: paywall.offer { from }, paywall.buy and paywall.restore { from,
// state, owned }. Never a price, a receipt, a token or a store account: privacy.html
// promises that. track() is inert outside a real build, so tests and labs send nothing.
function licenseTrack(ev, data) {
  if (typeof track === 'function') { try { track(ev, data || {}); } catch (e) {} }
}

// ============================================================================
// THE STORE, BEHIND ONE SMALL DOOR
// ============================================================================
// Three calls, one answer shape:
//   query()   -> { owned, price, state }   what the store says now (boot, offer)
//   buy()     -> { owned, price, state }   state: owned | cancelled | pending | error | unavailable
//   restore() -> { owned, price, state }   asks the store to re-sync the account first
// NATIVE: the License plugin in the shells, android/.../LicensePlugin.java and
// ios/App/App/LicensePlugin.swift: Play Billing and StoreKit 2 directly, no
// third-party processor in between. STUB: web and tests, the whole flow with no
// store, so the paywall plays end to end before any native code runs.
const STUB_STORE_KEY = 'warpVanguard.stubStore'; // the stub's "store account": survives a save wipe, like a real one
// The stub's answers. A test double, not the game's price: the real string comes
// from the store console, and this one says TEST so it can never pass for it.
const STUB = { price: '$1.99 TEST', answer: 'owned', delay: 450 };
function stubOwned() { try { return localStorage.getItem(STUB_STORE_KEY) === 'owned'; } catch (e) { return false; } }
function stubSetOwned(v) {
  try { if (v) localStorage.setItem(STUB_STORE_KEY, 'owned'); else if (localStorage.removeItem) localStorage.removeItem(STUB_STORE_KEY); } catch (e) {}
}
function stubBilling() {
  const ans = () => ({ owned: stubOwned(), price: STUB.price, state: stubOwned() ? 'owned' : 'none' });
  return {
    kind: 'stub',
    query: () => Promise.resolve(ans()),
    restore: () => Promise.resolve(ans()),
    buy: () => new Promise(res => setTimeout(() => {
      if (STUB.answer === 'owned') stubSetOwned(true);
      res({ owned: STUB.answer === 'owned', price: STUB.price, state: STUB.answer });
    }, STUB.delay)),
    listen() {}
  };
}
function nativeBilling(plug) {
  const id = { id: LICENSE_PRODUCT };
  return {
    kind: 'native',
    query: () => plug.query(id),
    buy: () => plug.buy(id),
    restore: () => plug.restore(id),
    // the shells say "something changed" (a pending purchase landed, a purchase
    // made on another device arrived) and the page asks again; the id stays here
    listen(fn) { try { plug.addListener('licenseChanged', fn); } catch (e) {} }
  };
}
const Billing = (() => {
  const cap = typeof window !== 'undefined' ? window.Capacitor : null;
  let native = false;
  try { native = !!(cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform()); } catch (e) {}
  if (native) {
    let plug = null;
    try { plug = typeof cap.registerPlugin === 'function' ? cap.registerPlugin('License') : (cap.Plugins && cap.Plugins.License); } catch (e) {}
    if (plug) return nativeBilling(plug);
  }
  return stubBilling();
})();
let licensePrice = null; // the store's localized price string, once it has answered

// THE STORE CAN GRANT, NEVER TAKE AWAY. A store that says "owned" sets the
// cached flag; a store that says "not owned" leaves it alone. A flaky answer, a
// device signed out of its store, a Play service still waking up: none of them
// may wall a player who paid. A refund keeping access costs less than one paying
// player locked out. (No DRM, principle 2.)
function licenseApply(r) {
  if (!r || typeof r !== 'object') return;
  if (typeof r.price === 'string' && r.price) licensePrice = r.price;
  if (r.owned === true && !license.owned) {
    license.owned = true; saveState();
    // a pending payment that clears while the offer is still up: the disc says so
    if (licOffer && !licOffer.busy && !licOffer.done) { licOffer.done = true; licOffer.msg = 'STAGES ' + paidRange() + ' ARE OPEN'; }
  }
}
function licenseQuery() { licenseAskedAt = Date.now(); Billing.query().then(licenseApply, () => {}); }

// THE STORE IS ASKED AGAIN EVERY TIME THE GAME COMES BACK (Gil, 2026-11-05). A gift
// code is redeemed in the store's own app, and a pending payment clears while the
// game is in the background; neither reaches a game that asks only at start-up. So
// the game asks again whenever it returns to the screen: the page's own
// visibilitychange (60-input.js) and Capacitor's App 'resume' (below), whichever
// fires first. On Android this is also what ACKNOWLEDGES such a purchase in time:
// Play refunds a one-time product left unacknowledged for three days, and the
// shell acknowledges on every query. One ask per LICENSE_RECHECK_GAP ms, so the two
// events, or a quick flick out and back, cost the store one call.
const LICENSE_RECHECK_GAP = 2000;
let licenseAskedAt = -1e15;
function licenseResume() {
  if (Date.now() - licenseAskedAt < LICENSE_RECHECK_GAP) return false;
  licenseQuery();
  return true;
}
(function wireLicenseResume() {
  try {
    const app = typeof window !== 'undefined' && window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App;
    if (app && typeof app.addListener === 'function') app.addListener('resume', () => licenseResume());
  } catch (e) {}
})();

// ---- boot ----
// ?paywall=fresh (web only) flies the free tier in a browser that holds a
// grandfathered save: it forgets the stub's purchase, and grandfathered() ignores
// the gift for this session only. The legacy stamp itself is never touched, so
// the next plain load has the gift back.
(function licenseBoot() {
  // THE LEGACY STAMP, written once: what the save held the first time a
  // licence-aware build booted. A save that already has a stamp keeps it.
  if (!license.legacy || typeof license.legacy !== 'object') {
    license.legacy = { save: saveFoundAtBoot, past16: saveFoundAtBoot && savePast16() };
    saveState();
  }
  try {
    paywallFresh = Billing.kind === 'stub' && typeof location !== 'undefined'
      && /[?&]paywall=fresh\b/.test(String(location.search || ''));
  } catch (e) {}
  if (paywallFresh) { stubSetOwned(false); license.owned = false; }
  licenseQuery(); // never gates play: the cached flag stands until the store answers
  Billing.listen(() => licenseQuery());
})();

// ============================================================================
// THE OFFER: an in-fiction disc the ring casts (the disc law applies)
// ============================================================================
// Opened from:
//   'locked'  a tap on a locked contract, or any door the wall turned back
//   'verdict' the report after a delivery that ends at a locked contract
//   'next'    NEXT CONTRACT off that report
//   'weekly'  the weekly lane, only while WEEKLY_NEEDS_LICENSE holds
// It never names the store in the fiction: the price on the key is the store's
// own string, and the store's own sheet does the rest.
let licOffer = null;      // { from, ci, w, busy, msg, done }
let licOfferLast = null;  // what the erase draws once the offer has closed
let licOfferBtns = [];
let licOfferDue = false;  // a delivery ended at a locked door: the report opens the offer once its keys land
function openLicOffer(from, ci, w) {
  if (licOffer) return;
  licOffer = { from: from || 'locked', ci: ci === undefined || ci < 0 ? FREE_CONTRACTS : ci, w, busy: false, msg: '', done: false };
  licOfferLast = licOffer;
  licOfferDue = false;
  licenseTrack('paywall.offer', { from: licOffer.from });
  licenseQuery(); // the price may have arrived since boot, or may never have
}
function closeLicOffer() { licOffer = null; }
// the report's hook (95-menu.js): once the keys have landed and no high-score
// card is up, a due offer opens over the report
function licOfferCheck() {
  if (!licOfferDue || licOffer || state !== S.END || nameEntry) return;
  const nci = CAMPAIGNS.findIndex(p => !campaignCleared(p.id));
  // only on a delivery's own report: a due left over from an earlier one is dropped
  if (endWin && !endless && !qual && nci >= 0 && contractLocked(nci)) openLicOffer('verdict', nci);
  else licOfferDue = false;
}
// endLevel's hook (61-replay.js): THIS run delivered a contract for the first time,
// and the next undelivered one is behind the wall. Peak satisfaction: the offer
// comes after the verdict, on the report, never at a door mid-contract.
function licOfferAfterDelivery(wasCleared) {
  if (wasCleared || !CAMP || !campaignCleared(CAMP.id)) return;
  const nci = CAMPAIGNS.findIndex(p => !campaignCleared(p.id));
  if (nci >= 0 && contractLocked(nci)) licOfferDue = true;
}
function licOfferAct(tag) {
  const o = licOffer;
  if (!o) return;
  if (tag === 'go') { closeLicOffer(); licOfferProceed(o); return; }
  if (o.busy) return; // a purchase in flight owns the disc
  if (tag === 'later') { closeLicOffer(); return; }
  if (tag === 'unranked') { closeLicOffer(); licWeeklyLaunch(o.w); return; }
  if (tag !== 'buy' && tag !== 'restore') return;
  o.busy = true; o.msg = tag === 'buy' ? 'CLEARING…' : 'CHECKING…';
  const call = tag === 'buy' ? Billing.buy() : Billing.restore();
  call.then(r => licOfferResult(o, tag, r), () => licOfferResult(o, tag, { owned: false, state: 'error' }));
}
function licOfferResult(o, tag, r) {
  licenseApply(r);
  licenseTrack(tag === 'buy' ? 'paywall.buy' : 'paywall.restore', { from: o.from, state: (r && r.state) || 'error', owned: !!(r && r.owned) });
  o.busy = false;
  if (licensed()) { o.done = true; o.msg = 'STAGES ' + paidRange() + ' ARE OPEN'; return; }
  const st = r && r.state;
  o.msg = st === 'cancelled' ? ''
    : st === 'pending' ? 'CLEARANCE PENDING. THE STAGES OPEN WHEN IT LANDS'
    : tag === 'restore' && st !== 'error' && st !== 'unavailable' ? 'NO CLEARANCE ON THIS ACCOUNT'
    : 'NO ANSWER. TRY AGAIN';
}
// CONTINUE after a clearance: carry on to where the player was going
function licOfferProceed(o) {
  if (o.from === 'weekly') { licWeeklyLaunch(o.w); return; }
  // from the carousel, dive into the contract the player tapped; from anywhere
  // else in the menu the door they used is still there, now open
  if (o.from === 'locked' && state === S.MENU && menuScreen === 'camps' && CAMPAIGNS[o.ci]) { syncDisc(discOfCamp(o.ci)); return; }
  // 'next' and 'verdict' land back on the report, whose NEXT CONTRACT now flies
}
// the weekly lane, launched the way the flow wheel launches it
function licWeeklyLaunch(w) {
  const go = () => (w === undefined || w === null ? startWeekly() : startWeekly(w));
  if (state === S.MENU) { menuFx = { kind: 'launch', t: 0, dur: 0.5, action: go }; tone(70, 0.45, 'sine', 0.12, 260); }
  else go();
}
// THE WEEKLY DOOR: every way into the live weekly lane asks here first
function weeklyDoor(w, launch) {
  const live = w === undefined || w === null || w === weekNow();
  if (live && weeklyLocked()) { openLicOffer('weekly', -1, w); return false; }
  launch();
  return true;
}
// the offer owns every tap while it is up. A tap on the dimmed field beside the
// disc is NOT NOW, unless a purchase is in flight.
function licOfferTap(x, y) {
  for (const b of licOfferBtns) {
    if (b.seg ? !discSegHit(b.seg, x, y) : !(x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h)) continue;
    pressUI(b, () => licOfferAct(b.action));
    return;
  }
  const o = licOffer;
  if (o && !o.busy && licOfferLast && licOfferLast.disc && Math.hypot(x - licOfferLast.disc.cx, y - licOfferLast.disc.cy) > licOfferLast.disc.r) {
    if (o.done) licOfferAct('go'); else closeLicOffer();
    sfx.tick();
  }
}

// ---- RESTORE PURCHASE (the settings disc's row, 95-menu.js) ----
// Apple rejects an unlock with no restore. On both stores the boot query already
// restores on a new device; this is the explicit door, and the answer rides the
// row's own key for a few seconds.
let restoreMsg = null; // { text, at }
let restoreBusy = false;
function restorePurchase() {
  if (restoreBusy) return;
  restoreBusy = true;
  restoreMsg = { text: 'CHECKING…', at: time };
  const done = (text) => { restoreBusy = false; restoreMsg = { text, at: time }; };
  Billing.restore().then(r => {
    licenseApply(r);
    licenseTrack('paywall.restore', { from: 'settings', state: (r && r.state) || 'error', owned: !!(r && r.owned) });
    done(license.owned ? 'PURCHASE RESTORED' : r && (r.state === 'error' || r.state === 'unavailable') ? 'NO ANSWER. TRY AGAIN' : 'NOTHING TO RESTORE');
  }, () => done('NO ANSWER. TRY AGAIN'));
}
const RESTORE_MSG_HOLD = 3.5; // seconds a restore answer holds the row's key
const restoreLabel = () => (restoreMsg && (restoreBusy || time - restoreMsg.at < RESTORE_MSG_HOLD)) ? restoreMsg.text : 'RESTORE PURCHASE';

// ---- THE LOCKED CONTRACT'S LOOK (92-guide.js drawCampDisc) ----
// Named knobs, for Gil to tune by eye: the veil over the client's picture, and
// the seal's size as a share of the disc's radius.
const LICENSE_SEAL = { veil: 0.42, size: 0.15 };
function drawLicenseSeal(x, y, r) {
  ctx.save();
  // the veil covers the picture half only, so the dossier under the chord still reads
  ctx.fillStyle = 'rgba(3,8,18,' + LICENSE_SEAL.veil + ')';
  ctx.beginPath(); ctx.arc(x, y, r * 0.97, Math.PI, TAU); ctx.closePath(); ctx.fill();
  // a shackle over a plate: the one lock glyph the game draws
  const s = r * LICENSE_SEAL.size, sy = y - r * 0.30;
  ctx.strokeStyle = 'rgba(186,231,255,0.92)'; ctx.lineWidth = Math.max(2, s * 0.16); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(x, sy - s * 0.18, s * 0.42, Math.PI, 0); ctx.lineTo(x + s * 0.42, sy + s * 0.05); ctx.moveTo(x - s * 0.42, sy - s * 0.18); ctx.lineTo(x - s * 0.42, sy + s * 0.05); ctx.stroke();
  techRect(x - s * 0.66, sy + s * 0.02, s * 1.32, s * 0.92, Math.max(2, s * 0.18));
  ctx.fillStyle = 'rgba(12,34,62,0.95)'; ctx.fill();
  ctx.strokeStyle = 'rgba(140,230,255,0.85)'; ctx.lineWidth = 1.4; techRect(x - s * 0.66, sy + s * 0.02, s * 1.32, s * 0.92, Math.max(2, s * 0.18)); ctx.stroke();
  ctx.fillStyle = 'rgba(186,231,255,0.92)';
  ctx.beginPath(); ctx.arc(x, sy + s * 0.40, s * 0.12, 0, TAU); ctx.fill();
  ctx.restore();
}

// ---- THE CLEARANCE PASS (Gil, 2026-11-05: "a futuristic multipass/ticket ... above
// the bottom buttons so it looks more inviting") ----
// The pass rises out of the segment over the UNLOCK key, as if the key prints it:
// the top of the card shows, the rest stays behind the chord. On CLEARED it rises
// further and its edge turns green. Named knobs, for Gil to tune by eye, as shares of R:
//   x     the card's centre, right of the disc's centre (0.32 sits it over UNLOCK)
//   peek  how much of the card shows above the chord
//   w     the card's width (its height is w * 0.62)
//   tilt  radians; a negative tilt lifts the right end
//   lift  the extra rise once CLEARED
//   bob   the float's height; sheen is holo sweeps per second
const LICENSE_PASS = { x: 0.32, peek: 0.21, w: 0.70, tilt: -0.07, lift: 0.14, bob: 0.006, sheen: 0.28 };
// the card's two gradients are in its own frame, so they are built once per size
let passGrads = null, passKey = '', passCtx = null;
function drawLicensePass(cx, cy, R, q, o) {
  const P = LICENSE_PASS, w = R * P.w, h = w * 0.62, chordY = cy + R * DISC_SEG;
  if (o.done && o.doneAt == null) o.doneAt = time;
  const ease = t => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
  const up = R * (P.peek * ease((q - 0.55) / 0.45) + (o.done ? P.lift * ease((time - o.doneAt) / 0.7) : 0));
  if (up <= 0.5) return;
  const pk = w.toFixed(1);
  if (!(passGrads && passKey === pk && passCtx === ctx)) {
    const body = ctx.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2);
    body.addColorStop(0, 'rgba(24,64,112,0.97)');
    body.addColorStop(0.55, 'rgba(9,28,58,0.97)');
    body.addColorStop(1, 'rgba(30,24,78,0.97)');
    const holo = ctx.createLinearGradient(-w * 0.2, 0, w * 0.2, 0);
    holo.addColorStop(0, 'rgba(140,230,255,0)');
    holo.addColorStop(0.35, 'rgba(140,230,255,0.22)');
    holo.addColorStop(0.5, 'rgba(255,214,140,0.26)');
    holo.addColorStop(0.65, 'rgba(190,140,255,0.2)');
    holo.addColorStop(1, 'rgba(190,140,255,0)');
    passGrads = [body, holo]; passKey = pk; passCtx = ctx;
  }
  const [body, holo] = passGrads;
  const edge = o.done ? 'rgba(126,226,98,0.95)' : 'rgba(140,230,255,0.92)';
  ctx.save();
  // the segment's keys are glass, so the chord CLIPS the card rather than covering it
  ctx.beginPath(); ctx.rect(cx - R, cy - R, R * 2, chordY - (cy - R)); ctx.clip();
  ctx.translate(cx + R * P.x, chordY - up + h / 2 + Math.sin(time * 1.7) * R * P.bob);
  ctx.rotate(P.tilt);
  const cut = h * 0.16;
  techRect(-w / 2, -h / 2, w, h, cut);
  ctx.fillStyle = body; ctx.fill();
  // the holo sheen crosses the card, then rests
  const ph = (time * P.sheen) % 1;
  if (ph < 0.5) {
    ctx.save(); ctx.clip();
    ctx.translate(-w * 0.8 + ph / 0.5 * w * 1.6, 0); ctx.rotate(0.45);
    ctx.fillStyle = holo; ctx.fillRect(-w * 0.2, -h * 1.5, w * 0.4, h * 3);
    ctx.restore();
  }
  // a soft glow under the edge: a wide faint stroke, never shadowBlur (WebKit pays for it)
  techRect(-w / 2, -h / 2, w, h, cut);
  ctx.strokeStyle = o.done ? 'rgba(126,226,98,0.16)' : 'rgba(140,230,255,0.16)'; ctx.lineWidth = Math.max(4, R * 0.024); ctx.stroke();
  ctx.strokeStyle = edge; ctx.lineWidth = Math.max(1.2, R * 0.006); ctx.stroke();
  ctx.strokeStyle = 'rgba(140,230,255,0.22)'; ctx.lineWidth = 1;
  const ins = h * 0.06;
  techRect(-w / 2 + ins, -h / 2 + ins, w - ins * 2, h - ins * 2, cut * 0.7); ctx.stroke();
  // the stub: a row of perforations, and the ring the thumbs fly, as the emblem
  const perfX = w / 2 - w * 0.3;
  ctx.fillStyle = 'rgba(140,230,255,0.45)';
  for (let yy = -h / 2 + h * 0.1; yy < h / 2; yy += h * 0.08) { ctx.beginPath(); ctx.arc(perfX, yy, Math.max(0.8, h * 0.012), 0, TAU); ctx.fill(); }
  const ex = w / 2 - w * 0.15, ey = -h / 2 + h * 0.3, er = h * 0.15;
  ctx.strokeStyle = 'rgba(186,231,255,0.5)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(ex, ey, er, 0, TAU); ctx.stroke();
  ctx.strokeStyle = edge; ctx.lineWidth = Math.max(1.5, h * 0.03); ctx.lineCap = 'round';
  for (let k = 0; k < 4; k++) { const a = k / 4 * TAU + time * 0.6; ctx.beginPath(); ctx.arc(ex, ey, er, a - 0.35, a + 0.35); ctx.stroke(); }
  ctx.fillStyle = edge; ctx.beginPath(); ctx.arc(ex, ey, er * 0.2, 0, TAU); ctx.fill();
  // the face: what the pass is for, fitted to the space left of the perforations
  const lx = -w / 2 + w * 0.08, lw = perfX - lx - w * 0.05;
  ctx.textAlign = 'left';
  try { ctx.letterSpacing = '2px'; } catch (e) {}
  ctx.font = '700 ' + fitPx('DEEP SPACE', '700', Math.round(h * 0.15), lw, 7) + 'px Audiowide, system-ui';
  ctx.fillStyle = 'rgba(225,242,255,0.96)'; ctx.fillText('DEEP SPACE', lx, -h / 2 + h * 0.27);
  try { ctx.letterSpacing = '0px'; } catch (e) {}
  const sub = 'STAGES ' + paidRange();
  ctx.font = '600 ' + fitPx(sub, '600', Math.round(h * 0.105), lw, 6) + 'px Audiowide, system-ui';
  ctx.fillStyle = 'rgba(140,230,255,0.82)'; ctx.fillText(sub, lx, -h / 2 + h * 0.43);
  ctx.restore();
}

// ---- the disc ----
// THE OFFER DISC'S LAYOUT, as shares of R off the disc's centre. Gil, 2026-11-05:
// the title stands lower off the crown, and the restore key clears the segment
// and the pass. Named knobs, for Gil to tune by eye.
const LICENSE_OFFER = { titleDrop: 0.06, textTop: 0.38, restoreY: 0.175 };
function licOfferCopy(o) {
  const bosses = CAMPAIGNS.slice(FREE_CONTRACTS).filter(p => p.levels.some(l => l && l.boss)).length;
  const free = 'STAGES ' + freeRange() + ' AND THE ENDLESS LANE STAY FREE';
  if (o.from === 'weekly') return [
    'THE WEEKLY BOARD FILES CLEARED VANGUARDS ONLY',
    'CLEARANCE ALSO OPENS STAGES ' + paidRange(),
    free];
  return [
    // the words are Gil's, 2026-11-05
    'FURTHER PROGRESS REQUIRES DEEP SPACE CLEARANCE',
    'GET ACCESS TO: STAGES ' + paidRange() + ', INCLUDING ' + bosses + ' BOSSES.',
    free];
}
function drawLicOffer() {
  const q = popFxQ('licoffer', !!licOffer);
  licOfferBtns = [];
  if (q <= 0.001 || !licOfferLast) return;
  const o = licOfferLast, gg = geo();
  const R = discR(), cx = gg.cx, cy = gg.cy;
  o.disc = { cx, cy, r: R };
  ctx.save();
  ctx.fillStyle = 'rgba(3,6,14,' + (0.74 * Math.min(1, q * 2.2)).toFixed(3) + ')';
  ctx.fillRect(0, 0, W, H);
  popRender(q, cx - R, cy - R, R * 2, R * 2, () => {
    ctx.save();
    discPlate(cx, cy, R, o.done ? 'CLEARED' : 'DEEP SPACE\nCLEARANCE', null, LICENSE_OFFER.titleDrop);
    drawLicensePass(cx, cy, R, q, o);
    const [p1, p2, p3] = licOfferCopy(o);
    const px1 = Math.max(9, Math.round(R * 0.064)), px2 = Math.max(8, Math.round(R * 0.056));
    let y = cy - R * (o.done ? 0.16 : LICENSE_OFFER.textTop); // the cleared disc says two lines: they sit in the middle of the band
    if (o.done) {
      y = discPara(cx, cy, R, o.msg, y, 'rgba(126,226,98,0.96)', px1, '700');
      discPara(cx, cy, R, 'GOOD HUNTING, VANGUARD', y + px1 * 0.4, 'rgba(150,210,255,0.72)', px2, '500');
    } else {
      y = discPara(cx, cy, R, p1, y, 'rgba(220,235,255,0.94)', px1, '600');
      y = discPara(cx, cy, R, p2, y + px1 * 0.25, 'rgba(140,230,255,0.92)', px2, '700');
      discPara(cx, cy, R, p3, y + px2 * 0.2, 'rgba(150,185,220,0.62)', px2, '500');
      // THE BAND ABOVE THE SEGMENT: the restore key, or what the store just said.
      // The key holds words, so it keeps the TEXT margin off the rim, fitted at
      // its widest corner (the disc law).
      const kh = Math.max(16, R * 0.105), ky = cy + R * LICENSE_OFFER.restoreY;
      if (o.msg) {
        discPara(cx, cy, R, o.msg, ky + kh * 0.62, o.busy ? 'rgba(150,210,255,0.85)' : 'rgba(255,214,140,0.95)', px2, '700');
      } else {
        const hx = Math.max(R * 0.3, Math.min(discChord(R, ky - cy), discChord(R, ky + kh - cy)) - R * DISC_TEXT_PAD);
        const label = 'ALREADY CLEARED? RESTORE';
        ctx.font = '700 ' + fitPx(label, '700', Math.max(8, Math.round(R * 0.05)), hx * 2 - R * 0.06, 7) + 'px Audiowide, system-ui';
        const kw = Math.min(hx * 2, ctx.measureText(label).width + R * 0.12);
        discSlab(cx - kw / 2, ky, kw, kh, false);
        ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(186,231,255,0.86)';
        ctx.fillText(label, cx, ky + kh * 0.66);
        ctx.textAlign = 'left';
        licOfferBtns.push({ x: cx - kw / 2, y: ky, w: kw, h: kh, action: 'restore', cut: Math.max(3, kh * 0.34) });
      }
    }
    // the positive verb rides the RIGHT half (Gil's rule for every disc segment)
    const buy = 'UNLOCK' + (licensePrice ? '  ' + licensePrice : '');
    const keys = o.done
      ? [['CONTINUE ▸', 'go', { primary: true }]]
      : [[o.from === 'weekly' ? 'FLY UNRANKED' : 'NOT NOW', o.from === 'weekly' ? 'unranked' : 'later', { locked: o.busy }],
         [buy, 'buy', { primary: true, locked: o.busy }]];
    // the keys go live once the cast has landed, never on the frame it begins
    for (const b of discSegKeys(cx, cy, R, keys)) if (q > 0.92 && licOffer) licOfferBtns.push(b);
    if (q <= 0.92 || !licOffer) licOfferBtns.length = 0;
    ctx.restore();
  }, gg.nodeR * 1.02);
  ctx.restore();
  ctx.textAlign = 'left';
}
