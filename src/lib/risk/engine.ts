import type { PortfolioInputs, PortfolioState, NetGreeks, Exposure, RiskContribution } from './types';
import { clamp, round } from './types';

// Parametric 1-day VaR + Greek-decomposed risk contribution + Monte-Carlo
// probabilities. Pure and fully testable.
export function computePortfolio(i: PortfolioInputs): PortfolioState {
  const lotsEff = Math.max(i.lots, 1);
  const g = scale(i.greeks, lotsEff);

  const equity = i.equity || 1;
  const beta = round((g.delta * i.spot) / equity);
  const dollarDelta = round(g.delta);

  // 1σ shocks: underlying daily expected move + a vol-of-vol estimate.
  const dVol1 = Math.max(0.8, i.vix * 0.06);
  const sigDelta = Math.abs(g.delta) * i.em1d;
  const sigGamma = 0.5 * Math.abs(g.gamma) * i.em1d * i.em1d;
  const sigVega = Math.abs(g.vega) * dVol1;
  const sigTotal = Math.sqrt(sigDelta * sigDelta + sigVega * sigVega) + sigGamma;

  const var95 = round(1.645 * sigTotal);
  const var99 = round(2.326 * sigTotal);
  const varPctEquity = round((var95 / equity) * 1000) / 1000;

  // Variance decomposition → risk contribution %.
  const vD = sigDelta ** 2, vG = sigGamma ** 2, vV = sigVega ** 2;
  const vT = vD + vG + vV || 1;
  const riskContributions: RiskContribution[] = [
    { factor: 'Delta', pct: round((vD / vT) * 100) },
    { factor: 'Gamma', pct: round((vG / vT) * 100) },
    { factor: 'Vega', pct: round((vV / vT) * 100) },
  ];

  const deltaBias: Exposure = beta > 0.08 ? 'LONG' : beta < -0.08 ? 'SHORT' : 'NEUTRAL';
  const vegaBias: Exposure = g.vega > 10 ? 'LONG' : g.vega < -10 ? 'SHORT' : 'NEUTRAL';

  const pProfit = probProfit(i.mc);

  const reasoning = buildReasoning({ beta, var95, varPctEquity, marginUtil: i.marginUtil, heat: i.heat, deltaBias, vegaBias, g, pProfit, pRuin: i.mc.pRuin });

  return {
    greeks: g, lots: lotsEff, beta, dollarDelta, var95, var99, varPctEquity,
    riskContributions, marginUtil: i.marginUtil, heat: i.heat,
    equity: i.equity, capitalAtRisk: i.capitalAtRisk, marginUsed: i.marginUsed,
    deltaBias, vegaBias,
    mc: {
      pProfit, pRuin: i.mc.pRuin, pDD20: i.mc.pDD20, medianReturnPct: i.mc.medianReturnPct,
      expectedDrawdown: i.mc.expectedDrawdown, worstMaxDD: i.mc.worstMaxDD,
    },
    reasoning,
  };
}

function scale(g: NetGreeks, q: number): NetGreeks {
  return {
    delta: g.delta * q, gamma: g.gamma * q, theta: g.theta * q, vega: g.vega * q,
    charm: g.charm * q, vanna: g.vanna * q, vomma: g.vomma * q, speed: g.speed * q,
  };
}

// P(profit) from the Monte-Carlo return histogram; falls back to percentiles.
function probProfit(mc: PortfolioInputs['mc']): number {
  const { histCounts, histEdges } = mc;
  if (histCounts?.length && histEdges?.length === histCounts.length + 1) {
    let total = 0, win = 0;
    for (let k = 0; k < histCounts.length; k++) {
      const mid = (histEdges[k] + histEdges[k + 1]) / 2;
      total += histCounts[k];
      if (mid > 0) win += histCounts[k];
    }
    if (total > 0) return round((win / total) * 100);
  }
  return round(clamp(50 + mc.medianReturnPct * 4, 0, 100));
}

function buildReasoning(a: {
  beta: number; var95: number; varPctEquity: number; marginUtil: number; heat: number;
  deltaBias: Exposure; vegaBias: Exposure; g: NetGreeks; pProfit: number; pRuin: number;
}): string[] {
  const out: string[] = [];
  out.push(`Portfolio beta ${a.beta.toFixed(2)} — ${a.deltaBias === 'NEUTRAL' ? 'near delta-neutral' : a.deltaBias === 'LONG' ? 'net long the index' : 'net short the index'}.`);
  out.push(`1-day VaR(95%) ₹${Math.round(a.var95).toLocaleString('en-IN')} (${(a.varPctEquity * 100).toFixed(2)}% of equity); theta ₹${Math.round(a.g.theta).toLocaleString('en-IN')}/day.`);
  out.push(`${a.vegaBias === 'SHORT' ? 'Short vega' : a.vegaBias === 'LONG' ? 'Long vega' : 'Vega-neutral'} — ${a.vegaBias === 'SHORT' ? 'profits as IV compresses, exposed to spikes' : a.vegaBias === 'LONG' ? 'profits as IV expands' : 'minimal IV sensitivity'}.`);
  out.push(`Margin ${(a.marginUtil * 100).toFixed(0)}% utilised, heat ${(a.heat * 100).toFixed(1)}% — ${a.marginUtil < 0.4 && a.heat < 0.03 ? 'ample capacity' : a.marginUtil < 0.7 ? 'measured capacity' : 'limited capacity'}.`);
  out.push(`Monte-Carlo P(profit) ${a.pProfit.toFixed(0)}%, P(ruin) ${(a.pRuin * 100).toFixed(1)}%.`);
  return out;
}
