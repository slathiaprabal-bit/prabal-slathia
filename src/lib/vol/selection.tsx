// Cross-chart selection for the Volatility Terminal. Clicking a cell on the
// 3D surface or the heatmap selects an (expiry, strike) pair; the Volatility
// Smile re-renders that expiry's slice and the Term Structure overlays the
// selected strike across maturities — one coordinated workspace.
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

export interface VolSelection {
  expiryIdx: number | null;   // index into surface.expiries
  strikeIdx: number | null;   // index into surface.strikes
  select: (expiryIdx: number, strikeIdx: number) => void;
  clear: () => void;
}

const Ctx = createContext<VolSelection>({ expiryIdx: null, strikeIdx: null, select: () => {}, clear: () => {} });

export function VolSelectionProvider({ children }: { children: ReactNode }) {
  const [sel, setSel] = useState<{ e: number; k: number } | null>(null);
  const value = useMemo<VolSelection>(() => ({
    expiryIdx: sel?.e ?? null,
    strikeIdx: sel?.k ?? null,
    select: (e, k) => setSel((cur) => (cur && cur.e === e && cur.k === k ? null : { e, k })),
    clear: () => setSel(null),
  }), [sel]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useVolSelection(): VolSelection {
  return useContext(Ctx);
}
