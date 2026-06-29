import { RotateCcw } from 'lucide-react';
import type { SetupStats, ResearchNote, Outcome } from '../../agent/types';

// The learning loop, made visible. The left column is the agent's TRACK RECORD
// per setup type (Beta-smoothed hit-rate + average R + derived edge) — this is
// what nudges future conviction. The right column lets you RESOLVE the live
// note's outcome, closing the feedback loop in real time.
export function MemoryPanel({
  stats, note, onResolve, onReset,
}: {
  stats: SetupStats[];
  note: ResearchNote | null;
  onResolve: (id: string, outcome: Outcome, r: number | null) => void;
  onReset: () => void;
}) {
  return (
    <div className="flex h-full min-h-0 gap-3">
      {/* track record */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="mb-1 flex items-center justify-between">
          <span className="eyebrow text-[8px]">SETUP TRACK RECORD · LEARNED EDGE</span>
          <button onClick={onReset} title="Reset to seeded baseline"
            className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[8px] text-[color:var(--dim)] hover:text-[color:var(--text)]">
            <RotateCcw size={9} /> reset
          </button>
        </div>
        <div className="flex flex-1 flex-col gap-1 overflow-auto pr-0.5">
          {stats.length === 0 && <Empty text="No resolved trades yet." />}
          {stats.map((s) => <StatRow key={s.setupKey} s={s} />)}
        </div>
      </div>

      {/* resolve current note */}
      <div className="flex w-[44%] shrink-0 flex-col">
        <div className="eyebrow mb-1 text-[8px]">RESOLVE CURRENT NOTE → TEACH THE AGENT</div>
        {note ? (
          <div className="cell flex flex-col gap-2 px-2.5 py-2">
            <div className="text-[9px] text-[color:var(--dim)]">
              {note.setupKey.replace(/\|/g, ' · ')}
            </div>
            <div className="text-[10px] text-[color:var(--text)]">
              Logging an outcome updates this setup's hit-rate and edge, which feeds back into the next deliberation.
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              <OutcomeBtn label="WIN +1.5R" color="var(--pos)" onClick={() => onResolve(note.id, 'WIN', 1.5)} />
              <OutcomeBtn label="SCRATCH" color="var(--gold)" onClick={() => onResolve(note.id, 'SCRATCH', 0)} />
              <OutcomeBtn label="LOSS −1R" color="var(--neg)" onClick={() => onResolve(note.id, 'LOSS', -1)} />
            </div>
            <div className="text-[8px] leading-tight text-[color:var(--dim)]">
              Outcomes persist locally (the loop is real). In production these resolve from VOLARA fills / P&L.
            </div>
          </div>
        ) : <Empty text="No live note to resolve." />}
      </div>
    </div>
  );
}

function StatRow({ s }: { s: SetupStats }) {
  const edgeColor = s.edge > 0.1 ? 'var(--pos)' : s.edge < -0.1 ? 'var(--neg)' : 'var(--dim)';
  const pos = (s.edge + 1) / 2 * 100;
  return (
    <div className="cell px-2 py-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[9px] font-semibold text-[color:var(--text)]">{s.setupKey.replace(/\|/g, ' · ')}</span>
        <span className="mono text-[8px] text-[color:var(--dim)]">{s.wins}-{s.losses} · n{s.n}</span>
      </div>
      <div className="mt-1 flex items-center gap-2">
        <div className="relative h-1 flex-1 rounded-full bg-white/[0.05]">
          <div className="absolute left-1/2 top-0 h-full w-px bg-white/20" />
          <div className="absolute top-1/2 h-2 w-1 -translate-y-1/2 rounded-full" style={{ left: `calc(${pos}% - 2px)`, background: edgeColor }} />
        </div>
        <span className="mono text-[8px]" style={{ color: edgeColor }}>edge {s.edge >= 0 ? '+' : ''}{s.edge.toFixed(2)}</span>
      </div>
      <div className="mt-0.5 flex justify-between text-[8px] text-[color:var(--dim)]">
        <span>hit {(s.hitRate * 100).toFixed(0)}%</span>
        <span>avg {s.avgR >= 0 ? '+' : ''}{s.avgR.toFixed(1)}R</span>
        <span>trust {(s.confidence * 100).toFixed(0)}%</span>
      </div>
    </div>
  );
}

function OutcomeBtn({ label, color, onClick }: { label: string; color: string; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="rounded border px-1 py-1.5 text-[8.5px] font-bold tracking-wide transition-colors"
      style={{ color, borderColor: `color-mix(in srgb, ${color} 40%, transparent)`, background: `color-mix(in srgb, ${color} 8%, transparent)` }}>
      {label}
    </button>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="flex h-full items-center justify-center text-[10px] text-[color:var(--dim)]">{text}</div>;
}
