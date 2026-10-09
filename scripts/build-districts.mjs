#!/usr/bin/env node
// Builds data/districts/<CODE>.topo.json from an official boundary file, for
// chambers elected in single-member districts. Each district gets an id like
// "US-CA-12", a display name and the state/region it belongs to (matching the
// region abbreviations in data/countries/<CODE>.json).
//
//   node scripts/build-districts.mjs US path/to/cb_2025_us_cd119_20m.zip
//   node scripts/build-districts.mjs CA path/to/FederalElectoralDistricts.zip --land=path/to/ne_10m_admin_1_states_provinces_lakes.geojson
//
// Sources per country are listed in SOURCES below. Sources whose boundaries run
// out over the sea (Canada's) are clipped to the country's land in Natural Earth,
// the same coastline the state/province map uses.

import { readFile, writeFile, mkdir, readdir, mkdtemp } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mapshaper from 'mapshaper';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [code, src] = process.argv.slice(2).filter(a => !a.startsWith('--'));
const landFile = process.argv.find(a => a.startsWith('--land='))?.slice(7);
// A past boundary set, e.g. --set=cd113, is written beside today's as US.cd113.topo.json.
const set = process.argv.find(a => a.startsWith('--set='))?.slice(6);

const FIPS = {
  '01': 'AL', '02': 'AK', '04': 'AZ', '05': 'AR', '06': 'CA', '08': 'CO', '09': 'CT', '10': 'DE', '11': 'DC', '12': 'FL', '13': 'GA',
  '15': 'HI', '16': 'ID', '17': 'IL', '18': 'IN', '19': 'IA', '20': 'KS', '21': 'KY', '22': 'LA', '23': 'ME', '24': 'MD', '25': 'MA',
  '26': 'MI', '27': 'MN', '28': 'MS', '29': 'MO', '30': 'MT', '31': 'NE', '32': 'NV', '33': 'NH', '34': 'NJ', '35': 'NM', '36': 'NY',
  '37': 'NC', '38': 'ND', '39': 'OH', '40': 'OK', '41': 'OR', '42': 'PA', '44': 'RI', '45': 'SC', '46': 'SD', '47': 'TN', '48': 'TX',
  '49': 'UT', '50': 'VT', '51': 'VA', '53': 'WA', '54': 'WV', '55': 'WI', '56': 'WY'
};
const US_NAMES = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware',
  FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky',
  LA: 'Louisiana', ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri',
  MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York', NC: 'North Carolina',
  ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
  SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington', WV: 'West Virginia',
  WI: 'Wisconsin', WY: 'Wyoming'
};
const ordinal = n => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th');

// Metropolitan départements by region (2016 regions). Overseas seats are not
// drawn because the tracker's France map is metropolitan.
const FR_DEPT_REGION = Object.fromEntries(Object.entries({
  ARA: '01 03 07 15 26 38 42 43 63 69 73 74', BFC: '21 25 39 58 70 71 89 90', BRE: '22 29 35 56',
  CVL: '18 28 36 37 41 45', COR: '2A 2B', GES: '08 10 51 52 54 55 57 67 68 88', HDF: '02 59 60 62 80',
  IDF: '75 77 78 91 92 93 94 95', NOR: '14 27 50 61 76', NAQ: '16 17 19 23 24 33 40 47 64 79 86 87',
  OCC: '09 11 12 30 31 32 34 46 48 65 66 81 82', PDL: '44 49 53 72 85', PAC: '04 05 06 13 83 84'
}).flatMap(([region, depts]) => depts.split(' ').map(d => [d, region])));

const IN_STATE = {
  'Himachal Pradesh': 'HP', Punjab: 'PB', Uttarakhand: 'UT', Haryana: 'HR', Delhi: 'DL', Rajasthan: 'RJ', 'Uttar Pradesh': 'UP',
  Bihar: 'BR', Sikkim: 'SK', 'Arunachal Pradesh': 'AR', Nagaland: 'NL', Manipur: 'MN', Mizoram: 'MZ', Tripura: 'TR', Meghalaya: 'ML',
  Assam: 'AS', 'West Bengal': 'WB', Orissa: 'OR', Chhattisgarh: 'CT', 'Madhya Pradesh': 'MP', Gujarat: 'GJ', Maharashtra: 'MH',
  Telangana: 'TG', 'Andhra Pradesh': 'AP', Karnataka: 'KA', Kerala: 'KL', Goa: 'GA', 'Tamil Nadu': 'TN', Puducherry: 'PY',
  Chandigarh: 'CH', 'Daman & Diu': 'DH', 'Dadra & Nagar Haveli': 'DH', 'Andaman & Nicobar': 'AN', Lakshadweep: 'LD',
  'Jammu & Kashmir': 'JK', Jharkhand: 'JH'
};

// Display names for regions, e.g. Japanese prefectures, from the shapes the
// globe already uses.
const regionTopo = JSON.parse(await readFile(path.join(root, 'data', 'regions.topo.json'), 'utf8'));
const REGION_NAMES = Object.fromEntries(regionTopo.objects.regions.geometries.map(g => [g.id, g.properties.name]));

// map(properties) -> { key, name, region } or null to drop the shape.
export const SOURCES = {
  US: {
    source: 'US Census Bureau cartographic boundaries, 119th Congress (cb_2025_us_cd119_20m)',
    simplify: '15%',
    map: p => {
      const st = FIPS[p.STATEFP];
      const cd = p[Object.keys(p).find(k => /^CD\d+FP$/.test(k))];
      if (!st || st === 'DC' || cd === 'ZZ') return null;
      const n = Number(cd);
      return n === 0
        ? { key: `${st}-AL`, name: `${US_NAMES[st]} at-large`, region: st }
        : { key: `${st}-${n}`, name: `${US_NAMES[st]} ${ordinal(n)}`, region: st };
    }
  },
  GB: {
    source: 'ONS Westminster Parliamentary Constituencies (July 2024) UK BUC',
    simplify: '9%',
    map: p => {
      const code = p.PCON24CD ?? p.pcon19cd;
      const region = { E14: 'ENG', W07: 'WLS', S14: 'SCT', N05: 'NI', N06: 'NI' }[code?.slice(0, 3)];
      return region ? { key: code, name: p.PCON24NM ?? p.pcon19nm, region } : null;
    }
  },
  CA: {
    source: 'Elections Canada federal electoral districts, 2023 Representation Order',
    simplify: '1.2%',
    land: 'CAN',
    // Thousands of small Arctic islands cost more to draw than they show.
    islands: '1000km2',
    map: p => {
      const region = { 10: 'NL', 11: 'PE', 12: 'NS', 13: 'NB', 24: 'QC', 35: 'ON', 46: 'MB', 47: 'SK', 48: 'AB', 59: 'BC', 60: 'YT', 61: 'NT', 62: 'NU' }[String(p.FED_NUM).slice(0, 2)];
      return region ? { key: String(p.FED_NUM), name: p.ED_NAMEE ?? p.ENNAME, region } : null;
    }
  },
  AU: {
    source: 'ABS Commonwealth Electoral Divisions 2025 (ASGS Edition 3)',
    simplify: '0.7%',
    map: p => {
      const code = String(p.CED_CODE25 ?? '');
      const region = { 1: 'NSW', 2: 'VIC', 3: 'QLD', 4: 'SA', 5: 'WA', 6: 'TAS', 7: 'NT', 8: 'ACT' }[code[0]];
      if (!region || /no usual address|migratory/i.test(p.CED_NAME25 ?? '')) return null;
      return { key: code, name: p.CED_NAME25, region };
    }
  },
  DE: {
    source: 'Die Bundeswahlleiterin, Wahlkreise for the 2025 Bundestag election (generalised)',
    simplify: '22%',
    map: p => {
      const region = { 1: 'SH', 2: 'HH', 3: 'NI', 4: 'HB', 5: 'NW', 6: 'HE', 7: 'RP', 8: 'BW', 9: 'BY', 10: 'SL', 11: 'BE', 12: 'BB', 13: 'MV', 14: 'SN', 15: 'ST', 16: 'TH' }[Number(p.LAND_NR)];
      return region ? { key: String(Number(p.WKR_NR)), name: p.WKR_NAME, region } : null;
    }
  },
  FR: {
    source: 'Circonscriptions législatives, data.gouv.fr (metropolitan France)',
    simplify: '2.2%',
    map: p => {
      const region = FR_DEPT_REGION[p.codeDepartement];
      if (!region) return null;
      const n = Number(p.codeCirconscription.slice(-2));
      return { key: p.codeCirconscription, name: `${p.nomDepartement} ${ordinal(n)}`, region };
    }
  },
  IN: {
    source: 'DataMeet parliamentary constituencies (2019, simplified)',
    simplify: '8%',
    map: p => {
      let region = IN_STATE[p.st_name];
      if (!region) return null;
      if (region === 'JK' && /ladakh/i.test(p.pc_name)) region = 'LA';
      const n = region === 'LA' ? 1 : region === 'DH' ? (p.st_name.startsWith('Daman') ? 2 : 1) : Number(p.pc_no);
      return { key: `${region}-${n}`, name: p.pc_name, region };
    }
  },
  JP: {
    source: 'japan-choropleth electoral districts (2022 redistricting), compiled from public-domain data',
    simplify: '2.5%',
    map: p => {
      const pref = String(p.prefectureCode ?? '').padStart(2, '0');
      const n = Number(p.districtNumber);
      const prefName = REGION_NAMES[`JP-${pref}`];
      return prefName && n ? { key: `${pref}-${n}`, name: `${prefName} ${ordinal(n)}`, region: pref } : null;
    }
  }
};

// Rough planar area in degrees², enough to spot a district that cleaning
// shrank to a sliver.
function area(g) {
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
  let total = 0;
  for (const rings of polys) {
    rings.forEach((ring, i) => {
      const k = Math.cos(((ring[0]?.[1] ?? 0) * Math.PI) / 180);
      let a = 0;
      for (let j = 0, n = ring.length - 1; j < n; j++) a += ring[j][0] * k * ring[j + 1][1] - ring[j + 1][0] * k * ring[j][1];
      total += (i === 0 ? 1 : -1) * Math.abs(a / 2);
    });
  }
  return total;
}

function mergeGeometry(a, b) {
  const polys = g => (g.type === 'Polygon' ? [g.coordinates] : g.coordinates);
  return { type: 'MultiPolygon', coordinates: [...polys(a), ...polys(b)] };
}

async function readSource(file) {
  if (/\.(geo)?json$/i.test(file)) return JSON.parse(await readFile(file, 'utf8'));
  let dir = file;
  if (/\.zip$/i.test(file)) {
    dir = await mkdtemp(path.join(os.tmpdir(), 'districts-'));
    execFileSync('unzip', ['-o', '-q', file, '-d', dir]);
  }
  const files = await readdir(dir, { recursive: true });
  const shp = files.find(f => f.toLowerCase().endsWith('.shp'));
  if (!shp) throw new Error(`No .shp in ${file}`);
  const base = path.join(dir, shp.slice(0, -4));
  const input = {};
  for (const ext of ['shp', 'dbf', 'prj', 'shx', 'cpg']) {
    input[`in.${ext}`] = await readFile(`${base}.${ext}`).catch(() => null);
    if (!input[`in.${ext}`]) delete input[`in.${ext}`];
  }
  const out = await mapshaper.applyCommands('-i in.shp encoding=utf8 -proj wgs84 -o out.json format=geojson', input);
  return JSON.parse(out['out.json']);
}

async function main() {
  const cfg = SOURCES[code];
  if (!cfg || !src) {
    console.error(`Usage: node scripts/build-districts.mjs <${Object.keys(SOURCES).join('|')}> <source file>`);
    process.exit(1);
  }
  const geo = await readSource(src);
  const features = [];
  for (const f of geo.features) {
    const m = cfg.map(f.properties ?? {});
    if (!m || !f.geometry) continue;
    features.push({ type: 'Feature', properties: { id: `${code}-${m.key}`, name: m.name, region: m.region }, geometry: f.geometry });
  }
  // Pass 1: snap + clean make neighbours share one edge, which keeps the
  // TopoJSON small for sources whose polygons were drawn separately. Cleaning
  // can empty a district that overlaps its neighbour in the source, so those
  // get their original outline back before pass 2 simplifies everything.
  const cleaned = JSON.parse((await mapshaper.applyCommands(
    '-i in.json snap -clean -dissolve2 id copy-fields=name,region -o out.json format=geojson',
    { 'in.json': { type: 'FeatureCollection', features } }
  ))['out.json']);
  const original = new Map();
  for (const f of features) {
    const id = f.properties.id;
    original.set(id, original.has(id) ? { ...f, geometry: mergeGeometry(original.get(id).geometry, f.geometry) } : f);
  }
  const kept = new Set();
  const repaired = [];
  for (const f of cleaned.features) {
    kept.add(f.properties.id);
    const before = original.get(f.properties.id).geometry;
    if (!f.geometry || area(f.geometry) < area(before) * 0.5) {
      f.geometry = before;
      repaired.push(f.properties.name);
    }
  }
  for (const [id, f] of original) {
    if (!kept.has(id)) {
      cleaned.features.push(f);
      repaired.push(f.properties.name);
    }
  }
  if (repaired.length) console.log(`${code}: restored ${repaired.join(', ')}`);

  let shapes = cleaned;
  if (cfg.land) {
    if (!landFile) throw new Error(`${code} districts run out over the sea: pass --land=<Natural Earth admin-1 file>`);
    const ne = JSON.parse(await readFile(landFile, 'utf8'));
    const land = { type: 'FeatureCollection', features: ne.features.filter(f => f.properties.adm0_a3 === cfg.land) };
    shapes = JSON.parse((await mapshaper.applyCommands(`-i in.json -clip land.json ${cfg.islands ? `-filter-islands min-area=${cfg.islands} ` : ''}-o out.json format=geojson`,
      { 'in.json': cleaned, 'land.json': land }))['out.json']);
    const lost = cleaned.features.filter(f => !shapes.features.some(g => g.properties.id === f.properties.id && g.geometry));
    if (lost.length) throw new Error(`Clipping to land removed ${lost.map(f => f.properties.name).join(', ')}`);
  }

  const result = await mapshaper.applyCommands(
    `-i in.json -simplify ${cfg.simplify} weighted keep-shapes ` +
    '-rename-layers districts -o out.json format=topojson quantization=100000 id-field=id',
    { 'in.json': shapes }
  );
  await mkdir(path.join(root, 'data', 'districts'), { recursive: true });
  const target = path.join(root, 'data', 'districts', `${code}${set ? `.${set}` : ''}.topo.json`);
  await writeFile(target, result['out.json']);
  const topo = JSON.parse(result['out.json']);
  const regions = new Set(topo.objects.districts.geometries.map(g => g.properties.region));
  console.log(`${code}: ${topo.objects.districts.geometries.length} districts in ${regions.size} regions, ${(result['out.json'].length / 1024).toFixed(0)} KB`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
