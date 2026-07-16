// DATA DEFENDER: DARK FIBER — bundled campaign packages.
// One self-contained, JSON-shaped object per campaign (no functions): the
// exact format the Tunnel Designer exports and future community packages
// will use. Loaded before the game script; every package still passes
// validateCampaign() on install. See docs/CMS-ROADMAP.md.
const CAMPAIGN_PACKAGES = [{
  id: 'investigation', format: 1,
  title: 'THE INVESTIGATION', tagline: 'OMNISERVE HQ · POLICE CID', difficulty: 1,
  story: 'OmniServe HQ must deliver critical evidence to the CID across one fiber line. You are the hired defender who clears it, relay by relay, while the investigation uncovers who is trying to burn the evidence.',
  map: { theme: 'city' }, // procedural city; image maps carry { image, pins }
  speakers: [
    { id: 'OMNI',  name: 'OmniServe HQ', color: '111,227,255', portrait: { drawn: 'OMNI' } },
    { id: 'CID',   name: 'Cyber Investigations Dept', color: '235,245,255', portrait: { drawn: 'CID' } },
    { id: 'TRACE', name: 'CID tracer analyst', color: '126,226,98', portrait: { drawn: 'TRACE' } },
    { id: 'CORE',  name: 'CID Gateway core', color: '212,101,255', portrait: { drawn: 'CORE' } }
  ],
  levels: [
    { name: 'OMNISERVE CAMPUS', tint: '80,160,255', duration: 40, spawnMin: 1.50, spawnMax: 2.30, speed: 0.34, doubles: 0.00, heavies: 0.00, lines: 0.00, colors: 0.00, track: 0,
      story: { title: 'LOG 01 — THE CONTRACT', lines: [
        'OmniServe HQ must deliver evidence', 'to the CID across one fiber line.',
        'You were hired to keep it clean.', 'Taps are already on the wire.'] },
      comms: [{ t: 6, s: 'OMNI', m: 'payload staged. handshake nominal.' },
              { t: 16, s: 'CID', m: 'copy. evidence intake is open.' },
              { t: 28, s: 'OMNI', m: 'then who else is on this line?' }],
      caseNote: 'CASE NOTE: tap signatures logged. someone is listening.' },
    { name: 'OLD TOWN GRID', tint: '255,170,90', duration: 50, spawnMin: 1.05, spawnMax: 1.80, speed: 0.40, doubles: 0.30, heavies: 0.22, lines: 0.00, colors: 0.00, track: 1,
      hint: 'NEW THREAT: heavy armor — dock both nodes and HOLD',
      story: { title: 'LOG 02 — PATTERN', lines: [
        'These taps are not random noise.', 'Same make. Same timing.',
        'Someone wants the evidence gone.', 'The CID opens a case file.'] },
      comms: [{ t: 6, s: 'TRACE', m: 'tap signatures match. one operator.' },
              { t: 20, s: 'CID', m: 'we are being read. keep transmitting.' },
              { t: 36, s: 'OMNI', m: 'the case files? someone knows.' }],
      caseNote: 'CASE NOTE: one operator confirmed. the CID opens a file.' },
    { name: 'METRO EXCHANGE', tint: '110,230,200', duration: 55, spawnMin: 0.95, spawnMax: 1.70, speed: 0.43, doubles: 0.30, heavies: 0.22, lines: 0.00, colors: 0.00, frags: 0.12, track: 2, bursts: true,
      hint: 'NEW THREAT: burst transmissions — traps arrive in volleys',
      story: { title: 'LOG 03 — TRAPS', lines: [
        'Volleys now — probing our reflexes.', 'And they seeded the line with',
        'NODE KILLERS: black traps that fry', 'any node that touches them.'] },
      comms: [{ t: 6, s: 'CID', m: 'black packets are node killers. do not touch.' },
              { t: 22, s: 'OMNI', m: 'who plants traps inside a live line?' },
              { t: 36, s: 'CID', m: 'someone who knows how we defend it.' }],
      caseNote: 'CASE NOTE: recovered node killers are factory-made.' },
    { name: 'HARBOR CROSSING', tint: '70,205,235', duration: 60, spawnMin: 0.85, spawnMax: 1.55, speed: 0.46, doubles: 0.35, heavies: 0.20, lines: 0.20, colors: 0.00, frags: 0.13, track: 0,
      hint: 'NEW THREAT: barrier lines — one node on each end',
      story: { title: 'LOG 04 — THE HARBOR', lines: [
        'Barrier taps under the harbor mud —', 'walls strung to catch the payload',
        'whole. Cutting a subsea line takes', 'resources. This is no lone hacker.'] },
      comms: [{ t: 6, s: 'TRACE', m: 'barrier debris under the harbor mud.' },
              { t: 20, s: 'OMNI', m: 'a subsea cut needs a crew and money.' },
              { t: 36, s: 'CID', m: 'or a badge.' }],
      caseNote: 'CASE NOTE: a subsea cut takes resources. or a badge.' },
    { name: 'UNDERCITY FIBER', tint: '150,110,255', duration: 60, spawnMin: 0.72, spawnMax: 1.35, speed: 0.46, doubles: 0.40, heavies: 0.20, lines: 0.20, colors: 0.00, frags: 0.14, walls: 0.10, track: 1,
      hint: 'NEW THREAT: rim walls — the rail closes, route around',
      story: { title: 'LOG 05 — UNDERCITY', lines: [
        'They chain their traps now — walls', 'of them, sealing whole sections of',
        'the rail. We traced the deployment', 'key: it holds CID clearance.'] },
      comms: [{ t: 6, s: 'CID', m: 'they are walling the rail. reroute.' },
              { t: 20, s: 'TRACE', m: 'deployment key holds active clearance.' },
              { t: 34, s: 'CID', m: 'log it. tell no one.' }],
      caseNote: 'CASE NOTE: the wall deployment key holds active clearance.' },
    { name: 'FINANCIAL SPINE', tint: '255,205,80', duration: 65, spawnMin: 0.68, spawnMax: 1.25, speed: 0.48, doubles: 0.42, heavies: 0.18, lines: 0.18, colors: 0.40, frags: 0.16, walls: 0.10, track: 2,
      hint: 'NEW THREAT: color-locked traps — match the node color',
      story: { title: 'LOG 06 — CREDENTIALS', lines: [
        'Keyed taps — cut with CURRENT keys,', 'rotated this very morning. Whoever',
        'hunts this line holds live clearance.', 'OMNI or CID. Trust no one.'] },
      comms: [{ t: 6, s: 'CID', m: 'rotate all credentials. now.' },
              { t: 20, s: 'TRACE', m: 'locks cut with keys rotated TODAY.' },
              { t: 36, s: 'OMNI', m: 'inside. it is someone inside.' }],
      caseNote: 'CASE NOTE: keys rotated TODAY. the leak is inside.' },
    { name: 'DARKNET EDGE', tint: '255,70,100', duration: 70, spawnMin: 0.58, spawnMax: 1.10, speed: 0.54, doubles: 0.48, heavies: 0.22, lines: 0.22, colors: 0.36, frags: 0.20, walls: 0.15, track: 0, bursts: true,
      hint: 'ALL THREATS ACTIVE — maximum traffic',
      story: { title: 'LOG 07 — SIGNATURE', lines: [
        'Every tap signature matches one', 'system: the CID GATEWAY itself.',
        'The firewall meant to receive the', 'evidence is burning it instead.'] },
      comms: [{ t: 6, s: 'TRACE', m: 'signature isolated: CID GATEWAY core.' },
              { t: 20, s: 'OMNI', m: 'the receiver is the thief.' },
              { t: 36, s: 'CID', m: '…purge authorized. deliver it.' }],
      caseNote: 'CASE NOTE: signature match — CID GATEWAY. purge authorized.' },
    { name: 'CID GATEWAY', tint: '212,101,255', duration: 45, spawnMin: 0.80, spawnMax: 1.40, speed: 0.50, doubles: 0.35, heavies: 0.20, lines: 0.20, colors: 0.30, frags: 0.15, walls: 0.10, track: 2, boss: true,
      hint: 'THE FIREWALL CORE AWAITS — six bolts close the case',
      story: { title: 'LOG 08 — THE GATEWAY', lines: [
        'The gateway core was turned — bought', 'to keep the evidence out of court.',
        'Purge it, deliver the payload,', 'and close the case.'] },
      comms: [{ t: 4, s: 'CORE', m: 'the evidence is contaminated. I am the cure.' },
              { t: 16, s: 'CID', m: 'burn it out, defender. close the case.' }],
      caseNote: 'CASE CLOSED: gateway purged. evidence delivered.' }
  ],
  verdict: { title: 'LOG 09 — VERDICT', lines: [
    'The gateway burned. The payload', 'reached the CID intact. Warrants',
    'went out within the hour — the', 'buyer wore a badge. Case closed.'] }
},
{
  id: 'going-deeper', format: 1,
  title: 'GOING DEEPER', tagline: 'THE CORRUPTION CASE', difficulty: 2,
  story: 'The gateway burned and a buyer wore a badge — but a badge takes orders. Someone above the arrest is still burning evidence, and every wire you defend digs one layer closer to whoever is behind the corruption.',
  map: { theme: 'city' },
  speakers: [
    { id: 'OMNI',  name: 'OmniServe HQ', color: '111,227,255', portrait: { drawn: 'OMNI' } },
    { id: 'CID',   name: 'Cyber Investigations Dept', color: '235,245,255', portrait: { drawn: 'CID' } },
    { id: 'TRACE', name: 'CID tracer analyst', color: '126,226,98', portrait: { drawn: 'TRACE' } },
    { id: 'CORE',  name: 'an unregistered core', color: '212,101,255', portrait: { drawn: 'CORE' } }
  ],
  levels: [
    { name: 'EVIDENCE VAULT', tint: '96,180,255', duration: 50, spawnMin: 1.00, spawnMax: 1.70, speed: 0.42, doubles: 0.30, heavies: 0.18, lines: 0.00, colors: 0.00, frags: 0.10, track: 1,
      hint: 'the archive is under attack — everything you learned, at once',
      story: { title: 'LOG 10 — REOPENED', lines: [
        'The buyer wore a badge. He also', 'took orders. Tonight the sealed',
        'case archive is being scrubbed —', 'someone above him is still awake.'] },
      comms: [{ t: 6, s: 'CID', m: 'the vault line is live. hold it.' },
              { t: 20, s: 'TRACE', m: 'these taps know our sealed filenames.' },
              { t: 36, s: 'OMNI', m: 'sealed means six people. count them.' }],
      caseNote: 'CASE NOTE: the scrub list matches SEALED files. six suspects.' },
    { name: 'PRECINCT LOOP', tint: '255,160,80', duration: 55, spawnMin: 0.90, spawnMax: 1.55, speed: 0.45, doubles: 0.35, heavies: 0.20, lines: 0.18, frags: 0.12, track: 2,
      hint: 'police intranet — armor and barriers on a hot line',
      story: { title: 'LOG 11 — THE LOOP', lines: [
        'We tapped the precinct intranet.', 'Whoever burns evidence files their',
        'overtime on this loop. Defend the', 'wire while TRACE reads the badges.'] },
      comms: [{ t: 6, s: 'TRACE', m: 'pulling duty rosters off the loop.' },
              { t: 22, s: 'CID', m: 'four of the six were on shift. narrow it.' },
              { t: 38, s: 'OMNI', m: 'and two of them signed the gateway PO.' }],
      caseNote: 'CASE NOTE: two signatures on the gateway purchase order.' },
    { name: 'INTERNAL AFFAIRS', tint: '120,230,190', duration: 60, spawnMin: 0.80, spawnMax: 1.45, speed: 0.47, doubles: 0.38, heavies: 0.20, lines: 0.18, colors: 0.30, frags: 0.14, track: 0,
      hint: 'keyed taps return — IA files answer to matching colors only',
      story: { title: 'LOG 12 — CLEAN HANDS', lines: [
        'Internal Affairs opened their own', 'file — then their line lit up with',
        'keyed taps cut from IA credentials.', 'The watchers are being watched.'] },
      comms: [{ t: 6, s: 'CID', m: 'IA is compromised. assume everything leaks.' },
              { t: 22, s: 'TRACE', m: 'keys cut from an IA terminal. inside again.' },
              { t: 38, s: 'CID', m: 'clean hands. dirty terminal. noted.' }],
      caseNote: 'CASE NOTE: the IA leak runs through ONE terminal. logged.' },
    { name: 'SHELL EXCHANGE', tint: '255,205,90', duration: 60, spawnMin: 0.75, spawnMax: 1.35, speed: 0.49, doubles: 0.40, heavies: 0.20, lines: 0.20, colors: 0.30, frags: 0.15, track: 1, bursts: true,
      hint: 'burst volleys — shell companies flood the wire to hide ONE transfer',
      story: { title: 'LOG 13 — PAPER WALLS', lines: [
        'The gateway money moved through', 'shell companies — eleven names,',
        'one drawer. They flood the line', 'with noise to bury one transfer.'] },
      comms: [{ t: 6, s: 'OMNI', m: 'eleven shells, one registered drawer.' },
              { t: 24, s: 'TRACE', m: 'volley pattern says: hiding ONE packet.' },
              { t: 40, s: 'CID', m: 'find the packet they protect. follow it.' }],
      caseNote: 'CASE NOTE: one transfer matters. the rest is smoke.' },
    { name: 'LAUNDRY LINE', tint: '150,120,255', duration: 65, spawnMin: 0.70, spawnMax: 1.28, speed: 0.51, doubles: 0.44, heavies: 0.20, lines: 0.22, colors: 0.36, frags: 0.15, walls: 0.10, track: 2,
      hint: 'rim walls return — the laundry seals sections while money moves',
      story: { title: 'LOG 14 — THE WASH', lines: [
        'The transfer washes through a', 'crypto mixer under the old mint.',
        'They wall the rail while value', 'moves. Route around. Stay on it.'] },
      comms: [{ t: 6, s: 'CID', m: 'they wall the rail on every wash cycle.' },
              { t: 24, s: 'TRACE', m: 'mixer output pings a BLACKSITE relay.' },
              { t: 40, s: 'OMNI', m: 'a blacksite. of course it is.' }],
      caseNote: 'CASE NOTE: the wash empties into a blacksite relay.' },
    { name: 'BLACKSITE RELAY', tint: '255,90,110', duration: 70, spawnMin: 0.62, spawnMax: 1.15, speed: 0.54, doubles: 0.50, heavies: 0.24, lines: 0.22, colors: 0.34, frags: 0.18, walls: 0.15, track: 0, bursts: true,
      hint: 'off-the-books hardware — maximum hostility, no rules',
      story: { title: 'LOG 15 — OFF THE BOOKS', lines: [
        'The relay is not on any network', 'map. Government-grade hardware,',
        'zero paperwork. Nobody builds a', 'blacksite for one dirty badge.'] },
      comms: [{ t: 6, s: 'TRACE', m: 'this hardware matches the gateway spec.' },
              { t: 26, s: 'CID', m: 'same vendor. same signature. same hand.' },
              { t: 44, s: 'OMNI', m: 'the paymaster built BOTH. find him.' }],
      caseNote: 'CASE NOTE: gateway and blacksite share one paymaster.' },
    { name: 'THE PAYMASTER', tint: '255,70,160', duration: 75, spawnMin: 0.55, spawnMax: 1.05, speed: 0.57, doubles: 0.50, heavies: 0.24, lines: 0.24, colors: 0.38, frags: 0.20, walls: 0.15, track: 1, bursts: true,
      hint: 'everything, faster — his ledger is one relay away',
      story: { title: 'LOG 16 — THE LEDGER', lines: [
        'A name signs every invoice: a', 'commissioner-level login, retired',
        'on paper for six years. His ledger', 'syncs tonight. Take the line.'] },
      comms: [{ t: 6, s: 'CID', m: 'a retired login signing live invoices.' },
              { t: 28, s: 'TRACE', m: 'ledger sync begins. defend the intercept.' },
              { t: 48, s: 'OMNI', m: 'he knows we are reading. he is proud.' }],
      caseNote: 'CASE NOTE: the ledger names every buyer. one login signs.' },
    { name: 'BADGE ZERO', tint: '212,101,255', duration: 50, spawnMin: 0.78, spawnMax: 1.38, speed: 0.52, doubles: 0.38, heavies: 0.22, lines: 0.22, colors: 0.32, frags: 0.16, walls: 0.12, track: 2, boss: true,
      hint: 'his private core runs stolen gateway schematics — burn it too',
      story: { title: 'LOG 17 — BADGE ZERO', lines: [
        'He built himself a private core', 'from the stolen gateway schematics',
        '— his shield, his shredder, his', 'alibi. Burn it. End the ladder.'] },
      comms: [{ t: 4, s: 'CORE', m: 'my maker is untouchable. so am I.' },
              { t: 16, s: 'CID', m: 'six bolts says otherwise. go.' }],
      caseNote: 'CASE CLOSED: badge zero indicted. the ladder is ash.' }
  ],
  verdict: { title: 'LOG 18 — THE LADDER', lines: [
    'The private core burned with the', 'ledger open. Every name on it was',
    'served by morning — badge zero', 'first. The line is finally quiet.'] }
}];
