import { useEffect, useMemo, useState } from 'react';
import { useTerminal } from '../../store';
import { useEvents } from '../events/useEvents';
import { useMarketStructure } from './instruments';
import { buildPosition } from './position';
import { computeMetrics } from './metrics';
import { optimize } from './optimizer';
import type { AdjMode, Aggressiveness, LoadedPosition, MarketThesis, OptimizeConfig, VolContext } from './types';

export function useAdjust() {
  const snap = useTerminal((s) => s.snap);
  const { events } = useEvents();
  const { params, expiries, degraded } = useMarketStructure();

  const [loaded, setLoaded] = useState<LoadedPosition | null>(null);
  const [mode, setMode] = useState<AdjMode>('DEFENSIVE');
  const [thesis, setThesis] = useState<MarketThesis | null>(null);   // STEP 1 — mandatory before ranking
  const [aggressiveness, setAggressiveness] = useState<Aggressiveness>('BALANCED');
  const [dte, setDte] = useState<number | null>(null);   // null until a position loads

  const instParams = loaded && params ? params[loaded.instrument] ?? null : null;

  // When a position loads, seed DTE from its instrument's real next expiry.
  useEffect(() => {
    if (loaded && instParams && dte == null) setDte(instParams.dte ?? 7);
    if (!loaded && dte != null) setDte(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, instParams]);

  const spot = snap?.spot ?? 0;
  const vix = snap?.vol.vix ?? 0;
  const effectiveDte = dte ?? instParams?.dte ?? 7;

  const position = useMemo(
    () => (loaded && instParams ? buildPosition(loaded, instParams, snap, effectiveDte) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [loaded, instParams, effectiveDte, spot, vix],
  );

  // Nearest high-impact macro (non-expiry) event within the DTE horizon.
  const driver = useMemo(() => {
    const horizon = effectiveDte * 86400000;
    const c = events.find((e) =>
      e.category !== 'MARKET_STRUCTURE' && e.status !== 'COMPLETED' &&
      e.msUntil != null && e.msUntil > 0 && e.msUntil <= horizon &&
      (e.importance === 'HIGH' || e.importance === 'CRITICAL'));
    return c ? { name: c.name, hours: (c.msUntil ?? 0) / 3.6e6 } : null;
  }, [events, effectiveDte]);

  const ivRank = position?.ivRank ?? 50;
  const expansionExpected = !!driver || ivRank < 30;
  const contractionExpected = !driver && ivRank > 65;
  const driverName = driver?.name ?? null;
  const vol = useMemo<VolContext>(
    () => ({ expansionExpected, contractionExpected, driverEvent: driverName, hoursToEvent: driver?.hours ?? null }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [expansionExpected, contractionExpected, driverName],
  );

  // Base metrics exist as soon as a position is built — independent of thesis,
  // so the Position Summary renders before the trader picks a view.
  const baseMetrics = useMemo(() => (position ? computeMetrics(position.legs, [], position) : null), [position]);

  // STEP 1/9 — no thesis, no ranking. The engine reads intent before it optimizes.
  const config = useMemo<OptimizeConfig | null>(
    () => (thesis ? { mode, thesis, aggressiveness, vol, retainThreshold: 0.30 } : null),
    [mode, thesis, aggressiveness, vol],
  );
  const result = useMemo(
    () => (position && config ? optimize(position, config, 6) : null),
    [position, config],
  );

  const upcoming = useMemo(() => {
    const horizon = effectiveDte * 86400000;
    return events.filter((e) => e.status !== 'COMPLETED' && e.msUntil != null && e.msUntil > 0 && e.msUntil <= horizon)
      .slice(0, 4);
  }, [events, effectiveDte]);

  return {
    loaded, setLoaded, reset: () => { setLoaded(null); setThesis(null); },
    position, baseMetrics, result, mode, setMode, thesis, setThesis, aggressiveness, setAggressiveness,
    dte: effectiveDte, setDte, vol, params, expiries, instParams, degraded, snap, upcoming,
  };
}
