// Not connected: the tracker does not use any API for calls for now. Kept so
// the TSE feed can be switched back on later in adapters/index.mjs.
//
// Brazil's Superior Electoral Court (TSE) public results JSON. TSE is the
// official count and marks elected candidates itself (e = "s", st = "Eleito",
// "Eleito por QP", "2º turno"), so calls come straight from TSE. Between
// declarations a state is called only when the lead beats the votes left.
//
// Schedule entries carry { tse: { election, cargo } }: election codes are
// listed in https://resultados.tse.jus.br/oficial/comum/config/ele-c.json and
// cargo is 1 President, 3 Governor, 5 Senator, 6 Federal Deputy.

import { callRegion } from '../calls.mjs';

const BASE = 'https://resultados.tse.jus.br/oficial';
const PALETTE = ['#6E7B8B', '#8C6D5A', '#5F8A6E', '#7A6A9A', '#9A7A3E', '#4F7F99', '#99605F', '#6B8E23'];
const num = s => (s == null || s === '' ? 0 : Number(String(s).replace(',', '.')));
const r1 = n => Math.round(n * 10) / 10;
const title = s => s.toLowerCase().replace(/(^|[\s'-])(\p{L})/gu, (m, a, b) => a + b.toUpperCase());

async function get(url) {
  const res = await fetch(url, { headers: { 'Accept-Encoding': 'gzip' } });
  if (!res.ok) throw new Error(`TSE ${res.status} for ${url}`);
  return res.json();
}

async function pool(items, fn, size = 6) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: size }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  }));
  return out;
}

const candidatesOf = doc => doc.carg[0].agr.flatMap(a => a.par.flatMap(p => p.cand.map(c => ({ ...c, sg: p.sg, partyVotes: num(p.tvtn) }))));
const elected = c => c.e === 's' && /^Eleito/.test(c.st);
// TSE stamps each file with its totalisation time in Brasília time.
const stamp = doc => {
  const [d, m, y] = (doc.dg ?? '').split('/');
  return y ? `${y}-${m}-${d}T${doc.hg}-03:00` : undefined;
};

export async function fetchResults({ entry, country, now }) {
  const { election, cargo } = entry.tse;
  const year = entry.date.slice(0, 4);
  const url = uf => `${BASE}/ele${year}/${election}/dados/${uf}/${uf}-c${String(cargo).padStart(4, '0')}-e${String(election).padStart(6, '0')}-u.json`;
  const at = now.toISOString();
  const by = 'TSE';

  // Party keys follow the country file; new parties are added with a neutral colour.
  const parties = {};
  const keyFor = sg => {
    const known = Object.entries(country.parties).find(([k, p]) => k === sg.toLowerCase() || p.name.toUpperCase() === sg);
    if (known) return known[0];
    const key = sg.toLowerCase().normalize('NFD').replace(/[^a-z0-9]/g, '');
    if (!country.parties[key] && !parties[key]) parties[key] = { name: sg, color: PALETTE[Object.keys(parties).length % PALETTE.length] };
    return key;
  };

  const ref = country.elections.find(e => e.id === entry.basedOn);
  const catalog = (ref?.rounds?.at(-1).regions ?? ref?.regions ?? []).filter(r => !r.abbr.includes('-'));
  const docs = await pool(catalog, r => get(url(r.abbr.toLowerCase())));

  const seatTally = {};
  const voteTally = {};
  let sections = 0;
  let sectionsDone = 0;
  let voters = 0;
  let electorate = 0;

  const regions = catalog.map((r, i) => {
    const doc = docs[i];
    const cands = candidatesOf(doc);
    const counted = num(doc.s.pstn);
    sections += num(doc.s.ts);
    sectionsDone += num(doc.s.st);
    voters += num(doc.e.c);
    electorate += num(doc.e.te);
    const valid = num(doc.v.vv);
    const byParty = {};
    const seats = {};
    for (const c of cands) {
      const p = keyFor(c.sg);
      byParty[p] = cargo === 6 ? c.partyVotes : (byParty[p] ?? 0) + num(c.vap);
      if (elected(c)) seats[p] = (seats[p] ?? 0) + 1;
    }
    for (const [p, v] of Object.entries(byParty)) voteTally[p] = (voteTally[p] ?? 0) + v;
    for (const [p, n] of Object.entries(seats)) seatTally[p] = (seatTally[p] ?? 0) + n;

    const results = Object.entries(byParty)
      .map(([party, votes]) => ({ party, votes, pct: valid ? r1((votes / valid) * 100) : 0, ...(seats[party] ? { seats: seats[party] } : {}) }))
      .sort((a, b) => (b.seats ?? 0) - (a.seats ?? 0) || b.votes - a.votes)
      .slice(0, 6);
    const totalSeats = Object.values(seats).reduce((a, b) => a + b, 0);
    const region = {
      name: r.name,
      abbr: r.abbr,
      votes: valid,
      expectedVotes: counted > 0 ? Math.round(valid / (counted / 100)) : null,
      counted: r1(counted),
      turnout: r1(num(doc.e.pcn)),
      ...(totalSeats ? { seats: totalSeats } : {}),
      results
    };
    // Legislative seats are decided by TSE's quotient rules, so the state goes
    // to whoever TSE elected most of; presidential states follow the vote.
    if (cargo !== 1 && totalSeats) {
      return { ...region, winner: results[0].party, margin: r1(results[0].pct - (results[1]?.pct ?? 0)), call: { by, at: stamp(doc) } };
    }
    return callRegion(region, { declared: counted >= 100, by, at: stamp(doc) });
  });

  const done = sections > 0 && sectionsDone >= sections;
  const reporting = sections ? Math.round((sectionsDone / sections) * 100) : 0;

  let candidates;
  let call;
  if (cargo === 1) {
    const nat = await get(url('br'));
    const list = candidatesOf(nat).sort((a, b) => num(b.vap) - num(a.vap));
    candidates = list.slice(0, 6).map(c => ({
      name: title(c.nmu),
      party: keyFor(c.sg),
      votes: num(c.vap),
      pct: r1(num(c.pvapn)),
      winner: c.st === 'Eleito',
      ...(c.st === '2º turno' ? { advanced: true } : {})
    }));
    const won = candidates.find(c => c.winner);
    const natAt = stamp(nat);
    const runoff = candidates.filter(c => c.advanced);
    call = won ? { status: 'called', winner: won.party, by, at: natAt }
      : runoff.length === 2 ? { status: 'runoff', parties: runoff.map(c => c.party), by, at: natAt }
      : { status: 'counting' };
  } else {
    const allVotes = Object.values(voteTally).reduce((a, b) => a + b, 0);
    candidates = Object.entries(voteTally)
      .map(([party, votes]) => ({
        name: (country.parties[party] ?? parties[party]).name,
        party,
        votes,
        pct: allVotes ? r1((votes / allVotes) * 100) : 0,
        seats: seatTally[party] ?? 0
      }))
      .filter(c => c.seats > 0 || c.pct >= 1)
      .sort((a, b) => b.seats - a.seats || b.votes - a.votes);
    const total = candidates.reduce((n, c) => n + c.seats, 0);
    const top = candidates[0];
    call = done ? { status: total && top.seats > total / 2 ? 'called' : 'hung', winner: top?.party, by, at } : { status: 'counting' };
    if (done && top) top.winner = true;
  }

  const id = `br-${entry.office.toLowerCase().replace(/[^a-z]+/g, '-')}-${year}`;
  const totalSeats = cargo === 1 ? undefined : candidates.reduce((n, c) => n + (c.seats ?? 0), 0);
  const view = { label: entry.note ?? 'Result', date: entry.date, candidates, regions };
  const prior = country.elections.find(e => e.id === id);
  const rounds = cargo === 1 ? [...(prior?.rounds ?? []).filter(r => r.date !== entry.date), view] : undefined;

  return {
    id,
    office: entry.office,
    kind: entry.kind,
    date: entry.date,
    ...(entry.note && cargo !== 1 ? { note: entry.note } : {}),
    status: done ? 'final' : 'live',
    reporting,
    turnout: electorate ? r1((voters / electorate) * 100) : undefined,
    system: cargo === 1 ? 'Two-round popular vote' : cargo === 5 ? `${totalSeats} of 81 seats contested` : '513 seats, open-list proportional by state',
    ...(totalSeats ? { totalSeats, majority: Math.floor(totalSeats / 2) + 1, seatLabel: cargo === 5 ? 'Seats won' : 'Seats' } : {}),
    candidates,
    regions,
    ...(rounds ? { rounds } : {}),
    call,
    parties,
    source: { name: 'Superior Electoral Court (TSE)', short: 'TSE', url: 'https://resultados.tse.jus.br/' },
    updatedAt: at
  };
}
