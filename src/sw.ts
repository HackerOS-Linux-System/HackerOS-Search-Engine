export {};

declare const __BUILD_ID__: string;

// Service Worker - typujemy globalny obiekt ręcznie
const sw = self as unknown as ServiceWorkerGlobalScope;

const CACHE = `hackeros-search-${__BUILD_ID__}`;
// Dwa osobne ekrany offline - po jednym na wariant strony:
//   blue.html            -> offline.html (Blue Edition)
//   index.html i reszta  -> 404.html     (zwykła strona: terminal + glitch + motywy)
const OFFLINE_BLUE = 'offline.html';
const OFFLINE_MAIN = '404.html';
const PRECACHE: readonly string[] = [
    'offline.html',
    '404.html',
    'index.html',
    'styles.css',
    'script.js',
    'blue.html',
    'blue.css',
    'blue.js',
];

sw.addEventListener('install', (event: ExtendableEvent) => {
    event.waitUntil(
        caches.open(CACHE)
            .then((cache) =>
                // pojedynczo, żeby brak jednego pliku (np. script.js) nie blokował instalacji SW
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

    // Nawigacja (wejście na stronę): sieć -> a gdy jej brak, ekran offline PASUJĄCY DO WARIANTU strony:
    // blue.html dostaje offline.html, zwykła strona (index.html, motywy) - 404.html (który sam bierze motyw z localStorage).
    // Service Worker nie ma dostępu do localStorage, dlatego wariant rozpoznaje po adresie. Na końcu prosty tekst.
    if (req.mode === 'navigate') {
        const isBlue = /\/blue(\.html)?$/.test(url.pathname);
        const [first, second] = isBlue ? [OFFLINE_BLUE, OFFLINE_MAIN] : [OFFLINE_MAIN, OFFLINE_BLUE];
        event.respondWith(
            fetch(req, { cache: 'no-store' }).catch(async () => {
                return (
                    (await caches.match(first)) ??
                    (await caches.match(second)) ??
                    new Response('Offline', {
                        status: 503,
                        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
                    })
                );
            })
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
