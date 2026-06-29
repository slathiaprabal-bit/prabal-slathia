import type { Snapshot } from '../types';
import type { MarketContext } from './types';

// ════════════════════════════════════════════════════════════════════════
//  DATA-PROVIDER BOUNDARY
//  VOLARA is, for this project, only a data feed. This is the single seam
//  where the agent touches a VOLARA Snapshot; everything downstream consumes
//  the normalised `MarketContext`. To plug a different feed (replay file,
//  another desk's API), implement one function with this signature.
// ════════════════════════════════════════════════════════════════════════

export function contextFromSnapshot(snap: Snapshot, symbol = 'NIFTY'): MarketContext {
  const dir: MarketContext['direction'] =
    snap.regime.direction?.toUpperCase().includes('UP') ? 'UP'
    : snap.regime.direction?.toUpperCase().includes('DOWN') ? 'DOWN'
    : 'FLAT';

  return {
    ts: snap.ts,
    symbol,
    spot: snap.spot,

    regimeState: snap.regime.state,
    direction: dir,
    trendConfidence: clamp01(snap.regime.confidence),
    // trendAtr arrives as price points; normalise to a fraction of spot.
    trendAtr: snap.spot ? Math.abs(snap.regime.trendAtr) / snap.spot : 0,

    vix: snap.vol.vix,
    vixChg: snap.regime.vixChg,
    ivRank: snap.vol.ivRank,
    ivPctile: snap.vol.ivPctile,
    vrp: snap.vol.vrp,
    expectedMove1d: snap.spot ? Math.abs(snap.vol.em1d) / snap.spot : 0,
    pInside1: clamp01(snap.vol.pInside1),

    pcr: snap.positioning.pcr,
    maxPain: snap.positioning.maxPain,
    support: snap.positioning.support ?? [],
    resistance: snap.positioning.resistance ?? [],
    gammaFlip: snap.positioning.gammaFlip,
    gex: snap.positioning.gex,

    equity: snap.risk.equity,
    portfolioHeat: clamp01(snap.risk.portfolioHeat),
    marginUsage: clamp01(snap.risk.marginUsage),

    chainSynthetic: snap.chainSynthetic || snap.positioning.synthetic,
    dataLive: snap.source !== 'mock' && snap.source !== 'demo',
  };
}

// VOLARA mixes 0..1 and 0..100 conventions across fields; coerce defensively.
function clamp01(v: number | null | undefined): number {
  if (v === null || v === undefined || !isFinite(v)) return 0;
  const x = v > 1.0001 ? v / 100 : v;
  return Math.max(0, Math.min(1, x));
}
