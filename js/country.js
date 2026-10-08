import { loadCountry } from './data.js';
import { nextText } from './status.js';
import { fmtInt, fmtPct, fmtDate, fmtFullDate, fmtChange, daysUntil, timeAgo, fmtCompact } from './format.js';
import { chamber, duel, historyRows, pollChart } from './charts.js';

// Others, "Against all", vacant seats and seats a source has no results for list after the parties.
const rest = c => ['oth', 'against', 'nis', 'vac', 'vacant'].includes(c.party);

export function renderCountry(panel, ctx, { meta, country: initial, archive, electionId }) {
  const { schedule, globe } = ctx;
  const [term, terms] = meta.regionTerm;
  let country = initial;
  // Earlier elections, newest first (data/history).
  const past = archive?.elections ?? [];
  const offices = [...new Set(country.elections.map(e => e.office))];
  const start = country.elections.find(e => e.id === electionId)
    ?? past.find(e => e.id === electionId)
    ?? country.elections.find(e => e.status === 'live')
    ?? country.elections[0];
  let office = start.office;
  // A past election picked from the year rail; null shows the latest.
  let picked = past.includes(start) ? start : null;
  let allPast = false;
  let roundIdx = null;
  let sim = null;
  let selected = null;
  let showAll = false;
  let sortBy = 'margin';
  let layer = null;
  let filter = '';
  let shownLayer = null;
  const [districtTerm, districtTerms] = meta.districtTerm ?? ['district', 'districts'];

  const party = key => country.parties[key] ?? archive?.parties[key] ?? { name: 'Others', color: '#8e8e93' };
  const latestFor = o => country.elections.find(e => e.office === o);
  const timeline = o => [latestFor(o), ...past.filter(e => e.office === o)];
  const current = () => sim?.election ?? picked ?? latestFor(office);
  const viewOf = el => (el.rounds ? el.rounds[roundIdx ?? el.rounds.length - 1] : el);
  // Elections with single-member districts can be shown by district or by
  // state; districts are the default because they are what voters elect.
  const layerOf = view => (view.districts?.length && layer !== 'regions' ? 'districts' : 'regions');
  const unitsOf = view => (layerOf(view) === 'districts' ? view.districts : view.regions) ?? [];
  const nameFor = (key, view = viewOf(current())) => view.candidates.find(c => c.party === key)?.name ?? party(key).name;

  panel.innerHTML = `
    <div class="country">
      <a class="crumb" href="#/"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3 5 8l5 5"/></svg>All countries</a>
      <header class="c-head">
        <div>
          <h1>${country.name}</h1>
          <p class="sub">${country.about?.system ?? country.subtitle}</p>
        </div>
        <span class="head-status"></span>
      </header>
      <nav class="segmented" aria-label="Office"></nav>
      <nav class="years" aria-label="Election"></nav>
      <div class="election"></div>
      <div class="extras"></div>
      <p class="fineprint"></p>
    </div>`;

  const root = panel.querySelector('.country');
  const headStatus = panel.querySelector('.head-status');
  const seg = panel.querySelector('.segmented');
  const years = panel.querySelector('.years');
  const fineprint = panel.querySelector('.fineprint');
  const electionEl = panel.querySelector('.election');
  const extrasEl = panel.querySelector('.extras');

  globe.focusCountry(meta, styleFn());
  ctx.setGlobeHandlers({
    countryHover(m, feat, e) {
      if (!feat || m?.code === meta.code) return globe.hideTip();
      globe.showTip(m
        ? `<strong>${m.name}</strong><span>${nextText(ctx.statuses.get(m.code))}</span><em>Click to open</em>`
        : `<span class="tip-muted">${feat.properties.name}</span>`, e);
    },
    countryClick(m) {
      if (m.code !== meta.code) location.hash = `#/${m.code}`;
    },
    regionHover(abbr, e) {
      markRow(abbr);
      if (!abbr) return globe.hideTip();
      globe.showTip(regionTip(abbr), e);
    },
    regionClick(abbr) {
      select(abbr === selected ? null : abbr, true);
    }
  });

  seg.addEventListener('click', e => {
    const o = e.target.closest('button')?.dataset.office;
    if (!o || o === office) return;
    stopSim(false);
    office = o;
    picked = null;
    roundIdx = null;
    selected = null;
    showAll = false;
    allPast = false;
    history.replaceState(null, '', `#/${meta.code}/${latestFor(o).id}`);
    globe.selectRegion(null);
    renderAll();
  });

  root.addEventListener('click', e => {
    const t = e.target;
    const pick = t.closest('[data-election]');
    if (pick) return openElection(pick.dataset.election, Boolean(pick.closest('.extras')));
    if (t.closest('[data-past-all]')) {
      allPast = !allPast;
      renderExtras();
      return;
    }
    const round = t.closest('[data-round]');
    if (round) {
      roundIdx = Number(round.dataset.round);
      selected = null;
      globe.selectRegion(null);
      renderElection();
      return;
    }
    const region = t.closest('[data-region]');
    if (region) return select(region.dataset.region === selected ? null : region.dataset.region, false);
    if (t.closest('[data-clear]')) return select(null, false);
    if (t.closest('[data-sim]')) return sim ? stopSim(true) : startSim();
    if (t.closest('[data-show-all]')) {
      showAll = !showAll;
      renderElection();
      return;
    }
    const layerBtn = t.closest('[data-layer]');
    if (layerBtn) {
      layer = layerBtn.dataset.layer;
      selected = null;
      showAll = false;
      filter = '';
      globe.selectRegion(null);
      renderElection();
      return;
    }
    const sort = t.closest('[data-sort]');
    if (sort) {
      sortBy = sort.dataset.sort;
      renderElection();
    }
  });

  electionEl.addEventListener('pointerover', e => {
    const abbr = e.target.closest('[data-region]')?.dataset.region ?? null;
    globe.hoverRegion(abbr);
  });
  electionEl.addEventListener('pointerleave', () => globe.hoverRegion(null));
  electionEl.addEventListener('input', e => {
    if (!e.target.matches('.unit-filter')) return;
    filter = e.target.value.trim().toLowerCase();
    const wrap = electionEl.querySelector('.unit-table');
    if (wrap) wrap.innerHTML = unitTable(viewOf(current()));
  });

  ctx.onLive = async () => {
    country = await loadCountry(meta.code);
    if (!sim) renderAll();
  };

  renderAll();

  return () => stopSim(false, true);

  function renderAll() {
    headStatus.innerHTML = statusPill(ctx.statuses.get(meta.code));
    seg.hidden = offices.length < 2;
    seg.innerHTML = offices.map(o => {
      const el = sim?.election.office === o ? sim.election : latestFor(o);
      return `<button class="${o === office ? 'on' : ''}" data-office="${o}">${o}${el.status === 'live' ? '<i class="live-dot"></i>' : ''}</button>`;
    }).join('');
    renderYears();
    renderElection();
    renderExtras();
    const el = current();
    const asOf = !picked && ctx.index.asOf ? ` Results as of ${fmtFullDate(ctx.index.asOf)}.` : '';
    // The boundary licences ask for credit wherever the maps are shown.
    const boundaries = ctx.sources?.countries?.[meta.code]?.boundaries;
    const credits = [boundaries && `Map: ${boundaries.name} (${boundaries.licence}).`, ctx.sources?.maps].filter(Boolean).join(' ');
    fineprint.textContent = (el.cite
      ? `National results from ${el.cite.name}, via Wikipedia. ${sourcedText(el)}${asOf}`
      : 'Sample data for layout. Results are not real.') + (credits ? ` ${credits}` : '');
  }

  function sourcedText(el) {
    const s = el.statesSourced;
    if (s) return `${s.n === 1 ? 'The winner' : 'Winners'} in ${s.n} of ${s.of} ${terms} ${s.n === 1 ? 'is' : 'are'} sourced; the other ${terms} and all shares are illustrative.`;
    return el.statesFrom ? `Winners by ${term} are sourced; their shares are illustrative.` : `Results by ${term} are illustrative.`;
  }

  // One button per election of this office, oldest first, under a bar in the
  // winner's colour.
  function renderYears() {
    const list = timeline(office);
    years.hidden = list.length < 2;
    if (years.hidden) return;
    const shown = current();
    years.innerHTML = [...list].reverse().map(e => {
      const v = e.rounds ? e.rounds.at(-1) : e;
      const win = v.candidates.find(c => c.winner) ?? v.candidates[0];
      const year = e.label ?? e.date.slice(0, 4);
      return `<button data-election="${e.id}" class="${e === shown ? 'on' : ''}" title="${year} · ${win.name}" aria-pressed="${e === shown}">${year}<i style="background:${party(win.party).color}"></i></button>`;
    }).join('');
    const on = years.querySelector('.on');
    if (on) years.scrollLeft = on.offsetLeft - years.clientWidth / 2 + on.clientWidth / 2;
  }

  function openElection(id, fromList) {
    const el = timeline(office).find(e => e.id === id);
    if (!el) return;
    stopSim(false);
    picked = el === latestFor(office) ? null : el;
    roundIdx = null;
    selected = null;
    showAll = false;
    filter = '';
    history.replaceState(null, '', `#/${meta.code}/${id}`);
    globe.selectRegion(null);
    renderAll();
    if (fromList) panel.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function repaintGlobe() {
    globe.paintRegions(styleFn());
    ctx.setLegend(legendHTML());
  }

  function renderElection() {
    const el = current();
    const rounds = el.rounds ?? null;
    const ri = rounds ? roundIdx ?? rounds.length - 1 : null;
    const view = viewOf(el);
    const live = el.status === 'live';
    const total = view.totalSeats ?? el.totalSeats;
    const majority = view.majority ?? el.majority;
    const seatLabel = el.seatLabel ?? 'Seats';
    const hasSeats = Boolean(total) && view.candidates.some(c => c.seats != null);
    const hasVotes = view.candidates.some(c => c.votes != null);
    const cands = live || sim
      ? [...view.candidates]
      : [...view.candidates].sort((a, b) => rest(a) - rest(b) || (b.seats ?? b.pct ?? 0) - (a.seats ?? a.pct ?? 0));
    const isFinalRound = !rounds || (ri === rounds.length - 1 && !/first/i.test(rounds[ri].label) && el.call?.status !== 'runoff');
    // A single-round race says how it was won; the first-round shares of a race
    // won on transfers or without its run-off don't show the winner ahead.
    const named = view.candidates.filter(c => c.party !== 'oth');
    const others = view.candidates.find(c => c.party === 'oth');
    const won = named.find(c => c.winner);
    const top = [...named].sort((a, b) => (b.pct ?? 0) - (a.pct ?? 0))[0];
    const rule = el.annulled ? 'Annulled'
      : rounds ? null
      : named.length === 1 && !(others?.pct > 0) ? 'Unopposed'
      : !won ? (/single-round/i.test(el.system ?? '') ? 'The most votes wins' : null)
      : el.chosenBy ? `Chosen by ${el.chosenBy}`
      : won.pct == null ? null
      : won !== top ? 'Shares are from the first count'
      : won.pct > 50 ? 'Won with a majority of the vote' : 'Won with the most votes';
    const opts = { cands, total, majority, chamberSize: el.chamberSize, annulled: el.annulled, seatLabel, hasSeats, isFinalRound, rule, party };
    const chart = el.kind === 'presidential' || !hasSeats ? duel(opts) : chamber(opts);

    const facts = [
      ['Election day', fmtDate(view.date ?? el.date)],
      ['Counted', `${live ? el.reporting ?? 0 : 100}%`],
      el.turnout && !live ? ['Turnout', fmtPct(el.turnout)] : null,
      hasVotes ? ['Votes', fmtCompact(d3.sum(view.candidates, c => c.votes ?? 0))] : null,
      live ? ['Updated', el.updatedAt ? timeAgo(el.updatedAt) : 'just now'] : null
    ].filter(Boolean);
    const call = callLine(el, view);

    const rows = cands.map(c => {
      const p = party(c.party);
      const tone = c.change > 0 ? 'up' : c.change < 0 ? 'down' : '';
      return `
        <tr>
          <td><div class="p-cell"><i class="sw" style="background:${p.color}"></i>
            <span class="p-name">${c.name}${p.name !== c.name ? `<small>${p.name}</small>` : ''}</span>
            ${c.winner ? '<span class="tag">Winner</span>' : c.advanced ? '<span class="tag runoff">Run-off</span>' : ''}</div></td>
          ${hasVotes ? `<td class="num hide-sm">${fmtInt(c.votes)}</td><td class="num">${fmtPct(c.pct)}</td>` : ''}
          ${hasSeats ? `<td class="num strong">${fmtInt(c.seats)}</td>` : ''}
          ${hasSeats && !live && !sim ? `<td class="num change ${tone}">${fmtChange(c.change)}</td>` : ''}
        </tr>`;
    }).join('');

    electionEl.innerHTML = `
      <section class="el">
        <header class="el-head">
          <div>
            <h2>${el.office}${picked ? ` <span>${el.label ?? el.date.slice(0, 4)}</span>` : ''}</h2>
            ${el.system || el.note ? `<p class="el-system">${[el.note, el.system].filter(Boolean).join(' · ')}</p>` : ''}
          </div>
          <span class="pill ${live ? 'live' : ''}">${live ? '<i class="live-dot"></i>Live' : sim ? 'Simulated' : el.annulled ? 'Annulled' : el.call?.status === 'runoff' ? 'To run-off' : 'Final result'}</span>
        </header>
        <dl class="facts">${facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>
        ${call ? `<p class="el-call ${call.tone}">${call.text}</p>` : ''}
        <p class="el-source">${el.source ? `Results from ${el.source.url ? `<a href="${el.source.url}" target="_blank" rel="noopener">${el.source.name}</a>` : el.source.name}` : sim ? 'Simulated count, replaying the last result' : el.cite ? `National results from <a href="${el.cite.url}" target="_blank" rel="noopener">${el.cite.name}</a>, via Wikipedia` : 'Sample data, not a real result'}</p>
        ${live ? `<div class="progress" role="progressbar" aria-valuenow="${el.reporting ?? 0}"><i style="width:${el.reporting ?? 0}%"></i></div>` : ''}
        ${rounds ? `<div class="rounds">${rounds.map((r, i) => `<button data-round="${i}" class="${i === ri ? 'on' : ''}">${r.label}<small>${fmtDate(r.date)}</small></button>`).join('')}</div>` : ''}
        ${chart}
        <table class="results">
          <thead><tr>
            <th>${el.kind === 'presidential' ? 'Candidate' : 'Party'}</th>
            ${hasVotes ? '<th class="num hide-sm">Votes</th><th class="num">Share</th>' : ''}
            ${hasSeats ? `<th class="num">${seatLabel === 'Electoral votes' ? 'Electoral' : seatLabel}</th>` : ''}
            ${hasSeats && !live && !sim ? '<th class="num">+/−</th>' : ''}
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </section>
      ${regionsBlock(view, live)}`;
    const want = layerOf(view);
    if (want !== shownLayer) {
      shownLayer = want;
      globe.setLayer(want);
    }
    renderRegionDetail();
    repaintGlobe();
  }

  function unitTable(view) {
    const regs = unitsOf(view);
    const rank = r => (r.contested === false ? 2 : r.winner ? 0 : 1);
    const sorted = [...regs].sort((a, b) => sortBy === 'name'
      ? a.name.localeCompare(b.name)
      : rank(a) - rank(b) || (a.margin ?? 0) - (b.margin ?? 0));
    const matches = filter ? sorted.filter(r => r.name.toLowerCase().includes(filter)) : sorted;
    const visible = filter ? matches.slice(0, 60) : showAll ? matches : matches.slice(0, 10);
    const withSeats = regs.some(r => r.seats > 1);
    const rows = visible.map(r => {
      const off = r.contested === false;
      const sw = off ? 'class="sw hatch"' : r.winner ? `class="sw" style="background:${party(r.winner).color}"` : 'class="sw empty"';
      return `
        <tr data-region="${r.abbr}" class="${r.abbr === selected ? 'sel' : ''}${off ? ' off' : ''}">
          <td><i ${sw}></i>${r.name}</td>
          <td class="muted">${off ? 'No race' : r.winner ? nameFor(r.winner, view) : r.leader ? `${nameFor(r.leader, view)} leads` : 'Counting'}</td>
          <td class="num">${r.winner && r.margin != null ? `+${r.margin.toFixed(1)}` : ''}</td>
          ${withSeats ? `<td class="num muted">${r.seats ?? ''}</td>` : ''}
        </tr>`;
    }).join('');
    const more = !filter && sorted.length > 10
      ? `<button class="link-btn" data-show-all>${showAll ? 'Show fewer' : `Show all ${sorted.length}`}</button>`
      : filter && !matches.length ? '<p class="note">No matches.</p>' : '';
    return `<table class="region-table"><tbody>${rows}</tbody></table>${more}`;
  }

  function regionsBlock(view, live) {
    const regs = unitsOf(view);
    if (!regs.length) return '';
    const byDistrict = layerOf(view) === 'districts';
    const unit = byDistrict ? districtTerm : term;
    const units = byDistrict ? districtTerms : terms;
    const cap = w => w[0].toUpperCase() + w.slice(1);
    const up = regs.filter(r => r.contested !== false);
    const called = up.filter(r => r.winner);
    const status = live || sim
      ? `${called.length} of ${up.length} called`
      : up.length < regs.length ? `${up.length} ${up.length === 1 ? unit : units} voted` : '';

    const tally = d3.rollups(called, v => ({ n: v.length, seats: d3.sum(v, r => r.seats ?? 0) }), r => r.winner)
      .sort((a, b) => b[1].n - a[1].n)
      .map(([p, t]) => `<li><i class="sw" style="background:${party(p).color}"></i>${nameFor(p, view)}<b>${t.n}</b></li>`).join('');

    const closest = called.filter(r => r.margin != null).sort((a, b) => a.margin - b.margin).slice(0, 5);
    const el = current();
    const illustrative = el.cite && !live && !sim
      ? `<p class="note">${el.statesSourced
        ? `Who won ${el.statesSourced.n} of the ${el.statesSourced.of} ${terms} is from <a href="${el.statesFrom}" target="_blank" rel="noopener">the source</a>; the other ${terms} and all shares are illustrative.`
        : el.statesFrom
        ? `Who won each ${unit} is from <a href="${el.statesFrom}" target="_blank" rel="noopener">the source</a>; the shares are illustrative.`
        : `Results by ${unit} are illustrative.`}</p>`
      : '';

    return `
      <section class="block regions-block">
        <div class="block-head">
          <h2 class="block-title">By ${unit}</h2>
          <span class="muted">${status}</span>
        </div>
        ${illustrative}
        ${view.districts?.length ? `
          <div class="layer-toggle sorter">
            <button data-layer="districts" class="${byDistrict ? 'on' : ''}">${cap(districtTerms)}</button>
            <button data-layer="regions" class="${byDistrict ? '' : 'on'}">${cap(terms)}</button>
          </div>` : ''}
        ${tally ? `<ul class="tally">${tally}</ul>` : ''}
        <div class="region-detail"></div>
        ${closest.length > 1 ? `
          <h3 class="sub-title">Closest ${units}</h3>
          <ol class="closest">${closest.map(r => {
            const [a, b] = r.results ?? [];
            const sum = (a?.pct ?? 0) + (b?.pct ?? 0) || 1;
            return `
              <li><button data-region="${r.abbr}" class="${r.abbr === selected ? 'sel' : ''}">
                <span class="cr-name">${r.name}</span>
                <span class="split">
                  <i style="width:${((a?.pct ?? 0) / sum) * 100}%;background:${party(a?.party).color}"></i>
                  <i style="width:${((b?.pct ?? 0) / sum) * 100}%;background:${party(b?.party).color}"></i>
                  <b></b>
                </span>
                <span class="cr-p" title="${nameFor(r.winner, view)}">${nameFor(r.winner, view)}</span>
                <span class="cr-m">+${r.margin.toFixed(1)}</span>
              </button></li>`;
          }).join('')}</ol>` : ''}
        <div class="sub-title row">
          <h3>All ${units}</h3>
          <span class="sorter">
            <button data-sort="margin" class="${sortBy === 'margin' ? 'on' : ''}">Closest first</button>
            <button data-sort="name" class="${sortBy === 'name' ? 'on' : ''}">A–Z</button>
          </span>
        </div>
        ${regs.length > 30 ? `<input class="unit-filter" type="search" placeholder="Find a ${unit}" value="${filter}" aria-label="Find a ${unit}">` : ''}
        <div class="unit-table">${unitTable(view)}</div>
      </section>`;
  }

  function regionOf(abbr) {
    return unitsOf(viewOf(current())).find(r => r.abbr === abbr) ?? null;
  }

  function select(abbr, fromGlobe) {
    selected = abbr;
    globe.selectRegion(abbr);
    renderRegionDetail();
    markRow(null);
    if (abbr && fromGlobe) {
      electionEl.querySelector('.region-detail')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  function markRow(hover) {
    electionEl.querySelectorAll('[data-region]').forEach(n => {
      n.classList.toggle('sel', n.dataset.region === selected);
      n.classList.toggle('hover', n.dataset.region === hover);
    });
  }

  function renderRegionDetail() {
    const box = electionEl.querySelector('.region-detail');
    if (!box) return;
    const view = viewOf(current());
    const r = selected ? regionOf(selected) : null;
    box.classList.toggle('on', Boolean(r));
    if (!r) {
      const unit = layerOf(view) === 'districts' ? districtTerm : term;
      box.innerHTML = `<p class="rd-hint">Select a ${unit} on the globe or in the list to see how it voted.</p>`;
      return;
    }
    const head = `<div class="rd-head"><h3>${r.name}</h3><button class="link-btn" data-clear>Close</button></div>`;
    if (r.contested === false) {
      box.innerHTML = `${head}<p class="rd-call muted">No ${office.toLowerCase()} race in ${r.name} this cycle.</p>`;
      return;
    }
    if (!r.winner && !r.leader) {
      box.innerHTML = `${head}<p class="rd-call muted">No votes counted yet.</p>`;
      return;
    }
    const home = r.region ? view.regions?.find(x => x.abbr === r.region)?.name : null;
    const facts = [
      home ? [term[0].toUpperCase() + term.slice(1), home] : null,
      r.counted != null && r.counted < 100 ? ['Counted', `${r.counted}%`] : null,
      r.turnout != null ? ['Turnout', fmtPct(r.turnout)] : null,
      r.votes != null ? ['Votes', fmtInt(r.votes)] : null,
      r.seats != null ? [current().seatLabel === 'Electoral votes' ? 'Electoral votes' : 'Seats', fmtInt(r.seats)] : null
    ].filter(Boolean);
    const showSeats = (r.seats ?? 0) > 1 && current().kind !== 'presidential';
    box.innerHTML = `
      ${head}
      ${r.winner
        ? `<p class="rd-call"><i class="sw" style="background:${party(r.winner).color}"></i><b>${nameFor(r.winner, view)}</b> ${r.margin != null ? `won by ${r.margin.toFixed(1)} points` : 'won'}</p>`
        : `<p class="rd-call"><i class="sw" style="background:${party(r.leader).color}"></i><b>${nameFor(r.leader, view)}</b> leads by ${(r.margin ?? 0).toFixed(1)} points. Not called yet.</p>`}
      ${r.call?.by ? `<p class="rd-by">Called by ${r.call.by}${r.call.at ? ` · ${whenText(r.call.at)}` : ''}</p>` : ''}
      ${facts.length ? `<dl class="facts mini">${facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>` : ''}
      <ul class="bars">${(r.results ?? []).map(x => `
        <li>
          <span class="b-name"><i class="sw" style="background:${party(x.party).color}"></i>${nameFor(x.party, view)}</span>
          <span class="b-bar"><i style="width:${x.pct}%;background:${party(x.party).color}"></i></span>
          <b>${fmtPct(x.pct)}</b>
          ${showSeats ? `<em>${x.seats ?? 0}</em>` : ''}
        </li>`).join('')}
      </ul>
      ${showSeats ? '<p class="note">Right-hand figure is seats won.</p>' : ''}`;
  }

  function regionTip(abbr) {
    const r = regionOf(abbr);
    if (!r) return `<span class="tip-muted">No data</span>`;
    if (r.contested === false) return `<strong>${r.name}</strong><span>No race this cycle</span>`;
    const view = viewOf(current());
    if (!r.winner) {
      const lead = r.leader ? `${nameFor(r.leader, view)} leads${r.margin != null ? ` by ${r.margin.toFixed(1)}` : ''}` : 'No votes counted yet';
      return `<strong>${r.name}</strong><span>${lead}</span><span class="tip-muted">${r.counted != null ? `${r.counted}% counted · ` : ''}not called</span>`;
    }
    const lines = (r.results ?? []).slice(0, 3).map(x => `
      <span class="tip-row"><i class="sw" style="background:${party(x.party).color}"></i>${nameFor(x.party, view)}<b>${fmtPct(x.pct)}</b></span>`).join('');
    return `<strong>${r.name}</strong>
      <span>${nameFor(r.winner, view)}${r.margin != null ? ` +${r.margin.toFixed(1)}` : ''}${r.seats ? ` · ${r.seats} ${r.seats === 1 ? 'seat' : current().seatLabel === 'Electoral votes' ? 'electoral votes' : 'seats'}` : ''}</span>
      ${lines}
      ${r.call?.by ? `<span class="tip-muted">Called by ${r.call.by}${r.call.at ? ` · ${whenText(r.call.at)}` : ''}</span>` : ''}`;
  }

  function styleFn() {
    const view = viewOf(current());
    const map = new Map(unitsOf(view).map(r => [r.abbr, r]));
    return abbr => {
      const r = map.get(abbr);
      if (!r || r.contested === false) return { notUp: true };
      if (!r.winner) return r.leader ? { fill: party(r.leader).color, opacity: 0.2 } : { uncalled: true };
      return { fill: party(r.winner).color, opacity: 0.42 + (Math.min(r.margin ?? 15, 25) / 25) * 0.58 };
    };
  }

  function legendHTML() {
    const view = viewOf(current());
    const regs = unitsOf(view);
    const wins = d3.rollups(regs.filter(r => r.winner), v => v.length, r => r.winner).sort((a, b) => b[1] - a[1]);
    const notUp = regs.some(r => r.contested === false);
    const uncalled = regs.some(r => r.contested !== false && !r.winner && !r.leader);
    const leading = regs.some(r => !r.winner && r.leader);
    return `
      ${wins.map(([p]) => `<span><i class="k" style="background:${party(p).color}"></i>${nameFor(p, view)}</span>`).join('')}
      ${leading ? '<span><i class="k lead"></i>Leading, not called</span>' : ''}
      ${uncalled ? '<span><i class="k uncalled"></i>No votes yet</span>' : ''}
      ${notUp ? '<span><i class="k not-up"></i>No race</span>' : ''}`;
  }

  function renderExtras() {
    const el = country.elections.find(e => e.office === office && e.status === 'final') ?? latestFor(office);
    const view = el.rounds ? el.rounds.at(-1) : el;
    const hasSeats = Boolean(el.totalSeats) && view.candidates.some(c => c.seats != null);
    const poll = country.polls?.find(p => p.office === office);
    const about = country.about;
    const upcoming = schedule
      .filter(s => s.country === meta.code)
      .map(s => ({ ...s, days: daysUntil(s.date) }))
      .filter(s => s.days >= 0)
      .sort((a, b) => a.days - b.days);

    const summary = e => {
      const v = e.rounds ? e.rounds.at(-1) : e;
      return {
        year: Number(e.date.slice(0, 4)),
        winner: (v.candidates.find(c => c.winner) ?? v.candidates[0]).party,
        results: v.candidates.map(c => ({ party: c.party, seats: c.seats, pct: c.pct }))
      };
    };
    // Real past elections when this office has them, each opening that
    // election; otherwise the sample history in the country file.
    let rows;
    let more = '';
    if (past.some(e => e.office === office)) {
      const list = timeline(office)
        .filter(e => e.status === 'final')
        .map(e => ({ ...summary(e), year: e.label ?? e.date.slice(0, 4), id: e.id, current: e === current() }));
      rows = allPast ? list : list.slice(0, 8);
      if (list.length > 8) more = `<button class="link-btn" data-past-all>${allPast ? 'Show fewer' : `Show all ${list.length}`}</button>`;
    } else {
      const sample = country.elections
        .filter(e => e.office === office && e.status === 'final')
        .flatMap(e => [summary(e), ...(e.history ?? [])]);
      rows = [...new Map(sample.map(r => [r.year, r])).values()].sort((a, b) => b.year - a.year).slice(0, 5).map((r, i) => ({ ...r, current: i === 0 }));
    }
    const hist = rows.length > 1
      ? historyRows(rows, { hasSeats, total: el.totalSeats, party, nameOf: r => party(r.party).name }) + more
      : '';

    const spec = about ? [
      ['Head of state', about.headOfState],
      ['Head of government', about.headOfGovernment],
      ['Legislature', about.legislature],
      ['Voting age', about.votingAge],
      ['Voting', about.compulsory ? 'Compulsory' : 'Voluntary'],
      ['Registered voters', about.registered && fmtCompact(about.registered)]
    ].filter(([, v]) => v != null) : [];

    const pollFrom = poll ? new Date(poll.series[0].points[0][0]).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' }) : '';

    extrasEl.innerHTML = `
      ${poll ? `
        <section class="block">
          <div class="block-head">
            <h2 class="block-title">Polling</h2>
            <span class="muted">Next vote ${poll.tentative ? `expected ${poll.date.slice(0, 4)}` : fmtDate(poll.date)}</span>
          </div>
          ${pollChart(poll, party)}
          <p class="note">${poll.source ? `Polling from ${poll.source}. ` : ''}Change since ${pollFrom}.</p>
        </section>` : ''}
      ${hist ? `
        <section class="block">
          <div class="block-head">
            <h2 class="block-title">Past results</h2>
            <span class="muted">${hasSeats ? el.seatLabel ?? 'Seats' : 'Vote share'}</span>
          </div>
          ${hist}
        </section>` : ''}
      ${about ? `
        <section class="block">
          <h2 class="block-title">How it works</h2>
          ${about.offices?.[office] ? `<p class="prose">${about.offices[office]}</p>` : ''}
          <dl class="spec">${spec.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>
        </section>` : ''}
      ${upcoming.length ? `
        <section class="block">
          <h2 class="block-title">Upcoming in ${country.name}</h2>
          <ul class="upcoming">${upcoming.map(u => `
            <li><span>${u.office}${u.note ? ` · ${u.note}` : ''}</span><span class="muted">${u.tentative ? `Expected ${u.date.slice(0, 4)}` : u.days <= 120 ? `${fmtDate(u.date)} · in ${u.days} days` : fmtDate(u.date)}</span></li>`).join('')}
          </ul>
        </section>` : ''}
      ${picked ? '' : `
        <section class="block sim-block">
          <div>
            <h2 class="block-title">Election night preview</h2>
            <p class="muted">Replay this result as a live count, ${term} by ${term}.</p>
          </div>
          <button class="btn" data-sim>${!sim ? 'Simulate' : sim.election.status === 'final' ? 'Reset' : 'Stop'}</button>
        </section>`}`;
  }

  // One sentence on the state of the call, from the source's own call.
  function callLine(el, view) {
    const c = el.call;
    if (sim && el.status === 'live') return { tone: 'muted', text: 'Simulated count. Nothing is called until a region finishes counting or the lead beats the votes left.' };
    if (!c) return null;
    const by = c.by ? ` by ${c.by}` : '';
    const name = key => nameFor(key, view);
    if (c.status === 'called') return { tone: 'called', text: `Called for ${name(c.winner)}${by}${c.at ? ` · ${whenText(c.at)}` : ''}` };
    if (c.status === 'runoff') return { tone: 'called', text: `${c.parties.map(name).join(' and ')} go to a run-off${c.by ? `, declared by ${c.by}` : ''}` };
    if (c.status === 'hung') return { tone: 'muted', text: `No party won a majority. ${name(c.winner)} is the largest${by ? `, per ${c.by}` : ''}.` };
    if (c.status === 'counting') return { tone: 'muted', text: 'Too early to call.' };
    return { tone: 'muted', text: c.status };
  }

  function whenText(iso) {
    const d = new Date(iso);
    const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    return new Date().toDateString() === d.toDateString() ? time : `${fmtDate(iso.slice(0, 10))}, ${time}`;
  }

  function statusPill(s) {
    if (!s) return '';
    if (s.kind === 'live') return `<span class="pill live"><i class="live-dot"></i>${s.label}</span>`;
    if (s.kind === 'today') return '<span class="pill soon">Polls open today</span>';
    if (s.kind === 'soon') return `<span class="pill soon">Votes in ${s.next.days} days</span>`;
    if (s.kind === 'scheduled') return `<span class="pill">Next vote ${s.next.tentative ? `expected ${s.next.date.slice(0, 4)}` : fmtDate(s.next.date)}</span>`;
    return '';
  }

  // Replays the latest result as if the night were unfolding, using the same
  // shape the cron writes, so the live layout can be checked without waiting.
  function startSim() {
    const source = latestFor(office);
    const final = structuredClone(source);
    const finalView = final.rounds ? final.rounds.at(-1) : final;
    const election = structuredClone(source);
    const view = election.rounds ? election.rounds.at(-1) : election;
    election.status = 'live';
    election.reporting = 0;
    view.candidates.forEach(c => {
      c.winner = false;
      if (c.seats != null) c.seats = 0;
      if (c.votes != null) c.votes = 0;
      if (c.pct != null) c.pct = 0;
    });
    view.regions?.forEach(r => { if (r.contested !== false) r.winner = null; });
    view.districts?.forEach(d => { d.winner = null; d.leader = undefined; });
    view.regions?.forEach(r => { r.leader = undefined; });
    const finalUnits = finalView.districts ?? finalView.regions ?? [];
    const order = d3.shuffle(finalUnits.map((r, i) => (r.contested === false ? -1 : i)).filter(i => i >= 0));
    const fullChamber = Boolean(finalView.districts) && finalView.districts.length === (finalView.totalSeats ?? 0);
    const regionSeats = (finalView.regions ?? []).some(r => r.results?.some(x => x.seats != null));
    roundIdx = election.rounds ? election.rounds.length - 1 : null;
    selected = null;
    globe.selectRegion(null);

    let reporting = 0;
    const tick = () => {
      reporting = Math.min(100, reporting + 1.5 + Math.random() * 3);
      election.reporting = Math.round(reporting);
      election.updatedAt = new Date().toISOString();
      const called = new Set(order.slice(0, Math.floor((order.length * reporting) / 100)));
      if (view.districts) {
        view.districts.forEach((d, i) => { d.winner = called.has(i) ? finalView.districts[i].winner : null; });
        view.regions?.forEach((r, j) => {
          const mine = view.districts.filter(d => d.region === r.abbr);
          r.winner = mine.length && mine.every(d => d.winner) ? finalView.regions[j].winner : null;
        });
      } else {
        view.regions?.forEach((r, i) => {
          if (r.contested !== false) r.winner = called.has(i) ? finalView.regions[i].winner : null;
        });
      }
      view.candidates.forEach((c, i) => {
        const f = finalView.candidates[i];
        if (f.votes != null) c.votes = Math.round((f.votes * reporting) / 100 * (0.92 + Math.random() * 0.16));
        if (f.seats == null) return;
        if (fullChamber) {
          c.seats = view.districts.filter(d => d.winner === f.party).length;
          return;
        }
        c.seats = regionSeats
          ? finalView.regions.reduce((n, r, j) => n + (called.has(j) ? r.results?.find(x => x.party === f.party)?.seats ?? 0 : 0), 0)
          : Math.round((f.seats * reporting) / 100);
      });
      const sum = view.candidates.reduce((n, c) => n + (c.votes ?? 0), 0);
      if (sum) view.candidates.forEach(c => { if (c.votes != null) c.pct = (c.votes / sum) * 100; });

      if (reporting >= 100) {
        Object.assign(view, structuredClone(finalView));
        election.status = 'final';
        clearInterval(sim.timer);
        renderAll();
        return;
      }
      renderElection();
    };
    sim = { election, timer: setInterval(tick, 450) };
    renderAll();
  }

  function stopSim(rerender, leaving = false) {
    if (!sim) return;
    clearInterval(sim.timer);
    sim = null;
    roundIdx = null;
    if (leaving) return;
    if (rerender) renderAll();
  }
}
