import type { DecisionInputs, DecisionOutput, Direction, Domain, DomainSignal } from './types';
import { clamp, round } from './types';
import { DOMAINS } from './domains';
import { classifyVolRegime, selectStrategy } from './strategy';

// Aggregate independent domain signals into a composite decision.
// No if/else classification of raw data — every output is a weighted fusion of
// the domains' normalised contributions.
export function runDecision(inputs: DecisionInputs, domains: Domain[] = DOMAINS): DecisionOutput {
  const signals: DomainSignal[] = domains.map((d) => ({
    key: d.key, label: d.label, weight: d.weight, ...d.run(inputs),
  }));

  const totalW = signals.reduce((s, x) => s + x.weight, 0) || 1;

  // ── Directional bias ──
  const directional = signals.reduce((s, x) => s + x.weight * x.bias, 0) / totalW; // -1..1
  const directionalScore = round(directional * 100);
  const direction: Direction =
    directional > 0.15 ? 'BULLISH' : directional < -0.15 ? 'BEARISH' : 'NEUTRAL';

  // ── Trend strength (0..100) ── trend-domain conviction + directional decisiveness
  const trendSig = signals.find((s) => s.key === 'trend');
  const trendStrength = round(clamp(
    100 * (0.5 * Math.abs(directional) + 0.5 * (trendSig?.strength ?? 0)), 0, 100,
  ));

  // ── Option-selling suitability (0..100) ── independent of direction
  const sellingW = signals.reduce((s, x) => s + (x.selling !== 0 ? x.weight : 0), 0) || 1;
  const sellingNet = signals.reduce((s, x) => s + x.weight * x.selling, 0) / sellingW; // -1..1
  const sellingSuitability = round(clamp((sellingNet + 1) * 50, 0, 100));

  // ── Volatility regime ──
  const volRegime = classifyVolRegime(inputs.vol.ivRank ?? 50, inputs.vol.vix);

  // ── Confidence ── domain agreement with the net direction + mean conviction
  const dir = Math.sign(directional) || 1;
  const agreeW = signals.reduce((s, x) => s + (x.bias !== 0 && Math.sign(x.bias) === dir ? x.weight : 0), 0);
  const dirW = signals.reduce((s, x) => s + (x.bias !== 0 ? x.weight : 0), 0) || 1;
  const agreement = agreeW / dirW; // 0..1
  const avgStrength = signals.reduce((s, x) => s + x.weight * x.strength, 0) / totalW;
  const confidence = round(clamp(35 + 40 * agreement + 25 * avgStrength, 0, 100));

  // ── Recommended strategy ──
  const strategy = selectStrategy({ direction, volRegime, sellingSuitability, trendStrength });

  // ── Top contributing factors (largest directional weight·bias) ──
  const factors = [...signals]
    .filter((s) => s.bias !== 0)
    .sort((a, b) => Math.abs(b.weight * b.bias) - Math.abs(a.weight * a.bias))
    .slice(0, 4)
    .map((s) => ({ label: s.label, bias: s.bias, weight: s.weight / totalW }));

  // ── Reasons ── narrative from the dominant domains + context
  const reasons = buildReasons(signals, direction, volRegime, sellingSuitability, inputs);

  return {
    direction, directionalScore, trendStrength, volRegime,
    sellingSuitability, confidence, strategy, signals, factors, reasons,
  };
}

function buildReasons(
  signals: DomainSignal[], direction: Direction, volRegime: string,
  selling: number, inputs: DecisionInputs,
): string[] {
  const out: string[] = [];
  // Two strongest directional drivers.
  const dirSorted = [...signals]
    .filter((s) => Math.abs(s.bias) > 0.1)
    .sort((a, b) => Math.abs(b.weight * b.bias) - Math.abs(a.weight * a.bias));
  for (const s of dirSorted.slice(0, 2)) out.push(s.detail);

  // Volatility / premium context.
  const vol = signals.find((s) => s.key === 'volatility');
  if (vol) out.push(`${volRegime} volatility regime — ${vol.detail}`);

  // Suitability statement.
  out.push(
    selling >= 60 ? `Option-selling suitability ${selling.toFixed(0)}/100 — premium-selling favoured.`
    : selling <= 40 ? `Option-selling suitability ${selling.toFixed(0)}/100 — prefer debit / long-vol structures.`
    : `Option-selling suitability ${selling.toFixed(0)}/100 — selective premium capture.`,
  );

  // Risk gate.
  const risk = signals.find((s) => s.key === 'risk');
  if (risk && risk.selling < 0) out.push(`Risk budget caution — ${risk.detail}`);

  // Probability context.
  if (inputs.vol.pInside1) out.push(`P(inside 1σ range) ${(inputs.vol.pInside1 * 100).toFixed(0)}% supports defined-risk sizing.`);

  return out.filter(Boolean);
}

export { DOMAINS } from './domains';
