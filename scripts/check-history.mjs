#!/usr/bin/env node
// Checks scripts/history/<CODE>.json, the national results of past elections,
// before build-history.mjs turns them into data/history/<CODE>.json.
//
//   node scripts/check-history.mjs IT        one country
//   node scripts/check-history.mjs           every file in scripts/history
//   node scripts/check-history.mjs US --file=other.json            a file kept elsewhere
//   node scripts/check-history.mjs US --file=current.json --current  replacements for today's elections, or newer ones

import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, 'scripts', 'history');
const args = process.argv.slice(2);
const fileArg = args.find(a => a.startsWith('--file='))?.slice(7);
const currentMode = args.includes('--current');
const codes = args.filter(a => !a.startsWith('--')).map(c => c.toUpperCase());
const files = codes.length ? codes.map(c => `${c}.json`) : (await readdir(dir)).filter(f => /^[A-Z]{2}\.json$/.test(f));

let failed = 0;
for (const file of files) {
  const errors = [];
  const warn = [];
  const code = file.slice(0, 2);
  const hist = JSON.parse(await readFile(fileArg ? path.resolve(fileArg) : path.join(dir, file), 'utf8'));
  const current = JSON.parse(await readFile(path.join(root, 'data', 'countries', file), 'utf8'));
  const latest = Object.fromEntries(current.elections.map(e => [e.office, e]).reverse());
  const regions = new Set(current.elections.flatMap(e => [e, ...(e.rounds ?? [])]).flatMap(v => v.regions ?? []).map(r => r.abbr));
  const parties = hist.parties ?? {};
  const ids = new Set();

  if (hist.code !== code) errors.push(`code is ${hist.code}, expected ${code}`);
  for (const [key, p] of Object.entries(parties)) {
    if (!/^[a-z0-9]+$/.test(key)) errors.push(`party key "${key}" should be lowercase letters and digits`);
    if (!p.name) errors.push(`party ${key} has no name`);
    if (!/^#[0-9A-Fa-f]{6}$/.test(p.color ?? '')) errors.push(`party ${key} colour "${p.color}" is not #RRGGBB`);
    const clash = current.parties[key];
    if (clash && clash.name !== p.name) warn.push(`party ${key} is "${p.name}" here but "${clash.name}" in data/countries/${file}`);
  }
  const known = key => parties[key] || current.parties[key];

  for (const el of hist.elections ?? []) {
    const at = el.id ?? '(no id)';
    if (ids.has(el.id)) errors.push(`${at}: duplicate id`);
    ids.add(el.id);
    if (!el.id?.startsWith(`${code.toLowerCase()}-`)) errors.push(`${at}: id should start with ${code.toLowerCase()}-`);
    const now = latest[el.office];
    if (!now) errors.push(`${at}: office "${el.office}" is not one of ${Object.keys(latest).join(', ')}`);
    else {
      if (el.kind !== now.kind) errors.push(`${at}: kind ${el.kind}, but ${el.office} is ${now.kind}`);
      if (currentMode) {
        // A replacement for today's election, or a newer one that will take its place.
        const replaces = el.id === now.id && el.date === now.date;
        if (!replaces && !(el.date > now.date)) errors.push(`${at}: should replace the current ${el.office} election (${now.id}, ${now.date}) or come after it`);
      } else if (!(el.date < now.date)) errors.push(`${at}: date ${el.date} is not before the current ${el.office} election (${now.date})`);
      if (el.date < '1948-01-01') errors.push(`${at}: date ${el.date} is before 1948`);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(el.date ?? '')) errors.push(`${at}: date "${el.date}" is not YYYY-MM-DD`);
    if (!/^https:\/\/en\.wikipedia\.org\/wiki\//.test(el.source?.url ?? '')) errors.push(`${at}: source.url should be the Wikipedia article`);
    if (!Number.isInteger(el.source?.revid)) errors.push(`${at}: source.revid missing`);
    if (el.turnout != null && !(el.turnout > 0 && el.turnout <= 100)) errors.push(`${at}: turnout ${el.turnout} out of range`);

    const views = el.rounds?.length ? el.rounds : [el];
    for (const v of views) {
      const label = el.rounds ? `${at} ${v.label}` : at;
      const cands = v.candidates ?? [];
      if (!cands.length) { errors.push(`${label}: no candidates`); continue; }
      const keys = cands.map(c => c.party);
      for (const c of cands) {
        if (!known(c.party)) errors.push(`${label}: party "${c.party}" is not defined`);
        if (c.votes != null && !Number.isInteger(c.votes)) errors.push(`${label}: ${c.party} votes not an integer`);
        if (c.pct != null && !(c.pct >= 0 && c.pct <= 100)) errors.push(`${label}: ${c.party} pct ${c.pct} out of range`);
        if (c.seats != null && !Number.isInteger(c.seats)) errors.push(`${label}: ${c.party} seats not an integer`);
      }
      if (el.kind === 'legislative' && new Set(keys).size !== keys.length) errors.push(`${label}: a party appears twice`);
      if (keys.filter(k => k === 'oth').length > 1) errors.push(`${label}: more than one Others row`);
      const withPct = cands.filter(c => c.pct != null);
      const pct = withPct.reduce((n, c) => n + c.pct, 0);
      if (withPct.length && (pct < 98.5 || pct > 101.5)) errors.push(`${label}: shares add up to ${pct.toFixed(2)}`);
      const votes = cands.filter(c => c.votes != null);
      const total = votes.reduce((n, c) => n + c.votes, 0);
      for (const c of votes) {
        if (c.pct != null && total && Math.abs((c.votes / total) * 100 - c.pct) > 0.3) warn.push(`${label}: ${c.party} pct ${c.pct} vs ${((c.votes / total) * 100).toFixed(2)} from votes`);
      }
    }

    const final = el.rounds?.length ? el.rounds.at(-1) : el;
    if (JSON.stringify(final.candidates) !== JSON.stringify(el.candidates)) {
      if (el.rounds?.length) errors.push(`${at}: candidates should repeat the last round`);
    }
    const winners = el.candidates?.filter(c => c.winner) ?? [];
    // A first round whose run-off is still to come flags the two going through instead.
    if (el.call?.status === 'runoff') {
      if (winners.length || el.candidates.filter(c => c.advanced).length !== 2) errors.push(`${at}: a pending run-off needs two candidates flagged advanced and no winner`);
    } else if (winners.length !== 1) errors.push(`${at}: ${winners.length} winners flagged, expected 1`);
    if (el.kind !== 'presidential' || el.totalSeats != null) {
      const seats = el.candidates.reduce((n, c) => n + (c.seats ?? 0), 0);
      if (!Number.isInteger(el.totalSeats)) errors.push(`${at}: totalSeats missing`);
      else if (seats !== el.totalSeats) errors.push(`${at}: seats add up to ${seats}, totalSeats is ${el.totalSeats}`);
      const top = [...el.candidates].filter(c => c.party !== 'oth').sort((a, b) => (b.seats ?? 0) - (a.seats ?? 0))[0];
      if (winners[0] && top && (winners[0].seats ?? 0) < (top.seats ?? 0)) errors.push(`${at}: winner ${winners[0].party} has fewer seats than ${top.party}`);
    }
    for (const [abbr, party] of Object.entries(el.regionWinners ?? {})) {
      if (!regions.has(abbr)) errors.push(`${at}: region "${abbr}" is not on the map (${[...regions].join(' ')})`);
      if (!known(party)) errors.push(`${at}: region ${abbr} winner "${party}" is not defined`);
    }
    if (el.regionWinners && !el.regionSource) errors.push(`${at}: regionWinners without regionSource`);
    for (const abbr of el.voted ?? []) if (!regions.has(abbr)) errors.push(`${at}: voted region "${abbr}" is not on the map`);
    if (el.voted) for (const abbr of Object.keys(el.regionWinners ?? {})) if (!el.voted.includes(abbr)) errors.push(`${at}: region ${abbr} has a winner but is not in voted`);
    if (el.partial && !el.regionWinners && !el.voted) errors.push(`${at}: partial needs regionWinners or voted`);
  }

  const byOffice = Object.groupBy(hist.elections ?? [], e => e.office);
  for (const [office, list] of Object.entries(byOffice)) {
    const years = list.map(e => e.date.slice(0, 4)).sort();
    warn.unshift(`${office}: ${list.length} elections, ${years[0]}–${years.at(-1)}`);
  }
  console.log(`${code}: ${errors.length ? `${errors.length} error(s)` : 'ok'}`);
  for (const w of warn) console.log(`  note  ${w}`);
  for (const e of errors) console.log(`  ERROR ${e}`);
  if (errors.length) failed++;
}
process.exit(failed ? 1 : 0);
