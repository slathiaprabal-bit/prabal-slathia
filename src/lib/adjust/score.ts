// Institutional decision logic. Not a pure objective maximizer: the engine
// reads the trader's Market Thesis first (the target scenario), then scores each
// adjustment on five trader priorities — Capital Preservation (30%), Objective
// Match (25%), Cost Efficiency (20%), Risk Reduction (15%), Execution Simplicity
// (10%). Current unrealized profit is treated as an asset, not disposable.
import { coreProfit, payoffFromNow } from './metrics';
import type {
  AdjMode, Aggressiveness, AdjustmentAnalysis, Leg, MarketThesis, Metrics, OptimizeConfig, Position,
} from './types';

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const n01 = (v: number, lo: number, hi: number) => (hi > lo ? clamp01((v - lo) / (hi - lo)) : 0.5);
// Efficiency is unbounded for near-free credit structures; clamp before it feeds
// normalization/scoring so one outlier can't compress the whole set to zero.
const effClamp = (x: number) => Math.max(-5, Math.min(25, x));

// STEP 3 — minimum fraction of current expiry (pinned) profit to retain.
export function minRetain(a: Aggressiveness): number {
  return a === 'CONSERVATIVE' ? 0.9 : a === 'BALANCED' ? 0.7 : -Infinity;
}

// STEP 1/9 — the scenario the trader is positioning FOR: signed point offsets
// from spot with weights. The objective only fills in a No-View gap.
export function targetScenario(mode: AdjMode, thesis: MarketThesis, pos: Position):
  { pts: number[]; weights: number[]; label: string } {
  const sigma = pos.spot * pos.iv * Math.sqrt(pos.dte / 365);
  const R = (n: number) => Math.round(Math.abs(n)).toLocaleString('en-IN');
  const both = { pts: [-2.5 * sigma, 2.5 * sigma], weights: [0.5, 0.5], label: `±2.5σ (±${R(2.5 * sigma)})` };
  switch (thesis) {
    // "Strong" theses span the move AND its tail, so convex structures that
    // accelerate past their strikes are rewarded over linear directional ones.
    case 'STRONG_BEARISH': return { pts: [-2 * sigma, -3 * sigma], weights: [0.5, 0.5], label: `−2σ→−3σ (−${R(2 * sigma)}/${R(3 * sigma)})` };
    case 'MILD_BEARISH':   return { pts: [-1 * sigma], weights: [1], label: `−1σ (−${R(sigma)})` };
    case 'MILD_BULLISH':   return { pts: [ 1 * sigma], weights: [1], label: `+1σ (+${R(sigma)})` };
    case 'STRONG_BULLISH': return { pts: [ 2 * sigma, 3 * sigma], weights: [0.5, 0.5], label: `+2σ→+3σ (+${R(2 * sigma)}/${R(3 * sigma)})` };
    case 'VOL_EXPANSION':  return both;
    case 'NEUTRAL':
    case 'THETA_DECAY':    return { pts: [0], weights: [1], label: 'pinned at spot' };
    case 'NO_VIEW':
    default:
      if (mode === 'CRASH') return { pts: [-2 * sigma], weights: [1], label: `−2σ (−${R(2 * sigma)})` };
      if (mode === 'VOL') return both;
      return { pts: [0], weights: [1], label: 'pinned at spot' };
  }
}

// STEP 5/7/8 — raw, un-normalized read on one adjustment. Cross-candidate
// normalization + weighting happens in componentScores (needs the whole set).
export function analyzeCandidate(
  resultLegs: Leg[], m: Metrics, base: Metrics, pos: Position, cfg: OptimizeConfig,
  target: { pts: number[]; weights: number[]; label: string },
): AdjustmentAnalysis {
  const premiumPaid = Math.max(0, -m.adjustCost);

  // "Expected expiry profit" = density-weighted profit across the ±1σ core (the
  // profit tent), so a ratio structure can't hide a loss valley off spot. This
  // is the winner we protect (STEP 7).
  const expProfitBase = coreProfit(pos.legs, pos, 1.25);
  const expProfitAfter = coreProfit(resultLegs, pos, 1.25);
  const profitRetained = expProfitBase > 1 ? expProfitAfter / expProfitBase : 1;

  // Extra profit specifically in the trader's target scenario (STEP 8 display).
  let scenarioGain = 0;
  for (let i = 0; i < target.pts.length; i++) {
    const s = pos.spot + target.pts[i];
    scenarioGain += target.weights[i] * (payoffFromNow(resultLegs, s, pos) - payoffFromNow(pos.legs, s, pos));
  }
  // Opportunity Efficiency = objective benefit ÷ cost. The "benefit" is what the
  // chosen objective is actually buying, so Defensive rewards protection-per-rupee
  // (not convex profit), Theta rewards theta-per-rupee, Crash/Vol the scenario gain.
  let benefit = scenarioGain;
  if (cfg.mode === 'DEFENSIVE') benefit = Math.max(0, m.maxLoss - base.maxLoss) + Math.max(0, scenarioGain);
  else if (cfg.mode === 'THETA') benefit = (m.theta - base.theta) * Math.max(1, pos.dte);
  const effFloor = Math.max(pos.lotSize * 2, 1);   // ~2 pts of premium — avoids ÷0 on credits
  const opportunityEfficiency = benefit / Math.max(premiumPaid, effFloor);

  // Directional protection: improvement in the WORST-CASE loss on the side the
  // thesis threatens. A real hedge (long put) lifts that floor by tens of
  // thousands; a credit structure only adds its flat premium — so this cleanly
  // separates genuine defense from premium collection.
  const sigma = pos.spot * pos.iv * Math.sqrt(pos.dte / 365);
  const dir = target.pts.reduce((s, p, i) => s + p * target.weights[i], 0);
  const sideSign = dir < 0 ? -1 : dir > 0 ? 1 : 0;
  const worstOnSide = (legs: Leg[], sign: number) => {
    let worst = Infinity;
    for (let i = 0; i <= 12; i++) {
      const s = pos.spot + sign * (i / 12) * 3 * sigma;
      worst = Math.min(worst, payoffFromNow(legs, s, pos));
    }
    return worst;
  };
  const signsToScan = sideSign !== 0 ? [sideSign] : [-1, 1];
  let directionalProtect = 0;
  for (const s of signsToScan) directionalProtect += worstOnSide(resultLegs, s) - worstOnSide(pos.legs, s);
  directionalProtect /= signsToScan.length;

  // The winner-at-risk flag is aggressiveness-aware in Crash: Aggressive exists
  // precisely to spend profit on convexity, so it isn't flagged for doing so.
  const flagThresh = cfg.mode === 'CRASH'
    ? (cfg.aggressiveness === 'CONSERVATIVE' ? 0.10 : cfg.aggressiveness === 'AGGRESSIVE' ? 0.85 : 0.30)
    : cfg.retainThreshold;
  // Thesis-first (STEP 9): profit handed over is only a problem when the target
  // scenario doesn't pay it back. A bearish backspread that gives up ₹5k of tent
  // profit but makes ₹55k in the −2σ move it's built for is repositioning, not
  // wasting. A debit hedge under a Neutral thesis is not compensated → flagged.
  const givenUp = Math.max(0, expProfitBase - expProfitAfter);
  const compensated = scenarioGain > givenUp;
  const flags: string[] = [];
  if (expProfitBase > 1 && profitRetained < 1 - flagThresh && !compensated) {
    flags.push(`Cuts expected expiry profit ${Math.round((1 - profitRetained) * 100)}% — existing winner at risk`);
  }

  return {
    adjustCost: m.adjustCost, premiumPaid, marginChange: m.margin - base.margin,
    thetaChange: m.theta - base.theta, vegaChange: m.vega - base.vega, deltaChange: m.delta - base.delta,
    expProfitBase, expProfitAfter, profitRetained, scenarioGain, directionalProtect, scenarioLabel: target.label,
    opportunityEfficiency, breakdown: { capital: 0, objective: 0, cost: 0, risk: 0, simplicity: 0 }, flags,
  };
}

// Normalization ranges over the whole candidate set.
export interface Norms {
  maxLossLo: number; maxLossHi: number; popLo: number; popHi: number;
  thetaLo: number; thetaHi: number; tpmLo: number; tpmHi: number;
  effLo: number; effHi: number; gainLo: number; gainHi: number;
  premLo: number; premHi: number; vegaLo: number; vegaHi: number;
  tailLo: number; tailHi: number; dirLo: number; dirHi: number;
}

export function buildNorms(rows: { m: Metrics; a: AdjustmentAnalysis }[], base: Metrics): Norms {
  const arr = (f: (r: { m: Metrics; a: AdjustmentAnalysis }) => number) => rows.map(f);
  const lo = (xs: number[]) => Math.min(...xs);
  const hi = (xs: number[]) => Math.max(...xs);
  const tpm = (r: { m: Metrics; a: AdjustmentAnalysis }) => r.m.theta / (r.m.margin + 1);
  return {
    maxLossLo: lo(arr((r) => r.m.maxLoss)), maxLossHi: hi(arr((r) => r.m.maxLoss)),
    popLo: lo(arr((r) => r.m.pop - base.pop)), popHi: hi(arr((r) => r.m.pop - base.pop)),
    thetaLo: lo(arr((r) => r.a.thetaChange)), thetaHi: hi(arr((r) => r.a.thetaChange)),
    tpmLo: lo(arr(tpm)), tpmHi: hi(arr(tpm)),
    effLo: lo(arr((r) => effClamp(r.a.opportunityEfficiency))), effHi: hi(arr((r) => effClamp(r.a.opportunityEfficiency))),
    gainLo: lo(arr((r) => r.a.scenarioGain)), gainHi: hi(arr((r) => r.a.scenarioGain)),
    premLo: lo(arr((r) => r.a.premiumPaid)), premHi: hi(arr((r) => r.a.premiumPaid)),
    vegaLo: lo(arr((r) => r.a.vegaChange)), vegaHi: hi(arr((r) => r.a.vegaChange)),
    tailLo: lo(arr((r) => r.m.tailPayoff)), tailHi: hi(arr((r) => r.m.tailPayoff)),
    dirLo: lo(arr((r) => r.a.directionalProtect)), dirHi: hi(arr((r) => r.a.directionalProtect)),
  };
}

// STEP 4/6 — the five weighted trader priorities → 0..1 sub-scores + final 0..1.
export function componentScores(
  a: AdjustmentAnalysis, m: Metrics, base: Metrics, addedLegs: Leg[],
  pos: Position, cfg: OptimizeConfig, N: Norms,
): { breakdown: AdjustmentAnalysis['breakdown']; score: number } {
  const hasWinner = a.expProfitBase > 1;
  const popImprove = m.pop - base.pop;

  // ── Capital Preservation (30%) — protect the two ways capital dies: giving back
  // realized profit, and catastrophic max loss. Spending premium to *cap* a
  // runaway loss preserves capital (so Defensive can justify buying protection);
  // cheapness itself is a Cost-Efficiency concern, scored separately below.
  const retention = hasWinner ? clamp01(a.profitRetained) : n01(m.maxLoss, N.maxLossLo, N.maxLossHi);
  const maxLossScore = n01(m.maxLoss, N.maxLossLo, N.maxLossHi);
  let capital = clamp01(0.5 * retention + 0.5 * maxLossScore);
  // Aggressiveness floor: under Conservative/Balanced a crash hedge that spends
  // past the retain limit is gutted; Aggressive removes the floor by design.
  if (cfg.mode === 'CRASH' && hasWinner && a.profitRetained < minRetain(cfg.aggressiveness)) capital *= 0.25;

  // ── Objective Match (25%) — each objective has its own personality (STEP 4) ──
  let objective = 0;
  switch (cfg.mode) {
    case 'DEFENSIVE': {
      // Cap the unlimited tail and flatten the book. Greek terms are *signed*:
      // a structure that adds gamma/vega magnitude (a long-option backspread) is
      // off-objective for a defensive trade and is pushed down, not just un-rewarded.
      // STEP 4 literal: reduce max loss, raise POP, protect the threatened side,
      // and flatten the book. The hard flat-gate disqualifies anything that ADDS
      // net vega/gamma — the opposite of defensive — regardless of other merits.
      const popS = n01(popImprove, N.popLo, N.popHi);
      const lossImp = n01(m.maxLoss, N.maxLossLo, N.maxLossHi);
      const protectThreatened = n01(a.directionalProtect, N.dirLo, N.dirHi);
      const flatGate = (Math.abs(m.vega) <= Math.abs(base.vega) * 1.02 && Math.abs(m.gamma) <= Math.abs(base.gamma) * 1.02) ? 1 : 0.35;
      const marginCut = clamp01((base.margin - m.margin) / (base.margin + 1));
      objective = clamp01(0.35 * lossImp + 0.3 * popS + 0.2 * protectThreatened + 0.15 * marginCut) * flatGate;
      break;
    }
    case 'THETA': {
      const tpm = n01(m.theta / (m.margin + 1), N.tpmLo, N.tpmHi);   // theta per rupee of margin
      const thetaUp = n01(a.thetaChange, N.thetaLo, N.thetaHi);
      const deltaFlat = 1 - clamp01(Math.abs(m.delta) / (pos.lotSize * 3));
      objective = clamp01(0.45 * tpm + 0.3 * thetaUp + 0.25 * deltaFlat) * (m.theta > 0 ? 1 : 0.25);
      break;
    }
    case 'CRASH': {
      // Convexity in the thesis scenario is the point (STEP 2/4): reward payoff in
      // the target move first, efficiency second, keep theta. Capital Preservation
      // + the retain floor separately filter out variants that gut the winner, so
      // the survivors are the *cheap* convex ones. Non-bearish theses make the
      // target pin/upside, which naturally starves downside hedges of gain.
      const gain = n01(a.scenarioGain, N.gainLo, N.gainHi);
      const eff = n01(effClamp(a.opportunityEfficiency), N.effLo, N.effHi);
      const thetaKeep = m.theta >= 0 ? 1 : clamp01(1 + a.thetaChange / (Math.abs(base.theta) + 1));
      objective = clamp01(0.55 * gain + 0.3 * eff + 0.15 * thetaKeep);
      break;
    }
    case 'VOL': {
      // IV expansion only — reward long vega + payoff in the ±2σ move; ignore theta.
      const vegaUp = n01(a.vegaChange, N.vegaLo, N.vegaHi);
      const gain = n01(a.scenarioGain, N.gainLo, N.gainHi);
      objective = clamp01(0.6 * vegaUp + 0.4 * gain);
      break;
    }
  }

  // ── Cost Efficiency (20%) — opportunity efficiency + cheap premium ──
  const eff = n01(a.opportunityEfficiency, N.effLo, N.effHi);
  const cheap = 1 - n01(a.premiumPaid, N.premLo, N.premHi);
  const cost = clamp01(0.6 * eff + 0.4 * cheap);

  // ── Risk Reduction (15%) — shallower max loss, higher POP, better tail ──
  const risk = clamp01(0.5 * n01(m.maxLoss, N.maxLossLo, N.maxLossHi)
    + 0.3 * n01(popImprove, N.popLo, N.popHi)
    + 0.2 * n01(m.tailPayoff, N.tailLo, N.tailHi));

  // ── Execution Simplicity (10%) — a trader prefers one clean leg over a ratio ──
  const nLegs = addedLegs.length;
  const qtys = addedLegs.map((l) => Math.abs(l.qty));
  const isRatio = qtys.some((q) => q !== qtys[0]);
  const simplicity = clamp01((1 - (nLegs - 1) / 4) * (isRatio ? 0.6 : 1));

  const score = 0.30 * capital + 0.25 * objective + 0.20 * cost + 0.15 * risk + 0.10 * simplicity;
  return { breakdown: { capital, objective, cost, risk, simplicity }, score };
}
