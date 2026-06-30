import { useEffect, useMemo, useState } from 'react';
import { fetchEvents } from './provider';
import { computeImpact } from './impact';
import { weekRisk, sectorExposure } from './weekscore';
import { countdown, istDateKey } from './format';
import type { MarketEvent, RawEvent, WeekRisk, SectorTilt } from './types';

export interface EventsState {
  events: MarketEvent[];     // all, decorated + sorted by time
  today: MarketEvent[];      // events on the current IST date
  upcoming: MarketEvent[];   // future HIGH/CRITICAL, soonest first
  week: WeekRisk;            // Next-7-Days meter + per-day
  sectors: SectorTilt[];     // sector exposure, next 7 days
  loading: boolean;          // before the first fetch resolves
  stale: boolean;            // last fetch failed (showing last-good or empty)
  generatedAt: number | null;
}

function decorate(e: RawEvent, nowMs: number): MarketEvent {
  const t = Date.parse(e.datetime);
  const msUntil = isNaN(t) ? null : t - nowMs;
  const hoursUntil = msUntil == null ? null : msUntil / 3.6e6;
  const impact = computeImpact(e, hoursUntil);
  const isToday = !isNaN(t) && istDateKey(new Date(t)) === istDateKey(new Date(nowMs));
  return { ...e, impact, msUntil, countdown: countdown(msUntil), isToday };
}

// Polls /api/events every 30s; recomputes the live countdown every second.
// All trading logic is deterministic (impact, week score) — no LLM.
export function useEvents(): EventsState {
  const [raw, setRaw] = useState<RawEvent[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [stale, setStale] = useState(false);
  const [generatedAt, setGeneratedAt] = useState<number | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const e = await fetchEvents();
      if (!alive) return;
      if (e) { setRaw(e); setStale(false); setGeneratedAt(Date.now()); }
      else { setStale(true); }
      setLoading(false);
    };
    load();
    const id = window.setInterval(load, 30000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Decorate + derive. Countdown depends on the per-second tick; impact/week
  // depend on coarser proximity, so re-derive each second (cheap for ~25 events).
  const sec = Math.floor(nowMs / 1000);
  return useMemo(() => {
    const list = (raw ?? []).map((e) => decorate(e, nowMs)).sort((a, b) => (a.datetime < b.datetime ? -1 : 1));
    const today = list.filter((e) => e.isToday);
    const upcoming = list
      .filter((e) => e.status !== 'COMPLETED' && (e.importance === 'HIGH' || e.importance === 'CRITICAL'))
      .slice(0, 8);
    const week = weekRisk(raw ?? [], nowMs);
    const sectors = sectorExposure(list);
    return { events: list, today, upcoming, week, sectors, loading, stale, generatedAt };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raw, sec, loading, stale, generatedAt]);
}

export type { MarketEvent } from './types';
