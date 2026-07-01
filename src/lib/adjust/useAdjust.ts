import { useMemo, useState } from 'react';
import { useTerminal } from '../../store';
import { useEvents } from '../events/useEvents';
import { positionFromSnapshot } from './position';
import { optimize } from './optimizer';
import type { AdjMode, VolContext } from './types';

export function useAdjust() {
  const snap = useTerminal((s) => s.snap);
  const { events } = useEvents();
  const [mode, setMode] = useState<AdjMode>('DEFENSIVE');
  const [dte, setDte] = useState(7);

  const spot = snap?.spot ?? 0;
  const vix = snap?.vol.vix ?? 0;
  const sp = snap?.trade?.shortPut ?? null;
  const sc = snap?.trade?.shortCall ?? null;
  const struct = snap?.trade?.structure ?? '';

  const position = useMemo(
    () => positionFromSnapshot(snap, dte),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [spot, vix, sp, sc, struct, dte],
  );

  // Nearest high-impact macro (non-expiry) event within the DTE horizon.
  const driver = useMemo(() => {
    const horizon = dte * 86400000;
    const c = events.find((e) =>
      e.category !== 'MARKET_STRUCTURE' && e.status !== 'COMPLETED' &&
      e.msUntil != null && e.msUntil > 0 && e.msUntil <= horizon &&
      (e.importance === 'HIGH' || e.importance === 'CRITICAL'));
    return c ? { name: c.name, hours: (c.msUntil ?? 0) / 3.6e6 } : null;
  }, [events, dte]);

  const expansionExpected = !!driver || position.ivRank < 30;
  const contractionExpected = !driver && position.ivRank > 65;
  const driverName = driver?.name ?? null;

  // Memoize on primitives so the per-second event tick never re-runs optimize.
  const vol = useMemo<VolContext>(
    () => ({ expansionExpected, contractionExpected, driverEvent: driverName, hoursToEvent: driver?.hours ?? null }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [expansionExpected, contractionExpected, driverName],
  );

  const result = useMemo(() => optimize(position, mode, vol, 6), [position, mode, vol]);

  return { position, result, mode, setMode, dte, setDte, vol };
}
