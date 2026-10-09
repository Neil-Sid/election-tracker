#!/usr/bin/env node
// Downloads every file in sources.mjs into .cache/district-results. Files
// already there are kept; --force downloads them again.
//   node scripts/district-results/fetch.mjs
import { access, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { BOUNDARIES, ELECTIONS, cache } from './sources.mjs';

const force = process.argv.includes('--force');
await mkdir(cache, { recursive: true });
for (const [name, url] of [...ELECTIONS.map(e => [e.file, e.url]), ...Object.entries(BOUNDARIES)]) {
  const file = path.join(cache, name);
  if (!force && await access(file).then(() => true, () => false)) continue;
  const res = await fetch(url, { headers: { 'User-Agent': 'election-tracker/1.0 (district results script)' } });
  if (!res.ok) throw new Error(`${name}: ${res.status} from ${url}`);
  const body = Buffer.from(await res.arrayBuffer());
  await writeFile(file, body);
  console.log(`${(body.length / 1048576).toFixed(2).padStart(6)} MB  ${name}`);
}
