#!/usr/bin/env node
// Builds data/regions.topo.json, the state/province shapes drawn on the globe.
// Source: Natural Earth 10m admin-1 (public domain), e.g.
//   https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_1_states_provinces.geojson
//
//   node scripts/build-regions.mjs path/to/ne_10m_admin_1_states_provinces.geojson [--replace=IE=path]
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
  console.error('Usage: node scripts/build-regions.mjs <ne_10m_admin_1_states_provinces.geojson>');
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
  AUT: own('AT')
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
