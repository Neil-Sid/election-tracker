const cache = new Map();

// A deploy adds an import map (scripts/stamp.mjs) that gives every file a
// content-hash query, so browsers can keep it for a year. import.meta.resolve
// applies that map. Run locally there is no map and paths stay unversioned.
export const asset = path => import.meta.resolve(`../${path}`);

async function getJSON(url, { optional = false, fresh = false } = {}) {
  if (!fresh && cache.has(url)) return cache.get(url);
  const res = await fetch(url, fresh ? { cache: 'no-cache' } : {});
  if (optional && res.status === 404) return null;
  if (!res.ok) throw new Error(`Could not load ${url} (${res.status})`);
  const json = await res.json();
  cache.set(url, json);
  return json;
}

export const loadIndex = () => getJSON(asset('data/index.json'));
export const loadSchedule = () => getJSON(asset('data/schedule.json'));
export const loadSources = () => getJSON(asset('data/sources.json'), { optional: true });

// Counts in progress, by country. The cron writes data/live/<CODE>.json on
// election night and deletes it once the count is final.
export const live = new Map();
const checked = new Map();

export const sinceChecked = code => Date.now() - (checked.get(code) ?? 0);

// At start-up the manifest says which countries have a live file.
export async function loadLive() {
  const manifest = await getJSON('data/live/index.json', { optional: true, fresh: true });
  await Promise.all((manifest?.live ?? []).map(checkLive));
}

// Re-reads one country's live file. Resolves to whether anything changed.
export async function checkLive(code) {
  checked.set(code, Date.now());
  const file = await getJSON(`data/live/${code}.json`, { optional: true, fresh: true });
  const before = live.get(code);
  const now = file?.elections?.some(e => e.status === 'live') ? file : undefined;
  // A finished count is folded into the country file, which the import map
  // still pins at its old version, so that file is fetched again by hand.
  if (before && !now) {
    cache.set(asset(`data/countries/${code}.json`), await getJSON(`data/countries/${code}.json`, { fresh: true }));
  }
  if (now) live.set(code, now);
  else live.delete(code);
  return before?.updatedAt !== now?.updatedAt;
}

// Earlier elections for countries flagged `history` in data/index.json, built
// by scripts/build-history.mjs.
export const loadHistory = code => getJSON(asset(`data/history/${code}.json`));

// Results by district for a past election that has them (districtSet).
export const loadPastDistricts = id => getJSON(asset(`data/history/districts/${id}.json`));

export async function loadCountry(code) {
  return mergeLive(await getJSON(asset(`data/countries/${code}.json`)), live.get(code));
}

// A live file overrides matching elections by id and prepends any new ones,
// so the page shows tonight's count instead of the previous result.
function mergeLive(base, file) {
  if (!file) return base;
  const elections = base.elections.map(e => {
    const l = file.elections.find(x => x.id === e.id);
    return l ? { ...e, ...l } : e;
  });
  for (const l of file.elections) {
    if (elections.some(e => e.id === l.id)) continue;
    const at = elections.findIndex(e => e.office === l.office);
    elections.splice(at < 0 ? 0 : at, 0, l);
  }
  return { ...base, parties: { ...base.parties, ...file.parties }, elections, liveUpdatedAt: file.updatedAt };
}
