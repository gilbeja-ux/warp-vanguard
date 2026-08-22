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
function sfxBusGain() { return (settings.sound ? settings.soundVol : 0) * sfxFade; }
const settings = {
  sound: true, soundVol: 0.8, music: true, musicVol: 0.32, haptics: true // music sits low so sonar and cues read
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
  } catch (e) {}
}
function audio() {
  initAC();
  if (AC && AC.state === 'suspended') AC.resume().catch(() => {});
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
  o.connect(g); tail.connect(dest || sfxGain); o.start(t0); o.stop(t0 + dur);
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
// whisper-quiet approach blip, stereo-panned to the threat's angle
function sonarTick(freq, pan) {
  const ac = AC; if (!ac || !sfxGain || state !== S.PLAY || simMuted) return; // muted stat pre-run schedules these at a frozen clock → a squawk; skip them
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = 'sine'; o.frequency.value = freq;
  g.gain.setValueAtTime(0.045, ac.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.05);
  let tail = g;
  if (ac.createStereoPanner) {
    const p = ac.createStereoPanner(); p.pan.value = clamp(pan, -1, 1);
    g.connect(p); tail = p;
  }
  o.connect(g); tail.connect(sfxGain); o.start(); o.stop(ac.currentTime + 0.05);
}