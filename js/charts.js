import { fmtInt, fmtPct } from './format.js';

// Readable text colour for a party fill.
export function ink(hex) {
  const n = parseInt(hex.slice(1), 16);
  const l = 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
  return l > 165 ? '#1d1d1f' : '#ffffff';
}

// Seat positions for a half-circle chamber, ordered left to right so each
// party fills a wedge. Row count keeps dots roughly evenly spaced.
export function hemicycle(total, inner = 0.5) {
  const rows = Math.max(1, Math.round(Math.sqrt((2 * total * (1 - inner)) / (Math.PI * (1 + inner)))));
  const gap = (1 - inner) / rows;
  const radii = d3.range(rows).map(i => inner + gap * (i + 0.5));
  const sum = d3.sum(radii);
  const counts = radii.map(r => Math.round((total * r) / sum));
  let diff = total - d3.sum(counts);
  for (let i = rows - 1; diff !== 0; i = (i - 1 + rows) % rows) {
    counts[i] += Math.sign(diff);
    diff -= Math.sign(diff);
  }
  const dots = [];
  radii.forEach((r, i) => {
    const n = counts[i];
    for (let j = 0; j < n; j++) {
      const a = n === 1 ? Math.PI / 2 : Math.PI * (1 - j / (n - 1));
      dots.push({ x: r * Math.cos(a), y: -r * Math.sin(a), a });
    }
  });
  dots.sort((p, q) => q.a - p.a);
  const arc = d3.min(radii.map((r, i) => (counts[i] > 1 ? (Math.PI * r) / (counts[i] - 1) : Infinity)));
  return { dots, r: Math.min(gap, arc) * 0.42 };
}

// chamberSize is set when only part of the chamber was elected and the seats
// shown are the seats won (Argentina's half renewals), so there is no majority.
export function chamber({ cands, total, majority, chamberSize, annulled, seatLabel, party }) {
  const { dots, r } = hemicycle(total);
  const fills = cands.flatMap(c => Array(Math.max(0, c.seats ?? 0)).fill(party(c.party).color));
  const circles = dots.map((d, i) =>
    `<circle cx="${d.x.toFixed(4)}" cy="${d.y.toFixed(4)}" r="${r.toFixed(4)}"${fills[i] ? ` fill="${fills[i]}"` : ' class="empty"'}/>`).join('');
  const lead = cands.find(c => c.winner) ?? [...cands].sort((a, b) => (b.seats ?? 0) - (a.seats ?? 0))[0];
  const short = annulled ? 'Annulled' : chamberSize ? (lead.winner ? 'Most seats won' : 'Leading') : lead.seats >= majority ? 'Majority' : lead.winner ? 'Largest party' : 'Leading';
  const caption = chamberSize
    ? `${fmtInt(total)} of ${fmtInt(chamberSize)} ${seatLabel.toLowerCase()} were up`
    : `${fmtInt(majority)} of ${fmtInt(total)} ${seatLabel.toLowerCase()} for a majority`;
  return `
    <figure class="chamber">
      <div class="arc">
        <svg viewBox="-1.02 -1.02 2.04 1.05" role="img" aria-label="Seats by party">${circles}</svg>
        <div class="chamber-center">
          <span class="big">${fmtInt(lead.seats)}</span>
          <span class="lbl"><i class="sw" style="background:${party(lead.party).color}"></i>${lead.name}</span>
        </div>
      </div>
      <figcaption class="chamber-caption">${short} · ${caption}</figcaption>
    </figure>`;
}

// rule, when given, replaces the run-off wording (single-round races).
export function duel({ cands, total, majority, seatLabel, hasSeats, isFinalRound, rule, party }) {
  const [a, b] = cands;
  const value = c => (hasSeats ? fmtInt(c.seats) : fmtPct(c.pct));
  const width = c => Math.max(0, hasSeats ? ((c.seats ?? 0) / total) * 100 : c.pct ?? 0);
  const side = (c, cls) => {
    if (!c) return '';
    const p = party(c.party);
    const sub = [c.winner ? '<b class="tag">Winner</b>' : c.advanced ? '<b class="tag runoff">Run-off</b>' : '', p.name !== c.name ? p.name : ''].filter(Boolean).join(' · ');
    return `
      <div class="duel-side ${cls}">
        <span class="big">${value(c)}</span>
        <span class="nm"><i class="sw" style="background:${p.color}"></i>${c.name}</span>
        <small>${sub || '&nbsp;'}</small>
      </div>`;
  };
  const seg = c => `<span style="width:${width(c)}%;background:${party(c.party).color}" title="${c.name}"></span>`;
  const caption = hasSeats
    ? `${fmtInt(majority)} ${seatLabel.toLowerCase()} to win`
    : rule ?? (isFinalRound ? 'A majority of valid votes wins' : 'The top two go through to the run-off');
  return `
    <figure class="duel">
      <div class="duel-top">${side(a, '')}${side(b, 'right')}</div>
      <div class="duel-track">
        <div class="duel-bar">${seg(a)}${cands.slice(2).map(seg).join('')}<span class="gap"></span>${b ? seg(b) : ''}</div>
        ${isFinalRound || hasSeats ? '<i class="duel-tick"></i>' : ''}
      </div>
      <figcaption class="duel-caption">${caption}</figcaption>
    </figure>`;
}

export function historyRows(rows, { hasSeats, total, party, nameOf }) {
  return `
    <div class="hist">
      ${rows.map(row => {
        const sum = hasSeats ? d3.sum(row.results, r => r.seats ?? 0) || total : d3.sum(row.results, r => r.pct) || 100;
        const segs = row.results.map(r => {
          const v = hasSeats ? r.seats ?? 0 : r.pct ?? 0;
          return `<span style="width:${(v / sum) * 100}%;background:${party(r.party).color}" title="${party(r.party).name} · ${hasSeats ? fmtInt(v) : fmtPct(v)}"></span>`;
        }).join('');
        const top = row.results.find(r => r.party === row.winner) ?? row.results[0];
        const tag = row.id ? 'button' : 'div';
        return `
          <${tag} class="hist-row${row.current ? ' current' : ''}"${row.id ? ` data-election="${row.id}"` : ''}>
            <span class="hist-yr">${row.year}</span>
            <div class="hist-bar">${segs}<i></i></div>
            <span class="hist-win"><i class="sw" style="background:${party(top.party).color}"></i>${nameOf(top)}<b>${hasSeats ? fmtInt(top.seats) : fmtPct(top.pct)}</b></span>
          </${tag}>`;
      }).join('')}
    </div>`;
}

export function pollChart(poll, party) {
  const W = 460;
  const H = 200;
  const m = { t: 10, r: 14, b: 22, l: 34 };
  const dates = poll.series[0].points.map(p => new Date(p[0]));
  const top = d3.max(poll.series.flatMap(s => s.points.map(p => p[1])));
  const x = d3.scaleUtc().domain(d3.extent(dates)).range([m.l, W - m.r]);
  const y = d3.scaleLinear().domain([0, Math.ceil((top + 4) / 10) * 10]).range([H - m.b, m.t]);
  const line = d3.line().x(p => x(new Date(p[0]))).y(p => y(p[1])).curve(d3.curveMonotoneX);
  const grid = y.ticks(4).map(t => `
    <line x1="${m.l}" x2="${W - m.r}" y1="${y(t)}" y2="${y(t)}" class="grid"/>
    <text x="${m.l - 8}" y="${y(t)}" dy="0.32em" text-anchor="end" class="axis">${t}%</text>`).join('');
  const months = x.ticks(d3.utcMonth.every(1)).map(d => `
    <text x="${x(d)}" y="${H - 4}" text-anchor="middle" class="axis">${d.toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' })}</text>`).join('');
  const lines = poll.series.map(s => {
    const last = s.points.at(-1);
    return `
      <path d="${line(s.points)}" fill="none" stroke="${party(s.party).color}" stroke-width="2" stroke-linejoin="round"/>
      <circle cx="${x(new Date(last[0]))}" cy="${y(last[1])}" r="3.5" fill="${party(s.party).color}" class="end"/>`;
  }).join('');
  const legend = [...poll.series]
    .sort((a, b) => b.points.at(-1)[1] - a.points.at(-1)[1])
    .map(s => {
      const now = s.points.at(-1)[1];
      const delta = Math.round((now - s.points[0][1]) * 10) / 10;
      return `
        <li><i class="sw" style="background:${party(s.party).color}"></i><span>${party(s.party).name}</span>
        <b>${fmtPct(now)}</b><em class="${delta > 0 ? 'up' : delta < 0 ? 'down' : ''}">${delta > 0 ? '+' : ''}${delta.toFixed(1)}</em></li>`;
    }).join('');
  return `
    <figure class="polls">
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Polling average">${grid}${months}${lines}</svg>
      <ul class="poll-legend">${legend}</ul>
    </figure>`;
}
