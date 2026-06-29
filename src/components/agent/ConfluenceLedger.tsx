import type { EvidenceItem } from '../../agent/types';

// The weight-of-evidence ledger. Every independent factor is shown with its
// alignment to the thesis — corroborating (green, right) or contradicting
// (red, left) — so the case for the trade is auditable, never a black box.
export function ConfluenceLedger({ evidence }: { evidence: EvidenceItem[] }) {
  const sorted = [...evidence].sort((a, b) => b.align * b.weight - a.align * a.weight);
  return (
    <div className="flex h-full flex-col gap-1.5 overflow-auto pr-0.5">
      {sorted.map((e) => (
        <Row key={e.id} e={e} />
      ))}
    </div>
  );
}

function Row({ e }: { e: EvidenceItem }) {
  const supports = e.align >= 0;
  const color = supports ? 'var(--pos)' : 'var(--neg)';
  const mag = Math.abs(e.align) * 50; // half-bar width %
  return (
    <div className="cell px-2 py-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold text-[color:var(--text)]">{e.label}</span>
        <span className="mono text-[9px]" style={{ color }}>
          {supports ? '+' : ''}{e.align.toFixed(2)} <span className="text-[color:var(--dim)]">·w{e.weight.toFixed(1)}</span>
        </span>
      </div>
      {/* centred divergent bar: left = against, right = for */}
      <div className="relative mt-1 h-1 rounded-full bg-white/[0.05]">
        <div className="absolute left-1/2 top-0 h-full w-px bg-white/20" />
        <div className="absolute top-0 h-full rounded-full"
          style={{
            background: color,
            width: `${mag}%`,
            left: supports ? '50%' : undefined,
            right: supports ? undefined : '50%',
          }} />
      </div>
      <div className="mt-1 text-[8.5px] leading-tight text-[color:var(--dim)]">{e.detail}</div>
    </div>
  );
}
