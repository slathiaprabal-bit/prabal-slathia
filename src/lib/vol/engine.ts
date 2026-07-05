import type {
  VolInputs, VolState, VolRegime, VolTrend, PremiumRichness, VegaBias, VolAction, VolDriver,
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

// The actionable signal. Traders act on a direction (buy/sell vol), stand
// aside on conflict (WAIT), or run delta-driven books when vol has no edge
// (NEUTRAL). Confidence gates conviction; regime extremes gate short vol.
function classifyAction(
  bias: VegaBias, richness: PremiumRichness, regime: VolRegime, trend: VolTrend,
  expansionProb: number, compressionProb: number, confidence: number,
): { action: VolAction; detail: string } {
  const edge = Math.abs(expansionProb - compressionProb);
  if (confidence < 55) {
    return { action: 'WAIT', detail: `Model confidence ${confidence.toFixed(0)}% — drivers disagree; stand aside until the picture clears.` };
  }
  if (bias === 'SHORT_VEGA' && trend === 'RISING') {
    return { action: 'WAIT', detail: 'Premium is rich but vol is still rising — selling into a rising tape is fighting momentum. Wait for the trend to stall.' };
  }
  if (bias === 'SHORT_VEGA' && (regime === 'EXTREME')) {
    return { action: 'WAIT', detail: 'Extreme regime — premium is rich but tail risk dominates; short vol only with defined risk once the regime steps down.' };
  }
  if (bias === 'SHORT_VEGA') {
    return { action: 'SELL_VOL', detail: `Rich premium with compression favoured (${compressionProb.toFixed(0)}% vs ${expansionProb.toFixed(0)}%) — harvest vega/theta with defined risk.` };
  }
  if (bias === 'LONG_VEGA' && trend === 'FALLING' && regime !== 'VERY_LOW') {
    return { action: 'WAIT', detail: 'Vol looks cheap but is still bleeding — buying a falling IV pays negative carry. Wait for stabilisation or a catalyst.' };
  }
  if (bias === 'LONG_VEGA') {
    return { action: 'BUY_VOL', detail: `Cheap premium with expansion favoured (${expansionProb.toFixed(0)}% vs ${compressionProb.toFixed(0)}%) — own convexity while it is under-priced.` };
  }
  // Explicit conflicts that net out to a neutral vega bias are still not
  // tradeable — rich premium in a rising tape / cheap premium in a bleed.
  if (richness === 'RICH' && trend === 'RISING') {
    return { action: 'WAIT', detail: 'Premium is rich but IV is still being marked up — the sell signal and the tape disagree. Wait for vol to stall before harvesting.' };
  }
  if (richness === 'CHEAP' && trend === 'FALLING' && regime !== 'VERY_LOW') {
    return { action: 'WAIT', detail: 'Premium is cheap but still cheapening — negative carry with no catalyst. Wait for a base in IV.' };
  }
  if (edge < 10) {
    return { action: 'NEUTRAL', detail: 'No vega edge — premium fair and transition odds balanced. Trade direction or theta, not vol.' };
  }
  return { action: 'NEUTRAL', detail: 'Signals mixed but not conflicting — no conviction position in vol; keep books vega-flat.' };
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
  const { action, detail: actionDetail } = classifyAction(bias, premiumRichness, regime, trend, expansionProb, compressionProb, confidence);
  const commentary = buildCommentary(i, { score, regime, trend, premiumRichness, expansionProb, compressionProb, bias, action });

  return {
    score, regime, trend, premiumRichness, expansionProb, compressionProb,
    vegaBias: bias, confidence, action, actionDetail, drivers: sorted, reasoning, commentary,
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

// Institutional interpretation — a desk-note style read of the whole state.
// Each line is "TAG · text" so the UI can typeset the section label.
function buildCommentary(
  i: VolInputs,
  s: { score: number; regime: VolRegime; trend: VolTrend; premiumRichness: PremiumRichness; expansionProb: number; compressionProb: number; bias: VegaBias; action: VolAction },
): string[] {
  const out: string[] = [];
  const sgn = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}`;

  out.push(`REGIME · Vol state reads ${s.regime.replace('_', ' ').toLowerCase()} — India VIX ${i.vix.toFixed(1)}, IV rank ${i.ivRank.toFixed(0)} / percentile ${i.ivPctile.toFixed(0)}, ATM IV ${i.atmIv.toFixed(1)}% vs ${i.hv.toFixed(1)}% realized. Trend ${s.trend.toLowerCase()}.`);

  out.push(s.premiumRichness === 'RICH'
    ? `VALUATION · Options are over-pricing realized risk: VRP ${sgn(i.vrp)} vol pts. Sellers are being paid to carry — the statistical edge sits with premium harvesting, sized for the regime.`
    : s.premiumRichness === 'CHEAP'
      ? `VALUATION · Options are under-pricing realized risk: VRP ${sgn(i.vrp)} vol pts. Convexity is on sale — long-gamma structures carry acceptably here.`
      : `VALUATION · Premium is fairly priced (VRP ${sgn(i.vrp)}) — neither side of the vol trade is being paid; edge must come from structure or timing.`);

  out.push(i.termSlope >= 0.4
    ? `TERM · Contango ${sgn(i.termSlope)}: back-month IV over front — calm forward pricing. Favours calendars (own the back, rent the front) and makes rolling short premium cheaper.`
    : i.termSlope <= -0.4
      ? `TERM · Backwardation ${sgn(i.termSlope)}: front IV over back — the market is paying up for near-dated protection. Event/stress premium in the front; fade it only after the catalyst.`
      : `TERM · Curve flat (${sgn(i.termSlope)}) — no timing edge between tenors.`);

  out.push(i.skew <= -1
    ? `SKEW · Put wing bid (${sgn(i.skew)}): hedging demand is elevated, put spreads finance well and jade-lizard style structures collect the skew.`
    : i.skew >= 1
      ? `SKEW · Call wing bid (${sgn(i.skew)}): upside chase in the options market — call premium is the rich side to sell.`
      : `SKEW · Wings balanced (${sgn(i.skew)}) — no structural edge in either wing.`);

  out.push(`PATH · Expansion ${s.expansionProb.toFixed(0)}% vs compression ${s.compressionProb.toFixed(0)}%. Expected move to expiry ±${i.emExpiry.toFixed(0)} pts (${i.emPct.toFixed(1)}%), ${(i.pInside1 * 100).toFixed(0)}% odds the underlying holds the 1σ band.`);

  return out;
}
