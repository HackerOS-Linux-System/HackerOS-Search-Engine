document.addEventListener('DOMContentLoaded', () => {
    // --- Particle Animation ---
    const canvas = document.getElementById('particles');
    const ctx = canvas.getContext('2d');
    let particlesArray = [];
    let mouse = { x: null, y: null, radius: 100 };
    let currentTheme = localStorage.getItem('theme') || 'default';

    // Helper do pobierania właściwości motywu
    function getThemeProps(theme) {
        switch(theme) {
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
                    glowEffect: true
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
                    glowEffect: true
                };
            default: // default
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
                    glowEffect: false
                };
        }
    }

    class Particle {
        constructor(themeProps) {
            this.themeProps = themeProps;
            this.x = Math.random() * canvas.width;
            this.y = Math.random() * canvas.height;
            this.size = Math.random() * (themeProps.baseSizeMax - themeProps.baseSizeMin) + themeProps.baseSizeMin;
            this.baseSize = this.size;
            this.speedX = Math.random() * (themeProps.speedMax - themeProps.speedMin) + themeProps.speedMin;
            this.speedY = Math.random() * (themeProps.speedMax - themeProps.speedMin) + themeProps.speedMin;
            this.opacity = Math.random() * (themeProps.opacityMax - themeProps.opacityMin) + themeProps.opacityMin;
            if (themeProps.useHue) {
                this.hue = Math.random() * (themeProps.hueMax - themeProps.hueMin) + themeProps.hueMin;
            } else {
                this.hue = 0; // nieużywane dla space
            }
            this.glow = themeProps.glowEffect;
        }

        update(themeProps, mouse) {
            this.x += this.speedX;
            this.y += this.speedY;

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
            if (this.x < 0 || this.x > canvas.width) this.speedX *= -1;
            if (this.y < 0 || this.y > canvas.height) this.speedY *= -1;
        }

        draw(ctx) {
            if (this.themeProps.useHue) {
                ctx.fillStyle = `hsla(${this.hue}, 70%, 60%, ${this.opacity})`;
            } else {
                // Dla space: białe cząstki
                ctx.fillStyle = `hsla(0, 0%, 100%, ${this.opacity})`;
            }

            if (this.glow) {
                ctx.shadowBlur = 6;
                ctx.shadowColor = this.themeProps.useHue ? `hsl(${this.hue}, 80%, 60%)` : 'white';
            } else {
                ctx.shadowBlur = 0;
            }

            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    function connectParticles(particlesArray, themeProps) {
        if (!themeProps.connectLines) return;
        const distanceLimit = themeProps.lineDistance || 100;
        for (let i = 0; i < particlesArray.length; i++) {
            for (let j = i + 1; j < particlesArray.length; j++) {
                const dx = particlesArray[i].x - particlesArray[j].x;
                const dy = particlesArray[i].y - particlesArray[j].y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance < distanceLimit) {
                    const opacity = (1 - distance / distanceLimit) * 0.2;
                    if (themeProps.useHue) {
                        ctx.strokeStyle = `hsla(${particlesArray[i].hue}, 70%, 60%, ${opacity})`;
                    } else {
                        ctx.strokeStyle = `rgba(255, 255, 255, ${opacity})`;
                    }
                    ctx.lineWidth = 0.5;
                    ctx.beginPath();
                    ctx.moveTo(particlesArray[i].x, particlesArray[i].y);
                    ctx.lineTo(particlesArray[j].x, particlesArray[j].y);
                    ctx.stroke();
                }
            }
        }
    }

    function initParticles() {
        particlesArray.length = 0;
        const themeProps = getThemeProps(currentTheme);
        for (let i = 0; i < themeProps.particleCount; i++) {
            particlesArray.push(new Particle(themeProps));
        }
    }

    function animateParticles() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const themeProps = getThemeProps(currentTheme);
        for (let i = 0; i < particlesArray.length; i++) {
            particlesArray[i].update(themeProps, mouse);
            particlesArray[i].draw(ctx);
            // Odświeżanie cząstek jeśli za małe (tylko default)
            if (currentTheme === 'default' && (particlesArray[i].size <= 0.5 || particlesArray[i].opacity <= 0.2)) {
                particlesArray.splice(i, 1);
                particlesArray.push(new Particle(themeProps));
                i--;
            }
        }
        connectParticles(particlesArray, themeProps);
        requestAnimationFrame(animateParticles);
    }

    // Obsługa rozmiaru okna
    function handleResize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        initParticles();
    }

    // --- Theme Toggle (3 motywy) ---
    const themeToggle = document.getElementById('themeToggle');
    const themes = ['default', 'space', 'cyber'];

    function applyTheme(theme) {
        currentTheme = theme;
        document.body.classList.remove('space-theme', 'cyber-theme');
        if (theme === 'space') {
            document.body.classList.add('space-theme');
        } else if (theme === 'cyber') {
            document.body.classList.add('cyber-theme');
        }
        initParticles();
        localStorage.setItem('theme', theme);
    }

    themeToggle.addEventListener('click', () => {
        let nextIndex = (themes.indexOf(currentTheme) + 1) % themes.length;
        applyTheme(themes[nextIndex]);
    });

    // --- Mouse tracking dla interakcji (tylko domyślny motyw) ---
    document.addEventListener('mousemove', (e) => {
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
    const searchForm = document.querySelector('.search-form');
    const input = document.querySelector('.search-input');
    if (searchForm) {
        searchForm.addEventListener('submit', function(e) {
            const query = input.value.trim();
            if (!query) {
                e.preventDefault();
                alert('Proszę wpisać frazę wyszukiwania!');
            }
        });
    }

    // --- Keyboard accessibility ---
    if (input) {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && document.activeElement !== input) {
                input.focus();
            }
        });
    }

    // --- Language detection ---
    const userLang = navigator.language || navigator.userLanguage;
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
        // Uwaga: link w bottom-left-link jest już zmieniony statycznie w HTML, ale tekst pozostawiamy angielski
        const bottomLeftLink = document.querySelector('.bottom-left-link a');
        if (bottomLeftLink && bottomLeftLink.textContent === 'Odkryj nasz ekosystem') {
            bottomLeftLink.textContent = 'Discover our ecosystem';
        }
    } else {
        document.documentElement.lang = 'pl';
        const bottomLeftLink = document.querySelector('.bottom-left-link a');
        if (bottomLeftLink && bottomLeftLink.textContent === 'Discover our ecosystem') {
            bottomLeftLink.textContent = 'Odkryj nasz ekosystem';
        }
    }
});
