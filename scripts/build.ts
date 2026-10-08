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

// 1) script.ts -> dist/script.js, blue.ts -> dist/blue.js, sw.ts -> dist/sw.js
//    (guard.ts i idle.ts są wspólnymi modułami - esbuild dołącza je do script.js i blue.js)
await build({
    ...common,
    entryPoints: { script: p('src/script.ts'), blue: p('src/blue.ts'), sw: p('src/sw.ts') },
    outdir: dist,
    define: { __BUILD_ID__: JSON.stringify(buildId) },
});

// 2) szablony HTML z kodem wstawianym INLINE (strony muszą działać w pełni samodzielnie, także bez internetu):
//    - 404.html     <- src/offline.ts      (znacznik @@OFFLINE_JS@@)
//    - offline.html <- src/offline-page.ts (znacznik @@OFFLINE_PAGE_JS@@)
async function inlineScript(entry: string, template: string, marker: string, out: string): Promise<void> {
    const result = await build({ ...common, entryPoints: [p(entry)], write: false });
    const js: string = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
    const html: string = readFileSync(p(template), 'utf8');
    if (!html.includes(marker)) throw new Error(`${template}: brak znacznika ${marker}`);
    writeFileSync(resolve(dist, out), html.replace(marker, () => js));
}
await inlineScript('src/offline.ts', '404.html', '/* @@OFFLINE_JS@@ */', '404.html');
await inlineScript('src/offline-page.ts', 'offline.html', '/* @@OFFLINE_PAGE_JS@@ */', 'offline.html');

// 3) pliki statyczne
for (const file of ['index.html', 'styles.css', 'blue.html', 'blue.css', 'LICENSE']) {
    if (existsSync(p(file))) cpSync(p(file), resolve(dist, file));
    else console.warn(`UWAGA: brak pliku ${file} - pomijam`);
}

// 4) GitHub Pages: wyłącz Jekyll
writeFileSync(resolve(dist, '.nojekyll'), '');

console.log(`Build OK (id: ${buildId}) -> ${dist}`);
