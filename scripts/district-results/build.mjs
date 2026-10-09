#!/usr/bin/env node
// Writes scripts/history/districts/<id>.json for every election in sources.mjs,
// from the files fetch.mjs downloaded: each district's winner and shares, keyed
// like its boundary set. Fails unless the district wins add up to the national
// seats in scripts/history or data/countries.
//   node scripts/district-results/fetch.mjs
//   node scripts/district-results/build.mjs
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { ELECTIONS, cache, root } from './sources.mjs';
import { ca, uk, usHouse } from './parse.mjs';

const PARSE = { US: usHouse, GB: uk, CA: ca };
const readJSON = async file => JSON.parse(await readFile(file, 'utf8'));
const outDir = path.join(root, 'scripts', 'history', 'districts');
await mkdir(outDir, { recursive: true });

let failed = 0;
for (const e of ELECTIONS) {
  const parsed = PARSE[e.code](await readFile(path.join(cache, e.file), 'utf8'));
  const topo = await readJSON(path.join(root, 'data', 'districts', `${e.code}${e.set ? `.${e.set}` : ''}.topo.json`));
  const units = new Map(topo.objects.districts.geometries.map(g => [g.id.slice(e.code.length + 1), g.properties]));
  const missing = [...parsed.keys()].filter(k => !units.has(k));
  const unused = [...units.keys()].filter(k => !parsed.has(k));
  if (missing.length || unused.length) throw new Error(`${e.id}: not on the ${e.set ?? 'current'} map: ${missing.join(' ')} | no result: ${unused.join(' ')}`);
  const lost = [...parsed].filter(([, r]) => !r.winner && !r.voided).map(([k]) => k);
  if (lost.length) throw new Error(`${e.id}: no winner in ${lost.join(' ')}`);

  const lines = [...parsed].map(([abbr, r]) => `  ${JSON.stringify({
    abbr, name: units.get(abbr).name, region: units.get(abbr).region, winner: r.winner,
    ...(r.voided ? { voided: true } : {}), ...(r.votes ? { votes: r.votes } : {}), results: r.results
  })}`);
  await writeFile(path.join(outDir, `${e.id}.json`), `{\n  "set": ${JSON.stringify(e.set)},\n  "source": ${JSON.stringify(e.source)},\n  "districts": [\n${lines.join(',\n')}\n  ]\n}\n`);

  const won = {};
  for (const r of parsed.values()) won[r.winner ?? 'vac'] = (won[r.winner ?? 'vac'] ?? 0) + 1;
  const past = await readJSON(path.join(root, 'scripts', 'history', `${e.code}.json`));
  const now = await readJSON(path.join(root, 'data', 'countries', `${e.code}.json`));
  const el = [...past.elections, ...now.elections].find(x => x.id === e.id);
  const seats = Object.fromEntries((el?.candidates ?? []).filter(c => c.seats).map(c => [c.party, c.seats]));
  const off = Object.keys({ ...won, ...seats }).filter(p => (won[p] ?? 0) !== (seats[p] ?? 0));
  if (off.length) failed++;
  console.log(`${e.id}: ${parsed.size} districts, ${off.length ? `differ from the national seats: ${off.map(p => `${p} ${won[p] ?? 0} vs ${seats[p] ?? 0}`).join(', ')}` : 'wins match the national seats'}`);
}
process.exit(failed ? 1 : 0);
