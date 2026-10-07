// Race calls for sources that publish counts but not calls. The rule is
// deliberately conservative: a race is called only when the electoral
// authority declares it, or when the leader's margin is larger than every vote
// still to be counted. No projections, no exit polls.
//
// AP results skip this: AP publishes its own calls and those are used as-is.

const r1 = n => Math.round(n * 10) / 10;

export function byVotes(results) {
  return [...results].sort((a, b) => (b.votes ?? 0) - (a.votes ?? 0));
}

// region: { results: [{ party, votes, pct, seats }], votes, expectedVotes }
export function callRegion(region, { declared = false, by, at }) {
  const results = byVotes(region.results ?? []);
  const [a, b] = results;
  if (!a || !(a.votes > 0)) return { ...region, results, winner: null, leader: null };
  const counted = region.votes ?? results.reduce((n, x) => n + (x.votes ?? 0), 0);
  const left = region.expectedVotes != null ? Math.max(0, region.expectedVotes - counted) : null;
  const lead = a.votes - (b?.votes ?? 0);
  const margin = r1((a.pct ?? 0) - (b?.pct ?? 0));
  if (declared || (left != null && lead > left)) {
    return { ...region, results, winner: a.party, leader: undefined, margin, call: { by, at } };
  }
  return { ...region, results, winner: null, leader: a.party, margin, call: undefined };
}

// Presidential: a candidate is called once their share of the expected total
// can't be overtaken (or, with a run-off rule, once they clear the threshold
// on every vote that could still come in). Legislatures: a party is called
// for a majority once its called seats reach it.
export function callNational(election, { by, at, expectedVotes, threshold = null }) {
  const cands = byVotes(election.candidates);
  const [a, b] = cands;
  if (election.kind === 'presidential' && !election.totalSeats) {
    const counted = cands.reduce((n, c) => n + (c.votes ?? 0), 0);
    const left = expectedVotes != null ? Math.max(0, expectedVotes - counted) : null;
    if (!a || left == null) return { status: 'counting' };
    if (threshold) {
      const total = counted + left;
      if (a.votes > total * threshold) return { status: 'called', winner: a.party, by, at };
      if (left === 0) return { status: 'runoff', parties: [a.party, b?.party].filter(Boolean), by, at };
      return { status: 'counting' };
    }
    return a.votes - (b?.votes ?? 0) > left ? { status: 'called', winner: a.party, by, at } : { status: 'counting' };
  }

  const majority = election.majority;
  const top = [...election.candidates].sort((x, y) => (y.seats ?? 0) - (x.seats ?? 0))[0];
  if (majority && top?.seats >= majority) return { status: 'called', winner: top.party, by, at };
  const regions = election.regions ?? [];
  const open = regions.some(r => r.contested !== false && !r.winner);
  if (!open && regions.length) return { status: 'hung', winner: top?.party, by, at };
  return { status: 'counting' };
}
