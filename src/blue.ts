export {};

// Blue Search - logika ukrytej podstrony blue.html (gwiazdy, zegar, launcher, ustawienia)

interface Star {
    x: number;
    y: number;
    r: number;
    base: number;
    speed: number;
    phase: number;
    glint: boolean;
}

interface AppEntry {
    name: string;
    desc: string;
    url: string;
    keys: string;
}

const isPl: boolean = (navigator.language || 'en').toLowerCase().startsWith('pl');

const TXT = {
    searchPh: isPl ? 'Wyszukaj w Ecosia...' : 'Search with Ecosia...',
    appsPh: isPl ? 'Szukaj aplikacji...' : 'Search apps...',
    clock24: isPl ? 'Zegar 24-godzinny' : '24-hour clock',
    twinkle: isPl ? 'Migotanie gwiazd' : 'Twinkling stars',
    settings: isPl ? 'Ustawienia' : 'Settings',
    docs: isPl ? 'Dokumentacja' : 'Documentation',
    noApps: isPl ? 'Brak wyników' : 'No results',
    online: isPl ? 'Połączono z internetem' : 'Connected',
    offline: isPl ? 'Brak połączenia z internetem' : 'No internet connection',
};

const APPS: readonly AppEntry[] = [
    {
        name: 'HackerOS',
        desc: isPl ? 'Strona systemu' : 'Project website',
        url: 'https://hackeros-linux-system.github.io/HackerOS-Website/',
        keys: 'hackeros website strona system',
    },
    {
        name: TXT.docs,
        desc: isPl ? 'Narzędzia i ekosystem' : 'Tools and ecosystem',
        url: 'https://hackeros-linux-system.github.io/HackerOS-Website/tools-docs/index.html',
        keys: 'docs documentation dokumentacja narzedzia tools ecosystem ekosystem',
    },
    {
        name: 'GitHub',
        desc: 'HackerOS-Linux-System',
        url: 'https://github.com/HackerOS-Linux-System',
        keys: 'github git repo repozytorium code kod',
    },
    {
        name: 'Ecosia',
        desc: isPl ? 'Wyszukiwarka' : 'Search engine',
        url: 'https://www.ecosia.org',
        keys: 'ecosia search szukaj wyszukiwarka',
    },
    {
        name: isPl ? 'Podgląd ekranu offline' : 'Offline screen preview',
        desc: '404.html?offline',
        url: '404.html?offline',
        keys: 'offline 404 podglad preview',
    },
];

function $<T extends HTMLElement>(id: string): T {
    const el = document.getElementById(id);
    if (!el) throw new Error(`blue.ts: brak elementu #${id}`);
    return el as T;
}

function readFlag(key: string, fallback: boolean): boolean {
    try {
        const v = localStorage.getItem(key);
        if (v === '1') return true;
        if (v === '0') return false;
    } catch {
        /* localStorage niedostępny */
    }
    return fallback;
}

function writeFlag(key: string, value: boolean): void {
    try {
        localStorage.setItem(key, value ? '1' : '0');
    } catch {
        /* localStorage niedostępny */
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let use24h = readFlag('blue_24h', isPl);
    let twinkle = readFlag('blue_twinkle', !reduceMotion);

    // --- teksty zależne od języka ---
    document.documentElement.lang = isPl ? 'pl' : 'en';
    const searchInput = $<HTMLInputElement>('searchInput');
    const searchForm = $<HTMLFormElement>('searchForm');
    searchInput.placeholder = TXT.searchPh;
    $<HTMLInputElement>('launcherInput').placeholder = TXT.appsPh;
    $('opt24hLabel').textContent = TXT.clock24;
    $('optMotionLabel').textContent = TXT.twinkle;
    $('settingsBtn').title = TXT.settings;
    $('dockDocs').title = TXT.docs;
    $('settingsPanel').setAttribute('aria-label', TXT.settings);

    // Po powrocie z ekranu offline wracamy na blue.html, a nie na index.html
    try {
        localStorage.setItem('hackeros_root', location.href.split(/[?#]/)[0]);
    } catch {
        /* localStorage niedostępny */
    }

    // --- niebo z gwiazdami ---
    const canvas = $<HTMLCanvasElement>('sky');
    const ctx = canvas.getContext('2d');
    let stars: Star[] = [];
    let w = 0;
    let h = 0;
    let rafId = 0;

    function buildStars(): void {
        const count = Math.min(520, Math.round((w * h) / 2800));
        stars = [];
        for (let i = 0; i < count; i++) {
            const big = Math.random() < 0.012;
            const mid = !big && Math.random() < 0.12;
            stars.push({
                x: Math.random() * w,
                y: Math.random() * h,
                r: big ? 1.5 + Math.random() * 0.8 : mid ? 0.9 + Math.random() * 0.5 : 0.35 + Math.random() * 0.45,
                base: big ? 0.95 : mid ? 0.65 + Math.random() * 0.3 : 0.25 + Math.random() * 0.45,
                speed: 0.4 + Math.random() * 1.4,
                phase: Math.random() * Math.PI * 2,
                glint: big,
            });
        }
    }

    function drawSky(t: number): void {
        if (!ctx) return;
        ctx.clearRect(0, 0, w, h);
        for (const s of stars) {
            const k = twinkle ? 0.78 + 0.22 * Math.sin(t * 0.001 * s.speed + s.phase) : 1;
            const a = s.base * k;
            if (s.glint) {
                const halo = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r * 5);
                halo.addColorStop(0, `rgba(150, 190, 255, ${0.28 * a})`);
                halo.addColorStop(1, 'rgba(150, 190, 255, 0)');
                ctx.fillStyle = halo;
                ctx.fillRect(s.x - s.r * 5, s.y - s.r * 5, s.r * 10, s.r * 10);
                ctx.strokeStyle = `rgba(190, 215, 255, ${0.45 * a})`;
                ctx.lineWidth = 0.6;
                ctx.beginPath();
                ctx.moveTo(s.x - s.r * 4.5, s.y);
                ctx.lineTo(s.x + s.r * 4.5, s.y);
                ctx.moveTo(s.x, s.y - s.r * 4.5);
                ctx.lineTo(s.x, s.y + s.r * 4.5);
                ctx.stroke();
            }
            ctx.fillStyle = `rgba(${s.r > 1 ? '215, 230, 255' : '200, 218, 255'}, ${a})`;
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    function loop(t: number): void {
        drawSky(t);
        rafId = twinkle && !document.hidden ? requestAnimationFrame(loop) : 0;
    }

    function startSky(): void {
        cancelAnimationFrame(rafId);
        rafId = 0;
        if (twinkle && !document.hidden) rafId = requestAnimationFrame(loop);
        else drawSky(0);
    }

    function resize(): void {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        w = window.innerWidth;
        h = window.innerHeight;
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
        ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
        buildStars();
        startSky();
    }
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', startSky);
    resize();

    // --- zegar ---
    const clock = $<HTMLTimeElement>('clock');
    function tick(): void {
        const now = new Date();
        clock.textContent = now.toLocaleTimeString(isPl ? 'pl-PL' : 'en-US', {
            hour: use24h ? '2-digit' : 'numeric',
            minute: '2-digit',
            hour12: !use24h,
        });
        clock.dateTime = now.toISOString();
        clock.title = now.toLocaleDateString(isPl ? 'pl-PL' : 'en-US', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
        });
    }
    tick();
    setInterval(tick, 1000);

    // --- stan sieci ---
    const net = $('net');
    function updateNet(): void {
        const on = navigator.onLine;
        net.classList.toggle('off', !on);
        net.title = on ? TXT.online : TXT.offline;
    }
    window.addEventListener('online', updateNet);
    window.addEventListener('offline', () => {
        updateNet();
        // Service Worker podmieni stronę na 404.html (ekran offline)
        if (navigator.serviceWorker?.controller) location.reload();
    });
    updateNet();

    // --- ustawienia ---
    const settingsBtn = $<HTMLButtonElement>('settingsBtn');
    const settingsPanel = $('settingsPanel');
    const opt24h = $<HTMLInputElement>('opt24h');
    const optMotion = $<HTMLInputElement>('optMotion');
    opt24h.checked = use24h;
    optMotion.checked = twinkle;

    function toggleSettings(open: boolean): void {
        settingsPanel.hidden = !open;
        settingsBtn.setAttribute('aria-expanded', String(open));
    }
    settingsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleSettings(settingsPanel.hidden);
    });
    settingsPanel.addEventListener('click', (e) => e.stopPropagation());
    opt24h.addEventListener('change', () => {
        use24h = opt24h.checked;
        writeFlag('blue_24h', use24h);
        tick();
    });
    optMotion.addEventListener('change', () => {
        twinkle = optMotion.checked;
        writeFlag('blue_twinkle', twinkle);
        startSky();
    });

    // --- launcher aplikacji ("Search apps...") ---
    const launcherInput = $<HTMLInputElement>('launcherInput');
    const list = $<HTMLUListElement>('launcherList');
    let active = 0;

    function matches(q: string): AppEntry[] {
        const needle = q.trim().toLowerCase();
        if (!needle) return [...APPS];
        return APPS.filter((a) => `${a.name} ${a.desc} ${a.keys}`.toLowerCase().includes(needle));
    }

    function renderList(): void {
        const found = matches(launcherInput.value);
        active = Math.min(active, Math.max(found.length - 1, 0));
        list.replaceChildren();
        if (found.length === 0) {
            const li = document.createElement('li');
            li.className = 'none';
            li.textContent = TXT.noApps;
            list.append(li);
            return;
        }
        found.forEach((app, i) => {
            const li = document.createElement('li');
            li.setAttribute('role', 'presentation');
            const a = document.createElement('a');
            a.href = app.url;
            a.setAttribute('role', 'option');
            a.setAttribute('aria-selected', String(i === active));
            if (/^https?:/.test(app.url)) {
                a.target = '_blank';
                a.rel = 'noopener';
            }
            const name = document.createElement('span');
            name.textContent = app.name;
            const desc = document.createElement('small');
            desc.textContent = app.desc;
            a.append(name, desc);
            li.append(a);
            list.append(li);
        });
    }

    function openList(open: boolean): void {
        list.hidden = !open;
        launcherInput.setAttribute('aria-expanded', String(open));
        if (open) renderList();
    }

    launcherInput.addEventListener('focus', () => openList(true));
    launcherInput.addEventListener('input', () => {
        active = 0;
        renderList();
    });
    launcherInput.addEventListener('keydown', (e: KeyboardEvent) => {
        const found = matches(launcherInput.value);
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            if (found.length === 0) return;
            active = (active + (e.key === 'ArrowDown' ? 1 : -1) + found.length) % found.length;
            renderList();
        } else if (e.key === 'Enter') {
            e.preventDefault();
            const app = found[active];
            if (app) {
                if (/^https?:/.test(app.url)) window.open(app.url, '_blank', 'noopener');
                else location.href = app.url;
            }
        } else if (e.key === 'Escape') {
            launcherInput.blur();
        }
    });

    // zamykanie okienek po kliknięciu poza nimi
    document.addEventListener('click', (e: MouseEvent) => {
        const target = e.target as Node;
        if (!$('launcher').contains(target)) openList(false);
        toggleSettings(false);
    });

    // --- wyszukiwanie ---
    searchForm.addEventListener('submit', (e: SubmitEvent) => {
        if (!searchInput.value.trim()) {
            e.preventDefault();
            searchInput.focus();
        }
    });

    // skróty: "/" lub Ctrl+K - launcher, Esc - zamknij, dowolny znak - pisz w wyszukiwarce
    document.addEventListener('keydown', (e: KeyboardEvent) => {
        const typing = document.activeElement instanceof HTMLInputElement;
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
            e.preventDefault();
            launcherInput.focus();
        } else if (e.key === 'Escape') {
            toggleSettings(false);
            openList(false);
            if (typing) (document.activeElement as HTMLInputElement).blur();
        } else if (!typing && !e.ctrlKey && !e.metaKey && !e.altKey && e.key.length === 1) {
            searchInput.focus();
        }
    });

    // --- Service Worker (ten sam sw.js co dla index.html) ---
    const swAllowed =
        location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    if ('serviceWorker' in navigator && swAllowed) {
        navigator.serviceWorker.register('sw.js').catch((err: unknown) => {
            console.warn('Service Worker registration failed:', err);
        });
    }
});
