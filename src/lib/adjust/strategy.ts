// Deterministic option-structure classifier. No LLM — pure geometry over the
// legs. Returns the institutional name of the detected structure; anything the
// classifier can't name falls back to "Custom Option Structure" (the optimizer
// still handles it). This is the single source of the "Detected Strategy" label.
import type { LoadedLeg, OptKind } from './types';

export interface DetectedStrategy {
  name: string;
  legCount: number;   // distinct legs after merging
}

interface NLeg { kind: OptKind; strike: number; qty: number; expiry: string; }

const CUSTOM = 'Custom Option Structure';

// Merge duplicate legs (same kind/strike/expiry), drop net-zero, sort by strike.
function normalize(legs: LoadedLeg[]): NLeg[] {
  const m = new Map<string, NLeg>();
  for (const l of legs) {
    const k = `${l.kind}|${l.strike}|${l.expiry ?? ''}`;
    const e = m.get(k);
    if (e) e.qty += l.qty;
    else m.set(k, { kind: l.kind, strike: l.strike, qty: l.qty, expiry: l.expiry ?? '' });
  }
  return [...m.values()].filter((l) => l.qty !== 0).sort((a, b) => a.strike - b.strike);
}

function classify(ls: NLeg[]): string {
  if (ls.length === 0) return '—';

  const expiries = [...new Set(ls.map((l) => l.expiry))];
  const calls = ls.filter((l) => l.kind === 'C').sort((a, b) => a.strike - b.strike);
  const puts = ls.filter((l) => l.kind === 'P').sort((a, b) => a.strike - b.strike);
  const nShort = ls.reduce((s, l) => (l.qty < 0 ? s - l.qty : s), 0);
  const nLong = ls.reduce((s, l) => (l.qty > 0 ? s + l.qty : s), 0);

  // ── multi-expiry: calendar / diagonal families ──
  if (expiries.length > 1) {
    if (ls.length === 2 && ls[0].kind === ls[1].kind && Math.sign(ls[0].qty) !== Math.sign(ls[1].qty)) {
      return ls[0].strike === ls[1].strike ? 'Calendar Spread' : 'Diagonal Spread';
    }
    if (ls.length === 4 && calls.length === 2 && puts.length === 2) return 'Double Calendar';
    return 'Custom Time Structure';
  }

  // ── single leg ──
  if (ls.length === 1) {
    const l = ls[0];
    return `${l.qty < 0 ? 'Short' : 'Long'} ${l.kind === 'C' ? 'Call' : 'Put'}`;
  }

  // ── two legs ──
  if (ls.length === 2) {
    const [a, b] = ls;   // sorted by strike
    if (calls.length === 1 && puts.length === 1 && Math.sign(a.qty) === Math.sign(b.qty)) {
      const side = a.qty < 0 ? 'Short' : 'Long';
      return `${side} ${a.strike === b.strike ? 'Straddle' : 'Strangle'}`;
    }
    if (a.kind === b.kind && Math.sign(a.qty) !== Math.sign(b.qty)) {
      if (Math.abs(a.qty) !== Math.abs(b.qty)) return nLong > nShort ? 'Ratio Backspread' : 'Ratio Spread';
      // 1:1 vertical — a is the lower strike.
      if (a.kind === 'C') return a.qty < 0 ? 'Bear Call Spread' : 'Bull Call Spread';
      return a.qty < 0 ? 'Bear Put Spread' : 'Bull Put Spread';
    }
    return CUSTOM;
  }

  // ── three legs ──
  if (ls.length === 3) {
    // Jade Lizard: short put + short call + long higher call (no upside risk).
    if (puts.length === 1 && calls.length === 2 &&
        puts[0].qty < 0 && calls[0].qty < 0 && calls[1].qty > 0) return 'Jade Lizard';
    // Reverse Jade Lizard: short call + short put + long lower put.
    if (calls.length === 1 && puts.length === 2 &&
        calls[0].qty < 0 && puts[1].qty < 0 && puts[0].qty > 0) return 'Reverse Jade Lizard';
    // Butterfly (all one kind): long – short(2) – long.
    if ((calls.length === 3 || puts.length === 3) &&
        ls[0].qty > 0 && ls[1].qty < 0 && ls[2].qty > 0) {
      const w1 = ls[1].strike - ls[0].strike, w2 = ls[2].strike - ls[1].strike;
      return w1 === w2 ? 'Butterfly' : 'Broken Wing Butterfly';
    }
    if (calls.length === 3 || puts.length === 3) return nLong > nShort ? 'Ratio Backspread' : 'Ratio Spread';
    return CUSTOM;
  }

  // ── four legs ──
  if (ls.length === 4) {
    if (calls.length === 2 && puts.length === 2) {
      const sp = puts.find((l) => l.qty < 0), lp = puts.find((l) => l.qty > 0);
      const sc = calls.find((l) => l.qty < 0), lc = calls.find((l) => l.qty > 0);
      if (sp && lp && sc && lc && lp.strike < sp.strike && lc.strike > sc.strike) {
        return sp.strike === sc.strike ? 'Iron Fly' : 'Iron Condor';
      }
    }
    if ((calls.length === 4 || puts.length === 4) &&
        ls[0].qty > 0 && ls[1].qty < 0 && ls[2].qty < 0 && ls[3].qty > 0) return 'Condor';
    return CUSTOM;
  }

  return CUSTOM;
}

export function detectStrategy(legs: LoadedLeg[]): DetectedStrategy {
  const ls = normalize(legs);
  return { name: classify(ls), legCount: ls.length };
}
