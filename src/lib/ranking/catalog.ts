import type { StrategyArchetype } from './types';

// Institutional option-structure catalog. Each archetype is declarative — add /
// replace structures here without touching the scorer.
export const STRATEGY_CATALOG: StrategyArchetype[] = [
  { key: 'iron_condor', name: 'Iron Condor', family: 'Range / Income', bias: 'NEUTRAL', volFit: ['ELEVATED', 'HIGH'], vega: 'SHORT', risk: 'LOW', definedRisk: true, note: 'Defined-risk premium capture in a range with rich IV.' },
  { key: 'iron_fly', name: 'Iron Butterfly', family: 'Range / Income', bias: 'NEUTRAL', volFit: ['NORMAL', 'ELEVATED'], vega: 'SHORT', risk: 'MEDIUM', definedRisk: true, note: 'Pins the range; higher credit, tighter profit zone.' },
  { key: 'short_strangle', name: 'Short Strangle', family: 'Range / Income', bias: 'NEUTRAL', volFit: ['HIGH', 'EXTREME'], vega: 'SHORT', risk: 'HIGH', definedRisk: false, note: 'Maximum premium in high IV; undefined risk, manage actively.' },
  { key: 'jade_lizard', name: 'Jade Lizard', family: 'Directional Credit', bias: 'BULL', volFit: ['ELEVATED', 'HIGH'], vega: 'SHORT', risk: 'MEDIUM', definedRisk: false, note: 'No upside risk; collects put + call-spread credit on skew.' },
  { key: 'bull_put', name: 'Bull Put Spread', family: 'Directional Credit', bias: 'BULL', volFit: ['ELEVATED', 'HIGH'], vega: 'SHORT', risk: 'LOW', definedRisk: true, note: 'Bullish, positive theta, defined risk.' },
  { key: 'bear_call', name: 'Bear Call Spread', family: 'Directional Credit', bias: 'BEAR', volFit: ['ELEVATED', 'HIGH'], vega: 'SHORT', risk: 'LOW', definedRisk: true, note: 'Bearish, sell call spreads into strength.' },
  { key: 'bull_call', name: 'Bull Call Spread', family: 'Directional Debit', bias: 'BULL', volFit: ['VERY_LOW', 'LOW', 'NORMAL'], vega: 'LONG', risk: 'LOW', definedRisk: true, note: 'Bullish with cheap IV; defined-risk long delta.' },
  { key: 'bear_put', name: 'Bear Put Spread', family: 'Directional Debit', bias: 'BEAR', volFit: ['VERY_LOW', 'LOW', 'NORMAL'], vega: 'LONG', risk: 'LOW', definedRisk: true, note: 'Bearish with cheap IV; defined-risk short delta.' },
  { key: 'calendar', name: 'Calendar Spread', family: 'Long Vol', bias: 'NEUTRAL', volFit: ['VERY_LOW', 'LOW'], vega: 'LONG', risk: 'LOW', definedRisk: true, note: 'Owns time/vega when IV is cheap and expected to rise.' },
  { key: 'double_calendar', name: 'Double Calendar', family: 'Long Vol', bias: 'NEUTRAL', volFit: ['VERY_LOW', 'LOW'], vega: 'LONG', risk: 'MEDIUM', definedRisk: true, note: 'Wider long-vega range play in compressed IV.' },
  { key: 'diagonal', name: 'Diagonal Spread', family: 'Long Vol', bias: 'BULL', volFit: ['LOW', 'NORMAL'], vega: 'LONG', risk: 'MEDIUM', definedRisk: true, note: 'Directional long-vega with calendar carry.' },
  { key: 'ratio_backspread', name: 'Ratio Backspread', family: 'Convex', bias: 'BULL', volFit: ['LOW', 'NORMAL'], vega: 'LONG', risk: 'MEDIUM', definedRisk: false, note: 'Convex payoff for a vol-expansion breakout.' },
  { key: 'long_straddle', name: 'Long Straddle', family: 'Long Vol', bias: 'NEUTRAL', volFit: ['VERY_LOW', 'LOW'], vega: 'LONG', risk: 'MEDIUM', definedRisk: true, note: 'Pure long vol/gamma for an expected expansion.' },
  { key: 'defensive_hedge', name: 'Defensive Long Premium', family: 'Hedge', bias: 'NEUTRAL', volFit: ['EXTREME'], vega: 'LONG', risk: 'LOW', definedRisk: true, note: 'Reduce size; own convexity through extreme-vol tail risk.' },
];
