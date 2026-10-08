import { nextOffices, nextText } from './status.js';
import { loadCountry } from './data.js';
import { fmtDate, fmtLongDate, fmtFullDate, daysUntil } from './format.js';

export function renderHome(panel, ctx) {
  const { index, schedule, globe, statuses } = ctx;
  const byCode = new Map(index.countries.map(c => [c.code, c]));
  let hoverTimer;

  globe.unfocus();
  ctx.setLegend(`
    <span><i class="k live"></i>Live</span>
    <span><i class="k soon"></i>Within 45 days</span>
    <span><i class="k"></i>Tracked</span>`);

  panel.innerHTML = `
    <div class="home">
      <header class="intro">
        <h1>Elections around the world.</h1>
      </header>
      <a class="feature"></a>
      <section class="block">
        <h2 class="block-title">Coming up</h2>
        <ol class="calendar"></ol>
      </section>
      <section class="block">
        <h2 class="block-title">Countries</h2>
        <ul class="roster"></ul>
      </section>
      <section class="block">
        <h2 class="block-title">Latest results</h2>
        <ul class="recent"><li class="muted">Loading…</li></ul>
      </section>
      <p class="fineprint">National results are official figures${ctx.index.asOf ? `, as of ${fmtFullDate(ctx.index.asOf)}` : ''}. Each country page names its source and says which parts of its map are illustrative.</p>
    </div>`;

  const feature = panel.querySelector('.feature');
  const calendar = panel.querySelector('.calendar');
  const roster = panel.querySelector('.roster');
  const recent = panel.querySelector('.recent');

  render();
  loadRecent();
  ctx.onLive = render;

  ctx.setGlobeHandlers({
    countryHover(meta, feat, event) {
      if (!feat) {
        globe.hideTip();
        markRow(null);
        return;
      }
      if (!meta) {
        globe.showTip(`<span class="tip-muted">${feat.properties.name}</span>`, event);
        markRow(null);
        return;
      }
      const s = statuses.get(meta.code);
      globe.showTip(`
        <strong>${meta.name}</strong>
        <span>${nextText(s)}</span>
        <em>Click for results</em>`, event);
      markRow(meta.code);
    },
    countryClick(meta) {
      location.hash = `#/${meta.code}`;
    }
  });

  for (const list of [roster, calendar]) {
    list.addEventListener('pointerover', e => preview(e.target.closest('a')?.dataset.code));
    list.addEventListener('focusin', e => preview(e.target.closest('a')?.dataset.code));
    list.addEventListener('pointerleave', () => {
      clearTimeout(hoverTimer);
      globe.highlight(null);
    });
  }

  return () => {
    clearTimeout(hoverTimer);
    globe.highlight(null);
  };

  function preview(code) {
    if (!code) return;
    clearTimeout(hoverTimer);
    hoverTimer = setTimeout(() => {
      globe.highlight(code);
      globe.flyTo(byCode.get(code).marker, { zoom: 1.15 });
    }, 140);
  }

  function markRow(code) {
    roster.querySelectorAll('a').forEach(a => a.classList.toggle('hl', a.dataset.code === code));
  }

  function render() {
    const rows = index.countries
      .map(c => ({ c, s: statuses.get(c.code) }))
      .sort((a, b) => a.s.rank - b.s.rank || (a.s.next?.days ?? 1e9) - (b.s.next?.days ?? 1e9));
    const upcoming = schedule
      .map(e => ({ ...e, days: daysUntil(e.date) }))
      .filter(e => e.days >= 0)
      .sort((a, b) => a.days - b.days);
    const live = rows.filter(r => r.s.kind === 'live');

    if (live.length) {
      const { c, s } = live[0];
      feature.href = `#/${c.code}`;
      feature.className = 'feature is-live';
      feature.innerHTML = `
        <p class="eyebrow"><i class="live-dot"></i>Counting now</p>
        <div class="count"><span class="num">${s.liveElection.reporting ?? 0}%</span><span class="unit">counted</span></div>
        <p class="what">${c.name} · ${s.liveElection.office}</p>
        <p class="when">Updates every 2 minutes</p>`;
    } else if (upcoming[0]) {
      const e = upcoming[0];
      const c = byCode.get(e.country);
      const same = upcoming.filter(u => u.country === e.country && u.date === e.date);
      feature.href = `#/${c.code}`;
      feature.className = 'feature';
      feature.innerHTML = `
        <p class="eyebrow">Next election</p>
        <div class="count">${e.days === 0
          ? '<span class="num">Today</span>'
          : `<span class="num">${e.days}</span><span class="unit">${e.days === 1 ? 'day' : 'days'}</span>`}</div>
        <p class="what">${c.name} · ${same.map(u => (u.note ? `${u.office} ${u.note.toLowerCase()}` : u.office)).join(' & ')}</p>
        <p class="when">${fmtLongDate(e.date)}</p>`;
    }

    calendar.innerHTML = upcoming.slice(0, 8).map(e => {
      const c = byCode.get(e.country);
      const d = new Date(e.date + 'T00:00:00');
      return `
        <li><a href="#/${c.code}" data-code="${c.code}">
          <time datetime="${e.date}" class="${e.tentative ? 'tentative' : ''}">
            <span class="mo">${e.tentative ? 'Est.' : d.toLocaleDateString('en-GB', { month: 'short' })}</span>
            <span class="dy">${e.tentative ? d.getFullYear().toString().slice(2) : d.getDate()}</span>
          </time>
          <span class="cal-main"><b>${c.name}</b><span>${e.office}${e.note ? ` · ${e.note}` : ''}</span></span>
          <span class="cal-when">${e.tentative ? `Expected ${d.getFullYear()}` : e.days <= 60 ? `In ${e.days} days` : d.getFullYear()}</span>
        </a></li>`;
    }).join('');

    roster.innerHTML = rows.map(({ c, s }) => `
      <li><a href="#/${c.code}" data-code="${c.code}">
        <span class="r-name">${c.name}</span>
        <span class="r-sub">${s.kind === 'live' ? s.liveElection.office : nextOffices(s)}</span>
        <span class="r-status ${s.kind}">${s.kind === 'live' ? '<i class="live-dot"></i>' : ''}${s.label}</span>
      </a></li>`).join('');
  }

  async function loadRecent() {
    const countries = await Promise.all(index.countries.map(c => loadCountry(c.code).catch(() => null)));
    if (!panel.contains(recent)) return;
    const items = countries.filter(Boolean).flatMap(country => country.elections
      .filter(e => e.status === 'final')
      .map(e => {
        const view = e.rounds ? e.rounds.at(-1) : e;
        const win = view.candidates.find(c => c.winner) ?? view.candidates[0];
        const runoff = e.call?.status === 'runoff' ? view.candidates.filter(c => c.advanced) : null;
        return { country, e, win, runoff, party: country.parties[win.party] ?? { color: '#8e8e93' } };
      }))
      .sort((a, b) => b.e.date.localeCompare(a.e.date))
      .slice(0, 8);
    recent.innerHTML = items.map(({ country, e, win, runoff, party }) => `
      <li><a href="#/${country.code}/${e.id}">
        <span class="rc-main"><b>${country.name}</b><span>${e.office}${e.note ? ` ${e.note.toLowerCase()}` : ''} · ${fmtDate(e.date)}${e.source ? ` · ${e.source.short}` : ''}</span></span>
        <span class="rc-win">${runoff?.length
          ? `Run-off: ${runoff.map(c => c.short ?? (c.name.split(' ').slice(1).join(' ') || c.name)).join(' v ')}`
          : `<i class="sw" style="background:${party.color}"></i>${win.name}`}</span>
      </a></li>`).join('');
  }
}
