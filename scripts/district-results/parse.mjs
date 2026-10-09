// Results by district from each source, as Map(key -> { winner, results }),
// keyed like data/districts: "TX-7", "E14001063", "35001".

const STATES = {
  Alabama: 'AL', Alaska: 'AK', Arizona: 'AZ', Arkansas: 'AR', California: 'CA', Colorado: 'CO', Connecticut: 'CT', Delaware: 'DE',
  Florida: 'FL', Georgia: 'GA', Hawaii: 'HI', Idaho: 'ID', Illinois: 'IL', Indiana: 'IN', Iowa: 'IA', Kansas: 'KS', Kentucky: 'KY',
  Louisiana: 'LA', Maine: 'ME', Maryland: 'MD', Massachusetts: 'MA', Michigan: 'MI', Minnesota: 'MN', Mississippi: 'MS',
  Missouri: 'MO', Montana: 'MT', Nebraska: 'NE', Nevada: 'NV', 'New Hampshire': 'NH', 'New Jersey': 'NJ', 'New Mexico': 'NM',
  'New York': 'NY', 'North Carolina': 'NC', 'North Dakota': 'ND', Ohio: 'OH', Oklahoma: 'OK', Oregon: 'OR', Pennsylvania: 'PA',
  'Rhode Island': 'RI', 'South Carolina': 'SC', 'South Dakota': 'SD', Tennessee: 'TN', Texas: 'TX', Utah: 'UT', Vermont: 'VT',
  Virginia: 'VA', Washington: 'WA', 'West Virginia': 'WV', Wisconsin: 'WI', Wyoming: 'WY'
};
const NON_VOTING = new Set(['DC', 'AS', 'GU', 'MP', 'PR', 'VI']);
const stateOf = s => (s.trim().length === 2 ? s.trim().toUpperCase() : STATES[s.trim()]);
const ROW = /^!\s*(?:[^|]*\|)?\s*\{\{ushr\|([A-Za-z ]+)\|([^|}]+)/i;
const usParty = name => {
  const n = (name ?? '').trim();
  if (/^Democrat|^DFL\b/i.test(n)) return 'dem';
  if (/^Republican/i.test(n)) return 'gop';
  if (/Libertarian/i.test(n)) return 'lib';
  if (/^Independent/i.test(n)) return 'ind';
  if (/Green/i.test(n)) return 'grn';
  return 'oth';
};

// The district tables of a Wikipedia article on a US House election. Each
// district's candidates follow its {{ushr}} header as "(Party) 61.4%", one per
// bullet or <br>. The winner carries {{Aye}}; a row without one still says
// "Democratic hold" or "Republican gain".
export function usHouse(text) {
  const lines = text.split('\n');
  const out = new Map();
  let section = '';
  for (let i = 0; i < lines.length; i++) {
    if (/^==/.test(lines[i])) section = lines[i];
    // Special elections fill a seat for the rest of a term; the map shows the general election.
    if (/special/i.test(section)) continue;
    const m = ROW.exec(lines[i]);
    const st = m && stateOf(m[1]);
    if (!st || NON_VOTING.has(st)) continue;
    const key = `${st}-${/^(AL|at-large)$/i.test(m[2].trim()) ? 'AL' : Number(m[2])}`;
    const block = [];
    for (let j = i + 1; j < lines.length && !ROW.test(lines[j]) && !/^\|\}/.test(lines[j]); j++) block.push(lines[j]);
    let cell = block.join('\n')
      .replace(/<ref[^>]*\/>/g, '').replace(/<ref[^>]*>[\s\S]*?<\/ref>/g, '').replace(/\{\{efn[^{}]*\}\}/gi, '')
      .replace(/\[\[(?:[^\]|]*\|)?([^\]|]*)\]\]/g, '$1')
      .replace(/\)\s*(?:\n\*|<br\s*\/?>)\s*(?:'{2,3})?\s*(?:Unopposed|Uncontested)/gi, ') Unopposed');
    // With a first round and a run-off or final count, only the last round decides.
    const rounds = cell.split(/(?:Runoff|Run-off|Final round|Second round|Last round|Instant[- ]runoff)\s*:?\s*'*\s*\}*/i);
    if (rounds.length > 1 && /\(\s*[^()]+\)\s*'*\s*\d/.test(rounds.at(-1))) cell = rounds.at(-1);
    const cands = [];
    for (const seg of cell.split(/\n|<br\s*\/?>/i)) {
      const c = /\(([^()]{2,80})\)\s*(?:'''|'')?\s*(\d+(?:\.\d+)?\s*%|unopposed|uncontested)/i.exec(seg);
      if (!c) continue;
      const pcts = [...seg.matchAll(/(\d+(?:\.\d+)?)\s*%/g)].map(x => Number(x[1]));
      cands.push({ party: usParty(c[1].split(/[,/]/)[0]), pct: pcts.length ? pcts.at(-1) : 100, winner: /\{\{\s*(Aye|Y)\s*\}\}/i.test(seg) });
    }
    if (!cands.length) continue;
    const status = block.find(l => /re-elected|retired|gain|hold|lost|vacant|special|not certified/i.test(l) && !/^\*/.test(l)) ?? '';
    const held = /\b(Democratic|Republican|Libertarian|Independent)\s+(?:hold|gain)\b/i.exec(status);
    const winner = cands.find(c => c.winner)?.party ?? (held ? usParty(held[1]) : null);
    // A district listed twice (a vacancy row) keeps the general election row.
    if (out.has(key) && !winner) continue;
    out.set(key, { winner, voided: !winner && /results? void/i.test(block.join(' ')), results: shares(cands) });
  }
  return out;
}

// Shares by party, highest first. Independents are not a party, so only the
// strongest counts as one. A cell listing two rounds adds up to about 200%: its
// two finalists are kept. A row a little over 100% is a typo in the article and
// is scaled down; one under 100% leaves out write-ins or minor candidates, whose
// remainder goes to others.
function shares(cands) {
  const top = cands.filter(c => c.party === 'ind').sort((a, b) => b.pct - a.pct)[0];
  const by = new Map();
  for (const c of cands) {
    const party = c.party === 'ind' && c !== top ? 'oth' : c.party;
    by.set(party, (by.get(party) ?? 0) + c.pct);
  }
  let list = [...by].map(([party, pct]) => ({ party, pct }));
  let total = list.reduce((n, r) => n + r.pct, 0);
  if (total > 105) {
    const best = new Map();
    for (const c of cands) best.set(c.party, Math.max(best.get(c.party) ?? 0, c.pct));
    list = [...best].map(([party, pct]) => ({ party, pct })).sort((a, b) => b.pct - a.pct).slice(0, 2);
    total = list.reduce((n, r) => n + r.pct, 0);
  }
  if (total > 100.5) list = list.map(r => ({ party: r.party, pct: (r.pct / total) * 100 }));
  else if (total < 99.5) {
    const oth = list.find(r => r.party === 'oth');
    if (oth) oth.pct += 100 - total;
    else list.push({ party: 'oth', pct: 100 - total });
  }
  return list.sort((a, b) => b.pct - a.pct).map(r => ({ party: r.party, pct: Math.round(r.pct * 10) / 10 }));
}

export function parseCSV(text) {
  const rows = [];
  let row = [], f = '', q = false;
  const t = text.replace(/^﻿/, '');
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) {
      if (c === '"') { if (t[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\n') { row.push(f.replace(/\r$/, '')); rows.push(row); row = []; f = ''; }
    else f += c;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  return rows;
}

// Votes by party, winner's party first; candidates of one party are added
// together, and independents beyond the strongest join the others.
function byParty(cands) {
  const total = cands.reduce((n, c) => n + c.votes, 0) || 1;
  const top = cands.filter(c => c.party === 'ind').sort((a, b) => b.votes - a.votes)[0];
  const sums = new Map();
  for (const c of cands) {
    const party = c.party === 'ind' && c !== top ? 'oth' : c.party;
    sums.set(party, (sums.get(party) ?? 0) + c.votes);
  }
  const results = [...sums].map(([party, votes]) => ({ party, votes, pct: Math.round((votes / total) * 1000) / 10 })).sort((a, b) => b.votes - a.votes);
  return { winner: cands.find(c => c.winner)?.party ?? null, votes: total, results: results.map(({ party, pct, votes }) => ({ party, pct, votes })) };
}

const UK_PARTY = {
  Con: 'con', Lab: 'lab', LD: 'ld', DUP: 'dup', SNP: 'snp', SF: 'sf', PC: 'pc', SDLP: 'sdlp', Green: 'grn', GP: 'grn', UUP: 'uup',
  UKIP: 'ukip', APNI: 'apni', Alliance: 'apni', BNP: 'bnp', TUV: 'tuv', BRX: 'ref', Brexit: 'ref', RUK: 'ref'
};
// candidacies.csv from the UK Parliament election results service.
export function uk(text) {
  const [head, ...rows] = parseCSV(text);
  const col = name => head.indexOf(name);
  const [code, abbr, speaker, indep, votes, pos, byElection] = ['Constituency geographic code', 'Main party abbreviation',
    'Candidate is standing as Commons Speaker', 'Candidate is standing as independent', 'Candidate vote count',
    'Candidate result position', 'Election is by-election'].map(col);
  const out = new Map();
  for (const r of rows) {
    if (!r[code] || r[byElection] === 'true') continue;
    const party = r[speaker] === 'true' ? 'spk' : r[indep] === 'true' ? 'ind' : UK_PARTY[r[abbr]] ?? 'oth';
    if (!out.has(r[code])) out.set(r[code], []);
    out.get(r[code]).push({ party, votes: Number(r[votes]) || 0, winner: r[pos] === '1' });
  }
  return new Map([...out].map(([k, c]) => [k, byParty(c)]));
}

const CA_PARTY = [
  [/Liberal\/Lib/i, 'lpc'], [/Conservative\/Conservateur/i, 'cpc'], [/NDP-New Democratic/i, 'ndp'], [/Bloc Qu/i, 'bq'],
  [/Green Party/i, 'gpc'], [/People's Party/i, 'ppc'], [/Independent\/Ind|No Affiliation/i, 'ind']
];
// Elections Canada's official results, table 12: one row per candidate, with
// the majority filled in on the winner's row.
export function ca(text) {
  const out = new Map();
  for (const r of parseCSV(text).slice(1)) {
    if (!r[2]) continue;
    const party = CA_PARTY.find(([re]) => re.test(r[3]))?.[1] ?? 'oth';
    if (!out.has(r[2])) out.set(r[2], []);
    out.get(r[2]).push({ party, votes: Number(r[6]) || 0, winner: r[8].trim() !== '' });
  }
  return new Map([...out].map(([k, c]) => [k, byParty(c)]));
}
