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
// how long a menu take may be and still be held decoded for the session — see
// the cache site below. 120s ≈ 45 MB, which is a fair price for an instant
// return; past that the memory outweighs the convenience. The CURRENT take is
// 214.6s, so it is deliberately not cached: holding it would park ~79 MB for the
// whole session on exactly the phones least able to spare it.
//
// This ceiling governs the instant-return convenience and NOTHING ELSE. The
// seamless menu loop used to be gated on it by accident and therefore never ran;
// it now takes the buffer off the playing source instead (see updateMusic).
const MENU_CACHE_MAX = 120;
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
      // THE SESSION CACHE, WITH A CEILING. Holding the menu take decoded is
      // what makes leaving a run switch music instantly — but a decoded buffer
      // is raw float32 PCM, so the cost is duration, not file size: ~10 MB per
      // MINUTE per channel pair. A three-minute menu piece parks ~80 MB for the
      // whole session, on top of the run's own take. Short pieces still get the
      // instant return; a long one is re-decoded on the way back, which is off
      // the main thread and hidden under the menu transition anyway.
      if (key === 'menu' && buf.duration <= MENU_CACHE_MAX) menuBuf = buf;
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
  // crossfading INTO ITSELF, the same overlap free flow uses at a seam.
  //
  // TAKE THE BUFFER OFF THE SOURCE THAT IS ALREADY PLAYING IT. This used to read
  // `menuBuf &&`, which tied the seam to the session cache — and that cache has a
  // 120s ceiling while the menu take is 214.6s, so menuBuf was never assigned and
  // this whole branch was unreachable. The menu had been looping on the hard mp3
  // seam that the entire buffer architecture exists to avoid, since commit 262be2d
  // swapped a 116s piece for a 215s one and quietly crossed the ceiling.
  //
  // musicSrc.buffer IS the menu take, already decoded and in hand, so the seam
  // still costs nothing and — unlike raising the ceiling — parks not one extra byte.
  // The cache and the seam are separate concerns now: menuBuf only buys an INSTANT
  // return from a run, and its ceiling is a memory decision that belongs to that
  // question alone.
  const menuTake = menuBuf || (musicSrc && musicSrc.buffer);
  if (currentTrackKey === 'menu' && menuTake && musicSrc && !xfSrc && AC &&
      musicLoopDur > MUSIC_XFADE && musicLoopDur - (AC.currentTime - musicStartAt) < MUSIC_XFADE) {
    crossfadeTo('menu', menuTake);
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
// haptics: Capacitor Haptics on device, vibration API on the web, and the
// controller in step — see padRumble for the force-feedback design.
let padDev = null;
// FORCE FEEDBACK, DESIGNED RATHER THAN DERIVED. A pad has two voices the phone
// does not: a heavy motor that says IMPACT and a light one that says TICK —
// and on Xbox pads under Chromium, motors in the TRIGGERS themselves. fx
// (optional) is the design channel the important events pass:
//   strong / weak  explicit motor mix 0..1. Omitted, both derive from the
//                  mobile pattern's length as they always did — with one
//                  refinement: a pattern under 18ms is a UI tick, and a tick
//                  is the light motor only. The old floor made every tap in a
//                  menu thump like a landing.
//   side           0|1 — the emitter that acted. Where trigger rumble exists
//                  (act.effects lists it), the kick lands in THAT trigger:
//                  the hand that zapped feels it. Everywhere else the side
//                  folds back into plain dual-rumble, gracefully.
// Firefox exposes a different door to the same motor (hapticActuators.pulse)
// — the old code found the actuator and then required playEffect of it, so
// Firefox pads sat silent while looking supported.
let padHoldAt = 0; // the hold channel's refresh clock — see tickPadRumble
let padFxUntil = 0, padFxMag = 0; // the running effect's window — strongest wins
// ?hidswap: flips which byte drives which motor on the WebHID path — the A/B
// for a unit whose motors are wired opposite to the Linux driver's claim
const HID_SWAP = typeof location !== 'undefined' && /[?&]hidswap/.test(location.search);
// ?nohid — the WebHID path off entirely, so a mystery rumble can be ATTRIBUTED
// rather than argued about: if the pad still pulses with this on, nothing this
// game sends is reaching its motors and the hardware is talking to itself.
const HID_OFF = typeof location !== 'undefined' && /[?&]nohid/.test(location.search);
// ---------- WEBHID RUMBLE: motors the Gamepad API refuses to see ----------
// Chrome attaches vibrationActuator only to pads its own driver recognises;
// everything else — the RumblePad 2 on the desk — is a plain HID device with
// perfectly good motors behind an output report. WebHID reaches them. The
// grant is a one-time click on the ?padtest panel (a user gesture is
// mandatory); after that getDevices() re-adopts the pad silently every boot.
// Desktop-Chromium only by nature, which is exactly where the problem lives —
// phones rumble through Capacitor and never come this way.
const HID_RUMBLE = [
  // Per-device report formats, taken from the Linux hid-lg drivers — the one
  // place this hardware is still documented. make(strong, weak) → bytes.
  { vendorId: 0x046d, products: [0xc218, 0xc219], name: 'RumblePad 2',
    // hid-lg2ff.c: 7 bytes, 0x51 preamble, strong at [2], weak at [4].
    // SET-AND-HOLD — the motors run until zeroed, so every send arms a stop.
    // lo: where this motor actually starts responding. Design magnitudes are
    // written for hardware with a curve; this one has a cliff at ~30%, so the
    // whole 0..1 design range remaps onto lo..1 — a 0.3 crack lands at ~0.5,
    // which the mass can actually express, instead of under its own threshold.
    // Raised 0.30 → 0.52 off Gil's bench: at 0.30 the mid-weight events (a
    // clean zap designs at 0.30, landing on 130/255) were audible but barely
    // felt. This motor's useful range is the TOP HALF of its scale, so the
    // whole design range now remaps there — a light crack lands at ~176/255
    // and the heavy events still cap at full.
    lo: 0.52,
    make: (s, w) => hidFmtBytes(Math.round(s * 255), Math.round(w * 255)) }
];
// ?hidfmt=N — WALK THE CANDIDATE REPORTS. The layout above is the Linux
// driver's, and it is right for the units that driver was written against;
// this hardware shipped in revisions, and a report the pad does not recognise
// is silently ignored — which looks exactly like a dead motor. Rather than
// guess again, every plausible variant is numbered and reachable:
//   0  0x51 preamble, motors at [2] and [4]   (hid-lg2ff — the default)
//   1  0x51 with the 0x80 enable byte set
//   2  motors adjacent at [2][3]
//   3  8-byte frame, motors at [1][2]
//   4  0x42 preamble (older Logitech FF)
// Try them with ?padtest&hidfmt=1, then 2, 3, 4 — the SHIFT-click burst gives
// each one a full-blast shot. Whichever moves the pad is the answer, and it
// becomes the default with one number.
const HID_FMTS = [
  (s, w) => [0x51, 0x00, s, 0x00, w, 0x00, 0x00],
  (s, w) => [0x51, 0x80, s, 0x00, w, 0x00, 0x00],
  (s, w) => [0x51, 0x00, s, w, 0x00, 0x00, 0x00],
  (s, w) => [0x00, s, w, 0x00, 0x00, 0x00, 0x00, 0x00],
  (s, w) => [0x42, 0x00, s, 0x00, w, 0x00, 0x00]
];
let HID_FMT_I = 0;
if (typeof location !== 'undefined') {
  const qf = /[?&]hidfmt=(\d+)/.exec(location.search);
  if (qf) HID_FMT_I = clamp(parseInt(qf[1], 10) || 0, 0, HID_FMTS.length - 1);
}
const hidFmtBytes = (s, w) => HID_FMTS[HID_FMT_I](s, w);
let hidDev = null, hidFmt = null, hidRid = 0, hidOffTimer = 0, hidStopSeq = 0;
// A STOP THAT IS DROPPED LEAVES THE MOTOR RUNNING FOREVER. These motors are
// set-and-hold: the stop is not a courtesy, it is the second half of every
// effect — and it was one un-caught async sendReport, so a single USB hiccup
// (or a rejected write) meant a pad humming until the tab closed. The door is
// closed THREE times over ~650ms now, and a zero on an already-stopped motor
// costs nothing, so repeating is free. A new effect invalidates the chain by
// sequence, which is what keeps this from stuttering a live rumble.
function hidSendStop(times) {
  const seq = ++hidStopSeq;
  const fire = n => {
    if (seq !== hidStopSeq || !hidDev || !hidDev.opened || !hidFmt) return;
    try { hidDev.sendReport(hidRid, new Uint8Array(hidFmt.make(0, 0))).catch(() => {}); } catch (e) {}
    if (n > 1) setTimeout(() => fire(n - 1), 220);
  };
  fire(times || 3);
}
let hidMonN = 0, hidMonAt = -999; // every report that leaves for the pad — the
                                  // ?padtest monitor's ground truth. If the pad
                                  // pulses while this holds still, it is not us.
function hidRumbleAdopt(d, armTest) {
  const f = HID_RUMBLE.find(e => e.vendorId === d.vendorId && e.products.indexOf(d.productId) >= 0);
  if (!f) return false;
  // the output report id, off the device's own descriptor — 0 when unnumbered
  let rid = 0;
  try {
    for (const c of d.collections || []) {
      if (c.outputReports && c.outputReports.length) { rid = c.outputReports[0].reportId || 0; break; }
    }
  } catch (e) {}
  const done = () => { hidDev = d; hidFmt = f; hidRid = rid;
    if (typeof padTestNote === 'function') padTestNote('webhid: adopted ' + f.name);
    // only an EXPLICIT grant earns a test burst — the silent boot re-adoption
    // must stay silent, or every reload buzzes the menu unprompted
    if (armTest && typeof padTestBurst !== 'undefined') padTestBurst = 8; };
  // REMEMBER IT EITHER WAY. A device can be granted and still refuse to open —
  // most often because ANOTHER TAB of this game already holds it, since WebHID
  // hands a device to one page at a time. Holding the reference lets the rumble
  // path retry later instead of going permanently silent on the one reload that
  // happened to lose the race.
  hidKnown = d; hidKnownFmt = f; hidKnownRid = rid;
  if (d.opened) done();
  else d.open().then(done).catch(e => {
    if (typeof padTestNote === 'function') padTestNote('webhid open FAILED (another tab holding it?): ' + (e && e.message || e));
  });
  return true;
}
// ...and the retry itself, throttled: the moment the other tab lets go, the
// next effect reclaims the pad. Cheap enough to sit in the rumble path.
let hidKnown = null, hidKnownFmt = null, hidKnownRid = 0, hidReopenAt = -999;
function hidReopen() {
  if (!hidKnown || hidKnown.opened || time - hidReopenAt < 2) return;
  hidReopenAt = time;
  try {
    hidKnown.open().then(() => {
      hidDev = hidKnown; hidFmt = hidKnownFmt; hidRid = hidKnownRid;
      if (typeof padTestNote === 'function') padTestNote('webhid: reclaimed the pad');
    }).catch(() => {});
  } catch (e) {}
}
function hidRumbleInit() { // re-adopt anything granted in an earlier session
  try { navigator.hid.getDevices().then(list => { for (const d of list) hidRumbleAdopt(d); }); } catch (e) {}
}
if (typeof navigator !== 'undefined' && navigator.hid) setTimeout(hidRumbleInit, 0);
function hidRumbleRequest() { // MUST run inside a user gesture — the padtest panel click
  try {
    navigator.hid.requestDevice({ filters: HID_RUMBLE.map(f => ({ vendorId: f.vendorId })) })
      .then(list => {
        if (!list.length && typeof padTestNote === 'function') padTestNote('webhid: nothing granted');
        for (const d of list) hidRumbleAdopt(d, true); // granted by hand → prove the wire now
      })
      .catch(e => { if (typeof padTestNote === 'function') padTestNote('webhid request FAILED: ' + (e && e.message || e)); });
  } catch (e) {}
}
function hidRumble(strong, weak, ms) {
  if (HID_OFF) return false;
  if (!hidDev || !hidDev.opened || !hidFmt) { hidReopen(); return false; }
  // MOTOR FLOOR. A 2005 eccentric-mass motor has a threshold, not a curve:
  // under it the pad hums audibly without actually rumbling, and a stream of
  // sub-threshold sends blurs every designed event into one continuous drone.
  // Below the floor a motor gets ZERO, and an effect that is all floor is not
  // sent at all — silence is part of the design.
  if (strong < 0.12) strong = 0;
  if (weak < 0.12) weak = 0;
  if (!strong && !weak) return true; // handled: deliberately quiet
  if (HID_SWAP) { const t2 = strong; strong = weak; weak = t2; }
  const lo = hidFmt.lo || 0;         // ...and what survives the floor is lifted
  if (strong) strong = lo + strong * (1 - lo);   // onto the motor's live range
  if (weak) weak = lo + weak * (1 - lo);
  hidMonN++; hidMonAt = time;
  try {
    hidDev.sendReport(hidRid, new Uint8Array(hidFmt.make(clamp(strong, 0, 1), clamp(weak, 0, 1))))
      .catch(e => { if (typeof padTestNote === 'function') padTestNote('webhid send FAILED: ' + (e && e.message || e)); });
    // set-and-hold hardware: every effect arms its own stop, and a fresh send
    // re-arms it — which is exactly how the hold channel sustains
    clearTimeout(hidOffTimer);
    hidStopSeq++; // this effect owns the motors — abandon any stop chain in flight
    hidOffTimer = setTimeout(() => hidSendStop(3),
      Math.max(ms || 120, 90)); // an eccentric mass needs ~90ms to even spin up
    return true;
  } catch (e) { return false; }
}
function padRumble(pattern, fx) {
  // THE PAD SPEAKS ONLY WHERE THE GAME IS. An ALLOWLIST, not a blocklist:
  // any state this list doesn't name — menus, the guide, whatever gets built
  // next year — is silent on the controller by default. Phone ticks are a tap
  // answering a tap; a controller humming outside a run reads as a fault.
  // The pad test path bypasses this by design.
  if (state !== S.PLAY && state !== S.PAUSE && state !== S.INFO && state !== S.END) return;
  try {
    const dur = Array.isArray(pattern) ? pattern.reduce((a, b) => a + b, 0) : pattern;
    const D = clamp(dur * 1.6, 40, 400);
    const mag = clamp(dur / 90, 0.25, 1);
    const tick = dur < 18;
    const strong = fx && fx.strong !== undefined ? fx.strong : (tick ? 0 : mag);
    const weak = fx && fx.weak !== undefined ? fx.weak : (tick ? 0.35 : mag * 0.6);
    // ONE EFFECT AT A TIME, STRONGEST WINS. playEffect and sendReport REPLACE
    // whatever is running — so a light combo tick landing mid-fry was cutting
    // the fry off at the knees, and a busy fight blurred into whichever event
    // happened LAST ("I feel maybe 10% of these"). A weaker effect inside a
    // stronger one's window is dropped, not queued — by the time the window
    // opens it would be stale news.
    const fmag = Math.max(strong, weak);
    if (fmag < 0.03) return; // a pad-muted event (fx zeros) — never claims the window
    if (time < padFxUntil && fmag < padFxMag * 0.7) return;
    padFxUntil = time + D / 1000; padFxMag = fmag;
    // a one-shot owns the motors for a beat — the hold channel yields, or a
    // charge refresh 10ms later would erase the very kick the event earned
    padHoldAt = time + 0.10;
    const act = padDev && padDev.vibrationActuator;
    if (act && act.playEffect) {
      if (fx && fx.side !== undefined && act.effects && act.effects.indexOf('trigger-rumble') >= 0) {
        act.playEffect('trigger-rumble', {
          duration: D,
          strongMagnitude: strong * 0.45, weakMagnitude: weak * 0.45, // the body still feels it
          leftTrigger: fx.side === 0 ? Math.max(strong, weak) : 0,
          rightTrigger: fx.side === 1 ? Math.max(strong, weak) : 0
        });
      } else act.playEffect('dual-rumble', { duration: D, strongMagnitude: strong, weakMagnitude: weak });
    } else if (!hidRumble(strong, weak, D)) { // pads Chrome has no motors for
      const ha = padDev && padDev.hapticActuators && padDev.hapticActuators[0];
      if (ha && ha.pulse) ha.pulse(clamp(Math.max(strong, weak), 0, 1), D);
    }
  } catch (e) {}
}
// THE HOLD CHANNEL: continuous feedback for a continuous state — the charge
// building between docked emitters, which is also the boss duel's hold. Each
// playEffect REPLACES the last, so a short effect refreshed on a throttle IS
// a sustain — and the swell rising with the charge is the pad telling the
// hands what the glass vessel is telling the eyes.
// THE HARD OFF. Set-and-hold motors trust a stop timer; a stop that loses a
// race — or a motor driver aging out of spec, which a 2005 pad has earned —
// leaves the pad humming into the menus. Leaving the run now always slams the
// door: HID motors zeroed, the Gamepad API actuator reset, the priority
// window cleared. Runs regardless of the haptics setting — OFF must mean off.
function padRumbleStop() {
  clearTimeout(hidOffTimer);
  hidSendStop(4); // leaving a run: knock four times, and mean it
  try { const act = padDev && padDev.vibrationActuator; if (act && act.reset) act.reset(); } catch (e) {}
  padFxUntil = 0; padFxMag = 0;
}
let padWasRun = false, padIdleAt = -999;
function tickPadRumble() {
  const inRun = state === S.PLAY || state === S.PAUSE || state === S.INFO || state === S.END;
  if (padWasRun && !inRun) padRumbleStop(); // the door slams on the way out, every path
  padWasRun = inRun;
  // THE MENU WATCHDOG. One stop can be missed; a stop repeated every two
  // seconds cannot. Set-and-hold motors have no other way to be *sure* they
  // are idle, and the report costs a handful of bytes on a screen doing
  // nothing else. It also settles the question for good: with an all-stop
  // landing every two seconds, any pulse that still survives is the hardware
  // generating it on its own, because nothing we sent could still be alive.
  // Runs regardless of the haptics setting — silence is not an effect.
  if (!inRun) {
    if (time - padIdleAt > 2) { padIdleAt = time; hidSendStop(1); }
    return;
  }
  if (!settings.haptics || state !== S.PLAY) return;
  if (typeof volley === 'undefined' || !(volley.charge > 0.02)) return;
  // an EMPTY lane charges too (parked nodes auto-dock) — that perpetual cycle
  // is scenery, not an event, and feeding it to the pad was a metronome
  if (!boss && !enemies.some(e => !e.dead && !e.resolved)) return;
  if (time - padHoldAt < 0.07) return;
  if (time < padFxUntil) return; // never talk over a designed one-shot
  padHoldAt = time;
  const q = clamp(volley.charge / 0.5, 0, 1);
  // QUADRATIC, AND LATE. Docked emitters are half of normal play, so a swell
  // that starts at first contact is a motor that never stops — on hardware
  // with a binary-ish threshold (the RumblePad) it read as constant-on. The
  // hold is silent for the first third of the charge and climbs hard after:
  // it announces the RELEASE, not the docking.
  const k = Math.max(0, q - 0.35) / 0.65;
  const strong = k * k * 0.6, weak = k * k * 0.3;
  if (strong < 0.03) return;
  try {
    const act = padDev && padDev.vibrationActuator;
    if (act && act.playEffect) act.playEffect('dual-rumble', { duration: 130, strongMagnitude: strong, weakMagnitude: weak });
    else if (!hidRumble(strong, weak, 160)) { // refresh outruns the stop — that IS the sustain
      const ha = padDev && padDev.hapticActuators && padDev.hapticActuators[0];
      if (ha && ha.pulse) ha.pulse(strong, 130);
    }
  } catch (e) {}
}
let buzzMonN = 0, buzzMonAt = -999, buzzMonLast = ''; // the ?padtest monitor reads these
function buzz(pattern, fx) {
  buzzMonN++; buzzMonAt = time;
  buzzMonLast = (Array.isArray(pattern) ? '[' + pattern.join(',') + ']' : String(pattern))
    + (fx ? ' s' + (fx.strong !== undefined ? fx.strong : '·') + ' w' + (fx.weak !== undefined ? fx.weak : '·')
      + (fx.side !== undefined ? ' side' + fx.side : '') : '');
  if (!settings.haptics) return;
  const cap = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Haptics;
  try {
    if (cap) {
      if (Array.isArray(pattern)) cap.vibrate({ duration: pattern.reduce((a, b) => a + b, 0) });
      else cap.impact({ style: pattern >= 30 ? 'Heavy' : pattern >= 20 ? 'Medium' : 'Light' });
    } else if (navigator.vibrate) navigator.vibrate(pattern);
  } catch (e) {}
  padRumble(pattern, fx);
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