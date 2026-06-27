import type { TradeRecord, BiasFlag, BiasSeverity } from './types';

// Each detector is a pure function over the trade list returning a BiasFlag (or
// null). Add/replace detectors without touching the engine.
export interface Detector {
  key: string;
  label: string;
  detect: (trades: TradeRecord[]) => { tradeIds: string[]; evidence: string } | null;
}

const sev = (n: number): BiasSeverity => (n >= 3 ? 'HIGH' : n === 2 ? 'MEDIUM' : 'LOW');
const oversized = (t: TradeRecord) => t.sizeLots > t.baselineLots * 1.25;

export const DETECTORS: Detector[] = [
  {
    key: 'revenge', label: 'Revenge Trading',
    detect: (ts) => {
      const hit = ts.filter((t) => t.precededByLoss && oversized(t));
      return hit.length ? { tradeIds: hit.map((t) => t.id), evidence: `${hit.length} oversized entries immediately after a loss — emotional size-up to "win it back".` } : null;
    },
  },
  {
    key: 'early_exit', label: 'Cutting Winners Early',
    detect: (ts) => {
      const hit = ts.filter((t) => t.exitReason === 'MANUAL_EARLY' && t.rMultiple > 0 && t.mfeR - t.rMultiple > 0.5);
      return hit.length ? { tradeIds: hit.map((t) => t.id), evidence: `${hit.length} winners closed early, leaving ${avg(hit.map((t) => t.mfeR - t.rMultiple)).toFixed(1)}R on the table on average.` } : null;
    },
  },
  {
    key: 'losers_run', label: 'Letting Losers Run',
    detect: (ts) => {
      const hit = ts.filter((t) => (t.exitReason === 'STOP' || t.exitReason === 'MANUAL_LATE') && (t.rMultiple < -1.1 || t.maeR > 1.2));
      return hit.length ? { tradeIds: hit.map((t) => t.id), evidence: `${hit.length} losses exceeded the planned 1R stop (worst ${Math.min(...hit.map((t) => t.rMultiple)).toFixed(1)}R) — stops widened or skipped.` } : null;
    },
  },
  {
    key: 'fomo_size', label: 'Over-confidence Sizing',
    detect: (ts) => {
      const hit = ts.filter((t) => !t.precededByLoss && oversized(t));
      return hit.length ? { tradeIds: hit.map((t) => t.id), evidence: `${hit.length} entries sized up after wins — winning-streak over-confidence.` } : null;
    },
  },
  {
    key: 'overtrading', label: 'Overtrading',
    detect: (ts) => {
      const sorted = [...ts].sort((a, b) => +new Date(a.date) - +new Date(b.date));
      let clustered = 0; const ids: string[] = [];
      for (let i = 1; i < sorted.length; i++) {
        const gap = (+new Date(sorted[i].date) - +new Date(sorted[i - 1].date)) / 86400000;
        if (gap < 0.9) { clustered++; ids.push(sorted[i].id); } // same-day only
      }
      return clustered >= 2 ? { tradeIds: ids, evidence: `${clustered} same-day stacked entries — frequency above the plan's selectivity.` } : null;
    },
  },
  {
    key: 'plan_breaks', label: 'Plan Deviation',
    detect: (ts) => {
      const hit = ts.filter((t) => !t.followedPlan);
      return hit.length ? { tradeIds: hit.map((t) => t.id), evidence: `${hit.length} of ${ts.length} trades deviated from the written plan (entry, sizing or exit).` } : null;
    },
  },
];

export function runDetectors(trades: TradeRecord[]): BiasFlag[] {
  return DETECTORS.flatMap((d) => {
    const r = d.detect(trades);
    if (!r) return [];
    return [{ key: d.key, label: d.label, severity: sev(r.tradeIds.length), count: r.tradeIds.length, evidence: r.evidence, tradeIds: r.tradeIds }];
  }).sort((a, b) => b.count - a.count);
}

function avg(xs: number[]) { return xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0; }
