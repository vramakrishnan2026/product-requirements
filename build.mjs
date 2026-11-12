// Inlines src/index.html into src/worker.js -> dist/worker.js (one file, paste-able into the Cloudflare dashboard).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const html = readFileSync(new URL('./src/index.html', import.meta.url), 'utf8');
const js = readFileSync(new URL('./src/worker.js', import.meta.url), 'utf8');
if (!js.includes('"__HTML__"')) throw new Error('placeholder missing');
mkdirSync(new URL('./dist/', import.meta.url), { recursive: true });
writeFileSync(new URL('./dist/worker.js', import.meta.url), js.replace('"__HTML__"', () => JSON.stringify(html)));
console.log('built dist/worker.js');
