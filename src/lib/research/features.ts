import type { Snapshot } from '../../types';
import type { RegimeScore } from '../macro/types';
import type { VolState } from '../vol/types';
import type { DecisionOutput } from '../decision/types';
import type { PortfolioState } from '../risk/types';
import type { DealerState } from '../dealer/types';
import type { HmmState } from '../hmm/types';
import type { MCState } from '../montecarlo/types';
import type { RankedStrategy } from '../ranking/types';

// Standardized, FLAT research row matching sql/research_schema.sql. Built from
// engine OUTPUTS only — engines are never modified to produce it (task 6).
export interface ResearchRow {
  ts: string; tradingDate: string;
  source: string; chainSynth: number;
  spot: number; vix: number; ivRank: number; ivPctile: number; hv20: number; vrp: number;
  emExpiry: number; pInside1: number; pcr: number; maxPain: number;
  regimeState: string; regimeConfidence: number;
  // engine outputs
  macroScore: number; macroConfidence: number;
  volScore: number; volRegime: string; volPremium: string; volVegaBias: string;
  volExpansion: number; volCompression: number; volAtmIv: number; volSkew: number; volTermSlope: number;
  decDirection: string; decDirectionalScore: number; decTrendStrength: number;
  decSellingSuitability: number; decConfidence: number;
  riskBeta: number; riskVar95: number; riskVarPct: number; riskHeat: number; riskMargin: number;
  dealerNetGex: number; dealerGammaFlip: number; dealerMaxPain: number; dealerRegime: string;
  hmmRegime: string; hmmConfidence: number; hmmTransitionRisk: number;
  mcPProfit: number; mcExpectedPnl: number;
  // recommendation
  strategy: string; family: string; direction: string; confidence: number;
  shortPut: number; shortCall: number; creditPerLot: number; maxLoss: number;
  rankTop: string; rankScore: number;
}

export interface FeatureContext {
  macro?: RegimeScore | null;
  vol?: VolState | null;
  decision?: DecisionOutput | null;
  risk?: PortfolioState | null;
  dealer?: DealerState | null;
  hmm?: HmmState | null;
  mc?: MCState | null;
  ranking?: RankedStrategy[] | null;
}

const n = (v: number | null | undefined) => (v == null || !isFinite(v) ? 0 : v);

export function buildResearchRow(snap: Snapshot, c: FeatureContext): ResearchRow {
  const top = c.ranking?.[0];
  return {
    ts: snap.ts, tradingDate: snap.ts.slice(0, 10),
    source: snap.source, chainSynth: snap.chainSynthetic ? 1 : 0,
    spot: n(snap.spot), vix: n(snap.vol.vix), ivRank: n(snap.vol.ivRank), ivPctile: n(snap.vol.ivPctile),
    hv20: n(snap.vol.hv20), vrp: n(snap.vol.vrp), emExpiry: n(snap.vol.emExpiry), pInside1: n(snap.vol.pInside1),
    pcr: n(snap.positioning.pcr), maxPain: n(snap.positioning.maxPain),
    regimeState: snap.regime.state, regimeConfidence: n(snap.regime.confidence),

    macroScore: n(c.macro?.score), macroConfidence: n(c.macro?.confidence),
    volScore: n(c.vol?.score), volRegime: c.vol?.regime ?? '', volPremium: c.vol?.premiumRichness ?? '', volVegaBias: c.vol?.vegaBias ?? '',
    volExpansion: n(c.vol?.expansionProb), volCompression: n(c.vol?.compressionProb), volAtmIv: n(c.vol?.atmIv), volSkew: n(c.vol?.skew), volTermSlope: n(c.vol?.termSlope),
    decDirection: c.decision?.direction ?? '', decDirectionalScore: n(c.decision?.directionalScore), decTrendStrength: n(c.decision?.trendStrength),
    decSellingSuitability: n(c.decision?.sellingSuitability), decConfidence: n(c.decision?.confidence),
    riskBeta: n(c.risk?.beta), riskVar95: n(c.risk?.var95), riskVarPct: n(c.risk?.varPctEquity), riskHeat: n(c.risk?.heat), riskMargin: n(c.risk?.marginUtil),
    dealerNetGex: n(c.dealer?.netGex), dealerGammaFlip: n(c.dealer?.gammaFlip), dealerMaxPain: n(c.dealer?.maxPain), dealerRegime: c.dealer?.gammaRegime ?? '',
    hmmRegime: c.hmm?.label ?? '', hmmConfidence: n(c.hmm?.confidence), hmmTransitionRisk: n(c.hmm?.transitionRisk),
    mcPProfit: n(c.mc?.pProfit), mcExpectedPnl: n(c.mc?.expectedPnl),

    strategy: c.decision?.strategy.name ?? '', family: c.decision?.strategy.family ?? '',
    direction: c.decision?.direction ?? '', confidence: n(c.decision?.confidence),
    shortPut: n(snap.trade?.shortPut), shortCall: n(snap.trade?.shortCall),
    creditPerLot: n(snap.trade?.creditPerLot), maxLoss: n(snap.trade?.maxLoss),
    rankTop: top?.name ?? '', rankScore: n(top?.score),
  };
}

// Numeric-only feature keys for ML matrices.
export const NUMERIC_FEATURES: (keyof ResearchRow)[] = [
  'spot', 'vix', 'ivRank', 'ivPctile', 'hv20', 'vrp', 'emExpiry', 'pInside1', 'pcr', 'maxPain', 'regimeConfidence',
  'macroScore', 'macroConfidence', 'volScore', 'volExpansion', 'volCompression', 'volAtmIv', 'volSkew', 'volTermSlope',
  'decDirectionalScore', 'decTrendStrength', 'decSellingSuitability', 'decConfidence',
  'riskBeta', 'riskVar95', 'riskVarPct', 'riskHeat', 'riskMargin',
  'dealerNetGex', 'dealerGammaFlip', 'dealerMaxPain', 'hmmConfidence', 'hmmTransitionRisk', 'mcPProfit', 'mcExpectedPnl',
];
