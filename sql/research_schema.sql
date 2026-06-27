-- VOLARA — Historical Research Database (Phase 4)
-- Stores daily market snapshots, standardized engine outputs, recommendations,
-- validation logs and realized outcomes for future ML training.
-- Portable SQLite/Postgres DDL. The frontend recorder (lib/research) emits rows
-- matching these tables; export → load here for offline model training.

PRAGMA foreign_keys = ON;

-- ── One row per captured market frame ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS market_snapshots (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  ts             TEXT NOT NULL,            -- ISO8601 capture time
  trading_date   TEXT NOT NULL,            -- YYYY-MM-DD
  source         TEXT,                     -- live | cache | synthetic
  chain_synth    INTEGER,                  -- 1 = synthetic chain
  spot           REAL, vix REAL, iv_rank REAL, iv_pctile REAL, hv20 REAL, vrp REAL,
  em_expiry      REAL, p_inside1 REAL, pcr REAL, max_pain REAL,
  regime_state   TEXT, regime_confidence REAL
);
CREATE INDEX IF NOT EXISTS idx_snap_date ON market_snapshots(trading_date);

-- ── Standardized, flat engine feature vector (one row per snapshot) ────────
CREATE TABLE IF NOT EXISTS engine_outputs (
  snapshot_id    INTEGER PRIMARY KEY REFERENCES market_snapshots(id),
  -- macro
  macro_score REAL, macro_confidence REAL,
  -- volatility
  vol_score REAL, vol_regime TEXT, vol_premium TEXT, vol_vega_bias TEXT,
  vol_expansion REAL, vol_compression REAL, vol_atm_iv REAL, vol_skew REAL, vol_term_slope REAL,
  -- decision
  dec_direction TEXT, dec_directional_score REAL, dec_trend_strength REAL,
  dec_selling_suitability REAL, dec_confidence REAL,
  -- risk
  risk_beta REAL, risk_var95 REAL, risk_var_pct REAL, risk_heat REAL, risk_margin REAL,
  -- dealer positioning
  dealer_net_gex REAL, dealer_gamma_flip REAL, dealer_max_pain REAL, dealer_regime TEXT,
  -- hmm regime
  hmm_regime TEXT, hmm_confidence REAL, hmm_transition_risk REAL,
  -- monte carlo
  mc_p_profit REAL, mc_expected_pnl REAL
);

-- ── The recommendation issued at the snapshot ─────────────────────────────
CREATE TABLE IF NOT EXISTS recommendations (
  snapshot_id    INTEGER PRIMARY KEY REFERENCES market_snapshots(id),
  ts             TEXT,
  strategy       TEXT, family TEXT, direction TEXT, confidence REAL,
  short_put      REAL, short_call REAL, credit_per_lot REAL, max_loss REAL,
  rank_top       TEXT, rank_score REAL
);

-- ── Validation pass-rate + key error metrics per snapshot ─────────────────
CREATE TABLE IF NOT EXISTS validation_log (
  snapshot_id    INTEGER PRIMARY KEY REFERENCES market_snapshots(id),
  ts             TEXT, pass_rate REAL,
  greeks_delta_err REAL, mc_em_err REAL, hmm_entropy REAL
);

-- ── Realized forward outcomes (ML labels — filled t+N) ────────────────────
CREATE TABLE IF NOT EXISTS realized_outcomes (
  snapshot_id      INTEGER REFERENCES market_snapshots(id),
  horizon_days     INTEGER,
  realized_return_pct REAL,           -- forward index return
  realized_direction  TEXT,           -- UP | DOWN | FLAT
  direction_correct   INTEGER,        -- 1/0 decision direction matched
  regime_correct      INTEGER,        -- 1/0 HMM regime matched realized vol state
  trade_pnl           REAL,           -- if the recommended trade were taken
  trade_outcome       TEXT,           -- WIN | LOSS | OPEN
  PRIMARY KEY (snapshot_id, horizon_days)
);
