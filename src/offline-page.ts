export {};

// Logika offline.html - dialog "brak internetu" dla BLUE EDITION (blue.html).
// Zwykła strona (index.html, wszystkie motywy) ma osobny ekran: 404.html / src/offline.ts.
// Kod jest kompilowany i wstawiany INLINE do offline.html (patrz scripts/build.ts),
// dzięki czemu ekran działa w pełni samodzielnie, także bez internetu.

type Theme = 'default' | 'space' | 'cyber' | 'matrix' | 'sunset' | 'blue';
type Lang = 'pl' | 'en';

interface Texts {
    title: Record<Theme, string>;
    desc: Record<Theme, string>;
    retry: string;
    trying: string;
    checking: string;
    nextIn: (s: number) => string;
    lastOnline: (when: string, ago: string) => string;
    never: string;
    restoredTitle: string;
    restoredDesc: string;
    restoredStatus: string;
    previewStatus: string;
    ago: (min: number) => string;
    justNow: string;
    hint: string;
}

interface Star {
    x: number;
    y: number;
    r: number;
    p: number;
    s: number;
    v: number;
}

interface Dot {
    x: number;
    y: number;
    vx: number;
    vy: number;
    r: number;
    h: number;
}

(() => {
    'use strict';

    const $ = <T extends HTMLElement = HTMLElement>(id: string): T => {
        const el = document.getElementById(id);
        if (!el) throw new Error(`offline.html: brak elementu #${id}`);
        return el as T;
    };
    const rnd = (a: number, b: number): number => Math.random() * (b - a) + a;
    const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

    const THEMES: readonly Theme[] = ['default', 'space', 'cyber', 'matrix', 'sunset', 'blue'];
    const isTheme = (v: unknown): v is Theme => typeof v === 'string' && (THEMES as readonly string[]).includes(v);
    const ls = (key: string): string | null => {
        try {
            return localStorage.getItem(key);
        } catch {
            return null;
        }
    };

    const params = new URLSearchParams(location.search);
    const preview: boolean = params.has('preview');
    const reduce: boolean = !!window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const lang: Lang = (navigator.language || 'en').toLowerCase().startsWith('pl') ? 'pl' : 'en';

    /* ------------------------------------------------------------------ motyw: ten ekran to Blue Edition */
    // Ekran jest teraz zawsze w stylu Blue - motyw zwykłej strony obsługuje 404.html.
    // Pozostałe motywy zostają tylko jako podgląd: offline.html?preview&theme=matrix
    function detectTheme(): Theme {
        const q = params.get('theme');
        return isTheme(q) ? q : 'blue';
    }
    const theme: Theme = detectTheme();
    document.body.classList.add('t-' + theme);
    document.documentElement.lang = lang;

    /* ------------------------------------------------------------------ teksty */
    const ALL: Record<Lang, Texts> = {
        pl: {
            title: { default: 'Brak internetu', space: 'Utrata sygnału', cyber: 'Łącze zerwane', matrix: 'Rozłączono', sunset: 'Brak sygnału', blue: 'Brak internetu' },
            desc: {
                default: 'Brak połączenia z internetem. Sprawdź <b>kabel, Wi-Fi lub router</b> - wrócimy, gdy tylko sieć znów zadziała.',
                space: 'Houston, mamy problem. <b>Łączność z Ziemią</b> została przerwana. Wracamy na orbitę, gdy sygnał się odnajdzie.',
                cyber: 'Uplink zerwany przez nieznany proces. <b>ICE</b> odcięło Twoje łącze. Trwa próba odzyskania dostępu...',
                matrix: 'Obudź się... Matrix stracił z Tobą kontakt. <b>Podążaj za białym królikiem</b> - czyli sprawdź kabel.',
                sunset: 'Śledzenie taśmy zgubione. <b>Sprawdź kabel</b> albo dmuchnij w kasetę i poczekaj na sygnał.',
                blue: 'Utraciliśmy łączność z siecią. Sprawdź <b>kabel, Wi-Fi lub router</b> - Blue wróci, gdy tylko internet znów zadziała.',
            },
            retry: 'Spróbuj ponownie',
            trying: 'Łączenie...',
            checking: 'Sprawdzanie połączenia...',
            nextIn: (s) => `Kolejna próba za ${s}s`,
            lastOnline: (w, a) => `Ostatnio online: <strong>${w}</strong> (${a})`,
            never: 'Ostatnie połączenie: brak danych',
            restoredTitle: 'Połączono!',
            restoredDesc: 'Internet wrócił. <b>Wracam do wyszukiwarki...</b>',
            restoredStatus: 'Połączenie przywrócone',
            previewStatus: 'Tryb podglądu - dialog nie zniknie sam',
            ago: (m) => `${m} min temu`,
            justNow: 'przed chwilą',
            hint: 'Ta strona jest zapisana w pamięci przeglądarki i działa bez internetu.',
        },
        en: {
            title: { default: 'No internet', space: 'Signal lost', cyber: 'Link severed', matrix: 'Disconnected', sunset: 'No signal', blue: 'No internet' },
            desc: {
                default: 'No internet connection. Check your <b>cable, Wi-Fi or router</b> - we will be back as soon as the network is.',
                space: 'Houston, we have a problem. The <b>link to Earth</b> is down. We will re-enter orbit once the signal returns.',
                cyber: 'Uplink cut by an unknown process. <b>ICE</b> severed your connection. Attempting to regain access...',
                matrix: 'Wake up... the Matrix has lost you. <b>Follow the white rabbit</b> - or just check your cable.',
                sunset: 'Tracking lost. <b>Check the cable</b> or blow on the cartridge and wait for the signal.',
                blue: 'We lost the connection to the network. Check your <b>cable, Wi-Fi or router</b> - Blue returns as soon as the internet does.',
            },
            retry: 'Try again',
            trying: 'Connecting...',
            checking: 'Checking connection...',
            nextIn: (s) => `Next attempt in ${s}s`,
            lastOnline: (w, a) => `Last online: <strong>${w}</strong> (${a})`,
            never: 'Last connection: no data',
            restoredTitle: 'Connected!',
            restoredDesc: 'The internet is back. <b>Heading back to the search engine...</b>',
            restoredStatus: 'Connection restored',
            previewStatus: 'Preview mode - the dialog will not close by itself',
            ago: (m) => `${m} min ago`,
            justNow: 'just now',
            hint: 'This page is stored in your browser and works without internet.',
        },
    };
    const TXT: Texts = ALL[lang];

    /* ------------------------------------------------------------------ elementy */
    const card = $('card');
    const titleEl = $('dlgTitle');
    const descEl = $('dlgDesc');
    const statusEl = $('statusLine');
    const lastEl = $('lastOnline');
    const barFill = $('barFill');
    const retryBtn = $<HTMLButtonElement>('retry');
    $('hint').textContent = TXT.hint;

    const RETRY_EVERY = 5;
    let countdown = RETRY_EVERY;
    let busy = false;
    let restoredFlag = false;

    /* ------------------------------------------------------------------ adres powrotu */
    function homeUrl(): string {
        // wracamy na blue.html (adres zapisany przez guard.ts), a nie na zwykłą stronę główną
        const r = ls('hackeros_root_blue');
        if (r) return r;
        const seg = location.pathname.split('/').filter(Boolean)[0];
        if (location.hostname.endsWith('.github.io') && seg && !seg.endsWith('.html')) {
            return location.origin + '/' + seg + '/blue.html';
        }
        return /offline\.html$/.test(location.pathname) ? 'blue.html' : location.href.split(/[?#]/)[0];
    }

    /* ------------------------------------------------------------------ test łączności */
    async function probe(): Promise<boolean> {
        if (preview) {
            await sleep(600);
            return false;
        }
        if (!navigator.onLine) return false;
        if (location.protocol === 'file:') return true;
        const ctl = new AbortController();
        const to = setTimeout(() => ctl.abort(), 3500);
        try {
            // parametr "probe" jest pomijany przez Service Worker -> zapytanie idzie prawdziwie do sieci
            await fetch(location.pathname + '?probe=' + Date.now(), { method: 'HEAD', cache: 'no-store', signal: ctl.signal });
            return true;
        } catch {
            return false;
        } finally {
            clearTimeout(to);
        }
    }

    /* ------------------------------------------------------------------ render */
    function renderLastOnline(): void {
        const raw = ls('hackeros_last_online');
        const ts = raw ? Number(raw) : NaN;
        if (!Number.isFinite(ts) || ts <= 0) {
            lastEl.textContent = TXT.never;
            return;
        }
        const d = new Date(ts);
        const when = d.toLocaleTimeString(lang === 'pl' ? 'pl-PL' : 'en-US', { hour: '2-digit', minute: '2-digit' });
        const min = Math.floor((Date.now() - ts) / 60000);
        lastEl.innerHTML = TXT.lastOnline(when, min < 1 ? TXT.justNow : TXT.ago(min));
    }

    function renderOffline(): void {
        card.classList.remove('ok');
        titleEl.textContent = TXT.title[theme];
        descEl.innerHTML = TXT.desc[theme];
        document.title = (theme === 'blue' ? 'Blue Search' : 'HackerOS Search') + ' | ' + TXT.title[theme];
        retryBtn.textContent = TXT.retry;
        barFill.style.width = ((RETRY_EVERY - countdown) / RETRY_EVERY) * 100 + '%';
        renderLastOnline();
    }

    function renderCountdown(): void {
        statusEl.textContent = preview ? TXT.previewStatus : TXT.nextIn(countdown);
        barFill.style.width = ((RETRY_EVERY - countdown) / RETRY_EVERY) * 100 + '%';
    }

    function restored(): void {
        restoredFlag = true;
        card.classList.add('ok');
        titleEl.textContent = TXT.restoredTitle;
        descEl.innerHTML = TXT.restoredDesc;
        statusEl.textContent = TXT.restoredStatus;
        setTimeout(() => {
            // otwarty jako osobna strona -> wracamy do wyszukiwarki; wstawiony w miejsce strony -> odświeżamy ją
            if (/offline\.html$/.test(location.pathname)) location.replace(homeUrl());
            else location.reload();
        }, 1300);
    }

    async function reconnect(): Promise<void> {
        if (busy || restoredFlag) return;
        busy = true;
        retryBtn.disabled = true;
        statusEl.textContent = TXT.trying;
        const ok = await probe();
        busy = false;
        retryBtn.disabled = false;
        if (ok) {
            restored();
            return;
        }
        countdown = RETRY_EVERY;
        renderCountdown();
    }

    setInterval(() => {
        if (busy || restoredFlag) return;
        countdown--;
        if (countdown <= 0) {
            void reconnect();
            return;
        }
        renderCountdown();
        renderLastOnline();
    }, 1000);

    retryBtn.addEventListener('click', () => {
        countdown = 0;
        void reconnect();
    });
    document.addEventListener('keydown', (e: KeyboardEvent) => {
        if ((e.key === 'r' || e.key === 'R') && !e.ctrlKey && !e.metaKey) void reconnect();
    });
    window.addEventListener('online', () => void reconnect());

    /* ------------------------------------------------------------------ tło (canvas) - osobne dla każdego trybu */
    const bg = $<HTMLCanvasElement>('bg');
    const c = bg.getContext('2d') as CanvasRenderingContext2D;
    let W = 0;
    let H = 0;
    let stars: Star[] = [];
    let dots: Dot[] = [];
    let drops: number[] = [];
    let gridOff = 0;
    const FS = 16;
    const MCH = [...'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ0123456789'];

    function makeDots(n: number, h0: number, h1: number, sp: number): Dot[] {
        return Array.from({ length: n }, () => ({ x: rnd(0, W), y: rnd(0, H), vx: rnd(-sp, sp), vy: rnd(-sp, sp), r: rnd(1, 2.4), h: rnd(h0, h1) }));
    }

    function initScene(): void {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        W = innerWidth;
        H = innerHeight;
        bg.width = W * dpr;
        bg.height = H * dpr;
        c.setTransform(dpr, 0, 0, dpr, 0, 0);
        stars = [];
        dots = [];
        drops = [];
        if (theme === 'space' || theme === 'blue') {
            const n = Math.min(theme === 'blue' ? 520 : 280, Math.floor((W * H) / (theme === 'blue' ? 2800 : 5500)));
            stars = Array.from({ length: n }, () => {
                const r = theme === 'blue' ? rnd(0.3, 1.3) : rnd(0.3, 1.5);
                return { x: rnd(0, W), y: rnd(0, H), r, p: rnd(0, 6.28), s: rnd(0.4, 1.6), v: 0.01 + r * 0.02 };
            });
        } else if (theme === 'matrix') {
            drops = Array.from({ length: Math.ceil(W / FS) }, () => rnd(-40, 0));
        } else if (theme === 'cyber') {
            dots = makeDots(36, 170, 310, 0.25);
        } else if (theme === 'sunset') {
            dots = makeDots(40, 10, 45, 0.18);
        } else {
            dots = makeDots(50, 200, 230, 0.15);
        }
    }

    function drawDots(links: boolean, dist: number, step: boolean): void {
        for (const p of dots) {
            if (step) {
                p.x += p.vx;
                p.y += p.vy;
                if (p.x < 0 || p.x > W) p.vx *= -1;
                if (p.y < 0 || p.y > H) p.vy *= -1;
            }
            c.fillStyle = `hsla(${p.h},70%,60%,.55)`;
            c.beginPath();
            c.arc(p.x, p.y, p.r, 0, 6.2832);
            c.fill();
        }
        if (!links) return;
        c.lineWidth = 0.5;
        for (let i = 0; i < dots.length; i++) {
            for (let j = i + 1; j < dots.length; j++) {
                const d = Math.hypot(dots[i].x - dots[j].x, dots[i].y - dots[j].y);
                if (d < dist) {
                    c.strokeStyle = `hsla(${dots[i].h},70%,60%,${(1 - d / dist) * 0.25})`;
                    c.beginPath();
                    c.moveTo(dots[i].x, dots[i].y);
                    c.lineTo(dots[j].x, dots[j].y);
                    c.stroke();
                }
            }
        }
    }

    function drawStars(t: number, dt: number): void {
        c.clearRect(0, 0, W, H);
        const rgb = theme === 'blue' ? '200,218,255' : '255,255,255';
        for (const s of stars) {
            if (!reduce) {
                s.x -= s.v * dt * 0.06 * 16;
                if (s.x < 0) {
                    s.x = W;
                    s.y = rnd(0, H);
                }
            }
            const a = reduce ? 0.7 : 0.35 + 0.65 * Math.abs(Math.sin(t * 0.001 * s.s + s.p));
            c.fillStyle = `rgba(${rgb},${a})`;
            c.beginPath();
            c.arc(s.x, s.y, s.r, 0, 6.2832);
            c.fill();
        }
    }

    let matrixAcc = 0;
    function drawMatrix(dt: number): void {
        matrixAcc += dt;
        if (matrixAcc < 55) return;
        matrixAcc = 0;
        c.fillStyle = 'rgba(0,0,0,.10)';
        c.fillRect(0, 0, W, H);
        c.font = FS + 'px monospace';
        for (let i = 0; i < drops.length; i++) {
            const x = i * FS;
            const y = drops[i] * FS;
            if (y > 0) {
                c.fillStyle = 'rgba(0,255,102,.85)';
                c.fillText(MCH[(Math.random() * MCH.length) | 0], x, y - FS);
                c.fillStyle = '#d6ffe6';
                c.fillText(MCH[(Math.random() * MCH.length) | 0], x, y);
            }
            if (y > H && Math.random() > 0.975) drops[i] = 0;
            drops[i]++;
        }
    }

    function drawCyber(dt: number): void {
        c.clearRect(0, 0, W, H);
        const hy = H * 0.58;
        const sky = c.createLinearGradient(0, hy - 120, 0, hy);
        sky.addColorStop(0, 'rgba(255,0,255,0)');
        sky.addColorStop(1, 'rgba(255,0,255,.14)');
        c.fillStyle = sky;
        c.fillRect(0, hy - 120, W, 120);
        if (!reduce) gridOff = (gridOff + dt * 0.00035) % 1;
        c.lineWidth = 1;
        const rows = 14;
        for (let k = 0; k < rows; k++) {
            const f = (k + gridOff) / rows;
            const y = hy + (H - hy) * f * f;
            c.strokeStyle = `rgba(255,0,255,${0.08 + f * 0.4})`;
            c.beginPath();
            c.moveTo(0, y);
            c.lineTo(W, y);
            c.stroke();
        }
        const cols = 18;
        for (let i = -cols; i <= cols; i++) {
            c.strokeStyle = `rgba(0,255,255,${0.12 + (1 - Math.abs(i) / cols) * 0.25})`;
            c.beginPath();
            c.moveTo(W / 2 + i * 14, hy);
            c.lineTo(W / 2 + i * (W / cols) * 0.9, H);
            c.stroke();
        }
        c.strokeStyle = 'rgba(0,255,255,.7)';
        c.lineWidth = 1.5;
        c.beginPath();
        c.moveTo(0, hy);
        c.lineTo(W, hy);
        c.stroke();
        drawDots(true, 120, !reduce);
    }

    function drawSunset(t: number): void {
        c.clearRect(0, 0, W, H);
        const r = Math.min(W, H) * 0.2;
        const cx = W / 2;
        const cy = H * 0.7;
        const g = c.createLinearGradient(0, cy - r, 0, cy + r);
        g.addColorStop(0, 'rgba(255,214,107,.75)');
        g.addColorStop(1, 'rgba(255,77,141,.75)');
        c.fillStyle = g;
        c.beginPath();
        c.arc(cx, cy, r, 0, 6.2832);
        c.fill();
        c.globalCompositeOperation = 'destination-out';
        const sp = r * 0.2;
        const shift = reduce ? 0 : (t * 0.012) % sp;
        for (let j = 0; j < 9; j++) {
            const y = cy + r * 0.05 + j * sp - shift + sp;
            if (y > cy && y < cy + r) c.fillRect(cx - r, y, r * 2, 2 + j * 1.6);
        }
        c.globalCompositeOperation = 'source-over';
        drawDots(true, 100, !reduce);
    }

    let last = 0;
    function frame(t: number): void {
        // po wstawieniu ekranu w miejsce innej strony stary canvas może zniknąć - wtedy kończymy pętlę
        if (!bg.isConnected) return;
        requestAnimationFrame(frame);
        const dt = Math.min(60, t - last || 16);
        last = t;
        if (theme === 'space' || theme === 'blue') drawStars(t, dt);
        else if (theme === 'matrix') drawMatrix(dt);
        else if (theme === 'cyber') drawCyber(dt);
        else if (theme === 'sunset') drawSunset(t);
        else {
            c.clearRect(0, 0, W, H);
            drawDots(true, 110, !reduce);
        }
    }

    /* ------------------------------------------------------------------ start */
    initScene();
    window.addEventListener('resize', initScene);
    requestAnimationFrame(frame);
    renderOffline();
    statusEl.textContent = TXT.checking;
    retryBtn.focus();
    void reconnect();
})();
