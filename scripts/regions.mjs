// Shared by mock-data.mjs (current elections) and build-history.mjs (past
// elections): a seeded random source, the national split a region result is
// drawn from, the sample result for one region, and which parties stand where.

export function seeded(str) {
  let h = 2166136261;
  for (const ch of str) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

export const r1 = n => Math.round(n * 10) / 10;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function nationalBase(view) {
  const c = view.candidates;
  const hasPct = c.some(x => x.pct != null);
  const seatSum = c.reduce((n, x) => n + (x.seats ?? 0), 0) || 1;
  return c
    .map(x => ({ party: x.party, pct: hasPct ? x.pct ?? 0 : ((x.seats ?? 0) / seatSum) * 100, seats: x.seats }))
    .filter(x => x.pct > 0)
    .sort((a, b) => b.pct - a.pct);
}

// Largest-remainder share-out. exp > 1 rewards the leader, as first past the post does.
export function allocate(seats, results, exp) {
  const w = results.map(r => Math.pow(Math.max(r.pct, 0), exp));
  const sum = w.reduce((a, b) => a + b, 0) || 1;
  const quotas = w.map(x => (x / sum) * seats);
  const out = quotas.map(Math.floor);
  let left = seats - out.reduce((a, b) => a + b, 0);
  quotas.map((q, i) => [q - Math.floor(q), i]).sort((a, b) => b[0] - a[0]).forEach(([, i]) => {
    if (left-- > 0) out[i]++;
  });
  return out;
}

export function regionResult(base, winner, rand, turnout) {
  if (!base.length) base = [{ party: winner ?? 'oth', pct: 50 }];
  let shares = base.slice(0, 5).map(b => ({ party: b.party, pct: Math.max(0.4, b.pct * (0.5 + rand())) }));
  const w = winner ?? shares.reduce((a, b) => (b.pct > a.pct ? b : a)).party;
  let wi = shares.findIndex(s => s.party === w);
  if (wi < 0) {
    shares.push({ party: w, pct: 10 });
    wi = shares.length - 1;
  }
  const rival = Math.max(0, ...shares.filter((_, i) => i !== wi).map(s => s.pct));
  if (shares[wi].pct <= rival) shares[wi].pct = rival * (1.01 + rand() * rand() * 0.8);
  const sum = shares.reduce((n, s) => n + s.pct, 0);
  shares = shares.map(s => ({ party: s.party, pct: r1((s.pct / sum) * 100) })).sort((a, b) => b.pct - a.pct || (b.party === w) - (a.party === w));
  // Rounding can tie the winner with the runner-up; move a tenth across.
  if (shares[1]?.pct === shares[0].pct) {
    shares[0].pct = r1(shares[0].pct + 0.1);
    shares[1].pct = r1(shares[1].pct - 0.1);
  }
  return {
    winner: w,
    results: shares,
    margin: r1(shares[0].pct - (shares[1]?.pct ?? 0)),
    turnout: r1(clamp(turnout + (rand() - 0.5) * 14, 35, 97))
  };
}

// Parties that only stand in some regions, and regions where only some
// parties stand. Their share is concentrated where they run.
export const REGIONAL = {
  GB: {
    only: {
      snp: ['SCT'], pc: ['WLS'], grn: ['ENG', 'WLS'], spk: ['ENG'], ind: ['ENG', 'NI'],
      sf: ['NI'], dup: ['NI'], sdlp: ['NI'], apni: ['NI'], uup: ['NI'], tuv: ['NI']
    },
    exclusive: { NI: ['sf', 'dup', 'sdlp', 'apni', 'uup', 'tuv', 'ind', 'oth'] }
  },
  CA: { only: { bq: ['QC'] } },
  AR: { only: { innov: ['SA', 'MN', 'NQ', 'RN'], defcba: ['CB'], psj: ['SJ'] } },
  // Belgian parties stand on one side of the language border, and in Brussels.
  BE: {
    only: {
      ...Object.fromEntries(['nva', 'vb', 'vooruit', 'cdv', 'ovld', 'groen', 'blanco'].map(p => [p, ['VAN', 'VBR', 'VLI', 'VOV', 'VWV', 'BRU']])),
      ...Object.fromEntries(['mr', 'ps', 'le', 'ecolo', 'defi'].map(p => [p, ['WBR', 'WHT', 'WLG', 'WLX', 'WNA', 'BRU']]))
    }
  },
  ES: {
    only: {
      erc: ['CT'], junts: ['CT'], bildu: ['PV', 'NC'], pnv: ['PV'], upn: ['NC'], bng: ['GA'],
      cc: ['CN'], asg: ['CN'], ahi: ['CN'], pacte: ['IB']
    }
  },
  DE: { only: { ssw: ['SH'] } },
  IN: {
    only: {
      sp: ['UP'], aitc: ['WB'], dmk: ['TN'], tdp: ['AP'], jdu: ['BR'], ssubt: ['MH'], ncpsp: ['MH'], shs: ['MH'], ljprv: ['BR'], ysrcp: ['AP'],
      cpim: ['KL', 'WB', 'TN', 'RJ', 'TR'], rjd: ['BR'], aap: ['PB', 'DL', 'GJ', 'HR', 'AS'], jmm: ['JH'], iuml: ['KL', 'TN'], cpi: ['TN', 'KL'],
      cpiml: ['BR'], jds: ['KA'], jsp: ['AP'], rld: ['UP'], nc: ['JK'], vck: ['TN'], bsp: ['UP'], bjd: ['OR'], aiadmk: ['TN'], brs: ['TG'],
      // Where the one-seat parties and the independents won.
      oth: ['AS', 'UP', 'RJ', 'KL', 'MH', 'BR', 'JH', 'SK', 'TN', 'PB', 'TG', 'ML', 'MZ'], ind: ['MH', 'BR', 'LA', 'JK', 'PB', 'DH']
    }
  },
  AU: { only: { kap: ['QLD'], ca: ['SA'], jln: ['TAS'], av: ['WA'] } },
  IT: { only: { svp: ['TAA'], cb: ['TAA'], scn: ['SIC'], vda: ['VDA'], maie: [] } },
  FR: { only: { reg: ['COR'] } },
  PT: { only: { jpp: ['30'] } },
  IE: { only: { redress: ['donegal'] } }
};

export const standsIn = (code, rules = REGIONAL) => (party, region) => {
  const cfg = rules[code];
  if (!cfg) return true;
  const excl = cfg.exclusive?.[region];
  if (excl && !excl.includes(party)) return false;
  const only = cfg.only?.[party];
  return !only || only.includes(region);
};
