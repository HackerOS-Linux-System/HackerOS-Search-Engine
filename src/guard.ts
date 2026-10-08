export {};

// Strażnik offline - współdzielony przez index.html (wszystkie motywy) i blue.html.
//
// Jak to działa (trzy warstwy, żeby ekran "brak internetu" pokazał się zawsze, gdy się da):
//  1. Service Worker (sw.ts) trzyma offline.html w cache i podstawia go, gdy strona nie może się załadować
//     (wejście na stronę bez internetu - działa, o ile strona była choć raz otwarta online).
//  2. localStorage trzyma KOPIĘ offline.html (klucz hackeros_offline_html) oraz stan: motyw, wariant (main/blue),
//     adres strony głównej i czas ostatniego połączenia. Dzięki temu, gdy internet zniknie na otwartej stronie,
//     ekran offline jest wstawiany od razu z pamięci przeglądarki - bez żadnego zapytania do sieci.
//  3. Gdy nie ma ani kopii, ani Service Workera - przechodzimy zwykłym linkiem na offline.html.

export type Variant = 'main' | 'blue';

export const LS = {
    root: 'hackeros_root',
    variant: 'hackeros_variant',
    lastOnline: 'hackeros_last_online',
    html: 'hackeros_offline_html',
} as const;

function lsGet(key: string): string | null {
    try {
        return localStorage.getItem(key);
    } catch {
        return null;
    }
}

function lsSet(key: string, value: string): void {
    try {
        localStorage.setItem(key, value);
    } catch {
        /* localStorage niedostępny lub pełny */
    }
}

async function probe(): Promise<boolean> {
    if (!navigator.onLine) return false;
    if (location.protocol === 'file:') return true;
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 3500);
    try {
        // parametr "probe" jest pomijany przez Service Worker -> zapytanie idzie prawdziwie do sieci
        await fetch(`${location.pathname}?probe=${Date.now()}`, { method: 'HEAD', cache: 'no-store', signal: ctl.signal });
        return true;
    } catch {
        return false;
    } finally {
        clearTimeout(timer);
    }
}

export function initOfflineGuard(variant: Variant, rootUrl: string): void {
    lsSet(LS.root, rootUrl);
    lsSet(LS.variant, variant);

    const markOnline = (): void => lsSet(LS.lastOnline, String(Date.now()));

    // Zapisujemy kopię ekranu offline w localStorage (odświeżana przy każdym wejściu online)
    async function saveOfflinePage(): Promise<void> {
        if (location.protocol === 'file:' || !navigator.onLine) return;
        try {
            const res = await fetch('offline.html', { cache: 'no-cache' });
            if (!res.ok) return;
            const text = await res.text();
            // sprawdzamy znacznik, żeby nie zapisać przypadkiem strony 404 / błędu
            if (text.includes('name="hackeros-offline"')) lsSet(LS.html, text);
        } catch {
            /* brak sieci - zostaje poprzednia kopia */
        }
    }

    let shown = false;
    function showOffline(): void {
        if (shown) return;
        shown = true;
        const saved = lsGet(LS.html);
        if (saved) {
            // ekran offline z pamięci przeglądarki - bez dotykania sieci
            document.open();
            document.write(saved);
            document.close();
            return;
        }
        location.href = 'offline.html';
    }

    let checking = false;
    async function check(): Promise<void> {
        if (checking || shown) return;
        checking = true;
        try {
            if (await probe()) {
                markOnline();
                return; // sieć działa - zostajemy na stronie
            }
            showOffline();
        } finally {
            checking = false;
        }
    }

    markOnline();
    void saveOfflinePage();

    window.addEventListener('offline', () => void check());
    window.addEventListener('online', markOnline);
    if (!navigator.onLine) void check();

    // Wi-Fi bez dostępu do internetu nie wywołuje zdarzenia "offline" - dlatego co 30 s cicho sprawdzamy łączność
    setInterval(() => {
        if (!document.hidden) void check();
    }, 30000);
}
