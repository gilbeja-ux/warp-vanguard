'use strict';
// ---------- recorded sfx (audio/sfx/*, decoded once when audio wakes) ----------
// event → [file, gain trim]. Remap or retune here; anything missing or not yet
// decoded falls back to the synth voice in sfx below, so a bad path fails soft.
const SFX_FILES = {
  hit:    ['audio/sfx/hit-1.wav', 0.8],
  ui:     ['audio/sfx/mini-hit.wav', 0.5],
  miss:   ['audio/sfx/miss.wav', 0.9],
  miss2:  ['audio/sfx/miss2.wav', 0.9],
  pick:   ['audio/sfx/power-up.wav', 0.8],
  pulse:  ['audio/sfx/pulse.mp3', 1.0],
  pulseArm: ['audio/sfx/pulse_charge.mp3', 0.9], // an orb reaching full — ready to fire
  volley: ['audio/sfx/volley.mp3', 0.9],
  shutdown: ['audio/sfx/shutdown.mp3', 0.9],   // an emitter fried by a killer/wall
  restart:  ['audio/sfx/restarting.mp3', 0.9], // that node rebooting back online
  startup:  ['audio/sfx/startup1.mp3', 0.9], // boot sequence as the ring locks in (cut at 2s)
  fail:   ['audio/sfx/failed.mp3', 1.0],
  win:    ['audio/sfx/win.mp3', 1.0],
  // ---- the warp trilogy: entering the lane, riding it, leaving it ----
  // 0.38, down from 0.9 (-7.5dB), in two passes — 0.65 was still too hot on the device.
  // Two reasons it runs loud: it fires on the SAME beat as `startup` (0.9) so the two
  // takes stack, and its own envelope climbs for 1.8s and then sits on a plateau, so it
  // is loudest exactly where the boot's other cues land. It also plays on the player's
  // own touch now, which puts it where the ear is already paying attention.
  warpIn:   ['audio/sfx/warp-in.mp3', 0.38],  // 2.44s — the spool-up, on the launch beat
  inWarp:   ['audio/sfx/in-warp.mp3', 0.34],  // 8.93s — LOOPED under the whole run (see ambient())
  exitWarp: ['audio/sfx/exit-warp.mp3', 0.95] // 4.96s — dropping out of warp on a win
  // splash2.mp3 (8.1s) scores the boot splash — it has its own player there
};
// how far into the 4.96s exit-warp take the victory sting rises. Sitting it in the
// drop's tail is what makes the two read as one arrival instead of a queue.
const EXIT_STING = 2.2;
const sampleBufs = {}, sampleTrim = {}; // audible [start,end] per take — encoder silence mapped out
let samplesLoading = false;
function loadSamples() {
  if (samplesLoading || !AC) return;
  samplesLoading = true;
  for (const k of Object.keys(SFX_FILES)) {
    fetch(SFX_FILES[k][0])
      .then(r => r.arrayBuffer())
      .then(a => AC.decodeAudioData(a))
      .then(buf => {
        sampleBufs[k] = buf;
        sampleTrim[k] = loopPoints(buf, 0.01); // hotter gate: sfx must SNAP
        // the take's last real HIT (not its ring-out) — for end-aligned cues
        const d = buf.getChannelData(0);
        let m = 0;
        for (let i = 0; i < d.length; i += 4) { const v = Math.abs(d[i]); if (v > m) m = v; }
        let e = d.length - 1;
        while (e > 0 && Math.abs(d[e]) < m * 0.6) e--;
        sampleTrim[k].peak = e / buf.sampleRate;
      })
      .catch(() => {}); // the synth voice keeps covering this one
  }
}
// play a decoded sample through the sfx bus; false = not ready, use the synth.
// offset skips into the take; fadeIn ramps the entry instead of a hard start;
// cut ends the take early — hold `cut` seconds, then a `fadeOut`-second ramp
function playSample(name, vol, pan, rate, delay, offset, fadeIn, cut, fadeOut) {
  if (simMuted) return false;
  const ac = AC, buf = sampleBufs[name];
  if (!ac || !sfxGain || !buf) return false;
  const src = ac.createBufferSource(); src.buffer = buf;
  if (rate && src.playbackRate) src.playbackRate.value = rate;
  const g = ac.createGain();
  const lvl = SFX_FILES[name][1] * (vol === undefined ? 1 : vol);
  const t0 = ac.currentTime + (delay || 0);
  if (fadeIn && g.gain.setValueAtTime && g.gain.linearRampToValueAtTime) {
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(lvl, t0 + fadeIn);
  } else g.gain.value = lvl;
  let tail = g;
  if (pan && ac.createStereoPanner) {
    const p = ac.createStereoPanner(); p.pan.value = clamp(pan, -1, 1);
    g.connect(p); tail = p;
  }
  src.connect(g); tail.connect(sfxGain);
  // no offset given → skip the take's leading silence so the attack is instant
  const tr = sampleTrim[name];
  src.start(t0, offset !== undefined ? offset : tr ? tr.start : 0);
  if (cut && g.gain.setValueAtTime && g.gain.linearRampToValueAtTime) {
    // scheduled exit — MUST come after start(); stop-before-start throws
    const fo = fadeOut || 0.3;
    g.gain.setValueAtTime(lvl, t0 + cut);
    g.gain.linearRampToValueAtTime(0.0001, t0 + cut + fo);
    src.stop(t0 + cut + fo + 0.05);
  }
  return true;
}
const sfx = {
  zap(combo, pan) { // digital confirmation — combo winds the pitch up, sample or synth
    if (playSample('hit', 1, pan, Math.pow(1.0293, Math.min(combo || 1, 12) - 1))) return true;
    const m = Math.pow(1.059, Math.min(combo || 1, 12));
    tone(760 * m, 0.05, 'sine', 0.12, 900 * m, null, 0, pan);
    tone(1140 * m, 0.09, 'sine', 0.11, 1330 * m, null, 0.045, pan);
    tone(2280 * m, 0.06, 'triangle', 0.04, 2660 * m, null, 0.045, pan);
    tone(190 * m, 0.03, 'square', 0.05, 120 * m, null, 0, pan);
    return false; // synth voice carried it — accents may layer
  },
  pick() { // power-up: a quick ascending sparkle arpeggio
    if (playSample('pick')) return;
    [784, 1047, 1568].forEach((f, i) => tone(f, 0.09, 'triangle', 0.10, f * 1.12, null, i * 0.05));
    tone(3136, 0.12, 'sine', 0.05, 3520, null, 0.15);
  },
  shieldUp() { tone(392, 0.18, 'triangle', 0.11, 523); tone(784, 0.3, 'sine', 0.09, 1047); },
  shieldHit() { tone(1047, 0.22, 'triangle', 0.13, 523); tone(196, 0.28, 'square', 0.09, 98); },
  perfect() { tone(2093, 0.14, 'triangle', 0.13, 2637); tone(3136, 0.10, 'sine', 0.08, 3520); },
  count() { tone(600, 0.12, 'square', 0.12, 560); },
  overheatWarn() { tone(220, 0.5, 'sawtooth', 0.13, 90); tone(110, 0.6, 'square', 0.1, 60); },
  bossShot() { tone(140, 0.22, 'sawtooth', 0.13, 70); },
  go()    { tone(880, 0.20, 'square', 0.14, 1320); tone(1760, 0.30, 'triangle', 0.10, 2200); },
  heal()  { tone(523, 0.14, 'triangle', 0.12, 659); tone(784, 0.22, 'triangle', 0.10, 1047); },
  speedUp()  { tone(180, 0.45, 'sawtooth', 0.11, 880); tone(110, 0.55, 'triangle', 0.09, 440); },
  miss(pan) { // a dull thud + terse alarm blip — bad news without harshness
    if (playSample(misses & 1 ? 'miss2' : 'miss', 1, pan)) return; // two takes, alternating
    tone(130, 0.22, 'sine', 0.13, 50, null, 0, pan);
    tone(500, 0.09, 'square', 0.05, 470, null, 0.06, pan);
    crackle(0.08, 300, 120, 2, 0.5, 0, pan);
  },
  fry(pan) { // node killer: electricity dying in the coil
    if (playSample('shutdown', 1, pan)) return;
    crackle(0.28, 1400, 220, 3, 2.0, 0, pan);
    crackle(0.10, 900, 500, 5, 1.2, 0.10, pan);
    tone(220, 0.30, 'sawtooth', 0.07, 55, null, 0, pan);
  },
  pulseFire() { // the purge: sub drop under a rising pressure sweep
    if (playSample('pulse')) return;
    tone(170, 0.5, 'sine', 0.17, 38);
    crackle(0.55, 500, 3400, 1.2, 1.5);
    tone(2637, 0.25, 'sine', 0.05, 3520, null, 0.12);
  },
  // THE PURGE CHARGING. Banking is still synth — a tick that climbs is pitch
  // logic no take can carry, since the frequency IS the fill readout. Arming has
  // its take now (pulse_charge.mp3, Gil's), panned to the pad that owns the orb
  // so which side is armed is audible before you look; the synth coil below
  // covers it until the sample decodes, per the house fallback rule.
  pulseBank(frac, pan) { // a zap banked into an orb: a tick that climbs as it fills
    const f = 300 + 520 * clamp(frac, 0, 1);
    tone(f, 0.055, 'triangle', 0.045, f * 1.5, null, 0, pan);
    tone(f * 2, 0.040, 'sine', 0.022, f * 3, null, 0, pan);
  },
  pulseArmed(pan) {
    if (playSample('pulseArm', 1, pan)) return;
    // fallback: a low coil topping out, then an octave snap and a shimmer —
    // deliberately nothing like heal(), which says "repaired", not "armed"
    tone(110, 0.26, 'sawtooth', 0.075, 220, null, 0, pan);
    tone(440, 0.18, 'square', 0.055, 660, null, 0.10, pan);
    tone(880, 0.22, 'triangle', 0.065, 1320, null, 0.10, pan);
    tone(1760, 0.30, 'sine', 0.030, 2640, null, 0.16, pan);
  },
  bossOnline() { // the gateway core spins up
    tone(55, 1.1, 'sawtooth', 0.11, 220);
    crackle(0.9, 300, 1600, 2, 1.0, 0.1);
    tone(110, 0.5, 'square', 0.07, 55, null, 0.9);
  },
  bossDown() { // core breach: broadband blast into a long sub tail
    crackle(0.7, 1200, 90, 1.4, 2.6);
    tone(90, 0.9, 'sine', 0.16, 30);
    crackle(0.4, 4000, 600, 4, 1.2, 0.15);
  },
  // THE ARRIVAL: dropping out of warp, with the victory sting rising through its
  // tail. The exit take is nearly five seconds long, and holding the sting until it
  // finished left a gap that read as the game having stalled — so the sting comes in
  // at EXIT_STING, part-way down the drop, and the two land as one event rather than
  // as two cues queued up. Falls back to the bare sting if the take hasn't decoded.
  arrive() {
    if (!playSample('exitWarp')) { this.win(); return; }
    // the recorded sting can be scheduled; the synth one can't, so it gets a timer
    if (!playSample('win', 1, 0, 1, EXIT_STING)) setTimeout(() => sfx.win(), EXIT_STING * 1000);
  },
  win()  { // level secured: rising fanfare into a held bright chord
    if (playSample('win')) return;
    [523, 659, 784, 1047].forEach((f, i) => {
      tone(f, 0.24, 'triangle', 0.12, f * 1.01, null, i * 0.14);
      tone(f * 2, 0.16, 'sine', 0.045, null, null, i * 0.14);
    });
    tone(1319, 0.7, 'triangle', 0.10, null, null, 0.56);
    tone(2637, 0.5, 'sine', 0.04, null, null, 0.56);
    tone(330, 0.8, 'sine', 0.07, null, null, 0.56);
  },
  traced() { // ribbon ridden to the end — resolve the rising trace tone
    tone(880, 0.09, 'sine', 0.12, 1047);
    tone(1319, 0.14, 'sine', 0.10, 1760, null, 0.07);
    tone(2637, 0.10, 'triangle', 0.05, 3136, null, 0.13);
  },
  fail() {
    if (playSample('fail')) return;
    [330, 262, 196].forEach((f, i) => setTimeout(() => tone(f, 0.3, 'sawtooth', 0.1), i * 180));
  },
  tick() { // techy UI click: a crisp tap with a tiny body
    if (playSample('ui')) return;
    tone(2200, 0.02, 'square', 0.05, 1400);
    tone(660, 0.035, 'sine', 0.045, 480, null, 0.006);
  }
};
