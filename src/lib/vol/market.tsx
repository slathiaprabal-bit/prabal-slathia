// Multi-asset market context for the Volatility Terminal.
//
// CurrentInstrument → MarketDataProvider (/api/vol/{inst}) → pseudo-snapshot →
// every panel. The UI reads ONE market object via useMarketSnap() and never
// knows which index it is rendering. The instrument list comes from the
// backend registry (frontend registry as fallback), so adding an index is a
// one-line backend config change with zero UI edits.
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useTerminal } from '../../store';
import { INSTRUMENT_NAMES, characteristics } from '../adjust/instruments';
import { mockVolContext } from '../../mock';
import type { Snapshot, VolContext } from '../../types';

const API_BASE = (import.meta as any).env?.VITE_API_URL || `http://${location.hostname}:8000`;
// The engine's primary feed (the live WebSocket snapshot) — richest source.
export const PRIMARY_INSTRUMENT = 'NIFTY';

interface MarketState {
  instrument: string;
  setInstrument: (i: string) => void;
  list: { instrument: string; label: string }[];
  ctx: VolContext | null;        // null for the primary instrument (ws snap is used)
}

const Ctx = createContext<MarketState>({
  instrument: PRIMARY_INSTRUMENT, setInstrument: () => {}, list: [], ctx: null,
});

export function VolMarketProvider({ children }: { children: ReactNode }) {
  const conn = useTerminal((s) => s.conn);
  const [instrument, setInstrument] = useState(PRIMARY_INSTRUMENT);
  const [list, setList] = useState<{ instrument: string; label: string }[]>(
    INSTRUMENT_NAMES.map((n) => ({ instrument: n, label: characteristics(n).label })));
  const [ctx, setCtx] = useState<VolContext | null>(null);

  // Discover registered instruments from the backend registry.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch(`${API_BASE}/api/vol/instruments`, { signal: AbortSignal.timeout(6000) });
        if (!r.ok) return;
        const d = await r.json();
        if (alive && Array.isArray(d) && d.length) setList(d);
      } catch { /* frontend registry fallback stays */ }
    })();
    return () => { alive = false; };
  }, []);

  // Fetch (and poll) the selected instrument's market context. The primary
  // instrument keeps ctx = null: its data is the live snapshot itself.
  useEffect(() => {
    if (instrument === PRIMARY_INSTRUMENT) { setCtx(null); return; }
    let alive = true;
    const load = async () => {
      try {
        const r = await fetch(`${API_BASE}/api/vol/${instrument}`, { signal: AbortSignal.timeout(8000) });
        if (!r.ok) throw new Error('bad');
        const d = (await r.json()) as VolContext;
        if (!alive) return;
        if (d.available) { setCtx(d); return; }
        // backend reachable but this index has no data yet → demo only in demo mode
        setCtx(conn === 'mock' ? mockVolContext(instrument) ?? d : d);
      } catch {
        if (alive) setCtx(mockVolContext(instrument));   // demo fallback, DEMO-labelled
      }
    };
    load();
    const id = window.setInterval(load, 30000);
    return () => { alive = false; clearInterval(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instrument, conn]);

  const value = useMemo(() => ({ instrument, setInstrument, list, ctx }), [instrument, list, ctx]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useVolMarket(): MarketState {
  return useContext(Ctx);
}

// Graft an instrument context onto the live snapshot so every existing pure
// derivation (vol inputs, engine, charts) works unchanged for ANY index.
export function ctxAsSnap(live: Snapshot, c: VolContext): Snapshot {
  return {
    ...live,
    spot: c.spot ?? live.spot,
    regime: { ...live.regime, vixChg: c.vixChg ?? 0 },
    vol: { ...live.vol, ...(c.vol ?? {}) } as Snapshot['vol'],
    surface: c.surface ?? live.surface,
    surfaceModel: c.surfaceModel ?? null,
    smile: c.smile ?? live.smile,
    term: c.term ?? live.term,
    volHistory: c.volHistory ?? null,
  };
}

// The instrument-adjusted market snapshot the whole terminal reads.
export function useMarketSnap(): { snap: Snapshot | null; market: MarketState; unavailable: boolean } {
  const live = useTerminal((s) => s.snap);
  const market = useVolMarket();
  return useMemo(() => {
    if (!live || market.instrument === PRIMARY_INSTRUMENT) {
      return { snap: live ?? null, market, unavailable: false };
    }
    if (!market.ctx || !market.ctx.available || !market.ctx.surface) {
      return { snap: null, market, unavailable: true };
    }
    return { snap: ctxAsSnap(live, market.ctx), market, unavailable: false };
  }, [live, market]);
}
