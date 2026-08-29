'use strict';
// ---------- recorded sfx (audio/sfx/*, decoded once when audio wakes) ----------
// event → [file, gain trim]. Remap or retune here; anything missing or not yet
// decoded falls back to the synth voice in sfx below, so a bad path fails soft.
const SFX_FILES = {
  hit:    ['audio/sfx/hit-1.wav', 0.8],
  ui:     ['audio/sfx/mini-hit.wav', 0.5],
  miss:   ['audio/sfx/miss.wav', 0.9],
  miss2:  ['audio/sfx/miss2.wav', 0.9],
  pick:   ['audio/sfx/power-up.wav', 0.6], // 0.8 → 0.6 (-2.5 dB): it was the loudest take on the bus (Gil, on the phone)
  pulse:  ['audio/sfx/pulse.mp3', 1.0],
  pulseArm: ['audio/sfx/pulse_charge.mp3', 0.9], // an orb reaching full — ready to fire
  volley: ['audio/sfx/volley2.mp3', 1.0], // levelled in the edit — no trim needed
  shutdown: ['audio/sfx/shutdown.mp3', 0.9],   // an emitter fried by a killer/wall
  restart:  ['audio/sfx/restarting.mp3', 0.9], // that node rebooting back online
  startup:  ['audio/sfx/startup1.mp3', 0.9], // boot sequence as the ring locks in (cut at 2s)
  fail:   ['audio/sfx/failed.mp3', 0.95], // true peak +0.1 dBFS raw; the trim seats it under 0
  win:    ['audio/sfx/win.mp3', 1.0],
  // 5.11s — a 1.4s build, the blast at 1.43s, ringing out by 4s. It is STARTED
  // EARLY on purpose so its impact lands on the implosion rather than after it;
  // see BOSS_DEAD_IMPACT in 52-bosses, which is that 1.43s figure.
  // H-13: the take true-peaks +0.8 dBFS — the ONLY take mastered over full
  // scale — and at 1.0 it was also the loudest thing in the game (-10.5 LUFS).
  // 0.85 seats the peak at -0.6 dBFS; it stays the ceremonial loudest.
  bossDead: ['audio/sfx/boss-dead.mp3', 0.85],
  // 9.08s — a BED, not an impact: full level from 0.14s and swelling in waves
  // to ~7.5s. It opens on the frame the machine surfaces and is faded out over
  // the duel's first beat (ARRIVAL_HOLD/FADE in 52-bosses) — carried to its own
  // end it would still be at three-quarter level with combat on top of it.
  bossArrive: ['audio/sfx/boss-arrival.mp3', 1.0],
  // ---- the warp trilogy: entering the lane, riding it, leaving it ----
  // 0.27, down from 0.9 (-10.5dB), settled over three passes on the device: 0.65 and 0.38
  // were both still too hot, 0.24 was a shade under, and this is that +1dB back. Two
  // reasons it runs loud: it fires on the SAME beat as `startup` (0.9) so the two takes
  // stack, and its own envelope climbs for 1.8s and then sits on a plateau, so it is
  // loudest exactly where the boot's other cues land. It also plays on the player's own
  // touch, which puts it where the ear is already paying attention. At 0.27 it sits ~10dB
  // under `startup`: a BED the boot cues land on top of, which is the balance it was
  // always meant to have. If it ever needs moving again, the trim is not the thing —
  // the stack with `startup` is.
  warpIn:   ['audio/sfx/warp-in.mp3', 0.25],  // 2.44s — the spool-up, on the launch beat
  inWarp:   ['audio/sfx/in-warp.mp3', 0.35],  // 8.93s — LOOPED under the whole run (see ambient())
  // 0.30, down from 0.95 (-10 dB): at 0.95 the drop was the loudest thing on the
  // win's frame and buried everything under it — the sting riding at EXIT_STING,
  // the keys, the first star. It is a BED for the verdict, not the verdict.
  exitWarp: ['audio/sfx/exit-warp.mp3', 0.30], // 4.96s — dropping out of warp on a win
  // splash2.mp3 (8.1s) scores the boot splash — it has its own player there
  // ---- H-33 · DELIVERED 2026-08-27 (Gil's takes) ----
  // These two paths held a place for months and the synth voices below covered
  // them. The takes have landed, so the synth voices are now what they always
  // said they were: the fallback for a 404 or a failed decode. Keep them.
  //
  // 1.225s. It BUILDS for a full second and lets go at RAY_CHARGE_RELEASE, and
  // that figure is BEAM_BURST in 52-bosses — the light launches on the release,
  // so the wind-up and the launch are one event. Re-cut the take and move that
  // constant with it. 0.7 keeps the telegraph clearly audible over combat without
  // sitting on top of the boss's own cues, which is a 1.0s bed's real risk.
  rayCharge: ['audio/sfx/ray-charge.mp3', 0.7],
  // 1.22s — a blast and its near tail. The source rang out for 4s; six of those,
  // 0.3s apart, under the death take is mush, so the reverb is cut at 0.85s and
  // faded. Six plays of ONE file, pitched down the dyingN ladder, is what makes
  // the six read as different parts of one machine coming apart (Gil's call).
  bossPlate: ['audio/sfx/boss-plate.mp3', 0.6],
  // ---- THE SONAR · A BACKGROUND INDICATOR, NOT A CUE ----
  // Built, cut for beeping, and brought back at a whisper on Gil's call
  // (2026-08-27): "lower the volume a lot so it's just a background indicator".
  //
  // 0.05 is roughly 10 dB under where it first shipped and about 4 dB under the
  // bare sine it replaced — the quietest thing on the roster by a wide margin, and
  // deliberately so. It fires per hostile, over and over, for the whole run. Every
  // other take on this list is an EVENT; this one is weather.
  //
  // THE LEVEL WAS ONLY HALF THE PROBLEM. What made it unbearable on a late stage
  // was DENSITY: a dozen live hostiles each running their own blip train is a
  // continuous tone at any volume. The rate cap in `sonarTick` is the other half,
  // and the take is cut to 0.20s so a ping always ENDS before the cap lets the next
  // one start. Silence between pings is what stops it becoming a drone.
  sonar: ['audio/sfx/sonar-ping.mp3', 0.05],
  // ---- THE 2026-08-29 ORDER (Gil, off the soundboard) ----------------------
  // Nineteen cues that were oscillators until now. Source: Kenney's CC0 audio
  // packs, auditioned on the board and picked there; the trims are the ones the
  // sliders were left at. THE SYNTH BODIES ALL STAY — every one of these is
  // `playSample(...) || <the tones>`, so a failed decode degrades to what the
  // game said yesterday rather than to silence. See docs/SFX-SYNTH-ROSTER.md.
  //
  // THEY WERE THE SAME TAKE, AND IT READ AS A BUG. heal, x10 and laneSecured were
  // all picked as interface/confirmation_004, and Gil reported it as "the x10
  // chime sounds more than once during the run". It was not the x10 gate — that
  // fires once per run and always did. It was `heal` (every stability pickup and
  // every emitter reboot) and `laneSecured` (every wave cleared) playing the
  // SAME RECORDING many times over.
  //
  // They are now three different members of ONE confirmation family — same voice,
  // different words. x10 keeps confirmation_004 because that is the sound Gil
  // named; heal takes _001 and laneSecured takes _003.
  //
  // THE RULE THIS BUYS: a cue that fires ONCE per run and a cue that fires every
  // few seconds must never share a recording. The rare one gets blamed for the
  // common one, because the rare one is the one with a name on screen.
  shieldUp:   ['audio/sfx/shield-up.wav', 0.9],
  heal:       ['audio/sfx/heal.wav', 0.9],
  shieldHit:  ['audio/sfx/shield-hit.wav', 0.9],
  // two takes, one per thumb — the pair is the ack, so they must stay siblings
  padPress1:  ['audio/sfx/pad-press-1.wav', 0.9],
  padPress2:  ['audio/sfx/pad-press-2.wav', 0.9],
  x10:        ['audio/sfx/x10.wav', 0.9],
  chain:      ['audio/sfx/chain.wav', 0.9],
  volleyBlast:['audio/sfx/volley-blast.wav', 0.9],
  armorThump: ['audio/sfx/armor-thump.wav', 0.9],
  railLatched:['audio/sfx/rail-latched.wav', 0.9],
  // GIL ASKED FOR 1.5 AND THE FILE CANNOT GIVE IT. The take already true-peaks at
  // -0.82 dBFS, so 1.5 (+3.5 dB) puts it at +2.7 dBFS — clipped, and caught by
  // scripts/test-sfx-levels.mjs. 0.98 seats it at -1.0 dBFS, which is as loud as
  // this master goes.
  //
  // The intent was right: this is the only thing that wounds the boss and it
  // should land like it. But the lever is not the trim, it is the MASTER — a take
  // that peaks at -0.8 dBFS with a low average is all transient and no body.
  // A compressed-and-limited version is auditioning in the drop folder as
  // `00__LIMITED__leech-hit.wav`; if it wins, it replaces this file at 0.98.
  leechHit:   ['audio/sfx/leech-hit.wav', 1.0],
  wrongKey:   ['audio/sfx/wrong-key.wav', 0.9],
  lampCall:   ['audio/sfx/lamp-call.wav', 0.9],
  lastStand:  ['audio/sfx/last-stand.wav', 0.9],
  shedLayer:  ['audio/sfx/shed-layer.wav', 0.9],
  sweepReversed: ['audio/sfx/sweep-reversed.wav', 0.9],
  bossCalm:   ['audio/sfx/boss-calm.wav', 0.9],
  laneSecured:['audio/sfx/lane-secured.wav', 0.9],
  bossDown:   ['audio/sfx/boss-down.wav', 0.9],
  // ---- THE 2026-08-29 SECOND ORDER (Gil's own downloads) -------------------
  // These are takes Gil found himself, not pack candidates. Three carry a cut he
  // asked for; the cut figure is a GAME constant in each case, named below.
  speedUp:    ['audio/sfx/speed-up.mp3', 0.9],   // 2.12s — a surge is rare, it can breathe
  // 4.03s, but only its first 1.4s is above -26 dB. It is cued on a hazard that
  // lives 3s, and it plays at 0.4, so the tail sits under everything.
  latchWarn:  ['audio/sfx/latch-warn.mp3', 0.4],
  traced:     ['audio/sfx/traced.wav', 0.9],
  bootGodspeed: ['audio/sfx/boot-godspeed.mp3', 0.9], // 0.38s radio — Gil's own find
  // CUT TO 0.50s, WHICH IS THE DOCK. `volley.charge` fills to 0.5 and then the
  // bolt flies, so the take is exactly that long and its end lands on the shot.
  // It is also STOPPED early when the dock breaks — see sfx.volleyCharge.
  volleyCharge: ['audio/sfx/volley-charge.wav', 0.9],
  // CUT TO ITS AUDIBLE MIDDLE (0.55-0.78s of the source). The take was 1.27s of
  // dead air around one event, exactly as Gil described it.
  volleyFizzle: ['audio/sfx/volley-fizzle.wav', 0.9],
  // ---- THE STAGE TRANSITION (Gil's swoosh, 2026-08-29) ---------------------
  // CUT SO ITS PEAK LANDS ON THE PICTURE CUT. The source swoosh was 1.90s and
  // peaked at 0.60s; the transition is 0.62s and flips the screen at 0.30s. Left
  // whole, its loudest moment would have arrived as the next stage was already
  // up, and it would still have been playing 1.3s into the new lane.
  //
  // The take starts 0.30s into the source, so the peak arrives 0.30s in — ON the
  // switch — and runs 0.70s so the tail resolves just past the transition instead
  // of stopping dead. MOVE THE TRANSITION AND THIS CUT MOVES WITH IT: the figures
  // are `dur: 0.62` and the 0.30s midpoint in startTrans (99-boot.js:129).
  transWarp:  ['audio/sfx/trans-warp.wav', 0.9],
  transCut:   ['audio/sfx/trans-cut.wav', 0.55]
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
// SOME CUES MUST STOP ON AN EVENT, NOT ON A CLOCK. `cut` below can end a take at
// a time known when it starts; the volley charge is not that. It runs while both
// emitters stay docked and has to stop the instant that stops being true, which
// may be any frame. So a named voice can be held and killed later.
const liveVoices = {};
function stopSample(name, fade) {
  const v = liveVoices[name];
  if (!v) return false;
  delete liveVoices[name];
  const ac = AC, t = ac ? ac.currentTime : 0, f = fade === undefined ? 0.04 : fade;
  try {
    if (v.g.gain.setValueAtTime && v.g.gain.linearRampToValueAtTime) {
      v.g.gain.setValueAtTime(v.g.gain.value, t);
      v.g.gain.linearRampToValueAtTime(0.0001, t + f);
      v.src.stop(t + f + 0.02);
    } else v.src.stop();
  } catch (e) {} // already ended on its own — that is the normal case
  return true;
}
// play a decoded sample through the sfx bus; false = not ready, use the synth.
// offset skips into the take; fadeIn ramps the entry instead of a hard start;
// cut ends the take early — hold `cut` seconds, then a `fadeOut`-second ramp
function playSample(name, vol, pan, rate, delay, offset, fadeIn, cut, fadeOut, hold) {
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
  if (hold) { stopSample(hold, 0); liveVoices[hold] = { src, g }; src.onended = () => { if (liveVoices[hold] && liveVoices[hold].src === src) delete liveVoices[hold]; }; }
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
  // the collar charge and the repair both follow the pick take on its frame — 0.12s late, so they read as the SECOND sound
  shieldUp() {
    if (playSample('shieldUp')) return;
    tone(392, 0.18, 'triangle', 0.11, 523, null, 0.12); tone(784, 0.3, 'sine', 0.09, 1047, null, 0.12);
  },
  shieldHit() {
    if (playSample('shieldHit')) return;
    tone(1047, 0.22, 'triangle', 0.13, 523); tone(196, 0.28, 'square', 0.09, 98);
  },
  // 0.12s late on purpose: it fires on the zap's frame and was lost in the take's transient
  perfect() { tone(2093, 0.14, 'triangle', 0.13, 2637, null, 0.12); tone(3136, 0.10, 'sine', 0.08, 3520, null, 0.12); },
  count() { tone(600, 0.12, 'square', 0.12, 560); },
  bossShot() { tone(140, 0.22, 'sawtooth', 0.13, 70); },
  go()    { tone(880, 0.20, 'square', 0.14, 1320); tone(1760, 0.30, 'triangle', 0.10, 2200); },
  heal()  {
    if (playSample('heal')) return;
    tone(523, 0.14, 'triangle', 0.12, 659, null, 0.12); tone(784, 0.22, 'triangle', 0.10, 1047, null, 0.12);
  },
  speedUp()  {
    if (playSample('speedUp')) return;
    tone(180, 0.45, 'sawtooth', 0.11, 880); tone(110, 0.55, 'triangle', 0.09, 440);
  },
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
  // ---- H-33 · THE RAY ----
  // The wind-up, fired the frame a light is born. It runs under BEAM_BURST — the
  // window the ray spends erupting before it is allowed to turn or fry — so the
  // charge and the visible growth are one event.
  //
  // THE TAKE NOW SETS THAT WINDOW, not the other way round. BEAM_BURST is
  // RAY_CHARGE_RELEASE, the point ray-charge.mp3 peaks and lets go, so the light
  // launches on the release. The synth below is the FALLBACK — it is 0.44s, so if
  // the take ever fails to decode the picture still grows for the full window and
  // the charge simply ends early. That is a quiet degrade, not a break.
  rayCharge(pan) {
    if (playSample('rayCharge', 1, pan)) return;
    // DEEP, AND IT BUILDS (Gil, 2026-08-26 — the first pass was thin).
    //
    // The rewrite is one idea: everything here SWELLS. The first version was made
    // of `tone` and `crackle`, which ramp their gain down from the first sample, so
    // it decayed while the picture said it was loading — and it climbed to 470 Hz,
    // which is the register a sci-fi beep lives in. Both are gone.
    //
    // Mass comes from the bottom and from the FILTER, not from pitch. The three
    // layers barely move in frequency (38→52, 82→104, 150→300); what changes is how
    // much of each one gets through as its lowpass opens. That is what a real
    // machine loading up does — it thickens, it does not rise.
    //
    // RUNS PAST BEAM_BURST ON PURPOSE. The burst window is 0.30s, which is only
    // about eleven cycles of a 38 Hz sub — too tight for anything that has to read
    // as deep. These run 0.44s, so the charge releases INTO the rotation rather
    // than stopping dead the instant the light moves. It costs no gameplay timing:
    // the sustained sweep voice fades in over its own 0.22s, so the two crossfade.
    const D = 0.44;
    swell(38, 52, D, 'sine', 0.20, 120, 190, 0, pan);        // the sub: the mass loading
    swell(82, 104, D, 'sawtooth', 0.115, 160, 900, 0, pan);  // the coil, thickening as it fills
    swell(150, 300, D * 0.9, 'triangle', 0.055, 300, 1500, 0.03, pan); // the harmonic that arrives late
    swellNoise(D, 90, 520, 7, 0.085, 0, pan);                // pressure behind it, resonant and low
    // and the release — a hard low thud as it lets go into the sweep. This one is
    // a decay, correctly: it is a hit, not a build.
    tone(120, 0.16, 'sine', 0.14, 46, null, D * 0.93, pan);
    crackle(0.07, 1600, 420, 5, 0.085, D * 0.93, pan);
  },
  // ---- H-33 · ONE TORN PLATE ----
  // Six of these walk the machine apart before the implosion. They used to be one
  // identical `crackle` + square tone, six times — no low end, no shockwave, and
  // no way to tell the first plate from the last.
  //
  // `n` is `b.dyingN`, a COUNTER, never a roll (docs/IN-RUN-VOICE.md rule 2): a
  // random variation here would draw from the sim stream and desync the verifier.
  // The counter also earns its keep dramatically — each plate lands lower and
  // heavier than the one before, so the six read as a machine coming apart on a
  // ramp toward the implosion instead of six copies of one pop.
  bossPlate(n, pan) {
    const i = Math.max(0, Math.min(5, n | 0)), k = i / 5;
    // THE TAKE, PITCHED DOWN AS THE SEQUENCE WALKS — one file, six weights. This
    // is the whole cue now that boss-plate.mp3 has landed: Gil asked for the one
    // explosion MULTIPLIED at different pitches so the six read as different parts
    // of the machine, rather than six copies of one pop. The spread is 1.20 down
    // to 0.85 (about five semitones) — wide enough to tell plate 0 from plate 5,
    // narrow enough that the last one still ends before the verdict card at 3.2s.
    if (playSample('bossPlate', 0.82 + 0.18 * k, pan, 1.20 - 0.35 * k)) return;
    // THE SHOCKWAVE. This is the part that was missing: a sub that drops an
    // octave and rings out well past the crack. Without it a blast is all
    // paper and no air.
    tone(74 - 16 * k, 0.55 + 0.25 * k, 'sine', 0.15 + 0.05 * k, 26 - 6 * k, null, 0, pan);
    // the body — broadband, falling, the mass of the thing
    crackle(0.34 + 0.14 * k, 900 - 260 * k, 70, 1.1, 0.30 + 0.08 * k, 0, pan);
    // the crack that fronts it — short, bright, gone before the body peaks
    crackle(0.07, 5200 - 900 * k, 1500, 4, 0.20, 0, pan);
    // metal letting go, staggered off the counter so no two plates land alike
    crackle(0.10, 2600 + i * 260, 700, 7, 0.10, 0.05 + i * 0.012, pan);
    crackle(0.13, 1500 - i * 120, 380, 5, 0.08, 0.13 + i * 0.018, pan);
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
  // THE ARRIVAL, as a recorded bed. Fired on the frame the machine surfaces and
  // held across the ceremony, then eased out through the take's own dip so the
  // fight opens in the clear. No synth fallback ON PURPOSE: the ceremony's
  // synthesised cues were cut deliberately (see spawnBoss), so a missing take
  // means silence — which is exactly what shipped before this file existed.
  bossArrive(hold, fade) { return playSample('bossArrive', 1, 0, 1, 0, undefined, 0, hold, fade); },
  // THE MACHINE DYING, as a recorded take. Called from the death ceremony ~1.43s
  // BEFORE the implosion so the take's own blast lands on it (the build-up scores
  // the convulsions on the way there). Returns false when the take has not
  // decoded — the caller then falls back to bossDown() ON the implosion frame,
  // because the synth voice has no build-up to schedule against.
  bossDeadTake() { return playSample('bossDead'); },
  bossDown() { // the implosion when boss-dead.mp3 did not decode — now a take of its own
    if (playSample('bossDown')) return;
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
    // Fired on the frame the run ends. The take is a SWELL — it needs ~0.44s to reach
    // its loud stretch — and WARP_COLLAPSE.at is set to that figure so the visual bump
    // lands inside the sound rather than ahead of it. Move one, move the other.
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
  // ---- H-20 · THE VERDICT HAS TIERS. Every clear used to land on the same `win`
  // sting and the same three-note star chime; the END card is where the grade is
  // read, so the grade is voiced there. `star` is the per-pop chime (unchanged
  // pitch ladder), `starsFull` is the resolve that follows the LAST star and
  // grows with the count, `newBest` is the badge's own stamp, and `unlock` is
  // the sound of the next lane's key landing. All triangle/sine, all short: the
  // recorded `win` sting has already played by the time any of these fire.
  star(n) { tone(760 + n * 220, 0.2, 'triangle', 0.13, 900 + n * 260); },
  starsFull(n) {
    if (n >= 3) { // full marks: a quick bright arpeggio into a held top note
      [1047, 1319, 1568].forEach((f, i) => tone(f, 0.18, 'triangle', 0.10, f * 1.01, null, 0.12 + i * 0.07));
      tone(2093, 0.55, 'sine', 0.07, null, null, 0.33);
      tone(523, 0.6, 'sine', 0.06, null, null, 0.33);
    } else if (n === 2) { // two: a rising fifth, confirmed
      tone(1319, 0.14, 'triangle', 0.09, 1397, null, 0.12);
      tone(1568, 0.3, 'triangle', 0.08, null, null, 0.24);
    } // one star: the pop chime alone is the verdict
  },
  newBest() { // the badge stamps: a ping with a shimmer, over a low body
    tone(2093, 0.12, 'sine', 0.11, 2349);
    tone(2637, 0.10, 'sine', 0.07, 3136, null, 0.08);
    tone(3136, 0.22, 'triangle', 0.05, 3520, null, 0.16);
    tone(262, 0.5, 'sine', 0.07, 330);
  },
  unlock() { // a lane key turns: two rising notes, soft
    tone(440, 0.16, 'triangle', 0.08, 880);
    tone(880, 0.26, 'sine', 0.07, 1760, null, 0.08);
  },
  traced() { // BONUS RIBBON ridden to the end — resolve the rising trace tone
    if (playSample('traced')) return;
    tone(880, 0.09, 'sine', 0.12, 1047);
    tone(1319, 0.14, 'sine', 0.10, 1760, null, 0.07);
    tone(2637, 0.10, 'triangle', 0.05, 3136, null, 0.13);
  },
  fail() {
    if (playSample('fail')) return;
    [330, 262, 196].forEach((f, i) => setTimeout(() => tone(f, 0.3, 'sawtooth', 0.1), i * 180));
  },
  // ======================================================================
  // THE 2026-08-29 ORDER — cues that used to be written inline in the middle
  // of a game file. Each moved here so it could have a take at all: an inline
  // `tone()` has no name to hang a sample on. THE SYNTH LINES ARE VERBATIM —
  // the roster in scripts/sfx-roster.js pins them byte for byte, so a cue that
  // was retuned in the game and not here fails the build.
  // ======================================================================
  // ======================================================================
  // FOUND 2026-08-29, LATE. Gil asked "what about the level transition, the one
  // with the mini warp effect?" — and it was not on the roster at all. Nor were
  // six others: my first sweep of the game for inline `tone()` calls was piped
  // through `head -30` and silently lost everything after 72-tick.js. These are
  // the rest of it. They are lifted here on the same rule as the others: the
  // synth lines are verbatim, a take goes in front when one exists.
  // ======================================================================
  // THE STAGE TRANSITION — the mini warp. 0.62s, and the ONE screen change that
  // carries the player between lanes: NEXT STAGE, RETRY, RETRY ASSIST, the duel
  // CONTINUE, FIRST CONTRACT, NEXT CONTRACT and the pause menu's RESTART all run
  // it (7 call sites). A packet flush: the run's data dives to the node, then a
  // bright ping at the switch as the next node blooms open. The ping is at 0.30s,
  // which is the MIDPOINT of the 0.62s transition — a take must put its own
  // switch there or the sound and the picture disagree.
  transWarp() {
    if (playSample('transWarp')) return;
    tone(300, 0.34, 'sine', 0.12, 55); crackle(0.34, 2600, 380, 1.4, 0.35);
    tone(760, 0.2, 'sine', 0.11, 1240, undefined, 0.30);
  },
  // the OTHER transition: a 0.26s cut, no warp. Used where a screen swaps rather
  // than the player travelling.
  transCut() {
    if (playSample('transCut')) return;
    crackle(0.09, 1200, 3200, 2, 0.35);
  },
  // QUALIFIED — the course's own ceremony. A rising clearance chord: the line
  // accepts its defender. It plays once per player, ever.
  qualified() {
    if (playSample('qualified')) return;
    tone(330, 0.5, 'sine', 0.10);
    tone(415, 0.5, 'sine', 0.09, null, null, 0.14);
    tone(494, 0.6, 'sine', 0.09, null, null, 0.28);
    tone(659, 1.1, 'sine', 0.08, null, null, 0.42);
  },
  // a drill rep is held long enough — the lock-in confirm
  drillLock() {
    if (playSample('drillLock')) return;
    tone(880, 0.12, 'sine', 0.08, 1320);
  },
  // THE COURSE HOLDS ITS BREATH. The pulse drill freezes the run to teach the
  // release; these two are a matched PAIR, down then up, and a take for one
  // without the other leaves the freeze unresolved.
  tutFreeze() {
    if (playSample('tutFreeze')) return;
    tone(720, 0.9, 'sine', 0.10, 70);
  },
  tutRelease() {
    if (playSample('tutRelease')) return;
    tone(90, 0.5, 'sine', 0.08, 660);
  },
  // the END card's score rolling up — every 0.07s while the number climbs, so it
  // is the most REPEATED cue in the game after the menu press. It must be tiny.
  endCount() {
    if (playSample('endCount')) return;
    tone(1500, 0.025, 'square', 0.035);
  },
  // ---- the second 2026-08-29 order ----
  // THE VOLLEY CHARGE, held so it can be killed. The dock lasts 0.5s and the take
  // is cut to exactly that, so on a completed dock it ends on the shot by itself.
  // A BROKEN DOCK IS THE CASE THAT NEEDED THE HANDLE: the thumbs can part on any
  // frame, and a charge that keeps whining after the dock is gone is the game
  // lying about its own state. `sfx.volleyStop()` is called on that frame.
  volleyCharge() {
    if (playSample('volleyCharge', 1, 0, 1, 0, undefined, 0, 0, 0, 'volleyCharge')) return;
    crackle(0.5, 300, 2200, 2, 0.28);
  },
  volleyStop() { return stopSample('volleyCharge', 0.05); },
  volleyFizzle() { // the dock broke before the charge completed
    if (playSample('volleyFizzle')) return;
    tone(600, 0.08, 'sine', 0.04, 380);
  },
  // A DEAD ZONE ENTERS THE LANE. Three call sites — the linter's own hazard, the
  // boss's wall, and the tutorial's scripted one — all said this in triplicate.
  latchWarn() {
    if (playSample('latchWarn')) return;
    tone(1180, 0.02, 'square', 0.05); tone(1180, 0.02, 'square', 0.05, null, null, 0.22);
    crackle(0.25, 500, 1800, 2, 0.3);
  },
  // GODSPEED — the release. The take is a radio, which is what the synth was
  // always imitating: a squelch, two acks and a low engage.
  bootGodspeed() {
    if (playSample('bootGodspeed')) return;
    crackle(0.07, 1300, 2700, 2, 0.4);
    tone(740, 0.05, 'square', 0.09, null, null, 0.08);
    tone(740, 0.05, 'square', 0.09, null, null, 0.17);
    tone(58, 0.4, 'sine', 0.22, 42);
  },
  // A THUMB LANDS. Two takes, not one pitched twice: the pair IS the ack, and
  // the second thumb has always answered a fifth above the first. `other` is
  // true when the OTHER pad is already held, which is the completing press.
  padPress(other, side) {
    if (playSample(other ? 'padPress2' : 'padPress1')) return;
    tone(other ? 1046 : 698, 0.05, 'square', 0.05);
    tone(other ? 1568 : 1046, 0.04, 'sine', 0.03, null, null, 0.05);
  },
  // the run's FIRST x10. It rides 0.12s behind the zap take it answers, which
  // is why the sample is delayed too — on the same frame the hit ate it.
  x10() {
    if (playSample('x10', 1, 0, 1, 0.12)) return;
    tone(1046, 0.14, 'triangle', 0.09, 1568, null, 0.12);
    tone(1568, 0.2, 'triangle', 0.07, 2093, null, 0.22);
  },
  chain() { // CHAIN OVERDRIVE: the zap arcs to the nearest interdictor
    if (playSample('chain')) return;
    tone(1976, 0.1, 'triangle', 0.08, 2960);
  },
  volleyBlast() { // BLAST xN — the bolt takes the interdictors around its mark
    if (playSample('volleyBlast')) return;
    crackle(0.18, 900, 2600, 2, 0.45);
  },
  // AN ARMORED INTERDICTOR COLLAPSES. The synth thump was an accent that only
  // played when the hit take was ABSENT, so with hit-1.wav decoding it never
  // sounded at all. The take is not gated that way — it was picked to be heard,
  // and it layers under the kill. The synth keeps its old condition, which the
  // caller still applies, so a no-sample build sounds exactly as it did.
  armorThump() { return playSample('armorThump'); },
  armorThumpSynth() { tone(110, 0.2, 'square', 0.13, 60); },
  railLatched(pan) { // RAIL LATCHED — a dead zone seizes part of the rail
    if (playSample('railLatched', 1, pan)) return;
    tone(140, 0.3, 'sawtooth', 0.12, 70);
    crackle(0.3, 2400, 500, 4, 0.6);
  },
  leechHit() { // LEECH HIT — a pulse lands on the machine
    if (playSample('leechHit')) return;
    tone(70, 0.3, 'sine', 0.2, 40);
    crackle(0.35, 2000, 300, 2, 0.8);
  },
  wrongKey() { // WRONG KEY / BOTH KEYS — a fizzle, not thunder
    if (playSample('wrongKey')) return;
    tone(620, 0.12, 'sine', 0.08, 340);
    crackle(0.15, 1600, 700, 1, 0.3);
  },
  // THE LAMP NAMES A KEY. The pitch said which one, so the take carries the
  // same information by playback RATE — blue low, white a fourth above it.
  // Same trick as bossPlate: one file, the reading is in the interval.
  lampCall(lamp) {
    if (playSample('lampCall', 1, 0, lamp === 0 ? 1 : 1.27)) return;
    tone(lamp === 0 ? 520 : 660, 0.12, 'sine', 0.07, lamp === 0 ? 400 : 520);
  },
  lastStand() { // LAST STAND — the machine commits everything
    if (playSample('lastStand')) return;
    tone(160, 0.5, 'sawtooth', 0.14, 60);
    crackle(0.45, 3200, 700, 6, 1.0, 0.1);
  },
  shedLayer() { // IT SHEDS A LAYER — a round ends
    if (playSample('shedLayer')) return;
    tone(150, 0.5, 'sawtooth', 0.13, 70);
    crackle(0.4, 2600, 600, 4, 0.8);
  },
  sweepReversed() { // SWEEP REVERSED — the light turns back
    if (playSample('sweepReversed')) return;
    tone(240, 0.2, 'sawtooth', 0.1, 120);
  },
  bossCalm() { // a pattern is survived — back to idle
    if (playSample('bossCalm')) return;
    tone(960, 0.04, 'sine', 0.06); tone(960, 0.04, 'sine', 0.06, null, null, 0.16);
  },
  laneSecured() { // LANE SECURED — the last interdictor of a wave is gone
    if (playSample('laneSecured')) return;
    tone(784, 0.18, 'triangle', 0.1, 1046);
    tone(1046, 0.22, 'triangle', 0.08, 1568, null, 0.12);
  },
  tick() { // techy UI click: a crisp tap with a tiny body
    if (playSample('ui')) return;
    tone(2200, 0.02, 'square', 0.05, 1400);
    tone(660, 0.035, 'sine', 0.045, 480, null, 0.006);
  }
};
