#!/usr/bin/env node
// Builds data/world-detail.topo.json, a lighter cut of world-atlas 50m used when
// the globe is zoomed in. Full 50m costs ~30 ms a frame to project; this keeps
// coastlines crisp at country zoom for a fraction of that.
//
//   node scripts/build-world.mjs path/to/countries-50m.json

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mapshaper from 'mapshaper';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = process.argv[2];
if (!src) {
  console.error('Usage: node scripts/build-world.mjs <countries-50m.json>');
  process.exit(1);
}

const pct = process.argv[3] ?? '18%';
const result = await mapshaper.applyCommands(
  `-i world.json -simplify ${pct} weighted keep-shapes -filter-slivers min-area=30km2 ` +
  '-o detail.json format=topojson quantization=100000 id-field=id',
  { 'world.json': await readFile(src, 'utf8') }
);
await writeFile(path.join(root, 'data', 'world-detail.topo.json'), result['detail.json']);
const topo = JSON.parse(result['detail.json']);
const layer = Object.keys(topo.objects)[0];
console.log(`${topo.objects[layer].geometries.length} countries in layer "${layer}", ${(result['detail.json'].length / 1024).toFixed(0)} KB`);
