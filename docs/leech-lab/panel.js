'use strict';
// THE LEECH LAB'S CONTROL STRIP.
//
// Served only by scripts/leech-lab.js — it is never in src/, never in dist/,
// and the game has no idea it exists. It drives the same globals a duel drives:
// installCampaign / startLevel / spawnBoss to reach a machine, and then one
// pinning interval that holds the fight still so the machine can be looked at.
//
// THE PIN IS THE WHOLE TRICK. A live duel keeps releasing swarms, sweeping
// light and moving the fight on, and none of that is what you are judging. The
// pin pushes every clock out of reach each frame and leaves exactly one thing
// running: the rotation.
(function () {
  const Q = new URLSearchParams(location.search);
  const KINDS = ['leech', 'siphon', 'prism', 'mimic', 'blockade'];
  const STAGES = ['08', '16', '24', '32', '40'];
  // the crew deck's presets — the bake reads LCH_DECK once, so a change reloads
  const DECKS = {
    now:  { n: 18, e: 0.42, ec: [255, 224, 186], w: 0.010, h: 0.024, t: 'NOW · 18 @ 0.42' },
    was:  { n: 24, e: 0.62, ec: [255, 192, 112], w: 0.013, h: 0.026, t: 'WAS · 24 @ 0.62' },
    dim:  { n: 12, e: 0.30, ec: [255, 214, 170], w: 0.011, h: 0.022, t: 'DIM · 12 @ 0.30' },
    none: { n: 0,  e: 0.42, ec: [255, 224, 186], w: 0.010, h: 0.024, t: 'NONE · bare rim' }
  };

  const deckKey = DECKS[Q.get('deck')] ? Q.get('deck') : 'now';
  Object.assign(LCH_DECK, DECKS[deckKey]);          // read at bake time, below

  let ki = Math.max(0, KINDS.indexOf(Q.get('m')));
  const ladderOn = Q.get('ladder') !== 'off';
  let hits = 0, pin = null, frozen = false, zoom = 1;
  const ZOOMS = [1, 1.6, 2.4];

  // the ladder off = the machine as it was before the rim hardware landed
  const LADDER0 = JSON.parse(JSON.stringify(LEECH_LADDER));
  function applyLadder() {
    for (const k in LEECH_LADDER) {
      Object.assign(LEECH_LADDER[k], ladderOn ? LADDER0[k] : { kinds: [], notch: 0, hitch: 0 });
    }
  }

  function enter(i) {
    ki = (i + KINDS.length) % KINDS.length;
    hits = 0;
    applyLadder();
    installCampaign(CAMPAIGN_PACKAGES[ki]);
    startLevel(7);
    spawnBoss();
    if (pin) clearInterval(pin);
    pin = setInterval(() => {
      if (!boss) return;
      // the lane is UNPARKED here. A parked level waits for two thumbs and paints
      // AWAITING RUNNER over the machine — the one thing this lab is for.
      introLatch = true; introT = Math.max(introT, 9);
      boss.introT = 99; boss.dying = undefined;
      boss.rad = 0; boss.u = 0; boss.v = 0; boss.z = 0.5;
      boss.hurtT = 0; boss.shieldT = 0;
      boss.mode = 'idle'; boss.modeT = 0;
      if (boss.lamp >= 0) { boss.lamp = 0; boss.lampT = 9e9; boss.lampBlink = 0; }
      boss.beams.length = 0; if (boss.beamFx) boss.beamFx.length = 0;
      boss.waveT = 9e9; boss.addT = 9e9;
      boss.hp = Math.max(0, boss.maxHp - hits);
      boss.round = hits;
      if (frozen) boss.spin = 1.05;
      // THE CAPTURE HOOK. A frame grabber steps this by hand so every frame is
      // an exact angle apart, whatever the grab costs in wall time.
      if (typeof window.__labSpin === 'number') boss.spin = window.__labSpin;
      enemies.length = 0; pickups.length = 0; latches.length = 0;
      sched.length = 0; patternQ.length = 0; shake = 0;
      // THE MAGNIFIER IS A LAB TOOL, NOT A TUNING KNOB. ×1 is the true size the
      // player gets, and the fairness argument is only valid there. The other
      // two exist so a deck light can be looked at without a screenshot.
      boss.sSize *= zoom;
    }, 8);
    paint();
  }

  // ---- the strip
  const bar = document.createElement('div');
  bar.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:9999;' +
    'display:flex;flex-wrap:wrap;gap:6px;align-items:center;padding:8px 10px;' +
    'background:rgba(4,2,12,.9);border-top:1px solid #2a2044;' +
    'font:11px/1.2 ui-monospace,Menlo,monospace;color:#948bab;letter-spacing:.08em';
  document.body.appendChild(bar);

  const btn = (label, on, fn) => {
    const b = document.createElement('button');
    b.textContent = label;
    b.style.cssText = 'font:inherit;letter-spacing:inherit;padding:5px 9px;cursor:pointer;' +
      'border:1px solid ' + (on ? '#d465ff' : '#2a2044') + ';background:' +
      (on ? 'rgba(212,101,255,.15)' : 'transparent') + ';color:' + (on ? '#eab8ff' : '#948bab') + ';';
    b.onclick = e => { e.preventDefault(); fn(); };
    bar.appendChild(b);
    return b;
  };
  const label = t => {
    const s = document.createElement('span');
    s.textContent = t;
    s.style.cssText = 'color:#5c5473;padding:0 4px 0 10px';
    bar.appendChild(s);
  };

  function paint() {
    bar.textContent = '';
    label('MACHINE');
    KINDS.forEach((k, i) => btn(STAGES[i] + ' ' + k.toUpperCase(), i === ki, () => enter(i)));
    label('DECK');
    for (const key in DECKS) {
      btn(DECKS[key].t, key === deckKey, () => {
        Q.set('deck', key); Q.set('m', KINDS[ki]); location.search = Q.toString();
      });
    }
    label('RIM');
    btn(ladderOn ? 'LADDER ON' : 'LADDER OFF', ladderOn, () => {
      Q.set('ladder', ladderOn ? 'off' : 'on'); Q.set('m', KINDS[ki]); location.search = Q.toString();
    });
    label('PULSES');
    btn('HIT  (space)', false, () => { hits = Math.min(boss ? boss.maxHp : 9, hits + 1); paint(); });
    btn('RESET', false, () => { hits = 0; paint(); });
    const n = document.createElement('span');
    n.textContent = hits + ' / ' + (boss ? boss.maxHp : '?');
    n.style.cssText = 'color:#e6e0f2;padding:0 6px';
    bar.appendChild(n);
    label('SPIN');
    btn(frozen ? 'FROZEN' : 'TURNING', !frozen, () => { frozen = !frozen; paint(); });
    label('MAGNIFY');
    ZOOMS.forEach(z => btn('x' + z + (z === 1 ? ' true' : ''), z === zoom, () => { zoom = z; paint(); }));
  }

  addEventListener('keydown', e => {
    if (e.key >= '1' && e.key <= '5') enter(+e.key - 1);
    else if (e.code === 'Space') { e.preventDefault(); hits = Math.min(boss ? boss.maxHp : 9, hits + 1); paint(); }
    else if (e.key === 'r' || e.key === 'R') { hits = 0; paint(); }
    else if (e.key === 'f' || e.key === 'F') { frozen = !frozen; paint(); }
    else if (e.key === 'z' || e.key === 'Z') { zoom = ZOOMS[(ZOOMS.indexOf(zoom) + 1) % ZOOMS.length]; paint(); }
    else return;
  });

  // hold on the menu until the leech rings are baked, then drop into the duel
  (function wait() {
    if (typeof s3SpriteFor === 'function' &&
        ['LCHRIM', 'LCHGEAR', 'LCHHUB'].every(k => !!s3SpriteFor(k))) return enter(ki);
    setTimeout(wait, 200);
  })();
})();
