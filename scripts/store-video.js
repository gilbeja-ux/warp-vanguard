#!/usr/bin/env node
'use strict';
// ---------- STORE VIDEO: one stage, played by the human bot, picture then sound ----------
//   node scripts/store-shoot.js --video --size=yt                 # 1920x1080, 60 fps
//   node scripts/store-shoot.js --video --size=preview --fps=30   # App Store preview plate
//   options: --camp=2 --level=6 (levelIdx; stage 23)  --max=110 (s)  --seed=…  --mistake=26 (levelT s)
//            --noaudio  --out=docs/store/video
//
// TWO PASSES OVER THE SAME RUN.
//   PICTURE: the clock is ours. Every frame is exactly 1/60 s, rendered at the
//            store's size and handed to ffmpeg as a JPEG, so the video has no
//            dropped frame and no screen recorder in it.
//   SOUND:   the page runs free in real time with its AudioContext, and the master
//            bus is recorded by a MediaRecorder.
// The bot steps ONCE PER SIM STEP (it is hung on simStep, not on the frame), reads
// only sim state, and draws from its own seeded generator, so the two passes are
// the same run. The driver proves it: both passes must end on the same score,
// zaps and misses, or the sound is not muxed.
const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const { SIZES, startServer, openGame, bootToMenu, G, sleep, killChrome, ROOT, ARG } = require('./store-shoot.js');
const BOT_SRC = require('./store-bot.js');

const CAMP = ARG.camp === undefined ? 2 : +ARG.camp;
const LEVEL = ARG.level === undefined ? 6 : +ARG.level;
const MAX_S = parseFloat(ARG.max || '120');
const END_HOLD = parseFloat(ARG.endhold || '4');
const FPS = parseInt(ARG.fps || '60', 10);

const botCfg = () => JSON.stringify(Object.assign({}, ARG.seed ? { seed: +ARG.seed } : {}, ARG.mistake ? { mistakeAt: +ARG.mistake } : {}));
// the bot rides simStep: one decision per 1/60 s of SIM time in either pass
const ARM = `(function () {
  window.__BOT_CFG = ${botCfg()};
  window.__bot = ${BOT_SRC};
  window.__steps = 0; window.__stepWall = [];
  const _simStep = simStep;
  simStep = function () { if (!replaying) { __bot.step(SIM_DT); if ((__steps++ % 60) === 0) __stepWall.push(performance.now()); } return _simStep(); };
  // THE RUN FILES NOTHING. The leaderboard host is blocked, and a bot's score has no
  // place on a live board anyway. With the submit stubbed IN THE PAGE the end card
  // shows the honest local result and not an OFFLINE notice about a network we cut.
  lbSubmit = () => {}; lbProvisional = async () => null;
  switchCampaign(${CAMP}); startLevel(${LEVEL}, false);
  return lvNum(levelNo(${CAMP}, ${LEVEL}));
})()`;
const FINAL = "JSON.stringify({ state, score, zaps, misses, perfects, maxCombo, integrity: Math.round(integrity), levelT: +levelT.toFixed(3), steps: __steps, win: typeof endWin !== 'undefined' ? endWin : null, stars: typeof endStars !== 'undefined' ? endStars : null })";

async function picturePass(size, origin, outDir) {
  const page = await openGame(size, { crank: true });
  const { cdp, chrome, errors, S } = page;
  const file = path.join(outDir, `run-${size}-picture.mp4`);
  try {
    await bootToMenu(page, origin);
    const stage = await cdp.eval(ARM);
    console.log(`  picture: stage ${stage}, ${S.w * S.dpr}x${S.h * S.dpr} @ ${FPS} fps`);
    if (ARG.dry) {   // the run without the camera: tune the bot in seconds, not minutes
      let f = 0, endAt = -1;
      for (; f < MAX_S * 60; f += 60) { await cdp.eval('__crank(60)'); const s = JSON.parse(await cdp.eval(G(FINAL))); if (s.state === 2 && endAt < 0) endAt = f + END_HOLD * 60; if (endAt >= 0 && f >= endAt) break; }
      const fin = JSON.parse(await cdp.eval(G(FINAL))); const log = JSON.parse(await cdp.eval('JSON.stringify(__bot.log)'));
      if (errors.length) console.log('  PAGE ERRORS: ' + errors.join(' | '));
      return { file: null, frames: f, fin, log };
    }
    const ff = spawn('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'image2pipe', '-framerate', '60', '-c:v', 'mjpeg', '-i', '-',
      '-r', String(FPS), '-c:v', 'libx264', '-preset', 'medium', '-crf', '16', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', file], { stdio: ['pipe', 'inherit', 'inherit'] });
    const stats = [];
    let endAt = -1, f = 0;
    for (; f < MAX_S * 60; f++) {
      const b64 = await cdp.eval("(__crank(1), document.getElementById('game').toDataURL('image/jpeg', 0.96).slice(23))");
      if (!ff.stdin.write(Buffer.from(b64, 'base64'))) await new Promise(r => ff.stdin.once('drain', r));
      if (f % 60 === 0) {
        const s = JSON.parse(await cdp.eval(G(FINAL))); stats.push(Object.assign({ f }, s));
        if (f % 600 === 0) console.log(`    ${String(f / 60).padStart(3)} s  levelT ${s.levelT}  score ${s.score}  misses ${s.misses}  stability ${s.integrity}`);
        if (s.state === 2 && endAt < 0) endAt = f + END_HOLD * 60;
      }
      if (endAt >= 0 && f >= endAt) break;
    }
    ff.stdin.end();
    await new Promise(r => ff.on('close', r));
    const fin = JSON.parse(await cdp.eval(G(FINAL)));
    const log = JSON.parse(await cdp.eval('JSON.stringify(__bot.log)'));
    fs.writeFileSync(path.join(outDir, `run-${size}.json`), JSON.stringify({ stage, size, frames: f, final: fin, botLog: log, perSecond: stats, errors }, null, 1));
    if (errors.length) console.log('  PAGE ERRORS: ' + errors.join(' | '));
    return { file, frames: f, fin, log };
  } finally { await killChrome(chrome); }
}

async function soundPass(size, origin, outDir, frames) {
  // the SAME logical size (the sim reads W and H) at DPR 1: nobody sees this pass, and a
  // cheap frame is what keeps real time on the sim's 1/60 s
  const page = await openGame(size, { crank: false, dpr: 1 });
  const { cdp, chrome } = page;
  const file = path.join(outDir, `run-${size}-sound.webm`);
  try {
    await bootToMenu(page, origin);
    // the recorder hangs off the master limiter: every bus already routes through it
    const ok = await cdp.eval(`(async () => {
      if (typeof initAC === 'function') initAC();
      if (!AC) return 'no AudioContext';
      if (AC.state !== 'running') await AC.resume();
      const dest = AC.createMediaStreamDestination(); masterBus().connect(dest);
      const rec = new MediaRecorder(dest.stream, { mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: 256000 });
      window.__chunks = []; rec.ondataavailable = e => { if (e.data.size) __chunks.push(e.data); };
      window.__rec = rec; window.__recT0 = 0; rec.onstart = () => { __recT0 = performance.now(); };
      rec.start(1000);
      await new Promise(r => setTimeout(r, 400));
      return AC.state;
    })()`);
    if (ok !== 'running') throw new Error('the AudioContext is ' + ok);
    await cdp.eval(ARM);
    const t0 = Date.now();
    for (;;) {
      await sleep(500);
      const steps = await cdp.eval('__steps');
      if ((Date.now() - t0) / 1000 > frames / 60 + 1.5) break;
      if (steps < 0) break;
    }
    const meta = JSON.parse(await cdp.eval(`(async () => {
      await new Promise(r => { __rec.onstop = r; __rec.stop(); });
      const buf = new Uint8Array(await new Blob(__chunks).arrayBuffer());
      let s = ''; for (let i = 0; i < buf.length; i += 32768) s += String.fromCharCode.apply(null, buf.subarray(i, i + 32768));
      window.__b64 = btoa(s);
      return JSON.stringify({ len: __b64.length, recT0: __recT0, stepWall: __stepWall });
    })()`));
    let b64 = '';
    for (let i = 0; i < meta.len; i += 786432) b64 += await cdp.eval(`__b64.slice(${i}, ${i + 786432})`);
    fs.writeFileSync(file, Buffer.from(b64, 'base64'));
    const fin = JSON.parse(await cdp.eval(G(FINAL)));
    // sim step 0 is video frame 0: the sound before it is trimmed. And the drift —
    // how far real time wandered from 1/60 s a step — is measured, not assumed.
    const lead = (meta.stepWall[0] - meta.recT0) / 1000;
    // REAL TIME IS NOT EXACTLY THE SIM'S. rAF paces the page at the display's rate, and
    // 60 sim steps take a hair more than a wall second. That is a SLOPE, so it is fitted
    // and taken out with atempo; what is left after the fit is the true jitter.
    // A LEAST-SQUARES LINE through the body of the run: t = b + m k. The first second
    // pays for the level's start (a hitch of about 0.13 s) and the end card hitches
    // too, so both ends are left out of the fit. m is the tempo; b moves the trim point.
    const T = meta.stepWall.map(w => (w - meta.stepWall[0]) / 1000);
    const ks = T.map((_, k) => k).filter(k => k >= 2 && k <= T.length - 8);
    const mk = ks.reduce((s, k) => s + k, 0) / ks.length, mt = ks.reduce((s, k) => s + T[k], 0) / ks.length;
    const tempo = ks.reduce((s, k) => s + (k - mk) * (T[k] - mt), 0) / ks.reduce((s, k) => s + (k - mk) * (k - mk), 0);
    const off = mt - tempo * mk;
    const res = T.map((t, k) => +(t - off - tempo * k).toFixed(3));
    const raw = Math.max(...T.map((t, k) => Math.abs(t - k)));
    const drift = Math.max(...ks.map(k => Math.abs(res[k])));
    return { file, fin, lead: lead + off, drift, raw, tempo, res };
  } finally { await killChrome(chrome); }
}

// a WINDOW of a finished run (the App Store preview is 15 to 30 s): --cut=start,length
function cut(outDir, size) {
  const [ss, len] = String(ARG.cut).split(',').map(Number);
  const src = path.join(outDir, `run-${size}.mp4`), out = path.join(outDir, `cut-${size}.mp4`);
  const r = spawnSync('ffmpeg', ['-loglevel', 'error', '-y', '-ss', String(ss), '-t', String(len), '-i', src,
    '-vf', `fade=t=in:st=0:d=0.4,fade=t=out:st=${len - 0.6}:d=0.6`, '-af', `afade=t=in:st=0:d=0.4,afade=t=out:st=${len - 0.8}:d=0.8`,
    '-r', String(FPS), '-c:v', 'libx264', '-profile:v', 'high', '-level', '4.2', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '256k', '-ar', '48000', '-ac', '2', '-movflags', '+faststart', out], { stdio: 'inherit' });
  if (r.status === 0) console.log('  CUT ' + path.relative(ROOT, out) + `  (${ss} s + ${len} s)`);
}

async function main() {
  const size = ARG.size || 'yt';
  if (!SIZES[size]) throw new Error('unknown size ' + size);
  const outDir = path.resolve(ARG.out && ARG.video ? ARG.out : path.join(ROOT, 'docs', 'store', 'video'));
  fs.mkdirSync(outDir, { recursive: true });
  if (ARG.cutonly) { cut(outDir, size); return; }
  const srv = await startServer();
  const origin = 'http://127.0.0.1:' + srv.address().port;
  try {
    // --soundonly: the picture of this size exists already; record the sound again and mux
    const pic = ARG.soundonly ? (j => ({ file: path.join(outDir, `run-${size}-picture.mp4`), frames: j.frames, fin: j.final, log: j.botLog }))(JSON.parse(fs.readFileSync(path.join(outDir, `run-${size}.json`), 'utf8'))) : await picturePass(size, origin, outDir);
    console.log(`  picture done: ${pic.frames} frames, final ${JSON.stringify(pic.fin)}`);
    console.log('  bot log: ' + pic.log.map(e => `${e.ev}@${e.levelT.toFixed(1)}`).join(' '));
    if (ARG.dry) { console.log(JSON.stringify(pic.log.filter(e => e.ev === 'miss' || e.ev === 'fried'), null, 0)); return; }
    if (ARG.noaudio) return;
    const snd = await soundPass(size, origin, outDir, pic.frames);
    console.log(`  sound done: lead ${snd.lead.toFixed(3)} s, tempo ${snd.tempo.toFixed(5)}, drift ${snd.raw.toFixed(3)} s raw and ${snd.drift.toFixed(3)} s after the fit, final ${JSON.stringify(snd.fin)}`);
    if (ARG.debug) console.log('  residuals: ' + snd.res.join(' '));
    const same = ['score', 'zaps', 'misses', 'perfects'].every(k => pic.fin[k] === snd.fin[k]);
    if (!same) { console.error('  THE TWO PASSES ARE NOT THE SAME RUN — the sound is not muxed'); process.exitCode = 1; return; }
    if (snd.drift > 0.08) console.error(`  WARNING: real time drifted ${snd.drift.toFixed(3)} s from the sim`);
    const out = path.join(outDir, `run-${size}.mp4`);
    const r = spawnSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', pic.file, '-ss', snd.lead.toFixed(3), '-i', snd.file,
      '-map', '0:v', '-map', '1:a', '-af', 'atempo=' + snd.tempo.toFixed(6), '-c:v', 'copy', '-c:a', 'aac', '-b:a', '256k', '-ar', '48000', '-ac', '2', '-shortest', '-movflags', '+faststart', out], { stdio: 'inherit' });
    if (r.status === 0) console.log('  MUXED ' + path.relative(ROOT, out));
    if (ARG.cut) cut(outDir, size);
  } finally { srv.close(); }
}
module.exports = { main };
