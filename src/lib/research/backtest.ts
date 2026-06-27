// Research-validation backtest: evaluates the directional methodology (a
// momentum/trend signal mirroring the Decision Engine's trend premise) over the
// real return history → accuracy, confusion matrix, probability calibration,
// rolling risk-adjusted performance and model drift. Pure & testable.

export interface CalibrationBin { bucket: number; predicted: number; realized: number; n: number }

export interface ResearchBacktest {
  ok: boolean;
  samples: number;
  accuracy: number;     // hit ratio (0..1)
  precision: number; recall: number; f1: number;
  confusion: { tp: number; fp: number; tn: number; fn: number };
  brier: number;
  calibration: CalibrationBin[];
  equity: number[];     // strategy equity curve (base 100)
  sharpe: number; maxDD: number; calmar: number; totalReturn: number;
  drift: { firstHalfAcc: number; secondHalfAcc: number; psi: number };
  reasoning: string[];
}

const logistic = (x: number) => 1 / (1 + Math.exp(-x));
const mean = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);
const std = (xs: number[]) => { const m = mean(xs); return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)) || 0); };

export function runResearchBacktest(returns: number[], window = 10): ResearchBacktest {
  const r = returns.filter((x) => isFinite(x));
  const N = r.length;
  if (N < window + 30) return notOk();

  const sd = std(r) || 1;
  const predProb: number[] = []; // P(up) predicted at each evaluated day
  const predUp: boolean[] = [];
  const actUp: boolean[] = [];
  const actRet: number[] = [];

  for (let i = window; i < N; i++) {
    const m = mean(r.slice(i - window, i)); // momentum from info up to i-1
    const prob = logistic((m / sd) * 1.6);
    predProb.push(prob);
    predUp.push(m >= 0);
    actUp.push(r[i] >= 0);
    actRet.push(r[i]);
  }

  const n = predUp.length;
  let tp = 0, fp = 0, tn = 0, fn = 0;
  for (let i = 0; i < n; i++) {
    if (predUp[i] && actUp[i]) tp++;
    else if (predUp[i] && !actUp[i]) fp++;
    else if (!predUp[i] && !actUp[i]) tn++;
    else fn++;
  }
  const accuracy = (tp + tn) / n;
  const precision = tp + fp ? tp / (tp + fp) : 0;
  const recall = tp + fn ? tp / (tp + fn) : 0;
  const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;

  // Brier + calibration (5 buckets).
  const brier = mean(predProb.map((p, i) => (p - (actUp[i] ? 1 : 0)) ** 2));
  const B = 5;
  const calibration: CalibrationBin[] = [];
  for (let b = 0; b < B; b++) {
    const lo = b / B, hi = (b + 1) / B;
    const idx = predProb.map((p, i) => ({ p, i })).filter(({ p }) => p >= lo && (b === B - 1 ? p <= hi : p < hi));
    if (idx.length) calibration.push({ bucket: (lo + hi) / 2, predicted: mean(idx.map((x) => x.p)), realized: mean(idx.map((x) => (actUp[x.i] ? 1 : 0))), n: idx.length });
  }

  // Strategy equity: long if predicted up, short otherwise.
  const pnl = predUp.map((up, i) => (up ? actRet[i] : -actRet[i]));
  const equity: number[] = [100];
  for (const x of pnl) equity.push(equity[equity.length - 1] + x);
  let peak = equity[0], maxDD = 0;
  for (const e of equity) { peak = Math.max(peak, e); maxDD = Math.max(maxDD, (peak - e) / peak); }
  const sharpe = std(pnl) > 0 ? (mean(pnl) / std(pnl)) * Math.sqrt(252) : 0;
  const totalReturn = equity[equity.length - 1] - 100;
  const annReturn = totalReturn * (252 / n);
  const calmar = maxDD > 0 ? annReturn / (maxDD * 100) : 0;

  // Model drift: accuracy stability + PSI of the signal distribution.
  const half = Math.floor(n / 2);
  const acc = (a: boolean[], p: boolean[]) => { let c = 0; for (let i = 0; i < a.length; i++) if (a[i] === p[i]) c++; return a.length ? c / a.length : 0; };
  const firstHalfAcc = acc(actUp.slice(0, half), predUp.slice(0, half));
  const secondHalfAcc = acc(actUp.slice(half), predUp.slice(half));
  const psi = computePsi(predProb.slice(0, half), predProb.slice(half));

  return {
    ok: true, samples: n,
    accuracy: round(accuracy), precision: round(precision), recall: round(recall), f1: round(f1),
    confusion: { tp, fp, tn, fn }, brier: round4(brier), calibration,
    equity, sharpe: round(sharpe), maxDD: round(maxDD), calmar: round(calmar), totalReturn: round(totalReturn),
    drift: { firstHalfAcc: round(firstHalfAcc), secondHalfAcc: round(secondHalfAcc), psi: round4(psi) },
    reasoning: [
      `Directional hit ratio ${(accuracy * 100).toFixed(0)}% over ${n} sessions (F1 ${f1.toFixed(2)}, Brier ${brier.toFixed(3)}).`,
      `Strategy Sharpe ${sharpe.toFixed(2)}, max-DD ${(maxDD * 100).toFixed(1)}%, Calmar ${calmar.toFixed(2)}.`,
      psi < 0.1 ? 'Signal stable — no material drift between halves.' : psi < 0.25 ? 'Minor signal drift detected.' : 'Significant signal drift — model may need recalibration.',
    ],
  };
}

function computePsi(a: number[], b: number[], bins = 5): number {
  const hist = (xs: number[]) => { const h = new Array(bins).fill(0); for (const x of xs) h[Math.min(bins - 1, Math.floor(x * bins))]++; return h.map((c) => (c + 1e-6) / (xs.length + 1e-6)); };
  const ha = hist(a), hb = hist(b);
  let psi = 0;
  for (let i = 0; i < bins; i++) psi += (ha[i] - hb[i]) * Math.log(ha[i] / hb[i]);
  return Math.abs(psi);
}

function notOk(): ResearchBacktest {
  return { ok: false, samples: 0, accuracy: 0, precision: 0, recall: 0, f1: 0, confusion: { tp: 0, fp: 0, tn: 0, fn: 0 }, brier: 0, calibration: [], equity: [], sharpe: 0, maxDD: 0, calmar: 0, totalReturn: 0, drift: { firstHalfAcc: 0, secondHalfAcc: 0, psi: 0 }, reasoning: ['Insufficient history for research backtest.'] };
}

const round = (v: number) => Math.round(v * 1000) / 1000;
const round4 = (v: number) => Math.round(v * 10000) / 10000;
