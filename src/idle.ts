export {};

// Zdarzenia bezczynności - działają na index.html (każdy motyw) i blue.html.
//
//   5 min bez aktywności  -> przelatuje UFO
//  10 min bez aktywności  -> pojawia się strzelec z czaszką na kamizelce i strzela w ekran
//  15 min bez aktywności  -> przelatuje samolot z transparentem "wyszukaj cokolwiek"
//
// Czas liczony jest od ostatniej aktywności (ruch myszy, klawisz, dotyk, scroll),
// więc "razem 10" i "razem 15" minut to czas od ostatniego ruchu użytkownika.
// Każda aktywność zeruje licznik i zabiera animację z ekranu. Po samolocie nic już się nie dzieje,
// dopóki użytkownik czegoś nie zrobi.
//
// Podgląd / testy w przeglądarce (bez czekania):
//   ?idle=ufo | ?idle=punisher | ?idle=plane   -> od razu odtwarza wybraną scenę
//   ?idle=10                                    -> "5 minut" trwa 10 sekund (całość: 10 s / 20 s / 30 s)

type SceneName = 'ufo' | 'punisher' | 'plane';

interface Scene {
    done: Promise<void>;
    cancel: () => void;
}

const ORDER: readonly SceneName[] = ['ufo', 'punisher', 'plane'];
const DEFAULT_STEP_MS = 5 * 60 * 1000;
const isPl: boolean = (navigator.language || 'en').toLowerCase().startsWith('pl');

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));
const rnd = (a: number, b: number): number => Math.random() * (b - a) + a;

/* ------------------------------------------------------------------ style */
const CSS = `
.hos-layer{position:fixed;inset:0;z-index:2147483000;pointer-events:none;overflow:hidden;transition:opacity .35s ease}
.hos-layer.hos-out{opacity:0}
.hos-abs{position:absolute;left:0;top:0;will-change:transform}
/* odcięcie od globalnych reguł svg strony (np. blue.css: fill:none; stroke:currentColor) */
.hos-layer svg{fill:#000;stroke:none;stroke-width:1;stroke-linecap:butt;stroke-linejoin:miter}

.hos-ufo{filter:drop-shadow(0 0 16px rgba(130,255,200,.5))}
.hos-ufo svg{display:block;width:100%;height:auto;overflow:visible}
.hos-beam{animation:hosBeam 1.1s ease-in-out infinite alternate}
.hos-light{animation:hosBlink .7s steps(2,jump-none) infinite}
@keyframes hosBeam{from{opacity:.25}to{opacity:1}}
@keyframes hosBlink{50%{opacity:.15}}

.hos-plane-rig{display:flex;align-items:center;filter:drop-shadow(0 4px 10px rgba(0,0,0,.45))}
.hos-plane-rig svg{display:block;overflow:visible}
.hos-banner{position:relative;white-space:nowrap;font:800 clamp(15px,2.5vw,30px)/1 system-ui,-apple-system,'Segoe UI',Arial,sans-serif;
  letter-spacing:.02em;color:#a31622;background:#fff8e1;padding:.55em 1.4em .55em 1.7em;
  clip-path:polygon(0 0,100% 0,100% 100%,0 100%,.9em 50%);transform-origin:100% 50%;
  animation:hosFlutter .55s ease-in-out infinite alternate}
@keyframes hosFlutter{from{transform:skewY(-2.5deg) scaleY(1)}to{transform:skewY(2.5deg) scaleY(.94)}}
.hos-prop{transform-box:fill-box;transform-origin:center;animation:hosProp .08s linear infinite alternate}
@keyframes hosProp{from{transform:scaleY(1)}to{transform:scaleY(.2)}}

.hos-dim{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 70%,rgba(0,0,0,.15),rgba(0,0,0,.55));opacity:0;transition:opacity .6s ease}
.hos-dim.on{opacity:1}
.hos-gunman{position:absolute;left:50%;bottom:0;transform:translate(-50%,105%);transition:transform .7s cubic-bezier(.2,.8,.2,1);will-change:transform}
.hos-gunman.up{transform:translate(-50%,0)}
.hos-gunman svg{display:block;height:100%;width:auto;overflow:visible}
.hos-flash{position:absolute;pointer-events:none;border-radius:50%;opacity:0;
  background:radial-gradient(circle,rgba(255,255,230,.95),rgba(255,200,80,.55) 35%,rgba(255,140,0,0) 70%)}
.hos-tracer{position:absolute;height:2px;transform-origin:0 50%;background:linear-gradient(90deg,rgba(255,240,170,.95),rgba(255,200,90,0));border-radius:2px}
.hos-hit{position:absolute;width:10px;height:10px;margin:-5px 0 0 -5px;border-radius:50%;
  background:radial-gradient(circle,#fff,rgba(255,210,120,.8) 40%,rgba(255,150,40,0) 70%)}
.hos-hit svg{position:absolute;left:-21px;top:-21px;width:52px;height:52px;overflow:visible}
`;

function injectStyle(): void {
    if (document.getElementById('hos-idle-style')) return;
    const st = document.createElement('style');
    st.id = 'hos-idle-style';
    st.textContent = CSS;
    document.head.appendChild(st);
}

function makeLayer(): HTMLDivElement {
    const d = document.createElement('div');
    d.className = 'hos-layer';
    d.setAttribute('aria-hidden', 'true');
    document.body.appendChild(d);
    return d;
}

/** Wspólne sprzątanie: znika płynnie, potem jest usuwane z DOM. */
function dispose(layer: HTMLElement, fast: boolean): void {
    layer.classList.add('hos-out');
    window.setTimeout(() => layer.remove(), fast ? 380 : 0);
    if (!fast) layer.remove();
}

/* ------------------------------------------------------------------ UFO */
const UFO_SVG = `
<svg viewBox="0 0 200 170" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="hosBeamG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9dffb8" stop-opacity=".6"/><stop offset="1" stop-color="#9dffb8" stop-opacity="0"/></linearGradient>
    <radialGradient id="hosDomeG" cx=".4" cy=".3" r=".8"><stop offset="0" stop-color="#eafff6"/><stop offset=".5" stop-color="#7fe7d0" stop-opacity=".9"/><stop offset="1" stop-color="#2a8f9e" stop-opacity=".95"/></radialGradient>
    <linearGradient id="hosHullG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e3e9f0"/><stop offset=".55" stop-color="#8d99aa"/><stop offset="1" stop-color="#4a5464"/></linearGradient>
  </defs>
  <polygon class="hos-beam" points="80,64 120,64 178,168 22,168" fill="url(#hosBeamG)"/>
  <ellipse cx="100" cy="34" rx="34" ry="28" fill="url(#hosDomeG)"/>
  <ellipse cx="100" cy="38" rx="9" ry="11" fill="#2f6b4a"/>
  <ellipse cx="96" cy="37" rx="2.6" ry="4" fill="#0d1a12" transform="rotate(-18 96 37)"/>
  <ellipse cx="104" cy="37" rx="2.6" ry="4" fill="#0d1a12" transform="rotate(18 104 37)"/>
  <ellipse cx="100" cy="54" rx="92" ry="21" fill="url(#hosHullG)"/>
  <ellipse cx="100" cy="47" rx="68" ry="9" fill="#fff" opacity=".2"/>
  <g fill="#ffe46b">
    <circle class="hos-light" cx="30" cy="58" r="4.2" style="animation-delay:0s"/>
    <circle class="hos-light" cx="62" cy="64" r="4.2" style="animation-delay:.14s"/>
    <circle class="hos-light" cx="100" cy="67" r="4.2" style="animation-delay:.28s"/>
    <circle class="hos-light" cx="138" cy="64" r="4.2" style="animation-delay:.42s"/>
    <circle class="hos-light" cx="170" cy="58" r="4.2" style="animation-delay:.56s"/>
  </g>
</svg>`;

function ufoScene(): Scene {
    const layer = makeLayer();
    const size = clamp(innerWidth * 0.17, 100, 200);
    const ufo = document.createElement('div');
    ufo.className = 'hos-abs hos-ufo';
    ufo.style.width = size + 'px';
    ufo.innerHTML = UFO_SVG;
    layer.append(ufo);

    const fromLeft = Math.random() < 0.5;
    const x0 = fromLeft ? -size * 1.2 : innerWidth + size * 0.2;
    const x1 = fromLeft ? innerWidth + size * 0.2 : -size * 1.2;
    const baseY = innerHeight * rnd(0.1, 0.3);
    const frames: Keyframe[] = [];
    const steps = 48;
    for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const x = x0 + (x1 - x0) * t;
        const y = baseY + Math.sin(t * Math.PI * 5) * innerHeight * 0.035 + Math.sin(t * Math.PI * 1.6) * innerHeight * 0.07;
        const tilt = Math.cos(t * Math.PI * 5) * 7;
        frames.push({ transform: `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) rotate(${tilt.toFixed(1)}deg)`, offset: t });
    }
    const duration = clamp(((innerWidth + size * 1.4) / 150) * 1000, 7000, 14000);
    const anim = ufo.animate(frames, { duration, easing: 'linear', fill: 'forwards' });
    return {
        done: anim.finished.then(
            () => dispose(layer, false),
            () => undefined
        ),
        cancel: () => {
            anim.cancel();
            dispose(layer, true);
        },
    };
}

/* ------------------------------------------------------------------ samolot z transparentem */
const PLANE_SVG = `
<svg viewBox="0 0 230 96" xmlns="http://www.w3.org/2000/svg">
  <path d="M22 42 L12 10 L38 10 L66 36 Z" fill="#d93a3a"/>
  <path d="M28 52 L8 64 L50 62 Z" fill="#b92d2d"/>
  <path d="M26 50 Q26 36 64 33 L172 30 Q212 32 220 48 Q212 64 172 66 L64 64 Q26 64 26 50Z" fill="#f3f6fb" stroke="#97a4b8" stroke-width="1.5"/>
  <rect x="40" y="46" width="168" height="6" fill="#d93a3a" opacity=".85"/>
  <path d="M118 52 L98 88 L140 88 L156 52 Z" fill="#d93a3a"/>
  <path d="M136 36 Q150 22 172 33 Z" fill="#8fd4ff" stroke="#6d93b3" stroke-width="1.3"/>
  <circle cx="221" cy="48" r="6.5" fill="#444"/>
  <ellipse class="hos-prop" cx="224" cy="48" rx="3.5" ry="32" fill="#2a2a2a" opacity=".55"/>
  <path d="M150 66 L156 82" stroke="#444" stroke-width="3" fill="none"/>
  <circle cx="156" cy="86" r="6.5" fill="#333"/><circle cx="156" cy="86" r="2.5" fill="#999"/>
</svg>`;

function planeScene(): Scene {
    const layer = makeLayer();
    const rig = document.createElement('div');
    rig.className = 'hos-abs hos-plane-rig';
    const banner = document.createElement('div');
    banner.className = 'hos-banner';
    banner.textContent = isPl ? 'wyszukaj cokolwiek' : 'search for anything';
    const rope = document.createElement('div');
    rope.innerHTML = '<svg width="54" height="22" viewBox="0 0 54 22"><path d="M0 11 Q27 4 54 11" fill="none" stroke="#e8e8e8" stroke-width="2"/></svg>';
    const plane = document.createElement('div');
    plane.style.width = clamp(innerWidth * 0.16, 110, 210) + 'px';
    plane.innerHTML = PLANE_SVG;
    plane.firstElementChild?.setAttribute('width', '100%');
    rig.append(banner, rope, plane);
    layer.append(rig);

    const rigW = rig.getBoundingClientRect().width;
    const baseY = innerHeight * rnd(0.14, 0.34);
    const frames: Keyframe[] = [];
    const steps = 48;
    for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const x = -rigW - 20 + (innerWidth + rigW + 40) * t;
        const y = baseY + Math.sin(t * Math.PI * 3) * innerHeight * 0.025;
        const pitch = Math.cos(t * Math.PI * 3) * 1.6;
        frames.push({ transform: `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) rotate(${pitch.toFixed(2)}deg)`, offset: t });
    }
    const duration = clamp(((innerWidth + rigW) / 120) * 1000, 9000, 20000);
    const anim = rig.animate(frames, { duration, easing: 'linear', fill: 'forwards' });
    return {
        done: anim.finished.then(
            () => dispose(layer, false),
            () => undefined
        ),
        cancel: () => {
            anim.cancel();
            dispose(layer, true);
        },
    };
}

/* ------------------------------------------------------------------ strzelec */
// Oryginalna, narysowana kodem sylwetka: ciemny strzelec z czaszką na kamizelce, celuje z karabinu prosto w ekran.
const GUNMAN_SVG = `
<svg viewBox="0 0 300 560" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="hosVest" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#26282c"/><stop offset="1" stop-color="#111214"/></linearGradient>
    <radialGradient id="hosSkin" cx=".5" cy=".4" r=".7"><stop offset="0" stop-color="#d7b196"/><stop offset="1" stop-color="#a97f64"/></radialGradient>
  </defs>
  <!-- nogi -->
  <path d="M96 340 L86 560 L146 560 L152 360 Z" fill="#17181b"/>
  <path d="M204 340 L214 560 L154 560 L148 360 Z" fill="#131417"/>
  <!-- tułów -->
  <path d="M82 168 Q150 144 218 168 L232 214 L214 350 Q150 372 86 350 L68 214 Z" fill="url(#hosVest)" stroke="#000" stroke-width="2"/>
  <path d="M104 176 L104 346 M196 176 L196 346" stroke="#050505" stroke-width="3" opacity=".6"/>
  <!-- czaszka na piersi -->
  <g transform="translate(150 232)" fill="#ececec">
    <ellipse cx="0" cy="-8" rx="21" ry="19"/>
    <rect x="-12" y="6" width="24" height="14" rx="3"/>
    <ellipse cx="-8" cy="-8" rx="5.6" ry="6.6" fill="#101012"/>
    <ellipse cx="8" cy="-8" rx="5.6" ry="6.6" fill="#101012"/>
    <path d="M0 -1 L-3.2 6 L3.2 6 Z" fill="#101012"/>
    <path d="M-8 12 V20 M-4 12 V20 M0 12 V20 M4 12 V20 M8 12 V20" stroke="#101012" stroke-width="1.6"/>
  </g>
  <!-- głowa -->
  <rect x="136" y="130" width="28" height="30" rx="8" fill="#b88c70"/>
  <ellipse cx="150" cy="104" rx="30" ry="36" fill="url(#hosSkin)"/>
  <path d="M120 98 Q122 66 150 64 Q178 66 180 98 Q168 84 150 84 Q132 84 120 98Z" fill="#0d0d0f"/>
  <path d="M124 112 Q150 150 176 112 Q172 134 150 142 Q128 134 124 112Z" fill="#2c2623" opacity=".75"/>
  <path d="M130 100 L145 103 M170 100 L155 103" stroke="#18120f" stroke-width="3.4" stroke-linecap="round"/>
  <path d="M140 124 Q150 128 160 124" stroke="#3a2a22" stroke-width="2.4" fill="none" stroke-linecap="round"/>
  <!-- ramiona i dłonie na karabinie -->
  <path d="M82 170 Q50 210 74 262 L122 268 L120 240 L92 236 Q84 206 100 184 Z" fill="#1a1b1e" stroke="#000" stroke-width="2"/>
  <path d="M218 170 Q250 210 226 262 L178 268 L180 240 L208 236 Q216 206 200 184 Z" fill="#1a1b1e" stroke="#000" stroke-width="2"/>
  <!-- karabin skierowany w widza -->
  <rect x="122" y="240" width="56" height="52" rx="7" fill="#1d1e21" stroke="#000" stroke-width="2"/>
  <rect x="138" y="288" width="24" height="46" rx="4" fill="#141517" stroke="#000" stroke-width="2"/>
  <circle cx="150" cy="262" r="19" fill="#0b0b0c" stroke="#2c2d31" stroke-width="3"/>
  <circle cx="150" cy="262" r="9" fill="#000"/>
  <circle cx="150" cy="262" r="3" fill="#3b3c42"/>
  <circle cx="108" cy="262" r="12" fill="#a97f64" stroke="#000" stroke-width="1.5"/>
  <circle cx="192" cy="262" r="12" fill="#a97f64" stroke="#000" stroke-width="1.5"/>
</svg>`;

const MUZZLE = { x: 150 / 300, y: 262 / 560 };
const CRACK_SVG =
    '<svg viewBox="0 0 52 52"><path d="M21 21 L4 8 M21 21 L46 14 M21 21 L40 44 M21 21 L8 40 M21 21 L26 2" stroke="rgba(255,255,255,.75)" stroke-width="1.4" fill="none" stroke-linecap="round"/></svg>';

function punisherScene(): Scene {
    const layer = makeLayer();
    const dim = document.createElement('div');
    dim.className = 'hos-dim';
    const man = document.createElement('div');
    man.className = 'hos-gunman';
    const h = clamp(innerHeight * 0.82, 280, 700);
    man.style.height = h + 'px';
    man.innerHTML = GUNMAN_SVG;
    const flash = document.createElement('div');
    flash.className = 'hos-flash';
    layer.append(dim, man, flash);

    const timers: number[] = [];
    let cancelled = false;
    let finish: () => void = () => undefined;
    const done = new Promise<void>((res) => {
        finish = res;
    });
    const after = (ms: number, fn: () => void): void => {
        timers.push(
            window.setTimeout(() => {
                if (!cancelled) fn();
            }, ms)
        );
    };

    // wjazd
    requestAnimationFrame(() => {
        dim.classList.add('on');
        man.classList.add('up');
    });

    let mx = 0;
    let my = 0;
    const locateMuzzle = (): void => {
        const r = man.getBoundingClientRect();
        mx = r.left + r.width * MUZZLE.x;
        my = r.top + r.height * MUZZLE.y;
        const fs = clamp(r.height * 0.34, 90, 240);
        flash.style.width = flash.style.height = fs + 'px';
        flash.style.left = mx - fs / 2 + 'px';
        flash.style.top = my - fs / 2 + 'px';
    };

    const shoot = (): void => {
        // błysk z lufy + drgnięcie postaci
        flash.style.opacity = '1';
        flash.style.transform = `scale(${rnd(0.8, 1.25).toFixed(2)}) rotate(${rnd(0, 90) | 0}deg)`;
        man.style.transform = `translate(calc(-50% + ${rnd(-3, 3).toFixed(1)}px), ${rnd(0, 5).toFixed(1)}px)`;
        after(55, () => {
            flash.style.opacity = '0';
            man.style.transform = '';
        });
        // pocisk leci w stronę ekranu
        const tx = rnd(innerWidth * 0.05, innerWidth * 0.95);
        const ty = rnd(innerHeight * 0.05, innerHeight * 0.72);
        const dx = tx - mx;
        const dy = ty - my;
        const len = Math.hypot(dx, dy);
        const tr = document.createElement('div');
        tr.className = 'hos-tracer';
        tr.style.left = mx + 'px';
        tr.style.top = my + 'px';
        tr.style.width = len + 'px';
        tr.style.transform = `rotate(${Math.atan2(dy, dx)}rad)`;
        layer.append(tr);
        const grow = tr.animate([{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0 0 0)' }], { duration: 120, easing: 'ease-in', fill: 'forwards' });
        grow.finished.then(
            () => {
                tr.remove();
                if (cancelled) return;
                const hit = document.createElement('div');
                hit.className = 'hos-hit';
                hit.style.left = tx + 'px';
                hit.style.top = ty + 'px';
                hit.innerHTML = CRACK_SVG;
                layer.append(hit);
                hit.animate(
                    [{ transform: 'scale(.4)', opacity: 1 }, { transform: 'scale(1.7)', opacity: 0 }],
                    { duration: 520, easing: 'ease-out', fill: 'forwards' }
                ).finished.then(
                    () => hit.remove(),
                    () => undefined
                );
            },
            () => undefined
        );
    };

    // harmonogram: wjazd -> 4 serie -> zjazd
    let t = 800;
    after(t, locateMuzzle);
    t += 100;
    for (let burst = 0; burst < 4; burst++) {
        const shots = 6 + ((Math.random() * 5) | 0);
        for (let s = 0; s < shots; s++) after(t + s * 95, shoot);
        t += shots * 95 + 650;
    }
    after(t, () => {
        man.classList.remove('up');
        dim.classList.remove('on');
    });
    after(t + 800, () => {
        dispose(layer, false);
        finish();
    });

    return {
        done,
        cancel: () => {
            cancelled = true;
            timers.forEach((id) => clearTimeout(id));
            dispose(layer, true);
            finish();
        },
    };
}

const BUILDERS: Record<SceneName, () => Scene> = { ufo: ufoScene, punisher: punisherScene, plane: planeScene };

/* ------------------------------------------------------------------ licznik bezczynności */
export function initIdleEvents(): void {
    injectStyle();

    const q = new URLSearchParams(location.search).get('idle');
    const demo: SceneName | null = q && (ORDER as readonly string[]).includes(q) ? (q as SceneName) : null;
    const stepSec = q !== null && demo === null ? Number(q) : NaN;
    const STEP: number = Number.isFinite(stepSec) && stepSec >= 1 ? stepSec * 1000 : DEFAULT_STEP_MS;

    let lastActivity = Date.now();
    let stage = 0; // ile scen już pokazano w tym okresie bezczynności
    let current: Scene | null = null;
    let previewing = false;

    const offlineScreenShown = (): boolean => !!document.getElementById('offlineDialog');

    function play(name: SceneName, preview = false): void {
        if (current || offlineScreenShown() || !document.body) return;
        previewing = preview;
        const scene = BUILDERS[name]();
        current = scene;
        void scene.done.then(() => {
            if (current === scene) {
                current = null;
                previewing = false;
            }
        });
    }

    function activity(): void {
        lastActivity = Date.now();
        stage = 0;
        if (current && !previewing) {
            current.cancel();
            current = null;
        }
    }

    const events: readonly string[] = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'wheel', 'scroll', 'pointerdown'];
    for (const ev of events) window.addEventListener(ev, activity, { passive: true, capture: true });

    // powrót na kartę = aktywność (licznik nie "dolicza" czasu spędzonego w innej karcie)
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) activity();
    });

    setInterval(() => {
        if (document.hidden || current || stage >= ORDER.length) return;
        if (Date.now() - lastActivity >= STEP * (stage + 1)) {
            play(ORDER[stage]);
            stage++;
        }
    }, 1000);

    if (demo) window.setTimeout(() => play(demo, true), 600);
}
