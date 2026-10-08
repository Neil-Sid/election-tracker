#!/usr/bin/env node
// Independent check of national results against their sources: for each
// election, fetch the exact revision in source.revid and confirm every
// party's vote count (and the seat total) appears in that wikitext. A number
// that isn't in the source was misparsed, summed by hand (say so in notes) or
// made up.
//   node scripts/verify-history.mjs BR [US ...]       scripts/history/<CODE>.json
//   node scripts/verify-history.mjs BR --file=x.json  any file in the history schema
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { UA } from './wiki/page.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cacheDir = path.join(root, '.cache', 'revisions');
fs.mkdirSync(cacheDir, { recursive: true });

async function revision(revid) {
  const file = path.join(cacheDir, `${revid}.txt`);
  if (fs.existsSync(file)) return fs.readFileSync(file, 'utf8');
  // The raw endpoint serves an exact revision without the API's rate limits.
  const url = `https://en.wikipedia.org/w/index.php?action=raw&oldid=${revid}`;
  for (let attempt = 0; attempt < 8; attempt++) {
    await new Promise(r => setTimeout(r, 250 + attempt * attempt * 1500));
    const res = await fetch(url, { headers: { 'User-Agent': UA } }).catch(() => null);
    if (!res?.ok) continue;
    const text = await res.text();
    fs.writeFileSync(file, text);
    return text;
  }
  throw new Error(`Could not fetch revision ${revid}`);
}

// Digits with any thousands separator: 12740042, 12,740,042, 12 740 042, 12.740.042.
const appears = (text, n) => {
  const groups = String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '\u0000').split('\u0000');
  return new RegExp(`(^|[^\\d])${groups.join('[,\\s.  ]?')}([^\\d]|$)`).test(text);
};

const fileArg = process.argv.find(a => a.startsWith('--file='))?.slice(7);
let failed = 0;
for (const code of process.argv.slice(2).filter(a => !a.startsWith('--')).map(c => c.toUpperCase())) {
  const hist = JSON.parse(fs.readFileSync(fileArg ? path.resolve(fileArg) : path.join(root, 'scripts', 'history', `${code}.json`), 'utf8'));
  let rows = 0;
  let found = 0;
  const misses = [];
  for (const el of hist.elections) {
    const text = await revision(el.source.revid);
    const views = el.rounds?.length ? el.rounds : [el];
    for (const v of views) {
      for (const c of v.candidates) {
        if (c.party === 'oth' || c.votes == null) continue;
        rows++;
        if (appears(text, c.votes)) found++;
        else misses.push(`${el.id}${el.rounds ? ` ${v.label}` : ''}: ${c.party} votes ${c.votes} not in source`);
      }
    }
    if (el.totalSeats && !appears(text, el.totalSeats)) misses.push(`${el.id}: total ${el.totalSeats} seats not in source`);
  }
  console.log(`${code}: ${found}/${rows} vote counts found verbatim in the cited revisions`);
  for (const m of misses) console.log(`  ${m}`);
  if (found < rows) failed++;
}
process.exit(failed ? 1 : 0);
