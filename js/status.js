import { daysUntil, fmtDate } from './format.js';

const RANK = { live: 0, today: 1, soon: 2, scheduled: 3, idle: 4 };

// One status per country, derived from the live file (if any) and the schedule.
export function countryStatus(code, schedule, live, today = new Date()) {
  const liveElection = live?.elections.find(e => e.status === 'live') ?? null;
  const upcoming = schedule
    .filter(s => s.country === code)
    .map(s => ({ ...s, days: daysUntil(s.date, today) }))
    .filter(s => s.days >= 0)
    .sort((a, b) => a.days - b.days);
  const next = upcoming[0] ?? null;

  let kind, label;
  if (liveElection) {
    kind = 'live';
    label = `Live · ${liveElection.reporting ?? 0}% in`;
  } else if (!next) {
    kind = 'idle';
    label = 'Nothing scheduled';
  } else if (next.days === 0) {
    kind = 'today';
    label = 'Polls open today';
  } else if (next.days <= 45) {
    kind = 'soon';
    label = `In ${next.days} days`;
  } else {
    kind = 'scheduled';
    label = next.tentative ? `Expected ${next.date.slice(0, 4)}` : fmtDate(next.date);
  }
  return { kind, label, rank: RANK[kind], next, liveElection, upcoming };
}

// The date and minutes past midnight in an election's own time zone.
function localTime(timeZone, now) {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const p = Object.fromEntries(f.formatToParts(now).map(x => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, minutes: p.hour * 60 + Number(p.minute) };
}

// Whether results for a country can change right now: on election day once
// the first polls close, and after that for as long as a count is running.
export function counting(code, schedule, live, now = new Date()) {
  const today = schedule
    .filter(e => e.country === code)
    .map(e => ({ e, t: localTime(e.timezone, now) }))
    .filter(({ e, t }) => t.date === e.date);
  if (!today.length) return live.has(code);
  return today.some(({ e, t }) => {
    const [h, m] = (e.pollsClose ?? '20:00').split(':').map(Number);
    return t.minutes >= h * 60 + m;
  });
}

// Offices voting on the next date, e.g. "Senate & Governors".
export function nextOffices(status) {
  const n = status.next;
  if (!n) return 'Nothing scheduled';
  return status.upcoming
    .filter(u => u.date === n.date)
    .map(u => (u.note ? `${u.office} ${u.note.toLowerCase()}` : u.office))
    .join(' & ');
}

export function nextText(status) {
  if (status.kind === 'live') return `${status.liveElection.office} · counting now`;
  const n = status.next;
  if (!n) return 'No election scheduled';
  const when = n.tentative ? `expected ${n.date.slice(0, 4)}` : fmtDate(n.date);
  return `${nextOffices(status)} · ${when}`;
}
