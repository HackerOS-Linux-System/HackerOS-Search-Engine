export {};

import { initOfflineGuard } from './guard';
import { initIdleEvents } from './idle';

// Blue Search - logika ukrytej podstrony blue.html (animowany kosmos + wyszukiwarka)

// Gwiazda w przestrzeni 3D: x, y w zakresie -1..1, z od 1 (daleko) do ~0 (tuż przy nas)
interface Star {
    x: number;
    y: number;
    z: number;
    tw: number; // szybkość migotania
    ph: number; // faza migotania
    big: boolean;
    warm: boolean;
}

interface Meteor {
    x: number;
    y: number;
    vx: number;
    vy: number;
    len: number;
    life: number;
    max: number;
}

const isPl: boolean = (navigator.language || 'en').toLowerCase().startsWith('pl');
const SEARCH_PH: string = isPl ? 'Wyszukaj w Ecosia...' : 'Search with Ecosia...';

const Z_MIN = 0.035;
const BASE_SPEED = 0.028; // jednostek z na sekundę - powolny, spokojny lot przez kosmos

function $<T extends HTMLElement>(id: string): T {
    const el = document.getElementById(id);
    if (!el) throw new Error(`blue.ts: brak elementu #${id}`);
    return el as T;
}

document.addEventListener('DOMContentLoaded', () => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    document.documentElement.lang = isPl ? 'pl' : 'en';
    const searchInput = $<HTMLInputElement>('searchInput');
    const searchForm = $<HTMLFormElement>('searchForm');
    searchInput.placeholder = SEARCH_PH;

    // --- offline: zapis stanu w localStorage + ekran offline.html (wszystko we wspólnym guard.ts) ---
    initOfflineGuard('blue', location.href.split(/[?#]/)[0]);

    // --- zdarzenia bezczynności: 5 min UFO, 10 min strzelec, 15 min samolot ---
    initIdleEvents();

    // --- kosmos ---
    const canvas = $<HTMLCanvasElement>('sky');
    const ctx = canvas.getContext('2d');
    let stars: Star[] = [];
    let meteors: Meteor[] = [];
    let w = 0;
    let h = 0;
    let rafId = 0;
    let lastT = 0;
    let nextMeteor = 0;
    let boost = 1; // przyspieszenie lotu (chwilowo rośnie podczas pisania)
    let px = 0; // paralaksa: pożądane i aktualne przesunięcie środka
    let py = 0;
    let cpx = 0;
    let cpy = 0;

    function spawn(randomZ: boolean): Star {
        const big = Math.random() < 0.025;
        return {
            x: Math.random() * 2 - 1,
            y: Math.random() * 2 - 1,
            z: randomZ ? Z_MIN + Math.random() * (1 - Z_MIN) : 1,
            tw: 0.5 + Math.random() * 1.6,
            ph: Math.random() * Math.PI * 2,
            big,
            warm: Math.random() < 0.12,
        };
    }

    function buildStars(): void {
        const count = Math.min(650, Math.round((w * h) / 2600));
        stars = Array.from({ length: count }, () => spawn(true));
    }

    function drawStar(s: Star, t: number, speedFactor: number): boolean {
        if (!ctx) return false;
        const scale = Math.max(w, h) * 0.55;
        const cx = w / 2 + cpx * (1 - s.z); // bliższe gwiazdy przesuwają się bardziej (paralaksa)
        const cy = h / 2 + cpy * (1 - s.z);
        const k = 1 / s.z;
        const sx = cx + s.x * scale * k * 0.42;
        const sy = cy + s.y * scale * k * 0.42;
        if (sx < -20 || sx > w + 20 || sy < -20 || sy > h + 20) return false;

        const near = 1 - s.z; // 0 = daleko, 1 = blisko
        const tw = reduceMotion ? 1 : 0.8 + 0.2 * Math.sin(t * 0.001 * s.tw + s.ph);
        const alpha = Math.min(1, (0.18 + near * 1.1) * tw);
        const r = (s.big ? 0.9 : 0.35) + near * (s.big ? 2.1 : 1.35);
        const rgb = s.warm ? '255, 232, 205' : near > 0.55 ? '225, 238, 255' : '190, 212, 255';

        // smuga przy szybszym locie (np. podczas pisania)
        if (speedFactor > 1.6 && !reduceMotion) {
            const k2 = 1 / (s.z + 0.012 * speedFactor);
            const tx = cx + s.x * scale * k2 * 0.42;
            const ty = cy + s.y * scale * k2 * 0.42;
            ctx.strokeStyle = `rgba(${rgb}, ${alpha * 0.7})`;
            ctx.lineWidth = Math.max(0.6, r * 0.9);
            ctx.beginPath();
            ctx.moveTo(tx, ty);
            ctx.lineTo(sx, sy);
            ctx.stroke();
        }

        if (s.big && near > 0.3) {
            const halo = ctx.createRadialGradient(sx, sy, 0, sx, sy, r * 6);
            halo.addColorStop(0, `rgba(150, 190, 255, ${0.3 * alpha})`);
            halo.addColorStop(1, 'rgba(150, 190, 255, 0)');
            ctx.fillStyle = halo;
            ctx.fillRect(sx - r * 6, sy - r * 6, r * 12, r * 12);
            ctx.strokeStyle = `rgba(200, 222, 255, ${0.5 * alpha})`;
            ctx.lineWidth = 0.6;
            ctx.beginPath();
            ctx.moveTo(sx - r * 4.5, sy);
            ctx.lineTo(sx + r * 4.5, sy);
            ctx.moveTo(sx, sy - r * 4.5);
            ctx.lineTo(sx, sy + r * 4.5);
            ctx.stroke();
        }
        ctx.fillStyle = `rgba(${rgb}, ${alpha})`;
        ctx.beginPath();
        ctx.arc(sx, sy, r, 0, Math.PI * 2);
        ctx.fill();
        return true;
    }

    function spawnMeteor(): void {
        const dir = Math.random() < 0.5 ? 1 : -1;
        const speed = 700 + Math.random() * 500;
        const ang = (18 + Math.random() * 22) * (Math.PI / 180);
        meteors.push({
            x: dir === 1 ? Math.random() * w * 0.7 : w * (0.3 + Math.random() * 0.7),
            y: Math.random() * h * 0.45,
            vx: Math.cos(ang) * speed * dir,
            vy: Math.sin(ang) * speed,
            len: 110 + Math.random() * 130,
            life: 0,
            max: 0.7 + Math.random() * 0.5,
        });
    }

    function drawMeteors(dt: number): void {
        if (!ctx) return;
        for (let i = meteors.length - 1; i >= 0; i--) {
            const m = meteors[i];
            m.life += dt;
            m.x += m.vx * dt;
            m.y += m.vy * dt;
            const p = m.life / m.max;
            if (p >= 1) {
                meteors.splice(i, 1);
                continue;
            }
            const fade = Math.sin(p * Math.PI);
            const sp = Math.hypot(m.vx, m.vy);
            const tx = m.x - (m.vx / sp) * m.len;
            const ty = m.y - (m.vy / sp) * m.len;
            const g = ctx.createLinearGradient(m.x, m.y, tx, ty);
            g.addColorStop(0, `rgba(230, 240, 255, ${0.95 * fade})`);
            g.addColorStop(0.3, `rgba(140, 180, 255, ${0.45 * fade})`);
            g.addColorStop(1, 'rgba(100, 150, 255, 0)');
            ctx.strokeStyle = g;
            ctx.lineWidth = 1.6;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(m.x, m.y);
            ctx.lineTo(tx, ty);
            ctx.stroke();
            ctx.fillStyle = `rgba(255, 255, 255, ${fade})`;
            ctx.beginPath();
            ctx.arc(m.x, m.y, 1.5, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    function frame(now: number): void {
        if (!ctx || !canvas.isConnected) return; // strona została podmieniona (np. ekranem offline)
        const dt = Math.min(0.05, lastT ? (now - lastT) / 1000 : 0.016);
        lastT = now;

        boost += (1 - boost) * Math.min(1, dt * 2.2);
        cpx += (px - cpx) * Math.min(1, dt * 3);
        cpy += (py - cpy) * Math.min(1, dt * 3);

        ctx.clearRect(0, 0, w, h);
        const dz = BASE_SPEED * boost * dt;
        for (let i = 0; i < stars.length; i++) {
            const s = stars[i];
            s.z -= dz * (0.6 + (1 - s.z) * 0.9);
            if (s.z <= Z_MIN || !drawStar(s, now, boost)) {
                stars[i] = spawn(false);
            }
        }

        nextMeteor -= dt;
        if (nextMeteor <= 0) {
            spawnMeteor();
            nextMeteor = 2.5 + Math.random() * 6;
        }
        drawMeteors(dt);

        rafId = document.hidden ? 0 : requestAnimationFrame(frame);
    }

    function drawStatic(): void {
        if (!ctx) return;
        ctx.clearRect(0, 0, w, h);
        for (const s of stars) drawStar(s, 0, 1);
    }

    function start(): void {
        cancelAnimationFrame(rafId);
        rafId = 0;
        lastT = 0;
        if (reduceMotion) drawStatic();
        else if (!document.hidden) rafId = requestAnimationFrame(frame);
    }

    function resize(): void {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        w = window.innerWidth;
        h = window.innerHeight;
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
        ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
        buildStars();
        start();
    }
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', start);
    resize();

    if (!reduceMotion) {
        // paralaksa: kosmos delikatnie "podąża" za kursorem
        window.addEventListener('mousemove', (e: MouseEvent) => {
            px = -((e.clientX / w) * 2 - 1) * 46;
            py = -((e.clientY / h) * 2 - 1) * 46;
        });
        // pisanie w wyszukiwarce = krótki "skok w nadprzestrzeń"
        searchInput.addEventListener('input', () => {
            boost = Math.min(7, boost + 2.2);
        });
    }

    // --- wyszukiwanie ---
    searchForm.addEventListener('submit', (e: SubmitEvent) => {
        if (!searchInput.value.trim()) {
            e.preventDefault();
            searchInput.focus();
        }
    });

    // dowolny znak = pisz w wyszukiwarce
    document.addEventListener('keydown', (e: KeyboardEvent) => {
        const typing = document.activeElement instanceof HTMLInputElement;
        if (e.key === 'Escape') {
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
