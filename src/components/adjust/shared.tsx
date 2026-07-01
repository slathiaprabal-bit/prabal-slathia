import type { AdjMode, Aggressiveness, AdjustmentAnalysis, Leg, MarketThesis, Metrics } from '../../lib/adjust/types';

export const MODE_META: Record<AdjMode, { label: string; blurb: string; color: string }> = {
  DEFENSIVE: { label: 'Defensive', blurb: 'Cut max loss · gamma/vega · margin — keep direction', color: 'var(--info)' },
  THETA: { label: 'Theta Max', blurb: 'Max theta/day · delta-neutral · theta per ₹ margin', color: 'var(--pos)' },
  CRASH: { label: 'Crash Opportunity', blurb: 'Protect profit, then cheap convex downside', color: 'var(--neg)' },
  VOL: { label: 'Volatility Trader', blurb: 'Long vega for IV expansion — theta ignored', color: 'var(--violet)' },
};

// STEP 1 — the eight market theses, in trader order (bearish → bullish → vol).
export const THESIS_META: Record<MarketThesis, { label: string; hint: string; color: string }> = {
  STRONG_BEARISH: { label: 'Strong Bearish', hint: '400–1000 pt correction', color: 'var(--neg)' },
  MILD_BEARISH: { label: 'Mild Bearish', hint: '~1σ drift lower', color: '#ff8c42' },
  NEUTRAL: { label: 'Neutral / Sideways', hint: 'pins near spot', color: 'var(--gold)' },
  MILD_BULLISH: { label: 'Mild Bullish', hint: '~1σ drift higher', color: '#7bd88f' },
  STRONG_BULLISH: { label: 'Strong Bullish', hint: 'sharp rally', color: 'var(--pos)' },
  VOL_EXPANSION: { label: 'High Vol Expansion', hint: 'big move, either way', color: 'var(--violet)' },
  THETA_DECAY: { label: 'Low Vol / Theta Decay', hint: 'grind, IV bleeds', color: 'var(--info)' },
  NO_VIEW: { label: 'No View', hint: 'pure risk optimization', color: 'var(--dim)' },
};

export const AGGR_META: Record<Aggressiveness, { label: string; hint: string }> = {
  CONSERVATIVE: { label: 'Conservative', hint: 'retain 90% profit' },
  BALANCED: { label: 'Balanced', hint: 'retain 70% profit' },
  AGGRESSIVE: { label: 'Aggressive', hint: 'maximize convexity' },
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
    { label: `TAIL (−${Math.round(m.tailMove)})`, value: inr(m.tailPayoff), color: dcol(m.tailPayoff) },
  ];
}

// STEP 5 — the institutional adjustment read (cost + trader deltas), not just P&L.
export function traderRows(a: AdjustmentAnalysis): { label: string; value: string; color?: string; hint?: string }[] {
  const dcol = (v: number) => (v >= 0 ? 'var(--pos)' : 'var(--neg)');
  const retCol = a.profitRetained >= 0.9 ? 'var(--pos)' : a.profitRetained >= 0.7 ? 'var(--gold)' : 'var(--neg)';
  return [
    { label: 'ADJ. COST', value: `${a.adjustCost >= 0 ? 'credit ' : 'debit '}${inr(Math.abs(a.adjustCost))}`, color: dcol(a.adjustCost) },
    { label: 'PREMIUM PAID', value: inr(a.premiumPaid) },
    { label: 'MARGIN Δ', value: `${a.marginChange >= 0 ? '+' : ''}${inr(a.marginChange)}`, color: a.marginChange <= 0 ? 'var(--pos)' : 'var(--text)' },
    { label: 'THETA Δ', value: `${inr(a.thetaChange)}/d`, color: dcol(a.thetaChange) },
    { label: 'VEGA Δ', value: `${inr(a.vegaChange)}/pt`, color: dcol(a.vegaChange) },
    { label: 'DELTA Δ', value: `${a.deltaChange >= 0 ? '+' : ''}${a.deltaChange.toFixed(0)}/pt` },
    { label: 'PROFIT RETAINED', value: `${Math.round(a.profitRetained * 100)}%`, color: retCol, hint: `${inr(a.expProfitAfter)} vs ${inr(a.expProfitBase)}` },
    { label: 'SCENARIO GAIN', value: inr(a.scenarioGain), color: dcol(a.scenarioGain), hint: a.scenarioLabel },
    { label: 'OPP. EFFICIENCY', value: `${a.opportunityEfficiency.toFixed(1)}×`, color: a.opportunityEfficiency >= 3 ? 'var(--pos)' : a.opportunityEfficiency >= 1 ? 'var(--gold)' : 'var(--neg)' },
  ];
}
