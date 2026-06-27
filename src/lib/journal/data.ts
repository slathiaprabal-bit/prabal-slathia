import type { TradeRecord } from './types';

// Demo trade history (deterministic). Pluggable: replace with a real journal /
// broker-fills source — the engine, detectors and UI are data-source agnostic.
// Patterns are intentionally embedded so the detectors demonstrate signal.
const B = 2; // baseline size (lots)
const RISK = 13000; // ₹ planned risk per trade

function t(
  id: string, date: string, strategy: string, direction: TradeRecord['direction'],
  regime: string, r: number, exitReason: TradeRecord['exitReason'],
  opts: Partial<TradeRecord> = {},
): TradeRecord {
  return {
    id, date, strategy, direction, regimeAtEntry: regime,
    risk: RISK, rMultiple: r, pnl: Math.round(r * RISK), exitReason,
    holdingDays: opts.holdingDays ?? 4, plannedHoldDays: opts.plannedHoldDays ?? 5,
    maeR: opts.maeR ?? Math.max(0.2, -Math.min(r, 0) + 0.1), mfeR: opts.mfeR ?? Math.max(r, 0.4),
    sizeLots: opts.sizeLots ?? B, baselineLots: B,
    followedPlan: opts.followedPlan ?? true, precededByLoss: opts.precededByLoss ?? false,
  };
}

export const SEED_TRADES: TradeRecord[] = [
  t('T-01', '2026-04-06', 'Iron Condor', 'NEUTRAL', 'NORMAL', 0.8, 'TARGET'),
  t('T-02', '2026-04-09', 'Bull Put Spread', 'BULLISH', 'TRENDING UP', 0.9, 'TARGET'),
  t('T-03', '2026-04-13', 'Iron Condor', 'NEUTRAL', 'NORMAL', -1.0, 'STOP'),
  // Revenge: oversized right after a loss, stop widened (loss > 1R), off-plan.
  t('T-04', '2026-04-14', 'Bear Call Spread', 'BEARISH', 'VOLATILE', -1.8, 'MANUAL_LATE',
    { sizeLots: 4, precededByLoss: true, followedPlan: false, maeR: 1.9, mfeR: 0.3 }),
  // Early exit: closed a winner leaving ~0.8R on the table.
  t('T-05', '2026-04-20', 'Bull Put Spread', 'BULLISH', 'TRENDING UP', 0.4, 'MANUAL_EARLY',
    { mfeR: 1.2 }),
  t('T-06', '2026-04-20', 'Calendar Spread', 'NEUTRAL', 'NORMAL', 1.1, 'TARGET'),
  t('T-07', '2026-04-24', 'Iron Condor', 'NEUTRAL', 'NORMAL', -1.0, 'STOP'),
  // Revenge size-up after loss — this one happened to win, but the process was wrong.
  t('T-08', '2026-04-27', 'Short Strangle', 'NEUTRAL', 'ELEVATED', 0.6, 'TARGET',
    { sizeLots: 3, precededByLoss: true }),
  t('T-09', '2026-04-30', 'Jade Lizard', 'BULLISH', 'TRENDING UP', 1.3, 'TARGET'),
  // Letting a loser run.
  t('T-10', '2026-05-05', 'Bear Call Spread', 'BEARISH', 'TRENDING DOWN', -1.5, 'MANUAL_LATE',
    { maeR: 1.6, followedPlan: false }),
  // Early exit again.
  t('T-11', '2026-05-08', 'Bull Put Spread', 'BULLISH', 'TRENDING UP', 0.5, 'MANUAL_EARLY',
    { mfeR: 1.4 }),
  t('T-12', '2026-05-12', 'Iron Condor', 'NEUTRAL', 'NORMAL', 0.9, 'TARGET'),
  // Overtrading: same-day stacked entry.
  t('T-13', '2026-05-12', 'Bull Call Spread', 'BULLISH', 'TRENDING UP', 0.7, 'TARGET'),
  // Over-confidence sizing after a win streak.
  t('T-14', '2026-05-15', 'Iron Fly', 'NEUTRAL', 'NORMAL', 0.8, 'TARGET',
    { sizeLots: 3 }),
];
