// Deterministic IST date/time helpers + live countdown formatting.
const IST = 'Asia/Kolkata';
const _dk = new Intl.DateTimeFormat('en-CA', { timeZone: IST, year: 'numeric', month: '2-digit', day: '2-digit' });
const _wd = new Intl.DateTimeFormat('en-US', { timeZone: IST, weekday: 'short' });
const _tm = new Intl.DateTimeFormat('en-GB', { timeZone: IST, hour: '2-digit', minute: '2-digit', hour12: false });
const _dt = new Intl.DateTimeFormat('en-GB', { timeZone: IST, day: '2-digit', month: 'short' });

export function istDateKey(d: Date): string { return _dk.format(d); }     // 2026-07-15
export function istWeekday(d: Date): string { return _wd.format(d); }     // Mon
export function istTime(d: Date): string { return _tm.format(d); }        // 17:30
export function istDayMonth(d: Date): string { return _dt.format(d); }    // 15 Jul

// Live countdown string from milliseconds-until.
export function countdown(ms: number | null): string {
  if (ms == null) return '—';
  if (ms <= 0) return 'now';
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}
