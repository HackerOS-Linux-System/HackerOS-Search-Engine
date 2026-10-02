import { build } from 'esbuild';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(import.meta.url), '..', '..');
const dist = resolve(root, 'dist');
const p = (...parts: string[]): string => resolve(root, ...parts);

// Identyfikator buildu - zmienia nazwę cache w Service Workerze przy każdym wdrożeniu,
// dzięki czemu użytkownicy dostają świeże pliki.
const buildId: string = (process.env.GITHUB_SHA ?? Date.now().toString(36)).slice(0, 8);

const common = {
    bundle: true,
    format: 'iife',
    target: 'es2020',
    minify: true,
    legalComments: 'none',
    logLevel: 'warning',
} as const;

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

// 1) script.ts -> dist/script.js, sw.ts -> dist/sw.js
await build({
    ...common,
    entryPoints: { script: p('src/script.ts'), sw: p('src/sw.ts') },
    outdir: dist,
    define: { __BUILD_ID__: JSON.stringify(buildId) },
});

// 2) offline.ts -> wstawiony INLINE do 404.html (strona musi działać w pełni samodzielnie)
const offline = await build({
    ...common,
    entryPoints: [p('src/offline.ts')],
    write: false,
});
const offlineJs: string = offline.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const template: string = readFileSync(p('404.html'), 'utf8');
const marker = '/* @@OFFLINE_JS@@ */';
if (!template.includes(marker)) throw new Error(`404.html: brak znacznika ${marker}`);
writeFileSync(resolve(dist, '404.html'), template.replace(marker, () => offlineJs));

// 3) pliki statyczne
for (const file of ['index.html', 'styles.css', 'HackerOS.png', 'LICENSE']) {
    if (existsSync(p(file))) cpSync(p(file), resolve(dist, file));
    else console.warn(`UWAGA: brak pliku ${file} - pomijam`);
}

// 4) GitHub Pages: wyłącz Jekyll
writeFileSync(resolve(dist, '.nojekyll'), '');

console.log(`Build OK (id: ${buildId}) -> ${dist}`);
