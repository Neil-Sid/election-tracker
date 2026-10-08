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

// Only Morocco and Western Sahara go through mapshaper's clipping, which would
// join the shapes split at the 180th meridian (Russia, Fiji) if it ran on the
// whole map. Their new outlines are added as fresh arcs.
async function westernSahara(topo) {
  const shape = id => topo.objects.countries.geometries.find(g => g.id === id);
  const features = ['504', '732'].map(id => ({ ...topojson.feature(topo, shape(id)), properties: { id } }));
  const out = await mapshaper.applyCommands(
    "-i in.json -filter 'id == \"504\"' + name=north -clip bbox=-20,27.6667,0,37 target=north " +
    "-clip bbox=-20,10,0,27.6667 target=in -each 'id = \"732\"' target=in -dissolve2 id target=in " +
    '-merge-layers target=north,in name=out force -o out.json format=geojson target=out',
    { 'in.json': { type: 'FeatureCollection', features } }
  );
  const { scale: [sx, sy], translate: [tx, ty] } = topo.transform;
  const arcFor = ring => {
    const q = ring.map(([x, y]) => [Math.round((x - tx) / sx), Math.round((y - ty) / sy)]);
    topo.arcs.push(q.map((p, i) => (i ? [p[0] - q[i - 1][0], p[1] - q[i - 1][1]] : p)));
    return topo.arcs.length - 1;
  };
  for (const { properties, geometry } of JSON.parse(out['out.json']).features) {
    const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
    Object.assign(shape(properties.id), { type: 'MultiPolygon', arcs: polygons.map(rings => rings.map(r => [arcFor(r)])) });
  }
  return topo;
}

const detail = await mapshaper.applyCommands(
  '-i world.json -simplify 18% weighted keep-shapes -filter-slivers min-area=30km2 ' +
  '-o detail.json format=topojson quantization=100000 id-field=id',
  { 'world.json': await readFile(detailSrc, 'utf8') }
);
const outputs = {
  'world-detail.topo.json': crimeaToUkraine(await westernSahara(JSON.parse(detail['detail.json']))),
  'world-coarse.topo.json': crimeaToUkraine(await westernSahara(JSON.parse(await readFile(coarseSrc, 'utf8'))))
};
for (const [file, topo] of Object.entries(outputs)) {
  const json = JSON.stringify(topo);
  await writeFile(path.join(root, 'data', file), json);
  console.log(`${file}: ${topo.objects.countries.geometries.length} countries, ${(json.length / 1024).toFixed(0)} KB`);
}
