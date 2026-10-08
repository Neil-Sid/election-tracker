import { loadIndex, loadSchedule, loadSources, loadLive, checkLive, sinceChecked, live, loadCountry, loadHistory } from './data.js';
import { countryStatus, counting } from './status.js';
import { createGlobe } from './globe.js';
import { renderHome } from './home.js';
import { renderCountry } from './country.js';

const panel = document.getElementById('panel');
const pane = document.querySelector('.globe-pane');
const liveNav = document.querySelector('.live-nav');
const hint = pane.querySelector('.globe-hint');
const legend = pane.querySelector('.globe-legend');
const POLL_MS = 2 * 60 * 1000;

const ctx = {
  index: null,
  schedule: null,
  live,
  statuses: new Map(),
  globe: null,
  onLive: null,
  setLegend: html => { legend.innerHTML = html.trim(); },
  setGlobeHandlers: h => ctx.globe.on({
    ...h,
    interact: () => {
      hint.classList.add('gone');
      h.interact?.();
    }
  })
};
let teardown = null;
let seq = 0;

if (matchMedia('(pointer: coarse)').matches) hint.textContent = 'Drag to spin · Pinch to zoom';

async function boot() {
  [ctx.index, ctx.schedule, ctx.sources] = await Promise.all([loadIndex(), loadSchedule(), loadSources(), loadLive()]);
  refreshStatuses();
  ctx.globe = await createGlobe(pane, { countries: ctx.index.countries });
  ctx.globe.setStatuses(ctx.statuses);
  if (new URLSearchParams(location.search).has('debug')) window.globe = ctx.globe;
  pane.querySelector('[data-zoom="in"]').onclick = () => ctx.globe.zoomBy(1.6);
  pane.querySelector('[data-zoom="out"]').onclick = () => ctx.globe.zoomBy(1 / 1.6);
  pane.querySelector('[data-reset]').onclick = () => ctx.globe.reset();
  window.addEventListener('hashchange', route);
  document.addEventListener('visibilitychange', poll);
  setInterval(poll, 10000);
  await route();
}

function refreshStatuses() {
  for (const c of ctx.index.countries) {
    ctx.statuses.set(c.code, countryStatus(c.code, ctx.schedule, ctx.live.get(c.code)));
  }
}

// On election night the page re-reads one live file every two minutes: the
// country on screen, or from the home page each country that is counting. The
// 10-second tick only compares times, so quiet days and hidden tabs make no
// requests.
async function poll() {
  if (document.hidden) return;
  const [raw] = location.hash.replace(/^#\/?/, '').split('/');
  const codes = raw ? [raw.toUpperCase()] : ctx.index.countries.map(c => c.code);
  const due = codes.filter(code => counting(code, ctx.schedule, live) && sinceChecked(code) >= POLL_MS);
  if (!due.length) return;
  const changed = await Promise.all(due.map(code => checkLive(code).catch(() => false)));
  if (!changed.includes(true)) return;
  refreshStatuses();
  ctx.globe.setStatuses(ctx.statuses);
  renderLiveNav();
  ctx.onLive?.();
}

async function route() {
  const id = ++seq;
  teardown?.();
  teardown = null;
  ctx.onLive = null;
  ctx.globe.hideTip();

  const [raw, electionId] = location.hash.replace(/^#\/?/, '').split('/');
  const code = (raw || '').toUpperCase();
  renderLiveNav();

  let dispose;
  if (!code) {
    dispose = renderHome(panel, ctx);
  } else {
    const meta = ctx.index.countries.find(c => c.code === code);
    if (!meta) {
      location.replace('#/');
      return;
    }
    const [country, archive] = await Promise.all([loadCountry(code), meta.history ? loadHistory(code) : null]);
    if (id !== seq) return;
    dispose = renderCountry(panel, ctx, { meta, country, archive, electionId });
  }
  panel.scrollTop = 0;
  panel.classList.remove('enter');
  void panel.offsetWidth;
  panel.classList.add('enter');
  teardown = dispose;
  poll();
}

function renderLiveNav() {
  liveNav.innerHTML = [...ctx.live.keys()].map(code => {
    const c = ctx.index.countries.find(x => x.code === code);
    return `<a href="#/${code}"><i class="live-dot"></i>${c.name}</a>`;
  }).join('');
}

boot().catch(err => {
  console.error(err);
  panel.innerHTML = `<p class="error">${err.message}</p>`;
});
