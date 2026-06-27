import { useTerminal } from '../../store';
import type { Backtest } from '../../types';

export interface BacktestState extends Backtest {
  ok: boolean;
  calmar: number | null;        // return / max drawdown
  returnPerTrade: number | null; // ₹ per trade
}

// Thin typed consumer of the backend backtest result + a couple of derived
// risk-adjusted metrics. Modular: a frontend interactive backtester can later
// implement the same BacktestState interface.
export function useBacktest(): BacktestState | null {
  const bt = useTerminal((s) => s.snap?.backtest);
  if (!bt || !bt.stats) return null;
  const s = bt.stats;
  const calmar = s.totalReturnPct != null && s.maxDrawdownPct && s.maxDrawdownPct > 0
    ? Math.round((s.totalReturnPct / s.maxDrawdownPct) * 100) / 100 : null;
  const returnPerTrade = s.totalPnl != null && s.trades ? Math.round(s.totalPnl / s.trades) : null;
  return { ...bt, ok: (s.trades ?? 0) > 0, calmar, returnPerTrade };
}
