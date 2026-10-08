export {};

import { initOfflineGuard } from './guard';
import { initIdleEvents } from './idle';

// HackerOS Search - logika strony głównej (cząsteczki, motywy, offline, bezczynność, język)

type Theme = 'default' | 'space' | 'cyber' | 'matrix' | 'sunset';

const THEMES: readonly Theme[] = ['default', 'space', 'cyber', 'matrix', 'sunset'];

interface ThemeProps {
    particleCount: number;
    baseSizeMin: number;
    baseSizeMax: number;
    speedMin: number;
    speedMax: number;
    opacityMin: number;
    opacityMax: number;
    useHue: boolean;
    hueMin?: number;
    hueMax?: number;
    fixedHue?: number;
    connectLines: boolean;
    lineDistance?: number;
    glowEffect: boolean;
    verticalFall?: boolean;
}

interface Mouse {
    x: number | null;
    y: number | null;
    radius: number;
}

function isTheme(value: unknown): value is Theme {
    return typeof value === 'string' && (THEMES as readonly string[]).includes(value);
}

function loadTheme(): Theme {
    try {
        const saved = localStorage.getItem('theme');
        if (isTheme(saved)) return saved;
    } catch {
        /* localStorage niedostępny */
    }
    return 'default';
}

// Helper do pobierania właściwości motywu
function getThemeProps(theme: Theme): ThemeProps {
    switch (theme) {
        case 'space':
            return {
                particleCount: 200,
                baseSizeMin: 0.5,
                baseSizeMax: 1.5,
                speedMin: -0.2,
                speedMax: 0.2,
                opacityMin: 0.4,
                opacityMax: 0.6,
                useHue: false,
                connectLines: false,
                glowEffect: true,
            };
        case 'cyber':
            return {
                particleCount: 120,
                baseSizeMin: 0.8,
                baseSizeMax: 2.2,
                speedMin: -0.25,
                speedMax: 0.25,
                opacityMin: 0.5,
                opacityMax: 0.9,
                useHue: true,
                hueMin: 180,
                hueMax: 300,
                connectLines: true,
                lineDistance: 120,
                glowEffect: true,
            };
        case 'matrix':
            return {
                particleCount: 150,
                baseSizeMin: 0.6,
                baseSizeMax: 1.8,
                speedMin: 0.4,
                speedMax: 1.4,
                opacityMin: 0.4,
                opacityMax: 0.9,
                useHue: false,
                fixedHue: 120,
                connectLines: false,
                glowEffect: true,
                verticalFall: true,
            };
        case 'sunset':
            return {
                particleCount: 90,
                baseSizeMin: 1,
                baseSizeMax: 2.6,
                speedMin: -0.18,
                speedMax: 0.18,
                opacityMin: 0.3,
                opacityMax: 0.7,
                useHue: true,
                hueMin: 10,
                hueMax: 45,
                connectLines: true,
                lineDistance: 110,
                glowEffect: true,
            };
        default:
            return {
                particleCount: 50,
                baseSizeMin: 1,
                baseSizeMax: 2,
                speedMin: -0.15,
                speedMax: 0.15,
                opacityMin: 0.2,
                opacityMax: 0.4,
                useHue: true,
                hueMin: 200,
                hueMax: 230,
                connectLines: true,
                lineDistance: 100,
                glowEffect: false,
            };
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // --- Particle Animation ---
    const canvasEl = document.getElementById('particles') as HTMLCanvasElement | null;
    const ctx: CanvasRenderingContext2D | null = canvasEl ? canvasEl.getContext('2d') : null;
    const particlesArray: Particle[] = [];
    const mouse: Mouse = { x: null, y: null, radius: 100 };
    let currentTheme: Theme = loadTheme();
    let currentProps: ThemeProps = getThemeProps(currentTheme);

    class Particle {
        x: number;
        y: number;
        size: number;
        baseSize: number;
        speedX: number;
        speedY: number;
        opacity: number;
        hue: number;
        glow: boolean;

        constructor(private readonly themeProps: ThemeProps, private readonly canvas: HTMLCanvasElement) {
            this.x = Math.random() * canvas.width;
            this.y = Math.random() * canvas.height;
            this.size = Math.random() * (themeProps.baseSizeMax - themeProps.baseSizeMin) + themeProps.baseSizeMin;
            this.baseSize = this.size;
            this.speedX = Math.random() * (themeProps.speedMax - themeProps.speedMin) + themeProps.speedMin;
            this.speedY = Math.random() * (themeProps.speedMax - themeProps.speedMin) + themeProps.speedMin;
            this.opacity = Math.random() * (themeProps.opacityMax - themeProps.opacityMin) + themeProps.opacityMin;
            if (themeProps.useHue) {
                const hMin = themeProps.hueMin ?? 0;
                const hMax = themeProps.hueMax ?? 360;
                this.hue = Math.random() * (hMax - hMin) + hMin;
            } else {
                this.hue = themeProps.fixedHue ?? 0; // np. zielony dla matrix, biały dla space
            }
            this.glow = themeProps.glowEffect;
            if (themeProps.verticalFall) {
                this.speedX = 0;
                this.speedY = Math.random() * (themeProps.speedMax - themeProps.speedMin) + themeProps.speedMin;
            }
        }

        update(themeProps: ThemeProps, mouse: Mouse): void {
            this.x += this.speedX;
            this.y += this.speedY;

            // Motyw matrix: cząstki spadają i wracają na górę
            if (themeProps.verticalFall && this.y > this.canvas.height) {
                this.y = 0;
                this.x = Math.random() * this.canvas.width;
            }

            // Spadek rozmiaru/opacity tylko dla domyślnego motywu
            if (currentTheme === 'default') {
                if (this.size > 0.5) this.size -= 0.003;
                if (this.opacity > 0.2) this.opacity -= 0.0003;
            }

            // Interakcja z myszką tylko dla domyślnego
            if (currentTheme === 'default' && mouse.x !== null && mouse.y !== null) {
                const dx = mouse.x - this.x;
                const dy = mouse.y - this.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance < mouse.radius) {
                    const force = (mouse.radius - distance) / mouse.radius;
                    this.speedX += dx * force * 0.01;
                    this.speedY += dy * force * 0.01;
                    this.size = this.baseSize + force * 1.5;
                }
            }

            // Odbijanie od krawędzi
            if (this.x < 0 || this.x > this.canvas.width) this.speedX *= -1;
            if (this.y < 0 || this.y > this.canvas.height) this.speedY *= -1;
        }

        draw(c: CanvasRenderingContext2D): void {
            if (this.themeProps.useHue) {
                c.fillStyle = `hsla(${this.hue}, 70%, 60%, ${this.opacity})`;
            } else if (this.themeProps.fixedHue) {
                // Dla matrix: zielone cząstki
                c.fillStyle = `hsla(${this.hue}, 90%, 55%, ${this.opacity})`;
            } else {
                // Dla space: białe cząstki
                c.fillStyle = `hsla(0, 0%, 100%, ${this.opacity})`;
            }

            if (this.glow) {
                c.shadowBlur = 6;
                c.shadowColor = this.themeProps.useHue
                    ? `hsl(${this.hue}, 80%, 60%)`
                    : this.themeProps.fixedHue
                      ? `hsl(${this.hue}, 90%, 55%)`
                      : 'white';
            } else {
                c.shadowBlur = 0;
            }

            c.beginPath();
            c.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            c.fill();
        }
    }

    function connectParticles(c: CanvasRenderingContext2D, particles: Particle[], themeProps: ThemeProps): void {
        if (!themeProps.connectLines) return;
        const distanceLimit = themeProps.lineDistance ?? 100;
        for (let i = 0; i < particles.length; i++) {
            for (let j = i + 1; j < particles.length; j++) {
                const dx = particles[i].x - particles[j].x;
                const dy = particles[i].y - particles[j].y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance < distanceLimit) {
                    const opacity = (1 - distance / distanceLimit) * 0.2;
                    if (themeProps.useHue) {
                        c.strokeStyle = `hsla(${particles[i].hue}, 70%, 60%, ${opacity})`;
                    } else {
                        c.strokeStyle = `rgba(255, 255, 255, ${opacity})`;
                    }
                    c.lineWidth = 0.5;
                    c.beginPath();
                    c.moveTo(particles[i].x, particles[i].y);
                    c.lineTo(particles[j].x, particles[j].y);
                    c.stroke();
                }
            }
        }
    }

    function initParticles(): void {
        if (!canvasEl) return;
        particlesArray.length = 0;
        currentProps = getThemeProps(currentTheme);
        for (let i = 0; i < currentProps.particleCount; i++) {
            particlesArray.push(new Particle(currentProps, canvasEl));
        }
    }

    function animateParticles(): void {
        if (!canvasEl || !ctx) return;
        ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
        for (let i = 0; i < particlesArray.length; i++) {
            particlesArray[i].update(currentProps, mouse);
            particlesArray[i].draw(ctx);
            // Odświeżanie cząstek jeśli za małe (tylko default)
            if (currentTheme === 'default' && (particlesArray[i].size <= 0.5 || particlesArray[i].opacity <= 0.2)) {
                particlesArray.splice(i, 1);
                particlesArray.push(new Particle(currentProps, canvasEl));
                i--;
            }
        }
        connectParticles(ctx, particlesArray, currentProps);
        requestAnimationFrame(animateParticles);
    }

    // Obsługa rozmiaru okna
    function handleResize(): void {
        if (!canvasEl) return;
        canvasEl.width = window.innerWidth;
        canvasEl.height = window.innerHeight;
        initParticles();
    }

    // --- Theme Toggle (5 motywów) ---
    const themeToggle = document.getElementById('themeToggle');

    function applyTheme(theme: Theme): void {
        currentTheme = theme;
        document.body.classList.remove('space-theme', 'cyber-theme', 'matrix-theme', 'sunset-theme');
        if (theme !== 'default') document.body.classList.add(`${theme}-theme`);
        initParticles();
        try {
            localStorage.setItem('theme', theme);
        } catch {
            /* localStorage niedostępny */
        }
    }

    themeToggle?.addEventListener('click', () => {
        const nextIndex = (THEMES.indexOf(currentTheme) + 1) % THEMES.length;
        applyTheme(THEMES[nextIndex]);
    });

    // --- Mouse tracking dla interakcji (tylko domyślny motyw) ---
    document.addEventListener('mousemove', (e: MouseEvent) => {
        mouse.x = e.clientX;
        mouse.y = e.clientY;
    });
    document.addEventListener('mouseout', () => {
        mouse.x = null;
        mouse.y = null;
    });

    window.addEventListener('resize', handleResize);

    // Inicjalizacja
    if (ctx) {
        handleResize();
        applyTheme(currentTheme);
        animateParticles();
    } else {
        console.warn('Canvas not supported');
    }

    // --- Form validation ---
    const searchForm = document.querySelector<HTMLFormElement>('.search-form');
    const input = document.querySelector<HTMLInputElement>('.search-input');
    if (searchForm && input) {
        searchForm.addEventListener('submit', (e: SubmitEvent) => {
            const query = input.value.trim();
            if (!query) {
                e.preventDefault();
                alert('Proszę wpisać frazę wyszukiwania!');
            }
        });
    }

    // --- Keyboard accessibility ---
    if (input) {
        document.addEventListener('keydown', (e: KeyboardEvent) => {
            if (e.key === 'Enter' && document.activeElement !== input) {
                input.focus();
            }
        });
    }

    // --- Language detection ---
    const userLang: string = navigator.language || 'en';
    const bottomLeftLink = document.querySelector<HTMLAnchorElement>('.bottom-left-link a');
    if (!userLang.startsWith('pl')) {
        document.documentElement.lang = 'en';
        if (input) input.placeholder = 'Search with Ecosia...';
        const footer = document.querySelector('footer');
        if (footer) {
            footer.innerHTML = `
            Powered by <a href="https://www.ecosia.org" target="_blank" aria-label="Ecosia Website">Ecosia</a> |
            <a href="https://hackeros-linux-system.github.io/HackerOS-Website/" target="_blank" aria-label="HackerOS Website">HackerOS</a> | © 2026
            `;
        }
        if (bottomLeftLink && bottomLeftLink.textContent === 'Odkryj nasz ekosystem') {
            bottomLeftLink.textContent = 'Discover our ecosystem';
        }
    } else {
        document.documentElement.lang = 'pl';
        if (bottomLeftLink && bottomLeftLink.textContent === 'Discover our ecosystem') {
            bottomLeftLink.textContent = 'Odkryj nasz ekosystem';
        }
    }

    // --- Offline: zapis stanu (motyw, adres, kopia ekranu) w localStorage + dialog offline.html ---
    // Logika we wspólnym module guard.ts (używa go też blue.html).
    initOfflineGuard('main', new URL('./', location.href).href);

    // --- Zdarzenia bezczynności: 5 min UFO, 10 min strzelec, 15 min samolot ---
    initIdleEvents();

    // Service Worker (sw.js) podstawia offline.html, gdy strona nie może się załadować bez internetu.
    // Wymaga HTTPS lub localhost.
    const swAllowed =
        location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    if ('serviceWorker' in navigator && swAllowed) {
        navigator.serviceWorker.register('sw.js').catch((err: unknown) => {
            console.warn('Service Worker registration failed:', err);
        });
    }
});
