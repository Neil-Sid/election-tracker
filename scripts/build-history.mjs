#!/usr/bin/env node
// Builds data/history/<CODE>.json from scripts/history/<CODE>.json.
//
// The input holds the national results of past elections, taken from the
// official results as tabulated on Wikipedia and checked by check-history.mjs.
// This adds a result for each region on today's map, so a past election can be
// drawn like the current one. Region results are illustrative: they come from
// the national split, except that a region's winner is the real one wherever
// the source recorded it (regionWinners).
//
//   node scripts/build-history.mjs              every country in scripts/history
//   node scripts/build-history.mjs FR NL        only these
//   node scripts/build-history.mjs path/to/dir  another input folder

import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { seeded, nationalBase, regionResult, standsIn } from './regions.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const only = args.filter(a => /^[A-Za-z]{2}$/.test(a)).map(a => a.toUpperCase());
const srcDir = path.resolve(args.find(a => !/^[A-Za-z]{2}$/.test(a)) ?? path.join(root, 'scripts', 'history'));
const outDir = path.join(root, 'data', 'history');
const readJSON = async file => JSON.parse(await readFile(file, 'utf8'));

// Parties that only stood in some regions in past elections, by today's region
// codes. Separate from REGIONAL in regions.mjs, which describes today's
// parties. An entry can be limited to elections `before` or `from` a date.
const NORTH_IT = ['LOM', 'VEN', 'PIE', 'LIG', 'EMR', 'FVG', 'TAA', 'VDA', 'TOS', 'MAR', 'UMB'];
const KURDISH_TR = ['02', '04', '12', '13', '21', '30', '36', '47', '49', '56', '62', '63', '65', '72', '73', '76'];
const GREAT_BRITAIN = ['ENG', 'SCT', 'WLS'];
const EAST_DE = ['BB', 'MV', 'SN', 'ST', 'TH', 'BE'];
const FLANDERS = ['VAN', 'VBR', 'VLI', 'VOV', 'VWV', 'BRU'];
const WALLONIA = ['WBR', 'WHT', 'WLG', 'WLX', 'WNA', 'BRU'];
const RULES = {
  IN: {
    pdf: ['TG'], aigp: ['OR'], sad: ['PB'], sada: ['PB'], adsfs: ['PB'], tntp: ['TN'], cwp: ['TN'], ttnc: ['TN'],
    jhp: ['JH'], cnspjp: ['JH'], aijp: ['JH'], jmm: ['JH'], mcc: ['JH'], ajsu: ['JH'], jvm: ['JH'],
    rsp: ['WB', 'KL'], pwpi: ['MH'], lss: ['WB', 'JH'], klp: ['AP'], aifb: ['WB'], iuml: ['KL', 'TN'], dmk: ['TN', 'PY'],
    aiadmk: ['TN', 'PY'], mgradmk: ['TN'], nmgjp: ['GJ'], jdg: ['GJ'], arjp: ['GJ'], hls: ['HR'], vhp: ['HR'], hvp: ['HR'],
    inld: ['HR'], hjc: ['HR'], aphlc: ['ML', 'AS'], bc: ['WB'], gnlf: ['WB'], aitc: ['WB'], nc: ['JK', 'LA'], jkpdp: ['JK'],
    jkd: ['BR'], ipf: ['BR'], samata: ['BR'], jdu: ['BR'], ljp: ['BR'], rlsp: ['BR'], rjd: ['BR', 'JH'], cpiml: ['BR', 'JH'],
    ugp: ['GA'], ugdp: ['GA'], mgp: ['GA'], nno: ['NL'], ufn: ['NL'], ndpp: ['NL'], npf: ['NL', 'MN'], mpp: ['MN'], mscp: ['MN'],
    tps: ['TG'], brs: ['TG'], aimim: ['TG'], tdp: ['AP', 'TG'], prp: ['AP', 'TG'], ysrcp: ['AP'],
    kec: ['KL'], kecj: ['KL'], kecm: ['KL'], ifdp: ['KL'], utc: ['OR'], bjd: ['OR'], sjp: ['SK'], ssgp: ['SK'], sdf: ['SK'], skm: ['SK'],
    ss: ['MH'], ncp: ['MH'], bbm: ['MH'], rpia: ['MH'], swbp: ['MH'], bva: ['MH'], agp: ['AS'], asdc: ['AS'], umfa: ['AS'],
    aiudf: ['AS'], bpf: ['AS'], tmc: ['TN'], pmk: ['TN', 'PY'], mdmk: ['TN'], vck: ['TN'], sp: ['UP'], rld: ['UP'],
    ablc: ['UP'], sjpr: ['UP'], aiict: ['UP'], ad: ['UP'], ads: ['UP'], kcp: ['KA'], lks: ['KA'], jds: ['KA'], mpvc: ['MP'],
    hvc: ['HP'], arc: ['AR'], mnf: ['MZ'], npp: ['ML'], bnsp: ['DH'], ainrc: ['PY'], rlp: ['RJ'], aap: ['PB', 'DL'],
    cpim: ['WB', 'KL', 'TR', 'TN', 'AP']
  },
  IT: {
    svp: ['TAA'], ual: ['TAA'], cb: ['TAA'], psdaz: ['SAR'], rs: ['SAR'], uv: ['VDA'], vda: ['VDA'], dcuvrv: ['VDA'],
    lv: ['VEN'], lav: ['VEN'], ll: ['LOM'], lpt: ['FVG'], illy: ['FVG'], ns: ['SIC'], mpa: ['SIC'], scn: ['SIC'], lam: ['PUG'],
    mc: ['PIE'], pcont: ['PIE'], aisa: [], maie: [], lega: { in: NORTH_IT, before: '2018-01-01' }
  },
  ZA: { ifp: ['NL', 'GT'], mf: ['NL'], unswp: [] },
  AU: { qlp: ['QLD'], lang: ['NSW'], lm: ['SA'], nwa: ['WA'], kap: ['QLD'], ca: ['SA'], jln: ['TAS'] },
  TR: { dem: KURDISH_TR, ind: { in: KURDISH_TR, from: '2007-01-01' } },
  US: { sr: ['AL', 'AR', 'FL', 'GA', 'LA', 'MS', 'NC', 'SC', 'TN', 'TX', 'VA'], cons: ['NY'], aknip: ['AK'], acp: ['CT'], ipm: ['MN'] },
  GB: {
    ...Object.fromEntries(['nat', 'irlab', 'inat', 'sf', 'iu', 'rlp', 'unity', 'protu', 'uup', 'vup', 'sdlp', 'dup', 'irep', 'uuup', 'upup', 'ukup', 'apni'].map(p => [p, ['NI']])),
    ...Object.fromEntries(['lab', 'ld', 'lib', 'all', 'ukip', 'ref', 'refp', 'bnp'].map(p => [p, GREAT_BRITAIN])),
    con: { in: GREAT_BRITAIN, from: '1974-01-01' }, snp: ['SCT'], pc: ['WLS'], grn: ['ENG', 'WLS'], respect: ['ENG'], khhc: ['ENG'], dlab: ['ENG']
  },
  ES: {
    ...Object.fromEntries(['pnv', 'ee', 'hb', 'ea', 'amaiur', 'bildu'].map(p => [p, ['PV', 'NC']])),
    ...Object.fromEntries(['nabai', 'gbai', 'upn', 'nasuma', 'cambio'].map(p => [p, ['NC']])),
    ...Object.fromEntries(['pdc', 'ecfed', 'entesa', 'dic', 'ciu', 'erc', 'catsen', 'ecprog', 'ercsi', 'cdc', 'ercsob', 'jxcat', 'junts', 'dil', 'cup', 'icv'].map(p => [p, ['CT']])),
    ...Object.fromEntries(['am', 'upc', 'aic', 'cc', 'ccpnc', 'ahi', 'pil', 'asg'].map(p => [p, ['CN']])),
    ...Object.fromEntries(['caic', 'caud', 'par', 'cha', 'te'].map(p => [p, ['AR']])),
    ...Object.fromEntries(['cdg', 'bng'].map(p => [p, ['GA']])),
    ...Object.fromEntries(['uv', 'compromis'].map(p => [p, ['VC']])),
    ...Object.fromEntries(['psm', 'pacte', 'psoeexc'].map(p => [p, ['IB']])),
    pa: ['AN'], prc: ['CB'], ids: ['CL']
  },
  DE: {
    ssw: ['SH'], bp: ['BY'], wav: ['BY'], zentrum: ['NW', 'NI'], dp: ['NI', 'HB', 'HH', 'SH'], rechtsp: ['NI'],
    b90: EAST_DE, dsu: EAST_DE
  },
  PL: { mn: ['OP', 'SL'], ras: ['SL'] },
  // Belgium's national parties split by language: the Christian Democrats in
  // 1968, the Liberals in 1972 and the Socialists in 1978.
  BE: {
    ...Object.fromEntries(['vu', 'cvvu', 'vc', 'vblok', 'vb', 'nva', 'cdv', 'ovld', 'groen', 'ldd', 'rossem', 'spaspirit', 'cdvnva', 'blanco', 'vooruit']
      .map(p => [p, FLANDERS])),
    ...Object.fromEntries(['mr', 'ps', 'le', 'ecolo', 'defi', 'fdfrw', 'rw', 'fw', 'ptw', 'prl', 'prlfdf', 'psbrw', 'rscl', 'udrt', 'fn', 'pp', 'ptbgo', 'psccsp']
      .map(p => [p, WALLONIA])),
    pvv: { in: FLANDERS, from: '1972-01-01' },
    bsplux: ['WLX'], fdfpdlp: ['BRU'], bsprl: ['BRU'], rl: ['BRU']
  },
  CA: { bq: ['QC'], rc: ['QC'], ue: ['QC'], ref: ['BC', 'AB', 'SK', 'MB', 'ON', 'NB', 'NS', 'PE', 'NL', 'YT', 'NT'] },
  AR: {
    ...Object.fromEntries(['pac', 'plc', 'pnuevo', 'proyctes', 'fcsc', 'fdt96'].map(p => [p, ['CN']])),
    ...Object.fromEntries(['pri', 'mps', 'upsalta', 'somossalta'].map(p => [p, ['SA']])),
    ...Object.fromEntries(['sch', 'pach', 'ppch'].map(p => [p, ['CH']])),
    ...Object.fromEntries(['hxc', 'fcc', 'evc'].map(p => [p, ['CB']])),
    ...Object.fromEntries(['pdm', 'mpm'].map(p => [p, ['MZ']])),
    ...Object.fromEntries(['bloq', 'cruzada'].map(p => [p, ['SJ']])),
    ...Object.fromEntries(['ppr', 'jsrn'].map(p => [p, ['RN']])),
    ...Object.fromEntries(['mopof', 'pff'].map(p => [p, ['TF']])),
    ...Object.fromEntries(['fr', 'dpbb'].map(p => [p, ['TM']])),
    ...Object.fromEntries(['vcv', 'avlib'].map(p => [p, ['BA']])),
    ...Object.fromEntries(['cporteno', 'fub'].map(p => [p, ['CABA']])),
    mpn: ['NQ'], mpj: ['JY'], fcs: ['SE'], ach: ['CC'], fcscat: ['CT'], fprioja: ['LR'], frc: ['MN'], mfp: ['LP'], ser: ['SC'], aplsl: ['SL']
  }
};

// The rules in force on an election's date, in the shape standsIn expects.
const rulesFor = (code, date) => ({
  [code]: {
    only: Object.fromEntries(Object.entries(RULES[code] ?? {})
      .map(([party, rule]) => [party, Array.isArray(rule) ? rule : (!rule.before || date < rule.before) && (!rule.from || date >= rule.from) ? rule.in : null])
      .filter(([, where]) => where))
  }
});

await mkdir(outDir, { recursive: true });
const codes = (await readdir(srcDir))
  .filter(f => /^[A-Z]{2}\.json$/.test(f))
  .map(f => f.slice(0, 2))
  .filter(c => !only.length || only.includes(c));
const indexFile = path.join(root, 'data', 'index.json');
const index = await readJSON(indexFile);

for (const code of codes) {
  const hist = await readJSON(path.join(srcDir, `${code}.json`));
  const current = await readJSON(path.join(root, 'data', 'countries', `${code}.json`));
  // Each office is drawn on the units today's election of that office uses
  // (DC only for the presidency, for example).
  const regionsNow = office => {
    const now = current.elections.find(e => e.office === office);
    return now?.regions ?? now?.rounds?.at(-1)?.regions ?? [];
  };

  // A regional party's national share is packed into its regions, weighted by
  // where today's votes are cast.
  const weightsFor = office => {
    const w = Object.fromEntries(regionsNow(office).map(r => [r.abbr, r.votes ?? r.seats ?? 1]));
    return abbr => w[abbr] ?? 1;
  };

  const regionsFor = (el, view, winners, voted, rand) => {
    const base = nationalBase(view);
    const rules = rulesFor(code, el.date);
    const stands = standsIn(code, rules);
    const only = rules[code].only;
    const weight = weightsFor(el.office);
    // Split electoral-vote districts (ME-2, NE-2) only when the source has them.
    const catalog = regionsNow(el.office).filter(r => !r.abbr.includes('-') || winners?.[r.abbr]);
    const total = catalog.reduce((n, r) => n + weight(r.abbr), 0) || 1;
    const baseFor = abbr => base
      .filter(b => stands(b.party, abbr))
      .map(b => {
        const where = only[b.party];
        if (!where) return b;
        const share = where.reduce((n, a) => n + weight(a), 0) / total;
        return { ...b, pct: Math.min(55, b.pct / Math.max(0.02, share)) };
      })
      .sort((a, b) => b.pct - a.pct);

    // Only the winner and the shares: made-up vote counts or turnout per
    // region would read as real figures. When only some regions voted, the
    // rest are shown as having no race.
    return catalog.map(r => {
      if (voted && !voted.has(r.abbr)) return { name: r.name, abbr: r.abbr, contested: false, winner: null };
      const res = regionResult(baseFor(r.abbr), winners?.[r.abbr] ?? null, rand, el.turnout ?? 70);
      return { name: r.name, abbr: r.abbr, winner: res.winner, margin: res.margin, results: res.results };
    });
  };

  const elections = hist.elections
    .map(src => {
      const { notes, checks, regionWinners, regionSource, source, partial, voted: votedList, ...el } = src;
      const rand = seeded(el.id);
      // Regions that voted: listed in `voted`, or with `partial`, those with a winner.
      const voted = votedList ? new Set(votedList) : partial ? new Set(Object.keys(regionWinners ?? {})) : null;
      Object.assign(el, { status: 'final', reporting: 100 });
      if (el.totalSeats) {
        el.majority ??= Math.floor(el.totalSeats / 2) + 1;
        el.seatLabel ??= 'Seats';
      }
      el.cite = { name: source.name.replace(/^Wikipedia, citing /, ''), url: source.url };
      if (regionWinners) el.statesFrom = regionSource;
      if (el.rounds?.length) {
        el.rounds = el.rounds.map((round, i) => ({
          ...round,
          regions: regionsFor(el, round, i === el.rounds.length - 1 ? regionWinners : null, voted, rand)
        }));
        el.candidates = el.rounds.at(-1).candidates;
      } else {
        el.regions = regionsFor(el, el, regionWinners, voted, rand);
      }
      return el;
    })
    .sort((a, b) => b.date.localeCompare(a.date));

  const parties = Object.fromEntries(Object.entries(hist.parties).map(([key, p]) => [key, { name: p.name, color: p.color }]));
  await writeFile(path.join(outDir, `${code}.json`), JSON.stringify({ code, parties, elections }) + '\n');
  const meta = index.countries.find(c => c.code === code);
  if (meta) meta.history = true;
  const offices = Object.entries(Object.groupBy(elections, e => e.office)).map(([o, l]) => `${o} ${l.length}`).join(', ');
  console.log(`${code}: ${elections.length} past elections (${offices})`);
}

await writeFile(indexFile, JSON.stringify(index, null, 2) + '\n');
