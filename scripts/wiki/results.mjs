// Reads one {{Election results}} template from a wikitext file and prints its
// rows as JSON: name, article, votes, seats, change, and each row's share of
// the parsed rows' votes. Check the output against the raw table.
//   node scripts/wiki/results.mjs out.txt <line where the template starts> [--seats=FIELD] [--change=FIELD] [--label=cand]
// Some templates keep total seats in totseats or st2t/st3t (--seats=totseats);
// presidential ones name candidates in cand<N> (--label=cand); two-round ones
// hold second-round votes in votes<N>_2.
import fs from 'node:fs';

const [file, startLine, seatArg = 'seats'] = process.argv.slice(2).filter(a => !a.startsWith('--'));
const flag = (name, fallback) => process.argv.find(a => a.startsWith(`--${name}=`))?.split('=')[1] ?? fallback;
const seatField = flag('seats', seatArg);
const changeField = flag('change', null);
const labelField = flag('label', null);
const lines = fs.readFileSync(file, 'utf8').split('\n');
let depth = 0;
let body = '';
for (let i = Number(startLine) - 1; i < lines.length; i++) {
  body += lines[i] + '\n';
  depth += (lines[i].match(/\{\{/g) ?? []).length - (lines[i].match(/\}\}/g) ?? []).length;
  if (depth <= 0 && body.includes('{{')) break;
}

// Drop footnotes and refs so they do not split parameters.
const clean = body
  .replace(/<!--[\s\S]*?-->/g, '')
  .replace(/<ref[^>]*\/>/g, '')
  .replace(/<ref[^>]*>[\s\S]*?<\/ref>/g, '')
  .replace(/\{\{efn[^{}]*(\{\{[^{}]*\}\}[^{}]*)*\}\}/g, '');

const params = {};
let level = 0;
let cur = '';
for (const ch of clean.slice(2, -3)) {
  if (ch === '{' || ch === '[') level++;
  if (ch === '}' || ch === ']') level--;
  if (ch === '|' && level === 0) {
    const eq = cur.indexOf('=');
    if (eq > 0) params[cur.slice(0, eq).trim()] = cur.slice(eq + 1).trim();
    cur = '';
  } else cur += ch;
}
const eq = cur.indexOf('=');
if (eq > 0) params[cur.slice(0, eq).trim()] = cur.slice(eq + 1).trim();

const num = v => (v == null || v === '' ? null : Number(String(v).replace(/[,\s]/g, '').replace(/[–−]/g, '-').replace(/^\+/, '')));
const link = v => {
  const m = /\[\[([^|\]]+)(?:\|([^\]]+))?\]\]/.exec(v ?? '');
  return m ? { article: m[1], name: (m[2] ?? m[1]).replace(/<br\s*\/?>/g, ' ') } : { article: null, name: (v ?? '').replace(/<br\s*\/?>/g, ' ') };
};

const rows = [];
for (let n = 1; n < 200; n++) {
  const label = (labelField && params[`${labelField}${n}`]) ?? params[`party${n}`] ?? params[`alliance${n}`] ?? params[`cand${n}`];
  if (label == null) continue;
  const hasVotes = params[`votes${n}`] != null;
  if (!hasVotes && params[`aspan${n}`]) continue; // alliance header row
  const change = changeField ? params[`${changeField}${n}`] : params[`sc${n}`] ?? params[`st3t${n}`];
  const ill = /\{\{ill\|([^|}]+)(?:\|lt=([^|}]+))?/.exec(label);
  rows.push({
    n, ...(ill ? { article: ill[1], name: ill[2] ?? ill[1] } : link(label)),
    party: labelField ? link(params[`party${n}`]).name : undefined,
    votes: num(params[`votes${n}`]),
    seats: num(params[`${seatField}${n}`]),
    change: change && /new/i.test(change) ? 'new' : num(change)
  });
}
const valid = rows.reduce((s, r) => s + (r.votes ?? 0), 0);
for (const r of rows) r.pct = r.votes != null ? Math.round((r.votes / valid) * 10000) / 100 : null;
console.log(JSON.stringify({ valid, seats: rows.reduce((s, r) => s + (r.seats ?? 0), 0), rows }, null, 1));
