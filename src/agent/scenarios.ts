import type { MarketContext } from './types';

// ════════════════════════════════════════════════════════════════════════
//  DEMO SCENARIOS
//  VOLARA's in-browser demo feed is deliberately noisy and flagged synthetic,
//  so on demo data the agent (correctly) refuses almost everything — which
//  hides its reasoning. Following the terminal's "never blank in DEMO" rule,
//  these hand-built contexts exercise the FULL decision range so the desk is
//  legible without a live backend. They are clearly labelled DEMO in the UI
//  and are never used when a live feed is present.
//
//  Each is a realistic, internally-consistent MarketContext (the same shape
//  the live provider emits) chosen to land on a different verdict.
// ════════════════════════════════════════════════════════════════════════

const BASE: MarketContext = {
  ts: '', symbol: 'NIFTY', spot: 24800,
  regimeState: 'NORMAL', direction: 'FLAT', trendConfidence: 0.5, trendAtr: 0.005,
  vix: 13, vixChg: 0, ivRank: 45, ivPctile: 0.5, vrp: 1.5, expectedMove1d: 0.006, pInside1: 0.68,
  pcr: 1.0, maxPain: 24800, support: [24500, 24300], resistance: [25000, 25200],
  gammaFlip: 24700, gex: 1, equity: 2_000_000, portfolioHeat: 0.2, marginUsage: 0.3,
  chainSynthetic: false, dataLive: true,
};

export interface DemoScenario { name: string; ctx: MarketContext; }

export const SCENARIOS: DemoScenario[] = [
  {
    name: 'Trending up — clean continuation',
    ctx: {
      ...BASE, spot: 24910, regimeState: 'TRENDING_UP', direction: 'UP',
      trendConfidence: 0.74, trendAtr: 0.0095, vix: 12.5, vixChg: -0.4, ivRank: 38,
      vrp: 1.2, pcr: 1.28, maxPain: 24600, support: [24750, 24500], resistance: [25250, 25500],
      gammaFlip: 25050, gex: -2, pInside1: 0.6, portfolioHeat: 0.22,
    },
  },
  {
    name: 'Range — rich premium to sell',
    ctx: {
      ...BASE, spot: 24805, regimeState: 'NORMAL', direction: 'FLAT',
      trendConfidence: 0.3, ivRank: 62, vix: 14.5, vixChg: -0.6, vrp: 3.1, pInside1: 0.74,
      pcr: 1.02, maxPain: 24800, gammaFlip: 24600, gex: 4, portfolioHeat: 0.28,
    },
  },
  {
    name: 'Volatility expansion — own gamma',
    ctx: {
      ...BASE, spot: 24420, regimeState: 'VOLATILE', direction: 'DOWN',
      trendConfidence: 0.55, trendAtr: 0.012, vix: 21, vixChg: 1.1, ivRank: 80, vrp: -0.6,
      pInside1: 0.52, pcr: 1.45, maxPain: 24700, gammaFlip: 24900, gex: -6, portfolioHeat: 0.3,
    },
  },
  {
    name: 'Event risk — stand aside',
    ctx: {
      ...BASE, spot: 24780, regimeState: 'EVENT_RISK', direction: 'FLAT',
      trendConfidence: 0.4, vix: 17, vixChg: 2.9, ivRank: 70, vrp: 2.2, pInside1: 0.55,
      portfolioHeat: 0.25,
    },
  },
  {
    name: 'Range — rich premium, unverified chain',
    ctx: {
      ...BASE, spot: 24800, regimeState: 'NORMAL', direction: 'FLAT',
      trendConfidence: 0.28, ivRank: 66, vix: 14, vixChg: -0.4, vrp: 3.4, pInside1: 0.76,
      pcr: 1.08, maxPain: 24800, gammaFlip: 24550, gex: 4, portfolioHeat: 0.3,
      chainSynthetic: true, dataLive: false, // positioning is unverified → CAUTION → partial size
    },
  },
  {
    name: 'Book at capacity — reduce risk',
    ctx: {
      ...BASE, spot: 24880, regimeState: 'TRENDING_UP', direction: 'UP',
      trendConfidence: 0.7, trendAtr: 0.009, ivRank: 42, vix: 13, vixChg: 0.2,
      portfolioHeat: 0.86, marginUsage: 0.78, pcr: 1.2,
    },
  },
];

// Deterministically pick a scenario for a demo tick, stamping a fresh ts so the
// note id and timeline advance naturally.
export function demoContext(tick: number): MarketContext {
  const s = SCENARIOS[((tick % SCENARIOS.length) + SCENARIOS.length) % SCENARIOS.length];
  return { ...s.ctx, ts: new Date().toISOString() };
}
