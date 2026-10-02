const CACHE = 'hackeros-search-v1';
const OFFLINE_PAGE = '404.html';
const PRECACHE = ['404.html', 'index.html', 'styles.css', 'script.js', 'HackerOS.png'];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE)
            .then((cache) => cache.addAll(PRECACHE.map((u) => new Request(u, { cache: 'reload' }))))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') return;

    const url = new URL(req.url);
    if (url.origin !== self.location.origin) return;      // zewnętrzne (Ecosia, ikony) - zostawiamy przeglądarce
    if (url.searchParams.has('probe')) return;            // test łączności z 404.html - ma iść prosto do sieci

    // Nawigacja (wejście na stronę): sieć -> a gdy jej brak, ekran offline 404.html
    if (req.mode === 'navigate') {
        event.respondWith(
            fetch(req, { cache: 'no-store' })
                .catch(() =>
                    caches.match(OFFLINE_PAGE).then((r) =>
                        r || new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
                    )
                )
        );
        return;
    }

    // Pliki statyczne (css, js, obrazki): sieć, z zapisem do cache; offline - kopia z cache
    event.respondWith(
        fetch(req)
            .then((res) => {
                if (res && res.ok) {
                    const copy = res.clone();
                    caches.open(CACHE).then((cache) => cache.put(req, copy));
                }
                return res;
            })
            .catch(() => caches.match(req))
    );
});
