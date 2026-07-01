import { useEffect, useState } from 'react';

// Instrument-aware market structure. Structural params (lot size, strike step,
// exchange, next expiry) come from the backend Market Structure Provider — the
// single source of truth. Characteristics (liquidity, IV band) are analytics
// heuristics used to adapt optimizer assumptions.

export interface InstrumentParams {
  instrument: string;
  exchange: string;
  lotSize: number;
  strikeStep: number;
  nextExpiry: string | null;
  nextExpiryKind: string | null;
  dte: number | null;
}

export interface InstrumentChar {
  label: string;
  liquidity: 'DEEP' | 'GOOD' | 'MODERATE' | 'THIN';
  ivBand: [number, number];
}

const CHARS: Record<string, InstrumentChar> = {
  NIFTY: { label: 'NIFTY 50', liquidity: 'DEEP', ivBand: [10, 22] },
  BANKNIFTY: { label: 'BANK NIFTY', liquidity: 'DEEP', ivBand: [12, 26] },
  SENSEX: { label: 'SENSEX', liquidity: 'GOOD', ivBand: [10, 22] },
  FINNIFTY: { label: 'FIN NIFTY', liquidity: 'GOOD', ivBand: [11, 24] },
  MIDCPNIFTY: { label: 'MIDCAP NIFTY', liquidity: 'MODERATE', ivBand: [13, 28] },
  BANKEX: { label: 'BANKEX', liquidity: 'MODERATE', ivBand: [12, 26] },
};

// Degraded fallback ONLY if /api/market-structure is unreachable (flagged).
const FALLBACK: Record<string, { exchange: string; lotSize: number; strikeStep: number }> = {
  NIFTY: { exchange: 'NSE', lotSize: 75, strikeStep: 50 },
  BANKNIFTY: { exchange: 'NSE', lotSize: 35, strikeStep: 100 },
  SENSEX: { exchange: 'BSE', lotSize: 20, strikeStep: 100 },
  FINNIFTY: { exchange: 'NSE', lotSize: 65, strikeStep: 50 },
  MIDCPNIFTY: { exchange: 'NSE', lotSize: 120, strikeStep: 25 },
  BANKEX: { exchange: 'BSE', lotSize: 15, strikeStep: 100 },
};

export const INSTRUMENT_NAMES = Object.keys(CHARS);
export function characteristics(inst: string): InstrumentChar {
  return CHARS[inst] ?? { label: inst, liquidity: 'MODERATE', ivBand: [10, 25] };
}

// Detect the underlying from an option symbol (longest names first so NIFTY
// never shadows BANKNIFTY / FINNIFTY / MIDCPNIFTY).
export function detectInstrument(symbol: string): string | null {
  const s = symbol.toUpperCase().replace(/[^A-Z0-9]/g, '');
  for (const name of [...INSTRUMENT_NAMES].sort((a, b) => b.length - a.length)) {
    if (s.startsWith(name)) return name;
  }
  return null;
}

// Parse a full option symbol e.g. "BANKNIFTY24JUL54000CE" / "NIFTY2470324000PE".
export function parseOptionSymbol(symbol: string): { instrument: string; strike: number; kind: 'C' | 'P' } | null {
  const inst = detectInstrument(symbol);
  if (!inst) return null;
  const s = symbol.toUpperCase().replace(/\s+/g, '');
  const m = s.match(/(\d{3,7})(CE|PE|C|P)$/);
  if (!m) return null;
  return { instrument: inst, strike: parseInt(m[1], 10), kind: m[2][0] === 'C' ? 'C' : 'P' };
}

const API_BASE = (import.meta as any).env?.VITE_API_URL || `http://${location.hostname}:8000`;

export function useMarketStructure() {
  const [params, setParams] = useState<Record<string, InstrumentParams> | null>(null);
  const [degraded, setDegraded] = useState(false);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/market-structure`, { signal: AbortSignal.timeout(8000) });
        if (!res.ok) throw new Error('bad');
        const d = await res.json();
        const out: Record<string, InstrumentParams> = {};
        for (const [inst, cfg] of Object.entries<any>(d.instruments ?? {})) {
          const nx = d.nextByInstrument?.[inst];
          const dte = nx?.date
            ? Math.max(0, Math.round((Date.parse(`${nx.date}T15:30:00+05:30`) - Date.now()) / 86400000))
            : null;
          out[inst] = {
            instrument: inst, exchange: cfg.exchange, lotSize: cfg.lotSize, strikeStep: cfg.strikeStep,
            nextExpiry: nx?.date ?? null, nextExpiryKind: nx?.kind ?? null, dte,
          };
        }
        if (alive) { setParams(out); setDegraded(false); }
      } catch {
        if (!alive) return;
        const out: Record<string, InstrumentParams> = {};
        for (const [inst, f] of Object.entries(FALLBACK)) {
          out[inst] = { instrument: inst, ...f, nextExpiry: null, nextExpiryKind: null, dte: null };
        }
        setParams(out); setDegraded(true);
      }
    })();
    return () => { alive = false; };
  }, []);
  return { params, degraded };
}
