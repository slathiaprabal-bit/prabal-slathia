import { Panel } from '../components/ui/Panel';
import { useAgent } from '../agent/useAgent';
import { ResearchNoteCard } from '../components/agent/ResearchNoteCard';
import { ConfluenceLedger } from '../components/agent/ConfluenceLedger';
import { PreMortemPanel } from '../components/agent/PreMortemPanel';
import { RiskGates } from '../components/agent/RiskGates';
import { Narrative } from '../components/agent/Narrative';
import { MemoryPanel } from '../components/agent/MemoryPanel';

// ════════════════════════════════════════════════════════════════════════
//  AI TRADING RESEARCH AGENT — workspace
//  An independent research desk that consumes VOLARA as a data feed and runs a
//  hedge-fund-style process: regime read → thesis → confluence → pre-mortem →
//  risk gates → conviction/grade → sizing → verdict, then LEARNS from outcomes.
//  It never emits a bare buy/sell signal; it produces a defensible decision.
// ════════════════════════════════════════════════════════════════════════
export function ResearchAgent() {
  const { note, isDemo, demoLabel, stats, resolve, reset } = useAgent();

  const verdictBadge = isDemo && demoLabel ? (
    <span className="rounded px-1.5 py-px text-[8px] font-bold tracking-wider"
      style={{ color: 'var(--gold)', background: 'color-mix(in srgb, var(--gold) 12%, transparent)' }}>
      DEMO · {demoLabel}
    </span>
  ) : null;

  return (
    <div className="grid h-full min-h-0 grid-cols-12 grid-rows-6 gap-2">
      <Panel title="Research Verdict · Thesis · Sizing" badge={verdictBadge} accent="var(--pos)" className="col-start-1 col-span-4 row-start-1 row-span-4" delay={0.04}>
        {note ? <ResearchNoteCard note={note} /> : <Empty />}
      </Panel>

      <Panel title="Confluence Ledger · Weight of Evidence" accent="var(--info)" className="col-start-5 col-span-4 row-start-1 row-span-4" delay={0.08}>
        {note ? <ConfluenceLedger evidence={note.evidence} /> : <Empty />}
      </Panel>

      <Panel title="Pre-Mortem · Disconfirming Evidence" accent="var(--neg)" className="col-start-9 col-span-4 row-start-1 row-span-3" delay={0.12}>
        {note ? <PreMortemPanel pm={note.preMortem} /> : <Empty />}
      </Panel>

      <Panel title="Capital-Preservation Gates" accent="var(--gold)" className="col-start-9 col-span-4 row-start-4 row-span-3" delay={0.16}>
        {note ? <RiskGates gates={note.gates} /> : <Empty />}
      </Panel>

      <Panel title="Reasoning · The Agent Thinking Out Loud" accent="var(--violet)" className="col-start-1 col-span-4 row-start-5 row-span-2" delay={0.2}>
        {note ? <Narrative lines={note.narrative} /> : <Empty />}
      </Panel>

      <Panel title="Memory · Learned Edge & Outcome Feedback" accent="var(--info)" className="col-start-5 col-span-4 row-start-5 row-span-2" delay={0.24}>
        <MemoryPanel stats={stats} note={note} onResolve={resolve} onReset={reset} />
      </Panel>
    </div>
  );
}

function Empty() {
  return <div className="flex h-full items-center justify-center text-[11px] text-[color:var(--dim)]">Awaiting market context…</div>;
}
