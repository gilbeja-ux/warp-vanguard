'use strict';
// ---------- audio ----------
let AC = null, sfxGain = null;
// the master limiter every bus exits through (H-13); null only when the
// browser has no DynamicsCompressor, so route via masterBus(), never directly
let masterLim = null;
const masterBus = () => masterLim || AC.destination;
// smooth sfx-bus envelope (0 = muted, 1 = full). Slammed to 0 for the replay
// enter + while the scrub knob is held, then eased back to 1 so sound doesn't
// pop in. Applied to sfxGain every frame (see the frame loop); music is separate.
let sfxFade = 1, sfxFadeTgt = 1, sfxFadeRate = 6; // rate: snappy (6) for scrub, slow (~1s) for the replay enter
// THE ACCENT LIFT. Every synth voice (tone) used to enter the sfx bus at its own
// 0.07-0.13 gain while the recorded takes enter at 0.8-1.0 — measured through the
// real bus, the accents sat 10-15 dB under the takes, and every accent in the game
// fires on the SAME frame as a take (the x10 chime under the zap, PERFECT under the
// zap, shieldUp/heal under the pick). On a phone speaker that is "sometimes no
// sound on x10". One gain on the way in lifts every accent together; tune it on
// the device with the soundboard (scripts/soundboard.html), not by ear on the Mac.
const ACCENT_LIFT = 3.16; // ×3.16 = +10 dB — set on the phone by Gil, 2026-08-23
let accentGain = null;
function sfxBusGain() { return (settings.sound ? settings.soundVol : 0) * sfxFade; }
const settings = {
  sound: true, soundVol: 0.8, music: true, musicVol: 0.32, haptics: true // music sits low so the cues read over it
};
// score-chase modifiers — unlocked with the campaign, toggled on the menu
const mutators = { oneLife: false, fast: false, noPickups: false };
// MODIFIERS ARE FREE-FLOW EQUIPMENT. The toggles persist (they are the player's flow
// loadout, saved with the profile) but they only BITE when the run is a flow run —
// endless is true for both the endless lane and the weekly. They used to read raw
// everywhere, so a loadout armed in Free Flow silently applied to every campaign run:
// quarter hull, faster traffic, no pickups, multiplied scores. mutLive is the one
// gate; every application site reads through it. The UI that PREVIEWS the loadout on
// the flow screen wants the raw product — that is mutMulRaw, and it is UI-only.
const mutLive = k => mutators[k] === true && endless;
const mutMul = () => (mutLive('oneLife') ? 2 : 1) * (mutLive('fast') ? 1.5 : 1) * (mutLive('noPickups') ? 1.3 : 1);
const mutMulRaw = () => (mutators.oneLife ? 2 : 1) * (mutators.fast ? 1.5 : 1) * (mutators.noPickups ? 1.3 : 1);
function applySettings() {
  saveState();
  if (sfxGain) sfxGain.gain.value = sfxBusGain();
  updateMusic(); // volumes live on the takes; nudge now for instant slider feedback
}
function initAC() {
  if (AC) return;
  try {
    AC = new (window.AudioContext || window.webkitAudioContext)();
    sfxGain = AC.createGain();
    accentGain = AC.createGain(); accentGain.gain.value = ACCENT_LIFT; accentGain.connect(sfxGain);
    // H-13 · THE CEILING OVER THE SUM. The sfx compressor below glues its own
    // bus, but music (and the splash score) used to meet the sfx at the raw
    // destination — a dense wave plus a hot take clipped at the output. This is
    // a brickwall stage every bus routes through: threshold near full scale,
    // max ratio, fastest attack, so it does nothing until the summed mix
    // actually spikes. Per-bus character stays where it was.
    if (AC.createDynamicsCompressor) {
      masterLim = AC.createDynamicsCompressor();
      masterLim.threshold.value = -2; masterLim.knee.value = 0;
      masterLim.ratio.value = 20;
      masterLim.attack.value = 0.001; masterLim.release.value = 0.1;
      masterLim.connect(AC.destination);
      const comp = AC.createDynamicsCompressor(); // glue the sfx layers, catch hot peaks
      comp.threshold.value = -18; comp.ratio.value = 4;
      comp.attack.value = 0.003; comp.release.value = 0.15;
      sfxGain.connect(comp); comp.connect(masterLim);
    } else sfxGain.connect(AC.destination);
    applySettings();
    loadSamples(); // recorded sfx decode in the background; synths cover until then
    // H-20 · THE PHONE CALL. A call (or Siri, or an alarm) takes the audio session
    // from under the page WITHOUT a visibilitychange — WebKit parks the context in
    // its own 'interrupted' state and nothing here ever fired. The game played on,
    // silent, and kept playing when the call ended. So: an interruption mid-run
    // pauses the run the way a hide does, and the resume paths below (the next
    // gesture, the next show) ask for any state that is not 'running', not only
    // 'suspended'. audioWake() is that one ask.
    AC.addEventListener('statechange', () => {
      if (AC.state === 'interrupted' && state === S.PLAY) state = S.PAUSE;
    });
  } catch (e) {}
}
// resume the context from ANY parked state — 'suspended' (autoplay policy, a hide)
// or WebKit's 'interrupted' (a call). Safe to call on every gesture; a running
// context is a no-op.
function audioWake() {
  if (AC && AC.state !== 'running' && AC.state !== 'closed') AC.resume().catch(() => {});
}
function audio() {
  initAC();
  audioWake();
  // during the boot splash its score owns the mix — the menu track would land
  // on top of it; splashAudioTry() picks the take up once the context runs
  if (SPLASH.on) return AC;
  // NO TRACK CHOICE HERE. A gesture unlocks the context and nothing more — what
  // plays is decided by game state in updateMusic, so the soundtrack can't depend
  // on which screen a tap happened to land on.
  return AC;
}
// a MENU screen for soundtrack purposes: the menu itself, the field guide when it
// was opened from the home screen rather than mid-run, and the enlistment.
//
// THE ENLISTMENT COUNTS because the course behind the discs is set up, not played —
// the player is being talked to. Silence there made the game's first minute feel
// like it had failed to load.
//
// UP TO THE LAST TAP, AND NOT PAST IT. `enlist.out` is the hand-off running, which
// is this sequence's DEPLOY press — from that instant the menu piece is no longer
// what the bus wants, so the contract performs the cut itself and nothing has to
// fight the piece back down. Without that clause it would spool straight back up
// underneath the fade, because the state stays S.ENLIST for another 0.7s.
const menuScreenNow = () => state === S.MENU
  || (state === S.ENLIST && !(enlist && enlist.out))
  || (state === S.GUIDE && (!guide || guide.from !== 'pause'));
// ...and its counterpart: the pause card's music hold has to survive stepping
// OFF the card into the guide. The guide opened mid-run is still the pause —
// the run is frozen behind it — so the track stays parked where it stood
// instead of spooling back up for a screen that isn't the lane.
const pauseHeldNow = () => state === S.PAUSE || (state === S.GUIDE && !!guide && guide.from === 'pause');
function tone(freq, dur, type, vol, slideTo, dest, delay, pan) {
  if (simMuted) return;
  const ac = AC; if (!ac || !sfxGain) return;
  const t0 = ac.currentTime + (delay || 0);
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type || 'square'; o.frequency.setValueAtTime(freq, t0);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(vol || 0.12, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  let tail = g;
  if (pan && ac.createStereoPanner) {
    const p = ac.createStereoPanner(); p.pan.value = clamp(pan, -1, 1);
    g.connect(p); tail = p;
  }
  o.connect(g); tail.connect(dest || accentGain || sfxGain); o.start(t0); o.stop(t0 + dur);
}
// filtered noise burst — the electric texture tones can't make. A cached
// noise buffer runs through a swept bandpass with a tight envelope.
let noiseBuf = null;
function crackle(dur, f0, f1, q, vol, delay, pan) {
  if (simMuted) return;
  const ac = AC; if (!ac || !sfxGain || !ac.createBuffer) return;
  const t0 = ac.currentTime + (delay || 0);
  if (!noiseBuf) {
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 0.5, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const src = ac.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
  const bp = ac.createBiquadFilter();
  bp.type = 'bandpass'; bp.Q.value = q;
  bp.frequency.setValueAtTime(f0, t0);
  if (f1) bp.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
  const g = ac.createGain();
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  let tail = g;
  if (pan && ac.createStereoPanner) {
    const p = ac.createStereoPanner(); p.pan.value = clamp(pan, -1, 1);
    g.connect(p); tail = p;
  }
  src.connect(bp); bp.connect(g); tail === g ? g.connect(sfxGain) : tail.connect(sfxGain);
  src.start(t0); src.stop(t0 + dur);
}
// ---------- SWELL: a sound that ARRIVES (H-33) ----------
//
// `tone` and `crackle` both ramp their gain DOWN from the first sample. That is
// exactly right for a hit — a zap, a pop, a plate coming off — and exactly wrong
// for anything that WINDS UP. The first ray charge was built out of them and it
// read as thin and synthetic for that one reason: it was decaying while the
// picture said it was building.
//
// These two are the mirror. The gain climbs to its peak at the END of the window
// and releases from there, and a LOWPASS opens alongside it — which is the part
// that sells mass. A real machine loading up does not get higher, it gets THICKER:
// more harmonics arrive as more energy goes in. Pitch that climbs into the top of
// the register is the sci-fi beep this is trying not to be, so the frequency ramps
// stay low and the filter does the work.
function swell(f0, f1, dur, type, vol, lp0, lp1, delay, pan) {
  if (simMuted) return;
  const ac = AC; if (!ac || !sfxGain || !ac.createBiquadFilter) return;
  const t0 = ac.currentTime + (delay || 0);
  const o = ac.createOscillator(), g = ac.createGain(), lp = ac.createBiquadFilter();
  o.type = type || 'sawtooth';
  o.frequency.setValueAtTime(f0, t0);
  if (f1 && o.frequency.exponentialRampToValueAtTime) o.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
  lp.type = 'lowpass'; lp.Q.value = 4;
  lp.frequency.setValueAtTime(lp0 || 300, t0);
  if (lp1 && lp.frequency.exponentialRampToValueAtTime) lp.frequency.exponentialRampToValueAtTime(lp1, t0 + dur);
  // the peak lands at 88% and holds to the end, so the loudest instant is the
  // RELEASE — the moment the thing lets go — not the moment it started
  const peak = t0 + dur * 0.88;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, peak);
  g.gain.setValueAtTime(vol, t0 + dur);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur + 0.07);
  let tail = g;
  if (pan && ac.createStereoPanner) {
    const p = ac.createStereoPanner(); p.pan.value = clamp(pan, -1, 1);
    g.connect(p); tail = p;
  }
  o.connect(lp); lp.connect(g); tail.connect(accentGain || sfxGain); // the accent bus, like tone()
  o.start(t0); o.stop(t0 + dur + 0.12);
}
// the noise half of the same idea: a resonant band that opens as the charge loads
function swellNoise(dur, f0, f1, q, vol, delay, pan) {
  if (simMuted) return;
  const ac = AC; if (!ac || !sfxGain || !ac.createBuffer) return;
  const t0 = ac.currentTime + (delay || 0);
  if (!noiseBuf) {
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 0.5, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const src = ac.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
  const bp = ac.createBiquadFilter();
  bp.type = 'bandpass'; bp.Q.value = q;
  bp.frequency.setValueAtTime(f0, t0);
  if (f1 && bp.frequency.exponentialRampToValueAtTime) bp.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + dur * 0.88);
  g.gain.setValueAtTime(vol, t0 + dur);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur + 0.07);
  let tail = g;
  if (pan && ac.createStereoPanner) {
    const p = ac.createStereoPanner(); p.pan.value = clamp(pan, -1, 1);
    g.connect(p); tail = p;
  }
  src.connect(bp); bp.connect(g); tail.connect(accentGain || sfxGain); // the accent bus, like tone()
  src.start(t0); src.stop(t0 + dur + 0.12);
}
// THE ENGINE BED — the tunnel's own voice, held for the length of a run.
//
// in-warp.mp3 is the engine now: a recorded 8.9s bed on a seamless loop, sitting
// well down in the mix so it reads as the ship rather than as a sound effect. The
// synth bed below (filtered noise + a 55Hz sub, breathing on a slow LFO) is kept
// as the FALLBACK for the window before the sample has decoded — the same
// arrangement every other recorded cue in the game uses, so a slow first load
// degrades to the old voice instead of to silence.
//
// One entry point, called once per frame from frame() with `state === S.PLAY`, so
// leaving the lane by ANY route — win, loss, quit, pause into a menu — takes the
// engine with it. `fast` cuts it hard instead of easing: a collapsed lane halts,
// it does not coast.
let ambNodes = null;
let warpBed = null; // { src, g } — the looping in-warp take, when it is the voice
function ambient(on, fast) {
  // createBuffer is NOT required here any more, only by the synth fallback below —
  // the recorded bed just needs a source and a gain. Gating the whole function on it
  // meant a context without it (the headless harness) silently had no engine at all.
  const ac = AC; if (!ac || !sfxGain) return;
  const buf = sampleBufs && sampleBufs.inWarp;
  // SILENCE THE SYNTH whenever it should not be running — either the lane is over,
  // or the recording has finished decoding mid-run and is taking the bed off it.
  // Handled first, and NOT by recursing: the recorded path returns early, so a
  // recursive hand-over would leave the synth playing under it forever.
  if (ambNodes && (!on || buf)) {
    const an = ambNodes; ambNodes = null;
    an.g.gain.setTargetAtTime ? an.g.gain.setTargetAtTime(0.0001, ac.currentTime, fast ? 0.12 : 0.4) : (an.g.gain.value = 0);
    setTimeout(() => { try { an.src.stop(); an.hum.stop(); an.lfo.stop(); } catch (e) {} }, fast ? 500 : 1600);
  }
  // --- preferred: the recorded engine, looped ---
  if (on && buf && !warpBed && !simMuted) {
    const src = ac.createBufferSource();
    src.buffer = buf; src.loop = true;
    // loop INSIDE the audible region: the take's own encoder padding would tick
    // once per lap, which on a bed you hear for a whole run is the one artefact
    // that would make it unusable
    const tr = sampleTrim && sampleTrim.inWarp;
    if (tr && src.loopStart !== undefined) { src.loopStart = tr.start; src.loopEnd = tr.end; }
    const g = ac.createGain();
    const lvl = SFX_FILES.inWarp[1];
    g.gain.value = 0.0001;
    src.connect(g); g.connect(sfxGain);
    src.start(0, tr ? tr.start : 0);
    // rise with the lane rather than snapping on — the spool-up is 2.4s of picture
    if (g.gain.setTargetAtTime) g.gain.setTargetAtTime(lvl, ac.currentTime, 0.8);
    else g.gain.value = lvl;
    warpBed = { src, g };
  }
  if (!on && warpBed) {
    const wb = warpBed; warpBed = null;
    const tc = fast ? 0.12 : 0.55;
    if (wb.g.gain.setTargetAtTime) wb.g.gain.setTargetAtTime(0.0001, ac.currentTime, tc);
    else wb.g.gain.value = 0;
    setTimeout(() => { try { wb.src.stop(); } catch (e) {} }, fast ? 500 : 2200);
  }
  if (buf) return;                            // the recording owns the bed
  // --- fallback: the original synth voice, until the sample lands ---
  if (on && !ambNodes && ac.createBuffer) {
    if (!noiseBuf) {
      noiseBuf = ac.createBuffer(1, ac.sampleRate * 0.5, ac.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const src = ac.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 220; lp.Q.value = 0.4;
    const g = ac.createGain(); g.gain.value = 0;
    const hum = ac.createOscillator(); hum.type = 'sine'; hum.frequency.value = 55;
    const hg = ac.createGain(); hg.gain.value = 0.014;
    const lfo = ac.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 0.13;
    const lg = ac.createGain(); lg.gain.value = 0.008;
    src.connect(lp); lp.connect(g); g.connect(sfxGain);
    hum.connect(hg); hg.connect(g);
    lfo.connect(lg); if (g.gain.setTargetAtTime) lg.connect(g.gain);
    src.start(); hum.start(); lfo.start();
    if (g.gain.setTargetAtTime) g.gain.setTargetAtTime(0.025, ac.currentTime, 1.2);
    else g.gain.value = 0.025;
    ambNodes = { src, hum, lfo, g };
  }
  // (the synth's stop is handled at the top, so it also fires on hand-over)
}
// the ribbon-ride drone: a rolling tone that climbs as the ribbon is ridden
// head to tail — resolve with sfx.traced() on completion
let stripOsc = null;
function stripSound(on, prog) {
  const ac = AC; if (!ac || !sfxGain) return;
  if (simMuted && on) return; // don't start/sustain the drone during the muted pre-run
  if (on && !stripOsc) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = 'triangle'; o.frequency.value = 220; g.gain.value = 0;
    const lfo = ac.createOscillator(), lg = ac.createGain(); // the "rolling"
    lfo.type = 'sine'; lfo.frequency.value = 7; lg.gain.value = 9;
    lfo.connect(lg);
    if (o.frequency.setTargetAtTime) lg.connect(o.frequency);
    o.connect(g); g.connect(sfxGain); o.start(); lfo.start();
    stripOsc = { o, g, lfo };
  }
  if (!on && stripOsc) {
    const so = stripOsc; stripOsc = null;
    so.g.gain.setTargetAtTime ? so.g.gain.setTargetAtTime(0.0001, ac.currentTime, 0.04) : (so.g.gain.value = 0);
    setTimeout(() => { try { so.o.stop(); so.lfo.stop(); } catch (e) {} }, 250);
    return;
  }
  if (on && stripOsc) {
    const f = 220 * Math.pow(4, clamp(prog || 0, 0, 1)); // 220Hz filling up to 880Hz
    if (stripOsc.o.frequency.setTargetAtTime) {
      stripOsc.o.frequency.setTargetAtTime(f, ac.currentTime, 0.035);
      stripOsc.g.gain.setTargetAtTime(0.075, ac.currentTime, 0.06);
    } else { stripOsc.o.frequency.value = f; stripOsc.g.gain.value = 0.075; }
  }
}
// ---------- THE SWEEPING RAY (H-33) ----------
//
// A SUSTAINED VOICE, NOT A ONE-SHOT, and that is the whole reason this is synth
// rather than a take. The light's speed is set per boss and per round (`bm.spd`),
// it can REVERSE mid-rotation (`bm.dir *= -1`), and a rotation lasts however long
// a full TAU takes at that speed. No fixed recording can follow any of that — it
// would drift away from the light on screen within a second. An oscillator reading
// `bm.a`, `bm.spd` and `bm.dir` every frame cannot drift, because the motion IS
// the sound.
//
// TWO LAYERS, BLENDED (Gil's call, 2026-08-26):
//
//   A — THE SABER. Two sawtooths a few cents apart into a low, resonant lowpass.
//       The beating between the detuned pair is the characteristic waver; the
//       filter is what turns a buzz into a "voom". Carries the MOTION.
//   B — THE TRIPOD. Looped noise through a high-Q bandpass with a peaking formant
//       above it — the metallic resonant howl. Carries the MENACE.
//
// The two are separate gains on purpose (RAY_SABER / RAY_TRIPOD) so the blend is
// one number to retune on the soundboard, not a rebuild.
//
// THE DOPPLER IS THE POINT. The light crosses the screen laterally, so its lateral
// velocity is `-sin(a) * dir * spd` — the pitch rides that, and the pan rides
// `cos(a)`. Together they put the ray in the stereo field and bend it as it comes
// round. When the sweep reverses, the bend reverses with it, so the telegraphed
// turn becomes something you HEAR rather than a 0.2s blip.
//
// DRAW-ONLY. This reads boss state and never writes any; it consumes no
// `spawnRng()` and no `Math.random()` beyond the one cached noise buffer that
// `crackle` already builds. See docs/IN-RUN-VOICE.md rule 1.
let rayVoices = {};
const RAY_SPD_LO = 0.95, RAY_SPD_HI = 1.70; // rad/s — the span startSweeps covers
const RAY_LEVEL  = 0.052;  // the bed's ceiling: audible under combat, never over it
const RAY_BED_FADE = 0.30; // the bed's crossfade in, ending on the charge's release
const RAY_SABER  = 0.60, RAY_TRIPOD = 0.34; // the blend
function rayVoiceNew(ac) {
  if (!ac.createBuffer || !ac.createBiquadFilter) return null; // no filters, no ray — silence, not a throw
  if (!noiseBuf) {
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 0.5, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  // A — the saber
  const oa = ac.createOscillator(), ob = ac.createOscillator();
  oa.type = 'sawtooth'; ob.type = 'sawtooth';
  if (oa.detune) { oa.detune.value = -7; ob.detune.value = 9; } // the waver, in cents
  const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700; lp.Q.value = 7;
  const ga = ac.createGain(); ga.gain.value = RAY_SABER;
  oa.connect(lp); ob.connect(lp); lp.connect(ga);
  // B — the tripod
  const src = ac.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
  const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 500; bp.Q.value = 13;
  const pk = ac.createBiquadFilter(); pk.type = 'peaking'; pk.frequency.value = 1450; pk.Q.value = 6;
  if (pk.gain) pk.gain.value = 9;
  const gb = ac.createGain(); gb.gain.value = RAY_TRIPOD;
  src.connect(bp); bp.connect(pk); pk.connect(gb);
  // the shared envelope + placement
  const g = ac.createGain(); g.gain.value = 0.0001;
  ga.connect(g); gb.connect(g);
  let pan = null;
  // THE RAY ENTERS THROUGH THE ACCENT BUS, like every other synth voice.
  // It did not, and that is the whole reason the ray "didn't apply" in a real
  // fight (Gil, 2026-08-27). ACCENT_LIFT exists because a synth voice enters at
  // 0.05-0.13 while a recorded take enters at 0.27-1.0, which measured 10-15 dB
  // apart through the real bus — the exact "sometimes no sound on x10" problem.
  // `tone` was routed through the lift; `swell`, `swellNoise` and this voice were
  // written later, for the ray, and went straight to sfxGain. So the ray sat ~10 dB
  // under every other accent and ~20 dB under the takes it plays beside, and the
  // charge was 10 dB under its OWN release thud, which is a `tone`. It sounded
  // right in the soundboard because a cue auditioned alone has nothing to hide
  // behind. In the duel, with takes and music over it, it was buried.
  const rayDest = accentGain || sfxGain;
  if (ac.createStereoPanner) { pan = ac.createStereoPanner(); g.connect(pan); pan.connect(rayDest); }
  else g.connect(rayDest);
  oa.start(); ob.start(); src.start();
  return { oa, ob, lp, bp, ga, gb, g, pan, src };
}
function rayVoiceStop(v, fast) {
  const ac = AC; if (!ac) return;
  const tc = fast ? 0.03 : 0.09;  // the retraction: the spent light fades INTO the machine
  if (v.g.gain.setTargetAtTime) v.g.gain.setTargetAtTime(0.0001, ac.currentTime, tc);
  else v.g.gain.value = 0;
  setTimeout(() => { try { v.oa.stop(); v.ob.stop(); v.src.stop(); } catch (e) {} }, fast ? 200 : 500);
}
// Called every frame with the LIVE beams. One voice per node index, so the prism's
// two lights speak at their own two speeds — which is that boss's entire tell, and
// a single summed voice would flatten it back into one sound.
function raySweep(list) {
  const ac = AC; if (!ac || !sfxGain) return;
  const live = (simMuted || !list) ? [] : list;
  const held = {};
  // NO PER-COUNT DUCKING HERE. An earlier pass this day divided each voice by
  // sqrt(n) on the theory that the prism's two rays summed past the limiter. That
  // was an inference, never measured, and it was wrong twice over: the real fault
  // was the missing accent bus below, and dividing made the quiet ray quieter. Two
  // lights are meant to be louder than one — that is the prism's whole picture.
  for (const bm of live) {
    if (bm.done) continue;
    held[bm.phase] = 1;
    let v = rayVoices[bm.phase];
    if (!v) { v = rayVoiceNew(ac); if (!v) continue; rayVoices[bm.phase] = v; }
    // how fast this light is running, 0..1 across the range the fights use
    const k = clamp((bm.spd - RAY_SPD_LO) / (RAY_SPD_HI - RAY_SPD_LO), 0, 1);
    // the lateral doppler — direction flips it, which is what makes a reversal audible
    const dop = 1 - 0.055 * Math.sin(bm.a) * bm.dir;
    const f = (64 + 32 * k) * dop;
    const t = ac.currentTime, TC = 0.03; // a per-frame glide, so nothing zippers
    const set = (prm, val) => { prm.setTargetAtTime ? prm.setTargetAtTime(val, t, TC) : (prm.value = val); };
    set(v.oa.frequency, f);
    set(v.ob.frequency, f * 1.005);          // the pair stays detuned at any pitch
    set(v.lp.frequency, 480 + 900 * k);      // faster light, brighter voom
    set(v.bp.frequency, (430 + 300 * k) * dop);
    if (v.pan) set(v.pan.pan, clamp(Math.cos(bm.a) * 0.7, -1, 1));
    // THE BIRTH SWELL: the bed arrives ON THE CHARGE'S RELEASE, not 0.22s after
    // birth. It used to fade in over a fixed 0.22s, which was right while the
    // wind-up was a 0.44s synth under a 0.30s burst. ray-charge.mp3 builds for a
    // full second now, and a bed at full level for the charge's last 0.8s would
    // give the release away long before it happened. It rides the last
    // RAY_BED_FADE of the burst window instead, so the two crossfade exactly where
    // the picture starts to turn. A short BEAM_BURST degrades to the old shape.
    const born = clamp(((bm.liveT || 0) - (BEAM_BURST - RAY_BED_FADE)) / RAY_BED_FADE, 0, 1);
    set(v.g.gain, Math.max(0.0001, RAY_LEVEL * (0.55 + 0.45 * k) * born));
  }
  for (const key of Object.keys(rayVoices)) {
    if (held[key]) continue;
    const v = rayVoices[key]; delete rayVoices[key];
    rayVoiceStop(v, simMuted);
  }
}
// hard stop — the fight ended, the boss died, or the run left the lane
function raySweepKill() {
  for (const key of Object.keys(rayVoices)) { const v = rayVoices[key]; delete rayVoices[key]; rayVoiceStop(v, true); }
}
// ---------- THE SONAR · a background indicator ----------
//
// A whisper-quiet approach blip per hostile, panned to its angle and tightening as
// it closes. Cut once (Gil, 2026-08-27: "always beeping"), then brought back at a
// much lower level on his call — "just a background indicator".
//
// THE RATE CAP IS WHY IT CAN COME BACK. Volume alone would not have fixed it: the
// complaint was a LATE STAGE, where a dozen live hostiles each run their own blip
// train and the sum is a continuous tone at any level. `updateEnemy` still schedules
// per hostile, because that is what makes an individual threat tighten as it closes
// — but no two pings may sound within SONAR_GAP of each other, across the whole
// lane. One hostile or twelve, the cue can never exceed ~4 pings a second.
//
// The take is 0.20s and the gap is 0.26s, so a ping always ENDS before the next may
// start. The silence between them is the whole design: a drone is what overlapping
// pings make, and there is no overlap now.
//
// THE CLOCK IS THE AUDIO CLOCK, never the sim clock. This gate lives entirely on
// the audio side, so it reads no sim state, writes none, and cannot move a board id.
const SONAR_MID = 1250;  // the freq that plays sonar-ping.mp3 at its own pitch
const SONAR_GAP = 0.26;  // seconds — the floor between any two pings, lane-wide
let sonarLast = -1;      // AC.currentTime of the last ping that actually sounded
function sonarTick(freq, pan) {
  const ac = AC; if (!ac || !sfxGain || state !== S.PLAY || simMuted) return; // muted stat pre-run schedules these at a frozen clock → a squawk; skip them
  const t = ac.currentTime;
  if (t - sonarLast < SONAR_GAP) return; // the lane-wide floor: density cannot stack
  sonarLast = t;
  // THE PITCH IS THE URGENCY. The caller ramps `freq` from 1150 Hz to 1500 Hz as a
  // hostile closes; the take reads that ramp as a playback rate around SONAR_MID, so
  // a closing threat still tightens even though the rate cap holds the tempo down.
  if (playSample('sonar', 1, pan, clamp(freq / SONAR_MID, 0.85, 1.25))) return;
  // the fallback sine, at the same whisper the take ships at
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = 'sine'; o.frequency.value = freq;
  g.gain.setValueAtTime(0.014, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
  let tail = g;
  if (ac.createStereoPanner) {
    const p = ac.createStereoPanner(); p.pan.value = clamp(pan, -1, 1);
    g.connect(p); tail = p;
  }
  o.connect(g); tail.connect(sfxGain); o.start(); o.stop(t + 0.05);
}
