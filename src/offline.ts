export {};

// Ekran offline / 404 dla HackerOS Search - wersja dla ZWYKŁEJ strony (index.html, wszystkie motywy).
// Blue Edition (blue.html) ma osobny ekran: offline.html / src/offline-page.ts.
// Kod jest kompilowany i wstawiany INLINE do 404.html (patrz scripts/build.ts),
// dzięki czemu strona działa w pełni samodzielnie, także bez internetu.

type Theme = 'default' | 'space' | 'cyber' | 'matrix' | 'sunset';
type Mode = 'check' | 'offline' | 'notfound' | 'restored';
type Lang = 'pl' | 'en';
type LineClass = 'cmd' | 'dim' | 'ok' | 'fail' | 'acc';

interface Strings {
    titles: { offline: Record<Theme, string>; notfound: string };
    sub: { offline: Record<Theme, string>; notfound: string };
    chip: { check: string; offline: string; notfound: string; ok: string };
    retry: string;
    home: string;
    retryIn: (s: number) => string;
    trying: string;
    connected: string;
    idle: string;
    attempt: string;
    failed: string;
    okWord: string;
    restored: string;
    docTitle: { offline: string; notfound: string };
    lastOnline: (when: string, ago: string) => string;
    lastNever: string;
    ago: (min: number) => string;
    justNow: string;
}

interface ScriptLine {
    cls: LineClass;
    prompt?: string;
    text: string;
    wait: number;
    type?: boolean;
}

interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    r: number;
    h: number;
}

interface Star {
    x: number;
    y: number;
    r: number;
    p: number;
    s: number;
    v: number;
}

interface Shoot {
    x: number;
    y: number;
    l: number;
    life: number;
}

interface Scene {
    fs: number;
    drops: number[];
    acc: number;
    stars: Star[];
    shoot: Shoot | null;
    off: number;
    parts: Particle[];
}

(() => {
    'use strict';

    const $ = <T extends HTMLElement = HTMLElement>(id: string): T => {
        const el = document.getElementById(id);
        if (!el) throw new Error(`Brak elementu #${id}`);
        return el as T;
    };
    const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
    const rnd = (a: number, b: number): number => Math.random() * (b - a) + a;
    const pick = <T,>(arr: readonly T[]): T => arr[(Math.random() * arr.length) | 0];

    const THEMES: readonly Theme[] = ['default', 'space', 'cyber', 'matrix', 'sunset'];
    const isTheme = (v: unknown): v is Theme => typeof v === 'string' && (THEMES as readonly string[]).includes(v);

    const reduce: boolean = !!window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const lang: Lang = (navigator.language || 'en').toLowerCase().startsWith('pl') ? 'pl' : 'en';
    const params = new URLSearchParams(location.search);
    const forcedOffline: boolean = params.has('offline'); // podgląd: tryb offline na stałe (bez prawdziwego testu sieci)
    const assumeOffline: boolean = params.has('lost'); // przekierowanie ze strony głównej: zakładamy brak sieci, ale i tak sprawdzamy

    let theme: Theme = 'default';
    try {
        const saved = localStorage.getItem('theme');
        if (isTheme(saved)) theme = saved;
    } catch {
        /* localStorage niedostępny */
    }
    const themeParam = params.get('theme');
    if (isTheme(themeParam)) theme = themeParam;

    /* ------------------------------------------------------------------ teksty */
    const ALL_TXT: Record<Lang, Strings> = {
        pl: {
            titles: {
                offline: { default: 'Offline', space: 'Utrata sygnału', cyber: 'Łącze zerwane', matrix: 'Rozłączono', sunset: 'Brak sygnału' },
                notfound: '404',
            },
            sub: {
                offline: {
                    default: 'Brak połączenia z internetem. Sprawdź <b>kabel, Wi-Fi lub router</b> - wrócimy, gdy tylko sieć znów zadziała.',
                    space: 'Houston, mamy problem. <b>Łączność z Ziemią</b> została przerwana. Wracamy na orbitę, gdy sygnał się odnajdzie.',
                    cyber: 'Uplink zerwany przez nieznany proces. <b>ICE</b> odcięło Twoje łącze. Trwa próba odzyskania dostępu...',
                    matrix: 'Obudź się... Matrix stracił z Tobą kontakt. <b>Podążaj za białym królikiem</b> - czyli sprawdź kabel.',
                    sunset: 'Śledzenie taśmy zgubione. <b>Sprawdź kabel</b> albo dmuchnij w kasetę i poczekaj na sygnał.',
                },
                notfound: 'Sieć działa, ale tej strony tu nie ma. <b>Ścieżka</b> nie istnieje albo została przeniesiona.',
            },
            chip: { check: 'SKANOWANIE SIECI', offline: 'OFFLINE', notfound: 'BŁĄD 404', ok: 'ONLINE' },
            retry: 'Spróbuj ponownie',
            home: 'Strona główna',
            retryIn: (s) => `kolejna próba za ${s}s`,
            trying: 'łączenie...',
            connected: 'połączono',
            idle: 'sieć dostępna',
            attempt: 'próba połączenia',
            failed: 'NIEUDANA',
            okWord: 'OK',
            restored: '[  OK  ] łącze przywrócone - wracam do wyszukiwarki...',
            docTitle: { offline: 'HackerOS Search | Offline', notfound: 'HackerOS Search | 404' },
            lastOnline: (w, a) => `> ostatnio online: ${w} (${a})`,
            lastNever: '> ostatnie połączenie: brak danych',
            ago: (m) => `${m} min temu`,
            justNow: 'przed chwilą',
        },
        en: {
            titles: {
                offline: { default: 'Offline', space: 'Signal lost', cyber: 'Link severed', matrix: 'Disconnected', sunset: 'No signal' },
                notfound: '404',
            },
            sub: {
                offline: {
                    default: 'No internet connection. Check your <b>cable, Wi-Fi or router</b> - we will be back as soon as the network is.',
                    space: 'Houston, we have a problem. The <b>link to Earth</b> is down. We will re-enter orbit once the signal returns.',
                    cyber: 'Uplink cut by an unknown process. <b>ICE</b> severed your connection. Attempting to regain access...',
                    matrix: 'Wake up... the Matrix has lost you. <b>Follow the white rabbit</b> - or just check your cable.',
                    sunset: 'Tracking lost. <b>Check the cable</b> or blow on the cartridge and wait for the signal.',
                },
                notfound: 'The network is fine, but this page is not here. The <b>path</b> does not exist or has moved.',
            },
            chip: { check: 'SCANNING NETWORK', offline: 'OFFLINE', notfound: 'ERROR 404', ok: 'ONLINE' },
            retry: 'Try again',
            home: 'Home',
            retryIn: (s) => `next attempt in ${s}s`,
            trying: 'connecting...',
            connected: 'connected',
            idle: 'network reachable',
            attempt: 'reconnect attempt',
            failed: 'FAILED',
            okWord: 'OK',
            restored: '[  OK  ] link restored - heading back to the search engine...',
            docTitle: { offline: 'HackerOS Search | Offline', notfound: 'HackerOS Search | 404' },
            lastOnline: (w, a) => `> last online: ${w} (${a})`,
            lastNever: '> last connection: no data',
            ago: (m) => `${m} min ago`,
            justNow: 'just now',
        },
    };
    const TXT: Strings = ALL_TXT[lang];

    /* ------------------------------------------------------------------ elementy */
    const bg = $<HTMLCanvasElement>('bg');
    const c = bg.getContext('2d') as CanvasRenderingContext2D;
    const nz = $<HTMLCanvasElement>('noise');
    const nc = nz.getContext('2d') as CanvasRenderingContext2D;
    const titleEl = $('title');
    const subEl = $('sub');
    const chipEl = $('chip');
    const chipText = $('chipText');
    const termEl = $('term');
    const statusEl = $('statusText');
    const barsEl = $('bars');
    const retryBtn = $('retry');
    const homeBtn = $<HTMLAnchorElement>('homeBtn');
    const tearsEl = $('tears');

    const MAXL: number = innerWidth < 600 ? 11 : 13;
    termEl.style.height = MAXL * 1.5 + 'em';
    document.documentElement.lang = lang;

    /* ------------------------------------------------------------------ stan */
    let mode: Mode = 'check';
    let attempt = 0;
    let countdown = 3;
    let busy = false;
    let booted = false;
    let loopTimer: number | undefined;
    let runId = 0;

    /* ------------------------------------------------------------------ ścieżka do strony głównej */
    function homeUrl(): string {
        try {
            const r = localStorage.getItem('hackeros_root_main') ?? localStorage.getItem('hackeros_root');
            if (r && !/blue(\.html)?$/.test(r)) return r;
        } catch {
            /* localStorage niedostępny */
        }
        const seg = location.pathname.split('/').filter(Boolean)[0];
        if (location.hostname.endsWith('.github.io') && seg && !seg.endsWith('.html')) {
            return location.origin + '/' + seg + '/';
        }
        return location.pathname.endsWith('404.html') ? 'index.html' : location.origin + '/';
    }

    /* ------------------------------------------------------------------ ostatnie połączenie (zapisywane przez guard.ts) */
    function lastOnlineText(): string {
        let raw: string | null = null;
        try {
            raw = localStorage.getItem('hackeros_last_online');
        } catch {
            /* localStorage niedostępny */
        }
        const ts = raw ? Number(raw) : NaN;
        if (!Number.isFinite(ts) || ts <= 0) return TXT.lastNever;
        const when = new Date(ts).toLocaleTimeString(lang === 'pl' ? 'pl-PL' : 'en-US', { hour: '2-digit', minute: '2-digit' });
        const min = Math.floor((Date.now() - ts) / 60000);
        return TXT.lastOnline(when, min < 1 ? TXT.justNow : TXT.ago(min));
    }

    /* ------------------------------------------------------------------ test łączności */
    async function probe(): Promise<boolean> {
        if (forcedOffline) return false;
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

    /* ------------------------------------------------------------------ tytuł: scramble */
    const GLYPHS = '!<>-_\\/[]{}=+*^?#01ｱｲｳｴｶｷ';
    let scrToken = 0;
    function setTitle(t: string): void {
        titleEl.textContent = t;
        titleEl.setAttribute('data-text', t);
    }
    function scramble(final: string, dur = 480): void {
        const token = ++scrToken;
        if (reduce) {
            setTitle(final);
            return;
        }
        const t0 = performance.now();
        (function step(): void {
            if (token !== scrToken) return;
            const p = (performance.now() - t0) / dur;
            if (p >= 1) {
                setTitle(final);
                return;
            }
            let out = '';
            for (let i = 0; i < final.length; i++) out += final[i] === ' ' || Math.random() < p ? final[i] : pick([...GLYPHS]);
            setTitle(out);
            requestAnimationFrame(step);
        })();
    }
    function currentTitle(): string {
        return mode === 'notfound' ? TXT.titles.notfound : mode === 'restored' ? TXT.chip.ok : TXT.titles.offline[theme];
    }

    /* ------------------------------------------------------------------ terminal */
    function addLine(cls: LineClass, text = ''): HTMLDivElement {
        const d = document.createElement('div');
        d.className = cls;
        d.textContent = text;
        termEl.appendChild(d);
        while (termEl.children.length > MAXL && termEl.firstChild) termEl.removeChild(termEl.firstChild);
        return d;
    }

    function buildScript(): ScriptLine[] {
        const P = 'root@hackeros:~# ';
        const L: ScriptLine[] = [];
        const flavors: Record<Theme, [LineClass, string][]> = {
            default: [['acc', '> ' + (lang === 'pl' ? 'sprawdź kabel / Wi-Fi / router' : 'check cable / Wi-Fi / router')]],
            space: [['acc', '> Houston, we have a problem.'], ['dim', '> deep-space link: carrier lost']],
            cyber: [['acc', '> ICE intrusion detected'], ['fail', '> uplink severed by pid 1337 (unknown)']],
            matrix: [['acc', '> Wake up, Neo...'], ['acc', '> The Matrix has you...'], ['acc', '> Follow the white rabbit.']],
            sunset: [['acc', '> VCR: TRACKING ERROR  CH 03'], ['dim', '> insert tape / adjust antenna']],
        };
        const flavor = flavors[theme];

        if (mode === 'offline') {
            L.push({ cls: 'cmd', prompt: P, text: 'ip link show wlan0', wait: 220 });
            L.push({ cls: 'dim', text: '2: wlan0: <NO-CARRIER,BROADCAST,MULTICAST,UP> state DOWN', wait: 160 });
            L.push({ cls: 'cmd', prompt: P, text: 'ping -c 3 1.1.1.1', wait: 220 });
            L.push({ cls: 'fail', text: 'ping: connect: Network is unreachable', wait: 160 });
            L.push({ cls: 'cmd', prompt: P, text: 'nslookup ecosia.org', wait: 220 });
            L.push({ cls: 'fail', text: ';; connection timed out; no servers could be reached', wait: 200 });
            L.push({ cls: 'fail', text: '[ FAIL ] uplink lost (no carrier)', wait: 220 });
            L.push({ cls: 'dim', text: lastOnlineText(), wait: 160 });
            flavor.forEach(([cls, text]) => L.push({ cls, text, wait: 260, type: true }));
            L.push({ cls: 'dim', text: '[ .... ] auto-reconnect: enabled', wait: 150 });
        } else {
            L.push({ cls: 'cmd', prompt: P, text: 'curl -I ' + location.pathname, wait: 220 });
            L.push({ cls: 'fail', text: 'HTTP/1.1 404 Not Found', wait: 160 });
            L.push({ cls: 'dim', text: 'x-hackeros: path not found in the matrix', wait: 160 });
            L.push({ cls: 'ok', text: '[  OK  ] network reachable', wait: 200 });
            flavor.forEach(([cls, text]) => L.push({ cls, text, wait: 240, type: true }));
            L.push({ cls: 'dim', text: lang === 'pl' ? '> tej strony po prostu tu nie ma.' : '> this page simply is not here.', wait: 150 });
        }
        return L;
    }

    async function play(): Promise<void> {
        const id = ++runId;
        booted = false;
        termEl.innerHTML = '';
        for (const l of buildScript()) {
            if (id !== runId) return;
            const el = addLine(l.cls);
            const full = (l.prompt || '') + l.text;
            if ((l.prompt || l.type) && !reduce) {
                el.textContent = l.prompt || '';
                for (const ch of l.text) {
                    el.textContent += ch;
                    await sleep(rnd(14, 38));
                    if (id !== runId) return;
                }
            } else {
                el.textContent = full;
            }
            await sleep(reduce ? 0 : l.wait);
        }
        if (id === runId) booted = true;
    }

    function noiseLine(): void {
        const hex = (): string => '0x' + ((Math.random() * 0xffff) | 0).toString(16).toUpperCase().padStart(4, '0');
        addLine(
            'fail',
            pick([
                `[ ERR  ] packet ${hex()} dropped (seq=${(Math.random() * 999) | 0})`,
                `[ ERR  ] arp: who-has 192.168.0.1 timeout`,
                `[ WARN ] dhcp: no lease, rebind failed`,
                `[ ERR  ] dns: SERVFAIL ${hex()}`,
            ])
        );
    }

    /* ------------------------------------------------------------------ render stanu */
    function render(): void {
        const key: 'offline' | 'notfound' = mode === 'notfound' ? 'notfound' : 'offline';
        subEl.innerHTML = mode === 'notfound' ? TXT.sub.notfound : TXT.sub.offline[theme];
        chipEl.className =
            'chip ' + (mode === 'notfound' ? 'is-404' : mode === 'check' ? 'is-check' : mode === 'restored' ? 'is-ok' : '');
        chipText.textContent = mode === 'check' ? TXT.chip.check : mode === 'restored' ? TXT.chip.ok : TXT.chip[mode];
        barsEl.className = 'bars' + (mode === 'notfound' || mode === 'restored' ? ' is-ok' : '');
        retryBtn.textContent = TXT.retry;
        homeBtn.textContent = TXT.home;
        homeBtn.href = homeUrl();
        homeBtn.hidden = mode !== 'notfound';
        retryBtn.hidden = mode !== 'offline';
        statusEl.textContent = mode === 'notfound' ? TXT.idle : mode === 'restored' ? TXT.connected : TXT.retryIn(countdown);
        if (mode !== 'check') document.title = TXT.docTitle[key];
        scramble(currentTitle());
    }

    /* ------------------------------------------------------------------ pętla ponownych prób */
    function startLoop(): void {
        clearInterval(loopTimer);
        countdown = 3;
        loopTimer = window.setInterval(() => {
            if (mode !== 'offline' || busy || !booted) return;
            countdown--;
            if (countdown <= 0) {
                void reconnect();
                return;
            }
            statusEl.textContent = TXT.retryIn(countdown);
            if (Math.random() < 0.4) noiseLine();
        }, 1000);
    }

    async function reconnect(): Promise<void> {
        if (busy || mode !== 'offline') return;
        busy = true;
        attempt++;
        statusEl.textContent = TXT.trying;
        const el = addLine('dim', `[ .... ] ${TXT.attempt} #${attempt} ...`);
        let ok: boolean;
        if (forcedOffline) {
            await sleep(700);
            ok = false;
        } else {
            ok = await probe();
        }
        if (ok) {
            el.className = 'ok';
            el.textContent = `[  OK  ] ${TXT.attempt} #${attempt} ... ${TXT.okWord}`;
            busy = false;
            restored();
            return;
        }
        el.className = 'fail';
        el.textContent = `[ FAIL ] ${TXT.attempt} #${attempt} ... ${TXT.failed}`;
        countdown = 3;
        statusEl.textContent = TXT.retryIn(countdown);
        busy = false;
        burst(180);
    }

    function restored(): void {
        mode = 'restored';
        clearInterval(loopTimer);
        addLine('ok', TXT.restored);
        render();
        burst(700);
        setTimeout(() => {
            if (/404\.html$/.test(location.pathname)) location.replace(homeUrl());
            else location.reload();
        }, 1600);
    }

    /* ------------------------------------------------------------------ motyw */
    function applyTheme(t: Theme, save = true): void {
        theme = t;
        document.body.classList.remove('space-theme', 'cyber-theme', 'matrix-theme', 'sunset-theme');
        if (t !== 'default') document.body.classList.add(t + '-theme');
        if (save) {
            try {
                localStorage.setItem('theme', t);
            } catch {
                /* localStorage niedostępny */
            }
        }
        initScene();
        c.clearRect(0, 0, bg.width, bg.height);
    }

    $('themeToggle').addEventListener('click', () => {
        applyTheme(THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length]);
        render();
        if (mode !== 'check') {
            void play().then(() => {
                if (mode === 'offline') startLoop();
            });
        }
        burst(320);
    });

    /* ------------------------------------------------------------------ tło (canvas) */
    let W = 0;
    let H = 0;
    let DPR = 1;
    let last = 0;
    let bursting = false;
    const emptyScene = (): Scene => ({ fs: 16, drops: [], acc: 0, stars: [], shoot: null, off: 0, parts: [] });
    let scene: Scene = emptyScene();
    const MCH = [...'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ0123456789:.=*+-<>'];

    function resize(): void {
        DPR = Math.min(window.devicePixelRatio || 1, 2);
        W = innerWidth;
        H = innerHeight;
        bg.width = W * DPR;
        bg.height = H * DPR;
        c.setTransform(DPR, 0, 0, DPR, 0, 0);
        initScene();
    }

    function makeParticles(n: number, hMin: number, hMax: number, speed: number): Particle[] {
        return Array.from({ length: n }, () => ({
            x: rnd(0, W),
            y: rnd(0, H),
            vx: rnd(-speed, speed),
            vy: rnd(-speed, speed),
            r: rnd(1, 2.4),
            h: rnd(hMin, hMax),
        }));
    }

    function initScene(): void {
        scene = emptyScene();
        if (theme === 'matrix') {
            scene.fs = 16;
            scene.drops = Array.from({ length: Math.ceil(W / 16) }, () => rnd(-40, 0));
            scene.acc = 0;
        } else if (theme === 'space') {
            scene.stars = Array.from({ length: Math.min(280, Math.floor((W * H) / 5500)) }, () => {
                const r = rnd(0.3, 1.5);
                return { x: rnd(0, W), y: rnd(0, H), r, p: rnd(0, 6.28), s: rnd(0.4, 1.6), v: 0.01 + r * 0.02 };
            });
            scene.shoot = null;
        } else if (theme === 'cyber') {
            scene.off = 0;
            scene.parts = makeParticles(40, 170, 310, 0.25);
        } else if (theme === 'sunset') {
            scene.parts = makeParticles(45, 10, 45, 0.18);
        } else {
            scene.parts = makeParticles(55, 200, 230, 0.15);
        }
    }

    function drawParticles(links: boolean, dist: number): void {
        const ps = scene.parts;
        for (const p of ps) {
            p.x += p.vx;
            p.y += p.vy;
            if (p.x < 0 || p.x > W) p.vx *= -1;
            if (p.y < 0 || p.y > H) p.vy *= -1;
            c.fillStyle = `hsla(${p.h},70%,60%,.55)`;
            c.beginPath();
            c.arc(p.x, p.y, p.r, 0, 6.2832);
            c.fill();
        }
        if (!links) return;
        c.lineWidth = 0.5;
        for (let i = 0; i < ps.length; i++) {
            for (let j = i + 1; j < ps.length; j++) {
                const dx = ps[i].x - ps[j].x;
                const dy = ps[i].y - ps[j].y;
                const d = Math.hypot(dx, dy);
                if (d < dist) {
                    c.strokeStyle = `hsla(${ps[i].h},70%,60%,${(1 - d / dist) * 0.25})`;
                    c.beginPath();
                    c.moveTo(ps[i].x, ps[i].y);
                    c.lineTo(ps[j].x, ps[j].y);
                    c.stroke();
                }
            }
        }
    }

    const DRAW: Record<Theme, (t: number, dt: number) => void> = {
        default() {
            c.clearRect(0, 0, W, H);
            drawParticles(true, 110);
        },

        space(t, dt) {
            c.clearRect(0, 0, W, H);
            for (const s of scene.stars) {
                s.x -= s.v * dt * 0.06 * 16;
                if (s.x < 0) {
                    s.x = W;
                    s.y = rnd(0, H);
                }
                const a = 0.35 + 0.65 * Math.abs(Math.sin(t * 0.001 * s.s + s.p));
                c.fillStyle = `rgba(255,255,255,${a})`;
                c.beginPath();
                c.arc(s.x, s.y, s.r, 0, 6.2832);
                c.fill();
            }
            if (!scene.shoot && Math.random() < 0.006) {
                scene.shoot = { x: rnd(W * 0.4, W), y: rnd(0, H * 0.4), l: rnd(80, 160), life: 1 };
            }
            const sh = scene.shoot;
            if (sh) {
                const g = c.createLinearGradient(sh.x, sh.y, sh.x + sh.l, sh.y - sh.l * 0.5);
                g.addColorStop(0, `rgba(255,255,255,${sh.life})`);
                g.addColorStop(1, 'rgba(255,255,255,0)');
                c.strokeStyle = g;
                c.lineWidth = 1.6;
                c.beginPath();
                c.moveTo(sh.x, sh.y);
                c.lineTo(sh.x + sh.l, sh.y - sh.l * 0.5);
                c.stroke();
                sh.x -= 14;
                sh.y += 7;
                sh.life -= 0.02;
                if (sh.life <= 0) scene.shoot = null;
            }
        },

        cyber(_t, dt) {
            c.clearRect(0, 0, W, H);
            const hy = H * 0.58;
            const sky = c.createLinearGradient(0, hy - 120, 0, hy);
            sky.addColorStop(0, 'rgba(255,0,255,0)');
            sky.addColorStop(1, 'rgba(255,0,255,.14)');
            c.fillStyle = sky;
            c.fillRect(0, hy - 120, W, 120);
            scene.off = (scene.off + dt * 0.00035) % 1;
            c.lineWidth = 1;
            const rows = 14;
            for (let k = 0; k < rows; k++) {
                const f = (k + scene.off) / rows;
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
            drawParticles(true, 120);
        },

        matrix(_t, dt) {
            scene.acc += dt;
            if (scene.acc < 55) return;
            scene.acc = 0;
            c.globalCompositeOperation = 'destination-out';
            c.fillStyle = 'rgba(0,0,0,.10)';
            c.fillRect(0, 0, W, H);
            c.globalCompositeOperation = 'source-over';
            c.font = scene.fs + 'px monospace';
            const d = scene.drops;
            for (let i = 0; i < d.length; i++) {
                const x = i * scene.fs;
                const y = d[i] * scene.fs;
                if (y > 0) {
                    c.fillStyle = 'rgba(0,255,102,.85)';
                    c.fillText(pick(MCH), x, y - scene.fs);
                    c.fillStyle = '#d6ffe6';
                    c.fillText(pick(MCH), x, y);
                }
                if (y > H && Math.random() > 0.975) d[i] = 0;
                d[i]++;
            }
        },

        sunset(t) {
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
            const shift = (t * 0.012) % sp;
            for (let j = 0; j < 9; j++) {
                const y = cy + r * 0.05 + j * sp - shift + sp;
                const h = 2 + j * 1.6;
                if (y > cy && y < cy + r) c.fillRect(cx - r, y, r * 2, h);
            }
            c.globalCompositeOperation = 'source-over';
            for (let k = 0; k < 2; k++) {
                const y = ((t * 0.05 + k * H * 0.5) % (H + 60)) - 30;
                const b = c.createLinearGradient(0, y, 0, y + 30);
                b.addColorStop(0, 'rgba(255,255,255,0)');
                b.addColorStop(0.5, 'rgba(255,255,255,.07)');
                b.addColorStop(1, 'rgba(255,255,255,0)');
                c.fillStyle = b;
                c.fillRect(0, y, W, 30);
            }
            drawParticles(true, 100);
        },
    };

    /* przesunięte "paski" obrazu - efekt datamoshingu w trakcie glitcha */
    function sliceGlitch(): void {
        c.save();
        c.setTransform(1, 0, 0, 1, 0, 0);
        const n = 3 + ((Math.random() * 4) | 0);
        for (let i = 0; i < n; i++) {
            const h = ((10 + Math.random() * 80) * DPR) | 0;
            const y = (Math.random() * Math.max(1, bg.height - h)) | 0;
            const dx = ((Math.random() - 0.5) * 140 * DPR) | 0;
            try {
                c.drawImage(bg, 0, y, bg.width, h, dx, y, bg.width, h);
            } catch {
                /* ignorujemy błędy rysowania */
            }
        }
        c.restore();
    }

    /* szum "TV static" */
    nz.width = 192;
    nz.height = 108;
    const nimg = nc.createImageData(192, 108);
    let lastNoise = 0;
    function drawNoise(): void {
        const d = nimg.data;
        for (let i = 0; i < d.length; i += 4) {
            const v = Math.random() * 255;
            d[i] = d[i + 1] = d[i + 2] = v;
            d[i + 3] = 255;
        }
        nc.putImageData(nimg, 0, 0);
    }

    function frame(t: number): void {
        requestAnimationFrame(frame);
        const dt = Math.min(60, t - last || 16);
        last = t;
        DRAW[theme](t, dt);
        if (bursting) sliceGlitch();
        if (t - lastNoise > 55) {
            drawNoise();
            lastNoise = t;
        }
    }

    /* ------------------------------------------------------------------ glitch "burst" */
    const TEARS = 5;
    for (let i = 0; i < TEARS; i++) {
        const d = document.createElement('div');
        d.className = 'tear' + (i % 2 ? ' alt' : '');
        tearsEl.appendChild(d);
    }

    function burst(dur?: number): void {
        if (reduce) return;
        const duration: number = dur || rnd(220, 520);
        bursting = true;
        document.body.classList.add('burst');
        const shuffle = (): void => {
            for (const t of Array.from(tearsEl.children) as HTMLElement[]) {
                t.style.top = rnd(0, 100) + '%';
                t.style.height = rnd(1, 9) + '%';
                t.style.transform = `translateX(${rnd(-60, 60)}px)`;
            }
        };
        shuffle();
        const iv = setInterval(shuffle, 70);
        if (mode === 'offline' || mode === 'check') scramble(currentTitle(), 300);
        setTimeout(() => {
            clearInterval(iv);
            bursting = false;
            document.body.classList.remove('burst');
        }, duration);
    }

    const BURST_EVERY: Record<Theme, [number, number]> = {
        default: [3500, 9000],
        space: [3000, 8000],
        cyber: [1500, 4500],
        matrix: [2500, 6500],
        sunset: [2000, 5500],
    };
    (function schedule(): void {
        const [a, b] = BURST_EVERY[theme] || BURST_EVERY.default;
        setTimeout(() => {
            burst();
            if (Math.random() < 0.3) setTimeout(() => burst(160), 420);
            schedule();
        }, rnd(a, b));
    })();

    titleEl.addEventListener('click', () => burst(420));
    retryBtn.addEventListener('click', () => {
        countdown = 0;
        burst(200);
        void reconnect();
    });
    document.addEventListener('keydown', (e: KeyboardEvent) => {
        if ((e.key === 'r' || e.key === 'R') && !e.ctrlKey && !e.metaKey && mode === 'offline') {
            burst(200);
            void reconnect();
        }
    });

    /* zdarzenia przeglądarki: gdy sieć zniknie / wróci już po otwarciu strony */
    window.addEventListener('offline', () => {
        if (mode === 'offline' || mode === 'restored') return;
        mode = 'offline';
        render();
        void play().then(() => startLoop());
        burst(400);
    });
    window.addEventListener('online', () => {
        if (mode === 'offline') void reconnect();
    });

    /* ------------------------------------------------------------------ start */
    async function init(): Promise<void> {
        resize();
        applyTheme(theme, false);
        window.addEventListener('resize', resize);
        render(); // tryb "check"
        requestAnimationFrame(frame);
        const ok = await probe();
        if (ok && assumeOffline) {
            // wejście z ?lost, a sieć już wróciła - od razu wracamy do wyszukiwarki
            restored();
            return;
        }
        mode = ok ? 'notfound' : 'offline';
        render();
        burst(380);
        await play();
        if (mode === 'offline') startLoop();
    }
    void init();
})();
