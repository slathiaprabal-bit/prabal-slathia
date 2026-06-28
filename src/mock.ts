// Self-contained snapshot generator so the terminal is always "alive" even
// without the FastAPI backend running. Mirrors the real Snapshot shape and
// morphs over time. When the WebSocket connects, real data takes over.

import type { Snapshot, RegimeState, ChainRow, StrategyRanking } from './types';

const STRIKES = 41;
const EXPIRIES = [2, 5, 9, 14, 21, 30, 45];
const SPOT0 = 24850;

const REGIMES: RegimeState[] = [
  'NORMAL',
  'TRENDING_UP',
  'VOLATILE',
  'TRENDING_DOWN',
  'EVENT_RISK',
  'NO_GO',
];

function buildSurface(t: number, baseIv: number, ivr: number) {
  const spot = SPOT0;
  const strikes = Array.from(
    { length: STRIKES },
    (_, i) => Math.round((spot * (0.88 + (0.24 * i) / (STRIKES - 1))) / 50) * 50,
  );
  const iv: number[][] = [];
  for (let j = 0; j < EXPIRIES.length; j++) {
    const dte = EXPIRIES[j];
    const row: number[] = [];
    const termMult = 1 + 0.18 * (ivr - 0.5) * (Math.sqrt(7 / dte) - 1);
    for (let i = 0; i < STRIKES; i++) {
      const m = strikes[i] / spot - 1;
      const skew = -55 * m + 190 * m * m;
      const wobble = Math.sin(t * 0.6 + i * 0.4 + j) * (0.4 + ivr * 1.2);
      row.push(Math.max(6, (baseIv + skew) * termMult + wobble));
    }
    iv.push(row);
  }
  return { strikes, expiries: EXPIRIES, iv, live: false };
}

function buildChain(spot: number, vix: number): ChainRow[] {
  const rows: ChainRow[] = [];
  const atm = Math.round(spot / 50) * 50;
  const em = spot * (vix / 100) * Math.sqrt(7 / 365);
  for (let k = atm - 15 * 50; k <= atm + 15 * 50; k += 50) {
    const ce = 1e5 * Math.exp(-((k - (spot + em)) ** 2) / (2 * (em * 0.9) ** 2));
    const pe = 1e5 * Math.exp(-((k - (spot - em)) ** 2) / (2 * (em * 0.9) ** 2));
    rows.push({
      strike: k,
      ceOI: ce * (0.8 + Math.random() * 0.4),
      peOI: pe * (0.8 + Math.random() * 0.4),
      ceIV: vix + (k - spot) / spot * -20,
      peIV: vix + (k - spot) / spot * 20,
    });
  }
  return rows;
}

let tick = 0;

export function mockSnapshot(): Snapshot {
  tick += 1;
  const t = tick / 8;
  const regime = REGIMES[Math.floor(tick / 24) % REGIMES.length];
  const volBias =
    regime === 'VOLATILE' || regime === 'NO_GO' || regime === 'EVENT_RISK';
  const vix = (volBias ? 22 : 12.5) + Math.sin(t * 0.5) * 1.6 + Math.random() * 0.4;
  const ivr = Math.max(0, Math.min(1, (vix - 9) / 22));
  const spot = SPOT0 + Math.sin(t * 0.3) * 120 + (regime === 'TRENDING_UP' ? tick * 0.4 : 0);
  const surface = buildSurface(t, vix, ivr);
  const atmI = Math.floor(STRIKES / 2);
  const trade = regime !== 'NO_GO' && regime !== 'EVENT_RISK';
  const credit = 1450 + Math.sin(t) * 120;

  return {
    ts: new Date().toISOString(),
    source: 'mock',
    spot: Math.round(spot * 10) / 10,
    regime: {
      state: regime,
      engineRegime: regime,
      confidence: Math.round(55 + Math.sin(t * 0.4) * 18 + (volBias ? -8 : 8)),
      direction: regime === 'TRENDING_UP' ? 'UP' : regime === 'TRENDING_DOWN' ? 'DOWN' : 'FLAT',
      vix,
      vixChg: Math.sin(t * 0.7) * 6,
      trendAtr: Math.sin(t * 0.5) * 2.2,
      note:
        regime === 'NO_GO'
          ? 'Crash regime — protect capital.'
          : 'Best premium-selling regime: rich IV, mean-reverting range.',
      trade,
    },
    vol: {
      vix,
      ivRank: Math.round(ivr * 100),
      ivPctile: Math.round(ivr * 100 * 0.9),
      hv20: vix - 2.4,
      vrp: 2.4 + Math.sin(t) * 0.8,
      em1d: spot * (vix / 100) * Math.sqrt(1 / 365),
      emExpiry: spot * (vix / 100) * Math.sqrt(7 / 365),
      sigma1: [spot * 0.985, spot * 1.015],
      sigma2: [spot * 0.97, spot * 1.03],
      pInside1: 0.68 + Math.sin(t * 0.3) * 0.04,
    },
    surface,
    smile: { strikes: surface.strikes, iv: surface.iv[0] },
    term: { dte: EXPIRIES, iv: surface.iv.map((r) => r[atmI]) },
    greeks: {
      delta: Math.sin(t * 0.4) * 6,
      gamma: -0.008 + Math.sin(t) * 0.002,
      theta: 210 + Math.sin(t * 0.6) * 40,
      vega: -205 + Math.cos(t * 0.5) * 35,
      charm: -0.12 + Math.sin(t) * 0.03,
      vanna: 0.14 + Math.cos(t) * 0.04,
      vomma: 5.2 + Math.sin(t * 0.8) * 1.5,
      speed: Math.sin(t * 0.9) * 0.002,
    },
    chain: buildChain(spot, vix),
    chainSynthetic: true,
    positioning: {
      maxPain: Math.round((spot + Math.sin(t * 0.2) * 80) / 50) * 50,
      pcr: 0.95 + Math.sin(t * 0.3) * 0.18,
      support: [spot - 250, spot - 150, spot - 350].map((x) => Math.round(x / 50) * 50),
      resistance: [spot + 200, spot + 350, spot + 450].map((x) => Math.round(x / 50) * 50),
      gex: 9 + Math.sin(t) * 4,
      gammaFlip: Math.round((spot + 100) / 50) * 50,
      synthetic: true,
    },
    risk: {
      equity: 1_000_000,
      capitalAtRisk: 13500 + Math.sin(t) * 1500,
      portfolioHeat: 0.0135 + Math.sin(t) * 0.002,
      marginUsed: 220000,
      marginUsage: 0.22,
      lots: trade ? 1 : 0,
      kellyLots: 2,
      kellyPct: 0.18 + Math.sin(t * 0.5) * 0.05,
      probRuin: volBias ? 0.04 : 0.0,
      expectedDrawdown: 0.074 + (volBias ? 0.03 : 0),
      medianMaxDD: 0.071,
      worstMaxDD: 0.31,
    },
    montecarlo: mockMC(volBias),
    strategies: mockStrategies(regime, Math.round(ivr * 100), volBias),
    trade: {
      decision: trade ? 'TRADE' : 'NO_TRADE',
      confidence: Math.round(trade ? 62 + Math.sin(t) * 12 : 30),
      edgeScore: Math.round(trade ? 68 + Math.sin(t * 0.7) * 10 : 22),
      premiumRichness: Math.round(ivr * 100),
      structure: trade ? 'IRON_CONDOR' : 'NO_TRADE',
      expectedReturn: trade ? Math.round(credit) : 0,
      maxLoss: trade ? 13500 : 0,
      tailRisk: volBias ? 6.2 : 1.1,
      shortPut: Math.round((spot - 400) / 50) * 50,
      shortCall: Math.round((spot + 400) / 50) * 50,
      takeProfit: Math.round(credit * 0.5),
      stopLoss: Math.round(credit * 2),
      creditPerLot: Math.round(credit),
      reasons: trade
        ? [
            'Rich IV, mean-reverting range',
            `IV-rank ${Math.round(ivr * 100)}, VRP +2.4`,
            'P(in 1σ range) 68%',
          ]
        : [],
      rejectReasons: trade ? [] : ['Vol expanding — short gamma dangerous. Stand aside.'],
    },
    secondary: {
      banknifty: { value: 54257.35 + Math.sin(t * 0.4) * 120, chg: -0.51 + Math.sin(t * 0.3) * 0.25 },
      sensex: { value: 79302.11 + Math.sin(t * 0.3) * 180, chg: -0.37 + Math.sin(t * 0.25) * 0.2 },
      finnifty: { value: 24103.2 + Math.sin(t * 0.5) * 60, chg: -0.28 + Math.sin(t * 0.35) * 0.22 },
    },
  };
}

function mockStrategies(regime: RegimeState, ivr: number, volBias: boolean): StrategyRanking {
  const isSell = ivr > 50;
  const s1 = {
    code: isSell ? 'WEEKLY_IC' : 'LONG_STRADDLE',
    name: isSell ? 'Weekly Iron Condor' : 'Long Straddle',
    category: isSell ? 'theta' : 'volatility',
    score: Math.round(68 + Math.sin(tick * 0.4) * 8),
    confidence: Math.round(62 + Math.sin(tick * 0.3) * 10),
    ev: Math.round((isSell ? 1420 : -280) + Math.sin(tick * 0.5) * 180),
    pop: Math.round(isSell ? 72 + Math.sin(tick * 0.3) * 4 : 44 + Math.sin(tick * 0.3) * 6),
    maxGain: Math.round((isSell ? 1850 : 4200) + Math.sin(tick) * 200),
    maxLoss: Math.round((isSell ? 11200 : 1850) + Math.sin(tick * 0.6) * 400),
    rrRatio: isSell ? 0.17 : 2.27,
    risk: (isSell ? 'MEDIUM' : 'MEDIUM') as any,
    directional: 'neutral' as any,
    reasoning: isSell
      ? [`IV Rank ${ivr} — elevated premium, ideal for credit structures`,
         `${regime.replace('_',' ')} regime aligns with trade mechanics`,
         `VRP +2.4 — implied vol significantly overpriced vs realized`,
         `P(inside 1σ) 71% — strong probability range support`]
      : [`IV Rank ${ivr} — cheap vol, long vega positions rewarded`,
         `${regime.replace('_',' ')} regime strongly favours volatility expansion`,
         `VRP -1.8 — realized vol running above IV, long gamma rewarded`],
    ranked: 1,
  };
  const s2 = {
    code: isSell ? 'NIFTY_7DTE_IC' : 'LONG_STRANGLE',
    name: isSell ? 'NIFTY 7-Day Iron Condor' : 'Long Strangle',
    category: isSell ? 'nifty' : 'volatility',
    score: Math.round(61 + Math.sin(tick * 0.5) * 7),
    confidence: Math.round(57 + Math.sin(tick * 0.4) * 8),
    ev: Math.round((isSell ? 980 : -120) + Math.sin(tick * 0.6) * 140),
    pop: Math.round(isSell ? 70 + Math.sin(tick * 0.4) * 5 : 42 + Math.sin(tick * 0.4) * 5),
    maxGain: Math.round((isSell ? 1600 : 6500) + Math.sin(tick) * 300),
    maxLoss: Math.round((isSell ? 8800 : 1200) + Math.sin(tick * 0.7) * 300),
    rrRatio: isSell ? 0.18 : 5.42,
    risk: 'MEDIUM' as any,
    directional: 'neutral' as any,
    reasoning: isSell
      ? [`IV Rank ${ivr} — premium environment supports short vol`,
         `NIFTY weekly expiry creates optimal 7-DTE theta decay curve`,
         `P(inside 1σ) 68% — probability supports short gamma`]
      : [`IV Rank ${ivr} — vol compressed, long premium has edge`,
         `Long strangle offers wider break-even vs straddle in ${regime.replace('_', ' ')}`,
         `Lower debit cost preserves capital if vol crush occurs`],
    ranked: 2,
  };
  const s3 = {
    code: isSell ? 'IRON_FLY' : 'CALL_BACKSPREAD',
    name: isSell ? 'Iron Butterfly' : 'Call Backspread 2:1',
    category: isSell ? 'theta' : 'directional',
    score: Math.round(54 + Math.sin(tick * 0.6) * 7),
    confidence: Math.round(51 + Math.sin(tick * 0.5) * 9),
    ev: Math.round((isSell ? 1950 : 380) + Math.sin(tick * 0.7) * 200),
    pop: Math.round(isSell ? 58 + Math.sin(tick * 0.5) * 4 : 38 + Math.sin(tick * 0.5) * 5),
    maxGain: Math.round((isSell ? 2800 : 9200) + Math.sin(tick) * 400),
    maxLoss: Math.round((isSell ? 3200 : 600) + Math.sin(tick * 0.8) * 200),
    rrRatio: isSell ? 0.88 : 15.3,
    risk: (isSell ? 'MEDIUM' : 'MEDIUM') as any,
    directional: (isSell ? 'neutral' : 'bull') as any,
    reasoning: isSell
      ? [`Iron Butterfly maximises ATM theta capture in high-IV environment`,
         `Higher credit vs Iron Condor — IV Rank ${ivr} justifies tighter strikes`,
         `VRP supports premium selling; max gain if spot pins at expiry`]
      : [`Call Backspread benefits from explosive upside in ${regime.replace('_', ' ')}`,
         `2:1 ratio captures unlimited upside while hedging initial cost`,
         `Low IV means backspread debit is minimal vs potential gamma gains`],
    ranked: 3,
  };

  return {
    top3: [s1, s2, s3],
    totalScored: 54,
    marketCondition: isSell
      ? `HIGH IV RANK (${ivr}) — premium-selling favoured · ${regime.replace('_', ' ')} regime · VIX ${(12 + ivr * 0.12).toFixed(1)}`
      : `LOW IV RANK (${ivr}) — long volatility has edge · ${regime.replace('_', ' ')} regime · VIX ${(8 + ivr * 0.1).toFixed(1)}`,
    allScores: {},
  };
}

function mockMC(volBias: boolean) {
  const counts: number[] = [];
  const edges: number[] = [];
  const mu = volBias ? -1.5 : 2.4;
  for (let i = 0; i <= 32; i++) edges.push(-18 + i * (36 / 32));
  for (let i = 0; i < 32; i++) {
    const x = (edges[i] + edges[i + 1]) / 2;
    counts.push(Math.round(900 * Math.exp(-((x - mu) ** 2) / (2 * 6 ** 2))));
  }
  const n = 51;
  const p05: number[] = [];
  const p50: number[] = [];
  const p95: number[] = [];
  const paths: number[][] = [];
  for (let p = 0; p < 24; p++) {
    const path: number[] = [];
    let eq = 1_000_000;
    for (let i = 0; i < n; i++) {
      eq += (Math.random() - (volBias ? 0.52 : 0.46)) * 4000;
      path.push(Math.round(eq));
    }
    paths.push(path);
  }
  for (let i = 0; i < n; i++) {
    const drift = mu * 200 * i;
    p05.push(1_000_000 + drift - 1800 * Math.sqrt(i));
    p50.push(1_000_000 + drift);
    p95.push(1_000_000 + drift + 1800 * Math.sqrt(i));
  }
  return {
    startCapital: 1_000_000,
    pRuin: volBias ? 0.04 : 0.0,
    pDD10: volBias ? 0.29 : 0.05,
    pDD20: volBias ? 0.06 : 0.005,
    medianMaxDD: 0.071,
    worstMaxDD: 0.31,
    expectedDrawdown: 0.074,
    finalP05: 962000,
    finalP50: 1024000,
    finalP95: 1086000,
    medianReturnPct: volBias ? -1.5 : 2.4,
    hist: { counts, edges },
    cone: { p05, p50, p95 },
    samplePaths: paths,
  };
}
