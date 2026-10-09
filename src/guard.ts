export {};

// Strażnik offline - współdzielony przez index.html (wszystkie motywy) i blue.html.
//
// Każdy wariant strony ma WŁASNY ekran offline:
//   - main (index.html) -> 404.html    (terminal + glitch, motywy: default/space/cyber/matrix/sunset)
//   - blue (blue.html)  -> offline.html (dialog "Blue Edition")
//
// Jak to działa (trzy warstwy, żeby ekran "brak internetu" pokazał się zawsze, gdy się da):
//  1. Service Worker (sw.ts) trzyma oba ekrany w cache i podstawia właściwy, gdy strona nie może się załadować
//     (wybór po adresie: blue.html -> offline.html, reszta -> 404.html; działa, o ile strona była choć raz otwarta online).
//  2. localStorage trzyma KOPIĘ ekranu offline OSOBNO dla każdego wariantu (hackeros_offline_html_main / _blue)
//     oraz stan: adres strony głównej danego wariantu i czas ostatniego połączenia. Dzięki temu, gdy internet zniknie
//     na otwartej stronie, ekran offline jest wstawiany od razu z pamięci przeglądarki - bez zapytania do sieci.
//  3. Gdy nie ma ani kopii, ani Service Workera - przechodzimy zwykłym linkiem na plik offline danego wariantu.

export type Variant = 'main' | 'blue';

export const LS = {
    root: 'hackeros_root', // ostatnio odwiedzony wariant (zgodność wsteczna)
    rootMain: 'hackeros_root_main',
    rootBlue: 'hackeros_root_blue',
    variant: 'hackeros_variant',
    lastOnline: 'hackeros_last_online',
    htmlMain: 'hackeros_offline_html_main',
    htmlBlue: 'hackeros_offline_html_blue',
    htmlLegacy: 'hackeros_offline_html', // stara, wspólna kopia - usuwana
} as const;

interface VariantConfig {
    file: string; // plik z ekranem offline
    fallbackUrl: string; // gdzie przejść, gdy nie ma kopii w localStorage
    rootKey: string;
    htmlKey: string;
}

const CONFIG: Record<Variant, VariantConfig> = {
    main: { file: '404.html', fallbackUrl: '404.html?lost', rootKey: LS.rootMain, htmlKey: LS.htmlMain },
    blue: { file: 'offline.html', fallbackUrl: 'offline.html', rootKey: LS.rootBlue, htmlKey: LS.htmlBlue },
};

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

function lsRemove(key: string): void {
    try {
        localStorage.removeItem(key);
    } catch {
        /* localStorage niedostępny */
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
    const cfg: VariantConfig = CONFIG[variant];

    lsSet(LS.root, rootUrl);
    lsSet(cfg.rootKey, rootUrl);
    lsSet(LS.variant, variant);
    lsRemove(LS.htmlLegacy);

    const markOnline = (): void => lsSet(LS.lastOnline, String(Date.now()));

    // Zapisujemy kopię ekranu offline TEGO wariantu w localStorage (odświeżana przy każdym wejściu online)
    async function saveOfflinePage(): Promise<void> {
        if (location.protocol === 'file:' || !navigator.onLine) return;
        try {
            const res = await fetch(cfg.file, { cache: 'no-cache' });
            if (!res.ok) return;
            const text = await res.text();
            // sprawdzamy znacznik, żeby nie zapisać przypadkiem strony błędu
            if (text.includes('name="hackeros-offline"')) lsSet(cfg.htmlKey, text);
        } catch {
            /* brak sieci - zostaje poprzednia kopia */
        }
    }

    let shown = false;
    function showOffline(): void {
        if (shown) return;
        shown = true;
        const saved = lsGet(cfg.htmlKey);
        if (saved) {
            // ekran offline z pamięci przeglądarki - bez dotykania sieci
            document.open();
            document.write(saved);
            document.close();
            return;
        }
        location.href = cfg.fallbackUrl;
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
