import type { Snapshot } from '../../types';
import type { PortfolioInputs } from './types';

// Pure derivation of PortfolioInputs from a Snapshot.
export function buildPortfolioInputs(snap: Snapshot): PortfolioInputs {
  const { greeks, risk, montecarlo, vol, spot } = snap;
  return {
    greeks: {
      delta: greeks.delta, gamma: greeks.gamma, theta: greeks.theta, vega: greeks.vega,
      charm: greeks.charm, vanna: greeks.vanna, vomma: greeks.vomma, speed: greeks.speed,
    },
    lots: risk.lots ?? 0,
    equity: risk.equity ?? 0,
    capitalAtRisk: risk.capitalAtRisk ?? 0,
    marginUsed: risk.marginUsed ?? 0,
    marginUtil: risk.marginUsage ?? 0,
    heat: risk.portfolioHeat ?? 0,
    em1d: vol.em1d ?? 0,
    vix: vol.vix,
    spot,
    mc: {
      pRuin: risk.probRuin ?? montecarlo?.pRuin ?? 0,
      pDD20: montecarlo?.pDD20 ?? 0,
      medianReturnPct: montecarlo?.medianReturnPct ?? 0,
      expectedDrawdown: risk.expectedDrawdown ?? montecarlo?.expectedDrawdown ?? 0,
      worstMaxDD: risk.worstMaxDD ?? montecarlo?.worstMaxDD ?? 0,
      histCounts: montecarlo?.hist?.counts ?? [],
      histEdges: montecarlo?.hist?.edges ?? [],
    },
  };
}
