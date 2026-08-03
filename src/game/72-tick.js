'use strict';
function update(dt) {
  if (state === S.INFO && infoOutAt && time - infoOutAt >= 0.18) {
    const wasVerdict = infoCard === 'verdict';
    infoOutAt = 0;
    state = S.PLAY;
    if (wasVerdict) endLevel(true); // the case closes
    else { time += dt; return; } // resume frame: only un-pause — gameplay advances from the
    // NEXT step, so this (unrecorded, INFO-started) frame doesn't silently advance the sim and
    // desync a run's PLAY-only trace from the verifier's briefing-free replay
  }
  time += dt;
  updateMusic(dt);
  tickPadRumble(); // the controller's hold channel rides the charge
  warpT = Math.max(0, warpT - dt);
  const warp2 = warpT / 0.9;
  // laneFlow: SPOOL UP from a dead stop on launch; brake down slow — EXCEPT on an
  // arrival, which is the opposite of a glide.
  //
  // The spool-up used to take 0.5s, which is not a spool-up: the lane was simply at
  // speed by the time you looked at it, and the standstill it started from was never
  // on screen long enough to be a standstill. WARP_SPOOL stretches it to the length
  // of the warp-in take that now plays over it, so the whole acceleration is
  // something you watch — the streaks draw out of their own stars, the wall bands
  // pick up, the bore opens — rather than a state the game is already in.
  //
  // It stays PURELY VISUAL. Nothing in scoring, spawning or hit resolution reads
  // laneFlow (only the painters do), so lengthening it cannot change a run's
  // outcome — the fixed-timestep tests hold it to that.
  //
  // This one number is the drop-out of warp. drawStreaks scales every smear by
  // laneFlow, so braking it collapses all 300 warp lines back into the points
  // that were making them. Over 2.6s that read as the lane politely winding
  // down; over WARP_COLLAPSE.brake it reads as the stars stopping, which is the
  // thing itself. A loss still winds down slowly — nothing has arrived.
  const flowTgt = (state === S.PLAY || state === S.PAUSE || state === S.INFO) ? 1 : 0;
  // ~0.45s to clear once the menu takes over; instant back to 1 on the way in,
  // because a run must never fade UP over the player
  const runTgt = state === S.MENU ? 0 : 1;
  runVis = runTgt > runVis ? 1 : Math.max(0, runVis - dt / 0.45);
  if (runVis <= 0 && enemies.length + ghosts.length + pickups.length + particles.length) {
    enemies.length = ghosts.length = pickups.length = particles.length = 0;
    popups.length = 0; rimFX.length = 0; latches.length = 0; killStreaks.length = 0;
  }
  if (laneFlow < flowTgt) laneFlow = Math.min(flowTgt, laneFlow + dt / WARP_SPOOL);
  else if (laneFlow > flowTgt)
    laneFlow = Math.max(flowTgt, laneFlow - dt / (state === S.END ? (endWin ? WARP_COLLAPSE.brake : 1.0) : 0.45));
  // the wall streams at EXACTLY the traffic speed — leaks stay glued to it
  // (the tutorial's TAP-TO-FIRE hold stops the whole bore, wall included)
  const flowMul = (tut && tut.frozen ? 0 : 1) * laneFlow;
  tunnelScroll = (tunnelScroll + dt * (state === S.PLAY ? trafficSpeed * 10 : 0.5) * (1 + warp2 * 4) * flowMul) % 10;
  wallDist += dt * (state === S.PLAY ? trafficSpeed : 0.05) * (1 + warp2 * 4) * flowMul;
  shake = Math.max(0, shake - dt * 3);
  redFlash = Math.max(0, redFlash - dt * 2);

  // particles & popups & bolts always animate
  for (const p of particles) { p.x += p.vx * dt * 60; p.y += p.vy * dt * 60; p.vx *= 0.96; p.vy *= 0.96; p.life -= p.decay * dt; }
  particles = particles.filter(p => p.life > 0);
  for (const gh of ghosts) gh.t += dt;
  ghosts = ghosts.filter(gh => gh.t < DECOMP.glitchT);
  for (const rp of ripples) rp.t += dt;
  ripples = ripples.filter(rp => rp.t < DECOMP.rippleT);
  for (const p of popups) { p.y -= 30 * dt; p.life -= dt * 0.9; }
  popups = popups.filter(p => p.life > 0);
  shieldFlashT = Math.max(0, shieldFlashT - dt);
  shieldUpT = Math.max(0, shieldUpT - dt);
  if (DEV_SHIELD && shieldCharge === 0 && shieldFlashT === 0 && state === S.PLAY) {
    shieldCharge = 1; // dev loop: re-arm with the spread animation from a random angle
    shieldUpT = 0.6; shieldUpA = Math.random() * TAU;
  }
  for (const st of killStreaks) st.t += dt;
  killStreaks = killStreaks.filter(st => st.t < 0.15); // must match DUR in the draw pass
  for (const b of bolts) b.life -= dt;
  bolts = bolts.filter(b => b.life > 0);

  if (state !== S.PLAY) {
    endT += dt;
    if (state === S.END && endDropT >= 0 && endDropT < 8) endDropT += dt;
    return;
  }

  if (endless) LV = endlessCfg(levelT); // difficulty tracks survival time
  const L = LV;

  // resume hold: brief 3-2-1 after unpausing so nobody dies blind
  if (resumeHold > 0) {
    resumeHold -= dt;
    const d2 = Math.max(1, Math.ceil(resumeHold / 0.3));
    if (d2 !== resumeDigit) { resumeDigit = d2; sfx.count(); }
    if (resumeHold > 0) return;
  }
  // intro: the boot sequence — the ring locks on, nodes power up, systems
  // check, then the level waits for BOTH thumbs before godspeed
  if (introT >= INTRO_GATE && introT < INTRO_DUR && padHold[0] && padHold[1]) introLatch = true;
  const introPrev = introT;
  if (introT < INTRO_GATE) introT += dt;
  else if (introT >= INTRO_DUR || introLatch) introT += dt;
  // (else: holding at the gate, waiting for hands)
  const inIntro = introT < INTRO_DUR;
  const stageNow = introT >= INTRO_DUR ? 4 : introT >= INTRO_GATE ? 3 : introT >= BOOT_LOCK ? 1 : 0;
  introStageChange(dt, introPrev, inIntro, stageNow);
  // effect timers run on real time; hit-stop scales the game clock
  fx.wide = Math.max(0, fx.wide - dt);
  fx.auto = Math.max(0, fx.auto - dt);
  fx.chain = Math.max(0, fx.chain - dt);
  tolVis += ((fx.wide > 0 ? 1.36 : 1) - tolVis) * Math.min(1, dt * 6);
  updateBarks(dt);
  if (commCur) { commT += dt; if (commT > barkHold) commCur = null; }
  let sdt = dt;
  if (hitStop > 0) { hitStop = Math.max(0, hitStop - dt); sdt *= 0.12; }
  if (tut && tut.frozen) sdt = 0; // the TAP-TO-FIRE hold: the world stands still
  if (boss && boss.dying !== undefined) sdt *= 0.25; // the kill plays in slow motion
  if (!tut && !inIntro) levelT += sdt;

  // keyboard control (desktop testing) — controls always run at full speed
  const kSpd = 4.5 * dt;
  if (keys['a'] || keys['A']) nodes[0].angle -= kSpd;
  if (keys['d'] || keys['D']) nodes[0].angle += kSpd;
  if (!boss) {
    if (keys['ArrowLeft'])  nodes[1].angle -= kSpd;
    if (keys['ArrowRight']) nodes[1].angle += kSpd;
  }

  if (!inIntro) {
    if (tut) updateTutorial(sdt);
    else if (levelT < L.duration) { trySpawn(sdt); runBeats(); } // stop spawning once the run distance is covered
  }
  if (burstQ) {
    burstQ.t -= sdt;
    if (burstQ.t <= 0) { spawnEnemy(); burstQ.left--; burstQ.t = 0.35; if (!burstQ.left) burstQ = null; }
  }
  if (patternQ.length) { // choreographed volleys ride the real-time beat grid
    for (const q of patternQ) q.t -= dt;
    while (patternQ.length && patternQ[0].t <= 0) spawnEnemy(patternQ.shift().angle);
  }
  // NOTHING LAUNCHES THAT CANNOT LAND. A pickup needs a full transit to reach the
  // ring, and the filler's clock ran right up to the final second — so a drop
  // released at the end was still out in the bore when the lane was already
  // cleared, and it hung there in the mission report as litter. The window now
  // shuts a whole transit (plus a beat to actually go and take it) before the
  // run's distance runs out. Endless has no end to run out of; authored pickup
  // beats keep their own timing, which is the designer's call.
  const dropWindow = endless || levelT < L.duration - travelTime() - 2;
  if (!inIntro && dropWindow) pickupT -= sdt;
  if (!tut && dropWindow && pickupT <= 0) { pickupT = srand(20, 32); if (!mutators.noPickups) spawnPickup(); }
  // golden bonus streams ride in on their own clock, once the campaign has
  // taught them (level 5+) — free flow gets them throughout. None spawn near
  // a level's end: a ribbon must have time to be ridden AND spent
  if (!inIntro && !tut && !boss && (endless || levelIdx >= 4)) {
    ribbonT -= sdt;
    if (ribbonT <= 0) {
      // the ribbon also RESPECTS the ledger: it won't enter a window where a
      // dual-node arrival is already booked — it waits for a clean stretch
      if ((endless || levelT < L.duration - 14) && spawnAllowed('strip')) {
        ribbonT = srand(26, 40);
        spawnStrip();
      } else ribbonT = 2.5; // busy lane — try again shortly
    }
  }

  const g = geo();

  const waveMul = mutators.fast ? 1.35 : 1; // constant clock — surges live in endless L.speed
  trafficSpeed = L.speed * waveMul; // tunnel bands, hoops, river and glyphs all ride this
  const TOL = ARCFX.span * tolVis; // the arc IS the window — same span the node renders
  // a rebooting node (node-killer hit) covers nothing until it's back online
  const covers = (n, a) => !(n.deadT > 0) && Math.abs(angDiff(n.angle, a)) < TOL;
  const ringXY = a => ({ x: g.cx + Math.cos(a) * g.nodeR, y: g.cy + Math.sin(a) * g.nodeR });
  const railR = g.nodeR - Math.min(W, H) * 0.055 * 0.86;
  const nodeXY = n => ({ x: g.cx + Math.cos(n.angle) * railR, y: g.cy + Math.sin(n.angle) * railR });
  const nearest = a => Math.abs(angDiff(nodes[0].angle, a)) < Math.abs(angDiff(nodes[1].angle, a)) ? nodes[0] : nodes[1];

  // node-killer reboot: a fried optic counts down, then pops back online
  for (const n of nodes) if (n.deadT > 0) {
    const prevDead = n.deadT;
    n.deadT = Math.max(0, n.deadT - dt);
    // the reboot take whirs while the optic spins back up, timed so its
    // ENDING lands on the node popping back online
    const rs = sampleTrim.restart;
    const rebootAt = rs ? Math.min(2, rs.end - rs.start) : 0;
    if (sampleBufs.restart && prevDead >= rebootAt && n.deadT < rebootAt)
      playSample('restart', 1, Math.cos(n.angle) * 0.6);
    if (n.deadT === 0) {
      n.formAt = introT; // replay the materialize pop — the lens re-forms
      const p2 = nodeXY(n);
      burst(p2.x, p2.y, n === nodes[0] ? NODE_HEX[0] : NODE_HEX[1], 20, 4);
      popup(p2.x, p2.y - 22, 'EMITTER ONLINE', '#8fe0ff');
      if (!sampleBufs.restart) sfx.heal(); // synth stand-in when samples are absent
      buzz(15);
    }
  }

  updateLatches(dt, inIntro, ringXY, nodeXY);
  // UNITE-VOLLEY: docking both nodes together sacrifices ALL other coverage
  // for half a second — the charge — then a focused bolt fires straight into
  // the bore. In the duel the bolt homes on the core instead.
  volley.cd = Math.max(0, volley.cd - dt);
  const bothAlive = !(nodes[0].deadT > 0) && !(nodes[1].deadT > 0);
  // hysteresis: docking engages inside 0.26 rad, but once charging, only a
  // DECISIVE split (0.45) releases — thumb jitter on glass can't fire it
  const dockGap = Math.abs(angDiff(nodes[0].angle, nodes[1].angle));
  const docked = state === S.PLAY && !inIntro && bothAlive
    && !(boss && (boss.introT < BOSS_CER || boss.dying !== undefined))
    && dockGap < (volley.charge > 0 ? 0.45 : 0.26);
  updateVolley(dt, docked, g);

  // The frame context every enemy reads. stripProg travels back OUT: whichever
  // enemy a node is riding sets it, and the trace drone below is driven by it.
  const C = { L, sdt, g, waveMul, TOL, covers, ringXY, nearest, docked, stripProg: -1 };
  for (const en of enemies) updateEnemy(en, C);
  stripSound(C.stripProg >= 0, C.stripProg); // the trace drone lives and dies here

  // free-run surges: every 100s the stream steps up (capped) — and it never
  // arrives unannounced: "SPEEDING UP IN 4..3..2..1", then the surge
  if (endless && !boss) {
    const surge = Math.floor(levelT / 100);
    const toNext = (surge + 1) * 100 - levelT;
    if (surge < 6 && toNext <= 4.2) {
      const cnt = Math.ceil(toNext);
      if (cnt !== surgeCount) { surgeCount = cnt; sfx.count(); } // HUD draws the big digits
    }
    if (surge !== surgeLevel) {
      surgeLevel = surge; surgeCount = -1;
      if (surge > 0 && surge <= 6) {
        popup(W / 2, H * 0.26, 'LANE SURGE' + (surge === 6 ? ' — MAX' : ''), '#ff9a3c');
        surgeWaveZ = SPAWN_Z; // the surge rides in from the deep
        sfx.speedUp();
        buzz(20, { strong: 0, weak: 0 }); // WORLD telegraph — phone only. The lane
        // announcing itself through the pad read as a random rumble.
      }
    }
  }
  // the surge wavefront races from the horizon to the rim
  if (surgeWaveZ > 0) {
    surgeWaveZ -= dt * (SPAWN_Z - g.hitZ) / 0.9;
    if (surgeWaveZ <= g.hitZ) {
      surgeWaveZ = -1;
      shake = Math.min(shake + 0.45, 1); // it slams past the ring
    }
  }

  // pulse waves sweep down the tunnel, molecularizing every trap they pass
  for (const wv of pulseWaves) {
    wv.z += dt * 1.6;
    for (const en of enemies) {
      // never purge payloads or the golden bonus ribbon — the wave that the
      // ribbon itself charged shouldn't eat the next one
      if (en.dead || en.resolved || en.type === 'frag' || en.type === 'strip') continue;
      if (en.z <= wv.z) {
        en.dead = true;
        if (en.partner) en.partner.dead = true;
        const rg2 = ring(Math.max(en.z, 0.02), g);
        const px2 = rg2.x + Math.cos(en.angle) * rg2.r, py2 = rg2.y + Math.sin(en.angle) * rg2.r;
        // the body decompiles; a spray in the wave's own color signs the sweep
        decompile(en.angle, en.z, en);
        burst(px2, py2, `rgb(${wv.col})`, 12, 4);
        rimFX.push({ a: en.angle, t: 0.4, col: wv.col });
        spawnKillStreak(en.angle, en.z);
        wv.kills++;
        score += Math.round(60 * mutMul()); // flat bounty — no combo, no zap credit
      }
    }
    if (wv.z > SPAWN_Z && wv.kills) popup(W / 2, H * 0.4, 'PULSE PURGE ×' + wv.kills, '#8fe0ff');
  }
  pulseWaves = pulseWaves.filter(wv => wv.z <= SPAWN_Z);
  enemies = enemies.filter(e => !e.dead && (e.type === 'strip' || e.z > 0.03)); // strip heads outlive z=0 while the tail crosses
  for (const fx2 of rimFX) fx2.t -= dt;
  rimFX = rimFX.filter(fx2 => fx2.t > 0);
  for (const n of nodes) {
    n.recoil = Math.max(0, (n.recoil || 0) - dt * 4);
    n.dip = Math.max(0, (n.dip || 0) - dt / ARCFX.refill); // spent arc energy refills
  }

  updatePickups(dt, sdt, L, g, covers, ringXY);

  // the firewall core duel
  if (boss) {
    updateBossFight(dt, g);
    if (!boss || state !== S.PLAY) return; // victory mid-update
  }

  if (integrity <= 0) { endLevel(false); return; }
  if (!tut && !endless && levelT >= L.duration) {
    if (L.boss) { if (!boss) spawnBoss(); }
    else if (enemies.length === 0) endLevel(true);
  }
}
// The boot sequence's stage transitions: ring lock-on, nodes powering up, the
// systems check signing off. Fires only on the frame a stage actually changes.
function introStageChange(dt, introPrev, inIntro, stageNow) {
  if (stageNow !== introStage && introT < INTRO_DUR + 1) {
    introStage = stageNow;
    if (stageNow === 0) { // LOCKING ON LANE: approach rumble + rangefinder pips closing in
      // the startup take runs from the top of the boot, pre-cut to length
      bootSample = playSample('startup');
      if (!bootSample) {
        tone(36, BOOT_LOCK, 'sine', 0.10, 58);
        crackle(BOOT_LOCK, 70, 300, 0.8, 0.22);
        for (let k = 0; k < 7; k++) {
          const dly = BOOT_LOCK * (1 - Math.pow(1 - (k + 1) / 7.6, 1.9));
          tone(1240, 0.016, 'square', 0.03 + k * 0.004, null, null, dly);
        }
      }
    } else if (stageNow === 1) { // the DOCK — the startup take's own thump owns this beat
      // the nodes' amber reboot ramp starts HERE — so does their whir
      bootNodeSample = playSample('restart');
      if (!bootSample) {
        tone(90, 0.25, 'sine', 0.24, 40);
        tone(1850, 0.02, 'square', 0.07);
        crackle(0.3, 1100, 240, 1.4, 0.5);
        crackle(0.7, 160, 1100, 2, 0.28, 0.15); // everything charging at once through the ramp
      }
      buzz(35);
    } else if (stageNow === 4) { // GODSPEED: squelch open, terse double ack, engage
      // THE SPOOL-UP. This is the beat the lane actually starts moving on, so the
      // warp-in take goes here rather than at the top of the boot — its 2.44s runs
      // out exactly as WARP_SPOOL finishes bringing laneFlow to full, and you hear
      // the ship wind up while you watch it happen.
      playSample('warpIn');
      crackle(0.07, 1300, 2700, 2, 0.4);
      tone(740, 0.05, 'square', 0.09, null, null, 0.08);
      tone(740, 0.05, 'square', 0.09, null, null, 0.17);
      tone(58, 0.4, 'sine', 0.22, 42);
      buzz([20, 30, 50]);
      commCur = { s: 'CMD', m: 'godspeed, runner.' }; commT = 0;
    }
  }
  // nodes and consoles finish their power ramp together — both lenses re-form
  // node-killer style, and the checks sign off with one flat double click
  if (introPrev < BOOT_ON && introT >= BOOT_ON && introPrev < INTRO_DUR) {
    const gI = geo(), railRI = gI.nodeR - Math.min(W, H) * 0.055 * 0.86;
    for (let i = 0; i < 2; i++) {
      burst(gI.cx + Math.cos(nodes[i].angle) * railRI, gI.cy + Math.sin(nodes[i].angle) * railRI,
        NODE_HEX[i], 16, 4);
      nodes[i].formAt = introT; // replay the materialize pop
      nodes[i].formedFx = true;
    }
    if (!bootNodeSample) { // sign-off clicks — only when no whir is carrying the ramp
      tone(1500, 0.014, 'square', 0.05);
      tone(215, 0.07, 'square', 0.05); tone(260, 0.07, 'square', 0.04);
      tone(1250, 0.02, 'square', 0.06, null, null, 0.09);
      tone(1250, 0.02, 'square', 0.06, null, null, 0.18);
    }
    buzz(15);
  }
  // holding at the gate: a quiet standby pip keeps the console alive
  if (stageNow === 3 && !introLatch && inIntro) {
    gatePip -= dt;
    if (gatePip <= 0) { gatePip = 1.1; tone(960, 0.03, 'sine', 0.03); }
  }

}
// Rim walls: telegraph (dashed arc arms) -> bite -> 3s burn-off. A node sliding
// into a live clamp fries, node-killer style — route around it.
function updateLatches(dt, inIntro, ringXY, nodeXY) {
  // rim walls: telegraph (dashed arc arms) -> bite -> 3s burn-off. A node
  // sliding into the live clamp fries, node-killer style — route around it
  if (!inIntro) for (const lt of latches) lt.t += dt;
  latches = latches.filter(lt => lt.t < lt.tele + lt.dur);
  const fused = boss && boss.mergeT >= 1;
  for (const lt of latches) {
    if (!lt.bit && lt.t >= lt.tele) { // the wall bites into the rail
      lt.bit = true;
      if (lt.tele > 0) {
        const hp2 = ringXY(lt.a);
        burst(hp2.x, hp2.y, '#ff9a3c', 18, 4);
        popup(hp2.x, hp2.y - 20, 'RAIL LATCHED', '#ffb478');
        tone(140, 0.3, 'sawtooth', 0.12, 70);
        crackle(0.3, 2400, 500, 4, 0.6);
        buzz(25, { strong: 0, weak: 0 }); // WORLD telegraph — phone only
      }
    }
    const lt2 = lt.t - lt.tele;
    if (lt2 < lt.arm) continue; // a beat of grace before it can hurt
    const half = lt.span0 * (1 - lt2 / lt.dur);
    for (let i = 0; i < 2; i++) {
      if (fused && i === 1) continue; // one fused carriage in the duel
      if (nodes[i].deadT > 0) continue;
      if (Math.abs(angDiff(nodes[i].angle, lt.a)) < half) { // crossed the clamp
        nodes[i].deadT = 2;
        if (fused) nodes[1].deadT = 2;
        const p2 = nodeXY(nodes[i]);
        burst(p2.x, p2.y, '#ff9a3c', 22, 4);
        popup(p2.x, p2.y - 24, fused ? 'CANNON FRIED' : 'EMITTER FRIED', '#ffb478');
        sfx.fry(Math.cos(nodes[i].angle) * 0.6);
        redFlash = Math.max(redFlash, 0.5);
        shake = Math.min(shake + 0.5, 1);
        buzz([40, 30, 60], { side: i, strong: 1, weak: 0.7 }); // THAT trigger burns
      }
    }
  }

}
// The UNITE-VOLLEY, once docking has been decided: charge, fire, and fly the
// bolt down the bore. Whether the nodes are docked is update()'s call — this
// is what happens afterwards.
function updateVolley(dt, docked, g) {
  if (docked && volley.cd <= 0) {
    if (volley.charge === 0) { crackle(0.5, 300, 2200, 2, 0.28); buzz(8); } // capacitor whine
    volley.charge = Math.min(0.5, volley.charge + dt);
    // the shot goes where you're AIMING while docked
    volley.aimA = nodes[0].angle + angDiff(nodes[1].angle, nodes[0].angle) / 2;
    if (volley.charge >= 0.5) fireVolley(g); // half a second of full commitment, then it flies
  } else if (volley.charge > 0) {
    tone(600, 0.08, 'sine', 0.04, 380); // fizzle — dock broken before the charge completed
    volley.charge = 0;
  }
  for (const sh of volley.shots) {
    if (sh.dead) continue;
    if (sh.homing) { // duel bolt: rides the wire straight to the core
      sh.t += dt / 0.55;
      if (!boss) { sh.dead = true; continue; }
      if (sh.t >= 1) { sh.dead = true; bossVolleyHit(sh); }
      continue;
    }
    sh.z += dt * 2.4;
    if (sh.z > (sh.reach || SPAWN_Z)) { sh.dead = true; continue; } // spent at the horizon
    for (const en of enemies) {
      if (en.dead || en.resolved || en.failed || en.type === 'strip') continue;
      // the bolt only answers to SINGLE plain reds and heavy armor — barrier
      // pairs and color-locked taps are keyed work for the nodes themselves
      if (en.type === 'line' || en.partner || en.lock !== undefined) continue;
      if (Math.abs(angDiff(en.angle, sh.a)) > 0.30 || Math.abs(en.z - sh.z) > 0.09) continue;
      const rgV = ring(Math.max(en.z, 0.02), g);
      const vx = rgV.x + Math.cos(en.angle) * rgV.r, vy = rgV.y + Math.sin(en.angle) * rgV.r;
      if (en.type === 'frag') {
        // shooting a trap REPLICATES it — one becomes two. The lesson costs.
        sh.dead = true;
        en.dead = true;
        for (const s3 of [-1, 1]) {
          enemies.push({ type: 'frag', lock: undefined, z: Math.min(SPAWN_Z - 0.06, en.z + 0.22),
            angle: en.angle + s3 * 0.32, sizeMul: 0.8, speedMul: 1,
            spin: Math.random() * TAU, spinMul: 1, age: 0, dead: false, partner: null });
        }
        burst(vx, vy, '#4a5568', 26, 4);
        burst(vx, vy, '#ff9a3c', 12, 3);
        popup(vx, vy, 'TRAP REPLICATED ×2', '#ff9a3c');
        tone(150, 0.3, 'sawtooth', 0.13, 60);
        crackle(0.3, 2600, 500, 3, 0.7);
        shake = Math.min(shake + 0.5, 1);
        buzz([30, 30, 50], { strong: 0, weak: 0 }); // WORLD telegraph — phone only
        break; // the bolt died on the trap
      }
      // volley kills pay a flat bounty — no combo, no zap credit, no pulse
      // feed: interception stays the scoring game, this is a TOOL
      en.dead = true;
      const vb = Math.round((en.type === 'heavy' ? 250 : 60) * mutMul());
      score += vb;
      decompile(en.angle, en.z, en);
      popup(vx, vy, (en.type === 'heavy' ? 'ARMOR DOWN +' : '+') + vb, '#bfeaff');
      if (en.tut) popup(vx, vy - 30, 'NEUTRALIZED', '#7ee262'); // the label's verb, answered
      rimFX.push({ a: en.angle, t: 0.4, col: '140,225,255' });
      const volleyZapSampled = sfx.zap(1, Math.cos(en.angle) * 0.6);
      buzz(en.type === 'heavy' ? 25 : 12, en.type === 'heavy'
        ? { strong: 0.7, weak: 0.4 } : { strong: 0.18, weak: 0.45 });
      spawnKillStreak(en.angle, en.z);
      lastKillBeat(en);
      if (en.type === 'heavy') { // armor stops the bolt; reds it punches through
        if (!volleyZapSampled) tone(110, 0.2, 'square', 0.13, 60); // synth-era armor thump
        sh.dead = true;
        break;
      }
    }
  }
  volley.shots = volley.shots.filter(sh => !sh.dead);
}
// Power-up orbs riding the stream. Catching one at the ring arms its effect.
function updatePickups(dt, sdt, L, g, covers, ringXY) {
  // power-up orbs ride the stream; catching one at the ring arms its effect
  for (const p of pickups) {
    p.z -= L.speed * 0.9 * sdt;
    p.spin += dt * 2;
    p.age = (p.age || 0) + sdt;
    if (!p.done && p.z <= g.hitZ) {
      p.done = true;
      if (p.tut && tut && !(covers(nodes[0], p.angle) || covers(nodes[1], p.angle))) {
        tut.retry = 'pickup'; tut.t = 0; // missed the practice relay — again
      }
      if (covers(nodes[0], p.angle) || covers(nodes[1], p.angle)) {
        p.dead = true;
        const { x, y } = ringXY(p.angle);
        if (p.kind === 'shield') {
          shieldCharge = 1;
          shieldUpT = 0.6; shieldUpA = p.angle; // the collar charges up FROM the catch
          sfx.pick(); sfx.shieldUp(); // shared pickup sparkle, then the collar charge
        } else if (p.kind === 'inject') { // both purge orbs snap to ready
          pulseCharge = [PULSE_MAX, PULSE_MAX];
          pulseFx[0].bank = pulseFx[1].bank = 1; // both pads swallow at once
          // the pickup sparkle every other relay gets, then both coils arming.
          // It played heal() alone before, which is the sound of being repaired.
          sfx.pick(); sfx.pulseArmed();
        } else {
          fx[p.kind] = PICKUPS[p.kind].dur;
          sfx.pick();
        }
        burst(x, y, '#ffd24a', 24, 4);
        popup(x, y, PICKUPS[p.kind].label, '#ffd24a');
        if (p.tut) popup(x, y - 30, 'PICKED UP', '#7ee262'); // the label's verb, answered
        buzz(15);
      }
    }
  }
  pickups = pickups.filter(p => !p.dead && p.z > 0.03);
}
// ONE ENEMY, ONE STEP. Lifted out of update(), where it was 273 of the 727
// lines and buried everything else. `C` is the frame context: the handful of
// values update() works out once and every enemy then reads (below). Nothing
// here is per-enemy state — that all lives on `en` and on the sim globals.
//
// `return` means "done with this enemy" — it is exactly what `continue` meant
// when this was a loop body, and the only edit made to the code that moved.
function updateEnemy(en, C) {
  const { L, sdt, g, waveMul, TOL, covers, ringXY, nearest, docked } = C;
  en.z -= L.speed * waveMul * (en.speedMul || 1) * sdt;
  en.spin += sdt * 4 * (en.spinMul || 1);
  en.age += sdt;
  if (en.drift) en.angle += en.drift * sdt;

  // sonar tick: a quiet geiger blip per hostile, panned to its angle,
  // accelerating as it closes — the wave is audible before it's urgent
  if (!en.dead && !en.resolved && !en.failed && en.type !== 'frag' && en.type !== 'strip' && en.z > g.hitZ && en.z < 1.9) {
    en.tickT = (en.tickT || 0) - sdt;
    if (en.tickT <= 0) {
      const tArr = (en.z - g.hitZ) / (trafficSpeed * (en.speedMul || 1));
      en.tickT = clamp(tArr * 0.38, 0.14, 1.25);
      sonarTick(1150 + 350 * clamp(1 - tArr / 1.5, 0, 1), Math.cos(en.angle) * 0.75);
    }
  }

  if (en.type === 'strip') {
    // data stream: keep a node ON the ring-crossing point from head to tail
    en.tracing = false;
    if (!en.dead && !en.failed && en.z <= g.hitZ && en.z + en.len >= g.hitZ) {
      const aReq = stripAngle(en, g.hitZ - en.z);
      const on0 = covers(nodes[0], aReq), on1 = covers(nodes[1], aReq);
      if (on0 || on1 || fx.auto > 0) {
        en.offT = 0;
        en.tracing = true;
        C.stripProg = clamp((g.hitZ - en.z) / en.len, 0, 1); // drives the trace drone
        en.traceNode = on0 ? 0 : on1 ? 1 : en.traceNode || 0;
        en.traceT = (en.traceT || 0) + sdt;
        if (en.traceT > 0.14) { // score ticks while riding the line
          en.traceT -= 0.14;
          score += Math.round(20 * mutMul());
          const hp = ringXY(aReq);
          burst(hp.x, hp.y, '#ffd24a', 2, 2.5);
        }
      } else if ((en.offT = (en.offT || 0) + sdt) < 0.18) {
        // forgiveness window: a brief slip (or the crossing's first frames)
        // doesn't break the escort — staying off it does
      } else if (en.tut) { // practice run: no penalty, run the drill again
        if (tut) { tut.retry = en.tut; tut.t = 0; }
        en.dead = true;
        const hp = ringXY(aReq);
        popup(hp.x, hp.y, 'RIDE IT ALL THE WAY — AGAIN', '#ff9a3c');
        sfx.miss();
      } else {
        // the bonus fizzles — a missed opportunity, never a wound
        en.failed = true;
        const hp = ringXY(aReq);
        burst(hp.x, hp.y, '#ffd24a', 8, 2.5);
        popup(hp.x, hp.y, 'PULSE MISSED', 'rgba(255,225,160,0.85)');
        tone(520, 0.14, 'sine', 0.05, 390);
      }
    }
    if (!en.dead && en.z + en.len < g.hitZ) { // tail cleared the ring
      en.dead = true;
      if (!en.failed) {
        const pts = Math.round(250 * mutMul());
        score += pts;
        const aEnd = stripAngle(en, en.len);
        const hp = ringXY(aEnd);
        burst(hp.x, hp.y, '#ffd24a', 26, 4);
        burst(hp.x, hp.y, '#ffffff', 14, 5);
        rimFX.push({ a: aEnd, t: 0.5, col: '255,210,74' });
        sfx.traced();
        // a full ride buys a full pulse for the node that rode it
        const ni = en.traceNode !== undefined ? en.traceNode
          : Math.abs(angDiff(nodes[0].angle, aEnd)) < Math.abs(angDiff(nodes[1].angle, aEnd)) ? 0 : 1;
        pulseCharge[ni] = PULSE_MAX; // the ride banks a full pulse — tutorial included
        pulseFx[ni].bank = 1;        // a whole pulse landing is the biggest swallow there is
        popup(hp.x, hp.y, 'PULSE CHARGED +' + pts, '#ffe9b0');
        // traced() above resolves the ride; this says what the ride BOUGHT, on the
        // pad that now owns it — the generic sparkle it played said neither
        sfx.pulseArmed(Math.cos(nodes[ni].angle) * 0.7);
        buzz(30, { side: ni, strong: 0.55, weak: 0.85 }); // the pad that now owns it
      }
    }
    // the ribbon lights up in the tracing node's color, fading in and out
    en.traceGlow = clamp((en.traceGlow || 0) + (en.tracing ? sdt * 5 : -sdt * 3), 0, 1);
    return; // ribbons never enter the zap/miss resolution below
  }

  if (!en.dead && !en.resolved && en.z <= g.hitZ) {
    // node killer: a hacker trap — touching it IS the mistake
    if (en.type === 'frag') {
      const touched = covers(nodes[0], en.angle) || covers(nodes[1], en.angle);
      const { x: fx2, y: fy } = ringXY(en.angle);
      if (touched) {
        en.dead = true;
        burst(fx2, fy, '#4a5568', 22, 3.5);
        if (en.tut && en.touchMe) { // the lesson: feel the fry, no penalty beyond it
          if (tut) tut.fragTaught = true;
          for (const n of nodes) if (covers(n, en.angle)) n.deadT = 2;
          popup(fx2, fy, 'FRIED — 2s REBOOT. now you know', '#ff9a3c');
          sfx.fry(Math.cos(en.angle) * 0.7);
          buzz([40, 40, 60]);
        } else if (en.tut) { // practice: it fries here too — dodge means dodge
          if (tut) { tut.retry = en.tut; tut.t = 0; }
          for (const n of nodes) if (covers(n, en.angle)) n.deadT = 2;
          popup(fx2, fy, 'FRIED — dodge it. AGAIN', '#ff9a3c');
          sfx.fry(Math.cos(en.angle) * 0.7);
          buzz([40, 40, 60]);
        } else {
          combo = 0; comboHeal = 0; fragsHit++;
          if (!shieldAbsorb(fx2, fy)) {
            // the trap fries every node that touched it — 2s forced reboot
            for (const n of nodes) if (covers(n, en.angle)) n.deadT = 2;
            popup(fx2, fy, 'EMITTER FRIED — REBOOTING', '#ff4a5e');
            redFlash = 1; shake = Math.min(shake + 0.6, 1);
            sfx.fry(Math.cos(en.angle) * 0.7);
            buzz([40, 40, 60]);
          }
        }
      } else {
        en.resolved = true;
        if (en.tut && en.touchMe) { // the lesson requires contact — again
          if (tut) { tut.retry = en.tut; tut.t = 0; }
          popup(fx2, fy, 'TOUCH it this once — feel what it does', '#ff9a3c');
        } else {
          const bonus = Math.round(50 * mutMul());
          score += bonus;
          popup(fx2, fy, (en.tut ? 'DODGED +' : 'trap avoided +') + bonus, en.tut ? '#7ee262' : '#9aa7bd');
        }
      }
      return;
    }
    let hit = false;
    const boltPairs = []; // [node, targetAngle] — where the lightning jumps from/to
    if (fx.auto > 0) {
      hit = true; // auto-zap: the firewall clears anything crossing the ring
      if (en.partner) boltPairs.push([nodes[0], en.angle], [nodes[1], en.partner.angle]);
      else boltPairs.push([nearest(en.angle), en.angle]);
    } else if (en.type === 'heavy') {
      // heavy armor: a charged volley still cracks it early — and BOTH
      // arcs docked on its lane break it together at the rim. One node
      // alone still bounces off.
      hit = covers(nodes[0], en.angle) && covers(nodes[1], en.angle);
      if (hit) boltPairs.push([nodes[0], en.angle], [nodes[1], en.angle]);
    } else if (en.type === 'line') {
      // barrier: one node on each end, either assignment
      const p = en.partner;
      if (covers(nodes[0], en.angle) && covers(nodes[1], p.angle)) { hit = true; boltPairs.push([nodes[0], en.angle], [nodes[1], p.angle]); }
      else if (covers(nodes[1], en.angle) && covers(nodes[0], p.angle)) { hit = true; boltPairs.push([nodes[1], en.angle], [nodes[0], p.angle]); }
    } else if (en.lock !== undefined) {
      // color-locked: only the matching node can break it
      hit = covers(nodes[en.lock], en.angle);
      if (hit) boltPairs.push([nodes[en.lock], en.angle]);
    } else {
      const shooter = covers(nodes[0], en.angle) ? nodes[0] : covers(nodes[1], en.angle) ? nodes[1] : null;
      hit = !!shooter;
      if (shooter) boltPairs.push([shooter, en.angle]);
    }
    const { x: ex, y: ey } = ringXY(en.angle);
    if (hit) {
      en.dead = true;
      if (combo === 0) comboStartT = levelT;                       // a new streak begins
      combo++;
      if (combo > maxCombo) { maxCombo = combo; maxComboStart = comboStartT; } // this streak owns the record
      if (comboStartT === maxComboStart) maxComboSec = levelT - maxComboStart; // extend the record streak's span
      // precision grading: dead-center coverage doubles the take (never via auto-zap)
      let err = 0;
      for (const [n, a] of boltPairs) err = Math.max(err, Math.abs(angDiff(n.angle, a)));
      const perfect = fx.auto <= 0 && boltPairs.length > 0 && err < TOL * 0.35;
      if (perfect) perfects++;
      const base = en.type === 'heavy' ? 250 : en.type === 'line' ? 300 : en.lock !== undefined ? 150 : 100;
      const pts = Math.round(base * (perfect ? 2 : 1) * mutMul()) * scoreMul();
      score += pts; zaps++;
      // each shooter banks the zap into ITS orb (both, on a shared kill) —
      // choosing which node fires is choosing which pulse you charge
      if (!en.tut) {
        const fed = new Set();
        for (const [n2] of boltPairs) fed.add(n2 === nodes[0] ? 0 : 1);
        for (const fi of fed) {
          if (pulseCharge[fi] >= PULSE_MAX) continue;
          pulseCharge[fi] = Math.min(PULSE_MAX, pulseCharge[fi] + Math.min(combo, 5));
          pulseFx[fi].bank = 1; // the orb visibly swallows what just landed
          // panned to the pad that banked it, so a zap tells you WHICH orb it fed
          const pan = Math.cos(nodes[fi].angle) * 0.7;
          if (pulseCharge[fi] >= PULSE_MAX) {
            popup(W / 2, H * 0.35, (fi === 0 ? 'BLUE' : 'WHITE') + ' PULSE CHARGED — TAP ITS CORE', '#8fe0ff');
            sfx.pulseArmed(pan);
            buzz(15);
          } else sfx.pulseBank(pulseCharge[fi] / PULSE_MAX, pan); // filling: a tick that climbs
        }
      }
      // max-combo streaks knit the payload back together
      const cap = mutators.oneLife ? 25 : 100;
      if (combo >= 5 && integrity < cap) {
        comboHeal++;
        if (comboHeal >= 5) {
          comboHeal = 0;
          integrity = Math.min(cap, integrity + 25);
          popup(ex, ey - 26, 'STABILITY RESTORED', '#8fc7ff');
          rimFX.push({ a: en.angle, t: 0.6, col: '143,199,255' });
          sfx.heal();
          buzz(12);
        }
      }
      decompile(en.angle, g.hitZ, en);
      if (en.partner) {
        en.partner.dead = true;
        decompile(en.partner.angle, g.hitZ, en.partner);
      }
      for (const [n, a] of boltPairs) {
        const t0 = ringXY(a);
        // the discharge leaps from BOTH bus-bars onto the target between them
        if (n.tipA) spawnBolt(n.tipA.x, n.tipA.y, t0.x, t0.y);
        if (n.tipB) spawnBolt(n.tipB.x, n.tipB.y, t0.x, t0.y);
        n.recoil = 1; // the arc flares white...
        n.dip = 1;    // ...and its energy visibly drains, then recovers
        rimFX.push({ a, t: 0.45, col: '140,225,255' });
      }
      // chain overdrive: the kill arcs to the nearest other hostile and
      // takes it too — locks and armor don't stop raw lightning
      if (!en.tut && fx.chain > 0) {
        let cBest = null, cd = 9;
        for (const c of enemies) {
          if (c === en || c === en.partner || c.dead || c.resolved || c.failed) continue;
          if (c.type === 'frag' || c.type === 'strip') continue; // never into payloads or ribbons
          const dA = Math.abs(angDiff(c.angle, en.angle));
          if (dA < cd) { cd = dA; cBest = c; }
        }
        if (cBest) {
          cBest.dead = true;
          if (cBest.partner) cBest.partner.dead = true;
          const rg2 = ring(Math.max(cBest.z, 0.02), g);
          const bx = g.cx + Math.cos(cBest.angle) * rg2.r, by = g.cy + Math.sin(cBest.angle) * rg2.r;
          spawnBolt(ex, ey, bx, by);
          decompile(cBest.angle, cBest.z, cBest, 0.8);
          const cb = cBest.type === 'heavy' ? 250 : cBest.type === 'line' ? 300 : cBest.lock !== undefined ? 150 : 100;
          const cpts = Math.round(cb * 0.5 * mutMul());
          score += cpts; zaps++;
          popup(bx, by, 'CHAIN +' + cpts, '#d8b4ff');
          spawnKillStreak(cBest.angle, cBest.z);
          tone(1976, 0.1, 'triangle', 0.08, 2960);
        }
      }
      if (en.type === 'line' && en.partner) { // the wall snaps
        const p3 = ringXY(en.partner.angle);
        for (let k2 = 1; k2 < 4; k2++) burst(lerp(ex, p3.x, k2 / 4), lerp(ey, p3.y, k2 / 4), '#ff8ba0', 6, 3);
      }
      // no hit-stop, no screen shake on routine kills — the streak, rim
      // flash and haptics carry it
      spawnKillStreak(en.angle, en.z);
      lastKillBeat(en);
      popup(ex, ey, (perfect ? 'PERFECT +' : '+') + pts + (combo >= 3 ? '  x' + scoreMul() : ''), perfect ? '#ffe9b0' : '#bfeaff');
      if (en.tut === 'volley' && tut && !tut.retry) {
        // the lesson is the VOLLEY — a plain zap kills the trap but not
        // the stage; the column returns until one charged shot clears it
        tut.retry = 'volley';
        popup(ex, ey - 30, 'DOCK BOTH — FIRE THE VOLLEY', '#ffb066');
      }
      else if (en.tut) popup(ex, ey - 30, 'INTERCEPTED', '#7ee262'); // the label's verb, answered
      // no screen shake on a clean kill — the rim flash + haptics carry it;
      // the tunnel only twitches when something goes WRONG
      const zapSampled = sfx.zap(combo, Math.cos(en.angle) * 0.7);
      // synth-era accents — the recorded hit stands alone
      if (!zapSampled && en.type === 'heavy') tone(110, 0.2, 'square', 0.13, 60); // armor thump
      if (!zapSampled && en.lock !== undefined) tone(1568, 0.12, 'triangle', 0.09, 1976); // key chime
      { // the hand that zapped feels the kill — a clean red is a crack in the
        // light motor, armor collapsing is the heavy one. Solo zaps name their
        // trigger; a pair job (line, heavy) kicks both hands.
        const zside = boltPairs.length === 1 ? (boltPairs[0][0] === nodes[0] ? 0 : 1) : undefined;
        buzz(en.type === 'normal' ? 18 : 30, en.type === 'normal'
          ? { side: zside, strong: 0.30, weak: 0.55 }
          : { side: zside, strong: 0.85, weak: 0.45 });
      }
    } else {
      en.resolved = true; // slips past the ring and flies by the player
      if (en.partner) en.partner.resolved = true; // the pair fails as one
      if (en.tut) {
        if (tut) { tut.retry = en.tut; tut.t = 0; } // practice trap: no penalty, try again
      } else {
        misses++; combo = 0; comboHeal = 0;
        if (!shieldAbsorb(ex, ey, en.angle)) {
          integrity = Math.max(0, integrity - 25); // 4 mistakes = the lane goes unstable
          burst(ex, ey, '#ff4a5e', 20, 3);
          popup(ex, ey, 'STABILITY LOST', '#ff4a5e');
          redFlash = 1; shake = Math.min(shake + 0.6, 1);
          rimFX.push({ a: en.angle, t: 0.55, col: '255,74,94' });
          sfx.miss(Math.cos(en.angle) * 0.7);
          buzz([40, 40, 60], { strong: 1, weak: 0.3 }); // dread is the heavy motor alone
        }
      }
    }
  }
}
