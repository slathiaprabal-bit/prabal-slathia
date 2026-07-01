// Generates a large space of candidate adjustments (roll / hedge / ratio /
// spread / straddle) across a strike grid. Returns leg-sets only; the optimizer
// prices, scores and ranks them.
import type { Leg, Position } from './types';

export interface RawCandidate { id: string; label: string; addedLegs: Leg[]; }

const SPAN = 34;    // ±34 strikes each side

function strikeGrid(spot: number, step: number): number[] {
  const atm = Math.round(spot / step) * step;
  const out: number[] = [];
  for (let i = -SPAN; i <= SPAN; i++) out.push(atm + i * step);
  return out;
}

// Merge legs (combine same kind+strike, drop zero qty).
export function mergeLegs(legs: Leg[]): Leg[] {
  const m = new Map<string, Leg>();
  for (const l of legs) {
    const k = `${l.kind}:${l.strike}`;
    const e = m.get(k);
    if (e) e.qty += l.qty; else m.set(k, { ...l });
  }
  return [...m.values()].filter((l) => l.qty !== 0).sort((a, b) => a.strike - b.strike);
}

export function generate(pos: Position): RawCandidate[] {
  const STEP = pos.strikeStep;
  const ks = strikeGrid(pos.spot, STEP);
  const spot = pos.spot;
  const puts = ks.filter((k) => k <= spot);
  const calls = ks.filter((k) => k >= spot);
  const out: RawCandidate[] = [];
  let n = 0;
  const push = (label: string, addedLegs: Leg[]) => out.push({ id: `c${n++}`, label, addedLegs });

  // A/B — protective long wings (defined risk).
  for (const k of puts) push(`Buy ${k} put (downside hedge)`, [{ kind: 'P', strike: k, qty: 1 }]);
  for (const k of calls) push(`Buy ${k} call (upside hedge)`, [{ kind: 'C', strike: k, qty: 1 }]);

  // C/D — add short premium (theta).
  for (const k of puts) if (k < spot) push(`Sell ${k} put (add theta)`, [{ kind: 'P', strike: k, qty: -1 }]);
  for (const k of calls) if (k > spot) push(`Sell ${k} call (add theta)`, [{ kind: 'C', strike: k, qty: -1 }]);

  // E — put ratio backspread (crash convexity): sell 1 near, buy N further OTM.
  for (const ka of puts) for (const kb of puts) {
    if (kb < ka && ka <= spot && ka - kb <= 12 * STEP && ka - kb >= 1 * STEP) {
      for (const ratio of [2, 3]) {
        push(`Put ratio ${ka}/${kb} (−1×${ratio} backspread)`, [
          { kind: 'P', strike: ka, qty: -1 }, { kind: 'P', strike: kb, qty: ratio },
        ]);
      }
    }
  }
  // F — call ratio backspread (upside convexity).
  for (const ka of calls) for (const kb of calls) {
    if (kb > ka && ka >= spot && kb - ka <= 12 * STEP && kb - ka >= 1 * STEP) {
      for (const ratio of [2, 3]) {
        push(`Call ratio ${ka}/${kb} (−1×${ratio} backspread)`, [
          { kind: 'C', strike: ka, qty: -1 }, { kind: 'C', strike: kb, qty: ratio },
        ]);
      }
    }
  }
  // G — credit/debit spreads (defensive, defined risk), both wings.
  for (const ka of puts) for (const kb of puts) {
    if (kb < ka && ka <= spot && ka - kb <= 8 * STEP && ka - kb >= 1 * STEP) {
      push(`Put spread sell ${ka} / buy ${kb}`, [
        { kind: 'P', strike: ka, qty: -1 }, { kind: 'P', strike: kb, qty: 1 },
      ]);
    }
  }
  for (const ka of calls) for (const kb of calls) {
    if (kb > ka && ka >= spot && kb - ka <= 8 * STEP && kb - ka >= 1 * STEP) {
      push(`Call spread sell ${ka} / buy ${kb}`, [
        { kind: 'C', strike: ka, qty: -1 }, { kind: 'C', strike: kb, qty: 1 },
      ]);
    }
  }
  // H — long strangle (vol expansion): buy OTM put + call.
  for (const kp of puts) for (const kc of calls) {
    if (spot - kp >= 2 * STEP && kc - spot >= 2 * STEP && spot - kp <= 14 * STEP && kc - spot <= 14 * STEP) {
      push(`Long ${kp}P / ${kc}C strangle (vega+)`, [
        { kind: 'P', strike: kp, qty: 1 }, { kind: 'C', strike: kc, qty: 1 },
      ]);
    }
  }
  // I — short strangle (vol contraction / theta): sell OTM put + call.
  for (const kp of puts) for (const kc of calls) {
    if (spot - kp >= 2 * STEP && kc - spot >= 2 * STEP && spot - kp <= 12 * STEP && kc - spot <= 12 * STEP) {
      push(`Short ${kp}P / ${kc}C strangle (vega−)`, [
        { kind: 'P', strike: kp, qty: -1 }, { kind: 'C', strike: kc, qty: -1 },
      ]);
    }
  }
  // J/K — roll existing short legs to new strikes.
  for (const base of pos.legs) {
    if (base.qty >= 0) continue;
    const targets = base.kind === 'P' ? puts : calls;
    for (const k of targets) {
      if (k === base.strike) continue;
      const dir = base.kind === 'P' ? k < base.strike : k > base.strike;
      if (!dir) continue;
      push(`Roll short ${base.kind} ${base.strike}→${k}`, [
        { kind: base.kind, strike: base.strike, qty: -base.qty },  // close
        { kind: base.kind, strike: k, qty: base.qty },             // reopen
      ]);
    }
  }

  return out;
}
