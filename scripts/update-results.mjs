#!/usr/bin/env node
// Election-day updater. Meant to run every two minutes from cron: it exits at
// once unless data/schedule.json lists an election for today in that country's
// own time zone, or a count that started on an earlier day is still running.
// It asks the feed for results (for now the mock feed in scripts/adapters; no
// API is used), writes data/live/<CODE>.json, which the site polls, and once
// every race in the file is final folds the result into
// data/countries/<CODE>.json and removes the live file.
//
//   node scripts/update-results.mjs                         normal cron run
//   node scripts/update-results.mjs --date=2026-11-03       pretend it is another day
//   node scripts/update-results.mjs --country=BR --dry-run  fetch and print, write nothing
//   node scripts/update-results.mjs --force --country=US --reporting=70
//   node scripts/update-results.mjs --reset                 delete all live files

import { readFile, writeFile, readdir, unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { adapterFor } from './adapters/index.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = path.join(root, 'data');
const liveDir = path.join(dataDir, 'live');
const args = Object.fromEntries(
  process.argv.slice(2).map(a => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  })
);

const now = args.date ? new Date(`${args.date}T12:00:00`) : new Date();
const readJSON = async p => JSON.parse(await readFile(p, 'utf8'));
const writeJSON = (p, v) => (args['dry-run'] ? Promise.resolve() : writeFile(p, JSON.stringify(v, null, 2) + '\n'));

function localParts(tz, date) {
  const f = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false
  });
  const p = Object.fromEntries(f.formatToParts(date).map(x => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, minutes: Number(p.hour) * 60 + Number(p.minute) };
}

// Share of the count assumed in, from time since polls closed. Real feeds
// report this themselves; it only drives the mock.
function expectedReporting(entry) {
  if (args.reporting) return Math.min(100, Number(args.reporting));
  const { date, minutes } = localParts(entry.timezone, now);
  const [h, m] = (entry.pollsClose ?? '20:00').split(':').map(Number);
  const days = (Date.parse(date) - Date.parse(entry.date)) / 864e5;
  return Math.max(0, Math.min(100, Math.round((days * 1440 + minutes - (h * 60 + m)) / 1.5)));
}

const manifestPath = path.join(liveDir, 'index.json');

async function setLiveFlag(code, isLive) {
  const manifest = await readJSON(manifestPath).catch(() => ({ live: [] }));
  const live = new Set(manifest.live);
  isLive ? live.add(code) : live.delete(code);
  await writeJSON(manifestPath, { live: [...live].sort() });
}

async function reset() {
  for (const f of await readdir(liveDir)) {
    if (f.endsWith('.json') && f !== 'index.json') await unlink(path.join(liveDir, f));
  }
  await writeJSON(manifestPath, { live: [] });
  console.log('Removed live files.');
}

// New parties a feed reports (a first-time party on the ballot) join the
// country's party table so colours and names resolve on the page.
function takeParties(country, election) {
  const { parties, ...rest } = election;
  for (const [key, p] of Object.entries(parties ?? {})) country.parties[key] ??= p;
  return rest;
}

function promote(country, election) {
  const i = country.elections.findIndex(e => e.id === election.id);
  if (i >= 0) country.elections[i] = election;
  else {
    const first = country.elections.findIndex(e => e.office === election.office);
    country.elections.splice(first < 0 ? 0 : first, 0, election);
  }
}

function describe(code, e) {
  const call = e.call?.status === 'called' ? `called for ${e.call.winner} by ${e.call.by}`
    : e.call?.status === 'runoff' ? `run-off: ${e.call.parties.join(' v ')} (${e.call.by})`
    : e.call?.status ?? 'no call';
  const top = [...e.candidates].sort((a, b) => (b.seats ?? b.votes ?? 0) - (a.seats ?? a.votes ?? 0)).slice(0, 3)
    .map(c => `${c.name} ${c.seats != null ? `${c.seats} seats` : `${c.pct}%`}`).join(', ');
  const called = (e.regions ?? []).filter(r => r.winner).length;
  const up = (e.regions ?? []).filter(r => r.contested !== false).length;
  return `${code} ${e.office}: ${e.status}, ${e.reporting}% counted, ${called}/${up} regions called, ${call} [${e.source?.short}] · ${top}`;
}

async function main() {
  if (args.reset) return reset();

  const schedule = await readJSON(path.join(dataDir, 'schedule.json'));
  const { live } = await readJSON(manifestPath).catch(() => ({ live: [] }));
  const running = new Map();
  for (const code of live) {
    const file = await readJSON(path.join(liveDir, `${code}.json`)).catch(() => null);
    if (file) running.set(code, file.elections);
  }
  const due = schedule.filter(e => {
    if (args.country && e.country !== args.country.toUpperCase()) return false;
    if (args.force) return true;
    const today = localParts(e.timezone, now).date;
    if (today === e.date) return true;
    // A count still going after midnight carries on until every race is final.
    return e.date < today && running.get(e.country)?.some(l => l.office === e.office && l.date === e.date);
  });

  if (!due.length) {
    console.log(`No election today (${now.toISOString().slice(0, 10)}).`);
    return;
  }

  const byCountry = Map.groupBy(due, e => e.country);
  for (const [code, entries] of byCountry) {
    const file = path.join(dataDir, 'countries', `${code}.json`);
    const country = await readJSON(file);
    const elections = [];
    for (const entry of entries) {
      const adapter = adapterFor(entry);
      const result = takeParties(country, await adapter.fetch({ entry, country, reporting: expectedReporting(entry), now }));
      result.updatedAt ??= now.toISOString();
      elections.push(result);
      console.log(describe(code, result));
    }

    const livePath = path.join(liveDir, `${code}.json`);
    const allFinal = elections.every(e => e.status === 'final');
    if (allFinal && !args.force) {
      elections.forEach(e => promote(country, e));
      await writeJSON(file, country);
      if (!args['dry-run']) await unlink(livePath).catch(() => {});
      await setLiveFlag(code, false);
      console.log(`${code}: final, folded into data/countries/${code}.json${args['dry-run'] ? ' (dry run, nothing written)' : ''}`);
    } else {
      await writeJSON(livePath, { code, updatedAt: now.toISOString(), parties: country.parties, elections });
      await setLiveFlag(code, true);
    }
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
