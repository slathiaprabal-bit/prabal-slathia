// Deterministic Trading Week Risk Score (Next-7-Days meter + per-day 0..100).
import type { RawEvent, DayRisk, WeekRisk, RiskBand, MarketEvent, SectorTilt } from './types';
import { computeImpact } from './impact';
import { istDateKey, istWeekday } from './format';

export function bandOf(score: number): RiskBand {
  return score > 80 ? 'RED' : score > 50 ? 'ORANGE' : score > 25 ? 'YELLOW' : 'GREEN';
}

// Per-day score = top event risk + a fraction of the second + a small multi-event
// bump, so a day stacked with releases reads riskier than a single one.
export function weekRisk(events: RawEvent[], nowMs: number): WeekRisk {
  const now = new Date(nowMs);
  const days: DayRisk[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(nowMs + i * 86400000);
    const key = istDateKey(d);
    const dayEvents = events.filter((e) => {
      const t = Date.parse(e.datetime);
      return !isNaN(t) && istDateKey(new Date(t)) === key;
    });
    const scored = dayEvents.map((e) => {
      const t = Date.parse(e.datetime);
      const h = isNaN(t) ? null : (t - nowMs) / 3.6e6;
      return { name: e.name, r: computeImpact(e, h).riskScore };
    }).sort((a, b) => b.r - a.r);

    let score = 0;
    if (scored.length) {
      score = scored[0].r + 0.2 * (scored[1]?.r ?? 0) + 4 * Math.max(0, dayEvents.length - 1);
      score = Math.min(100, Math.round(score));
    }
    days.push({
      date: key,
      label: i === 0 ? 'Today' : istWeekday(d),
      score,
      band: bandOf(score),
      events: dayEvents.length,
      topEvent: scored[0]?.name ?? null,
    });
  }
  const scores = days.map((d) => d.score);
  const max = Math.max(0, ...scores);
  const mean = scores.reduce((a, b) => a + b, 0) / (scores.length || 1);
  const overall = Math.round(0.7 * max + 0.3 * mean);
  return { days, overall, band: bandOf(overall) };
}

// Which sectors carry the most event risk over the next 7 days (non-completed).
export function sectorExposure(events: MarketEvent[]): SectorTilt[] {
  const acc = new Map<string, { s: number; n: number }>();
  for (const e of events) {
    if (e.status === 'COMPLETED') continue;
    if (!(e.msUntil != null && e.msUntil > 0 && e.msUntil < 7 * 86400000)) continue;
    for (const sec of e.sectors) {
      const cur = acc.get(sec) ?? { s: 0, n: 0 };
      cur.s += e.impact.riskScore;
      cur.n += 1;
      acc.set(sec, cur);
    }
  }
  return [...acc.entries()]
    .map(([sector, { s, n }]) => ({ sector, score: s, events: n }))
    .sort((a, b) => b.score - a.score);
}
