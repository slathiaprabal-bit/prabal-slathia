import type { Direction, VolRegime, RecommendedStrategy } from './types';

// Volatility-regime classification now lives in the Volatility Engine
// (lib/vol). The strategy matrix consumes VolState.regime via VolRegime.

interface SelectArgs {
  direction: Direction;
  volRegime: VolRegime;
  sellingSuitability: number; // 0..100
  trendStrength: number;      // 0..100
}

// Strategy-selection matrix: maps the decision dimensions to a structure family.
// This is the seam where the institutional Option Strategy Ranking engine will
// plug in — it returns the same RecommendedStrategy contract.
export function selectStrategy({ direction, volRegime, sellingSuitability, trendStrength }: SelectArgs): RecommendedStrategy {
  const richVol = volRegime === 'HIGH' || volRegime === 'EXTREME' || volRegime === 'ELEVATED';
  const cheapVol = volRegime === 'LOW' || volRegime === 'VERY_LOW';
  const sell = sellingSuitability >= 55;
  const strongTrend = trendStrength >= 60;

  if (direction === 'NEUTRAL') {
    if (volRegime === 'EXTREME') return fam('Defensive Long Premium', 'Hedge', 'Extreme vol — long-vol / hedged structures over short premium.');
    if (richVol && sell) return fam('Iron Condor', 'Range / Income', 'Neutral bias with rich IV — sell a defined-risk condor around the range.');
    if (richVol) return fam('Short Strangle (defined)', 'Range / Income', 'Neutral with elevated IV — collect premium, manage the untested side.');
    if (cheapVol) return fam('Calendar Spread', 'Long Vol', 'Neutral with cheap IV — own time / vega via a calendar.');
    return fam('Iron Butterfly', 'Range / Income', 'Neutral, fair IV — pin the range with a defined-risk fly.');
  }

  if (direction === 'BULLISH') {
    if (richVol && sell) return fam('Bull Put Spread', 'Directional Credit', 'Bullish with rich IV — sell put spreads for positive theta & delta.');
    if (richVol && strongTrend) return fam('Jade Lizard', 'Directional Credit', 'Bullish trend + high IV — no upside risk, collect skew premium.');
    if (cheapVol) return fam('Bull Call Spread', 'Directional Debit', 'Bullish with cheap IV — pay up for defined-risk upside.');
    return fam('Bull Call Spread', 'Directional Debit', 'Bullish, fair IV — defined-risk long delta.');
  }

  // BEARISH
  if (richVol && sell) return fam('Bear Call Spread', 'Directional Credit', 'Bearish with rich IV — sell call spreads into strength.');
  if (cheapVol) return fam('Bear Put Spread', 'Directional Debit', 'Bearish with cheap IV — pay for defined-risk downside.');
  return fam('Bear Put Spread', 'Directional Debit', 'Bearish, fair IV — defined-risk short delta.');
}

function fam(name: string, family: string, rationale: string): RecommendedStrategy {
  return { name, family, rationale };
}
