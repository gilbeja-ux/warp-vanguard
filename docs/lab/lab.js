/* Story Lab — collaborative screenplay editor for the campaign rewrite.
   Persists to docs/lab/story.json through scripts/lab.js so Claude can read
   the working copy straight out of the repo. Desktop only, no build step. */
'use strict';

// ---------- tiny DOM helper ----------
function el(tag, props, kids) {
  const n = document.createElement(tag);
  for (const k in (props || {})) {
    const v = props[k];
    if (k === 'class') n.className = v;
    else if (k === 'text') n.textContent = v;
    else if (k === 'html') n.innerHTML = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else if (v !== null && v !== undefined && v !== false) n.setAttribute(k, v);
  }
  (kids || []).forEach(c => c && n.appendChild(c));
  return n;
}
const $ = id => document.getElementById(id);

// ---------- state ----------
let S = null;                                  // the whole story
let sel = { a: 0, kind: 'mission', n: 1 };     // current target
let saveTimer = 0, saving = false, pendingSave = false;

const BUD = () => S.budget || { line: 29, lines: 4, discsMax: 3, name: 28 };

// ---------- persistence ----------
async function load() {
  const r = await fetch('/api/story');
  if (!r.ok) { setSave('error', await r.text()); return; }
  S = await r.json();
  setSave('saved', 'loaded');
  renderRail(); renderPane(); renderAsks();
}

function touch() {
  setSave('saving', 'saving');
  clearTimeout(saveTimer);
  saveTimer = setTimeout(save, 600);
}

async function save() {
  if (saving) { pendingSave = true; return; }
  saving = true;
  try {
    const r = await fetch('/api/story', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(S, null, 2)
    });
    if (!r.ok) throw new Error(await r.text());
    setSave('saved', 'saved ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
  } catch (e) {
    setSave('error', 'save failed — ' + e.message);
  }
  saving = false;
  if (pendingSave) { pendingSave = false; save(); }
}

function setSave(state, txt) {
  $('save').dataset.state = state;
  $('saveTxt').textContent = txt;
}

function toast(msg) {
  const t = $('toast');
  t.textContent = msg; t.classList.add('on');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('on'), 1900);
}

// ---------- targets ----------
function act() { return S.acts[sel.a]; }
function target() {
  const a = act();
  if (sel.kind === 'tutorial') return S.tutorial;
  if (sel.kind === 'act') return a;
  if (sel.kind === 'verdict') return a.verdict;
  return a.missions[sel.n - 1];
}
function targetLabel(ai, kind, n) {
  if (kind === 'tutorial') return 'TUTORIAL — qualification';
  const a = S.acts[ai];
  if (kind === 'act') return a.act + ' — ' + a.title;
  if (kind === 'verdict') return a.act + ' · VERDICT';
  return a.act + ' · MISSION ' + String(a.missions[n - 1].n).padStart(2, '0');
}

// flat walk order for prev/next
function flat() {
  const out = [{ a: 0, kind: 'tutorial', n: 0 }];
  S.acts.forEach((a, ai) => {
    out.push({ a: ai, kind: 'act', n: 0 });
    a.missions.forEach((m, mi) => out.push({ a: ai, kind: 'mission', n: mi + 1 }));
    out.push({ a: ai, kind: 'verdict', n: 0 });
  });
  return out;
}
function step(dir) {
  const f = flat();
  const i = f.findIndex(t => t.a === sel.a && t.kind === sel.kind && (t.kind !== 'mission' || t.n === sel.n));
  const nx = f[Math.max(0, Math.min(f.length - 1, i + dir))];
  if (nx) { sel = nx; renderRail(); renderPane(); document.querySelector('main').scrollTop = 0; }
}

function openAsksFor(ai, kind, n) {
  return (S.requests || []).filter(r => !r.done && r.a === ai && r.kind === kind && (kind !== 'mission' || r.n === n));
}

// ---------- rail ----------
function renderRail() {
  const rail = $('rail');
  rail.textContent = '';

  const tSel = sel.kind === 'tutorial';
  const tAsks = openAsksFor(0, 'tutorial', 0).length;
  rail.appendChild(el('div', { class: 'act' + (tSel ? ' sel' : '') }, [
    el('div', { class: 'rows' }, [
      el('button', {
        class: 'row tut' + (tSel ? ' sel' : ''),
        onclick: () => { sel = { a: 0, kind: 'tutorial', n: 0 }; renderRail(); renderPane(); document.querySelector('main').scrollTop = 0; }
      }, [
        el('span', { class: 'n', text: '\u25b8' }),
        el('span', { class: 'nm' + (S.tutorial.name ? '' : ' unset'), text: S.tutorial.name || 'qualification' }),
        el('span', { class: 'flags' }, [
          tAsks ? el('span', { class: 'ask', text: '\u2733' }) : null,
          el('i', { class: 'st', 'data-s': S.tutorial.status || 'empty' })
        ])
      ])
    ])
  ]));

  S.acts.forEach((a, ai) => {
    const selAct = ai === sel.a;
    const head = el('button', {
      class: 'act-head', onclick: () => { sel = { a: ai, kind: 'act', n: 0 }; renderRail(); renderPane(); }
    }, [
      el('span', { class: 'k', text: a.act }),
      el('span', { class: 't', text: a.title })
    ]);

    const rows = el('div', { class: 'rows' });
    a.missions.forEach((m, mi) => {
      const isSel = selAct && sel.kind === 'mission' && sel.n === mi + 1;
      const asks = openAsksFor(ai, 'mission', mi + 1).length;
      rows.appendChild(el('button', {
        class: 'row' + (isSel ? ' sel' : ''),
        onclick: () => { sel = { a: ai, kind: 'mission', n: mi + 1 }; renderRail(); renderPane(); document.querySelector('main').scrollTop = 0; }
      }, [
        el('span', { class: 'n', text: String(m.n).padStart(2, '0') }),
        el('span', { class: 'nm' + (m.name ? '' : ' unset'), text: m.name || 'untitled' }),
        el('span', { class: 'flags' }, [
          asks ? el('span', { class: 'ask', text: '✳' }) : null,
          el('i', { class: 'st', 'data-s': m.status || 'empty' })
        ])
      ]));
    });

    const vSel = selAct && sel.kind === 'verdict';
    const vAsks = openAsksFor(ai, 'verdict', 0).length;
    rows.appendChild(el('button', {
      class: 'row verdict' + (vSel ? ' sel' : ''),
      onclick: () => { sel = { a: ai, kind: 'verdict', n: 0 }; renderRail(); renderPane(); document.querySelector('main').scrollTop = 0; }
    }, [
      el('span', { class: 'n', text: '✦' }),
      el('span', { class: 'nm' + (a.verdict.name ? '' : ' unset'), text: a.verdict.name || 'verdict' }),
      el('span', { class: 'flags' }, [
        vAsks ? el('span', { class: 'ask', text: '✳' }) : null,
        el('i', { class: 'st', 'data-s': a.verdict.status || 'empty' })
      ])
    ]));

    rail.appendChild(el('div', { class: 'act' + (selAct ? ' sel' : '') }, [head, rows]));
  });
}

// ---------- field builders ----------
function labelled(name, help, node) {
  return el('div', { class: 'field' }, [
    el('div', { class: 'lbl' }, [
      el('span', { text: name }),
      help ? el('span', { class: 'help', text: help }) : null
    ]),
    node
  ]);
}

function textarea(obj, key, cls, ph, after) {
  const t = el('textarea', { class: cls, placeholder: ph || '' });
  t.value = obj[key] || '';
  t.addEventListener('input', () => { obj[key] = t.value; if (after) after(); touch(); });
  return t;
}

function counted(obj, key, budget, ph, cls) {
  const wrap = el('div', { class: 'lrow' });
  const inp = el('input', { class: cls || 'plain', type: 'text', placeholder: ph || '' });
  const cnt = el('span', { class: 'count' });
  inp.value = obj[key] || '';
  const upd = () => {
    const n = inp.value.length;
    cnt.textContent = n + '/' + budget;
    cnt.dataset.over = n > budget ? 'yes' : (n > budget - 4 ? 'near' : 'no');
    inp.dataset.over = n > budget ? 'yes' : 'no';
  };
  inp.addEventListener('input', () => { obj[key] = inp.value; upd(); touch(); });
  upd();
  wrap.appendChild(inp); wrap.appendChild(cnt);
  return wrap;
}

// ---------- disc editor ----------
function discBlock(item, disc, i, rerender) {
  const b = BUD();

  // live preview — 206px is the real text column on a phone in landscape
  const glass = el('div', { class: 'disc-glass' });
  const gTitle = el('div', { class: 'dt' });
  const gLines = [];
  glass.appendChild(gTitle);
  for (let k = 0; k < b.lines; k++) { const d = el('div', { class: 'dl' }); gLines.push(d); glass.appendChild(d); }
  glass.appendChild(el('div', { class: 'tap', text: 'TAP TO CONTINUE' }));

  const syncPreview = () => {
    gTitle.textContent = disc.title || '—';
    for (let k = 0; k < b.lines; k++) {
      const v = (disc.lines[k] || '');
      gLines[k].textContent = v || ' ';
      gLines[k].classList.toggle('over', v.length > b.line);
    }
  };

  const lines = el('div', { class: 'lines' });
  for (let k = 0; k < b.lines; k++) {
    if (disc.lines[k] === undefined) disc.lines[k] = '';
    const row = el('div', { class: 'lrow' });
    const inp = el('input', { class: 'line', type: 'text', placeholder: 'line ' + (k + 1) });
    const cnt = el('span', { class: 'count' });
    inp.value = disc.lines[k];
    const upd = () => {
      const n = inp.value.length;
      cnt.textContent = n + '/' + b.line;
      cnt.dataset.over = n > b.line ? 'yes' : (n > b.line - 4 ? 'near' : 'no');
      inp.dataset.over = n > b.line ? 'yes' : 'no';
    };
    inp.addEventListener('input', () => { disc.lines[k] = inp.value; upd(); syncPreview(); touch(); });
    upd();
    row.appendChild(inp); row.appendChild(cnt);
    lines.appendChild(row);
  }

  const titleInp = el('input', { class: 'plain', type: 'text', placeholder: 'RELAY 06 — THE KEYS' });
  titleInp.value = disc.title || '';
  titleInp.style.fontFamily = "'Audiowide', system-ui, sans-serif";
  titleInp.style.letterSpacing = '1.5px';
  titleInp.addEventListener('input', () => { disc.title = titleInp.value; syncPreview(); touch(); });

  const awToggle = el('button', {
    class: 'ghost tiny', text: 'Audiowide',
    onclick: () => {
      glass.classList.toggle('aw');
      awToggle.setAttribute('aria-pressed', glass.classList.contains('aw'));
    }
  });
  awToggle.setAttribute('aria-pressed', 'false');

  syncPreview();

  return el('div', { class: 'disc' }, [
    el('div', { class: 'disc-bar' }, [
      el('span', { class: 'idx', text: 'DISC ' + (i + 1) }),
      el('span', { class: 'grow' }),
      item.discs.length > 1 ? el('button', {
        class: 'ghost tiny danger', text: 'Remove',
        onclick: () => { item.discs.splice(i, 1); touch(); rerender(); }
      }) : null
    ]),
    el('div', { class: 'disc-body' }, [
      el('div', {}, [
        labelled('Disc title', null, titleInp),
        labelled('Lines', b.lines + ' × ' + b.line + ' characters at a locked 14px', lines),
        labelled('Art', 'the shot this beat is generated from', textarea(disc, 'art', 'art',
          'Wide. Renke at a terminal in an empty compliance floor, one desk lamp, rain on glass behind him…'))
      ]),
      el('div', { class: 'preview' }, [
        el('div', { class: 'cap' }, [el('span', { text: 'ON THE DISC' }), awToggle]),
        glass,
        el('div', { class: 'help', style: 'font-size:11px;color:#5f7ea6;line-height:1.5' ,
          text: 'Actual size. Anything wider than the box will wrap or scroll in game.' })
      ])
    ])
  ]);
}

// ---------- ask composer ----------
function askBox(ai, kind, n) {
  const box = el('div', { class: 'ask-box' });
  const ta = el('textarea', { placeholder: 'What do you want me to do here?  e.g. "write three disc beats for the reveal — Renke calls, and I want the last line to land hard"' });
  const submit = el('button', {
    class: 'gold', text: 'Send to Claude',
    onclick: () => {
      const text = ta.value.trim();
      if (!text) { ta.focus(); return; }
      S.requests = S.requests || [];
      S.requests.push({
        id: 'r' + Date.now().toString(36),
        a: ai, kind: kind, n: n,
        label: targetLabel(ai, kind, n),
        text: text, at: new Date().toISOString(), done: false
      });
      ta.value = '';
      touch(); renderRail(); renderAsks(); renderPane();
      copyPrompt();
      toast('Ask logged — prompt copied. Paste it to Claude.');
    }
  });
  box.appendChild(el('div', { class: 'lbl' }, [
    el('span', { text: '✳ Ask Claude' }),
    el('span', { class: 'help', text: 'saved into story.json — Claude reads it from the repo' })
  ]));
  box.appendChild(ta);
  box.appendChild(el('div', { class: 'foot' }, [
    el('span', { class: 'hint', text: 'Tell me what to write, what is wrong, or what to argue with.' }),
    submit
  ]));
  return box;
}

function copyPrompt() {
  const txt = $('promptTxt').textContent;
  if (navigator.clipboard) navigator.clipboard.writeText(txt).catch(() => {});
}

// ---------- panes ----------
function statusSeg(item) {
  const seg = el('div', { class: 'seg' });
  [['empty', 'Empty'], ['draft', 'Draft'], ['done', 'Done']].forEach(([v, t]) => {
    const b = el('button', {
      text: t, onclick: () => {
        item.status = v; touch(); renderRail();
        seg.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b));
      }
    });
    b.setAttribute('aria-pressed', (item.status || 'empty') === v);
    seg.appendChild(b);
  });
  return seg;
}

function renderPane() {
  const pane = $('pane');
  pane.textContent = '';
  if (sel.kind === 'act') return renderActPane(pane);
  renderMissionPane(pane);
}

function renderActPane(pane) {
  const a = act(), ai = sel.a;
  const written = a.missions.filter(m => m.status === 'done').length;

  pane.appendChild(el('div', { class: 'mh' }, [
    el('div', { class: 'grow' }, [
      el('div', { class: 'kicker', text: a.act + ' · campaign ' + (ai + 1) }),
      (() => {
        const i = el('input', { class: 'title', type: 'text', placeholder: 'ACT TITLE' });
        i.value = a.title || '';
        i.addEventListener('input', () => { a.title = i.value; touch(); renderRail(); });
        return i;
      })()
    ]),
    el('div', { class: 'acts' }, [
      el('button', { class: 'gold', text: '✳ Ask', onclick: () => { pane.querySelector('.ask-box')?.scrollIntoView({ behavior: 'smooth' }); } })
    ])
  ]));

  pane.appendChild(el('div', { class: 'tuning' }, [
    el('span', { class: 'chip', html: '<b>' + a.missions.length + '</b> missions' }),
    el('span', { class: 'chip', html: '<b>' + written + '</b> done' }),
    el('span', { class: 'chip', html: 'boss <b>' + (a.missions[a.missions.length - 1].tuning.boss || '—') + '</b>' })
  ]));

  pane.appendChild(askBox(ai, 'act', 0));
  pane.appendChild(labelled('Premise', 'one paragraph — what this campaign is',
    textarea(a, 'premise', 'beat', 'What this act is, in one paragraph.')));
  pane.appendChild(labelled('Outline', 'the act in full, before it is cut into missions',
    textarea(a, 'outline', 'scene', 'Write the act here. This is the source the missions get spread from.')));
  pane.appendChild(labelled('Notes', null, textarea(a, 'notes', 'notes', 'Anything unresolved.')));

  pane.appendChild(el('div', { class: 'sep' }));
  pane.appendChild(el('div', { class: 'lbl' }, [el('span', { text: 'The spread' }),
    el('span', { class: 'help', text: 'click a beat to open the mission' })]));

  a.missions.forEach((m, mi) => {
    pane.appendChild(el('button', {
      class: 'row', style: 'padding:9px 10px;border:1px solid #0e2242;border-radius:7px;margin-bottom:6px;grid-template-columns:26px 1fr;align-items:start',
      onclick: () => { sel = { a: ai, kind: 'mission', n: mi + 1 }; renderRail(); renderPane(); document.querySelector('main').scrollTop = 0; }
    }, [
      el('span', { class: 'n', text: String(m.n).padStart(2, '0') }),
      el('span', { style: 'white-space:normal;line-height:1.55' }, [
        el('b', { text: (m.name || 'untitled') + ' — ', style: 'color:#cfe6ff' }),
        el('span', { text: m.beat || 'no beat yet', style: 'color:#7b9bc2' })
      ])
    ]));
  });
}

function renderMissionPane(pane) {
  const a = act(), ai = sel.a;
  const isV = sel.kind === 'verdict';
  const isT = sel.kind === 'tutorial';
  const item = target();
  const t = item.tuning;

  pane.appendChild(el('div', { class: 'mh' }, [
    el('div', { class: 'grow' }, [
      el('div', { class: 'kicker', text: isT ? 'tutorial · unranked, unfiled'
        : isV ? a.act + ' · verdict card'
        : a.act + ' · mission ' + String(item.n).padStart(2, '0') }),
      (() => {
        const i = el('input', { class: 'title', type: 'text', placeholder: isV ? 'VERDICT NAME' : 'LEVEL NAME' });
        if (isT) i.placeholder = 'QUALIFICATION';
        i.value = item.name || '';
        i.addEventListener('input', () => { item.name = i.value; touch(); renderRail(); });
        return i;
      })()
    ]),
    el('div', { class: 'acts' }, [statusSeg(item)])
  ]));

  // tuning facts — read-only, straight from src/campaigns.js
  const strip = el('div', { class: 'tuning' });
  if (t) {
    strip.appendChild(el('span', { class: 'chip', html: '<b>' + t.duration + '</b>s' }));
    strip.appendChild(el('span', { class: 'chip', html: 'speed <b>' + t.speed + '</b>' }));
    (t.introduces || []).forEach(x => strip.appendChild(el('span', { class: 'chip new', text: 'NEW · ' + x })));
    if (t.boss) strip.appendChild(el('span', { class: 'chip boss', text: 'BOSS · ' + t.boss }));
    if (!(t.introduces || []).length && !t.boss) strip.appendChild(el('span', { class: 'chip', text: 'no new mechanic' }));
  }
  strip.appendChild(el('span', { class: 'chip', html: 'name <b>' + (item.name || '').length + '/' + BUD().name + '</b>' }));
  pane.appendChild(strip);

  // open asks on this target
  const mine = openAsksFor(ai, sel.kind, sel.n);
  mine.forEach(r => pane.appendChild(el('div', { class: 'empty', style: 'border-color:#7a5c11;color:#e8c76a;margin-bottom:14px' }, [
    el('b', { text: '✳ open ask — ', style: 'color:#ffd24a' }),
    el('span', { text: r.text })
  ])));

  const untouched = !item.scene && (item.discs || []).every(d => !d.title && d.lines.every(l => !l));
  if (untouched) {
    pane.appendChild(el('div', { class: 'empty', html:
      'Nothing written here yet. The <b>beat</b> below is the first-pass spread — argue with it. ' +
      'The <b>scene</b> is where the real writing goes, as long as it needs to be. ' +
      'The <b>discs</b> are what the player actually reads: ' + BUD().lines + ' lines of ~' + BUD().line +
      ' characters, up to ' + BUD().discsMax + ' discs, and a mission only earns a third disc if it turns.' }));
  }

  pane.appendChild(askBox(ai, sel.kind, sel.n));

  pane.appendChild(labelled('Beat', 'the one thing this mission does to the story',
    textarea(item, 'beat', 'beat', 'What changes here?')));

  pane.appendChild(labelled('Scene', 'written long — this is what the image briefs come from',
    textarea(item, 'scene', 'scene', 'INT. …\n\nAction, dialogue, as long as it needs to be. Only what is spoken makes it onto a disc.')));

  // discs
  const discsWrap = el('div', {});
  const rerender = () => renderPane();
  discsWrap.appendChild(el('div', { class: 'discs-head' }, [
    el('div', { class: 'lbl', style: 'margin:0' }, [
      el('span', { text: 'Briefing discs' }),
      el('span', { class: 'help', text: item.discs.length + ' of ' + BUD().discsMax + ' — one beat each, tapped through' })
    ]),
    el('button', {
      class: 'ghost tiny', text: '+ Add disc',
      disabled: item.discs.length >= BUD().discsMax,
      onclick: () => { item.discs.push({ title: '', lines: ['', '', '', ''], art: '' }); touch(); rerender(); }
    })
  ]));
  item.discs.forEach((d, i) => discsWrap.appendChild(discBlock(item, d, i, rerender)));
  pane.appendChild(discsWrap);

  if (isT) {
    pane.appendChild(el('div', { class: 'empty', style: 'margin-bottom:24px' , html:
      'No hint, no case note, no analysis line \u2014 <b>nothing about this run is recorded</b>. ' +
      'That is why it sits outside the campaign, and it is why the operator has nothing on file.' }));
  }

  if (!isV && !isT) {
    pane.appendChild(el('div', { class: 'sep' }));
    pane.appendChild(labelled('Hint', 'under the level title on boot', counted(item, 'hint', 52, 'NEW THREAT: …')));
  }

  pane.appendChild(labelled('Notes', null, textarea(item, 'notes', 'notes', 'Anything unresolved.')));
}

// ---------- asks panel ----------
function renderAsks() {
  const list = $('alist');
  list.textContent = '';
  const reqs = (S.requests || []).slice().reverse();
  const open = reqs.filter(r => !r.done);
  $('askCount').textContent = open.length;

  if (!reqs.length) {
    list.appendChild(el('div', { class: 'empty', html:
      'No asks yet. Hit <b>Ask Claude</b> on any mission or act to log one — it is written into ' +
      '<b>story.json</b>, so I read it straight from the repo. Then paste the prompt below.' }));
    return;
  }

  reqs.forEach(r => {
    list.appendChild(el('div', { class: 'req' + (r.done ? ' done' : '') }, [
      el('div', { class: 'rt', text: r.label }),
      el('div', { class: 'rb', text: r.text }),
      el('div', { class: 'rf' }, [
        el('button', {
          class: 'ghost tiny', text: 'Go to',
          onclick: () => {
            sel = { a: r.a, kind: r.kind, n: r.n || 1 };
            closePanel(); renderRail(); renderPane();
          }
        }),
        el('button', {
          class: 'ghost tiny', text: r.done ? 'Reopen' : 'Mark done',
          onclick: () => { r.done = !r.done; touch(); renderAsks(); renderRail(); renderPane(); }
        })
      ])
    ]));
  });
}

function openPanel() { $('panel').classList.add('open'); $('scrim').classList.add('on'); }
function closePanel() { $('panel').classList.remove('open'); $('scrim').classList.remove('on'); }

// ══ reference column ══════════════════════════════════════════════════════
// The narrative record, live from docs/. Rendered here rather than linked so
// you can read the bible in one pane and write the mission in the other.

const esc = s => s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

function inline(s) {
  // Split on code spans and transform only the prose between them, so `**` and
  // `*` inside code stay literal. No placeholder tokens — the sentinel
  // approach put raw NUL bytes in this file and made it binary to grep.
  return s.split(/(`[^`]+`)/).map(part => {
    if (part.length > 1 && part[0] === '`' && part[part.length - 1] === '`')
      return '<code>' + esc(part.slice(1, -1)) + '</code>';
    return esc(part)
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  }).join('');
}

const slugs = {};
function slug(txt) {
  const base = txt.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'x';
  slugs[base] = (slugs[base] || 0) + 1;
  return slugs[base] > 1 ? base + '-' + slugs[base] : base;
}

function md(src) {
  for (const k in slugs) delete slugs[k];
  const lines = src.split('\n');
  const out = [];
  const toc = [];
  let i = 0;

  const isTable = l => /^\s*\|/.test(l);
  const isRule = l => /^\s*\|[\s:|-]+\|\s*$/.test(l);

  while (i < lines.length) {
    const l = lines[i];

    if (!l.trim()) { i++; continue; }

    const h = /^(#{1,6})\s+(.*)$/.exec(l);
    if (h) {
      const lvl = Math.min(h[1].length, 3);
      const txt = h[2].trim();
      const id = slug(txt);
      toc.push({ lvl, txt: txt.replace(/[*`]/g, ''), id });
      out.push('<h' + lvl + ' id="' + id + '">' + inline(txt) + '</h' + lvl + '>');
      i++; continue;
    }

    if (/^\s*(---+|\*\*\*+)\s*$/.test(l)) { out.push('<hr>'); i++; continue; }

    if (isTable(l)) {
      const rows = [];
      while (i < lines.length && isTable(lines[i])) rows.push(lines[i++]);
      const cells = r => r.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
      const hasHead = rows.length > 1 && isRule(rows[1]);
      let html = '<table>';
      rows.forEach((r, ri) => {
        if (hasHead && ri === 1) return;
        const tag = (hasHead && ri === 0) ? 'th' : 'td';
        html += '<tr>' + cells(r).map(c => '<' + tag + '>' + inline(c) + '</' + tag + '>').join('') + '</tr>';
      });
      out.push(html + '</table>');
      continue;
    }

    if (/^\s*>/.test(l)) {
      const buf = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) buf.push(lines[i++].replace(/^\s*>\s?/, ''));
      out.push('<blockquote>' + md(buf.join('\n')).html + '</blockquote>');
      continue;
    }

    const ul = /^\s*[-*]\s+/, ol = /^\s*\d+\.\s+/;
    if (ul.test(l) || ol.test(l)) {
      const ordered = ol.test(l);
      const rx = ordered ? ol : ul;
      const items = [];
      while (i < lines.length && rx.test(lines[i])) {
        let txt = lines[i++].replace(rx, '');
        // fold hanging indented continuations into the same item
        while (i < lines.length && /^\s{2,}\S/.test(lines[i]) && !rx.test(lines[i]) && !isTable(lines[i])) {
          txt += ' ' + lines[i++].trim();
        }
        items.push('<li>' + inline(txt) + '</li>');
      }
      out.push('<' + (ordered ? 'ol' : 'ul') + '>' + items.join('') + '</' + (ordered ? 'ol' : 'ul') + '>');
      continue;
    }

    const buf = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,6}\s|\s*>|\s*[-*]\s|\s*\d+\.\s)/.test(lines[i])
           && !isTable(lines[i]) && !/^\s*(---+|\*\*\*+)\s*$/.test(lines[i])) buf.push(lines[i++]);
    if (buf.length) out.push('<p>' + inline(buf.join(' ')) + '</p>');
    else i++;
  }
  return { html: out.join('\n'), toc };
}

const REF = { doc: 'voice', html: '', toc: [], scroll: {} };

async function loadDoc(name) {
  const body = $('refDocBody');
  REF.doc = name;
  body.innerHTML = '<div class="ref-empty">Loading…</div>';
  try {
    const r = await fetch('/api/doc?name=' + encodeURIComponent(name));
    if (!r.ok) throw new Error(await r.text());
    const parsed = md(await r.text());
    REF.html = parsed.html; REF.toc = parsed.toc;
    body.innerHTML = parsed.html;
    body.scrollTop = REF.scroll[name] || 0;
    buildToc();
    applyFind();
  } catch (e) {
    body.innerHTML = '<div class="ref-empty">Could not load — ' + esc(e.message) + '</div>';
  }
}

function buildToc() {
  const t = $('refToc');
  t.textContent = '';
  REF.toc.forEach(h => {
    t.appendChild(el('button', {
      class: 'h' + h.lvl, text: h.txt,
      onclick: () => {
        const n = document.getElementById(h.id);
        if (n) n.scrollIntoView({ behavior: 'smooth', block: 'start' });
        t.classList.add('hide');
      }
    }));
  });
}

function highlight(root, q) {
  const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const targets = [];
  let n;
  while ((n = walker.nextNode())) { rx.lastIndex = 0; if (rx.test(n.nodeValue)) targets.push(n); }
  let count = 0;
  targets.forEach(node => {
    const frag = document.createDocumentFragment();
    let last = 0, m;
    rx.lastIndex = 0;
    while ((m = rx.exec(node.nodeValue))) {
      if (!m[0]) { rx.lastIndex++; continue; }
      frag.appendChild(document.createTextNode(node.nodeValue.slice(last, m.index)));
      frag.appendChild(el('mark', { text: m[0] }));
      last = m.index + m[0].length; count++;
    }
    frag.appendChild(document.createTextNode(node.nodeValue.slice(last)));
    node.parentNode.replaceChild(frag, node);
  });
  return count;
}

let findHit = -1;
function applyFind() {
  const q = $('refFind').value.trim();
  const body = $('refDocBody');
  const keep = body.scrollTop;
  body.innerHTML = REF.html;
  findHit = -1;
  if (!q) { $('refHits').textContent = ''; body.scrollTop = keep; return; }
  const n = highlight(body, q);
  $('refHits').textContent = n ? n + ' found' : 'none';
  body.scrollTop = keep;
  if (n) nextHit();
}
function nextHit() {
  const marks = $('refDocBody').querySelectorAll('mark');
  if (!marks.length) return;
  findHit = (findHit + 1) % marks.length;
  marks.forEach(m => m.style.outline = '');
  const m = marks[findHit];
  m.style.outline = '2px solid rgba(255,210,74,.8)';
  m.scrollIntoView({ behavior: 'smooth', block: 'center' });
  $('refHits').textContent = (findHit + 1) + '/' + marks.length;
}

// ---------- excerpts ----------
let lastField = null;

function insertIntoField(text) {
  const f = lastField;
  if (!f || !f.isConnected) { toast('Click into a field first, then insert.'); return; }
  const s = f.selectionStart != null ? f.selectionStart : f.value.length;
  const e = f.selectionEnd != null ? f.selectionEnd : s;
  f.value = f.value.slice(0, s) + text + f.value.slice(e);
  const pos = s + text.length;
  f.focus(); f.setSelectionRange(pos, pos);
  f.dispatchEvent(new Event('input', { bubbles: true }));  // keeps the model + counters in sync
  toast('Inserted.');
}

function refSelection() {
  const s = window.getSelection();
  if (!s || s.isCollapsed || !s.rangeCount) return null;
  const body = $('refDocBody');
  if (!body.contains(s.anchorNode) || !body.contains(s.focusNode)) return null;
  const txt = s.toString().trim();
  return txt ? { txt, rect: s.getRangeAt(0).getBoundingClientRect() } : null;
}

function syncGrab() {
  const g = $('grab');
  const sel = refSelection();
  if (!sel) { g.classList.remove('on'); return; }
  g.classList.add('on');
  const w = g.offsetWidth || 150;
  g.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, sel.rect.left + sel.rect.width / 2 - w / 2)) + 'px';
  g.style.top = Math.max(58, sel.rect.top - g.offsetHeight - 8) + 'px';
}

function toggleRef(force) {
  const on = force !== undefined ? force : !document.body.classList.contains('ref-open');
  document.body.classList.toggle('ref-open', on);
  localStorage.setItem('dd-lab-ref', on ? '1' : '0');
  $('btnRef').setAttribute('aria-pressed', on);
  if (on && !REF.html) loadDoc($('refDoc').value);
}

$('btnRef').addEventListener('click', () => toggleRef());
$('refDoc').addEventListener('change', e => {
  REF.scroll[REF.doc] = $('refDocBody').scrollTop;
  $('refFind').value = ''; $('refHits').textContent = '';
  loadDoc(e.target.value);
});
$('btnToc').addEventListener('click', () => $('refToc').classList.toggle('hide'));
$('refFind').addEventListener('input', applyFind);
$('refFind').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); nextHit(); } });
$('refDocBody').addEventListener('scroll', () => {
  REF.scroll[REF.doc] = $('refDocBody').scrollTop;
  $('grab').classList.remove('on');
});
document.addEventListener('selectionchange', () => { if (document.body.classList.contains('ref-open')) syncGrab(); });
$('grabCopy').addEventListener('click', () => {
  const sel = refSelection();
  if (sel && navigator.clipboard) navigator.clipboard.writeText(sel.txt).then(() => toast('Copied.'));
  $('grab').classList.remove('on');
});
$('grabInsert').addEventListener('click', () => {
  const sel = refSelection();
  if (sel) insertIntoField(sel.txt);
  $('grab').classList.remove('on');
});
document.querySelector('main').addEventListener('focusin', e => {
  if (e.target.matches('textarea, input[type="text"]')) lastField = e.target;
});

// ---------- wiring ----------
$('btnAsks').addEventListener('click', () => {
  $('panel').classList.contains('open') ? closePanel() : (renderAsks(), openPanel());
});
$('btnClose').addEventListener('click', closePanel);
$('scrim').addEventListener('click', closePanel);
$('btnCopyPrompt').addEventListener('click', () => { copyPrompt(); toast('Prompt copied — paste it to Claude.'); });
$('btnClearDone').addEventListener('click', () => {
  S.requests = (S.requests || []).filter(r => !r.done);
  touch(); renderAsks(); renderRail();
});
$('btnPrev').addEventListener('click', () => step(-1));
$('btnNext').addEventListener('click', () => step(1));

document.addEventListener('keydown', e => {
  const mod = e.metaKey || e.ctrlKey;
  if (mod && e.key === 's') { e.preventDefault(); clearTimeout(saveTimer); save(); }
  if (mod && e.key === '[') { e.preventDefault(); step(-1); }
  if (mod && e.key === ']') { e.preventDefault(); step(1); }
  if (mod && e.key === '\\') { e.preventDefault(); toggleRef(); }
  if (e.key === 'Escape') { closePanel(); $('grab').classList.remove('on'); $('refToc').classList.add('hide'); }
});

window.addEventListener('beforeunload', e => {
  if ($('save').dataset.state === 'saving') { e.preventDefault(); e.returnValue = ''; }
});

// the reference is open by default — the whole point is that it is beside you
toggleRef(localStorage.getItem('dd-lab-ref') !== '0');
load();
