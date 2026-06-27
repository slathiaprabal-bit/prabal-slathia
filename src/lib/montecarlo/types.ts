// ── Monte Carlo Probability Engine — type contract ───────────────────────
// Strategy-aware GBM path simulation for the recommended structure: terminal
// price distribution, P(profit), touch probabilities, P&L distribution and
// expected value. Distinct from the backend portfolio-bootstrap MC.

export interface MCInputs {
  spot: number;
  vix: number;       // annualised vol %
  dte: number;       // days to expiry
  lotSize: number;
  shortPut: number | null;
  shortCall: number | null;
  creditPerLot: number; // ₹
  maxLoss: number;      // ₹
  paths?: number;
  seed?: number;
}

export interface MCState {
  ok: boolean;
  paths: number;
  pProfit: number;       // %
  pMaxProfit: number;    // % terminal inside both shorts
  pTouchPut: number | null;   // % any path touches short put
  pTouchCall: number | null;  // % any path touches short call
  expectedPnl: number;   // ₹
  pnlP05: number; pnlP50: number; pnlP95: number;
  terminalP05: number; terminalP50: number; terminalP95: number;
  breakevens: [number | null, number | null];
  hist: { counts: number[]; edges: number[] }; // P&L (₹)
  cone: { up1: number; dn1: number; up2: number; dn2: number }; // price σ bands
  reasoning: string[];
}
