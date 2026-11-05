// The traction portal's data: what the live project holds, read in aggregate.
//
// Used by scripts/admin.js (the /traction page and /api/traction). Nothing here
// ships, and nothing here reaches the browser that names a player: every query
// below groups before it returns, and the page receives counts.
//
// HOW IT READS. Two of the sources live in the `auth` schema, which PostgREST
// does not serve: auth.sessions (the user agent each anonymous identity signed in
// with) and auth.refresh_tokens (one row per token refresh, so one row per day a
// device reached the backend). The linked Supabase CLI runs SQL through the
// Management API (`supabase db query --linked`), with the login the admin console
// already uses for its service key. So the portal needs no migration to show the
// first phase, and nothing here is a new credential.
//
// THE SEGMENTS. Every identity is put in exactly one, so the per-segment counts
// add up to the whole:
//   android  the Android app (a WebView user agent, '; wv)')
//   ios      the iOS app (a WebKit user agent with no 'Safari/' in it)
//   web      a phone browser (Chrome on Android, Safari on iOS): in practice the
//            developer's own LAN tests, because no public web build exists
//   test     a desktop browser, an automated one, a script, or no user agent at
//            all. The game ships as phone apps, so a desktop is a developer.
// Telemetry rows carry their own platform and channel; a 'dev' channel is 'test'.
//
// READ THE LIMITS BEFORE TRUSTING A NUMBER (the page prints them too):
//   · an identity exists only once a device reached the backend: before play
//     statistics ship, that is the first time a player opened a board or posted
//     a score. Installs come from the stores, never from here.
//   · a day "seen" is a day a token was refreshed. A session lasts an hour, so a
//     player who opens the game twice an hour apart counts once.
//   · `runs` keeps a row for every run that places in a board's top 100 and
//     evicts past 100, so it is a floor on reach, never traffic. A row's
//     updated_at moves only when its name is changed, so it counts no new score.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execFile, execFileSync } = require('child_process');

const SEGS = ['android', 'ios', 'web', 'test'];
const WINDOWS = [7, 30, 90, 365, 3650]; // days; the page's range control picks one

// ---- the stage names: lvNum(levelNo(ci, li)), the game's own arithmetic ----
// Read from src/campaigns.js in a sandbox, so a contract added at the end names its
// stages here the day it lands. levelNo = campBase(ci) + li + 1 (33-loader.js).
function loadContracts(root) {
  const src = fs.readFileSync(path.join(root, 'src', 'campaigns.js'), 'utf8');
  const ctx = {};
  vm.runInNewContext(src + '\n;this.__P = CAMPAIGN_PACKAGES;', ctx, { timeout: 2000 });
  let base = 0;
  return ctx.__P.map((p, ci) => {
    const c = { id: String(p.id), title: String(p.title || p.id), ci, base, n: p.levels.length,
      boss: p.levels.map(l => !!(l && l.boss)).lastIndexOf(true) };
    base += p.levels.length;
    return c;
  });
}
const lvNum = n => (n < 10 ? '0' : '') + n;
// '07' for cargo-run:6, '09' for survey:0; null for a contract this build does not know
function stageName(contracts, campId, li) {
  const c = contracts.find(k => k.id === campId);
  if (!c || !Number.isInteger(li) || li < 0) return null;
  return lvNum(c.base + li + 1);
}

// ---- the CLI ----
// The worktree an agent works in carries no link (supabase/.temp is gitignored), so
// fall back to the main checkout's, which is the same project.
function linkRoot(root) {
  const has = r => fs.existsSync(path.join(r, 'supabase', '.temp', 'project-ref'));
  if (has(root)) return root;
  try {
    const common = execFileSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], { cwd: root, encoding: 'utf8' }).trim();
    const main = path.dirname(common);
    if (has(main)) return main;
  } catch (e) {}
  return root;
}
function cliQuery(root, sql) {
  return new Promise((resolve, reject) => {
    execFile('supabase', ['db', 'query', '--linked', '--workdir', linkRoot(root), '-o', 'json', sql],
      { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 60000 }, (err, out, errOut) => {
        if (err) return reject(new Error(String(errOut || err.message).replace(/\x1b\[[0-9;]*m/g, '').trim().slice(0, 400)));
        try {
          const j = JSON.parse(out);
          const row = j && Array.isArray(j.rows) ? j.rows[0] : null;
          let doc = row ? row.doc : null;
          if (typeof doc === 'string') doc = JSON.parse(doc);
          resolve(doc);
        } catch (e) { reject(new Error('could not read the CLI answer: ' + e.message)); }
      });
  });
}

// The segment rule, written once in SQL for the auth sources. `ua` is the user
// agent of an identity's LATEST session.
const SEG_SQL = `case
    when ua is null or ua = '' then 'test'
    when ua ~* '(HeadlessChrome|^node|Deno|bun/|curl|python|Electron)' then 'test'
    when ua ~* 'Android' and ua ~* '; wv\\)' then 'android'
    when ua ~* 'Android' then 'web'
    when ua ~* '(iPhone|iPad|iPod)' and ua !~* 'Safari/' then 'ios'
    when ua ~* '(iPhone|iPad|iPod)' then 'web'
    else 'test' end`;

const windowsSql = () => '(values ' + WINDOWS.map(w => '(' + w + ')').join(', ') + ') as win(w)';
function contractsSql(contracts) {
  const rows = contracts.filter(c => /^[a-z0-9-]{1,32}$/.test(c.id)).map(c => `('${c.id}', ${c.base | 0})`);
  return '(values ' + (rows.length ? rows.join(', ') : `('-', 0)`) + ') as cb(camp, base)';
}

// ---------------------------------------------------------------------------
// PHASE 1: what the project already holds. Identities, the days each one was
// seen, the boards, the notes, the reports.
// ---------------------------------------------------------------------------
function baseSql(contracts) {
  return `
with au as (
  select u.id, u.created_at,
    (select s.user_agent from auth.sessions s where s.user_id = u.id order by s.created_at desc limit 1) as ua
  from auth.users u
),
uc as (
  select id, created_at::date as d0, ${SEG_SQL} as seg,
    case when ua ~* 'Android' then 'Android ' || coalesce(substring(ua from 'Android ([0-9]+)'), '?')
         when ua ~* '(iPhone|iPad|iPod)' then 'iOS ' || coalesce(replace(substring(ua from ' OS ([0-9]+_[0-9]+)'), '_', '.'), '?')
         else null end as os,
    case when ua ~* 'Android' then nullif(substring(ua from '; ([^;)]*) Build/'), '')
         else substring(ua from '(iPhone|iPad|iPod)') end as model
  from au
),
act as (
  select id as uid, created_at::date as d from auth.users
  union
  select rt.user_id::uuid, rt.created_at::date from auth.refresh_tokens rt
   where rt.user_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  union
  select s.user_id, s.refreshed_at::date from auth.sessions s where s.refreshed_at is not null
),
ax as (select a.uid, a.d, uc.seg, uc.d0 from act a join uc on uc.id = a.uid),
days as (select generate_series(coalesce((select min(d0) from uc), current_date), current_date, interval '1 day')::date as d),
daily as (
  select dd.d, x.seg,
    count(distinct x.uid) filter (where x.d = dd.d) as dau,
    count(distinct x.uid) filter (where x.d = dd.d and x.d0 < dd.d) as ret,
    count(distinct x.uid) filter (where x.d > dd.d - 7) as wau,
    count(distinct x.uid) as mau
  from days dd join ax x on x.d > dd.d - 30 and x.d <= dd.d
  group by dd.d, x.seg
),
newd as (select d0 as d, seg, count(*) as n from uc group by 1, 2),
per as (
  select uc.id, uc.seg, uc.d0, date_trunc('week', uc.d0)::date as wk,
    bool_or(a.d = uc.d0 + 1) as a1, bool_or(a.d = uc.d0 + 7) as a7, bool_or(a.d = uc.d0 + 30) as a30,
    bool_or(a.d >= uc.d0 + 1) as r1, bool_or(a.d >= uc.d0 + 7) as r7, bool_or(a.d >= uc.d0 + 30) as r30,
    count(distinct a.d) as ndays
  from uc join act a on a.uid = uc.id
  group by 1, 2, 3, 4
),
coh as (
  select wk, seg, count(*) as n,
    count(*) filter (where d0 + 1 <= current_date) as e1, count(*) filter (where d0 + 7 <= current_date) as e7,
    count(*) filter (where d0 + 30 <= current_date) as e30,
    count(*) filter (where a1) as a1, count(*) filter (where a7) as a7, count(*) filter (where a30) as a30,
    count(*) filter (where r1) as r1, count(*) filter (where r7) as r7, count(*) filter (where r30) as r30
  from per group by 1, 2
),
seen as (select seg, least(ndays, 8) as k, count(*) as n from per group by 1, 2),
plat as (
  select win.w, uc.seg, uc.os, uc.model, count(*) as n
  from uc cross join ${windowsSql()}
  where exists (select 1 from act a where a.uid = uc.id and a.d > current_date - win.w)
  group by 1, 2, 3, 4
),
rr as (
  select r.board, r.verified, r.created_at, r.updated_at, r.player_id, coalesce(uc.seg, 'test') as seg
  from public.runs r left join uc on uc.id::text = r.player_id
),
boards as (
  select board, seg, count(*) as entries, count(distinct player_id) as players,
    count(*) filter (where verified) as verified, max(greatest(created_at, updated_at)) as last
  from rr group by 1, 2
),
cb as (select * from ${contractsSql(contracts)}),
reach as (
  select rr.player_id, rr.seg, max(cb.base + substring(rr.board from ':([0-9]+)$')::int + 1) as top
  from rr join cb on cb.camp = split_part(rr.board, ':', 1)
  where rr.board ~ '^[a-z0-9-]+:[0-9]+$'
  group by 1, 2
),
posts as (select created_at::date as d, seg, count(*) as n from rr group by 1, 2),
better as (select updated_at::date as d, seg, count(*) as n from rr where updated_at > created_at + interval '1 second' group by 1, 2),
fb as (
  select f.created_at::date as d, f.topic, coalesce(uc.seg, 'test') as seg, count(*) as n,
    count(*) filter (where f.handled_at is null) as open, count(*) filter (where f.error is not null) as err
  from public.feedback f left join uc on uc.id::text = f.player_id group by 1, 2, 3
),
rp as (
  select created_at::date as d, reason, count(*) as n, count(*) filter (where handled_at is null) as open
  from public.reports group by 1, 2
)
select json_build_object(
  'at', now(),
  'first', (select min(d0) from uc),
  'users', (select coalesce(json_object_agg(seg, n), '{}'::json) from (select seg, count(*) as n from uc group by 1) t),
  'daily', (select coalesce(json_agg(json_build_array(d, seg, dau, ret, wau, mau) order by d), '[]'::json) from daily),
  'new', (select coalesce(json_agg(json_build_array(d, seg, n) order by d), '[]'::json) from newd),
  'cohorts', (select coalesce(json_agg(json_build_array(wk, seg, n, e1, e7, e30, a1, a7, a30, r1, r7, r30) order by wk), '[]'::json) from coh),
  'seen', (select coalesce(json_agg(json_build_array(seg, k, n)), '[]'::json) from seen),
  'platform', (select coalesce(json_agg(json_build_array(w, seg, os, model, n)), '[]'::json) from plat),
  'boards', (select coalesce(json_agg(json_build_array(board, seg, entries, players, verified, last)), '[]'::json) from boards),
  'reach', (select coalesce(json_agg(json_build_array(seg, top, n)), '[]'::json) from (select seg, top, count(*) as n from reach group by 1, 2) t),
  'posts', (select coalesce(json_agg(json_build_array(d, seg, n) order by d), '[]'::json) from posts),
  'better', (select coalesce(json_agg(json_build_array(d, seg, n) order by d), '[]'::json) from better),
  'feedback', (select coalesce(json_agg(json_build_array(d, topic, seg, n, open, err) order by d), '[]'::json) from fb),
  'reports', (select coalesce(json_agg(json_build_array(d, reason, n, open) order by d), '[]'::json) from rp),
  'telemetry', to_regclass('public.telemetry_sessions') is not null
    and to_regclass('public.telemetry_attempts') is not null and to_regclass('public.telemetry_events') is not null
) as doc;`;
}

// ---------------------------------------------------------------------------
// PHASE 2: play statistics, once the migration is pushed and a build sends them.
// Everything is cut by the same windows, so a distinct-player count is never the
// sum of smaller distinct counts.
// ---------------------------------------------------------------------------
function telemetrySql() {
  return `
with ts as (select * from public.telemetry_sessions where started_at > now() - interval '400 days'),
useg as (
  select distinct on (player_id) player_id, case when channel = 'dev' then 'test' else platform end as seg
  from ts order by player_id, started_at desc
),
sx as (select ts.*, u.seg, ts.started_at::date as d from ts join useg u using (player_id)),
firsts as (select player_id, min(d) as d0 from sx group by 1),
days as (select generate_series(coalesce((select min(d) from sx), current_date), current_date, interval '1 day')::date as d),
daily as (
  select dd.d, x.seg,
    count(distinct x.player_id) filter (where x.d = dd.d) as dau,
    count(distinct x.player_id) filter (where x.d = dd.d and f.d0 < dd.d) as ret,
    count(distinct x.player_id) filter (where x.d > dd.d - 7) as wau,
    count(distinct x.player_id) as mau
  from days dd join sx x on x.d > dd.d - 30 and x.d <= dd.d join firsts f using (player_id)
  group by dd.d, x.seg
),
newd as (select f.d0 as d, u.seg, count(*) as n from firsts f join useg u using (player_id) group by 1, 2),
-- a median cannot be added up, so the two groups the page offers besides one
-- segment ('phones' = every segment but test, 'all') get rows of their own
sess as (
  select d, seg, count(*) as n, sum(fg_sec) as fg,
    percentile_cont(0.5) within group (order by fg_sec) as p50,
    percentile_cont(0.9) within group (order by fg_sec) as p90
  from sx group by 1, 2
  union all
  select d, 'phones', count(*), sum(fg_sec), percentile_cont(0.5) within group (order by fg_sec),
    percentile_cont(0.9) within group (order by fg_sec) from sx where seg <> 'test' group by 1
  union all
  select d, 'all', count(*), sum(fg_sec), percentile_cont(0.5) within group (order by fg_sec),
    percentile_cont(0.9) within group (order by fg_sec) from sx group by 1
),
pu as (
  select win.w, x.player_id, x.seg, count(*) as n, sum(x.fg_sec) as fg
  from sx x cross join ${windowsSql()} where x.d > current_date - win.w group by 1, 2, 3
),
spu as (
  select w, seg, case when n = 1 then 0 when n = 2 then 1 when n <= 5 then 2 when n <= 10 then 3 when n <= 20 then 4 else 5 end as b,
    count(*) as users from pu group by 1, 2, 3
),
tpu as (
  select w, seg, case when fg < 300 then 0 when fg < 900 then 1 when fg < 1800 then 2 when fg < 3600 then 3
    when fg < 7200 then 4 when fg < 18000 then 5 else 6 end as b, count(*) as users from pu group by 1, 2, 3
),
pum as (
  select w, seg, count(*) as users, sum(n) as sessions, sum(fg) as fg,
    percentile_cont(0.5) within group (order by fg) as med_fg from pu group by 1, 2
  union all
  select w, 'phones', count(*), sum(n), sum(fg), percentile_cont(0.5) within group (order by fg) from pu where seg <> 'test' group by 1
  union all
  select w, 'all', count(*), sum(n), sum(fg), percentile_cont(0.5) within group (order by fg) from pu group by 1
),
per as (
  select f.player_id, u.seg, f.d0, date_trunc('week', f.d0)::date as wk,
    bool_or(x.d = f.d0 + 1) as a1, bool_or(x.d = f.d0 + 7) as a7, bool_or(x.d = f.d0 + 30) as a30,
    bool_or(x.d >= f.d0 + 1) as r1, bool_or(x.d >= f.d0 + 7) as r7, bool_or(x.d >= f.d0 + 30) as r30
  from firsts f join useg u using (player_id) join sx x using (player_id)
  group by 1, 2, 3, 4
),
coh as (
  select wk, seg, count(*) as n,
    count(*) filter (where d0 + 1 <= current_date) as e1, count(*) filter (where d0 + 7 <= current_date) as e7,
    count(*) filter (where d0 + 30 <= current_date) as e30,
    count(*) filter (where a1) as a1, count(*) filter (where a7) as a7, count(*) filter (where a30) as a30,
    count(*) filter (where r1) as r1, count(*) filter (where r7) as r7, count(*) filter (where r30) as r30
  from per group by 1, 2
),
latest as (
  select distinct on (win.w, x.player_id) win.w, x.player_id, x.seg, x.os, x.model, x.app_version, x.locale
  from sx x cross join ${windowsSql()} where x.d > current_date - win.w
  order by win.w, x.player_id, x.started_at desc
),
dev as (select w, seg, os, model, app_version, locale, count(*) as users from latest group by 1, 2, 3, 4, 5, 6),
vday as (select d, seg, coalesce(app_version, '?') as v, count(distinct player_id) as users from sx group by 1, 2, 3),
att as (
  select a.*, u.seg, a.at::date as d from public.telemetry_attempts a join useg u using (player_id)
  where a.at > now() - interval '400 days'
),
stage as (
  select win.w, a.seg, a.mode, a.camp_id, a.level_idx, count(*) as n,
    count(*) filter (where a.result = 'clear') as clears, count(*) filter (where a.result = 'fail') as fails,
    count(*) filter (where a.result = 'quit') as quits, count(*) filter (where a.assist) as assisted,
    count(distinct a.player_id) as users, count(distinct a.player_id) filter (where a.result = 'clear') as users_clear,
    sum(a.dur_sec) as dur
  from att a cross join ${windowsSql()} where a.d > current_date - win.w
  group by 1, 2, 3, 4, 5
),
modes as (select d, seg, mode, count(*) as n, count(distinct player_id) as users, sum(dur_sec) as dur from att group by 1, 2, 3),
ev as (
  select e.*, coalesce(u.seg, 'test') as seg, e.at::date as d from public.telemetry_events e
  left join useg u using (player_id) where e.at > now() - interval '400 days'
),
evd as (select d, seg, name, count(*) as n, count(distinct player_id) as users from ev group by 1, 2, 3),
evw as (
  select win.w, seg, name, count(*) as n, count(distinct player_id) as users
  from ev cross join ${windowsSql()} where d > current_date - win.w group by 1, 2, 3
),
evk as (
  select win.w, seg, name, coalesce(props->>'why', props->>'where', props->>'part', props->>'step', '') as k,
    count(*) as n, count(distinct player_id) as users
  from ev cross join ${windowsSql()} where d > current_date - win.w group by 1, 2, 3, 4
)
select json_build_object(
  'at', now(),
  'first', (select min(d) from sx),
  'users', (select coalesce(json_object_agg(seg, n), '{}'::json) from (select seg, count(*) as n from useg group by 1) t),
  'daily', (select coalesce(json_agg(json_build_array(d, seg, dau, ret, wau, mau) order by d), '[]'::json) from daily),
  'new', (select coalesce(json_agg(json_build_array(d, seg, n) order by d), '[]'::json) from newd),
  'sessions', (select coalesce(json_agg(json_build_array(d, seg, n, fg, p50, p90) order by d), '[]'::json) from sess),
  'spu', (select coalesce(json_agg(json_build_array(w, seg, b, users)), '[]'::json) from spu),
  'tpu', (select coalesce(json_agg(json_build_array(w, seg, b, users)), '[]'::json) from tpu),
  'pum', (select coalesce(json_agg(json_build_array(w, seg, users, sessions, fg, med_fg)), '[]'::json) from pum),
  'cohorts', (select coalesce(json_agg(json_build_array(wk, seg, n, e1, e7, e30, a1, a7, a30, r1, r7, r30) order by wk), '[]'::json) from coh),
  'device', (select coalesce(json_agg(json_build_array(w, seg, os, model, app_version, locale, users)), '[]'::json) from dev),
  'versions', (select coalesce(json_agg(json_build_array(d, seg, v, users) order by d), '[]'::json) from vday),
  'stages', (select coalesce(json_agg(json_build_array(w, seg, mode, camp_id, level_idx, n, clears, fails, quits, assisted, users, users_clear, dur)), '[]'::json) from stage),
  'modes', (select coalesce(json_agg(json_build_array(d, seg, mode, n, users, dur) order by d), '[]'::json) from modes),
  'events', (select coalesce(json_agg(json_build_array(d, seg, name, n, users) order by d), '[]'::json) from evd),
  'eventsWin', (select coalesce(json_agg(json_build_array(w, seg, name, n, users)), '[]'::json) from evw),
  'eventKeys', (select coalesce(json_agg(json_build_array(w, seg, name, k, n, users)), '[]'::json) from evk)
) as doc;`;
}

// the retention promise (privacy.html): thirteen months. Run at most once a day.
const PURGE_SQL = `select json_build_object('purged', public.purge_old_telemetry()) as doc;`;

module.exports = { SEGS, WINDOWS, loadContracts, stageName, lvNum, linkRoot, cliQuery, baseSql, telemetrySql, PURGE_SQL, SEG_SQL };
