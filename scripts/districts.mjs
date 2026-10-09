// Sample district results for single-member chambers. Seats are first split
// across states/regions so that every party's national total is kept exactly,
// then dealt out to that region's districts. The region results are updated to
// match, so the map, the state tally and the national table agree.

const r1 = n => Math.round(n * 10) / 10;
const sum = xs => xs.reduce((a, b) => a + b, 0);

// Integer table with fixed row and column totals, close to the weights
// (iterative proportional fitting, then largest remainders).
export function fitSeats(rowTotals, colTotals, weights) {
  let m = weights.map(row => row.map(w => (w > 0 ? w + 1e-6 : 0)));
  for (let it = 0; it < 300; it++) {
    m = m.map((row, r) => {
      const s = sum(row) || 1;
      return row.map(v => (v * rowTotals[r]) / s);
    });
    const cols = colTotals.map((_, c) => sum(m.map(row => row[c])));
    m = m.map(row => row.map((v, c) => v * (colTotals[c] / (cols[c] || 1))));
  }
  const out = m.map(row => row.map(Math.floor));
  const rowLeft = rowTotals.map((t, r) => t - sum(out[r]));
  const colLeft = colTotals.map((t, c) => t - sum(out.map(row => row[c])));
  const cells = m.flatMap((row, r) => row.map((v, c) => [v - Math.floor(v), r, c])).sort((a, b) => b[0] - a[0]);
  for (const [, r, c] of cells) {
    if (rowLeft[r] > 0 && colLeft[c] > 0 && weights[r][c] > 0) {
      out[r][c]++;
      rowLeft[r]--;
      colLeft[c]--;
    }
  }
  // Anything still unplaced goes to the party with seats to spare that stands there.
  rowLeft.forEach((left, r) => {
    for (; left > 0; left--) {
      const open = colLeft.map((n, c) => (weights[r][c] > 0 ? n : -Infinity));
      const c = open.indexOf(Math.max(...open));
      out[r][c]++;
      colLeft[c]--;
    }
  });
  // That can overfill one party; move seats from it to a party still short,
  // in a row where both stand.
  colLeft.forEach((_, c) => {
    while (colLeft[c] > 0) {
      const r = out.findIndex((row, r) => weights[r][c] > 0 && row.some((n, d) => n > 0 && colLeft[d] < 0));
      if (r < 0) break;
      const d = out[r].findIndex((n, d) => n > 0 && colLeft[d] < 0);
      out[r][d]--;
      out[r][c]++;
      colLeft[d]++;
      colLeft[c]--;
    }
  });
  return out;
}

// A party given seats in a region where it had no vote share gets about the
// share those seats take, and the region's shares are scaled back to 100%.
export function addSeatShares(r, seats) {
  const added = Object.entries(seats).filter(([p, n]) => n > 0 && !r.results.some(x => x.party === p));
  if (!added.length) return;
  for (const [party, n] of added) r.results.push({ party, pct: (n / r.seats) * 90, seats: n });
  const total = sum(r.results.map(x => x.pct));
  r.results = r.results
    .map(x => ({ ...x, pct: r1((x.pct / total) * 100), ...(r.votes ? { votes: Math.round((r.votes * x.pct) / total) } : {}) }))
    .sort((a, b) => b.pct - a.pct);
  r.margin = r1(r.results[0].pct - (r.results[1]?.pct ?? 0));
}

// Real results cluster: a party's seats sit together in its strongholds. Each
// party gets a random home direction within the region and takes the
// districts that lie furthest that way, smaller parties first; the largest
// party takes what is left. A little noise keeps the edges ragged.
function placeSeats(shapes, counts, rand) {
  const pts = shapes.map(s => s.c ?? [0, 0]);
  const mean = i => pts.reduce((n, p) => n + p[i], 0) / pts.length;
  const sd = i => Math.sqrt(pts.reduce((n, p) => n + (p[i] - mean(i)) ** 2, 0) / pts.length) || 1;
  const [mx, my, sx, sy] = [mean(0), mean(1), sd(0), sd(1)];
  // Clamped so one far-flung district (an outback seat) can't dominate.
  const clamp = v => Math.max(-1.6, Math.min(1.6, v));
  const z = pts.map(([x, y]) => [clamp((x - mx) / sx), clamp((y - my) / sy)]);
  // Small parties tend to win compact, urban seats rather than vast rural ones.
  const logs = shapes.map(s => Math.log((s.area ?? 0) + 1e-6));
  const lm = logs.reduce((a, b) => a + b, 0) / logs.length;
  const ls = Math.sqrt(logs.reduce((n, v) => n + (v - lm) ** 2, 0) / logs.length) || 1;
  const small = logs.map(v => Math.max(-2, Math.min(2, -(v - lm) / ls)));
  const seatsHere = counts.reduce((n, [, c]) => n + c, 0);
  const order = counts.filter(([, n]) => n > 0).sort((a, b) => a[1] - b[1]);
  const out = new Array(shapes.length).fill(null);
  for (const [party, n] of order.slice(0, -1)) {
    const a = rand() * Math.PI * 2;
    const ranked = z
      .map((p, i) => [p[0] * Math.cos(a) + p[1] * Math.sin(a) + (n < seatsHere * 0.15 ? small[i] * 1.5 : 0) + (rand() - 0.5) * 0.45, i])
      .filter(([, i]) => out[i] === null)
      .sort((p, q) => q[0] - p[0]);
    ranked.slice(0, n).forEach(([, i]) => { out[i] = party; });
  }
  const largest = order.at(-1)?.[0] ?? 'oth';
  return out.map(p => p ?? largest);
}

// shapes: [{ key, name, region, c }] from data/districts/<CODE>.topo.json
// stands(party, region) says whether a party contests a region at all.
// splits, when known, are each region's real seats by party: { CA: { dem: 43, gop: 9 } }.
export function buildDistricts(el, shapes, rand, stands = () => true, splits = null) {
  const regions = el.regions ?? [];
  const byRegion = new Map(regions.map(r => [r.abbr, []]));
  for (const s of shapes) byRegion.get(s.region)?.push(s);
  const usable = regions.filter(r => byRegion.get(r.abbr)?.length);
  if (!usable.length) return null;

  const winners = el.candidates.filter(c => (c.seats ?? 0) > 0);
  const count = sum(usable.map(r => byRegion.get(r.abbr).length));
  const national = el.candidates.map(c => c.pct ?? 0);
  const fullChamber = count === el.totalSeats;

  // Party totals: the national seats when every seat is a district, the
  // national seats scaled down when a few aren't drawn (France's overseas
  // seats), or a first-past-the-post share of the vote when districts are
  // only part of the chamber (Germany, Japan).
  const share = count / (el.totalSeats || count);
  const largest = t => {
    const out = t.map(Math.floor);
    let left = count - sum(out);
    t.map((x, i) => [x - Math.floor(x), i]).sort((a, b) => b[0] - a[0]).forEach(([, i]) => { if (left-- > 0) out[i]++; });
    return out;
  };
  let targets;
  if (fullChamber) {
    targets = winners.map(c => c.seats);
  } else if (share > 0.8) {
    targets = largest(winners.map(c => c.seats * share));
  } else {
    const w = winners.map(c => Math.pow(c.pct ?? 1, 3));
    targets = largest(w.map(x => (x / sum(w)) * count));
  }

  const weights = usable.map(r => winners.map(c => {
    if (!stands(c.party, r.abbr)) return 0;
    // A region with a single district goes to the region's winner.
    if (byRegion.get(r.abbr).length === 1 && winners.some(w => w.party === r.winner)) return c.party === r.winner ? 1 : 0;
    const pct = r.results?.find(x => x.party === c.party)?.pct ?? (national[el.candidates.indexOf(c)] ?? 1) * 0.3;
    return Math.pow(Math.max(pct, 0.5), 2);
  }));
  const rows = usable.map(r => byRegion.get(r.abbr).length);
  const table = splits ? usable.map(r => winners.map(c => splits[r.abbr]?.[c.party] ?? 0)) : fitSeats(rows, targets, weights);
  if (splits && (table.some((row, i) => sum(row) !== rows[i]) || targets.some((t, j) => sum(table.map(row => row[j])) !== t))) {
    throw new Error(`${el.id}: seat splits don't add up to the districts and national seats`);
  }

  const districts = [];
  usable.forEach((r, i) => {
    const contenders = (r.results ?? []).map(x => x.party);
    const shapesHere = [...byRegion.get(r.abbr)].sort((a, b) => a.key.localeCompare(b.key, 'en', { numeric: true }));
    const slots = placeSeats(shapesHere, winners.map((c, j) => [c.party, table[i][j]]), rand);
    const regionVotes = r.votes ?? null;

    shapesHere.forEach((s, k) => {
      const winner = slots[k];
      const rivals = contenders.filter(p => p !== winner && stands(p, r.abbr)).slice(0, 3);
      if (!rivals.length) rivals.push('oth');
      const margin = r1(0.4 + Math.pow(rand(), 1.6) * 38);
      // The top two take 60-96% (more in a landslide), leaving a share for the other rivals.
      const topTwo = 60 + margin / 2 + rand() * (36 - margin / 2);
      const top = (topTwo + margin) / 2;
      const second = top - margin;
      let rest = 100 - topTwo;
      const results = [{ party: winner, pct: r1(top) }, { party: rivals[0] ?? 'oth', pct: r1(second) }];
      for (const p of rivals.slice(1)) {
        const share = r1(rest * (0.35 + rand() * 0.4));
        results.push({ party: p, pct: share });
        rest -= share;
      }
      const votes = regionVotes ? Math.round((regionVotes / shapesHere.length) * (0.8 + rand() * 0.4)) : null;
      if (votes) results.forEach(x => { x.votes = Math.round((votes * x.pct) / 100); });
      districts.push({
        abbr: s.key,
        name: s.name,
        region: r.abbr,
        winner,
        margin: r1(results[0].pct - results[1].pct),
        turnout: r.turnout != null ? r1(Math.max(30, Math.min(95, r.turnout + (rand() - 0.5) * 12))) : undefined,
        ...(votes ? { votes } : {}),
        results
      });
    });

    const seats = Object.fromEntries(winners.map((c, j) => [c.party, table[i][j]]));
    if (share > 0.8) regionSeats(r, seats, shapesHere.length);
  });
  return districts;
}

// Winner's share minus the runner-up's.
export function marginOf(winner, results) {
  if (!winner) return undefined;
  const won = results.find(x => x.party === winner)?.pct ?? 0;
  return r1(won - Math.max(0, ...results.filter(x => x.party !== winner).map(x => x.pct)));
}

// Real results by district (scripts/history/districts/<id>.json) for a chamber
// that is all districts. Regions report the seats as with sample districts.
export function fromSource(el, rows) {
  const districts = rows.map(({ results, votes, ...d }) => ({
    ...d,
    margin: marginOf(d.winner, results),
    ...(votes ? { votes } : {}),
    results: results.map(({ party, pct }) => ({ party, pct }))
  }));
  for (const r of el.regions ?? []) {
    const mine = districts.filter(d => d.region === r.abbr);
    const seats = {};
    for (const d of mine) if (d.winner) seats[d.winner] = (seats[d.winner] ?? 0) + 1;
    if (Object.keys(seats).length) regionSeats(r, seats, mine.length);
  }
  return districts;
}

// A region reports the seats its districts produced. A tie keeps its winner.
function regionSeats(r, seats, n) {
  r.seats = n;
  r.results = (r.results ?? []).map(x => ({ ...x, seats: seats[x.party] ?? 0 }));
  addSeatShares(r, seats);
  r.winner = Object.entries(seats).sort((a, b) => b[1] - a[1] || (b[0] === r.winner) - (a[0] === r.winner))[0][0];
}
