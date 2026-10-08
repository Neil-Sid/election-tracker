#!/usr/bin/env node
// Checks a country's current elections after `npm run mock`: sourced region
// winners are on the map, district wins add up to national seats, region seats
// add up, and region shares add up to 100%.
//   node scripts/check-current.mjs BR
//   node scripts/check-current.mjs BR --sourced=new.json   also compare with that file's regionWinners
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourcedArg = process.argv.find(a => a.startsWith('--sourced='))?.slice(10);
const sourced = sourcedArg ? JSON.parse(await readFile(path.resolve(sourcedArg), 'utf8')).elections : [];
let failed = 0;

for (const code of process.argv.slice(2).filter(a => !a.startsWith('--')).map(c => c.toUpperCase())) {
  const country = JSON.parse(await readFile(path.join(root, 'data', 'countries', `${code}.json`), 'utf8'));
  for (const el of country.elections) {
    const problems = [];
    const view = el.rounds ? el.rounds.at(-1) : el;
    const src = sourced.find(e => e.id === el.id);
    for (const [abbr, party] of Object.entries(src?.regionWinners ?? {})) {
      const r = view.regions?.find(x => x.abbr === abbr);
      if (!r) problems.push(`${abbr} missing`);
      else if (r.winner !== party) problems.push(`${abbr} ${r.winner} (source ${party})`);
    }
    const national = Object.fromEntries(el.candidates.filter(c => c.seats).map(c => [c.party, c.seats]));
    if (el.districts && el.districts.length === el.totalSeats) {
      const won = {};
      for (const d of el.districts) won[d.winner] = (won[d.winner] ?? 0) + 1;
      for (const p of new Set([...Object.keys(won), ...Object.keys(national)])) {
        if ((won[p] ?? 0) !== (national[p] ?? 0)) problems.push(`districts: ${p} won ${won[p] ?? 0}, national ${national[p] ?? 0}`);
      }
    }
    if (el.totalSeats && el.kind !== 'presidential' && view.regions?.some(r => r.results?.some(x => x.seats != null))) {
      const regionSeats = {};
      for (const r of view.regions) for (const x of r.results ?? []) regionSeats[x.party] = (regionSeats[x.party] ?? 0) + (x.seats ?? 0);
      // Where the map covers only part of the chamber (seats elected abroad,
      // a Senate's holdovers), no party may have more seats on it than in all.
      const covered = view.regions.reduce((n, r) => n + (r.seats ?? 0), 0) === el.totalSeats;
      const off = Object.keys({ ...regionSeats, ...national }).filter(p => covered ? (regionSeats[p] ?? 0) !== (national[p] ?? 0) : (regionSeats[p] ?? 0) > (national[p] ?? 0));
      if (off.length) problems.push(`region seats off: ${off.map(p => `${p} ${regionSeats[p] ?? 0}/${national[p] ?? 0}`).join(' ')}`);
    }
    for (const r of view.regions ?? []) {
      const sum = (r.results ?? []).reduce((n, x) => n + x.pct, 0);
      if (r.results && (sum < 99 || sum > 101)) problems.push(`${r.abbr} shares add up to ${sum.toFixed(1)}`);
      if (r.results?.some(x => x.seats > 0 && !(x.pct > 0))) problems.push(`${r.abbr} has seats on a 0% share`);
    }
    console.log(`${el.id}: ${problems.length ? problems.join('; ') : 'ok'}${src?.regionWinners ? ` (${Object.keys(src.regionWinners).length} sourced winners)` : ''}`);
    if (problems.length) failed++;
  }
}
process.exit(failed ? 1 : 0);
