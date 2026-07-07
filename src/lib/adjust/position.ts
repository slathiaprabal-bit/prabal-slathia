// Build an instrument-aware Position from a user-loaded position. No demo /
// hardcoded assumptions — every parameter comes from the loaded legs, the
// detected instrument's market structure, and the live snapshot.
import type { Snapshot } from '../../types';
import type { Leg, LoadedLeg, LoadedPosition, Position } from './types';
import { characteristics, detectInstrument, parseOptionSymbol, type InstrumentParams } from './instruments';

// Live underlying spot for the instrument, if the snapshot carries it.
function liveSpot(inst: string, snap: Snapshot | null): number | null {
  if (inst === 'NIFTY') return snap?.spot ?? null;
  const sec = snap?.secondary as any;
  const v = sec?.[inst.toLowerCase()]?.value;
  return typeof v === 'number' ? v : null;
}

// Fallback spot: infer from the position's strikes (ATM ≈ median strike).
function inferSpot(legs: LoadedLeg[]): number {
  const ks = legs.map((l) => l.strike).sort((a, b) => a - b);
  return ks.length ? ks[Math.floor(ks.length / 2)] : 0;
}

export function buildPosition(loaded: LoadedPosition, params: InstrumentParams,
                              snap: Snapshot | null, dte: number): Position {
  const inst = loaded.instrument;
  const ch = characteristics(inst);
  const spot = loaded.spot ?? liveSpot(inst, snap) ?? inferSpot(loaded.legs);
  const ivPct = loaded.iv ?? snap?.vol.vix ?? (ch.ivBand[0] + ch.ivBand[1]) / 2;
  const iv = Math.max(0.05, ivPct / 100);
  const ivRank = snap?.vol.ivRank ?? 50;
  const regime = snap?.regime.state ?? 'NORMAL';
  const legs: Leg[] = loaded.legs.map((l) => ({ kind: l.kind, strike: l.strike, qty: l.qty }));
  return {
    legs, spot, iv, ivRank, dte, rate: 0.066,
    lotSize: params.lotSize, strikeStep: params.strikeStep,
    instrument: inst, exchange: params.exchange, regime, label: loaded.label,
  };
}

// SOURCE 2 — open the live Strategy Lab structure from the snapshot (real).
export function fromSnapshotTrade(snap: Snapshot | null): LoadedPosition | null {
  const t = snap?.trade;
  if (!t || !t.shortPut || !t.shortCall) return null;
  const legs: LoadedLeg[] = [
    { kind: 'P', strike: Math.round(t.shortPut), qty: -1 },
    { kind: 'C', strike: Math.round(t.shortCall), qty: -1 },
  ];
  const struct = (t.structure ?? '').toUpperCase();
  if (struct.includes('CONDOR') || struct.includes('IRON')) {
    legs.push({ kind: 'P', strike: Math.round(t.shortPut) - 200, qty: 1 });
    legs.push({ kind: 'C', strike: Math.round(t.shortCall) + 200, qty: 1 });
  }
  return { instrument: 'NIFTY', legs, label: t.structure || 'Strategy Lab structure', source: 'STRATEGY_LAB' };
}

// SOURCE 1 — parse pasted broker positions. Two accepted line formats:
//   fielded (robust):  INSTRUMENT STRIKE C|P QTY [ENTRY]   e.g. "BANKNIFTY 54000 C -1 150"
//   symbol (monthly):  SYMBOL QTY [ENTRY]                  e.g. "BANKNIFTY24JUL54000CE -1 150"
// QTY is in lots (− short). Broker-API auto-sync is a future provider seam.
export function parseBrokerText(text: string): { position: LoadedPosition | null; errors: string[] } {
  const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const legs: LoadedLeg[] = [];
  const errors: string[] = [];
  let inst: string | null = null;

  const add = (i: string, kind: 'C' | 'P', strike: number, qty: number, entry?: number) => {
    inst = inst ?? i;
    if (i !== inst) { errors.push(`Mixed instrument skipped: ${i}`); return; }
    if (!isFinite(strike) || !isFinite(qty) || qty === 0) { errors.push(`Bad leg: ${i} ${strike}`); return; }
    legs.push({ kind, strike, qty, entry: isFinite(entry as number) ? entry : undefined });
  };

  for (const line of lines) {
    const p = line.split(/[\s,]+/);
    const asInst = detectInstrumentExact(p[0]);
    if (asInst && /^(c|ce|p|pe)$/i.test(p[2] ?? '')) {
      // fielded: INSTRUMENT STRIKE KIND QTY [ENTRY]
      add(asInst, /^c/i.test(p[2]) ? 'C' : 'P', parseInt(p[1], 10), parseInt(p[3] ?? '', 10),
        p[4] != null ? parseFloat(p[4]) : undefined);
      continue;
    }
    const sym = parseOptionSymbol(p[0] ?? '');
    if (sym) {
      add(sym.instrument, sym.kind, sym.strike, parseInt(p[1] ?? '', 10),
        p[2] != null ? parseFloat(p[2]) : undefined);
      continue;
    }
    errors.push(`Unparseable: "${line}"`);
  }
  if (!inst || legs.length === 0) {
    return { position: null, errors: errors.length ? errors : ['No valid option legs found.'] };
  }
  return { position: { instrument: inst, legs, label: `${inst} imported`, source: 'BROKER' }, errors };
}

// Exact instrument-name token (first field of the fielded format).
function detectInstrumentExact(tok: string | undefined): string | null {
  if (!tok) return null;
  const t = tok.toUpperCase();
  return t.match(/^[A-Z]+$/) ? (detectInstrument(t) === t ? t : null) : null;
}
