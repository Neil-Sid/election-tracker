export const fmtInt = n => n == null ? '—' : Math.round(n).toLocaleString('en-US');
export const fmtPct = n => n == null ? '—' : `${n.toFixed(1)}%`;
export const fmtChange = n => n == null ? '' : n === 0 ? '±0' : n > 0 ? `+${n}` : `${n}`;

export const fmtDate = iso =>
  new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

export function daysUntil(iso, today = new Date()) {
  const target = new Date(iso + 'T00:00:00');
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((target - base) / 86400000);
}

export function timeAgo(iso) {
  const s = Math.max(0, (Date.now() - new Date(iso)) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return fmtDate(iso.slice(0, 10));
}

export const fmtLongDate = iso =>
  new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

export const fmtCompact = n => n == null ? '—' : n >= 1e6 ? `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}K` : `${n}`;
