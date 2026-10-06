export {};

declare const __BUILD_ID__: string;

// Service Worker - typujemy globalny obiekt ręcznie
const sw = self as unknown as ServiceWorkerGlobalScope;

const CACHE = `hackeros-search-${__BUILD_ID__}`;
const OFFLINE_PAGE = '404.html';
const PRECACHE: readonly string[] = [
    '404.html',
    'index.html',
    'styles.css',
    'script.js',
    'HackerOS.png',
    'blue.html',
    'blue.css',
    'blue.js',
    'blue-logo.png',
];

sw.addEventListener('install', (event: ExtendableEvent) => {
    event.waitUntil(
        caches.open(CACHE)
            .then((cache) =>
                // pojedynczo, żeby brak jednego pliku (np. HackerOS.png) nie blokował instalacji SW
                Promise.all(
                    PRECACHE.map((u) =>
                        cache.add(new Request(u, { cache: 'reload' })).catch((err: unknown) => {
                            console.warn('[sw] precache pominięty:', u, err);
                        })
                    )
                )
            )
            .then(() => sw.skipWaiting())
    );
});

sw.addEventListener('activate', (event: ExtendableEvent) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
            .then(() => sw.clients.claim())
    );
});

sw.addEventListener('fetch', (event: FetchEvent) => {
    const req: Request = event.request;
    if (req.method !== 'GET') return;

    const url = new URL(req.url);
    if (url.origin !== sw.location.origin) return;      // zewnętrzne (Ecosia, ikony) - zostawiamy przeglądarce
    if (url.searchParams.has('probe')) return;          // test łączności z 404.html - ma iść prosto do sieci

    // Nawigacja (wejście na stronę): sieć -> a gdy jej brak, ekran offline 404.html
    if (req.mode === 'navigate') {
        event.respondWith(
            fetch(req, { cache: 'no-store' }).catch(() =>
                caches.match(OFFLINE_PAGE).then(
                    (r) =>
                        r ??
                        new Response('Offline', {
                            status: 503,
                            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
                        })
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
            .catch(async () => (await caches.match(req)) ?? Response.error())
    );
});
