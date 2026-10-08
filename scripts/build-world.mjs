#!/usr/bin/env node
// Builds the country outlines from world-atlas:
//   data/world-coarse.topo.json  world-atlas 110m
//   data/world-detail.topo.json  a lighter cut of world-atlas 50m used when the
//                                globe is zoomed in. Full 50m costs ~30 ms a frame
//                                to project; this keeps coastlines crisp at
//                                country zoom for a fraction of that.
//
//   node scripts/build-world.mjs path/to/countries-50m.json path/to/countries-110m.json
//
// world-atlas follows Natural Earth's lines of control, so both files redraw two
// borders as they are internationally recognised: Crimea moves from Russia to
// Ukraine, and the part of Western Sahara that Morocco administers, south of
// the 27°40′ parallel, moves from Morocco to Western Sahara.

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import mapshaper from 'mapshaper';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [detailSrc, coarseSrc] = process.argv.slice(2);
if (!detailSrc || !coarseSrc) {
  console.error('Usage: node scripts/build-world.mjs <countries-50m.json> <countries-110m.json>');
  process.exit(1);
}

const topojson = {};
vm.runInNewContext(await readFile(path.join(root, 'js', 'vendor', 'topojson.min.js'), 'utf8'), { exports: topojson, module: {} });

function crimeaToUkraine(topo) {
  const countries = topo.objects.countries.geometries;
  const ru = countries.find(g => g.id === '643');
  const ua = countries.find(g => g.id === '804');
  const parts = ru.type === 'MultiPolygon' ? ru.arcs : [ru.arcs];
  const inCrimea = poly => topojson.feature(topo, { type: 'Polygon', arcs: poly }).geometry.coordinates[0]
    .every(([x, y]) => x > 32 && x < 36.8 && y > 44.2 && y < 46.3);
  const crimea = parts.filter(inCrimea);
  if (crimea.length !== 1) throw new Error(`Expected one Crimean polygon in Russia, found ${crimea.length}`);
  ru.type = 'MultiPolygon';
  ru.arcs = parts.filter(p => !inCrimea(p));
  Object.assign(ua, topojson.mergeArcs(topo, [ua, { type: 'Polygon', arcs: crimea[0] }]));
  return topo;
}

const westernSahara =
  "-filter 'id == \"504\"' target=countries + name=north -clip bbox=-20,27.6667,0,37 target=north " +
  "-filter 'id == \"504\" || id == \"732\"' target=countries + name=sahara -clip bbox=-20,10,0,27.6667 target=sahara " +
  "-each 'id = \"732\"; name = \"W. Sahara\"' target=sahara -dissolve2 id copy-fields=name target=sahara " +
  "-filter 'id != \"504\" && id != \"732\"' target=countries -merge-layers target=countries,north,sahara name=countries force ";

const build = async (src, simplify = '') => {
  const out = await mapshaper.applyCommands(
    `-i world.json id-field=id ${westernSahara}${simplify}` +
    '-o out.json format=topojson quantization=100000 id-field=id target=countries,land',
    { 'world.json': await readFile(src, 'utf8') }
  );
  return crimeaToUkraine(JSON.parse(out['out.json']));
};
const outputs = {
  'world-detail.topo.json': await build(detailSrc, '-simplify 18% weighted keep-shapes target=countries,land -filter-slivers min-area=30km2 target=countries,land '),
  'world-coarse.topo.json': await build(coarseSrc)
};
for (const [file, topo] of Object.entries(outputs)) {
  const json = JSON.stringify(topo);
  await writeFile(path.join(root, 'data', file), json);
  console.log(`${file}: ${topo.objects.countries.geometries.length} countries, ${(json.length / 1024).toFixed(0)} KB`);
}
