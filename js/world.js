import { asset } from './data.js';

const COARSE = asset('data/world-coarse.topo.json');
const DETAIL = asset('data/world-detail.topo.json');
const cache = new Map();

function once(key, load) {
  if (!cache.has(key)) cache.set(key, load().catch(err => { cache.delete(key); throw err; }));
  return cache.get(key);
}

// d3 treats a ring's direction as meaning: clockwise encloses the shape,
// anticlockwise encloses everything else. Simplifying shapes that cross the
// 180° meridian (Russia, Fiji) can flip rings, which then paint the whole
// globe, so any polygon covering more than a hemisphere is turned around.
function fixWinding(feature) {
  const g = feature.geometry;
  if (!g) return feature;
  const fix = rings => (d3.geoArea({ type: 'Polygon', coordinates: rings }) > 2 * Math.PI ? rings.map(r => [...r].reverse()) : rings);
  if (g.type === 'Polygon') g.coordinates = fix(g.coordinates);
  if (g.type === 'MultiPolygon') g.coordinates = g.coordinates.map(fix);
  return feature;
}

// Centre, angular radius and lon/lat box per shape, so the globe can skip
// anything off screen and hit-test without touching every polygon.
function prep(features, idOf) {
  return features.map(fixWinding).map(feature => {
    const c = d3.geoCentroid(feature);
    let r = 0;
    d3.geoStream(feature, {
      point(x, y) {
        const d = d3.geoDistance(c, [x, y]);
        if (d > r) r = d;
      },
      lineStart() {}, lineEnd() {}, polygonStart() {}, polygonEnd() {}, sphere() {}
    });
    return { id: idOf(feature), name: feature.properties?.name, feature, c, r, bounds: d3.geoBounds(feature) };
  });
}

// Level of detail. Each vertex gets an importance weight (the area of the
// triangle it forms with its neighbours, in steradians) and each shape keeps a
// few pre-thinned copies. The globe draws the coarsest copy whose error is
// under about half a screen pixel, so zoomed-out views project far fewer
// points while close-ups keep full detail.
const LEVELS = [2e-8, 1e-7, 4e-7, 1.6e-6, 6.4e-6];
function withDetail(topo, name, shapes) {
  const pre = topojson.presimplify(topo, topojson.sphericalTriangleArea);
  shapes.forEach(s => { s.lods = []; });
  for (const w of LEVELS) {
    const simple = topojson.simplify(pre, w);
    topojson.feature(simple, simple.objects[name]).features.forEach((f, i) => shapes[i]?.lods.push([w, fixWinding(f)]));
  }
  return shapes;
}

// Pick the geometry to draw for a shape at a given tolerance (steradians).
export function atDetail(shape, tolerance) {
  let g = shape.feature;
  for (const [w, f] of shape.lods ?? []) {
    if (w > tolerance) break;
    g = f;
  }
  return g;
}

async function loadTopo(url, lod = false) {
  const topo = await fetch(url).then(r => r.json());
  const shapes = prep(topojson.feature(topo, topo.objects.countries).features, f => f.id ?? f.properties?.name);
  return lod ? withDetail(topo, 'countries', shapes) : shapes;
}

// 110m for the whole planet; a pre-simplified 50m cut for country zoom.
export const loadWorld = () => once('coarse', () => loadTopo(COARSE));
export const loadDetail = () => once('detail', () => loadTopo(DETAIL, true));

export const loadRegions = () => once('regions', async () => {
  const topo = await fetch(asset('data/regions.topo.json')).then(r => r.json());
  const all = withDetail(topo, 'regions', prep(topojson.feature(topo, topo.objects.regions).features, f => f.id));
  const byCountry = new Map();
  for (const r of all) {
    const code = r.id.split('-')[0];
    r.abbr = r.id.slice(code.length + 1);
    if (!byCountry.has(code)) byCountry.set(code, []);
    byCountry.get(code).push(r);
  }
  return {
    forCountry: code => byCountry.get(code) ?? [],
    names: code => (byCountry.get(code) ?? []).map(r => ({ abbr: r.abbr, name: r.name }))
  };
});

export function contains(shape, lonlat) {
  const [[w, s], [e, n]] = shape.bounds;
  const [lon, lat] = lonlat;
  if (lat < s || lat > n) return false;
  if (w <= e ? lon < w || lon > e : lon < w && lon > e) return false;
  return d3.geoContains(shape.feature, lonlat);
}

// Single-member districts (congressional districts, constituencies, ridings):
// today's in <CODE>.topo.json, earlier boundary sets in <CODE>.<set>.topo.json.
// Keys look like "CA-12": the part after the country code, which is what
// election data uses.
export const loadDistricts = (code, set) => once(`districts-${code}${set ? `.${set}` : ''}`, async () => {
  const res = await fetch(asset(`data/districts/${code}${set ? `.${set}` : ''}.topo.json`));
  if (!res.ok) return [];
  const topo = await res.json();
  const shapes = prep(topojson.feature(topo, topo.objects.districts).features, f => f.id).map(s => {
    s.key = s.id.slice(code.length + 1);
    s.region = s.feature.properties.region;
    return s;
  });
  return withDetail(topo, 'districts', shapes);
});
