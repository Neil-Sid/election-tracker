#!/usr/bin/env node
// Builds data/regions.topo.json, the state/province shapes drawn on the globe.
// Source: Natural Earth 10m admin-1 with lakes cut out (public domain), e.g.
//   https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_1_states_provinces_lakes.geojson
//
//   node scripts/build-regions.mjs path/to/ne_10m_admin_1_states_provinces_lakes.geojson [--replace=IE=path]
//
// --replace swaps a country's Natural Earth regions for another boundary file
// where results are counted in different units (Ireland counts by Dáil
// constituency, not county). Field mappings live in REPLACE below.
//
// Each shape gets an id like "US-OH" whose suffix matches the region "abbr" in
// data/countries/*.json, plus a display name. UK counties, Spanish provinces,
// French departments and Italian provinces are merged up to the units the
// results use.

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mapshaper from 'mapshaper';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = process.argv[2];
const replacements = Object.fromEntries(process.argv.slice(3)
  .filter(a => a.startsWith('--replace='))
  .map(a => a.slice('--replace='.length).split(/=(.*)/s).slice(0, 2)));
if (!src) {
  console.error('Usage: node scripts/build-regions.mjs <ne_10m_admin_1_states_provinces_lakes.geojson>');
  process.exit(1);
}

const AR = { B: 'BA', C: 'CABA', K: 'CT', H: 'CC', U: 'CH', X: 'CB', W: 'CN', E: 'ER', P: 'FM', Y: 'JY', L: 'LP', F: 'LR', M: 'MZ', N: 'MN', Q: 'NQ', R: 'RN', A: 'SA', J: 'SJ', D: 'SL', Z: 'SC', S: 'SF', G: 'SE', V: 'TF', T: 'TM' };

// Merged units: source value -> [abbr, display name].
const GB = { England: ['ENG', 'England'], Scotland: ['SCT', 'Scotland'], Wales: ['WLS', 'Wales'], 'Northern Ireland': ['NI', 'Northern Ireland'] };
const ES = {
  'Andalucía': ['AN', 'Andalusia'], 'Cataluña': ['CT', 'Catalonia'], Madrid: ['MD', 'Madrid'], Valenciana: ['VC', 'Valencia'],
  Galicia: ['GA', 'Galicia'], 'Castilla y León': ['CL', 'Castile and León'], 'País Vasco': ['PV', 'Basque Country'],
  'Castilla-La Mancha': ['CM', 'Castilla–La Mancha'], 'Canary Is.': ['CN', 'Canary Islands'], 'Aragón': ['AR', 'Aragon'],
  Murcia: ['MC', 'Murcia'], 'Islas Baleares': ['IB', 'Balearic Islands'], Extremadura: ['EX', 'Extremadura'],
  Asturias: ['AS', 'Asturias'], 'Foral de Navarra': ['NC', 'Navarre'], Cantabria: ['CB', 'Cantabria'],
  'La Rioja': ['RI', 'La Rioja'], Ceuta: ['CE', 'Ceuta and Melilla'], Melilla: ['CE', 'Ceuta and Melilla']
};
const FR = {
  'Île-de-France': ['IDF', 'Île-de-France'], 'Auvergne-Rhône-Alpes': ['ARA', 'Auvergne-Rhône-Alpes'],
  'Hauts-de-France': ['HDF', 'Hauts-de-France'], 'Nouvelle-Aquitaine': ['NAQ', 'Nouvelle-Aquitaine'],
  Occitanie: ['OCC', 'Occitanie'], 'Grand Est': ['GES', 'Grand Est'],
  "Provence-Alpes-Côte-d'Azur": ['PAC', "Provence-Alpes-Côte d'Azur"], 'Pays de la Loire': ['PDL', 'Pays de la Loire'],
  Normandie: ['NOR', 'Normandy'], Bretagne: ['BRE', 'Brittany'], 'Bourgogne-Franche-Comté': ['BFC', 'Bourgogne-Franche-Comté'],
  'Centre-Val de Loire': ['CVL', 'Centre-Val de Loire'], Corse: ['COR', 'Corsica']
};
const IT = {
  "Valle d'Aosta": ['VDA', 'Aosta Valley'], Piemonte: ['PIE', 'Piedmont'], Lombardia: ['LOM', 'Lombardy'],
  'Trentino-Alto Adige': ['TAA', 'Trentino-South Tyrol'], Liguria: ['LIG', 'Liguria'], 'Emilia-Romagna': ['EMR', 'Emilia-Romagna'],
  Marche: ['MAR', 'Marche'], Veneto: ['VEN', 'Veneto'], 'Friuli-Venezia Giulia': ['FVG', 'Friuli-Venezia Giulia'],
  Abruzzo: ['ABR', 'Abruzzo'], Molise: ['MOL', 'Molise'], Apulia: ['PUG', 'Apulia'], Basilicata: ['BAS', 'Basilicata'],
  Calabria: ['CAL', 'Calabria'], Campania: ['CAM', 'Campania'], Lazio: ['LAZ', 'Lazio'], Toscana: ['TOS', 'Tuscany'],
  Sicily: ['SIC', 'Sicily'], Sardegna: ['SAR', 'Sardinia'], Umbria: ['UMB', 'Umbria']
};

// The Philippines' provinces and cities, merged into its regions.
const PH = {
  'National Capital Region': ['NCR', 'Metro Manila'], 'Cordillera Administrative Region (CAR)': ['CAR', 'Cordillera'],
  'Ilocos (Region I)': ['I', 'Ilocos'], 'Cagayan Valley (Region II)': ['II', 'Cagayan Valley'], 'Central Luzon (Region III)': ['III', 'Central Luzon'],
  'CALABARZON (Region IV-A)': ['IVA', 'Calabarzon'], 'MIMAROPA (Region IV-B)': ['IVB', 'Mimaropa'], 'Bicol (Region V)': ['V', 'Bicol'],
  'Western Visayas (Region VI)': ['VI', 'Western Visayas'], 'Central Visayas (Region VII)': ['VII', 'Central Visayas'],
  'Eastern Visayas (Region VIII)': ['VIII', 'Eastern Visayas'], 'Zamboanga Peninsula (Region IX)': ['IX', 'Zamboanga Peninsula'],
  'Northern Mindanao (Region X)': ['X', 'Northern Mindanao'], 'Davao (Region XI)': ['XI', 'Davao'], 'SOCCSKSARGEN (Region XII)': ['XII', 'Soccsksargen'],
  'Dinagat Islands (Region XIII)': ['XIII', 'Caraga'], 'Autonomous Region in Muslim Mindanao (ARMM)': ['BARMM', 'Bangsamoro']
};

const UA_NAMES = { 30: 'Kyiv', 32: 'Kyiv Oblast', 43: 'Crimea', 51: 'Odesa' };
const UA = p => ['UA', iso(p), UA_NAMES[iso(p)] ?? p.name_en ?? p.name];

// Russia's federal subjects. Natural Earth files Crimea and Sevastopol under
// Russia; they are internationally recognised as Ukraine and drawn there. It
// also swaps the codes of Moscow city and Moscow Oblast.
const RU_NAMES = {
  MOW: 'Moscow', MOS: 'Moscow Oblast', SPE: 'Saint Petersburg', ALT: 'Altai Krai', AL: 'Altai Republic', MAG: 'Magadan',
  YEV: 'Jewish Autonomous Oblast', SE: 'North Ossetia–Alania', CE: 'Chechnya', ZAB: 'Zabaykalsky Krai'
};
const RU = p => {
  if (p.iso_3166_2.startsWith('UA-')) return UA(p);
  if (!p.iso_3166_2.startsWith('RU-') || p.iso_3166_2.includes('~')) return ['RU', null];
  const abbr = { Moskva: 'MOW', Moskovskaya: 'MOS' }[p.name] ?? iso(p);
  return ['RU', abbr, RU_NAMES[abbr] ?? p.name_en ?? p.name];
};

// Hungary's cities with county rights, folded into their counties.
const HU_CITY = {
  BC: 'BE', DE: 'HB', DU: 'FE', ED: 'PE', EG: 'HE', GY: 'GS', HV: 'CS', KM: 'BK', KV: 'SO', MI: 'BZ', NK: 'ZA', NY: 'SZ',
  PS: 'BA', SD: 'CS', SF: 'FE', SH: 'VA', SK: 'JN', SN: 'GS', SS: 'TO', ST: 'NO', TB: 'KE', VM: 'VE', ZE: 'ZA'
};
const HU_NAMES = {
  BA: 'Baranya', BE: 'Békés', BK: 'Bács-Kiskun', BU: 'Budapest', BZ: 'Borsod-Abaúj-Zemplén', CS: 'Csongrád-Csanád', FE: 'Fejér',
  GS: 'Győr-Moson-Sopron', HB: 'Hajdú-Bihar', HE: 'Heves', JN: 'Jász-Nagykun-Szolnok', KE: 'Komárom-Esztergom', NO: 'Nógrád',
  PE: 'Pest', SO: 'Somogy', SZ: 'Szabolcs-Szatmár-Bereg', TO: 'Tolna', VA: 'Vas', VE: 'Veszprém', ZA: 'Zala'
};

// Iran's provinces by today's ISO codes; Natural Earth still uses the old
// numbering, which gives Tehran and Alborz the same code.
const IR = {
  Markazi: '00', Gilan: '01', Mazandaran: '02', 'East Azerbaijan': '03', 'West Azerbaijan': '04', Kermanshah: '05',
  Khuzestan: '06', Fars: '07', Kerman: '08', 'Razavi Khorasan': '09', Isfahan: '10', 'Sistan and Baluchestan': '11',
  Kurdistan: '12', Hamadan: '13', 'Chaharmahal and Bakhtiari': '14', Lorestan: '15', Ilam: '16',
  'Kohgiluyeh and Boyer-Ahmad': '17', Bushehr: '18', Zanjan: '19', Semnan: '20', Yazd: '21', Hormozgan: '22',
  Tehran: '23', Ardabil: '24', Qom: '25', Qazvin: '26', Golestan: '27', 'North Khorasan': '28', 'South Khorasan': '29',
  Alborz: '30'
};
const IQ_NAMES = { AN: 'Anbar', BB: 'Babil', MU: 'Muthanna', QA: 'Al-Qadisiyyah' };

// Natural Earth spells some names without diacritics or with typos.
const RENAME = {
  'MX-DIF': 'Mexico City', 'TR-67': 'Zonguldak', 'TR-71': 'Kırıkkale', 'TR-46': 'Kahramanmaraş', 'TR-63': 'Şanlıurfa',
  'TR-73': 'Şırnak', 'TR-76': 'Iğdır', 'TR-04': 'Ağrı', 'TR-34': 'İstanbul', 'TR-35': 'İzmir', 'TR-21': 'Diyarbakır',
  'TR-39': 'Kırklareli', 'TR-59': 'Tekirdağ', 'TR-26': 'Eskişehir', 'TR-49': 'Muş', 'TR-23': 'Elazığ', 'TR-48': 'Muğla',
  'TR-40': 'Kırşehir', 'TR-50': 'Nevşehir', 'TR-51': 'Niğde', 'TR-64': 'Uşak', 'TR-09': 'Aydın', 'TR-10': 'Balıkesir',
  'TR-18': 'Çankırı', 'TR-29': 'Gümüşhane', 'TR-02': 'Adıyaman', 'TR-12': 'Bingöl', 'TR-44': 'Malatya',
  'SE-T': 'Örebro', 'AT-3': 'Lower Austria', 'AT-4': 'Upper Austria', 'AT-2': 'Carinthia', 'AT-6': 'Styria',
  'AT-7': 'Tyrol', 'AT-9': 'Vienna', 'PT-11': 'Lisbon', 'PT-20': 'Azores'
};

const iso = p => p.iso_3166_2.split('-')[1];
const own = cc => p => [cc, iso(p), p.name];
const merged = (cc, table, field) => p => [cc, ...(table[p[field]] ?? [])];
const lettersOnly = cc => p => [cc, /^[A-Z]+$/.test(iso(p)) ? iso(p) : null, p.name];

const KEY = {
  USA: p => ['US', p.postal, p.name],
  CAN: p => ['CA', p.postal, p.name],
  BRA: p => ['BR', p.postal, p.name],
  ARG: p => ['AR', AR[iso(p)], p.name],
  GBR: merged('GB', GB, 'geonunit'),
  ESP: merged('ES', ES, 'region'),
  FRA: merged('FR', FR, 'region'),
  ITA: merged('IT', IT, 'region'),
  DEU: own('DE'),
  AUS: lettersOnly('AU'),
  IND: own('IN'),
  JPN: own('JP'),
  MEX: lettersOnly('MX'),
  KOR: own('KR'),
  IDN: own('ID'),
  ZAF: own('ZA'),
  TUR: own('TR'),
  POL: own('PL'),
  NLD: p => ['NL', /^[A-Z]{2}$/.test(iso(p)) ? iso(p) : null, p.name],
  SWE: own('SE'),
  PRT: own('PT'),
  AUT: own('AT'),
  RUS: RU,
  // Norway's 19 old counties are still its Storting constituencies.
  NOR: p => ['NO', /^NO-\d+$/.test(p.iso_3166_2) && p.iso_3166_2 !== 'NO-21' ? iso(p) : null, p.name],
  BOL: p => ['BO', iso(p), p.name_en ?? p.name],
  // Lima Province (the capital) and Lima Region share a code in Natural Earth.
  PER: p => ['PE', p.name === 'Lima Province' ? 'LMA' : iso(p), p.name === 'Lima Province' ? 'Lima Metropolitan' : p.name],
  // Bogotá is filed under Cundinamarca's code.
  COL: p => ['CO', p.name === 'Bogota' ? 'DC' : p.iso_3166_2.includes('~') ? null : iso(p), p.name === 'Bogota' ? 'Bogotá' : p.name],
  CHL: p => ['CL', iso(p), { MA: 'Magallanes', RM: 'Santiago Metropolitan' }[iso(p)] ?? p.name_en ?? p.name],
  PHL: merged('PH', PH, 'region'),
  CZE: p => ['CZ', iso(p), { PL: 'Plzeň' }[iso(p)] ?? p.name_en ?? p.name],
  SVK: p => ['SK', iso(p), p.name_en ?? p.name],
  HUN: p => ['HU', HU_CITY[iso(p)] ?? iso(p), HU_NAMES[HU_CITY[iso(p)] ?? iso(p)]],
  ROU: p => ['RO', iso(p), p.name_en ?? p.name],
  // The 13 regions; Mount Athos is self-governing and elects no one.
  GRC: p => ['GR', iso(p) === '69' ? null : iso(p), { B: 'Central Macedonia', E: 'Thessaly' }[iso(p)] ?? p.name_en ?? p.name],
  BEL: p => ['BE', iso(p), { BRU: 'Brussels' }[iso(p)] ?? p.name_en ?? p.name],
  DNK: p => ['DK', iso(p), { 84: 'Capital Region' }[iso(p)] ?? p.name_en ?? p.name],
  FIN: own('FI'),
  CHE: p => ['CH', iso(p), { GR: 'Graubünden' }[iso(p)] ?? p.name_en ?? p.name],
  UKR: UA,
  IRN: p => ['IR', IR[p.name_en], p.name_en],
  IRQ: p => ['IQ', iso(p), IQ_NAMES[iso(p)] ?? p.name_en ?? p.name],
  // The 16 regions; outlying islands and the Chatham Islands are left off.
  NZL: p => ['NZ', p.iso_3166_2.startsWith('NZ-') && !p.iso_3166_2.includes('~') && p.iso_3166_2 !== 'NZ-CIT' ? iso(p) : null, p.name_en ?? p.name]
};

// map(properties) -> { abbr, name, seats? } for countries whose regions come
// from their own boundary file.
const slug = s => s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const REPLACE = {
  // Tailte Éireann, Dáil constituencies (2023 boundaries, used from 2024),
  // generalised. Names carry the seat count: "Mayo (5)".
  IE: {
    map: p => {
      const m = /^(.*?)\s*\((\d+)\)\s*$/.exec(p.ENG_NAME_VALUE ?? '');
      return m ? { abbr: slug(m[1]), name: m[1], seats: Number(m[2]) } : null;
    }
  }
};

const geo = JSON.parse(await readFile(src, 'utf8'));
const features = [];
for (const f of geo.features) {
  const keyOf = KEY[f.properties.adm0_a3];
  if (!keyOf) continue;
  const [cc, abbr, name] = keyOf(f.properties);
  if (!abbr) continue;
  const id = `${cc}-${abbr}`;
  features.push({ type: 'Feature', properties: { id, name: RENAME[id] ?? name }, geometry: f.geometry });
}

for (const [cc, file] of Object.entries(replacements)) {
  const cfg = REPLACE[cc];
  if (!cfg) throw new Error(`No field mapping for ${cc} in REPLACE`);
  const own = JSON.parse(await readFile(file, 'utf8'));
  for (let i = features.length - 1; i >= 0; i--) if (features[i].properties.id.startsWith(`${cc}-`)) features.splice(i, 1);
  for (const f of own.features) {
    const m = cfg.map(f.properties ?? {});
    if (m && f.geometry) features.push({ type: 'Feature', properties: { id: `${cc}-${m.abbr}`, name: m.name, ...(m.seats ? { seats: m.seats } : {}) }, geometry: f.geometry });
  }
}

const result = await mapshaper.applyCommands(
  '-i keyed.json -dissolve2 id copy-fields=name,seats -simplify 7% weighted keep-shapes -filter-slivers min-area=20km2 ' +
  '-rename-layers regions -o regions.json format=topojson quantization=100000 id-field=id',
  { 'keyed.json': { type: 'FeatureCollection', features } }
);
const topo = JSON.parse(result['regions.json']);
await writeFile(path.join(root, 'data', 'regions.topo.json'), JSON.stringify(topo));
console.log(`${topo.objects.regions.geometries.length} regions written to data/regions.topo.json`);
