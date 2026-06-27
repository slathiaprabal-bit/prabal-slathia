import type { TradeRecord, JournalState, JournalStats, TradeAnalysis, BiasFlag } from './types';
import { clamp, round } from './types';
import { runDetectors } from './detectors';

// Post-trade analytics: expectancy, per-trade execution scoring, behavioural
// bias detection and improvement suggestions. Pure and fully testable.
export function analyzeJournal(trades: TradeRecord[]): JournalState {
  const stats = computeStats(trades);
  const biases = runDetectors(trades);
  const analyses = trades.map(analyzeTrade);
  const executionScore = round(avg(analyses.map((a) => a.executionScore)));
  const emotionalScore = computeEmotionalScore(biases, stats.planAdherence);
  const suggestions = buildSuggestions(biases, stats);
  return { trades, stats, biases, analyses, suggestions, executionScore, emotionalScore };
}

function computeStats(ts: TradeRecord[]): JournalStats {
  const n = ts.length || 1;
  const wins = ts.filter((t) => t.pnl > 0);
  const losses = ts.filter((t) => t.pnl <= 0);
  const grossWin = sum(wins.map((t) => t.pnl));
  const grossLoss = Math.abs(sum(losses.map((t) => t.pnl)));
  const r2 = (v: number) => Math.round(v * 100) / 100;
  return {
    count: ts.length,
    winRate: wins.length / n,
    expectancyR: r2(avg(ts.map((t) => t.rMultiple))),
    avgWinR: r2(avg(wins.map((t) => t.rMultiple))),
    avgLossR: r2(avg(losses.map((t) => t.rMultiple))),
    profitFactor: r2(grossLoss ? grossWin / grossLoss : grossWin > 0 ? 99 : 0),
    totalPnl: Math.round(sum(ts.map((t) => t.pnl))),
    planAdherence: ts.filter((t) => t.followedPlan).length / n,
    avgHoldDays: round(avg(ts.map((t) => t.holdingDays))),
  };
}

function analyzeTrade(t: TradeRecord): TradeAnalysis {
  let score = 100;
  const flags: string[] = [];
  if (!t.followedPlan) { score -= 40; flags.push('Deviated from plan'); }
  if (t.exitReason === 'MANUAL_EARLY' && t.rMultiple > 0 && t.mfeR - t.rMultiple > 0.5) {
    score -= 20; flags.push(`Exited early (left ${(t.mfeR - t.rMultiple).toFixed(1)}R)`);
  }
  if ((t.exitReason === 'STOP' || t.exitReason === 'MANUAL_LATE') && (t.rMultiple < -1.1 || t.maeR > 1.2)) {
    score -= 25; flags.push('Loss exceeded 1R stop');
  }
  if (t.sizeLots > t.baselineLots * 1.25) { score -= 15; flags.push('Oversized vs baseline'); }
  if (t.precededByLoss && t.sizeLots > t.baselineLots * 1.25) { score -= 10; flags.push('Revenge size-up'); }
  score = clamp(round(score), 0, 100);

  const note = score >= 85
    ? `Clean execution — ${t.exitReason === 'TARGET' ? 'rode to target' : 'managed to plan'}.`
    : score >= 60
    ? `Acceptable, but ${flags[0]?.toLowerCase() ?? 'minor slippage'}.`
    : `Process breakdown — ${flags.slice(0, 2).join('; ').toLowerCase()}.`;
  return { id: t.id, executionScore: score, flags, note };
}

function computeEmotionalScore(biases: BiasFlag[], planAdherence: number): number {
  let s = 100;
  for (const b of biases) s -= b.severity === 'HIGH' ? 18 : b.severity === 'MEDIUM' ? 10 : 5;
  s = s * (0.7 + 0.3 * planAdherence); // discipline reinforcement
  return round(clamp(s, 0, 100));
}

function buildSuggestions(biases: BiasFlag[], stats: JournalStats): string[] {
  const map: Record<string, string> = {
    revenge: 'Enforce a mandatory cooldown after any loss; never increase size to recover.',
    early_exit: 'Trust the planned target — scale out partially rather than closing winners whole.',
    losers_run: 'Honour the 1R stop mechanically; pre-place the exit, never widen it.',
    fomo_size: 'Keep position size constant — do not scale up on winning streaks.',
    overtrading: 'Raise selectivity; cap entries per week and demand an A+ setup.',
    plan_breaks: 'Pre-commit entry, size and exit in writing; review every deviation nightly.',
  };
  const out = biases.slice(0, 3).map((b) => map[b.key]).filter(Boolean);
  if (stats.profitFactor >= 1.5 && stats.planAdherence >= 0.7) out.push('Edge and discipline are intact — focus on consistency and size scaling, not new strategies.');
  else if (stats.expectancyR < 0) out.push('Expectancy is negative — pause live size and review entry criteria before continuing.');
  return out;
}

const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);
const avg = (xs: number[]) => (xs.length ? sum(xs) / xs.length : 0);
