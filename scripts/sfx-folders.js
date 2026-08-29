#!/usr/bin/env node
// Build the candidate drop tree: one folder per replaceable cue under
// src/audio/sfx/incoming/, named for the cue key the soundboard uses.
//
//   npm run sfx:folders
//
// Regenerable and idempotent. The tree comes off scripts/sfx-roster.js, so a cue
// added to the roster gets a folder on the next run and no folder is ever hand
// -named. `keep` and `dead` cues get NO folder on purpose: a keep cue cannot be a
// recording, and a dead cue has no caller to play one.
//
// Each folder holds a `_what.txt` naming the cue, what it says, and the search
// terms to find a take for it. The board never lists that file — the server
// filters the drop zone to audio extensions — so it is purely a note to whoever
// is standing in Finder with a download folder open.
const fs = require('fs');
const path = require('path');
const { SFX_ROSTER, TAKE_ROSTER } = require('./sfx-roster.js');
const { SFX_SEARCH } = require('./sfx-search.js');

const root = path.join(__dirname, '..');
const INBOX = path.join(root, 'src/audio/sfx/incoming');

const wanted = SFX_ROSTER.concat(TAKE_ROSTER)
  .filter(e => e.status === 'live' || e.status === 'fallback' || e.status === 'take');

fs.mkdirSync(INBOX, { recursive: true });
let made = 0, kept = 0;
for (const e of wanted) {
  const dir = path.join(INBOX, e.key);
  if (fs.existsSync(dir)) kept++; else { fs.mkdirSync(dir, { recursive: true }); made++; }
  const s = SFX_SEARCH[e.key] || {};
  const note = [
    'CUE: ' + e.key + '  —  ' + e.label,
    'STATUS: ' + e.status + (e.file ? '   (today: ' + e.file + ' @ ' + e.trim + ')' : ''),
    'FIRES: ' + e.where,
    '',
    e.brief,
    '',
    'LOOK FOR: ' + (s.want || '(no brief written yet)'),
    'LENGTH:   ' + (s.len || '—'),
    'SEARCH:   ' + (s.terms || []).join('  ·  '),
    '',
    'Drop candidates in THIS folder. Any name, .wav/.mp3/.m4a/.ogg.',
    'Then: npm run lab:sound  →  RESCAN  →  this cue lists them  →  SAVE ORDER.'
  ].join('\n') + '\n';
  fs.writeFileSync(path.join(dir, '_what.txt'), note);
}

// prune a folder that no longer matches a roster cue, but ONLY when it is empty
// of audio — never delete a candidate someone put there
const AUDIO = ['.wav', '.mp3', '.m4a', '.ogg'];
let pruned = 0;
for (const name of fs.readdirSync(INBOX)) {
  const dir = path.join(INBOX, name);
  if (!fs.statSync(dir).isDirectory()) continue;
  if (wanted.some(e => e.key === name)) continue;
  const audio = fs.readdirSync(dir).filter(f => AUDIO.includes(path.extname(f).toLowerCase()));
  if (audio.length) { console.log('! kept ' + name + '/ — it still holds ' + audio.length + ' file(s)'); continue; }
  fs.rmSync(dir, { recursive: true, force: true });
  pruned++;
}
console.log('drop tree: ' + wanted.length + ' cue folder(s) — ' + made + ' new, ' + kept + ' already there'
  + (pruned ? ', ' + pruned + ' stale removed' : ''));
console.log('  ' + path.relative(root, INBOX) + '/<cue>/');
