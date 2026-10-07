#!/usr/bin/env node
// Builds dist/ for deployment. Every file except the live results is linked
// with a hash of its contents (data/index.json?v=3f9a1c2b7e), and vercel.json
// lets browsers keep those URLs for a year. Returning visitors load the code
// and maps from their cache, and a changed file gets a new hash, so no one is
// left on an old copy. Modules and data go through an import map; the links
// in index.html are rewritten.

import { createHash } from 'node:crypto';
import { cp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'dist');

await rm(out, { recursive: true, force: true });
for (const dir of ['css', 'js', 'data']) await cp(path.join(root, dir), path.join(out, dir), { recursive: true });

const hashes = {};
for (const file of await readdir(out, { recursive: true })) {
  const url = file.split(path.sep).join('/');
  if (!/\.(js|css|json)$/.test(url) || url.startsWith('data/live/')) continue;
  hashes[url] = createHash('sha256').update(await readFile(path.join(out, file))).digest('hex').slice(0, 10);
}

const imports = Object.fromEntries(Object.entries(hashes)
  .filter(([url]) => !url.endsWith('.css'))
  .map(([url, hash]) => [`./${url}`, `./${url}?v=${hash}`]));
const html = (await readFile(path.join(root, 'index.html'), 'utf8'))
  .replace(/(src|href)="((?:js|css)\/[^"]+)"/g, (_, attr, url) => `${attr}="${url}?v=${hashes[url]}"`)
  .replace('<script type="module"', `<script type="importmap">${JSON.stringify({ imports }, null, 1)}</script>\n<script type="module"`);
await writeFile(path.join(out, 'index.html'), html);
console.log(`dist/: ${Object.keys(hashes).length} files versioned`);
