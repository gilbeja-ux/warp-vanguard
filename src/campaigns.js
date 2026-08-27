// WARP VANGUARD — bundled contracts.
//
// Each campaign is a CONTRACT: a different client, a different cargo, and a
// stated route across the cordon tiers. They are episodic — no shared
// antagonist, no running investigation — so a contract is complete when it is
// delivered. `tiers` is load-bearing: the chart places a contract's relays
// across exactly that span, so the route on the map is the route in the brief.
//
// No `comms`. In-run voice is reactive barks (see docs/IN-RUN-VOICE.md), not
// scripted chatter on a clock.
//
// A LEVEL'S `name` IS NOT WHAT THE PLAYER READS. The menu, the HUD and the
// leaderboard all show levelRouteName() — the DESTINATION the galaxy generator
// places for that relay, and nothing else. `name` is an AUTHORING label: the
// loader length-checks it and the Lane Designer edits it, and nothing else
// reads it.
//
// So these names are set to the destination each leg delivers to — the same end
// of the route the game shows — because a label that disagrees with the game is
// how this file ended up carrying a corrupt-badge investigation ('EVIDENCE
// VAULT', 'BADGE ZERO') inside a contract about a deep range survey, invisibly,
// for as long as it took someone to open the Designer.
//
// They are a SNAPSHOT, not a binding: buildCity() derives the systems from a
// fixed seed and the level counts, so changing how many relays a contract has
// moves every destination after it and these labels go stale again. They cost
// nothing when they do — no player sees them — but re-snapshot if it matters.
//
// One self-contained, JSON-shaped object per campaign (no functions): the
// exact format the Lane Designer exports and future community packages
// will use. Loaded before the game script; every package still passes
// validateCampaign() on install. See docs/CMS-ROADMAP.md.
const CAMPAIGN_PACKAGES = [{
  id: 'cargo-run', format: 1,
  title: 'THE CARGO RUN', tagline: 'HAULERS CONSORTIUM · TIER 1 → 3', difficulty: 1,
  client: 'Meridian Haulage', tiers: [1, 3], art: 'cargo-run.webp',
  story: 'A hauler consortium is moving bonded freight out of the inner worlds to a tier-3 market, and every operator they hired last quarter came back short. You fly point. Whatever has been seeded in that lane comes off it before the cargo arrives.',
  map: { theme: 'chart' }, // procedural lane chart; image maps carry { image, pins }
  speakers: [
    { id: 'HAUL', name: 'Meridian Haulage', color: '111,227,255' },
    { id: 'CMD',  name: 'Lane Command', color: '235,245,255' },
    { id: 'WARD', name: 'the interdiction', color: '212,101,255' }
  ],
  levels: [
    { tint: '80,160,255', duration: 40, spawnMin: 1.50, spawnMax: 2.30, speed: 0.34, doubles: 0.00, heavies: 0.00, lines: 0.00, colors: 0.00, track: 0,
      story: { line: 'The journey begins. Keep the convoy safe!' } },
    // THE ONBOARDING LADDER: one new demand per lane, ever since the players
    // told us lane 2 lost them. Lane 2 used to stack doubles AND heavies onto
    // a 30% traffic jump — two brand-new two-thumb skills in one leg. Now each
    // leg teaches exactly the thing its hint names, and heavies (the purple
    // armor) wait until the thumbs already work independently. The slot-by-slot
    // traffic ramp (duration/spawn/speed) is untouched — only the mix moved.
    { tint: '255,170,90', duration: 50, spawnMin: 1.05, spawnMax: 1.80, speed: 0.40, doubles: 0.30, heavies: 0.00, lines: 0.00, colors: 0.00, track: 1,
      hint: 'NEW THREAT: paired traffic — one on each side, both thumbs',
      story: { line: 'So far so good! Let\'s keep it up.' } },
    { tint: '110,230,200', duration: 55, spawnMin: 0.95, spawnMax: 1.70, speed: 0.43, doubles: 0.30, heavies: 0.22, lines: 0.00, colors: 0.00, track: 2,
      hint: 'NEW THREAT: heavy armor — dock both emitters and HOLD',
      story: { line: 'Moving into less protected space. Stay vigilant.' } },
    { tint: '70,205,235', duration: 60, spawnMin: 0.85, spawnMax: 1.55, speed: 0.46, doubles: 0.35, heavies: 0.20, lines: 0.00, colors: 0.00, frags: 0.13, track: 0, bursts: true,
      hint: 'NEW THREAT: burst deployments — threats arrive in volleys',
      story: { line: 'A little detour through the belt.' } },
    { tint: '150,110,255', duration: 60, spawnMin: 0.72, spawnMax: 1.35, speed: 0.46, doubles: 0.40, heavies: 0.20, lines: 0.20, colors: 0.00, frags: 0.14, track: 1,
      hint: 'NEW THREAT: barrier lines — one emitter on each end',
      story: { line: 'No turning back now...' } },
    { tint: '255,205,80', duration: 65, spawnMin: 0.68, spawnMax: 1.25, speed: 0.48, doubles: 0.42, heavies: 0.18, lines: 0.18, colors: 0.00, frags: 0.16, walls: 0.10, track: 2,
      hint: 'NEW THREAT: dead zones — the rail closes, route around',
      story: { line: 'Scoop some fuel at the star for our last leg of the run.' } },
    { tint: '255,70,100', duration: 70, spawnMin: 0.58, spawnMax: 1.10, speed: 0.54, doubles: 0.48, heavies: 0.22, lines: 0.22, colors: 0.36, frags: 0.20, walls: 0.15, track: 0, bursts: true,
      // THE DEBUT BREATHES (H-25 item 2, Gil's live ruling 2026-08-27): the
      // lock's first 15 seconds carried the full red load — volleys included —
      // on the campaign's steepest jump, and the stack drowned the lesson. The
      // opening band halves the reds and silences the volleys while the lock
      // cadence stays the lane's own: no volleys (bursts off frees ~24% of
      // ticks into the normal branch, so colors drops to 0.25 to keep keyed
      // arrivals/second at the lane's 0.36-share rate). After 0:15 the lane is
      // exactly as authored. One demand, one lane — L06 stays untouched.
      bands: [{ t0: 0, t1: 15, mix: { bursts: false, colors: 0.25 } }],
      hint: 'NEW THREAT: phase-locked threats — match the emitter',
      story: { line: 'Last stretch before the exchange.' } },
    { tint: '212,101,255', duration: 45, spawnMin: 0.80, spawnMax: 1.40, speed: 0.50, doubles: 0.35, heavies: 0.20, lines: 0.20, colors: 0.30, frags: 0.15, walls: 0.10, track: 2, boss: true,
      hint: 'THE WARP LEECH — zap its swarm, bank the charge, six pulses',
      bossKind: 'leech',
      story: { line: 'The buyer is waiting. Nothing gets through you.' } }
  ],
  verdict: { title: 'CONTRACT 01 — DELIVERED', art: 'cargo-run-closure.webp',
    // the closure disc reads `line`; `lines` keeps the authored epilogue
    line: 'Good job! The system\'s economy is now booming!', lines: [
    'Eight legs, one hold, nothing lost.', 'The consortium paid on arrival and', 'asked no questions about the wreckage', 'we left in the lane behind us.'] } },
{
  id: 'survey', format: 1,
  title: 'THE SURVEY', tagline: 'DEEP RANGE EXPEDITION · TIER 1 → 4', difficulty: 2,
  client: 'Deep Range Survey', tiers: [1, 4], art: 'survey.webp',
  story: 'A survey expedition is pushing past patrolled space to chart lanes nobody has flown in forty years. They carry instruments, not guns. Eight legs from the inner worlds out to the deep — and the further you get, the less anyone is coming if it goes wrong.',
  map: { theme: 'chart' },
  speakers: [
    { id: 'SURV', name: 'Deep Range Survey', color: '111,227,255' },
    { id: 'CMD',  name: 'Lane Command', color: '235,245,255' },
    { id: 'WARD', name: 'the interdiction', color: '212,101,255' }
  ],
  levels: [
    { tint: '96,180,255', duration: 50, spawnMin: 0.75, spawnMax: 1.30, speed: 0.46, doubles: 0.45, heavies: 0.08, lines: 0.00, colors: 0.00, frags: 0.08, track: 1,
      hint: 'volume over trickery — ride the lane, keep the combo',
      bands: [{ t0: 28, t1: 44, intensity: 1.5 }],
      story: { line: ' We clear the path - They fly it' } },
    { tint: '255,160,80', duration: 55, spawnMin: 0.68, spawnMax: 1.20, speed: 0.49, doubles: 0.50, heavies: 0.10, lines: 0.00, colors: 0.00, frags: 0.10, track: 2, bursts: true,
      hint: 'the loop runs HOT — pure traffic, find your rhythm',
      bands: [{ t0: 16, t1: 32, intensity: 1.5 }, { t0: 44, t1: 53, intensity: 1.8 }],
      // authored punctuation (H-25 item 5): one heavy in the trough between the
      // bands, and a shield handed over just before the hot finish
      beats: [{ t: 36, kind: 'enemy', type: 'heavy' }, { t: 42, kind: 'pickup', type: 'shield' }],
      story: { line: 'Charting a lane nobody has flown in forty years.' } },
    { tint: '120,230,190', duration: 60, spawnMin: 0.62, spawnMax: 1.10, speed: 0.52, doubles: 0.50, heavies: 0.10, lines: 0.00, colors: 0.15, frags: 0.12, track: 0,
      hint: 'phase locks in the flood — glance, match, keep moving',
      bands: [{ t0: 30, t1: 48, intensity: 1.6 }],
      story: { line: 'Valuable data to collect, let\'s make sure they\'re safe.' } },
    { tint: '255,205,90', duration: 60, spawnMin: 0.58, spawnMax: 1.00, speed: 0.55, doubles: 0.55, heavies: 0.12, lines: 0.00, colors: 0.15, frags: 0.12, track: 1, bursts: true,
      hint: 'burst volleys — the flood comes in waves now',
      bands: [{ t0: 24, t1: 42, intensity: 1.7, mix: { doubles: 0.6 } }],
      story: { line: 'Past patrolled space. The charts stop being reliable.' } },
    { tint: '150,120,255', duration: 65, spawnMin: 0.55, spawnMax: 0.95, speed: 0.57, doubles: 0.55, heavies: 0.10, lines: 0.08, colors: 0.18, frags: 0.14, walls: 0.06, track: 2,
      hint: 'walls in the current — reroute without losing the beat',
      bands: [{ t0: 28, t1: 46, intensity: 1.6 }],
      // Gil flew the 3s hush here and ruled it out: an empty lane is not a beat.
      // Three plain arrivals keep the lane moving through the same window without
      // asking anything new of the thumbs — presence, not difficulty.
      beats: [{ t: 25, kind: 'enemy' }, { t: 26, kind: 'enemy' }, { t: 27, kind: 'enemy' }],
      story: { line: 'Deep space. None of this was on the last survey.' } },
    { tint: '255,90,110', duration: 70, spawnMin: 0.50, spawnMax: 0.90, speed: 0.60, doubles: 0.60, heavies: 0.14, lines: 0.08, colors: 0.18, frags: 0.16, walls: 0.08, track: 0, bursts: true,
      hint: 'blacksite pace — the fastest lane yet',
      bands: [{ t0: 26, t1: 44, intensity: 1.8 }, { t0: 56, t1: 66, intensity: 2.0 }],
      story: { line: 'They are recording everything out here. Including us.' } },
    { tint: '255,70,160', duration: 75, spawnMin: 0.48, spawnMax: 0.85, speed: 0.63, doubles: 0.60, heavies: 0.15, lines: 0.10, colors: 0.20, frags: 0.18, walls: 0.08, track: 1, bursts: true,
      hint: 'his ledger floods the lane — survive the torrent',
      bands: [{ t0: 18, t1: 38, intensity: 1.7 }, { t0: 52, t1: 70, intensity: 2.1, mix: { doubles: 0.65 } }],
      // the trough between the torrents: one placed heavy keeps it honest, then
      // a shield right before the biggest band this campaign throws
      beats: [{ t: 44, kind: 'enemy', type: 'heavy' }, { t: 50, kind: 'pickup', type: 'shield' }],
      story: { line: 'Tier 4. The expedition before this one filed no report.' } },
    { tint: '212,101,255', duration: 50, spawnMin: 0.70, spawnMax: 1.25, speed: 0.55, doubles: 0.45, heavies: 0.16, lines: 0.10, colors: 0.22, frags: 0.14, walls: 0.08, track: 2, boss: true, bossKind: 'siphon',
      hint: 'THE SIPHON — one light hunts one emitter. steal its streams',
      story: { line: 'Final reading, then we take them home.' } }
  ],
  verdict: { title: 'CONTRACT 02 — CHARTED', art: 'survey-closure.webp',
    // the closure disc reads `line`; `lines` keeps the authored epilogue
    line: '"A giant leap", discovery data delivered.', lines: [
    'They got their readings and we got', 'them home. Four of those lanes had', 'not been flown since the survey', 'before this one never came back.'] } },
{
  id: 'collector', format: 1,
  title: 'THE COLLECTOR', tagline: 'A LONE TRADER · TIER 2 → 4', difficulty: 3,
  client: 'Vess Andarr, trader', tiers: [2, 4], art: 'collector.webp',
  story: 'One trader, one hold, and a manifest she will not read out. She pays in advance, flies at odd hours, and wants no escort showing on any register. Tier 2 to tier 4, quietly, and no questions about what is in the crates.',
  map: { theme: 'chart' },
  speakers: [
    { id: 'TRDR', name: 'Vess Andarr, trader', color: '111,227,255' },
    { id: 'CMD',  name: 'Lane Command', color: '235,245,255' },
    { id: 'WARD', name: 'the interdiction', color: '212,101,255' }
  ],
  levels: [
    { tint: '80,200,215', duration: 55, spawnMin: 1.00, spawnMax: 1.65, speed: 0.50, doubles: 0.30, heavies: 0.18, lines: 0.30, colors: 0.35, frags: 0.10, track: 0,
      hint: 'a dead lane — every interdictor here was left ON PURPOSE',
      story: { line: 'One trader, one hold, no manifest.' } },
    { tint: '110,225,170', duration: 55, spawnMin: 0.60, spawnMax: 1.00, speed: 0.60, doubles: 0.60, heavies: 0.06, lines: 0.00, colors: 0.00, frags: 0.10, track: 1, bursts: true,
      hint: 'the current still runs — fast, blind, and full',
      bands: [{ t0: 15, t1: 30, intensity: 1.7 }, { t0: 40, t1: 52, intensity: 1.9 }],
      story: { line: 'She pays in advance and flies at odd hours.' } },
    { tint: '255,190,110', duration: 60, spawnMin: 0.85, spawnMax: 1.35, speed: 0.53, doubles: 0.35, heavies: 0.20, lines: 0.28, colors: 0.45, frags: 0.14, walls: 0.12, track: 2,
      hint: 'shoal water — phase-locked reefs and sealed pairs, read before you steer',
      beats: [{ t: 26, kind: 'wall' }, { t: 35, kind: 'strip' }, { t: 46, kind: 'wall' }],
      story: { line: 'Looking like a luxury cruiser, we\'re actually hunting for gems.' } },
    { tint: '120,160,255', duration: 60, spawnMin: 0.53, spawnMax: 0.90, speed: 0.62, doubles: 0.65, heavies: 0.05, lines: 0.00, colors: 0.00, frags: 0.12, track: 0, bursts: true,
      hint: 'riptide — do not fight the pace, become it',
      bands: [{ t0: 12, t1: 28, intensity: 1.8 }, { t0: 36, t1: 54, intensity: 2.1, mix: { doubles: 0.7 } }],
      story: { line: 'Whatever is in the cargo hold, somebody else wants it.' } },
    { tint: '150,230,120', duration: 65, spawnMin: 0.78, spawnMax: 1.22, speed: 0.56, doubles: 0.35, heavies: 0.22, lines: 0.30, colors: 0.40, frags: 0.16, walls: 0.15, track: 1,
      hint: 'the rail closes in shallow water — plan two moves ahead',
      beats: [{ t: 24, kind: 'wall' }, { t: 40, kind: 'lull', dur: 5 }, { t: 52, kind: 'wall' }],
      story: { line: 'Outlaw territory. This is where treasures are found.' } },
    { tint: '255,120,140', duration: 70, spawnMin: 0.48, spawnMax: 0.82, speed: 0.65, doubles: 0.65, heavies: 0.12, lines: 0.00, colors: 0.00, frags: 0.18, track: 2, bursts: true,
      hint: 'undertow — the fastest water on the dead reach',
      bands: [{ t0: 14, t1: 34, intensity: 1.8 }, { t0: 46, t1: 64, intensity: 2.3 }],
      story: { line: 'She has flown this route before. Alone.' } },
    { tint: '210,140,255', duration: 75, spawnMin: 0.54, spawnMax: 0.88, speed: 0.62, doubles: 0.50, heavies: 0.22, lines: 0.26, colors: 0.32, frags: 0.20, walls: 0.18, track: 0, bursts: true,
      hint: 'the narrows: every trick on the reach, then open water',
      beats: [{ t: 31, kind: 'wall' }, { t: 44, kind: 'wall' }, { t: 62, kind: 'strip' }],
      bands: [{ t0: 34, t1: 48, intensity: 1.9 }, { t0: 58, t1: 72, intensity: 2.1 }],
      story: { line: 'This planet looks barren, I guess we\'ll find out...' } },
    { tint: '255,230,120', duration: 50, spawnMin: 0.80, spawnMax: 1.40, speed: 0.55, doubles: 0.35, heavies: 0.18, lines: 0.20, colors: 0.30, frags: 0.14, walls: 0.10, track: 1, boss: true, bossKind: 'prism',
      hint: 'THE PRISM splits the light — two beams, one each. charge in the calms',
      story: { line: 'Asteroid belts are usually a trap, bring your A game!' } }
  ],
  verdict: { title: 'CONTRACT 03 — CLEARED', art: 'collector-closure.webp',
    // the closure disc reads `line`; `lines` keeps the authored epilogue
    //
    // REWRITTEN WITH THE ART. This used to end 'We still do not know what we escorted',
    // which the closure disc now flatly contradicts — the picture is the stone on a
    // plinth under the dome. The beat is kept and turned into the reveal: we never knew
    // during the run, and the last thing we see is what it was. The trader stays SHE —
    // all five of the campaign's story lines write Vess Andarr that way.
    line: '"Good job Vanguard! Now... let\'s plot a course back!"', lines: [
    'She never told us what was in the hold.', 'It stands on a plinth under her dome now,', 'lit for anyone who cares to look:', 'the rarest stone in the known galaxy.'] } },
{
  id: 'patrol', format: 1,
  title: 'THE PATROL', tagline: 'NAVY FLOTILLA · TIER 4 → 5', difficulty: 4,
  client: 'Flotilla Command', tiers: [4, 5], art: 'patrol.webp',
  story: 'A navy flotilla running dark along the outer rings — and running dark means no active sweep, which means you are their sweep. Tier 4 and the near edge of no man’s land, where lanes stop being charted and start being claimed.',
  map: { theme: 'chart' },
  speakers: [
    { id: 'FLOT', name: 'Flotilla Command', color: '111,227,255' },
    { id: 'CMD',  name: 'Lane Command', color: '235,245,255' },
    { id: 'WARD', name: 'the interdiction', color: '212,101,255' }
  ],
  levels: [
    { tint: '255,190,90', duration: 45, spawnMin: 0.90, spawnMax: 1.45, speed: 0.52, doubles: 0.35, heavies: 0.12, lines: 0.10, colors: 0.35, frags: 0.10, track: 0,
      hint: 'the cargo is BAIT now — dress it in his phases, make him bite',
      // the campaign's thesis, authored: one blue bait, one white, early and
      // unmistakable — the random flood picks up from there
      beats: [{ t: 12, kind: 'enemy', type: 'lock0' }, { t: 15, kind: 'enemy', type: 'lock1' }],
      story: { line: 'Flotilla running dark. We are their sweep.' } },
    { tint: '126,200,110', duration: 50, spawnMin: 0.80, spawnMax: 1.32, speed: 0.55, doubles: 0.40, heavies: 0.14, lines: 0.12, colors: 0.45, frags: 0.12, track: 1,
      hint: 'match the bait to the mark — wrong phase, no bite',
      bands: [{ t0: 26, t1: 44, intensity: 1.5 }],
      story: { line: 'No active scan. Make sure nothing collapses our warp.' } },
    { tint: '90,200,235', duration: 55, spawnMin: 0.70, spawnMax: 1.18, speed: 0.58, doubles: 0.45, heavies: 0.14, lines: 0.14, colors: 0.50, frags: 0.12, walls: 0.06, track: 2, bursts: true,
      hint: 'the bite comes in volleys now — hold your phases steady',
      bands: [{ t0: 18, t1: 36, intensity: 1.6 }],
      beats: [{ t: 30, kind: 'strip' }],
      story: { line: 'Patrol point Charlie, stay alert!' } },
    { tint: '255,150,70', duration: 60, spawnMin: 0.62, spawnMax: 1.05, speed: 0.60, doubles: 0.50, heavies: 0.16, lines: 0.16, colors: 0.45, frags: 0.14, walls: 0.08, track: 0, bursts: true,
      hint: 'blood in the water — the whole pack answers at once',
      bands: [{ t0: 22, t1: 40, intensity: 1.7, mix: { colors: 0.6 } }],
      beats: [{ t: 20, kind: 'pickup', type: 'shield' }], // armour handed over as the water reddens
      story: { line: 'Edge of the charted lanes. Check for pirate activity.' } },
    { tint: '120,160,255', duration: 60, spawnMin: 0.56, spawnMax: 0.96, speed: 0.63, doubles: 0.50, heavies: 0.18, lines: 0.18, colors: 0.50, frags: 0.16, walls: 0.10, track: 1,
      hint: 'follow the bite home — phase-locked traffic all the way down',
      bands: [{ t0: 28, t1: 48, intensity: 1.7 }],
      story: { line: 'Federation law doesn\'t apply here, weapons hot!' } },
    { tint: '255,205,90', duration: 65, spawnMin: 0.52, spawnMax: 0.90, speed: 0.65, doubles: 0.55, heavies: 0.18, lines: 0.20, colors: 0.55, frags: 0.18, walls: 0.12, track: 2, bursts: true,
      hint: 'the nest — every phase at once, and it is awake',
      bands: [{ t0: 20, t1: 38, intensity: 1.8 }, { t0: 50, t1: 63, intensity: 2.0, mix: { colors: 0.65 } }],
      beats: [{ t: 44, kind: 'enemy', type: 'heavy' }, { t: 48, kind: 'pickup', type: 'shield' }],
      story: { line: 'Our lanes are being targeted, tracing...' } },
    { tint: '255,90,110', duration: 70, spawnMin: 0.48, spawnMax: 0.82, speed: 0.68, doubles: 0.58, heavies: 0.22, lines: 0.22, colors: 0.50, frags: 0.20, walls: 0.15, track: 0, bursts: true,
      hint: 'he has committed everything — this is the whole swarm',
      bands: [{ t0: 16, t1: 36, intensity: 1.9 }, { t0: 50, t1: 68, intensity: 2.1, mix: { colors: 0.6, doubles: 0.65 } }],
      // the eye of it: three still seconds after the first wave breaks, a health
      // cell before the second — the swarm's last act should be beatable hurt
      beats: [{ t: 40, kind: 'lull', dur: 3 }, { t: 47, kind: 'pickup', type: 'health' }],
      story: { line: 'Use the star\'s energy to burn our stalkers.' } },
    { tint: '212,120,255', duration: 50, spawnMin: 0.72, spawnMax: 1.28, speed: 0.60, doubles: 0.45, heavies: 0.20, lines: 0.18, colors: 0.40, frags: 0.16, walls: 0.10, track: 1, boss: true, bossKind: 'mimic',
      hint: 'THE MIMIC — its lamp picks your pulse. wrong colour feeds nothing',
      story: { line: 'Found them! Warping to ambush location, keep us safe.' } }
  ],
  verdict: { title: 'CONTRACT 04 — RELIEVED', art: 'patrol-closure.webp',
    // the closure disc reads `line`; `lines` keeps the authored epilogue
    line: 'Threat neutralized! Good job Vanguard!', lines: [
    'The flotilla held its patrol and never', 'lit a single active scan. Whatever was', 'waiting on that picket met us first,', 'which was the entire point of hiring us.'] } },
{
  id: 'delegation', format: 1,
  title: 'THE DELEGATION', tagline: 'FEDERATION PRESIDENT · TIER 1 → 5', difficulty: 5,
  client: 'Federation Delegation', tiers: [1, 5], art: 'delegation.webp',
  story: 'The Federation president, in the open, crossing every cordon there is to sign another species into the accession. Tier 1 to tier 5 with the route filed in advance, because a state visit cannot be flown in secret. Everything that does not want that signature knows exactly where she will be.',
  map: { theme: 'chart' },
  speakers: [
    { id: 'DELG', name: 'Federation Delegation', color: '111,227,255' },
    { id: 'CMD',  name: 'Lane Command', color: '235,245,255' },
    { id: 'WARD', name: 'the interdiction', color: '212,101,255' }
  ],
  levels: [
    { tint: '96,180,255', duration: 50, spawnMin: 0.72, spawnMax: 1.20, speed: 0.58, doubles: 0.50, heavies: 0.15, lines: 0.20, colors: 0.30, frags: 0.15, walls: 0.10, track: 0,
      hint: 'you escort the antidote now — get it into his lane and hold on',
      story: { line: 'The minister of Xeno Relations, in the open.' } },
    { tint: '255,160,80', duration: 55, spawnMin: 0.60, spawnMax: 1.02, speed: 0.63, doubles: 0.55, heavies: 0.16, lines: 0.22, colors: 0.32, frags: 0.16, walls: 0.12, track: 1, bursts: true,
      hint: 'his outer cordon throws everything — do not slow the convoy',
      bands: [{ t0: 18, t1: 36, intensity: 1.7 }],
      story: { line: 'A state visit cannot be flown in secret.' } },
    { tint: '120,230,190', duration: 60, spawnMin: 0.54, spawnMax: 0.92, speed: 0.66, doubles: 0.55, heavies: 0.18, lines: 0.26, colors: 0.35, frags: 0.18, walls: 0.18, track: 2,
      hint: 'walls stacked on walls — thread the convoy through, do not clip it',
      beats: [{ t: 20, kind: 'wall' }, { t: 40, kind: 'wall' }, { t: 50, kind: 'strip' }],
      bands: [{ t0: 28, t1: 48, intensity: 1.7 }],
      story: { line: 'Everyone who objects knows exactly where we are.' } },
    { tint: '255,205,90', duration: 60, spawnMin: 0.50, spawnMax: 0.86, speed: 0.69, doubles: 0.60, heavies: 0.20, lines: 0.24, colors: 0.38, frags: 0.20, walls: 0.16, track: 0, bursts: true,
      hint: 'pure panic traffic — become the pace or drown in it',
      bands: [{ t0: 14, t1: 32, intensity: 1.9 }, { t0: 42, t1: 58, intensity: 2.1, mix: { doubles: 0.7 } }],
      story: { line: 'The escort is already thinner than it should be.' } },
    { tint: '150,120,255', duration: 65, spawnMin: 0.46, spawnMax: 0.80, speed: 0.72, doubles: 0.60, heavies: 0.20, lines: 0.28, colors: 0.40, frags: 0.22, walls: 0.20, track: 1, bursts: true,
      hint: 'he seals every gate — keyed, walled, doubled. read fast',
      bands: [{ t0: 20, t1: 40, intensity: 1.9 }, { t0: 50, t1: 63, intensity: 2.2, mix: { colors: 0.55 } }],
      beats: [{ t: 34, kind: 'wall' }, { t: 48, kind: 'wall' }],
      story: { line: 'Deep space. Half the objections come from inside the Federation.' } },
    { tint: '255,90,110', duration: 70, spawnMin: 0.44, spawnMax: 0.76, speed: 0.75, doubles: 0.62, heavies: 0.22, lines: 0.26, colors: 0.42, frags: 0.22, walls: 0.20, track: 2, bursts: true,
      hint: 'the fastest water on any lane — do not fight it, ride it',
      bands: [{ t0: 16, t1: 36, intensity: 2.0 }, { t0: 48, t1: 68, intensity: 2.2, mix: { doubles: 0.7, colors: 0.55 } }],
      story: { line: 'Outlaw territory. We must move fast or it\'s over.' } },
    { tint: '255,70,160', duration: 75, spawnMin: 0.42, spawnMax: 0.72, speed: 0.78, doubles: 0.65, heavies: 0.25, lines: 0.28, colors: 0.45, frags: 0.25, walls: 0.22, track: 0, bursts: true,
      hint: 'everything he has, all at once, at full speed — the last door',
      bands: [{ t0: 18, t1: 38, intensity: 2.0 }, { t0: 52, t1: 72, intensity: 2.3, mix: { colors: 0.6, doubles: 0.72 } }],
      beats: [{ t: 31, kind: 'wall' }, { t: 62, kind: 'wall' }],
      story: { line: 'No man’s land. Our destination world is on the far side.' } },
    { tint: '212,101,255', duration: 55, spawnMin: 0.68, spawnMax: 1.22, speed: 0.66, doubles: 0.50, heavies: 0.22, lines: 0.20, colors: 0.40, frags: 0.20, walls: 0.14, track: 1, boss: true, bossKind: 'blockade',
      hint: 'THE BLOCKADE — every pattern he owns, nine pulses through it',
      story: { line: 'Last lane. The future of the galaxy depends on it!' } }
  ],
  verdict: { title: 'CONTRACT 05 — SIGNED', art: 'delegation-closure.webp',
    // the closure disc reads `line`; `lines` keeps the authored epilogue
    line: 'First Contact! This is a new dawn for humankind!', lines: [
    'She crossed all five cordons and put', 'her name on it. The lane behind her was', 'the most contested stretch of space', 'anyone has flown this decade.'] } }];
