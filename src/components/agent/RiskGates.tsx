import { Check, X, AlertTriangle } from 'lucide-react';
import type { RiskGate } from '../../agent/types';

// The capital-preservation checklist. Hard BLOCK vetoes can stop a perfect
// setup outright; CAUTION flags downgrade and shrink it. The agent's edge is
// as much in what it refuses as in what it takes.
export function RiskGates({ gates }: { gates: RiskGate[] }) {
  const blocks = gates.filter((g) => !g.passed && g.severity === 'BLOCK').length;
  const cautions = gates.filter((g) => !g.passed && g.severity === 'CAUTION').length;

  return (
    <div className="flex h-full flex-col">
      <div className="mb-1.5 flex items-center gap-2 text-[8px]">
        <span className="eyebrow">{gates.length - blocks - cautions}/{gates.length} CLEAR</span>
        {blocks > 0 && <span className="font-bold" style={{ color: 'var(--neg)' }}>{blocks} BLOCK</span>}
        {cautions > 0 && <span className="font-bold" style={{ color: 'var(--gold)' }}>{cautions} CAUTION</span>}
      </div>
      <div className="flex flex-1 flex-col gap-1 overflow-auto pr-0.5">
        {gates.map((g) => {
          const color = g.passed ? 'var(--pos)' : g.severity === 'BLOCK' ? 'var(--neg)' : 'var(--gold)';
          const Icon = g.passed ? Check : g.severity === 'BLOCK' ? X : AlertTriangle;
          return (
            <div key={g.id} className="cell flex items-start gap-2 px-2 py-1.5">
              <Icon size={12} style={{ color }} className="mt-px shrink-0" />
              <div className="min-w-0">
                <div className="text-[9.5px] font-semibold" style={{ color: g.passed ? 'var(--text)' : color }}>{g.label}</div>
                <div className="text-[8.5px] leading-tight text-[color:var(--dim)]">{g.detail}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
