#!/usr/bin/env node
// Regenerates docs/lab/seed.json — the pristine starting state for the story lab.
// The lab NEVER overwrites docs/lab/story.json (the working copy); it only seeds
// it on first run. Re-run this when the act structure changes, then delete
// story.json to take the new seed.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

// --- tuning facts, read straight from the shipped campaigns -----------------
// The story is fitted to the curve that already works, so the lab shows the
// author what each mission has to introduce while they write it.
const raw = fs.readFileSync(path.join(root, 'src', 'campaigns.js'), 'utf8')
  .replace('const CAMPAIGN_PACKAGES =', 'module.exports =');
const tmp = path.join(require('os').tmpdir(), 'dd-camps-' + process.pid + '.js');
fs.writeFileSync(tmp, raw);
const PACKAGES = require(tmp);
fs.unlinkSync(tmp);

const LABEL = {
  doubles: 'doubles', heavies: 'heavy armor', lines: 'barrier lines',
  colors: 'color-locked taps', frags: 'node killers', walls: 'rim walls'
};
const RATE_KEYS = Object.keys(LABEL);

function tuning(pkg) {
  const seen = {};
  return pkg.levels.map((l, i) => {
    const fresh = RATE_KEYS.filter(k => (l[k] || 0) > 0 && !(seen[k] > 0)).map(k => LABEL[k]);
    RATE_KEYS.forEach(k => { if ((l[k] || 0) > 0) seen[k] = l[k]; });
    if (l.bursts && !seen.bursts) { fresh.push('burst volleys'); seen.bursts = 1; }
    return {
      n: i + 1,
      duration: l.duration,
      speed: l.speed,
      introduces: fresh,
      boss: l.boss ? (l.bossKind || 'core') : null
    };
  });
}

// --- the story ------------------------------------------------------------
// Act premise + outline come from docs/SCREENPLAY.md. Mission beats are a
// FIRST-PASS spread — drafts to argue with, not decisions.
const ACTS = [
  {
    id: 'act1', act: 'ACT I', title: 'THE CONTRACT', pkg: 'investigation',
    premise: 'A new operator is screened across three ordinary contracts, told why, and handed a delivery that matters. The file arrives — and so does a commander with no case number.',
    outline: 'You are newly certified — no service record, no precinct friends, no debts to anyone in Meridian. Every one of those is a hole in your résumé and every one of them is why you get chosen.\n\nThree contracts for OmniServe, each planting one detail that only makes sense later: the fee clears before you file, he rebooks inside the hour and asks nothing, and clause 6 forbids you to discuss the run with anyone including Data Defenders.\n\nThe offer: Renke tells you certain customer streams have been hit for months — patient, professional, always the same kind of cargo. Not theft. Suppression. He built a file proving it and every attempt to deliver it has been attacked in transit. You were not hired. You were chosen.\n\nThe delivery lands, Reyes opens the channel and names you RUNNER without explaining. The operation begins: staged traffic, clean interceptions, recovered keys — and the keys turn out to be current.\n\nThe answer: Renke’s file was never lost. It arrived four times and was destroyed at the door by something resident in the CID’s own evidence intake.\n\n(The qualification run is NOT one of these eight — it is the separate TUTORIAL mode on the carousel.)',
    verdict: { name: 'THE WARDEN', beat: 'The intake is clean, the file is safe, the case can finally move. Nobody builds a thing like that for one file.' },
    missions: [
      { name: 'CAMPUS OUTBOUND', beat: 'First contract, taken because it is work. Routine outbound stream, ordinary taps. PLANT 1: the fee clears before you file.' },
      { name: 'OLD TOWN RELAY', beat: 'Rebooked inside the hour. He asks nothing at all about what was on the line. PLANT 2. The taps have gotten serious.' },
      { name: 'METRO EXCHANGE', beat: 'PLANT 3: clause 6. Volleys placed like something has watched an operator work. → THE OFFER: you were chosen.' },
      { name: 'HARBOR CROSSING', beat: 'The delivery run. Barriers strung to catch the file whole. → THE CONTACT. Reyes: "You’re RUNNER."' },
      { name: 'UNDERCITY FIBER', beat: 'First staged stream. TRACE pulls a deployment key off the wreckage — it holds ACTIVE clearance. "log it, tell no one."' },
      { name: 'FINANCIAL SPINE', beat: 'Keyed taps. A clean interception yields a working key — cut with credentials rotated this morning. THE SIGNATURES BEGIN.' },
      { name: 'CID APPROACH', beat: 'TRACE isolates it: the file was never lost in transit. It arrived four times and was destroyed at the door.' },
      { name: 'EVIDENCE INTAKE', beat: 'THE WARDEN. Resident in the CID’s own intake, refusing one class of cargo for years. "everything i refused was contaminated. i was the filter."' }
    ]
  },
  {
    id: 'act2', act: 'ACT II', title: 'THE RING', pkg: 'going-deeper',
    premise: 'Wardens are everywhere and were never hidden. The taps are not placed — they are issued, by one dispatcher that signs its work. And somebody owns it.',
    outline: 'Once you know the shape of a warden, TRACE finds more, fast, because they were never hidden. Port authority. The courts. The licensing exchange. Guardians at the junctions that matter, deciding what arrives.\n\nThe signatures give up the rest: taps are dispatched — written, keyed, assigned a lane, deployed. So are the wardens. Six years of it, out of one source, signing itself in a metadata field nobody was meant to read. The Architect.\n\nReyes says the part she has been building to: nobody rents this. Somebody owns it. There is a ring in Meridian — people who know exactly who each other are, in a city that does not know they exist.\n\nAnd it keeps. Intercepted cargo is not destroyed, it is filed. There is an archive.\n\nYou take the Tribunal at the courts junction. The junction is clear for about a day. Then there is another one, cast later, already better.',
    verdict: { name: 'THE TRIBUNAL', beat: 'A day later the junction has another warden, and it is already better. REYES: "We stop chasing wardens. We find the thing that writes them."' },
    missions: [
      { name: 'PORT AUTHORITY', beat: 'Now that you know the shape of a warden, TRACE finds another. It was never hidden — it has been standing there for years.' },
      { name: 'CIVIC RECORDS', beat: 'And another. Meridian has been running on a Grid that answers to somebody else.' },
      { name: 'LICENSING EXCHANGE', beat: 'Keyed taps at every junction. The signatures start matching across attacks with nothing else in common.' },
      { name: 'THE JUNCTIONS', beat: 'They are not placed by hand. They are dispatched — written, keyed, assigned a lane, deployed.' },
      { name: 'DISPATCH LANES', beat: 'One source, six years, and it signs its work. TRACE: "it has a name for itself. the architect."' },
      { name: 'THE OLD BUILD', beat: 'REYES: nobody rents this. Somebody owns it. The Ring — and the Grid was hardened around them so long ago it looks like architecture.' },
      { name: 'COLD STORAGE', beat: 'Intercepted cargo is not destroyed. It is filed. There is an archive, and it is still intact.' },
      { name: 'THE TRIBUNAL', beat: 'Three cores at the courts junction. A newer casting than the intake warden, and it does not make the intake warden’s mistake.' }
    ]
  },
  {
    id: 'act3', act: 'ACT III', title: 'GOING BLIND', pkg: 'signal-lost',
    premise: 'They remove Renke through channels. You lose your eyes, gain a van, and TRACE stops reading and starts planting.',
    outline: 'Renke is called to a hearing — customer traffic routed to an off-book contractor, on his authorization, in his own hand. Suspended, marked for termination, access revoked the same afternoon. He is not hurt. He is removed, correctly, by people who never had to break a law.\n\nReyes will not put you in a safe house and says why. A technical van, and one instruction: stay mobile. From here the game runs out of a rain-streaked box in a parking structure with three faces on a screen — one of them dark.\n\nWithout Renke there is no routing, no transit logs, no legitimate cargo to ride. So TRACE stops reading and starts planting: bait data of exactly the kind the Ring reaches for, seeded on live lines. Crude, unauthorized, and it works enormously — volume is what triangulation needs.\n\nAnd the Ring hunts back, with a warden that guards nothing at all. The Seeker sweeps for the shape of an operator working a line, and it has been looking for you since the harbor crossing.',
    verdict: { name: 'THE SEEKER', beat: 'A standing search order, six years old, never cancelled. Two designations — yours, and BLADE’s. REYES: "…yes. That’s what I meant."' },
    missions: [
      { name: 'DARK ROUTE', beat: 'Renke is suspended pending review. No client, no cover, no routing. Reyes puts you somewhere nobody is looking.' },
      { name: 'PARKING LEVEL 3', beat: 'The van. Stay mobile — never the same lot twice, never a fixed uplink, never a pattern.' },
      { name: 'BAIT LINES', beat: 'TRACE stops reading and starts planting. Bait data on live lines. Renke would have refused to sign it.' },
      { name: 'THE BITE', beat: 'It works enormously. Every bite is a keyed tap on a line the Architect had no reason to watch. The count starts climbing.' },
      { name: 'OPEN SWEEP', beat: 'Something is sweeping. Patiently, endlessly, across every line in Meridian, looking for the shape of an operator.' },
      { name: 'UNDER THE BEAM', beat: 'You cannot hide from it and you cannot outrun it. So you go where it is looking.' },
      { name: 'SEARCH PATTERN', beat: 'It has been looking for you since the harbor crossing. Reyes’s decoys are the only reason it has not closed.' },
      { name: 'THE SEEKER', beat: 'A warden that guards nothing. Ride the beam, survive every sweep, and take what is inside it.' }
    ]
  },
  {
    id: 'act4', act: 'ACT IV', title: 'THE FOUNDRY', pkg: 'the-bait',
    premise: 'Map the Architect’s reach, find the casting line every warden comes from, and write the antidote from its own handwriting.',
    outline: 'You know what it is and roughly where. Now find out what it is made of, because you are not going to fight it — you are going to unwrite it, and TRACE needs to know exactly how it is put together.\n\nReconnaissance at speed, under fire. Dispatch lanes. Deployment schedules. The route a warden takes from written to standing. How far it reaches, which is: everywhere, into every junction in the city, continuously, without anyone having asked it to for years.\n\nMeanwhile the decoys thin, Renke’s review date is set, and TRACE is running staging she is not qualified for. Nobody says the word deadline.\n\nAt the bottom of the reach: not a guard. A casting line — where the Architect writes wardens, tests them against the last thing that killed one, and ships. The least defended thing in the game and the most dangerous, because it is producing while you are inside it.',
    verdict: { name: 'THE ANTIDOTE', beat: 'TRACE writes it from the pattern and four acts of signatures. It does not fight — it unwrites. "i can write it. i can’t take it there."' },
    missions: [
      { name: 'REACH SURVEY', beat: 'Stop chasing and start mapping. How far does the Architect actually go?' },
      { name: 'DISPATCH ORDER', beat: 'The route a tap takes from written to standing. Every one carries where it came from.' },
      { name: 'CASTING SCHEDULE', beat: 'Wardens are not deployed at random. They are scheduled, and the schedule has a shape.' },
      { name: 'EVERY JUNCTION', beat: 'The answer to how far it reaches: everywhere, continuously, and nobody has asked it to for years.' },
      { name: 'THE CLOCK', beat: 'Decoys thinning, review date set, TRACE running staging she is not qualified for. Nobody says deadline.' },
      { name: 'THE UNDERLINE', beat: 'Below the dispatch layer there is an older one, and it goes somewhere that is not on any map.' },
      { name: 'THE MOULD', beat: 'Every warden in Meridian shares a structure, because they were all cast from one thing.' },
      { name: 'THE FOUNDRY', beat: 'The casting line itself — producing while you are inside it. Take it and you take the pattern.' }
    ]
  },
  {
    id: 'act5', act: 'ACT V', title: 'THE ARCHIVE', pkg: 'shutdown',
    premise: 'Carry the antidote into the oldest segment of the Grid, unwrite the Architect, and bring six years of what it kept out whole.',
    outline: 'The last act is the first act inverted. Forty missions protecting other people’s cargo on other people’s lines; now you carry one payload of your own into the deepest, oldest, most defended stretch of fiber in Meridian — laid when the city was planned, never opened to anything since.\n\nRenke comes back for it. Still suspended, still under review, and he does it anyway, because a run into that segment needs OmniServe’s transit fabric and he is the only person alive who knows how it is stitched together.\n\nThe signatures are the door. Their defenses stop pretending: walls folding shut in sequence, a channel screaming with everything thrown blind, deep fiber running hot enough to blur, and one narrow threshold with the whole Grid firing into it.\n\nAnd the Architect talks, because it has never in six years been asked to explain itself.',
    verdict: { name: 'THE ARCHIVE', beat: 'The archive falls open — six years of killed audits and filings that never arrived, each tagged with the order that stopped it. Transfer all of it to Reyes.' },
    missions: [
      { name: 'INJECTION', beat: 'Renke comes back. The antidote goes on the wire, and it only exists once.' },
      { name: 'OUTER SEGMENT', beat: 'The Grid stops pretending. No interception, no subtlety — everything swings to kill.' },
      { name: 'THE DELTA', beat: 'Walls folding shut in sequence, trying to seal the payload into a dead segment.' },
      { name: 'THE SCREAM', beat: 'Everything the Grid owns, thrown blind. This is not defense. This is furniture against a door.' },
      { name: 'LAST RING', beat: 'It falls back and seals the approach — every gate keyed, every lane walled.' },
      { name: 'DEEP FIBER', beat: 'No walls left down here. Just speed, the last thing it has.' },
      { name: 'THE THRESHOLD', beat: 'One narrow gate with the whole city’s infrastructure firing into it.' },
      { name: 'THE ARCHITECT', beat: 'Not a fortress — a clerk with six locks. "you have been arguing with a form." Seat the antidote.' }
    ]
  }
];

// --- assemble --------------------------------------------------------------
const blankDisc = () => ({ title: '', lines: ['', '', '', ''], art: '' });

// levels are numbered continuously across the whole story — act 1 owns 01–08,
// act 2 picks up at 09 (matches how the game presents them)
let missionNo = 0;

const story = {
  version: 1,
  title: 'DATA DEFENDERS — story lab',
  budget: { line: 29, lines: 4, discsMax: 3, name: 28, comm: 64 },

  // The qualification run — its own carousel disc, outside the five acts.
  // Unranked and unfiled (index.html:3684), which is the whole point: it is
  // why the operator has no history, and it gets no LOG number and no case
  // note, because nothing about it is recorded.
  tutorial: {
    name: 'QUALIFICATION',
    beat: 'A closed practice line at Data Defenders. No client, no cargo, no case — and no record. Passing it is what makes you the only operator in Meridian with nothing on file.',
    scene: '',
    discs: [blankDisc()],
    notes: '',
    status: 'empty'
  },
  acts: ACTS.map(a => {
    const t = tuning(PACKAGES.find(p => p.id === a.pkg));
    return {
      id: a.id, act: a.act, title: a.title,
      premise: a.premise,
      outline: a.outline,
      notes: '',
      missions: a.missions.map((m, i) => ({
        n: ++missionNo,
        name: m.name,
        beat: m.beat,
        scene: '',
        discs: [blankDisc()],
        hint: '',
        caseNote: '',
        analysis: '',
        notes: '',
        status: 'empty',
        tuning: { duration: t[i].duration, speed: t[i].speed, introduces: t[i].introduces, boss: t[i].boss }
      })),
      verdict: {
        name: a.verdict.name,
        beat: a.verdict.beat,
        scene: '',
        discs: [blankDisc()],
        notes: '',
        status: 'empty'
      }
    };
  }),
  requests: []
};

const out = path.join(root, 'docs', 'lab', 'seed.json');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(story, null, 2) + '\n');
console.log('wrote ' + path.relative(root, out) + ' — ' + story.acts.length + ' acts, ' +
  story.acts.reduce((n, a) => n + a.missions.length, 0) + ' missions');
