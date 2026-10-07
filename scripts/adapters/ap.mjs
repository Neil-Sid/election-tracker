// Not connected: the tracker does not use any API for calls for now. Kept so
// the AP feed can be switched back on later in adapters/index.mjs.
//
// The Associated Press Elections API (v3). Results and race calls are AP's,
// used as published: a state is called only when a candidate has winner "X".
// Needs a licensed key in AP_API_KEY. Set AP_TEST=1 to request AP's test
// results (only populated during AP's scheduled test windows).
//
// Docs: https://developer.ap.org/ap-elections-api/

const BASE = 'https://api.ap.org/v3/elections';
const OFFICE = { President: 'P', Senate: 'S', 'House of Representatives': 'H', Governors: 'G' };
const PARTY = { Dem: 'dem', GOP: 'gop', Ind: 'ind' };
const DONE = new Set(['End of AP Tabulation', 'Gathering Certified Results', 'Vote Certified']);

const r1 = n => Math.round(n * 10) / 10;
const partyOf = c => PARTY[c.party] ?? 'oth';

async function getRaces(entry) {
  const key = process.env.AP_API_KEY;
  if (!key) throw new Error('AP_API_KEY is not set');
  const params = new URLSearchParams({ officeID: OFFICE[entry.office], level: 'state', format: 'json' });
  if (process.env.AP_TEST) params.set('resultsType', 't');
  const res = await fetch(`${BASE}/${entry.date}?${params}`, {
    headers: { 'x-api-key': key, 'Accept-Encoding': 'gzip', Accept: 'application/json' }
  });
  if (!res.ok) throw new Error(`AP Elections API ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  if (!OFFICE[entry.office]) throw new Error(`No AP office code for ${entry.office}`);
  return data.races ?? [];
}

function raceSummary(race) {
  const unit = race.reportingUnits?.find(u => u.level === 'state') ?? race.reportingUnits?.[0];
  const cands = [...(unit?.candidates ?? [])].sort((a, b) => (b.voteCount ?? 0) - (a.voteCount ?? 0));
  const total = cands.reduce((n, c) => n + (c.voteCount ?? 0), 0);
  const called = cands.find(c => c.winner === 'X');
  return { race, unit, cands, total, called, done: DONE.has(race.tabulationStatus) };
}

export async function fetchResults({ entry, country, now }) {
  const races = await getRaces(entry);
  const base = country.elections.find(e => e.id === entry.basedOn) ?? {};
  const names = new Map((base.regions ?? []).map(r => [r.abbr, r.name]));
  const byState = new Map();
  for (const race of races) {
    const s = raceSummary(race);
    const st = s.unit?.statePostal;
    if (!st || st === 'US') continue;
    if (!byState.has(st)) byState.set(st, []);
    byState.get(st).push(s);
  }

  const seatTally = {};
  const voteTally = {};
  const candNames = {};
  const regions = [...byState].map(([abbr, list]) => {
    const parties = {};
    for (const s of list) {
      for (const c of s.cands) {
        const p = partyOf(c);
        parties[p] = (parties[p] ?? 0) + (c.voteCount ?? 0);
        voteTally[p] = (voteTally[p] ?? 0) + (c.voteCount ?? 0);
        if (entry.office === 'President') candNames[p] ??= [c.first, c.last].filter(Boolean).join(' ');
      }
    }
    const votes = Object.values(parties).reduce((a, b) => a + b, 0);
    const results = Object.entries(parties)
      .map(([party, v]) => ({ party, votes: v, pct: votes ? r1((v / votes) * 100) : 0 }))
      .sort((a, b) => b.votes - a.votes)
      .slice(0, 5);

    const seatsHere = entry.office === 'President' ? list[0].unit?.electTotal ?? null : list.length;
    const wins = {};
    for (const s of list) {
      if (!s.called) continue;
      const p = partyOf(s.called);
      wins[p] = (wins[p] ?? 0) + (entry.office === 'President' ? s.unit?.electTotal ?? 0 : 1);
    }
    for (const [p, n] of Object.entries(wins)) seatTally[p] = (seatTally[p] ?? 0) + n;
    results.forEach(x => { if (wins[x.party]) x.seats = wins[x.party]; });

    const allCalled = list.every(s => s.called);
    const top = Object.entries(wins).sort((a, b) => b[1] - a[1])[0];
    const firstCall = list.map(s => s.called?.winnerDateTime).filter(Boolean).sort()[0];
    return {
      name: names.get(abbr) ?? list[0].unit?.stateName ?? abbr,
      abbr,
      contested: true,
      seats: seatsHere ?? undefined,
      votes,
      counted: r1(Math.min(...list.map(s => s.unit?.eevp ?? s.unit?.precinctsReportingPct ?? 0))),
      results,
      winner: allCalled && top ? top[0] : null,
      leader: allCalled ? undefined : results[0]?.party,
      margin: results[1] ? r1(results[0].pct - results[1].pct) : results[0]?.pct,
      call: allCalled ? { by: 'AP', at: firstCall } : undefined
    };
  });

  // States with no race this cycle keep their place on the map as "no race".
  for (const r of base.regions ?? []) {
    if (!byState.has(r.abbr) && !r.abbr.includes('-')) regions.push({ name: r.name, abbr: r.abbr, contested: false, winner: null });
  }

  const holdovers = entry.holdovers ?? {};
  const keys = new Set([...Object.keys(voteTally), ...Object.keys(holdovers)]);
  const allVotes = Object.values(voteTally).reduce((a, b) => a + b, 0);
  const candidates = [...keys].map(party => ({
    name: candNames[party] ?? country.parties[party]?.name ?? party,
    party,
    votes: voteTally[party] ?? 0,
    pct: allVotes ? r1(((voteTally[party] ?? 0) / allVotes) * 100) : 0,
    seats: (holdovers[party] ?? 0) + (seatTally[party] ?? 0)
  })).sort((a, b) => b.seats - a.seats || b.votes - a.votes);

  const totalSeats = base.totalSeats;
  const majority = base.majority;
  const leaderSeats = candidates[0]?.seats ?? 0;
  const callTimes = regions.map(r => r.call?.at).filter(Boolean).sort();
  const call = majority && leaderSeats >= majority
    ? { status: 'called', winner: candidates[0].party, by: 'AP', at: callTimes.at(-1) }
    : { status: 'counting' };
  candidates.forEach(c => { c.winner = call.status === 'called' && c.party === call.winner; });

  // House races are districts; keys match data/districts/US.topo.json
  // ("CA-12", "AK-AL" for at-large seats).
  const districts = entry.office === 'House of Representatives' ? [...byState].flatMap(([st, list]) => list.map(sm => {
    const seat = list.length === 1 ? 'AL' : String(Number(sm.race.seatNum ?? sm.race.seatName?.match(/d+/)?.[0] ?? 0));
    const results = sm.cands.slice(0, 4).map(c => ({ party: partyOf(c), name: [c.first, c.last].filter(Boolean).join(' '), votes: c.voteCount ?? 0, pct: sm.total ? r1(((c.voteCount ?? 0) / sm.total) * 100) : 0 }));
    return {
      abbr: `${st}-${seat}`,
      name: `${names.get(st) ?? st} ${seat === 'AL' ? 'at-large' : seat}`,
      region: st,
      votes: sm.total,
      counted: r1(sm.unit?.eevp ?? 0),
      results,
      winner: sm.called ? partyOf(sm.called) : null,
      leader: sm.called ? undefined : results[0]?.party,
      margin: results[1] ? r1(results[0].pct - results[1].pct) : results[0]?.pct,
      call: sm.called ? { by: 'AP', at: sm.called.winnerDateTime } : undefined
    };
  })) : undefined;

  const summaries = [...byState.values()].flat();
  const done = summaries.length > 0 && summaries.every(s => s.done && s.called);
  const counted = summaries.length ? summaries.reduce((n, s) => n + (s.unit?.eevp ?? 0), 0) / summaries.length : 0;

  const { rounds, history, ...rest } = base;
  return {
    ...rest,
    id: `us-${entry.office.toLowerCase().replace(/[^a-z]+/g, '-')}-${entry.date.slice(0, 4)}`,
    office: entry.office,
    kind: entry.kind,
    date: entry.date,
    status: done ? 'final' : 'live',
    reporting: Math.round(counted),
    totalSeats,
    majority,
    candidates,
    regions,
    ...(districts ? { districts } : {}),
    call,
    source: { name: 'The Associated Press', short: 'AP', url: 'https://www.ap.org/elections/' },
    updatedAt: now.toISOString()
  };
}
