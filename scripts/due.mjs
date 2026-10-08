#!/usr/bin/env node
// Lists elections in data/schedule.json that have taken place but whose results
// are not in data/countries yet, once the count has had time to settle. The
// results refresh (docs/REFRESH.md) starts from this list.
//   node scripts/due.mjs                     as of today (UTC)
//   node scripts/due.mjs --today=2026-10-26  as of another day
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = async file => JSON.parse(await readFile(path.join(root, file), 'utf8'));

// Days to wait after polling day. US states count for a week or more,
// Australia's close seats take about ten days, and Ireland's transfers and
// Mexico's official district counts take a few.
const SETTLE = { US: 7, AU: 10, IE: 3, MX: 3 };

const today = process.argv.find(a => a.startsWith('--today='))?.slice(8) ?? new Date().toISOString().slice(0, 10);
const addDays = (iso, n) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

const schedule = await read('data/schedule.json');
const files = new Map();
const due = [];
for (const s of schedule) {
  if (addDays(s.date, SETTLE[s.country] ?? 1) > today) continue;
  if (!files.has(s.country)) files.set(s.country, await read(`data/countries/${s.country}.json`));
  // Already in: the office has an election on or after this date (a run-off
  // counts once its round is added).
  const done = files.get(s.country).elections.some(e => e.office === s.office && (e.rounds?.at(-1)?.date ?? e.date) >= s.date);
  if (!done) due.push(s);
}

if (!due.length) console.log(`Nothing due as of ${today}.`);
for (const s of due) {
  // A run-off whose first round is already the current election completes it.
  const completes = /run-off/i.test(s.note ?? '') && s.basedOn?.endsWith(s.date.slice(0, 4));
  console.log(`${s.country} ${s.office}${s.note ? ` (${s.note.toLowerCase()})` : ''} on ${s.date}${s.tentative ? ', a tentative date' : ''}; ${completes ? 'adds the run-off to' : 'replaces'} ${s.basedOn}`);
}
