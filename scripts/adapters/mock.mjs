// Stand-in feed for demos and countries without a wired source. Replays the
// previous election for the office with a seeded swing, counts each region up
// to `reporting`, and calls regions with the same rule real feeds use. Calls
// are labelled "Mock feed", never as a real source.

import { callRegion, callNational } from '../calls.mjs';

function seeded(str) {
  let h = 2166136261;
  for (const ch of str) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

const d3mean = xs => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-');
const r1 = n => Math.round(n * 10) / 10;

export async function fetchResults({ entry, country, reporting, now }) {
  const base = country.elections.find(e => e.id === entry.basedOn)
    ?? country.elections.find(e => e.office === entry.office);
  if (!base) throw new Error(`No previous ${entry.office} election for ${entry.country} to base the mock on`);

  const source = base.rounds ? { ...base, ...base.rounds.at(-1) } : base;
  const id = `${entry.country.toLowerCase()}-${slug(entry.office)}-${entry.date.slice(0, 4)}`;
  const fixed = seeded(id);
  const noise = seeded(`${id}-${reporting}`);
  const done = reporting >= 100;
  const by = 'Mock feed';
  const at = now.toISOString();

  const swing = Object.fromEntries(source.candidates.map(c => [c.party, 0.88 + fixed() * 0.24]));
  const pace = (source.regions ?? []).map(() => 0.55 + fixed() * 0.9);
  const up = entry.contested ? new Set(entry.contested) : null;
  const seatTotal = source.candidates.reduce((n, c) => n + (c.seats ?? 0), 0) || 1;
  const national = source.candidates.map(c => ({ party: c.party, pct: c.pct ?? ((c.seats ?? 0) / seatTotal) * 100 })).filter(x => x.pct > 0);
  const typical = Math.round(d3mean((source.regions ?? []).map(r => r.votes).filter(Boolean)) ?? 1000000);

  const regions = (source.regions ?? []).map((r, i) => {
    const isUp = up ? up.has(r.abbr) : r.contested !== false;
    if (!isUp) return { name: r.name, abbr: r.abbr, contested: false, winner: null };
    const share = done ? 1 : Math.min(1, (reporting / 100) * pace[i]);
    const basis = r.results?.length ? r.results : national.map(x => ({ party: x.party, pct: x.pct * (0.6 + fixed() * 0.8) }));
    const finals = basis.map(x => ({ ...x, pct: x.pct * (swing[x.party] ?? 1) }));
    const sum = finals.reduce((n, x) => n + x.pct, 0) || 1;
    const expected = r.votes ?? typical;
    const results = finals.map(x => {
      const wobble = 1 + (noise() - 0.5) * 0.3 * (1 - share);
      return { party: x.party, votes: Math.round(((expected * x.pct) / sum) * share * wobble), seats: x.seats };
    });
    const votes = results.reduce((n, x) => n + x.votes, 0);
    results.forEach(x => { x.pct = votes ? r1((x.votes / votes) * 100) : 0; });
    const region = {
      name: r.name,
      abbr: r.abbr,
      ...(up || r.contested ? { contested: true } : {}),
      ...(r.seats ? { seats: r.seats } : {}),
      votes,
      expectedVotes: expected,
      counted: r1(share * 100),
      turnout: r.turnout,
      results
    };
    const called = callRegion(region, { declared: share >= 1, by, at });
    // Seats only count once a region is called; presidential states go whole.
    called.results.forEach(x => {
      if (!called.winner) delete x.seats;
      else if (base.kind === 'presidential' && r.seats) x.seats = x.party === called.winner ? r.seats : undefined;
    });
    return called;
  });

  // District chambers count district by district; a state is called once all
  // of its districts are, for whoever won most of them.
  const dpace = (source.districts ?? []).map(() => 0.55 + fixed() * 0.9);
  const districts = source.districts?.map((d, i) => {
    const share = done ? 1 : Math.min(1, (reporting / 100) * dpace[i]);
    const expected = d.votes ?? 100000;
    const sumPct = (d.results ?? []).reduce((n, x) => n + x.pct * (swing[x.party] ?? 1), 0) || 1;
    const results = (d.results ?? []).map(x => {
      const wobble = 1 + (noise() - 0.5) * 0.4 * (1 - share);
      return { party: x.party, votes: Math.round(((expected * x.pct * (swing[x.party] ?? 1)) / sumPct) * share * wobble) };
    });
    const votes = results.reduce((n, x) => n + x.votes, 0);
    results.forEach(x => { x.pct = votes ? r1((x.votes / votes) * 100) : 0; });
    return callRegion({ abbr: d.abbr, name: d.name, region: d.region, votes, expectedVotes: expected, counted: r1(share * 100), turnout: d.turnout, results }, { declared: share >= 1, by, at });
  });
  if (districts) {
    for (let i = 0; i < regions.length; i++) {
      const mine = districts.filter(d => d.region === regions[i].abbr);
      if (!mine.length) continue;
      const won = {};
      const ahead = {};
      for (const d of mine) {
        if (d.winner) won[d.winner] = (won[d.winner] ?? 0) + 1;
        const p = d.winner ?? d.leader;
        if (p) ahead[p] = (ahead[p] ?? 0) + 1;
      }
      const top = Object.entries(won).sort((a, b) => b[1] - a[1])[0]?.[0];
      const lead = Object.entries(ahead).sort((a, b) => b[1] - a[1])[0]?.[0];
      const all = mine.every(d => d.winner);
      regions[i] = {
        ...regions[i],
        seats: mine.length,
        winner: all ? top : null,
        leader: all ? undefined : lead,
        call: all ? { by, at } : undefined,
        results: (regions[i].results ?? []).map(x => ({ ...x, seats: won[x.party] ?? 0 }))
      };
    }
  }

  const holdovers = entry.holdovers ?? {};
  const regionVotes = {};
  const regionSeats = {};
  for (const r of regions) {
    for (const x of r.results ?? []) {
      regionVotes[x.party] = (regionVotes[x.party] ?? 0) + x.votes;
      if (x.seats) regionSeats[x.party] = (regionSeats[x.party] ?? 0) + x.seats;
    }
    // Single-seat contests (a Senate seat, a governorship) count one seat per call.
    if (entry.holdovers && r.winner && !r.results?.some(x => x.seats)) regionSeats[r.winner] = (regionSeats[r.winner] ?? 0) + (r.seats ?? 1);
  }
  const hasRegionSeats = regions.some(r => r.seats) || Boolean(entry.holdovers);
  const contested = regions.filter(r => r.contested !== false).length;
  const calledShare = contested ? regions.filter(r => r.winner).length / contested : reporting / 100;

  const candidates = source.candidates.map(c => {
    const votes = c.votes == null ? null : regionVotes[c.party] ?? Math.round(c.votes * (reporting / 100));
    let seats = null;
    if (c.seats != null) {
      seats = hasRegionSeats ? regionSeats[c.party] ?? 0 : Math.round(c.seats * calledShare);
      seats += holdovers[c.party] ?? 0;
    }
    return { name: c.name, party: c.party, votes, pct: null, seats, winner: false };
  });
  const total = candidates.reduce((n, c) => n + (c.votes ?? 0), 0);
  candidates.forEach(c => { if (c.votes != null && total) c.pct = r1((c.votes / total) * 100); });

  const { rounds, history, source: _, call: __, ...rest } = base;
  const election = {
    ...rest,
    id,
    office: entry.office,
    kind: entry.kind ?? base.kind,
    date: entry.date,
    note: entry.note,
    status: done ? 'final' : 'live',
    reporting,
    turnout: done ? base.turnout : undefined,
    ...(up && base.totalSeats ? { system: `${base.totalSeats} seats · ${up.size} contested` } : {}),
    candidates,
    regions,
    ...(districts ? { districts } : {})
  };
  const expectedVotes = source.candidates.reduce((n, c) => n + (c.votes ?? 0), 0) || null;
  election.call = callNational(election, { by, at, expectedVotes, threshold: base.rounds ? 0.5 : null });
  candidates.forEach(c => { c.winner = election.call.status === 'called' && c.party === election.call.winner; });
  election.source = { name: 'Mock feed', short: 'Mock' };
  return election;
}
