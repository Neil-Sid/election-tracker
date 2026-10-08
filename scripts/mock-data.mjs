#!/usr/bin/env node
// Fills data/countries/*.json with generated detail: a result for every
// state/region and district, sample past results where there are no real ones,
// and a short "how it works". National results, real region winners and seat
// splits are kept as given. Seeded, so re-running gives the same numbers.

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { EXTRA, NEW, NEW_INDEX, NEW_SCHEDULE, NEW_HISTORY, NEW_ABOUT, EXTRA_ABOUT } from './seeds.mjs';
import { buildDistricts, fitSeats, addSeatShares } from './districts.mjs';
import { seeded, r1, nationalBase, allocate, regionResult, REGIONAL, standsIn } from './regions.mjs';

// Chambers elected in single-member districts get a district breakdown when
// data/districts/<CODE>.topo.json exists.
const DISTRICT_ELECTIONS = {
  'us-house-2024': 'US', 'gb-commons-2024': 'GB', 'ca-house-2025': 'CA', 'au-house-2025': 'AU',
  'fr-assembly-2024': 'FR', 'de-bundestag-2025': 'DE', 'in-lok-sabha-2024': 'IN', 'jp-representatives-2026': 'JP'
};

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const countriesDir = path.join(root, 'data', 'countries');
const CODES = ['US', 'CA', 'BR', 'AR', 'GB', 'ES', 'FR', 'DE', 'AU', ...Object.keys(NEW), 'NO', 'NZ', 'RU', 'PH', 'CL', 'BO', 'CO', 'PE', 'CZ', 'SK', 'HU', 'GR', 'BE', 'RO', 'DK', 'FI', 'CH', 'UA', 'IR', 'IQ'];
const SEED_KEYS = ['winners', 'defaultWinner', 'regionSeats', 'partial'];

// Which regions were up, and who won, for races that did not have a region list.
const CONTESTS = {
  'us-senate-2024': { AZ: 'dem', CA: 'dem', CT: 'dem', DE: 'dem', FL: 'gop', HI: 'dem', IN: 'gop', ME: 'ind', MD: 'dem', MA: 'dem', MI: 'dem', MN: 'dem', MS: 'gop', MO: 'gop', MT: 'gop', NE: 'gop', NV: 'dem', NJ: 'dem', NM: 'dem', NY: 'dem', ND: 'gop', OH: 'gop', PA: 'gop', RI: 'dem', TN: 'gop', TX: 'gop', UT: 'gop', VT: 'ind', VA: 'dem', WA: 'dem', WV: 'gop', WI: 'dem', WY: 'gop' },
  'ar-senate-2025': { CABA: 'lla', CC: 'lla', ER: 'lla', NQ: 'lla', RN: 'up', SA: 'lla', SE: 'up', TF: 'lla' },
  'es-senate-2023': { AN: 'pp', CT: 'psoe', MD: 'pp', VC: 'pp', GA: 'pp', CL: 'pp', PV: 'pnv', CM: 'pp', CN: 'psoe', AR: 'pp', MC: 'pp', IB: 'pp', EX: 'pp', AS: 'psoe', NC: 'psoe', CB: 'pp', RI: 'pp', CE: 'pp' },
  'au-senate-2025': { NSW: 'alp', VIC: 'alp', QLD: 'lnp', WA: 'alp', SA: 'alp', TAS: 'alp', ACT: 'alp', NT: 'alp' },
  'fr-assembly-2024': { IDF: 'nfp', ARA: 'ens', HDF: 'rn', NAQ: 'nfp', OCC: 'rn', GES: 'rn', PAC: 'rn', PDL: 'ens', NOR: 'rn', BRE: 'ens', BFC: 'rn', CVL: 'rn', COR: 'lr' }
};

const REGION_SEATS = {
  'es-senate-2023': { AN: 32, CT: 16, MD: 4, VC: 12, GA: 16, CL: 36, PV: 12, CM: 20, CN: 11, AR: 12, MC: 4, IB: 5, EX: 8, AS: 4, NC: 4, CB: 4, RI: 4, CE: 4 },
  'au-senate-2025': { NSW: 6, VIC: 6, QLD: 6, WA: 6, SA: 6, TAS: 6, ACT: 2, NT: 2 }
};

// Real seats by party in each state, nation or community, from the by-region
// tables of the cited Wikipedia articles. Which districts each party won stays
// illustrative.
const SEAT_SPLITS = {
  'es-congress-2023': {
    AN: { pp: 25, psoe: 21, vox: 9, sumar: 6 }, AR: { pp: 7, psoe: 4, vox: 1, sumar: 1 }, AS: { pp: 3, psoe: 2, vox: 1, sumar: 1 },
    IB: { pp: 3, psoe: 3, vox: 1, sumar: 1 }, PV: { pp: 2, psoe: 5, sumar: 1, bildu: 5, pnv: 5 }, CN: { pp: 6, psoe: 6, vox: 1, sumar: 1, cc: 1 },
    CB: { pp: 2, psoe: 2, vox: 1 }, CL: { pp: 18, psoe: 12, vox: 1 }, CM: { pp: 10, psoe: 8, vox: 3 },
    CT: { pp: 6, psoe: 19, vox: 2, sumar: 7, erc: 7, junts: 7 }, CE: { pp: 2 }, EX: { pp: 4, psoe: 4, vox: 1 },
    GA: { pp: 13, psoe: 7, sumar: 2, bng: 1 }, RI: { pp: 2, psoe: 2 }, MD: { pp: 16, psoe: 10, vox: 5, sumar: 6 },
    MC: { pp: 4, psoe: 3, vox: 2, sumar: 1 }, NC: { pp: 1, psoe: 2, bildu: 1, upn: 1 }, VC: { pp: 13, psoe: 11, vox: 5, sumar: 4 }
  },
  'us-house-2024': {
    AL: { gop: 5, dem: 2 }, AK: { gop: 1 }, AZ: { gop: 6, dem: 3 }, AR: { gop: 4 }, CA: { gop: 9, dem: 43 }, CO: { gop: 4, dem: 4 },
    CT: { dem: 5 }, DE: { dem: 1 }, FL: { gop: 20, dem: 8 }, GA: { gop: 9, dem: 5 }, HI: { dem: 2 }, ID: { gop: 2 }, IL: { gop: 3, dem: 14 },
    IN: { gop: 7, dem: 2 }, IA: { gop: 4 }, KS: { gop: 3, dem: 1 }, KY: { gop: 5, dem: 1 }, LA: { gop: 4, dem: 2 }, ME: { dem: 2 },
    MD: { gop: 1, dem: 7 }, MA: { dem: 9 }, MI: { gop: 7, dem: 6 }, MN: { gop: 4, dem: 4 }, MS: { gop: 3, dem: 1 }, MO: { gop: 6, dem: 2 },
    MT: { gop: 2 }, NE: { gop: 3 }, NV: { gop: 1, dem: 3 }, NH: { dem: 2 }, NJ: { gop: 3, dem: 9 }, NM: { dem: 3 }, NY: { gop: 7, dem: 19 },
    NC: { gop: 10, dem: 4 }, ND: { gop: 1 }, OH: { gop: 10, dem: 5 }, OK: { gop: 5 }, OR: { gop: 1, dem: 5 }, PA: { gop: 10, dem: 7 },
    RI: { dem: 2 }, SC: { gop: 6, dem: 1 }, SD: { gop: 1 }, TN: { gop: 8, dem: 1 }, TX: { gop: 25, dem: 13 }, UT: { gop: 4 }, VT: { dem: 1 },
    VA: { gop: 5, dem: 6 }, WA: { gop: 2, dem: 8 }, WV: { gop: 2 }, WI: { gop: 6, dem: 2 }, WY: { gop: 1 }
  },
  // The 40 seats up in 2025; the national figures are the whole Senate after it.
  'au-senate-2025': {
    NSW: { alp: 2, lnp: 2, grn: 1, on: 1 }, VIC: { alp: 3, lnp: 2, grn: 1 }, QLD: { lnp: 2, alp: 2, grn: 1, on: 1 }, WA: { alp: 2, lnp: 2, grn: 1, on: 1 },
    SA: { alp: 3, lnp: 2, grn: 1 }, TAS: { alp: 2, lnp: 2, grn: 1, jln: 1 }, ACT: { ind: 1, alp: 1 }, NT: { alp: 1, lnp: 1 }
  },
  'au-house-2025': {
    NSW: { alp: 28, lnp: 12, ind: 6 }, VIC: { alp: 27, lnp: 9, ind: 2 }, QLD: { lnp: 16, alp: 12, grn: 1, kap: 1 }, WA: { alp: 11, lnp: 4, ind: 1 },
    SA: { alp: 7, lnp: 2, ca: 1 }, TAS: { alp: 4, ind: 1 }, ACT: { alp: 3 }, NT: { alp: 2 }
  },
  'ca-house-2025': {
    BC: { lpc: 20, cpc: 19, ndp: 3, gpc: 1 }, AB: { lpc: 2, cpc: 34, ndp: 1 }, SK: { lpc: 1, cpc: 13 }, MB: { lpc: 6, cpc: 7, ndp: 1 },
    ON: { lpc: 70, cpc: 52 }, QC: { lpc: 44, cpc: 11, bq: 22, ndp: 1 }, NB: { lpc: 6, cpc: 4 }, NS: { lpc: 10, cpc: 1 },
    PE: { lpc: 4 }, NL: { lpc: 4, cpc: 3 }, YT: { lpc: 1 }, NT: { lpc: 1 }, NU: { ndp: 1 }
  },
  'gb-commons-2024': {
    ENG: { lab: 347, con: 116, ld: 65, ref: 5, grn: 4, ind: 5, spk: 1 },
    SCT: { lab: 37, snp: 9, ld: 6, con: 5 },
    WLS: { lab: 27, pc: 4, ld: 1 },
    NI: { sf: 7, dup: 5, sdlp: 2, apni: 1, uup: 1, tuv: 1, ind: 1 }
  },
  // The four seats elected abroad aren't on the map.
  'pt-assembly-2025': {
    '01': { ad: 7, chega: 4, ps: 4, il: 1 }, '02': { ad: 1, chega: 1, ps: 1 }, '03': { ad: 8, chega: 5, ps: 5, il: 1 }, '04': { ad: 2, ps: 1 },
    '05': { ad: 2, chega: 1, ps: 1 }, '06': { ad: 4, chega: 2, ps: 3 }, '07': { ad: 1, chega: 1, ps: 1 }, '08': { ad: 3, chega: 4, ps: 2 },
    '09': { ad: 1, chega: 1, ps: 1 }, 10: { ad: 5, chega: 3, ps: 2 }, 11: { ad: 15, chega: 11, ps: 12, il: 4, livre: 3, cdu: 1, be: 1, pan: 1 },
    12: { chega: 1, ps: 1 }, 13: { ad: 15, chega: 9, ps: 11, il: 2, livre: 2, cdu: 1 }, 14: { ad: 4, chega: 3, ps: 2 },
    15: { ad: 5, chega: 6, ps: 5, il: 1, livre: 1, cdu: 1 }, 16: { ad: 3, chega: 1, ps: 1 }, 17: { ad: 3, chega: 1, ps: 1 },
    18: { ad: 4, chega: 2, ps: 2 }, 20: { ad: 3, chega: 1, ps: 1 }, 30: { ad: 3, chega: 1, ps: 1, jpp: 1 }
  }
};

const HISTORY = {
  'us-president-2024': [2020, 2016, 2012, 2008],
  'us-senate-2024': [2022, 2020, 2018, 2016],
  'us-governors-2024': [2022, 2020, 2018, 2016],
  'ca-house-2025': [2021, 2019, 2015, 2011],
  'ar-president-2023': [2019, 2015, 2011],
  'ar-senate-2025': [2023, 2021, 2019],
  'gb-commons-2024': [2019, 2017, 2015, 2010],
  'es-congress-2023': [2019, 2016, 2015, 2011],
  'es-senate-2023': [2019, 2016, 2015, 2011],
  'fr-president-2022': [2017, 2012, 2007],
  'fr-assembly-2024': [2022, 2017, 2012],
  'de-bundestag-2025': [2021, 2017, 2013, 2009],
  'au-house-2025': [2022, 2019, 2016, 2013],
  'au-senate-2025': [2022, 2019, 2016, 2013]
};

const ABOUT = {
  US: {
    system: 'Federal presidential republic',
    headOfState: 'President',
    headOfGovernment: 'President',
    legislature: 'Congress: House of Representatives (435) and Senate (100)',
    votingAge: 18, compulsory: false, registered: 186000000,
    offices: {
      President: 'Elected every four years through the Electoral College. Each state gets electors equal to its seats in Congress, and almost all award them winner-take-all. 270 of 538 wins.',
      Senate: 'Two senators per state serving six-year terms. About a third of seats are up every two years, so most states do not vote for the Senate in a given cycle.',
      Governors: 'Each state elects its own governor, mostly for four-year terms. Races are spread across the cycle, with the largest group in midterm years.'
    }
  },
  CA: {
    system: 'Federal parliamentary constitutional monarchy',
    headOfState: 'The King, represented by the Governor General',
    headOfGovernment: 'Prime Minister',
    legislature: 'Parliament: House of Commons (343) and appointed Senate',
    votingAge: 18, compulsory: false, registered: 28900000,
    offices: {
      'House of Commons': 'Each of 343 ridings elects one MP by first past the post. The leader who can hold the confidence of the House becomes Prime Minister. Elections are held at least every five years.'
    }
  },
  BR: {
    system: 'Federal presidential republic',
    headOfState: 'President',
    headOfGovernment: 'President',
    legislature: 'National Congress: Chamber of Deputies (513) and Federal Senate (81)',
    votingAge: 16, compulsory: true, registered: 156400000,
    offices: {
      President: 'Elected for four years by national popular vote. If nobody passes 50% of valid votes in the first round, the top two meet in a run-off four weeks later.',
      Senate: 'Three senators per state and the Federal District, serving eight-year terms. Elections alternate between renewing one third and two thirds of the chamber.'
    }
  },
  AR: {
    system: 'Federal presidential republic',
    headOfState: 'President',
    headOfGovernment: 'President',
    legislature: 'National Congress: Chamber of Deputies (257) and Senate (72)',
    votingAge: 16, compulsory: true, registered: 35800000,
    offices: {
      President: 'Elected for four years. A candidate wins outright with 45% of the vote, or 40% and a ten-point lead. Otherwise the top two go to a run-off.',
      Senate: 'Three senators per province and the capital, serving six-year terms. A third of provinces vote every two years. The list with the most votes takes two seats and the runner-up takes one.'
    }
  },
  GB: {
    system: 'Unitary parliamentary constitutional monarchy',
    headOfState: 'The King',
    headOfGovernment: 'Prime Minister',
    legislature: 'Parliament: House of Commons (650) and appointed House of Lords',
    votingAge: 18, compulsory: false, registered: 48200000,
    offices: {
      'House of Commons': 'Each of 650 constituencies elects one MP by first past the post. The party that can command a majority forms the government. Elections are held at least every five years.'
    }
  },
  ES: {
    system: 'Parliamentary constitutional monarchy',
    headOfState: 'The King',
    headOfGovernment: 'President of the Government',
    legislature: 'Cortes Generales: Congress of Deputies (350) and Senate (265)',
    votingAge: 18, compulsory: false, registered: 37500000,
    offices: {
      'Congress of Deputies': '350 deputies elected by closed-list proportional representation in each province, using the D’Hondt method with a 3% threshold. Congress invests the head of government.',
      Senate: '208 senators are elected directly, mostly four per province with open voting for individual candidates. Regional parliaments appoint the rest.'
    }
  },
  FR: {
    system: 'Unitary semi-presidential republic',
    headOfState: 'President',
    headOfGovernment: 'Prime Minister',
    legislature: 'Parliament: National Assembly (577) and indirectly elected Senate',
    votingAge: 18, compulsory: false, registered: 49400000,
    offices: {
      President: 'Elected for five years by national popular vote over two rounds. If nobody wins a majority on the first Sunday, the top two face a run-off two weeks later.',
      'National Assembly': '577 single-member constituencies voting over two rounds. Candidates with 12.5% of registered voters go through to the second round.'
    }
  },
  DE: {
    system: 'Federal parliamentary republic',
    headOfState: 'Federal President',
    headOfGovernment: 'Chancellor',
    legislature: 'Bundestag (630) and the Bundesrat of state governments',
    votingAge: 18, compulsory: false, registered: 59200000,
    offices: {
      Bundestag: 'Voters cast a constituency vote and a party vote. Seats are shared out by party vote among parties above 5% or with three constituency wins. The Bundestag elects the Chancellor.'
    }
  },
  AU: {
    system: 'Federal parliamentary constitutional monarchy',
    headOfState: 'The King, represented by the Governor-General',
    headOfGovernment: 'Prime Minister',
    legislature: 'Parliament: House of Representatives (150) and Senate (76)',
    votingAge: 18, compulsory: true, registered: 18100000,
    offices: {
      'House of Representatives': '150 single-member divisions elected by full preferential voting. Terms run up to three years. The party or coalition with a majority forms government.',
      Senate: 'Twelve senators per state and two per territory, elected by single transferable vote. Half the state senators are up at a normal election.'
    }
  }
};

function fillRegions(el, view, catalog, rand, seed = {}) {
  const base = nationalBase(view);
  const contest = CONTESTS[el.id] ?? (seed.partial ? seed.winners : null);
  const seatMap = REGION_SEATS[el.id] ?? seed.regionSeats;
  const fixed = seed.winners ?? {};
  const presidential = el.kind === 'presidential';
  const fptp = /first past|preferential|two-round constituencies/i.test(el.system ?? '');
  const nationalVotes = view.candidates.reduce((n, c) => n + (c.votes ?? 0), 0) || null;
  const turnout = el.turnout ?? 60;

  let regions = view.regions;
  const partial = Boolean(contest) || (regions && regions.length < catalog.length && !presidential);
  if (!regions || partial) {
    const known = new Map((regions ?? []).map(r => [r.abbr, r]));
    regions = catalog.map(c => {
      const prior = known.get(c.abbr);
      const up = contest ? c.abbr in contest : regions ? known.has(c.abbr) : true;
      const winner = contest?.[c.abbr] ?? fixed[c.abbr] ?? prior?.winner ?? seed.defaultWinner ?? null;
      // Multi-member constituencies carry their seat count (Ireland); a
      // presidential race in the same units has no seats.
      const seats = !presidential && c.seats ? { seats: c.seats } : {};
      return { name: c.name, abbr: c.abbr, ...seats, contested: up, winner: up ? winner : null };
    });
  }

  const weights = regions.map(r => r.seats ?? seatMap?.[r.abbr] ?? 1);
  const weightSum = weights.reduce((a, b) => a + b, 0);
  const code = el.id.slice(0, 2).toUpperCase();
  const stands = standsIn(code);
  const only = REGIONAL[code]?.only ?? {};
  const weightOf = abbr => weights[regions.findIndex(r => r.abbr === abbr)] ?? 0;
  // National share packed into the regions where a regional party stands.
  const baseFor = abbr => base
    .filter(b => stands(b.party, abbr))
    .map(b => (only[b.party] ? { ...b, pct: Math.min(55, b.pct / Math.max(0.02, only[b.party].reduce((n, a) => n + weightOf(a), 0) / weightSum)) } : b))
    .sort((a, b) => b.pct - a.pct);

  return regions.map((r, i) => {
    if (r.contested === false) return { name: r.name, abbr: r.abbr, contested: false, winner: null };
    const out = { name: r.name, abbr: r.abbr };
    const seats = r.seats ?? seatMap?.[r.abbr];
    if (seats) out.seats = seats;
    const res = regionResult(baseFor(r.abbr), r.winner, rand, turnout);
    Object.assign(out, { winner: res.winner, margin: res.margin, turnout: res.turnout });
    if (nationalVotes) {
      const votes = Math.round(nationalVotes * (weights[i] / weightSum) * (0.8 + rand() * 0.4));
      out.votes = votes;
      res.results.forEach(x => { x.votes = Math.round((votes * x.pct) / 100); });
    }
    if (seats && presidential) res.results[0].seats = seats;
    else if (seats > 1) allocate(seats, res.results, fptp ? 2 : 1).forEach((s, j) => { res.results[j].seats = s; });
    else if (seats === 1) res.results[0].seats = 1;
    out.results = res.results;
    if (contest || regions.some(x => x.contested === false)) out.contested = true;
    return out;
  });
}

// When a chamber's seats are all shared out region by region (Ireland's
// constituencies, Spain's Senate), use the real regional seat splits or fit
// ones so each party's seats add up to its national total, and give each
// region to the party that won most of its seats.
function fitRegionSeats(el, stands) {
  if (DISTRICT_ELECTIONS[el.id] || !el.totalSeats || el.kind === 'presidential') return;
  const split = SEAT_SPLITS[el.id];
  for (const r of el.regions ?? []) if (split?.[r.abbr]) r.seats = Object.values(split[r.abbr]).reduce((a, b) => a + b, 0);
  const regs = (el.regions ?? []).filter(r => r.seats && r.contested !== false && r.results?.length);
  const parties = el.candidates.filter(c => (c.seats ?? 0) > 0);
  const sum = xs => xs.reduce((a, b) => a + b, 0);
  if (!regs.length || sum(parties.map(c => c.seats)) !== el.totalSeats) return;
  // A real split may leave out seats that aren't on the map; a fitted one can't.
  if (!split && sum(regs.map(r => r.seats)) !== el.totalSeats) return;
  const weights = regs.map(r => parties.map(c => {
    if (!stands(c.party, r.abbr)) return 0;
    return Math.max(r.results.find(x => x.party === c.party)?.pct ?? (c.pct ?? 1) * 0.3, 0.5);
  }));
  const table = split ? regs.map(r => parties.map(c => split[r.abbr]?.[c.party] ?? 0)) : fitSeats(regs.map(r => r.seats), parties.map(c => c.seats), weights);
  regs.forEach((r, i) => {
    const seats = Object.fromEntries(parties.map((c, j) => [c.party, table[i][j]]));
    r.results = r.results.map(x => ({ ...x, seats: seats[x.party] ?? 0 }));
    addSeatShares(r, seats);
    const best = [...r.results].sort((a, b) => b.seats - a.seats || b.pct - a.pct)[0];
    r.winner = best.party;
  });
}

function history(el, years, rand) {
  const view = el.rounds ? el.rounds.at(-1) : el;
  const hasSeats = Boolean(el.totalSeats) && view.candidates.some(c => c.seats != null);
  const exp = el.kind === 'presidential' ? 6 : /proportional/i.test(el.system ?? '') ? 1 : 1.8;
  let cur = nationalBase(view).slice(0, 6).map(b => ({ party: b.party, pct: b.pct }));
  return years.map(year => {
    cur = cur.map(c => ({ party: c.party, pct: Math.max(0.5, c.pct + (rand() - 0.5) * 10) }));
    const sum = cur.reduce((n, c) => n + c.pct, 0);
    cur = cur.map(c => ({ party: c.party, pct: (c.pct / sum) * 100 }));
    const results = cur.map(c => ({ party: c.party, pct: r1(c.pct) }));
    if (hasSeats) allocate(el.totalSeats, results, exp).forEach((s, i) => { results[i].seats = s; });
    results.sort((a, b) => (b.seats ?? b.pct) - (a.seats ?? a.pct));
    return { year, winner: results[0].party, results };
  });
}

Object.assign(HISTORY, NEW_HISTORY);
Object.assign(ABOUT, NEW_ABOUT);
for (const [code, offices] of Object.entries(EXTRA_ABOUT)) Object.assign(ABOUT[code].offices, offices);

const readJSON = async (file, fallback) => JSON.parse(await readFile(file, 'utf8').catch(() => JSON.stringify(fallback)));
const writeJSON = (file, value) => writeFile(file, JSON.stringify(value, null, 2) + '\n');

// Country files list hundreds of regions and districts; one per line keeps
// them readable at about half the size of fully indented JSON.
function countryJSON(value) {
  const rows = [];
  const text = JSON.stringify(value, (key, v) => {
    if (Array.isArray(v) && ['regions', 'districts', 'results', 'points'].includes(key)) {
      return v.map(x => {
        rows.push(JSON.stringify(x));
        return `@@${rows.length - 1}@@`;
      });
    }
    return v;
  }, 2);
  return text.replace(/"@@(\d+)@@"/g, (_, i) => rows[i]) + '\n';
}

// Index and schedule gain the new countries and chambers once.
const indexFile = path.join(root, 'data', 'index.json');
const index = await readJSON(indexFile, { countries: [] });
for (const [code, meta] of Object.entries(NEW_INDEX)) {
  if (!index.countries.some(c => c.code === code)) index.countries.push({ code, name: NEW[code].name, ...meta });
}
await writeJSON(indexFile, index);

const scheduleFile = path.join(root, 'data', 'schedule.json');
const schedule = await readJSON(scheduleFile, []);
for (const entry of NEW_SCHEDULE) {
  if (!schedule.some(s => s.country === entry.country && s.office === entry.office && s.date === entry.date)) schedule.push(entry);
}
await writeJSON(scheduleFile, schedule);

const topo = JSON.parse(await readFile(path.join(root, 'data', 'regions.topo.json'), 'utf8'));
async function districtShapes(code) {
  const file = path.join(root, 'data', 'districts', `${code}.topo.json`);
  const t = await readFile(file, 'utf8').then(JSON.parse).catch(() => null);
  if (!t) return [];
  // Rough centre of each district from its TopoJSON arcs (mean of vertices),
  // enough to cluster seats geographically.
  const [kx, ky] = t.transform?.scale ?? [1, 1];
  const [tx, ty] = t.transform?.translate ?? [0, 0];
  const arcs = t.arcs.map(arc => {
    let x = 0;
    let y = 0;
    return arc.map(([dx, dy]) => (t.transform ? [(x += dx) * kx + tx, (y += dy) * ky + ty] : [dx, dy]));
  });
  const centre = g => {
    if (!g.arcs) return undefined;
    const ids = [g.arcs].flat(Infinity).map(i => (i < 0 ? ~i : i));
    const pts = ids.flatMap(i => arcs[i]);
    const lat = pts.reduce((n, p) => n + p[1], 0) / pts.length;
    const lon = pts.reduce((n, p) => n + p[0], 0) / pts.length;
    return [lon * Math.cos((lat * Math.PI) / 180), lat];
  };
  // Rough area (degrees², scaled for latitude) from each polygon's outer ring.
  const ringPoints = ids => ids.flatMap(i => (i < 0 ? [...arcs[~i]].reverse() : arcs[i]));
  const area = g => {
    if (!g.arcs) return 0;
    const polys = g.type === 'Polygon' ? [g.arcs] : g.arcs;
    let total = 0;
    for (const rings of polys) {
      const pts = ringPoints(rings[0]);
      const k = Math.cos(((pts[0]?.[1] ?? 0) * Math.PI) / 180);
      let a = 0;
      for (let j = 0; j < pts.length - 1; j++) a += pts[j][0] * k * pts[j + 1][1] - pts[j + 1][0] * k * pts[j][1];
      total += Math.abs(a / 2);
    }
    return total;
  };
  return t.objects.districts.geometries.map(g => ({
    key: g.id.slice(code.length + 1), name: g.properties.name, region: g.properties.region, c: centre(g), area: area(g)
  }));
}
const shapeNames = code => topo.objects.regions.geometries
  .filter(g => g.id.startsWith(`${code}-`))
  .map(g => ({ abbr: g.id.slice(code.length + 1), name: g.properties.name, seats: g.properties.seats }))
  .sort((a, b) => a.name.localeCompare(b.name));

for (const code of CODES) {
  const file = path.join(countriesDir, `${code}.json`);
  const country = await readJSON(file, { code, name: NEW[code]?.name, subtitle: NEW[code]?.subtitle, parties: {}, elections: [] });
  const seeds = new Map();
  const add = (el, after) => {
    if (country.elections.some(e => e.id === el.id)) return;
    seeds.set(el.id, Object.fromEntries(SEED_KEYS.map(k => [k, el[k]])));
    const clean = Object.fromEntries(Object.entries(el).filter(([k]) => !SEED_KEYS.includes(k)));
    const at = after ? country.elections.map(e => e.office).lastIndexOf(after) + 1 : country.elections.length;
    country.elections.splice(at || country.elections.length, 0, clean);
  };
  const seed = NEW[code] ?? EXTRA[code];
  if (seed) {
    country.parties = { ...seed.parties, ...country.parties };
    for (const el of seed.elections) add(el, EXTRA[code]?.after);
  }

  const lists = country.elections.flatMap(e => [e.regions, ...(e.rounds ?? []).map(r => r.regions)]).filter(Boolean);
  const known = lists.sort((a, b) => b.length - a.length)[0];
  // Known lists can include split electoral-vote districts ("ME-2"), which
  // have no shape; catalogues from shapes are used as they are.
  const catalog = known
    ? known.filter(r => !r.abbr.includes('-')).map(r => ({ name: r.name, abbr: r.abbr }))
    : shapeNames(code);

  const realPast = new Set((await readJSON(path.join(root, 'scripts', 'history', `${code}.json`), { elections: [] })).elections.map(e => e.office));
  for (const el of country.elections) {
    if (el.source) continue;
    // District maps feed region winners back in, so each election is rebuilt
    // until it stops changing. Seed winners only shape the first pass.
    for (let pass = 0, last; pass < 8; pass++) {
      const rand = seeded(el.id);
      const meta = pass ? {} : seeds.get(el.id) ?? {};
      const cat = el.kind === 'presidential' || code !== 'US' ? catalog : catalog.filter(r => r.abbr !== 'DC');
      if (el.rounds) {
        el.rounds.forEach((round, i) => {
          round.regions = fillRegions(el, round, catalog, rand, i === el.rounds.length - 1 ? meta : {});
        });
      } else {
        el.regions = fillRegions(el, el, cat, rand, meta);
      }
      fitRegionSeats(el, standsIn(code));
      // Sample past results only for offices without real ones in scripts/history.
      if (HISTORY[el.id] && !realPast.has(el.office)) el.history = history(el, HISTORY[el.id], seeded(`history-${el.id}`));
      else delete el.history;
      const shapes = DISTRICT_ELECTIONS[el.id] && await districtShapes(code);
      if (shapes?.length) el.districts = buildDistricts(el, shapes, seeded(`${el.id}-districts`), standsIn(code), SEAT_SPLITS[el.id]) ?? undefined;
      const now = JSON.stringify(el);
      if (now === last) break;
      last = now;
    }
  }

  const { name, subtitle, parties, elections } = country;
  const out = { code, name, subtitle, about: ABOUT[code] ?? country.about, parties, elections, ...(country.polls?.some(p => p.source) ? { polls: country.polls } : {}) };
  await writeFile(file, countryJSON(out));
  const regions = elections.reduce((n, e) => n + (e.regions?.length ?? 0), 0);
  console.log(`${code}: ${elections.length} elections, ${regions} region results`);
}
