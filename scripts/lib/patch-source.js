'use strict';
// SURGICAL SOURCE EDITING for the tuning tools.
//
// A tuning tool that regenerates a block destroys it. The constants in this
// codebase are half prose: every `*FX` table carries the reasoning for its own
// numbers, and that reasoning is the most valuable thing in the file. So a write
// finds ONE key's literal and swaps ONLY that literal — comments, alignment,
// blank lines and ordering all survive a round-trip untouched.
//
// Lifted out of scripts/dest-lab.js, which proved this approach over many
// sessions of real use; the tuning board now shares the same implementation
// rather than growing a second one that drifts.
const fs = require('fs');

// One literal, formatted the way the source already writes them: numbers keep
// their meaning without trailing float noise, arrays stay on one line.
function lit(v) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return '[' + v.map(lit).join(', ') + ']';
  if (typeof v === 'string') return "'" + v.replace(/'/g, "\\'") + "'";
  if (typeof v === 'number') {
    if (Number.isInteger(v)) return String(v);
    return String(Math.round(v * 1e6) / 1e6);
  }
  return JSON.stringify(v);
}

// The inverse of lit(), for comparing what the source says against what the tool
// holds without caring how the number was typed.
function unlit(text) {
  const t = text.trim();
  if (t === 'null') return 'null';
  if (t[0] === '[') return JSON.stringify(JSON.parse(t));
  if (t[0] === "'") return JSON.stringify(t.slice(1, -1).replace(/\\'/g, "'"));
  return JSON.stringify(Number(t));
}

// `null` is in the alternation because some keys are present but empty (a station
// has no iris) and must still round-trip.
const KEY_VAL = key =>
  new RegExp('(\\b' + key + '\\s*:\\s*)(\\[[^\\]]*\\]|\'[^\']*\'|null|-?\\d*\\.?\\d+)');

// Where a line's code ends and its trailing comment begins. The comments here are
// prose, and prose contains apostrophes and colons that would otherwise read as
// syntax.
function codeEnd(line) {
  let inStr = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inStr) { if (ch === "'" && line[i - 1] !== '\\') inStr = false; continue; }
    if (ch === "'") { inStr = true; continue; }
    if (ch === '/' && line[i + 1] === '/') return i;
  }
  return line.length;
}

// Replace every key of `obj` inside `span`, leaving everything else — comments
// included — untouched. `id` and `n` are identity, never tuning.
function patchSpan(span, obj) {
  const lines = span.split('\n');
  for (const [k, v] of Object.entries(obj)) {
    if (k === 'id' || k === 'n') continue;
    const re = KEY_VAL(k);
    let hit = false;
    for (let i = 0; i < lines.length && !hit; i++) {
      const cut = codeEnd(lines[i]);
      const code = lines[i].slice(0, cut);
      const m = code.match(re);
      if (!m) continue;
      hit = true;
      // A value already equal to what we would write is LEFT ALONE, compared by
      // VALUE not by text, so `1.00` counts as 1 and keeps its alignment.
      // Without this every key is rewritten on every save and the diff fills
      // with lines nobody touched — the fastest way to make a tool untrustworthy.
      if (unlit(m[2]) === JSON.stringify(v)) continue;
      lines[i] = code.replace(re, (_, head) => head + lit(v)) + lines[i].slice(cut);
    }
    if (!hit) throw new Error(`no literal for "${k}" in that block`);
  }
  return lines.join('\n');
}

// The span of a top-level `const NAME = …;`, brace-matched so a nested array
// cannot end it early and comment-blind so prose cannot either.
function constSpan(src, name) {
  const at = src.search(new RegExp('^const ' + name + '\\s*=', 'm'));
  if (at < 0) throw new Error(`no const ${name}`);
  let i = src.indexOf('=', at) + 1, depth = 0, inStr = false;
  for (; i < src.length; i++) {
    const ch = src[i];
    if (inStr) { if (ch === "'" && src[i - 1] !== '\\') inStr = false; continue; }
    if (ch === "'") { inStr = true; continue; }
    if (ch === '/' && src[i + 1] === '/') { const nl = src.indexOf('\n', i); if (nl < 0) break; i = nl; continue; }
    if (ch === '{' || ch === '[') depth++;
    else if (ch === '}' || ch === ']') depth--;
    else if (ch === ';' && depth === 0) return { start: at, end: i + 1 };
  }
  throw new Error(`${name} never terminates`);
}

// A whole-file write: atomic, and it keeps the previous version beside the file.
// Refuses a no-op, because a write that changed nothing means a key silently
// missed its literal and the tool would otherwise claim a save it did not make.
function writeFileAtomic(filePath, next, prev) {
  if (next === prev) throw new Error('nothing changed — the values already match the source');
  fs.copyFileSync(filePath, filePath + '.bak');
  const tmp = filePath + '.tmp';
  fs.writeFileSync(tmp, next);
  fs.renameSync(tmp, filePath); // atomic — a crash mid-write cannot truncate the file
}

// Patch a group of constants in one file.
//   updates: { CONST_NAME: {key: value, …} }  for object consts
//            { CONST_NAME: number|string }    for scalar consts
function patchConsts(filePath, updates) {
  const prev = fs.readFileSync(filePath, 'utf8');
  let src = prev;
  for (const [name, value] of Object.entries(updates)) {
    const span = constSpan(src, name);
    const body = src.slice(span.start, span.end);
    let next;
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      next = patchSpan(body, value);
    } else {
      // scalar: swap the literal that follows the `=`, leaving any comment
      const m = body.match(/^(const\s+\w+\s*=\s*)(\[[^\]]*\]|'[^']*'|null|-?\d*\.?\d+)/);
      if (!m) throw new Error(`${name} is not a simple literal`);
      next = m[1] + lit(value) + body.slice(m[0].length);
    }
    src = src.slice(0, span.start) + next + src.slice(span.end);
  }
  writeFileAtomic(filePath, src, prev);
  return src;
}

module.exports = { lit, unlit, codeEnd, patchSpan, constSpan, patchConsts, writeFileAtomic, KEY_VAL };
