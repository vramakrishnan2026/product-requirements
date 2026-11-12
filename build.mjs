// Inlines src/index.html into src/worker.js -> dist/worker.js (one file, paste-able into the Cloudflare dashboard).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const html = readFileSync(new URL('./src/index.html', import.meta.url), 'utf8');
const js = readFileSync(new URL('./src/worker.js', import.meta.url), 'utf8');
const form = readFileSync(new URL('./src/profiles.js', import.meta.url), 'utf8') + '\n' + readFileSync(new URL('./src/form.js', import.meta.url), 'utf8');
const schema = readFileSync(new URL('./schema.sql', import.meta.url), 'utf8');
if (!js.includes('"__HTML__"')) throw new Error('placeholder missing');
mkdirSync(new URL('./dist/', import.meta.url), { recursive: true });
const html2 = html.replace('/*__FORM__*/', () => form);
writeFileSync(new URL('./dist/worker.js', import.meta.url), js.replace('/*__FORM__*/', () => form).replace('"__HTML__"', () => JSON.stringify(html2)).replace('"__SCHEMA__"', () => JSON.stringify(schema)));
console.log('built dist/worker.js');
