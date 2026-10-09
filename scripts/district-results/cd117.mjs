#!/usr/bin/env node
// The 117th Congress (elected 2020) sat on the 116th's districts everywhere but
// North Carolina, which voted on its court-ordered 2019 plan (HB 1029, S.L.
// 2019-249). The Census Bureau published no 117th file, so this swaps the plan
// into cb_2018_us_cd116_20m, clipped to the same coastline and simplified to
// about the same detail, and writes .cache/district-results/us_cd117.json for
//   node scripts/build-districts.mjs US .cache/district-results/us_cd117.json --set=cd117
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import mapshaper from 'mapshaper';
import { cache } from './sources.mjs';

async function shapefile(zip) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'cd117-'));
  execFileSync('unzip', ['-o', '-q', path.join(cache, zip), '-d', dir]);
  const shp = (await readdir(dir, { recursive: true })).find(f => f.toLowerCase().endsWith('.shp'));
  const base = path.join(dir, shp.slice(0, -4));
  const input = {};
  for (const ext of ['shp', 'dbf', 'prj', 'shx', 'cpg']) {
    const buf = await readFile(`${base}.${ext}`).catch(() => null);
    if (buf) input[`in.${ext}`] = buf;
  }
  return input;
}
const geojson = async (cmd, input) => JSON.parse((await mapshaper.applyCommands(`${cmd} -o out.json format=geojson`, input))['out.json']);

const cd116 = await geojson('-i in.shp encoding=utf8 -proj wgs84', await shapefile('us_cd116.zip'));
const coast = { type: 'FeatureCollection', features: cd116.features.filter(f => f.properties.STATEFP === '37') };
const plan = await geojson('-i in.shp -proj wgs84 -clip land.json -simplify dp interval=1200 keep-shapes',
  { ...await shapefile('nc_2019.zip'), 'land.json': coast });
if (plan.features.length !== 13) throw new Error(`expected 13 North Carolina districts, got ${plan.features.length}`);

const features = [
  ...cd116.features.filter(f => f.properties.STATEFP !== '37'),
  ...plan.features.map(f => ({ type: 'Feature', properties: { STATEFP: '37', CD116FP: String(f.properties.DISTRICT).padStart(2, '0') }, geometry: f.geometry }))
];
await writeFile(path.join(cache, 'us_cd117.json'), JSON.stringify({ type: 'FeatureCollection', features }));
console.log(`us_cd117.json: ${features.length} districts, North Carolina from the 2019 plan`);
