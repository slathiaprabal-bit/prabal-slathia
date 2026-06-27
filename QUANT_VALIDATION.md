# VOLARA — Quantitative Validation & Assumptions

Phase 4 reference. Every engine is audited against accepted financial
mathematics; assumptions, limitations and the validation method are documented
here. The `lib/validation` module implements the checks; the Research Dashboard
surfaces the live results.

> Notation: `S` spot, `K` strike, `σ` vol (decimal), `T` time to expiry (yr),
> `r` risk-free, `N()` standard-normal CDF, `n()` pdf.

---

## 1. Greeks Engine (`lib/greeks`)

**Model.** Black–Scholes–Merton, European options.
`d1 = [ln(S/K) + (r + σ²/2)T] / (σ√T)`, `d2 = d1 − σ√T`.
Δ_call = N(d1); Γ = n(d1)/(Sσ√T); ν = S·n(d1)·√T /100 (per 1 vol-pt);
Θ per day; Vanna = −n(d1)·d2/σ /100; Charm per day.

**Assumptions.** GBM underlying; constant σ over `[0,T]`; constant `r`; no
dividends; continuous trading; European exercise; frictionless.

**Known limitations.** NIFTY options are European (✓) but IV is *not* constant
across strikes (skew) — we feed per-strike IV from the chain, which mitigates
the constant-σ assumption locally. Discrete dividends ignored (index — minor).

**Validation.** (a) Analytical vs **finite-difference** Greeks — bump `S`, `σ`,
`T`, reprice, derive Δ/Γ/ν/Θ numerically; report max relative error. (b)
**Put–call parity**: `C − P = S − K·e^{−rT}`. (c) Δ bounds `[−1,1]`, Γ ≥ 0.
Target: FD error < 1% for ATM, < 3% wings.

---

## 2. Monte Carlo Probability Engine (`lib/montecarlo`)

**Model.** Risk-neutral GBM terminal price:
`S_T = S·exp((−σ²/2)·T + σ√T·Z)`, `Z ~ N(0,1)`; `M` steps for barrier touch.
Drift set to `−σ²/2` per step (zero risk-neutral drift, ex-rate) — conservative
for short-dated index structures.

**Assumptions.** GBM (log-normal terminal); constant σ = ATM IV; independent
increments; payoff approximated from the structure's short strikes, credit and
defined max-loss (wing widths inferred from max-loss).

**Known limitations.** Real returns are fat-tailed and skewed; GBM understates
tail probabilities. Zero-drift is a simplification. Touch probability uses
discrete steps (slight under-count vs continuous barrier).

**Validation.** (a) MC P(S_T > K) vs **analytical** `N(d2)` (risk-neutral ITM
prob). (b) MC expected move vs analytical `S·σ·√T`. (c) **Binomial CI**:
P(profit) standard error `√(p(1−p)/N)`, 95% Wilson interval. (d) Convergence:
error ∝ `1/√N`. Target: |MC − analytical| within 2× standard error.

---

## 3. Hidden Markov Regime Detection (`lib/hmm`)

**Model.** 3-state Gaussian HMM on features `[daily return, realized vol]`,
diagonal covariance, fit by Baum–Welch (EM, log-space forward–backward).

**Assumptions.** First-order Markov latent state; Gaussian emissions;
diagonal covariance (feature independence given state); stationary transition
matrix `A`; states identifiable up to permutation (labelled post-hoc by
vol/return).

**Known limitations.** Returns are non-Gaussian; EM finds a local optimum
(init-dependent); 3 states is a modelling choice; small samples (T<60) are
unstable. Label switching handled by deterministic vol-rank ordering.

**Validation.** (a) **Log-likelihood** monotonic non-decreasing across EM
iters (correctness of the EM implementation). (b) **Posterior entropy** of the
current state (lower = more confident). (c) Transition-matrix rows sum to 1.
(d) **Regime persistence** vs realized: expected duration `1/(1−A_ii)` vs
empirical run-lengths. (e) Calibration of regime → next-day return sign.

---

## 4. Dealer Positioning (`lib/dealer`)

**Model.** GEX(K) = `S²·0.01·lot·(Γ_call·OI_call − Γ_put·OI_put)` (dealers long
calls / short puts). Net GEX = Σ; gamma-flip = cumulative-zero crossing;
max-pain = strike minimising total option-holder payout.

**Assumptions.** Dealer-positioning convention (call-long/put-short) — an
industry default; per-strike Γ from BS; OI as a positioning proxy.

**Known limitations.** True dealer inventory is unobservable; the long-call/
short-put convention is a heuristic (SpotGamma-style). With a synthetic chain
the magnitudes are illustrative; the **structure** (sign, flip, walls) is the
signal.

**Validation.** (a) Max-pain re-derivation cross-check vs the backend
positioning. (b) GEX sign consistency at the wings. (c) Walls = argmax OI by
side. (d) Σ Γ_call·OI vs put side (parity sanity).

---

## 5. Strategy Ranking (`lib/ranking`) & Decision Engine (`lib/decision`)

**Model.** Heuristic multi-factor scoring — not a probabilistic model. The
Decision Engine fuses 7 normalised domain signals (weighted mean → bias /
suitability); the ranking scores a structure catalog by fit.

**Assumptions.** Weights are expert priors; domain signals are bounded
`[−1,1]`; linear additive fusion.

**Validation.** (a) **Internal consistency**: ranking's top pick agrees with
the Decision Engine recommendation. (b) **Out-of-sample hit ratio**: backtest
the directional call vs realized next-day return → accuracy, confusion matrix.
(c) Rank stability under small input perturbations.

---

## 6. Volatility (`lib/vol`), Macro (`lib/macro`), Risk (`lib/risk`)

- **Vol**: weighted composite score; regime thresholds; expansion/compression
  via mean-reversion + momentum. Validated by IVR/percentile monotonicity and
  regime-threshold sanity.
- **Macro**: weighted risk-on/off; official figures static, market layer
  modelled (tagged). Validated by indicator sign/threshold checks.
- **Risk**: **parametric 1-day VaR** from Δ/Γ/ν 1σ shocks (Gaussian). Limitation:
  no fat tails / historical VaR. Validated vs the Monte-Carlo P&L distribution
  (parametric VaR95 vs empirical 5th percentile).

---

## 7. Standardized ML outputs

Every engine exposes a flat numeric **feature vector** (`lib/research`) — no
nested objects, stable keys — so a future ML pipeline can consume snapshots +
engine outputs + recommendations + realized outcomes without touching the
engines. Schema in `sql/research_schema.sql`.

---

## 8. Error-metric glossary

| Metric | Use |
|---|---|
| Max relative error | Greeks FD vs analytical |
| Standard error `√(p(1−p)/N)` | MC proportion |
| Wilson 95% CI | MC P(profit) |
| Brier score | Probability calibration |
| Log-likelihood | HMM EM correctness |
| Posterior entropy | HMM confidence |
| Hit ratio / accuracy | Directional calls |
| Confusion matrix | Regime / direction classification |
| Sharpe / Calmar / max-DD | Realized performance |
| PSI (population stability) | Model drift |
