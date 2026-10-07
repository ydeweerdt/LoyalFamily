/* LoyalFamily service worker — app-shell offline strategy (DESIGN §5).
 *
 * - /api/**  → untouched here. Card data offline is the IndexedDB cache's job
 *              (client-side), not an HTTP-cache job: stale card data in an
 *              HTTP cache is exactly the bug class we designed out (full pull).
 * - navigations → network-first; on failure serve the cached app shell.
 * - static assets (/_app/** hashed files, icons, manifest) → cache-first.
 */
const SHELL_CACHE = 'loyalfamily-shell-v1';

self.addEventListener('install', (e) => {
	// best-effort shell precache so a fresh install can boot offline immediately
	e.waitUntil(
		fetch('/')
			.then((res) => (res.ok ? caches.open(SHELL_CACHE).then((c) => c.put('/', res)) : null))
			.catch(() => null)
	);
	self.skipWaiting();
});

self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (e) => {
	const req = e.request;
	if (req.method !== 'GET') return;

	const url = new URL(req.url);
	if (url.origin !== self.location.origin) return;
	if (url.pathname.startsWith('/api/')) return;

	if (req.mode === 'navigate') {
		e.respondWith(
			fetch(req)
				.then((res) => {
					// a 502/503/504 from the proxy means the server is down —
					// that is an offline situation, not a page to display
					if (!res.ok) throw new Error('server error ' + res.status);
					const copy = res.clone();
					e.waitUntil(caches.open(SHELL_CACHE).then((c) => c.put('/', copy)));
					return res;
				})
				.catch(() =>
					caches.match('/').then((r) => r || Response.error())
				)
		);
		return;
	}

	const cacheable = url.pathname.startsWith('/_app/') || url.pathname.startsWith('/icons/') || url.pathname === '/manifest.json';
	if (!cacheable) return;

	e.respondWith(
		caches.match(req).then((hit) => {
			if (hit) return hit;
			return fetch(req).then((res) => {
				if (res.ok) {
					const copy = res.clone();
					caches.open(SHELL_CACHE).then((c) => c.put(req, copy));
				}
				return res;
			});
		})
	);
});
