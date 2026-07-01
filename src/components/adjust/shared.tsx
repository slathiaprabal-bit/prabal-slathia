import type { AdjMode, Leg, Metrics } from '../../lib/adjust/types';

export const MODE_META: Record<AdjMode, { label: string; blurb: string; color: string }> = {
  DEFENSIVE: { label: 'Defensive', blurb: 'Minimize loss · cut gamma/vega · max POP', color: 'var(--info)' },
  THETA: { label: 'Theta Max', blurb: 'Max theta · delta-neutral · min margin', color: 'var(--pos)' },
  CRASH: { label: 'Crash Opportunity', blurb: 'Convex downside · keep theta · controlled risk', color: 'var(--neg)' },
  VOL: { label: 'Volatility Trader', blurb: 'Position for IV expansion / contraction', color: 'var(--violet)' },
};

// Compact ₹ formatting.
export function inr(v: number | null | undefined): string {
  if (v == null || !isFinite(v)) return '—';
  const a = Math.abs(v), s = v < 0 ? '−' : '';
  if (a >= 1e7) return `${s}₹${(a / 1e7).toFixed(2)}Cr`;
  if (a >= 1e5) return `${s}₹${(a / 1e5).toFixed(2)}L`;
  if (a >= 1e3) return `${s}₹${(a / 1e3).toFixed(1)}k`;
  return `${s}₹${a.toFixed(0)}`;
}

export function legStr(l: Leg): string {
  const side = l.qty > 0 ? '+' : '−';
  return `${side}${Math.abs(l.qty)} ${l.strike}${l.kind}`;
}

export function scoreColor(s: number): string {
  return s >= 80 ? 'var(--pos)' : s >= 55 ? 'var(--gold)' : s >= 30 ? '#ff8c42' : 'var(--neg)';
}

// One metric cell.
export function Metric({ label, value, color, hint }: { label: string; value: string; color?: string; hint?: string }) {
  return (
    <div className="cell flex flex-col justify-center px-2 py-1.5">
      <div className="eyebrow text-[7px]">{label}</div>
      <div className="mono text-[12.5px] font-bold leading-tight" style={{ color: color ?? 'var(--text)' }}>{value}</div>
      {hint && <div className="text-[7px] text-[color:var(--faint)]">{hint}</div>}
    </div>
  );
}

// The full metric set for a structure (used in detail + compare).
export function metricRows(m: Metrics): { label: string; value: string; color?: string }[] {
  const dcol = (v: number) => (v >= 0 ? 'var(--pos)' : 'var(--neg)');
  return [
    { label: 'EXP. THETA', value: `${inr(m.theta)}/d`, color: m.theta >= 0 ? 'var(--pos)' : 'var(--neg)' },
    { label: 'DELTA', value: `${m.delta.toFixed(0)}/pt`, color: 'var(--text)' },
    { label: 'GAMMA', value: m.gamma.toFixed(4), color: 'var(--text)' },
    { label: 'VEGA', value: `${inr(m.vega)}/pt`, color: dcol(m.vega) },
    { label: 'POP', value: `${(m.pop * 100).toFixed(0)}%`, color: m.pop >= 0.6 ? 'var(--pos)' : 'var(--gold)' },
    { label: 'MARGIN', value: inr(m.margin), color: 'var(--text)' },
    { label: 'MAX PROFIT', value: inr(m.maxProfit), color: 'var(--pos)' },
    { label: 'MAX LOSS', value: inr(m.maxLoss), color: 'var(--neg)' },
    { label: 'TAIL (−600)', value: inr(m.tailPayoff), color: dcol(m.tailPayoff) },
  ];
}
