// Starting points for scripts/mock-data.mjs: national results for countries
// and chambers that have no data file entry yet. Where a comment names an
// official source, the national figures are that body's results (taken from
// Wikipedia's tables of them); the rest approximate recent results. Region
// and district results built from them are sample data either way.
//
// Each result lists every party that won a seat, took at least 1% of the
// vote, or lost five or more seats; everything else is summed into Others.
//
// Per election, `winners` fixes region winners (other regions are drawn from
// the national split, or `defaultWinner`), `regionSeats` gives seats per region,
// and `partial: true` marks every region not in `winners` as having no race.

const p = (name, color) => ({ name, color });
const c = (name, party, pct, seats, extra = {}) => ({ name, party, pct, seats, ...extra });
const votes = (cands, total) => cands.map(x => (x.pct == null ? x : { ...x, votes: Math.round((total * x.pct) / 100) }));

const US_HOUSE_SEATS = { AL: 7, AK: 1, AZ: 9, AR: 4, CA: 52, CO: 8, CT: 5, DE: 1, FL: 28, GA: 14, HI: 2, ID: 2, IL: 17, IN: 9, IA: 4, KS: 4, KY: 6, LA: 6, ME: 2, MD: 8, MA: 9, MI: 13, MN: 8, MS: 4, MO: 8, MT: 2, NE: 3, NV: 4, NH: 2, NJ: 12, NM: 3, NY: 26, NC: 14, ND: 1, OH: 15, OK: 5, OR: 6, PA: 17, RI: 2, SC: 7, SD: 1, TN: 9, TX: 38, UT: 4, VT: 1, VA: 11, WA: 10, WV: 2, WI: 8, WY: 1 };
const US_HOUSE_WIN = Object.fromEntries(Object.keys(US_HOUSE_SEATS).map(s => [s, ['CA', 'CO', 'CT', 'DE', 'HI', 'IL', 'ME', 'MD', 'MA', 'MN', 'NV', 'NH', 'NJ', 'NM', 'NY', 'OR', 'RI', 'VT', 'VA', 'WA'].includes(s) ? 'dem' : 'gop']));

const BR_CHAMBER_SEATS = { SP: 70, MG: 53, RJ: 46, BA: 39, RS: 31, PR: 30, PE: 25, CE: 22, MA: 18, GO: 17, PA: 17, SC: 16, PB: 12, ES: 10, PI: 10, AL: 9, AC: 8, AM: 8, AP: 8, DF: 8, MS: 8, MT: 8, RN: 8, RO: 8, RR: 8, SE: 8, TO: 8 };

const IN_SEATS = { UP: 80, MH: 48, WB: 42, BR: 40, TN: 39, MP: 29, KA: 28, GJ: 26, AP: 25, RJ: 25, OR: 21, KL: 20, TG: 17, AS: 14, JH: 14, PB: 13, CT: 11, HR: 10, DL: 7, JK: 5, UT: 5, HP: 4, AR: 2, GA: 2, MN: 2, ML: 2, TR: 2, DH: 2, AN: 1, CH: 1, LA: 1, LD: 1, MZ: 1, NL: 1, PY: 1, SK: 1 };

// Extra chambers for countries that already have a data file.
export const EXTRA = {
  US: {
    parties: {},
    elections: [{
      id: 'us-house-2024', office: 'House of Representatives', kind: 'legislative', date: '2024-11-05', status: 'final', reporting: 100,
      system: '435 single-member districts', totalSeats: 435, majority: 218, seatLabel: 'Seats',
      candidates: votes([c('Republican', 'gop', 50.5, 220, { change: -2, winner: true }), c('Democratic', 'dem', 47.2, 215, { change: 2 }), c('Others', 'oth', 2.3, 0, { change: 0 })], 147200000),
      winners: US_HOUSE_WIN, regionSeats: US_HOUSE_SEATS
    }],
    after: 'President'
  },
  BR: {
    // Colours from Wikipedia's party colour templates (PSOL lightened to stand apart from the PT).
    parties: {
      pl: p('Liberal Party', '#015AAA'), pt: p("Workers' Party", '#E20E28'), uniao: p('União Brasil', '#2FBEF2'), pp: p('Progressistas', '#203F71'),
      psd: p('PSD', '#FFA500'), mdb: p('MDB', '#30914D'), rep: p('Republicanos', '#0070C5'), pdt: p('PDT', '#C21E56'), psb: p('PSB', '#FFCC00'),
      psdb: p('PSDB', '#0080FF'), psol: p('PSOL', '#F26B61'), pode: p('Podemos', '#2DA933'), avante: p('Avante', '#088F8F'), psc: p('PSC', '#009118'),
      pcdob: p('PCdoB', '#820000'), pv: p('PV', '#006600'), cidadania: p('Cidadania', '#EC008C'), solidariedade: p('Solidariedade', '#FF9C2B'),
      patriota: p('Patriota', '#00552A'), novo: p('Novo', '#F3701B'), pros: p('PROS', '#A0522D'), rede: p('Rede', '#379E8D'), ptb: p('PTB', '#008040')
    },
    elections: [{
      id: 'br-chamber-2022', office: 'Chamber of Deputies', kind: 'legislative', date: '2022-10-02', status: 'final', reporting: 100, turnout: 79.0,
      cite: { name: 'the Superior Electoral Court', url: 'https://en.wikipedia.org/wiki/2022_Brazilian_general_election' },
      system: '513 seats, open-list proportional by state', totalSeats: 513, majority: 257, seatLabel: 'Seats',
      // Superior Electoral Court results. Others: nine parties that won no seat.
      candidates: [
        c('Liberal Party', 'pl', 16.6, 99, { votes: 18200300, change: 66, winner: true }), c("Workers' Party", 'pt', 12.1, 69, { votes: 13236698, change: 13 }),
        c('União Brasil', 'uniao', 9.3, 59, { votes: 10215433, change: -22 }), c('Progressistas', 'pp', 7.9, 47, { votes: 8692918, change: 10 }),
        c('PSD', 'psd', 7.6, 42, { votes: 8293956, change: 8 }), c('MDB', 'mdb', 7.2, 42, { votes: 7870810, change: 8 }),
        c('Republicanos', 'rep', 7, 40, { votes: 7610894, change: 10 }), c('PDT', 'pdt', 3.5, 17, { votes: 3828367, change: -11 }),
        c('PSB', 'psb', 3.8, 14, { votes: 4173479, change: -18 }), c('PSDB', 'psdb', 3, 13, { votes: 3309061, change: -16 }),
        c('PSOL', 'psol', 3.5, 12, { votes: 3852246, change: 2 }), c('Podemos', 'pode', 3.3, 12, { votes: 3610634, change: -5 }),
        c('Avante', 'avante', 2, 7, { votes: 2192518, change: 0 }), c('PSC', 'psc', 1.8, 6, { votes: 1944678, change: -2 }),
        c('PCdoB', 'pcdob', 1.1, 6, { votes: 1154712, change: -4 }), c('PV', 'pv', 0.9, 6, { votes: 954578, change: 2 }),
        c('Cidadania', 'cidadania', 1.5, 5, { votes: 1614106, change: -3 }), c('Solidariedade', 'solidariedade', 1.6, 4, { votes: 1702519, change: -9 }),
        c('Patriota', 'patriota', 1.4, 4, { votes: 1526570, change: -5 }), c('Novo', 'novo', 1.2, 3, { votes: 1354754, change: -5 }),
        c('PROS', 'pros', 0.7, 3, { votes: 799661, change: -5 }), c('Rede', 'rede', 0.7, 2, { votes: 782917, change: 1 }),
        c('PTB', 'ptb', 1.3, 1, { votes: 1422652, change: -9 }), c('Others', 'oth', 1, 0, { votes: 1064013, change: -6 })
      ],
      regionSeats: BR_CHAMBER_SEATS
    }],
    after: 'Senate'
  },
  AR: {
    parties: { oth: p('Others', '#C7C7CC') },
    elections: [{
      id: 'ar-chamber-2025', office: 'Chamber of Deputies', kind: 'legislative', date: '2025-10-26', status: 'final', reporting: 100, turnout: 68.0,
      system: '257 seats · 127 contested, proportional by province', totalSeats: 257, majority: 129, seatLabel: 'Seats',
      candidates: votes([
        c('Unión por la Patria', 'up', 31.7, 96, { change: -3 }), c('La Libertad Avanza', 'lla', 40.7, 95, { change: 56, winner: true }),
        c('Provincial parties', 'prov', 11.6, 26, { change: -4 }), c('Unión Cívica Radical', 'ucr', 5.5, 14, { change: -20 }),
        c('PRO', 'pro', 4.2, 12, { change: -25 }), c('Frente de Izquierda', 'fit', 3.9, 4, { change: -1 }), c('Others', 'oth', 2.4, 10, { change: -3 })
      ], 23900000)
    }],
    after: 'Senate'
  }
};

export const NEW = {
  IN: {
    name: 'India', subtitle: 'General elections',
    parties: {
      bjp: p('Bharatiya Janata Party', '#F97D09'), inc: p('Indian National Congress', '#19AAED'), sp: p('Samajwadi Party', '#D42A2A'),
      aitc: p('Trinamool Congress', '#20C646'), dmk: p('DMK', '#8B1A1A'), tdp: p('Telugu Desam Party', '#E8C800'),
      jdu: p('Janata Dal (United)', '#003366'), ssubt: p('Shiv Sena (UBT)', '#C2410C'), ncpsp: p('NCP (Sharadchandra Pawar)', '#0029B0'),
      shs: p('Shiv Sena', '#F2B33D'), ljprv: p('Lok Janshakti Party (Ram Vilas)', '#5B006A'), ysrcp: p('YSR Congress Party', '#1569C7'),
      cpim: p('CPI (Marxist)', '#CC0D0D'), rjd: p('Rashtriya Janata Dal', '#056D05'), aap: p('Aam Aadmi Party', '#0072B0'),
      jmm: p('Jharkhand Mukti Morcha', '#337316'), iuml: p('Indian Union Muslim League', '#006600'), cpi: p('Communist Party of India', '#F26D6D'),
      cpiml: p('CPI (ML) Liberation', '#C41301'), jds: p('Janata Dal (Secular)', '#02865A'), jsp: p('Jana Sena Party', '#E8232A'),
      rld: p('Rashtriya Lok Dal', '#006400'), nc: p('National Conference', '#922B3E'), vck: p('VCK', '#1E90FF'),
      bsp: p('Bahujan Samaj Party', '#22409A'), bjd: p('Biju Janata Dal', '#70A548'), aiadmk: p('AIADMK', '#009933'),
      brs: p('Bharat Rashtra Samithi', '#F84996'), ind: p('Independents', '#8E8E93'), oth: p('Others', '#B8B8BD')
    },
    elections: [{
      id: 'in-lok-sabha-2024', office: 'Lok Sabha', kind: 'legislative', date: '2024-06-04', status: 'final', reporting: 100, turnout: 65.8,
      cite: { name: 'the Election Commission of India', url: 'https://en.wikipedia.org/wiki/2024_Indian_general_election' },
      system: '543 constituencies, first past the post', totalSeats: 543, majority: 272, seatLabel: 'Seats',
      // Election Commission of India. Others: 17 parties with one seat each and the rest of the field.
      candidates: [
        c('Bharatiya Janata Party', 'bjp', 36.9, 240, { votes: 235974144, change: -63, winner: true }), c('Indian National Congress', 'inc', 21.4, 99, { votes: 136758952, change: 47 }),
        c('Samajwadi Party', 'sp', 4.6, 37, { votes: 29549389, change: 32 }), c('Trinamool Congress', 'aitc', 4.4, 29, { votes: 28213393, change: 7 }),
        c('DMK', 'dmk', 1.8, 22, { votes: 11754710, change: -2 }), c('Telugu Desam Party', 'tdp', 2, 16, { votes: 12775270, change: 13 }),
        c('Janata Dal (United)', 'jdu', 1.3, 12, { votes: 8039663, change: -4 }), c('Shiv Sena (UBT)', 'ssubt', 1.5, 9, { votes: 9567779, change: 9 }),
        c('NCP (Sharadchandra Pawar)', 'ncpsp', 0.9, 8, { votes: 5921162, change: 8 }), c('Independents', 'ind', 2.8, 7, { votes: 17850062, change: -1 }),
        c('Shiv Sena', 'shs', 1.2, 7, { votes: 7401447, change: -11 }), c('Lok Janshakti Party (Ram Vilas)', 'ljprv', 0.4, 5, { votes: 2810250, change: 5 }),
        c('YSR Congress Party', 'ysrcp', 2.1, 4, { votes: 13316134, change: -18 }), c('CPI (Marxist)', 'cpim', 1.8, 4, { votes: 11342553, change: 1 }),
        c('Rashtriya Janata Dal', 'rjd', 1.6, 4, { votes: 10107402, change: 4 }), c('Aam Aadmi Party', 'aap', 1.1, 3, { votes: 7147800, change: 2 }),
        c('Jharkhand Mukti Morcha', 'jmm', 0.4, 3, { votes: 2652955, change: 2 }), c('Indian Union Muslim League', 'iuml', 0.3, 3, { votes: 1716186, change: 0 }),
        c('Communist Party of India', 'cpi', 0.5, 2, { votes: 3157184, change: 0 }), c('Janata Dal (Secular)', 'jds', 0.3, 2, { votes: 2173701, change: 1 }),
        c('CPI (ML) Liberation', 'cpiml', 0.3, 2, { votes: 1736761, change: 2 }), c('Jana Sena Party', 'jsp', 0.2, 2, { votes: 1454138, change: 2 }),
        c('National Conference', 'nc', 0.2, 2, { votes: 1147041, change: -1 }), c('VCK', 'vck', 0.2, 2, { votes: 990237, change: 1 }),
        c('Rashtriya Lok Dal', 'rld', 0.1, 2, { votes: 893460, change: 2 }), c('Bahujan Samaj Party', 'bsp', 2.1, 0, { votes: 13153830, change: -10 }),
        c('Biju Janata Dal', 'bjd', 1.5, 0, { votes: 9412674, change: -12 }), c('AIADMK', 'aiadmk', 1.4, 0, { votes: 8952587, change: -1 }),
        c('Bharat Rashtra Samithi', 'brs', 0.6, 0, { votes: 3657237, change: -9 }), c('Others', 'oth', 6.2, 17, { votes: 39362591, change: -5 })
      ],
      regionSeats: IN_SEATS,
      winners: { UP: 'sp', MH: 'inc', WB: 'aitc', BR: 'bjp', TN: 'dmk', MP: 'bjp', KA: 'bjp', GJ: 'bjp', AP: 'tdp', RJ: 'bjp', OR: 'bjp', KL: 'inc', TG: 'bjp', AS: 'bjp', JH: 'bjp', PB: 'inc', CT: 'bjp', HR: 'bjp', DL: 'bjp', JK: 'nc', UT: 'bjp', HP: 'bjp', AR: 'bjp', GA: 'bjp', MN: 'inc', ML: 'oth', TR: 'bjp', DH: 'bjp', AN: 'bjp', CH: 'inc', LA: 'ind', LD: 'inc', MZ: 'oth', NL: 'inc', PY: 'inc', SK: 'oth' }
    }]
  },
  JP: {
    name: 'Japan', subtitle: 'National Diet elections',
    parties: {
      ldp: p('Liberal Democratic Party', '#3CA324'), cdp: p('Constitutional Democratic Party', '#184589'), ishin: p('Nippon Ishin', '#B8C21C'),
      dpfp: p('Democratic Party for the People', '#F8BC00'), komeito: p('Komeito', '#F55881'), reiwa: p('Reiwa Shinsengumi', '#E4007F'),
      jcp: p('Japanese Communist Party', '#DB001C'), sanseito: p('Sanseito', '#D85D0F'), cpj: p('Conservative Party of Japan', '#0A82DC'),
      mirai: p('Team Mirai', '#84E6D5'), sdp: p('Social Democratic Party', '#3D9BE7'), nhk: p('NHK Party', '#F8EA0D'), ind: p('Independents', '#8E8E93'),
      cra: p('Centrist Reform Alliance', '#0073BD'), taxcuts: p('Tax Cuts Japan and Yukoku Alliance', '#18378A'), oth: p('Others', '#B8B8BD')
    },
    elections: [{
      id: 'jp-representatives-2026', office: 'House of Representatives', kind: 'legislative', date: '2026-02-08', status: 'final', reporting: 100, turnout: 56.3,
      system: '465 seats: 289 districts and 176 proportional', totalSeats: 465, majority: 233, seatLabel: 'Seats',
      cite: { name: 'the Ministry of Internal Affairs and Communications', url: 'https://en.wikipedia.org/wiki/2026_Japanese_general_election' },
      // Preliminary count. Proportional-block votes; independents ran only in districts.
      // The Centrist Reform Alliance's change compares with the CDP and Komeito's 2024 seats.
      candidates: [
        c('Liberal Democratic Party', 'ldp', 36.7, 316, { votes: 21026139, change: 125, winner: true }), c('Centrist Reform Alliance', 'cra', 18.2, 49, { votes: 10438801, change: -123 }),
        c('Nippon Ishin', 'ishin', 8.6, 36, { votes: 4943330, change: -2 }), c('Democratic Party for the People', 'dpfp', 9.7, 28, { votes: 5572951, change: 0 }),
        c('Sanseito', 'sanseito', 7.4, 15, { votes: 4260620, change: 12 }), c('Team Mirai', 'mirai', 6.7, 11, { votes: 3813749 }),
        c('Japanese Communist Party', 'jcp', 4.4, 4, { votes: 2519807, change: -4 }), c('Independents', 'ind', null, 4, { change: -8 }),
        c('Reiwa Shinsengumi', 'reiwa', 2.9, 1, { votes: 1672499, change: -8 }), c('Tax Cuts Japan and Yukoku Alliance', 'taxcuts', 1.4, 1, { votes: 814874 }),
        c('Conservative Party of Japan', 'cpj', 2.5, 0, { votes: 1455563, change: -3 }), c('Social Democratic Party', 'sdp', 1.3, 0, { votes: 728602, change: -1 }),
        c('Others', 'oth', 0, 0, { votes: 13014 })
      ],
      winners: { '27': 'ishin' }, defaultWinner: 'ldp'
    }, {
      id: 'jp-councillors-2025', office: 'House of Councillors', kind: 'legislative', date: '2025-07-20', status: 'final', reporting: 100, turnout: 58.5,
      cite: { name: 'the Ministry of Internal Affairs and Communications', url: 'https://en.wikipedia.org/wiki/2025_Japanese_House_of_Councillors_election' },
      system: '248 seats · 125 contested, half every three years', totalSeats: 248, majority: 125, seatLabel: 'Seats',
      // National proportional vote. Independents stand only in prefecture races, so they have seats but no list vote.
      candidates: [
        c('Liberal Democratic Party', 'ldp', 21.6, 101, { votes: 12808307, change: -13, winner: true }), c('Constitutional Democratic Party', 'cdp', 12.5, 38, { votes: 7397456, change: 0 }),
        c('Democratic Party for the People', 'dpfp', 12.9, 22, { votes: 7620493, change: 13 }), c('Komeito', 'komeito', 8.8, 21, { votes: 5210569, change: -6 }),
        c('Nippon Ishin', 'ishin', 7.4, 19, { votes: 4375927, change: 1 }), c('Sanseito', 'sanseito', 12.5, 15, { votes: 7425054, change: 14 }),
        c('Independents', 'ind', null, 13, { change: 1 }), c('Japanese Communist Party', 'jcp', 4.8, 7, { votes: 2864738, change: -4 }),
        c('Reiwa Shinsengumi', 'reiwa', 6.6, 6, { votes: 3879914, change: 1 }), c('Conservative Party of Japan', 'cpj', 5, 2, { votes: 2982093, change: 2 }),
        c('Social Democratic Party', 'sdp', 2.1, 2, { votes: 1217823, change: 0 }), c('Team Mirai', 'mirai', 2.6, 1, { votes: 1517890, change: 1 }),
        c('NHK Party', 'nhk', 1.2, 1, { votes: 682626, change: -1 }), c('Others', 'oth', 2, 0, { votes: 1202505, change: 0 })
      ],
      defaultWinner: 'ldp', winners: { '13': 'sanseito', '27': 'ishin', '01': 'cdp' }
    }]
  },
  MX: {
    name: 'Mexico', subtitle: 'Federal elections',
    parties: {
      morena: p('Morena', '#A50021'), pan: p('PAN', '#0055A5'), pri: p('PRI', '#00A651'), pvem: p('Green Party', '#8DC63F'),
      pt: p("Labor Party", '#C9A227'), mc: p('Citizens’ Movement', '#FF8300'), prd: p('PRD', '#F5D000'), ind: p('Independents', '#8E8E93'), oth: p('Others', '#B8B8BD')
    },
    elections: [{
      id: 'mx-president-2024', office: 'President', kind: 'presidential', date: '2024-06-02', status: 'final', reporting: 100, turnout: 61.05,
      cite: { name: 'the National Electoral Institute (INE)', url: 'https://en.wikipedia.org/wiki/2024_Mexican_general_election' },
      statesFrom: 'https://en.wikipedia.org/wiki/2024_Mexican_general_election',
      system: 'Single-round popular vote, six-year term',
      candidates: [
        c('Claudia Sheinbaum', 'morena', 61.18, null, { votes: 35924519, winner: true }),
        c('Xóchitl Gálvez', 'pan', 28.11, null, { votes: 16502697 }),
        c('Jorge Máynez', 'mc', 10.57, null, { votes: 6204710 }),
        c('Others', 'oth', 0.14, null, { votes: 83114 })
      ],
      defaultWinner: 'morena', winners: { 'AGU': 'pan', 'BCN': 'morena', 'BCS': 'morena', 'CAM': 'morena', 'COA': 'morena', 'COL': 'morena', 'CHP': 'morena', 'CHH': 'morena', 'DIF': 'morena', 'DUR': 'morena', 'GUA': 'morena', 'GRO': 'morena', 'HID': 'morena', 'JAL': 'morena', 'MEX': 'morena', 'MIC': 'morena', 'MOR': 'morena', 'NAY': 'morena', 'NLE': 'morena', 'OAX': 'morena', 'PUE': 'morena', 'QUE': 'morena', 'ROO': 'morena', 'SLP': 'morena', 'SIN': 'morena', 'SON': 'morena', 'TAB': 'morena', 'TAM': 'morena', 'TLA': 'morena', 'VER': 'morena', 'YUC': 'morena', 'ZAC': 'morena' }
    }, {
      id: 'mx-chamber-2024', office: 'Chamber of Deputies', kind: 'legislative', date: '2024-06-02', status: 'final', reporting: 100, turnout: 61.0,
      cite: { name: 'the National Electoral Institute (INE)', url: 'https://en.wikipedia.org/wiki/2024_Mexican_general_election' },
      system: '500 seats: 300 districts and 200 proportional', totalSeats: 500, majority: 251, seatLabel: 'Seats',
      candidates: [
        c('Morena', 'morena', 42.4, 236, { votes: 24286317, change: 38, winner: true }),
        c('Ecologist Green Party of Mexico', 'pvem', 8.72, 77, { votes: 4993988, change: 34 }),
        c('National Action Party', 'pan', 17.55, 72, { votes: 10049375, change: -42 }),
        c('Labor Party', 'pt', 5.68, 51, { votes: 3254718, change: 14 }),
        c('Institutional Revolutionary Party', 'pri', 11.56, 35, { votes: 6623796, change: -35 }),
        c('Citizens\' Movement', 'mc', 11.34, 27, { votes: 6497404, change: 4 }),
        c('Party of the Democratic Revolution', 'prd', 2.53, 1, { votes: 1449660, change: -14 }),
        c('Independents', 'ind', 0.13, 1, { votes: 72012, change: 1 }),
        c('Others', 'oth', 0.09, 0, { votes: 49329, change: 0 })
      ],
      defaultWinner: 'morena', winners: { AGU: 'pan', GUA: 'pan', QUE: 'pan', CHH: 'pan' }
    }, {
      id: 'mx-senate-2024', office: 'Senate', kind: 'legislative', date: '2024-06-02', status: 'final', reporting: 100,
      cite: { name: 'the National Electoral Institute (INE)', url: 'https://en.wikipedia.org/wiki/2024_Mexican_general_election' },
      statesFrom: 'https://en.wikipedia.org/wiki/2024_Mexican_Senate_election',
      system: '128 seats: three per state and 32 proportional', totalSeats: 128, majority: 65, seatLabel: 'Seats',
      candidates: [
        c('Morena', 'morena', 42.48, 60, { votes: 24484943, change: 5, winner: true }),
        c('National Action Party', 'pan', 17.54, 22, { votes: 10107537, change: -1 }),
        c('Institutional Revolutionary Party', 'pri', 11.33, 16, { votes: 6530305, change: 2 }),
        c('Ecologist Green Party of Mexico', 'pvem', 9.3, 14, { votes: 5357959, change: 8 }),
        c('Labor Party', 'pt', 5.58, 9, { votes: 3214708, change: 3 }),
        c('Citizens\' Movement', 'mc', 11.33, 5, { votes: 6528238, change: -2 }),
        c('Party of the Democratic Revolution', 'prd', 2.36, 2, { votes: 1363012, change: -6 }),
        c('Others', 'oth', 0.08, 0, { votes: 47092, change: 0 })
      ],
      defaultWinner: 'morena', winners: { 'AGU': 'pan', 'BCN': 'morena', 'BCS': 'morena', 'CAM': 'morena', 'CHP': 'morena', 'CHH': 'morena', 'DIF': 'morena', 'COA': 'morena', 'COL': 'morena', 'DUR': 'morena', 'GUA': 'morena', 'GRO': 'morena', 'HID': 'morena', 'JAL': 'morena', 'MEX': 'morena', 'MIC': 'morena', 'MOR': 'morena', 'NAY': 'morena', 'NLE': 'morena', 'OAX': 'morena', 'PUE': 'morena', 'QUE': 'pan', 'ROO': 'morena', 'SLP': 'pvem', 'SIN': 'morena', 'SON': 'morena', 'TAB': 'morena', 'TAM': 'morena', 'TLA': 'morena', 'VER': 'morena', 'YUC': 'morena', 'ZAC': 'morena' }
    }]
  },
  IT: {
    name: 'Italy', subtitle: 'General elections',
    parties: {
      fdi: p("Brothers of Italy", '#03386A'), pd: p('Democratic Party', '#EF1C27'), lega: p('Lega', '#1D7F2E'), m5s: p('Five Star Movement', '#E8C800'),
      fi: p('Forza Italia', '#0087DC'), az: p('Action–Italia Viva', '#9370DB'), avs: p('Greens and Left', '#8FBC3F'), nm: p('Us Moderates', '#4682B4'),
      pe: p('+Europa', '#FFD700'), svp: p('SVP', '#231F20'), ic: p('Civic Commitment', '#1E889D'), scn: p('South calls North', '#F2AB14'),
      vda: p('Aosta Valley', '#48D1CC'), cb: p('Campobase', '#96BF0D'), maie: p('MAIE', '#333B8E'), italexit: p('Italexit', '#366A9F'),
      up: p("People's Union", '#71256A'), isp: p('Sovereign and Popular Italy', '#B04E4E'), oth: p('Others', '#B8B8BD')
    },
    // Ministry of the Interior. Votes and shares are the national proportional vote; Aosta Valley's
    // single seat, the South Tyrolean Senate seats and the overseas seats have no row in it.
    elections: [{
      id: 'it-chamber-2022', office: 'Chamber of Deputies', kind: 'legislative', date: '2022-09-25', status: 'final', reporting: 100, turnout: 63.9,
      cite: { name: 'the Ministry of the Interior', url: 'https://en.wikipedia.org/wiki/2022_Italian_general_election' },
      system: '400 seats: 147 districts and 253 proportional', totalSeats: 400, majority: 201, seatLabel: 'Seats',
      candidates: [
        c('Brothers of Italy', 'fdi', 26, 119, { votes: 7302517, change: 87, winner: true }), c('Democratic Party', 'pd', 19.1, 69, { votes: 5356180, change: -43 }),
        c('Lega', 'lega', 8.8, 66, { votes: 2464005, change: -59 }), c('Five Star Movement', 'm5s', 15.4, 52, { votes: 4333972, change: -175 }),
        c('Forza Italia', 'fi', 8.1, 45, { votes: 2278217, change: -59 }), c('Action–Italia Viva', 'az', 7.8, 21, { votes: 2186669, change: 21 }),
        c('Greens and Left', 'avs', 3.6, 12, { votes: 1018669, change: 12 }), c('Us Moderates', 'nm', 0.9, 7, { votes: 255505, change: 7 }),
        c('SVP', 'svp', 0.4, 3, { votes: 117010, change: -1 }), c('+Europa', 'pe', 2.8, 2, { votes: 793961, change: -1 }),
        c('South calls North', 'scn', 0.8, 1, { votes: 212685, change: 1 }), c('Civic Commitment', 'ic', 0.6, 1, { votes: 169165, change: 1 }),
        c('Aosta Valley', 'vda', null, 1, {}), c('MAIE', 'maie', null, 1, { change: 0 }),
        c('Italexit', 'italexit', 1.9, 0, { votes: 534950 }), c("People's Union", 'up', 1.4, 0, { votes: 403149 }),
        c('Sovereign and Popular Italy', 'isp', 1.2, 0, { votes: 348831 }), c('Others', 'oth', 1.1, 0, { votes: 312297 })
      ],
      defaultWinner: 'fdi', winners: { CAM: 'm5s', EMR: 'pd', TOS: 'pd', TAA: 'svp', VDA: 'vda' }
    }, {
      id: 'it-senate-2022', office: 'Senate', kind: 'legislative', date: '2022-09-25', status: 'final', reporting: 100, turnout: 63.8,
      cite: { name: 'the Ministry of the Interior', url: 'https://en.wikipedia.org/wiki/2022_Italian_general_election' },
      system: '200 elected seats: 74 districts and 126 proportional', totalSeats: 200, majority: 101, seatLabel: 'Seats',
      candidates: [
        c('Brothers of Italy', 'fdi', 26, 65, { votes: 7167136, change: 47, winner: true }), c('Democratic Party', 'pd', 19, 39, { votes: 5226732, change: -14 }),
        c('Lega', 'lega', 8.8, 29, { votes: 2439200, change: -29 }), c('Five Star Movement', 'm5s', 15.5, 28, { votes: 4285894, change: -84 }),
        c('Forza Italia', 'fi', 8.3, 18, { votes: 2279802, change: -39 }), c('Action–Italia Viva', 'az', 7.7, 9, { votes: 2131310, change: 9 }),
        c('Greens and Left', 'avs', 3.5, 4, { votes: 972316, change: 4 }), c('Us Moderates', 'nm', 0.9, 3, { votes: 243409, change: 3 }),
        c('SVP', 'svp', null, 2, { change: -1 }), c('South calls North', 'scn', 1, 1, { votes: 271549, change: 1 }),
        c('Campobase', 'cb', null, 1, { change: 1 }), c('MAIE', 'maie', null, 1, { change: 0 }),
        c('+Europa', 'pe', 2.9, 0, { votes: 810441, change: -1 }), c('Italexit', 'italexit', 1.9, 0, { votes: 515657 }),
        c("People's Union", 'up', 1.4, 0, { votes: 374247 }), c('Sovereign and Popular Italy', 'isp', 1.1, 0, { votes: 309391 }),
        c('Others', 'oth', 2, 0, { votes: 542591 })
      ],
      defaultWinner: 'fdi', winners: { CAM: 'm5s', EMR: 'pd', TOS: 'pd', TAA: 'svp', VDA: 'lega' }
    }]
  },
  KR: {
    name: 'South Korea', subtitle: 'National elections',
    parties: {
      dp: p('Democratic Party', '#152484'), ppp: p('People Power Party', '#E61E2B'), rkp: p('Rebuilding Korea Party', '#3FA9F5'),
      reform: p('Reform Party', '#FF7210'), prog: p('Progressive Party', '#7D3C98'), bip: p('Basic Income Party', '#B8860B'), ind: p('Independents', '#8E8E93'), nfp: p('New Future Party', '#45BABD'), lup: p('Liberal Unification Party', '#080B9E'), jp: p('Justice Party', '#FFCC00'), oth: p('Others', '#B8B8BD')
    },
    elections: [{
      id: 'kr-president-2025', office: 'President', kind: 'presidential', date: '2025-06-03', status: 'final', reporting: 100, turnout: 79.38,
      cite: { name: 'the National Election Commission', url: 'https://en.wikipedia.org/wiki/2025_South_Korean_presidential_election' },
      statesFrom: 'https://en.wikipedia.org/wiki/2025_South_Korean_presidential_election',
      system: 'Single-round popular vote, five-year term',
      candidates: [
        c('Lee Jae Myung', 'dp', 49.42, null, { votes: 17287513, winner: true }),
        c('Kim Moon-soo', 'ppp', 41.15, null, { votes: 14395639 }),
        c('Lee Jun-seok', 'reform', 8.34, null, { votes: 2917523 }),
        c('Others', 'oth', 1.09, null, { votes: 379941 })
      ],
      winners: { '11': 'dp', '26': 'ppp', '27': 'ppp', '28': 'dp', '29': 'dp', '30': 'dp', '31': 'ppp', '41': 'dp', '42': 'ppp', '43': 'dp', '44': 'dp', '45': 'dp', '46': 'dp', '47': 'ppp', '48': 'ppp', '49': 'dp', '50': 'dp' }
    }, {
      id: 'kr-assembly-2024', office: 'National Assembly', kind: 'legislative', date: '2024-04-10', status: 'final', reporting: 100, turnout: 66.97,
      cite: { name: 'the National Election Commission, KBS and Daum', url: 'https://en.wikipedia.org/wiki/2024_South_Korean_legislative_election' },
      statesFrom: 'https://en.wikipedia.org/wiki/2024_South_Korean_legislative_election',
      system: '300 seats: 254 districts and 46 proportional', totalSeats: 300, majority: 151, seatLabel: 'Seats',
      candidates: [
        c('Democratic Party / Democratic Alliance', 'dp', 26.7, 169, { votes: 7567459, winner: true }),
        c('People Power Party / People Future Party', 'ppp', 36.67, 108, { votes: 10395264 }),
        c('Rebuilding Korea Party', 'rkp', 24.25, 12, { votes: 6874278 }),
        c('Reform Party', 'reform', 3.62, 3, { votes: 1025775 }),
        c('Progressive Party', 'prog', null, 3),
        c('New Progressive Alliance', 'bip', null, 2),
        c('Independents', 'ind', null, 2),
        c('New Future Party', 'nfp', 1.71, 1, { votes: 483827 }),
        c('Liberal Unification Party', 'lup', 2.27, 0, { votes: 642433 }),
        c('Green–Justice Party', 'jp', 2.15, 0, { votes: 609313 }),
        c('Others', 'oth', 2.63, 0, { votes: 746170 })
      ],
      winners: { '11': 'dp', '26': 'ppp', '27': 'ppp', '28': 'dp', '29': 'dp', '30': 'dp', '31': 'ppp', '41': 'dp', '42': 'ppp', '43': 'dp', '44': 'dp', '45': 'dp', '46': 'dp', '47': 'ppp', '48': 'ppp', '49': 'dp', '50': 'nfp' }
    }]
  },
  ID: {
    name: 'Indonesia', subtitle: 'General elections',
    parties: {
      gerindra: p('Gerindra', '#7D2027'), pdip: p('PDI-P', '#E3001B'), golkar: p('Golkar', '#F2C200'), nasdem: p('NasDem', '#1E3A8A'),
      pkb: p('PKB', '#00843D'), pks: p('PKS', '#FF6600'), pan: p('PAN', '#0F67B1'), demokrat: p('Demokrat', '#4E9BD5'),
      ppp: p('PPP', '#00A100'), psi: p('PSI', '#E6212A'), perindo: p('Perindo', '#2F318B'), oth: p('Others', '#B8B8BD')
    },
    elections: [{
      id: 'id-president-2024', office: 'President', kind: 'presidential', date: '2024-02-14', status: 'final', reporting: 100, turnout: 81.8,
      cite: { name: 'the General Elections Commission', url: 'https://en.wikipedia.org/wiki/2024_Indonesian_presidential_election' },
      system: 'Popular vote, run-off if no majority with 20% in half the provinces',
      candidates: [
        c('Prabowo Subianto', 'gerindra', 58.6, null, { votes: 96214691, winner: true }), c('Anies Baswedan', 'nasdem', 24.9, null, { votes: 40971906 }),
        c('Ganjar Pranowo', 'pdip', 16.5, null, { votes: 27040878 })
      ],
      defaultWinner: 'gerindra', winners: { AC: 'nasdem', SB: 'nasdem' }
    }, {
      id: 'id-dpr-2024', office: 'House of Representatives', kind: 'legislative', date: '2024-02-14', status: 'final', reporting: 100, turnout: 81.4,
      cite: { name: 'the General Elections Commission', url: 'https://en.wikipedia.org/wiki/2024_Indonesian_general_election' },
      system: '580 seats, open-list proportional with a 4% threshold', totalSeats: 580, majority: 291, seatLabel: 'Seats',
      // General Elections Commission. PPP, PSI and Perindo fell short of the 4% threshold.
      candidates: [
        c('PDI-P', 'pdip', 16.7, 110, { votes: 25384673, change: -18, winner: true }), c('Golkar', 'golkar', 15.3, 102, { votes: 23208488, change: 17 }),
        c('Gerindra', 'gerindra', 13.2, 86, { votes: 20071345, change: 8 }), c('NasDem', 'nasdem', 9.7, 69, { votes: 14660328, change: 10 }),
        c('PKB', 'pkb', 10.6, 68, { votes: 16115358, change: 10 }), c('PKS', 'pks', 8.4, 53, { votes: 12781241, change: 3 }),
        c('PAN', 'pan', 7.2, 48, { votes: 10984639, change: 4 }), c('Demokrat', 'demokrat', 7.4, 44, { votes: 11283053, change: -10 }),
        c('PPP', 'ppp', 3.9, 0, { votes: 5878708, change: -19 }), c('PSI', 'psi', 2.8, 0, { votes: 4260108, change: 0 }),
        c('Perindo', 'perindo', 1.3, 0, { votes: 1955131, change: 0 }), c('Others', 'oth', 3.4, 0, { votes: 5210221, change: 0 })
      ]
    }]
  },
  ZA: {
    name: 'South Africa', subtitle: 'National elections',
    parties: {
      anc: p('African National Congress', '#007A3D'), da: p('Democratic Alliance', '#005BA6'), mk: p('uMkhonto weSizwe', '#2F2F2F'),
      eff: p('Economic Freedom Fighters', '#C8102E'), ifp: p('Inkatha Freedom Party', '#E1A400'), pa: p('Patriotic Alliance', '#7A3E9D'),
      ffp: p('Freedom Front Plus', '#F28C28'), actionsa: p('ActionSA', '#00A0B0'), acdp: p('African Christian Democratic Party', '#BA0C2F'),
      udm: p('United Democratic Movement', '#FFB300'), rise: p('Rise Mzansi', '#0336D8'), bosa: p('Build One South Africa', '#E7B04A'),
      atm: p('African Transformation Movement', '#00ADEE'), aljamaah: p('Al Jama-ah', '#1C9069'), ncc: p('National Coloured Congress', '#161616'),
      pac: p('Pan Africanist Congress', '#008718'), uat: p('United Africans Transformation', '#363362'), good: p('GOOD', '#F36900'), oth: p('Others', '#B8B8BD')
    },
    elections: [{
      id: 'za-assembly-2024', office: 'National Assembly', kind: 'legislative', date: '2024-05-29', status: 'final', reporting: 100, turnout: 58.6,
      cite: { name: 'the Electoral Commission', url: 'https://en.wikipedia.org/wiki/2024_South_African_general_election' },
      system: '400 seats, closed-list proportional', totalSeats: 400, majority: 201, seatLabel: 'Seats',
      // Electoral Commission of South Africa; votes are the national ballot.
      candidates: [
        c('African National Congress', 'anc', 40.2, 159, { votes: 6459683, change: -71, winner: true }), c('Democratic Alliance', 'da', 21.8, 87, { votes: 3505735, change: 3 }),
        c('uMkhonto weSizwe', 'mk', 14.6, 58, { votes: 2344309, change: 58 }), c('Economic Freedom Fighters', 'eff', 9.5, 39, { votes: 1529961, change: -5 }),
        c('Inkatha Freedom Party', 'ifp', 3.8, 17, { votes: 618207, change: 3 }), c('Patriotic Alliance', 'pa', 2.1, 9, { votes: 330425, change: 9 }),
        c('Freedom Front Plus', 'ffp', 1.4, 6, { votes: 218850, change: -4 }), c('ActionSA', 'actionsa', 1.2, 6, { votes: 192373, change: 6 }),
        c('African Christian Democratic Party', 'acdp', 0.6, 3, { votes: 96575, change: -1 }), c('United Democratic Movement', 'udm', 0.5, 3, { votes: 78448, change: 1 }),
        c('Rise Mzansi', 'rise', 0.4, 2, { votes: 67975, change: 2 }), c('Build One South Africa', 'bosa', 0.4, 2, { votes: 65912, change: 2 }),
        c('African Transformation Movement', 'atm', 0.4, 2, { votes: 63554, change: 0 }), c('Al Jama-ah', 'aljamaah', 0.2, 2, { votes: 39067, change: 1 }),
        c('National Coloured Congress', 'ncc', 0.2, 2, { votes: 37422, change: 2 }), c('Pan Africanist Congress', 'pac', 0.2, 1, { votes: 36716, change: 0 }),
        c('United Africans Transformation', 'uat', 0.2, 1, { votes: 35679, change: 1 }), c('GOOD', 'good', 0.2, 1, { votes: 29501, change: -1 }),
        c('Others', 'oth', 2, 0, { votes: 326327, change: -6 })
      ],
      defaultWinner: 'anc', winners: { WC: 'da', NL: 'mk' }
    }]
  },
  TR: {
    name: 'Türkiye', subtitle: 'National elections',
    parties: {
      akp: p('AK Party', '#F7941D'), chp: p('CHP', '#ED1C24'), dem: p('DEM Party', '#8E44AD'), mhp: p('MHP', '#870000'), iyi: p('İYİ Party', '#3BB9FF'),
      yrp: p('New Welfare Party', '#1F7F3F'), tip: p('Workers’ Party', '#B0122D'), ata: p('ATA Alliance', '#7F8C8D'), mp: p('Homeland Party', '#1ABC9C'),
      zp: p('Victory Party', '#373736'), oth: p('Others', '#B8B8BD')
    },
    elections: [{
      id: 'tr-president-2023', office: 'President', kind: 'presidential', date: '2023-05-28', status: 'final', reporting: 100, turnout: 84.2,
      cite: { name: 'the Supreme Election Council', url: 'https://en.wikipedia.org/wiki/2023_Turkish_presidential_election' },
      system: 'Two-round popular vote',
      candidates: [c('Recep Tayyip Erdoğan', 'akp', 52.2, null, { votes: 27834589, winner: true }), c('Kemal Kılıçdaroğlu', 'chp', 47.8, null, { votes: 25504724 })],
      rounds: [
        { label: 'First round', date: '2023-05-14', candidates: [
          c('Recep Tayyip Erdoğan', 'akp', 49.5, null, { votes: 27133849 }), c('Kemal Kılıçdaroğlu', 'chp', 44.9, null, { votes: 24595178 }),
          c('Sinan Oğan', 'ata', 5.2, null, { votes: 2831239 }), c('Muharrem İnce', 'mp', 0.4, null, { votes: 235783 })
        ] },
        { label: 'Run-off', date: '2023-05-28', candidates: [
          c('Recep Tayyip Erdoğan', 'akp', 52.2, null, { votes: 27834589, winner: true }), c('Kemal Kılıçdaroğlu', 'chp', 47.8, null, { votes: 25504724 })
        ] }
      ],
      defaultWinner: 'akp',
      winners: Object.fromEntries(['35', '09', '48', '22', '39', '59', '17', '26', '06', '34', '33', '21', '47', '72', '56', '73', '30', '65', '49', '76', '04', '62', '13', '75', '36'].map(x => [x, 'chp']))
    }, {
      id: 'tr-assembly-2023', office: 'Grand National Assembly', kind: 'legislative', date: '2023-05-14', status: 'final', reporting: 100, turnout: 87.0,
      cite: { name: 'the Supreme Election Council', url: 'https://en.wikipedia.org/wiki/2023_Turkish_parliamentary_election' },
      system: '600 seats, proportional by province with a 7% threshold', totalSeats: 600, majority: 301, seatLabel: 'Seats',
      // Supreme Election Council. The DEM Party ran in 2023 as the Green Left Party.
      candidates: [
        c('AK Party', 'akp', 35.6, 268, { votes: 19187170, change: -27, winner: true }), c('CHP', 'chp', 25.3, 169, { votes: 13675902, change: 23 }),
        c('DEM Party', 'dem', 8.9, 61, { votes: 4800607, change: -4 }), c('MHP', 'mhp', 10, 50, { votes: 5421800, change: 1 }),
        c('İYİ Party', 'iyi', 9.7, 43, { votes: 5225196, change: 0 }), c('New Welfare Party', 'yrp', 2.8, 5, { votes: 1510745, change: 5 }),
        c('Workers’ Party', 'tip', 1.8, 4, { votes: 954547, change: 2 }), c('Victory Party', 'zp', 2.2, 0, { votes: 1211917 }),
        c('Others', 'oth', 3.7, 0, { votes: 1974886, change: -1 })
      ],
      defaultWinner: 'akp',
      winners: { ...Object.fromEntries(['35', '09', '48', '22', '39', '59', '17', '26', '34'].map(x => [x, 'chp'])), ...Object.fromEntries(['21', '47', '72', '56', '73', '30', '65', '49', '76', '04', '62'].map(x => [x, 'dem'])) }
    }]
  },
  PL: {
    name: 'Poland', subtitle: 'National elections',
    parties: {
      pis: p('Law and Justice', '#263778'), ko: p('Civic Coalition', '#F68F2D'), td: p('Third Way', '#B5C72E'), lewica: p('The Left', '#D40000'),
      konf: p('Confederation', '#A0743E'), kkp: p('Confederation of the Polish Crown', '#5B3A29'), razem: p('Together', '#870F57'), ind: p('Independents', '#DCDCDC'), bs: p('Nonpartisan Local Government Activists', '#8B008B'), jjp: p('There is One Poland', '#0054A5'), spind: p('Independents (Senate Pact)', '#6CA0DC'), stanowski: p('Independent', '#6B6B6B'), senyszyn: p('Independent (SLD)', '#E75480'), oth: p('Others', '#B8B8BD')
    },
    elections: [{
      id: 'pl-president-2025', office: 'President', kind: 'presidential', date: '2025-06-01', status: 'final', reporting: 100, turnout: 71.63,
      cite: { name: 'the National Electoral Commission', url: 'https://en.wikipedia.org/wiki/2025_Polish_presidential_election' },
      statesFrom: 'https://en.wikipedia.org/wiki/2025_Polish_presidential_election#By_voivodeship,_abroad_and_ships',
      system: 'Two-round popular vote, five-year term',
      candidates: [
        c('Karol Nawrocki', 'pis', 50.89, null, { votes: 10606877, winner: true }),
        c('Rafał Trzaskowski', 'ko', 49.11, null, { votes: 10237286 })
      ],
      rounds: [
        { label: 'First round', date: '2025-05-18', candidates: [
          c('Rafał Trzaskowski', 'ko', 31.36, null, { votes: 6147797 }),
          c('Karol Nawrocki', 'pis', 29.54, null, { votes: 5790804 }),
          c('Sławomir Mentzen', 'konf', 14.81, null, { votes: 2902448 }),
          c('Grzegorz Braun', 'kkp', 6.34, null, { votes: 1242917 }),
          c('Szymon Hołownia', 'td', 4.99, null, { votes: 978901 }),
          c('Adrian Zandberg', 'razem', 4.86, null, { votes: 952832 }),
          c('Magdalena Biejat', 'lewica', 4.23, null, { votes: 829361 }),
          c('Krzysztof Stanowski', 'stanowski', 1.24, null, { votes: 243479 }),
          c('Joanna Senyszyn', 'senyszyn', 1.09, null, { votes: 214198 }),
          c('Others', 'oth', 1.54, null, { votes: 301047 })
        ] },
        { label: 'Run-off', date: '2025-06-01', candidates: [
          c('Karol Nawrocki', 'pis', 50.89, null, { votes: 10606877, winner: true }),
          c('Rafał Trzaskowski', 'ko', 49.11, null, { votes: 10237286 })
        ] }
      ],
      winners: { 'DS': 'ko', 'KP': 'ko', 'LU': 'pis', 'LB': 'ko', 'LD': 'pis', 'MA': 'pis', 'MZ': 'ko', 'OP': 'ko', 'PK': 'pis', 'PD': 'pis', 'PM': 'ko', 'SL': 'ko', 'SK': 'pis', 'WN': 'ko', 'WP': 'ko', 'ZP': 'ko' }
    }, {
      id: 'pl-sejm-2023', office: 'Sejm', kind: 'legislative', date: '2023-10-15', status: 'final', reporting: 100, turnout: 74.38,
      cite: { name: 'the National Electoral Commission', url: 'https://en.wikipedia.org/wiki/2023_Polish_parliamentary_election' },
      system: '460 seats, open-list proportional with D’Hondt', totalSeats: 460, majority: 231, seatLabel: 'Seats',
      candidates: [
        c('United Right', 'pis', 35.38, 194, { votes: 7640854, change: -41, winner: true }),
        c('Civic Coalition', 'ko', 30.7, 157, { votes: 6629402, change: 23 }),
        c('Third Way', 'td', 14.4, 65, { votes: 3110670, change: 35 }),
        c('The Left', 'lewica', 8.61, 26, { votes: 1859018, change: -23 }),
        c('Confederation Liberty and Independence', 'konf', 7.16, 18, { votes: 1547364, change: 7 }),
        c('Nonpartisan Local Government Activists', 'bs', 1.86, 0, { votes: 401054, change: 0 }),
        c('There is One Poland', 'jjp', 1.63, 0, { votes: 351099 }),
        c('Others', 'oth', 0.26, 0, { votes: 57213, change: -1 })
      ],
      winners: { LU: 'pis', PK: 'pis', MA: 'pis', SK: 'pis', LD: 'pis', PD: 'pis', MZ: 'pis', SL: 'pis', PM: 'ko', ZP: 'ko', LB: 'ko', DS: 'ko', WP: 'ko', KP: 'ko', WN: 'ko', OP: 'ko' }
    }, {
      id: 'pl-senate-2023', office: 'Senate', kind: 'legislative', date: '2023-10-15', status: 'final', reporting: 100, turnout: 74.31,
      cite: { name: 'the National Electoral Commission', url: 'https://en.wikipedia.org/wiki/2023_Polish_parliamentary_election' },
      system: '100 single-member districts, first past the post', totalSeats: 100, majority: 51, seatLabel: 'Seats',
      candidates: [
        c('Civic Coalition', 'ko', 28.91, 41, { votes: 6187295, change: -2, winner: true }),
        c('Law and Justice', 'pis', 34.81, 34, { votes: 7449875, change: -14 }),
        c('Third Way', 'td', 11.5, 11, { votes: 2462360, change: 8 }),
        c('The Left', 'lewica', 5.29, 9, { votes: 1131639, change: 7 }),
        c('Independents', 'spind', 2.68, 4, { votes: 573060 }),
        c('Independents and other committees with a single candidate', 'ind', 2.53, 1, { votes: 540974, change: -3 }),
        c('Confederation Liberty and Independence', 'konf', 6.75, 0, { votes: 1443836, change: 0 }),
        c('Nonpartisan Local Government Activists', 'bs', 4.91, 0, { votes: 1049919, change: 0 }),
        c('Others', 'oth', 2.64, 0, { votes: 564040, change: 0 })
      ]
    }]
  },
  NL: {
    name: 'Netherlands', subtitle: 'General elections',
    parties: {
      d66: p('D66', '#4AB83B'), pvv: p('PVV', '#002759'), vvd: p('VVD', '#FF7709'), glpvda: p('GroenLinks–PvdA', '#E3101B'),
      cda: p('CDA', '#00825D'), ja21: p('JA21', '#1B9BD8'), fvd: p('Forum for Democracy', '#8B2131'), bbb: p('BBB', '#95C11F'),
      denk: p('DENK', '#00B7B2'), sgp: p('SGP', '#EA5B0B'), pvdd: p('Party for the Animals', '#006B2D'), cu: p('ChristenUnie', '#00A7EB'),
      sp: p('Socialist Party', '#F60000'), p50: p('50PLUS', '#92107D'), volt: p('Volt', '#502379'), nsc: p('NSC', '#F0C400'), oth: p('Others', '#B8B8BD')
    },
    elections: [{
      id: 'nl-house-2025', office: 'House of Representatives', kind: 'legislative', date: '2025-10-29', status: 'final', reporting: 100, turnout: 78.4,
      cite: { name: 'the Electoral Council', url: 'https://en.wikipedia.org/wiki/2025_Dutch_general_election' },
      system: '150 seats, nationwide list proportional', totalSeats: 150, majority: 76, seatLabel: 'Seats',
      // Electoral Council. NSC kept here for losing all 20 of its seats.
      candidates: [
        c('D66', 'd66', 16.9, 26, { votes: 1790634, change: 17, winner: true }), c('PVV', 'pvv', 16.7, 26, { votes: 1760966, change: -11 }),
        c('VVD', 'vvd', 14.2, 22, { votes: 1505829, change: -2 }), c('GroenLinks–PvdA', 'glpvda', 12.8, 20, { votes: 1352163, change: -5 }),
        c('CDA', 'cda', 11.8, 18, { votes: 1246874, change: 13 }), c('JA21', 'ja21', 5.9, 9, { votes: 628517, change: 8 }),
        c('Forum for Democracy', 'fvd', 4.5, 7, { votes: 480393, change: 4 }), c('BBB', 'bbb', 2.6, 4, { votes: 279916, change: -3 }),
        c('DENK', 'denk', 2.4, 3, { votes: 250368, change: 0 }), c('SGP', 'sgp', 2.3, 3, { votes: 238093, change: 0 }),
        c('Party for the Animals', 'pvdd', 2.1, 3, { votes: 219371, change: 0 }), c('ChristenUnie', 'cu', 1.9, 3, { votes: 201361, change: 0 }),
        c('Socialist Party', 'sp', 1.9, 3, { votes: 199585, change: -2 }), c('50PLUS', 'p50', 1.4, 2, { votes: 151053, change: 2 }),
        c('Volt', 'volt', 1.1, 1, { votes: 116468, change: -1 }), c('NSC', 'nsc', 0.4, 0, { votes: 39408, change: -20 }),
        c('Others', 'oth', 1, 0, { votes: 110991, change: 0 })
      ]
    }]
  },
  AT: {
    name: 'Austria', subtitle: 'Federal elections',
    parties: {
      fpo: p('FPÖ', '#005DA8'), ovp: p('ÖVP', '#63C3D0'), spo: p('SPÖ', '#E31E2D'), neos: p('NEOS', '#E3257B'),
      gru: p('The Greens', '#88B626'), ind: p('Independent', '#5B8C5A'), bier: p('Beer Party', '#F5B700'), kpo: p('KPÖ', '#AA0000'),
      mfg: p('MFG', '#FF5824'), wallentin: p('Independent', '#8D7B68'), grosz: p('Independent', '#5E6A9E'), staudinger: p('Independent', '#A0A0A0'),
      oth: p('Others', '#B8B8BD')
    },
    // Federal Ministry of the Interior.
    elections: [{
      id: 'at-national-council-2024', office: 'National Council', kind: 'legislative', date: '2024-09-29', status: 'final', reporting: 100, turnout: 77.7,
      cite: { name: 'the Federal Ministry of the Interior', url: 'https://en.wikipedia.org/wiki/2024_Austrian_legislative_election' },
      system: '183 seats, proportional with a 4% threshold', totalSeats: 183, majority: 92, seatLabel: 'Seats',
      candidates: [
        c('FPÖ', 'fpo', 28.85, 57, { votes: 1408514, change: 26, winner: true }), c('ÖVP', 'ovp', 26.27, 51, { votes: 1282734, change: -20 }),
        c('SPÖ', 'spo', 21.14, 41, { votes: 1032234, change: 1 }), c('NEOS', 'neos', 9.14, 18, { votes: 446378, change: 3 }),
        c('The Greens', 'gru', 8.24, 16, { votes: 402107, change: -10 }), c('KPÖ', 'kpo', 2.39, 0, { votes: 116891, change: 0 }),
        c('Beer Party', 'bier', 2.02, 0, { votes: 98395, change: 0 }), c('Others', 'oth', 1.96, 0, { votes: 95635, change: 0 })
      ],
      winners: { 1: 'fpo', 2: 'fpo', 3: 'fpo', 4: 'fpo', 5: 'fpo', 6: 'fpo', 7: 'ovp', 8: 'ovp', 9: 'spo' }
    }, {
      id: 'at-president-2022', office: 'President', kind: 'presidential', date: '2022-10-09', status: 'final', reporting: 100, turnout: 65.2,
      cite: { name: 'the Federal Ministry of the Interior', url: 'https://en.wikipedia.org/wiki/2022_Austrian_presidential_election' },
      system: 'Popular vote over two rounds if needed, six-year term',
      candidates: [
        c('Alexander Van der Bellen', 'ind', 56.69, null, { votes: 2299590, winner: true }), c('Walter Rosenkranz', 'fpo', 17.68, null, { votes: 717097 }),
        c('Dominik Wlazny', 'bier', 8.31, null, { votes: 337010 }), c('Tassilo Wallentin', 'wallentin', 8.07, null, { votes: 327214 }),
        c('Gerald Grosz', 'grosz', 5.57, null, { votes: 225942 }), c('Michael Brunner', 'mfg', 2.11, null, { votes: 85465 }),
        c('Heinrich Staudinger', 'staudinger', 1.59, null, { votes: 64411 })
      ],
      defaultWinner: 'ind'
    }]
  },
  PT: {
    name: 'Portugal', subtitle: 'National elections',
    parties: {
      ad: p('Democratic Alliance', '#F68A21'), chega: p('Chega', '#202056'), ps: p('Socialist Party', '#F2569F'), il: p('Liberal Initiative', '#00ADEF'),
      livre: p('Livre', '#8CC63F'), cdu: p('CDU (PCP–PEV)', '#E10600'), be: p('Left Bloc', '#B5134B'), pan: p('PAN', '#008080'),
      jpp: p('JPP', '#3D8BC9'), adn: p('ADN', '#1D4E89'), ind: p('Independent', '#5B6C7D'), vieira: p('Independent', '#9C8E7A'),
      oth: p('Others', '#B8B8BD')
    },
    elections: [{
      id: 'pt-assembly-2025', office: 'Assembly of the Republic', kind: 'legislative', date: '2025-05-18', status: 'final', reporting: 100, turnout: 58.25,
      cite: { name: 'the Ministry of Internal Administration', url: 'https://en.wikipedia.org/wiki/2025_Portuguese_legislative_election' },
      system: '230 seats, closed-list proportional (D’Hondt) in 22 constituencies', totalSeats: 230, majority: 116, seatLabel: 'Seats',
      // Ministry of Internal Administration. AD includes its Azores coalition (PSD/CDS/PPM).
      candidates: [
        c('Democratic Alliance', 'ad', 33.15, 91, { votes: 2008488, change: 11, winner: true }), c('Chega', 'chega', 23.74, 60, { votes: 1438554, change: 10 }),
        c('Socialist Party', 'ps', 23.81, 58, { votes: 1442546, change: -20 }), c('Liberal Initiative', 'il', 5.59, 9, { votes: 338974, change: 1 }),
        c('Livre', 'livre', 4.25, 6, { votes: 257291, change: 2 }), c('CDU (PCP–PEV)', 'cdu', 3.03, 3, { votes: 183686, change: -1 }),
        c('Left Bloc', 'be', 2.08, 1, { votes: 125808, change: -4 }), c('PAN', 'pan', 1.43, 1, { votes: 86930, change: 0 }),
        c('JPP', 'jpp', 0.34, 1, { votes: 20900, change: 1 }), c('ADN', 'adn', 1.35, 0, { votes: 81660, change: 0 }),
        c('Others', 'oth', 1.23, 0, { votes: 74484, change: 0 })
      ],
      regionSeats: { 11: 48, 13: 40, '03': 19, 15: 19, '01': 16, 10: 10, '06': 9, '08': 9, 14: 9, 18: 8, 30: 6, 16: 6, 20: 5, 17: 5, '05': 4, '07': 3, '09': 3, '02': 3, '04': 3, 12: 2 },
      defaultWinner: 'ad', winners: { '08': 'chega', '02': 'chega', 12: 'chega', 15: 'chega', '07': 'ps' }
    }, {
      id: 'pt-president-2026', office: 'President', kind: 'presidential', date: '2026-02-08', status: 'final', reporting: 100, turnout: 50.03,
      cite: { name: 'the Ministry of Internal Administration', url: 'https://en.wikipedia.org/wiki/2026_Portuguese_presidential_election' },
      system: 'Two-round popular vote, five-year term',
      candidates: [c('António José Seguro', 'ps', 66.84, null, { votes: 3502613, winner: true }), c('André Ventura', 'chega', 33.16, null, { votes: 1737950 })],
      rounds: [
        { label: 'First round', date: '2026-01-18', candidates: [
          c('António José Seguro', 'ps', 31.11, null, { votes: 1755563 }), c('André Ventura', 'chega', 23.52, null, { votes: 1327021 }),
          c('João Cotrim de Figueiredo', 'il', 16.00, null, { votes: 903057 }), c('Henrique Gouveia e Melo', 'ind', 12.32, null, { votes: 695377 }),
          c('Luís Marques Mendes', 'ad', 11.30, null, { votes: 637442 }), c('Catarina Martins', 'be', 2.06, null, { votes: 116407 }),
          c('António Filipe', 'cdu', 1.64, null, { votes: 92644 }), c('Manuel João Vieira', 'vieira', 1.08, null, { votes: 60927 }),
          c('Others', 'oth', 0.96, null, { votes: 54258 })
        ] },
        { label: 'Run-off', date: '2026-02-08', candidates: [
          c('António José Seguro', 'ps', 66.84, null, { votes: 3502613, winner: true }), c('André Ventura', 'chega', 33.16, null, { votes: 1737950 })
        ] }
      ],
      defaultWinner: 'ps'
    }]
  },
  SE: {
    name: 'Sweden', subtitle: 'General elections',
    parties: {
      s: p('Social Democrats', '#E8112D'), sd: p('Sweden Democrats', '#DDDD00'), m: p('Moderates', '#52BDEC'), v: p('Left Party', '#8B0000'),
      c: p('Centre Party', '#009933'), kd: p('Christian Democrats', '#000077'), mp: p('Green Party', '#83CF39'), l: p('Liberals', '#006AB3'),
      oth: p('Others', '#B8B8BD')
    },
    elections: [{
      id: 'se-riksdag-2026', office: 'Riksdag', kind: 'legislative', date: '2026-09-13', status: 'final', reporting: 100, turnout: 84.9,
      cite: { name: 'the Election Authority', url: 'https://en.wikipedia.org/wiki/2026_Swedish_general_election' },
      system: '349 seats, open-list proportional with a 4% threshold', totalSeats: 349, majority: 175, seatLabel: 'Seats',
      candidates: [
        c('Social Democrats', 's', 28.03, 99, { votes: 1895989, change: -8, winner: true }), c('Moderates', 'm', 19.86, 70, { votes: 1343448, change: 2 }),
        c('Sweden Democrats', 'sd', 17.50, 62, { votes: 1183248, change: -11 }), c('Left Party', 'v', 8.41, 30, { votes: 568781, change: 6 }),
        c('Centre Party', 'c', 7.04, 25, { votes: 475780, change: 1 }), c('Christian Democrats', 'kd', 6.17, 22, { votes: 417490, change: 3 }),
        c('Green Party', 'mp', 6.13, 22, { votes: 414307, change: 4 }), c('Liberals', 'l', 5.34, 19, { votes: 361187, change: 3 }),
        c('Others', 'oth', 1.52, 0, { votes: 102729, change: 0 })
      ]
    }]
  },
  IE: {
    name: 'Ireland', subtitle: 'National elections',
    parties: {
      ff: p('Fianna Fáil', '#66BB66'), fg: p('Fine Gael', '#6699FF'), sf: p('Sinn Féin', '#326760'), lab: p('Labour', '#CC0000'),
      sd: p('Social Democrats', '#752F8B'), aontu: p('Aontú', '#44532A'), ii: p('Independent Ireland', '#4FB0C6'),
      pbp: p('People Before Profit–Solidarity', '#8E2420'), grn: p('Green Party', '#99CC33'), redress: p('100% Redress', '#A0522D'),
      ind: p('Independents', '#8E8E93'), oth: p('Others', '#B8B8BD')
    },
    elections: [{
      id: 'ie-dail-2024', office: 'Dáil Éireann', kind: 'legislative', date: '2024-11-29', status: 'final', reporting: 100, turnout: 59.7,
      cite: { name: 'the official count', url: 'https://en.wikipedia.org/wiki/2024_Irish_general_election' },
      system: '174 seats, single transferable vote in 43 constituencies', totalSeats: 174, majority: 88, seatLabel: 'Seats',
      // First-preference votes.
      candidates: [
        c('Fianna Fáil', 'ff', 21.86, 48, { votes: 481414, change: 10, winner: true }), c('Sinn Féin', 'sf', 19.01, 39, { votes: 418627, change: 2 }),
        c('Fine Gael', 'fg', 20.80, 38, { votes: 458134, change: 3 }), c('Independents', 'ind', 13.20, 16, { votes: 290748, change: -3 }),
        c('Labour', 'lab', 4.65, 11, { votes: 102457, change: 5 }), c('Social Democrats', 'sd', 4.81, 11, { votes: 106028, change: 5 }),
        c('Independent Ireland', 'ii', 3.55, 4, { votes: 78276, change: 4 }), c('People Before Profit–Solidarity', 'pbp', 2.84, 3, { votes: 62481, change: -2 }),
        c('Aontú', 'aontu', 3.91, 2, { votes: 86134, change: 1 }), c('Green Party', 'grn', 3.04, 1, { votes: 66911, change: -11 }),
        c('100% Redress', 'redress', 0.31, 1, { votes: 6862, change: 1 }), c('Others', 'oth', 2.02, 0, { votes: 44381, change: 0 })
      ]
    }, {
      id: 'ie-president-2025', office: 'President', kind: 'presidential', date: '2025-10-24', status: 'final', reporting: 100, turnout: 45.8,
      cite: { name: 'the official count', url: 'https://en.wikipedia.org/wiki/2025_Irish_presidential_election' },
      system: 'Instant-runoff vote, seven-year term',
      candidates: [
        c('Catherine Connolly', 'ind', 63.36, null, { votes: 914143, winner: true }), c('Heather Humphreys', 'fg', 29.46, null, { votes: 424987 }),
        c('Jim Gavin', 'ff', 7.18, null, { votes: 103568 })
      ],
      defaultWinner: 'ind'
    }]
  }
};

export const NEW_INDEX = {
  IN: { atlasId: '356', marker: [79, 22], view: { center: [80, 22.5], span: 15 }, regionTerm: ['state', 'states'] },
  JP: { atlasId: '392', marker: [138, 36.5], view: { center: [137.5, 37.5], span: 10.5 }, regionTerm: ['prefecture', 'prefectures'] },
  MX: { atlasId: '484', marker: [-102, 23.5], view: { center: [-102, 23.5], span: 14 }, regionTerm: ['state', 'states'] },
  IT: { atlasId: '380', marker: [12.5, 42.5], view: { center: [12.5, 41.9], span: 6.4 }, regionTerm: ['region', 'regions'] },
  KR: { atlasId: '410', marker: [127.8, 36.4], view: { center: [127.8, 36.2], span: 3.4 }, regionTerm: ['province', 'provinces'] },
  ID: { atlasId: '360', marker: [117, -2.5], view: { center: [118, -2.5], span: 24 }, regionTerm: ['province', 'provinces'] },
  ZA: { atlasId: '710', marker: [25, -29], view: { center: [25, -29], span: 9 }, regionTerm: ['province', 'provinces'] },
  TR: { atlasId: '792', marker: [35, 39], view: { center: [35.2, 39], span: 9.5 }, regionTerm: ['province', 'provinces'] },
  PL: { atlasId: '616', marker: [19.4, 52], view: { center: [19.4, 52], span: 4.6 }, regionTerm: ['voivodeship', 'voivodeships'] },
  NL: { atlasId: '528', marker: [5.5, 52.2], view: { center: [5.4, 52.2], span: 1.9 }, regionTerm: ['province', 'provinces'] },
  AT: { atlasId: '040', marker: [14.4, 47.6], view: { center: [13.3, 47.6], span: 2.6 }, regionTerm: ['state', 'states'] },
  PT: { atlasId: '620', marker: [-8.2, 39.6], view: { center: [-8.1, 39.6], span: 3.3 }, regionTerm: ['district', 'districts'] },
  SE: { atlasId: '752', marker: [16, 62.5], view: { center: [17, 62.6], span: 7.6 }, regionTerm: ['county', 'counties'] },
  IE: { atlasId: '372', marker: [-8, 53.2], view: { center: [-8, 53.4], span: 2.6 }, regionTerm: ['constituency', 'constituencies'] }
};

const s = (country, office, kind, date, tz, close, basedOn, extra = {}) => ({ country, office, kind, date, timezone: tz, pollsClose: close, basedOn, ...extra });
export const NEW_SCHEDULE = [
  s('US', 'House of Representatives', 'legislative', '2026-11-03', 'America/New_York', '20:00', 'us-house-2024'),
  s('BR', 'Chamber of Deputies', 'legislative', '2030-10-06', 'America/Sao_Paulo', '17:00', 'br-chamber-2022', { tentative: true }),
  s('AR', 'Chamber of Deputies', 'legislative', '2027-10-24', 'America/Argentina/Buenos_Aires', '18:00', 'ar-chamber-2025'),
  s('IN', 'Lok Sabha', 'legislative', '2029-05-15', 'Asia/Kolkata', '18:00', 'in-lok-sabha-2024', { tentative: true }),
  s('JP', 'House of Councillors', 'legislative', '2028-07-23', 'Asia/Tokyo', '20:00', 'jp-councillors-2025', { tentative: true }),
  s('JP', 'House of Representatives', 'legislative', '2030-02-08', 'Asia/Tokyo', '20:00', 'jp-representatives-2026', { tentative: true }),
  s('MX', 'Chamber of Deputies', 'legislative', '2027-06-06', 'America/Mexico_City', '18:00', 'mx-chamber-2024'),
  s('MX', 'President', 'presidential', '2030-06-02', 'America/Mexico_City', '18:00', 'mx-president-2024', { tentative: true }),
  s('MX', 'Senate', 'legislative', '2030-06-02', 'America/Mexico_City', '18:00', 'mx-senate-2024', { tentative: true }),
  s('IT', 'Chamber of Deputies', 'legislative', '2027-09-26', 'Europe/Rome', '23:00', 'it-chamber-2022', { tentative: true }),
  s('IT', 'Senate', 'legislative', '2027-09-26', 'Europe/Rome', '23:00', 'it-senate-2022', { tentative: true }),
  s('KR', 'National Assembly', 'legislative', '2028-04-12', 'Asia/Seoul', '18:00', 'kr-assembly-2024'),
  s('KR', 'President', 'presidential', '2030-06-03', 'Asia/Seoul', '20:00', 'kr-president-2025', { tentative: true }),
  s('ID', 'President', 'presidential', '2029-02-14', 'Asia/Jakarta', '13:00', 'id-president-2024', { tentative: true }),
  s('ID', 'House of Representatives', 'legislative', '2029-02-14', 'Asia/Jakarta', '13:00', 'id-dpr-2024', { tentative: true }),
  s('ZA', 'National Assembly', 'legislative', '2029-05-16', 'Africa/Johannesburg', '21:00', 'za-assembly-2024', { tentative: true }),
  s('TR', 'President', 'presidential', '2028-05-14', 'Europe/Istanbul', '17:00', 'tr-president-2023', { tentative: true }),
  s('TR', 'Grand National Assembly', 'legislative', '2028-05-14', 'Europe/Istanbul', '17:00', 'tr-assembly-2023', { tentative: true }),
  s('PL', 'Sejm', 'legislative', '2027-10-10', 'Europe/Warsaw', '21:00', 'pl-sejm-2023', { tentative: true }),
  s('PL', 'Senate', 'legislative', '2027-10-10', 'Europe/Warsaw', '21:00', 'pl-senate-2023', { tentative: true }),
  s('PL', 'President', 'presidential', '2030-05-12', 'Europe/Warsaw', '21:00', 'pl-president-2025', { tentative: true }),
  s('NL', 'House of Representatives', 'legislative', '2029-10-31', 'Europe/Amsterdam', '21:00', 'nl-house-2025', { tentative: true }),
  s('AT', 'President', 'presidential', '2028-10-08', 'Europe/Vienna', '17:00', 'at-president-2022', { tentative: true }),
  s('AT', 'National Council', 'legislative', '2029-09-30', 'Europe/Vienna', '17:00', 'at-national-council-2024', { tentative: true }),
  s('PT', 'Assembly of the Republic', 'legislative', '2029-10-07', 'Europe/Lisbon', '19:00', 'pt-assembly-2025', { tentative: true }),
  s('PT', 'President', 'presidential', '2031-01-19', 'Europe/Lisbon', '19:00', 'pt-president-2026', { tentative: true }),
  s('SE', 'Riksdag', 'legislative', '2030-09-08', 'Europe/Stockholm', '20:00', 'se-riksdag-2026', { tentative: true }),
  s('IE', 'Dáil Éireann', 'legislative', '2029-11-30', 'Europe/Dublin', '22:00', 'ie-dail-2024', { tentative: true }),
  s('IE', 'President', 'presidential', '2032-10-28', 'Europe/Dublin', '22:00', 'ie-president-2025', { tentative: true })
];

export const NEW_HISTORY = {
  'us-house-2024': [2022, 2020, 2018, 2016],
  'br-chamber-2022': [2018, 2014, 2010],
  'ar-chamber-2025': [2023, 2021, 2019],
  'in-lok-sabha-2024': [2019, 2014, 2009],
  'jp-councillors-2025': [2022, 2019, 2016],
  'mx-president-2024': [2018, 2012, 2006],
  'mx-chamber-2024': [2021, 2018, 2015],
  'mx-senate-2024': [2018, 2012],
  'it-chamber-2022': [2018, 2013, 2008],
  'it-senate-2022': [2018, 2013, 2008],
  'kr-president-2025': [2022, 2017, 2012],
  'kr-assembly-2024': [2020, 2016, 2012],
  'id-president-2024': [2019, 2014, 2009],
  'id-dpr-2024': [2019, 2014, 2009],
  'za-assembly-2024': [2019, 2014, 2009],
  'tr-president-2023': [2018, 2014],
  'tr-assembly-2023': [2018, 2015, 2011],
  'pl-president-2025': [2020, 2015, 2010],
  'pl-sejm-2023': [2019, 2015, 2011],
  'pl-senate-2023': [2019, 2015, 2011],
  'nl-house-2025': [2023, 2021, 2017],
  'at-national-council-2024': [2019, 2017, 2013],
  'at-president-2022': [2016, 2010, 2004],
  'pt-assembly-2025': [2024, 2022, 2019],
  'pt-president-2026': [2021, 2016, 2011],
  'se-riksdag-2026': [2022, 2018, 2014],
  'ie-dail-2024': [2020, 2016, 2011],
  'ie-president-2025': [2018, 2011]
};

export const NEW_ABOUT = {
  IN: {
    system: 'Federal parliamentary republic', headOfState: 'President', headOfGovernment: 'Prime Minister',
    legislature: 'Parliament: Lok Sabha (543) and indirectly elected Rajya Sabha', votingAge: 18, compulsory: false, registered: 968000000,
    offices: { 'Lok Sabha': '543 single-member constituencies elected by first past the post, voting in phases over about six weeks and counted on one day. The party or alliance with a majority forms the government.' }
  },
  JP: {
    system: 'Unitary parliamentary constitutional monarchy', headOfState: 'The Emperor', headOfGovernment: 'Prime Minister',
    legislature: 'National Diet: House of Representatives (465) and House of Councillors (248)', votingAge: 18, compulsory: false, registered: 104000000,
    offices: {
      'House of Representatives': 'Voters cast one ballot for a district candidate and one for a party in regional proportional blocs. Terms run up to four years and the chamber chooses the Prime Minister.',
      'House of Councillors': 'Six-year terms with half the seats elected every three years, split between prefectural districts and a national proportional list.'
    }
  },
  MX: {
    system: 'Federal presidential republic', headOfState: 'President', headOfGovernment: 'President',
    legislature: 'Congress of the Union: Chamber of Deputies (500) and Senate (128)', votingAge: 18, compulsory: false, registered: 98300000,
    offices: {
      President: 'Elected for a single six-year term by plurality vote in one round. Re-election is not allowed.',
      'Chamber of Deputies': '300 deputies are elected in districts and 200 from regional party lists. The whole chamber is renewed every three years.',
      Senate: 'Each state elects three senators, two for the winning list and one for the runner-up, plus 32 from a national list. Terms are six years.'
    }
  },
  IT: {
    system: 'Unitary parliamentary republic', headOfState: 'President', headOfGovernment: 'President of the Council of Ministers',
    legislature: 'Parliament: Chamber of Deputies (400) and Senate (200 elected)', votingAge: 18, compulsory: false, registered: 50900000,
    offices: {
      'Chamber of Deputies': 'About three eighths of seats come from single-member districts and the rest from proportional lists, under a 3% threshold. Both chambers must back the government.',
      Senate: 'Elected regionally with the same mixed system as the Chamber. Former presidents and a few appointees sit for life.'
    }
  },
  KR: {
    system: 'Unitary presidential republic', headOfState: 'President', headOfGovernment: 'President',
    legislature: 'National Assembly (300)', votingAge: 18, compulsory: false, registered: 44400000,
    offices: {
      President: 'Elected for a single five-year term by plurality in one round.',
      'National Assembly': '254 single-member districts and 46 proportional seats, elected every four years.'
    }
  },
  ID: {
    system: 'Unitary presidential republic', headOfState: 'President', headOfGovernment: 'President',
    legislature: "People's Consultative Assembly: House of Representatives (580) and Regional Representative Council", votingAge: 17, compulsory: false, registered: 204800000,
    offices: {
      President: 'Elected for five years. A ticket wins outright with a majority nationwide and at least 20% in more than half the provinces, otherwise there is a run-off.',
      'House of Representatives': '580 members elected by open-list proportional representation in multi-member districts, with a 4% national threshold.'
    }
  },
  ZA: {
    system: 'Unitary parliamentary republic', headOfState: 'President', headOfGovernment: 'President',
    legislature: 'Parliament: National Assembly (400) and National Council of Provinces', votingAge: 18, compulsory: false, registered: 27700000,
    offices: { 'National Assembly': '400 seats shared out by closed-list proportional representation, half from national lists and half from regional lists. The Assembly elects the President.' }
  },
  TR: {
    system: 'Unitary presidential republic', headOfState: 'President', headOfGovernment: 'President',
    legislature: 'Grand National Assembly (600)', votingAge: 18, compulsory: false, registered: 64100000,
    offices: {
      President: 'Elected for five years. A candidate needs a majority of valid votes, otherwise the top two meet in a run-off two weeks later.',
      'Grand National Assembly': '600 seats shared out by D’Hondt in 87 provincial districts, with a 7% threshold for parties and alliances.'
    }
  },
  PL: {
    system: 'Unitary semi-presidential republic', headOfState: 'President', headOfGovernment: 'Prime Minister',
    legislature: 'Parliament: Sejm (460) and Senate (100)', votingAge: 18, compulsory: false, registered: 29500000,
    offices: {
      President: 'Elected for five years over two rounds if nobody wins a majority in the first.',
      Sejm: '460 seats from 41 districts by open-list proportional representation with a 5% threshold.',
      Senate: '100 single-member districts elected by first past the post on the same day as the Sejm.'
    }
  },
  NL: {
    system: 'Unitary parliamentary constitutional monarchy', headOfState: 'The King', headOfGovernment: 'Prime Minister',
    legislature: 'States General: House of Representatives (150) and Senate (75)', votingAge: 18, compulsory: false, registered: 13500000,
    offices: { 'House of Representatives': 'All 150 seats are filled from national party lists in proportion to votes, with no threshold beyond one full seat. Coalitions form after the vote.' }
  }
};

Object.assign(NEW_ABOUT, {
  IE: {
    system: 'Unitary parliamentary republic', headOfState: 'President', headOfGovernment: 'Taoiseach',
    legislature: 'Oireachtas: Dáil Éireann (174) and Seanad Éireann (60)', votingAge: 18, compulsory: false, registered: 3600000,
    offices: {
      'Dáil Éireann': '174 TDs elected by single transferable vote in 43 constituencies of three to five seats. Elections are held at least every five years.',
      President: 'Elected directly for seven years by instant-runoff voting, for at most two terms.'
    }
  },
  SE: {
    system: 'Unitary parliamentary constitutional monarchy', headOfState: 'The King', headOfGovernment: 'Prime Minister',
    legislature: 'Riksdag (349)', votingAge: 18, compulsory: false, registered: 7770000,
    offices: { Riksdag: '349 seats: 310 shared out in 29 constituencies and 39 adjustment seats that make the result proportional nationally. Parties need 4% nationally or 12% in a constituency. Elections are every four years.' }
  },
  AT: {
    system: 'Federal parliamentary republic', headOfState: 'Federal President', headOfGovernment: 'Federal Chancellor',
    legislature: 'Parliament: National Council (183) and Federal Council', votingAge: 16, compulsory: false, registered: 6350000,
    offices: {
      'National Council': '183 seats shared out by proportional representation at regional, state and federal level, with a 4% threshold. Terms are five years.',
      President: 'Elected directly for six years. A candidate needs a majority of valid votes, otherwise the top two meet in a run-off.'
    }
  },
  PT: {
    system: 'Unitary semi-presidential republic', headOfState: 'President', headOfGovernment: 'Prime Minister',
    legislature: 'Assembly of the Republic (230)', votingAge: 18, compulsory: false, registered: 10800000,
    offices: {
      'Assembly of the Republic': '230 deputies elected by closed-list proportional representation (D’Hondt) in 22 constituencies: the 18 districts, the Azores, Madeira and two for voters abroad. Terms run up to four years.',
      President: 'Elected for five years by popular vote, with a run-off if no candidate wins a majority. The president can dissolve parliament.'
    }
  }
});

export const EXTRA_ABOUT = {
  US: { 'House of Representatives': 'All 435 seats are elected every two years in single-member districts, apportioned to states by population. 218 is a majority.' },
  BR: { 'Chamber of Deputies': '513 deputies elected by open-list proportional representation in each state, with between 8 and 70 seats per state.' },
  AR: { 'Chamber of Deputies': 'Half of the 257 seats are renewed every two years, by D’Hondt proportional representation in each province.' }
};
