// Deterministic Trading Impact engine (NO LLM). Pure rules mapping an event
// (type, importance, expected vol, proximity, lifecycle) to:
//   • Trading Impact Ratings (IV Expansion / Crush / Gamma / Gap / Trend / MeanRev)
//   • a single risk score 0..100
//   • a Recommended Action
//   • a one-line rationale
import type {
  RawEvent, TradingImpact, ImpactRating, RecommendedAction, IVDirection, RiskLevel,
} from './types';

const IMP_WEIGHT: Record<string, number> = { LOW: 15, MEDIUM: 35, HIGH: 65, CRITICAL: 95 };

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const clamp01 = (v: number) => clamp(v, 0, 1);

export function computeImpact(e: RawEvent, hoursUntil: number | null): TradingImpact {
  const w = IMP_WEIGHT[e.importance] ?? 30;
  const mag = clamp01(e.vol_magnitude ?? 0);
  const isExpiry = e.category === 'MARKET_STRUCTURE';
  const passed = e.status === 'COMPLETED';
  const live = e.status === 'LIVE';
  const near = hoursUntil != null && hoursUntil <= 24;     // overnight / next-session
  const soon = hoursUntil != null && hoursUntil <= 72;     // this week-ish

  const ratings: ImpactRating[] = [];
  let iv: IVDirection = 'NEUTRAL';

  if (passed) {
    // After a scheduled vol event the bid usually collapses.
    if (e.expected_vol === 'EXPANSION') { ratings.push('Expected IV Crush'); iv = 'CRUSH'; }
  } else if (isExpiry) {
    // Expiry: theta + ATM gamma/pin dynamics into the close.
    ratings.push('Expected Gamma Risk', 'Expected IV Crush', 'Expected Mean Reversion');
    iv = 'CRUSH';
  } else if (e.expected_vol === 'EXPANSION') {
    ratings.push('Expected IV Expansion');
    iv = 'EXPANSION';
    if (near) ratings.push('Expected Gap Risk');
    if (w >= 65) ratings.push('Expected Trend Continuation');
  } else if (e.expected_vol === 'CONTRACTION') {
    ratings.push('Expected IV Crush');
    iv = 'CRUSH';
  }
  if (ratings.length === 0) {
    ratings.push(e.expected_vol === 'CONTRACTION' ? 'Expected IV Crush' : 'Expected IV Expansion');
    iv = e.expected_vol === 'CONTRACTION' ? 'CRUSH' : 'EXPANSION';
  }

  // Risk score: importance × magnitude, escalated by proximity, decayed if past.
  let riskScore = w * (0.55 + 0.45 * mag);
  if (!passed && near) riskScore *= 1.15;
  else if (!passed && soon) riskScore *= 1.05;
  if (passed) riskScore *= 0.4;
  riskScore = clamp(Math.round(riskScore), 0, 100);

  const riskLevel: RiskLevel =
    riskScore >= 80 ? 'EXTREME' : riskScore >= 55 ? 'HIGH' : riskScore >= 30 ? 'MODERATE' : 'LOW';

  const action = recommend(riskLevel, hoursUntil, isExpiry, passed, live);
  const note = rationale(e, iv, riskLevel, isExpiry, passed, near);

  return { ratings, ivDirection: iv, riskLevel, riskScore, action, note };
}

function recommend(level: RiskLevel, hoursUntil: number | null, isExpiry: boolean,
                   passed: boolean, live: boolean): RecommendedAction {
  if (passed) return 'Normal Trading Conditions';
  if (live) return 'Wait Until Event Passes';
  const near = hoursUntil != null && hoursUntil <= 24;
  const soon = hoursUntil != null && hoursUntil <= 72;
  if (level === 'EXTREME') return near ? 'Avoid New Trades' : 'High Volatility Expected';
  if (level === 'HIGH') return near ? 'Avoid Overnight Positions' : 'Reduce Position Size';
  if (isExpiry && near) return 'Reduce Position Size';
  if (level === 'MODERATE') return soon ? 'Reduce Position Size' : 'Normal Trading Conditions';
  return 'Safe to Sell Premium';
}

function rationale(e: RawEvent, iv: IVDirection, level: RiskLevel, isExpiry: boolean,
                   passed: boolean, near: boolean): string {
  if (passed) return `${e.name} has cleared — post-event IV crush; conditions normalising.`;
  if (isExpiry) return 'Expiry session — accelerated theta but ATM gamma/pin risk; avoid naked ATM shorts into the close.';
  if (iv === 'EXPANSION') {
    const lead = near ? 'Imminent — ' : '';
    if (level === 'EXTREME') return `${lead}top-tier vol event; pre-event IV bid building. Avoid fresh short premium; expect a sharp crush after.`;
    if (level === 'HIGH') return `${lead}elevated event risk; IV expanding into the print. Trim size and avoid carrying naked shorts overnight.`;
    return `${lead}moderate event risk; some IV expansion likely into the release.`;
  }
  return `${e.name} — limited expected volatility; benign for premium-selling structures.`;
}
