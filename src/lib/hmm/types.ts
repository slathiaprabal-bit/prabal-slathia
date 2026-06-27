// ── Hidden Markov Regime Detection — type contract ───────────────────────
// A Gaussian HMM fit (Baum-Welch) over [daily return, realized vol] features.
// Exposes the current latent regime, state posteriors, transition dynamics and
// expected duration. Pure, network-independent, fully testable.

export type HmmLabel = 'BULL' | 'BEAR' | 'RANGE' | 'HIGH_VOL';

export interface HmmInputs {
  returns: number[]; // daily returns (%)
  volWindow?: number; // realized-vol window (default 5)
}

export interface HmmStateInfo {
  index: number;
  label: HmmLabel;
  prob: number;        // current posterior probability (0..1)
  meanReturn: number;  // emission mean (return %)
  meanVol: number;     // emission mean (realized vol %)
  expectedDuration: number; // 1 / (1 - self-transition), days
  toCurrentNext: number;    // P(stay) for the current state row
}

export interface HmmState {
  ok: boolean;
  label: HmmLabel;        // most-likely current regime
  confidence: number;     // 0..100 (max posterior)
  states: HmmStateInfo[]; // sorted by current probability
  expectedDuration: number; // for the current regime (days)
  transitionRisk: number; // 0..100 probability of switching next step
  nextRegime: HmmLabel | null; // most-likely regime to transition into
  iterations: number;
  reasoning: string[];
}
