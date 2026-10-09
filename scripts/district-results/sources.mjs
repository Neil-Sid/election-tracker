// Where each election's results by district come from, and the boundary set
// they were won on (null for today's map, data/districts/<CODE>.topo.json).
// Wikipedia articles are pinned to the revision the figures were checked against.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const cache = path.join(root, '.cache', 'district-results');

const house = (year, revid, set) => ({
  id: `us-house-${year}`, code: 'US', set, file: `us${year}.txt`,
  url: `https://en.wikipedia.org/w/index.php?oldid=${revid}&action=raw`,
  source: { name: 'Wikipedia', url: `https://en.wikipedia.org/wiki/${year}_United_States_House_of_Representatives_elections`, revid }
});
// The id is the UK Parliament results service's number for the general election.
const commons = (year, n, set) => ({
  id: `gb-commons-${year}`, code: 'GB', set, file: `uk${year}.csv`,
  url: `https://electionresults.parliament.uk/general-elections/${n}/candidacies.csv`,
  source: { name: 'UK Parliament election results', url: `https://electionresults.parliament.uk/general-elections/${n}` }
});
const ridings = (year, dir, set) => {
  const url = `https://www.elections.ca/res/rep/off/${dir}/data_donnees/table_tableau12.csv`;
  return { id: `ca-house-${year}`, code: 'CA', set, file: `ca${year}.csv`, url, source: { name: 'Elections Canada', url } };
};

export const ELECTIONS = [
  house(2012, 1366438368, 'cd113'), house(2014, 1372166897, 'cd113'), house(2016, 1373358046, 'cd115'),
  house(2018, 1374340226, 'cd116'), house(2020, 1375626056, 'cd117'), house(2022, 1376665229, 'cd118'), house(2024, 1378308388, null),
  commons(2010, 1, '2010'), commons(2015, 2, '2010'), commons(2017, 3, '2010'), commons(2019, 4, '2010'), commons(2024, 6, null),
  ridings(2015, 'ovr2015app/41', '2013'), ridings(2019, 'ovr2019app/51', '2013'), ridings(2021, 'ovr2021app/53', '2013'), ridings(2025, 'ovrGE45/62', null)
];

// Boundary files for the earlier sets, built with scripts/build-districts.mjs.
// North Carolina voted in 2020 on its court-ordered 2019 plan, which no Census
// file has; cd117.mjs swaps it into the 116th Congress map.
export const BOUNDARIES = {
  'us_cd113.zip': 'https://www2.census.gov/geo/tiger/GENZ2013/cb_2013_us_cd113_20m.zip',
  'us_cd115.zip': 'https://www2.census.gov/geo/tiger/GENZ2016/shp/cb_2016_us_cd115_20m.zip',
  'us_cd116.zip': 'https://www2.census.gov/geo/tiger/GENZ2018/shp/cb_2018_us_cd116_20m.zip',
  'us_cd118.zip': 'https://www2.census.gov/geo/tiger/GENZ2022/shp/cb_2022_us_cd118_20m.zip',
  'nc_2019.zip': 'https://webservices.ncleg.gov/ViewBillDocument/2019/6953/0/HB%201029,%203rd%20Edition%20-%20Shapefile',
  'gb_2010.geojson': 'https://services1.arcgis.com/ESMARspQHYMw9BZ9/arcgis/rest/services/WPC_Dec_2019_UGCB_UK_2022/FeatureServer/0/query?where=1%3D1&outFields=pcon19cd,pcon19nm&outSR=4326&f=geojson',
  'ca_2013.zip': 'https://ftp.maps.canada.ca/pub/elections_elections/Electoral-districts_Circonscription-electorale/federal_electoral_districts_boundaries_2015/federal_electoral_districts_boundaries_2015_shp_en.zip'
};
