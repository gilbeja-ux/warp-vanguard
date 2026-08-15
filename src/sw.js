// Network-first service worker: always serves fresh files while online (no
// stale-cache surprises during development), falls back to cache offline.
const CACHE = 'warp-vanguard-v1';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(
  caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => clients.claim())
));
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).then(res => {
      // ONLY A GOOD ANSWER IS WORTH KEEPING. The failures that matter here are
      // the ones that still LOOK like responses, because those resolve the fetch
      // instead of rejecting it: a captive-portal wifi answering every request
      // with its own login page, a 500 from a half-deployed host, a plain 404.
      // Cached blindly, each one got written OVER a good file and then served
      // back from cache once offline — the game comes up broken and stays broken
      // until storage is cleared by hand, which no player will do.
      //
      // The leaderboard client already learned exactly this lesson and checks
      // res.ok on every RPC (see lbRpc); the worker was the one door still open.
      //
      // An opaque response is cross-origin and unreadable to the worker: its
      // status is always 0, so it can never be told apart from a failure, and
      // storing it spends quota on something that can never be validated.
      if (res.ok && res.type !== 'opaque') {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
      }
      return res;
    }).catch(async () => {
      // OFFLINE. The exact request first — that answers every asset.
      const hit = await caches.match(e.request);
      if (hit) return hit;
      // Past here only NAVIGATIONS are worth rescuing: the game is a single page,
      // and a launch carrying anything on the URL (?prof=1, an install referrer,
      // a shared link) misses an exact-match lookup and fails to open at all
      // while every asset it needs is sitting in the cache.
      if (e.request.mode !== 'navigate') return undefined;
      // ignoreSearch drops the query so ?prof=1 finds the shell it was cached
      // without. Then './' — the app root — because a PWA opened at the root is
      // cached under '/' and NOT under '/index.html'; looking only for the
      // filename would miss the exact case this fallback exists for.
      return (await caches.match(e.request, { ignoreSearch: true }))
        || (await caches.match('./'))
        || (await caches.match('index.html'));
    })
  );
});
