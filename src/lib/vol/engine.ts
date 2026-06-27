import type {
  VolInputs, VolState, VolRegime, VolTrend, PremiumRichness, VegaBias, VolDriver,
} from './types';
import { clamp, round } from './types';

// ── Score drivers ── each maps an input to a -1..+1 contribution toward an
// elevated / rich volatility state. Independently tunable via weights.
function drivers(i: VolInputs): VolDriver[] {
  const d: VolDriver[] = [
    { key: 'ivrank', label: 'IV Rank', weight: 0.26, contribution: clamp((i.ivRank - 50) / 50, -1, 1),
      detail: `IV Rank ${i.ivRank.toFixed(0)}` },
    { key: 'ivpctile', label: 'IV Percentile', weight: 0.18, contribution: clamp((i.ivPctile - 50) / 50, -1, 1),
      detail: `IV Percentile ${i.ivPctile.toFixed(0)}` },
    { key: 'vix', label: 'VIX Level', weight: 0.22, contribution: clamp(((i.vix - 8) / 22) * 2 - 1, -1, 1),
      detail: `India VIX ${i.vix.toFixed(2)}` },
    { key: 'vrp', label: 'Variance Risk Premium', weight: 0.14, contribution: clamp(i.vrp / 8, -1, 1),
      detail: `VRP ${i.vrp >= 0 ? '+' : ''}${i.vrp.toFixed(1)}` },
    { key: 'term', label: 'Term Structure', weight: 0.10, contribution: clamp(-i.termSlope / 5, -1, 1),
      detail: i.termSlope >= 0 ? `Contango ${i.termSlope.toFixed(1)}` : `Backwardation ${i.termSlope.toFixed(1)}` },
    { key: 'skew', label: 'Skew', weight: 0.10, contribution: clamp(-i.skew / 6, -1, 1),
      detail: `Skew ${i.skew >= 0 ? '+' : ''}${i.skew.toFixed(1)}` },
  ];
  return d;
}

function classifyRegime(score: number, vix: number): VolRegime {
  if (vix >= 26 || score >= 88) return 'EXTREME';
  if (vix >= 19 || score >= 72) return 'HIGH';
  if (vix >= 14 || score >= 55) return 'ELEVATED';
  if (vix >= 11 || score >= 38) return 'NORMAL';
  if (vix >= 9 || score >= 18) return 'LOW';
  return 'VERY_LOW';
}

function classifyTrend(vixChg: number, vrp: number): VolTrend {
  // VIX momentum is primary; a deeply negative VRP (IV < HV) hints at building
  // realized pressure that often precedes an IV rise.
  const m = vixChg + (vrp < -2 ? -1.5 : 0);
  if (m > 2.5) return 'RISING';
  if (m < -2.5) return 'FALLING';
  return 'STABLE';
}

function classifyRichness(vrp: number, ivRank: number): PremiumRichness {
  const r = 0.6 * clamp(vrp / 6, -1, 1) + 0.4 * clamp((ivRank - 50) / 40, -1, 1);
  if (r > 0.3) return 'RICH';
  if (r < -0.3) return 'CHEAP';
  return 'FAIR';
}

// Mean-reversion + momentum + term-structure → expansion / compression odds.
function transitionProbs(score: number, vixChg: number, termSlope: number) {
  const mr = (50 - score) / 50;                 // + when vol is low (room to rise)
  const mom = clamp(vixChg / 8, -1, 1);          // + when rising
  const term = clamp(termSlope / 5, -1, 1);      // backwardation (−) favours expansion
  const expansion = clamp(0.5 + 0.30 * mr + 0.35 * mom - 0.20 * term, 0, 1);
  const compression = clamp(0.5 - 0.30 * mr - 0.35 * mom + 0.20 * term, 0, 1);
  return { expansionProb: round(expansion * 100), compressionProb: round(compression * 100) };
}

function vegaBias(richness: PremiumRichness, regime: VolRegime, expansionProb: number, compressionProb: number): VegaBias {
  let s = richness === 'RICH' ? 1 : richness === 'CHEAP' ? -1 : 0;
  s += compressionProb > expansionProb + 10 ? 0.6 : expansionProb > compressionProb + 10 ? -0.6 : 0;
  if (regime === 'EXTREME') s -= 0.7; // extreme vol → fade short-vega (tail risk)
  if (regime === 'VERY_LOW') s -= 0.3; // very cheap vol → lean long
  if (s >= 0.8) return 'SHORT_VEGA';
  if (s <= -0.8) return 'LONG_VEGA';
  return 'NEUTRAL_VEGA';
}

// Single entry point — pure, fully testable.
export function computeVolState(i: VolInputs): VolState {
  const ds = drivers(i);
  const totalW = ds.reduce((s, x) => s + x.weight, 0) || 1;
  const net = ds.reduce((s, x) => s + x.weight * x.contribution, 0) / totalW; // -1..1
  const score = round(clamp(50 + net * 50, 0, 100));

  const regime = classifyRegime(score, i.vix);
  const trend = classifyTrend(i.vixChg, i.vrp);
  const premiumRichness = classifyRichness(i.vrp, i.ivRank);
  const { expansionProb, compressionProb } = transitionProbs(score, i.vixChg, i.termSlope);
  const bias = vegaBias(premiumRichness, regime, expansionProb, compressionProb);

  // Confidence: how decisive the score is (distance from neutral) + driver agreement.
  const dir = Math.sign(net) || 1;
  const agreeW = ds.reduce((s, x) => s + (Math.sign(x.contribution) === dir ? x.weight : 0), 0);
  const agreement = agreeW / totalW;
  const decisiveness = Math.min(1, Math.abs(net) / 0.5);
  const confidence = round(clamp(40 + 35 * agreement + 25 * decisiveness, 0, 100));

  const sorted = [...ds].sort((a, b) => Math.abs(b.weight * b.contribution) - Math.abs(a.weight * a.contribution));

  const reasoning = buildReasoning(i, { score, regime, trend, premiumRichness, expansionProb, compressionProb, bias });

  return {
    score, regime, trend, premiumRichness, expansionProb, compressionProb,
    vegaBias: bias, confidence, drivers: sorted, reasoning,
    atmIv: i.atmIv, vix: i.vix, ivRank: i.ivRank, ivPctile: i.ivPctile, hv: i.hv,
    vrp: i.vrp, emExpiry: i.emExpiry, emPct: i.emPct, termSlope: i.termSlope,
    skew: i.skew, pInside1: i.pInside1,
  };
}

function buildReasoning(
  i: VolInputs,
  s: { score: number; regime: VolRegime; trend: VolTrend; premiumRichness: PremiumRichness; expansionProb: number; compressionProb: number; bias: VegaBias },
): string[] {
  const out: string[] = [];
  out.push(`Volatility score ${s.score.toFixed(0)}/100 — ${s.regime.replace('_', ' ').toLowerCase()} regime (IVR ${i.ivRank.toFixed(0)}, VIX ${i.vix.toFixed(1)}).`);
  out.push(
    s.premiumRichness === 'RICH' ? `Premium rich — VRP ${i.vrp >= 0 ? '+' : ''}${i.vrp.toFixed(1)} with IV above realized.`
    : s.premiumRichness === 'CHEAP' ? `Premium cheap — VRP ${i.vrp >= 0 ? '+' : ''}${i.vrp.toFixed(1)}; options under-pricing realized risk.`
    : `Premium fair — IV broadly in line with realized.`,
  );
  out.push(
    i.termSlope >= 0 ? `Term structure in contango (${i.termSlope.toFixed(1)}) — calm forward expectations.`
    : `Term structure inverted (${i.termSlope.toFixed(1)}) — near-term stress priced in.`,
  );
  out.push(
    s.compressionProb > s.expansionProb
      ? `Compression more likely (${s.compressionProb.toFixed(0)}% vs ${s.expansionProb.toFixed(0)}%) — favours ${s.bias === 'SHORT_VEGA' ? 'short-vega premium capture' : 'theta-positive structures'}.`
      : `Expansion more likely (${s.expansionProb.toFixed(0)}% vs ${s.compressionProb.toFixed(0)}%) — favours ${s.bias === 'LONG_VEGA' ? 'long-vega / convex structures' : 'defensive sizing'}.`,
  );
  if (i.skew < -1) out.push(`Downside skew (${i.skew.toFixed(1)}) — puts bid, hedging demand elevated.`);
  return out;
}
