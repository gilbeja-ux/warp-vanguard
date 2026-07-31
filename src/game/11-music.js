'use strict';
// ---------- soundtrack (MUSIC_DATA is injected in a script at the end of this file) ----------
// menu: Midnight Terminal Wait · runs: a shuffled draw from src/audio/music/
// Web Audio looper: each track is decoded to a buffer and looped sample-accurately
// (native <audio loop> always has an audible seam on mp3). Encoder padding is
// trimmed via loopStart/loopEnd. One decoded track is held in memory at a time —
// except across a free-flow crossfade, which briefly holds two.
let musicGain = null, musicSrc = null, musicSrcGain = null, musicFilter = null;
let musicLift = 1; // max-combo streaks brighten the mix a touch
let musicStartAt = 0, beatPeriod = 0, musicCut = 16000, musicLoopDur = 0;
let currentTrackKey = null, musicLoadKey = null;
// The menu piece is the one track the player returns to over and over, and it is
// the smallest in the folder — so its decoded buffer is kept for the session.
// That is what makes leaving a run switch to menu music INSTANTLY instead of
// after a fetch and a decode.
let menuBuf = null;
let musicRetryIn = 0;    // backoff before re-asking for a track whose load died
let musicHoldFor = 0;    // seconds of quiet still owed to the deploy fade-out before the run's track may come in
let warmKey = null, warmBuf = null; // the run's take, decoding (or decoded) under the deploy silence
let runMusicOn = false;  // does the RUN own the bus? false from deploy until the start sequence, and again once it ends
let holdVol = 1;         // eased 1→0 while the pause card holds the track
let musicFade = 1; // 0→1 whenever a track starts from silence
let musicRate = 1; // eased playback rate — slow-mo drags the track down with it
let replayMusicVol = 1; // eased music multiplier: 0 while a replay is paused / scrubbing / exiting
const musicVolume = () => settings.music ? settings.musicVol : 0;
const MUSIC_FADEIN = 2.2; // seconds to fade a track in
const MUSIC_FADEOUT = 1.0; // seconds the outgoing track takes to bow out on a switch
const MUSIC_XFADE = 4.0;  // seconds two takes overlap when free flow chains the next track
const MUSIC_LEAD = 14;    // seconds before the seam the next track starts fetching + decoding
// a manifest entry is normally a bare url; { file, name } overrides the title
function trackEntry(k) {
  const md = window.MUSIC_DATA;
  const e = k === 'menu' ? md.menu : md.levels[k];
  return typeof e === 'string' ? { file: e } : (e || { file: '' });
}
const trackUrl = k => encodeURI(trackEntry(k).file); // the folder's filenames carry spaces
// THE FILENAME IS THE TITLE. src/audio/music/ is the single source of truth:
// drop a track in, `npm run build` lists it, and its name comes straight off the
// file — so renaming the mp3 renames the track, with nothing else to keep in sync.
const NAME_CACHE = {};
function prettyTrackName(file) {
  if (NAME_CACHE[file] !== undefined) return NAME_CACHE[file];
  const base = decodeURIComponent(String(file)).split('/').pop().replace(/\.[a-z0-9]+$/i, '');
  return (NAME_CACHE[file] = base.replace(/[_\-]+/g, ' ').replace(/\s+/g, ' ').trim().toUpperCase());
}
function trackName(k) {
  const e = trackEntry(k);
  return e.name || (e.file ? prettyTrackName(e.file) : '');
}
const trackCount = () => (window.MUSIC_DATA && window.MUSIC_DATA.levels.length) || 1;
// shuffled bag: every track in the folder plays once before any of them repeats,
// and a refill never hands back the track that is already on air. Draws from
// sysRandom, NOT Math.random — campaign/daily reseed Math.random for the sim, and
// spending from that stream would desync replay verification.
let trackBag = [];
function pickTrack() {
  const n = trackCount();
  if (!trackBag.length) {
    trackBag = Array.from({ length: n }, (_, i) => i);
    for (let i = n - 1; i > 0; i--) { const j = (sysRandom() * (i + 1)) | 0; const t = trackBag[i]; trackBag[i] = trackBag[j]; trackBag[j] = t; }
    if (n > 1 && trackBag[0] === currentTrackKey) trackBag.push(trackBag.shift()); // no repeat across the seam
  }
  return trackBag.shift();
}
// ---- free-flow crossfade: two takes alive at once, one rising under the other ----
// The master musicGain owns volume/duck/lift, so the overlap rides on per-take
// gains driven per frame (same model as musicFade — no AudioParam ramps, which
// keeps the headless harness's stub gains honest).
let xfSrc = null, xfGain = null, xfT = 1;      // the outgoing take, and its 0→1 progress
let nextTrack = null, nextLoadKey = null, preloadRetryIn = 0; // the decoded take standing by (+ backoff after a failed preload)
function endCrossfade() {
  if (xfSrc) { try { xfSrc.stop(); } catch (e) {} try { xfSrc.disconnect(); } catch (e) {} }
  if (xfGain) { try { xfGain.disconnect(); } catch (e) {} }
  xfSrc = null; xfGain = null; xfT = 1;
  if (musicSrcGain) musicSrcGain.gain.value = 1; // whoever is on air owns the bus again
}
function dropPreload() { nextTrack = null; nextLoadKey = null; }
// decode the next track WELL before the seam — a crossfade with nothing to fade
// into is just a gap, which is the thing this whole path exists to avoid
function preloadTrack(key) {
  if (!AC || !window.MUSIC_DATA) return;
  nextLoadKey = key; nextTrack = null;
  fetch(trackUrl(key))
    .then(r => r.arrayBuffer())
    .then(a => AC.decodeAudioData(a))
    .then(buf => { if (nextLoadKey === key) { nextTrack = { key, buf }; nextLoadKey = null; } })
    .catch(() => { if (nextLoadKey === key) { nextLoadKey = null; preloadRetryIn = 3; } });
}
function crossfadeTo(key, buf) {
  if (!AC || !musicFilter) return;
  endCrossfade();                    // a second seam before the first settled — the older take goes now
  xfSrc = musicSrc; xfGain = musicSrcGain;
  const lp = loopPoints(buf);
  const src = AC.createBufferSource();
  src.buffer = buf; src.loop = true; src.loopStart = lp.start; src.loopEnd = lp.end;
  src.playbackRate.value = musicRate;
  const g = AC.createGain();
  g.gain.value = xfSrc ? 0 : 1;      // nothing to fade from → straight to full
  src.connect(g); g.connect(musicFilter);
  src.start(0, lp.start);
  musicSrc = src; musicSrcGain = g;
  musicLoopDur = lp.end - lp.start;
  musicStartAt = AC.currentTime;
  currentTrackKey = key; musicLoadKey = null;
  xfT = xfSrc ? 0 : 1;
  beatPeriod = detectBeat(buf);      // the new take brings its own tempo grid
  nowPlaying(key);                   // the seam is the one moment the music changes unasked
}
// ---- NOW PLAYING: the track names itself, briefly, and gets out of the way ----
// Two moments only: a run opening, and a free-flow crossfade. Read-only — the run
// is live and a stray tap costs integrity, so skipping lives in PAUSE instead.
let npT = 99, npName = '';
const NP_DUR = 4.4; // seconds on screen, both fades included
function nowPlaying(key) {
  if (key === 'menu' || replaying) return;
  const n = trackName(key);
  if (n) { npName = n; npT = 0; }
}
function stopMusicSrc(fade) {
  const src = musicSrc, g = musicSrcGain;
  musicSrc = null; musicSrcGain = null;
  endCrossfade(); dropPreload();     // a hard switch cancels any overlap in flight
  if (!src) return;
  if (fade && AC && g && g.gain.setTargetAtTime) {
    // hand the outgoing source its own exit ramp — the shared musicGain is
    // about to drop to silence for the incoming track's fade-in
    try {
      g.disconnect();
      g.gain.value = musicGain ? musicGain.gain.value : 0; // carry the audible level across the reroute
      g.connect(AC.destination);
      g.gain.setTargetAtTime(0.0001, AC.currentTime, fade / 4);
      src.stop(AC.currentTime + fade);
      setTimeout(() => { try { src.disconnect(); g.disconnect(); } catch (e) {} }, fade * 1000 + 250);
      return;
    } catch (e) {}
  }
  try { src.stop(); } catch (e) {}
  try { src.disconnect(); } catch (e) {}
}
// scrub preview: jump the currently-loaded take to run-time `t` (seconds) by
// restarting its buffer at the matching loop offset. Reuses the decoded buffer —
// no fetch — so it's cheap enough to fire as the thumb drags. musicFade is left
// alone (no re-fade-in); the quiet scrub level rides on replayMusicVol.
let musicScrubT = -1; // last run-time the music was sought to during a scrub
function seekMusicTo(t) {
  if (!AC || !musicFilter || !musicSrc || !musicSrc.buffer) return;
  const buf = musicSrc.buffer;
  const ls = musicSrc.loopStart || 0, le = musicSrc.loopEnd || buf.duration;
  const dur = (le - ls) > 0.01 ? le - ls : buf.duration;
  const off = ls + (Math.max(0, t) % dur);   // the run started the take at loopStart, so run-time maps straight in
  stopMusicSrc(false);                        // drop the old take (hard cut — we're scrubbing)
  const src = AC.createBufferSource();
  src.buffer = buf; src.loop = true; src.loopStart = ls; src.loopEnd = le;
  src.playbackRate.value = musicRate;
  const g = AC.createGain();
  src.connect(g); g.connect(musicFilter);
  src.start(0, off);
  musicSrc = src; musicSrcGain = g;
  musicStartAt = AC.currentTime - (off - ls);  // keep loop/seam timing roughly aligned
}
// estimate the track's beat period (sec) — energy-flux autocorrelation over 60–180 BPM
function detectBeat(buf) {
  try {
    const sr = buf.sampleRate, d = buf.getChannelData(0);
    const hop = Math.floor(sr * 0.02); // 20ms energy windows over the first minute
    const N = Math.min(d.length, sr * 60);
    const env = [];
    for (let i = 0; i + hop < N; i += hop) {
      let e = 0;
      for (let j = i; j < i + hop; j += 4) e += d[j] * d[j];
      env.push(e);
    }
    const flux = env.map((e, i) => Math.max(0, e - (env[i - 1] || 0)));
    const corr = [];
    let best = 0;
    for (let lag = 16; lag <= 50; lag++) { // 0.32s–1.0s per beat
      let c = 0;
      for (let i = 0; i + lag < flux.length; i++) c += flux[i] * flux[i + lag];
      corr.push([lag, c]);
      if (c > best) best = c;
    }
    // smallest lag near the peak — a periodic signal correlates at every multiple
    for (const [lag, c] of corr) if (c >= best * 0.85) return lag * 0.02;
    return 0;
  } catch (e) { return 0; }
}
// snap a spawn delay so the trap ARRIVES at the ring on a beat
function beatQuantize(delay, travel) {
  if (!beatPeriod || !AC || !musicSrc) return delay;
  const pos = AC.currentTime - musicStartAt;
  const arrive = pos + delay + (travel || 0);
  const snapped = Math.round(arrive / beatPeriod) * beatPeriod;
  return Math.max(snapped - (travel || 0) - pos, Math.max(0.25, delay * 0.5));
}
// find where the real signal starts/ends so the loop skips encoder padding
function loopPoints(buf, thr0) {
  const d = buf.getChannelData(0), thr = thr0 || 0.001;
  let s = 0, e = d.length - 1;
  while (s < e && Math.abs(d[s]) < thr) s++;
  while (e > s && Math.abs(d[e]) < thr) e--;
  return { start: s / buf.sampleRate, end: (e + 1) / buf.sampleRate };
}
// hand the bus to a buffer that is ALREADY decoded: the outgoing take gets its
// 1s exit ramp and the incoming one rises under it. The only way a take ever
// reaches the speakers — whether its buffer came from a fetch, from the menu
// cache, or from the run's warm-up.
function startTake(key, buf) {
  stopMusicSrc(MUSIC_FADEOUT); // NOW: the old take fades out under the new one's fade-in
  const lp = loopPoints(buf);
  musicSrc = AC.createBufferSource();
  musicSrc.buffer = buf;
  musicSrc.loop = true;
  musicSrc.loopStart = lp.start; musicSrc.loopEnd = lp.end;
  musicLoopDur = lp.end - lp.start;
  musicSrc.playbackRate.value = musicRate;
  musicSrcGain = AC.createGain(); // per-take handle so a switch can fade THIS take out
  musicSrc.connect(musicSrcGain); musicSrcGain.connect(musicFilter);
  musicFade = 0; musicGain.gain.value = 0; // rise from silence
  musicSrc.start(0, lp.start);
  musicStartAt = AC.currentTime;
  beatPeriod = detectBeat(buf); // tempo grid for spawn choreography
  // announced HERE, not when the fetch went out: the strip names a track that
  // is genuinely playing, so a dead server or a missing file stays silent
  // instead of captioning silence.
  nowPlaying(key);
}
function playTrack(key) {
  if (!window.MUSIC_DATA) return;
  initAC(); if (!AC) return;
  if (!musicGain) {
    musicGain = AC.createGain(); musicGain.gain.value = 0; musicGain.connect(AC.destination);
    musicFilter = AC.createBiquadFilter(); // "system critical" muffle at low integrity
    musicFilter.type = 'lowpass'; musicFilter.frequency.value = 16000;
    musicFilter.connect(musicGain);
  }
  if (key === currentTrackKey && (musicSrc || musicLoadKey === key)) return;
  currentTrackKey = key; musicLoadKey = key;
  // already decoded? Then there is nothing to wait for — the menu take is cached
  // for the session, and the run's take was warmed under the deploy silence.
  const held = key === 'menu' ? menuBuf : key === warmKey ? warmBuf : null;
  if (held) { warmKey = null; warmBuf = null; musicLoadKey = null; startTake(key, held); return; }
  // that warm load is still in flight — it is THIS load. Wait for it rather than
  // opening a second fetch for the same file (musicLoadKey stays set, so the
  // contract sees a load in progress and the warm callback does the handover).
  if (key === warmKey) return;
  // NOTHING is stopped yet. Fetching and decoding a track costs a few hundred ms
  // on a laptop and MANY SECONDS on a phone, so a take dropped here would leave
  // the whole load window in dead air — a restarted level opening on silence.
  // The outgoing take plays until the incoming one is ready to start, and the
  // handover happens in the callback below, where the crossfade actually is.
  fetch(trackUrl(key))
    .then(r => r.arrayBuffer())
    .then(a => AC.decodeAudioData(a))
    .then(buf => {
      if (key === 'menu') menuBuf = buf; // worth keeping whatever happens next: the menu is returned to constantly
      if (currentTrackKey !== key) return; // a newer switch won the race — and the quiet it wants is deliberate
      musicLoadKey = null;
      startTake(key, buf);
    })
    .catch(() => { if (musicLoadKey === key) musicLoadKey = null; });
}
// DEPLOY: the menu piece fades out to silence and the run's drawn track starts
// decoding under that silence, so it is ready to come in on the start sequence
// instead of arriving late. Nothing plays until then — leaving the menu should
// sound like leaving the menu, not like a crossfade.
function armRunMusic() {
  runMusicOn = false;
  stopMusicSrc(MUSIC_FADEOUT);
  currentTrackKey = null; musicLoadKey = null;
  musicHoldFor = MUSIC_FADEOUT;
  initAC();          // deploy is a tap — the best moment there is to have a context
  warmTrack(runTrack); // decode under the silence, so the take lands ON the start sequence
}
// the run is over: its track fades out and the end screen is quiet
function endRunMusic() {
  runMusicOn = false;
  stopMusicSrc(MUSIC_FADEOUT);
  currentTrackKey = null; musicLoadKey = null;
  warmKey = null; warmBuf = null; // let the run's buffer go
}
// Warm the run's take while the deploy fade-out plays. Its own slot, NOT the
// free-flow standby slot: that one belongs to the seam, and sharing it let the
// seam swallow a take meant for the top of the run.
// If the run asks for this track before the decode lands, playTrack leaves the
// load flagged and this callback performs the handover the moment it can.
function warmTrack(key) {
  warmKey = key; warmBuf = null;
  if (!AC || !window.MUSIC_DATA) return;
  fetch(trackUrl(key))
    .then(r => r.arrayBuffer())
    .then(a => AC.decodeAudioData(a))
    .then(buf => {
      if (warmKey !== key) return; // the run moved on
      warmBuf = buf;
      if (currentTrackKey === key && musicLoadKey === key && !musicHoldFor) {
        warmKey = null; warmBuf = null; musicLoadKey = null;
        startTake(key, buf);
      }
    })
    .catch(() => { if (warmKey === key) { warmKey = null; if (musicLoadKey === key) musicLoadKey = null; } }); // the contract's retry picks it up
}
// runs every frame: drives the fade-in, volume, and the slow-mo tape-warp
function updateMusic(dt) {
  musicFade = Math.min(1, musicFade + (dt || 0) / MUSIC_FADEIN);
  // ---- THE SOUNDTRACK CONTRACT ----
  // Who owns the bus is decided HERE, from game state, every frame — never from
  // whatever screen a tap happened to land on:
  //   menus            → the menu piece, crossfading into itself to loop
  //   deploy → intro   → silence, while the menu piece bows out
  //   the run          → its own random track, in with the start sequence
  //   pause            → held, and picks up where it left off on resume
  //   level over       → silence
  // Stating it as a target instead of a pile of switch calls is also what makes
  // it self-healing: a dead fetch, a lost decode race or a 404 leaves the bus
  // empty for one backoff and then gets asked for again, so a run is never
  // silently music-less.
  musicHoldFor = Math.max(0, musicHoldFor - (dt || 0));
  musicRetryIn = Math.max(0, musicRetryIn - (dt || 0));
  preloadRetryIn = Math.max(0, preloadRetryIn - (dt || 0));
  if (!SPLASH.on) {
    if (menuScreenNow()) runMusicOn = false; // back on a menu → whatever run owned the bus is done
    const wantKey = menuScreenNow() ? 'menu' : runMusicOn ? runTrack : null;
    if (wantKey !== null) initAC();          // get the graph up early; a gesture only has to un-suspend it
    if (wantKey === null) {
      if (musicSrc || musicLoadKey !== null) { stopMusicSrc(MUSIC_FADEOUT); currentTrackKey = null; musicLoadKey = null; }
    } else if (AC && !musicHoldFor &&        // the deploy fade-out gets its full second of quiet
               (currentTrackKey !== wantKey ||
                (!musicSrc && musicLoadKey === null && !musicRetryIn))) {
      musicRetryIn = 2.5;
      playTrack(wantKey);
    }
  }
  // the start sequence IS the cue: the moment the run is live, its track comes in
  if (state === S.PLAY && !runMusicOn) runMusicOn = true;
  // FREE FLOW outruns its track: draw the next one from the bag, decode it ahead
  // of the seam, and cross it in under the outgoing take so the music never gaps.
  if (endless && state === S.PLAY && !replaying && musicSrc && musicLoopDur > 0 && AC &&
      typeof runTrack === 'number' && currentTrackKey !== 'menu') {
    const left = musicLoopDur - (AC.currentTime - musicStartAt);
    if (left < MUSIC_LEAD && !nextTrack && nextLoadKey === null && !preloadRetryIn) preloadTrack(pickTrack());
    if (left < MUSIC_XFADE && nextTrack) {  // late (a slow decode) just means a later seam, never silence
      const nt = nextTrack; nextTrack = null;
      runTrack = nt.key;
      crossfadeTo(nt.key, nt.buf);
    }
  }
  if (xfSrc && xfGain) { // equal-power overlap — the sum stays level through the seam
    xfT = Math.min(1, xfT + (dt || 0) / MUSIC_XFADE);
    const e = xfT * xfT * (3 - 2 * xfT);
    xfGain.gain.value = Math.cos(e * Math.PI / 2);
    if (musicSrcGain) musicSrcGain.gain.value = Math.sin(e * Math.PI / 2);
    if (xfT >= 1) endCrossfade();
  }
  // the menu piece is a composition with an ending, not a loop — so it loops by
  // crossfading INTO ITSELF, the same overlap free flow uses at a seam. Its
  // buffer is already in hand (menuBuf), so the seam costs nothing.
  if (currentTrackKey === 'menu' && menuBuf && musicSrc && !xfSrc && AC &&
      musicLoopDur > MUSIC_XFADE && musicLoopDur - (AC.currentTime - musicStartAt) < MUSIC_XFADE) {
    crossfadeTo('menu', menuBuf);
  }
  // the tape-warp moment this ease was kept for: the tutorial's TAP-TO-FIRE
  // hold drags the track down to a stop, releasing it spools back up
  // replay transport drives the tempo: pausing / holding-at-end / exiting freezes
  // the track (near-zero rate holds its position); otherwise the playback-speed
  // dial drags the track's rate — and pitch — along with it. Scrubbing keeps it
  // rolling at normal rate but quiet, and re-seeks it to follow the thumb.
  const replayFrozen = replaying && (replayPaused || replayEnded); // pause, hold-at-end, exit (back sets paused)
  const replayScrubbing = replaying && replayScrub && !replayPaused;
  // THE PAUSE HOLD: the pause card freezes the track where it stands (near-zero
  // rate holds the playhead) and eases it to silence; resuming spools it back up
  // from that same moment, so a pause never costs the run its place in the music.
  const held = state === S.PAUSE && !replaying;
  const rateTarget = replaying ? (replayFrozen ? 0.0001 : replaySpeed) : (held || (tut && tut.frozen) ? 0.0001 : 1);
  musicRate += (rateTarget - musicRate) * Math.min(1, (dt || 0) * (rateTarget < 0.5 ? 2.5 : 5));
  if (musicSrc && musicSrc.playbackRate) musicSrc.playbackRate.value = musicRate;
  // a frozen playhead doesn't move, so the clock the seam logic measures against
  // has to stand still with it — otherwise a long pause "spends" the track
  holdVol += ((held ? 0 : 1) - holdVol) * Math.min(1, (dt || 0) * 6);
  if (held) musicStartAt += (dt || 0);
  // frozen → fade to silence; scrubbing → duck to a quiet preview; else full
  const musicVolTgt = replayFrozen ? 0 : replayScrubbing ? 0.34 : 1;
  replayMusicVol += (musicVolTgt - replayMusicVol) * Math.min(1, (dt || 0) * 3);
  if (musicFilter) { // the payload's health bleeds into the mix
    const open = 16000;
    const target = state === S.PLAY ? 700 * Math.pow(open / 700, clamp(integrity, 0, 100) / 100) : open;
    musicCut += (target - musicCut) * Math.min(1, (dt || 0) * 3);
    musicFilter.frequency.value = musicCut;
  }
  if (!musicGain) return;
  musicDuck = Math.max(0, musicDuck - (dt || 0) / 1.2);
  const f = musicFade * musicFade * (3 - 2 * musicFade); // smoothstep
  const liftTarget = state === S.PLAY && combo >= 8 ? 1.07 : 1; // hot streaks lift the mix
  musicLift += (liftTarget - musicLift) * Math.min(1, (dt || 0) * 2);
  musicGain.gain.value = musicVolume() * f * (1 - 0.55 * musicDuck) * holdVol * musicLift * replayMusicVol;
}
// haptics: Capacitor Haptics on device, vibration API on the web, and
// dual-rumble on a connected controller (padDev is refreshed every poll)
let padDev = null;
function buzz(pattern) {
  if (!settings.haptics) return;
  const cap = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Haptics;
  try {
    if (cap) {
      if (Array.isArray(pattern)) cap.vibrate({ duration: pattern.reduce((a, b) => a + b, 0) });
      else cap.impact({ style: pattern >= 30 ? 'Heavy' : pattern >= 20 ? 'Medium' : 'Light' });
    } else if (navigator.vibrate) navigator.vibrate(pattern);
  } catch (e) {}
  try { // the controller rumbles in step: longer patterns hit harder
    const act = padDev && (padDev.vibrationActuator || (padDev.hapticActuators && padDev.hapticActuators[0]));
    if (act && act.playEffect) {
      const dur = Array.isArray(pattern) ? pattern.reduce((a, b) => a + b, 0) : pattern;
      const mag = clamp(dur / 90, 0.25, 1);
      act.playEffect('dual-rumble', { duration: clamp(dur * 1.6, 40, 400), strongMagnitude: mag, weakMagnitude: mag * 0.6 });
    }
  } catch (e) {}
}
// continuous ray-cannon drone — pitch rises with heat
let beamOscs = null;
function beamSound(on, heatVal) {
  if (!AC || !sfxGain) return;
  if (simMuted && on) return; // silent during the muted pre-run
  if (on && !beamOscs) {
    try {
      const o1 = AC.createOscillator(), g1 = AC.createGain();
      o1.type = 'sawtooth'; o1.frequency.value = 60; g1.gain.value = 0.045;
      o1.connect(g1); g1.connect(sfxGain); o1.start();
      const o2 = AC.createOscillator(), g2 = AC.createGain();
      o2.type = 'square'; o2.frequency.value = 240; g2.gain.value = 0.02;
      o2.connect(g2); g2.connect(sfxGain); o2.start();
      beamOscs = { o1, o2 };
    } catch (e) { beamOscs = null; }
  } else if (!on && beamOscs) {
    try { beamOscs.o1.stop(); beamOscs.o2.stop(); } catch (e) {}
    beamOscs = null;
  }
  if (beamOscs) {
    beamOscs.o1.frequency.value = 60 + heatVal * 55;
    beamOscs.o2.frequency.value = 240 + heatVal * 230 + Math.sin(time * 30) * 12;
  }
}