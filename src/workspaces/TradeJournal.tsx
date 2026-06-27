import { Panel } from '../components/ui/Panel';
import { useJournal } from '../lib/journal/useJournal';
import { JournalSummary } from '../components/journal/JournalSummary';
import { BiasAnalysis } from '../components/journal/BiasAnalysis';
import { TradeTable } from '../components/journal/TradeTable';
import { Suggestions } from '../components/journal/Suggestions';

// Phase 2 · Priority 5 — Trade Journal Intelligence. Post-trade analytics:
// expectancy, per-trade execution scoring, behavioural bias detection and
// AI coaching — all from the reusable lib/journal engine.
export function TradeJournal() {
  const j = useJournal();

  return (
    <div className="grid h-full min-h-0 grid-cols-12 grid-rows-6 gap-2">
      <Panel title="Performance · Expectancy" accent="var(--pos)" className="col-start-1 col-span-5 row-start-1 row-span-2" delay={0.04}>
        <JournalSummary j={j} />
      </Panel>

      <Panel title="Behavioural Bias Analysis" accent="var(--neg)" className="col-start-1 col-span-5 row-start-3 row-span-4" delay={0.08}>
        <BiasAnalysis j={j} />
      </Panel>

      <Panel title="Trade History · AI Execution Analysis" accent="var(--info)" className="col-start-6 col-span-7 row-start-1 row-span-4" delay={0.12}>
        <TradeTable j={j} />
      </Panel>

      <Panel title="AI Coaching · Improvement Plan" accent="var(--gold)" className="col-start-6 col-span-7 row-start-5 row-span-2" delay={0.16}>
        <Suggestions j={j} />
      </Panel>
    </div>
  );
}
