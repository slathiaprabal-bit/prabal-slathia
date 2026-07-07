import { useState } from 'react';
import { Panel } from '../components/ui/Panel';
import { useEvents } from '../lib/events/useEvents';
import { TodaysEvents } from '../components/events/TodaysEvents';
import { UpcomingHighImpact } from '../components/events/UpcomingHighImpact';
import { WeekRiskScore } from '../components/events/WeekRiskScore';
import { WeekTimeline } from '../components/events/WeekTimeline';
import { EventDetails } from '../components/events/EventDetails';
import { SectorImpact } from '../components/events/SectorImpact';
import { HistoricalArchive } from '../components/events/HistoricalArchive';

// Market Event Intelligence — standalone event-driven decision workspace.
// All trading logic (impact ratings, recommended actions, week-risk score,
// countdown) is deterministic and computed client-side from /api/events.
export function MarketEvents() {
  const { events, today, upcoming, week, sectors } = useEvents();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Auto-focus the soonest non-completed event until the user picks one.
  const selected =
    events.find((e) => e.id === selectedId) ??
    events.find((e) => e.status !== 'COMPLETED') ??
    events[0];

  return (
    <div className="grid h-full min-h-0 grid-cols-12 grid-rows-6 gap-2">
      <Panel title="Today's Events" accent="var(--gold)" className="col-start-1 col-span-4 row-start-1 row-span-4" delay={0.04}>
        <TodaysEvents events={today} selectedId={selected?.id ?? null} onSelect={setSelectedId} />
      </Panel>

      <Panel title="Sector Impact · Next 7 Days" accent="var(--violet)" className="col-start-1 col-span-4 row-start-5 row-span-2" delay={0.08}>
        <SectorImpact sectors={sectors} />
      </Panel>

      <Panel title="Trading Week Risk Score" accent="var(--neg)" className="col-start-5 col-span-4 row-start-1 row-span-2" delay={0.12}>
        <WeekRiskScore week={week} />
      </Panel>

      <Panel title="This Week Timeline" accent="var(--info)" className="col-start-5 col-span-8 row-start-3 row-span-2" delay={0.16}>
        <WeekTimeline events={events} week={week} selectedId={selected?.id ?? null} onSelect={setSelectedId} />
      </Panel>

      <Panel title="Event Details · Trading Impact" accent="var(--gold)" className="col-start-5 col-span-4 row-start-5 row-span-2" delay={0.2}>
        <EventDetails e={selected} />
      </Panel>

      <Panel title="Upcoming High-Impact" accent="var(--neg)" className="col-start-9 col-span-4 row-start-1 row-span-2" delay={0.24}>
        <UpcomingHighImpact events={upcoming} selectedId={selected?.id ?? null} onSelect={setSelectedId} />
      </Panel>

      <Panel title="Historical Event Archive" accent="var(--violet)" className="col-start-9 col-span-4 row-start-5 row-span-2" delay={0.28}>
        <HistoricalArchive e={selected} />
      </Panel>
    </div>
  );
}
